'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { getInventoryByVariety } from '@/services/inventory';
import { InventoryByVariety } from '@/types/inventory';

export default function PlantsByVarietyPage() {
  const [rows, setRows] = useState<InventoryByVariety[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try { setRows(await getInventoryByVariety()); }
    catch { setLoadError('Failed to load plants by variety.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggle(id: number) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-10 flex items-start justify-between">
          <PageHeader
            label="PepperFarm"
            title="Plants by Variety"
            subtitle="Amount of plants and total warehouse stock per variety. Click a row to see the individual plants."
          />
          <Link href="/manager/inventory"
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
            ← Back to Inventory
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {loadError && <Alert variant="info" className="mb-6">{loadError}</Alert>}
        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
            <div className="h-4 w-1/3 bg-gray-100 rounded mb-3" />
            <div className="h-4 w-1/2 bg-gray-100 rounded" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon="🌱" title="No varieties" description="No active pepper varieties to show." />
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3"></th>
                  <th className="px-4 py-3">Variety</th>
                  <th className="px-4 py-3"># Plants</th>
                  <th className="px-4 py-3">Total warehouse units</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const open = !!expanded[r.PepperId];
                  return (
                    <>
                      <tr
                        key={`v-${r.PepperId}`}
                        className="border-t border-gray-100 cursor-pointer hover:bg-gray-50"
                        onClick={() => toggle(r.PepperId)}
                      >
                        <td className="px-4 py-3 text-gray-500 w-6">{open ? '▾' : '▸'}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{r.PepperName}</td>
                        <td className="px-4 py-3 text-gray-700">{r.PlantCount}</td>
                        <td className="px-4 py-3 text-gray-700">{r.TotalWarehouseQuantity}</td>
                      </tr>
                      {open && (
                        <tr key={`p-${r.PepperId}`} className="bg-gray-50">
                          <td></td>
                          <td colSpan={3} className="px-4 py-3">
                            {r.Plants.length === 0 ? (
                              <p className="text-sm text-gray-500 italic">No plants recorded for this variety.</p>
                            ) : (
                              <table className="min-w-full text-xs">
                                <thead className="text-gray-500">
                                  <tr>
                                    <th className="text-left py-1 pr-4">Plant ID</th>
                                    <th className="text-left py-1 pr-4">Plant Code</th>
                                    <th className="text-left py-1 pr-4">Status</th>
                                    <th className="text-left py-1 pr-4">Zone</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.Plants.map((p) => (
                                    <tr key={p.PlantId} className="border-t border-gray-200">
                                      <td className="py-1 pr-4 text-gray-700">#{p.PlantId}</td>
                                      <td className="py-1 pr-4 text-gray-900 font-medium">{p.PlantCode}</td>
                                      <td className="py-1 pr-4 text-gray-600">{p.Status ?? '—'}</td>
                                      <td className="py-1 pr-4 text-gray-600">{p.ZoneId ?? '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}