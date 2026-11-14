export const MAX_DEVICE_IMPORT_BYTES = 64 * 1024 * 1024;
const MAX_IQ_ANALYSIS_SAMPLES = 8192;
const MAX_VIBRATION_ROWS = 100_000;
const MAX_DEMODULATION_SAMPLES = 5_000_000;

export type WavRecordingMetadata = {
  formatCode: number;
  formatName: string;
  sampleRateHz: number;
  above20kHzDigitalRange: Above20kHzDigitalRange;
  channels: number;
  bitsPerSample: number;
  durationSeconds: number | null;
  metadataText: string[];
  recognizedDevice: 'AudioMoth' | 'Echo Meter Touch' | 'generic WAV';
};

export type Above20kHzDigitalRange = {
  lowerHz: 20_000;
  upperHz: number | null;
  digitallyRepresentable: boolean;
  inputResponseVerified: false;
};

export function assessAbove20kHzDigitalRange(sampleRateHz: number): Above20kHzDigitalRange {
  if (!Number.isInteger(sampleRateHz) || sampleRateHz < 8_000 || sampleRateHz > 192_000) {
    throw new DeviceImportError('WAV sample rate must be an integer from 8 kHz to 192 kHz.');
  }
  const nyquistHz = sampleRateHz / 2;
  const digitallyRepresentable = nyquistHz > 20_000;
  return {
    lowerHz: 20_000,
    upperHz: digitallyRepresentable ? nyquistHz : null,
    digitallyRepresentable,
    inputResponseVerified: false,
  };
}

export type VibrationAnalysis = {
  sampleCount: number;
  sampleRateHz: number;
  nyquistHz: number;
  unit: 'g' | 'm/s²';
  dominantFrequencyHz: { x: number; y: number; z: number; magnitude: number };
  rms: { x: number; y: number; z: number; magnitude: number };
  timestampJitterPercent: number;
};

export type EnvironmentalSeriesAnalysis = {
  sampleCount: number;
  startedAt: string;
  endedAt: string;
  parameters: Array<{
    name: string;
    unit: string;
    count: number;
    minimum: number;
    maximum: number;
    mean: number;
    latest: number;
    trendPerHour: number;
  }>;
};

export type IqFormat = 'cu8' | 'cs8' | 'cf32';
export type IqAnalysis = {
  format: IqFormat;
  sampleCount: number;
  centerFrequencyHz: number;
  sampleRateHz: number;
  nyquistHz: number;
  resolutionHz: number;
  dominantFrequencyHz: number;
  peakRelativeDbfs: number;
  meanPowerDbfs: number;
  spectrumRelativeDb: number[];
};

export class DeviceImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeviceImportError';
  }
}

function ensureFileSize(file: File, maximumBytes = MAX_DEVICE_IMPORT_BYTES): void {
  if (file.size <= 0) throw new DeviceImportError('The selected file is empty.');
  if (file.size > maximumBytes) {
    throw new DeviceImportError(`This file exceeds ZionCore’s ${Math.round(maximumBytes / 1024 / 1024)} MB local import limit.`);
  }
}

function textFromChunk(view: DataView, offset: number, length: number): string {
  const bytes: number[] = [];
  const end = Math.min(view.byteLength, offset + length, offset + 32_768);
  for (let index = offset; index < end; index += 1) {
    const value = view.getUint8(index);
    if (value === 0) {
      if (bytes.length && bytes[bytes.length - 1] !== 32) bytes.push(32);
    } else if (value >= 9 && value <= 13 || value >= 32 && value <= 126) {
      bytes.push(value);
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes)).replace(/\s+/g, ' ').trim();
}

