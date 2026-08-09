import { performance } from 'node:perf_hooks';
import {
  VISUAL_LAB_CAPTURE_VARIANT_NAMES,
} from './visual-lab-capture-abi.mjs';

export const VISUAL_LAB_TIMING_SCHEMA = 'anifor.visual-lab.timings/v1';
export const VISUAL_LAB_CAPTURE_SUBPHASE_TIMING_SCHEMA =
  'anifor.visual-lab.capture-subphase-timings/v1';

const PHASE_NAMES = Object.freeze([
  'plan',
  'preflight',
  'hostLaunch',
  'targetSetup',
  'startup',
  'readiness',
  'off',
  'a',
  'b',
  'finalize',
  'rendererDispose',
  'targetTeardown',
  'hostTeardown',
  'total',
]);

const COUNTER_NAMES = Object.freeze([
  'browserHosts',
  'browserContexts',
  'targets',
  'hostRestarts',
  'captures',
]);

const READINESS_SUBPHASE_DURATION_NAMES = Object.freeze([
  'datasetWaitMs',
  'refreshMs',
  'readbackHashMs',
]);
const CAPTURE_SUBPHASE_DURATION_NAMES = Object.freeze([
  'selectionMs',
  'datasetWaitMs',
  'readbackHashMs',
  'screenshotMs',
  'writeMs',
]);
const READINESS_SUBPHASE_FIELDS = Object.freeze([
  'datasetWaitMs',
  'refreshMs',
  'snapshotAttempts',
  'readbackHashMs',
]);
const CAPTURE_SUBPHASE_FIELDS = Object.freeze([
  'selectionMs',
  'datasetWaitMs',
  'snapshotAttempts',
  'readbackHashMs',
  'screenshotMs',
  'writeMs',
]);
const CAPTURE_SUBPHASE_TOP_LEVEL_FIELDS = Object.freeze(['schema', 'readiness', 'captures']);
const MAX_SNAPSHOT_ATTEMPTS = 1_000_000;

const SAFE_CANDIDATE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PHASE_MS = 300_000;
const TOTAL_SUM_TOLERANCE_MS = 0.001;
const hasOwn = (value, name) => Object.prototype.hasOwnProperty.call(value, name);

const assertPlainRecord = (value, label) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain record`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain record`);
  }
};

const assertExactFields = (value, fields, label) => {
  assertPlainRecord(value, label);
  const keys = Reflect.ownKeys(value);
  if (keys.length !== fields.length
    || keys.some((key) => typeof key !== 'string' || !fields.includes(key))
    || fields.some((field) => !hasOwn(value, field))) {
    throw new TypeError(`${label} must contain exactly ${fields.join(', ')}`);
  }
};

const normalizeNonnegativeMilliseconds = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${label} must be a finite nonnegative millisecond value`);
  }
  return Object.is(value, -0) ? 0 : value;
};

const normalizePhaseMilliseconds = (value, label) => {
  const normalized = normalizeNonnegativeMilliseconds(value, label);
  if (normalized > MAX_PHASE_MS) {
    throw new RangeError(`${label} must be no greater than ${MAX_PHASE_MS} ms`);
  }
  return normalized;
};

const normalizeCounter = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a nonnegative safe integer`);
  }
  return Object.is(value, -0) ? 0 : value;
};

const normalizeSnapshotAttempts = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_SNAPSHOT_ATTEMPTS) {
    throw new TypeError(
      `${label} must be a safe integer from 1 through ${MAX_SNAPSHOT_ATTEMPTS}`,
    );
  }
  return value;
};

const normalizeSubphaseDurations = (value, fields, label) => Object.fromEntries(fields.map((name) => [
  name,
  normalizePhaseMilliseconds(value[name], `${label}.${name}`),
]));

const normalizeReadinessSubphases = (value) => {
  assertExactFields(value, READINESS_SUBPHASE_FIELDS, 'Visual Lab readiness subphases');
  const durations = normalizeSubphaseDurations(
    value, READINESS_SUBPHASE_DURATION_NAMES, 'Visual Lab readiness subphases',
  );
  return Object.freeze({
    datasetWaitMs: durations.datasetWaitMs,
    refreshMs: durations.refreshMs,
    snapshotAttempts: normalizeSnapshotAttempts(
      value.snapshotAttempts, 'Visual Lab readiness subphases.snapshotAttempts',
    ),
    readbackHashMs: durations.readbackHashMs,
  });
};

