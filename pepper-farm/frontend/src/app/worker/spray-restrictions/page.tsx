'use client';

import { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import SprayZoneMap from '@/components/spray/SprayZoneMap';
import { getRestrictedZones } from '@/services/spray';
import { ZoneSprayStatusData, ZoneSprayStatus, EntryPermissionStatus } from '@/types/spray';
import { RefreshCw, ShieldAlert } from 'lucide-react';

const STATUS_LABEL: Record<ZoneSprayStatus, string> = {
  safe:              'Safe',
  unsafe:            'Restricted (within REI)',
  requires_approval: 'Caution — Unverified',
  pending:           'Spray Planned',
  never_sprayed:     'No Recent Spray',
};

const STATUS_STYLE: Record<ZoneSprayStatus, string> = {
  safe:              'bg-[var(--color-secondary-light)] text-[var(--color-primary)] border-[var(--color-border)]',
  unsafe:            'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-border)]',
  requires_approval: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-border)]',
  pending:           'bg-indigo-100 text-indigo-700 border-indigo-200',
  never_sprayed:     'bg-[var(--color-muted)] text-[var(--color-muted-foreground)] border-[var(--color-border)]',
};

// US33 — Entry permission badge styles (worker view)
const ENTRY_LABEL: Record<EntryPermissionStatus, string> = {
  allowed:         'Entry Permitted',
  restricted:      'Entry Restricted',
  caution:         'Caution — Consult Manager',
  planned_warning: 'Entry Permitted (Spray Due)',
  no_data:         'Entry Permitted',
};

const ENTRY_STYLE: Record<EntryPermissionStatus, string> = {
  allowed:         'bg-[var(--color-secondary-light)] text-[var(--color-primary)] border-[var(--color-border)]',
  restricted:      'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-border)]',
  caution:         'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-border)]',
  planned_warning: 'bg-[var(--color-info-bg)] text-[var(--color-info)] border-[var(--color-border)]',
  no_data:         'bg-[var(--color-muted)] text-[var(--color-muted-foreground)] border-[var(--color-border)]',
};

