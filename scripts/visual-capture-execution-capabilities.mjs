import { VISUAL_CAPTURE_STATIC_CONTRACT } from '../src/shared/visual-capture-static-contract.js';
import { VISUAL_CAPTURE_DRIVER_NAMES } from './visual-capture-drivers.mjs';

const SAFE_NAME = /^[a-z][a-z0-9-]*$/;
const STARTUP_FIELDS = Object.freeze(['variant', 'fieldRefresh', 'rafs']);
const READINESS_FIELDS = Object.freeze([
  'planes',
  'pollIntervalMs',
  'timeoutMsByGpu',
]);
const SELECTION_FIELDS = Object.freeze(['rafs', 'exactDataset']);
const STABILITY_FIELDS = Object.freeze([
  'planes',
  'consecutiveSnapshots',
  'pollIntervalMs',
  'timeoutMsByGpu',
]);
const GPU_TIMEOUT_FIELDS = Object.freeze(['auto', 'swiftshader']);
const SCREENSHOT_FIELDS = Object.freeze(['after']);
const PROFILE_FIELDS = Object.freeze(['startup', 'readiness', 'selection', 'stability', 'screenshot']);
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
const READINESS_ACTIVATION_FIELDS = Object.freeze([
  'capability', 'requiredState', 'bind', 'snapshotAfterCompletion',
]);
const V6_READINESS_ACTIVATION_FIELDS = Object.freeze([
  'capability', 'requiredState', 'bind', 'completionScope', 'snapshotAfterCompletion',
]);
const V7_READINESS_ACTIVATION_FIELDS = V6_READINESS_ACTIVATION_FIELDS;
const COMPLETION_FIELDS = Object.freeze([
  'capability', 'receiptSchema', 'requiredState', 'bind', 'verifyAfterSnapshot',
]);
const EVIDENCE_PLANES = Object.freeze([
  'semantic',
  'field-alpha',
  'framebuffer-alpha',
]);

const displayValue = (value) => JSON.stringify(value) ?? String(value);

const assertExactDataKeys = (value, fields, label) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${label} must be a plain object`);
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== fields.length || keys.some((key, index) => key !== fields[index])) {
    throw new TypeError(`${label} fields must be exactly ${fields.join(', ')}`);
  }
  for (const field of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      throw new TypeError(`${label}.${field} must be an enumerable data value`);
    }
  }
};

const assertJsonValue = (value, label, seen = new Set()) => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${label} must be JSON-safe`);
    return;
  }
  if (typeof value !== 'object') throw new TypeError(`${label} must be JSON-safe`);
  if (seen.has(value)) throw new TypeError(`${label} must not contain a cycle`);
  seen.add(value);

  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype
      || Reflect.ownKeys(value).length !== value.length + 1) {
      throw new TypeError(`${label} must be a JSON-safe array`);
    }
    for (let index = 0; index < value.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
        throw new TypeError(`${label}[${index}] must be an enumerable data value`);
      }
      assertJsonValue(descriptor.value, `${label}[${index}]`, seen);
    }
  } else {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new TypeError(`${label} must be a JSON-safe plain object`);
    }
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') throw new TypeError(`${label} must be JSON-safe`);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
        throw new TypeError(`${label}.${key} must be an enumerable data value`);
      }
      assertJsonValue(descriptor.value, `${label}.${key}`, seen);
    }
  }
  seen.delete(value);
};

