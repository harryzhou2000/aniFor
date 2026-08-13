import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import {
  VISUAL_LAB_EXECUTION_PLAN_SCHEMA,
} from './visual-lab-execution-plan.mjs';

/**
 * Portable, data-only capture timing/readiness contract.  This deliberately
 * does not alter the execution-plan/v1 identity: it binds that plan by ID.
 */
export const VISUAL_LAB_EXECUTION_TUNING_PLAN_SCHEMA =
  'anifor.visual-lab.execution-tuning-plan/v1';
export const VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA =
  'anifor.visual-lab.execution-tuning-plan/v2';
export const VISUAL_LAB_EXECUTION_TUNING_PLAN_V3_SCHEMA =
  'anifor.visual-lab.execution-tuning-plan/v3';
export const VISUAL_LAB_EXECUTION_TUNING_PLAN_V4_SCHEMA =
  'anifor.visual-lab.execution-tuning-plan/v4';
export const VISUAL_LAB_EXECUTION_TUNING_PLAN_V5_SCHEMA =
  'anifor.visual-lab.execution-tuning-plan/v5';
export const VISUAL_LAB_EXECUTION_TUNING_PLAN_V6_SCHEMA =
  'anifor.visual-lab.execution-tuning-plan/v6';
export const VISUAL_LAB_EXECUTION_TUNING_PLAN_V7_SCHEMA =
  'anifor.visual-lab.execution-tuning-plan/v7';

const SHA256_ID = /^sha256:[0-9a-f]{64}$/;
const SAFE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GPU_MODES = Object.freeze(['auto', 'swiftshader']);
const EVIDENCE_PLANES = Object.freeze([
  'semantic', 'field-alpha', 'framebuffer-alpha',
]);

const CAPTURE_PLAN_FIELDS = Object.freeze(['recipeSet', 'entries', 'inspection', 'runtime']);
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
const PLAN_FIELDS = Object.freeze(['schema', 'id', 'capturePlan', 'gpuMode', 'entries']);
const PLAN_REFERENCE_FIELDS = Object.freeze(['schema', 'id']);
const ENTRY_FIELDS = Object.freeze([
  'id', 'sequence', 'captureEntryId', 'candidate', 'driver', 'profile', 'effectiveTimeouts',
]);
const PROFILE_FIELDS = Object.freeze([
  'startup', 'readiness', 'selection', 'stability', 'screenshot',
]);
const V2_PROFILE_FIELDS = Object.freeze([
  'startup', 'readiness', 'selection', 'stability', 'completion', 'screenshot',
]);
const V3_PROFILE_FIELDS = Object.freeze([
  'startup', 'readiness', 'readinessCompletion', 'selection', 'stability', 'completion', 'screenshot',
]);
const V4_PROFILE_FIELDS = Object.freeze([
  'startup', 'readiness', 'selection', 'stability', 'completion', 'screenshot',
]);
const V5_PROFILE_FIELDS = Object.freeze([
  'startup', 'readiness', 'readinessActivation', 'selection', 'stability', 'completion', 'screenshot',
]);
const V6_PROFILE_FIELDS = V5_PROFILE_FIELDS;
const V7_PROFILE_FIELDS = V5_PROFILE_FIELDS;
const STARTUP_FIELDS = Object.freeze(['variant', 'fieldRefresh', 'rafs']);
const READINESS_FIELDS = Object.freeze(['planes', 'pollIntervalMs', 'timeoutMsByGpu']);
const SELECTION_FIELDS = Object.freeze(['rafs', 'exactDataset']);
const STABILITY_FIELDS = Object.freeze([
  'planes', 'consecutiveSnapshots', 'pollIntervalMs', 'timeoutMsByGpu',
]);
const SCREENSHOT_FIELDS = Object.freeze(['after']);
const COMPLETION_FIELDS = Object.freeze([
  'capability', 'receiptSchema', 'requiredState', 'bind', 'verifyAfterSnapshot',
]);
const READINESS_ACTIVATION_FIELDS = Object.freeze([
  'capability', 'requiredState', 'bind', 'snapshotAfterCompletion',
]);
const V6_READINESS_ACTIVATION_FIELDS = Object.freeze([
  'capability', 'requiredState', 'bind', 'completionScope', 'snapshotAfterCompletion',
]);
const V7_READINESS_ACTIVATION_FIELDS = V6_READINESS_ACTIVATION_FIELDS;
const GPU_TIMEOUT_FIELDS = Object.freeze([...GPU_MODES]);
const EFFECTIVE_TIMEOUT_FIELDS = Object.freeze(['readinessMs', 'stabilityMs']);

