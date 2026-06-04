'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import { getCompletedTasks } from '@/services/tasks';
import { ClipboardCheck, ClipboardList } from 'lucide-react';
import TaskForm from '@/components/tasks/TaskForm';
import TaskFilters from '@/components/tasks/TaskFilters';
import TaskList from '@/components/tasks/TaskList';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/ui/PageHeader';
import { CreateTaskFormData, Task, TaskPriority } from '@/types/task';
import { createTask, getTasks, syncChecklistItems, updateTask } from '@/services/tasks';
import { getAllUsers, UserData } from '@/services/users';
import { getZones, type ZoneSummary } from '@/services/zones';
import { EMPTY_TASK_FILTERS, filterTasks, type TaskFilters as TaskFilterState } from '@/components/tasks/filterTasks';
import { useLanguage } from '@/context/LanguageContext';

/* -------------------------------------------------------------------------- */
/* History tab content                                                          */
/* -------------------------------------------------------------------------- */

function TaskHistoryContent() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCompletedTasks()
      .then(setTasks)
      .catch(() => setError('Failed to load completed tasks.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {error && <Alert className="mb-4">{error}</Alert>}
      {loading ? (
        <p className="text-center text-[var(--color-muted-foreground)] py-10">Loading completed tasks...</p>
      ) : tasks.length === 0 ? (
        <EmptyState title="No completed tasks found" description="Completed tasks will appear here." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mt-2">
          {tasks.map((task) => (
            <div key={task.id} className="rounded-2xl border border-[var(--color-border)] bg-white shadow-sm p-5 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="px-3 py-1 rounded-full bg-[var(--color-secondary-light)] text-[var(--color-primary)] text-xs font-semibold">COMPLETED</span>
                <span className="text-xs text-[var(--color-muted-foreground)] uppercase">{task.priority}</span>
              </div>
              <h2 className="text-lg font-bold text-[var(--color-foreground)] mb-2">{task.title}</h2>
              <p className="text-sm text-[var(--color-muted-foreground)] mb-4">{task.description || 'No description provided.'}</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted-foreground)]">Task Type</span>
                  <span className="font-medium text-[var(--color-foreground)]">{task.taskType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted-foreground)]">Completed At</span>
                  <span className="font-medium text-[var(--color-foreground)]">{task.completedAt ? new Date(task.completedAt).toLocaleDateString() : 'N/A'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page tab bar                                                                 */
/* -------------------------------------------------------------------------- */

function TasksTabBar({ activeTab, onTabChange }: { activeTab: string; onTabChange: (t: string) => void }) {
  const tabs = [
    { id: 'active', label: 'Active Tasks', icon: <ClipboardList size={14} /> },
    { id: 'history', label: 'History', icon: <ClipboardCheck size={14} /> },
  ];
  return (
    <div className="border-b border-[var(--color-border)]/60">
      <div className="max-w-7xl mx-auto px-6 flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-1.5 px-5 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:border-[var(--color-border)]'
            }`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Active tasks content                                                         */
/* -------------------------------------------------------------------------- */

function ManagerTasksPageContent() {
  const { t } = useLanguage();
  const tk = t.tasks;
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') === 'history' ? 'history' : 'active';

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`/manager/tasks?${params.toString()}`);
  };

  const sourceAlertId = useMemo(() => {
    const raw = searchParams.get('alertId');
    return raw ? Number(raw) : null;
  }, [searchParams]);

  const alertPrefill = useMemo((): Partial<CreateTaskFormData> | undefined => {
    if (!sourceAlertId) return undefined;
    return {
      title: searchParams.get('title') ?? '',
      description: searchParams.get('description') ?? '',
      taskType: searchParams.get('taskType') ?? '',
      priority: (searchParams.get('priority') as TaskPriority) ?? 'medium',
      zoneCode: searchParams.get('zoneCode') ?? '',
      assignedToUserId: '',
      dueDate: '',
    };
  }, [sourceAlertId, searchParams]);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTask,    setEditingTask]    = useState<Task | null>(null);
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [submitError,    setSubmitError]    = useState<string | null>(null);
  const [loadError,      setLoadError]      = useState<string | null>(null);
  const [workers,        setWorkers]        = useState<UserData[]>([]);
  const [tasks,          setTasks]          = useState<Task[]>([]);
  const [zones,          setZones]          = useState<ZoneSummary[]>([]);
  const [taskFilters,    setTaskFilters]    = useState<TaskFilterState>(EMPTY_TASK_FILTERS);
  const [alertSuccessId, setAlertSuccessId] = useState<number | null>(null);

  // Auto-open form when navigating from an alert
  useEffect(() => {
    if (sourceAlertId) {
      setShowCreateForm(true);
    }
  }, [sourceAlertId]);

  const loadData = useCallback(async () => {
    setIsLoadingTasks(true);
    setLoadError(null);
    try {
      const token = localStorage.getItem('token') ?? '';
      const [fetchedTasks, fetchedWorkers, fetchedZones] = await Promise.all([
        getTasks(),
        getAllUsers(token),
        getZones(),
      ]);
      setTasks(fetchedTasks);
      setWorkers(fetchedWorkers.filter((u) => u.roleName === 'Worker'));
      setZones(fetchedZones);
    } catch {
      setLoadError(tk.failedToLoad);
    } finally {
      setIsLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (data: CreateTaskFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const newTask = await createTask(data, sourceAlertId ?? undefined);
      setTasks((prev) => [newTask, ...prev]);
      setShowCreateForm(false);
      if (sourceAlertId) {
        setAlertSuccessId(sourceAlertId);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : tk.failedToCreate);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (data: CreateTaskFormData) => {
    if (!editingTask) return;
    const token = localStorage.getItem('token') ?? '';
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const updatedTask = await updateTask(editingTask.id, data, token);
      const updatedChecklist = await syncChecklistItems(
        editingTask.id,
        editingTask.checklistItems ?? [],
        data.checklistItems ?? [],
        token,
      );
      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingTask.id
            ? { ...updatedTask, checklistItems: updatedChecklist }
            : t,
        ),
      );
      setEditingTask(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : tk.failedToUpdate);
    } finally {
      setIsSubmitting(false);
    }
  };

  const editInitialData = editingTask
    ? {
        title: editingTask.title,
        description: editingTask.description ?? '',
        taskType: editingTask.taskType,
        priority: editingTask.priority,
        assignedToUserId: editingTask.assignedToUserId ? String(editingTask.assignedToUserId) : '',
        dueDate: editingTask.dueDate ? editingTask.dueDate.slice(0, 10) : '',
        zoneCode: editingTask.zoneCode ?? '',
        checklistItems: (editingTask.checklistItems ?? []).map((item) => ({
          itemId: item.itemId,
          title: item.title,
          isCompleted: item.isCompleted,
        })),
      }
    : undefined;

  const filteredTasks = useMemo(() => filterTasks(tasks, taskFilters), [tasks, taskFilters]);

  if (activeTab === 'history') {
    return (
      <>
        <TasksTabBar activeTab={activeTab} onTabChange={handleTabChange} />
        <TaskHistoryContent />
      </>
    );
  }

  return (
  <>
    <TasksTabBar activeTab={activeTab} onTabChange={handleTabChange} />

    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <PageHeader
          title={tk.title}
          subtitle={tk.subtitle}
          action={
            !showCreateForm ? (
              <div className="flex gap-2">
                <Link href="/manager/reports/open-tasks">
                  <Button variant="secondary">{tk.report}</Button>
                </Link>

                <Button onClick={() => handleTabChange("history")} variant="secondary">
                  {tk.history}
                </Button>

                <Button onClick={() => setShowCreateForm(true)}>
                  {tk.addTask}
                </Button>
              </div>
            ) : undefined
          }
        />
      </div>

      {alertSuccessId && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-secondary-light)] px-4 py-3 text-sm text-[var(--color-primary)]">
          <span>
            {tk.createdFromAlert}
            <Link href="/manager/anomalies" className="underline font-medium" dir="ltr">
              #{alertSuccessId}
            </Link>
            .
          </span>
          <button
            onClick={() => setAlertSuccessId(null)}
            className="text-[var(--color-primary)] hover:text-[var(--color-primary)] font-medium leading-none cursor-pointer"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {showCreateForm && (
        <Card className="p-6 mb-6">
          {sourceAlertId && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
              <span>
                {tk.preFilledFromAlert}
                <span dir="ltr">#{sourceAlertId}</span>.
              </span>
              <Link href="/manager/anomalies" className="underline ml-auto">
                {tk.backToAnomalies}
              </Link>
            </div>
          )}

          <h2 className="text-lg font-medium text-[var(--color-foreground)] mb-4">{tk.newTask}</h2>

          {submitError && <Alert className="mb-4">{submitError}</Alert>}

          <TaskForm
            onSubmit={handleCreate}
            onCancel={() => {
              setShowCreateForm(false);
              setSubmitError(null);
            }}
            isLoading={isSubmitting}
            workers={workers}
            zones={zones}
            initialData={alertPrefill}
          />
        </Card>
      )}

      {loadError && <Alert className="mb-4">{loadError}</Alert>}

      {!isLoadingTasks && tasks.length > 0 && (
        <TaskFilters
          className="mb-4"
          priority={taskFilters.priority}
          taskType={taskFilters.taskType}
          totalCount={tasks.length}
          resultCount={filteredTasks.length}
          onPriorityChange={(priority) =>
            setTaskFilters((prev) => ({ ...prev, priority }))
          }
          onTaskTypeChange={(taskType) =>
            setTaskFilters((prev) => ({ ...prev, taskType }))
          }
          onClear={() => setTaskFilters(EMPTY_TASK_FILTERS)}
        />
      )}

      {isLoadingTasks ? (
        <p className="text-sm text-[var(--color-muted-foreground)] text-center py-12">{tk.loading}</p>
      ) : tasks.length === 0 ? (
        <EmptyState title={tk.noTasksYet} description={tk.clickToCreate} />
      ) : filteredTasks.length === 0 ? (
        <EmptyState title={tk.noTasksMatchFilter} description={tk.clearFilters} />
      ) : (
        <TaskList tasks={filteredTasks} workers={workers} onEdit={setEditingTask} />
      )}

      {editingTask && (
        <Modal
          onClose={() => {
            setEditingTask(null);
            setSubmitError(null);
          }}
        >
          <h2 className="text-lg font-medium text-[var(--color-foreground)] mb-4">
            {tk.editTask}
          </h2>

          {submitError && <Alert className="mb-4">{submitError}</Alert>}

          <TaskForm
            onSubmit={handleEdit}
            onCancel={() => {
              setEditingTask(null);
              setSubmitError(null);
            }}
            isLoading={isSubmitting}
            workers={workers}
            zones={zones}
            initialData={editInitialData}
          />
        </Modal>
      )}
    </div>
  </>
);
}

export default function ManagerTasksPage() {
  return (
    <Suspense>
      <ManagerTasksPageContent />
    </Suspense>
  );
}
