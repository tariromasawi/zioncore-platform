import {
  researchAgentRouter,
  SIGNAL_ADAPTER_IDS,
  signalAdapterRegistry,
  type CIGModality,
  type ResearchAgentInput,
  type ResearchTask,
} from '@/lib/research-grid';

const EVALUATION_TIMESTAMP = '2026-11-12T12:00:00.000Z';

type LabeledWindow = {
  dominantFrequencyHz: number | null;
  rmsLevel: number;
};

type LabeledCase = {
  id: string;
  label: string;
  windows: LabeledWindow[];
  sessionsWithObservations: number;
  expected: {
    observationCount: number;
    sessionsWithObservations: number;
    medianDominantFrequencyHz: number | null;
    meanRmsAmplitude: number | null;
    summary: string;
  };
};

const LABELED_CASES: LabeledCase[] = [
  {
    id: 'odd-frequency-set',
    label: 'Odd-count median and level mean',
    windows: [
      { dominantFrequencyHz: 100, rmsLevel: 0.1 },
      { dominantFrequencyHz: 200, rmsLevel: 0.2 },
      { dominantFrequencyHz: 1000, rmsLevel: 0.3 },
    ],
    sessionsWithObservations: 2,
    expected: {
      observationCount: 3,
      sessionsWithObservations: 2,
      medianDominantFrequencyHz: 200,
      meanRmsAmplitude: 0.2,
      summary: '3 microphone window(s) contained a dominant spectral peak. Median measured peak: 200.0 Hz.',
    },
  },
  {
    id: 'even-frequency-set',
    label: 'Even-count median interpolation',
    windows: [
      { dominantFrequencyHz: 100, rmsLevel: 0.1 },
      { dominantFrequencyHz: 200, rmsLevel: 0.3 },
      { dominantFrequencyHz: 300, rmsLevel: 0.5 },
      { dominantFrequencyHz: 400, rmsLevel: 0.7 },
    ],
    sessionsWithObservations: 1,
    expected: {
      observationCount: 4,
      sessionsWithObservations: 1,
      medianDominantFrequencyHz: 250,
      meanRmsAmplitude: 0.4,
      summary: '4 microphone window(s) contained a dominant spectral peak. Median measured peak: 250.0 Hz.',
    },
  },
  {
    id: 'no-dominant-peaks',
    label: 'Missing peak stays unknown',
    windows: [
      { dominantFrequencyHz: null, rmsLevel: 0.2 },
      { dominantFrequencyHz: null, rmsLevel: 0.4 },
    ],
    sessionsWithObservations: 2,
    expected: {
      observationCount: 2,
      sessionsWithObservations: 2,
      medianDominantFrequencyHz: null,
      meanRmsAmplitude: 0.3,
      summary: 'Microphone windows were recorded, but no dominant peak cleared the instrument threshold.',
    },
  },
  {
    id: 'empty-measurement-set',
    label: 'Empty input remains empty',
    windows: [],
    sessionsWithObservations: 0,
    expected: {
      observationCount: 0,
      sessionsWithObservations: 0,
      medianDominantFrequencyHz: null,
      meanRmsAmplitude: null,
      summary: 'Microphone windows were recorded, but no dominant peak cleared the instrument threshold.',
    },
  },
];

const REQUIRED_LIMITATIONS = [
  'These measurements describe sound pressure at the microphone.',
  'They do not identify a source or establish that a communication response occurred.',
];

const closeEnough = (actual: number | null | undefined, expected: number | null) =>
  expected === null
    ? actual === null
    : typeof actual === 'number' && Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-9;

