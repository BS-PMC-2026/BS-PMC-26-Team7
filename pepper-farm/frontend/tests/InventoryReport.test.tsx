import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InventoryReportPage from '@/app/manager/reports/inventory/page';
import * as reportsService from '@/services/reports';

jest.mock('@/services/reports');
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn((key: string) => {
    if (key === 'token') return 'fake-token';
    return null;
  }),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

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
    (reportsService.getInventoryReport as jest.Mock).mockResolvedValue(mockRows);
  });

  it('renders page title', async () => {
    render(<InventoryReportPage />);
    await waitFor(() => {
      expect(screen.getByText('Inventory Report')).toBeInTheDocument();
    });
  });

  it('renders items from DB', async () => {
    render(<InventoryReportPage />);
    await waitFor(() => {
      expect(screen.getByText('Jalapeño Seeds')).toBeInTheDocument();
      expect(screen.getByText('Fertilizer Bag')).toBeInTheDocument();
    });
  });

  it('shows Low Stock badge for low items', async () => {
  render(<InventoryReportPage />);
  await waitFor(() => {
    expect(screen.getByText(/⚠ Low Stock/)).toBeInTheDocument();
  });
});

  it('shows OK badge for healthy items', async () => {
    render(<InventoryReportPage />);
    await waitFor(() => {
      expect(screen.getByText(/✓ OK/)).toBeInTheDocument();
    });
  });

  it('shows summary cards', async () => {
    render(<InventoryReportPage />);
    await waitFor(() => {
      expect(screen.getByText('Total Items')).toBeInTheDocument();
      expect(screen.getByText('Total Available')).toBeInTheDocument();
    });
  });

  it('shows Export CSV button', async () => {
    render(<InventoryReportPage />);
    await waitFor(() => {
      expect(screen.getByText(/Export CSV/)).toBeInTheDocument();
    });
  });

  it('shows error when API fails', async () => {
    (reportsService.getInventoryReport as jest.Mock).mockRejectedValueOnce(
      new Error('Failed to load inventory report.')
    );
    render(<InventoryReportPage />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load inventory report.')).toBeInTheDocument();
    });
  });

  it('shows empty state when no items', async () => {
    (reportsService.getInventoryReport as jest.Mock).mockResolvedValueOnce([]);
    render(<InventoryReportPage />);
    await waitFor(() => {
      expect(screen.getByText(/No inventory items match/)).toBeInTheDocument();
    });
  });
});