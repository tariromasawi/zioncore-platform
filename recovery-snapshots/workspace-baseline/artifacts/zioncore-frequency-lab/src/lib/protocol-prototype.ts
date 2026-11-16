import { z } from 'zod';
import { crc16Ccitt } from '@/lib/celestial-experiment';

export const PROTOCOL_PROTOTYPE_CONTRACT_VERSION = '1.0.0';
export const PROTOCOL_PROTOTYPE_SYNC_SYMBOLS = Object.freeze([15, 15, 10, 5]);
export const PROTOCOL_PROTOTYPE_MAX_MESSAGE_BYTES = 24;
export const PROTOCOL_PROTOTYPE_MAX_SYMBOLS = (
  PROTOCOL_PROTOTYPE_SYNC_SYMBOLS.length + 2 * (4 + PROTOCOL_PROTOTYPE_MAX_MESSAGE_BYTES + 2)
);
export const PROTOCOL_PROTOTYPE_MAX_DURATION_SECONDS = 18;
export const PROTOCOL_PROTOTYPE_SAMPLE_RATES = Object.freeze([
  8_000, 16_000, 22_050, 44_100, 48_000, 96_000,
] as const);
export const PROTOCOL_PROTOTYPE_SYMBOL_DURATIONS_MS = Object.freeze([
  50, 75, 100, 125, 150, 200,
] as const);
export const PROTOCOL_PROTOTYPE_GAPS_MS = Object.freeze([0, 12, 25, 40, 60] as const);

const PROTOTYPE_MAGIC = [0x5a, 0x50] as const;
const PROTOTYPE_VERSION = 1;
const PROTOTYPE_HEADER_BYTES = 4;
const PROTOTYPE_CHECKSUM_BYTES = 2;

export const protocolPrototypeRecipeSchema = z.object({
  name: z.string().trim().min(3).max(48),
  baseFrequencyHz: z.number().int().min(300).max(1_600),
  frequencySpacingHz: z.number().int().min(25).max(120),
  sampleRateHz: z.number().int().refine(
    rate => PROTOCOL_PROTOTYPE_SAMPLE_RATES.includes(rate as (typeof PROTOCOL_PROTOTYPE_SAMPLE_RATES)[number]),
    'Choose one of the listed sample rates.',
  ),
  symbolDurationMs: z.number().int().refine(
    duration => PROTOCOL_PROTOTYPE_SYMBOL_DURATIONS_MS.includes(
      duration as (typeof PROTOCOL_PROTOTYPE_SYMBOL_DURATIONS_MS)[number],
    ),
    'Choose one of the listed symbol durations.',
  ),
  interSymbolGapMs: z.number().int().refine(
    gap => PROTOCOL_PROTOTYPE_GAPS_MS.includes(gap as (typeof PROTOCOL_PROTOTYPE_GAPS_MS)[number]),
    'Choose one of the listed symbol gaps.',
  ),
  outputLevel: z.number().min(0.01).max(0.08),
}).strict().superRefine((recipe, context) => {
  const highestFrequency = recipe.baseFrequencyHz + 15 * recipe.frequencySpacingHz;
  if (highestFrequency > 3_500 || highestFrequency >= recipe.sampleRateHz / 2) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['frequencySpacingHz'],
      message: 'The highest tone must stay at or below 3,500 Hz and below Nyquist.',
    });
  }
});

export type ProtocolPrototypeRecipe = z.infer<typeof protocolPrototypeRecipeSchema>;

export type ProtocolPrototypeManifest = {
  contractVersion: typeof PROTOCOL_PROTOTYPE_CONTRACT_VERSION;
  protocolId: string;
  wireVersion: 1;
  status: 'draft-not-registered';
  executionMode: 'fixed-declarative-kernel';
  recipe: ProtocolPrototypeRecipe;
  encoderPipeline: string[];
  decoderPipeline: string[];
  security: {
    checksum: 'CRC-16/CCITT error detection';
    senderAuthenticated: false;
    encrypted: false;
    generatedSourceExecuted: false;
  };
};

export type ProtocolPrototypePacket = {
  protocolId: string;
  wireVersion: 1;
  symbols: number[];
  payloadByteLength: number;
  encodedDurationSeconds: number;
  checksum: number;
};

