'use client';

import { useState, useEffect, useCallback } from 'react';
import { ZoneSummary, getZones } from '@/services/zones';
import { getPesticides, createSprayReport } from '@/services/spray';
import { Pesticide, SafetyWarning } from '@/types/spray';
import Alert from '@/components/ui/Alert';
import { useLanguage } from '@/context/LanguageContext';

type ReportType = 'completed' | 'planned';

interface SprayReportFormProps {
  initialZoneCode?: string | null;
  onSubmitted?: () => void;
}

export default function SprayReportForm({ initialZoneCode = null, onSubmitted }: SprayReportFormProps) {
  const { t } = useLanguage();
  const sp = t.spray;

  // Catalog data loaded from the backend.
  const [zones, setZones] = useState<ZoneSummary[]>([]);
  const [pesticides, setPesticides] = useState<Pesticide[]>([]);
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(true);

  // Form state.
  const [zoneId, setZoneId] = useState<number | ''>('');
  const [pesticideId, setPesticideId] = useState<number | ''>('');
  const [reportType, setReportType] = useState<ReportType>('completed');
  const [plannedAtLocal, setPlannedAtLocal] = useState('');
  const [notes, setNotes] = useState('');

  // Submission state.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [safetyWarning, setSafetyWarning] = useState<SafetyWarning | null>(null);

  // Load zones + pesticides once when the form mounts.
  const loadCatalogs = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setIsLoadingCatalogs(true);
    try {
      const [zonesData, pesticidesData] = await Promise.all([
        getZones(),
        getPesticides(token),
      ]);
      // Only show zones that make sense for spraying (greenhouses + nurseries
      // + germination rooms). Visitor center, factory, parking, sheds are
      // excluded - they are not sprayable areas.
      const sprayableZones = zonesData.filter((z) => {
        const code = z.ZoneCode ?? '';
        return (
          code.startsWith('GH-') ||
          code.startsWith('GERM-') ||
          code === 'NURSERY'
        );
      });
      setZones(sprayableZones);
      setPesticides(pesticidesData);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : sp.failedToLoadFormData,
      );
    } finally {
      setIsLoadingCatalogs(false);
    }
  }, [sp.failedToLoadFormData]);

  useEffect(() => {
    loadCatalogs();
  }, [loadCatalogs]);

  useEffect(() => {
    if (!initialZoneCode || zones.length === 0) return;
    const selectedZone = zones.find((z) => z.ZoneCode === initialZoneCode);
    if (selectedZone) setZoneId(selectedZone.ZoneId);
  }, [initialZoneCode, zones]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);
    setSafetyWarning(null);

    if (zoneId === '' || pesticideId === '') {
      setSubmitError(sp.selectZoneAndPesticide);
      return;
    }

    if (reportType === 'planned' && !plannedAtLocal) {
      setSubmitError(sp.pickPlannedDate);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setSubmitError(sp.loginRequired);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createSprayReport(
        {
          zoneId: Number(zoneId),
          pesticideId: Number(pesticideId),
          reportType,
          // Convert the datetime-local value to an ISO string for the API.
          plannedAtUtc:
            reportType === 'planned'
              ? new Date(plannedAtLocal).toISOString()
              : undefined,
          notes: notes.trim() || undefined,
        },
        token,
      );

      setSubmitSuccess(
        reportType === 'completed'
          ? sp.sprayReportSubmitted
          : sp.sprayPlanSaved,
      );
      setSafetyWarning(result.safetyWarning);
      onSubmitted?.();

      // Reset only the inputs - keep the selected reportType so the worker
      // can quickly file another report of the same kind.
      setZoneId('');
      setPesticideId('');
      setPlannedAtLocal('');
      setNotes('');
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : sp.failedToSubmitReport,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pretty-print one of the safety dates returned by the backend.
  const formatDate = (iso: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {submitError && <Alert>{submitError}</Alert>}
      {isLoadingCatalogs && (
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4 animate-pulse" data-testid="spray-report-loading">
          <p className="text-sm font-medium text-[var(--color-muted-foreground)] mb-3">{sp.loadingFormData}</p>
          <div className="space-y-3">
            <div className="h-9 bg-[var(--color-muted)] rounded-lg" />
            <div className="h-9 bg-[var(--color-muted)] rounded-lg" />
            <div className="h-20 bg-[var(--color-muted)] rounded-lg" />
          </div>
        </div>
      )}
      {submitSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
          {submitSuccess}
        </div>
      )}

      {/* Report type toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {sp.reportType}
        </label>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setReportType('completed')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              reportType === 'completed'
                ? 'bg-green-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {sp.completedNow}
          </button>
          <button
            type="button"
            onClick={() => setReportType('planned')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              reportType === 'planned'
                ? 'bg-green-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {sp.plannedForLater}
          </button>
        </div>
      </div>

      {/* Zone */}
      <div>
        <label htmlFor="spray-zone-select" className="block text-sm font-medium text-gray-700 mb-1">
          {sp.zone} <span className="text-red-500">*</span>
        </label>
        <select
          id="spray-zone-select"
          value={zoneId}
          onChange={(e) =>
            setZoneId(e.target.value === '' ? '' : Number(e.target.value))
          }
          required
          disabled={isLoadingCatalogs}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        >
          <option value="">{sp.chooseZone}</option>
          {zones.map((z) => (
            <option key={z.ZoneId} value={z.ZoneId}>
              {z.ZoneCode} — {z.ZoneName}
            </option>
          ))}
        </select>
      </div>

      {/* Pesticide */}
      <div>
        <label htmlFor="spray-pesticide-select" className="block text-sm font-medium text-gray-700 mb-1">
          {sp.pesticide} <span className="text-red-500">*</span>
        </label>
        <select
          id="spray-pesticide-select"
          value={pesticideId}
          onChange={(e) =>
            setPesticideId(e.target.value === '' ? '' : Number(e.target.value))
          }
          required
          disabled={isLoadingCatalogs}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        >
          <option value="">{sp.choosePesticide}</option>
          {pesticides.map((p) => (
            <option key={p.PesticideId} value={p.PesticideId}>
              {p.Name}
              {p.ActiveIngredient ? ` (${p.ActiveIngredient})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Planned-at — only for 'planned' reports */}
      {reportType === 'planned' && (
        <div>
          <label htmlFor="spray-planned-at-input" className="block text-sm font-medium text-gray-700 mb-1">
            {sp.plannedDateTime} <span className="text-red-500">*</span>
          </label>
          <input
            id="spray-planned-at-input"
            type="datetime-local"
            value={plannedAtLocal}
            onChange={(e) => setPlannedAtLocal(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
      )}

      {/* Notes */}
      <div>
        <label htmlFor="spray-notes-input" className="block text-sm font-medium text-gray-700 mb-1">
          {sp.notesOptional}
        </label>
        <textarea
          id="spray-notes-input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder={sp.notesPlaceholder}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <p className="text-xs text-gray-400 mt-1">
          {notes.length} / 1000 {sp.characters}
        </p>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || isLoadingCatalogs}
        className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition"
      >
        {isSubmitting
          ? sp.submitting
          : reportType === 'completed'
            ? sp.submitSprayReport
            : sp.saveSprayPlan}
      </button>

      {/* Safety information block - shown after a successful submission */}
      {safetyWarning && (
        <div
          className={`mt-6 rounded-xl border p-4 ${
            safetyWarning.verificationStatus === 'verified'
              ? 'bg-green-50 border-green-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}
        >
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            {sp.safetyInformation} - {safetyWarning.pesticideName}
          </h3>
          <p className="text-sm text-gray-700 mb-3">{safetyWarning.message}</p>

          {safetyWarning.verificationStatus === 'verified' && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-sm">
              <div>
                <dt className="text-gray-500">{sp.safeReentry}</dt>
                <dd className="font-medium text-gray-900">
                  {formatDate(safetyWarning.safeToReEnterAtUtc)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">{sp.safeToHarvest}</dt>
                <dd className="font-medium text-gray-900">
                  {formatDate(safetyWarning.safeToHarvestAtUtc)}
                </dd>
              </div>
              {safetyWarning.ppeRequired && (
                <div className="sm:col-span-2">
                  <dt className="text-gray-500">{sp.ppeRequired}</dt>
                  <dd className="font-medium text-gray-900">
                    {safetyWarning.ppeRequired}
                  </dd>
                </div>
              )}
              {safetyWarning.hazardLevel && (
                <div>
                  <dt className="text-gray-500">{sp.hazardLevel}</dt>
                  <dd className="font-medium text-gray-900 capitalize">
                    {safetyWarning.hazardLevel}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>
      )}
    </form>
  );
}
