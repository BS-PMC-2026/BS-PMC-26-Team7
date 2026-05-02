'use client';

import { useEffect, useMemo, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import {
  getLatestSensorReading,
  getSensorReadings,
  refreshSensorLive,
} from '@/services/sensors';import { SensorLiveResponse, SensorReading } from '@/types/sensor';

const SENSOR_ID = 1;

function formatNumber(value?: number | null, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(digits);
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';

  const utcValue = value.endsWith('Z') ? value : `${value}Z`;
  const date = new Date(utcValue);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function getStatusLabel(status?: string): string {
  switch (status) {
    case 'live':
      return 'Live';
    case 'recent':
      return 'Recent';
    case 'stale':
      return 'Stale';
    case 'no_data':
      return 'No Data';
    default:
      return 'Unknown';
  }
}

function getStatusClasses(status?: string): string {
  switch (status) {
    case 'live':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'recent':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'stale':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

function MetricCard({
  title,
  value,
  unit,
}: {
  title: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-gray-900">
        {value}
        {unit && <span className="text-base font-normal text-gray-500"> {unit}</span>}
      </p>
    </div>
  );
}

export default function SensorDashboardPage() {
  const [liveData, setLiveData] = useState<SensorLiveResponse | null>(null);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  async function loadDashboard(isManualRefresh = false) {
  try {
    setError(null);

    if (isManualRefresh) {
      setRefreshing(true);
      setSyncError(null);

      try {
        const live = await refreshSensorLive(SENSOR_ID);
        setLiveData(live);
      } catch (err) {
        setSyncError(
          err instanceof Error
            ? err.message
            : 'Failed to sync from Atomation. Showing latest DB data.'
        );
      }
    } else {
      setLoading(true);
    }

    const [latest, history] = await Promise.all([
      getLatestSensorReading(SENSOR_ID),
      getSensorReadings(SENSOR_ID, 48),
    ]);

    setReadings(history);

    if (latest) {
      const sampleTime = new Date(`${latest.SampleTimeUtc}Z`);
      const staleMinutes = Math.floor((Date.now() - sampleTime.getTime()) / 60000);

      let status: SensorLiveResponse['status'] = 'stale';
      let isStale = true;
      let message = 'Sensor data is stale. No recent readings were received from Atomation.';

      if (staleMinutes <= 30) {
        status = 'live';
        isStale = false;
        message = 'Sensor data is up to date.';
      } else if (staleMinutes <= 360) {
        status = 'recent';
        isStale = false;
        message = 'Sensor data is recent, but not fully live.';
      }

      setLiveData({
        sensorId: SENSOR_ID,
        macAddress: latest.MacAddress,
        sync: null,
        latestReading: latest,
        status,
        isStale,
        staleMinutes,
        message,
      });
    } else {
      setLiveData({
        sensorId: SENSOR_ID,
        macAddress: '',
        sync: null,
        latestReading: null,
        status: 'no_data',
        isStale: true,
        staleMinutes: null,
        message: 'No readings found for this sensor.',
      });
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to load sensor dashboard.');
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
}

  useEffect(() => {
    loadDashboard(false);
  }, []);

  const latest = liveData?.latestReading ?? null;

  const recentReadings = useMemo(() => {
    return [...readings].sort(
      (a, b) =>
        new Date(`${b.SampleTimeUtc}Z`).getTime() -
        new Date(`${a.SampleTimeUtc}Z`).getTime()
    );
  }, [readings]);

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-gray-600">Loading sensor dashboard...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sensor Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Live view for Atomation sensor {liveData?.macAddress ?? '—'}
          </p>
        </div>

        <Button onClick={() => loadDashboard(true)} disabled={refreshing}>
          {refreshing ? 'Syncing...' : 'Sync from Atomation'}
        </Button>
      </div>

      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}
      {syncError && (
        <Alert variant="info" className="mb-6">
        Atomation sync failed. Showing latest data from the database. Details: {syncError}
        </Alert>
    )}

      {liveData && (
        <div
          className={`mb-6 rounded-2xl border px-5 py-4 ${getStatusClasses(
            liveData.status
          )}`}
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Status: {getStatusLabel(liveData.status)}</p>
              <p className="text-sm">{liveData.message}</p>
            </div>

            <p className="text-sm">
              Stale minutes:{' '}
              <span className="font-semibold">
                {liveData.staleMinutes ?? '—'}
              </span>
            </p>
          </div>
        </div>
      )}

      {!latest ? (
        <Alert variant="info">No readings found for this sensor.</Alert>
      ) : (
        <>
          <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Temperature"
              value={formatNumber(latest.Temperature)}
              unit="°C"
            />
            <MetricCard
              title="Humidity"
              value={formatNumber(latest.Humidity)}
              unit="%"
            />
            <MetricCard
              title="Leak"
              value={formatNumber(latest.Leak, 3)}
            />
            <MetricCard
              title="Battery"
              value={formatNumber(latest.BatteryLevel, 0)}
              unit="%"
            />
          </section>

          <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Latest Reading
            </h2>

            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <p>
                <span className="text-gray-500">Reading ID:</span>{' '}
                <span className="font-medium">{latest.ReadingId}</span>
              </p>
              <p>
                <span className="text-gray-500">Type:</span>{' '}
                <span className="font-medium">{latest.ReadingType ?? '—'}</span>
              </p>
              <p>
                <span className="text-gray-500">Sample time:</span>{' '}
                <span className="font-medium">{formatDateTime(latest.SampleTimeUtc)}</span>
              </p>
              <p>
                <span className="text-gray-500">Gateway read:</span>{' '}
                <span className="font-medium">{formatDateTime(latest.GatewayReadTimeUtc)}</span>
              </p>
              <p>
                <span className="text-gray-500">Atomation created:</span>{' '}
                <span className="font-medium">{formatDateTime(latest.AtomationCreatedAtUtc)}</span>
              </p>
              <p>
                <span className="text-gray-500">Location:</span>{' '}
                <span className="font-medium">
                  {formatNumber(latest.Latitude, 5)}, {formatNumber(latest.Longitude, 5)}
                </span>
              </p>
            </div>
          </section>
        </>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Last 48 Hours</h2>
          <p className="text-sm text-gray-500">{recentReadings.length} readings</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-600">
                <th className="px-3 py-3">Sample Time</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Temp</th>
                <th className="px-3 py-3">Humidity</th>
                <th className="px-3 py-3">Leak</th>
                <th className="px-3 py-3">Battery</th>
                <th className="px-3 py-3">Atomation Created</th>
              </tr>
            </thead>

            <tbody>
              {recentReadings.map((reading) => (
                <tr key={reading.ReadingId} className="border-b last:border-b-0">
                  <td className="px-3 py-3">{formatDateTime(reading.SampleTimeUtc)}</td>
                  <td className="px-3 py-3">{reading.ReadingType ?? '—'}</td>
                  <td className="px-3 py-3">{formatNumber(reading.Temperature)}°C</td>
                  <td className="px-3 py-3">{formatNumber(reading.Humidity)}%</td>
                  <td className="px-3 py-3">{formatNumber(reading.Leak, 3)}</td>
                  <td className="px-3 py-3">{formatNumber(reading.BatteryLevel, 0)}%</td>
                  <td className="px-3 py-3">{formatDateTime(reading.AtomationCreatedAtUtc)}</td>
                </tr>
              ))}

              {recentReadings.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                    No readings found in the last 48 hours.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}