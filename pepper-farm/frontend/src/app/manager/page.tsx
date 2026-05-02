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
    <main className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-bold text-gray-800">🌶️ PepperFarm</h1>
          <p className="text-gray-500 text-sm mt-1">Farm Manager Dashboard</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ── Sensor Anomaly Overview ──────────────────────────── */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Sensor Anomaly Overview
            </h2>
            <Link
              href="/manager/anomalies"
              className="text-xs text-[#2F6F4E] hover:underline font-medium"
            >
              View full dashboard →
            </Link>
          </div>

          {summaryLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 animate-pulse">
                  <div className="h-3 w-24 bg-gray-100 rounded mb-3" />
                  <div className="h-8 w-12 bg-gray-100 rounded mb-2" />
                  <div className="h-3 w-20 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          ) : summary ? (
            <AnomalySummaryCards summary={summary} />
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-400">
              Could not load anomaly data.
            </div>
          )}
        </section>

        {/* ── Navigation cards ─────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
            Management
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Anomaly dashboard card — highlighted with red left border */}
            <Link
              href="/manager/anomalies"
              className="bg-white border border-gray-200 border-l-4 border-l-red-400 rounded-xl p-6 hover:shadow-md transition flex flex-col gap-1"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">🚨 Sensor Anomalies</h2>
                {summary && summary.highSeverity > 0 && (
                  <span className="text-xs font-bold bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                    {summary.highSeverity} High
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">Live anomaly dashboard</p>
              {summary && summary.activeAlerts > 0 && (
                <p className="text-xs text-orange-600 mt-1">
                  {summary.activeAlerts} active alert{summary.activeAlerts !== 1 ? 's' : ''}
                </p>
              )}
            </Link>

            {/* Existing nav cards — preserved exactly as before */}
            {NAV_CARDS.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition"
              >
                <h2 className="text-lg font-semibold text-gray-800">
                  {card.icon} {card.title}
                </h2>
                <p className="text-sm text-gray-500 mt-1">{card.sub}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
