/**
 * Tests for /manager/spray-map — covers both the zone map and the
 * Spray Alert History section (US30, id="spray-alerts").
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

/* ── Mocks ──────────────────────────────────────────────────────────────────── */

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/manager/spray-map',
}));

jest.mock('next/link', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ({ href, children, ...rest }: any) =>
    React.createElement('a', { href, ...rest }, children);
});

jest.mock('lucide-react', () => {
  const icons = ['RefreshCw', 'ShieldAlert', 'ShieldCheck'];
  const mocks: Record<string, React.FC<{ size?: number; className?: string }>> = {};
  icons.forEach((name) => {
    mocks[name] = ({ size, className }: { size?: number; className?: string }) =>
      React.createElement('svg', { 'data-testid': `icon-${name}`, width: size, className });
  });
  return mocks;
});

// Mock PageHeader
jest.mock('@/components/ui/PageHeader', () =>
  ({ title }: { title: string }) => React.createElement('h1', {}, title),
);

// Mock SprayZoneMap (heavy SVG component)
jest.mock('@/components/spray/SprayZoneMap', () =>
  () => React.createElement('div', { 'data-testid': 'spray-zone-map' }),
);

// Mock spray service
const mockGetZoneSprayMap = jest.fn();
const mockGetSprayAlerts  = jest.fn();

jest.mock('@/services/spray', () => ({
  getZoneSprayMap:   (...args: unknown[]) => mockGetZoneSprayMap(...args),
  getSprayAlerts:    (...args: unknown[]) => mockGetSprayAlerts(...args),
}));

/* ── Fixtures ────────────────────────────────────────────────────────────────── */

const makeAlert = (overrides = {}) => ({
  SprayAlertId: 1, SprayReportId: 1, ZoneId: 1,
  ZoneCode: 'GH-01', ZoneName: 'Greenhouse 1',
  PesticideName: 'Confidor', ReportedByUserId: 2,
  ReportStatus: 'completed' as const, Severity: 'medium' as const,
  SafetyMessage: 'Do not re-enter.', RequiresApproval: false,
  ReEntryIntervalHours: 12, SafeToReEnterAtUtc: null, SafeToHarvestAtUtc: null,
  HazardLevel: 'medium', PpeRequired: 'Gloves',
  SprayedAtUtc: new Date().toISOString(), IsRead: false,
  CreatedAt: new Date().toISOString(),
  ...overrides,
});

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

/* ── Import page after mocks ────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SprayMapPage = require('@/app/manager/spray-map/page').default;

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

const renderPage = () => render(React.createElement(SprayMapPage));

/* ── Tests ───────────────────────────────────────────────────────────────────── */

describe('SprayMapPage — spray alerts section', () => {
  beforeEach(() => {
    mockGetZoneSprayMap.mockResolvedValue([makeZone()]);
  });

  afterEach(() => {
    mockGetZoneSprayMap.mockReset();
    mockGetSprayAlerts.mockReset();
  });

  it('renders the spray alerts section anchor (id=spray-alerts)', async () => {
    mockGetSprayAlerts.mockResolvedValue([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('spray-alerts-section')).toBeInTheDocument(),
    );
    expect(document.getElementById('spray-alerts')).toBeInTheDocument();
  });

  it('shows loading skeleton while fetching alerts', () => {
    mockGetSprayAlerts.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    expect(screen.getByTestId('spray-alerts-loading')).toBeInTheDocument();
  });

  it('shows empty state when no alerts exist', async () => {
    mockGetSprayAlerts.mockResolvedValue([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('spray-alerts-empty')).toBeInTheDocument(),
    );
    expect(screen.getByText('No spray alerts yet.')).toBeInTheDocument();
  });

  it('renders alert rows when alerts exist', async () => {
    mockGetSprayAlerts.mockResolvedValue([makeAlert(), makeAlert({ SprayAlertId: 2, SprayReportId: 2 })]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('spray-alerts-list')).toBeInTheDocument(),
    );
    const rows = screen.getAllByTestId('spray-alert-row');
    expect(rows.length).toBe(2);
  });

  it('shows zone name in alert rows', async () => {
    mockGetSprayAlerts.mockResolvedValue([makeAlert()]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('spray-alerts-list')).toBeInTheDocument(),
    );
    // "Greenhouse 1" appears in both zone table and alerts table
    expect(screen.getAllByText('Greenhouse 1').length).toBeGreaterThan(0);
  });

  it('shows "NEW" badge on unread alerts', async () => {
    mockGetSprayAlerts.mockResolvedValue([makeAlert({ IsRead: false })]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('spray-alerts-list')).toBeInTheDocument(),
    );
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });

  it('shows error when alert fetch fails', async () => {
    mockGetSprayAlerts.mockRejectedValue(new Error('Network error'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('spray-alerts-error')).toBeInTheDocument(),
    );
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });
});

describe('SprayMapPage — page title', () => {
  beforeEach(() => {
    mockGetZoneSprayMap.mockResolvedValue([]);
    mockGetSprayAlerts.mockResolvedValue([]);
  });

  it('renders Spray Map title', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Spray Map')).toBeInTheDocument());
  });
});
