'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ToastProvider } from '@/context/ToastContext';
import { WorkerNotificationProvider } from '@/context/WorkerNotificationContext';
import WorkerNavbar from '@/components/layout/WorkerNavbar';
import BackButton from '@/components/ui/BackButton';

export default function WorkerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showBackButton = pathname !== '/worker';

  return (
    <ToastProvider>
      <WorkerNotificationProvider>
        <WorkerNavbar />
        <div
          className="app-page-bg"
          style={{
            paddingTop: '64px',
            minHeight: '100vh',
          }}
        >
          {showBackButton && (
            <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
              <BackButton fallbackHref="/worker" />
            </div>
          )}
          {children}
        </div>
      </WorkerNotificationProvider>
    </ToastProvider>
  );
}
