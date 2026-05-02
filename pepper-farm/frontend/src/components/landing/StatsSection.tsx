'use client';

import { motion } from 'framer-motion';
import { Leaf, Sprout, Sun, Droplets } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';

const STATS = [
  { value: '30+',  label: 'Pepper Varieties', icon: <Leaf className="w-5 h-5" />,     delay: 0    },
  { value: '5ha',  label: 'Farm Area',         icon: <Sprout className="w-5 h-5" />,   delay: 0.08 },
  { value: '98%',  label: 'Sun Hours',         icon: <Sun className="w-5 h-5" />,      delay: 0.16 },
  { value: 'Zero', label: 'Pesticides',        icon: <Droplets className="w-5 h-5" />, delay: 0.24 },
];

/**
 * 4-column stats strip below the hero.
 * Each StatCard springs in on scroll entry.
 * Easily extended — edit the STATS array to add/remove metrics.
 */
export default function StatsSection() {
  return (
    <motion.section className="py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <StatCard key={s.label} value={s.value} label={s.label} icon={s.icon} delay={s.delay} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}
