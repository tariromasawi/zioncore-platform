import express, { Router, type IRouter } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import {
  CreateAiAudioInterpretationBody,
  CreateAiInterpretationResponse,
  GetAiAudioInterpretationQuoteResponse,
} from '@workspace/api-zod';
import {
  type AnalysisMeasurement,
  aiInterpretationRequestSchema,
  aiInterpretationResponseSchema,
  buildAnalysisPrompt,
  explanationSchema,
} from '@workspace/frequency-ai-contract';
import {
  estimateGeminiAudioUsageMicroUsd,
  estimateProviderUsageMicroUsd,
  generateWithGemini,
  generateWithGeminiAudioSegment,
  generateWithOpenAI,
} from '../lib/ai-provider-clients';
import {
  AudioInputError,
  encodeBase64Strict,
  inspectAndChunkPcmWav,
  hasExplicitAudioConsent,
  MAX_EXTERNAL_AUDIO_BYTES,
  MAX_EXTERNAL_AUDIO_DURATION_SECONDS,
} from '../lib/ai-audio-input';
import {
  buildAudioQuoteScope,
  getAudioInterpretationPrice,
  type AudioQuoteScopeInput,
} from '../lib/ai-audio-pricing';
import { issueServiceQuote, verifyServiceQuote } from '../lib/signed-service-quote';
import { reconcileFailedReservation } from '../lib/paid-reservation-recovery';
import { normalizeAnalysisOutput } from '../lib/ai-output-normalizer';
import {
  assertAiInterpretationQuality,
  assertBioacousticClaimsAreQualified,
} from '../lib/ai-interpretation-quality';
import { runWithGeminiOpenAIFallback } from '../lib/ai-provider-router';
import { createAIRequestGuard } from '../lib/ai-request-guard';
import {
  AiInterpretationJobError,
  createAiInterpretationJobStore,
  fingerprintAiInterpretationRequest,
} from '../lib/ai-interpretation-jobs';
import { CreditLedgerError, getCreditLedger } from '../lib/credit-ledger';
import { getFirebaseAdminApp } from '../lib/firebase-admin';
import { createAiJobFinancialAudit } from '../lib/ai-job-financial-audit';
import { requireFirebaseIdentity } from '../middlewares/firebase-identity';
import type { ProviderUsage } from '../lib/ai-provider-router';

const router: IRouter = Router();
const audioRequestGuard = createAIRequestGuard({ cooldownMs: 30_000, maxConcurrent: 2 });
const AUDIO_REQUEST_CONTENT_TYPE = 'application/vnd.zioncore.audio-analysis+json';
const bioacousticEvaluationScope = [
  'The versioned evaluation registry contains candidate labels for bird vocalization or chorus, amphibian chorus, walrus haulout vocalization, geyser or geothermal sound, and thunder or weather sound.',
  'These are hypotheses only: the linked public-domain/CC0 reference sources are not loaded or benchmarked in this service, and class precision/recall are unknown.',
  'Do not state that a source class is validated; animal species, behavior, communication, and intent remain unsupported.',
].join(' ');
type AudioSegmentInsight = {
  observations: string;
  speechOrEventDetail: string | null;
};

function parseAudioSegmentInsight(value: unknown): AudioSegmentInsight {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Gemini returned an invalid audio observation.');
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.observations !== 'string' ||
    record.observations.trim().length === 0 ||
    record.observations.length > 320 ||
    !(record.speechOrEventDetail === null ||
      (typeof record.speechOrEventDetail === 'string' && record.speechOrEventDetail.length <= 260)) ||
    Object.keys(record).some(key => !['observations', 'speechOrEventDetail'].includes(key))
  ) {
    throw new Error('Gemini returned an invalid audio observation.');
  }
  assertBioacousticClaimsAreQualified({
    observations: record.observations,
    speechOrEventDetail: record.speechOrEventDetail,
  });
  return {
    observations: record.observations.trim(),
    speechOrEventDetail: typeof record.speechOrEventDetail === 'string'
      ? record.speechOrEventDetail.trim() || null
      : null,
  };
}

