'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  ClipboardList,
  Map as MapIcon,
  BarChart2,
  UserCircle,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import FarmMap, { type FarmSection } from '@/components/map/FarmMap';
import Alert from '@/components/ui/Alert';
import SprayReportForm from '@/components/spray/SprayReportForm';
import TaskProgressBar from '@/components/tasks/TaskProgressBar';
import { useLanguage } from '@/context/LanguageContext';
import { translateEnum, type Dictionary } from '@/i18n/dictionaries';
import { ChecklistItem, Task, TaskStatus } from '@/types/task';
import { getMyTasks, updateChecklistItem, updateTask } from '@/services/tasks';
import { getAllPlants, PlantData, createPlant, updatePlantLocation, updatePlantStatus } from '@/services/plants';
import { getAllPeppers } from '@/services/peppers';
import { getInventoryByVariety } from '@/services/inventory';
import { getZones, ZoneSummary } from '@/services/zones';
import { InventoryByVariety, PlantSummary } from '@/types/inventory';
import { Pepper } from '@/types/pepper';
import { getWorkerAnalytics, WorkerAnalytics } from '@/services/workerDashboard';
import { apiFetch } from '@/services/apiClient';
import { useWorkerNotification } from '@/context/WorkerNotificationContext';

// ── Types ────────────────────────────────────────────────────────────────────

type MapMode = 'tasks' | 'sprays' | 'planting';

interface SprayZone {
  zoneId: number;
  zoneCode: string;
  zoneName: string;
  sprayStatus: string;
  entryPermissionStatus: string;
  entryAllowed: boolean;
  entryMessage: string;
  lastCompletedAtUtc: string | null;
  pesticideName: string | null;
  safeToReEnterAtUtc: string | null;
  nextPlannedAtUtc: string | null;
  remainingRestrictionMinutes: number | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ZONE_CODE_TO_ID: Record<string, number> = {
  'GH-01': 1,  'GH-02': 2,  'GH-03': 3,  'GH-04': 4,
  'GH-05': 5,  'GH-06': 6,  'GH-07': 7,  'GH-08': 8,
  'NURSERY': 9, 'SHED-MAIN': 10, 'GH-09': 11, 'GH-10': 12,
  'GERM-01': 13, 'GERM-02': 14, 'VIS-CENTER': 15,
  'GERM-03': 16, 'GERM-04': 17, 'FACTORY': 18,
};

// Zones where a brand-new plant may be created (first planting)
const NURSERY_ZONES = new Set(['NURSERY']);

// Zones where a seedling may be transferred after nursery
const GREENHOUSE_ZONES = new Set([
  'GH-01', 'GH-02', 'GH-03', 'GH-04', 'GH-05',
  'GH-06', 'GH-07', 'GH-08', 'GH-09', 'GH-10',
  'GERM-01', 'GERM-02', 'GERM-03', 'GERM-04',
]);

const OPEN_STATUSES = new Set<TaskStatus>(['todo', 'in_progress']);

const PLANT_STATUSES = ['Healthy', 'Growing', 'Sick', 'Harvested', 'Dead'];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusBadgeClass(status: string | null): string {
  switch ((status ?? '').toLowerCase()) {
    case 'healthy':   return 'bg-green-100 text-green-800';
    case 'growing':   return 'bg-yellow-100 text-yellow-800';
    case 'sick':
    case 'diseased':  return 'bg-red-100 text-red-800';
    case 'harvested': return 'bg-blue-100 text-blue-800';
    case 'dead':      return 'bg-gray-200 text-gray-600';
    default:          return 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]';
  }
}

function recalcBreakdown(plants: PlantSummary[]): Record<string, number> {
  const bd: Record<string, number> = {};
  for (const p of plants) { const k = p.Status || 'Unknown'; bd[k] = (bd[k] ?? 0) + 1; }
  return bd;
}

const DUE_SOON_HOURS = 24;

// ── Helpers ──────────────────────────────────────────────────────────────────

function isOverdue(task: Task): boolean {
  if (!task.dueDate) return false;
  return new Date(task.dueDate + (task.dueDate.endsWith('Z') ? '' : 'Z')) < new Date();
}

function isDueSoon(task: Task): boolean {
  if (!task.dueDate) return false;
  const due = new Date(task.dueDate + (task.dueDate.endsWith('Z') ? '' : 'Z'));
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  return diffMs > 0 && diffMs <= DUE_SOON_HOURS * 3_600_000;
}

