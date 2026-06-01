'use client';

// US36 — Weather Integration for Smarter Farming.
// Live weather card for the FarmManager dashboard: current conditions, a
// 4-day forecast, a sensor snapshot, rule-based recommendations, and an
// optional AI explanation triggered only by an explicit button click.

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { translateEnum } from '@/i18n/dictionaries';
import { getWeather, getWeatherAiRecommendation } from '@/services/weather';
import type {
  WeatherActivity,
  WeatherAiResponse,
  WeatherRange,
  WeatherRecommendation,
  WeatherRecommendationStatus,
  WeatherResponse,
} from '@/types/weather';

// Small visual hint per condition; falls back to a neutral icon.
const CONDITION_EMOJI: Record<string, string> = {
  clear: '☀️',
  mainly_clear: '🌤️',
  partly_cloudy: '⛅',
  overcast: '☁️',
  fog: '🌫️',
  drizzle: '🌦️',
  freezing_drizzle: '🌧️',
  rain: '🌧️',
  freezing_rain: '🌧️',
  snow: '❄️',
  snow_grains: '❄️',
  rain_showers: '🌦️',
  snow_showers: '🌨️',
  thunderstorm: '⛈️',
  thunderstorm_hail: '⛈️',
};

function conditionEmoji(code: string): string {
  return CONDITION_EMOJI[code] ?? '🌡️';
}

const STATUS_STYLES: Record<WeatherRecommendationStatus, string> = {
  advised: 'bg-green-100 text-green-800 border-green-200',
  caution: 'bg-amber-100 text-amber-800 border-amber-200',
  not_advised: 'bg-red-100 text-red-800 border-red-200',
};

const RANGES: WeatherRange[] = ['today', 'next_2_days'];

