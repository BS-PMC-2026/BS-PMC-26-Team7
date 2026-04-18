import { API_URL } from '@/lib/constants';
import {
  InventoryByVariety,
  InventoryCreatePayload,
  InventoryResponse,
  InventoryUpdatePayload,
} from '@/types/inventory';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

async function parseOrThrow<T>(res: Response, fallback: string): Promise<T> {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = (json && typeof json.detail === 'string' && json.detail) || fallback;
    throw new Error(detail);
  }
  return json as T;
}

export async function getInventoryList(): Promise<InventoryResponse[]> {
  const res = await fetch(`${API_URL}/api/inventory`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return parseOrThrow<InventoryResponse[]>(res, 'Failed to load inventory.');
}

export async function getInventoryById(inventoryId: number): Promise<InventoryResponse> {
  const res = await fetch(`${API_URL}/api/inventory/${inventoryId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return parseOrThrow<InventoryResponse>(res, 'Failed to load inventory record.');
}

export async function createInventoryItem(
  payload: InventoryCreatePayload
): Promise<InventoryResponse> {
  const res = await fetch(`${API_URL}/api/inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(payload),
  });
  return parseOrThrow<InventoryResponse>(res, 'Failed to create inventory item.');
}

export async function updateInventory(
  inventoryId: number,
  payload: InventoryUpdatePayload
): Promise<InventoryResponse> {
  const res = await fetch(`${API_URL}/api/inventory/${inventoryId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(payload),
  });
  return parseOrThrow<InventoryResponse>(res, 'Failed to update inventory.');
}

export async function getInventoryByVariety(): Promise<InventoryByVariety[]> {
  const res = await fetch(`${API_URL}/api/inventory/by-variety`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return parseOrThrow<InventoryByVariety[]>(res, 'Failed to load plants by variety.');
}