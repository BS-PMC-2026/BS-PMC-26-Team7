'use client';

import { useLanguage } from '@/context/LanguageContext';
import type { Locale } from '@/i18n/dictionaries';

const LOCALES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'he', label: 'HE' },
];

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-white p-0.5 shadow-sm">
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          aria-label={`Switch to ${label}`}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            locale === code
              ? 'bg-green-700 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
