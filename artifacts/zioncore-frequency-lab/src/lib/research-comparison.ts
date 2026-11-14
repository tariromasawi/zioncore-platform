import type { ResearchObservation, ResearchSession } from './celestial-experiment';

export const DEFAULT_OBSERVATION_ALIGNMENT_TOLERANCE_SECONDS = 2;
export const MAX_RESEARCH_COMPARISON_SESSIONS = 10;

export type ObservationAlignmentAnchor = 'transmission-completed' | 'first-observation';

export type AlignedObservationPair = {
  firstElapsedSeconds: number;
  secondElapsedSeconds: number;
  alignmentDeltaSeconds: number;
  peakOverlapPercent: number | null;
  matchedPeakCount: number;
  comparedPeakCount: number;
  peakToleranceHz: number;
  dominantFrequencyDeltaHz: number | null;
  rmsDifferenceFullScale: number;
};

export type ResearchSessionPairComparison = {
  firstSessionId: string;
  secondSessionId: string;
  firstAlignmentAnchor: ObservationAlignmentAnchor;
  secondAlignmentAnchor: ObservationAlignmentAnchor;
  firstWindowCount: number;
  secondWindowCount: number;
  unmatchedFirstWindowCount: number;
  unmatchedSecondWindowCount: number;
  alignedWindows: AlignedObservationPair[];
};

export type RepeatedObservationComparison = {
  sessionsWithObservations: number;
  sessionPairCount: number;
  timeToleranceSeconds: number;
  pairs: ResearchSessionPairComparison[];
  limitation: string;
};

type RelativeObservation = {
  observation: ResearchObservation;
  elapsedSeconds: number;
};

function observationsByRelativeTime(session: ResearchSession): {
  observations: RelativeObservation[];
  anchor: ObservationAlignmentAnchor;
} {
  const ordered = session.observations
    .map(observation => ({
      observation,
      startedAtMs: Date.parse(observation.window.startedAt),
    }))
    .filter(item => Number.isFinite(item.startedAtMs))
    .sort((left, right) => left.startedAtMs - right.startedAtMs);
  const transmissionCompletedAt = session.transmission?.completedAt
    ? Date.parse(session.transmission.completedAt)
    : Number.NaN;
  const hasTransmissionAnchor = Number.isFinite(transmissionCompletedAt);
  const origin = hasTransmissionAnchor ? transmissionCompletedAt : ordered[0]?.startedAtMs;
  if (origin == null) {
    return {
      observations: [],
      anchor: hasTransmissionAnchor ? 'transmission-completed' : 'first-observation',
    };
  }
  return {
    observations: ordered.map(item => ({
      observation: item.observation,
      elapsedSeconds: (item.startedAtMs - origin) / 1000,
    })),
    anchor: hasTransmissionAnchor ? 'transmission-completed' : 'first-observation',
  };
}

function peakOverlap(first: ResearchObservation, second: ResearchObservation) {
  const toleranceHz = Math.max(
    5,
    first.frequencyResolutionHz,
    second.frequencyResolutionHz,
  ) * 2;
  const firstPeaks = [...first.topPeaksHz].sort((left, right) => left - right);
  const remainingSecondPeaks = [...second.topPeaksHz].sort((left, right) => left - right);
  let matchedPeakCount = 0;

  for (const peak of firstPeaks) {
    let bestIndex = -1;
    let bestDelta = Infinity;
    remainingSecondPeaks.forEach((candidate, index) => {
      const delta = Math.abs(peak - candidate);
      if (delta <= toleranceHz && delta < bestDelta) {
        bestIndex = index;
        bestDelta = delta;
      }
    });
    if (bestIndex >= 0) {
      matchedPeakCount += 1;
      remainingSecondPeaks.splice(bestIndex, 1);
    }
  }

  const denominator = Math.max(firstPeaks.length, second.topPeaksHz.length);
  return {
    toleranceHz,
    matchedPeakCount,
    comparedPeakCount: denominator,
    overlapPercent: denominator === 0 ? null : (matchedPeakCount / denominator) * 100,
  };
}

