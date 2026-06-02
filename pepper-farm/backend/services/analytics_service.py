from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session

from models.task import Task
from models.order import Order, OrderItem
from models.user import User
from schemas.analytics import (
    BestSellingProduct,
    OverdueTaskItem,
    ProductStatisticsResponse,
    ProductSummary,
    RecentOrder,
    RevenueByPeriod,
    TaskByPeriod,
    TaskByStatus,
    TaskByWorker,
    TaskStatisticsResponse,
    TaskSummary,
)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _to_naive(dt: datetime | None) -> datetime | None:
    """Strip timezone so we can compare safely against SQLite naive datetimes."""
    if dt is None:
        return None
    return dt.replace(tzinfo=None) if dt.tzinfo is not None else dt


def _period_key(dt: datetime | None, period: str) -> str:
    if dt is None:
        return "unknown"
    d = _to_naive(dt)
    if period == "daily":
        return d.strftime("%Y-%m-%d")
    if period == "weekly":
        return d.strftime("%Y-W%W")
    if period == "yearly":
        return d.strftime("%Y")
    return d.strftime("%Y-%m")  # monthly (default)


def _is_overdue(task: Task, now_naive: datetime) -> bool:
    if task.Status in ("done", "cancelled"):
        return False
    due = _to_naive(task.DueDate)
    return due is not None and due < now_naive


# ── Task Statistics ────────────────────────────────────────────────────────────

def get_task_statistics(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    worker_id: Optional[int] = None,
    period: str = "monthly",
) -> TaskStatisticsResponse:
    """
    Aggregate task performance metrics for the analytics dashboard (US45).
    All date comparisons use naive UTC to work with both SQLite and SQL Server.
    """
    now_naive = _to_naive(datetime.now(timezone.utc))

    # Load all tasks (lazy="joined" already loads assigned_to, zone, alert)
    tasks: list[Task] = db.query(Task).all()

    # Python-level filtering for SQLite/SQL Server date-compat
    sd = _to_naive(start_date)
    ed = _to_naive(end_date)
    if sd is not None:
        tasks = [t for t in tasks if _to_naive(t.CreatedAt) is not None and _to_naive(t.CreatedAt) >= sd]
    if ed is not None:
        tasks = [t for t in tasks if _to_naive(t.CreatedAt) is not None and _to_naive(t.CreatedAt) <= ed]
    if worker_id is not None:
        tasks = [t for t in tasks if t.AssignedToUserId == worker_id]

    # ── Summary ──────────────────────────────────────────────────────────────
    total = len(tasks)
    completed = sum(1 for t in tasks if t.Status == "done")
    cancelled = sum(1 for t in tasks if t.Status == "cancelled")
    open_count = total - completed - cancelled
    overdue_count = sum(1 for t in tasks if _is_overdue(t, now_naive))
    completion_rate = round(completed / total * 100, 1) if total > 0 else 0.0

    completion_times_h: list[float] = []
    for t in tasks:
        if t.Status == "done" and t.CompletedAt is not None and t.CreatedAt is not None:
            delta = _to_naive(t.CompletedAt) - _to_naive(t.CreatedAt)
            completion_times_h.append(delta.total_seconds() / 3600)
    avg_completion_hours = (
        round(sum(completion_times_h) / len(completion_times_h), 1)
        if completion_times_h else None
    )

    summary = TaskSummary(
        total=total,
        open=open_count,
        completed=completed,
        overdue=overdue_count,
        completion_rate=completion_rate,
        avg_completion_hours=avg_completion_hours,
    )

    # ── By status ─────────────────────────────────────────────────────────────
    status_counts: dict[str, int] = {}
    for t in tasks:
        status_counts[t.Status] = status_counts.get(t.Status, 0) + 1
    by_status = [TaskByStatus(status=s, count=c) for s, c in sorted(status_counts.items())]

    # ── By worker ─────────────────────────────────────────────────────────────
    worker_buckets: dict[int | None, dict] = {}
    for t in tasks:
        wid = t.AssignedToUserId
        if wid not in worker_buckets:
            wname = t.assigned_to.FullName if t.assigned_to else "Unassigned"
            worker_buckets[wid] = {
                "worker_id": wid if wid is not None else 0,
                "worker_name": wname,
                "total": 0, "completed": 0, "overdue": 0,
            }
        worker_buckets[wid]["total"] += 1
        if t.Status == "done":
            worker_buckets[wid]["completed"] += 1
        if _is_overdue(t, now_naive):
            worker_buckets[wid]["overdue"] += 1

    by_worker = []
    for w in worker_buckets.values():
        rate = round(w["completed"] / w["total"] * 100, 1) if w["total"] > 0 else 0.0
        by_worker.append(TaskByWorker(**w, completion_rate=rate))
    by_worker.sort(key=lambda x: x.total, reverse=True)

    # ── By period ─────────────────────────────────────────────────────────────
    period_buckets: dict[str, dict] = {}
    for t in tasks:
        key = _period_key(t.CreatedAt, period)
        if key not in period_buckets:
            period_buckets[key] = {"total": 0, "completed": 0, "overdue": 0}
        period_buckets[key]["total"] += 1
        if t.Status == "done":
            period_buckets[key]["completed"] += 1
        if _is_overdue(t, now_naive):
            period_buckets[key]["overdue"] += 1
    by_period = [
        TaskByPeriod(period=k, **v)
        for k, v in sorted(period_buckets.items())
    ]

    # ── Overdue task list ─────────────────────────────────────────────────────
    overdue_tasks = [
        OverdueTaskItem(
            id=t.Id,
            title=t.Title,
            assignee_name=t.assigned_to.FullName if t.assigned_to else None,
            due_date=_to_naive(t.DueDate).isoformat() if t.DueDate else None,
            priority=t.Priority,
            status=t.Status,
        )
        for t in tasks
        if _is_overdue(t, now_naive)
    ]

    return TaskStatisticsResponse(
        summary=summary,
        by_status=by_status,
        by_worker=by_worker,
        by_period=by_period,
        overdue_tasks=overdue_tasks,
    )


