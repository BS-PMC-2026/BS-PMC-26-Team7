'use client';

import { AnomalySummary } from '@/types/anomaly';
import { useLanguage } from '@/context/LanguageContext';

interface Props {
  summary: AnomalySummary;
}

function timeAgo(isoString: string, locale: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (locale === 'he') {
    if (diff < 60)    return `לפני ${diff}ש`;
    if (diff < 3600)  return `לפני ${Math.floor(diff / 60)}ד`;
    if (diff < 86400) return `לפני ${Math.floor(diff / 3600)}ש'`;
    return `לפני ${Math.floor(diff / 86400)}י`;
  }
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function IconAlert({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconFlame({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 3z" />
    </svg>
  );
}

function IconMap({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

function IconSignal({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="20" x2="2" y2="14" />
      <line x1="7" y1="20" x2="7" y2="9" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="17" y1="20" x2="17" y2="9" />
      <line x1="22" y1="20" x2="22" y2="14" />
    </svg>
  );
}

export default function AnomalySummaryCards({ summary }: Props) {
  const { t, locale } = useLanguage();
  const a = t.anomalies;

  const cards = [
    {
      label: a.activeAnomalies,
      value: summary.activeAlerts,
      Icon: IconAlert,
      active: summary.activeAlerts > 0,
      activeClasses: {
        wrapper: 'border-orange-200 bg-gradient-to-br from-orange-50 to-white',
        icon: 'bg-orange-100 text-orange-600',
        value: 'text-orange-700',
        badge: 'bg-orange-100 text-orange-700',
        badgeText: a.attention,
      },
      clearClasses: {
        wrapper: 'border-gray-200 bg-white',
        icon: 'bg-gray-100 text-gray-500',
        value: 'text-gray-900',
        badge: 'bg-green-100 text-green-700',
        badgeText: a.allClear,
      },
    },
    {
      label: a.highSeverity,
      value: summary.highSeverity,
      Icon: IconFlame,
      active: summary.highSeverity > 0,
      activeClasses: {
        wrapper: 'border-red-200 bg-gradient-to-br from-red-50 to-white',
        icon: 'bg-red-100 text-red-600',
        value: 'text-red-700',
        badge: 'bg-red-100 text-red-700',
        badgeText: a.critical,
      },
      clearClasses: {
        wrapper: 'border-gray-200 bg-white',
        icon: 'bg-gray-100 text-gray-500',
        value: 'text-gray-900',
        badge: 'bg-green-100 text-green-700',
        badgeText: a.none,
      },
    },
    {
      label: a.affectedZones,
      value: summary.affectedZones,
      Icon: IconMap,
      active: summary.affectedZones > 0,
      activeClasses: {
        wrapper: 'border-amber-200 bg-gradient-to-br from-amber-50 to-white',
        icon: 'bg-amber-100 text-amber-600',
        value: 'text-amber-700',
        badge: 'bg-amber-100 text-amber-700',
        badgeText: a.impacted,
      },
      clearClasses: {
        wrapper: 'border-gray-200 bg-white',
        icon: 'bg-gray-100 text-gray-500',
        value: 'text-gray-900',
        badge: 'bg-green-100 text-green-700',
        badgeText: a.healthy,
      },
    },
    {
      label: a.latestReading,
      value: summary.latestReadingUtc ? timeAgo(summary.latestReadingUtc, locale) : '—',
      Icon: IconSignal,
      active: false,
      activeClasses: {
        wrapper: 'border-gray-200 bg-white',
        icon: 'bg-[#D6EBE0] text-[#2F6F4E]',
        value: 'text-gray-900',
        badge: 'bg-gray-100 text-gray-500',
        badgeText: '',
      },
      clearClasses: {
        wrapper: 'border-gray-200 bg-white',
        icon: 'bg-[#D6EBE0] text-[#2F6F4E]',
        value: 'text-gray-900',
        badge: 'bg-gray-100 text-gray-500',
        badgeText: summary.latestReadingUtc
          ? new Date(summary.latestReadingUtc).toLocaleTimeString()
          : a.noDataTime,
      },
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const c = card.active ? card.activeClasses : card.clearClasses;
        return (
          <div
            key={card.label}
            className={`rounded-2xl border p-5 shadow-sm transition-shadow hover:shadow-md ${c.wrapper}`}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider leading-none">
                {card.label}
              </p>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.icon}`}>
                <card.Icon className="w-4 h-4" />
              </div>
            </div>
            <p className={`text-3xl font-bold tracking-tight ${c.value}`} dir="ltr">
              {card.value}
            </p>
            {c.badgeText && (
              <span className={`inline-block mt-2 text-[11px] font-medium px-2 py-0.5 rounded-full ${c.badge}`}>
                {c.badgeText}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
