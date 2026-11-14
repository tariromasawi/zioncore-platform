import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccountAccess } from '../components/account-access';
import { FREE_MEMBERSHIP } from './membership-model';

const base = {
  configured: true,
  projectMismatch: false,
  userEmail: null,
  membership: null,
  membershipLoading: false,
  membershipError: '',
  busy: false,
  error: '',
  onAuth: async () => {},
  onProviderAuth: async () => {},
  onSignOut: async () => {},
};

test('signup fields retain native labels, autocomplete and linked password instructions', () => {
  const html = renderToStaticMarkup(createElement(AccountAccess, base));
  assert.match(html, /aria-label="Create a free account"/);
  assert.match(html, /for="zc-account-email-input"/);
  assert.match(html, /autoComplete="email"/i);
  assert.match(html, /for="zc-account-password-input"/);
  assert.match(html, /aria-describedby="zc-account-password-help"/);
  assert.match(html, /id="zc-account-password-help"/);
  assert.match(html, /autoComplete="new-password"/i);
});

test('account operations expose a persistent status region and busy form', () => {
  const idle = renderToStaticMarkup(createElement(AccountAccess, base));
  assert.match(idle, /role="status" aria-atomic="true" data-testid="status-account-busy"/);
  const busy = renderToStaticMarkup(createElement(AccountAccess, { ...base, busy: true }));
  assert.match(busy, /Connecting your account/);
  assert.match(busy, /aria-busy="true"/);
  assert.match(busy, /disabled=""/);
});

test('account and membership errors remain explicit rather than appearing as Free', () => {
  const html = renderToStaticMarkup(createElement(AccountAccess, {
    ...base, userEmail: 'example@example.invalid', membership: FREE_MEMBERSHIP,
    membershipError: 'Membership cannot be verified.', error: 'Account connection failed.',
  }));
  assert.match(html, /role="alert"/);
  assert.match(html, /Account connection failed/);
  assert.match(html, /Membership cannot be verified/);
  assert.match(html, /Unavailable/);
});
