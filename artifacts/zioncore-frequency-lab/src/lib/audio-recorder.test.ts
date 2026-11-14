import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_LOCAL_RECORDING_BYTES,
  MAX_LOCAL_RECORDING_SECONDS,
  RECORDING_AUDIO_BITRATE,
  formatRecordingMetadata,
  getRecordingFileExtension,
  getRecordingTimesliceMs,
  getSupportedRecordingMimeTypes,
} from './audio-recorder';

test('browser recordings have bounded memory and duration targets', () => {
  assert.equal(MAX_LOCAL_RECORDING_BYTES, 24 * 1024 * 1024);
  assert.equal(MAX_LOCAL_RECORDING_SECONDS, 3 * 60);
  assert.equal(RECORDING_AUDIO_BITRATE, 96_000);
});

test('recording types are selected only when the current browser reports support', () => {
  const calls: string[] = [];
  const supported = getSupportedRecordingMimeTypes({
    isTypeSupported: mimeType => {
      calls.push(mimeType);
      return mimeType === 'audio/mp4' || mimeType === 'audio/webm;codecs=opus';
    },
  });
  assert.deepEqual(supported, ['audio/mp4', 'audio/webm;codecs=opus']);
  assert.equal(calls[0], 'audio/mp4;codecs=mp4a.40.2');
  assert.equal(calls.at(-1), 'audio/ogg');
  assert.deepEqual(getSupportedRecordingMimeTypes(null), []);
});

test('recording capability probes that throw fail closed for that format', () => {
  const supported = getSupportedRecordingMimeTypes({
    isTypeSupported: mimeType => {
      if (mimeType === 'audio/mp4') throw new Error('unsupported probe');
      return mimeType === 'audio/webm';
    },
  });
  assert.deepEqual(supported, ['audio/webm']);
});

test('recording extensions follow the actual MIME type, with unknown types left unnamed', () => {
  assert.equal(getRecordingFileExtension('audio/mp4;codecs=mp4a.40.2'), 'm4a');
  assert.equal(getRecordingFileExtension('audio/webm;codecs=opus'), 'webm');
  assert.equal(getRecordingFileExtension('audio/ogg'), 'ogg');
  assert.equal(getRecordingFileExtension('application/octet-stream'), '');
});

test('MP4 recording avoids fragmented chunks while other formats use bounded slices', () => {
  assert.equal(getRecordingTimesliceMs('audio/mp4;codecs=mp4a.40.2'), undefined);
  assert.equal(getRecordingTimesliceMs('audio/mp4'), undefined);
  assert.equal(getRecordingTimesliceMs('audio/webm;codecs=opus'), 1_000);
  assert.equal(getRecordingTimesliceMs('audio/ogg'), 1_000);
});

test('recording metadata distinguishes device input, analysis rate, and unreported encoder rate', () => {
  assert.equal(
    formatRecordingMetadata(48_000, 48_000, 'audio/webm;codecs=opus'),
    'Input rate 48.0 kHz; analysis AudioContext 48.0 kHz; MediaRecorder format audio/webm;codecs=opus. MediaRecorder does not expose its encoded sample rate directly.',
  );
  assert.match(
    formatRecordingMetadata(undefined, 44_100, ''),
    /input device; analysis AudioContext 44\.1 kHz; MediaRecorder format browser-selected format/i,
  );
});
