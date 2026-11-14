import { Router, type IRouter, type RequestHandler } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import {
  CreateAiInterpretationBody,
  CreateAiInterpretationResponse,
  GetAiInterpretationQuoteResponse,
  GetPublicInterpretationPricingResponse,
} from '@workspace/api-zod';
import {
  type AnalysisMeasurement,
  aiInterpretationRequestSchema,
  aiInterpretationResponseSchema,
  buildAnalysisPrompt,
  explanationSchema,
} from '@workspace/frequency-ai-contract';
import {
  AIProvidersUnavailableError,
  runWithGeminiOpenAIFallback,
  type ProviderAttempt,
  type ProviderCalls,
} from '../lib/ai-provider-router';
import {
  estimateProviderUsageMicroUsd,
  generateWithGemini,
  generateWithOpenAI,
} from '../lib/ai-provider-clients';
import { normalizeAnalysisOutput } from '../lib/ai-output-normalizer';
import { assertAiInterpretationQuality } from '../lib/ai-interpretation-quality';
import { createAIRequestGuard } from '../lib/ai-request-guard';
import { CreditLedgerError, getCreditLedger } from '../lib/credit-ledger';
import {
  AiInterpretationJobError,
  createAiInterpretationJobStore,
  fingerprintAiInterpretationRequest,
} from '../lib/ai-interpretation-jobs';
import { getAIInterpretationPrice } from '../lib/ai-interpretation-pricing';
import { issueServiceQuote, verifyServiceQuote } from '../lib/signed-service-quote';
import { createAiJobFinancialAudit } from '../lib/ai-job-financial-audit';
import { getFirebaseAdminApp } from '../lib/firebase-admin';
import { requireFirebaseIdentity } from '../middlewares/firebase-identity';

function interpretationQuoteScope(includeFaithReflection: boolean) {
  return `interpretation:derived-features-v2:${includeFaithReflection ? 'spiritual' : 'frequency'}`;
}

function interpretationJobStore() {
  return createAiInterpretationJobStore(getFirestore(getFirebaseAdminApp()));
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

function providerUsageSummary(attempts: ProviderAttempt[]) {
  const providers = attempts.map(attempt => ({
    provider: attempt.provider,
    model: attempt.model,
    inputTokens: attempt.usage?.inputTokens ?? null,
    outputTokens: attempt.usage?.outputTokens ?? null,
    estimatedCostMicroUsd: estimateProviderUsageMicroUsd(attempt.model, attempt.usage),
  }));
  const estimates = providers.map(provider => provider.estimatedCostMicroUsd);
  return {
    providerUsage: providers,
    estimatedProviderCostMicroUsd: estimates.every(
      (estimate): estimate is number => estimate !== null,
    )
      ? estimates.reduce((total, estimate) => total + estimate, 0)
      : null,
  };
}

export type AiInterpretationRouterOptions = {
  identityMiddleware?: RequestHandler;
  environment?: NodeJS.ProcessEnv;
  ledgerProvider?: () => ReturnType<typeof getCreditLedger>;
  jobStoreProvider?: () => ReturnType<typeof createAiInterpretationJobStore>;
  providerFactory?: (input: {
    uid: string;
    prompt: string;
    request: {
      measurement: AnalysisMeasurement;
      includeFaithReflection: boolean;
      listeningContext: string;
    };
  }) => ProviderCalls;
};

export function createAiInterpretationRouter(
  options: AiInterpretationRouterOptions = {},
): IRouter {
  const router: IRouter = Router();
  const requestGuard = createAIRequestGuard();
  const environment = options.environment ?? process.env;
  const identityMiddleware = options.identityMiddleware ?? requireFirebaseIdentity;
  const ledgerProvider = options.ledgerProvider ?? getCreditLedger;
  const jobStoreProvider = options.jobStoreProvider ?? interpretationJobStore;
  const providerFactory = options.providerFactory ?? (({ prompt }) => ({
    gemini: () => generateWithGemini(prompt),
    openai: () => generateWithOpenAI(prompt),
  }));

router.get('/ai/interpretation/pricing', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(GetPublicInterpretationPricingResponse.parse({
    standardCredits: getAIInterpretationPrice(environment)?.credits ?? null,
    spiritualCredits: getAIInterpretationPrice(environment, true)?.credits ?? null,
    freeLocal: true,
  }));
});

router.get('/ai/interpretation/quote', identityMiddleware, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const uid = res.locals.firebaseUid;
  if (typeof uid !== 'string' || !uid) {
    res.status(401).json({ error: 'A signed-in account is required.' });
    return;
  }
  const faithParam = req.query.faith;
  if (faithParam !== undefined && faithParam !== '0' && faithParam !== '1') {
    res.status(400).json({ error: 'The interpretation quote option is invalid.' });
    return;
  }
  const includeFaithReflection = faithParam === '1';
  const price = getAIInterpretationPrice(environment, includeFaithReflection);
  if (!price) {
    res.status(503).json({
      error: 'Paid interpretations are not configured in this environment.',
    });
    return;
  }
  try {
    const wallet = await ledgerProvider().readWallet(uid);
    const issuedQuote = issueServiceQuote({
      uid,
      service: 'interpretation',
      credits: price.credits,
      pricingVersion: price.pricingVersion,
      scope: interpretationQuoteScope(includeFaithReflection),
    }, environment);
    if (!issuedQuote) {
      res.status(503).json({ error: 'Secure interpretation quotes are not configured.' });
      return;
    }
    res.status(200).json(GetAiInterpretationQuoteResponse.parse({
      ...issuedQuote,
      credits: price.credits,
      availableCredits: wallet.availableCredits,
      canAfford: wallet.availableCredits >= price.credits,
      pricingVersion: price.pricingVersion,
    }));
  } catch (error) {
    req.log.error({ err: error }, 'Could not quote an AI interpretation');
    res.status(503).json({ error: 'The interpretation quote is temporarily unavailable.' });
  }
});

