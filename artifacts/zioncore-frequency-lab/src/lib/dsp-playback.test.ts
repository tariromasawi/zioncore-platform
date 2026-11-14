import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDspSignal, DEFAULT_DSP_CONFIG } from '@/lib/dsp-config';
import {
  DSP_PLAYBACK_FADE_SECONDS,
  DSP_PLAYBACK_GAIN,
  startDspPlayback,
} from '@/lib/dsp-playback';

class FakeBufferSource {
  buffer: AudioBuffer | null = null;
  onended: AudioScheduledSourceNode['onended'] = null;
  startCount = 0;
  stopTimes: number[] = [];
  connectTarget: unknown = null;
  connect(target: AudioNode | AudioParam) { this.connectTarget = target; }
  disconnect() {}
  start() { this.startCount++; }
  stop(when?: number) { this.stopTimes.push(when ?? 0); }
  fireEnded() { this.onended?.call(this as unknown as AudioScheduledSourceNode, new Event('ended')); }
}

class FakeGain {
  gain = {
    value: 1,
    cancelAt: [] as number[],
    setValues: [] as [number, number][],
    ramps: [] as [number, number][],
    cancelScheduledValues(when: number) { this.cancelAt.push(when); },
    setValueAtTime(value: number, when: number) { this.value = value; this.setValues.push([value, when]); },
    linearRampToValueAtTime(value: number, when: number) { this.value = value; this.ramps.push([value, when]); },
  };
  connectedTo: unknown = null;
  connect(target: AudioNode | AudioParam) { this.connectedTo = target; }
  disconnect() {}
}

function makeContext() {
  const source = new FakeBufferSource();
  const gain = new FakeGain();
  const destination = {} as AudioDestinationNode;
  const copiedSamples: Float32Array[] = [];
  let closeCount = 0;
  const context = {
    currentTime: 3,
    destination,
    createBuffer: (_channels: number, length: number, sampleRate: number) => ({
      length, sampleRate,
      copyToChannel: (samples: Float32Array) => { copiedSamples.push(new Float32Array(samples)); },
    } as unknown as AudioBuffer),
    createBufferSource: () => source as unknown as AudioBufferSourceNode,
    createGain: () => gain as unknown as GainNode,
    resume: async () => {},
    close: async () => { closeCount++; },
  } as unknown as AudioContext;
  return {
    context, source, gain, destination, copiedSamples,
    closeCount: () => closeCount,
  };
}

test('consented playback preparation uses the generated buffer and halves the already bounded level', async () => {
  const signal = createDspSignal(DEFAULT_DSP_CONFIG);
  const fixture = makeContext();
  let ended = 0;
  const playback = await startDspPlayback(signal, () => fixture.context, () => { ended++; });
  assert.equal(fixture.source.startCount, 1);
  assert.equal(fixture.source.buffer?.length, signal.sampleCount);
  assert.equal(fixture.source.buffer?.sampleRate, signal.config.sampleRateHz);
  assert.equal(fixture.copiedSamples[0].length, signal.sampleCount);
  assert.equal(fixture.gain.gain.value, DSP_PLAYBACK_GAIN);
  assert.equal(fixture.source.connectTarget, fixture.gain);
  assert.equal(fixture.gain.connectedTo, fixture.destination);
  assert.ok(signal.peakAmplitude * DSP_PLAYBACK_GAIN <= 0.125);
  assert.equal(ended, 0);

  fixture.source.fireEnded();
  assert.equal(ended, 1);
  assert.equal(fixture.closeCount(), 1);
  playback.dispose();
  assert.equal(ended, 1);
});

test('stop control fades output briefly then stops the source on the same click path', async () => {
  const fixture = makeContext();
  const playback = await startDspPlayback(
    createDspSignal(DEFAULT_DSP_CONFIG),
    () => fixture.context,
  );
  playback.stop();
  playback.stop();
  assert.deepEqual(fixture.gain.gain.cancelAt, [3]);
  assert.deepEqual(fixture.gain.gain.setValues, [[DSP_PLAYBACK_GAIN, 3]]);
  assert.deepEqual(fixture.gain.gain.ramps, [[0, 3 + DSP_PLAYBACK_FADE_SECONDS * 0.75]]);
  assert.deepEqual(fixture.source.stopTimes, [3 + DSP_PLAYBACK_FADE_SECONDS]);
  fixture.source.fireEnded();
});

test('unmount disposal mutes immediately and closes the playback context', async () => {
  const fixture = makeContext();
  const playback = await startDspPlayback(
    createDspSignal(DEFAULT_DSP_CONFIG),
    () => fixture.context,
  );
  playback.dispose();
  assert.deepEqual(fixture.gain.gain.setValues, [[0, 3]]);
  assert.deepEqual(fixture.source.stopTimes, [3]);
  assert.equal(fixture.closeCount(), 1);
  fixture.source.fireEnded();
  assert.equal(fixture.closeCount(), 1);
});

test('playback rejects malformed duration and over-limit signal samples before opening output', async () => {
  const valid = createDspSignal(DEFAULT_DSP_CONFIG);
  let contextCalls = 0;
  const createContext = () => {
    contextCalls++;
    return makeContext().context;
  };
  await assert.rejects(
    startDspPlayback({ ...valid, samples: new Float32Array(10) }, createContext),
    /valid, bounded generated signal/,
  );
  await assert.rejects(
    startDspPlayback({ ...valid, samples: new Float32Array(valid.sampleCount).fill(0.3) }, createContext),
    /exceeds the validated amplitude limit/,
  );
  assert.equal(contextCalls, 0);
});
