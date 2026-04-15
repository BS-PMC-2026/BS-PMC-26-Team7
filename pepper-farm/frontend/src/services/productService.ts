const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

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

function extractErrorMessage(payload: any, fallback: string): string {
  if (Array.isArray(payload?.detail)) {
    const message = payload.detail
      .map((item: { msg?: string }) => item?.msg)
      .filter(Boolean)
      .join(" | ");

    return message || fallback;
  }

  if (typeof payload?.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }

  return fallback;
}

export async function createProduct(
  payload: ProductCreatePayload
): Promise<ProductResponse> {
  const response = await fetch(`${API_BASE_URL}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "Failed to create product."));
  }

  return data as ProductResponse;
}