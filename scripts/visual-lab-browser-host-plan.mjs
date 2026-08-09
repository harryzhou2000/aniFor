import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import {
  VISUAL_LAB_EXECUTION_PLAN_SCHEMA,
} from './visual-lab-execution-plan.mjs';

export const VISUAL_LAB_BROWSER_HOST_PLAN_SCHEMA =
  'anifor.visual-lab.browser-host-plan/v1';

export const VISUAL_LAB_BROWSER_HOST_MODES = Object.freeze(['fresh', 'shared']);

const SHA256_ID = /^sha256:[0-9a-f]{64}$/;
const SAFE_CANDIDATE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SUPPORTED_RENDER_SCALES = new Set([1, 2, 4, 8]);

const CAPTURE_PLAN_FIELDS = Object.freeze([
  'recipeSet', 'entries', 'inspection', 'runtime',
]);
const CAPTURE_INSPECTION_FIELDS = Object.freeze([
  'schema', 'id', 'recipeSet', 'summary', 'variants', 'executionPolicy', 'entries',
]);
const CAPTURE_ENTRY_FIELDS = Object.freeze([
  'id', 'candidate', 'request', 'domain', 'fixture', 'driver', 'canonicalQuery',
  'executableDigest', 'artifacts', 'resultIdentityInput',
]);
const EXECUTABLE_ENTRY_FIELDS = Object.freeze([
  'candidate', 'recipe', 'request', 'domainAdapter', 'fixtureAdapter',
  'captureDriver', 'compiled', 'inspection', 'runtime',
]);
const PLAN_FIELDS = Object.freeze([
  'schema', 'id', 'capturePlan', 'requestedMode', 'policy', 'entries',
]);
const PLAN_REFERENCE_FIELDS = Object.freeze(['schema', 'id']);
const ENTRY_FIELDS = Object.freeze([
  'id', 'sequence', 'captureEntryId', 'candidate', 'renderScale', 'requestedMode',
  'effectiveMode', 'isolation', 'forcedFreshReason',
]);

const BROWSER_HOST_POLICY = deepFreeze({
  dispatch: 'sequential',
  sharedCandidateIsolation: 'fresh-incognito-context',
  freshCandidateIsolation: 'fresh-browser',
  targetCreation: 'direct-url',
  candidateTeardown: ['renderer-dispose', 'target-close', 'context-close'],
  recycleHostOn: [
    'timeout',
    'context-loss',
    'backend-fallback',
    'browser-error',
    'capture-error',
    'renderer-disposal-error',
    'target-teardown-error',
    'context-teardown-error',
  ],
  freshBrowserOnly: ['render-scale-8', 'context-loss-recovery'],
});

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

const digest = (value) => `sha256:${createHash('sha256')
  .update(JSON.stringify(value), 'utf8').digest('hex')}`;

const displayValue = (value) => JSON.stringify(value) ?? String(value);

