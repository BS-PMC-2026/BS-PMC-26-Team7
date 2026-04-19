"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import InventoryReportTable from "@/components/reports/InventoryReportTable";
import PageHeader from "@/components/ui/PageHeader";
import Alert from "@/components/ui/Alert";
import {
  getInventoryReport,
  InventoryReportRow,
  InventoryReportFilters,
} from "@/services/reports";

export default function InventoryReportPage() {
  const router = useRouter();
  const [rows,         setRows]         = useState<InventoryReportRow[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [category,     setCategory]     = useState<string>("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortBy,       setSortBy]       = useState<"name" | "quantity" | "category">("name");

  const loadReport = useCallback(
    async (filters: InventoryReportFilters) => {
      const token = localStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const data = await getInventoryReport(filters);
        setRows(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load inventory report.");
      } finally {
        setIsLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    loadReport({ category, lowStockOnly, sortBy });
  }, [loadReport, category, lowStockOnly, sortBy]);

  const categories = useMemo(() => {
    const set = new Set(rows.map((r) => r.Category));
    return Array.from(set).sort();
  }, [rows]);

  const lowStockCount = rows.filter((r) => r.LowStock).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <PageHeader
            label="Reports"
            title="Inventory Report"
            subtitle="Current stock levels across all items"
          />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {error && <Alert className="mb-4">{error}</Alert>}

        {/* Summary cards */}
        {!isLoading && rows.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Total Items</p>
              <p className="text-2xl font-semibold text-gray-800 mt-1">{rows.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Low Stock</p>
              <p className="text-2xl font-semibold text-red-600 mt-1">{lowStockCount}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Total Available</p>
              <p className="text-2xl font-semibold text-gray-800 mt-1">
                {rows.reduce((sum, r) => sum + r.AvailableQuantity, 0)}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "name" | "quantity" | "category")}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="name">Item name</option>
              <option value="quantity">Available (low first)</option>
              <option value="category">Category</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer py-2">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded"
            />
            Show only low stock items
          </label>
        </div>

        {/* Table */}
        {isLoading ? (
          <p className="text-sm text-gray-400 text-center py-12">Loading report...</p>
        ) : (
          <InventoryReportTable rows={rows} />
        )}
      </div>
    </div>
  );
}