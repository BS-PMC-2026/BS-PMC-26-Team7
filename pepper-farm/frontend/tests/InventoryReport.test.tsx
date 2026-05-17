import { render, screen, act } from '@testing-library/react';
import ReportsPage from '@/app/manager/reports/page';
import * as reportsService from '@/services/reports';

// Stable router object — InventoryReport uses useCallback([router]),
// so a new object every render causes an infinite re-render loop inside act().
const mockRouter = { replace: jest.fn() };

jest.mock('@/services/reports');
jest.mock('@/services/tasks', () => ({
  getTasksReportByWorker: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/services/users', () => ({
  getAllUsers: jest.fn().mockResolvedValue([]),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => ({ get: (k: string) => k === 'tab' ? 'inventory' : null }),
}));

const mockRows = [
  {
    InventoryId: 1, DisplayName: 'Jalapeño Seeds', Category: 'Seeds',
    Location: 'Shelf A', WarehouseQuantity: 100, AllocatedQuantity: 20,
    AvailableQuantity: 80, LowStock: false, LastUpdatedAt: '2026-04-19',
  },
  {
    InventoryId: 2, DisplayName: 'Fertilizer Bag', Category: 'Supplies',
    Location: 'Shelf B', WarehouseQuantity: 10, AllocatedQuantity: 8,
    AvailableQuantity: 2, LowStock: true, LastUpdatedAt: '2026-04-19',
  },
];

describe('InventoryReportPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.replace.mockClear();
    localStorage.setItem('token', 'fake-token');
    (reportsService.getInventoryReport as jest.Mock).mockResolvedValue(mockRows);
  });

  afterEach(() => {
    localStorage.removeItem('token');
  });

  it('renders page title', async () => {
    await act(async () => { render(<ReportsPage />); });
    expect(screen.getByText('Inventory Report')).toBeInTheDocument();
  });

  it('renders items from DB', async () => {
    await act(async () => { render(<ReportsPage />); });
    expect(screen.getByText('Jalapeño Seeds')).toBeInTheDocument();
    expect(screen.getByText('Fertilizer Bag')).toBeInTheDocument();
  });

  it('shows Low Stock badge for low items', async () => {
    await act(async () => { render(<ReportsPage />); });
    expect(screen.getAllByText(/Low Stock/).length).toBeGreaterThan(0);
  });

  it('shows OK badge for healthy items', async () => {
    await act(async () => { render(<ReportsPage />); });
    expect(screen.getAllByText(/✓/).length).toBeGreaterThan(0);
  });

  it('shows summary cards', async () => {
    await act(async () => { render(<ReportsPage />); });
    expect(screen.getByText('Total Items')).toBeInTheDocument();
    expect(screen.getByText('Total Available')).toBeInTheDocument();
  });

  it('shows Export CSV button', async () => {
    await act(async () => { render(<ReportsPage />); });
    expect(screen.getByText(/Export CSV/)).toBeInTheDocument();
  });

  it('shows error when API fails', async () => {
    (reportsService.getInventoryReport as jest.Mock).mockRejectedValueOnce(
      new Error('Failed to load inventory report.')
    );
    await act(async () => { render(<ReportsPage />); });
    expect(screen.getByText('Failed to load inventory report.')).toBeInTheDocument();
  });

  it('shows empty state when no items', async () => {
    (reportsService.getInventoryReport as jest.Mock).mockResolvedValueOnce([]);
    await act(async () => { render(<ReportsPage />); });
    expect(screen.getByText(/No inventory items match/)).toBeInTheDocument();
  });
});
