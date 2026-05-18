/**
 * Centralised HTTP helper for all frontend API calls.
 *
 * Always uses same-origin relative paths (/api/...) so requests go through
 * the Next.js rewrite proxy and never cross-origin from the browser.
 * That removes CORS OPTIONS preflights entirely in local dev and production.
 *
 * GET requests are deduplicated: concurrent calls to the same path share one
 * in-flight Promise. This eliminates double-fetches caused by React Strict
 * Mode component remounting and sibling components loading the same resource.
 */

// In-flight map: path → Promise<unknown>.  Cleared once the request settles.
const inflight = new Map<string, Promise<unknown>>();

interface ValidationErrorItem {
  msg?: string;
}

interface ApiError {
  message?: string;
  detail?: string | ValidationErrorItem[];
}

function extractMessage(err: ApiError | null, fallback: string): string {
  if (Array.isArray(err?.detail)) {
    const msg = err.detail.map((i) => i?.msg).filter(Boolean).join(" | ");
    return msg || fallback;
  }
  if (typeof err?.detail === "string" && err.detail.trim()) return err.detail;
  if (typeof err?.message === "string" && err.message.trim()) return err.message;
  return fallback;
}

function getStoredToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem("token") : null;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Fetch a JSON API endpoint.
 *
 * - path must start with "/api/..." (relative, same-origin)
 * - Authorization header is injected automatically from localStorage
 * - Passing `options.headers.Authorization` overrides the stored token
 * - GET requests without a body are deduplicated in-flight
 * - timeoutMs defaults to 10 s; pass a shorter value (e.g. 5000) for polling
 */
export function apiFetch<T>(
  path: string,
  options?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const method = (options?.method ?? "GET").toUpperCase();
  const isGet = method === "GET" && !options?.body;
  const cacheKey = isGet ? path : null;

  if (cacheKey && inflight.has(cacheKey)) {
    return inflight.get(cacheKey) as Promise<T>;
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const isFormData = options?.body instanceof FormData;
  const token = getStoredToken();

  // Strip our custom timeoutMs so it doesn't reach the native fetch
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { timeoutMs: _omit, ...fetchOptions } = options ?? {};

  const promise = fetch(path, {
    ...fetchOptions,
    signal: controller.signal,
    headers: isFormData
      ? {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(fetchOptions.headers ?? {}),
        }
      : {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(fetchOptions.headers ?? {}),
        },
  })
    .then(async (res) => {
      if (!res.ok) {
        const err: ApiError | null = await res.json().catch(() => null);
        throw new Error(extractMessage(err, res.statusText || "Request failed"));
      }
      return res.json() as T;
    })
    .catch((err: unknown) => {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Request timed out after ${timeoutMs}ms`);
      }
      throw err;
    })
    .finally(() => {
      clearTimeout(timer);
      if (cacheKey) inflight.delete(cacheKey);
    });

  if (cacheKey) inflight.set(cacheKey, promise);
  return promise;
}
