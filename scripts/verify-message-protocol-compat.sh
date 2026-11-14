#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_COMMIT="ca6ff0b252155295315beae1f65fc8e71029ebc1"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cd "$ROOT"

for source_path in \
  artifacts/zioncore-frequency-lab/src/lib/acoustic-message.ts \
  artifacts/zioncore-frequency-lab/src/lib/acoustic-message.test.ts
do
  git cat-file -e "${SOURCE_COMMIT}:${source_path}"
  git show "${SOURCE_COMMIT}:${source_path}" > "$TMP/$(basename "$source_path")"
done

cat > "$TMP/device-compat.test.ts" <<'EOF'
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ACOUSTIC_MESSAGE_PROTOCOL,
  ACOUSTIC_VOICE_PROTOCOL,
  AcousticDecodeError,
  decodeAcousticSamples,
  encodeAcousticMessage,
  encodeAcousticVoiceMessage,
} from './acoustic-message';

const messageId = '00112233445566778899aabbccddeeff';

function resampleLinear(input: Float32Array, fromRate: number, toRate: number) {
  const output = new Float32Array(Math.round(input.length * toRate / fromRate));
  for (let i = 0; i < output.length; i++) {
    const source = i * fromRate / toRate;
    const left = Math.floor(source);
    const fraction = source - left;
    const a = input[Math.min(left, input.length - 1)];
    const b = input[Math.min(left + 1, input.length - 1)];
    output[i] = a + (b - a) * fraction;
  }
  return output;
}

function downmixStereo(left: Float32Array, right: Float32Array) {
  const mono = new Float32Array(left.length);
  for (let i = 0; i < mono.length; i++) mono[i] = (left[i] + right[i]) / 2;
  return mono;
}

function voicePacket() {
  const rate = 48_000;
  const samples = new Float32Array(rate / 4);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = 0.35 * Math.sin(2 * Math.PI * 330 * i / rate);
  }
  return encodeAcousticVoiceMessage(samples, rate, { messageId });
}

test('text packets decode after common sample-rate conversions and stereo downmix', () => {
  const text = 'Mhoroi — Shona, English, שלום, and 🌿';
  const encoded = encodeAcousticMessage(text, 'text', { messageId });
  for (const rate of [8_000, 16_000, 22_050, 32_000, 44_100, 48_000, 96_000]) {
    const samples = resampleLinear(encoded.samples, encoded.sampleRateHz, rate);
    const decoded = decodeAcousticSamples(downmixStereo(samples, samples), rate);
    assert.equal(decoded.payloadType, 'text', `sample rate ${rate}`);
    if (decoded.payloadType === 'text') assert.equal(decoded.text, text, `sample rate ${rate}`);
  }
});

test('voice v2 decodes at tested rates with integer 3 ms symbol lengths', () => {
  const encoded = voicePacket();
  for (const rate of [32_000, 48_000, 96_000]) {
    const samples = resampleLinear(encoded.samples, encoded.sampleRateHz, rate);
    const decoded = decodeAcousticSamples(downmixStereo(samples, samples), rate);
    assert.equal(decoded.payloadType, 'voice', `sample rate ${rate}`);
    if (decoded.payloadType === 'voice') {
      assert.equal(decoded.messageId, messageId);
      assert.equal(decoded.protocolVersion, ACOUSTIC_VOICE_PROTOCOL.version);
    }
  }
});

test('voice v2 exposes fractional-symbol timing failures at 22.05 and 44.1 kHz', () => {
  const encoded = voicePacket();
  for (const rate of [22_050, 44_100]) {
    const samples = resampleLinear(encoded.samples, encoded.sampleRateHz, rate);
    assert.throws(
      () => decodeAcousticSamples(downmixStereo(samples, samples), rate),
      error => error instanceof AcousticDecodeError && error.code === 'INTEGRITY_FAILED',
      `expected the known fractional-symbol timing failure at ${rate} Hz`,
    );
  }
});

test('normalizing those voice recordings back to 48 kHz recovers the unchanged v2 packet', () => {
  const encoded = voicePacket();
  for (const deviceRate of [22_050, 44_100]) {
    const deviceSamples = resampleLinear(encoded.samples, encoded.sampleRateHz, deviceRate);
    const stereoMono = downmixStereo(deviceSamples, deviceSamples);
    const normalized = resampleLinear(stereoMono, deviceRate, ACOUSTIC_VOICE_PROTOCOL.sampleRateHz);
    const decoded = decodeAcousticSamples(normalized, ACOUSTIC_VOICE_PROTOCOL.sampleRateHz);
    assert.equal(decoded.payloadType, 'voice', `source rate ${deviceRate}`);
    if (decoded.payloadType === 'voice') assert.equal(decoded.messageId, messageId);
  }
});

test('unsupported text packet version fails explicitly', () => {
  const encoded = encodeAcousticMessage('Version guard.', 'text', { messageId });
  const damaged = encoded.samples.slice();
  const samplesPerSymbol = Math.round(
    encoded.sampleRateHz * ACOUSTIC_MESSAGE_PROTOCOL.symbolDurationMs / 1_000,
  );
  const leading = Math.round(
    encoded.sampleRateHz * ACOUSTIC_MESSAGE_PROTOCOL.leadingSilenceMs / 1_000,
  );
  const versionBit = ACOUSTIC_MESSAGE_PROTOCOL.preambleBytes.length * 8 + 4 * 8 + 6;
  const start = leading + versionBit * samplesPerSymbol;
  for (let i = 0; i < samplesPerSymbol; i++) {
    damaged[start + i] = 0.22 * Math.sin(
      2 * Math.PI * ACOUSTIC_MESSAGE_PROTOCOL.carrierOneHz * i / encoded.sampleRateHz,
    );
  }
  assert.throws(
    () => decodeAcousticSamples(damaged, encoded.sampleRateHz),
    error => error instanceof AcousticDecodeError && error.code === 'UNSUPPORTED_PROTOCOL',
  );
});
EOF

echo "Testing Messages source commit ${SOURCE_COMMIT}"
pnpm --filter @workspace/zioncore-frequency-lab exec tsx --test \
  "$TMP/acoustic-message.test.ts" \
  "$TMP/device-compat.test.ts"

echo "Testing the recovered current Messages receiver and pinned encoder fixtures"
pnpm --filter @workspace/zioncore-frequency-lab exec tsx --test \
  src/lib/acoustic-message.test.ts \
  src/lib/acoustic-message.sample-rate.test.ts
