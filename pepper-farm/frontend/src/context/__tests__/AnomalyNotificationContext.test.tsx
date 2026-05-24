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

jest.mock('../../services/spray', () => ({
  getSprayAlerts:      jest.fn(),
  markSprayAlertRead:  jest.fn(),
}));

// ── Toast context mock ─────────────────────────────────────────────────────
// IMPORTANT: must return a STABLE `show` reference across renders.
// A new jest.fn() per call would make handleNewSprayAlert referentially
// unstable, causing useEffect to loop and tests to time out.
jest.mock('../ToastContext', () => {
  const stableShow = jest.fn();
  return { useToast: () => ({ show: stableShow }) };
});

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
import { getSprayAlerts } from '../../services/spray';

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
    (getRecentAlerts as jest.Mock).mockResolvedValue({ items: [] });
    (getCompletedTasks as jest.Mock).mockResolvedValue([]);
    (getSprayAlerts as jest.Mock).mockResolvedValue([]);

    await act(async () => {
      render(<Wrapper />);
    });

    expect(getRecentAlerts).toHaveBeenCalled();
  });

  it('calls getSprayAlerts when a token IS present', async () => {
    localStorage.setItem('token', 'test-jwt');
    (getRecentAlerts as jest.Mock).mockResolvedValue({ items: [] });
    (getCompletedTasks as jest.Mock).mockResolvedValue([]);
    (getSprayAlerts as jest.Mock).mockResolvedValue([]);

    await act(async () => {
      render(<Wrapper />);
    });

    expect(getSprayAlerts).toHaveBeenCalled();
  });

  it('loads spray alerts even when getRecentAlerts fails', async () => {
    localStorage.setItem('token', 'test-jwt');
    (getRecentAlerts as jest.Mock).mockRejectedValue(new Error('Network error'));
    (getCompletedTasks as jest.Mock).mockResolvedValue([]);
    (getSprayAlerts as jest.Mock).mockResolvedValue([]);

    await act(async () => {
      render(<Wrapper />);
    });

    // Spray alerts must still be called even though sensor alerts failed
    expect(getSprayAlerts).toHaveBeenCalled();
  });
});
