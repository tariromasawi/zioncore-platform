export const CONSTELLATION_PHASES = [
  { id: 'quick', name: 'Quick constellation', durationMs: 15_000, intervalMs: 2_000 },
  { id: 'stillness', name: 'Calm hold', durationMs: 180_000, intervalMs: null },
  { id: 'flow', name: 'Flowing constellation', durationMs: 25_000, intervalMs: 3_000 },
  { id: 'drift', name: 'Slow drift', durationMs: 15_000, intervalMs: 6_000 },
  { id: 'settle', name: 'Closing constellation', durationMs: 10_000, intervalMs: 5_000 },
] as const;

export const CONSTELLATION_CYCLE_MS = CONSTELLATION_PHASES.reduce(
  (sum, phase) => sum + phase.durationMs, 0,
);
const stepsPerCycle = CONSTELLATION_PHASES.reduce(
  (sum, phase) => sum + (phase.intervalMs === null ? 0 : Math.ceil(phase.durationMs / phase.intervalMs)),
  0,
);

/**
 * Pure clock: callers supply active elapsed time, excluding pauses and hidden
 * tabs. Phase boundaries are explicit, even where a duration is not divisible
 * by its cadence. The calm hold does not secretly reshuffle at either boundary.
 */
export function getConstellationFrame(elapsedMs: number) {
  const elapsed = Number.isFinite(elapsedMs)
    ? Math.max(0, Math.min(elapsedMs, Number.MAX_SAFE_INTEGER)) : 0;
  const cycle = Math.floor(elapsed / CONSTELLATION_CYCLE_MS);
  let offset = elapsed % CONSTELLATION_CYCLE_MS;
  let earlierSteps = 0;
  for (let phaseIndex = 0; phaseIndex < CONSTELLATION_PHASES.length; phaseIndex++) {
    const phase = CONSTELLATION_PHASES[phaseIndex];
    if (offset < phase.durationMs) {
      const step = cycle * stepsPerCycle + earlierSteps + (
        phase.intervalMs === null ? -1 : Math.floor(offset / phase.intervalMs)
      );
      const remaining = phase.durationMs - offset;
      return {
        phaseIndex, phase, cycle, step,
        nextInMs: phase.intervalMs === null ? remaining
          : Math.min(remaining, phase.intervalMs - offset % phase.intervalMs),
      };
    }
    offset -= phase.durationMs;
    earlierSteps += phase.intervalMs === null ? 0 : Math.ceil(phase.durationMs / phase.intervalMs);
  }
  throw new Error('Constellation phase could not be resolved.');
}

/** Shuffle all unique artworks, then repair fixed slots so each image moves. */
export function shuffleArtwork<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  if (result.length < 2) return result;
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  const fixed = result.flatMap((item, index) => item === items[index] ? [index] : []);
  if (fixed.length === 1) {
    const first = fixed[0];
    const other = (first + 1) % result.length;
    [result[first], result[other]] = [result[other], result[first]];
  } else if (fixed.length > 1) {
    const last = result[fixed[fixed.length - 1]];
    for (let index = fixed.length - 1; index > 0; index--) {
      result[fixed[index]] = result[fixed[index - 1]];
    }
    result[fixed[0]] = last;
  }
  return result;
}
