'use client';

import { useState, useEffect } from 'react';
import { getRecurrenceConfig, updateRecurrenceConfig, RecurrenceConfig } from '@/services/anomalies';

interface RecurrenceConfigPanelProps {
  onClose: () => void;
}

const MIN_COUNT_OPTIONS = [2, 3, 5, 10];
const WINDOW_OPTIONS = [
  { label: '1 day',   hours: 24 },
  { label: '3 days',  hours: 72 },
  { label: '7 days',  hours: 168 },
  { label: '14 days', hours: 336 },
  { label: '30 days', hours: 720 },
];

export default function RecurrenceConfigPanel({ onClose }: RecurrenceConfigPanelProps) {
  const [config, setConfig] = useState<RecurrenceConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRecurrenceConfig()
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);

  async function handleMinCountChange(value: number) {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateRecurrenceConfig({ minCount: value });
      setConfig(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleWindowChange(hours: number) {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateRecurrenceConfig({ windowHours: hours });
      setConfig(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Recurrence Thresholds</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {!config ? (
          <p className="text-sm text-gray-400 text-center py-4">Loading…</p>
        ) : (
          <div className="space-y-5">
            {/* Min count */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">
                Minimum occurrences to flag as recurring
              </label>
              <div className="flex gap-2">
                {MIN_COUNT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => handleMinCountChange(n)}
                    disabled={saving}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors cursor-pointer disabled:opacity-50 ${
                      config.minCount === n
                        ? 'bg-amber-100 text-amber-700 border-amber-300'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {n}×
                  </button>
                ))}
              </div>
            </div>

            {/* Window */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">
                Time window for counting occurrences
              </label>
              <div className="flex flex-col gap-1.5">
                {WINDOW_OPTIONS.map(({ label, hours }) => (
                  <button
                    key={hours}
                    onClick={() => handleWindowChange(hours)}
                    disabled={saving}
                    className={`w-full py-2 px-3 rounded-lg text-sm font-medium text-left border transition-colors cursor-pointer disabled:opacity-50 ${
                      config.windowHours === hours
                        ? 'bg-amber-100 text-amber-700 border-amber-300'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            {saving && (
              <p className="text-xs text-gray-400 text-center">Saving…</p>
            )}

            <p className="text-xs text-gray-400">
              Changes take effect immediately on new anomaly detections.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
