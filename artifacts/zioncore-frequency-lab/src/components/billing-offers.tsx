import { useEffect, useId, useState } from 'react';
import { ArrowUpRight, CreditCard, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Link } from 'wouter';
import {
  createBillingPortalSession,
  createCheckoutSession,
  getBillingCatalog,
} from '@workspace/api-client-react';
import type { BillingOffer } from '@workspace/api-client-react';
import type { User } from 'firebase/auth';
import { getFirebaseIdentityHeaders } from '@/lib/firebase';
import { billingOfferAccessibleName, billingPriceLabel as priceLabel } from '@/lib/billing-accessibility';
import './billing-offers.css';

type BillingOffersProps = {
  user: User | null;
  firebaseReady: boolean;
  projectMismatch: boolean;
  includePremium?: boolean;
  showPortal?: boolean;
  interpretationCredits?: number | null;
};

export default function BillingOffers({
  user,
  firebaseReady,
  projectMismatch,
  includePremium = true,
  showPortal = false,
  interpretationCredits = null,
}: BillingOffersProps) {
  const [offers, setOffers] = useState<BillingOffer[]>([]);
  const [checkoutEnabled, setCheckoutEnabled] = useState(false);
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const windowNoticeId = useId();

  useEffect(() => {
    let current = true;
    setLoading(true);
    void getBillingCatalog()
      .then(catalog => {
        if (!current) return;
        setOffers(catalog.offers);
        setCheckoutEnabled(catalog.checkoutEnabled);
        setPortalEnabled(catalog.portalEnabled);
        setError('');
      })
      .catch(() => {
        if (current) setError('Live offer details could not be loaded. No purchase has been started.');
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, []);

  async function secureHeaders() {
    if (!user || !firebaseReady || projectMismatch) {
      throw new Error('Sign in with the configured Firebase account before purchasing.');
    }
    return getFirebaseIdentityHeaders(user);
  }

  async function startCheckout(offer: BillingOffer) {
    if (busy !== null) return;
    setAnnouncement('');
    const checkoutWindow = window.open('about:blank', '_blank');
    if (!checkoutWindow) {
      setError('Allow pop-ups for this site to open Stripe Checkout without leaving your interpretation.');
      return;
    }
    setBusy(offer.key);
    setError('');
    try {
      checkoutWindow.document.title = 'Opening Stripe Checkout — ZionCore';
      if (checkoutWindow.document.body) checkoutWindow.document.body.textContent = 'Opening secure Stripe Checkout. If this window stays blank, return to ZionCore for the error message.';
      checkoutWindow.opener = null;
      const headers = await secureHeaders();
      const session = await createCheckoutSession(
        { offerKey: offer.key },
        { headers },
      );
      const checkoutUrl = new URL(session.url);
      if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'checkout.stripe.com') {
        throw new Error('Stripe returned an unrecognized checkout link.');
      }
      checkoutWindow.location.replace(checkoutUrl.toString());
      setAnnouncement('Stripe Checkout opened in a new tab. Return here after completing or closing Checkout.');
      setBusy(null);
    } catch (checkoutError) {
      checkoutWindow.close();
      setError(checkoutError instanceof Error
        ? checkoutError.message
        : 'Checkout could not be started. No payment was taken.');
      setBusy(null);
    }
  }

  async function openPortal() {
    if (busy !== null) return;
    setAnnouncement('');
    const portalWindow = window.open('about:blank', '_blank');
    if (!portalWindow) {
      setError('Allow pop-ups for this site to open Stripe billing without leaving this page.');
      return;
    }
    setBusy('portal');
    setError('');
    try {
      portalWindow.document.title = 'Opening Stripe billing — ZionCore';
      if (portalWindow.document.body) portalWindow.document.body.textContent = 'Opening secure Stripe billing. If this window stays blank, return to ZionCore for the error message.';
      portalWindow.opener = null;
      const headers = await secureHeaders();
      const session = await createBillingPortalSession({ headers });
      const portalUrl = new URL(session.url);
      if (portalUrl.protocol !== 'https:' || portalUrl.hostname !== 'billing.stripe.com') {
        throw new Error('Stripe returned an unrecognized billing link.');
      }
      portalWindow.location.replace(portalUrl.toString());
      setAnnouncement('Stripe billing opened in a new tab. Return here after managing or closing billing.');
      setBusy(null);
    } catch (portalError) {
      portalWindow.close();
      setError(portalError instanceof Error
        ? portalError.message
        : 'Billing management is temporarily unavailable.');
      setBusy(null);
    }
  }

  const visibleOffers = offers.filter(offer =>
    includePremium || offer.kind !== 'premium_subscription',
  );
  const interpretationCreditCount = Number.isSafeInteger(interpretationCredits)
    && (interpretationCredits ?? 0) > 0
    ? interpretationCredits as number
    : null;

  return (
    <div className="zc-billing-offers" data-testid="panel-billing-offers">
      <p className="sr-only" role="status" aria-atomic="true" data-testid="status-billing-progress">
        {busy === 'portal' ? 'Opening secure Stripe billing in a new tab. Please wait.'
          : busy ? 'Opening secure Stripe Checkout in a new tab. Please wait.'
            : announcement}
      </p>
      {loading ? (
        <p className="zc-billing-note" role="status"><LoaderCircle size={14} className="zc-loading-icon" /> Loading current offers…</p>
      ) : visibleOffers.length === 0 && error ? null : visibleOffers.length === 0 ? (
        <p className="zc-billing-note" role="status">No active ZionCore offers are available in this Stripe environment.</p>
      ) : (
        <>
          <div className="zc-billing-grid">
            {visibleOffers.map(offer => (
              <article className={`zc-billing-offer ${offer.kind === 'premium_subscription' ? 'zc-billing-offer-premium' : ''}`} key={offer.key} data-testid={`offer-${offer.key}`}>
                <div>
                  <strong>{offer.kind === 'premium_subscription' ? 'ZionCore Premium' : offer.name}</strong>
                  <span>
                    {offer.kind === 'credit_pack'
                      ? `${offer.credits?.toLocaleString()} ZC credits${interpretationCreditCount && offer.credits
                        ? ` · ${Math.floor(offer.credits / interpretationCreditCount)} full reading${Math.floor(offer.credits / interpretationCreditCount) === 1 ? '' : 's'}${offer.credits % interpretationCreditCount ? ` + ${offer.credits % interpretationCreditCount} credits left` : ''} at the current quote`
                        : ''}`
                      : 'Monthly membership · compare saved sessions side by side · interpretation credits are separate'}
                  </span>
                  <b>{priceLabel(offer)}</b>
                </div>
                {offer.kind === 'premium_subscription' && !offer.purchasable && (
                  <span className="zc-premium-paused" role="status" data-testid="status-premium-checkout-paused">This membership offer is currently unavailable in this environment.</span>
                )}
                {user ? (
                  <button
                    className="btn btn-primary zc-billing-button"
                    type="button"
                    disabled={!checkoutEnabled || !offer.purchasable || !firebaseReady || projectMismatch || busy !== null}
                    aria-busy={busy === offer.key}
                    aria-label={billingOfferAccessibleName(busy === offer.key ? 'Opening secure checkout' : offer.purchasable
                      ? offer.kind === 'credit_pack' ? 'Buy credits' : 'Start Premium'
                      : 'Purchases paused', offer)}
                    aria-describedby={windowNoticeId}
                    onClick={() => void startCheckout(offer)}
                    data-testid={`button-checkout-${offer.key}`}
                  >
                    {busy === offer.key
                      ? <LoaderCircle className="zc-loading-icon" size={14} aria-hidden="true" />
                      : <CreditCard size={14} aria-hidden="true" />}
                    {busy === offer.key
                      ? 'Opening secure checkout…'
                      : offer.purchasable
                      ? offer.kind === 'credit_pack' ? 'Buy credits' : 'Start Premium'
                      : 'Purchases paused'}
                  </button>
                ) : (
                  offer.purchasable && checkoutEnabled
                    ? <Link className="btn btn-primary zc-billing-button" href="/history" aria-label={billingOfferAccessibleName('Sign in to buy', offer)} data-testid={`link-sign-in-${offer.key}`}>
                      Sign in to buy <ArrowUpRight size={14} aria-hidden="true" />
                    </Link>
                    : <button className="btn btn-primary zc-billing-button" type="button" disabled aria-label={billingOfferAccessibleName('Purchases paused', offer)}>Purchases paused</button>
                )}
              </article>
            ))}
          </div>
          {!user && (
            <div className="zc-billing-signup" data-testid="panel-billing-signup">
              <div>
                <strong>New to ZionCore?</strong>
                <p>Join free to start a private frequency journal. Creating an account does not subscribe you or make a purchase.</p>
              </div>
              <Link className="btn btn-subtle" href="/history" data-testid="link-billing-join-free">Create a free account <ArrowUpRight size={14} /></Link>
            </div>
          )}
          {showPortal && user && (
            <button
              className="btn btn-subtle zc-billing-portal"
              type="button"
              disabled={!portalEnabled || !firebaseReady || projectMismatch || busy !== null}
              aria-busy={busy === 'portal'}
              aria-describedby={windowNoticeId}
              onClick={() => void openPortal()}
              data-testid="button-manage-billing"
            >
              {busy === 'portal'
                ? <LoaderCircle className="zc-loading-icon" size={14} aria-hidden="true" />
                : <CreditCard size={14} aria-hidden="true" />}
              {busy === 'portal' ? 'Opening billing…' : 'Manage billing'}
            </button>
          )}
          {!checkoutEnabled && (
            <p className="zc-billing-note" role="note" data-testid="status-checkout-disabled">
              Prices are shown for reference, but purchases are paused in this environment.
            </p>
          )}
          {checkoutEnabled && visibleOffers.some(offer => !offer.purchasable) && (
            <p className="zc-billing-note" role="note" data-testid="status-offer-not-ready">
              Offers stay unavailable until the related paid feature and its server-side entitlement are ready.
            </p>
          )}
          {user && (!firebaseReady || projectMismatch) && (
            <p className="zc-billing-note" role="status">A configured Firebase sign-in is required before checkout.</p>
          )}
          {showPortal && user && portalEnabled && (
            <p className="zc-billing-note" role="note">
              The Stripe portal provides the billing controls enabled for your subscription, which may include cancellation and payment-method updates.
            </p>
          )}
          <p className="zc-billing-note" id={windowNoticeId}>Checkout and billing management open in a new tab. Return here to check your account after using Stripe.</p>
          <p className="zc-billing-note"><ShieldCheck size={14} aria-hidden="true" /> Stripe hosts checkout. Purchased credits are added only after a verified successful payment.</p>
          <p className="zc-billing-note">100 credits represent £1 of ZionCore service value. Credits are non-transferable usage units, not cash; bonus packs add extra usage credits.</p>
        </>
      )}
      {error && <p className="zc-billing-error" role="alert" data-testid="status-billing-error">{error}</p>}
    </div>
  );
}