export function inspectWavMetadata(fileName: string, data: ArrayBuffer): WavRecordingMetadata {
  if (data.byteLength < 44) throw new DeviceImportError('The WAV header is incomplete.');
  const view = new DataView(data);
  const tag = (offset: number) => String.fromCharCode(
    view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3),
  );
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') {
    throw new DeviceImportError('This is not a supported RIFF/WAVE recording.');
  }
  const riffEnd = view.getUint32(4, true) + 8;
  if (riffEnd > data.byteLength) {
    throw new DeviceImportError('The WAV RIFF length exceeds the available file data.');
  }
  if (riffEnd < 44) throw new DeviceImportError('The WAV RIFF chunk is too short to contain audio metadata.');

  let formatCode: number | null = null;
  let channels: number | null = null;
  let sampleRateHz: number | null = null;
  let bitsPerSample: number | null = null;
  let dataBytes = 0;
  const metadataText: string[] = [];
  let offset = 12;
  while (offset + 8 <= riffEnd) {
    const chunkId = tag(offset);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkOffset = offset + 8;
    if (chunkSize > riffEnd - chunkOffset) throw new DeviceImportError('The WAV file contains a truncated chunk.');
    if (chunkId === 'fmt ') {
      if (chunkSize < 16) throw new DeviceImportError('The WAV format chunk is invalid.');
      formatCode = view.getUint16(chunkOffset, true);
      channels = view.getUint16(chunkOffset + 2, true);
      sampleRateHz = view.getUint32(chunkOffset + 4, true);
      bitsPerSample = view.getUint16(chunkOffset + 14, true);
    } else if (chunkId === 'data') {
      dataBytes = chunkSize;
    } else if (['LIST', 'bext', 'iXML', 'ID3 ', 'ICMT'].includes(chunkId) && metadataText.length < 32) {
      const extracted = textFromChunk(view, chunkOffset, chunkSize);
      if (extracted) metadataText.push(`${chunkId}: ${extracted}`);
    }
    const next = chunkOffset + chunkSize + (chunkSize % 2);
    if (next <= offset) throw new DeviceImportError('The WAV contains an invalid chunk length.');
    offset = next;
  }

  if (
    formatCode == null || channels == null || sampleRateHz == null || bitsPerSample == null
    || channels < 1 || channels > 8 || sampleRateHz < 8000 || sampleRateHz > 192000
    || ![8, 16, 24, 32, 64].includes(bitsPerSample)
  ) {
    throw new DeviceImportError('The recording has unsupported channel or sample-rate metadata.');
  }
  const formatName = formatCode === 1 ? 'PCM' : formatCode === 3 ? 'IEEE float' : formatCode === 0xfffe ? 'WAVE_FORMAT_EXTENSIBLE' : `Format ${formatCode}`;
  const searchableMetadata = metadataText.join(' ').toLowerCase();
  const recognizedDevice = searchableMetadata.includes('audiomoth')
    ? 'AudioMoth'
    : searchableMetadata.includes('echo meter') || searchableMetadata.includes('wildlife acoustics')
      ? 'Echo Meter Touch'
      : 'generic WAV';

  return {
    formatCode,
    formatName,
    sampleRateHz,
    above20kHzDigitalRange: assessAbove20kHzDigitalRange(sampleRateHz),
    channels,
    bitsPerSample,
    durationSeconds: dataBytes && sampleRateHz && channels && bitsPerSample
      ? dataBytes / (sampleRateHz * channels * (bitsPerSample / 8))
      : null,
    metadataText,
    recognizedDevice,
  };
}

export async function inspectWavFile(file: File): Promise<WavRecordingMetadata> {
  ensureFileSize(file);
  return inspectWavMetadata(file.name, await file.arrayBuffer());
}

