import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  createVisualLabBrowserHostPlan,
  normalizeVisualLabBrowserHostPlan,
  resolveVisualLabBrowserHostPlanEntry,
  VISUAL_LAB_BROWSER_HOST_PLAN_SCHEMA,
} from './visual-lab-browser-host-plan.mjs';
import {
  createVisualLabExecutionPlan,
  VISUAL_LAB_EXECUTION_PLAN_SCHEMA,
} from './visual-lab-execution-plan.mjs';

const digest = (value) => `sha256:${createHash('sha256')
  .update(JSON.stringify(value), 'utf8').digest('hex')}`;

const expectRecursivelyFrozen = (value, visited = new Set()) => {
  if (value === null || typeof value !== 'object' || visited.has(value)) return;
  visited.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectRecursivelyFrozen(nested, visited);
};

const clone = (value) => structuredClone(value);

const withSyntheticEightScale = (capturePlan) => {
  const synthetic = clone(capturePlan);
  const inspectionEntry = synthetic.inspection.entries[0];
  inspectionEntry.request.renderScale = 8;
  inspectionEntry.resultIdentityInput.request.renderScale = 8;
  const { id: ignoredEntryId, ...entryIdentity } = inspectionEntry;
  inspectionEntry.id = digest({
    schema: VISUAL_LAB_EXECUTION_PLAN_SCHEMA,
    entry: entryIdentity,
    executionPolicy: synthetic.inspection.executionPolicy,
  });
  synthetic.entries[0].request.renderScale = 8;
  synthetic.entries[0].inspection = inspectionEntry;
  const { id: ignoredPlanId, ...planIdentity } = synthetic.inspection;
  synthetic.inspection.id = digest(planIdentity);
  return synthetic;
};

