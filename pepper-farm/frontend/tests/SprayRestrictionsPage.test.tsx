/**
 * Tests for US31 — /worker/spray-restrictions (WorkerSprayRestrictionsPage).
 *
 * Covers:
 *  - Page renders for worker
 *  - Loading skeleton shown while fetching
 *  - SprayZoneMap renders with data
 *  - Restricted zones banner shown when unsafe/requires_approval zones exist
 *  - Summary cards render
 *  - Zone table renders with correct status labels
 *  - Error state rendered when fetch fails
 *  - No manager-only alert controls visible
 *  - Legend renders via SprayZoneMap component
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

/* ── Mocks ───────────────────────────────────────────────────────────────── */

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/worker/spray-restrictions',
}));

jest.mock('next/link', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ({ href, children, ...rest }: any) =>
    React.createElement('a', { href, ...rest }, children);
});

jest.mock('lucide-react', () => {
  const icons = ['RefreshCw', 'ShieldAlert'];
  const mocks: Record<string, React.FC<{ size?: number; className?: string }>> = {};
  icons.forEach((name) => {
    mocks[name] = ({ size, className }: { size?: number; className?: string }) =>
      React.createElement('svg', { 'data-testid': `icon-${name}`, width: size, className });
  });
  return mocks;
});

jest.mock('@/components/ui/PageHeader', () =>
  ({ title }: { title: string }) => React.createElement('h1', {}, title),
);

jest.mock('@/components/spray/SprayZoneMap', () =>
  () => React.createElement('div', { 'data-testid': 'spray-zone-map' }),
);

const mockGetRestrictedZones = jest.fn();

jest.mock('@/services/spray', () => ({
  getRestrictedZones: (...args: unknown[]) => mockGetRestrictedZones(...args),
}));

/* ── Fixtures ────────────────────────────────────────────────────────────── */

const makeZone = (overrides = {}) => ({
  zoneId: 1, zoneCode: 'GH-01', zoneName: 'Greenhouse 1',
  sprayStatus: 'safe' as const,
  lastCompletedAtUtc: new Date().toISOString(),
  pesticideName: 'Confidor',
  safeToReEnterAtUtc: null, safeToHarvestAtUtc: null,
  requiresApproval: false, hazardLevel: 'medium', ppeRequired: 'Gloves',
  nextPlannedAtUtc: null,
  ...overrides,
});

/* ── Import page after mocks ─────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SprayRestrictionsPage = require('@/app/worker/spray-restrictions/page').default;

const renderPage = () => render(React.createElement(SprayRestrictionsPage));

/* ── Tests ───────────────────────────────────────────────────────────────── */

describe('WorkerSprayRestrictionsPage', () => {
  afterEach(() => { mockGetRestrictedZones.mockReset(); });

  it('renders the page title', async () => {
    mockGetRestrictedZones.mockResolvedValue([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Spray Restrictions Map')).toBeInTheDocument(),
    );
  });

  it('shows loading skeleton while fetching', () => {
    mockGetRestrictedZones.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('renders SprayZoneMap after data loads', async () => {
    mockGetRestrictedZones.mockResolvedValue([makeZone()]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('spray-zone-map')).toBeInTheDocument(),
    );
  });

  it('shows safety notice banner', async () => {
    mockGetRestrictedZones.mockResolvedValue([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Safety notice/i)).toBeInTheDocument(),
    );
  });

  it('shows summary cards after load', async () => {
    mockGetRestrictedZones.mockResolvedValue([makeZone()]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('summary-cards')).toBeInTheDocument(),
    );
  });

  it('shows restricted zones banner when unsafe zones exist', async () => {
    const now = new Date();
    const future = new Date(now.getTime() + 10 * 60 * 60 * 1000).toISOString();
    mockGetRestrictedZones.mockResolvedValue([
      makeZone({ zoneId: 1, zoneCode: 'GH-01', sprayStatus: 'unsafe', safeToReEnterAtUtc: future }),
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('restricted-zones-banner')).toBeInTheDocument(),
    );
    expect(screen.getByText(/Restricted zones/i)).toBeInTheDocument();
  });

  it('does NOT show restricted zones banner when all zones are safe', async () => {
    mockGetRestrictedZones.mockResolvedValue([makeZone({ sprayStatus: 'safe' })]);
    renderPage();
    await waitFor(() =>
      expect(screen.queryByTestId('restricted-zones-banner')).not.toBeInTheDocument(),
    );
  });

  it('renders zone table with zone name and code', async () => {
    mockGetRestrictedZones.mockResolvedValue([makeZone()]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('zone-table')).toBeInTheDocument(),
    );
    expect(screen.getByText('Greenhouse 1')).toBeInTheDocument();
    expect(screen.getByText('GH-01')).toBeInTheDocument();
  });

  it('shows "Safe" status label for safe zones', async () => {
    mockGetRestrictedZones.mockResolvedValue([makeZone({ sprayStatus: 'safe' })]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('zone-table')).toBeInTheDocument(),
    );
    // "Safe" appears in both the summary card and the zone table status badge
    expect(screen.getAllByText('Safe').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Restricted (within REI)" label for unsafe zones', async () => {
    const future = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();
    mockGetRestrictedZones.mockResolvedValue([
      makeZone({ sprayStatus: 'unsafe', safeToReEnterAtUtc: future }),
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('zone-table')).toBeInTheDocument(),
    );
    expect(screen.getByText('Restricted (within REI)')).toBeInTheDocument();
  });

  it('shows "Caution — Unverified" label for requires_approval zones', async () => {
    mockGetRestrictedZones.mockResolvedValue([
      makeZone({ sprayStatus: 'requires_approval', requiresApproval: true }),
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('zone-table')).toBeInTheDocument(),
    );
    expect(screen.getByText('Caution — Unverified')).toBeInTheDocument();
  });

  it('shows error message on fetch failure', async () => {
    mockGetRestrictedZones.mockRejectedValue(new Error('Network error'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Network error')).toBeInTheDocument(),
    );
  });

  it('does not show manager alert controls', async () => {
    mockGetRestrictedZones.mockResolvedValue([makeZone()]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('spray-zone-map')).toBeInTheDocument(),
    );
    // No spray alert section (manager-only)
    expect(screen.queryByText('Spray Alert History')).not.toBeInTheDocument();
    expect(screen.queryByText('View all')).not.toBeInTheDocument();
  });
});
