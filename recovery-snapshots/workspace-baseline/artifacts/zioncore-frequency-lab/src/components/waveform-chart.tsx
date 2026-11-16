import { useEffect, useRef } from 'react';
import type { WaveformRange } from '@/lib/live-lab';

type Props = {
  ranges: WaveformRange[] | null;
  durationSeconds: number;
  testId?: string;
};

export default function WaveformChart({ ranges, durationSeconds, testId = 'visual-waveform' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const scale = window.devicePixelRatio || 1;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#233e43';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#426065';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = (height * i) / 5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    for (let i = 1; i <= 5; i++) {
      const x = (width * i) / 6;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    ctx.strokeStyle = '#71888a';
    ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
    ctx.strokeStyle = '#e8b257';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ranges?.length) {
      const center = height / 2;
      const amplitudeScale = height * 0.45;
      const step = width / ranges.length;
      ranges.forEach((range, index) => {
        const x = (index + 0.5) * step;
        ctx.moveTo(x, center - range.maximum * amplitudeScale);
        ctx.lineTo(x, center - range.minimum * amplitudeScale);
      });
    }
    ctx.stroke();
  }, [ranges, durationSeconds]);

  return <canvas
    className="waveform-canvas"
    ref={canvasRef}
    aria-label={`Time-domain waveform, ${(durationSeconds * 1000).toFixed(1)} milliseconds, normalized full-scale amplitude from minus one to plus one`}
    data-testid={testId}
  />;
}
