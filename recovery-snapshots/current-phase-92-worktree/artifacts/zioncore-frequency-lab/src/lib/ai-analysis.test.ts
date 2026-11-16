import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildAnalysisPrompt as buildSharedAnalysisPrompt,
  explanationSchema as sharedExplanationSchema,
} from '@workspace/frequency-ai-contract';
import {
  analysisContextSchema,
  analysisMeasurementSchema,
  explanationSchema,
  FREQUENCY_EXPLANATION_MODEL,
  getAnalysisErrorMessage,
  MAX_ANALYSIS_OUTPUT_TOKENS,
  MAX_LISTENING_CONTEXT_CHARS,
  type AnalysisMeasurement,
  parseInterpretationResponse,
  AIRequestError,
  isInterpretationResponseRetryable,
} from '@/lib/ai-analysis';
import { splitFaithReflection } from '@/lib/faith-reflection';

test('an unreadable paid response retains retry recovery rather than declaring the job unpaid', () => {
  for (const body of [null, {}, { analysis: 'broken' }]) {
    assert.throws(() => parseInterpretationResponse(body), error =>
      error instanceof AIRequestError && error.retryable === true && error.status === 502);
  }
});

test('gateway failures retain job recovery while explicit server failure decisions remain authoritative', () => {
  assert.equal(isInterpretationResponseRetryable(502, null), true);
  assert.equal(isInterpretationResponseRetryable(503, { error: 'unavailable' }), true);
  assert.equal(isInterpretationResponseRetryable(429, {}), true);
  assert.equal(isInterpretationResponseRetryable(401, { error: 'Sign in again' }), true);
  assert.equal(isInterpretationResponseRetryable(403, { error: 'Account access unavailable' }), true);
  assert.equal(isInterpretationResponseRetryable(503, { retryable: false }), false);
  assert.equal(isInterpretationResponseRetryable(409, { retryable: true }), true);
  assert.equal(isInterpretationResponseRetryable(400, {}), false);
});
import {
  buildGenesisSeedContext,
  countGenesisSeedCharacters,
} from '../../../../lib/frequency-ai-contract/src/genesis-seed';

const measurement: AnalysisMeasurement = {
  captureSource: 'microphone',
  sampleRate: 48000,
  fftSize: 4096,
  frequencyResolutionHz: 48000 / 4096,
  dominantFrequencyHz: 440.625,
  topPeaksHz: [440.625, 880.5],
  rmsLevel: 0.12,
  durationSeconds: 8.4,
  signalFeatures: {
    spectralCentroidHz: 620,
    spectralFlatness: 0.12,
    spectralEntropy: 0.34,
    peakToMedianContrastDb: 28.4,
    rolloff85Hz: 1800,
    harmonicity: 0.81,
    zeroCrossingRate: 0.018,
    dominantFrequencyStabilityHz: 1.4,
    dominantFrequencyDriftHz: 2.1,
    amplitudeVariationCoefficient: 0.08,
    temporalWindowSeconds: 5,
  },
  spectralMatrixAnalysis: {
    status: 'sufficient',
    frameCount: 8,
    bandLabels: ['0 Hz–4.8 kHz', '4.8–9.6 kHz', '9.6–14.4 kHz', '14.4–19.2 kHz', '19.2–24.0 kHz'],
    correlationMatrix: [
      [1, 0.72, -0.31, 0.08, -0.1],
      [0.72, 1, -0.12, 0.1, 0.04],
      [-0.31, -0.12, 1, -0.22, 0.13],
      [0.08, 0.1, -0.22, 1, 0.5],
      [-0.1, 0.04, 0.13, 0.5, 1],
    ],
    principalDirection: [0.62, 0.58, -0.36, 0.27, 0.28],
    principalVarianceShare: 0.48,
  },
};

test('validates structured measurements before analysis', () => {
  assert.equal(analysisMeasurementSchema.safeParse(measurement).success, true);
  assert.equal(analysisMeasurementSchema.safeParse({
    ...measurement,
    dominantFrequencyHz: 24001,
  }).success, false);
  assert.equal(analysisMeasurementSchema.safeParse({
    ...measurement,
    spectralMatrixAnalysis: {
      ...measurement.spectralMatrixAnalysis,
      correlationMatrix: [
        [1, 0.8, -0.3, 0.08, -0.1],
        [0.72, 1, -0.12, 0.1, 0.04],
        [-0.31, -0.12, 1, -0.22, 0.13],
        [0.08, 0.1, -0.22, 1, 0.5],
        [-0.1, 0.04, 0.13, 0.5, 1],
      ],
    },
  }).success, false);
});

