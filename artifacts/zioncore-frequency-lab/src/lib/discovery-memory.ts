import { z } from 'zod';
import { CIG_METHOD_IDS, researchGridRegistry } from '@/lib/research-grid';
import type { ResearchSession } from '@/lib/celestial-experiment';

export const MAX_DISCOVERY_VERSIONS_PER_KIND = 50;
export const MAX_DISCOVERY_VERSIONS_PER_SESSION = MAX_DISCOVERY_VERSIONS_PER_KIND * 4;
export const DISCOVERY_MEMORY_SCHEMA_VERSION = 'zioncore.discovery-memory/v1' as const;

const isoDate = z.string().datetime();
const observationRefs = z.array(z.string().uuid()).max(30);
const versionFields = {
  schemaVersion: z.literal(DISCOVERY_MEMORY_SCHEMA_VERSION),
  id: z.string().uuid(),
  version: z.number().int().min(1).max(MAX_DISCOVERY_VERSIONS_PER_KIND),
  recordedAt: isoDate,
  observationRefs,
};

export const discoveryVersionSchema = z.discriminatedUnion('kind', [
  z.object({
    ...versionFields,
    kind: z.literal('experiment'),
    source: z.literal('system-captured'),
    snapshot: z.object({
      sessionId: z.string().uuid(),
      domain: z.string().min(1).max(96),
      createdAt: isoDate,
      message: z.object({
        text: z.string().max(120),
        intent: z.enum(['research-message', 'prayer']),
      }).strict(),
      signal: z.object({
        protocolId: z.string().min(1).max(120),
        payloadByteLength: z.number().int().min(1).max(120).nullable(),
        checksum: z.number().int().min(0).max(65535).nullable(),
        durationSeconds: z.number().finite().nonnegative().max(120),
      }).strict().nullable(),
      transmissionStatus: z.enum(['not-started', 'authorized', 'completed', 'stopped']),
      userNotes: z.array(z.object({
        statement: z.string().min(1).max(1000),
        basis: z.string().min(1).max(1000),
        confidence: z.enum(['low', 'moderate']),
        createdAt: isoDate,
      }).strict()).max(30),
    }).strict(),
  }).strict(),
  z.object({
    ...versionFields,
    kind: z.literal('protocol'),
    source: z.literal('system-captured'),
    snapshot: z.object({
      protocolId: z.string().min(1).max(120),
      protocolContractVersion: z.string().min(1).max(40),
      methodId: z.string().min(1).max(120),
      methodVersion: z.string().min(1).max(40),
      sampleRateHz: z.number().int().positive().max(192000),
      symbolDurationMs: z.number().int().positive().max(1000),
      interSymbolGapMs: z.number().int().nonnegative().max(1000),
      outputLevel: z.number().finite().min(0).max(1),
      carrierFrequenciesHz: z.array(z.number().int().positive()).max(16),
    }).strict(),
  }).strict(),
  z.object({
    ...versionFields,
    kind: z.literal('hypothesis'),
    source: z.literal('user-authored'),
    snapshot: z.object({
      statement: z.string().min(1).max(1200),
      status: z.enum(['open', 'tentative', 'not-observed']),
      authoredAt: isoDate,
    }).strict(),
  }).strict(),
  z.object({
    ...versionFields,
    kind: z.literal('interpretation'),
    source: z.literal('user-authored'),
    snapshot: z.object({
      measuredPattern: z.string().max(1500),
      uncertainty: z.string().max(1500),
      personalReflection: z.string().max(1500),
      authoredAt: isoDate,
      linkedObservationId: z.string().uuid().nullable(),
    }).strict(),
  }).strict(),
]);

export type DiscoveryVersion = z.infer<typeof discoveryVersionSchema>;
type VersionKind = DiscoveryVersion['kind'];

function observationsFor(session: ResearchSession, kind: VersionKind) {
  if (kind === 'interpretation') {
    const linkedId = session.interpretation?.provenance?.observationId;
    return linkedId ? [linkedId] : [];
  }
  return session.observations.map(observation => observation.id);
}

function snapshotFor(session: ResearchSession, kind: VersionKind) {
  if (kind === 'experiment') {
    return {
      sessionId: session.id,
      domain: session.domain,
      createdAt: session.createdAt,
      message: { text: session.message.text, intent: session.message.intent },
      signal: session.signal ? {
        protocolId: session.signal.protocolId,
        payloadByteLength: session.signal.payloadByteLength,
        checksum: session.signal.checksum,
        durationSeconds: session.signal.durationSeconds,
      } : null,
      transmissionStatus: !session.transmission
        ? 'not-started' as const
        : session.transmission.stoppedEarly
          ? 'stopped' as const
          : session.transmission.completedAt
            ? 'completed' as const
            : 'authorized' as const,
      userNotes: session.findings.map(finding => ({
        statement: finding.statement,
        basis: finding.basis,
        confidence: finding.confidence,
        createdAt: finding.createdAt,
      })),
    };
  }
  if (kind === 'protocol') {
    const encoder = researchGridRegistry.getMethod(CIG_METHOD_IDS.localToneEncoding);
    return {
      protocolId: session.encoding.protocolId,
      protocolContractVersion: '1.0.0',
      methodId: CIG_METHOD_IDS.localToneEncoding,
      methodVersion: encoder?.version ?? '1.0.0',
      sampleRateHz: session.encoding.sampleRateHz,
      symbolDurationMs: session.encoding.symbolDurationMs,
      interSymbolGapMs: session.encoding.interSymbolGapMs,
      outputLevel: session.encoding.outputLevel,
      carrierFrequenciesHz: [...session.encoding.carrierFrequenciesHz],
    };
  }
  if (kind === 'hypothesis') {
    const hypothesis = session.hypothesis;
    if (!hypothesis?.statement.trim()) return null;
    return {
      statement: hypothesis.statement,
      status: hypothesis.status,
      authoredAt: hypothesis.updatedAt,
    };
  }
  const interpretation = session.interpretation;
  if (!interpretation) return null;
  return {
    measuredPattern: interpretation.measuredPattern,
    uncertainty: interpretation.uncertainty,
    personalReflection: interpretation.personalReflection,
    authoredAt: interpretation.createdAt,
    linkedObservationId: interpretation.provenance?.observationId ?? null,
  };
}

