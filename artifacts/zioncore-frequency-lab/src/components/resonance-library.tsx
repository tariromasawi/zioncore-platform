import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioLines, CircleStop, Headphones, Play, Radio, Volume2, Waves } from 'lucide-react';
import './resonance-library.css';

type Collection = 'Measured tones' | 'Copper studies' | 'Solfeggio cascades' | 'Spiritual resonances';
type ListeningIntention =
  | 'Open listening'
  | 'Prayer & spiritual connection'
  | 'Calm & breathing'
  | 'Space-clearing ritual'
  | 'Restoration & healing tradition'
  | 'Frequency exploration';

type Track = {
  id: string;
  title: string;
  collection: Collection;
  duration: number;
  summary: string;
  detail: string;
  peaks?: string;
  caution?: string;
  mark: string;
};

const tracks: Track[] = [
  {
    id: 'low-tone-20hz',
    title: 'Low tone · 20 Hz',
    collection: 'Measured tones',
    duration: 30,
    summary: 'Very low-frequency exploration',
    detail: 'Measured dominant peak: 20.2 Hz. Many speakers may not reproduce this range.',
    mark: '01',
  },
  {
    id: 'low-tone-100hz',
    title: 'Low tone · 100 Hz',
    collection: 'Measured tones',
    duration: 30,
    summary: 'Steady bass resonance',
    detail: 'Measured dominant peak: 99.6 Hz.',
    mark: '02',
  },
  {
    id: 'reference-1000hz',
    title: 'Reference · 1,000 Hz',
    collection: 'Measured tones',
    duration: 60,
    summary: 'A clear reference tone',
    detail: 'Measured dominant peak: 999.9 Hz.',
    mark: '03',
  },
  {
    id: 'high-tone-8khz',
    title: 'High tone · 8 kHz',
    collection: 'Measured tones',
    duration: 30,
    summary: 'Bright upper tone',
    detail: 'Measured dominant peak: 7,999.6 Hz. It can sound sharp depending on the listener and device.',
    caution: 'Sharpness varies by listener and playback device.',
    mark: '04',
  },
  {
    id: 'high-tone-18khz',
    title: 'High tone · 18 kHz',
    collection: 'Measured tones',
    duration: 30,
    summary: 'Near the upper edge of common hearing',
    detail: 'Measured dominant peak: 18,000.4 Hz. Playback varies; some listeners will not hear it.',
    caution: 'May be inaudible or sound sharp depending on listener and device.',
    mark: '05',
  },
  {
    id: 'copper-resonance-matrix',
    title: 'Copper resonance · Matrix',
    collection: 'Copper studies',
    duration: 90,
    summary: 'Layered resonance · stereo, 32 kHz',
    detail: 'Strongest measured peaks: 81.1, 219.7, 440.4, 660.2 and 699.2 Hz.',
    peaks: '81.1 · 219.7 · 440.4 · 660.2 · 699.2 Hz',
    mark: '06',
  },
  {
    id: 'copper-resonance-challenge',
    title: 'Copper resonance · Study',
    collection: 'Copper studies',
    duration: 96,
    summary: 'A second layered resonance study',
    detail: 'Strongest measured peaks: 87.5, 110.4, 219.4, 329.7, 877.5 and 1,391.6 Hz.',
    peaks: '87.5 · 110.4 · 219.4 · 329.7 · 877.5 · 1,391.6 Hz',
    mark: '07',
  },
  {
    id: 'solfeggio-cascade-1',
    title: 'Solfeggio cascade · 01',
    collection: 'Solfeggio cascades',
    duration: 15.65,
    summary: 'A compact, multi-peak cascade',
    detail: 'Strongest measured peaks: about 82, 329.6, 991.7, 1,111.8 and 1,248 Hz.',
    peaks: '≈82 · 329.6 · 991.7 · 1,111.8 · 1,248 Hz',
    mark: '08',
  },
  {
    id: 'solfeggio-cascade-2',
    title: 'Solfeggio cascade · 02',
    collection: 'Solfeggio cascades',
    duration: 10.06,
    summary: 'A short, multi-peak cascade',
    detail: 'Strongest measured peaks: about 124.5, 164.1, 369.1, 493.7 and 624 Hz.',
    peaks: '≈124.5 · 164.1 · 369.1 · 493.7 · 624 Hz',
    mark: '09',
  },
  {
    id: 'solfeggio-cascade-3',
    title: 'Solfeggio cascade · 03',
    collection: 'Solfeggio cascades',
    duration: 10.68,
    summary: 'A short, multi-peak cascade',
    detail: 'Strongest measured peaks: about 165.5, 329.6, 418.9, 440.9, 495.1 and 660.6 Hz.',
    peaks: '≈165.5 · 329.6 · 418.9 · 440.9 · 495.1 · 660.6 Hz',
    mark: '10',
  },
  {
    id: 'mudzimu-unoyera-living-vision',
    title: 'Simba raMudzimu Unoyera · Living Vision',
    collection: 'Spiritual resonances',
    duration: 30,
    summary: 'A dedicated spiritual listening resonance.',
    detail: 'Original stereo WAV recording · 32 kHz · 16-bit PCM.',
    mark: '11',
  },
];