const assertPlainRecord = (value, label) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain data object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain data object`);
  }
};

const assertExactFields = (value, fields, label) => {
  assertPlainRecord(value, label);
  const keys = Reflect.ownKeys(value);
  if (keys.length !== fields.length
    || keys.some((key) => typeof key !== 'string' || !fields.includes(key))
    || fields.some((field) => !Object.hasOwn(value, field))) {
    throw new TypeError(`${label} must contain exactly ${fields.join(', ')}`);
  }
};

const assertSha256Id = (value, label) => {
  if (typeof value !== 'string' || !SHA256_ID.test(value)) {
    throw new TypeError(`${label} must be a lowercase SHA-256 identity`);
  }
};

const assertJsonSafe = (value, label, ancestors = new Set(), depth = 0) => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${label} contains a non-finite number`);
    return;
  }
  if (typeof value !== 'object') {
    throw new TypeError(`${label} contains a non-JSON value`);
  }
  if (depth > 64) throw new TypeError(`${label} exceeds the maximum JSON depth`);
  if (ancestors.has(value)) throw new TypeError(`${label} contains a cycle`);

  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} contains a non-plain object`);
  }
  const keys = Reflect.ownKeys(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      if (!Object.hasOwn(value, index)) throw new TypeError(`${label} contains an array hole`);
    }
  }
  for (const key of keys) {
    if (Array.isArray(value) && key === 'length') continue;
    if (typeof key !== 'string') throw new TypeError(`${label} contains a symbol key`);
    if (Array.isArray(value) && !/^(?:0|[1-9][0-9]*)$/.test(key)) {
      throw new TypeError(`${label} contains a non-index array property`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      throw new TypeError(`${label} contains a non-enumerable or accessor property`);
    }
  }

  ancestors.add(value);
  for (const [key, nested] of Object.entries(value)) {
    assertJsonSafe(nested, `${label}.${key}`, ancestors, depth + 1);
  }
  ancestors.delete(value);
};

const normalizeRequestedMode = (requestedMode) => {
  if (!VISUAL_LAB_BROWSER_HOST_MODES.includes(requestedMode)) {
    throw new TypeError(
      `Visual Lab browser host mode must be fresh or shared; received ${displayValue(requestedMode)}`,
    );
  }
  return requestedMode;
};

const captureEntryIdentity = (entry) => ({
  candidate: entry.candidate,
  request: entry.request,
  domain: entry.domain,
  fixture: entry.fixture,
  driver: entry.driver,
  canonicalQuery: entry.canonicalQuery,
  executableDigest: entry.executableDigest,
  artifacts: entry.artifacts,
  resultIdentityInput: entry.resultIdentityInput,
});

const capturePlanIdentity = (inspection) => ({
  schema: inspection.schema,
  recipeSet: inspection.recipeSet,
  summary: inspection.summary,
  variants: inspection.variants,
  executionPolicy: inspection.executionPolicy,
  entries: inspection.entries,
});

/**
 * Validates the current execution-plan/v1 identity without rebuilding or
 * changing it, and extracts only the portable binding needed by this sibling.
 */
const captureBindings = (captureExecutionPlan) => {
  assertExactFields(
    captureExecutionPlan, CAPTURE_PLAN_FIELDS, 'Visual Lab capture execution plan',
  );
  assertJsonSafe(captureExecutionPlan.inspection, 'Visual Lab capture plan inspection');
  assertExactFields(
    captureExecutionPlan.inspection,
    CAPTURE_INSPECTION_FIELDS,
    'Visual Lab capture plan inspection',
  );
  const { inspection } = captureExecutionPlan;
  if (inspection.schema !== VISUAL_LAB_EXECUTION_PLAN_SCHEMA) {
    throw new TypeError(
      `Visual Lab capture plan schema must be ${VISUAL_LAB_EXECUTION_PLAN_SCHEMA}`,
    );
  }
  assertSha256Id(inspection.id, 'Visual Lab capture plan id');
  if (inspection.id !== digest(capturePlanIdentity(inspection))) {
    throw new TypeError('Visual Lab capture plan identity mismatch');
  }
  if (!Array.isArray(inspection.entries) || inspection.entries.length === 0) {
    throw new TypeError('Visual Lab capture plan entries must be a non-empty array');
  }
  if (!Number.isSafeInteger(inspection.summary?.selected)
    || inspection.summary.selected !== inspection.entries.length) {
    throw new TypeError('Visual Lab capture plan selected count must match its entries');
  }
  if (!Array.isArray(captureExecutionPlan.entries)
    || captureExecutionPlan.entries.length !== inspection.entries.length) {
    throw new TypeError('Visual Lab executable entries must match the capture inspection');
  }

  const seenCandidates = new Set();
  const seenEntryIds = new Set();
  const bindings = inspection.entries.map((entry, index) => {
    const label = `Visual Lab capture plan entry at index ${index}`;
    assertExactFields(entry, CAPTURE_ENTRY_FIELDS, label);
    assertSha256Id(entry.id, `${label} id`);
    if (entry.id !== digest({
      schema: VISUAL_LAB_EXECUTION_PLAN_SCHEMA,
      entry: captureEntryIdentity(entry),
      executionPolicy: inspection.executionPolicy,
    })) {
      throw new TypeError(`${label} identity mismatch`);
    }
    if (typeof entry.candidate !== 'string' || !SAFE_CANDIDATE.test(entry.candidate)) {
      throw new TypeError(`${label} has an invalid candidate`);
    }
    if (seenCandidates.has(entry.candidate)) {
      throw new TypeError(`Duplicate Visual Lab capture candidate ${entry.candidate}`);
    }
    if (seenEntryIds.has(entry.id)) {
      throw new TypeError(`Duplicate Visual Lab capture entry id ${entry.id}`);
    }
    const renderScale = entry.request?.renderScale;
    if (!SUPPORTED_RENDER_SCALES.has(renderScale)) {
      throw new TypeError(`${label} has unsupported renderScale ${displayValue(renderScale)}`);
    }

    const executable = captureExecutionPlan.entries[index];
    assertExactFields(executable, EXECUTABLE_ENTRY_FIELDS, `Visual Lab executable entry ${index}`);
    if (!isDeepStrictEqual(executable.inspection, entry)
      || executable.candidate !== entry.candidate
      || !isDeepStrictEqual(executable.request, entry.request)) {
      throw new TypeError(`Visual Lab executable entry ${index} does not match its inspection`);
    }

    seenCandidates.add(entry.candidate);
    seenEntryIds.add(entry.id);
    return Object.freeze({
      captureEntryId: entry.id,
      candidate: entry.candidate,
      renderScale,
    });
  });

  return deepFreeze({
    capturePlan: {
      schema: inspection.schema,
      id: inspection.id,
    },
    entries: bindings,
  });
};

const browserHostEntryIdentity = (capturePlan, entry) => ({
  schema: VISUAL_LAB_BROWSER_HOST_PLAN_SCHEMA,
  kind: 'entry',
  capturePlan,
  sequence: entry.sequence,
  captureEntryId: entry.captureEntryId,
  candidate: entry.candidate,
  renderScale: entry.renderScale,
  requestedMode: entry.requestedMode,
  effectiveMode: entry.effectiveMode,
  isolation: entry.isolation,
  forcedFreshReason: entry.forcedFreshReason,
});

const createEntry = (capturePlan, binding, requestedMode, sequence) => {
  const forcedFreshReason = requestedMode === 'shared' && binding.renderScale === 8
    ? 'render-scale-8' : null;
  const effectiveMode = forcedFreshReason === null ? requestedMode : 'fresh';
  const entry = {
    sequence,
    captureEntryId: binding.captureEntryId,
    candidate: binding.candidate,
    renderScale: binding.renderScale,
    requestedMode,
    effectiveMode,
    isolation: effectiveMode === 'shared'
      ? BROWSER_HOST_POLICY.sharedCandidateIsolation
      : BROWSER_HOST_POLICY.freshCandidateIsolation,
    forcedFreshReason,
  };
  return deepFreeze({
    id: digest(browserHostEntryIdentity(capturePlan, entry)),
    ...entry,
  });
};

const createFromBindings = (bindings, requestedMode) => {
  const normalizedMode = normalizeRequestedMode(requestedMode);
  const entries = Object.freeze(bindings.entries.map((binding, sequence) => (
    createEntry(bindings.capturePlan, binding, normalizedMode, sequence)
  )));
  const identity = deepFreeze({
    schema: VISUAL_LAB_BROWSER_HOST_PLAN_SCHEMA,
    capturePlan: bindings.capturePlan,
    requestedMode: normalizedMode,
    policy: BROWSER_HOST_POLICY,
    entries,
  });
  return deepFreeze({
    schema: identity.schema,
    id: digest(identity),
    capturePlan: identity.capturePlan,
    requestedMode: identity.requestedMode,
    policy: identity.policy,
    entries: identity.entries,
  });
};

/**
 * Creates a disjoint, portable browser-host plan. The referenced capture plan
 * remains authoritative for request, executable, result, and artifact identity.
 */
export function createVisualLabBrowserHostPlan(captureExecutionPlan, requestedMode = 'fresh') {
  return createFromBindings(captureBindings(captureExecutionPlan), requestedMode);
}

const normalizeEmbeddedBindings = (input) => {
  assertJsonSafe(input, 'Visual Lab browser host plan');
  assertExactFields(input, PLAN_FIELDS, 'Visual Lab browser host plan');
  if (input.schema !== VISUAL_LAB_BROWSER_HOST_PLAN_SCHEMA) {
    throw new TypeError(
      `Visual Lab browser host plan schema must be ${VISUAL_LAB_BROWSER_HOST_PLAN_SCHEMA}`,
    );
  }
  assertSha256Id(input.id, 'Visual Lab browser host plan id');
  assertExactFields(input.capturePlan, PLAN_REFERENCE_FIELDS, 'Visual Lab capture plan reference');
  if (input.capturePlan.schema !== VISUAL_LAB_EXECUTION_PLAN_SCHEMA) {
    throw new TypeError(
      `Visual Lab capture plan reference schema must be ${VISUAL_LAB_EXECUTION_PLAN_SCHEMA}`,
    );
  }
  assertSha256Id(input.capturePlan.id, 'Visual Lab capture plan reference id');
  const requestedMode = normalizeRequestedMode(input.requestedMode);
  if (!isDeepStrictEqual(input.policy, BROWSER_HOST_POLICY)) {
    throw new TypeError('Visual Lab browser host policy does not match the frozen v1 policy');
  }
  if (!Array.isArray(input.entries) || input.entries.length === 0) {
    throw new TypeError('Visual Lab browser host plan entries must be a non-empty array');
  }

  const seenCandidates = new Set();
  const seenCaptureIds = new Set();
  const seenIds = new Set();
  const entries = input.entries.map((entry, sequence) => {
    const label = `Visual Lab browser host entry at index ${sequence}`;
    assertExactFields(entry, ENTRY_FIELDS, label);
    assertSha256Id(entry.id, `${label} id`);
    assertSha256Id(entry.captureEntryId, `${label} captureEntryId`);
    if (typeof entry.candidate !== 'string' || !SAFE_CANDIDATE.test(entry.candidate)) {
      throw new TypeError(`${label} has an invalid candidate`);
    }
    if (!SUPPORTED_RENDER_SCALES.has(entry.renderScale)) {
      throw new TypeError(`${label} has unsupported renderScale ${displayValue(entry.renderScale)}`);
    }
    if (seenCandidates.has(entry.candidate)) {
      throw new TypeError(`Duplicate Visual Lab browser host candidate ${entry.candidate}`);
    }
    if (seenCaptureIds.has(entry.captureEntryId)) {
      throw new TypeError(`Duplicate Visual Lab browser host capture entry ${entry.captureEntryId}`);
    }
    if (seenIds.has(entry.id)) {
      throw new TypeError(`Duplicate Visual Lab browser host entry id ${entry.id}`);
    }
    seenCandidates.add(entry.candidate);
    seenCaptureIds.add(entry.captureEntryId);
    seenIds.add(entry.id);
    return Object.freeze({
      captureEntryId: entry.captureEntryId,
      candidate: entry.candidate,
      renderScale: entry.renderScale,
    });
  });
  return deepFreeze({
    capturePlan: {
      schema: input.capturePlan.schema,
      id: input.capturePlan.id,
    },
    entries,
    requestedMode,
  });
};

/** Validates untrusted JSON and returns a detached canonical frozen plan. */
export function normalizeVisualLabBrowserHostPlan(input, captureExecutionPlan) {
  const embedded = normalizeEmbeddedBindings(input);
  if (captureExecutionPlan !== undefined) {
    const authoritative = captureBindings(captureExecutionPlan);
    if (!isDeepStrictEqual(embedded.capturePlan, authoritative.capturePlan)
      || !isDeepStrictEqual(embedded.entries, authoritative.entries)) {
      throw new TypeError('Visual Lab browser host plan does not match its capture execution plan');
    }
  }
  const expected = createFromBindings(embedded, embedded.requestedMode);
  if (!isDeepStrictEqual(input, expected)) {
    throw new TypeError(
      `Visual Lab browser host plan is not canonical or has an identity mismatch; expected ${expected.id}`,
    );
  }
  return expected;
}

/**
 * Resolves one content-addressed host entry after validating the complete plan.
 * An audit child may additionally bind it to its capture execution entry ID.
 */
export function resolveVisualLabBrowserHostPlanEntry(
  input,
  entryId,
  expectedCaptureEntryId,
) {
  assertSha256Id(entryId, 'Visual Lab browser host entry id');
  if (expectedCaptureEntryId !== undefined) {
    assertSha256Id(expectedCaptureEntryId, 'Expected Visual Lab capture entry id');
  }
  const plan = normalizeVisualLabBrowserHostPlan(input);
  const entry = plan.entries.find(({ id }) => id === entryId);
  if (entry === undefined) {
    throw new Error(`Unknown Visual Lab browser host entry id ${entryId}`);
  }
  if (expectedCaptureEntryId !== undefined
    && entry.captureEntryId !== expectedCaptureEntryId) {
    throw new Error(
      `Visual Lab browser host entry ${entryId} does not bind capture entry ${expectedCaptureEntryId}`,
    );
  }
  return entry;
}
