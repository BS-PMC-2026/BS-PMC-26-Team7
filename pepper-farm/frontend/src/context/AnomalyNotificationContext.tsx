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
import type { RecentAlert } from '@/types/anomaly';
import type { Task } from '@/types/task';
import { useToast } from '@/context/ToastContext';

const FALLBACK_INTERVAL_MS = 30_000;
const TASK_POLL_INTERVAL_MS = 30_000;

interface AnomalyNotificationContextValue {
  unreadCount: number;
  clearUnread: () => void;
  /** Latest list of all alerts — updated on every SSE event or fallback poll */
  liveAlerts: RecentAlert[];
  /** Recently completed tasks — polled every 30 s */
  completedTasks: Task[];
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

export function AnomalyNotificationProvider({ children }: { children: ReactNode }) {
  const { show } = useToast();
  const seenAlertIds = useRef<Set<number>>(new Set());
  const seenTaskIds  = useRef<Set<number>>(new Set());
  const maxAlertId   = useRef<number>(0);
  const lastSeenTime = useRef<string | undefined>(undefined);
  const esRef        = useRef<EventSource | null>(null);
  const fallbackRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const taskPollRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const [unreadCount,     setUnreadCount]     = useState(0);
  const [liveAlerts,      setLiveAlerts]      = useState<RecentAlert[]>([]);
  const [completedTasks,  setCompletedTasks]  = useState<Task[]>([]);

  // ------------------------------------------------------------------
  // Process a new incoming alert (from SSE or fallback)
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
  // Mount: initial full load, then open SSE + start task polling
  // ------------------------------------------------------------------
  useEffect(() => {
    // Only run when a token is present (authenticated pages only)
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) return;

    let cancelled = false;

    async function init() {
      // Load alerts
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
        startFallback();
        return;
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
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [openSSE, startFallback, stopFallback, handleNewTask]);

  const clearUnread = useCallback(() => setUnreadCount(0), []);

  return (
    <AnomalyNotificationContext.Provider value={{ unreadCount, clearUnread, liveAlerts, completedTasks }}>
      {children}
    </AnomalyNotificationContext.Provider>
  );
}

export function useAnomalyNotification(): AnomalyNotificationContextValue {
  const ctx = useContext(AnomalyNotificationContext);
  if (!ctx) throw new Error('useAnomalyNotification must be used inside <AnomalyNotificationProvider>');
  return ctx;
}
