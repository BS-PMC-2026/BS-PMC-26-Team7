import { apiFetch } from "./apiClient";
import {
  CreateSprayReportRequest,
  Pesticide,
  SprayAlert,
  SprayReportSubmissionResponse,
  ZoneSprayStatusData,
} from "@/types/spray";

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
