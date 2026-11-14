import type { File } from '@google-cloud/storage';
import { objectStorageClient } from './app-storage-client';

function getPublicObjectSearchPaths(): string[] {
  const paths = Array.from(
    new Set(
      (process.env.PUBLIC_OBJECT_SEARCH_PATHS || '')
        .split(',')
        .map(path => path.trim())
        .filter(Boolean),
    ),
  );
  if (paths.length === 0) {
    throw new Error('Public audio storage is not configured.');
  }
  return paths;
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const parts = normalizedPath.split('/');
  if (parts.length < 3 || !parts[1]) {
    throw new Error('The public object path is invalid.');
  }
  return {
    bucketName: parts[1],
    objectName: parts.slice(2).join('/'),
  };
}

export async function searchPublicAudioObject(filePath: string): Promise<File | null> {
  for (const searchPath of getPublicObjectSearchPaths()) {
    const { bucketName, objectName } = parseObjectPath(`${searchPath}/${filePath}`);
    const file = objectStorageClient.bucket(bucketName).file(objectName);
    const [exists] = await file.exists();
    if (exists) return file;
  }
  return null;
}
