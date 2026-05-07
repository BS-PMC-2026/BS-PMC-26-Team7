'use client';

import { useState, useEffect, useCallback } from 'react';
import { ZoneSummary, getZones } from '@/services/zones';
import { getPesticides, createSprayReport } from '@/services/spray';
import { Pesticide, SafetyWarning } from '@/types/spray';
import Alert from '@/components/ui/Alert';

type ReportType = 'completed' | 'planned';

export default function SprayReportForm() {
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
        err instanceof Error ? err.message : 'Failed to load form data.',
      );
    } finally {
      setIsLoadingCatalogs(false);
    }
  }, []);

  useEffect(() => {
    loadCatalogs();
  }, [loadCatalogs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);
    setSafetyWarning(null);

    if (zoneId === '' || pesticideId === '') {
      setSubmitError('Please select a zone and a pesticide.');
      return;
    }

    if (reportType === 'planned' && !plannedAtLocal) {
      setSubmitError('Please pick a date and time for the planned spray.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setSubmitError('You must be logged in to submit a spray report.');
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
          ? 'Spray report submitted successfully.'
          : 'Spray plan saved successfully.',
      );
      setSafetyWarning(result.safetyWarning);

      // Reset only the inputs - keep the selected reportType so the worker
      // can quickly file another report of the same kind.
      setZoneId('');
      setPesticideId('');
      setPlannedAtLocal('');
      setNotes('');
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to submit report.',
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
      {submitSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
          {submitSuccess}
        </div>
      )}

      {/* Report type toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Report type
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
            Completed now
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
            Planned for later
          </button>
        </div>
      </div>

      {/* Zone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Zone <span className="text-red-500">*</span>
        </label>
        <select
          value={zoneId}
          onChange={(e) =>
            setZoneId(e.target.value === '' ? '' : Number(e.target.value))
          }
          required
          disabled={isLoadingCatalogs}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        >
          <option value="">-- Choose a zone --</option>
          {zones.map((z) => (
            <option key={z.ZoneId} value={z.ZoneId}>
              {z.ZoneCode} — {z.ZoneName}
            </option>
          ))}
        </select>
      </div>

      {/* Pesticide */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Pesticide <span className="text-red-500">*</span>
        </label>
        <select
          value={pesticideId}
          onChange={(e) =>
            setPesticideId(e.target.value === '' ? '' : Number(e.target.value))
          }
          required
          disabled={isLoadingCatalogs}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        >
          <option value="">-- Choose a pesticide --</option>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Planned date &amp; time <span className="text-red-500">*</span>
          </label>
          <input
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
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Anything the manager should know about this spray..."
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <p className="text-xs text-gray-400 mt-1">
          {notes.length} / 1000 characters
        </p>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || isLoadingCatalogs}
        className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition"
      >
        {isSubmitting
          ? 'Submitting...'
          : reportType === 'completed'
            ? 'Submit spray report'
            : 'Save spray plan'}
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
            Safety information — {safetyWarning.pesticideName}
          </h3>
          <p className="text-sm text-gray-700 mb-3">{safetyWarning.message}</p>

          {safetyWarning.verificationStatus === 'verified' && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-sm">
              <div>
                <dt className="text-gray-500">Safe to re-enter</dt>
                <dd className="font-medium text-gray-900">
                  {formatDate(safetyWarning.safeToReEnterAtUtc)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Safe to harvest</dt>
                <dd className="font-medium text-gray-900">
                  {formatDate(safetyWarning.safeToHarvestAtUtc)}
                </dd>
              </div>
              {safetyWarning.ppeRequired && (
                <div className="sm:col-span-2">
                  <dt className="text-gray-500">PPE required</dt>
                  <dd className="font-medium text-gray-900">
                    {safetyWarning.ppeRequired}
                  </dd>
                </div>
              )}
              {safetyWarning.hazardLevel && (
                <div>
                  <dt className="text-gray-500">Hazard level</dt>
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
