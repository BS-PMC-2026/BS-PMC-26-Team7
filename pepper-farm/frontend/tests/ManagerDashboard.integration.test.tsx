import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ManagerPage from '@/app/manager/page';
import { LanguageProvider } from '@/context/LanguageContext';
import { getManagerDashboardData } from '@/lib/managerDashboardApi';

jest.mock('@/lib/managerDashboardApi', () => ({
  getManagerDashboardData: jest.fn(),
}));

jest.mock('@/components/map/FarmMap', () => {
  const MockFarmMap = ({ activeFilter, showLegend }: { activeFilter: string | null; showLegend?: boolean }) => (
    <div data-testid="farm-map" data-active-filter={activeFilter ?? 'none'} data-show-legend={String(showLegend)}>
      Mock Farm Map
      {showLegend !== false && <div>Regular Greenhouse</div>}
    </div>
  );
  MockFarmMap.displayName = 'MockFarmMap';
  return {
    __esModule: true,
    default: MockFarmMap,
  };
});

const dashboardData = {
  tasks: [
    {
      id: 1,
      title: 'Handle alert: TestMetric',
      description: 'Hidden description',
      status: 'todo',
      priority: 'high',
      taskType: 'inspection',
      createdByUserId: 1,
      assignedToUserId: 2,
      dueDate: '2026-05-20',
      startedAt: null,
      completedAt: null,
      pepperId: null,
      zoneId: 1,
      zoneCode: 'GH-01',
      anomalyId: null,
      alertInfo: null,
      createdAt: '2026-05-17T00:00:00',
      updatedAt: '2026-05-17T00:00:00',
    },
    {
      id: 2,
      title: 'Completed task',
      description: null,
      status: 'done',
      priority: 'low',
      taskType: 'cleanup',
      createdByUserId: 1,
      assignedToUserId: 2,
      dueDate: '2026-05-21',
      startedAt: null,
      completedAt: '2026-05-17T00:00:00',
      pepperId: null,
      zoneId: 1,
      zoneCode: 'GH-01',
      anomalyId: null,
      alertInfo: null,
      createdAt: '2026-05-17T00:00:00',
      updatedAt: '2026-05-17T00:00:00',
    },
  ],
  users: [{ userId: 2, fullName: 'Field Worker', email: 'worker@example.com', roleName: 'Worker', isActive: true }],
  inventory: [],
  plants: [],
  anomalySummary: { activeAlerts: 1, highSeverity: 0, affectedZones: 1, latestReadingUtc: null },
  zoneHealth: [],
  latestReadings: [{ ReadingId: 1, SensorId: 1, MacAddress: 'AA', Temperature: 22, Humidity: 55, SampleTimeUtc: new Date().toISOString() }],
};

function renderDashboard(locale: 'en' | 'he' = 'en') {
  localStorage.setItem('pepper-farm-locale', locale);
  localStorage.setItem('token', 'token-123');
  localStorage.setItem('fullName', 'Farm Manager');

  return render(
    <LanguageProvider>
      <ManagerPage />
    </LanguageProvider>,
  );
}

describe('Manager dashboard integration', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    (getManagerDashboardData as jest.Mock).mockResolvedValue(dashboardData);
  });

  it('renders open tasks with only title, due date, and assignee details', async () => {
    renderDashboard('en');

    expect(await screen.findByText('Handle alert: TestMetric')).toBeInTheDocument();
    expect(screen.getByText('Field Worker')).toBeInTheDocument();
    expect(screen.queryByText('Completed task')).not.toBeInTheDocument();
    expect(screen.queryByText('Priority')).not.toBeInTheDocument();
    expect(screen.queryByText('Zone')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden description')).not.toBeInTheDocument();
  });

  it('hides the dashboard map legend while keeping map filters and clear behavior', async () => {
    const user = userEvent.setup();
    renderDashboard('en');

    const map = await screen.findByTestId('farm-map');
    expect(map).toHaveAttribute('data-show-legend', 'false');
    expect(screen.queryByText('Regular Greenhouse')).not.toBeInTheDocument();
    expect(map).toHaveAttribute('data-active-filter', 'none');

    await user.click(screen.getByRole('button', { name: /open task/i }));
    expect(screen.getByTestId('farm-map')).toHaveAttribute('data-active-filter', 'task');
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear/i }));
    expect(screen.getByTestId('farm-map')).toHaveAttribute('data-active-filter', 'none');
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
  });

  it('keeps the map wrapper LTR when the dashboard is Hebrew RTL', async () => {
    renderDashboard('he');

    await screen.findByText('לוח ניהול החווה');
    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'));
    expect(screen.getByTestId('farm-map').parentElement).toHaveAttribute('dir', 'ltr');
  });
});