const deepFreeze = (value) => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

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
  if (typeof value !== 'object') throw new TypeError(`${label} contains a non-JSON value`);
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

const assertSafeName = (value, label) => {
  if (typeof value !== 'string' || !SAFE_NAME.test(value)) {
    throw new TypeError(`${label} must be a safe lowercase dashed name`);
  }
};

const assertExactArray = (value, expected, label) => {
  if (!Array.isArray(value) || !isDeepStrictEqual(value, expected)) {
    throw new TypeError(`${label} must exactly equal ${JSON.stringify(expected)}`);
  }
};

const assertBoundedMilliseconds = (value, label) => {
  if (!Number.isSafeInteger(value) || value < 1 || value > 120_000) {
    throw new TypeError(`${label} must be an integer from 1 through 120000`);
  }
};

const normalizeGpuMode = (value) => {
  if (!GPU_MODES.includes(value)) {
    throw new TypeError(`Visual Lab capture gpuMode must be auto or swiftshader; received ${displayValue(value)}`);
  }
  return value;
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

/** Validates only the portable execution-plan projection this sibling binds. */
const captureBindings = (captureExecutionPlan) => {
  assertExactFields(captureExecutionPlan, CAPTURE_PLAN_FIELDS, 'Visual Lab capture execution plan');
  assertJsonSafe(captureExecutionPlan.inspection, 'Visual Lab capture plan inspection');
  assertExactFields(
    captureExecutionPlan.inspection,
    CAPTURE_INSPECTION_FIELDS,
    'Visual Lab capture plan inspection',
  );
  const { inspection } = captureExecutionPlan;
  if (inspection.schema !== VISUAL_LAB_EXECUTION_PLAN_SCHEMA) {
    throw new TypeError(`Visual Lab capture plan schema must be ${VISUAL_LAB_EXECUTION_PLAN_SCHEMA}`);
  }
  assertSha256Id(inspection.id, 'Visual Lab capture plan id');
  if (inspection.id !== digest(capturePlanIdentity(inspection))) {
    throw new TypeError('Visual Lab capture plan identity mismatch');
  }
  const gpuMode = normalizeGpuMode(inspection.executionPolicy?.gpuMode);
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
  const entries = inspection.entries.map((entry, index) => {
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
    assertSafeName(entry.candidate, `${label} candidate`);
    assertPlainRecord(entry.driver, `${label} driver`);
    assertSafeName(entry.driver.name, `${label} driver name`);
    if (seenCandidates.has(entry.candidate)) {
      throw new TypeError(`Duplicate Visual Lab capture candidate ${entry.candidate}`);
    }
    if (seenEntryIds.has(entry.id)) {
      throw new TypeError(`Duplicate Visual Lab capture entry id ${entry.id}`);
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
      driver: entry.driver.name,
    });
  });
  return deepFreeze({
    capturePlan: { schema: inspection.schema, id: inspection.id },
    gpuMode,
    entries,
  });
};

const normalizeTimeouts = (value, label, minimumPollMs) => {
  assertExactFields(value, GPU_TIMEOUT_FIELDS, label);
  const normalized = {};
  for (const gpuMode of GPU_MODES) {
    assertBoundedMilliseconds(value[gpuMode], `${label}.${gpuMode}`);
    if (value[gpuMode] < minimumPollMs) {
      throw new TypeError(`${label}.${gpuMode} must not be shorter than the poll interval`);
    }
    normalized[gpuMode] = value[gpuMode];
  }
  return deepFreeze(normalized);
};

/**
 * A profile deliberately names proof mechanics rather than executable browser
 * expressions. The host/driver owns how these descriptors are performed.
 */
