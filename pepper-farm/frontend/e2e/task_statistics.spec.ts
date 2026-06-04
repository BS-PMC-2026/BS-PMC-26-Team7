/**
 * E2E test for the FarmManager Task Statistics tab (US45 / BSPMT7-494).
 *
 * Covers:
 *  - Opening /manager/reports?tab=task-statistics renders the KPI cards.
 *  - Changing the date filter immediately re-requests with the new range and
 *    the displayed data matches the active filter (regression for the
 *    "filter shows one range but data reflects another" desync bug).
 *
 * Assumptions (same as the rest of the e2e suite):
 *  - The dev server is running at http://localhost:3000 (baseURL in config).
 *  - src/middleware.ts guards /manager/* via a `role` cookie, and the page
 *    reads a localStorage `token`; both are set below to mirror a real login.
 *  - The analytics API is mocked via route.fulfill() so no live backend/data
 *    is required.
 *
 * Run with: npx playwright test e2e/task_statistics.spec.ts
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

/** Inject a token into localStorage so the page's auth header / guards pass. */
async function injectToken(page: Page, token = 'e2e-mock-token') {
  await page.addInitScript((tok: string) => {
    window.localStorage.setItem('token', tok);
  }, token);
}

/**
 * Set the FarmManager `role` cookie that src/middleware.ts requires, otherwise
 * /manager/* server-redirects to /login (this was the cause of the failures).
 */
async function setManagerRole(context: BrowserContext) {
  await context.addCookies([
    { name: 'role', value: 'FarmManager', url: 'http://localhost:3000' },
  ]);
}

const json = (route: import('@playwright/test').Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * Quiet the ManagerNavbar / AnomalyNotificationProvider calls that run on every
 * /manager/* page so the shell mounts clean. Shapes must match what the context
 * consumes — notably getRecentAlerts() returns { items: [...] }, so returning a
 * bare [] makes `result.items` undefined and crashes the render.
 */
async function mockNavbarApis(page: Page) {
  await page.route('**/api/manager/anomalies/recent**', (route) => json(route, { items: [] }));
  await page.route('**/api/tasks/completed**',          (route) => json(route, []));
  await page.route('**/api/spray-reports/alerts**',         (route) => json(route, []));
  await page.route('**/api/spray-reports/overdue-alerts**', (route) => json(route, []));
  await page.route('**/api/manager/anomalies/stream**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' }),
  );
  // Worker dropdown for the filter
  await page.route('**/api/users', (route) =>
    json(route, [{ userId: 1, fullName: 'Bob Worker', email: 'bob@farm.com', roleName: 'Worker', isActive: true }]),
  );
}

/**
 * Mock the task-statistics endpoint so the response reflects whether a date
 * range was supplied — this lets us assert the displayed data tracks the active
 * filter. Unfiltered → 22 total; any start_date → 5 total. The summary cards use
 * distinct numbers (total ≠ open ≠ completed) so each value is unambiguous.
 */
async function mockTaskStatistics(page: Page) {
  await page.route('**/api/analytics/task-statistics**', (route) => {
    const url = new URL(route.request().url());
    const filtered = url.searchParams.has('start_date');
    const summary = filtered
      ? { total: 5,  open: 4,  completed: 1, overdue: 0, completion_rate: 20.0 }
      : { total: 22, open: 20, completed: 2, overdue: 0, completion_rate: 9.1 };
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        summary: {
          ...summary,
          avg_completion_hours: null,
          fastest_worker: null, fastest_worker_hours: null,
          slowest_worker: null, slowest_worker_hours: null,
        },
        by_status: [],
        by_worker: [
          {
            worker_id: 1, worker_name: 'Bob Worker', total: summary.total,
            completed: summary.completed, overdue: 0,
            completion_rate: summary.completion_rate, avg_completion_hours: null,
          },
        ],
        by_period: [],
        overdue_tasks: [],
      }),
    });
  });
}

test.describe('Task Statistics tab (US45)', () => {
  test.beforeEach(async ({ page, context }) => {
    await setManagerRole(context);
    await injectToken(page);
    await mockNavbarApis(page);
    await mockTaskStatistics(page);
  });

  // Next dev streaming/hydration can briefly mount the page twice before it
  // settles to one. `.first()` keeps the (identical) copies from tripping
  // Playwright strict mode; auto-retrying assertions wait for the settled state.

  test('opens the tab and shows KPI cards', async ({ page }) => {
    await page.goto('/manager/reports?tab=task-statistics');
    await expect(page.getByTestId('task-statistics-tab').first()).toBeVisible();
    const kpi = page.getByTestId('kpi-cards').first();
    await expect(kpi).toBeVisible();
    await expect(kpi.getByText('22')).toBeVisible(); // unfiltered total
  });

  test('changing the date filter updates the data to match the filter', async ({ page }) => {
    await page.goto('/manager/reports?tab=task-statistics');
    const kpi = page.getByTestId('kpi-cards').first();
    await expect(kpi.getByText('22')).toBeVisible();

    // Apply a same-day range; the mock returns total 5 when a start_date is present.
    await page.getByTestId('filter-start-date').first().fill('2026-06-03');
    await page.getByTestId('filter-end-date').first().fill('2026-06-03');

    // No validation error for an equal start/end day, and data reflects the filter.
    await expect(page.getByTestId('date-error')).toHaveCount(0);
    await expect(kpi.getByText('5')).toBeVisible();
    await expect(kpi.getByText('22')).toHaveCount(0);
  });
});
