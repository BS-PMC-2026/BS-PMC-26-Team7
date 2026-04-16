'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import PepperCard from '@/components/peppers/PepperCard';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { getAllPeppers } from '@/services/peppers';
import { Pepper } from '@/types/pepper';

export default function HomePage() {
  const [peppers, setPeppers] = useState<Pepper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPeppers = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getAllPeppers();
      setPeppers(data);
    } catch {
      setLoadError('Failed to load pepper varieties. Is the backend running?');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPeppers();
  }, [loadPeppers]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-start justify-between">
            <PageHeader
              label="PepperFarm"
              title="Pepper Varieties"
              subtitle="Browse all pepper varieties grown at our farm"
            />
            <div className="flex gap-3 mt-1">
              <Link
                href="/visitor/products"
                className="border border-green-600 text-green-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-50 transition"
              >
                Products
              </Link>
              <Link
                href="/login"
                className="border border-green-600 text-green-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-50 transition"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition"
              >
                Register
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {loadError && <Alert variant="info" className="mb-6">{loadError}</Alert>}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-pulse">
                <div className="w-full h-48 bg-gray-100" />
                <div className="p-4 flex flex-col gap-2">
                  <div className="h-3.5 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-full mt-1" />
                  <div className="h-3 bg-gray-100 rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        ) : peppers.length === 0 ? (
          <EmptyState icon="🌶️" title="No pepper varieties found" description="Check back later." />
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-4">
              {peppers.length} {peppers.length === 1 ? 'variety' : 'varieties'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {peppers.map((pepper) => (
                <PepperCard key={pepper.PepperId} pepper={pepper} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}