const normalizeProfile = (input, label, schema) => {
  assertJsonSafe(input, label);
  const isV2 = schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA;
  const isV3 = schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V3_SCHEMA;
  const isV4 = schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V4_SCHEMA;
  const isV5 = schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V5_SCHEMA;
  const isV6 = schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V6_SCHEMA;
  const isV7 = schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V7_SCHEMA;
  const hasReadinessCompletion = isV3;
  const hasReadinessActivation = isV5 || isV6 || isV7;
  const hasCompletion = isV2 || isV3 || isV4 || isV5 || isV6 || isV7;
  assertExactFields(
    input,
    isV7 ? V7_PROFILE_FIELDS
      : isV6 ? V6_PROFILE_FIELDS
      : isV5 ? V5_PROFILE_FIELDS
      : isV4 ? V4_PROFILE_FIELDS : isV3 ? V3_PROFILE_FIELDS : isV2 ? V2_PROFILE_FIELDS : PROFILE_FIELDS,
    label,
  );
  assertExactFields(input.startup, STARTUP_FIELDS, `${label}.startup`);
  if (input.startup.variant !== 'b' || input.startup.fieldRefresh !== 'explicit'
    || input.startup.rafs !== 2) {
    throw new TypeError(`${label}.startup must seed variant b, explicitly refresh the field, and wait 2 RAFs`);
  }
  assertExactFields(input.readiness, READINESS_FIELDS, `${label}.readiness`);
  assertExactArray(input.readiness.planes, EVIDENCE_PLANES, `${label}.readiness.planes`);
  assertBoundedMilliseconds(input.readiness.pollIntervalMs, `${label}.readiness.pollIntervalMs`);
  const readinessTimeoutMsByGpu = normalizeTimeouts(
    input.readiness.timeoutMsByGpu,
    `${label}.readiness.timeoutMsByGpu`,
    input.readiness.pollIntervalMs,
  );
  assertExactFields(input.selection, SELECTION_FIELDS, `${label}.selection`);
  if (input.selection.rafs !== 2 || input.selection.exactDataset !== true) {
    throw new TypeError(`${label}.selection must wait 2 RAFs and require exact dataset state`);
  }
  assertExactFields(input.stability, STABILITY_FIELDS, `${label}.stability`);
  assertExactArray(input.stability.planes, EVIDENCE_PLANES, `${label}.stability.planes`);
  if (hasCompletion) {
    assertExactFields(input.completion, COMPLETION_FIELDS, `${label}.completion`);
    const completionBind = isV4 || isV5 || isV6 || isV7
      ? 'selection-owned-presentation' : 'selected-presentation';
    if (input.completion.capability !== 'renderer-completed-frame-receipt/v1'
      || input.completion.receiptSchema !== 'anifor.renderer.completed-frame-receipt/v1'
      || input.completion.requiredState !== 'completed'
      || input.completion.bind !== completionBind
      || input.completion.verifyAfterSnapshot !== true) {
      throw new TypeError(`${label}.completion must be the exact completed-frame receipt proof`);
    }
    if (input.stability.consecutiveSnapshots !== 1) {
      throw new TypeError(`${label}.stability must require exactly 1 snapshot with the completed-frame receipt proof`);
    }
  } else if (input.stability.consecutiveSnapshots !== 2) {
    throw new TypeError(`${label}.stability must require exactly 2 consecutive snapshots`);
  }
  assertBoundedMilliseconds(input.stability.pollIntervalMs, `${label}.stability.pollIntervalMs`);
  const stabilityTimeoutMsByGpu = normalizeTimeouts(
    input.stability.timeoutMsByGpu,
    `${label}.stability.timeoutMsByGpu`,
    input.stability.pollIntervalMs,
  );
  assertExactFields(input.screenshot, SCREENSHOT_FIELDS, `${label}.screenshot`);
  if (input.screenshot.after !== 'stability-proof') {
    throw new TypeError(`${label}.screenshot must occur only after stability-proof`);
  }
  const normalized = {
    startup: {
      variant: input.startup.variant,
      fieldRefresh: input.startup.fieldRefresh,
      rafs: input.startup.rafs,
    },
    readiness: {
      planes: [...input.readiness.planes],
      pollIntervalMs: input.readiness.pollIntervalMs,
      timeoutMsByGpu: readinessTimeoutMsByGpu,
    },
    selection: { rafs: input.selection.rafs, exactDataset: input.selection.exactDataset },
    stability: {
      planes: [...input.stability.planes],
      consecutiveSnapshots: input.stability.consecutiveSnapshots,
      pollIntervalMs: input.stability.pollIntervalMs,
      timeoutMsByGpu: stabilityTimeoutMsByGpu,
    },
  };
  if (hasReadinessCompletion) {
    assertExactFields(input.readinessCompletion, COMPLETION_FIELDS, `${label}.readinessCompletion`);
    if (input.readinessCompletion.capability !== 'renderer-completed-frame-receipt/v1'
      || input.readinessCompletion.receiptSchema !== 'anifor.renderer.completed-frame-receipt/v1'
      || input.readinessCompletion.requiredState !== 'completed'
      || input.readinessCompletion.bind !== 'refreshed-presentation'
      || input.readinessCompletion.verifyAfterSnapshot !== true) {
      throw new TypeError(`${label}.readinessCompletion must be the exact refreshed-presentation receipt proof`);
    }
    normalized.readinessCompletion = {
      capability: input.readinessCompletion.capability,
      receiptSchema: input.readinessCompletion.receiptSchema,
      requiredState: input.readinessCompletion.requiredState,
      bind: input.readinessCompletion.bind,
      verifyAfterSnapshot: input.readinessCompletion.verifyAfterSnapshot,
    };
  }
  if (hasReadinessActivation) {
    assertExactFields(
      input.readinessActivation,
      isV7 ? V7_READINESS_ACTIVATION_FIELDS
        : isV6 ? V6_READINESS_ACTIVATION_FIELDS : READINESS_ACTIVATION_FIELDS,
      `${label}.readinessActivation`,
    );
    const expectedCapability = isV7
      ? 'renderer-fixture-activation-generation/v3'
      : isV6 ? 'renderer-fixture-activation-generation/v2'
      : 'renderer-fixture-activation-generation/v1';
    const expectedCompletionScope = isV7
      ? 'activation-owned-render-fields' : 'activation-owned-work';
    if (input.readinessActivation.capability !== expectedCapability
      || input.readinessActivation.requiredState !== 'completed'
      || input.readinessActivation.bind !== 'typed-fixture-activation'
      || ((isV6 || isV7)
        && input.readinessActivation.completionScope !== expectedCompletionScope)
      || input.readinessActivation.snapshotAfterCompletion !== true) {
      throw new TypeError(`${label}.readinessActivation must be the exact typed fixture-activation generation proof`);
    }
    normalized.readinessActivation = {
      capability: input.readinessActivation.capability,
      requiredState: input.readinessActivation.requiredState,
      bind: input.readinessActivation.bind,
      ...(isV6 || isV7 ? { completionScope: input.readinessActivation.completionScope } : {}),
      snapshotAfterCompletion: input.readinessActivation.snapshotAfterCompletion,
    };
  }
  if (hasCompletion) {
    normalized.completion = {
      capability: input.completion.capability,
      receiptSchema: input.completion.receiptSchema,
      requiredState: input.completion.requiredState,
      bind: input.completion.bind,
      verifyAfterSnapshot: input.completion.verifyAfterSnapshot,
    };
  }
  normalized.screenshot = { after: input.screenshot.after };
  return deepFreeze(normalized);
};

