import type { EventEmitter } from 'node:events';
import type { Readable } from 'node:stream';

/** Asset routes accept named entries only, never inherited object properties. */
export function ownPublicAsset<T extends object>(assets: T, id: string): T[keyof T] | undefined {
  return Object.hasOwn(assets, id) ? assets[id as keyof T] : undefined;
}

/** Stop upstream storage I/O when the visitor leaves or cancels playback. */
export function stopAssetOnDisconnect(
  source: Readable,
  response: EventEmitter & { readonly destroyed: boolean },
  options: { waitForStorageResponse?: boolean } = {},
) {
  if (source.destroyed) return;
  let ready = !options.waitForStorageResponse;
  let cancelled = response.destroyed;
  let readyTask: ReturnType<typeof setImmediate> | undefined;
  const onStorageResponse = () => {
    // GCS emits "response" BEFORE constructing its pipeline. Destroying the
    // output during that callback can throw outside its error handler.
    readyTask = setImmediate(() => {
      ready = true;
      if (cancelled && !source.destroyed) source.destroy();
    });
  };
  const onDisconnect = () => {
    cancelled = true;
    if (ready) source.destroy();
  };
  const onSourceClose = () => {
    response.off('close', onDisconnect);
    source.off('response', onStorageResponse);
    if (readyTask) clearImmediate(readyTask);
  };
  if (!ready) source.once('response', onStorageResponse);
  response.once('close', onDisconnect);
  source.once('close', onSourceClose);
  if (cancelled) onDisconnect();
}