function formatHours(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${hours.toFixed(1)}h`;
}

function checklistProgress(items: ChecklistItem[]): { done: number; total: number } {
  if (!items.length) return { done: 0, total: 0 };
  return { done: items.filter((i) => i.isCompleted).length, total: items.length };
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
  direction?: 'ltr' | 'rtl';
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm ${className}`} dir={direction}>
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-secondary-light)] text-[var(--color-primary)]">
          {icon}
        </span>
        <h2 className="text-base font-semibold text-[var(--color-foreground)]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-6 text-center text-sm text-[var(--color-muted-foreground)]">
      {text}
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
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
      <p className="mb-1 text-xs font-medium opacity-80">{label}</p>
      <p className="text-xl font-semibold" dir="ltr">{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs opacity-70" dir="auto">{sub}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WorkerDashboard() {
  const router = useRouter();
  const { t, locale, dir } = useLanguage();
  const wk = t.worker;

  // ── State ────────────────────────────────────────────────────────────────

  const {
    appNotifs,
    loadAppNotifs,
    dismissAppNotif,
    markAllAppNotifsRead,
  } = useWorkerNotification();

  const [tasks,           setTasks]           = useState<Task[]>([]);
  const [plants,          setPlants]          = useState<PlantData[]>([]);
  const [peppers,         setPeppers]         = useState<Pepper[]>([]);
  const [analytics,       setAnalytics]       = useState<WorkerAnalytics | null>(null);
  const [sprayZones,      setSprayZones]      = useState<SprayZone[]>([]);
  const [isLoading,       setIsLoading]       = useState(true);
  const [error,           setError]           = useState<string | null>(null);
  const [mapMode,         setMapMode]         = useState<MapMode>('tasks');
  const [selectedPepper,  setSelectedPepper]  = useState<number | ''>('');
  const [mapMessage,      setMapMessage]      = useState<{ text: string; ok: boolean } | null>(null);
  const [saving,          setSaving]          = useState(false);
  const [showCompleted,   setShowCompleted]   = useState(false);
  const [activeTask,      setActiveTask]      = useState<Task | null>(null);
  const [completing,           setCompleting]           = useState(false);
  const [workerName,           setWorkerName]           = useState('');
  const [selectedTransferPlant,setSelectedTransferPlant] = useState<PlantData | null>(null);
  const [transferring,         setTransferring]         = useState(false);
  const [zoneDetailsOpen,      setZoneDetailsOpen]      = useState(false);
  const [sprayReportZoneCode,  setSprayReportZoneCode]  = useState<string | null>(null);

  // Plants Registry panel (planting mode)
  const [plantRegistryOpen,    setPlantRegistryOpen]    = useState(false);
  const [inventoryRows,        setInventoryRows]        = useState<InventoryByVariety[]>([]);
  const [inventoryZones,       setInventoryZones]       = useState<ZoneSummary[]>([]);
  const [inventoryLoading,     setInventoryLoading]     = useState(false);
  const [inventoryExpanded,    setInventoryExpanded]    = useState<Record<number, boolean>>({});
  const [inventorySearch,      setInventorySearch]      = useState('');

  // Add-plant modal (registry)
  const [addPlantModal,        setAddPlantModal]        = useState<{ pepperId: number; pepperName: string } | null>(null);
  const [addPlantForm,         setAddPlantForm]         = useState({ PlantCode: '', Notes: '' });
  const [addPlantLoading,      setAddPlantLoading]      = useState(false);
  const [addPlantError,        setAddPlantError]        = useState<string | null>(null);

  // Transfer modal (registry)
  const [transferRegModal,     setTransferRegModal]     = useState<{ plant: PlantSummary; pepperName: string } | null>(null);
  const [transferRegZoneId,    setTransferRegZoneId]    = useState('');
  const [transferRegDate,      setTransferRegDate]      = useState('');
  const [transferRegLoading,   setTransferRegLoading]   = useState(false);
  const [transferRegError,     setTransferRegError]     = useState<string | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
    setWorkerName(localStorage.getItem('fullName') ?? '');
    setIsLoading(true);
    setError(null);
    try {
      const [tasksData, plantsData, peppersData, analyticsData] = await Promise.all([
        getMyTasks(token),
        getAllPlants(token),
        getAllPeppers(),
        getWorkerAnalytics(token).catch(() => null),
      ]);

      setTasks(tasksData);
      setPlants(plantsData);
      setPeppers(peppersData);
      setAnalytics(analyticsData);

      // Spray zone data — gracefully handle missing access
      const sprayData = await apiFetch<SprayZone[]>('/api/spray-reports/restricted-zones', {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => [] as SprayZone[]);
      setSprayZones(Array.isArray(sprayData) ? sprayData : []);
    } catch {
      setError(wk.failedToLoad);
    } finally {
      setIsLoading(false);
    }
  }, [router, wk.failedToLoad]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load app notifications via shared context (synced with bell panel)
  useEffect(() => { loadAppNotifs(); }, [loadAppNotifs]);

  // ── Task update handlers ──────────────────────────────────────────────────

  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    const token = localStorage.getItem('token') ?? '';
    try {
      const updated = await updateTask(task.id, { status: newStatus }, token);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      if (activeTask?.id === updated.id) setActiveTask(updated);
    } catch {
      setError(wk.failedToUpdateStatus);
    }
  };

  const handleToggleChecklist = async (
    task: Task,
    item: ChecklistItem,
    nextCompleted: boolean,
  ) => {
    const token = localStorage.getItem('token') ?? '';
    try {
      const updated = await updateChecklistItem(task.id, item.itemId, { isCompleted: nextCompleted }, token);
      const patchTask = (t: Task): Task =>
        t.id === task.id
          ? { ...t, checklistItems: t.checklistItems.map((ci) => ci.itemId === updated.itemId ? updated : ci) }
          : t;
      setTasks((prev) => prev.map(patchTask));
      if (activeTask?.id === task.id) setActiveTask((prev) => prev ? patchTask(prev) : null);
    } catch {
      setError(t.tasks.failedToUpdateChecklistItem);
    }
  };

  const handleCompleteTask = async (task: Task) => {
    const token = localStorage.getItem('token') ?? '';
    setCompleting(true);
    try {
      const updated = await updateTask(task.id, { status: 'done' }, token);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setActiveTask(null);
      // Refresh analytics
      const analyticsData = await getWorkerAnalytics(token).catch(() => null);
      setAnalytics(analyticsData);
    } catch {
      setError(wk.failedToCompleteTask);
    } finally {
      setCompleting(false);
    }
  };

  // ── Plant in Nursery ──────────────────────────────────────────────────────

  const handlePlantInZone = async (section: FarmSection) => {
    if (!selectedPepper) {
      setMapMessage({ text: t.map.pleaseSelectPepper, ok: false });
      return;
    }
    if (!NURSERY_ZONES.has(section.id)) {
      setMapMessage({ text: wk.plantingNurseryOnly, ok: false });
      return;
    }
    const token = localStorage.getItem('token') ?? '';
    setSaving(true);
    setMapMessage(null);
    try {
      const zoneId = ZONE_CODE_TO_ID[section.id];
      const pepper = peppers.find((p) => p.PepperId === Number(selectedPepper));
      const plantCode = `${pepper?.PepperName?.replace(/\s+/g, '-').toUpperCase() ?? 'PLANT'}-${section.id}-${Date.now()}`;
      await createPlant({ PlantCode: plantCode, PepperId: Number(selectedPepper), ZoneId: zoneId ?? null, Status: 'Growing', IsActive: true });
      setMapMessage({ text: `${pepper?.PepperName} — ${section.name} — ${t.map.assignedSuccessfully}`, ok: true });
      setSelectedPepper('');
      const updated = await getAllPlants(token);
      setPlants(updated);
    } catch (err) {
      setMapMessage({ text: err instanceof Error ? err.message : t.map.failedToAssign, ok: false });
    } finally {
      setSaving(false);
    }
  };

  // ── Refresh spray zones only ──────────────────────────────────────────────

  const refreshSprayZones = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const sprayData = await apiFetch<SprayZone[]>('/api/spray-reports/restricted-zones', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSprayZones(Array.isArray(sprayData) ? sprayData : []);
    } catch { /* silent */ }
  }, []);

  // ── Plants Registry ───────────────────────────────────────────────────────

  const loadInventory = useCallback(async () => {
    setInventoryLoading(true);
    try {
      const [invData, zoneData] = await Promise.all([getInventoryByVariety(), getZones()]);
      setInventoryRows(invData);
      setInventoryZones(zoneData);
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
    const nursery = inventoryZones.find((z) => z.ZoneCode === 'NURSERY');
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
      const token = localStorage.getItem('token') ?? '';
      const updated = await getAllPlants(token);
      setPlants(updated);
      setAddPlantModal(null);
    } catch (err) {
      setAddPlantError(err instanceof Error ? err.message : 'Failed to add plant.');
    } finally {
      setAddPlantLoading(false);
    }
  }, [addPlantModal, addPlantForm, inventoryZones, loadInventory]);

  const handleRegistryTransfer = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferRegModal || !transferRegZoneId || !transferRegDate) return;
    const token = localStorage.getItem('token') ?? '';
    setTransferRegLoading(true);
    setTransferRegError(null);
    try {
      await updatePlantLocation(token, transferRegModal.plant.PlantId, Number(transferRegZoneId), transferRegDate);
      await loadInventory();
      const updated = await getAllPlants(token);
      setPlants(updated);
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
      setPlants((prev) => prev.map((p) => p.PlantId === plantId ? { ...p, Status: newStatus || null } : p));
      setMapMessage(null);
    } catch (err) {
      setMapMessage({ text: err instanceof Error ? err.message : 'Failed to update plant status.', ok: false });
    }
  }, []);

  const openRegistryTransferFromMap = useCallback(async (plant: PlantData, pepperName: string) => {
    if (inventoryZones.length === 0) {
      try {
        setInventoryZones(await getZones());
      } catch {
        setMapMessage({ text: 'Failed to load greenhouse list.', ok: false });
        return;
      }
    }
    setTransferRegModal({
      plant: {
        PlantId: plant.PlantId,
        PlantCode: plant.PlantCode,
        Status: plant.Status,
        ZoneId: plant.ZoneId,
        ZoneName: null,
        PlantedAt: null,
        TransferredAt: null,
      },
      pepperName,
    });
    setTransferRegZoneId('');
    setTransferRegDate(new Date().toISOString().slice(0, 10));
    setTransferRegError(null);
  }, [inventoryZones.length]);

  // ── Transfer plant ────────────────────────────────────────────────────────

  const handleTransferPlant = async (section: FarmSection) => {
    if (!selectedTransferPlant) return;
    if (!GREENHOUSE_ZONES.has(section.id)) {
      setMapMessage({ text: wk.plantingBlockedZones, ok: false });
      return;
    }
    const token = localStorage.getItem('token') ?? '';
    setTransferring(true);
    setMapMessage(null);
    try {
      const zoneId = ZONE_CODE_TO_ID[section.id];
      await updatePlantLocation(token, selectedTransferPlant.PlantId, zoneId ?? null);
      setMapMessage({ text: `${selectedTransferPlant.PlantCode} → ${section.name}`, ok: true });
      setSelectedTransferPlant(null);
      const updated = await getAllPlants(token);
      setPlants(updated);
    } catch (err) {
      setMapMessage({ text: err instanceof Error ? err.message : t.map.failedToAssign, ok: false });
    } finally {
      setTransferring(false);
    }
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const openTasks = useMemo(() => tasks.filter((t) => OPEN_STATUSES.has(t.status)), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.status === 'done'), [tasks]);

  const { overdueTasks, dueSoonTasks, normalTasks } = useMemo(() => {
    const overdue: Task[] = [];
    const dueSoon: Task[] = [];
    const normal: Task[] = [];
    for (const task of openTasks) {
      if (isOverdue(task)) overdue.push(task);
      else if (isDueSoon(task)) dueSoon.push(task);
      else normal.push(task);
    }
    return { overdueTasks: overdue, dueSoonTasks: dueSoon, normalTasks: normal };
  }, [openTasks]);

  // Section colors depend on map mode
  const sectionColors = useMemo((): Record<string, string> => {
    if (mapMode === 'tasks') {
      const colors: Record<string, string> = {};
      for (const task of openTasks) {
        if (!task.zoneCode) continue;
        if (isOverdue(task)) {
          colors[task.zoneCode] = 'rgba(239,68,68,0.35)'; // red
        } else if (isDueSoon(task)) {
          if (!colors[task.zoneCode] || colors[task.zoneCode] === 'rgba(209,213,219,0.35)') {
            colors[task.zoneCode] = 'rgba(251,191,36,0.35)'; // amber
          }
        } else {
          if (!colors[task.zoneCode]) {
            colors[task.zoneCode] = 'rgba(239,68,68,0.18)'; // light-red
          }
        }
      }
      return colors;
    }
    if (mapMode === 'sprays') {
      const colors: Record<string, string> = {};
      for (const zone of sprayZones) {
        if (!zone.entryAllowed && zone.sprayStatus === 'unsafe') {
          colors[zone.zoneCode] = 'rgba(239,68,68,0.30)';   // red — restricted
        } else if (!zone.entryAllowed) {
          colors[zone.zoneCode] = 'rgba(251,191,36,0.30)';  // amber — caution
        } else {
          colors[zone.zoneCode] = 'rgba(22,163,74,0.20)';   // green — entry permitted
        }
      }
      return colors;
    }
    if (mapMode === 'planting') {
      const colors: Record<string, string> = {};
      for (const [code] of Object.entries(ZONE_CODE_TO_ID)) {
        if (NURSERY_ZONES.has(code)) {
          colors[code] = 'rgba(22,163,74,0.20)'; // green — allowed first planting
        } else if (GREENHOUSE_ZONES.has(code)) {
          colors[code] = 'rgba(59,130,246,0.15)'; // blue — transfer allowed
        } else {
          colors[code] = 'rgba(209,213,219,0.30)'; // gray — blocked
        }
      }
      return colors;
    }
    return {};
  }, [mapMode, openTasks, sprayZones]);

  // ── Popup extra for FarmMap ───────────────────────────────────────────────

  const renderPopupExtra = (section: FarmSection) => {
    if (mapMode === 'tasks') {
      const zoneTasks = openTasks.filter((t) => t.zoneCode === section.id);
      if (zoneTasks.length === 0) {
        return (
          <div className="mt-3 rounded-lg bg-[var(--color-secondary-light)] px-3 py-2 text-sm text-[var(--color-primary)]">
            ✓ {t.map.noOpenTasksInZone}
          </div>
        );
      }
      return (
        <div className="mt-3 flex flex-col gap-2">
          {zoneTasks.map((task) => (
            <button
              key={task.id}
              onClick={() => setActiveTask(task)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm shadow-sm transition-colors ${
                isOverdue(task) ? 'bg-red-50 border border-red-200 text-red-700' :
                isDueSoon(task) ? 'bg-amber-50 border border-amber-200 text-amber-700' :
                'bg-[var(--color-muted)] border border-[var(--color-border)] text-[var(--color-foreground)]'
              }`}
            >
              <span className="shrink-0 text-base">📋</span>
              <span className="flex-1 truncate font-semibold">{task.title}</span>
              {isOverdue(task) && <span className="shrink-0 text-xs font-bold uppercase">{wk.overdueAttention}</span>}
              {isDueSoon(task) && !isOverdue(task) && <span className="shrink-0 text-xs font-bold uppercase">{wk.nearDueAttention}</span>}
            </button>
          ))}
        </div>
      );
    }

    if (mapMode === 'sprays') {
      const code = section.id;
      const isSprayable = code.startsWith('GH-') || code.startsWith('GERM-') || code === 'NURSERY';
      if (!isSprayable) {
        return (
          <div className="mt-3 rounded-lg bg-[var(--color-muted)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]">
            🚫 {wk.notSprayableZone}
          </div>
        );
      }
      const zone = sprayZones.find((z) => z.zoneCode === code);
      const restricted = zone ? !zone.entryAllowed : false;
      return (
        <div className="mt-3 flex flex-col gap-2">
          <div className={`rounded-lg px-3 py-2 text-sm ${restricted ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-[var(--color-secondary-light)] border border-[var(--color-border)] text-[var(--color-primary)]'}`}>
            {restricted ? `⚠️ ${t.spray.entryRestricted}` : `✓ ${t.spray.entryPermitted}`}
          </div>
          <button
            data-testid={`create-spray-report-${code}`}
            onClick={() => setSprayReportZoneCode(code)}
            className="w-full rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            🌿 {wk.createSprayReport}
          </button>
        </div>
      );
    }

    if (mapMode === 'planting') {
      const isNursery = NURSERY_ZONES.has(section.id);
      const isGreenhouse = GREENHOUSE_ZONES.has(section.id);
      if (isNursery) {
        const nurseryZoneId = ZONE_CODE_TO_ID['NURSERY'];
        const nurseryPlants = plants.filter((p) => p.ZoneId === nurseryZoneId);
        return (
          <div className="mt-3 flex flex-col gap-2">
            <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
              🌱 {wk.plantingNurseryOnly}
            </div>

            {/* Existing plants in nursery */}
            <div className="border-t border-[var(--color-border)] pt-2">
              <p className="mb-1.5 text-xs font-semibold text-[var(--color-foreground)]">{wk.nurseryPlants}</p>
              {nurseryPlants.length === 0 ? (
                <p className="text-xs text-[var(--color-muted-foreground)] italic">{wk.noNurseryPlants}</p>
              ) : (
                <div className="mb-2 flex flex-col gap-1 max-h-32 overflow-y-auto">
                  {nurseryPlants.map((p) => {
                    const pepperName = peppers.find((pp) => pp.PepperId === p.PepperId)?.PepperName;
                    const canTransfer = (p.Status ?? '').toLowerCase() === 'healthy';
                    return (
                      <div
                        key={p.PlantId}
                        data-testid={`nursery-plant-${p.PlantId}`}
                        className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-2 py-1.5 text-xs text-[var(--color-foreground)]"
                      >
                        <span className="shrink-0">🌶️</span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{pepperName ?? p.PlantCode}</p>
                          <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]" dir="ltr">
                            #{p.PlantId} - {p.PlantCode}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <select
                            value={p.Status ?? ''}
                            onChange={(e) => handleRegistryStatusChange(p.PlantId, e.target.value)}
                            className={`max-w-[92px] cursor-pointer rounded border-0 px-1.5 py-0.5 text-[10px] focus:outline-none ${statusBadgeClass(p.Status)}`}
                            aria-label={`Status for ${p.PlantCode}`}
                          >
                            <option value="">-</option>
                            {PLANT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                          {canTransfer && (
                            <button
                              type="button"
                              onClick={() => openRegistryTransferFromMap(p, pepperName ?? p.PlantCode)}
                              className="whitespace-nowrap rounded bg-green-600 px-2 py-0.5 text-[10px] font-medium text-white transition hover:bg-green-700"
                            >
                              Transfer
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {selectedTransferPlant && (
                <button
                  onClick={() => setSelectedTransferPlant(null)}
                  className="mb-2 w-full rounded-full border border-[var(--color-border)] bg-amber-50 px-2 py-1 text-xs text-amber-700 hover:bg-amber-100 transition"
                  data-testid="cancel-transfer"
                >
                  ✕ {wk.cancelTransfer}: {peppers.find((pp) => pp.PepperId === selectedTransferPlant.PepperId)?.PepperName ?? selectedTransferPlant.PlantCode}
                </button>
              )}
            </div>

            {/* Plant new seedling */}
            <div className="border-t border-[var(--color-border)] pt-2">
              <label className="mb-1 block text-xs font-medium text-[var(--color-foreground)]">{t.map.selectPepper}</label>
              <select
                value={selectedPepper}
                onChange={(e) => setSelectedPepper(e.target.value === '' ? '' : Number(e.target.value))}
                className="mb-2 w-full rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="">{t.map.choosePepper}</option>
                {peppers.map((p) => <option key={p.PepperId} value={p.PepperId}>🌶️ {p.PepperName}</option>)}
              </select>
              <button
                onClick={() => handlePlantInZone(section)}
                disabled={!selectedPepper || saving}
                className="w-full rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm font-semibold text-white transition disabled:opacity-50"
              >
                {saving ? t.map.planting : selectedPepper ? t.map.plantHere : t.map.selectPepperFirst}
              </button>
            </div>
          </div>
        );
      }
      if (isGreenhouse) {
        const ghZoneId = ZONE_CODE_TO_ID[section.id];
        const ghPlants = plants.filter((p) => p.ZoneId === ghZoneId);
        const canTransferHere = selectedTransferPlant != null &&
          selectedTransferPlant.ZoneId !== ghZoneId;
        return (
          <div className="mt-3 flex flex-col gap-2">
            {/* Plants in this greenhouse */}
            <div className="border-t border-[var(--color-border)] pt-2">
              <p className="mb-1.5 text-xs font-semibold text-[var(--color-foreground)]">{wk.plantsInZone}</p>
              {ghPlants.length === 0 ? (
                <p className="text-xs text-[var(--color-muted-foreground)] italic">{wk.noPlantsInZone}</p>
              ) : (
                <div className="mb-2 flex flex-col gap-1 max-h-32 overflow-y-auto">
                  {ghPlants.map((p) => {
                    const pepperName = peppers.find((pp) => pp.PepperId === p.PepperId)?.PepperName;
                    return (
                      <div
                        key={p.PlantId}
                        data-testid={`greenhouse-plant-${p.PlantId}`}
                        className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-2 py-1.5 text-xs text-[var(--color-foreground)]"
                      >
                        <span className="shrink-0">🌶️</span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{pepperName ?? p.PlantCode}</p>
                          <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]" dir="ltr">
                            #{p.PlantId} - {p.PlantCode}
                          </p>
                        </div>
                        <select
                          value={p.Status ?? ''}
                          onChange={(e) => handleRegistryStatusChange(p.PlantId, e.target.value)}
                          className={`max-w-[92px] cursor-pointer rounded border-0 px-1.5 py-0.5 text-[10px] focus:outline-none ${statusBadgeClass(p.Status)}`}
                          aria-label={`Status for ${p.PlantCode}`}
                        >
                          <option value="">-</option>
                          {PLANT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Transfer action */}
            {canTransferHere ? (
              <>
                <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-700">
                  🔄 {peppers.find((pp) => pp.PepperId === selectedTransferPlant!.PepperId)?.PepperName ?? selectedTransferPlant!.PlantCode}
                </div>
                <button
                  data-testid="transfer-plant-button"
                  onClick={() => handleTransferPlant(section)}
                  disabled={transferring}
                  className="w-full rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {transferring ? wk.transferring : wk.transferPlantHere}
                </button>
              </>
            ) : !selectedTransferPlant && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-700">
                🔄 {wk.plantingAllowedZones}
              </div>
            )}
          </div>
        );
      }
      return (
        <div className="mt-3 rounded-lg bg-[var(--color-muted)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]">
          🚫 {wk.plantingBlockedZones}
        </div>
      );
    }

    return null;
  };

  // ── Map mode hero/summary ─────────────────────────────────────────────────

  const heroText = {
    tasks:    wk.heroTasksSummary,
    sprays:   wk.heroSpraysSummary,
    planting: wk.heroPlantingSummary,
  }[mapMode];

  const heroIcon = { tasks: '📋', sprays: '🌿', planting: '🌱' }[mapMode];

  // ── Legend for map mode ───────────────────────────────────────────────────

  const legendItems = useMemo(() => {
    if (mapMode === 'tasks') return [
      { label: `${wk.overdue} / ${t.tasks.status}`, color: 'rgba(239,68,68,0.35)', border: '#ef4444' },
      { label: wk.dueSoon, color: 'rgba(251,191,36,0.35)', border: '#f59e0b' },
      { label: t.map.legendHasTasks, color: 'rgba(239,68,68,0.18)', border: '#ef4444' },
      { label: t.map.legendNoTasks, color: 'rgba(209,213,219,0.5)', border: '#9ca3af' },
    ];
    if (mapMode === 'sprays') return [
      { label: t.spray.entryRestricted,     color: 'rgba(239,68,68,0.30)',  border: '#ef4444' },
      { label: t.spray.cautionConsultManager, color: 'rgba(251,191,36,0.30)', border: '#f59e0b' },
      { label: t.spray.entryPermitted,      color: 'rgba(22,163,74,0.20)',  border: '#16a34a' },
    ];
    // planting
    return [
      { label: wk.plantingNurseryOnly, color: 'rgba(22,163,74,0.20)', border: '#16a34a' },
      { label: wk.plantingAllowedZones, color: 'rgba(59,130,246,0.15)', border: '#3b82f6' },
      { label: wk.plantingBlockedZones, color: 'rgba(209,213,219,0.30)', border: '#9ca3af' },
    ];
  }, [mapMode, wk, t]);

  const filteredInventoryRows = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    if (!q) return inventoryRows;
    return inventoryRows.filter((r) =>
      r.PepperName.toLowerCase().includes(q) ||
      r.Plants.some((p) => p.PlantCode.toLowerCase().includes(q)),
    );
  }, [inventoryRows, inventorySearch]);

  // Spray hero stats — restricted / caution / permitted counts
  const sprayHeroStats = useMemo(() => {
    const agri = sprayZones.filter((z) =>
      z.zoneCode.startsWith('GH-') || z.zoneCode.startsWith('GERM-') || z.zoneCode === 'NURSERY'
    );
    return {
      total:      agri.length,
      restricted: agri.filter((z) => !z.entryAllowed && z.sprayStatus === 'unsafe').length,
      caution:    agri.filter((z) => !z.entryAllowed && z.sprayStatus !== 'unsafe').length,
      permitted:  agri.filter((z) => z.entryAllowed).length,
    };
  }, [sprayZones]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="app-page-bg" dir={dir}>
      {/* ── Header ── */}
      <div className="border-b border-[var(--color-border)] bg-white/85">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-4 px-5 py-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">PepperFarm</p>
            <h1 className="text-3xl font-semibold text-[var(--color-foreground)]">{wk.dashboardTitle}</h1>
          </div>
          {workerName && (
            <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-secondary-light)] px-3 py-2 text-sm text-[var(--color-primary)]">
              <UserCircle className="h-4 w-4" />
              <span>{wk.workerUser}</span>
              <span className="font-semibold" dir="auto">{workerName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[1800px] px-5 py-6">
        {error && <Alert variant="info" className="mb-5">{error}</Alert>}

        {isLoading ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(260px,0.65fr)_minmax(760px,2.4fr)_minmax(260px,0.75fr)]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-80 animate-pulse rounded-xl border border-[var(--color-border)] bg-white" />
            ))}
          </div>
        ) : (
          <>
            {/* ── Analytics row ── */}
            <section className="mb-5" dir={dir}>
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-secondary-light)] text-[var(--color-primary)]">
                  <BarChart2 className="h-4 w-4" />
                </span>
                <h2 className="text-base font-semibold text-[var(--color-foreground)]">{wk.analyticsTitle}</h2>
              </div>

              {analytics === null ? (
                <EmptyMessage text={wk.noAnalyticsData} />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <StatTile label={wk.openTasksCount}       value={String(analytics.openTasksCount)}       tone="red"   />
                  <StatTile label={wk.completedTasksCount}  value={String(analytics.completedTasksCount)}  tone="green" />
                  <StatTile label={wk.avgCompletionTime}    value={formatHours(analytics.avgCompletionTimeHours)}     tone="blue"  />
                  <StatTile label={wk.fastestTask}  value={formatHours(analytics.fastestCompletionTimeHours)} sub={analytics.fastestTaskTitle ?? undefined} tone="gray"  />
                  <StatTile label={wk.slowestTask}  value={formatHours(analytics.slowestCompletionTimeHours)} sub={analytics.slowestTaskTitle ?? undefined} tone="amber" />
                </div>
              )}
            </section>

            {/* ── Three-column layout ── */}
            <section
              className="grid gap-5 lg:grid-cols-[minmax(270px,0.65fr)_minmax(760px,2.4fr)_minmax(280px,0.75fr)]"
              dir="ltr"
            >
              {/* ── Left: Task panel ── */}
              <DashboardCard title={wk.myTasks} icon={<ClipboardList className="h-4 w-4" />} direction={dir as 'ltr' | 'rtl'}>
                {openTasks.length === 0 && completedTasks.length === 0 ? (
                  <EmptyMessage text={wk.noTasksAssigned} />
                ) : (
                  <>
                    {/* Toggle completed */}
                    <div className="mb-2 flex items-center justify-between gap-2">
                      {openTasks.length > 0 && (
                        <p className="text-xs font-medium text-[var(--color-muted-foreground)]">
                          {openTasks.length} {wk.openTasksCount.toLowerCase()}
                        </p>
                      )}
                      {completedTasks.length > 0 && (
                        <button
                          type="button"
                          data-testid="toggle-completed"
                          onClick={() => setShowCompleted((c) => !c)}
                          className={`ms-auto flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                            showCompleted
                              ? 'border-[var(--color-border)] bg-[var(--color-secondary-light)] text-[var(--color-primary)]'
                              : 'border-[var(--color-border)] bg-white text-[var(--color-muted-foreground)] hover:border-[var(--color-primary)]'
                          }`}
                        >
                          {showCompleted ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {showCompleted ? wk.hideCompleted : wk.showCompleted}
                        </button>
                      )}
                    </div>

                    <div data-testid="task-panel-scroll" className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
                      {/* Overdue */}
                      {overdueTasks.length > 0 && (
                        <div>
                          <p className="mb-1.5 px-0.5 text-xs font-semibold text-[var(--color-error)]" data-testid="group-label-overdue">
                            {wk.overdue}
                          </p>
                          {overdueTasks.map((task) => (
                            <WorkerTaskCard key={task.id} task={task} urgency="overdue" onClick={() => setActiveTask(task)} locale={locale} wk={wk} t={t} />
                          ))}
                        </div>
                      )}

                      {/* Due soon */}
                      {dueSoonTasks.length > 0 && (
                        <div>
                          <p className="mb-1.5 px-0.5 text-xs font-semibold text-[var(--color-warning)]" data-testid="group-label-due-soon">
                            {wk.dueSoon}
                          </p>
                          {dueSoonTasks.map((task) => (
                            <WorkerTaskCard key={task.id} task={task} urgency="due-soon" onClick={() => setActiveTask(task)} locale={locale} wk={wk} t={t} />
                          ))}
                        </div>
                      )}

                      {/* Normal */}
                      {normalTasks.map((task) => (
                        <WorkerTaskCard key={task.id} task={task} urgency="normal" onClick={() => setActiveTask(task)} locale={locale} wk={wk} t={t} />
                      ))}

                      {/* Completed (toggleable) */}
                      {showCompleted && completedTasks.length > 0 && (
                        <div className="mt-2 border-t border-[var(--color-border)] pt-3">
                          <p className="mb-1.5 px-0.5 text-xs font-semibold text-[var(--color-primary)]" data-testid="group-label-completed">
                            {wk.hideCompleted}
                          </p>
                          {completedTasks.map((task) => (
                            <WorkerTaskCard key={task.id} task={task} urgency="completed" onClick={() => setActiveTask(task)} locale={locale} wk={wk} t={t} />
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </DashboardCard>

              {/* ── Center: Farm map ── */}
              <DashboardCard title={wk.farmMap} icon={<MapIcon className="h-4 w-4" />} className="min-w-0" direction={dir as 'ltr' | 'rtl'}>
                {/* Mode selector */}
                <div className="mb-3 flex flex-wrap items-center gap-2" dir={dir}>
                  {(['tasks', 'sprays', 'planting'] as MapMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      data-testid={`map-mode-${mode}`}
                      onClick={() => setMapMode(mode)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        mapMode === mode
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                          : 'border-[var(--color-border)] bg-[var(--color-secondary-light)] text-[var(--color-primary)] hover:border-[var(--color-primary)]'
                      }`}
                    >
                      {mode === 'tasks' ? wk.mapModeTasks : mode === 'sprays' ? wk.mapModeSprays : wk.mapModePlanting}
                    </button>
                  ))}
                  {mapMode === 'sprays' && (
                    <button
                      type="button"
                      data-testid="spray-refresh-button"
                      onClick={refreshSprayZones}
                      className="ms-auto rounded-full border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] transition"
                    >
                      ↺ {t.spray.refresh}
                    </button>
                  )}
                </div>

                {/* Hero summary */}
                {mapMode === 'sprays' ? (
                  <div className="mb-3 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2" dir={dir} data-testid="spray-overview">
                    <div className="mb-1 flex items-center">
                      <span className="hidden">🌿</span>
                      <p className="text-xs font-semibold text-[var(--color-foreground)]">{wk.sprayZoneOverview}</p>
                    </div>
                    {sprayHeroStats.total > 0 && (
                      <div className="hidden">
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                          ⛔ {sprayHeroStats.restricted} {t.spray.entryRestricted}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                          ⚠️ {sprayHeroStats.caution} {wk.cautionZones}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">
                          ✓ {sprayHeroStats.permitted} {t.spray.entryPermitted}
                        </span>
                      </div>
                    )}
                    <p className="text-[11px] text-[var(--color-muted-foreground)]">{wk.heroSpraysSummary}</p>
                  </div>
                ) : (
                  <div className="mb-3 flex items-start gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-xs text-[var(--color-muted-foreground)]" dir={dir}>
                    <span className="shrink-0 text-sm">{heroIcon}</span>
                    <span>{heroText}</span>
                  </div>
                )}

                {/* Map message (plant feedback) */}
                {mapMessage && (
                  <div className={`mb-3 rounded-lg border px-3 py-2 text-sm ${mapMessage.ok ? 'border-[var(--color-border)] bg-[var(--color-secondary-light)] text-[var(--color-primary)]' : 'border-[var(--color-border)] bg-[var(--color-error-bg)] text-[var(--color-error)]'}`}>
                    {mapMessage.text}
                  </div>
                )}

                {/* Map canvas */}
                <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[#FAFBF8] p-3" dir="ltr">
                  <FarmMap
                    plants={plants}
                    sectionColors={sectionColors}
                    renderPopupExtra={renderPopupExtra}
                    showLegend={false}
                  />
                </div>

                {/* Zone entry details — spray mode only, collapsible */}
                {mapMode === 'sprays' && (
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2" dir={dir} data-testid="spray-hero">
                    {legendItems.map((item) => (
                      <div key={item.label} className="flex items-center gap-1.5">
                        <span className="h-3.5 w-3.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color, border: `2px solid ${item.border}` }} />
                        <span className="text-xs text-[var(--color-muted-foreground)]">{item.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {mapMode === 'sprays' && sprayZones.length > 0 && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-[var(--color-border)] bg-white" data-testid="zone-entry-details">
                    <button
                      type="button"
                      onClick={() => setZoneDetailsOpen((o) => !o)}
                      aria-expanded={zoneDetailsOpen}
                      className="flex w-full items-center justify-between border-b border-[var(--color-border)] px-3 py-2 text-left transition hover:bg-[var(--color-muted)]"
                    >
                      <p className="text-xs font-semibold text-[var(--color-foreground)]">{t.spray.zoneEntryDetails}</p>
                      {zoneDetailsOpen
                        ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-[var(--color-muted-foreground)]" />
                        : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--color-muted-foreground)]" />}
                    </button>
                    {zoneDetailsOpen && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                              <th className="px-3 py-2 text-left font-semibold text-[var(--color-muted-foreground)]">{t.spray.zone}</th>
                              <th className="px-3 py-2 text-left font-semibold text-[var(--color-muted-foreground)]">{t.spray.entryPermission}</th>
                              <th className="px-3 py-2 text-left font-semibold text-[var(--color-muted-foreground)] hidden sm:table-cell">{t.spray.safeReentry}</th>
                              <th className="px-3 py-2 text-left font-semibold text-[var(--color-muted-foreground)] hidden sm:table-cell">{t.spray.pesticide}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--color-muted)]">
                            {sprayZones.filter((z) =>
                              z.zoneCode.startsWith('GH-') || z.zoneCode.startsWith('GERM-') || z.zoneCode === 'NURSERY'
                            ).map((z) => (
                              <tr key={z.zoneId} className="hover:bg-[var(--color-muted)] transition-colors">
                                <td className="px-3 py-2">
                                  <span className="font-medium text-[var(--color-foreground)] font-mono">{z.zoneCode}</span>
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold border ${
                                    z.entryPermissionStatus === 'restricted' ? 'bg-red-50 text-red-700 border-red-200' :
                                    z.entryPermissionStatus === 'caution'    ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    'bg-[var(--color-secondary-light)] text-[var(--color-primary)] border-[var(--color-border)]'
                                  }`} data-testid="zone-entry-permission-badge">
                                    {z.entryAllowed ? `✓ ${t.spray.entryPermitted}` : `⚠ ${t.spray.entryRestricted}`}
                                  </span>
                                </td>
                                <td className="px-3 py-2 hidden sm:table-cell text-[var(--color-muted-foreground)]">
                                  {z.safeToReEnterAtUtc
                                    ? new Date(z.safeToReEnterAtUtc).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                    : <span className="text-[var(--color-primary)] font-medium">{t.spray.safeToEnter}</span>}
                                </td>
                                <td className="px-3 py-2 hidden sm:table-cell text-[var(--color-muted-foreground)]">
                                  {z.pesticideName ?? '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Legend */}
                {mapMode !== 'sprays' && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2" data-testid="worker-map-legend">
                  {legendItems.map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <span className="h-3.5 w-3.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color, border: `2px solid ${item.border}` }} />
                      <span className="text-xs text-[var(--color-muted-foreground)]">{item.label}</span>
                    </div>
                  ))}
                </div>
                )}

                {/* Plants Registry — planting mode only, collapsible */}
                {mapMode === 'planting' && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-[var(--color-border)] bg-white" data-testid="plants-registry">
                    {/* Toggle header */}
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
                            {/* Search */}
                            <div className="border-b border-[var(--color-border)] px-3 py-2">
                              <input
                                type="text"
                                placeholder="Search variety or plant code…"
                                value={inventorySearch}
                                onChange={(e) => setInventorySearch(e.target.value)}
                                className="w-full rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                              />
                            </div>

                            {filteredInventoryRows.length === 0 ? (
                              <div className="px-3 py-4 text-center text-xs text-[var(--color-muted-foreground)]">No results.</div>
                            ) : (
                              <div className="overflow-x-auto" dir="ltr">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                                      <th className="w-6 px-2 py-2" />
                                      <th className="px-3 py-2 text-left font-semibold text-[var(--color-muted-foreground)]">{t.inventory.colVariety}</th>
                                      <th className="px-3 py-2 text-left font-semibold text-[var(--color-muted-foreground)]">{t.inventory.colPlantCount}</th>
                                      <th className="hidden px-3 py-2 text-left font-semibold text-[var(--color-muted-foreground)] sm:table-cell">{t.inventory.statusBreakdown}</th>
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
                                                  <span key={s} className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${statusBadgeClass(s)}`}>{c} {s}</span>
                                                ))}
                                              </div>
                                            </td>
                                            <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                              <button
                                                onClick={() => openAddPlantModal(r.PepperId, r.PepperName)}
                                                className="whitespace-nowrap rounded border border-[var(--color-border)] px-2 py-0.5 text-[11px] transition hover:bg-[var(--color-muted)]"
                                              >
                                                + {t.inventory.addPlant}
                                              </button>
                                            </td>
                                          </tr>

                                          {/* Expanded sub-table */}
                                          {rowOpen && (
                                            <tr className="bg-[var(--color-muted)]">
                                              <td />
                                              <td colSpan={4} className="px-3 py-3">
                                                {r.Plants.length === 0 ? (
                                                  <p className="italic text-[var(--color-muted-foreground)]">{t.inventory.noPlantsForVariety}</p>
                                                ) : (
                                                  <table className="w-full text-xs">
                                                    <thead className="text-[var(--color-muted-foreground)]">
                                                      <tr>
                                                        <th className="py-1 pr-3 text-left">{t.inventory.colPlantId}</th>
                                                        <th className="py-1 pr-3 text-left">{t.inventory.colPlantCode}</th>
                                                        <th className="py-1 pr-3 text-left">{t.tasks.status}</th>
                                                        <th className="py-1 pr-3 text-left">{t.inventory.colZone}</th>
                                                        <th className="hidden py-1 pr-3 text-left sm:table-cell">{t.inventory.plantedAt}</th>
                                                        <th className="hidden py-1 pr-3 text-left sm:table-cell">Transfer Date</th>
                                                        <th className="py-1 pr-3 text-left" />
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {r.Plants.map((p) => {
                                                        const nurseryId   = inventoryZones.find((z) => z.ZoneCode === 'NURSERY')?.ZoneId;
                                                        const canTransfer = p.ZoneId === nurseryId && p.Status === 'Healthy';
                                                        return (
                                                          <tr key={p.PlantId} className="border-t border-[var(--color-border)]">
                                                            <td className="py-1 pr-3 text-[var(--color-foreground)]" dir="ltr">#{p.PlantId}</td>
                                                            <td className="py-1 pr-3 font-medium text-[var(--color-foreground)]" dir="ltr">{p.PlantCode}</td>
                                                            <td className="py-1 pr-3">
                                                              <select
                                                                value={p.Status ?? ''}
                                                                onChange={(e) => handleRegistryStatusChange(p.PlantId, e.target.value)}
                                                                className={`cursor-pointer rounded border-0 px-1.5 py-0.5 text-[10px] focus:outline-none ${statusBadgeClass(p.Status)}`}
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
                                                                  onClick={() => {
                                                                    setTransferRegModal({ plant: p, pepperName: r.PepperName });
                                                                    setTransferRegZoneId('');
                                                                    setTransferRegDate(new Date().toISOString().slice(0, 10));
                                                                    setTransferRegError(null);
                                                                  }}
                                                                  className="whitespace-nowrap rounded bg-green-600 px-2 py-0.5 text-[10px] font-medium text-white transition hover:bg-green-700"
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

              {/* ── Right: Notifications (unread only, synced with bell panel via context) ── */}
              <DashboardCard title={wk.notifications} icon={<Bell className="h-4 w-4" />} direction={dir as 'ltr' | 'rtl'}>
                {(() => {
                  const unreadNotifs = appNotifs.filter((n) => !n.isRead);
                  if (unreadNotifs.length === 0) {
                    return <EmptyMessage text={wk.noNewNotifications} />;
                  }
                  return (
                    <>
                      <button
                        type="button"
                        onClick={markAllAppNotifsRead}
                        className="mb-2 w-full rounded-full border border-[var(--color-border)] bg-[var(--color-secondary-light)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)] transition hover:border-[var(--color-primary)]"
                      >
                        {wk.markAllRead}
                      </button>
                      <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
                        {unreadNotifs.slice(0, 30).map((n) => (
                          <div
                            key={n.notificationId}
                            data-testid="notification-item"
                            className="flex items-start gap-2 rounded-lg border border-[var(--color-primary)] bg-[var(--color-secondary-light)] px-3 py-2 text-sm"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-[var(--color-primary)]" dir="auto">
                                <span className="me-1 text-xs font-bold">{t.common.new}</span>
                                {n.title}
                              </p>
                              {n.message && <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]" dir="auto">{n.message}</p>}
                              <p className="mt-1 text-[10px] text-[var(--color-muted-foreground)]" dir="ltr">
                                {new Date(n.createdAtUtc + (n.createdAtUtc.endsWith('Z') ? '' : 'Z')).toLocaleString(locale === 'he' ? 'he-IL' : 'en-US')}
                              </p>
                            </div>
                            <button
                              type="button"
                              data-testid={`dismiss-notification-${n.notificationId}`}
                              onClick={() => dismissAppNotif(n.notificationId)}
                              title={wk.dismissNotification}
                              aria-label={wk.dismissNotification}
                              className="shrink-0 rounded p-0.5 text-[var(--color-muted-foreground)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] transition"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </DashboardCard>
            </section>

          </>
        )}
      </div>

      {/* ── Task detail drawer/modal ── */}
      {activeTask && (
        <TaskDetailModal
          task={activeTask}
          wk={wk}
          t={t}
          locale={locale}
          completing={completing}
          onClose={() => setActiveTask(null)}
          onToggleChecklist={handleToggleChecklist}
          onStatusChange={handleStatusChange}
          onComplete={handleCompleteTask}
        />
      )}

      {/* ── Add Plant modal (registry) ── */}
      {sprayReportZoneCode && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSprayReportZoneCode(null)}
        >
          <div
            data-testid="spray-report-modal"
            className="relative w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSprayReportZoneCode(null)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] text-lg transition"
              aria-label="Close spray report"
            >
              x
            </button>

            <h3 className="mb-4 pe-8 text-base font-semibold text-[var(--color-foreground)]">
              {t.spray.sprayReportTitle}
            </h3>
            <SprayReportForm
              initialZoneCode={sprayReportZoneCode}
              onSubmitted={refreshSprayZones}
            />
          </div>
        </div>
      )}

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

            <h3 className="mb-1 pe-8 text-base font-semibold text-[var(--color-foreground)]">{t.inventory.addPlantTitle}</h3>
            <p className="mb-4 text-sm text-[var(--color-muted-foreground)]">{addPlantModal.pepperName}</p>

            {addPlantError && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border-2 border-red-500 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                <span className="shrink-0">🚫</span><span>{addPlantError}</span>
              </div>
            )}

            <form onSubmit={handleRegistryAddPlant} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-[var(--color-muted-foreground)]">{t.inventory.colPlantCode}</label>
                <input readOnly value={addPlantForm.PlantCode}
                  className="w-full cursor-not-allowed rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-[var(--color-muted-foreground)]">{t.inventory.colZone}</label>
                <input readOnly value={inventoryZones.find((z) => z.ZoneCode === 'NURSERY')?.ZoneName ?? 'Nursery'}
                  className="w-full cursor-not-allowed rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-[var(--color-muted-foreground)]">{t.tasks.status}</label>
                <input readOnly value="Growing"
                  className="w-full cursor-not-allowed rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-[var(--color-muted-foreground)]">{t.inventory.plantedAt}</label>
                <input readOnly value={fmtDate(new Date().toISOString())}
                  className="w-full cursor-not-allowed rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-[var(--color-muted-foreground)]">{t.inventory.notesLabel}</label>
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
                  {t.inventory.cancel}
                </button>
                <button type="submit" disabled={addPlantLoading}
                  className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 hover:opacity-90">
                  {addPlantLoading ? t.inventory.saving : t.inventory.addPlant}
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
            <p className="mb-4 font-mono text-xs text-[var(--color-muted-foreground)]">{transferRegModal.plant.PlantCode}</p>

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
                  {inventoryZones
                    .filter((z) => GREENHOUSE_ZONES.has(z.ZoneCode))
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
                  {t.inventory.cancel}
                </button>
                <button
                  type="submit"
                  disabled={transferRegLoading || !transferRegZoneId || !transferRegDate}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                >
                  {transferRegLoading ? wk.transferring : wk.confirmTransfer}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

// ── WorkerTaskCard ────────────────────────────────────────────────────────────

type UrgencyLevel = 'overdue' | 'due-soon' | 'normal' | 'completed';

const URGENCY_STYLES: Record<UrgencyLevel, string> = {
  overdue:   'border-s-4 border-s-red-400   border border-[var(--color-border)] bg-[var(--color-error-bg)]/60',
  'due-soon':'border-s-4 border-s-amber-400 border border-[var(--color-border)] bg-[var(--color-warning-bg)]/60',
  normal:    'border border-[var(--color-border)] bg-[var(--color-muted)]/70',
  completed: 'border-s-4 border-s-green-400 border border-[var(--color-border)] bg-[var(--color-secondary-light)]/60',
};

const URGENCY_TESTIDS: Record<UrgencyLevel, string> = {
  overdue:   'urgency-overdue',
  'due-soon':'urgency-due-soon',
  normal:    'urgency-normal',
  completed: 'completed-task',
};

function WorkerTaskCard({
  task,
  urgency,
  onClick,
  locale,
  wk,
  t,
}: {
  task: Task;
  urgency: UrgencyLevel;
  onClick: () => void;
  locale: string;
  wk: Dictionary['worker'];
  t: Dictionary;
}) {
  const { total } = checklistProgress(task.checklistItems);
  return (
    <article
      data-testid={URGENCY_TESTIDS[urgency]}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className={`mb-2 cursor-pointer rounded-lg p-3 transition hover:shadow-md ${URGENCY_STYLES[urgency]}`}
    >
      <h3 className="text-sm font-semibold text-[var(--color-foreground)]" dir="auto">{task.title}</h3>
      <dl className="mt-1.5 grid grid-cols-1 gap-1 text-xs text-[var(--color-muted-foreground)]">
        <div className="flex items-center justify-between gap-2">
          <dt>{t.tasks.due}</dt>
          <dd className="font-medium text-[var(--color-foreground)]" dir="ltr">
            {task.dueDate
              ? new Date(task.dueDate + (task.dueDate.endsWith('Z') ? '' : 'Z')).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', { month: 'short', day: 'numeric' })
              : wk.noDueDate}
          </dd>
        </div>
        {task.zoneCode && (
          <div className="flex items-center justify-between gap-2">
            <dt>{t.tasks.zone}</dt>
            <dd className="font-medium text-[var(--color-foreground)]" dir="ltr">{task.zoneCode}</dd>
          </div>
        )}
      </dl>
      {total > 0 && <TaskProgressBar checklistItems={task.checklistItems} />}
    </article>
  );
}

// ── TaskDetailModal ───────────────────────────────────────────────────────────

function TaskDetailModal({
  task,
  wk,
  t,
  locale,
  completing,
  onClose,
  onToggleChecklist,
  onStatusChange,
  onComplete,
}: {
  task: Task;
  wk: Dictionary['worker'];
  t: Dictionary;
  locale: string;
  completing: boolean;
  onClose: () => void;
  onToggleChecklist: (task: Task, item: ChecklistItem, next: boolean) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onComplete: (task: Task) => void;
}) {
  const isOpen = OPEN_STATUSES.has(task.status);
  const { done, total } = checklistProgress(task.checklistItems);
  const allChecklistDone = total === 0 || done === total;

  const PRIORITY_COLORS: Record<string, string> = {
    low:      'bg-green-100 text-green-800',
    medium:   'bg-yellow-100 text-yellow-800',
    high:     'bg-orange-100 text-orange-800',
    critical: 'bg-red-600 text-white',
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        data-testid="task-detail-modal"
        className="relative w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] text-lg transition"
          aria-label="Close"
        >
          ×
        </button>

        <h3 className="mb-1 pe-8 text-lg font-semibold text-[var(--color-foreground)]" dir="auto">{task.title}</h3>

        {/* Badges */}
        <div className="mb-3 flex flex-wrap gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_COLORS[task.priority] ?? 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'}`}>
            {translateEnum(task.priority, t.enums.priority)}
          </span>
          <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-muted-foreground)]">
            {translateEnum(task.status, t.enums.taskStatus)}
          </span>
          {isOverdue(task) && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{wk.overdueAttention}</span>
          )}
          {isDueSoon(task) && !isOverdue(task) && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">{wk.nearDueAttention}</span>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <p className="mb-3 text-sm text-[var(--color-muted-foreground)]" dir="auto">{task.description}</p>
        )}

        {/* Meta */}
        <dl className="mb-4 space-y-1.5 text-xs text-[var(--color-muted-foreground)]">
          <MetaRow label={t.tasks.typeLabel} value={translateEnum(task.taskType, t.enums.taskType)} />
          {task.dueDate && (
            <MetaRow label={t.tasks.due} value={new Date(task.dueDate + (task.dueDate.endsWith('Z') ? '' : 'Z')).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })} />
          )}
          {task.zoneCode && <MetaRow label={t.tasks.zone} value={task.zoneCode} valueDir="ltr" />}
        </dl>

        {/* Checklist */}
        {task.checklistItems.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold text-[var(--color-foreground)]">
              {wk.checklistSection} ({done}/{total})
            </p>
            <div className="space-y-1.5" data-testid="checklist-items">
              {task.checklistItems.map((item) => (
                <label
                  key={item.itemId}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-[var(--color-muted)]"
                >
                  <span
                    onClick={() => onToggleChecklist(task, item, !item.isCompleted)}
                    className="shrink-0 text-[var(--color-primary)]"
                    data-testid={`checklist-item-${item.itemId}`}
                  >
                    {item.isCompleted ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </span>
                  <span className={`text-sm ${item.isCompleted ? 'line-through text-[var(--color-muted-foreground)]' : 'text-[var(--color-foreground)]'}`} dir="auto">
                    {item.title}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Status action buttons */}
        {isOpen && (
          <div className="flex flex-col gap-2">
            {task.status === 'todo' && (
              <button
                onClick={() => onStatusChange(task, 'in_progress')}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-secondary-light)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] transition hover:border-[var(--color-primary)]"
              >
                {t.tasks.startButton}
              </button>
            )}
            <button
              onClick={() => onComplete(task)}
              disabled={completing || !allChecklistDone}
              data-testid="complete-task-button"
              className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
              title={!allChecklistDone ? t.tasks.completeBlockedByChecklist : undefined}
            >
              {completing ? wk.completing : wk.completeTask}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MetaRow({ label, value, valueDir = 'auto' }: { label: string; value: string; valueDir?: 'auto' | 'ltr' }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt>{label}</dt>
      <dd className="font-medium text-[var(--color-foreground)]" dir={valueDir}>{value}</dd>
    </div>
  );
}