const protocolPrototypePacketSchema = z.object({
  protocolId: z.string().min(1).max(110),
  wireVersion: z.literal(1),
  symbols: z.array(z.number().int().min(0).max(15))
    .min(PROTOCOL_PROTOTYPE_SYNC_SYMBOLS.length + 2 * (PROTOTYPE_HEADER_BYTES + PROTOTYPE_CHECKSUM_BYTES))
    .max(PROTOCOL_PROTOTYPE_MAX_SYMBOLS),
  payloadByteLength: z.number().int().min(1).max(PROTOCOL_PROTOTYPE_MAX_MESSAGE_BYTES),
  encodedDurationSeconds: z.number().positive().max(PROTOCOL_PROTOTYPE_MAX_DURATION_SECONDS),
  checksum: z.number().int().min(0).max(0xffff),
}).strict();

export type ProtocolPrototypeDecodeResult = {
  protocolId: string;
  wireVersion: 1;
  message: string;
  symbols: number[];
  payloadByteLength: number;
  checksum: 'verified';
};

export type ProtocolPrototypeErrorCode =
  | 'INVALID_RECIPE'
  | 'INVALID_MESSAGE'
  | 'INVALID_SYMBOLS'
  | 'INVALID_FRAME'
  | 'CHECKSUM_FAILED'
  | 'INVALID_UTF8';

export class ProtocolPrototypeError extends Error {
  constructor(
    public readonly code: ProtocolPrototypeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ProtocolPrototypeError';
  }
}

function requireRecipe(input: unknown): ProtocolPrototypeRecipe {
  const parsed = protocolPrototypeRecipeSchema.safeParse(input);
  if (!parsed.success) {
    throw new ProtocolPrototypeError('INVALID_RECIPE', parsed.error.issues[0]?.message ?? 'The prototype settings are invalid.');
  }
  return parsed.data;
}

function protocolSlug(name: string) {
  const slug = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return slug || 'local-draft';
}

function protocolIdFor(recipe: ProtocolPrototypeRecipe) {
  return [
    'zioncore.prototype',
    protocolSlug(recipe.name),
    `b${recipe.baseFrequencyHz}`,
    `s${recipe.frequencySpacingHz}`,
    `r${recipe.sampleRateHz}`,
    `t${recipe.symbolDurationMs}`,
    `g${recipe.interSymbolGapMs}`,
  ].join('.');
}

function bytesToNibbles(bytes: Uint8Array) {
  const symbols: number[] = [];
  for (const byte of bytes) symbols.push(byte >>> 4, byte & 0x0f);
  return symbols;
}

function nibblesToBytes(symbols: readonly number[]) {
  if (symbols.length % 2 !== 0 || symbols.some(symbol => (
    !Number.isInteger(symbol) || symbol < 0 || symbol > 15
  ))) {
    throw new ProtocolPrototypeError('INVALID_SYMBOLS', 'Symbols must be an even-length sequence of nibble values from 0 through 15.');
  }
  const bytes = new Uint8Array(symbols.length / 2);
  for (let index = 0; index < symbols.length; index += 2) {
    bytes[index / 2] = (symbols[index] << 4) | symbols[index + 1];
  }
  return bytes;
}

function estimateDurationSeconds(symbolCount: number, recipe: ProtocolPrototypeRecipe) {
  const symbolSamples = Math.round(recipe.sampleRateHz * recipe.symbolDurationMs / 1000);
  const gapSamples = Math.round(recipe.sampleRateHz * recipe.interSymbolGapMs / 1000);
  const totalSamples = symbolCount * symbolSamples + Math.max(0, symbolCount - 1) * gapSamples;
  return totalSamples / recipe.sampleRateHz;
}

export function createProtocolPrototypeManifest(input: unknown): ProtocolPrototypeManifest {
  const recipe = requireRecipe(input);
  return {
    contractVersion: PROTOCOL_PROTOTYPE_CONTRACT_VERSION,
    protocolId: protocolIdFor(recipe),
    wireVersion: 1,
    status: 'draft-not-registered',
    executionMode: 'fixed-declarative-kernel',
    recipe,
    encoderPipeline: [
      'Encode message as UTF-8 (maximum 24 bytes).',
      'Build ZP/version/length header, append CRC-16/CCITT, then split bytes into 4-bit symbols.',
      'Prefix the fixed synchronization symbols and map each nibble to one bounded tone-table frequency.',
      'Apply the selected tone timing, gap, sample rate, and conservative output level.',
    ],
    decoderPipeline: [
      'Validate synchronization, fixed magic, version, payload length, and exact symbol count.',
      'Verify CRC-16/CCITT before decoding the bounded UTF-8 payload.',
      'Reject malformed symbols, unsupported headers, checksum failures, and invalid UTF-8.',
    ],
    security: {
      checksum: 'CRC-16/CCITT error detection',
      senderAuthenticated: false,
      encrypted: false,
      generatedSourceExecuted: false,
    },
  };
}

