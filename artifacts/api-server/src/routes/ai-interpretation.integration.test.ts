import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, test } from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import express, { type RequestHandler } from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { AnalysisMeasurement } from '@workspace/frequency-ai-contract';
import { createAiInterpretationJobStore } from '../lib/ai-interpretation-jobs';
import { createCreditLedger } from '../lib/credit-ledger';
import { assertLocalFirestoreEmulator } from '../test-utils/firestore-emulator';
import { createAiInterpretationRouter } from './ai-interpretation';

assertLocalFirestoreEmulator(process.env.FIRESTORE_EMULATOR_HOST);

const firebaseApp = initializeApp(
  { projectId: 'demo-zioncore-frequency-lab' },
  `ai-route-accounting-${process.pid}`,
);
const db = getFirestore(firebaseApp);

after(async () => {
  await deleteApp(firebaseApp);
});

const environment = {
  SESSION_SECRET: 'route-integration-only-secret-at-least-32-bytes',
  ZIONCORE_AI_PRICING_APPROVED: 'true',
  ZIONCORE_AI_PRICING_VERSION: 'route-integration-v1',
  ZIONCORE_AI_INTERPRETATION_CREDITS: '35',
  ZIONCORE_AI_SPIRITUAL_INTERPRETATION_CREDITS: '60',
} as NodeJS.ProcessEnv;

const measurement: AnalysisMeasurement = {
  captureSource: 'microphone',
  sampleRate: 48_000,
  fftSize: 4096,
  frequencyResolutionHz: 48_000 / 4096,
  dominantFrequencyHz: 440.625,
  topPeaksHz: [440.625, 880.5],
  rmsLevel: 0.12,
  durationSeconds: 8.4,
  signalFeatures: {
    spectralCentroidHz: 620,
    spectralFlatness: 0.12,
    spectralEntropy: 0.34,
    peakToMedianContrastDb: 28.4,
    rolloff85Hz: 1800,
    harmonicity: 0.81,
    zeroCrossingRate: 0.018,
    dominantFrequencyStabilityHz: 1.4,
    dominantFrequencyDriftHz: 2.1,
    amplitudeVariationCoefficient: 0.08,
    temporalWindowSeconds: 5,
  },
  spectralMatrixAnalysis: {
    status: 'sufficient',
    frameCount: 8,
    bandLabels: ['0–4.8 kHz', '4.8–9.6 kHz', '9.6–14.4 kHz', '14.4–19.2 kHz', '19.2–24 kHz'],
    correlationMatrix: [
      [1, 0.72, -0.31, 0.08, -0.1],
      [0.72, 1, -0.12, 0.1, 0.04],
      [-0.31, -0.12, 1, -0.22, 0.13],
      [0.08, 0.1, -0.22, 1, 0.5],
      [-0.1, 0.04, 0.13, 0.5, 1],
    ],
    principalDirection: [0.62, 0.58, -0.36, 0.27, 0.28],
    principalVarianceShare: 0.48,
  },
};

