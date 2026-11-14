import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ResearchMissionsPage from '@/pages/research-missions';
import {
  createResearchMission,
  getResearchMissionStorageKey,
  readResearchMissions,
  researchMissionSchema,
  upsertResearchMission,
  writeResearchMissions,
} from '@/lib/research-missions';

function withMockLocalStorage(values: Map<string, string>, callback: () => void) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    },
  });
  try {
    callback();
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}

test('mission defaults are bounded, planning-only, and exclude sensitive devotional domains', () => {
  const mission = createResearchMission('2026-11-12T12:00:00.000Z');
  assert.equal(researchMissionSchema.safeParse(mission).success, true);
  assert.equal(mission.status, 'planned');
  assert.equal(mission.budget.maxObservationWindows, 5);
  assert.equal(mission.budget.maxCloudAiRequests, 0);
  assert.equal(mission.budget.plannedCostCeilingUsd, 0);
  assert.equal(mission.consent.localProcessing, false);
  assert.equal(mission.consent.cloudAiRequests, false);
  assert.throws(() => researchMissionSchema.parse({ ...mission, domainId: 'divine-devotional' }));
  assert.throws(() => researchMissionSchema.parse({ ...mission, domainId: 'ancestral-heritage' }));
});

test('cloud consent in a plan requires an explicit positive request and cost ceiling', () => {
  const mission = createResearchMission();
  const inconsistent = {
    ...mission,
    consent: { ...mission.consent, cloudAiRequests: true },
  };
  assert.equal(researchMissionSchema.safeParse(inconsistent).success, false);
  assert.equal(researchMissionSchema.safeParse({
    ...inconsistent,
    budget: { ...mission.budget, maxCloudAiRequests: 1, plannedCostCeilingUsd: 0.02 },
  }).success, true);
});

test('mission step IDs and resource budgets are validated', () => {
  const mission = createResearchMission();
  const duplicateSteps = { ...mission, steps: [mission.steps[0], mission.steps[0]] };
  assert.equal(researchMissionSchema.safeParse(duplicateSteps).success, false);
  assert.equal(researchMissionSchema.safeParse({
    ...mission,
    budget: { ...mission.budget, maxObservationWindows: 31 },
  }).success, false);
  assert.equal(researchMissionSchema.safeParse({
    ...mission,
    steps: Array.from({ length: 13 }, (_, index) => ({
      id: crypto.randomUUID(),
      title: `Step ${index}`,
      description: '',
      status: 'pending',
    })),
  }).success, false);
});

test('local mission archives are isolated by account scope and upsert preserves one record per mission ID', () => {
  const first = createResearchMission();
  const changed = { ...first, title: 'Revised mission title', updatedAt: '2026-11-12T12:05:00.000Z' };
  const storage = new Map<string, string>();
  withMockLocalStorage(storage, () => {
    writeResearchMissions('account-one', [first]);
    writeResearchMissions('account-two', []);
    assert.equal(readResearchMissions('account-one')[0]?.title, first.title);
    assert.deepEqual(readResearchMissions('account-two'), []);
    assert.deepEqual(upsertResearchMission([first], changed), [changed]);
    assert.equal(getResearchMissionStorageKey('account-one'), `${'zioncore.research-missions.v1'}.account-one`);
  });
});

test('invalid stored missions fail explicitly without rewriting the original browser copy', () => {
  const key = getResearchMissionStorageKey('account-invalid');
  const original = '{not-json';
  const storage = new Map([[key, original]]);
  withMockLocalStorage(storage, () => {
    assert.throws(() => readResearchMissions('account-invalid'), /stored copy was left unchanged/);
    assert.equal(storage.get(key), original);
    assert.throws(() => writeResearchMissions('account-invalid', [{
      ...createResearchMission(),
      budget: { maxObservationWindows: 900, maxCloudAiRequests: 0, plannedCostCeilingUsd: 0 },
    }]), /failed validation/);
    assert.equal(storage.get(key), original);
  });
});

test('mission page discloses local storage and keeps planning separate from results', () => {
  const html = renderToStaticMarkup(createElement(ResearchMissionsPage, { scopeRef: 'account-test' }));
  assert.match(html, /Local does not mean encrypted/);
  assert.match(html, /Do not enter prayer intentions, family details, or other sensitive content/);
  assert.match(html, /measured results and interpretations belong in separate records/);
  assert.match(html, /data-testid="notice-mission-safety"/);
});
