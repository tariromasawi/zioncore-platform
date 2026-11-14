export type PaymentWindowSummary = {
  status: 'connected' | 'unavailable' | 'not_enabled';
  truncated: boolean;
  currencyTotals: readonly { paymentCount: number }[];
};

export type PaymentWindowCount = {
  value: number | null;
  certainty: 'complete' | 'partial' | 'unavailable';
  lowerBound: boolean;
  emptyWindow: boolean;
};

export function getPaymentWindowCount(
  summary: PaymentWindowSummary,
): PaymentWindowCount {
  if (summary.status !== 'connected') {
    return {
      value: null,
      certainty: 'unavailable',
      lowerBound: false,
      emptyWindow: false,
    };
  }

  const count = summary.currencyTotals.reduce(
    (total, row) => total + row.paymentCount,
    0,
  );

  if (summary.truncated) {
    return {
      value: count > 0 ? count : null,
      certainty: 'partial',
      lowerBound: count > 0,
      emptyWindow: false,
    };
  }

  return {
    value: count,
    certainty: 'complete',
    lowerBound: false,
    emptyWindow: summary.currencyTotals.length === 0,
  };
}
