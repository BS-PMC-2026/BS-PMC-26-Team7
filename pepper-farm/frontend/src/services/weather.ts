import { apiFetch } from "./apiClient";
import { WeatherAiResponse, WeatherRange, WeatherResponse } from "@/types/weather";

// Weather goes through a live upstream (Open-Meteo) that can occasionally be
// slow, so these requests get a longer timeout than the global default.
const WEATHER_TIMEOUT_MS = 20_000;

// US36 — Live farm weather for the FarmManager dashboard (rule-based, no AI).
export async function getWeather(
  range: WeatherRange = "next_2_days",
): Promise<WeatherResponse> {
  return apiFetch<WeatherResponse>(
    `/api/manager/weather?range=${encodeURIComponent(range)}`,
    { timeoutMs: WEATHER_TIMEOUT_MS },
  );
}

// US36 — Optional AI explanation, triggered only by an explicit button click.
export async function getWeatherAiRecommendation(
  range: WeatherRange = "next_2_days",
): Promise<WeatherAiResponse> {
  return apiFetch<WeatherAiResponse>("/api/manager/weather/ai-recommendation", {
    method: "POST",
    body: JSON.stringify({ range }),
    timeoutMs: WEATHER_TIMEOUT_MS,
  });
}
