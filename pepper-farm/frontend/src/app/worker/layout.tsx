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
              style={{
                paddingTop: "52px",
                minHeight: "100vh",
                backgroundColor: "var(--background)",
              }}
            >
              {children}
            </div>

            <div className="fixed top-4 right-4 z-[9999]">
              <LanguageSwitcher />
            </div>
          </WorkerNotificationProvider>
        </ToastProvider>
      );
}
