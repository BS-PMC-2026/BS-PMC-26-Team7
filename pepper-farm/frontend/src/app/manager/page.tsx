'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import FarmMap, { FarmSection, MapFilter } from '@/components/map/FarmMap';
import { getAllPlants, PlantData, createPlant } from '@/services/plants';
import { getAllPeppers } from '@/services/peppers';
import { getTasks } from '@/services/tasks';
import { getZoneHealth } from '@/services/anomalies';
import { Pepper } from '@/types/pepper';
import { Task } from '@/types/task';
import { ZoneHealth } from '@/types/anomaly';

const ZONE_CODE_TO_ID: Record<string, number> = {
  'GH-01': 1,  'GH-02': 2,  'GH-03': 3,  'GH-04': 4,
  'GH-05': 5,  'GH-06': 6,  'GH-07': 7,  'GH-08': 8,
  'NURSERY': 9, 'SHED-MAIN': 10, 'GH-09': 11, 'GH-10': 12,
  'GERM-01': 13, 'GERM-02': 14, 'VIS-CENTER': 15,
  'GERM-03': 16, 'GERM-04': 17, 'FACTORY': 18,
};

export default function ManagerPage() {
  const { t } = useLanguage();
  const mp = t.map;

  const [peppers,        setPeppers]        = useState<Pepper[]>([]);
  const [plants,         setPlants]         = useState<PlantData[]>([]);
  const [tasks,          setTasks]          = useState<Task[]>([]);
  const [zoneHealth,     setZoneHealth]     = useState<ZoneHealth[]>([]);
  const [selectedPepper, setSelectedPepper] = useState<number | "">("");
  const [message,        setMessage]        = useState<{ text: string; ok: boolean } | null>(null);
  const [saving,         setSaving]         = useState(false);
  const [activeFilter,   setActiveFilter]   = useState<MapFilter>(null);

  const token = typeof window !== "undefined"
    ? localStorage.getItem("token") ?? ""
    : "";

  useEffect(() => {
    getAllPeppers().then(setPeppers).catch(() => {});
    getAllPlants(token).then(setPlants).catch(() => {});
    getTasks().then(setTasks).catch(() => {});
    getZoneHealth().then(setZoneHealth).catch(() => {});
  }, [token]);

  const handleFilterClick = (filter: MapFilter) => {
    setActiveFilter(prev => prev === filter ? null : filter);
    setSelectedPepper("");
    setMessage(null);
  };

  const handleAssignToZone = async (section: FarmSection) => {
    if (!selectedPepper) {
      setMessage({ text: mp.pleaseSelectPepper, ok: false });
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

  const FILTERS: { id: NonNullable<MapFilter>; label: string }[] = [
    { id: 'pepper', label: mp.filterPlantedPepper },
    { id: 'task',   label: mp.filterOpenTask       },
    { id: 'sensor', label: mp.filterSensorAnomaly  },
  ];

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Filter toolbar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-gray-500 whitespace-nowrap">
            {activeFilter === null ? mp.alertMapTitle : mp.alertMapSubtitle}:
          </span>
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => handleFilterClick(f.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                activeFilter === f.id
                  ? 'bg-gray-800 text-white border-gray-800 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-800'
              }`}
            >
              {f.label}
            </button>
          ))}
          {activeFilter !== null && (
            <button
              onClick={() => handleFilterClick(activeFilter)}
              className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline"
            >
              ✕ {mp.alertMapTitle}
            </button>
          )}
        </div>

        {/* Pepper assignment sub-toolbar (only when pepper filter active) */}
        {activeFilter === 'pepper' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 flex items-center gap-4 flex-wrap">
            <label className="text-sm font-medium text-green-700 whitespace-nowrap">
              {mp.selectPepper}
            </label>
            <select
              value={selectedPepper}
              onChange={e => setSelectedPepper(e.target.value === "" ? "" : Number(e.target.value))}
              className="border border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 w-64 bg-white"
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
                ✅ {mp.clickZoneHint}
              </span>
            )}
          </div>
        )}

        {message && (
          <div className={`rounded-lg px-4 py-2 text-sm mb-4 ${
            message.ok
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-600"
          }`}>
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <FarmMap
            plants={plants}
            activeFilter={activeFilter}
            tasks={tasks}
            zoneHealth={zoneHealth}
            renderPopupExtra={activeFilter === 'pepper' ? (section) => (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleAssignToZone(section)}
                  disabled={!selectedPepper || saving}
                  className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {saving ? mp.planting : selectedPepper ? mp.plantHere : mp.selectPepperFirst}
                </button>
              </div>
            ) : undefined}
          />
        </div>
      </div>
    </main>
  );
}
