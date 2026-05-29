import { apiFetch } from './api';

export type ProductCreatePayload = {
  ProductName: string;
  ProductDescription: string | null;
  Category: string | null;
  Price: number;
  ImageUrl: string | null;
  PepperId: number | null;
  IsActive: boolean;
  DiscountPercentage: number;
  DiscountActive: boolean;
  DiscountStartDate: string | null;
  DiscountEndDate: string | null;
};

export type ProductResponse = {
  ProductId: number;
  ProductName: string;
  ProductDescription: string | null;
  Category: string | null;
  Price: number;
  FinalPrice: number;
  ImageUrl: string | null;
  PepperId: number | null;
  IsActive: boolean;
  AllocatedQuantity: number;
  DiscountPercentage: number;
  DiscountActive: boolean;
  DiscountStartDate: string | null;
  DiscountEndDate: string | null;
  DiscountIsCurrentlyValid: boolean;
};

export async function createProduct(
  payload: ProductCreatePayload
): Promise<ProductResponse> {
  return apiFetch<ProductResponse>('/api/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getProducts(): Promise<ProductResponse[]> {
  return apiFetch<ProductResponse[]>('/api/products');
}

export async function getProductById(id: number): Promise<ProductResponse> {
  return apiFetch<ProductResponse>(`/api/products/${id}`);
}

export async function updateProduct(
  id: number,
  payload: ProductCreatePayload
): Promise<ProductResponse> {
  return apiFetch<ProductResponse>(`/api/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
