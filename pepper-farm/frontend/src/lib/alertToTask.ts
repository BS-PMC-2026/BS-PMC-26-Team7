import type { RecentAlert } from '@/types/anomaly';
import type { TaskPriority } from '@/types/task';

export interface AlertTaskPrefill {
  alertId: number;
  title: string;
  description: string;
  priority: TaskPriority;
  taskType: string;
  zoneCode: string;
}

export function buildAlertTaskPrefill(alert: RecentAlert): AlertTaskPrefill {
  const zone = alert.zoneName || alert.zoneCode || '';
  const title = `Handle alert: ${alert.metricName}${zone ? ` in ${zone}` : ''}`;

  const range =
    alert.minAllowed !== null && alert.maxAllowed !== null
      ? ` (allowed: ${alert.minAllowed}–${alert.maxAllowed})`
      : alert.maxAllowed !== null
      ? ` (allowed: ≤${alert.maxAllowed})`
      : '';

  const lines: string[] = [
    `Created from alert #${alert.alertId}.`,
    `Sensor: #${alert.sensorId} | Metric: ${alert.metricName} | Value: ${alert.actualValue}${range}`,
  ];
  if (zone) lines.push(`Zone: ${zone}`);
  if (alert.plantCode) lines.push(`Plant: ${alert.plantCode}`);
  if (alert.pepperName) lines.push(`Pepper: ${alert.pepperName}`);
  lines.push(`Time: ${new Date(alert.createdAtUtc).toLocaleString()}`);
  lines.push(`Message: ${alert.message}`);

  const priority: TaskPriority =
    alert.severity === 'High' ? 'critical'
    : alert.severity === 'Medium' ? 'high'
    : 'medium';

  const lower = alert.metricName.toLowerCase();
  const taskType = lower.includes('moisture') ? 'irrigation' : 'inspection';

  return {
    alertId: alert.alertId,
    title,
    description: lines.join('\n'),
    priority,
    taskType,
    zoneCode: alert.zoneCode ?? '',
  };
}

export function buildAlertTaskQueryString(alert: RecentAlert): string {
  const prefill = buildAlertTaskPrefill(alert);
  const params = new URLSearchParams();
  params.set('alertId', String(prefill.alertId));
  params.set('title', prefill.title);
  params.set('description', prefill.description);
  params.set('priority', prefill.priority);
  params.set('taskType', prefill.taskType);
  if (prefill.zoneCode) params.set('zoneCode', prefill.zoneCode);
  return params.toString();
}
