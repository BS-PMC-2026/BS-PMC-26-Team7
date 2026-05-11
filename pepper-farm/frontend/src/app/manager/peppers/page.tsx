'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PepperCard from '@/components/peppers/PepperCard';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import { Pepper } from '@/types/pepper';
import { getAllPeppers , deletePepper } from '@/services/peppers';

export default function ManagerPeppersPage() {
  const router = useRouter();
  const [peppers, setPeppers] = useState<Pepper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPepperName, setSelectedPepperName] = useState('');
  const [selectedHeatLevel, setSelectedHeatLevel] = useState('');
  const [selectedZone, setSelectedZone] = useState('');

  const loadPeppers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAllPeppers();
      setPeppers(data);
    } catch {
      setError('Failed to load peppers. Is the backend running?');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPeppers();
  }, [loadPeppers]);

  const pepperNames = Array.from(
    new Set(peppers.map((pepper) => pepper.PepperName).filter(Boolean))
  );

  const zones = Array.from(
    new Set(peppers.map((pepper) => pepper.Zone).filter(Boolean))
  );

  const getHeatLevel = (pepper: Pepper) => {
    const maxHeat = pepper.HeatLevelScovilleMax ?? 0;

    if (maxHeat <= 2500) return 'Mild';
    if (maxHeat <= 10000) return 'Medium';
    if (maxHeat <= 50000) return 'Hot';
    return 'Very Hot';
  };

  const filteredPeppers = peppers.filter((pepper) => {
    const search = searchTerm.toLowerCase();

    const matchesSearch =
      pepper.PepperName?.toLowerCase().includes(search) ||
      pepper.ScientificName?.toLowerCase().includes(search) ||
      pepper.Zone?.toLowerCase().includes(search) ||
      pepper.GeneralDescription?.toLowerCase().includes(search);

    const matchesPepperName =
      selectedPepperName === '' || pepper.PepperName === selectedPepperName;

    const matchesHeatLevel =
      selectedHeatLevel === '' || getHeatLevel(pepper) === selectedHeatLevel;

    const matchesZone =
      selectedZone === '' || pepper.Zone === selectedZone;

    return matchesSearch && matchesPepperName && matchesHeatLevel && matchesZone;
  });

  const handleDeletePepper = async (pepperId: number) => {
    const confirmDelete = window.confirm(
      'Are you sure you want to delete this pepper?'
    );

    if (!confirmDelete) return;

    setError(null);
    setSuccessMessage(null);

    try {
      await deletePepper(pepperId);

      setPeppers((prevPeppers) =>
        prevPeppers.filter((pepper) => pepper.PepperId !== pepperId)
      );

      setSuccessMessage('Pepper deleted successfully.');
    } catch {
      setError('Failed to delete pepper.');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <PageHeader
          label="Manager Dashboard"
          title="Pepper Varieties"
          subtitle="Manage pepper varieties in the farm"
          action={
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/manager')}
              >
                ← Dashboard
              </Button>
              <Link href="/manager/peppers/create">
                <Button>+ Add Pepper</Button>
              </Link>
            </div>
          
          }
        />
      </div>
      <div className="mb-6">
  <input
    type="text"
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    placeholder="Search pepper by name, scientific name, zone or description..."
    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
  />
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
  <select
    value={selectedPepperName}
    onChange={(e) => setSelectedPepperName(e.target.value)}
    className="rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
  >
    <option value="">All Pepper Types</option>
    {pepperNames.map((name) => (
      <option key={name} value={name}>
        {name}
      </option>
    ))}
  </select>

  <select
    value={selectedHeatLevel}
    onChange={(e) => setSelectedHeatLevel(e.target.value)}
    className="rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
  >
    <option value="">All Heat Levels</option>
    <option value="Mild">Mild</option>
    <option value="Medium">Medium</option>
    <option value="Hot">Hot</option>
    <option value="Very Hot">Very Hot</option>
  </select>

  <select
    value={selectedZone}
    onChange={(e) => setSelectedZone(e.target.value)}
    className="rounded-xl border border-gray-300 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
  >
    <option value="">All Growing Zones</option>
    {zones.map((zone) => (
     <option key={String(zone)} value={zone ?? ''}>
        {zone}
      </option>
    ))}
  </select>
</div>
</div>


      {error && <Alert className="mb-4">{error}</Alert>}
      {successMessage && (
  <div className="mb-4 rounded-xl border border-green-500 bg-green-50 px-4 py-3 text-green-700">
    {successMessage}
  </div>
)}

      {isLoading ? (
        <p className="text-sm text-gray-400 text-center py-12">Loading peppers...</p>
      ) : filteredPeppers.length === 0 ? (
        <EmptyState
          title="No pepper varieties yet."
          description="Click + Add Pepper to create the first one."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPeppers.map((pepper) => (
            <div key={pepper.PepperId} className="relative group">
              <PepperCard pepper={pepper} />
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <Link href={`/manager/peppers/edit/${pepper.PepperId}`}>
                  <Button variant="secondary" className="text-xs px-2 py-1">
                    Edit
                  </Button>
                </Link>
                 <Button variant="secondary" className="text-xs px-2 py-1" 
                 onClick={() => handleDeletePepper(pepper.PepperId)}
                 >
                   Delete
                   </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
