import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessPlaybackStudy, type PlaybackStudyDraft } from '@/lib/playback-study';

const completePlan: PlaybackStudyDraft = {
  protocolName: 'Low-disturbance pilot',
  targetTaxon: 'Locally verified focal species',
  habitat: 'field',
  stimulusDescription: 'Researcher-created, low-complexity control and test signals.',
  sourceRightsReviewed: true,
  playbackLevelDbSPL: 70,
  ambientLevelDbA: 50,
  measurementDistanceMeters: 10,
  calibrationReference: 'Calibrated sound meter; certificate recorded with research team.',
  trialDurationSeconds: 20,
  trialsPerSession: 2,
  sessionsPerDay: 1,
  restIntervalSeconds: 180,
  restIntervalRationale: '',
  baselinePlan: 'Record a passive baseline before any proposed field activity.',
  controlPlan: 'Use a silent control condition and compare with baseline.',
  observerPlan: 'Qualified observer remains with line of sight and can halt immediately.',
  stopCriteria: 'Stop on pre-defined species-appropriate avoidance, distress, or disrupted activity.',
  localReviewReference: 'Local authority guidance and permit status recorded in study files.',
  localRequirementsReviewed: true,
  locationPrivacyReviewed: true,
};

test('complete study can be exported only as ready for qualified review, never as approved', () => {
  const result = assessPlaybackStudy(completePlan);
  assert.equal(result.readyForQualifiedReview, true);
  assert.equal(Object.hasOwn(result, 'approved'), false);
  assert.equal(result.playbackSecondsPerDay, 40);
  assert.equal(result.scheduledWindowSecondsPerDay, 220);
  assert.equal(result.study?.habitat, 'field');
  assert.equal(result.study && 'latitude' in result.study, false);
});

test('missing calibrated level, habitat, or safeguards blocks review readiness', () => {
  const result = assessPlaybackStudy({
    ...completePlan,
    habitat: '',
    playbackLevelDbSPL: undefined,
    localRequirementsReviewed: false,
    stopCriteria: '',
  });
  assert.equal(result.readyForQualifiedReview, false);
  assert.ok(result.issues.some(issue => issue.includes('habitat')));
  assert.ok(result.issues.some(issue => issue.includes('Target sound level')));
  assert.ok(result.issues.some(issue => issue.toLowerCase().includes('stop criteria')));
  assert.ok(result.issues.some(issue => issue.includes('local animal ethics')));
  assert.equal(result.playbackSecondsPerDay, null);
});

test('invalid exposure schedule bounds are rejected without assigning safety thresholds', () => {
  const tooLong = assessPlaybackStudy({ ...completePlan, trialDurationSeconds: 3_601 });
  assert.equal(tooLong.readyForQualifiedReview, false);
  assert.ok(tooLong.issues.some(issue => issue.includes('less than or equal to 3600')));

  const zeroDistance = assessPlaybackStudy({ ...completePlan, measurementDistanceMeters: 0 });
  assert.equal(zeroDistance.readyForQualifiedReview, false);
  assert.ok(zeroDistance.issues.some(issue => issue.includes('Distance must be greater than zero')));
});

test('zero rest between trials requires a protocol-specific explanation', () => {
  const missingReason = assessPlaybackStudy({ ...completePlan, restIntervalSeconds: 0 });
  assert.equal(missingReason.readyForQualifiedReview, false);
  assert.ok(missingReason.issues.some(issue => issue.includes('no rest between trials')));

  const explained = assessPlaybackStudy({
    ...completePlan,
    restIntervalSeconds: 0,
    restIntervalRationale: 'Justified in the approved protocol.',
  });
  assert.equal(explained.readyForQualifiedReview, true);
});
