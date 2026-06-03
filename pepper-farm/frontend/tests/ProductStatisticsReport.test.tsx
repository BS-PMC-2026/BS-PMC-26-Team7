/**
 * Tests for the Product Statistics tab in /manager/reports.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

/* ── Mocks ─────────────────────────────────────────────────────────────────── */

jest.mock('next/navigation', () => ({
  useRouter:       () => ({ replace: jest.fn() }),
  useSearchParams: () => ({ get: (key: string) => key === 'tab' ? 'product-statistics' : null }),
}));

const mockGetTaskStatistics   = jest.fn();
const mockGetInventoryReport  = jest.fn();
const mockGetProductStatistics = jest.fn();

jest.mock('@/services/reports', () => ({
  getInventoryReport:    (...a: unknown[]) => mockGetInventoryReport(...a),
  getTaskStatistics:     (...a: unknown[]) => mockGetTaskStatistics(...a),
  getProductStatistics:  (...a: unknown[]) => mockGetProductStatistics(...a),
}));

jest.mock('@/services/users', () => ({
  getAllUsers: () => Promise.resolve([]),
}));

jest.mock('@/services/tasks', () => ({
  getTasksReportByWorker: () => Promise.resolve([]),
}));

jest.mock('@/components/reports/InventoryReportTable', () => ({
  __esModule: true,
  default: () => <div data-testid="inventory-table" />,
}));

import ReportsPage from '@/app/manager/reports/page';

/* ── Fixtures ───────────────────────────────────────────────────────────────── */

const EMPTY_STATS = {
  summary: {
    total_revenue: 0, total_orders: 0, total_units_sold: 0,
    avg_order_value: 0, unique_buyers: 0,
    best_selling_product: null, cheapest_sold_product: null, most_expensive_sold_product: null,
  },
  best_selling_products: [],
  revenue_by_period: [],
  recent_orders: [],
};

const TASK_EMPTY = {
  summary: { total: 0, open: 0, completed: 0, overdue: 0, completion_rate: 0, avg_completion_hours: null },
  by_status: [], by_worker: [], by_period: [], overdue_tasks: [],
};

const PROD_WITH_DATA = {
  summary: {
    total_revenue: 1250.50,
    total_orders: 5,
    total_units_sold: 12,
    avg_order_value: 250.10,
    unique_buyers: 3,
    best_selling_product: 'Pepper Oil',
    cheapest_sold_product: 'Hot Sauce',
    most_expensive_sold_product: 'Premium Extract',
  },
  best_selling_products: [
    { product_id: 1, product_name: 'Pepper Oil',       units_sold: 6, revenue: 600.0,  orders: 3 },
    { product_id: 2, product_name: 'Hot Sauce',        units_sold: 4, revenue: 200.0,  orders: 2 },
    { product_id: 3, product_name: 'Premium Extract',  units_sold: 2, revenue: 450.50, orders: 1 },
  ],
  revenue_by_period: [
    { period: '2026-05', revenue: 800.0,  orders: 3, units_sold: 7 },
    { period: '2026-06', revenue: 450.50, orders: 2, units_sold: 5 },
  ],
  recent_orders: [
    { order_id: 5, order_number: 'ORD-0005', buyer_name: 'Carol',  created_at: '2026-06-01T12:00:00', total_amount: 250.0, status: 'paid', payment_method: 'mock_credit_card' },
    { order_id: 4, order_number: 'ORD-0004', buyer_name: 'Alice',  created_at: '2026-05-28T09:00:00', total_amount: 200.5, status: 'paid', payment_method: 'mock_paypal' },
  ],
};

/* ── Tests ──────────────────────────────────────────────────────────────────── */

