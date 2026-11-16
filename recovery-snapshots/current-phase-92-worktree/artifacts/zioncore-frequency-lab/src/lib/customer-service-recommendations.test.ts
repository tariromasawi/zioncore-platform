import assert from 'node:assert/strict';
import test from 'node:test';
import {
  customerServiceGoals,
  getCustomerServiceRecommendation,
} from './customer-service-recommendations';

const implementedRoutes = new Set([
  '/',
  '/devices',
  '/messages',
  '/discover',
  '/premium',
]);

test('every customer goal leads to a real implemented service route', () => {
  for (const goal of customerServiceGoals) {
    const recommendation = getCustomerServiceRecommendation(goal);
    assert.ok(recommendation.label.length > 0);
    assert.ok(recommendation.title.length > 0);
    assert.ok(implementedRoutes.has(recommendation.primary.href), `${goal} primary route`);
    if (recommendation.secondary) {
      assert.ok(implementedRoutes.has(recommendation.secondary.href), `${goal} secondary route`);
    }
  }
});

test('paid interpretation recommendations explain quote approval before work', () => {
  for (const goal of ['frequency', 'spiritual'] as const) {
    const recommendation = getCustomerServiceRecommendation(goal);
    assert.ok(recommendation.steps.some(step => /quote|approve/i.test(step)));
  }
});

test('Premium and local comparisons are described as distinct journeys', () => {
  const free = getCustomerServiceRecommendation('compare');
  const premium = getCustomerServiceRecommendation('compare', true);
  assert.equal(free.primary.href, '/discover');
  assert.equal(free.secondary?.href, '/premium');
  assert.equal(premium.primary.href, '/premium');
  assert.equal(premium.secondary?.href, '/discover');
  assert.match(premium.summary, /does not request another AI reading or spend interpretation credits/);
});

test('message and celestial paths never claim a confirmed external response', () => {
  const message = getCustomerServiceRecommendation('message');
  const celestial = getCustomerServiceRecommendation('celestial');
  assert.equal(message.primary.href, '/messages');
  assert.equal(celestial.primary.href, '/messages');
  assert.match(celestial.summary, /separate observation/);
});
