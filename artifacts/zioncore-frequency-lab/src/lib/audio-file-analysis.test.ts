import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  analyzeAudioFile,
  analyzeAudioChannels,
  MAX_AUDIO_DURATION_SECONDS,
  MAX_AUDIO_FILE_BYTES,
  MIN_AUDIO_DURATION_SECONDS,
  readWavAnalysisMetadata,
  readWavSampleRate,
} from './audio-file-analysis';
import { runAudioAnalysisTask } from './audio-analysis-task';

function sineWave(frequencyHz: number, sampleRate: number, durationSeconds: number) {
  return Float32Array.from(
    { length: Math.round(sampleRate * durationSeconds) },
    (_, index) => 0.45 * Math.sin((2 * Math.PI * frequencyHz * index) / sampleRate),
  );
}

function noisySineWave(frequencyHz: number, sampleRate: number, durationSeconds: number) {
  let state = 0x6d2b79f5;
  return Float32Array.from(
    { length: Math.round(sampleRate * durationSeconds) },
    (_, index) => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const noise = ((state / 0x1_0000_0000) * 2 - 1) * 0.025;
      return 0.4 * Math.sin((2 * Math.PI * frequencyHz * index) / sampleRate) + noise;
    },
  );
}

function wavHeader(sampleRate: number, channels = 1, frames = 0): ArrayBuffer {
  const blockAlign = channels * 2;
  const sampleBytes = frames * blockAlign;
  const data = new ArrayBuffer(44 + sampleBytes);
  const view = new DataView(data);
  const writeTag = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };
  writeTag(0, 'RIFF');
  view.setUint32(4, 36 + sampleBytes, true);
  writeTag(8, 'WAVE');
  writeTag(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeTag(36, 'data');
  view.setUint32(40, sampleBytes, true);
  return data;
}

function wavTone(frequencyHz: number, sampleRate: number, durationSeconds: number): ArrayBuffer {
  const frameCount = Math.round(sampleRate * durationSeconds);
  const data = wavHeader(sampleRate, 1, frameCount);
  const view = new DataView(data);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const sample = 0.45 * Math.sin((2 * Math.PI * frequencyHz * frame) / sampleRate);
    view.setInt16(44 + frame * 2, Math.round(sample * 32_767), true);
  }
  return data;
}

test('extracts a stable dominant tone and finite multidomain features from audio samples', () => {
  const sampleRate = 48000;
  const result = analyzeAudioChannels([sineWave(440, sampleRate, 5)], sampleRate, 4096);

  assert.ok(result.dominant != null);
  assert.ok(Math.abs(result.dominant - 440) <= result.resolution);
  assert.ok(result.peaks.length > 0);
  assert.ok(result.analyzedFrames > 5);
  assert.equal(result.bins.length, 2048);
  assert.equal(result.spectrogram.length, result.analyzedFrames);
  assert.equal(result.spectrogram[0]?.length, 128);
  assert.ok(result.temporalSamples.length > 1);
  assert.ok(result.temporalSamples.length <= 150);
  assert.ok(result.features.harmonicity >= 0 && result.features.harmonicity <= 1);
  assert.ok(result.features.spectralEntropy >= 0 && result.features.spectralEntropy <= 1);
  assert.ok(Number.isFinite(result.rms));
});

test('mixes stereo channels into one local analysis without changing the sample rate', () => {
  const sampleRate = 44100;
  const left = sineWave(330, sampleRate, 4);
  const right = sineWave(660, sampleRate, 4);
  const result = analyzeAudioChannels([left, right], sampleRate, 2048);

  assert.equal(result.sampleRate, sampleRate);
  assert.equal(result.fftSize, 2048);
  assert.ok(result.dominant != null);
  assert.ok(result.peaks.length > 0);
});

test('long-file temporal samples preserve the beginning and end of the complete recording', () => {
  const sampleRate = 8000;
  const switchIndex = sampleRate * 15;
  const samples = Float32Array.from(
    { length: sampleRate * 30 },
    (_, index) => 0.3 * Math.sin(
      (2 * Math.PI * (index < switchIndex ? 440 : 1000) * index) / sampleRate,
    ),
  );

  const result = analyzeAudioChannels([samples], sampleRate, 2048);
  const first = result.temporalSamples[0];
  const last = result.temporalSamples[result.temporalSamples.length - 1];

  assert.equal(result.temporalSamples.length, 150);
  assert.ok(first && first.timeSeconds < 0.1, 'the timeline should retain its beginning');
  assert.ok(last && last.timeSeconds > 29, 'the timeline should retain its end');
  assert.ok(first?.dominantFrequencyHz != null);
  assert.ok(last?.dominantFrequencyHz != null);
  assert.ok(Math.abs(first.dominantFrequencyHz - 440) < 8);
  assert.ok(Math.abs(last.dominantFrequencyHz - 1000) < 8);
});

