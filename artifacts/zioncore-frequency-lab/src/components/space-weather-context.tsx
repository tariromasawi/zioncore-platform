import { useEffect, useRef, useState } from 'react';
import { getSpaceWeatherContext, type SpaceWeatherContext as Context } from '@/lib/space-weather-context';

export default function SpaceWeatherContext() {
  const [data, setData] = useState<Context | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const load = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError('');
    try {
      const next = await getSpaceWeatherContext(controller.signal);
      if (!controller.signal.aborted) setData(next);
    } catch {
      if (!controller.signal.aborted) setError('Space-weather data could not be loaded. Your local readings remain available.');
    } finally {
      if (request.current === controller) setBusy(false);
    }
  };
  return <section className="zc-free-block" aria-label="Public astronomical context">
    <h3>Real space-weather context</h3>
    <p>Load NOAA’s public planetary K-index without an API key. Only a request for the public dataset is sent; your recording, reading and context are excluded.</p>
    <button type="button" className="btn btn-subtle" disabled={busy} onClick={() => void load()} data-testid="button-load-space-weather">{busy ? 'Loading NOAA data…' : 'Load public NOAA context'}</button>
    <p role="status">{busy ? 'Fetching planetary K-index.' : data ? `Planetary K-index: ${data.kp.toFixed(2)} · observed ${new Date(data.observedAt).toLocaleString()}${data.stale ? ' · historical/stale data, not current conditions' : ''}.` : ''}</p>
    {error && <p role="alert">{error}</p>}
    <p>This measures global geomagnetic activity, not sound, spiritual energy or a reply to your message. A time overlap alone establishes no connection to your recording.</p>
    <a href="https://www.swpc.noaa.gov/products/planetary-k-index" target="_blank" rel="noopener noreferrer">NOAA method and attribution (new tab)</a>
  </section>;
}
