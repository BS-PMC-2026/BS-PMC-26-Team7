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
import { useLanguage } from "@/context/LanguageContext";

export default function InventoryReportPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const rp = t.reports;
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
        setError(err instanceof Error ? err.message : rp.loading);
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
            label={rp.inventoryLabel}
            title={rp.inventoryTitle}
            subtitle={rp.inventorySubtitle}
          />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {error && <Alert className="mb-4">{error}</Alert>}

        {/* Summary cards */}
        {!isLoading && rows.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">{rp.totalItems}</p>
              <p className="text-2xl font-semibold text-gray-800 mt-1" dir="ltr">{rows.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">{rp.lowStock}</p>
              <p className="text-2xl font-semibold text-red-600 mt-1" dir="ltr">{lowStockCount}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">{rp.totalAvailable}</p>
              <p className="text-2xl font-semibold text-gray-800 mt-1" dir="ltr">
                {rows.reduce((sum, r) => sum + r.AvailableQuantity, 0)}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">{rp.category}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="">{rp.allCategories}</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">{rp.sortBy}</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "name" | "quantity" | "category")}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="name">{rp.sortByName}</option>
              <option value="quantity">{rp.sortByQuantity}</option>
              <option value="category">{rp.sortByCategory}</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer py-2">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded"
            />
            {rp.lowStockOnly}
          </label>
        </div>

        {/* Table */}
        {isLoading ? (
          <p className="text-sm text-gray-400 text-center py-12">{rp.loading}</p>
        ) : (
          <InventoryReportTable rows={rows} />
        )}
      </div>
    </div>
  );
}