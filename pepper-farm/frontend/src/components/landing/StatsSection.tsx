'use client';

import { motion } from 'framer-motion';
import { Leaf, Sprout, Sun, Droplets } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import { useLanguage } from '@/context/LanguageContext';

export default function StatsSection() {
  const { t } = useLanguage();
  const la = t.landing;

  const STATS = [
    { value: '30+',       label: la.statPepperVarieties, icon: <Leaf className="w-5 h-5" />,     delay: 0    },
    { value: '5ha',       label: la.statFarmArea,        icon: <Sprout className="w-5 h-5" />,   delay: 0.08 },
    { value: '98%',       label: la.statSunHours,        icon: <Sun className="w-5 h-5" />,      delay: 0.16 },
    { value: la.statZero, label: la.statPesticides,      icon: <Droplets className="w-5 h-5" />, delay: 0.24 },
  ];

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
