import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { resonanceVisuals, resonanceVisualUrl, type ResonanceVisual } from '@/lib/resonance-visuals';
import { getConstellationFrame, shuffleArtwork } from '@/lib/resonance-choreography';
import './resonance-matrix-gallery.css';

const PAUSE_KEY = 'zioncore-constellation-paused';
const TOTAL = resonanceVisuals.length;

type Phase = ReturnType<typeof getConstellationFrame>['phase'];

type ConstellationValue = {
  order: ResonanceVisual[];
  arrangement: number;
  phase: Phase;
  playing: boolean;
  paused: boolean;
  reducedMotion: boolean;
  reshuffle: () => void;
  togglePause: () => void;
};

const ConstellationContext = createContext<ConstellationValue | null>(null);

function useConstellation() {
  const value = useContext(ConstellationContext);
  if (!value) throw new Error('Constellation components must be inside ConstellationProvider');
  return value;
}

function readPaused() {
  try { return window.localStorage.getItem(PAUSE_KEY) === 'paused'; } catch { return false; }
}

function readReduced() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function ConstellationProvider({ children }: { children: ReactNode }) {
  const [order, setOrder] = useState<ResonanceVisual[]>(() => shuffleArtwork(resonanceVisuals));
  const [arrangement, setArrangement] = useState(1);
  const [paused, setPaused] = useState(readPaused);
  const [reducedMotion, setReducedMotion] = useState(readReduced);
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const elapsedRef = useRef(0);
  const [phase, setPhase] = useState<Phase>(() => getConstellationFrame(0).phase);
  const lastStepRef = useRef(0);

  const playing = !paused && !reducedMotion && !hidden;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMedia = () => setReducedMotion(media.matches);
    const onVisibility = () => setHidden(document.hidden);
    media.addEventListener('change', onMedia);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      media.removeEventListener('change', onMedia);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(PAUSE_KEY, paused ? 'paused' : 'playing'); } catch { /* session only */ }
  }, [paused]);

  useEffect(() => {
    if (!playing) return;
    const base = elapsedRef.current;
    const startedAt = performance.now();
    let timer = 0;
    const elapsedNow = () => base + (performance.now() - startedAt);
    const tick = () => {
      const elapsed = elapsedNow();
      elapsedRef.current = elapsed;
      const frame = getConstellationFrame(elapsed);
      setPhase(current => (current.id === frame.phase.id ? current : frame.phase));
      if (frame.step !== lastStepRef.current) {
        lastStepRef.current = frame.step;
        setOrder(current => shuffleArtwork(current));
        setArrangement(current => current + 1);
      }
      timer = window.setTimeout(tick, Math.max(50, frame.nextInMs));
    };
    const first = getConstellationFrame(base);
    setPhase(first.phase);
    lastStepRef.current = first.step;
    timer = window.setTimeout(tick, Math.max(50, first.nextInMs));
    return () => {
      window.clearTimeout(timer);
      elapsedRef.current = elapsedNow();
    };
  }, [playing]);

  const reshuffle = useCallback(() => {
    setOrder(current => shuffleArtwork(current));
    setArrangement(current => current + 1);
  }, []);
  const togglePause = useCallback(() => setPaused(value => !value), []);

  const value = useMemo<ConstellationValue>(
    () => ({ order, arrangement, phase, playing, paused, reducedMotion, reshuffle, togglePause }),
    [order, arrangement, phase, playing, paused, reducedMotion, reshuffle, togglePause],
  );

  return <ConstellationContext.Provider value={value}>{children}</ConstellationContext.Provider>;
}

