'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  AnimatePresence,
  useMotionValue,
  useSpring,
} from 'framer-motion';
import {
  Leaf, Flame, MapPin, ShoppingBag, ChevronDown,
  ArrowRight, Sprout, Sun, Droplets, Menu as MenuIcon, X,
} from 'lucide-react';
import NavMenu, { IMenu } from '@/components/ui/navbar';

/* ─── Nav items shared with Menu component ─── */
const NAV_ITEMS: IMenu[] = [
  { id: 1, title: 'Peppers', url: '/#peppers', dropdown: false },
  {
    id: 2, title: 'Explore', url: '#', dropdown: true,
    items: [
      { id: 21, title: 'Farm Map', url: '/visitor/map' },
      { id: 22, title: 'Products', url: '/visitor/products' },
      { id: 23, title: 'All Varieties', url: '/visitor/peppers/1' },
    ],
  },
  { id: 3, title: 'Our Farm', url: '/#farm', dropdown: false },
];

/* ─── Scroll-aware reveal wrapper ─── */
function RevealSection({ children, className = '', delay = 0 }: {
  children: React.ReactNode; className?: string; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px 0px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 48 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Floating pepper particle ─── */
function FloatingPepper({ delay = 0, x = 0, size = 24 }: { delay?: number; x?: number; size?: number }) {
  return (
    <motion.div
      className="absolute pointer-events-none select-none"
      style={{ left: `${x}%`, bottom: '-60px', fontSize: size }}
      animate={{ y: [0, -1080], rotate: [0, 360], opacity: [0, 0.7, 0] }}
      transition={{ duration: 8 + delay, delay, repeat: Infinity, ease: 'linear' }}
      aria-hidden="true"
    >
      🌶
    </motion.div>
  );
}

/* ─── Stat card — springs in on view ─── */
function StatCard({ value, label, icon, delay = 0 }: {
  value: string; label: string; icon: React.ReactNode; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  return (
    <motion.div
      ref={ref}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={isInView ? { scale: 1, opacity: 1 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.34, 1.56, 0.64, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="flex flex-col items-center gap-2 p-6 bg-white/70 backdrop-blur-sm rounded-2xl border border-green-100 shadow-sm cursor-default"
    >
      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700">
        {icon}
      </div>
      <span className="text-3xl font-bold text-green-800" style={{ fontFamily: 'Lora, serif' }}>{value}</span>
      <span className="text-sm text-green-600 text-center" style={{ fontFamily: 'Raleway, sans-serif' }}>{label}</span>
    </motion.div>
  );
}

/* ─── Pepper variety card ─── */
function PepperVarietyCard({ name, heat, description, color, delay = 0 }: {
  name: string; heat: number; description: string; color: string; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px 0px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6, boxShadow: '0 16px 40px -8px rgba(21,128,61,0.18)' }}
      whileTap={{ scale: 0.98 }}
      className="group relative bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden cursor-pointer"
    >
      <div className="h-2 w-full" style={{ backgroundColor: color }} />
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-green-900" style={{ fontFamily: 'Lora, serif' }}>{name}</h3>
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Flame key={i} className={`w-3.5 h-3.5 ${i < heat ? 'text-red-500' : 'text-gray-200'}`} />
            ))}
          </div>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed" style={{ fontFamily: 'Raleway, sans-serif' }}>
          {description}
        </p>
        <motion.div
          className="mt-4 flex items-center gap-1 text-xs font-medium text-green-700"
          whileHover={{ gap: '0.5rem' }}
        >
          <span>Explore variety</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ─── Feature row — slides in from side ─── */
function FeatureRow({ icon, title, body, reverse = false, delay = 0 }: {
  icon: React.ReactNode; title: string; body: string; reverse?: boolean; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px 0px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: reverse ? 48 : -48 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`flex flex-col md:flex-row items-center gap-8 ${reverse ? 'md:flex-row-reverse' : ''}`}
    >
      <motion.div
        whileHover={{ rotate: [0, -8, 8, 0], transition: { duration: 0.5 } }}
        className="flex-shrink-0 w-24 h-24 rounded-3xl bg-green-100 flex items-center justify-center text-green-700 shadow-sm cursor-default"
      >
        {icon}
      </motion.div>
      <div>
        <h3 className="text-xl font-semibold text-green-900 mb-2" style={{ fontFamily: 'Lora, serif' }}>{title}</h3>
        <p className="text-gray-600 leading-relaxed max-w-lg" style={{ fontFamily: 'Raleway, sans-serif' }}>{body}</p>
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════
   PAGE
════════════════════════════════════════════ */
export default function LandingPage() {
  /* Scroll progress */
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const heroY = useTransform(smoothProgress, [0, 0.3], [0, -80]);
  const heroOpacity = useTransform(smoothProgress, [0, 0.25], [1, 0]);
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  /* Navbar scroll state */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const unsub = scrollYProgress.on('change', (v) => setScrolled(v > 0.02));
    return unsub;
  }, [scrollYProgress]);

  /* Mobile menu */
  const [mobileOpen, setMobileOpen] = useState(false);

  /* Video background — 0.7× speed, seamless loop */
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.playbackRate = 0.7;
    const handleEnded = () => {
      vid.currentTime = 0;
      vid.play();
    };
    vid.addEventListener('ended', handleEnded);
    return () => vid.removeEventListener('ended', handleEnded);
  }, []);

  /* Cursor glow (hero only) */
  const cursorX = useMotionValue(-300);
  const cursorY = useMotionValue(-300);
  const springX = useSpring(cursorX, { stiffness: 80, damping: 20 });
  const springY = useSpring(cursorY, { stiffness: 80, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    cursorX.set(e.clientX - rect.left);
    cursorY.set(e.clientY - rect.top);
  };

  const peppers = [
    { name: 'Jalapeño Mexicano', heat: 2, color: '#15803d', description: 'Mild, versatile and crisp — perfect for fresh salsas, pickles and everyday cooking.' },
    { name: 'Habanero Gold',     heat: 4, color: '#ca8a04', description: 'Fruity, floral with intense Caribbean heat. Our signature premium variety.' },
    { name: 'Carolina Reaper',   heat: 5, color: '#dc2626', description: 'World-record heat meets complex fruity depth. Only for the truly brave.' },
    { name: 'Shishito',          heat: 1, color: '#4ade80', description: 'Delicate Japanese variety — sweet and thin-skinned, perfect for blistering.' },
    { name: 'Anaheim Sunrise',   heat: 2, color: '#f97316', description: 'California-grown, mildly smoky and incredibly versatile for roasting.' },
    { name: 'Ghost Pepper',      heat: 5, color: '#7c3aed', description: 'Bhut jolokia — the ghost that haunts your palate for hours after each bite.' },
  ];

  return (
    <div className="min-h-screen bg-[#f0fdf4] overflow-x-hidden" style={{ fontFamily: 'Raleway, sans-serif' }}>

      {/* ── Scroll progress bar ── */}
      <motion.div
        className="fixed top-0 left-0 h-0.5 bg-gradient-to-r from-green-600 via-yellow-500 to-red-500 z-50 origin-left"
        style={{ scaleX: scrollYProgress, transformOrigin: '0%' }}
      />

      {/* ══════════════════════════════════════
          NAVBAR — uses <NavMenu> component
      ══════════════════════════════════════ */}
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
              className={`font-semibold text-lg transition-colors duration-300 ${scrolled ? 'text-green-900' : 'text-white'}`}
              style={{ fontFamily: 'Lora, serif' }}
            >
              PepperFarm
            </span>
          </Link>

          {/* Desktop — NavMenu component */}
          <div className={`hidden md:flex text-sm font-medium transition-colors duration-300 ${scrolled ? 'text-green-800' : 'text-white'}`}>
            <NavMenu list={NAV_ITEMS} />
          </div>

          {/* Auth buttons */}
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

          {/* Mobile hamburger */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            className={`md:hidden p-2 rounded-lg transition-colors cursor-pointer ${scrolled ? 'text-green-800 hover:bg-green-100' : 'text-white hover:bg-white/10'}`}
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            <AnimatePresence mode="wait" initial={false}>
              {mobileOpen
                ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X className="w-5 h-5" /></motion.span>
                : <motion.span key="m" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><MenuIcon className="w-5 h-5" /></motion.span>
              }
            </AnimatePresence>
          </motion.button>
        </div>

        {/* Mobile menu dropdown */}
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
                {[
                  { label: 'Peppers', href: '/#peppers' },
                  { label: 'Farm', href: '/#farm' },
                  { label: 'Products', href: '/visitor/products' },
                  { label: 'Farm Map', href: '/visitor/map' },
                ].map((item, i) => (
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
                  <Link href="/login" className="flex-1 text-center py-2 text-sm font-medium text-green-700 border border-green-200 rounded-lg hover:bg-green-50 cursor-pointer">Sign In</Link>
                  <Link href="/register" className="flex-1 text-center py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 cursor-pointer">Register</Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* ══════════════════════════════════════
          HERO
      ══════════════════════════════════════ */}
      <motion.section
        className="relative min-h-screen flex flex-col items-center justify-center text-center overflow-hidden px-6"
        onMouseMove={handleMouseMove}
      >
        {/* z-[0] — Video background (first in DOM = lowest layer) */}
        <video
          ref={videoRef}
          src="/field_background.mp4"
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
          className="absolute inset-0 z-0 w-full h-full object-cover"
          style={{ willChange: 'transform', transform: 'translateZ(0)' }}
        />

        {/* z-[1] — Gradient overlay */}
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background: 'linear-gradient(to bottom, rgba(5,46,22,0.60) 0%, rgba(5,46,22,0.40) 50%, rgba(240,253,244,0.97) 100%)',
          }}
          aria-hidden="true"
        />

{/* z-[2] — Floating pepper particles */}
        <div className="absolute inset-0 z-[2] overflow-hidden" aria-hidden="true">
          {[10, 25, 40, 55, 70, 85].map((x, i) => (
            <FloatingPepper key={i} x={x} delay={i * 1.3} size={16 + (i % 3) * 8} />
          ))}
        </div>

        {/* z-[3] — Cursor glow */}
        <motion.div
          className="absolute w-96 h-96 rounded-full pointer-events-none z-[3]"
          style={{
            x: springX,
            y: springY,
            translateX: '-50%',
            translateY: '-50%',
            background: 'radial-gradient(circle, rgba(134,239,172,0.25) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />

        {/* z-[10] — Hero content */}
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-[10] max-w-4xl mx-auto">
          {/* Headline — staggered words */}
          <motion.h1
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="text-5xl sm:text-6xl md:text-7xl font-bold text-white leading-tight mb-6 drop-shadow-lg"
            style={{ fontFamily: 'Lora, serif' }}
          >
            From our fields
            <br />
            <motion.em
              className="text-green-300 not-italic"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              to your table.
            </motion.em>
          </motion.h1>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="text-lg text-green-100 max-w-2xl mx-auto leading-relaxed mb-10 drop-shadow"
          >
            We grow over 30 pepper varieties with care, precision, and passion —
            from mild Shishito to the fearsome Carolina Reaper.
            Explore our farm, track every plant, taste the difference.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.65 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/visitor/products"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors duration-200 cursor-pointer shadow-lg shadow-green-200"
              >
                <ShoppingBag className="w-4 h-4" />
                Shop Peppers
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/visitor/map"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-semibold text-green-800 bg-white border border-green-200 rounded-xl hover:bg-green-50 transition-colors duration-200 cursor-pointer"
              >
                <MapPin className="w-4 h-4" />
                Tour the Farm
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/70 z-[10]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          <span className="text-xs font-medium tracking-widest uppercase">Scroll</span>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <ChevronDown className="w-5 h-5" />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* ══════════════════════════════════════
          STATS
      ══════════════════════════════════════ */}
      <motion.section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard delay={0}    value="30+" label="Pepper Varieties" icon={<Leaf className="w-5 h-5" />} />
            <StatCard delay={0.08} value="5ha" label="Farm Area"        icon={<Sprout className="w-5 h-5" />} />
            <StatCard delay={0.16} value="98%" label="Sun Hours"        icon={<Sun className="w-5 h-5" />} />
            <StatCard delay={0.24} value="Zero" label="Pesticides"      icon={<Droplets className="w-5 h-5" />} />
          </div>
        </div>
      </motion.section>

      {/* ══════════════════════════════════════
          PEPPERS GRID
      ══════════════════════════════════════ */}
      <motion.section id="peppers" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <RevealSection className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest text-green-500 uppercase mb-3">Our Varieties</p>
            <h2 className="text-4xl font-bold text-green-900" style={{ fontFamily: 'Lora, serif' }}>
              Every pepper tells a story
            </h2>
            <p className="mt-3 text-gray-500 max-w-xl mx-auto leading-relaxed">
              Thirty cultivars, each with its own personality, heat level, and culinary purpose.
              We grow them all with the same obsessive care.
            </p>
          </RevealSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {peppers.map((p, i) => (
              <PepperVarietyCard key={p.name} {...p} delay={i * 0.07} />
            ))}
          </div>

          <RevealSection className="mt-10 text-center">
            <motion.div whileHover={{ x: 4 }} className="inline-flex">
              <Link
                href="/visitor/peppers/1"
                className="inline-flex items-center gap-2 text-green-700 font-medium hover:text-green-900 transition-colors duration-150 cursor-pointer"
              >
                Browse all varieties <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </RevealSection>
        </div>
      </motion.section>

      {/* Wave divider */}
      <div className="w-full overflow-hidden leading-none" aria-hidden="true">
        <svg viewBox="0 0 1440 80" className="w-full fill-green-800">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" />
        </svg>
      </div>

      {/* ══════════════════════════════════════
          FARM STORY
      ══════════════════════════════════════ */}
      <motion.section id="farm" className="bg-green-800 py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <RevealSection className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest text-green-300 uppercase mb-3">Our Process</p>
            <h2 className="text-4xl font-bold text-white" style={{ fontFamily: 'Lora, serif' }}>
              Grown with intention
            </h2>
          </RevealSection>
          <div className="flex flex-col gap-14">
            <FeatureRow delay={0}   icon={<Sprout className="w-10 h-10" />}   title="Planted by hand"   body="Every seedling is started in our nursery and transplanted by hand into raised beds enriched with compost. No shortcuts, no machinery guesswork." />
            <FeatureRow delay={0.1} icon={<Droplets className="w-10 h-10" />} title="Smart irrigation"  body="Our drip-irrigation system delivers precise water at root level, monitored by soil sensors. Plants get exactly what they need — no more, no less." reverse />
            <FeatureRow delay={0.2} icon={<Sun className="w-10 h-10" />}      title="Harvested at peak" body="We track every plant from seed to harvest day. Peppers are picked at the exact moment of peak flavour and immediately packed for freshness." />
          </div>
        </div>
      </motion.section>

      {/* Wave divider (inverted) */}
      <div className="w-full overflow-hidden leading-none bg-green-800" aria-hidden="true">
        <svg viewBox="0 0 1440 80" className="w-full fill-[#f0fdf4]">
          <path d="M0,40 C360,0 1080,80 1440,40 L1440,80 L0,80 Z" />
        </svg>
      </div>

      {/* ══════════════════════════════════════
          MAP TEASER
      ══════════════════════════════════════ */}
      <motion.section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <RevealSection>
            <motion.div
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.3 }}
              className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-green-700 to-green-900 p-10 md:p-16 text-white shadow-2xl cursor-default"
            >
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/3 translate-x-1/3" aria-hidden="true" />
              <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-yellow-400/10 translate-y-1/3 -translate-x-1/3" aria-hidden="true" />

              <div className="relative z-10 flex flex-col md:flex-row items-center gap-10 justify-between">
                <div className="max-w-md">
                  <p className="text-xs font-semibold tracking-widest text-green-300 uppercase mb-3">Interactive</p>
                  <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'Lora, serif' }}>
                    Explore our farm map
                  </h2>
                  <p className="text-green-200 leading-relaxed mb-8">
                    Navigate every zone of PepperFarm. See which varieties grow where,
                    check plant health, and plan your visit.
                  </p>
                  <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                    <Link
                      href="/visitor/map"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 text-green-900 font-semibold rounded-xl hover:bg-yellow-300 transition-colors duration-200 cursor-pointer"
                    >
                      <MapPin className="w-4 h-4" />
                      Open Farm Map
                    </Link>
                  </motion.div>
                </div>

                {/* Animated mini-map */}
                <div className="w-64 h-48 rounded-2xl bg-green-600/40 border border-white/10 flex items-center justify-center backdrop-blur-sm shrink-0 overflow-hidden">
                  <div className="grid grid-cols-4 gap-2 p-4" aria-hidden="true">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-8 h-8 rounded-lg"
                        style={{ backgroundColor: ['#15803d','#22c55e','#4ade80','#ca8a04','#dc2626'][i % 5] }}
                        animate={{ opacity: [0.5, 0.9, 0.5] }}
                        transition={{ duration: 2 + (i % 3), repeat: Infinity, delay: i * 0.1 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </RevealSection>
        </div>
      </motion.section>

      {/* ══════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════ */}
      <motion.section className="py-24 px-6 text-center">
        <RevealSection className="max-w-2xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-green-500 uppercase mb-4">Join PepperFarm</p>
          <h2 className="text-4xl font-bold text-green-900 mb-5" style={{ fontFamily: 'Lora, serif' }}>
            Ready to taste the heat?
          </h2>
          <p className="text-gray-500 leading-relaxed mb-8">
            Create a free account to track your favourite varieties, get harvest
            notifications, and order directly from our farm.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors duration-200 cursor-pointer shadow-lg shadow-green-200"
              >
                Create Free Account
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/visitor/products"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-green-800 bg-white border border-green-200 rounded-xl hover:bg-green-50 transition-colors duration-200 cursor-pointer"
              >
                Browse Products
              </Link>
            </motion.div>
          </div>
        </RevealSection>
      </motion.section>

      {/* ══════════════════════════════════════
          FOOTER
      ══════════════════════════════════════ */}
      <footer className="border-t border-green-100 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-green-600 flex items-center justify-center">
              <Leaf className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-green-900 text-sm" style={{ fontFamily: 'Lora, serif' }}>PepperFarm</span>
          </div>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} PepperFarm. Grown with care in Israel.</p>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            {[
              { label: 'Login', href: '/login' },
              { label: 'Register', href: '/register' },
              { label: 'Farm Map', href: '/visitor/map' },
            ].map((l) => (
              <motion.div key={l.href} whileHover={{ y: -1 }}>
                <Link href={l.href} className="hover:text-green-600 transition-colors cursor-pointer">{l.label}</Link>
              </motion.div>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
