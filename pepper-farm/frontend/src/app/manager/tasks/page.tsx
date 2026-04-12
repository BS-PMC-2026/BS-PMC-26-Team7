'use client';

import { useState, useEffect, useCallback } from 'react';
import TaskForm from '@/components/tasks/TaskForm';
import TaskCard from '@/components/tasks/TaskCard';
import Button from '@/components/ui/Button';
import { CreateTaskFormData, Task } from '@/types/task';
import { Worker } from '@/types/user';
import { createTask, getTasks } from '@/services/tasks';
import { getWorkers } from '@/services/users';

export default function ManagerTasksPage() {
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const loadData = useCallback(async () => {
    setIsLoadingTasks(true);
    setLoadError(null);
    try {
      const [fetchedTasks, fetchedWorkers] = await Promise.all([
        getTasks(),
        getWorkers(),
      ]);
      setTasks(fetchedTasks);
      setWorkers(fetchedWorkers);
    } catch {
      setLoadError('Failed to load tasks. Is the backend running?');
    } finally {
      setIsLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (data: CreateTaskFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const newTask = await createTask(data);
      setTasks((prev) => [newTask, ...prev]);
      setShowForm(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Tasks</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage and assign farm tasks</p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>+ Add Task</Button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-700 mb-4">New Task</h2>
          {submitError && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2">
              {submitError}
            </p>
          )}
          <TaskForm
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setSubmitError(null); }}
            isLoading={isSubmitting}
            workers={workers}
          />
        </div>
      )}

      {/* Task list */}
      {loadError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2 mb-4">
          {loadError}
        </p>
      )}

      {isLoadingTasks ? (
        <p className="text-sm text-gray-400 text-center py-12">Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-base">No tasks yet.</p>
          <p className="text-sm mt-1">Click <span className="font-medium">+ Add Task</span> to create the first one.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} workers={workers} />
          ))}
        </div>
      )}
    </div>
  );
}
