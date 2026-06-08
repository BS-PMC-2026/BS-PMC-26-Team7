/**
 * Integration tests for WorkerNavbar
 * Covers: rendering, navigation links, bell panel,
 * notification badge, logout, and active-link highlighting.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkerNavbar from '@/components/layout/WorkerNavbar';

/* -------------------------------------------------------------------------- */
/* Mocks                                                                        */
/* -------------------------------------------------------------------------- */

const mockPush = jest.fn();
let mockPathname = '/worker';

jest.mock('next/navigation', () => ({
  useRouter:   () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

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
    'LayoutDashboard','ShoppingBag','ShoppingCart','Sprout','ChevronDown',
    'Leaf','LogOut','MapPin','Bell','X','ClipboardCheck','ShieldAlert',
    'Menu',
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
const mockLoadAppNotifs = jest.fn(() => new Promise<void>(() => {}));
const mockMarkAllAppNotifsRead = jest.fn().mockResolvedValue(undefined);

const defaultWorkerContext = {
  unreadCount: 0,
  clearUnread: mockClearUnread,
  newTasks:    [] as never[],
  activeTasks: [] as never[],
  appNotifs: [] as never[],
  appUnreadCount: 0,
  loadAppNotifs: mockLoadAppNotifs,
  markAllAppNotifsRead: mockMarkAllAppNotifsRead,
};

let workerContextValue = { ...defaultWorkerContext };

jest.mock('@/context/WorkerNotificationContext', () => ({
  useWorkerNotification: () => workerContextValue,
}));

/* -------------------------------------------------------------------------- */
/* Helpers                                                                      */
/* -------------------------------------------------------------------------- */

const renderNavbar = () => render(React.createElement(WorkerNavbar));

/* -------------------------------------------------------------------------- */
/* Tests                                                                        */
/* -------------------------------------------------------------------------- */

describe('WorkerNavbar — rendering', () => {
  beforeEach(() => {
    mockPathname = '/worker';
    workerContextValue = { ...defaultWorkerContext };
    mockPush.mockClear();
    mockClearUnread.mockClear();
    mockLoadAppNotifs.mockClear();
    mockMarkAllAppNotifsRead.mockClear();
  });

  it('renders the Hadinerim logo', () => {
    renderNavbar();
    expect(screen.getByText('Hadinerim')).toBeInTheDocument();
  });

  it('renders the "Worker" role badge', () => {
    renderNavbar();
    expect(screen.getByText('Worker')).toBeInTheDocument();
  });

  it('renders all primary nav links', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /products/i })).toBeInTheDocument();
  });

  it('does not render the old Plants dropdown button', () => {
    renderNavbar();
    expect(screen.queryByRole('button', { name: /plants/i })).not.toBeInTheDocument();
  });

  it('renders the bell (task notifications) button', () => {
    renderNavbar();
    expect(screen.getByRole('button', { name: /task notifications/i })).toBeInTheDocument();
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

describe('WorkerNavbar — nav link hrefs', () => {
  beforeEach(() => { mockPathname = '/worker'; });

  it('Dashboard links to /worker', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/worker');
  });

  it('does not render the old My Tasks route link', () => {
    renderNavbar();
    expect(screen.queryByRole('link', { name: /my tasks/i })).not.toBeInTheDocument();
  });

  it('Products links to /worker/products', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: /products/i })).toHaveAttribute('href', '/worker/products');
  });

  it('does not render the old Spray Report route link', () => {
    renderNavbar();
    expect(screen.queryByRole('link', { name: /spray report/i })).not.toBeInTheDocument();
  });
});

describe('WorkerNavbar — bell / notification panel', () => {
  beforeEach(() => {
    mockPathname = '/worker';
    workerContextValue = { ...defaultWorkerContext };
    mockClearUnread.mockClear();
  });

  it('notification panel is hidden before bell click', () => {
    renderNavbar();
    expect(screen.queryByText(/no active tasks assigned to you/i)).not.toBeInTheDocument();
  });

  it('opens the notification panel on bell click', () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /task notifications/i }));
    expect(screen.getByText(/no active tasks assigned to you/i)).toBeInTheDocument();
  });

  it('calls clearUnread when bell is opened', () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /task notifications/i }));
    expect(mockClearUnread).toHaveBeenCalled();
  });

  it('shows "No active tasks assigned to you" when empty', () => {
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /task notifications/i }));
    expect(screen.getByText(/no active tasks assigned to you/i)).toBeInTheDocument();
  });

  it('does not show badge when unreadCount is 0', () => {
    renderNavbar();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows badge with unread count', () => {
    workerContextValue = { ...defaultWorkerContext, unreadCount: 5 };
    renderNavbar();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('caps badge at 99+', () => {
    workerContextValue = { ...defaultWorkerContext, unreadCount: 200 };
    renderNavbar();
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('shows unread count in panel header', () => {
    workerContextValue = { ...defaultWorkerContext, unreadCount: 2 };
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /task notifications/i }));
    expect(screen.getByText(/2 new/i)).toBeInTheDocument();
  });

  it('renders active task items in the panel', () => {
    const task = {
      id: 1, title: 'Water Zone C', taskType: 'Watering',
      zoneCode: 'Z3', priority: 'high', status: 'pending',
      createdAt: new Date().toISOString(),
    };
    workerContextValue = { ...defaultWorkerContext, activeTasks: [task as never] };
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /task notifications/i }));
    expect(screen.getByText('Water Zone C')).toBeInTheDocument();
  });

  it('renders newly assigned tasks in the panel when newTasks exist', () => {
    const task = {
      id: 2, title: 'Spray Section B', taskType: 'Spraying',
      zoneCode: 'Z1', priority: 'critical', status: 'pending',
      createdAt: new Date().toISOString(),
    };
    workerContextValue = {
      ...defaultWorkerContext,
      unreadCount: 1,
      newTasks:    [task as never],
      activeTasks: [],
    };
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /task notifications/i }));
    expect(screen.getByText('Spray Section B')).toBeInTheDocument();
    expect(screen.getByText(/newly assigned/i)).toBeInTheDocument();
  });

  it('shows "Active Tasks" label when no new tasks', () => {
    workerContextValue = {
      ...defaultWorkerContext,
      activeTasks: [{ id: 3, title: 'Check soil', taskType: 'Inspection', zoneCode: 'Z2', priority: 'low', status: 'pending', createdAt: new Date().toISOString() } as never],
    };
    renderNavbar();
    fireEvent.click(screen.getByRole('button', { name: /task notifications/i }));
    expect(screen.getByText(/active tasks/i)).toBeInTheDocument();
  });
});

describe('WorkerNavbar — logout', () => {
  beforeEach(() => {
    mockPathname = '/worker';
    localStorage.setItem('token', 'worker-token');
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

describe('WorkerNavbar — active link highlighting', () => {
  it('highlights Dashboard when pathname is /worker', () => {
    mockPathname = '/worker';
    renderNavbar();
    expect(screen.getByRole('link', { name: /dashboard/i }).className).toMatch(/bg-/);
  });

  it('does not render Spray Report navigation when pathname is the old restrictions redirect route', () => {
    mockPathname = '/worker/spray-restrictions';
    renderNavbar();
    expect(screen.queryByRole('link', { name: /spray report/i })).not.toBeInTheDocument();
  });
});