function parseProviderJson(
  text: string,
  measurement: AnalysisMeasurement,
  listeningContext: string,
  includeFaithReflection: boolean,
) {
  const normalized = text.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  const analysis = explanationSchema.parse(normalizeAnalysisOutput(JSON.parse(normalized)));
  assertAiInterpretationQuality(analysis, measurement, listeningContext, includeFaithReflection);
  return analysis;
}

function normalizeBase64Segment(bytes: Buffer) {
  return bytes.toString('base64');
}

function isRetryableAudioProviderError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const record = error as Record<string, unknown>;
  const response = record.response && typeof record.response === 'object'
    ? record.response as Record<string, unknown>
    : null;
  const status = Number(record.status ?? record.statusCode ?? response?.status);
  if (Number.isFinite(status)) return status === 408 || status === 429 || status >= 500;
  const code = String(record.code ?? '').toUpperCase();
  return ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'].includes(code);
}

function sleep(milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function reviewAudioSegments(
  segments: ReturnType<typeof inspectAndChunkPcmWav>['segments'],
): Promise<{ insights: AudioSegmentInsight[]; usage: ProviderUsage[]; model: string; providerAttempts: number }> {
  const insights: AudioSegmentInsight[] = new Array(segments.length);
  const usage: ProviderUsage[] = new Array(segments.length);
  let model = '';
  let providerAttempts = 0;
  let nextIndex = 0;
  let segmentFailure: unknown;
  async function reviewNextSegment() {
    while (true) {
      if (segmentFailure) return;
      const index = nextIndex++;
      const segment = segments[index];
      if (!segment) return;
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        providerAttempts += 1;
        const providerOutput = await generateWithGeminiAudioSegment([
          'You are ZionCore’s audio-observation instrument. This is one short segment from a user-authorized recording.',
          'Describe directly audible sound qualities, possible audible events, and speech only if it is genuinely intelligible.',
          bioacousticEvaluationScope,
          'Treat source labels as exploratory hypotheses only. If you mention a possible source, qualify it in the same sentence (for example, “possibly consistent with”) and say that it is unverified.',
          'Do not translate animal communication, infer an animal’s intent, or claim hidden messages, danger, diagnosis, healing, or divine origin.',
          'Do not guess personal identity or repeat sensitive speech. If speech is unclear, say so. Keep observations concise and evidence-linked.',
          'Return strict JSON only with exactly these keys: observations (one short description, 1–3 sentences), speechOrEventDetail (a brief non-identifying speech or event detail, or null).',
          `Segment ${segment.index + 1} of ${segments.length}; duration ${segment.durationSeconds.toFixed(2)} seconds.`,
        ].join('\n'), normalizeBase64Segment(segment.wav), 12_000);
        const normalized = providerOutput.text.trim()
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/i, '');
        const parsed = parseAudioSegmentInsight(JSON.parse(normalized));
        insights[index] = parsed;
        usage[index] = providerOutput.usage ?? { inputTokens: null, outputTokens: null };
        model = providerOutput.model;
        break;
      } catch (error) {
        lastError = error;
          if (attempt > 0 || !isRetryableAudioProviderError(error)) {
            segmentFailure = error;
            throw error;
          }
        await sleep(500 * (2 ** attempt));
      }
    }
      if (!insights[index]) {
        segmentFailure = lastError ?? new Error('A Gemini audio segment was not completed.');
        throw segmentFailure;
      }
    }
  }
  const workerCount = Math.min(5, segments.length);
  const workers = await Promise.allSettled(
    Array.from({ length: workerCount }, () => reviewNextSegment()),
  );
  const failedWorker = workers.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failedWorker) throw failedWorker.reason;
  return { insights, usage, model, providerAttempts };
}

