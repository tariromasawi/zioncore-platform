import { validateObservation } from '@/lib/observation-validation';

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
  mode: string;
  notes?: string;
  interpretation?: SavedInterpretation;
};

export type SavedInterpretation = {
  scientificInterpretation: string;
  confidence: 'low' | 'moderate' | 'high';
  uncertainty: string;
  possibleSources: string[];
  faithReflection: string | null;
  model: string;
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

export function writeObservations(items: Observation[], userId?: string) {
  if (!items.every(item => validateObservation(item).success)) {
    throw new Error('One or more observations failed validation.');
  }
  localStorage.setItem(getObservationStorageKey(userId), JSON.stringify(items));
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
    'interpretationScientificInterpretation', 'interpretationConfidence',
    'interpretationUncertainty', 'interpretationPossibleSources',
    'interpretationFaithReflection', 'interpretationModel',
  ] as const;
  const cell = (value: unknown) => `"${String(Array.isArray(value) ? value.join(';') : value ?? '').replaceAll('"', '""')}"`;
  const valueFor = (item: Observation, key: typeof columns[number]) => {
    if (key.startsWith('interpretation')) {
      const interpretation = item.interpretation;
      if (!interpretation) return '';
      switch (key) {
        case 'interpretationScientificInterpretation': return interpretation.scientificInterpretation;
        case 'interpretationConfidence': return interpretation.confidence;
        case 'interpretationUncertainty': return interpretation.uncertainty;
        case 'interpretationPossibleSources': return interpretation.possibleSources;
        case 'interpretationFaithReflection': return interpretation.faithReflection;
        case 'interpretationModel': return interpretation.model;
      }
    }
    return item[key as keyof Observation];
  };
  return [
    columns.join(','),
    ...items.map(item => columns.map(key => cell(valueFor(item, key))).join(',')),
  ].join('\n');
}
