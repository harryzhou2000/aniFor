import { describe, expect, it } from 'vitest';

import {
  createVisualLabTimingRecorder,
  normalizeVisualLabTimings,
  summarizeVisualLabTimings,
  VISUAL_LAB_TIMING_SCHEMA,
} from './visual-lab-timing.mjs';

const PHASES = [
  'plan', 'preflight', 'hostLaunch', 'targetSetup', 'startup', 'readiness',
  'off', 'a', 'b', 'finalize', 'rendererDispose', 'targetTeardown',
  'hostTeardown', 'total',
];
const COUNTERS = [
  'browserHosts', 'browserContexts', 'targets', 'hostRestarts', 'captures',
];

const timingRecord = (multiplier = 1) => {
  const phases = Object.fromEntries(PHASES.slice(0, -1).map(
    (name, index) => [name, (index + 1) * multiplier],
  ));
  phases.total = Object.values(phases).reduce((total, value) => total + value, 0);
  return {
    schema: VISUAL_LAB_TIMING_SCHEMA,
    phases,
    counters: Object.fromEntries(COUNTERS.map((name, index) => [name, index * multiplier])),
  };
};

const expectRecursivelyFrozen = (value) => {
  if (value === null || typeof value !== 'object') return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectRecursivelyFrozen(nested);
};

