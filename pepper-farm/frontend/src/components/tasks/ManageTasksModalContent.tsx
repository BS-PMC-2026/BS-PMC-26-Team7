'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import TaskForm from '@/components/tasks/TaskForm';
import TaskFilters from '@/components/tasks/TaskFilters';
import TaskList from '@/components/tasks/TaskList';
import TasksTabBar from '@/components/tasks/TasksTabBar';
import TaskHistoryContent from '@/components/tasks/TaskHistoryContent';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/ui/PageHeader';
import { CreateTaskFormData, Task, TaskPriority } from '@/types/task';
import { createTask, getTasks, syncChecklistItems, updateTask } from '@/services/tasks';
import { getAllUsers, UserData } from '@/services/users';
import { getZones, type ZoneSummary } from '@/services/zones';
import { EMPTY_TASK_FILTERS, filterTasks, type TaskFilters as TaskFilterState } from '@/components/tasks/filterTasks';
import { useTaskDelete } from '@/components/tasks/useTaskDelete';
import { useLanguage } from '@/context/LanguageContext';
import { getCurrentUserId } from '@/lib/auth';

export interface TaskAlertPrefill {
  alertId: number;
  title: string;
  description: string;
  priority: TaskPriority;
  taskType: string;
  zoneCode: string;
}

interface ManageTasksModalContentProps {
  activeTab: 'active' | 'history';
  onTabChange: (tab: 'active' | 'history') => void;
  alertPrefill?: TaskAlertPrefill | null;
  onAlertPrefillConsumed: () => void;
}

export default function ManageTasksModalContent({
  activeTab,
  onTabChange,
  alertPrefill,
  onAlertPrefillConsumed,
}: ManageTasksModalContentProps) {
  const { t } = useLanguage();
  const tk = t.tasks;

  const handleTabChange = (tab: string) => {
    onTabChange(tab === 'history' ? 'history' : 'active');
  };

  const currentUserId = useMemo(() => getCurrentUserId(), []);

  const sourceAlertId = alertPrefill?.alertId ?? null;

  const formAlertPrefill = useMemo((): Partial<CreateTaskFormData> | undefined => {
    if (!alertPrefill) return undefined;
    return {
      title: alertPrefill.title,
      description: alertPrefill.description,
      taskType: alertPrefill.taskType,
      priority: alertPrefill.priority,
      zoneCode: alertPrefill.zoneCode,
      assignedToUserId: '',
      dueDate: '',
    };
  }, [alertPrefill]);

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

  const del = useTaskDelete((id) => setTasks((prev) => prev.filter((tt) => tt.id !== id)), 'z-[80]');

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
      // Active tab shows only open work; completed tasks live in the History tab,
      // cancelled tasks are excluded everywhere.
      setTasks(fetchedTasks.filter((t) => t.status === 'todo' || t.status === 'in_progress'));
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
        onAlertPrefillConsumed();
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
        dueDate: editingTask.dueDate ? editingTask.dueDate.slice(0, 16) : '',
        zoneCode: editingTask.zoneCode ?? '',
        checklistItems: (editingTask.checklistItems ?? []).map((item) => ({
          itemId: item.itemId,
          title: item.title,
          isCompleted: item.isCompleted,
        })),
      }
    : undefined;

  const [searchTerm, setSearchTerm] = useState('');
  const filteredTasks = useMemo(() => {
    const filtered = filterTasks(tasks, taskFilters);

    return filtered.filter((task) => {
      const title = task.title?.toLowerCase() || '';
      const description = task.description?.toLowerCase() || '';
      const search = searchTerm.toLowerCase();

      return (
        title.includes(search) ||
        description.includes(search)
      );
    });
  }, [tasks, taskFilters, searchTerm]);

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
              initialData={formAlertPrefill}
            />
          </Card>
        )}

        {loadError && <Alert className="mb-4">{loadError}</Alert>}
        {!isLoadingTasks && tasks.length > 0 && (
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] px-4 py-3 bg-white"
            />
          </div>
        )}
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
          <TaskList
            tasks={filteredTasks}
            workers={workers}
            onEdit={setEditingTask}
            onDelete={del.requestDelete}
            currentUserId={currentUserId}
          />
        )}

        {editingTask && (
          <Modal
            overlayClassName="z-[80]"
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

        {del.dialog}
      </div>
    </>
  );
}
