import {
  deriveResonanceProfile,
  RESONANCE_PROFILE_MIN_WINDOW_SECONDS,
  RESONANCE_PROFILE_VERSION,
} from '@workspace/frequency-ai-contract';
import type { SignalFeatures, TemporalSample } from './signal-analysis';
import {
  MIN_SPECTRAL_MATRIX_FRAMES,
  type SpectralMatrixAnalysis,
} from './spectral-matrix';

export const MIN_INTERPRETATION_WINDOW_SECONDS = RESONANCE_PROFILE_MIN_WINDOW_SECONDS;

export type ResonanceEngineStageState =
  | 'waiting'
  | 'active'
  | 'ready'
  | 'complete'
  | 'attention'
  | 'error';

export type ResonanceEnginePhase =
  | 'standby'
  | 'connecting'
  | 'listening'
  | 'low_signal'
  | 'developing'
  | 'ready'
  | 'interpreting'
  | 'complete'
  | 'error';

export type ResonanceEngineReading = {
  sampleRate: number;
  fftSize: number;
  frequencyResolutionHz: number;
  dominantFrequencyHz: number | null;
  peakFrequenciesHz: number[];
  rmsLevel: number;
  source: 'microphone' | 'audio-file';
  features: SignalFeatures;
  temporalSamples: TemporalSample[];
};

export type ResonanceEngineInput = {
  starting: boolean;
  running: boolean;
  silent: boolean;
  elapsedSeconds: number;
  reading: ResonanceEngineReading | null;
  matrix: SpectralMatrixAnalysis | null;
  interpretationLoading: boolean;
  hasInterpretation: boolean;
  captureError?: string;
  interpretationError?: string;
};

export type ResonanceEngineStage = {
  key: 'intake' | 'spectrum' | 'matrix' | 'interpretation';
  label: string;
  state: ResonanceEngineStageState;
  detail: string;
};

export type ResonanceEngineSnapshot = {
  engineVersion: string;
  phase: ResonanceEnginePhase;
  phaseLabel: string;
  statusMessage: string;
  sourceLabel: string;
  elapsedSeconds: number;
  sampleRateHz: number | null;
  fftSize: number | null;
  frequencyResolutionHz: number | null;
  dominantFrequencyHz: number | null;
  textureLabel: string;
  textureDetail: string;
  temporalLabel: string;
  temporalDetail: string;
  matrixLabel: string;
  matrixDetail: string;
  matrixFrameCount: number;
  matrixVarianceShare: number | null;
  stages: ResonanceEngineStage[];
  trend: Array<{
    timeSeconds: number;
    dominantFrequencyHz: number | null;
    rmsLevel: number;
  }>;
};

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clampSeconds(value: number): number {
  const safe = finite(value) ?? 0;
  return Math.max(0, safe);
}

function formatFrequency(value: number | null): string {
  if (value == null) return 'not resolved';
  if (value >= 1000) return `${(value / 1000).toFixed(2)} kHz`;
  return `${value.toFixed(value < 100 ? 2 : 1)} Hz`;
}

function buildStages(input: ResonanceEngineInput, elapsedSeconds: number): ResonanceEngineStage[] {
  const reading = input.reading;
  const captureFailed = Boolean(input.captureError);
  const interpretationFailed = Boolean(input.interpretationError);
  const usableWindow = Boolean(reading && !input.silent && elapsedSeconds >= MIN_INTERPRETATION_WINDOW_SECONDS);

  return [
    {
      key: 'intake',
      label: 'Signal intake',
      state: captureFailed
        ? 'error'
        : input.starting
          ? 'active'
          : input.running
            ? 'active'
            : reading
              ? 'complete'
              : 'waiting',
      detail: captureFailed
        ? 'Capture needs attention.'
        : input.starting
          ? 'Waiting for microphone permission or source setup.'
          : input.running
            ? `${reading?.source === 'audio-file' ? 'Imported audio' : 'Microphone'} is measuring locally.`
            : reading
              ? `${reading.source === 'audio-file' ? 'Imported audio' : 'Microphone'} window captured.`
              : 'Start a microphone capture or load a supported recording.',
    },
    {
      key: 'spectrum',
      label: 'Spectral extraction',
      state: !reading ? 'waiting' : input.silent ? 'attention' : 'complete',
      detail: !reading
        ? 'Frequency bins and peaks will appear here.'
        : input.silent
          ? 'Current frame is at or near the silence threshold.'
          : `${reading.peakFrequenciesHz.length} peaks; ${formatFrequency(reading.dominantFrequencyHz)} dominant.`,
    },
    {
      key: 'matrix',
      label: 'Temporal matrix',
      state: !input.matrix
        ? 'waiting'
        : input.matrix.status === 'insufficient_frames'
          ? 'active'
          : input.matrix.status === 'silent'
            ? 'attention'
            : 'complete',
      detail: !input.matrix
        ? 'Matrix analysis is waiting for the first capture.'
        : input.matrix.status === 'insufficient_frames'
          ? `${input.matrix.frameCount} of ${MIN_SPECTRAL_MATRIX_FRAMES} minimum frames collected.`
          : input.matrix.status === 'silent'
            ? 'No measurable band activity in this window.'
            : input.matrix.status === 'static'
              ? 'Stable cross-band profile measured.'
              : `${input.matrix.frameCount} frames compared across five frequency bands.`,
    },
    {
      key: 'interpretation',
      label: 'ZionCore interpretation',
      state: interpretationFailed
        ? 'error'
        : input.interpretationLoading
          ? 'active'
          : input.hasInterpretation
            ? 'complete'
            : usableWindow
              ? 'ready'
              : 'waiting',
      detail: interpretationFailed
        ? 'The report did not finish; check the message below the interpretation panel.'
        : input.interpretationLoading
          ? 'The requested reading is being composed.'
          : input.hasInterpretation
            ? 'A completed reading is visible below.'
            : usableWindow
              ? 'A full reading can be requested; the current credit quote is shown below.'
              : `A non-silent ${MIN_INTERPRETATION_WINDOW_SECONDS}-second window is needed first.`,
    },
  ];
}

