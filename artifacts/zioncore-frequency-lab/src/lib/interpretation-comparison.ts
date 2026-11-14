import { validateObservation } from '@/lib/observation-validation';
import type {
  Observation,
  SavedInterpretation,
  SavedInterpretationProvenance,
} from '@/lib/observations';

export const INTERPRETATION_COMPARISON_MAX_RECORDS = 6;
export const INTERPRETATION_COMPARISON_METHOD = 'exact-proposal-wording-comparison/v1';

export type InterpretationComparisonCandidate = {
  observationId: string;
  recordedAt: string;
  measurement: {
    sampleRateHz: number;
    fftSize: number;
    frequencyResolutionHz: number;
    dominantFrequencyHz: number | null;
    topPeaksHz: number[];
    rmsLevel: number;
    durationSeconds: number;
  };
  interpretation: {
    scientificInterpretation: string;
    confidence: 'low' | 'moderate' | 'high';
    uncertainty: string;
    possibleSources: string[];
    evidenceUsed: string[];
    limitations: string[];
  };
  provenance: SavedInterpretationProvenance;
};

export type InterpretationComparisonReport = {
  schemaVersion: 1;
  method: typeof INTERPRETATION_COMPARISON_METHOD;
  generatedAt: string;
  candidates: InterpretationComparisonCandidate[];
  repeatedSourceWording: Array<{
    wording: string;
    observationIds: string[];
  }>;
  pipelineGroups: Array<{
    provider: string;
    modelId: string;
    methodId: string;
    methodVersion: string;
    promptVersion: string;
    observationIds: string[];
  }>;
  boundaries: string[];
};

type ObservationWithInterpretation = Observation & { interpretation?: SavedInterpretation };

const savedInterpretationProvenanceSchema = {
  safeParse(value: unknown): { success: true; data: SavedInterpretationProvenance } | { success: false } {
    if (!value || typeof value !== 'object') return { success: false };
    const provenance = value as Record<string, unknown>;
    const stringKeys = ['observationId', 'methodId', 'methodVersion', 'promptVersion', 'provider', 'modelId', 'generatedAt'];
    if (provenance.source !== 'ai-generated'
      || !stringKeys.every(key => typeof provenance[key] === 'string' && (provenance[key] as string).length > 0)
      || (provenance.clientRoundTripMs !== undefined
        && (!Number.isFinite(provenance.clientRoundTripMs) || Number(provenance.clientRoundTripMs) < 0))) {
      return { success: false };
    }
    return { success: true, data: provenance as SavedInterpretationProvenance };
  },
};

function validateSavedInterpretation(value: unknown): SavedInterpretation | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const confidence = record.confidence;
  const provenance = savedInterpretationProvenanceSchema.safeParse(record.provenance);
  if (typeof record.scientificInterpretation !== 'string'
    || record.scientificInterpretation.length < 1
    || record.scientificInterpretation.length > 1800
    || !['low', 'moderate', 'high'].includes(String(confidence))
    || typeof record.uncertainty !== 'string'
    || record.uncertainty.length > 1800
    || !Array.isArray(record.possibleSources)
    || record.possibleSources.length > 5
    || !record.possibleSources.every(item => typeof item === 'string' && item.length <= 160)
    || (record.evidenceUsed !== undefined
      && (!Array.isArray(record.evidenceUsed)
        || record.evidenceUsed.length > 12
        || !record.evidenceUsed.every(item => typeof item === 'string' && item.length <= 500)))
    || (record.limitations !== undefined
      && (!Array.isArray(record.limitations)
        || record.limitations.length > 12
        || !record.limitations.every(item => typeof item === 'string' && item.length <= 500)))
    || (record.faithReflection !== null
      && (typeof record.faithReflection !== 'string' || record.faithReflection.length > 6000))
    || typeof record.model !== 'string'
    || record.model.length < 1
    || record.model.length > 160
    || !provenance.success) {
    return null;
  }
  return {
    scientificInterpretation: record.scientificInterpretation,
    confidence: confidence as SavedInterpretation['confidence'],
    uncertainty: record.uncertainty,
    possibleSources: record.possibleSources as string[],
    evidenceUsed: record.evidenceUsed as string[] | undefined,
    limitations: record.limitations as string[] | undefined,
    faithReflection: record.faithReflection as string | null,
    model: record.model,
    provenance: provenance.data,
  };
}

