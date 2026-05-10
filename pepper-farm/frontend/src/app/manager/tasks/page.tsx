'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import TaskForm from '@/components/tasks/TaskForm';
import TaskFilters from '@/components/tasks/TaskFilters';
import TaskList from '@/components/tasks/TaskList';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { CreateTaskFormData, Task } from '@/types/task';
import { createTask, getTasks, updateTask } from '@/services/tasks';
import { getAllUsers, UserData } from '@/services/users';
import { getZones, type ZoneSummary } from '@/services/zones';
import { EMPTY_TASK_FILTERS, filterTasks, type TaskFilters as TaskFilterState } from '@/components/tasks/filterTasks';

export default function ManagerTasksPage() {
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
      setWorkers(fetchedWorkers);
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
      const newTask = await createTask(data);
      setTasks((prev) => [newTask, ...prev]);
      setShowCreateForm(false);
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

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <PageHeader
          title="Tasks"
          subtitle="Manage and assign farm tasks"
          action={
            !showCreateForm ? (
              <div className="flex gap-2">
                <Link href="/manager/reports/open-tasks">
                  <Button variant="secondary">📊 Report</Button>
                </Link>
                <Link href="/manager/tasks/history">
                <Button variant="secondary">📜 History</Button>
                </Link>
                <Button onClick={() => setShowCreateForm(true)}>+ Add Task</Button>
              </div>
            ) : undefined
          }
        />
      </div>

      {showCreateForm && (
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-700 mb-4">New Task</h2>
          {submitError && <Alert className="mb-4">{submitError}</Alert>}
          <TaskForm
            onSubmit={handleCreate}
            onCancel={() => { setShowCreateForm(false); setSubmitError(null); }}
            isLoading={isSubmitting}
            workers={workers}
            zones={zones}
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
  );
}