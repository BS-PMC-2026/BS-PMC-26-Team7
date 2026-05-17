'use client';

import { ChangeEvent, FormEvent, useState } from 'react';
import { InventoryResponse, InventoryUpdatePayload } from '@/types/inventory';
import { useLanguage } from '@/context/LanguageContext';

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

export default function QuantityUpdateForm({ inventory, onSubmit, submitting }: Props) {
  const { t } = useLanguage();
  const inv = t.inventory;
  const isProduct = inventory.ProductId !== null;
  const [form, setForm] = useState<FormState>({
    WarehouseQuantity: String(inventory.WarehouseQuantity),
    AllocatedQuantity: String(inventory.AllocatedQuantity),
    Location: inventory.Location ?? '',
  });
  const [errorMessage, setErrorMessage] = useState('');

  function validateForm(f: FormState): string | null {
    if (f.WarehouseQuantity.trim() === '') return inv.errWarehouseRequired;
    const warehouse = Number(f.WarehouseQuantity);
    if (!Number.isInteger(warehouse) || Number.isNaN(warehouse)) return inv.errWarehouseWholeNumber;
    if (warehouse < 0) return inv.errWarehouseNegative;

    if (isProduct) {
      if (f.AllocatedQuantity.trim() === '') return inv.errStoreRequired;
      const allocated = Number(f.AllocatedQuantity);
      if (!Number.isInteger(allocated) || Number.isNaN(allocated)) return inv.errStoreWholeNumber;
      if (allocated < 0) return inv.errStoreNegative;
      if (allocated > warehouse) return inv.errStoreExceedsWarehouse;
    }
    return null;
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage('');
    const err = validateForm(form);
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
        <label htmlFor="WarehouseQuantity" className="mb-1 block text-sm font-medium">{inv.warehouseQty}</label>
        <input id="WarehouseQuantity" name="WarehouseQuantity" type="number" min="0" step="1"
          value={form.WarehouseQuantity} onChange={handleChange}
          className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-black" dir="ltr" />
        <p className="mt-1 text-xs text-gray-500">{inv.warehouseQtyHint}</p>
      </div>

      {isProduct && (
        <div>
          <label htmlFor="AllocatedQuantity" className="mb-1 block text-sm font-medium">{inv.storeQty}</label>
          <input id="AllocatedQuantity" name="AllocatedQuantity" type="number" min="0" step="1"
            value={form.AllocatedQuantity} onChange={handleChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-black" dir="ltr" />
          <p className="mt-1 text-xs text-gray-500">{inv.storeQtyHint}</p>
        </div>
      )}

      <div>
        <label htmlFor="Location" className="mb-1 block text-sm font-medium">{inv.warehouseLocation}</label>
        <input id="Location" name="Location" type="text" maxLength={200}
          value={form.Location} onChange={handleChange}
          placeholder={inv.warehouseLocationPlaceholder}
          className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-black" />
      </div>

      <button type="submit" disabled={submitting}
        className="rounded-md bg-black px-5 py-2 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
        {submitting ? t.common.saving : t.common.save}
      </button>
    </form>
  );
}
