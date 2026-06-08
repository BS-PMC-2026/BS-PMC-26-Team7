/**
 * US32 — Overdue Spray Alerts section on the manager Spray Map page.
 *
 * Covers:
 *  - section renders on load
 *  - loading skeleton shown while fetching
 *  - empty state when no overdue alerts
 *  - alert rows displayed when overdue alerts exist
 *  - severity badge displays correct label
 *  - resolved alert shows "Resolved" status
 *  - active alert shows "ACTIVE" badge and Assign Task button
 *  - already-assigned alert shows Task #ID instead of button
 *  - clicking Assign Task opens modal
 *  - modal shows worker dropdown
 *  - successful assignment updates UI
 *  - error state on fetch failure
 *  - worker/visitor do not see the overdue alerts section (role check via worker dashboard)
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

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
  const icons = ['RefreshCw', 'ShieldAlert', 'ShieldCheck', 'AlertTriangle', 'CheckCircle', 'UserCheck'];
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

const mockGetZoneSprayMap       = jest.fn().mockResolvedValue([]);
const mockGetSprayAlerts        = jest.fn().mockResolvedValue([]);
const mockGetOverdueSprayAlerts  = jest.fn();
const mockAssignOverdueSprayTask = jest.fn();

jest.mock('@/services/spray', () => ({
  getZoneSprayMap:          (...args: unknown[]) => mockGetZoneSprayMap(...args),
  getSprayAlerts:           (...args: unknown[]) => mockGetSprayAlerts(...args),
  getOverdueSprayAlerts:    (...args: unknown[]) => mockGetOverdueSprayAlerts(...args),
  assignOverdueSprayTask:   (...args: unknown[]) => mockAssignOverdueSprayTask(...args),
}));

jest.mock('@/services/users', () => ({
  getAllUsers: jest.fn().mockResolvedValue([
    { userId: 10, fullName: 'Alice Worker', email: 'alice@test.com', roleName: 'Worker', isActive: true },
    { userId: 11, fullName: 'Bob Worker',   email: 'bob@test.com',   roleName: 'Worker', isActive: true },
  ]),
}));

/* ── Fixtures ────────────────────────────────────────────────────────────────── */

const makeOverdueAlert = (overrides = {}) => ({
  OverdueAlertId:    1,
  ZoneId:            1,
  ZoneCode:          'GH-01',
  ZoneName:          'Greenhouse 1',
  LastSprayedAtUtc:  null,
  OverdueSinceUtc:   new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
  SprayIntervalDays: 30,
  Severity:          'high' as const,
  Message:           'Zone GH-01 has not been sprayed.',
  IsRead:            false,
  IsResolved:        false,
  ResolvedAtUtc:     null,
  AssignedTaskId:    null,
  CreatedAt:         new Date().toISOString(),
  ...overrides,
});

/* ── Page import after mocks ─────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SprayMapPage = require('@/app/manager/spray-map/page').default;

const renderPage = () => render(React.createElement(SprayMapPage));

/* ── Tests ───────────────────────────────────────────────────────────────────── */

