import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Router } from 'wouter';
import CustomerDashboard from '@/pages/customer-dashboard';
import type { Observation } from '@/lib/observations';

const base = {
  profile: { email: null, displayName: null, emailVerified: false, providers: [] },
  observations: [],
  researchSessions: [],
  loading: false,
  authError: '',
  dataError: '',
};

function render(overrides: Partial<Parameters<typeof CustomerDashboard>[0]> = {}) {
  return renderToStaticMarkup(createElement(
    Router,
    { ssrPath: '/dashboard' },
    createElement(CustomerDashboard, { ...base, ...overrides }),
  ));
}

test('an empty account shows a true research zero without inventing financial balances', () => {
  const html = render();
  assert.match(html, /data-testid="value-dashboard-record-count">0</);
  assert.match(html, /empty-dashboard-observations/);
  assert.match(html, /empty-dashboard-sessions/);
  assert.match(html, /Credit balance and usage are unavailable/);
  assert.match(html, /No entitlement is being inferred/);
});

test('a partial profile has safe fallbacks without inferring verification or providers', () => {
  const html = render();
  assert.match(html, /data-testid="text-dashboard-display-name">Researcher</);
  assert.match(html, /Email address unavailable/);
  assert.match(html, /Email not verified/);
  assert.match(html, /Sign-in provider unavailable/);
});

test('loading and signed-out accounts never display supplied private records or false zeros', () => {
  const privateObservation: Observation = {
    id: 'private-test-record', notes: 'private-notes-must-stay-hidden',
    createdAt: '2026-11-11T10:00:00.000Z', sampleRate: 48000,
    fftSize: 4096, frequencyResolutionHz: 48000 / 4096,
    dominantFrequencyHz: null, topPeaksHz: [], rmsLevel: 0,
    durationSeconds: 8, mode: 'microphone',
  };
  for (const overrides of [{ loading: true }, { profile: null }]) {
    const html = render({ observations: [privateObservation], ...overrides });
    assert.doesNotMatch(html, /value-dashboard-record-count/);
    assert.doesNotMatch(html, /empty-dashboard-observations/);
    assert.doesNotMatch(html, /row-dashboard-observation/);
    assert.doesNotMatch(html, /private-test-record|private-notes-must-stay-hidden/);
  }
});

test('one failed source stays unavailable while a successfully read empty source stays empty', () => {
  const html = render({
    dataError: 'Observation storage unavailable.',
    observationError: 'Observation storage unavailable.',
    researchSessionsError: '',
    onExport: () => {},
  });
  assert.match(html, /value-dashboard-record-count">—</);
  assert.match(html, /status-dashboard-observation-read-warning/);
  assert.doesNotMatch(html, /empty-dashboard-observations/);
  assert.match(html, /empty-dashboard-sessions/);
  assert.match(html, /disabled="" data-testid="button-export-account-data"/);
});

test('a valid observation remains visible when the separate session source fails', () => {
  const observation: Observation = {
    id: 'saved-measurement', createdAt: '2026-11-11T10:00:00.000Z',
    sampleRate: 48000, fftSize: 4096, frequencyResolutionHz: 48000 / 4096,
    dominantFrequencyHz: null, topPeaksHz: [], rmsLevel: 0,
    durationSeconds: 8, mode: 'microphone',
  };
  const html = render({
    observations: [observation],
    dataError: 'Sessions unavailable.',
    observationError: '',
    researchSessionsError: 'Sessions unavailable.',
  });
  assert.match(html, /row-dashboard-observation-saved-measurement/);
  assert.match(html, /status-dashboard-session-read-warning/);
  assert.doesNotMatch(html, /empty-dashboard-sessions/);
  assert.match(html, /value-dashboard-record-count">—</);
});

test('authenticated dashboard offers only exact-provenance interpretation comparisons', () => {
  const withInterpretation = (id: string, provenanceId = id): Observation => ({
    id,
    createdAt: '2026-11-11T10:00:00.000Z',
    sampleRate: 48000,
    fftSize: 4096,
    frequencyResolutionHz: 48000 / 4096,
    dominantFrequencyHz: 440.625,
    topPeaksHz: [440.625],
    rmsLevel: 0.12,
    durationSeconds: 8,
    mode: 'microphone',
    notes: `private-notes-${id}`,
    interpretation: {
      scientificInterpretation: `Saved hypothesis ${id}.`,
      confidence: 'low',
      uncertainty: 'Source remains unknown.',
      possibleSources: ['Room tone'],
      faithReflection: `private-reflection-${id}`,
      model: 'gemini-3.5-flash-lite',
      provenance: {
        source: 'ai-generated',
        observationId: provenanceId,
        methodId: 'frequency-measurement-explanation',
        methodVersion: '1.0.0',
        promptVersion: '1.0.0',
        provider: 'firebase-ai-google',
        modelId: 'gemini-3.5-flash-lite',
        generatedAt: '2026-11-11T10:05:00.000Z',
      },
    },
  });

  const html = render({
    observations: [
      withInterpretation('saved-ai-one'),
      withInterpretation('saved-ai-two'),
      withInterpretation('mismatched-provenance', 'different-observation'),
    ],
  });
  assert.match(html, /panel-interpretation-comparison/);
  assert.match(html, /checkbox-comparison-record-saved-ai-one/);
  assert.match(html, /checkbox-comparison-record-saved-ai-two/);
  assert.doesNotMatch(html, /checkbox-comparison-record-mismatched-provenance/);
  assert.match(html, /Agreement is not evidence/);
  assert.doesNotMatch(html, /private-reflection-/);
});