const filters = ['All tracks', 'Measured tones', 'Copper studies', 'Solfeggio cascades', 'Spiritual resonances'] as const;
type Filter = typeof filters[number];
const listeningIntentions: ListeningIntention[] = [
  'Open listening',
  'Prayer & spiritual connection',
  'Calm & breathing',
  'Space-clearing ritual',
  'Restoration & healing tradition',
  'Frequency exploration',
];

function formatTime(seconds: number) {
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
}

export default function ResonanceLibrary() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playRequestRef = useRef(0);
  const [filter, setFilter] = useState<Filter>('All tracks');
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(35);
  const [intention, setIntention] = useState<ListeningIntention>('Open listening');
  const [playbackState, setPlaybackState] = useState('Choose a recording when you are ready.');
  const [playbackError, setPlaybackError] = useState('');
  const [progress, setProgress] = useState(0);

  const visibleTracks = useMemo(
    () => filter === 'All tracks' ? tracks : tracks.filter(track => track.collection === filter),
    [filter],
  );
  const currentTrack = tracks.find(track => track.id === currentId) ?? null;

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.min(70, volume) / 100;
  }, [volume]);

  useEffect(() => () => {
    playRequestRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
  }, []);

  const stopPlayback = () => {
    playRequestRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      if (audio.readyState > 0) audio.currentTime = 0;
    }
    setPlaying(false);
    setProgress(0);
    setPlaybackError('');
    setPlaybackState('Playback stopped. Choose a recording when you are ready.');
  };

  const playTrack = async (track: Track) => {
    const audio = audioRef.current;
    if (!audio) return;
    const request = ++playRequestRef.current;
    setCurrentId(track.id);
    setPlaybackError('');
    setProgress(0);
    setPlaying(false);
    setPlaybackState(`Loading ${track.title}.`);
    audio.pause();
    audio.src = `/api/resonance-audio/${track.id}`;
    audio.volume = Math.min(70, volume) / 100;
    audio.load();
    try {
      await audio.play();
      if (request !== playRequestRef.current) return;
      setPlaying(true);
      setPlaybackState(`Now playing ${track.title}.`);
    } catch {
      if (request !== playRequestRef.current) return;
      setPlaying(false);
      const message = 'This recording could not be played. Check your connection and try again.';
      setPlaybackError(message);
      setPlaybackState(message);
    }
  };

  const onAudioError = () => {
    setPlaying(false);
    const message = 'This recording could not be loaded. Check your connection and try again.';
    setPlaybackError(message);
    setPlaybackState(message);
  };

  return (
    <section id="resonance-library" className="resonance-library" aria-labelledby="resonance-title">
      <audio
        ref={audioRef}
        preload="none"
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          setPlaybackState(`${currentTrack?.title ?? 'Recording'} finished.`);
        }}
        onTimeUpdate={event => {
          const audio = event.currentTarget;
          if (Number.isFinite(audio.duration) && audio.duration > 0) {
            setProgress((audio.currentTime / audio.duration) * 100);
          }
        }}
        onError={onAudioError}
        aria-hidden="true"
      />

      <header className="rl-heading">
        <div>
          <div className="rl-kicker"><span className="rl-kicker-line" /> ZionCore / Listening room</div>
          <h2 id="resonance-title">Resonance <em>library</em></h2>
          <p className="rl-intro">Measured tones and layered recordings, ready for your own kind of listening.</p>
        </div>
        <div className="rl-library-stamp" aria-label={`${tracks.length} recordings`}>
          <Waves size={17} strokeWidth={1.5} aria-hidden="true" />
          <span><strong>{tracks.length}</strong><small>recordings</small></span>
        </div>
      </header>

      <div className="rl-context">
        <span className="rl-context-icon"><AudioLines size={17} aria-hidden="true" /></span>
        <p>Some listeners bring prayer, relaxation, space-clearing rituals, healing traditions, or spiritual connection to tonal sessions. These are personal beliefs and experiences—not guaranteed results or medical treatment. <strong>Let the listening mean what you decide it means.</strong></p>
      </div>

      <div className="rl-intention">
        <div className="rl-intention-copy">
          <label htmlFor="rl-intention-select">Your listening intention</label>
          <span>Choose the meaning you bring; this does not alter the recording.</span>
        </div>
        <select
          id="rl-intention-select"
          value={intention}
          onChange={event => setIntention(event.target.value as ListeningIntention)}
        >
          {listeningIntentions.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <div className="rl-toolbar">
        <div className="rl-filter-group" role="group" aria-label="Filter recordings by collection">
          {filters.map(item => (
            <button
              className={`rl-filter ${filter === item ? 'is-selected' : ''}`}
              key={item}
              type="button"
              aria-pressed={filter === item}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="rl-volume">
          <Volume2 size={15} aria-hidden="true" />
          <label htmlFor="rl-volume-range">Volume</label>
          <input
            id="rl-volume-range"
            type="range"
            min="0"
            max="70"
            value={volume}
            onChange={event => setVolume(Math.min(70, Number(event.target.value)))}
            aria-valuetext={`${volume}%`}
          />
          <output htmlFor="rl-volume-range">{volume}%</output>
        </div>
      </div>

      <div className="rl-player" aria-label="Playback controls">
        <div className="rl-player-art" aria-hidden="true"><Radio size={22} strokeWidth={1.35} /></div>
        <div className="rl-player-copy">
          <span className="rl-player-label">{playing ? 'NOW LISTENING' : currentTrack ? 'SELECTED RECORDING' : 'YOUR LISTENING SPACE'}</span>
          <strong>{currentTrack?.title ?? 'A moment, at your pace'}</strong>
          <span className="rl-player-status" role="status" aria-live="polite">{playbackState}</span>
        </div>
        <div className="rl-progress-wrap" aria-label="Playback progress">
          <div
            className="rl-progress-track"
            role="progressbar"
            aria-label="Playback progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            aria-valuetext={`${Math.round(progress)}% played`}
          >
            <span style={{ transform: `scaleX(${progress / 100})` }} />
          </div>
          <div className="rl-progress-meta"><span>{currentTrack ? formatTime(audioRef.current?.currentTime ?? 0) : '0:00'}</span><span>{currentTrack ? formatTime(currentTrack.duration) : '—:—'}</span></div>
        </div>
        <button className="rl-stop-main" type="button" onClick={stopPlayback} aria-label="Stop playback">
          <CircleStop size={16} aria-hidden="true" /> Stop
        </button>
      </div>
      {playbackError && <p className="rl-error" role="alert">{playbackError}</p>}

      <div className="rl-list-head">
        <span>THE COLLECTION</span>
        <span>{visibleTracks.length} {visibleTracks.length === 1 ? 'recording' : 'recordings'}</span>
      </div>

      <div className="rl-track-list">
        {visibleTracks.map(track => {
          const active = currentId === track.id;
          return (
            <article className={`rl-track ${active ? 'is-active' : ''}`} key={track.id}>
              <div className="rl-track-index">{track.mark}</div>
              <div className="rl-track-wave" aria-hidden="true">
                <span /><span /><span /><span /><span /><span /><span /><span /><span />
              </div>
              <div className="rl-track-info">
                <div className="rl-track-meta">
                  <span className="rl-collection-tag">{track.collection}</span>
                  <span className="rl-duration">{track.duration.toFixed(track.duration % 1 ? 2 : 0)} sec</span>
                </div>
                <h3>{track.title}</h3>
                <p className="rl-track-summary">{track.summary}</p>
                <p className="rl-track-detail">{track.detail}</p>
                {track.peaks && <p className="rl-peaks"><span>PEAKS</span>{track.peaks}</p>}
                {track.caution && <p className="rl-track-caution"><Headphones size={13} aria-hidden="true" />{track.caution}</p>}
              </div>
              <div className="rl-track-actions">
                <button className="rl-play-button" type="button" onClick={() => void playTrack(track)} aria-label={`Play ${track.title}`}>
                  <Play size={14} fill="currentColor" aria-hidden="true" /> Play
                </button>
                <button
                  className="rl-stop-button"
                  type="button"
                  onClick={stopPlayback}
                  aria-label={`Stop playback${active ? ` of ${track.title}` : ''}`}
                  disabled={!playing && !active}
                >
                  <CircleStop size={14} aria-hidden="true" /> Stop
                </button>
              </div>
              {active && <div className="rl-active-rule" aria-hidden="true" />}
            </article>
          );
        })}
      </div>

      <footer className="rl-safety">
        <span className="rl-safety-mark" aria-hidden="true" />
        <p><strong>A gentle note.</strong> Start with low device volume and stop if anything feels uncomfortable. The 8 kHz and 18 kHz recordings can sound sharp or be inaudible depending on your hearing and playback device.</p>
      </footer>
    </section>
  );
}
