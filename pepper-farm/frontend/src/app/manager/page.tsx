'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  Droplets,
  Map as MapIcon,
  Thermometer,
  UserCircle,
} from 'lucide-react';
import FarmMap, { MapFilter } from '@/components/map/FarmMap';
import Alert from '@/components/ui/Alert';
import { useLanguage } from '@/context/LanguageContext';
import { getManagerDashboardData, ManagerDashboardData } from '@/lib/managerDashboardApi';
import { InventoryResponse } from '@/types/inventory';
import { Task } from '@/types/task';

const OPEN_TASK_STATUSES = new Set(['todo', 'pending', 'in_progress', 'in progress', 'not_completed', 'not completed']);
const LOW_STOCK_LIMIT = 5;
const STORE_LOW_LIMIT = 2;

function isOpenTask(task: Task): boolean {
  return OPEN_TASK_STATUSES.has(String(task.status).toLowerCase());
}

function displayDate(value: string | null, locale: string, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function latestReadingAge(readings: ManagerDashboardData['latestReadings'], empty: string): string {
  if (readings.length === 0) return empty;
  const latest = readings
    .map((reading) => new Date(`${reading.SampleTimeUtc}${reading.SampleTimeUtc.endsWith('Z') ? '' : 'Z'}`).getTime())
    .filter((time) => !Number.isNaN(time))
    .sort((a, b) => b - a)[0];

  if (!latest) return empty;
  const minutes = Math.max(0, Math.floor((Date.now() - latest) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function isInventoryAlert(item: InventoryResponse): boolean {
  const isProduct = item.ProductId !== null;
  return (
    item.WarehouseQuantity <= LOW_STOCK_LIMIT ||
    (isProduct && item.AllocatedQuantity <= STORE_LOW_LIMIT) ||
    item.AllocatedQuantity > item.WarehouseQuantity
  );
}

function inventoryStatus(item: InventoryResponse, labels: { inStock: string; lowStock: string; outOfStock: string }) {
  const isProduct = item.ProductId !== null;
  if (item.WarehouseQuantity <= 0 || (isProduct && item.AllocatedQuantity <= 0)) {
    return { label: labels.outOfStock, className: 'bg-red-50 text-red-700 border-red-200' };
  }
  if (isInventoryAlert(item)) {
    return { label: labels.lowStock, className: 'bg-amber-50 text-amber-700 border-amber-200' };
  }
  return { label: labels.inStock, className: 'bg-green-50 text-green-700 border-green-200' };
}

function metricValue(value: number | null, unit: string): string {
  if (value === null) return 'N/A';
  return `${value.toFixed(1)}${unit}`;
}

export default function ManagerPage() {
  const { t, locale, dir } = useLanguage();
  const d = t.dashboard;
  const [data, setData] = useState<ManagerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [managerName, setManagerName] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<MapFilter>(null);

  useEffect(() => {
    const token = localStorage.getItem('token') ?? '';
    setManagerName(localStorage.getItem('fullName') ?? '');
    setLoading(true);
    setError(null);
    getManagerDashboardData(token)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : d.failedToLoad))
      .finally(() => setLoading(false));
  }, [d.failedToLoad]);

  const workersById = useMemo(() => {
    const map = new Map<number, string>();
    data?.users.forEach((user) => map.set(user.userId, user.fullName));
    return map;
  }, [data?.users]);

  const openTasks = useMemo(
    () => (data?.tasks ?? []).filter(isOpenTask).sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }),
    [data?.tasks],
  );

  const inventoryAlerts = useMemo(
    () => (data?.inventory ?? []).filter(isInventoryAlert),
    [data?.inventory],
  );

  const avgTemperature = average((data?.latestReadings ?? []).map((reading) => reading.Temperature));
  const avgHumidity = average((data?.latestReadings ?? []).map((reading) => reading.Humidity));
  const activeAnomalies = data?.anomalySummary?.activeAlerts ?? 0;
  const highSeverity = data?.anomalySummary?.highSeverity ?? 0;
  const affectedZones = data?.anomalySummary?.affectedZones ?? data?.zoneHealth.filter((zone) => zone.health !== 'normal').length ?? 0;
  const readingAge = latestReadingAge(data?.latestReadings ?? [], d.noSensorDataAvailable);
  const mapFilters: { id: NonNullable<MapFilter>; label: string }[] = [
    { id: 'pepper', label: t.map.filterPlantedPepper },
    { id: 'task', label: t.map.filterOpenTask },
    { id: 'sensor', label: t.map.filterSensorAnomaly },
  ];

  return (
    <main className="min-h-screen bg-[#F6F8F4]" dir={dir}>
      <div className="border-b border-green-100 bg-white/85">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-4 px-5 py-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-green-700">
              PepperFarm
            </p>
            <h1 className="text-3xl font-semibold text-gray-950">{d.title}</h1>
          </div>

          {managerName && (
            <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-800">
              <UserCircle className="h-4 w-4" />
              <span>{d.managerUser}</span>
              <span className="font-semibold" dir="auto">{managerName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[1800px] px-5 py-6">
        {error && <Alert variant="info" className="mb-5">{error}</Alert>}

        {loading ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(260px,0.65fr)_minmax(760px,2.4fr)_minmax(260px,0.75fr)]">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-80 animate-pulse rounded-xl border border-gray-200 bg-white" />
            ))}
          </div>
        ) : (
          <>
            <section className="grid gap-5 lg:grid-cols-[minmax(270px,0.65fr)_minmax(760px,2.4fr)_minmax(280px,0.75fr)]" dir="ltr">
              <DashboardCard title={d.openTasks} icon={<ClipboardList className="h-4 w-4" />} direction={dir}>
                {openTasks.length === 0 ? (
                  <EmptyMessage text={d.noOpenTasks} />
                ) : (
                  <div className="space-y-3">
                    {openTasks.slice(0, 7).map((task) => (
                      <article key={task.id} className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
                        <h3 className="text-sm font-semibold text-gray-900" dir="auto">{task.title}</h3>
                        <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-500">
                          <InfoRow label={d.dueDate} value={displayDate(task.dueDate, locale, d.noDueDate)} />
                          <InfoRow label={d.assignedTo} value={task.assignedToUserId ? workersById.get(task.assignedToUserId) ?? d.unknownWorker : d.unassigned} />
                        </dl>
                      </article>
                    ))}
                  </div>
                )}
              </DashboardCard>

              <DashboardCard title={d.farmMap} icon={<MapIcon className="h-4 w-4" />} className="min-w-0" direction={dir}>
                <div className="mb-3 flex flex-wrap items-center gap-2" dir={dir}>
                  {mapFilters.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setActiveFilter((current) => (current === filter.id ? null : filter.id))}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        activeFilter === filter.id
                          ? 'border-green-700 bg-green-700 text-white'
                          : 'border-green-100 bg-green-50 text-green-700 hover:border-green-300'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                  {activeFilter !== null && (
                    <button
                      type="button"
                      onClick={() => setActiveFilter(null)}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-500 transition hover:border-gray-300 hover:text-gray-700"
                    >
                      {t.common.clear}
                    </button>
                  )}
                </div>
                <div className="overflow-hidden rounded-lg border border-green-100 bg-[#FAFBF8] p-3" dir="ltr">
                  <FarmMap
                    plants={data?.plants ?? []}
                    activeFilter={activeFilter}
                    tasks={openTasks}
                    zoneHealth={data?.zoneHealth ?? []}
                    showLegend={false}
                  />
                </div>
              </DashboardCard>

              <DashboardCard title={d.deviationData} icon={<AlertTriangle className="h-4 w-4" />} direction={dir}>
                {(data?.latestReadings.length ?? 0) === 0 && activeAnomalies === 0 ? (
                  <EmptyMessage text={d.noSensorDataAvailable} />
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <StatTile label={d.activeAnomalies} value={String(activeAnomalies)} tone="red" />
                  <StatTile label={d.highSeverity} value={String(highSeverity)} tone="amber" />
                  <StatTile label={d.affectedZones} value={String(affectedZones)} tone="green" />
                  <StatTile label={d.latestReading} value={readingAge} tone="gray" />
                  <StatTile label={d.averageTemperature} value={metricValue(avgTemperature, '°C')} icon={<Thermometer className="h-4 w-4" />} tone="amber" />
                  <StatTile label={d.relativeHumidity} value={metricValue(avgHumidity, '%')} icon={<Droplets className="h-4 w-4" />} tone="blue" />
                </div>
              </DashboardCard>
            </section>

            <section className="mt-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-700">
                  <Boxes className="h-4 w-4" />
                </span>
                <h2 className="text-base font-semibold text-gray-900">{d.inventoryAlerts}</h2>
              </div>

              {inventoryAlerts.length === 0 ? (
                <EmptyMessage text={d.noInventoryAlerts} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase text-gray-500">
                      <tr className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                        <th className="px-3 py-3">{t.common.item}</th>
                        <th className="px-3 py-3">{d.currentStock}</th>
                        <th className="px-3 py-3">{d.warehouse}</th>
                        <th className="px-3 py-3">{d.inStore}</th>
                        <th className="px-3 py-3">{d.requiredStock}</th>
                        <th className="px-3 py-3">{d.status}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryAlerts.map((item) => {
                        const status = inventoryStatus(item, d);
                        return (
                          <tr key={item.InventoryId} className="border-b border-gray-100 last:border-0">
                            <td className="px-3 py-3 font-medium text-gray-900" dir="auto">
                              {item.DisplayName ?? item.ProductName ?? item.ItemName ?? `Inventory #${item.InventoryId}`}
                            </td>
                            <td className="px-3 py-3 text-gray-700" dir="ltr">
                              {item.ProductId === null ? item.WarehouseQuantity : item.AllocatedQuantity}
                            </td>
                            <td className="px-3 py-3 text-gray-700" dir="ltr">{item.WarehouseQuantity}</td>
                            <td className="px-3 py-3 text-gray-700" dir="ltr">{item.ProductId === null ? 'N/A' : item.AllocatedQuantity}</td>
                            <td className="px-3 py-3 text-gray-400" dir="ltr">N/A</td>
                            <td className="px-3 py-3">
                              <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${status.className}`}>
                                {status.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function DashboardCard({
  title,
  icon,
  className = '',
  direction,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  className?: string;
  direction: 'ltr' | 'rtl';
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className}`} dir={direction}>
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-700">{icon}</span>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
      {text}
    </div>
  );
}

function InfoRow({ label, value, valueDir = 'auto' }: { label: string; value: string; valueDir?: 'auto' | 'ltr' }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt>{label}</dt>
      <dd className="font-medium text-gray-800" dir={valueDir}>{value}</dd>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone: 'red' | 'amber' | 'green' | 'blue' | 'gray';
}) {
  const tones = {
    red: 'bg-red-50 text-red-700 border-red-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    gray: 'bg-gray-50 text-gray-700 border-gray-100',
  };

  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-medium opacity-80">
        <span>{label}</span>
        {icon}
      </div>
      <p className="text-xl font-semibold" dir="ltr">{value}</p>
    </div>
  );
}
