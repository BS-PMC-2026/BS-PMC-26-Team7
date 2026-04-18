import { API_URL } from '@/lib/constants';
import {
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
    const detail =
      (json && typeof json.detail === 'string' && json.detail) || fallback;
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

export async function getInventoryByProductId(
  productId: number
): Promise<InventoryResponse> {
  const res = await fetch(`${API_URL}/api/inventory/${productId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return parseOrThrow<InventoryResponse>(res, 'Failed to load inventory record.');
}

export async function updateInventory(
  productId: number,
  payload: InventoryUpdatePayload
): Promise<InventoryResponse> {
  const res = await fetch(`${API_URL}/api/inventory/${productId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(payload),
  });
  return parseOrThrow<InventoryResponse>(res, 'Failed to update inventory.');
}