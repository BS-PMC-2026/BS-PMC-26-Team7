import { apiFetch } from './apiClient';
import { ChecklistFormItem, ChecklistItem, CreateTaskFormData, Task } from '@/types/task';

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
    // Strip itemId/isCompleted — creation endpoint only accepts { title }
    checklistItems: (data.checklistItems ?? [])
      .map((i) => ({ title: i.title.trim() }))
      .filter((i) => i.title.length > 0),
  };
}

export async function getMyTasks(token: string): Promise<Task[]> {
  return apiFetch<Task[]>('/api/tasks/my', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getTasks(): Promise<Task[]> {
  return apiFetch<Task[]>('/api/tasks');
}

export async function createTask(data: CreateTaskFormData, anomalyId?: number): Promise<Task> {
  const payload: CreateTaskPayload = {
    ...toPayload(data),
    ...(anomalyId !== undefined ? { anomalyId } : {}),
  };
  return apiFetch<Task>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTask(
  taskId: number,
  data: Partial<CreateTaskFormData> & { status?: string },
  token: string,
): Promise<Task> {
  return apiFetch<Task>(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(data.title !== undefined && { title: data.title.trim() }),
      ...(data.description !== undefined && { description: data.description.trim() || null }),
      ...(data.taskType !== undefined && { taskType: data.taskType }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.assignedToUserId !== undefined && {
        assignedToUserId: data.assignedToUserId ? Number(data.assignedToUserId) : null,
      }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate || null }),
      ...(data.zoneCode !== undefined && { zoneCode: data.zoneCode || null }),
      ...(data.status !== undefined && { status: data.status }),
    }),
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Soft-delete (cancel) a task via the manager-only DELETE endpoint (US42).
 * The task is marked cancelled on the server, not removed; it returns the
 * updated task so callers can drop it from the active list.
 */
export async function cancelTask(taskId: number, token: string): Promise<Task> {
  return apiFetch<Task>(`/api/tasks/${taskId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getTasksReport(token: string): Promise<Task[]> {
  return apiFetch<Task[]>('/api/tasks/report', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getTasksReportByWorker(token: string, workerId: number): Promise<Task[]> {
  return apiFetch<Task[]>(`/api/tasks/report?worker_id=${workerId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getCompletedTasks(): Promise<Task[]> {
  return apiFetch<Task[]>('/api/tasks/completed');
}

export async function addChecklistItem(
  taskId: number,
  title: string,
  token: string,
): Promise<ChecklistItem> {
  return apiFetch<ChecklistItem>(`/api/tasks/${taskId}/checklist`, {
    method: 'POST',
    body: JSON.stringify({ title: title.trim() }),
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateChecklistItem(
  taskId: number,
  itemId: number,
  patch: { title?: string; isCompleted?: boolean },
  token: string,
): Promise<ChecklistItem> {
  return apiFetch<ChecklistItem>(`/api/tasks/${taskId}/checklist/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(patch.title !== undefined && { title: patch.title.trim() }),
      ...(patch.isCompleted !== undefined && { isCompleted: patch.isCompleted }),
    }),
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function deleteChecklistItem(
  taskId: number,
  itemId: number,
  token: string,
): Promise<void> {
  await apiFetch<void>(`/api/tasks/${taskId}/checklist/${itemId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Diff `updated` (from the edit form) against `original` (from the server) and
 * apply the minimal set of create / patch / delete calls needed to synchronise.
 * Returns the resulting ChecklistItem list in form order.
 */
export async function syncChecklistItems(
  taskId: number,
  original: ChecklistItem[],
  updated: ChecklistFormItem[],
  token: string,
): Promise<ChecklistItem[]> {
  const originalById = new Map(original.map((i) => [i.itemId, i]));
  const updatedItemIds = new Set(
    updated.filter((i) => i.itemId !== undefined).map((i) => i.itemId!),
  );

  // Delete items that were removed in the form
  await Promise.all(
    original
      .filter((i) => !updatedItemIds.has(i.itemId))
      .map((i) => deleteChecklistItem(taskId, i.itemId, token)),
  );

  // Create / update items in order
  const result: ChecklistItem[] = [];
  for (const item of updated) {
    const title = item.title.trim();
    if (!title) continue;

    if (item.itemId !== undefined) {
      const orig = originalById.get(item.itemId);
      if (orig && orig.title !== title) {
        const patched = await updateChecklistItem(taskId, item.itemId, { title }, token);
        result.push(patched);
      } else if (orig) {
        result.push(orig);
      }
    } else {
      const created = await addChecklistItem(taskId, title, token);
      result.push(created);
    }
  }

  return result;
}
