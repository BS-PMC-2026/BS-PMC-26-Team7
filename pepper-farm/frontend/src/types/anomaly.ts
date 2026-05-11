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
  createdAtUtc: string;
  zoneName: string | null;
  zoneCode: string | null;
  plantCode: string | null;
  pepperName: string | null;
}

export interface TrendPoint {
  date: string;
  count: number;
  highCount: number;
}

export interface ZoneHealth {
  zoneId: number;
  zoneName: string;
  zoneCode: string | null;
  totalAlerts: number;
  highAlerts: number;
  health: 'normal' | 'medium' | 'high';
}
