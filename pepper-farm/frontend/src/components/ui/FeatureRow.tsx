'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

interface FeatureRowProps {
  /** Icon element (e.g. lucide-react icon) */
  icon: React.ReactNode;
  /** Feature title */
  title: string;
  /** Feature body text */
  body: string;
  /** Reverse the icon/text layout (icon on right) */
  reverse?: boolean;
  /** Stagger delay in seconds */
  delay?: number;
}

/**
 * Horizontal feature row with icon bubble and text.
 * Slides in from left (or right if `reverse`).
 * Used in the Farm Story / Process section.
 */
export default function FeatureRow({
  icon,
  title,
  body,
  reverse = false,
  delay = 0,
}: FeatureRowProps) {
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
        <h3
          className="text-xl font-semibold text-white mb-2"
        >
          {title}
        </h3>
        <p
          className="text-green-100/90 leading-relaxed max-w-lg"
        >
          {body}
        </p>
      </div>
    </motion.div>
  );
}
