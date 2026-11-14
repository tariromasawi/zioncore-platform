import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDspSignal, DEFAULT_DSP_CONFIG } from '@/lib/dsp-config';
import type { DspPlaybackHandle } from '@/lib/dsp-playback';
import {
  browserLocalAudioOutputAdapter,
  createBrowserLocalAudioOutputAdapter,
  createLocalSpeakerAuthorization,
  EXTERNAL_OUTPUT_READINESS,
  LOCAL_AUDIO_OUTPUT_DESCRIPTOR,
} from '@/lib/transmission-adapters';

const FIXED_TIME = '2026-11-12T12:00:00.000Z';

test('local output authorization requires explicit consent and a user-initiated action', () => {
  assert.throws(
    () => createLocalSpeakerAuthorization({ explicitConsent: false, userInitiated: true, authorizedAt: FIXED_TIME }),
    /explicit user consent/,
  );
  assert.throws(
    () => createLocalSpeakerAuthorization({ explicitConsent: true, userInitiated: false, authorizedAt: FIXED_TIME }),
    /explicit user consent/,
  );
  const authorization = createLocalSpeakerAuthorization({
    explicitConsent: true,
    userInitiated: true,
    authorizedAt: FIXED_TIME,
  });
  assert.equal(authorization.channel, 'local-speaker');
  assert.equal(authorization.consentVersion, 'local-speaker-playback/v1');
  assert.equal(authorization.authorizedAt, FIXED_TIME);
});

test('the registered local output delegates bounded audio to the existing playback engine', async () => {
  let playbackCalls = 0;
  const expectedHandle: DspPlaybackHandle = { stop() {}, dispose() {} };
  const adapter = createBrowserLocalAudioOutputAdapter(async () => {
    playbackCalls++;
    return expectedHandle;
  });
  const signal = createDspSignal(DEFAULT_DSP_CONFIG);
  await assert.rejects(
    adapter.output(signal, { channel: 'radio-frequency', explicitConsent: true }),
  );
  assert.equal(playbackCalls, 0);

  const authorization = createLocalSpeakerAuthorization({
    explicitConsent: true,
    userInitiated: true,
    authorizedAt: FIXED_TIME,
  });
  const handle = await adapter.output(signal, authorization);
  assert.equal(playbackCalls, 1);
  assert.equal(handle, expectedHandle);
  assert.equal(adapter.descriptor.channel, 'local-speaker');
  assert.equal(adapter.descriptor.status, 'available');
});

test('external-device and radio-frequency output remain unavailable pending review', () => {
  assert.equal(browserLocalAudioOutputAdapter.descriptor.id, LOCAL_AUDIO_OUTPUT_DESCRIPTOR.id);
  assert.equal(LOCAL_AUDIO_OUTPUT_DESCRIPTOR.maxDurationSeconds, 10);
  assert.equal(LOCAL_AUDIO_OUTPUT_DESCRIPTOR.maxDigitalPeak, 0.125);
  assert.deepEqual(EXTERNAL_OUTPUT_READINESS.map(item => item.status), ['disabled', 'disabled']);
  assert.match(EXTERNAL_OUTPUT_READINESS[1].blocker, /regulatory review/);
});
