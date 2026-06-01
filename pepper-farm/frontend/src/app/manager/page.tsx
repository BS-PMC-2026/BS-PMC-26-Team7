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
import TaskProgressBar from '@/components/tasks/TaskProgressBar';
import WeatherCard from '@/components/weather/WeatherCard';
import { useLanguage } from '@/context/LanguageContext';
import { getManagerDashboardData, ManagerDashboardData } from '@/lib/managerDashboardApi';
import { groupDashboardTasks, isTaskOpen } from '@/lib/taskUrgency';
import { InventoryResponse } from '@/types/inventory';
import { Task } from '@/types/task';

const LOW_STOCK_LIMIT = 5;
const STORE_LOW_LIMIT = 2;

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
    return { label: labels.outOfStock, className: 'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-border)]' };
  }
  if (isInventoryAlert(item)) {
    return { label: labels.lowStock, className: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-border)]' };
  }
  return { label: labels.inStock, className: 'bg-[var(--color-secondary-light)] text-[var(--color-primary)] border-[var(--color-border)]' };
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
  const [showCompleted, setShowCompleted] = useState(false);

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

  // All open tasks — passed to FarmMap for zone highlighting
  const openTasks = useMemo(
    () => (data?.tasks ?? []).filter(isTaskOpen),
    [data?.tasks],
  );

  // Tasks grouped by urgency for the dashboard card
  const { overdue: overdueTasks, dueSoon: dueSoonTasks, normal: normalTasks, recentlyCompleted } = useMemo(
    () => groupDashboardTasks(data?.tasks ?? []),
    [data?.tasks],
  );

  const openTaskCount = overdueTasks.length + dueSoonTasks.length + normalTasks.length;

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
    { id: 'task',   label: t.map.filterOpenTask },
    { id: 'sensor', label: t.map.filterSensorAnomaly },
  ];

  // Legend items change with the active filter — mirrors FarmMap's internal FILTER_LEGENDS
  const legendItems = useMemo(() => {
    if (activeFilter === 'pepper') return [
      { label: t.map.legendHasPepper, color: 'rgba(22,163,74,0.18)',  border: '#16a34a' },
      { label: t.map.legendNoPepper,  color: 'rgba(209,213,219,0.5)', border: '#9ca3af' },
    ];
    if (activeFilter === 'task') return [
      { label: t.map.legendHasTasks, color: 'rgba(239,68,68,0.18)',  border: '#ef4444' },
      { label: t.map.legendNoTasks,  color: 'rgba(209,213,219,0.5)', border: '#9ca3af' },
    ];
    if (activeFilter === 'sensor') return [
      { label: t.map.legendSensorHigh,   color: 'rgba(239,68,68,0.2)',   border: '#ef4444' },
      { label: t.map.legendSensorMedium, color: 'rgba(249,115,22,0.18)', border: '#f97316' },
      { label: t.map.legendSensorNormal, color: 'rgba(74,222,128,0.2)',  border: '#4ade80' },
      { label: t.map.legendNoSensorData, color: 'rgba(229,231,235,0.6)', border: '#9ca3af' },
    ];
    // null — default alert view
    return [
      { label: t.map.legendBothAlerts,  color: 'rgba(220,38,38,0.2)',   border: '#dc2626' },
      { label: t.map.legendTaskAlert,   color: 'rgba(239,68,68,0.15)',  border: '#ef4444' },
      { label: t.map.legendSensorAlert, color: 'rgba(249,115,22,0.15)', border: '#f97316' },
      { label: t.map.legendNeutral,     color: 'transparent',           border: '#9ca3af' },
    ];
  }, [activeFilter, t.map]);

  return (
    <main className="min-h-screen bg-[#F6F8F4]" dir={dir}>
      <div className="border-b border-[var(--color-border)] bg-white/85">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-4 px-5 py-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
              PepperFarm
            </p>
            <h1 className="text-3xl font-semibold text-[var(--color-foreground)]">{d.title}</h1>
          </div>

          {managerName && (
            <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-secondary-light)] px-3 py-2 text-sm text-[var(--color-primary)]">
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
              <div key={item} className="h-80 animate-pulse rounded-xl border border-[var(--color-border)] bg-white" />
            ))}
          </div>
        ) : (
          <>
            <section className="grid gap-5 lg:grid-cols-[minmax(270px,0.65fr)_minmax(760px,2.4fr)_minmax(280px,0.75fr)]" dir="ltr">

              {/* ── Open Tasks card ── */}
              <DashboardCard
                title={d.openTasks}
                icon={<ClipboardList className="h-4 w-4" />}
                direction={dir}
              >
                {openTaskCount === 0 && recentlyCompleted.length === 0 ? (
                  <EmptyMessage text={d.noOpenTasks} />
                ) : (
                  <>
                    {/* Count + toggle */}
                    <div className="mb-2 flex items-center justify-between gap-2">
                      {openTaskCount > 0 && (
                        <p className="text-xs font-medium text-[var(--color-muted-foreground)]">
                          {d.openTasksCount.replace('{count}', String(openTaskCount))}
                        </p>
                      )}
                      {recentlyCompleted.length > 0 && (
                        <button
                          type="button"
                          data-testid="toggle-completed"
                          onClick={() => setShowCompleted((c) => !c)}
                          className={`ms-auto rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                            showCompleted
                              ? 'border-[var(--color-border)] bg-[var(--color-secondary-light)] text-[var(--color-primary)]'
                              : 'border-[var(--color-border)] bg-white text-[var(--color-muted-foreground)] hover:border-[var(--color-border)]'
                          }`}
                        >
                          {showCompleted ? d.hideCompleted : d.showCompleted}
                        </button>
                      )}
                    </div>

                    <div
                      data-testid="open-tasks-scroll"
                      className="max-h-[440px] overflow-y-auto space-y-2 pr-1"
                    >
                      {/* Group 1: Overdue */}
                      {overdueTasks.length > 0 && (
                        <div>
                          <p className="mb-1.5 px-0.5 text-xs font-semibold text-[var(--color-error)]" data-testid="group-label-overdue">
                            {d.overdue}
                          </p>
                          {overdueTasks.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              urgency="overdue"
                              d={d}
                              workersById={workersById}
                              locale={locale}
                            />
                          ))}
                        </div>
                      )}

                      {/* Group 2: Due soon */}
                      {dueSoonTasks.length > 0 && (
                        <div>
                          <p className="mb-1.5 px-0.5 text-xs font-semibold text-[var(--color-warning)]" data-testid="group-label-due-soon">
                            {d.dueSoon}
                          </p>
                          {dueSoonTasks.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              urgency="due-soon"
                              d={d}
                              workersById={workersById}
                              locale={locale}
                            />
                          ))}
                        </div>
                      )}

                      {/* Group 3: Normal open tasks */}
                      {normalTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          urgency="normal"
                          d={d}
                          workersById={workersById}
                          locale={locale}
                        />
                      ))}

                      {/* Group 4: Recently completed (toggle) */}
                      {showCompleted && recentlyCompleted.length > 0 && (
                        <div className="mt-2 border-t border-[var(--color-border)] pt-3">
                          <p className="mb-1.5 px-0.5 text-xs font-semibold text-[var(--color-primary)]" data-testid="group-label-completed">
                            {d.recentlyCompleted}
                          </p>
                          {recentlyCompleted.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              urgency="completed"
                              d={d}
                              workersById={workersById}
                              locale={locale}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </DashboardCard>

              {/* ── Farm Map card ── */}
              <DashboardCard title={d.farmMap} icon={<MapIcon className="h-4 w-4" />} className="min-w-0" direction={dir}>
                <div className="mb-3 flex flex-wrap items-center gap-2" dir={dir}>
                  {mapFilters.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      data-testid={`filter-${filter.id}`}
                      onClick={() => setActiveFilter((current) => (current === filter.id ? null : filter.id))}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        activeFilter === filter.id
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                          : 'border-[var(--color-border)] bg-[var(--color-secondary-light)] text-[var(--color-primary)] hover:border-[var(--color-primary)]'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                  {activeFilter !== null && (
                    <button
                      type="button"
                      data-testid="filter-clear"
                      onClick={() => setActiveFilter(null)}
                      className="rounded-full border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-muted-foreground)] transition hover:border-[var(--color-border)] hover:text-[var(--color-foreground)]"
                    >
                      {t.common.clear}
                    </button>
                  )}
                </div>
                <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[#FAFBF8] p-3" dir="ltr">
                  <FarmMap
                    plants={data?.plants ?? []}
                    activeFilter={activeFilter}
                    tasks={openTasks}
                    zoneHealth={data?.zoneHealth ?? []}
                    showLegend={false}
                  />
                </div>
                <DashboardMapLegend items={legendItems} />
              </DashboardCard>

              {/* ── Deviation Data card ── */}
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

            {/* ── Weather card (US36) ── */}
            <section className="mt-5">
              <WeatherCard />
            </section>

            <section className="mt-5 rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-secondary-light)] text-[var(--color-primary)]">
                  <Boxes className="h-4 w-4" />
                </span>
                <h2 className="text-base font-semibold text-[var(--color-foreground)]">{d.inventoryAlerts}</h2>
              </div>

              {inventoryAlerts.length === 0 ? (
                <EmptyMessage text={d.noInventoryAlerts} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="border-b border-[var(--color-border)] bg-[var(--color-muted)] text-xs uppercase text-[var(--color-muted-foreground)]">
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
                          <tr key={item.InventoryId} className="border-b border-[var(--color-border)] last:border-0">
                            <td className="px-3 py-3 font-medium text-[var(--color-foreground)]" dir="auto">
                              {item.DisplayName ?? item.ProductName ?? item.ItemName ?? `Inventory #${item.InventoryId}`}
                            </td>
                            <td className="px-3 py-3 text-[var(--color-foreground)]" dir="ltr">
                              {item.ProductId === null ? item.WarehouseQuantity : item.AllocatedQuantity}
                            </td>
                            <td className="px-3 py-3 text-[var(--color-foreground)]" dir="ltr">{item.WarehouseQuantity}</td>
                            <td className="px-3 py-3 text-[var(--color-foreground)]" dir="ltr">{item.ProductId === null ? 'N/A' : item.AllocatedQuantity}</td>
                            <td className="px-3 py-3 text-[var(--color-muted-foreground)]" dir="ltr">N/A</td>
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

// ── Shared card for a single task (all urgency levels) ─────────────────────────

type UrgencyLevel = 'overdue' | 'due-soon' | 'normal' | 'completed';

const URGENCY_STYLES: Record<UrgencyLevel, string> = {
  overdue:   'border-s-4 border-s-red-400    border border-[var(--color-border)]    bg-[var(--color-error-bg)]/50',
  'due-soon':'border-s-4 border-s-amber-400  border border-[var(--color-border)]  bg-[var(--color-warning-bg)]/50',
  normal:    'border border-[var(--color-border)] bg-[var(--color-muted)]/70',
  completed: 'border-s-4 border-s-green-400  border border-[var(--color-border)]  bg-[var(--color-secondary-light)]/50',
};

const URGENCY_TEST_IDS: Record<UrgencyLevel, string> = {
  overdue:   'urgency-overdue',
  'due-soon':'urgency-due-soon',
  normal:    'urgency-normal',
  completed: 'completed-task',
};

function TaskCard({
  task,
  urgency,
  d,
  workersById,
  locale,
}: {
  task: Task;
  urgency: UrgencyLevel;
  d: ReturnType<typeof useLanguage>['t']['dashboard'];
  workersById: Map<number, string>;
  locale: string;
}) {
  return (
    <article
      data-testid={URGENCY_TEST_IDS[urgency]}
      className={`mb-2 rounded-lg p-3 ${URGENCY_STYLES[urgency]}`}
    >
      <h3 className="text-sm font-semibold text-[var(--color-foreground)]" dir="auto">{task.title}</h3>
      <dl className="mt-2 grid grid-cols-1 gap-1.5 text-xs text-[var(--color-muted-foreground)]">
        <InfoRow label={d.dueDate} value={displayDate(task.dueDate, locale, d.noDueDate)} />
        {urgency === 'completed' && task.completedAt && (
          <InfoRow label={d.completedAt} value={displayDate(task.completedAt, locale, '')} />
        )}
        <InfoRow
          label={d.assignedTo}
          value={task.assignedToUserId ? workersById.get(task.assignedToUserId) ?? d.unknownWorker : d.unassigned}
        />
      </dl>
      {task.checklistItems && task.checklistItems.length > 0 && (
        <TaskProgressBar checklistItems={task.checklistItems} />
      )}
    </article>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
    <section className={`rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm ${className}`} dir={direction}>
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-secondary-light)] text-[var(--color-primary)]">{icon}</span>
        <h2 className="text-base font-semibold text-[var(--color-foreground)]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-8 text-center text-sm text-[var(--color-muted-foreground)]">
      {text}
    </div>
  );
}

function DashboardMapLegend({
  items,
}: {
  items: Array<{ label: string; color: string; border: string }>;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2" data-testid="dashboard-legend">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-[2px]"
            style={{
              backgroundColor: item.color,
              border: `2px solid ${item.border}`,
            }}
          />
          <span className="text-xs text-[var(--color-muted-foreground)]">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function InfoRow({ label, value, valueDir = 'auto' }: { label: string; value: string; valueDir?: 'auto' | 'ltr' }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt>{label}</dt>
      <dd className="font-medium text-[var(--color-foreground)]" dir={valueDir}>{value}</dd>
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
    red:   'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-border)]',
    amber: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-border)]',
    green: 'bg-[var(--color-secondary-light)] text-[var(--color-primary)] border-[var(--color-border)]',
    blue:  'bg-[var(--color-info-bg)] text-[var(--color-info)] border-[var(--color-border)]',
    gray:  'bg-[var(--color-muted)] text-[var(--color-foreground)] border-[var(--color-border)]',
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
