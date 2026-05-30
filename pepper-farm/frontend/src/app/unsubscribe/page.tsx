'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { unsubscribeByToken } from '@/services/emailConsentService';
import { useLanguage } from '@/context/LanguageContext';

function UnsubscribeContent() {
  const params = useSearchParams();
  const { t } = useLanguage();
  const c = t.consent;

  const [state, setState] = useState<'loading' | 'success' | 'already' | 'invalid'>('loading');
  const [msg,   setMsg]   = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setState('invalid');
      setMsg(c.invalidUnsubscribeLink);
      return;
    }

    unsubscribeByToken(token)
      .then((res) => {
        if (res.success) {
          const alreadyDone = res.message.toLowerCase().includes('already');
          setState(alreadyDone ? 'already' : 'success');
          setMsg(res.message);
        } else {
          setState('invalid');
          setMsg(res.message || c.invalidUnsubscribeLink);
        }
      })
      .catch(() => {
        setState('invalid');
        setMsg(c.invalidUnsubscribeLink);
      });
  }, [params, c.invalidUnsubscribeLink]);

  const icons: Record<string, string> = {
    loading: '⏳',
    success: '✅',
    already: 'ℹ️',
    invalid: '❌',
  };

  const titles: Record<string, string> = {
    loading: c.processingUnsubscribe,
    success: c.unsubscribeSuccess,
    already: c.alreadyUnsubscribed,
    invalid: c.invalidUnsubscribeLink,
  };

  return (
    <div className="bg-white rounded-xl shadow p-8 w-full max-w-sm text-center" data-testid="unsubscribe-result">
      <div className="text-4xl mb-4">{icons[state]}</div>
      <h2 className="text-xl font-bold text-gray-800 mb-3" data-testid="unsubscribe-title">
        {titles[state]}
      </h2>
      {state !== 'loading' && (
        <p className="text-sm text-gray-500 mb-6" data-testid="unsubscribe-message">{msg}</p>
      )}
      {(state === 'success' || state === 'already') && (
        <a href="/" className="text-green-600 hover:underline text-sm">
          Return to Pepper Farm
        </a>
      )}
    </div>
  );
}

export default function UnsubscribePage() {
  const { t } = useLanguage();
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-green-700">🌶️ PepperFarm</h1>
        <p className="text-sm text-gray-500 mt-1">{t.consent.unsubscribeFromNewsletter}</p>
      </div>
      <Suspense fallback={<p className="text-gray-400">{t.common.loading}</p>}>
        <UnsubscribeContent />
      </Suspense>
    </main>
  );
}
