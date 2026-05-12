'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import { getCompletedTasks } from '@/services/tasks';
import { Task } from '@/types/task';


export default function CompletedTasksHistoryPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTasks() {
      try {
        const data = await getCompletedTasks();
        setTasks(data);
      } catch {
        setError('Failed to load completed tasks.');
      } finally {
        setLoading(false);
      }
    }

    loadTasks();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Completed Tasks History"
        subtitle="Track completed work and employee performance"
      />

      {error && <Alert className="mb-4">{error}</Alert>}

      {loading ? (
        <p className="text-center text-gray-400 py-10">
          Loading completed tasks...
        </p>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No completed tasks found"
          description="Completed tasks will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mt-6">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                  COMPLETED
                </span>

                <span className="text-xs text-gray-400 uppercase">
                  {task.priority}
                </span>
              </div>

              <h2 className="text-lg font-bold text-gray-800 mb-2">
                {task.title}
              </h2>

              <p className="text-sm text-gray-500 mb-4">
                {task.description || 'No description provided.'}
              </p>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Task Type</span>
                  <span className="font-medium text-gray-700">
                    {task.taskType}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">Status</span>
                  <span className="font-medium text-green-600">
                    {task.status}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">Completed At</span>
                  <span className="font-medium text-gray-700">
                    {task.completedAt
                      ? new Date(task.completedAt).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}