function fft(real: Float64Array, imaginary: Float64Array): void {
  const size = real.length;
  for (let index = 1, reversed = 0; index < size; index += 1) {
    let bit = size >> 1;
    while (reversed & bit) {
      reversed ^= bit;
      bit >>= 1;
    }
    reversed ^= bit;
    if (index < reversed) {
      [real[index], real[reversed]] = [real[reversed], real[index]];
      [imaginary[index], imaginary[reversed]] = [imaginary[reversed], imaginary[index]];
    }
  }
  for (let length = 2; length <= size; length <<= 1) {
    const angle = (-2 * Math.PI) / length;
    const stepReal = Math.cos(angle);
    const stepImaginary = Math.sin(angle);
    for (let start = 0; start < size; start += length) {
      let twiddleReal = 1;
      let twiddleImaginary = 0;
      for (let offset = 0; offset < length / 2; offset += 1) {
        const even = start + offset;
        const odd = even + length / 2;
        const oddReal = real[odd] * twiddleReal - imaginary[odd] * twiddleImaginary;
        const oddImaginary = real[odd] * twiddleImaginary + imaginary[odd] * twiddleReal;
        real[odd] = real[even] - oddReal;
        imaginary[odd] = imaginary[even] - oddImaginary;
        real[even] += oddReal;
        imaginary[even] += oddImaginary;
        const nextReal = twiddleReal * stepReal - twiddleImaginary * stepImaginary;
        twiddleImaginary = twiddleReal * stepImaginary + twiddleImaginary * stepReal;
        twiddleReal = nextReal;
      }
    }
  }
}

function dominantFrequency(samples: readonly number[], sampleRateHz: number): number {
  const size = samples.length;
  const real = new Float64Array(size);
  const imaginary = new Float64Array(size);
  let bestIndex = 0;
  let bestPower = -Infinity;
  for (let index = 0; index < size; index += 1) {
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (size - 1));
    real[index] = samples[index] * hann;
  }
  fft(real, imaginary);
  for (let index = 1; index < size / 2; index += 1) {
    const power = real[index] ** 2 + imaginary[index] ** 2;
    if (power > bestPower) {
      bestIndex = index;
      bestPower = power;
    }
  }
  return bestIndex * sampleRateHz / size;
}

function normalizeCsvHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]/g, '');
}

function getCsvColumn(header: string[], aliases: string[]): number {
  return header.findIndex(value => aliases.includes(normalizeCsvHeader(value)));
}

function parseTimestamp(value: string): number {
  if (!value.trim()) throw new DeviceImportError('CSV timestamps cannot be empty.');
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new DeviceImportError('CSV timestamps must be numeric seconds or valid ISO dates.');
  return parsed / 1000;
}

export function isVibrationCsv(text: string): boolean {
  const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? '';
  const separator = firstLine.includes(';') ? ';' : ',';
  const columns = firstLine.split(separator).map(normalizeCsvHeader);
  const hasX = columns.some(value => ['x', 'xg', 'xms2', 'ax', 'accelerationx', 'accelx'].includes(value));
  const hasY = columns.some(value => ['y', 'yg', 'yms2', 'ay', 'accelerationy', 'accely'].includes(value));
  const hasZ = columns.some(value => ['z', 'zg', 'zms2', 'az', 'accelerationz', 'accelz'].includes(value));
  return hasX && hasY && hasZ;
}

