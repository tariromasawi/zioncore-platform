export type BalanceTransactionSnapshot = {
  amount: number;
  currency: string;
  type: string;
  net: number;
};

export type CurrencyTotals = {
  currency: string;
  paymentCount: number;
  grossMinor: number;
  refundCount: number;
  refundedMinor: number;
  netSalesMinor: number;
  stripeNetMinor: number;
};

export type AiJobEconomicsTotals = {
  status: 'connected' | 'unavailable';
  jobsScanned: number;
  settledJobs: number;
  auditedJobs: number;
  unauditedSettledJobs: number;
  creditsSpent: number;
  grossServiceValueMinor: number;
  estimatedProviderCostMicroUsd: number | null;
  truncated: boolean;
};

export function aggregateAiJobEconomics(
  jobs: readonly unknown[],
  truncated: boolean,
): AiJobEconomicsTotals {
  let settledJobs = 0;
  let auditedJobs = 0;
  let creditsSpent = 0;
  let grossServiceValueMinor = 0;
  let knownProviderCostMicroUsd = 0;
  let allCostsKnown = true;

  for (const job of jobs) {
    if (!job || typeof job !== 'object') continue;
    const record = job as {
      status?: unknown;
      financialAudit?: {
        creditsCharged?: unknown;
        grossServiceValueMinor?: unknown;
        estimatedProviderCostMicroUsd?: unknown;
      };
    };
    if (record.status !== 'settled') continue;
    settledJobs += 1;
    const audit = record.financialAudit;
    if (!audit) {
      allCostsKnown = false;
      continue;
    }
    const credits = audit.creditsCharged;
    const value = audit.grossServiceValueMinor;
    if (
      !Number.isSafeInteger(credits) || Number(credits) < 0 ||
      !Number.isSafeInteger(value) || Number(value) < 0
    ) {
      allCostsKnown = false;
      continue;
    }
    auditedJobs += 1;
    creditsSpent += Number(credits);
    grossServiceValueMinor += Number(value);
    if (
      Number.isSafeInteger(audit.estimatedProviderCostMicroUsd)
      && Number(audit.estimatedProviderCostMicroUsd) >= 0
    ) {
      knownProviderCostMicroUsd += Number(audit.estimatedProviderCostMicroUsd);
    } else {
      allCostsKnown = false;
    }
  }

  return {
    status: 'connected',
    jobsScanned: jobs.length,
    settledJobs,
    auditedJobs,
    unauditedSettledJobs: settledJobs - auditedJobs,
    creditsSpent,
    grossServiceValueMinor,
    estimatedProviderCostMicroUsd: allCostsKnown ? knownProviderCostMicroUsd : null,
    truncated,
  };
}

export function unavailableAiJobEconomics(): AiJobEconomicsTotals {
  return {
    status: 'unavailable',
    jobsScanned: 0,
    settledJobs: 0,
    auditedJobs: 0,
    unauditedSettledJobs: 0,
    creditsSpent: 0,
    grossServiceValueMinor: 0,
    estimatedProviderCostMicroUsd: null,
    truncated: false,
  };
}

export function aggregateBalanceTransactions(
  transactions: readonly BalanceTransactionSnapshot[],
): CurrencyTotals[] {
  const totals = new Map<string, CurrencyTotals>();
  for (const transaction of transactions) {
    const currency = transaction.currency.toLowerCase();
    if (!/^[a-z]{3}$/.test(currency)) continue;
    if (!Number.isSafeInteger(transaction.amount) || !Number.isSafeInteger(transaction.net)) continue;
    const isCharge = transaction.type === 'charge' && transaction.amount > 0;
    const isRefund = transaction.type === 'refund' && transaction.amount < 0;
    if (!isCharge && !isRefund) continue;
    const summary = totals.get(currency) ?? {
      currency,
      paymentCount: 0,
      grossMinor: 0,
      refundCount: 0,
      refundedMinor: 0,
      netSalesMinor: 0,
      stripeNetMinor: 0,
    };
    if (isCharge) {
      summary.paymentCount += 1;
      summary.grossMinor += transaction.amount;
      summary.stripeNetMinor += transaction.net;
    } else {
      summary.refundCount += 1;
      summary.refundedMinor += Math.abs(transaction.amount);
      summary.stripeNetMinor += transaction.net;
    }
    summary.netSalesMinor = summary.grossMinor - summary.refundedMinor;
    totals.set(currency, summary);
  }
  return [...totals.values()].sort((left, right) => left.currency.localeCompare(right.currency));
}
