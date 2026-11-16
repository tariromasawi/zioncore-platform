import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createMicrophoneConstraints,
  formatCaptureRateSummary,
  getMicrophoneStartErrorMessage,
  getAnalysisContextSampleRate,
  MAX_ANALYSIS_SAMPLE_RATE_HZ,
  observeAudioTrackLifecycle,
} from './audio-capture-capabilities';

test('keeps standard microphone capture defaults and only requests high rate on user action', () => {
  assert.deepEqual(createMicrophoneConstraints(false), {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  });
  assert.deepEqual(createMicrophoneConstraints(true), {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    sampleRate: { ideal: MAX_ANALYSIS_SAMPLE_RATE_HZ },
  });
});

test('uses the reported input rate up to ZionCore’s analysis ceiling', () => {
  assert.equal(getAnalysisContextSampleRate(96_000), 96_000);
  assert.equal(getAnalysisContextSampleRate(384_000), MAX_ANALYSIS_SAMPLE_RATE_HZ);
  assert.equal(getAnalysisContextSampleRate(undefined), undefined);
  assert.equal(getAnalysisContextSampleRate(7_999), undefined);
  assert.equal(getAnalysisContextSampleRate(Number.NaN), undefined);
});

test('capture status reports device rate, analysis rate, and digital Nyquist separately', () => {
  assert.equal(
    formatCaptureRateSummary(96_000, 96_000),
    'Device-reported input sample rate 96.0 kHz; analysis context 96.0 kHz; digital Nyquist 48.0 kHz.',
  );
  assert.equal(
    formatCaptureRateSummary(undefined, 48_000),
    'Device-reported input sample rate unreported; analysis context 48.0 kHz; digital Nyquist 24.0 kHz.',
  );
});

test('permission and device failures offer a retry action matched to the browser error', () => {
  assert.match(
    getMicrophoneStartErrorMessage(new DOMException('denied', 'NotAllowedError')),
    /permission was denied.*try again/i,
  );
  assert.match(
    getMicrophoneStartErrorMessage(new DOMException('missing', 'NotFoundError')),
    /no microphone was found.*try again/i,
  );
  assert.match(
    getMicrophoneStartErrorMessage(new DOMException('busy', 'NotReadableError')),
    /in use or unavailable.*retry/i,
  );
  assert.match(
    getMicrophoneStartErrorMessage(new Error('audio system unavailable')),
    /could not start microphone capture: audio system unavailable/i,
  );
});

test('capture lifecycle reports temporary muting and device termination and detaches cleanly', () => {
  const track = new EventTarget();
  const events: string[] = [];
  const detach = observeAudioTrackLifecycle(track as unknown as MediaStreamTrack, {
    onMute: () => events.push('muted'),
    onUnmute: () => events.push('resumed'),
    onEnded: () => events.push('ended'),
  });

  track.dispatchEvent(new Event('mute'));
  track.dispatchEvent(new Event('unmute'));
  track.dispatchEvent(new Event('ended'));
  detach();
  track.dispatchEvent(new Event('ended'));
  track.dispatchEvent(new Event('mute'));

  assert.deepEqual(events, ['muted', 'resumed', 'ended']);
});
