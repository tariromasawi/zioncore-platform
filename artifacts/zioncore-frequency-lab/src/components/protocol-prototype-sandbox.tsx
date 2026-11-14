import React, { useMemo, useState } from 'react';
import { Activity, Check, Download, FileJson2, Radio, RotateCcw, ShieldAlert, Waves } from 'lucide-react';
import { encodeWav } from '@/lib/acoustic-message';
import {
  createProtocolPrototypeManifest,
  createProtocolPrototypeWaveform,
  decodeProtocolPrototypeSymbols,
  encodeProtocolPrototypeMessage,
  PROTOCOL_PROTOTYPE_GAPS_MS,
  PROTOCOL_PROTOTYPE_MAX_DURATION_SECONDS,
  PROTOCOL_PROTOTYPE_MAX_MESSAGE_BYTES,
  PROTOCOL_PROTOTYPE_MAX_SYMBOLS,
  PROTOCOL_PROTOTYPE_SAMPLE_RATES,
  PROTOCOL_PROTOTYPE_SYMBOL_DURATIONS_MS,
  type ProtocolPrototypeRecipe,
} from '@/lib/protocol-prototype';

const initialRecipe: ProtocolPrototypeRecipe = {
  name: 'Quiet carrier study',
  baseFrequencyHz: 620,
  frequencySpacingHz: 55,
  sampleRateHz: 48_000,
  symbolDurationMs: 100,
  interSymbolGapMs: 25,
  outputLevel: 0.04,
};

type PrototypeResult = {
  manifest: ReturnType<typeof createProtocolPrototypeManifest>;
  packet: ReturnType<typeof encodeProtocolPrototypeMessage>;
  decoded: ReturnType<typeof decodeProtocolPrototypeSymbols>;
  samples: Float32Array;
};

function downloadFile(filename: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'local-draft';
}