function normalizedWording(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function buildInterpretationComparisonReport(
  records: ObservationWithInterpretation[],
): InterpretationComparisonReport {
  if (records.length < 2 || records.length > INTERPRETATION_COMPARISON_MAX_RECORDS) {
    throw new Error(`Select between 2 and ${INTERPRETATION_COMPARISON_MAX_RECORDS} saved interpretations.`);
  }

  const ids = new Set<string>();
  const candidates = records.map(record => {
    const { interpretation: untrustedInterpretation, ...measurementRecord } = record;
    const validated = validateObservation(measurementRecord);
    if (!validated.success) throw new Error('A selected observation is invalid; no comparison report was created.');
    const observation = validated.data;
    if (ids.has(observation.id)) {
      throw new Error('Selected observations must be distinct; no comparison report was created.');
    }
    ids.add(observation.id);

    const interpretation = validateSavedInterpretation(untrustedInterpretation);
    const provenance = interpretation?.provenance;
    if (!interpretation || !provenance) {
      throw new Error('Every selected record needs an AI interpretation with recorded provenance.');
    }

    return {
      observationId: observation.id,
      recordedAt: observation.createdAt,
      measurement: {
        sampleRateHz: observation.sampleRate,
        fftSize: observation.fftSize,
        frequencyResolutionHz: observation.frequencyResolutionHz,
        dominantFrequencyHz: observation.dominantFrequencyHz,
        topPeaksHz: [...observation.topPeaksHz],
        rmsLevel: observation.rmsLevel,
        durationSeconds: observation.durationSeconds,
      },
      interpretation: {
        scientificInterpretation: interpretation.scientificInterpretation,
        confidence: interpretation.confidence,
        uncertainty: interpretation.uncertainty,
        possibleSources: [...new Set(interpretation.possibleSources.map(value => value.trim()).filter(Boolean))],
        evidenceUsed: [...(interpretation.evidenceUsed ?? [])],
        limitations: [...(interpretation.limitations ?? [])],
      },
      provenance: { ...provenance },
    };
  });

  const wordingGroups = new Map<string, { wording: string; observationIds: Set<string> }>();
  const pipelines = new Map<string, {
    provider: string;
    modelId: string;
    methodId: string;
    methodVersion: string;
    promptVersion: string;
    observationIds: Set<string>;
  }>();

  for (const candidate of candidates) {
    for (const wording of candidate.interpretation.possibleSources) {
      const key = normalizedWording(wording);
      if (!key) continue;
      const group = wordingGroups.get(key) ?? { wording, observationIds: new Set<string>() };
      group.observationIds.add(candidate.observationId);
      wordingGroups.set(key, group);
    }

    const provenance = candidate.provenance;
    const key = JSON.stringify([
      provenance.provider,
      provenance.modelId,
      provenance.methodId,
      provenance.methodVersion,
      provenance.promptVersion,
    ]);
    const group = pipelines.get(key) ?? {
      provider: provenance.provider,
      modelId: provenance.modelId,
      methodId: provenance.methodId,
      methodVersion: provenance.methodVersion,
      promptVersion: provenance.promptVersion,
      observationIds: new Set<string>(),
    };
    group.observationIds.add(candidate.observationId);
    pipelines.set(key, group);
  }

  return {
    schemaVersion: 1,
    method: INTERPRETATION_COMPARISON_METHOD,
    generatedAt: new Date().toISOString(),
    candidates,
    repeatedSourceWording: [...wordingGroups.values()]
      .filter(group => group.observationIds.size > 1)
      .map(group => ({ wording: group.wording, observationIds: [...group.observationIds] })),
    pipelineGroups: [...pipelines.values()]
      .map(group => ({ ...group, observationIds: [...group.observationIds] })),
    boundaries: [
      'Repeated source wording is a text recurrence only, not independent evidence or confirmation.',
      'Records sharing provider, model, method, and prompt form one repeated pipeline, not independent analysts.',
      'The comparison uses exact normalized wording only; different wording is not proof of contradiction.',
      'Measurements and model interpretations remain separate. No source, response, intent, or discovery is verified.',
      'Provenance is recorded by the client and is not a cryptographic attestation.',
      'This report is generated locally and is not saved unless the user exports it.',
    ],
  };
}
