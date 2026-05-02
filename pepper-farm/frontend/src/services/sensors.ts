import { apiFetch } from './api';
import { SensorAlert, SensorInfo, SensorLiveResponse, SensorReading } from '@/types/sensor';

export async function getSensors(): Promise<SensorInfo[]> {
  return apiFetch<SensorInfo[]>('/api/sensors');
}

function toApiDate(date: Date): string {
  return date.toISOString().slice(0, 19);
}

export async function refreshSensorLive(sensorId: number): Promise<SensorLiveResponse> {
  return apiFetch<SensorLiveResponse>(`/api/sensors/${sensorId}/live`, {
    method: 'POST',
  });
}

export async function getLatestSensorReading(sensorId: number): Promise<SensorReading | null> {
  try {
    return await apiFetch<SensorReading>(`/api/sensors/${sensorId}/latest`);
  } catch {
    return null;
  }
}

export async function getSensorReadings(sensorId: number, hoursBack = 48): Promise<SensorReading[]> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - hoursBack * 60 * 60 * 1000);

  const query = new URLSearchParams({
    startDate: toApiDate(startDate),
    endDate: toApiDate(endDate),
  });

  return apiFetch<SensorReading[]>(`/api/sensors/${sensorId}/readings?${query.toString()}`);
}

export async function getSensorAlerts(
  sensorId: number,
  startDate: Date,
  endDate: Date
): Promise<SensorAlert[]> {
  const query = new URLSearchParams({
    startDate: toApiDate(startDate),
    endDate: toApiDate(endDate),
  });
  return apiFetch<SensorAlert[]>(`/api/sensors/${sensorId}/alerts?${query.toString()}`);
}

export async function getSensorReadingsByRange(
  sensorId: number,
  startDate: Date,
  endDate: Date
): Promise<SensorReading[]> {
  const query = new URLSearchParams({
    startDate: toApiDate(startDate),
    endDate: toApiDate(endDate),
  });

  return apiFetch<SensorReading[]>(`/api/sensors/${sensorId}/readings?${query.toString()}`);
}