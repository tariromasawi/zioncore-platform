import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, AudioLines, Check, CircleHelp,
  Cpu, Download, FileAudio, FileText, Link2, Radio, ShieldCheck,
  Smartphone, Waves,
} from 'lucide-react';
import { Link } from 'wouter';
import './device-connection-center.css';
import {
  browserCapabilitySummary,
  createDefaultAdapterRegistry,
  detectBrowserCapabilities,
  DEVICE_ADAPTERS,
  ZIONCORE_ADAPTER_SDK_VERSION,
  type BrowserCapabilities,
} from '@/lib/device-adapters';
import {
  analyzeIqFile,
  analyzeEnvironmentalCsv,
  analyzeVibrationCsv,
  demodulateIqRecording,
  encodeMonoPcmWav,
  inspectWavFile,
  isVibrationCsv,
  type EnvironmentalSeriesAnalysis,
  type IqAnalysis,
  type IqFormat,
  type VibrationAnalysis,
  type WavRecordingMetadata,
} from '@/lib/device-signal-importers';
import { analyzeAudioFile, type ImportedAudioAnalysis } from '@/lib/audio-file-analysis';

type ImportResult =
  | { kind: 'wav'; metadata: WavRecordingMetadata; analysis?: ImportedAudioAnalysis; analysisNote?: string }
  | { kind: 'vibration'; result: VibrationAnalysis }
  | { kind: 'environment'; result: EnvironmentalSeriesAnalysis }
  | { kind: 'iq'; result: IqAnalysis };

const registry = createDefaultAdapterRegistry();

const adapterIcons: Record<string, typeof AudioLines> = {
  'generic-browser-microphone': AudioLines,
  'audiomoth-1-2': FileAudio,
  'rtl-sdr-blog-v4': Radio,
  'phidget-mot0100': Activity,
  'echo-meter-touch-2-pro': Waves,
  'generic-network-instrument': Link2,
};

