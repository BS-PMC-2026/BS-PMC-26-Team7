'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { getRecentAlerts } from '@/services/anomalies';
import { getCompletedTasks } from '@/services/tasks';
import { getSprayAlerts, markSprayAlertRead } from '@/services/spray';
import type { RecentAlert } from '@/types/anomaly';
import type { Task } from '@/types/task';
import type { SprayAlert } from '@/types/spray';
import { useToast } from '@/context/ToastContext';

const FALLBACK_INTERVAL_MS  = 30_000;
const TASK_POLL_INTERVAL_MS  = 30_000;
const SPRAY_POLL_INTERVAL_MS = 30_000;

interface AnomalyNotificationContextValue {
  unreadCount: number;
  clearUnread: () => void;
  /** Latest list of all sensor alerts — updated on every SSE event or fallback poll */
  liveAlerts: RecentAlert[];
  /** Recently completed tasks — polled every 30 s */
  completedTasks: Task[];
  /** US30: Spray alerts for manager — polled every 30 s */
  sprayAlerts: SprayAlert[];
  /** US30: Count of unread spray alerts */
  sprayUnreadCount: number;
  /** US30: Mark a spray alert read locally and via API */
  acknowledgeSprayAlert: (alertId: number) => void;
}

const AnomalyNotificationContext = createContext<AnomalyNotificationContextValue | null>(null);

function buildBody(alert: RecentAlert): string {
  const range =
    alert.minAllowed != null && alert.maxAllowed != null
      ? `(allowed ${alert.minAllowed}–${alert.maxAllowed})`
      : '';
  const location = [alert.zoneName, alert.pepperName].filter(Boolean).join(' · ');
  return [`${alert.metricName}: ${alert.actualValue} ${range}`, location]
    .filter(Boolean)
    .join('\n');
}

function buildSprayBody(alert: SprayAlert): string {
  const parts = [alert.ZoneName, alert.PesticideName].filter(Boolean);
  return parts.join(' · ');
}

