'use client';

import { useState, useEffect, useCallback } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import SprayZoneMap from '@/components/spray/SprayZoneMap';
import { getRestrictedZones } from '@/services/spray';
import { ZoneSprayStatusData, ZoneSprayStatus } from '@/types/spray';
import { ShieldAlert } from 'lucide-react';

const STATUS_LABEL: Record<ZoneSprayStatus, string> = {
  safe:              'Safe',
  unsafe:            'Restricted (within REI)',
  requires_approval: 'Caution — Unverified',
  pending:           'Spray Planned',
  never_sprayed:     'No Recent Spray',
};

const STATUS_STYLE: Record<ZoneSprayStatus, string> = {
  safe:              'bg-green-100 text-green-700 border-green-200',
  unsafe:            'bg-red-100 text-red-700 border-red-200',
  requires_approval: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  pending:           'bg-indigo-100 text-indigo-700 border-indigo-200',
  never_sprayed:     'bg-gray-100 text-gray-600 border-gray-200',
};

export default function VisitorSprayRestrictionsPage() {
  const [zones,   setZones]   = useState<ZoneSprayStatusData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRestrictedZones();
      setZones(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load restriction map.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const restrictedZones = zones.filter(
    (z) => z.sprayStatus === 'unsafe' || z.sprayStatus === 'requires_approval',
  );

  return (
    <div className="min-h-screen bg-gray-50" data-testid="visitor-spray-restrictions-page">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <PageHeader
            label="Visitor Safety"
            title="Spray Restriction Map"
            subtitle="View which greenhouse areas are currently restricted due to pesticide spraying"
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Safety notice */}
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3 text-sm text-amber-800">
          <ShieldAlert size={18} className="shrink-0 mt-0.5 text-amber-500" />
          <div>
            <span className="font-semibold">Visitor safety notice: </span>
            Do not enter any zone marked as <strong>Restricted</strong> or <strong>Caution</strong>.
            Please ask a staff member before entering any greenhouse.
          </div>
        </div>

        {/* Restricted zones highlight */}
        {!loading && restrictedZones.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-red-800 mb-3">
              🚫 Areas currently closed to entry ({restrictedZones.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {restrictedZones.map((z) => (
                <span
                  key={z.zoneId}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${STATUS_STYLE[z.sprayStatus]}`}
                >
                  {z.zoneName}
                  <span className="opacity-70">— {STATUS_LABEL[z.sprayStatus]}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* No restricted zones */}
        {!loading && restrictedZones.length === 0 && zones.length > 0 && !error && (
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 flex items-center gap-2">
            <span className="text-green-500">✅</span>
            <span>All zones are currently open for entry. No active spray restrictions.</span>
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
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-700">
                Farm Zone Safety Map
                <span className="ml-2 text-xs font-normal text-gray-400">
                  — click any zone for details
                </span>
              </h2>
            </div>
            <SprayZoneMap zones={zones} />
          </div>
        )}

        {/* Zone list */}
        {!loading && zones.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Zone Status</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Zone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Entry Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Safe Re-entry Time</th>
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
                      <td className="px-4 py-3 text-sm">
                        {z.safeToReEnterAtUtc ? (
                          <span className={new Date(z.safeToReEnterAtUtc) > new Date() ? 'text-red-600 font-medium' : 'text-green-700'}>
                            {new Date(z.safeToReEnterAtUtc).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : z.requiresApproval ? (
                          <span className="text-yellow-700 text-xs">Consult farm staff</span>
                        ) : (
                          <span className="text-green-700 text-xs font-medium">Open for entry</span>
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
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🗺️</p>
            <p className="font-medium">No zones available.</p>
          </div>
        )}

      </div>
    </div>
  );
}