function summarizeAudioReview(insights: AudioSegmentInsight[]) {
  return insights.map((insight, index) => {
    const detail = insight.speechOrEventDetail
      ? ` Additional detail: ${insight.speechOrEventDetail}`
      : '';
    return `Segment ${index + 1}: ${insight.observations}${detail}`;
  }).join('\n').slice(0, 6000);
}

function totalUsage(usage: ProviderUsage[]) {
  const sum = (key: 'inputTokens' | 'outputTokens') => {
    const values = usage.map(item => item[key]);
    return values.every((value): value is number => typeof value === 'number')
      ? values.reduce((total, value) => total + value, 0)
      : null;
  };
  return { inputTokens: sum('inputTokens'), outputTokens: sum('outputTokens') };
}

function audioJsonParser(req: express.Request, res: express.Response, next: express.NextFunction) {
  const parser = express.json({ type: AUDIO_REQUEST_CONTENT_TYPE, limit: '34mb', strict: true });
  parser(req, res, error => {
    if (error) {
      const status = typeof error === 'object' && error && 'status' in error
        ? Number(error.status)
        : 400;
      res.status(status === 413 ? 413 : 400).json({
        error: status === 413
          ? 'The audio request is too large. Choose a WAV no larger than 24 MB.'
          : 'The advanced audio request could not be read.',
      });
      return;
    }
    next();
  });
}

function getJobs() {
  return createAiInterpretationJobStore(getFirestore(getFirebaseAdminApp()));
}

router.get('/ai/interpretation/audio-quote', requireFirebaseIdentity, async (req, res): Promise<void> => {
  res.set('Cache-Control', 'private, no-store');
  const uid = res.locals.firebaseUid;
  if (typeof uid !== 'string' || !uid) {
    res.status(401).json({ error: 'A signed-in account is required.' });
    return;
  }
  const durationSeconds = Number(req.query.durationSeconds);
  const fileBytes = Number(req.query.fileBytes);
  const includeFaithReflection = req.query.faith === '1';
  if (
    req.query.faith !== '0' && req.query.faith !== '1'
      || !Number.isFinite(durationSeconds)
      || !Number.isSafeInteger(fileBytes)
  ) {
    res.status(400).json({ error: 'Choose a valid recording and reading option before requesting a quote.' });
    return;
  }
  const quoteInput: AudioQuoteScopeInput = { durationSeconds, fileBytes, includeFaithReflection };
  const price = getAudioInterpretationPrice(quoteInput);
  if (!price) {
    res.status(503).json({
      error: 'Advanced audio review is waiting for an owner-approved credit price.',
    });
    return;
  }
  try {
    const wallet = await getCreditLedger().readWallet(uid);
    const issuedQuote = issueServiceQuote({
      uid,
      service: 'audio-review',
      credits: price.credits,
      pricingVersion: price.pricingVersion,
      scope: buildAudioQuoteScope(quoteInput),
    });
    if (!issuedQuote) {
      res.status(503).json({ error: 'Secure audio quotes are not configured.' });
      return;
    }
    res.status(200).json(GetAiAudioInterpretationQuoteResponse.parse({
      ...issuedQuote,
      ...price,
      availableCredits: wallet.availableCredits,
      canAfford: wallet.availableCredits >= price.credits,
      maxDurationSeconds: MAX_EXTERNAL_AUDIO_DURATION_SECONDS,
      maxFileBytes: MAX_EXTERNAL_AUDIO_BYTES,
      acceptedMimeTypes: ['audio/wav'],
    }));
  } catch (error) {
    req.log.error({ err: error }, 'Could not quote an external audio interpretation');
    res.status(503).json({ error: 'The advanced audio quote is temporarily unavailable.' });
  }
});