export function AnomalyNotificationProvider({ children }: { children: ReactNode }) {
  const { show } = useToast();
  const seenAlertIds  = useRef<Set<number>>(new Set());
  const seenTaskIds   = useRef<Set<number>>(new Set());
  const seenSprayIds  = useRef<Set<number>>(new Set());
  const maxAlertId    = useRef<number>(0);
  const lastSeenTime  = useRef<string | undefined>(undefined);
  const esRef         = useRef<EventSource | null>(null);
  const fallbackRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const taskPollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const sprayPollRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const [unreadCount,      setUnreadCount]      = useState(0);
  const [liveAlerts,       setLiveAlerts]       = useState<RecentAlert[]>([]);
  const [completedTasks,   setCompletedTasks]   = useState<Task[]>([]);
  const [sprayAlerts,      setSprayAlerts]      = useState<SprayAlert[]>([]);
  const [sprayUnreadCount, setSprayUnreadCount] = useState(0);

  // ------------------------------------------------------------------
  // Process a new incoming sensor alert (from SSE or fallback)
  // ------------------------------------------------------------------
  const handleNewAlert = useCallback((alert: RecentAlert) => {
    if (seenAlertIds.current.has(alert.alertId)) return;
    seenAlertIds.current.add(alert.alertId);
    if (alert.alertId > maxAlertId.current) maxAlertId.current = alert.alertId;
    if (!alert.isResolved) {
      show({
        title: alert.severity === 'High' ? '🔴 High Severity Alert' : '🟡 Medium Alert',
        body: buildBody(alert),
        severity: alert.severity,
      });
      setUnreadCount((prev) => prev + 1);
    }
    setLiveAlerts((prev) => {
      const exists = prev.some((a) => a.alertId === alert.alertId);
      return exists ? prev : [alert, ...prev];
    });
  }, [show]);

  // ------------------------------------------------------------------
  // Process a newly completed task (from polling)
  // ------------------------------------------------------------------
  const handleNewTask = useCallback((task: Task) => {
    if (seenTaskIds.current.has(task.id)) return;
    seenTaskIds.current.add(task.id);
    setCompletedTasks((prev) => {
      const exists = prev.some((t) => t.id === task.id);
      return exists ? prev : [task, ...prev];
    });
    setUnreadCount((prev) => prev + 1);
  }, []);

  // ------------------------------------------------------------------
  // US30: Process a new spray alert (from polling)
  // ------------------------------------------------------------------
  const handleNewSprayAlert = useCallback((alert: SprayAlert) => {
    if (seenSprayIds.current.has(alert.SprayAlertId)) return;
    seenSprayIds.current.add(alert.SprayAlertId);
    setSprayAlerts((prev) => {
      const exists = prev.some((a) => a.SprayAlertId === alert.SprayAlertId);
      return exists ? prev : [alert, ...prev];
    });
    if (!alert.IsRead) {
      const severityLabel =
        alert.Severity === 'high' ? '🔴 Spray Alert — Urgent' :
        alert.Severity === 'medium' ? '🟡 Spray Alert — Unsafe Zone' :
        '🟢 Spray Alert';
      show({
        title: severityLabel,
        body: buildSprayBody(alert),
        severity: alert.Severity === 'high' ? 'High' : 'Medium',
      });
      setSprayUnreadCount((prev) => prev + 1);
    }
  }, [show]);

  // ------------------------------------------------------------------
  // US30: Acknowledge a spray alert locally + via API
  // ------------------------------------------------------------------
  const acknowledgeSprayAlert = useCallback((alertId: number) => {
    markSprayAlertRead(alertId).catch(() => {/* silent */});
    setSprayAlerts((prev) =>
      prev.map((a) => a.SprayAlertId === alertId ? { ...a, IsRead: true } : a),
    );
    setSprayUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  // ------------------------------------------------------------------
  // Fallback: REST poll every 30 s when SSE is unavailable
  // ------------------------------------------------------------------
  const startFallback = useCallback(() => {
    if (fallbackRef.current) return;
    fallbackRef.current = setInterval(async () => {
      try {
        const result = await getRecentAlerts({ limit: 20, since: lastSeenTime.current });
        result.items.forEach((a) => {
          if (a.createdAtUtc > (lastSeenTime.current ?? '')) {
            lastSeenTime.current = a.createdAtUtc;
          }
          handleNewAlert(a);
        });
      } catch {
        // silent
      }
    }, FALLBACK_INTERVAL_MS);
  }, [handleNewAlert]);

  const stopFallback = useCallback(() => {
    if (fallbackRef.current) {
      clearInterval(fallbackRef.current);
      fallbackRef.current = null;
    }
  }, []);

  // ------------------------------------------------------------------
  // SSE connection
  // ------------------------------------------------------------------
  const openSSE = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    const url = `/api/manager/anomalies/stream?last_alert_id=${maxAlertId.current}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('alert', (e: MessageEvent) => {
      try {
        const alert: RecentAlert = JSON.parse(e.data);
        handleNewAlert(alert);
      } catch {
        // malformed event — ignore
      }
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
      startFallback();
    };

    es.onopen = () => stopFallback();
  }, [handleNewAlert, startFallback, stopFallback]);

  // ------------------------------------------------------------------
  // Mount: initial full load, then open SSE + start polling
  // ------------------------------------------------------------------
  useEffect(() => {
    // Only run when a token is present (authenticated pages only)
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) return;

    let cancelled = false;

    async function init() {
      // Load sensor alerts
      try {
        const result = await getRecentAlerts({ limit: 20 });
        if (cancelled) return;
        const alerts = result.items;
        setLiveAlerts(alerts);
        alerts.forEach((a) => {
          seenAlertIds.current.add(a.alertId);
          if (a.alertId > maxAlertId.current) maxAlertId.current = a.alertId;
          if (a.createdAtUtc > (lastSeenTime.current ?? '')) {
            lastSeenTime.current = a.createdAtUtc;
          }
        });
      } catch {
        // Sensor alerts failed — start REST fallback but do NOT return.
        // Spray alerts and tasks must still load regardless.
        startFallback();
      }

      // Load completed tasks (seed silently — no unread bump)
      try {
        const tasks = await getCompletedTasks();
        if (cancelled) return;
        setCompletedTasks(tasks);
        tasks.forEach((t) => seenTaskIds.current.add(t.id));
      } catch {
        // silent
      }

      // US30: Load spray alerts (seed silently — no unread bump on initial load)
      try {
        const raw = await getSprayAlerts();
        if (cancelled) return;
        const alerts = Array.isArray(raw) ? raw : [];
        setSprayAlerts(alerts);
        let unread = 0;
        alerts.forEach((a) => {
          seenSprayIds.current.add(a.SprayAlertId);
          if (!a.IsRead) unread++;
        });
        setSprayUnreadCount(unread);
      } catch (err) {
        console.error('[SprayAlerts] Failed to load spray alerts:', err);
      }

      if (!cancelled) {
        openSSE();

        // Poll for new completed tasks every 30 s
        taskPollRef.current = setInterval(async () => {
          try {
            const tasks = await getCompletedTasks();
            tasks.forEach(handleNewTask);
          } catch {
            // silent
          }
        }, TASK_POLL_INTERVAL_MS);

        // US30: Poll for new spray alerts every 30 s
        sprayPollRef.current = setInterval(async () => {
          try {
            const alerts = await getSprayAlerts();
            alerts.forEach(handleNewSprayAlert);
          } catch {
            // silent
          }
        }, SPRAY_POLL_INTERVAL_MS);
      }
    }

    init();

    const onVisible = () => {
      if (document.visibilityState === 'visible' && !esRef.current) {
        stopFallback();
        openSSE();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      esRef.current?.close();
      esRef.current = null;
      stopFallback();
      if (taskPollRef.current) {
        clearInterval(taskPollRef.current);
        taskPollRef.current = null;
      }
      if (sprayPollRef.current) {
        clearInterval(sprayPollRef.current);
        sprayPollRef.current = null;
      }
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [openSSE, startFallback, stopFallback, handleNewTask, handleNewSprayAlert]);

  const clearUnread = useCallback(() => setUnreadCount(0), []);

  return (
    <AnomalyNotificationContext.Provider value={{
      unreadCount,
      clearUnread,
      liveAlerts,
      completedTasks,
      sprayAlerts,
      sprayUnreadCount,
      acknowledgeSprayAlert,
    }}>
      {children}
    </AnomalyNotificationContext.Provider>
  );
}

export function useAnomalyNotification(): AnomalyNotificationContextValue {
  const ctx = useContext(AnomalyNotificationContext);
  if (!ctx) throw new Error('useAnomalyNotification must be used inside <AnomalyNotificationProvider>');
  return ctx;
}
