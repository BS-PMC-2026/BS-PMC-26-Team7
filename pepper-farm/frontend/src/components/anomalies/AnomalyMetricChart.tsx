'use client';

import { RecentAlert } from '@/types/anomaly';

interface Props {
  alerts: RecentAlert[];
}

const METRICS = ['Temperature', 'Humidity', 'Leak', 'Radiation'] as const;

function IconThermometer({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" />
    </svg>
  );
}

function IconDroplets({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z" />
      <path d="M12.56 6.6A10.97 10.97 0 0014 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 01-11.91 4.97" />
    </svg>
  );
}

function IconWaves({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </svg>
  );
}

function IconSun({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

const METRIC_CONFIG: Record<string, { Icon: React.FC<{ className?: string }>; iconBg: string; iconColor: string }> = {
  Temperature: { Icon: IconThermometer, iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
  Humidity:    { Icon: IconDroplets,    iconBg: 'bg-blue-100',   iconColor: 'text-blue-600'   },
  Leak:        { Icon: IconWaves,       iconBg: 'bg-cyan-100',   iconColor: 'text-cyan-600'   },
  Radiation:   { Icon: IconSun,         iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600' },
};

export default function AnomalyMetricChart({ alerts }: Props) {
  const counts = METRICS.map((metric) => {
    const all = alerts.filter((a) => a.metricName === metric);
    const high = all.filter((a) => a.severity === 'High').length;
    const medium = all.length - high;
    return { metric, total: all.length, high, medium };
  });

  const maxTotal = Math.max(...counts.map((c) => c.total), 1);

  return (
    <div className="space-y-5">
      {counts.map(({ metric, total, high, medium }) => {
        const cfg = METRIC_CONFIG[metric];
        const highPct = (high / maxTotal) * 100;
        const medPct = (medium / maxTotal) * 100;

        return (
          <div key={metric} className="group">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
                <cfg.Icon className={`w-3.5 h-3.5 ${cfg.iconColor}`} />
              </div>
              <span className="text-sm font-medium text-gray-700 flex-1">{metric}</span>
              <span className="text-xs font-semibold text-gray-500 tabular-nums">
                {total} <span className="font-normal text-gray-400">alerts</span>
              </span>
            </div>

            {/* Bar track */}
            <div className="ml-10 flex h-2.5 rounded-full overflow-hidden bg-gray-100">
              {high > 0 && (
                <div
                  className="bg-red-500 transition-all duration-700 ease-out"
                  style={{ width: `${highPct}%` }}
                />
              )}
              {medium > 0 && (
                <div
                  className="bg-amber-400 transition-all duration-700 ease-out"
                  style={{ width: `${medPct}%` }}
                />
              )}
            </div>

            {/* Inline counts */}
            {total > 0 && (
              <div className="ml-10 flex gap-3 mt-1">
                {high > 0 && (
                  <span className="text-[11px] text-red-600 font-medium">{high} high</span>
                )}
                {medium > 0 && (
                  <span className="text-[11px] text-amber-600 font-medium">{medium} medium</span>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex gap-5 pt-2 border-t border-gray-100 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-2.5 rounded-sm bg-red-500" />
          High
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-2.5 rounded-sm bg-amber-400" />
          Medium
        </span>
      </div>
    </div>
  );
}
