import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/context/LanguageContext';
import { Task } from '@/types/task';

// Mock the dashboard API so we don't hit the network
jest.mock('@/lib/managerDashboardApi', () => ({
  getManagerDashboardData: jest.fn(),
}));

// Mock FarmMap — it pulls in browser-only canvas APIs
jest.mock('@/components/map/FarmMap', () => ({
  __esModule: true,
  default: () => <div data-testid="farm-map-mock" />,
}));

import { getManagerDashboardData } from '@/lib/managerDashboardApi';
import ManagerPage from '@/app/manager/page';

const mockGetData = getManagerDashboardData as jest.Mock;

function makeTask(id: number, checklistDone: number, checklistTotal: number): Task {
  return {
    id,
    title: `Task ${id}`,
    description: null,
    status: 'todo',
    priority: 'medium',
    taskType: 'inspection',
    createdByUserId: 1,
    assignedToUserId: null,
    dueDate: null,
    startedAt: null,
    completedAt: null,
    pepperId: null,
    zoneId: null,
    zoneCode: null,
    anomalyId: null,
    alertInfo: null,
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
    checklistItems: Array.from({ length: checklistTotal }, (_, i) => ({
      itemId: i + 1,
      title: `Step ${i + 1}`,
      isCompleted: i < checklistDone,
      position: i,
    })),
  };
}

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

describe('Dashboard – Open Tasks card', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetData.mockResolvedValue(EMPTY_DASHBOARD_DATA);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows empty state when there are no open tasks', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('No open tasks')).toBeInTheDocument();
    });
  });

  it('renders the scrollable container when open tasks exist', async () => {
    mockGetData.mockResolvedValue({
      ...EMPTY_DASHBOARD_DATA,
      tasks: [makeTask(1, 0, 0)],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('open-tasks-scroll')).toBeInTheDocument();
    });
    const scroll = screen.getByTestId('open-tasks-scroll');
    expect(scroll.className).toContain('overflow-y-auto');
    expect(scroll.className).toContain('max-h-');
  });

  it('renders all open tasks without a cap', async () => {
    const tenTasks = Array.from({ length: 10 }, (_, i) => makeTask(i + 1, 0, 0));
    mockGetData.mockResolvedValue({
      ...EMPTY_DASHBOARD_DATA,
      tasks: tenTasks,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(10);
    });
  });

  it('shows open tasks count label', async () => {
    const tasks = [makeTask(1, 0, 0), makeTask(2, 0, 0), makeTask(3, 0, 0)];
    mockGetData.mockResolvedValue({ ...EMPTY_DASHBOARD_DATA, tasks });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('3 open tasks')).toBeInTheDocument();
    });
  });

  it('shows progress bar for a task that has checklist items', async () => {
    mockGetData.mockResolvedValue({
      ...EMPTY_DASHBOARD_DATA,
      tasks: [makeTask(1, 0, 2)],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('task-progress-bar')).toBeInTheDocument();
    });
    const bar = screen.getByTestId('task-progress-bar') as HTMLElement;
    expect(bar.style.width).toBe('0%');
  });

  it('shows 50% progress for a task with 1 of 2 checklist items done', async () => {
    mockGetData.mockResolvedValue({
      ...EMPTY_DASHBOARD_DATA,
      tasks: [makeTask(1, 1, 2)],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('task-progress-bar')).toBeInTheDocument();
    });
    const bar = screen.getByTestId('task-progress-bar') as HTMLElement;
    expect(bar.style.width).toBe('50%');
  });

  it('shows 100% progress for a task with all checklist items done', async () => {
    mockGetData.mockResolvedValue({
      ...EMPTY_DASHBOARD_DATA,
      tasks: [makeTask(1, 2, 2)],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('task-progress-bar')).toBeInTheDocument();
    });
    const bar = screen.getByTestId('task-progress-bar') as HTMLElement;
    expect(bar.style.width).toBe('100%');
  });

  it('does not show a progress bar for a task with no checklist items', async () => {
    mockGetData.mockResolvedValue({
      ...EMPTY_DASHBOARD_DATA,
      tasks: [makeTask(1, 0, 0)],
    });
    renderPage();
    await waitFor(() => {
      // task renders
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('task-progress-bar')).toBeNull();
  });

  it('does not call getManagerDashboardData more than twice on initial render (Strict Mode allows 2)', async () => {
    mockGetData.mockResolvedValue(EMPTY_DASHBOARD_DATA);
    renderPage();
    await waitFor(() => {
      expect(mockGetData).toHaveBeenCalled();
    });
    expect(mockGetData.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