export function encodeProtocolPrototypeMessage(
  message: string,
  recipeInput: unknown,
): ProtocolPrototypePacket {
  const recipe = requireRecipe(recipeInput);
  if (typeof message !== 'string' || message.length === 0) {
    throw new ProtocolPrototypeError('INVALID_MESSAGE', 'Enter a non-empty message to encode.');
  }
  const payload = new TextEncoder().encode(message);
  if (payload.length > PROTOCOL_PROTOTYPE_MAX_MESSAGE_BYTES) {
    throw new ProtocolPrototypeError(
      'INVALID_MESSAGE',
      `Prototype messages are limited to ${PROTOCOL_PROTOTYPE_MAX_MESSAGE_BYTES} UTF-8 bytes.`,
    );
  }

  const frame = new Uint8Array(PROTOTYPE_HEADER_BYTES + payload.length);
  frame.set([...PROTOTYPE_MAGIC, PROTOTYPE_VERSION, payload.length]);
  frame.set(payload, PROTOTYPE_HEADER_BYTES);
  const checksum = crc16Ccitt(frame);
  const completeFrame = new Uint8Array(frame.length + PROTOTYPE_CHECKSUM_BYTES);
  completeFrame.set(frame);
  completeFrame[frame.length] = checksum >>> 8;
  completeFrame[frame.length + 1] = checksum & 0xff;

  const symbols = [...PROTOCOL_PROTOTYPE_SYNC_SYMBOLS, ...bytesToNibbles(completeFrame)];
  const encodedDurationSeconds = estimateDurationSeconds(symbols.length, recipe);
  if (symbols.length > PROTOCOL_PROTOTYPE_MAX_SYMBOLS
    || encodedDurationSeconds > PROTOCOL_PROTOTYPE_MAX_DURATION_SECONDS) {
    throw new ProtocolPrototypeError('INVALID_MESSAGE', 'The selected settings would exceed the prototype frame or duration limit.');
  }
  return {
    protocolId: protocolIdFor(recipe),
    wireVersion: PROTOTYPE_VERSION,
    symbols,
    payloadByteLength: payload.length,
    encodedDurationSeconds,
    checksum,
  };
}

export function decodeProtocolPrototypeSymbols(
  inputSymbols: readonly number[],
  recipeInput: unknown,
): ProtocolPrototypeDecodeResult {
  const recipe = requireRecipe(recipeInput);
  if (!Array.isArray(inputSymbols)
    || inputSymbols.length < PROTOCOL_PROTOTYPE_SYNC_SYMBOLS.length + 2 * (PROTOTYPE_HEADER_BYTES + PROTOTYPE_CHECKSUM_BYTES)
    || inputSymbols.length > PROTOCOL_PROTOTYPE_MAX_SYMBOLS) {
    throw new ProtocolPrototypeError('INVALID_SYMBOLS', 'The symbol sequence is empty, too short, or over the prototype limit.');
  }
  const symbols = [...inputSymbols];
  if (symbols.some(symbol => !Number.isInteger(symbol) || symbol < 0 || symbol > 15)) {
    throw new ProtocolPrototypeError('INVALID_SYMBOLS', 'Symbols must be nibble values from 0 through 15.');
  }
  if (!PROTOCOL_PROTOTYPE_SYNC_SYMBOLS.every((symbol, index) => symbols[index] === symbol)) {
    throw new ProtocolPrototypeError('INVALID_FRAME', 'The prototype synchronization sequence does not match.');
  }

  const frame = nibblesToBytes(symbols.slice(PROTOCOL_PROTOTYPE_SYNC_SYMBOLS.length));
  const payloadByteLength = frame[3];
  const expectedSymbolCount = PROTOCOL_PROTOTYPE_SYNC_SYMBOLS.length
    + 2 * (PROTOTYPE_HEADER_BYTES + payloadByteLength + PROTOTYPE_CHECKSUM_BYTES);
  if (frame[0] !== PROTOTYPE_MAGIC[0]
    || frame[1] !== PROTOTYPE_MAGIC[1]
    || frame[2] !== PROTOTYPE_VERSION
    || payloadByteLength < 1
    || payloadByteLength > PROTOCOL_PROTOTYPE_MAX_MESSAGE_BYTES
    || symbols.length !== expectedSymbolCount) {
    throw new ProtocolPrototypeError('INVALID_FRAME', 'The prototype magic, version, payload length, or frame size is invalid.');
  }

  const checksumOffset = PROTOTYPE_HEADER_BYTES + payloadByteLength;
  const frameWithoutChecksum = frame.slice(0, checksumOffset);
  const suppliedChecksum = (frame[checksumOffset] << 8) | frame[checksumOffset + 1];
  if (crc16Ccitt(frameWithoutChecksum) !== suppliedChecksum) {
    throw new ProtocolPrototypeError('CHECKSUM_FAILED', 'The prototype CRC failed; symbols may be corrupted or incomplete.');
  }

  let message: string;
  try {
    message = new TextDecoder('utf-8', { fatal: true }).decode(
      frame.slice(PROTOTYPE_HEADER_BYTES, checksumOffset),
    );
  } catch {
    throw new ProtocolPrototypeError('INVALID_UTF8', 'The recovered payload is not valid UTF-8.');
  }

  return {
    protocolId: protocolIdFor(recipe),
    wireVersion: PROTOTYPE_VERSION,
    message,
    symbols,
    payloadByteLength,
    checksum: 'verified',
  };
}

