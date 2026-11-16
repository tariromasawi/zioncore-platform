import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AiInterpretationQualityError,
  assertAiInterpretationQuality,
  assertBioacousticClaimsAreQualified,
} from './ai-interpretation-quality';
import { runWithGeminiOpenAIFallback } from './ai-provider-router';
import { reconcileFailedReservation } from './paid-reservation-recovery';

const measurement = {
  dominantFrequencyHz: 440,
  topPeaksHz: [440, 880],
  frequencyResolutionHz: 48000 / 4096,
};

test('unverified animal and environmental labels cannot be presented as established classifications', () => {
  const unqualifiedClaims = [
    'This recording is an owl call.',
    'The recording contains rain and traffic.',
    'The audio has been identified as a bird species.',
    'Birds are chirping in the distance.',
    'Rain is falling against the window.',
  ];

  for (const claim of unqualifiedClaims) {
    assert.throws(
      () => assertBioacousticClaimsAreQualified(claim),
      error => error instanceof AiInterpretationQualityError &&
        error.codes.includes('UNVALIDATED_BIOACOUSTIC_CLASSIFICATION'),
      claim,
    );
  }

  const tentativeHypothesis =
    'The sound could be consistent with an owl-like call, but no labeled reference recording was supplied and the species remains unverified.';
  assert.doesNotThrow(() => assertBioacousticClaimsAreQualified(tentativeHypothesis));
});

test('animal intent and behavior are not asserted without an explicit uncertainty boundary', () => {
  for (const claim of [
    'The bird is warning you of danger.',
    'The animals are migrating through this recording.',
    'A message from the animal says you should leave.',
  ]) {
    assert.throws(
      () => assertBioacousticClaimsAreQualified(claim),
      error => error instanceof AiInterpretationQualityError &&
        error.codes.includes('UNSUPPORTED_ANIMAL_INTENT'),
      claim,
    );
  }

  assert.doesNotThrow(() => assertBioacousticClaimsAreQualified(
    'A repeating call-like pattern could be an animal vocalization, but its source and behavior are unverified.',
  ));
});

test('candidate source labels themselves carry a hypothesis label and low confidence', () => {
  assert.throws(
    () => assertBioacousticClaimsAreQualified({
      candidateExplanations: [{
        label: 'Owl call',
        rationale: 'The pattern may resemble a bird call.',
        confidence: 'low',
      }],
    }),
    error => error instanceof AiInterpretationQualityError &&
      error.codes.includes('UNVALIDATED_BIOACOUSTIC_CLASSIFICATION'),
  );
  assert.throws(
    () => assertBioacousticClaimsAreQualified({
      candidateExplanations: [{
        label: 'Possible owl-call hypothesis',
        rationale: 'The source is unverified.',
        confidence: 'moderate',
      }],
    }),
    error => error instanceof AiInterpretationQualityError &&
      error.codes.includes('UNVALIDATED_BIOACOUSTIC_CLASSIFICATION'),
  );
  assert.doesNotThrow(() => assertBioacousticClaimsAreQualified({
    candidateExplanations: [{
      label: 'Possible owl-call hypothesis (unverified)',
      rationale: 'A call-like pattern is compatible with this possibility, but no reference match was made.',
      confidence: 'low',
    }],
  }));
});

test('bioacoustic overclaim guard has perfect precision and recall on its curated phrase regression set', () => {
  const cases = [
    { unsupportedClaim: true, text: 'This recording is an owl call.' },
    { unsupportedClaim: true, text: 'Birds are chirping in the distance.' },
    { unsupportedClaim: true, text: 'The audio has been identified as a walrus vocalization.' },
    { unsupportedClaim: true, text: 'The bird is warning you of danger.' },
    { unsupportedClaim: true, text: 'The sound is a geyser eruption.' },
    { unsupportedClaim: true, text: 'Rain is falling against the window.' },
    { unsupportedClaim: false, text: 'A call-like pattern could be a bird-vocalization hypothesis; the source is unverified.' },
    { unsupportedClaim: false, text: 'The recording may contain a thunder-like event; machinery or wind is also possible.' },
    { unsupportedClaim: false, text: 'A repeated pulse could resemble an amphibian-chorus candidate, but species and behavior are unknown.' },
    { unsupportedClaim: false, text: 'The imported WAV has a measured peak above 20 kHz; that does not identify an animal or weather source.' },
  ];
  let truePositive = 0;
  let falsePositive = 0;
  let trueNegative = 0;
  let falseNegative = 0;
  for (const item of cases) {
    let rejected = false;
    try {
      assertBioacousticClaimsAreQualified(item.text);
    } catch (error) {
      if (!(error instanceof AiInterpretationQualityError)) throw error;
      rejected = error.codes.includes('UNVALIDATED_BIOACOUSTIC_CLASSIFICATION')
        || error.codes.includes('UNSUPPORTED_ANIMAL_INTENT');
    }
    if (item.unsupportedClaim && rejected) truePositive += 1;
    else if (!item.unsupportedClaim && rejected) falsePositive += 1;
    else if (!item.unsupportedClaim) trueNegative += 1;
    else falseNegative += 1;
  }
  const precision = truePositive / (truePositive + falsePositive);
  const recall = truePositive / (truePositive + falseNegative);
  assert.equal(precision, 1);
  assert.equal(recall, 1);
  assert.equal(trueNegative, 4);
  assert.equal(cases.length, 10);
});

