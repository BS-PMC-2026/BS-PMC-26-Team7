'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import PepperCard from '@/components/peppers/PepperCard';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import { Pepper } from '@/types/pepper';
import { getAllPeppers } from '@/services/peppers';

export default function ManagerPeppersPage() {
  const [peppers, setPeppers] = useState<Pepper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <PageHeader
          title="Pepper Varieties"
          subtitle="Manage pepper varieties in the farm"
          action={
            <Link href="/manager/peppers/create">
              <Button>+ Add Pepper</Button>
            </Link>
          }
        />
      </div>

      {error && <Alert className="mb-4">{error}</Alert>}

      {isLoading ? (
        <p className="text-sm text-gray-400 text-center py-12">Loading peppers...</p>
      ) : peppers.length === 0 ? (
        <EmptyState
          title="No pepper varieties yet."
          description="Click + Add Pepper to create the first one."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {peppers.map((pepper) => (
            <div key={pepper.PepperId} className="relative group">
              <PepperCard pepper={pepper} />
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href={`/manager/peppers/edit/${pepper.PepperId}`}>
                  <Button variant="secondary" className="text-xs px-2 py-1">
                    Edit
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
