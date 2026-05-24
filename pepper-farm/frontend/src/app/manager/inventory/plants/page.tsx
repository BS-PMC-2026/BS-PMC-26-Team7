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
      <div className="border-b border-[var(--color-border)]/60">
        <div className="max-w-6xl mx-auto px-6 py-10 flex items-start justify-between">
          <PageHeader
            label={inv.label}
            title={inv.plantsTitle}
            subtitle={inv.plantsSubtitle}
          />
          <Link href="/manager/inventory"
            className="border border-[var(--color-border)] text-[var(--color-foreground)] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--color-muted)] transition">
            {inv.backToInventory}
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {loadError && <Alert variant="info" className="mb-6">{loadError}</Alert>}
        {loading ? (
          <div className="bg-white rounded-lg border border-[var(--color-border)] p-6 animate-pulse">
            <div className="h-4 w-1/3 bg-[var(--color-muted)] rounded mb-3" />
            <div className="h-4 w-1/2 bg-[var(--color-muted)] rounded" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon="🌱" title={inv.noVarieties} description={inv.noVarietiesDesc} />
        ) : (
          <div dir="ltr" className="overflow-x-auto border border-[var(--color-border)] rounded-lg bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--color-muted)] text-left text-xs uppercase text-[var(--color-muted-foreground)]">
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
                        className="border-t border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-muted)]"
                        onClick={() => toggle(r.PepperId)}
                      >
                        <td className="px-4 py-3 text-[var(--color-muted-foreground)] w-6">{open ? '▾' : '▸'}</td>
                        <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">{r.PepperName}</td>
                        <td className="px-4 py-3 text-[var(--color-foreground)]" dir="ltr">{r.PlantCount}</td>
                        <td className="px-4 py-3 text-[var(--color-foreground)]" dir="ltr">{r.TotalWarehouseQuantity}</td>
                      </tr>
                      {open && (
                        <tr key={`p-${r.PepperId}`} className="bg-[var(--color-muted)]">
                          <td></td>
                          <td colSpan={3} className="px-4 py-3">
                            {r.Plants.length === 0 ? (
                              <p className="text-sm text-[var(--color-muted-foreground)] italic">{inv.noPlantsForVariety}</p>
                            ) : (
                              <table className="min-w-full text-xs">
                                <thead className="text-[var(--color-muted-foreground)]">
                                  <tr>
                                    <th className="text-left py-1 pr-4">{inv.colPlantId}</th>
                                    <th className="text-left py-1 pr-4">{inv.colPlantCode}</th>
                                    <th className="text-left py-1 pr-4">{t.tasks.status}</th>
                                    <th className="text-left py-1 pr-4">{inv.colZone}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.Plants.map((p) => (
                                    <tr key={p.PlantId} className="border-t border-[var(--color-border)]">
                                      <td className="py-1 pr-4 text-[var(--color-foreground)]" dir="ltr">#{p.PlantId}</td>
                                      <td className="py-1 pr-4 text-[var(--color-foreground)] font-medium" dir="ltr">{p.PlantCode}</td>
                                      <td className="py-1 pr-4 text-[var(--color-muted-foreground)]">{p.Status ?? '—'}</td>
                                      <td className="py-1 pr-4 text-[var(--color-muted-foreground)]" dir="ltr">{p.ZoneId ?? '—'}</td>
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
