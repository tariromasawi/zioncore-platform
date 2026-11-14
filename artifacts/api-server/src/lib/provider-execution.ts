export const PROVIDER_ATTEMPT_TIMEOUT_MS = 120_000;
export const MAX_PROVIDER_RESPONSE_CHARACTERS = 262_144;

export class ProviderTimeoutError extends Error {
  readonly code = 'ETIMEDOUT';
  constructor() {
    super('The interpretation provider exceeded its execution deadline.');
    this.name = 'ProviderTimeoutError';
  }
}

export class ProviderResponseLimitError extends Error {
  readonly status = 502;
  constructor() {
    super('The interpretation provider exceeded the response size budget.');
    this.name = 'ProviderResponseLimitError';
  }
}

/** Bounds the whole attempt, including obtaining and consuming its stream. */
export async function withProviderDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = PROVIDER_ATTEMPT_TIMEOUT_MS,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('A finite positive provider deadline is required.');
  const controller = new AbortController();
  const deadlineError = new ProviderTimeoutError();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort(deadlineError);
      reject(deadlineError);
    }, timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), deadline]);
  } catch (cause) {
    controller.abort(cause);
    throw timedOut ? deadlineError : cause;
  } finally {
    clearTimeout(timer);
  }
}

export function appendProviderText(current: string, chunk: string): string {
  if (current.length + chunk.length > MAX_PROVIDER_RESPONSE_CHARACTERS) {
    throw new ProviderResponseLimitError();
  }
  return current + chunk;
}
