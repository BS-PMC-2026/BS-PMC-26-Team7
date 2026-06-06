/**
 * US37 — Worker Dashboard tests.
 *
 * Covers:
 * - Dashboard renders map, tasks, notifications and analytics.
 * - Completed tasks hidden by default.
 * - Show/hide completed toggle works.
 * - Task card click opens detail modal.
 * - Checklist item toggle calls the correct service.
 * - Overdue task gets urgency-overdue test id.
 * - Near-due task gets urgency-due-soon test id.
 * - Empty / loading / error states render correctly.
 * - Complete task button calls updateTask with status=done.
 * - Map mode selector renders three tabs.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/* ── Navigation mocks ────────────────────────────────────────────────────────── */

const mockRouterReplace = jest.fn();
// Stable object — babel-jest hoists `mock*` vars, so this is accessible in the factory.
// Using a stable reference prevents useCallback([router]) from re-creating loadData on every render.
const mockRouterInstance = { replace: mockRouterReplace, push: jest.fn() };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouterInstance,
  usePathname: () => '/worker',
}));

jest.mock('next/link', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ({ href, children, ...rest }: any) =>
    React.createElement('a', { href, ...rest }, children);
});

/* ── Icon mocks ──────────────────────────────────────────────────────────────── */

jest.mock('lucide-react', () => {
  const icons = [
    'Bell', 'ClipboardList', 'Map', 'BarChart2', 'UserCircle',
    'CheckSquare', 'Square', 'ChevronDown', 'ChevronUp',
  ];
  const mocks: Record<string, React.FC<{ className?: string }>> = {};
  icons.forEach((name) => {
    mocks[name] = ({ className }: { className?: string }) =>
      React.createElement('svg', { 'data-testid': `icon-${name}`, className });
  });
  return mocks;
});

/* ── FarmMap mock ────────────────────────────────────────────────────────────── */

const MOCK_NURSERY_SECTION  = { id: 'NURSERY',  name: 'Nursery',  type: 'nursery',    position: { x: 0, y: 0, width: 100, height: 100 } };
const MOCK_GH01_SECTION     = { id: 'GH-01',    name: 'GH-01',    type: 'greenhouse', position: { x: 0, y: 0, width: 100, height: 100 } };
const MOCK_FACTORY_SECTION  = { id: 'FACTORY',  name: 'Factory',  type: 'factory',    position: { x: 0, y: 0, width: 100, height: 100 } };

jest.mock('@/components/map/FarmMap', () => ({
  __esModule: true,
  default: ({ sectionColors, renderPopupExtra }: { sectionColors?: Record<string, string>; renderPopupExtra?: (s: unknown) => React.ReactNode }) =>
    React.createElement('div', {
      'data-testid': 'farm-map',
      'data-has-colors': sectionColors && Object.keys(sectionColors).length > 0 ? 'true' : 'false',
    }, [
      renderPopupExtra ? React.createElement('div', { key: 'np',  'data-testid': 'popup-nursery'  }, renderPopupExtra(MOCK_NURSERY_SECTION))  : null,
      renderPopupExtra ? React.createElement('div', { key: 'gp',  'data-testid': 'popup-gh01'     }, renderPopupExtra(MOCK_GH01_SECTION))     : null,
      renderPopupExtra ? React.createElement('div', { key: 'fp',  'data-testid': 'popup-factory'  }, renderPopupExtra(MOCK_FACTORY_SECTION))  : null,
    ]),
}));

/* ── TaskProgressBar mock ────────────────────────────────────────────────────── */

jest.mock('@/components/tasks/TaskProgressBar', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'task-progress-bar' }),
}));

/* ── Alert mock ──────────────────────────────────────────────────────────────── */

jest.mock('@/components/ui/Alert', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'alert', role: 'alert' }, children),
}));

/* ── Service mocks ───────────────────────────────────────────────────────────── */

const mockGetMyTasks        = jest.fn();
const mockGetAllPlants      = jest.fn();
const mockGetAllPeppers     = jest.fn();
const mockGetAnalytics      = jest.fn();
const mockUpdateTask        = jest.fn();
const mockUpdateChecklist   = jest.fn();
const mockApiFetch          = jest.fn();
const mockLoadAppNotifs     = jest.fn().mockResolvedValue(undefined);
const mockDismissAppNotif   = jest.fn().mockResolvedValue(undefined);
const mockMarkAllApp        = jest.fn().mockResolvedValue(undefined);
const mockUpdatePlantLoc    = jest.fn().mockResolvedValue({});
const mockUseWorkerNotif    = jest.fn();
const mockGetZones          = jest.fn();
const mockGetPesticides     = jest.fn();
const mockCreateSprayReport = jest.fn();

jest.mock('@/services/tasks', () => ({
  getMyTasks:            (...a: unknown[]) => mockGetMyTasks(...a),
  updateTask:            (...a: unknown[]) => mockUpdateTask(...a),
  updateChecklistItem:   (...a: unknown[]) => mockUpdateChecklist(...a),
}));

jest.mock('@/services/plants', () => ({
  getAllPlants:          (...a: unknown[]) => mockGetAllPlants(...a),
  createPlant:          jest.fn().mockResolvedValue({}),
  updatePlantLocation:  (...a: unknown[]) => mockUpdatePlantLoc(...a),
}));

jest.mock('@/context/WorkerNotificationContext', () => ({
  useWorkerNotification: (...a: unknown[]) => mockUseWorkerNotif(...a),
}));

jest.mock('@/services/peppers', () => ({
  getAllPeppers: (...a: unknown[]) => mockGetAllPeppers(...a),
}));

