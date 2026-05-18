'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getDictionary, type Dictionary, type Locale } from '@/i18n/dictionaries';

const STORAGE_KEY = 'pepper-farm-locale';

const DIR_MAP: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  he: 'rtl',
};

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
  dir: 'ltr' | 'rtl';
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved === 'en' || saved === 'he') {
      setLocaleState(saved);
    }
  }, []);

  useEffect(() => {
    const dir = DIR_MAP[locale];
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    document.body.dir = dir;
  }, [locale]);

  const setLocale = (next: Locale) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLocaleState(next);
  };

  return (
    <LanguageContext.Provider
      value={{ locale, setLocale, t: getDictionary(locale), dir: DIR_MAP[locale] }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

const DEFAULT_CONTEXT: LanguageContextValue = {
  locale: 'en',
  setLocale: () => {},
  t: getDictionary('en'),
  dir: 'ltr',
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext) ?? DEFAULT_CONTEXT;
}
