'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { buildAlertTaskQueryString } from '@/lib/alertToTask';
import Alert from '@/components/ui/Alert';
import AnomalySummaryCards from '@/components/anomalies/AnomalySummaryCards';
import AnomalyTrendChart from '@/components/anomalies/AnomalyTrendChart';
import AnomalyMetricChart from '@/components/anomalies/AnomalyMetricChart';
import ZoneHealthOverview from '@/components/anomalies/ZoneHealthOverview';
import RecentAnomaliesTable from '@/components/anomalies/RecentAnomaliesTable';
import {
  getAnomalySummary,
  getAnomalyTrends,
  getZoneHealth,
  getRecentAlerts,
} from '@/services/anomalies';
import type { AnomalySummary, RecentAlert, TrendPoint, ZoneHealth } from '@/types/anomaly';
import { useAnomalyNotification } from '@/context/AnomalyNotificationContext';
import RecurrenceConfigPanel from '@/components/anomalies/RecurrenceConfigPanel';

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-100 rounded-xl animate-pulse ${className}`} />;
}

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex justify-between mb-4">
            <Skeleton className="h-3 w-20 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <Skeleton className="h-9 w-14 rounded-lg mb-2" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <Skeleton className="h-4 w-32 mb-1 rounded-full" />
      <Skeleton className="h-3 w-20 mb-5 rounded-full" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

function ZoneSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex justify-between mb-3">
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="h-4 w-6 rounded-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-12 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <Skeleton className="h-3 w-full rounded-full" />
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="border-b border-gray-100 px-4 py-3">
          <Skeleton className="h-4 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
function Section({
  label,
  children,
  right,
}: {
  label: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Refresh icon
// ---------------------------------------------------------------------------
function IconRefresh({ className, spinning }: { className?: string; spinning?: boolean }) {
  return (
    <svg
      className={`${className} ${spinning ? 'animate-spin' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

function IconArrowLeft({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AnomalyDashboardPage() {
  const router = useRouter();
  const { liveAlerts, clearUnread } = useAnomalyNotification();

  const PAGE_SIZE = 50;

  const [summary, setSummary] = useState<AnomalySummary | null>(null);
  const [alerts, setAlerts] = useState<RecentAlert[]>([]);
  const [chartAlerts, setChartAlerts] = useState<RecentAlert[]>([]);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [zones, setZones] = useState<ZoneHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<'High' | 'Medium' | ''>('');
  const [filterStatus, setFilterStatus] = useState<'active' | 'resolved' | 'all' | ''>('');
  const [filterRecurring, setFilterRecurring] = useState<boolean>(false);
  const [showRecurrenceConfig, setShowRecurrenceConfig] = useState(false);
  const [offset, setOffset] = useState(0);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);

  // Clear unread badge when this page is open
  useEffect(() => {
    clearUnread();
  }, [clearUnread]);

  const loadAlerts = useCallback(async (silent = false) => {
    if (!silent) setTableLoading(true);
    try {
      const [pageResult, chartResult] = await Promise.all([
        getRecentAlerts({
          limit: PAGE_SIZE,
          offset,
          severity: filterSeverity || undefined,
          status: filterStatus || undefined,
          recurring: filterRecurring ? true : undefined,
        }),
        getRecentAlerts({
          limit: 200,
          offset: 0,
          severity: filterSeverity || undefined,
          status: filterStatus || undefined,
          recurring: filterRecurring ? true : undefined,
        }),
      ]);
      setAlerts(pageResult.items);
      setTotalAlerts(pageResult.total);
      setChartAlerts(chartResult.items);
    } catch {
      // silent fail — don't flash an error for background table refreshes
    } finally {
      if (!silent) setTableLoading(false);
    }
  }, [offset, filterSeverity, filterStatus, filterRecurring]);

  // Re-fetch table when filters or page change
  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  // When live feed delivers new alerts, silently refresh the table too
  useEffect(() => {
    if (loading) return;
    loadAlerts(true);
  }, [liveAlerts]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSilent = useCallback(async () => {
    try {
      const [summaryData, trendsData, zonesData] = await Promise.all([
        getAnomalySummary(),
        getAnomalyTrends(7),
        getZoneHealth(),
      ]);
      setSummary(summaryData);
      setTrends(trendsData);
      setZones(zonesData);
    } catch {
      // silent — don't overwrite existing data on background refresh failure
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, trendsData, zonesData] = await Promise.all([
        getAnomalySummary(),
        getAnomalyTrends(7),
        getZoneHealth(),
      ]);
      setSummary(summaryData);
      setTrends(trendsData);
      setZones(zonesData);
    } catch {
      setError('Failed to load anomaly data. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load (shows skeleton)
  useEffect(() => { load(); }, [load]);

  // Auto-refresh overview & analytics whenever the polling feed updates
  useEffect(() => {
    if (loading) return; // skip during initial load
    loadSilent();
  }, [liveAlerts]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = () => setOffset(0);

  const handleCreateTask = useCallback((alert: RecentAlert) => {
    router.push(`/manager/tasks?${buildAlertTaskQueryString(alert)}`);
  }, [router]);

  const handleAlertResolved = (alertId: number) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.alertId === alertId
          ? { ...a, isResolved: true, resolvedAtUtc: new Date().toISOString() }
          : a
      )
    );
    setSummary((prev) =>
      prev
        ? {
            ...prev,
            activeAlerts: Math.max(0, prev.activeAlerts - 1),
            highSeverity: Math.max(
              0,
              prev.highSeverity -
                (alerts.find((a) => a.alertId === alertId)?.severity === 'High' ? 1 : 0)
            ),
          }
        : prev
    );
  };

  const activeCount = alerts.filter((a) => !a.isResolved).length;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Top bar ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Left: back + title */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/manager"
              className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors duration-150 cursor-pointer shrink-0"
              aria-label="Back to dashboard"
            >
              <IconArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-base font-semibold text-gray-900 truncate">Sensor Anomaly Dashboard</h1>
              {!loading && summary && summary.activeAlerts > 0 && (
                <span className="shrink-0 inline-flex items-center text-[11px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
                  {summary.activeAlerts}
                </span>
              )}
            </div>
          </div>

          {/* Right: live indicator + refresh */}
          <div className="flex items-center gap-3 shrink-0">
            {!loading && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live
              </div>
            )}
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 border border-gray-200 bg-white px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors duration-150 disabled:opacity-50 cursor-pointer"
            >
              <IconRefresh className="w-3.5 h-3.5" spinning={loading} />
              <span className="hidden sm:inline">{loading ? 'Refreshing' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {error && <Alert variant="error">{error}</Alert>}

        {/* KPI Cards */}
        <Section label="Overview">
          {loading ? <SummarySkeleton /> : summary ? <AnomalySummaryCards summary={summary} /> : null}
        </Section>

        {/* Charts */}
        <Section label="Analytics">
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartSkeleton />
              <ChartSkeleton />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <p className="text-sm font-semibold text-gray-800">Anomalies Over Time</p>
                <p className="text-xs text-gray-400 mb-5">Last 7 days</p>
                <AnomalyTrendChart data={trends} />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <p className="text-sm font-semibold text-gray-800">Alerts by Metric</p>
                <p className="text-xs text-gray-400 mb-5">
                  {filterSeverity || filterStatus ? 'Filtered view' : 'All time'}
                </p>
                <AnomalyMetricChart alerts={chartAlerts} />
              </div>
            </div>
          )}
        </Section>

        {/* Zone Health */}
        <Section label="Zone Health">
          {loading ? <ZoneSkeleton /> : <ZoneHealthOverview zones={zones} />}
        </Section>

        {/* Table */}
        <Section
          label="Alert History"
          right={
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  handleFilterChange();
                  setFilterRecurring((v) => !v);
                }}
                className={`text-xs px-3 py-1 rounded-lg border transition-colors duration-150 cursor-pointer font-medium ${
                  filterRecurring
                    ? 'bg-amber-100 text-amber-700 border-amber-300'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Recurring only
              </button>
              <button
                onClick={() => setShowRecurrenceConfig(true)}
                title="Configure recurrence thresholds"
                className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors cursor-pointer"
              >
                ⚙︎
              </button>
              <select
                value={filterSeverity}
                onChange={(e) => {
                  handleFilterChange();
                  setFilterSeverity(e.target.value as 'High' | 'Medium' | '');
                }}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 cursor-pointer"
              >
                <option value="">All Severities</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => {
                  handleFilterChange();
                  setFilterStatus(e.target.value as 'active' | 'resolved' | 'all' | '');
                }}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="resolved">Resolved</option>
              </select>
              {!loading && activeCount > 0 && (
                <span className="text-xs text-gray-400 tabular-nums">{activeCount} active</span>
              )}
            </div>
          }
        >
          {loading || tableLoading ? <TableSkeleton /> : (
            <>
              <RecentAnomaliesTable
                alerts={alerts}
                onAlertResolved={handleAlertResolved}
                onCreateTask={handleCreateTask}
              />
              {totalAlerts > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                  <span className="tabular-nums">
                    {offset + 1}–{Math.min(offset + PAGE_SIZE, totalAlerts)} of {totalAlerts}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={offset === 0}
                      onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                      className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 cursor-pointer"
                    >
                      Prev
                    </button>
                    <button
                      disabled={offset + PAGE_SIZE >= totalAlerts}
                      onClick={() => setOffset((o) => o + PAGE_SIZE)}
                      className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Section>

      </div>

      {showRecurrenceConfig && (
        <RecurrenceConfigPanel onClose={() => setShowRecurrenceConfig(false)} />
      )}
    </div>
  );
}
