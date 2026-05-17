'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import ProductCatalogTable from '@/components/inventory/ProductCatalogTable';
import { getInventoryList } from '@/services/inventory';
import { InventoryResponse } from '@/types/inventory';
import { useLanguage } from '@/context/LanguageContext';

export default function ManagerInventoryPage() {
  const { t } = useLanguage();
  const inv = t.inventory;
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
      setLoadError(inv.failedToLoad);
    } finally {
      setIsLoading(false);
    }
  }, [inv.failedToLoad]);

  useEffect(() => { load(); }, [load]);

  const itemCountLabel = `${items.length} ${items.length === 1 ? t.common.item : t.common.items}`;

  return (
    <div className="min-h-screen">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-10 flex items-start justify-between">
          <PageHeader
            label={inv.label}
            title={inv.title}
            subtitle={inv.subtitle}
          />
          <div className="flex gap-2 mt-1">
            <Link
              href="/manager/inventory/plants"
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
            >
              {inv.plantsByVariety}
            </Link>
            <Link
              href="/manager/inventory/create"
              className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
            >
              {inv.addItem}
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
          <EmptyState icon="📦" title={inv.noRecords} description={inv.noRecordsDesc} />
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-4" dir="ltr">{itemCountLabel}</p>
            <ProductCatalogTable items={items} />
          </>
        )}
      </div>
    </div>
  );
}
