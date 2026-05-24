import { apiFetch } from "./apiClient";
import {
  AssignOverdueAlertRequest,
  CreateSprayReportRequest,
  OverdueSprayAlert,
  Pesticide,
  SprayAlert,
  SprayReportSubmissionResponse,
  ZoneSprayStatusData,
} from "@/types/spray";
import type { Task } from "@/types/task";

export async function getPesticides(token: string): Promise<Pesticide[]> {
  return apiFetch<Pesticide[]>("/api/spray-reports/pesticides", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createSprayReport(
  data: CreateSprayReportRequest,
  token: string,
): Promise<SprayReportSubmissionResponse> {
  return apiFetch<SprayReportSubmissionResponse>("/api/spray-reports", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getZoneSprayMap(): Promise<ZoneSprayStatusData[]> {
  return apiFetch<ZoneSprayStatusData[]>("/api/spray-reports/zone-map");
}

// US31 — Authenticated restricted zone map (Worker, FarmManager, authenticated Visitor)
export async function getRestrictedZones(): Promise<ZoneSprayStatusData[]> {
  return apiFetch<ZoneSprayStatusData[]>("/api/spray-reports/restricted-zones");
}

// US31 — Public restricted zone map: no auth required, used by visitor/public safety page
export async function getPublicRestrictedZones(): Promise<ZoneSprayStatusData[]> {
  return apiFetch<ZoneSprayStatusData[]>("/api/spray-reports/public-restricted-zones");
}

// US30 — Manager spray alert functions

export async function getSprayAlerts(): Promise<SprayAlert[]> {
  return apiFetch<SprayAlert[]>("/api/spray-reports/alerts");
}

export async function getSprayAlertById(alertId: number): Promise<SprayAlert> {
  return apiFetch<SprayAlert>(`/api/spray-reports/alerts/${alertId}`);
}

export async function markSprayAlertRead(alertId: number): Promise<SprayAlert> {
  return apiFetch<SprayAlert>(`/api/spray-reports/alerts/${alertId}/read`, {
    method: "PATCH",
  });
}

// US32 — Manager overdue spray alert functions

export async function getOverdueSprayAlerts(activeOnly = false): Promise<OverdueSprayAlert[]> {
  const qs = activeOnly ? "?active_only=true" : "";
  return apiFetch<OverdueSprayAlert[]>(`/api/spray-reports/overdue-alerts${qs}`);
}

export async function markOverdueAlertRead(alertId: number): Promise<OverdueSprayAlert> {
  return apiFetch<OverdueSprayAlert>(
    `/api/spray-reports/overdue-alerts/${alertId}/read`,
    { method: "PATCH" },
  );
}

export async function assignOverdueSprayTask(
  alertId: number,
  data: AssignOverdueAlertRequest,
): Promise<Task> {
  return apiFetch<Task>(`/api/spray-reports/overdue-alerts/${alertId}/assign`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function runOverdueCheck(): Promise<{ alertsCreated: number }> {
  return apiFetch<{ alertsCreated: number }>("/api/spray-reports/overdue-check/run", {
    method: "POST",
  });
}
