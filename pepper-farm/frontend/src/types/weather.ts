// US36 — Weather Integration for Smarter Farming.
// Mirrors the backend schemas (schemas/weather.py).

export type WeatherRange = "today" | "next_2_days" | "next_7_days";

export interface WeatherLocation {
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface WeatherCurrent {
  temperatureC: number;
  humidityPct: number;
  windSpeedKph: number;
  precipitationMm: number;
  weatherCode: number;
  condition: string;
  observedAtLocal: string;
}

export interface WeatherForecastDay {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  precipitationProbabilityPct: number | null;
  windSpeedMaxKph: number;
  weatherCode: number;
  condition: string;
}

export interface WeatherSensorSnapshot {
  avgTemperatureC: number | null;
  avgHumidityPct: number | null;
  avgPar: number | null;
  sensorCount: number;
  sensorNames: string[];
  latestReadingUtc: string | null;
}

export type WeatherActivity = "spraying" | "irrigation" | "field_work";
export type WeatherRecommendationStatus = "advised" | "caution" | "not_advised";

export interface WeatherRecommendation {
  activity: WeatherActivity;
  status: WeatherRecommendationStatus;
  reason: string;
  factors: string[];
}

export interface WeatherResponse {
  location: WeatherLocation;
  current: WeatherCurrent;
  forecast: WeatherForecastDay[];
  sensors: WeatherSensorSnapshot | null;
  recommendations: WeatherRecommendation[];
  selectedRange: WeatherRange;
}

export interface WeatherAiRequest {
  range: WeatherRange;
}

export type WeatherAiSource = "ai" | "fallback";

export interface WeatherAiResponse {
  recommendations: WeatherRecommendation[];
  explanation: string;
  source: WeatherAiSource;
}
