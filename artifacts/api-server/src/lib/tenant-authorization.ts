import { randomUUID } from 'node:crypto';
import {
  TENANT_ACTIONS,
  tenantAuditEventSchema,
  tenantAuthorizationRequestSchema,
  tenantLicenseSchema,
  tenantMembershipSchema,
  verifiedTenantIdentitySchema,
  type TenantAuditEvent,
  type TenantAuthorizationRequest,
  type TenantLicense,
  type TenantMembership,
  type VerifiedTenantIdentity,
} from '@workspace/api-zod';

export interface TenantAuthorizationAdapters {
  /** Must verify a Firebase ID token with a trusted server SDK, not decode it locally. */
  verifyFirebaseIdToken(idToken: string): Promise<unknown>;
  /** Load membership from a server-controlled store; never accept it from request JSON. */
  loadMembership(tenantId: string, uid: string): Promise<unknown | null>;
  /** Load entitlements from a trusted billing/contract source, not from the caller. */
  loadLicense(tenantId: string): Promise<unknown | null>;
  /** Persist the minimal audit event before access is granted. */
  appendAuditEvent(event: TenantAuditEvent): Promise<void>;
  /** Must atomically reserve a seat using the server-generated reservation ID. */
  reserveTenantSeat?(tenantId: string, reservationId: string, seatLimit: number): Promise<boolean>;
  /** Release a reservation if the authorization/audit step fails before invitation creation. */
  releaseTenantSeatReservation?(tenantId: string, reservationId: string): Promise<void>;
  now?: () => Date;
}

export type TenantAuthorizationResult = {
  allowed: boolean;
  reason: TenantAuditEvent['reason'];
  event?: TenantAuditEvent;
  seatReservationId?: string;
};

const roleActions: Record<TenantMembership['role'], ReadonlySet<TenantAuthorizationRequest['action']>> = {
  owner: new Set(TENANT_ACTIONS),
  administrator: new Set([
    'workspace.read',
    'research.create',
    'research.read',
    'research.update',
    'research.delete',
    'members.manage',
    'members.invite',
    'audit.read',
  ]),
  researcher: new Set([
    'workspace.read',
    'research.create',
    'research.read',
    'research.update',
    'research.delete',
  ]),
  analyst: new Set(['workspace.read', 'research.read']),
  viewer: new Set(['workspace.read', 'research.read']),
  'billing-manager': new Set(['workspace.read', 'billing.read']),
};

const actionFeature: Record<TenantAuthorizationRequest['action'], TenantLicense['features'][number]> = {
  'workspace.read': 'shared-research',
  'research.create': 'shared-research',
  'research.read': 'shared-research',
  'research.update': 'shared-research',
  'research.delete': 'shared-research',
  'members.manage': 'collaborative-projects',
  'members.invite': 'collaborative-projects',
  'billing.read': 'billing-reporting',
  'audit.read': 'audit-trail',
};

const actionResourceTypes: Record<TenantAuthorizationRequest['action'], readonly TenantAuthorizationRequest['resourceType'][]> = {
  'workspace.read': ['workspace'],
  'research.create': ['project', 'experiment', 'dataset'],
  'research.read': ['project', 'experiment', 'dataset'],
  'research.update': ['project', 'experiment', 'dataset'],
  'research.delete': ['project', 'experiment', 'dataset'],
  'members.manage': ['member'],
  'members.invite': ['member'],
  'billing.read': ['license'],
  'audit.read': ['audit'],
};

