import { useEffect, useRef } from 'react';
import type { TemporalSample } from '@/lib/signal-analysis';

type SpectrogramProps = {
  frames: number[][];
  revision: number;
};

function prepareCanvas(canvas: HTMLCanvasElement) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.setTransform(scale, 0, 0, scale, 0, 0);
  return { context, width, height };
}

export function Spectrogram({ frames, revision }: SpectrogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const prepared = prepareCanvas(canvas);
    if (!prepared) return;
    const { context, width, height } = prepared;
    context.fillStyle = '#203c40';
    context.fillRect(0, 0, width, height);

    const visibleFrames = frames.length <= 120
      ? frames
      : Array.from(
        { length: 120 },
        (_, index) => frames[Math.round((index * (frames.length - 1)) / 119)],
      );
    const binCount = visibleFrames[0]?.length ?? 0;
    if (!visibleFrames.length || !binCount) return;

    const frameWidth = width / visibleFrames.length;
    const binHeight = height / binCount;
    for (let frameIndex = 0; frameIndex < visibleFrames.length; frameIndex += 1) {
      const frame = visibleFrames[frameIndex];
      for (let binIndex = 0; binIndex < Math.min(binCount, frame.length); binIndex += 1) {
        const intensity = Math.max(0, Math.min(1, frame[binIndex] / 255));
        const hue = 166 - intensity * 125;
        const lightness = 16 + intensity * 48;
        context.fillStyle = `hsl(${hue} 42% ${lightness}%)`;
        context.fillRect(
          frameIndex * frameWidth,
          height - (binIndex + 1) * binHeight,
          Math.ceil(frameWidth) + 0.4,
          Math.ceil(binHeight) + 0.4,
        );
      }
    }
  }, [frames, revision]);

  return (
    <canvas
      ref={canvasRef}
      className="zc-spectrogram-canvas"
      role="img"
      aria-label={`Time-frequency spectrogram with ${frames.length} measured frames`}
      data-testid="visual-spectrogram"
    />
  );
}

export function SignalHistoryPlot({ samples }: { samples: TemporalSample[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const prepared = prepareCanvas(canvas);
    if (!prepared) return;
    const { context, width, height } = prepared;
    context.fillStyle = '#f2efe6';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = '#ded9cd';
    context.lineWidth = 1;
    for (let index = 1; index <= 3; index += 1) {
      const y = (height * index) / 4;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    if (samples.length < 2) return;

    const firstTime = samples[0].timeSeconds;
    const lastTime = samples[samples.length - 1].timeSeconds;
    const timeRange = Math.max(0.001, lastTime - firstTime);
    const frequencies = samples
      .map(sample => sample.dominantFrequencyHz)
      .filter((value): value is number => value != null && Number.isFinite(value));
    const minFrequency = frequencies.length ? Math.min(...frequencies) : 0;
    const maxFrequency = frequencies.length ? Math.max(...frequencies) : 1;
    const frequencyRange = Math.max(1, maxFrequency - minFrequency);
    const maxRms = Math.max(0.0001, ...samples.map(sample => sample.rmsLevel));
    const xFor = (sample: TemporalSample) =>
      ((sample.timeSeconds - firstTime) / timeRange) * width;

    const drawSeries = (
      color: string,
      valueFor: (sample: TemporalSample) => number | null,
    ) => {
      context.beginPath();
      let drawing = false;
      samples.forEach(sample => {
        const value = valueFor(sample);
        if (value == null || !Number.isFinite(value)) {
          drawing = false;
          return;
        }
        const x = xFor(sample);
        const y = height - 8 - Math.max(0, Math.min(1, value)) * (height - 16);
        if (!drawing) context.moveTo(x, y);
        else context.lineTo(x, y);
        drawing = true;
      });
      context.strokeStyle = color;
      context.lineWidth = 1.8;
      context.stroke();
    };

    drawSeries('#ad7d32', sample => sample.dominantFrequencyHz == null
      ? null
      : (sample.dominantFrequencyHz - minFrequency) / frequencyRange);
    drawSeries('#31816d', sample => sample.rmsLevel / maxRms);
  }, [samples]);

  return (
    <canvas
      ref={canvasRef}
      className="zc-history-plot"
      role="img"
      aria-label="Recent measured frequency and relative RMS trend"
      data-testid="visual-time-series"
    />
  );
}
