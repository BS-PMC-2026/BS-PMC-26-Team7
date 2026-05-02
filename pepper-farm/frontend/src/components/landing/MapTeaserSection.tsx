'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import RevealSection from '@/components/ui/RevealSection';

const MAP_COLORS = ['#15803d', '#22c55e', '#4ade80', '#ca8a04', '#dc2626'];

interface MapTeaserSectionProps {
  /** Link destination for the CTA button */
  mapHref?: string;
}

/**
 * Interactive farm map teaser card.
 * Dark green gradient card with animated mini-map grid on the right.
 * Links to the full interactive farm map.
 */
export default function MapTeaserSection({ mapHref = '/visitor/map' }: MapTeaserSectionProps) {
  return (
    <motion.section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <RevealSection>
          <motion.div
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.3 }}
            className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-green-700 to-green-900 p-10 md:p-16 text-white shadow-2xl cursor-default"
          >
            {/* Decorative circles */}
            <div
              className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-1/3 translate-x-1/3"
              aria-hidden="true"
            />
            <div
              className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-yellow-400/10 translate-y-1/3 -translate-x-1/3"
              aria-hidden="true"
            />

            <div className="relative z-10 flex flex-col md:flex-row items-center gap-10 justify-between">
              {/* Text + CTA */}
              <div className="max-w-md">
                <p className="text-xs font-semibold tracking-widest text-green-300 uppercase mb-3">
                  Interactive
                </p>
                <h2
                  className="text-3xl font-bold mb-4"
                  style={{ fontFamily: 'Lora, serif' }}
                >
                  Explore our farm map
                </h2>
                <p className="text-green-200 leading-relaxed mb-8">
                  Navigate every zone of PepperFarm. See which varieties grow where,
                  check plant health, and plan your visit.
                </p>
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    href={mapHref}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-400 text-green-900 font-semibold rounded-xl hover:bg-yellow-300 transition-colors duration-200 cursor-pointer"
                  >
                    <MapPin className="w-4 h-4" />
                    Open Farm Map
                  </Link>
                </motion.div>
              </div>

              {/* Animated mini-map */}
              <div
                className="w-64 h-48 rounded-2xl bg-green-600/40 border border-white/10 flex items-center justify-center backdrop-blur-sm shrink-0 overflow-hidden"
                aria-hidden="true"
              >
                <div className="grid grid-cols-4 gap-2 p-4">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-8 h-8 rounded-lg"
                      style={{ backgroundColor: MAP_COLORS[i % MAP_COLORS.length] }}
                      animate={{ opacity: [0.5, 0.9, 0.5] }}
                      transition={{
                        duration: 2 + (i % 3),
                        repeat: Infinity,
                        delay: i * 0.1,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </RevealSection>
      </div>
    </motion.section>
  );
}
