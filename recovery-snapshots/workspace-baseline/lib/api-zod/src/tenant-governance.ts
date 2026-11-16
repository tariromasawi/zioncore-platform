import { z } from 'zod';

const identifierSchema = z.string().trim().min(1).max(128);
const timestampSchema = z.string().datetime({ offset: true });

export const TENANT_ROLES = [
  'owner',
  'administrator',
  'researcher',
  'analyst',
  'viewer',
  'billing-manager',
] as const;

export const TENANT_FEATURES = [
  'shared-research',
  'collaborative-projects',
  'research-export',
  'audit-trail',
  'billing-reporting',
] as const;

export const TENANT_ACTIONS = [
  'workspace.read',
  'research.create',
  'research.read',
  'research.update',
  'research.delete',
  'members.manage',
  'members.invite',
  'billing.read',
  'audit.read',
] as const;

export const TENANT_RESOURCE_TYPES = [
  'workspace',
  'project',
  'experiment',
  'dataset',
  'member',
  'license',
  'audit',
] as const;

export const TENANT_AUTHORIZATION_REASONS = [
  'allowed',
  'identity-unverified',
  'membership-missing',
  'membership-suspended',
  'tenant-mismatch',
  'license-missing',
  'license-inactive',
  'license-expired',
  'feature-not-licensed',
  'seat-limit-reached',
  'role-denied',
  'resource-owner-mismatch',
  'invalid-request',
  'authorization-data-unavailable',
  'audit-write-failed',
] as const;

export const verifiedTenantIdentitySchema = z.object({
  uid: identifierSchema,
}).strict();

export const tenantAuthorizationRequestSchema = z.object({
  requestId: z.string().uuid(),
  tenantId: identifierSchema,
  action: z.enum(TENANT_ACTIONS),
  resourceType: z.enum(TENANT_RESOURCE_TYPES),
  resourceId: identifierSchema,
  resourceOwnerUid: identifierSchema.optional(),
}).strict();

export const tenantMembershipSchema = z.object({
  tenantId: identifierSchema,
  userId: identifierSchema,
  role: z.enum(TENANT_ROLES),
  status: z.enum(['pending', 'active', 'suspended']),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}).strict();

export const tenantLicenseSchema = z.object({
  tenantId: identifierSchema,
  status: z.enum(['active', 'suspended', 'expired']),
  features: z.array(z.enum(TENANT_FEATURES)).max(TENANT_FEATURES.length),
  seatLimit: z.number().int().min(1).max(10_000),
  issuedAt: timestampSchema,
  expiresAt: timestampSchema,
  updatedAt: timestampSchema,
}).strict().superRefine((license, context) => {
  if (Date.parse(license.expiresAt) <= Date.parse(license.issuedAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expiresAt'],
      message: 'A tenant license must expire after it is issued.',
    });
  }
  if (new Set(license.features).size !== license.features.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['features'],
      message: 'License features must be unique.',
    });
  }
});

export const tenantAuditEventSchema = z.object({
  eventId: z.string().uuid(),
  requestId: z.string().uuid(),
  tenantId: identifierSchema,
  actorUid: identifierSchema,
  action: z.enum(TENANT_ACTIONS),
  resourceType: z.enum(TENANT_RESOURCE_TYPES),
  resourceId: identifierSchema,
  decision: z.enum(['allowed', 'denied']),
  reason: z.enum(TENANT_AUTHORIZATION_REASONS),
  occurredAt: timestampSchema,
}).strict();

export type TenantAuthorizationRequest = z.infer<typeof tenantAuthorizationRequestSchema>;
export type TenantMembership = z.infer<typeof tenantMembershipSchema>;
export type TenantLicense = z.infer<typeof tenantLicenseSchema>;
export type TenantAuditEvent = z.infer<typeof tenantAuditEventSchema>;
export type VerifiedTenantIdentity = z.infer<typeof verifiedTenantIdentitySchema>;
