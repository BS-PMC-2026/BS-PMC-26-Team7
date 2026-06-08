'use client';

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Boxes,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Droplets,
  Mail,
  Map as MapIcon,
  RefreshCw,
  ShoppingBag,
  Sprout,
  Tag,
  UserCheck,
  UserCircle,
  X,
} from 'lucide-react';
import FarmMap, { MapFilter, type FarmSection } from '@/components/map/FarmMap';
import Alert from '@/components/ui/Alert';
import TaskForm from '@/components/tasks/TaskForm';
import TaskProgressBar from '@/components/tasks/TaskProgressBar';
import WeatherCard from '@/components/weather/WeatherCard';
import SprayReportForm from '@/components/spray/SprayReportForm';
import ManageTasksModalContent, { TaskAlertPrefill } from '@/components/tasks/ManageTasksModalContent';
import SprayManagementModalContent from '@/components/spray/SprayManagementModalContent';
import { useLanguage } from '@/context/LanguageContext';
import { getManagerDashboardData, ManagerDashboardData } from '@/lib/managerDashboardApi';
import { groupDashboardTasks, isTaskOpen } from '@/lib/taskUrgency';
import NewsletterPage from '@/app/manager/newsletter/page';
import CouponsPage from '@/app/manager/coupons/page';
import EmployeeDiscountsPage from '@/app/manager/employee-discounts/page';
import { getAllPeppers } from '@/services/peppers';
import { createPlant, getAllPlants, PlantData, updatePlantLocation, updatePlantStatus } from '@/services/plants';
import { getInventoryByVariety } from '@/services/inventory';
import { getProductStatistics, ProductStatisticsResponse } from '@/services/reports';
import { getZoneSprayMap } from '@/services/spray';
import { createTask } from '@/services/tasks';
import { getZones, ZoneSummary } from '@/services/zones';
import { InventoryByVariety, InventoryResponse, PlantSummary } from '@/types/inventory';
import { Pepper } from '@/types/pepper';
import { ZoneSprayStatusData } from '@/types/spray';
import { CreateTaskFormData, Task, TaskPriority } from '@/types/task';

const LOW_STOCK_LIMIT = 5;
const STORE_LOW_LIMIT = 2;
const SPRAYABLE_ZONE_TYPES = new Set<FarmSection['type']>(['greenhouse', 'growing', 'nursery', 'germination']);
const NURSERY_ZONES = new Set(['NURSERY']);
const GREENHOUSE_ZONES = new Set([
  'GH-01', 'GH-02', 'GH-03', 'GH-04', 'GH-05',
  'GH-06', 'GH-07', 'GH-08', 'GH-09', 'GH-10',
  'GERM-01', 'GERM-02', 'GERM-03', 'GERM-04',
]);
const ZONE_CODE_TO_ID: Record<string, number> = {
  'GH-01': 1, 'GH-02': 2, 'GH-03': 3, 'GH-04': 4,
  'GH-05': 5, 'GH-06': 6, 'GH-07': 7, 'GH-08': 8,
  NURSERY: 9, 'SHED-MAIN': 10, 'GH-09': 11, 'GH-10': 12,
  'GERM-01': 13, 'GERM-02': 14, 'VIS-CENTER': 15,
  'GERM-03': 16, 'GERM-04': 17, FACTORY: 18,
};
const PLANT_STATUSES = ['Healthy', 'Growing', 'Sick', 'Harvested', 'Dead'];
type ManagerMapMode = 'planting' | 'tasks' | 'sensor' | 'sprays';

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

function formatDateTime(value: string | null | undefined, locale: string, fallback = 'N/A'): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sprayZoneColor(zone: ZoneSprayStatusData): string {
  if (!zone.entryAllowed && zone.sprayStatus === 'unsafe') return 'rgba(239,68,68,0.30)';
  if (!zone.entryAllowed) return 'rgba(251,191,36,0.30)';
  return 'rgba(22,163,74,0.20)';
}

function plantStatusClass(status: string | null): string {
  switch ((status ?? '').toLowerCase()) {
    case 'healthy': return 'bg-green-100 text-green-800';
    case 'growing': return 'bg-yellow-100 text-yellow-800';
    case 'sick':
    case 'diseased': return 'bg-red-100 text-red-800';
    case 'harvested': return 'bg-blue-100 text-blue-800';
    case 'dead': return 'bg-gray-200 text-gray-600';
    default: return 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]';
  }
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function recalcBreakdown(plants: PlantSummary[]): Record<string, number> {
  const bd: Record<string, number> = {};
  for (const p of plants) { const k = p.Status || 'Unknown'; bd[k] = (bd[k] ?? 0) + 1; }
  return bd;
}

