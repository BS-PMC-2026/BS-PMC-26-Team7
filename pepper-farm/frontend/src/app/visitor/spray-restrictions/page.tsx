'use client';

import { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import SprayZoneMap from '@/components/spray/SprayZoneMap';
import { getPublicRestrictedZones } from '@/services/spray';
import { ZoneSprayStatusData, ZoneSprayStatus, EntryPermissionStatus } from '@/types/spray';
import { ShieldAlert } from 'lucide-react';
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

export default function VisitorSprayRestrictionsPage() {
  const { t } = useLanguage();
  const sp = t.spray;
  const [zones,   setZones]   = useState<ZoneSprayStatusData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPublicRestrictedZones();
      setZones(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : sp.failedToLoadFormData);
    } finally {
      setLoading(false);
    }
  }, [sp.failedToLoadFormData]);

  useEffect(() => { load(); }, [load]);

  const restrictedZones = zones.filter(
    (z) => z.sprayStatus === 'unsafe' || z.sprayStatus === 'requires_approval',
  );
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
    caution: sp.cautionConsultStaff,
    planned_warning: sp.entryPermittedSprayDue,
    no_data: sp.entryPermitted,
  };

  return (
    <div className="app-page-bg" data-testid="visitor-spray-restrictions-page">
      {/* Header */}
      <div className="bg-white border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <PageHeader
            label={sp.visitorSafetyLabel}
            title={sp.visitorRestrictionMapTitle}
            subtitle={sp.visitorRestrictionMapSubtitle}
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-[var(--color-error-bg)] border border-[var(--color-border)] text-[var(--color-error)] px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Safety notice */}
        <div className="rounded-xl bg-[var(--color-warning-bg)] border border-[var(--color-warning)] px-4 py-3 flex items-start gap-3 text-sm text-[var(--color-warning)]">
          <ShieldAlert size={18} className="shrink-0 mt-0.5 text-[var(--color-warning)]" />
          <div>
            <span className="font-semibold">{sp.visitorSafetyNotice} </span>
            {sp.doNotEnterRestricted} {sp.consultStaff}
          </div>
        </div>

        {/* Restricted zones highlight */}
        {!loading && restrictedZones.length > 0 && (
          <div className="bg-[var(--color-error-bg)] border border-[var(--color-border)] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[var(--color-error)] mb-3">
              {sp.restrictedZonesTitle} ({restrictedZones.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {restrictedZones.map((z) => (
                <span
                  key={z.zoneId}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${STATUS_STYLE[z.sprayStatus]}`}
                >
                  {z.zoneName}
                  <span className="opacity-70">- {statusLabel[z.sprayStatus]}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* No restricted zones */}
        {!loading && restrictedZones.length === 0 && zones.length > 0 && !error && (
          <div className="rounded-xl bg-[var(--color-secondary-light)] border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-primary)] flex items-center gap-2">
            <span className="text-[var(--color-primary)]">✅</span>
            <span>{sp.allZonesOpen}</span>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-sm p-6 animate-pulse">
            <div className="h-64 bg-[var(--color-muted)] rounded-lg" />
          </div>
        )}

        {/* Map */}
        {!loading && (
          <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-sm p-6">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-[var(--color-foreground)]">
                {sp.farmZoneSafetyOverview}
                <span className="ml-2 text-xs font-normal text-[var(--color-muted-foreground)]">
                  - {sp.clickZoneDetails}
                </span>
              </h2>
            </div>
            <SprayZoneMap zones={zones} />
          </div>
        )}

        {/* Zone list */}
        {!loading && zones.length > 0 && (
          <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden" data-testid="zone-table">
            <div className="px-6 py-4 border-b border-[var(--color-border)]">
              <h2 className="text-sm font-semibold text-[var(--color-foreground)]">{sp.zoneEntryStatus}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">{sp.zone}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">{sp.entryPermission}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">{sp.safeReentryTime}</th>
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
                        {/* US33 — primary entry permission badge */}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ENTRY_STYLE[z.entryPermissionStatus ?? 'no_data']}`}
                          data-testid="entry-permission-status"
                        >
                          {entryLabel[z.entryPermissionStatus ?? 'no_data']}
                        </span>
                        <span className={`block mt-0.5 text-xs ${STATUS_STYLE[z.sprayStatus]} rounded px-1`}>
                          {statusLabel[z.sprayStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {z.safeToReEnterAtUtc ? (
                          <span className={new Date(z.safeToReEnterAtUtc) > new Date() ? 'text-[var(--color-error)] font-medium' : 'text-[var(--color-primary)]'}>
                            {new Date(z.safeToReEnterAtUtc).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : z.entryPermissionStatus === 'caution' ? (
                          <span className="text-[var(--color-warning)] text-xs">{sp.consultFarmStaff}</span>
                        ) : (
                          <span className="text-[var(--color-primary)] text-xs font-medium">{sp.openForEntry}</span>
                        )}
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
            <p className="font-medium">{sp.noZonesFound}</p>
          </div>
        )}

      </div>
    </div>
  );
}