jest.mock('@/services/workerDashboard', () => ({
  getWorkerAnalytics: (...a: unknown[]) => mockGetAnalytics(...a),
}));

jest.mock('@/services/apiClient', () => ({
  apiFetch: (...a: unknown[]) => mockApiFetch(...a),
}));

jest.mock('@/services/zones', () => ({
  getZones: (...a: unknown[]) => mockGetZones(...a),
}));

jest.mock('@/services/spray', () => ({
  getPesticides: (...a: unknown[]) => mockGetPesticides(...a),
  createSprayReport: (...a: unknown[]) => mockCreateSprayReport(...a),
}));

/* ── i18n mock ───────────────────────────────────────────────────────────────── */

jest.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({
    t: {
      worker: {
        label: 'Worker',
        dashboardTitle: 'My Dashboard',
        dashboardSubtitle: 'Your tasks',
        farmMap: 'Farm Map',
        myTasks: 'My Tasks',
        loadingMap: 'Loading map...',
        loadingTasks: 'Loading tasks...',
        noTasksAssigned: 'No tasks assigned.',
        noTasksMatchFilter: 'No tasks match.',
        failedToLoad: 'Failed to load.',
        failedToUpdateStatus: 'Failed to update.',
        myTasksTitle: 'My Tasks',
        myTasksSubtitle: 'Tasks assigned to you',
        noTasksYet: 'No tasks yet.',
        youHaveNoTasks: 'You have no tasks.',
        sprayReport: 'Spray Report',
        safetyMap: 'Safety Map',
        mapModeTasks: 'Tasks',
        mapModeSprays: 'Sprays',
        mapModePlanting: 'Planting',
        heroTasksSummary: 'Red zones have tasks.',
        heroSpraysSummary: 'Amber zones restricted.',
        heroPlantingSummary: 'Plant in Nursery only.',
        notifications: 'Notifications',
        noNotifications: 'No notifications',
        markAllRead: 'Mark all read',
        analyticsTitle: 'My Performance',
        openTasksCount: 'Open Tasks',
        completedTasksCount: 'Completed Tasks',
        avgCompletionTime: 'Avg. Completion',
        fastestTask: 'Fastest Task',
        slowestTask: 'Slowest Task',
        hoursUnit: 'h',
        noAnalyticsData: 'No analytics data.',
        showCompleted: 'Show completed',
        hideCompleted: 'Hide completed',
        overdue: 'Overdue',
        dueSoon: 'Due Soon',
        taskDetailTitle: 'Task Details',
        checklistSection: 'Checklist',
        completeTask: 'Mark as Completed',
        completing: 'Completing...',
        failedToCompleteTask: 'Failed to complete.',
        overdueAttention: 'OVERDUE',
        nearDueAttention: 'DUE SOON',
        plantingNurseryOnly: 'Nursery only.',
        plantingAllowedZones: 'Allowed: greenhouses.',
        plantingBlockedZones: 'Blocked: factory etc.',
        workerUser: 'Worker',
        noDueDate: 'No due date',
        nurseryPlants: 'Plants in Nursery',
        noNurseryPlants: 'No plants in nursery yet',
        selectForTransfer: 'Select for transfer',
        cancelTransfer: 'Cancel transfer',
        transferPlantHere: 'Transfer here',
        transferring: 'Transferring...',
        transferSeedling: 'Transfer Seedling',
        targetGreenhouse: 'Target Greenhouse',
        confirmTransfer: 'Confirm Transfer',
        dismissNotification: 'Dismiss',
        noNewNotifications: 'No new notifications',
        createSprayReport: 'Create spray report',
        notSprayableZone: 'Cannot spray — not an agricultural zone',
        plantsInZone: 'Plants in zone',
        noPlantsInZone: 'No plants in this zone yet',
        sprayZoneOverview: 'Spray Zone Overview',
        cautionZones: 'Caution',
        openInSprayReport: 'Open spray report',
      },
      tasks: {
        due: 'Due',
        zone: 'Zone',
        typeLabel: 'Type',
        status: 'Status',
        startButton: 'Start',
        completeButton: 'Complete',
        completeBlockedByChecklist: 'Complete checklist first.',
        failedToUpdateChecklistItem: 'Failed to update checklist.',
      },
      map: {
        pleaseSelectPepper: 'Please select pepper.',
        choosePepper: 'Choose pepper',
        selectPepper: 'Select pepper',
        assignedSuccessfully: 'Assigned!',
        failedToAssign: 'Failed.',
        planting: 'Planting...',
        plantHere: 'Plant here',
        selectPepperFirst: 'Select pepper first',
        noOpenTasksInZone: 'No tasks.',
        legendHasTasks: 'Has tasks',
        legendNoTasks: 'No tasks',
      },
      spray: {
        reportType: 'Report type',
        completedNow: 'Completed now',
        plannedForLater: 'Planned for later',
        chooseZone: 'Choose zone',
        choosePesticide: 'Choose pesticide',
        plannedDateTime: 'Planned date/time',
        notesOptional: 'Notes optional',
        notesPlaceholder: 'Add notes',
        characters: 'characters',
        submitting: 'Submitting...',
        submitSprayReport: 'Submit spray report',
        saveSprayPlan: 'Save spray plan',
        loadingFormData: 'Loading form data',
        failedToLoadFormData: 'Failed to load form data',
        selectZoneAndPesticide: 'Select zone and pesticide',
        pickPlannedDate: 'Pick planned date',
        loginRequired: 'Login required',
        sprayReportSubmitted: 'Spray report submitted',
        sprayPlanSaved: 'Spray plan saved',
        failedToSubmitReport: 'Failed to submit report',
        safetyInformation: 'Safety information',
        safeToHarvest: 'Safe to harvest',
        ppeRequired: 'PPE required',
        hazardLevel: 'Hazard level',
        sprayReportTitle: 'Spray Report',
        entryPermitted: 'Entry permitted',
        entryRestricted: 'Entry restricted',
        cautionConsultManager: 'Caution',
        safe: 'Safe',
        refresh: 'Refresh',
        zoneEntryDetails: 'Zone Entry Details',
        zone: 'Zone',
        entryPermission: 'Entry Permission',
        safeReentry: 'Safe Re-entry',
        pesticide: 'Pesticide',
        nextPlanned: 'Next Planned',
        safeToEnter: 'Safe to enter',
      },
      enums: {
        priority: { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' },
        taskStatus: { todo: 'To Do', in_progress: 'In Progress', done: 'Done', cancelled: 'Cancelled' },
        taskType: { inspection: 'Inspection', irrigation: 'Irrigation', planting: 'Planting', other: 'Other' },
      },
      inventory: {
        cancel: 'Cancel',
      },
      common: { new: 'NEW' },
    },
    locale: 'en',
    dir: 'ltr',
  }),
}));

