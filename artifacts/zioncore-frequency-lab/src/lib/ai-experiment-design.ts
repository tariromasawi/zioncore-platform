import { z } from 'zod';
import { researchGridRegistry } from '@/lib/research-grid';

export const EXPERIMENT_DESIGN_METHOD_ID = 'bounded-acoustic-experiment-design';
export const EXPERIMENT_DESIGN_METHOD_VERSION = '1.0.0';
export const EXPERIMENT_DESIGN_PROMPT_VERSION = '1.0.0';
export const EXPERIMENT_DESIGN_MAX_OUTPUT_TOKENS = 600;
export const EXPERIMENT_DESIGN_MAX_OBSERVATIONS = 8;
export const EXPERIMENT_DESIGN_BACKEND_READY = false;
export const EXPERIMENT_DESIGN_UNAVAILABLE_MESSAGE =
  'AI experiment proposals are paused until an authenticated, cost-quoted backend route is available. Selected measurements remain local.';

export const experimentDesignObservationSchema = z.object({
  sampleRate: z.number().int().min(8_000).max(192_000),
  fftSize: z.union([z.literal(2048), z.literal(4096), z.literal(8192)]),
  frequencyResolutionHz: z.number().positive().finite(),
  dominantFrequencyHz: z.number().positive().finite().nullable(),
  topPeaksHz: z.array(z.number().positive().finite()).max(6),
  rmsLevel: z.number().min(0).max(1),
  durationSeconds: z.number().finite().min(0).max(86_400),
}).strict();

const experimentDesignInputSchema = z.object({
  researchQuestion: z.string().trim().min(8).max(300),
  domain: z.string().min(1).max(80),
  observations: z.array(experimentDesignObservationSchema).min(1).max(EXPERIMENT_DESIGN_MAX_OBSERVATIONS),
}).strict();

export const experimentDesignProposalSchema = z.object({
  title: z.string().min(1).max(120),
  testableQuestion: z.string().min(1).max(300),
  falsifiableHypothesis: z.string().min(1).max(400),
  rationale: z.string().min(1).max(600),
  protocolSteps: z.array(z.string().min(1).max(320)).min(3).max(7),
  controlConditions: z.array(z.string().min(1).max(240)).min(1).max(4),
  measuredOutcomes: z.array(z.string().min(1).max(240)).min(1).max(5),
  decisionRule: z.string().min(1).max(320),
  safeguards: z.array(z.string().min(1).max(240)).min(1).max(4),
  limitations: z.array(z.string().min(1).max(320)).min(2).max(6),
}).strict();

export type ExperimentDesignInput = z.input<typeof experimentDesignInputSchema>;
export type ExperimentDesignProposal = z.infer<typeof experimentDesignProposalSchema>;
export type ExperimentDesignRequester = (request: {
  prompt: string;
  maxOutputTokens: number;
  route: 'experiment-design';
}) => Promise<{ text: string; modelId: string; roundTripMs: number }>;

export type ExperimentDesignRecord = {
  schemaVersion: 1;
  status: 'ai-proposal-not-discovery';
  methodId: typeof EXPERIMENT_DESIGN_METHOD_ID;
  methodVersion: typeof EXPERIMENT_DESIGN_METHOD_VERSION;
  promptVersion: typeof EXPERIMENT_DESIGN_PROMPT_VERSION;
  sourceSessionId: string;
  sourceObservationCount: number;
  domain: string;
  researchQuestion: string;
  modelId: string;
  generatedAt: string;
  clientRoundTripMs: number;
  proposal: ExperimentDesignProposal;
};

export function buildExperimentDesignPrompt(input: ExperimentDesignInput, consentToSend: boolean) {
  if (!consentToSend) {
    throw new Error('Approve sending the selected measurement summaries before requesting an experiment proposal.');
  }
  const validated = experimentDesignInputSchema.parse(input);
  const domain = researchGridRegistry.getDomain(validated.domain);
  if (!domain) throw new Error('Choose a registered research domain before designing an experiment.');
  return [
    `Method ${EXPERIMENT_DESIGN_METHOD_ID} v${EXPERIMENT_DESIGN_METHOD_VERSION}; prompt v${EXPERIMENT_DESIGN_PROMPT_VERSION}.`,
    'You propose bounded acoustic experiments from user-selected measurements. Your output is a plan to test, never a finding or discovery.',
    'Use only the question, registered domain, and structured measurement summaries supplied. Do not infer a source, intention, communication, spiritual meaning, or external response from these values.',
    'Make the hypothesis falsifiable, include repeatable baseline and control conditions, define measurable outcomes and a decision rule, and explain limitations.',
    'Do not start capture, play audio, transmit signals, activate hardware, or charge for processing. If a plan could affect people, animals, or the environment, require suitable consent, welfare safeguards, permissions, and a stop condition.',
    'Do not ask for or infer names, precise locations, identities, family details, or private reflections. No raw recordings, notes, messages, dates, or account identifiers are included.',
    'Return exactly one JSON object with keys: title, testableQuestion, falsifiableHypothesis, rationale, protocolSteps (3-7 items), controlConditions (1-4), measuredOutcomes (1-5), decisionRule, safeguards (1-4), limitations (2-6).',
    `Research question: ${validated.researchQuestion}`,
    `Registered research domain: ${domain.label} (${domain.id}). ${domain.description}`,
    `Selected measurement summaries: ${JSON.stringify(validated.observations)}`,
  ].join('\n');
}

export async function createExperimentDesign(
  input: ExperimentDesignInput,
  options: {
    consentToSend: boolean;
    sourceSessionId: string;
    requestModel?: ExperimentDesignRequester;
  },
): Promise<ExperimentDesignRecord> {
  if (!options.consentToSend) {
    throw new Error('Approve sending the selected measurement summaries before requesting an experiment proposal.');
  }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(options.sourceSessionId)) {
    throw new Error('A valid local research session is required.');
  }
  const prompt = buildExperimentDesignPrompt(input, options.consentToSend);
  if (!options.requestModel) {
    throw new Error(EXPERIMENT_DESIGN_UNAVAILABLE_MESSAGE);
  }
  const response = await options.requestModel({
    prompt,
    maxOutputTokens: EXPERIMENT_DESIGN_MAX_OUTPUT_TOKENS,
    route: 'experiment-design',
  });
  let proposal: ExperimentDesignProposal;
  try {
    proposal = experimentDesignProposalSchema.parse(JSON.parse(response.text));
  } catch {
    throw new Error('The AI service returned an invalid experiment proposal. No discovery was recorded.');
  }
  const validated = experimentDesignInputSchema.parse(input);
  return {
    schemaVersion: 1,
    status: 'ai-proposal-not-discovery',
    methodId: EXPERIMENT_DESIGN_METHOD_ID,
    methodVersion: EXPERIMENT_DESIGN_METHOD_VERSION,
    promptVersion: EXPERIMENT_DESIGN_PROMPT_VERSION,
    sourceSessionId: options.sourceSessionId,
    sourceObservationCount: validated.observations.length,
    domain: validated.domain,
    researchQuestion: validated.researchQuestion,
    modelId: response.modelId,
    generatedAt: new Date().toISOString(),
    clientRoundTripMs: response.roundTripMs,
    proposal,
  };
}