router.post('/ai/interpretation/recover', identityMiddleware, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const uid = res.locals.firebaseUid;
  if (typeof uid !== 'string' || !uid) {
    res.status(401).json({ error: 'A signed-in account is required.' });
    return;
  }
  const idempotencyKey = typeof req.body?.idempotencyKey === 'string'
    ? req.body.idempotencyKey
    : '';
  if (!/^[A-Za-z0-9._:-]{8,80}$/.test(idempotencyKey)) {
    res.status(400).json({ error: 'A valid interpretation request identifier is required.' });
    return;
  }
  try {
    const jobs = jobStoreProvider();
    const recovery = await jobs.recover(uid, idempotencyKey);
    if (recovery.kind === 'settled') {
      res.status(200).json(CreateAiInterpretationResponse.parse(recovery.response));
      return;
    }
    if (recovery.kind === 'generated') {
      const apiResponse = CreateAiInterpretationResponse.parse(recovery.response);
      await ledgerProvider().settleReservation(uid, {
        operationId: `ai-${idempotencyKey}`,
        finalChargeCredits: recovery.chargeCredits,
        idempotencyKey: `ai-settle:${idempotencyKey}`,
      });
      await jobs.markSettled(uid, idempotencyKey);
      res.status(200).json(apiResponse);
      return;
    }
    if (recovery.kind === 'busy') {
      res.set('Retry-After', '2').status(202).json({
        status: 'processing',
        retryAfterMs: 1500,
        retryable: true,
      });
      return;
    }
    if (recovery.kind === 'stale') {
      const ledger = ledgerProvider();
      const operationId = `ai-${idempotencyKey}`;
      const reservationStatus = await ledger.getReservationStatus(uid, operationId);
      if (reservationStatus === 'settled') {
        res.status(503).json({
          error: 'A completed charge needs account reconciliation. Contact support before starting another interpretation.',
          retryable: false,
        });
        return;
      }
      if (reservationStatus === 'reserved') {
        await ledger.releaseReservation(uid, {
          operationId,
          idempotencyKey: `ai-recovery-release:${idempotencyKey}`,
        });
      }
      await jobs.markFailed(uid, idempotencyKey, recovery.leaseToken);
      res.status(409).json({
        error: 'The earlier interpretation did not finish. Any held credits were returned; start a new request.',
        retryable: false,
      });
      return;
    }
    if (recovery.kind === 'failed' || recovery.kind === 'missing') {
      res.status(404).json({
        error: 'No recoverable completed interpretation was found for this request.',
        retryable: false,
      });
      return;
    }
    res.status(410).json({
      error: 'The safe retry window for this completed reading has expired.',
      retryable: false,
    });
  } catch (error) {
    req.log.error({ err: error }, 'Could not recover a saved interpretation');
    res.status(503).json({
      error: 'ZionCore could not safely recover this reading. Retry shortly.',
      retryable: true,
    });
  }
});