export function analyzeEnvironmentalCsv(text: string): EnvironmentalSeriesAnalysis {
  if (text.length > 12 * 1024 * 1024) throw new DeviceImportError('Environmental CSV exceeds the 12 MB parsing limit.');
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 6) throw new DeviceImportError('Provide a header, timestamp column, and at least five records.');
  if (lines.length > 250_001) throw new DeviceImportError('This CSV contains too many rows for a safe local import.');
  const separator = lines[0].includes(';') ? ';' : ',';
  const header = lines[0].split(separator);
  const timeColumn = getCsvColumn(header, ['time', 'timestamp', 'seconds', 'times']);
  if (timeColumn < 0) throw new DeviceImportError('Environmental CSV must include a time or timestamp column.');
  const measurementColumns = header
    .map((name, index) => ({ name, index }))
    .filter(item => item.index !== timeColumn);
  if (!measurementColumns.length || measurementColumns.length > 128) {
    throw new DeviceImportError('Environmental CSV must have between one and 128 measurement columns.');
  }
  if ((lines.length - 1) * measurementColumns.length > 1_000_000) {
    throw new DeviceImportError('Environmental CSV exceeds the one-million-value processing limit.');
  }
  const samples = measurementColumns.map(column => ({
    name: column.name.replace(/\[[^\]]*\]|\([^)]*\)/g, '').trim() || `Column ${column.index + 1}`,
    unit: column.name.match(/\[([^\]]*)\]|\(([^)]*)\)/)?.slice(1).find(Boolean)?.trim() || 'unspecified',
    values: [] as number[],
  }));
  const timestamps: number[] = [];
  for (let rowIndex = 1; rowIndex < lines.length; rowIndex += 1) {
    const cells = lines[rowIndex].split(separator).map(value => value.trim().replace(/^"|"$/g, ''));
    if (cells.length <= Math.max(timeColumn, ...measurementColumns.map(column => column.index))) {
      throw new DeviceImportError(`Environmental CSV row ${rowIndex + 1} is incomplete.`);
    }
    const timestamp = parseTimestamp(cells[timeColumn]);
    if (timestamps.length && timestamp <= timestamps[timestamps.length - 1]) {
      throw new DeviceImportError('Environmental timestamps must increase strictly.');
    }
    timestamps.push(timestamp);
    samples.forEach((sample, index) => {
      if (!cells[measurementColumns[index].index].trim()) {
        throw new DeviceImportError(`Environmental CSV row ${rowIndex + 1} contains an empty measurement.`);
      }
      const value = Number(cells[measurementColumns[index].index]);
      if (!Number.isFinite(value)) throw new DeviceImportError(`Environmental CSV row ${rowIndex + 1} contains an invalid value.`);
      sample.values.push(value);
    });
  }
  const elapsedHours = (timestamps[timestamps.length - 1] - timestamps[0]) / 3600;
  if (elapsedHours <= 0) throw new DeviceImportError('Environmental records need a positive time span.');
  return {
    sampleCount: timestamps.length,
    startedAt: new Date(timestamps[0] * 1000).toISOString(),
    endedAt: new Date(timestamps[timestamps.length - 1] * 1000).toISOString(),
    parameters: samples.map(sample => {
      let minimum = Infinity;
      let maximum = -Infinity;
      let sum = 0;
      for (const value of sample.values) {
        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
        sum += value;
      }
      const mean = sum / sample.values.length;
      const trendPerHour = (sample.values[sample.values.length - 1] - sample.values[0]) / elapsedHours;
      return {
        name: sample.name,
        unit: sample.unit,
        count: sample.values.length,
        minimum,
        maximum,
        mean,
        latest: sample.values[sample.values.length - 1],
        trendPerHour,
      };
    }),
  };
}

