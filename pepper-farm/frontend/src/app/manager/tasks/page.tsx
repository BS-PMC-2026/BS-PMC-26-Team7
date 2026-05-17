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
import { createTask, getTasks, updateTask } from '@/services/tasks';
import { getAllUsers, UserData } from '@/services/users';
import { getZones, type ZoneSummary } from '@/services/zones';
import { EMPTY_TASK_FILTERS, filterTasks, type TaskFilters as TaskFilterState } from '@/components/tasks/filterTasks';

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
        <p className="text-center text-gray-400 py-10">Loading completed tasks...</p>
      ) : tasks.length === 0 ? (
        <EmptyState title="No completed tasks found" description="Completed tasks will appear here." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mt-2">
          {tasks.map((task) => (
            <div key={task.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">COMPLETED</span>
                <span className="text-xs text-gray-400 uppercase">{task.priority}</span>
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">{task.title}</h2>
              <p className="text-sm text-gray-500 mb-4">{task.description || 'No description provided.'}</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Task Type</span>
                  <span className="font-medium text-gray-700">{task.taskType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Completed At</span>
                  <span className="font-medium text-gray-700">{task.completedAt ? new Date(task.completedAt).toLocaleDateString() : 'N/A'}</span>
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
    <div className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-6 flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-1.5 px-5 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-[#2F6F4E] text-[#2F6F4E]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
      setLoadError('Failed to load tasks. Is the backend running?');
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
      setSubmitError(err instanceof Error ? err.message : 'Failed to create task.');
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
      const updated = await updateTask(editingTask.id, data, token);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditingTask(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update task.');
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
            title="Tasks"
            subtitle="Manage and assign farm tasks"
            action={
              !showCreateForm ? (
                <div className="flex gap-2">
                  <Link href="/manager/reports">
                    <Button variant="secondary">Report</Button>
                  </Link>
                  <Button onClick={() => setShowCreateForm(true)}>+ Add Task</Button>
                </div>
              ) : undefined
            }
          />
      </div>

      {alertSuccessId && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <span>
            Task created from{' '}
            <Link href="/manager/anomalies" className="underline font-medium">
              alert #{alertSuccessId}
            </Link>
            .
          </span>
          <button
            onClick={() => setAlertSuccessId(null)}
            className="text-green-500 hover:text-green-700 font-medium leading-none cursor-pointer"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {showCreateForm && (
        <Card className="p-6 mb-6">
          {sourceAlertId && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <span>Pre-filled from alert #{sourceAlertId}.</span>
              <Link href="/manager/anomalies" className="underline ml-auto">
                Back to anomalies
              </Link>
            </div>
          )}
          <h2 className="text-lg font-medium text-gray-700 mb-4">New Task</h2>
          {submitError && <Alert className="mb-4">{submitError}</Alert>}
          <TaskForm
            onSubmit={handleCreate}
            onCancel={() => { setShowCreateForm(false); setSubmitError(null); }}
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
          onPriorityChange={(priority) => setTaskFilters((prev) => ({ ...prev, priority }))}
          onTaskTypeChange={(taskType) => setTaskFilters((prev) => ({ ...prev, taskType }))}
          onClear={() => setTaskFilters(EMPTY_TASK_FILTERS)}
        />
      )}

      {isLoadingTasks ? (
        <p className="text-sm text-gray-400 text-center py-12">Loading tasks...</p>
      ) : tasks.length === 0 ? (
        <EmptyState title="No tasks yet." description="Click + Add Task to create the first one." />
      ) : filteredTasks.length === 0 ? (
        <EmptyState title="No tasks match these filters." description="Clear filters to see all tasks." />
      ) : (
        <TaskList tasks={filteredTasks} workers={workers} onEdit={setEditingTask} />
      )}

      {editingTask && (
        <Modal onClose={() => { setEditingTask(null); setSubmitError(null); }}>
          <h2 className="text-lg font-medium text-gray-700 mb-4">Edit Task</h2>
          {submitError && <Alert className="mb-4">{submitError}</Alert>}
          <TaskForm
            onSubmit={handleEdit}
            onCancel={() => { setEditingTask(null); setSubmitError(null); }}
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
