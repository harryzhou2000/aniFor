import { performance } from 'node:perf_hooks';

export const VISUAL_LAB_TIMING_SCHEMA = 'anifor.visual-lab.timings/v1';

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