const report = {
  signalFamily: 'harmonic',
  executiveSummary: 'The supplied measurements show a narrow tonal pattern and a second peak near a simple harmonic relationship.',
  integratedReading: 'The measured pattern is compatible with a harmonic signal. The available features describe sound structure; they do not identify its source or establish an intentional message.',
  patternSignature: 'A stable lower peak with a related upper peak.',
  harmonicAnalysis: 'The upper peak lies near twice the dominant measured frequency within the available bin resolution.',
  temporalAnalysis: 'The supplied summary reports a stable dominant frequency over its sampled interval.',
  modulationAnalysis: 'The available summary does not establish a modulation scheme.',
  domainPerspectives: [
    'acoustics',
    'signal_processing',
    'mathematics',
    'communications',
    'environmental_bioacoustics',
  ].map(domain => ({
    domain,
    relevance: 'tentative',
    analysis: `The ${domain.replaceAll('_', ' ')} perspective describes the supplied measurements only.`,
    evidenceBoundary: 'Derived features do not identify a source, sender, or intent.',
  })),
  keyTakeaways: [
    'A tonal pattern is present in the supplied measurements.',
    'The upper peak is near a harmonic relation.',
    'The source remains unidentified.',
  ],
  confidence: 'moderate',
  confidenceScope: 'Confidence applies to the measured pattern only; source and intent remain unknown.',
  uncertainty: 'The available measurements do not identify the source or establish a message.',
  dataQuality: 'This request contains a structured signal summary for a route integration test.',
  candidateExplanations: [{
    label: 'A tonal source',
    rationale: 'A dominant peak and related upper peak appear in the supplied summary.',
    evidenceFor: 'The measured peaks are near a simple harmonic relationship.',
    evidenceAgainst: 'No source recording or independent reference is included.',
    confidence: 'low',
    whatWouldDiscriminate: 'Compare repeat measurements with controlled reference sources.',
  }],
  followUpExperiments: [
    { title: 'Repeat the capture', method: 'Repeat with the same device and settings.', whatToRecord: 'Peak locations and stability.' },
    { title: 'Compare conditions', method: 'Change one capture condition at a time.', whatToRecord: 'Which measured features change.' },
  ],
  reflectionQuestions: [
    'Which part of this measured pattern stands out to you?',
    'What comparison would help you explore it further?',
  ],
  faithReflection: null,
};

const requestBody = {
  measurement,
  includeFaithReflection: false,
  listeningContext: '',
};

