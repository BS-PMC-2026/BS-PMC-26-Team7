'use client';

import { useState, useEffect } from 'react';
import FarmMap, { FarmSection } from '@/components/map/FarmMap';
import PageHeader from '@/components/ui/PageHeader';
import { getAllPlants, updatePlantLocation, PlantData } from '@/services/plants';

export default function ManagerMapPage() {
  const [plants,        setPlants]        = useState<PlantData[]>([]);
  const [selectedPlant, setSelectedPlant] = useState<number | "">("");
  const [message,       setMessage]       = useState<{ text: string; ok: boolean } | null>(null);
  const [saving,        setSaving]        = useState(false);

  const token = typeof window !== "undefined"
    ? localStorage.getItem("token") ?? ""
    : "";

  useEffect(() => {
    getAllPlants(token)
      .then(setPlants)
      .catch(() => setMessage({ text: "Failed to load plants.", ok: false }));
  }, [token]);

  const handleUpdateLocation = async (section: FarmSection) => {
    if (!selectedPlant) {
      setMessage({ text: "Please select a plant first.", ok: false });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const zoneId = parseInt(section.id);
      await updatePlantLocation(token, Number(selectedPlant), isNaN(zoneId) ? null : zoneId);
      setMessage({ text: `Plant location updated to ${section.name} successfully.`, ok: true });
      setSelectedPlant("");
      const updated = await getAllPlants(token);
      setPlants(updated);
    } catch (err: unknown) {
      setMessage({ text: err instanceof Error ? err.message : "Update failed.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <PageHeader
            label="PepperFarm"
            title="Farm Map — Manage Plant Locations"
            subtitle="Select a plant and click a zone to update its location"
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Plant selector */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6 flex items-center gap-4 flex-wrap">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Select Plant:
          </label>
          <select
            value={selectedPlant}
            onChange={e => setSelectedPlant(e.target.value === "" ? "" : Number(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 w-64"
          >
            <option value="">-- Choose a plant --</option>
            {plants.map(p => (
              <option key={p.PlantId} value={p.PlantId}>
                {p.PlantCode} {p.ZoneId ? `(Zone ${p.ZoneId})` : "(No zone)"}
              </option>
            ))}
          </select>
          {selectedPlant && (
            <span className="text-sm text-green-600 font-medium">
              ✅ Now click a zone on the map to assign
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
            renderPopupExtra={(section) => (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleUpdateLocation(section)}
                  disabled={!selectedPlant || saving}
                  className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {saving ? "Saving..." : selectedPlant ? "Assign plant here" : "Select a plant first"}
                </button>
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}