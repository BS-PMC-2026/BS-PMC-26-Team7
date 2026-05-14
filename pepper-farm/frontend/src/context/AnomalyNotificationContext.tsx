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
import type { RecentAlert } from '@/types/anomaly';
import { useToast } from '@/context/ToastContext';
import { API_URL } from '@/lib/constants';

const FALLBACK_INTERVAL_MS = 30_000;

interface AnomalyNotificationContextValue {
  unreadCount: number;
  clearUnread: () => void;
  /** Latest list of all alerts — updated on every SSE event or fallback poll */
  liveAlerts: RecentAlert[];
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
  const seenIds = useRef<Set<number>>(new Set());
  const maxAlertId = useRef<number>(0);
  const lastSeenTime = useRef<string | undefined>(undefined);
  const esRef = useRef<EventSource | null>(null);
  const fallbackRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [liveAlerts, setLiveAlerts] = useState<RecentAlert[]>([]);

  // ------------------------------------------------------------------
  // Process a new incoming alert (from SSE or fallback)
  // ------------------------------------------------------------------
  const handleNewAlert = useCallback((alert: RecentAlert) => {
    if (seenIds.current.has(alert.alertId)) return;
    seenIds.current.add(alert.alertId);
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
  // Fallback: REST poll every 30 s when SSE is unavailable
  // ------------------------------------------------------------------
  const startFallback = useCallback(() => {
    if (fallbackRef.current) return; // already running
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
    const url = `${API_URL}/api/manager/anomalies/stream?last_alert_id=${maxAlertId.current}`;
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
      // SSE disconnected — close and start fallback
      es.close();
      esRef.current = null;
      startFallback();
    };

    // SSE connected — stop any running fallback
    es.onopen = () => stopFallback();
  }, [handleNewAlert, startFallback, stopFallback]);

  // ------------------------------------------------------------------
  // Mount: initial full load, then open SSE
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const result = await getRecentAlerts({ limit: 100 });
        if (cancelled) return;
        const alerts = result.items;

        // Seed state silently — no toasts for existing alerts
        setLiveAlerts(alerts);
        alerts.forEach((a) => {
          seenIds.current.add(a.alertId);
          if (a.alertId > maxAlertId.current) maxAlertId.current = a.alertId;
          if (a.createdAtUtc > (lastSeenTime.current ?? '')) {
            lastSeenTime.current = a.createdAtUtc;
          }
        });
      } catch {
        // Initial load failed — start fallback immediately
        startFallback();
        return;
      }
      openSSE();
    }

    init();

    // Reconnect SSE when tab becomes visible again
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
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [openSSE, startFallback, stopFallback]);

  const clearUnread = useCallback(() => setUnreadCount(0), []);

  return (
    <AnomalyNotificationContext.Provider value={{ unreadCount, clearUnread, liveAlerts }}>
      {children}
    </AnomalyNotificationContext.Provider>
  );
}

export function useAnomalyNotification(): AnomalyNotificationContextValue {
  const ctx = useContext(AnomalyNotificationContext);
  if (!ctx) throw new Error('useAnomalyNotification must be used inside <AnomalyNotificationProvider>');
  return ctx;
}
