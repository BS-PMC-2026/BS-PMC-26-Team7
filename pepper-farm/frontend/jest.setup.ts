import '@testing-library/jest-dom';

// ── Stable next/navigation mock ───────────────────────────────────────────────
// Individual test files may override this with a local jest.mock() call.
// This global mock ensures that tests which do NOT have a local override still
// get valid stubs for all exported symbols, avoiding "not a function" errors.

const mockPush    = jest.fn();
const mockReplace = jest.fn();
const mockRefresh = jest.fn();
const mockBack    = jest.fn();
const mockRedirect = jest.fn();

jest.mock('next/navigation', () => ({
  redirect:        mockRedirect,
  useRouter:       () => ({
    push:     mockPush,
    replace:  mockReplace,
    refresh:  mockRefresh,
    back:     mockBack,
    prefetch: jest.fn(),
  }),
  usePathname:     () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  jest.clearAllMocks();
});
