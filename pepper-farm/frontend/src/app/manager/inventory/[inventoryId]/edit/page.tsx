// frontend/src/app/manager/inventory/[inventoryId]/edit/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getInventoryById, updateInventory } from '@/services/inventory';
import { InventoryResponse, InventoryUpdatePayload } from '@/types/inventory';
import QuantityUpdateForm from '@/components/inventory/QuantityUpdateForm';
import { useLanguage } from '@/context/LanguageContext';

export default function EditInventoryPage() {
  const { inventoryId } = useParams<{ inventoryId: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const inv = t.inventory;

  function getFriendlyErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) return inv.errGeneric;
    const msg = error.message.toLowerCase();
    if (msg.includes('cannot exceed'))               return inv.errExceedsWarehouse;
    if (msg.includes('must be 0 for warehouse-only')) return inv.errWarehouseOnlyNoStore;
    if (msg.includes('not found'))                   return inv.errNotFound;
    if (msg.includes('database connection timeout')) return inv.errServerTimeout;
    if (msg.includes('access denied') || msg.includes('403')) return inv.errNoPermission;
    return error.message;
  }

  const [inventory, setInventory] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getInventoryById(Number(inventoryId));
        setInventory(data);
      } catch (error) {
        setErrorMessage(getFriendlyErrorMessage(error));
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryId]);

  async function handleSubmit(payload: InventoryUpdatePayload) {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      setSubmitting(true);
      const updated = await updateInventory(Number(inventoryId), payload);
      setInventory(updated);
      setSuccessMessage(inv.updatedSuccessfully);
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <button onClick={() => router.push('/manager/inventory')} className="text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
          {inv.backToInventory}
        </button>
        <h1 className="mt-3 text-3xl font-bold">{inv.updateTitle}</h1>
        {inventory && (
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            {inventory.DisplayName}
            {inventory.ProductId === null && (
              <span className="ml-2 rounded-full bg-[var(--color-muted)] text-[var(--color-muted-foreground)] px-2 py-0.5 text-xs">{inv.typeWarehouseOnly}</span>
            )}
          </p>
        )}
      </div>

      {successMessage && <div className="mb-4 rounded-md border border-[var(--color-border)] bg-[var(--color-secondary-light)] px-4 py-3 text-[var(--color-primary)]">{successMessage}</div>}
      {errorMessage && <div className="mb-4 rounded-md border border-[var(--color-border)] bg-[var(--color-error-bg)] px-4 py-3 text-[var(--color-error)]">{errorMessage}</div>}

      {loading ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-white p-6 animate-pulse">
          <div className="h-4 w-1/3 bg-[var(--color-muted)] rounded mb-3" />
          <div className="h-4 w-1/2 bg-[var(--color-muted)] rounded" />
        </div>
      ) : inventory ? (
        <QuantityUpdateForm inventory={inventory} onSubmit={handleSubmit} submitting={submitting} />
      ) : null}
    </main>
  );
}