jest.mock('@/i18n/dictionaries', () => ({
  translateEnum: (v: string) => v,
}));

/* ── localStorage mock ───────────────────────────────────────────────────────── */

beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn((key: string) => {
        if (key === 'token') return 'test-token';
        if (key === 'fullName') return 'Test Worker';
        return null;
      }),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    },
    writable: true,
  });
});

/* ── Fixtures ────────────────────────────────────────────────────────────────── */

const now = new Date();
const yesterday = new Date(now.getTime() - 25 * 3_600_000).toISOString();
const tomorrow  = new Date(now.getTime() + 25 * 3_600_000).toISOString();
const inOneHour = new Date(now.getTime() +      3_600_000).toISOString();

const makeTask = (overrides = {}) => ({
  id: 1,
  title: 'Test Task',
  description: null,
  status: 'todo',
  priority: 'medium',
  taskType: 'inspection',
  createdByUserId: 1,
  assignedToUserId: 2,
  dueDate: tomorrow,
  startedAt: null,
  completedAt: null,
  pepperId: null,
  zoneId: 1,
  zoneCode: 'GH-01',
  anomalyId: null,
  alertInfo: null,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  checklistItems: [],
  ...overrides,
});

const makeAnalytics = (overrides = {}) => ({
  openTasksCount: 1,
  completedTasksCount: 0,
  avgCompletionTimeHours: null,
  fastestCompletionTimeHours: null,
  slowestCompletionTimeHours: null,
  fastestTaskTitle: null,
  slowestTaskTitle: null,
  ...overrides,
});

const makeContextValue = (overrides: Record<string, unknown> = {}) => ({
  unreadCount: 0,
  clearUnread: jest.fn(),
  newTasks: [],
  activeTasks: [],
  appNotifs: [],
  appUnreadCount: 0,
  loadAppNotifs: mockLoadAppNotifs,
  dismissAppNotif: mockDismissAppNotif,
  markAllAppNotifsRead: mockMarkAllApp,
  ...overrides,
});

const defaultSetup = () => {
  mockUseWorkerNotif.mockReturnValue(makeContextValue());
  mockGetMyTasks.mockResolvedValue([makeTask()]);
  mockGetAllPlants.mockResolvedValue([]);
  mockGetAllPeppers.mockResolvedValue([]);
  mockGetAnalytics.mockResolvedValue(makeAnalytics());
  mockApiFetch.mockResolvedValue([]);  // spray zones
  mockGetZones.mockResolvedValue([
    { ZoneId: 1, ZoneCode: 'GH-01', ZoneName: 'Greenhouse 1' },
    { ZoneId: 18, ZoneCode: 'FACTORY', ZoneName: 'Factory' },
  ]);
  mockGetPesticides.mockResolvedValue([
    {
      PesticideId: 7,
      Name: 'Neem Oil',
      ActiveIngredient: 'Azadirachtin',
      Manufacturer: null,
      TargetPest: null,
      PreHarvestIntervalDays: null,
      ReEntryIntervalHours: null,
      PpeRequired: null,
      HazardLevel: null,
      VerificationStatus: 'verified',
    },
  ]);
  mockCreateSprayReport.mockResolvedValue({
    report: {},
    safetyWarning: {
      pesticideName: 'Neem Oil',
      verificationStatus: 'verified',
      requiresApproval: false,
      safeToReEnterAtUtc: null,
      safeToHarvestAtUtc: null,
      ppeRequired: null,
      hazardLevel: null,
      message: 'Safe',
    },
  });
};

/* ── Import page (after mocks) ───────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WorkerDashboard = require('@/app/worker/page').default;

const renderDashboard = () => render(React.createElement(WorkerDashboard));

/* ── Tests ───────────────────────────────────────────────────────────────────── */

