/**
 * Pure urgency helpers for dashboard task grouping.
 * No React, no i18n — all functions take a Task and return plain values.
 */

import { Task } from '@/types/task';

const DONE_STATUSES = new Set(['done', 'completed', 'cancelled']);
const OPEN_STATUSES = new Set([
  'todo', 'pending', 'in_progress', 'in progress', 'not_completed', 'not completed',
]);
const MS_24H = 24 * 60 * 60 * 1000;

export function isTaskCompleted(task: Task): boolean {
  return DONE_STATUSES.has(String(task.status).toLowerCase());
}

export function isTaskOpen(task: Task): boolean {
  return OPEN_STATUSES.has(String(task.status).toLowerCase());
}

export function isTaskOverdue(task: Task): boolean {
  if (!task.dueDate || isTaskCompleted(task)) return false;
  return new Date(task.dueDate).getTime() < Date.now();
}

export function isTaskDueSoon(task: Task): boolean {
  if (!task.dueDate || isTaskCompleted(task) || isTaskOverdue(task)) return false;
  return new Date(task.dueDate).getTime() - Date.now() <= MS_24H;
}

export type TaskUrgency = 'overdue' | 'due-soon' | 'normal';

export function getTaskUrgency(task: Task): TaskUrgency {
  if (isTaskOverdue(task)) return 'overdue';
  if (isTaskDueSoon(task)) return 'due-soon';
  return 'normal';
}

function byDueDateAsc(a: Task, b: Task): number {
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
}

export interface GroupedDashboardTasks {
  overdue:           Task[];
  dueSoon:           Task[];
  normal:            Task[];
  recentlyCompleted: Task[];
}

/**
 * Partitions a flat task list into urgency groups suitable for the dashboard.
 *
 * @param allTasks         Full task list from the API (all statuses).
 * @param maxCompletedDays How many days back to look for recently-completed tasks (default 7).
 * @param maxCompleted     Maximum recently-completed tasks to include (default 5).
 */
export function groupDashboardTasks(
  allTasks: Task[],
  maxCompletedDays = 7,
  maxCompleted = 5,
): GroupedDashboardTasks {
  const open    = allTasks.filter(isTaskOpen);
  const overdue = open.filter(isTaskOverdue).sort(byDueDateAsc);
  const dueSoon = open.filter(isTaskDueSoon).sort(byDueDateAsc);
  const normal  = open
    .filter((t) => !isTaskOverdue(t) && !isTaskDueSoon(t))
    .sort(byDueDateAsc);

  const cutoff = Date.now() - maxCompletedDays * MS_24H;
  const recentlyCompleted = allTasks
    .filter((t) => t.status === 'done' && t.completedAt != null)
    .filter((t) => new Date(t.completedAt!).getTime() >= cutoff)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
    .slice(0, maxCompleted);

  return { overdue, dueSoon, normal, recentlyCompleted };
}
