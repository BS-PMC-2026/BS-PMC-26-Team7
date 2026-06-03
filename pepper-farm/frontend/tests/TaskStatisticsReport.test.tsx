/**
 * Tests for the Task Statistics tab in /manager/reports (US45).
 */
import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

/* ── Mocks ─────────────────────────────────────────────────────────────────── */

jest.mock('next/navigation', () => ({
  useRouter:      () => ({ replace: jest.fn() }),
  useSearchParams: () => ({ get: (key: string) => key === 'tab' ? 'task-statistics' : null }),
}));

const mockGetTaskStatistics = jest.fn();
const mockGetInventoryReport = jest.fn();
const mockGetProductStatistics = jest.fn();

jest.mock('@/services/reports', () => ({
  getInventoryReport:    (...a: unknown[]) => mockGetInventoryReport(...a),
  getTaskStatistics:     (...a: unknown[]) => mockGetTaskStatistics(...a),
  getProductStatistics:  (...a: unknown[]) => mockGetProductStatistics(...a),
}));

jest.mock('@/services/users', () => ({
  getAllUsers: () => Promise.resolve([
    { userId: 1, fullName: 'Bob Worker', email: 'bob@farm.com', roleName: 'Worker', isActive: true },
  ]),
}));

jest.mock('@/services/tasks', () => ({
  getTasksReportByWorker: () => Promise.resolve([]),
}));

jest.mock('@/components/reports/InventoryReportTable', () => ({
  __esModule: true,
  default: () => <div data-testid="inventory-table" />,
}));

/* ── Import page after mocks ────────────────────────────────────────────────── */
import ReportsPage from '@/app/manager/reports/page';

/* ── Fixtures ───────────────────────────────────────────────────────────────── */

const EMPTY_STATS = {
  summary: {
    total: 0, open: 0, completed: 0, overdue: 0, completion_rate: 0, avg_completion_hours: null,
    fastest_worker: null, fastest_worker_hours: null, slowest_worker: null, slowest_worker_hours: null,
  },
  by_status: [],
  by_worker: [],
  by_period: [],
  overdue_tasks: [],
};

const STATS_WITH_DATA = {
  summary: {
    total: 10, open: 5, completed: 4, overdue: 2, completion_rate: 40.0, avg_completion_hours: 3.5,
    fastest_worker: 'Bob Worker', fastest_worker_hours: 2.0,
    slowest_worker: 'Carol Worker', slowest_worker_hours: 6.0,
  },
  by_status: [
    { status: 'todo',        count: 3 },
    { status: 'in_progress', count: 2 },
    { status: 'done',        count: 4 },
    { status: 'cancelled',   count: 1 },
  ],
  by_worker: [
    { worker_id: 1, worker_name: 'Bob Worker',   total: 10, completed: 4, overdue: 2, completion_rate: 40.0, avg_completion_hours: 2.0 },
    { worker_id: 2, worker_name: 'Carol Worker', total: 3,  completed: 2, overdue: 0, completion_rate: 66.7, avg_completion_hours: 6.0 },
  ],
  by_period: [
    { period: '2026-05', total: 6, completed: 3, overdue: 1 },
    { period: '2026-06', total: 4, completed: 1, overdue: 1 },
  ],
  overdue_tasks: [
    { id: 1, title: 'Water Zone A', assignee_name: 'Bob Worker', due_date: '2026-05-31', priority: 'high', status: 'todo' },
    { id: 2, title: 'Inspect Sensors', assignee_name: null, due_date: '2026-05-28', priority: 'medium', status: 'in_progress' },
  ],
};

/* ── Tests ──────────────────────────────────────────────────────────────────── */

