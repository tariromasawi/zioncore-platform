import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSpaceWeatherContext } from './space-weather-context';
const now = Date.parse('2026-11-10T10:00:00Z');
test('public NOAA context accepts documented table and object formats with explicit units', () => {
  const a = parseSpaceWeatherContext([['time_tag', 'Kp'], ['2026-11-10 09:00:00', '2.33']], now);
  assert.equal(a.kp, 2.33);
  assert.equal(a.stale, false);
  assert.deepEqual(parseSpaceWeatherContext([{ time_tag: '2026-11-10T09:00:00Z', Kp: 2.33 }], now), a);
});
test('out-of-range and future readings are excluded, historical data is labelled stale', () => {
  assert.throws(() => parseSpaceWeatherContext([{ time_tag: '2026-11-10', Kp: 90 }], now));
  assert.throws(() => parseSpaceWeatherContext([{ time_tag: '2026-12-10', Kp: 2 }], now));
  assert.equal(parseSpaceWeatherContext([{ time_tag: '2026-11-01T00:00:00', Kp: 1 }], now).stale, true);
});