describe('Visual Lab browser host plan', () => {
  it('adds disjoint fresh/shared identities without changing capture identities', () => {
    const capturePlan = createVisualLabExecutionPlan({
      candidates: ['gas-showcase', 'powder-style-atlas'],
      baseUrl: 'file:///bundle/index.html',
      outputDir: '/machine-specific/review',
      gpu: 'swiftshader',
    });
    const before = JSON.stringify(capturePlan);
    const capturePlanId = capturePlan.inspection.id;
    const captureEntryIds = capturePlan.inspection.entries.map(({ id }) => id);

    const fresh = createVisualLabBrowserHostPlan(capturePlan, 'fresh');
    const shared = createVisualLabBrowserHostPlan(capturePlan, 'shared');

    expect(JSON.stringify(capturePlan)).toBe(before);
    expect(capturePlan.inspection.id).toBe(capturePlanId);
    expect(capturePlan.inspection.entries.map(({ id }) => id)).toEqual(captureEntryIds);
    expect(fresh).toMatchObject({
      schema: VISUAL_LAB_BROWSER_HOST_PLAN_SCHEMA,
      capturePlan: { schema: VISUAL_LAB_EXECUTION_PLAN_SCHEMA, id: capturePlanId },
      requestedMode: 'fresh',
      policy: {
        dispatch: 'sequential',
        sharedCandidateIsolation: 'fresh-incognito-context',
        freshCandidateIsolation: 'fresh-browser',
        recycleHostOn: [
          'timeout', 'context-loss', 'backend-fallback', 'browser-error', 'capture-error',
          'renderer-disposal-error', 'target-teardown-error', 'context-teardown-error',
        ],
      },
    });
    expect(fresh.entries.map(({ captureEntryId }) => captureEntryId)).toEqual(captureEntryIds);
    expect(fresh.entries.map(({ effectiveMode, isolation }) => [effectiveMode, isolation]))
      .toEqual([
        ['fresh', 'fresh-browser'],
        ['fresh', 'fresh-browser'],
      ]);
    expect(shared.entries.map(({ effectiveMode, isolation }) => [effectiveMode, isolation]))
      .toEqual([
        ['shared', 'fresh-incognito-context'],
        ['shared', 'fresh-incognito-context'],
      ]);
    expect(shared.id).not.toBe(fresh.id);
    expect(shared.entries.map(({ id }) => id)).not.toEqual(fresh.entries.map(({ id }) => id));
    expect(createVisualLabBrowserHostPlan(capturePlan, 'shared')).toEqual(shared);
    expectRecursivelyFrozen(fresh);
    expectRecursivelyFrozen(shared);
    expect(JSON.parse(JSON.stringify(shared))).toEqual(shared);
    expect(JSON.stringify(shared)).not.toMatch(/machine-specific|file:\/\/\/|compiled|runtime/);
  });

  it('forces a requested shared true-8x entry onto a fresh browser', () => {
    const capturePlan = withSyntheticEightScale(createVisualLabExecutionPlan({
      candidates: ['gas-showcase'],
      baseUrl: 'file:///bundle/index.html',
      outputDir: '/review',
    }));
    const plan = createVisualLabBrowserHostPlan(capturePlan, 'shared');

    expect(plan.entries[0]).toMatchObject({
      requestedMode: 'shared',
      effectiveMode: 'fresh',
      isolation: 'fresh-browser',
      renderScale: 8,
      forcedFreshReason: 'render-scale-8',
    });
  });

  it('normalizes canonical JSON and resolves an entry with capture-ID binding', () => {
    const capturePlan = createVisualLabExecutionPlan({
      candidates: ['gas-showcase'],
      baseUrl: 'file:///bundle/index.html',
      outputDir: '/review',
    });
    const created = createVisualLabBrowserHostPlan(capturePlan, 'shared');
    const parsed = JSON.parse(JSON.stringify(created));
    const normalized = normalizeVisualLabBrowserHostPlan(parsed, capturePlan);
    const entry = normalized.entries[0];

    expect(normalized).toEqual(created);
    expect(normalized).not.toBe(parsed);
    expectRecursivelyFrozen(normalized);
    expect(resolveVisualLabBrowserHostPlanEntry(
      parsed, entry.id, capturePlan.inspection.entries[0].id,
    )).toEqual(entry);

    expect(() => resolveVisualLabBrowserHostPlanEntry(parsed, `sha256:${'0'.repeat(64)}`))
      .toThrow('Unknown Visual Lab browser host entry id');
    expect(() => resolveVisualLabBrowserHostPlanEntry(parsed, 'not-an-id'))
      .toThrow('lowercase SHA-256');
    expect(() => resolveVisualLabBrowserHostPlanEntry(
      parsed, entry.id, `sha256:${'1'.repeat(64)}`,
    )).toThrow('does not bind capture entry');
  });

  it('rejects noncanonical modes, fields, policy, identities, and capture bindings', () => {
    const capturePlan = createVisualLabExecutionPlan({
      candidates: ['gas-showcase'],
      baseUrl: 'file:///bundle/index.html',
      outputDir: '/review',
    });
    const canonical = createVisualLabBrowserHostPlan(capturePlan, 'shared');

    expect(() => createVisualLabBrowserHostPlan(capturePlan, 'reuse'))
      .toThrow('must be fresh or shared');

    const unexpected = clone(canonical);
    unexpected.runtime = {};
    expect(() => normalizeVisualLabBrowserHostPlan(unexpected))
      .toThrow('must contain exactly');

    const changedPolicy = clone(canonical);
    changedPolicy.policy.dispatch = 'parallel';
    expect(() => normalizeVisualLabBrowserHostPlan(changedPolicy))
      .toThrow('does not match the frozen v1 policy');

    const changedEntry = clone(canonical);
    changedEntry.entries[0].effectiveMode = 'fresh';
    expect(() => normalizeVisualLabBrowserHostPlan(changedEntry))
      .toThrow('not canonical or has an identity mismatch');

    const changedId = clone(canonical);
    changedId.id = `sha256:${'0'.repeat(64)}`;
    expect(() => normalizeVisualLabBrowserHostPlan(changedId))
      .toThrow('identity mismatch');

    const otherCapturePlan = createVisualLabExecutionPlan({
      candidates: ['oxygen-showcase'],
      baseUrl: 'file:///bundle/index.html',
      outputDir: '/review',
    });
    expect(() => normalizeVisualLabBrowserHostPlan(canonical, otherCapturePlan))
      .toThrow('does not match its capture execution plan');

    const tamperedCapturePlan = clone(capturePlan);
    tamperedCapturePlan.inspection.entries[0].candidate = 'oxygen-showcase';
    expect(() => createVisualLabBrowserHostPlan(tamperedCapturePlan, 'fresh'))
      .toThrow('capture plan identity mismatch');
  });
});
