import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '@/context/LanguageContext';

jest.mock('@/lib/managerDashboardApi', () => ({
  getManagerDashboardData: jest.fn(),
}));

jest.mock('@/services/spray', () => ({
  getZoneSprayMap: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/components/map/FarmMap', () => ({
  __esModule: true,
  default: () => <div data-testid="farm-map-mock" />,
}));

import { getManagerDashboardData } from '@/lib/managerDashboardApi';
import ManagerPage from '@/app/manager/page';

const mockGetData = getManagerDashboardData as jest.Mock;

const EMPTY_DASHBOARD_DATA = {
  tasks: [],
  users: [],
  inventory: [],
  plants: [],
  anomalySummary: null,
  zoneHealth: [],
  latestReadings: [],
};

function renderPage() {
  return render(
    <LanguageProvider>
      <ManagerPage />
    </LanguageProvider>,
  );
}

function legendLabels(): string[] {
  const legend = screen.getByTestId('dashboard-legend');
  return Array.from(legend.querySelectorAll('span.text-xs')).map((el) => el.textContent ?? '');
}

describe('Dashboard Farm Map legend changes by manager mode', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetData.mockResolvedValue(EMPTY_DASHBOARD_DATA);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows the planting legend on initial render', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-legend')).toBeInTheDocument();
    });
    expect(legendLabels()).toEqual(expect.arrayContaining([
      'First planting allowed in Nursery only.',
      'Transfers allowed to: Growing greenhouses, Visitor greenhouses.',
    ]));
  });

  it('switches to the task legend when the Tasks mode is active', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('manager-map-mode-tasks')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('manager-map-mode-tasks'));

    await waitFor(() => {
      expect(legendLabels()).toEqual(expect.arrayContaining(['Has open tasks', 'No open tasks']));
    });
    expect(legendLabels()).not.toContain('First planting allowed in Nursery only.');
  });

  it('switches to the sensor legend when the Sensor mode is active', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('manager-map-mode-sensor')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('manager-map-mode-sensor'));

    await waitFor(() => {
      expect(legendLabels()).toEqual(expect.arrayContaining(['High severity alert', 'Medium severity alert', 'Normal']));
    });
    expect(legendLabels()).not.toContain('First planting allowed in Nursery only.');
  });

  it('switches to the spray legend when the Sprays mode is active', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('manager-map-mode-sprays')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('manager-map-mode-sprays'));

    await waitFor(() => {
      expect(legendLabels()).toEqual(expect.arrayContaining(['Entry Restricted', 'Caution - Consult Manager', 'Entry Permitted']));
    });
  });

  it('moves between modes without toggling back to the old no-filter alert legend', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('manager-map-mode-tasks')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('manager-map-mode-tasks'));
    await waitFor(() => {
      expect(legendLabels()).toContain('Has open tasks');
    });

    fireEvent.click(screen.getByTestId('manager-map-mode-planting'));
    await waitFor(() => {
      expect(legendLabels()).toContain('First planting allowed in Nursery only.');
    });
    expect(legendLabels()).not.toContain('Task + Sensor alert');
  });

  it('active mode button has highlighted styling', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('manager-map-mode-tasks')).toBeInTheDocument();
    });

    const btn = screen.getByTestId('manager-map-mode-tasks');
    expect(btn.className).not.toContain('bg-[var(--color-primary)]');

    fireEvent.click(btn);
    await waitFor(() => {
      expect(btn.className).toContain('bg-green-700');
    });
  });

  it('shows the spray refresh button only in Sprays mode', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('manager-map-mode-planting')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('manager-spray-refresh-button')).toBeNull();

    fireEvent.click(screen.getByTestId('manager-map-mode-sprays'));
    await waitFor(() => {
      expect(screen.getByTestId('manager-spray-refresh-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('manager-map-mode-planting'));
    await waitFor(() => {
      expect(screen.queryByTestId('manager-spray-refresh-button')).toBeNull();
    });
  });
});
