import { API_URL } from '@/lib/constants';
import { AnomalySummary, PaginatedAlertResponse, TrendPoint, ZoneHealth } from '@/types/anomaly';

function getToken(): string {
  return typeof window !== 'undefined' ? (localStorage.getItem('token') ?? '') : '';
}

function authHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

export async function getAnomalySummary(): Promise<AnomalySummary> {
  const res = await fetch(`${API_URL}/api/manager/anomalies/summary`, {
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? 'Failed to fetch anomaly summary.');
  return json;
}

export interface AlertFilters {
  limit?: number;
  offset?: number;
  since?: string;
  severity?: 'High' | 'Medium';
  status?: 'active' | 'resolved' | 'all';
  zoneId?: number;
}

export async function getRecentAlerts(filters: AlertFilters = {}): Promise<PaginatedAlertResponse> {
  const { limit = 50, offset = 0, since, severity, status, zoneId } = filters;
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (since) params.set('since', since);
  if (severity) params.set('severity', severity);
  if (status) params.set('status', status);
  if (zoneId) params.set('zone_id', String(zoneId));
  const res = await fetch(`${API_URL}/api/manager/anomalies/recent?${params}`, {
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? 'Failed to fetch recent alerts.');
  return json as PaginatedAlertResponse;
}

export async function getAnomalyTrends(days = 7): Promise<TrendPoint[]> {
  const res = await fetch(`${API_URL}/api/manager/anomalies/trends?days=${days}`, {
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? 'Failed to fetch anomaly trends.');
  return json;
}

export async function getZoneHealth(): Promise<ZoneHealth[]> {
  const res = await fetch(`${API_URL}/api/manager/anomalies/by-zone`, {
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? 'Failed to fetch zone health.');
  return json;
}

export async function resolveAlert(alertId: number): Promise<{ alertId: number; isResolved: boolean }> {
  const res = await fetch(`${API_URL}/api/sensor-alerts/${alertId}/resolve`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? 'Failed to resolve alert.');
  return json;
}
