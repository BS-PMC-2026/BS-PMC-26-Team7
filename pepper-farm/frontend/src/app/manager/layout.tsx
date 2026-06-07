'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ToastProvider } from '@/context/ToastContext';
import { AnomalyNotificationProvider } from '@/context/AnomalyNotificationContext';
import ManagerNavbar from '@/components/layout/ManagerNavbar';
import BackButton from '@/components/ui/BackButton';

export default function ManagerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showBackButton = pathname !== '/manager';

  return (
    <ToastProvider>
      <AnomalyNotificationProvider>
        <ManagerNavbar />
        <div
          className="app-page-bg"
          style={{
            paddingTop: '64px',
            minHeight: '100vh',
          }}
        >
          {showBackButton && (
            <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
              <BackButton fallbackHref="/manager" />
            </div>
          )}
          {children}
        </div>
      </AnomalyNotificationProvider>
    </ToastProvider>
  );
}
