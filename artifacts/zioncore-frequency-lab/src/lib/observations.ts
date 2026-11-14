import { validateObservation } from '@/lib/observation-validation';
import type { InstrumentProvenance } from '@/lib/instrument-provenance';

export type Observation = {
  id: string;
  createdAt: string;
  sampleRate: number;
  fftSize: number;
  frequencyResolutionHz: number;
  dominantFrequencyHz: number | null;
  topPeaksHz: number[];
  rmsLevel: number;
  durationSeconds: number;
  mode: 'microphone' | 'audio-file';
  instrumentProvenance?: InstrumentProvenance;
  notes?: string;
  interpretation?: SavedInterpretation;
};

export type SavedInterpretation = {
  scientificInterpretation: string;
  confidence: 'low' | 'moderate' | 'high';
  uncertainty: string;
  possibleSources: string[];
  evidenceUsed?: string[];
  limitations?: string[];
  faithReflection: string | null;
  model: string;
  provenance?: SavedInterpretationProvenance;
};

export type SavedInterpretationProvenance = {
  source: 'ai-generated';
  observationId: string;
  methodId: string;
  methodVersion: string;
  promptVersion: string;
  provider: string;
  modelId: string;
  generatedAt: string;
  clientRoundTripMs?: number;
};

const STORAGE_KEY = 'zioncore.frequency-lab.observations.v1';

export function getObservationStorageKey(userId?: string) {
  return userId
    ? `${STORAGE_KEY}.account.${encodeURIComponent(userId)}`
    : STORAGE_KEY;
}

export function readObservations(userId?: string): Observation[] {
  try {
    const value = localStorage.getItem(getObservationStorageKey(userId));
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(item => {
      const result = validateObservation(item);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
}

export function readVerifiedObservations(userId?: string): Observation[] {
  const value = localStorage.getItem(getObservationStorageKey(userId));
  if (value === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Saved observations could not be verified. Stored records were left unchanged.');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Saved observations have an unexpected format. Stored records were left unchanged.');
  }
  return parsed.map(item => {
    const result = validateObservation(item);
    if (!result.success) {
      throw new Error('Saved observations contain an invalid record. Stored records were left unchanged.');
    }
    return result.data;
  });
}

export function readObservationsForExport(userId?: string): Observation[] {
  try {
    return readVerifiedObservations(userId);
  } catch (cause) {
    throw new Error(`${cause instanceof Error ? cause.message : 'Saved observations could not be read.'} No export was created.`);
  }
}

export function writeObservations(items: Observation[], userId?: string) {
  if (!items.every(item => validateObservation(item).success)) {
    throw new Error('One or more observations failed validation.');
  }
  localStorage.setItem(getObservationStorageKey(userId), JSON.stringify(items));
}

export function deleteObservationsFromStorage(ids: string[], userId?: string) {
  if (!ids.every(id => typeof id === 'string' && id.length > 0)) {
    throw new Error('The selected observation IDs are invalid. No records were deleted.');
  }
  const key = getObservationStorageKey(userId);
  const value = localStorage.getItem(key);
  if (value === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Saved history could not be verified. No records were deleted.');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Saved history could not be verified. No records were deleted.');
  }

  const seenIds = new Set<string>();
  const validated = parsed.map(item => {
    const result = validateObservation(item);
    if (!result.success) {
      throw new Error('Saved history contains an invalid record. No records were deleted.');
    }
    if (seenIds.has(result.data.id)) {
      throw new Error('Saved history contains duplicate record IDs. No records were deleted.');
    }
    seenIds.add(result.data.id);
    return { raw: item, observation: result.data };
  });
  const selectedIds = new Set(ids);
  const remaining = validated.filter(({ observation }) => !selectedIds.has(observation.id));
  localStorage.setItem(key, JSON.stringify(remaining.map(({ raw }) => raw)));
  return remaining.map(({ observation }) => observation);
}

export function upsertObservation(items: Observation[], observation: Observation) {
  const existingIndex = items.findIndex(item => item.id === observation.id);
  if (existingIndex < 0) return [observation, ...items];
  return items.map(item => item.id === observation.id ? observation : item);
}

export function formatFrequency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return value >= 1000 ? `${(value / 1000).toFixed(2)} kHz` : `${value.toFixed(1)} Hz`;
}