test('local analysis accepts a ten-minute single-channel recording within its memory budget', () => {
  const sampleRate = 8_000;
  const samples = new Float32Array(sampleRate * MAX_AUDIO_DURATION_SECONDS);
  const result = analyzeAudioChannels([samples], sampleRate, 2048);
  assert.equal(result.durationSeconds, MAX_AUDIO_DURATION_SECONDS);
  assert.ok(result.analyzedFrames <= 256);
  assert.ok(result.temporalSamples.at(-1)!.timeSeconds >= MAX_AUDIO_DURATION_SECONDS - 1);
});

test('reports silence without inventing a dominant frequency', () => {
  const sampleRate = 48000;
  const result = analyzeAudioChannels(
    [new Float32Array(sampleRate * MIN_AUDIO_DURATION_SECONDS)],
    sampleRate,
    2048,
  );

  assert.equal(result.dominant, null);
  assert.deepEqual(result.peaks, []);
  assert.equal(result.rms, 0);
});

test('low-level input stays unclassified and clipped input remains numerically bounded', () => {
  const sampleRate = 48_000;
  const quiet = Float32Array.from(
    { length: sampleRate * 4 },
    (_, index) => 0.0002 * Math.sin((2 * Math.PI * 440 * index) / sampleRate),
  );
  const quietResult = analyzeAudioChannels([quiet], sampleRate, 2048);
  assert.equal(quietResult.dominant, null);
  assert.deepEqual(quietResult.peaks, []);
  assert.ok(quietResult.rms > 0 && quietResult.rms < 0.0008);

  const clipped = Float32Array.from(
    { length: sampleRate * 4 },
    (_, index) => Math.max(-1, Math.min(1, 1.8 * Math.sin((2 * Math.PI * 440 * index) / sampleRate))),
  );
  const clippedResult = analyzeAudioChannels([clipped], sampleRate, 2048);
  assert.ok(clippedResult.dominant != null);
  assert.ok(Math.abs(clippedResult.dominant - 440) <= clippedResult.resolution);
  assert.ok(Number.isFinite(clippedResult.rms) && clippedResult.rms <= 1);
  assert.ok(clippedResult.bins.every(Number.isFinite));
});

test('rejects too-short, too-long, unsupported-rate, and unsupported-FFT inputs', () => {
  const sampleRate = 48000;
  assert.throws(
    () => analyzeAudioChannels([sineWave(440, sampleRate, MIN_AUDIO_DURATION_SECONDS - 0.1)], sampleRate, 2048),
    /at least 3 seconds/,
  );
  assert.throws(
    () => analyzeAudioChannels([new Float32Array(sampleRate * (MAX_AUDIO_DURATION_SECONDS + 1))], sampleRate, 2048),
    /600 seconds or shorter/,
  );
  assert.throws(
    () => analyzeAudioChannels([sineWave(440, sampleRate, 4)], 4000, 2048),
    /unsupported sample rate/,
  );
  assert.throws(
    () => analyzeAudioChannels([sineWave(440, sampleRate, 4)], sampleRate, 1024),
    /supported FFT size/,
  );
});

test('cancelling during decode returns promptly and closes the decoder context', async () => {
  const originalAudioContext = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  let closeCalled = false;
  let resolveDecode: ((buffer: AudioBuffer) => void) | undefined;
  let markDecodeStarted: (() => void) | undefined;
  const decodeStarted = new Promise<void>(resolve => { markDecodeStarted = resolve; });

  class PendingAudioContext {
    state = 'running';
    sampleRate = 48_000;
    decodeAudioData() {
      markDecodeStarted?.();
      return new Promise<AudioBuffer>(resolve => { resolveDecode = resolve; });
    }
    async close() {
      closeCalled = true;
      this.state = 'closed';
    }
  }
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    value: PendingAudioContext,
  });

  try {
    const data = wavTone(440, 48_000, 4);
    const file = {
      name: 'cancel.wav',
      size: data.byteLength,
      arrayBuffer: async () => data.slice(0),
    } as unknown as File;
    const controller = new AbortController();
    const pending = analyzeAudioFile(file, 2048, controller.signal);
    await decodeStarted;
    controller.abort();
    await assert.rejects(pending, /cancelled/i);
    assert.equal(closeCalled, true);
    resolveDecode?.({} as AudioBuffer);
  } finally {
    if (originalAudioContext) Object.defineProperty(globalThis, 'AudioContext', originalAudioContext);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
  }
});

