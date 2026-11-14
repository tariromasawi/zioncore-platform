import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioLines, Download, SlidersHorizontal, Square, Volume2 } from 'lucide-react';
import WaveformChart from '@/components/waveform-chart';
import {
  createDspSignal,
  DEFAULT_DSP_CONFIG,
  DspConfigSchema,
  encodeDspSignalAsPcm16Wav,
  MAX_DSP_OUTPUT_AMPLITUDE,
  type DspConfig,
  type DspSignal,
} from '@/lib/dsp-config';
import { summarizeWaveform } from '@/lib/live-lab';
import {
  browserLocalAudioOutputAdapter,
  createLocalSpeakerAuthorization,
  EXTERNAL_OUTPUT_READINESS,
  LOCAL_AUDIO_OUTPUT_DESCRIPTOR,
} from '@/lib/transmission-adapters';
import type { DspPlaybackHandle } from '@/lib/dsp-playback';

export default function LocalSignalStudio() {
  const [config, setConfig] = useState<DspConfig>(DEFAULT_DSP_CONFIG);
  const [signal, setSignal] = useState<DspSignal | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [playbackConsent, setPlaybackConsent] = useState(false);
  const [playbackStarting, setPlaybackStarting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const playbackRef = useRef<DspPlaybackHandle | null>(null);
  const playbackRequestRef = useRef(0);
  const mountedRef = useRef(false);
  const waveform = useMemo(
    () => signal ? summarizeWaveform(signal.samples) : null,
    [signal],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      playbackRequestRef.current += 1;
      playbackRef.current?.dispose();
      playbackRef.current = null;
    };
  }, []);

  const update = <K extends keyof DspConfig>(key: K, value: DspConfig[K]) => {
    if (playing || playbackStarting) return;
    setConfig(current => ({ ...current, [key]: value }));
    setSignal(null);
    setPlaybackConsent(false);
    setError('');
    setStatus('Settings changed. Generate a new preview before export.');
  };

  const generate = () => {
    const validation = DspConfigSchema.safeParse(config);
    if (!validation.success) {
      setSignal(null);
      setPlaybackConsent(false);
      setError(validation.error.issues.map(issue => issue.message).join(' '));
      setStatus('');
      return;
    }
    try {
      const next = createDspSignal(validation.data);
      setSignal(next);
      setPlaybackConsent(false);
      setError('');
      setStatus(`Generated ${next.sampleCount.toLocaleString()} mono samples locally. Nothing was played or sent externally.`);
    } catch (cause) {
      setSignal(null);
      setError(cause instanceof Error ? cause.message : 'Could not generate the configured signal.');
      setStatus('');
    }
  };

  const stopPlayback = () => {
    playbackRequestRef.current += 1;
    setPlaybackStarting(false);
    if (playbackRef.current) {
      setStatus('Stopping playback…');
      playbackRef.current.stop();
    } else {
      setPlaying(false);
      setStatus('Playback cancelled. No audio is being played.');
    }
  };

  const playPreview = async () => {
    if (!signal || !playbackConsent || playing || playbackStarting) return;
    const requestId = ++playbackRequestRef.current;
    setPlaybackStarting(true);
    setError('');
    setStatus('Preparing local audio playback…');
    try {
      const authorization = createLocalSpeakerAuthorization({
        explicitConsent: playbackConsent,
        userInitiated: true,
      });
      const handle = await browserLocalAudioOutputAdapter.output(signal, authorization, undefined, () => {
        playbackRef.current = null;
        if (mountedRef.current) {
          setPlaying(false);
          setPlaybackStarting(false);
          setStatus('Playback ended. No audio was recorded or sent externally.');
        }
      });
      if (requestId !== playbackRequestRef.current || !mountedRef.current) {
        handle.dispose();
        return;
      }
      playbackRef.current = handle;
      setPlaying(true);
      setStatus('Playing through the browser-selected audio output at a capped digital level.');
    } catch (cause) {
      if (mountedRef.current && requestId === playbackRequestRef.current) {
        setError(cause instanceof Error ? cause.message : 'Audio playback could not start.');
        setStatus('');
      }
    } finally {
      if (mountedRef.current && requestId === playbackRequestRef.current) {
        setPlaybackStarting(false);
      }
    }
  };

  const exportWav = () => {
    if (!signal) return;
    try {
      const bytes = encodeDspSignalAsPcm16Wav(signal.samples, signal.config.sampleRateHz);
      const blob = new Blob([bytes], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `zioncore-${signal.config.waveform}-${Math.round(signal.config.frequencyHz)}hz.wav`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError('');
      setStatus('The bounded mono PCM16 WAV was downloaded. It was not played or sent externally.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not export this signal as WAV.');
      setStatus('');
    }
  };

  return <section className="panel dsp-studio" aria-labelledby="dsp-studio-title" data-testid="section-local-signal-studio">
    <div className="panel-head">
      <span className="panel-title" id="dsp-studio-title">Local signal configuration studio</span>
      <SlidersHorizontal size={16} color="#758681" />
    </div>
    <div className="dsp-body">
      <p className="empty-inline dsp-intro">Create a bounded local waveform with optional amplitude or frequency modulation and basic filtering. Settings are validated before synthesis and reused unchanged for PCM16 WAV export.</p>

      <div className="dsp-settings-grid">
        <label className="dsp-field" htmlFor="dsp-waveform">
          <span>Base waveform</span>
          <select id="dsp-waveform" className="select-control" value={config.waveform} disabled={playing || playbackStarting} onChange={event => update('waveform', event.target.value as DspConfig['waveform'])} data-testid="select-dsp-waveform">
            <option value="sine">Sine</option><option value="triangle">Triangle</option><option value="square">Square</option><option value="sawtooth">Sawtooth</option>
          </select>
        </label>
        <label className="dsp-field" htmlFor="dsp-frequency">
          <span>Carrier frequency (Hz)</span>
          <input id="dsp-frequency" className="select-control" type="number" min={20} max={10000} step={1} value={config.frequencyHz} disabled={playing || playbackStarting} onChange={event => update('frequencyHz', event.currentTarget.value === '' ? 0 : Number(event.currentTarget.value))} data-testid="input-dsp-frequency" />
        </label>
        <label className="dsp-field" htmlFor="dsp-sample-rate">
          <span>Export sample rate</span>
          <select id="dsp-sample-rate" className="select-control" value={config.sampleRateHz} disabled={playing || playbackStarting} onChange={event => update('sampleRateHz', Number(event.target.value) as DspConfig['sampleRateHz'])} data-testid="select-dsp-sample-rate">
            <option value={22050}>22.05 kHz</option><option value={44100}>44.1 kHz</option><option value={48000}>48 kHz</option>
          </select>
        </label>
        <label className="dsp-field" htmlFor="dsp-duration">
          <span>Duration (seconds)</span>
          <input id="dsp-duration" className="select-control" type="number" min={0.1} max={10} step={0.1} value={config.durationSeconds} disabled={playing || playbackStarting} onChange={event => update('durationSeconds', event.currentTarget.value === '' ? 0 : Number(event.currentTarget.value))} data-testid="input-dsp-duration" />
        </label>
        <label className="dsp-field" htmlFor="dsp-amplitude">
          <span>Peak amplitude (FS)</span>
          <input id="dsp-amplitude" className="select-control" type="number" min={0} max={MAX_DSP_OUTPUT_AMPLITUDE} step={0.01} value={config.amplitude} disabled={playing || playbackStarting} onChange={event => update('amplitude', event.currentTarget.value === '' ? 0 : Number(event.currentTarget.value))} data-testid="input-dsp-amplitude" />
          <small>Maximum {MAX_DSP_OUTPUT_AMPLITUDE.toFixed(2)} FS.</small>
        </label>
        <label className="dsp-field" htmlFor="dsp-modulation">
          <span>Modulation</span>
          <select id="dsp-modulation" className="select-control" value={config.modulation} disabled={playing || playbackStarting} onChange={event => update('modulation', event.target.value as DspConfig['modulation'])} data-testid="select-dsp-modulation">
            <option value="none">None</option><option value="am">Amplitude (AM)</option><option value="fm">Frequency (FM)</option>
          </select>
        </label>
        {config.modulation !== 'none' && <>
          <label className="dsp-field" htmlFor="dsp-modulation-rate">
            <span>Modulation rate (Hz)</span>
            <input id="dsp-modulation-rate" className="select-control" type="number" min={0.1} max={20} step={0.1} value={config.modulationRateHz} disabled={playing || playbackStarting} onChange={event => update('modulationRateHz', event.currentTarget.value === '' ? 0 : Number(event.currentTarget.value))} data-testid="input-dsp-modulation-rate" />
          </label>
          <label className="dsp-field" htmlFor="dsp-modulation-depth">
            <span>Modulation depth (0–1)</span>
            <input id="dsp-modulation-depth" className="select-control" type="number" min={0} max={1} step={0.05} value={config.modulationDepth} disabled={playing || playbackStarting} onChange={event => update('modulationDepth', event.currentTarget.value === '' ? 0 : Number(event.currentTarget.value))} data-testid="input-dsp-modulation-depth" />
          </label>
        </>}
        <label className="dsp-field" htmlFor="dsp-filter">
          <span>Filter</span>
          <select id="dsp-filter" className="select-control" value={config.filter} disabled={playing || playbackStarting} onChange={event => update('filter', event.target.value as DspConfig['filter'])} data-testid="select-dsp-filter">
            <option value="none">None</option><option value="lowpass">Low-pass</option><option value="highpass">High-pass</option><option value="bandpass">Band-pass</option>
          </select>
        </label>
        {(config.filter === 'highpass' || config.filter === 'bandpass') && <label className="dsp-field" htmlFor="dsp-low-cutoff">
          <span>Low cutoff (Hz)</span>
          <input id="dsp-low-cutoff" className="select-control" type="number" min={20} max={config.sampleRateHz / 2 - 1} step={1} value={config.lowCutoffHz} disabled={playing || playbackStarting} onChange={event => update('lowCutoffHz', event.currentTarget.value === '' ? 0 : Number(event.currentTarget.value))} data-testid="input-dsp-low-cutoff" />
        </label>}
        {(config.filter === 'lowpass' || config.filter === 'bandpass') && <label className="dsp-field" htmlFor="dsp-high-cutoff">
          <span>High cutoff (Hz)</span>
          <input id="dsp-high-cutoff" className="select-control" type="number" min={20} max={config.sampleRateHz / 2 - 1} step={1} value={config.highCutoffHz} disabled={playing || playbackStarting} onChange={event => update('highCutoffHz', event.currentTarget.value === '' ? 0 : Number(event.currentTarget.value))} data-testid="input-dsp-high-cutoff" />
        </label>}
      </div>

      {error && <p className="zc-callout zc-callout-alert" role="alert" data-testid="status-dsp-error">{error}</p>}
      {status && <p className="permission-note" role="status" data-testid="status-dsp-message">{status}</p>}
      <div className="dsp-actions">
        <button className="btn btn-primary" onClick={generate} disabled={playing || playbackStarting} data-testid="button-dsp-generate"><AudioLines size={15} />Generate preview</button>
        <button className="btn btn-subtle" onClick={exportWav} disabled={!signal || playing || playbackStarting} data-testid="button-dsp-export"><Download size={15} />Export WAV</button>
      </div>
      {signal ? <div className="dsp-preview" data-testid="panel-dsp-preview">
        <div className="waveform-heading">Generated signal · time-domain preview · not a measurement</div>
        <WaveformChart ranges={waveform} durationSeconds={signal.config.durationSeconds} testId="visual-dsp-waveform" />
        <div className="chart-legend"><span>0 ms</span><span>Normalized amplitude · FS</span><span>{(signal.config.durationSeconds * 1000).toFixed(0)} ms</span></div>
        <div className="dsp-stats">
          <span><small>Peak</small><strong>{signal.peakAmplitude.toFixed(4)} FS</strong></span>
          <span><small>RMS</small><strong>{signal.rmsAmplitude.toFixed(4)} FS</strong></span>
          <span><small>Samples</small><strong>{signal.sampleCount.toLocaleString()}</strong></span>
          <span><small>Format</small><strong>Mono PCM16 WAV</strong></span>
        </div>
        <div className="dsp-playback">
          <label className="dsp-consent" htmlFor="dsp-playback-consent">
            <input
              id="dsp-playback-consent"
              type="checkbox"
              checked={playbackConsent}
              disabled={playbackStarting}
              onChange={event => {
                const next = event.currentTarget.checked;
                setPlaybackConsent(next);
                if (!next && (playing || playbackStarting)) stopPlayback();
              }}
              data-testid="checkbox-dsp-playback-consent"
            />
            <span>I consent to play this preview through the browser-selected output. This is local playback; no external transmission is available.</span>
          </label>
          <div className="dsp-playback-actions">
            {playing || playbackStarting
              ? <button className="btn btn-stop" onClick={stopPlayback} data-testid="button-dsp-stop"><Square size={14} fill="currentColor" />{playbackStarting ? 'Cancel / stop' : 'Stop playback'}</button>
              : <button className="btn btn-primary" onClick={() => void playPreview()} disabled={!playbackConsent || !signal} data-testid="button-dsp-play"><Volume2 size={15} />Play preview</button>}
          </div>
          <p className="small-note dsp-output-note">Output gain is capped at 0.5; generated peak amplitude is capped at 0.25 FS. Device loudness still varies—start with low system volume, and stop if uncomfortable.</p>
          <div className="dsp-output-boundary" data-testid="panel-dsp-output-boundary">
            <p>Available adapter: browser-selected local speaker · up to {LOCAL_AUDIO_OUTPUT_DESCRIPTOR.maxDurationSeconds} seconds · {LOCAL_AUDIO_OUTPUT_DESCRIPTOR.maxDigitalPeak.toFixed(3)} FS digital peak.</p>
            {EXTERNAL_OUTPUT_READINESS.map(output => (
              <p key={output.channel}>{output.channel} output is disabled: {output.blocker}</p>
            ))}
          </div>
        </div>
      </div> : <div className="dsp-empty" data-testid="text-dsp-empty">Generate a preview to validate settings and inspect the resulting waveform. Nothing plays automatically.</div>}
      <p className="small-note dsp-limit-note">Local processing only · 0–0.25 FS amplitude · 0.1–10 seconds · maximum 480,000 samples · playback requires consent and has an immediate stop control.</p>
    </div>
  </section>;
}