describe('Product Statistics Report tab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTaskStatistics.mockResolvedValue(TASK_EMPTY);
  });

  it('renders the product statistics tab container', async () => {
    mockGetProductStatistics.mockResolvedValue(EMPTY_STATS);
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('product-statistics-tab')).toBeInTheDocument();
    });
  });

  it('shows KPI cards with revenue and order data', async () => {
    mockGetProductStatistics.mockResolvedValue(PROD_WITH_DATA);
    render(<ReportsPage />);
    await waitFor(() => {
      const kpi = screen.getByTestId('prod-kpi-cards');
      expect(kpi).toBeInTheDocument();
      // Check KPI values are scoped to the cards container
      expect(within(kpi).getByText('5')).toBeInTheDocument();   // total orders
      expect(within(kpi).getByText('12')).toBeInTheDocument();  // units sold
      expect(within(kpi).getByText('3')).toBeInTheDocument();   // unique buyers
    });
  });

  it('shows best selling product name in summary card', async () => {
    mockGetProductStatistics.mockResolvedValue(PROD_WITH_DATA);
    render(<ReportsPage />);
    await waitFor(() => {
      // 'Pepper Oil' appears in both the KPI row-2 card and the best-selling table
      expect(screen.getAllByText('Pepper Oil').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders the best selling products table', async () => {
    mockGetProductStatistics.mockResolvedValue(PROD_WITH_DATA);
    render(<ReportsPage />);
    await waitFor(() => {
      const table = screen.getByTestId('best-selling-table');
      expect(table).toBeInTheDocument();
      expect(within(table).getAllByText('Pepper Oil').length).toBeGreaterThanOrEqual(1);
      expect(within(table).getByText('Hot Sauce')).toBeInTheDocument();
      expect(within(table).getByText('Premium Extract')).toBeInTheDocument();
    });
  });

  it('renders the revenue by period table', async () => {
    mockGetProductStatistics.mockResolvedValue(PROD_WITH_DATA);
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('revenue-period-table')).toBeInTheDocument();
      expect(screen.getByText('2026-05')).toBeInTheDocument();
      expect(screen.getByText('2026-06')).toBeInTheDocument();
    });
  });

  it('renders the recent orders table with buyer names', async () => {
    mockGetProductStatistics.mockResolvedValue(PROD_WITH_DATA);
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('recent-orders-table')).toBeInTheDocument();
      expect(screen.getByText('Carol')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('ORD-0005')).toBeInTheDocument();
    });
  });

  it('shows empty state when no paid orders', async () => {
    mockGetProductStatistics.mockResolvedValue(EMPTY_STATS);
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('prod-empty-state')).toBeInTheDocument();
    });
  });

  it('shows error message when API fails', async () => {
    mockGetProductStatistics.mockRejectedValue(new Error('Unauthorized'));
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('prod-stats-error')).toHaveTextContent('Unauthorized');
    });
  });

  it('shows date validation error for invalid range', async () => {
    mockGetProductStatistics.mockResolvedValue(EMPTY_STATS);
    render(<ReportsPage />);
    await waitFor(() => screen.getByTestId('prod-filter-start-date'));

    fireEvent.change(screen.getByTestId('prod-filter-start-date'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByTestId('prod-filter-end-date'),   { target: { value: '2026-06-01' } });

    await waitFor(() => {
      expect(screen.getByTestId('prod-date-error')).toBeInTheDocument();
    });
  });

  it('date error is persistent until a valid range is entered', async () => {
    mockGetProductStatistics.mockResolvedValue(EMPTY_STATS);
    render(<ReportsPage />);
    await waitFor(() => screen.getByTestId('prod-filter-start-date'));

    // Set an invalid range (start after end)
    fireEvent.change(screen.getByTestId('prod-filter-start-date'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByTestId('prod-filter-end-date'),   { target: { value: '2026-06-01' } });

    await waitFor(() => {
      expect(screen.getByTestId('prod-date-error')).toBeInTheDocument();
    });

    // Fix the range — error should disappear
    fireEvent.change(screen.getByTestId('prod-filter-end-date'), { target: { value: '2026-08-01' } });
    await waitFor(() => {
      expect(screen.queryByTestId('prod-date-error')).not.toBeInTheDocument();
    });
  });

  it('tab button has correct label', async () => {
    mockGetProductStatistics.mockResolvedValue(EMPTY_STATS);
    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('tab-product-statistics')).toHaveTextContent('Product Statistics');
    });
  });

  it('calls getProductStatistics with period filter', async () => {
    mockGetProductStatistics.mockResolvedValue(EMPTY_STATS);
    render(<ReportsPage />);
    await waitFor(() => screen.getByTestId('prod-filter-period'));

    fireEvent.change(screen.getByTestId('prod-filter-period'), { target: { value: 'yearly' } });

    await waitFor(() => {
      const calls = mockGetProductStatistics.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.period).toBe('yearly');
    });
  });
});
