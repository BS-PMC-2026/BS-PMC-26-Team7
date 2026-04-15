const BASE_URL = '';

interface ApiError {
  message: string;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const err: ApiError = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message);
  }

  return res.json() as Promise<T>;
}
