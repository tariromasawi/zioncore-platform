export function isChunkLoadError(error: Error): boolean {
  return /chunkloaderror/i.test(error.name)
    || /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|unable to preload css|loading (?:css )?chunk .+ failed/i.test(error.message);
}
