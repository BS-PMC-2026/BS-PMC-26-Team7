/**
 * Smoke tests: verify that main translated pages render without crashing
 * in both English and Hebrew. All API services are mocked to return empty data.
 */
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { LanguageProvider } from '@/context/LanguageContext';
import { getDictionary } from '@/i18n/dictionaries';
import type { AnomalySummary } from '@/types/anomaly';

// ── Global mocks ─────────────────────────────────────────────────────────────

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/manager',
  useSearchParams: () => ({ get: (_: string) => null }),
}));

jest.mock('next/link', () => {
  const MockLink = ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('framer-motion', () => ({
  motion: {
    header: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => {
      const { initial, animate, transition, whileHover, ...rest } = props;
      void initial; void animate; void transition; void whileHover;
      return <header {...rest}>{children}</header>;
    },
    div: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => {
      const { initial, animate, exit, transition, ...rest } = props;
      void initial; void animate; void exit; void transition;
      return <div {...rest}>{children}</div>;
    },
    span: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => {
      const { initial, animate, exit, transition, ...rest } = props;
      void initial; void animate; void exit; void transition;
      return <span {...rest}>{children}</span>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('recharts', () => ({
  LineChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/services/anomalies', () => ({
  getAnomalySummary: jest.fn().mockResolvedValue({ activeAlerts: 0, highSeverity: 0, affectedZones: 0, latestReadingUtc: null }),
  getAnomalyTrends: jest.fn().mockResolvedValue([]),
  getZoneHealth: jest.fn().mockResolvedValue([]),
  getRecentAlerts: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/services/inventory', () => ({
  getInventoryList: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/services/tasks', () => ({
  getTasks: jest.fn().mockResolvedValue([]),
  createTask: jest.fn().mockResolvedValue({}),
  updateTask: jest.fn().mockResolvedValue({}),
  getCompletedTasks: jest.fn().mockResolvedValue([]),
  getTasksReportByWorker: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/services/users', () => ({
  getAllUsers: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/services/zones', () => ({
  getZones: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/services/sensors', () => ({
  getSensors: jest.fn().mockResolvedValue([]),
  getLatestSensorReading: jest.fn().mockResolvedValue(null),
  getSensorReadingsByRange: jest.fn().mockResolvedValue([]),
  getSensorAlerts: jest.fn().mockResolvedValue([]),
  refreshSensorLive: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/services/reports', () => ({
  getInventoryReport: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/services/peppers', () => ({
  getAllPeppers: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/context/AnomalyNotificationContext', () => ({
  AnomalyNotificationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAnomalyNotification: () => ({
    unreadCount: 0,
    clearUnread: jest.fn(),
    liveAlerts: [],
    completedTasks: [],
  }),
}));

jest.mock('@/context/WorkerNotificationContext', () => ({
  WorkerNotificationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useWorkerNotification: () => ({
    unreadCount: 0,
    clearUnread: jest.fn(),
    newTasks: [],
    activeTasks: [],
  }),
}));

jest.mock('@/context/ToastContext', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock('@/components/sensors/ExportModal', () => {
  const ExportModal = () => null;
  ExportModal.displayName = 'ExportModal';
  return ExportModal;
});

jest.mock('@/components/anomalies/AnomalyDashboardEmbed', () => {
  const AnomalyDashboardEmbed = () => <div data-testid="anomaly-embed-mock">AnomalyDashboard</div>;
  AnomalyDashboardEmbed.displayName = 'AnomalyDashboardEmbed';
  return AnomalyDashboardEmbed;
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'pepper-farm-locale';

async function renderInProvider(ui: React.ReactElement, locale?: 'en' | 'he') {
  if (locale) localStorage.setItem(STORAGE_KEY, locale);
  await act(async () => { render(<LanguageProvider>{ui}</LanguageProvider>); });
}

// ── 1. Manager Dashboard ─────────────────────────────────────────────────────

describe('Manager Dashboard page smoke test', () => {
  beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); });

  it('renders in English without crashing', async () => {
    const ManagerPage = (await import('@/app/manager/page')).default;
    await renderInProvider(<ManagerPage />, 'en');
    expect(screen.getByText(new RegExp(getDictionary('en').manager.title))).toBeInTheDocument();
  });

  it('renders in Hebrew without crashing', async () => {
    const ManagerPage = (await import('@/app/manager/page')).default;
    await renderInProvider(<ManagerPage />, 'he');
    expect(screen.getByText(new RegExp(getDictionary('he').manager.title))).toBeInTheDocument();
  });

  it('renders translated user management label in English', async () => {
    const ManagerPage = (await import('@/app/manager/page')).default;
    await renderInProvider(<ManagerPage />, 'en');
    expect(screen.getByText(new RegExp(getDictionary('en').manager.userManagement))).toBeInTheDocument();
  });

  it('renders translated user management label in Hebrew', async () => {
    const ManagerPage = (await import('@/app/manager/page')).default;
    await renderInProvider(<ManagerPage />, 'he');
    expect(screen.getByText(new RegExp(getDictionary('he').manager.userManagement))).toBeInTheDocument();
  });
});

// ── 2. Inventory page ────────────────────────────────────────────────────────

describe('Inventory page smoke test', () => {
  beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); });

  it('renders in English without crashing', async () => {
    const InventoryPage = (await import('@/app/manager/inventory/page')).default;
    await renderInProvider(<InventoryPage />, 'en');
  });

  it('renders in Hebrew without crashing', async () => {
    const InventoryPage = (await import('@/app/manager/inventory/page')).default;
    await renderInProvider(<InventoryPage />, 'he');
  });

  it('renders translated title in English', async () => {
    const InventoryPage = (await import('@/app/manager/inventory/page')).default;
    await renderInProvider(<InventoryPage />, 'en');
    expect(screen.getByText(getDictionary('en').inventory.title)).toBeInTheDocument();
  });

  it('renders translated title in Hebrew', async () => {
    const InventoryPage = (await import('@/app/manager/inventory/page')).default;
    await renderInProvider(<InventoryPage />, 'he');
    expect(screen.getByText(getDictionary('he').inventory.title)).toBeInTheDocument();
  });
});

// ── 3. Tasks page ────────────────────────────────────────────────────────────

describe('Tasks page smoke test', () => {
  beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); });

  it('renders in English without crashing', async () => {
    const TasksPage = (await import('@/app/manager/tasks/page')).default;
    await renderInProvider(<TasksPage />, 'en');
  });

  it('renders in Hebrew without crashing', async () => {
    const TasksPage = (await import('@/app/manager/tasks/page')).default;
    await renderInProvider(<TasksPage />, 'he');
  });

  it('renders translated tasks title in English', async () => {
    const TasksPage = (await import('@/app/manager/tasks/page')).default;
    await renderInProvider(<TasksPage />, 'en');
    expect(screen.getByText(getDictionary('en').tasks.title)).toBeInTheDocument();
  });

  it('renders translated tasks title in Hebrew', async () => {
    const TasksPage = (await import('@/app/manager/tasks/page')).default;
    await renderInProvider(<TasksPage />, 'he');
    expect(screen.getByText(getDictionary('he').tasks.title)).toBeInTheDocument();
  });
});

// ── 4. Sensors page ──────────────────────────────────────────────────────────

describe('Sensors page smoke test', () => {
  beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); });

  it('renders in English without crashing', async () => {
    const SensorsPage = (await import('@/app/manager/sensors/page')).default;
    await renderInProvider(<SensorsPage />, 'en');
  });

  it('renders in Hebrew without crashing', async () => {
    const SensorsPage = (await import('@/app/manager/sensors/page')).default;
    await renderInProvider(<SensorsPage />, 'he');
  });

  it('renders translated sensors empty state in English', async () => {
    const SensorsPage = (await import('@/app/manager/sensors/page')).default;
    await renderInProvider(<SensorsPage />, 'en');
    expect(screen.getByText(getDictionary('en').sensors.noSensorsFound)).toBeInTheDocument();
  });

  it('renders translated sensors empty state in Hebrew', async () => {
    const SensorsPage = (await import('@/app/manager/sensors/page')).default;
    await renderInProvider(<SensorsPage />, 'he');
    expect(screen.getByText(getDictionary('he').sensors.noSensorsFound)).toBeInTheDocument();
  });
});

