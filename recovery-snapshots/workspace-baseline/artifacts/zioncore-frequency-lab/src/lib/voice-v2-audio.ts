export type NativeWavAudio = {
  samples: Float32Array;
  sampleRateHz: number;
  channels: number;
  durationSeconds: number;
  bitDepth: number;
  encoding: 'PCM' | 'IEEE float';
};

function fourCC(view: DataView, offset: number) {
  return String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
}

/**
 * Reads uncompressed RIFF/WAVE samples without AudioContext resampling so the
 * codec receives samples at the file's declared native sample rate.
 */
export function decodeNativeWav(buffer: ArrayBuffer): NativeWavAudio {
  const view = new DataView(buffer);
  if (view.byteLength < 44 || fourCC(view, 0) !== 'RIFF' || fourCC(view, 8) !== 'WAVE') {
    throw new Error('This WAV is incomplete or is not a RIFF/WAVE file.');
  }
  const riffEnd = view.getUint32(4, true) + 8;
  if (riffEnd !== view.byteLength) throw new Error('The WAV file has an invalid or truncated RIFF length.');

  let format: { code: number; channels: number; rate: number; byteRate: number; blockAlign: number; depth: number } | null = null;
  let dataOffset = -1;
  let dataBytes = 0;
  for (let offset = 12; offset < riffEnd;) {
    if (offset + 8 > riffEnd) throw new Error('The WAV contains an incomplete chunk header.');
    const name = fourCC(view, offset);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const end = start + size;
    if (end > riffEnd) throw new Error('The WAV contains a truncated chunk.');
    if (name === 'fmt ') {
      if (format || size < 16) throw new Error('The WAV format chunk is invalid.');
      format = {
        code: view.getUint16(start, true),
        channels: view.getUint16(start + 2, true),
        rate: view.getUint32(start + 4, true),
        byteRate: view.getUint32(start + 8, true),
        blockAlign: view.getUint16(start + 12, true),
        depth: view.getUint16(start + 14, true),
      };
    } else if (name === 'data') {
      if (dataOffset >= 0) throw new Error('The WAV contains multiple data chunks.');
      dataOffset = start;
      dataBytes = size;
    }
    offset = end + (size % 2);
  }
  if (!format || dataOffset < 0) throw new Error('The WAV must contain one format chunk and one data chunk.');
  const { code, channels, rate, byteRate, blockAlign, depth } = format;
  if (![1, 3].includes(code)) throw new Error('Only uncompressed PCM or IEEE-float WAV audio is supported.');
  if (channels < 1 || channels > 8) throw new Error('WAV channel count must be between 1 and 8.');
  if (!Number.isSafeInteger(rate) || rate < 8_000 || rate > 192_000) throw new Error('WAV sample rate must be between 8 kHz and 192 kHz.');
  const validDepth = code === 1 ? [8, 16, 24, 32].includes(depth) : depth === 32;
  if (!validDepth) throw new Error('Supported WAV is PCM at 8/16/24/32 bits or IEEE float at 32 bits.');
  const bytesPerSample = depth / 8;
  const expectedAlign = channels * bytesPerSample;
  if (blockAlign !== expectedAlign || byteRate !== rate * expectedAlign || dataBytes === 0 || dataBytes % blockAlign !== 0) {
    throw new Error('The WAV format, sample layout, and data length do not agree.');
  }
  const frameCount = dataBytes / blockAlign;
  if (frameCount / rate > 80) throw new Error('Audio exceeds the 80-second local processing limit.');
  const samples = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      const offset = dataOffset + frame * blockAlign + channel * bytesPerSample;
      let value: number;
      if (code === 3) {
        value = view.getFloat32(offset, true);
        if (!Number.isFinite(value) || value < -1 || value > 1) throw new Error('The WAV contains an invalid float sample.');
      } else if (depth === 8) value = (view.getUint8(offset) - 128) / 128;
      else if (depth === 16) value = view.getInt16(offset, true) / 32768;
      else if (depth === 24) {
        let integer = view.getUint8(offset) | (view.getUint8(offset + 1) << 8) | (view.getUint8(offset + 2) << 16);
        if (integer & 0x800000) integer -= 0x1000000;
        value = integer / 0x800000;
      } else value = view.getInt32(offset, true) / 0x80000000;
      sum += value;
    }
    samples[frame] = sum / channels;
  }
  return {
    samples,
    sampleRateHz: rate,
    channels,
    durationSeconds: frameCount / rate,
    bitDepth: depth,
    encoding: code === 1 ? 'PCM' : 'IEEE float',
  };
}

/** Source-rate labels must never fall back to a browser's decoded output rate. */
export function sourceRateLabel(originalSampleRateHz: number | null) {
  return originalSampleRateHz == null ? 'Unavailable' : `${(originalSampleRateHz / 1000).toFixed(2)} kHz`;
}
