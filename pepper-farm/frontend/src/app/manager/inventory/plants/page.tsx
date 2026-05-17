'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { getInventoryByVariety } from '@/services/inventory';
import { InventoryByVariety } from '@/types/inventory';
import { useLanguage } from '@/context/LanguageContext';

export default function PlantsByVarietyPage() {
  const { t } = useLanguage();
  const inv = t.inventory;
  const [rows, setRows] = useState<InventoryByVariety[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try { setRows(await getInventoryByVariety()); }
    catch { setLoadError(inv.failedToLoadPlants); }
    finally { setLoading(false); }
  }, [inv.failedToLoadPlants]);

  useEffect(() => { load(); }, [load]);

  function toggle(id: number) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="min-h-screen">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-10 flex items-start justify-between">
          <PageHeader
            label={inv.label}
            title={inv.plantsTitle}
            subtitle={inv.plantsSubtitle}
          />
          <Link href="/manager/inventory"
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
            {inv.backToInventory}
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
          <EmptyState icon="🌱" title={inv.noVarieties} description={inv.noVarietiesDesc} />
        ) : (
          <div dir="ltr" className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3"></th>
                  <th className="px-4 py-3">{inv.colVariety}</th>
                  <th className="px-4 py-3">{inv.colPlantCount}</th>
                  <th className="px-4 py-3">{inv.colTotalWarehouse}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const open = !!expanded[r.PepperId];
                  return (
                    <React.Fragment key={r.PepperId}>
                      <tr
                        className="border-t border-gray-100 cursor-pointer hover:bg-gray-50"
                        onClick={() => toggle(r.PepperId)}
                      >
                        <td className="px-4 py-3 text-gray-500 w-6">{open ? '▾' : '▸'}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{r.PepperName}</td>
                        <td className="px-4 py-3 text-gray-700" dir="ltr">{r.PlantCount}</td>
                        <td className="px-4 py-3 text-gray-700" dir="ltr">{r.TotalWarehouseQuantity}</td>
                      </tr>
                      {open && (
                        <tr key={`p-${r.PepperId}`} className="bg-gray-50">
                          <td></td>
                          <td colSpan={3} className="px-4 py-3">
                            {r.Plants.length === 0 ? (
                              <p className="text-sm text-gray-500 italic">{inv.noPlantsForVariety}</p>
                            ) : (
                              <table className="min-w-full text-xs">
                                <thead className="text-gray-500">
                                  <tr>
                                    <th className="text-left py-1 pr-4">{inv.colPlantId}</th>
                                    <th className="text-left py-1 pr-4">{inv.colPlantCode}</th>
                                    <th className="text-left py-1 pr-4">{t.tasks.status}</th>
                                    <th className="text-left py-1 pr-4">{inv.colZone}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.Plants.map((p) => (
                                    <tr key={p.PlantId} className="border-t border-gray-200">
                                      <td className="py-1 pr-4 text-gray-700" dir="ltr">#{p.PlantId}</td>
                                      <td className="py-1 pr-4 text-gray-900 font-medium" dir="ltr">{p.PlantCode}</td>
                                      <td className="py-1 pr-4 text-gray-600">{p.Status ?? '—'}</td>
                                      <td className="py-1 pr-4 text-gray-600" dir="ltr">{p.ZoneId ?? '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
