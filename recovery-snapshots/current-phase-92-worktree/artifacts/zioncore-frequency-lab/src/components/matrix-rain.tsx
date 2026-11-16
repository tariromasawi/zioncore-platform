import { useEffect, useRef } from 'react';
import './matrix-rain.css';

type MatrixRainProps = {
  /** Set false to remove the visual layer without unmounting the surrounding shell. */
  enabled?: boolean;
};

const GLYPHS = '0123456789∿∴⌁∆·';
const FRAME_INTERVAL = 1000 / 24;

type Stream = {
  x: number;
  y: number;
  speed: number;
  length: number;
  glyphs: string[];
};

function makeStream(x: number, height: number, beginInView = false): Stream {
  const length = 3 + Math.floor(Math.random() * 7);
  return {
    x,
    y: beginInView ? Math.random() * height : -Math.random() * height,
    speed: 0.38 + Math.random() * 0.28,
    length,
    glyphs: Array.from({ length }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]),
  };
}

/**
 * A quiet, purely visual resonance field. It creates no audio and reports no
 * listening or measurement state.
 */
export default function MatrixRain({ enabled = true }: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !context || !enabled) return;

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = reducedMotionQuery.matches;
    let pageVisible = document.visibilityState !== 'hidden';
    let frameId = 0;
    let lastFrame = 0;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let streams: Stream[] = [];

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width || window.innerWidth);
      height = Math.max(1, bounds.height || window.innerHeight);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const columnGap = width < 600 ? 42 : 48;
      const count = Math.ceil(width / columnGap);
      streams = Array.from({ length: count }, (_, index) =>
        makeStream(index * columnGap + columnGap / 2, height, true),
      );
      drawStill();
    };

    const drawGlyph = (glyph: string, x: number, y: number, alpha: number, accent: boolean) => {
      context.fillStyle = accent
        ? `rgba(166, 127, 65, ${alpha})`
        : `rgba(35, 77, 77, ${alpha})`;
      context.fillText(glyph, x, y);
    };

    const drawStill = () => {
      context.clearRect(0, 0, width, height);
      context.font = '11px "DM Mono", ui-monospace, monospace';
      context.textAlign = 'center';
      streams.forEach((stream, streamIndex) => {
        const glyph = stream.glyphs[0];
        drawGlyph(glyph, stream.x, (streamIndex * 71 + 43) % Math.max(height, 1), 0.12, streamIndex % 7 === 0);
      });
    };

    const render = (timestamp: number) => {
      if (!pageVisible || reducedMotion) return;
      frameId = window.requestAnimationFrame(render);
      if (timestamp - lastFrame < FRAME_INTERVAL) return;
      lastFrame = timestamp;

      context.clearRect(0, 0, width, height);
      context.font = '11px "DM Mono", ui-monospace, monospace';
      context.textAlign = 'center';

      streams.forEach((stream, streamIndex) => {
        stream.y += stream.speed;
        if (stream.y - stream.length * 19 > height) {
          Object.assign(stream, makeStream(stream.x, height));
          return;
        }

        for (let index = 0; index < stream.length; index += 1) {
          const y = stream.y - index * 19;
          if (y < -18 || y > height + 18) continue;
          if (Math.random() < 0.018) {
            stream.glyphs[index] = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          }
          const fade = 1 - index / stream.length;
          const alpha = (0.055 + fade * 0.12) * (streamIndex % 7 === 0 ? 0.8 : 1);
          drawGlyph(stream.glyphs[index], stream.x, y, alpha, streamIndex % 7 === 0 && index === 0);
        }
      });
    };

    const stop = () => {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    };

    const syncMotion = () => {
      reducedMotion = reducedMotionQuery.matches;
      stop();
      if (reducedMotion) drawStill();
      else if (pageVisible) frameId = window.requestAnimationFrame(render);
    };

    const syncVisibility = () => {
      pageVisible = document.visibilityState !== 'hidden';
      stop();
      if (pageVisible && !reducedMotion) frameId = window.requestAnimationFrame(render);
    };

    resize();
    if (pageVisible && !reducedMotion) frameId = window.requestAnimationFrame(render);

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', syncVisibility);
    reducedMotionQuery.addEventListener('change', syncMotion);

    return () => {
      stop();
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', syncVisibility);
      reducedMotionQuery.removeEventListener('change', syncMotion);
      context.clearRect(0, 0, width, height);
    };
  }, [enabled]);

  if (!enabled) return null;

  return <canvas
    ref={canvasRef}
    className="matrix-rain"
    aria-hidden="true"
    role="presentation"
  />;
}
