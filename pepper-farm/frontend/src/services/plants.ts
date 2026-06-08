import { apiFetch } from "./apiClient";
import { PlantCreate, PlantResponse } from "@/types/plant";

export interface PlantData {
  PlantId:   number;
  PlantCode: string;
  PepperId:  number;
  ZoneId:    number | null;
  Status:    string | null;
  Notes:     string | null;
  IsActive:  boolean;
}

export async function createPlant(data: PlantCreate): Promise<PlantResponse> {
  return apiFetch<PlantResponse>("/api/plants", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getAllPlants(token: string): Promise<PlantData[]> {
  return apiFetch<PlantData[]>("/api/plants", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updatePlantStatus(
  plantId: number,
  status: string | null,
): Promise<PlantData> {
  return apiFetch<PlantData>(`/api/plants/${plantId}/status`, {
    method: "PUT",
    body: JSON.stringify({ Status: status }),
  });
}

export async function updatePlantLocation(
  token: string,
  plantId: number,
  zoneId: number | null,
  transferredAt?: string,
): Promise<PlantData> {
  return apiFetch<PlantData>(`/api/plants/${plantId}/location`, {
    method: "PUT",
    body: JSON.stringify({ zoneId, transferredAt: transferredAt ?? null }),
    headers: { Authorization: `Bearer ${token}` },
  });
}