export function createResonanceEngineSnapshot(
  input: ResonanceEngineInput,
): ResonanceEngineSnapshot {
  const elapsedSeconds = clampSeconds(input.elapsedSeconds);
  const reading = input.reading;
  const profile = reading
    ? deriveResonanceProfile({
        durationSeconds: elapsedSeconds,
        frequencyResolutionHz: finite(reading.frequencyResolutionHz) ?? 0.5,
        dominantFrequencyHz: input.silent ? null : finite(reading.dominantFrequencyHz),
        signalFeatures: reading.features,
        spectralMatrixAnalysis: input.matrix,
      })
    : null;
  const texture = profile?.texture ?? {
    label: 'Awaiting a signal',
    detail: 'No live measurement window is available yet.',
  };
  const temporal = profile?.temporal ?? {
    label: 'No trend yet',
    detail: 'Start a capture to build a temporal profile.',
  };
  const matrix = profile?.matrix ?? {
    label: 'Matrix waiting',
    detail: 'Cross-band relationships appear after spectral frames arrive.',
    frameCount: 0,
    varianceShare: null,
  };

  let phase: ResonanceEnginePhase = 'standby';
  if (input.captureError || input.interpretationError) {
    phase = 'error';
  } else if (input.interpretationLoading) {
    phase = 'interpreting';
  } else if (input.hasInterpretation) {
    phase = 'complete';
  } else if (input.starting) {
    phase = 'connecting';
  } else if (input.running && input.silent) {
    phase = 'low_signal';
  } else if (input.running) {
    phase = 'listening';
  } else if (reading && input.silent) {
    phase = 'low_signal';
  } else if (reading && elapsedSeconds < MIN_INTERPRETATION_WINDOW_SECONDS) {
    phase = 'developing';
  } else if (reading) {
    phase = 'ready';
  }

  const phaseLabels: Record<ResonanceEnginePhase, string> = {
    standby: 'Standby',
    connecting: 'Connecting',
    listening: 'Listening',
    low_signal: 'Low signal',
    developing: 'Building profile',
    ready: 'Ready to interpret',
    interpreting: 'Interpreting',
    complete: 'Reading complete',
    error: 'Needs attention',
  };

  const statusMessages: Record<ResonanceEnginePhase, string> = {
    standby: 'Begin a capture to build a live resonance profile.',
    connecting: 'Source permission is being prepared.',
    listening: 'Frequency features are being measured locally.',
    low_signal: 'Input is near silence; adjust the source or microphone distance.',
    developing: `Collecting a ${MIN_INTERPRETATION_WINDOW_SECONDS}-second observation window.`,
    ready: 'Signal profile is available. Review the price in the interpretation panel before requesting a reading.',
    interpreting: 'ZionCore is composing the requested interpretation.',
    complete: 'The interpretation and its measured signal profile are ready to review.',
    error: input.captureError || input.interpretationError || 'A processing step needs attention.',
  };

  return {
    engineVersion: profile?.version ?? RESONANCE_PROFILE_VERSION,
    phase,
    phaseLabel: phaseLabels[phase],
    statusMessage: statusMessages[phase],
    sourceLabel: reading?.source === 'audio-file'
      ? 'Imported audio'
      : reading?.source === 'microphone'
        ? 'Microphone'
        : 'No source',
    elapsedSeconds,
    sampleRateHz: finite(reading?.sampleRate),
    fftSize: reading?.fftSize ?? null,
    frequencyResolutionHz: finite(reading?.frequencyResolutionHz),
    dominantFrequencyHz: finite(reading?.dominantFrequencyHz),
    textureLabel: texture.label,
    textureDetail: texture.detail,
    temporalLabel: temporal.label,
    temporalDetail: temporal.detail,
    matrixLabel: matrix.label,
    matrixDetail: matrix.detail,
    matrixFrameCount: matrix.frameCount,
    matrixVarianceShare: matrix.varianceShare,
    stages: buildStages(input, elapsedSeconds),
    trend: reading?.temporalSamples.slice(-36).map(sample => ({
      timeSeconds: finite(sample.timeSeconds) ?? 0,
      dominantFrequencyHz: finite(sample.dominantFrequencyHz),
      rmsLevel: Math.max(0, finite(sample.rmsLevel) ?? 0),
    })) ?? [],
  };
}
