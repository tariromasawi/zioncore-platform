import { useEffect, useRef, useState } from 'react';
import { takeResponseDraft } from '@/lib/response-draft';
import {
  AudioLines, Check, Download, FileAudio, Info, Mic, Radio, ShieldCheck,
  Square, Upload, Volume2,
} from 'lucide-react';
import {
  ACOUSTIC_MESSAGE_PROTOCOL,
  ACOUSTIC_VOICE_PROTOCOL,
  AcousticDecodeError,
  decodeAcousticSamples,
  encodeAcousticVoiceMessage,
  encodeAcousticMessage,
  type AcousticTextPayloadType,
  type DecodedAcousticMessage,
  type EncodedAcousticMessage,
} from '@/lib/acoustic-message';
import { createAudioPlaybackController } from '@/lib/audio-playback';
import {
  PacketReplayWindow,
  PACKET_REPLAY_WINDOW_SIZE,
} from '@/lib/packet-replay-window';

const MAX_RECEIVE_DURATION_SECONDS = 120;
const MAX_RECEIVE_FILE_BYTES = 12 * 1024 * 1024;
type ReceiveStage = 'idle' | 'listening' | 'checking' | 'candidate' | 'verified' | 'miss';

const candidateFrameErrors = new Set<AcousticDecodeError['code']>([
  'TRUNCATED_FRAME',
  'UNSUPPORTED_PROTOCOL',
  'UNSUPPORTED_PAYLOAD',
  'PAYLOAD_TOO_LARGE',
  'INTEGRITY_FAILED',
  'INVALID_TEXT',
]);

function receiveFailureStage(error: unknown): ReceiveStage {
  return error instanceof AcousticDecodeError && candidateFrameErrors.has(error.code)
    ? 'candidate'
    : 'miss';
}

function receiveStageLabel(stage: ReceiveStage): string {
  switch (stage) {
    case 'listening': return 'Listening · user-started capture';
    case 'checking': return 'Checking · validating the captured frame';
    case 'candidate': return 'Detected · candidate frame is unverified';
    case 'verified': return 'Verified · CRC passed';
    case 'miss': return 'No verified packet recovered';
    default: return 'Ready · no receiver is active';
  }
}

type SpeechRecognitionAlternativeLike = { transcript: string };
type SpeechRecognitionResultLike = ArrayLike<SpeechRecognitionAlternativeLike> & { isFinal: boolean };
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionErrorLike = { error?: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function asMessageError(error: unknown): string {
  if (error instanceof AcousticDecodeError) return error.message;
  if (error instanceof Error) return error.message;
  return 'The audio could not be processed. Choose another recording and try again.';
}

function inspectAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const cleanup = () => {
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.removeAttribute('src');
      URL.revokeObjectURL(url);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error('The recording duration could not be verified.'));
      } else {
        resolve(duration);
      }
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error('This browser could not inspect the selected audio file.'));
    };
    audio.src = url;
    audio.load();
  });
}

function downmixAudio(buffer: AudioBuffer): Float32Array {
  const mono = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel);
    for (let index = 0; index < samples.length; index += 1) mono[index] += samples[index] / buffer.numberOfChannels;
  }
  return mono;
}

