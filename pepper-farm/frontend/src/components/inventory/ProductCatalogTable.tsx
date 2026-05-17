'use client';

import Link from 'next/link';
import { InventoryResponse } from '@/types/inventory';
import { useLanguage } from '@/context/LanguageContext';

interface Props {
  items: InventoryResponse[];
}

export default function ProductCatalogTable({ items }: Props) {
  const { t } = useLanguage();
  const inv = t.inventory;

  return (
    <div dir="ltr" className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3">{inv.colItem}</th>
            <th className="px-4 py-3">{inv.colType}</th>
            <th className="px-4 py-3">{inv.colLocation}</th>
            <th className="px-4 py-3">{inv.colWarehouse}</th>
            <th className="px-4 py-3">{inv.colInStore}</th>
            <th className="px-4 py-3">{inv.colLastUpdated}</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const isProduct = row.ProductId !== null;
            const inStore = row.AllocatedQuantity;
            const outOfStock = isProduct && inStore === 0;
            return (
              <tr key={row.InventoryId} className="border-t border-gray-100">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {row.DisplayName ?? `Inventory #${row.InventoryId}`}
                </td>
                <td className="px-4 py-3 text-xs">
                  {isProduct ? (
                    <span className="rounded-full bg-green-50 text-green-700 border border-green-200 px-2 py-0.5">
                      {inv.typeProduct}
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-50 text-gray-600 border border-gray-200 px-2 py-0.5">
                      {inv.typeWarehouseOnly}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {row.Location ?? <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-700" dir="ltr">{row.WarehouseQuantity}</td>
                <td className="px-4 py-3">
                  {!isProduct ? (
                    <span className="text-gray-400">—</span>
                  ) : outOfStock ? (
                    <span className="rounded-full bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-xs">
                      {inv.outOfStock}
                    </span>
                  ) : (
                    <span className="text-gray-700" dir="ltr">{inStore}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs" dir="ltr">
                  {new Date(row.LastUpdatedAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/manager/inventory/${row.InventoryId}/edit`}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    {inv.update}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
