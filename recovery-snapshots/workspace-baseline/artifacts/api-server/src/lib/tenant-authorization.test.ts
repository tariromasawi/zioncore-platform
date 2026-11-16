import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  authorizeTenantRequest,
  type TenantAuthorizationAdapters,
} from './tenant-authorization';
import type { TenantAuditEvent } from '@workspace/api-zod';

const NOW = new Date('2026-11-12T12:00:00.000Z');
const requestId = 'f6725680-df2f-41ea-a5b8-ebc9dcf4964d';
const request = (overrides: Record<string, unknown> = {}) => ({
  requestId,
  tenantId: 'org-a',
  action: 'research.read',
  resourceType: 'experiment',
  resourceId: 'experiment-1',
  ...overrides,
});
const membership = (overrides: Record<string, unknown> = {}) => ({
  tenantId: 'org-a',
  userId: 'user-1',
  role: 'researcher',
  status: 'active',
  createdAt: '2026-11-01T12:00:00.000Z',
  updatedAt: '2026-11-01T12:00:00.000Z',
  ...overrides,
});
const license = (overrides: Record<string, unknown> = {}) => ({
  tenantId: 'org-a',
  status: 'active',
  features: ['shared-research', 'collaborative-projects', 'research-export', 'audit-trail', 'billing-reporting'],
  seatLimit: 10,
  issuedAt: '2026-11-01T12:00:00.000Z',
  expiresAt: '2027-11-01T12:00:00.000Z',
  updatedAt: '2026-11-01T12:00:00.000Z',
  ...overrides,
});

function adapters(overrides: Partial<TenantAuthorizationAdapters> = {}) {
  const auditEvents: TenantAuditEvent[] = [];
  const value: TenantAuthorizationAdapters = {
    verifyFirebaseIdToken: async () => ({ uid: 'user-1' }),
    loadMembership: async () => membership(),
    loadLicense: async () => license(),
    appendAuditEvent: async event => { auditEvents.push(event); },
    now: () => NOW,
    ...overrides,
  };
  return { value, auditEvents };
}

test('active tenant member with a current license can read research and is audited', async () => {
  const deps = adapters();
  const result = await authorizeTenantRequest(request(), 'opaque-token', deps.value);
  assert.equal(result.allowed, true);
  assert.equal(result.reason, 'allowed');
  assert.equal(deps.auditEvents.length, 1);
  assert.equal(deps.auditEvents[0]?.decision, 'allowed');
  assert.equal(deps.auditEvents[0]?.actorUid, 'user-1');
});

test('cross-tenant membership data is denied and audited', async () => {
  const deps = adapters({ loadMembership: async () => membership({ tenantId: 'org-b' }) });
  const result = await authorizeTenantRequest(request(), 'opaque-token', deps.value);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'tenant-mismatch');
  assert.equal(deps.auditEvents[0]?.decision, 'denied');
});

test('membership for another user cannot authorize the caller', async () => {
  const deps = adapters({ loadMembership: async () => membership({ userId: 'user-2' }) });
  const result = await authorizeTenantRequest(request(), 'opaque-token', deps.value);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'membership-missing');
});

test('role matrix allows viewer reads but denies research creation', async () => {
  const deps = adapters({ loadMembership: async () => membership({ role: 'viewer' }) });
  const read = await authorizeTenantRequest(request(), 'opaque-token', deps.value);
  const create = await authorizeTenantRequest(
    request({ action: 'research.create', resourceType: 'experiment' }),
    'opaque-token',
    deps.value,
  );
  assert.equal(read.allowed, true);
  assert.equal(create.allowed, false);
  assert.equal(create.reason, 'role-denied');
});

test('researchers may update their own work but not another member’s work', async () => {
  const deps = adapters();
  const own = await authorizeTenantRequest(
    request({ action: 'research.update', resourceOwnerUid: 'user-1' }),
    'opaque-token',
    deps.value,
  );
  const other = await authorizeTenantRequest(
    request({ action: 'research.update', resourceOwnerUid: 'user-2' }),
    'opaque-token',
    deps.value,
  );
  assert.equal(own.allowed, true);
  assert.equal(other.allowed, false);
  assert.equal(other.reason, 'resource-owner-mismatch');
});

test('billing and audit access require their specific roles and licensed features', async () => {
  const billingManager = adapters({ loadMembership: async () => membership({ role: 'billing-manager' }) });
  const billing = await authorizeTenantRequest(
    request({ action: 'billing.read', resourceType: 'license' }),
    'opaque-token',
    billingManager.value,
  );
  const audit = await authorizeTenantRequest(
    request({ action: 'audit.read', resourceType: 'audit' }),
    'opaque-token',
    billingManager.value,
  );
  assert.equal(billing.allowed, true);
  assert.equal(audit.allowed, false);
  assert.equal(audit.reason, 'role-denied');

  const missingFeature = adapters({
    loadLicense: async () => license({ features: ['shared-research'] }),
  });
  const unlicensed = await authorizeTenantRequest(
    request({ action: 'audit.read', resourceType: 'audit' }),
    'opaque-token',
    missingFeature.value,
  );
  assert.equal(unlicensed.allowed, false);
  assert.equal(unlicensed.reason, 'feature-not-licensed');
});