const assertIntegerInRange = (value, minimum, maximum, label) => {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer from ${minimum} to ${maximum}`);
  }
};

const assertExactArray = (value, expected, label) => {
  if (!Array.isArray(value) || value.length !== expected.length
    || value.some((entry, index) => entry !== expected[index])) {
    throw new TypeError(`${label} must be exactly ${expected.join(', ')}`);
  }
};

const normalizeProfile = (profile, driverName, version) => {
  const label = `Visual capture execution capability ${driverName}`;
  const hasReadinessCompletion = version === 'v3';
  const hasReadinessActivation = version === 'v5' || version === 'v6' || version === 'v7';
  const hasCompletion = version === 'v2' || version === 'v3'
    || version === 'v4' || version === 'v5' || version === 'v6' || version === 'v7';
  assertJsonValue(profile, label);
  assertExactDataKeys(
    profile,
    version === 'v7' ? V7_PROFILE_FIELDS
      : version === 'v6' ? V6_PROFILE_FIELDS
      : version === 'v5' ? V5_PROFILE_FIELDS
      : version === 'v4' ? V4_PROFILE_FIELDS
      : version === 'v3' ? V3_PROFILE_FIELDS
        : version === 'v2' ? V2_PROFILE_FIELDS : PROFILE_FIELDS,
    label,
  );

  const {
    startup, readiness, readinessCompletion, readinessActivation,
    selection, stability, completion, screenshot,
  } = profile;
  assertExactDataKeys(startup, STARTUP_FIELDS, `${label}.startup`);
  if (startup.variant !== 'b' || startup.fieldRefresh !== 'explicit') {
    throw new TypeError(`${label}.startup is not supported`);
  }
  assertIntegerInRange(startup.rafs, 1, 120, `${label}.startup.rafs`);

  assertExactDataKeys(readiness, READINESS_FIELDS, `${label}.readiness`);
  assertExactArray(readiness.planes, EVIDENCE_PLANES, `${label}.readiness.planes`);
  assertIntegerInRange(readiness.pollIntervalMs, 1, 1_000, `${label}.readiness.pollIntervalMs`);
  assertExactDataKeys(readiness.timeoutMsByGpu, GPU_TIMEOUT_FIELDS,
    `${label}.readiness.timeoutMsByGpu`);
  assertIntegerInRange(readiness.timeoutMsByGpu.auto, 1_000, 300_000,
    `${label}.readiness.timeoutMsByGpu.auto`);
  assertIntegerInRange(readiness.timeoutMsByGpu.swiftshader, 1_000, 300_000,
    `${label}.readiness.timeoutMsByGpu.swiftshader`);

  assertExactDataKeys(selection, SELECTION_FIELDS, `${label}.selection`);
  assertIntegerInRange(selection.rafs, 1, 120, `${label}.selection.rafs`);
  if (selection.exactDataset !== true) {
    throw new TypeError(`${label}.selection.exactDataset must be true`);
  }

  assertExactDataKeys(stability, STABILITY_FIELDS, `${label}.stability`);
  assertExactArray(stability.planes, EVIDENCE_PLANES, `${label}.stability.planes`);
  assertExactDataKeys(stability.timeoutMsByGpu, GPU_TIMEOUT_FIELDS,
    `${label}.stability.timeoutMsByGpu`);
  assertIntegerInRange(stability.timeoutMsByGpu.auto, 1_000, 300_000,
    `${label}.stability.timeoutMsByGpu.auto`);
  assertIntegerInRange(stability.timeoutMsByGpu.swiftshader, 1_000, 300_000,
    `${label}.stability.timeoutMsByGpu.swiftshader`);
  if (stability.timeoutMsByGpu.swiftshader < stability.timeoutMsByGpu.auto) {
    throw new TypeError(`${label}.stability.timeoutMsByGpu.swiftshader must not be shorter than auto`);
  }
  assertIntegerInRange(stability.pollIntervalMs, 1, 1_000, `${label}.stability.pollIntervalMs`);
  if (hasCompletion) {
    assertExactDataKeys(completion, COMPLETION_FIELDS, `${label}.completion`);
    const completionBind = version === 'v4' || version === 'v5'
      || version === 'v6' || version === 'v7'
      ? 'selection-owned-presentation'
      : 'selected-presentation';
    if (completion.capability !== 'renderer-completed-frame-receipt/v1'
      || completion.receiptSchema !== 'anifor.renderer.completed-frame-receipt/v1'
      || completion.requiredState !== 'completed'
      || completion.bind !== completionBind
      || completion.verifyAfterSnapshot !== true) {
      throw new TypeError(`${label}.completion is not supported`);
    }
    if (stability.consecutiveSnapshots !== 1) {
      throw new TypeError(`${label}.stability.consecutiveSnapshots must be 1 with the receipt completion capability`);
    }
  } else {
    assertIntegerInRange(
      stability.consecutiveSnapshots, 2, 120, `${label}.stability.consecutiveSnapshots`,
    );
  }
  assertExactDataKeys(screenshot, SCREENSHOT_FIELDS, `${label}.screenshot`);
  if (screenshot.after !== 'stability-proof') {
    throw new TypeError(`${label}.screenshot.after must wait for stability proof`);
  }

  const normalized = {
    startup: {
      variant: startup.variant,
      fieldRefresh: startup.fieldRefresh,
      rafs: startup.rafs,
    },
    readiness: {
      planes: [...readiness.planes],
      pollIntervalMs: readiness.pollIntervalMs,
      timeoutMsByGpu: {
        auto: readiness.timeoutMsByGpu.auto,
        swiftshader: readiness.timeoutMsByGpu.swiftshader,
      },
    },
    selection: {
      rafs: selection.rafs,
      exactDataset: selection.exactDataset,
    },
    stability: {
      planes: [...stability.planes],
      consecutiveSnapshots: stability.consecutiveSnapshots,
      pollIntervalMs: stability.pollIntervalMs,
      timeoutMsByGpu: {
        auto: stability.timeoutMsByGpu.auto,
        swiftshader: stability.timeoutMsByGpu.swiftshader,
      },
    },
  };
  if (hasReadinessCompletion) {
    assertExactDataKeys(readinessCompletion, COMPLETION_FIELDS, `${label}.readinessCompletion`);
    if (readinessCompletion.capability !== 'renderer-completed-frame-receipt/v1'
      || readinessCompletion.receiptSchema !== 'anifor.renderer.completed-frame-receipt/v1'
      || readinessCompletion.requiredState !== 'completed'
      || readinessCompletion.bind !== 'refreshed-presentation'
      || readinessCompletion.verifyAfterSnapshot !== true) {
      throw new TypeError(`${label}.readinessCompletion is not supported`);
    }
    normalized.readinessCompletion = {
      capability: readinessCompletion.capability,
      receiptSchema: readinessCompletion.receiptSchema,
      requiredState: readinessCompletion.requiredState,
      bind: readinessCompletion.bind,
      verifyAfterSnapshot: readinessCompletion.verifyAfterSnapshot,
    };
  }
  if (hasReadinessActivation) {
    assertExactDataKeys(
      readinessActivation,
      version === 'v7' ? V7_READINESS_ACTIVATION_FIELDS
        : version === 'v6' ? V6_READINESS_ACTIVATION_FIELDS : READINESS_ACTIVATION_FIELDS,
      `${label}.readinessActivation`,
    );
    const expectedCapability = version === 'v7'
      ? 'renderer-fixture-activation-generation/v3'
      : version === 'v6' ? 'renderer-fixture-activation-generation/v2'
      : 'renderer-fixture-activation-generation/v1';
    const expectedCompletionScope = version === 'v7'
      ? 'activation-owned-render-fields' : 'activation-owned-work';
    if (readinessActivation.capability !== expectedCapability
      || readinessActivation.requiredState !== 'completed'
      || readinessActivation.bind !== 'typed-fixture-activation'
      || ((version === 'v6' || version === 'v7')
        && readinessActivation.completionScope !== expectedCompletionScope)
      || readinessActivation.snapshotAfterCompletion !== true) {
      throw new TypeError(`${label}.readinessActivation is not supported`);
    }
    normalized.readinessActivation = {
      capability: readinessActivation.capability,
      requiredState: readinessActivation.requiredState,
      bind: readinessActivation.bind,
      ...(version === 'v6' || version === 'v7'
        ? { completionScope: readinessActivation.completionScope } : {}),
      snapshotAfterCompletion: readinessActivation.snapshotAfterCompletion,
    };
  }
  if (hasCompletion) {
    normalized.completion = {
      capability: completion.capability,
      receiptSchema: completion.receiptSchema,
      requiredState: completion.requiredState,
      bind: completion.bind,
      verifyAfterSnapshot: completion.verifyAfterSnapshot,
    };
  }
  normalized.screenshot = { after: screenshot.after };
  return normalized;
};

const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

/**
 * Creates the closed data-only execution-capability registry. It deliberately
 * accepts no executable hooks: browser dispatch remains in the typed drivers.
 */
const createCapabilityRegistry = (drivers, profiles, version) => {
  if (!Array.isArray(drivers) || drivers.length === 0) {
    throw new TypeError('Visual capture execution drivers must be a nonempty array');
  }
  if (profiles === null || typeof profiles !== 'object' || Array.isArray(profiles)
    || Object.getPrototypeOf(profiles) !== Object.prototype) {
    throw new TypeError('Visual capture execution capabilities must be a plain object');
  }

  const names = [];
  const seen = new Set();
  for (const driver of drivers) {
    const name = driver?.name;
    if (typeof name !== 'string' || !SAFE_NAME.test(name) || seen.has(name)) {
      throw new TypeError(`Invalid or duplicate visual capture execution driver ${displayValue(name)}`);
    }
    seen.add(name);
    names.push(name);
  }

  const profileNames = Reflect.ownKeys(profiles);
  const unsafe = profileNames.find((name) => typeof name !== 'string' || !SAFE_NAME.test(name));
  if (unsafe !== undefined) {
    throw new TypeError(`Unsafe visual capture execution capability name ${String(unsafe)}`);
  }
  const missing = names.filter((name) => !profileNames.includes(name));
  const extra = profileNames.filter((name) => !seen.has(name));
  const reordered = missing.length === 0 && extra.length === 0
    && profileNames.some((name, index) => name !== names[index]);
  if (missing.length > 0 || extra.length > 0 || reordered) {
    const details = [
      missing.length > 0 ? `missing ${missing.join(', ')}` : '',
      extra.length > 0 ? `undeclared ${extra.join(', ')}` : '',
      reordered ? 'capability order differs from declared driver order' : '',
    ].filter(Boolean).join('; ');
    throw new TypeError(`Visual capture execution registry is not exhaustive (${details})`);
  }

  const capabilities = {};
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(profiles, name);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      throw new TypeError(`Visual capture execution capability ${name} must be an enumerable data value`);
    }
    capabilities[name] = normalizeProfile(descriptor.value, name, version);
  }

  const frozenNames = Object.freeze([...names]);
  const frozenCapabilities = deepFreeze(capabilities);
  const resolve = (name) => {
    if (typeof name !== 'string' || !Object.hasOwn(frozenCapabilities, name)) {
      throw new Error(`Unknown visual capture execution capability ${displayValue(name)}`);
    }
    return frozenCapabilities[name];
  };
  return Object.freeze({ names: frozenNames, capabilities: frozenCapabilities, resolve });
};

/** Creates the closed v1 data-only execution-capability registry. */
export function createVisualCaptureExecutionCapabilityRegistry(drivers, profiles) {
  return createCapabilityRegistry(drivers, profiles, 'v1');
}

/** Creates the closed v2 completed-frame-receipt capability registry. */
export function createVisualCaptureExecutionV2CapabilityRegistry(drivers, profiles) {
  return createCapabilityRegistry(drivers, profiles, 'v2');
}

/** Creates the closed v3 readiness-and-capture receipt capability registry. */
export function createVisualCaptureExecutionV3CapabilityRegistry(drivers, profiles) {
  return createCapabilityRegistry(drivers, profiles, 'v3');
}

/** Creates the closed v4 stable-readiness and selection-owned capture receipt registry. */
export function createVisualCaptureExecutionV4CapabilityRegistry(drivers, profiles) {
  return createCapabilityRegistry(drivers, profiles, 'v4');
}

/** Creates the closed v5 typed fixture-activation generation capability registry. */
export function createVisualCaptureExecutionV5CapabilityRegistry(drivers, profiles) {
  return createCapabilityRegistry(drivers, profiles, 'v5');
}

/** Creates the closed v6 activation-owned work generation capability registry. */
export function createVisualCaptureExecutionV6CapabilityRegistry(drivers, profiles) {
  return createCapabilityRegistry(drivers, profiles, 'v6');
}

/** Creates the closed v7 activation-owned render-field generation capability registry. */
export function createVisualCaptureExecutionV7CapabilityRegistry(drivers, profiles) {
  return createCapabilityRegistry(drivers, profiles, 'v7');
}

/** Returns a frozen map only for an exact, duplicate-free capture-order subset. */
const capabilitiesForCaptureOrder = (driverNames, registry) => {
  if (!Array.isArray(driverNames) || driverNames.length === 0) {
    throw new TypeError('Visual capture execution capture order must be a nonempty array');
  }
  const subset = {};
  const seen = new Set();
  for (const name of driverNames) {
    if (seen.has(name)) {
      throw new TypeError(`Visual capture execution capture order repeats ${displayValue(name)}`);
    }
    seen.add(name);
    subset[name] = registry.resolve(name);
  }
  return Object.freeze(subset);
};

/** Returns the frozen v1 capture-order subset. */
export function visualCaptureExecutionCapabilitiesForCaptureOrder(driverNames) {
  return capabilitiesForCaptureOrder(driverNames, REGISTRY);
}

/** Returns the frozen v2 completed-frame-receipt capture-order subset. */
export function visualCaptureExecutionV2CapabilitiesForCaptureOrder(driverNames) {
  return capabilitiesForCaptureOrder(driverNames, V2_REGISTRY);
}

/** Returns the frozen v3 readiness-and-capture receipt capture-order subset. */
export function visualCaptureExecutionV3CapabilitiesForCaptureOrder(driverNames) {
  return capabilitiesForCaptureOrder(driverNames, V3_REGISTRY);
}

/** Returns the frozen v4 stable-readiness and selection-owned receipt capture-order subset. */
export function visualCaptureExecutionV4CapabilitiesForCaptureOrder(driverNames) {
  return capabilitiesForCaptureOrder(driverNames, V4_REGISTRY);
}

/** Returns the frozen v5 fixture-activation generation capture-order subset. */
export function visualCaptureExecutionV5CapabilitiesForCaptureOrder(driverNames) {
  return capabilitiesForCaptureOrder(driverNames, V5_REGISTRY);
}

/** Returns the frozen v6 activation-owned work generation capture-order subset. */
export function visualCaptureExecutionV6CapabilitiesForCaptureOrder(driverNames) {
  return capabilitiesForCaptureOrder(driverNames, V6_REGISTRY);
}

/** Returns the frozen v7 activation-owned render-field generation capture-order subset. */
export function visualCaptureExecutionV7CapabilitiesForCaptureOrder(driverNames) {
  return capabilitiesForCaptureOrder(driverNames, V7_REGISTRY);
}

const CONSERVATIVE_PROFILE = () => ({
  startup: {
    variant: 'b',
    fieldRefresh: 'explicit',
    rafs: 2,
  },
  readiness: {
    planes: [...EVIDENCE_PLANES],
    pollIntervalMs: 50,
    timeoutMsByGpu: { auto: 60_000, swiftshader: 60_000 },
  },
  selection: {
    rafs: 2,
    exactDataset: true,
  },
  stability: {
    planes: [...EVIDENCE_PLANES],
    consecutiveSnapshots: 2,
    pollIntervalMs: 50,
    // Stable snapshots retain two complete semantic/field/framebuffer reads.
    // Hosted SwiftShader can spend more than 30 seconds in one full readback
    // on the mixed material atlas even though the renderer remains healthy.
    timeoutMsByGpu: { auto: 10_000, swiftshader: 60_000 },
  },
  screenshot: { after: 'stability-proof' },
});

const COMPLETED_FRAME_RECEIPT_PROFILE = () => ({
  startup: {
    variant: 'b',
    fieldRefresh: 'explicit',
    rafs: 2,
  },
  readiness: {
    planes: [...EVIDENCE_PLANES],
    pollIntervalMs: 50,
    timeoutMsByGpu: { auto: 60_000, swiftshader: 60_000 },
  },
  selection: {
    rafs: 2,
    exactDataset: true,
  },
  stability: {
    planes: [...EVIDENCE_PLANES],
    consecutiveSnapshots: 1,
    pollIntervalMs: 50,
    timeoutMsByGpu: { auto: 10_000, swiftshader: 30_000 },
  },
  completion: {
    capability: 'renderer-completed-frame-receipt/v1',
    receiptSchema: 'anifor.renderer.completed-frame-receipt/v1',
    requiredState: 'completed',
    bind: 'selected-presentation',
    verifyAfterSnapshot: true,
  },
  screenshot: { after: 'stability-proof' },
});

const READINESS_COMPLETED_FRAME_RECEIPT_PROFILE = () => {
  const profile = COMPLETED_FRAME_RECEIPT_PROFILE();
  return {
    startup: profile.startup,
    readiness: profile.readiness,
    readinessCompletion: {
      capability: 'renderer-completed-frame-receipt/v1',
      receiptSchema: 'anifor.renderer.completed-frame-receipt/v1',
      requiredState: 'completed',
      bind: 'refreshed-presentation',
      verifyAfterSnapshot: true,
    },
    selection: profile.selection,
    stability: profile.stability,
    completion: profile.completion,
    screenshot: profile.screenshot,
  };
};

const SELECTION_OWNED_COMPLETED_FRAME_RECEIPT_PROFILE = () => {
  const profile = COMPLETED_FRAME_RECEIPT_PROFILE();
  return {
    startup: profile.startup,
    readiness: profile.readiness,
    selection: profile.selection,
    stability: profile.stability,
    completion: {
      ...profile.completion,
      bind: 'selection-owned-presentation',
    },
    screenshot: profile.screenshot,
  };
};

const FIXTURE_ACTIVATION_GENERATION_PROFILE = () => {
  const profile = SELECTION_OWNED_COMPLETED_FRAME_RECEIPT_PROFILE();
  return {
    startup: profile.startup,
    readiness: {
      ...profile.readiness,
      // A loaded software GPU may need several serialized presentations to
      // drain the activation-owned field/boundary queues. This is a scheduling
      // bound, not permission to weaken the one-snapshot evidence contract.
      timeoutMsByGpu: { ...profile.readiness.timeoutMsByGpu, swiftshader: 120_000 },
    },
    readinessActivation: {
      capability: 'renderer-fixture-activation-generation/v1',
      requiredState: 'completed',
      bind: 'typed-fixture-activation',
      snapshotAfterCompletion: true,
    },
    selection: profile.selection,
    stability: profile.stability,
    completion: profile.completion,
    screenshot: profile.screenshot,
  };
};

const FIXTURE_ACTIVATION_WORK_GENERATION_PROFILE = () => {
  const profile = FIXTURE_ACTIVATION_GENERATION_PROFILE();
  return {
    ...profile,
    readinessActivation: {
      capability: 'renderer-fixture-activation-generation/v2',
      requiredState: 'completed',
      bind: 'typed-fixture-activation',
      completionScope: 'activation-owned-work',
      snapshotAfterCompletion: true,
    },
  };
};

const FIXTURE_ACTIVATION_RENDER_FIELD_GENERATION_PROFILE = () => {
  const profile = FIXTURE_ACTIVATION_WORK_GENERATION_PROFILE();
  return {
    ...profile,
    readinessActivation: {
      capability: 'renderer-fixture-activation-generation/v3',
      requiredState: 'completed',
      bind: 'typed-fixture-activation',
      completionScope: 'activation-owned-render-fields',
      snapshotAfterCompletion: true,
    },
  };
};

const DECLARED_DRIVER_NAMES = VISUAL_CAPTURE_STATIC_CONTRACT.drivers.map(({ name }) => name);
if (DECLARED_DRIVER_NAMES.length !== VISUAL_CAPTURE_DRIVER_NAMES.length
  || DECLARED_DRIVER_NAMES.some((name, index) => name !== VISUAL_CAPTURE_DRIVER_NAMES[index])) {
  throw new TypeError('Visual capture driver names do not match the static contract');
}

const PROFILE_REGISTRY = Object.fromEntries(
  DECLARED_DRIVER_NAMES.map((name) => [name, CONSERVATIVE_PROFILE()]),
);
const V2_PROFILE_REGISTRY = Object.fromEntries(
  DECLARED_DRIVER_NAMES.map((name) => [name, COMPLETED_FRAME_RECEIPT_PROFILE()]),
);
const V3_PROFILE_REGISTRY = Object.fromEntries(
  DECLARED_DRIVER_NAMES.map((name) => [name, READINESS_COMPLETED_FRAME_RECEIPT_PROFILE()]),
);
const V4_PROFILE_REGISTRY = Object.fromEntries(
  DECLARED_DRIVER_NAMES.map((name) => [name, SELECTION_OWNED_COMPLETED_FRAME_RECEIPT_PROFILE()]),
);
const V5_PROFILE_REGISTRY = Object.fromEntries(
  DECLARED_DRIVER_NAMES.map((name) => [name, FIXTURE_ACTIVATION_GENERATION_PROFILE()]),
);
const V6_PROFILE_REGISTRY = Object.fromEntries(
  DECLARED_DRIVER_NAMES.map((name) => [name, FIXTURE_ACTIVATION_WORK_GENERATION_PROFILE()]),
);
const V7_PROFILE_REGISTRY = Object.fromEntries(
  DECLARED_DRIVER_NAMES.map((name) => [name, FIXTURE_ACTIVATION_RENDER_FIELD_GENERATION_PROFILE()]),
);
const REGISTRY = createVisualCaptureExecutionCapabilityRegistry(
  VISUAL_CAPTURE_STATIC_CONTRACT.drivers,
  PROFILE_REGISTRY,
);
const V2_REGISTRY = createVisualCaptureExecutionV2CapabilityRegistry(
  VISUAL_CAPTURE_STATIC_CONTRACT.drivers,
  V2_PROFILE_REGISTRY,
);
const V3_REGISTRY = createVisualCaptureExecutionV3CapabilityRegistry(
  VISUAL_CAPTURE_STATIC_CONTRACT.drivers,
  V3_PROFILE_REGISTRY,
);
const V4_REGISTRY = createVisualCaptureExecutionV4CapabilityRegistry(
  VISUAL_CAPTURE_STATIC_CONTRACT.drivers,
  V4_PROFILE_REGISTRY,
);
const V5_REGISTRY = createVisualCaptureExecutionV5CapabilityRegistry(
  VISUAL_CAPTURE_STATIC_CONTRACT.drivers,
  V5_PROFILE_REGISTRY,
);
const V6_REGISTRY = createVisualCaptureExecutionV6CapabilityRegistry(
  VISUAL_CAPTURE_STATIC_CONTRACT.drivers,
  V6_PROFILE_REGISTRY,
);
const V7_REGISTRY = createVisualCaptureExecutionV7CapabilityRegistry(
  VISUAL_CAPTURE_STATIC_CONTRACT.drivers,
  V7_PROFILE_REGISTRY,
);

export const VISUAL_CAPTURE_EXECUTION_CAPABILITY_NAMES = REGISTRY.names;
export const VISUAL_CAPTURE_EXECUTION_CAPABILITIES = REGISTRY.capabilities;
export const VISUAL_CAPTURE_EXECUTION_V2_CAPABILITY_NAMES = V2_REGISTRY.names;
export const VISUAL_CAPTURE_EXECUTION_V2_CAPABILITIES = V2_REGISTRY.capabilities;
export const VISUAL_CAPTURE_EXECUTION_V3_CAPABILITY_NAMES = V3_REGISTRY.names;
export const VISUAL_CAPTURE_EXECUTION_V3_CAPABILITIES = V3_REGISTRY.capabilities;
export const VISUAL_CAPTURE_EXECUTION_V4_CAPABILITY_NAMES = V4_REGISTRY.names;
export const VISUAL_CAPTURE_EXECUTION_V4_CAPABILITIES = V4_REGISTRY.capabilities;
export const VISUAL_CAPTURE_EXECUTION_V5_CAPABILITY_NAMES = V5_REGISTRY.names;
export const VISUAL_CAPTURE_EXECUTION_V5_CAPABILITIES = V5_REGISTRY.capabilities;
export const VISUAL_CAPTURE_EXECUTION_V6_CAPABILITY_NAMES = V6_REGISTRY.names;
export const VISUAL_CAPTURE_EXECUTION_V6_CAPABILITIES = V6_REGISTRY.capabilities;
export const VISUAL_CAPTURE_EXECUTION_V7_CAPABILITY_NAMES = V7_REGISTRY.names;
export const VISUAL_CAPTURE_EXECUTION_V7_CAPABILITIES = V7_REGISTRY.capabilities;

export function resolveVisualCaptureExecutionCapabilities(name) {
  return REGISTRY.resolve(name);
}

export function resolveVisualCaptureExecutionV2Capabilities(name) {
  return V2_REGISTRY.resolve(name);
}

export function resolveVisualCaptureExecutionV3Capabilities(name) {
  return V3_REGISTRY.resolve(name);
}

export function resolveVisualCaptureExecutionV4Capabilities(name) {
  return V4_REGISTRY.resolve(name);
}

export function resolveVisualCaptureExecutionV5Capabilities(name) {
  return V5_REGISTRY.resolve(name);
}

export function resolveVisualCaptureExecutionV6Capabilities(name) {
  return V6_REGISTRY.resolve(name);
}

export function resolveVisualCaptureExecutionV7Capabilities(name) {
  return V7_REGISTRY.resolve(name);
}