function SummaryCard({ label, count, style }: { label: string; count: number; style: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 flex flex-col gap-0.5 ${style}`}>
      <span className="text-2xl font-bold">{count}</span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

export default function WorkerSprayRestrictionsPage() {
  const [zones,     setZones]     = useState<ZoneSprayStatusData[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRestrictedZones();
      setZones(data);
      setLastFetch(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load restriction map.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const countByStatus = (status: ZoneSprayStatus) =>
    zones.filter((z) => z.sprayStatus === status).length;

  const restrictedZones = zones.filter(
    (z) => z.sprayStatus === 'unsafe' || z.sprayStatus === 'requires_approval',
  );

  return (
    <div className="min-h-screen" data-testid="spray-restrictions-page">
      {/* Page header */}
      <div className="border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex items-start justify-between">
            <PageHeader
              label="Safety"
              title="Spray Restrictions Map"
              subtitle="Check which greenhouse areas are currently restricted due to recent spraying"
            />
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 mt-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] disabled:opacity-50 transition"
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
          <div className="rounded-lg bg-[var(--color-error-bg)] border border-[var(--color-border)] text-[var(--color-error)] px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Safety notice banner */}
        <div className="rounded-xl bg-[var(--color-warning-bg)] border border-[var(--color-warning)] px-4 py-3 flex items-start gap-3 text-sm text-[var(--color-warning)]">
          <ShieldAlert size={18} className="shrink-0 mt-0.5 text-[var(--color-warning)]" />
          <div>
            <span className="font-semibold">Safety notice: </span>
            Do not enter any zone marked as <strong>Restricted</strong> or <strong>Caution</strong>.
            Consult your manager or supervisor if you are unsure.
          </div>
        </div>

        {/* Summary cards */}
        {!loading && zones.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="summary-cards">
            <SummaryCard label="Safe"            count={countByStatus('safe')}              style={STATUS_STYLE.safe} />
            <SummaryCard label="Restricted (REI)" count={countByStatus('unsafe')}           style={STATUS_STYLE.unsafe} />
            <SummaryCard label="Caution"          count={countByStatus('requires_approval')} style={STATUS_STYLE.requires_approval} />
            <SummaryCard label="Spray Planned"    count={countByStatus('pending')}           style={STATUS_STYLE.pending} />
            <SummaryCard label="No Recent Spray"  count={countByStatus('never_sprayed')}     style={STATUS_STYLE.never_sprayed} />
          </div>
        )}

        {/* Restricted zones highlight */}
        {!loading && restrictedZones.length > 0 && (
          <div className="bg-[var(--color-error-bg)] border border-[var(--color-border)] rounded-xl p-4" data-testid="restricted-zones-banner">
            <h3 className="text-sm font-semibold text-[var(--color-error)] mb-3">
              🚫 Restricted zones — do not enter ({restrictedZones.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {restrictedZones.map((z) => (
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
          <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-sm p-6 animate-pulse" data-testid="loading-skeleton">
            <div className="h-64 bg-[var(--color-muted)] rounded-lg" />
          </div>
        )}

        {/* Map */}
        {!loading && (
          <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[var(--color-foreground)]">
                Farm Zone Safety Overview
                <span className="ml-2 text-xs font-normal text-[var(--color-muted-foreground)]">
                  — click any zone for details
                </span>
              </h2>
              {lastFetch && (
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  Updated {lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <SprayZoneMap zones={zones} />
          </div>
        )}

        {/* Zone status table */}
        {!loading && zones.length > 0 && (
          <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden" data-testid="zone-table">
            <div className="px-6 py-4 border-b border-[var(--color-border)]">
              <h2 className="text-sm font-semibold text-[var(--color-foreground)]">Zone Entry Details</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">Zone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">Entry Permission</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">Safe Re-entry</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">Pesticide</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">Next Planned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-muted)]">
                  {zones.map((z) => (
                    <tr key={z.zoneId} className="hover:bg-[var(--color-muted)] transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-[var(--color-foreground)]">{z.zoneName}</span>
                        <span className="block text-xs text-[var(--color-muted-foreground)] font-mono">{z.zoneCode}</span>
                      </td>
                      <td className="px-4 py-3">
                        {/* US33 — primary entry permission badge */}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ENTRY_STYLE[z.entryPermissionStatus ?? 'no_data']}`}
                          data-testid="entry-permission-status"
                        >
                          {ENTRY_LABEL[z.entryPermissionStatus ?? 'no_data']}
                        </span>
                        <span className={`block mt-0.5 text-xs ${STATUS_STYLE[z.sprayStatus]} rounded px-1`}>
                          {STATUS_LABEL[z.sprayStatus]}
                        </span>
                        {z.remainingRestrictionMinutes !== null &&
                          z.remainingRestrictionMinutes !== undefined && (
                          <span className="block mt-0.5 text-xs text-[var(--color-error)] font-semibold">
                            {z.remainingRestrictionMinutes >= 60
                              ? `${Math.floor(z.remainingRestrictionMinutes / 60)}h ${z.remainingRestrictionMinutes % 60}m remaining`
                              : `${z.remainingRestrictionMinutes}m remaining`}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {z.safeToReEnterAtUtc ? (
                          <span className={new Date(z.safeToReEnterAtUtc) > new Date() ? 'text-[var(--color-error)] font-medium' : 'text-[var(--color-primary)]'}>
                            {new Date(z.safeToReEnterAtUtc).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : z.entryPermissionStatus === 'caution' ? (
                          <span className="text-[var(--color-warning)] text-xs">Consult manager</span>
                        ) : (
                          <span className="text-[var(--color-primary)] text-xs font-medium">Safe to enter</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                        {z.pesticideName ?? <span className="text-[var(--color-muted-foreground)] opacity-50">—</span>}
                        {z.requiresApproval && (
                          <span className="ml-1 text-[10px] text-[var(--color-warning)] font-medium">⚠ unverified</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-indigo-600">
                        {z.nextPlannedAtUtc
                          ? new Date(z.nextPlannedAtUtc).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : <span className="text-[var(--color-muted-foreground)] opacity-50">—</span>}
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
          <div className="text-center py-16 text-[var(--color-muted-foreground)]">
            <p className="text-4xl mb-3">🗺️</p>
            <p className="font-medium">No zones found.</p>
            <p className="text-sm mt-1">Make sure farm zones are configured in the database.</p>
          </div>
        )}

      </div>
    </div>
  );
}
