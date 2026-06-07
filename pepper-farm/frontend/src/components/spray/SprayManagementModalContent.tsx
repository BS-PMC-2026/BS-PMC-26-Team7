'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import SprayZoneMap from '@/components/spray/SprayZoneMap';
import TaskForm from '@/components/tasks/TaskForm';
import { assignOverdueSprayTask } from '@/services/spray';
import { createTask } from '@/services/tasks';
import { getAllUsers, UserData } from '@/services/users';
import { OverdueSprayAlert, ZoneSprayStatusData, ZoneSprayStatus, SprayAlert } from '@/types/spray';
import { AlertTriangle, CheckCircle, RefreshCw, ShieldAlert, ShieldCheck, UserCheck } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useAnomalyNotification } from '@/context/AnomalyNotificationContext';
import type { CreateTaskFormData } from '@/types/task';

// ── Status pill helper ────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ZoneSprayStatus, string> = {
  safe:              'Safe',
  unsafe:            'Unsafe',
  requires_approval: 'Needs Review',
  pending:           'Planned',
  never_sprayed:     'Never Sprayed',
};

const STATUS_STYLE: Record<ZoneSprayStatus, string> = {
  safe:              'bg-[var(--color-secondary-light)] text-[var(--color-primary)] border-[var(--color-border)]',
  unsafe:            'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-border)]',
  requires_approval: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-border)]',
  pending:           'bg-indigo-100 text-indigo-700 border-indigo-200',
  never_sprayed:     'bg-[var(--color-muted)] text-[var(--color-muted-foreground)] border-[var(--color-border)]',
};

const SEVERITY_STYLE: Record<SprayAlert['Severity'], string> = {
  high:   'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-border)]',
  medium: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-border)]',
  low:    'bg-[var(--color-info-bg)] text-[var(--color-info)] border-[var(--color-border)]',
};

const SEVERITY_LABEL: Record<SprayAlert['Severity'], string> = {
  high:   'High',
  medium: 'Medium',
  low:    'Low',
};

const OVERDUE_SEVERITY_STYLE: Record<OverdueSprayAlert['Severity'], string> = {
  high:   'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-border)]',
  medium: 'bg-orange-100 text-orange-700 border-orange-200',
  low:    'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-border)]',
};

