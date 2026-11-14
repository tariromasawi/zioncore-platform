import React from 'react';
import { FileAudio, ShieldCheck, Upload } from 'lucide-react';
import type { ChangeEvent } from 'react';
import type { CelestialAudioDecodeResult } from '@/lib/celestial-audio';
import { CELESTIAL_AUDIO_DECODER_LIMITS } from '@/lib/celestial-audio';
import { MAX_AUDIO_CHANNELS, MAX_AUDIO_FILE_BYTES } from '@/lib/audio-file-analysis';

type DtmfAudioReceiverProps = {
  fileName: string;
  result: CelestialAudioDecodeResult | null;
  running: boolean;
  error: string;
  onSelectFile: (file: File) => void;
};

function formatHexSymbols(symbols: number[]) {
  return symbols.map(symbol => symbol.toString(16).toUpperCase()).join(' ');
}

export default function DtmfAudioReceiver({
  fileName,
  result,
  running,
  error,
  onSelectFile,
}: DtmfAudioReceiverProps) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) onSelectFile(file);
    event.currentTarget.value = '';
  };

  return (
    <section
      className="dtmf-receiver"
      aria-labelledby="dtmf-receiver-title"
      aria-busy={running}
      data-testid="panel-dtmf-audio-receiver"
    >
      <header className="dtmf-receiver__header">
        <div className="dtmf-receiver__heading">
          <span className="dtmf-receiver__eyebrow">LOCAL PACKET DECODER</span>
          <h2 id="dtmf-receiver-title">Receive from WAV</h2>
          <p>Recover a supported DTMF packet and inspect the measured decode.</p>
        </div>
        <span className="dtmf-receiver__protocol">ZC / AUDIO</span>
      </header>

      <div className="dtmf-receiver__body">
        <div className="dtmf-receiver__privacy" role="note">
          <ShieldCheck aria-hidden="true" size={17} />
          <p>
            WAV is processed locally in this browser. No microphone is activated,
            and nothing is uploaded or saved.
          </p>
        </div>

        <div className="dtmf-receiver__file-row">
          <div className="dtmf-receiver__file-copy">
            <FileAudio aria-hidden="true" size={18} />
            <span>
              <strong>{fileName || 'No WAV selected'}</strong>
              <small>Choose a file to begin local decoding</small>
            </span>
          </div>
          <label className="dtmf-receiver__select">
            <Upload aria-hidden="true" size={15} />
            <span>{fileName ? 'Choose another WAV' : 'Select WAV'}</span>
            <input
              type="file"
              accept=".wav,audio/wav,audio/x-wav"
              aria-label="Select a WAV file for local DTMF packet decoding"
              data-testid="input-dtmf-wav"
              onChange={handleFileChange}
            />
          </label>
        </div>

        <p className="dtmf-receiver__limits">
          Supported PCM or IEEE-float WAV only · {Math.floor(MAX_AUDIO_FILE_BYTES / 1024 / 1024)} MiB maximum ·
          {' '}{CELESTIAL_AUDIO_DECODER_LIMITS.maximumDurationSeconds} seconds maximum · mono or stereo
          (stereo is averaged to mono).
          CRC detects some corruption but does not authenticate a sender; no physical-device compatibility is implied.
        </p>

        {running && (
          <div className="dtmf-receiver__state" role="status" aria-live="polite" data-testid="status-dtmf-decoding">
            <span className="dtmf-receiver__skeleton" aria-hidden="true" />
            <span className="dtmf-receiver__skeleton dtmf-receiver__skeleton--short" aria-hidden="true" />
            <p>Analyzing the selected WAV locally…</p>
          </div>
        )}

        {!running && error && (
          <div className="dtmf-receiver__error" role="alert" data-testid="status-dtmf-error">
            <strong>Decode not completed</strong>
            <p>{error}</p>
          </div>
        )}

        {!running && !error && result && (
          <div className="dtmf-receiver__result" data-testid="result-dtmf-audio">
            <div className="dtmf-receiver__result-label">
              <span>RECOVERED MESSAGE</span>
              <span className="dtmf-receiver__verified">
                <ShieldCheck aria-hidden="true" size={14} />
                CRC verified
              </span>
            </div>
            <p className="dtmf-receiver__message" data-testid="text-dtmf-message">{result.message}</p>

            <div className="dtmf-receiver__symbols">
              <span>DTMF SYMBOLS · HEX</span>
              <code data-testid="text-dtmf-symbols">{formatHexSymbols(result.symbols)}</code>
            </div>

            <dl className="dtmf-receiver__measurements">
              <div>
                <dt>Detected WAV sample rate</dt>
                <dd>{result.sampleRateHz.toLocaleString()} <small>Hz</small></dd>
              </div>
              <div>
                <dt>Detected symbol duration</dt>
                <dd>{result.symbolDurationMs} <small>ms</small></dd>
              </div>
              <div>
                <dt>Approx. packet start</dt>
                <dd>{result.packetStartSeconds.toFixed(4)} <small>s</small></dd>
              </div>
              <div>
                <dt>Checksum</dt>
                <dd className="dtmf-receiver__checksum">Verified</dd>
              </div>
            </dl>
          </div>
        )}

        {!running && !error && !result && (
          <div className="dtmf-receiver__empty" data-testid="status-dtmf-empty">
            <span className="dtmf-receiver__empty-mark" aria-hidden="true">—</span>
            <p>Select a WAV file to view its recovered text, packet symbols, and decoder measurements.</p>
          </div>
        )}
      </div>
    </section>
  );
}
