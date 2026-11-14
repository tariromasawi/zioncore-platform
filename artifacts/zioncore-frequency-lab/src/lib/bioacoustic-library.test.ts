import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BIOACOUSTIC_LIBRARY,
  filterBioacousticLibrary,
  validateBioacousticLibrary,
} from '@/lib/bioacoustic-library';

test('reviewed bioacoustic source entries include licensing, species, location, uncertainty, and source references', () => {
  assert.equal(validateBioacousticLibrary(BIOACOUSTIC_LIBRARY), true);
  assert.equal(new Set(BIOACOUSTIC_LIBRARY.map(entry => entry.id)).size, BIOACOUSTIC_LIBRARY.length);
  assert.ok(BIOACOUSTIC_LIBRARY.every(entry => entry.mediaIncluded === false));
});

test('Xeno-canto licenses are item-specific and location metadata receives a privacy warning', () => {
  const xenoCanto = BIOACOUSTIC_LIBRARY.find(entry => entry.id === 'xeno-canto-recordings');
  assert.ok(xenoCanto);
  assert.equal(xenoCanto.licenseCategory, 'recording-specific');
  assert.match(xenoCanto.licenseSummary, /per recording/i);
  assert.match(xenoCanto.locationHandling, /coordinates/i);
  assert.match(xenoCanto.identificationUncertainty, /not.*ground truth/i);
});

test('source filtering searches species context and narrows by license category', () => {
  assert.deepEqual(
    filterBioacousticLibrary(BIOACOUSTIC_LIBRARY, 'birds', 'safety-policy').map(entry => entry.id),
    ['ebird-sensitive-species-guidance'],
  );
  assert.deepEqual(
    filterBioacousticLibrary(BIOACOUSTIC_LIBRARY, '', 'permission-required').map(entry => entry.id),
    ['macaulay-library-media'],
  );
});

test('invalid or unlinked records cannot enter the reviewed source directory', () => {
  assert.equal(validateBioacousticLibrary([
    ...BIOACOUSTIC_LIBRARY,
    { ...BIOACOUSTIC_LIBRARY[0], id: BIOACOUSTIC_LIBRARY[0].id },
  ]), false);
  assert.equal(validateBioacousticLibrary([
    { ...BIOACOUSTIC_LIBRARY[0], references: [{ label: 'unsafe', url: 'http://example.com' }] },
  ]), false);
});
