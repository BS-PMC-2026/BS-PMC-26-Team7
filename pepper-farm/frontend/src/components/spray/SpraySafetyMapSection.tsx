'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import SprayZoneMap from '@/components/spray/SprayZoneMap';
import { getRestrictedZones } from '@/services/spray';
import { EntryPermissionStatus, ZoneSprayStatus, ZoneSprayStatusData } from '@/types/spray';
import { useLanguage } from '@/context/LanguageContext';

const STATUS_STYLE: Record<ZoneSprayStatus, string> = {
  safe:              'bg-[var(--color-secondary-light)] text-[var(--color-primary)] border-[var(--color-border)]',
  unsafe:            'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-border)]',
  requires_approval: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-border)]',
  pending:           'bg-indigo-100 text-indigo-700 border-indigo-200',
  never_sprayed:     'bg-[var(--color-muted)] text-[var(--color-muted-foreground)] border-[var(--color-border)]',
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

export default function SpraySafetyMapSection() {
  const { t } = useLanguage();
  const sp = t.spray;

  const statusLabel: Record<ZoneSprayStatus, string> = {
    safe: sp.safe,
    unsafe: sp.restrictedWithinRei,
    requires_approval: sp.cautionUnverified,
    pending: sp.summaryPlanned,
    never_sprayed: sp.noRecentSpray,
  };

  const entryLabel: Record<EntryPermissionStatus, string> = {
    allowed: sp.entryPermitted,
    restricted: sp.entryRestricted,
    caution: sp.cautionConsultManager,
    planned_warning: sp.entryPermittedSprayDue,
    no_data: sp.entryPermitted,
  };

  const [zones, setZones] = useState<ZoneSprayStatusData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRestrictedZones();
      setZones(data);
      setLastFetch(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : sp.failedToLoadFormData);
    } finally {
      setLoading(false);
    }
  }, [sp.failedToLoadFormData]);

  useEffect(() => { load(); }, [load]);

  const countByStatus = (status: ZoneSprayStatus) =>
    zones.filter((z) => z.sprayStatus === status).length;

  const restrictedZones = zones.filter(
    (z) => z.sprayStatus === 'unsafe' || z.sprayStatus === 'requires_approval',
  );

  return (
    <section className="space-y-6" data-testid="spray-restrictions-page">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-foreground)]">{sp.farmZoneSafetyOverview}</h2>
          <p className="text-sm text-[var(--color-muted-foreground)] mt-1">{sp.sprayRestrictionMapSubtitle}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] disabled:opacity-50 transition"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {sp.refresh}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-[var(--color-error-bg)] border border-[var(--color-border)] text-[var(--color-error)] px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="rounded-xl bg-[var(--color-warning-bg)] border border-[var(--color-warning)] px-4 py-3 flex items-start gap-3 text-sm text-[var(--color-warning)]">
        <ShieldAlert size={18} className="shrink-0 mt-0.5 text-[var(--color-warning)]" />
        <div>
          <span className="font-semibold">{sp.safetyNotice} </span>
          {sp.doNotEnterRestricted} {sp.consultManager}
        </div>
      </div>

      {!loading && zones.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="summary-cards">
          <SummaryCard label={sp.summarySafe}       count={countByStatus('safe')}              style={STATUS_STYLE.safe} />
          <SummaryCard label={sp.summaryRestricted} count={countByStatus('unsafe')}            style={STATUS_STYLE.unsafe} />
          <SummaryCard label={sp.summaryCaution}    count={countByStatus('requires_approval')} style={STATUS_STYLE.requires_approval} />
          <SummaryCard label={sp.summaryPlanned}    count={countByStatus('pending')}           style={STATUS_STYLE.pending} />
          <SummaryCard label={sp.summaryNoRecent}   count={countByStatus('never_sprayed')}     style={STATUS_STYLE.never_sprayed} />
        </div>
      )}

      {!loading && restrictedZones.length > 0 && (
        <div className="bg-[var(--color-error-bg)] border border-[var(--color-border)] rounded-xl p-4" data-testid="restricted-zones-banner">
          <h3 className="text-sm font-semibold text-[var(--color-error)] mb-3">
            {sp.workerRestrictedZonesTitle} ({restrictedZones.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {restrictedZones.map((z) => (
              <span key={z.zoneId} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${STATUS_STYLE[z.sprayStatus]}`}>
                {z.zoneCode}
                <span className="opacity-70">- {statusLabel[z.sprayStatus]}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-sm p-6 animate-pulse" data-testid="loading-skeleton">
          <div className="h-64 bg-[var(--color-muted)] rounded-lg" />
        </div>
      )}

      {!loading && (
        <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--color-foreground)]">
              {sp.farmZoneSafetyOverview}
              <span className="ml-2 text-xs font-normal text-[var(--color-muted-foreground)]">
                - {sp.clickZoneDetails}
              </span>
            </h2>
            {lastFetch && (
              <span className="text-xs text-[var(--color-muted-foreground)]">
                {t.common.updated} {lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <SprayZoneMap zones={zones} />
        </div>
      )}

      {!loading && zones.length > 0 && (
        <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden" data-testid="zone-table">
          <div className="px-6 py-4 border-b border-[var(--color-border)]">
            <h2 className="text-sm font-semibold text-[var(--color-foreground)]">{sp.zoneEntryDetails}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">{sp.zone}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">{sp.entryPermission}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">{sp.safeReentry}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">{sp.pesticide}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">{sp.nextPlanned}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-muted)]">
                {zones.map((z) => (
                  <tr key={z.zoneId} className="hover:bg-[var(--color-muted)] transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-[var(--color-foreground)]">{z.zoneName}</span>
                      <span className="block text-xs text-[var(--color-muted-foreground)]">{z.zoneCode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ENTRY_STYLE[z.entryPermissionStatus ?? 'no_data']}`} data-testid="entry-permission-status">
                        {entryLabel[z.entryPermissionStatus ?? 'no_data']}
                      </span>
                      <span className={`block mt-0.5 text-xs ${STATUS_STYLE[z.sprayStatus]} rounded px-1`}>
                        {statusLabel[z.sprayStatus]}
                      </span>
                      {z.remainingRestrictionMinutes !== null && z.remainingRestrictionMinutes !== undefined && (
                        <span className="block mt-0.5 text-xs text-[var(--color-error)] font-semibold">
                          {z.remainingRestrictionMinutes >= 60
                            ? `${Math.floor(z.remainingRestrictionMinutes / 60)}h ${z.remainingRestrictionMinutes % 60}m ${t.common.remaining}`
                            : `${z.remainingRestrictionMinutes}m ${t.common.remaining}`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {z.safeToReEnterAtUtc ? (
                        <span className={new Date(z.safeToReEnterAtUtc) > new Date() ? 'text-[var(--color-error)] font-medium' : 'text-[var(--color-primary)]'}>
                          {new Date(z.safeToReEnterAtUtc).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : z.entryPermissionStatus === 'caution' ? (
                        <span className="text-[var(--color-warning)] text-xs">{sp.consultManager}</span>
                      ) : (
                        <span className="text-[var(--color-primary)] text-xs font-medium">{sp.safeToEnter}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                      {z.pesticideName ?? <span className="text-[var(--color-muted-foreground)] opacity-50">-</span>}
                      {z.requiresApproval && (
                        <span className="ml-1 text-[10px] text-[var(--color-warning)] font-medium">{sp.unverified}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-indigo-600">
                      {z.nextPlannedAtUtc
                        ? new Date(z.nextPlannedAtUtc).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : <span className="text-[var(--color-muted-foreground)] opacity-50">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && zones.length === 0 && !error && (
        <div className="text-center py-16 text-[var(--color-muted-foreground)]">
          <p className="font-medium">{sp.noZonesFound}</p>
          <p className="text-sm mt-1">{sp.configureZones}</p>
        </div>
      )}
    </section>
  );
}
