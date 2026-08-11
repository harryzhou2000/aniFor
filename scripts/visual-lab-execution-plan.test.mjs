import { describe, expect, it } from 'vitest';

import {
  createVisualCaptureExecutionEntry,
  createVisualLabExecutionPlan,
  VISUAL_LAB_EXECUTION_PLAN_SCHEMA,
} from './visual-lab-execution-plan.mjs';
import { resolveVisualLabCaptureRecipe } from './visual-lab-recipes.mjs';

const requestFor = (candidate) => {
  const recipe = resolveVisualLabCaptureRecipe(candidate);
  return {
    domain: recipe.domain,
    target: recipe.target,
    fixture: recipe.fixture,
    gain: recipe.gain,
    renderScale: recipe.renderScale,
  };
};

const expectRecursivelyFrozen = (value, visited = new Set()) => {
  if (value === null || typeof value !== 'object' || visited.has(value)) return;
  visited.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const nested of Object.values(value)) expectRecursivelyFrozen(nested, visited);
};

describe('Visual Lab execution plan', () => {
  it('compiles the full catalog before Chrome into one frozen portable inspection', () => {
    const plan = createVisualLabExecutionPlan({
      baseUrl: 'file:///bundle/index.html',
      outputDir: '/tmp/machine-specific-review',
      gpu: 'swiftshader',
      candidateTimeoutMs: 123_456,
    });

    expect(plan.entries.map(({ candidate }) => candidate)).toEqual([
      'gas-showcase', 'oxygen-showcase', 'oil-motion', 'water-motion',
      'powder-style-atlas', 'material-lighting-atlas',
    ]);
    expect(plan.inspection).toMatchObject({
      schema: VISUAL_LAB_EXECUTION_PLAN_SCHEMA,
      id: 'sha256:e10b816ed5b8f7c1620f28be867097c4c3b1a71b53af0b8c7f03aad791356a82',
      summary: { selected: 6 },
      variants: ['off', 'a', 'b'],
      executionPolicy: {
        gpuMode: 'swiftshader',
        browserHost: 'fresh-per-candidate',
        candidateIsolation: 'fresh-browser',
        hostReuse: 'disabled',
      },
    });
    expect(plan.inspection.entries.every(({ executableDigest }) => (
      /^sha256:[a-f0-9]{64}$/.test(executableDigest)
    ))).toBe(true);
    expectRecursivelyFrozen(plan);

    const inspection = JSON.stringify(plan.inspection);
    expect(inspection).not.toMatch(/machine-specific|file:\/\/\/|Expression|setVisualLabVariant/);
    expect(inspection).not.toMatch(/prepareVisualLabFixture|visualCaptureEvidenceAlpha|readerMethod/);
    expect(inspection).not.toMatch(/\.mjs|\.ts|function|modulePath/);
    expect(plan.runtime.outputDir).toBe('/tmp/machine-specific-review');
    expect(plan.runtime.baseUrl).toBe('file:///bundle/index.html');
  });

  it('binds Gas and Powder to distinct fixture-owned drivers and exact state projections', () => {
    const plan = createVisualLabExecutionPlan({
      candidates: ['powder-style-atlas', 'gas-showcase'],
      baseUrl: 'https://example.invalid/game/',
      outputDir: '/review',
    });
    const [gas, powder] = plan.inspection.entries;

    expect(gas.driver).toMatchObject({
      name: 'normal-hdr',
      framebufferAlphaPolicy: 'exact',
      publishesReportDescriptor: false,
    });
    expect(gas.driver.variants.map(({ label }) => label)).toEqual(['OFF', 'A', 'B']);
    expect(gas.driver.variants[1].dataset).toMatchObject({
      visualLab: 'active', visualLabDomain: 'gas', visualLabVariant: '1',
    });
    expect(gas.canonicalQuery).toContain('visualLab=gas');

    expect(powder.driver).toMatchObject({
      name: 'powder-render-style',
      framebufferAlphaPolicy: 'style-owned-nonempty',
      publishesReportDescriptor: true,
    });
    expect(powder.driver.variants.map(({ selection, label }) => [selection, label])).toEqual([
      ['smooth', 'Smooth'], ['local', 'Local'], ['grains', 'Grains'],
    ]);
    expect(powder.driver.variants[2].dataset).toMatchObject({
      visualLab: 'inactive', powderRenderStyle: 'grains',
    });
    expect(powder.canonicalQuery).not.toMatch(/visualLab=|visualVariant=/);

    const powderRuntime = plan.entries.find(({ candidate }) => (
      candidate === 'powder-style-atlas'
    ));
    expect(powderRuntime.compiled.datasetProjectionExpression)
      .toContain('preparedVisualCaptureVariant("powder-style-atlas")');
    for (const variant of powderRuntime.compiled.variants) {
      expect(variant.selectionExpression)
        .toContain('setPreparedVisualCaptureVariant("powder-style-atlas",');
    }
  });

  it('rejects fixture and driver mismatches during plan compilation', () => {
    expect(() => createVisualCaptureExecutionEntry({
      request: {
        domain: 'gas', target: 0, fixture: 'powder-style-atlas', gain: 1, renderScale: 2,
      },
      baseUrl: 'file:///bundle/index.html',
      outputDir: '/never-created',
    })).toThrow('--fixture=powder-style-atlas requires --domain=powder --target=0');
    expect(() => createVisualCaptureExecutionEntry({
      request: {
        domain: 'powder', target: 0, fixture: 'showcase', gain: 1, renderScale: 2,
      },
      baseUrl: 'file:///bundle/index.html',
      outputDir: '/never-created',
    })).toThrow('--fixture=showcase requires --domain to be one of');
  });

  it('records prepared fixture IDs without serializing executable preparation authority', () => {
    const plan = createVisualLabExecutionPlan({
      candidates: ['gas-showcase', 'oil-motion'],
      baseUrl: 'file:///bundle/index.html',
      outputDir: '/review',
    });
    const [gas, oil] = plan.inspection.entries;
    expect(gas.fixture.preparation).toEqual({ kind: 'scene', reportLabel: 'scene' });
    expect(oil.fixture.preparation).toEqual({
      kind: 'prepared-fixture',
      fixtureId: 'oil-motion',
      reportLabel: 'prepareOilMotionVfxFixture',
    });
    expect(plan.entries[1].compiled.startupExpression).toContain('prepareVisualLabFixture');
    expect(JSON.stringify(oil)).not.toContain('prepareVisualLabFixture');
  });

  it('keeps relative artifacts disjoint and result identity explicitly pending PNG hashes', () => {
    const plan = createVisualLabExecutionPlan({
      candidates: ['gas-showcase', 'water-motion'],
      baseUrl: 'file:///bundle/index.html',
      outputDir: '/review',
    });
    const [gas, water] = plan.inspection.entries;
    expect(gas.artifacts.root).toBe('candidates/gas-showcase');
    expect(water.artifacts.root).toBe('candidates/water-motion');
    expect(new Set([
      ...Object.values(gas.artifacts.captures),
      ...Object.values(water.artifacts.captures),
    ]).size).toBe(6);
    expect(gas.resultIdentityInput).toEqual({
      schema: 'anifor.visual-lab.result/v1',
      candidate: 'gas-showcase',
      request: requestFor('gas-showcase'),
      captureKeys: ['off', 'a', 'b'],
      status: 'pending-capture-sha256',
    });
    expect(gas.resultIdentityInput).not.toHaveProperty('id');
    expect(gas.artifacts).not.toHaveProperty('lifecycle');
    expect(plan.entries[0].runtime.lifecycleFile)
      .toBe('/review/candidates/gas-showcase/chrome-lifecycle.json');
  });

  it('keeps portable identity independent of runtime roots and rejects named drift', () => {
    const first = createVisualLabExecutionPlan({
      candidates: ['gas-showcase'],
      baseUrl: 'file:///first/index.html',
      outputDir: '/first/output',
    });
    const second = createVisualLabExecutionPlan({
      candidates: ['gas-showcase'],
      baseUrl: 'https://host.invalid/other/index.html',
      outputDir: '/second/output',
    });
    expect(first.inspection.id).toBe(second.inspection.id);
    expect(first.runtime.entries[0].url).not.toBe(second.runtime.entries[0].url);

    for (const suffix of [
      '?token=secret&foo=1',
      '?gasCoreDepthVfx=0',
      '?gasCoreDepthVfx=1',
      '#render-state',
    ]) {
      expect(() => createVisualLabExecutionPlan({
        candidates: ['gas-showcase'],
        baseUrl: `https://host.invalid/game/${suffix}`,
        outputDir: '/first/output',
      })).toThrow('capture state is plan-owned');
    }

    const software = createVisualLabExecutionPlan({
      candidates: ['gas-showcase'],
      baseUrl: 'file:///first/index.html',
      outputDir: '/first/output',
      gpu: 'swiftshader',
    });
    expect(software.inspection.id).not.toBe(first.inspection.id);

    expect(() => createVisualCaptureExecutionEntry({
      candidate: 'gas-showcase',
      request: { ...requestFor('gas-showcase'), target: 4 },
    })).toThrow('must exactly match its recipe');
    expect(() => createVisualLabExecutionPlan({
      candidates: ['gas-showcase', 'gas-showcase'],
    })).toThrow('Duplicate --candidates entry');
  });

  it('lets a child consume the exact parent artifact runtime without nesting it', () => {
    const parent = createVisualLabExecutionPlan({
      candidates: ['gas-showcase'],
      baseUrl: 'file:///bundle/index.html',
      outputDir: '/review',
    }).entries[0];
    const child = createVisualCaptureExecutionEntry({
      candidate: 'gas-showcase',
      request: requestFor('gas-showcase'),
      baseUrl: 'file:///bundle/index.html',
      outputDir: parent.runtime.artifactRoot,
      artifactRoot: parent.runtime.artifactRoot,
    });

    expect(child.inspection.id).toBe(parent.inspection.id);
    expect(child.runtime).toEqual(parent.runtime);
    expect(child.runtime.artifactRoot).toBe('/review/candidates/gas-showcase');
    expect(child.runtime.artifacts.report)
      .toBe('/review/candidates/gas-showcase/report.json');
  });
});
