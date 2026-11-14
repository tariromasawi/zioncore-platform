export class RequestDeadlineError extends Error {
  constructor() {
    super('The service did not respond before the request deadline.');
    this.name = 'RequestDeadlineError';
  }
}

/** The deadline covers both response headers and the entire JSON body. */
export async function fetchJsonWithDeadline(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetcher: typeof fetch = fetch,
): Promise<{ response: Response; body: unknown }> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('A finite positive request deadline is required.');
  const controller = new AbortController();
  const externalSignal = init.signal;
  externalSignal?.throwIfAborted();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onAbort = () => controller.abort(externalSignal?.reason);
  externalSignal?.addEventListener('abort', onAbort, { once: true });
  let rejectAbort: ((reason: unknown) => void) | undefined;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const onInternalAbort = () => rejectAbort?.(controller.signal.reason);
  controller.signal.addEventListener('abort', onInternalAbort, { once: true });
  timer = setTimeout(() => controller.abort(new RequestDeadlineError()), timeoutMs);
  try {
    const operation = (async () => {
      const response = await fetcher(url, { ...init, signal: controller.signal });
      let body: unknown;
      try {
        body = await response.json();
      } catch (cause) {
        if (controller.signal.aborted) throw controller.signal.reason ?? cause;
        body = null;
      }
      return { response, body };
    })();
    // Also bounds body readers that fail to honour AbortSignal.
    return await Promise.race([operation, aborted]);
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onAbort);
    controller.signal.removeEventListener('abort', onInternalAbort);
  }
}