const normalizeCaptureSubphases = (value, variant) => {
  const label = `Visual Lab ${variant} capture subphases`;
  assertExactFields(value, CAPTURE_SUBPHASE_FIELDS, label);
  const durations = normalizeSubphaseDurations(value, CAPTURE_SUBPHASE_DURATION_NAMES, label);
  return Object.freeze({
    selectionMs: durations.selectionMs,
    datasetWaitMs: durations.datasetWaitMs,
    snapshotAttempts: normalizeSnapshotAttempts(value.snapshotAttempts, `${label}.snapshotAttempts`),
    readbackHashMs: durations.readbackHashMs,
    screenshotMs: durations.screenshotMs,
    writeMs: durations.writeMs,
  });
};

const normalizePhases = (value) => {
  assertExactFields(value, PHASE_NAMES, 'Visual Lab timing phases');
  const phases = Object.fromEntries(PHASE_NAMES.map((name) => [
    name,
    normalizePhaseMilliseconds(value[name], `Visual Lab ${name} timing`),
  ]));
  const measuredTotal = PHASE_NAMES.slice(0, -1).reduce(
    (total, name) => total + phases[name], 0,
  );
  if (phases.total + TOTAL_SUM_TOLERANCE_MS < measuredTotal) {
    throw new RangeError(
      `Visual Lab total timing must cover all non-total phases within ${TOTAL_SUM_TOLERANCE_MS} ms`,
    );
  }
  return Object.freeze(phases);
};

const normalizeCounters = (value) => {
  assertExactFields(value, COUNTER_NAMES, 'Visual Lab timing counters');
  return Object.freeze(Object.fromEntries(COUNTER_NAMES.map((name) => [
    name,
    normalizeCounter(value[name], `Visual Lab ${name} counter`),
  ])));
};

/**
 * Normalizes additive timing telemetry into one canonical, recursively frozen,
 * JSON-safe record. Timing records are deliberately excluded from every
 * content identity and contain no wall-clock time or machine-local metadata.
 */
export function normalizeVisualLabTimings(value) {
  assertExactFields(value, ['schema', 'phases', 'counters'], 'Visual Lab timings');
  if (value.schema !== VISUAL_LAB_TIMING_SCHEMA) {
    throw new TypeError(`Visual Lab timings require ${VISUAL_LAB_TIMING_SCHEMA}`);
  }
  return Object.freeze({
    schema: VISUAL_LAB_TIMING_SCHEMA,
    phases: normalizePhases(value.phases),
    counters: normalizeCounters(value.counters),
  });
}

/**
 * Normalizes bounded capture-internal telemetry. This is a separate additive
 * diagnostic record so timings/v1 and every content-addressed identity retain
 * their historical exact shape.
 */
export function normalizeVisualLabCaptureSubphaseTimings(value) {
  assertExactFields(value, CAPTURE_SUBPHASE_TOP_LEVEL_FIELDS, 'Visual Lab capture subphases');
  if (value.schema !== VISUAL_LAB_CAPTURE_SUBPHASE_TIMING_SCHEMA) {
    throw new TypeError(
      `Visual Lab capture subphases require ${VISUAL_LAB_CAPTURE_SUBPHASE_TIMING_SCHEMA}`,
    );
  }
  assertExactFields(
    value.captures, VISUAL_LAB_CAPTURE_VARIANT_NAMES, 'Visual Lab capture subphase variants',
  );
  return Object.freeze({
    schema: VISUAL_LAB_CAPTURE_SUBPHASE_TIMING_SCHEMA,
    readiness: normalizeReadinessSubphases(value.readiness),
    captures: Object.freeze(Object.fromEntries(VISUAL_LAB_CAPTURE_VARIANT_NAMES.map((variant) => [
      variant,
      normalizeCaptureSubphases(value.captures[variant], variant),
    ]))),
  });
}

/**
 * Records named phase durations against an injected monotonic clock. The
 * recorder is one-shot: every phase must be recorded exactly once before
 * finish, and no mutation is accepted afterwards.
 */
