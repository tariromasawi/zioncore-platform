import { runAudioAnalysisTask, type AudioAnalysisTask } from './audio-analysis-task';

// A dedicated worker has one request and is terminated by its caller on exit.
self.onmessage = (event: MessageEvent<AudioAnalysisTask>) => {
  self.postMessage(runAudioAnalysisTask(event.data));
};