const normalizeDriverProfiles = (driverProfiles, bindings, schema) => {
  assertJsonSafe(driverProfiles, 'Visual Lab execution tuning driver profiles');
  assertPlainRecord(driverProfiles, 'Visual Lab execution tuning driver profiles');
  const drivers = [];
  for (const { driver } of bindings.entries) {
    if (!drivers.includes(driver)) drivers.push(driver);
  }
  const keys = Object.keys(driverProfiles);
  if (!isDeepStrictEqual(keys, drivers)) {
    throw new TypeError(`Visual Lab execution tuning driver profiles must exactly contain, in capture order, ${drivers.join(', ')}`);
  }
  return deepFreeze(Object.fromEntries(drivers.map((driver) => [
    driver,
    normalizeProfile(driverProfiles[driver], `Visual Lab execution tuning profile ${driver}`, schema),
  ])));
};

const effectiveTimeoutsFor = (profile, gpuMode) => deepFreeze({
  readinessMs: profile.readiness.timeoutMsByGpu[gpuMode],
  stabilityMs: profile.stability.timeoutMsByGpu[gpuMode],
});

const entryIdentity = (schema, capturePlan, entry) => ({
  schema,
  kind: 'entry',
  capturePlan,
  sequence: entry.sequence,
  captureEntryId: entry.captureEntryId,
  candidate: entry.candidate,
  driver: entry.driver,
  profile: entry.profile,
  effectiveTimeouts: entry.effectiveTimeouts,
});

const createEntry = (schema, capturePlan, binding, profile, gpuMode, sequence) => {
  const entry = {
    sequence,
    captureEntryId: binding.captureEntryId,
    candidate: binding.candidate,
    driver: binding.driver,
    profile,
    effectiveTimeouts: effectiveTimeoutsFor(profile, gpuMode),
  };
  return deepFreeze({ id: digest(entryIdentity(schema, capturePlan, entry)), ...entry });
};