export default function ProtocolPrototypeSandbox() {
  const [recipe, setRecipe] = useState<ProtocolPrototypeRecipe>(initialRecipe);
  const [message, setMessage] = useState('Signal study 04');
  const [result, setResult] = useState<PrototypeResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const byteCount = useMemo(() => new TextEncoder().encode(message).length, [message]);
  const highestFrequency = recipe.baseFrequencyHz + 15 * recipe.frequencySpacingHz;
  const toneTable = useMemo(
    () => Array.from({ length: 16 }, (_, symbol) => recipe.baseFrequencyHz + symbol * recipe.frequencySpacingHz),
    [recipe.baseFrequencyHz, recipe.frequencySpacingHz],
  );

  const updateRecipe = <K extends keyof ProtocolPrototypeRecipe>(key: K, value: ProtocolPrototypeRecipe[K]) => {
    setRecipe(current => ({ ...current, [key]: value }));
    setResult(null);
    setError('');
  };

  const runRoundTrip = () => {
    if (running) return;
    setRunning(true);
    setError('');
    setResult(null);
    window.setTimeout(() => {
      try {
        const manifest = createProtocolPrototypeManifest(recipe);
        const packet = encodeProtocolPrototypeMessage(message, recipe);
        const decoded = decodeProtocolPrototypeSymbols(packet.symbols, recipe);
        const samples = createProtocolPrototypeWaveform(packet, recipe);
        setResult({ manifest, packet, decoded, samples });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'The local round trip could not finish. No audio device or service was used.');
      } finally {
        setRunning(false);
      }
    }, 120);
  };

  const downloadWav = () => {
    if (!result) return;
    const wav = encodeWav(result.samples, recipe.sampleRateHz);
    downloadFile(`${safeFilename(recipe.name)}.wav`, wav, 'audio/wav');
  };

  const downloadManifest = () => {
    if (!result) return;
    downloadFile(
      `${safeFilename(recipe.name)}-manifest.json`,
      JSON.stringify(result.manifest, null, 2),
      'application/json',
    );
  };

  const waveformPoints = useMemo(() => {
    if (!result) return '';
    const count = Math.min(180, result.samples.length);
    const points = Array.from({ length: count }, (_, index) => {
      const sampleIndex = Math.floor(index * (result.samples.length - 1) / Math.max(1, count - 1));
      const x = 2 + index * 396 / Math.max(1, count - 1);
      const y = 42 - result.samples[sampleIndex] * 430;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return points.join(' ');
  }, [result]);

  return (
    <section className="protocol-sandbox" aria-labelledby="protocol-sandbox-title" data-testid="panel-protocol-prototype-sandbox">
      <header className="ps-header">
        <div className="ps-title-wrap">
          <div className="ps-kicker"><span className="ps-kicker-mark" aria-hidden="true" />LOCAL RESEARCH / CANDIDATE 01</div>
          <h2 id="protocol-sandbox-title">Protocol prototype bench</h2>
          <p>Adjust a bounded recipe, then inspect the fixed encode/decode path before exporting a test packet.</p>
        </div>
        <div className="ps-stamp" aria-label="No transmission; browser-local processing">
          <Radio size={17} aria-hidden="true" />
          <span>LOCAL<br />ONLY</span>
        </div>
      </header>

      <div className="ps-safety" role="note" data-testid="note-protocol-safety">
        <ShieldAlert size={17} aria-hidden="true" />
        <p><strong>Draft, not registered.</strong> This candidate stays out of the main protocol registry. It has no authentication or encryption; CRC is error detection only. Settings are interpreted by a fixed declarative kernel. No generated or user-provided source is executed.</p>
      </div>

      <div className="ps-layout">
        <form className="ps-config" onSubmit={event => { event.preventDefault(); runRoundTrip(); }}>
          <div className="ps-section-heading">
            <span className="ps-index">01</span>
            <div><span className="ps-overline">Recipe inputs</span><h3>Set the signal shape.</h3></div>
          </div>

          <div className="ps-fields">
            <label className="ps-field ps-field-full">
              <span>Recipe name</span>
              <input data-testid="input-prototype-name" value={recipe.name} maxLength={48} minLength={3} onChange={event => updateRecipe('name', event.target.value)} />
              <small>3–48 characters · appears in the local manifest</small>
            </label>
            <label className="ps-field">
              <span>Base frequency</span>
              <div className="ps-input-unit"><input data-testid="input-prototype-base-frequency" type="number" min={300} max={1600} step={1} value={recipe.baseFrequencyHz} onChange={event => updateRecipe('baseFrequencyHz', Number(event.target.value))} /><span>Hz</span></div>
            </label>
            <label className="ps-field">
              <span>Tone spacing</span>
              <div className="ps-input-unit"><input data-testid="input-prototype-spacing" type="number" min={25} max={120} step={1} value={recipe.frequencySpacingHz} onChange={event => updateRecipe('frequencySpacingHz', Number(event.target.value))} /><span>Hz</span></div>
            </label>
            <label className="ps-field">
              <span>Sample rate</span>
              <select data-testid="select-prototype-sample-rate" value={recipe.sampleRateHz} onChange={event => updateRecipe('sampleRateHz', Number(event.target.value))}>
                {PROTOCOL_PROTOTYPE_SAMPLE_RATES.map(rate => <option key={rate} value={rate}>{(rate / 1000).toLocaleString()} kHz</option>)}
              </select>
            </label>
            <label className="ps-field">
              <span>Symbol duration</span>
              <select data-testid="select-prototype-symbol-duration" value={recipe.symbolDurationMs} onChange={event => updateRecipe('symbolDurationMs', Number(event.target.value))}>
                {PROTOCOL_PROTOTYPE_SYMBOL_DURATIONS_MS.map(duration => <option key={duration} value={duration}>{duration} ms</option>)}
              </select>
            </label>
            <label className="ps-field">
              <span>Symbol gap</span>
              <select data-testid="select-prototype-symbol-gap" value={recipe.interSymbolGapMs} onChange={event => updateRecipe('interSymbolGapMs', Number(event.target.value))}>
                {PROTOCOL_PROTOTYPE_GAPS_MS.map(gap => <option key={gap} value={gap}>{gap} ms</option>)}
              </select>
            </label>
            <label className="ps-field ps-level-field">
              <span>Output level <output>{recipe.outputLevel.toFixed(2)}</output></span>
              <input data-testid="input-prototype-output-level" type="range" min={0.01} max={0.08} step={0.01} value={recipe.outputLevel} onChange={event => updateRecipe('outputLevel', Number(event.target.value))} />
              <small>Conservative amplitude · no playback</small>
            </label>
            <label className="ps-field ps-field-full">
              <span>Short message <small className="ps-counter">{byteCount}/{PROTOCOL_PROTOTYPE_MAX_MESSAGE_BYTES} UTF-8 bytes</small></span>
              <textarea data-testid="input-prototype-message" value={message} maxLength={96} rows={2} onChange={event => { setMessage(event.target.value); setResult(null); setError(''); }} />
              <small>Maximum {PROTOCOL_PROTOTYPE_MAX_MESSAGE_BYTES} encoded bytes. Keep the message short.</small>
            </label>
          </div>

          <div className="ps-boundary-line" aria-live="polite">
            <span className={highestFrequency > 3500 || highestFrequency >= recipe.sampleRateHz / 2 ? 'ps-boundary-warning' : ''}>
              Highest tone <strong>{highestFrequency.toLocaleString()} Hz</strong>
            </span>
            <span>Ceiling 3,500 Hz · below Nyquist</span>
          </div>
          <button className="ps-run-button" type="submit" disabled={running} data-testid="button-prototype-roundtrip">
            {running ? <><span className="ps-button-pulse" aria-hidden="true" />Running local round trip…</> : <><Activity size={16} aria-hidden="true" />Run encode / decode</>}
          </button>
          <p className="ps-local-note">Deterministic browser computation. Nothing is sent, saved, or played.</p>
        </form>

        <div className="ps-results" aria-live="polite">
          <div className="ps-section-heading ps-results-heading">
            <span className="ps-index">02</span>
            <div><span className="ps-overline">Inspection</span><h3>Read the round trip.</h3></div>
            {result && <span className="ps-verified"><Check size={13} />CRC verified</span>}
          </div>

          {running && <div className="ps-loading" role="status" data-testid="status-prototype-loading">
            <span className="ps-skeleton ps-skeleton-wide" /><span className="ps-skeleton" /><span className="ps-skeleton ps-skeleton-short" />
            <p>Encoding, validating symbols, and building a bounded waveform locally.</p>
          </div>}

          {error && !running && <div className="ps-error" role="alert" data-testid="status-prototype-error">
            <strong>Round trip stopped.</strong><span>{error}</span><button type="button" onClick={runRoundTrip} data-testid="button-prototype-retry">Review settings and retry</button>
          </div>}

          {!result && !running && !error && <div className="ps-empty" data-testid="state-prototype-empty">
            <span className="ps-empty-mark"><Waves size={20} aria-hidden="true" /></span>
            <strong>Ready for a local pass.</strong>
            <span>Run the fixed encoder and decoder to reveal recovered text, symbols, timing, and waveform bounds.</span>
          </div>}

          {result && !running && <>
            <div className="ps-recovered" data-testid="result-prototype-recovered">
              <span className="ps-overline">Recovered message</span>
              <p>{result.decoded.message}</p>
              <span className="ps-check-line"><Check size={13} />Recovered from symbols · {result.decoded.payloadByteLength} UTF-8 payload bytes</span>
            </div>

            <div className="ps-metrics" data-testid="result-prototype-metadata">
              <div><small>Symbols</small><strong>{result.packet.symbols.length}<em> / {PROTOCOL_PROTOTYPE_MAX_SYMBOLS}</em></strong></div>
              <div><small>Duration</small><strong>{result.packet.encodedDurationSeconds.toFixed(2)}<em> sec</em></strong></div>
              <div><small>Wave samples</small><strong>{result.samples.length.toLocaleString()}</strong></div>
            </div>
            <div className="ps-bound-status">
              <span><i aria-hidden="true" />Within prototype bounds</span>
              <span>≤ {PROTOCOL_PROTOTYPE_MAX_DURATION_SECONDS}s · ≤ {PROTOCOL_PROTOTYPE_MAX_SYMBOLS} symbols</span>
            </div>

            <div className="ps-wave-panel">
              <div className="ps-mini-heading"><span>Generated waveform</span><span>{recipe.sampleRateHz.toLocaleString()} Hz</span></div>
              <svg className="ps-wave-svg" viewBox="0 0 400 84" role="img" aria-label={`Sampled waveform preview, ${result.samples.length.toLocaleString()} samples over ${result.packet.encodedDurationSeconds.toFixed(2)} seconds`}>
                <line x1="0" x2="400" y1="42" y2="42" className="ps-wave-axis" />
                <polyline points={waveformPoints} className="ps-wave-line" />
              </svg>
              <div className="ps-wave-foot"><span>Preview decimated for display</span><span>Output ceiling {recipe.outputLevel.toFixed(2)} FS</span></div>
            </div>

            <div className="ps-symbols-block">
              <div className="ps-mini-heading"><span>Decoded symbols</span><span>{result.packet.symbols.length} nibbles</span></div>
              <div className="ps-symbols" aria-label="Decoded symbols, hexadecimal">{result.decoded.symbols.map((symbol, index) => (
                <span key={`${index}-${symbol}`} title={`Symbol ${index + 1}: ${symbol.toString(16).toUpperCase()}`} data-testid={`symbol-prototype-${index}`}>{symbol.toString(16).toUpperCase()}</span>
              ))}</div>
            </div>

            <div className="ps-tones">
              <div className="ps-mini-heading"><span>Tone table</span><span>symbol → frequency</span></div>
              <div className="ps-tone-grid">{toneTable.map((frequency, symbol) => (
                <div className="ps-tone-row" key={symbol}><span>{symbol.toString(16).toUpperCase()}</span><i aria-hidden="true"><b style={{ width: `${20 + symbol * 5}%` }} /></i><strong>{frequency.toLocaleString()} Hz</strong></div>
              ))}</div>
            </div>

            <div className="ps-exports">
              <button type="button" className="ps-export-button" onClick={downloadWav} data-testid="button-download-prototype-wav"><Download size={15} />Download WAV</button>
              <button type="button" className="ps-export-button ps-export-secondary" onClick={downloadManifest} data-testid="button-download-prototype-manifest"><FileJson2 size={15} />Export manifest</button>
              <button type="button" className="ps-reset-button" onClick={() => { setRecipe(initialRecipe); setMessage('Signal study 04'); setResult(null); setError(''); }} aria-label="Reset recipe and message" title="Reset recipe" data-testid="button-reset-prototype"><RotateCcw size={15} /></button>
            </div>
            <p className="ps-export-note">WAV contains generated PCM only. The JSON manifest marks this recipe as a draft that is not registered.</p>
          </>}
        </div>
      </div>
    </section>
  );
}
