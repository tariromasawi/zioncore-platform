export const ZIONCORE_ADAPTER_SDK_VERSION = '1.0.0';

export type SignalDomain =
  | 'acoustic-pressure'
  | 'radio-iq'
  | 'acceleration'
  | 'environmental';
export type ConnectionKind =
  | 'browser-audio'
  | 'usb-storage'
  | 'usb-sdr'
  | 'serial'
  | 'bluetooth'
  | 'vint'
  | 'network-bridge'
  | 'file-import';
export type AcquisitionMethod =
  | 'microphone'
  | 'wav-import'
  | 'iq-file-import'
  | 'csv-import'
  | 'local-companion-bridge';

export type AdapterManifest = {
  id: string;
  name: string;
  models: string[];
  category: SignalDomain;
  connectionTypes: ConnectionKind[];
  operatingSystems: string[];
  browsers: string[];
  acquisitionMethods: AcquisitionMethod[];
  measurementUnits: string[];
  sampleRateHz: { min?: number; max?: number; determinedBy: string };
  bandwidthHz: { min?: number; max?: number; determinedBy: string };
  calibration: string;
  discovery: string;
  permissions: string[];
  lifecycle: string;
  recovery: string;
  dataFormat: string[];
  dependencies: string[];
  integrationStatus: 'working-browser-path' | 'file-path' | 'bridge-required';
  documentationUrl: string;
};

