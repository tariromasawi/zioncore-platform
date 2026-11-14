import type { CIGModality } from '@/lib/research-grid';

const BUILD_ENVIRONMENT: 'development' | 'production' =
  typeof import.meta.env !== 'undefined' && import.meta.env.DEV ? 'development' : 'production';

export type InstrumentKind =
  | 'microphone'
  | 'hydrophone'
  | 'accelerometer'
  | 'geophone'
  | 'environmental-sensor'
  | 'biopotential-sensor'
  | 'software-defined-radio'
  | 'radio-astronomy'
  | 'optical-sensor'
  | 'multichannel-device'
  | 'embedded-system'
  | 'experimental';

export type InstrumentStatus =
  | 'ready'
  | 'permission-required'
  | 'permission-denied'
  | 'unsupported'
  | 'insecure-context'
  | 'active'
  | 'error';

export type CalibrationRecord = {
  status: 'not-applicable' | 'uncalibrated' | 'user-calibrated' | 'factory-calibrated';
  checkedAt: string | null;
  reference: string;
};

export type InstrumentDescriptor = {
  id: string;
  name: string;
  kind: InstrumentKind;
  sourceType: 'live' | 'simulated';
  modalities: CIGModality[];
  capabilities: {
    inputChannels: number | null;
    sampleRateHz: number | null;
    frequencyBandHz: [number, number] | null;
    continuousCapture: boolean;
  };
  calibration: CalibrationRecord;
};

export type InstrumentDiscovery = {
  instrument: InstrumentDescriptor;
  status: InstrumentStatus;
  discoveredAt: string;
  availableInputCount: number | null;
  permission: 'granted' | 'prompt' | 'denied' | 'unknown';
  note: string;
};

export type InstrumentLease = {
  instrumentId: string;
  handle: unknown;
  acquiredAt: string;
  calibration: CalibrationRecord;
  actualSettings: {
    sampleRateHz: number | null;
    inputChannels: number | null;
  };
};

export interface InstrumentAdapter {
  descriptor: InstrumentDescriptor;
  discover(): Promise<InstrumentDiscovery>;
  acquire(): Promise<InstrumentLease>;
  release(lease: InstrumentLease): Promise<void>;
}

export class InstrumentRegistry {
  private readonly adapters = new Map<string, InstrumentAdapter>();
  private readonly environment: 'development' | 'production';

  constructor(environment: 'development' | 'production' = BUILD_ENVIRONMENT) {
    if (BUILD_ENVIRONMENT === 'production' && environment === 'development') {
      throw new Error('A production build cannot create a development instrument registry.');
    }
    this.environment = environment;
  }

  register(adapter: InstrumentAdapter) {
    if (!/^[A-Za-z0-9][A-Za-z0-9.-]{1,119}$/.test(adapter.descriptor.id)
      || !adapter.descriptor.name.trim() || adapter.descriptor.name.length > 120) {
      throw new Error('An instrument needs a valid id and display name.');
    }
    if (this.adapters.has(adapter.descriptor.id)) {
      throw new Error(`Instrument "${adapter.descriptor.id}" is already registered.`);
    }
    if (adapter.descriptor.sourceType === 'simulated' && this.environment !== 'development') {
      throw new Error('Simulated instruments can only be registered in development builds.');
    }
    if (adapter.descriptor.modalities.length === 0) {
      throw new Error('An instrument must declare at least one measurable modality.');
    }
    if (adapter.descriptor.modalities.some(modality => !/^[a-z][a-z0-9-]{1,63}$/.test(modality))) {
      throw new Error('An instrument declares an invalid modality identifier.');
    }
    if (adapter.descriptor.capabilities.sampleRateHz != null
      && (!Number.isFinite(adapter.descriptor.capabilities.sampleRateHz) || adapter.descriptor.capabilities.sampleRateHz <= 0)) {
      throw new Error('An instrument sample rate must be a positive finite value.');
    }
    this.adapters.set(adapter.descriptor.id, adapter);
  }

  get(id: string) {
    return this.adapters.get(id);
  }

  list() {
    return [...this.adapters.values()].map(adapter => adapter.descriptor);
  }

  async discoverAll() {
    return Promise.all([...this.adapters.values()].map(async adapter => {
      try {
        return await adapter.discover();
      } catch (cause) {
        return {
          instrument: adapter.descriptor,
          status: 'error' as const,
          discoveredAt: new Date().toISOString(),
          availableInputCount: null,
          permission: 'unknown' as const,
          note: cause instanceof Error ? cause.message : 'Instrument discovery failed.',
        };
      }
    }));
  }
}

export const BROWSER_MICROPHONE_INSTRUMENT_ID = 'instrument.browser-microphone-web-audio';

