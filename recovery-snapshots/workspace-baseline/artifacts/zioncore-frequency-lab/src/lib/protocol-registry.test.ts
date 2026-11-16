import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ACOUSTIC_MESSAGE_PROTOCOL,
  ACOUSTIC_VOICE_PROTOCOL,
} from '@/lib/acoustic-message';
import {
  CELESTIAL_MAX_MESSAGE_BYTES,
  CELESTIAL_PROTOCOL_ID,
} from '@/lib/celestial-experiment';
import { CELESTIAL_AUDIO_DECODER_LIMITS } from '@/lib/celestial-audio';
import {
  acousticTextAdapter,
  acousticVoiceAdapter,
  experimentalDtmfAdapter,
  getProtocolAdapter,
  PROTOCOL_REGISTRY_CONTRACT_VERSION,
  ProtocolRegistry,
  protocolDescriptorSchema,
  protocolRegistry,
} from '@/lib/protocol-registry';

const MESSAGE_ID = '00112233445566778899aabbccddeeff';

test('built-in registry describes existing wire versions without changing their source constants', () => {
  const descriptors = protocolRegistry.list();
  assert.equal(descriptors.length, 3);
  assert.equal(new Set(descriptors.map(item => `${item.protocolId}@${item.wireVersion}`)).size, 3);
  assert.ok(descriptors.every(item => item.contractVersion === PROTOCOL_REGISTRY_CONTRACT_VERSION));
  assert.equal(protocolRegistry.get('zioncore.acoustic-message', 1)?.signal.sampleRateHz, ACOUSTIC_MESSAGE_PROTOCOL.sampleRateHz);
  assert.equal(protocolRegistry.get('zioncore.acoustic-voice', 2)?.signal.carrierFrequenciesHz.length, ACOUSTIC_VOICE_PROTOCOL.carriersHz.length);
  assert.equal(protocolRegistry.get(CELESTIAL_PROTOCOL_ID, 1)?.payload.maximumBytes, CELESTIAL_MAX_MESSAGE_BYTES);
  for (const descriptor of descriptors) {
    assert.ok(getProtocolAdapter(descriptor.protocolId, descriptor.wireVersion));
  }
  assert.equal(getProtocolAdapter('future.protocol', 1), undefined);
  assert.equal(protocolRegistry.get('not-registered', 1), undefined);
  assert.equal(Object.isFrozen(descriptors), true);
  assert.equal(Object.isFrozen(descriptors[0]), true);
});

test('registry rejects duplicate versions and unsafe or malformed metadata', () => {
  const first = protocolRegistry.list()[0];
  assert.throws(() => new ProtocolRegistry([first, first]), /already contains/);
  assert.equal(protocolDescriptorSchema.safeParse({ ...first, security: { ...first.security, encrypted: true } }).success, false);
  assert.throws(() => protocolRegistry.register(first), /already contains/);
  const extension = { ...first, protocolId: 'example.research-protocol', wireVersion: 1 };
  const privateRegistry = new ProtocolRegistry([extension]);
  assert.equal(privateRegistry.get('example.research-protocol', 1)?.maturity, 'locally-verified');
  assert.equal(protocolRegistry.get('example.research-protocol', 1), undefined);
});

test('text adapter round-trips text and prayer through the existing acoustic receiver', () => {
  for (const payloadType of ['text', 'prayer'] as const) {
    const encoded = acousticTextAdapter.encode({
      text: 'Mwari ndi Mwari',
      payloadType,
      messageId: MESSAGE_ID,
    });
    const decoded = acousticTextAdapter.decode({
      samples: encoded.samples,
      sampleRateHz: encoded.sampleRateHz,
    });
    assert.equal(encoded.protocolVersion, ACOUSTIC_MESSAGE_PROTOCOL.version);
    assert.equal(decoded.text, 'Mwari ndi Mwari');
    assert.equal(decoded.payloadType, payloadType);
    assert.equal(decoded.messageId, MESSAGE_ID);
    assert.equal(decoded.integrity, 'verified');
    assert.equal(decoded.senderAuthenticated, false);
  }
});

test('Voice V2 adapter uses the existing encoder, resampling receiver, and audio payload', () => {
  const samples = Float32Array.from({ length: 2_000 }, (_, index) => (
    0.2 * Math.sin((2 * Math.PI * 440 * index) / 8_000)
  ));
  const encoded = acousticVoiceAdapter.encode({
    samples,
    sampleRateHz: 8_000,
    messageId: MESSAGE_ID,
  });
  const decoded = acousticVoiceAdapter.decode({
    samples: encoded.samples,
    sampleRateHz: encoded.sampleRateHz,
  });
  assert.equal(encoded.protocolVersion, ACOUSTIC_VOICE_PROTOCOL.version);
  assert.equal(encoded.sampleRateHz, ACOUSTIC_VOICE_PROTOCOL.sampleRateHz);
  assert.equal(decoded.payloadType, 'voice');
  assert.equal(decoded.audioSampleRateHz, ACOUSTIC_VOICE_PROTOCOL.sourceSampleRateHz);
  assert.equal(decoded.messageId, MESSAGE_ID);
  assert.equal(decoded.integrity, 'verified');
  assert.equal(decoded.senderAuthenticated, false);
});

test('experimental DTMF adapters decode symbols and audio without changing the existing packet ID', () => {
  const encoded = experimentalDtmfAdapter.encode({
    text: 'Kwazi',
    symbolDurationMs: 75,
  });
  assert.equal(encoded.protocolId, CELESTIAL_PROTOCOL_ID);
  assert.equal(experimentalDtmfAdapter.decode(encoded.symbols), 'Kwazi');
  const descriptor = protocolRegistry.get(CELESTIAL_PROTOCOL_ID, 1);
  assert.ok(descriptor);
  assert.equal(descriptor.limits.maximumSourceDurationSeconds, CELESTIAL_AUDIO_DECODER_LIMITS.maximumDurationSeconds);
  assert.equal(descriptor.decoder.inputSampleRateHz, null);
  assert.match(descriptor.decoder.input, /Numeric nibble sequence/);
  assert.equal(descriptor.audioDecoder?.exportName, 'decodeCelestialAudio');
  assert.equal(descriptor.audioDecoder?.inputSampleRateHz.minimumHz, 8_000);
  assert.equal(descriptor.audioDecoder?.inputSampleRateHz.maximumHz, 96_000);
  assert.equal(descriptor.security.senderAuthenticated, false);
});
