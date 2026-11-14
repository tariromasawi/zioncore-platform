import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONSTELLATION_CYCLE_MS, CONSTELLATION_PHASES, getConstellationFrame, shuffleArtwork,
} from './resonance-choreography';

test('the five-pass constellation loop has exact cadence and rest durations', () => {
  assert.equal(CONSTELLATION_CYCLE_MS, 245_000);
  assert.deepEqual(CONSTELLATION_PHASES.map(phase => [phase.durationMs, phase.intervalMs]), [
    [15_000, 2_000], [180_000, null], [25_000, 3_000], [15_000, 6_000], [10_000, 5_000],
  ]);
});

test('the quick opening advances every two seconds without drifting past its boundary', () => {
  assert.equal(getConstellationFrame(0).step, 0);
  assert.equal(getConstellationFrame(1_999).step, 0);
  assert.equal(getConstellationFrame(1_999).nextInMs, 1);
  assert.equal(getConstellationFrame(2_000).step, 1);
  assert.equal(getConstellationFrame(14_000).step, 7);
  assert.equal(getConstellationFrame(14_000).nextInMs, 1_000);
});

test('the three-minute calm hold preserves the last arrangement and has no hidden ticks', () => {
  const before = getConstellationFrame(14_999);
  const start = getConstellationFrame(15_000);
  const end = getConstellationFrame(194_999);
  assert.equal(start.phase.id, 'stillness');
  assert.equal(start.step, before.step);
  assert.equal(end.step, before.step);
  assert.equal(start.nextInMs, 180_000);
  assert.equal(end.nextInMs, 1);
});

test('all later passages and the next cycle resolve at their exact boundary', () => {
  for (const [time, phase, step, nextIn] of [
    [195_000, 'flow', 8, 3_000],
    [219_999, 'flow', 16, 1],
    [220_000, 'drift', 17, 6_000],
    [234_999, 'drift', 19, 1],
    [235_000, 'settle', 20, 5_000],
    [244_999, 'settle', 21, 1],
    [245_000, 'quick', 22, 2_000],
  ] as const) {
    const frame = getConstellationFrame(time);
    assert.equal(frame.phase.id, phase);
    assert.equal(frame.step, step);
    assert.equal(frame.nextInMs, nextIn);
  }
  assert.equal(getConstellationFrame(245_000).cycle, 1);
});

test('malformed elapsed values resolve safely and every scheduled delay is positive', () => {
  for (const input of [NaN, Infinity, -1, -Infinity]) {
    assert.deepEqual(getConstellationFrame(input), getConstellationFrame(0));
  }
  for (let time = 0; time < CONSTELLATION_CYCLE_MS * 3; time += 137) {
    assert.ok(getConstellationFrame(time).nextInMs > 0);
  }
});

test('every shuffle preserves all nineteen originals, moves each slot and never mutates input', () => {
  const ids = Array.from({ length: 19 }, (_, index) => `artwork-${index}`);
  const original = [...ids];
  for (const fixedRandom of [0, 0.01, 0.25, 0.5, 0.75, 0.99999]) {
    const shuffled = shuffleArtwork(ids, () => fixedRandom);
    assert.deepEqual([...shuffled].sort(), [...ids].sort());
    assert.equal(new Set(shuffled).size, 19);
    assert.ok(shuffled.every((item, index) => item !== ids[index]));
  }
  assert.deepEqual(ids, original);
  assert.deepEqual(shuffleArtwork([]), []);
  assert.deepEqual(shuffleArtwork(['only']), ['only']);
  assert.deepEqual(shuffleArtwork(['a', 'b'], () => 0.999), ['b', 'a']);
});
