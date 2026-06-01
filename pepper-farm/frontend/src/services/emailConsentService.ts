import { apiFetch } from './api';

export interface ConsentStatus {
  userId: number;
  emailConsent: boolean;
  emailMarketingConsentUpdatedAtUtc: string | null;
  emailUnsubscribedAtUtc: string | null;
}

export interface UnsubscribeResult {
  success: boolean;
  message: string;
}

export async function getMyConsent(): Promise<ConsentStatus> {
  return apiFetch<ConsentStatus>('/api/email-consent/me');
}

export async function updateMyConsent(emailConsent: boolean): Promise<ConsentStatus> {
  return apiFetch<ConsentStatus>('/api/email-consent/me', {
    method: 'PUT',
    body: JSON.stringify({ emailConsent }),
  });
}

export async function unsubscribeByToken(token: string): Promise<UnsubscribeResult> {
  return apiFetch<UnsubscribeResult>(
    `/api/email-consent/unsubscribe?token=${encodeURIComponent(token)}`,
  );
}
