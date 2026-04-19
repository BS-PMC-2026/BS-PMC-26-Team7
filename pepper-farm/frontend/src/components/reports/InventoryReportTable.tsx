"use client";

import { InventoryReportRow } from "@/services/reports";

interface Props {
  rows: InventoryReportRow[];
}

export default function InventoryReportTable({ rows }: Props) {
  const handleExportCsv = () => {
    const headers = ["Item", "Category", "Location", "Warehouse", "Allocated", "Available", "Status"];
    const csvRows = rows.map((r) => [
      r.DisplayName,
      r.Category,
      r.Location ?? "",
      r.WarehouseQuantity,
      r.AllocatedQuantity,
      r.AvailableQuantity,
      r.LowStock ? "LOW STOCK" : "OK",
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
        No inventory items match the current filters.
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
          📥 Export CSV
        </button>
        <button
          onClick={() => window.print()}
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
        >
          🖨️ Print
        </button>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-600 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 border-b">Item</th>
              <th className="px-4 py-3 border-b">Category</th>
              <th className="px-4 py-3 border-b">Location</th>
              <th className="px-4 py-3 border-b text-right">Warehouse</th>
              <th className="px-4 py-3 border-b text-right">Allocated</th>
              <th className="px-4 py-3 border-b text-right">Available</th>
              <th className="px-4 py-3 border-b">Status</th>
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
                <td className="px-4 py-3 text-right tabular-nums">{row.WarehouseQuantity}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-500">{row.AllocatedQuantity}</td>
                <td className={`px-4 py-3 text-right tabular-nums font-medium ${row.LowStock ? "text-red-600" : "text-gray-800"}`}>
                  {row.AvailableQuantity}
                </td>
                <td className="px-4 py-3">
                  {row.LowStock ? (
                    <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium">
                      ⚠ Low Stock
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                      ✓ OK
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Showing {rows.length} {rows.length === 1 ? "item" : "items"} · {" "}
        <span className="text-red-600 font-medium">
          {rows.filter((r) => r.LowStock).length} low stock
        </span>
      </p>
    </div>
  );
}