function formatFrequency(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(4)} MHz`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(3)} kHz`;
  return `${value.toFixed(2)} Hz`;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return 'Not available in file header';
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes}m ${(seconds % 60).toFixed(1)}s` : `${seconds.toFixed(2)}s`;
}

function exportMeasurementReport(result: ImportResult, fileName: string) {
  const report = result.kind === 'wav'
    ? {
      schema: 'zioncore-local-signal-report/1',
      generatedAt: new Date().toISOString(),
      sourceFile: fileName,
      signalDomain: 'acoustic-pressure',
      metadata: result.metadata,
      spectrum: result.analysis ? {
        sampleRateHz: result.analysis.sampleRate,
        fftSize: result.analysis.fftSize,
        resolutionHz: result.analysis.resolution,
        dominantFrequencyHz: result.analysis.dominant,
        peaksHz: result.analysis.peaks,
        relativeRms: result.analysis.rms,
        signalFeatures: result.analysis.features,
      } : null,
      sourceAudioIncluded: false,
    }
    : result.kind === 'vibration'
      ? {
        schema: 'zioncore-local-signal-report/1',
        generatedAt: new Date().toISOString(),
        sourceFile: fileName,
        signalDomain: 'acceleration',
        result: result.result,
        sourceRecordingIncluded: false,
      }
      : result.kind === 'environment'
        ? {
          schema: 'zioncore-local-signal-report/1',
          generatedAt: new Date().toISOString(),
          sourceFile: fileName,
          signalDomain: 'environmental',
          result: result.result,
          sourceRecordingIncluded: false,
        }
        : {
          schema: 'zioncore-local-signal-report/1',
          generatedAt: new Date().toISOString(),
          sourceFile: fileName,
          signalDomain: 'radio-iq',
          result: result.result,
          sourceIqIncluded: false,
        };
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `zioncore-${result.kind}-measurement.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export default function DeviceConnectionCenter() {
  const [capabilities, setCapabilities] = useState<BrowserCapabilities | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState<IqFormat>('cu8');
  const [sampleRate, setSampleRate] = useState('2400000');
  const [centerFrequency, setCenterFrequency] = useState('100000000');
  const [demodulation, setDemodulation] = useState<'am' | 'fm'>('fm');
  const [iqSource, setIqSource] = useState<File | null>(null);
  const [demodulatedUrl, setDemodulatedUrl] = useState<string | null>(null);
  const [importedFileName, setImportedFileName] = useState('');

  useEffect(() => () => {
    if (demodulatedUrl) URL.revokeObjectURL(demodulatedUrl);
  }, [demodulatedUrl]);

  const browserRows = useMemo(
    () => capabilities ? browserCapabilitySummary(capabilities) : [],
    [capabilities],
  );

  const processFile = async (file: File) => {
    setError('');
    setStatus('');
    setResult(null);
    setIqSource(null);
    setDemodulatedUrl(null);
    setImportedFileName(file.name);
    setBusy(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (extension === 'wav') {
        const metadata = await inspectWavFile(file);
        let analysis: ImportedAudioAnalysis | undefined;
        let analysisNote: string | undefined;
        try {
          analysis = await analyzeAudioFile(file, 4096);
        } catch (cause) {
          analysisNote = cause instanceof Error
            ? cause.message
            : 'Metadata was read; spectral analysis could not be completed for this file.';
        }
        setResult({ kind: 'wav', metadata, ...(analysis ? { analysis } : {}), ...(analysisNote ? { analysisNote } : {}) });
        setStatus(`Read local WAV metadata. ${analysis ? 'Signal spectrum analyzed on this device.' : 'Metadata is available; spectrum analysis needs a supported recording.'}`);
      } else if (extension === 'csv' || extension === 'txt') {
        const contents = await file.text();
        if (isVibrationCsv(contents)) {
          const result = analyzeVibrationCsv(contents);
          setResult({ kind: 'vibration', result });
          setStatus('Analyzed timestamped sensor values locally. Acceleration remains separate from acoustic sound.');
        } else {
          const result = analyzeEnvironmentalCsv(contents);
          setResult({ kind: 'environment', result });
          setStatus('Summarized environmental logger time series locally. No frequency bandwidth was inferred from the sample interval.');
        }
      } else if (['cu8', 'cs8', 'cfile', 'cf32'].includes(extension)) {
        const selectedFormat: IqFormat = extension === 'cu8' ? 'cu8' : extension === 'cs8' ? 'cs8' : 'cf32';
        const result = await analyzeIqFile(file, selectedFormat, Number(centerFrequency), Number(sampleRate));
        setFormat(selectedFormat);
        setResult({ kind: 'iq', result });
        setIqSource(file);
        setStatus('Analyzed a local receive-only complex IQ recording. No radio transmission or network connection was made.');
      } else {
        throw new Error('Choose a WAV recording, timestamped sensor CSV, or supported raw IQ file (.cu8, .cs8, .cfile, .cf32).');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ZionCore could not inspect this file.');
    } finally {
      setBusy(false);
    }
  };

  const inspectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) void processFile(file);
  };

  const dropFile = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file && !busy) void processFile(file);
  };

  const refreshCapabilities = () => {
    try {
      setCapabilities(detectBrowserCapabilities());
      setStatus('Browser feature detection completed. Hardware is not enumerated unless its protocol is supported and you explicitly connect it.');
    } catch {
      setError('Browser capability detection is unavailable in this context.');
    }
  };

  const downloadDemodulated = async () => {
    if (!iqSource) return;
    setError('');
    try {
      const data = await iqSource.arrayBuffer();
      const decoded = demodulateIqRecording(data, format, demodulation, Number(sampleRate));
      setDemodulatedUrl(URL.createObjectURL(new Blob([encodeMonoPcmWav(decoded.samples, decoded.sampleRateHz)], { type: 'audio/wav' })));
      setStatus(`${demodulation.toUpperCase()} demodulation created a local audio preview from the first ${decoded.samples.length.toLocaleString()} samples. This is a receiver experiment, not a message authentication or attribution.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not demodulate this IQ recording.');
    }
  };

  return <main className="page-wrap zc-device-center" data-testid="page-device-center">
    <header className="zc-device-hero">
      <div>
        <div className="eyebrow"><span className="zc-eyebrow-mark" aria-hidden="true" /> ZionCore device connection centre / 07</div>
        <h1 className="page-title">Connect what you have.<br /><em>Measure what it can capture.</em></h1>
        <p className="lead">Start with a phone microphone or a recording. Add specialist sensors through documented files and future adapter integrations. Every reading keeps its real measurement domain—sound, radio IQ and physical motion are never treated as interchangeable.</p>
        <div className="zc-device-hero-actions">
          <Link className="btn btn-primary" href="/"><AudioLines size={15} /> Open live acoustic lab <ArrowRight size={14} /></Link>
          <button className="btn btn-subtle" type="button" onClick={refreshCapabilities} data-testid="button-detect-capabilities"><Cpu size={15} /> Detect browser support</button>
        </div>
      </div>
      <aside className="zc-device-hero-mark" aria-hidden="true"><div><Radio size={30} /><span>UNIVERSAL<br />SIGNAL INTAKE</span></div></aside>
    </header>

    <section className="panel zc-capability-panel" aria-labelledby="zc-capabilities-title">
      <div className="panel-head"><span id="zc-capabilities-title" className="panel-title">This browser’s connection profile</span><Smartphone size={17} /></div>
      <div className="section-body">
        {!capabilities
          ? <div className="zc-capability-empty"><CircleHelp size={18} /><span>Run browser detection to see secure-context, microphone, WebUSB, Web Serial, Web Bluetooth, and file-import support.</span></div>
          : <>
            <div className="zc-device-facts"><span><strong>Platform</strong>{capabilities.platform}</span><span><strong>Secure context</strong>{capabilities.secureContext ? 'Available' : 'Required for live capture'}</span><span><strong>Audio</strong>{capabilities.mediaDevices && capabilities.webAudio ? 'Microphone + Web Audio' : 'Limited or unavailable'}</span></div>
            <ul className="zc-capability-list">{browserRows.map(row => <li key={row}><Check size={13} />{row}</li>)}</ul>
          </>}
      </div>
    </section>

    <section className="zc-adapter-section" aria-labelledby="zc-adapters-title">
      <div className="zc-section-heading"><div><span className="zc-kicker">Versioned adapter SDK · v1.0.0</span><h2 id="zc-adapters-title">Device pathways and what works today.</h2></div><p>Browser buttons are never presented as a device connection unless a supported device protocol exists.</p></div>
      <div className="zc-adapter-grid">
        {DEVICE_ADAPTERS.map(adapter => {
          const Icon = adapterIcons[adapter.id] ?? Activity;
          const registered = Boolean(registry.get(adapter.id));
          const statusLabel = adapter.integrationStatus === 'working-browser-path'
            ? 'Live browser path'
            : adapter.integrationStatus === 'file-path'
              ? 'File import supported'
              : 'Bridge / software required';
          return <article className="zc-adapter-card" key={adapter.id} data-testid={`adapter-${adapter.id}`}>
            <div className="zc-adapter-top"><span className="zc-adapter-icon"><Icon size={18} /></span><span className={`zc-adapter-status ${adapter.integrationStatus}`}>{statusLabel}</span></div>
            <h3>{adapter.name}</h3>
            <p className="zc-adapter-models">{adapter.models.join(' · ')}</p>
            <dl>
              <div><dt>Signal type</dt><dd>{adapter.category}</dd></div>
              <div><dt>Measures</dt><dd>{adapter.measurementUnits.join(' · ')}</dd></div>
              <div><dt>Acquisition</dt><dd>{adapter.acquisitionMethods.join(' · ')}</dd></div>
              <div><dt>Calibration</dt><dd>{adapter.calibration}</dd></div>
              <div><dt>Adapter</dt><dd>{registered ? `Registered · SDK ${ZIONCORE_ADAPTER_SDK_VERSION}` : 'Unavailable'}</dd></div>
            </dl>
            <details className="zc-adapter-details">
              <summary>Compatibility, permissions and recovery</summary>
              <dl>
                <div><dt>Connections</dt><dd>{adapter.connectionTypes.join(' · ')}</dd></div>
                <div><dt>Platforms</dt><dd>{adapter.operatingSystems.join(' · ')}</dd></div>
                <div><dt>Browsers</dt><dd>{adapter.browsers.join(' · ')}</dd></div>
                <div><dt>Sample rate</dt><dd>{adapter.sampleRateHz.min != null ? `${adapter.sampleRateHz.min}–${adapter.sampleRateHz.max ?? 'open'} Hz` : 'Reported or inferred per recording'}. {adapter.sampleRateHz.determinedBy}</dd></div>
                <div><dt>Bandwidth</dt><dd>{adapter.bandwidthHz.min != null ? `${adapter.bandwidthHz.min}–${adapter.bandwidthHz.max ?? 'open'} Hz` : 'Reported per sensor or sample stream'}. {adapter.bandwidthHz.determinedBy}</dd></div>
                <div><dt>Discovery</dt><dd>{adapter.discovery}</dd></div>
                <div><dt>Permission</dt><dd>{adapter.permissions.join(' · ')}</dd></div>
                <div><dt>Lifecycle</dt><dd>{adapter.lifecycle}</dd></div>
                <div><dt>Recovery</dt><dd>{adapter.recovery}</dd></div>
                <div><dt>Formats</dt><dd>{adapter.dataFormat.join(' · ')}</dd></div>
                <div><dt>Dependencies</dt><dd>{adapter.dependencies.length ? adapter.dependencies.join(' · ') : 'None for the listed local file path'}</dd></div>
              </dl>
            </details>
            <a href={adapter.documentationUrl} target="_blank" rel="noreferrer" className="zc-adapter-doc">Reference documentation <ArrowRight size={12} /></a>
          </article>;
        })}
      </div>
    </section>

    <section className="panel zc-device-import" aria-labelledby="zc-import-title">
      <div className="panel-head"><span id="zc-import-title" className="panel-title">Local multi-signal importer</span><FileText size={16} /></div>
      <div className="section-body">
        <p className="zc-import-intro">Choose a WAV, timestamped accelerometer CSV, or raw receive-only IQ recording. Files are parsed in this browser and are not uploaded. WAV spectral analysis follows the existing ZionCore acoustic pipeline; sensor and IQ readings use domain-specific calculations.</p>
        <label
          className="zc-device-file-picker"
          onDragOver={event => event.preventDefault()}
          onDrop={dropFile}
          data-testid="drop-device-signal-file"
        >
          <Download size={16} />
          <span>{busy ? 'Inspecting on this device…' : 'Choose a local signal file'}</span>
          <small>WAV · CSV · TXT · CU8 · CS8 · CFILE · CF32 · WAV/IQ up to 64 MB · CSV up to 12 MB</small>
          <input type="file" accept=".wav,.csv,.txt,.cu8,.cs8,.cfile,.cf32,audio/wav,text/csv,text/plain" onChange={event => void inspectFile(event)} disabled={busy} data-testid="input-device-signal-file" />
        </label>

        <div className="zc-iq-options">
          <label>IQ centre frequency (Hz)<input type="number" min="0" step="1" value={centerFrequency} onChange={event => setCenterFrequency(event.target.value)} inputMode="decimal" /></label>
          <label>IQ sample rate (samples/s)<input type="number" min="1" max="20000000" step="1" value={sampleRate} onChange={event => setSampleRate(event.target.value)} inputMode="decimal" /></label>
        </div>
        <p className="permission-note">Raw IQ files do not carry a standard metadata header in these supported formats. Confirm their sample format, sample rate, and tuned centre frequency from your recording software before import; incorrect metadata shifts the displayed frequencies.</p>

        {status && <p className="zc-device-status" role="status" data-testid="status-device-import">{status}</p>}
        {error && <p className="zc-device-error" role="alert" data-testid="error-device-import"><AlertTriangle size={14} />{error}</p>}
        {result?.kind === 'wav' && <div className="zc-import-result" data-testid="result-wav-metadata">
          <h3><AudioLines size={16} /> Acoustic recording · {result.metadata.recognizedDevice}</h3>
          <div className="zc-device-metric-grid">
            <span><strong>Format</strong>{result.metadata.formatName} · {result.metadata.bitsPerSample}-bit</span>
            <span><strong>Channels</strong>{result.metadata.channels}</span>
            <span><strong>Sample rate</strong>{(result.metadata.sampleRateHz / 1000).toFixed(1)} kHz</span>
            <span><strong>Digital Nyquist</strong>{(result.metadata.sampleRateHz / 2000).toFixed(1)} kHz</span>
            <span><strong>Digital range above 20 kHz</strong>{result.metadata.above20kHzDigitalRange.upperHz == null
              ? 'Not represented by this sample rate'
              : `20–${(result.metadata.above20kHzDigitalRange.upperHz / 1000).toFixed(1)} kHz; input response unverified`}</span>
            <span><strong>Duration</strong>{formatDuration(result.metadata.durationSeconds)}</span>
            <span><strong>Data domain</strong>Acoustic waveform</span>
          </div>
          <p className="zc-import-warning">The WAV header gives a digital Nyquist limit only. It does not verify microphone frequency response, calibration, or the browser’s decoded bandwidth.</p>
          {result.analysis
            ? <p className="zc-analysis-result"><strong>Local spectrum:</strong> peak {result.analysis.dominant == null ? 'not detected' : formatFrequency(result.analysis.dominant)} · {result.analysis.resolution.toFixed(2)} Hz/bin · {result.analysis.analyzedFrames} frames.</p>
            : result.analysisNote && <p className="zc-import-warning"><AlertTriangle size={14} />Metadata is available, but analysis needs a compatible file: {result.analysisNote}</p>}
          {result.metadata.metadataText.length > 0 && <details><summary>Recording metadata</summary><ul>{result.metadata.metadataText.map((entry, index) => <li key={`${index}-${entry.slice(0, 20)}`}>{entry}</li>)}</ul></details>}
        </div>}
        {result?.kind === 'vibration' && <div className="zc-import-result" data-testid="result-vibration">
          <h3><Activity size={16} /> Vibration / acceleration analysis</h3>
          <div className="zc-device-metric-grid">
            <span><strong>Samples</strong>{result.result.sampleCount.toLocaleString()}</span>
            <span><strong>Inferred rate</strong>{result.result.sampleRateHz.toFixed(2)} Hz</span>
            <span><strong>Digital Nyquist</strong>{result.result.nyquistHz.toFixed(2)} Hz</span>
            <span><strong>Units</strong>{result.result.unit}</span>
            <span><strong>Time jitter</strong>{result.result.timestampJitterPercent.toFixed(2)}%</span>
            <span><strong>Measure</strong>Acceleration, not audio</span>
          </div>
          <p className="zc-analysis-result">Dominant axis frequencies: X {formatFrequency(result.result.dominantFrequencyHz.x)} · Y {formatFrequency(result.result.dominantFrequencyHz.y)} · Z {formatFrequency(result.result.dominantFrequencyHz.z)} · vector magnitude {formatFrequency(result.result.dominantFrequencyHz.magnitude)}.</p>
          <p className="permission-note">RMS values are in {result.result.unit}. Mounting, sensor range and calibration affect interpretation.</p>
        </div>}
        {result?.kind === 'environment' && <div className="zc-import-result" data-testid="result-environment">
          <h3><Activity size={16} /> Environmental sensor time series</h3>
          <div className="zc-device-metric-grid">
            <span><strong>Records</strong>{result.result.sampleCount.toLocaleString()}</span>
            <span><strong>Measurements</strong>{result.result.parameters.length}</span>
            <span><strong>Started</strong>{new Date(result.result.startedAt).toLocaleString()}</span>
            <span><strong>Ended</strong>{new Date(result.result.endedAt).toLocaleString()}</span>
          </div>
          <div className="zc-environment-table" role="table" aria-label="Environmental measurement summary">
            <div className="zc-environment-row zc-environment-header" role="row"><span>Parameter</span><span>Unit</span><span>Range</span><span>Latest</span><span>Trend / hour</span></div>
            {result.result.parameters.map(parameter => <div className="zc-environment-row" role="row" key={parameter.name}><span>{parameter.name}</span><span>{parameter.unit}</span><span>{parameter.minimum.toPrecision(4)}–{parameter.maximum.toPrecision(4)}</span><span>{parameter.latest.toPrecision(4)}</span><span>{parameter.trendPerHour.toPrecision(4)}</span></div>)}
          </div>
          <p className="permission-note">Environmental values are summarized in their source units. Irregular time-series intervals are not treated as a frequency spectrum.</p>
        </div>}
        {result?.kind === 'iq' && <div className="zc-import-result" data-testid="result-iq">
          <h3><Radio size={16} /> Receive-only complex IQ analysis</h3>
          <div className="zc-iq-spectrum" role="img" aria-label={`Relative IQ spectrum centered at ${formatFrequency(result.result.centerFrequencyHz)}; span ${formatFrequency(result.result.sampleRateHz)}`}>
            <div className="zc-iq-spectrum-labels"><span>−{formatFrequency(result.result.sampleRateHz / 2)}</span><span>Centre {formatFrequency(result.result.centerFrequencyHz)}</span><span>+{formatFrequency(result.result.sampleRateHz / 2)}</span></div>
            <svg viewBox="0 0 640 150" preserveAspectRatio="none" aria-hidden="true">
              <path className="zc-iq-grid" d="M0 30H640 M0 70H640 M0 110H640 M160 0V150 M320 0V150 M480 0V150" />
              <path className="zc-iq-trace" d={`M${result.result.spectrumRelativeDb.map((value, index) => `${(index / (result.result.spectrumRelativeDb.length - 1)) * 640},${Math.max(6, Math.min(144, 8 + ((72 + value) / 72) * 130))}`).join(' L')}`} />
            </svg>
            <small>Relative FFT level · dB below the strongest bin · resolution {result.result.resolutionHz.toFixed(2)} Hz/bin</small>
          </div>
          <div className="zc-device-metric-grid">
            <span><strong>Format</strong>{result.result.format.toUpperCase()}</span>
            <span><strong>Samples</strong>{result.result.sampleCount.toLocaleString()}</span>
            <span><strong>Centre</strong>{formatFrequency(result.result.centerFrequencyHz)}</span>
            <span><strong>Sample rate</strong>{formatFrequency(result.result.sampleRateHz)}</span>
            <span><strong>FFT resolution</strong>{result.result.resolutionHz.toFixed(2)} Hz/bin</span>
            <span><strong>Peak offset</strong>{formatFrequency(result.result.dominantFrequencyHz - result.result.centerFrequencyHz)}</span>
            <span><strong>Peak level</strong>{result.result.peakRelativeDbfs.toFixed(1)} dBFS (relative)</span>
            <span><strong>Mean power</strong>{result.result.meanPowerDbfs.toFixed(1)} dBFS (relative)</span>
          </div>
          <div className="zc-demod-controls">
            <label>Preview demodulator<select value={demodulation} onChange={event => setDemodulation(event.target.value as 'am' | 'fm')}><option value="fm">Narrowband FM discriminator</option><option value="am">AM envelope</option></select></label>
            <button className="btn btn-subtle" type="button" onClick={() => void downloadDemodulated()} disabled={!iqSource}><Download size={14} /> Export demodulated WAV</button>
          </div>
          {demodulatedUrl && <div className="zc-demod-preview"><span>Local demodulated preview · first 5 million IQ samples at most</span><audio controls src={demodulatedUrl} /><a href={demodulatedUrl} download="zioncore-iq-demodulated.wav">Download WAV</a></div>}
          <p className="permission-note">This is a relative software analysis of supplied IQ bytes—not calibrated field strength, verified content, sender identity, or permission to transmit.</p>
        </div>}
        {result && <button className="btn btn-subtle zc-export-measurement" type="button" onClick={() => exportMeasurementReport(result, importedFileName)}><Download size={14} /> Export measurement report (no source recording)</button>}
      </div>
    </section>

    <section className="zc-device-bottom-grid">
      <article className="panel"><div className="panel-head"><span className="panel-title">What the adapter SDK guarantees</span><ShieldCheck size={16} /></div><div className="section-body"><p>Each versioned adapter declares signal domain, model, connection, platform, acquisition route, units, sampling and bandwidth basis, calibration status, discovery, permissions, lifecycle, recovery, data formats and dependencies. An adapter has to validate its payload before it can join the shared registry.</p><p>Acoustic pressure, complex radio IQ and acceleration remain distinct types. Unsupported or missing physical devices never disable microphone capture or file analysis.</p></div></article>
      <article className="panel"><div className="panel-head"><span className="panel-title">Live receiver bridge status</span><Link2 size={16} /></div><div className="section-body"><p className="zc-bridge-state"><span className="zc-bridge-dot" /> No local companion bridge is connected.</p><p>The app does not scan arbitrary networks or accept unauthenticated receiver streams. RTL-SDR and live Phidgets acquisition require a separately installed, authenticated device bridge with a documented adapter protocol. This app currently supports their local file paths without claiming physical connection.</p><p className="permission-note">No radio transmission controls are provided; RTL-SDR Blog V4 is receive-only.</p></div></article>
    </section>
    <section className="panel zc-ai-scope-panel">
      <div className="panel-head"><span className="panel-title">AI interpretation and paid analysis boundary</span><CircleHelp size={16} /></div>
      <div className="section-body">
        <p>Microphone and WAV readings continue through ZionCore’s existing authenticated, quoted, credit-gated interpretation flow. This Device Centre’s SDR IQ, acceleration, and environmental summaries are currently local analyses; they are not sent to an AI provider and no credits are charged for them.</p>
        <p>Those non-acoustic domains need their own input contract, evidence prompt, output validation, price quote, and reservation/settlement path before paid AI interpretation can be enabled safely. This prevents RF, acceleration, or environmental units from being mistaken for acoustic measurements. Local reports can be exported below without including source recordings.</p>
      </div>
    </section>
    <footer className="zc-device-footer"><ShieldCheck size={13} /> Files are analyzed locally. A high sample rate alone does not prove the physical sensor’s bandwidth, calibration, or accuracy. Device-specific live operation remains pending physical hardware and bridge verification.</footer>
  </main>;
}
