import assert from 'node:assert/strict';
import test from 'node:test';
import { getEventListeners } from 'node:events';
import { fetchJsonWithDeadline, RequestDeadlineError } from './request-json';

test('JSON requests retain request settings, return the response and detach abort listeners', async () => {
  const controller = new AbortController();
  const fetcher: typeof fetch = async (_url, init) => {
    assert.equal(init?.method, 'POST');
    assert.equal(new Headers(init?.headers).get('Idempotency-Key'), 'same-job');
    assert.equal(init?.body, '{"safe":true}');
    return Response.json({ completed: true });
  };
  const result = await fetchJsonWithDeadline('/safe', {
    method: 'POST', headers: { 'Idempotency-Key': 'same-job' },
    body: '{"safe":true}', signal: controller.signal,
  }, 1000, fetcher);
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, { completed: true });
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('stalled headers reach a deadline and abort the request', async () => {
  let signal: AbortSignal | undefined;
  const fetcher: typeof fetch = (_url, init) => {
    signal = init?.signal ?? undefined;
    return new Promise(() => {});
  };
  await assert.rejects(fetchJsonWithDeadline('/stalled', {}, 10, fetcher), RequestDeadlineError);
  assert.equal(signal?.aborted, true);
});

test('the deadline also bounds a stalled response body', async () => {
  const fetcher = async () => ({
    status: 200, ok: true, json: () => new Promise(() => {}),
  }) as Response;
  await assert.rejects(fetchJsonWithDeadline('/stalled-body', {}, 10, fetcher), RequestDeadlineError);
});

test('non-JSON error responses remain available for status-based handling', async () => {
  const result = await fetchJsonWithDeadline('/unavailable', {}, 1000,
    async () => new Response('<html>Unavailable</html>', { status: 503 }));
  assert.equal(result.response.status, 503);
  assert.equal(result.body, null);
});

test('cancelling an active request rejects promptly and removes its listener', async () => {
  const controller = new AbortController();
  const pending = fetchJsonWithDeadline('/cancel', { signal: controller.signal }, 1000,
    () => new Promise(() => {}));
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('already cancelled requests never reach the network', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchJsonWithDeadline('/never', { signal: controller.signal }, 1000,
    async () => { throw new Error('must not run'); }), { name: 'AbortError' });
});

test('network failure propagates without automatically retrying or changing payment identity', async () => {
  let attempts = 0;
  const failure = new TypeError('Network unavailable');
  await assert.rejects(fetchJsonWithDeadline('/paid', {}, 1000, async () => {
    attempts += 1; throw failure;
  }), error => error === failure);
  assert.equal(attempts, 1);
});
