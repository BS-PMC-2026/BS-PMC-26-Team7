'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaf, Menu as MenuIcon, X } from 'lucide-react';
import NavMenu, { IMenu } from '@/components/ui/navbar';

const NAV_ITEMS: IMenu[] = [
  { id: 1, title: 'Peppers', url: '/#peppers', dropdown: false },
  {
    id: 2,
    title: 'Explore',
    url: '#',
    dropdown: true,
    items: [
      { id: 21, title: 'Farm Map', url: '/visitor/map' },
      { id: 22, title: 'Products', url: '/visitor/products' },
      { id: 23, title: 'All Varieties', url: '/visitor/peppers/1' },
    ],
  },
  { id: 3, title: 'Our Farm', url: '/#farm', dropdown: false },
];

const MOBILE_LINKS = [
  { label: 'Peppers', href: '/#peppers' },
  { label: 'Farm', href: '/#farm' },
  { label: 'Products', href: '/visitor/products' },
  { label: 'Farm Map', href: '/visitor/map' },
];

interface LandingNavbarProps {
  /** Whether the page has been scrolled past the hero (drives visual state) */
  scrolled: boolean;
}

/**
 * Fixed top navbar for the landing page.
 * Two visual states: transparent/dark overlay (over video) ↔ white frosted (scrolled).
 * Desktop: logo + NavMenu component + auth buttons.
 * Mobile: hamburger → animated slide-down panel.
 */
export default function LandingNavbar({ scrolled }: LandingNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <motion.header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-green-100'
          : 'bg-black/30 backdrop-blur-sm border-b border-white/10'
      }`}
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 cursor-pointer shrink-0">
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
        </Link>

        {/* Desktop — NavMenu */}
        <div
          className={`hidden md:flex text-sm font-medium transition-colors duration-300 ${
            scrolled ? 'text-green-800' : 'text-white'
          }`}
        >
          <NavMenu list={NAV_ITEMS} />
        </div>

        {/* Auth buttons — desktop */}
        <div className="hidden md:flex items-center gap-2">
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/login"
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150 cursor-pointer border ${
                scrolled
                  ? 'text-green-700 border-green-200 hover:bg-green-50'
                  : 'text-white border-white/30 hover:bg-white/10'
              }`}
            >
              Sign In
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/register"
              className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors duration-150 cursor-pointer"
            >
              Get Started
            </Link>
          </motion.div>
        </div>

        {/* Hamburger — mobile */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          className={`md:hidden p-2 rounded-lg transition-colors cursor-pointer ${
            scrolled
              ? 'text-green-800 hover:bg-green-100'
              : 'text-white hover:bg-white/10'
          }`}
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          <AnimatePresence mode="wait" initial={false}>
            {mobileOpen ? (
              <motion.span
                key="x"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <X className="w-5 h-5" />
              </motion.span>
            ) : (
              <motion.span
                key="m"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <MenuIcon className="w-5 h-5" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Mobile slide-down panel */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-nav"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden bg-white/95 backdrop-blur-md border-t border-green-100 md:hidden"
          >
            <div className="flex flex-col px-6 py-4 gap-1">
              {MOBILE_LINKS.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ x: -16, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="block py-2.5 px-3 text-sm font-medium text-green-800 hover:bg-green-50 rounded-lg transition-colors cursor-pointer"
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
              <div className="border-t border-green-100 mt-2 pt-3 flex gap-2">
                <Link
                  href="/login"
                  className="flex-1 text-center py-2 text-sm font-medium text-green-700 border border-green-200 rounded-lg hover:bg-green-50 cursor-pointer"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="flex-1 text-center py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 cursor-pointer"
                >
                  Register
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
