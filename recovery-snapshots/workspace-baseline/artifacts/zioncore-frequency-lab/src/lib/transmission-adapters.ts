import { z } from 'zod';
import {
  DSP_SAMPLE_RATES_HZ,
  MAX_DSP_OUTPUT_AMPLITUDE,
  MAX_DSP_OUTPUT_SECONDS,
  type DspSignal,
} from '@/lib/dsp-config';
import {
  startDspPlayback,
  type DspPlaybackHandle,
} from '@/lib/dsp-playback';

export const LOCAL_OUTPUT_CONSENT_VERSION = 'local-speaker-playback/v1' as const;

const localSpeakerAuthorizationSchema = z.object({
  channel: z.literal('local-speaker'),
  consentVersion: z.literal(LOCAL_OUTPUT_CONSENT_VERSION),
  explicitConsent: z.literal(true),
  userInitiated: z.literal(true),
  authorizedAt: z.string().datetime({ offset: true }),
}).strict();

export type LocalSpeakerAuthorization = z.infer<typeof localSpeakerAuthorizationSchema>;

export const LOCAL_AUDIO_OUTPUT_DESCRIPTOR = {
  id: 'output.browser-local-speaker',
  channel: 'local-speaker',
  status: 'available',
  scope: 'local-device',
  maxDurationSeconds: MAX_DSP_OUTPUT_SECONDS,
  sampleRatesHz: DSP_SAMPLE_RATES_HZ,
  maxDigitalPeak: MAX_DSP_OUTPUT_AMPLITUDE / 2,
  physicalDeviceIdentity: 'not-collected',
} as const;

export const EXTERNAL_OUTPUT_READINESS = [
  {
    channel: 'external-hardware',
    status: 'disabled',
    blocker: 'No device-specific hardware, safety, and owner authorization review is recorded.',
  },
  {
    channel: 'radio-frequency',
    status: 'disabled',
    blocker: 'No device, operating-band, power, antenna, jurisdiction, or regulatory review is recorded.',
  },
] as const;

export function createLocalSpeakerAuthorization(
  input: { explicitConsent: boolean; userInitiated: boolean; authorizedAt?: string },
): LocalSpeakerAuthorization {
  if (!input.explicitConsent || !input.userInitiated) {
    throw new Error('Local speaker output requires explicit user consent from a user-initiated action.');
  }
  return localSpeakerAuthorizationSchema.parse({
    channel: 'local-speaker',
    consentVersion: LOCAL_OUTPUT_CONSENT_VERSION,
    explicitConsent: input.explicitConsent,
    userInitiated: input.userInitiated,
    authorizedAt: input.authorizedAt ?? new Date().toISOString(),
  });
}

export interface LocalAudioOutputAdapter {
  descriptor: typeof LOCAL_AUDIO_OUTPUT_DESCRIPTOR;
  output(
    signal: DspSignal,
    authorization: unknown,
    createContext?: () => AudioContext,
    onEnded?: () => void,
  ): Promise<DspPlaybackHandle>;
}

export function createBrowserLocalAudioOutputAdapter(
  playback: typeof startDspPlayback = startDspPlayback,
): LocalAudioOutputAdapter {
  return {
    descriptor: LOCAL_AUDIO_OUTPUT_DESCRIPTOR,
    async output(signal, authorization, createContext, onEnded) {
      localSpeakerAuthorizationSchema.parse(authorization);
      return playback(signal, createContext, onEnded);
    },
  };
}

export const browserLocalAudioOutputAdapter = createBrowserLocalAudioOutputAdapter();
