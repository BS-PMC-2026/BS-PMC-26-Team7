'use client';

import { ChangeEvent, FormEvent, useState } from 'react';
import { InventoryResponse, InventoryUpdatePayload } from '@/types/inventory';

interface Props {
  inventory: InventoryResponse;
  onSubmit: (payload: InventoryUpdatePayload) => Promise<void>;
  submitting: boolean;
}

type FormState = {
  WarehouseQuantity: string;
  AllocatedQuantity: string;
  Location: string;
};

function validateForm(form: FormState, isProduct: boolean): string | null {
  if (form.WarehouseQuantity.trim() === '') return 'Warehouse quantity is required.';
  const warehouse = Number(form.WarehouseQuantity);
  if (!Number.isInteger(warehouse) || Number.isNaN(warehouse))
    return 'Warehouse quantity must be a whole number.';
  if (warehouse < 0) return 'Warehouse quantity cannot be negative.';

  if (isProduct) {
    if (form.AllocatedQuantity.trim() === '') return 'Store quantity is required.';
    const allocated = Number(form.AllocatedQuantity);
    if (!Number.isInteger(allocated) || Number.isNaN(allocated))
      return 'Store quantity must be a whole number.';
    if (allocated < 0) return 'Store quantity cannot be negative.';
    if (allocated > warehouse)
      return 'Store (allocated) quantity cannot exceed warehouse quantity.';
  }
  return null;
}

export default function QuantityUpdateForm({ inventory, onSubmit, submitting }: Props) {
  const isProduct = inventory.ProductId !== null;
  const [form, setForm] = useState<FormState>({
    WarehouseQuantity: String(inventory.WarehouseQuantity),
    AllocatedQuantity: String(inventory.AllocatedQuantity),
    Location: inventory.Location ?? '',
  });
  const [errorMessage, setErrorMessage] = useState('');

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage('');
    const err = validateForm(form, isProduct);
    if (err) {
      setErrorMessage(err);
      return;
    }
    await onSubmit({
      WarehouseQuantity: Number(form.WarehouseQuantity),
      AllocatedQuantity: isProduct ? Number(form.AllocatedQuantity) : 0,
      Location: form.Location.trim() || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      {errorMessage && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800">{errorMessage}</div>
      )}

      <div>
        <label htmlFor="WarehouseQuantity" className="mb-1 block text-sm font-medium">Warehouse Quantity *</label>
        <input id="WarehouseQuantity" name="WarehouseQuantity" type="number" min="0" step="1"
          value={form.WarehouseQuantity} onChange={handleChange}
          className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-black" />
        <p className="mt-1 text-xs text-gray-500">Actual units in the farm warehouse (source of truth).</p>
      </div>

      {isProduct && (
        <div>
          <label htmlFor="AllocatedQuantity" className="mb-1 block text-sm font-medium">Store (Allocated) Quantity *</label>
          <input id="AllocatedQuantity" name="AllocatedQuantity" type="number" min="0" step="1"
            value={form.AllocatedQuantity} onChange={handleChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-black" />
          <p className="mt-1 text-xs text-gray-500">Units exposed in the customer catalog. Must be ≤ warehouse quantity.</p>
        </div>
      )}

      <div>
        <label htmlFor="Location" className="mb-1 block text-sm font-medium">Warehouse Location</label>
        <input id="Location" name="Location" type="text" maxLength={200}
          value={form.Location} onChange={handleChange}
          placeholder="e.g. Aisle 3, Shelf B"
          className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-black" />
      </div>

      <button type="submit" disabled={submitting}
        className="rounded-md bg-black px-5 py-2 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
        {submitting ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}