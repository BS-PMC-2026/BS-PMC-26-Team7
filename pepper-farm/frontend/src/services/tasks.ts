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
  zoneCode: string | null;
}

function toPayload(data: CreateTaskFormData): CreateTaskPayload {
  return {
    title: data.title.trim(),
    description: data.description.trim() || null,
    taskType: data.taskType,
    priority: data.priority,
    assignedToUserId: data.assignedToUserId ? Number(data.assignedToUserId) : null,
    dueDate: data.dueDate || null,
    zoneCode: data.zoneCode || null,
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
  const token = localStorage.getItem('token') ?? '';
  const res = await fetch(`${API_URL}/api/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(toPayload(data)),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? 'Failed to create task.');
  return json;
}

export async function updateTask(
  taskId: number,
  data: Partial<CreateTaskFormData> & { status?: string },
  token: string,
): Promise<Task> {
  const res = await fetch(`${API_URL}/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...(data.title !== undefined && { title: data.title.trim() }),
      ...(data.description !== undefined && { description: data.description.trim() || null }),
      ...(data.taskType !== undefined && { taskType: data.taskType }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.assignedToUserId !== undefined && { assignedToUserId: data.assignedToUserId ? Number(data.assignedToUserId) : null }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate || null }),
      ...(data.zoneCode !== undefined && { zoneCode: data.zoneCode || null }),
      ...(data.status !== undefined && { status: data.status }),
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? 'Failed to update task.');
  return json;
}

export async function getTasksReport(token: string): Promise<Task[]> {
  const res = await fetch(`${API_URL}/api/tasks/report`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? 'Failed to fetch tasks report.');
  return json;
}

export async function getTasksReportByWorker(token: string, workerId: number): Promise<Task[]> {
  const res = await fetch(`${API_URL}/api/tasks/report?worker_id=${workerId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? 'Failed to fetch tasks report.');
  return json;
}

export async function getCompletedTasks(): Promise<Task[]> {
  const token = localStorage.getItem('token') ?? '';

  return apiFetch<Task[]>('/api/tasks/completed', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}