export const DEVICE_ADAPTERS: readonly AdapterManifest[] = [
  {
    id: 'generic-browser-microphone',
    name: 'Browser microphone / audio interface',
    models: ['Built-in microphones', 'USB microphones', 'Bluetooth microphones', 'Audio interfaces'],
    category: 'acoustic-pressure',
    connectionTypes: ['browser-audio'],
    operatingSystems: ['iOS', 'Android', 'Windows', 'macOS', 'Linux'],
    browsers: ['Current browsers implementing MediaDevices and Web Audio'],
    acquisitionMethods: ['microphone'],
    measurementUnits: ['Relative digital amplitude', 'Hz'],
    sampleRateHz: { min: 8000, max: 192000, determinedBy: 'Negotiated input and AudioContext; actual values are reported at capture time.' },
    bandwidthHz: { determinedBy: 'At most half the actual sample rate; microphone and operating-system response may be narrower.' },
    calibration: 'Uncalibrated unless the user supplies an independently measured calibration profile.',
    discovery: 'Browser permission prompt; device names may remain hidden until permission is granted.',
    permissions: ['Explicit microphone permission after the user starts capture'],
    lifecycle: 'User starts capture; tracks are stopped immediately on Stop, failure, or unmount.',
    recovery: 'Retry after permission, device, or browser errors; no hidden reconnect.',
    dataFormat: ['Web Audio Float32 samples'],
    dependencies: ['Secure browser context (HTTPS or localhost)', 'MediaDevices', 'Web Audio API'],
    integrationStatus: 'working-browser-path',
    documentationUrl: 'https://developer.mozilla.org/docs/Web/API/MediaDevices/getUserMedia',
  },
  {
    id: 'audiomoth-1-2',
    name: 'AudioMoth 1.2.0',
    models: ['AudioMoth 1.2.0'],
    category: 'acoustic-pressure',
    connectionTypes: ['usb-storage', 'file-import'],
    operatingSystems: ['Files exported from supported AudioMoth workflows'],
    browsers: ['Any current browser with WAV file access'],
    acquisitionMethods: ['wav-import'],
    measurementUnits: ['Digital amplitude', 'Hz'],
    sampleRateHz: { min: 8000, max: 192000, determinedBy: 'Read from each WAV header; only rates supported by the existing decoder can be analyzed.' },
    bandwidthHz: { determinedBy: 'WAV sample rate / 2, bounded by the recorder microphone and calibration.' },
    calibration: 'Recording metadata is preserved when present; calibration is not inferred from the model name.',
    discovery: 'No model-specific browser USB discovery. Identify from available metadata, otherwise classify as a generic WAV.',
    permissions: ['User-selected local recording'],
    lifecycle: 'Local file is inspected and analyzed in the browser; source bytes are not uploaded.',
    recovery: 'Malformed, unsupported, or oversized files receive a visible import error.',
    dataFormat: ['RIFF/WAVE PCM or IEEE float when supported'],
    dependencies: ['AudioMoth firmware/export workflow for acquisition'],
    integrationStatus: 'file-path',
    documentationUrl: 'https://www.openacousticdevices.info/audiomoth',
  },
  {
    id: 'rtl-sdr-blog-v4',
    name: 'RTL-SDR Blog V4',
    models: ['RTL-SDR Blog V4'],
    category: 'radio-iq',
    connectionTypes: ['usb-sdr', 'network-bridge', 'file-import'],
    operatingSystems: ['Windows', 'macOS', 'Linux'],
    browsers: ['Current browser for local IQ file import; live tuning needs desktop receiver software and a bridge'],
    acquisitionMethods: ['iq-file-import', 'local-companion-bridge'],
    measurementUnits: ['Complex IQ amplitude', 'Hz', 'Relative dBFS'],
    sampleRateHz: { min: 1, determinedBy: 'Read from operator-supplied recording metadata; must be supplied for raw IQ files.' },
    bandwidthHz: { determinedBy: 'IQ sample rate; the usable receiver bandwidth and tuning are hardware/driver-dependent.' },
    calibration: 'Raw IQ amplitude is relative. Frequency and power calibration require a calibrated receiver and reference.',
    discovery: 'Not directly enumerated by ordinary browser APIs; identify through the chosen receiver software/bridge or imported recording metadata.',
    permissions: ['Explicit user connection in desktop SDR software; bridge token is never placed in a URL.'],
    lifecycle: 'Receive-only adapter. Raw IQ import and analysis work locally; live acquisition requires a separately installed compatible bridge.',
    recovery: 'Invalid framing, sample format, or connection state is rejected with a visible error.',
    dataFormat: ['Interleaved unsigned 8-bit IQ', 'Interleaved signed 8-bit IQ', 'Interleaved little-endian float32 IQ'],
    dependencies: ['RTL-SDR V4-compatible driver/SDR software', 'Optional authenticated local bridge'],
    integrationStatus: 'bridge-required',
    documentationUrl: 'https://www.rtl-sdr.com/rtl-sdr-blog-v-4/',
  },
  {
    id: 'phidget-mot0100',
    name: 'PhidgetAccelerometer MOT0100',
    models: ['MOT0100 with a compatible Phidgets VINT hub'],
    category: 'acceleration',
    connectionTypes: ['vint', 'usb-sdr', 'network-bridge', 'file-import'],
    operatingSystems: ['Windows', 'macOS', 'Linux'],
    browsers: ['Current browser for exported CSV; live acquisition uses supported Phidgets software/bridge'],
    acquisitionMethods: ['csv-import', 'local-companion-bridge'],
    measurementUnits: ['Acceleration (g or m/s²)', 'Hz'],
    sampleRateHz: { determinedBy: 'Read from timestamp spacing; the sensor and hub determine actual sampling.' },
    bandwidthHz: { determinedBy: 'Inferred Nyquist limit from timestamped samples; sensor and mount response also apply.' },
    calibration: 'Units are preserved; no calibration or axis orientation is inferred.',
    discovery: 'Supported Phidgets software or authenticated companion bridge; no generic browser claim of direct access.',
    permissions: ['User-authorized Phidgets device and bridge connection'],
    lifecycle: 'CSV import is local. Live bridge connection is a separately versioned integration point.',
    recovery: 'Rejects missing axes, invalid units, non-monotonic timestamps, or irregular sample intervals.',
    dataFormat: ['Timestamped CSV with time, x, y, z columns'],
    dependencies: ['Compatible VINT hub and Phidgets software for live capture'],
    integrationStatus: 'bridge-required',
    documentationUrl: 'https://www.phidgets.com/',
  },
  {
    id: 'echo-meter-touch-2-pro',
    name: 'Echo Meter Touch 2 Pro',
    models: ['Echo Meter Touch 2 Pro'],
    category: 'acoustic-pressure',
    connectionTypes: ['file-import'],
    operatingSystems: ['iOS / Android acquisition app export'],
    browsers: ['Current browser with WAV file access'],
    acquisitionMethods: ['wav-import'],
    measurementUnits: ['Digital acoustic amplitude', 'Hz'],
    sampleRateHz: { min: 8000, max: 192000, determinedBy: 'Read from the exported recording header and accepted by the app decoder.' },
    bandwidthHz: { determinedBy: 'WAV sample rate / 2, bounded by the recorder, microphone, and calibration.' },
    calibration: 'Preserves file metadata where present; no direct hardware control or calibration is claimed.',
    discovery: 'No undocumented direct hardware discovery. Use exported audio recordings.',
    permissions: ['User-selected local recording'],
    lifecycle: 'WAV metadata and supported recordings are processed locally.',
    recovery: 'Unsupported codec, rate, duration, or file size is reported before interpretation.',
    dataFormat: ['RIFF/WAVE recording export'],
    dependencies: ['Manufacturer app/device for acquisition'],
    integrationStatus: 'file-path',
    documentationUrl: 'https://www.wildlifeacoustics.com/products/echo-meter-touch-2-pro',
  },
  {
    id: 'generic-environmental-logger',
    name: 'Environmental data logger',
    models: ['CSV-exporting temperature, humidity, pressure, light, or water-quality loggers'],
    category: 'environmental',
    connectionTypes: ['file-import', 'network-bridge'],
    operatingSystems: ['Any platform that can export or select CSV recordings'],
    browsers: ['Current browser with local file access'],
    acquisitionMethods: ['csv-import', 'local-companion-bridge'],
    measurementUnits: ['Per-column unit retained from source header'],
    sampleRateHz: { determinedBy: 'Timestamped records; irregular environmental sampling is preserved as time-series data.' },
    bandwidthHz: { determinedBy: 'No frequency bandwidth is inferred from irregular environmental observations.' },
    calibration: 'Source units and calibration claims are carried as supplied; ZionCore does not calibrate the logger.',
    discovery: 'CSV import only unless a separately documented authenticated bridge is installed.',
    permissions: ['User-selected local file'],
    lifecycle: 'Local time-series summary; original file is not uploaded.',
    recovery: 'Invalid timestamps, non-numeric values, or unsupported CSV sizes are rejected.',
    dataFormat: ['Timestamped CSV with named numeric measurement columns'],
    dependencies: [],
    integrationStatus: 'file-path',
    documentationUrl: 'https://www.nist.gov/pml/weights-and-measures',
  },
  {
    id: 'generic-network-instrument',
    name: 'Future network receiver adapter',
    models: ['A documented, user-authorized local receiver bridge'],
    category: 'environmental',
    connectionTypes: ['network-bridge'],
    operatingSystems: ['Bridge host operating system'],
    browsers: ['Current secure browser'],
    acquisitionMethods: ['local-companion-bridge'],
    measurementUnits: ['Declared per sensor; never normalized across incompatible domains'],
    sampleRateHz: { determinedBy: 'Adapter manifest and validated stream metadata.' },
    bandwidthHz: { determinedBy: 'Adapter manifest, sample rate, and sensor calibration.' },
    calibration: 'Must be declared by the adapter and carried with each observation.',
    discovery: 'Explicitly configured adapter only; arbitrary network scanning is prohibited.',
    permissions: ['Explicit user authorization and bridge-level authentication'],
    lifecycle: 'Versioned stream contract; no bridge is assumed to be installed.',
    recovery: 'Disconnects are surfaced; reconnect only after explicit user selection.',
    dataFormat: ['Versioned ZionCore signal envelope'],
    dependencies: ['Separately installed compatible bridge'],
    integrationStatus: 'bridge-required',
    documentationUrl: 'https://developer.mozilla.org/docs/Web/API/WebSocket',
  },
];

