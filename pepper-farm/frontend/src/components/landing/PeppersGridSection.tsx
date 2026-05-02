'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import RevealSection from '@/components/ui/RevealSection';
import PepperVarietyCard from '@/components/ui/PepperVarietyCard';

export interface PepperVariety {
  name: string;
  heat: number;
  color: string;
  description: string;
}

const DEFAULT_PEPPERS: PepperVariety[] = [
  { name: 'Jalapeño Mexicano', heat: 2, color: '#15803d', description: 'Mild, versatile and crisp — perfect for fresh salsas, pickles and everyday cooking.' },
  { name: 'Habanero Gold',     heat: 4, color: '#ca8a04', description: 'Fruity, floral with intense Caribbean heat. Our signature premium variety.' },
  { name: 'Carolina Reaper',   heat: 5, color: '#dc2626', description: 'World-record heat meets complex fruity depth. Only for the truly brave.' },
  { name: 'Shishito',          heat: 1, color: '#4ade80', description: 'Delicate Japanese variety — sweet and thin-skinned, perfect for blistering.' },
  { name: 'Anaheim Sunrise',   heat: 2, color: '#f97316', description: 'California-grown, mildly smoky and incredibly versatile for roasting.' },
  { name: 'Ghost Pepper',      heat: 5, color: '#7c3aed', description: 'Bhut jolokia — the ghost that haunts your palate for hours after each bite.' },
];

interface PeppersGridSectionProps {
  /** Override the default pepper list (e.g. feed from API) */
  peppers?: PepperVariety[];
  /** URL for the "Browse all varieties" link */
  allVarietiesHref?: string;
}

/**
 * 3-column pepper variety grid section.
 * Defaults to 6 hardcoded varieties; accepts an override prop for API-driven data.
 * Includes section header and "Browse all varieties" CTA link.
 */
export default function PeppersGridSection({
  peppers = DEFAULT_PEPPERS,
  allVarietiesHref = '/visitor/peppers/1',
}: PeppersGridSectionProps) {
  return (
    <motion.section id="peppers" className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <RevealSection className="text-center mb-14">
          <p className="text-xs font-semibold tracking-widest text-green-500 uppercase mb-3">
            Our Varieties
          </p>
          <h2
            className="text-4xl font-bold text-green-900"
            style={{ fontFamily: 'Lora, serif' }}
          >
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
              href={allVarietiesHref}
              className="inline-flex items-center gap-2 text-green-700 font-medium hover:text-green-900 transition-colors duration-150 cursor-pointer"
            >
              Browse all varieties <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </RevealSection>
      </div>
    </motion.section>
  );
}
