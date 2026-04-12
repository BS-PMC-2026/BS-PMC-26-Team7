'use client';

import { useState, useEffect } from 'react';
import TaskForm from '@/components/tasks/TaskForm';
import Button from '@/components/ui/Button';
import { CreateTaskFormData } from '@/types/task';
import { Worker } from '@/types/user';
import { createTask } from '@/services/tasks';
import { getWorkers } from '@/services/users';

export default function ManagerTasksPage() {
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);

  useEffect(() => {
    getWorkers().then(setWorkers).catch(() => {});
  }, []);

  const handleSubmit = async (data: CreateTaskFormData) => {
    setIsLoading(true);
    setError(null);
    try {
      await createTask(data);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Tasks</h1>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>+ Add Task</Button>
        )}
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-2">
          {error}
        </p>
      )}

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-medium text-gray-700 mb-4">New Task</h2>
          <TaskForm
            onSubmit={handleSubmit}
            onCancel={() => setShowForm(false)}
            isLoading={isLoading}
            workers={workers}
          />
        </div>
      )}
    </div>
  );
}
