import { useState, useEffect } from 'react';
import { apiFetch } from '@/context/AppContext';

export interface WeatherData {
  tempC:         number;
  conditionCode: number;
  conditionText: string;
  emoji:         string;
}

const CODE_EMOJI: Record<number, string> = {
  113: '☀️',  116: '⛅',  119: '☁️',  122: '🌫️',
  143: '🌫️', 176: '🌦️', 179: '🌨️', 182: '🌧️',
  185: '🌧️', 200: '⛈️', 227: '🌨️', 230: '❄️',
  248: '🌫️', 260: '🌫️', 263: '🌦️', 266: '🌦️',
  281: '🌧️', 284: '🌧️', 293: '🌧️', 296: '🌧️',
  299: '🌧️', 302: '🌧️', 305: '🌧️', 308: '🌧️',
  311: '🌧️', 314: '🌧️', 317: '🌨️', 320: '🌨️',
  323: '🌨️', 326: '❄️',  329: '❄️',  332: '❄️',
  335: '❄️',  338: '❄️',  350: '🌨️', 353: '🌦️',
  356: '🌧️', 359: '🌧️', 362: '🌨️', 365: '🌨️',
  368: '🌨️', 371: '❄️',  374: '🌨️', 377: '🌨️',
  386: '⛈️', 389: '⛈️', 392: '⛈️', 395: '⛈️',
};

let _cache: Record<string, { data: WeatherData; fetchedAt: number }> = {};
const CACHE_TTL = 15 * 60 * 1000;

export function useWeather(query: string | null): { data: WeatherData | null; loading: boolean } {
  const [data,    setData]    = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) return;
    const key     = query.toLowerCase().trim();
    const cached  = _cache[key];
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      setData(cached.data);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiFetch<{ tempC: number; conditionCode: number; conditionText: string } | { error: string }>(
      `/weather?q=${encodeURIComponent(query)}`
    )
      .then((json) => {
        if (cancelled || !json || 'error' in json) return;
        const d: WeatherData = {
          tempC:         json.tempC,
          conditionCode: json.conditionCode,
          conditionText: json.conditionText,
          emoji:         CODE_EMOJI[json.conditionCode] ?? '🌤️',
        };
        _cache[key] = { data: d, fetchedAt: Date.now() };
        setData(d);
      })
      .catch(() => null)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query]);

  return { data, loading };
}