test('the complete interpretation quality gate rejects a definitive animal label', () => {
  assert.throws(
    () => assertAiInterpretationQuality(
      {
        executiveSummary: 'This signal is a raven call.',
        uncertainty: 'The source remains uncertain.',
      },
      measurement,
      '',
    ),
    error => error instanceof AiInterpretationQualityError &&
      error.codes.includes('UNVALIDATED_BIOACOUSTIC_CLASSIFICATION'),
  );
});

test('spiritual readings cannot assert a verified divine source, audio-based danger, or religious coercion', () => {
  const rejected = [
    {
      executiveSummary: 'This frequency is a message from God.',
    },
    {
      integratedReading: 'The sound proves dark energy is present.',
    },
    {
      faithReflection: 'You must abandon your religion to understand this signal.',
    },
    {
      confidenceScope: 'High confidence that this is a divine message.',
    },
  ];

  for (const report of rejected) {
    assert.throws(
      () => assertAiInterpretationQuality(report, measurement, ''),
      error => error instanceof AiInterpretationQualityError &&
        error.codes.some(code => [
          'UNVERIFIED_DIVINE_ATTRIBUTION',
          'CONFIDENCE_SCOPE_OVERCLAIM',
          'COERCIVE_OR_ALARMING_GUIDANCE',
        ].includes(code)),
      JSON.stringify(report),
    );
  }

  assert.doesNotThrow(() => assertAiInterpretationQuality({
    executiveSummary: 'The local measurements show a repeating tonal pattern.',
    confidenceScope: 'Confidence applies to the measured pattern; source and spiritual meaning remain unknown.',
    faithReflection: 'Within the spiritual perspective you chose, the repeated pattern may invite personal reflection. This is a possible meaning you may explore, not evidence that a divine source produced the sound.',
  }, measurement, 'I chose a spiritual reflection.'));
  assert.doesNotThrow(() => assertAiInterpretationQuality({
    executiveSummary: 'The recording is not a bird call, and the sound does not prove dark energy is present.',
    confidenceScope: 'Confidence applies to the measured pattern, not source identity or spiritual meaning.',
    faithReflection: 'You shared that God sent this tone, and ZionCore treats that as your personal belief rather than independently verified evidence.',
  }, measurement, 'I chose a spiritual reflection.'));
});

test('a semantic-quality failure triggers one provider fallback before a report is accepted', async () => {
  let fallbackCalls = 0;
  const result = await runWithGeminiOpenAIFallback({
    gemini: async () => ({
      text: JSON.stringify({ executiveSummary: 'This recording is a bird call.' }),
      model: 'gemini-quality-test',
    }),
    openai: async () => {
      fallbackCalls += 1;
      return {
        text: JSON.stringify({
          executiveSummary: 'The supplied measurements show a narrow tonal pattern; its source is unknown.',
        }),
        model: 'openai-quality-test',
      };
    },
  }, text => {
    const report = JSON.parse(text) as { executiveSummary: string };
    assertAiInterpretationQuality(report, measurement, '');
    return report;
  });

  assert.equal(result.provider, 'openai');
  assert.equal(result.fallbackUsed, true);
  assert.equal(fallbackCalls, 1);
});

test('when both providers fail quality checks, failed-job recovery releases rather than settles the hold', async () => {
  let releases = 0;
  let settlements = 0;
  await assert.rejects(runWithGeminiOpenAIFallback({
    gemini: async () => ({
      text: JSON.stringify({ executiveSummary: 'This signal is a raven call.' }),
      model: 'gemini-invalid-test',
    }),
    openai: async () => ({
      text: JSON.stringify({ executiveSummary: 'The bird is warning you of danger.' }),
      model: 'openai-invalid-test',
    }),
  }, text => {
    const report = JSON.parse(text) as { executiveSummary: string };
    assertAiInterpretationQuality(report, measurement, '');
    return report;
  }));

  const result = await reconcileFailedReservation({
    uid: 'phase16-test-user',
    operationId: 'phase16-test-reading',
    releaseIdempotencyKey: 'phase16-release',
    reservationAttempted: true,
    reservationHeld: true,
    generationSucceeded: false,
    lostLease: false,
    ledger: {
      async getReservationStatus() { return 'reserved'; },
      async releaseReservation() { releases += 1; },
    },
  });

  assert.equal(result.reservationHeld, false);
  assert.equal(releases, 1);
  assert.equal(settlements, 0);
});
