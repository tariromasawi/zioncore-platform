import type { ImportedAudioAnalysis } from './audio-file-analysis';
import type { AudioAnalysisReply } from './audio-analysis-task';

export function analyzeAudioOffThread(
  channels: Float32Array[],
  sampleRate: number,
  fftSize: number,
  signal?: AbortSignal,
): Promise<ImportedAudioAnalysis> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    if (typeof Worker === 'undefined') {
      reject(new Error('Local file analysis needs background-worker support. Try a recent browser.'));
      return;
    }
    let worker: Worker | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      if (worker) {
        worker.onmessage = null;
        worker.onerror = null;
        worker.onmessageerror = null;
        worker.terminate();
      }
    };
    const fail = (cause: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(cause);
    };
    const onAbort = () => fail(signal?.reason ?? new DOMException('Analysis cancelled.', 'AbortError'));
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      worker = new Worker(new URL('./audio-analysis.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<AudioAnalysisReply>) => {
        if (settled) return;
        const data = event.data;
        if (!data || typeof data !== 'object' || typeof data.ok !== 'boolean'
          || (data.ok ? !data.result || typeof data.result !== 'object' : typeof data.error !== 'string')) {
          fail(new Error('The background audio result could not be read.'));
          return;
        }
        settled = true;
        cleanup();
        if (data.ok) resolve(data.result);
        else reject(new Error(data.error));
      };
      worker.onerror = () => fail(new Error('Background audio analysis failed. Try importing the file again.'));
      worker.onmessageerror = () => fail(new Error('The background audio result could not be read.'));
      timeout = setTimeout(() => {
        fail(new Error('Local audio analysis took too long. Try a shorter recording.'));
      }, 30_000);
      // Copies own their buffers: transferring them cannot detach AudioBuffer data.
      const copies = channels.map(channel => new Float32Array(channel));
      worker.postMessage({ channels: copies, sampleRate, fftSize }, copies.map(channel => channel.buffer));
    } catch (cause) {
      fail(cause instanceof Error ? cause : new Error('Background audio analysis could not start.'));
    }
  });
}