export function createVisualLabTimingRecorder({ now = () => performance.now() } = {}) {
  if (typeof now !== 'function') throw new TypeError('Visual Lab timing clock must be a function');

  const phases = new Map();
  const measuring = new Set();
  let lastClockReading = null;
  let finished = false;

  const assertOpenPhase = (name) => {
    if (finished) throw new Error('Visual Lab timing recorder is already finished');
    if (!PHASE_NAMES.includes(name)) {
      throw new TypeError(`Unknown Visual Lab timing phase ${JSON.stringify(name)}`);
    }
    if (phases.has(name) || measuring.has(name)) {
      throw new Error(`Duplicate Visual Lab timing phase ${name}`);
    }
  };

  const readClock = () => {
    const reading = normalizeNonnegativeMilliseconds(now(), 'Visual Lab monotonic clock');
    if (lastClockReading !== null && reading < lastClockReading) {
      throw new RangeError('Visual Lab timing clock moved backwards');
    }
    lastClockReading = reading;
    return reading;
  };

  const record = (name, ms) => {
    assertOpenPhase(name);
    const normalized = normalizePhaseMilliseconds(ms, `Visual Lab ${name} timing`);
    phases.set(name, normalized);
    return normalized;
  };

  const measure = async (name, action) => {
    assertOpenPhase(name);
    if (typeof action !== 'function') {
      throw new TypeError('Visual Lab measured action must be a function');
    }
    measuring.add(name);
    let started;
    try {
      started = readClock();
      return await action();
    } finally {
      try {
        if (started !== undefined) {
          const elapsed = readClock() - started;
          phases.set(name, normalizePhaseMilliseconds(elapsed, `Visual Lab ${name} timing`));
        }
      } finally {
        measuring.delete(name);
      }
    }
  };

  const finish = (counters) => {
    if (finished) throw new Error('Visual Lab timing recorder is already finished');
    if (measuring.size > 0) {
      throw new Error(`Visual Lab timing phases are still running: ${[...measuring].join(', ')}`);
    }
    const missing = PHASE_NAMES.filter((name) => !phases.has(name));
    if (missing.length > 0) {
      throw new Error(`Missing Visual Lab timing phases: ${missing.join(', ')}`);
    }
    const normalized = normalizeVisualLabTimings({
      schema: VISUAL_LAB_TIMING_SCHEMA,
      phases: Object.fromEntries(PHASE_NAMES.map((name) => [name, phases.get(name)])),
      counters,
    });
    finished = true;
    return normalized;
  };

  return Object.freeze({ measure, record, finish });
}

/**
 * Measures fixed, bounded capture internals without changing timings/v1. A
 * snapshot operation is one complete `snapshotState` round trip, including its
 * CDP transport, semantic/field/framebuffer readback, and digest work.
 */
