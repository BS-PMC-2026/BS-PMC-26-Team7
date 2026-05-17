'use client';

import { useState, useEffect } from 'react';
import FarmMap, { FarmSection } from '@/components/map/FarmMap';
import PageHeader from '@/components/ui/PageHeader';
import { getAllPlants, PlantData, createPlant } from '@/services/plants';
import { getAllPeppers } from '@/services/peppers';
import { Pepper } from '@/types/pepper';

const ZONE_CODE_TO_ID: Record<string, number> = {
  'GH-01': 1,  'GH-02': 2,  'GH-03': 3,  'GH-04': 4,
  'GH-05': 5,  'GH-06': 6,  'GH-07': 7,  'GH-08': 8,
  'NURSERY': 9, 'SHED-MAIN': 10, 'GH-09': 11, 'GH-10': 12,
  'GERM-01': 13, 'GERM-02': 14, 'VIS-CENTER': 15,
  'GERM-03': 16, 'GERM-04': 17, 'FACTORY': 18,
};

export default function ManagerMapPage() {
  const [peppers,        setPeppers]        = useState<Pepper[]>([]);
  const [plants,         setPlants]         = useState<PlantData[]>([]);
  const [selectedPepper, setSelectedPepper] = useState<number | "">("");
  const [message,        setMessage]        = useState<{ text: string; ok: boolean } | null>(null);
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
      setMessage({ text: "Please select a pepper first.", ok: false });
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
        Status:    'Growing',
        IsActive:  true,
      });

      setMessage({ text: `${pepper?.PepperName} assigned to ${section.name} successfully.`, ok: true });
      setSelectedPepper("");
      const updated = await getAllPlants(token);
      setPlants(updated);
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : "Failed to assign.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <PageHeader
            label="PepperFarm"
            title="Farm Map — Assign Peppers to Zones"
            subtitle="Select a pepper variety and click a zone to plant it there"
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Pepper selector */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6 flex items-center gap-4 flex-wrap">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Select Pepper:
          </label>
          <select
            value={selectedPepper}
            onChange={e => setSelectedPepper(e.target.value === "" ? "" : Number(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 w-64"
          >
            <option value="">-- Choose a pepper --</option>
            {peppers.map(p => (
              <option key={p.PepperId} value={p.PepperId}>
                🌶️ {p.PepperName}
              </option>
            ))}
          </select>
          {selectedPepper && (
            <span className="text-sm text-green-600 font-medium">
              ✅ Now click a zone on the map to plant it
            </span>
          )}
        </div>

        {message && (
          <div className={`rounded-lg px-4 py-2 text-sm mb-4 ${
            message.ok
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-600"
          }`}>
            {message.text}
          </div>
        )}

        {/* Map */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <FarmMap
            plants={plants}
            renderPopupExtra={(section) => (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleAssignToZone(section)}
                  disabled={!selectedPepper || saving}
                  className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {saving ? "Planting..." : selectedPepper ? "Plant here 🌱" : "Select a pepper first"}
                </button>
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}