const createFromBindings = (schema, bindings, driverProfiles) => {
  const profiles = normalizeDriverProfiles(driverProfiles, bindings, schema);
  const entries = Object.freeze(bindings.entries.map((binding, sequence) => (
    createEntry(schema, bindings.capturePlan, binding, profiles[binding.driver], bindings.gpuMode, sequence)
  )));
  const identity = deepFreeze({
    schema,
    capturePlan: bindings.capturePlan,
    gpuMode: bindings.gpuMode,
    entries,
  });
  return deepFreeze({
    schema: identity.schema,
    id: digest(identity),
    capturePlan: identity.capturePlan,
    gpuMode: identity.gpuMode,
    entries: identity.entries,
  });
};

/**
 * Creates a sibling plan from a complete execution plan and an exact,
 * driver-name keyed, plain-data profile map. No executable authority is
 * accepted or serialized here.
 */
export function createVisualLabExecutionTuningPlan(captureExecutionPlan, driverProfiles) {
  return createFromBindings(
    VISUAL_LAB_EXECUTION_TUNING_PLAN_SCHEMA,
    captureBindings(captureExecutionPlan),
    driverProfiles,
  );
}

/** Creates the opt-in completed-frame-receipt v2 sibling plan. */
export function createVisualLabExecutionTuningPlanV2(captureExecutionPlan, driverProfiles) {
  return createFromBindings(
    VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA,
    captureBindings(captureExecutionPlan),
    driverProfiles,
  );
}

/** Creates the opt-in readiness-and-capture completed-frame-receipt v3 sibling plan. */
export function createVisualLabExecutionTuningPlanV3(captureExecutionPlan, driverProfiles) {
  return createFromBindings(
    VISUAL_LAB_EXECUTION_TUNING_PLAN_V3_SCHEMA,
    captureBindings(captureExecutionPlan),
    driverProfiles,
  );
}

/** Creates the opt-in stable-readiness and selection-owned receipt v4 sibling plan. */
export function createVisualLabExecutionTuningPlanV4(captureExecutionPlan, driverProfiles) {
  return createFromBindings(
    VISUAL_LAB_EXECUTION_TUNING_PLAN_V4_SCHEMA,
    captureBindings(captureExecutionPlan),
    driverProfiles,
  );
}

/** Creates the opt-in fixture-activation generation and selection-owned receipt v5 plan. */
export function createVisualLabExecutionTuningPlanV5(captureExecutionPlan, driverProfiles) {
  return createFromBindings(
    VISUAL_LAB_EXECUTION_TUNING_PLAN_V5_SCHEMA,
    captureBindings(captureExecutionPlan),
    driverProfiles,
  );
}

/** Creates the opt-in activation-owned work generation v6 plan. */
export function createVisualLabExecutionTuningPlanV6(captureExecutionPlan, driverProfiles) {
  return createFromBindings(
    VISUAL_LAB_EXECUTION_TUNING_PLAN_V6_SCHEMA,
    captureBindings(captureExecutionPlan),
    driverProfiles,
  );
}

/** Creates the opt-in activation-owned render-field generation v7 plan. */
export function createVisualLabExecutionTuningPlanV7(captureExecutionPlan, driverProfiles) {
  return createFromBindings(
    VISUAL_LAB_EXECUTION_TUNING_PLAN_V7_SCHEMA,
    captureBindings(captureExecutionPlan),
    driverProfiles,
  );
}

