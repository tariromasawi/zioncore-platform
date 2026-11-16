import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'wouter';
import { z } from 'zod';
import ExperimentDesignPanel from '@/components/experiment-design-panel';
import DtmfAudioReceiver from '@/components/dtmf-audio-receiver';
import {
  Activity, AlertTriangle, AudioLines, Check, Download, History,
  Info, Mic, Play, Radio, Save, ShieldCheck, Square, Trash2, Waves,
} from 'lucide-react';
import {
  CELESTIAL_MAX_MESSAGE_BYTES, CELESTIAL_MAX_SYMBOLS, CELESTIAL_OUTPUT_LEVEL_OPTIONS, CELESTIAL_PROTOCOL_ID,
  CELESTIAL_SYMBOL_DURATION_OPTIONS, createCelestialWaveform, createResearchSession,
  createUniversalExperiment,
  decodeCelestialSymbolText, decodeCelestialSymbols, encodeCelestialMessage, readResearchSessions,
  reviseResearchHypothesis,
  summarizeResearchPatterns, validateResearchSession, writeResearchSessions,
  USER_AUTHORED_INTERPRETATION_METHOD_ID, USER_AUTHORED_INTERPRETATION_METHOD_VERSION,
  type HypothesisStatus, type ResearchIdentityType, type ResearchInterpretation, type ResearchObservation, type ResearchSession,
} from '@/lib/celestial-experiment';
import { decodeCelestialAudio, type CelestialAudioDecodeResult } from '@/lib/celestial-audio';
import { decodeWavMonoSamples } from '@/lib/audio-file-analysis';
import { encodeWav } from '@/lib/acoustic-message';
import { recordDiscoveryMemoryVersions } from '@/lib/discovery-memory';
import {
  createExperimentDesign,
  EXPERIMENT_DESIGN_MAX_OBSERVATIONS,
  type ExperimentDesignRecord,
} from '@/lib/ai-experiment-design';
import { analysisMeasurementSchema } from '@/lib/ai-analysis';
import { firebaseAiReady, getFirebaseAiSetupMessage } from '@/lib/firebase';
import { downloadFile } from '@/lib/observations';
import { createInstrumentProvenance } from '@/lib/instrument-provenance';
import {
  compareRepeatedObservations,
  DEFAULT_OBSERVATION_ALIGNMENT_TOLERANCE_SECONDS,
  MAX_RESEARCH_COMPARISON_SESSIONS,
} from '@/lib/research-comparison';
import { researchAgentRouter, researchGridRegistry } from '@/lib/research-grid';
import { instrumentRegistry } from '@/lib/hardware-instruments';
import useLabEngine from '@/hooks/use-lab-engine';
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import './celestial-exploration.css';

const composeSchema = z.object({
  text: z.string().max(CELESTIAL_MAX_MESSAGE_BYTES, `Maximum ${CELESTIAL_MAX_MESSAGE_BYTES} UTF-8 bytes.`),
  domain: z.string().refine(value => Boolean(researchGridRegistry.getDomain(value)), 'Choose a registered research domain.'),
  intent: z.enum(['research-message', 'prayer']),
  symbolDurationMs: z.enum(['50', '75', '100']),
  outputLevel: z.enum(['0.04', '0.08']),
});
type ComposeValues = z.infer<typeof composeSchema>;