function formatHours(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${hours.toFixed(1)}h`;
}

function ManagerPageContent() {
  const { t, locale, dir } = useLanguage();
  const d = t.dashboard;
  const wk = t.worker;
  const sp = t.spray;
  const inv = t.inventory;
  const [data, setData] = useState<ManagerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [managerName, setManagerName] = useState<string>('');
  const [mapMode, setMapMode] = useState<ManagerMapMode>('planting');
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sprayZones, setSprayZones] = useState<ZoneSprayStatusData[]>([]);
  const [sprayLoading, setSprayLoading] = useState(false);
  const [sprayError, setSprayError] = useState<string | null>(null);
  const [peppers, setPeppers] = useState<Pepper[]>([]);
  const [selectedPepper, setSelectedPepper] = useState<number | ''>('');
  const [selectedTransferPlant, setSelectedTransferPlant] = useState<PlantData | null>(null);
  const [savingPlant, setSavingPlant] = useState(false);
  const [transferringPlant, setTransferringPlant] = useState(false);
  const [plantMessage, setPlantMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [zones, setZones] = useState<ZoneSummary[]>([]);
  const [taskModal, setTaskModal] = useState<{ zoneCode?: string } | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskCreateError, setTaskCreateError] = useState<string | null>(null);
  const [productStats, setProductStats] = useState<ProductStatisticsResponse | null>(null);
  const [storeModal, setStoreModal] = useState<'coupons' | 'employee-discounts' | 'newsletter' | null>(null);
  const [zoneEntryOpen, setZoneEntryOpen] = useState(false);
  const [sprayReportZoneCode, setSprayReportZoneCode] = useState<string | null>(null);

  // ── Manage Tasks / Spray Management modals (ported from /manager/tasks & /manager/spray-map) ──
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tasksModalOpen, setTasksModalOpen] = useState(false);
  const [tasksModalTab, setTasksModalTab] = useState<'active' | 'history'>('active');
  const [tasksModalAlertPrefill, setTasksModalAlertPrefill] = useState<TaskAlertPrefill | null>(null);
  const [sprayModalOpen, setSprayModalOpen] = useState(false);
  const [sprayModalScrollTarget, setSprayModalScrollTarget] = useState<'alerts' | 'overdue' | null>(null);

  useEffect(() => {
    const section = searchParams.get('section');
    if (section === 'tasks') {
      setTasksModalOpen(true);
      setTasksModalTab(searchParams.get('tab') === 'history' ? 'history' : 'active');
      const alertId = searchParams.get('alertId');
      setTasksModalAlertPrefill(alertId ? {
        alertId: Number(alertId),
        title: searchParams.get('title') ?? '',
        description: searchParams.get('description') ?? '',
        priority: (searchParams.get('priority') as TaskPriority) ?? 'medium',
        taskType: searchParams.get('taskType') ?? '',
        zoneCode: searchParams.get('zoneCode') ?? '',
      } : null);
    } else if (section === 'sprays') {
      setSprayModalOpen(true);
      const panel = searchParams.get('panel');
      setSprayModalScrollTarget(panel === 'alerts' ? 'alerts' : panel === 'overdue' ? 'overdue' : null);
    }
  }, [searchParams]);

  const closeTasksModal = () => {
    setTasksModalOpen(false);
    setTasksModalAlertPrefill(null);
    router.replace('/manager');
  };
  const closeSprayModal = () => {
    setSprayModalOpen(false);
    setSprayModalScrollTarget(null);
    router.replace('/manager');
  };

  // ── Plants Registry panel (planting mode) — mirrors manager/inventory/plants ──
  const [plantRegistryOpen, setPlantRegistryOpen] = useState(false);
  const [inventoryRows,     setInventoryRows]     = useState<InventoryByVariety[]>([]);
  const [inventoryLoading,  setInventoryLoading]  = useState(false);
  const [inventoryExpanded, setInventoryExpanded] = useState<Record<number, boolean>>({});
  const [inventorySearch,   setInventorySearch]   = useState('');
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState('');
  const [inventorySortCol,  setInventorySortCol]  = useState<'name' | 'plants'>('name');
  const [inventorySortDir,  setInventorySortDir]  = useState<'asc' | 'desc'>('asc');

  // Add-plant modal (registry) — same form as manager/inventory/plants
  const [addPlantModal,   setAddPlantModal]   = useState<{ pepperId: number; pepperName: string } | null>(null);
  const [addPlantForm,    setAddPlantForm]    = useState({ PlantCode: '', Notes: '' });
  const [addPlantLoading, setAddPlantLoading] = useState(false);
  const [addPlantError,   setAddPlantError]   = useState<string | null>(null);

  // Transfer modal (registry)
  const [transferRegModal,   setTransferRegModal]   = useState<{ plant: PlantSummary; pepperName: string } | null>(null);
  const [transferRegZoneId,  setTransferRegZoneId]  = useState('');
  const [transferRegDate,    setTransferRegDate]    = useState('');
  const [transferRegLoading, setTransferRegLoading] = useState(false);
  const [transferRegError,   setTransferRegError]   = useState<string | null>(null);

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

  const loadSprayZones = () => {
    setSprayLoading(true);
    setSprayError(null);
    getZoneSprayMap()
      .then((zones) => setSprayZones(Array.isArray(zones) ? zones : []))
      .catch((err) => setSprayError(err instanceof Error ? err.message : 'Failed to load spray map.'))
      .finally(() => setSprayLoading(false));
  };

  useEffect(() => {
    loadSprayZones();
  }, []);

  useEffect(() => {
    getAllPeppers().then(setPeppers).catch(() => setPeppers([]));
  }, []);

  useEffect(() => {
    getZones().then(setZones).catch(() => setZones([]));
    getProductStatistics({ period: 'monthly' }).then(setProductStats).catch(() => setProductStats(null));
  }, []);

  const refreshPlants = async () => {
    const token = localStorage.getItem('token') ?? '';
    const updated = await getAllPlants(token);
    setData((current) => current ? { ...current, plants: updated } : current);
    return updated;
  };

  // ── Plants Registry — mirrors manager/inventory/plants ──────────────────────
  const loadInventory = useCallback(async () => {
    setInventoryLoading(true);
    try {
      setInventoryRows(await getInventoryByVariety());
    } catch { /* silent */ }
    finally { setInventoryLoading(false); }
  }, []);

  const openAddPlantModal = useCallback((pepperId: number, pepperName: string) => {
    const words    = pepperName.trim().split(/\s+/);
    const initials = words.slice(0, 3).map((w) => w[0].toUpperCase()).join('');
    const now      = new Date();
    const datePart = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const tail     = String(Date.now()).slice(-4);
    setAddPlantModal({ pepperId, pepperName });
    setAddPlantForm({ PlantCode: `${initials}-${datePart}-${tail}`, Notes: '' });
    setAddPlantError(null);
  }, []);

  const handleRegistryAddPlant = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addPlantModal) return;
    const nursery = zones.find((z) => z.ZoneCode === 'NURSERY');
    if (!nursery) { setAddPlantError('Nursery zone not found.'); return; }
    setAddPlantLoading(true);
    setAddPlantError(null);
    try {
      await createPlant({
        PlantCode: addPlantForm.PlantCode.trim(),
        PepperId:  addPlantModal.pepperId,
        ZoneId:    nursery.ZoneId,
        PlantedAt: new Date().toISOString(),
        Status:    'Growing',
        Notes:     addPlantForm.Notes.trim() || undefined,
        IsActive:  true,
      });
      await loadInventory();
      await refreshPlants();
      setAddPlantModal(null);
    } catch (err) {
      setAddPlantError(err instanceof Error ? err.message : inv.addPlantFailed);
    } finally {
      setAddPlantLoading(false);
    }
  }, [addPlantModal, addPlantForm, zones, loadInventory, inv.addPlantFailed]);

  const handleRegistryTransfer = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferRegModal || !transferRegZoneId || !transferRegDate) return;
    const token = localStorage.getItem('token') ?? '';
    setTransferRegLoading(true);
    setTransferRegError(null);
    try {
      await updatePlantLocation(token, transferRegModal.plant.PlantId, Number(transferRegZoneId), transferRegDate);
      await loadInventory();
      await refreshPlants();
      setTransferRegModal(null);
    } catch (err) {
      setTransferRegError(err instanceof Error ? err.message : 'Transfer failed.');
    } finally {
      setTransferRegLoading(false);
    }
  }, [transferRegModal, transferRegZoneId, transferRegDate, loadInventory]);

  const handleRegistryStatusChange = useCallback(async (plantId: number, newStatus: string) => {
    try {
      await updatePlantStatus(plantId, newStatus || null);
      setInventoryRows((prev) =>
        prev.map((v) => ({
          ...v,
          Plants: v.Plants.map((p) => p.PlantId === plantId ? { ...p, Status: newStatus || null } : p),
          StatusBreakdown: recalcBreakdown(
            v.Plants.map((p) => p.PlantId === plantId ? { ...p, Status: newStatus || null } : p),
          ),
        })),
      );
      setData((current) => current ? {
        ...current,
        plants: current.plants.map((plant) => plant.PlantId === plantId ? { ...plant, Status: newStatus || null } : plant),
      } : current);
      setPlantMessage(null);
    } catch (err) {
      setPlantMessage({ text: err instanceof Error ? err.message : 'Failed to update plant status.', ok: false });
    }
  }, []);

  const openRegistryTransferModal = useCallback((plant: PlantSummary, pepperName: string) => {
    setTransferRegModal({ plant, pepperName });
    setTransferRegZoneId('');
    setTransferRegDate(new Date().toISOString().slice(0, 10));
    setTransferRegError(null);
  }, []);

  const filteredInventoryRows = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    const filtered = inventoryRows.filter((r) => {
      if (q && !r.PepperName.toLowerCase().includes(q) && !r.Plants.some((p) => p.PlantCode.toLowerCase().includes(q))) return false;
      if (inventoryStatusFilter && !r.Plants.some((p) => (p.Status ?? '').toLowerCase() === inventoryStatusFilter.toLowerCase())) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      const cmp = inventorySortCol === 'name'
        ? a.PepperName.localeCompare(b.PepperName)
        : a.PlantCount - b.PlantCount;
      return inventorySortDir === 'asc' ? cmp : -cmp;
    });
  }, [inventoryRows, inventorySearch, inventoryStatusFilter, inventorySortCol, inventorySortDir]);

  function inventoryExpandAll() {
    setInventoryExpanded(Object.fromEntries(filteredInventoryRows.map((r) => [r.PepperId, true])));
  }
  function inventoryCollapseAll() {
    setInventoryExpanded({});
  }
  function inventoryHandleSort(col: 'name' | 'plants') {
    if (inventorySortCol === col) setInventorySortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    else { setInventorySortCol(col); setInventorySortDir('asc'); }
  }
  function inventorySortIcon(col: 'name' | 'plants') {
    if (inventorySortCol !== col) return ' ↕';
    return inventorySortDir === 'asc' ? ' ↑' : ' ↓';
  }
  function inventoryExportCsv() {
    const lines = ['Variety,Plant ID,Plant Code,Status,Zone'];
    for (const v of filteredInventoryRows) {
      if (v.Plants.length === 0) {
        lines.push(`"${v.PepperName}",,,,`);
      } else {
        for (const p of v.Plants) {
          lines.push(`"${v.PepperName}",${p.PlantId},"${p.PlantCode}","${p.Status ?? ''}","${p.ZoneName ?? p.ZoneId ?? ''}"`);
        }
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'plants-by-variety.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const workersById = useMemo(() => {
    const map = new Map<number, string>();
    data?.users.forEach((user) => map.set(user.userId, user.fullName));
    return map;
  }, [data?.users]);

  // Average task-completion time per worker — surfaces the fastest/slowest worker
  // and the team-wide average in the Deviation Data card.
  const workerSpeedStats = useMemo(() => {
    const hoursByWorker = new Map<number, number[]>();
    const allDurations: number[] = [];

    for (const task of data?.tasks ?? []) {
      if (task.status !== 'done' || task.assignedToUserId == null || !task.completedAt) continue;
      const start = task.startedAt ?? task.createdAt;
      if (!start) continue;
      const startMs = new Date(start).getTime();
      const endMs = new Date(task.completedAt).getTime();
      if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) continue;

      const hours = (endMs - startMs) / 3_600_000;
      allDurations.push(hours);
      const list = hoursByWorker.get(task.assignedToUserId) ?? [];
      list.push(hours);
      hoursByWorker.set(task.assignedToUserId, list);
    }

    if (hoursByWorker.size === 0) return null;

    const perWorker = Array.from(hoursByWorker.entries()).map(([userId, hours]) => ({
      userId,
      name: workersById.get(userId) ?? `#${userId}`,
      avgHours: hours.reduce((sum, h) => sum + h, 0) / hours.length,
      taskCount: hours.length,
    }));

    const fastest = perWorker.reduce((a, b) => (a.avgHours <= b.avgHours ? a : b));
    const slowest = perWorker.reduce((a, b) => (a.avgHours >= b.avgHours ? a : b));
    const overallAvgHours = allDurations.reduce((sum, h) => sum + h, 0) / allDurations.length;

    return { fastest, slowest, overallAvgHours, taskCount: allDurations.length };
  }, [data?.tasks, workersById]);

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

  const activeAnomalies = data?.anomalySummary?.activeAlerts ?? 0;
  const affectedZones = data?.anomalySummary?.affectedZones ?? data?.zoneHealth.filter((zone) => zone.health !== 'normal').length ?? 0;

  const activeFilter: MapFilter =
    mapMode === 'tasks' ? 'task' :
    mapMode === 'sensor' ? 'sensor' :
    null;

  const mapModes: { id: ManagerMapMode; label: string }[] = [
    { id: 'planting', label: wk.mapModePlanting },
    { id: 'tasks', label: wk.mapModeTasks },
    { id: 'sensor', label: t.map.filterSensorAnomaly.replace(/^.+? /, '') },
    { id: 'sprays', label: wk.mapModeSprays },
  ];

  const spraySectionColors = useMemo(() => {
    if (mapMode === 'planting') {
      const colors: Record<string, string> = {};
      for (const code of Object.keys(ZONE_CODE_TO_ID)) {
        if (NURSERY_ZONES.has(code)) colors[code] = 'rgba(22,163,74,0.20)';
        else if (GREENHOUSE_ZONES.has(code)) colors[code] = 'rgba(59,130,246,0.15)';
        else colors[code] = 'rgba(209,213,219,0.30)';
      }
      return colors;
    }
    if (mapMode !== 'sprays') return undefined;
    return sprayZones.reduce<Record<string, string>>((colors, zone) => {
      colors[zone.zoneCode] = sprayZoneColor(zone);
      return colors;
    }, {});
  }, [mapMode, sprayZones]);

  // Legend items change with the active filter — mirrors FarmMap's internal FILTER_LEGENDS
  const legendItems = useMemo(() => {
    if (mapMode === 'sprays') return [
      { label: sp.entryRestricted, color: 'rgba(239,68,68,0.30)', border: '#ef4444' },
      { label: sp.cautionConsultManager, color: 'rgba(251,191,36,0.30)', border: '#f59e0b' },
      { label: sp.entryPermitted, color: 'rgba(22,163,74,0.20)', border: '#16a34a' },
    ];
    if (mapMode === 'planting') return [
      { label: wk.plantingNurseryOnly, color: 'rgba(22,163,74,0.20)', border: '#16a34a' },
      { label: wk.plantingAllowedZones, color: 'rgba(59,130,246,0.15)', border: '#3b82f6' },
      { label: wk.plantingBlockedZones, color: 'rgba(209,213,219,0.30)', border: '#9ca3af' },
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
  }, [activeFilter, mapMode, sp, t.map]);

  const handlePlantInZone = async (section: FarmSection) => {
    if (!selectedPepper) {
      setPlantMessage({ text: t.map.pleaseSelectPepper, ok: false });
      return;
    }
    if (!NURSERY_ZONES.has(section.id)) {
      setPlantMessage({ text: wk.plantingNurseryOnly, ok: false });
      return;
    }
    setSavingPlant(true);
    setPlantMessage(null);
    try {
      const zoneId = ZONE_CODE_TO_ID[section.id];
      const pepper = peppers.find((item) => item.PepperId === Number(selectedPepper));
      const plantCode = `${pepper?.PepperName?.replace(/\s+/g, '-').toUpperCase() ?? 'PLANT'}-${section.id}-${Date.now()}`;
      await createPlant({
        PlantCode: plantCode,
        PepperId: Number(selectedPepper),
        ZoneId: zoneId ?? null,
        PlantedAt: new Date().toISOString(),
        Status: 'Growing',
        IsActive: true,
      });
      await refreshPlants();
      setSelectedPepper('');
      setPlantMessage({ text: `${pepper?.PepperName ?? plantCode} - ${t.map.assignedSuccessfully}`, ok: true });
    } catch (err) {
      setPlantMessage({ text: err instanceof Error ? err.message : t.map.failedToAssign, ok: false });
    } finally {
      setSavingPlant(false);
    }
  };

  const handlePlantStatusChange = async (plantId: number, status: string) => {
    try {
      await updatePlantStatus(plantId, status || null);
      setData((current) => current ? {
        ...current,
        plants: current.plants.map((plant) => plant.PlantId === plantId ? { ...plant, Status: status || null } : plant),
      } : current);
      setPlantMessage(null);
    } catch (err) {
      setPlantMessage({ text: err instanceof Error ? err.message : 'Failed to update plant status.', ok: false });
    }
  };

  const handleTransferPlant = async (section: FarmSection) => {
    if (!selectedTransferPlant) return;
    if (!GREENHOUSE_ZONES.has(section.id)) {
      setPlantMessage({ text: wk.plantingBlockedZones, ok: false });
      return;
    }
    const nurseryZoneId = ZONE_CODE_TO_ID.NURSERY;
    if (selectedTransferPlant.ZoneId !== nurseryZoneId || (selectedTransferPlant.Status ?? '').toLowerCase() !== 'healthy') {
      setPlantMessage({ text: 'Only healthy nursery plants can be transferred.', ok: false });
      setSelectedTransferPlant(null);
      return;
    }
    setTransferringPlant(true);
    setPlantMessage(null);
    try {
      const token = localStorage.getItem('token') ?? '';
      const zoneId = ZONE_CODE_TO_ID[section.id];
      await updatePlantLocation(token, selectedTransferPlant.PlantId, zoneId ?? null, new Date().toISOString());
      await refreshPlants();
      setPlantMessage({ text: `${selectedTransferPlant.PlantCode} transferred to ${section.nameEn}`, ok: true });
      setSelectedTransferPlant(null);
    } catch (err) {
      setPlantMessage({ text: err instanceof Error ? err.message : t.map.failedToAssign, ok: false });
    } finally {
      setTransferringPlant(false);
    }
  };

  const handleCreateTask = async (form: CreateTaskFormData) => {
    setCreatingTask(true);
    setTaskCreateError(null);
    try {
      const task = await createTask(form);
      setData((current) => current ? { ...current, tasks: [task, ...current.tasks] } : current);
      setTaskModal(null);
    } catch (err) {
      setTaskCreateError(err instanceof Error ? err.message : 'Failed to create task.');
    } finally {
      setCreatingTask(false);
    }
  };

  const renderPlantRows = (plants: PlantData[], allowTransfer: boolean) => {
    if (plants.length === 0) {
      return <p className="text-xs italic text-[var(--color-muted-foreground)]">{wk.noPlantsInZone}</p>;
    }
    return (
      <div className="mb-2 flex max-h-40 flex-col gap-1 overflow-y-auto">
        {plants.map((plant) => {
          const pepperName = peppers.find((pepper) => pepper.PepperId === plant.PepperId)?.PepperName;
          const canTransfer = allowTransfer && (plant.Status ?? '').toLowerCase() === 'healthy';
          return (
            <div
              key={plant.PlantId}
              data-testid={`manager-map-plant-${plant.PlantId}`}
              className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-2 py-1.5 text-xs text-[var(--color-foreground)]"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{pepperName ?? plant.PlantCode}</p>
                <p className="text-[10px] text-[var(--color-muted-foreground)]" dir="ltr">
                  #{plant.PlantId} - {plant.PlantCode}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <select
                  value={plant.Status ?? ''}
                  onChange={(event) => handlePlantStatusChange(plant.PlantId, event.target.value)}
                  className={`max-w-[92px] cursor-pointer rounded border-0 px-1.5 py-0.5 text-[10px] focus:outline-none ${plantStatusClass(plant.Status)}`}
                  aria-label={`Status for ${plant.PlantCode}`}
                >
                  <option value="">-</option>
                  {PLANT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                {canTransfer && (
                  <button
                    type="button"
                    onClick={() => setSelectedTransferPlant(plant)}
                    className="whitespace-nowrap rounded bg-[var(--color-primary)] px-2 py-0.5 text-[10px] font-medium text-white transition hover:bg-[var(--color-primary-hover)]"
                  >
                    Transfer
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMapPopupExtra = (section: FarmSection) => {
    if (mapMode === 'tasks') {
      const zoneTasks = openTasks.filter((task) => task.zoneCode === section.id);
      return (
        <div className="mb-3 border-t border-[var(--color-border)] pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[var(--color-muted-foreground)]">Manager actions</p>
            <button
              type="button"
              onClick={() => setTaskModal({ zoneCode: section.id })}
              className="rounded-full border border-[var(--color-primary)] bg-[var(--color-primary)] px-2 py-1 text-[10px] font-semibold text-white"
            >
              Add task
            </button>
          </div>
          {zoneTasks.length === 0 ? (
            <p className="text-xs text-[var(--color-muted-foreground)]">No active manager task actions for this zone.</p>
          ) : (
            <div className="space-y-2">
              {zoneTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setSelectedTask(task)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-left text-xs transition hover:border-[var(--color-primary)]"
                >
                  <span className="block font-semibold text-[var(--color-foreground)]" dir="auto">{task.title}</span>
                  <span className="text-[var(--color-muted-foreground)]">{task.priority} - {task.status.replace('_', ' ')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (mapMode === 'sensor') {
      const health = data?.zoneHealth.find((zone) => zone.zoneCode === section.id);
      return (
        <div className="mb-3 border-t border-[var(--color-border)] pt-3">
          <p className="mb-2 text-xs font-semibold text-[var(--color-muted-foreground)]">Sensor drilldown</p>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {health ? `${health.totalAlerts} alerts - ${health.highAlerts} high severity` : 'No anomaly data for this zone.'}
          </p>
        </div>
      );
    }

    if (mapMode === 'sprays') {
      const zone = sprayZones.find((item) => item.zoneCode === section.id);
      if (!SPRAYABLE_ZONE_TYPES.has(section.type)) {
        return (
          <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-xs text-[var(--color-muted-foreground)]">
            {wk.notSprayableZone}
          </div>
        );
      }
      return (
        <div className="mb-3 border-t border-[var(--color-border)] pt-3">
          <p className="mb-2 text-xs font-semibold text-[var(--color-muted-foreground)]">{sp.entryPermission}</p>
          {sprayLoading ? (
            <p className="text-xs text-[var(--color-muted-foreground)]">Loading spray status...</p>
          ) : zone ? (
            <div className={`rounded-lg border px-3 py-2 text-xs ${zone.entryAllowed ? 'border-[var(--color-border)] bg-[var(--color-secondary-light)] text-[var(--color-primary)]' : 'border-[var(--color-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]'}`}>
              <p className="font-semibold">{zone.entryAllowed ? sp.entryPermitted : sp.entryRestricted}</p>
              <p className="mt-1 text-[var(--color-muted-foreground)]">{zone.entryMessage}</p>
              <dl className="mt-2 space-y-1 text-[var(--color-foreground)]">
                <InfoRow label="Status" value={zone.sprayStatus.replace('_', ' ')} />
                <InfoRow label={sp.pesticide} value={zone.pesticideName ?? 'N/A'} />
                <InfoRow label={sp.safeReentry} value={formatDateTime(zone.safeToReEnterAtUtc, locale, sp.safeToEnter)} valueDir="ltr" />
              </dl>
            </div>
          ) : (
            <p className="text-xs text-[var(--color-muted-foreground)]">No spray data for this zone.</p>
          )}
          <button
            type="button"
            data-testid={`manager-create-spray-report-${section.id}`}
            onClick={() => setSprayReportZoneCode(section.id)}
            className="mt-2 w-full rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            🌿 {wk.createSprayReport}
          </button>
        </div>
      );
    }

    if (mapMode === 'planting') {
      const zoneId = ZONE_CODE_TO_ID[section.id];
      const zonePlants = (data?.plants ?? []).filter((plant) => plant.ZoneId === zoneId);
      const isNursery = NURSERY_ZONES.has(section.id);
      const isGreenhouse = GREENHOUSE_ZONES.has(section.id);

      if (isNursery) {
        const nurseryPlants = (data?.plants ?? []).filter((plant) => plant.ZoneId === ZONE_CODE_TO_ID.NURSERY);
        return (
          <div className="mt-3 flex flex-col gap-2">
            {plantMessage && (
              <div className={`rounded-lg border px-3 py-2 text-xs ${plantMessage.ok ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                {plantMessage.text}
              </div>
            )}

            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {wk.plantingNurseryOnly}
            </div>

            <div className="border-t border-[var(--color-border)] pt-2">
              <p className="mb-1.5 text-xs font-semibold text-[var(--color-foreground)]">{wk.nurseryPlants}</p>
              {renderPlantRows(nurseryPlants, true)}
              {selectedTransferPlant && (
                <button
                  type="button"
                  onClick={() => setSelectedTransferPlant(null)}
                  className="mb-2 w-full rounded-full border border-[var(--color-border)] bg-amber-50 px-2 py-1 text-xs text-amber-700 transition hover:bg-amber-100"
                  data-testid="manager-cancel-transfer"
                >
                  {wk.cancelTransfer}: {selectedTransferPlant.PlantCode}
                </button>
              )}
            </div>

            <div className="border-t border-[var(--color-border)] pt-2">
              <label htmlFor="manager-map-pepper-select" className="mb-1 block text-xs font-medium text-[var(--color-foreground)]">{t.map.selectPepper}</label>
              <select
                id="manager-map-pepper-select"
                value={selectedPepper}
                onChange={(event) => setSelectedPepper(event.target.value === '' ? '' : Number(event.target.value))}
                className="mb-2 w-full rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="">{t.map.choosePepper}</option>
                {peppers.map((pepper) => <option key={pepper.PepperId} value={pepper.PepperId}>{pepper.PepperName}</option>)}
              </select>
              <button
                type="button"
                onClick={() => handlePlantInZone(section)}
                disabled={!selectedPepper || savingPlant}
                className="w-full rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm font-semibold text-white transition disabled:opacity-50"
              >
                {savingPlant ? t.map.planting : selectedPepper ? t.map.plantHere : t.map.selectPepperFirst}
              </button>
            </div>
          </div>
        );
      }

      if (isGreenhouse) {
        const canTransferHere = selectedTransferPlant != null && selectedTransferPlant.ZoneId !== zoneId;
        return (
          <div className="mt-3 flex flex-col gap-2">
            {plantMessage && (
              <div className={`rounded-lg border px-3 py-2 text-xs ${plantMessage.ok ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                {plantMessage.text}
              </div>
            )}

            <div className="border-t border-[var(--color-border)] pt-2">
              <p className="mb-1.5 text-xs font-semibold text-[var(--color-foreground)]">{wk.plantsInZone}</p>
              {renderPlantRows(zonePlants, false)}
            </div>

            {canTransferHere ? (
              <>
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  {selectedTransferPlant.PlantCode}
                </div>
                <button
                  type="button"
                  data-testid="manager-transfer-plant-button"
                  onClick={() => handleTransferPlant(section)}
                  disabled={transferringPlant}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-secondary-light)] px-3 py-1.5 text-sm font-semibold text-[var(--color-primary)] transition disabled:opacity-50"
                >
                  {transferringPlant ? wk.transferring : wk.transferPlantHere}
                </button>
              </>
            ) : !selectedTransferPlant && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                {wk.plantingAllowedZones}
              </div>
            )}
          </div>
        );
      }

      return (
        <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]">
          {wk.plantingBlockedZones}
        </div>
      );
    }

    return null;
  };

  return (
    <main className="app-page-bg" dir={dir}>
      <div className="border-b border-[var(--color-border)] bg-white/85">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-4 px-5 py-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
              {locale === 'he' ? 'הדינרים' : 'Hadinerim'}
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
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(260px,0.65fr)_minmax(760px,2.4fr)_minmax(260px,0.75fr)]">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-80 animate-pulse rounded-xl border border-[var(--color-border)] bg-white" />
              ))}
            </div>
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
                <div className="mb-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTaskModal({})}
                    className="flex-1 rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                    data-testid="manager-create-task-button"
                  >
                    Create new task
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTasksModalOpen(true); setTasksModalTab('active'); }}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-muted-foreground)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                    data-testid="manager-manage-tasks-button"
                  >
                    <ClipboardList className="h-4 w-4" />
                    {t.nav.tasks}
                  </button>
                </div>
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
                              onOpen={setSelectedTask}
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
                              onOpen={setSelectedTask}
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
                          onOpen={setSelectedTask}
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
                              onOpen={setSelectedTask}
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
                  {mapModes.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      data-testid={`manager-map-mode-${mode.id}`}
                      onClick={() => setMapMode(mode.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        mapMode === mode.id
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                          : 'border-[var(--color-border)] bg-[var(--color-secondary-light)] text-[var(--color-primary)] hover:border-[var(--color-primary)]'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                  {mapMode === 'sprays' && (
                    <>
                      <button
                        type="button"
                        data-testid="manager-spray-management-button"
                        onClick={() => setSprayModalOpen(true)}
                        className="ms-auto inline-flex items-center gap-1 rounded-full border border-[var(--color-primary)] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                      >
                        <Droplets className="h-3 w-3" />
                        {sp.managerTitle}
                      </button>
                      <button
                        type="button"
                        data-testid="manager-spray-refresh-button"
                        onClick={loadSprayZones}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-muted-foreground)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                      >
                        <RefreshCw className="h-3 w-3" />
                        {sp.refresh}
                      </button>
                    </>
                  )}
                </div>
                {mapMode === 'sprays' && (
                  <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2" dir={dir} data-testid="manager-spray-overview">
                    <div className="flex items-center gap-2">
                      <Sprout className="h-4 w-4 text-[var(--color-primary)]" />
                      <p className="text-xs font-semibold text-[var(--color-foreground)]">{wk.sprayZoneOverview}</p>
                    </div>
                    <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">{wk.heroSpraysSummary}</p>
                    {sprayError && <p className="mt-2 text-xs text-[var(--color-error)]">{sprayError}</p>}
                  </div>
                )}
                <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[#FAFBF8] p-3" dir="ltr">
                  <FarmMap
                    plants={data?.plants ?? []}
                    activeFilter={activeFilter}
                    tasks={openTasks}
                    zoneHealth={data?.zoneHealth ?? []}
                    sectionColors={spraySectionColors}
                    renderPopupExtra={renderMapPopupExtra}
                    showLegend={false}
                    showAlerts={mapMode !== 'planting' && mapMode !== 'sprays'}
                  />
                </div>
                <DashboardMapLegend items={legendItems} />
                {mapMode === 'sprays' && sprayZones.length > 0 && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-[var(--color-border)] bg-white" data-testid="manager-zone-entry-details">
                    <button
                      type="button"
                      onClick={() => setZoneEntryOpen((open) => !open)}
                      className="flex w-full items-center justify-between border-b border-[var(--color-border)] px-3 py-2 text-left"
                    >
                      <p className="text-xs font-semibold text-[var(--color-foreground)]">{sp.zoneEntryDetails}</p>
                      <span className="text-xs text-[var(--color-muted-foreground)]">{zoneEntryOpen ? 'Hide' : 'Show'}</span>
                    </button>
                    {zoneEntryOpen && <div className="max-h-56 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">{sp.zone}</th>
                            <th className="px-3 py-2 text-left font-semibold">{sp.entryPermission}</th>
                            <th className="hidden px-3 py-2 text-left font-semibold sm:table-cell">{sp.safeReentry}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sprayZones.map((zone) => (
                            <tr key={zone.zoneId} className="border-t border-[var(--color-border)]">
                              <td className="px-3 py-2 font-medium text-[var(--color-foreground)]">{zone.zoneName}</td>
                              <td className="px-3 py-2">
                                <span className={`rounded-full border px-2 py-0.5 font-semibold ${zone.entryAllowed ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                                  {zone.entryAllowed ? sp.entryPermitted : sp.entryRestricted}
                                </span>
                              </td>
                              <td className="hidden px-3 py-2 text-[var(--color-muted-foreground)] sm:table-cell" dir="ltr">
                                {formatDateTime(zone.safeToReEnterAtUtc, locale, sp.safeToEnter)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>}
                  </div>
                )}

                {/* Plants Registry — planting mode only, collapsible — mirrors manager/inventory/plants */}
                {mapMode === 'planting' && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-[var(--color-border)] bg-white" data-testid="manager-plants-registry">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !plantRegistryOpen;
                        setPlantRegistryOpen(next);
                        if (next && inventoryRows.length === 0) loadInventory();
                      }}
                      aria-expanded={plantRegistryOpen}
                      className="flex w-full items-center justify-between px-3 py-2 text-left transition hover:bg-[var(--color-muted)]"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🌱</span>
                        <p className="text-xs font-semibold text-[var(--color-foreground)]">{wk.plantsRegistry}</p>
                        {inventoryRows.length > 0 && (
                          <span className="rounded-full bg-[var(--color-secondary-light)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]">
                            {inventoryRows.reduce((s, r) => s + r.PlantCount, 0)}
                          </span>
                        )}
                      </div>
                      {plantRegistryOpen
                        ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-[var(--color-muted-foreground)]" />
                        : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--color-muted-foreground)]" />}
                    </button>

                    {plantRegistryOpen && (
                      <div className="border-t border-[var(--color-border)]">
                        {inventoryLoading ? (
                          <div className="px-3 py-4 text-center text-xs text-[var(--color-muted-foreground)] animate-pulse">
                            Loading…
                          </div>
                        ) : filteredInventoryRows.length === 0 && !inventorySearch ? (
                          <div className="px-3 py-4 text-center text-xs text-[var(--color-muted-foreground)]">
                            {wk.noPlantsInZone}
                          </div>
                        ) : (
                          <>
                            {/* Toolbar — search, status filter, expand/collapse, CSV export (mirrors manager/inventory/plants) */}
                            <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--color-border)] px-3 py-2">
                              <input
                                type="text"
                                placeholder="Search variety or plant code…"
                                value={inventorySearch}
                                onChange={(e) => setInventorySearch(e.target.value)}
                                className="min-w-[160px] flex-1 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                              />
                              <select
                                value={inventoryStatusFilter}
                                onChange={(e) => setInventoryStatusFilter(e.target.value)}
                                className="rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-xs focus:outline-none"
                              >
                                <option value="">{inv.allStatuses}</option>
                                {PLANT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <button type="button" onClick={inventoryExpandAll} className="whitespace-nowrap rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-[11px] transition hover:bg-[var(--color-muted)]">{inv.expandAll}</button>
                              <button type="button" onClick={inventoryCollapseAll} className="whitespace-nowrap rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-[11px] transition hover:bg-[var(--color-muted)]">{inv.collapseAll}</button>
                              <button type="button" onClick={inventoryExportCsv} className="whitespace-nowrap rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-[11px] transition hover:bg-[var(--color-muted)]">{inv.exportCsv}</button>
                            </div>

                            {filteredInventoryRows.length === 0 ? (
                              <div className="px-3 py-4 text-center text-xs text-[var(--color-muted-foreground)]">No results.</div>
                            ) : (
                              <div className="overflow-x-auto" dir="ltr">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                                      <th className="w-6 px-2 py-2" />
                                      <th className="cursor-pointer select-none px-3 py-2 text-left font-semibold text-[var(--color-muted-foreground)]" onClick={() => inventoryHandleSort('name')}>{inv.colVariety}{inventorySortIcon('name')}</th>
                                      <th className="cursor-pointer select-none px-3 py-2 text-left font-semibold text-[var(--color-muted-foreground)]" onClick={() => inventoryHandleSort('plants')}>{inv.colPlantCount}{inventorySortIcon('plants')}</th>
                                      <th className="hidden px-3 py-2 text-left font-semibold text-[var(--color-muted-foreground)] sm:table-cell">{inv.statusBreakdown}</th>
                                      <th className="px-3 py-2" />
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filteredInventoryRows.map((r) => {
                                      const rowOpen = !!inventoryExpanded[r.PepperId];
                                      return (
                                        <Fragment key={r.PepperId}>
                                          {/* Variety row */}
                                          <tr
                                            className="cursor-pointer border-t border-[var(--color-border)] hover:bg-[var(--color-muted)]"
                                            onClick={() => setInventoryExpanded((p) => ({ ...p, [r.PepperId]: !p[r.PepperId] }))}
                                          >
                                            <td className="px-2 py-2 text-[var(--color-muted-foreground)]">{rowOpen ? '▾' : '▸'}</td>
                                            <td className="px-3 py-2 font-medium text-[var(--color-foreground)]">{r.PepperName}</td>
                                            <td className="px-3 py-2 text-[var(--color-foreground)]">{r.PlantCount}</td>
                                            <td className="hidden px-3 py-2 sm:table-cell">
                                              <div className="flex flex-wrap gap-1">
                                                {Object.entries(r.StatusBreakdown).map(([s, c]) => (
                                                  <span key={s} className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${plantStatusClass(s)}`}>{c} {s}</span>
                                                ))}
                                              </div>
                                            </td>
                                            <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                              <button
                                                onClick={() => openAddPlantModal(r.PepperId, r.PepperName)}
                                                className="whitespace-nowrap rounded border border-[var(--color-border)] px-2 py-0.5 text-[11px] transition hover:bg-[var(--color-muted)]"
                                              >
                                                + {inv.addPlant}
                                              </button>
                                            </td>
                                          </tr>

                                          {/* Expanded sub-table */}
                                          {rowOpen && (
                                            <tr className="bg-[var(--color-muted)]">
                                              <td />
                                              <td colSpan={4} className="px-3 py-3">
                                                {r.Plants.length === 0 ? (
                                                  <p className="italic text-[var(--color-muted-foreground)]">{inv.noPlantsForVariety}</p>
                                                ) : (
                                                  <table className="w-full text-xs">
                                                    <thead className="text-[var(--color-muted-foreground)]">
                                                      <tr>
                                                        <th className="py-1 pr-3 text-left">{inv.colPlantId}</th>
                                                        <th className="py-1 pr-3 text-left">{inv.colPlantCode}</th>
                                                        <th className="py-1 pr-3 text-left">{t.tasks.status}</th>
                                                        <th className="py-1 pr-3 text-left">{inv.colZone}</th>
                                                        <th className="hidden py-1 pr-3 text-left sm:table-cell">{inv.plantedAt}</th>
                                                        <th className="hidden py-1 pr-3 text-left sm:table-cell">Transfer Date</th>
                                                        <th className="py-1 pr-3 text-left" />
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {r.Plants.map((p) => {
                                                        const nurseryId   = zones.find((z) => z.ZoneCode === 'NURSERY')?.ZoneId;
                                                        const canTransfer = p.ZoneId === nurseryId && p.Status === 'Healthy';
                                                        return (
                                                          <tr key={p.PlantId} className="border-t border-[var(--color-border)]">
                                                            <td className="py-1 pr-3 text-[var(--color-foreground)]" dir="ltr">#{p.PlantId}</td>
                                                            <td className="py-1 pr-3 font-medium text-[var(--color-foreground)]" dir="ltr">{p.PlantCode}</td>
                                                            <td className="py-1 pr-3">
                                                              <select
                                                                value={p.Status ?? ''}
                                                                onChange={(e) => handleRegistryStatusChange(p.PlantId, e.target.value)}
                                                                className={`cursor-pointer rounded border-0 px-1.5 py-0.5 text-[10px] focus:outline-none ${plantStatusClass(p.Status)}`}
                                                              >
                                                                <option value="">—</option>
                                                                {PLANT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                                              </select>
                                                            </td>
                                                            <td className="py-1 pr-3 text-[var(--color-muted-foreground)]" dir="ltr">
                                                              {p.ZoneName ?? (p.ZoneId ? `Zone ${p.ZoneId}` : '—')}
                                                            </td>
                                                            <td className="hidden py-1 pr-3 text-[var(--color-muted-foreground)] sm:table-cell" dir="ltr">{fmtDate(p.PlantedAt)}</td>
                                                            <td className="hidden py-1 pr-3 text-[var(--color-muted-foreground)] sm:table-cell" dir="ltr">{fmtDate(p.TransferredAt)}</td>
                                                            <td className="py-1">
                                                              {canTransfer && (
                                                                <button
                                                                  onClick={() => openRegistryTransferModal(p, r.PepperName)}
                                                                  className="whitespace-nowrap rounded bg-[var(--color-primary)] px-2 py-0.5 text-[10px] font-medium text-white transition hover:bg-[var(--color-primary-hover)]"
                                                                >
                                                                  Transfer →
                                                                </button>
                                                              )}
                                                            </td>
                                                          </tr>
                                                        );
                                                      })}
                                                    </tbody>
                                                  </table>
                                                )}
                                              </td>
                                            </tr>
                                          )}
                                        </Fragment>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </DashboardCard>

              {/* ── Deviation Data + quick actions column ── */}
              <div className="flex flex-col gap-5">
                <DashboardCard title={d.deviationData} icon={<AlertTriangle className="h-4 w-4" />} direction={dir}>
                  {(data?.latestReadings.length ?? 0) === 0 && activeAnomalies === 0 ? (
                    <EmptyMessage text={d.noSensorDataAvailable} />
                  ) : null}
                  <div className="grid grid-cols-2 gap-3">
                    <StatTile label={d.activeAnomalies} value={String(activeAnomalies)} tone="red" />
                    <StatTile label={d.affectedZones} value={String(affectedZones)} tone="green" />
                    <StatTile label="Store Orders" value={String(productStats?.summary.total_orders ?? 0)} tone="blue" />
                    <StatTile label="Store Revenue" value={`ILS ${(productStats?.summary.total_revenue ?? 0).toFixed(0)}`} tone="amber" />
                  </div>

                  {workerSpeedStats && (
                    <div
                      className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-xs"
                      data-testid="worker-speed-stats"
                    >
                      <span className="inline-flex items-center gap-1.5" dir="auto">
                        <span className="font-semibold text-[var(--color-primary)]">⚡ {workerSpeedStats.fastest.name}</span>
                        <span className="text-[var(--color-muted-foreground)]">{formatHours(workerSpeedStats.fastest.avgHours)} avg</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5" dir="auto">
                        <span className="font-semibold text-[var(--color-warning)]">🐢 {workerSpeedStats.slowest.name}</span>
                        <span className="text-[var(--color-muted-foreground)]">{formatHours(workerSpeedStats.slowest.avgHours)} avg</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-semibold text-[var(--color-foreground)]">⏱ All workers</span>
                        <span className="text-[var(--color-muted-foreground)]">
                          {formatHours(workerSpeedStats.overallAvgHours)} avg · {workerSpeedStats.taskCount} task{workerSpeedStats.taskCount === 1 ? '' : 's'}
                        </span>
                      </span>
                    </div>
                  )}
                </DashboardCard>

                {/* ── Store & Newsletter quick actions ── */}
                <DashboardCard title="Store & Newsletter" icon={<ShoppingBag className="h-4 w-4" />} direction={dir}>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => setStoreModal('coupons')}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-secondary-light)] px-3 py-2 text-sm font-semibold text-[var(--color-primary)] transition hover:opacity-90"
                    >
                      <Tag className="h-3.5 w-3.5" /> {t.store.coupons}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStoreModal('employee-discounts')}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-secondary-light)] px-3 py-2 text-sm font-semibold text-[var(--color-primary)] transition hover:opacity-90"
                    >
                      <UserCheck className="h-3.5 w-3.5" /> Emp. Discount
                    </button>
                    <button
                      type="button"
                      onClick={() => setStoreModal('newsletter')}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-secondary-light)] px-3 py-2 text-sm font-semibold text-[var(--color-primary)] transition hover:opacity-90"
                    >
                      <Mail className="h-3.5 w-3.5" /> {t.nav.newsletter}
                    </button>
                  </div>
                </DashboardCard>
              </div>

            {/* ── Weather card (US36) ── */}
            </section>

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
      {selectedTask && (
        <ManagerTaskDetailModal
          task={selectedTask}
          d={d}
          locale={locale}
          workerName={selectedTask.assignedToUserId ? workersById.get(selectedTask.assignedToUserId) ?? d.unknownWorker : d.unassigned}
          onClose={() => setSelectedTask(null)}
        />
      )}
      {taskModal && (
        <DashboardModal title="Create task" onClose={() => setTaskModal(null)}>
          {taskCreateError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {taskCreateError}
            </div>
          )}
          <TaskForm
            onSubmit={handleCreateTask}
            onCancel={() => setTaskModal(null)}
            isLoading={creatingTask}
            workers={(data?.users ?? [])
              .filter((user) => user.roleName === 'Worker' && user.isActive)
              .map((user) => ({ userId: user.userId, fullName: user.fullName, email: user.email }))}
            zones={zones}
            initialData={{
              zoneCode: taskModal.zoneCode ?? '',
              taskType: taskModal.zoneCode ? 'inspection' : '',
              priority: 'medium',
            }}
            submitLabel="Create task"
          />
        </DashboardModal>
      )}
      {storeModal && (
        <DashboardModal
          title={
            storeModal === 'coupons'
              ? t.store.coupons
              : storeModal === 'employee-discounts'
                ? 'Emp. Discount'
                : t.nav.newsletter
          }
          onClose={() => setStoreModal(null)}
          wide
        >
          <div className="max-h-[78vh] overflow-y-auto">
            {storeModal === 'coupons' ? <CouponsPage /> : storeModal === 'employee-discounts' ? <EmployeeDiscountsPage /> : <NewsletterPage />}
          </div>
        </DashboardModal>
      )}

      {tasksModalOpen && (
        <DashboardModal title={t.nav.tasks} onClose={closeTasksModal} wide>
          <div className="max-h-[78vh] overflow-y-auto">
            <ManageTasksModalContent
              activeTab={tasksModalTab}
              onTabChange={(tab) => { setTasksModalTab(tab); router.replace(`/manager?section=tasks&tab=${tab}`); }}
              alertPrefill={tasksModalAlertPrefill}
              onAlertPrefillConsumed={() => { setTasksModalAlertPrefill(null); router.replace('/manager?section=tasks'); }}
            />
          </div>
        </DashboardModal>
      )}
      {sprayModalOpen && (
        <DashboardModal title={sp.managerTitle} onClose={closeSprayModal} wide>
          <div className="max-h-[78vh] overflow-y-auto">
            <SprayManagementModalContent
              zones={sprayZones}
              zonesLoading={sprayLoading}
              zonesError={sprayError}
              onRefreshZones={loadSprayZones}
              scrollTarget={sprayModalScrollTarget}
              onScrollTargetConsumed={() => setSprayModalScrollTarget(null)}
            />
          </div>
        </DashboardModal>
      )}

      {/* ── Add Plant modal (registry) — same form as manager/inventory/plants ── */}
      {addPlantModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setAddPlantModal(null)}
        >
          <div
            className="relative w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setAddPlantModal(null)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] text-lg transition"
            >×</button>

            <h3 className="mb-1 pe-8 text-base font-semibold text-[var(--color-foreground)]">{inv.addPlantTitle}</h3>
            <p className="mb-4 text-sm text-[var(--color-muted-foreground)]">{addPlantModal.pepperName}</p>

            {addPlantError && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border-2 border-red-500 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                <span className="shrink-0">🚫</span><span>{addPlantError}</span>
              </div>
            )}

            <form onSubmit={handleRegistryAddPlant} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-[var(--color-muted-foreground)]">{inv.colPlantCode}</label>
                <input readOnly value={addPlantForm.PlantCode}
                  className="w-full cursor-not-allowed rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-[var(--color-muted-foreground)]">{inv.colZone}</label>
                <input readOnly value={zones.find((z) => z.ZoneCode === 'NURSERY')?.ZoneName ?? 'Nursery'}
                  className="w-full cursor-not-allowed rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-[var(--color-muted-foreground)]">{t.tasks.status}</label>
                <input readOnly value="Growing"
                  className="w-full cursor-not-allowed rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-[var(--color-muted-foreground)]">{inv.plantedAt}</label>
                <input readOnly value={fmtDate(new Date().toISOString())}
                  className="w-full cursor-not-allowed rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-[var(--color-muted-foreground)]">{inv.notesLabel}</label>
                <textarea
                  rows={2}
                  value={addPlantForm.Notes}
                  onChange={(e) => setAddPlantForm((f) => ({ ...f, Notes: e.target.value }))}
                  className="w-full resize-none rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAddPlantModal(null)}
                  className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm transition hover:bg-[var(--color-muted)]">
                  {inv.cancel}
                </button>
                <button type="submit" disabled={addPlantLoading}
                  className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 hover:opacity-90">
                  {addPlantLoading ? inv.saving : inv.addPlant}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Transfer modal (registry) ── */}
      {transferRegModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setTransferRegModal(null)}
        >
          <div
            className="relative w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setTransferRegModal(null)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] text-lg transition"
            >×</button>

            <h3 className="mb-1 pe-8 text-base font-semibold text-[var(--color-foreground)]">{wk.transferSeedling}</h3>
            <p className="mb-1 text-sm text-[var(--color-muted-foreground)]">{transferRegModal.pepperName}</p>
            <p className="mb-4 text-xs text-[var(--color-muted-foreground)]">{transferRegModal.plant.PlantCode}</p>

            {transferRegError && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border-2 border-red-500 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                <span className="shrink-0">🚫</span><span>{transferRegError}</span>
              </div>
            )}

            <form onSubmit={handleRegistryTransfer} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-[var(--color-muted-foreground)]">{wk.targetGreenhouse} *</label>
                <select
                  required
                  value={transferRegZoneId}
                  onChange={(e) => setTransferRegZoneId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="">— select greenhouse —</option>
                  {zones
                    .filter((z) => z.ZoneCode && GREENHOUSE_ZONES.has(z.ZoneCode))
                    .map((z) => <option key={z.ZoneId} value={z.ZoneId}>{z.ZoneName}</option>)
                  }
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-[var(--color-muted-foreground)]">Transfer Date *</label>
                <input
                  required
                  type="date"
                  value={transferRegDate}
                  onChange={(e) => setTransferRegDate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setTransferRegModal(null)}
                  className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm transition hover:bg-[var(--color-muted)]">
                  {inv.cancel}
                </button>
                <button
                  type="submit"
                  disabled={transferRegLoading || !transferRegZoneId || !transferRegDate}
                  className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
                >
                  {transferRegLoading ? wk.transferring : wk.confirmTransfer}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sprayReportZoneCode && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
          onClick={() => setSprayReportZoneCode(null)}
        >
          <div
            data-testid="manager-spray-report-modal"
            className="relative w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSprayReportZoneCode(null)}
              aria-label="Close spray report"
              className="absolute end-3 top-3 rounded-lg p-1 text-[var(--color-muted-foreground)] transition hover:bg-[var(--color-muted)]"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="mb-4 pe-8 text-base font-semibold text-[var(--color-foreground)]">{sp.sprayReportTitle}</h3>
            <SprayReportForm initialZoneCode={sprayReportZoneCode} onSubmitted={loadSprayZones} />
          </div>
        </div>
      )}
    </main>
  );
}

