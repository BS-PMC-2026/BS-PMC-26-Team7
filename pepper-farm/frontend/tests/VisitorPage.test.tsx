import { render, screen, waitFor } from '@testing-library/react';
import VisitorPage from '@/app/visitor/page';
import * as peppersService from '@/services/peppers';
import { Pepper } from '@/types/pepper';

jest.mock('@/services/peppers');

const mockPeppers: Pepper[] = [
  { PepperId: 1, PepperName: 'Jalapeño', IsActive: true, GeneralDescription: 'A mild pepper' },
  { PepperId: 2, PepperName: 'Habanero', IsActive: true, HeatLevelScovilleMin: 100000, HeatLevelScovilleMax: 350000 },
];

describe('VisitorPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading skeleton while fetching', () => {
    (peppersService.getAllPeppers as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<VisitorPage />);
    // Skeleton: 8 animate-pulse cards
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(8);
  });

  it('renders pepper cards after successful fetch', async () => {
    (peppersService.getAllPeppers as jest.Mock).mockResolvedValue(mockPeppers);
    render(<VisitorPage />);
    await waitFor(() => {
      expect(screen.getByText('Jalapeño')).toBeInTheDocument();
      expect(screen.getByText('Habanero')).toBeInTheDocument();
    });
  });

  it('shows variety count after load', async () => {
    (peppersService.getAllPeppers as jest.Mock).mockResolvedValue(mockPeppers);
    render(<VisitorPage />);
    await waitFor(() => {
      expect(screen.getByText('2 varieties')).toBeInTheDocument();
    });
  });

  it('shows singular "variety" for 1 result', async () => {
    (peppersService.getAllPeppers as jest.Mock).mockResolvedValue([mockPeppers[0]]);
    render(<VisitorPage />);
    await waitFor(() => {
      expect(screen.getByText('1 variety')).toBeInTheDocument();
    });
  });

  it('shows empty state when no peppers returned', async () => {
    (peppersService.getAllPeppers as jest.Mock).mockResolvedValue([]);
    render(<VisitorPage />);
    await waitFor(() => {
      expect(screen.getByText('No pepper varieties found')).toBeInTheDocument();
    });
  });

  it('shows error state when fetch fails', async () => {
    (peppersService.getAllPeppers as jest.Mock).mockRejectedValue(new Error('Network error'));
    render(<VisitorPage />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load pepper varieties/)).toBeInTheDocument();
    });
  });

  it('renders page header title', async () => {
    (peppersService.getAllPeppers as jest.Mock).mockResolvedValue([]);
    render(<VisitorPage />);
    expect(screen.getByText('Pepper Varieties')).toBeInTheDocument();
  });

  it('renders PepperFarm label in header', async () => {
    (peppersService.getAllPeppers as jest.Mock).mockResolvedValue([]);
    render(<VisitorPage />);
    expect(screen.getByText('PepperFarm')).toBeInTheDocument();
  });
});
