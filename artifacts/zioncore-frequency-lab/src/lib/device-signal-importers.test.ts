import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  analyzeEnvironmentalCsv,
  analyzeIqRecording,
  analyzeVibrationCsv,
  demodulateIqRecording,
  encodeMonoPcmWav,
  assessAbove20kHzDigitalRange,
  isVibrationCsv,
  inspectWavMetadata,
} from './device-signal-importers';

function wavFixture(sampleRate = 96_000, metadata = ''): ArrayBuffer {
  const metadataChunk = metadata ? 8 + metadata.length + (metadata.length % 2) : 0;
  const buffer = new ArrayBuffer(44 + metadataChunk);
  const view = new DataView(buffer);
  const writeTag = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
  };
  writeTag(0, 'RIFF');
  view.setUint32(4, buffer.byteLength - 8, true);
  writeTag(8, 'WAVE');
  writeTag(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeTag(36, 'data');
  view.setUint32(40, 0, true);
  if (metadata) {
    writeTag(44, 'ICMT');
    view.setUint32(48, metadata.length, true);
    writeTag(52, metadata);
  }
  return buffer;
}

test('reads sample rate, channel count, and device identity only from actual metadata', () => {
  const generic = inspectWavMetadata('audiomoth_session.wav', wavFixture());
  assert.equal(generic.sampleRateHz, 96_000);
  assert.deepEqual(generic.above20kHzDigitalRange, {
    lowerHz: 20_000,
    upperHz: 48_000,
    digitallyRepresentable: true,
    inputResponseVerified: false,
  });
  assert.equal(generic.channels, 1);
  assert.equal(generic.recognizedDevice, 'generic WAV');

  const identified = inspectWavMetadata('recording.wav', wavFixture(192_000, 'AudioMoth firmware recording'));
  assert.equal(identified.sampleRateHz, 192_000);
  assert.equal(identified.recognizedDevice, 'AudioMoth');
});

test('reports digital ultrasonic range from Nyquist without claiming sensor bandwidth', () => {
  assert.deepEqual(assessAbove20kHzDigitalRange(32_000), {
    lowerHz: 20_000,
    upperHz: null,
    digitallyRepresentable: false,
    inputResponseVerified: false,
  });
  assert.equal(assessAbove20kHzDigitalRange(40_000).digitallyRepresentable, false);
  assert.deepEqual(assessAbove20kHzDigitalRange(48_000), {
    lowerHz: 20_000,
    upperHz: 24_000,
    digitallyRepresentable: true,
    inputResponseVerified: false,
  });
  assert.equal(assessAbove20kHzDigitalRange(192_000).upperHz, 96_000);
  assert.throws(() => assessAbove20kHzDigitalRange(192_001), /8 kHz to 192 kHz/);
});

test('rejects malformed WAV chunks instead of returning misleading metadata', () => {
  const malformed = wavFixture();
  const view = new DataView(malformed);
  view.setUint32(16, 10_000, true);
  assert.throws(() => inspectWavMetadata('bad.wav', malformed), /truncated chunk/);
  const invalidRiffLength = wavFixture();
  new DataView(invalidRiffLength).setUint32(4, invalidRiffLength.byteLength + 10, true);
  assert.throws(() => inspectWavMetadata('bad-length.wav', invalidRiffLength), /RIFF length/);
  const invalidDepth = wavFixture();
  new DataView(invalidDepth).setUint16(34, 7, true);
  assert.throws(() => inspectWavMetadata('bad-depth.wav', invalidDepth), /unsupported channel or sample-rate metadata/);
});

test('analyzes timestamped acceleration CSV and keeps physical units distinct', () => {
  const sampleRate = 128;
  const rows = ['timestamp,x (m/s^2),y (m/s^2),z (m/s^2)'];
  for (let index = 0; index < sampleRate * 2; index += 1) {
    const time = index / sampleRate;
    rows.push(`${time},${Math.sin(2 * Math.PI * 4 * time)},${0.5 * Math.sin(2 * Math.PI * 8 * time)},9.81`);
  }
  const result = analyzeVibrationCsv(rows.join('\n'));
  assert.equal(result.sampleCount, sampleRate * 2);
  assert.equal(result.unit, 'm/s²');
  assert.ok(Math.abs(result.sampleRateHz - sampleRate) < 0.01);
  assert.ok(Math.abs(result.dominantFrequencyHz.x - 4) < 0.1);
  assert.ok(result.timestampJitterPercent < 0.01);
});

