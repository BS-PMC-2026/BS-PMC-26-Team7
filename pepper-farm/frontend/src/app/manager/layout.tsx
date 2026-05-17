'use client';

import { ReactNode } from 'react';
import { ToastProvider } from '@/context/ToastContext';
import {
  AnomalyNotificationProvider,
} from '@/context/AnomalyNotificationContext';
import ManagerNavbar from '@/components/layout/ManagerNavbar';

export default function ManagerLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AnomalyNotificationProvider>
        <ManagerNavbar />
        <div style={{ paddingTop: '52px', minHeight: '100vh', backgroundColor: 'var(--background)' }}>
          {children}
        </div>
      </AnomalyNotificationProvider>
    </ToastProvider>
  );
}
