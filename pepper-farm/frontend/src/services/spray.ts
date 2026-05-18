import { apiFetch } from "./apiClient";
import {
  CreateSprayReportRequest,
  Pesticide,
  SprayReportSubmissionResponse,
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
