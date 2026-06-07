/**
 * Integration tests for ManagerNavbar
 * Covers: rendering, navigation links, Inventory dropdown, bell panel,
 * notification badge, logout, and active-link highlighting.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ManagerNavbar from '@/components/layout/ManagerNavbar';

/* -------------------------------------------------------------------------- */
/* Mocks                                                                        */
/* -------------------------------------------------------------------------- */

const mockPush = jest.fn();
let mockPathname = '/manager';

jest.mock('next/navigation', () => ({
  useRouter:   () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

// Framer-motion: render children without animations.
// The cache MUST be inside the factory to avoid jest-hoist / TDZ issues.
jest.mock('framer-motion', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react');
  const cache: Record<string, unknown> = {};
  return {
    motion: new Proxy(
      {},
      {
        get: (_: unknown, tag: string) => {
          if (!cache[tag]) {
            const Comp = ({ children, ...props }: Record<string, unknown> & { children?: unknown }) => {
              const { initial, animate, exit, transition, whileHover, whileTap, ...rest } = props;
              void initial; void animate; void exit; void transition; void whileHover; void whileTap;
              return R.createElement(tag, rest, children);
            };
            Comp.displayName = `motion.${tag}`;
            cache[tag] = Comp;
          }
          return cache[tag];
        },
      },
    ),
    AnimatePresence: ({ children }: { children: unknown }) => children,
  };
});

jest.mock('lucide-react', () => {
  const icons = [
    'LayoutDashboard','ClipboardList','Radio','Leaf','ShoppingBag','Boxes',
    'Sprout','BarChart2','Users','Bell','LogOut','ChevronDown','AlertTriangle',
    'CheckCircle2','X','ExternalLink','Droplets','ShieldAlert','ShieldCheck','Clock',
    // US39/US41 icons added to ManagerNavbar
    'Mail','Tag','Package','UserCheck',
  ];
  const mocks: Record<string, React.FC<{ size?: number }>> = {};
  icons.forEach((name) => {
    mocks[name] = ({ size }: { size?: number }) =>
      React.createElement('svg', { 'data-testid': `icon-${name}`, width: size });
  });
  return mocks;
});

jest.mock('@/components/LanguageSwitcher', () => () => React.createElement('div', { 'data-testid': 'language-switcher' }));

const mockClearUnread = jest.fn();
const mockAcknowledgeSprayAlert = jest.fn();

const defaultAnomalyContext = {
  unreadCount:             0,
  clearUnread:             mockClearUnread,
  liveAlerts:              [] as never[],
  completedTasks:          [] as never[],
  sprayAlerts:             [] as never[],
  sprayUnreadCount:        0,
  acknowledgeSprayAlert:   mockAcknowledgeSprayAlert,
};

let anomalyContextValue = { ...defaultAnomalyContext };

jest.mock('@/context/AnomalyNotificationContext', () => ({
  useAnomalyNotification: () => anomalyContextValue,
}));

/* -------------------------------------------------------------------------- */
/* Helpers                                                                      */
/* -------------------------------------------------------------------------- */

const renderNavbar = () => render(React.createElement(ManagerNavbar));

/* -------------------------------------------------------------------------- */
/* Tests                                                                        */
/* -------------------------------------------------------------------------- */

describe('ManagerNavbar — rendering', () => {
  beforeEach(() => {
    mockPathname = '/manager';
    anomalyContextValue = { ...defaultAnomalyContext };
    mockPush.mockClear();
    mockClearUnread.mockClear();
    mockAcknowledgeSprayAlert.mockClear();
  });

  it('renders the Hadinerim logo', () => {
    renderNavbar();
    expect(screen.getByText('Hadinerim')).toBeInTheDocument();
  });

  it('renders the "Manager" role badge', () => {
    renderNavbar();
    expect(screen.getByText('Manager')).toBeInTheDocument();
  });

  it('renders all primary nav links', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^tasks$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sensor explorer/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /analytics/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /users/i })).toBeInTheDocument();
    // Spray alerts are accessed via Spray Map (#spray-alerts anchor), not a separate nav link
    expect(screen.getByRole('link', { name: /spray map/i })).toBeInTheDocument();
  });

  it('renders the Inventory dropdown button', () => {
    renderNavbar();
    expect(screen.getByRole('button', { name: /inventory/i })).toBeInTheDocument();
  });

  it('renders the bell (notifications) button', () => {
    renderNavbar();
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
  });

  it('renders the sign-out button', () => {
    renderNavbar();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('renders the language switcher', () => {
    renderNavbar();
    expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
  });

  it('logo links to the home page', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: /hadinerim/i })).toHaveAttribute('href', '/');
  });
});

