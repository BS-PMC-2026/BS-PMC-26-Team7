'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import FarmMap, { FarmSection } from '@/components/map/FarmMap';
import TaskList from '@/components/tasks/TaskList';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import { Task } from '@/types/task';
import { getMyTasks } from '@/services/tasks';

export default function WorkerPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTaskDetail, setActiveTaskDetail] = useState<Task | null>(null);

  const loadTasks = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setIsLoading(true);
    setError(null);
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

  // Build section color overrides: red-ish for zones with open tasks
  const openTaskZones = new Set(
    tasks
      .filter((t) => (t.status === 'todo' || t.status === 'in_progress') && t.zoneCode)
      .map((t) => t.zoneCode as string)
  );

  const sectionColors: Record<string, string> = {};
  for (const code of openTaskZones) {
    sectionColors[code] = '#fca5a5'; // red-300
  }

  const PRIORITY_COLORS: Record<string, string> = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  };

  const renderPopupExtra = (section: FarmSection) => {
    const zoneTasks = tasks.filter(
      (t) => t.zoneCode === section.id && (t.status === 'todo' || t.status === 'in_progress')
    );
    const hasOpenTask = zoneTasks.length > 0;

    return (
      <div className="mt-3 mb-1">
        {hasOpenTask ? (
          <div className="flex flex-col gap-2">
            {zoneTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => setActiveTaskDetail(task)}
                className="flex items-center gap-2 w-full text-right px-3 py-2 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
              >
                <span className="text-red-500 font-bold text-base shrink-0">✗</span>
                <span className="text-sm text-red-700 font-medium truncate flex-1">{task.title}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
            <span className="text-green-500 font-bold text-base">✓</span>
            <span className="text-sm text-green-700">אין משימות פתוחות באזור זה</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <PageHeader
            label="Worker"
            title="My Dashboard"
            subtitle="Your tasks and farm map — red zones have open tasks assigned to you"
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8">
        {error && <Alert>{error}</Alert>}

        {/* Map */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Farm Map</h2>
          {isLoading ? (
            <p className="text-sm text-gray-400 py-8 text-center">Loading map...</p>
          ) : (
            <FarmMap sectionColors={sectionColors} renderPopupExtra={renderPopupExtra} />
          )}
        </div>

        {/* Task list */}
        <div>
          <h2 className="text-base font-semibold text-gray-700 mb-4">My Tasks</h2>
          {isLoading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No tasks assigned to you.</p>
          ) : (
            <TaskList tasks={tasks} />
          )}
        </div>
      </div>

      {/* Task detail sub-popup */}
      {activeTaskDetail && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setActiveTaskDetail(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveTaskDetail(null)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500 text-lg"
              aria-label="Close"
            >
              ×
            </button>

            <h3 className="text-lg font-semibold text-gray-900 mb-4 pr-8">{activeTaskDetail.title}</h3>

            <div className="flex flex-col gap-3 text-sm">
              {activeTaskDetail.description && (
                <p className="text-gray-600">{activeTaskDetail.description}</p>
              )}

              <div className="flex flex-wrap gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[activeTaskDetail.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                  {activeTaskDetail.priority}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                  {activeTaskDetail.status.replace('_', ' ')}
                </span>
              </div>

              <div className="flex flex-col gap-1 text-xs text-gray-500">
                <span>Type: <span className="text-gray-700 font-medium">{activeTaskDetail.taskType}</span></span>
                {activeTaskDetail.dueDate && (
                  <span>Due: <span className="text-gray-700 font-medium">{new Date(activeTaskDetail.dueDate).toLocaleDateString()}</span></span>
                )}
                {activeTaskDetail.zoneCode && (
                  <span>Zone: <span className="text-gray-700 font-medium">{activeTaskDetail.zoneCode}</span></span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
