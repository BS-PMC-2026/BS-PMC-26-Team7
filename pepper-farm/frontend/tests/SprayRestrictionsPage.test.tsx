/**
 * /worker/spray-restrictions is now a thin redirect to /worker/spray-report
 * (the consolidated worker spray report + restrictions page). The full
 * restrictions UI moved there, so this route only needs to redirect.
 */

const mockRedirect = jest.fn();

jest.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}));

// Imported after the mock so the page picks up the mocked redirect.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WorkerSprayRestrictionsPage = require('@/app/worker/spray-restrictions/page').default;

describe('WorkerSprayRestrictionsPage', () => {
  beforeEach(() => mockRedirect.mockClear());

  it('redirects to /worker/spray-report', () => {
    WorkerSprayRestrictionsPage();
    expect(mockRedirect).toHaveBeenCalledWith('/worker/spray-report');
  });
});
