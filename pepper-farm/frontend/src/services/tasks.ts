import { apiFetch } from './api';
import { API_URL } from '@/lib/constants';
import { CreateTaskFormData, Task } from '@/types/task';

interface CreateTaskPayload {
  title: string;
  description: string | null;
  taskType: string;
  priority: string;
  assignedToUserId: number | null;
  dueDate: string | null;
  zoneId: number | null;
}

function toPayload(data: CreateTaskFormData): CreateTaskPayload {
  return {
    title: data.title.trim(),
    description: data.description.trim() || null,
    taskType: data.taskType,
    priority: data.priority,
    assignedToUserId: data.assignedToUserId ? Number(data.assignedToUserId) : null,
    dueDate: data.dueDate || null,
    zoneId: data.zoneId ? Number(data.zoneId) : null,
  };
}

export async function getMyTasks(token: string): Promise<Task[]> {
  const res = await fetch(`${API_URL}/api/tasks/my`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? 'Failed to fetch tasks.');
  return json;
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
