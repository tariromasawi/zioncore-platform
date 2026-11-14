import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ProtocolPrototypeSandbox from '@/components/protocol-prototype-sandbox';
import {
  createProtocolPrototypeManifest,
  createProtocolPrototypeWaveform,
  decodeProtocolPrototypeSymbols,
  encodeProtocolPrototypeMessage,
  PROTOCOL_PROTOTYPE_MAX_DURATION_SECONDS,
  PROTOCOL_PROTOTYPE_MAX_MESSAGE_BYTES,
  protocolPrototypeRecipeSchema,
  ProtocolPrototypeError,
  type ProtocolPrototypeRecipe,
} from '@/lib/protocol-prototype';

const DEFAULT_RECIPE: ProtocolPrototypeRecipe = {
  name: 'Tone Grid Draft',
  baseFrequencyHz: 500,
  frequencySpacingHz: 100,
  sampleRateHz: 44_100,
  symbolDurationMs: 100,
  interSymbolGapMs: 12,
  outputLevel: 0.04,
};

test('declarative prototype round-trips UTF-8 symbols without registering or executing generated source', () => {
  const message = 'Mwari ndi Mwari';
  const manifest = createProtocolPrototypeManifest(DEFAULT_RECIPE);
  const packet = encodeProtocolPrototypeMessage(message, DEFAULT_RECIPE);
  const decoded = decodeProtocolPrototypeSymbols(packet.symbols, DEFAULT_RECIPE);

  assert.match(manifest.protocolId, /^zioncore\.prototype\.tone-grid-draft\./);
  assert.equal(manifest.status, 'draft-not-registered');
  assert.equal(manifest.executionMode, 'fixed-declarative-kernel');
  assert.equal(manifest.security.generatedSourceExecuted, false);
  assert.equal(decoded.message, message);
  assert.equal(decoded.checksum, 'verified');
  assert.equal(decoded.payloadByteLength, new TextEncoder().encode(message).length);
});

test('waveform generation respects the recipe sample rate, duration, and low output ceiling', () => {
  for (const sampleRateHz of [8_000, 16_000, 22_050, 44_100, 48_000, 96_000]) {
    const recipe = { ...DEFAULT_RECIPE, sampleRateHz };
    const packet = encodeProtocolPrototypeMessage('Safe local preview.', recipe);
    const samples = createProtocolPrototypeWaveform(packet, recipe);
    const expectedLength = Math.round(packet.encodedDurationSeconds * sampleRateHz);

    assert.ok(Math.abs(samples.length - expectedLength) <= 1);
    assert.ok(samples.length / sampleRateHz <= PROTOCOL_PROTOTYPE_MAX_DURATION_SECONDS);
    assert.ok(samples.every(sample => Number.isFinite(sample) && Math.abs(sample) <= 0.04));
  }
});

test('a changed tone table or timing receives a distinct draft protocol identifier', () => {
  const original = createProtocolPrototypeManifest(DEFAULT_RECIPE);
  const changed = createProtocolPrototypeManifest({
    ...DEFAULT_RECIPE,
    baseFrequencyHz: DEFAULT_RECIPE.baseFrequencyHz + 100,
  });
  assert.notEqual(original.protocolId, changed.protocolId);
});

test('strict recipe validation rejects code payloads, out-of-band tones, and unsafe levels', () => {
  assert.equal(protocolPrototypeRecipeSchema.safeParse({
    ...DEFAULT_RECIPE,
    generatedSource: 'globalThis.secret = true',
  }).success, false);
  assert.equal(protocolPrototypeRecipeSchema.safeParse({
    ...DEFAULT_RECIPE,
    baseFrequencyHz: 3_900,
  }).success, false);
  assert.equal(protocolPrototypeRecipeSchema.safeParse({
    ...DEFAULT_RECIPE,
    outputLevel: 0.9,
  }).success, false);
  assert.throws(
    () => encodeProtocolPrototypeMessage('Hello', { ...DEFAULT_RECIPE, generatedSource: 'eval(...)' }),
    error => error instanceof ProtocolPrototypeError && error.code === 'INVALID_RECIPE',
  );
});

test('symbol corruption and malformed frames are rejected before a result is returned', () => {
  const packet = encodeProtocolPrototypeMessage('Checksum test.', DEFAULT_RECIPE);
  const corrupted = [...packet.symbols];
  corrupted[14] = (corrupted[14] + 1) % 16;
  assert.throws(
    () => decodeProtocolPrototypeSymbols(corrupted, DEFAULT_RECIPE),
    error => error instanceof ProtocolPrototypeError && error.code === 'CHECKSUM_FAILED',
  );
  assert.throws(
    () => decodeProtocolPrototypeSymbols([1, 2, 3], DEFAULT_RECIPE),
    error => error instanceof ProtocolPrototypeError && error.code === 'INVALID_SYMBOLS',
  );
});

test('messages are bounded by UTF-8 bytes, not JavaScript character count', () => {
  assert.throws(
    () => encodeProtocolPrototypeMessage('x'.repeat(PROTOCOL_PROTOTYPE_MAX_MESSAGE_BYTES + 1), DEFAULT_RECIPE),
    error => error instanceof ProtocolPrototypeError && error.code === 'INVALID_MESSAGE',
  );
  const validMultiByteMessage = 'ñ'.repeat(12);
  const packet = encodeProtocolPrototypeMessage(validMultiByteMessage, DEFAULT_RECIPE);
  assert.equal(packet.payloadByteLength, PROTOCOL_PROTOTYPE_MAX_MESSAGE_BYTES);
  assert.equal(decodeProtocolPrototypeSymbols(packet.symbols, DEFAULT_RECIPE).message, validMultiByteMessage);
});

test('prototype workbench discloses its draft status and refuses dynamic code execution', () => {
  const html = renderToStaticMarkup(createElement(ProtocolPrototypeSandbox));
  assert.match(html, /Draft, not registered/);
  assert.match(html, /fixed declarative kernel/);
  assert.match(html, /No generated or user-provided source is executed/);
  assert.match(html, /CRC is error detection only/);
  assert.doesNotMatch(html, /Execute generated code/i);
  const sandboxSource = readFileSync(new URL('../components/protocol-prototype-sandbox.tsx', import.meta.url), 'utf8');
  assert.match(sandboxSource, /Download WAV/);
  assert.match(sandboxSource, /Export manifest/);
  const implementation = [
    readFileSync(new URL('./protocol-prototype.ts', import.meta.url), 'utf8'),
    sandboxSource,
  ].join('\n');
  assert.doesNotMatch(implementation, /\beval\s*\(|new\s+Function\s*\(|import\s*\(/);
});
