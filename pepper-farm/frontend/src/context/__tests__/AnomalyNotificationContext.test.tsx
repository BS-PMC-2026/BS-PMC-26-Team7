/**
 * Tests for AnomalyNotificationContext.
 *
 * Focus: the context must NOT start polling or open SSE when there is no
 * auth token in localStorage (unauthenticated / public pages).
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { AnomalyNotificationProvider } from '../AnomalyNotificationContext';

// ── Service mocks ──────────────────────────────────────────────────────────
jest.mock('../../services/anomalies', () => ({
  getRecentAlerts: jest.fn(),
}));

jest.mock('../../services/tasks', () => ({
  getCompletedTasks: jest.fn(),
}));

// ── Toast context mock ─────────────────────────────────────────────────────
jest.mock('../ToastContext', () => ({
  useToast: () => ({ show: jest.fn() }),
}));

// ── EventSource mock ───────────────────────────────────────────────────────
const mockESClose = jest.fn();
const mockESInstance = {
  addEventListener: jest.fn(),
  close: mockESClose,
  onerror: null as ((e: Event) => void) | null,
  onopen:  null as (() => void) | null,
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).EventSource = jest.fn(() => mockESInstance);

import { getRecentAlerts } from '../../services/anomalies';
import { getCompletedTasks } from '../../services/tasks';

// ── Helpers ────────────────────────────────────────────────────────────────
function Wrapper() {
  return (
    <AnomalyNotificationProvider>
      <div data-testid="child" />
    </AnomalyNotificationProvider>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────
describe('AnomalyNotificationContext — unauthenticated guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('does NOT call getRecentAlerts when localStorage has no token', async () => {
    await act(async () => {
      render(<Wrapper />);
    });
    expect(getRecentAlerts).not.toHaveBeenCalled();
  });

  it('does NOT call getCompletedTasks when localStorage has no token', async () => {
    await act(async () => {
      render(<Wrapper />);
    });
    expect(getCompletedTasks).not.toHaveBeenCalled();
  });

  it('does NOT open an EventSource when localStorage has no token', async () => {
    await act(async () => {
      render(<Wrapper />);
    });
    expect(global.EventSource).not.toHaveBeenCalled();
  });

  it('calls getRecentAlerts when a token IS present', async () => {
    localStorage.setItem('token', 'test-jwt');
    (getRecentAlerts as jest.Mock).mockResolvedValueOnce({ items: [] });
    (getCompletedTasks as jest.Mock).mockResolvedValueOnce([]);

    await act(async () => {
      render(<Wrapper />);
    });

    expect(getRecentAlerts).toHaveBeenCalled();
  });
});
