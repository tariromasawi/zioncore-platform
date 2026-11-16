export const BIOACOUSTIC_CLUSTER_METHOD_ID = 'standardized-acoustic-feature-kmeans';
export const BIOACOUSTIC_CLUSTER_METHOD_VERSION = '1.0.0';
export const BIOACOUSTIC_COMPARISON_METHOD_ID = 'greedy-feature-distance-match';
export const BIOACOUSTIC_COMPARISON_METHOD_VERSION = '1.0.0';
export const MAX_BIOACOUSTIC_EVENTS = 100;
export const MAX_BIOACOUSTIC_CLUSTERS = 8;
export const MAX_BIOACOUSTIC_INPUT_BYTES = 24 * 1024 * 1024;

export function validateBioacousticInputBudget(firstBytes: number, secondBytes = 0) {
  if (!Number.isInteger(firstBytes) || firstBytes <= 0
    || !Number.isInteger(secondBytes) || secondBytes < 0) {
    throw new Error('Choose a non-empty primary WAV and valid optional comparison file.');
  }
  if (firstBytes + secondBytes > MAX_BIOACOUSTIC_INPUT_BYTES) {
    throw new Error('The combined local analysis limit is 24 MiB. Choose smaller WAV files or compare one recording at a time.');
  }
}

export type AcousticEventFeature = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  meanRms: number;
  peakRms: number;
  dominantFrequencyHz: number | null;
  spectralCentroidHz: number | null;
};

export type AcousticEventCluster = {
  id: number;
  eventIds: string[];
  meanDurationSeconds: number;
  meanDominantFrequencyHz: number | null;
  meanSpectralCentroidHz: number | null;
  meanRms: number;
};

export type ClusteredAcousticEvents = {
  requestedClusterCount: number;
  effectiveClusterCount: number;
  methodId: string;
  methodVersion: string;
  events: Array<AcousticEventFeature & { clusterId: number }>;
  clusters: AcousticEventCluster[];
};

export type AcousticRecordingComparison = {
  firstEventCount: number;
  secondEventCount: number;
  matchedEventCount: number;
  similarityPercent: number;
  maximumNormalizedDistance: number;
  averageDurationDeltaSeconds: number | null;
  averageDominantFrequencyDeltaHz: number | null;
  methodId: string;
  methodVersion: string;
  limitation: string;
};

type FeatureVector = [number, number, number, number];

function featureVector(event: AcousticEventFeature): FeatureVector {
  return [
    Math.log1p(event.durationSeconds * 1000),
    Math.log1p(event.dominantFrequencyHz ?? 0),
    Math.log1p(event.spectralCentroidHz ?? 0),
    Math.log1p(event.meanRms * 10000),
  ];
}

function normalizeFeatures(events: readonly AcousticEventFeature[]) {
  const raw = events.map(featureVector);
  const means = [0, 0, 0, 0];
  const scales = [0, 0, 0, 0];
  if (raw.length === 0) return raw;

  for (const vector of raw) {
    vector.forEach((value, index) => { means[index] += value / raw.length; });
  }
  for (const vector of raw) {
    vector.forEach((value, index) => {
      const difference = value - means[index];
      scales[index] += difference * difference / raw.length;
    });
  }
  for (let index = 0; index < scales.length; index++) {
    scales[index] = Math.sqrt(scales[index]) || 1;
  }
  return raw.map(vector => vector.map(
    (value, index) => (value - means[index]) / scales[index],
  ) as FeatureVector);
}

function squaredDistance(left: FeatureVector, right: FeatureVector) {
  return left.reduce((sum, value, index) => sum + (value - right[index]) ** 2, 0);
}

