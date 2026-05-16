# Testing Patterns

**Analysis Date:** 2026-05-16

## Test Framework

**Frontend:**
- Runner: Jest 30.3.0
- Test environment: jsdom
- Config: `pepper-farm/frontend/jest.config.ts`
- Setup: `pepper-farm/frontend/jest.setup.ts`
- Assertion Library: @testing-library/jest-dom
- React Testing Library: @testing-library/react 16.3.2

**Backend:**
- Runner: pytest 9.0.3
- Client: FastAPI TestClient
- Config: No dedicated pytest.ini (uses test discovery)

**E2E:**
- Framework: Playwright
- Config: `pepper-farm/frontend/playwright.config.ts`
- Base URL: http://localhost:3000
- Browser: Chromium (desktop)
- Parallelization: Disabled (sequential execution)
- Retries: Disabled (0)
- Workers: 1
- Reporter: list

**Run Commands:**
```bash
npm test                 # Run all Jest tests
npm run test:watch      # Jest watch mode
npx playwright test     # Run E2E tests
pytest                  # Run backend tests
```

## Test File Organization

**Frontend Location:**
- Co-located in `pepper-farm/frontend/tests/` directory (separate from source)
- Applies to both components and services

**Backend Location:**
- Organized in `pepper-farm/backend/tests/` directory

**Naming Convention:**
- Frontend: `[Name].test.tsx` (React components) and `[name].test.ts` (utilities/services)
- Backend: `test_[name].py` (Python convention)
- E2E: `test_[flow_name].spec.ts` (Playwright convention)

**File Count:**
- Frontend: 27 test files covering components, services, utilities
- Backend: 20+ test files for services, APIs, models
- E2E: 1 test file currently (edit pepper flow)

## Test Structure

### Frontend - Component Tests

**Pattern (from `pepper-farm/frontend/tests/PepperCard.test.tsx`):**
```typescript
import { render, screen } from '@testing-library/react';
import PepperCard from '@/components/peppers/PepperCard';

describe('PepperCard', () => {
  it('renders pepper name', () => {
    render(<PepperCard pepper={basePepper} />);
    expect(screen.getByText('Jalapeño')).toBeInTheDocument();
  });

  it('renders image when ImageUrl is provided', () => {
    render(<PepperCard pepper={{ ...basePepper, ImageUrl: '/uploads/pepper_images/test.jpg' }} />);
    const img = screen.getByRole('img', { name: 'Jalapeño' });
    expect(img).toHaveAttribute('src', '/uploads/pepper_images/test.jpg');
  });
});
```

