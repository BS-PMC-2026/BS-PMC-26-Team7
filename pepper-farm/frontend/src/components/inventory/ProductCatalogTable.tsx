'use client';

import Link from 'next/link';
import { InventoryResponse } from '@/types/inventory';

interface Props {
  items: InventoryResponse[];
}

export default function ProductCatalogTable({ items }: Props) {
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Warehouse Qty</th>
            <th className="px-4 py-3">Store (Allocated) Qty</th>
            <th className="px-4 py-3">Last Updated</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.InventoryId} className="border-t border-gray-100">
              <td className="px-4 py-3 font-medium text-gray-900">
                {row.ProductName ?? `Product #${row.ProductId}`}
              </td>
              <td className="px-4 py-3 text-gray-700">{row.WarehouseQuantity}</td>
              <td className="px-4 py-3 text-gray-700">{row.AllocatedQuantity}</td>
              <td className="px-4 py-3 text-gray-500 text-xs">
                {new Date(row.LastUpdatedAt).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/manager/inventory/${row.ProductId}/edit`}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  ✏️ Update Quantity
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}