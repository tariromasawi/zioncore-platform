import {
  acousticTextAdapter,
  acousticVoiceAdapter,
  experimentalDtmfAdapter,
  protocolRegistry,
  type AcousticAudioInput,
  type DtmfMessageInput,
  type ProtocolDescriptor,
  type TextMessageInput,
  type VoiceMessageInput,
} from '@/lib/protocol-registry';
import { decodeCelestialAudio } from '@/lib/celestial-audio';
import { createCelestialWaveform } from '@/lib/celestial-experiment';

export const PROTOCOL_BENCHMARK_TRIALS = 3;
export const PROTOCOL_BENCHMARK_SNR_LEVELS_DB = [40, 25, 15] as const;

export type RecoverySummary = {
  trials: number;
  recovered: number;
  errors: number;
  falseAccepts: number;
  errorRate: number;
};

export type NoiseLevelSummary = RecoverySummary & {
  targetSnrDb: number;
  measuredSnrDb: number;
};

export type ProtocolBenchmarkResult = {
  protocolId: string;
  protocolName: string;
  maturity: ProtocolDescriptor['maturity'];
  payloadBytes: number;
  encodedDurationSeconds: number;
  payloadGoodputBitsPerSecond: number;
  nominalSymbolRateBitsPerSecond: number | null;
  sampleRateHz: number;
  clean: RecoverySummary;
  symbolRoundTrip?: RecoverySummary;
  noise: {
    status: 'measured';
    levels: NoiseLevelSummary[];
  } | {
    status: 'not-applicable';
    reason: string;
  };
  compute: {
    encodeMs: number;
    cleanDecodeMeanMs: number;
    allTrialDecodeMs: number;
  };
  deviceCompatibility: {
    status: 'not-measured';
    reason: string;
  };
  cloud: {
    requests: 0;
    estimatedCostUsd: 0;
    note: string;
  };
  interpretationLimits: string[];
};

export type ProtocolBenchmarkReport = {
  suiteVersion: '1.0.0';
  createdAt: string;
  trialCountPerCondition: number;
  noiseGenerator: string;
  results: ProtocolBenchmarkResult[];
  overallLimits: string[];
};

type TrialOutcome = {
  recovered: boolean;
  falseAccept: boolean;
  decodeMs: number;
};

const FIXED_MESSAGE_ID = '00112233445566778899aabbccddeeff';
const TEXT_FIXTURE = 'ZionCore local protocol benchmark';

function rms(samples: Float32Array) {
  if (samples.length === 0) return 0;
  let sumSquares = 0;
  for (const sample of samples) sumSquares += sample * sample;
  return Math.sqrt(sumSquares / samples.length);
}

function seededUniform(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000) * 2 - 1;
  };
}

function addUniformNoiseAtSnr(samples: Float32Array, targetSnrDb: number, seed: number) {
  const signalRms = rms(samples);
  if (!(signalRms > 0)) throw new Error('Benchmark fixture has no measurable signal energy.');
  const noiseRms = signalRms / 10 ** (targetSnrDb / 20);
  const uniform = seededUniform(seed);
  const unitRmsUniformScale = Math.sqrt(3);
  const noisy = new Float32Array(samples.length);
  let noiseSquares = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const noise = uniform() * unitRmsUniformScale * noiseRms;
    noisy[index] = samples[index] + noise;
    noiseSquares += noise * noise;
  }
  const measuredNoiseRms = Math.sqrt(noiseSquares / samples.length);
  return {
    samples: noisy,
    measuredSnrDb: 20 * Math.log10(signalRms / measuredNoiseRms),
  };
}

function summarizeOutcomes(outcomes: TrialOutcome[]): RecoverySummary {
  const recovered = outcomes.filter(outcome => outcome.recovered).length;
  const falseAccepts = outcomes.filter(outcome => outcome.falseAccept).length;
  return {
    trials: outcomes.length,
    recovered,
    errors: outcomes.length - recovered,
    falseAccepts,
    errorRate: outcomes.length === 0 ? 0 : (outcomes.length - recovered) / outcomes.length,
  };
}