function jsonEqual(first: unknown, second: unknown) {
  return JSON.stringify(first) === JSON.stringify(second);
}

function appendVersion(
  versions: DiscoveryVersion[],
  session: ResearchSession,
  kind: VersionKind,
  snapshot: unknown,
  recordedAt: string,
  source: DiscoveryVersion['source'],
) {
  const current = versions.filter(version => version.kind === kind).at(-1);
  const nextObservationRefs = observationsFor(session, kind);
  const referencesChanged = kind !== 'protocol'
    && current
    && !jsonEqual(current.observationRefs, nextObservationRefs);
  if (current && jsonEqual(current.snapshot, snapshot) && !referencesChanged) return;
  const nextVersion = (current?.version ?? 0) + 1;
  if (nextVersion > MAX_DISCOVERY_VERSIONS_PER_KIND) {
    throw new Error(`The ${kind} history reached ${MAX_DISCOVERY_VERSIONS_PER_KIND} versions. Export this experiment before starting a new record.`);
  }
  versions.push(discoveryVersionSchema.parse({
    schemaVersion: DISCOVERY_MEMORY_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    kind,
    version: nextVersion,
    source,
    recordedAt,
    observationRefs: nextObservationRefs,
    snapshot,
  }));
}

function seedLegacyHypothesisVersions(versions: DiscoveryVersion[], session: ResearchSession, recordedAt: string) {
  const hypothesis = session.hypothesis;
  if (!hypothesis) return;
  for (const prior of hypothesis.revisionHistory ?? []) {
    if (!prior.statement.trim()) continue;
    appendVersion(
      versions,
      session,
      'hypothesis',
      { statement: prior.statement, status: prior.status, authoredAt: prior.updatedAt },
      prior.updatedAt,
      'user-authored',
    );
  }
  const current = snapshotFor(session, 'hypothesis');
  if (current) {
    appendVersion(
      versions,
      session,
      'hypothesis',
      current,
      hypothesis.updatedAt || recordedAt,
      'user-authored',
    );
  }
}

export function recordDiscoveryMemoryVersions(
  next: ResearchSession,
  previous?: ResearchSession,
  recordedAt = new Date().toISOString(),
): ResearchSession {
  if (!isoDate.safeParse(recordedAt).success) throw new Error('Discovery version time must be a valid ISO timestamp.');
  const versions = [...(next.discoveryVersions ?? previous?.discoveryVersions ?? [])];

  if (versions.length === 0 && previous) {
    for (const kind of ['experiment', 'protocol'] as const) {
      const snapshot = snapshotFor(previous, kind);
      if (snapshot) {
        appendVersion(versions, previous, kind, snapshot, previous.updatedAt, 'system-captured');
      }
    }
    seedLegacyHypothesisVersions(versions, previous, recordedAt);
    const priorInterpretation = snapshotFor(previous, 'interpretation');
    if (priorInterpretation) {
      appendVersion(versions, previous, 'interpretation', priorInterpretation, previous.interpretation!.createdAt, 'user-authored');
    }
  } else if (versions.length === 0) {
    for (const kind of ['experiment', 'protocol'] as const) {
      const snapshot = snapshotFor(next, kind);
      if (snapshot) appendVersion(versions, next, kind, snapshot, recordedAt, 'system-captured');
    }
    seedLegacyHypothesisVersions(versions, next, recordedAt);
    const interpretation = snapshotFor(next, 'interpretation');
    if (interpretation) appendVersion(versions, next, 'interpretation', interpretation, recordedAt, 'user-authored');
  }

  for (const kind of ['experiment', 'protocol'] as const) {
    const snapshot = snapshotFor(next, kind);
    if (snapshot) appendVersion(versions, next, kind, snapshot, recordedAt, 'system-captured');
  }
  const hypothesis = snapshotFor(next, 'hypothesis');
  if (hypothesis) appendVersion(versions, next, 'hypothesis', hypothesis, recordedAt, 'user-authored');
  const interpretation = snapshotFor(next, 'interpretation');
  if (interpretation) appendVersion(versions, next, 'interpretation', interpretation, recordedAt, 'user-authored');

  if (versions.length > MAX_DISCOVERY_VERSIONS_PER_SESSION) {
    throw new Error('This experiment reached its discovery-history limit. Export it before making further revisions.');
  }
  return { ...next, discoveryVersions: versions };
}
