import { apiFetch } from './api';

export type ProductCreatePayload = {
  ProductName: string;
  ProductDescription: string | null;
  Category: string | null;
  Price: number;
  ImageUrl: string | null;
  PepperId: number | null;
  IsActive: boolean;
};

export type ProductResponse = {
  ProductId: number;
  ProductName: string;
  ProductDescription: string | null;
  Category: string | null;
  Price: number;
  ImageUrl: string | null;
  PepperId: number | null;
  IsActive: boolean;
};

export async function createProduct(
  payload: ProductCreatePayload
): Promise<ProductResponse> {
  return apiFetch<ProductResponse>('/api/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}