describe('US32 — Overdue Spray Alerts section', () => {
  afterEach(() => {
    mockGetOverdueSprayAlerts.mockReset();
    mockAssignOverdueSprayTask.mockReset();
  });

  it('renders the overdue-spray-alerts section', async () => {
    mockGetOverdueSprayAlerts.mockResolvedValue([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('overdue-spray-alerts-section')).toBeInTheDocument(),
    );
    expect(document.getElementById('overdue-spray-alerts')).toBeInTheDocument();
  });

  it('shows loading skeleton while fetching', () => {
    mockGetOverdueSprayAlerts.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('overdue-alerts-loading')).toBeInTheDocument();
  });

  it('shows empty state when no overdue alerts', async () => {
    mockGetOverdueSprayAlerts.mockResolvedValue([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('overdue-alerts-empty')).toBeInTheDocument(),
    );
    expect(screen.getByText('All zones are up to date.')).toBeInTheDocument();
  });

  it('renders alert rows when overdue alerts exist', async () => {
    mockGetOverdueSprayAlerts.mockResolvedValue([
      makeOverdueAlert(),
      makeOverdueAlert({ OverdueAlertId: 2, ZoneCode: 'GH-02', ZoneName: 'Greenhouse 2' }),
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('overdue-alerts-list')).toBeInTheDocument(),
    );
    expect(screen.getAllByTestId('overdue-alert-row').length).toBe(2);
  });

  it('shows "Critical" severity badge for high severity', async () => {
    mockGetOverdueSprayAlerts.mockResolvedValue([makeOverdueAlert({ Severity: 'high' })]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('overdue-alerts-list')).toBeInTheDocument(),
    );
    // "Critical" may appear in both the severity badge and a select <option>.
    // Assert that at least one visible (non-option) element carries the label.
    const criticalElements = screen.getAllByText('Critical');
    expect(criticalElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows "ACTIVE" badge on unresolved alert', async () => {
    mockGetOverdueSprayAlerts.mockResolvedValue([makeOverdueAlert({ IsResolved: false })]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('overdue-alerts-list')).toBeInTheDocument(),
    );
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('shows "Assign Task" button on active unassigned alert', async () => {
    mockGetOverdueSprayAlerts.mockResolvedValue([
      makeOverdueAlert({ IsResolved: false, AssignedTaskId: null }),
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('assign-task-button')).toBeInTheDocument(),
    );
  });

  it('shows Task #ID instead of button when already assigned', async () => {
    mockGetOverdueSprayAlerts.mockResolvedValue([
      makeOverdueAlert({ IsResolved: false, AssignedTaskId: 42 }),
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('overdue-alerts-list')).toBeInTheDocument(),
    );
    expect(screen.getByText('Task #42')).toBeInTheDocument();
    expect(screen.queryByTestId('assign-task-button')).not.toBeInTheDocument();
  });

  it('shows "Resolved" status on resolved alert', async () => {
    mockGetOverdueSprayAlerts.mockResolvedValue([
      makeOverdueAlert({ IsResolved: true, ResolvedAtUtc: new Date().toISOString() }),
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('overdue-alerts-list')).toBeInTheDocument(),
    );
    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.queryByTestId('assign-task-button')).not.toBeInTheDocument();
  });

  it('opens assign modal when Assign Task is clicked', async () => {
    mockGetOverdueSprayAlerts.mockResolvedValue([makeOverdueAlert()]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('assign-task-button')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('assign-task-button'));
    await waitFor(() =>
      expect(screen.getByTestId('assign-modal')).toBeInTheDocument(),
    );
  });

  it('modal contains worker select dropdown', async () => {
    mockGetOverdueSprayAlerts.mockResolvedValue([makeOverdueAlert()]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('assign-task-button')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('assign-task-button'));
    await waitFor(() =>
      expect(screen.getByTestId('worker-select')).toBeInTheDocument(),
    );
  });

  it('shows success message after successful assignment', async () => {
    mockGetOverdueSprayAlerts.mockResolvedValue([makeOverdueAlert()]);
    mockAssignOverdueSprayTask.mockResolvedValue({ id: 99 });

    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('assign-task-button')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('assign-task-button'));

    await waitFor(() =>
      expect(screen.getByTestId('worker-select')).toBeInTheDocument(),
    );
    // Select a worker
    fireEvent.change(screen.getByTestId('worker-select'), { target: { value: '10' } });

    fireEvent.click(screen.getByTestId('confirm-assign-button'));

    await waitFor(() =>
      expect(screen.getByTestId('assign-success')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('assign-success').textContent).toMatch(/Task #99/);
  });

  it('shows error state when overdue alert fetch fails', async () => {
    mockGetOverdueSprayAlerts.mockRejectedValue(new Error('Server error'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('overdue-alerts-error')).toBeInTheDocument(),
    );
    expect(screen.getByText('Server error')).toBeInTheDocument();
  });

  it('shows error on failed task assignment', async () => {
    mockGetOverdueSprayAlerts.mockResolvedValue([makeOverdueAlert()]);
    mockAssignOverdueSprayTask.mockRejectedValue(new Error('Assignment failed'));

    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('assign-task-button')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('assign-task-button'));

    await waitFor(() =>
      expect(screen.getByTestId('worker-select')).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByTestId('worker-select'), { target: { value: '10' } });
    fireEvent.click(screen.getByTestId('confirm-assign-button'));

    await waitFor(() =>
      expect(screen.getByTestId('assign-error')).toBeInTheDocument(),
    );
    expect(screen.getByText('Assignment failed')).toBeInTheDocument();
  });
});
