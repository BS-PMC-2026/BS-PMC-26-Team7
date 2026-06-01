'use client';

import { useEffect, useState } from 'react';
import { getMyConsent, updateMyConsent } from '@/services/emailConsentService';
import type { ConsentStatus } from '@/services/emailConsentService';
import { useLanguage } from '@/context/LanguageContext';

export default function ProfilePage() {
  const { t } = useLanguage();
  const c = t.consent;

  const [status,  setStatus]  = useState<ConsentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');
  const [err,     setErr]     = useState('');

  useEffect(() => {
    getMyConsent()
      .then(setStatus)
      .catch(() => setErr('Failed to load subscription status.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(value: boolean) {
    if (!status) return;
    setSaving(true);
    setMsg(''); setErr('');
    try {
      const updated = await updateMyConsent(value);
      setStatus(updated);
      setMsg(c.subscriptionUpdated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-lg mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">{c.emailSubscription}</h1>

      {loading && <p className="text-gray-500">{t.common.loading}</p>}

      {!loading && err && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-red-600 text-sm mb-4"
             data-testid="consent-error">{err}</div>
      )}

      {!loading && status && (
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{c.receiveNewsletterEmails}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.emailConsent ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {status.emailConsent ? c.subscribed : c.unsubscribed}
            </span>
          </div>

          <label className="flex items-center gap-3 cursor-pointer" data-testid="consent-toggle-label">
            <input
              type="checkbox"
              checked={status.emailConsent}
              onChange={(e) => handleToggle(e.target.checked)}
              disabled={saving}
              className="accent-green-600 w-4 h-4"
              data-testid="consent-toggle"
            />
            <span className="text-sm text-gray-700">{c.receiveNewsletterEmails}</span>
          </label>

          {msg && (
            <p className="text-sm text-green-700" data-testid="consent-success">{msg}</p>
          )}

          {status.emailUnsubscribedAtUtc && !status.emailConsent && (
            <p className="text-xs text-gray-400">
              {c.unsubscribed}: {new Date(status.emailUnsubscribedAtUtc + 'Z').toLocaleDateString()}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
