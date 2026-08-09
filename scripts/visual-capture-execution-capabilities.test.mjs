import { describe, expect, it } from 'vitest';
import {
  createVisualCaptureExecutionCapabilityRegistry,
  resolveVisualCaptureExecutionCapabilities,
  VISUAL_CAPTURE_EXECUTION_CAPABILITIES,
  VISUAL_CAPTURE_EXECUTION_CAPABILITY_NAMES,
  visualCaptureExecutionCapabilitiesForCaptureOrder,
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
    timeoutMsByGpu: { auto: 10_000, swiftshader: 30_000 },
  },
  screenshot: { after: 'stability-proof' },
});

const clone = (value) => JSON.parse(JSON.stringify(value));

const syntheticDrivers = Object.freeze([Object.freeze({ name: 'first' }), Object.freeze({ name: 'second' })]);
const syntheticProfiles = () => ({ first: capability(), second: capability() });

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
