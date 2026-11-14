import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createResearchSession, type ResearchObservation } from './celestial-experiment';
import { compareRepeatedObservations } from './research-comparison';

function observation(
  id: string,
  startedAt: string,
  dominantFrequencyHz: number,
  topPeaksHz: number[],
  rmsLevel: number,
): ResearchObservation {
  return {
    id,
    source: {
      type: 'microphone-observation',
      label: 'Browser microphone',
      capturedAt: startedAt,
    },
    window: {
      startedAt,
      endedAt: new Date(Date.parse(startedAt) + 2000).toISOString(),
      durationSeconds: 2,
      source: 'browser-microphone',
    },
    sampleRateHz: 48000,
    fftSize: 4096,
    frequencyResolutionHz: 48000 / 4096,
    dominantFrequencyHz,
    topPeaksHz,
    rmsLevel,
    notes: '',
  };
}

test('repeated observations align by elapsed capture time and report bounded peak similarity', () => {
  const first = {
    ...createResearchSession({
      id: '11111111-1111-4111-8111-111111111111',
      now: '2026-11-09T10:00:00.000Z',
    }),
    observations: [
      observation('a-1', '2026-11-09T10:00:00.000Z', 440, [440, 880], 0.2),
      observation('a-2', '2026-11-09T10:00:05.000Z', 600, [600, 800], 0.3),
      observation('a-3', '2026-11-09T10:00:20.000Z', 1000, [1000], 0.4),
    ],
  };
  const second = {
    ...createResearchSession({
      id: '22222222-2222-4222-8222-222222222222',
      now: '2026-11-09T12:00:00.000Z',
    }),
    observations: [
      observation('b-1', '2026-11-09T12:00:00.500Z', 442, [442, 883], 0.25),
      observation('b-2', '2026-11-09T12:00:06.100Z', 603, [603, 805], 0.35),
      observation('b-3', '2026-11-09T12:00:50.000Z', 1300, [1300], 0.5),
    ],
  };

  const comparison = compareRepeatedObservations([first, second]);
  assert.equal(comparison.sessionsWithObservations, 2);
  assert.equal(comparison.sessionPairCount, 1);
  const [pair] = comparison.pairs;
  assert.equal(pair.alignedWindows.length, 2);
  assert.equal(pair.unmatchedFirstWindowCount, 1);
  assert.equal(pair.unmatchedSecondWindowCount, 1);
  assert.equal(pair.alignedWindows[0].alignmentDeltaSeconds, 0);
  assert.ok(Math.abs(pair.alignedWindows[1].alignmentDeltaSeconds - 0.6) < 0.000001);
  assert.equal(pair.alignedWindows[0].peakOverlapPercent, 100);
  assert.equal(pair.alignedWindows[0].matchedPeakCount, 2);
  assert.equal(pair.alignedWindows[0].comparedPeakCount, 2);
  assert.equal(pair.alignedWindows[0].dominantFrequencyDeltaHz, 2);
  assert.ok(Math.abs(pair.alignedWindows[0].rmsDifferenceFullScale - 0.05) < 0.000001);
  assert.match(comparison.limitation, /no sample-level correlation is computed/);
  assert.match(comparison.limitation, /does not identify a source or establish a reply/);
  assert.equal(compareRepeatedObservations([first, second], 0.5).pairs[0].alignedWindows.length, 1);
});

test('comparison needs two distinct sessions with observations and validates its alignment tolerance', () => {
  const session = {
    ...createResearchSession({
      id: '33333333-3333-4333-8333-333333333333',
      now: '2026-11-09T10:00:00.000Z',
    }),
    observations: [
      observation('c-1', '2026-11-09T10:00:00.000Z', 440, [440], 0.2),
    ],
  };
  const comparison = compareRepeatedObservations([session, session]);
  assert.equal(comparison.sessionsWithObservations, 1);
  assert.equal(comparison.sessionPairCount, 0);
  assert.equal(comparison.pairs.length, 0);
  assert.throws(() => compareRepeatedObservations([session], 0), /greater than zero/);
  assert.throws(() => compareRepeatedObservations([session], 61), /no more than 60 seconds/);
  assert.throws(
    () => compareRepeatedObservations(Array.from({ length: 11 }, (_, index) => ({
      ...session,
      id: `session-${index}`,
    }))),
    /Compare no more than 10 sessions/,
  );
});

test('recorded transmission completion is the alignment anchor when available', () => {
  const first = {
    ...createResearchSession({
      id: '44444444-4444-4444-8444-444444444444',
      now: '2026-11-09T10:00:00.000Z',
    }),
    transmission: {
      authorizedAt: '2026-11-09T10:00:04.000Z',
      completedAt: '2026-11-09T10:00:05.000Z',
      outputChannel: 'local-speaker' as const,
      stoppedEarly: false,
    },
    observations: [
      observation('pre-1', '2026-11-09T10:00:00.000Z', 440, [440], 0.2),
      observation('post-1', '2026-11-09T10:00:05.000Z', 442, [442], 0.2),
      observation('post-2', '2026-11-09T10:00:10.000Z', 445, [445], 0.2),
    ],
  };
  const second = {
    ...createResearchSession({
      id: '55555555-5555-4555-8555-555555555555',
      now: '2026-11-09T12:00:00.000Z',
    }),
    transmission: {
      authorizedAt: '2026-11-09T12:00:04.000Z',
      completedAt: '2026-11-09T12:00:05.000Z',
      outputChannel: 'local-speaker' as const,
      stoppedEarly: false,
    },
    observations: [
      observation('post-3', '2026-11-09T12:00:05.000Z', 443, [443], 0.2),
      observation('post-4', '2026-11-09T12:00:10.000Z', 446, [446], 0.2),
    ],
  };

  const [pair] = compareRepeatedObservations([first, second]).pairs;
  assert.equal(pair.firstAlignmentAnchor, 'transmission-completed');
  assert.equal(pair.secondAlignmentAnchor, 'transmission-completed');
  assert.equal(pair.alignedWindows[0].firstElapsedSeconds, 0);
  assert.equal(pair.unmatchedFirstWindowCount, 1, 'the pre-transmission window remains unmatched');
});
