import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { getEventListeners } from 'node:events';
import { analyzeAudioOffThread } from './audio-analysis-client';

function installWorker(t: TestContext, reply?: unknown) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  const instances: FakeWorker[] = [];
  class FakeWorker {
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: (() => void) | null = null;
    onmessageerror: (() => void) | null = null;
    terminations = 0;
    constructor() { instances.push(this); }
    postMessage() {
      if (reply !== undefined) queueMicrotask(() => this.onmessage?.({ data: reply } as MessageEvent));
    }
    terminate() { this.terminations += 1; }
  }
  Object.defineProperty(globalThis, 'Worker', { configurable: true, writable: true, value: FakeWorker });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'Worker', previous);
    else Reflect.deleteProperty(globalThis, 'Worker');
  });
  return instances;
}

test('already cancelled analysis does not create a worker', async t => {
  const instances = installWorker(t);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(analyzeAudioOffThread([], 8000, 2048, controller.signal), { name: 'AbortError' });
  assert.equal(instances.length, 0);
});

test('leaving a pending analysis terminates its worker once and detaches its listener', async t => {
  const instances = installWorker(t);
  const controller = new AbortController();
  const pending = analyzeAudioOffThread([new Float32Array(24_000)], 8000, 2048, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(instances[0].terminations, 1);
  assert.equal(instances[0].onmessage, null);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('invalid worker envelopes fail promptly instead of leaving a permanent spinner', async t => {
  const instances = installWorker(t, null);
  await assert.rejects(analyzeAudioOffThread([], 8000, 2048), /could not be read/);
  assert.equal(instances[0].terminations, 1);
});

test('worker validation failures retain their message and free their resources', async t => {
  const instances = installWorker(t, { ok: false, error: 'Unsupported channel count.' });
  await assert.rejects(analyzeAudioOffThread([], 8000, 2048), /Unsupported channel count/);
  assert.equal(instances[0].terminations, 1);
});