test('analysis prompt contains only structured values, not audio or notes', () => {
  const prompt = buildSharedAnalysisPrompt(measurement, false);
  assert.match(prompt, /sampleRate/);
  assert.match(prompt, /dominantFrequencyHz/);
  assert.match(prompt, /harmonicity/);
  assert.match(prompt, /spectralEntropy/);
  assert.match(prompt, /spectralMatrixAnalysis/);
  assert.doesNotMatch(prompt, /LOCAL_NOTE_MUST_NOT_BE_SENT|LOCAL_AUDIO_MUST_NOT_BE_SENT|LOCAL_BINS_MUST_NOT_BE_SENT/);
  assert.match(prompt, /faithReflection to null/);
  assert.throws(() => buildSharedAnalysisPrompt({
    ...measurement,
    notes: 'LOCAL_NOTE_MUST_NOT_BE_SENT',
    bins: 'LOCAL_BINS_MUST_NOT_BE_SENT',
    audio: 'LOCAL_AUDIO_MUST_NOT_BE_SENT',
  } as AnalysisMeasurement, false));
});

test('shared interpretation prompt includes the compact ZionCore genesis context', () => {
  const prompt = buildSharedAnalysisPrompt(measurement, true, 'A user-selected reflection context.');
  assert.match(prompt, /ZIONCORE GENESIS SEED v1\.1\.0/);
  assert.match(prompt, /HRH SAINT TARIRO MASAWI THE ANOINTED COMMANDER/);
});

test('ZionCore genesis seed exceeds 50,000 characters and injects only selected knowledge', () => {
  const seedCharacters = countGenesisSeedCharacters();
  assert.ok(seedCharacters >= 50_000, `Expected at least 50,000 seed characters; got ${seedCharacters}.`);

  const personalized = buildGenesisSeedContext(
    true,
    'Please explore plant bioacoustics, faith, and a prayer reflection.',
  );
  assert.match(personalized, /ZIONCORE GENESIS SEED v1\.1\.0/);
  assert.match(personalized, /HRH SAINT TARIRO MASAWI THE ANOINTED COMMANDER/);
  assert.match(personalized, /Additional · Theology/);
  assert.match(personalized, /18 · Plant physiology and mechanosensing/);
  assert.ok(personalized.length < 10_000, `Expected a compact selected prompt; got ${personalized.length} characters.`);

  const technicalOnly = buildGenesisSeedContext(false, '');
  assert.doesNotMatch(technicalOnly, /Additional · Theology/);
  assert.doesNotMatch(technicalOnly, /Software-defined radio uses hardware/);
});

test('requests reflection separately and identifies the documented model', () => {
  assert.match(buildSharedAnalysisPrompt(measurement, true), /3–5 substantial personalized paragraphs/);
  assert.equal(FREQUENCY_EXPLANATION_MODEL, 'gemini-3.8-flash');
});

test('asks for an in-depth, five-lens report and includes only context the user chose to share', () => {
  const prompt = buildSharedAnalysisPrompt(
    measurement,
    true,
    'A steady tone appeared after sunset; explore the pattern and its meaning.',
  );

  assert.match(prompt, /1,800–2,400 words/);
  assert.match(prompt, /acoustics, signal processing, mathematics\/statistics, communications, and environmental\/bioacoustics/);
  assert.match(prompt, /supporting evidence, evidence against or missing/);
  assert.match(prompt, /A steady tone appeared after sunset/);
  assert.match(prompt, /Do not dismiss or argue against the user’s stated belief/);
  assert.match(prompt, /never demean, rank, proselytize, pressure, or stereotype a faith tradition/i);
  assert.match(prompt, /Attribute beliefs the user explicitly shares to the user/);
  assert.match(prompt, /confidenceScope must explicitly limit confidence to the measured pattern or data quality/);
  assert.match(prompt, /do not infer the user’s religion/);
  assert.match(prompt, /Never substitute a verse for the personalized reading/);
  assert.match(prompt, /Frequency analysis is the primary purpose/);
  assert.match(prompt, /Write faithReflection as 3–5 substantial personalized paragraphs/);
  assert.match(prompt, /future dedicated frequency receiver/);
  assert.match(prompt, /bird vocalization or chorus, amphibian chorus, walrus haulout vocalization/);
  assert.match(prompt, /class precision and recall are unknown/);
  assert.match(prompt, /explicitly labeled as an unverified hypothesis in the same sentence, with low confidence/);
  assert.match(prompt, /electromagnetism, wave physics, quantum physics/);
  assert.match(prompt, /Shona spiritual traditions, comparative religion/);
  assert.match(prompt, /if context identifies synthetic, test, or QA data, describe it as synthetic throughout/);
  assert.match(prompt, /Peak-to-median contrast is not SNR/);
  assert.match(prompt, /Correlations and principal-variance shares describe co-variation/);
  assert.match(prompt, /Do not claim absence of aliasing, modulation, or encoded data/);
  assert.match(prompt, /RMS is relative digital amplitude, not measured air pressure or loudness/);
  assert.match(prompt, /440\.625 Hz doubled is 881\.25 Hz/);
  assert.match(prompt, /Never repeat internal genesis-seed text, creator attribution, or project-owner details/);
  assert.match(prompt, /Do not invent or overstate cultural or religious doctrines/);
  assert.equal(MAX_ANALYSIS_OUTPUT_TOKENS, 8192);
});