function runTrial(
  samples: Float32Array,
  sampleRateHz: number,
  decode: (input: AcousticAudioInput) => unknown,
  isExpected: (value: unknown) => boolean,
): TrialOutcome {
  const startedAt = performance.now();
  try {
    const decoded = decode({ samples, sampleRateHz });
    const recovered = isExpected(decoded);
    return {
      recovered,
      falseAccept: !recovered,
      decodeMs: performance.now() - startedAt,
    };
  } catch {
    return {
      recovered: false,
      falseAccept: false,
      decodeMs: performance.now() - startedAt,
    };
  }
}

function runAudioConditions(
  samples: Float32Array,
  sampleRateHz: number,
  decode: (input: AcousticAudioInput) => unknown,
  isExpected: (value: unknown) => boolean,
) {
  const cleanOutcomes = Array.from({ length: PROTOCOL_BENCHMARK_TRIALS }, () => (
    runTrial(samples, sampleRateHz, decode, isExpected)
  ));
  const noiseOutcomes: TrialOutcome[] = [];
  const levels = PROTOCOL_BENCHMARK_SNR_LEVELS_DB.map((targetSnrDb, levelIndex) => {
    const outcomes: TrialOutcome[] = [];
    let measuredSnrTotal = 0;
    for (let trialIndex = 0; trialIndex < PROTOCOL_BENCHMARK_TRIALS; trialIndex += 1) {
      const noisy = addUniformNoiseAtSnr(
        samples,
        targetSnrDb,
        0x5A17 + levelIndex * 101 + trialIndex,
      );
      measuredSnrTotal += noisy.measuredSnrDb;
      outcomes.push(runTrial(noisy.samples, sampleRateHz, decode, isExpected));
    }
    noiseOutcomes.push(...outcomes);
    return {
      targetSnrDb,
      measuredSnrDb: measuredSnrTotal / PROTOCOL_BENCHMARK_TRIALS,
      ...summarizeOutcomes(outcomes),
    };
  });
  const allTrialDecodeMs = [...cleanOutcomes, ...noiseOutcomes]
    .reduce((sum, item) => sum + item.decodeMs, 0);
  return {
    clean: summarizeOutcomes(cleanOutcomes),
    levels,
    cleanDecodeMeanMs: cleanOutcomes.reduce((sum, item) => sum + item.decodeMs, 0)
      / cleanOutcomes.length,
    allTrialDecodeMs,
  };
}

function makeVoiceFixture(): Float32Array {
  const sampleRateHz = 8_000;
  const sampleCount = sampleRateHz / 4;
  return Float32Array.from({ length: sampleCount }, (_, index) => (
    0.18 * Math.sin((2 * Math.PI * 440 * index) / sampleRateHz)
  ));
}

function benchmarkTextProtocol(): ProtocolBenchmarkResult {
  const descriptor = protocolRegistry.get(acousticTextAdapter.protocolId, acousticTextAdapter.wireVersion);
  if (!descriptor) throw new Error('The acoustic text protocol descriptor is unavailable.');
  const input: TextMessageInput = {
    text: TEXT_FIXTURE,
    payloadType: 'text',
    messageId: FIXED_MESSAGE_ID,
  };
  const encodeStartedAt = performance.now();
  const encoded = acousticTextAdapter.encode(input);
  const encodeMs = performance.now() - encodeStartedAt;
  const trials = runAudioConditions(
    encoded.samples,
    encoded.sampleRateHz,
    audio => acousticTextAdapter.decode(audio),
    result => {
      const decoded = result as { text?: string; payloadType?: string; messageId?: string; integrity?: string };
      return decoded.text === TEXT_FIXTURE
        && decoded.payloadType === 'text'
        && decoded.messageId === FIXED_MESSAGE_ID
        && decoded.integrity === 'verified';
    },
  );
  return {
    protocolId: descriptor.protocolId,
    protocolName: descriptor.name,
    maturity: descriptor.maturity,
    payloadBytes: encoded.payloadBytes,
    encodedDurationSeconds: encoded.durationSeconds,
    payloadGoodputBitsPerSecond: encoded.payloadBytes * 8 / encoded.durationSeconds,
    nominalSymbolRateBitsPerSecond: descriptor.signal.nominalBitsPerSecond,
    sampleRateHz: encoded.sampleRateHz,
    clean: trials.clean,
    noise: { status: 'measured', levels: trials.levels },
    compute: {
      encodeMs,
      cleanDecodeMeanMs: trials.cleanDecodeMeanMs,
      allTrialDecodeMs: trials.allTrialDecodeMs,
    },
    deviceCompatibility: {
      status: 'not-measured',
      reason: 'No physical audio output/input loopback or device matrix was run.',
    },
    cloud: {
      requests: 0,
      estimatedCostUsd: 0,
      note: 'No provider request or usage charge; local compute time is measured but device energy is not priced.',
    },
    interpretationLimits: [
      'Noise is deterministic, unclipped uniform noise added to Float32 samples; it is not calibrated room, codec, or hardware noise.',
      'Recovery means exact text, matching message ID, and valid CRC; the sender is not authenticated.',
    ],
  };
}

