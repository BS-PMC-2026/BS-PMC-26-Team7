'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Leaf, LogOut, MapPin, Menu, ShoppingBag, ShoppingCart, X } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {
  getMyNotifications,
  getUnreadCount,
  markAllNotificationsRead,
} from '@/services/notificationsService';
import type { AppNotification } from '@/services/notificationsService';
import { getCart } from '@/services/cartService';
import BackButton from '@/components/ui/BackButton';

export default function VisitorLayout({ children }: { children: ReactNode }) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const showBackButton = pathname !== '/visitor';

  const [bellOpen, setBellOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  /* Navbar is always in its stable white state — no scroll-driven style switch (BSPMT7-486). */
  const scrolled = true;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    getCart()
      .then((cart) => setCartCount(cart.items.reduce((sum, item) => sum + item.quantity, 0)))
      .catch(() => {});
  }, [pathname]);

  useEffect(() => {
    setBellOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const { unreadCount } = await getUnreadCount();
        if (!cancelled) setUnread(unreadCount);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function openBell() {
    setBellOpen(true);
    setLoading(true);
    try {
      const list = await getMyNotifications();
      setNotifs(list);
      setUnread(list.filter((n) => !n.isRead).length);
    } catch {}
    finally {
      setLoading(false);
    }
  }

  async function handleMarkAll() {
    try {
      await markAllNotificationsRead();
      setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
    } catch {}
  }

  function handleLogout() {
    localStorage.removeItem('token');
    router.push('/login');
  }

  return (
    <>
      <motion.header
        className={`fixed top-0 left-0 right-0 z-[9999] transition-all duration-300 ${
          scrolled
            ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-[var(--color-border)]'
            : 'bg-black/30 backdrop-blur-sm border-b border-white/10'
        }`}
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-1">
          <Link href="/visitor" className="flex items-center gap-2 shrink-0 mr-3 no-underline">
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
            >
              {locale === 'he' ? 'הדינרים' : 'Hadinerim'}
            </span>
          </Link>

          <button
            type="button"
            onClick={() => { setMobileMenuOpen((open) => !open); setBellOpen(false); }}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            className={`ml-auto flex md:hidden items-center justify-center w-9 h-9 rounded-lg border-none cursor-pointer transition-colors duration-150 ${
              mobileMenuOpen
                ? scrolled ? 'bg-[var(--color-secondary-light)] text-[var(--color-primary)]' : 'bg-white/15 text-white'
                : scrolled ? 'text-green-900 hover:bg-[var(--color-secondary-light)]' : 'text-white/80 hover:bg-white/10'
            }`}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <div className={`hidden md:block w-px h-5 mx-1.5 shrink-0 ${scrolled ? 'bg-green-200' : 'bg-white/20'}`} />

          <div className="hidden md:flex items-center gap-1 flex-1 min-w-0 overflow-visible">
          <VisitorNavLink href="/visitor" label={t.nav.dashboard} icon={<Leaf size={14} />} active={pathname === '/visitor'} scrolled={scrolled} />
          <VisitorNavLink href="/visitor/products" label={t.nav.products} icon={<ShoppingBag size={14} />} active={pathname.startsWith('/visitor/products')} scrolled={scrolled} />
          <VisitorNavLink href="/visitor/map" label={t.landing.navFarmMap} icon={<MapPin size={14} />} active={pathname.startsWith('/visitor/map')} scrolled={scrolled} />
          </div>

          <Link
            href="/cart"
            className={`relative hidden md:flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer transition-colors duration-150 shrink-0 ${
              pathname.startsWith('/cart')
                ? scrolled ? 'bg-[var(--color-secondary-light)] text-[var(--color-primary)]' : 'bg-white/15 text-white'
                : scrolled ? 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]' : 'text-white/50 hover:bg-white/10 hover:text-white'
            }`}
            data-testid="visitor-cart-icon"
          >
            <ShoppingCart size={15} />
            {cartCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-green-600 text-white text-[9px] font-bold flex items-center justify-center" data-testid="cart-badge">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>

          <div className="relative hidden md:block shrink-0">
            <button
              onClick={() => bellOpen ? setBellOpen(false) : openBell()}
              aria-label={t.appNotifications.notificationBell}
              className={`relative flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer transition-colors duration-150 ${
                bellOpen
                  ? scrolled ? 'bg-[var(--color-secondary-light)] text-[var(--color-primary)]' : 'bg-white/15 text-white'
                  : unread > 0
                    ? scrolled ? 'text-red-500 hover:bg-[var(--color-error-bg)]' : 'text-red-300 hover:bg-white/10'
                    : scrolled ? 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]' : 'text-white/50 hover:bg-white/10 hover:text-white'
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

          <Link
            href="/profile/orders"
            className={`hidden md:flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap shrink-0 ${
              pathname.startsWith('/profile/orders')
                ? scrolled ? 'text-[var(--color-primary)] bg-[var(--color-secondary-light)]' : 'text-white bg-white/10'
                : scrolled ? 'text-green-800 opacity-70 hover:opacity-100 hover:bg-[var(--color-secondary-light)]' : 'text-white/60 hover:opacity-100 hover:bg-white/10 hover:text-white'
            }`}
          >
            My Orders
          </Link>

          <div className="hidden md:block shrink-0">
            <LanguageSwitcher />
          </div>

          <div className={`hidden md:block w-px h-4.5 mx-1 shrink-0 ${scrolled ? 'bg-[var(--color-border)]' : 'bg-white/20'}`} />

          <button
            onClick={handleLogout}
            aria-label="Sign out"
            className={`hidden md:flex items-center justify-center w-8 h-8 rounded-lg border-none cursor-pointer transition-colors duration-150 shrink-0 ${
              scrolled
                ? 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-error-bg)] hover:text-red-500'
                : 'text-white/40 hover:bg-white/10 hover:text-white/80'
            }`}
          >
            <LogOut size={14} />
          </button>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="md:hidden border-t border-white/10 bg-white/95 backdrop-blur-md shadow-xl"
            >
              <div className="mx-auto max-w-7xl px-4 py-3">
                <div className="flex max-h-[calc(100vh-5rem)] flex-col gap-1 overflow-y-auto">
                  <MobileVisitorNavLink href="/visitor/products" label={t.nav.products} icon={<ShoppingBag size={15} />} active={pathname.startsWith('/visitor/products')} />
                  <MobileVisitorNavLink href="/visitor/map" label={t.landing.navFarmMap} icon={<MapPin size={15} />} active={pathname.startsWith('/visitor/map')} />
                  <MobileVisitorNavLink href="/cart" label="Cart" icon={<ShoppingCart size={15} />} active={pathname.startsWith('/cart')} badge={cartCount} />
                  <MobileVisitorNavLink href="/profile/orders" label="My Orders" icon={<ShoppingBag size={15} />} active={pathname.startsWith('/profile/orders')} />
                  <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                    <LanguageSwitcher />
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      <LogOut size={15} />
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      <div className="app-page-bg" style={{ paddingTop: '64px', minHeight: '100vh' }}>
        {showBackButton && (
          <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <BackButton fallbackHref="/visitor" />
          </div>
        )}
        {children}
      </div>
    </>
  );
}

function VisitorNavLink({
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

function MobileVisitorNavLink({
  href,
  label,
  icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium no-underline transition-colors ${
        active
          ? 'bg-[var(--color-secondary-light)] text-[var(--color-primary)]'
          : 'text-[var(--color-foreground)] hover:bg-[var(--color-muted)]'
      }`}
    >
      <span className="opacity-75">{icon}</span>
      <span>{label}</span>
      {!!badge && badge > 0 && (
        <span className="ml-auto min-w-[18px] rounded-full bg-green-600 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}
