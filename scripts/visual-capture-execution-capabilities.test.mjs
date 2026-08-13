import { describe, expect, it } from 'vitest';
import {
  createVisualCaptureExecutionCapabilityRegistry,
  createVisualCaptureExecutionV2CapabilityRegistry,
  createVisualCaptureExecutionV4CapabilityRegistry,
  createVisualCaptureExecutionV5CapabilityRegistry,
  createVisualCaptureExecutionV6CapabilityRegistry,
  createVisualCaptureExecutionV7CapabilityRegistry,
  createVisualCaptureExecutionV8CapabilityRegistry,
  resolveVisualCaptureExecutionV3Capabilities,
  resolveVisualCaptureExecutionV4Capabilities,
  resolveVisualCaptureExecutionV5Capabilities,
  resolveVisualCaptureExecutionV6Capabilities,
  resolveVisualCaptureExecutionV7Capabilities,
  resolveVisualCaptureExecutionV8Capabilities,
  resolveVisualCaptureExecutionCapabilities,
  resolveVisualCaptureExecutionV2Capabilities,
  VISUAL_CAPTURE_EXECUTION_CAPABILITIES,
  VISUAL_CAPTURE_EXECUTION_CAPABILITY_NAMES,
  VISUAL_CAPTURE_EXECUTION_V2_CAPABILITIES,
  VISUAL_CAPTURE_EXECUTION_V2_CAPABILITY_NAMES,
  VISUAL_CAPTURE_EXECUTION_V3_CAPABILITIES,
  VISUAL_CAPTURE_EXECUTION_V3_CAPABILITY_NAMES,
  VISUAL_CAPTURE_EXECUTION_V4_CAPABILITIES,
  VISUAL_CAPTURE_EXECUTION_V4_CAPABILITY_NAMES,
  VISUAL_CAPTURE_EXECUTION_V5_CAPABILITIES,
  VISUAL_CAPTURE_EXECUTION_V5_CAPABILITY_NAMES,
  VISUAL_CAPTURE_EXECUTION_V6_CAPABILITIES,
  VISUAL_CAPTURE_EXECUTION_V6_CAPABILITY_NAMES,
  VISUAL_CAPTURE_EXECUTION_V7_CAPABILITIES,
  VISUAL_CAPTURE_EXECUTION_V7_CAPABILITY_NAMES,
  VISUAL_CAPTURE_EXECUTION_V8_CAPABILITIES,
  VISUAL_CAPTURE_EXECUTION_V8_CAPABILITY_NAMES,
  visualCaptureExecutionCapabilitiesForCaptureOrder,
  visualCaptureExecutionV2CapabilitiesForCaptureOrder,
  visualCaptureExecutionV3CapabilitiesForCaptureOrder,
  visualCaptureExecutionV4CapabilitiesForCaptureOrder,
  visualCaptureExecutionV5CapabilitiesForCaptureOrder,
  visualCaptureExecutionV6CapabilitiesForCaptureOrder,
  visualCaptureExecutionV7CapabilitiesForCaptureOrder,
  visualCaptureExecutionV8CapabilitiesForCaptureOrder,
} from './visual-capture-execution-capabilities.mjs';
import { VISUAL_CAPTURE_DRIVER_NAMES } from './visual-capture-drivers.mjs';
import { VISUAL_CAPTURE_STATIC_CONTRACT } from '../src/shared/visual-capture-static-contract.js';

const capability = () => ({
  startup: {
    variant: 'b',
    fieldRefresh: 'explicit',
    rafs: 2,
  },
  readiness: {
    planes: ['semantic', 'field-alpha', 'framebuffer-alpha'],
    pollIntervalMs: 50,
    timeoutMsByGpu: { auto: 60_000, swiftshader: 60_000 },
  },
  selection: {
    rafs: 2,
    exactDataset: true,
  },
  stability: {
    planes: ['semantic', 'field-alpha', 'framebuffer-alpha'],
    consecutiveSnapshots: 2,
    pollIntervalMs: 50,
    timeoutMsByGpu: { auto: 10_000, swiftshader: 60_000 },
  },
  screenshot: { after: 'stability-proof' },
});

