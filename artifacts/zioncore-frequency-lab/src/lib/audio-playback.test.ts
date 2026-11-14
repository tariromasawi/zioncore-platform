import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createAudioPlaybackController,
} from './audio-playback';

function fakeAudioContext() {
  const state = { value: 'running' as AudioContextState };
  const gainEvents: Array<{ type: string; value?: number; time?: number }> = [];
  const sourceState: {
    started: boolean;
    stopAt: number | null;
    onended: (() => void) | null;
  } = { started: false, stopAt: null, onended: null };
  let resume: () => Promise<void> = async () => undefined;
  const context = {
    get state() {
      return state.value;
    },
    currentTime: 2,
    destination: {},
    resume: () => resume(),
    close: async () => {
      state.value = 'closed';
    },
    createBuffer: (_channels: number, length: number, _sampleRate: number) => {
      const samples = new Float32Array(length);
      return { getChannelData: () => samples };
    },
    createBufferSource: () => ({
      buffer: null,
      set onended(handler: (() => void) | null) {
        sourceState.onended = handler;
      },
      connect: () => undefined,
      start: () => {
        sourceState.started = true;
      },
      stop: (when?: number) => {
        sourceState.stopAt = when ?? 0;
      },
    }),
    createGain: () => ({
      gain: {
        value: 0,
        cancelScheduledValues: (time: number) => gainEvents.push({ type: 'cancel', time }),
        setValueAtTime: (value: number, time: number) => {
          gainEvents.push({ type: 'set', value, time });
        },
        linearRampToValueAtTime: (value: number, time: number) => {
          gainEvents.push({ type: 'ramp', value, time });
        },
      },
      connect: () => undefined,
    }),
  } as unknown as AudioContext;

  return {
    context,
    gainEvents,
    sourceState,
    setResume(callback: () => Promise<void>) {
      resume = callback;
    },
    endPlayback() {
      sourceState.onended?.();
    },
  };
}

function makeController(
  createContext: () => AudioContext,
  delayedCloses: Array<() => void> = [],
) {
  const states: boolean[] = [];
  const statuses: string[] = [];
  const controller = createAudioPlaybackController({
    createContext,
    onPlayingChange: state => states.push(state),
    onStatusChange: status => statuses.push(status),
    scheduleClose: callback => delayedCloses.push(callback),
  });
  return { controller, states, statuses };
}

const signal = () => new Float32Array(4_800).fill(0.2);

test('playback starts at a capped gain and manual stop fades before stopping', async () => {
  const fake = fakeAudioContext();
  const delayedCloses: Array<() => void> = [];
  const { controller, states, statuses } = makeController(() => fake.context, delayedCloses);

  assert.equal(await controller.play(signal(), 48_000, 0.55, 'Playing packet.', 'Playback complete.'), true);
  assert.equal(fake.sourceState.started, true);
  assert.ok(fake.gainEvents.some(event => event.type === 'ramp' && event.value === 0.55));
  assert.equal(states.at(-1), true);
  assert.equal(statuses.at(-1), 'Playing packet.');

  controller.stop();
  assert.ok(fake.gainEvents.some(event => event.type === 'ramp' && event.value === 0));
  assert.equal(fake.sourceState.stopAt, 2.07);
  assert.equal(states.at(-1), false);
  assert.equal(statuses.at(-1), 'Playback stopped.');
  assert.equal(delayedCloses.length, 1);
  delayedCloses[0]?.();
  assert.equal(fake.context.state, 'closed');
});

test('completion closes the context and reports the completed state once', async () => {
  const fake = fakeAudioContext();
  const { controller, states, statuses } = makeController(() => fake.context);

  await controller.play(signal(), 48_000, 0.65, 'Playing recovered voice.', 'Voice playback complete.');
  fake.endPlayback();
  assert.equal(fake.context.state, 'closed');
  assert.equal(states.at(-1), false);
  assert.equal(statuses.at(-1), 'Voice playback complete.');
});

test('rapid play requests are serialized and stopping pending startup cancels it', async () => {
  const fake = fakeAudioContext();
  let resolveResume: (() => void) | undefined;
  fake.setResume(() => new Promise<void>(resolve => {
    resolveResume = resolve;
  }));
  const { controller } = makeController(() => fake.context);

  const pending = controller.play(signal(), 48_000, 0.55, 'Playing.', 'Complete.');
  assert.equal(await controller.play(signal(), 48_000, 0.55, 'Duplicate.', 'Complete.'), false);
  controller.stop();
  assert.equal(fake.context.state, 'closed');
  resolveResume?.();
  assert.equal(await pending, false);
  assert.equal(fake.sourceState.started, false);
});

test('invalid gain, sample rate, or samples never create an audio context', async () => {
  let contextsCreated = 0;
  const { controller, statuses } = makeController(() => {
    contextsCreated += 1;
    return fakeAudioContext().context;
  });
  const invalid = new Float32Array([Number.NaN]);

  assert.equal(await controller.play(signal(), 48_000, 0.71, 'Playing.', 'Complete.'), false);
  assert.equal(await controller.play(signal(), 7_999, 0.55, 'Playing.', 'Complete.'), false);
  assert.equal(await controller.play(invalid, 48_000, 0.55, 'Playing.', 'Complete.'), false);
  assert.equal(contextsCreated, 0);
  assert.equal(statuses.length, 3);
});

test('audio context startup failures are reported and do not poison a later retry', async () => {
  const fake = fakeAudioContext();
  let attempts = 0;
  const { controller, statuses } = makeController(() => {
    attempts += 1;
    if (attempts === 1) throw new Error('Audio output unavailable.');
    return fake.context;
  });

  assert.equal(await controller.play(signal(), 48_000, 0.55, 'Playing.', 'Complete.'), false);
  assert.equal(statuses.at(-1), 'Audio output unavailable.');
  assert.equal(await controller.play(signal(), 48_000, 0.55, 'Playing.', 'Complete.'), true);
  assert.equal(fake.sourceState.started, true);
});
