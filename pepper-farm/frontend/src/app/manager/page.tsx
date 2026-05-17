'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getAnomalySummary } from '@/services/anomalies';
import type { AnomalySummary } from '@/types/anomaly';
import { useLanguage } from '@/context/LanguageContext';

export default function ManagerPage() {
  const [summary, setSummary] = useState<AnomalySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const { t } = useLanguage();

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
          <h1 className="text-2xl font-bold text-gray-800">🌶️ {t.manager.title}</h1>
          <p className="text-gray-500 text-sm mt-1">{t.manager.subtitle}</p>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link href="/manager/users"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">👥 {t.manager.userManagement}</h2>
            <p className="text-sm text-gray-500 mt-1">{t.manager.userManagementSub}</p>
          </Link>
          <Link href="/manager/peppers"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">🌶️ {t.nav.peppers}</h2>
            <p className="text-sm text-gray-500 mt-1">{t.manager.peppersSub}</p>
          </Link>
          <Link href="/manager/products"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">🛒 {t.nav.products}</h2>
            <p className="text-sm text-gray-500 mt-1">{t.manager.productsSub}</p>
          </Link>
          <Link href="/manager/tasks"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">📋 {t.nav.tasks}</h2>
            <p className="text-sm text-gray-500 mt-1">{t.manager.tasksSub}</p>
          </Link>
          <Link href="/manager/inventory"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">📦 {t.nav.inventory}</h2>
            <p className="text-sm text-gray-500 mt-1">{t.manager.inventorySub}</p>
          </Link>
          <Link href="/manager/map"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">🗺️ {t.manager.farmMap}</h2>
            <p className="text-sm text-gray-500 mt-1">{t.manager.farmMapSub}</p>
          </Link>
          <Link href="/manager/reports/open-tasks"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">📊 {t.manager.openTasksReport}</h2>
            <p className="text-sm text-gray-500 mt-1">{t.manager.openTasksReportSub}</p>
          </Link>
          <Link href="/manager/sensors"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            <h2 className="text-lg font-semibold text-gray-800">📡 {t.nav.sensors}</h2>
            <p className="text-sm text-gray-500 mt-1">{t.manager.sensorsSub}</p>
          </Link>
          <Link href="/manager/anomalies"
            className="relative bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition">
            {!summaryLoading && summary && summary.activeAlerts > 0 && (
              <span className="absolute top-4 right-4 inline-flex items-center text-[11px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
                {summary.activeAlerts}
              </span>
            )}
            <h2 className="text-lg font-semibold text-gray-800">🚨 {t.nav.anomalies}</h2>
            <p className="text-sm text-gray-500 mt-1">{t.manager.sensorAnomaliesSub}</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
