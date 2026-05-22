/**
 * Tests for /manager/spray-alerts — now a redirect to /manager/spray-map#spray-alerts.
 * The standalone alerts inbox was consolidated into the Spray Map page (US30 UX fix).
 */
import React from 'react';
import { render } from '@testing-library/react';

/* ── Mocks ──────────────────────────────────────────────────────────────────── */

const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/manager/spray-alerts',
}));

/* ── Import page after mocks ────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SprayAlertsRedirectPage = require('@/app/manager/spray-alerts/page').default;

/* ── Tests ───────────────────────────────────────────────────────────────────── */

describe('SprayAlertsPage — redirect', () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it('redirects to /manager/spray-map#spray-alerts', () => {
    render(React.createElement(SprayAlertsRedirectPage));
    expect(mockReplace).toHaveBeenCalledWith('/manager/spray-map#spray-alerts');
  });

  it('renders nothing (null) while redirecting', () => {
    const { container } = render(React.createElement(SprayAlertsRedirectPage));
    expect(container.firstChild).toBeNull();
  });
});