describe('WorkerDashboard', () => {
  beforeEach(() => {
    // Provide default context value so tests that don't call defaultSetup still work
    mockUseWorkerNotif.mockReturnValue(makeContextValue());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  it('renders loading skeleton while data is fetching', () => {
    mockGetMyTasks.mockReturnValue(new Promise(() => {}));
    mockGetAllPlants.mockResolvedValue([]);
    mockGetAllPeppers.mockResolvedValue([]);
    mockGetAnalytics.mockResolvedValue(makeAnalytics());
    mockApiFetch.mockResolvedValue([]);

    renderDashboard();
    // Loading skeleton uses animate-pulse divs
    const pulsingDivs = document.querySelectorAll('.animate-pulse');
    expect(pulsingDivs.length).toBeGreaterThan(0);
  });

  // ── Renders key sections ───────────────────────────────────────────────────

  it('renders dashboard title', async () => {
    defaultSetup();
    renderDashboard();
    await waitFor(() => expect(screen.getByText('My Dashboard')).toBeInTheDocument());
  });

  it('renders worker name in header', async () => {
    defaultSetup();
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Test Worker')).toBeInTheDocument());
  });

  it('renders farm map', async () => {
    defaultSetup();
    renderDashboard();
    await waitFor(() => expect(screen.getByTestId('farm-map')).toBeInTheDocument());
  });

  it('renders analytics section', async () => {
    defaultSetup();
    renderDashboard();
    await waitFor(() => expect(screen.getByText('My Performance')).toBeInTheDocument());
  });

  it('renders notifications section', async () => {
    defaultSetup();
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Notifications')).toBeInTheDocument());
  });

  it('renders "No new notifications" when empty', async () => {
    defaultSetup();
    renderDashboard();
    await waitFor(() => expect(screen.getByText('No new notifications')).toBeInTheDocument());
  });

  it('renders notifications when present', async () => {
    mockUseWorkerNotif.mockReturnValue(makeContextValue({
      appNotifs: [
        { notificationId: 1, title: 'You have a new task', message: null, notificationType: 'system', isRead: false, createdAtUtc: now.toISOString() },
      ],
    }));
    mockGetMyTasks.mockResolvedValue([]);
    mockGetAllPlants.mockResolvedValue([]);
    mockGetAllPeppers.mockResolvedValue([]);
    mockGetAnalytics.mockResolvedValue(makeAnalytics({ openTasksCount: 0 }));
    mockApiFetch.mockResolvedValue([]);

    renderDashboard();
    await waitFor(() => expect(screen.getByTestId('notification-item')).toBeInTheDocument());
    expect(screen.getByTestId('notification-item').textContent).toMatch('You have a new task');
  });

  // ── Map mode selector ──────────────────────────────────────────────────────

  it('renders three map mode tabs', async () => {
    defaultSetup();
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByTestId('map-mode-tasks')).toBeInTheDocument();
      expect(screen.getByTestId('map-mode-sprays')).toBeInTheDocument();
      expect(screen.getByTestId('map-mode-planting')).toBeInTheDocument();
    });
  });

  it('switches map mode on tab click', async () => {
    defaultSetup();
    renderDashboard();
    await waitFor(() => screen.getByTestId('map-mode-sprays'));

    fireEvent.click(screen.getByTestId('map-mode-sprays'));

    // Hero text changes to spray summary — waitFor allows state update to flush
    await waitFor(() => expect(screen.getByText('Amber zones restricted.')).toBeInTheDocument());
  });

  it('shows planting hero when planting tab is active', async () => {
    defaultSetup();
    renderDashboard();
    await waitFor(() => screen.getByTestId('map-mode-planting'));

    fireEvent.click(screen.getByTestId('map-mode-planting'));
    await waitFor(() => expect(screen.getByText('Plant in Nursery only.')).toBeInTheDocument());
  });

  // ── Task panel ─────────────────────────────────────────────────────────────

  it('shows task title in task panel', async () => {
    defaultSetup();
    renderDashboard();
    // Task title appears in the task panel card (h3) — getAllByText since FarmMap popup may also show it
    await waitFor(() => expect(screen.getAllByText('Test Task').length).toBeGreaterThan(0));
  });

  it('completed tasks are hidden by default', async () => {
    mockGetMyTasks.mockResolvedValue([
      makeTask({ id: 1, title: 'Open Task', status: 'todo' }),
      makeTask({ id: 2, title: 'Done Task', status: 'done', completedAt: now.toISOString() }),
    ]);
    mockGetAllPlants.mockResolvedValue([]);
    mockGetAllPeppers.mockResolvedValue([]);
    mockGetAnalytics.mockResolvedValue(makeAnalytics({ completedTasksCount: 1 }));
    mockApiFetch.mockResolvedValue([]);

    renderDashboard();
    // getAllByText since FarmMap popup (tasks mode) may also render the task title
    await waitFor(() => expect(screen.getAllByText('Open Task').length).toBeGreaterThan(0));

    // Completed task card should NOT be visible before toggle
    expect(screen.queryByTestId('completed-task')).not.toBeInTheDocument();
  });

  it('show completed toggle reveals completed tasks', async () => {
    mockGetMyTasks.mockResolvedValue([
      makeTask({ id: 1, title: 'Open Task', status: 'todo' }),
      makeTask({ id: 2, title: 'Done Task', status: 'done', completedAt: now.toISOString() }),
    ]);
    mockGetAllPlants.mockResolvedValue([]);
    mockGetAllPeppers.mockResolvedValue([]);
    mockGetAnalytics.mockResolvedValue(makeAnalytics({ completedTasksCount: 1 }));
    mockApiFetch.mockResolvedValue([]);

    renderDashboard();
    await waitFor(() => screen.getByTestId('toggle-completed'));

    fireEvent.click(screen.getByTestId('toggle-completed'));

    await waitFor(() =>
      expect(screen.getAllByTestId('completed-task').length).toBeGreaterThan(0),
    );
  });

  it('overdue task gets urgency-overdue test id', async () => {
    mockGetMyTasks.mockResolvedValue([
      makeTask({ id: 1, title: 'Overdue Task', status: 'todo', dueDate: yesterday }),
    ]);
    mockGetAllPlants.mockResolvedValue([]);
    mockGetAllPeppers.mockResolvedValue([]);
    mockGetAnalytics.mockResolvedValue(makeAnalytics());
    mockApiFetch.mockResolvedValue([]);

    renderDashboard();
    await waitFor(() => expect(screen.getByTestId('urgency-overdue')).toBeInTheDocument());
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('near-due task gets urgency-due-soon test id', async () => {
    mockGetMyTasks.mockResolvedValue([
      makeTask({ id: 1, title: 'Near Due Task', status: 'todo', dueDate: inOneHour }),
    ]);
    mockGetAllPlants.mockResolvedValue([]);
    mockGetAllPeppers.mockResolvedValue([]);
    mockGetAnalytics.mockResolvedValue(makeAnalytics());
    mockApiFetch.mockResolvedValue([]);

    renderDashboard();
    await waitFor(() => expect(screen.getByTestId('urgency-due-soon')).toBeInTheDocument());
  });

  // ── Task detail modal ──────────────────────────────────────────────────────

  it('clicking task card opens task detail modal', async () => {
    defaultSetup();
    renderDashboard();

    await waitFor(() => screen.getByTestId('urgency-normal'));
    fireEvent.click(screen.getByTestId('urgency-normal'));

    await waitFor(() => expect(screen.getByTestId('task-detail-modal')).toBeInTheDocument());
  });

  it('modal shows task title', async () => {
    defaultSetup();
    renderDashboard();

    await waitFor(() => screen.getByTestId('urgency-normal'));
    fireEvent.click(screen.getByTestId('urgency-normal'));

    await waitFor(() => screen.getByTestId('task-detail-modal'));
    expect(screen.getAllByText('Test Task').length).toBeGreaterThan(0);
  });

  it('complete task button calls updateTask with done', async () => {
    const task = makeTask({ id: 1, title: 'Completable', status: 'todo' });
    mockGetMyTasks.mockResolvedValue([task]);
    mockGetAllPlants.mockResolvedValue([]);
    mockGetAllPeppers.mockResolvedValue([]);
    mockGetAnalytics.mockResolvedValue(makeAnalytics());
    mockApiFetch.mockResolvedValue([]);
    mockUpdateTask.mockResolvedValue({ ...task, status: 'done' });

    renderDashboard();
    await waitFor(() => screen.getByTestId('urgency-normal'));
    fireEvent.click(screen.getByTestId('urgency-normal'));
    await waitFor(() => screen.getByTestId('complete-task-button'));

    fireEvent.click(screen.getByTestId('complete-task-button'));
    await waitFor(() => expect(mockUpdateTask).toHaveBeenCalledWith(1, { status: 'done' }, 'test-token'));
  });

  it('checklist toggle calls updateChecklistItem', async () => {
    const item = { itemId: 5, title: 'Step 1', isCompleted: false, position: 0 };
    const task = makeTask({ id: 1, checklistItems: [item] });
    mockGetMyTasks.mockResolvedValue([task]);
    mockGetAllPlants.mockResolvedValue([]);
    mockGetAllPeppers.mockResolvedValue([]);
    mockGetAnalytics.mockResolvedValue(makeAnalytics());
    mockApiFetch.mockResolvedValue([]);
    mockUpdateChecklist.mockResolvedValue({ ...item, isCompleted: true });

    renderDashboard();
    await waitFor(() => screen.getByTestId('urgency-normal'));
    fireEvent.click(screen.getByTestId('urgency-normal'));
    await waitFor(() => screen.getByTestId('checklist-items'));

    const checkboxBtn = screen.getByTestId('checklist-item-5');
    fireEvent.click(checkboxBtn);

    await waitFor(() =>
      expect(mockUpdateChecklist).toHaveBeenCalledWith(1, 5, { isCompleted: true }, 'test-token'),
    );
  });

  // ── Analytics section ──────────────────────────────────────────────────────

  it('renders analytics stat tiles', async () => {
    mockGetMyTasks.mockResolvedValue([]);
    mockGetAllPlants.mockResolvedValue([]);
    mockGetAllPeppers.mockResolvedValue([]);
    mockGetAnalytics.mockResolvedValue(makeAnalytics({
      openTasksCount: 3,
      completedTasksCount: 7,
      avgCompletionTimeHours: 2.5,
    }));
    mockApiFetch.mockResolvedValue([]);

    renderDashboard();
    await waitFor(() => expect(screen.getByText('My Performance')).toBeInTheDocument());
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('shows empty analytics state when analytics is null', async () => {
    mockGetMyTasks.mockResolvedValue([]);
    mockGetAllPlants.mockResolvedValue([]);
    mockGetAllPeppers.mockResolvedValue([]);
    mockGetAnalytics.mockRejectedValue(new Error('Analytics unavailable'));
    mockApiFetch.mockResolvedValue([]);

    renderDashboard();
    await waitFor(() => expect(screen.getByText('No analytics data.')).toBeInTheDocument());
  });

  // ── Error state ────────────────────────────────────────────────────────────

  it('shows error alert when data loading fails', async () => {
    mockGetMyTasks.mockRejectedValue(new Error('Server error'));
    mockGetAllPlants.mockResolvedValue([]);
    mockGetAllPeppers.mockResolvedValue([]);
    mockGetAnalytics.mockResolvedValue(makeAnalytics());
    mockApiFetch.mockResolvedValue([]);

    renderDashboard();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('Failed to load.')).toBeInTheDocument();
  });

  // ── Redirect if no token ────────────────────────────────────────────────────

  it('redirects to login if no token', async () => {
    (window.localStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'token') return null;
      return null;
    });

    renderDashboard();
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/login'));

    (window.localStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'token') return 'test-token';
      if (key === 'fullName') return 'Test Worker';
      return null;
    });
  });

  // ── Fix 1: FarmMap sectionColors ──────────────────────────────────────────

  it('passes non-empty sectionColors to FarmMap when tasks exist', async () => {
    mockGetMyTasks.mockResolvedValue([makeTask({ id: 1, zoneCode: 'GH-01', status: 'todo', dueDate: tomorrow })]);
    mockGetAllPlants.mockResolvedValue([]);
    mockGetAllPeppers.mockResolvedValue([]);
    mockGetAnalytics.mockResolvedValue(makeAnalytics());
    mockApiFetch.mockResolvedValue([]);

    renderDashboard();
    await waitFor(() => expect(screen.getByTestId('farm-map')).toBeInTheDocument());
    expect(screen.getByTestId('farm-map').getAttribute('data-has-colors')).toBe('true');
  });

  it('passes non-empty sectionColors in planting mode', async () => {
    defaultSetup();
    renderDashboard();
    await waitFor(() => screen.getByTestId('map-mode-planting'));
    fireEvent.click(screen.getByTestId('map-mode-planting'));
    await waitFor(() =>
      expect(screen.getByTestId('farm-map').getAttribute('data-has-colors')).toBe('true'),
    );
  });

  // ── Fix 2: Notifications — unread only + dismiss (now via context) ──────────

  it('read notifications are NOT shown in the panel', async () => {
    mockUseWorkerNotif.mockReturnValue(makeContextValue({
      appNotifs: [
        { notificationId: 1, title: 'Unread notif', message: null, notificationType: 'system', isRead: false, createdAtUtc: now.toISOString() },
        { notificationId: 2, title: 'Read notif',   message: null, notificationType: 'system', isRead: true,  createdAtUtc: now.toISOString() },
      ],
    }));
    mockGetMyTasks.mockResolvedValue([]);
    mockGetAllPlants.mockResolvedValue([]);
    mockGetAllPeppers.mockResolvedValue([]);
    mockGetAnalytics.mockResolvedValue(makeAnalytics({ openTasksCount: 0 }));
    mockApiFetch.mockResolvedValue([]);

    renderDashboard();
    await waitFor(() => expect(screen.getByText('Unread notif')).toBeInTheDocument());
    expect(screen.queryByText('Read notif')).not.toBeInTheDocument();
  });

  it('dismiss button calls dismissAppNotif from context', async () => {
    mockUseWorkerNotif.mockReturnValue(makeContextValue({
      appNotifs: [
        { notificationId: 7, title: 'Alert: zone issue', message: null, notificationType: 'system', isRead: false, createdAtUtc: now.toISOString() },
      ],
    }));
    mockGetMyTasks.mockResolvedValue([]);
    mockGetAllPlants.mockResolvedValue([]);
    mockGetAllPeppers.mockResolvedValue([]);
    mockGetAnalytics.mockResolvedValue(makeAnalytics({ openTasksCount: 0 }));
    mockApiFetch.mockResolvedValue([]);

    renderDashboard();
    await waitFor(() => expect(screen.getByText('Alert: zone issue')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('dismiss-notification-7'));

    await waitFor(() => expect(mockDismissAppNotif).toHaveBeenCalledWith(7));
  });

  it('mark-all-read button calls markAllAppNotifsRead from context', async () => {
    mockUseWorkerNotif.mockReturnValue(makeContextValue({
      appNotifs: [
        { notificationId: 3, title: 'Notif A', message: null, notificationType: 'system', isRead: false, createdAtUtc: now.toISOString() },
      ],
    }));
    mockGetMyTasks.mockResolvedValue([]);
    mockGetAllPlants.mockResolvedValue([]);
    mockGetAllPeppers.mockResolvedValue([]);
    mockGetAnalytics.mockResolvedValue(makeAnalytics({ openTasksCount: 0 }));
    mockApiFetch.mockResolvedValue([]);

    renderDashboard();
    await waitFor(() => expect(screen.getByText('Notif A')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Mark all read'));
    await waitFor(() => expect(mockMarkAllApp).toHaveBeenCalled());
  });

  // ── Fix 3: Nursery plant list + transfer ──────────────────────────────────

  it('nursery popup shows plant list in planting mode', async () => {
    mockGetMyTasks.mockResolvedValue([]);
    mockGetAllPlants.mockResolvedValue([
      { PlantId: 10, PlantCode: 'CHILI-NURSERY-001', PepperId: 5, ZoneId: 9, Status: 'Growing', IsActive: true },
    ]);
    mockGetAllPeppers.mockResolvedValue([{ PepperId: 5, PepperName: 'Chili Pepper' }]);
    mockGetAnalytics.mockResolvedValue(makeAnalytics({ openTasksCount: 0 }));
    mockApiFetch.mockResolvedValue([]);

    renderDashboard();
    await waitFor(() => screen.getByTestId('map-mode-planting'));
    fireEvent.click(screen.getByTestId('map-mode-planting'));

    await waitFor(() =>
      expect(screen.getByTestId('popup-nursery')).toBeInTheDocument(),
    );
    expect(screen.getByText('Plants in Nursery')).toBeInTheDocument();
    expect(screen.getByText('Chili Pepper')).toBeInTheDocument();
  });

  it('nursery popup shows empty message when no plants in nursery', async () => {
    mockGetMyTasks.mockResolvedValue([]);
    mockGetAllPlants.mockResolvedValue([]);
    mockGetAllPeppers.mockResolvedValue([]);
    mockGetAnalytics.mockResolvedValue(makeAnalytics({ openTasksCount: 0 }));
    mockApiFetch.mockResolvedValue([]);

    renderDashboard();
    await waitFor(() => screen.getByTestId('map-mode-planting'));
    fireEvent.click(screen.getByTestId('map-mode-planting'));

    await waitFor(() =>
      expect(screen.getByText('No plants in nursery yet')).toBeInTheDocument(),
    );
  });

  it('healthy nursery plants expose the dashboard transfer action', async () => {
    mockGetMyTasks.mockResolvedValue([]);
    mockGetAllPlants
      .mockResolvedValueOnce([
        { PlantId: 10, PlantCode: 'CHILI-NURSERY-001', PepperId: 5, ZoneId: 9, Status: 'Healthy', IsActive: true },
      ])
      .mockResolvedValue([]);
    mockGetAllPeppers.mockResolvedValue([{ PepperId: 5, PepperName: 'Chili Pepper' }]);
    mockGetAnalytics.mockResolvedValue(makeAnalytics({ openTasksCount: 0 }));
    mockApiFetch.mockResolvedValue([]);
    mockGetZones.mockResolvedValue([
      { ZoneId: 9, ZoneCode: 'NURSERY', ZoneName: 'Nursery' },
      { ZoneId: 1, ZoneCode: 'GH-01', ZoneName: 'Greenhouse 1' },
    ]);
    mockUpdatePlantLoc.mockResolvedValue({ PlantId: 10, ZoneId: 1 });

    renderDashboard();
    await waitFor(() => screen.getByTestId('map-mode-planting'));
    fireEvent.click(screen.getByTestId('map-mode-planting'));

    await waitFor(() => screen.getByTestId('nursery-plant-10'));
    fireEvent.click(within(screen.getByTestId('nursery-plant-10')).getByRole('button', { name: /transfer/i }));

    await waitFor(() => expect(screen.getByText('Transfer Seedling')).toBeInTheDocument());
  });

  // ── Fix 4: Entry-permitted green in spray mode ────────────────────────────

  it('entry-permitted legend item has green color in spray mode', async () => {
    defaultSetup();
    renderDashboard();
    await waitFor(() => screen.getByTestId('map-mode-sprays'));
    fireEvent.click(screen.getByTestId('map-mode-sprays'));

    await waitFor(() => screen.getByTestId('spray-hero'));
    const legend = screen.getByTestId('spray-hero');
    // The entry-permitted swatch should use the green rgba value, not gray
    const swatches = legend.querySelectorAll('span[style]');
    const greenSwatch = Array.from(swatches).find((el) =>
      (el as HTMLElement).style.backgroundColor.includes('22') ||
      (el as HTMLElement).getAttribute('style')?.includes('22,163,74'),
    );
    expect(greenSwatch).toBeTruthy();
  });

  it('spray mode popup shows Create Spray Report button for sprayable zone', async () => {
    defaultSetup();
    renderDashboard();
    await waitFor(() => screen.getByTestId('map-mode-sprays'));
    fireEvent.click(screen.getByTestId('map-mode-sprays'));

    await waitFor(() => expect(screen.getByTestId('popup-gh01')).toBeInTheDocument());
    expect(screen.getByTestId('create-spray-report-GH-01')).toBeInTheDocument();
  });

  it('opens the same spray report form in a dashboard modal and preselects the clicked zone', async () => {
    defaultSetup();
    renderDashboard();
    await waitFor(() => screen.getByTestId('map-mode-sprays'));
    fireEvent.click(screen.getByTestId('map-mode-sprays'));

    await waitFor(() => expect(screen.getByTestId('create-spray-report-GH-01')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('create-spray-report-GH-01'));

    const modal = await screen.findByTestId('spray-report-modal');
    const zoneSelect = await within(modal).findByLabelText(/zone/i) as HTMLSelectElement;
    await waitFor(() => expect(zoneSelect.value).toBe('1'));

    fireEvent.change(within(modal).getByLabelText(/pesticide/i), { target: { value: '7' } });
    fireEvent.click(within(modal).getByRole('button', { name: /submit spray report/i }));

    await waitFor(() =>
      expect(mockCreateSprayReport).toHaveBeenCalledWith(
        {
          zoneId: 1,
          pesticideId: 7,
          reportType: 'completed',
          plannedAtUtc: undefined,
          notes: undefined,
        },
        'test-token',
      ),
    );
    expect(mockRouterInstance.push).not.toHaveBeenCalled();
  });

  it('spray mode popup shows not-sprayable message for FACTORY zone', async () => {
    defaultSetup();
    renderDashboard();
    await waitFor(() => screen.getByTestId('map-mode-sprays'));
    fireEvent.click(screen.getByTestId('map-mode-sprays'));

    await waitFor(() => expect(screen.getByTestId('popup-factory')).toBeInTheDocument());
    expect(screen.getByText(/Cannot spray/i)).toBeInTheDocument();
  });

  it('spray refresh button is visible in spray mode', async () => {
    defaultSetup();
    renderDashboard();
    await waitFor(() => screen.getByTestId('map-mode-sprays'));
    fireEvent.click(screen.getByTestId('map-mode-sprays'));

    await waitFor(() => expect(screen.getByTestId('spray-refresh-button')).toBeInTheDocument());
  });

  it('zone entry details container is visible in spray mode when zones exist', async () => {
    mockUseWorkerNotif.mockReturnValue(makeContextValue());
    mockGetMyTasks.mockResolvedValue([]);
    mockGetAllPlants.mockResolvedValue([]);
    mockGetAllPeppers.mockResolvedValue([]);
    mockGetAnalytics.mockResolvedValue(makeAnalytics({ openTasksCount: 0 }));
    mockApiFetch.mockResolvedValue([
      {
        zoneId: 1, zoneCode: 'GH-01', zoneName: 'Greenhouse 1',
        sprayStatus: 'safe', entryPermissionStatus: 'allowed', entryAllowed: true,
        entryMessage: 'Entry permitted', lastCompletedAtUtc: null, pesticideName: null,
        safeToReEnterAtUtc: null, nextPlannedAtUtc: null, remainingRestrictionMinutes: null,
      },
    ]);

    renderDashboard();
    await waitFor(() => screen.getByTestId('map-mode-sprays'));
    fireEvent.click(screen.getByTestId('map-mode-sprays'));

    // Container and toggle button should be visible (collapsed by default)
    await waitFor(() => expect(screen.getByTestId('zone-entry-details')).toBeInTheDocument());
    expect(screen.getByText('Zone Entry Details')).toBeInTheDocument();

    // Table is hidden until the toggle is clicked
    expect(screen.queryByTestId('zone-entry-permission-badge')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Zone Entry Details'));
    await waitFor(() => expect(screen.getByTestId('zone-entry-permission-badge')).toBeInTheDocument());
  });

  it('spray hero shows zone status overview in spray mode', async () => {
    mockUseWorkerNotif.mockReturnValue(makeContextValue());
    mockGetMyTasks.mockResolvedValue([]);
    mockGetAllPlants.mockResolvedValue([]);
    mockGetAllPeppers.mockResolvedValue([]);
    mockGetAnalytics.mockResolvedValue(makeAnalytics({ openTasksCount: 0 }));
    mockApiFetch.mockResolvedValue([
      {
        zoneId: 1, zoneCode: 'GH-01', zoneName: 'Greenhouse 1',
        sprayStatus: 'safe', entryPermissionStatus: 'allowed', entryAllowed: true,
        entryMessage: 'Entry permitted', lastCompletedAtUtc: null, pesticideName: null,
        safeToReEnterAtUtc: null, nextPlannedAtUtc: null, remainingRestrictionMinutes: null,
      },
      {
        zoneId: 2, zoneCode: 'GH-02', zoneName: 'Greenhouse 2',
        sprayStatus: 'unsafe', entryPermissionStatus: 'restricted', entryAllowed: false,
        entryMessage: 'Entry restricted', lastCompletedAtUtc: null, pesticideName: 'Confidor',
        safeToReEnterAtUtc: null, nextPlannedAtUtc: null, remainingRestrictionMinutes: 120,
      },
    ]);

    renderDashboard();
    await waitFor(() => screen.getByTestId('map-mode-sprays'));
    fireEvent.click(screen.getByTestId('map-mode-sprays'));

    await waitFor(() => expect(screen.getByTestId('spray-hero')).toBeInTheDocument());
    expect(screen.getByText('Spray Zone Overview')).toBeInTheDocument();
  });

  // ── Fix 5+6: Greenhouse plant list ────────────────────────────────────────

  it('greenhouse popup shows plant list in planting mode', async () => {
    mockUseWorkerNotif.mockReturnValue(makeContextValue());
    mockGetMyTasks.mockResolvedValue([]);
    mockGetAllPlants.mockResolvedValue([
      { PlantId: 20, PlantCode: 'CHILI-GH01-001', PepperId: 5, ZoneId: 1, Status: 'Growing', IsActive: true },
    ]);
    mockGetAllPeppers.mockResolvedValue([{ PepperId: 5, PepperName: 'Bell Pepper' }]);
    mockGetAnalytics.mockResolvedValue(makeAnalytics({ openTasksCount: 0 }));
    mockApiFetch.mockResolvedValue([]);

    renderDashboard();
    await waitFor(() => screen.getByTestId('map-mode-planting'));
    fireEvent.click(screen.getByTestId('map-mode-planting'));

    await waitFor(() => expect(screen.getByTestId('greenhouse-plant-20')).toBeInTheDocument());
    expect(screen.getByText('Bell Pepper')).toBeInTheDocument();
  });

  it('greenhouse popup shows "no plants" when greenhouse is empty', async () => {
    mockUseWorkerNotif.mockReturnValue(makeContextValue());
    mockGetMyTasks.mockResolvedValue([]);
    mockGetAllPlants.mockResolvedValue([]);
    mockGetAllPeppers.mockResolvedValue([]);
    mockGetAnalytics.mockResolvedValue(makeAnalytics({ openTasksCount: 0 }));
    mockApiFetch.mockResolvedValue([]);

    renderDashboard();
    await waitFor(() => screen.getByTestId('map-mode-planting'));
    fireEvent.click(screen.getByTestId('map-mode-planting'));

    await waitFor(() => expect(screen.getByTestId('popup-gh01')).toBeInTheDocument());
    // getAllByText since the message may appear in both nursery and greenhouse popups
    const msgs = screen.getAllByText('No plants in this zone yet');
    expect(msgs.length).toBeGreaterThan(0);
  });
});
