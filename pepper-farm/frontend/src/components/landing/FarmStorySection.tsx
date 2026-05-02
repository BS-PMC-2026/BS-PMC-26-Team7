'use client';

import { motion } from 'framer-motion';
import { Sprout, Droplets, Sun } from 'lucide-react';
import RevealSection from '@/components/ui/RevealSection';
import FeatureRow from '@/components/ui/FeatureRow';

const FEATURES = [
  {
    icon:    <Sprout className="w-10 h-10" />,
    title:   'Planted by hand',
    body:    'Every seedling is started in our nursery and transplanted by hand into raised beds enriched with compost. No shortcuts, no machinery guesswork.',
    reverse: false,
    delay:   0,
  },
  {
    icon:    <Droplets className="w-10 h-10" />,
    title:   'Smart irrigation',
    body:    'Our drip-irrigation system delivers precise water at root level, monitored by soil sensors. Plants get exactly what they need — no more, no less.',
    reverse: true,
    delay:   0.1,
  },
  {
    icon:    <Sun className="w-10 h-10" />,
    title:   'Harvested at peak',
    body:    'We track every plant from seed to harvest day. Peppers are picked at the exact moment of peak flavour and immediately packed for freshness.',
    reverse: false,
    delay:   0.2,
  },
];

/**
 * Dark green "Our Process" section with alternating FeatureRow layout.
 * Includes top and bottom SVG wave dividers.
 */
export default function FarmStorySection() {
  return (
    <>
      {/* Top wave */}
      <div className="w-full overflow-hidden leading-none" aria-hidden="true">
        <svg viewBox="0 0 1440 80" className="w-full fill-green-800">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" />
        </svg>
      </div>

      <motion.section id="farm" className="bg-green-800 py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <RevealSection className="text-center mb-16">
            <p className="text-xs font-semibold tracking-widest text-green-300 uppercase mb-3">
              Our Process
            </p>
            <h2
              className="text-4xl font-bold text-white"
              style={{ fontFamily: 'Lora, serif' }}
            >
              Grown with intention
            </h2>
          </RevealSection>

          <div className="flex flex-col gap-14">
            {FEATURES.map((f) => (
              <FeatureRow
                key={f.title}
                icon={f.icon}
                title={f.title}
                body={f.body}
                reverse={f.reverse}
                delay={f.delay}
              />
            ))}
          </div>
        </div>
      </motion.section>

      {/* Bottom wave */}
      <div className="w-full overflow-hidden leading-none bg-green-800" aria-hidden="true">
        <svg viewBox="0 0 1440 80" className="w-full fill-[#f0fdf4]">
          <path d="M0,40 C360,0 1080,80 1440,40 L1440,80 L0,80 Z" />
        </svg>
      </div>
    </>
  );
}