**Key patterns:**
- Use `describe()` to group related tests
- Render component with `render()`
- Query DOM with `screen.getByText()`, `screen.getByRole()`, `screen.queryByText()`
- Use data builder pattern for test fixtures
- Test both positive cases (renders when provided) and negative cases (doesn't render when absent)

### Frontend - Service Tests (API Mocking)

**Pattern (from `pepper-farm/frontend/tests/tasksService.test.ts`):**
```typescript
import { createTask } from '@/services/tasks';

global.fetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn(() => 'fake-token-123'),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    },
    writable: true,
  });
});

const baseFormData: CreateTaskFormData = {
  title: 'Water zone A',
  description: 'Irrigation needed',
  taskType: 'irrigation',
  priority: 'medium',
};

test('createTask sends POST to /api/tasks', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => mockTask,
  });

  await createTask(baseFormData);

  const [url, options] = (fetch as jest.Mock).mock.calls[0];
  expect(url).toContain('/api/tasks');
  expect(options.method).toBe('POST');
});

test('createTask sends Authorization header', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => mockTask,
  });

  await createTask(baseFormData);

  const options = (fetch as jest.Mock).mock.calls[0][1];
  expect(options.headers.Authorization).toContain('Bearer');
});

test('createTask throws on API error', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    json: async () => ({ detail: 'Alert #999 not found.' }),
  });

  await expect(createTask(baseFormData, 999)).rejects.toThrow('Alert #999 not found.');
});
```

**Key patterns:**
- Mock `global.fetch` at module level
- Mock `localStorage` in `beforeEach()` for token retrieval
- Use `jest.clearAllMocks()` before each test to prevent cross-contamination
- Create base fixture objects with defaults, spread overrides for variations
- Verify HTTP method, URL, headers, and body separately
- Test both happy path (ok: true) and error path (ok: false)
- Error testing: assert that rejected promise contains expected error message

### Frontend - Interactive Component Tests

**Pattern (from `pepper-farm/frontend/tests/LoginForm.test.tsx`):**
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginForm from '@/components/auth/LoginForm';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

global.fetch = jest.fn();

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows error when submitting empty form', async () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByText('Login'));
    await waitFor(() => {
      expect(screen.getByText('Email and password are required.')).toBeInTheDocument();
    });
  });

  it('redirects to /visitor after Visitor login', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accessToken: 'tok123',
        tokenType: 'bearer',
        role: 'Visitor',
        fullName: 'Test User',
      }),
    });

    render(<LoginForm />);
    fireEvent.change(screen.getByPlaceholderText('your@email.com'),
      { target: { value: 'test@farm.com' } });
    fireEvent.change(screen.getByPlaceholderText('Your password'),
      { target: { value: 'pass123' } });
    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/visitor');
    });
  });
});
```

**Key patterns:**
- Mock Next.js `useRouter` hook for navigation testing
- Use `fireEvent.click()` to simulate button clicks
- Use `fireEvent.change()` with target object for input value changes
- Use `waitFor()` to handle async state updates
- Assert on side effects (router.push calls, error messages appearing)
- Test user role-based navigation flows

### Frontend - Utility Function Tests

**Pattern (from `pepper-farm/frontend/tests/alertToTask.test.ts`):**
```typescript
import { buildAlertTaskPrefill, buildAlertTaskQueryString } from '@/lib/alertToTask';

function makeAlert(overrides: Partial<RecentAlert> = {}): RecentAlert {
  return {
    alertId: 7,
    sensorId: 3,
    metricName: 'Temperature',
    actualValue: 38.5,
    minAllowed: 18,
    maxAllowed: 30,
    severity: 'High',
    message: 'Temperature out of range',
    ...overrides,
  };
}

test('sets alertId from the source alert', () => {
  const prefill = buildAlertTaskPrefill(makeAlert({ alertId: 42 }));
  expect(prefill.alertId).toBe(42);
});

test('maps High severity to critical priority', () => {
  const prefill = buildAlertTaskPrefill(makeAlert({ severity: 'High' }));
  expect(prefill.priority).toBe('critical');
});

test('description includes alert id', () => {
  const prefill = buildAlertTaskPrefill(makeAlert({ alertId: 99 }));
  expect(prefill.description).toContain('#99');
});
```

**Key patterns:**
- Use factory functions for flexible test data
- Test transformation/mapping logic comprehensively
- Test boundary cases (null values, empty strings)
- One assertion per test (focused on single behavior)
- Test both data extraction and transformation

### Backend - Service Tests

**Pattern (from `pepper-farm/backend/tests/test_auth_api.py`):**
```python
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
from main import app
from database import get_db

client = TestClient(app)

def make_mock_db(user_exists=False):
    mock = MagicMock()

    visitor_role = MagicMock()
    visitor_role.RoleId = 4
    visitor_role.RoleName = "Visitor"

    mock_user = MagicMock()
    mock_user.UserId = 1
    mock_user.FullName = "Test User"
    mock_user.Email = "test@farm.com"
    mock_user.PasswordHash = "hashed"
    mock_user.IsActive = True
    mock_user.role = visitor_role

    if user_exists:
        mock.query.return_value.filter.return_value.first.return_value = mock_user
    else:
        mock.query.return_value.filter.return_value.first.side_effect = [None, visitor_role]

    return mock