export function createVisualLabCaptureSubphaseTimingRecorder({ now = () => performance.now() } = {}) {
  if (typeof now !== 'function') {
    throw new TypeError('Visual Lab capture subphase timing clock must be a function');
  }

  const readiness = {
    datasetWaitMs: 0,
    refreshMs: 0,
    snapshotAttempts: 0,
    readbackHashMs: 0,
  };
  const captures = Object.fromEntries(VISUAL_LAB_CAPTURE_VARIANT_NAMES.map((variant) => [variant, {
    selectionMs: 0,
    datasetWaitMs: 0,
    snapshotAttempts: 0,
    readbackHashMs: 0,
    screenshotMs: 0,
    writeMs: 0,
  }]));
  const measured = new Map([
    ['readiness', new Set()],
    ...VISUAL_LAB_CAPTURE_VARIANT_NAMES.map((variant) => [variant, new Set()]),
  ]);
  let lastClockReading = null;
  let finished = false;

  const assertOpen = () => {
    if (finished) throw new Error('Visual Lab capture subphase timing recorder is already finished');
  };

  const readClock = () => {
    const reading = normalizeNonnegativeMilliseconds(now(), 'Visual Lab capture subphase monotonic clock');
    if (lastClockReading !== null && reading < lastClockReading) {
      throw new RangeError('Visual Lab capture subphase timing clock moved backwards');
    }
    lastClockReading = reading;
    return reading;
  };

  const scopeRecord = (scope) => {
    if (scope === 'readiness') return readiness;
    if (VISUAL_LAB_CAPTURE_VARIANT_NAMES.includes(scope)) return captures[scope];
    throw new TypeError(`Unknown Visual Lab capture subphase scope ${JSON.stringify(scope)}`);
  };

  const durationNames = (scope) => (
    scope === 'readiness' ? READINESS_SUBPHASE_DURATION_NAMES : CAPTURE_SUBPHASE_DURATION_NAMES
  );

  const measureScope = async (scope, name, action) => {
    assertOpen();
    const record = scopeRecord(scope);
    if (!durationNames(scope).includes(name)) {
      throw new TypeError(`Unknown Visual Lab ${scope} capture subphase ${JSON.stringify(name)}`);
    }
    if (typeof action !== 'function') {
      throw new TypeError('Visual Lab capture subphase action must be a function');
    }
    const started = readClock();
    try {
      return await action();
    } finally {
      const elapsed = readClock() - started;
      record[name] = normalizePhaseMilliseconds(
        record[name] + elapsed, `Visual Lab ${scope} capture subphase ${name}`,
      );
      measured.get(scope).add(name);
    }
  };

  const measureReadiness = (name, action) => measureScope('readiness', name, action);
  const measureCapture = async (variant, name, action) => {
    assertOpen();
    if (!VISUAL_LAB_CAPTURE_VARIANT_NAMES.includes(variant)) {
      throw new TypeError(`Unknown Visual Lab capture variant ${JSON.stringify(variant)}`);
    }
    return measureScope(variant, name, action);
  };
  const measureSnapshot = async (scope, action) => {
    assertOpen();
    const record = scopeRecord(scope);
    try {
      return await measureScope(scope, 'readbackHashMs', action);
    } finally {
      record.snapshotAttempts = normalizeSnapshotAttempts(
        record.snapshotAttempts + 1, `Visual Lab ${scope} capture subphase snapshotAttempts`,
      );
    }
  };

  const finish = () => {
    assertOpen();
    const missing = [];
    for (const [scope, names] of measured) {
      const expected = durationNames(scope);
      const absent = expected.filter((name) => !names.has(name));
      if (absent.length > 0) missing.push(`${scope}.${absent.join(',')}`);
      if (scopeRecord(scope).snapshotAttempts < 1) missing.push(`${scope}.snapshotAttempts`);
    }
    if (missing.length > 0) {
      throw new Error(`Missing Visual Lab capture subphase measurements: ${missing.join('; ')}`);
    }
    const normalized = normalizeVisualLabCaptureSubphaseTimings({
      schema: VISUAL_LAB_CAPTURE_SUBPHASE_TIMING_SCHEMA,
      readiness,
      captures,
    });
    finished = true;
    return normalized;
  };

  return Object.freeze({ measureReadiness, measureCapture, measureSnapshot, finish });
}

/**
 * Aggregates normalized per-candidate timing records without introducing them
 * into any capture or batch identity. Candidate order is canonicalized so
 * floating-point accumulation and serialized output are deterministic.
 */
export function summarizeVisualLabTimings(candidateRecords) {
  if (!Array.isArray(candidateRecords)) {
    throw new TypeError('Visual Lab timing candidates must be an array');
  }

  const normalized = candidateRecords.map((entry, index) => {
    assertExactFields(entry, ['candidate', 'timings'], `Visual Lab timing candidate ${index}`);
    if (typeof entry.candidate !== 'string' || !SAFE_CANDIDATE.test(entry.candidate)) {
      throw new TypeError(`Invalid Visual Lab timing candidate ${JSON.stringify(entry.candidate)}`);
    }
    return Object.freeze({
      candidate: entry.candidate,
      timings: normalizeVisualLabTimings(entry.timings),
    });
  }).sort((left, right) => left.candidate.localeCompare(right.candidate));

  for (let index = 1; index < normalized.length; index++) {
    if (normalized[index - 1].candidate === normalized[index].candidate) {
      throw new TypeError(`Duplicate Visual Lab timing candidate ${normalized[index].candidate}`);
    }
  }

  const phaseSummary = Object.fromEntries(PHASE_NAMES.map((name) => {
    let totalMs = 0;
    let maxMs = 0;
    for (const { timings } of normalized) {
      totalMs += timings.phases[name];
      maxMs = Math.max(maxMs, timings.phases[name]);
    }
    if (!Number.isFinite(totalMs)) {
      throw new RangeError(`Visual Lab ${name} timing total exceeds the finite number range`);
    }
    return [name, Object.freeze({
      totalMs,
      meanMs: normalized.length === 0 ? 0 : totalMs / normalized.length,
      maxMs,
    })];
  }));

  const counterSummary = Object.fromEntries(COUNTER_NAMES.map((name) => {
    let total = 0;
    for (const { timings } of normalized) {
      total += timings.counters[name];
      if (!Number.isSafeInteger(total)) {
        throw new RangeError(`Visual Lab ${name} counter total exceeds the safe integer range`);
      }
    }
    return [name, total];
  }));

  return Object.freeze({
    sampledCandidates: Object.freeze(normalized.map(({ candidate }) => candidate)),
    phases: Object.freeze(phaseSummary),
    counters: Object.freeze(counterSummary),
  });
}

