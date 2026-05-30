import { apiFetch } from "./apiClient";
import {
  InventoryByVariety,
  InventoryCreatePayload,
  InventoryResponse,
  InventoryUpdatePayload,
} from "@/types/inventory";

export async function getInventoryList(): Promise<InventoryResponse[]> {
  return apiFetch<InventoryResponse[]>("/api/inventory");
}

export async function getInventoryById(inventoryId: number): Promise<InventoryResponse> {
  return apiFetch<InventoryResponse>(`/api/inventory/${inventoryId}`);
}

export async function createInventoryItem(
  payload: InventoryCreatePayload,
): Promise<InventoryResponse> {
  return apiFetch<InventoryResponse>("/api/inventory", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateInventory(
  inventoryId: number,
  payload: InventoryUpdatePayload,
): Promise<InventoryResponse> {
  return apiFetch<InventoryResponse>(`/api/inventory/${inventoryId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getInventoryByVariety(): Promise<InventoryByVariety[]> {
  return apiFetch<InventoryByVariety[]>("/api/inventory/by-variety", { timeoutMs: 30_000 });
}
