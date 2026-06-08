'use client';

import { useScroll, useSpring, useTransform, motion } from 'framer-motion';

import LandingNavbar      from '@/components/landing/LandingNavbar';
import HeroSection        from '@/components/landing/HeroSection';
import StatsSection       from '@/components/landing/StatsSection';
import PeppersGridSection from '@/components/landing/PeppersGridSection';
import FarmStorySection   from '@/components/landing/FarmStorySection';
import MapTeaserSection   from '@/components/landing/MapTeaserSection';
import Footer             from '@/components/landing/Footer';

/**
 * Landing page — composes all landing section components.
 * This file intentionally contains no UI markup; all sections live
 * in src/components/landing/ for independent extension.
 */
export default function LandingPage() {
  /* Shared scroll state — passed down to Hero for parallax */
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  return (
    <div className="app-page-bg overflow-x-hidden">

      {/* Scroll progress bar */}
      <motion.div
        className="fixed top-0 left-0 h-0.5 bg-gradient-to-r from-green-600 via-yellow-500 to-red-500 z-50 origin-left"
        style={{ scaleX: scrollYProgress, transformOrigin: '0%' }}
      />

      {/* Navbar is always rendered in its stable white state (no scroll-driven switch) */}
      <LandingNavbar scrolled />

      <HeroSection smoothProgress={smoothProgress} scrollYProgress={scrollYProgress} />

      <StatsSection />

      <PeppersGridSection />

      <FarmStorySection />

      <MapTeaserSection />

      <Footer />
    </div>
  );
}
