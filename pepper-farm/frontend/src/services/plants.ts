import { PlantCreate, PlantResponse } from "@/types/plant";

const BASE_URL = "http://127.0.0.1:8000";

export async function createPlant(data: PlantCreate): Promise<PlantResponse> {
  const response = await fetch(`${BASE_URL}/api/plants`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.detail || "Failed to create plant");
  }

  return result;
}