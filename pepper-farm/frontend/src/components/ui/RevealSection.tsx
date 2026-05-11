'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

interface RevealSectionProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger delay in seconds */
  delay?: number;
  /** Pixels from viewport edge to trigger reveal */
  margin?: string;
}

/**
 * Scroll-aware fade-up reveal wrapper.
 * Wraps any children and animates them in once they enter the viewport.
 */
export default function RevealSection({
  children,
  className = '',
  delay = 0,
  margin = '-80px 0px',
}: RevealSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: margin as Parameters<typeof useInView>[1]['margin'] });

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
