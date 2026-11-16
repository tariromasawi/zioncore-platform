import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  astronomicalDatasetToCsv,
  fetchNoaaPlanetaryKp,
  MAX_ASTRONOMY_OBSERVATIONS,
  MAX_ASTRONOMY_RESPONSE_BYTES,
  normalizeNoaaPlanetaryKp,
} from '@/lib/astronomical-data';

const sampleRows = [
  { time_tag: '2026-11-12T03:01:00', kp_index: 2, estimated_kp: 2.33, kp: '2P' },
  { time_tag: '2026-11-12T03:00:00', kp_index: 2, estimated_kp: 2.00, kp: '2Z' },
];

test('NOAA adapter preserves UTC timestamps, Kp units, calibration status, and source attribution', () => {
  const dataset = normalizeNoaaPlanetaryKp(sampleRows, '2026-11-12T04:00:00Z');
  assert.equal(dataset.observations.length, 2);
  assert.equal(dataset.observations[0].timestampUtc, '2026-11-12T03:00:00.000Z');
  assert.equal(dataset.observations[1].value, 2.33);
  assert.equal(dataset.observations[1].unit, 'dimensionless Kp index');
  assert.equal(dataset.measurement.instrumentCalibration.status, 'not-provided');
  assert.match(dataset.source.attribution, /NOAA Space Weather Prediction Center/);
  assert.equal(dataset.source.retrievedAtUtc, '2026-11-12T04:00:00.000Z');
});

test('NOAA adapter rejects invalid ranges, dates, duplicates, and oversized datasets', () => {
  assert.throws(
    () => normalizeNoaaPlanetaryKp([{ ...sampleRows[0], estimated_kp: 9.1 }]),
    /Too big|expected number|less than or equal to 9/i,
  );
  assert.throws(
    () => normalizeNoaaPlanetaryKp([{ ...sampleRows[0], time_tag: '2026-02-30T03:01:00' }]),
    /Invalid NOAA UTC timestamp/,
  );
  assert.throws(
    () => normalizeNoaaPlanetaryKp([sampleRows[0], sampleRows[0]]),
    /Duplicate NOAA observation timestamp/,
  );
  assert.throws(
    () => normalizeNoaaPlanetaryKp(Array.from({ length: MAX_ASTRONOMY_OBSERVATIONS + 1 }, () => sampleRows[0])),
    /at most 2000/,
  );
});

test('manual fetch reports HTTP, malformed JSON, and response-size errors', async () => {
  const request = async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response('unavailable', { status: 503 });
  await assert.rejects(fetchNoaaPlanetaryKp({ fetcher: request }), /HTTP 503/);

  const malformed = async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response('{bad json', { status: 200 });
  await assert.rejects(fetchNoaaPlanetaryKp({ fetcher: malformed }), /invalid JSON/);

  const oversized = async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(' '.repeat(MAX_ASTRONOMY_RESPONSE_BYTES + 1), { status: 200 });
  await assert.rejects(fetchNoaaPlanetaryKp({ fetcher: oversized }), /safety limit/);
});

test('normalized CSV export includes timestamps, measurements, and source values', () => {
  const dataset = normalizeNoaaPlanetaryKp(sampleRows, '2026-11-12T04:00:00Z');
  const csv = astronomicalDatasetToCsv(dataset);
  assert.match(csv, /timestamp_utc,parameter,value,unit/);
  assert.match(csv, /provider,dataset,source_url,product_url,terms_url,retrieved_at_utc/);
  assert.match(csv, /2026-11-12T03:00:00\.000Z,estimated-planetary-kp,2,dimensionless Kp index,2,2Z/);
  assert.match(csv, /NOAA Space Weather Prediction Center/);
  assert.match(csv, /not-provided/);
});
