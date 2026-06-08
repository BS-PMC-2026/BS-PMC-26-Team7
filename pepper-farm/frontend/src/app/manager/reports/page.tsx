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
  low:      'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
  medium:   'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
};

const STATUS_COLORS: Record<string, string> = {
  todo:        'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
  in_progress: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
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
      <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm p-4 mb-6 flex items-center gap-4 flex-wrap">
        <label className="text-sm font-medium text-[var(--color-foreground)] whitespace-nowrap">Select Worker:</label>
        <select
          value={selectedWorker}
          onChange={e => setSelectedWorker(e.target.value === '' ? '' : Number(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] w-64"
        >
          <option value="">-- Choose a worker --</option>
          {workers.map(w => <option key={w.userId} value={w.userId}>{w.fullName}</option>)}
        </select>
        <button
          onClick={handleSearch}
          disabled={!selectedWorker || loading}
          className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
        >
          {loading ? 'Loading...' : 'Show Report'}
        </button>
      </div>

      {error && <div className="bg-[var(--color-error-bg)] border border-[var(--color-border)] text-[var(--color-error)] rounded-lg px-4 py-2 text-sm mb-4">{error}</div>}

      {tasks.length > 0 && (
        <>
          <p className="text-xs text-[var(--color-muted-foreground)] mb-4">{tasks.length} open tasks</p>
          <table className="w-full text-sm border-collapse bg-white rounded-xl shadow overflow-hidden">
            <thead>
              <tr className="bg-[var(--color-muted)] text-left text-[var(--color-muted-foreground)]">
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
                <tr key={task.id} className="hover:bg-[var(--color-muted)] border-b">
                  <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">{task.title}</td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{task.taskType}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[task.priority] ?? 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'}`}>{task.priority}</span></td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status] ?? 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'}`}>{task.status.replace('_', ' ')}</span></td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{task.zoneCode ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {!loading && tasks.length === 0 && selectedWorker && (
        <div className="bg-[var(--color-secondary-light)] border border-[var(--color-border)] rounded-xl p-8 text-center">
          <p className="text-[var(--color-primary)] font-medium">No open tasks for this worker.</p>
        </div>
      )}

      {!selectedWorker && (
        <div className="text-center py-16 text-[var(--color-muted-foreground)] text-sm">Select a worker above to view their open tasks.</div>
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
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
            <p className="text-xs text-[var(--color-muted-foreground)] uppercase tracking-wider">Total Items</p>
            <p className="text-2xl font-semibold text-[var(--color-foreground)] mt-1">{rows.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
            <p className="text-xs text-[var(--color-muted-foreground)] uppercase tracking-wider">Low Stock</p>
            <p className="text-2xl font-semibold text-[var(--color-error)] mt-1">{lowStockCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
            <p className="text-xs text-[var(--color-muted-foreground)] uppercase tracking-wider">Total Available</p>
            <p className="text-2xl font-semibold text-[var(--color-foreground)] mt-1">{rows.reduce((s, r) => s + r.AvailableQuantity, 0)}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 mb-4 flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--color-muted-foreground)]">Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--color-muted-foreground)]">Sort by</label>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as 'name' | 'quantity' | 'category')} className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
            <option value="name">Item name</option>
            <option value="quantity">Available (low first)</option>
            <option value="category">Category</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--color-foreground)] cursor-pointer py-2">
          <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)} className="rounded" />
          Show only low stock items
        </label>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--color-muted-foreground)] text-center py-12">Loading report...</p>
      ) : (
        <InventoryReportTable rows={rows} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Task Statistics tab (US45)                                                   */
/* -------------------------------------------------------------------------- */

function TaskStatisticsReport() {
  const [data, setData]           = useState<TaskStatisticsResponse | null>(null);
  const [workers, setWorkers]     = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');
  const [workerId,  setWorkerId]  = useState<number | ''>('');
  const [period, setPeriod]       = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') ?? '' : '';

  useEffect(() => {
    getAllUsers(token)
      .then(users => setWorkers(users.filter(u => u.roleName === 'Worker')))
      .catch(() => {/* non-fatal: filter just won't populate */});
  }, [token]);

  // Sequence guard: only the most-recent request may update state, so the
  // displayed data always matches the latest filters even if an earlier
  // (slower) request resolves out of order.
  const reqIdRef = useRef(0);

  const loadStats = useCallback(async (filters: TaskStatisticsFilters) => {
    const reqId = ++reqIdRef.current;
    setIsLoading(true); setError(null);
    try {
      const result = await getTaskStatistics(filters);
      if (reqId === reqIdRef.current) setData(result);
    } catch (err) {
      if (reqId === reqIdRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load task statistics.');
      }
    } finally {
      if (reqId === reqIdRef.current) setIsLoading(false);
    }
  }, []);

  // Validate date range before firing the request. Same-day (start === end) is
  // allowed; only start strictly after end is invalid.
  const dateError = useMemo(() => {
    if (startDate && endDate && startDate > endDate) return 'Start date cannot be after end date.';
    return null;
  }, [startDate, endDate]);

  useEffect(() => {
    if (dateError) return;
    loadStats({ startDate: startDate || undefined, endDate: endDate || undefined, workerId: workerId || undefined, period });
  }, [loadStats, startDate, endDate, workerId, period, dateError]);

  const s = data?.summary;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8" data-testid="task-statistics-tab">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--color-muted-foreground)]">Worker</label>
          <select
            value={workerId}
            onChange={e => setWorkerId(e.target.value === '' ? '' : Number(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            data-testid="filter-worker"
          >
            <option value="">All workers</option>
            {workers.map(w => <option key={w.userId} value={w.userId}>{w.fullName}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--color-muted-foreground)]">Start date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            data-testid="filter-start-date" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--color-muted-foreground)]">End date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            data-testid="filter-end-date" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--color-muted-foreground)]">Period</label>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value as typeof period)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            data-testid="filter-period"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>

      {/* Honest reflection of the filter actually sent to the API, derived from
          the same state. Empty inputs mean "all dates" (the default) — never
          today — so the displayed range always matches the applied range. */}
      {!dateError && (
        <p className="text-xs text-[var(--color-muted-foreground)] mb-4" data-testid="active-date-filter">
          {startDate || endDate
            ? `Showing tasks created ${startDate || '…'} → ${endDate || '…'}`
            : 'Showing tasks created across all dates'}
        </p>
      )}

      {dateError && <div className="bg-[var(--color-error-bg)] text-[var(--color-error)] rounded-lg px-4 py-2 text-sm mb-4" data-testid="date-error">{dateError}</div>}
      {error     && <div className="bg-[var(--color-error-bg)] text-[var(--color-error)] rounded-lg px-4 py-2 text-sm mb-4" data-testid="stats-error">{error}</div>}

      {isLoading ? (
        <p className="text-sm text-[var(--color-muted-foreground)] text-center py-12">Loading statistics...</p>
      ) : s && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6" data-testid="kpi-cards">
            <KpiCard label="Total Tasks"      value={s.total} />
            <KpiCard label="Open Tasks"       value={s.open} />
            <KpiCard label="Completed"        value={s.completed} valueClass="text-green-600" />
            <KpiCard label="Overdue"          value={s.overdue}   valueClass={s.overdue > 0 ? 'text-[var(--color-error)]' : undefined} />
            <KpiCard label="Completion Rate"  value={`${s.completion_rate}%`} />
            <KpiCard label="Avg Completion"
              value={s.avg_completion_hours != null ? `${s.avg_completion_hours}h` : '—'}
              sub="avg hours to complete" />
          </div>

          {/* Completion speed — fastest vs slowest worker (US45).
              Only meaningful when comparing across workers: shown for
              "All workers" with at least two different workers who have
              completed tasks. For a single selected worker (or when only one
              worker has completions) the comparison is hidden — that worker's
              average is already in the "Avg Completion" card and the table. */}
          {workerId === '' && s.fastest_worker && s.slowest_worker
            && s.fastest_worker !== s.slowest_worker && (
            <>
              <SectionTitle>Completion Speed</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2" data-testid="speed-cards">
                <KpiCard label="Fastest Worker"
                  value={s.fastest_worker ?? '—'}
                  sub={s.fastest_worker_hours != null ? `avg ${s.fastest_worker_hours}h per task` : undefined}
                  valueClass="text-green-600" />
                <KpiCard label="Slowest Worker"
                  value={s.slowest_worker ?? '—'}
                  sub={s.slowest_worker_hours != null ? `avg ${s.slowest_worker_hours}h per task` : undefined}
                  valueClass="text-[var(--color-error)]" />
              </div>
            </>
          )}

          {/* By status */}
          {data.by_status.length > 0 && (
            <>
              <SectionTitle>Tasks by Status</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
                {data.by_status.map(r => (
                  <div key={r.status} className="bg-white rounded-xl border border-[var(--color-border)] p-3 flex justify-between items-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] ?? 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                    <span className="text-lg font-semibold text-[var(--color-foreground)]">{r.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* By worker */}
          {data.by_worker.length > 0 && (
            <>
              <SectionTitle>Employee Performance</SectionTitle>
              <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden mb-2">
                <table className="w-full text-sm border-collapse" data-testid="worker-table">
                  <thead>
                    <tr className="bg-[var(--color-muted)] text-left text-[var(--color-muted-foreground)]">
                      <th className="px-4 py-3 border-b">Worker</th>
                      <th className="px-4 py-3 border-b text-right">Total</th>
                      <th className="px-4 py-3 border-b text-right">Completed</th>
                      <th className="px-4 py-3 border-b text-right">Overdue</th>
                      <th className="px-4 py-3 border-b text-right">Rate</th>
                      <th className="px-4 py-3 border-b text-right">Avg Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_worker.map((w, i) => (
                      <tr key={i} className="hover:bg-[var(--color-muted)] border-b">
                        <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">{w.worker_name}</td>
                        <td className="px-4 py-3 text-right">{w.total}</td>
                        <td className="px-4 py-3 text-right text-green-600">{w.completed}</td>
                        <td className="px-4 py-3 text-right text-[var(--color-error)]">{w.overdue}</td>
                        <td className="px-4 py-3 text-right font-medium">{w.completion_rate}%</td>
                        <td className="px-4 py-3 text-right text-[var(--color-muted-foreground)]">
                          {w.avg_completion_hours != null ? `${w.avg_completion_hours}h` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* By period */}
          {data.by_period.length > 0 && (
            <>
              <SectionTitle>Completion Trend ({period})</SectionTitle>
              <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden mb-2">
                <table className="w-full text-sm border-collapse" data-testid="period-table">
                  <thead>
                    <tr className="bg-[var(--color-muted)] text-left text-[var(--color-muted-foreground)]">
                      <th className="px-4 py-3 border-b">Period</th>
                      <th className="px-4 py-3 border-b text-right">Total</th>
                      <th className="px-4 py-3 border-b text-right">Completed</th>
                      <th className="px-4 py-3 border-b text-right">Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_period.map((p, i) => (
                      <tr key={i} className="hover:bg-[var(--color-muted)] border-b">
                        <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">{p.period}</td>
                        <td className="px-4 py-3 text-right">{p.total}</td>
                        <td className="px-4 py-3 text-right text-green-600">{p.completed}</td>
                        <td className="px-4 py-3 text-right text-[var(--color-error)]">{p.overdue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Overdue tasks */}
          {data.overdue_tasks.length > 0 && (
            <>
              <SectionTitle>Overdue Tasks ({data.overdue_tasks.length})</SectionTitle>
              <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
                <table className="w-full text-sm border-collapse" data-testid="overdue-table">
                  <thead>
                    <tr className="bg-[var(--color-error-bg)] text-left text-[var(--color-error)]">
                      <th className="px-4 py-3 border-b">Title</th>
                      <th className="px-4 py-3 border-b">Assignee</th>
                      <th className="px-4 py-3 border-b">Due Date</th>
                      <th className="px-4 py-3 border-b">Priority</th>
                      <th className="px-4 py-3 border-b">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.overdue_tasks.map(t => (
                      <tr key={t.id} className="hover:bg-[var(--color-muted)] border-b">
                        <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">{t.title}</td>
                        <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{t.assignee_name ?? '—'}</td>
                        <td className="px-4 py-3 text-[var(--color-error)]">
                          {t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[t.priority] ?? ''}`}>{t.priority}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] ?? ''}`}>{t.status.replace('_', ' ')}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Empty state */}
          {s.total === 0 && (
            <div className="bg-[var(--color-secondary-light)] border border-[var(--color-border)] rounded-xl p-10 text-center" data-testid="empty-state">
              <p className="text-[var(--color-primary)] font-medium">No tasks found for the selected filters.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Product Statistics tab                                                       */
/* -------------------------------------------------------------------------- */

function ProductStatisticsReport() {
  const [data, setData]           = useState<ProductStatisticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');
  const [period, setPeriod]       = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');

  const loadStats = useCallback(async (filters: ProductStatisticsFilters) => {
    setIsLoading(true); setError(null);
    try { setData(await getProductStatistics(filters)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load product statistics.'); }
    finally { setIsLoading(false); }
  }, []);

  const dateError = useMemo(() => {
    if (startDate && endDate && startDate > endDate) return 'Start date must be before end date.';
    return null;
  }, [startDate, endDate]);

  useEffect(() => {
    if (dateError) return;
    loadStats({ startDate: startDate || undefined, endDate: endDate || undefined, period });
  }, [loadStats, startDate, endDate, period, dateError]);

  const s = data?.summary;

  const fmtCurrency = (n: number) =>
    `₪${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8" data-testid="product-statistics-tab">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--color-muted-foreground)]">Start date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            data-testid="prod-filter-start-date" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--color-muted-foreground)]">End date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            data-testid="prod-filter-end-date" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--color-muted-foreground)]">Period</label>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value as typeof period)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            data-testid="prod-filter-period"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>

      {dateError && <div className="bg-[var(--color-error-bg)] text-[var(--color-error)] rounded-lg px-4 py-2 text-sm mb-4" data-testid="prod-date-error">{dateError}</div>}
      {error     && <div className="bg-[var(--color-error-bg)] text-[var(--color-error)] rounded-lg px-4 py-2 text-sm mb-4" data-testid="prod-stats-error">{error}</div>}

      {isLoading ? (
        <p className="text-sm text-[var(--color-muted-foreground)] text-center py-12">Loading statistics...</p>
      ) : s && (
        <>
          {/* KPI cards */}
          <div data-testid="prod-kpi-cards">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
              <KpiCard label="Total Revenue"  value={fmtCurrency(s.total_revenue)} valueClass="text-green-600" />
              <KpiCard label="Total Orders"   value={s.total_orders} />
              <KpiCard label="Units Sold"     value={s.total_units_sold} />
              <KpiCard label="Avg Order"      value={fmtCurrency(s.avg_order_value)} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <KpiCard label="Unique Buyers"   value={s.unique_buyers} />
              <KpiCard label="Best Selling"    value={s.best_selling_product ?? '—'} />
              <KpiCard label="Cheapest Sold"   value={s.cheapest_sold_product ?? '—'} />
              <KpiCard label="Most Expensive"  value={s.most_expensive_sold_product ?? '—'} />
            </div>
          </div>

          {/* Best selling products */}
          {data.best_selling_products.length > 0 && (
            <>
              <SectionTitle>Best Selling Products</SectionTitle>
              <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden mb-2">
                <table className="w-full text-sm border-collapse" data-testid="best-selling-table">
                  <thead>
                    <tr className="bg-[var(--color-muted)] text-left text-[var(--color-muted-foreground)]">
                      <th className="px-4 py-3 border-b">#</th>
                      <th className="px-4 py-3 border-b">Product</th>
                      <th className="px-4 py-3 border-b text-right">Units Sold</th>
                      <th className="px-4 py-3 border-b text-right">Revenue</th>
                      <th className="px-4 py-3 border-b text-right">Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.best_selling_products.map((p, i) => (
                      <tr key={i} className="hover:bg-[var(--color-muted)] border-b">
                        <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">{p.product_name}</td>
                        <td className="px-4 py-3 text-right font-medium">{p.units_sold}</td>
                        <td className="px-4 py-3 text-right text-green-600">{fmtCurrency(p.revenue)}</td>
                        <td className="px-4 py-3 text-right">{p.orders}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Revenue by period */}
          {data.revenue_by_period.length > 0 && (
            <>
              <SectionTitle>Revenue by {period.charAt(0).toUpperCase() + period.slice(1)}</SectionTitle>
              <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden mb-2">
                <table className="w-full text-sm border-collapse" data-testid="revenue-period-table">
                  <thead>
                    <tr className="bg-[var(--color-muted)] text-left text-[var(--color-muted-foreground)]">
                      <th className="px-4 py-3 border-b">Period</th>
                      <th className="px-4 py-3 border-b text-right">Revenue</th>
                      <th className="px-4 py-3 border-b text-right">Orders</th>
                      <th className="px-4 py-3 border-b text-right">Units Sold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.revenue_by_period.map((r, i) => (
                      <tr key={i} className="hover:bg-[var(--color-muted)] border-b">
                        <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">{r.period}</td>
                        <td className="px-4 py-3 text-right text-green-600">{fmtCurrency(r.revenue)}</td>
                        <td className="px-4 py-3 text-right">{r.orders}</td>
                        <td className="px-4 py-3 text-right">{r.units_sold}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Recent orders */}
          {data.recent_orders.length > 0 && (
            <>
              <SectionTitle>Recent Orders</SectionTitle>
              <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
                <table className="w-full text-sm border-collapse" data-testid="recent-orders-table">
                  <thead>
                    <tr className="bg-[var(--color-muted)] text-left text-[var(--color-muted-foreground)]">
                      <th className="px-4 py-3 border-b">Order #</th>
                      <th className="px-4 py-3 border-b">Buyer</th>
                      <th className="px-4 py-3 border-b">Date</th>
                      <th className="px-4 py-3 border-b text-right">Total</th>
                      <th className="px-4 py-3 border-b">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_orders.map(o => (
                      <tr key={o.order_id} className="hover:bg-[var(--color-muted)] border-b">
                        <td className="px-4 py-3 text-xs text-[var(--color-muted-foreground)]">{o.order_number}</td>
                        <td className="px-4 py-3 font-medium text-[var(--color-foreground)]">{o.buyer_name ?? '—'}</td>
                        <td className="px-4 py-3 text-[var(--color-muted-foreground)]">{new Date(o.created_at + 'Z').toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right text-green-600 font-medium">{fmtCurrency(o.total_amount)}</td>
                        <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                          {o.payment_method.replace(/_/g, ' ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Empty state */}
          {s.total_orders === 0 && (
            <div className="bg-[var(--color-secondary-light)] border border-[var(--color-border)] rounded-xl p-10 text-center" data-testid="prod-empty-state">
              <p className="text-[var(--color-primary)] font-medium">No paid orders found for the selected date range.</p>
            </div>
          )}
        </>
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
      <div className="border-b border-[var(--color-border)]/60">
        <div className="max-w-7xl mx-auto px-6 flex">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => router.replace(`/manager/reports?tab=${tab.id}`)}
              className={`flex items-center gap-1.5 px-5 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:border-[var(--color-border)]'
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
