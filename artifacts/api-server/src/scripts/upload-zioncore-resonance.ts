import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { objectStorageClient } from '../lib/app-storage-client';

const filename = 'Simba_raMudzimu_Unoyera_Living_Vision_30s_1794100403373.wav';
const assetPath = `zioncore-resonance/${filename}`;

function parsePublicSearchPath(searchPath: string): { bucketName: string; prefix: string } {
  const normalized = searchPath.replace(/^gs:\/\//, '').replace(/^\/+/, '').replace(/\/+$/, '');
  const [bucketName, ...prefixParts] = normalized.split('/');
  if (!bucketName) throw new Error('PUBLIC_OBJECT_SEARCH_PATHS contains an invalid path.');
  return { bucketName, prefix: prefixParts.join('/') };
}

async function findAttachedAssetsDirectory(): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), 'attached_assets'),
    path.resolve(process.cwd(), '../../attached_assets'),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the other workspace-relative location.
    }
  }
  throw new Error('Could not locate attached_assets from the current working directory.');
}

async function main(): Promise<void> {
  const searchPath = (process.env.PUBLIC_OBJECT_SEARCH_PATHS ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)[0];
  if (!searchPath) throw new Error('PUBLIC_OBJECT_SEARCH_PATHS is not configured.');

  const { bucketName, prefix } = parsePublicSearchPath(searchPath);
  const assetDirectory = await findAttachedAssetsDirectory();
  const sourcePath = path.join(assetDirectory, filename);
  const sourceBytes = await readFile(sourcePath);
  const sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex');
  const objectName = [prefix, assetPath].filter(Boolean).join('/');
  const destination = objectStorageClient.bucket(bucketName).file(objectName);
  const [exists] = await destination.exists();

  if (exists) {
    const [metadata] = await destination.getMetadata();
    if (Number(metadata.size) === sourceBytes.byteLength) {
      const storedSha256 = metadata.metadata?.zioncoreSha256;
      let actualSha256 = storedSha256 ?? null;
      if (!actualSha256) {
        const [storedBytes] = await destination.download();
        actualSha256 = createHash('sha256').update(storedBytes).digest('hex');
      }
      if (actualSha256 === sourceSha256) {
        process.stdout.write('The original resonance recording is already present and SHA-256 verified.\n');
        return;
      }
    }
    throw new Error('A different object already uses this resonance path; refusing to replace it.');
  }

  const stream = destination.createWriteStream({
    resumable: false,
    preconditionOpts: { ifGenerationMatch: 0 },
    metadata: {
      contentType: 'audio/wav',
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: { zioncoreSha256: sourceSha256 },
    },
  });
  await pipeline(createReadStream(sourcePath), stream);

  const [metadata] = await destination.getMetadata();
  if (
    Number(metadata.size) !== sourceBytes.byteLength
    || metadata.metadata?.zioncoreSha256 !== sourceSha256
  ) {
    throw new Error('The stored resonance recording did not match the supplied original.');
  }
  process.stdout.write('Uploaded and SHA-256 verified the original resonance recording.\n');
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Resonance recording upload failed.'}\n`);
  process.exitCode = 1;
});
