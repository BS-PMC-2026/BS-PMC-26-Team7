import { API_URL } from "@/lib/constants";

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
  filters: InventoryReportFilters = {}
): Promise<InventoryReportRow[]> {
  const token = localStorage.getItem("token") ?? "";
  const params = new URLSearchParams();
  if (filters.category)    params.set("category", filters.category);
  if (filters.lowStockOnly) params.set("low_stock_only", "true");
  if (filters.sortBy)      params.set("sort_by", filters.sortBy);

  const query = params.toString();
  const url = `${API_URL}/api/inventory/report${query ? `?${query}` : ""}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail ?? "Failed to load inventory report.");
  return json;
}