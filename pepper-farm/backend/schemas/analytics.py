from pydantic import BaseModel
from typing import Optional


# ── Task Statistics ────────────────────────────────────────────────────────────

class TaskSummary(BaseModel):
    total: int
    open: int
    completed: int
    overdue: int
    completion_rate: float          # 0–100 %
    avg_completion_hours: Optional[float]   # None when no completed tasks
    # Speed leaderboard (US45) — None when no worker has a completed task.
    fastest_worker: Optional[str] = None
    fastest_worker_hours: Optional[float] = None
    slowest_worker: Optional[str] = None
    slowest_worker_hours: Optional[float] = None


class TaskByStatus(BaseModel):
    status: str
    count: int


class TaskByWorker(BaseModel):
    worker_id: int
    worker_name: str
    total: int
    completed: int
    overdue: int
    completion_rate: float
    avg_completion_hours: Optional[float] = None   # None when worker has no completed task


class TaskByPeriod(BaseModel):
    period: str   # "2026-05-01" / "2026-W18" / "2026-05" / "2026"
    total: int
    completed: int
    overdue: int


class OverdueTaskItem(BaseModel):
    id: int
    title: str
    assignee_name: Optional[str]
    due_date: Optional[str]
    priority: str
    status: str


class TaskStatisticsResponse(BaseModel):
    summary: TaskSummary
    by_status: list[TaskByStatus]
    by_worker: list[TaskByWorker]
    by_period: list[TaskByPeriod]
    overdue_tasks: list[OverdueTaskItem]


# ── Product / Purchase Statistics ─────────────────────────────────────────────

class ProductSummary(BaseModel):
    total_revenue: float
    total_orders: int
    total_units_sold: int
    avg_order_value: float
    unique_buyers: int
    best_selling_product: Optional[str]
    cheapest_sold_product: Optional[str]
    most_expensive_sold_product: Optional[str]


class BestSellingProduct(BaseModel):
    product_id: Optional[int]
    product_name: str
    units_sold: int
    revenue: float
    orders: int


class RevenueByPeriod(BaseModel):
    period: str
    revenue: float
    orders: int
    units_sold: int


class RecentOrder(BaseModel):
    order_id: int
    order_number: str
    buyer_name: Optional[str]
    created_at: str
    total_amount: float
    status: str
    payment_method: str


class ProductStatisticsResponse(BaseModel):
    summary: ProductSummary
    best_selling_products: list[BestSellingProduct]
    revenue_by_period: list[RevenueByPeriod]
    recent_orders: list[RecentOrder]