export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function toCsv(items: Observation[]) {
  const columns = [
    'id', 'createdAt', 'sampleRate', 'fftSize', 'frequencyResolutionHz',
    'dominantFrequencyHz', 'topPeaksHz', 'rmsLevel', 'durationSeconds', 'mode', 'notes',
    'instrumentId', 'instrumentName', 'acquisitionMethod', 'physicalDeviceIdentity',
    'inputChannels', 'frequencyUnit', 'frequencyResolutionUnit', 'amplitudeUnit',
    'durationUnit', 'calibrationStatus', 'calibrationCheckedAt', 'calibrationReference',
    'softwareVersion',
    'interpretationScientificInterpretation', 'interpretationConfidence',
    'interpretationUncertainty', 'interpretationPossibleSources',
    'interpretationEvidenceUsed', 'interpretationLimitations',
    'interpretationFaithReflection', 'interpretationModel',
    'interpretationSource', 'interpretationObservationId', 'interpretationMethodId',
    'interpretationMethodVersion', 'interpretationPromptVersion',
    'interpretationProvider', 'interpretationModelId', 'interpretationGeneratedAt',
    'interpretationClientRoundTripMs',
  ] as const;
  const cell = (value: unknown) => `"${String(Array.isArray(value) ? value.join(';') : value ?? '').replaceAll('"', '""')}"`;
  const valueFor = (item: Observation, key: typeof columns[number]) => {
    const provenance = item.instrumentProvenance;
    switch (key) {
      case 'instrumentId': return provenance?.instrumentId;
      case 'instrumentName': return provenance?.instrumentName;
      case 'acquisitionMethod': return provenance?.acquisitionMethod;
      case 'physicalDeviceIdentity': return provenance?.physicalDeviceIdentity;
      case 'inputChannels': return provenance?.inputChannels;
      case 'frequencyUnit': return provenance?.units.frequency;
      case 'frequencyResolutionUnit': return provenance?.units.frequencyResolution;
      case 'amplitudeUnit': return provenance?.units.amplitude;
      case 'durationUnit': return provenance?.units.duration;
      case 'calibrationStatus': return provenance?.calibration.status;
      case 'calibrationCheckedAt': return provenance?.calibration.checkedAt;
      case 'calibrationReference': return provenance?.calibration.reference;
      case 'softwareVersion': return provenance?.softwareVersion;
    }
    if (key.startsWith('interpretation')) {
      const interpretation = item.interpretation;
      if (!interpretation) return '';
      const interpretationProvenance = interpretation.provenance;
      switch (key) {
        case 'interpretationScientificInterpretation': return interpretation.scientificInterpretation;
        case 'interpretationConfidence': return interpretation.confidence;
        case 'interpretationUncertainty': return interpretation.uncertainty;
        case 'interpretationPossibleSources': return interpretation.possibleSources;
        case 'interpretationEvidenceUsed': return interpretation.evidenceUsed;
        case 'interpretationLimitations': return interpretation.limitations;
        case 'interpretationFaithReflection': return interpretation.faithReflection;
        case 'interpretationModel': return interpretation.model;
        case 'interpretationSource': return interpretationProvenance?.source;
        case 'interpretationObservationId': return interpretationProvenance?.observationId;
        case 'interpretationMethodId': return interpretationProvenance?.methodId;
        case 'interpretationMethodVersion': return interpretationProvenance?.methodVersion;
        case 'interpretationPromptVersion': return interpretationProvenance?.promptVersion;
        case 'interpretationProvider': return interpretationProvenance?.provider;
        case 'interpretationModelId': return interpretationProvenance?.modelId;
        case 'interpretationGeneratedAt': return interpretationProvenance?.generatedAt;
        case 'interpretationClientRoundTripMs': return interpretationProvenance?.clientRoundTripMs;
      }
    }
    return item[key as keyof Observation];
  };
  return [
    columns.join(','),
    ...items.map(item => columns.map(key => cell(valueFor(item, key))).join(',')),
  ].join('\n');
}
