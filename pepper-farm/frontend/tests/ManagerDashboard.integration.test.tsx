import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ManagerPage from '@/app/manager/page';
import { LanguageProvider } from '@/context/LanguageContext';
import { getDictionary } from '@/i18n/dictionaries';
import { getManagerDashboardData } from '@/lib/managerDashboardApi';
import { getAllPeppers } from '@/services/peppers';
import { createPlant, getAllPlants, updatePlantLocation, updatePlantStatus } from '@/services/plants';
import { getZoneSprayMap } from '@/services/spray';

// ── Deep-link navigation mocks ────────────────────────────────────────────────
// Overrides the global jest.setup.ts stub so individual tests can simulate
// `?section=tasks` / `?section=sprays&panel=...` query strings and assert that
// closing a modal calls router.replace('/manager') to strip them.
let mockSearchParamsEntries: Record<string, string> = {};
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockScrollIntoView = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, replace: mockRouterReplace, refresh: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/manager',
  useSearchParams: () => ({ get: (key: string) => mockSearchParamsEntries[key] ?? null }),
}));

jest.mock('@/context/AnomalyNotificationContext', () => ({
  useAnomalyNotification: () => ({ sprayAlerts: [], overdueAlerts: [] }),
}));

jest.mock('@/lib/managerDashboardApi', () => ({
  getManagerDashboardData: jest.fn(),
}));

jest.mock('@/services/spray', () => ({
  getZoneSprayMap: jest.fn(),
}));

jest.mock('@/services/peppers', () => ({
  getAllPeppers: jest.fn(),
}));

jest.mock('@/services/plants', () => ({
  createPlant: jest.fn(),
  getAllPlants: jest.fn(),
  updatePlantLocation: jest.fn(),
  updatePlantStatus: jest.fn(),
}));