def test_register_returns_201():
    app.dependency_overrides[get_db] = lambda: make_mock_db()
    try:
        with patch("services.auth_service.hash_password", return_value="fake-hash"):
            res = client.post("/api/auth/register", json={
                "fullName": "Test User",
                "email": "test@farm.com",
                "password": "pass123"
            })
        assert res.status_code == 201
    finally:
        app.dependency_overrides.clear()

def test_register_duplicate_email_returns_409():
    app.dependency_overrides[get_db] = lambda: make_mock_db(user_exists=True)
    res = client.post("/api/auth/register", json={
        "fullName": "Test User",
        "email": "test@farm.com",
        "password": "pass123"
    })
    app.dependency_overrides.clear()
    assert res.status_code == 409
    assert "already registered" in res.json()["detail"]
```

**Key patterns:**
- Use `sys.path.insert()` to handle import paths
- Use `TestClient(app)` from FastAPI for API testing
- Override FastAPI dependencies with `app.dependency_overrides[get_db]`
- Always call `app.dependency_overrides.clear()` in finally block
- Create mock factory functions for database mocks
- Test HTTP status codes (201, 409, 422)
- Use `patch()` for service function mocking
- Verify response JSON content with `res.json()["detail"]`

### E2E - Playwright Tests

**Pattern (from `pepper-farm/frontend/e2e/test_edit_pepper_flow.spec.ts`):**
```typescript
import { test, expect, Page } from '@playwright/test';

const PEPPER_ID = 1;
const EDIT_URL = `/manager/peppers/edit/${PEPPER_ID}`;

const MOCK_PEPPER = {
  PepperId: PEPPER_ID,
  PepperName: 'Jalapeño',
  ScientificName: 'Capsicum annuum',
  HeatLevelScovilleMin: 2500,
  HeatLevelScovilleMax: 8000,
  IsActive: true,
};

async function setupHappyPathRoutes(page: Page) {
  await page.route(`**/api/peppers/${PEPPER_ID}`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, json: MOCK_PEPPER });
    }
    if (route.request().method() === 'PUT') {
      return route.fulfill({ status: 200, json: UPDATED_PEPPER });
    }
    return route.continue();
  });
}

test.describe('Edit Pepper — happy path', () => {
  test('edit page loads and pre-populates existing pepper data', async ({ page }) => {
    await setupHappyPathRoutes(page);
    await page.goto(EDIT_URL);

    const pepperNameInput = page.getByLabel(/pepper name/i).or(
      page.locator('input[name="PepperName"]')
    );
    await expect(pepperNameInput).toHaveValue('Jalapeño');
  });

  test('submitting form calls PUT /api/peppers/:id', async ({ page }) => {
    let putCalled = false;
    let putBody: unknown = null;

    await page.route(`**/api/peppers/${PEPPER_ID}`, (route) => {
      if (route.request().method() === 'PUT') {
        putCalled = true;
        putBody = route.request().postDataJSON();
        return route.fulfill({ status: 200, json: UPDATED_PEPPER });
      }
      return route.continue();
    });

    await page.goto(EDIT_URL);
    await page.locator('input[name="PepperName"]').fill('Updated Jalapeño');
    await page.getByRole('button', { name: /save|update/i }).click();

    expect(putCalled).toBe(true);
  });

  test('success message is displayed after successful update', async ({ page }) => {
    await setupHappyPathRoutes(page);
    await page.goto(EDIT_URL);

    await page.locator('input[name="PepperName"]').fill('Updated Jalapeño');
    await page.getByRole('button', { name: /save|update/i }).click();

    await expect(
      page.getByText(/updated successfully|saved|success/i).first()
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Edit Pepper — error paths', () => {
  test('shows error when initial pepper data fails to load', async ({ page }) => {
    await page.route(`**/api/peppers/${PEPPER_ID}`, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 500, json: { detail: 'Server error' } });
      }
      return route.continue();
    });

    await page.goto(EDIT_URL);

    await expect(
      page.getByText(/failed|error|could not load/i).first()
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Edit Pepper — validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`**/api/peppers/${PEPPER_ID}`, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, json: MOCK_PEPPER });
      }
      return route.continue();
    });
    await page.goto(EDIT_URL);
  });

  test('clearing pepper name shows validation error and blocks submission', async ({ page }) => {
    await page.locator('input[name="PepperName"]').fill('');
    await page.getByRole('button', { name: /save|update/i }).click();

    await expect(
      page.getByText(/required|cannot be empty/i).first()
    ).toBeVisible({ timeout: 3000 });
  });
});
```

**Key patterns:**
- Use `test.describe()` to group related tests by scenario
- Create setup helper functions to avoid route duplication
- Use `page.route()` to intercept and mock API calls
- Route intercepts check HTTP method to distinguish GET from PUT/PATCH
- Use `page.goto()` to navigate to test URL
- Use `page.locator()` and `page.getByLabel()` for element selection
- Use `.fill()` for text input, `.click()` for buttons
- Use `.first()` when multiple matches possible
- Assert visibility with timeout (5000ms for network waits, 3000ms for validation)
- Use regex patterns for flexible text matching (case-insensitive with /i flag)

## Mocking

### Frontend Mocking Strategy

**Global Fetch:**
```typescript
global.fetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

