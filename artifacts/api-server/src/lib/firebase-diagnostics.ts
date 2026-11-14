import type { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminCredentialEmail } from './firebase-admin';

const cleanupCollectionGroup = 'ai_interpretation_jobs';
const cleanupFieldPath = 'expiresAt';
const defaultDatabaseId = '(default)';
const permissionNames = {
  entitiesGet: 'datastore.entities.get',
  entitiesList: 'datastore.entities.list',
  entitiesCreate: 'datastore.entities.create',
  entitiesUpdate: 'datastore.entities.update',
  entitiesDelete: 'datastore.entities.delete',
  indexesList: 'datastore.indexes.list',
} as const;

export type CleanupQueryStatus =
  | 'pass'
  | 'permission_denied'
  | 'index_not_ready'
  | 'unavailable';

export type ExpiryIndexStatus = 'ready' | 'building' | 'missing' | 'unavailable';

export function classifyCleanupQueryError(error: unknown): CleanupQueryStatus {
  if (!error || typeof error !== 'object') return 'unavailable';
  const code = 'code' in error ? error.code : undefined;
  const message = 'message' in error && typeof error.message === 'string'
    ? error.message.toLowerCase()
    : '';
  if (code === 7 || code === 'permission-denied' || message.includes('permission_denied')) {
    return 'permission_denied';
  }
  if (code === 9 || code === 'failed-precondition' || message.includes('failed_precondition')) {
    return 'index_not_ready';
  }
  return 'unavailable';
}

export function classifyExpiryIndexConfig(value: unknown): ExpiryIndexStatus {
  if (!value || typeof value !== 'object') return 'missing';
  const indexConfig = 'indexConfig' in value ? value.indexConfig : undefined;
  const indexes = indexConfig && typeof indexConfig === 'object' && 'indexes' in indexConfig
    ? indexConfig.indexes
    : undefined;
  if (!Array.isArray(indexes)) return 'missing';

  const target = indexes.find(index => {
    if (!index || typeof index !== 'object' || !('fields' in index)) return false;
    const candidate = index as {
      queryScope?: unknown;
      fields?: Array<{ fieldPath?: unknown; order?: unknown }>;
    };
    return candidate.queryScope === 'COLLECTION_GROUP'
      && candidate.fields?.some(field =>
        field.fieldPath === cleanupFieldPath && field.order === 'ASCENDING',
      ) === true;
  }) as { state?: unknown } | undefined;

  if (!target) return 'missing';
  if (target.state === 'READY') return 'ready';
  if (target.state === 'CREATING') return 'building';
  return 'unavailable';
}

type PermissionStatus = {
  status: 'checked' | 'unavailable';
  entitiesGet: boolean | null;
  entitiesList: boolean | null;
  entitiesCreate: boolean | null;
  entitiesUpdate: boolean | null;
  entitiesDelete: boolean | null;
  indexesList: boolean | null;
};

function unavailablePermissions(): PermissionStatus {
  return {
    status: 'unavailable',
    entitiesGet: null,
    entitiesList: null,
    entitiesCreate: null,
    entitiesUpdate: null,
    entitiesDelete: null,
    indexesList: null,
  };
}

async function getAccessToken(app: App): Promise<string | null> {
  const credential = app.options.credential;
  if (!credential) return null;
  const token = await credential.getAccessToken();
  return typeof token.access_token === 'string' ? token.access_token : null;
}

async function checkPermissions(projectId: string, accessToken: string): Promise<PermissionStatus> {
  const response = await fetch(
    `https://cloudresourcemanager.googleapis.com/v1/projects/${encodeURIComponent(projectId)}:testIamPermissions`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ permissions: Object.values(permissionNames) }),
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!response.ok) return unavailablePermissions();

  const body = await response.json() as { permissions?: string[] };
  const granted = new Set(body.permissions ?? []);
  return {
    status: 'checked',
    entitiesGet: granted.has(permissionNames.entitiesGet),
    entitiesList: granted.has(permissionNames.entitiesList),
    entitiesCreate: granted.has(permissionNames.entitiesCreate),
    entitiesUpdate: granted.has(permissionNames.entitiesUpdate),
    entitiesDelete: granted.has(permissionNames.entitiesDelete),
    indexesList: granted.has(permissionNames.indexesList),
  };
}

async function checkExpiryIndex(projectId: string, accessToken: string): Promise<ExpiryIndexStatus> {
  const fieldPath = `projects/${encodeURIComponent(projectId)}/databases/(default)/collectionGroups/${cleanupCollectionGroup}/fields/${cleanupFieldPath}`;
  const response = await fetch(`https://firestore.googleapis.com/v1/${fieldPath}`, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(5000),
  });
  if (response.status === 404) return 'missing';
  if (!response.ok) return 'unavailable';
  return classifyExpiryIndexConfig(await response.json());
}

async function checkCleanupQuery(app: App): Promise<CleanupQueryStatus> {
  try {
    await getFirestore(app)
      .collectionGroup(cleanupCollectionGroup)
      .where(cleanupFieldPath, '<=', new Date())
      .limit(1)
      .get();
    return 'pass';
  } catch (error) {
    return classifyCleanupQueryError(error);
  }
}

export async function runFirebaseDiagnostics(app: App) {
  const generatedAt = new Date().toISOString();
  const projectId = app.options.projectId ?? null;
  const email = getFirebaseAdminCredentialEmail();
  const credential = {
    source: 'FIREBASE_SERVICE_ACCOUNT_JSON' as const,
    serviceAccountEmail: email,
    projectId,
    databaseId: defaultDatabaseId,
    status: email && projectId ? 'configured' as const : 'unavailable' as const,
  };
  const checkedAt = new Date().toISOString();

  const queryPromise = checkCleanupQuery(app);
  const tokenPromise = getAccessToken(app).catch(() => null);
  const [cleanupQueryStatus, accessToken] = await Promise.all([queryPromise, tokenPromise]);

  let permissions = unavailablePermissions();
  let expiresAtIndex: ExpiryIndexStatus = 'unavailable';
  if (accessToken && projectId) {
    [permissions, expiresAtIndex] = await Promise.all([
      checkPermissions(projectId, accessToken).catch(() => unavailablePermissions()),
      checkExpiryIndex(projectId, accessToken).catch(() => 'unavailable' as const),
    ]);
  }

  return {
    generatedAt,
    runtimeEnvironment: process.env.NODE_ENV === 'production'
      ? 'production'
      : process.env.NODE_ENV === 'development' ? 'development' : 'other',
    credential,
    permissions,
    cleanupQuery: {
      status: cleanupQueryStatus,
      checkedAt,
    },
    expiresAtIndex: {
      status: expiresAtIndex,
      checkedAt,
    },
  };
}
