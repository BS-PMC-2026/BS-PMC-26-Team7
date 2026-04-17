'use client';

import { useState, useEffect } from 'react';
import FarmMap from '@/components/map/FarmMap';
import PageHeader from '@/components/ui/PageHeader';
import { getAllPlants, PlantData } from '@/services/plants';

export default function FarmMapPage() {
  const [plants, setPlants] = useState<PlantData[]>([]);

  useEffect(() => {
    getAllPlants("").then(setPlants).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <PageHeader
            label="PepperFarm"
            title="Farm Map"
            subtitle="Interactive layout of the farm facility — click any section to learn more"
          />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <FarmMap plants={plants} />
        </div>
      </div>
    </div>
  );
}