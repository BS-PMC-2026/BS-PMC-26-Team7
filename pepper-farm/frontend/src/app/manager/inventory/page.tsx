'use client';

import { useState, useEffect, useCallback } from 'react';
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

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <PageHeader
            label="PepperFarm"
            title="Warehouse Inventory"
            subtitle="Update warehouse stock. Store/allocated quantity cannot exceed warehouse quantity."
          />
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
          <EmptyState
            icon="📦"
            title="No inventory records"
            description="Create a product first — each product gets an inventory row automatically."
          />
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-4">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </p>
            <ProductCatalogTable items={items} />
          </>
        )}
      </div>
    </div>
  );
}