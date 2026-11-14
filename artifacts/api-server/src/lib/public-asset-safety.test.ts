import assert from 'node:assert/strict';
import { once } from 'node:events';
import { PassThrough, pipeline } from 'node:stream';
import test from 'node:test';
import { ownPublicAsset, stopAssetOnDisconnect } from './public-asset-safety';

test('public asset lookup rejects inherited and unknown names', () => {
  const assets = Object.freeze({ allowed: { objectPath: 'public/original.png' } });
  assert.equal(ownPublicAsset(assets, 'allowed'), assets.allowed);
  for (const key of ['__proto__', 'constructor', 'toString', 'missing', '../private']) {
    assert.equal(ownPublicAsset(assets, key), undefined);
  }
});

test('disconnecting a visitor destroys the upstream asset stream and removes its listener', async () => {
  const source = new PassThrough();
  const response = new PassThrough();
  stopAssetOnDisconnect(source, response);
  const closed = once(source, 'close');
  response.emit('close');
  await closed;
  assert.equal(source.destroyed, true);
  assert.equal(response.listenerCount('close'), 0);
  response.destroy();
});

test('normal source completion leaves no accumulated response listeners', async () => {
  const response = new PassThrough();
  for (let index = 0; index < 20; index++) {
    const source = new PassThrough();
    stopAssetOnDisconnect(source, response);
    const closed = once(source, 'close');
    source.destroy();
    await closed;
    assert.equal(response.listenerCount('close'), 0);
  }
  response.destroy();
});

test('an already disconnected visitor cannot leave a newly created storage stream running', async () => {
  const source = new PassThrough();
  const response = new PassThrough();
  response.destroy();
  const closed = once(source, 'close');
  stopAssetOnDisconnect(source, response);
  await closed;
  assert.equal(source.destroyed, true);
});

test('a cancelled download waits until the storage response pipeline can be established', async () => {
  const source = new PassThrough();
  const response = new PassThrough();
  const network = new PassThrough();
  stopAssetOnDisconnect(source, response, { waitForStorageResponse: true });
  response.emit('close');
  assert.equal(source.destroyed, false, 'do not break a pending SDK response callback');
  source.emit('response', {});
  assert.equal(source.destroyed, false, 'the SDK must finish its synchronous response handler first');
  await new Promise<void>(resolve => {
    assert.doesNotThrow(() => pipeline(network, source, () => resolve()));
  });
  assert.equal(source.destroyed, true);
  assert.equal(network.destroyed, true);
  assert.equal(response.listenerCount('close'), 0);
  assert.equal(source.listenerCount('response'), 0);
  response.destroy();
});

test('an already disconnected response is cancelled safely after delayed storage headers', async () => {
  const source = new PassThrough();
  const response = new PassThrough();
  response.destroy();
  stopAssetOnDisconnect(source, response, { waitForStorageResponse: true });
  assert.equal(source.destroyed, false);
  const closed = once(source, 'close');
  source.emit('response', {});
  await closed;
  assert.equal(source.destroyed, true);
  assert.equal(response.listenerCount('close'), 0);
});
