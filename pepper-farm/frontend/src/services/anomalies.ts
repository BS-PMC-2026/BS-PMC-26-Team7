import { apiFetch } from "./apiClient";
import { AnomalySummary, PaginatedAlertResponse, TrendPoint, ZoneHealth } from "@/types/anomaly";

export async function getAnomalySummary(): Promise<AnomalySummary> {
  return apiFetch<AnomalySummary>("/api/manager/anomalies/summary");
}

export interface AlertFilters {
  limit?: number;
  offset?: number;
  since?: string;
  severity?: "High" | "Medium";
  status?: "active" | "resolved" | "all";
  zoneId?: number;
  recurring?: boolean;
}

export async function getRecentAlerts(
  filters: AlertFilters = {},
): Promise<PaginatedAlertResponse> {
  const { limit = 50, offset = 0, since, severity, status, zoneId, recurring } = filters;
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (since) params.set("since", since);
  if (severity) params.set("severity", severity);
  if (status) params.set("status", status);
  if (zoneId) params.set("zone_id", String(zoneId));
  if (recurring !== undefined) params.set("recurring", String(recurring));
  return apiFetch<PaginatedAlertResponse>(
    `/api/manager/anomalies/recent?${params}`,
  );
}

export async function getAnomalyTrends(days = 7): Promise<TrendPoint[]> {
  return apiFetch<TrendPoint[]>(`/api/manager/anomalies/trends?days=${days}`);
}

export async function getZoneHealth(): Promise<ZoneHealth[]> {
  return apiFetch<ZoneHealth[]>("/api/manager/anomalies/by-zone");
}

export interface RecurrenceConfig {
  minCount: number;
  windowHours: number;
}

export async function getRecurrenceConfig(): Promise<RecurrenceConfig> {
  return apiFetch<RecurrenceConfig>("/api/manager/anomalies/recurrence-config");
}

export async function updateRecurrenceConfig(
  config: Partial<RecurrenceConfig>,
): Promise<RecurrenceConfig> {
  return apiFetch<RecurrenceConfig>("/api/manager/anomalies/recurrence-config", {
    method: "PATCH",
    body: JSON.stringify(config),
  });
}

export async function resolveAlert(
  alertId: number,
): Promise<{ alertId: number; isResolved: boolean }> {
  return apiFetch<{ alertId: number; isResolved: boolean }>(
    `/api/sensor-alerts/${alertId}/resolve`,
    { method: "PATCH" },
  );
}
