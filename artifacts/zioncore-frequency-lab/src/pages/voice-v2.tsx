import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  Activity, AudioLines, Check, CircleAlert, Download, FileAudio, FileJson,
  LockKeyhole, Mic, Play, Radio, RotateCcw, ShieldCheck, Square, Upload, Waves,
} from 'lucide-react';
import {
  ACOUSTIC_VOICE_PROTOCOL, AcousticDecodeError, decodeAcousticSamples,
  encodeAcousticVoiceMessage, encodeWav, type DecodedAcousticMessage,
  type EncodedVoiceAcousticMessage,
} from '@/lib/acoustic-message';
import { decodeNativeWav, sourceRateLabel } from '@/lib/voice-v2-audio';
import './voice-v2.css';

type AudioSource = {
  samples: Float32Array;
  decoderInputSampleRateHz: number;
  originalSampleRateHz: number | null;
  channels: number;
  durationSeconds: number;
  bitDepth: number | null;
  name: string;
  format: string;
  source: 'file' | 'microphone';
};

type DecodeState = {
  result: DecodedAcousticMessage | null;
  errorCode: string | null;
  errorMessage: string | null;
  processingMs: number;
  completedAt: string;
};

const MAX_FILE_BYTES = 24 * 1024 * 1024;
const MAX_INPUT_SECONDS = 80;

function formatDuration(seconds: number) {
  const whole = Math.floor(seconds);
  const ms = Math.floor((seconds - whole) * 1000);
  return `${whole}.${String(ms).padStart(3, '0')} s`;
}

function monoFromBuffer(buffer: AudioBuffer) {
  const mono = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i += 1) mono[i] += data[i] / buffer.numberOfChannels;
  }
  return mono;
}