export function analyzeVibrationCsv(text: string): VibrationAnalysis {
  if (text.length > 12 * 1024 * 1024) throw new DeviceImportError('Vibration CSV exceeds the 12 MB parsing limit.');
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 9) throw new DeviceImportError('Provide a header and at least eight timestamped measurements.');
  if (lines.length - 1 > MAX_VIBRATION_ROWS) throw new DeviceImportError('Vibration CSV exceeds the 100,000-row local processing limit.');
  const separator = lines[0].includes(';') ? ';' : ',';
  const header = lines[0].split(separator);
  const timeColumn = getCsvColumn(header, ['time', 'timestamp', 'seconds', 'times']);
  const xColumn = getCsvColumn(header, ['x', 'xg', 'xms2', 'ax', 'accelerationx', 'accelx']);
  const yColumn = getCsvColumn(header, ['y', 'yg', 'yms2', 'ay', 'accelerationy', 'accely']);
  const zColumn = getCsvColumn(header, ['z', 'zg', 'zms2', 'az', 'accelerationz', 'accelz']);
  if ([timeColumn, xColumn, yColumn, zColumn].some(index => index < 0)) {
    throw new DeviceImportError('CSV must include time/timestamp and x, y, z measurement columns.');
  }
  const unitText = header.join(' ').toLowerCase();
  const unit: 'g' | 'm/s²' = /m\/s(?:\^?2|²)/.test(unitText) ? 'm/s²' : 'g';
  const rows: Array<{ time: number; x: number; y: number; z: number }> = [];
  for (let index = 1; index < lines.length; index += 1) {
    const cells = lines[index].split(separator).map(value => value.trim().replace(/^"|"$/g, ''));
    if (cells.length <= Math.max(timeColumn, xColumn, yColumn, zColumn)) {
      throw new DeviceImportError(`CSV row ${index + 1} is incomplete.`);
    }
    const time = parseTimestamp(cells[timeColumn]);
    if ([cells[xColumn], cells[yColumn], cells[zColumn]].some(value => !value.trim())) {
      throw new DeviceImportError(`CSV row ${index + 1} contains an empty axis value.`);
    }
    const x = Number(cells[xColumn]);
    const y = Number(cells[yColumn]);
    const z = Number(cells[zColumn]);
    if (![time, x, y, z].every(Number.isFinite)) throw new DeviceImportError(`CSV row ${index + 1} contains an invalid number.`);
    rows.push({ time, x, y, z });
  }
  const deltas: number[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    const delta = rows[index].time - rows[index - 1].time;
    if (delta <= 0) throw new DeviceImportError('CSV timestamps must increase strictly.');
    deltas.push(delta);
  }
  const sortedDeltas = [...deltas].sort((a, b) => a - b);
  const medianDelta = sortedDeltas[Math.floor(sortedDeltas.length / 2)];
  const meanDelta = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
  const jitterPercent = meanDelta > 0
    ? Math.sqrt(deltas.reduce((sum, value) => sum + (value - meanDelta) ** 2, 0) / deltas.length) / meanDelta * 100
    : Infinity;
  if (jitterPercent > 10) throw new DeviceImportError('Timestamp interval variation exceeds 10%; a reliable spectrum cannot be reported.');
  const sampleRateHz = 1 / medianDelta;
  if (!Number.isFinite(sampleRateHz) || sampleRateHz < 1 || sampleRateHz > 100_000) {
    throw new DeviceImportError('Inferred vibration sample rate is outside the supported 1–100,000 Hz range.');
  }
  const fftSize = 2 ** Math.floor(Math.log2(Math.min(rows.length, 8192)));
  const axes = {
    x: rows.slice(0, fftSize).map(row => row.x),
    y: rows.slice(0, fftSize).map(row => row.y),
    z: rows.slice(0, fftSize).map(row => row.z),
  };
  const magnitude = rows.slice(0, fftSize).map(row => Math.hypot(row.x, row.y, row.z));
  const rms = (samples: number[]) => Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
  return {
    sampleCount: rows.length,
    sampleRateHz,
    nyquistHz: sampleRateHz / 2,
    unit,
    dominantFrequencyHz: {
      x: dominantFrequency(axes.x, sampleRateHz),
      y: dominantFrequency(axes.y, sampleRateHz),
      z: dominantFrequency(axes.z, sampleRateHz),
      magnitude: dominantFrequency(magnitude, sampleRateHz),
    },
    rms: {
      x: rms(axes.x),
      y: rms(axes.y),
      z: rms(axes.z),
      magnitude: rms(magnitude),
    },
    timestampJitterPercent: jitterPercent,
  };
}

