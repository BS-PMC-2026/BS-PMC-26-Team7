"use client";

import { InventoryReportRow } from "@/services/reports";
import { useLanguage } from "@/context/LanguageContext";

interface Props {
  rows: InventoryReportRow[];
}

export default function InventoryReportTable({ rows }: Props) {
  const { t } = useLanguage();
  const rp = t.reports;

  const handleExportCsv = () => {
    const headers = [rp.colItem, rp.colCategory, rp.colLocation, rp.colWarehouse, rp.colAllocated, rp.colAvailable, rp.colStatus];
    const csvRows = rows.map((r) => [
      r.DisplayName,
      r.Category,
      r.Location ?? "",
      r.WarehouseQuantity,
      r.AllocatedQuantity,
      r.AvailableQuantity,
      r.LowStock ? rp.lowStockBadge : rp.okBadge,
    ]);
    const csvContent = [headers, ...csvRows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inventory_report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        {rp.noItemsMatch}
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end gap-2 mb-3">
        <button
          onClick={handleExportCsv}
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
        >
          {rp.exportCsv}
        </button>
        <button
          onClick={() => window.print()}
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
        >
          {rp.print}
        </button>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 border-b">{rp.colItem}</th>
              <th className="px-4 py-3 border-b">{rp.colCategory}</th>
              <th className="px-4 py-3 border-b">{rp.colLocation}</th>
              <th className="px-4 py-3 border-b text-right">{rp.colWarehouse}</th>
              <th className="px-4 py-3 border-b text-right">{rp.colAllocated}</th>
              <th className="px-4 py-3 border-b text-right">{rp.colAvailable}</th>
              <th className="px-4 py-3 border-b">{rp.colStatus}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.InventoryId}
                className={`border-b hover:bg-gray-50 ${row.LowStock ? "bg-red-50" : ""}`}
              >
                <td className="px-4 py-3 font-medium text-gray-800">{row.DisplayName}</td>
                <td className="px-4 py-3 text-gray-600">{row.Category}</td>
                <td className="px-4 py-3 text-gray-500">{row.Location ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums" dir="ltr">{row.WarehouseQuantity}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-500" dir="ltr">{row.AllocatedQuantity}</td>
                <td className={`px-4 py-3 text-right tabular-nums font-medium ${row.LowStock ? "text-red-600" : "text-gray-800"}`} dir="ltr">
                  {row.AvailableQuantity}
                </td>
                <td className="px-4 py-3">
                  {row.LowStock ? (
                    <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium">
                      ⚠ {rp.lowStockBadge}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                      ✓ {rp.okBadge}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3" dir="ltr">
        {rp.showingItems} {rows.length} {rows.length === 1 ? t.common.item : t.common.items}{" "}
        · {" "}
        <span className="text-red-600 font-medium">
          {rows.filter((r) => r.LowStock).length} {rp.lowStock.toLowerCase()}
        </span>
      </p>
    </div>
  );
}
