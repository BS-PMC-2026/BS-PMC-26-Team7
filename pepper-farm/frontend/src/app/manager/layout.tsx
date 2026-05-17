'use client';

import { ReactNode } from 'react';

import { ToastProvider } from '@/context/ToastContext';
import { AnomalyNotificationProvider } from '@/context/AnomalyNotificationContext';

import ManagerNavbar from '@/components/layout/ManagerNavbar';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import NotificationBell from '@/components/NotificationBell';

export default function ManagerLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AnomalyNotificationProvider>
        <ManagerNavbar />

        <div
          style={{
            paddingTop: '52px',
            minHeight: '100vh',
            backgroundColor: 'var(--background)',
          }}
        >
          {children}
        </div>

        <NotificationBell />

        <div className="fixed top-4 right-4 z-[9999]">
          <LanguageSwitcher />
        </div>
      </AnomalyNotificationProvider>
    </ToastProvider>
  );
}