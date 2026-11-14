import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildExperimentDesignPrompt,
  createExperimentDesign,
  EXPERIMENT_DESIGN_MAX_OBSERVATIONS,
  experimentDesignProposalSchema,
} from '@/lib/ai-experiment-design';
import type { AnalysisMeasurement } from '@/lib/ai-analysis';

const observation: AnalysisMeasurement = {
  sampleRate: 48000,
  fftSize: 4096,
  frequencyResolutionHz: 48000 / 4096,
  dominantFrequencyHz: 440.625,
  topPeaksHz: [440.625, 880.5],
  rmsLevel: 0.12,
  durationSeconds: 8.4,
};

const input = {
  researchQuestion: 'Does the peak repeat in a second controlled observation?',
  domain: 'celestial-exploration',
  observations: [observation],
};

test('experiment-design prompt requires explicit consent and a registered domain', () => {
  assert.throws(() => buildExperimentDesignPrompt(input, false), /Approve sending/);
  assert.throws(() => buildExperimentDesignPrompt({ ...input, domain: 'unknown-domain' }, true), /registered research domain/);
  assert.match(buildExperimentDesignPrompt(input, true), /never a finding or discovery/);
});

test('experiment design sends bounded measurements without session, message, notes, or identity data', () => {
  const prompt = buildExperimentDesignPrompt(input, true);
  assert.match(prompt, /sampleRate/);
  assert.match(prompt, /dominantFrequencyHz/);
  assert.doesNotMatch(prompt, /PRIVATE_SESSION_42|PRIVATE_MESSAGE_42|PRIVATE_NOTES_42|PRIVATE_ACCOUNT_42/);
  assert.throws(() => buildExperimentDesignPrompt({
    ...input,
    observations: Array.from({ length: EXPERIMENT_DESIGN_MAX_OBSERVATIONS + 1 }, () => observation),
  }, true), /too big|at most/i);
  assert.throws(() => buildExperimentDesignPrompt({
    ...input,
    observations: [{ ...observation, notes: 'must not be sent' }] as unknown as AnalysisMeasurement[],
  }, true), /Unrecognized key/);
});

test('proposal contract requires a falsifiable, controlled, bounded plan', () => {
  const proposal = {
    title: 'Repeat the spectral observation',
    testableQuestion: 'Does the peak recur under the same capture settings?',
    falsifiableHypothesis: 'The measured peak appears in at least two of three repeated captures.',
    rationale: 'The selected measurements contain a reported peak but no repeated baseline.',
    protocolSteps: ['Record a baseline.', 'Repeat three captures.', 'Compare the measured peaks.'],
    controlConditions: ['Use the same capture settings and quiet location.'],
    measuredOutcomes: ['Peak frequency and recurrence count.'],
    decisionRule: 'Call the hypothesis not observed if the peak is absent from all repeats.',
    safeguards: ['Stop capture if the participant withdraws consent.'],
    limitations: ['This test cannot identify a source.', 'The microphone is not calibrated.'],
  };
  assert.equal(experimentDesignProposalSchema.safeParse(proposal).success, true);
  assert.equal(experimentDesignProposalSchema.safeParse({
    ...proposal,
    protocolSteps: ['Only one step'],
  }).success, false);
});

test('proposal generation refuses absent consent before any cloud request', async () => {
  await assert.rejects(
    createExperimentDesign(input, { consentToSend: false, sourceSessionId: 'session-1' }),
    /Approve sending/,
  );
});

test('proposal generation fails explicitly without an injected cost-guarded backend', async () => {
  await assert.rejects(
    createExperimentDesign(input, {
      consentToSend: true,
      sourceSessionId: 'session-1',
    }),
    /paused until an authenticated, cost-quoted backend/,
  );
});

test('an injected backend receives only consented, bounded proposal inputs', async () => {
  let requestData: { prompt: string; maxOutputTokens: number; route: 'experiment-design' } | null = null;
  const response = {
    title: 'Repeat the spectral observation',
    testableQuestion: 'Does the measured peak recur?',
    falsifiableHypothesis: 'The peak recurs in two of three controlled recordings.',
    rationale: 'The current record is not replicated.',
    protocolSteps: ['Record a baseline.', 'Repeat three captures.', 'Compare peak summaries.'],
    controlConditions: ['Keep capture settings unchanged.'],
    measuredOutcomes: ['Peak frequency and recurrence count.'],
    decisionRule: 'Treat the hypothesis as not observed if the peak is absent in all repeats.',
    safeguards: ['Stop when consent is withdrawn.'],
    limitations: ['The recording does not identify a source.', 'The sensor is not calibrated.'],
  };
  const result = await createExperimentDesign(input, {
    consentToSend: true,
    sourceSessionId: 'session-1',
    requestModel: async request => {
      requestData = request;
      return { text: JSON.stringify(response), modelId: 'verified-test-model', roundTripMs: 12 };
    },
  });
  assert.equal(requestData?.route, 'experiment-design');
  assert.equal(requestData?.maxOutputTokens, 600);
  assert.equal(result.modelId, 'verified-test-model');
  assert.equal(result.status, 'ai-proposal-not-discovery');
  assert.equal(result.clientRoundTripMs, 12);
});
