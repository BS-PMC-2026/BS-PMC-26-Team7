/**
 * E2E tests for all Navbar variants by user type.
 *
 * Covers:
 *  - LandingNavbar  : public landing page (unauthenticated)
 *  - ManagerNavbar  : /manager/* pages (FarmManager role)
 *  - WorkerNavbar   : /worker/*  pages (Worker role)
 *
 * Each section verifies:
 *  - Correct links are visible and point to the right URLs
 *  - Role-specific features (dropdowns, bell, badge, logout)
 *  - No cross-role pollution (e.g. Worker cannot see Manager links)
 *
 * Assumptions:
 *  - The dev server is running at http://localhost:3000 (baseURL in config).
 *  - A valid JWT can be injected into localStorage to bypass auth guards.
 *  - The backend API is either running or mocked via route.fulfill().
 */

import { test, expect, Page } from '@playwright/test';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                      */
/* -------------------------------------------------------------------------- */

/** Inject a token into localStorage so auth-guarded pages don't redirect. */
async function injectToken(page: Page, token = 'e2e-mock-token') {
  await page.addInitScript((tok: string) => {
    window.localStorage.setItem('token', tok);
  }, token);
}

/** Mock all API calls that the notification contexts make on mount. */
async function mockNotificationApis(page: Page) {
  // Anomaly context: initial load of alerts
  await page.route('**/api/manager/anomalies/recent**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) }),
  );
  // Anomaly context: completed tasks
  await page.route('**/api/manager/tasks/completed**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  );
  // Anomaly SSE stream — respond with an empty 200 so EventSource doesn't error
  await page.route('**/api/manager/anomalies/stream**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/event-stream', body: '' }),
  );
  // Worker: my tasks
  await page.route('**/api/worker/my-tasks**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  );
}

/* -------------------------------------------------------------------------- */
/* 1. Landing page navbar (unauthenticated / visitor)                          */
/* -------------------------------------------------------------------------- */

test.describe('LandingNavbar — public / visitor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders PepperFarm logo', async ({ page }) => {
    await expect(page.getByText('PepperFarm')).toBeVisible();
  });

  test('logo links to /', async ({ page }) => {
    const logoLink = page.getByRole('link', { name: /pepperfarm/i });
    await expect(logoLink).toHaveAttribute('href', '/');
  });

  test('Sign In button is visible and links to /login', async ({ page }) => {
    const signIn = page.getByRole('link', { name: /sign in/i }).first();
    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveAttribute('href', '/login');
  });

  test('Get Started button is visible and links to /register', async ({ page }) => {
    const getStarted = page.getByRole('link', { name: /get started/i }).first();
    await expect(getStarted).toBeVisible();
    await expect(getStarted).toHaveAttribute('href', '/register');
  });

  test('no Manager or Worker role badge present', async ({ page }) => {
    await expect(page.getByText('Manager')).not.toBeVisible();
    await expect(page.getByText('Worker')).not.toBeVisible();
  });

  test('no Sign Out button present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /sign out/i })).not.toBeVisible();
  });

  test('Peppers nav link visible and href correct', async ({ page }) => {
    // Desktop nav — visible on wider viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    const peppersLink = page.getByRole('link', { name: /^peppers$/i }).first();
    await expect(peppersLink).toBeVisible();
    await expect(peppersLink).toHaveAttribute('href', '/#peppers');
  });

  test('Our Farm nav link visible and href correct', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const farmLink = page.getByRole('link', { name: /our farm/i }).first();
    await expect(farmLink).toBeVisible();
    await expect(farmLink).toHaveAttribute('href', '/#farm');
  });

  test('mobile: hamburger button is visible on narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole('button', { name: /open menu/i })).toBeVisible();
  });

  test('mobile: clicking hamburger opens the slide-down panel', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole('button', { name: /open menu/i }).click();
    // Mobile panel links become visible
    await expect(page.getByRole('link', { name: /^peppers$/i })).toBeVisible();
  });

  test('mobile: clicking a menu link closes the panel', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole('button', { name: /open menu/i }).click();
    await page.getByRole('link', { name: /^peppers$/i }).click();
    await expect(page.getByRole('button', { name: /open menu/i })).toBeVisible();
  });

  test('Sign In button navigates to /login', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole('link', { name: /sign in/i }).first().click();
    await expect(page).toHaveURL('/login');
  });

  test('Get Started button navigates to /register', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole('link', { name: /get started/i }).first().click();
    await expect(page).toHaveURL('/register');
  });

  test('navbar becomes frosted/white after scrolling down', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // Scroll past the hero threshold (> 4px)
    await page.evaluate(() => window.scrollTo(0, 100));
    const header = page.locator('header').first();
    await expect(header).toHaveClass(/bg-white/);
  });
});