describe('Visual Lab timing telemetry', () => {
  it('measures with a monotonic clock and finishes one exact frozen data record', async () => {
    const clock = [900_000, 900_006.25];
    const recorder = createVisualLabTimingRecorder({ now: () => clock.shift() });
    for (const [index, phase] of PHASES.entries()) {
      if (phase !== 'hostLaunch' && phase !== 'total') recorder.record(phase, index + 0.5);
    }
    await expect(recorder.measure('hostLaunch', async () => 'captured')).resolves.toBe('captured');
    recorder.record('total', 88.25);
    const timings = recorder.finish({
      browserHosts: 1,
      browserContexts: 1,
      targets: 1,
      hostRestarts: 0,
      captures: 3,
    });

    expect(timings).toEqual({
      schema: VISUAL_LAB_TIMING_SCHEMA,
      phases: {
        plan: 0.5,
        preflight: 1.5,
        hostLaunch: 6.25,
        targetSetup: 3.5,
        startup: 4.5,
        readiness: 5.5,
        off: 6.5,
        a: 7.5,
        b: 8.5,
        finalize: 9.5,
        rendererDispose: 10.5,
        targetTeardown: 11.5,
        hostTeardown: 12.5,
        total: 88.25,
      },
      counters: {
        browserHosts: 1,
        browserContexts: 1,
        targets: 1,
        hostRestarts: 0,
        captures: 3,
      },
    });
    expect(Object.keys(timings.phases)).toEqual(PHASES);
    expectRecursivelyFrozen(timings);
    expect(JSON.parse(JSON.stringify(timings))).toEqual(timings);
    expect(JSON.stringify(timings)).not.toMatch(/timestamp|\/tmp|file:\/\//i);
    expect(() => recorder.record('plan', 1)).toThrow(/already finished/);
    expect(() => recorder.finish(timings.counters)).toThrow(/already finished/);
  });

  it('strictly rejects missing, duplicate, unknown, nonfinite, and nonmonotonic input', async () => {
    const missing = createVisualLabTimingRecorder();
    expect(() => missing.finish(timingRecord().counters)).toThrow(/Missing.*plan/);
    missing.record('plan', 1);
    expect(() => missing.record('plan', 1)).toThrow(/Duplicate/);
    expect(() => missing.record('other', 1)).toThrow(/Unknown/);
    expect(() => missing.record('preflight', Number.NaN)).toThrow(/finite nonnegative/);
    expect(() => missing.record('preflight', -1)).toThrow(/finite nonnegative/);

    const backwards = createVisualLabTimingRecorder({
      now: (() => {
        const readings = [4, 3];
        return () => readings.shift();
      })(),
    });
    await expect(backwards.measure('hostLaunch', () => true)).rejects.toThrow(/moved backwards/);

    const extraPhase = timingRecord();
    extraPhase.phases.other = 1;
    expect(() => normalizeVisualLabTimings(extraPhase)).toThrow(/exactly/);
    const missingCounter = timingRecord();
    delete missingCounter.counters.targets;
    expect(() => normalizeVisualLabTimings(missingCounter)).toThrow(/exactly/);
    const invalidCounter = timingRecord();
    invalidCounter.counters.targets = 0.5;
    expect(() => normalizeVisualLabTimings(invalidCounter)).toThrow(/safe integer/);
    const impossibleTotal = timingRecord();
    impossibleTotal.phases.total -= 0.01;
    expect(() => normalizeVisualLabTimings(impossibleTotal)).toThrow(/must cover/);
    const overBudgetPhase = timingRecord();
    overBudgetPhase.phases.plan = 300_000.001;
    expect(() => normalizeVisualLabTimings(overBudgetPhase)).toThrow(/300000 ms/);
    const overBudgetTotal = timingRecord();
    overBudgetTotal.phases.total = 300_000.001;
    expect(() => normalizeVisualLabTimings(overBudgetTotal)).toThrow(/300000 ms/);
    const toleratedRounding = timingRecord();
    toleratedRounding.phases.total -= 0.0005;
    expect(normalizeVisualLabTimings(toleratedRounding).phases.total)
      .toBe(toleratedRounding.phases.total);
    const negativeZero = timingRecord();
    negativeZero.phases.plan = -0;
    negativeZero.counters.browserHosts = -0;
    const canonicalZero = normalizeVisualLabTimings(negativeZero);
    expect(Object.is(canonicalZero.phases.plan, -0)).toBe(false);
    expect(Object.is(canonicalZero.counters.browserHosts, -0)).toBe(false);
    expect(() => normalizeVisualLabTimings({ ...timingRecord(), path: '/tmp/review' }))
      .toThrow(/exactly/);
  });

  it('canonically aggregates sampled candidates, phase statistics, and counters', () => {
    const summary = summarizeVisualLabTimings([
      { candidate: 'powder-style-atlas', timings: timingRecord(2) },
      { candidate: 'gas-showcase', timings: timingRecord(1) },
    ]);

    expect(summary.sampledCandidates).toEqual(['gas-showcase', 'powder-style-atlas']);
    expect(Object.keys(summary.phases)).toEqual(PHASES);
    for (const [index, phase] of PHASES.entries()) {
      const base = phase === 'total' ? 91 : index + 1;
      expect(summary.phases[phase]).toEqual({
        totalMs: base * 3,
        meanMs: base * 1.5,
        maxMs: base * 2,
      });
    }
    expect(summary.counters).toEqual({
      browserHosts: 0,
      browserContexts: 3,
      targets: 6,
      hostRestarts: 9,
      captures: 12,
    });
    expectRecursivelyFrozen(summary);

    const empty = summarizeVisualLabTimings([]);
    expect(empty.sampledCandidates).toEqual([]);
    expect(empty.phases.total).toEqual({ totalMs: 0, meanMs: 0, maxMs: 0 });
    expect(empty.counters).toEqual(Object.fromEntries(COUNTERS.map((name) => [name, 0])));

    expect(() => summarizeVisualLabTimings([
      { candidate: 'gas-showcase', timings: timingRecord() },
      { candidate: 'gas-showcase', timings: timingRecord() },
    ])).toThrow(/Duplicate/);
    expect(() => summarizeVisualLabTimings([
      { candidate: '../escape', timings: timingRecord() },
    ])).toThrow(/Invalid/);
    expect(() => summarizeVisualLabTimings([
      { candidate: 'gas-showcase', timings: timingRecord(), path: '/tmp/review' },
    ])).toThrow(/exactly/);
  });
});
