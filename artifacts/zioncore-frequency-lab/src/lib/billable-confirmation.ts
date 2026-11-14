export function isBillableQuoteConfirmed(
  activeQuoteId: string | null | undefined,
  confirmedQuoteId: string | null,
): boolean {
  return typeof activeQuoteId === 'string'
    && activeQuoteId.length > 0
    && activeQuoteId === confirmedQuoteId;
}
