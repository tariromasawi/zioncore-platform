import type { GoogleGenAI } from '@google/genai';
import type { ProviderOutput, ProviderUsage } from './ai-provider-router';
import { MAX_ANALYSIS_OUTPUT_TOKENS } from '@workspace/frequency-ai-contract';
import { appendProviderText, withProviderDeadline, PROVIDER_ATTEMPT_TIMEOUT_MS } from './provider-execution';

export const GEMINI_ANALYSIS_MODEL = 'gemini-3.8-flash';
export const GOOGLE_GENAI_ANALYSIS_MODEL = 'gemini-3-flash-preview';
export const OPENAI_ANALYSIS_MODEL = 'gpt-5.4-mini';
export const GEMINI_AUDIO_SEGMENT_MAX_OUTPUT_TOKENS = 256;

export type GeminiCredentialSource = 'google-api-key' | 'replit-integration' | 'unconfigured';

export function getGeminiCredentialSource(
  env: NodeJS.ProcessEnv = process.env,
): GeminiCredentialSource {
  if (env.GOOGLE_GENAI_API_KEY?.trim()) return 'google-api-key';
  if (
    env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim()
    && env.AI_INTEGRATIONS_GEMINI_BASE_URL?.trim()
  ) return 'replit-integration';
  return 'unconfigured';
}

export function isGeminiConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return getGeminiCredentialSource(env) !== 'unconfigured';
}

export function getGeminiAnalysisModel(env: NodeJS.ProcessEnv = process.env): string {
  return getGeminiCredentialSource(env) === 'google-api-key'
    ? GOOGLE_GENAI_ANALYSIS_MODEL
    : GEMINI_ANALYSIS_MODEL;
}

let geminiClientPromise: Promise<GoogleGenAI> | undefined;

async function getGeminiClient(): Promise<GoogleGenAI> {
  if (!geminiClientPromise) {
    const credentialSource = getGeminiCredentialSource();
    if (credentialSource === 'google-api-key') {
      const apiKey = process.env.GOOGLE_GENAI_API_KEY!.trim();
      geminiClientPromise = import('@google/genai')
        .then(({ GoogleGenAI: Client }) => new Client({ apiKey }));
    } else if (credentialSource === 'replit-integration') {
      geminiClientPromise = import('@workspace/integrations-gemini-ai')
        .then(({ ai }) => ai);
    } else {
      throw new Error(
        'Configure GOOGLE_GENAI_API_KEY or the Gemini AI integration before using Gemini.',
      );
    }
  }
  return geminiClientPromise;
}

const conservativeStandardRatesUsdPerMillionTokens: Record<
  string,
  { input: number; output: number }
> = {
  // Use Gemini's announced standard rate, not the lower introductory rate.
  [GEMINI_ANALYSIS_MODEL]: { input: 2, output: 10 },
  // Google lists Gemini 3 Flash Preview at $0.50 input / $3.00 output per 1M tokens.
  // https://ai.google.dev/gemini-api/docs/pricing#gemini-3-flash-preview
  [GOOGLE_GENAI_ANALYSIS_MODEL]: { input: 0.5, output: 3 },
  [OPENAI_ANALYSIS_MODEL]: { input: 0.75, output: 4.5 },
};

function normalizeTokenCount(value?: number): number | undefined {
  return Number.isSafeInteger(value) && value! >= 0 ? value : undefined;
}

function normalizeUsage(inputTokens?: number, outputTokens?: number): ProviderUsage {
  return {
    inputTokens: normalizeTokenCount(inputTokens) ?? null,
    outputTokens: normalizeTokenCount(outputTokens) ?? null,
  };
}

export function normalizeGeminiUsage(metadata?: {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
}): ProviderUsage {
  const inputTokens = normalizeTokenCount(metadata?.promptTokenCount);
  const candidatesTokens = normalizeTokenCount(metadata?.candidatesTokenCount);
  const thoughtsTokens = normalizeTokenCount(metadata?.thoughtsTokenCount);
  const outputTokens =
    candidatesTokens === undefined && thoughtsTokens === undefined
      ? undefined
      : (candidatesTokens ?? 0) + (thoughtsTokens ?? 0);

  return {
    inputTokens: inputTokens ?? null,
    outputTokens: Number.isSafeInteger(outputTokens) ? outputTokens! : null,
  };
}

