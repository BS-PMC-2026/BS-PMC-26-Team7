import { apiFetch } from './api';

export interface ZoneSummary {
  ZoneId: number;
  ZoneCode: string;
  ZoneName: string;
}

export async function getZones(): Promise<ZoneSummary[]> {
  return apiFetch<ZoneSummary[]>('/api/zones');
}
