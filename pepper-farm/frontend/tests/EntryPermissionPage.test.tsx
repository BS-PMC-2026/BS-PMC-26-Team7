/**
 * Tests for US33 — Post-Spray Entry Safety Check.
 *
 * Verifies that entry permission status is displayed correctly on the
 * visitor public safety map (/visitor/spray-restrictions).
 *
 * Covers:
 *  - Visitor map shows "Entry Restricted" when zone is within REI.
 *  - Visitor map shows "Entry Permitted" when REI has passed.
 *  - Visitor map shows caution/"Consult Staff" for unverified pesticide.
 *  - Visitor map shows "Entry Permitted" for no_data zones.
 *  - Visitor map shows planned_warning when only a future spray is planned.
 *  - Safe re-entry time displayed when available.
 *  - No "Request entry / Approve entry / Check-in" action buttons (read-only).
 *  - No manager-only fields visible to visitors/workers.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ZoneSprayStatusData } from '@/types/spray';

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
  const icons = ['ShieldAlert', 'RefreshCw'];
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
  getRestrictedZones: jest.fn().mockResolvedValue([]),
}));

/* ── Fixtures ────────────────────────────────────────────────────────────── */

const future = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();

function makeZone(overrides: Partial<ZoneSprayStatusData> = {}): ZoneSprayStatusData {
  return {
    zoneId: 1,
    zoneCode: 'GH-01',
    zoneName: 'Greenhouse 1',
    sprayStatus: 'safe',
    lastCompletedAtUtc: new Date().toISOString(),
    pesticideName: 'Confidor',
    safeToReEnterAtUtc: null,
    safeToHarvestAtUtc: null,
    requiresApproval: false,
    hazardLevel: 'medium',
    ppeRequired: 'Gloves',
    nextPlannedAtUtc: null,
    entryPermissionStatus: 'allowed',
    entryAllowed: true,
    entryMessage: 'Entry is permitted. The re-entry interval (REI) for the last spray has passed.',
    remainingRestrictionMinutes: null,
    ...overrides,
  };
}

/* ── Page import (after mocks) ───────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const VisitorSprayRestrictionsPage =
  require('@/app/visitor/spray-restrictions/page').default;

const renderPage = () => render(React.createElement(VisitorSprayRestrictionsPage));

/* ══════════════════════════════════════════════════════════════════════════════
   US33 — Entry permission tests on /visitor/spray-restrictions
   ══════════════════════════════════════════════════════════════════════════════ */

describe('VisitorSprayRestrictionsPage — US33 entry permission (read-only)', () => {
  afterEach(() => { mockGetPublicRestrictedZones.mockReset(); });

  it('shows "Entry Restricted" badge for a zone within REI', async () => {
    mockGetPublicRestrictedZones.mockResolvedValue([
      makeZone({
        sprayStatus: 'unsafe',
        entryPermissionStatus: 'restricted',
        entryAllowed: false,
        entryMessage: 'Entry is restricted. Do not enter.',
        safeToReEnterAtUtc: future,
        remainingRestrictionMinutes: 660,
      }),
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Entry Restricted')).toBeInTheDocument(),
    );
  });

  it('shows "Entry Permitted" badge for a safe zone (REI passed)', async () => {
    mockGetPublicRestrictedZones.mockResolvedValue([makeZone()]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Entry Permitted')).toBeInTheDocument(),
    );
  });

  it('shows "Caution — Consult Staff" for unverified pesticide', async () => {
    mockGetPublicRestrictedZones.mockResolvedValue([
      makeZone({
        sprayStatus: 'requires_approval',
        entryPermissionStatus: 'caution',
        entryAllowed: false,
        entryMessage: 'Entry status unknown — pesticide safety data is unverified. Consult a staff member.',
        requiresApproval: true,
      }),
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Caution — Consult Staff')).toBeInTheDocument(),
    );
  });

  it('shows "Entry Permitted (Spray Due)" for zone with only a future planned spray', async () => {
    mockGetPublicRestrictedZones.mockResolvedValue([
      makeZone({
        sprayStatus: 'pending',
        entryPermissionStatus: 'planned_warning',
        entryAllowed: true,
        entryMessage: 'A spray is planned. Entry is currently permitted.',
        nextPlannedAtUtc: future,
      }),
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Entry Permitted (Spray Due)')).toBeInTheDocument(),
    );
  });

  it('shows "Entry Permitted" for a zone with no spray history (no_data)', async () => {
    mockGetPublicRestrictedZones.mockResolvedValue([
      makeZone({
        sprayStatus: 'never_sprayed',
        entryPermissionStatus: 'no_data',
        entryAllowed: true,
        entryMessage: 'No recent spray restriction. Entry is permitted.',
        pesticideName: null,
        lastCompletedAtUtc: null,
      }),
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Entry Permitted')).toBeInTheDocument(),
    );
  });

  it('shows safe re-entry time column in the zone table when REI not yet passed', async () => {
    mockGetPublicRestrictedZones.mockResolvedValue([
      makeZone({
        sprayStatus: 'unsafe',
        entryPermissionStatus: 'restricted',
        entryAllowed: false,
        safeToReEnterAtUtc: future,
        remainingRestrictionMinutes: 660,
      }),
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Entry Restricted')).toBeInTheDocument(),
    );
    // The safe re-entry column header should be visible
    expect(screen.getByText('Safe Re-entry Time')).toBeInTheDocument();
  });

  it('does NOT expose ReportedByUserId or SprayAlertId to visitors', async () => {
    mockGetPublicRestrictedZones.mockResolvedValue([makeZone()]);
    const { container } = renderPage();
    await waitFor(() =>
      expect(screen.getByText('Greenhouse 1')).toBeInTheDocument(),
    );
    expect(container.innerHTML).not.toMatch(/reportedByUserId/i);
    expect(container.innerHTML).not.toMatch(/sprayAlertId/i);
    expect(container.innerHTML).not.toMatch(/ReportedByUserId/);
  });

  it('does NOT show Request Entry / Approve Entry / Check-in action buttons (US33 is read-only)', async () => {
    mockGetPublicRestrictedZones.mockResolvedValue([makeZone()]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('spray-zone-map')).toBeInTheDocument(),
    );
    expect(screen.queryByText(/request entry/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/approve entry/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/check.?in/i)).not.toBeInTheDocument();
  });

  it('shows "Consult farm staff" in re-entry column for caution status', async () => {
    mockGetPublicRestrictedZones.mockResolvedValue([
      makeZone({
        sprayStatus: 'requires_approval',
        entryPermissionStatus: 'caution',
        entryAllowed: false,
        requiresApproval: true,
        safeToReEnterAtUtc: null,
      }),
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/consult farm staff/i)).toBeInTheDocument(),
    );
  });
});
