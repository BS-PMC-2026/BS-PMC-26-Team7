export interface AnomalySummary {
  activeAlerts: number;
  highSeverity: number;
  affectedZones: number;
  latestReadingUtc: string | null;
}

export interface RecentAlert {
  alertId: number;
  sensorId: number;
  readingId: number;
  metricName: string;
  actualValue: number;
  minAllowed: number | null;
  maxAllowed: number | null;
  severity: 'High' | 'Medium';
  message: string;
  isResolved: boolean;
  resolvedAtUtc: string | null;
  createdAtUtc: string;
  zoneName: string | null;
  zoneCode: string | null;
  plantCode: string | null;
  pepperName: string | null;
  isRecurring: boolean;
  occurrenceCount: number;
}

export interface TrendPoint {
  date: string;
  count: number;
  highCount: number;
}

export interface PaginatedAlertResponse {
  total: number;
  items: RecentAlert[];
}

export interface ZoneHealth {
  zoneId: number;
  zoneName: string;
  zoneCode: string | null;
  totalAlerts: number;
  highAlerts: number;
  health: 'normal' | 'medium' | 'high';
}
