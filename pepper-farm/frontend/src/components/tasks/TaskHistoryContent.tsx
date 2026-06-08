'use client';

import { useState, useEffect, useMemo } from 'react';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import { getCompletedTasks } from '@/services/tasks';
import type { Task } from '@/types/task';
import { useTaskDelete } from '@/components/tasks/useTaskDelete';
import { useLanguage } from '@/context/LanguageContext';
import { getCurrentUserId } from '@/lib/auth';

export default function TaskHistoryContent() {
  const { t } = useLanguage();
  const tk = t.tasks;
  const currentUserId = useMemo(() => getCurrentUserId(), []);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const del = useTaskDelete((id) => setTasks((prev) => prev.filter((tt) => tt.id !== id)), 'z-[80]');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    getCompletedTasks()
      .then(setTasks)
      .catch(() => setError('Failed to load completed tasks.'))
      .finally(() => setLoading(false));
  }, []);

  const filteredTasks = tasks.filter((task) => {
    const title = task.title?.toLowerCase() || '';
    const description = task.description?.toLowerCase() || '';
    const search = searchTerm.toLowerCase();

    return (
      title.includes(search) ||
      description.includes(search)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search completed tasks..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-lg border border-[var(--color-border)] px-4 py-3 bg-white"
        />
      </div>
      {error && <Alert className="mb-4">{error}</Alert>}
      {loading ? (
        <p className="text-center text-[var(--color-muted-foreground)] py-10">Loading completed tasks...</p>
      ) : filteredTasks.length === 0 ? (
        <EmptyState title="No completed tasks found" description="Completed tasks will appear here." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mt-2">
          {filteredTasks.map((task) => (
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
              {/* Soft-delete from history (US42): only tasks the current manager created. */}
              {currentUserId != null && task.createdByUserId === currentUserId && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => del.requestDelete(task)}
                    className="px-3 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    {tk.deleteButton}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {del.dialog}
    </div>
  );
}