function readIqSample(view: DataView, sampleIndex: number, format: IqFormat): [number, number] {
  if (format === 'cu8') {
    return [(view.getUint8(sampleIndex * 2) - 127.5) / 127.5, (view.getUint8(sampleIndex * 2 + 1) - 127.5) / 127.5];
  }
  if (format === 'cs8') {
    return [view.getInt8(sampleIndex * 2) / 127, view.getInt8(sampleIndex * 2 + 1) / 127];
  }
  return [view.getFloat32(sampleIndex * 8, true), view.getFloat32(sampleIndex * 8 + 4, true)];
}

export function analyzeIqRecording(
  data: ArrayBuffer,
  fileName: string,
  format: IqFormat,
  centerFrequencyHz: number,
  sampleRateHz: number,
): IqAnalysis {
  if (data.byteLength > MAX_DEVICE_IMPORT_BYTES) throw new DeviceImportError('IQ recording exceeds the 64 MB local import limit.');
  if (!Number.isFinite(centerFrequencyHz) || centerFrequencyHz < 0 || centerFrequencyHz > 6_000_000_000) {
    throw new DeviceImportError('Enter a valid receiver centre frequency in Hz.');
  }
  if (!Number.isFinite(sampleRateHz) || sampleRateHz < 1 || sampleRateHz > 20_000_000) {
    throw new DeviceImportError('Enter a valid IQ sample rate from 1 to 20,000,000 samples/second.');
  }
  const bytesPerComplexSample = format === 'cf32' ? 8 : 2;
  if (!data.byteLength || data.byteLength % bytesPerComplexSample !== 0) {
    throw new DeviceImportError('IQ file length does not align with the selected complex-sample format.');
  }
  const sampleCount = data.byteLength / bytesPerComplexSample;
  if (sampleCount < 16) throw new DeviceImportError('IQ file is too short to analyze.');
  const view = new DataView(data);
  const fftSize = Math.min(MAX_IQ_ANALYSIS_SAMPLES, 2 ** Math.floor(Math.log2(sampleCount)));
  const real = new Float64Array(fftSize);
  const imaginary = new Float64Array(fftSize);
  let totalPower = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const [i, q] = readIqSample(view, index, format);
    if (!Number.isFinite(i) || !Number.isFinite(q) || Math.abs(i) > 1.5 || Math.abs(q) > 1.5) {
      throw new DeviceImportError('IQ data contains invalid or out-of-range samples.');
    }
    const power = i * i + q * q;
    totalPower += power;
    if (index < fftSize) {
      const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (fftSize - 1));
      real[index] = i * window;
      imaginary[index] = q * window;
    }
  }
  fft(real, imaginary);
  let peakIndex = 0;
  let peakPower = -Infinity;
  const powers = new Float64Array(fftSize);
  for (let index = 0; index < fftSize; index += 1) {
    const power = real[index] ** 2 + imaginary[index] ** 2;
    powers[index] = power;
    if (power > peakPower) {
      peakPower = power;
      peakIndex = index;
    }
  }
  const maximumSpectrumPower = Math.max(...powers);
  const spectrumRelativeDb = Array.from({ length: 128 }, (_, bucket) => {
    const unshiftedIndex = (Math.floor((bucket / 128) * fftSize) + fftSize / 2) % fftSize;
    return Math.max(-72, 10 * Math.log10(Math.max(powers[unshiftedIndex], maximumSpectrumPower * 1e-8) / Math.max(maximumSpectrumPower, 1e-24)));
  });
  const signedBin = peakIndex <= fftSize / 2 ? peakIndex : peakIndex - fftSize;
  const meanPower = totalPower / sampleCount;
  const toDbfs = (value: number) => 10 * Math.log10(Math.max(value, 1e-12));
  const extensionFormat: IqFormat | null = /\.cu8$/i.test(fileName) ? 'cu8'
    : /\.cs8$/i.test(fileName) ? 'cs8'
      : /\.(?:cfile|cf32)$/i.test(fileName) ? 'cf32' : null;
  if (extensionFormat && extensionFormat !== format) {
    throw new DeviceImportError(`The selected format conflicts with the ${extensionFormat.toUpperCase()} filename extension.`);
  }
  return {
    format,
    sampleCount,
    centerFrequencyHz,
    sampleRateHz,
    nyquistHz: sampleRateHz / 2,
    resolutionHz: sampleRateHz / fftSize,
    dominantFrequencyHz: centerFrequencyHz + signedBin * sampleRateHz / fftSize,
    peakRelativeDbfs: toDbfs(peakPower / (fftSize * fftSize)),
    meanPowerDbfs: toDbfs(meanPower / 2),
    spectrumRelativeDb,
  };
}

