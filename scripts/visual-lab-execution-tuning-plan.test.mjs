import { describe, expect, it } from 'vitest';

import {
  createVisualLabExecutionTuningPlan,
  normalizeVisualLabExecutionTuningPlan,
  resolveVisualLabExecutionTuningPlanEntry,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_SCHEMA,
} from './visual-lab-execution-tuning-plan.mjs';
import {
  createVisualLabExecutionPlan,
  VISUAL_LAB_EXECUTION_PLAN_SCHEMA,
} from './visual-lab-execution-plan.mjs';

const clone = (value) => structuredClone(value);

const expectRecursivelyFrozen = (value, visited = new Set()) => {
  if (value === null || typeof value !== 'object' || visited.has(value)) return;
  visited.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectRecursivelyFrozen(nested, visited);
};

const profile = ({ readinessAuto = 60_000, settleAuto = 10_000 } = {}) => ({
  startup: { variant: 'b', fieldRefresh: 'explicit', rafs: 2 },
  readiness: {
    planes: ['semantic', 'field-alpha', 'framebuffer-alpha'],
    pollIntervalMs: 50,
    timeoutMsByGpu: { auto: readinessAuto, swiftshader: 60_000 },
  },
  selection: { rafs: 2, exactDataset: true },
  stability: {
    planes: ['semantic', 'field-alpha', 'framebuffer-alpha'],
    consecutiveSnapshots: 2,
    pollIntervalMs: 50,
    timeoutMsByGpu: { auto: settleAuto, swiftshader: 30_000 },
  },
  screenshot: { after: 'stability-proof' },
});

const profilesFor = (capturePlan) => Object.fromEntries(
  [...new Set(capturePlan.inspection.entries.map(({ driver }) => driver.name))]
    .map((driver) => [driver, profile()]),
);

