import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '@/context/LanguageContext';

jest.mock('@/lib/managerDashboardApi', () => ({
  getManagerDashboardData: jest.fn(),
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

describe('Dashboard – Farm Map legend changes by active filter', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetData.mockResolvedValue(EMPTY_DASHBOARD_DATA);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows the default (no-filter) alert legend on initial render', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-legend')).toBeInTheDocument();
    });
    const labels = legendLabels();
    expect(labels).toContain('Task + Sensor alert');
    expect(labels).toContain('Open task');
    expect(labels).toContain('Sensor anomaly');
    expect(labels).toContain('No alerts');
  });

  it('switches to the pepper legend when the Pepper filter is active', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('filter-pepper')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('filter-pepper'));

    await waitFor(() => {
      const labels = legendLabels();
      expect(labels).toContain('Has planted pepper');
      expect(labels).toContain('No pepper assigned');
    });
    const labels = legendLabels();
    expect(labels).not.toContain('Task + Sensor alert');
    expect(labels).not.toContain('Has open tasks');
  });

  it('switches to the task legend when the Task filter is active', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('filter-task')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('filter-task'));

    await waitFor(() => {
      const labels = legendLabels();
      expect(labels).toContain('Has open tasks');
      expect(labels).toContain('No open tasks');
    });
    const labels = legendLabels();
    expect(labels).not.toContain('Task + Sensor alert');
    expect(labels).not.toContain('Has planted pepper');
  });

  it('switches to the sensor legend when the Sensor filter is active', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('filter-sensor')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('filter-sensor'));

    await waitFor(() => {
      const labels = legendLabels();
      expect(labels).toContain('High severity alert');
      expect(labels).toContain('Medium severity alert');
      expect(labels).toContain('Normal');
    });
    const labels = legendLabels();
    expect(labels).not.toContain('Task + Sensor alert');
  });

  it('restores the default legend when clear button is clicked', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('filter-pepper')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('filter-pepper'));
    await waitFor(() => {
      expect(legendLabels()).toContain('Has planted pepper');
    });

    fireEvent.click(screen.getByTestId('filter-clear'));
    await waitFor(() => {
      const labels = legendLabels();
      expect(labels).toContain('Task + Sensor alert');
      expect(labels).toContain('No alerts');
    });
  });

  it('toggles the same filter off (re-click) and restores the default legend', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('filter-task')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('filter-task'));
    await waitFor(() => {
      expect(legendLabels()).toContain('Has open tasks');
    });

    // Re-clicking the same filter button turns it off
    fireEvent.click(screen.getByTestId('filter-task'));
    await waitFor(() => {
      const labels = legendLabels();
      expect(labels).toContain('Task + Sensor alert');
    });
  });

  it('active filter button has highlighted styling', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('filter-pepper')).toBeInTheDocument();
    });

    const btn = screen.getByTestId('filter-pepper');
    expect(btn.className).not.toContain('bg-[var(--color-primary)]');

    fireEvent.click(btn);
    await waitFor(() => {
      expect(btn.className).toContain('bg-[var(--color-primary)]');
    });
  });

  it('clear button is visible only when a filter is active', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('filter-pepper')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('filter-clear')).toBeNull();

    fireEvent.click(screen.getByTestId('filter-pepper'));
    await waitFor(() => {
      expect(screen.getByTestId('filter-clear')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('filter-clear'));
    await waitFor(() => {
      expect(screen.queryByTestId('filter-clear')).toBeNull();
    });
  });
});
