export type StartupChunk = {
  type: 'chunk';
  fileName: string;
  isEntry: boolean;
  imports: string[];
  code: string;
  modules: Record<string, { renderedLength: number }>;
};

type StartupBundle = Record<string, StartupChunk | { type: 'asset' }>;

/** Only entrypoints and static dependencies are required for initial startup. */
export function collectStartupChunks(bundle: StartupBundle): StartupChunk[] {
  const pending = Object.values(bundle)
    .filter((item): item is StartupChunk => item.type === 'chunk' && item.isEntry)
    .map(item => item.fileName);
  const visited = new Set<string>();
  const chunks: StartupChunk[] = [];
  while (pending.length) {
    const fileName = pending.pop()!;
    if (visited.has(fileName)) continue;
    visited.add(fileName);
    const item = bundle[fileName];
    if (!item || item.type !== 'chunk') continue;
    chunks.push(item);
    pending.push(...item.imports);
  }
  return chunks;
}

export function assertNoStartupGenesis(chunks: StartupChunk[]): void {
  for (const chunk of chunks) {
    for (const [id, module] of Object.entries(chunk.modules)) {
      if (id.replaceAll('\\', '/').includes('/frequency-ai-contract/src/genesis-seed.ts')
        && module.renderedLength > 0) {
        throw new Error('Server Genesis knowledge entered the initial browser bundle. Restore lazy server-only initialization before publishing.');
      }
    }
  }
}

export function assertStartupBudget(gzipBytes: number, maxGzipBytes = 200_000): void {
  if (!Number.isFinite(gzipBytes) || gzipBytes < 0 || !Number.isFinite(maxGzipBytes) || maxGzipBytes <= 0) {
    throw new Error('Startup JavaScript budget values must be finite positive byte counts.');
  }
  if (gzipBytes > maxGzipBytes) {
    throw new Error(`Initial JavaScript exceeds the ${maxGzipBytes}-byte gzip budget (${gzipBytes} bytes).`);
  }
}
