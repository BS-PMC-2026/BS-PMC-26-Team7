'use client';

import { motion } from 'framer-motion';

interface FloatingPepperProps {
  /** Animation start delay in seconds */
  delay?: number;
  /** Horizontal position as a percentage (0–100) */
  x?: number;
  /** Font size in pixels */
  size?: number;
}

/**
 * Animated floating pepper emoji particle.
 * Rises from the bottom, rotates, and fades — loops infinitely.
 * Used as a decorative background element (pointer-events: none).
 */
export default function FloatingPepper({ delay = 0, x = 0, size = 24 }: FloatingPepperProps) {
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