export function createProtocolPrototypeWaveform(
  packetInput: ProtocolPrototypePacket,
  recipeInput: unknown,
): Float32Array {
  const recipe = requireRecipe(recipeInput);
  const parsedPacket = protocolPrototypePacketSchema.safeParse(packetInput);
  if (!parsedPacket.success) {
    throw new ProtocolPrototypeError('INVALID_FRAME', 'The prototype packet metadata or symbol list is malformed.');
  }
  const packet = parsedPacket.data;
  if (packet.protocolId !== protocolIdFor(recipe)
    || packet.wireVersion !== PROTOTYPE_VERSION) {
    throw new ProtocolPrototypeError('INVALID_FRAME', 'This packet does not match the selected prototype recipe.');
  }
  const decoded = decodeProtocolPrototypeSymbols(packet.symbols, recipe);
  const frame = nibblesToBytes(packet.symbols.slice(PROTOCOL_PROTOTYPE_SYNC_SYMBOLS.length));
  const checksumOffset = PROTOTYPE_HEADER_BYTES + decoded.payloadByteLength;
  const symbolChecksum = (frame[checksumOffset] << 8) | frame[checksumOffset + 1];
  if (decoded.payloadByteLength !== packet.payloadByteLength
    || symbolChecksum !== packet.checksum
    || estimateDurationSeconds(packet.symbols.length, recipe) !== packet.encodedDurationSeconds) {
    throw new ProtocolPrototypeError('INVALID_FRAME', 'The prototype packet metadata does not match its symbols or timing.');
  }

  const symbolSamples = Math.round(recipe.sampleRateHz * recipe.symbolDurationMs / 1000);
  const gapSamples = Math.round(recipe.sampleRateHz * recipe.interSymbolGapMs / 1000);
  const totalSamples = (packet.symbols.length * symbolSamples)
    + (Math.max(0, packet.symbols.length - 1) * gapSamples);
  if (totalSamples / recipe.sampleRateHz > PROTOCOL_PROTOTYPE_MAX_DURATION_SECONDS) {
    throw new ProtocolPrototypeError('INVALID_MESSAGE', 'The generated waveform exceeds the prototype duration limit.');
  }

  const samples = new Float32Array(totalSamples);
  const fadeSamples = Math.max(1, Math.min(
    Math.round(recipe.sampleRateHz * 0.005),
    Math.floor(symbolSamples / 4),
  ));
  const tonesHz = Array.from(
    { length: 16 },
    (_, symbol) => recipe.baseFrequencyHz + symbol * recipe.frequencySpacingHz,
  );

  packet.symbols.forEach((symbol, symbolIndex) => {
    const start = symbolIndex * (symbolSamples + gapSamples);
    const frequencyHz = tonesHz[symbol];
    const phaseStep = (2 * Math.PI * frequencyHz) / recipe.sampleRateHz;
    for (let index = 0; index < symbolSamples; index += 1) {
      const envelope = Math.min(
        1,
        (index + 1) / fadeSamples,
        (symbolSamples - index) / fadeSamples,
      );
      samples[start + index] = recipe.outputLevel * envelope * Math.sin(phaseStep * index);
    }
  });
  return samples;
}
