export type SensorAlert = {
  AlertId: number;
  SensorId: number;
  ReadingId: number;
  MetricName: string;
  ActualValue: number;
  MinAllowed?: number | null;
  MaxAllowed?: number | null;
  Severity: string;
  Message: string;
  IsResolved: boolean;
  CreatedAtUtc: string;
};

export type SensorInfo = {
  SensorId: number;
  MacAddress: string;
  DeviceName?: string | null;
  UnitName?: string | null;
  SensorType?: string | null;
  IsActive: boolean;
};

export type SensorReading = {
  ReadingId: number;
  SensorId: number;
  MacAddress: string;
  DeviceName?: string | null;

  Temperature?: number | null;
  Humidity?: number | null;
  Leak?: number | null;
  VibrationSD?: number | null;
  BatteryLevel?: number | null;
  Radiation?: number | null;

  SampleTimeUtc: string;
  GatewayReadTimeUtc?: string | null;
  AtomationCreatedAtUtc?: string | null;

  ReadingType?: string | null;
  Latitude?: number | null;
  Longitude?: number | null;
};

export type SensorLiveSync = {
  macAddress: string;
  from: string;
  to: string;
  totalReceived: number;
  inserted: number;
  skippedDuplicates: number;
  pageCount: number;
};

export type SensorLiveResponse = {
  sensorId: number;
  macAddress: string;
  sync: SensorLiveSync | { error?: string; message?: string } | null;
  latestReading: SensorReading | null;
  status: 'live' | 'recent' | 'stale' | 'no_data';
  isStale: boolean;
  staleMinutes: number | null;
  message: string;
};