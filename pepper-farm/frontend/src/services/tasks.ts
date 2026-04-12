import { apiFetch } from './api';
import { CreateTaskFormData, Task } from '@/types/task';

interface CreateTaskPayload {
  title: string;
  description: string | null;
  taskType: string;
  priority: string;
  assignedToUserId: number | null;
  dueDate: string | null;
}

function toPayload(data: CreateTaskFormData): CreateTaskPayload {
  return {
    title: data.title.trim(),
    description: data.description.trim() || null,
    taskType: data.taskType,
    priority: data.priority,
    assignedToUserId: data.assignedToUserId ? Number(data.assignedToUserId) : null,
    dueDate: data.dueDate || null,
  };
}

export async function getTasks(): Promise<Task[]> {
  return apiFetch<Task[]>('/api/tasks');
}

export async function createTask(data: CreateTaskFormData): Promise<Task> {
  return apiFetch<Task>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(toPayload(data)),
  });
}