export default function WeatherCard() {
  const { t, locale, dir } = useLanguage();
  const w = t.weather;

  const [selectedRange, setSelectedRange] = useState<WeatherRange>('next_2_days');
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [ai, setAi] = useState<WeatherAiResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Fetch weather on mount and whenever the range changes. Never calls AI.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setAi(null); // stale once the range changes
    getWeather(selectedRange)
      .then((res) => {
        if (active) setData(res);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedRange]);

  // AI is only ever triggered by this explicit handler.
  const handleGenerateAi = useCallback(() => {
    setAiLoading(true);
    setAi(null);
    getWeatherAiRecommendation(selectedRange)
      .then((res) => setAi(res))
      .catch(() => setAi({ recommendations: [], explanation: '', source: 'fallback' }))
      .finally(() => setAiLoading(false));
  }, [selectedRange]);

  const rangeLabel = (range: WeatherRange): string =>
    range === 'today' ? w.today : w.next2Days;

  const statusLabel = (status: WeatherRecommendationStatus): string => {
    if (status === 'advised') return w.advised;
    if (status === 'caution') return w.caution;
    return w.notAdvised;
  };

  const activityLabel = (activity: WeatherActivity): string => {
    if (activity === 'spraying') return w.spraying;
    if (activity === 'irrigation') return w.irrigation;
    return w.fieldWork;
  };

  const formatDay = (iso: string): string =>
    new Date(iso).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

  const formatTime = (iso: string | null): string => {
    if (!iso) return '';
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return iso;
    return parsed.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const num = (value: number | null, suffix = ''): string =>
    value === null || value === undefined ? '—' : `${value}${suffix}`;

  return (
    <div dir={dir} className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
      {/* Header + range switcher */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[var(--color-primary)]">{w.title}</h2>
        <div className="flex items-center gap-1" role="group" aria-label={w.selectedRange}>
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setSelectedRange(range)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                selectedRange === range
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-[var(--color-primary)]'
              }`}
            >
              {rangeLabel(range)}
            </button>
          ))}
        </div>
      </div>

      {/* Initial load / hard failure (no data yet) */}
      {loading && !data && (
        <p className="text-sm text-gray-500 animate-pulse">{w.loading}</p>
      )}

      {!loading && error && !data && (
        <p className="text-sm text-red-600">{w.error}</p>
      )}

      {/* Once we have data, keep showing it even if a later request fails. */}
      {data && (
        <div className="flex flex-col gap-5">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {w.error}
            </p>
          )}

          {/* Current live weather */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 mb-2">{w.currentWeather}</h3>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-4xl" aria-hidden>
                {conditionEmoji(data.current.condition)}
              </span>
              <div>
                <p className="text-3xl font-bold text-gray-800" dir="ltr">
                  {Math.round(data.current.temperatureC)}°C
                </p>
                <p className="text-sm text-gray-600">
                  {translateEnum(data.current.condition, w.conditions)}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg bg-gray-50 p-2">
                <dt className="text-gray-500">{w.humidity}</dt>
                <dd className="font-semibold text-gray-800" dir="ltr">
                  {data.current.humidityPct}%
                </dd>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <dt className="text-gray-500">{w.windSpeed}</dt>
                <dd className="font-semibold text-gray-800" dir="ltr">
                  {Math.round(data.current.windSpeedKph)} km/h
                </dd>
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                <dt className="text-gray-500">{w.precipitation}</dt>
                <dd className="font-semibold text-gray-800" dir="ltr">
                  {data.current.precipitationMm} mm
                </dd>
              </div>
            </dl>
            {data.current.observedAtLocal && (
              <p className="mt-2 text-xs text-gray-400">
                {w.observedAt} {formatTime(data.current.observedAtLocal)}
              </p>
            )}
          </section>

          {/* 4-day forecast */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 mb-2">{w.forecast}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {data.forecast.map((day) => (
                <div
                  key={day.date}
                  className="rounded-lg border border-gray-100 bg-gray-50 p-2 text-center"
                >
                  <p className="text-xs font-medium text-gray-600">{formatDay(day.date)}</p>
                  <p className="text-2xl my-1" aria-hidden>
                    {conditionEmoji(day.condition)}
                  </p>
                  <p className="text-xs text-gray-700" dir="ltr">
                    {Math.round(day.tempMaxC)}° / {Math.round(day.tempMinC)}°
                  </p>
                  <p className="text-xs text-blue-600" dir="ltr">
                    💧 {day.precipitationProbabilityPct ?? 0}%
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {translateEnum(day.condition, w.conditions)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Sensor snapshot */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 mb-2">{w.sensorSnapshot}</h3>
            {data.sensors ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div className="rounded-lg bg-gray-50 p-2">
                  <dt className="text-gray-500">{w.temperature}</dt>
                  <dd className="font-semibold text-gray-800" dir="ltr">
                    {num(data.sensors.avgTemperatureC, '°C')}
                  </dd>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <dt className="text-gray-500">{w.humidity}</dt>
                  <dd className="font-semibold text-gray-800" dir="ltr">
                    {num(data.sensors.avgHumidityPct, '%')}
                  </dd>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <dt className="text-gray-500">PAR</dt>
                  <dd className="font-semibold text-gray-800" dir="ltr">
                    {num(data.sensors.avgPar)}
                  </dd>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <dt className="text-gray-500">{w.sensors}</dt>
                  <dd className="font-semibold text-gray-800" dir="ltr">
                    {data.sensors.sensorCount}
                  </dd>
                </div>
                {data.sensors.latestReadingUtc && (
                  <p className="col-span-2 sm:col-span-4 text-xs text-gray-400">
                    {w.updatedAt} {formatTime(data.sensors.latestReadingUtc)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">{w.noSensorData}</p>
            )}
          </section>

          {/* Rule-based recommendations */}
          <section>
            <h3 className="text-sm font-medium text-gray-500 mb-2">{w.recommendations}</h3>
            <ul className="flex flex-col gap-2">
              {data.recommendations.map((rec: WeatherRecommendation) => (
                <li
                  key={rec.activity}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="font-medium text-gray-700">
                    {activityLabel(rec.activity)}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {translateEnum(rec.reason, w.reasons)}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[rec.status]}`}
                    >
                      {statusLabel(rec.status)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Optional AI explanation */}
          <section className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-gray-500">{w.aiRecommendation}</h3>
              <button
                type="button"
                onClick={handleGenerateAi}
                disabled={aiLoading}
                className="rounded-full border border-[var(--color-primary)] bg-[var(--color-primary)] px-3 py-1 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {aiLoading ? w.aiLoading : w.generateAiRecommendation}
              </button>
            </div>

            {aiLoading && (
              <p className="mt-2 text-sm text-gray-500 animate-pulse">{w.aiLoading}</p>
            )}

            {!aiLoading && ai && ai.source === 'ai' && ai.explanation && (
              <p className="mt-2 rounded-lg bg-[var(--color-secondary-light)] p-3 text-sm text-gray-700">
                {ai.explanation}
              </p>
            )}

            {!aiLoading && ai && ai.source === 'fallback' && (
              <p className="mt-2 text-sm text-amber-700">{w.aiFallback}</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
