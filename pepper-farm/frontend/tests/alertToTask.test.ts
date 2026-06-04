import { buildAlertTaskPrefill, buildAlertTaskQueryString } from '@/lib/alertToTask';
import type { RecentAlert } from '@/types/anomaly';

function makeAlert(overrides: Partial<RecentAlert> = {}): RecentAlert {
  return {
    alertId: 7,
    sensorId: 3,
    readingId: 10,
    metricName: 'Temperature',
    actualValue: 38.5,
    minAllowed: 18,
    maxAllowed: 30,
    severity: 'High',
    message: 'Temperature out of range',
    isResolved: false,
    createdAtUtc: '2026-05-12T10:00:00',
    zoneName: 'Greenhouse A',
    zoneCode: 'GH-01',
    plantCode: 'PLANT-01',
    pepperName: 'Sweet Bell',
    ...overrides,
  };
}

// ------------------------------------------------------------------ //
// buildAlertTaskPrefill
// ------------------------------------------------------------------ //

test('sets alertId from the source alert', () => {
  const prefill = buildAlertTaskPrefill(makeAlert({ alertId: 42 }));
  expect(prefill.alertId).toBe(42);
});

test('builds title from metricName and zoneName', () => {
  const prefill = buildAlertTaskPrefill(makeAlert({ metricName: 'Temperature', zoneName: 'Greenhouse A' }));
  expect(prefill.title).toContain('Temperature');
  expect(prefill.title).toContain('Greenhouse A');
});

test('falls back to zoneCode in title when zoneName is null', () => {
  const prefill = buildAlertTaskPrefill(makeAlert({ zoneName: null, zoneCode: 'GH-02' }));
  expect(prefill.title).toContain('GH-02');
});

test('maps High severity to critical priority', () => {
  const prefill = buildAlertTaskPrefill(makeAlert({ severity: 'High' }));
  expect(prefill.priority).toBe('critical');
});

test('maps Medium severity to high priority', () => {
  const prefill = buildAlertTaskPrefill(makeAlert({ severity: 'Medium' }));
  expect(prefill.priority).toBe('high');
});

test('maps moisture metric to irrigation task type', () => {
  const prefill = buildAlertTaskPrefill(makeAlert({ metricName: 'Soil Moisture' }));
  expect(prefill.taskType).toBe('irrigation');
});

test('maps temperature metric to inspection task type', () => {
  const prefill = buildAlertTaskPrefill(makeAlert({ metricName: 'Temperature' }));
  expect(prefill.taskType).toBe('inspection');
});

test('maps PAR metric to inspection task type', () => {
  const prefill = buildAlertTaskPrefill(makeAlert({ metricName: 'PAR' }));
  expect(prefill.taskType).toBe('inspection');
});

test('passes through zoneCode for the form', () => {
  const prefill = buildAlertTaskPrefill(makeAlert({ zoneCode: 'NUR-01' }));
  expect(prefill.zoneCode).toBe('NUR-01');
});

test('sets zoneCode to empty string when null', () => {
  const prefill = buildAlertTaskPrefill(makeAlert({ zoneCode: null }));
  expect(prefill.zoneCode).toBe('');
});

test('description includes alert id', () => {
  const prefill = buildAlertTaskPrefill(makeAlert({ alertId: 99 }));
  expect(prefill.description).toContain('#99');
});

test('description includes actual value', () => {
  const prefill = buildAlertTaskPrefill(makeAlert({ actualValue: 38.5 }));
  expect(prefill.description).toContain('38.5');
});

test('description includes allowed range when both bounds exist', () => {
  const prefill = buildAlertTaskPrefill(makeAlert({ minAllowed: 18, maxAllowed: 30 }));
  expect(prefill.description).toContain('18');
  expect(prefill.description).toContain('30');
});

test('description includes the alert message', () => {
  const prefill = buildAlertTaskPrefill(makeAlert({ message: 'Critical overheating detected' }));
  expect(prefill.description).toContain('Critical overheating detected');
});

// ------------------------------------------------------------------ //
// buildAlertTaskQueryString
// ------------------------------------------------------------------ //

test('query string includes alertId param', () => {
  const qs = buildAlertTaskQueryString(makeAlert({ alertId: 7 }));
  const params = new URLSearchParams(qs);
  expect(params.get('alertId')).toBe('7');
});

test('query string includes title param', () => {
  const qs = buildAlertTaskQueryString(makeAlert({ metricName: 'Humidity', zoneName: 'Zone B' }));
  const params = new URLSearchParams(qs);
  expect(params.get('title')).toContain('Humidity');
});

test('query string includes priority param', () => {
  const qs = buildAlertTaskQueryString(makeAlert({ severity: 'High' }));
  const params = new URLSearchParams(qs);
  expect(params.get('priority')).toBe('critical');
});

test('query string includes taskType param', () => {
  const qs = buildAlertTaskQueryString(makeAlert({ metricName: 'Temperature' }));
  const params = new URLSearchParams(qs);
  expect(params.get('taskType')).toBe('inspection');
});

test('query string includes zoneCode when available', () => {
  const qs = buildAlertTaskQueryString(makeAlert({ zoneCode: 'GH-01' }));
  const params = new URLSearchParams(qs);
  expect(params.get('zoneCode')).toBe('GH-01');
});

test('query string omits zoneCode when null', () => {
  const qs = buildAlertTaskQueryString(makeAlert({ zoneCode: null }));
  const params = new URLSearchParams(qs);
  expect(params.get('zoneCode')).toBeNull();
});
