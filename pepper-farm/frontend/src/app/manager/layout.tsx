'use client';

import { ReactNode } from 'react';
import { ToastProvider } from '@/context/ToastContext';
import { AnomalyNotificationProvider } from '@/context/AnomalyNotificationContext';
import ManagerNavbar from '@/components/layout/ManagerNavbar';

export default function ManagerLayout({ children }: { children: ReactNode }) {
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
          {children}
        </div>
      </AnomalyNotificationProvider>
    </ToastProvider>
  );
}
