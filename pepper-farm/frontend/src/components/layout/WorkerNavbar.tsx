'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  ShoppingBag,
  ShoppingCart,
  Leaf,
  LogOut,
  Bell,
  X,
  ClipboardCheck,
} from 'lucide-react';
import { useWorkerNotification } from '@/context/WorkerNotificationContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLanguage } from '@/context/LanguageContext';
import { getCart } from '@/services/cartService';

/* -------------------------------------------------------------------------- */
/* Types                                                                        */
/* -------------------------------------------------------------------------- */

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-500',
  high:     'text-amber-500',
  medium:   'text-blue-500',
  low:      'text-[var(--color-muted-foreground)]',
};

/* -------------------------------------------------------------------------- */
/* Component                                                                    */
/* -------------------------------------------------------------------------- */

export default function WorkerNavbar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { t, dir } = useLanguage();
  const {
    unreadCount, clearUnread, newTasks, activeTasks,
    appNotifs, appUnreadCount, loadAppNotifs, markAllAppNotifsRead,
  } = useWorkerNotification();

  // US41: cart item count badge
  const [cartCount, setCartCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const loadCart = async () => {
      try {
        const cart = await getCart();
        if (!cancelled) setCartCount(cart.items.reduce((s, i) => s + i.quantity, 0));
      } catch { /* ignore — worker may not have items */ }
    };
    loadCart();
    // Re-poll cart count every 30 s so badge stays accurate
    const id = setInterval(loadCart, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [pathname]);   // refresh whenever the route changes (e.g. after checkout)

  // US40: in-app notifications — now managed via WorkerNotificationContext (shared with dashboard)
  const [appNotifLoading, setAppNotifLoading] = useState(false);

  async function openAppNotifs() {
    setAppNotifLoading(true);
    try {
      await loadAppNotifs();
    } catch { /* ignore */ }
    finally { setAppNotifLoading(false); }
  }

  async function handleMarkAllRead() {
    await markAllAppNotifsRead();
  }

  const [bellOpen,  setBellOpen]  = useState(false);
  const [scrolled,  setScrolled]  = useState(false);
  const [notificationTab, setNotificationTab] = useState<'active' | 'history'>('active');
  const [dismissedTaskIds, setDismissedTaskIds] = useState<number[]>([]);

  const navRef        = useRef<HTMLElement>(null);
  const dismissedTaskIdSet = new Set(dismissedTaskIds);
  const visibleNewTasks = newTasks.filter((task) => !dismissedTaskIdSet.has(task.id));
  const visibleActiveTasks = activeTasks.filter((task) => !dismissedTaskIdSet.has(task.id));
  const popupTasks = visibleNewTasks.length > 0 ? visibleNewTasks.slice(0, 6) : visibleActiveTasks.slice(0, 6);
  const historyTasks = [...newTasks, ...activeTasks].filter((task, index, all) =>
    dismissedTaskIdSet.has(task.id) && all.findIndex((item) => item.id === task.id) === index,
  );
  const visibleUnreadCount  = Math.max(0, unreadCount - newTasks.filter((task) => dismissedTaskIdSet.has(task.id)).length);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('pepper-farm-worker-dismissed-notifications');
      if (raw) setDismissedTaskIds(JSON.parse(raw));
    } catch {
      setDismissedTaskIds([]);
    }
  }, []);

  const persistDismissed = (ids: number[]) => {
    setDismissedTaskIds(ids);
    localStorage.setItem('pepper-farm-worker-dismissed-notifications', JSON.stringify(ids));
  };

  const dismissTask = (taskId: number) => {
    persistDismissed(Array.from(new Set([...dismissedTaskIds, taskId])));
  };

  const restoreTask = (taskId: number) => {
    persistDismissed(dismissedTaskIds.filter((id) => id !== taskId));
  };

  const clearTaskGroup = () => {
    persistDismissed(Array.from(new Set([...dismissedTaskIds, ...popupTasks.map((task) => task.id)])));
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    setBellOpen(false);
  }, [pathname]);

  const handleBellClick = () => {
    const next = !bellOpen;
    setBellOpen(next);
    if (next) {
      clearUnread();
      // Fix A: load in-app notifications when bell opens so the panel shows real details
      openAppNotifs();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  return (
    <motion.header
      ref={navRef as React.RefObject<HTMLElement>}
      dir={dir}
      className={`fixed top-0 left-0 right-0 z-[9999] transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-[var(--color-border)]'
          : 'bg-black/30 backdrop-blur-sm border-b border-white/10'
      }`}
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-1">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 mr-3 no-underline">
          <motion.div
            whileHover={{ rotate: 15 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center"
          >
            <Leaf className="w-4 h-4 text-white" />
          </motion.div>
          <span
            className={`font-semibold text-lg transition-colors duration-300 ${
              scrolled ? 'text-green-900' : 'text-white'
            }`}
            style={{ fontFamily: 'Lora, serif' }}
          >
            PepperFarm
          </span>
          <span
            className={`text-[9px] font-semibold tracking-widest uppercase px-1.5 py-0.5 rounded border transition-colors duration-300 ${
              scrolled
                ? 'text-[var(--color-primary)] bg-[var(--color-secondary-light)] border-[var(--color-border)]'
                : 'text-white/50 bg-white/10 border-white/20'
            }`}
          >
            {t.worker.label}
          </span>
        </Link>

        {/* Divider */}
        <div className={`w-px h-5 mx-1.5 shrink-0 ${scrolled ? 'bg-green-200' : 'bg-white/20'}`} />

        <NavLinkDirect href="/worker"              label={t.nav.dashboard} icon={<LayoutDashboard size={14} />} active={pathname === '/worker'}                          scrolled={scrolled} />
        <NavLinkDirect href="/worker/products"     label={t.nav.products} icon={<ShoppingBag size={14} />}     active={pathname.startsWith('/worker/products')}         scrolled={scrolled} />

        {/* Spacer */}
        <div className="flex-1" />

        {/* US41 — cart icon with item count badge (worker has full cart access) */}
        <Link
          href="/cart"
          aria-label="Cart"
          data-testid="worker-cart-icon"
          className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150 ${
            pathname.startsWith('/cart')
              ? scrolled ? 'bg-[var(--color-secondary-light)] text-[var(--color-primary)]' : 'bg-white/15 text-white'
              : scrolled ? 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]' : 'text-white/50 hover:bg-white/10 hover:text-white'
          }`}
        >
          <ShoppingCart size={15} />
          {cartCount > 0 && (
            <span
              className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-green-500 text-white text-[9px] font-bold flex items-center justify-center leading-none"
              data-testid="worker-cart-badge"
            >
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          )}
        </Link>

        {/* Bell — unified: task notifications + in-app messages (Fix E: single bell) */}
        <div className="relative">
          <button
            onClick={handleBellClick}
            aria-label={t.notifications.taskNotifications}
            aria-expanded={bellOpen}
            className={`relative flex items-center justify-center w-8 h-8 rounded-lg border-none cursor-pointer transition-colors duration-150 ${
              bellOpen
                ? scrolled ? 'bg-[var(--color-secondary-light)] text-[var(--color-primary)]' : 'bg-white/15 text-white'
                : (visibleUnreadCount + appUnreadCount) > 0
                  ? scrolled ? 'text-red-500 hover:bg-[var(--color-error-bg)]' : 'text-red-300 hover:bg-white/10'
                  : scrolled ? 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]' : 'text-white/50 hover:bg-white/10 hover:text-white'
            }`}
          >
            <motion.span
              animate={(visibleUnreadCount + appUnreadCount) > 0 && !bellOpen ? { rotate: [0, -15, 12, -8, 5, 0] } : {}}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              className="flex"
            >
              <Bell size={15} />
            </motion.span>

            <AnimatePresence>
              {(visibleUnreadCount + appUnreadCount) > 0 && (
                <motion.span
                  key="badge"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                  className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none"
                  data-testid="worker-bell-badge"
                >
                  {(visibleUnreadCount + appUnreadCount) > 99 ? '99+' : (visibleUnreadCount + appUnreadCount)}
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* Notification panel */}
          <AnimatePresence>
            {bellOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.96 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="absolute top-[calc(100%+10px)] right-0 w-[320px] rounded-xl border border-[var(--color-border)] bg-white overflow-hidden z-[100]"
                style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-3.5 py-3 border-b border-[var(--color-border)]">
                  <span className="text-sm font-semibold text-[var(--color-foreground)]" style={{ fontFamily: 'Raleway, sans-serif' }}>
                    {t.notifications.taskNotifications}
                    {visibleUnreadCount > 0 && (
                      <span className="ml-1.5 text-[10px] font-bold text-red-400">
                        {visibleUnreadCount} {t.common.new.toLowerCase()}
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => setBellOpen(false)}
                    className="flex p-0.5 rounded border-none bg-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] cursor-pointer transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>

                <div className="px-3.5 pt-2 flex items-center gap-1">
                  <button
                    onClick={() => setNotificationTab('active')}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium ${notificationTab === 'active' ? 'bg-[var(--color-secondary-light)] text-[var(--color-primary)]' : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]'}`}
                  >
                    {t.notifications.active}
                  </button>
                  <button
                    onClick={() => setNotificationTab('history')}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium ${notificationTab === 'history' ? 'bg-[var(--color-secondary-light)] text-[var(--color-primary)]' : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]'}`}
                  >
                    {t.notifications.history}
                  </button>
                  {notificationTab === 'active' && popupTasks.length > 0 && (
                    <button
                      onClick={clearTaskGroup}
                      className="ml-auto text-[10px] text-[var(--color-muted-foreground)] hover:text-[var(--color-error)]"
                    >
                      {t.notifications.clearGroup}
                    </button>
                  )}
                  {notificationTab === 'history' && historyTasks.length > 0 && (
                    <button
                      onClick={() => persistDismissed([])}
                      className="ml-auto text-[10px] text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)]"
                    >
                      {t.notifications.clearHistory}
                    </button>
                  )}
                </div>

                {/* Section */}
                {notificationTab === 'active' ? (
                <>
                <div className="px-3.5 pt-2.5 pb-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--color-muted-foreground)]">
                      {visibleNewTasks.length > 0 ? t.notifications.newlyAssigned : t.notifications.activeTasks}
                    </span>
                    <Link
                      href="/worker"
                      onClick={() => setBellOpen(false)}
                      className="text-[10px] text-[var(--color-primary)] no-underline hover:text-[var(--color-primary)] opacity-80"
                    >
                      {t.common.viewAll}
                    </Link>
                  </div>

                  {popupTasks.length === 0 ? (
                    <p className="text-xs text-[var(--color-muted-foreground)] py-1.5 pb-3 italic">{t.notifications.noActiveTasksAssigned}</p>
                  ) : (
                    <div className="flex flex-col gap-0.5 pb-2">
                      {popupTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-start gap-2.5 px-2 py-1.5 rounded-lg no-underline hover:bg-[var(--color-muted)] transition-colors"
                        >
                          <Link href="/worker" onClick={() => setBellOpen(false)} className="contents">
                          <span className={`mt-0.5 shrink-0 ${PRIORITY_COLOR[task.priority] ?? 'text-[var(--color-muted-foreground)]'}`}>
                            <ClipboardCheck size={13} />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs font-medium text-[var(--color-foreground)] leading-snug truncate">
                              {task.title}
                            </span>
                            <span className="block text-[10px] text-[var(--color-muted-foreground)] mt-0.5">
                              {[task.taskType, task.zoneCode].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                          <span className="shrink-0 text-[10px] text-[var(--color-muted-foreground)] mt-0.5">
                            {timeAgo(task.createdAt)}
                          </span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => dismissTask(task.id)}
                            title={t.notifications.dismiss}
                            aria-label={t.notifications.dismiss}
                            className="shrink-0 mt-0.5 text-[var(--color-muted-foreground)] hover:text-[var(--color-error)]"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fix E: in-app messages inside the unified bell panel */}
                {(appNotifs.length > 0 || appUnreadCount > 0) && (
                  <div className="border-t border-[var(--color-border)] px-3.5 pt-2 pb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--color-muted-foreground)]">
                        {t.appNotifications.appNotifications}
                      </span>
                      {appUnreadCount > 0 && (
                        <button onClick={handleMarkAllRead} className="text-[10px] text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)]">
                          {t.appNotifications.markAllAsRead}
                        </button>
                      )}
                    </div>
                    {appNotifLoading
                      ? <p className="text-xs text-[var(--color-muted-foreground)] italic py-1">{t.common.loading}</p>
                      : appNotifs.length === 0
                        ? <p className="text-xs text-[var(--color-muted-foreground)] italic py-1">{t.appNotifications.noNotifications}</p>
                        : appNotifs.slice(0, 5).map((n) => (
                          <div key={n.notificationId} className={`px-2 py-1.5 rounded-lg mb-0.5 ${!n.isRead ? 'bg-[var(--color-muted)]/60' : ''}`} data-testid={`notif-item-${n.notificationId}`}>
                            <p className="text-xs font-medium text-[var(--color-foreground)] truncate">{n.title}</p>
                            {n.message && <p className="text-[10px] text-[var(--color-muted-foreground)] truncate">{n.message}</p>}
                          </div>
                        ))
                    }
                  </div>
                )}
                </>
                ) : (
                <div className="px-3.5 pt-2.5 pb-3">
                  {historyTasks.length === 0 ? (
                    <p className="text-xs text-[var(--color-muted-foreground)] py-1.5 italic">{t.notifications.noHistory}</p>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {historyTasks.slice(0, 8).map((task) => (
                        <div key={task.id} className="flex items-start gap-2.5 px-2 py-1.5 rounded-lg bg-[var(--color-muted)]/50">
                          <ClipboardCheck size={13} className="mt-0.5 shrink-0 text-[var(--color-muted-foreground)]" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs font-medium text-[var(--color-foreground)] leading-snug truncate">{task.title}</span>
                            <span className="block text-[10px] text-[var(--color-muted-foreground)] mt-0.5">
                              {[task.taskType, task.zoneCode].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => restoreTask(task.id)}
                            title={t.notifications.restore}
                            aria-label={t.notifications.restore}
                            className="shrink-0 mt-0.5 text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)]"
                          >
                            <ClipboardCheck size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* My Orders */}
        <Link
          href="/profile/orders"
          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
            pathname.startsWith('/profile/orders')
              ? scrolled ? 'text-[var(--color-primary)] bg-[var(--color-secondary-light)]' : 'text-white bg-white/10'
              : scrolled ? 'text-green-800 opacity-70 hover:opacity-100 hover:bg-[var(--color-secondary-light)]' : 'text-white/60 hover:opacity-100 hover:bg-white/10 hover:text-white'
          }`}
          data-testid="worker-my-orders-link"
        >
          My Orders
        </Link>

        {/* Language switcher */}
        <LanguageSwitcher />

        {/* Divider */}
        <div className={`w-px h-4.5 mx-1 ${scrolled ? 'bg-[var(--color-border)]' : 'bg-white/20'}`} />

        {/* Logout */}
        <button
          onClick={handleLogout}
          title={t.notifications.signOut}
          aria-label={t.notifications.signOut}
          className={`flex items-center justify-center w-8 h-8 rounded-lg border-none cursor-pointer transition-colors duration-150 ${
            scrolled
              ? 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-error-bg)] hover:text-red-500'
              : 'text-white/40 hover:bg-white/10 hover:text-white/80'
          }`}
        >
          <LogOut size={14} />
        </button>
      </div>
    </motion.header>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-component: direct nav link                                               */
/* -------------------------------------------------------------------------- */

function NavLinkDirect({ href, label, icon, active, scrolled }: { href: string; label: string; icon: React.ReactNode; active: boolean; scrolled: boolean }) {
  return (
    <div className="relative">
      <Link
        href={href}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg no-underline text-sm font-medium transition-colors duration-150 whitespace-nowrap ${
          active
            ? scrolled ? 'text-[var(--color-primary)] bg-[var(--color-secondary-light)]' : 'text-white bg-white/10'
            : scrolled ? 'text-green-800 opacity-70 hover:opacity-100 hover:bg-[var(--color-secondary-light)] hover:text-green-800' : 'text-white opacity-60 hover:opacity-100 hover:bg-white/10 hover:text-white'
        }`}
        style={{ fontFamily: 'Raleway, sans-serif' }}
      >
        <span className="opacity-75">{icon}</span>
        {label}
      </Link>
      {active && <div className={`absolute bottom-[-2px] left-2.5 right-2.5 h-0.5 rounded-sm ${scrolled ? 'bg-green-600' : 'bg-white/60'}`} />}
    </div>
  );
}