const v2Capability = () => ({
  startup: {
    variant: 'b',
    fieldRefresh: 'explicit',
    rafs: 2,
  },
  readiness: {
    planes: ['semantic', 'field-alpha', 'framebuffer-alpha'],
    pollIntervalMs: 50,
    timeoutMsByGpu: { auto: 60_000, swiftshader: 60_000 },
  },
  selection: {
    rafs: 2,
    exactDataset: true,
  },
  stability: {
    planes: ['semantic', 'field-alpha', 'framebuffer-alpha'],
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

const clone = (value) => JSON.parse(JSON.stringify(value));

const v4Capability = () => {
  const profile = v2Capability();
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
const v5Capability = () => {
  const profile = v4Capability();
  return {
    startup: profile.startup,
    readiness: {
      ...profile.readiness,
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

const syntheticDrivers = Object.freeze([Object.freeze({ name: 'first' }), Object.freeze({ name: 'second' })]);
const syntheticProfiles = () => ({ first: capability(), second: capability() });
const syntheticV2Profiles = () => ({ first: v2Capability(), second: v2Capability() });
const syntheticV4Profiles = () => ({ first: v4Capability(), second: v4Capability() });
const syntheticV5Profiles = () => ({ first: v5Capability(), second: v5Capability() });
const v6Capability = () => ({
  ...v5Capability(),
  readinessActivation: {
    capability: 'renderer-fixture-activation-generation/v2',
    requiredState: 'completed',
    bind: 'typed-fixture-activation',
    completionScope: 'activation-owned-work',
    snapshotAfterCompletion: true,
  },
});
const syntheticV6Profiles = () => ({ first: v6Capability(), second: v6Capability() });
const v7Capability = () => ({
  ...v6Capability(),
  readinessActivation: {
    ...v6Capability().readinessActivation,
    capability: 'renderer-fixture-activation-generation/v3',
    completionScope: 'activation-owned-render-fields',
  },
});
const syntheticV7Profiles = () => ({ first: v7Capability(), second: v7Capability() });
const v8Capability = () => {
  const profile = v4Capability();
  return {
    startup: profile.startup,
    readiness: profile.readiness,
    selection: profile.selection,
    stability: profile.stability,
    completion: profile.completion,
    framebufferReadback: {
    capability: 'renderer-framebuffer-alpha-readback/v1',
    readbackSchema: 'anifor.renderer.framebuffer-alpha-readback/v1',
    bind: 'selection-owned-presentation',
    verifyAfterSnapshot: true,
  },
    screenshot: profile.screenshot,
  };
};
const syntheticV8Profiles = () => ({ first: v8Capability(), second: v8Capability() });

describe('visual capture execution capabilities', () => {
  it('is exhaustive and ordered exactly like the typed static capture drivers', () => {
    const staticNames = VISUAL_CAPTURE_STATIC_CONTRACT.drivers.map(({ name }) => name);
    expect(VISUAL_CAPTURE_EXECUTION_CAPABILITY_NAMES).toEqual(VISUAL_CAPTURE_DRIVER_NAMES);
    expect(VISUAL_CAPTURE_EXECUTION_CAPABILITY_NAMES).toEqual(staticNames);
    expect(Object.keys(VISUAL_CAPTURE_EXECUTION_CAPABILITIES))
      .toEqual(VISUAL_CAPTURE_EXECUTION_CAPABILITY_NAMES);
  });

  it('documents the existing conservative readiness and convergence behavior exactly', () => {
    for (const name of VISUAL_CAPTURE_EXECUTION_CAPABILITY_NAMES) {
      expect(VISUAL_CAPTURE_EXECUTION_CAPABILITIES[name]).toEqual(capability());
    }
  });

  it('keeps completed-frame receipts opt-in through a distinct v2 registry', () => {
    expect(VISUAL_CAPTURE_EXECUTION_V2_CAPABILITY_NAMES)
      .toEqual(VISUAL_CAPTURE_EXECUTION_CAPABILITY_NAMES);
    for (const name of VISUAL_CAPTURE_EXECUTION_V2_CAPABILITY_NAMES) {
      expect(VISUAL_CAPTURE_EXECUTION_V2_CAPABILITIES[name]).toEqual(v2Capability());
    }
    expect(resolveVisualCaptureExecutionV2Capabilities('normal-hdr'))
      .toBe(VISUAL_CAPTURE_EXECUTION_V2_CAPABILITIES['normal-hdr']);
    expect(resolveVisualCaptureExecutionCapabilities('normal-hdr'))
      .toBe(VISUAL_CAPTURE_EXECUTION_CAPABILITIES['normal-hdr']);
  });

  it('adds readiness receipt admission only through the distinct v3 registry', () => {
    expect(VISUAL_CAPTURE_EXECUTION_V3_CAPABILITY_NAMES)
      .toEqual(VISUAL_CAPTURE_EXECUTION_CAPABILITY_NAMES);
    for (const name of VISUAL_CAPTURE_EXECUTION_V3_CAPABILITY_NAMES) {
      expect(VISUAL_CAPTURE_EXECUTION_V3_CAPABILITIES[name]).toEqual({
        ...v2Capability(),
        readinessCompletion: {
          capability: 'renderer-completed-frame-receipt/v1',
          receiptSchema: 'anifor.renderer.completed-frame-receipt/v1',
          requiredState: 'completed',
          bind: 'refreshed-presentation',
          verifyAfterSnapshot: true,
        },
      });
    }
    expect(resolveVisualCaptureExecutionV3Capabilities('powder-render-style'))
      .toBe(VISUAL_CAPTURE_EXECUTION_V3_CAPABILITIES['powder-render-style']);
    expect(visualCaptureExecutionV3CapabilitiesForCaptureOrder(['powder-render-style'])
      ['powder-render-style']).toBe(VISUAL_CAPTURE_EXECUTION_V3_CAPABILITIES['powder-render-style']);
  });

  it('binds capture completion to the selecting presentation only through v4', () => {
    expect(VISUAL_CAPTURE_EXECUTION_V4_CAPABILITY_NAMES)
      .toEqual(VISUAL_CAPTURE_EXECUTION_CAPABILITY_NAMES);
    for (const name of VISUAL_CAPTURE_EXECUTION_V4_CAPABILITY_NAMES) {
      expect(VISUAL_CAPTURE_EXECUTION_V4_CAPABILITIES[name]).toEqual(v4Capability());
      expect(VISUAL_CAPTURE_EXECUTION_V4_CAPABILITIES[name])
        .not.toHaveProperty('readinessCompletion');
      expect(VISUAL_CAPTURE_EXECUTION_V3_CAPABILITIES[name].completion.bind)
        .toBe('selected-presentation');
    }
    expect(resolveVisualCaptureExecutionV4Capabilities('normal-hdr'))
      .toBe(VISUAL_CAPTURE_EXECUTION_V4_CAPABILITIES['normal-hdr']);
    expect(visualCaptureExecutionV4CapabilitiesForCaptureOrder(['normal-hdr'])['normal-hdr'])
      .toBe(VISUAL_CAPTURE_EXECUTION_V4_CAPABILITIES['normal-hdr']);
  });

  it('adds typed fixture-activation readiness only through v5', () => {
    expect(VISUAL_CAPTURE_EXECUTION_V5_CAPABILITY_NAMES)
      .toEqual(VISUAL_CAPTURE_EXECUTION_CAPABILITY_NAMES);
    for (const name of VISUAL_CAPTURE_EXECUTION_V5_CAPABILITY_NAMES) {
      expect(VISUAL_CAPTURE_EXECUTION_V5_CAPABILITIES[name]).toEqual(v5Capability());
    }
    expect(resolveVisualCaptureExecutionV5Capabilities('normal-hdr'))
      .toBe(VISUAL_CAPTURE_EXECUTION_V5_CAPABILITIES['normal-hdr']);
    expect(visualCaptureExecutionV5CapabilitiesForCaptureOrder(['normal-hdr'])['normal-hdr'])
      .toBe(VISUAL_CAPTURE_EXECUTION_V5_CAPABILITIES['normal-hdr']);

    const invalid = syntheticV5Profiles();
    invalid.first.readinessActivation.requiredState = 'pending';
    expect(() => createVisualCaptureExecutionV5CapabilityRegistry(syntheticDrivers, invalid))
      .toThrow('readinessActivation is not supported');
  });

  it('adds activation-owned work closure only through v6', () => {
    expect(VISUAL_CAPTURE_EXECUTION_V6_CAPABILITY_NAMES)
      .toEqual(VISUAL_CAPTURE_EXECUTION_CAPABILITY_NAMES);
    for (const name of VISUAL_CAPTURE_EXECUTION_V6_CAPABILITY_NAMES) {
      expect(VISUAL_CAPTURE_EXECUTION_V6_CAPABILITIES[name]).toEqual(v6Capability());
      expect(VISUAL_CAPTURE_EXECUTION_V5_CAPABILITIES[name]).toEqual(v5Capability());
    }
    expect(resolveVisualCaptureExecutionV6Capabilities('normal-hdr'))
      .toBe(VISUAL_CAPTURE_EXECUTION_V6_CAPABILITIES['normal-hdr']);
    expect(visualCaptureExecutionV6CapabilitiesForCaptureOrder(['normal-hdr'])['normal-hdr'])
      .toBe(VISUAL_CAPTURE_EXECUTION_V6_CAPABILITIES['normal-hdr']);

    const v5InV6 = syntheticV6Profiles();
    v5InV6.first.readinessActivation.capability = 'renderer-fixture-activation-generation/v1';
    expect(() => createVisualCaptureExecutionV6CapabilityRegistry(syntheticDrivers, v5InV6))
      .toThrow('readinessActivation is not supported');
  });

  it('adds activation-owned render-field closure only through v7', () => {
    expect(VISUAL_CAPTURE_EXECUTION_V7_CAPABILITY_NAMES)
      .toEqual(VISUAL_CAPTURE_EXECUTION_CAPABILITY_NAMES);
    for (const name of VISUAL_CAPTURE_EXECUTION_V7_CAPABILITY_NAMES) {
      expect(VISUAL_CAPTURE_EXECUTION_V7_CAPABILITIES[name]).toEqual(v7Capability());
      expect(VISUAL_CAPTURE_EXECUTION_V6_CAPABILITIES[name]).toEqual(v6Capability());
    }
    expect(resolveVisualCaptureExecutionV7Capabilities('normal-hdr'))
      .toBe(VISUAL_CAPTURE_EXECUTION_V7_CAPABILITIES['normal-hdr']);
    expect(visualCaptureExecutionV7CapabilitiesForCaptureOrder(['normal-hdr'])['normal-hdr'])
      .toBe(VISUAL_CAPTURE_EXECUTION_V7_CAPABILITIES['normal-hdr']);
    const invalid = syntheticV7Profiles();
    invalid.first.readinessActivation.completionScope = 'activation-owned-work';
    expect(() => createVisualCaptureExecutionV7CapabilityRegistry(syntheticDrivers, invalid))
      .toThrow('readinessActivation is not supported');
  });

  it('adds selection-owned alpha-readback only through v8 without activation semantics', () => {
    expect(VISUAL_CAPTURE_EXECUTION_V8_CAPABILITY_NAMES)
      .toEqual(VISUAL_CAPTURE_EXECUTION_CAPABILITY_NAMES);
    for (const name of VISUAL_CAPTURE_EXECUTION_V8_CAPABILITY_NAMES) {
      expect(VISUAL_CAPTURE_EXECUTION_V8_CAPABILITIES[name]).toEqual(v8Capability());
      expect(VISUAL_CAPTURE_EXECUTION_V8_CAPABILITIES[name]).not.toHaveProperty('readinessActivation');
    }
    expect(resolveVisualCaptureExecutionV8Capabilities('normal-hdr'))
      .toBe(VISUAL_CAPTURE_EXECUTION_V8_CAPABILITIES['normal-hdr']);
    expect(visualCaptureExecutionV8CapabilitiesForCaptureOrder(['normal-hdr'])['normal-hdr'])
      .toBe(VISUAL_CAPTURE_EXECUTION_V8_CAPABILITIES['normal-hdr']);
    const invalid = syntheticV8Profiles();
    invalid.first.framebufferReadback.bind = 'selected-presentation';
    expect(() => createVisualCaptureExecutionV8CapabilityRegistry(syntheticDrivers, invalid))
      .toThrow('framebufferReadback is not supported');
  });

  it('is recursively frozen and JSON-safe', () => {
    const profile = VISUAL_CAPTURE_EXECUTION_CAPABILITIES['normal-hdr'];
    expect(Object.isFrozen(VISUAL_CAPTURE_EXECUTION_CAPABILITY_NAMES)).toBe(true);
    expect(Object.isFrozen(VISUAL_CAPTURE_EXECUTION_CAPABILITIES)).toBe(true);
    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.startup)).toBe(true);
    expect(Object.isFrozen(profile.readiness)).toBe(true);
    expect(Object.isFrozen(profile.readiness.timeoutMsByGpu)).toBe(true);
    expect(Object.isFrozen(profile.stability)).toBe(true);
    expect(Object.isFrozen(profile.stability.planes)).toBe(true);
    expect(JSON.parse(JSON.stringify(VISUAL_CAPTURE_EXECUTION_CAPABILITIES)))
      .toEqual(VISUAL_CAPTURE_EXECUTION_CAPABILITIES);
  });

  it('resolves only known drivers to the canonical frozen profiles', () => {
    expect(resolveVisualCaptureExecutionCapabilities('normal-hdr'))
      .toBe(VISUAL_CAPTURE_EXECUTION_CAPABILITIES['normal-hdr']);
    expect(resolveVisualCaptureExecutionCapabilities('powder-render-style'))
      .toBe(VISUAL_CAPTURE_EXECUTION_CAPABILITIES['powder-render-style']);
    expect(() => resolveVisualCaptureExecutionCapabilities('missing')).toThrow('Unknown');
    expect(() => resolveVisualCaptureExecutionCapabilities(null)).toThrow('Unknown');
  });

  it('creates a frozen exact capture-order subset only for a clean driver set', () => {
    const subset = visualCaptureExecutionCapabilitiesForCaptureOrder([
      'normal-hdr', 'powder-render-style',
    ]);
    expect(Object.keys(subset)).toEqual(['normal-hdr', 'powder-render-style']);
    expect(Object.isFrozen(subset)).toBe(true);
    expect(subset['normal-hdr']).toBe(VISUAL_CAPTURE_EXECUTION_CAPABILITIES['normal-hdr']);
    expect(() => visualCaptureExecutionCapabilitiesForCaptureOrder(['normal-hdr', 'normal-hdr']))
      .toThrow('repeats');
    expect(() => visualCaptureExecutionCapabilitiesForCaptureOrder(['unknown']))
      .toThrow('Unknown');

    const v2Subset = visualCaptureExecutionV2CapabilitiesForCaptureOrder([
      'normal-hdr', 'powder-render-style',
    ]);
    expect(Object.keys(v2Subset)).toEqual(['normal-hdr', 'powder-render-style']);
    expect(v2Subset['normal-hdr']).toBe(VISUAL_CAPTURE_EXECUTION_V2_CAPABILITIES['normal-hdr']);
    expect(() => visualCaptureExecutionV2CapabilitiesForCaptureOrder(['normal-hdr', 'normal-hdr']))
      .toThrow('repeats');
  });

  it('fails closed for registry membership, order, data safety, and profile grammar', () => {
    expect(() => createVisualCaptureExecutionCapabilityRegistry(
      syntheticDrivers, { first: capability() },
    )).toThrow('missing second');
    expect(() => createVisualCaptureExecutionCapabilityRegistry(
      syntheticDrivers, { first: capability(), second: capability(), orphan: capability() },
    )).toThrow('undeclared orphan');
    expect(() => createVisualCaptureExecutionCapabilityRegistry(
      syntheticDrivers, { second: capability(), first: capability() },
    )).toThrow('capability order differs');
    expect(() => createVisualCaptureExecutionCapabilityRegistry(
      [Object.freeze({ name: 'unsafe_name' })], { unsafe_name: capability() },
    )).toThrow('Invalid');

    const functionProfile = syntheticProfiles();
    functionProfile.first.readiness.timeoutMsByGpu.auto = () => 60_000;
    expect(() => createVisualCaptureExecutionCapabilityRegistry(syntheticDrivers, functionProfile))
      .toThrow('JSON-safe');

    const nonJsonProfile = syntheticProfiles();
    nonJsonProfile.first.stability.timeoutMsByGpu.auto = Infinity;
    expect(() => createVisualCaptureExecutionCapabilityRegistry(syntheticDrivers, nonJsonProfile))
      .toThrow('JSON-safe');

    const invalidRange = syntheticProfiles();
    invalidRange.first.stability.consecutiveSnapshots = 1;
    expect(() => createVisualCaptureExecutionCapabilityRegistry(syntheticDrivers, invalidRange))
      .toThrow('integer from 2');

    const missingCompletion = syntheticV2Profiles();
    delete missingCompletion.first.completion;
    expect(() => createVisualCaptureExecutionV2CapabilityRegistry(
      syntheticDrivers, missingCompletion,
    )).toThrow('fields must be exactly');

    const unsupportedCompletion = syntheticV2Profiles();
    unsupportedCompletion.first.completion.requiredState = 'pending';
    expect(() => createVisualCaptureExecutionV2CapabilityRegistry(
      syntheticDrivers, unsupportedCompletion,
    )).toThrow('completion is not supported');

    const twoSnapshotsWithReceipt = syntheticV2Profiles();
    twoSnapshotsWithReceipt.first.stability.consecutiveSnapshots = 2;
    expect(() => createVisualCaptureExecutionV2CapabilityRegistry(
      syntheticDrivers, twoSnapshotsWithReceipt,
    )).toThrow('must be 1 with the receipt');

    const v3BindInV4 = syntheticV4Profiles();
    v3BindInV4.first.completion.bind = 'selected-presentation';
    expect(() => createVisualCaptureExecutionV4CapabilityRegistry(
      syntheticDrivers, v3BindInV4,
    )).toThrow('completion is not supported');

    const alteredDigest = syntheticProfiles();
    alteredDigest.first.stability.planes.reverse();
    expect(() => createVisualCaptureExecutionCapabilityRegistry(syntheticDrivers, alteredDigest))
      .toThrow('planes must be exactly');

    const alteredMode = syntheticProfiles();
    alteredMode.first.startup.variant = 'a';
    expect(() => createVisualCaptureExecutionCapabilityRegistry(syntheticDrivers, alteredMode))
      .toThrow('startup is not supported');

    const extended = clone(syntheticProfiles());
    extended.first.extra = true;
    expect(() => createVisualCaptureExecutionCapabilityRegistry(syntheticDrivers, extended))
      .toThrow('fields must be exactly');
  });
});
