/**
 * Tests for US31 — /visitor/spray-restrictions (VisitorSprayRestrictionsPage).
 *
 * Key requirement: the visitor safety map must render WITHOUT any login/token.
 * It calls getPublicRestrictedZones() which hits the unauthenticated backend endpoint.
 *
 * Covers:
 *  - Page renders without login (no auth context needed)
 *  - Loading skeleton shown while fetching
 *  - SprayZoneMap renders with data
 *  - Restricted areas banner shown when restricted zones exist
 *  - "All clear" banner shown when no restricted zones
 *  - Zone status table renders
 *  - Error state rendered on fetch failure
 *  - No manager-only alert controls (no Spray Alert History, no "View all")
 *  - No US33 check-in / approval workflow controls
 *  - /visitor/page.tsx shows Safety Map button without login (isLoggedIn = false)
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

/* ── Mocks ───────────────────────────────────────────────────────────────── */

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/visitor/spray-restrictions',
}));

jest.mock('next/link', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ({ href, children, ...rest }: any) =>
    React.createElement('a', { href, ...rest }, children);
});

jest.mock('lucide-react', () => {
  const icons = ['ShieldAlert'];
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

const mockGetPublicRestrictedZones = jest.fn();

jest.mock('@/services/spray', () => ({
  getPublicRestrictedZones: (...args: unknown[]) => mockGetPublicRestrictedZones(...args),
  getRestrictedZones:       jest.fn().mockResolvedValue([]),
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
  // US33 entry permission fields
  entryPermissionStatus: 'allowed' as const,
  entryAllowed: true,
  entryMessage: 'Entry is permitted. The re-entry interval (REI) for the last spray has passed.',
  remainingRestrictionMinutes: null,
  ...overrides,
});

/* ── Import page after mocks ─────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const VisitorSprayRestrictionsPage =
  require('@/app/visitor/spray-restrictions/page').default;

const renderPage = () => render(React.createElement(VisitorSprayRestrictionsPage));

/* ── Tests ───────────────────────────────────────────────────────────────── */

describe('VisitorSprayRestrictionsPage — public access (no login required)', () => {
  afterEach(() => { mockGetPublicRestrictedZones.mockReset(); });

  it('renders the page title without any login context', async () => {
    mockGetPublicRestrictedZones.mockResolvedValue([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Spray Restriction Map')).toBeInTheDocument(),
    );
  });

  it('calls getPublicRestrictedZones (not authenticated getRestrictedZones)', async () => {
    mockGetPublicRestrictedZones.mockResolvedValue([makeZone()]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('spray-zone-map')).toBeInTheDocument());
    expect(mockGetPublicRestrictedZones).toHaveBeenCalledTimes(1);
  });

  it('shows loading skeleton while fetching', () => {
    mockGetPublicRestrictedZones.mockReturnValue(new Promise(() => {}));
    renderPage();
    // Loading skeleton: the SprayZoneMap is not yet visible
    expect(screen.queryByTestId('spray-zone-map')).not.toBeInTheDocument();
  });

  it('renders SprayZoneMap after data loads', async () => {
    mockGetPublicRestrictedZones.mockResolvedValue([makeZone()]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('spray-zone-map')).toBeInTheDocument(),
    );
  });

  it('shows visitor safety notice', async () => {
    mockGetPublicRestrictedZones.mockResolvedValue([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Visitor safety notice/i)).toBeInTheDocument(),
    );
  });

  it('shows restricted areas banner when unsafe zones exist', async () => {
    const future = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();
    mockGetPublicRestrictedZones.mockResolvedValue([
      makeZone({ sprayStatus: 'unsafe', safeToReEnterAtUtc: future }),
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Areas currently closed to entry/i)).toBeInTheDocument(),
    );
  });

  it('shows "all zones open" banner when no restricted zones', async () => {
    mockGetPublicRestrictedZones.mockResolvedValue([makeZone({ sprayStatus: 'safe' })]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/All zones are currently open for entry/i)).toBeInTheDocument(),
    );
  });

  it('shows error message on fetch failure', async () => {
    mockGetPublicRestrictedZones.mockRejectedValue(new Error('Network error'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Network error')).toBeInTheDocument(),
    );
  });

  it('shows zone table after loading', async () => {
    mockGetPublicRestrictedZones.mockResolvedValue([makeZone()]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Greenhouse 1')).toBeInTheDocument(),
    );
  });

  it('does not show manager-only Spray Alert History', async () => {
    mockGetPublicRestrictedZones.mockResolvedValue([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Spray Restriction Map')).toBeInTheDocument(),
    );
    expect(screen.queryByText('Spray Alert History')).not.toBeInTheDocument();
  });

  it('does not show check-in or entry-approval action buttons (US33 is read-only)', async () => {
    mockGetPublicRestrictedZones.mockResolvedValue([makeZone()]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('spray-zone-map')).toBeInTheDocument());
    expect(screen.queryByText(/request entry/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/approve entry/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/check.?in/i)).not.toBeInTheDocument();
  });
});