// Usage:
(fetch as jest.Mock).mockResolvedValueOnce({
  ok: true,
  json: async () => mockData,
});
```

**localStorage:**
```typescript
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(() => 'fake-token-123'),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
  writable: true,
});
```

**Next.js Router:**
```typescript
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));
```

**What to Mock:**
- HTTP calls (fetch)
- localStorage access (for auth tokens)
- Router navigation (for route assertions)
- External library hooks

**What NOT to Mock:**
- React Testing Library utilities (render, screen, fireEvent)
- Component rendering itself
- CSS/styling
- Internal component state management

### Backend Mocking Strategy

**Database Dependency Injection:**
```python
app.dependency_overrides[get_db] = lambda: make_mock_db()
# Always clear after:
app.dependency_overrides.clear()
```

**MagicMock for ORM Models:**
```python
def make_mock_db(user_exists=False):
    mock = MagicMock()
    mock_user = MagicMock()
    mock_user.UserId = 1
    mock.query.return_value.filter.return_value.first.return_value = mock_user
    return mock
```

**Function Patching:**
```python
with patch("services.auth_service.hash_password", return_value="fake-hash"):
    # test code
```

## Fixtures and Factories

**Frontend - Data Builders:**
```typescript
// Simple object with defaults
const basePepper: Pepper = {
  PepperId: 1,
  PepperName: 'Jalapeño',
  IsActive: true,
};

// Usage with spread for variations
render(<PepperCard pepper={{ ...basePepper, ScientificName: 'Capsicum annuum' }} />);

// Factory function for complex nested data
function makeAlert(overrides: Partial<RecentAlert> = {}): RecentAlert {
  return {
    alertId: 7,
    sensorId: 3,
    metricName: 'Temperature',
    ...overrides,
  };
}
```

**Backend - Mock Factory:**
```python
def make_mock_db(user_exists=False):
    # Returns configured MagicMock with SQLAlchemy-like interface
    return mock
