import { useEffect, useRef, useState } from 'react';
import { Square, Volume2 } from 'lucide-react';

const minimumFrequencyHz = 100;
const maximumFrequencyHz = 8_000;
const maximumDurationSeconds = 5;
const cappedGain = 0.12;

export default function ReferenceToneControls() {
  const [frequencyHz, setFrequencyHz] = useState(440);
  const [durationSeconds, setDurationSeconds] = useState(3);
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const requestRef = useRef(0);
  const [status, setStatus] = useState('');
  const contextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const stopTimerRef = useRef<number | null>(null);

  const stopTone = () => {
    requestRef.current += 1;
    setStarting(false);
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    const context = contextRef.current;
    const oscillator = oscillatorRef.current;
    const gain = gainRef.current;
    if (context && oscillator && gain && context.state !== 'closed') {
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.04);
      try { oscillator.stop(now + 0.05); } catch { /* already stopped */ }
    }
    oscillatorRef.current = null;
    gainRef.current = null;
    contextRef.current = null;
    if (context && context.state !== 'closed') {
      window.setTimeout(() => { void context.close().catch(() => undefined); }, 80);
    }
    setPlaying(false);
  };

  const playTone = async () => {
    if (typeof AudioContext === 'undefined') {
      setStatus('Reference tone playback is not supported by this browser.');
      return;
    }
    stopTone();
    const request = ++requestRef.current;
    setStarting(true);
    setStatus('Preparing reference tone…');
    let context: AudioContext | null = null;
    try {
      const activeContext = new AudioContext();
      context = activeContext;
      contextRef.current = activeContext;
      await activeContext.resume();
      if (request !== requestRef.current) {
        if (activeContext.state !== 'closed') void activeContext.close().catch(() => undefined);
        return;
      }
      const oscillator = activeContext.createOscillator();
      const gain = activeContext.createGain();
      const now = activeContext.currentTime;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(
        Math.max(minimumFrequencyHz, Math.min(maximumFrequencyHz, frequencyHz)),
        now,
      );
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(cappedGain, now + 0.04);
      gain.gain.setValueAtTime(
        cappedGain,
        now + Math.max(0.05, durationSeconds - 0.05),
      );
      gain.gain.linearRampToValueAtTime(0, now + durationSeconds);
      oscillator.connect(gain);
      gain.connect(activeContext.destination);
      contextRef.current = activeContext;
      oscillatorRef.current = oscillator;
      gainRef.current = gain;
      oscillator.onended = () => {
        if (oscillatorRef.current !== oscillator) return;
        oscillatorRef.current = null;
        gainRef.current = null;
        contextRef.current = null;
        if (activeContext.state !== 'closed') void activeContext.close().catch(() => undefined);
        setPlaying(false);
        setStatus('Reference tone finished.');
      };
      oscillator.start();
      oscillator.stop(now + durationSeconds + 0.02);
      setPlaying(true);
      setStatus(`Playing ${frequencyHz.toLocaleString()} Hz for ${durationSeconds} seconds.`);
      stopTimerRef.current = window.setTimeout(
        () => {
          if (contextRef.current === activeContext) {
            oscillatorRef.current = null;
            gainRef.current = null;
            contextRef.current = null;
            setPlaying(false);
            setStatus('Reference tone finished.');
            if (activeContext.state !== 'closed') void activeContext.close().catch(() => undefined);
          }
        },
        (durationSeconds + 0.15) * 1_000,
      );
    } catch (error) {
      if (request !== requestRef.current) return;
      stopTone();
      if (context && context.state !== 'closed') {
        void context.close().catch(() => undefined);
      }
      setStatus(error instanceof Error
        ? `Could not play this reference tone: ${error.message}`
        : 'Could not play this reference tone.');
    } finally {
      if (request === requestRef.current) setStarting(false);
    }
  };

  useEffect(() => () => {
    requestRef.current += 1;
    if (stopTimerRef.current !== null) window.clearTimeout(stopTimerRef.current);
    const oscillator = oscillatorRef.current;
    const context = contextRef.current;
    try { oscillator?.stop(); } catch { /* already stopped */ }
    if (context && context.state !== 'closed') void context.close().catch(() => undefined);
  }, []);

  return (
    <section className="zc-reference-tone" aria-labelledby="reference-tone-heading">
      <div className="zc-reference-tone-heading">
        <strong id="reference-tone-heading">Reference tone lab</strong>
        <span>Local speaker output</span>
      </div>
      <label className="label-row" htmlFor="reference-tone-frequency">
        <span>Frequency</span>
        <span className="mono" data-testid="text-reference-frequency">{frequencyHz.toLocaleString()} Hz</span>
      </label>
      <input
        id="reference-tone-frequency"
        className="zc-tone-range"
        type="range"
        min={minimumFrequencyHz}
        max={maximumFrequencyHz}
        step="1"
        value={frequencyHz}
        disabled={playing || starting}
        onChange={event => setFrequencyHz(Number(event.target.value))}
        data-testid="input-reference-frequency"
      />
      <div className="zc-tone-presets" role="group" aria-label="Popular frequency presets">
        <span>Quick presets</span>
        {[432, 440, 528].map(preset => (
          <button
            key={preset}
            type="button"
            className="zc-tone-preset"
            aria-pressed={frequencyHz === preset}
            disabled={playing || starting}
            onClick={() => setFrequencyHz(preset)}
            data-testid={`button-tone-preset-${preset}`}
          >
            {preset} Hz
          </button>
        ))}
      </div>
      <label className="label-row" htmlFor="reference-tone-duration">
        <span>Duration</span>
        <span className="small-note">up to {maximumDurationSeconds} seconds</span>
      </label>
      <select
        id="reference-tone-duration"
        className="select-control"
        value={durationSeconds}
        disabled={playing || starting}
        onChange={event => setDurationSeconds(Number(event.target.value))}
        data-testid="select-reference-duration"
      >
        <option value={1}>1 second</option>
        <option value={3}>3 seconds</option>
        <option value={5}>5 seconds</option>
      </select>
      {playing || starting ? (
        <button
          className="btn btn-stop"
          type="button"
          onClick={() => { stopTone(); setStatus('Reference tone stopped.'); }}
          data-testid="button-stop-reference-tone"
        >
          <Square size={14} fill="currentColor" />{starting ? 'Cancel tone' : 'Stop tone'}
        </button>
      ) : (
        <button
          className="btn btn-subtle zc-reference-play"
          type="button"
          onClick={() => void playTone()}
          data-testid="button-play-reference-tone"
        >
          <Volume2 size={14} />Play reference tone
        </button>
      )}
      {status && <p className="permission-note" role="status" data-testid="status-reference-tone">{status}</p>}
      <p className="permission-note">
        The generated sine tone is for a user-directed comparison experiment, not a calibrated signal source. App output gain is capped; your device volume still applies.
      </p>
    </section>
  );
}
