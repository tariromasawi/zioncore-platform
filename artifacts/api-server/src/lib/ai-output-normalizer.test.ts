import assert from 'node:assert/strict';
import test from 'node:test';
import { explanationSchema } from '@workspace/frequency-ai-contract';
import { AiInterpretationQualityError, assertAiInterpretationQuality } from './ai-interpretation-quality';
import { normalizeAnalysisOutput } from './ai-output-normalizer';

test('normalizes common model formatting drift without discarding useful prose', () => {
  const raw = {
    signalFamily: 'Harmonic Pure-Tone / Synthetic Acoustic Monopole',
    executiveSummary: 'A useful summary.',
    integratedReading: 'An integrated reading.',
    patternSignature: 'p'.repeat(1300),
    harmonicAnalysis: 'Harmonics are present.',
    temporalAnalysis: 'The measurement is stable.',
    modulationAnalysis: 'No strong modulation is present.',
    domainPerspectives: [
      ['Acoustics', 'Evaluates physical wave propagation.'],
      ['Signal Processing', 'Analyzes FFT-derived features.'],
      ['Mathematics & Statistics', 'Assesses the measured distribution.'],
      ['Communications', 'A tentative channel interpretation.'],
      ['Environmental & Bioacoustics', 'More data is needed for source attribution.'],
    ].map(([domain, relevance]) => ({
      domain,
      relevance,
      analysis: 'A domain-specific reading.',
      evidenceBoundary: 'This is limited to the supplied derived features.',
    })),
    keyTakeaways: ['One', 'Two', 'Three'],
    confidence: 0.91,
    confidenceScope: 'Confidence applies to the measured pattern only.',
    uncertainty: 'The source is not known.',
    dataQuality: 'The synthetic test signal has clear peaks.',
    candidateExplanations: [{
      label: 'A tonal source',
      rationale: 'The peak is stable.',
      evidenceFor: ['A stable dominant peak.', 'Harmonic spacing.'],
      evidenceAgainst: ['No source recording is available.'],
      confidence: 0.84,
      whatWouldDiscriminate: 'Record a matched source reference.',
    }],
    followUpExperiments: [
      { title: 'Repeat', method: 'Repeat the capture.', whatToRecord: 'Record the same settings.' },
      { title: 'Compare', method: 'Change one parameter.', whatToRecord: 'Record peak drift.' },
    ],
    reflectionQuestions: ['What stands out?', 'What would you compare next?'],
    faithReflection: null,
  };

  const result = explanationSchema.safeParse(normalizeAnalysisOutput(raw));
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.signalFamily, 'harmonic');
  assert.equal(result.data.confidence, 'high');
  assert.equal(result.data.patternSignature.length, 1200);
  assert.deepEqual(
    result.data.domainPerspectives.map(perspective => perspective.domain),
    ['acoustics', 'signal_processing', 'mathematics', 'communications', 'environmental_bioacoustics'],
  );
  assert.equal(result.data.domainPerspectives[0]?.relevance, 'direct');
  assert.match(result.data.domainPerspectives[0]?.analysis ?? '', /Evaluates physical wave propagation/);
  assert.match(result.data.candidateExplanations[0]?.evidenceFor ?? '', /Harmonic spacing/);
});

test('interpretation quality checks block unsupported acoustic claims and internal attribution', () => {
  const evidence = {
    dominantFrequencyHz: 440.625,
    topPeaksHz: [440.625, 880.5],
    frequencyResolutionHz: 48000 / 4096,
  };
  const syntheticContext = 'Internal QA sample: synthetic test data, not a real recording.';
  const safeReport = {
    executiveSummary: 'This synthetic QA sample has a measured peak near 440.6 Hz.',
    integratedReading: 'Peak-to-median contrast is a relative spectral comparison, not a calibrated signal-to-noise ratio or noise-floor measurement. The nearby 880.5 Hz peak is consistent with a second harmonic within the stated resolution, not an exact match.',
  };
  assert.doesNotThrow(() => assertAiInterpretationQuality(safeReport, evidence, syntheticContext));

  const reflection = [
    'The measured pattern is a quiet, narrow peak that remains visible through most of the short capture. That observation gives this reflection a specific starting point without deciding where the sound came from.',
    'In the faith context you choose, the steadiness may invite reflection on patience and attention. This is a possible symbolic connection, not evidence that a particular tradition or divine source produced the tone.',
    'You might compare another recording under the same conditions and note what changes for you. Keep the measurement, your interpretation, and your personal response distinct as you decide what meaning to carry forward.',
  ].join('\n\n');
  assert.doesNotThrow(() => assertAiInterpretationQuality(
    { ...safeReport, faithReflection: reflection },
    evidence,
    syntheticContext,
    true,
  ));

  const invalidClaims = [
    ['CONTRAST_AS_NOISE', 'Peak-to-median contrast shows separation from the digital noise floor.'],
    ['UNSUPPORTED_ALIASING_CLAIM', 'No aliasing is detected in this signal.'],
    ['MATRIX_OVERCLAIM', 'The principal variance share confirms a steady-state signal.'],
    ['PRESSURE_OVERCLAIM', 'RMS indicates a consistent pressure variation.'],
    ['SOURCE_PROXIMITY', 'The source is likely proximal to the microphone.'],
    ['EXACT_HARMONIC_OVERCLAIM', 'The 880.5 Hz peak is exactly an octave above the fundamental.'],
    ['INTERNAL_ATTRIBUTION', 'ZIONCORE GENESIS SEED v1.0.0. Attribution: HRH SAINT TARIRO MASAWI.'],
    ['SYNTHETIC_LABEL_MISSING', 'A stable tone was captured and analyzed.'],
  ] as const;

  for (const [expectedCode, claim] of invalidClaims) {
    assert.throws(
      () => assertAiInterpretationQuality({ executiveSummary: claim }, evidence, syntheticContext),
      error => error instanceof AiInterpretationQualityError && error.codes.includes(expectedCode),
      claim,
    );
  }

  for (const faithReflection of [null, 'Only one short paragraph.']) {
    assert.throws(
      () => assertAiInterpretationQuality(
        { ...safeReport, faithReflection },
        evidence,
        syntheticContext,
        true,
      ),
      error => error instanceof AiInterpretationQualityError && error.codes.includes('FAITH_REFLECTION_MISSING'),
    );
  }

  const shallowReflection = ['Short paragraph one.', 'Short paragraph two.', 'Short paragraph three.'].join('\n\n');
  assert.throws(
    () => assertAiInterpretationQuality(
      { ...safeReport, faithReflection: shallowReflection },
      evidence,
      syntheticContext,
      true,
    ),
    error => error instanceof AiInterpretationQualityError && error.codes.includes('FAITH_REFLECTION_TOO_SHALLOW'),
  );
});
