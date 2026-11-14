import { analyzeAudioChannels, type ImportedAudioAnalysis } from './audio-file-analysis';

export type AudioAnalysisTask = { channels: Float32Array[]; sampleRate: number; fftSize: number };
export type AudioAnalysisReply =
  | { ok: true; result: ImportedAudioAnalysis }
  | { ok: false; error: string };

export function runAudioAnalysisTask(task: AudioAnalysisTask): AudioAnalysisReply {
  try {
    return { ok: true, result: analyzeAudioChannels(task.channels, task.sampleRate, task.fftSize) };
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : 'Audio analysis could not complete.' };
  }
}
