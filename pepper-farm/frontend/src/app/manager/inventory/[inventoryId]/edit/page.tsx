// frontend/src/app/manager/inventory/[inventoryId]/edit/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getInventoryById, updateInventory } from '@/services/inventory';
import { InventoryResponse, InventoryUpdatePayload } from '@/types/inventory';
import QuantityUpdateForm from '@/components/inventory/QuantityUpdateForm';

function getFriendlyErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Something went wrong. Please try again.';
  const msg = error.message.toLowerCase();
  if (msg.includes('cannot exceed')) return 'Store quantity cannot exceed warehouse quantity.';
  if (msg.includes('must be 0 for warehouse-only')) return 'This is a warehouse-only item and cannot have a store quantity.';
  if (msg.includes('not found')) return 'Inventory record was not found.';
  if (msg.includes('database connection timeout'))
    return 'The server is taking too long to respond. Please try again in a moment.';
  if (msg.includes('access denied') || msg.includes('403'))
    return 'You do not have permission to perform this action.';
  return error.message;
}

export default function EditInventoryPage() {
  const { inventoryId } = useParams<{ inventoryId: string }>();
  const router = useRouter();

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
  }, [inventoryId]);

  async function handleSubmit(payload: InventoryUpdatePayload) {
    setErrorMessage('');
    setSuccessMessage('');
    try {
      setSubmitting(true);
      const updated = await updateInventory(Number(inventoryId), payload);
      setInventory(updated);
      setSuccessMessage('Inventory updated successfully.');
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <button onClick={() => router.push('/manager/inventory')} className="text-sm text-gray-500 hover:text-gray-800">
          ← Back to inventory
        </button>
        <h1 className="mt-3 text-3xl font-bold">Update Inventory</h1>
        {inventory && (
          <p className="mt-2 text-sm text-gray-600">
            {inventory.DisplayName}
            {inventory.ProductId === null && (
              <span className="ml-2 rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-xs">Warehouse-only</span>
            )}
          </p>
        )}
      </div>

      {successMessage && <div className="mb-4 rounded-md border border-green-300 bg-green-50 px-4 py-3 text-green-800">{successMessage}</div>}
      {errorMessage && <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800">{errorMessage}</div>}

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 animate-pulse">
          <div className="h-4 w-1/3 bg-gray-100 rounded mb-3" />
          <div className="h-4 w-1/2 bg-gray-100 rounded" />
        </div>
      ) : inventory ? (
        <QuantityUpdateForm inventory={inventory} onSubmit={handleSubmit} submitting={submitting} />
      ) : null}
    </main>
  );
}