function AudioVisuals({ source, liveAnalyser }: { source: AudioSource | null; liveAnalyser: AnalyserNode | null }) {
  const waveRef = useRef<HTMLCanvasElement>(null);
  const spectrogramRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = waveRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = '#090c10';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#232b31';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i += 1) {
      const y = height * i / 5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    ctx.strokeStyle = '#34434a';
    ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
    if (source?.samples.length) {
      const count = Math.min(source.samples.length, Math.floor(width * 2));
      const step = source.samples.length / count;
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, '#d68b59');
      gradient.addColorStop(.55, '#e4c17a');
      gradient.addColorStop(1, '#81b6c6');
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < count; i += 1) {
        const sample = source.samples[Math.floor(i * step)] || 0;
        const x = i / (count - 1) * width;
        const y = height / 2 - sample * height * .43;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, [source]);

  useEffect(() => {
    const canvas = spectrogramRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = '#090c10';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#222b30';
    for (let i = 1; i < 5; i += 1) {
      const y = height * i / 5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    if (!source?.samples.length) return;
    const fftSize = 256;
    const columns = Math.min(180, Math.max(1, Math.floor(width)));
    const bins = fftSize / 2;
    const image = ctx.createImageData(columns, bins);
    for (let x = 0; x < columns; x += 1) {
      const start = Math.floor(x / columns * Math.max(0, source.samples.length - fftSize));
      for (let bin = 0; bin < bins; bin += 1) {
        let real = 0; let imag = 0;
        for (let n = 0; n < fftSize; n += 1) {
          const sample = source.samples[start + n] || 0;
          const window = .5 - .5 * Math.cos(2 * Math.PI * n / (fftSize - 1));
          const angle = 2 * Math.PI * bin * n / fftSize;
          real += sample * window * Math.cos(angle);
          imag -= sample * window * Math.sin(angle);
        }
        const magnitude = Math.hypot(real, imag) / fftSize;
        const level = Math.max(0, Math.min(1, (20 * Math.log10(magnitude + 1e-7) + 88) / 72));
        const p = ((bins - 1 - bin) * columns + x) * 4;
        image.data[p] = Math.round(20 + level * 215);
        image.data[p + 1] = Math.round(28 + level * 150);
        image.data[p + 2] = Math.round(36 + level * 92);
        image.data[p + 3] = 255;
      }
    }
    const buffer = document.createElement('canvas');
    buffer.width = columns; buffer.height = bins;
    buffer.getContext('2d')?.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buffer, 0, 0, width, height);
  }, [source]);

  useEffect(() => {
    if (!liveAnalyser) return;
    const waveCanvas = waveRef.current;
    const spectrumCanvas = spectrogramRef.current;
    if (!waveCanvas || !spectrumCanvas) return;
    const waveContext = waveCanvas.getContext('2d');
    const spectrumContext = spectrumCanvas.getContext('2d');
    if (!waveContext || !spectrumContext) return;
    const timeData = new Uint8Array(liveAnalyser.fftSize);
    const frequencyData = new Uint8Array(liveAnalyser.frequencyBinCount);
    let frame = 0;
    const setCanvasSize = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const ratio = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      return { width, height };
    };
    const draw = () => {
      frame = window.requestAnimationFrame(draw);
      liveAnalyser.getByteTimeDomainData(timeData);
      liveAnalyser.getByteFrequencyData(frequencyData);
      const waveSize = setCanvasSize(waveCanvas, waveContext);
      const spectrumSize = setCanvasSize(spectrumCanvas, spectrumContext);

      waveContext.fillStyle = '#090c10';
      waveContext.fillRect(0, 0, waveSize.width, waveSize.height);
      waveContext.strokeStyle = '#232b31';
      waveContext.lineWidth = 1;
      for (let i = 1; i < 5; i += 1) {
        const y = waveSize.height * i / 5;
        waveContext.beginPath(); waveContext.moveTo(0, y); waveContext.lineTo(waveSize.width, y); waveContext.stroke();
      }
      waveContext.strokeStyle = '#34434a';
      waveContext.beginPath(); waveContext.moveTo(0, waveSize.height / 2); waveContext.lineTo(waveSize.width, waveSize.height / 2); waveContext.stroke();
      const waveGradient = waveContext.createLinearGradient(0, 0, waveSize.width, 0);
      waveGradient.addColorStop(0, '#d68b59');
      waveGradient.addColorStop(.55, '#e4c17a');
      waveGradient.addColorStop(1, '#81b6c6');
      waveContext.strokeStyle = waveGradient;
      waveContext.lineWidth = 1.35;
      waveContext.beginPath();
      for (let i = 0; i < timeData.length; i += 1) {
        const x = i / (timeData.length - 1) * waveSize.width;
        const y = (timeData[i] / 255) * waveSize.height;
        if (i === 0) waveContext.moveTo(x, y); else waveContext.lineTo(x, y);
      }
      waveContext.stroke();

      spectrumContext.fillStyle = '#090c10';
      spectrumContext.fillRect(0, 0, spectrumSize.width, spectrumSize.height);
      spectrumContext.strokeStyle = '#222b30';
      for (let i = 1; i < 5; i += 1) {
        const y = spectrumSize.height * i / 5;
        spectrumContext.beginPath(); spectrumContext.moveTo(0, y); spectrumContext.lineTo(spectrumSize.width, y); spectrumContext.stroke();
      }
      const binsToDraw = Math.min(180, frequencyData.length);
      const binWidth = spectrumSize.width / binsToDraw;
      for (let i = 0; i < binsToDraw; i += 1) {
        const magnitude = frequencyData[i] / 255;
        const barHeight = magnitude * spectrumSize.height;
        spectrumContext.fillStyle = i < binsToDraw * .65 ? '#d39a58' : '#79aabb';
        spectrumContext.globalAlpha = .28 + magnitude * .72;
        spectrumContext.fillRect(i * binWidth, spectrumSize.height - barHeight, Math.max(1, binWidth - .65), barHeight);
      }
      spectrumContext.globalAlpha = 1;
    };
    draw();
    return () => window.cancelAnimationFrame(frame);
  }, [liveAnalyser]);

  return <div className="v2-visual-stack">
    <div className="v2-viz-title"><span><Waves size={14} /> Time-domain waveform</span><small role="status" data-testid="status-live-monitor">{liveAnalyser ? 'live · local monitor' : source ? 'normalized amplitude' : 'awaiting signal'}</small></div>
    <canvas ref={waveRef} className="v2-wave-canvas" aria-label="Audio waveform visualization" data-testid="visual-voice-waveform" />
    <div className="v2-viz-title v2-spect-title"><span><Activity size={14} /> Spectral view</span><small>{source ? `0–${(source.decoderInputSampleRateHz / 2000).toFixed(1)} kHz` : 'frequency × time'}</small></div>
    <canvas ref={spectrogramRef} className="v2-spect-canvas" aria-label="Audio spectrogram visualization" data-testid="visual-voice-spectrogram" />
    <div className="v2-axis"><span>low frequency</span><span>time →</span><span>high frequency</span></div>
  </div>;
}