const OVERDUE_SEVERITY_LABEL: Record<OverdueSprayAlert['Severity'], string> = {
  high:   'Critical',
  medium: 'Overdue',
  low:    'Due Soon',
};

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, count, style }: { label: string; count: number; style: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 flex flex-col gap-0.5 ${style}`}>
      <span className="text-2xl font-bold">{count}</span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Modal content ─────────────────────────────────────────────────────────────

interface SprayManagementModalContentProps {
  zones: ZoneSprayStatusData[];
  zonesLoading: boolean;
  zonesError: string | null;
  onRefreshZones: () => void;
  scrollTarget: 'alerts' | 'overdue' | null;
  onScrollTargetConsumed: () => void;
}

export default function SprayManagementModalContent({
  zones,
  zonesLoading,
  zonesError,
  onRefreshZones,
  scrollTarget,
  onScrollTargetConsumed,
}: SprayManagementModalContentProps) {
  const { t } = useLanguage();
  const sp = t.spray;
  const { sprayAlerts, overdueAlerts } = useAnomalyNotification();

  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  useEffect(() => {
    if (!zonesLoading) setLastFetch(new Date());
  }, [zonesLoading]);

  // US32: assign task modal state
  const [assigningAlert,        setAssigningAlert]        = useState<OverdueSprayAlert | null>(null);
  const [workers,               setWorkers]               = useState<UserData[]>([]);
  const [selectedWorkerId,      setSelectedWorkerId]      = useState<number | ''>('');
  const [assignLoading,         setAssignLoading]         = useState(false);
  const [assignError,           setAssignError]           = useState<string | null>(null);
  const [assignSuccess,         setAssignSuccess]         = useState<string | null>(null);
  const [assignedTaskOverrides, setAssignedTaskOverrides] = useState<Record<number, number>>({});
  const [taskCreateLoading,     setTaskCreateLoading]     = useState(false);
  const [taskCreateError,       setTaskCreateError]       = useState<string | null>(null);
  const [taskCreateSuccess,     setTaskCreateSuccess]     = useState<string | null>(null);

  // Load workers list once for assign modal
  useEffect(() => {
    const token = localStorage.getItem('token') ?? '';
    getAllUsers(token)
      .then((users) => setWorkers(users.filter((u) => u.roleName === 'Worker' && u.isActive)))
      .catch(() => {/* silent — workers will be empty if fails */});
  }, []);

  const displayOverdueAlerts = useMemo(
    () => overdueAlerts.map((a) =>
      assignedTaskOverrides[a.OverdueAlertId] != null
        ? { ...a, AssignedTaskId: assignedTaskOverrides[a.OverdueAlertId] }
        : a,
    ),
    [overdueAlerts, assignedTaskOverrides],
  );

  const openAssignModal = useCallback((alert: OverdueSprayAlert) => {
    setAssigningAlert(alert);
    setSelectedWorkerId('');
    setAssignError(null);
    setAssignSuccess(null);
  }, []);

  const closeAssignModal = useCallback(() => {
    setAssigningAlert(null);
    setAssignError(null);
    setAssignSuccess(null);
  }, []);

  const handleAssignTask = useCallback(async () => {
    if (!assigningAlert || selectedWorkerId === '') return;
    setAssignLoading(true);
    setAssignError(null);
    setAssignSuccess(null);
    try {
      const task = await assignOverdueSprayTask(assigningAlert.OverdueAlertId, {
        assignedToUserId: Number(selectedWorkerId),
      });
      setAssignSuccess(sp.taskAssigned.replace('{id}', String(task.id)));
      setAssignedTaskOverrides((prev) => ({ ...prev, [assigningAlert.OverdueAlertId]: task.id }));
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : sp.failedToAssignTask);
    } finally {
      setAssignLoading(false);
    }
  }, [assigningAlert, selectedWorkerId, sp.failedToAssignTask, sp.taskAssigned]);

  const handleCreateSprayTask = useCallback(async (data: CreateTaskFormData) => {
    setTaskCreateLoading(true);
    setTaskCreateError(null);
    setTaskCreateSuccess(null);
    try {
      const task = await createTask({ ...data, taskType: 'spray' });
      setTaskCreateSuccess(`${sp.sprayTaskCreated} ${sp.taskNumber.replace('{id}', String(task.id))}`);
    } catch (err) {
      setTaskCreateError(err instanceof Error ? err.message : sp.sprayTaskCreateFailed);
    } finally {
      setTaskCreateLoading(false);
    }
  }, [sp.sprayTaskCreateFailed, sp.sprayTaskCreated, sp.taskNumber]);

  // Summary counts
  const countByStatus = (status: ZoneSprayStatus) =>
    zones.filter((z) => z.sprayStatus === status).length;

  // Zones needing attention (unsafe + requires_approval)
  const attentionZones = zones.filter(
    (z) => z.sprayStatus === 'unsafe' || z.sprayStatus === 'requires_approval',
  );
  const taskZones = zones.map((zone) => ({
    ZoneId: zone.zoneId,
    ZoneCode: zone.zoneCode,
    ZoneName: zone.zoneName,
  }));
  const sprayTaskInitial: Partial<CreateTaskFormData> = {
    title: sp.createSprayTask,
    taskType: 'spray',
    priority: 'medium',
    assignedToUserId: '',
    dueDate: '',
    zoneCode: '',
    description: '',
    checklistItems: [],
  };

  const [searchTerm, setSearchTerm] = useState('');
  const filteredSprayAlerts = sprayAlerts.filter((alert) => {
    const search = searchTerm.toLowerCase();
    return (
      alert.ZoneName?.toLowerCase().includes(search) ||
      alert.ZoneCode?.toLowerCase().includes(search) ||
      alert.PesticideName?.toLowerCase().includes(search) ||
      alert.ReportStatus?.toLowerCase().includes(search)
    );
  });

  // Deep-link scroll-to-section (modal content scrolls independently of the page,
  // so the original id="..."/scroll-mt anchors don't apply — use refs instead).
  const alertsRef  = useRef<HTMLElement | null>(null);
  const overdueRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!scrollTarget) return;
    const target = scrollTarget === 'alerts' ? alertsRef.current : overdueRef.current;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      onScrollTargetConsumed();
    }
  }, [scrollTarget, sprayAlerts.length, overdueAlerts.length, onScrollTargetConsumed]);

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-3">
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">{sp.safetyLabel}</span>
          <p className="text-sm text-[var(--color-muted-foreground)] mt-1">{sp.managerSubtitle}</p>
        </div>
        <button
          onClick={onRefreshZones}
          disabled={zonesLoading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] disabled:opacity-50 transition shrink-0"
        >
          <RefreshCw size={13} className={zonesLoading ? 'animate-spin' : ''} />
          {sp.refresh}
        </button>
      </div>

      <div className="space-y-6">

        {/* Error */}
        {zonesError && (
          <div className="rounded-lg bg-[var(--color-error-bg)] border border-[var(--color-border)] text-[var(--color-error)] px-4 py-3 text-sm">
            {zonesError}
          </div>
        )}

        {/* Summary cards */}
        {!zonesLoading && zones.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <SummaryCard label="Safe"          count={countByStatus('safe')}              style={STATUS_STYLE.safe} />
            <SummaryCard label="Unsafe (REI)"  count={countByStatus('unsafe')}            style={STATUS_STYLE.unsafe} />
            <SummaryCard label="Needs Review"  count={countByStatus('requires_approval')} style={STATUS_STYLE.requires_approval} />
            <SummaryCard label="Planned"       count={countByStatus('pending')}           style={STATUS_STYLE.pending} />
            <SummaryCard label="Never Sprayed" count={countByStatus('never_sprayed')}     style={STATUS_STYLE.never_sprayed} />
          </div>
        )}

        {/* Attention-needed list */}
        {!zonesLoading && attentionZones.length > 0 && (
          <div className="bg-[var(--color-error-bg)] border border-[var(--color-border)] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[var(--color-error)] mb-3">
              ⚠️ Zones requiring attention ({attentionZones.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {attentionZones.map((z) => (
                <span
                  key={z.zoneId}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${STATUS_STYLE[z.sprayStatus]}`}
                >
                  {z.zoneCode}
                  <span className="opacity-70">— {STATUS_LABEL[z.sprayStatus]}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {zonesLoading && (
          <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-sm p-6 animate-pulse">
            <div className="h-64 bg-[var(--color-muted)] rounded-lg" />
          </div>
        )}

        {/* Map */}
        {!zonesLoading && (
          <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[var(--color-foreground)]">
                Farm Zone Overview
                <span className="ml-2 text-xs font-normal text-[var(--color-muted-foreground)]">
                  — click any zone for details
                </span>
              </h2>
              {lastFetch && (
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  Updated {lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <SprayZoneMap zones={zones} />
          </div>
        )}

        <section className="bg-white rounded-2xl border border-[var(--color-border)] shadow-sm p-6" data-testid="create-spray-task-section">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-[var(--color-foreground)]">{sp.createSprayTask}</h2>
            <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">{sp.createSprayTaskDesc}</p>
          </div>
          {taskCreateError && (
            <div className="mb-4 rounded-lg bg-[var(--color-error-bg)] border border-[var(--color-border)] text-[var(--color-error)] px-4 py-3 text-sm">
              {taskCreateError}
            </div>
          )}
          {taskCreateSuccess && (
            <div className="mb-4 rounded-lg bg-[var(--color-secondary-light)] border border-[var(--color-border)] text-[var(--color-primary)] px-4 py-3 text-sm" data-testid="spray-task-success">
              {taskCreateSuccess}
            </div>
          )}
          {zonesLoading ? (
            <div className="space-y-3 animate-pulse" data-testid="spray-task-form-loading">
              <div className="h-9 bg-[var(--color-muted)] rounded-lg" />
              <div className="h-20 bg-[var(--color-muted)] rounded-lg" />
              <div className="h-9 bg-[var(--color-muted)] rounded-lg" />
            </div>
          ) : (
            <TaskForm
              onSubmit={handleCreateSprayTask}
              isLoading={taskCreateLoading}
              workers={workers}
              zones={taskZones}
              initialData={sprayTaskInitial}
              submitLabel={sp.createSprayTask}
            />
          )}
        </section>

        {/* Zone status table */}
        {!zonesLoading && zones.length > 0 && (
          <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-border)]">
              <h2 className="text-sm font-semibold text-[var(--color-foreground)]">Zone Status Table</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">Zone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">Last Sprayed</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">Pesticide</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">Safe Re-entry</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">Next Planned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {zones.map((z) => (
                    <tr key={z.zoneId} className="hover:bg-[var(--color-muted)] transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-[var(--color-foreground)]">{z.zoneName}</span>
                        <span className="block text-xs text-[var(--color-muted-foreground)]">{z.zoneCode}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLE[z.sprayStatus]}`}>
                          {STATUS_LABEL[z.sprayStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                        {z.lastCompletedAtUtc
                          ? new Date(z.lastCompletedAtUtc).toLocaleDateString()
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                        {z.pesticideName ?? <span className="text-gray-300">—</span>}
                        {z.requiresApproval && (
                          <span className="ml-1 text-[10px] text-yellow-600 font-medium">⚠ unverified</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {z.safeToReEnterAtUtc ? (
                          <span className={new Date(z.safeToReEnterAtUtc) > new Date() ? 'text-[var(--color-error)] font-medium' : 'text-[var(--color-primary)]'}>
                            {new Date(z.safeToReEnterAtUtc).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-[var(--color-muted-foreground)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-indigo-600">
                        {z.nextPlannedAtUtc
                          ? new Date(z.nextPlannedAtUtc).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!zonesLoading && zones.length === 0 && !zonesError && (
          <div className="text-center py-16 text-[var(--color-muted-foreground)]">
            <p className="text-4xl mb-3">🗺️</p>
            <p className="font-medium">No zones found.</p>
            <p className="text-sm mt-1">Make sure farm zones are configured in the database.</p>
          </div>
        )}

        {/* ── US30: Spray Alert History ───────────────────────────────────────── */}
        <section ref={alertsRef} data-testid="spray-alerts-section">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-foreground)]">Spray Alert History</h2>
              <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                Alerts generated automatically when workers submit spray reports
              </p>
            </div>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search spray alerts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] px-4 py-3 bg-white"
              />
            </div>
            {sprayAlerts.length > 0 && (
              <span className="text-xs text-[var(--color-muted-foreground)]">
                {filteredSprayAlerts.filter((a) => !a.IsRead).length} unread of {filteredSprayAlerts.length}
              </span>
            )}
          </div>

          {/* Alerts table */}
          {sprayAlerts.length > 0 && (
            <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden" data-testid="spray-alerts-list">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">Zone</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">Severity</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">Pesticide</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">Sprayed</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredSprayAlerts.map((alert) => (
                      <tr
                        key={alert.SprayAlertId}
                        className={`hover:bg-[var(--color-muted)] transition-colors ${!alert.IsRead ? 'bg-[var(--color-warning-bg)]/40' : ''}`}
                        data-testid="spray-alert-row"
                      >
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5">
                            <span className={`shrink-0 ${alert.Severity === 'high' ? 'text-[var(--color-error)]' : alert.Severity === 'medium' ? 'text-[var(--color-warning)]' : 'text-[var(--color-info)]'}`}>
                              {alert.IsRead ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                            </span>
                            <span>
                              <span className="font-medium text-[var(--color-foreground)]">{alert.ZoneName}</span>
                              <span className="block text-xs text-[var(--color-muted-foreground)]">{alert.ZoneCode}</span>
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${SEVERITY_STYLE[alert.Severity]}`}>
                            {SEVERITY_LABEL[alert.Severity]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                          {alert.PesticideName ?? <span className="text-gray-300">—</span>}
                          {alert.RequiresApproval && (
                            <span className="ml-1 text-[10px] text-yellow-600 font-medium">{sp.unverified}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-muted-foreground)] capitalize">
                          {alert.ReportStatus}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                          {fmtDate(alert.SprayedAtUtc)}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-muted-foreground)] text-xs">
                          {timeAgo(alert.CreatedAt)}
                        </td>
                        <td className="px-4 py-3">
                          {alert.IsRead ? (
                            <span className="text-xs text-[var(--color-primary)] font-medium">{t.common.read}</span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-[var(--color-warning)] text-white text-[10px] font-bold">
                              {t.common.new}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Alerts empty state */}
          {filteredSprayAlerts.length === 0 && (
            <div className="text-center py-12 text-[var(--color-muted-foreground)] bg-white rounded-2xl border border-[var(--color-border)]" data-testid="spray-alerts-empty">
              <p className="text-3xl mb-2">🛡️</p>
              <p className="font-medium text-sm">{sp.noSprayAlertsYet}</p>
              <p className="text-xs mt-1">{sp.sprayAlertsEmptyDesc}</p>
            </div>
          )}
        </section>

        {/* ── US32: Overdue Spray Alerts ────────────────────────────────────── */}
        <section ref={overdueRef} data-testid="overdue-spray-alerts-section">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-foreground)] flex items-center gap-2">
                <AlertTriangle size={16} className="text-orange-500" />
                {sp.overdueSprayAlerts}
              </h2>
              <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                {sp.overdueSprayAlertsDesc}
              </p>
            </div>
            {displayOverdueAlerts.length > 0 && (
              <span className="text-xs text-[var(--color-muted-foreground)]">
                {sp.activeCount.replace('{count}', String(displayOverdueAlerts.filter((a) => !a.IsResolved).length))}
              </span>
            )}
          </div>

          {/* Overdue alerts table */}
          {displayOverdueAlerts.length > 0 && (
            <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden" data-testid="overdue-alerts-list">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--color-warning-bg)] border-b border-[var(--color-border)]">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">{sp.zone}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">{sp.severity}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">{sp.lastSprayed}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">{sp.overdueSince}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">{sp.status}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">{sp.task}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {displayOverdueAlerts.map((alert) => (
                      <tr
                        key={alert.OverdueAlertId}
                        className={`hover:bg-[var(--color-muted)] transition-colors ${!alert.IsResolved && !alert.IsRead ? 'bg-[var(--color-warning-bg)]/40' : ''}`}
                        data-testid="overdue-alert-row"
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium text-[var(--color-foreground)]">{alert.ZoneName}</span>
                          <span className="block text-xs text-[var(--color-muted-foreground)]">{alert.ZoneCode}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${OVERDUE_SEVERITY_STYLE[alert.Severity]}`}>
                            {OVERDUE_SEVERITY_LABEL[alert.Severity]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                          {alert.LastSprayedAtUtc ? fmtDate(alert.LastSprayedAtUtc) : <span className="text-[var(--color-muted-foreground)] italic">{t.common.never}</span>}
                        </td>
                        <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                          {fmtDate(alert.OverdueSinceUtc)}
                          <span className="block text-xs text-[var(--color-muted-foreground)]">{timeAgo(alert.OverdueSinceUtc)}</span>
                        </td>
                        <td className="px-4 py-3">
                          {alert.IsResolved ? (
                            <span className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] font-medium">
                              <CheckCircle size={12} /> {sp.resolved}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                              {t.common.active.toUpperCase()}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {alert.AssignedTaskId ? (
                            <span className="text-xs text-indigo-600 font-medium">
                              {sp.taskNumber.replace('{id}', String(alert.AssignedTaskId))}
                            </span>
                          ) : alert.IsResolved ? (
                            <span className="text-xs text-[var(--color-muted-foreground)]">—</span>
                          ) : (
                            <button
                              onClick={() => openAssignModal(alert)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 transition"
                              data-testid="assign-task-button"
                            >
                              <UserCheck size={12} />
                              {sp.assignTask}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty state */}
          {displayOverdueAlerts.length === 0 && (
            <div className="text-center py-12 text-[var(--color-muted-foreground)] bg-white rounded-2xl border border-[var(--color-border)]" data-testid="overdue-alerts-empty">
              <p className="text-3xl mb-2">✅</p>
              <p className="font-medium text-sm">{sp.allZonesUpToDate}</p>
              <p className="text-xs mt-1">{sp.overdueAlertsEmptyDesc}</p>
            </div>
          )}
        </section>

        {/* ── US32: Assign Task Modal (z-[80]: stacks above the DashboardModal at z-[70]) ── */}
        {assigningAlert && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40" data-testid="assign-modal">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
              <h3 className="text-base font-semibold text-[var(--color-foreground)] mb-1">
                {sp.assignSprayTask}
              </h3>
              <p className="text-sm text-[var(--color-muted-foreground)] mb-4">
                {sp.zone}: <span className="font-medium text-[var(--color-foreground)]">{assigningAlert.ZoneName}</span>{' '}
                <span className=" text-xs text-[var(--color-muted-foreground)]">({assigningAlert.ZoneCode})</span>
              </p>

              {assignSuccess ? (
                <div className="rounded-lg bg-[var(--color-secondary-light)] border border-[var(--color-border)] text-[var(--color-primary)] px-4 py-3 text-sm mb-4" data-testid="assign-success">
                  {assignSuccess}
                </div>
              ) : (
                <>
                  <label className="block text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">
                    {sp.selectWorker}
                  </label>
                  <select
                    className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] mb-4"
                    value={selectedWorkerId}
                    onChange={(e) => setSelectedWorkerId(e.target.value === '' ? '' : Number(e.target.value))}
                    data-testid="worker-select"
                  >
                    <option value="">{sp.selectWorkerPlaceholder}</option>
                    {workers.map((w) => (
                      <option key={w.userId} value={w.userId}>{w.fullName}</option>
                    ))}
                  </select>

                  {assignError && (
                    <div className="rounded-lg bg-[var(--color-error-bg)] border border-[var(--color-border)] text-[var(--color-error)] px-3 py-2 text-xs mb-3" data-testid="assign-error">
                      {assignError}
                    </div>
                  )}

                  <button
                    onClick={handleAssignTask}
                    disabled={selectedWorkerId === '' || assignLoading}
                    className="w-full py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
                    data-testid="confirm-assign-button"
                  >
                    {assignLoading ? sp.assigning : sp.assignTask}
                  </button>
                </>
              )}

              <button
                onClick={closeAssignModal}
                className="mt-3 w-full py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] transition"
              >
                {assignSuccess ? t.common.close : t.common.cancel}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
