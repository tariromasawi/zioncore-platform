import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acquireCurrentInstrument, analyseLabFrame, summarizeWaveform, WAVEFORM_DISPLAY_BUCKETS } from '@/lib/live-lab';
import { browserMicrophoneInstrument } from '@/lib/hardware-instruments';

test('measured peaks use FFT-bin resolution and rank by measured magnitude at every supported FFT size', () => {
  for (const fftSize of [2048, 4096, 8192]) {
    for (const sampleRate of [44100, 48000]) {
      const bins = new Uint8Array(fftSize / 2);
      bins[0] = 255; // DC is not reported as an acoustic frequency.
      bins[40] = 200;
      bins[80] = 100;
      const frame = analyseLabFrame(bins, new Float32Array(fftSize).fill(0.125), sampleRate);
      assert.equal(frame.resolution, sampleRate / fftSize);
      assert.equal(frame.dominant, 40 * sampleRate / fftSize);
      assert.deepEqual(frame.peaks, [40, 80].map(bin => bin * sampleRate / fftSize));
      assert.equal(frame.rms, 0.125);
      assert.equal(frame.waveform.length, WAVEFORM_DISPLAY_BUCKETS);
      assert.equal(frame.waveformWindowSeconds, fftSize / sampleRate);
      assert.deepEqual(frame.waveform[0], { minimum: 0.125, maximum: 0.125 });
      assert.ok(frame.peaks.every(peak => peak > 0 && peak < sampleRate / 2));
      bins[40] = 0;
      assert.equal(frame.bins[40], 200); // Frozen frame, not a mutable analyser buffer.
    }
  }
});

test('waveform summary preserves signed min/max transients in each time bucket', () => {
  const samples = new Float32Array(WAVEFORM_DISPLAY_BUCKETS * 2);
  samples[0] = 0.75;
  samples[1] = -0.5;
  const waveform = summarizeWaveform(samples);
  assert.equal(waveform.length, WAVEFORM_DISPLAY_BUCKETS);
  assert.deepEqual(waveform[0], { minimum: -0.5, maximum: 0.75 });
  assert.deepEqual(waveform[1], { minimum: 0, maximum: 0 });
});

test('silence and negligible spectrum energy never manufacture a dominant frequency', () => {
  const bins = new Uint8Array(2048);
  bins[40] = 200;
  const silent = analyseLabFrame(bins, new Float32Array(4096), 48000);
  assert.equal(silent.dominant, null);
  assert.deepEqual(silent.peaks, []);
  const noSpectrum = analyseLabFrame(new Uint8Array(2048), new Float32Array(4096).fill(0.1), 48000);
  assert.equal(noSpectrum.dominant, null);
  assert.deepEqual(noSpectrum.peaks, []);
});

test('peak output stays bounded to the six strongest local maxima', () => {
  const bins = new Uint8Array(2048);
  for (let i = 1; i <= 10; i++) bins[i * 10] = 40 + i;
  const frame = analyseLabFrame(bins, new Float32Array(4096).fill(0.1), 48000);
  assert.deepEqual(frame.peaks, [100, 90, 80, 70, 60, 50].map(bin => bin * 48000 / 4096));
});

async function withMicrophone(
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
  run: () => Promise<void>,
) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true, value: { mediaDevices: { getUserMedia } },
  });
  try { await run(); } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
}

function fakeStream() {
  let stopped = 0;
  const tracks = [
    { stop: () => { stopped++; }, getSettings: () => ({ sampleRate: 48000, channelCount: 1 }) },
    { stop: () => { stopped++; } },
  ];
  return {
    stream: { getAudioTracks: () => [tracks[0]], getTracks: () => tracks } as unknown as MediaStream,
    stopped: () => stopped,
  };
}

test('explicit microphone acquisition requests audio only and release stops every track', async () => {
  const fixture = fakeStream();
  await withMicrophone(async constraints => {
    assert.deepEqual(constraints, {
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    return fixture.stream;
  }, async () => {
    const lease = await acquireCurrentInstrument(browserMicrophoneInstrument, () => true);
    assert.ok(lease);
    assert.equal(lease.actualSettings.sampleRateHz, 48000);
    assert.equal(fixture.stopped(), 0);
    await browserMicrophoneInstrument.release(lease);
    assert.equal(fixture.stopped(), 2);
  });
});

test('permission arriving after cancellation or navigation immediately releases its stream', async () => {
  const fixture = fakeStream();
  let grant!: (stream: MediaStream) => void;
  let current = true;
  await withMicrophone(() => new Promise(resolve => { grant = resolve; }), async () => {
    const pending = acquireCurrentInstrument(browserMicrophoneInstrument, () => current);
    current = false;
    grant(fixture.stream);
    assert.equal(await pending, null);
    assert.equal(fixture.stopped(), 2);
  });
});

test('permission denial stays a failure rather than producing a reading or a lease', async () => {
  await withMicrophone(async () => {
    throw new DOMException('Permission denied', 'NotAllowedError');
  }, async () => {
    await assert.rejects(
      acquireCurrentInstrument(browserMicrophoneInstrument, () => true),
      { name: 'NotAllowedError' },
    );
  });
});
