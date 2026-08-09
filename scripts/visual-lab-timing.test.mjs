import { describe, expect, it } from 'vitest';

import {
  createVisualLabCaptureSubphaseTimingRecorder,
  createVisualLabTimingRecorder,
  normalizeVisualLabCaptureSubphaseTimings,
  normalizeVisualLabTimings,
  summarizeVisualLabCaptureSubphaseTimings,
  summarizeVisualLabTimings,
  VISUAL_LAB_CAPTURE_SUBPHASE_TIMING_SCHEMA,
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

const subphaseTimingRecord = (multiplier = 1) => ({
  schema: VISUAL_LAB_CAPTURE_SUBPHASE_TIMING_SCHEMA,
  readiness: {
    datasetWaitMs: 1 * multiplier,
    refreshMs: 2 * multiplier,
    snapshotAttempts: multiplier,
    readbackHashMs: 3 * multiplier,
  },
  captures: Object.fromEntries(['off', 'a', 'b'].map((variant, index) => {
    const offset = index * 10;
    return [variant, {
      selectionMs: (offset + 1) * multiplier,
      datasetWaitMs: (offset + 2) * multiplier,
      snapshotAttempts: multiplier,
      readbackHashMs: (offset + 3) * multiplier,
      screenshotMs: (offset + 4) * multiplier,
      writeMs: (offset + 5) * multiplier,
    }];
  })),
});

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

  it('records fixed bounded capture subphases without changing timings/v1', async () => {
    let clock = 0;
    const recorder = createVisualLabCaptureSubphaseTimingRecorder({ now: () => clock++ });
    await recorder.measureReadiness('datasetWaitMs', async () => 'dataset-ready');
    await recorder.measureReadiness('refreshMs', async () => 'refreshed');
    await recorder.measureSnapshot('readiness', async () => 'readiness-snapshot');
    for (const variant of ['off', 'a', 'b']) {
      await recorder.measureCapture(variant, 'selectionMs', async () => variant);
      await recorder.measureCapture(variant, 'datasetWaitMs', async () => variant);
      await recorder.measureSnapshot(variant, async () => variant);
      await recorder.measureCapture(variant, 'screenshotMs', async () => variant);
      await recorder.measureCapture(variant, 'writeMs', async () => variant);
    }
    const subphases = recorder.finish();

    expect(subphases).toEqual({
      schema: VISUAL_LAB_CAPTURE_SUBPHASE_TIMING_SCHEMA,
      readiness: {
        datasetWaitMs: 1,
        refreshMs: 1,
        snapshotAttempts: 1,
        readbackHashMs: 1,
      },
      captures: Object.fromEntries(['off', 'a', 'b'].map((variant) => [variant, {
        selectionMs: 1,
        datasetWaitMs: 1,
        snapshotAttempts: 1,
        readbackHashMs: 1,
        screenshotMs: 1,
        writeMs: 1,
      }])),
    });
    expect(Object.keys(subphases.captures)).toEqual(['off', 'a', 'b']);
    expectRecursivelyFrozen(subphases);
    expect(JSON.parse(JSON.stringify(subphases))).toEqual(subphases);
    expect(JSON.stringify(subphases)).not.toMatch(/timestamp|\/tmp|file:\/\//i);
    expect(() => recorder.finish()).toThrow(/already finished/);
    await expect(recorder.measureCapture('off', 'writeMs', async () => true))
      .rejects.toThrow(/already finished/);
  });

  it('strictly validates and bounds capture subphase telemetry', async () => {
    const valid = subphaseTimingRecord();
    expect(normalizeVisualLabCaptureSubphaseTimings(valid)).toEqual(valid);

    const extra = subphaseTimingRecord();
    extra.captures.off.path = '/tmp/not-portable';
    expect(() => normalizeVisualLabCaptureSubphaseTimings(extra)).toThrow(/exactly/);
    const missingVariant = subphaseTimingRecord();
    delete missingVariant.captures.b;
    expect(() => normalizeVisualLabCaptureSubphaseTimings(missingVariant)).toThrow(/exactly/);
    const zeroAttempts = subphaseTimingRecord();
    zeroAttempts.readiness.snapshotAttempts = 0;
    expect(() => normalizeVisualLabCaptureSubphaseTimings(zeroAttempts)).toThrow(/1 through/);
    const tooManyAttempts = subphaseTimingRecord();
    tooManyAttempts.captures.a.snapshotAttempts = 1_000_001;
    expect(() => normalizeVisualLabCaptureSubphaseTimings(tooManyAttempts)).toThrow(/1 through/);
    const overBudget = subphaseTimingRecord();
    overBudget.captures.b.readbackHashMs = 300_000.001;
    expect(() => normalizeVisualLabCaptureSubphaseTimings(overBudget)).toThrow(/300000 ms/);
    const negativeZero = subphaseTimingRecord();
    negativeZero.captures.off.writeMs = -0;
    expect(Object.is(normalizeVisualLabCaptureSubphaseTimings(negativeZero).captures.off.writeMs, -0))
      .toBe(false);
    const wrongSchema = subphaseTimingRecord();
    wrongSchema.schema = 'anifor.visual-lab.capture-subphase-timings/v0';
    expect(() => normalizeVisualLabCaptureSubphaseTimings(wrongSchema)).toThrow(/require/);
    expect(() => normalizeVisualLabCaptureSubphaseTimings({
      ...subphaseTimingRecord(), machinePath: '/tmp/not-portable',
    })).toThrow(/exactly/);

    const backwards = createVisualLabCaptureSubphaseTimingRecorder({
      now: (() => {
        const readings = [4, 3];
        return () => readings.shift();
      })(),
    });
    await expect(backwards.measureReadiness('datasetWaitMs', () => true))
      .rejects.toThrow(/moved backwards/);
    const failedSnapshot = createVisualLabCaptureSubphaseTimingRecorder({
      now: (() => {
        let value = 0;
        return () => value++;
      })(),
    });
    await expect(failedSnapshot.measureSnapshot('off', () => {
      throw new Error('planned snapshot failure');
    })).rejects.toThrow(/planned snapshot failure/);
    await expect(failedSnapshot.measureSnapshot('other', async () => true))
      .rejects.toThrow(/Unknown Visual Lab capture subphase scope/);
    await failedSnapshot.measureSnapshot('off', async () => true);
    await failedSnapshot.measureReadiness('datasetWaitMs', async () => true);
    await failedSnapshot.measureReadiness('refreshMs', async () => true);
    await failedSnapshot.measureSnapshot('readiness', async () => true);
    for (const variant of ['off', 'a', 'b']) {
      await failedSnapshot.measureCapture(variant, 'selectionMs', async () => true);
      await failedSnapshot.measureCapture(variant, 'datasetWaitMs', async () => true);
      if (variant !== 'off') await failedSnapshot.measureSnapshot(variant, async () => true);
      await failedSnapshot.measureCapture(variant, 'screenshotMs', async () => true);
      await failedSnapshot.measureCapture(variant, 'writeMs', async () => true);
    }
    const retried = failedSnapshot.finish();
    expect(retried.captures.off.snapshotAttempts).toBe(2);
    expect(retried.captures.off.readbackHashMs).toBe(2);
    await expect(failedSnapshot.measureSnapshot('other', async () => true))
      .rejects.toThrow(/already finished/);
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

  it('canonically aggregates capture subphases in candidate order', () => {
    const summary = summarizeVisualLabCaptureSubphaseTimings([
      { candidate: 'powder-style-atlas', captureSubphases: subphaseTimingRecord(2) },
      { candidate: 'gas-showcase', captureSubphases: subphaseTimingRecord(1) },
    ]);

    expect(summary.sampledCandidates).toEqual(['gas-showcase', 'powder-style-atlas']);
    expect(summary.readiness.datasetWaitMs).toEqual({ totalMs: 3, meanMs: 1.5, maxMs: 2 });
    expect(summary.readiness.snapshotAttempts).toEqual({
      totalAttempts: 3,
      meanAttempts: 1.5,
      maxAttempts: 2,
    });
    expect(summary.captures.off.selectionMs).toEqual({ totalMs: 3, meanMs: 1.5, maxMs: 2 });
    expect(summary.captures.b.writeMs).toEqual({ totalMs: 75, meanMs: 37.5, maxMs: 50 });
    expect(summary.captures.a.snapshotAttempts).toEqual({
      totalAttempts: 3,
      meanAttempts: 1.5,
      maxAttempts: 2,
    });
    expectRecursivelyFrozen(summary);

    const empty = summarizeVisualLabCaptureSubphaseTimings([]);
    expect(empty.sampledCandidates).toEqual([]);
    expect(empty.readiness.refreshMs).toEqual({ totalMs: 0, meanMs: 0, maxMs: 0 });
    expect(empty.captures.off.snapshotAttempts).toEqual({
      totalAttempts: 0,
      meanAttempts: 0,
      maxAttempts: 0,
    });
    expect(() => summarizeVisualLabCaptureSubphaseTimings([
      { candidate: 'gas-showcase', captureSubphases: subphaseTimingRecord() },
      { candidate: 'gas-showcase', captureSubphases: subphaseTimingRecord() },
    ])).toThrow(/Duplicate/);
    expect(() => summarizeVisualLabCaptureSubphaseTimings([
      { candidate: '../escape', captureSubphases: subphaseTimingRecord() },
    ])).toThrow(/Invalid/);
    expect(() => summarizeVisualLabCaptureSubphaseTimings([
      {
        candidate: 'gas-showcase',
        captureSubphases: subphaseTimingRecord(),
        path: '/tmp/not-portable',
      },
    ])).toThrow(/exactly/);
  });
});
