/**
 * Lightweight client-side helpers for reading the stored auth token.
 *
 * NOTE: decoding the JWT here is purely for UI affordances (e.g. deciding
 * whether to show a Delete button). It is NOT a security boundary — the backend
 * remains the authoritative guard for every protected action.
 */

/** Decode a JWT payload without verifying the signature. Returns null on failure. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    // Convert base64url -> base64 before decoding.
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Current user's id taken from the JWT `sub` claim, or null when there is no
 * valid token. Used only to gate UI (e.g. show Delete on tasks I created).
 */
export function getCurrentUserId(): number | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('token');
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  const sub = payload?.sub;
  if (sub === undefined || sub === null) return null;
  const id = Number(sub);
  return Number.isFinite(id) ? id : null;
}
