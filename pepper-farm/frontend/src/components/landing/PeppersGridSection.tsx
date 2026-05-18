'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import RevealSection from '@/components/ui/RevealSection';
import PepperVarietyCard from '@/components/ui/PepperVarietyCard';
import { useLanguage } from '@/context/LanguageContext';

export interface PepperVariety {
  name: string;
  heat: number;
  color: string;
  description: string;
}

interface PeppersGridSectionProps {
  /** Override the default pepper list (e.g. feed from API) */
  peppers?: PepperVariety[];
  /** URL for the "Browse all varieties" link */
  allVarietiesHref?: string;
}

export default function PeppersGridSection({
  peppers,
  allVarietiesHref = '/visitor/peppers/1',
}: PeppersGridSectionProps) {
  const { t } = useLanguage();
  const la = t.landing;

  const DEFAULT_PEPPERS: PepperVariety[] = [
    { name: 'Jalapeño Mexicano', heat: 2, color: '#15803d', description: la.jalapenoDesc },
    { name: 'Habanero Gold',     heat: 4, color: '#ca8a04', description: la.habaneroDesc },
    { name: 'Carolina Reaper',   heat: 5, color: '#dc2626', description: la.carolinaDesc },
    { name: 'Shishito',          heat: 1, color: '#4ade80', description: la.shishitoDesc },
    { name: 'Anaheim Sunrise',   heat: 2, color: '#f97316', description: la.anaheimDesc  },
    { name: 'Ghost Pepper',      heat: 5, color: '#7c3aed', description: la.ghostDesc    },
  ];

  const list = peppers ?? DEFAULT_PEPPERS;

  return (
    <motion.section id="peppers" className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <RevealSection className="text-center mb-14">
          <p className="text-xs font-semibold tracking-widest text-green-500 uppercase mb-3">
            {la.ourVarieties}
          </p>
          <h2
            className="text-4xl font-bold text-green-900"
            style={{ fontFamily: 'Lora, serif' }}
          >
            {la.everyPepperStory}
          </h2>
          <p className="mt-3 text-gray-500 max-w-xl mx-auto leading-relaxed">
            {la.peppersGridDesc}
          </p>
        </RevealSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {list.map((p, i) => (
            <PepperVarietyCard key={p.name} {...p} delay={i * 0.07} />
          ))}
        </div>

        <RevealSection className="mt-10 text-center">
          <motion.div whileHover={{ x: 4 }} className="inline-flex">
            <Link
              href={allVarietiesHref}
              className="inline-flex items-center gap-2 text-green-700 font-medium hover:text-green-900 transition-colors duration-150 cursor-pointer"
            >
              {la.browseAllVarieties} <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </RevealSection>
      </div>
    </motion.section>
  );
}