function byteCount(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function downloadJson(name: string, value: unknown) {
  downloadFile(name, JSON.stringify(value, null, 2), 'application/json');
}

export default function CelestialExplorationPage({
  archiveScope,
  identityType,
  ownerEmail,
}: {
  archiveScope: string;
  identityType: ResearchIdentityType;
  ownerEmail: string | null;
}) {
  const form = useForm<ComposeValues>({
    resolver: zodResolver(composeSchema),
    defaultValues: { text: '', domain: 'celestial-exploration', intent: 'research-message', symbolDurationMs: '75', outputLevel: '0.04' },
    mode: 'onChange',
  });
  useSyncExternalStore(researchGridRegistry.subscribe, researchGridRegistry.getRevision, researchGridRegistry.getRevision);
  const values = form.watch();
  const text = values.text;
  const domains = researchGridRegistry.listDomains();
  const selectedDomain = researchGridRegistry.getDomain(values.domain);
  const [draft, setDraft] = useState<ResearchSession>(() => createResearchSession());
  const formSignature = JSON.stringify([
    values.text,
    values.domain,
    values.intent,
    values.symbolDurationMs,
    values.outputLevel,
  ]);
  const previewIsCurrent = Boolean(
    draft.signal
      && draft.message.text === values.text
      && draft.message.intent === values.intent
      && draft.encoding.symbolDurationMs === Number(values.symbolDurationMs)
      && draft.encoding.outputLevel === Number(values.outputLevel),
  );
  const [signalError, setSignalError] = useState('');
  const [decoderSymbols, setDecoderSymbols] = useState('');
  const [decodedMessage, setDecodedMessage] = useState('');
  const [decoderError, setDecoderError] = useState('');
  const [dtmfAudioFileName, setDtmfAudioFileName] = useState('');
  const [dtmfAudioResult, setDtmfAudioResult] = useState<CelestialAudioDecodeResult | null>(null);
  const [dtmfAudioError, setDtmfAudioError] = useState('');
  const [dtmfAudioLoading, setDtmfAudioLoading] = useState(false);
  const dtmfAudioRequestId = useRef(0);
  const [playbackError, setPlaybackError] = useState('');
  const [playbackStatus, setPlaybackStatus] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [experimentDesign, setExperimentDesign] = useState<ExperimentDesignRecord | null>(null);
  const [experimentDesignLoading, setExperimentDesignLoading] = useState(false);
  const [experimentDesignError, setExperimentDesignError] = useState('');
  const [interpretationObservationId, setInterpretationObservationId] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [alignmentToleranceSeconds, setAlignmentToleranceSeconds] = useState(
    DEFAULT_OBSERVATION_ALIGNMENT_TOLERANCE_SECONDS,
  );
  const [storageError, setStorageError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [revisingSessionId, setRevisingSessionId] = useState<string | null>(null);
  const [editingHypothesisId, setEditingHypothesisId] = useState<string | null>(null);
  const [hypothesisEditText, setHypothesisEditText] = useState('');
  const [hypothesisEditStatus, setHypothesisEditStatus] = useState<HypothesisStatus>('open');
  const [hypothesisEditError, setHypothesisEditError] = useState('');
  const [hypothesisEditNotice, setHypothesisEditNotice] = useState<{ id: string; text: string } | null>(null);
  const [editingInterpretationId, setEditingInterpretationId] = useState<string | null>(null);
  const [interpretationEdit, setInterpretationEdit] = useState<Pick<ResearchInterpretation, 'measuredPattern' | 'uncertainty' | 'personalReflection'>>({
    measuredPattern: '',
    uncertainty: '',
    personalReflection: '',
  });
  const [interpretationEditError, setInterpretationEditError] = useState('');
  const [interpretationEditNotice, setInterpretationEditNotice] = useState<{ id: string; text: string } | null>(null);
  const [observationNote, setObservationNote] = useState('');
  const [loaded, setLoaded] = useState(false);
  const engine = useLabEngine(4096);
  const latestReading = useRef(engine.reading);
  latestReading.current = engine.reading;
  const captureStarted = useRef<string | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const audioSource = useRef<AudioBufferSourceNode | null>(null);
  const playbackStoppedEarly = useRef(false);
  const endingPlayback = useRef(false);
  const previousFormSignature = useRef(formSignature);

  const loadHistory = () => {
    try {
      setSessions(readResearchSessions(archiveScope, identityType));
      setStorageError('');
      setLoaded(true);
    } catch (cause) {
      setStorageError(cause instanceof Error ? cause.message : 'Local research history could not be read.');
      setLoaded(false);
    }
  };
  useEffect(() => {
    loadHistory();
    setEditingHypothesisId(null);
    setHypothesisEditText('');
    setHypothesisEditError('');
    setHypothesisEditNotice(null);
    setEditingInterpretationId(null);
    setInterpretationEditError('');
    setInterpretationEditNotice(null);
  }, [archiveScope, identityType]);
  useEffect(() => {
    setExperimentDesign(null);
  }, [sessions]);
  useEffect(() => {
    if (previousFormSignature.current === formSignature) return;
    previousFormSignature.current = formSignature;
    setAuthorized(false);
    setPlaybackError('');
    if (draft.signal) {
      setPlaybackStatus('Research settings changed. Review the current preview and authorize playback again.');
    }
  }, [formSignature, draft.signal]);
  useEffect(() => {
    if (engine.error) captureStarted.current = null;
    else if (engine.running && !captureStarted.current) captureStarted.current = new Date().toISOString();
  }, [engine.error, engine.running]);

  const patchDraft = (update: Partial<ResearchSession>) => {
    setDraft(current => ({ ...current, ...update, updatedAt: new Date().toISOString() }));
  };

  const generateExperimentDesign = async (
    sourceSessionId: string,
    researchQuestion: string,
    consentToSend: boolean,
  ) => {
    const sourceSession = sessions.find(session => session.id === sourceSessionId);
    if (!sourceSession || sourceSession.observations.length === 0) {
      setExperimentDesignError('Choose a saved session with measured observations.');
      return;
    }
    setExperimentDesignError('');
    setExperimentDesignLoading(true);
    try {
      const observations = sourceSession.observations
        .slice(-EXPERIMENT_DESIGN_MAX_OBSERVATIONS)
        .map(item => analysisMeasurementSchema.parse({
          sampleRate: item.sampleRateHz,
          fftSize: item.fftSize,
          frequencyResolutionHz: item.frequencyResolutionHz,
          dominantFrequencyHz: item.dominantFrequencyHz,
          topPeaksHz: item.topPeaksHz,
          rmsLevel: item.rmsLevel,
          durationSeconds: item.window.durationSeconds,
        }));
      const result = await createExperimentDesign({
        researchQuestion,
        domain: sourceSession.domain,
        observations,
      }, {
        consentToSend,
        sourceSessionId: sourceSession.id,
      });
      setExperimentDesign(result);
    } catch (cause) {
      setExperimentDesign(null);
      setExperimentDesignError(cause instanceof Error ? cause.message : 'An experiment proposal could not be created.');
    } finally {
      setExperimentDesignLoading(false);
    }
  };

  const exportExperimentDesign = () => {
    if (!experimentDesign) return;
    downloadJson('zioncore-ai-experiment-proposal.json', experimentDesign);
  };

  useEffect(() => () => {
    dtmfAudioRequestId.current += 1;
  }, []);

  const decodeDtmfAudioFile = async (file: File) => {
    const requestId = ++dtmfAudioRequestId.current;
    setDtmfAudioFileName(file.name);
    setDtmfAudioResult(null);
    setDtmfAudioError('');
    setDtmfAudioLoading(true);
    try {
      const wav = await decodeWavMonoSamples(file, () => requestId === dtmfAudioRequestId.current);
      if (requestId !== dtmfAudioRequestId.current) return;
      const result = decodeCelestialAudio(wav.samples, wav.sampleRateHz);
      setDtmfAudioResult(result);
    } catch (cause) {
      if (requestId === dtmfAudioRequestId.current) {
        setDtmfAudioError(cause instanceof Error ? cause.message : 'The local DTMF audio packet could not be decoded.');
      }
    } finally {
      if (requestId === dtmfAudioRequestId.current) setDtmfAudioLoading(false);
    }
  };

  const downloadSignalWav = () => {
    if (!draft.signal || !previewIsCurrent) return;
    try {
      const waveform = createCelestialWaveform(draft.signal, draft.encoding.outputLevel);
      const wav = encodeWav(waveform, draft.signal.sampleRateHz);
      const objectUrl = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = 'zioncore-zc-exp-dtmf-v1.wav';
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setSignalError('');
    } catch (cause) {
      setSignalError(cause instanceof Error ? cause.message : 'The local WAV export could not be created.');
    }
  };

  const generatePreview = form.handleSubmit(values => {
    setSignalError('');
    try {
      const encoded = encodeCelestialMessage(values.text, Number(values.symbolDurationMs));
      const decoded = decodeCelestialSymbols(encoded.symbols);
      setDecoderSymbols(encoded.symbols.map(symbol => symbol.toString(16).toUpperCase()).join(''));
      setDecodedMessage('');
      setDecoderError('');
      patchDraft({
        domain: values.domain,
        message: {
          text: values.text,
          intent: values.intent,
          source: { type: 'human-authored', label: 'User-composed text', capturedAt: new Date().toISOString() },
        },
        encoding: {
          ...draft.encoding,
          protocolId: CELESTIAL_PROTOCOL_ID,
          symbolDurationMs: Number(values.symbolDurationMs) as 50 | 75 | 100,
          outputLevel: Number(values.outputLevel) as 0.04 | 0.08,
        },
        signal: encoded,
        transmission: null,
      });
      setAuthorized(false);
      setPlaybackStatus(decoded === values.text ? 'Preview generated and checksum verified locally.' : 'Preview generated; decoded text differs.');
    } catch (cause) {
      setSignalError(cause instanceof Error ? cause.message : 'Could not encode this message.');
    }
  });
  const decodePacket = () => {
    setDecodedMessage('');
    setDecoderError('');
    try {
      setDecodedMessage(decodeCelestialSymbolText(decoderSymbols));
    } catch (cause) {
      setDecoderError(cause instanceof Error ? cause.message : 'The supported packet could not be decoded.');
    }
  };

  const closePlayback = async () => {
    const source = audioSource.current;
    const context = audioContext.current;
    audioSource.current = null;
    audioContext.current = null;
    if (source) {
      source.onended = null;
      try { source.stop(); } catch { /* source may have ended */ }
      try { source.disconnect(); } catch { /* already disconnected */ }
    }
    if (context && context.state !== 'closed') {
      try { await context.close(); } catch { /* already closed */ }
    }
  };
  const startPlayback = async () => {
    if (!draft.signal || !authorized || playing) return;
    if (!previewIsCurrent) {
      setPlaybackError('The preview does not match the current composition. Generate a fresh preview before playback.');
      return;
    }
    if (engine.running || engine.starting) {
      setPlaybackError('Stop microphone capture before starting speaker playback.');
      return;
    }
    setPlaybackError('');
    if (typeof AudioContext === 'undefined') {
      setPlaybackError('Web Audio is unavailable in this browser. The preview remains inspectable, but playback cannot start.');
      return;
    }
    let context: AudioContext | null = null;
    try {
      // Constructed and resumed only from this explicit button gesture.
      context = new AudioContext();
      audioContext.current = context;
      await context.resume();
      const waveform = createCelestialWaveform(draft.signal, draft.encoding.outputLevel);
      const buffer = context.createBuffer(1, waveform.length, draft.signal.sampleRateHz);
      buffer.getChannelData(0).set(waveform);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      audioSource.current = source;
      endingPlayback.current = false;
      playbackStoppedEarly.current = false;
      const authorizedAt = new Date().toISOString();
      patchDraft({
        transmission: { authorizedAt, completedAt: null, outputChannel: 'local-speaker', stoppedEarly: false },
      });
      setPlaying(true);
      setPlaybackStatus('Playing the encoded packet through this device’s local speaker.');
      source.onended = () => {
        if (endingPlayback.current) return;
        endingPlayback.current = true;
        const completedAt = new Date().toISOString();
        setPlaying(false);
        setPlaybackStatus(playbackStoppedEarly.current ? 'Playback stopped. No external transmission occurred.' : 'Packet playback completed locally.');
        setDraft(current => ({
          ...current,
          updatedAt: completedAt,
          transmission: current.transmission
            ? { ...current.transmission, completedAt, stoppedEarly: playbackStoppedEarly.current }
            : null,
        }));
        void closePlayback();
      };
      source.start();
    } catch (cause) {
      setPlaying(false);
      setPlaybackError(cause instanceof Error ? `Playback could not start: ${cause.message}` : 'Playback could not start. Check your audio output and try again.');
      await closePlayback();
    }
  };
  const stopPlayback = () => {
    if (!audioSource.current || endingPlayback.current) return;
    playbackStoppedEarly.current = true;
    try { audioSource.current.stop(); } catch { /* playback already ended */ }
  };
  useEffect(() => () => {
    endingPlayback.current = true;
    const source = audioSource.current;
    const context = audioContext.current;
    audioSource.current = null;
    audioContext.current = null;
    if (source) {
      source.onended = null;
      try { source.stop(); } catch { /* already ended */ }
      try { source.disconnect(); } catch { /* already disconnected */ }
    }
    if (context && context.state !== 'closed') void context.close();
  }, []);

  const addObservation = async () => {
    const reading = latestReading.current;
    const startedAt = captureStarted.current;
    if (!reading || !startedAt) return;
    const endedAt = new Date().toISOString();
    const durationSeconds = Math.max(0.1, engine.elapsed);
    const observation: ResearchObservation = {
      id: crypto.randomUUID(),
      instrumentId: engine.instrumentDiscovery?.instrument.id ?? 'instrument.browser-microphone-web-audio',
      instrumentProvenance: createInstrumentProvenance(
        'browser-microphone',
        engine.instrumentDiscovery?.instrument,
      ),
      source: {
        type: 'microphone-observation',
        label: 'Local browser microphone',
        capturedAt: endedAt,
      },
      window: { startedAt, endedAt, durationSeconds, source: 'browser-microphone' },
      sampleRateHz: reading.sampleRate,
      fftSize: reading.fftSize,
      frequencyResolutionHz: reading.sampleRate / reading.fftSize,
      dominantFrequencyHz: reading.dominant,
      topPeaksHz: reading.peaks.slice(0, 6),
      rmsLevel: Math.max(0, Math.min(1, reading.rms)),
      notes: observationNote.trim().slice(0, 2000),
    };
    await engine.stop('Capture stopped. A summary was added to this draft; raw audio was not saved.');
    patchDraft({
      observations: [...draft.observations, observation],
      observationWindow: observation.window,
    });
    setInterpretationObservationId(current => draft.interpretation ? current || observation.id : observation.id);
    captureStarted.current = null;
    setObservationNote('');
  };
  const selectInterpretationObservation = (observationId: string) => {
    if (!draft.observations.some(observation => observation.id === observationId)) return;
    setInterpretationObservationId(observationId);
    if (!draft.interpretation) return;
    patchDraft({
      interpretation: {
        ...draft.interpretation,
        provenance: {
          source: 'user-authored',
          observationId,
          methodId: USER_AUTHORED_INTERPRETATION_METHOD_ID,
          methodVersion: USER_AUTHORED_INTERPRETATION_METHOD_VERSION,
        },
      },
    });
  };
  const updateInterpretation = (key: 'measuredPattern' | 'uncertainty' | 'personalReflection', value: string) => {
    const observationId = draft.observations.some(observation => observation.id === interpretationObservationId)
      ? interpretationObservationId
      : draft.observations.at(-1)?.id;
    if (!observationId) return;
    const current = draft.interpretation ?? {
      measuredPattern: '',
      uncertainty: '',
      personalReflection: '',
      createdAt: new Date().toISOString(),
    };
    patchDraft({
      interpretation: {
        ...current,
        [key]: value,
        provenance: {
          source: 'user-authored',
          observationId,
          methodId: USER_AUTHORED_INTERPRETATION_METHOD_ID,
          methodVersion: USER_AUTHORED_INTERPRETATION_METHOD_VERSION,
        },
      },
    });
  };
  const updateHypothesis = (key: 'statement' | 'status', value: string) => {
    const current = draft.hypothesis ?? {
      statement: '',
      status: 'open' as HypothesisStatus,
      updatedAt: new Date().toISOString(),
      source: 'user-authored' as const,
      revisionHistory: [],
    };
    patchDraft({
      hypothesis: {
        ...current,
        [key]: key === 'status' ? value as HypothesisStatus : value,
        updatedAt: new Date().toISOString(),
      },
    });
  };
  const beginHypothesisRevision = (session: ResearchSession) => {
    setEditingHypothesisId(session.id);
    setHypothesisEditText(session.hypothesis?.statement ?? '');
    setHypothesisEditStatus(session.hypothesis?.status ?? 'open');
    setHypothesisEditError('');
    setHypothesisEditNotice(null);
  };
  const cancelHypothesisRevision = () => {
    setEditingHypothesisId(null);
    setHypothesisEditText('');
    setHypothesisEditError('');
  };
  const beginInterpretationRevision = (session: ResearchSession) => {
    const current = session.interpretation;
    setEditingInterpretationId(session.id);
    setInterpretationEdit({
      measuredPattern: current?.measuredPattern ?? '',
      uncertainty: current?.uncertainty ?? '',
      personalReflection: current?.personalReflection ?? '',
    });
    setInterpretationEditError('');
    setInterpretationEditNotice(null);
  };
  const cancelInterpretationRevision = () => {
    setEditingInterpretationId(null);
    setInterpretationEditError('');
  };
  const saveInterpretationRevision = () => {
    if (!editingInterpretationId) return;
    setInterpretationEditError('');
    const current = sessions.find(session => session.id === editingInterpretationId);
    if (!current) {
      setInterpretationEditError('This research record is no longer available in the local archive.');
      return;
    }
    const linkedObservationId = current.interpretation?.provenance?.observationId
      ?? current.observations.at(-1)?.id;
    if (!linkedObservationId) {
      setInterpretationEditError('Capture and save a measured observation before adding an interpretation.');
      return;
    }
    if (current.interpretation
      && current.interpretation.measuredPattern === interpretationEdit.measuredPattern.trim()
      && current.interpretation.uncertainty === interpretationEdit.uncertainty.trim()
      && current.interpretation.personalReflection === interpretationEdit.personalReflection.trim()) {
      setInterpretationEditError('No interpretation changes to save.');
      return;
    }
    const revisedAt = new Date().toISOString();
    try {
      const revised: ResearchSession = {
        ...current,
        updatedAt: revisedAt,
        interpretation: {
          measuredPattern: interpretationEdit.measuredPattern.trim(),
          uncertainty: interpretationEdit.uncertainty.trim(),
          personalReflection: interpretationEdit.personalReflection.trim(),
          createdAt: revisedAt,
          provenance: {
            source: 'user-authored',
            observationId: linkedObservationId,
            methodId: USER_AUTHORED_INTERPRETATION_METHOD_ID,
            methodVersion: USER_AUTHORED_INTERPRETATION_METHOD_VERSION,
          },
        },
      };
      delete revised.universalExperiment;
      const versioned = recordDiscoveryMemoryVersions(revised, current, revisedAt);
      const nextSessions = sessions.map(session => session.id === current.id ? versioned : session);
      writeResearchSessions(archiveScope, nextSessions, identityType);
      setSessions(readResearchSessions(archiveScope, identityType));
      setInterpretationEditNotice({
        id: current.id,
        text: 'Interpretation revision saved. The linked measurement was left unchanged.',
      });
      cancelInterpretationRevision();
    } catch (cause) {
      setInterpretationEditError(cause instanceof Error ? cause.message : 'Could not save this interpretation revision.');
    }
  };
  const loadSessionForRevision = (session: ResearchSession) => {
    const hasUnsavedWork = Boolean(
      draft.message.text.trim()
      || draft.signal
      || draft.observations.length
      || draft.hypothesis?.statement.trim()
      || draft.interpretation?.measuredPattern.trim()
      || draft.interpretation?.uncertainty.trim()
      || draft.interpretation?.personalReflection.trim()
      || draft.findings.length,
    );
    if (hasUnsavedWork && !window.confirm('Replace the current unsaved draft with this saved experiment? Unsaved draft changes will be lost.')) return;
    setDraft(session);
    setRevisingSessionId(session.id);
    setInterpretationObservationId(session.interpretation?.provenance?.observationId ?? session.observations.at(-1)?.id ?? '');
    setSelectedIds([]);
    setEditingHypothesisId(null);
    setEditingInterpretationId(null);
    setAuthorized(false);
    setPlaybackError('');
    setPlaybackStatus('Review the saved experiment, then save changes as new versions. Its measured observations will remain unchanged.');
    form.reset({
      text: session.message.text,
      domain: session.domain,
      intent: session.message.intent,
      symbolDurationMs: String(session.encoding.symbolDurationMs) as ComposeValues['symbolDurationMs'],
      outputLevel: String(session.encoding.outputLevel) as ComposeValues['outputLevel'],
    });
    setSaveStatus('Loaded a saved experiment for revision. No version is written until you save.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const saveHypothesisRevision = () => {
    if (!editingHypothesisId) return;
    setHypothesisEditError('');
    const current = sessions.find(session => session.id === editingHypothesisId);
    if (!current) {
      setHypothesisEditError('This research record is no longer available in the local archive.');
      return;
    }
    try {
      const isRevision = Boolean(current.hypothesis?.statement.trim());
      const revised = reviseResearchHypothesis(
        current,
        hypothesisEditText,
        hypothesisEditStatus,
      );
      if (revised === current) {
        setHypothesisEditError('No hypothesis changes to save.');
        return;
      }
      const versioned = recordDiscoveryMemoryVersions(revised, current, revised.updatedAt);
      const nextSessions = sessions.map(session => session.id === current.id ? versioned : session);
      writeResearchSessions(archiveScope, nextSessions, identityType);
      setSessions(readResearchSessions(archiveScope, identityType));
      setHypothesisEditNotice({
        id: current.id,
        text: isRevision
          ? 'Hypothesis revision saved. Earlier wording is retained; observations and interpretations were not changed.'
          : 'User-authored hypothesis saved separately; observations and interpretations were not changed.',
      });
      cancelHypothesisRevision();
    } catch (cause) {
      setHypothesisEditError(cause instanceof Error ? cause.message : 'Could not save this hypothesis revision.');
    }
  };
  const saveSession = () => {
    if (!loaded) return;
    setSaveStatus('');
    const values = form.getValues();
    if (!values.text.trim()) {
      setSaveStatus('Write a research message or prayer before saving this session.');
      return;
    }
    if (draft.signal && (
      decodeCelestialSymbols(draft.signal.symbols) !== values.text
      || draft.signal.symbolDurationMs !== Number(values.symbolDurationMs)
      || draft.encoding.outputLevel !== Number(values.outputLevel)
    )) {
      setSaveStatus('The message or encoding changed after preview. Generate a fresh preview before saving.');
      return;
    }
    const sessionWithoutExperiment: ResearchSession = {
      ...draft,
      domain: values.domain,
      updatedAt: new Date().toISOString(),
      message: {
        ...draft.message,
        text: values.text,
        intent: values.intent,
        source: { type: 'human-authored', label: 'User-composed text', capturedAt: new Date().toISOString() },
      },
      encoding: {
        ...draft.encoding,
        symbolDurationMs: Number(values.symbolDurationMs) as 50 | 75 | 100,
        outputLevel: Number(values.outputLevel) as 0.04 | 0.08,
      },
    };
    let nextDraft: ResearchSession;
    const priorVersion = sessions.find(item => item.id === sessionWithoutExperiment.id);
    try {
      const versionedSession = recordDiscoveryMemoryVersions(
        sessionWithoutExperiment,
        priorVersion,
        sessionWithoutExperiment.updatedAt,
      );
      if (priorVersion
        && versionedSession.discoveryVersions?.length === (priorVersion.discoveryVersions?.length ?? 0)) {
        setSaveStatus('No new experiment, protocol, hypothesis, or interpretation version was created because nothing changed.');
        return;
      }
      nextDraft = {
        ...versionedSession,
        universalExperiment: createUniversalExperiment(versionedSession, archiveScope, identityType),
      };
    } catch (cause) {
      setSaveStatus(cause instanceof Error ? cause.message : 'Could not prepare the universal experiment record.');
      return;
    }
    const validation = validateResearchSession(nextDraft);
    if (!validation.success) {
      setSaveStatus(validation.error.issues[0]?.message ?? 'This draft is not valid yet.');
      return;
    }
    try {
      const nextSessions = [validation.data, ...sessions.filter(item => item.id !== validation.data.id)];
      writeResearchSessions(archiveScope, nextSessions, identityType);
      setSessions(nextSessions);
      setDraft(createResearchSession());
      setRevisingSessionId(null);
      setInterpretationObservationId('');
      form.reset({ text: '', domain: 'celestial-exploration', intent: 'research-message', symbolDurationMs: '75', outputLevel: '0.04' });
      setAuthorized(false);
      setSaveStatus(priorVersion
        ? 'Experiment revision saved in this browser. Earlier versions and measured observations remain unchanged.'
        : 'Session saved in this browser only.');
    } catch (cause) {
      setSaveStatus(cause instanceof Error ? cause.message : 'Could not save this session. Check browser storage and retry.');
    }
  };
  const addManualNote = () => {
    const note = observationNote.trim();
    if (!note) return;
    patchDraft({
      findings: [...draft.findings, {
        statement: note.slice(0, 1000),
        basis: 'User-authored manual note; not an instrument measurement or inferred response.',
        confidence: 'low',
        createdAt: new Date().toISOString(),
      }],
    });
    setObservationNote('');
  };
  const deleteSession = (id: string) => {
    if (!window.confirm('Delete this local research session? This cannot be undone.')) return;
    try {
      const next = sessions.filter(item => item.id !== id);
      writeResearchSessions(archiveScope, next, identityType);
      setSessions(next);
      setSelectedIds(ids => ids.filter(value => value !== id));
    } catch (cause) {
      setStorageError(cause instanceof Error ? cause.message : 'Could not delete this local session.');
    }
  };
  const comparisonAgent = researchAgentRouter.select({
    task: 'pattern-comparison',
    modalities: ['acoustic'],
    maxCostUsd: 0,
  });
  const sessionAnalysis = summarizeResearchPatterns([draft]);
  const compared = comparisonAgent
    ? summarizeResearchPatterns(sessions.filter(item => selectedIds.includes(item.id)))
    : null;
  const repeatedComparison = compareRepeatedObservations(
    sessions.filter(item => selectedIds.includes(item.id)),
    alignmentToleranceSeconds,
  );
  const comparisonSessionLabel = (id: string) => {
    const session = sessions.find(item => item.id === id);
    if (!session) return `Session ${id.slice(0, 8)}`;
    return session.message.text.trim()
      || new Date(session.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };
  const canGenerate = Boolean(text.trim()) && byteCount(text) <= CELESTIAL_MAX_MESSAGE_BYTES;

  return <div className="lab-shell cex-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="topbar">
      <Link href="/" className="brand-lockup" data-testid="link-exploration-home">
        <span className="brand-mark"><Waves size={19} strokeWidth={1.8} /></span>
        <span><span className="brand-name">ZIONCORE</span><br /><span className="brand-sub">Frequency Lab</span></span>
      </Link>
      <nav className="nav-links" aria-label="Main navigation">
        <Link href="/" className="nav-link" data-testid="link-live-lab">Live lab</Link>
        <Link href="/history" className="nav-link" data-testid="link-history"><History size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />History</Link>
        <span className="nav-link active" aria-current="page">Exploration</span>
        <Link href="/access" className="nav-link" data-testid="link-access">Access</Link>
        {ownerEmail && <span className="nav-account" data-testid="text-exploration-account">{ownerEmail}</span>}
      </nav>
    </header>

    <main id="main-content" className="page-wrap cex-page" tabIndex={-1}>
      <div className="cex-hero">
        <div>
          <div className="eyebrow">Research session / 01</div>
          <h1 className="page-title">{selectedDomain?.label ?? 'Research Exploration'}.</h1>
          <p className="lead">{selectedDomain?.description} Current instruments remain symbolic text, local speaker output, and microphone acoustics; they do not identify a domain source.</p>
        </div>
        <aside className="cex-privacy" data-testid="notice-local-privacy">
          <ShieldCheck size={18} />
          <div><strong>{identityType === 'anonymous-browser' ? 'Free visitor browser archive' : 'Account-scoped browser archive'}</strong><p>Sessions stay in this browser under {identityType === 'anonymous-browser' ? 'this visitor profile' : 'your signed-in account'}. Browser storage is not encrypted and may be visible to other people using this browser profile. Avoid sensitive family details. Raw audio is never saved; no cloud or AI calls are made.</p></div>
        </aside>
      </div>

      {storageError && <div className="cex-alert" role="alert" data-testid="status-storage-error"><AlertTriangle size={17} /><span>{storageError}</span><button className="cex-text-button" onClick={loadHistory} data-testid="button-retry-history">Retry history</button></div>}

      <section className="cex-step">
        <div className="cex-step-index">01</div>
        <div className="cex-step-content">
          <div className="cex-section-heading"><div><div className="eyebrow">Compose & encode</div><h2>Your words, as a test signal.</h2></div><span className="cex-protocol-tag">{CELESTIAL_PROTOCOL_ID}</span></div>
          <div className="panel cex-panel">
            <Form {...form}>
              <form onSubmit={generatePreview}>
                <div className="cex-form-grid">
                  <FormField control={form.control} name="text" render={({ field }) => <FormItem className="cex-message-field">
                    <FormLabel>Research message or prayer</FormLabel>
                    <FormControl><textarea {...field} className="text-control cex-message" maxLength={CELESTIAL_MAX_MESSAGE_BYTES} placeholder="Write a short, human-authored message…" data-testid="input-research-message" /></FormControl>
                    <div className="cex-field-foot"><FormDescription>UTF-8 text encoded locally; no claim of external contact.</FormDescription><span className="mono" data-testid="value-message-bytes">{byteCount(text)} / {CELESTIAL_MAX_MESSAGE_BYTES} bytes</span></div>
                    <FormMessage />
                  </FormItem>} />
                  <div className="cex-controls">
                    <FormField control={form.control} name="domain" render={({ field }) => <FormItem>
                      <FormLabel>Research domain</FormLabel><FormControl><select {...field} className="select-control" data-testid="select-research-domain">{domains.map(domain => <option key={domain.id} value={domain.id}>{domain.label}</option>)}</select></FormControl>
                      <FormDescription>{selectedDomain?.description ?? 'Choose a registered research framing.'}</FormDescription>
                    </FormItem>} />
                    <FormField control={form.control} name="intent" render={({ field }) => <FormItem>
                      <FormLabel>Message type</FormLabel><FormControl><select {...field} className="select-control" data-testid="select-message-intent"><option value="research-message">Research message</option><option value="prayer">Prayer</option></select></FormControl>
                    </FormItem>} />
                    <FormField control={form.control} name="symbolDurationMs" render={({ field }) => <FormItem>
                      <FormLabel>Symbol timing</FormLabel><FormControl><select {...field} className="select-control" data-testid="select-symbol-duration">{CELESTIAL_SYMBOL_DURATION_OPTIONS.map(value => <option key={value} value={value}>{value} ms per symbol</option>)}</select></FormControl>
                    </FormItem>} />
                    <FormField control={form.control} name="outputLevel" render={({ field }) => <FormItem>
                      <FormLabel>Speaker level</FormLabel><FormControl><select {...field} className="select-control" data-testid="select-output-level">{CELESTIAL_OUTPUT_LEVEL_OPTIONS.filter(value => value <= 0.08).map(value => <option key={value} value={value}>{Math.round(value * 100)}% low output</option>)}</select></FormControl>
                      <FormDescription>Limited to a conservative level.</FormDescription>
                    </FormItem>} />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary cex-generate" disabled={!canGenerate} data-testid="button-generate-preview"><AudioLines size={16} />Generate inspectable preview</button>
              </form>
            </Form>
            {signalError && <div className="cex-inline-error" role="alert" data-testid="status-encoding-error">{signalError}</div>}
            {draft.signal ? <div className="cex-signal-preview" data-testid="panel-signal-preview">
              <div className="cex-preview-top"><div><span className="cex-overline">Encoded packet</span><strong>{draft.signal.symbols.length} symbols</strong></div><span className="cex-check"><Check size={13} />CRC-16 / {draft.signal.checksum.toString(16).toUpperCase().padStart(4, '0')}</span></div>
              <div className="cex-symbols" aria-label="Encoded tone-symbol sequence" data-testid="value-tone-symbols">{draft.signal.symbols.slice(0, 68).map((symbol, index) => <span key={`${index}-${symbol}`} title={`Symbol ${index + 1}: ${symbol}`} className={`cex-symbol ${index < 4 ? 'sync' : ''}`}>{symbol.toString(16).toUpperCase()}</span>)}{draft.signal.symbols.length > 68 && <span className="cex-symbol-more">+{draft.signal.symbols.length - 68} more</span>}</div>
              <div className="cex-signal-meta"><span>{draft.signal.payloadByteLength} payload bytes</span><span>{draft.signal.durationSeconds.toFixed(2)} sec</span><span>4 × 4 dual-tone / {draft.signal.sampleRateHz.toLocaleString()} Hz</span><span>Carrier pair map: {draft.signal.carrierFrequenciesHz.slice(0, 4).join(' / ')} + {draft.signal.carrierFrequenciesHz.slice(4).join(' / ')} Hz</span></div>
              <div className="cex-authorize">
                <label className="cex-consent"><input type="checkbox" checked={authorized} onChange={event => setAuthorized(event.target.checked)} data-testid="checkbox-authorize-playback" /><span><strong>I authorize local-speaker playback</strong><small>This plays only the encoded packet on this device. It does not contact or signal an external intelligence.</small></span></label>
                <div className="cex-authorize-actions">
                  <button type="button" className="btn btn-subtle cex-download-wav" onClick={downloadSignalWav} disabled={!previewIsCurrent} data-testid="button-download-dtmf-wav"><Download size={14} />Download WAV</button>
                  {!playing ? <button className="btn btn-primary cex-play" onClick={() => void startPlayback()} disabled={!authorized || !previewIsCurrent || engine.running || engine.starting} data-testid="button-play-packet"><Play size={15} />Play packet</button> : <button className="btn btn-stop cex-play" onClick={stopPlayback} data-testid="button-stop-packet"><Square size={14} fill="currentColor" />Stop playback</button>}
                </div>
              </div>
               {draft.signal && !previewIsCurrent && <p className="cex-status" role="status" data-testid="status-stale-preview">Message or encoding settings changed. Generate a fresh preview before playback.</p>}
              {playbackStatus && <p className="cex-status" role="status" data-testid="status-playback">{playbackStatus}</p>}
              {playbackError && <p className="cex-inline-error" role="alert" data-testid="status-playback-error">{playbackError}</p>}
            </div> : <div className="cex-preview-empty"><AudioLines size={18} /><span>Generate a preview to inspect the exact tone-symbol packet before choosing whether to play it.</span></div>}
          </div>
          <section className="cex-decoder" aria-labelledby="cex-decoder-title" data-testid="panel-local-decoder">
            <div className="cex-decoder-heading">
              <div><div className="eyebrow">Supported protocol / local decode</div><h3 id="cex-decoder-title">Decode symbols or WAV audio.</h3></div>
              <span className="cex-protocol-tag">{CELESTIAL_PROTOCOL_ID}</span>
            </div>
            <p className="cex-decoder-description">Paste hexadecimal symbols or select a supported WAV packet below. The local decoder checks the sync sequence, version, length, checksum, and UTF-8 payload. WAV decoding uses the file's declared sample rate; it does not activate the microphone.</p>
            <label className="cex-label" htmlFor="input-decode-symbols">Packet symbols in hexadecimal</label>
            <textarea
              id="input-decode-symbols"
              className="text-control cex-decoder-input"
              value={decoderSymbols}
              maxLength={CELESTIAL_MAX_SYMBOLS * 3}
              onChange={event => {
                setDecoderSymbols(event.target.value);
                setDecodedMessage('');
                setDecoderError('');
              }}
              placeholder="Generate a packet above or paste its hex symbols…"
              aria-describedby="cex-decoder-help"
              data-testid="input-decode-symbols"
            />
            <div className="cex-decoder-footer">
              <span id="cex-decoder-help" className="cex-small">Maximum {CELESTIAL_MAX_SYMBOLS} symbols. No sign-in or network request.</span>
              <button type="button" className="btn btn-subtle" onClick={decodePacket} disabled={!decoderSymbols.trim()} data-testid="button-decode-packet">Decode locally</button>
            </div>
            {decoderError && <p className="cex-inline-error" role="alert" data-testid="status-decode-error">{decoderError}</p>}
            {decodedMessage !== '' && <div className="cex-decoded-result" role="status" aria-live="polite" data-testid="output-decoded-message"><span>Recovered text</span><p>{decodedMessage}</p></div>}
            <DtmfAudioReceiver
              fileName={dtmfAudioFileName}
              result={dtmfAudioResult}
              running={dtmfAudioLoading}
              error={dtmfAudioError}
              onSelectFile={file => void decodeDtmfAudioFile(file)}
            />
          </section>
          <p className="cex-caution"><Info size={14} />Playback uses this browser’s selected audio output only. This app does not transmit by radio or send the packet remotely; the experimental encoding is not evidence of a reply.</p>
        </div>
      </section>

      <section className="cex-step">
        <div className="cex-step-index">02</div>
        <div className="cex-step-content">
          <div className="cex-section-heading"><div><div className="eyebrow">Optional observation</div><h2>Listen after the pattern.</h2></div><span className={`cex-capture-state ${engine.running ? 'active' : ''}`} data-testid="status-capture"><i />{engine.running ? 'Mic active' : 'Standby'}</span></div>
          <div className="cex-observe-grid">
            <div className="panel cex-panel cex-observe-panel">
              <div className="cex-capture-copy"><div className="cex-icon-disc"><Mic size={17} /></div><div><h3>Local microphone window</h3><p>{engine.error || engine.status}</p></div></div>
              <div className="cex-instrument-status" data-testid="panel-instrument-status">
                <div><span>Instrument</span><strong>{engine.instrumentDiscovery?.instrument.name ?? 'Browser microphone'}</strong></div>
                <div><span>Operational status</span><strong data-testid="value-instrument-status">{(engine.instrumentDiscovery?.status ?? 'checking').replaceAll('-', ' ')}</strong></div>
                <p>Audio inputs found: {engine.instrumentDiscovery?.availableInputCount ?? 'not reported'} · calibration: {engine.instrumentDiscovery?.instrument.calibration.status ?? 'pending'}. Device labels and identifiers are not collected.</p>
              </div>
              {instrumentRegistry.list().some(instrument => instrument.sourceType === 'simulated') && <p className="cex-simulator-note" data-testid="notice-development-simulator">Development-only synthetic test source is registered. It is not connected to microphone capture and cannot be saved as a live measurement.</p>}
              {engine.reading && <div className="cex-reading-grid" data-testid="panel-live-summary">
                <div><span>Dominant peak</span><strong data-testid="value-observation-dominant">{engine.reading.dominant == null ? 'No clear peak' : `${engine.reading.dominant.toFixed(1)} Hz`}</strong></div>
                <div><span>RMS amplitude (FS)</span><strong data-testid="value-observation-rms">{engine.reading.rms.toFixed(4)} FS</strong></div>
                <div><span>Sample / FFT</span><strong data-testid="value-observation-sample">{engine.reading.sampleRate.toLocaleString()} / {engine.reading.fftSize.toLocaleString()}</strong></div>
              </div>}
              <label className="cex-label" htmlFor="observation-note">Manual observation note</label>
              <textarea id="observation-note" className="text-control cex-note" maxLength={2000} value={observationNote} onChange={event => setObservationNote(event.target.value)} placeholder="Room conditions, device placement, or what you noticed…" data-testid="input-observation-note" />
               {!engine.running && !engine.starting && <button className="btn btn-subtle cex-note-add" onClick={addManualNote} disabled={!observationNote.trim() || playing} data-testid="button-add-manual-note"><Check size={14} />Add note to session</button>}
               {engine.starting && !engine.reading
                 ? <button className="btn btn-stop cex-capture-button" onClick={() => void engine.stop('Capture cancelled. No audio was saved.')} data-testid="button-cancel-capture"><Square size={14} fill="currentColor" />Cancel microphone request</button>
                 : engine.running
                   ? <button className="btn btn-stop cex-capture-button" onClick={() => void addObservation()} disabled={!engine.reading} data-testid="button-stop-capture"><Square size={14} fill="currentColor" />Stop & add summary</button>
                   : <button className="btn btn-primary cex-capture-button" onClick={() => void engine.start()} disabled={playing} data-testid="button-start-capture"><Mic size={15} />Start microphone observation</button>}
              <p className="permission-note">Microphone permission begins only after you start. Analysis stays in memory in this tab; only summary values and your note can be added to the session.</p>
              {engine.error && <p className="cex-inline-error" role="alert" data-testid="status-microphone-error">{engine.error}</p>}
            </div>
            <aside className="cex-instrument-note">
              <div className="eyebrow">What this sensor measures</div>
              <p>A microphone measures audible sound pressure at the device. It cannot receive radio-frequency signals or identify a source.</p>
              <div className="cex-note-rule" />
              <p className="cex-small">A sound after playback is an observation, not a decoded response. Timing alone cannot establish communication.</p>
            </aside>
          </div>
              {draft.observations.length > 0 && <div className="cex-observation-list" data-testid="list-observations">{draft.observations.map((item, index) => <div className="cex-observation-row" key={item.id} data-testid={`row-observation-${item.id}`}><Activity size={15} /><span><strong>Window {index + 1}</strong><small>{item.dominantFrequencyHz == null ? 'No dominant peak' : `${item.dominantFrequencyHz.toFixed(1)} Hz dominant`} · {item.window.durationSeconds.toFixed(1)} sec</small></span><span className="mono">RMS {item.rmsLevel.toFixed(4)} FS</span></div>)}</div>}
        </div>
      </section>

      <section className="cex-step">
        <div className="cex-step-index">03</div>
        <div className="cex-step-content">
          <div className="cex-section-heading"><div><div className="eyebrow">Interpret carefully</div><h2>Keep the record in separate layers.</h2></div></div>
          <section className="panel cex-panel cex-analysis-card" data-testid="panel-session-analysis">
            <div className="cex-card-label"><span className="cex-layer-mark measured" />Local measured summary <small>deterministic statistics · no AI request</small></div>
            {sessionAnalysis
              ? <>
                <p className="cex-analysis-message" data-testid="text-session-analysis">{sessionAnalysis.message}</p>
                <div className="cex-reading-grid" data-testid="panel-session-analysis-metrics">
                  <div><span>Observation windows</span><strong>{sessionAnalysis.observationCount}</strong></div>
                  <div><span>Median dominant peak</span><strong>{sessionAnalysis.medianDominantFrequencyHz == null ? 'No clear peak' : `${sessionAnalysis.medianDominantFrequencyHz.toFixed(1)} Hz`}</strong></div>
                  <div><span>Mean RMS amplitude</span><strong>{sessionAnalysis.meanRmsLevel.toFixed(4)} FS</strong></div>
                </div>
                <p className="cex-small" data-testid="text-session-analysis-limits">{sessionAnalysis.limitation}</p>
              </>
              : <p className="cex-small" data-testid="text-session-analysis-empty">Capture a microphone window to calculate a local summary. No source or response is inferred.</p>}
          </section>
          {draft.observations.length > 0
            ? <label className="cex-label cex-interpretation-link" htmlFor="interpretation-observation">
              Link these user-authored notes to an observation
              <select
                id="interpretation-observation"
                className="select-control"
                value={draft.observations.some(item => item.id === interpretationObservationId)
                  ? interpretationObservationId
                  : draft.observations.at(-1)?.id ?? ''}
                onChange={event => selectInterpretationObservation(event.target.value)}
                data-testid="select-interpretation-observation"
              >
                {draft.observations.map((item, index) => <option key={item.id} value={item.id}>
                  Window {index + 1} · {new Date(item.window.startedAt).toLocaleTimeString()} · {item.dominantFrequencyHz == null ? 'no clear peak' : `${item.dominantFrequencyHz.toFixed(1)} Hz`}
                </option>)}
              </select>
            </label>
            : <p className="cex-interpretation-unavailable" role="status" data-testid="status-interpretation-needs-observation">Record a microphone observation first. Your notes will then link to that exact reading; no AI model is used for these fields.</p>}
          <div className="cex-interpret-grid">
            <div className="panel cex-panel cex-interpret-card">
              <div className="cex-card-label"><span className="cex-layer-mark measured" />Measured pattern <small>describe observations, not a source</small></div>
              <textarea className="text-control cex-note" value={draft.interpretation?.measuredPattern ?? ''} onChange={event => updateInterpretation('measuredPattern', event.target.value)} maxLength={1500} disabled={!draft.observations.length} placeholder="What did the instrument record?" data-testid="input-measured-pattern" />
            </div>
            <div className="panel cex-panel cex-interpret-card">
              <div className="cex-card-label"><span className="cex-layer-mark uncertain" />Uncertainty <small>limits, alternatives, missing context</small></div>
              <textarea className="text-control cex-note" value={draft.interpretation?.uncertainty ?? ''} onChange={event => updateInterpretation('uncertainty', event.target.value)} maxLength={1500} disabled={!draft.observations.length} placeholder="What remains unknown or could explain it?" data-testid="input-uncertainty" />
            </div>
            <div className="panel cex-panel cex-interpret-card cex-reflection-card">
              <div className="cex-card-label"><span className="cex-layer-mark reflection" />Personal reflection <small>meaning is yours; not a sensor output</small></div>
              <textarea className="text-control cex-note" value={draft.interpretation?.personalReflection ?? ''} onChange={event => updateInterpretation('personalReflection', event.target.value)} maxLength={1500} disabled={!draft.observations.length} placeholder="What does this experience mean to you personally?" data-testid="input-personal-reflection" />
            </div>
          </div>
          <div className="panel cex-panel cex-hypothesis">
            <div className="cex-hypothesis-heading"><div><div className="eyebrow">User-authored hypothesis</div><h3>A question to revisit—not a conclusion.</h3></div><select className="select-control cex-status-select" value={draft.hypothesis?.status ?? 'open'} onChange={event => updateHypothesis('status', event.target.value)} data-testid="select-hypothesis-status"><option value="open">Open</option><option value="tentative">Tentative</option><option value="not-observed">Not observed</option></select></div>
            <textarea className="text-control cex-note" value={draft.hypothesis?.statement ?? ''} onChange={event => updateHypothesis('statement', event.target.value)} maxLength={1200} placeholder="What do you predict or wonder about this observation?" data-testid="input-hypothesis" />
          </div>
        </div>
      </section>

      <section className="cex-savebar">
        <div><div className="eyebrow">Your browser / account-scoped record</div><p>{revisingSessionId ? 'Save changes as a new experiment version. Raw observations remain unchanged.' : 'Save this session locally when you are ready. Nothing is added automatically.'}</p>{saveStatus && <span className={saveStatus.includes('saved') ? 'cex-save-success' : 'cex-save-error'} role="status" data-testid="status-session-save">{saveStatus}</span>}</div>
        <button className="btn btn-primary cex-save-button" onClick={saveSession} disabled={!loaded} data-testid="button-save-session"><Save size={15} />{revisingSessionId ? 'Save experiment revision' : 'Save session locally'}</button>
      </section>

      <section className="cex-step" data-testid="step-experiment-design">
        <div className="cex-step-index">04</div>
        <div className="cex-step-content">
          <div className="cex-section-heading">
            <div><div className="eyebrow">Plan a follow-up</div><h2>Turn saved observations into a testable proposal.</h2></div>
          </div>
          <ExperimentDesignPanel
            sessions={sessions
              .filter(session => session.observations.length > 0)
              .map(session => ({
                id: session.id,
                domain: researchGridRegistry.getDomain(session.domain)?.label ?? session.domain,
                totalObservationCount: session.observations.length,
                sendObservationCount: Math.min(session.observations.length, EXPERIMENT_DESIGN_MAX_OBSERVATIONS),
              }))}
            signedIn={identityType === 'firebase-uid'}
            aiReady={firebaseAiReady}
            unavailableMessage={getFirebaseAiSetupMessage()}
            loading={experimentDesignLoading}
            error={experimentDesignError}
            proposal={experimentDesign}
            onGenerate={(sourceSessionId, researchQuestion, consentToSend) => {
              void generateExperimentDesign(sourceSessionId, researchQuestion, consentToSend);
            }}
            onExport={exportExperimentDesign}
          />
        </div>
      </section>

      <section className="cex-history">
        <div className="cex-history-head"><div><div className="eyebrow">Local archive</div><h2>Research sessions</h2></div><button className="btn btn-subtle" onClick={() => downloadJson('zioncore-celestial-sessions.json', sessions)} disabled={!sessions.length} data-testid="button-export-sessions"><Download size={14} />Export JSON</button></div>
        {loaded && sessions.length === 0 ? <div className="panel cex-empty" data-testid="status-empty-history"><span className="empty-glyph"><Radio size={22} /></span><h3>No saved sessions yet.</h3><p>Completed sessions appear here only after you save them to this browser.</p></div>
          : sessions.length > 0 && <div className="cex-archive">
              <div className="cex-compare-banner">
                <div>
                  <strong>Compare measured summaries</strong>
                  <p>{comparisonAgent ? `${comparisonAgent.label} runs locally at an estimated $0 cost. ` : 'No compatible agent fits the current budget. '}Select up to {MAX_RESEARCH_COMPARISON_SESSIONS} records below to compare microphone observations. These statistics do not identify a source or establish a reply.</p>
                </div>
                {compared && <div className="cex-compare-stats" data-testid="panel-comparison-summary">
                  <span><strong>{compared.observationCount}</strong> windows</span>
                  <span><strong>{compared.sessionsWithObservations}</strong> sessions</span>
                  <span><strong>{compared.medianDominantFrequencyHz == null ? '—' : `${compared.medianDominantFrequencyHz.toFixed(1)} Hz`}</strong> median peak</span>
                  <span><strong>{compared.meanRmsLevel.toFixed(4)} FS</strong> mean RMS amplitude</span>
                </div>}
                {repeatedComparison.pairs.length > 0
                  ? <details className="cex-alignment-panel" data-testid="panel-aligned-comparison">
                    <summary>Review aligned windows ({repeatedComparison.pairs.reduce((count, pair) => count + pair.alignedWindows.length, 0)} matched pairs)</summary>
                    <p className="cex-alignment-explainer">Windows align by elapsed time from recorded transmission completion, or from the first observation when no completion time exists (±{repeatedComparison.timeToleranceSeconds} sec). This compares saved peak and level summaries only.</p>
                    <label className="cex-alignment-control" htmlFor="observation-alignment-tolerance">
                      Time-alignment tolerance
                      <select
                        id="observation-alignment-tolerance"
                        className="select-control"
                        value={alignmentToleranceSeconds}
                        onChange={event => setAlignmentToleranceSeconds(Number(event.target.value))}
                        data-testid="select-alignment-tolerance"
                      >
                        <option value={0.5}>±0.5 seconds</option>
                        <option value={1}>±1 second</option>
                        <option value={2}>±2 seconds</option>
                        <option value={5}>±5 seconds</option>
                      </select>
                    </label>
                    {repeatedComparison.pairs.map(pair => <section className="cex-session-comparison" key={`${pair.firstSessionId}-${pair.secondSessionId}`}>
                      <h4><span>{comparisonSessionLabel(pair.firstSessionId)}</span><span>vs.</span><span>{comparisonSessionLabel(pair.secondSessionId)}</span></h4>
                      <p>{pair.alignedWindows.length} aligned of {pair.firstWindowCount} and {pair.secondWindowCount} windows; {pair.unmatchedFirstWindowCount + pair.unmatchedSecondWindowCount} unmatched across this pair.</p>
                      <p className="cex-alignment-anchor">Time anchors: {pair.firstAlignmentAnchor === 'transmission-completed' ? 'transmission completion' : 'first observation'} vs. {pair.secondAlignmentAnchor === 'transmission-completed' ? 'transmission completion' : 'first observation'}.</p>
                      {pair.alignedWindows.length > 0
                        ? <div className="cex-alignment-table-wrap"><table className="cex-alignment-table">
                          <thead><tr><th>Elapsed from anchors</th><th>Time Δ</th><th>Peak overlap</th><th>Dominant peak Δ</th><th>RMS Δ</th></tr></thead>
                          <tbody>{pair.alignedWindows.map((windowPair, index) => <tr key={`${windowPair.firstElapsedSeconds}-${windowPair.secondElapsedSeconds}-${index}`}>
                            <td>{windowPair.firstElapsedSeconds.toFixed(1)} / {windowPair.secondElapsedSeconds.toFixed(1)} s</td>
                            <td>{windowPair.alignmentDeltaSeconds.toFixed(2)} s</td>
                            <td>{windowPair.peakOverlapPercent == null ? 'No peaks' : `${windowPair.matchedPeakCount}/${windowPair.comparedPeakCount} · ${windowPair.peakOverlapPercent.toFixed(0)}%`}<small>±{windowPair.peakToleranceHz.toFixed(1)} Hz</small></td>
                            <td>{windowPair.dominantFrequencyDeltaHz == null ? '—' : `${windowPair.dominantFrequencyDeltaHz.toFixed(1)} Hz`}</td>
                            <td>{windowPair.rmsDifferenceFullScale.toFixed(4)} FS</td>
                          </tr>)}</tbody>
                        </table></div>
                        : <p className="cex-no-aligned-windows">No windows fell within the selected alignment tolerance.</p>}
                    </section>)}
                    <p className="cex-alignment-limitation">{repeatedComparison.limitation}</p>
                  </details>
                  : <p className="cex-alignment-empty" data-testid="status-alignment-empty">{selectedIds.length < 2
                    ? 'Select at least two saved sessions with observations to align repeat windows.'
                    : 'At least two selected sessions need saved microphone observations for alignment.'}</p>}
              </div>
            {sessions.map(session => <article className="panel cex-session-card" key={session.id} data-testid={`card-session-${session.id}`}>
              <div className="cex-session-main"><label className="cex-select-session"><input type="checkbox" checked={selectedIds.includes(session.id)} disabled={!selectedIds.includes(session.id) && selectedIds.length >= MAX_RESEARCH_COMPARISON_SESSIONS} onChange={event => setSelectedIds(current => event.target.checked ? [...current, session.id] : current.filter(id => id !== session.id))} data-testid={`checkbox-compare-${session.id}`} /><span className="sr-only">Compare session {session.id}</span></label>
                 <div className="cex-session-info"><span className="cex-session-date">{new Date(session.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span><h3>{session.message.text || 'Untitled research session'}</h3><p>{researchGridRegistry.getDomain(session.domain)?.label ?? session.domain} · {session.message.intent === 'prayer' ? 'Prayer' : 'Research message'} · {session.signal ? `${session.signal.symbols.length} symbols` : 'No encoded signal'} · {session.observations.length} mic {session.observations.length === 1 ? 'window' : 'windows'}</p></div>
                <button className="cex-icon-button" onClick={() => deleteSession(session.id)} aria-label="Delete session" data-testid={`button-delete-session-${session.id}`}><Trash2 size={15} /></button>
              </div>
              <details className="cex-details"><summary data-testid={`button-review-session-${session.id}`}>Review session</summary><div className="cex-detail-content">
                <div className="cex-detail-row"><span>Protocol</span><strong>{session.encoding.protocolId} · {session.encoding.symbolDurationMs} ms · {Math.round(session.encoding.outputLevel * 100)}% level</strong></div>
                {session.signal && <div className="cex-detail-row"><span>Signal</span><strong>{session.signal.durationSeconds.toFixed(2)} sec · checksum {session.signal.checksum.toString(16).toUpperCase().padStart(4, '0')}</strong></div>}
                {session.transmission && <div className="cex-detail-row"><span>Playback</span><strong>{session.transmission.stoppedEarly ? 'Stopped early' : session.transmission.completedAt ? 'Completed locally' : 'Authorized; completion not recorded'}</strong></div>}
                 <button className="btn btn-subtle cex-revise-hypothesis" onClick={() => loadSessionForRevision(session)} data-testid={`button-revise-experiment-${session.id}`}>Load to revise experiment or protocol</button>
                 <p className="cex-small">Saving your edits creates a new version in this record. Existing measurements remain unchanged.</p>
                {session.observations.map(observation => <div className="cex-saved-observation" key={observation.id}><span>{observation.dominantFrequencyHz == null ? 'No dominant peak' : `${observation.dominantFrequencyHz.toFixed(1)} Hz`} · RMS {observation.rmsLevel.toFixed(4)} FS · {observation.window.durationSeconds.toFixed(1)} sec</span>{observation.notes && <p>{observation.notes}</p>}</div>)}
                {session.hypothesis?.statement && <p className="cex-saved-reflection" data-testid={`text-saved-hypothesis-${session.id}`}><b>User-authored hypothesis · {session.hypothesis.status}:</b> {session.hypothesis.statement}</p>}
                {Boolean(session.hypothesis?.revisionHistory?.length) && <details className="cex-hypothesis-revisions" data-testid={`details-hypothesis-history-${session.id}`}>
                  <summary>Earlier hypothesis versions ({session.hypothesis?.revisionHistory?.length}; up to 20 retained)</summary>
                  {session.hypothesis?.revisionHistory?.map((revision, index) => <p className="cex-saved-reflection" key={`${revision.updatedAt}-${index}`}>
                    <b>Prior user hypothesis · {revision.status} · {new Date(revision.updatedAt).toLocaleString()}:</b> {revision.statement}
                  </p>)}
                </details>}
                {editingHypothesisId === session.id
                  ? <div className="cex-hypothesis-editor" data-testid={`panel-hypothesis-editor-${session.id}`}>
                    <label className="cex-label" htmlFor={`hypothesis-revision-${session.id}`}>Revise your hypothesis</label>
                    <textarea
                      id={`hypothesis-revision-${session.id}`}
                      className="text-control cex-note"
                      value={hypothesisEditText}
                      onChange={event => setHypothesisEditText(event.target.value)}
                      maxLength={1200}
                      data-testid={`input-hypothesis-revision-${session.id}`}
                    />
                    <label className="cex-label" htmlFor={`hypothesis-status-${session.id}`}>Hypothesis status</label>
                    <select
                      id={`hypothesis-status-${session.id}`}
                      className="select-control"
                      value={hypothesisEditStatus}
                      onChange={event => setHypothesisEditStatus(event.target.value as HypothesisStatus)}
                      data-testid={`select-hypothesis-revision-status-${session.id}`}
                    >
                      <option value="open">Open</option>
                      <option value="tentative">Tentative</option>
                      <option value="not-observed">Not observed</option>
                    </select>
                    {hypothesisEditError && <p className="cex-inline-error" role="alert" data-testid={`status-hypothesis-revision-error-${session.id}`}>{hypothesisEditError}</p>}
                    <div className="cex-hypothesis-actions">
                      <button className="btn btn-primary" onClick={saveHypothesisRevision} disabled={!hypothesisEditText.trim()} data-testid={`button-save-hypothesis-${session.id}`}>Save hypothesis revision</button>
                      <button className="btn btn-subtle" onClick={cancelHypothesisRevision} data-testid={`button-cancel-hypothesis-${session.id}`}>Cancel</button>
                    </div>
                    <p className="cex-small">This changes only the user-authored hypothesis. Recorded observations and interpretations stay unchanged.</p>
                  </div>
                  : <button className="btn btn-subtle cex-revise-hypothesis" onClick={() => beginHypothesisRevision(session)} data-testid={`button-revise-hypothesis-${session.id}`}>
                    {session.hypothesis?.statement ? 'Revise hypothesis' : 'Add hypothesis'}
                  </button>}
                {hypothesisEditNotice?.id === session.id && <p className="cex-save-success" role="status" data-testid={`status-hypothesis-revised-${session.id}`}>{hypothesisEditNotice.text}</p>}
                {session.findings.map((finding, index) => <p className="cex-saved-reflection" key={`${finding.createdAt}-${index}`}><b>Manual note:</b> {finding.statement}</p>)}
                {session.interpretation && <div className="cex-saved-layers">
                  <p><b>User-authored measured pattern:</b> {session.interpretation.measuredPattern || '—'}</p>
                  <p><b>Uncertainty:</b> {session.interpretation.uncertainty || '—'}</p>
                  <p><b>Personal reflection:</b> {session.interpretation.personalReflection || '—'}</p>
                  {session.interpretation.provenance
                    ? <p data-testid={`text-interpretation-provenance-${session.id}`}>
                      <b>Linked interpretation:</b> observation {session.interpretation.provenance.observationId} · method {session.interpretation.provenance.methodId} v{session.interpretation.provenance.methodVersion} · user-authored at {new Date(session.interpretation.createdAt).toLocaleString()}.
                    </p>
                    : <p><b>Legacy record:</b> this interpretation predates observation and method provenance.</p>}
                </div>}
                {editingInterpretationId === session.id
                  ? <div className="cex-hypothesis-editor" data-testid={`panel-interpretation-editor-${session.id}`}>
                    <label className="cex-label" htmlFor={`interpretation-pattern-${session.id}`}>Measured pattern</label>
                    <textarea
                      id={`interpretation-pattern-${session.id}`}
                      className="text-control cex-note"
                      value={interpretationEdit.measuredPattern}
                      onChange={event => setInterpretationEdit(current => ({ ...current, measuredPattern: event.target.value }))}
                      maxLength={1500}
                      data-testid={`input-interpretation-pattern-${session.id}`}
                    />
                    <label className="cex-label" htmlFor={`interpretation-uncertainty-${session.id}`}>Uncertainty</label>
                    <textarea
                      id={`interpretation-uncertainty-${session.id}`}
                      className="text-control cex-note"
                      value={interpretationEdit.uncertainty}
                      onChange={event => setInterpretationEdit(current => ({ ...current, uncertainty: event.target.value }))}
                      maxLength={1500}
                      data-testid={`input-interpretation-uncertainty-${session.id}`}
                    />
                    <label className="cex-label" htmlFor={`interpretation-reflection-${session.id}`}>Personal reflection</label>
                    <textarea
                      id={`interpretation-reflection-${session.id}`}
                      className="text-control cex-note"
                      value={interpretationEdit.personalReflection}
                      onChange={event => setInterpretationEdit(current => ({ ...current, personalReflection: event.target.value }))}
                      maxLength={1500}
                      data-testid={`input-interpretation-reflection-${session.id}`}
                    />
                    {interpretationEditError && <p className="cex-inline-error" role="alert" data-testid={`status-interpretation-revision-error-${session.id}`}>{interpretationEditError}</p>}
                    <div className="cex-hypothesis-actions">
                      <button className="btn btn-primary" onClick={saveInterpretationRevision} data-testid={`button-save-interpretation-${session.id}`}>Save interpretation version</button>
                      <button className="btn btn-subtle" onClick={cancelInterpretationRevision} data-testid={`button-cancel-interpretation-${session.id}`}>Cancel</button>
                    </div>
                    <p className="cex-small">This creates a user-authored interpretation revision linked to an existing observation. It does not rewrite measured observations.</p>
                  </div>
                  : <button
                    className="btn btn-subtle cex-revise-hypothesis"
                    onClick={() => beginInterpretationRevision(session)}
                    disabled={!session.observations.length}
                    data-testid={`button-revise-interpretation-${session.id}`}
                  >
                    {session.interpretation ? 'Revise interpretation' : 'Add interpretation'}
                  </button>}
                {interpretationEditNotice?.id === session.id && <p className="cex-save-success" role="status" data-testid={`status-interpretation-revised-${session.id}`}>{interpretationEditNotice.text}</p>}
                {session.discoveryVersions?.length
                  ? <details className="cex-discovery-versions" data-testid={`details-discovery-versions-${session.id}`}>
                    <summary>Discovery memory · {session.discoveryVersions.length} versioned records</summary>
                    <p className="cex-discovery-note">Versioned experiment settings and human-authored interpretations are stored separately from measured observations. Each record links observation IDs only; it does not copy raw measurements.</p>
                    <ol>
                      {[...session.discoveryVersions].reverse().map(revision => <li key={revision.id} data-testid={`discovery-version-${revision.kind}-${revision.version}-${session.id}`}>
                        <div className="cex-discovery-version-heading">
                          <strong>{revision.kind} v{revision.version}</strong>
                          <time dateTime={revision.recordedAt}>{new Date(revision.recordedAt).toLocaleString()}</time>
                        </div>
                        {revision.kind === 'experiment' && <p>{revision.snapshot.domain} · {revision.snapshot.message.intent} · {revision.snapshot.transmissionStatus}</p>}
                        {revision.kind === 'protocol' && <p>{revision.snapshot.protocolId} · contract v{revision.snapshot.protocolContractVersion} · encoder {revision.snapshot.methodId} v{revision.snapshot.methodVersion} · {revision.snapshot.symbolDurationMs} ms</p>}
                        {revision.kind === 'hypothesis' && <p><b>{revision.snapshot.status}:</b> {revision.snapshot.statement}</p>}
                        {revision.kind === 'interpretation' && <p><b>Interpretation:</b> {revision.snapshot.measuredPattern || 'No measured-pattern text'} <span>· uncertainty and reflection retained in this version</span></p>}
                        <small>{revision.source === 'user-authored' ? 'User-authored' : 'Captured from the saved experiment'} · {revision.observationRefs.length} observation reference(s); raw measurements remain in the observation records.</small>
                      </li>)}
                    </ol>
                  </details>
                  : <p className="cex-discovery-empty">No version ledger yet. Saving this experiment or revising its hypothesis or interpretation creates an exportable history.</p>}
              </div></details>
            </article>)}
          </div>}
        <p className="footnote"><ShieldCheck size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />This experimental archive is stored only in your browser, separated by signed-in account but not encrypted. Browser storage may be cleared by device settings; export a JSON copy if you need a separate record.</p>
      </section>
    </main>
  </div>;
}
