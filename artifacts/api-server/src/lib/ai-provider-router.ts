export type AIProvider = 'gemini' | 'openai';

export type ProviderUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
};

export type ProviderOutput = {
  text: string;
  model: string;
  usage?: ProviderUsage;
};

export type ProviderCalls = Record<AIProvider, () => Promise<ProviderOutput>>;

export type ProviderAttempt = {
  provider: AIProvider;
  model: string;
  usage: ProviderUsage | null;
};

export type RoutedInterpretation<T> = {
  analysis: T;
  provider: AIProvider;
  model: string;
  fallbackUsed: boolean;
  usage?: ProviderUsage;
  attempts: ProviderAttempt[];
};

export class AIProvidersUnavailableError extends Error {
  constructor(readonly attempts: ProviderAttempt[] = []) {
    super('Neither AI provider returned a valid interpretation.');
    this.name = 'AIProvidersUnavailableError';
  }
}

export function shouldFailOver(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as Record<string, unknown>;
  const response = record.response && typeof record.response === 'object'
    ? record.response as Record<string, unknown>
    : null;
  const statusValue = record.status ?? record.statusCode ?? response?.status;
  const status = typeof statusValue === 'number' ? statusValue : Number(statusValue);

  if (Number.isFinite(status)) {
    return status === 401 || status === 403 || status === 408 || status === 429 || status >= 500;
  }

  const code = String(record.code ?? '').toUpperCase();
  const name = String(record.name ?? '').toLowerCase();
  const message = String(record.message ?? '');
  return [
    'ECONNRESET',
    'ETIMEDOUT',
    'EAI_AGAIN',
    'ENOTFOUND',
    'ECONNREFUSED',
    'UND_ERR_CONNECT_TIMEOUT',
  ].includes(code) ||
    name.includes('timeout') ||
    name.includes('connection') ||
    /AI_INTEGRATIONS_(GEMINI|OPENAI)_(BASE_URL|API_KEY) must be set/i.test(message);
}

export async function runWithGeminiOpenAIFallback<T>(
  providers: ProviderCalls,
  validate: (text: string) => T,
): Promise<RoutedInterpretation<T>> {
  const attempts: ProviderAttempt[] = [];
  try {
    const primary = await providers.gemini();
    attempts.push({
      provider: 'gemini',
      model: primary.model,
      usage: primary.usage ?? null,
    });
    try {
      return {
        analysis: validate(primary.text),
        provider: 'gemini',
        model: primary.model,
        fallbackUsed: false,
        usage: primary.usage,
        attempts,
      };
    } catch {
      // Malformed or schema-invalid output is a provider failure; make one bounded fallback call.
    }
  } catch (error) {
    if (!shouldFailOver(error)) throw error;
  }

  try {
    const fallback = await providers.openai();
    attempts.push({
      provider: 'openai',
      model: fallback.model,
      usage: fallback.usage ?? null,
    });
    return {
      analysis: validate(fallback.text),
      provider: 'openai',
      model: fallback.model,
      fallbackUsed: true,
      usage: fallback.usage,
      attempts,
    };
  } catch {
    throw new AIProvidersUnavailableError(attempts);
  }
}
