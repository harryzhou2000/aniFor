import { describe, expect, it } from 'vitest';

import {
  createVisualLabExecutionTuningPlan,
  createVisualLabExecutionTuningPlanV2,
  createVisualLabExecutionTuningPlanV3,
  createVisualLabExecutionTuningPlanV4,
  normalizeVisualLabExecutionTuningPlan,
  normalizeVisualLabExecutionTuningPlanV2,
  normalizeVisualLabExecutionTuningPlanV3,
  normalizeVisualLabExecutionTuningPlanV4,
  resolveVisualLabExecutionTuningPlanEntry,
  resolveVisualLabExecutionTuningPlanV2Entry,
  resolveVisualLabExecutionTuningPlanV3Entry,
  resolveVisualLabExecutionTuningPlanV4Entry,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V3_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V4_SCHEMA,
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

const v2Profile = ({ readinessAuto = 60_000, settleAuto = 10_000 } = {}) => ({
  startup: { variant: 'b', fieldRefresh: 'explicit', rafs: 2 },
  readiness: {
    planes: ['semantic', 'field-alpha', 'framebuffer-alpha'],
    pollIntervalMs: 50,
    timeoutMsByGpu: { auto: readinessAuto, swiftshader: 60_000 },
  },
  selection: { rafs: 2, exactDataset: true },
  stability: {
    planes: ['semantic', 'field-alpha', 'framebuffer-alpha'],
    consecutiveSnapshots: 1,
    pollIntervalMs: 50,
    timeoutMsByGpu: { auto: settleAuto, swiftshader: 30_000 },
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

const profilesFor = (capturePlan) => Object.fromEntries(
  [...new Set(capturePlan.inspection.entries.map(({ driver }) => driver.name))]
    .map((driver) => [driver, profile()]),
);
const v2ProfilesFor = (capturePlan) => Object.fromEntries(
  [...new Set(capturePlan.inspection.entries.map(({ driver }) => driver.name))]
    .map((driver) => [driver, v2Profile()]),
);
const v3Profile = () => ({
  ...v2Profile(),
  readinessCompletion: {
    capability: 'renderer-completed-frame-receipt/v1',
    receiptSchema: 'anifor.renderer.completed-frame-receipt/v1',
    requiredState: 'completed',
    bind: 'refreshed-presentation',
    verifyAfterSnapshot: true,
  },
});
const v3ProfilesFor = (capturePlan) => Object.fromEntries(
  [...new Set(capturePlan.inspection.entries.map(({ driver }) => driver.name))]
    .map((driver) => [driver, v3Profile()]),
);
const v4Profile = () => {
  const result = v3Profile();
  result.completion.bind = 'selection-owned-presentation';
  return result;
};
const v4ProfilesFor = (capturePlan) => Object.fromEntries(
  [...new Set(capturePlan.inspection.entries.map(({ driver }) => driver.name))]
    .map((driver) => [driver, v4Profile()]),
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
      id: 'sha256:27091b1afe4f9d3072a5ff0a3a0458591fa9d9c06586e7a970a249cbabdc9a9a',
      capturePlan: { schema: VISUAL_LAB_EXECUTION_PLAN_SCHEMA, id: captureId },
      gpuMode: 'swiftshader',
    });
    expect(plan.entries.map(({ id }) => id)).toEqual([
      'sha256:927129d6f6dbdbb30505d575208a227b5cdeaa7e1572bebe8502f8d877c0c296',
      'sha256:3031409fc055d2b995bff37cf1e589073831439dbf43d59e65a4cde7658ae655',
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

  it('creates, normalizes, and resolves opt-in completed-frame-receipt v2 plans', () => {
    const capturePlan = createVisualLabExecutionPlan({
      candidates: ['gas-showcase', 'powder-style-atlas'],
      baseUrl: 'file:///bundle/index.html', outputDir: '/review', gpu: 'swiftshader',
    });
    const created = createVisualLabExecutionTuningPlanV2(capturePlan, v2ProfilesFor(capturePlan));
    const parsed = JSON.parse(JSON.stringify(created));
    const normalized = normalizeVisualLabExecutionTuningPlanV2(parsed, capturePlan);

    expect(created).toMatchObject({
      schema: VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA,
      capturePlan: { schema: VISUAL_LAB_EXECUTION_PLAN_SCHEMA, id: capturePlan.inspection.id },
    });
    expect(created.entries.map(({ profile: entryProfile }) => entryProfile)).toEqual([
      v2Profile(), v2Profile(),
    ]);
    expect(normalized).toEqual(created);
    expect(createVisualLabExecutionTuningPlanV2(capturePlan, v2ProfilesFor(capturePlan)))
      .toEqual(created);
    expect(resolveVisualLabExecutionTuningPlanV2Entry(
      parsed, created.entries[0].id, capturePlan.inspection.entries[0].id, capturePlan,
    )).toEqual(created.entries[0]);
    expect(() => normalizeVisualLabExecutionTuningPlan(parsed, capturePlan))
      .toThrow(VISUAL_LAB_EXECUTION_TUNING_PLAN_SCHEMA);
    expect(() => normalizeVisualLabExecutionTuningPlanV2(
      JSON.parse(JSON.stringify(createVisualLabExecutionTuningPlan(capturePlan, profilesFor(capturePlan)))),
      capturePlan,
    )).toThrow(VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA);
  });

  it('rejects v2 completion drift, v2 snapshot-count drift, and completion identity tampering', () => {
    const capturePlan = createVisualLabExecutionPlan({
      candidates: ['gas-showcase'], baseUrl: 'file:///bundle/index.html', outputDir: '/review',
    });
    const plan = createVisualLabExecutionTuningPlanV2(capturePlan, v2ProfilesFor(capturePlan));

    const missingCompletion = clone(plan);
    delete missingCompletion.entries[0].profile.completion;
    expect(() => normalizeVisualLabExecutionTuningPlanV2(missingCompletion))
      .toThrow('must contain exactly');
    const pendingCompletion = clone(plan);
    pendingCompletion.entries[0].profile.completion.requiredState = 'pending';
    expect(() => normalizeVisualLabExecutionTuningPlanV2(pendingCompletion))
      .toThrow('exact completed-frame receipt proof');
    const twoSnapshots = clone(plan);
    twoSnapshots.entries[0].profile.stability.consecutiveSnapshots = 2;
    expect(() => normalizeVisualLabExecutionTuningPlanV2(twoSnapshots))
      .toThrow('exactly 1 snapshot');
    const completionTamper = clone(plan);
    completionTamper.entries[0].profile.completion.bind = 'unbound';
    expect(() => normalizeVisualLabExecutionTuningPlanV2(completionTamper))
      .toThrow('exact completed-frame receipt proof');
    expect(() => createVisualLabExecutionTuningPlanV2(capturePlan, profilesFor(capturePlan)))
      .toThrow('must contain exactly');
  });

  it('creates and resolves additive readiness-receipt v3 plans without rotating capture identity', () => {
    const capturePlan = createVisualLabExecutionPlan({
      candidates: ['powder-style-atlas'], baseUrl: 'file:///bundle/index.html', outputDir: '/review',
      gpu: 'swiftshader',
    });
    const created = createVisualLabExecutionTuningPlanV3(capturePlan, v3ProfilesFor(capturePlan));
    expect(created.schema).toBe(VISUAL_LAB_EXECUTION_TUNING_PLAN_V3_SCHEMA);
    expect(created.capturePlan.id).toBe(capturePlan.inspection.id);
    expect(created.entries[0].profile).toEqual(v3Profile());
    expect(normalizeVisualLabExecutionTuningPlanV3(structuredClone(created), capturePlan))
      .toEqual(created);
    expect(resolveVisualLabExecutionTuningPlanV3Entry(
      created, created.entries[0].id, capturePlan.inspection.entries[0].id, capturePlan,
    )).toEqual(created.entries[0]);
    const tampered = structuredClone(created);
    tampered.entries[0].profile.readinessCompletion.bind = 'selected-presentation';
    expect(() => normalizeVisualLabExecutionTuningPlanV3(tampered, capturePlan))
      .toThrow('refreshed-presentation receipt proof');
  });

  it('creates and resolves additive selection-owned receipt v4 plans', () => {
    const capturePlan = createVisualLabExecutionPlan({
      candidates: ['powder-style-atlas'], baseUrl: 'file:///bundle/index.html', outputDir: '/review',
      gpu: 'swiftshader',
    });
    const created = createVisualLabExecutionTuningPlanV4(capturePlan, v4ProfilesFor(capturePlan));
    expect(created.schema).toBe(VISUAL_LAB_EXECUTION_TUNING_PLAN_V4_SCHEMA);
    expect(created.capturePlan.id).toBe(capturePlan.inspection.id);
    expect(created.entries[0].profile).toEqual(v4Profile());
    expect(created.entries[0].profile.readinessCompletion.bind).toBe('refreshed-presentation');
    expect(created.entries[0].profile.completion.bind).toBe('selection-owned-presentation');
    expect(normalizeVisualLabExecutionTuningPlanV4(structuredClone(created), capturePlan))
      .toEqual(created);
    expect(resolveVisualLabExecutionTuningPlanV4Entry(
      created, created.entries[0].id, capturePlan.inspection.entries[0].id, capturePlan,
    )).toEqual(created.entries[0]);

    const v3Completion = structuredClone(created);
    v3Completion.entries[0].profile.completion.bind = 'selected-presentation';
    expect(() => normalizeVisualLabExecutionTuningPlanV4(v3Completion, capturePlan))
      .toThrow('exact completed-frame receipt proof');

    const v4AsV3 = structuredClone(created);
    v4AsV3.schema = VISUAL_LAB_EXECUTION_TUNING_PLAN_V3_SCHEMA;
    expect(() => normalizeVisualLabExecutionTuningPlanV3(v4AsV3, capturePlan))
      .toThrow('exact completed-frame receipt proof');
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
