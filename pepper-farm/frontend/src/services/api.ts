const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "";
interface ValidationErrorItem {
  msg?: string;
}

interface ApiError {
  message?: string;
  detail?: string | ValidationErrorItem[];
}

function extractErrorMessage(err: ApiError | null, fallback: string): string {
  if (Array.isArray(err?.detail)) {
    const message = err.detail
      .map((item) => item?.msg)
      .filter(Boolean)
      .join(' | ');

    return message || fallback;
  }

  if (typeof err?.detail === 'string' && err.detail.trim()) {
    return err.detail;
  }

  if (typeof err?.message === 'string' && err.message.trim()) {
    return err.message;
  }

  return fallback;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData;

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: isFormData
      ? {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options?.headers ?? {}),
        }
      : {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options?.headers ?? {}),
        },
  });

  if (!res.ok) {
    const err: ApiError | null = await res.json().catch(() => null);
    throw new Error(extractErrorMessage(err, res.statusText || "Request failed"));
  }

  return res.json() as Promise<T>;
}