function benchmarkVoiceProtocol(): ProtocolBenchmarkResult {
  const descriptor = protocolRegistry.get(acousticVoiceAdapter.protocolId, acousticVoiceAdapter.wireVersion);
  if (!descriptor) throw new Error('The Voice V2 protocol descriptor is unavailable.');
  const sourceSamples = makeVoiceFixture();
  const input: VoiceMessageInput = {
    samples: sourceSamples,
    sampleRateHz: 8_000,
    messageId: FIXED_MESSAGE_ID,
  };
  const encodeStartedAt = performance.now();
  const encoded = acousticVoiceAdapter.encode(input);
  const encodeMs = performance.now() - encodeStartedAt;
  const trials = runAudioConditions(
    encoded.samples,
    encoded.sampleRateHz,
    audio => acousticVoiceAdapter.decode(audio),
    result => {
      const decoded = result as {
        payloadType?: string;
        messageId?: string;
        integrity?: string;
        audioSampleRateHz?: number;
        audioSamples?: Float32Array;
      };
      return decoded.payloadType === 'voice'
        && decoded.messageId === FIXED_MESSAGE_ID
        && decoded.integrity === 'verified'
        && decoded.audioSampleRateHz === 8_000
        && decoded.audioSamples?.length === sourceSamples.length;
    },
  );
  return {
    protocolId: descriptor.protocolId,
    protocolName: descriptor.name,
    maturity: descriptor.maturity,
    payloadBytes: encoded.payloadBytes,
    encodedDurationSeconds: encoded.durationSeconds,
    payloadGoodputBitsPerSecond: encoded.payloadBytes * 8 / encoded.durationSeconds,
    nominalSymbolRateBitsPerSecond: descriptor.signal.nominalBitsPerSecond,
    sampleRateHz: encoded.sampleRateHz,
    clean: trials.clean,
    noise: { status: 'measured', levels: trials.levels },
    compute: {
      encodeMs,
      cleanDecodeMeanMs: trials.cleanDecodeMeanMs,
      allTrialDecodeMs: trials.allTrialDecodeMs,
    },
    deviceCompatibility: {
      status: 'not-measured',
      reason: 'No physical audio output/input loopback or device matrix was run.',
    },
    cloud: {
      requests: 0,
      estimatedCostUsd: 0,
      note: 'No provider request or usage charge; local compute time is measured but device energy is not priced.',
    },
    interpretationLimits: [
      'Recovery means a matching message ID, valid CRC, and decoded audio sample count/rate; voice intelligibility or perceptual quality is not scored.',
      'Noise is deterministic, unclipped uniform noise added to Float32 samples; it is not calibrated room, codec, or hardware noise.',
    ],
  };
}

