import { apiFetch } from "./apiClient";

// ── Inventory report ──────────────────────────────────────────────────────────

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

// ── Task statistics (US45) ────────────────────────────────────────────────────

export interface TaskStatsSummary {
  total: number;
  open: number;
  completed: number;
  overdue: number;
  completion_rate: number;
  avg_completion_hours: number | null;
  fastest_worker: string | null;
  fastest_worker_hours: number | null;
  slowest_worker: string | null;
  slowest_worker_hours: number | null;
}

export interface TaskByStatus {
  status: string;
  count: number;
}

export interface TaskByWorker {
  worker_id: number;
  worker_name: string;
  total: number;
  completed: number;
  overdue: number;
  completion_rate: number;
  avg_completion_hours: number | null;
}

export interface TaskByPeriod {
  period: string;
  total: number;
  completed: number;
  overdue: number;
}

export interface OverdueTaskItem {
  id: number;
  title: string;
  assignee_name: string | null;
  due_date: string | null;
  priority: string;
  status: string;
}

export interface TaskStatisticsResponse {
  summary: TaskStatsSummary;
  by_status: TaskByStatus[];
  by_worker: TaskByWorker[];
  by_period: TaskByPeriod[];
  overdue_tasks: OverdueTaskItem[];
}

export interface TaskStatisticsFilters {
  startDate?: string;
  endDate?: string;
  workerId?: number | '';
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export async function getTaskStatistics(
  filters: TaskStatisticsFilters = {},
): Promise<TaskStatisticsResponse> {
  const params = new URLSearchParams();
  if (filters.startDate)            params.set("start_date", filters.startDate);
  if (filters.endDate)              params.set("end_date", filters.endDate);
  if (filters.workerId)             params.set("worker_id", String(filters.workerId));
  if (filters.period)               params.set("period", filters.period);
  const query = params.toString();
  return apiFetch<TaskStatisticsResponse>(
    `/api/analytics/task-statistics${query ? `?${query}` : ""}`,
  );
}

// ── Product / purchase statistics ─────────────────────────────────────────────

export interface ProductStatsSummary {
  total_revenue: number;
  total_orders: number;
  total_units_sold: number;
  avg_order_value: number;
  unique_buyers: number;
  best_selling_product: string | null;
  cheapest_sold_product: string | null;
  most_expensive_sold_product: string | null;
}

export interface BestSellingProduct {
  product_id: number | null;
  product_name: string;
  units_sold: number;
  revenue: number;
  orders: number;
}

export interface RevenueByPeriod {
  period: string;
  revenue: number;
  orders: number;
  units_sold: number;
}

export interface RecentOrder {
  order_id: number;
  order_number: string;
  buyer_name: string | null;
  created_at: string;
  total_amount: number;
  status: string;
  payment_method: string;
}

export interface ProductStatisticsResponse {
  summary: ProductStatsSummary;
  best_selling_products: BestSellingProduct[];
  revenue_by_period: RevenueByPeriod[];
  recent_orders: RecentOrder[];
}

export interface ProductStatisticsFilters {
  startDate?: string;
  endDate?: string;
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export async function getProductStatistics(
  filters: ProductStatisticsFilters = {},
): Promise<ProductStatisticsResponse> {
  const params = new URLSearchParams();
  if (filters.startDate) params.set("start_date", filters.startDate);
  if (filters.endDate)   params.set("end_date", filters.endDate);
  if (filters.period)    params.set("period", filters.period);
  const query = params.toString();
  return apiFetch<ProductStatisticsResponse>(
    `/api/analytics/product-statistics${query ? `?${query}` : ""}`,
  );
}
