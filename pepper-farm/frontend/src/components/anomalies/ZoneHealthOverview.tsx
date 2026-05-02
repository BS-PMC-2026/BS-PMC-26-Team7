'use client';

import { ZoneHealth } from '@/types/anomaly';

interface Props {
  zones: ZoneHealth[];
}

const HEALTH_CONFIG = {
  high: {
    label: 'High Risk',
    cardBg: 'bg-red-50 border-red-200',
    headingColor: 'text-red-700',
    dotColor: 'bg-red-500',
    pillBg: 'bg-red-100 text-red-800 border border-red-200',
    countColor: 'text-red-400',
    emptyText: 'No high-risk zones',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  medium: {
    label: 'Medium Risk',
    cardBg: 'bg-amber-50 border-amber-200',
    headingColor: 'text-amber-700',
    dotColor: 'bg-amber-400',
    pillBg: 'bg-amber-100 text-amber-800 border border-amber-200',
    countColor: 'text-amber-400',
    emptyText: 'No medium-risk zones',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  normal: {
    label: 'Normal',
    cardBg: 'bg-white border-gray-200',
    headingColor: 'text-gray-700',
    dotColor: 'bg-green-500',
    pillBg: 'bg-green-100 text-green-800 border border-green-200',
    countColor: 'text-gray-400',
    emptyText: 'No normal zones',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
} as const;

export default function ZoneHealthOverview({ zones }: Props) {
  const grouped: Record<'normal' | 'medium' | 'high', ZoneHealth[]> = {
    high:   zones.filter((z) => z.health === 'high'),
    medium: zones.filter((z) => z.health === 'medium'),
    normal: zones.filter((z) => z.health === 'normal'),
  };

  if (zones.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 h-20 text-sm text-green-700 font-medium border border-green-200 rounded-2xl bg-green-50">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        All zones operating normally
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {(['high', 'medium', 'normal'] as const).map((level) => {
        const cfg = HEALTH_CONFIG[level];
        const list = grouped[level];

        return (
          <div key={level} className={`rounded-2xl border p-4 shadow-sm ${cfg.cardBg}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`${cfg.headingColor}`}>{cfg.icon}</div>
                <span className={`text-sm font-semibold ${cfg.headingColor}`}>{cfg.label}</span>
              </div>
              <span className={`text-xs font-bold tabular-nums ${cfg.headingColor} opacity-70`}>
                {list.length}
              </span>
            </div>

            {/* Zone pills */}
            {list.length === 0 ? (
              <p className="text-xs text-gray-400 italic">{cfg.emptyText}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {list.map((z) => (
                  <span
                    key={z.zoneId}
                    title={`${z.totalAlerts} alert${z.totalAlerts !== 1 ? 's' : ''} (${z.highAlerts} high)`}
                    className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium cursor-default transition-opacity hover:opacity-80 ${cfg.pillBg}`}
                  >
                    {z.zoneCode ?? z.zoneName}
                    {z.totalAlerts > 0 && (
                      <span className={`font-bold ${cfg.countColor}`}>{z.totalAlerts}</span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