export type BrowserCapabilities = {
  secureContext: boolean;
  mediaDevices: boolean;
  webAudio: boolean;
  webUsb: boolean;
  webSerial: boolean;
  webBluetooth: boolean;
  fileImport: boolean;
  platform: string;
  userAgent: string;
};

export function detectBrowserCapabilities(
  browser: Pick<Window, 'isSecureContext' | 'navigator'> = window,
): BrowserCapabilities {
  const navigatorValue = browser.navigator;
  const extendedNavigator = navigatorValue as Navigator & {
    usb?: unknown;
    serial?: unknown;
    bluetooth?: unknown;
    userAgentData?: { platform?: string };
  };
  const root = browser as Window & { webkitAudioContext?: typeof AudioContext };
  const audioConstructor = typeof AudioContext === 'function'
    ? AudioContext
    : root.webkitAudioContext;
  return {
    secureContext: browser.isSecureContext,
    mediaDevices: Boolean(navigatorValue.mediaDevices?.getUserMedia),
    webAudio: typeof audioConstructor === 'function',
    webUsb: Boolean(extendedNavigator.usb),
    webSerial: Boolean(extendedNavigator.serial),
    webBluetooth: Boolean(extendedNavigator.bluetooth),
    fileImport: typeof File !== 'undefined',
    platform: extendedNavigator.userAgentData?.platform || navigatorValue.platform || 'Unknown platform',
    userAgent: navigatorValue.userAgent || 'Unknown browser',
  };
}

