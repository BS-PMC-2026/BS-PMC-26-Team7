import { apiFetch } from "./apiClient";

export interface InventoryReportRow {
  InventoryId:       number;
  DisplayName:       string;
  Category:          string;
  Location:          string | null;
  WarehouseQuantity: number;
  AllocatedQuantity: number;
  AvailableQuantity: number;
  LowStock:          boolean;
  LastUpdatedAt:     string;
}

export interface InventoryReportFilters {
  category?:     string;
  lowStockOnly?: boolean;
  sortBy?:       "name" | "quantity" | "category";
}

export async function getInventoryReport(
  filters: InventoryReportFilters = {},
): Promise<InventoryReportRow[]> {
  const params = new URLSearchParams();
  if (filters.category)     params.set("category", filters.category);
  if (filters.lowStockOnly) params.set("low_stock_only", "true");
  if (filters.sortBy)       params.set("sort_by", filters.sortBy);
  const query = params.toString();
  return apiFetch<InventoryReportRow[]>(
    `/api/inventory/report${query ? `?${query}` : ""}`,
  );
}