describe('Visual Lab execution tuning plan', () => {
  it('creates deterministic sibling identities without changing capture-plan IDs', () => {
    const capturePlan = createVisualLabExecutionPlan({
      candidates: ['gas-showcase', 'powder-style-atlas'],
      baseUrl: 'file:///bundle/index.html', outputDir: '/machine-specific/review', gpu: 'swiftshader',
    });
    const before = JSON.stringify(capturePlan);
    const captureId = capturePlan.inspection.id;
    const plan = createVisualLabExecutionTuningPlan(capturePlan, profilesFor(capturePlan));

    expect(JSON.stringify(capturePlan)).toBe(before);
    expect(plan).toMatchObject({
      schema: VISUAL_LAB_EXECUTION_TUNING_PLAN_SCHEMA,
      id: 'sha256:07e0444cb11c5d363758dab8d601eb1e4d2a8c6c203d8f129830c6c66333f136',
      capturePlan: { schema: VISUAL_LAB_EXECUTION_PLAN_SCHEMA, id: captureId },
      gpuMode: 'swiftshader',
    });
    expect(plan.entries.map(({ id }) => id)).toEqual([
      'sha256:6d2dd424952c8c50bf78e14300d90a2dc827aaa566d93a60941cc99fa03b1510',
      'sha256:3a871dfa844cc3e0585118ca661b60d99206027e46971a405282bbd25c747c9d',
    ]);
    expect(plan.entries.map(({ sequence, captureEntryId, driver }) => [sequence, captureEntryId, driver]))
      .toEqual(capturePlan.inspection.entries.map(({ id, driver }, sequence) => [sequence, id, driver.name]));
    expect(plan.entries[0].effectiveTimeouts).toEqual({ readinessMs: 60_000, stabilityMs: 30_000 });
    expect(plan.entries[0].profile).toEqual(profile());
    expect(createVisualLabExecutionTuningPlan(capturePlan, profilesFor(capturePlan))).toEqual(plan);
    expectRecursivelyFrozen(plan);
    expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
    expect(JSON.stringify(plan)).not.toMatch(/machine-specific|file:\/\/\//);
  });

  it('normalizes canonical JSON and resolves only an entry bound to its capture entry', () => {
    const capturePlan = createVisualLabExecutionPlan({
      candidates: ['gas-showcase'], baseUrl: 'file:///bundle/index.html', outputDir: '/review',
    });
    const created = createVisualLabExecutionTuningPlan(capturePlan, profilesFor(capturePlan));
    const parsed = JSON.parse(JSON.stringify(created));
    const normalized = normalizeVisualLabExecutionTuningPlan(parsed, capturePlan);

    expect(normalized).toEqual(created);
    expect(normalized).not.toBe(parsed);
    expectRecursivelyFrozen(normalized);
    expect(resolveVisualLabExecutionTuningPlanEntry(
      parsed, created.entries[0].id, capturePlan.inspection.entries[0].id, capturePlan,
    )).toEqual(created.entries[0]);
    expect(() => resolveVisualLabExecutionTuningPlanEntry(parsed, `sha256:${'0'.repeat(64)}`))
      .toThrow('Unknown Visual Lab execution tuning entry id');
    expect(() => resolveVisualLabExecutionTuningPlanEntry(
      parsed, created.entries[0].id, `sha256:${'1'.repeat(64)}`,
    )).toThrow('does not bind capture entry');
  });

  it('rejects malformed/tampered data, profile drift, unsafe names, and capture-plan mismatch', () => {
    const capturePlan = createVisualLabExecutionPlan({
      candidates: ['gas-showcase', 'powder-style-atlas'],
      baseUrl: 'file:///bundle/index.html', outputDir: '/review',
    });
    const profiles = profilesFor(capturePlan);
    const plan = createVisualLabExecutionTuningPlan(capturePlan, profiles);

    expect(() => createVisualLabExecutionTuningPlan(capturePlan, { 'normal-hdr': profile() }))
      .toThrow('must exactly contain');
    expect(() => createVisualLabExecutionTuningPlan(capturePlan, {
      'powder-render-style': profile(), 'normal-hdr': profile(),
    })).toThrow('in capture order');
    expect(() => createVisualLabExecutionTuningPlan(capturePlan, {
      ...profiles, unsafe_name: profile(),
    })).toThrow('must exactly contain');

    const extra = clone(plan);
    extra.entries[0].profile.extra = true;
    expect(() => normalizeVisualLabExecutionTuningPlan(extra)).toThrow('must contain exactly');
    const drift = clone(plan);
    drift.entries[0].profile.stability.timeoutMsByGpu.swiftshader = 31_000;
    expect(() => normalizeVisualLabExecutionTuningPlan(drift)).toThrow('identity mismatch');
    const changedEntryId = clone(plan);
    changedEntryId.entries[0].id = `sha256:${'0'.repeat(64)}`;
    expect(() => normalizeVisualLabExecutionTuningPlan(changedEntryId)).toThrow('identity mismatch');
    const unsafe = clone(plan);
    unsafe.entries[0].driver = '../normal-hdr';
    expect(() => normalizeVisualLabExecutionTuningPlan(unsafe)).toThrow('safe lowercase dashed name');
    const reordered = clone(plan);
    reordered.entries.reverse();
    expect(() => normalizeVisualLabExecutionTuningPlan(reordered, capturePlan))
      .toThrow('sequence must match its array index');

    const otherCapturePlan = createVisualLabExecutionPlan({
      candidates: ['oxygen-showcase'], baseUrl: 'file:///bundle/index.html', outputDir: '/review',
    });
    expect(() => normalizeVisualLabExecutionTuningPlan(plan, otherCapturePlan))
      .toThrow('does not match its capture execution plan');
    const tamperedCapturePlan = clone(capturePlan);
    tamperedCapturePlan.inspection.entries[0].candidate = 'oxygen-showcase';
    expect(() => createVisualLabExecutionTuningPlan(tamperedCapturePlan, profiles))
      .toThrow('capture plan identity mismatch');
  });

  it('rejects non-JSON profiles and preserves the complete required proof semantics', () => {
    const capturePlan = createVisualLabExecutionPlan({
      candidates: ['gas-showcase'], baseUrl: 'file:///bundle/index.html', outputDir: '/review',
    });
    const profiles = profilesFor(capturePlan);
    profiles['normal-hdr'].readiness.planes = ['semantic', 'framebuffer-alpha', 'field-alpha'];
    expect(() => createVisualLabExecutionTuningPlan(capturePlan, profiles))
      .toThrow('readiness.planes must exactly equal');
    const cyclic = profilesFor(capturePlan);
    cyclic['normal-hdr'].self = cyclic;
    expect(() => createVisualLabExecutionTuningPlan(capturePlan, cyclic)).toThrow('cycle');
    const invalid = profilesFor(capturePlan);
    invalid['normal-hdr'].startup.variant = 'a';
    expect(() => createVisualLabExecutionTuningPlan(capturePlan, invalid)).toThrow('seed variant b');
  });
});
