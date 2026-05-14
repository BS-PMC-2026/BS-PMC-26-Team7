'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TaskList from '@/components/tasks/TaskList';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import { Task, TaskStatus } from '@/types/task';
import { getMyTasks, updateTask } from '@/services/tasks';
import { useToast } from '@/context/ToastContext';

export default function MyTasksPage() {
  const router = useRouter();
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
      setError('Failed to load tasks. Is the backend running?');
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

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <PageHeader title="My Tasks" subtitle="Tasks assigned to you" />
      </div>

      {error && <Alert className="mb-4">{error}</Alert>}

      {isLoading ? (
        <p className="text-sm text-gray-400 text-center py-12">Loading tasks...</p>
      ) : tasks.length === 0 ? (
        <EmptyState title="No tasks yet." description="You have no tasks assigned." />
      ) : (
        <TaskList tasks={tasks} onStatusChange={handleStatusChange} />
      )}
    </div>
  );
}
