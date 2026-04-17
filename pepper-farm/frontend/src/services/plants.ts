import { API_URL } from "@/lib/constants";
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
  const res = await fetch(`${API_URL}/api/plants`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.detail || "Failed to create plant");
  return result;
}

export async function getAllPlants(token: string): Promise<PlantData[]> {
  const res = await fetch(`${API_URL}/api/plants`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? "Failed to fetch plants.");
  return json;
}

export async function updatePlantLocation(
  token: string,
  plantId: number,
  zoneId: number | null
): Promise<PlantData> {
  const res = await fetch(`${API_URL}/api/plants/${plantId}/location`, {
    method:  "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${token}`,
    },
    body: JSON.stringify({ zoneId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? "Failed to update plant location.");
  return json;
}