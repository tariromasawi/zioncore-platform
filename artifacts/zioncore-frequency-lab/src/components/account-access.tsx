import { useState, type FormEvent } from 'react';
import { AlertCircle, KeyRound, LogIn, LogOut, UserRoundPlus } from 'lucide-react';

type AccountAccessProps = {
  heading?: string;
  footnote?: string;
  configured: boolean;
  projectMismatch: boolean;
  userEmail: string | null;
  googleConnected: boolean;
  busy: boolean;
  error: string;
  statusMessage?: string;
  onAuth(mode: 'sign-in' | 'create', email: string, password: string): Promise<void>;
  onGoogleAuth(): Promise<void>;
  onPasswordReset(email: string): Promise<void>;
  onSignOut(): Promise<void>;
};

export function AccountAccess({
  heading = 'Account cloud history',
  footnote = 'Account access is optional. This panel does not upload microphone audio.',
  configured,
  projectMismatch,
  userEmail,
  googleConnected,
  busy,
  error,
  statusMessage,
  onAuth,
  onGoogleAuth,
  onPasswordReset,
  onSignOut,
}: AccountAccessProps) {
  const [mode, setMode] = useState<'sign-in' | 'create'>('sign-in');
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
        <span className="panel-title" id="zc-account-title">{heading}</span>
        <KeyRound size={16} aria-hidden="true" />
      </div>
      <div className="section-body">
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
            <p className="permission-note">Your cloud history is tied to this account. Microphone audio is never uploaded.</p>
            {googleConnected ? (
              <p className="permission-note" data-testid="status-google-connected">Google sign-in is connected to this account.</p>
            ) : (
              <>
                <p className="permission-note">Connect Google to keep using this same account and its permissions.</p>
                <button
                  className="btn btn-subtle"
                  type="button"
                  onClick={() => void onGoogleAuth()}
                  disabled={!configured || projectMismatch || busy}
                  data-testid="button-google-link"
                >
                  {busy ? 'Redirecting…' : 'Connect Google account'}
                </button>
              </>
            )}
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
            <button
              className="btn btn-subtle"
              type="button"
              onClick={() => void onGoogleAuth()}
              disabled={!configured || projectMismatch || busy}
              data-testid="button-google-auth"
            >
              {busy ? 'Redirecting…' : 'Continue with Google'}
            </button>
            <p className="permission-note" data-testid="text-google-link-guidance">
              If you already have a password account, sign in with it first and connect Google to preserve that account.
            </p>
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
                Create account
              </button>
            </div>
            <form className="zc-auth-form" onSubmit={event => void submit(event)}>
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
                minLength={6}
                required
                value={password}
                onChange={event => setPassword(event.target.value)}
                disabled={!configured || projectMismatch || busy}
                placeholder="At least 6 characters"
                data-testid="input-account-password"
              />
              <button
                className="btn btn-primary"
                type="submit"
                disabled={!configured || projectMismatch || busy}
                data-testid="button-account-submit"
              >
                {mode === 'sign-in' ? <LogIn size={15} /> : <UserRoundPlus size={15} />}
                {busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
              </button>
              {mode === 'sign-in' && (
                <button
                  className="btn btn-subtle"
                  type="button"
                  onClick={() => void onPasswordReset(email.trim())}
                  disabled={!configured || projectMismatch || busy || !email.trim()}
                  data-testid="button-password-reset"
                >
                  Send password reset link
                </button>
              )}
              <p className="permission-note">{footnote}</p>
            </form>
          </>
        )}
      </div>
    </section>
  );
}

export default AccountAccess;
