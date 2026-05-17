'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { RecentAlert } from '@/types/anomaly';
import { resolveAlert } from '@/services/anomalies';
import { useLanguage } from '@/context/LanguageContext';

interface Props {
  alert: RecentAlert;
  onClose: () => void;
  onResolved: (alertId: number) => void;
}

const SEVERITY_STYLES: Record<string, { pill: string; icon: string }> = {
  High:   { pill: 'bg-red-100 text-red-700 border border-red-200',    icon: 'text-red-500'    },
  Medium: { pill: 'bg-amber-100 text-amber-700 border border-amber-200', icon: 'text-amber-500' },
};

function IconAlert({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function AlertDetailsDrawer({ alert, onClose, onResolved }: Props) {
  const { t } = useLanguage();
  const a = t.anomalies;
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(alert.isResolved);

  const handleResolve = async () => {
    setResolving(true);
    setResolveError(null);
    try {
      await resolveAlert(alert.alertId);
      setResolved(true);
      onResolved(alert.alertId);
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : a.failedToResolve);
    } finally {
      setResolving(false);
    }
  };

  const allowedRange =
    alert.minAllowed !== null && alert.maxAllowed !== null
      ? `${alert.minAllowed} – ${alert.maxAllowed}`
      : alert.maxAllowed !== null
      ? `≤ ${alert.maxAllowed}`
      : '—';

  const sev = SEVERITY_STYLES[alert.severity] ?? { pill: 'bg-gray-100 text-gray-600 border border-gray-200', icon: 'text-gray-400' };

  return (
    <Modal onClose={onClose}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${alert.severity === 'High' ? 'bg-red-100' : 'bg-amber-100'}`}>
          <IconAlert className={`w-5 h-5 ${sev.icon}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-gray-900">{a.alertDetails}</h2>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sev.pill}`}>
              {alert.severity}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5" dir="ltr">
            {a.alertHashId}{alert.alertId} · {a.readingHashId}{alert.readingId}
          </p>
        </div>
      </div>

      {/* Status banner if resolved */}
      {resolved && (
        <div className="mb-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
          <IconCheck className="w-4 h-4 text-green-600 shrink-0" />
          {a.alertResolved}
        </div>
      )}

      {/* Details */}
      <div className="rounded-xl border border-gray-200 overflow-hidden mb-4">
        {[
          { label: a.colMetricName,      value: alert.metricName },
          { label: a.colActualValue,     value: String(alert.actualValue), ltr: true },
          { label: a.colAllowedRangeFull,value: allowedRange, ltr: true },
          { label: a.colZoneName,        value: alert.zoneName ?? '—' },
          { label: a.colPlantCode,       value: alert.plantCode ?? '—' },
          { label: a.colPepperVariety,   value: alert.pepperName ?? '—' },
          { label: a.colTime,            value: new Date(alert.createdAtUtc).toLocaleString(), ltr: true },
          ...(alert.resolvedAtUtc
            ? [{ label: a.colResolvedAt, value: new Date(alert.resolvedAtUtc).toLocaleString(), ltr: true }]
            : []),
        ].map((row, i) => (
          <div
            key={row.label}
            className={`flex items-center justify-between px-4 py-2.5 text-sm ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
          >
            <span className="text-gray-500 font-medium">{row.label}</span>
            <span className="text-gray-900 font-semibold text-right" dir={row.ltr ? 'ltr' : undefined}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Message */}
      <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600 leading-relaxed">
        {alert.message}
      </div>

      {/* Error */}
      {resolveError && (
        <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          {resolveError}
        </div>
      )}

      {/* Actions */}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {a.close}
        </Button>
        {!resolved && (
          <Button variant="danger" onClick={handleResolve} disabled={resolving}>
            {resolving ? a.resolving : a.markAsResolved}
          </Button>
        )}
      </div>
    </Modal>
  );
}