test('unsupported browser codecs produce a clear local-decode error naming the format', async () => {
  const originalAudioContext = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  class RejectingAudioContext {
    state = 'running';
    sampleRate = 48_000;
    async decodeAudioData() {
      throw new Error('Unsupported audio codec');
    }
    async close() { this.state = 'closed'; }
  }
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    value: RejectingAudioContext,
  });
  try {
    const file = {
      name: 'recording.ogg',
      size: 2_048,
      arrayBuffer: async () => new ArrayBuffer(128),
    } as unknown as File;
    await assert.rejects(
      analyzeAudioFile(file, 2048),
      /could not decode this OGG recording locally.*WAV, MP3/i,
    );
  } finally {
    if (originalAudioContext) Object.defineProperty(globalThis, 'AudioContext', originalAudioContext);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
  }
});

test('rejects empty, mismatched, and excessive channel inputs', () => {
  const sampleRate = 48000;
  const valid = sineWave(440, sampleRate, 4);
  assert.throws(() => analyzeAudioChannels([], sampleRate, 2048), /number of audio channels/);
  assert.throws(
    () => analyzeAudioChannels([valid, new Float32Array(valid.length - 1)], sampleRate, 2048),
    /invalid or empty channel/,
  );
  assert.throws(
    () => analyzeAudioChannels(Array.from({ length: 9 }, () => valid), sampleRate, 2048),
    /number of audio channels/,
  );
});

test('accepts the 24 MB import boundary and rejects larger files before decoding', async () => {
  const originalAudioContext = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  let decodeCalls = 0;
  class MockAudioContext {
    state = 'running';
    async decodeAudioData() {
      decodeCalls += 1;
      throw new Error('Stop after verifying the file-size boundary.');
    }
    async close() {
      this.state = 'closed';
    }
  }

  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    value: MockAudioContext,
  });
  try {
    const fileAtLimit = {
      name: 'boundary.wav',
      size: MAX_AUDIO_FILE_BYTES,
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as File;
    await assert.rejects(analyzeAudioFile(fileAtLimit, 2048), /could not decode this WAV recording locally/i);
    assert.equal(decodeCalls, 1);

    const fileOverLimit = { name: 'oversized.wav', size: MAX_AUDIO_FILE_BYTES + 1 } as File;
    await assert.rejects(analyzeAudioFile(fileOverLimit, 2048), /no larger than 24 MB/i);
    assert.equal(decodeCalls, 1, 'oversized files should be rejected before allocating a decoder');
  } finally {
    if (originalAudioContext) {
      Object.defineProperty(globalThis, 'AudioContext', originalAudioContext);
    } else {
      Reflect.deleteProperty(globalThis, 'AudioContext');
    }
  }
});

test('reads the native sample rate from a WAV format chunk', () => {
  assert.equal(readWavSampleRate(wavHeader(96_000)), 96_000);
  assert.equal(readWavSampleRate(new ArrayBuffer(12)), null);
  assert.deepEqual(readWavAnalysisMetadata(wavHeader(16_000, 1, 16_000)), {
    sampleRate: 16_000,
    channels: 1,
    durationSeconds: 1,
    decodedSampleCount: 16_000,
  });
});