const normalizeEmbeddedPlan = (input, schema) => {
  assertJsonSafe(input, 'Visual Lab execution tuning plan');
  assertExactFields(input, PLAN_FIELDS, 'Visual Lab execution tuning plan');
  if (input.schema !== schema) {
    throw new TypeError(`Visual Lab execution tuning plan schema must be ${schema}`);
  }
  assertSha256Id(input.id, 'Visual Lab execution tuning plan id');
  assertExactFields(input.capturePlan, PLAN_REFERENCE_FIELDS, 'Visual Lab capture plan reference');
  if (input.capturePlan.schema !== VISUAL_LAB_EXECUTION_PLAN_SCHEMA) {
    throw new TypeError(`Visual Lab capture plan reference schema must be ${VISUAL_LAB_EXECUTION_PLAN_SCHEMA}`);
  }
  assertSha256Id(input.capturePlan.id, 'Visual Lab capture plan reference id');
  const gpuMode = normalizeGpuMode(input.gpuMode);
  if (!Array.isArray(input.entries) || input.entries.length === 0) {
    throw new TypeError('Visual Lab execution tuning plan entries must be a non-empty array');
  }
  const seenCandidates = new Set();
  const seenCaptureIds = new Set();
  const seenIds = new Set();
  const entries = input.entries.map((entry, sequence) => {
    const label = `Visual Lab execution tuning entry at index ${sequence}`;
    assertExactFields(entry, ENTRY_FIELDS, label);
    assertSha256Id(entry.id, `${label} id`);
    assertSha256Id(entry.captureEntryId, `${label} captureEntryId`);
    if (entry.sequence !== sequence) throw new TypeError(`${label} sequence must match its array index`);
    assertSafeName(entry.candidate, `${label} candidate`);
    assertSafeName(entry.driver, `${label} driver`);
    if (seenCandidates.has(entry.candidate)) {
      throw new TypeError(`Duplicate Visual Lab execution tuning candidate ${entry.candidate}`);
    }
    if (seenCaptureIds.has(entry.captureEntryId)) {
      throw new TypeError(`Duplicate Visual Lab execution tuning capture entry ${entry.captureEntryId}`);
    }
    if (seenIds.has(entry.id)) throw new TypeError(`Duplicate Visual Lab execution tuning entry id ${entry.id}`);
    const profile = normalizeProfile(entry.profile, `${label} profile`, schema);
    assertExactFields(entry.effectiveTimeouts, EFFECTIVE_TIMEOUT_FIELDS, `${label} effectiveTimeouts`);
    const effectiveTimeouts = effectiveTimeoutsFor(profile, gpuMode);
    if (!isDeepStrictEqual(entry.effectiveTimeouts, effectiveTimeouts)) {
      throw new TypeError(`${label} effectiveTimeouts do not match its profile and gpuMode`);
    }
    const canonicalEntry = {
      sequence,
      captureEntryId: entry.captureEntryId,
      candidate: entry.candidate,
      driver: entry.driver,
      profile,
      effectiveTimeouts,
    };
    if (entry.id !== digest(entryIdentity(schema, input.capturePlan, canonicalEntry))) {
      throw new TypeError(`${label} identity mismatch`);
    }
    seenCandidates.add(entry.candidate);
    seenCaptureIds.add(entry.captureEntryId);
    seenIds.add(entry.id);
    return deepFreeze({
      id: entry.id,
      sequence,
      captureEntryId: entry.captureEntryId,
      candidate: entry.candidate,
      driver: entry.driver,
      profile,
      effectiveTimeouts,
    });
  });
  return deepFreeze({
    capturePlan: { schema: input.capturePlan.schema, id: input.capturePlan.id },
    gpuMode,
    entries,
  });
};

/** Validates untrusted JSON and returns a detached canonical frozen sibling plan. */
const normalizePlan = (input, captureExecutionPlan, schema) => {
  const embedded = normalizeEmbeddedPlan(input, schema);
  if (captureExecutionPlan !== undefined) {
    const authoritative = captureBindings(captureExecutionPlan);
    const authoritativeEntries = authoritative.entries.map(({ captureEntryId, candidate, driver }) => ({
      captureEntryId, candidate, driver,
    }));
    const embeddedEntries = embedded.entries.map(({ captureEntryId, candidate, driver }) => ({
      captureEntryId, candidate, driver,
    }));
    if (!isDeepStrictEqual(embedded.capturePlan, authoritative.capturePlan)
      || embedded.gpuMode !== authoritative.gpuMode
      || !isDeepStrictEqual(embeddedEntries, authoritativeEntries)) {
      throw new TypeError('Visual Lab execution tuning plan does not match its capture execution plan');
    }
  }
  const identity = {
    schema,
    capturePlan: embedded.capturePlan,
    gpuMode: embedded.gpuMode,
    entries: embedded.entries,
  };
  const expected = deepFreeze({
    schema: identity.schema,
    id: digest(identity),
    capturePlan: identity.capturePlan,
    gpuMode: identity.gpuMode,
    entries: identity.entries,
  });
  if (!isDeepStrictEqual(input, expected)) {
    throw new TypeError(`Visual Lab execution tuning plan is not canonical or has an identity mismatch; expected ${expected.id}`);
  }
  return expected;
};

/** Validates untrusted v1 JSON and returns a detached canonical frozen sibling plan. */
export function normalizeVisualLabExecutionTuningPlan(input, captureExecutionPlan) {
  return normalizePlan(input, captureExecutionPlan, VISUAL_LAB_EXECUTION_TUNING_PLAN_SCHEMA);
}

/** Validates untrusted v2 completed-frame-receipt JSON and returns a frozen sibling plan. */
export function normalizeVisualLabExecutionTuningPlanV2(input, captureExecutionPlan) {
  return normalizePlan(input, captureExecutionPlan, VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA);
}

