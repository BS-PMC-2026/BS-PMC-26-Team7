'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BarChart2, FileText } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import InventoryReportTable from '@/components/reports/InventoryReportTable';
import { getInventoryReport, InventoryReportRow, InventoryReportFilters } from '@/services/reports';
import { getTasksReportByWorker } from '@/services/tasks';
import { getAllUsers, UserData } from '@/services/users';
import { Task } from '@/types/task';

/* -------------------------------------------------------------------------- */
/* Constants                                                                    */
/* -------------------------------------------------------------------------- */

const PRIORITY_COLORS: Record<string, string> = {
  low:      'bg-gray-100 text-gray-600',
  medium:   'bg-yellow-100 text-yellow-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const STATUS_COLORS: Record<string, string> = {
  todo:        'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
};

/* -------------------------------------------------------------------------- */
/* Open Tasks Report tab                                                        */
/* -------------------------------------------------------------------------- */

function OpenTasksReport() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workers, setWorkers] = useState<UserData[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') ?? '' : '';

  useEffect(() => {
    getAllUsers(token)
      .then(users => setWorkers(users.filter(u => u.roleName === 'Worker')))
      .catch(() => setError('Failed to load workers.'));
  }, [token]);

  const handleSearch = async () => {
    if (!selectedWorker) { setError('Please select a worker.'); return; }
    setLoading(true); setError(null);
    try {
      const data = await getTasksReportByWorker(token, Number(selectedWorker));
      setTasks(data);
    } catch { setError('Failed to load report.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6 flex items-center gap-4 flex-wrap">
        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Select Worker:</label>
        <select
          value={selectedWorker}
          onChange={e => setSelectedWorker(e.target.value === '' ? '' : Number(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 w-64"
        >
          <option value="">-- Choose a worker --</option>
          {workers.map(w => <option key={w.userId} value={w.userId}>{w.fullName}</option>)}
        </select>
        <button
          onClick={handleSearch}
          disabled={!selectedWorker || loading}
          className="bg-[#2F6F4E] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#245C3F] disabled:opacity-50 transition"
        >
          {loading ? 'Loading...' : 'Show Report'}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-2 text-sm mb-4">{error}</div>}

      {tasks.length > 0 && (
        <>
          <p className="text-xs text-gray-400 mb-4">{tasks.length} open tasks</p>
          <table className="w-full text-sm border-collapse bg-white rounded-xl shadow overflow-hidden">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600">
                <th className="px-4 py-3 border-b">Title</th>
                <th className="px-4 py-3 border-b">Type</th>
                <th className="px-4 py-3 border-b">Priority</th>
                <th className="px-4 py-3 border-b">Status</th>
                <th className="px-4 py-3 border-b">Due Date</th>
                <th className="px-4 py-3 border-b">Zone</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task.id} className="hover:bg-gray-50 border-b">
                  <td className="px-4 py-3 font-medium text-gray-800">{task.title}</td>
                  <td className="px-4 py-3 text-gray-500">{task.taskType}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[task.priority] ?? 'bg-gray-100 text-gray-600'}`}>{task.priority}</span></td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status] ?? 'bg-gray-100 text-gray-600'}`}>{task.status.replace('_', ' ')}</span></td>
                  <td className="px-4 py-3 text-gray-500">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{task.zoneCode ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {!loading && tasks.length === 0 && selectedWorker && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <p className="text-green-700 font-medium">No open tasks for this worker.</p>
        </div>
      )}

      {!selectedWorker && (
        <div className="text-center py-16 text-gray-400 text-sm">Select a worker above to view their open tasks.</div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Inventory Report tab                                                         */
/* -------------------------------------------------------------------------- */

function InventoryReport() {
  const router = useRouter();
  const [rows, setRows] = useState<InventoryReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'category'>('name');

  const loadReport = useCallback(async (filters: InventoryReportFilters) => {
    const token = localStorage.getItem('token');
    if (!token) { router.replace('/login'); return; }
    setIsLoading(true); setError(null);
    try { setRows(await getInventoryReport(filters)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load inventory report.'); }
    finally { setIsLoading(false); }
  }, [router]);

  useEffect(() => { loadReport({ category, lowStockOnly, sortBy }); }, [loadReport, category, lowStockOnly, sortBy]);

  const categories = useMemo(() => Array.from(new Set(rows.map(r => r.Category))).sort(), [rows]);
  const lowStockCount = rows.filter(r => r.LowStock).length;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {error && <Alert className="mb-4">{error}</Alert>}

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
            <p className="text-2xl font-semibold text-gray-800 mt-1">{rows.reduce((s, r) => s + r.AvailableQuantity, 0)}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Sort by</label>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as 'name' | 'quantity' | 'category')} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
            <option value="name">Item name</option>
            <option value="quantity">Available (low first)</option>
            <option value="category">Category</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer py-2">
          <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)} className="rounded" />
          Show only low stock items
        </label>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400 text-center py-12">Loading report...</p>
      ) : (
        <InventoryReportTable rows={rows} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                         */
/* -------------------------------------------------------------------------- */

function ReportsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get('tab') === 'inventory' ? 'inventory' : 'open-tasks';

  const tabs = [
    { id: 'open-tasks', label: 'Open Tasks Report', icon: <FileText size={14} /> },
    { id: 'inventory',  label: 'Inventory Report',  icon: <BarChart2 size={14} /> },
  ];

  return (
    <>
      <div className="border-b border-gray-200/60">
        <div className="max-w-7xl mx-auto px-6 flex">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => router.replace(`/manager/reports?tab=${tab.id}`)}
              className={`flex items-center gap-1.5 px-5 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-[#2F6F4E] text-[#2F6F4E]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-screen">
        {activeTab === 'open-tasks' ? <OpenTasksReport /> : <InventoryReport />}
      </div>
    </>
  );
}

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsPageContent />
    </Suspense>
  );
}
