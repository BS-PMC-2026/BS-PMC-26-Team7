'use client';

import { ChangeEvent, FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createInventoryItem } from '@/services/inventory';
import { InventoryCreatePayload } from '@/types/inventory';

type Mode = 'choose' | 'warehouse';

type FormState = {
  ItemName: string;
  Location: string;
  WarehouseQuantity: string;
};

const initial: FormState = { ItemName: '', Location: '', WarehouseQuantity: '0' };

export default function AddInventoryItemPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('choose');
  const [form, setForm] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function validate(): string | null {
    if (!form.ItemName.trim()) return 'Item name is required.';
    const qty = Number(form.WarehouseQuantity);
    if (!Number.isInteger(qty) || Number.isNaN(qty) || qty < 0)
      return 'Warehouse quantity must be a non-negative whole number.';
    return null;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    const err = validate();
    if (err) { setErrorMessage(err); return; }

    const payload: InventoryCreatePayload = {
      ItemName: form.ItemName.trim(),
      Location: form.Location.trim() || null,
      WarehouseQuantity: Number(form.WarehouseQuantity),
    };

    try {
      setSubmitting(true);
      await createInventoryItem(payload);
      setSuccessMessage('Inventory item created.');
      setForm(initial);
      setTimeout(() => router.push('/manager/inventory'), 800);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create inventory item.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <button onClick={() => router.push('/manager/inventory')} className="text-sm text-gray-500 hover:text-gray-800">
          ← Back to inventory
        </button>
        <h1 className="mt-3 text-3xl font-bold">Add Inventory Item</h1>
      </div>

      {mode === 'choose' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Is this item going to be sold in the store, or is it warehouse-only (seeds, fertilizer, tools, raw stock)?
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <button
              onClick={() => router.push('/manager/products/create')}
              className="text-left bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition"
            >
              <h3 className="font-semibold text-gray-900">🛒 Product for the store</h3>
              <p className="text-sm text-gray-500 mt-1">
                Create it as a Product. Its inventory row will be created automatically, and you can set quantities afterward.
              </p>
            </button>
            <button
              onClick={() => setMode('warehouse')}
              className="text-left bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition"
            >
              <h3 className="font-semibold text-gray-900">📦 Warehouse-only item</h3>
              <p className="text-sm text-gray-500 mt-1">
                Not sold in the store. Tracks only warehouse quantity and location (no allocation).
              </p>
            </button>
          </div>
        </div>
      )}

      {mode === 'warehouse' && (
        <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          {successMessage && (
            <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-green-800">{successMessage}</div>
          )}
          {errorMessage && (
            <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800">{errorMessage}</div>
          )}

          <div>
            <label htmlFor="ItemName" className="mb-1 block text-sm font-medium">Item Name *</label>
            <input id="ItemName" name="ItemName" value={form.ItemName} onChange={handleChange}
              maxLength={200}
              placeholder="e.g. Fertilizer 5kg, Seed pack - Jalapeño"
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-black" />
          </div>

          <div>
            <label htmlFor="Location" className="mb-1 block text-sm font-medium">Warehouse Location</label>
            <input id="Location" name="Location" value={form.Location} onChange={handleChange}
              maxLength={200}
              placeholder="e.g. Aisle 3, Shelf B"
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-black" />
          </div>

          <div>
            <label htmlFor="WarehouseQuantity" className="mb-1 block text-sm font-medium">Warehouse Quantity *</label>
            <input id="WarehouseQuantity" name="WarehouseQuantity" type="number" min="0" step="1"
              value={form.WarehouseQuantity} onChange={handleChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-black" />
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={submitting}
              className="rounded-md bg-black px-5 py-2 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Saving...' : 'Create'}
            </button>
            <button type="button" onClick={() => setMode('choose')}
              className="rounded-md border border-gray-300 px-5 py-2 text-gray-700 hover:bg-gray-50">
              Back
            </button>
          </div>
        </form>
      )}
    </main>
  );
}