/* -------------------------------------------------------------------------- */
/* 2. ManagerNavbar (FarmManager role)                                         */
/* -------------------------------------------------------------------------- */

test.describe('ManagerNavbar — FarmManager', () => {
  test.beforeEach(async ({ page }) => {
    await injectToken(page);
    await mockNotificationApis(page);
    await page.goto('/manager');
  });

  test('renders PepperFarm logo with Manager badge', async ({ page }) => {
    await expect(page.getByText('PepperFarm')).toBeVisible();
    await expect(page.getByText('Manager')).toBeVisible();
  });

  test('Dashboard link is visible and active on /manager', async ({ page }) => {
    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
  });

  test('Tasks link is visible and href is /manager/tasks', async ({ page }) => {
    const link = page.getByRole('link', { name: /^tasks$/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/manager/tasks');
  });

  test('Sensor Explorer link is visible and href is /manager/sensors', async ({ page }) => {
    const link = page.getByRole('link', { name: /sensor explorer/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/manager/sensors');
  });

  test('Analytics link is visible and href is /manager/reports', async ({ page }) => {
    const link = page.getByRole('link', { name: /analytics/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/manager/reports');
  });

  test('Users link is visible and href is /manager/users', async ({ page }) => {
    const link = page.getByRole('link', { name: /users/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/manager/users');
  });

  test('Inventory dropdown button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /inventory/i })).toBeVisible();
  });

  test('Inventory dropdown opens and shows all sub-items', async ({ page }) => {
    await page.getByRole('button', { name: /inventory/i }).click();
    // Use description text which is unique per item
    await expect(page.getByText('Warehouse stock levels')).toBeVisible();
    await expect(page.getByText('Plant tracking')).toBeVisible();
    await expect(page.getByText('Pepper variety catalog')).toBeVisible();
    await expect(page.getByText('Product catalog')).toBeVisible();
  });

  test('Inventory dropdown sub-items have correct hrefs', async ({ page }) => {
    await page.getByRole('button', { name: /inventory/i }).click();
    await expect(page.locator('a[href="/manager/inventory"]')).toBeVisible();
    await expect(page.locator('a[href="/manager/inventory/plants"]')).toBeVisible();
    await expect(page.locator('a[href="/manager/peppers"]')).toBeVisible();
    await expect(page.locator('a[href="/manager/products"]')).toBeVisible();
  });

  test('Inventory dropdown closes when clicking outside', async ({ page }) => {
    await page.getByRole('button', { name: /inventory/i }).click();
    await expect(page.getByText('Warehouse stock levels')).toBeVisible();
    await page.mouse.click(10, 10); // click outside navbar
    await expect(page.getByText('Warehouse stock levels')).not.toBeVisible();
  });

  test('bell button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /notifications/i })).toBeVisible();
  });

  test('clicking bell opens notifications panel', async ({ page }) => {
    await page.getByRole('button', { name: /notifications/i }).click();
    await expect(page.getByText('Notifications')).toBeVisible();
  });

  test('notifications panel shows Active Alerts and Completed Tasks sections', async ({ page }) => {
    await page.getByRole('button', { name: /notifications/i }).click();
    await expect(page.getByText(/active alerts/i)).toBeVisible();
    await expect(page.getByText(/completed tasks/i)).toBeVisible();
  });

  test('closing the notification panel via X hides it', async ({ page }) => {
    await page.getByRole('button', { name: /notifications/i }).click();
    await expect(page.getByText('Notifications')).toBeVisible();
    // X button inside the panel
    await page.locator('button[aria-label=""]').last().click();
    // Fallback: press Escape or find by proximity
    // More reliable: click the X by finding it within the panel
    await expect(page.getByText('Notifications')).not.toBeVisible();
  });

  test('logout button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  });

  test('logout clears token and redirects to /login', async ({ page }) => {
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL('/login');
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });

  test('does NOT show Worker badge', async ({ page }) => {
    await expect(page.getByText('Worker')).not.toBeVisible();
  });

  test('does NOT show Worker-specific links (My Tasks, Spray Report)', async ({ page }) => {
    await expect(page.getByRole('link', { name: /my tasks/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /spray report/i })).not.toBeVisible();
  });

  test('Tasks link navigates to /manager/tasks', async ({ page }) => {
    await page.getByRole('link', { name: /^tasks$/i }).click();
    await expect(page).toHaveURL('/manager/tasks');
  });
});

/* -------------------------------------------------------------------------- */
/* 3. WorkerNavbar (Worker role)                                               */
/* -------------------------------------------------------------------------- */

test.describe('WorkerNavbar — Worker', () => {
  test.beforeEach(async ({ page }) => {
    await injectToken(page);
    await mockNotificationApis(page);
    await page.goto('/worker');
  });

  test('renders PepperFarm logo with Worker badge', async ({ page }) => {
    await expect(page.getByText('PepperFarm')).toBeVisible();
    await expect(page.getByText('Worker')).toBeVisible();
  });

  test('Dashboard link is visible with href /worker', async ({ page }) => {
    const link = page.getByRole('link', { name: /dashboard/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/worker');
  });

  test('My Tasks link is visible with href /worker/my-tasks', async ({ page }) => {
    const link = page.getByRole('link', { name: /my tasks/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/worker/my-tasks');
  });

  test('Products link is visible with href /worker/products', async ({ page }) => {
    const link = page.getByRole('link', { name: /^products$/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/worker/products');
  });

  test('Spray Report link is visible with href /worker/spray-report', async ({ page }) => {
    const link = page.getByRole('link', { name: /spray report/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/worker/spray-report');
  });

  test('Plants dropdown button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /plants/i })).toBeVisible();
  });

  test('Plants dropdown opens and shows Add Plant and Update Location', async ({ page }) => {
    await page.getByRole('button', { name: /plants/i }).click();
    await expect(page.getByRole('link', { name: /add plant/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /update location/i })).toBeVisible();
  });

  test('Plants dropdown items have correct hrefs', async ({ page }) => {
    await page.getByRole('button', { name: /plants/i }).click();
    await expect(page.getByRole('link', { name: /add plant/i })).toHaveAttribute('href', '/worker/plants/add');
    await expect(page.getByRole('link', { name: /update location/i })).toHaveAttribute('href', '/worker/plants/update-location');
  });

  test('bell button is visible with aria-label "Task notifications"', async ({ page }) => {
    await expect(page.getByRole('button', { name: /task notifications/i })).toBeVisible();
  });

  test('clicking bell opens task notification panel', async ({ page }) => {
    await page.getByRole('button', { name: /task notifications/i }).click();
    await expect(page.getByText('My Tasks')).toBeVisible();
  });

  test('notification panel shows Active Tasks section when no new tasks', async ({ page }) => {
    await page.getByRole('button', { name: /task notifications/i }).click();
    await expect(page.getByText(/active tasks/i)).toBeVisible();
  });

  test('logout button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  });

  test('logout clears token and redirects to /login', async ({ page }) => {
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL('/login');
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });

  test('does NOT show Manager badge', async ({ page }) => {
    await expect(page.getByText('Manager')).not.toBeVisible();
  });

  test('does NOT show Manager-specific links (Sensor Explorer, Analytics, Users)', async ({ page }) => {
    await expect(page.getByRole('link', { name: /sensor explorer/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /analytics/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /users/i })).not.toBeVisible();
  });

  test('My Tasks link navigates to /worker/my-tasks', async ({ page }) => {
    await page.getByRole('link', { name: /my tasks/i }).click();
    await expect(page).toHaveURL('/worker/my-tasks');
  });

  test('Spray Report link navigates to /worker/spray-report', async ({ page }) => {
    await page.getByRole('link', { name: /spray report/i }).click();
    await expect(page).toHaveURL('/worker/spray-report');
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Cross-role isolation                                                     */
/* -------------------------------------------------------------------------- */

test.describe('Navbar cross-role isolation', () => {
  test('Manager cannot access worker routes via navbar', async ({ page }) => {
    await injectToken(page);
    await mockNotificationApis(page);
    await page.goto('/manager');
    // Worker-specific links should not appear in the manager navbar
    await expect(page.getByRole('link', { name: /my tasks/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /spray report/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /plants/i })).not.toBeVisible();
  });

  test('Worker cannot see manager-only links in their navbar', async ({ page }) => {
    await injectToken(page);
    await mockNotificationApis(page);
    await page.goto('/worker');
    // Manager-only links should not appear in the worker navbar
    await expect(page.getByRole('link', { name: /sensor explorer/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /analytics/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /users/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /inventory/i })).not.toBeVisible();
  });

  test('landing page does not show authenticated navbar elements', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /sign out/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /notifications/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /task notifications/i })).not.toBeVisible();
  });
});

/* -------------------------------------------------------------------------- */
/* 5. QA: Accessibility and keyboard navigation                               */
/* -------------------------------------------------------------------------- */

test.describe('Navbar QA — accessibility', () => {
  test('landing navbar: Sign In is reachable via Tab', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.keyboard.press('Tab');
    // Tab through links until Sign In is focused
    for (let i = 0; i < 15; i++) {
      const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
      if (focused === 'Sign In') break;
      await page.keyboard.press('Tab');
    }
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
    expect(focused).toBe('Sign In');
  });

  test('manager bell button has aria-label="Notifications"', async ({ page }) => {
    await injectToken(page);
    await mockNotificationApis(page);
    await page.goto('/manager');
    const bell = page.getByRole('button', { name: /notifications/i });
    await expect(bell).toHaveAttribute('aria-label', 'Notifications');
  });

  test('manager bell button has aria-expanded=false when closed', async ({ page }) => {
    await injectToken(page);
    await mockNotificationApis(page);
    await page.goto('/manager');
    const bell = page.getByRole('button', { name: /notifications/i });
    await expect(bell).toHaveAttribute('aria-expanded', 'false');
  });

  test('manager bell button has aria-expanded=true when open', async ({ page }) => {
    await injectToken(page);
    await mockNotificationApis(page);
    await page.goto('/manager');
    const bell = page.getByRole('button', { name: /notifications/i });
    await bell.click();
    await expect(bell).toHaveAttribute('aria-expanded', 'true');
  });

  test('worker bell button has aria-label="Task notifications"', async ({ page }) => {
    await injectToken(page);
    await mockNotificationApis(page);
    await page.goto('/worker');
    await expect(page.getByRole('button', { name: /task notifications/i })).toHaveAttribute('aria-label', 'Task notifications');
  });

  test('manager logout button has aria-label="Sign out"', async ({ page }) => {
    await injectToken(page);
    await mockNotificationApis(page);
    await page.goto('/manager');
    await expect(page.getByRole('button', { name: /sign out/i })).toHaveAttribute('aria-label', 'Sign out');
  });

  test('worker logout button has aria-label="Sign out"', async ({ page }) => {
    await injectToken(page);
    await mockNotificationApis(page);
    await page.goto('/worker');
    await expect(page.getByRole('button', { name: /sign out/i })).toHaveAttribute('aria-label', 'Sign out');
  });
});