describe('Task Statistics Report tab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: product stats returns empty to avoid extra noise
    mockGetProductStatistics.mockResolvedValue({
      summary: { total_revenue: 0, total_orders: 0, total_units_sold: 0, avg_order_value: 0, unique_buyers: 0, best_selling_product: null, cheapest_sold_product: null, most_expensive_sold_product: null },
      best_selling_products: [],
      revenue_by_period: [],
      recent_orders: [],
    });
  });

  it('renders the task statistics tab', async () => {
    mockGetTaskStatistics.mockResolvedValue(EMPTY_STATS);
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('task-statistics-tab')).toBeInTheDocument();
    });
  });

  it('shows KPI summary cards when data is loaded', async () => {
    mockGetTaskStatistics.mockResolvedValue(STATS_WITH_DATA);
    render(<ReportsPage />);
    await waitFor(() => {
      const kpi = screen.getByTestId('kpi-cards');
      expect(kpi).toBeInTheDocument();
      // Scope to the KPI container to avoid collisions with table cells
      expect(within(kpi).getByText('10')).toBeInTheDocument();   // total
      expect(within(kpi).getByText('40%')).toBeInTheDocument();  // completion rate
      expect(within(kpi).getByText('3.5h')).toBeInTheDocument(); // avg completion
    });
  });

  it('shows the worker performance table', async () => {
    mockGetTaskStatistics.mockResolvedValue(STATS_WITH_DATA);
    render(<ReportsPage />);
    await waitFor(() => {
      const table = screen.getByTestId('worker-table');
      expect(table).toBeInTheDocument();
      expect(within(table).getByText('Bob Worker')).toBeInTheDocument();
    });
  });

  it('shows the period trend table', async () => {
    mockGetTaskStatistics.mockResolvedValue(STATS_WITH_DATA);
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('period-table')).toBeInTheDocument();
      expect(screen.getByText('2026-05')).toBeInTheDocument();
      expect(screen.getByText('2026-06')).toBeInTheDocument();
    });
  });

  it('shows the overdue tasks table', async () => {
    mockGetTaskStatistics.mockResolvedValue(STATS_WITH_DATA);
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('overdue-table')).toBeInTheDocument();
      expect(screen.getByText('Water Zone A')).toBeInTheDocument();
      expect(screen.getByText('Inspect Sensors')).toBeInTheDocument();
    });
  });

  it('shows empty state when no tasks', async () => {
    mockGetTaskStatistics.mockResolvedValue(EMPTY_STATS);
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  it('shows error message when API call fails', async () => {
    mockGetTaskStatistics.mockRejectedValue(new Error('Server error'));
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('stats-error')).toHaveTextContent('Server error');
    });
  });

  it('shows date validation error for invalid range', async () => {
    mockGetTaskStatistics.mockResolvedValue(EMPTY_STATS);
    render(<ReportsPage />);
    await waitFor(() => screen.getByTestId('filter-start-date'));

    fireEvent.change(screen.getByTestId('filter-start-date'), { target: { value: '2026-06-01' } });
    fireEvent.change(screen.getByTestId('filter-end-date'),   { target: { value: '2026-05-01' } });

    await waitFor(() => {
      expect(screen.getByTestId('date-error')).toBeInTheDocument();
    });
  });

  it('shows avg completion as em-dash when no completed tasks', async () => {
    mockGetTaskStatistics.mockResolvedValue({
      ...STATS_WITH_DATA,
      summary: { ...STATS_WITH_DATA.summary, avg_completion_hours: null },
    });
    render(<ReportsPage />);
    await waitFor(() => {
      const kpi = screen.getByTestId('kpi-cards');
      expect(kpi).toBeInTheDocument();
      // The avg completion KPI card shows '—'; scope to KPI container
      expect(within(kpi).getByText('—')).toBeInTheDocument();
    });
  });

  it('the tab button is rendered with correct label', async () => {
    mockGetTaskStatistics.mockResolvedValue(EMPTY_STATS);
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('tab-task-statistics')).toHaveTextContent('Task Statistics');
    });
  });

  it('shows fastest and slowest worker speed cards', async () => {
    mockGetTaskStatistics.mockResolvedValue(STATS_WITH_DATA);
    render(<ReportsPage />);
    await waitFor(() => {
      const speed = screen.getByTestId('speed-cards');
      expect(within(speed).getByText('Bob Worker')).toBeInTheDocument();   // fastest
      expect(within(speed).getByText('Carol Worker')).toBeInTheDocument(); // slowest
      expect(within(speed).getByText('avg 2h per task')).toBeInTheDocument();
      expect(within(speed).getByText('avg 6h per task')).toBeInTheDocument();
    });
  });

  it('hides the speed comparison when a specific worker is selected', async () => {
    mockGetTaskStatistics.mockResolvedValue(STATS_WITH_DATA);
    render(<ReportsPage />);
    // Visible for "All workers"
    await waitFor(() => expect(screen.getByTestId('speed-cards')).toBeInTheDocument());

    // Selecting a single worker hides the fastest-vs-slowest comparison
    fireEvent.change(screen.getByTestId('filter-worker'), { target: { value: '1' } });
    await waitFor(() => {
      expect(screen.queryByTestId('speed-cards')).not.toBeInTheDocument();
    });
  });

  it('hides the speed comparison when only one worker has completions', async () => {
    mockGetTaskStatistics.mockResolvedValue({
      ...STATS_WITH_DATA,
      summary: { ...STATS_WITH_DATA.summary, fastest_worker: 'Bob Worker', slowest_worker: 'Bob Worker' },
    });
    render(<ReportsPage />);
    await waitFor(() => expect(screen.getByTestId('kpi-cards')).toBeInTheDocument());
    // Same worker for fastest and slowest → no comparison shown
    expect(screen.queryByTestId('speed-cards')).not.toBeInTheDocument();
  });

  it('shows "all dates" in the active filter caption by default', async () => {
    mockGetTaskStatistics.mockResolvedValue(STATS_WITH_DATA);
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('active-date-filter')).toHaveTextContent('all dates');
    });
  });

  it('reflects the selected date range in the active filter caption', async () => {
    mockGetTaskStatistics.mockResolvedValue(STATS_WITH_DATA);
    render(<ReportsPage />);
    await waitFor(() => screen.getByTestId('filter-start-date'));

    fireEvent.change(screen.getByTestId('filter-start-date'), { target: { value: '2026-06-04' } });
    fireEvent.change(screen.getByTestId('filter-end-date'),   { target: { value: '2026-06-04' } });

    await waitFor(() => {
      expect(screen.getByTestId('active-date-filter')).toHaveTextContent('2026-06-04 → 2026-06-04');
    });
  });

  it('shows per-worker average completion time in the worker table', async () => {
    mockGetTaskStatistics.mockResolvedValue(STATS_WITH_DATA);
    render(<ReportsPage />);
    await waitFor(() => {
      const table = screen.getByTestId('worker-table');
      expect(within(table).getByText('Avg Time')).toBeInTheDocument();
      expect(within(table).getByText('2h')).toBeInTheDocument(); // Bob
      expect(within(table).getByText('6h')).toBeInTheDocument(); // Carol
    });
  });

  it('allows same-day range (start === end) and fires the request', async () => {
    mockGetTaskStatistics.mockResolvedValue(EMPTY_STATS);
    render(<ReportsPage />);
    await waitFor(() => screen.getByTestId('filter-start-date'));

    fireEvent.change(screen.getByTestId('filter-start-date'), { target: { value: '2026-06-03' } });
    fireEvent.change(screen.getByTestId('filter-end-date'),   { target: { value: '2026-06-03' } });

    await waitFor(() => {
      // No validation error for an equal start/end day
      expect(screen.queryByTestId('date-error')).not.toBeInTheDocument();
      const calls = mockGetTaskStatistics.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.startDate).toBe('2026-06-03');
      expect(lastCall.endDate).toBe('2026-06-03');
    });
  });

  it('does not request data for an invalid date range', async () => {
    mockGetTaskStatistics.mockResolvedValue(EMPTY_STATS);
    render(<ReportsPage />);
    await waitFor(() => screen.getByTestId('filter-start-date'));

    mockGetTaskStatistics.mockClear();
    fireEvent.change(screen.getByTestId('filter-start-date'), { target: { value: '2026-06-10' } });
    fireEvent.change(screen.getByTestId('filter-end-date'),   { target: { value: '2026-06-01' } });

    await waitFor(() => expect(screen.getByTestId('date-error')).toBeInTheDocument());
    // No request may carry the invalid combination (start 06-10 with end 06-01).
    const firedInvalid = mockGetTaskStatistics.mock.calls.some(
      ([f]) => f.startDate === '2026-06-10' && f.endDate === '2026-06-01',
    );
    expect(firedInvalid).toBe(false);
  });

  it('calls getTaskStatistics with period filter', async () => {
    mockGetTaskStatistics.mockResolvedValue(EMPTY_STATS);
    render(<ReportsPage />);
    await waitFor(() => screen.getByTestId('filter-period'));

    fireEvent.change(screen.getByTestId('filter-period'), { target: { value: 'yearly' } });

    await waitFor(() => {
      const calls = mockGetTaskStatistics.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.period).toBe('yearly');
    });
  });
});