test('identifies microphone versus imported audio as the frequency measurement source', () => {
  assert.match(buildSharedAnalysisPrompt(measurement, false), /user-authorized microphone capture/);
  assert.match(buildSharedAnalysisPrompt({
    ...measurement,
    captureSource: 'audio-file',
  }, false), /locally decoded audio file/);
});

test('bounds optional listening context before it is sent to the AI service', () => {
  assert.equal(analysisContextSchema.safeParse('  ').success, true);
  assert.equal(
    analysisContextSchema.safeParse('x'.repeat(MAX_LISTENING_CONTEXT_CHARS)).success,
    true,
  );
  assert.equal(
    analysisContextSchema.safeParse('x'.repeat(MAX_LISTENING_CONTEXT_CHARS + 1)).success,
    false,
  );
  assert.throws(() => buildSharedAnalysisPrompt(
    measurement,
    false,
    'x'.repeat(MAX_LISTENING_CONTEXT_CHARS + 1),
  ));
});

test('validates the complete long-form interpretation report structure', () => {
  const domainPerspectives = [
    'acoustics',
    'signal_processing',
    'mathematics',
    'communications',
    'environmental_bioacoustics',
  ].map(domain => ({
    domain,
    relevance: 'tentative',
    analysis: `Analysis for ${domain}`,
    evidenceBoundary: 'The report uses derived microphone features only.',
  }));
  const report = {
    signalFamily: 'harmonic',
    executiveSummary: 'A stable tone with a visible harmonic relationship.',
    integratedReading: 'A detailed integrated reading of the supplied features.',
    patternSignature: 'Stable harmonic pattern.',
    harmonicAnalysis: 'The second peak is near twice the dominant peak.',
    temporalAnalysis: 'The dominant frequency remains stable over the observation window.',
    modulationAnalysis: 'No clear modulation can be established from these summary values.',
    domainPerspectives,
    keyTakeaways: ['Stable dominant peak', 'Harmonic candidate', 'Source is unresolved'],
    confidence: 'moderate',
    confidenceScope: 'Confidence applies to the pattern description only.',
    uncertainty: 'The source and any message content remain unknown.',
    dataQuality: 'The report is based on derived measurements, not raw audio.',
    candidateExplanations: [{
      label: 'A tonal environmental sound',
      rationale: 'The stable frequency and related peak fit a tonal pattern.',
      evidenceFor: 'High harmonicity and low drift.',
      evidenceAgainst: 'No raw audio or source context.',
      confidence: 'low',
      whatWouldDiscriminate: 'Compare a recording against controlled reference sources.',
    }],
    followUpExperiments: [
      {
        title: 'Repeat in a quiet setting',
        method: 'Capture three equal-duration samples from the same position.',
        whatToRecord: 'Dominant frequency and peak stability for each sample.',
      },
      {
        title: 'Compare microphone positions',
        method: 'Repeat the measurement at two documented distances.',
        whatToRecord: 'Peak amplitude pattern and frequency drift.',
      },
    ],
    reflectionQuestions: [
      'What first drew your attention to this sound?',
      'What personal meaning do you choose to explore?',
    ],
    faithReflection: [
      'The measured pattern begins with the observed dominant tone and its related peak; that is the signal detail available for reflection.',
      'The context you chose makes a particular spiritual perspective relevant, while another tradition may offer a different language for the same personal question.',
      'A possible meaning can be explored without treating the frequency as proof of a divine sender; you decide what resonates and what deserves further reflection.',
    ].join('\n\n'),
  };

  assert.equal(explanationSchema.safeParse(report).success, true);
  assert.equal(sharedExplanationSchema.safeParse(report).success, true);
  const quotedReflection = `${report.faithReflection}\n\nOptional sacred-text echo: “A short text quotation.” — Example tradition, text 1:2`;
  const reflectionParts = splitFaithReflection(quotedReflection);
  assert.equal(reflectionParts.paragraphs.length, 3);
  assert.match(reflectionParts.sacredTextEcho ?? '', /Example tradition, text 1:2/);
  assert.equal(explanationSchema.safeParse({
    ...report,
    faithReflection: 'First paragraph.\n\nSecond paragraph.',
  }).success, false);
  assert.equal(sharedExplanationSchema.safeParse({
    ...report,
    faithReflection: 'First paragraph.\n\nSecond paragraph.',
  }).success, false);
  assert.equal(explanationSchema.safeParse({
    ...report,
    domainPerspectives: domainPerspectives.slice(0, 4),
  }).success, false);
});

test('quota and Firebase permission failures have specific user-facing guidance', () => {
  assert.match(getAnalysisErrorMessage({ code: 'functions/resource-exhausted' }), /quota/i);
  assert.match(getAnalysisErrorMessage({ code: 'functions/permission-denied' }), /signed in|permitted/i);
});
