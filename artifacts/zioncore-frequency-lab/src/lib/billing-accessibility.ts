import type { BillingOffer } from '@workspace/api-client-react';

type DescribedOffer = Pick<BillingOffer, 'name' | 'credits' | 'currency' | 'amountMinor' | 'interval'>;

export function billingPriceLabel(offer: DescribedOffer) {
  const price = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: offer.currency.toUpperCase(),
  }).format(offer.amountMinor / 100);
  return offer.interval ? `${price} / ${offer.interval}` : price;
}

/** Include the visible action first so speech commands match the displayed label. */
export function billingOfferAccessibleName(action: string, offer: DescribedOffer) {
  return `${action}: ${offer.name}, ${offer.credits ? `${offer.credits} credits, ` : ''}${billingPriceLabel(offer)}`;
}
