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
};

const STORAGE_KEY = 'zioncore.frequency-lab.observations.v1';

export function readObservations(): Observation[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Observation =>
      Boolean(item && typeof item === 'object' && typeof item.id === 'string' &&
        typeof item.createdAt === 'string' && typeof item.sampleRate === 'number' &&
        typeof item.fftSize === 'number' && Array.isArray(item.topPeaksHz)),
    );
  } catch {
    return [];
  }
}

export function writeObservations(items: Observation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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
  link.click();
  URL.revokeObjectURL(url);
}

export function toCsv(items: Observation[]) {
  const columns: (keyof Observation)[] = [
    'id', 'createdAt', 'sampleRate', 'fftSize', 'frequencyResolutionHz',
    'dominantFrequencyHz', 'topPeaksHz', 'rmsLevel', 'durationSeconds', 'mode', 'notes',
  ];
  const cell = (value: unknown) => `"${String(Array.isArray(value) ? value.join(';') : value ?? '').replaceAll('"', '""')}"`;
  return [columns.join(','), ...items.map(item => columns.map(key => cell(item[key])).join(','))].join('\n');
}
