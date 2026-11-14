import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Router } from 'wouter';
import { buildFrontierReport } from './frontier-discovery';
import { buildListeningDossier } from './listening-dossier';
import ComprehensiveListeningReport from '../components/comprehensive-listening-report';
import type { FreeListeningInput } from './free-listening';
const quiet: FreeListeningInput = {
  dominantFrequencyHz: null, rmsLevel: 0, sampleRate: 48000, durationSeconds: 33.6,
  silent: true, fftSize: 4096, captureSource: 'microphone',
  features: { spectralCentroidHz: null, spectralFlatness: 0, spectralEntropy: 0, peakToMedianContrastDb: null, rolloff85Hz: null, harmonicity: 0, zeroCrossingRate: 0, dominantFrequencyStabilityHz: null, dominantFrequencyDriftHz: null, amplitudeVariationCoefficient: null, temporalWindowSeconds: 4.9 },
};
const options = { toolId: 'acoustic' as const, context: 'A quiet moment of prayer', feeling: 'uplifting' as const, hypothesis: '' };
function dossier(input = quiet, context = options.context) {
  return buildListeningDossier(input, buildFrontierReport(input, { ...options, context }), context);
}
function render(input = quiet, context = options.context) {
  const report = buildFrontierReport(input, { ...options, context });
  return renderToStaticMarkup(React.createElement(Router, { ssrPath: '/' },
    React.createElement(ComprehensiveListeningReport, { input, report, context, aiResult: null })));
}
test('the exact reported quiet case becomes an eight-layer exploration with retained technical scope', () => {
  const d = dossier();
  assert.equal(d.title, 'The Hidden Architecture of Stillness');
  assert.equal(d.chapters.length, 8);
  assert.equal(d.perspectives.length, 4);
  assert.match(d.coverage, /33\.6 seconds;\s*4\.9 seconds/);
  assert.match(d.coverage, /available live observation/);
  assert.match(d.chapters[0].paragraphs.join(' '), /digital RMS/i);
  assert.match(d.coverage, /available live observation/);
  assert.ok(!d.chapters[0].paragraphs.join(' ').includes('near 0.0 Hz'));
  assert.ok(d.chapters.some(c => c.id === 'celestial' && c.paragraphs.length > 0));
  assert.ok(d.personal.some(line => line.includes(options.context)));
});
test('story leads; measurement scope is accessible in one collapsed details section', () => {
  const html = render();
  const narrative = html.replace(/<details\b[\s\S]*?<\/details>/g, '');
  for (const phrase of ['not a failed consultation', 'unreliable', 'withheld', 'cannot establish', 'does not establish', 'will not invent', 'not verified', 'No dependable']) assert.ok(!narrative.includes(phrase), phrase);
  assert.ok(narrative.includes('Your Personal Resonance Message'));
  assert.ok(narrative.includes('The Universal Language of Resonance'));
  assert.ok(narrative.includes('£1/month'));
  assert.equal((html.match(/<details\b/g) ?? []).length, 1);
  assert.ok(html.includes('11.72 Hz'));
  assert.ok(html.includes('24,000') || html.includes('24000'));
  assert.ok(html.includes('data-testid="details-report-measurements"'));
  assert.ok(html.indexOf('The Hidden Architecture of Stillness') < html.indexOf('Digital RMS:'));
});
test('adaptive modes change with actual feature structure, not a claimed species or sender', () => {
  const signal: FreeListeningInput = { ...quiet, silent: false, rmsLevel: 0.1, dominantFrequencyHz: 440,
    features: { ...quiet.features, spectralFlatness: 0.1, harmonicity: 0.8 } };
  assert.equal(dossier(signal).mode, 'harmonic');
  assert.match(dossier(signal).chapters[0].paragraphs.join(' '), /440\.0 Hz/);
  assert.equal(dossier({ ...signal, features: { ...signal.features, harmonicity: 0.5 } }).mode, 'tonal');
  assert.equal(dossier({ ...signal, features: { ...signal.features, spectralFlatness: 0.6, amplitudeVariationCoefficient: 0.8 } }).mode, 'changing');
  assert.equal(dossier({ ...signal, features: { ...signal.features, spectralFlatness: 0.6 } }).mode, 'soundscape');
  const outOfBand = dossier({ ...signal, dominantFrequencyHz: 90000 });
  assert.equal(outOfBand.mode, 'open-pattern');
  assert.ok(!JSON.stringify(outOfBand).includes('90000'));
  const silentWithStalePeak = dossier({ ...signal, silent: true, rmsLevel: 0 });
  assert.equal(silentWithStalePeak.mode, 'quiet');
  assert.ok(!JSON.stringify(silentWithStalePeak).includes('440.0'));
});
test('intentions change substantive guidance while context remains bounded and escaped', () => {
  const family = dossier(quiet, 'My family relationships').personal.join(' ');
  const work = dossier(quiet, 'My business project').personal.join(' ');
  const grief = dossier(quiet, 'Honouring grief and loss').personal.join(' ');
  assert.match(family, /thoughtful conversation/);
  assert.match(work, /one valuable objective/);
  assert.match(grief, /preserve a meaningful memory/);
  assert.ok(!family.includes('one valuable objective'));
  const context = '<script>private intention</script>' + 'x'.repeat(400);
  const html = render(quiet, context);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!dossier(quiet, context).personal.join(' ').includes('x'.repeat(301)));
  assert.ok(dossier(quiet, 'Mwari and Mudzimu Unoyera').chapters.find(c => c.id === 'spiritual')!.paragraphs.join(' ').includes('MWARI NDI MWARI'));
  assert.equal(dossier(quiet, 'A secular philosophy of attention').chapters.find(c => c.id === 'spiritual')!.kind, 'Philosophical reflection');
});