export function estimateProviderUsageMicroUsd(
  model: string,
  usage: ProviderUsage | null | undefined,
): number | null {
  const rates = conservativeStandardRatesUsdPerMillionTokens[model];
  if (
    !rates ||
    !usage ||
    typeof usage.inputTokens !== 'number' ||
    typeof usage.outputTokens !== 'number' ||
    !Number.isSafeInteger(usage.inputTokens) ||
    !Number.isSafeInteger(usage.outputTokens) ||
    usage.inputTokens < 0 ||
    usage.outputTokens < 0
  ) return null;

  const estimate = Math.ceil(
    usage.inputTokens * rates.input +
      usage.outputTokens * rates.output,
  );
  return Number.isSafeInteger(estimate) ? estimate : null;
}

export function estimateGeminiAudioUsageMicroUsd(
  model: string,
  usage?: ProviderUsage | null,
): number | null {
  if (
    model !== GOOGLE_GENAI_ANALYSIS_MODEL ||
    typeof usage?.inputTokens !== 'number' ||
    typeof usage.outputTokens !== 'number'
  ) return null;

  // Google lists Gemini 3 Flash Preview audio input at $1/1M tokens and output at $3/1M.
  // Price every input token at the higher audio rate (text input is cheaper) as a conservative estimate.
  const microUsd = usage.inputTokens + (usage.outputTokens * 3);
  return Number.isSafeInteger(microUsd) ? microUsd : null;
}

export async function generateWithGemini(
  prompt: string,
  timeoutMs = PROVIDER_ATTEMPT_TIMEOUT_MS,
): Promise<ProviderOutput> {
  return withProviderDeadline(async signal => {
    const ai = await getGeminiClient();
    const model = getGeminiAnalysisModel();
    const stream = await ai.models.generateContentStream({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        abortSignal: signal,
        maxOutputTokens: MAX_ANALYSIS_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
      },
    });

    let text = '';
    let usage: ProviderUsage | undefined;
    for await (const chunk of stream) {
      text = appendProviderText(text, chunk.text ?? '');
      if (chunk.usageMetadata) usage = normalizeGeminiUsage(chunk.usageMetadata);
    }

    return {
      text,
      model,
      usage: usage ?? normalizeGeminiUsage(),
    };
  }, timeoutMs);
}

export async function generateWithGeminiAudioSegment(
  prompt: string,
  audioBase64: string,
  timeoutMs = 12_000,
): Promise<ProviderOutput> {
  return withProviderDeadline(async signal => {
    if (getGeminiCredentialSource() !== 'google-api-key') {
      throw new Error('Direct audio review requires the configured Google GenAI API key.');
    }
    const ai = await getGeminiClient();
    const model = getGeminiAnalysisModel();
    const response = await ai.models.generateContent({
      model,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'audio/wav', data: audioBase64 } },
        ],
      }],
      config: {
        abortSignal: signal,
        maxOutputTokens: GEMINI_AUDIO_SEGMENT_MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
      },
    });
    return {
      text: response.text ?? '',
      model,
      usage: normalizeGeminiUsage(response.usageMetadata),
    };
  }, timeoutMs);
}

export async function generateWithOpenAI(
  prompt: string,
  timeoutMs = PROVIDER_ATTEMPT_TIMEOUT_MS,
): Promise<ProviderOutput> {
  return withProviderDeadline(async signal => {
    const { openai } = await import('@workspace/integrations-openai-ai-server');
    const stream = await openai.chat.completions.create({
      model: OPENAI_ANALYSIS_MODEL,
      max_completion_tokens: MAX_ANALYSIS_OUTPUT_TOKENS,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      stream_options: { include_usage: true },
    }, { signal, timeout: PROVIDER_ATTEMPT_TIMEOUT_MS, maxRetries: 0 });

    let text = '';
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (typeof content === 'string') text = appendProviderText(text, content);
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens;
        outputTokens = chunk.usage.completion_tokens;
      }
    }

    return {
      text,
      model: OPENAI_ANALYSIS_MODEL,
      usage: normalizeUsage(inputTokens, outputTokens),
    };
  }, timeoutMs);
}
