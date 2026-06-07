'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  ClipboardList,
  Radio,
  Leaf,
  ShoppingBag,
  Boxes,
  Sprout,
  BarChart2,
  Users,
  Bell,
  LogOut,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  X,
  ExternalLink,
  Droplets,
  ShieldAlert,
  Mail,
  Tag,
  Package,
  UserCheck,
} from 'lucide-react';
import { useAnomalyNotification } from '@/context/AnomalyNotificationContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLanguage } from '@/context/LanguageContext';

/* -------------------------------------------------------------------------- */
/* Types                                                                        */
/* -------------------------------------------------------------------------- */

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  description?: string;
};

type NavGroup = {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                      */
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

/* -------------------------------------------------------------------------- */
/* Component                                                                    */
/* -------------------------------------------------------------------------- */

export default function ManagerNavbar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { t, dir, locale } = useLanguage();
  const {
    unreadCount,
    clearUnread,
    liveAlerts,
    completedTasks,
    sprayAlerts = [],
    acknowledgeSprayAlert,
    overdueAlerts = [],
    acknowledgeOverdueAlert,
  } = useAnomalyNotification();

  const [openGroup,  setOpenGroup]  = useState<string | null>(null);
  const [bellOpen,   setBellOpen]   = useState(false);
  /* Navbar is always in its stable white state — no scroll-driven style switch (BSPMT7-486). */
  const scrolled = true;
  const [notificationTab, setNotificationTab] = useState<'active' | 'history'>('active');
  const [dismissed, setDismissed] = useState<Record<string, number[]>>({
    sensor: [],
    spray: [],
    overdue: [],
    completed: [],
  });

  const navRef        = useRef<HTMLElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navGroups: NavGroup[] = [
    {
      id: 'inventory',
      label: t.nav.inventory,
      icon: <Boxes size={15} />,
      items: [
        { label: t.nav.stock,    href: '/manager/inventory',        icon: <Boxes size={14} />,       description: t.nav.stockSub },
        { label: t.nav.plants,   href: '/manager/inventory/plants', icon: <Sprout size={14} />,      description: t.nav.plantsSub },
        { label: t.nav.peppers,  href: '/manager/peppers',          icon: <Leaf size={14} />,        description: t.nav.peppersSub },
        { label: t.nav.products, href: '/manager/products',         icon: <ShoppingBag size={14} />, description: t.nav.productsSub },
      ],
    },
  ];

  const dismissedSensor = new Set(dismissed.sensor);
  const dismissedSpray = new Set(dismissed.spray);
  const dismissedOverdue = new Set(dismissed.overdue);
  const dismissedCompleted = new Set(dismissed.completed);
  const activeAlerts      = liveAlerts.filter((a) => !a.isResolved && !dismissedSensor.has(a.alertId)).slice(0, 6);
  const activeAlertsCount = liveAlerts.filter((a) => !a.isResolved && !dismissedSensor.has(a.alertId)).length;
  const recentCompleted   = completedTasks.filter((task) => !dismissedCompleted.has(task.id)).slice(0, 6);
  const recentSprayAlerts = sprayAlerts.filter((alert) => !dismissedSpray.has(alert.SprayAlertId)).slice(0, 6);
  const recentOverdueAlerts = overdueAlerts.filter((alert) => !alert.IsResolved && !dismissedOverdue.has(alert.OverdueAlertId)).slice(0, 6);
  const historyItems = [
    ...liveAlerts.filter((a) => dismissedSensor.has(a.alertId)).map((a) => ({ kind: 'sensor' as const, id: a.alertId, title: `${a.metricName}: ${a.actualValue}`, meta: [a.zoneName, a.pepperName].filter(Boolean).join(' · '), time: a.createdAtUtc })),
    ...sprayAlerts.filter((a) => dismissedSpray.has(a.SprayAlertId)).map((a) => ({ kind: 'spray' as const, id: a.SprayAlertId, title: a.ZoneName, meta: [a.PesticideName, a.ReportStatus].filter(Boolean).join(' · '), time: a.CreatedAt })),
    ...overdueAlerts.filter((a) => dismissedOverdue.has(a.OverdueAlertId)).map((a) => ({ kind: 'overdue' as const, id: a.OverdueAlertId, title: a.ZoneName, meta: a.Message, time: a.CreatedAt })),
    ...completedTasks.filter((t) => dismissedCompleted.has(t.id)).map((task) => ({ kind: 'completed' as const, id: task.id, title: task.title, meta: task.taskType ?? '', time: task.completedAt ?? task.createdAt })),
  ].sort((a, b) => new Date(b.time ?? '').getTime() - new Date(a.time ?? '').getTime());

  const visibleSprayUnread = sprayAlerts.filter((alert) => !alert.IsRead && !dismissedSpray.has(alert.SprayAlertId)).length;
  const visibleOverdueUnread = overdueAlerts.filter((alert) => !alert.IsRead && !alert.IsResolved && !dismissedOverdue.has(alert.OverdueAlertId)).length;
  const badgeCount = activeAlertsCount + visibleSprayUnread + visibleOverdueUnread + Math.max(0, unreadCount - liveAlerts.filter((a) => !a.isResolved).length);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('pepper-farm-manager-dismissed-notifications');
      if (raw) setDismissed({ sensor: [], spray: [], overdue: [], completed: [], ...JSON.parse(raw) });
    } catch {
      setDismissed({ sensor: [], spray: [], overdue: [], completed: [] });
    }
  }, []);

  const persistDismissed = (next: Record<string, number[]>) => {
    setDismissed(next);
    localStorage.setItem('pepper-farm-manager-dismissed-notifications', JSON.stringify(next));
  };

  const dismissNotification = (kind: 'sensor' | 'spray' | 'overdue' | 'completed', id: number) => {
    persistDismissed({ ...dismissed, [kind]: Array.from(new Set([...(dismissed[kind] ?? []), id])) });
  };

  const restoreNotification = (kind: 'sensor' | 'spray' | 'overdue' | 'completed', id: number) => {
    persistDismissed({ ...dismissed, [kind]: (dismissed[kind] ?? []).filter((item) => item !== id) });
  };

  const clearGroup = (kind: 'sensor' | 'spray' | 'overdue' | 'completed', ids: number[]) => {
    persistDismissed({ ...dismissed, [kind]: Array.from(new Set([...(dismissed[kind] ?? []), ...ids])) });
  };

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    setOpenGroup(null);
    setBellOpen(false);
  }, [pathname]);

  const scheduleClose = () => {
    closeTimerRef.current = setTimeout(() => setOpenGroup(null), 100);
  };

  const cancelClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  };

  const isGroupActive = (group: NavGroup) =>
    group.items.some(
      (item) => pathname === item.href || pathname.startsWith(item.href + '/'),
    );

  const handleBellClick = () => {
    const next = !bellOpen;
    setBellOpen(next);
    setOpenGroup(null);
    if (next) clearUnread();
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  const linkColor = scrolled ? 'text-green-800' : 'text-white';
  const activeLinkColor = scrolled ? 'text-[var(--color-primary)]' : 'text-white';
  const activeBg = scrolled ? 'bg-[var(--color-secondary-light)]' : 'bg-white/10';
  const hoverBg = scrolled ? 'hover:bg-[var(--color-secondary-light)] hover:text-green-800' : 'hover:bg-white/10 hover:text-white';

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
            {locale === 'he' ? 'הדינרים' : 'Hadinerim'}
          </span>
          <span
            className={`text-[9px] font-semibold tracking-widest uppercase px-1.5 py-0.5 rounded border transition-colors duration-300 ${
              scrolled
                ? 'text-[var(--color-primary)] bg-[var(--color-secondary-light)] border-[var(--color-border)]'
                : 'text-white/50 bg-white/10 border-white/20'
            }`}
          >
            {t.manager.label}
          </span>
        </Link>

        {/* Divider */}
        <div className={`w-px h-5 mx-1.5 shrink-0 ${scrolled ? 'bg-green-200' : 'bg-white/20'}`} />

        {/* Dashboard */}
        <NavLinkDirect href="/manager" label={t.nav.dashboard} icon={<LayoutDashboard size={14} />} active={pathname === '/manager'} scrolled={scrolled} />

        {/* Tasks */}
        <NavLinkDirect href="/manager/tasks" label={t.nav.tasks} icon={<ClipboardList size={14} />} active={pathname.startsWith('/manager/tasks')} scrolled={scrolled} />

        {/* Sensor Explorer */}
        <NavLinkDirect href="/manager/sensors" label={t.nav.sensorExplorer} icon={<Radio size={14} />} active={pathname.startsWith('/manager/sensors') || pathname.startsWith('/manager/anomalies')} scrolled={scrolled} />

        {/* Inventory dropdown */}
        {navGroups.map((group) => {
          const active = isGroupActive(group);
          const open   = openGroup === group.id;

          return (
            <div
              key={group.id}
              className="relative"
              onMouseEnter={() => { cancelClose(); setOpenGroup(group.id); setBellOpen(false); }}
              onMouseLeave={scheduleClose}
            >
              <button
                onClick={() => { setOpenGroup(open ? null : group.id); setBellOpen(false); }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-none cursor-pointer text-sm font-medium transition-colors duration-150 whitespace-nowrap outline-none select-none ${
                  active || open
                    ? `${activeLinkColor} ${activeBg}`
                    : `${linkColor} opacity-70 ${hoverBg}`
                }`}
                style={{ fontFamily: 'Raleway, sans-serif' }}
              >
                <span className="opacity-80">{group.icon}</span>
                {group.label}
                <motion.span
                  animate={{ rotate: open ? 180 : 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="flex opacity-50"
                >
                  <ChevronDown size={12} />
                </motion.span>
              </button>

              {active && (
                <div className={`absolute bottom-[-2px] left-2.5 right-2.5 h-0.5 rounded-sm ${scrolled ? 'bg-green-600' : 'bg-white/60'}`} />
              )}

              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                    onMouseEnter={cancelClose}
                    onMouseLeave={scheduleClose}
                    className="absolute top-[calc(100%+8px)] left-0 min-w-[224px] rounded-xl border border-[var(--color-border)] bg-white shadow-xl overflow-hidden z-[100]"
                    style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)' }}
                  >
                    <div className="p-1.5">
                      {group.items.map((item) => {
                        const itemActive =
                          pathname === item.href ||
                          pathname.startsWith(item.href + '/');
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-start gap-2.5 px-2.5 py-2 rounded-lg no-underline transition-colors duration-100 ${
                              itemActive ? 'bg-[var(--color-secondary-light)]' : 'hover:bg-[var(--color-muted)]'
                            }`}
                          >
                            <span className={`mt-0.5 shrink-0 ${itemActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted-foreground)]'}`}>
                              {item.icon}
                            </span>
                            <span>
                              <span className={`block text-sm font-medium leading-snug ${itemActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-foreground)]'}`} style={{ fontFamily: 'Raleway, sans-serif' }}>
                                {item.label}
                              </span>
                              {item.description && (
                                <span className="block text-[11px] text-[var(--color-muted-foreground)] mt-0.5 leading-snug">
                                  {item.description}
                                </span>
                              )}
                            </span>
                            {itemActive && (
                              <span className="ml-auto mt-1 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Spray Map — includes spray alert history at #spray-alerts anchor */}
        <NavLinkDirect href="/manager/spray-map" label={t.spray.managerTitle} icon={<Droplets size={14} />} active={pathname.startsWith('/manager/spray-map')} scrolled={scrolled} />

        {/* Analytics */}
        <NavLinkDirect href="/manager/reports" label={t.nav.analytics} icon={<BarChart2 size={14} />} active={pathname.startsWith('/manager/reports')} scrolled={scrolled} />

        {/* Newsletter */}
        <NavLinkDirect href="/manager/newsletter" label={t.nav.newsletter} icon={<Mail size={14} />} active={pathname.startsWith('/manager/newsletter')} scrolled={scrolled} />

        {/* US41: Orders */}
        <NavLinkDirect href="/manager/orders" label="Orders" icon={<Package size={14} />} active={pathname.startsWith('/manager/orders')} scrolled={scrolled} />

        {/* US41: Coupons */}
        <NavLinkDirect href="/manager/coupons" label={t.store.coupons} icon={<Tag size={14} />} active={pathname.startsWith('/manager/coupons')} scrolled={scrolled} />

        {/* US41: Employee Discounts */}
        <NavLinkDirect href="/manager/employee-discounts" label="Emp. Discount" icon={<UserCheck size={14} />} active={pathname.startsWith('/manager/employee-discounts')} scrolled={scrolled} />

        {/* Users */}
        <NavLinkDirect href="/manager/users" label={t.nav.users} icon={<Users size={14} />} active={pathname.startsWith('/manager/users')} scrolled={scrolled} />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bell + notification panel */}
        <div className="relative">
          <button
            onClick={handleBellClick}
            aria-label={t.notifications.notifications}
            aria-expanded={bellOpen}
            className={`relative flex items-center justify-center w-8 h-8 rounded-lg border-none cursor-pointer transition-colors duration-150 ${
              bellOpen
                ? scrolled ? 'bg-[var(--color-secondary-light)] text-[var(--color-primary)]' : 'bg-white/15 text-white'
                : badgeCount > 0
                  ? scrolled ? 'text-red-500 hover:bg-[var(--color-error-bg)]' : 'text-red-300 hover:bg-white/10'
                  : scrolled ? 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]' : 'text-white/50 hover:bg-white/10 hover:text-white'
            }`}
          >
            <motion.span
              animate={badgeCount > 0 && !bellOpen ? { rotate: [0, -15, 12, -8, 5, 0] } : {}}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              className="flex"
            >
              <Bell size={15} />
            </motion.span>

            <AnimatePresence>
              {badgeCount > 0 && (
                <motion.span
                  key="badge"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                  className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none"
                >
                  {badgeCount > 99 ? '99+' : badgeCount}
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
                className="absolute top-[calc(100%+10px)] right-0 w-[360px] rounded-xl border border-[var(--color-border)] bg-white overflow-hidden z-[100]"
                style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)' }}
              >
                {/* Panel header */}
                <div className="flex items-center justify-between px-3.5 py-3 border-b border-[var(--color-border)]">
                  <span className="text-sm font-semibold text-[var(--color-foreground)]" style={{ fontFamily: 'Raleway, sans-serif' }}>
                    {t.notifications.notifications}
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
                  {notificationTab === 'history' && historyItems.length > 0 && (
                    <button
                      onClick={() => persistDismissed({ sensor: [], spray: [], overdue: [], completed: [] })}
                      className="ml-auto text-[10px] text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)]"
                    >
                      {t.notifications.clearHistory}
                    </button>
                  )}
                </div>

                {/* Active Sensor Alerts section */}
                {notificationTab === 'active' ? (
                <>
                <div className="px-3.5 pt-2.5 pb-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--color-muted-foreground)]">
                      {t.notifications.activeAlerts}
                    </span>
                    {activeAlerts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => clearGroup('sensor', activeAlerts.map((alert) => alert.alertId))}
                        className="text-[10px] text-[var(--color-muted-foreground)] hover:text-[var(--color-error)]"
                      >
                        {t.notifications.clearGroup}
                      </button>
                    )}
                    <Link
                      href="/manager/sensors?tab=anomalies"
                      onClick={() => setBellOpen(false)}
                      className="flex items-center gap-0.5 text-[10px] text-[var(--color-primary)] no-underline hover:text-[var(--color-primary)] opacity-80"
                    >
                      {t.common.viewAll} <ExternalLink size={9} />
                    </Link>
                  </div>

                  {activeAlerts.length === 0 ? (
                    <p className="text-xs text-[var(--color-muted-foreground)] py-1.5 italic">{t.notifications.noActiveAlerts}</p>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {activeAlerts.map((alert) => (
                        <div
                          key={alert.alertId}
                          className="flex items-start gap-2.5 px-2 py-1.5 rounded-lg no-underline hover:bg-[var(--color-muted)] transition-colors"
                        >
                          <Link href={`/manager/sensors?tab=anomalies&openAlertId=${alert.alertId}`} onClick={() => setBellOpen(false)} className="contents">
                          <span className={`mt-0.5 shrink-0 ${alert.severity === 'High' ? 'text-red-500' : 'text-amber-500'}`}>
                            <AlertTriangle size={13} />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs font-medium text-[var(--color-foreground)] leading-snug truncate">
                              {alert.metricName}: {alert.actualValue}
                            </span>
                            {(alert.zoneName || alert.pepperName) && (
                              <span className="block text-[10px] text-[var(--color-muted-foreground)] mt-0.5">
                                {[alert.zoneName, alert.pepperName].filter(Boolean).join(' · ')}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-[10px] text-[var(--color-muted-foreground)] mt-0.5">
                            {timeAgo(alert.createdAtUtc)}
                          </span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => dismissNotification('sensor', alert.alertId)}
                            aria-label={t.notifications.dismiss}
                            title={t.notifications.dismiss}
                            className="shrink-0 mt-0.5 text-[var(--color-muted-foreground)] hover:text-[var(--color-error)]"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="h-px bg-[var(--color-border)] my-1" />

                {/* US30 — Spray Alerts section */}
                <div className="px-3.5 pt-2 pb-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--color-muted-foreground)]">
                      {t.notifications.sprayAlerts}
                    </span>
                    {recentSprayAlerts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => clearGroup('spray', recentSprayAlerts.map((alert) => alert.SprayAlertId))}
                        className="text-[10px] text-[var(--color-muted-foreground)] hover:text-[var(--color-error)]"
                      >
                        {t.notifications.clearGroup}
                      </button>
                    )}
                    <Link
                      href="/manager/spray-map#spray-alerts"
                      onClick={() => setBellOpen(false)}
                      className="flex items-center gap-0.5 text-[10px] text-[var(--color-primary)] no-underline hover:text-[var(--color-primary)] opacity-80"
                    >
                      {t.common.viewAll} <ExternalLink size={9} />
                    </Link>
                  </div>

                  {recentSprayAlerts.length === 0 ? (
                    <p className="text-xs text-[var(--color-muted-foreground)] py-1.5 italic">{t.notifications.noSprayAlerts}</p>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {recentSprayAlerts.map((alert) => (
                        <div
                          key={alert.SprayAlertId}
                          className={`flex items-start gap-2.5 px-2 py-1.5 rounded-lg no-underline hover:bg-[var(--color-muted)] transition-colors ${!alert.IsRead ? 'bg-[var(--color-warning-bg)]/50' : ''}`}
                        >
                          <Link
                            href="/manager/spray-map#spray-alerts"
                            onClick={() => {
                              setBellOpen(false);
                              if (!alert.IsRead) acknowledgeSprayAlert?.(alert.SprayAlertId);
                            }}
                            className="contents"
                            data-testid="spray-alert-item"
                          >
                          <span className={`mt-0.5 shrink-0 ${
                            alert.Severity === 'high' ? 'text-red-500' :
                            alert.Severity === 'medium' ? 'text-amber-500' :
                            'text-blue-400'
                          }`}>
                            <ShieldAlert size={13} />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs font-medium text-[var(--color-foreground)] leading-snug truncate">
                              {alert.ZoneName}
                              {alert.PesticideName ? ` — ${alert.PesticideName}` : ''}
                            </span>
                            <span className="block text-[10px] text-[var(--color-muted-foreground)] mt-0.5 capitalize">
                              {alert.ReportStatus} · {alert.Severity}
                            </span>
                          </span>
                          <span className="shrink-0 text-[10px] text-[var(--color-muted-foreground)] mt-0.5">
                            {timeAgo(alert.CreatedAt)}
                          </span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              if (!alert.IsRead) acknowledgeSprayAlert?.(alert.SprayAlertId);
                              dismissNotification('spray', alert.SprayAlertId);
                            }}
                            aria-label={t.notifications.dismiss}
                            title={t.notifications.dismiss}
                            className="shrink-0 mt-0.5 text-[var(--color-muted-foreground)] hover:text-[var(--color-error)]"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="h-px bg-[var(--color-border)] my-1" />

                <div className="px-3.5 pt-2 pb-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--color-muted-foreground)]">
                      {t.notifications.overdueSprayAlerts}
                    </span>
                    {recentOverdueAlerts.length > 0 && (
                      <button type="button" onClick={() => clearGroup('overdue', recentOverdueAlerts.map((alert) => alert.OverdueAlertId))} className="text-[10px] text-[var(--color-muted-foreground)] hover:text-[var(--color-error)]">
                        {t.notifications.clearGroup}
                      </button>
                    )}
                    <Link href="/manager/spray-map#overdue-spray-alerts" onClick={() => setBellOpen(false)} className="flex items-center gap-0.5 text-[10px] text-[var(--color-primary)] no-underline hover:text-[var(--color-primary)] opacity-80">
                      {t.common.viewAll} <ExternalLink size={9} />
                    </Link>
                  </div>

                  {recentOverdueAlerts.length === 0 ? (
                    <p className="text-xs text-[var(--color-muted-foreground)] py-1.5 italic">{t.notifications.noOverdueAlerts}</p>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {recentOverdueAlerts.map((alert) => (
                        <div key={alert.OverdueAlertId} className={`flex items-start gap-2.5 px-2 py-1.5 rounded-lg no-underline hover:bg-[var(--color-muted)] transition-colors ${!alert.IsRead ? 'bg-[var(--color-warning-bg)]/50' : ''}`}>
                          <Link href="/manager/spray-map#overdue-spray-alerts" onClick={() => { setBellOpen(false); if (!alert.IsRead) acknowledgeOverdueAlert?.(alert.OverdueAlertId); }} className="contents">
                            <span className={alert.Severity === 'high' ? 'mt-0.5 shrink-0 text-red-500' : 'mt-0.5 shrink-0 text-amber-500'}>
                              <ShieldAlert size={13} />
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-xs font-medium text-[var(--color-foreground)] leading-snug truncate">{alert.ZoneName}</span>
                              <span className="block text-[10px] text-[var(--color-muted-foreground)] mt-0.5 truncate">{alert.Message}</span>
                            </span>
                            <span className="shrink-0 text-[10px] text-[var(--color-muted-foreground)] mt-0.5">{timeAgo(alert.CreatedAt)}</span>
                          </Link>
                          <button type="button" onClick={() => { if (!alert.IsRead) acknowledgeOverdueAlert?.(alert.OverdueAlertId); dismissNotification('overdue', alert.OverdueAlertId); }} aria-label={t.notifications.dismiss} title={t.notifications.dismiss} className="shrink-0 mt-0.5 text-[var(--color-muted-foreground)] hover:text-[var(--color-error)]">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="h-px bg-[var(--color-border)] my-1" />

                <div className="px-3.5 pt-2 pb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--color-muted-foreground)]">
                      {t.notifications.completedTasks}
                    </span>
                    {recentCompleted.length > 0 && (
                      <button type="button" onClick={() => clearGroup('completed', recentCompleted.map((task) => task.id))} className="text-[10px] text-[var(--color-muted-foreground)] hover:text-[var(--color-error)]">
                        {t.notifications.clearGroup}
                      </button>
                    )}
                    <Link href="/manager/tasks?tab=history" onClick={() => setBellOpen(false)} className="flex items-center gap-0.5 text-[10px] text-[var(--color-primary)] no-underline hover:text-[var(--color-primary)] opacity-80">
                      {t.common.viewHistory} <ExternalLink size={9} />
                    </Link>
                  </div>

                  {recentCompleted.length === 0 ? (
                    <p className="text-xs text-[var(--color-muted-foreground)] py-1.5 italic">{t.notifications.noCompletedTasks}</p>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {recentCompleted.map((task) => (
                        <div key={task.id} className="flex items-start gap-2.5 px-2 py-1.5 rounded-lg no-underline hover:bg-[var(--color-muted)] transition-colors">
                          <Link href="/manager/tasks?tab=history" onClick={() => setBellOpen(false)} className="contents">
                            <span className="mt-0.5 shrink-0 text-green-500">
                              <CheckCircle2 size={13} />
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-xs font-medium text-[var(--color-foreground)] leading-snug truncate">{task.title}</span>
                              {task.taskType && <span className="block text-[10px] text-[var(--color-muted-foreground)] mt-0.5">{task.taskType}</span>}
                            </span>
                            <span className="shrink-0 text-[10px] text-[var(--color-muted-foreground)] mt-0.5">{timeAgo(task.completedAt)}</span>
                          </Link>
                          <button type="button" onClick={() => dismissNotification('completed', task.id)} aria-label={t.notifications.dismiss} title={t.notifications.dismiss} className="shrink-0 mt-0.5 text-[var(--color-muted-foreground)] hover:text-[var(--color-error)]">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </>
                ) : (
                  <div className="px-3.5 pt-2.5 pb-3">
                    {historyItems.length === 0 ? (
                      <p className="text-xs text-[var(--color-muted-foreground)] py-1.5 italic">{t.notifications.noHistory}</p>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {historyItems.slice(0, 10).map((item) => (
                          <div key={`${item.kind}-${item.id}`} className="flex items-start gap-2.5 px-2 py-1.5 rounded-lg bg-[var(--color-muted)]/50">
                            <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[var(--color-muted-foreground)]" />
                            <span className="flex-1 min-w-0">
                              <span className="block text-xs font-medium text-[var(--color-foreground)] leading-snug truncate">{item.title}</span>
                              {item.meta && <span className="block text-[10px] text-[var(--color-muted-foreground)] mt-0.5 truncate">{item.meta}</span>}
                            </span>
                            <button type="button" onClick={() => restoreNotification(item.kind, item.id)} aria-label={t.notifications.restore} title={t.notifications.restore} className="shrink-0 mt-0.5 text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)]">
                              <CheckCircle2 size={12} />
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

function NavLinkDirect({
  href,
  label,
  icon,
  active,
  scrolled,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  scrolled: boolean;
}) {
  return (
    <div className="relative">
      <Link
        href={href}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg no-underline text-sm font-medium transition-colors duration-150 whitespace-nowrap ${
          active
            ? scrolled
              ? 'text-[var(--color-primary)] bg-[var(--color-secondary-light)]'
              : 'text-white bg-white/10'
            : scrolled
              ? 'text-green-800 opacity-70 hover:opacity-100 hover:bg-[var(--color-secondary-light)] hover:text-green-800'
              : 'text-white opacity-60 hover:opacity-100 hover:bg-white/10 hover:text-white'
        }`}
        style={{ fontFamily: 'Raleway, sans-serif' }}
      >
        <span className="opacity-75">{icon}</span>
        {label}
      </Link>
      {active && (
        <div className={`absolute bottom-[-2px] left-2.5 right-2.5 h-0.5 rounded-sm ${scrolled ? 'bg-green-600' : 'bg-white/60'}`} />
      )}
    </div>
  );
}