async function withServer(
  identityMiddleware: RequestHandler,
  run: (baseUrl: string) => Promise<void>,
) {
  const app = express();
  app.use(pinoHttp({ logger: pino({ level: 'silent' }) }));
  app.use(express.json());
  app.use(createAiInterpretationRouter({
    identityMiddleware,
    environment,
    ledgerProvider: () => routeLedger,
    jobStoreProvider: () => createAiInterpretationJobStore(db),
    providerFactory,
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}

const baseLedger = createCreditLedger(db, 'test');
const providerCalls = new Map<string, number>();
const failingProviderUids = new Set<string>();
const routeLedger = {
  ...baseLedger,
  async settleReservation(uid: string, input: Parameters<typeof baseLedger.settleReservation>[1]) {
    const key = input.operationId.slice('ai-'.length);
    const jobHash = createHash('sha256').update(`${uid}:${key}`).digest('hex');
    const job = await db.doc(`users/${uid}/ai_interpretation_jobs/${jobHash}`).get();
    assert.equal(job.data()?.status, 'generated', 'result must be persisted before settlement');
    return baseLedger.settleReservation(uid, input);
  },
};

function providerFactory({ uid }: { uid: string }) {
  return {
    async gemini() {
      providerCalls.set(uid, (providerCalls.get(uid) ?? 0) + 1);
      const wallet = await baseLedger.readWallet(uid);
      assert.equal(wallet.reservedCredits, 35, 'credits must be reserved before provider processing');
      assert.equal(wallet.purchasedCredits, 65);
      if (failingProviderUids.has(uid)) {
        throw Object.assign(new Error('primary provider unavailable'), { status: 503 });
      }
      return {
        text: JSON.stringify(report),
        model: 'route-integration-provider',
        usage: { inputTokens: 12, outputTokens: 24 },
      };
    },
    async openai() {
      providerCalls.set(uid, (providerCalls.get(uid) ?? 0) + 1);
      if (!failingProviderUids.has(uid)) {
        throw new Error('Fallback provider must not run after a valid primary response.');
      }
      throw Object.assign(new Error('provider unavailable'), { status: 503 });
    },
  };
}

function createIdentityMiddleware(): RequestHandler {
  return (req, res, next) => {
    const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) {
      res.status(401).json({ error: 'A signed-in account is required.' });
      return;
    }
    res.locals.firebaseUid = token;
    next();
  };
}

async function issueQuote(baseUrl: string, uid: string) {
  const response = await fetch(`${baseUrl}/ai/interpretation/quote`, {
    headers: { authorization: `Bearer ${uid}` },
  });
  assert.equal(response.status, 200);
  return await response.json() as {
    quoteToken: string;
    credits: number;
    pricingVersion: string;
    availableCredits: number;
    canAfford: boolean;
  };
}

function paidRequestHeaders(uid: string, quote: Awaited<ReturnType<typeof issueQuote>>, key: string) {
  return {
    authorization: `Bearer ${uid}`,
    'content-type': 'application/json',
    'idempotency-key': key,
    'x-zioncore-quoted-credits': String(quote.credits),
    'x-zioncore-pricing-version': quote.pricingVersion,
    'x-zioncore-quote-token': quote.quoteToken,
  };
}

test('paid interpretation quote, reserve, generation, settlement, replay, and failure release run through HTTP', async () => {
  const successUid = `paid-route-${randomUUID()}`;
  const failureUid = `failed-route-${randomUUID()}`;
  const idempotencyKey = 'route-paid-interpretation-001';
  await baseLedger.grantCredits(successUid, {
    amount: 100,
    bucket: 'purchased',
    idempotencyKey: `grant-${successUid}`,
  });
  await baseLedger.grantCredits(failureUid, {
    amount: 100,
    bucket: 'purchased',
    idempotencyKey: `grant-${failureUid}`,
  });
  failingProviderUids.add(failureUid);

  await withServer(createIdentityMiddleware(), async baseUrl => {
    const unauthenticated = await fetch(`${baseUrl}/ai/interpretation/quote`);
    assert.equal(unauthenticated.status, 401);

    const quote = await issueQuote(baseUrl, successUid);
    assert.equal(quote.credits, 35);
    assert.equal(quote.availableCredits, 100);
    assert.equal(quote.canAfford, true);

    const request = () => fetch(`${baseUrl}/ai/interpretation`, {
      method: 'POST',
      headers: paidRequestHeaders(successUid, quote, idempotencyKey),
      body: JSON.stringify(requestBody),
    });
    const first = await request();
    assert.equal(first.status, 200);
    assert.equal((await first.json() as { provider: string }).provider, 'gemini');
    assert.equal(providerCalls.get(successUid), 1);

    const settledWallet = await baseLedger.readWallet(successUid);
    assert.deepEqual({
      purchasedCredits: settledWallet.purchasedCredits,
      reservedCredits: settledWallet.reservedCredits,
      availableCredits: settledWallet.availableCredits,
    }, {
      purchasedCredits: 65,
      reservedCredits: 0,
      availableCredits: 65,
    });
    const history = await baseLedger.listTransactions(successUid);
    assert.equal(history.filter(item => item.type === 'reservation').length, 1);
    assert.equal(history.filter(item => item.type === 'settlement').length, 1);

    const replay = await request();
    assert.equal(replay.status, 200);
    assert.equal(providerCalls.get(successUid), 1, 'a retry must return the saved result without calling AI again');
    assert.equal((await baseLedger.readWallet(successUid)).purchasedCredits, 65);

    const failedQuote = await issueQuote(baseUrl, failureUid);
    const failed = await fetch(`${baseUrl}/ai/interpretation`, {
      method: 'POST',
      headers: paidRequestHeaders(failureUid, failedQuote, 'route-failed-interpretation-001'),
      body: JSON.stringify(requestBody),
    });
    assert.equal(failed.status, 502);
    assert.equal(providerCalls.get(failureUid), 2, 'primary and bounded fallback were attempted');
    const releasedWallet = await baseLedger.readWallet(failureUid);
    assert.equal(releasedWallet.purchasedCredits, 100);
    assert.equal(releasedWallet.reservedCredits, 0);
    const failedHistory = await baseLedger.listTransactions(failureUid);
    assert.equal(failedHistory.filter(item => item.type === 'reservation').length, 1);
    assert.equal(failedHistory.filter(item => item.type === 'release').length, 1);
    const failedJobHash = createHash('sha256')
      .update(`${failureUid}:route-failed-interpretation-001`)
      .digest('hex');
    const failedJob = await db.doc(`users/${failureUid}/ai_interpretation_jobs/${failedJobHash}`).get();
    assert.equal(failedJob.data()?.status, 'failed');
  });
});