export type AdapterRegistration = {
  manifest: AdapterManifest;
  sdkVersion: string;
  validatePayload: (payload: unknown) => boolean;
};

export type UniversalSignalPayload =
  | { kind: 'acoustic-pressure'; samples: Float32Array; unit: 'relative-digital-amplitude' | 'Pa' }
  | { kind: 'radio-iq'; samples: ArrayBuffer; format: 'cu8' | 'cs8' | 'cf32'; centerFrequencyHz: number }
  | { kind: 'acceleration'; x: Float32Array; y: Float32Array; z: Float32Array; unit: 'g' | 'm/s²' }
  | { kind: 'environmental'; values: Record<string, number>; unit: string };

export type UniversalSignalEnvelope = {
  schemaVersion: 1;
  adapterId: string;
  signalDomain: SignalDomain;
  capturedAt: string;
  sampleRateHz: number;
  calibration: {
    status: 'calibrated' | 'uncalibrated' | 'unknown';
    profileId?: string;
  };
  payload: UniversalSignalPayload;
};

const MAX_ENVELOPE_SAMPLES = 5_000_000;

export function validateSignalEnvelope(
  value: unknown,
  expected?: Pick<AdapterManifest, 'id' | 'category'>,
): value is UniversalSignalEnvelope {
  if (!value || typeof value !== 'object') return false;
  const envelope = value as Partial<UniversalSignalEnvelope>;
  if (
    envelope.schemaVersion !== 1
    || typeof envelope.adapterId !== 'string'
    || !envelope.adapterId
    || !['acoustic-pressure', 'radio-iq', 'acceleration', 'environmental'].includes(String(envelope.signalDomain))
    || !Number.isFinite(Date.parse(String(envelope.capturedAt)))
    || !Number.isFinite(envelope.sampleRateHz)
    || Number(envelope.sampleRateHz) <= 0
    || !envelope.calibration
    || !['calibrated', 'uncalibrated', 'unknown'].includes(envelope.calibration.status)
    || !envelope.payload
    || typeof envelope.payload !== 'object'
  ) return false;
  if (expected && (envelope.adapterId !== expected.id || envelope.signalDomain !== expected.category)) return false;
  const payload = envelope.payload as UniversalSignalPayload;
  if (payload.kind !== envelope.signalDomain) return false;
  if (payload.kind === 'acoustic-pressure') {
    return payload.samples instanceof Float32Array
      && payload.samples.length > 0
      && payload.samples.length <= MAX_ENVELOPE_SAMPLES
      && payload.samples.every(Number.isFinite)
      && (payload.unit === 'relative-digital-amplitude' || payload.unit === 'Pa');
  }
  if (payload.kind === 'radio-iq') {
    return payload.samples instanceof ArrayBuffer
      && payload.samples.byteLength > 0
      && payload.samples.byteLength <= 64 * 1024 * 1024
      && ['cu8', 'cs8', 'cf32'].includes(payload.format)
      && Number.isFinite(payload.centerFrequencyHz)
      && payload.centerFrequencyHz >= 0;
  }
  if (payload.kind === 'acceleration') {
    return payload.x instanceof Float32Array
      && payload.y instanceof Float32Array
      && payload.z instanceof Float32Array
      && payload.x.length > 0
      && payload.x.length <= MAX_ENVELOPE_SAMPLES
      && payload.x.length === payload.y.length
      && payload.x.length === payload.z.length
      && payload.x.every(Number.isFinite)
      && payload.y.every(Number.isFinite)
      && payload.z.every(Number.isFinite)
      && (payload.unit === 'g' || payload.unit === 'm/s²');
  }
  return Boolean(payload.values && typeof payload.values === 'object')
    && Object.keys(payload.values).length > 0
    && Object.keys(payload.values).length <= 128
    && Object.values(payload.values).every(Number.isFinite)
    && typeof payload.unit === 'string'
    && payload.unit.length > 0;
}

