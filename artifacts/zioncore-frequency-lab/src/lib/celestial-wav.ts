import {
  MAX_AUDIO_FILE_BYTES,
  readWavAnalysisMetadata,
} from '@/lib/audio-file-analysis';
import { CELESTIAL_AUDIO_DECODER_LIMITS } from '@/lib/celestial-audio';
import { decodeNativeWav } from '@/lib/voice-v2-audio';

export type LocalWavFile = Pick<File, 'name' | 'size' | 'arrayBuffer'>;

export type DecodedWavSamples = {
  samples: Float32Array;
  sampleRateHz: number;
  durationSeconds: number;
  sourceName: string;
  sourceChannels: number;
  rms: number;
};

/**
 * Reads a bounded local WAV for the celestial packet decoder.
 * No AudioContext resampling is performed: the decoder receives the declared
 * source rate so symbol timing and frequency calculations remain accurate.
 */
export async function decodeWavMonoSamples(
  file: LocalWavFile,
  isCurrent: () => boolean = () => true,
): Promise<DecodedWavSamples> {
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_AUDIO_FILE_BYTES) {
    throw new Error(`Choose a non-empty WAV file no larger than ${Math.floor(MAX_AUDIO_FILE_BYTES / 1024 / 1024)} MiB.`);
  }
  const buffer = await file.arrayBuffer();
  if (!isCurrent()) throw new Error('WAV decoding was cancelled before processing.');
  if (buffer.byteLength !== file.size || buffer.byteLength > MAX_AUDIO_FILE_BYTES) {
    throw new Error('The selected file changed or exceeded the local import limit while being read.');
  }

  const metadata = readWavAnalysisMetadata(buffer);
  if (metadata) {
    if (metadata.channels < 1 || metadata.channels > 2) {
      throw new Error('The celestial WAV decoder supports mono or stereo input only.');
    }
    if (
      metadata.sampleRate < CELESTIAL_AUDIO_DECODER_LIMITS.minimumSampleRateHz
      || metadata.sampleRate > CELESTIAL_AUDIO_DECODER_LIMITS.maximumSampleRateHz
    ) {
      throw new Error(
        `The celestial packet decoder supports ${(CELESTIAL_AUDIO_DECODER_LIMITS.minimumSampleRateHz / 1000).toFixed(0)}–${(CELESTIAL_AUDIO_DECODER_LIMITS.maximumSampleRateHz / 1000).toFixed(0)} kHz WAV input.`,
      );
    }
    if (metadata.durationSeconds > CELESTIAL_AUDIO_DECODER_LIMITS.maximumDurationSeconds) {
      throw new Error(`WAV duration exceeds the ${CELESTIAL_AUDIO_DECODER_LIMITS.maximumDurationSeconds}-second local packet-decoding limit.`);
    }
  }

  const decoded = decodeNativeWav(buffer);
  if (decoded.channels > 2) {
    throw new Error('The celestial WAV decoder supports mono or stereo input only.');
  }
  if (decoded.sampleRateHz > CELESTIAL_AUDIO_DECODER_LIMITS.maximumSampleRateHz) {
    throw new Error('The celestial packet decoder supports WAV sample rates up to 96 kHz.');
  }
  if (decoded.durationSeconds > CELESTIAL_AUDIO_DECODER_LIMITS.maximumDurationSeconds) {
    throw new Error(`WAV duration exceeds the ${CELESTIAL_AUDIO_DECODER_LIMITS.maximumDurationSeconds}-second local packet-decoding limit.`);
  }
  if (!isCurrent()) throw new Error('WAV decoding was cancelled after processing.');

  let squaredTotal = 0;
  for (const sample of decoded.samples) squaredTotal += sample * sample;
  return {
    samples: decoded.samples,
    sampleRateHz: decoded.sampleRateHz,
    durationSeconds: decoded.durationSeconds,
    sourceName: file.name,
    sourceChannels: decoded.channels,
    rms: Math.sqrt(squaredTotal / decoded.samples.length),
  };
}
