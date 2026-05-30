'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/ui/PageHeader';
import { getInventoryByVariety } from '@/services/inventory';
import { createPlant, updatePlantStatus } from '@/services/plants';
import { getZones, ZoneSummary } from '@/services/zones';
import { InventoryByVariety } from '@/types/inventory';
import { useLanguage } from '@/context/LanguageContext';

const PLANT_STATUSES = ['Healthy', 'Growing', 'Sick', 'Harvested', 'Dead'];

function statusBadgeClass(status: string | null): string {
  switch ((status ?? '').toLowerCase()) {
    case 'healthy':  return 'bg-green-100 text-green-800';
    case 'growing':  return 'bg-yellow-100 text-yellow-800';
    case 'sick':
    case 'diseased': return 'bg-red-100 text-red-800';
    case 'harvested': return 'bg-blue-100 text-blue-800';
    case 'dead':     return 'bg-gray-200 text-gray-600';
    default:         return 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]';
  }
}

type SortCol = 'name' | 'plants' | 'warehouse';

export default function PlantsByVarietyPage() {
  const { t } = useLanguage();
  const inv = t.inventory;

  // ── Data ──────────────────────────────────────────────────────────────────
  const [rows, setRows]         = useState<InventoryByVariety[]>([]);
  const [zones, setZones]       = useState<ZoneSummary[]>([]);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Toolbar state ─────────────────────────────────────────────────────────
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortCol, setSortCol]   = useState<SortCol>('name');
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('asc');

  // ── Add-plant modal ────────────────────────────────────────────────────────
  const [addModal, setAddModal] = useState<{ pepperId: number; pepperName: string } | null>(null);
  const [addForm, setAddForm]   = useState({ PlantCode: '', ZoneId: '', PlantedAt: '', Status: '', Notes: '' });
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  // ── Inline status update ───────────────────────────────────────────────────
  const [statusUpdating, setStatusUpdating] = useState<number | null>(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([getInventoryByVariety(), getZones()])
      .then(([data, zoneData]) => {
        if (!cancelled) { setRows(data); setZones(zoneData); }
      })
      .catch(() => { if (!cancelled) setLoadError(inv.failedToLoadPlants); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [inv.failedToLoadPlants]);

  // ── Filtered + sorted rows ─────────────────────────────────────────────────
  const displayRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = rows.filter((v) => {
      if (q && !v.PepperName.toLowerCase().includes(q) &&
          !v.Plants.some((p) => p.PlantCode.toLowerCase().includes(q))) return false;
      if (statusFilter && !v.Plants.some((p) =>
          (p.Status ?? '').toLowerCase() === statusFilter.toLowerCase())) return false;
      return true;
    });
    return [...r].sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'name')      cmp = a.PepperName.localeCompare(b.PepperName);
      else if (sortCol === 'plants')    cmp = a.PlantCount - b.PlantCount;
      else                         cmp = a.TotalWarehouseQuantity - b.TotalWarehouseQuantity;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, search, statusFilter, sortCol, sortDir]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function toggle(id: number) {
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
  }
  function expandAll() {
    setExpanded(Object.fromEntries(displayRows.map((r) => [r.PepperId, true])));
  }
  function collapseAll() { setExpanded({}); }

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
  }
  function sortIcon(col: SortCol) {
    if (sortCol !== col) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  function exportCsv() {
    const lines = ['Variety,Plant ID,Plant Code,Status,Zone'];
    for (const v of displayRows) {
      if (v.Plants.length === 0) {
        lines.push(`"${v.PepperName}",,,,`);
      } else {
        for (const p of v.Plants) {
          lines.push(
            `"${v.PepperName}",${p.PlantId},"${p.PlantCode}","${p.Status ?? ''}","${p.ZoneName ?? p.ZoneId ?? ''}"`,
          );
        }
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'plants-by-variety.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function openAddModal(pepperId: number, pepperName: string) {
    setAddModal({ pepperId, pepperName });
    setAddForm({ PlantCode: '', ZoneId: '', PlantedAt: '', Status: '', Notes: '' });
    setAddError(null);
  }

  async function handleAddPlant(e: React.FormEvent) {
    e.preventDefault();
    if (!addModal) return;
    setAddLoading(true);
    setAddError(null);
    try {
      await createPlant({
        PlantCode: addForm.PlantCode.trim(),
        PepperId:  addModal.pepperId,
        ZoneId:    addForm.ZoneId ? Number(addForm.ZoneId) : undefined,
        PlantedAt: addForm.PlantedAt || undefined,
        Status:    addForm.Status || undefined,
        Notes:     addForm.Notes.trim() || undefined,
        IsActive:  true,
      });
      const data = await getInventoryByVariety();
      setRows(data);
      setAddModal(null);
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : inv.addPlantFailed);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleStatusChange(plantId: number, newStatus: string) {
    setStatusUpdating(plantId);
    try {
      await updatePlantStatus(plantId, newStatus || null);
      setRows((prev) =>
        prev.map((v) => ({
          ...v,
          StatusBreakdown: recalcBreakdown(
            v.Plants.map((p) => (p.PlantId === plantId ? { ...p, Status: newStatus || null } : p)),
          ),
          Plants: v.Plants.map((p) =>
            p.PlantId === plantId ? { ...p, Status: newStatus || null } : p,
          ),
        })),
      );
    } catch { /* silent — UI stays as-is */ }
    finally { setStatusUpdating(null); }
  }

  function recalcBreakdown(plants: InventoryByVariety['Plants']): Record<string, number> {
    const bd: Record<string, number> = {};
    for (const p of plants) { const k = p.Status || 'Unknown'; bd[k] = (bd[k] ?? 0) + 1; }
    return bd;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      {/* Page header */}
      <div className="border-b border-[var(--color-border)]/60">
        <div className="max-w-6xl mx-auto px-6 py-10 flex items-start justify-between">
          <PageHeader label={inv.label} title={inv.plantsTitle} subtitle={inv.plantsSubtitle} />
          <Link
            href="/manager/inventory"
            className="border border-[var(--color-border)] text-[var(--color-foreground)] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--color-muted)] transition"
          >
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
          <>
            {/* ── Toolbar ── */}
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              <input
                type="text"
                placeholder={inv.searchVarieties}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">{inv.allStatuses}</option>
                {PLANT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button onClick={expandAll}   className="text-sm px-3 py-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition">{inv.expandAll}</button>
              <button onClick={collapseAll} className="text-sm px-3 py-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition">{inv.collapseAll}</button>
              <button onClick={exportCsv}   className="text-sm px-3 py-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition">{inv.exportCsv}</button>
            </div>

            {/* ── Main table ── */}
            <div dir="ltr" className="overflow-x-auto border border-[var(--color-border)] rounded-lg bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--color-muted)] text-left text-xs uppercase text-[var(--color-muted-foreground)]">
                  <tr>
                    <th className="px-4 py-3 w-6" />
                    <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('name')}>
                      {inv.colVariety}{sortIcon('name')}
                    </th>
                    <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('plants')}>
                      {inv.colPlantCount}{sortIcon('plants')}
                    </th>
                    <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('warehouse')}>
                      {inv.colTotalWarehouse}{sortIcon('warehouse')}
                    </th>
                    <th className="px-4 py-3">{inv.statusBreakdown}</th>
                    <th className="px-4 py-3 w-28" />
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((r) => {
                    const open = !!expanded[r.PepperId];
                    return (
                      <React.Fragment key={r.PepperId}>
                        {/* Variety row */}
                        <tr
                          className="border-t border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-muted)]"
                          onClick={() => toggle(r.PepperId)}
                        >
                          <td className="px-4 py-3 text-[var(--color-muted-foreground)] w-6">
                            {open ? '▾' : '▸'}
                          </td>
                          <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">
                            {r.PepperName}
                          </td>
                          <td className="px-4 py-3 text-[var(--color-foreground)]" dir="ltr">
                            {r.PlantCount}
                          </td>
                          <td className="px-4 py-3 text-[var(--color-foreground)]" dir="ltr">
                            {r.TotalWarehouseQuantity}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(r.StatusBreakdown).map(([status, count]) => (
                                <Badge key={status} className={statusBadgeClass(status)}>
                                  {count} {status}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => openAddModal(r.PepperId, r.PepperName)}
                              className="text-xs px-2 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition whitespace-nowrap"
                            >
                              + {inv.addPlant}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded plants sub-table */}
                        {open && (
                          <tr className="bg-[var(--color-muted)]">
                            <td />
                            <td colSpan={5} className="px-4 py-3">
                              {r.Plants.length === 0 ? (
                                <p className="text-sm text-[var(--color-muted-foreground)] italic">
                                  {inv.noPlantsForVariety}
                                </p>
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
                                        <td className="py-1 pr-4 text-[var(--color-foreground)]" dir="ltr">
                                          #{p.PlantId}
                                        </td>
                                        <td className="py-1 pr-4 text-[var(--color-foreground)] font-medium" dir="ltr">
                                          {p.PlantCode}
                                        </td>
                                        <td className="py-1 pr-4">
                                          <select
                                            value={p.Status ?? ''}
                                            disabled={statusUpdating === p.PlantId}
                                            onChange={(e) => handleStatusChange(p.PlantId, e.target.value)}
                                            className={`text-xs rounded px-1.5 py-0.5 border-0 cursor-pointer focus:outline-none ${statusBadgeClass(p.Status)} disabled:opacity-50`}
                                          >
                                            <option value="">—</option>
                                            {PLANT_STATUSES.map((s) => (
                                              <option key={s} value={s}>{s}</option>
                                            ))}
                                          </select>
                                        </td>
                                        <td className="py-1 pr-4 text-[var(--color-muted-foreground)]" dir="ltr">
                                          {p.ZoneName ?? (p.ZoneId ? `Zone ${p.ZoneId}` : '—')}
                                        </td>
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
          </>
        )}
      </div>

      {/* ── Add Plant Modal ── */}
      {addModal && (
        <Modal onClose={() => setAddModal(null)}>
          <h2 className="text-lg font-semibold mb-1">{inv.addPlantTitle}</h2>
          <p className="text-sm text-[var(--color-muted-foreground)] mb-4">{addModal.pepperName}</p>
          {addError && <Alert variant="info" className="mb-3">{addError}</Alert>}
          <form onSubmit={handleAddPlant} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[var(--color-muted-foreground)] uppercase block mb-1">
                {inv.colPlantCode} *
              </label>
              <input
                required
                value={addForm.PlantCode}
                onChange={(e) => setAddForm((f) => ({ ...f, PlantCode: e.target.value }))}
                placeholder="e.g. PLT-001"
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--color-muted-foreground)] uppercase block mb-1">
                {inv.colZone}
              </label>
              <select
                value={addForm.ZoneId}
                onChange={(e) => setAddForm((f) => ({ ...f, ZoneId: e.target.value }))}
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">— {inv.noZone} —</option>
                {zones.map((z) => (
                  <option key={z.ZoneId} value={z.ZoneId}>{z.ZoneName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--color-muted-foreground)] uppercase block mb-1">
                {t.tasks.status}
              </label>
              <select
                value={addForm.Status}
                onChange={(e) => setAddForm((f) => ({ ...f, Status: e.target.value }))}
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="">— optional —</option>
                {PLANT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--color-muted-foreground)] uppercase block mb-1">
                {inv.plantedAt}
              </label>
              <input
                type="date"
                value={addForm.PlantedAt}
                onChange={(e) => setAddForm((f) => ({ ...f, PlantedAt: e.target.value }))}
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--color-muted-foreground)] uppercase block mb-1">
                {inv.notesLabel}
              </label>
              <textarea
                value={addForm.Notes}
                onChange={(e) => setAddForm((f) => ({ ...f, Notes: e.target.value }))}
                rows={2}
                className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAddModal(null)}
                className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition"
              >
                {inv.cancel}
              </button>
              <button
                type="submit"
                disabled={addLoading}
                className="px-4 py-2 text-sm rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 transition disabled:opacity-50"
              >
                {addLoading ? inv.saving : inv.addPlant}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