function getReasonForAuthorization(
  request: TenantAuthorizationRequest,
  identity: VerifiedTenantIdentity | null,
  membershipInput: unknown,
  licenseInput: unknown,
  now: Date,
): TenantAuditEvent['reason'] {
  if (!identity) return 'identity-unverified';

  const membershipResult = tenantMembershipSchema.safeParse(membershipInput);
  if (!membershipResult.success) return 'membership-missing';
  const membership = membershipResult.data;

  if (membership.tenantId !== request.tenantId) return 'tenant-mismatch';
  if (membership.userId !== identity.uid) return 'membership-missing';
  if (membership.status !== 'active') return 'membership-suspended';

  const licenseResult = tenantLicenseSchema.safeParse(licenseInput);
  if (!licenseResult.success) return 'license-missing';
  const license = licenseResult.data;

  if (license.tenantId !== request.tenantId) return 'tenant-mismatch';
  if (license.status !== 'active') return 'license-inactive';
  if (Date.parse(license.expiresAt) <= now.getTime()) return 'license-expired';
  if (!license.features.includes(actionFeature[request.action])) return 'feature-not-licensed';
  if (!actionResourceTypes[request.action].includes(request.resourceType)) return 'invalid-request';

  if (!roleActions[membership.role].has(request.action)) return 'role-denied';
  if (request.action === 'research.update' || request.action === 'research.delete') {
    if (membership.role === 'researcher' && request.resourceOwnerUid !== identity.uid) {
      return 'resource-owner-mismatch';
    }
  }
  if (request.action === 'research.create'
    && request.resourceOwnerUid !== undefined
    && request.resourceOwnerUid !== identity.uid) {
    return 'resource-owner-mismatch';
  }

  return 'allowed';
}

/**
 * Server-only policy boundary for future tenant routes.
 *
 * The current API has no Firebase Admin verifier, tenant repository, licensing
 * adapter, or durable audit store. Until those adapters exist, this function
 * is not registered on a route and cannot grant access to a customer request.
 */
export async function authorizeTenantRequest(
  requestInput: unknown,
  idToken: string,
  adapters: TenantAuthorizationAdapters,
): Promise<TenantAuthorizationResult> {
  const requestResult = tenantAuthorizationRequestSchema.safeParse(requestInput);
  if (!requestResult.success || !idToken.trim()) {
    return { allowed: false, reason: 'invalid-request' };
  }
  const request = requestResult.data;
  const now = adapters.now?.() ?? new Date();
  let identity: VerifiedTenantIdentity | null = null;
  let membership: unknown | null = null;
  let license: unknown | null = null;
  let reason: TenantAuditEvent['reason'];
  let seatReservationId: string | undefined;

  try {
    const identityResult = verifiedTenantIdentitySchema.safeParse(
      await adapters.verifyFirebaseIdToken(idToken),
    );
    if (identityResult.success) identity = identityResult.data;
  } catch {
    // Avoid exposing verifier details or token material in the decision.
  }

  if (identity) {
    try {
      membership = await adapters.loadMembership(request.tenantId, identity.uid);
      license = await adapters.loadLicense(request.tenantId);
      reason = getReasonForAuthorization(request, identity, membership, license, now);
      if (reason === 'allowed' && request.action === 'members.invite') {
        const parsedLicense = tenantLicenseSchema.safeParse(license);
        if (!parsedLicense.success
          || !adapters.reserveTenantSeat
          || !adapters.releaseTenantSeatReservation) {
          reason = 'authorization-data-unavailable';
        } else {
          seatReservationId = randomUUID();
          const reserved = await adapters.reserveTenantSeat(
            request.tenantId,
            seatReservationId,
            parsedLicense.data.seatLimit,
          );
          if (!reserved) {
            seatReservationId = undefined;
            reason = 'seat-limit-reached';
          }
        }
      }
    } catch {
      reason = 'authorization-data-unavailable';
      if (seatReservationId && adapters.releaseTenantSeatReservation) {
        try {
          await adapters.releaseTenantSeatReservation(request.tenantId, seatReservationId);
        } catch {
          // The reservation adapter must expire/reconcile uncommitted seats.
        }
        seatReservationId = undefined;
      }
    }
  } else {
    reason = 'identity-unverified';
  }

  let event: TenantAuditEvent;
  try {
    event = tenantAuditEventSchema.parse({
      eventId: randomUUID(),
      requestId: request.requestId,
      tenantId: request.tenantId,
      actorUid: identity?.uid ?? 'unverified',
      action: request.action,
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      decision: reason === 'allowed' ? 'allowed' : 'denied',
      reason,
      occurredAt: now.toISOString(),
    });
    await adapters.appendAuditEvent(event);
  } catch {
    if (seatReservationId && adapters.releaseTenantSeatReservation) {
      try {
        await adapters.releaseTenantSeatReservation(request.tenantId, seatReservationId);
      } catch {
        // Do not allow an un-audited tenant action. The reservation store must
        // provide bounded expiry/reconciliation if a release itself fails.
      }
    }
    return { allowed: false, reason: 'audit-write-failed' };
  }

  return { allowed: reason === 'allowed', reason, event, seatReservationId };
}
