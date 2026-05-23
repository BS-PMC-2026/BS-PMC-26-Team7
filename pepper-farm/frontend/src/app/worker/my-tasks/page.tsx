'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TaskList from '@/components/tasks/TaskList';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import { ChecklistItem, Task, TaskStatus } from '@/types/task';
import { getMyTasks, updateChecklistItem, updateTask } from '@/services/tasks';
import { useToast } from '@/context/ToastContext';
import { useLanguage } from '@/context/LanguageContext';

export default function MyTasksPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const wk = t.worker;
  const { show } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setIsLoading(true);
    setError(null);
    setTasks([]);
    try {
      const data = await getMyTasks(token);
      setTasks(data);
    } catch {
      setError(wk.failedToLoad);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleStatusChange = useCallback(async (task: Task, newStatus: TaskStatus) => {
    const token = localStorage.getItem('token') ?? '';
    try {
      const updated = await updateTask(task.id, { status: newStatus }, token);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      const label = newStatus === 'in_progress' ? 'Started' : 'Completed';
      show({
        title: label,
        body: `"${task.title}" marked as ${newStatus.replace('_', ' ')}.`,
        severity: 'Medium',
        autoDismissMs: 4000,
      });
    } catch (err) {
      show({
        title: 'Error',
        body: err instanceof Error ? err.message : 'Failed to update task status.',
        severity: 'High',
        autoDismissMs: 6000,
      });
    }
  }, [show]);

  const handleToggleChecklistItem = useCallback(
    async (task: Task, item: ChecklistItem, nextCompleted: boolean) => {
      const token = localStorage.getItem('token') ?? '';
      // Optimistic update: flip the item locally, revert on error.
      setTasks((prev) =>
        prev.map((tt) =>
          tt.id === task.id
            ? {
                ...tt,
                checklistItems: tt.checklistItems.map((ci) =>
                  ci.itemId === item.itemId
                    ? { ...ci, isCompleted: nextCompleted }
                    : ci,
                ),
              }
            : tt,
        ),
      );
      try {
        await updateChecklistItem(task.id, item.itemId, { isCompleted: nextCompleted }, token);
      } catch (err) {
        setTasks((prev) =>
          prev.map((tt) =>
            tt.id === task.id
              ? {
                  ...tt,
                  checklistItems: tt.checklistItems.map((ci) =>
                    ci.itemId === item.itemId
                      ? { ...ci, isCompleted: item.isCompleted }
                      : ci,
                  ),
                }
              : tt,
          ),
        );
        show({
          title: 'Error',
          body: err instanceof Error ? err.message : t.tasks.failedToUpdateChecklistItem,
          severity: 'High',
          autoDismissMs: 6000,
        });
      }
    },
    [show, t.tasks.failedToUpdateChecklistItem],
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <PageHeader title={wk.myTasksTitle} subtitle={wk.myTasksSubtitle} />
      </div>

      {error && <Alert className="mb-4">{error}</Alert>}

      {isLoading ? (
        <p className="text-sm text-[var(--color-muted-foreground)] text-center py-12">{t.tasks.loading}</p>
      ) : tasks.length === 0 ? (
        <EmptyState title={wk.noTasksYet} description={wk.youHaveNoTasks} />
      ) : (
        <TaskList
          tasks={tasks}
          onStatusChange={handleStatusChange}
          onToggleChecklistItem={handleToggleChecklistItem}
        />
      )}
    </div>
  );
}