router.post('/ai/interpretation', identityMiddleware, async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const uid = res.locals.firebaseUid;
  if (typeof uid !== 'string' || !uid) {
    res.status(401).json({ error: 'A signed-in account is required.' });
    return;
  }
  const idempotencyKey = req.get('Idempotency-Key') ?? '';
  if (!/^[A-Za-z0-9._:-]{8,80}$/.test(idempotencyKey)) {
    res.status(400).json({ error: 'A valid interpretation request identifier is required.' });
    return;
  }
  const parsedRequest = aiInterpretationRequestSchema.safeParse(req.body);
  if (!parsedRequest.success) {
    res.status(400).json({ error: 'The measurement or listening context is invalid.' });
    return;
  }
  const generatedRequest = CreateAiInterpretationBody.safeParse(parsedRequest.data);
  if (!generatedRequest.success) {
    res.status(400).json({ error: 'The interpretation request is invalid.' });
    return;
  }
  const price = getAIInterpretationPrice(
    environment,
    generatedRequest.data.includeFaithReflection,
  );
  if (!price) {
    res.status(503).json({
      error: 'Paid interpretations are not configured in this environment.',
    });
    return;
  }
  const quotedCredits = Number(req.get('X-ZionCore-Quoted-Credits'));
  const quotedPricingVersion = req.get('X-ZionCore-Pricing-Version') ?? '';
  if (quotedCredits !== price.credits || quotedPricingVersion !== price.pricingVersion) {
    res.status(409).json({
      error: 'The interpretation price changed. Review the current quote and try again.',
    });
    return;
  }
  const quoteVerification = verifyServiceQuote(
    req.get('X-ZionCore-Quote-Token') ?? '',
    {
      uid,
      service: 'interpretation',
      credits: price.credits,
      pricingVersion: price.pricingVersion,
      scope: interpretationQuoteScope(generatedRequest.data.includeFaithReflection),
    },
    environment,
  );
  if (!quoteVerification.ok) {
    res.status(quoteVerification.reason === 'unconfigured' ? 503 : 409).json({
      error: quoteVerification.reason === 'expired'
        ? 'This quote expired. Request a fresh price before starting the interpretation.'
        : quoteVerification.reason === 'unconfigured'
          ? 'Secure interpretation quotes are not configured.'
          : 'This quote is invalid or no longer matches the current price.',
      retryable: false,
    });
    return;
  }

  const operationId = `ai-${idempotencyKey}`;
  const jobs = jobStoreProvider();
  const requestFingerprint = fingerprintAiInterpretationRequest({
    request: generatedRequest.data,
    price: { credits: price.credits, pricingVersion: price.pricingVersion },
  });
  let claim;
  try {
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
      res.status(409).json({
        error: 'This request identifier belongs to different interpretation inputs. Start a new request.',
        retryable: false,
      });
      return;
    }
    req.log.error({ err: error }, 'Could not claim an interpretation retry record');
    res.status(503).json({
      error: 'ZionCore could not secure this request for reliable billing. No interpretation was started.',
      retryable: true,
    });
    return;
  }

  if (claim.kind === 'settled') {
    try {
      res.status(200).json(CreateAiInterpretationResponse.parse(claim.response));
    } catch (error) {
      req.log.error({ err: error }, 'Saved interpretation retry record is invalid');
      res.status(503).json({
        error: 'The saved interpretation could not be verified. Contact support before retrying.',
        retryable: false,
      });
    }
    return;
  }

  if (claim.kind === 'generated') {
    try {
      const apiResponse = CreateAiInterpretationResponse.parse(claim.response);
      await ledgerProvider().settleReservation(uid, {
        operationId,
        finalChargeCredits: claim.chargeCredits,
        idempotencyKey: `ai-settle:${idempotencyKey}`,
      });
      await jobs.markSettled(uid, idempotencyKey);
      res.status(200).json(apiResponse);
    } catch (error) {
      req.log.error({ err: error }, 'Could not settle a saved interpretation retry');
      res.status(503).json({
        error: 'The completed interpretation is securely saved. Retry this same request to confirm billing and receive it; do not start another request.',
        retryable: true,
      });
    }
    return;
  }

  if (claim.kind === 'busy') {
    res.set('Retry-After', '2').status(202).json({
      status: 'processing',
      retryAfterMs: 1500,
      retryable: true,
    });
    return;
  }

  if (claim.kind === 'failed') {
    res.status(409).json({
      error: 'This attempt did not complete. Start a new request; no duplicate charge will be made.',
      retryable: false,
    });
    return;
  }

  if (claim.kind === 'expired') {
    res.status(410).json({
      error: 'The safe retry window for this completed reading has expired. Request a new interpretation if needed.',
      retryable: false,
    });
    return;
  }

  const guard = requestGuard.acquire(uid);
  if (!guard.allowed) {
    await jobs.releaseLease(uid, idempotencyKey, claim.leaseToken).catch(error => {
      req.log.error({ err: error }, 'Could not release a rate-limited interpretation lease');
    });
    res.status(guard.reason === 'cooldown' ? 429 : 503).json({
      error: guard.reason === 'cooldown'
        ? 'Please wait before requesting another interpretation.'
        : 'Interpretation capacity is temporarily full. Try again shortly.',
      retryable: false,
    });
    return;
  }

  const startedAt = Date.now();
  const leaseHeartbeat = setInterval(() => {
    void jobs.renewLease(uid, idempotencyKey, claim.leaseToken).catch(error => {
      req.log.warn({ err: error }, 'Could not renew an interpretation job lease');
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
    ledger = ledgerProvider();
    reservationAttempted = true;
    const reservation = await ledger.reserveCredits(uid, {
      operationId,
      amount: price.credits,
      idempotencyKey: `ai-reserve:${idempotencyKey}`,
    });
    if (reservation.duplicate) {
      const reservationStatus = claim.reclaimed
        ? await ledger.getReservationStatus(uid, operationId)
        : null;
      if (!claim.reclaimed || reservationStatus !== 'reserved') {
        await jobs.markFailed(uid, idempotencyKey, claim.leaseToken);
        res.status(409).json({
          error: 'This request identifier was already used. Start a new request; no second charge was made.',
          retryable: false,
        });
        return;
      }
    }
    reservationHeld = true;

    const request = generatedRequest.data;
    const prompt = buildAnalysisPrompt(
      request.measurement,
      request.includeFaithReflection,
      request.listeningContext,
    );
    const routed = await runWithGeminiOpenAIFallback(providerFactory({
      uid,
      prompt,
      request,
    }), text => parseProviderJson(
      text,
      request.measurement,
      request.listeningContext,
      request.includeFaithReflection,
    ));
    const analysis = explanationSchema.parse({
      ...routed.analysis,
      faithReflection: request.includeFaithReflection
        ? routed.analysis.faithReflection
        : null,
    });
    const response = aiInterpretationResponseSchema.parse({
      analysis,
      provider: routed.provider,
      model: routed.model,
      fallbackUsed: routed.fallbackUsed,
    });
    const apiResponse = CreateAiInterpretationResponse.parse(response);
    const financialAudit = createAiJobFinancialAudit({
      quoteId: quoteVerification.quote.quoteId,
      service: 'interpretation',
      creditsCharged: price.credits,
      providerUsage: routed.attempts.map(attempt => ({
        provider: attempt.provider,
        model: attempt.model,
        inputTokens: attempt.usage?.inputTokens ?? null,
        outputTokens: attempt.usage?.outputTokens ?? null,
        estimatedCostMicroUsd: estimateProviderUsageMicroUsd(attempt.model, attempt.usage),
      })),
    });
    await jobs.markGenerated(uid, idempotencyKey, claim.leaseToken, apiResponse, financialAudit);
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
      fallbackUsed: routed.fallbackUsed,
      durationMs: Date.now() - startedAt,
      creditsCharged: price.credits,
      ...providerUsageSummary(routed.attempts),
    }, 'Frequency interpretation completed');
    res.status(200).json(apiResponse);
  } catch (error) {
    const lostLease = error instanceof AiInterpretationJobError && error.code === 'LEASE_LOST';
    if (reservationAttempted && !reservationHeld && !generationSucceeded && ledger && !lostLease) {
      try {
        reservationHeld = (await ledger.getReservationStatus(uid, operationId)) === 'reserved';
      } catch (statusError) {
        reservationStateUnknown = true;
        req.log.error({ err: statusError }, 'Could not verify whether the credit reservation committed');
      }
    }
    if (reservationHeld && !generationSucceeded && ledger && !lostLease) {
      try {
        await ledger.releaseReservation(uid, {
          operationId,
          idempotencyKey: `ai-release:${idempotencyKey}`,
        });
        reservationHeld = false;
        await jobs.markFailed(uid, idempotencyKey, claim.leaseToken);
      } catch (releaseError) {
        reservationReleaseFailed = true;
        req.log.error({ err: releaseError }, 'Could not release credits after a failed interpretation');
      }
    } else if (!reservationHeld && !generationSucceeded && !reservationStateUnknown && !lostLease) {
      await jobs.markFailed(uid, idempotencyKey, claim.leaseToken).catch(markError => {
        req.log.error({ err: markError }, 'Could not close a failed interpretation attempt');
      });
    }
    if (error instanceof AiInterpretationJobError) {
      const status = error.code === 'IDEMPOTENCY_CONFLICT' ? 409 : 503;
      res.status(status).json({
        error: error.code === 'IDEMPOTENCY_CONFLICT'
          ? 'This request identifier was already used. Start a new request.'
          : 'ZionCore could not verify this request safely. Retry the same request.',
        retryable: error.code !== 'IDEMPOTENCY_CONFLICT',
      });
      return;
    }
    if (error instanceof CreditLedgerError) {
      if (error.code === 'INSUFFICIENT_CREDITS') {
        res.status(402).json({
          error: 'Not enough credits. Add credits to your wallet before generating.',
          retryable: false,
        });
        return;
      }
      if (error.code === 'IDEMPOTENCY_CONFLICT') {
        res.status(409).json({
          error: 'This request identifier was already used. Start a new interpretation.',
          retryable: false,
        });
        return;
      }
      req.log.error({ err: error }, 'Credit reservation or settlement failed');
      res.status(503).json({
        error: generationSucceeded
          ? 'The completed interpretation is securely saved. Retry this same request to confirm billing and receive it; do not start another request.'
          : 'Credit reservation is temporarily unavailable. No interpretation was started.',
        retryable: generationSucceeded,
      });
      return;
    }
    if (reservationReleaseFailed) {
      res.status(503).json({
        error: 'ZionCore could not complete the reading, and the temporary credit reservation could not be released. Contact support before retrying.',
        retryable: true,
      });
      return;
    }
    if (reservationStateUnknown) {
      res.status(503).json({
        error: 'ZionCore could not verify the wallet reservation. Retry this same request; do not start another interpretation.',
        retryable: true,
      });
      return;
    }
    if (generationSucceeded) {
      req.log.error({ err: error }, 'Interpretation succeeded but wallet settlement could not be confirmed');
      res.status(503).json({
        error: 'The completed interpretation is securely saved. Retry this same request to confirm billing and receive it; do not start another request.',
        retryable: true,
      });
      return;
    }
    if (error instanceof AIProvidersUnavailableError) {
      req.log.warn({
        durationMs: Date.now() - startedAt,
        ...providerUsageSummary(error.attempts),
      }, 'Both AI providers failed validation or availability checks');
      res.status(502).json({
        error: 'ZionCore could not produce a valid interpretation with its configured providers. Your measurement was not changed.',
        retryable: false,
      });
      return;
    }
    req.log.error({ durationMs: Date.now() - startedAt }, 'Frequency interpretation request failed');
    res.status(502).json({
      error: 'ZionCore could not complete this interpretation. Your measurement was not changed.',
      retryable: false,
    });
  } finally {
    clearInterval(leaseHeartbeat);
    guard.release();
  }
});

  return router;
}

export default createAiInterpretationRouter();
