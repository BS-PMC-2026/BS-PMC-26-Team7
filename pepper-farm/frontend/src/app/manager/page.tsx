'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getAnomalySummary } from '@/services/anomalies';
import AnomalySummaryCards from '@/components/anomalies/AnomalySummaryCards';
import type { AnomalySummary } from '@/types/anomaly';

const NAV_CARDS = [
  { href: '/manager/users',              icon: '👥', title: 'User Management',   sub: 'Promote visitors to employees' },
  { href: '/manager/peppers',            icon: '🌶️', title: 'Peppers',           sub: 'Manage pepper varieties' },
  { href: '/manager/products',           icon: '🛒', title: 'Products',          sub: 'View the product catalog' },
  { href: '/manager/tasks',              icon: '📋', title: 'Tasks',             sub: 'Manage farm tasks' },
  { href: '/manager/inventory',          icon: '📦', title: 'Inventory',         sub: 'Update warehouse stock quantities' },
  { href: '/manager/map',                icon: '🗺️', title: 'Farm Map',          sub: 'Update plant locations on map' },
  { href: '/manager/reports/open-tasks', icon: '📊', title: 'Open Tasks Report', sub: 'View all open tasks' },
  { href: '/manager/anomalies',          icon: '📡', title: 'Sensor Anomalies',  sub: 'Live anomaly dashboard' },
];

export default function ManagerPage() {
  const [summary, setSummary] = useState<AnomalySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    getAnomalySummary()
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, []);

  return (
    <main className="min-h-screen">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-bold text-gray-800">🌶️ PepperFarm</h1>
          <p className="text-gray-500 text-sm mt-1">Farm Manager Dashboard</p>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link href="/manager/users"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">👥 User Management</h2>
            <p className="text-sm text-gray-500 mt-1">Promote visitors to employees</p>
          </Link>
          <Link href="/manager/peppers"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">🌶️ Peppers</h2>
            <p className="text-sm text-gray-500 mt-1">Manage pepper varieties</p>
          </Link>
          <Link href="/manager/products"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">🛒 Products</h2>
            <p className="text-sm text-gray-500 mt-1">View the product catalog</p>
          </Link>
          <Link href="/manager/tasks"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">📋 Tasks</h2>
            <p className="text-sm text-gray-500 mt-1">Manage farm tasks</p>
          </Link>
          <Link href="/manager/inventory"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">📦 Inventory</h2>
            <p className="text-sm text-gray-500 mt-1">Update warehouse stock quantities</p>
          </Link>
          <Link href="/manager/map"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">🗺️ Farm Map</h2>
            <p className="text-sm text-gray-500 mt-1">Update plant locations on map</p>
          </Link>
          <Link href="/manager/reports/open-tasks"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">📊 Open Tasks Report</h2>
            <p className="text-sm text-gray-500 mt-1">View all open tasks</p>
          </Link>
          <Link href="/manager/sensors"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">📡 Sensors</h2>
            <p className="text-sm text-gray-500 mt-1">Monitor farm sensors and live readings</p>
          </Link>
          <Link href="/manager/anomalies"
            className="relative bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            {!summaryLoading && summary && summary.activeAlerts > 0 && (
              <span className="absolute top-4 right-4 inline-flex items-center text-[11px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
                {summary.activeAlerts}
              </span>
            )}
            <h2 className="text-lg font-semibold text-gray-800">🚨 Sensor Anomalies</h2>
            <p className="text-sm text-gray-500 mt-1">Live anomaly dashboard</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
