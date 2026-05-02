'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import RevealSection from '@/components/ui/RevealSection';

interface FinalCTASectionProps {
  /** Primary CTA href (default: /register) */
  primaryHref?: string;
  /** Secondary CTA href (default: /visitor/products) */
  secondaryHref?: string;
}

/**
 * Bottom-of-page CTA section.
 * Encourages sign-up or product browsing.
 * Text and links are configurable via props.
 */
export default function FinalCTASection({
  primaryHref = '/register',
  secondaryHref = '/visitor/products',
}: FinalCTASectionProps) {
  return (
    <motion.section className="py-24 px-6 text-center">
      <RevealSection className="max-w-2xl mx-auto">
        <p className="text-xs font-semibold tracking-widest text-green-500 uppercase mb-4">
          Join PepperFarm
        </p>
        <h2
          className="text-4xl font-bold text-green-900 mb-5"
          style={{ fontFamily: 'Lora, serif' }}
        >
          Ready to taste the heat?
        </h2>
        <p className="text-gray-500 leading-relaxed mb-8">
          Create a free account to track your favourite varieties, get harvest
          notifications, and order directly from our farm.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Link
              href={primaryHref}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors duration-200 cursor-pointer shadow-lg shadow-green-200"
            >
              Create Free Account
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Link
              href={secondaryHref}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-green-800 bg-white border border-green-200 rounded-xl hover:bg-green-50 transition-colors duration-200 cursor-pointer"
            >
              Browse Products
            </Link>
          </motion.div>
        </div>
      </RevealSection>
    </motion.section>
  );
}