/** Keep a pause control available before the first artwork comes into view. */
export function ConstellationMotionControl() {
  const { paused, reducedMotion, togglePause } = useConstellation();
  return <button
    className="nav-link matrix-toggle constellation-motion-toggle"
    type="button"
    onClick={togglePause}
    disabled={reducedMotion}
    aria-pressed={!paused && !reducedMotion}
    aria-label={reducedMotion ? 'Artwork motion off: reduced motion enabled' : `${paused ? 'Resume' : 'Pause'} artwork motion`}
    title={reducedMotion ? 'Your system prefers reduced motion; manual reshuffling remains available.' : 'Pause or resume the distributed constellation'}
    data-testid="button-artwork-motion-toggle"
  >Art {paused || reducedMotion ? 'still' : 'moving'}</button>;
}

/* Deterministic per-slot framing: modest angles, varied scale, no randomness per render. */
const SLOT_TILTS = [-1.6, 1.1, -0.6, 1.8, -1.2, 0.7, -1.9, 1.4, -0.4, 1.0, -1.4, 0.5, 1.7, -0.9, 1.2, -1.7, 0.8, -0.5, 1.5];

function ArtFrame({ visual, slot, featured }: { visual: ResonanceVisual; slot: number; featured: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure
      className={`constellation-slot${featured ? ' constellation-slot--featured' : ''}`}
      style={{ '--slot-tilt': `${SLOT_TILTS[slot % SLOT_TILTS.length]}deg` } as CSSProperties}
      data-testid={`slot-constellation-${slot}`}
    >
      <span className="constellation-slot__coord" aria-hidden="true">
        S{String(slot + 1).padStart(2, '0')} / {String(TOTAL).padStart(2, '0')}
      </span>
      <div className="constellation-slot__frame">
        <i className="constellation-slot__tick constellation-slot__tick--tl" aria-hidden="true" />
        <i className="constellation-slot__tick constellation-slot__tick--br" aria-hidden="true" />
        <div className="constellation-slot__stage" key={visual.id}>
          {failed ? (
            <div className="constellation-slot__failed" role="img" aria-label={`${visual.title} could not load. ${visual.alt}`}>
              <span>IMAGE UNAVAILABLE</span>
              <b>{visual.title}</b>
            </div>
          ) : (
            <img
              src={resonanceVisualUrl(visual.id)}
              alt={visual.alt}
              width={1024}
              height={1024}
              loading="lazy"
              decoding="async"
              draggable={false}
              onError={() => setFailed(true)}
              data-testid={`img-resonance-visual-${visual.id}`}
            />
          )}
        </div>
      </div>
      <figcaption>{visual.title}</figcaption>
    </figure>
  );
}

function SlotHost({ slot, featured }: { slot: number; featured: boolean }) {
  const { order } = useConstellation();
  const visual = order[slot];
  if (!visual) return null;
  /* key on image identity so a failed state belongs to the image, not the slot */
  return <ArtFrame key={visual.id} visual={visual} slot={slot} featured={featured} />;
}

type InterludeProps = {
  start: number;
  count: number;
  label: string;
  variant?: 'orbit' | 'drift' | 'lattice';
};

export function ConstellationInterlude({ start, count, label, variant = 'orbit' }: InterludeProps) {
  const { phase, playing } = useConstellation();
  const slots = Array.from({ length: Math.max(0, Math.min(count, TOTAL - start)) }, (_, i) => start + i);
  return (
    <aside
      id={`constellation-field-${start}`}
      className={`constellation-interlude constellation-interlude--${variant}`}
      aria-label={`${label}: artwork from the constellation`}
      data-testid={`interlude-constellation-${start}`}
    >
      <div className="constellation-interlude__rail" aria-hidden="true">
        <span>{label.toUpperCase()}</span>
        <i />
        <span>{playing ? phase.name.toUpperCase() : 'STILL'}</span>
      </div>
      <div className="constellation-interlude__field" role="list">
        {slots.map((slot, i) => (
          <div role="listitem" key={slot} className="constellation-interlude__cell">
            <SlotHost slot={slot} featured={variant !== 'lattice' && i === (start % 2 === 0 ? 1 : 0)} />
          </div>
        ))}
      </div>
    </aside>
  );
}