export async function analyzeIqFile(
  file: File,
  format: IqFormat,
  centerFrequencyHz: number,
  sampleRateHz: number,
): Promise<IqAnalysis> {
  ensureFileSize(file);
  return analyzeIqRecording(await file.arrayBuffer(), file.name, format, centerFrequencyHz, sampleRateHz);
}

export function demodulateIqRecording(
  data: ArrayBuffer,
  format: IqFormat,
  mode: 'am' | 'fm',
  sampleRateHz: number,
): { samples: Float32Array; sampleRateHz: number } {
  const stride = format === 'cf32' ? 8 : 2;
  if (!data.byteLength || data.byteLength % stride !== 0) throw new DeviceImportError('IQ data is not aligned for demodulation.');
  const view = new DataView(data);
  const count = Math.min(data.byteLength / stride, MAX_DEMODULATION_SAMPLES);
  const demodulated = new Float32Array(count);
  let previousPhase = 0;
  let powerMean = 0;
  for (let index = 0; index < count; index += 1) {
    const [i, q] = readIqSample(view, index, format);
    if (!Number.isFinite(i) || !Number.isFinite(q)) throw new DeviceImportError('IQ data contains a non-finite sample.');
    if (mode === 'am') {
      const amplitude = Math.hypot(i, q);
      powerMean += amplitude / count;
      demodulated[index] = amplitude;
    } else {
      const phase = Math.atan2(q, i);
      let difference = phase - previousPhase;
      if (difference > Math.PI) difference -= 2 * Math.PI;
      if (difference < -Math.PI) difference += 2 * Math.PI;
      demodulated[index] = difference;
      previousPhase = phase;
    }
  }
  if (mode === 'am') {
    for (let index = 0; index < demodulated.length; index += 1) demodulated[index] -= powerMean;
  }
  const decimation = Math.max(1, Math.floor(sampleRateHz / 48_000));
  if (decimation > 1) {
    const countOut = Math.floor(demodulated.length / decimation);
    const output = new Float32Array(countOut);
    for (let index = 0; index < countOut; index += 1) {
      let sum = 0;
      for (let offset = 0; offset < decimation; offset += 1) sum += demodulated[index * decimation + offset];
      output[index] = sum / decimation;
    }
    return { samples: output, sampleRateHz: sampleRateHz / decimation };
  }
  return { samples: demodulated, sampleRateHz };
}

export function encodeMonoPcmWav(samples: Float32Array, sampleRateHz: number): ArrayBuffer {
  if (!Number.isInteger(sampleRateHz) || sampleRateHz < 8000 || sampleRateHz > 192000) {
    throw new DeviceImportError('Demodulated audio sample rate is outside the supported WAV range.');
  }
  if (!samples.length || samples.length > sampleRateHz * 120) {
    throw new DeviceImportError('Demodulated audio must be between one sample and two minutes long.');
  }
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeTag = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeTag(0, 'RIFF');
  view.setUint32(4, buffer.byteLength - 8, true);
  writeTag(8, 'WAVE');
  writeTag(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRateHz, true);
  view.setUint32(28, sampleRateHz * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeTag(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index += 1) {
    const clipped = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, Math.round(clipped < 0 ? clipped * 32768 : clipped * 32767), true);
  }
  return buffer;
}
