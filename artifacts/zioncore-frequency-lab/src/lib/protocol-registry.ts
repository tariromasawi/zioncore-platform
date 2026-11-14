import { z } from 'zod';
import {
  ACOUSTIC_MESSAGE_PROTOCOL,
  ACOUSTIC_VOICE_PROTOCOL,
  AcousticDecodeError,
  decodeAcousticSamples,
  encodeAcousticMessage,
  encodeAcousticVoiceMessage,
  type DecodedTextAcousticMessage,
  type DecodedVoiceAcousticMessage,
  type EncodedTextAcousticMessage,
  type EncodedVoiceAcousticMessage,
} from '@/lib/acoustic-message';
import {
  CELESTIAL_INTER_SYMBOL_GAP_MS,
  CELESTIAL_MAX_MESSAGE_BYTES,
  CELESTIAL_OUTPUT_LEVEL_OPTIONS,
  CELESTIAL_PROTOCOL_ID,
  CELESTIAL_SAMPLE_RATE_HZ,
  CELESTIAL_SYMBOL_DURATION_OPTIONS,
  decodeCelestialSymbols,
  encodeCelestialMessage,
  type EncodedSignal,
} from '@/lib/celestial-experiment';
import { CELESTIAL_AUDIO_DECODER_LIMITS } from '@/lib/celestial-audio';

export const PROTOCOL_REGISTRY_CONTRACT_VERSION = '1.0.0';

const rateRangeSchema = z.object({
  minimumHz: z.number().int().positive(),
  maximumHz: z.number().int().positive(),
}).strict().refine(range => range.minimumHz <= range.maximumHz);

export const protocolDescriptorSchema = z.object({
  contractVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  protocolId: z.string().min(1).max(100),
  wireVersion: z.number().int().min(1).max(255),
  name: z.string().min(1).max(140),
  maturity: z.enum(['locally-verified', 'experimental-local']),
  payload: z.object({
    kind: z.string().min(1).max(80),
    format: z.string().min(1).max(160),
    maximumBytes: z.number().int().positive().max(100_000),
  }).strict(),
  limits: z.object({
    minimumSourceDurationSeconds: z.number().positive().nullable(),
    maximumSourceDurationSeconds: z.number().positive().nullable(),
    maximumSymbolCount: z.number().int().positive().nullable(),
  }).strict(),
  encoder: z.object({
    adapterId: z.string().min(1).max(100),
    exportName: z.string().min(1).max(120),
    input: z.string().min(1).max(200),
    output: z.string().min(1).max(200),
  }).strict(),
  decoder: z.object({
    adapterId: z.string().min(1).max(100),
    exportName: z.string().min(1).max(120),
    input: z.string().min(1).max(200),
    output: z.string().min(1).max(200),
    inputSampleRateHz: rateRangeSchema.nullable(),
  }).strict(),
  audioDecoder: z.object({
    adapterId: z.string().min(1).max(100),
    exportName: z.string().min(1).max(120),
    input: z.string().min(1).max(200),
    output: z.string().min(1).max(200),
    inputSampleRateHz: rateRangeSchema,
  }).strict().optional(),
  signal: z.object({
    modulation: z.string().min(1).max(100),
    sampleRateHz: z.number().int().positive().max(192_000),
    carrierFrequenciesHz: z.array(z.number().positive()).min(1).max(16),
    symbolDurationMs: z.array(z.number().positive()).min(1).max(4),
    interSymbolGapMs: z.number().nonnegative(),
    leadingSilenceMs: z.number().nonnegative(),
    trailingSilenceMs: z.number().nonnegative(),
    nominalBitsPerSecond: z.number().positive().nullable(),
  }).strict(),
  framing: z.object({
    preamble: z.string().min(1).max(160),
    magic: z.string().min(1).max(32),
    headerBytes: z.number().int().nonnegative().max(256),
    checksum: z.string().min(1).max(200),
  }).strict(),
  compatibility: z.object({
    wireCompatibleWith: z.array(z.string().min(1).max(100)),
    decoderSupports: z.array(z.string().min(1).max(100)),
    notes: z.array(z.string().min(1).max(500)).min(1).max(8),
  }).strict(),
  security: z.object({
    integrityMechanism: z.string().min(1).max(100),
    senderAuthenticated: z.literal(false),
    encrypted: z.literal(false),
    integrityIsNotAuthentication: z.literal(true),
  }).strict(),
  verification: z.object({
    scope: z.enum([
      'local-round-trip-fixtures',
      'local-symbol-round-trip',
      'local-audio-round-trip',
      'local-symbol-and-audio-round-trip',
    ]),
    note: z.string().min(1).max(500),
  }).strict(),
}).strict();

