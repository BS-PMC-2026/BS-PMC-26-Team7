import { apiFetch } from './api';
import { API_URL } from '@/lib/constants';
import { ChecklistItem, CreateTaskFormData, Task } from '@/types/task';


interface CreateTaskPayload {
  title: string;
  description: string | null;
  taskType: string;
  priority: string;
  assignedToUserId: number | null;
  dueDate: string | null;
  zoneCode: string | null;
  anomalyId?: number;
  checklistItems: { title: string }[];
}

function toPayload(data: CreateTaskFormData): Omit<CreateTaskPayload, 'anomalyId'> {
  return {
    title: data.title.trim(),
    description: data.description.trim() || null,
    taskType: data.taskType,
    priority: data.priority,
    assignedToUserId: data.assignedToUserId ? Number(data.assignedToUserId) : null,
    dueDate: data.dueDate || null,
    zoneCode: data.zoneCode || null,
    checklistItems: (data.checklistItems ?? [])
      .map((i) => ({ title: i.title.trim() }))
      .filter((i) => i.title.length > 0),
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

export async function createTask(data: CreateTaskFormData, anomalyId?: number): Promise<Task> {
  const token = localStorage.getItem('token') ?? '';
  const payload: CreateTaskPayload = {
    ...toPayload(data),
    ...(anomalyId !== undefined ? { anomalyId } : {}),
  };
  const res = await fetch(`${API_URL}/api/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
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

export async function addChecklistItem(
  taskId: number,
  title: string,
  token: string,
): Promise<ChecklistItem> {
  const res = await fetch(`${API_URL}/api/tasks/${taskId}/checklist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title: title.trim() }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? 'Failed to add checklist item.');
  return json;
}

export async function updateChecklistItem(
  taskId: number,
  itemId: number,
  patch: { title?: string; isCompleted?: boolean },
  token: string,
): Promise<ChecklistItem> {
  const res = await fetch(
    `${API_URL}/api/tasks/${taskId}/checklist/${itemId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...(patch.title !== undefined && { title: patch.title.trim() }),
        ...(patch.isCompleted !== undefined && { isCompleted: patch.isCompleted }),
      }),
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? 'Failed to update checklist item.');
  return json;
}

export async function deleteChecklistItem(
  taskId: number,
  itemId: number,
  token: string,
): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/tasks/${taskId}/checklist/${itemId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.detail ?? 'Failed to delete checklist item.');
  }
}