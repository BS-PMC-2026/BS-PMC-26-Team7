'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useAnomalyNotification } from '@/context/AnomalyNotificationContext';

export default function NotificationBell() {
  const { unreadCount, clearUnread } = useAnomalyNotification();

  return (
    <Link
      href="/manager/anomalies"
      onClick={clearUnread}
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-[#2F6F4E] text-white shadow-lg hover:bg-[#245a3e] transition-colors"
      aria-label="Notifications"
    >
      <Bell size={20} />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