export type ProtocolDescriptor = z.infer<typeof protocolDescriptorSchema>;
export type ProtocolAdapter<EncodeInput, Encoded, DecodeInput, Decoded> = Readonly<{
  protocolId: string;
  wireVersion: number;
  encode: (input: EncodeInput) => Encoded;
  decode: (input: DecodeInput) => Decoded;
}>;

export type AcousticAudioInput = {
  samples: Float32Array;
  sampleRateHz: number;
};

export type TextMessageInput = {
  text: string;
  payloadType?: 'text' | 'prayer';
  messageId?: string;
};

export type VoiceMessageInput = AcousticAudioInput & {
  messageId?: string;
};

export const acousticTextAdapter: ProtocolAdapter<
  TextMessageInput,
  EncodedTextAcousticMessage,
  AcousticAudioInput,
  DecodedTextAcousticMessage
> = Object.freeze({
  protocolId: 'zioncore.acoustic-message',
  wireVersion: ACOUSTIC_MESSAGE_PROTOCOL.version,
  encode: input => encodeAcousticMessage(input.text, input.payloadType ?? 'text', {
    ...(input.messageId ? { messageId: input.messageId } : {}),
  }),
  decode: input => {
    const decoded = decodeAcousticSamples(input.samples, input.sampleRateHz);
    if (decoded.payloadType === 'voice') {
      throw new AcousticDecodeError('UNSUPPORTED_PAYLOAD', 'This adapter expects a text or prayer packet.');
    }
    return decoded;
  },
});

export const acousticVoiceAdapter: ProtocolAdapter<
  VoiceMessageInput,
  EncodedVoiceAcousticMessage,
  AcousticAudioInput,
  DecodedVoiceAcousticMessage
> = Object.freeze({
  protocolId: 'zioncore.acoustic-voice',
  wireVersion: ACOUSTIC_VOICE_PROTOCOL.version,
  encode: input => encodeAcousticVoiceMessage(input.samples, input.sampleRateHz, {
    ...(input.messageId ? { messageId: input.messageId } : {}),
  }),
  decode: input => {
    const decoded = decodeAcousticSamples(input.samples, input.sampleRateHz);
    if (decoded.payloadType !== 'voice') {
      throw new AcousticDecodeError('UNSUPPORTED_PAYLOAD', 'This adapter expects a Voice V2 packet.');
    }
    return decoded;
  },
});

export type DtmfMessageInput = {
  text: string;
  symbolDurationMs?: (typeof CELESTIAL_SYMBOL_DURATION_OPTIONS)[number];
};

export const experimentalDtmfAdapter: ProtocolAdapter<
  DtmfMessageInput,
  EncodedSignal,
  number[],
  string
> = Object.freeze({
  protocolId: CELESTIAL_PROTOCOL_ID,
  wireVersion: 1,
  encode: input => encodeCelestialMessage(input.text, input.symbolDurationMs),
  decode: symbols => decodeCelestialSymbols(symbols),
});

export type BuiltInProtocolAdapter =
  | typeof acousticTextAdapter
  | typeof acousticVoiceAdapter
  | typeof experimentalDtmfAdapter;

const builtinAdapters: readonly BuiltInProtocolAdapter[] = Object.freeze([
  acousticTextAdapter,
  acousticVoiceAdapter,
  experimentalDtmfAdapter,
]);

export function getProtocolAdapter(protocolId: string, wireVersion: number) {
  return builtinAdapters.find(adapter => (
    adapter.protocolId === protocolId && adapter.wireVersion === wireVersion
  ));
}