// ── 5. AnomalySummaryCards component ─────────────────────────────────────────

describe('AnomalySummaryCards component smoke test', () => {
  const mockSummary: AnomalySummary = {
    activeAlerts: 3,
    highSeverity: 1,
    affectedZones: 2,
    latestReadingUtc: '2024-01-15T10:00:00Z',
  };

  beforeEach(() => { localStorage.clear(); });

  it('renders in English without crashing', async () => {
    const AnomalySummaryCards = (await import('@/components/anomalies/AnomalySummaryCards')).default;
    await renderInProvider(<AnomalySummaryCards summary={mockSummary} />, 'en');
  });

  it('renders in Hebrew without crashing', async () => {
    const AnomalySummaryCards = (await import('@/components/anomalies/AnomalySummaryCards')).default;
    await renderInProvider(<AnomalySummaryCards summary={mockSummary} />, 'he');
  });

  it('renders translated anomaly summary label in English', async () => {
    const AnomalySummaryCards = (await import('@/components/anomalies/AnomalySummaryCards')).default;
    await renderInProvider(<AnomalySummaryCards summary={mockSummary} />, 'en');
    expect(screen.getByText(getDictionary('en').anomalies.activeAnomalies)).toBeInTheDocument();
  });

  it('renders translated anomaly summary label in Hebrew', async () => {
    const AnomalySummaryCards = (await import('@/components/anomalies/AnomalySummaryCards')).default;
    await renderInProvider(<AnomalySummaryCards summary={mockSummary} />, 'he');
    expect(screen.getByText(getDictionary('he').anomalies.activeAnomalies)).toBeInTheDocument();
  });

  it('alert count value is same numeric value in both languages', async () => {
    const AnomalySummaryCards = (await import('@/components/anomalies/AnomalySummaryCards')).default;
    for (const locale of ['en', 'he'] as const) {
      localStorage.setItem(STORAGE_KEY, locale);
      let unmount!: () => void;
      await act(async () => {
        ({ unmount } = render(
          <LanguageProvider>
            <AnomalySummaryCards summary={mockSummary} />
          </LanguageProvider>
        ));
      });
      expect(screen.getByText('3')).toBeInTheDocument();
      unmount();
      localStorage.clear();
    }
  });
});

// ── 6. Visitor page ──────────────────────────────────────────────────────────

describe('Visitor page smoke test', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('renders in English without crashing', async () => {
    const VisitorPage = (await import('@/app/visitor/page')).default;
    await renderInProvider(<VisitorPage />, 'en');
  });

  it('renders in Hebrew without crashing', async () => {
    const VisitorPage = (await import('@/app/visitor/page')).default;
    await renderInProvider(<VisitorPage />, 'he');
  });
});
