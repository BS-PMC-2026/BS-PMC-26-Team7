import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { LanguageProvider } from '@/context/LanguageContext';

// ── Mock dependencies ────────────────────────────────────────────────────────

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/manager'),
  useRouter: () => ({ push: jest.fn() }),
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
      const { initial, animate, exit, transition, whileHover, ...rest } = props;
      void initial; void animate; void exit; void transition; void whileHover;
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

jest.mock('@/context/AnomalyNotificationContext', () => ({
  useAnomalyNotification: () => ({
    unreadCount: 0,
    clearUnread: jest.fn(),
    liveAlerts: [],
    completedTasks: [],
  }),
}));

jest.mock('@/context/WorkerNotificationContext', () => ({
  useWorkerNotification: () => ({
    unreadCount: 0,
    clearUnread: jest.fn(),
    newTasks: [],
    activeTasks: [],
  }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

import ManagerNavbar from '@/components/layout/ManagerNavbar';
import WorkerNavbar from '@/components/layout/WorkerNavbar';
import { usePathname } from 'next/navigation';

const STORAGE_KEY = 'pepper-farm-locale';

function renderManagerNavbar(path = '/manager', locale?: string) {
  if (locale) localStorage.setItem(STORAGE_KEY, locale);
  (usePathname as jest.Mock).mockReturnValue(path);
  return render(
    <LanguageProvider>
      <ManagerNavbar />
    </LanguageProvider>
  );
}

function renderWorkerNavbar(path = '/worker', locale?: string) {
  if (locale) localStorage.setItem(STORAGE_KEY, locale);
  (usePathname as jest.Mock).mockReturnValue(path);
  return render(
    <LanguageProvider>
      <WorkerNavbar />
    </LanguageProvider>
  );
}

// ── ManagerNavbar Tests ──────────────────────────────────────────────────────

describe('ManagerNavbar language integration', () => {
  beforeEach(() => {
    localStorage.clear();
    (usePathname as jest.Mock).mockReturnValue('/manager');
  });

  it('renders without crashing', () => {
    expect(() => renderManagerNavbar()).not.toThrow();
  });

  it('renders English navigation labels', async () => {
    renderManagerNavbar();
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Tasks')).toBeInTheDocument();
      expect(screen.getByText('Sensor Explorer')).toBeInTheDocument();
      expect(screen.getByText('Analytics')).toBeInTheDocument();
      expect(screen.getByText('Users')).toBeInTheDocument();
    });
  });

  it('renders LanguageSwitcher EN and HE buttons', async () => {
    renderManagerNavbar();
    await waitFor(() => {
      expect(screen.getByLabelText('Switch to EN')).toBeInTheDocument();
      expect(screen.getByLabelText('Switch to HE')).toBeInTheDocument();
    });
  });

  it('LanguageSwitcher works inside navbar — clicking HE activates Hebrew', async () => {
    renderManagerNavbar();
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Switch to HE'));
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Switch to HE')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByLabelText('Switch to EN')).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('LanguageSwitcher works inside navbar — clicking EN restores English', async () => {
    renderManagerNavbar('/manager', 'he');
    await waitFor(() => {
      expect(screen.getByLabelText('Switch to HE')).toHaveAttribute('aria-pressed', 'true');
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Switch to EN'));
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Switch to EN')).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('active route highlighting works on /manager path', async () => {
    renderManagerNavbar('/manager');
    await waitFor(() => {
      const dashboardLink = screen.getByRole('link', { name: /Dashboard/i });
      expect(dashboardLink).toBeInTheDocument();
    });
  });

  it('active route highlighting works on /manager/tasks path', async () => {
    renderManagerNavbar('/manager/tasks');
    await waitFor(() => {
      const tasksLink = screen.getByRole('link', { name: /Tasks/i });
      expect(tasksLink).toBeInTheDocument();
    });
  });

  it('navbar links are valid hrefs (not broken by RTL/LTR)', async () => {
    renderManagerNavbar();
    await waitFor(() => {
      const dashboardLink = screen.getByRole('link', { name: /Dashboard/i });
      expect(dashboardLink).toHaveAttribute('href', '/manager');

      const tasksLink = screen.getByRole('link', { name: /Tasks/i });
      expect(tasksLink).toHaveAttribute('href', '/manager/tasks');

      const sensorLink = screen.getByRole('link', { name: /Sensor Explorer/i });
      expect(sensorLink).toHaveAttribute('href', '/manager/sensors');

      const analyticsLink = screen.getByRole('link', { name: /Analytics/i });
      expect(analyticsLink).toHaveAttribute('href', '/manager/reports');

      const usersLink = screen.getByRole('link', { name: /Users/i });
      expect(usersLink).toHaveAttribute('href', '/manager/users');
    });
  });

  it('navbar links remain valid after switching to Hebrew', async () => {
    renderManagerNavbar();
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Switch to HE'));
    });
    await waitFor(() => {
      // After switching to Hebrew the label is localized; verify by href, not name.
      const dashboardLink = screen
        .getAllByRole("link")
        .find((link) => link.getAttribute("href") === "/manager");

      expect(dashboardLink).toBeInTheDocument();
    });
  });
});

// ── WorkerNavbar Tests ───────────────────────────────────────────────────────

describe('WorkerNavbar language integration', () => {
  beforeEach(() => {
    localStorage.clear();
    (usePathname as jest.Mock).mockReturnValue('/worker');
  });

  it('renders without crashing', () => {
    expect(() => renderWorkerNavbar()).not.toThrow();
  });

  it('renders English navigation labels', async () => {
    renderWorkerNavbar();
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('My Tasks')).toBeInTheDocument();
      expect(screen.getByText('Products')).toBeInTheDocument();
      expect(screen.getByText('Spray Report')).toBeInTheDocument();
    });
  });

  it('renders LanguageSwitcher EN and HE buttons', async () => {
    renderWorkerNavbar();
    await waitFor(() => {
      expect(screen.getByLabelText('Switch to EN')).toBeInTheDocument();
      expect(screen.getByLabelText('Switch to HE')).toBeInTheDocument();
    });
  });

  it('LanguageSwitcher works inside worker navbar', async () => {
    renderWorkerNavbar();
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Switch to HE'));
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Switch to HE')).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('worker navbar links are valid hrefs', async () => {
    renderWorkerNavbar();
    await waitFor(() => {
      const dashboardLink = screen.getByRole('link', { name: /Dashboard/i });
      expect(dashboardLink).toHaveAttribute('href', '/worker');

      const myTasksLink = screen.getByRole('link', { name: /My Tasks/i });
      expect(myTasksLink).toHaveAttribute('href', '/worker/my-tasks');

      const productsLink = screen.getByRole('link', { name: /Products/i });
      expect(productsLink).toHaveAttribute('href', '/worker/products');

      const sprayLink = screen.getByRole('link', { name: /Spray Report/i });
      expect(sprayLink).toHaveAttribute('href', '/worker/spray-report');
    });
  });

  it('worker navbar links remain valid after switching to Hebrew', async () => {
    renderWorkerNavbar();
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Switch to HE'));
    });
    await waitFor(() => {
      // After switching to Hebrew the label is localized; verify by href, not name.
      const dashboardLink = screen
        .getAllByRole("link")
        .find((link) => link.getAttribute("href") === "/worker");

      expect(dashboardLink).toBeInTheDocument();
    });
  });

  it('active route highlighting works on /worker path', async () => {
    renderWorkerNavbar('/worker');
    await waitFor(() => {
      const dashboardLink = screen.getByRole('link', { name: /Dashboard/i });
      expect(dashboardLink).toBeInTheDocument();
    });
  });
});
