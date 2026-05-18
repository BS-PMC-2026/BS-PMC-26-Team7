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
import LanguageSwitcher from '@/components/LanguageSwitcher';

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
  critical: 'text-red-500',
  high:     'text-amber-500',
  medium:   'text-blue-500',
  low:      'text-gray-300',
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
    <motion.header
      ref={navRef as React.RefObject<HTMLElement>}
      dir="ltr"
      className={`fixed top-0 left-0 right-0 z-[9999] transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-green-100'
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
                ? 'text-green-600 bg-green-50 border-green-200'
                : 'text-white/50 bg-white/10 border-white/20'
            }`}
          >
            Worker
          </span>
        </Link>

        {/* Divider */}
        <div className={`w-px h-5 mx-1.5 shrink-0 ${scrolled ? 'bg-green-200' : 'bg-white/20'}`} />

        <NavLinkDirect href="/worker"              label="Dashboard"    icon={<LayoutDashboard size={14} />} active={pathname === '/worker'}                          scrolled={scrolled} />
        <NavLinkDirect href="/worker/my-tasks"     label="My Tasks"     icon={<ClipboardList size={14} />}   active={pathname.startsWith('/worker/my-tasks')}         scrolled={scrolled} />
        <NavLinkDirect href="/worker/products"     label="Products"     icon={<ShoppingBag size={14} />}     active={pathname.startsWith('/worker/products')}         scrolled={scrolled} />
        <NavLinkDirect href="/worker/spray-report" label="Spray Report" icon={<Droplets size={14} />}        active={pathname.startsWith('/worker/spray-report')}     scrolled={scrolled} />

        {/* Plants dropdown */}
        {NAV_GROUPS.map((group) => {
          const active = isGroupActive(group);
          const open   = openGroup === group.id;
          return (
            <div key={group.id} className="relative"
              onMouseEnter={() => { cancelClose(); setOpenGroup(group.id); setBellOpen(false); }}
              onMouseLeave={scheduleClose}
            >
              <button
                onClick={() => { setOpenGroup(open ? null : group.id); setBellOpen(false); }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-none cursor-pointer text-sm font-medium transition-colors duration-150 whitespace-nowrap outline-none select-none ${
                  active || open
                    ? scrolled ? 'text-green-700 bg-green-50' : 'text-white bg-white/10'
                    : scrolled ? 'text-green-800 opacity-70 hover:opacity-100 hover:bg-green-50' : 'text-white opacity-60 hover:opacity-100 hover:bg-white/10'
                }`}
                style={{ fontFamily: 'Raleway, sans-serif' }}
              >
                <span className="opacity-80">{group.icon}</span>
                {group.label}
                <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18, ease: 'easeOut' }} className="flex opacity-50">
                  <ChevronDown size={12} />
                </motion.span>
              </button>

              {active && <div className={`absolute bottom-[-2px] left-2.5 right-2.5 h-0.5 rounded-sm ${scrolled ? 'bg-green-600' : 'bg-white/60'}`} />}

              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                    onMouseEnter={cancelClose}
                    onMouseLeave={scheduleClose}
                    className="absolute top-[calc(100%+8px)] left-0 min-w-[224px] rounded-xl border border-gray-100 bg-white overflow-hidden z-[100]"
                    style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)' }}
                  >
                    <div className="p-1.5">
                      {group.items.map((item) => {
                        const itemActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                          <Link key={item.href} href={item.href}
                            className={`flex items-start gap-2.5 px-2.5 py-2 rounded-lg no-underline transition-colors duration-100 ${
                              itemActive ? 'bg-green-50' : 'hover:bg-gray-50'
                            }`}
                          >
                            <span className={`mt-0.5 shrink-0 ${itemActive ? 'text-green-600' : 'text-gray-400'}`}>{item.icon}</span>
                            <span>
                              <span className={`block text-sm font-medium leading-snug ${itemActive ? 'text-green-700' : 'text-gray-700'}`} style={{ fontFamily: 'Raleway, sans-serif' }}>
                                {item.label}
                              </span>
                              {item.description && (
                                <span className="block text-[11px] text-gray-400 mt-0.5 leading-snug">{item.description}</span>
                              )}
                            </span>
                            {itemActive && <span className="ml-auto mt-1 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />}
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
        <div className="flex-1" />

        {/* Bell */}
        <div className="relative">
          <button
            onClick={handleBellClick}
            aria-label="Task notifications"
            aria-expanded={bellOpen}
            className={`relative flex items-center justify-center w-8 h-8 rounded-lg border-none cursor-pointer transition-colors duration-150 ${
              bellOpen
                ? scrolled ? 'bg-green-50 text-green-700' : 'bg-white/15 text-white'
                : unreadCount > 0
                  ? scrolled ? 'text-red-500 hover:bg-red-50' : 'text-red-300 hover:bg-white/10'
                  : scrolled ? 'text-gray-400 hover:bg-gray-100 hover:text-gray-600' : 'text-white/50 hover:bg-white/10 hover:text-white'
            }`}
          >
            <motion.span
              animate={unreadCount > 0 && !bellOpen ? { rotate: [0, -15, 12, -8, 5, 0] } : {}}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              className="flex"
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
                  className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none"
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
                className="absolute top-[calc(100%+10px)] right-0 w-[320px] rounded-xl border border-gray-100 bg-white overflow-hidden z-[100]"
                style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-3.5 py-3 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-800" style={{ fontFamily: 'Raleway, sans-serif' }}>
                    My Tasks
                    {unreadCount > 0 && (
                      <span className="ml-1.5 text-[10px] font-bold text-red-400">
                        {unreadCount} new
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => setBellOpen(false)}
                    className="flex p-0.5 rounded border-none bg-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>

                {/* Section */}
                <div className="px-3.5 pt-2.5 pb-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400">
                      {newTasks.length > 0 ? 'Newly Assigned' : 'Active Tasks'}
                    </span>
                    <Link
                      href="/worker/my-tasks"
                      onClick={() => setBellOpen(false)}
                      className="text-[10px] text-green-600 no-underline hover:text-green-700 opacity-80"
                    >
                      View all
                    </Link>
                  </div>

                  {popupTasks.length === 0 ? (
                    <p className="text-xs text-gray-400 py-1.5 pb-3 italic">No active tasks assigned to you</p>
                  ) : (
                    <div className="flex flex-col gap-0.5 pb-2">
                      {popupTasks.map((task) => (
                        <Link
                          key={task.id}
                          href="/worker/my-tasks"
                          onClick={() => setBellOpen(false)}
                          className="flex items-start gap-2.5 px-2 py-1.5 rounded-lg no-underline hover:bg-gray-50 transition-colors"
                        >
                          <span className={`mt-0.5 shrink-0 ${PRIORITY_COLOR[task.priority] ?? 'text-gray-300'}`}>
                            <ClipboardCheck size={13} />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-xs font-medium text-gray-700 leading-snug truncate">
                              {task.title}
                            </span>
                            <span className="block text-[10px] text-gray-400 mt-0.5">
                              {[task.taskType, task.zoneCode].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                          <span className="shrink-0 text-[10px] text-gray-300 mt-0.5">
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

        {/* Language switcher */}
        <LanguageSwitcher />

        {/* Divider */}
        <div className={`w-px h-4.5 mx-1 ${scrolled ? 'bg-gray-200' : 'bg-white/20'}`} />

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Sign out"
          aria-label="Sign out"
          className={`flex items-center justify-center w-8 h-8 rounded-lg border-none cursor-pointer transition-colors duration-150 ${
            scrolled
              ? 'text-gray-400 hover:bg-red-50 hover:text-red-500'
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
            ? scrolled ? 'text-green-700 bg-green-50' : 'text-white bg-white/10'
            : scrolled ? 'text-green-800 opacity-70 hover:opacity-100 hover:bg-green-50 hover:text-green-800' : 'text-white opacity-60 hover:opacity-100 hover:bg-white/10 hover:text-white'
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
