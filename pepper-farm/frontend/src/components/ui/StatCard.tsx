'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

interface StatCardProps {
  /** Large display value e.g. "30+", "98%" */
  value: string;
  /** Label below the value */
  label: string;
  /** Icon element rendered in the icon bubble */
  icon: React.ReactNode;
  /** Stagger delay in seconds */
  delay?: number;
}

/**
 * Animated stat card.
 * Springs in on scroll entry with a subtle bounce. Lifts on hover.
 * Used in the landing page stats strip and any summary dashboards.
 */
export default function StatCard({ value, label, icon, delay = 0 }: StatCardProps) {
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
      <div className="w-10 h-10 rounded-full bg-[var(--color-secondary-light)] flex items-center justify-center text-[var(--color-primary)]">
        {icon}
      </div>
      <span className="text-3xl font-bold text-[var(--color-foreground)]">
        {value}
      </span>
      <span className="text-sm text-[var(--color-primary)] text-center">
        {label}
      </span>
    </motion.div>
  );
}
