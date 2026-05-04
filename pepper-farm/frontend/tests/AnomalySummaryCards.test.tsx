import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AnomalySummaryCards from '@/components/anomalies/AnomalySummaryCards';
import type { AnomalySummary } from '@/types/anomaly';

// ---------- Helper ----------

function makeSummary(overrides: Partial<AnomalySummary> = {}): AnomalySummary {
  return {
    activeAlerts: 0,
    highSeverity: 0,
    affectedZones: 0,
    latestReadingUtc: null,
    ...overrides,
  };
}

// ---------- Card labels render ----------

test('renders all 4 KPI card labels', () => {
  render(<AnomalySummaryCards summary={makeSummary()} />);

  expect(screen.getByText('Active Anomalies')).toBeInTheDocument();
  expect(screen.getByText('High Severity')).toBeInTheDocument();
  expect(screen.getByText('Affected Zones')).toBeInTheDocument();
  expect(screen.getByText('Latest Reading')).toBeInTheDocument();
});

// ---------- Active alerts > 0 ----------

test('displays active alerts count when greater than zero', () => {
  render(<AnomalySummaryCards summary={makeSummary({ activeAlerts: 7 })} />);
  expect(screen.getByText('7')).toBeInTheDocument();
});

test('shows "Attention" badge when active alerts > 0', () => {
  render(<AnomalySummaryCards summary={makeSummary({ activeAlerts: 3 })} />);
  expect(screen.getByText('Attention')).toBeInTheDocument();
});

test('shows "All clear" badge when no active alerts', () => {
  render(<AnomalySummaryCards summary={makeSummary({ activeAlerts: 0 })} />);
  expect(screen.getByText('All clear')).toBeInTheDocument();
});

// ---------- High severity ----------

test('displays high severity count', () => {
  render(<AnomalySummaryCards summary={makeSummary({ highSeverity: 5 })} />);
  expect(screen.getByText('5')).toBeInTheDocument();
});

test('shows "Critical" badge when high severity > 0', () => {
  render(<AnomalySummaryCards summary={makeSummary({ highSeverity: 2 })} />);
  expect(screen.getByText('Critical')).toBeInTheDocument();
});

test('shows "None" badge when no high severity', () => {
  render(<AnomalySummaryCards summary={makeSummary({ highSeverity: 0 })} />);
  expect(screen.getByText('None')).toBeInTheDocument();
});

// ---------- Affected zones ----------

test('displays affected zones count', () => {
  render(<AnomalySummaryCards summary={makeSummary({ affectedZones: 4 })} />);
  expect(screen.getByText('4')).toBeInTheDocument();
});

test('shows "Impacted" badge when zones are affected', () => {
  render(<AnomalySummaryCards summary={makeSummary({ affectedZones: 2 })} />);
  expect(screen.getByText('Impacted')).toBeInTheDocument();
});

test('shows "Healthy" badge when no zones are affected', () => {
  render(<AnomalySummaryCards summary={makeSummary({ affectedZones: 0 })} />);
  expect(screen.getByText('Healthy')).toBeInTheDocument();
});

// ---------- Latest reading ----------

test('displays "—" when latest reading timestamp is null', () => {
  render(<AnomalySummaryCards summary={makeSummary({ latestReadingUtc: null })} />);
  expect(screen.getByText('—')).toBeInTheDocument();
});

test('displays "No data" badge when no latest reading', () => {
  render(<AnomalySummaryCards summary={makeSummary({ latestReadingUtc: null })} />);
  expect(screen.getByText('No data')).toBeInTheDocument();
});

test('displays time ago for recent reading', () => {
  // 5 minutes ago
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  render(<AnomalySummaryCards summary={makeSummary({ latestReadingUtc: fiveMinAgo })} />);
  // Should show "5m ago" (or similar)
  expect(screen.getByText(/m ago|s ago/)).toBeInTheDocument();
});

// ---------- Combined scenarios ----------

test('renders all cards correctly when farm has multiple issues', () => {
  const summary = makeSummary({
    activeAlerts: 8,
    highSeverity: 3,
    affectedZones: 2,
    latestReadingUtc: new Date().toISOString(),
  });
  render(<AnomalySummaryCards summary={summary} />);

  // All 4 numbers visible
  expect(screen.getByText('8')).toBeInTheDocument();
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.getByText('2')).toBeInTheDocument();

  // Active state badges
  expect(screen.getByText('Attention')).toBeInTheDocument();
  expect(screen.getByText('Critical')).toBeInTheDocument();
  expect(screen.getByText('Impacted')).toBeInTheDocument();
});

test('renders all cards correctly when farm is healthy', () => {
  const summary = makeSummary({
    activeAlerts: 0,
    highSeverity: 0,
    affectedZones: 0,
    latestReadingUtc: new Date().toISOString(),
  });
  render(<AnomalySummaryCards summary={summary} />);

  // Healthy badges visible
  expect(screen.getByText('All clear')).toBeInTheDocument();
  expect(screen.getByText('None')).toBeInTheDocument();
  expect(screen.getByText('Healthy')).toBeInTheDocument();
});
