import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

function makeTask(
  id: number,
  checklistDone: number,
  checklistTotal: number,
  overrides: Partial<Task> = {},
): Task {
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
    ...overrides,
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

describe('Dashboard – Task urgency grouping', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetData.mockResolvedValue(EMPTY_DASHBOARD_DATA);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('overdue tasks show the overdue group label and urgency style', async () => {
    const pastDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    mockGetData.mockResolvedValue({
      ...EMPTY_DASHBOARD_DATA,
      tasks: [makeTask(1, 0, 0, { dueDate: pastDate })],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('group-label-overdue')).toBeInTheDocument();
    });
    expect(screen.getByTestId('urgency-overdue')).toBeInTheDocument();
    expect(screen.queryByTestId('urgency-due-soon')).toBeNull();
    expect(screen.queryByTestId('urgency-normal')).toBeNull();
  });

  it('due-soon tasks show the due-soon group label and urgency style', async () => {
    const soonDate = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    mockGetData.mockResolvedValue({
      ...EMPTY_DASHBOARD_DATA,
      tasks: [makeTask(2, 0, 0, { dueDate: soonDate })],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('group-label-due-soon')).toBeInTheDocument();
    });
    expect(screen.getByTestId('urgency-due-soon')).toBeInTheDocument();
    expect(screen.queryByTestId('urgency-overdue')).toBeNull();
    expect(screen.queryByTestId('urgency-normal')).toBeNull();
  });

  it('tasks without a due date appear as normal (no group label)', async () => {
    mockGetData.mockResolvedValue({
      ...EMPTY_DASHBOARD_DATA,
      tasks: [makeTask(3, 0, 0)],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('urgency-normal')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('group-label-overdue')).toBeNull();
    expect(screen.queryByTestId('group-label-due-soon')).toBeNull();
    expect(screen.queryByTestId('urgency-overdue')).toBeNull();
    expect(screen.queryByTestId('urgency-due-soon')).toBeNull();
  });

  it('tasks with a far-future due date appear as normal', async () => {
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    mockGetData.mockResolvedValue({
      ...EMPTY_DASHBOARD_DATA,
      tasks: [makeTask(4, 0, 0, { dueDate: futureDate })],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('urgency-normal')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('urgency-overdue')).toBeNull();
    expect(screen.queryByTestId('urgency-due-soon')).toBeNull();
  });

  it('urgency groups appear in correct order: overdue → due-soon → normal', async () => {
    const pastDate   = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const soonDate   = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    mockGetData.mockResolvedValue({
      ...EMPTY_DASHBOARD_DATA,
      tasks: [
        makeTask(1, 0, 0, { dueDate: futureDate }),
        makeTask(2, 0, 0, { dueDate: soonDate }),
        makeTask(3, 0, 0, { dueDate: pastDate }),
      ],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('group-label-overdue')).toBeInTheDocument();
    });
    const container = screen.getByTestId('open-tasks-scroll');
    const overdueLabel  = screen.getByTestId('group-label-overdue');
    const dueSoonLabel  = screen.getByTestId('group-label-due-soon');
    const overdueCard   = screen.getByTestId('urgency-overdue');
    const dueSoonCard   = screen.getByTestId('urgency-due-soon');
    const normalCard    = screen.getByTestId('urgency-normal');

    // DOM order: overdue label → overdue card → due-soon label → due-soon card → normal card
    const allNodes = Array.from(container.querySelectorAll('[data-testid]'));
    const positions = (el: HTMLElement) => allNodes.indexOf(el);
    expect(positions(overdueLabel)).toBeLessThan(positions(overdueCard));
    expect(positions(overdueCard)).toBeLessThan(positions(dueSoonLabel));
    expect(positions(dueSoonLabel)).toBeLessThan(positions(dueSoonCard));
    expect(positions(dueSoonCard)).toBeLessThan(positions(normalCard));
  });
});

describe('Dashboard – Recently completed toggle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('completed tasks are hidden by default and toggle button is visible', async () => {
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    mockGetData.mockResolvedValue({
      ...EMPTY_DASHBOARD_DATA,
      tasks: [makeTask(1, 0, 0, { status: 'done', completedAt: recentDate })],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('toggle-completed')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('completed-task')).toBeNull();
    expect(screen.queryByTestId('group-label-completed')).toBeNull();
  });

  it('recently completed tasks appear after clicking the toggle', async () => {
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    mockGetData.mockResolvedValue({
      ...EMPTY_DASHBOARD_DATA,
      tasks: [makeTask(5, 0, 0, { status: 'done', completedAt: recentDate })],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('toggle-completed')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-completed'));

    await waitFor(() => {
      expect(screen.getByTestId('completed-task')).toBeInTheDocument();
      expect(screen.getByTestId('group-label-completed')).toBeInTheDocument();
    });
  });

  it('toggle hides completed tasks again on second click', async () => {
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    mockGetData.mockResolvedValue({
      ...EMPTY_DASHBOARD_DATA,
      tasks: [makeTask(6, 0, 0, { status: 'done', completedAt: recentDate })],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('toggle-completed')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-completed'));
    await waitFor(() => {
      expect(screen.getByTestId('completed-task')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-completed'));
    await waitFor(() => {
      expect(screen.queryByTestId('completed-task')).toBeNull();
    });
  });

  it('toggle button is not shown when there are no recently completed tasks', async () => {
    mockGetData.mockResolvedValue({
      ...EMPTY_DASHBOARD_DATA,
      tasks: [makeTask(7, 0, 0)],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('urgency-normal')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('toggle-completed')).toBeNull();
  });

  it('tasks completed more than 7 days ago do not appear in the recently completed section', async () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    mockGetData.mockResolvedValue({
      ...EMPTY_DASHBOARD_DATA,
      tasks: [makeTask(8, 0, 0, { status: 'done', completedAt: oldDate })],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('No open tasks')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('toggle-completed')).toBeNull();
    expect(screen.queryByTestId('completed-task')).toBeNull();
  });
});
