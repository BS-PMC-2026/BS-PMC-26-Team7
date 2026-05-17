'use client';

import { ChangeEvent, FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createInventoryItem } from '@/services/inventory';
import { InventoryCreatePayload } from '@/types/inventory';
import { useLanguage } from '@/context/LanguageContext';

type Mode = 'choose' | 'warehouse';

type FormState = {
  ItemName: string;
  Location: string;
  WarehouseQuantity: string;
};

const initial: FormState = { ItemName: '', Location: '', WarehouseQuantity: '0' };

export default function AddInventoryItemPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const inv = t.inventory;
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
    if (!form.ItemName.trim()) return inv.errItemNameRequired;
    const qty = Number(form.WarehouseQuantity);
    if (!Number.isInteger(qty) || Number.isNaN(qty) || qty < 0)
      return inv.errWarehouseNonNegative;
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
      setSuccessMessage(inv.itemCreated);
      setForm(initial);
      setTimeout(() => router.push('/manager/inventory'), 800);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : inv.failedToCreate);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <button onClick={() => router.push('/manager/inventory')} className="text-sm text-gray-500 hover:text-gray-800">
          {inv.backToInventory}
        </button>
        <h1 className="mt-3 text-3xl font-bold">{inv.addItemTitle}</h1>
      </div>

      {mode === 'choose' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {inv.chooseTypeDesc}
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <button
              onClick={() => router.push('/manager/products/create')}
              className="text-left bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition"
            >
              <h3 className="font-semibold text-gray-900">{inv.chooseProduct}</h3>
              <p className="text-sm text-gray-500 mt-1">{inv.chooseProductDesc}</p>
            </button>
            <button
              onClick={() => setMode('warehouse')}
              className="text-left bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition"
            >
              <h3 className="font-semibold text-gray-900">{inv.chooseWarehouse}</h3>
              <p className="text-sm text-gray-500 mt-1">{inv.chooseWarehouseDesc}</p>
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
            <label htmlFor="ItemName" className="mb-1 block text-sm font-medium">{inv.itemName}</label>
            <input id="ItemName" name="ItemName" value={form.ItemName} onChange={handleChange}
              maxLength={200}
              placeholder={inv.itemNamePlaceholder}
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-black" />
          </div>

          <div>
            <label htmlFor="Location" className="mb-1 block text-sm font-medium">{inv.warehouseLocation}</label>
            <input id="Location" name="Location" value={form.Location} onChange={handleChange}
              maxLength={200}
              placeholder={inv.warehouseLocationPlaceholder}
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-black" />
          </div>

          <div>
            <label htmlFor="WarehouseQuantity" className="mb-1 block text-sm font-medium">{inv.warehouseQty}</label>
            <input id="WarehouseQuantity" name="WarehouseQuantity" type="number" min="0" step="1"
              value={form.WarehouseQuantity} onChange={handleChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-black" dir="ltr" />
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={submitting}
              className="rounded-md bg-black px-5 py-2 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? t.common.saving : t.common.create}
            </button>
            <button type="button" onClick={() => setMode('choose')}
              className="rounded-md border border-gray-300 px-5 py-2 text-gray-700 hover:bg-gray-50">
              {t.common.back}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
