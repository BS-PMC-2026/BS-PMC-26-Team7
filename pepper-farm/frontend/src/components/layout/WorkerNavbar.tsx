'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  ClipboardList,
  ShoppingBag,
  Sprout,
  ChevronDown,
  Leaf,
  LogOut,
  MapPin,
  Droplets,
  Bell,
  X,
  ClipboardCheck,
} from 'lucide-react';
import { useWorkerNotification } from '@/context/WorkerNotificationContext';

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
    id: 'plants',
    label: 'Plants',
    icon: <Sprout size={15} />,
    items: [
      { label: 'Add Plant',       href: '/worker/plants/add',             icon: <Sprout size={14} />, description: 'Register a new plant' },
      { label: 'Update Location', href: '/worker/plants/update-location', icon: <MapPin size={14} />, description: 'Move a plant to a new zone' },
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

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#EF4444',
  high:     '#F59E0B',
  medium:   '#3B82F6',
  low:      'rgba(255,255,255,0.3)',
};

/* -------------------------------------------------------------------------- */
/* Component                                                                    */
/* -------------------------------------------------------------------------- */

export default function WorkerNavbar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { unreadCount, clearUnread, newTasks, activeTasks } = useWorkerNotification();

  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [bellOpen,  setBellOpen]  = useState(false);
  const [scrolled,  setScrolled]  = useState(false);

  const navRef        = useRef<HTMLElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show newly assigned tasks in popup; fall back to all active if none new yet
  const popupTasks = newTasks.length > 0 ? newTasks.slice(0, 6) : activeTasks.slice(0, 6);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
    group.items.some((item) => pathname === item.href || pathname.startsWith(item.href + '/'));

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
        top: 0, left: 0, right: 0,
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
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px',
        background: 'linear-gradient(90deg, transparent 0%, #2F6F4E 30%, #D64545 50%, #2F6F4E 70%, transparent 100%)',
        opacity: 0.6,
      }} />

      <div style={{
        height: '100%', maxWidth: '1280px', margin: '0 auto',
        padding: '0 20px', display: 'flex', alignItems: 'center', gap: '2px',
      }}>

        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '12px', textDecoration: 'none', flexShrink: 0 }}>
          <span style={{ color: '#D64545', display: 'flex' }}><Leaf size={18} /></span>
          <span style={{ fontFamily: 'Lora, serif', fontWeight: 600, fontSize: '15px', letterSpacing: '-0.01em', color: 'rgba(255,255,255,0.95)' }}>
            PepperFarm
          </span>
          <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
            Worker
          </span>
        </Link>

        {/* Divider */}
        <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(255,255,255,0.1)', margin: '0 6px', flexShrink: 0 }} />

        <NavLinkDirect href="/worker"           label="Dashboard"    icon={<LayoutDashboard size={14} />} active={pathname === '/worker'} />
        <NavLinkDirect href="/worker/my-tasks"  label="My Tasks"     icon={<ClipboardList size={14} />}   active={pathname.startsWith('/worker/my-tasks')} />
        <NavLinkDirect href="/worker/products"  label="Products"     icon={<ShoppingBag size={14} />}     active={pathname.startsWith('/worker/products')} />
        <NavLinkDirect href="/worker/spray-report" label="Spray Report" icon={<Droplets size={14} />}     active={pathname.startsWith('/worker/spray-report')} />

        {/* Plants dropdown */}
        {NAV_GROUPS.map((group) => {
          const active = isGroupActive(group);
          const open   = openGroup === group.id;
          return (
            <div key={group.id} style={{ position: 'relative' }}
              onMouseEnter={() => { cancelClose(); setOpenGroup(group.id); setBellOpen(false); }}
              onMouseLeave={scheduleClose}
            >
              <button
                onClick={() => { setOpenGroup(open ? null : group.id); setBellOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, fontFamily: 'Raleway, sans-serif', backgroundColor: active || open ? 'rgba(47,111,78,0.25)' : 'transparent', color: active || open ? '#7CC49A' : 'rgba(255,255,255,0.55)', transition: 'background-color 0.15s, color 0.15s', outline: 'none', userSelect: 'none', whiteSpace: 'nowrap' }}
                onMouseEnter={(e) => { if (!active && !open) { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.85)'; } }}
                onMouseLeave={(e) => { if (!active && !open) { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.55)'; } }}
              >
                <span style={{ opacity: 0.8 }}>{group.icon}</span>
                {group.label}
                <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18, ease: 'easeOut' }} style={{ display: 'flex', opacity: 0.5 }}>
                  <ChevronDown size={12} />
                </motion.span>
              </button>

              {active && <div style={{ position: 'absolute', bottom: '-2px', left: '10px', right: '10px', height: '2px', borderRadius: '1px', backgroundColor: '#2F6F4E' }} />}

              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                    onMouseEnter={cancelClose}
                    onMouseLeave={scheduleClose}
                    style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, minWidth: '224px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#162619', boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)', overflow: 'hidden', zIndex: 100 }}
                  >
                    <div style={{ padding: '6px' }}>
                      {group.items.map((item) => {
                        const itemActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                          <Link key={item.href} href={item.href}
                            style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 10px', borderRadius: '7px', textDecoration: 'none', backgroundColor: itemActive ? 'rgba(47,111,78,0.2)' : 'transparent', transition: 'background-color 0.12s' }}
                            onMouseEnter={(e) => { if (!itemActive) (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
                            onMouseLeave={(e) => { if (!itemActive) (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent'; }}
                          >
                            <span style={{ marginTop: '1px', flexShrink: 0, color: itemActive ? '#7CC49A' : 'rgba(255,255,255,0.35)' }}>{item.icon}</span>
                            <span>
                              <span style={{ display: 'block', fontSize: '13px', fontWeight: 500, fontFamily: 'Raleway, sans-serif', color: itemActive ? '#7CC49A' : 'rgba(255,255,255,0.8)', lineHeight: 1.3 }}>{item.label}</span>
                              {item.description && <span style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.28)', marginTop: '1px', lineHeight: 1.4 }}>{item.description}</span>}
                            </span>
                            {itemActive && <span style={{ marginLeft: 'auto', marginTop: '3px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2F6F4E', flexShrink: 0 }} />}
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

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* ---------------------------------------------------------------- */}
        {/* Bell                                                               */}
        {/* ---------------------------------------------------------------- */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={handleBellClick}
            aria-label="Task notifications"
            aria-expanded={bellOpen}
            style={{
              position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', borderRadius: '7px', border: 'none', cursor: 'pointer',
              backgroundColor: bellOpen ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: unreadCount > 0 ? '#EF8A8A' : 'rgba(255,255,255,0.4)',
              transition: 'background-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => { if (!bellOpen) { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.8)'; } }}
            onMouseLeave={(e) => { if (!bellOpen) { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = unreadCount > 0 ? '#EF8A8A' : 'rgba(255,255,255,0.4)'; } }}
          >
            <motion.span
              animate={unreadCount > 0 && !bellOpen ? { rotate: [0, -15, 12, -8, 5, 0] } : {}}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              style={{ display: 'flex' }}
            >
              <Bell size={15} />
            </motion.span>

            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  key="badge"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                  style={{ position: 'absolute', top: '3px', right: '3px', minWidth: '14px', height: '14px', padding: '0 3px', borderRadius: '7px', backgroundColor: '#D64545', color: '#fff', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
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
                style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: '320px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.09)', backgroundColor: '#111d14', boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)', overflow: 'hidden', zIndex: 100 }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontFamily: 'Raleway, sans-serif' }}>
                    My Tasks
                    {unreadCount > 0 && (
                      <span style={{ marginLeft: '7px', fontSize: '10px', fontWeight: 700, color: '#EF8A8A' }}>
                        {unreadCount} new
                      </span>
                    )}
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

                {/* Section label */}
                <div style={{ padding: '10px 14px 4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>
                      {newTasks.length > 0 ? 'Newly Assigned' : 'Active Tasks'}
                    </span>
                    <Link
                      href="/worker/my-tasks"
                      onClick={() => setBellOpen(false)}
                      style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#7CC49A', textDecoration: 'none', opacity: 0.8 }}
                    >
                      View all
                    </Link>
                  </div>

                  {popupTasks.length === 0 ? (
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.22)', padding: '6px 0 8px', fontStyle: 'italic' }}>
                      No active tasks assigned to you
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingBottom: '8px' }}>
                      {popupTasks.map((task) => (
                        <Link
                          key={task.id}
                          href="/worker/my-tasks"
                          onClick={() => setBellOpen(false)}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '7px 8px', borderRadius: '7px', textDecoration: 'none', transition: 'background-color 0.1s' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent'; }}
                        >
                          <span style={{ marginTop: '1px', flexShrink: 0, color: PRIORITY_COLOR[task.priority] ?? 'rgba(255,255,255,0.3)' }}>
                            <ClipboardCheck size={13} />
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.78)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {task.title}
                            </span>
                            <span style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginTop: '1px' }}>
                              {[task.taskType, task.zoneCode].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                          <span style={{ flexShrink: 0, fontSize: '10px', color: 'rgba(255,255,255,0.22)', marginTop: '1px' }}>
                            {timeAgo(task.createdAt)}
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
        <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Sign out"
          aria-label="Sign out"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '7px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.3)', transition: 'background-color 0.15s, color 0.15s' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(214,69,69,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = '#EF8A8A'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.3)'; }}
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

function NavLinkDirect({ href, label, icon, active }: { href: string; label: string; icon: React.ReactNode; active: boolean }) {
  return (
    <div style={{ position: 'relative' }}>
      <Link
        href={href}
        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', fontWeight: 500, fontFamily: 'Raleway, sans-serif', backgroundColor: active ? 'rgba(47,111,78,0.25)' : 'transparent', color: active ? '#7CC49A' : 'rgba(255,255,255,0.55)', transition: 'background-color 0.15s, color 0.15s', whiteSpace: 'nowrap' }}
        onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.85)'; } }}
        onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.55)'; } }}
      >
        <span style={{ opacity: 0.75 }}>{icon}</span>
        {label}
      </Link>
      {active && <div style={{ position: 'absolute', bottom: '-2px', left: '10px', right: '10px', height: '2px', borderRadius: '1px', backgroundColor: '#2F6F4E' }} />}
    </div>
  );
}
