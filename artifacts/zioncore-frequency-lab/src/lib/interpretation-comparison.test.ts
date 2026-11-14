import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Observation } from '@/lib/observations';
import { buildInterpretationComparisonReport } from '@/lib/interpretation-comparison';

function observation(id: string, possibleSources: string[], modelId = 'gemini-3.5-flash-lite'): Observation {
  return {
    id,
    createdAt: '2026-11-12T09:00:00.000Z',
    sampleRate: 48000,
    fftSize: 4096,
    frequencyResolutionHz: 48000 / 4096,
    dominantFrequencyHz: 440.625,
    topPeaksHz: [440.625, 880.5],
    rmsLevel: 0.12,
    durationSeconds: 8,
    mode: 'microphone',
    notes: `PRIVATE_NOTE_${id}`,
    interpretation: {
      scientificInterpretation: `A measured pattern for ${id}.`,
      confidence: 'low',
      uncertainty: 'The acoustic source is not identified.',
      possibleSources,
      evidenceUsed: ['Dominant frequency bin: 440.63 Hz.'],
      limitations: ['RMS is not calibrated sound pressure.'],
      faithReflection: `PRIVATE_REFLECTION_${id}`,
      model: modelId,
      provenance: {
        source: 'ai-generated',
        observationId: id,
        methodId: 'frequency-measurement-explanation',
        methodVersion: '1.1.0',
        promptVersion: '1.1.0',
        provider: 'firebase-ai-google',
        modelId,
        generatedAt: '2026-11-12T09:05:00.000Z',
      },
    },
  };
}

test('report compares bounded, provenance-linked saved interpretations without claiming evidence', () => {
  const report = buildInterpretationComparisonReport([
    observation('observation-a', ['Steady room tone', 'Fan noise']),
    observation('observation-b', [' steady  ROOM   tone ', 'Electrical hum']),
  ]);

  assert.equal(report.candidates.length, 2);
  assert.equal(report.repeatedSourceWording.length, 1);
  assert.equal(report.repeatedSourceWording[0]?.wording, 'Steady room tone');
  assert.equal(report.repeatedSourceWording[0]?.observationIds.length, 2);
  assert.equal(report.pipelineGroups.length, 1);
  assert.equal(report.pipelineGroups[0]?.observationIds.length, 2);
  assert.ok(report.boundaries.some(text => text.includes('not independent evidence')));
  assert.ok(report.boundaries.some(text => text.includes('not proof of contradiction')));
  assert.equal(JSON.stringify(report).includes('PRIVATE_NOTE_'), false);
  assert.equal(JSON.stringify(report).includes('PRIVATE_REFLECTION_'), false);
});

test('different model provenance is listed as a separate pipeline, not independent proof', () => {
  const report = buildInterpretationComparisonReport([
    observation('observation-a', ['Room tone']),
    observation('observation-b', ['Mechanical noise'], 'another-recorded-model'),
  ]);

  assert.equal(report.pipelineGroups.length, 2);
  assert.equal(report.repeatedSourceWording.length, 0);
  assert.ok(report.boundaries.some(text => text.includes('No source, response, intent, or discovery is verified')));
});

test('comparison requires two to six distinct valid records with AI provenance', () => {
  const first = observation('observation-a', ['Room tone']);
  assert.throws(() => buildInterpretationComparisonReport([first]), /between 2 and 6/);
  assert.throws(() => buildInterpretationComparisonReport([first, first]), /distinct/);
  assert.throws(
    () => buildInterpretationComparisonReport([first, { ...first, id: 'observation-b', interpretation: undefined }]),
    /AI interpretation with recorded provenance/,
  );
  assert.throws(
    () => buildInterpretationComparisonReport(Array.from({ length: 7 }, (_, index) => observation(`observation-${index}`, []))),
    /between 2 and 6/,
  );
  assert.throws(
    () => buildInterpretationComparisonReport([first, { ...observation('observation-b', ['Room tone']), rmsLevel: 1.5 }]),
    /invalid/,
  );
});
