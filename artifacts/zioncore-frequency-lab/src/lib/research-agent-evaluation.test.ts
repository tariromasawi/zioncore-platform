import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ResearchAgentEvaluationPanel from '@/components/research-agent-evaluation-panel';
import { runResearchAgentEvaluation } from '@/lib/research-agent-evaluation';

test('labeled agent evaluation covers arithmetic, edge cases, refusals, and bounded cost claims', () => {
  const report = runResearchAgentEvaluation();

  assert.deepEqual(report.evaluatedAgentIds, ['agent.local-acoustic-statistics']);
  assert.equal(report.evaluationScope, 'deterministic-browser-only');
  assert.equal(report.labeledCases.length, 4);
  assert.equal(report.reliability.passedChecks, report.reliability.totalChecks);
  assert.equal(report.reliability.rate, 1);
  assert.equal(report.refusalQuality.passedChecks, report.refusalQuality.totalChecks);
  assert.equal(report.refusalQuality.rate, 1);
  assert.equal(report.regression.failedCases, 0);
  assert.equal(report.regression.totalCases, 4);
  assert.equal(report.regression.rate, 0);
  assert.equal(report.regression.historicalComparison, false);
  assert.equal(report.calibration.status, 'not-applicable');
  assert.equal(report.cost.declaredEstimateUsd, 0);
  assert.equal(report.cost.actualProviderSpendMeasured, false);
  assert.ok(report.labeledCases.every(item => item.passedChecks === item.totalChecks));
  assert.ok(report.refusalChecks.every(item => item.passed));
  assert.ok(report.boundaries.some(boundary => boundary.includes('No AI model, external network, user history, or customer data')));
});

test('missing dominant peaks stay null in the labeled agent output', () => {
  const report = runResearchAgentEvaluation();
  const emptyPeaks = report.labeledCases.find(item => item.id === 'no-dominant-peaks');
  const median = emptyPeaks?.checks.find(check => check.label === 'median-dominant-frequency');
  assert.equal(median?.expected, 'null Hz');
  assert.equal(median?.actual, 'null Hz');
  assert.equal(median?.passed, true);
});

test('evaluation panel labels fixture results and unavailable measures accurately', () => {
  const report = runResearchAgentEvaluation();
  const html = renderToStaticMarkup(createElement(ResearchAgentEvaluationPanel, {
    report,
    error: '',
    onRun: () => {},
  }));

  assert.match(html, /fixed test set, not a field claim/i);
  assert.match(html, /Labeled-case reliability/);
  assert.match(html, /Routing &amp; schema/);
  assert.match(html, /Current fixture regression/);
  assert.match(html, /Not applicable/);
  assert.match(html, /Provider spend is not metered/);
  assert.match(html, /historical release baseline/);
  assert.match(html, /button-run-agent-evaluation/);
});
