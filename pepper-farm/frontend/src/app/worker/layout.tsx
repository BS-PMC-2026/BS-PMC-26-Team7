'use client';

import { ReactNode } from 'react';
import { ToastProvider } from '@/context/ToastContext';
import { WorkerNotificationProvider } from '@/context/WorkerNotificationContext';
import WorkerNavbar from '@/components/layout/WorkerNavbar';

export default function WorkerLayout({ children }: { children: ReactNode }) {
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
          {children}
        </div>
      </WorkerNotificationProvider>
    </ToastProvider>
  );
}
