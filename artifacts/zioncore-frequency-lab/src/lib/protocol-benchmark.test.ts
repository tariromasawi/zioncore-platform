import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ProtocolBenchmarkPanel from '@/components/protocol-benchmark-panel';
import {
  PROTOCOL_BENCHMARK_SNR_LEVELS_DB,
  PROTOCOL_BENCHMARK_TRIALS,
  runProtocolBenchmarkSuite,
} from '@/lib/protocol-benchmark';

const report = runProtocolBenchmarkSuite('2026-11-12T12:00:00.000Z');

test('suite runs bounded local benchmarks for the existing registry entries', () => {
  assert.equal(report.suiteVersion, '1.0.0');
  assert.equal(report.createdAt, '2026-11-12T12:00:00.000Z');
  assert.equal(report.trialCountPerCondition, PROTOCOL_BENCHMARK_TRIALS);
  assert.deepEqual(report.results.map(result => result.protocolId), [
    'zioncore.acoustic-message',
    'zioncore.acoustic-voice',
    'ZC-EXP-DTMF-v1',
  ]);
  assert.ok(report.results.every(result => result.clean.trials === PROTOCOL_BENCHMARK_TRIALS));
  assert.ok(report.results.every(result => result.clean.recovered === PROTOCOL_BENCHMARK_TRIALS));
});

test('all registered audio receivers report bounded error rates and measured synthetic SNR', () => {
  const audioResults = report.results.filter(result => result.noise.status === 'measured');
  assert.equal(audioResults.length, 3);
  for (const result of audioResults) {
    assert.ok(result.payloadGoodputBitsPerSecond > 0);
    assert.ok(Number.isFinite(result.compute.encodeMs) && result.compute.encodeMs >= 0);
    assert.ok(Number.isFinite(result.compute.cleanDecodeMeanMs) && result.compute.cleanDecodeMeanMs >= 0);
    assert.ok(Number.isFinite(result.compute.allTrialDecodeMs) && result.compute.allTrialDecodeMs >= 0);
    if (result.noise.status !== 'measured') throw new Error('Expected audio noise trials.');
    assert.deepEqual(result.noise.levels.map(level => level.targetSnrDb), PROTOCOL_BENCHMARK_SNR_LEVELS_DB);
    for (const level of result.noise.levels) {
      assert.equal(level.trials, PROTOCOL_BENCHMARK_TRIALS);
      assert.ok(Math.abs(level.measuredSnrDb - level.targetSnrDb) < 0.1);
      assert.equal(level.errors + level.recovered, level.trials);
      assert.ok(level.errorRate >= 0 && level.errorRate <= 1);
      assert.equal(level.falseAccepts, 0);
    }
    assert.equal(result.deviceCompatibility.status, 'not-measured');
    assert.equal(result.cloud.requests, 0);
    assert.equal(result.cloud.estimatedCostUsd, 0);
  }
  const dtmf = report.results.find(result => result.protocolId === 'ZC-EXP-DTMF-v1');
  assert.ok(dtmf);
  assert.ok(dtmf.symbolRoundTrip);
  assert.equal(dtmf.symbolRoundTrip.recovered, PROTOCOL_BENCHMARK_TRIALS);
  assert.equal(dtmf.deviceCompatibility.status, 'not-measured');
  assert.match(dtmf.interpretationLimits.join(' '), /separate symbol-array round trip/);
});

test('benchmark panel renders measured outcomes and limitations from the report', () => {
  const html = renderToStaticMarkup(createElement(ProtocolBenchmarkPanel, {
    report,
    running: false,
    error: '',
    onRun: () => {},
  }));

  assert.match(html, /Measure the packet path/);
  assert.match(html, /Payload goodput/);
  assert.match(html, /Measured SNR/);
  assert.match(html, /Device compatibility/);
  assert.match(html, /Not measured/);
  assert.match(html, /Symbol-array round trip/);
  assert.match(html, /not statistically sufficient reliability estimates/);
  assert.match(html, /button-run-protocol-benchmark/);
});

