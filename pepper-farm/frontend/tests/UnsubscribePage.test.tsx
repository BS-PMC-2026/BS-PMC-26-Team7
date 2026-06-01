/**
 * Tests for /unsubscribe page (US40)
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: (k: string) => (k === 'token' ? 'validtoken123' : null) }),
  useRouter: () => ({ push: jest.fn() }),
}));

const mockUnsubscribeByToken = jest.fn();
jest.mock('@/services/emailConsentService', () => ({
  unsubscribeByToken: (...a: unknown[]) => mockUnsubscribeByToken(...a),
  getMyConsent: jest.fn(),
  updateMyConsent: jest.fn(),
}));

jest.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({
    locale: 'en', dir: 'ltr', setLocale: jest.fn(),
    t: {
      consent: {
        unsubscribeFromNewsletter: 'Unsubscribe from newsletters',
        unsubscribeSuccess:        'You have been unsubscribed from marketing emails.',
        alreadyUnsubscribed:       'You are already unsubscribed.',
        invalidUnsubscribeLink:    'This unsubscribe link is invalid or has already been used.',
        processingUnsubscribe:     'Processing...',
        agreeToEmails:             'I agree to receive newsletters.',
      },
      common: { loading: 'Loading...' },
    },
  }),
}));

import UnsubscribePage from '@/app/unsubscribe/page';

describe('UnsubscribePage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows success message when unsubscribe succeeds', async () => {
    mockUnsubscribeByToken.mockResolvedValue({
      success: true,
      message: 'You have been unsubscribed from marketing emails.',
    });

    render(<UnsubscribePage />);

    await waitFor(() => {
      expect(screen.getByTestId('unsubscribe-result')).toBeInTheDocument();
      expect(screen.getByTestId('unsubscribe-title')).toHaveTextContent(
        'You have been unsubscribed from marketing emails.',
      );
    });
  });

  it('shows already unsubscribed message', async () => {
    mockUnsubscribeByToken.mockResolvedValue({
      success: true,
      message: 'You are already unsubscribed from marketing emails.',
    });

    render(<UnsubscribePage />);

    await waitFor(() => {
      expect(screen.getByTestId('unsubscribe-title')).toHaveTextContent('already');
    });
  });

  it('shows invalid link message when success is false', async () => {
    mockUnsubscribeByToken.mockResolvedValue({
      success: false,
      message: 'This unsubscribe link is invalid or has already been used.',
    });

    render(<UnsubscribePage />);

    await waitFor(() => {
      expect(screen.getByTestId('unsubscribe-title')).toHaveTextContent('invalid');
    });
  });

  it('calls unsubscribeByToken with the token from search params', async () => {
    mockUnsubscribeByToken.mockResolvedValue({ success: true, message: 'Done.' });
    render(<UnsubscribePage />);

    await waitFor(() => {
      expect(mockUnsubscribeByToken).toHaveBeenCalledWith('validtoken123');
    });
  });
});
