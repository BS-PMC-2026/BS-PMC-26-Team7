'use client';

import { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import SprayZoneMap from '@/components/spray/SprayZoneMap';
import { getZoneSprayMap, getSprayAlerts } from '@/services/spray';
import { ZoneSprayStatusData, ZoneSprayStatus, SprayAlert } from '@/types/spray';
import { RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';

// ── Status pill helper ────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ZoneSprayStatus, string> = {
  safe:              'Safe',
  unsafe:            'Unsafe',
  requires_approval: 'Needs Review',
  pending:           'Planned',
  never_sprayed:     'Never Sprayed',
};

const STATUS_STYLE: Record<ZoneSprayStatus, string> = {
  safe:              'bg-green-100 text-green-700 border-green-200',
  unsafe:            'bg-red-100 text-red-700 border-red-200',
  requires_approval: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  pending:           'bg-indigo-100 text-indigo-700 border-indigo-200',
  never_sprayed:     'bg-gray-100 text-gray-600 border-gray-200',
};

const SEVERITY_STYLE: Record<SprayAlert['Severity'], string> = {
  high:   'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low:    'bg-blue-100 text-blue-700 border-blue-200',
};

const SEVERITY_LABEL: Record<SprayAlert['Severity'], string> = {
  high:   'High',
  medium: 'Medium',
  low:    'Low',
};

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, count, style }: { label: string; count: number; style: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 flex flex-col gap-0.5 ${style}`}>
      <span className="text-2xl font-bold">{count}</span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SprayMapPage() {
  const [zones,         setZones]         = useState<ZoneSprayStatusData[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [lastFetch,     setLastFetch]     = useState<Date | null>(null);

  const [sprayAlerts,   setSprayAlerts]   = useState<SprayAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError,   setAlertsError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getZoneSprayMap();
      setZones(data);
      setLastFetch(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spray map.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true);
    setAlertsError(null);
    try {
      const data = await getSprayAlerts();
      setSprayAlerts(data);
    } catch (err) {
      setAlertsError(err instanceof Error ? err.message : 'Failed to load spray alerts.');
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const handleRefresh = useCallback(() => { load(); loadAlerts(); }, [load, loadAlerts]);

  // Summary counts
  const countByStatus = (status: ZoneSprayStatus) =>
    zones.filter((z) => z.sprayStatus === status).length;

  // Zones needing attention (unsafe + requires_approval)
  const attentionZones = zones.filter(
    (z) => z.sprayStatus === 'unsafe' || z.sprayStatus === 'requires_approval',
  );

  return (
    <div className="min-h-screen">
      {/* Page header */}
      <div className="border-b border-gray-200/60">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex items-start justify-between">
            <PageHeader
              label="Spray Safety"
              title="Spray Map"
              subtitle="Real-time spray status and re-entry safety for every greenhouse zone"
            />
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 mt-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Summary cards */}
        {!loading && zones.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <SummaryCard label="Safe"          count={countByStatus('safe')}              style={STATUS_STYLE.safe} />
            <SummaryCard label="Unsafe (REI)"  count={countByStatus('unsafe')}            style={STATUS_STYLE.unsafe} />
            <SummaryCard label="Needs Review"  count={countByStatus('requires_approval')} style={STATUS_STYLE.requires_approval} />
            <SummaryCard label="Planned"       count={countByStatus('pending')}           style={STATUS_STYLE.pending} />
            <SummaryCard label="Never Sprayed" count={countByStatus('never_sprayed')}     style={STATUS_STYLE.never_sprayed} />
          </div>
        )}

        {/* Attention-needed list */}
        {!loading && attentionZones.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-red-800 mb-3">
              ⚠️ Zones requiring attention ({attentionZones.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {attentionZones.map((z) => (
                <span
                  key={z.zoneId}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${STATUS_STYLE[z.sprayStatus]}`}
                >
                  {z.zoneCode}
                  <span className="opacity-70">— {STATUS_LABEL[z.sprayStatus]}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 animate-pulse">
            <div className="h-64 bg-gray-100 rounded-lg" />
          </div>
        )}

        {/* Map */}
        {!loading && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">
                Farm Zone Overview
                <span className="ml-2 text-xs font-normal text-gray-400">
                  — click any zone for details
                </span>
              </h2>
              {lastFetch && (
                <span className="text-xs text-gray-400">
                  Updated {lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <SprayZoneMap zones={zones} />
          </div>
        )}

        {/* Zone status table */}
        {!loading && zones.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Zone Status Table</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Zone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Sprayed</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Pesticide</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Safe Re-entry</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Next Planned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {zones.map((z) => (
                    <tr key={z.zoneId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800">{z.zoneName}</span>
                        <span className="block text-xs text-gray-400 font-mono">{z.zoneCode}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLE[z.sprayStatus]}`}>
                          {STATUS_LABEL[z.sprayStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {z.lastCompletedAtUtc
                          ? new Date(z.lastCompletedAtUtc).toLocaleDateString()
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {z.pesticideName ?? <span className="text-gray-300">—</span>}
                        {z.requiresApproval && (
                          <span className="ml-1 text-[10px] text-yellow-600 font-medium">⚠ unverified</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {z.safeToReEnterAtUtc ? (
                          <span className={new Date(z.safeToReEnterAtUtc) > new Date() ? 'text-red-600 font-medium' : 'text-green-700'}>
                            {new Date(z.safeToReEnterAtUtc).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-indigo-600">
                        {z.nextPlannedAtUtc
                          ? new Date(z.nextPlannedAtUtc).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && zones.length === 0 && !error && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🗺️</p>
            <p className="font-medium">No zones found.</p>
            <p className="text-sm mt-1">Make sure farm zones are configured in the database.</p>
          </div>
        )}

        {/* ── US30: Spray Alert History ───────────────────────────────────────── */}
        <section id="spray-alerts" className="scroll-mt-20" data-testid="spray-alerts-section">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-800">Spray Alert History</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Alerts generated automatically when workers submit spray reports
              </p>
            </div>
            {!alertsLoading && sprayAlerts.length > 0 && (
              <span className="text-xs text-gray-400">
                {sprayAlerts.filter((a) => !a.IsRead).length} unread of {sprayAlerts.length}
              </span>
            )}
          </div>

          {/* Alerts loading skeleton */}
          {alertsLoading && (
            <div className="space-y-2 animate-pulse" data-testid="spray-alerts-loading">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-gray-100 border border-gray-200" />
              ))}
            </div>
          )}

          {/* Alerts error */}
          {alertsError && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm" data-testid="spray-alerts-error">
              {alertsError}
            </div>
          )}

          {/* Alerts table */}
          {!alertsLoading && sprayAlerts.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" data-testid="spray-alerts-list">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Zone</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Severity</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Pesticide</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sprayed</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sprayAlerts.map((alert) => (
                      <tr
                        key={alert.SprayAlertId}
                        className={`hover:bg-gray-50 transition-colors ${!alert.IsRead ? 'bg-amber-50/40' : ''}`}
                        data-testid="spray-alert-row"
                      >
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5">
                            <span className={`shrink-0 ${alert.Severity === 'high' ? 'text-red-500' : alert.Severity === 'medium' ? 'text-amber-500' : 'text-blue-400'}`}>
                              {alert.IsRead ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                            </span>
                            <span>
                              <span className="font-medium text-gray-800">{alert.ZoneName}</span>
                              <span className="block text-xs text-gray-400 font-mono">{alert.ZoneCode}</span>
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${SEVERITY_STYLE[alert.Severity]}`}>
                            {SEVERITY_LABEL[alert.Severity]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {alert.PesticideName ?? <span className="text-gray-300">—</span>}
                          {alert.RequiresApproval && (
                            <span className="ml-1 text-[10px] text-yellow-600 font-medium">⚠ unverified</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 capitalize">
                          {alert.ReportStatus}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {fmtDate(alert.SprayedAtUtc)}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {timeAgo(alert.CreatedAt)}
                        </td>
                        <td className="px-4 py-3">
                          {alert.IsRead ? (
                            <span className="text-xs text-green-600 font-medium">Read</span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                              NEW
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Alerts empty state */}
          {!alertsLoading && sprayAlerts.length === 0 && !alertsError && (
            <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-200" data-testid="spray-alerts-empty">
              <p className="text-3xl mb-2">🛡️</p>
              <p className="font-medium text-sm">No spray alerts yet.</p>
              <p className="text-xs mt-1">Alerts appear here when workers submit spray reports.</p>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
