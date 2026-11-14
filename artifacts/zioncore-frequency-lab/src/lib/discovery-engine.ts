import { validateObservation } from '@/lib/observation-validation';
import type { Observation } from '@/lib/observations';

export const discoveryLenses = [
  'human',
  'animal',
  'environment',
  'spiritual',
  'celestial',
  'unknown',
] as const;

export type DiscoveryLens = (typeof discoveryLenses)[number];

export type DiscoveryComparison = {
  protocolVersion: 1;
  first: Pick<Observation, 'id' | 'createdAt' | 'sampleRate' | 'fftSize' | 'frequencyResolutionHz' | 'dominantFrequencyHz' | 'topPeaksHz' | 'rmsLevel' | 'durationSeconds' | 'mode'>;
  second: Pick<Observation, 'id' | 'createdAt' | 'sampleRate' | 'fftSize' | 'frequencyResolutionHz' | 'dominantFrequencyHz' | 'topPeaksHz' | 'rmsLevel' | 'durationSeconds' | 'mode'>;
  lens: DiscoveryLens;
  setupComparable: boolean;
  setupDifferences: string[];
  peakMatchToleranceHz: number;
  matchedPeaksHz: Array<{ firstHz: number; secondHz: number; differenceHz: number }>;
  dominantShiftHz: number | null;
  finding: 'repeatable-pattern' | 'changed-or-ambiguous' | 'insufficient-data';
  summary: string;
  nextExperiments: string[];
};

export type DiscoveryComparisonResult =
  | { success: true; data: DiscoveryComparison }
  | { success: false; error: string };

const lensExperiments: Record<DiscoveryLens, string> = {
  human: 'For a human-sound comparison, obtain the speaker’s consent and compare a short sample with a quiet-room baseline. Do not infer identity or intent from frequency peaks.',
  animal: 'For an animal or wildlife question, observe naturally occurring sound without playback or lures; record time, habitat, distance, and weather for later expert comparison.',
  environment: 'For an environmental question, keep the recorder and position fixed, note weather or nearby activity, and change only one condition between captures.',
  spiritual: 'Keep the measured comparison separate from your personal reflection. If you choose a faith context, record it as context rather than as a sensor measurement.',
  celestial: 'For a celestial-signal hypothesis, repeat with a known reference and a quiet control, document the receiver chain, and compare against plausible local interference before interpreting.',
  unknown: 'For an unfamiliar pattern, repeat the capture with silence and a known-tone control, then change one recording condition at a time.',
};

function measurementSnapshot(observation: Observation): DiscoveryComparison['first'] {
  return {
    id: observation.id,
    createdAt: observation.createdAt,
    sampleRate: observation.sampleRate,
    fftSize: observation.fftSize,
    frequencyResolutionHz: observation.frequencyResolutionHz,
    dominantFrequencyHz: observation.dominantFrequencyHz,
    topPeaksHz: [...observation.topPeaksHz],
    rmsLevel: observation.rmsLevel,
    durationSeconds: observation.durationSeconds,
    mode: observation.mode,
  };
}

function matchPeaks(first: number[], second: number[], toleranceHz: number) {
  const usedSecond = new Set<number>();
  const matches: DiscoveryComparison['matchedPeaksHz'] = [];
  for (const firstHz of first) {
    let nearestIndex = -1;
    let nearestDifference = Number.POSITIVE_INFINITY;
    second.forEach((secondHz, index) => {
      const difference = Math.abs(secondHz - firstHz);
      if (!usedSecond.has(index) && difference <= toleranceHz && difference < nearestDifference) {
        nearestIndex = index;
        nearestDifference = difference;
      }
    });
    if (nearestIndex >= 0) {
      usedSecond.add(nearestIndex);
      matches.push({
        firstHz,
        secondHz: second[nearestIndex],
        differenceHz: second[nearestIndex] - firstHz,
      });
    }
  }
  return matches;
}

export function compareObservations(
  firstInput: unknown,
  secondInput: unknown,
  lens: DiscoveryLens,
): DiscoveryComparisonResult {
  const firstResult = validateObservation(firstInput);
  const secondResult = validateObservation(secondInput);
  if (!firstResult.success || !secondResult.success) {
    return { success: false, error: 'Choose two valid saved measurements to compare.' };
  }
  const first = firstResult.data;
  const second = secondResult.data;
  if (first.id === second.id) {
    return { success: false, error: 'Choose two different observations.' };
  }

  const setupDifferences: string[] = [];
  if (first.sampleRate !== second.sampleRate) setupDifferences.push('sample rate');
  if (first.fftSize !== second.fftSize) setupDifferences.push('FFT size');
  if (first.mode !== second.mode) setupDifferences.push('capture type');
  const setupComparable = setupDifferences.length === 0;
  const peakMatchToleranceHz = Math.max(
    first.frequencyResolutionHz,
    second.frequencyResolutionHz,
  );
  const matchedPeaksHz = matchPeaks(first.topPeaksHz, second.topPeaksHz, peakMatchToleranceHz);
  const dominantShiftHz = first.dominantFrequencyHz == null || second.dominantFrequencyHz == null
    ? null
    : second.dominantFrequencyHz - first.dominantFrequencyHz;
  const minimumPeakCount = Math.min(first.topPeaksHz.length, second.topPeaksHz.length);
  const enoughPeakData = minimumPeakCount > 0 && matchedPeaksHz.length / minimumPeakCount >= 0.5;
  const dominantStable = dominantShiftHz != null && Math.abs(dominantShiftHz) <= peakMatchToleranceHz;
  const finding = dominantShiftHz == null || minimumPeakCount === 0
    ? 'insufficient-data'
    : setupComparable && dominantStable && enoughPeakData
      ? 'repeatable-pattern'
      : 'changed-or-ambiguous';

  const summary = finding === 'repeatable-pattern'
    ? 'The selected captures show a similar measured peak pattern at the recorded settings. This is a repeatability observation, not a source identification.'
    : finding === 'insufficient-data'
      ? 'The selected captures do not contain enough peak information for a useful pattern comparison.'
      : setupComparable
        ? 'The measured pattern changed or is ambiguous between these captures. The comparison cannot identify the cause.'
        : `The captures used different ${setupDifferences.join(', ')}; treat the pattern difference as inconclusive until the setup is matched.`;

  const nextExperiments = [
    setupComparable
      ? 'Repeat at least three captures with the same device, position, duration, sample rate, and FFT size; keep null results as part of the record.'
      : `Repeat with the same ${setupDifferences.join(', ')} before attributing a change to the environment or source.`,
    lensExperiments[lens],
  ];

  return {
    success: true,
    data: {
      protocolVersion: 1,
      first: measurementSnapshot(first),
      second: measurementSnapshot(second),
      lens,
      setupComparable,
      setupDifferences,
      peakMatchToleranceHz,
      matchedPeaksHz,
      dominantShiftHz,
      finding,
      summary,
      nextExperiments,
    },
  };
}