router.post(
  '/ai/interpretation/audio',
  requireFirebaseIdentity,
  audioJsonParser,
  async (req, res): Promise<void> => {
    res.set('Cache-Control', 'private, no-store');
    const uid = res.locals.firebaseUid;
    if (typeof uid !== 'string' || !uid) {
      res.status(401).json({ error: 'A signed-in account is required.' });
      return;
    }
    const idempotencyKey = req.get('Idempotency-Key') ?? '';
    if (!/^[A-Za-z0-9._:-]{8,80}$/.test(idempotencyKey)) {
      res.status(400).json({ error: 'A valid audio interpretation request identifier is required.' });
      return;
    }
    const parsed = CreateAiAudioInterpretationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'The audio request, measurement, or explicit provider consent is invalid.' });
      return;
    }
    const body = parsed.data;
    if (!hasExplicitAudioConsent(body.externalAudioConsent, body.consentVersion)) {
      res.status(400).json({ error: 'Explicit consent for this external audio request is required.' });
      return;
    }
    const interpretation = aiInterpretationRequestSchema.safeParse({
      measurement: body.measurement,
      includeFaithReflection: body.includeFaithReflection,
      listeningContext: body.listeningContext,
    });
    if (!interpretation.success || interpretation.data.measurement.captureSource !== 'audio-file') {
      res.status(400).json({ error: 'Advanced audio review requires a valid locally analyzed recording.' });
      return;
    }

    let inspected;
    let audioBytes: Buffer;
    try {
      audioBytes = encodeBase64Strict(body.audioBase64);
      inspected = inspectAndChunkPcmWav(audioBytes);
    } catch (error) {
      res.status(400).json({
        error: error instanceof AudioInputError
          ? error.message
          : 'The selected WAV could not be validated for external analysis.',
      });
      return;
    }
    if (
      Math.abs(inspected.durationSeconds - interpretation.data.measurement.durationSeconds) > 0.25 ||
      inspected.sampleRate !== interpretation.data.measurement.sampleRate
    ) {
      res.status(400).json({
        error: 'This WAV does not match the recording that was measured locally. Import it again before requesting advanced review.',
      });
      return;
    }
    const quoteInput: AudioQuoteScopeInput = {
      durationSeconds: inspected.durationSeconds,
      fileBytes: audioBytes.length,
      includeFaithReflection: interpretation.data.includeFaithReflection,
    };
    const price = getAudioInterpretationPrice(quoteInput);
    if (!price) {
      res.status(503).json({ error: 'Advanced audio pricing is not configured for paid use.' });
      return;
    }
    if (Number(req.get('X-ZionCore-Quoted-Credits')) !== price.credits
      || req.get('X-ZionCore-Pricing-Version') !== price.pricingVersion) {
      res.status(409).json({ error: 'The advanced audio price changed. Review the new quote and try again.' });
      return;
    }
    const quoteVerification = verifyServiceQuote(
      req.get('X-ZionCore-Quote-Token') ?? '',
      {
        uid,
        service: 'audio-review',
        credits: price.credits,
        pricingVersion: price.pricingVersion,
        scope: buildAudioQuoteScope(quoteInput),
      },
    );
    if (!quoteVerification.ok) {
      res.status(quoteVerification.reason === 'unconfigured' ? 503 : 409).json({
        error: quoteVerification.reason === 'expired'
          ? 'This audio quote expired. Request a fresh price before sending the recording.'
          : quoteVerification.reason === 'unconfigured'
            ? 'Secure audio quotes are not configured.'
            : 'This audio quote is invalid or no longer matches the current price.',
        retryable: false,
      });
      return;
    }

    const operationId = `ai-${idempotencyKey}`;
    const requestFingerprint = fingerprintAiInterpretationRequest({
      request: interpretation.data,
      audioSha256: inspected.sha256,
      consentVersion: body.consentVersion,
      price: { credits: price.credits, pricingVersion: price.pricingVersion },
    });
    let jobs;
    let claim;
    try {
      jobs = getJobs();
      claim = await jobs.claim(uid, idempotencyKey, requestFingerprint, price.credits, {
        quoteId: quoteVerification.quote.quoteId,
        service: quoteVerification.quote.service,
        credits: quoteVerification.quote.credits,
        pricingVersion: quoteVerification.quote.pricingVersion,
        scope: quoteVerification.quote.scope,
        currency: quoteVerification.quote.currency,
        amountMinor: quoteVerification.quote.amountMinor,
        issuedAtMs: quoteVerification.quote.issuedAtMs,
        expiresAtMs: quoteVerification.quote.expiresAtMs,
      });
    } catch (error) {
      if (error instanceof AiInterpretationJobError && error.code === 'IDEMPOTENCY_CONFLICT') {
        res.status(409).json({ error: 'This request identifier belongs to different audio or reading inputs.', retryable: false });
        return;
      }
      req.log.error({ err: error }, 'Could not secure an advanced audio interpretation job');
      res.status(503).json({ error: 'ZionCore could not secure this audio request for reliable billing.', retryable: true });
      return;
    }

    if (claim.kind === 'settled') {
      res.status(200).json(CreateAiInterpretationResponse.parse(claim.response));
      return;
    }
    if (claim.kind === 'generated') {
      try {
        const response = CreateAiInterpretationResponse.parse(claim.response);
        await getCreditLedger().settleReservation(uid, {
          operationId,
          finalChargeCredits: claim.chargeCredits,
          idempotencyKey: `ai-settle:${idempotencyKey}`,
        });
        await jobs.markSettled(uid, idempotencyKey);
        res.status(200).json(response);
      } catch (error) {
        req.log.error({ err: error }, 'Could not settle a recovered advanced audio interpretation');
        res.status(503).json({ error: 'The completed audio reading is saved. Retry this same request to confirm billing.', retryable: true });
      }
      return;
    }
    if (claim.kind === 'busy') {
      res.set('Retry-After', '2').status(202).json({ status: 'processing', retryAfterMs: 1500, retryable: true });
      return;
    }
    if (claim.kind === 'failed') {
      res.status(409).json({ error: 'This audio attempt did not complete. Start a new request; no duplicate charge was made.', retryable: false });
      return;
    }
    if (claim.kind === 'expired') {
      res.status(410).json({ error: 'The retry window for this completed audio reading has expired.', retryable: false });
      return;
    }

    const guard = audioRequestGuard.acquire(uid);
    if (!guard.allowed) {
      await jobs.releaseLease(uid, idempotencyKey, claim.leaseToken).catch(error => {
        req.log.error({ err: error }, 'Could not release a rate-limited audio job lease');
      });
      res.status(guard.reason === 'cooldown' ? 429 : 503).json({
        error: guard.reason === 'cooldown'
          ? 'Please wait before requesting another advanced audio review.'
          : 'Advanced audio review capacity is temporarily full.',
        retryable: false,
      });
      return;
    }

    const startedAt = Date.now();
    const leaseHeartbeat = setInterval(() => {
      void jobs.renewLease(uid, idempotencyKey, claim.leaseToken).catch(error => {
        req.log.warn({ err: error }, 'Could not renew an advanced audio job lease');
      });
    }, 60_000);
    leaseHeartbeat.unref();
    let ledger: ReturnType<typeof getCreditLedger> | null = null;
    let reservationAttempted = false;
    let reservationHeld = false;
    let generationSucceeded = false;
    let reservationReleaseFailed = false;
    let reservationStateUnknown = false;
    try {
      ledger = getCreditLedger();
      reservationAttempted = true;
      const reservation = await ledger.reserveCredits(uid, {
        operationId,
        amount: price.credits,
        idempotencyKey: `ai-reserve:${idempotencyKey}`,
      });
      if (reservation.duplicate) {
        const status = claim.reclaimed ? await ledger.getReservationStatus(uid, operationId) : null;
        if (!claim.reclaimed || status !== 'reserved') {
          await jobs.markFailed(uid, idempotencyKey, claim.leaseToken);
          res.status(409).json({ error: 'This request identifier was already used; no second charge was made.', retryable: false });
          return;
        }
      }
      reservationHeld = true;

      const audioReviewResult = await reviewAudioSegments(inspected.segments);
      const audioReview = {
        provider: 'gemini' as const,
        model: audioReviewResult.model,
        segmentCount: audioReviewResult.insights.length,
        summary: summarizeAudioReview(audioReviewResult.insights),
      };
      const prompt = [
        buildAnalysisPrompt(
          interpretation.data.measurement,
          interpretation.data.includeFaithReflection,
          interpretation.data.listeningContext,
        ),
        'The following additional descriptions were generated by Gemini from the user-consented raw WAV in short segments.',
        'Treat them as fallible model observations, not independently verified labels. Reconcile them with the local numeric measurements; explain disagreement and uncertainty.',
        bioacousticEvaluationScope,
        'Do not present a species or behavior classification as supported; any source suggestion must be clearly marked as an unverified hypothesis. Never translate animal communication or infer an animal’s intent.',
        `Segment observations:\n${audioReview.summary}`,
      ].join('\n\n');
      const routed = await runWithGeminiOpenAIFallback({
        gemini: () => generateWithGemini(prompt, 30_000),
        openai: () => generateWithOpenAI(prompt, 30_000),
      }, text => parseProviderJson(
        text,
        interpretation.data.measurement,
        interpretation.data.listeningContext,
        interpretation.data.includeFaithReflection,
      ));
      const analysis = explanationSchema.parse({
        ...routed.analysis,
        faithReflection: interpretation.data.includeFaithReflection
          ? routed.analysis.faithReflection
          : null,
      });
      const response = CreateAiInterpretationResponse.parse(aiInterpretationResponseSchema.parse({
        analysis,
        provider: routed.provider,
        model: routed.model,
        fallbackUsed: routed.fallbackUsed,
        audioReview,
      }));
      const financialAudit = createAiJobFinancialAudit({
        quoteId: quoteVerification.quote.quoteId,
        service: 'audio-review',
        creditsCharged: price.credits,
        providerUsage: [
          ...audioReviewResult.usage.map(usage => ({
            provider: 'gemini' as const,
            model: audioReviewResult.model,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            estimatedCostMicroUsd: estimateGeminiAudioUsageMicroUsd(audioReviewResult.model, usage),
          })),
          ...routed.attempts.map(attempt => ({
            provider: attempt.provider,
            model: attempt.model,
            inputTokens: attempt.usage?.inputTokens ?? null,
            outputTokens: attempt.usage?.outputTokens ?? null,
            estimatedCostMicroUsd: estimateProviderUsageMicroUsd(attempt.model, attempt.usage),
          })),
        ],
      });
      await jobs.markGenerated(uid, idempotencyKey, claim.leaseToken, response, financialAudit);
      generationSucceeded = true;
      await ledger.settleReservation(uid, {
        operationId,
        finalChargeCredits: price.credits,
        idempotencyKey: `ai-settle:${idempotencyKey}`,
      });
      reservationHeld = false;
      await jobs.markSettled(uid, idempotencyKey);
      req.log.info({
        provider: routed.provider,
        model: routed.model,
        audioProvider: 'gemini',
        audioModel: audioReviewResult.model,
        audioDurationSeconds: inspected.durationSeconds,
        audioChunks: inspected.segments.length,
        audioProviderAttempts: audioReviewResult.providerAttempts,
        audioUsage: totalUsage(audioReviewResult.usage),
        audioCostEstimateMicroUsd: audioReviewResult.providerAttempts === inspected.segments.length
          ? estimateGeminiAudioUsageMicroUsd(audioReviewResult.model, totalUsage(audioReviewResult.usage))
          : null,
        audioCostEstimateNote: audioReviewResult.providerAttempts === inspected.segments.length
          ? 'All input tokens conservatively priced at Google Gemini audio rate; output at the documented model rate.'
          : 'At least one retry had no provider usage metadata; this estimate is omitted to avoid undercounting.',
        durationMs: Date.now() - startedAt,
        creditsCharged: price.credits,
        providerUsage: routed.attempts.map(attempt => ({
          provider: attempt.provider,
          model: attempt.model,
          inputTokens: attempt.usage?.inputTokens ?? null,
          outputTokens: attempt.usage?.outputTokens ?? null,
          estimatedCostMicroUsd: estimateProviderUsageMicroUsd(attempt.model, attempt.usage),
        })),
      }, 'Opt-in audio interpretation completed');
      res.status(200).json(response);
    } catch (error) {
      const lostLease = error instanceof AiInterpretationJobError && error.code === 'LEASE_LOST';
      if (ledger) {
        const recovery = await reconcileFailedReservation({
          ledger,
          uid,
          operationId,
          releaseIdempotencyKey: `ai-release:${idempotencyKey}`,
          reservationAttempted,
          reservationHeld,
          generationSucceeded,
          lostLease,
        });
        reservationHeld = recovery.reservationHeld;
        reservationReleaseFailed = recovery.reservationReleaseFailed;
        reservationStateUnknown = recovery.reservationStateUnknown;
        if (reservationHeld && !generationSucceeded && !lostLease) {
          req.log.error({ operationId }, 'Audio credit reservation remains held after failed reconciliation');
        }
        if (!reservationHeld && !reservationStateUnknown && !generationSucceeded && !lostLease) {
          await jobs.markFailed(uid, idempotencyKey, claim.leaseToken).catch(markError => {
            req.log.error({ err: markError }, 'Could not close a failed audio interpretation job');
          });
        }
      } else if (!generationSucceeded && !reservationAttempted) {
        await jobs.markFailed(uid, idempotencyKey, claim.leaseToken).catch(markError => {
          req.log.error({ err: markError }, 'Could not close a failed audio interpretation job');
        });
      }
      if (error instanceof AiInterpretationJobError) {
        const conflict = error.code === 'IDEMPOTENCY_CONFLICT';
        res.status(conflict ? 409 : 503).json({
          error: conflict
            ? 'This audio request identifier was already used with different inputs.'
            : 'ZionCore could not confirm this audio job state. Retry the same request.',
          retryable: !conflict,
        });
        return;
      }
      if (reservationReleaseFailed) {
        res.status(503).json({
          error: 'The audio review failed and its credit reservation could not be released. Contact support before retrying.',
          retryable: true,
        });
        return;
      }
      if (reservationStateUnknown) {
        res.status(503).json({
          error: 'ZionCore could not verify the audio credit reservation. Retry this same request; do not start another.',
          retryable: true,
        });
        return;
      }
      if (error instanceof CreditLedgerError) {
        const insufficient = error.code === 'INSUFFICIENT_CREDITS';
        res.status(insufficient ? 402 : 503).json({
          error: insufficient
            ? 'Not enough credits. Add credits before requesting advanced audio review.'
            : generationSucceeded
              ? 'The completed audio reading is saved. Retry this same request to confirm billing.'
              : 'The wallet could not reserve credits. No audio provider request was started.',
          retryable: generationSucceeded,
        });
        return;
      }
      if (generationSucceeded) {
        req.log.error({ err: error }, 'Audio reading generated but settlement was not confirmed');
        res.status(503).json({ error: 'The completed audio reading is saved. Retry this same request to confirm billing.', retryable: true });
        return;
      }
      req.log.warn({
        err: error,
        durationMs: Date.now() - startedAt,
        audioChunks: inspected.segments.length,
      }, 'Opt-in audio interpretation failed; the credit reservation was released');
      res.status(502).json({ error: 'Gemini could not complete the requested audio review. Reserved credits were released.', retryable: false });
    } finally {
      clearInterval(leaseHeartbeat);
      guard.release();
    }
  },
);

export default router;