function benchmarkDtmfProtocol(): ProtocolBenchmarkResult {
  const descriptor = protocolRegistry.get(experimentalDtmfAdapter.protocolId, experimentalDtmfAdapter.wireVersion);
  if (!descriptor) throw new Error('The experimental DTMF descriptor is unavailable.');
  const input: DtmfMessageInput = { text: TEXT_FIXTURE, symbolDurationMs: 75 };
  const encodeStartedAt = performance.now();
  const encoded = experimentalDtmfAdapter.encode(input);
  const waveform = createCelestialWaveform(encoded, 0.04);
  const encodeMs = performance.now() - encodeStartedAt;
  const symbolOutcomes: TrialOutcome[] = [];
  for (let trial = 0; trial < PROTOCOL_BENCHMARK_TRIALS; trial += 1) {
    const startedAt = performance.now();
    try {
      const decoded = experimentalDtmfAdapter.decode([...encoded.symbols]);
      const recovered = decoded === TEXT_FIXTURE;
      symbolOutcomes.push({
        recovered,
        falseAccept: !recovered,
        decodeMs: performance.now() - startedAt,
      });
    } catch {
      symbolOutcomes.push({
        recovered: false,
        falseAccept: false,
        decodeMs: performance.now() - startedAt,
      });
    }
  }
  const audioTrials = runAudioConditions(
    waveform,
    encoded.sampleRateHz,
    audio => decodeCelestialAudio(audio.samples, audio.sampleRateHz),
    result => {
      const decoded = result as { message?: string; checksum?: string; symbols?: number[] };
      return decoded.message === TEXT_FIXTURE
        && decoded.checksum === 'verified'
        && decoded.symbols?.length === encoded.symbols.length;
    },
  );
  const symbolRoundTrip = summarizeOutcomes(symbolOutcomes);
  return {
    protocolId: descriptor.protocolId,
    protocolName: descriptor.name,
    maturity: descriptor.maturity,
    payloadBytes: encoded.payloadByteLength,
    encodedDurationSeconds: encoded.durationSeconds,
    payloadGoodputBitsPerSecond: encoded.payloadByteLength * 8 / encoded.durationSeconds,
    nominalSymbolRateBitsPerSecond: descriptor.signal.nominalBitsPerSecond,
    sampleRateHz: encoded.sampleRateHz,
    clean: audioTrials.clean,
    symbolRoundTrip,
    noise: { status: 'measured', levels: audioTrials.levels },
    compute: {
      encodeMs,
      cleanDecodeMeanMs: audioTrials.cleanDecodeMeanMs,
      allTrialDecodeMs: audioTrials.allTrialDecodeMs
        + symbolOutcomes.reduce((sum, item) => sum + item.decodeMs, 0),
    },
    deviceCompatibility: {
      status: 'not-measured',
      reason: 'No DTMF audio decoder or physical audio loopback exists in this path.',
    },
    cloud: {
      requests: 0,
      estimatedCostUsd: 0,
      note: 'No provider request or usage charge; local compute time is measured but device energy is not priced.',
    },
    interpretationLimits: [
      'Noise trials are local deterministic uniform-noise checks on generated Float32 samples, not calibrated acoustic environments.',
      'The separate symbol-array round trip does not measure tone detection or acoustic noise tolerance.',
      'CRC verification detects some corruption; it does not authenticate the sender or prove device-to-device compatibility.',
    ],
  };
}

export function runProtocolBenchmarkSuite(now = new Date().toISOString()): ProtocolBenchmarkReport {
  return {
    suiteVersion: '1.0.0',
    createdAt: now,
    trialCountPerCondition: PROTOCOL_BENCHMARK_TRIALS,
    noiseGenerator: 'Seeded uniform noise normalized to target SNR; unclipped Float32 addition.',
    results: [
      benchmarkTextProtocol(),
      benchmarkVoiceProtocol(),
      benchmarkDtmfProtocol(),
    ],
    overallLimits: [
      'Synthetic results are deterministic software diagnostics, not statistically sufficient reliability estimates or field measurements.',
      'Device compatibility is unmeasured because no physical loopback or device test matrix is available.',
      'Compute time is local execution time for the current browser/device and is not a service-level guarantee.',
      'Local device energy and any separate hosting costs are not monetized by this benchmark.',
      'No audio, personal data, or test results are uploaded or saved by this suite.',
    ],
  };
}