const browserMicrophoneDescriptor: InstrumentDescriptor = {
  id: BROWSER_MICROPHONE_INSTRUMENT_ID,
  name: 'Browser microphone and Web Audio analyser',
  kind: 'microphone',
  sourceType: 'live',
  modalities: ['acoustic'],
  capabilities: {
    inputChannels: null,
    sampleRateHz: null,
    frequencyBandHz: null,
    continuousCapture: true,
  },
  calibration: {
    status: 'uncalibrated',
    checkedAt: null,
    reference: 'Browser microphone input is not calibrated for absolute sound-pressure measurements.',
  },
};

export const browserMicrophoneInstrument: InstrumentAdapter = {
  descriptor: browserMicrophoneDescriptor,

  async discover() {
    const discoveredAt = new Date().toISOString();
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return {
        instrument: browserMicrophoneDescriptor,
        status: 'unsupported',
        discoveredAt,
        availableInputCount: null,
        permission: 'unknown',
        note: 'This browser does not expose microphone capture.',
      };
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      return {
        instrument: browserMicrophoneDescriptor,
        status: 'insecure-context',
        discoveredAt,
        availableInputCount: null,
        permission: 'unknown',
        note: 'Microphone capture requires a secure browser context.',
      };
    }

    let permission: InstrumentDiscovery['permission'] = 'unknown';
    try {
      const permissionStatus = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
      if (permissionStatus) {
        permission = permissionStatus.state === 'granted'
          ? 'granted'
          : permissionStatus.state === 'denied'
            ? 'denied'
            : 'prompt';
      }
    } catch {
      // Permission introspection is not supported consistently; actual permission remains user-controlled.
    }

    let availableInputCount: number | null = null;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      availableInputCount = devices.filter(device => device.kind === 'audioinput').length;
    } catch {
      // Discovery never requests permission or stores device identifiers.
    }

    return {
      instrument: browserMicrophoneDescriptor,
      status: permission === 'denied'
        ? 'permission-denied'
        : permission === 'granted'
          ? 'ready'
          : 'permission-required',
      discoveredAt,
      availableInputCount,
      permission,
      note: 'Device labels and identifiers are not collected. Permission is requested only when capture starts.',
    };
  },

  async acquire() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser does not support microphone capture.');
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      throw new Error('Microphone capture requires a secure browser context.');
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    const settings = stream.getAudioTracks()[0]?.getSettings();
    const acquiredAt = new Date().toISOString();
    return {
      instrumentId: browserMicrophoneDescriptor.id,
      handle: stream,
      acquiredAt,
      calibration: {
        ...browserMicrophoneDescriptor.calibration,
        checkedAt: acquiredAt,
      },
      actualSettings: {
        sampleRateHz: settings?.sampleRate ?? null,
        inputChannels: settings?.channelCount ?? null,
      },
    };
  },

  async release(lease) {
    const stream = lease.handle as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
  },
};

export const instrumentRegistry = new InstrumentRegistry(BUILD_ENVIRONMENT);
instrumentRegistry.register(browserMicrophoneInstrument);

export const developmentToneSimulator: InstrumentAdapter = {
  descriptor: {
    id: 'instrument.development-synthetic-tone',
    name: 'Development-only synthetic tone source',
    kind: 'experimental',
    sourceType: 'simulated',
    modalities: ['acoustic'],
    capabilities: {
      inputChannels: 1,
      sampleRateHz: 48_000,
      frequencyBandHz: [20, 24_000],
      continuousCapture: false,
    },
    calibration: {
      status: 'not-applicable',
      checkedAt: null,
      reference: 'Generated test data; not a physical sensor measurement.',
    },
  },
  async discover() {
    if (BUILD_ENVIRONMENT !== 'development') {
      return {
        instrument: this.descriptor,
        status: 'unsupported',
        discoveredAt: new Date().toISOString(),
        availableInputCount: null,
        permission: 'unknown',
        note: 'Synthetic instruments are only available in development builds.',
      };
    }
    return {
      instrument: this.descriptor,
      status: 'ready',
      discoveredAt: new Date().toISOString(),
      availableInputCount: 0,
      permission: 'granted',
      note: 'Synthetic 440 Hz test pattern only. It is never routed to live capture or saved as a measurement.',
    };
  },
  async acquire() {
    if (BUILD_ENVIRONMENT !== 'development') {
      throw new Error('Synthetic instruments are only available in development builds.');
    }
    const sampleRateHz = 48_000;
    const samples = new Float32Array(sampleRateHz / 2);
    for (let index = 0; index < samples.length; index++) {
      samples[index] = 0.08 * Math.sin(2 * Math.PI * 440 * index / sampleRateHz);
    }
    return {
      instrumentId: this.descriptor.id,
      handle: { samples, sampleRateHz, synthetic: true as const },
      acquiredAt: new Date().toISOString(),
      calibration: this.descriptor.calibration,
      actualSettings: { sampleRateHz, inputChannels: 1 },
    };
  },
  async release() {
    // No physical resources are allocated by a development simulator.
  },
};

if (BUILD_ENVIRONMENT === 'development') {
  instrumentRegistry.register(developmentToneSimulator);
}