function normalizedPairDistance(left: AcousticEventFeature, right: AcousticEventFeature) {
  const components = [
    Math.abs(left.durationSeconds - right.durationSeconds)
      / Math.max(0.04, Math.max(left.durationSeconds, right.durationSeconds) * 0.25),
    Math.abs(Math.log((left.meanRms + 1e-6) / (right.meanRms + 1e-6))) / Math.log(2),
  ];
  const frequencyPairs: Array<[number | null, number | null, number]> = [
    [left.dominantFrequencyHz, right.dominantFrequencyHz, 0.2],
    [left.spectralCentroidHz, right.spectralCentroidHz, 0.25],
  ];
  frequencyPairs.forEach(([firstValue, secondValue, relativeTolerance]) => {
    if (firstValue == null && secondValue == null) return;
    if (firstValue == null || secondValue == null) {
      components.push(1);
      return;
    }
    const absoluteTolerance = relativeTolerance === 0.2 ? 40 : 80;
    components.push(
      Math.abs(firstValue - secondValue)
        / Math.max(absoluteTolerance, Math.max(firstValue, secondValue) * relativeTolerance),
    );
  });
  return Math.sqrt(components.reduce((sum, value) => sum + value * value, 0));
}

function meanOf(events: readonly AcousticEventFeature[], pick: (event: AcousticEventFeature) => number | null) {
  const values = events.map(pick).filter((value): value is number => value != null && Number.isFinite(value));
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function clusterAcousticEvents(
  events: readonly AcousticEventFeature[],
  requestedClusterCount: number,
): ClusteredAcousticEvents {
  if (!Number.isInteger(requestedClusterCount)
    || requestedClusterCount < 2
    || requestedClusterCount > MAX_BIOACOUSTIC_CLUSTERS) {
    throw new Error(`Choose between 2 and ${MAX_BIOACOUSTIC_CLUSTERS} acoustic-feature groups.`);
  }
  if (events.length > MAX_BIOACOUSTIC_EVENTS) {
    throw new Error(`Cluster no more than ${MAX_BIOACOUSTIC_EVENTS} candidate events at once.`);
  }
  const vectors = normalizeFeatures(events);
  if (events.length === 0) {
    return {
      requestedClusterCount,
      effectiveClusterCount: 0,
      methodId: BIOACOUSTIC_CLUSTER_METHOD_ID,
      methodVersion: BIOACOUSTIC_CLUSTER_METHOD_VERSION,
      events: [],
      clusters: [],
    };
  }

  const clusterCount = Math.min(requestedClusterCount, events.length);
  const centers: FeatureVector[] = [vectors[0]];
  while (centers.length < clusterCount) {
    let candidateIndex = 0;
    let candidateDistance = -1;
    vectors.forEach((vector, index) => {
      const nearest = Math.min(...centers.map(center => squaredDistance(vector, center)));
      if (nearest > candidateDistance) {
        candidateIndex = index;
        candidateDistance = nearest;
      }
    });
    centers.push(vectors[candidateIndex]);
  }

  let assignments = new Array(events.length).fill(-1) as number[];
  for (let iteration = 0; iteration < 32; iteration++) {
    const nextAssignments = vectors.map(vector => {
      let nearestIndex = 0;
      let nearestDistance = Infinity;
      centers.forEach((center, index) => {
        const distance = squaredDistance(vector, center);
        if (distance < nearestDistance) {
          nearestIndex = index;
          nearestDistance = distance;
        }
      });
      return nearestIndex;
    });
    if (nextAssignments.every((clusterId, index) => clusterId === assignments[index])) break;
    assignments = nextAssignments;

    centers.forEach((_, clusterId) => {
      const members = vectors.filter((_, index) => assignments[index] === clusterId);
      if (members.length === 0) return;
      centers[clusterId] = [0, 0, 0, 0].map((_, featureIndex) =>
        members.reduce((sum, vector) => sum + vector[featureIndex], 0) / members.length,
      ) as FeatureVector;
    });
  }

  const activeIds = [...new Set(assignments)].sort((left, right) => left - right);
  const relabel = new Map(activeIds.map((clusterId, index) => [clusterId, index + 1]));
  const clusteredEvents = events.map((event, index) => ({
    ...event,
    clusterId: relabel.get(assignments[index]) ?? 1,
  }));
  const clusters = activeIds.map((clusterId, index) => {
    const members = events.filter((_, eventIndex) => assignments[eventIndex] === clusterId);
    return {
      id: index + 1,
      eventIds: members.map(event => event.id),
      meanDurationSeconds: meanOf(members, event => event.durationSeconds) ?? 0,
      meanDominantFrequencyHz: meanOf(members, event => event.dominantFrequencyHz),
      meanSpectralCentroidHz: meanOf(members, event => event.spectralCentroidHz),
      meanRms: meanOf(members, event => event.meanRms) ?? 0,
    };
  });
  return {
    requestedClusterCount,
    effectiveClusterCount: clusters.length,
    methodId: BIOACOUSTIC_CLUSTER_METHOD_ID,
    methodVersion: BIOACOUSTIC_CLUSTER_METHOD_VERSION,
    events: clusteredEvents,
    clusters,
  };
}

export function compareAcousticEventSets(
  first: readonly AcousticEventFeature[],
  second: readonly AcousticEventFeature[],
  maximumNormalizedDistance = 1.5,
): AcousticRecordingComparison {
  if (first.length > MAX_BIOACOUSTIC_EVENTS || second.length > MAX_BIOACOUSTIC_EVENTS) {
    throw new Error(`Compare no more than ${MAX_BIOACOUSTIC_EVENTS} candidate events per recording.`);
  }
  if (!Number.isFinite(maximumNormalizedDistance) || maximumNormalizedDistance <= 0 || maximumNormalizedDistance > 4) {
    throw new Error('The feature-distance threshold must be greater than 0 and no more than 4.');
  }
  const pairs: Array<{ firstIndex: number; secondIndex: number; distance: number }> = [];
  first.forEach((_, firstIndex) => {
    second.forEach((right, secondIndex) => {
      const distance = normalizedPairDistance(first[firstIndex], right);
      if (distance <= maximumNormalizedDistance) pairs.push({ firstIndex, secondIndex, distance });
    });
  });
  pairs.sort((left, right) => left.distance - right.distance
    || left.firstIndex - right.firstIndex
    || left.secondIndex - right.secondIndex);

  const usedFirst = new Set<number>();
  const usedSecond = new Set<number>();
  const matches: typeof pairs = [];
  for (const pair of pairs) {
    if (usedFirst.has(pair.firstIndex) || usedSecond.has(pair.secondIndex)) continue;
    usedFirst.add(pair.firstIndex);
    usedSecond.add(pair.secondIndex);
    matches.push(pair);
  }
  const denominator = Math.max(first.length, second.length);
  const average = (values: number[]) => values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
  return {
    firstEventCount: first.length,
    secondEventCount: second.length,
    matchedEventCount: matches.length,
    similarityPercent: denominator ? matches.length / denominator * 100 : 0,
    maximumNormalizedDistance,
    averageDurationDeltaSeconds: average(matches.map(pair =>
      Math.abs(first[pair.firstIndex].durationSeconds - second[pair.secondIndex].durationSeconds),
    )),
    averageDominantFrequencyDeltaHz: average(matches
      .map(pair => {
        const left = first[pair.firstIndex].dominantFrequencyHz;
        const right = second[pair.secondIndex].dominantFrequencyHz;
        return left == null || right == null ? null : Math.abs(left - right);
      })
      .filter((value): value is number => value != null)),
    methodId: BIOACOUSTIC_COMPARISON_METHOD_ID,
    methodVersion: BIOACOUSTIC_COMPARISON_METHOD_VERSION,
    limitation: 'Distance uses duration tolerance max(40 ms, 25%), peak-frequency tolerance max(40 Hz, 20%), centroid tolerance max(80 Hz, 25%), and a twofold RMS ratio scale. This feature comparison does not identify species, behavior, meaning, or a response; recording context and sample-level correlation are not evaluated.',
  };
}