# ── Product / Purchase Statistics ─────────────────────────────────────────────

def get_product_statistics(
    db: Session,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    period: str = "monthly",
) -> ProductStatisticsResponse:
    """
    Aggregate product purchase metrics for the analytics dashboard.
    Counts only paid orders; filters by CreatedAtUtc when date range given.
    """
    # Load paid orders (Python-level date filter for SQLite compat)
    all_paid: list[Order] = db.query(Order).filter(Order.Status == "paid").all()

    sd = _to_naive(start_date)
    ed = _to_naive(end_date)
    if sd is not None:
        all_paid = [o for o in all_paid if _to_naive(o.CreatedAtUtc) is not None and _to_naive(o.CreatedAtUtc) >= sd]
    if ed is not None:
        all_paid = [o for o in all_paid if _to_naive(o.CreatedAtUtc) is not None and _to_naive(o.CreatedAtUtc) <= ed]

    order_ids = [o.OrderId for o in all_paid]
    items: list[OrderItem] = (
        db.query(OrderItem).filter(OrderItem.OrderId.in_(order_ids)).all()
        if order_ids else []
    )

    # ── Summary ──────────────────────────────────────────────────────────────
    total_revenue = float(sum(o.TotalAmount for o in all_paid))
    total_orders = len(all_paid)
    total_units = sum(i.Quantity for i in items)
    avg_order_value = round(total_revenue / total_orders, 2) if total_orders > 0 else 0.0
    unique_buyers = len({o.UserId for o in all_paid})

    # Per-product aggregation
    prod_map: dict[str, dict] = {}
    for item in items:
        name = item.ProductNameSnapshot
        if name not in prod_map:
            prod_map[name] = {
                "product_id": item.ProductId,
                "units": 0, "revenue": 0.0,
                "orders": set(), "prices": [],
            }
        prod_map[name]["units"] += item.Quantity
        prod_map[name]["revenue"] += float(item.LineTotal)
        prod_map[name]["orders"].add(item.OrderId)
        price = float(item.UnitPriceAfterProductDiscount)
        if price > 0:
            prod_map[name]["prices"].append(price)

    best_selling_name: Optional[str] = None
    cheapest_name: Optional[str] = None
    most_expensive_name: Optional[str] = None

    if prod_map:
        best_selling_name = max(prod_map, key=lambda k: prod_map[k]["units"])
        # Cheapest / most expensive by avg unit price (only products with valid price)
        priced = {n: sum(d["prices"]) / len(d["prices"]) for n, d in prod_map.items() if d["prices"]}
        if priced:
            cheapest_name = min(priced, key=lambda k: priced[k])
            most_expensive_name = max(priced, key=lambda k: priced[k])

    summary = ProductSummary(
        total_revenue=round(total_revenue, 2),
        total_orders=total_orders,
        total_units_sold=total_units,
        avg_order_value=avg_order_value,
        unique_buyers=unique_buyers,
        best_selling_product=best_selling_name,
        cheapest_sold_product=cheapest_name,
        most_expensive_sold_product=most_expensive_name,
    )

    # ── Best selling products ─────────────────────────────────────────────────
    best_selling = sorted(
        [
            BestSellingProduct(
                product_id=d["product_id"],
                product_name=name,
                units_sold=d["units"],
                revenue=round(d["revenue"], 2),
                orders=len(d["orders"]),
            )
            for name, d in prod_map.items()
        ],
        key=lambda x: x.units_sold,
        reverse=True,
    )[:10]

    # ── Revenue by period ─────────────────────────────────────────────────────
    period_map: dict[str, dict] = {}
    for order in all_paid:
        key = _period_key(order.CreatedAtUtc, period)
        if key not in period_map:
            period_map[key] = {"revenue": 0.0, "orders": 0, "units_sold": 0}
        period_map[key]["revenue"] += float(order.TotalAmount)
        period_map[key]["orders"] += 1

    orders_by_id = {o.OrderId: o for o in all_paid}
    for item in items:
        order = orders_by_id.get(item.OrderId)
        if order:
            key = _period_key(order.CreatedAtUtc, period)
            period_map[key]["units_sold"] += item.Quantity

    revenue_by_period = [
        RevenueByPeriod(
            period=k,
            revenue=round(v["revenue"], 2),
            orders=v["orders"],
            units_sold=v["units_sold"],
        )
        for k, v in sorted(period_map.items())
    ]

    # ── Recent orders ─────────────────────────────────────────────────────────
    recent = sorted(all_paid, key=lambda o: o.CreatedAtUtc or datetime.min, reverse=True)[:10]
    user_ids = list({o.UserId for o in recent})
    user_map: dict[int, str] = {}
    if user_ids:
        users = db.query(User).filter(User.UserId.in_(user_ids)).all()
        user_map = {u.UserId: u.FullName for u in users}

    recent_orders = [
        RecentOrder(
            order_id=o.OrderId,
            order_number=o.OrderNumber,
            buyer_name=user_map.get(o.UserId),
            created_at=(_to_naive(o.CreatedAtUtc) or datetime.min).isoformat(),
            total_amount=float(o.TotalAmount),
            status=o.Status,
            payment_method=o.PaymentMethod,
        )
        for o in recent
    ]

    return ProductStatisticsResponse(
        summary=summary,
        best_selling_products=best_selling,
        revenue_by_period=revenue_by_period,
        recent_orders=recent_orders,
    )