export default function ManagerPage() {
  return (
    <Suspense>
      <ManagerPageContent />
    </Suspense>
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
  onOpen,
}: {
  task: Task;
  urgency: UrgencyLevel;
  d: ReturnType<typeof useLanguage>['t']['dashboard'];
  workersById: Map<number, string>;
  locale: string;
  onOpen: (task: Task) => void;
}) {
  return (
    <article
      data-testid={URGENCY_TEST_IDS[urgency]}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(task);
        }
      }}
      className={`mb-2 cursor-pointer rounded-lg p-3 transition hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${URGENCY_STYLES[urgency]}`}
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

function ManagerTaskDetailModal({
  task,
  d,
  locale,
  workerName,
  onClose,
}: {
  task: Task;
  d: ReturnType<typeof useLanguage>['t']['dashboard'];
  locale: string;
  workerName: string;
  onClose: () => void;
}) {
  const checklistItems = task.checklistItems ?? [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <section
        className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manager-task-detail-title"
        data-testid="manager-task-detail-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--color-primary)]">Task #{task.id}</p>
            <h2 id="manager-task-detail-title" className="text-lg font-semibold text-[var(--color-foreground)]" dir="auto">{task.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close task details"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted-foreground)] transition hover:bg-[var(--color-muted)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {task.description && (
          <p className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-foreground)]" dir="auto">
            {task.description}
          </p>
        )}

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <InfoRow label={d.status} value={task.status.replace('_', ' ')} />
          <InfoRow label="Priority" value={task.priority} />
          <InfoRow label={d.dueDate} value={displayDate(task.dueDate, locale, d.noDueDate)} />
          <InfoRow label={d.assignedTo} value={workerName} />
          <InfoRow label="Zone" value={task.zoneCode ?? 'N/A'} valueDir="ltr" />
          <InfoRow label="Type" value={task.taskType} />
        </dl>

        {checklistItems.length > 0 && (
          <div className="mt-4 border-t border-[var(--color-border)] pt-4">
            <p className="mb-2 text-xs font-semibold text-[var(--color-muted-foreground)]">Checklist</p>
            <TaskProgressBar checklistItems={checklistItems} />
            <ul className="mt-3 space-y-2 text-sm">
              {checklistItems.map((item) => (
                <li key={item.itemId} className="flex items-center gap-2 text-[var(--color-foreground)]">
                  <span className={`h-2.5 w-2.5 rounded-full ${item.isCompleted ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`} />
                  <span dir="auto">{item.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 border-t border-[var(--color-border)] pt-4 text-xs text-[var(--color-muted-foreground)]">
          Manage this task from the dashboard modal.
        </div>
      </section>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DashboardModal({
  title,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-2xl ${wide ? 'max-w-5xl' : 'max-w-xl'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--color-foreground)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted-foreground)] transition hover:bg-[var(--color-muted)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </section>
    </div>
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
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
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
      {sub && <p className="mt-0.5 truncate text-xs opacity-70" dir="auto">{sub}</p>}
    </div>
  );
}