function cadenceText(phase: Phase, playing: boolean, reducedMotion: boolean, paused: boolean) {
  if (reducedMotion) return 'Reduced motion: automatic movement off';
  if (paused) return 'Paused by you';
  if (!playing) return 'Waiting while this tab is hidden';
  if (phase.intervalMs == null) return `Calm hold for ${Math.round(phase.durationMs / 1000)} seconds`;
  return `Every ${phase.intervalMs / 1000} seconds for ${Math.round(phase.durationMs / 1000)} seconds`;
}

export default function ResonanceMatrixGallery() {
  const { arrangement, phase, playing, paused, reducedMotion, reshuffle, togglePause } = useConstellation();
  const cadence = cadenceText(phase, playing, reducedMotion, paused);
  const finalStart = 15;

  return (
    <section id="resonance-gallery" className="resonance-gallery" aria-labelledby="resonance-gallery-title">
      <div className="resonance-gallery__header">
        <div className="resonance-gallery__heading">
          <span className="resonance-gallery__eyebrow">FIELD ATLAS <i aria-hidden="true" /></span>
          <h2 id="resonance-gallery-title">A constellation of forms</h2>
          <p>
            Nineteen original works travel through this page, each shown whole in its own
            reserved place. They exchange positions on a shared, varied loop—a visual
            meditation on connection, geometry, and light, with room for each work to breathe.
          </p>
        </div>
        <div className="resonance-gallery__tools">
          <div className="resonance-gallery__phase" data-testid="status-constellation-phase">
            <span>MOVEMENT</span>
            <b>{reducedMotion || paused ? 'Still' : phase.name}</b>
            <small>{cadence}</small>
          </div>
          <div className="resonance-gallery__buttons">
            <button
              className="resonance-gallery__shuffle"
              type="button"
              onClick={togglePause}
              disabled={reducedMotion}
              aria-pressed={paused}
              title={reducedMotion ? 'Automatic movement is off because your system prefers reduced motion' : undefined}
              data-testid="button-toggle-constellation-autoplay"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                {paused || reducedMotion ? <path d="M6.5 4.5v11l9-5.5z" /> : <path d="M7 4.5v11M13 4.5v11" />}
              </svg>
              <span>{paused || reducedMotion ? 'Resume movement' : 'Pause movement'}</span>
            </button>
            <button
              className="resonance-gallery__shuffle"
              type="button"
              onClick={reshuffle}
              aria-label="Reshuffle artwork arrangement"
              data-testid="button-reshuffle-resonance-gallery"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M15.7 5.2h-2.1a3 3 0 0 0-2.4 1.2l-4.4 6.2a3 3 0 0 1-2.4 1.2H3.5M14 3.5l1.8 1.7L14 7M3.5 6.2h.9a3 3 0 0 1 2.4 1.2l4.4 6.2a3 3 0 0 0 2.4 1.2h2.1M14 12.9l1.8 1.7-1.8 1.8" />
              </svg>
              <span>Reshuffle</span>
            </button>
          </div>
        </div>
      </div>

      <div className="resonance-gallery__matrix" role="list" aria-label="Final constellation positions" data-testid="gallery-resonance-matrix">
        {Array.from({ length: TOTAL - finalStart }, (_, i) => finalStart + i).map((slot, i) => (
          <div role="listitem" key={slot} className="constellation-interlude__cell">
            <SlotHost slot={slot} featured={i === 1} />
          </div>
        ))}
      </div>

      <div className="resonance-gallery__footer">
        <span>{String(TOTAL).padStart(2, '0')} COMPLETE COMPOSITIONS · DISTRIBUTED ACROSS THE LAB</span>
        <span data-testid="text-constellation-arrangement">ARRANGEMENT {String(arrangement).padStart(2, '0')}</span>
      </div>
    </section>
  );
}
