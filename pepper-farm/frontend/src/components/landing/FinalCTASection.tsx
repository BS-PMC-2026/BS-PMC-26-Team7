'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import RevealSection from '@/components/ui/RevealSection';
import { useLanguage } from '@/context/LanguageContext';

interface FinalCTASectionProps {
  /** Primary CTA href (default: /register) */
  primaryHref?: string;
  /** Secondary CTA href (default: /visitor/products) */
  secondaryHref?: string;
}

export default function FinalCTASection({
  primaryHref = '/register',
  secondaryHref = '/visitor/products',
}: FinalCTASectionProps) {
  const { t } = useLanguage();
  const la = t.landing;

  return (
    <motion.section className="py-24 px-6 text-center">
      <RevealSection className="max-w-2xl mx-auto">
        <p className="text-xs font-semibold tracking-widest text-green-500 uppercase mb-4">
          {la.joinPepperFarm}
        </p>
        <h2
          className="text-4xl font-bold text-green-900 mb-5"
        >
          {la.readyToTasteHeat}
        </h2>
        <p className="text-gray-500 leading-relaxed mb-8">
          {la.ctaDesc}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Link
              href={primaryHref}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white bg-[var(--color-primary)] rounded-xl hover:bg-[var(--color-primary-hover)] transition-colors duration-200 cursor-pointer shadow-lg"
            >
              {la.createFreeAccount}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Link
              href={secondaryHref}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-green-800 bg-white border border-green-200 rounded-xl hover:bg-green-50 transition-colors duration-200 cursor-pointer"
            >
              {la.browseProducts}
            </Link>
          </motion.div>
        </div>
      </RevealSection>
    </motion.section>
  );
}