```

**Location:**
- Frontend: Defined at top of test file (co-located with tests)
- Backend: Defined as helper function at top of test file

## Coverage

**Requirements:** Not enforced (no coverage threshold in jest.config)

**View Coverage (if needed):**
```bash
npx jest --coverage
```

## Test Types Present

### Unit Tests

**Frontend Components:**
- `pepper-farm/frontend/tests/PepperCard.test.tsx` - Renders UI with various data states
- `pepper-farm/frontend/tests/Badge.test.tsx` - Simple UI component behavior
- `pepper-farm/frontend/tests/Alert.test.tsx` - Alert display and styling

**Frontend Services:**
- `pepper-farm/frontend/tests/tasksService.test.ts` - API service for task CRUD
- `pepper-farm/frontend/tests/anomaliesService.test.ts` - API service for anomaly queries
- `pepper-farm/frontend/tests/sensorsService.test.ts` - Sensor data API interactions

**Frontend Utilities:**
- `pepper-farm/frontend/tests/alertToTask.test.ts` - Data transformation functions
- `pepper-farm/frontend/tests/taskFilters.test.ts` - Filter logic utilities

**Backend Services:**
- `pepper-farm/backend/tests/test_auth_api.py` - Authentication endpoints
- `pepper-farm/backend/tests/test_task_service.py` - Task business logic
- `pepper-farm/backend/tests/test_sensor_service.py` - Sensor data handling

**Scope:** Individual functions/components in isolation with mocked dependencies

### Integration Tests

**Frontend:**
- `pepper-farm/frontend/tests/LoginForm.test.tsx` - Component + Router + Fetch integration
- `pepper-farm/frontend/tests/TaskForm.test.tsx` - Form component + API service integration
- `pepper-farm/frontend/tests/ManagerPeppersPage.test.ts` - Page component + multiple services

**Backend:**
- `pepper-farm/backend/tests/test_tasks_api.py` - Endpoint + Service + Database integration
- `pepper-farm/backend/tests/test_sensor_readings_api.py` - Endpoint + validation + DB

**Scope:** Multiple systems working together

### E2E Tests

**Frontend:**
- `pepper-farm/frontend/e2e/test_edit_pepper_flow.spec.ts` - User workflow from page load to save
  - Happy path: load existing data → edit field → save → success message
  - Error paths: load failure, update failure, not found (404)
  - Validation: empty name, invalid ranges

**Scope:** Real browser, mocked backend APIs, full user workflows

## Common Test Patterns

### Async Testing - waitFor Pattern

```typescript
it('shows error when submitting empty form', async () => {
  render(<LoginForm />);
  fireEvent.click(screen.getByText('Login'));

  await waitFor(() => {
    expect(screen.getByText('Email and password are required.')).toBeInTheDocument();
  });
});
```

**Pattern:** Use `await waitFor()` when testing async state changes triggered by user interaction.

### Async Testing - Promise Pattern

```typescript
test('createTask throws on API error', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    json: async () => ({ detail: 'Alert #999 not found.' }),
  });

  await expect(createTask(baseFormData, 999)).rejects.toThrow('Alert #999 not found.');
});
```

**Pattern:** Use `await expect().rejects.toThrow()` for functions that return rejected promises.

### Error Testing

**Frontend Service Errors:**
```typescript
test('createTask throws on API error', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    json: async () => ({ detail: 'Error message' }),
  });

  await expect(createTask(baseFormData)).rejects.toThrow('Error message');
});
```

**Frontend Component Errors:**
```typescript
it('shows error on wrong password', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    json: async () => ({ detail: 'Invalid email or password.' }),
  });

  render(<LoginForm />);
  await waitFor(() => {
    expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
  });
});
```

**Backend Errors:**
```python
def test_register_duplicate_email_returns_409():
    app.dependency_overrides[get_db] = lambda: make_mock_db(user_exists=True)
    res = client.post("/api/auth/register", json={...})
    assert res.status_code == 409
    assert "already registered" in res.json()["detail"]
```

**Pattern:** Test error responses by mocking error conditions and asserting on status code and error message.

### Testing with URL Parameters

```typescript
test('getRecentAlerts appends limit param when provided', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ total: 0, items: [] }),
  });

  await getRecentAlerts({ limit: 25 });

  const calledUrl = (fetch as jest.Mock).mock.calls[0][0];
  expect(calledUrl).toContain('limit=25');
});
```

**Pattern:** Capture the fetch URL from mock.calls and assert it contains expected query parameters.

---

*Testing analysis: 2026-05-16*
