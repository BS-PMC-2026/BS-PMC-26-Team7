'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import ProductCatalogTable from '@/components/inventory/ProductCatalogTable';
import { getInventoryList } from '@/services/inventory';
import { InventoryResponse } from '@/types/inventory';

export default function ManagerInventoryPage() {
  const [items, setItems] = useState<InventoryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getInventoryList();
      setItems(data);
    } catch {
      setLoadError('Failed to load inventory. Is the backend running?');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-10 flex items-start justify-between">
          <PageHeader
            label="PepperFarm"
            title="Warehouse Inventory"
            subtitle="Warehouse is the source of truth. Store (allocated) quantity must stay within warehouse quantity."
          />
          <div className="flex gap-2 mt-1">
            <Link
              href="/manager/inventory/plants"
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
            >
              🌱 Plants by Variety
            </Link>
            <Link
              href="/manager/inventory/create"
              className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
            >
              + Add Item
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {loadError && <Alert variant="info" className="mb-6">{loadError}</Alert>}
        {isLoading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
            <div className="h-4 w-1/3 bg-gray-100 rounded mb-3" />
            <div className="h-4 w-2/3 bg-gray-100 rounded mb-3" />
            <div className="h-4 w-1/2 bg-gray-100 rounded" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon="📦" title="No inventory records" description='Click "+ Add Item" to add your first warehouse item.' />
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-4">{items.length} {items.length === 1 ? 'item' : 'items'}</p>
            <ProductCatalogTable items={items} />
          </>
        )}
      </div>
    </div>
  );
}