const builtinDescriptors: ProtocolDescriptor[] = [
  {
    contractVersion: PROTOCOL_REGISTRY_CONTRACT_VERSION,
    protocolId: acousticTextAdapter.protocolId,
    wireVersion: ACOUSTIC_MESSAGE_PROTOCOL.version,
    name: 'ZionCore acoustic text and prayer',
    maturity: 'locally-verified',
    payload: {
      kind: 'text-or-prayer',
      format: 'UTF-8 bytes',
      maximumBytes: ACOUSTIC_MESSAGE_PROTOCOL.maxPayloadBytes,
    },
    limits: {
      minimumSourceDurationSeconds: null,
      maximumSourceDurationSeconds: null,
      maximumSymbolCount: (
        ACOUSTIC_MESSAGE_PROTOCOL.preambleBytes.length
        + ACOUSTIC_MESSAGE_PROTOCOL.headerBytes
        + ACOUSTIC_MESSAGE_PROTOCOL.maxPayloadBytes
        + 4
      ) * 8,
    },
    encoder: {
      adapterId: acousticTextAdapter.protocolId,
      exportName: 'encodeAcousticMessage',
      input: 'TextMessageInput',
      output: 'EncodedTextAcousticMessage (mono PCM samples and WAV)',
    },
    decoder: {
      adapterId: acousticTextAdapter.protocolId,
      exportName: 'decodeAcousticSamples',
      input: 'Float32Array samples plus declared sample rate',
      output: 'DecodedTextAcousticMessage',
      inputSampleRateHz: { minimumHz: 8_000, maximumHz: 192_000 },
    },
    signal: {
      modulation: 'binary frequency shift keying (BFSK)',
      sampleRateHz: ACOUSTIC_MESSAGE_PROTOCOL.sampleRateHz,
      carrierFrequenciesHz: [
        ACOUSTIC_MESSAGE_PROTOCOL.carrierZeroHz,
        ACOUSTIC_MESSAGE_PROTOCOL.carrierOneHz,
      ],
      symbolDurationMs: [ACOUSTIC_MESSAGE_PROTOCOL.symbolDurationMs],
      interSymbolGapMs: 0,
      leadingSilenceMs: ACOUSTIC_MESSAGE_PROTOCOL.leadingSilenceMs,
      trailingSilenceMs: ACOUSTIC_MESSAGE_PROTOCOL.trailingSilenceMs,
      nominalBitsPerSecond: 1_000 / ACOUSTIC_MESSAGE_PROTOCOL.symbolDurationMs,
    },
    framing: {
      preamble: ACOUSTIC_MESSAGE_PROTOCOL.preambleBytes.map(byte => byte.toString(16).padStart(2, '0')).join(' ').toUpperCase(),
      magic: 'ZCFI (5A 43 46 49)',
      headerBytes: ACOUSTIC_MESSAGE_PROTOCOL.headerBytes,
      checksum: 'CRC-32/IEEE (reflected polynomial 0xEDB88320, initial and final XOR 0xFFFFFFFF) over header and payload',
    },
    compatibility: {
      wireCompatibleWith: [],
      decoderSupports: ['zioncore.acoustic-message', 'zioncore.acoustic-voice'],
      notes: [
        'The shared local decoder dispatches both registered acoustic versions; their wire modulation and payload codecs are not interchangeable.',
        'The version-1 packet layout remains the existing ZCFI frame. The registry does not alter encoded bytes.',
      ],
    },
    security: {
      integrityMechanism: 'CRC-32/IEEE error detection',
      senderAuthenticated: false,
      encrypted: false,
      integrityIsNotAuthentication: true,
    },
    verification: {
      scope: 'local-round-trip-fixtures',
      note: 'Automated local round-trip, checksum, malformed-frame, noise, and sample-rate fixtures; no device-to-device interoperability claim.',
    },
  },
  {
    contractVersion: PROTOCOL_REGISTRY_CONTRACT_VERSION,
    protocolId: acousticVoiceAdapter.protocolId,
    wireVersion: ACOUSTIC_VOICE_PROTOCOL.version,
    name: 'ZionCore Voice V2',
    maturity: 'locally-verified',
    payload: {
      kind: 'voice-audio',
      format: 'IMA ADPCM 4-bit mono samples at 8 kHz, including an 8-byte codec header',
      maximumBytes: ACOUSTIC_VOICE_PROTOCOL.maxPayloadBytes,
    },
    limits: {
      minimumSourceDurationSeconds: ACOUSTIC_VOICE_PROTOCOL.minRecordingSeconds,
      maximumSourceDurationSeconds: ACOUSTIC_VOICE_PROTOCOL.maxRecordingSeconds,
      maximumSymbolCount: Math.ceil(
        (ACOUSTIC_MESSAGE_PROTOCOL.headerBytes + ACOUSTIC_VOICE_PROTOCOL.maxPayloadBytes + 4) * 8 / 3,
      ) + ACOUSTIC_VOICE_PROTOCOL.preambleSymbols.length,
    },
    encoder: {
      adapterId: acousticVoiceAdapter.protocolId,
      exportName: 'encodeAcousticVoiceMessage',
      input: 'Float32Array audio plus source sample rate (0.25–2 seconds)',
      output: 'EncodedVoiceAcousticMessage (mono PCM samples and WAV)',
    },
    decoder: {
      adapterId: acousticVoiceAdapter.protocolId,
      exportName: 'decodeAcousticSamples',
      input: 'Float32Array samples plus declared source sample rate',
      output: 'DecodedVoiceAcousticMessage (reconstructed 8 kHz audio)',
      inputSampleRateHz: { minimumHz: 16_000, maximumHz: 192_000 },
    },
    signal: {
      modulation: '8-frequency shift keying (8-FSK)',
      sampleRateHz: ACOUSTIC_VOICE_PROTOCOL.sampleRateHz,
      carrierFrequenciesHz: [...ACOUSTIC_VOICE_PROTOCOL.carriersHz],
      symbolDurationMs: [ACOUSTIC_VOICE_PROTOCOL.symbolDurationMs],
      interSymbolGapMs: 0,
      leadingSilenceMs: ACOUSTIC_VOICE_PROTOCOL.leadingSilenceMs,
      trailingSilenceMs: ACOUSTIC_VOICE_PROTOCOL.trailingSilenceMs,
      nominalBitsPerSecond: 3_000 / ACOUSTIC_VOICE_PROTOCOL.symbolDurationMs,
    },
    framing: {
      preamble: `8-FSK symbols: ${ACOUSTIC_VOICE_PROTOCOL.preambleSymbols.join(', ')}`,
      magic: 'ZCFI (5A 43 46 49)',
      headerBytes: ACOUSTIC_MESSAGE_PROTOCOL.headerBytes,
      checksum: 'CRC-32/IEEE (reflected polynomial 0xEDB88320, initial and final XOR 0xFFFFFFFF) over header and voice payload',
    },
    compatibility: {
      wireCompatibleWith: [],
      decoderSupports: ['zioncore.acoustic-message', 'zioncore.acoustic-voice'],
      notes: [
        'Voice uses wire version 2 and 8-FSK; the existing unified decoder attempts supported text and voice versions, but their waveforms are not wire-interchangeable.',
        'Receive-side input is normalized to 48 kHz after validating the source rate; the encoded audio payload reconstructs at 8 kHz.',
        'The version-2 packet layout and transmitter are unchanged by this registry.',
      ],
    },
    security: {
      integrityMechanism: 'CRC-32/IEEE error detection',
      senderAuthenticated: false,
      encrypted: false,
      integrityIsNotAuthentication: true,
    },
    verification: {
      scope: 'local-round-trip-fixtures',
      note: 'Automated local round-trip, multi-rate resampling, checksum, malformed-frame, and noise fixtures; no device-to-device interoperability claim.',
    },
  },
  {
    contractVersion: PROTOCOL_REGISTRY_CONTRACT_VERSION,
    protocolId: CELESTIAL_PROTOCOL_ID,
    wireVersion: 1,
    name: 'ZionCore experimental DTMF symbol packet',
    maturity: 'experimental-local',
    payload: {
      kind: 'text',
      format: 'UTF-8 bytes encoded as hexadecimal nibbles in a DTMF symbol sequence',
      maximumBytes: CELESTIAL_MAX_MESSAGE_BYTES,
    },
    limits: {
      minimumSourceDurationSeconds: null,
      maximumSourceDurationSeconds: CELESTIAL_AUDIO_DECODER_LIMITS.maximumDurationSeconds,
      maximumSymbolCount: 4 + 2 * (5 + CELESTIAL_MAX_MESSAGE_BYTES + 2),
    },
    encoder: {
      adapterId: CELESTIAL_PROTOCOL_ID,
      exportName: 'encodeCelestialMessage',
      input: 'Text plus 50, 75, or 100 ms symbol duration',
      output: 'EncodedSignal (nibble symbols and protocol metadata)',
    },
    decoder: {
      adapterId: CELESTIAL_PROTOCOL_ID,
      exportName: 'decodeCelestialSymbols',
      input: 'Numeric nibble sequence; not captured audio',
      output: 'UTF-8 text after frame and checksum validation',
      inputSampleRateHz: null,
    },
    audioDecoder: {
      adapterId: `${CELESTIAL_PROTOCOL_ID}.audio`,
      exportName: 'decodeCelestialAudio',
      input: 'Mono Float32Array samples plus declared sample rate; 50, 75, or 100 ms symbol duration is detected',
      output: 'Verified UTF-8 text, recovered symbols, detected rate, and timing',
      inputSampleRateHz: { minimumHz: 8_000, maximumHz: 96_000 },
    },
    signal: {
      modulation: 'dual-tone DTMF symbol encoding',
      sampleRateHz: CELESTIAL_SAMPLE_RATE_HZ,
      carrierFrequenciesHz: [697, 770, 852, 941, 1209, 1336, 1477, 1633],
      symbolDurationMs: [...CELESTIAL_SYMBOL_DURATION_OPTIONS],
      interSymbolGapMs: CELESTIAL_INTER_SYMBOL_GAP_MS,
      leadingSilenceMs: 0,
      trailingSilenceMs: 0,
      nominalBitsPerSecond: null,
    },
    framing: {
      preamble: 'Nibble sync sequence: F F A 5',
      magic: 'ZC (5A 43)',
      headerBytes: 5,
      checksum: 'CRC-16/CCITT (polynomial 0x1021, initial 0xFFFF, no reflection or final XOR)',
    },
    compatibility: {
      wireCompatibleWith: [],
      decoderSupports: [CELESTIAL_PROTOCOL_ID],
      notes: [
        'The primary symbol decoder accepts nibble values; a companion local audio decoder accepts supported PCM or IEEE-float WAV samples.',
        'This packet format is separate from the ZCFI acoustic text and voice frames.',
        `Waveform symbols use the registered duration options and a ${CELESTIAL_INTER_SYMBOL_GAP_MS} ms gap; output levels are ${CELESTIAL_OUTPUT_LEVEL_OPTIONS.join(', ')}.`,
      ],
    },
    security: {
      integrityMechanism: 'CRC-16/CCITT error detection',
      senderAuthenticated: false,
      encrypted: false,
      integrityIsNotAuthentication: true,
    },
    verification: {
      scope: 'local-symbol-and-audio-round-trip',
      note: 'Automated local symbol and audio encode/decode fixtures with checksum validation; not verified for physical device interoperability or external protocol compatibility.',
    },
  },
];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

export class ProtocolRegistry {
  private readonly entries = new Map<string, ProtocolDescriptor>();

  constructor(initialEntries: readonly unknown[] = []) {
    initialEntries.forEach(entry => this.register(entry));
  }

  register(value: unknown): ProtocolDescriptor {
    const descriptor = protocolDescriptorSchema.parse(value);
    const key = `${descriptor.protocolId}@${descriptor.wireVersion}`;
    if (this.entries.has(key)) {
      throw new Error(`Protocol registry already contains ${key}.`);
    }
    const frozen = deepFreeze(descriptor);
    this.entries.set(key, frozen);
    return frozen;
  }

  get(protocolId: string, wireVersion: number): ProtocolDescriptor | undefined {
    return this.entries.get(`${protocolId}@${wireVersion}`);
  }

  list(): readonly ProtocolDescriptor[] {
    return Object.freeze([...this.entries.values()]);
  }
}

export const protocolRegistry = new ProtocolRegistry(builtinDescriptors);

