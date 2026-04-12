import { apiFetch } from './api';
import { Worker } from '@/types/user';

export async function getWorkers(): Promise<Worker[]> {
  return apiFetch<Worker[]>('/api/users/workers');
}
