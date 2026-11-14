import assert from 'node:assert/strict';
import test from 'node:test';
import { runAudioAnalysisTask } from './audio-analysis-task';

test('the background task computes genuine audio features without changing its samples', () => {
  const samples = Float32Array.from({ length: 8000 * 3 }, (_, i) => 0.2 * Math.sin(2 * Math.PI * 440 * i / 8000));
  const first = samples[99];
  const reply = runAudioAnalysisTask({ channels: [samples], sampleRate: 8000, fftSize: 2048 });
  assert.equal(reply.ok, true);
  if (reply.ok) {
    assert.ok(Math.abs((reply.result.dominant ?? 0) - 440) < 8);
    assert.equal(reply.result.durationSeconds, 3);
  }
  assert.equal(samples[99], first);
});

test('the background task returns explicit validation errors instead of an empty result', () => {
  const reply = runAudioAnalysisTask({ channels: [], sampleRate: 8000, fftSize: 2048 });
  assert.equal(reply.ok, false);
  if (!reply.ok) assert.match(reply.error, /channels/);
});
