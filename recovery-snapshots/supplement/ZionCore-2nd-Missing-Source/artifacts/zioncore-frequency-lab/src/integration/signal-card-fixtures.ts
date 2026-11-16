import type { Explanation } from '../lib/ai-analysis';
import type { SignalCardCapture } from '../lib/signal-cards';

// Isolated test data only. Never imported by the production entry point.
export const fixtureReport: Explanation = {
  signalFamily: 'harmonic',
  executiveSummary: 'A sustained tone with a second harmonic, observed in a synthetic test capture.',
  integratedReading: 'SYNTHETIC_FULL_REPORT: Two related peaks support a harmonic pattern, not an identified source.',
  patternSignature: 'Stable harmonic pattern.',
  harmonicAnalysis: 'The second peak is near twice the dominant peak.',
  temporalAnalysis: 'Frequency stayed stable in this synthetic observation.',
  modulationAnalysis: 'No modulation can be established from these features.',
  domainPerspectives: ([
    'acoustics', 'signal_processing', 'mathematics', 'communications', 'environmental_bioacoustics',
  ] as const).map(domain => ({
    domain, relevance: 'tentative',
    analysis: `Synthetic ${domain} perspective.`,
    evidenceBoundary: 'Derived acoustic features do not identify a sender.',
  })),
  keyTakeaways: ['Stable tone', 'Possible harmonic relationship', 'Origin unresolved'],
  confidence: 'moderate', confidenceScope: 'Confidence applies to the measured pattern.',
  uncertainty: 'No origin or intentional message is established.',
  dataQuality: 'Synthetic values for software testing, not a real customer recording.',
  candidateExplanations: [{
    label: 'A tonal source', rationale: 'The two peaks are harmonically related.',
    evidenceFor: 'Related frequency peaks.', evidenceAgainst: 'No independent source evidence.',
    confidence: 'low', whatWouldDiscriminate: 'Compare controlled source recordings.',
  }],
  followUpExperiments: [
    { title: 'Repeat capture', method: 'Repeat equal-duration recordings.', whatToRecord: 'Frequency stability.' },
    { title: 'Compare positions', method: 'Move the microphone between positions.', whatToRecord: 'Changes in spectral peaks.' },
  ],
  reflectionQuestions: ['What stood out in the sound?', 'What meaning do you choose to explore?'],
  faithReflection: 'SYNTHETIC_PRIVATE_REFLECTION: This first paragraph is a personal reflection.\n\nA second paragraph explores possible meaning without asserting an external sender.\n\nA third paragraph leaves personal discernment with the listener.',
  provider: 'gemini', model: 'synthetic-fixture-not-a-live-provider', fallbackUsed: false,
};

export const fixtureCapture: SignalCardCapture = {
  id: 'card-synthetic-fixture', createdAt: '2026-11-07T12:00:00.000Z',
  measurement: {
    captureSource: 'audio-file', sampleRate: 48000, fftSize: 4096,
    frequencyResolutionHz: 11.71875, dominantFrequencyHz: 440,
    topPeaksHz: [440, 880], rmsLevel: 0.1, durationSeconds: 6,
  },
  listeningContext: 'SYNTHETIC_PRIVATE_CONTEXT',
  spectrumImage: null,
};