/** Validates untrusted v3 readiness-and-capture receipt JSON. */
export function normalizeVisualLabExecutionTuningPlanV3(input, captureExecutionPlan) {
  return normalizePlan(input, captureExecutionPlan, VISUAL_LAB_EXECUTION_TUNING_PLAN_V3_SCHEMA);
}

/** Validates untrusted v4 stable-readiness and selection-owned receipt JSON. */
export function normalizeVisualLabExecutionTuningPlanV4(input, captureExecutionPlan) {
  return normalizePlan(input, captureExecutionPlan, VISUAL_LAB_EXECUTION_TUNING_PLAN_V4_SCHEMA);
}

/** Validates untrusted v5 fixture-activation generation JSON. */
export function normalizeVisualLabExecutionTuningPlanV5(input, captureExecutionPlan) {
  return normalizePlan(input, captureExecutionPlan, VISUAL_LAB_EXECUTION_TUNING_PLAN_V5_SCHEMA);
}

/** Validates untrusted v6 activation-owned work generation JSON. */
export function normalizeVisualLabExecutionTuningPlanV6(input, captureExecutionPlan) {
  return normalizePlan(input, captureExecutionPlan, VISUAL_LAB_EXECUTION_TUNING_PLAN_V6_SCHEMA);
}

/** Validates untrusted v7 activation-owned render-field generation JSON. */
export function normalizeVisualLabExecutionTuningPlanV7(input, captureExecutionPlan) {
  return normalizePlan(input, captureExecutionPlan, VISUAL_LAB_EXECUTION_TUNING_PLAN_V7_SCHEMA);
}

/** Resolves one fully validated tuning entry, optionally bound to capture entry ID. */
export function resolveVisualLabExecutionTuningPlanEntry(
  input,
  entryId,
  expectedCaptureEntryId,
  captureExecutionPlan,
) {
  assertSha256Id(entryId, 'Visual Lab execution tuning entry id');
  if (expectedCaptureEntryId !== undefined) {
    assertSha256Id(expectedCaptureEntryId, 'Expected Visual Lab capture entry id');
  }
  const plan = normalizeVisualLabExecutionTuningPlan(input, captureExecutionPlan);
  const entry = plan.entries.find(({ id }) => id === entryId);
  if (entry === undefined) throw new Error(`Unknown Visual Lab execution tuning entry id ${entryId}`);
  if (expectedCaptureEntryId !== undefined && entry.captureEntryId !== expectedCaptureEntryId) {
    throw new Error(`Visual Lab execution tuning entry ${entryId} does not bind capture entry ${expectedCaptureEntryId}`);
  }
  return entry;
}

/** Resolves one fully validated v2 tuning entry, optionally bound to capture entry ID. */
export function resolveVisualLabExecutionTuningPlanV2Entry(
  input,
  entryId,
  expectedCaptureEntryId,
  captureExecutionPlan,
) {
  assertSha256Id(entryId, 'Visual Lab execution tuning entry id');
  if (expectedCaptureEntryId !== undefined) {
    assertSha256Id(expectedCaptureEntryId, 'Expected Visual Lab capture entry id');
  }
  const plan = normalizeVisualLabExecutionTuningPlanV2(input, captureExecutionPlan);
  const entry = plan.entries.find(({ id }) => id === entryId);
  if (entry === undefined) throw new Error(`Unknown Visual Lab execution tuning entry id ${entryId}`);
  if (expectedCaptureEntryId !== undefined && entry.captureEntryId !== expectedCaptureEntryId) {
    throw new Error(`Visual Lab execution tuning entry ${entryId} does not bind capture entry ${expectedCaptureEntryId}`);
  }
  return entry;
}

/** Resolves one fully validated v3 tuning entry, optionally bound to capture entry ID. */
export function resolveVisualLabExecutionTuningPlanV3Entry(
  input,
  entryId,
  expectedCaptureEntryId,
  captureExecutionPlan,
) {
  assertSha256Id(entryId, 'Visual Lab execution tuning entry id');
  if (expectedCaptureEntryId !== undefined) {
    assertSha256Id(expectedCaptureEntryId, 'Expected Visual Lab capture entry id');
  }
  const plan = normalizeVisualLabExecutionTuningPlanV3(input, captureExecutionPlan);
  const entry = plan.entries.find(({ id }) => id === entryId);
  if (entry === undefined) throw new Error(`Unknown Visual Lab execution tuning entry id ${entryId}`);
  if (expectedCaptureEntryId !== undefined && entry.captureEntryId !== expectedCaptureEntryId) {
    throw new Error(`Visual Lab execution tuning entry ${entryId} does not bind capture entry ${expectedCaptureEntryId}`);
  }
  return entry;
}

