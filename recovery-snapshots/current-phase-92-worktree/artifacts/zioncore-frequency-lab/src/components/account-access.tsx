import React, { useState, type FormEvent } from 'react';
import { AlertCircle, KeyRound, LogIn, LogOut, UserRoundPlus } from 'lucide-react';
import {
  canManageStripeBilling, isPremiumEntitled, membershipDisplayLabel,
  type MembershipSnapshot,
} from '@/lib/membership-model';
import type { SocialAuthProvider } from '@/lib/firebase-auth';

type AccountAccessProps = {
  configured: boolean;
  projectMismatch: boolean;
  userEmail: string | null;
  membership: MembershipSnapshot | null;
  membershipLoading: boolean;
  membershipError: string;
  busy: boolean;
  error: string;
  statusMessage?: string;
  onAuth(mode: 'sign-in' | 'create', email: string, password: string): Promise<void>;
  onProviderAuth(provider: SocialAuthProvider): Promise<void>;
  onSignOut(): Promise<void>;
};

export function AccountAccess({
  configured,
  projectMismatch,
  userEmail,
  membership,
  membershipLoading,
  membershipError,
  busy,
  error,
  statusMessage,
  onAuth,
  onProviderAuth,
  onSignOut,
}: AccountAccessProps) {
  const [mode, setMode] = useState<'sign-in' | 'create'>('create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!configured || projectMismatch || busy) return;
    await onAuth(mode, email.trim(), password);
  };

  const signOut = async () => {
    if (!busy) await onSignOut();
  };

  return (
    <section className="panel zc-account" aria-labelledby="zc-account-title" data-testid="panel-account-access">
      <div className="panel-head">
          <h2 className="panel-title" id="zc-account-title" style={{ margin: 0 }}>Your ZionCore account</h2>
        <KeyRound size={16} aria-hidden="true" />
      </div>
      <div className="section-body">
        <p className="sr-only" role="status" aria-atomic="true" data-testid="status-account-busy">
          {busy ? userEmail ? 'Signing out. Please wait.' : 'Connecting your account. Please wait.' : ''}
        </p>
        {projectMismatch && (
          <div className="zc-callout zc-callout-alert" role="alert" data-testid="status-project-mismatch">
            <AlertCircle size={15} aria-hidden="true" />
            <span>This sign-in configuration does not match this project. Cloud access is paused.</span>
          </div>
        )}
        {!configured && (
          <div className="zc-callout" role="status" data-testid="status-account-unconfigured">
            <span>Cloud history is not configured. Your local measurements remain available in this browser.</span>
          </div>
        )}
        {statusMessage && (
          <div className="zc-callout" role="status" data-testid="status-account-setup">
            <span>{statusMessage}</span>
          </div>
        )}
        {error && (
          <div className="zc-callout zc-callout-alert" role="alert" data-testid="status-account-error">
            <AlertCircle size={15} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {userEmail ? (
          <div className="zc-account-signed-in">
            <span className="zc-field-label">Signed in as</span>
            <strong className="zc-account-email" data-testid="text-account-email">{userEmail}</strong>
            <div className="zc-membership" data-testid="panel-membership-status" aria-live="polite">
              <div className="zc-membership-heading">
                <span className="zc-field-label">Membership</span>
                <span className={`zc-membership-badge ${membership && isPremiumEntitled(membership) ? 'premium' : ''}`}>
                  {membershipLoading
                    ? 'Checking'
                    : membershipError
                      ? 'Unavailable'
                      : membership
                        ? membershipDisplayLabel(membership)
                        : 'Free'}
                </span>
              </div>
              {membershipLoading ? (
                <p className="zc-membership-note">Checking the server-managed membership record…</p>
              ) : membershipError ? (
                <p className="zc-membership-note" role="status">{membershipError}</p>
              ) : membership && isPremiumEntitled(membership) ? (
                <p className="zc-membership-note">
                  Premium access is active through {new Date(membership.accessUntil!).toLocaleDateString()}.
                  {membership.cancelAtPeriodEnd ? ' It is set to end after this paid period.' : ''}
                  {' '}Manage your subscription from the Wallet page.
                </p>
              ) : membership && canManageStripeBilling(membership) ? (
                <p className="zc-membership-note">
                  Your Stripe membership status is {membershipDisplayLabel(membership).toLowerCase()}. Premium tools remain locked unless current access is verified. Visit Wallet to manage billing.
                </p>
              ) : (
                <p className="zc-membership-note">
                  You’re on the free account. Credit packs and Premium are optional; account benefits change only after Stripe verifies payment.
                </p>
              )}
            </div>
            <p className="permission-note">Your cloud history is tied to this account. Microphone audio is never uploaded.</p>
            <button
              className="btn btn-subtle"
              type="button"
              onClick={() => void signOut()}
              disabled={busy}
              data-testid="button-account-sign-out"
            >
              <LogOut size={14} />
              {busy ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        ) : (
          <>
            <div className="zc-auth-tabs" role="group" aria-label="Account action">
              <button
                className={`zc-auth-tab ${mode === 'sign-in' ? 'active' : ''}`}
                type="button"
                aria-pressed={mode === 'sign-in'}
                onClick={() => setMode('sign-in')}
                disabled={busy}
                data-testid="button-account-mode-sign-in"
              >
                Sign in
              </button>
              <button
                className={`zc-auth-tab ${mode === 'create' ? 'active' : ''}`}
                type="button"
                aria-pressed={mode === 'create'}
                onClick={() => setMode('create')}
                disabled={busy}
                data-testid="button-account-mode-create"
              >
                Join free
              </button>
            </div>
            <div className="zc-account-intro" data-testid="text-account-promo">
              <strong>{mode === 'create' ? 'Start your listening journal.' : 'Welcome back to your listening journal.'}</strong>
              <p>{mode === 'create'
                ? 'Create a free account to save selected frequency observations to your private archive and revisit them across devices.'
                : 'Sign in to return to your saved observations and continue exploring your frequency patterns.'}</p>
            </div>
            <form className="zc-auth-form" aria-label={mode === 'create' ? 'Create a free account' : 'Sign in to your account'} aria-busy={busy} onSubmit={event => void submit(event)}>
              <label className="zc-field-label" htmlFor="zc-account-email-input">Email address</label>
              <input
                id="zc-account-email-input"
                className="select-control"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
                disabled={!configured || projectMismatch || busy}
                placeholder="you@example.org"
                data-testid="input-account-email"
              />
              <label className="zc-field-label" htmlFor="zc-account-password-input">Password</label>
              <input
                id="zc-account-password-input"
                className="select-control"
                type="password"
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                aria-describedby="zc-account-password-help"
                minLength={6}
                required
                value={password}
                onChange={event => setPassword(event.target.value)}
                disabled={!configured || projectMismatch || busy}
                placeholder="At least 6 characters"
                data-testid="input-account-password"
              />
              <p className="permission-note" id="zc-account-password-help">Use at least 6 characters. {mode === 'create' ? 'Choose a password unique to your account.' : 'Enter your existing account password.'}</p>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={!configured || projectMismatch || busy}
                data-testid="button-account-submit"
              >
                {mode === 'sign-in' ? <LogIn size={15} /> : <UserRoundPlus size={15} />}
                {busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in to my archive' : 'Create my free account'}
              </button>
              <p className="permission-note">Signing up is free and does not start a subscription. Microphone audio stays on this device; only observations you choose to save are added to your archive.</p>
            </form>
            <div className="zc-provider-auth" role="group" aria-label="Other sign-in methods">
              <div className="zc-provider-divider"><span>{mode === 'create' ? 'or join with' : 'or continue with'}</span></div>
              <div className="zc-provider-buttons">
                <button
                  className="btn btn-subtle zc-provider-button"
                  type="button"
                  onClick={() => void onProviderAuth('google')}
                  disabled={!configured || projectMismatch || busy}
                  data-testid="button-sign-in-google"
                >
                  <span className="zc-provider-mark google" aria-hidden="true">G</span>
                  {mode === 'create' ? 'Join with Google' : 'Continue with Google'}
                </button>
                <button
                  className="btn btn-subtle zc-provider-button"
                  type="button"
                  onClick={() => void onProviderAuth('apple')}
                  disabled={!configured || projectMismatch || busy}
                  data-testid="button-sign-in-apple"
                >
                  <span className="zc-provider-mark apple" aria-hidden="true">A</span>
                  {mode === 'create' ? 'Join with Apple ID' : 'Continue with Apple ID'}
                </button>
              </div>
              <p className="permission-note">
                Use Google or Apple ID (including an iCloud account). Your first provider sign-in creates your ZionCore account.
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default AccountAccess;