function alignSessionPair(
  first: ResearchSession,
  second: ResearchSession,
  timeToleranceSeconds: number,
): ResearchSessionPairComparison {
  const firstAlignment = observationsByRelativeTime(first);
  const secondAlignment = observationsByRelativeTime(second);
  const firstWindows = firstAlignment.observations;
  const secondWindows = secondAlignment.observations;
  const usedSecondIndexes = new Set<number>();
  const alignedWindows: AlignedObservationPair[] = [];

  for (const firstWindow of firstWindows) {
    let bestIndex = -1;
    let bestDelta = Infinity;
    secondWindows.forEach((secondWindow, index) => {
      if (usedSecondIndexes.has(index)) return;
      const delta = Math.abs(firstWindow.elapsedSeconds - secondWindow.elapsedSeconds);
      if (delta <= timeToleranceSeconds && delta < bestDelta) {
        bestIndex = index;
        bestDelta = delta;
      }
    });
    if (bestIndex < 0) continue;

    usedSecondIndexes.add(bestIndex);
    const secondWindow = secondWindows[bestIndex];
    const firstObservation = firstWindow.observation;
    const secondObservation = secondWindow.observation;
    const peaks = peakOverlap(firstObservation, secondObservation);
    alignedWindows.push({
      firstElapsedSeconds: firstWindow.elapsedSeconds,
      secondElapsedSeconds: secondWindow.elapsedSeconds,
      alignmentDeltaSeconds: bestDelta,
      peakOverlapPercent: peaks.overlapPercent,
      matchedPeakCount: peaks.matchedPeakCount,
      comparedPeakCount: peaks.comparedPeakCount,
      peakToleranceHz: peaks.toleranceHz,
      dominantFrequencyDeltaHz: firstObservation.dominantFrequencyHz == null
        || secondObservation.dominantFrequencyHz == null
        ? null
        : Math.abs(firstObservation.dominantFrequencyHz - secondObservation.dominantFrequencyHz),
      rmsDifferenceFullScale: Math.abs(firstObservation.rmsLevel - secondObservation.rmsLevel),
    });
  }

  return {
    firstSessionId: first.id,
    secondSessionId: second.id,
    firstAlignmentAnchor: firstAlignment.anchor,
    secondAlignmentAnchor: secondAlignment.anchor,
    firstWindowCount: firstWindows.length,
    secondWindowCount: secondWindows.length,
    unmatchedFirstWindowCount: firstWindows.length - alignedWindows.length,
    unmatchedSecondWindowCount: secondWindows.length - usedSecondIndexes.size,
    alignedWindows,
  };
}

export function compareRepeatedObservations(
  sessions: ResearchSession[],
  timeToleranceSeconds = DEFAULT_OBSERVATION_ALIGNMENT_TOLERANCE_SECONDS,
): RepeatedObservationComparison {
  if (!Number.isFinite(timeToleranceSeconds) || timeToleranceSeconds <= 0 || timeToleranceSeconds > 60) {
    throw new Error('Observation alignment tolerance must be greater than zero and no more than 60 seconds.');
  }

  const selectedSessions = [...new Map(
    sessions
      .filter(session => session.observations.length > 0)
      .map(session => [session.id, session]),
  ).values()];
  if (selectedSessions.length > MAX_RESEARCH_COMPARISON_SESSIONS) {
    throw new Error(`Compare no more than ${MAX_RESEARCH_COMPARISON_SESSIONS} sessions at a time.`);
  }
  const pairs: ResearchSessionPairComparison[] = [];
  for (let firstIndex = 0; firstIndex < selectedSessions.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < selectedSessions.length; secondIndex += 1) {
      pairs.push(alignSessionPair(
        selectedSessions[firstIndex],
        selectedSessions[secondIndex],
        timeToleranceSeconds,
      ));
    }
  }

  return {
    sessionsWithObservations: selectedSessions.length,
    sessionPairCount: pairs.length,
    timeToleranceSeconds,
    pairs,
    limitation: 'Alignment uses elapsed time from transmission completion when available, otherwise from the first saved observation. Peak overlap compares saved peak summaries within max(10 Hz, two FFT bins). RMS is not calibrated across microphones. Raw waveforms are not retained, so no sample-level correlation is computed. Similarity does not identify a source or establish a reply.',
  };
}
