import assert from 'node:assert/strict';
import test from 'node:test';
import {
  trackEvent, trackGuideArticleOpen, trackGuideCtaClick, trackSignupSuccess,
} from './project-analytics';

function withWindow(value: unknown, callback: () => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value });
  try {
    callback();
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
}

test('missing analytics is a safe no-op', () => {
  withWindow({}, () => {
    assert.doesNotThrow(() => trackEvent('guide_article_open', { route: 'discover' }));
  });
});

test('analytics exceptions never interrupt a user action', () => {
  withWindow({ umami: { track: () => { throw new Error('tracker unavailable'); } } }, () => {
    assert.doesNotThrow(() => trackGuideCtaClick('closing', 'signup'));
    assert.doesNotThrow(() => trackSignupSuccess('email_password'));
  });
});

test('guide and signup events contain only approved non-sensitive dimensions', () => {
  const events: Array<{ name: string; data?: Record<string, string | number | boolean> }> = [];
  withWindow({
    umami: {
      track: (name: string, data?: Record<string, string | number | boolean>) => events.push({ name, data }),
    },
  }, () => {
    trackGuideArticleOpen('fft-resolution');
    trackGuideCtaClick('hero', 'live_lab');
    trackSignupSuccess('apple');
  });

  assert.deepEqual(events, [
    { name: 'guide_article_open', data: { route: 'discover', topic: 'fft-resolution', action: 'open' } },
    { name: 'guide_cta_click', data: { route: 'discover', action: 'click', placement: 'hero', destination: 'live_lab' } },
    { name: 'signup_success', data: { outcome: 'success', method: 'apple' } },
  ]);
});
