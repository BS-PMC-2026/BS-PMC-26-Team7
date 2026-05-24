'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Flame, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface PepperVarietyCardProps {
  /** Display name of the pepper variety */
  name: string;
  /** Heat level 1–5 (renders filled Flame icons) */
  heat: number;
  /** Short description */
  description: string;
  /** Accent color for the top stripe (hex or CSS color) */
  color: string;
  /** Stagger delay in seconds */
  delay?: number;
  /** Optional click / link href */
  href?: string;
}

/**
 * Pepper variety preview card.
 * Used in the landing page varieties grid and any pepper catalog listings.
 * Shows a colored stripe, name, heat level (flames), description, and an "Explore" link row.
 */
export default function PepperVarietyCard({
  name,
  heat,
  description,
  color,
  delay = 0,
  href,
}: PepperVarietyCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px 0px' });
  const { t } = useLanguage();

  const inner = (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6, boxShadow: '0 16px 40px -8px rgba(21,128,61,0.18)' }}
      whileTap={{ scale: 0.98 }}
      className="group relative bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden cursor-pointer"
    >
      {/* Color stripe */}
      <div className="h-2 w-full" style={{ backgroundColor: color }} />

      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <h3
            className="text-lg font-semibold text-green-900"
            style={{ fontFamily: 'Lora, serif' }}
          >
            {name}
          </h3>
          {/* Heat flames */}
          <div className="flex gap-0.5 shrink-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <Flame
                key={i}
                className={`w-3.5 h-3.5 ${i < heat ? 'text-red-500' : 'text-gray-200'}`}
              />
            ))}
          </div>
        </div>

        <p
          className="text-sm text-gray-600 leading-relaxed"
          style={{ fontFamily: 'Raleway, sans-serif' }}
        >
          {description}
        </p>

        <motion.div
          className="mt-4 flex items-center gap-1 text-xs font-medium text-green-700"
          whileHover={{ gap: '0.5rem' }}
        >
          <span>{t.landing.exploreVariety}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </motion.div>
      </div>
    </motion.div>
  );

  if (href) {
    return <a href={href}>{inner}</a>;
  }

  return inner;
}
