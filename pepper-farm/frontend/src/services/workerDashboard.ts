import { apiFetch } from './apiClient';

export interface WorkerAnalytics {
  openTasksCount: number;
  completedTasksCount: number;
  avgCompletionTimeHours: number | null;
  fastestCompletionTimeHours: number | null;
  slowestCompletionTimeHours: number | null;
  fastestTaskTitle: string | null;
  slowestTaskTitle: string | null;
}

export async function getWorkerAnalytics(token: string): Promise<WorkerAnalytics> {
  return apiFetch<WorkerAnalytics>('/api/worker/analytics', {
    headers: { Authorization: `Bearer ${token}` },
  });
}