test('preserves high-rate WAV input so ultrasound-range components reach analysis', async () => {
  const originalAudioContext = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  const originalWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  let requestedSampleRate: number | undefined;

  class MockAudioContext {
    state = 'running';
    sampleRate: number;
    constructor(options?: AudioContextOptions) {
      this.sampleRate = options?.sampleRate ?? 48_000;
      requestedSampleRate = options?.sampleRate;
    }
    async decodeAudioData(encoded: ArrayBuffer) {
      const metadata = readWavAnalysisMetadata(encoded);
      assert.ok(metadata);
      const view = new DataView(encoded);
      const samples = Float32Array.from(
        { length: metadata.decodedSampleCount },
        (_, index) => view.getInt16(44 + index * 2, true) / 32_768,
      );
      return {
        duration: metadata.durationSeconds,
        sampleRate: metadata.sampleRate,
        numberOfChannels: 1,
        length: samples.length,
        getChannelData: () => samples,
      } as AudioBuffer;
    }
    async close() { this.state = 'closed'; }
  }

  class MockWorker {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onmessageerror: ((event: MessageEvent) => void) | null = null;
    postMessage(task: Parameters<typeof runAudioAnalysisTask>[0]) {
      const reply = runAudioAnalysisTask(task);
      queueMicrotask(() => this.onmessage?.({ data: reply } as MessageEvent));
    }
    terminate() {}
  }

  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: MockAudioContext });
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: MockWorker });
  try {
    const data = wavTone(30_000, 96_000, 4);
    const file = {
      size: data.byteLength,
      arrayBuffer: async () => data.slice(0),
    } as unknown as File;
    const result = await analyzeAudioFile(file, 8192);
    assert.equal(requestedSampleRate, 96_000);
    assert.equal(result.sampleRate, 96_000);
    assert.ok(result.dominant != null && Math.abs(result.dominant - 30_000) <= result.resolution);
  } finally {
    if (originalAudioContext) Object.defineProperty(globalThis, 'AudioContext', originalAudioContext);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
    if (originalWorker) Object.defineProperty(globalThis, 'Worker', originalWorker);
    else Reflect.deleteProperty(globalThis, 'Worker');
  }
});

test('rejects high-rate WAV when the browser forces a lower AudioContext rate', async () => {
  const originalAudioContext = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  const originalWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  class DownsamplingAudioContext {
    state = 'running';
    sampleRate = 48_000;
    async decodeAudioData() {
      throw new Error('Decode must not run after the context rate mismatch.');
    }
    async close() { this.state = 'closed'; }
  }

  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    value: DownsamplingAudioContext,
  });
  try {
    const data = wavTone(30_000, 96_000, 3);
    const file = {
      size: data.byteLength,
      arrayBuffer: async () => data.slice(0),
    } as unknown as File;
    await assert.rejects(
      analyzeAudioFile(file, 8192),
      /browser resampled this 96\.0 kHz WAV to 48\.0 kHz\. ZionCore stopped rather than silently losing high-frequency detail/,
    );
  } finally {
    if (originalAudioContext) Object.defineProperty(globalThis, 'AudioContext', originalAudioContext);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
    if (originalWorker) Object.defineProperty(globalThis, 'Worker', originalWorker);
    else Reflect.deleteProperty(globalThis, 'Worker');
  }
});

test('rejects WAV when decodeAudioData returns a lower rate than the native source', async () => {
  const originalAudioContext = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  const originalWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  class ResamplingAudioContext {
    state = 'running';
    sampleRate: number;
    constructor(options?: AudioContextOptions) {
      this.sampleRate = options?.sampleRate ?? 48_000;
    }
    async decodeAudioData() {
      const samples = sineWave(18_000, 48_000, 3);
      return {
        duration: 3,
        sampleRate: 48_000,
        numberOfChannels: 1,
        length: samples.length,
        getChannelData: () => samples,
      } as AudioBuffer;
    }
    async close() { this.state = 'closed'; }
  }

  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    value: ResamplingAudioContext,
  });
  try {
    const data = wavTone(30_000, 96_000, 3);
    const file = {
      size: data.byteLength,
      arrayBuffer: async () => data.slice(0),
    } as unknown as File;
    await assert.rejects(
      analyzeAudioFile(file, 8192),
      /decoded this WAV at 48\.0 kHz instead of its 96\.0 kHz source rate\. High-frequency detail was not analyzed/,
    );
  } finally {
    if (originalAudioContext) Object.defineProperty(globalThis, 'AudioContext', originalAudioContext);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
    if (originalWorker) Object.defineProperty(globalThis, 'Worker', originalWorker);
    else Reflect.deleteProperty(globalThis, 'Worker');
  }
});

test('resolves high-frequency components under deterministic noise at ultrasound-capable rates', () => {
  for (const { sampleRate, frequency } of [
    { sampleRate: 96_000, frequency: 42_000 },
    { sampleRate: 192_000, frequency: 72_000 },
  ]) {
    const result = analyzeAudioChannels(
      [noisySineWave(frequency, sampleRate, 3)],
      sampleRate,
      8192,
    );
    assert.equal(result.sampleRate, sampleRate);
    assert.ok(result.dominant != null);
    assert.ok(
      Math.abs(result.dominant - frequency) <= result.resolution * 2,
      `${frequency} Hz at ${sampleRate} Hz sample rate resolved as ${result.dominant} Hz`,
    );
  }
});
