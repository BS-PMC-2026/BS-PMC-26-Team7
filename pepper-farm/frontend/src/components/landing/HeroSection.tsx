'use client';

import { useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  motion,
  useTransform,
  AnimatePresence,
  useMotionValue,
  useSpring,
  MotionValue,
} from 'framer-motion';
import { ShoppingBag, MapPin, ChevronDown } from 'lucide-react';
import FloatingPepper from '@/components/ui/FloatingPepper';

const PEPPER_PARTICLES = [
  { x: 10, delay: 0,   size: 16 },
  { x: 25, delay: 1.3, size: 24 },
  { x: 40, delay: 2.6, size: 16 },
  { x: 55, delay: 3.9, size: 32 },
  { x: 70, delay: 5.2, size: 16 },
  { x: 85, delay: 6.5, size: 24 },
];

interface HeroSectionProps {
  /** Shared scroll spring progress (0–1) for parallax */
  smoothProgress: MotionValue<number>;
  /** Raw scroll progress (0–1) for scroll indicator fade */
  scrollYProgress: MotionValue<number>;
}

/**
 * Full-screen hero section with:
 * - Slowed looping video background (/field_background.mp4)
 * - Gradient overlay
 * - Floating pepper particles
 * - Cursor glow
 * - Parallax headline + CTAs
 * - Scroll indicator
 */
export default function HeroSection({ smoothProgress, scrollYProgress }: HeroSectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  /* Slow the video down and restart seamlessly */
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    // React doesn't always forward the `muted` JSX prop to the DOM attribute,
    // so set it imperatively to ensure autoplay is allowed by the browser.
    vid.muted = true;
    vid.playbackRate = 0.7;
    vid.play().catch(() => { /* autoplay blocked — silently ignore */ });
    const handleEnded = () => { vid.currentTime = 0; vid.play(); };
    vid.addEventListener('ended', handleEnded);
    return () => vid.removeEventListener('ended', handleEnded);
  }, []);

  /* Parallax */
  const heroY       = useTransform(smoothProgress, [0, 0.3], [0, -80]);
  const heroOpacity = useTransform(smoothProgress, [0, 0.25], [1, 0]);

  /* Cursor glow */
  const cursorX = useMotionValue(-300);
  const cursorY = useMotionValue(-300);
  const springX = useSpring(cursorX, { stiffness: 80, damping: 20 });
  const springY = useSpring(cursorY, { stiffness: 80, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    cursorX.set(e.clientX - rect.left);
    cursorY.set(e.clientY - rect.top);
  };

  return (
    <motion.section
      className="relative min-h-screen flex flex-col items-center justify-center text-center overflow-hidden px-6"
      onMouseMove={handleMouseMove}
    >
      {/* z-[0] — Video */}
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
          background:
            'linear-gradient(to bottom, rgba(5,46,22,0.60) 0%, rgba(5,46,22,0.40) 50%, rgba(240,253,244,0.97) 100%)',
        }}
        aria-hidden="true"
      />

      {/* z-[2] — Pepper particles */}
      <div className="absolute inset-0 z-[2] overflow-hidden" aria-hidden="true">
        {PEPPER_PARTICLES.map((p, i) => (
          <FloatingPepper key={i} x={p.x} delay={p.delay} size={p.size} />
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

      {/* z-[10] — Content */}
      <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-[10] max-w-4xl mx-auto">
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
  );
}