jest.mock('@/components/map/FarmMap', () => {
  const MockFarmMap = ({
    activeFilter,
    showLegend,
    sectionColors,
    renderPopupExtra,
  }: {
    activeFilter: string | null;
    showLegend?: boolean;
    sectionColors?: Record<string, string>;
    renderPopupExtra?: (section: { id: string; type: string; name: string; nameEn: string }) => React.ReactNode;
  }) => (
    <div
      data-testid="farm-map"
      data-active-filter={activeFilter ?? 'none'}
      data-show-legend={String(showLegend)}
      data-has-section-colors={String(Boolean(sectionColors && Object.keys(sectionColors).length > 0))}
    >
      Mock Farm Map
      {showLegend !== false && <div>Regular Greenhouse</div>}
      {renderPopupExtra && (
        <>
          <div data-testid="mock-nursery-popup">
            {renderPopupExtra({ id: 'NURSERY', type: 'nursery', name: 'Nursery', nameEn: 'Nursery' })}
          </div>
          <div data-testid="mock-greenhouse-popup">
            {renderPopupExtra({ id: 'GH-01', type: 'greenhouse', name: 'Greenhouse 1', nameEn: 'Greenhouse 1' })}
          </div>
        </>
      )}
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
    mockSearchParamsEntries = {};
    window.HTMLElement.prototype.scrollIntoView = mockScrollIntoView;
    (getManagerDashboardData as jest.Mock).mockResolvedValue(dashboardData);
    (getAllPeppers as jest.Mock).mockResolvedValue([{ PepperId: 7, PepperName: 'Jalapeno' }]);
    (createPlant as jest.Mock).mockResolvedValue({ PlantId: 99 });
    (getAllPlants as jest.Mock).mockResolvedValue([]);
    (updatePlantStatus as jest.Mock).mockResolvedValue({});
    (updatePlantLocation as jest.Mock).mockResolvedValue({});
    (getZoneSprayMap as jest.Mock).mockResolvedValue([
      {
        zoneId: 1,
        zoneCode: 'GH-01',
        zoneName: 'Greenhouse 1',
        sprayStatus: 'unsafe',
        lastCompletedAtUtc: null,
        pesticideName: 'SafeSpray',
        safeToReEnterAtUtc: '2026-06-08T08:00:00Z',
        safeToHarvestAtUtc: null,
        requiresApproval: false,
        hazardLevel: null,
        ppeRequired: null,
        nextPlannedAtUtc: null,
        entryPermissionStatus: 'restricted',
        entryAllowed: false,
        entryMessage: 'Restricted',
        remainingRestrictionMinutes: 90,
      },
    ]);
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

  it('shows manager map modes while keeping the full map type legend hidden', async () => {
    const user = userEvent.setup();
    renderDashboard('en');

    const map = await screen.findByTestId('farm-map');
    const workerText = getDictionary('en').worker;
    expect(map).toHaveAttribute('data-show-legend', 'false');
    expect(screen.queryByText('Regular Greenhouse')).not.toBeInTheDocument();
    const legend = screen.getByTestId('dashboard-legend');
    expect(legend).toHaveTextContent(workerText.plantingNurseryOnly);
    expect(legend).toHaveTextContent(workerText.plantingAllowedZones);
    expect(map).toHaveAttribute('data-active-filter', 'none');

    await user.click(screen.getByTestId('manager-map-mode-tasks'));
    expect(screen.getByTestId('farm-map')).toHaveAttribute('data-active-filter', 'task');

    await user.click(screen.getByTestId('manager-map-mode-sprays'));
    expect(screen.getByTestId('farm-map')).toHaveAttribute('data-active-filter', 'none');
    expect(await screen.findByTestId('manager-spray-overview')).toBeInTheDocument();
    expect(screen.getByTestId('farm-map')).toHaveAttribute('data-has-section-colors', 'true');
  });

  it('opens a manager task detail modal from a dashboard task card', async () => {
    const user = userEvent.setup();
    renderDashboard('en');

    await user.click(await screen.findByRole('button', { name: /handle alert/i }));

    expect(screen.getByTestId('manager-task-detail-modal')).toBeInTheDocument();
    expect(screen.getByText('Hidden description')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /open full task page/i })).not.toBeInTheDocument();
    expect(screen.getByText(/manage this task from the dashboard modal/i)).toBeInTheDocument();
  });

  it('opens the create task modal from the open tasks panel', async () => {
    const user = userEvent.setup();
    renderDashboard('en');

    await user.click(await screen.findByTestId('manager-create-task-button'));

    expect(screen.getByRole('dialog', { name: /create task/i })).toBeInTheDocument();
  });

  it('opens the create task modal from a zone popup in Tasks mode', async () => {
    const user = userEvent.setup();
    renderDashboard('en');

    await user.click(await screen.findByTestId('manager-map-mode-tasks'));
    await user.click(screen.getAllByRole('button', { name: /add task/i })[0]);

    expect(screen.getByRole('dialog', { name: /create task/i })).toBeInTheDocument();
  });

  it('supports planting and plant status updates from the Planting map popup', async () => {
    const user = userEvent.setup();
    renderDashboard('en');

    await screen.findByTestId('mock-nursery-popup');
    await user.selectOptions(screen.getByLabelText(/select pepper/i), '7');
    await user.click(screen.getByRole('button', { name: /plant here/i }));

    expect(createPlant).toHaveBeenCalledWith(expect.objectContaining({
      PepperId: 7,
      ZoneId: 9,
      Status: 'Growing',
      IsActive: true,
    }));
  });

  it('supports healthy nursery plant transfer from dashboard popups', async () => {
    const user = userEvent.setup();
    (getManagerDashboardData as jest.Mock).mockResolvedValue({
      ...dashboardData,
      plants: [{
        PlantId: 20,
        PlantCode: 'NUR-20',
        PepperId: 7,
        ZoneId: 9,
        Status: 'Healthy',
        Notes: null,
        IsActive: true,
      }],
    });

    renderDashboard('en');

    await user.click(await screen.findByRole('button', { name: /^transfer$/i }));
    await user.click(screen.getByTestId('manager-transfer-plant-button'));

    expect(updatePlantLocation).toHaveBeenCalledWith('token-123', 20, 1, expect.any(String));
  });

  it('keeps the map wrapper LTR when the dashboard is Hebrew RTL', async () => {
    renderDashboard('he');

    await screen.findByText('לוח ניהול החווה');
    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'));
    expect(screen.getByTestId('farm-map').parentElement).toHaveAttribute('dir', 'ltr');
  });

  describe('Manage Tasks / Spray Management modals (ported from standalone pages)', () => {
    it('opens the Manage Tasks modal from the dashboard "Tasks" button', async () => {
      const user = userEvent.setup();
      renderDashboard('en');

      await user.click(await screen.findByTestId('manager-manage-tasks-button'));

      expect(screen.getByRole('dialog', { name: 'Tasks' })).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Search completed tasks...')).not.toBeInTheDocument();
    });

    it('clears the URL when the Manage Tasks modal is closed', async () => {
      const user = userEvent.setup();
      renderDashboard('en');

      await user.click(await screen.findByTestId('manager-manage-tasks-button'));
      await user.click(screen.getByRole('button', { name: 'Close Tasks' }));

      expect(mockRouterReplace).toHaveBeenCalledWith('/manager');
      expect(screen.queryByRole('dialog', { name: 'Tasks' })).not.toBeInTheDocument();
    });

    it('opens the Spray Management modal from the sprays map controls', async () => {
      const user = userEvent.setup();
      renderDashboard('en');

      await user.click(await screen.findByTestId('manager-map-mode-sprays'));
      await user.click(await screen.findByTestId('manager-spray-management-button'));

      expect(screen.getByRole('dialog', { name: 'Spray Map' })).toBeInTheDocument();
    });

    it('clears the URL when the Spray Management modal is closed', async () => {
      const user = userEvent.setup();
      renderDashboard('en');

      await user.click(await screen.findByTestId('manager-map-mode-sprays'));
      await user.click(await screen.findByTestId('manager-spray-management-button'));
      await user.click(screen.getByRole('button', { name: 'Close Spray Map' }));

      expect(mockRouterReplace).toHaveBeenCalledWith('/manager');
      expect(screen.queryByRole('dialog', { name: 'Spray Map' })).not.toBeInTheDocument();
    });

    it('opens the Manage Tasks modal on the Active tab via the ?section=tasks deep link', async () => {
      mockSearchParamsEntries = { section: 'tasks' };
      renderDashboard('en');

      expect(await screen.findByRole('dialog', { name: 'Tasks' })).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Search completed tasks...')).not.toBeInTheDocument();
    });

    it('opens the Manage Tasks modal on the History tab via the ?section=tasks&tab=history deep link', async () => {
      mockSearchParamsEntries = { section: 'tasks', tab: 'history' };
      renderDashboard('en');

      expect(await screen.findByRole('dialog', { name: 'Tasks' })).toBeInTheDocument();
      expect(await screen.findByPlaceholderText('Search completed tasks...')).toBeInTheDocument();
    });

    it('opens the Spray Management modal scrolled to alert history via the ?section=sprays&panel=alerts deep link', async () => {
      mockSearchParamsEntries = { section: 'sprays', panel: 'alerts' };
      renderDashboard('en');

      expect(await screen.findByRole('dialog', { name: 'Spray Map' })).toBeInTheDocument();
      await waitFor(() => expect(mockScrollIntoView).toHaveBeenCalled());
    });

    it('opens the Spray Management modal scrolled to overdue alerts via the ?section=sprays&panel=overdue deep link', async () => {
      mockSearchParamsEntries = { section: 'sprays', panel: 'overdue' };
      renderDashboard('en');

      expect(await screen.findByRole('dialog', { name: 'Spray Map' })).toBeInTheDocument();
      await waitFor(() => expect(mockScrollIntoView).toHaveBeenCalled());
    });
  });
});
