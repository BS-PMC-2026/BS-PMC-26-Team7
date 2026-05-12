import {
  getAnomalySummary,
  getRecentAlerts,
  getAnomalyTrends,
  getZoneHealth,
  resolveAlert,
} from '@/services/anomalies';

global.fetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  // Mock localStorage for token retrieval
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn(() => 'fake-token-123'),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    },
    writable: true,
  });
});

// ---------- getAnomalySummary ----------

test('getAnomalySummary fetches from /api/manager/anomalies/summary', async () => {
  const mockSummary = {
    activeAlerts: 5,
    highSeverity: 2,
    affectedZones: 3,
    latestReadingUtc: '2026-04-27T10:00:00',
  };
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => mockSummary,
  });

  const result = await getAnomalySummary();
  expect(result).toEqual(mockSummary);
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/manager/anomalies/summary'),
    expect.any(Object)
  );
});

test('getAnomalySummary throws on API error with detail message', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    json: async () => ({ detail: 'Database unavailable' }),
  });

  await expect(getAnomalySummary()).rejects.toThrow('Database unavailable');
});

test('getAnomalySummary sends Authorization header', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ activeAlerts: 0, highSeverity: 0, affectedZones: 0, latestReadingUtc: null }),
  });

  await getAnomalySummary();

  const calledOptions = (fetch as jest.Mock).mock.calls[0][1];
  expect(calledOptions.headers.Authorization).toContain('Bearer');
});

// ---------- getRecentAlerts ----------

test('getRecentAlerts uses default limit of 50', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => [],
  });

  await getRecentAlerts();

  const calledUrl = (fetch as jest.Mock).mock.calls[0][0];
  expect(calledUrl).toContain('limit=50');
});

test('getRecentAlerts uses custom limit when provided', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => [],
  });

  await getRecentAlerts(25);

  const calledUrl = (fetch as jest.Mock).mock.calls[0][0];
  expect(calledUrl).toContain('limit=25');
});

test('getRecentAlerts returns array of alerts', async () => {
  const mockAlerts = [
    {
      alertId: 1, sensorId: 1, readingId: 1,
      metricName: 'Temperature', actualValue: 35,
      minAllowed: 18, maxAllowed: 30,
      severity: 'High', message: 'Too hot', isResolved: false,
      createdAtUtc: '2026-04-27T09:00:00',
      zoneName: 'Greenhouse A', zoneCode: 'ZONE-A',
      plantCode: null, pepperName: 'Sweet Bell',
    },
  ];
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => mockAlerts,
  });

  const result = await getRecentAlerts();
  expect(result).toHaveLength(1);
  expect(result[0].metricName).toBe('Temperature');
});

test('getRecentAlerts appends since param when provided', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => [],
  });

  await getRecentAlerts(50, '2026-05-01T00:00:00');

  const calledUrl = (fetch as jest.Mock).mock.calls[0][0];
  expect(calledUrl).toContain('since=2026-05-01T00%3A00%3A00');
});

test('getRecentAlerts does not append since param when not provided', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => [],
  });

  await getRecentAlerts(50);

  const calledUrl = (fetch as jest.Mock).mock.calls[0][0];
  expect(calledUrl).not.toContain('since=');
});

test('getRecentAlerts throws on API error', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    json: async () => ({ detail: 'Failed to fetch recent alerts.' }),
  });

  await expect(getRecentAlerts()).rejects.toThrow('Failed to fetch recent alerts.');
});

// ---------- getAnomalyTrends ----------

test('getAnomalyTrends uses default 7 days', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => [],
  });

  await getAnomalyTrends();

  const calledUrl = (fetch as jest.Mock).mock.calls[0][0];
  expect(calledUrl).toContain('days=7');
});

test('getAnomalyTrends accepts custom number of days', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => [],
  });

  await getAnomalyTrends(14);

  const calledUrl = (fetch as jest.Mock).mock.calls[0][0];
  expect(calledUrl).toContain('days=14');
});

test('getAnomalyTrends returns trend points', async () => {
  const mockTrends = [
    { date: '2026-04-21', count: 2, highCount: 1 },
    { date: '2026-04-22', count: 0, highCount: 0 },
  ];
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => mockTrends,
  });

  const result = await getAnomalyTrends();
  expect(result).toHaveLength(2);
  expect(result[0].count).toBe(2);
});

// ---------- getZoneHealth ----------

test('getZoneHealth fetches from /by-zone endpoint', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => [],
  });

  await getZoneHealth();

  const calledUrl = (fetch as jest.Mock).mock.calls[0][0];
  expect(calledUrl).toContain('/api/manager/anomalies/by-zone');
});

test('getZoneHealth returns zones with health levels', async () => {
  const mockZones = [
    { zoneId: 1, zoneName: 'A', zoneCode: 'ZONE-A', totalAlerts: 5, highAlerts: 2, health: 'high' },
    { zoneId: 2, zoneName: 'B', zoneCode: 'ZONE-B', totalAlerts: 1, highAlerts: 0, health: 'medium' },
  ];
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => mockZones,
  });

  const result = await getZoneHealth();
  expect(result).toHaveLength(2);
  expect(result[0].health).toBe('high');
});

// ---------- resolveAlert ----------

test('resolveAlert uses PATCH method', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ alertId: 1, isResolved: true }),
  });

  await resolveAlert(1);

  const options = (fetch as jest.Mock).mock.calls[0][1];
  expect(options.method).toBe('PATCH');
});

test('resolveAlert sends correct alert ID in URL', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ alertId: 42, isResolved: true }),
  });

  await resolveAlert(42);

  const calledUrl = (fetch as jest.Mock).mock.calls[0][0];
  expect(calledUrl).toContain('/api/sensor-alerts/42/resolve');
});

test('resolveAlert returns resolved status from server', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ alertId: 1, isResolved: true }),
  });

  const result = await resolveAlert(1);
  expect(result.isResolved).toBe(true);
  expect(result.alertId).toBe(1);
});

test('resolveAlert throws on API error', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    json: async () => ({ detail: 'Alert 999 not found.' }),
  });

  await expect(resolveAlert(999)).rejects.toThrow('Alert 999 not found.');
});
