import { API_URL } from '@/lib/constants';
import {
  Pesticide,
  CreateSprayReportRequest,
  SprayReportSubmissionResponse,
} from '@/types/spray';

export async function getPesticides(token: string): Promise<Pesticide[]> {
  const res = await fetch(`${API_URL}/api/spray-reports/pesticides`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? 'Failed to load pesticides.');
  return json;
}

export async function createSprayReport(
  data: CreateSprayReportRequest,
  token: string,
): Promise<SprayReportSubmissionResponse> {
  const res = await fetch(`${API_URL}/api/spray-reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? 'Failed to submit spray report.');
  return json;
}