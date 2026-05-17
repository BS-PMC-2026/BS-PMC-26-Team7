'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  ClipboardList,
  Map,
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
} from 'lucide-react';
import { useAnomalyNotification } from '@/context/AnomalyNotificationContext';

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
/* Navigation structure                                                         */
/* -------------------------------------------------------------------------- */

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'inventory',
    label: 'Inventory',
    icon: <Boxes size={15} />,
    items: [
      { label: 'Stock',    href: '/manager/inventory',        icon: <Boxes size={14} />,       description: 'Warehouse stock levels' },
      { label: 'Plants',   href: '/manager/inventory/plants', icon: <Sprout size={14} />,      description: 'Plant tracking' },
      { label: 'Farm Map', href: '/manager/map',              icon: <Map size={14} />,         description: 'Zone layout and plant locations' },
      { label: 'Peppers',  href: '/manager/peppers',          icon: <Leaf size={14} />,        description: 'Pepper variety catalog' },
      { label: 'Products', href: '/manager/products',         icon: <ShoppingBag size={14} />, description: 'Product catalog' },
    ],
  },
];

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
  const { unreadCount, clearUnread, liveAlerts, completedTasks } = useAnomalyNotification();

  const [openGroup,  setOpenGroup]  = useState<string | null>(null);
  const [bellOpen,   setBellOpen]   = useState(false);
  const [scrolled,   setScrolled]   = useState(false);

  const navRef       = useRef<HTMLElement>(null);
  const bellRef      = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeAlerts      = liveAlerts.filter((a) => !a.isResolved).slice(0, 6);
  const activeAlertsCount = liveAlerts.filter((a) => !a.isResolved).length;
  const recentCompleted   = completedTasks.slice(0, 6);

  // Badge shows total active alerts (always visible when there are any),
  // plus any unread task completions that arrived since page load.
  const badgeCount = activeAlertsCount + (unreadCount > activeAlertsCount ? unreadCount - activeAlertsCount : 0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close dropdowns when clicking outside nav
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

  // Close everything on route change
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

  return (
    <nav
      ref={navRef}
      dir="ltr"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        height: '52px',
        backgroundColor: scrolled ? 'rgba(26, 46, 34, 0.97)' : '#1A2E22',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        boxShadow: scrolled
          ? '0 1px 0 rgba(255,255,255,0.06), 0 4px 20px rgba(0,0,0,0.35)'
          : '0 1px 0 rgba(255,255,255,0.05)',
        transition: 'background-color 0.25s ease, box-shadow 0.25s ease',
      }}
    >
      {/* Bottom accent line */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, #2F6F4E 30%, #D64545 50%, #2F6F4E 70%, transparent 100%)',
          opacity: 0.6,
        }}
      />

      <div
        style={{
          height: '100%',
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginRight: '12px',
            textDecoration: 'none',
            color: 'rgba(255,255,255,0.92)',
            flexShrink: 0,
          }}
        >
          <span style={{ color: '#D64545', display: 'flex' }}>
            <Leaf size={18} />
          </span>
          <span
            style={{
              fontFamily: 'Lora, serif',
              fontWeight: 600,
              fontSize: '15px',
              letterSpacing: '-0.01em',
              color: 'rgba(255,255,255,0.95)',
            }}
          >
            PepperFarm
          </span>
          <span
            style={{
              fontSize: '9px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.35)',
              backgroundColor: 'rgba(255,255,255,0.08)',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            Manager
          </span>
        </Link>

        {/* Divider */}
        <div
          style={{
            width: '1px',
            height: '20px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            margin: '0 6px',
            flexShrink: 0,
          }}
        />

        {/* Dashboard */}
        <NavLinkDirect href="/manager" label="Dashboard" icon={<LayoutDashboard size={14} />} active={pathname === '/manager'} />

        {/* Tasks */}
        <NavLinkDirect href="/manager/tasks" label="Tasks" icon={<ClipboardList size={14} />} active={pathname.startsWith('/manager/tasks')} />

        {/* Sensor Explorer */}
        <NavLinkDirect href="/manager/sensors" label="Sensor Explorer" icon={<Radio size={14} />} active={pathname.startsWith('/manager/sensors') || pathname.startsWith('/manager/anomalies')} />

        {/* Inventory dropdown */}
        {NAV_GROUPS.map((group) => {
          const active = isGroupActive(group);
          const open   = openGroup === group.id;

          return (
            <div
              key={group.id}
              style={{ position: 'relative' }}
              onMouseEnter={() => { cancelClose(); setOpenGroup(group.id); setBellOpen(false); }}
              onMouseLeave={scheduleClose}
            >
              <button
                onClick={() => { setOpenGroup(open ? null : group.id); setBellOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  fontFamily: 'Raleway, sans-serif',
                  backgroundColor: active || open ? 'rgba(47, 111, 78, 0.25)' : 'transparent',
                  color: active || open ? '#7CC49A' : 'rgba(255,255,255,0.55)',
                  transition: 'background-color 0.15s, color 0.15s',
                  outline: 'none',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (!active && !open) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)';
                    (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.85)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active && !open) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                    (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.55)';
                  }
                }}
              >
                <span style={{ opacity: 0.8 }}>{group.icon}</span>
                {group.label}
                <motion.span
                  animate={{ rotate: open ? 180 : 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  style={{ display: 'flex', opacity: 0.5 }}
                >
                  <ChevronDown size={12} />
                </motion.span>
              </button>

              {active && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-2px',
                    left: '10px',
                    right: '10px',
                    height: '2px',
                    borderRadius: '1px',
                    backgroundColor: '#2F6F4E',
                  }}
                />
              )}

              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                    onMouseEnter={() => { cancelClose(); }}
                    onMouseLeave={scheduleClose}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      minWidth: '224px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      backgroundColor: '#162619',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
                      overflow: 'hidden',
                      zIndex: 100,
                    }}
                  >
                    <div style={{ padding: '6px' }}>
                      {group.items.map((item) => {
                        const itemActive =
                          pathname === item.href ||
                          pathname.startsWith(item.href + '/');
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '10px',
                              padding: '8px 10px',
                              borderRadius: '7px',
                              textDecoration: 'none',
                              backgroundColor: itemActive ? 'rgba(47, 111, 78, 0.2)' : 'transparent',
                              transition: 'background-color 0.12s',
                            }}
                            onMouseEnter={(e) => {
                              if (!itemActive)
                                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'rgba(255,255,255,0.05)';
                            }}
                            onMouseLeave={(e) => {
                              if (!itemActive)
                                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent';
                            }}
                          >
                            <span style={{ marginTop: '1px', flexShrink: 0, color: itemActive ? '#7CC49A' : 'rgba(255,255,255,0.35)' }}>
                              {item.icon}
                            </span>
                            <span>
                              <span style={{ display: 'block', fontSize: '13px', fontWeight: 500, fontFamily: 'Raleway, sans-serif', color: itemActive ? '#7CC49A' : 'rgba(255,255,255,0.8)', lineHeight: 1.3 }}>
                                {item.label}
                              </span>
                              {item.description && (
                                <span style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.28)', marginTop: '1px', lineHeight: 1.4 }}>
                                  {item.description}
                                </span>
                              )}
                            </span>
                            {itemActive && (
                              <span style={{ marginLeft: 'auto', marginTop: '3px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2F6F4E', flexShrink: 0 }} />
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

        {/* Analytics */}
        <NavLinkDirect href="/manager/reports" label="Analytics" icon={<BarChart2 size={14} />} active={pathname.startsWith('/manager/reports')} />

        {/* Users */}
        <NavLinkDirect href="/manager/users" label="Users" icon={<Users size={14} />} active={pathname.startsWith('/manager/users')} />

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* ---------------------------------------------------------------- */}
        {/* Bell + notification panel                                          */}
        {/* ---------------------------------------------------------------- */}
        <div ref={bellRef} style={{ position: 'relative' }}>
          <button
            onClick={handleBellClick}
            aria-label="Notifications"
            aria-expanded={bellOpen}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '7px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: bellOpen ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: badgeCount > 0 ? '#EF8A8A' : 'rgba(255,255,255,0.4)',
              transition: 'background-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!bellOpen) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.07)';
                (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.8)';
              }
            }}
            onMouseLeave={(e) => {
              if (!bellOpen) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                (e.currentTarget as HTMLButtonElement).style.color =
                  badgeCount > 0 ? '#EF8A8A' : 'rgba(255,255,255,0.4)';
              }
            }}
          >
            <motion.span
              animate={badgeCount > 0 && !bellOpen ? { rotate: [0, -15, 12, -8, 5, 0] } : {}}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              style={{ display: 'flex' }}
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
                  style={{
                    position: 'absolute',
                    top: '3px',
                    right: '3px',
                    minWidth: '14px',
                    height: '14px',
                    padding: '0 3px',
                    borderRadius: '7px',
                    backgroundColor: '#D64545',
                    color: '#fff',
                    fontSize: '9px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                  }}
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
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  width: '360px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.09)',
                  backgroundColor: '#111d14',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
                  overflow: 'hidden',
                  zIndex: 100,
                }}
              >
                {/* Panel header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px 10px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontFamily: 'Raleway, sans-serif', letterSpacing: '0.01em' }}>
                    Notifications
                  </span>
                  <button
                    onClick={() => setBellOpen(false)}
                    style={{ display: 'flex', padding: '3px', borderRadius: '5px', border: 'none', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)'; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.3)'; (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                  >
                    <X size={13} />
                  </button>
                </div>

                {/* Active Alerts section */}
                <div style={{ padding: '10px 14px 4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>
                      Active Alerts
                    </span>
                    <Link
                      href="/manager/sensors?tab=anomalies"
                      onClick={() => setBellOpen(false)}
                      style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#7CC49A', textDecoration: 'none', opacity: 0.8 }}
                    >
                      View all <ExternalLink size={9} />
                    </Link>
                  </div>

                  {activeAlerts.length === 0 ? (
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.22)', padding: '6px 0 8px', fontStyle: 'italic' }}>
                      No active alerts
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {activeAlerts.map((alert) => (
                        <Link
                          key={alert.alertId}
                          href={`/manager/sensors?tab=anomalies&openAlertId=${alert.alertId}`}
                          onClick={() => setBellOpen(false)}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '7px 8px', borderRadius: '7px', textDecoration: 'none', transition: 'background-color 0.1s' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent'; }}
                        >
                          <span style={{ marginTop: '1px', flexShrink: 0, color: alert.severity === 'High' ? '#EF4444' : '#F59E0B' }}>
                            <AlertTriangle size={13} />
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.78)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {alert.metricName}: {alert.actualValue}
                            </span>
                            {(alert.zoneName || alert.pepperName) && (
                              <span style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginTop: '1px' }}>
                                {[alert.zoneName, alert.pepperName].filter(Boolean).join(' · ')}
                              </span>
                            )}
                          </span>
                          <span style={{ flexShrink: 0, fontSize: '10px', color: 'rgba(255,255,255,0.22)', marginTop: '1px' }}>
                            {timeAgo(alert.createdAtUtc)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />

                {/* Completed Tasks section */}
                <div style={{ padding: '10px 14px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>
                      Completed Tasks
                    </span>
                    <Link
                      href="/manager/tasks?tab=history"
                      onClick={() => setBellOpen(false)}
                      style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#7CC49A', textDecoration: 'none', opacity: 0.8 }}
                    >
                      View history <ExternalLink size={9} />
                    </Link>
                  </div>

                  {recentCompleted.length === 0 ? (
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.22)', padding: '6px 0', fontStyle: 'italic' }}>
                      No completed tasks yet
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {recentCompleted.map((task) => (
                        <Link
                          key={task.id}
                          href="/manager/tasks?tab=history"
                          onClick={() => setBellOpen(false)}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '7px 8px', borderRadius: '7px', textDecoration: 'none', transition: 'background-color 0.1s' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent'; }}
                        >
                          <span style={{ marginTop: '1px', flexShrink: 0, color: '#4CAF50' }}>
                            <CheckCircle2 size={13} />
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.78)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {task.title}
                            </span>
                            {task.taskType && (
                              <span style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginTop: '1px' }}>
                                {task.taskType}
                              </span>
                            )}
                          </span>
                          <span style={{ flexShrink: 0, fontSize: '10px', color: 'rgba(255,255,255,0.22)', marginTop: '1px' }}>
                            {timeAgo(task.completedAt)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div
          style={{
            width: '1px',
            height: '18px',
            backgroundColor: 'rgba(255,255,255,0.08)',
            margin: '0 4px',
          }}
        />

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Sign out"
          aria-label="Sign out"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '7px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            color: 'rgba(255,255,255,0.3)',
            transition: 'background-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(214,69,69,0.12)';
            (e.currentTarget as HTMLButtonElement).style.color = '#EF8A8A';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.3)';
          }}
        >
          <LogOut size={14} />
        </button>
      </div>
    </nav>
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
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <Link
        href={href}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: '5px 10px',
          borderRadius: '6px',
          textDecoration: 'none',
          fontSize: '13px',
          fontWeight: 500,
          fontFamily: 'Raleway, sans-serif',
          backgroundColor: active ? 'rgba(47, 111, 78, 0.25)' : 'transparent',
          color: active ? '#7CC49A' : 'rgba(255,255,255,0.55)',
          transition: 'background-color 0.15s, color 0.15s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          if (!active) {
            (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'rgba(255,255,255,0.06)';
            (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.85)';
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.55)';
          }
        }}
      >
        <span style={{ opacity: 0.75 }}>{icon}</span>
        {label}
      </Link>
      {active && (
        <div
          style={{
            position: 'absolute',
            bottom: '-2px',
            left: '10px',
            right: '10px',
            height: '2px',
            borderRadius: '1px',
            backgroundColor: '#2F6F4E',
          }}
        />
      )}
    </div>
  );
}
