'use client';

import { ReactNode } from 'react';
import { ToastProvider } from '@/context/ToastContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function WorkerLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <div className="fixed top-4 right-4 z-[9999]">
        <LanguageSwitcher />
      </div>
    </ToastProvider>
  );
}
