import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LOCATION_GRID_DEGREES,
  locationSharingConsentSchema,
  prepareResearchLocation,
} from '@/lib/location-privacy';

const NOW = Date.parse('2026-11-12T12:00:00.000Z');
const consent = (scope: 'private-session' | 'shared-research' = 'shared-research') => ({
  explicitlyGranted: true,
  scope,
  purpose: 'Share an approximate research region',
  grantedAt: new Date(NOW - 1000).toISOString(),
  expiresAt: new Date(NOW + 30 * 60_000).toISOString(),
});
const coordinates = {
  latitude: -17.8252,
  longitude: 31.0335,
  source: 'user-entered',
};

test('location is omitted by default and without explicit consent', () => {
  assert.deepEqual(
    prepareResearchLocation(coordinates, undefined, 'ordinary', NOW),
    { status: 'omitted', reason: 'no-explicit-consent' },
  );
  assert.deepEqual(
    prepareResearchLocation(coordinates, { ...consent(), explicitlyGranted: false }, 'ordinary', NOW),
    { status: 'omitted', reason: 'no-explicit-consent' },
  );
});

test('explicit ordinary sharing emits only a coarse, short-lived grid cell', () => {
  const result = prepareResearchLocation(coordinates, consent(), 'ordinary', NOW);
  assert.deepEqual(result, {
    status: 'coarsened',
    scope: 'shared-research',
    source: 'user-entered',
    sensitivity: 'ordinary',
    latitudeCellCenter: -17.5,
    longitudeCellCenter: 31.5,
    resolutionDegrees: LOCATION_GRID_DEGREES.ordinary,
    expiresAt: new Date(NOW + 30 * 60_000).toISOString(),
  });
  assert.equal('latitude' in result, false);
  assert.equal('longitude' in result, false);
});

test('sensitive ecology locations are omitted from shared research despite consent', () => {
  assert.deepEqual(
    prepareResearchLocation(coordinates, consent(), 'sensitive-ecology', NOW),
    { status: 'omitted', reason: 'sensitive-ecology-shared-location' },
  );
});

test('private sensitive-ecology locations are generalized to a broader grid', () => {
  const result = prepareResearchLocation(coordinates, consent('private-session'), 'sensitive-ecology', NOW);
  assert.equal(result.status, 'coarsened');
  if (result.status !== 'coarsened') return;
  assert.equal(result.resolutionDegrees, LOCATION_GRID_DEGREES.sensitiveEcology);
  assert.equal(result.latitudeCellCenter, -17);
  assert.equal(result.longitudeCellCenter, 31);
  assert.notEqual(result.latitudeCellCenter, coordinates.latitude);
  assert.notEqual(result.longitudeCellCenter, coordinates.longitude);
});

test('future or expired consent cannot release a location', () => {
  assert.deepEqual(
    prepareResearchLocation(coordinates, consent(), 'ordinary', NOW + 31 * 60_000),
    { status: 'omitted', reason: 'consent-expired' },
  );
  const notYetGranted = {
    ...consent(),
    grantedAt: new Date(NOW + 1000).toISOString(),
    expiresAt: new Date(NOW + 2000).toISOString(),
  };
  assert.deepEqual(
    prepareResearchLocation(coordinates, notYetGranted, 'ordinary', NOW),
    { status: 'omitted', reason: 'consent-expired' },
  );
});

test('precise, unbounded, and overlong consent records are not accepted', () => {
  const preciseConsent = {
    ...consent(),
    precision: 'precise',
  };
  assert.equal(locationSharingConsentSchema.safeParse(preciseConsent).success, false);
  const overlong = {
    ...consent(),
    expiresAt: new Date(NOW + 2 * 60 * 60_000).toISOString(),
  };
  assert.equal(locationSharingConsentSchema.safeParse(overlong).success, false);
  assert.deepEqual(
    prepareResearchLocation(coordinates, overlong, 'ordinary', NOW),
    { status: 'omitted', reason: 'no-explicit-consent' },
  );
});

test('invalid and over-specified coordinate input is rejected after consent', () => {
  assert.throws(
    () => prepareResearchLocation({ ...coordinates, latitude: 91 }, consent(), 'ordinary', NOW),
  );
  assert.throws(
    () => prepareResearchLocation({ ...coordinates, deviceId: 'hardware-123' }, consent(), 'ordinary', NOW),
  );
});
