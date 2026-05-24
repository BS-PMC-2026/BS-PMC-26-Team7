'use client';

import { useState, useEffect } from 'react';
import FarmMap from '@/components/map/FarmMap';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import { getAllPlants, PlantData } from '@/services/plants';
import { useLanguage } from '@/context/LanguageContext';

export default function FarmMapPage() {
  const { t } = useLanguage();
  const vi = t.visitor;
  const [plants, setPlants] = useState<PlantData[]>([]);

  useEffect(() => {
    getAllPlants("").then(setPlants).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-muted)]">
      <div className="bg-white border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <PageHeader
            label={vi.label}
            title={vi.farmMapTitle}
            subtitle={vi.farmMapSubtitle}
          />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Card>
          <FarmMap plants={plants} />
        </Card>
      </div>
    </div>
  );
}