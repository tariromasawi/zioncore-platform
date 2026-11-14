import { z } from 'zod';
import { explanationSchema } from '@workspace/frequency-ai-contract';
import type { Explanation } from './ai-analysis';

export const MAX_SIGNAL_CARDS = 20;
export const SIGNAL_CARD_TEMPLATES = [
  { id: 'nature', name: 'Nature journal', description: 'A field note for environmental listening.' },
  { id: 'tonal', name: 'Tonal atlas', description: 'A precise keepsake of frequency exploration.' },
  { id: 'faith', name: 'Faith reflection', description: 'A personal space for meaning and reflection.' },
] as const;

const measurementSchema = z.object({
  captureSource: z.enum(['microphone', 'audio-file']),
  sampleRate: z.number().int().min(8000).max(192000),
  fftSize: z.union([z.literal(2048), z.literal(4096), z.literal(8192)]),
  frequencyResolutionHz: z.number().positive().finite(),
  dominantFrequencyHz: z.number().positive().finite().nullable(),
  topPeaksHz: z.array(z.number().positive().finite()).max(6),
  rmsLevel: z.number().min(0).max(1),
  durationSeconds: z.number().min(0).max(86400),
}).strict().refine(m => (
  Math.abs(m.frequencyResolutionHz - m.sampleRate / m.fftSize) < 0.000001
  && (m.dominantFrequencyHz === null || m.dominantFrequencyHz <= m.sampleRate / 2)
  && m.topPeaksHz.every(f => f <= m.sampleRate / 2)
), 'Inconsistent captured frequency measurements.');

export const signalCardCaptureSchema = z.object({
  id: z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/),
  createdAt: z.string().datetime(),
  measurement: measurementSchema.nullable(),
  listeningContext: z.string().max(700),
  spectrumImage: z.string().max(200_000)
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/).nullable(),
}).strict();
export type SignalCardCapture = z.infer<typeof signalCardCaptureSchema>;

export const signalCardSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/),
  title: z.string().trim().min(1).max(120),
  template: z.enum(['nature', 'tonal', 'faith']),
  summary: z.string().trim().min(1).max(1800),
  notes: z.string().max(3000),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  capture: signalCardCaptureSchema,
  report: explanationSchema.extend({
    provider: z.enum(['gemini', 'openai']),
    model: z.string().min(1).max(200),
    fallbackUsed: z.boolean(),
  }),
}).strict();
export type SignalCard = z.infer<typeof signalCardSchema>;
export type SignalCardExportOptions = {
  includeContext: boolean;
  includeNotes: boolean;
  includeReflection: boolean;
  includeReport: boolean;
};
export const DEFAULT_SIGNAL_CARD_EXPORT_OPTIONS: SignalCardExportOptions = Object.freeze({
  includeContext: false, includeNotes: false, includeReflection: false, includeReport: false,
});

export function createSignalCard(
  report: Explanation,
  capture: SignalCardCapture | null,
): SignalCard {
  const now = new Date().toISOString();
  const source = capture ?? {
    id: `card-${crypto.randomUUID()}`, createdAt: now, measurement: null,
    listeningContext: '', spectrumImage: null,
  };
  return signalCardSchema.parse({
    version: 1, id: source.id, title: 'My signal reading', template: 'tonal',
    summary: report.executiveSummary, notes: '', createdAt: source.createdAt,
    updatedAt: now, capture: source, report,
  });
}

type CardStorage = Pick<Storage, 'getItem' | 'setItem'>;
const savedCardsSchema = z.object({
  version: z.literal(1), cards: z.array(signalCardSchema).max(MAX_SIGNAL_CARDS),
}).strict();

export function signalCardStorageKey(uid: string) {
  if (!uid || uid.length > 128 || uid.includes('/')) throw new Error('Sign in to manage your Signal Cards.');
  return `zioncore.signal-cards.v1.${encodeURIComponent(uid)}`;
}

function getStorage(storage?: CardStorage): CardStorage {
  if (storage) return storage;
  if (typeof localStorage === 'undefined') throw new Error('Browser storage is unavailable.');
  return localStorage;
}

export function readSignalCards(uid: string, storage?: CardStorage): SignalCard[] {
  const key = signalCardStorageKey(uid);
  try {
    const raw = getStorage(storage).getItem(key);
    if (raw === null) return [];
    const stored = savedCardsSchema.parse(JSON.parse(raw));
    if (new Set(stored.cards.map(card => card.id)).size !== stored.cards.length) {
      throw new Error('Duplicate saved card identifiers.');
    }
    return stored.cards;
  } catch {
    throw new Error('Saved Signal Cards could not be read. Existing browser data has not been overwritten.');
  }
}

function persist(uid: string, cards: SignalCard[], storage?: CardStorage) {
  const value = savedCardsSchema.parse({ version: 1, cards });
  try {
    getStorage(storage).setItem(signalCardStorageKey(uid), JSON.stringify(value));
  } catch {
    throw new Error('Signal Cards could not be saved on this browser. Free storage space or download your card first.');
  }
  return value.cards;
}

export function saveSignalCard(uid: string, card: SignalCard, storage?: CardStorage): SignalCard[] {
  const validated = signalCardSchema.parse(card);
  const cards = readSignalCards(uid, storage);
  const existing = cards.find(item => item.id === validated.id);
  if (existing && (
    JSON.stringify(existing.report) !== JSON.stringify(validated.report)
    || JSON.stringify(existing.capture) !== JSON.stringify(validated.capture)
    || existing.createdAt !== validated.createdAt
  )) {
    throw new Error('The original reading and measurements cannot be replaced. Create a new card for a different reading.');
  }
  if (existing && existing.updatedAt !== validated.updatedAt) {
    throw new Error('This card changed in another tab. Close this draft and reopen the saved card before editing again.');
  }
  if (!cards.some(item => item.id === validated.id) && cards.length >= MAX_SIGNAL_CARDS) {
    throw new Error(`Your browser library holds ${MAX_SIGNAL_CARDS} cards. Export and delete a card before saving another.`);
  }
  // Make the revision monotonic even for two saves within one millisecond or
  // after the device clock moves backwards. Stale editors must not win silently.
  const updatedAt = new Date(Math.max(
    Date.now(), existing ? Date.parse(existing.updatedAt) + 1 : 0,
  )).toISOString();
  return persist(uid, [{ ...validated, updatedAt }, ...cards.filter(item => item.id !== validated.id)], storage);
}

export function deleteSignalCard(uid: string, id: string, storage?: CardStorage): SignalCard[] {
  return persist(uid, readSignalCards(uid, storage).filter(card => card.id !== id), storage);
}

export {
  signalCardToText, signalCardToHtml, signalCardToJson, downloadSignalCard,
} from './signal-card-export';