export default function VoiceV2Page() {
  const [source, setSource] = useState<AudioSource | null>(null);
  const [decode, setDecode] = useState<DecodeState | null>(null);
  const [encoded, setEncoded] = useState<EncodedVoiceAcousticMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [liveAnalyser, setLiveAnalyser] = useState<AnalyserNode | null>(null);
  const [error, setError] = useState('');
  const [segmentStart, setSegmentStart] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const playbackRef = useRef<AudioBufferSourceNode | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const monitorSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const monitorAnalyserRef = useRef<AnalyserNode | null>(null);
  const recordingFailedRef = useRef(false);
  const recordStartedRef = useRef(0);
  const getAudioContext = () => {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    return audioContextRef.current;
  };
  const stopPlayback = () => {
    try { playbackRef.current?.stop(); } catch { /* already stopped */ }
    playbackRef.current = null;
  };
  const disconnectMonitor = () => {
    try { monitorSourceRef.current?.disconnect(); } catch { /* already disconnected */ }
    try { monitorAnalyserRef.current?.disconnect(); } catch { /* already disconnected */ }
    monitorSourceRef.current = null;
    monitorAnalyserRef.current = null;
    setLiveAnalyser(null);
  };
  const playSamples = async (samples: Float32Array, sampleRateHz: number) => {
    stopPlayback();
    const playback = playbackContextRef.current ?? new AudioContext();
    playbackContextRef.current = playback;
    if (playback.state === 'suspended') await playback.resume();
    const buffer = playback.createBuffer(1, samples.length, sampleRateHz);
    const channelData = new Float32Array(new ArrayBuffer(samples.length * Float32Array.BYTES_PER_ELEMENT));
    channelData.set(samples);
    buffer.copyToChannel(channelData, 0);
    const node = playback.createBufferSource();
    node.buffer = buffer;
    node.connect(playback.destination);
    node.onended = () => { if (playbackRef.current === node) playbackRef.current = null; };
    playbackRef.current = node;
    node.start();
  };

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    try { monitorSourceRef.current?.disconnect(); } catch { /* already disconnected */ }
    try { monitorAnalyserRef.current?.disconnect(); } catch { /* already disconnected */ }
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    stopPlayback();
    void audioContextRef.current?.close();
    void playbackContextRef.current?.close();
  }, []);

  const runDecode = async (audio: AudioSource) => {
    setBusy(true);
    setError('');
    await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
    const started = performance.now();
    try {
      if (audio.decoderInputSampleRateHz < 16_000) {
        throw new AcousticDecodeError(
          'UNSUPPORTED_SAMPLE_RATE',
          'Voice V2 needs at least 16 kHz input. At 8 kHz, its 6.8 kHz carrier is above the Nyquist limit.',
        );
      }
      const result = decodeAcousticSamples(audio.samples, audio.decoderInputSampleRateHz);
      if (result.payloadType !== 'voice') {
        throw new AcousticDecodeError('UNSUPPORTED_PAYLOAD', 'A valid packet was detected, but it is not a Voice V2 audio packet.');
      }
      setDecode({
        result,
        errorCode: null,
        errorMessage: null,
        processingMs: performance.now() - started,
        completedAt: new Date().toISOString(),
      });
    } catch (cause) {
      const code = cause instanceof AcousticDecodeError ? cause.code : 'DECODE_ERROR';
      const message = cause instanceof Error ? cause.message : 'The local decoder could not process this audio.';
      setDecode({
        result: null,
        errorCode: code,
        errorMessage: message,
        processingMs: performance.now() - started,
        completedAt: new Date().toISOString(),
      });
    } finally {
      setBusy(false);
    }
  };

  const loadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setError('');
    setDecode(null);
    setEncoded(null);
    setSource(null);
    setSegmentStart(0);
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      setError('Choose a non-empty audio file up to 24 MiB.');
      return;
    }
    setBusy(true);
    try {
      const bytes = await file.arrayBuffer();
      const isWav = file.name.toLowerCase().endsWith('.wav')
        || /audio\/(wav|x-wav)/i.test(file.type)
        || (bytes.byteLength >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF'
          && new TextDecoder().decode(bytes.slice(8, 12)) === 'WAVE');
      let audio: AudioSource;
      if (isWav) {
        const native = decodeNativeWav(bytes);
        audio = {
          samples: native.samples,
          decoderInputSampleRateHz: native.sampleRateHz,
          originalSampleRateHz: native.sampleRateHz,
          channels: native.channels,
          durationSeconds: native.durationSeconds,
          bitDepth: native.bitDepth,
          name: file.name,
          format: `WAV · ${native.encoding} ${native.bitDepth}-bit`,
          source: 'file',
        };
      } else {
        const context = getAudioContext();
        if (context.state === 'suspended') await context.resume();
        const buffer = await context.decodeAudioData(bytes.slice(0));
        if (buffer.duration > MAX_INPUT_SECONDS) throw new Error(`Audio exceeds the ${MAX_INPUT_SECONDS}-second local processing limit.`);
        audio = {
          samples: monoFromBuffer(buffer),
          decoderInputSampleRateHz: buffer.sampleRate,
          originalSampleRateHz: null,
          channels: buffer.numberOfChannels,
          durationSeconds: buffer.duration,
          bitDepth: null,
          name: file.name,
          format: file.type || file.name.split('.').pop()?.toUpperCase() || 'Browser-decoded audio',
          source: 'file',
        };
      }
      if (audio.durationSeconds > MAX_INPUT_SECONDS) throw new Error(`Audio exceeds the ${MAX_INPUT_SECONDS}-second local processing limit.`);
      setSource(audio);
      await runDecode(audio);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This browser could not decode the selected audio file.');
    } finally {
      setBusy(false);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    disconnectMonitor();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    setRecording(false);
  };
  const startRecording = async () => {
    setError('');
    setDecode(null);
    setEncoded(null);
    setSource(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        throw new Error('This browser does not support local microphone recording.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const captureSampleRateHz = stream.getAudioTracks()[0]?.getSettings().sampleRate ?? null;
      const context = getAudioContext();
      if (context.state === 'suspended') await context.resume();
      const monitorSource = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = .72;
      monitorSourceRef.current = monitorSource;
      monitorAnalyserRef.current = analyser;
      monitorSource.connect(analyser);
      setLiveAnalyser(analyser);
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recordingFailedRef.current = false;
      recordStartedRef.current = performance.now();
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onerror = () => {
        recordingFailedRef.current = true;
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
        disconnectMonitor();
        stream.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
        setRecording(false);
        setError('The browser could not complete this recording.');
        if (recorder.state === 'recording') recorder.stop();
      };
      recorder.onstop = async () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
        disconnectMonitor();
        stream.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
        setRecording(false);
        if (recordingFailedRef.current) return;
        const duration = Math.min(2, (performance.now() - recordStartedRef.current) / 1000);
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
          const context = getAudioContext();
          if (context.state === 'suspended') await context.resume();
          const decoded = await context.decodeAudioData(await blob.arrayBuffer());
          const audio: AudioSource = {
            samples: monoFromBuffer(decoded),
            decoderInputSampleRateHz: decoded.sampleRate,
            originalSampleRateHz: Number.isFinite(captureSampleRateHz) ? captureSampleRateHz : null,
            channels: decoded.numberOfChannels,
            durationSeconds: decoded.duration,
            bitDepth: null,
            name: 'Local microphone take',
            format: recorder.mimeType || 'Browser recording',
            source: 'microphone',
          };
          const takeNotice = audio.durationSeconds > 2.05 || duration < .25
            ? 'Voice encoding supports 0.25–2.00 seconds. This take is available for decoding, but not encoding.'
            : '';
          setSource(audio);
          setSegmentStart(0);
          await runDecode(audio);
          if (takeNotice) setError(takeNotice);
        } catch {
          setError('The microphone recording was captured but could not be decoded by this browser.');
        }
      };
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = window.setInterval(() => {
        const elapsed = (performance.now() - recordStartedRef.current) / 1000;
        setRecordSeconds(Math.min(2, elapsed));
        if (elapsed >= 2) stopRecording();
      }, 40);
    } catch (cause) {
      disconnectMonitor();
      mediaStreamRef.current?.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
      setRecording(false);
      setError(cause instanceof Error ? cause.message : 'Microphone access was not available.');
    }
  };

  const encodeSegment = () => {
    if (!source) return;
    const duration = Math.min(2, source.durationSeconds - segmentStart);
    if (duration < .25) {
      setError('Choose at least 0.25 seconds of audio for encoding.');
      return;
    }
    const start = Math.floor(segmentStart * source.decoderInputSampleRateHz);
    const end = Math.min(source.samples.length, start + Math.floor(duration * source.decoderInputSampleRateHz));
    try {
      const packet = encodeAcousticVoiceMessage(source.samples.slice(start, end), source.decoderInputSampleRateHz);
      setEncoded(packet);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The Voice V2 packet could not be encoded.');
    }
  };

  const saveBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  const downloadPacket = () => {
    if (encoded) saveBlob(new Blob([encoded.wav], { type: 'audio/wav' }), `zioncore-voice-v2-${encoded.messageId.slice(0, 8)}.wav`);
  };
  const downloadReport = () => {
    const report = {
      product: 'ZionCore Voice V2 local diagnostic',
      generatedAt: new Date().toISOString(),
      processingLocation: 'browser-local',
      audioUploaded: false,
      source: source ? {
        name: source.name,
        source: source.source,
        format: source.format,
        durationSeconds: source.durationSeconds,
        channels: source.channels,
        originalSampleRateHz: source.originalSampleRateHz,
        decoderInputSampleRateHz: source.decoderInputSampleRateHz,
        bitDepth: source.bitDepth == null ? 'unavailable' : source.bitDepth,
      } : null,
      decoder: decode ? {
        status: decode.result ? 'packet_verified' : 'no_valid_voice_packet',
        errorCode: decode.errorCode,
        errorMessage: decode.errorMessage,
        processingMs: Number(decode.processingMs.toFixed(3)),
        payloadType: decode.result?.payloadType ?? null,
        protocolVersion: decode.result?.protocolVersion ?? null,
        integrity: decode.result?.integrity ?? null,
        messageId: decode.result?.messageId ?? null,
        sourceSampleRateHz: source?.originalSampleRateHz ?? null,
        decoderInputSampleRateHz: source?.decoderInputSampleRateHz ?? null,
        codecProcessingSampleRateHz: decode.result?.payloadType === 'voice'
          ? decode.result.decoderSampleRateHz ?? 48_000
          : source && source.decoderInputSampleRateHz >= 16_000 ? 48_000 : null,
        decoderSampleRateHz: decode.result?.payloadType === 'voice' ? decode.result.decoderSampleRateHz ?? null : null,
        recoveredAudioSampleRateHz: decode.result?.payloadType === 'voice' ? decode.result.audioSampleRateHz : null,
        recoveredAudioDurationSeconds: decode.result?.payloadType === 'voice' ? decode.result.audioDurationSeconds : null,
      } : null,
      encoded: encoded ? {
        payloadType: encoded.payloadType,
        protocolVersion: encoded.protocolVersion,
        messageId: encoded.messageId,
        sourceAudioDurationSeconds: encoded.audioDurationSeconds,
        packetDurationSeconds: encoded.durationSeconds,
        sampleRateHz: encoded.sampleRateHz,
        payloadBytes: encoded.payloadBytes,
      } : null,
    };
    saveBlob(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), 'zioncore-voice-v2-diagnostics.json');
  };

  const recovered = decode?.result?.payloadType === 'voice' ? decode.result : null;
  const packetNoMatch = decode?.errorCode === 'PREAMBLE_NOT_FOUND';
  const isDecodeSuccess = Boolean(recovered && recovered.integrity === 'verified');
  const effectiveDecoderRate = decode?.result?.payloadType === 'voice'
    ? decode.result.decoderSampleRateHz ?? decode.result.sampleRateHz
    : source && source.decoderInputSampleRateHz >= 16_000 ? ACOUSTIC_VOICE_PROTOCOL.sampleRateHz : null;
  const sliderMax = source ? Math.max(0, source.durationSeconds - .25) : 0;

  return <main className="v2-workspace" id="main-content">
    <div className="v2-ambient-geometry" aria-hidden="true"><i /><i /><i /></div>
    <div className="v2-shell">
      <header className="v2-heading">
        <div className="v2-kicker"><span className="v2-kicker-mark" /> ZIONCORE / PRIVATE PROTOCOL LAB</div>
        <div className="v2-title-row">
          <div><h1>Voice <em>V2</em></h1><p className="v2-deck">Acoustic packets, inspected without invention.</p></div>
          <div className="v2-private-chip"><LockKeyhole size={13} /> LOCAL ONLY</div>
        </div>
        <p className="v2-intro">Capture, encode and decode Voice V2 audio packets in this browser. Ordinary audio is never presented as a recovered message; it is only a packet when the protocol verifies it.</p>
      </header>

      <div className="v2-workbench">
        <section className="v2-panel v2-input-panel">
          <div className="v2-panel-head"><div><span className="v2-index">01 / INPUT</span><h2>Bring a signal</h2></div><Radio size={18} /></div>
          <div className="v2-source-actions">
            <label className="v2-file-button" htmlFor="v2-file"><Upload size={15} /> Choose audio file</label>
            <input id="v2-file" className="v2-visually-hidden" type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm,.flac" disabled={busy || recording} onChange={event => void loadFile(event)} data-testid="input-voice-file" aria-label="Choose an audio file for local decoding" />
            {!recording
              ? <button className="v2-button v2-record-button" type="button" onClick={() => void startRecording()} disabled={busy} data-testid="button-record"><Mic size={15} /> Record locally</button>
              : <button className="v2-button v2-stop-button" type="button" onClick={stopRecording} data-testid="button-stop-record"><Square size={13} fill="currentColor" /> Stop · {recordSeconds.toFixed(1)}s</button>}
          </div>
          <p className="v2-help">Microphone permission is requested only after you start recording. Captures stop automatically at 2 seconds.</p>
          {busy && <div className="v2-loading" role="status" data-testid="status-processing"><span /><span /><span /> Decoding locally…</div>}
          {error && <div className="v2-alert" role="alert" data-testid="status-voice-error"><CircleAlert size={16} />{error}</div>}
          <div className="v2-source-meta">
            <div><span>Input</span><strong data-testid="value-source-name">{source?.name ?? 'No audio selected'}</strong></div>
            <div><span>Format</span><strong data-testid="value-source-format">{source?.format ?? '—'}</strong></div>
            <div><span>Duration</span><strong data-testid="value-source-duration">{source ? formatDuration(source.durationSeconds) : '—'}</strong></div>
            <div><span>Channels</span><strong data-testid="value-source-channels">{source ? `${source.channels} ch` : '—'}</strong></div>
            <div><span>Original source rate</span><strong data-testid="value-source-rate">{source ? sourceRateLabel(source.originalSampleRateHz) : '—'}</strong></div>
            <div><span>Decoder input rate</span><strong data-testid="value-input-rate">{source ? `${(source.decoderInputSampleRateHz / 1000).toFixed(2)} kHz` : '—'}</strong></div>
            <div><span>Bit depth</span><strong data-testid="value-source-bit-depth">{source ? source.bitDepth == null ? 'Unavailable' : `${source.bitDepth}-bit` : '—'}</strong></div>
          </div>
          <AudioVisuals source={source} liveAnalyser={liveAnalyser} />
          {source && <div className="v2-play-actions">
            <button className="v2-text-button" type="button" onClick={() => void playSamples(source.samples, source.decoderInputSampleRateHz)} data-testid="button-play-source"><Play size={14} /> Play source audio</button>
            <button className="v2-text-button" type="button" onClick={async () => { setDecode(null); await runDecode(source); }} disabled={busy} data-testid="button-decode-again"><RotateCcw size={14} /> Decode again</button>
          </div>}
          {source && <div className="v2-encode-box">
            <div className="v2-encode-title"><AudioLines size={15} /> Encode a Voice V2 packet</div>
            <p>Voice payloads carry audio, not speech-to-text. Choose a 0.25–2.00 second section.</p>
            <label className="v2-slider-label" htmlFor="v2-segment-start"><span>Segment start</span><span data-testid="value-segment-start">{segmentStart.toFixed(2)} s</span></label>
            <input id="v2-segment-start" type="range" min="0" max={sliderMax} step=".01" value={Math.min(segmentStart, sliderMax)} onChange={event => setSegmentStart(Number(event.target.value))} disabled={sliderMax <= 0} data-testid="input-segment-start" />
            <button className="v2-button v2-gold-button" type="button" onClick={encodeSegment} disabled={source.durationSeconds - segmentStart < .25} data-testid="button-encode"><AudioLines size={15} /> Encode selected audio</button>
            <small>0.25–2 s input · protocol v{ACOUSTIC_VOICE_PROTOCOL.version} · 48 kHz packet</small>
          </div>}
        </section>

        <section className="v2-panel v2-result-panel">
          <div className="v2-panel-head"><div><span className="v2-index">02 / DIAGNOSTICS</span><h2>Read the packet</h2></div><ShieldCheck size={18} /></div>
          {!decode && <div className="v2-empty" data-testid="status-decode-empty"><span className="v2-empty-glyph"><AudioLines size={22} /></span><strong>Awaiting a signal</strong><p>Select audio or record a short sample. The decoder will report what it can actually verify.</p></div>}
          {decode && <div className={`v2-result-state ${isDecodeSuccess ? 'is-valid' : packetNoMatch ? 'is-absent' : 'is-invalid'}`} role="status" data-testid="status-decode-result">
            <div className="v2-result-mark">{isDecodeSuccess ? <Check size={19} /> : packetNoMatch ? <Waves size={19} /> : <CircleAlert size={19} />}</div>
            <div><strong>{isDecodeSuccess ? 'Voice V2 packet verified' : packetNoMatch ? 'No Voice V2 packet detected' : 'Packet not verified'}</strong><p>{isDecodeSuccess ? 'CRC integrity passed. Recovered audio is available below.' : packetNoMatch ? 'No supported preamble was found. This input remains ordinary audio; it is not a recovered message.' : decode.errorMessage}</p></div>
          </div>}
          {decode && <div className="v2-diagnostics">
            <div><span>Payload</span><strong data-testid="value-payload-type">{decode.result?.payloadType ?? '—'}</strong></div>
            <div><span>Protocol version</span><strong data-testid="value-protocol-version">{decode.result?.protocolVersion ?? '—'}</strong></div>
            <div><span>Integrity</span><strong className={isDecodeSuccess ? 'v2-integrity-ok' : ''} data-testid="value-integrity">{decode.result?.integrity === 'verified' ? 'CRC verified' : decode.errorCode === 'INTEGRITY_FAILED' ? 'CRC failed' : 'Not established'}</strong></div>
            <div><span>Decoder result</span><strong data-testid="value-decoder-error">{decode.errorCode ?? '—'}</strong></div>
            <div><span>Message ID</span><strong className="v2-mono" data-testid="value-message-id">{decode.result?.messageId ?? '—'}</strong></div>
            <div><span>Processing time</span><strong data-testid="value-processing-time">{decode.processingMs.toFixed(2)} ms</strong></div>
            <div><span>Original source rate</span><strong data-testid="value-original-rate">{source ? sourceRateLabel(source.originalSampleRateHz) : '—'}</strong></div>
            <div><span>Decoder input rate</span><strong data-testid="value-decoder-input-rate">{source ? `${(source.decoderInputSampleRateHz / 1000).toFixed(2)} kHz` : '—'}</strong></div>
            <div><span>Codec processing rate</span><strong data-testid="value-decoder-rate">{effectiveDecoderRate ? `${(effectiveDecoderRate / 1000).toFixed(2)} kHz` : '—'}</strong></div>
          </div>}
          {recovered && <div className="v2-recovered">
            <div className="v2-recovered-head"><div><span className="v2-index">RECOVERED AUDIO</span><strong>{formatDuration(recovered.audioDurationSeconds)}</strong></div><span className="v2-verified"><ShieldCheck size={13} /> CRC PASS</span></div>
            <p>Decoded audio · {(recovered.audioSampleRateHz / 1000).toFixed(1)} kHz · {recovered.payloadBytes.toLocaleString()} payload bytes</p>
            <button className="v2-button v2-play-recovered" type="button" onClick={() => void playSamples(recovered.audioSamples, recovered.audioSampleRateHz)} data-testid="button-play-recovered"><Play size={15} /> Play recovered audio</button>
          </div>}
          {encoded && <div className="v2-encoded-result" data-testid="status-encoded-packet">
            <div className="v2-encoded-top"><span className="v2-verified"><Check size={13} /> PACKET ENCODED</span><span className="v2-mono">v{encoded.protocolVersion} · {encoded.payloadBytes.toLocaleString()} bytes</span></div>
            <div className="v2-encoded-id">{encoded.messageId}</div>
            <div className="v2-encoded-actions">
              <button className="v2-button v2-play-recovered" type="button" onClick={() => void playSamples(encoded.samples, encoded.sampleRateHz)} data-testid="button-play-encoded"><Play size={14} /> Preview packet</button>
              <button className="v2-button v2-outline-button" type="button" onClick={downloadPacket} data-testid="button-download-packet"><Download size={14} /> Download WAV</button>
            </div>
            <p className="v2-output-scope" data-testid="note-output-scope">Preview plays through this browser’s selected audio output. Download WAV saves a file through your browser. This app does not transmit by radio or send the packet to a remote service.</p>
          </div>}
          <div className="v2-report">
            <div><FileJson size={16} /><span><strong>Diagnostic report</strong><small>Metadata only · no audio included</small></span></div>
            <button className="v2-icon-button" type="button" onClick={downloadReport} disabled={!source && !decode && !encoded} aria-label="Download JSON diagnostic report" data-testid="button-download-report"><Download size={16} /></button>
          </div>
        </section>
      </div>

      <footer className="v2-footnote">
        <div className="v2-footnote-mark"><LockKeyhole size={15} /></div>
        <div><strong>Your audio stays here.</strong><p>Processing occurs in this browser tab. Nothing is uploaded or persisted. Voice V2 supports input from 16 kHz upward; an 8 kHz signal cannot represent its 6.8 kHz carrier. Browser-decoded bit depth is unavailable and is not inferred.</p></div>
        <div className="v2-footer-sigil" aria-hidden="true"><FileAudio size={19} /></div>
      </footer>
    </div>
  </main>;
}
