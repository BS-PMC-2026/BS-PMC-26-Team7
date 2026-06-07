'use client';

import { useState, useEffect } from 'react';
import { RecentAlert } from '@/types/anomaly';
import { resolveAlert } from '@/services/anomalies';
import AlertDetailsDrawer from './AlertDetailsDrawer';
import RecurringBadge from '@/components/ui/RecurringBadge';
import { useLanguage } from '@/context/LanguageContext';
import { translateEnum } from '@/i18n/dictionaries';

interface Props {
  alerts: RecentAlert[];
  onAlertResolved: (alertId: number) => void;
  onCreateTask?: (alert: RecentAlert) => void;
  initialSelectedAlert?: RecentAlert | null;
}

const SEVERITY_BADGE: Record<string, string> = {
  High:   'bg-red-100 text-red-700 border border-red-200',
  Medium: 'bg-amber-100 text-amber-700 border border-amber-200',
};

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function RecentAnomaliesTable({
  alerts,
  onAlertResolved,
  onCreateTask,
  initialSelectedAlert,
}: Props) {
  const { t } = useLanguage();
  const a = t.anomalies;

  const [selected, setSelected] = useState<RecentAlert | null>(
    initialSelectedAlert ?? null
  );
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  useEffect(() => {
    if (initialSelectedAlert) setSelected(initialSelectedAlert);
  }, [initialSelectedAlert]);

  const handleQuickResolve = async (e: React.MouseEvent, alertId: number) => {
    e.stopPropagation();
    setResolvingId(alertId);
    try {
      await resolveAlert(alertId);
      onAlertResolved(alertId);
    } finally {
      setResolvingId(null);
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border border-green-200 rounded-2xl bg-green-50">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
          <IconCheck className="w-6 h-6 text-green-600" />
        </div>
        <p className="text-sm font-semibold text-gray-700">{a.noAnomaliesFound}</p>
        <p className="text-xs text-gray-400 mt-1">{a.allReadingsNormal}</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {[a.colTime, a.colZone, a.colPlant, a.colPepper, a.colMetric, a.colActual, a.colAllowedRange, a.colSeverity, a.colStatus, ''].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {alerts.map((alert) => {
              const range =
                alert.minAllowed !== null && alert.maxAllowed !== null
                  ? `${alert.minAllowed} – ${alert.maxAllowed}`
                  : alert.maxAllowed !== null
                  ? `≤ ${alert.maxAllowed}`
                  : '—';

              return (
                <tr
                  key={alert.alertId}
                  className="hover:bg-gray-50 cursor-pointer transition-colors duration-150 group"
                  onClick={() => setSelected(alert)}
                >
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap tabular-nums" dir="ltr">
                    {new Date(alert.createdAtUtc).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-medium">
                    {alert.zoneCode ?? alert.zoneName ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {alert.plantCode ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {alert.pepperName ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800">
                    <span className="flex items-center gap-1.5 flex-wrap">
                      {alert.metricName}
                      <RecurringBadge
                        isRecurring={alert.isRecurring}
                        occurrenceCount={alert.occurrenceCount}
                      />
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{alert.actualValue}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{range}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${SEVERITY_BADGE[alert.severity] ?? 'bg-gray-100 text-gray-600'}`}>
                      {translateEnum(alert.severity, t.enums.severity)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {alert.isResolved ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-0.5 rounded-full font-medium">
                        <IconCheck className="w-3 h-3" />
                        {a.resolved}
                      </span>
                    ) : (
                      <span className="inline-block text-xs text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full font-medium">
                        {a.activeStatus}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!alert.isResolved && (
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100">
                        {onCreateTask && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onCreateTask(alert); }}
                            className="text-xs text-blue-600 border border-blue-300 px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors duration-150 cursor-pointer font-medium"
                          >
                            {a.createTask}
                          </button>
                        )}
                        <button
                          onClick={(e) => handleQuickResolve(e, alert.alertId)}
                          disabled={resolvingId === alert.alertId}
                          className="text-xs text-[#2F6F4E] border border-[#2F6F4E] px-3 py-1 rounded-lg hover:bg-[#D6EBE0] transition-colors duration-150 disabled:opacity-40 cursor-pointer font-medium"
                        >
                          {resolvingId === alert.alertId ? '…' : a.resolve}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <AlertDetailsDrawer
          alert={selected}
          onClose={() => setSelected(null)}
          onResolved={(id) => {
            onAlertResolved(id);
            setSelected(null);
          }}
        />
      )}
    </>
  );
}
