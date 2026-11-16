import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { isChunkLoadError } from './chunk-load-error';
import { connectivityState, reduceConnectivity } from './connectivity-state';
import { ZionCoreErrorFallback } from '../components/error-boundary';

test('recognizes common failed JavaScript and CSS downloads without labelling ordinary errors as chunk failures', () => {
  for (const message of [
    'Failed to fetch dynamically imported module: /assets/old.js',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/page.css',
    'Loading chunk 42 failed.',
  ]) assert.equal(isChunkLoadError(new Error(message)), true);
  assert.equal(isChunkLoadError(Object.assign(new Error('asset'), { name: 'ChunkLoadError' })), true);
  assert.equal(isChunkLoadError(new Error('An ordinary calculation failed')), false);
  assert.equal(isChunkLoadError(new TypeError('Failed to fetch')), false);
});

test('failed lazy downloads offer a fresh reload, not a cached rendering retry', () => {
  const html = renderToStaticMarkup(createElement(ZionCoreErrorFallback, {
    error: new Error('Failed to fetch dynamically imported module: private-debug-marker'),
    resetError: () => {},
  }));
  assert.match(html, /button-reload-zioncore/);
  assert.match(html, /link-error-lab/);
  assert.doesNotMatch(html, /button-retry-view|private-debug-marker/);
  assert.match(html, /unsaved recordings and edits/);
  assert.match(html, /existing recovery flow/);
});

test('ordinary display failures retain a render retry without exposing their raw payload', () => {
  const html = renderToStaticMarkup(createElement(ZionCoreErrorFallback, {
    error: new Error('private-debug-marker'), resetError: () => {},
  }));
  assert.match(html, /button-retry-view/);
  assert.match(html, /button-reload-zioncore/);
  assert.doesNotMatch(html, /private-debug-marker|rest of the app is still/);
});

test('a browser that starts online does not show a spurious restored notice', () => {
  const state = connectivityState(false);
  assert.equal(reduceConnectivity(state, 'online'), state);
});

test('offline and restored notices follow the connection lifecycle and can be dismissed', () => {
  const offline = reduceConnectivity(connectivityState(false), 'offline');
  assert.deepEqual(offline, { offline: true, restored: false });
  assert.deepEqual(reduceConnectivity(offline, 'dismiss'), offline);
  const restored = reduceConnectivity(offline, 'online');
  assert.deepEqual(restored, { offline: false, restored: true });
  assert.deepEqual(reduceConnectivity(restored, 'dismiss'), { offline: false, restored: false });
  assert.deepEqual(reduceConnectivity(restored, 'offline'), { offline: true, restored: false });
});