export class AdapterRegistry {
  private readonly adapters = new Map<string, AdapterRegistration>();

  register(registration: AdapterRegistration): void {
    if (!registration.manifest.id.trim()) throw new Error('An adapter must have a stable identifier.');
    const [major] = registration.sdkVersion.split('.');
    const [supportedMajor] = ZIONCORE_ADAPTER_SDK_VERSION.split('.');
    if (!major || major !== supportedMajor) {
      throw new Error(`Adapter SDK major version ${supportedMajor} is required.`);
    }
    if (this.adapters.has(registration.manifest.id)) {
      throw new Error(`Adapter "${registration.manifest.id}" is already registered.`);
    }
    this.adapters.set(registration.manifest.id, registration);
  }

  get(id: string): AdapterRegistration | undefined {
    return this.adapters.get(id);
  }

  list(): AdapterRegistration[] {
    return [...this.adapters.values()];
  }
}

export function createDefaultAdapterRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry();
  for (const manifest of DEVICE_ADAPTERS) {
    registry.register({
      manifest,
      sdkVersion: ZIONCORE_ADAPTER_SDK_VERSION,
      validatePayload: payload => validateSignalEnvelope(payload, {
        id: manifest.id,
        category: manifest.category,
      }),
    });
  }
  return registry;
}

export function browserCapabilitySummary(capabilities: BrowserCapabilities): string[] {
  const results = [
    capabilities.secureContext ? 'Secure context available' : 'Secure context required for live browser capture',
    capabilities.mediaDevices ? 'Microphone permission path available' : 'Microphone capture unavailable in this browser',
    capabilities.webAudio ? 'Web Audio analysis available' : 'Web Audio unavailable',
    capabilities.webUsb ? 'WebUSB API available (device protocol still required)' : 'WebUSB unavailable',
    capabilities.webSerial ? 'Web Serial API available (device protocol still required)' : 'Web Serial unavailable',
    capabilities.webBluetooth ? 'Web Bluetooth API available (device protocol still required)' : 'Web Bluetooth unavailable',
    capabilities.fileImport ? 'Local file import available' : 'Local file import unavailable',
  ];
  return results;
}