describe('ManagerNavbar — nav link hrefs', () => {
  beforeEach(() => { mockPathname = '/manager'; });

  it('Dashboard links to /manager', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/manager');
  });

  it('Tasks links to /manager/tasks', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: /^tasks$/i })).toHaveAttribute('href', '/manager/tasks');
  });

  it('Sensor Explorer links to /manager/sensors', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: /sensor explorer/i })).toHaveAttribute('href', '/manager/sensors');
  });

  it('Analytics links to /manager/reports', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: /analytics/i })).toHaveAttribute('href', '/manager/reports');
  });

  it('Users links to /manager/users', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: /users/i })).toHaveAttribute('href', '/manager/users');
  });

  it('Spray Map links to /manager/spray-map', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: /spray map/i })).toHaveAttribute('href', '/manager/spray-map');
  });
});

describe('ManagerNavbar — Inventory dropdown', () => {
  beforeEach(() => {
    mockPathname = '/manager';
    anomalyContextValue = { ...defaultAnomalyContext };
  });

  it('dropdown is hidden before clicking Inventory', () => {
    renderNavbar();
    // "Warehouse stock levels" description only appears when dropdown is open
    expect(screen.queryByText('Warehouse stock levels')).not.toBeInTheDocument();
  });

  it('opens the dropdown on click and shows all sub-items', () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /inventory/i }));
    expect(screen.getByText('Stock')).toBeInTheDocument();
    expect(screen.getAllByText('Plants')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Peppers')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Products')[0]).toBeInTheDocument();
  });

  it('dropdown items link to correct hrefs', () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /inventory/i }));
    expect(screen.getByText('Stock').closest('a')).toHaveAttribute('href', '/manager/inventory');
    expect(screen.getByText('Plant tracking').closest('a')).toHaveAttribute('href', '/manager/inventory/plants');
    expect(screen.getByText('Pepper variety catalog').closest('a')).toHaveAttribute('href', '/manager/peppers');
    expect(screen.getByText('Product catalog').closest('a')).toHaveAttribute('href', '/manager/products');
  });

  it('closes the dropdown on a second click', () => {
    renderNavbar();
    const btn = screen.getByRole('button', { name: /inventory/i });
    fireEvent.click(btn);
    expect(screen.getByText('Stock')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText('Stock')).not.toBeInTheDocument();
  });

  it('opening bell closes any open dropdown', () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /inventory/i }));
    expect(screen.getByText('Stock')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.queryByText('Stock')).not.toBeInTheDocument();
  });
});