test('rejects missing axes, non-monotonic timestamps, and badly irregular streams', () => {
  assert.throws(() => analyzeVibrationCsv('time,x,y\n0,1,2\n1,2,3\n2,3,4\n3,4,5\n4,5,6\n5,6,7\n6,7,8\n7,8,9'), /x, y, z/);
  assert.throws(() => analyzeVibrationCsv('time,x,y,z\n0,1,1,1\n1,1,1,1\n0.5,1,1,1\n2,1,1,1\n3,1,1,1\n4,1,1,1\n5,1,1,1\n6,1,1,1'), /increase strictly/);
  const irregular = ['time,x,y,z'];
  let time = 0;
  for (let index = 0; index < 16; index += 1) {
    irregular.push(`${time},${index},${index},${index}`);
    time += index % 2 ? 0.01 : 0.1;
  }
  assert.throws(() => analyzeVibrationCsv(irregular.join('\n')), /variation exceeds 10%/);
});

test('summarizes environmental CSV in source units without inventing a frequency spectrum', () => {
  const rows = [
    'timestamp,Temperature (°C),Humidity [%]',
    '0,20,48',
    '60,20.4,49',
    '120,20.2,50',
    '180,21,51',
    '240,21.2,52',
  ];
  const text = rows.join('\n');
  assert.equal(isVibrationCsv(text), false);
  const result = analyzeEnvironmentalCsv(text);
  assert.equal(result.sampleCount, 5);
  assert.equal(result.parameters[0].name, 'Temperature');
  assert.equal(result.parameters[0].unit, '°C');
  assert.equal(result.parameters[0].minimum, 20);
  assert.equal(result.parameters[0].maximum, 21.2);
  assert.equal(result.parameters[1].unit, '%');
  assert.ok(result.parameters[0].trendPerHour > 0);
  assert.throws(() => analyzeEnvironmentalCsv([
    'time,temp (C)',
    '0,20',
    '1,',
    '2,21',
    '3,22',
    '4,23',
  ].join('\n')), /empty measurement/);
  const excessive = ['time,' + Array.from({ length: 11 }, (_, index) => `sensor${index}`).join(',')];
  for (let row = 0; row < 100_000; row += 1) {
    excessive.push(`${row},${Array(11).fill('1').join(',')}`);
  }
  assert.throws(() => analyzeEnvironmentalCsv(excessive.join('\n')), /one-million-value/);
});

test('analyzes complex float IQ with centre-frequency offset and reports bin resolution', () => {
  const sampleRate = 48_000;
  const size = 1024;
  const offsetHz = 1_500;
  const data = new ArrayBuffer(size * 8);
  const view = new DataView(data);
  for (let index = 0; index < size; index += 1) {
    const angle = 2 * Math.PI * offsetHz * index / sampleRate;
    view.setFloat32(index * 8, 0.5 * Math.cos(angle), true);
    view.setFloat32(index * 8 + 4, 0.5 * Math.sin(angle), true);
  }
  const result = analyzeIqRecording(data, 'sample.cfile', 'cf32', 100_000_000, sampleRate);
  assert.equal(result.sampleCount, size);
  assert.equal(result.resolutionHz, sampleRate / size);
  assert.ok(Math.abs(result.dominantFrequencyHz - (100_000_000 + offsetHz)) <= result.resolutionHz);
  assert.ok(result.peakRelativeDbfs < 0 && result.peakRelativeDbfs > -20);
  assert.equal(result.spectrumRelativeDb.length, 128);
  assert.ok(Math.max(...result.spectrumRelativeDb) <= 0.01);
});

test('validates IQ framing, format suffixes, and requested physical metadata', () => {
  assert.throws(() => analyzeIqRecording(new ArrayBuffer(5), 'bad.cu8', 'cu8', 100_000_000, 2_400_000), /does not align/);
  assert.throws(() => analyzeIqRecording(new ArrayBuffer(32), 'wrong.cs8', 'cu8', 100_000_000, 2_400_000), /conflicts/);
  assert.throws(() => analyzeIqRecording(new ArrayBuffer(32), 'ok.cu8', 'cu8', 100_000_000, 0), /sample rate/);
});

test('demodulates IQ into a valid local WAV container', () => {
  const sampleRate = 48_000;
  const sampleCount = sampleRate;
  const data = new ArrayBuffer(sampleCount * 8);
  const view = new DataView(data);
  for (let index = 0; index < sampleCount; index += 1) {
    const angle = 2 * Math.PI * 2_000 * index / sampleRate;
    view.setFloat32(index * 8, Math.cos(angle), true);
    view.setFloat32(index * 8 + 4, Math.sin(angle), true);
  }
  const fm = demodulateIqRecording(data, 'cf32', 'fm', sampleRate);
  assert.equal(fm.sampleRateHz, sampleRate);
  assert.equal(fm.samples.length, sampleCount);
  const wav = encodeMonoPcmWav(fm.samples, fm.sampleRateHz);
  const wavView = new DataView(wav);
  assert.equal(String.fromCharCode(...new Uint8Array(wav, 0, 4)), 'RIFF');
  assert.equal(wavView.getUint32(24, true), sampleRate);
  assert.equal(wavView.getUint32(40, true), sampleCount * 2);
});