/**
 * Aggregates optional capture-internal telemetry in canonical candidate order.
 * Like the underlying records, this diagnostic summary is never an identity.
 */
export function summarizeVisualLabCaptureSubphaseTimings(candidateRecords) {
  if (!Array.isArray(candidateRecords)) {
    throw new TypeError('Visual Lab capture subphase timing candidates must be an array');
  }
  const normalized = candidateRecords.map((entry, index) => {
    assertExactFields(entry, ['candidate', 'captureSubphases'],
      `Visual Lab capture subphase timing candidate ${index}`);
    if (typeof entry.candidate !== 'string' || !SAFE_CANDIDATE.test(entry.candidate)) {
      throw new TypeError(`Invalid Visual Lab capture subphase timing candidate ${JSON.stringify(entry.candidate)}`);
    }
    return Object.freeze({
      candidate: entry.candidate,
      captureSubphases: normalizeVisualLabCaptureSubphaseTimings(entry.captureSubphases),
    });
  }).sort((left, right) => left.candidate.localeCompare(right.candidate));
  for (let index = 1; index < normalized.length; index++) {
    if (normalized[index - 1].candidate === normalized[index].candidate) {
      throw new TypeError(
        `Duplicate Visual Lab capture subphase timing candidate ${normalized[index].candidate}`,
      );
    }
  }

  const summarizeDuration = (read) => {
    let totalMs = 0;
    let maxMs = 0;
    for (const entry of normalized) {
      const value = read(entry.captureSubphases);
      totalMs += value;
      maxMs = Math.max(maxMs, value);
    }
    if (!Number.isFinite(totalMs)) {
      throw new RangeError('Visual Lab capture subphase timing total exceeds the finite number range');
    }
    return Object.freeze({
      totalMs,
      meanMs: normalized.length === 0 ? 0 : totalMs / normalized.length,
      maxMs,
    });
  };
  const summarizeAttempts = (read) => {
    let totalAttempts = 0;
    let maxAttempts = 0;
    for (const entry of normalized) {
      const value = read(entry.captureSubphases);
      totalAttempts += value;
      maxAttempts = Math.max(maxAttempts, value);
      if (!Number.isSafeInteger(totalAttempts)) {
        throw new RangeError('Visual Lab capture subphase attempt total exceeds the safe integer range');
      }
    }
    return Object.freeze({
      totalAttempts,
      meanAttempts: normalized.length === 0 ? 0 : totalAttempts / normalized.length,
      maxAttempts,
    });
  };
  const summarizeReadiness = () => Object.freeze({
    ...Object.fromEntries(READINESS_SUBPHASE_DURATION_NAMES.map((name) => [name,
      summarizeDuration((timings) => timings.readiness[name]),
    ])),
    snapshotAttempts: summarizeAttempts((timings) => timings.readiness.snapshotAttempts),
  });
  const summarizeCapture = (variant) => Object.freeze({
    ...Object.fromEntries(CAPTURE_SUBPHASE_DURATION_NAMES.map((name) => [name,
      summarizeDuration((timings) => timings.captures[variant][name]),
    ])),
    snapshotAttempts: summarizeAttempts((timings) => timings.captures[variant].snapshotAttempts),
  });

  return Object.freeze({
    sampledCandidates: Object.freeze(normalized.map(({ candidate }) => candidate)),
    readiness: summarizeReadiness(),
    captures: Object.freeze(Object.fromEntries(VISUAL_LAB_CAPTURE_VARIANT_NAMES.map((variant) => [
      variant,
      summarizeCapture(variant),
    ]))),
  });
}
