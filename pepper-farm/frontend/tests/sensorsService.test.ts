import {
  getSensors,
  getLatestSensorReading,
  getSensorReadings,
  getSensorReadingsByRange,
  getSensorAlerts,
  refreshSensorLive,
} from '@/services/sensors';

global.fetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------- getSensors ----------

test('getSensors fetches sensor list from /api/sensors', async () => {
  const mockSensors = [
    { SensorId: 1, MacAddress: 'AA:BB', DeviceName: 'Test', IsActive: true },
    { SensorId: 2, MacAddress: 'CC:DD', DeviceName: 'Test 2', IsActive: false },
  ];
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => mockSensors,
  });

  const result = await getSensors();
  expect(result).toEqual(mockSensors);
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/sensors'),
    expect.any(Object)
  );
});

test('getSensors throws on API error with detail message', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    statusText: 'Internal Server Error',
    json: async () => ({ detail: 'Database unavailable' }),
  });

  await expect(getSensors()).rejects.toThrow('Database unavailable');
});

// ---------- getLatestSensorReading ----------

test('getLatestSensorReading returns reading when API succeeds', async () => {
  const mockReading = {
    ReadingId: 1, SensorId: 1, MacAddress: 'AA',
    Temperature: 24.5, Humidity: 60.0,
    SampleTimeUtc: '2026-04-27T09:00:00',
  };
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => mockReading,
  });

  const result = await getLatestSensorReading(1);
  expect(result).toEqual(mockReading);
});

test('getLatestSensorReading returns null when 404 (no readings)', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    statusText: 'Not Found',
    json: async () => ({ detail: 'No readings found' }),
  });

  const result = await getLatestSensorReading(999);
  expect(result).toBeNull();
});

// ---------- getSensorReadingsByRange ----------

test('getSensorReadingsByRange builds query string with startDate and endDate', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => [],
  });

  await getSensorReadingsByRange(
    1,
    new Date('2026-04-27T00:00:00Z'),
    new Date('2026-04-28T00:00:00Z')
  );

  const calledUrl = (fetch as jest.Mock).mock.calls[0][0];
  expect(calledUrl).toContain('/api/sensors/1/readings');
  expect(calledUrl).toContain('startDate=2026-04-27');
  expect(calledUrl).toContain('endDate=2026-04-28');
});

// ---------- refreshSensorLive ----------

test('refreshSensorLive uses POST method', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ sensorId: 1, status: 'live', isStale: false }),
  });

  await refreshSensorLive(1);

  const options = (fetch as jest.Mock).mock.calls[0][1];
  expect(options.method).toBe('POST');
});

// ---------- getSensorAlerts ----------

test('getSensorAlerts returns alerts array', async () => {
  const mockAlerts = [
    {
      AlertId: 1, SensorId: 1, ReadingId: 1,
      MetricName: 'Temperature', ActualValue: 35,
      Severity: 'critical', Message: 'Too hot', IsResolved: false,
      CreatedAtUtc: '2026-04-27T09:00:00',
    },
  ];
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => mockAlerts,
  });

  const result = await getSensorAlerts(
    1,
    new Date('2026-04-27T00:00:00Z'),
    new Date('2026-04-28T00:00:00Z')
  );
  expect(result).toHaveLength(1);
  expect(result[0].MetricName).toBe('Temperature');
});

// ---------- getSensorReadings (default 48h) ----------

test('getSensorReadings defaults to 48 hours back when no parameter given', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => [],
  });

  const before = Date.now();
  await getSensorReadings(1);
  const after = Date.now();

  const calledUrl = (fetch as jest.Mock).mock.calls[0][0];
  const startMatch = calledUrl.match(/startDate=([^&]+)/);
  const endMatch = calledUrl.match(/endDate=([^&]+)/);

  const startTime = new Date(decodeURIComponent(startMatch![1])).getTime();
  const endTime = new Date(decodeURIComponent(endMatch![1])).getTime();
  const diff = endTime - startTime;

  // Should be approximately 48 hours
  expect(diff).toBeGreaterThanOrEqual(48 * 60 * 60 * 1000 - 1000);
  expect(diff).toBeLessThanOrEqual(48 * 60 * 60 * 1000 + 1000);
});