describe('ManagerNavbar — bell / notification panel', () => {
  beforeEach(() => {
    mockPathname = '/manager';
    anomalyContextValue = { ...defaultAnomalyContext };
    mockClearUnread.mockClear();
    mockAcknowledgeSprayAlert.mockClear();
  });

  it('notification panel is hidden before bell click', () => {
    renderNavbar();
    expect(screen.queryByText('No active alerts')).not.toBeInTheDocument();
  });

  it('opens the notification panel on bell click', () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('calls clearUnread when bell is opened', () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(mockClearUnread).toHaveBeenCalled();
  });

  it('shows "No active alerts", "No spray alerts" and "No completed tasks yet" when empty', () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByText('No active alerts')).toBeInTheDocument();
    expect(screen.getByText('No spray alerts')).toBeInTheDocument();
    expect(screen.getByText('No completed tasks yet')).toBeInTheDocument();
  });

  it('renders spray alert items in the panel', () => {
    anomalyContextValue = {
      ...defaultAnomalyContext,
      sprayAlerts: [
        {
          SprayAlertId: 1, SprayReportId: 1, ZoneId: 1,
          ZoneCode: 'GH-01', ZoneName: 'Greenhouse 1',
          PesticideName: 'Confidor', ReportedByUserId: 2,
          ReportStatus: 'completed', Severity: 'medium',
          SafetyMessage: 'Do not re-enter.', RequiresApproval: false,
          ReEntryIntervalHours: 12, SafeToReEnterAtUtc: null, SafeToHarvestAtUtc: null,
          HazardLevel: 'medium', PpeRequired: 'Gloves',
          SprayedAtUtc: new Date().toISOString(), IsRead: false,
          CreatedAt: new Date().toISOString(),
        } as never,
      ],
      sprayUnreadCount: 1,
    };
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByTestId('spray-alert-item')).toBeInTheDocument();
  });

  it('spray alert items link to /manager/spray-map#spray-alerts', () => {
    anomalyContextValue = {
      ...defaultAnomalyContext,
      sprayAlerts: [
        {
          SprayAlertId: 1, SprayReportId: 1, ZoneId: 1,
          ZoneCode: 'GH-01', ZoneName: 'Greenhouse 1',
          PesticideName: 'Confidor', ReportedByUserId: 2,
          ReportStatus: 'completed', Severity: 'medium',
          SafetyMessage: 'Do not re-enter.', RequiresApproval: false,
          ReEntryIntervalHours: 12, SafeToReEnterAtUtc: null, SafeToHarvestAtUtc: null,
          HazardLevel: 'medium', PpeRequired: 'Gloves',
          SprayedAtUtc: new Date().toISOString(), IsRead: false,
          CreatedAt: new Date().toISOString(),
        } as never,
      ],
      sprayUnreadCount: 1,
    };
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByTestId('spray-alert-item')).toHaveAttribute('href', '/manager/spray-map#spray-alerts');
  });

  it('spray alerts "View all" links to /manager/spray-map#spray-alerts', () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    const allLinks = screen.getAllByRole('link');
    const sprayAnchorLink = allLinks.find(
      (l) => l.getAttribute('href') === '/manager/spray-map#spray-alerts',
    );
    expect(sprayAnchorLink).toBeTruthy();
  });

  it('does not show notification badge when unreadCount is 0', () => {
    renderNavbar();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows notification badge with correct count', () => {
    anomalyContextValue = {
      ...defaultAnomalyContext,
      unreadCount: 3,
      liveAlerts: [
        {
          alertId: 1, metricName: 'Temperature', actualValue: 45,
          severity: 'High', isResolved: false,
          zoneName: 'Zone A', pepperName: 'Ghost',
          createdAtUtc: new Date().toISOString(),
          minAllowed: null, maxAllowed: null,
        } as never,
      ],
    };
    renderNavbar();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('caps badge at 99+', () => {
    anomalyContextValue = { ...defaultAnomalyContext, unreadCount: 150 };
    renderNavbar();
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('renders active alert items in the panel', () => {
    anomalyContextValue = {
      ...defaultAnomalyContext,
      unreadCount: 1,
      liveAlerts: [
        {
          alertId: 10, metricName: 'Humidity', actualValue: 90,
          severity: 'Medium', isResolved: false,
          zoneName: 'Zone B', pepperName: 'Jalapeño',
          createdAtUtc: new Date().toISOString(),
          minAllowed: null, maxAllowed: null,
        } as never,
      ],
    };
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByText(/humidity: 90/i)).toBeInTheDocument();
  });

  it('renders completed task items in the panel', () => {
    anomalyContextValue = {
      ...defaultAnomalyContext,
      completedTasks: [
        { id: 99, title: 'Watering Zone A', taskType: 'Watering', status: 'done', completedAt: new Date().toISOString() } as never,
      ],
    };
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByText('Watering Zone A')).toBeInTheDocument();
  });
});

describe('ManagerNavbar — logout', () => {
  beforeEach(() => {
    mockPathname = '/manager';
    localStorage.setItem('token', 'test-token-manager');
    mockPush.mockClear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('removes token from localStorage on logout', () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('redirects to /login on logout', () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(mockPush).toHaveBeenCalledWith('/login');
  });
});

describe('ManagerNavbar — active link highlighting', () => {
  it('highlights Dashboard when pathname is /manager', () => {
    mockPathname = '/manager';
    renderNavbar();
    expect(screen.getByRole('link', { name: /dashboard/i }).className).toMatch(/bg-/);
  });

  it('does not highlight Tasks when on Dashboard', () => {
    mockPathname = '/manager';
    renderNavbar();
    expect(screen.getByRole('link', { name: /^tasks$/i }).className).toMatch(/opacity/);
  });

  it('highlights Tasks when pathname is /manager/tasks', () => {
    mockPathname = '/manager/tasks';
    renderNavbar();
    expect(screen.getByRole('link', { name: /^tasks$/i }).className).toMatch(/bg-/);
  });

  it('highlights Analytics when pathname is /manager/reports', () => {
    mockPathname = '/manager/reports';
    renderNavbar();
    expect(screen.getByRole('link', { name: /analytics/i }).className).toMatch(/bg-/);
  });
});
