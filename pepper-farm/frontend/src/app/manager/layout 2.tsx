'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ToastProvider } from '@/context/ToastContext';
import {
  AnomalyNotificationProvider,
  useAnomalyNotification,
} from '@/context/AnomalyNotificationContext';

// ---------------------------------------------------------------------------
// Floating notification bell
// ---------------------------------------------------------------------------
function NotificationBell() {
  const { unreadCount, clearUnread } = useAnomalyNotification();
  const router = useRouter();

  const handleClick = () => {
    clearUnread();
    router.push('/manager/anomalies');
  };

  return (
    <button
      onClick={handleClick}
      title={unreadCount > 0 ? `${unreadCount} new anomaly alert${unreadCount > 1 ? 's' : ''}` : 'No new alerts'}
      className="fixed bottom-6 left-6 z-[9998] flex items-center justify-center w-12 h-12 rounded-full bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
      aria-label="Anomaly notifications"
    >
      {/* Bell SVG */}
      <svg
        className={`w-5 h-5 ${unreadCount > 0 ? 'text-red-500' : 'text-gray-400'}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>

      {/* Badge */}
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
export default function ManagerLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AnomalyNotificationProvider>
        {children}
        <NotificationBell />
      </AnomalyNotificationProvider>
    </ToastProvider>
  );
}
