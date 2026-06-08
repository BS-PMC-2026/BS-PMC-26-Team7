import { apiFetch } from '../apiClient';
import { markRouteLoadingWindow } from '@/lib/globalLoading';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function mockOkJson(body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

function mockError(status: number, detail: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve({ detail }),
  });
}

describe('apiFetch', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorage.clear();
    delete (window as Window & { __pepperRouteLoadingUntil?: number }).__pepperRouteLoadingUntil;
  });

  it('calls a relative /api path — no absolute URL prefix', async () => {
    mockOkJson({ id: 1 });
    await apiFetch('/api/tasks');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/tasks');
    expect(url).not.toMatch(/^http/);
  });

  it('attaches Authorization header from localStorage token', async () => {
    localStorage.setItem('token', 'test-jwt-token');
    mockOkJson([]);
    await apiFetch('/api/users');
    const [, options] = mockFetch.mock.calls[0];
    expect((options.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer test-jwt-token',
    );
  });

  it('does not attach Authorization header when localStorage has no token', async () => {
    mockOkJson([]);
    await apiFetch('/api/public');
    const [, options] = mockFetch.mock.calls[0];
    expect((options.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('explicit Authorization header overrides the stored token', async () => {
    localStorage.setItem('token', 'stored-token');
    mockOkJson({});
    await apiFetch('/api/users', { headers: { Authorization: 'Bearer explicit-token' } });
    const [, options] = mockFetch.mock.calls[0];
    expect((options.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer explicit-token',
    );
  });

  it('sets Content-Type: application/json for non-FormData requests', async () => {
    mockOkJson({});
    await apiFetch('/api/tasks');
    const [, options] = mockFetch.mock.calls[0];
    expect((options.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('throws with the backend detail message on error', async () => {
    mockError(400, 'Task not found');
    await expect(apiFetch('/api/tasks/999')).rejects.toThrow('Task not found');
  });

  it('returns parsed JSON on success', async () => {
    const payload = { id: 42, title: 'Irrigate' };
    mockOkJson(payload);
    const result = await apiFetch('/api/tasks/42');
    expect(result).toEqual(payload);
  });

  it('deduplicates concurrent GET requests to the same path', async () => {
    // Arrange: one fetch call resolves both pending promises
    let resolve!: (v: unknown) => void;
    const shared = new Promise((r) => { resolve = r; });
    mockFetch.mockReturnValueOnce(
      shared.then(() => ({ ok: true, json: () => Promise.resolve([]) })),
    );

    const p1 = apiFetch('/api/tasks');
    const p2 = apiFetch('/api/tasks');

    resolve(undefined);
    await Promise.all([p1, p2]);

    // Only one HTTP call should have been made
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // Both promises resolve to the same value
    expect(await p1).toEqual(await p2);
  });

  it('does NOT deduplicate POST requests', async () => {
    mockOkJson({ id: 1 });
    mockOkJson({ id: 2 });
    await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify({ title: 'A' }) });
    await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify({ title: 'B' }) });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('removes in-flight entry after request resolves', async () => {
    mockOkJson([]);
    await apiFetch('/api/tasks');
    // After it resolves, a second call should trigger a new fetch
    mockOkJson([]);
    await apiFetch('/api/tasks');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not trigger global loading events for ordinary GET requests', async () => {
    const onStart = jest.fn();
    const onEnd = jest.fn();
    window.addEventListener('pepper-farm:loading-start', onStart);
    window.addEventListener('pepper-farm:loading-end', onEnd);

    mockOkJson([]);
    await apiFetch('/api/tasks');

    expect(onStart).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();

    window.removeEventListener('pepper-farm:loading-start', onStart);
    window.removeEventListener('pepper-farm:loading-end', onEnd);
  });

  it('triggers global loading events for GET requests during a route-loading window', async () => {
    const onStart = jest.fn();
    const onEnd = jest.fn();
    window.addEventListener('pepper-farm:loading-start', onStart);
    window.addEventListener('pepper-farm:loading-end', onEnd);

    markRouteLoadingWindow();
    mockOkJson([]);
    await apiFetch('/api/tasks');

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);

    window.removeEventListener('pepper-farm:loading-start', onStart);
    window.removeEventListener('pepper-farm:loading-end', onEnd);
  });
});

describe('apiFetch — timeout protection', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('throws a clear timeout error when timeoutMs is exceeded', async () => {
    jest.useFakeTimers();

    // Mock a fetch that respects the AbortSignal
    mockFetch.mockImplementationOnce((_url: string, opts?: RequestInit) =>
      new Promise((_, reject) => {
        opts?.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
        );
      }),
    );

    const p = apiFetch('/api/tasks', { timeoutMs: 100 });
    jest.advanceTimersByTime(200);

    await expect(p).rejects.toThrow('Request timed out after 100ms');
  });

  it('resolves normally when the request completes before timeout', async () => {
    const payload = { id: 7 };
    mockOkJson(payload);

    const result = await apiFetch('/api/tasks/7', { timeoutMs: 5000 });
    expect(result).toEqual(payload);
    // No AbortError — fetch mock resolved synchronously
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('uses a custom timeoutMs value (shorter than default)', async () => {
    jest.useFakeTimers();

    mockFetch.mockImplementationOnce((_url: string, opts?: RequestInit) =>
      new Promise((_, reject) => {
        opts?.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
        );
      }),
    );

    const p = apiFetch('/api/slow', { timeoutMs: 5_000 });
    // Only 3 s elapsed — should NOT have timed out yet
    jest.advanceTimersByTime(3_000);

    // Advance past the 5 s threshold
    jest.advanceTimersByTime(3_000);
    await expect(p).rejects.toThrow('Request timed out after 5000ms');
  });

  it('passes the AbortSignal to fetch so the in-flight request is cancelled', async () => {
    jest.useFakeTimers();

    let capturedSignal: AbortSignal | undefined;
    mockFetch.mockImplementationOnce((_url: string, opts?: RequestInit) => {
      capturedSignal = opts?.signal as AbortSignal | undefined;
      return new Promise((_, reject) => {
        opts?.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
        );
      });
    });

    const p = apiFetch('/api/tasks', { timeoutMs: 50 });
    jest.advanceTimersByTime(100);

    await expect(p).rejects.toThrow('timed out');
    expect(capturedSignal?.aborted).toBe(true);
  });
});
