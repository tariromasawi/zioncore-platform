import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAccountExport } from '@/lib/account-export';
import type { Observation } from '@/lib/observations';
import type { ResearchSession } from '@/lib/celestial-experiment';

const observation = {
  id: 'account-observation',
  createdAt: '2026-11-11T10:00:00.000Z',
  sampleRate: 48000,
  fftSize: 4096,
  frequencyResolutionHz: 48000 / 4096,
  dominantFrequencyHz: 440.625,
  topPeaksHz: [440.625],
  rmsLevel: 0.12,
  durationSeconds: 8.4,
  mode: 'microphone',
} as Observation;

const researchSession = {
  id: 'account-session',
  title: 'Saved research',
} as ResearchSession;

test('account export includes only supplied account records and reports unavailable sources', () => {
  const result = createAccountExport({
    profile: {
      email: 'researcher@example.test',
      displayName: 'Researcher',
      emailVerified: true,
      providers: ['google.com'],
    },
    accountDeviceObservations: [observation],
    accountCloudObservations: null,
    accountResearchSessions: [researchSession],
    exportedAt: '2026-11-11T10:00:00.000Z',
  });

  assert.equal(result.format, 'zioncore.account-export');
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.account.email, 'researcher@example.test');
  assert.deepEqual(result.records.accountDeviceObservations, [observation]);
  assert.deepEqual(result.records.accountResearchSessions, [researchSession]);
  assert.equal(result.records.accountCloudObservations, null);
  assert.equal(result.coverage.cloudHistoryIncluded, false);
  assert.equal(result.coverage.creditsAndMembershipIncluded, false);
  assert.equal(result.coverage.rawAudioIncluded, false);
  assert.ok(!('uid' in result.account));
});

test('account export distinguishes an available empty cloud archive from an unavailable one', () => {
  const result = createAccountExport({
    profile: {
      email: null,
      displayName: null,
      emailVerified: false,
      providers: [],
    },
    accountDeviceObservations: [],
    accountCloudObservations: [],
    accountResearchSessions: [],
    exportedAt: '2026-11-11T10:00:00.000Z',
  });

  assert.equal(result.coverage.cloudHistoryIncluded, true);
  assert.deepEqual(result.records.accountCloudObservations, []);
});
