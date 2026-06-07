'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, LogOut, ShoppingCart, X } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {
  getMyNotifications,
  getUnreadCount,
  markAllNotificationsRead,
} from '@/services/notificationsService';
import type { AppNotification } from '@/services/notificationsService';
import { getCart } from '@/services/cartService';

/* Minimal visitor header — shows notification bell for in-app messages (Fix D). */

export default function VisitorLayout({ children }: { children: ReactNode }) {
  const { t, locale } = useLanguage();
  const router = useRouter();

  const [bellOpen,    setBellOpen]    = useState(false);
  const [unread,      setUnread]      = useState(0);
  const [notifs,      setNotifs]      = useState<AppNotification[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [cartCount,   setCartCount]   = useState(0);

  useEffect(() => {
    getCart().then(c => setCartCount(c.items.reduce((s, i) => s + i.quantity, 0))).catch(() => {});
  }, []);

  // Poll unread count every 60 s
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const { unreadCount } = await getUnreadCount();
        if (!cancelled) setUnread(unreadCount);
      } catch { /* Notifications table not yet created — ignore */ }
    };
    poll();
    const id = setInterval(poll, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  async function openBell() {
    setBellOpen(true);
    setLoading(true);
    try {
      const list = await getMyNotifications();
      setNotifs(list);
      setUnread(list.filter((n) => !n.isRead).length);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function handleMarkAll() {
    try {
      await markAllNotificationsRead();
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
    } catch { /* ignore */ }
  }

  function handleLogout() {
    localStorage.removeItem('token');
    router.push('/login');
  }

  return (
    <>
      {/* Slim visitor header */}
      <header className="fixed top-0 left-0 right-0 z-[9999] bg-white/90 backdrop-blur-md shadow-sm border-b border-[var(--color-border)] h-12 flex items-center px-4 gap-3">
        <Link href="/visitor" className="font-semibold text-green-700 text-sm no-underline">
          🌶️ {locale === 'he' ? 'הדינרים' : 'Hadinerim'}
        </Link>
        <div className="flex-1" />

        {/* Language switcher — lets visitors/customers toggle EN/HE after login too */}
        <LanguageSwitcher />

        {/* Cart icon with item count */}
        <Link href="/cart" className="relative flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer text-gray-500 hover:bg-gray-100 transition" data-testid="visitor-cart-icon">
          <ShoppingCart size={15} />
          {cartCount > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-green-600 text-white text-[9px] font-bold flex items-center justify-center" data-testid="cart-badge">
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          )}
        </Link>

        {/* In-app notification bell (Fix D — visitor gets one bell) */}
        <div className="relative">
          <button
            onClick={() => bellOpen ? setBellOpen(false) : openBell()}
            aria-label={t.appNotifications.notificationBell}
            className={`relative flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer transition-colors ${
              unread > 0 ? 'text-red-500 hover:bg-red-50' : 'text-gray-400 hover:bg-gray-100'
            }`}
            data-testid="visitor-notif-bell"
          >
            <Bell size={15} />
            {unread > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center" data-testid="visitor-notif-count">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute top-[calc(100%+8px)] right-0 w-[300px] rounded-xl border border-[var(--color-border)] bg-white shadow-xl overflow-hidden z-[100]">
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--color-border)]">
                <span className="text-sm font-semibold">{t.appNotifications.appNotifications}</span>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button onClick={handleMarkAll} className="text-[10px] text-gray-400 hover:text-green-600">
                      {t.appNotifications.markAllAsRead}
                    </button>
                  )}
                  <button onClick={() => setBellOpen(false)} className="text-gray-400 hover:text-gray-700">
                    <X size={13} />
                  </button>
                </div>
              </div>
              <div className="max-h-[280px] overflow-y-auto">
                {loading && <p className="px-4 py-3 text-xs text-gray-400">{t.common.loading}</p>}
                {!loading && notifs.length === 0 && (
                  <p className="px-4 py-3 text-xs text-gray-400 italic">{t.appNotifications.noNotifications}</p>
                )}
                {notifs.map((n) => (
                  <div key={n.notificationId} className={`px-3.5 py-2.5 border-b border-[var(--color-border)] last:border-0 ${!n.isRead ? 'bg-green-50/50' : ''}`}>
                    <p className="text-xs font-semibold text-gray-800">{n.title}</p>
                    {n.message && <p className="text-[11px] text-gray-500 mt-0.5">{n.message}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* My Orders */}
        <Link href="/profile/orders" className="text-[11px] text-gray-500 hover:text-[var(--color-primary)] no-underline transition whitespace-nowrap">
          My Orders
        </Link>

        {/* Logout */}
        <button onClick={handleLogout} aria-label="Sign out" className="text-gray-400 hover:text-red-500 transition">
          <LogOut size={14} />
        </button>
      </header>

      {/* Page content pushed below header */}
      <div className="app-page-bg" style={{ paddingTop: '48px', minHeight: '100vh' }}>
        {children}
      </div>
    </>
  );
}