/** Resolves one fully validated v4 tuning entry, optionally bound to capture entry ID. */
export function resolveVisualLabExecutionTuningPlanV4Entry(
  input,
  entryId,
  expectedCaptureEntryId,
  captureExecutionPlan,
) {
  assertSha256Id(entryId, 'Visual Lab execution tuning entry id');
  if (expectedCaptureEntryId !== undefined) {
    assertSha256Id(expectedCaptureEntryId, 'Expected Visual Lab capture entry id');
  }
  const plan = normalizeVisualLabExecutionTuningPlanV4(input, captureExecutionPlan);
  const entry = plan.entries.find(({ id }) => id === entryId);
  if (entry === undefined) throw new Error(`Unknown Visual Lab execution tuning entry id ${entryId}`);
  if (expectedCaptureEntryId !== undefined && entry.captureEntryId !== expectedCaptureEntryId) {
    throw new Error(`Visual Lab execution tuning entry ${entryId} does not bind capture entry ${expectedCaptureEntryId}`);
  }
  return entry;
}

/** Resolves one fully validated v5 tuning entry, optionally bound to capture entry ID. */
export function resolveVisualLabExecutionTuningPlanV5Entry(
  input,
  entryId,
  expectedCaptureEntryId,
  captureExecutionPlan,
) {
  assertSha256Id(entryId, 'Visual Lab execution tuning entry id');
  if (expectedCaptureEntryId !== undefined) {
    assertSha256Id(expectedCaptureEntryId, 'Expected Visual Lab capture entry id');
  }
  const plan = normalizeVisualLabExecutionTuningPlanV5(input, captureExecutionPlan);
  const entry = plan.entries.find(({ id }) => id === entryId);
  if (entry === undefined) throw new Error(`Unknown Visual Lab execution tuning entry id ${entryId}`);
  if (expectedCaptureEntryId !== undefined && entry.captureEntryId !== expectedCaptureEntryId) {
    throw new Error(`Visual Lab execution tuning entry ${entryId} does not bind capture entry ${expectedCaptureEntryId}`);
  }
  return entry;
}

/** Resolves one fully validated v6 tuning entry, optionally bound to capture entry ID. */
export function resolveVisualLabExecutionTuningPlanV6Entry(
  input,
  entryId,
  expectedCaptureEntryId,
  captureExecutionPlan,
) {
  assertSha256Id(entryId, 'Visual Lab execution tuning entry id');
  if (expectedCaptureEntryId !== undefined) {
    assertSha256Id(expectedCaptureEntryId, 'Expected Visual Lab capture entry id');
  }
  const plan = normalizeVisualLabExecutionTuningPlanV6(input, captureExecutionPlan);
  const entry = plan.entries.find(({ id }) => id === entryId);
  if (entry === undefined) throw new Error(`Unknown Visual Lab execution tuning entry id ${entryId}`);
  if (expectedCaptureEntryId !== undefined && entry.captureEntryId !== expectedCaptureEntryId) {
    throw new Error(`Visual Lab execution tuning entry ${entryId} does not bind capture entry ${expectedCaptureEntryId}`);
  }
  return entry;
}

/** Resolves one fully validated v7 tuning entry, optionally bound to capture entry ID. */
export function resolveVisualLabExecutionTuningPlanV7Entry(
  input,
  entryId,
  expectedCaptureEntryId,
  captureExecutionPlan,
) {
  assertSha256Id(entryId, 'Visual Lab execution tuning entry id');
  if (expectedCaptureEntryId !== undefined) {
    assertSha256Id(expectedCaptureEntryId, 'Expected Visual Lab capture entry id');
  }
  const plan = normalizeVisualLabExecutionTuningPlanV7(input, captureExecutionPlan);
  const entry = plan.entries.find(({ id }) => id === entryId);
  if (entry === undefined) throw new Error(`Unknown Visual Lab execution tuning entry id ${entryId}`);
  if (expectedCaptureEntryId !== undefined && entry.captureEntryId !== expectedCaptureEntryId) {
    throw new Error(`Visual Lab execution tuning entry ${entryId} does not bind capture entry ${expectedCaptureEntryId}`);
  }
  return entry;
}