test('member invitations require administrator access and an atomic seat reservation', async () => {
  const reservations: Array<{ tenantId: string; reservationId: string; seatLimit: number }> = [];
  const deps = adapters({
    loadMembership: async () => membership({ role: 'administrator' }),
    reserveTenantSeat: async (tenantId, reservationId, seatLimit) => {
      reservations.push({ tenantId, reservationId, seatLimit });
      return true;
    },
    releaseTenantSeatReservation: async () => {},
  });
  const result = await authorizeTenantRequest(
    request({ action: 'members.invite', resourceType: 'member', resourceId: 'new-member' }),
    'opaque-token',
    deps.value,
  );
  assert.equal(result.allowed, true);
  assert.equal(result.reason, 'allowed');
  assert.equal(result.seatReservationId, reservations[0]?.reservationId);
  assert.equal(reservations[0]?.tenantId, 'org-a');
  assert.equal(reservations[0]?.seatLimit, 10);
});

test('member invitations fail closed at the seat limit or without reservation support', async () => {
  const atCapacity = adapters({
    loadMembership: async () => membership({ role: 'administrator' }),
    reserveTenantSeat: async () => false,
    releaseTenantSeatReservation: async () => {},
  });
  const unsupported = adapters({
    loadMembership: async () => membership({ role: 'administrator' }),
  });
  const invite = request({
    action: 'members.invite',
    resourceType: 'member',
    resourceId: 'new-member',
  });
  assert.equal((await authorizeTenantRequest(invite, 'opaque-token', atCapacity.value)).reason, 'seat-limit-reached');
  assert.equal((await authorizeTenantRequest(invite, 'opaque-token', unsupported.value)).reason, 'authorization-data-unavailable');
});

test('failed audit persistence releases a reserved tenant seat', async () => {
  let released = '';
  const deps = adapters({
    loadMembership: async () => membership({ role: 'administrator' }),
    reserveTenantSeat: async () => true,
    releaseTenantSeatReservation: async (_tenantId, reservationId) => { released = reservationId; },
    appendAuditEvent: async () => { throw new Error('private audit detail'); },
  });
  const result = await authorizeTenantRequest(
    request({ action: 'members.invite', resourceType: 'member', resourceId: 'new-member' }),
    'opaque-token',
    deps.value,
  );
  assert.equal(result.reason, 'audit-write-failed');
  assert.notEqual(released, '');
});

test('suspended and expired licenses fail closed', async () => {
  const suspended = adapters({ loadLicense: async () => license({ status: 'suspended' }) });
  const expired = adapters({
    loadLicense: async () => license({ expiresAt: '2026-11-12T11:59:00.000Z' }),
  });
  assert.equal((await authorizeTenantRequest(request(), 'opaque-token', suspended.value)).reason, 'license-inactive');
  assert.equal((await authorizeTenantRequest(request(), 'opaque-token', expired.value)).reason, 'license-expired');
});

test('invalid token or unavailable authorization data is denied and recorded', async () => {
  const badToken = adapters({ verifyFirebaseIdToken: async () => { throw new Error('private verifier detail'); } });
  const unavailable = adapters({ loadLicense: async () => { throw new Error('private storage detail'); } });
  const badResult = await authorizeTenantRequest(request(), 'opaque-token', badToken.value);
  const unavailableResult = await authorizeTenantRequest(request(), 'opaque-token', unavailable.value);
  assert.equal(badResult.reason, 'identity-unverified');
  assert.equal(badToken.auditEvents[0]?.actorUid, 'unverified');
  assert.equal(unavailableResult.reason, 'authorization-data-unavailable');
  assert.equal(unavailable.auditEvents[0]?.decision, 'denied');
});

test('audit persistence failure denies otherwise-authorized work', async () => {
  const deps = adapters({ appendAuditEvent: async () => { throw new Error('private audit detail'); } });
  const result = await authorizeTenantRequest(request(), 'opaque-token', deps.value);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'audit-write-failed');
});

test('malformed requests do not reach identity, membership, license, or audit adapters', async () => {
  let calls = 0;
  const deps = adapters({
    verifyFirebaseIdToken: async () => { calls += 1; return { uid: 'user-1' }; },
    loadMembership: async () => { calls += 1; return membership(); },
    loadLicense: async () => { calls += 1; return license(); },
    appendAuditEvent: async () => { calls += 1; },
  });
  const result = await authorizeTenantRequest({ ...request(), arbitraryPayload: 'not accepted' }, 'opaque-token', deps.value);
  assert.equal(result.reason, 'invalid-request');
  assert.equal(calls, 0);
});
