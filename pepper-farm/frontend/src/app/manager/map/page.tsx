'use client';

import { useState, useEffect } from 'react';
import FarmMap, { FarmSection } from '@/components/map/FarmMap';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import { getAllPlants, PlantData, createPlant } from '@/services/plants';
import { getAllPeppers } from '@/services/peppers';
import { Pepper } from '@/types/pepper';
import { useLanguage } from '@/context/LanguageContext';
import { PLANTABLE_ZONE_TYPES } from '@/data/farmSections';

const ZONE_CODE_TO_ID: Record<string, number> = {
  'GH-01': 1,  'GH-02': 2,  'GH-03': 3,  'GH-04': 4,
  'GH-05': 5,  'GH-06': 6,  'GH-07': 7,  'GH-08': 8,
  'NURSERY': 9, 'SHED-MAIN': 10, 'GH-09': 11, 'GH-10': 12,
  'GERM-01': 13, 'GERM-02': 14, 'VIS-CENTER': 15,
  'GERM-03': 16, 'GERM-04': 17, 'FACTORY': 18,
};

const MSG_NURSERY_ONLY = 'Peppers can only be planted first in the nursery.';
const HINT_NURSERY_ONLY = 'New seedlings must start in the Nursery before transfer to a greenhouse.';

export default function ManagerMapPage() {
  const { t } = useLanguage();
  const mp = t.map;
  const [peppers,        setPeppers]        = useState<Pepper[]>([]);
  const [plants,         setPlants]         = useState<PlantData[]>([]);
  const [selectedPepper, setSelectedPepper] = useState<number | "">("");
  const [message,        setMessage]        = useState<{ text: string; ok: boolean; nursery?: boolean } | null>(null);
  const [saving,         setSaving]         = useState(false);

  const token = typeof window !== "undefined"
    ? localStorage.getItem("token") ?? ""
    : "";

  useEffect(() => {
    getAllPeppers().then(setPeppers).catch(() => {});
    getAllPlants(token).then(setPlants).catch(() => {});
  }, [token]);

  const handleAssignToZone = async (section: FarmSection) => {
    if (!selectedPepper) {
      setMessage({ text: mp.pleaseSelectPepper, ok: false });
      return;
    }

    // Business rule: first planting is only allowed in the Nursery
    if (!PLANTABLE_ZONE_TYPES.has(section.type)) {
      setMessage({ text: MSG_NURSERY_ONLY, ok: false, nursery: true });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const zoneId = ZONE_CODE_TO_ID[section.id];
      const pepper = peppers.find(p => p.PepperId === Number(selectedPepper));
      const plantCode = `${pepper?.PepperName?.replace(/\s+/g, '-').toUpperCase() ?? 'PLANT'}-${section.id}-${Date.now()}`;

      await createPlant({
        PlantCode: plantCode,
        PepperId:  Number(selectedPepper),
        ZoneId:    zoneId ?? null,
        PlantedAt: new Date().toISOString(),
        Status:    'Growing',
        IsActive:  true,
      });

      setMessage({ text: `${pepper?.PepperName} — ${section.name} — ${mp.assignedSuccessfully}`, ok: true });
      setSelectedPepper("");
      const updated = await getAllPlants(token);
      setPlants(updated);
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : mp.failedToAssign, ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="border-b border-gray-200/60">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <PageHeader
            label={mp.label}
            title={mp.title}
            subtitle={mp.subtitle}
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Pepper selector */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6 flex items-center gap-4 flex-wrap">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            {mp.selectPepper}
          </label>
          <select
            value={selectedPepper}
            onChange={e => setSelectedPepper(e.target.value === "" ? "" : Number(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 w-64"
          >
            <option value="">{mp.choosePepper}</option>
            {peppers.map(p => (
              <option key={p.PepperId} value={p.PepperId}>
                🌶️ {p.PepperName}
              </option>
            ))}
          </select>
          {selectedPepper && (
            <span className="text-sm text-green-600 font-medium">
              ✅ Click the Nursery zone to plant
            </span>
          )}
        </div>

        {message && (
          <div className={`rounded-lg px-4 py-2 text-sm mb-4 flex items-start gap-2 ${
            message.ok
              ? "bg-green-50 border border-green-200 text-green-700"
              : message.nursery
                ? "bg-amber-50 border-2 border-amber-400 text-amber-900 font-semibold"
                : "bg-red-50 border border-red-200 text-red-600"
          }`}>
            {message.nursery && <span className="text-base shrink-0 mt-px">🌱</span>}
            <span>{message.text}</span>
          </div>
        )}

        {/* Map */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <FarmMap
            plants={plants}
            renderPopupExtra={(section) => {
              const isPlantable = PLANTABLE_ZONE_TYPES.has(section.type);
              return (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  {selectedPepper && !isPlantable && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                      {HINT_NURSERY_ONLY}
                    </p>
                  )}
                  <Button
                    onClick={() => handleAssignToZone(section)}
                    disabled={!selectedPepper || saving || !isPlantable}
                    variant="primary"
                    size="md"
                    className="w-full"
                  >
                    {saving
                      ? mp.planting
                      : !selectedPepper
                        ? mp.selectPepperFirst
                        : isPlantable
                          ? mp.plantHere
                          : 'Nursery only — cannot plant here'}
                  </Button>
                </div>
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}
