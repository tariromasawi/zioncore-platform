export const SPACE_WEATHER_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
export type SpaceWeatherContext = {
  kp: number; observedAt: string; stale: boolean; source: string;
};
export function parseSpaceWeatherContext(value: unknown, now = Date.now()): SpaceWeatherContext {
  if (!Array.isArray(value) || value.length === 0 || value.length > 3000) throw new Error('NOAA returned an unsupported dataset.');
  const rows: { time: string; kp: unknown }[] = [];
  if (Array.isArray(value[0])) {
    const headers = value[0] as unknown[];
    const timeIndex = headers.indexOf('time_tag');
    const kpIndex = headers.indexOf('Kp');
    if (timeIndex < 0 || kpIndex < 0) throw new Error('NOAA dataset columns were not recognised.');
    for (const row of value.slice(1)) {
      if (Array.isArray(row) && typeof row[timeIndex] === 'string') rows.push({ time: row[timeIndex], kp: row[kpIndex] });
    }
  } else {
    for (const item of value) {
      if (item && typeof item === 'object' && typeof item.time_tag === 'string') rows.push({ time: item.time_tag, kp: item.Kp });
    }
  }
  const valid = rows.map(row => ({
    time: Date.parse(/(?:Z|[+-]\d\d:\d\d)$/i.test(row.time) ? row.time : `${row.time}Z`),
    kp: typeof row.kp === 'number' || typeof row.kp === 'string' && row.kp.trim() !== '' ? Number(row.kp) : NaN,
  })).filter(row => Number.isFinite(row.time) && row.time <= now + 5 * 60_000 && Number.isFinite(row.kp) && row.kp >= 0 && row.kp <= 9);
  valid.sort((a, b) => b.time - a.time);
  if (!valid[0]) throw new Error('No valid planetary K-index observation was returned.');
  return { kp: valid[0].kp, observedAt: new Date(valid[0].time).toISOString(), stale: now - valid[0].time > 24 * 60 * 60_000, source: SPACE_WEATHER_URL };
}
export async function getSpaceWeatherContext(signal: AbortSignal): Promise<SpaceWeatherContext> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) controller.abort();
  const timeout = setTimeout(abort, 15_000);
  try {
    const response = await fetch(SPACE_WEATHER_URL, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!response.ok) throw new Error('NOAA space-weather context is temporarily unavailable.');
    const text = await response.text();
    if (text.length > 256_000) throw new Error('The NOAA dataset exceeded this tool’s size limit.');
    return parseSpaceWeatherContext(JSON.parse(text));
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}
