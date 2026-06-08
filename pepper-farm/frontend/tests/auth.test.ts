import { getCurrentUserId } from '@/lib/auth';

/** Build a JWT-shaped string with the given payload (signature is irrelevant here). */
function makeToken(payload: Record<string, unknown>): string {
  const b64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${b64}.signature`;
}

describe('getCurrentUserId', () => {
  afterEach(() => localStorage.clear());

  it('returns null when there is no token', () => {
    expect(getCurrentUserId()).toBeNull();
  });

  it('returns the numeric sub claim from the token', () => {
    localStorage.setItem('token', makeToken({ sub: '42', role: 'FarmManager' }));
    expect(getCurrentUserId()).toBe(42);
  });

  it('returns null for a malformed token', () => {
    localStorage.setItem('token', 'not-a-jwt');
    expect(getCurrentUserId()).toBeNull();
  });

  it('returns null when the sub claim is missing', () => {
    localStorage.setItem('token', makeToken({ role: 'FarmManager' }));
    expect(getCurrentUserId()).toBeNull();
  });
});
