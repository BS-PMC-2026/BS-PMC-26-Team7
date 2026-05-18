import { render, screen, waitFor, act } from '@testing-library/react';
import VisitorPage from '@/app/visitor/page';
import * as peppersService from '@/services/peppers';
import { Pepper } from '@/types/pepper';

jest.mock('@/services/peppers');
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/',
  useSearchParams: () => ({ get: () => null }),
}));
jest.mock('next/link', () => {
  const MockLink = ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => {
      const { initial, animate, exit, transition, whileHover, ...rest } = props;
      void initial; void animate; void exit; void transition; void whileHover;
      return <div {...rest}>{children}</div>;
    },
    span: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => {
      const { initial, animate, exit, transition, ...rest } = props;
      void initial; void animate; void exit; void transition;
      return <span {...rest}>{children}</span>;
    },
    section: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => {
      const { initial, animate, exit, transition, ...rest } = props;
      void initial; void animate; void exit; void transition;
      return <section {...rest}>{children}</section>;
    },
    header: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => {
      const { initial, animate, exit, transition, ...rest } = props;
      void initial; void animate; void exit; void transition;
      return <header {...rest}>{children}</header>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
import React from 'react';

const mockPeppers: Pepper[] = [
  { PepperId: 1, PepperName: 'Jalapeño', IsActive: true, GeneralDescription: 'A mild pepper' },
  { PepperId: 2, PepperName: 'Habanero', IsActive: true, HeatLevelScovilleMin: 100000, HeatLevelScovilleMax: 350000 },
];

describe('VisitorPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading skeleton while fetching', async () => {
    (peppersService.getAllPeppers as jest.Mock).mockReturnValue(new Promise(() => {}));
    await act(async () => { render(<VisitorPage />); });
    // Skeleton: 8 animate-pulse cards
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(8);
  });

  it('renders pepper cards after successful fetch', async () => {
    (peppersService.getAllPeppers as jest.Mock).mockResolvedValue(mockPeppers);
    await act(async () => { render(<VisitorPage />); });
    expect(screen.getByText('Jalapeño')).toBeInTheDocument();
    expect(screen.getByText('Habanero')).toBeInTheDocument();
  });

  it('shows variety count after load', async () => {
    (peppersService.getAllPeppers as jest.Mock).mockResolvedValue(mockPeppers);
    await act(async () => { render(<VisitorPage />); });
    expect(screen.getByText('2 varieties')).toBeInTheDocument();
  });

  it('shows singular "variety" for 1 result', async () => {
    (peppersService.getAllPeppers as jest.Mock).mockResolvedValue([mockPeppers[0]]);
    await act(async () => { render(<VisitorPage />); });
    expect(screen.getByText('1 variety')).toBeInTheDocument();
  });

  it('shows empty state when no peppers returned', async () => {
    (peppersService.getAllPeppers as jest.Mock).mockResolvedValue([]);
    await act(async () => { render(<VisitorPage />); });
    expect(screen.getByText('No pepper varieties found')).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    (peppersService.getAllPeppers as jest.Mock).mockRejectedValue(new Error('Network error'));
    await act(async () => { render(<VisitorPage />); });
    expect(screen.getByText(/Failed to load pepper varieties/)).toBeInTheDocument();
  });

  it('renders page header title', async () => {
    (peppersService.getAllPeppers as jest.Mock).mockResolvedValue([]);
    await act(async () => { render(<VisitorPage />); });
    expect(screen.getByText('Pepper Varieties')).toBeInTheDocument();
  });

  it('renders PepperFarm label in header', async () => {
    (peppersService.getAllPeppers as jest.Mock).mockResolvedValue([]);
    await act(async () => { render(<VisitorPage />); });
    expect(screen.getByText('PepperFarm')).toBeInTheDocument();
  });
});