function makeInput(testCase: LabeledCase): ResearchAgentInput {
  const observations = testCase.windows.map((window, index) => {
    const caseIndex = Math.max(0, LABELED_CASES.findIndex(item => item.id === testCase.id));
    const sequence = caseIndex * 100 + index + 1;
    const id = `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
    return signalAdapterRegistry.normalize(SIGNAL_ADAPTER_IDS.browserAcoustic, {
      id,
      instrumentId: 'fixture.local-agent-evaluation',
      window: {
        startedAt: EVALUATION_TIMESTAMP,
        endedAt: EVALUATION_TIMESTAMP,
        durationSeconds: 2,
      },
      sampleRateHz: 48000,
      fftSize: 2048,
      frequencyResolutionHz: 48000 / 2048,
      dominantFrequencyHz: window.dominantFrequencyHz,
      topPeaksHz: window.dominantFrequencyHz === null ? [] : [window.dominantFrequencyHz],
      rmsLevel: window.rmsLevel,
    });
  });

  return {
    observations,
    sessionsWithObservations: testCase.sessionsWithObservations,
  };
}

function compareCase(testCase: LabeledCase, agentRouter: typeof researchAgentRouter) {
  const result = agentRouter.executeSync({
    task: 'descriptive-summary',
    modalities: ['acoustic'],
    maxCostUsd: 0,
    consentGranted: false,
  }, makeInput(testCase));

  if (!result) {
    const checks = [
      {
        label: 'Selected implementation',
        expected: 'deterministic browser agent',
        actual: 'no eligible agent',
        passed: false,
      },
      ...[
        ['observation-count', `${testCase.expected.observationCount} windows`],
        ['sessions-with-observations', `${testCase.expected.sessionsWithObservations} sessions`],
        ['median-dominant-frequency', `${testCase.expected.medianDominantFrequencyHz ?? 'null'} Hz`],
        ['mean-rms-amplitude', `${testCase.expected.meanRmsAmplitude ?? 'null'} full-scale-fraction`],
        ['Labeled summary', testCase.expected.summary],
        ...REQUIRED_LIMITATIONS.map(limitation => ['Required limitation', limitation]),
      ].map(([label, expected]) => ({
        label: String(label),
        expected: String(expected),
        actual: 'unavailable',
        passed: false,
      })),
    ];
    return {
      id: testCase.id,
      label: testCase.label,
      passedChecks: checks.filter(check => check.passed).length,
      totalChecks: checks.length,
      checks,
      agentId: null,
      declaredCostUsd: null,
    };
  }

  const metricValues = new Map(result.output.metrics.map(metric => [metric.name, metric]));
  const checkMetric = (name: string, expected: number | null, unit: string) => {
    const metric = metricValues.get(name);
    const actual = metric?.value;
    const passed = metric?.unit === unit && closeEnough(actual, expected);
    return {
      label: name,
      expected: expected === null ? `null ${unit}` : `${expected} ${unit}`,
      actual: metric ? `${metric.value ?? 'null'} ${metric.unit}` : 'missing',
      passed,
    };
  };
  const checks = [
    {
      label: 'Selected implementation',
      expected: 'deterministic browser agent',
      actual: `${result.agent.kind} ${result.agent.provider}`,
      passed: result.agent.kind === 'deterministic' && result.agent.provider === 'browser',
    },
    checkMetric('observation-count', testCase.expected.observationCount, 'windows'),
    checkMetric('sessions-with-observations', testCase.expected.sessionsWithObservations, 'sessions'),
    checkMetric('median-dominant-frequency', testCase.expected.medianDominantFrequencyHz, 'Hz'),
    checkMetric('mean-rms-amplitude', testCase.expected.meanRmsAmplitude, 'full-scale-fraction'),
    {
      label: 'Labeled summary',
      expected: testCase.expected.summary,
      actual: result.output.summary,
      passed: result.output.summary === testCase.expected.summary,
    },
    ...REQUIRED_LIMITATIONS.map(limitation => ({
      label: 'Required limitation',
      expected: limitation,
      actual: result.output.limitations.includes(limitation) ? limitation : 'missing',
      passed: result.output.limitations.includes(limitation),
    })),
  ];
  return {
    id: testCase.id,
    label: testCase.label,
    passedChecks: checks.filter(check => check.passed).length,
    totalChecks: checks.length,
    checks,
    agentId: result.agent.id,
    declaredCostUsd: result.agent.estimatedCostUsd,
  };
}

type RefusalOutcome = 'not-routed' | 'schema-rejected' | 'unexpectedly-accepted';

function checkRefusal(
  id: string,
  label: string,
  expected: Exclude<RefusalOutcome, 'unexpectedly-accepted'>,
  attempt: () => unknown,
) {
  let actual: RefusalOutcome;
  try {
    actual = attempt() === null ? 'not-routed' : 'unexpectedly-accepted';
  } catch {
    actual = 'schema-rejected';
  }
  return { id, label, expected, actual, passed: actual === expected };
}

function evaluateRefusals(agentRouter: typeof researchAgentRouter) {
  const emptyInput: ResearchAgentInput = { observations: [], sessionsWithObservations: 0 };
  const malformedInput = {
    observations: [],
    sessionsWithObservations: 0,
    personalText: 'evaluation fixture must be rejected',
  } as unknown as ResearchAgentInput;

  const overLimitInput: ResearchAgentInput = {
    observations: Array.from({ length: 31 }, (_, index) => makeInput({
      id: 'over-limit-fixture',
      label: 'over limit',
      windows: [{ dominantFrequencyHz: 100 + index, rmsLevel: 0.1 }],
      sessionsWithObservations: 1,
      expected: {
        observationCount: 1,
        sessionsWithObservations: 1,
        medianDominantFrequencyHz: 100 + index,
        meanRmsAmplitude: 0.1,
        summary: '',
      },
    }).observations[0]!)
    ,
    sessionsWithObservations: 1,
  };

  return [
    checkRefusal('unsupported-task', 'Unregistered multimodal task is not routed', 'not-routed', () =>
      agentRouter.executeSync({
        task: 'multimodal-interpretation' satisfies ResearchTask,
        modalities: ['acoustic'] satisfies CIGModality[],
        maxCostUsd: 0,
      }, emptyInput)),
    checkRefusal('unsupported-modality', 'Biological-acoustic request is not routed to the acoustic-only agent', 'not-routed', () =>
      agentRouter.executeSync({
        task: 'descriptive-summary',
        modalities: ['biological-acoustic'] satisfies CIGModality[],
        maxCostUsd: 0,
      }, emptyInput)),
    checkRefusal('unexpected-content-field', 'Unexpected personal-text field is rejected by the input schema', 'schema-rejected', () =>
      agentRouter.executeSync({
        task: 'descriptive-summary',
        modalities: ['acoustic'],
        maxCostUsd: 0,
      }, malformedInput)),
    checkRefusal('input-observation-limit', 'Input above the observation ceiling is rejected', 'schema-rejected', () =>
      agentRouter.executeSync({
        task: 'descriptive-summary',
        modalities: ['acoustic'],
        maxCostUsd: 0,
      }, overLimitInput)),
  ];
}

export type ResearchAgentEvaluationReport = {
  generatedAt: string;
  evaluationScope: 'deterministic-browser-only';
  evaluatedAgentIds: string[];
  labeledCases: Array<{
    id: string;
    label: string;
    passedChecks: number;
    totalChecks: number;
    checks: Array<{ label: string; expected: string; actual: string; passed: boolean }>;
    agentId: string | null;
    declaredCostUsd: number | null;
  }>;
  refusalChecks: Array<{
    id: string;
    label: string;
    expected: string;
    actual: string;
    passed: boolean;
  }>;
  reliability: { passedChecks: number; totalChecks: number; rate: number };
  refusalQuality: { passedChecks: number; totalChecks: number; rate: number };
  regression: { failedCases: number; totalCases: number; rate: number; historicalComparison: false };
  calibration: {
    status: 'not-applicable';
    reason: string;
  };
  cost: {
    declaredEstimateUsd: number | null;
    actualProviderSpendMeasured: false;
    note: string;
  };
  boundaries: string[];
};

export function runResearchAgentEvaluation(
  agentRouter: typeof researchAgentRouter = researchAgentRouter,
): ResearchAgentEvaluationReport {
  const labeledCases = LABELED_CASES.map(testCase => compareCase(testCase, agentRouter));
  const refusalChecks = evaluateRefusals(agentRouter);
  const passedChecks = labeledCases.reduce((total, item) => total + item.passedChecks, 0);
  const totalChecks = labeledCases.reduce((total, item) => total + item.totalChecks, 0);
  const passedRefusals = refusalChecks.filter(item => item.passed).length;
  const failedCases = labeledCases.filter(item => item.passedChecks !== item.totalChecks).length;
  const evaluatedAgentIds = [...new Set(labeledCases.flatMap(item => item.agentId ? [item.agentId] : []))];
  const declaredCosts = labeledCases.flatMap(item => item.declaredCostUsd == null ? [] : [item.declaredCostUsd]);
  const uniqueCosts = [...new Set(declaredCosts)];

  return {
    generatedAt: new Date().toISOString(),
    evaluationScope: 'deterministic-browser-only',
    evaluatedAgentIds,
    labeledCases,
    refusalChecks,
    reliability: {
      passedChecks,
      totalChecks,
      rate: totalChecks === 0 ? 0 : passedChecks / totalChecks,
    },
    refusalQuality: {
      passedChecks: passedRefusals,
      totalChecks: refusalChecks.length,
      rate: refusalChecks.length === 0 ? 0 : passedRefusals / refusalChecks.length,
    },
    regression: {
      failedCases,
      totalCases: labeledCases.length,
      rate: labeledCases.length === 0 ? 0 : failedCases / labeledCases.length,
      historicalComparison: false,
    },
    calibration: {
      status: 'not-applicable',
      reason: 'The active deterministic agent emits no confidence probabilities, and no empirical labeled outcome corpus is available.',
    },
    cost: {
      declaredEstimateUsd: uniqueCosts.length === 1 ? uniqueCosts[0]! : null,
      actualProviderSpendMeasured: false,
      note: 'This is the router-declared estimate only; the harness makes no provider call and has no billing-meter access.',
    },
    boundaries: [
      'These are fixed, code-authored arithmetic fixtures, not field-performance or external communication tests.',
      'The refusal suite checks routing and schema boundaries, not expert judgment about ambiguous real-world cases.',
      'Calibration is not measured because this agent emits no probability or confidence score.',
      'A zero declared estimate is not a verified project billing statement.',
      'The regression rate is this run’s failed labeled cases; no historical release baseline is compared.',
      'Only the deterministic browser-local agent is evaluated. No AI model, external network, user history, or customer data is used.',
    ],
  };
}
