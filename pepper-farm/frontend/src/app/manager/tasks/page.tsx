'use client';

import { useState, useEffect, useCallback } from 'react';
import TaskForm from '@/components/tasks/TaskForm';
import TaskCard from '@/components/tasks/TaskCard';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { CreateTaskFormData, Task } from '@/types/task';
import { createTask, getTasks } from '@/services/tasks';
import { getAllUsers, UserData } from '@/services/users';

export default function ManagerTasksPage() {
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workers, setWorkers] = useState<UserData[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const loadData = useCallback(async () => {
    setIsLoadingTasks(true);
    setLoadError(null);
    try {
      const token = localStorage.getItem("token") ?? "";
      const [fetchedTasks, fetchedWorkers] = await Promise.all([
        getTasks(),
        getAllUsers(token),
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
      <div className="mb-6">
        <PageHeader
          title="Tasks"
          subtitle="Manage and assign farm tasks"
          action={
            !showForm
              ? <Button onClick={() => setShowForm(true)}>+ Add Task</Button>
              : undefined
          }
        />
      </div>

      {showForm && (
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-700 mb-4">New Task</h2>
          {submitError && (
            <Alert className="mb-4">{submitError}</Alert>
          )}
          <TaskForm
            onSubmit={handleSubmit}
            onCancel={() => { setShowForm(false); setSubmitError(null); }}
            isLoading={isSubmitting}
            workers={workers}
          />
        </Card>
      )}

      {loadError && <Alert className="mb-4">{loadError}</Alert>}

      {isLoadingTasks ? (
        <p className="text-sm text-gray-400 text-center py-12">Loading tasks...</p>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet."
          description="Click + Add Task to create the first one."
        />
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