export default function MessagesPage() {
  const [payloadType, setPayloadType] = useState<AcousticTextPayloadType>('text');
  const [composerMode, setComposerMode] = useState<'text' | 'speech' | 'voice'>('text');
  const [text, setText] = useState(() => {
    if (typeof window === 'undefined') return '';
    return takeResponseDraft(undefined, Date.now(), false);
  });
  useEffect(() => { takeResponseDraft(); }, []);
  const [encoded, setEncoded] = useState<EncodedAcousticMessage | null>(null);
  const [encodeError, setEncodeError] = useState('');
  const [speechConsent, setSpeechConsent] = useState(false);
  const [speechListening, setSpeechListening] = useState(false);
  const [speechStatus, setSpeechStatus] = useState('');
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceStarting, setVoiceStarting] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const [decoded, setDecoded] = useState<DecodedAcousticMessage | null>(null);
  const [receiveStage, setReceiveStage] = useState<ReceiveStage>('idle');
  const [duplicatePacket, setDuplicatePacket] = useState(false);
  const [decodeError, setDecodeError] = useState('');
  const [receivingMode, setReceivingMode] = useState<'file' | 'microphone'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingFile, setProcessingFile] = useState(false);
  const [recording, setRecording] = useState(false);
  const [startingMic, setStartingMic] = useState(false);
  const [micStatus, setMicStatus] = useState('');
  const [playing, setPlaying] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState('');
  const sampleCount = new TextEncoder().encode(text).length;
  const messageBytes = useRef<Float32Array[]>([]);
  const receivedPacketWindowRef = useRef(new PacketReplayWindow());
  const streamRef = useRef<MediaStream | null>(null);
  const micContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const micRequestRef = useRef(0);
  const captureTimeoutRef = useRef<number | null>(null);
  const playbackUrlRef = useRef<string | null>(null);
  const playbackControllerRef = useRef<ReturnType<typeof createAudioPlaybackController> | null>(null);
  if (!playbackControllerRef.current) {
    playbackControllerRef.current = createAudioPlaybackController({
      onPlayingChange: setPlaying,
      onStatusChange: setPlaybackStatus,
    });
  }
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceChunksRef = useRef<Float32Array[]>([]);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceContextRef = useRef<AudioContext | null>(null);
  const voiceProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const voiceSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const voiceSilentGainRef = useRef<GainNode | null>(null);
  const voiceCaptureTimeoutRef = useRef<number | null>(null);
  const voiceCaptureActiveRef = useRef(false);
  const voiceRequestRef = useRef(0);

  const stopPlayback = () => playbackControllerRef.current?.stop();

  const setDecodedPacket = (packet: DecodedAcousticMessage) => {
    setDuplicatePacket(receivedPacketWindowRef.current.observe(packet.messageId));
    setDecoded(packet);
    setReceiveStage('verified');
  };

  const stopVoiceRecording = async () => {
    if (!voiceCaptureActiveRef.current && !voiceContextRef.current && !voiceStreamRef.current) return;
    voiceRequestRef.current += 1;
    voiceCaptureActiveRef.current = false;
    if (voiceCaptureTimeoutRef.current !== null) {
      window.clearTimeout(voiceCaptureTimeoutRef.current);
      voiceCaptureTimeoutRef.current = null;
    }
    if (voiceProcessorRef.current) voiceProcessorRef.current.onaudioprocess = null;
    voiceProcessorRef.current?.disconnect();
    voiceSourceRef.current?.disconnect();
    voiceSilentGainRef.current?.disconnect();
    voiceStreamRef.current?.getTracks().forEach(track => track.stop());
    voiceStreamRef.current = null;
    voiceProcessorRef.current = null;
    voiceSourceRef.current = null;
    voiceSilentGainRef.current = null;
    const context = voiceContextRef.current;
    const sourceRate = context?.sampleRate ?? 0;
    voiceContextRef.current = null;
    if (context && context.state !== 'closed') {
      try { await context.close(); } catch { /* already closed */ }
    }
    const chunks = voiceChunksRef.current;
    voiceChunksRef.current = [];
    setVoiceRecording(false);
    setVoiceStarting(false);
    if (!chunks.length || !sourceRate) {
      setVoiceStatus('No voice samples were captured.');
      return;
    }
    const totalSamples = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const samples = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }
    try {
      const packet = encodeAcousticVoiceMessage(samples, sourceRate);
      setEncoded(packet);
      setEncodeError('');
      setVoiceStatus(
        `Voice packet ready. ${packet.audioDurationSeconds.toFixed(2)} seconds of audio becomes a ${packet.durationSeconds.toFixed(1)} second local acoustic transmission.`,
      );
    } catch (error) {
      setEncoded(null);
      setEncodeError(asMessageError(error));
      setVoiceStatus('Voice packet could not be created.');
    }
  };

  const startVoiceRecording = async () => {
    setEncoded(null);
    setEncodeError('');
    setPlaybackStatus('');
    setVoiceStatus('Waiting for microphone permission…');
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') {
      setVoiceStatus('Microphone capture is unavailable in this browser. Use a recent browser over HTTPS.');
      return;
    }
    const request = ++voiceRequestRef.current;
    voiceCaptureActiveRef.current = true;
    setVoiceStarting(true);
    voiceChunksRef.current = [];
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      if (request !== voiceRequestRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      context = new AudioContext();
      await context.resume();
      if (request !== voiceRequestRef.current) {
        stream.getTracks().forEach(track => track.stop());
        await context.close();
        return;
      }
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(2_048, source.channelCount || 1, 1);
      const silentGain = context.createGain();
      silentGain.gain.value = 0;
      processor.onaudioprocess = event => {
        if (!voiceCaptureActiveRef.current) return;
        const input = event.inputBuffer;
        const mono = new Float32Array(input.length);
        for (let channel = 0; channel < input.numberOfChannels; channel += 1) {
          const channelData = input.getChannelData(channel);
          for (let index = 0; index < input.length; index += 1) {
            mono[index] += channelData[index] / input.numberOfChannels;
          }
        }
        voiceChunksRef.current.push(mono);
      };
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(context.destination);
      voiceStreamRef.current = stream;
      voiceContextRef.current = context;
      voiceProcessorRef.current = processor;
      voiceSourceRef.current = source;
      voiceSilentGainRef.current = silentGain;
      setVoiceStarting(false);
      setVoiceRecording(true);
      setVoiceStatus(`Recording locally. Stop sooner or it ends after ${ACOUSTIC_VOICE_PROTOCOL.maxRecordingSeconds} seconds.`);
      voiceCaptureTimeoutRef.current = window.setTimeout(
        () => void stopVoiceRecording(),
        ACOUSTIC_VOICE_PROTOCOL.maxRecordingSeconds * 1_000,
      );
    } catch (error) {
      if (request !== voiceRequestRef.current) return;
      voiceCaptureActiveRef.current = false;
      stream?.getTracks().forEach(track => track.stop());
      voiceStreamRef.current = null;
      if (context && context.state !== 'closed') {
        try { await context.close(); } catch { /* already closed */ }
      }
      voiceContextRef.current = null;
      setVoiceRecording(false);
      setVoiceStarting(false);
      setVoiceStatus(error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow access in browser settings, then try again.'
        : error instanceof DOMException && error.name === 'NotFoundError'
          ? 'No microphone was found. Connect or enable an input device and retry.'
          : asMessageError(error));
    }
  };

  const startSpeechToText = () => {
    setSpeechStatus('');
    setEncodeError('');
    if (!speechConsent) {
      setSpeechStatus('Review and accept the speech-processing notice before starting.');
      return;
    }
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setSpeechStatus('Speech recognition is unavailable in this browser. You can type the message or record a voice packet instead.');
      return;
    }
    try {
      const recognition = new Recognition();
      recognition.lang = navigator.language || 'en-GB';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.onresult = event => {
        const finalParts: string[] = [];
        let interim = '';
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = result?.[0]?.transcript?.trim();
          if (!transcript) continue;
          if (result.isFinal) finalParts.push(transcript);
          else interim = transcript;
        }
        if (finalParts.length) {
          const finalText = finalParts.join(' ');
          setText(current => `${current}${current.trim() ? ' ' : ''}${finalText}`);
          setEncoded(null);
        }
        if (interim) setSpeechStatus(`Listening: “${interim}”`);
      };
      recognition.onerror = event => {
        setSpeechStatus(event.error === 'not-allowed'
          ? 'Speech recognition permission was denied. You can type the message instead.'
          : `Speech recognition stopped (${event.error || 'browser error'}).`);
        setSpeechListening(false);
        speechRecognitionRef.current = null;
      };
      recognition.onend = () => {
        setSpeechListening(false);
        speechRecognitionRef.current = null;
        setSpeechStatus(current => current.startsWith('Listening:')
          ? 'Speech capture ended. Review and edit the transcript before encoding.'
          : current || 'Speech capture ended. Review and edit the transcript before encoding.');
      };
      speechRecognitionRef.current = recognition;
      recognition.start();
      setSpeechListening(true);
      setSpeechStatus('Listening. Review the editable transcript before encoding.');
    } catch (error) {
      speechRecognitionRef.current = null;
      setSpeechListening(false);
      setSpeechStatus(asMessageError(error));
    }
  };

  const stopSpeechToText = () => {
    speechRecognitionRef.current?.stop();
    setSpeechListening(false);
  };

  const stopMicrophone = async (shouldDecode: boolean) => {
    micRequestRef.current += 1;
    if (captureTimeoutRef.current !== null) {
      window.clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }
    processorRef.current?.disconnect();
    micSourceRef.current?.disconnect();
    silentGainRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    processorRef.current = null;
    micSourceRef.current = null;
    silentGainRef.current = null;
    const context = micContextRef.current;
    micContextRef.current = null;
    if (context && context.state !== 'closed') {
      try { await context.close(); } catch { /* already closed */ }
    }
    const chunks = messageBytes.current;
    messageBytes.current = [];
    setRecording(false);
    setStartingMic(false);
    if (shouldDecode) {
      const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const samples = new Float32Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        samples.set(chunk, offset);
        offset += chunk.length;
      }
      if (samples.length === 0) {
        setDecodeError('No microphone samples were collected. Check the selected input and try again.');
        setMicStatus('No audio captured.');
        setReceiveStage('miss');
        return;
      }
      const sampleRate = context?.sampleRate ?? ACOUSTIC_MESSAGE_PROTOCOL.sampleRateHz;
      setReceiveStage('checking');
      try {
        const result = decodeAcousticSamples(samples, sampleRate);
        setDecodedPacket(result);
        setDecodeError('');
        setMicStatus('Packet recovered. CRC verified; sender and delivery are not verified.');
      } catch (error) {
        setDecoded(null);
        setDecodeError(asMessageError(error));
        const failureStage = receiveFailureStage(error);
        setReceiveStage(failureStage);
        setMicStatus(failureStage === 'candidate'
          ? 'A candidate frame was detected, but validation failed. No message was recovered.'
          : 'No supported packet preamble was detected.');
      }
    } else {
      setMicStatus('Microphone stopped. No audio was saved.');
      setReceiveStage('idle');
    }
  };

  const startMicrophone = async () => {
    setDecoded(null);
    setDuplicatePacket(false);
    setDecodeError('');
    setReceiveStage('listening');
    setMicStatus('Waiting for microphone permission…');
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') {
      setDecodeError('Microphone capture is unavailable in this browser. Use a recent browser over HTTPS or select an audio file.');
      setMicStatus('Microphone unavailable.');
      return;
    }
    const request = ++micRequestRef.current;
    setStartingMic(true);
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      if (request !== micRequestRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      context = new AudioContext();
      await context.resume();
      micContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, source.channelCount || 1, 1);
      const silentGain = context.createGain();
      silentGain.gain.value = 0;
      messageBytes.current = [];
      processor.onaudioprocess = event => {
        const input = event.inputBuffer;
        const mono = new Float32Array(input.length);
        for (let channel = 0; channel < input.numberOfChannels; channel += 1) {
          const channelData = input.getChannelData(channel);
          for (let index = 0; index < input.length; index += 1) mono[index] += channelData[index] / input.numberOfChannels;
        }
        messageBytes.current.push(mono);
      };
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(context.destination);
      micSourceRef.current = source;
      processorRef.current = processor;
      silentGainRef.current = silentGain;
      setStartingMic(false);
      setRecording(true);
      setMicStatus(`Listening locally. Press Stop to finish; capture ends after ${MAX_RECEIVE_DURATION_SECONDS} seconds.`);
      captureTimeoutRef.current = window.setTimeout(() => {
        setMicStatus('Maximum receive window reached. Checking captured audio.');
        void stopMicrophone(true);
      }, MAX_RECEIVE_DURATION_SECONDS * 1_000);
    } catch (error) {
      if (request !== micRequestRef.current) return;
      stream?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if (context && context.state !== 'closed') {
        try { await context.close(); } catch { /* already closed */ }
      }
      micContextRef.current = null;
      setStartingMic(false);
      setMicStatus('Microphone capture did not start.');
      setReceiveStage('miss');
      const name = error instanceof DOMException ? error.name : '';
      setDecodeError(name === 'NotAllowedError' || name === 'PermissionDeniedError'
        ? 'Microphone permission was denied. Allow access in browser settings, then try again.'
        : name === 'NotFoundError'
          ? 'No microphone was found. Connect or enable an input device and retry.'
          : asMessageError(error));
    }
  };

  const receiveFile = async () => {
    if (!selectedFile) return;
    setProcessingFile(true);
    setDecodeError('');
    setDecoded(null);
    setDuplicatePacket(false);
    setReceiveStage('checking');
    setMicStatus('Decoding selected audio locally…');
    let context: AudioContext | null = null;
    try {
      if (selectedFile.size === 0) throw new Error('The selected audio file is empty.');
      if (selectedFile.size > MAX_RECEIVE_FILE_BYTES) {
        throw new Error('Choose an audio file smaller than 12 MB.');
      }
      const duration = await inspectAudioDuration(selectedFile);
      if (duration > MAX_RECEIVE_DURATION_SECONDS) {
        throw new Error(`Choose a recording no longer than ${MAX_RECEIVE_DURATION_SECONDS} seconds.`);
      }
      if (typeof AudioContext === 'undefined') throw new Error('Audio decoding is not supported in this browser.');
      const data = await selectedFile.arrayBuffer();
      context = new AudioContext();
      const buffer = await context.decodeAudioData(data.slice(0));
      const mono = downmixAudio(buffer);
      const result = decodeAcousticSamples(mono, buffer.sampleRate);
      setDecodedPacket(result);
      setMicStatus('Packet recovered from file. CRC verified; sender and delivery are not verified.');
    } catch (error) {
      setDecoded(null);
      setDecodeError(asMessageError(error));
      const failureStage = receiveFailureStage(error);
      setReceiveStage(failureStage);
      setMicStatus(failureStage === 'candidate'
        ? 'A candidate frame was detected, but validation failed. No message was recovered.'
        : 'No supported packet preamble was detected.');
    } finally {
      if (context && context.state !== 'closed') {
        try { await context.close(); } catch { /* already closed */ }
      }
      setProcessingFile(false);
    }
  };

  const encode = () => {
    setEncodeError('');
    setPlaybackStatus('');
    stopPlayback();
    try {
      setEncoded(encodeAcousticMessage(text, payloadType));
    } catch (error) {
      setEncoded(null);
      setEncodeError(asMessageError(error));
    }
  };

  const downloadWav = () => {
    if (!encoded) return;
    if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
    const url = URL.createObjectURL(new Blob([encoded.wav], { type: 'audio/wav' }));
    playbackUrlRef.current = url;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `zioncore-${encoded.payloadType}-${encoded.messageId.slice(0, 8)}.wav`;
    anchor.click();
  };

  const playMessage = async () => {
    if (!encoded || typeof AudioContext === 'undefined') {
      setPlaybackStatus('Audio playback is unavailable in this browser.');
      return;
    }
    await playbackControllerRef.current?.play(
      encoded.samples,
      encoded.sampleRateHz,
      0.55,
      'Emitting acoustic audio locally at capped output gain.',
      'Playback complete. No reception or delivery confirmation is implied.',
    );
  };

  const playDecodedVoice = async () => {
    if (decoded?.payloadType !== 'voice' || typeof AudioContext === 'undefined') {
      setPlaybackStatus('Recovered voice playback is unavailable in this browser.');
      return;
    }
    await playbackControllerRef.current?.play(
      decoded.audioSamples,
      decoded.audioSampleRateHz,
      0.65,
      'Playing recovered voice at capped output gain.',
      'Recovered voice playback complete.',
    );
  };

  useEffect(() => () => {
    micRequestRef.current += 1;
    voiceRequestRef.current += 1;
    voiceCaptureActiveRef.current = false;
    if (captureTimeoutRef.current !== null) window.clearTimeout(captureTimeoutRef.current);
    if (voiceCaptureTimeoutRef.current !== null) window.clearTimeout(voiceCaptureTimeoutRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    voiceStreamRef.current?.getTracks().forEach(track => track.stop());
    processorRef.current?.disconnect();
    voiceProcessorRef.current?.disconnect();
    micSourceRef.current?.disconnect();
    voiceSourceRef.current?.disconnect();
    silentGainRef.current?.disconnect();
    voiceSilentGainRef.current?.disconnect();
    speechRecognitionRef.current?.abort();
    if (micContextRef.current && micContextRef.current.state !== 'closed') void micContextRef.current.close();
    if (voiceContextRef.current && voiceContextRef.current.state !== 'closed') void voiceContextRef.current.close();
    playbackControllerRef.current?.dispose();
    if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
  }, []);

  return <main className="page-wrap">
    <div className="eyebrow">Acoustic communications / 02</div>
    <div className="zc-message-hero">
      <div>
        <h1 className="page-title">Encode a message.<br />Recover it nearby.</h1>
        <p className="lead">Type a message, speak to create an editable transcript, or record a short voice packet. ZionCore encodes and recovers supported acoustic packets locally in this browser.</p>
      </div>
      <aside className="zc-message-protocol" aria-label="Protocol summary">
        <strong>Text v{ACOUSTIC_MESSAGE_PROTOCOL.version} BFSK · Voice v{ACOUSTIC_VOICE_PROTOCOL.version} 8-FSK</strong>
        <span>48 kHz WAV output<br />Text: 512 UTF-8 bytes<br />Voice: up to {ACOUSTIC_VOICE_PROTOCOL.maxRecordingSeconds}s</span>
      </aside>
    </div>

    <div className="zc-message-grid">
      <section className="panel zc-message-editor" aria-labelledby="encode-heading">
        <div className="panel-head"><span className="panel-title" id="encode-heading">01 / Compose packet</span><AudioLines size={17} color="#758681" /></div>
        <div className="zc-message-body">
          <div className="zc-message-type" role="group" aria-label="Message composition mode">
            <button type="button" aria-pressed={composerMode === 'text'} disabled={voiceRecording || voiceStarting || speechListening} onClick={() => { setComposerMode('text'); setEncoded(null); setEncodeError(''); stopPlayback(); }} data-testid="button-compose-text">Type</button>
            <button type="button" aria-pressed={composerMode === 'speech'} disabled={voiceRecording || voiceStarting || speechListening} onClick={() => { setComposerMode('speech'); setEncoded(null); setEncodeError(''); stopPlayback(); }} data-testid="button-compose-speech">Speak to text</button>
            <button type="button" aria-pressed={composerMode === 'voice'} disabled={voiceRecording || voiceStarting || speechListening} onClick={() => { setComposerMode('voice'); setEncoded(null); setEncodeError(''); stopPlayback(); }} data-testid="button-compose-voice">Voice packet</button>
          </div>
          {composerMode === 'voice' ? <>
            <div className="zc-message-live" role={voiceRecording ? 'status' : 'note'}>
              <span>{voiceStatus || `Record up to ${ACOUSTIC_VOICE_PROTOCOL.maxRecordingSeconds} seconds. The recording stays in browser memory.`}</span>
              {voiceRecording || voiceStarting
                ? <button type="button" className="btn btn-stop" onClick={() => void stopVoiceRecording()} data-testid="button-stop-voice-recording"><Square size={13} fill="currentColor" />Stop & encode</button>
                : <button type="button" className="btn btn-primary" onClick={() => void startVoiceRecording()} data-testid="button-start-voice-recording"><Mic size={14} />Record voice</button>}
            </div>
            <p className="permission-note">Voice is locally downsampled to 8 kHz speech-band audio, compressed with IMA ADPCM, and sent as an 8-FSK packet. A 2-second clip takes about a minute to transmit at the current robust profile; compatible receiving equipment is required.</p>
          </> : <>
            {composerMode === 'speech' && <div className="zc-speech-compose">
              <label className="zc-speech-consent">
                <input type="checkbox" checked={speechConsent} onChange={event => { setSpeechConsent(event.target.checked); setSpeechStatus(''); if (!event.target.checked && speechRecognitionRef.current) stopSpeechToText(); }} data-testid="checkbox-speech-consent" />
                <span>I understand the browser’s speech-recognition provider may process speech outside ZionCore. I will review the provider’s privacy terms before starting.</span>
              </label>
              <div className="zc-message-live" role={speechListening ? 'status' : 'note'}>
                <span>{speechStatus || 'Speech becomes editable text; it is never encoded until you review and choose Encode.'}</span>
                {speechListening
                  ? <button type="button" className="btn btn-stop" onClick={stopSpeechToText} data-testid="button-stop-speech"><Square size={13} fill="currentColor" />Stop</button>
                  : <button type="button" className="btn btn-primary" disabled={!speechConsent} onClick={startSpeechToText} data-testid="button-start-speech"><Mic size={14} />Start speech input</button>}
              </div>
            </div>}
            <div className="zc-message-type" role="group" aria-label="Text payload label">
              <button type="button" aria-pressed={payloadType === 'text'} onClick={() => { setPayloadType('text'); setEncoded(null); stopPlayback(); }} data-testid="button-payload-text">Text message</button>
              <button type="button" aria-pressed={payloadType === 'prayer'} onClick={() => { setPayloadType('prayer'); setEncoded(null); stopPlayback(); }} data-testid="button-payload-prayer">Prayer</button>
            </div>
            <label className="label-row" htmlFor="message-text"><span>{composerMode === 'speech' ? 'Editable speech transcript' : 'Message content'}</span><span className="small-note">{composerMode === 'speech' ? 'browser speech service' : 'processed in this tab'}</span></label>
            <textarea id="message-text" className="text-control zc-message-textarea" value={text} maxLength={2048} onChange={event => { setText(event.target.value); setEncoded(null); setEncodeError(''); stopPlayback(); }} placeholder={payloadType === 'prayer' ? 'Write a short prayer…' : 'Write a short message…'} data-testid="input-message-text" />
            <div className="zc-message-count"><span className={sampleCount > ACOUSTIC_MESSAGE_PROTOCOL.maxPayloadBytes ? 'over' : ''} data-testid="text-message-byte-count">{sampleCount} / {ACOUSTIC_MESSAGE_PROTOCOL.maxPayloadBytes} UTF-8 bytes</span><span>Payload label: {payloadType === 'prayer' ? 'Prayer' : 'Text'}</span></div>
            <p className="zc-message-limit">A message may use fewer than 512 visible characters when it contains multi-byte characters.</p>
            <div className="zc-message-actions">
              <button type="button" className="btn btn-primary" disabled={!text.trim() || sampleCount > ACOUSTIC_MESSAGE_PROTOCOL.maxPayloadBytes} onClick={encode} data-testid="button-encode-message"><AudioLines size={15} />Encode acoustic packet</button>
              {encoded && <button type="button" className="btn btn-subtle" onClick={downloadWav} data-testid="button-download-wav"><Download size={14} />Download WAV</button>}
            </div>
          </>}
          {encoded && composerMode === 'voice' && <div className="zc-message-actions">
            <button type="button" className="btn btn-subtle" onClick={downloadWav} data-testid="button-download-wav"><Download size={14} />Download WAV</button>
          </div>}
          {encodeError && <div className="zc-message-error" role="alert" data-testid="status-encode-error">{encodeError}</div>}
          {encoded && <div className="zc-message-status">
            <div className="status-box" role="status" data-testid="status-encoded">{encoded.payloadType === 'voice' ? 'Voice packet ready. It was encoded locally; nothing was sent.' : 'Packet ready. The message has been encoded locally; nothing was sent.'}</div>
            <div className="zc-message-signal" aria-label="Encoded packet details">
              <div><span>Duration</span><strong>{encoded.durationSeconds.toFixed(2)} s</strong></div>
              <div><span>Symbols</span><strong>{encoded.symbolCount.toLocaleString()}</strong></div>
              <div><span>{encoded.payloadType === 'voice' ? 'Voice' : 'Packet ID'}</span><strong>{encoded.payloadType === 'voice' ? `${encoded.audioDurationSeconds.toFixed(2)} s source` : `${encoded.messageId.slice(0, 8)}…`}</strong></div>
            </div>
            <div className="zc-message-actions">
              {!playing ? <button type="button" className="btn btn-primary" onClick={() => void playMessage()} data-testid="button-play-message"><Volume2 size={15} />Play packet</button> : <button type="button" className="btn btn-stop" onClick={() => void stopPlayback()} data-testid="button-stop-playback"><Square size={14} fill="currentColor" />Stop playback</button>}
              {playing && <span className="live-badge" role="status" data-testid="status-emitting"><i className="live-dot on" />Emitting · local only</span>}
            </div>
            {playbackStatus && <p className="permission-note" role="status" data-testid="status-playback">{playbackStatus}</p>}
            <p className="permission-note">Output gain is capped and faded at both ends. Your device volume remains under your control. Keep the other device nearby and play at a comfortable level.</p>
          </div>}
        </div>
      </section>

      <section className="panel" aria-labelledby="receive-heading">
        <div className="panel-head"><span className="panel-title" id="receive-heading">02 / Receive packet</span><Radio size={17} color="#758681" /></div>
        <div className="zc-message-body">
          <div className="zc-receive-tabs" role="group" aria-label="Receive source">
            <button type="button" className="zc-receive-choice" aria-pressed={receivingMode === 'file'} disabled={recording || startingMic} onClick={() => { setReceivingMode('file'); setDecodeError(''); setMicStatus(''); setReceiveStage('idle'); }} data-testid="button-receive-file"><Upload size={13} />Audio file</button>
            <button type="button" className="zc-receive-choice" aria-pressed={receivingMode === 'microphone'} disabled={recording || startingMic} onClick={() => { setReceivingMode('microphone'); setDecodeError(''); setMicStatus(''); setReceiveStage('idle'); }} data-testid="button-receive-microphone"><Mic size={13} />Microphone</button>
          </div>
          {receivingMode === 'file' ? <div className="zc-message-receive-actions">
            <input className="zc-file-input" id="audio-file" type="file" accept="audio/*,.wav" onChange={event => { setSelectedFile(event.target.files?.[0] ?? null); setDecoded(null); setDuplicatePacket(false); setDecodeError(''); setMicStatus(''); setReceiveStage('idle'); }} data-testid="input-audio-file" />
            <label htmlFor="audio-file" className="zc-file-label"><FileAudio size={16} />{selectedFile ? selectedFile.name : 'Choose an audio recording'}</label>
            <button type="button" className="btn btn-primary" disabled={!selectedFile || processingFile} onClick={() => void receiveFile()} data-testid="button-decode-file">{processingFile ? 'Analyzing audio locally…' : 'Decode selected audio'}</button>
            <p className="permission-note">Audio is decoded in memory, converted to mono, and not uploaded or saved by ZionCore.</p>
          </div> : <div className="zc-message-receive-actions">
            <div className="zc-message-live" role={recording || startingMic ? 'status' : 'note'}>
              <span>{micStatus || 'Microphone is idle. Capture begins only after you press Start.'}</span>
              {recording || startingMic
                ? <button type="button" className="btn btn-stop" onClick={() => void stopMicrophone(recording)} data-testid="button-stop-microphone"><Square size={13} fill="currentColor" />Stop</button>
                : <button type="button" className="btn btn-primary" onClick={() => void startMicrophone()} data-testid="button-start-microphone"><Mic size={14} />Start listening</button>}
            </div>
            <p className="permission-note">Microphone access is requested only after Start. Stop releases the input tracks and checks captured samples; leaving this page also releases them.</p>
          </div>}
          <p className="permission-note" role="status" aria-live="polite" data-testid="status-receive-stage">
            Receive state: {receiveStageLabel(receiveStage)}.
          </p>
          {micStatus && receivingMode === 'file' && <p className="permission-note" role="status" data-testid="status-receive">{micStatus}</p>}
          {decodeError && <div className="zc-message-error" role="alert" data-testid="status-decode-error">{decodeError}</div>}
          {decoded && decoded.integrity === 'verified' && <div className="zc-message-result" role="status" aria-live="polite" data-testid="panel-decoded-message">
            <div className="zc-message-result-head"><span className="zc-verified"><Check size={14} />CRC verified</span><span>{decoded.payloadType === 'voice' ? 'Voice audio' : decoded.payloadType === 'prayer' ? 'Prayer' : 'Text'}</span></div>
            {decoded.payloadType === 'voice'
              ? <div className="zc-message-actions">
                <span className="permission-note">Recovered {decoded.audioDurationSeconds.toFixed(2)} seconds of voice at {decoded.audioSampleRateHz.toLocaleString()} Hz.</span>
                {!playing
                  ? <button type="button" className="btn btn-primary" onClick={() => void playDecodedVoice()} data-testid="button-play-recovered-voice"><Volume2 size={15} />Play recovered voice</button>
                  : <button type="button" className="btn btn-stop" onClick={() => void stopPlayback()} data-testid="button-stop-recovered-voice"><Square size={14} fill="currentColor" />Stop playback</button>}
              </div>
              : <blockquote>{decoded.text}</blockquote>}
            <div className="zc-message-result-meta"><span>{decoded.payloadBytes} bytes</span><span>Protocol v{decoded.protocolVersion}</span><span>ID {decoded.messageId.slice(0, 8)}…</span></div>
            <p className="permission-note">Integrity verified. Sender is not authenticated.</p>
            {duplicatePacket && <div className="zc-message-error" role="alert" data-testid="warning-duplicate-packet">This packet ID appeared among the most recent {PACKET_REPLAY_WINDOW_SIZE} verified packets in this page session. It may be a repeated transmission or replay; the sender is not authenticated.</div>}
          </div>}
        </div>
      </section>
    </div>

    <div className="zc-message-procedure" aria-label="Message workflow">
      <div className="zc-message-step"><b>01</b><strong>Encode</strong><p>Text uses the compatible BFSK frame; voice uses a bounded ADPCM payload and versioned 8-FSK tones.</p></div>
      <div className="zc-message-step"><b>02</b><strong>Transfer nearby</strong><p>Play the signal or move the WAV. Compatible speaker and microphone hardware are required.</p></div>
      <div className="zc-message-step"><b>03</b><strong>Verify and recover</strong><p>The receiver reports a message only after the packet checksum passes.</p></div>
    </div>
    <div className="zc-integrity-note" role="note">
      <ShieldCheck size={16} />
      <span><strong>Integrity is not identity.</strong> CRC detects accidental corruption; it does not authenticate who sent a packet. Encryption is not implemented. These acoustic signals are intended for a nearby compatible device, not distance transmission. Voice packet recording, encoding and decoding remain local to this browser.</span>
    </div>
    <p className="footnote" role="note" data-testid="note-acoustic-boundaries">
      This instrument emits audible acoustic packets only. Playback starts only after your action and ends when the clip finishes or you press Stop; it does not transmit RF or run covert or continuous capture. A verified checksum confirms packet integrity only—not biological, environmental, spiritual, or supernatural delivery.
    </p>
    <p className="footnote"><Info size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />Speech-to-text is a separate browser feature that may send speech to the browser’s provider after explicit consent. Voice-packet audio is processed in this tab and is not persisted by ZionCore. This page does not request cloud history or payment service.</p>
  </main>;
}
