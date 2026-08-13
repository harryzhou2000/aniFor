import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildVisualCaptureDatasetProjectionExpression,
  buildVisualCaptureSelectionExpression,
  createVisualCaptureDriverRegistry,
  createVisualCaptureFixtureBoundExpressions,
  resolveVisualCaptureDriver,
  resolveVisualCaptureVariant,
  VISUAL_CAPTURE_DRIVER_NAMES,
  visualCaptureDriverDatasetExpectation,
  visualCaptureDriverReportFields,
  visualCaptureDriverReportDescriptor,
  visualCaptureDriverStartupFields,
  visualCaptureDriverUrlValues,
  visualCaptureVariantLabel,
} from './visual-capture-drivers.mjs';

const runSelection = (
  driver, variant, audit,
  fixtureId = ({
    'powder-render-style': 'powder-style-atlas',
    'material-lighting-profile': 'material-lighting-atlas',
  })[typeof driver === 'string' ? driver : driver.name] ?? 'showcase',
) => Function(
  'audit', `return ${buildVisualCaptureSelectionExpression(
    driver, variant, { fixtureId },
  )};`,
)(audit);

describe('typed visual capture drivers', () => {
  it('maps the real Powder styles through the stable off/A/B capture ABI', () => {
    expect(VISUAL_CAPTURE_DRIVER_NAMES).toEqual([
      'normal-hdr', 'powder-render-style', 'material-lighting-profile',
    ]);
    const driver = resolveVisualCaptureDriver('powder-render-style');
    expect(driver.variants.map(({ name, selection }) => [name, selection])).toEqual([
      ['off', 'smooth'], ['a', 'local'], ['b', 'grains'],
    ]);
    expect(resolveVisualCaptureVariant(driver, 1).name).toBe('a');
    expect(resolveVisualCaptureVariant(driver, 2).selection).toBe('grains');

    let selectedVariant = 0;
    const calls = [];
    const audit = {
      setPreparedVisualCaptureVariant: (fixture, variant) => {
        calls.push(['set', fixture, variant]);
        selectedVariant = variant;
      },
      preparedVisualCaptureVariant: (fixture) => {
        calls.push(['read', fixture]);
        return selectedVariant;
      },
    };
    expect(runSelection(driver, 0, audit)).toEqual({ ok: true, selection: 'smooth' });
    expect(runSelection(driver, 1, audit)).toEqual({ ok: true, selection: 'local' });
    expect(runSelection(driver, 2, audit)).toEqual({ ok: true, selection: 'grains' });
    expect(calls).toEqual([
      ['set', 'powder-style-atlas', 0], ['read', 'powder-style-atlas'],
      ['set', 'powder-style-atlas', 1], ['read', 'powder-style-atlas'],
      ['set', 'powder-style-atlas', 2], ['read', 'powder-style-atlas'],
    ]);
  });

  it('keeps normal HDR selection and URL state byte-compatible', () => {
    const calls = [];
    let selectedVariant = 0;
    expect(runSelection('normal-hdr', 2, {
      setPreparedVisualCaptureVariant: (fixture, variant) => {
        calls.push(['set', fixture, variant]);
        selectedVariant = variant;
      },
      preparedVisualCaptureVariant: (fixture) => {
        calls.push(['read', fixture]);
        return selectedVariant;
      },
    })).toEqual({ ok: true, selection: 2 });
    expect(calls).toEqual([
      ['set', 'showcase', 2], ['read', 'showcase'],
    ]);
    const request = { domain: 'gas', target: 4, gain: 1.25 };
    expect(visualCaptureDriverUrlValues('normal-hdr', request)).toEqual({
      visualLab: 'gas', visualVariant: '0', visualTarget: '4', visualGain: '1.25',
    });
    expect(visualCaptureDriverDatasetExpectation('normal-hdr', request, 1)).toEqual({
      visualLab: 'active', visualLabDomain: 'gas', visualLabVariant: '1',
      visualLabTarget: '4', visualLabGain: '1.25',
    });
  });

  it('binds selection generation to exact known showcase, Oil, Water, and Powder fixtures', () => {
    const normalCalls = [];
    let normalVariant = 0;
    const normalAudit = {
      setPreparedVisualCaptureVariant: (fixtureId, variant) => {
        normalCalls.push(['set', fixtureId, variant]);
        normalVariant = variant;
      },
      preparedVisualCaptureVariant: (fixtureId) => {
        normalCalls.push(['read', fixtureId]);
        return normalVariant;
      },
    };
    const expressions = ['showcase', 'oil-motion', 'water-motion'].map((fixtureId) => (
      buildVisualCaptureSelectionExpression('normal-hdr', 2, { fixtureId })
    ));
    expect(new Set(expressions).size).toBe(3);
    for (const fixtureId of ['showcase', 'oil-motion', 'water-motion']) {
      expect(runSelection('normal-hdr', 2, normalAudit, fixtureId))
        .toEqual({ ok: true, selection: 2 });
    }
    expect(normalCalls).toEqual([
      ['set', 'showcase', 2], ['read', 'showcase'],
      ['set', 'oil-motion', 2], ['read', 'oil-motion'],
      ['set', 'water-motion', 2], ['read', 'water-motion'],
    ]);

    const powderCalls = [];
    expect(runSelection('powder-render-style', 1, {
      setPreparedVisualCaptureVariant: (fixtureId, variant) => {
        powderCalls.push(['set', fixtureId, variant]);
      },
      preparedVisualCaptureVariant: (fixtureId) => {
        powderCalls.push(['read', fixtureId]);
        return 1;
      },
    }, 'powder-style-atlas')).toEqual({ ok: true, selection: 'local' });
    expect(powderCalls).toEqual([
      ['set', 'powder-style-atlas', 1], ['read', 'powder-style-atlas'],
    ]);
  });

  it('binds a second Powder fixture to the same exact selection and projection context', () => {
    const fixtureId = 'powder-comparison-atlas';
    const expressions = createVisualCaptureFixtureBoundExpressions([
      { fixtureId: 'powder-style-atlas', driver: 'powder-render-style' },
      { fixtureId, driver: 'powder-render-style' },
    ]);
    const selectionExpression = expressions.buildSelectionExpression(
      'powder-render-style', 1, { fixtureId },
    );
    const projectionExpression = expressions.buildDatasetProjectionExpression(
      'powder-render-style', { fixtureId },
    );
    expect(selectionExpression).toContain(`setPreparedVisualCaptureVariant(${JSON.stringify(fixtureId)}, 1)`);
    expect(projectionExpression)
      .toContain(`preparedVisualCaptureVariant(${JSON.stringify(fixtureId)})`);
    expect(selectionExpression).not.toContain('setPreparedVisualCaptureVariant("powder-style-atlas",');
    expect(projectionExpression).not.toContain('preparedVisualCaptureVariant("powder-style-atlas")');

    let selectedVariant = 0;
    const calls = [];
    const audit = {
      setPreparedVisualCaptureVariant: (fixture, variant) => {
        calls.push(['set', fixture, variant]);
        selectedVariant = variant;
      },
      preparedVisualCaptureVariant: (fixture) => {
        calls.push(['read', fixture]);
        return selectedVariant;
      },
    };
    expect(Function('audit', `return ${selectionExpression};`)(audit))
      .toEqual({ ok: true, selection: 'local' });
    expect(Function('audit', `return ${projectionExpression};`)(audit))
      .toEqual({ powderRenderStyle: 'local' });
    expect(calls).toEqual([
      ['set', fixtureId, 1], ['read', fixtureId], ['read', fixtureId],
    ]);

    expect(() => expressions.buildSelectionExpression(
      'normal-hdr', 1, { fixtureId },
    )).toThrow('does not use driver normal-hdr');
    expect(() => expressions.buildDatasetProjectionExpression(
      'normal-hdr', { fixtureId },
    )).toThrow('does not use driver normal-hdr');
  });

  it('keeps Powder outside HDR state and publishes self-describing review labels', () => {
    const request = { domain: 'powder', target: 0, gain: 1 };
    expect(visualCaptureDriverUrlValues('powder-render-style', request)).toEqual({
      visualLab: null, visualVariant: null, visualTarget: null, visualGain: null,
    });
    expect(visualCaptureDriverDatasetExpectation('powder-render-style', request, 'a'))
      .toEqual({
        visualLab: 'inactive', visualLabDomain: 'off', visualLabVariant: '0',
        visualLabTarget: '0', visualLabGain: '1', powderRenderStyle: 'local',
      });
    expect(visualCaptureDriverReportDescriptor('powder-render-style')).toEqual({
      name: 'powder-render-style',
      framebufferAlphaPolicy: 'style-owned-nonempty',
      variants: {
        off: { selection: 'smooth', label: 'Smooth' },
        a: { selection: 'local', label: 'Local' },
        b: { selection: 'grains', label: 'Grains' },
      },
    });
  });

  it('keeps material-lighting outside HDR state and binds its profile values to the typed fixture', () => {
    const request = { domain: 'material-lighting', target: 0, gain: 1 };
    expect(visualCaptureDriverUrlValues('material-lighting-profile', request)).toEqual({
      visualLab: null, visualVariant: null, visualTarget: null, visualGain: null,
    });
    expect(visualCaptureDriverDatasetExpectation('material-lighting-profile', request, 'b'))
      .toEqual({
        visualLab: 'inactive', visualLabDomain: 'off', visualLabVariant: '0',
        visualLabTarget: '0', visualLabGain: '1', materialLightingVariant: '2',
      });
    let selectedVariant = 0;
    expect(runSelection('material-lighting-profile', 2, {
      setPreparedVisualCaptureVariant: (fixture, variant) => {
        expect(fixture).toBe('material-lighting-atlas');
        selectedVariant = variant;
      },
      preparedVisualCaptureVariant: (fixture) => {
        expect(fixture).toBe('material-lighting-atlas');
        return selectedVariant;
      },
    })).toEqual({ ok: true, selection: 2 });
    expect(visualCaptureDriverReportDescriptor('material-lighting-profile')).toEqual({
      name: 'material-lighting-profile',
      framebufferAlphaPolicy: 'exact',
      variants: {
        off: { selection: 0, label: 'Off' },
        a: { selection: 1, label: 'Balanced' },
        b: { selection: 2, label: 'Volumetric' },
      },
    });
  });

  it('owns observed state, startup/report metadata, and labels in one registry', () => {
    const normalObserved = Function(
      'audit', `return ${buildVisualCaptureDatasetProjectionExpression(
        'normal-hdr', { fixtureId: 'showcase' },
      )};`,
    )({});
    const powderObserved = Function(
      'audit', `return ${buildVisualCaptureDatasetProjectionExpression(
        'powder-render-style', { fixtureId: 'powder-style-atlas' },
      )};`,
    )({
      preparedVisualCaptureVariant: (fixture) => {
        expect(fixture).toBe('powder-style-atlas');
        return 2;
      },
    });
    const lightingObserved = Function(
      'audit', `return ${buildVisualCaptureDatasetProjectionExpression(
        'material-lighting-profile', { fixtureId: 'material-lighting-atlas' },
      )};`,
    )({ preparedVisualCaptureVariant: () => 1 });

    expect(normalObserved).toEqual({});
    expect(powderObserved).toEqual({ powderRenderStyle: 'grains' });
    expect(lightingObserved).toEqual({ materialLightingVariant: '1' });
    expect(JSON.stringify(visualCaptureDriverStartupFields('normal-hdr', 2))).toBe('{}');
    expect(JSON.stringify(visualCaptureDriverStartupFields('powder-render-style', 2)))
      .toBe('{"captureDriver":"powder-render-style","selection":"grains"}');
    expect(visualCaptureDriverReportFields('normal-hdr')).toEqual({});
    expect(Object.keys(visualCaptureDriverReportFields('powder-render-style')))
      .toEqual(['captureDriver']);
    expect(Object.keys(visualCaptureDriverReportFields('material-lighting-profile')))
      .toEqual(['captureDriver']);
    expect(['off', 'a', 'b'].map((variant) => (
      visualCaptureVariantLabel('normal-hdr', variant)
    ))).toEqual(['OFF', 'A', 'B']);
    expect(['off', 'a', 'b'].map((variant) => (
      visualCaptureVariantLabel('powder-render-style', variant)
    ))).toEqual(['Smooth', 'Local', 'Grains']);
    expect(['off', 'a', 'b'].map((variant) => (
      visualCaptureVariantLabel('material-lighting-profile', variant)
    ))).toEqual(['Off', 'Balanced', 'Volumetric']);
  });

  it('fails fixture-owned selectors closed for unknown, unprepared, or mismatched state', () => {
    const unknownFixture = {
      setPreparedVisualCaptureVariant: (fixture) => {
        throw new Error(`Unknown prepared Visual Lab fixture ${fixture}`);
      },
      preparedVisualCaptureVariant: () => 0,
    };
    expect(runSelection('powder-render-style', 0, unknownFixture))
      .toEqual({ ok: false, failure: 'selector-threw' });

    const unpreparedFixture = {
      setPreparedVisualCaptureVariant: () => {},
      preparedVisualCaptureVariant: () => {
        throw new Error('Prepared Visual Lab fixture is not active');
      },
    };
    expect(runSelection('powder-render-style', 1, unpreparedFixture))
      .toEqual({ ok: false, failure: 'selector-threw' });

    const mismatchedFixture = {
      setPreparedVisualCaptureVariant: () => {},
      preparedVisualCaptureVariant: () => 2,
    };
    expect(runSelection('powder-render-style', 1, mismatchedFixture)).toEqual({
      ok: false, failure: 'selection-mismatch', selection: 'grains',
    });
    expect(runSelection('normal-hdr', 1, mismatchedFixture, 'water-motion')).toEqual({
      ok: false, failure: 'selection-mismatch', selection: 2,
    });

    const project = (audit) => Function(
      'audit', `return ${buildVisualCaptureDatasetProjectionExpression(
        'powder-render-style', { fixtureId: 'powder-style-atlas' },
      )};`,
    )(audit);
    expect(project({})).toEqual({ powderRenderStyle: undefined });
    expect(project({ preparedVisualCaptureVariant: () => { throw new Error('unprepared'); } }))
      .toEqual({ powderRenderStyle: undefined });
    expect(project({ preparedVisualCaptureVariant: () => 9 }))
      .toEqual({ powderRenderStyle: undefined });
  });

  it('fails module-style registry construction on missing, orphan, reordered, or invalid adapters', () => {
    const declarations = [Object.freeze({ name: 'first' }), Object.freeze({ name: 'second' })];
    const adapter = () => ({
      urlValues: () => ({}),
      datasetExpectation: () => ({}),
      selectionExpression: () => 'true',
      datasetProjectionExpression: () => '({})',
      publishesReportDescriptor: true,
      reportMismatch: 'mismatch',
    });

    expect(() => createVisualCaptureDriverRegistry(declarations, { first: adapter() }))
      .toThrow('missing second');
    expect(() => createVisualCaptureDriverRegistry(declarations, {
      first: adapter(), second: adapter(), orphan: adapter(),
    })).toThrow('undeclared orphan');
    expect(() => createVisualCaptureDriverRegistry(declarations, {
      second: adapter(), first: adapter(),
    })).toThrow('adapter order differs');
    expect(() => createVisualCaptureDriverRegistry(declarations, {
      first: { ...adapter(), extra: true }, second: adapter(),
    })).toThrow('invalid executable adapter');
    expect(() => createVisualCaptureDriverRegistry(declarations, {
      first: Object.fromEntries(Object.entries(adapter()).reverse()), second: adapter(),
    })).toThrow('invalid executable adapter');
    const nonEnumerable = {};
    for (const [name, value] of Object.entries(adapter())) {
      Object.defineProperty(nonEnumerable, name, { value });
    }
    expect(() => createVisualCaptureDriverRegistry(declarations, {
      first: nonEnumerable, second: adapter(),
    })).toThrow('invalid executable adapter');
    expect(() => createVisualCaptureDriverRegistry(declarations, {
      first: { ...adapter(), selectionExpression: null }, second: adapter(),
    })).toThrow('invalid executable adapter');

    const registry = createVisualCaptureDriverRegistry(declarations, {
      first: adapter(), second: adapter(),
    });
    expect(registry.names).toEqual(['first', 'second']);
    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry.names)).toBe(true);
  });

  it('keeps request consumers free of domain-owned or driver-name dispatch', () => {
    for (const file of [
      'visual-lab-audit.mjs',
      'visual-lab-batch.mjs',
      'visual-lab-baseline.mjs',
      'visual-lab-execution-plan.mjs',
      'visual-lab-recipes.mjs',
    ]) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
      expect(source).not.toMatch(/(?:captureDriver|driver)\.name\s*===/);
      expect(source).not.toMatch(/(?:domainAdapter|domain)\.driver/);
      expect(source).not.toMatch(/===\s*['"]powder-render-style['"]/);
    }
  });

  it('exposes an import-safe page-scoped capture transaction', async () => {
    const audit = await import('./visual-lab-audit.mjs');
    expect(typeof audit.captureVisualLabCandidatePage).toBe('function');
    expect(typeof audit.disposeVisualLabCandidatePage).toBe('function');
    expect(typeof audit.digestVisualLabFramebufferAlpha).toBe('function');
    expect(typeof audit.beginStagedVisualLabNavigation).toBe('function');
    expect(typeof audit.assertContiguousSelectionOwnedReceiptSubmissions).toBe('function');
    expect(typeof audit.requestTypedFixtureActivationGeneration).toBe('function');
    expect(typeof audit.proveFixtureActivationReadiness).toBe('function');
    expect(typeof audit.overlapVisualLabSnapshotEvidence).toBe('function');
    const source = readFileSync(new URL('./visual-lab-audit.mjs', import.meta.url), 'utf8');
    expect(source).toContain('entry: options.executionPlan');
    expect(source).toContain('createVisualLabCaptureSubphaseTimingRecorder');
    expect(source).toContain('if (readbackTicket === null)');
    expect(source).toContain('gl.readPixels');
    expect(source).toContain('Promise.all');
    expect(source).toContain('captureSubphases: captureSubphases.finish()');
    expect(source).toContain("measureSnapshot(\n        'readiness'");
    expect(source).toContain('effectiveTimeouts.readinessMs');
    expect(source).toContain('snapshotCommandTimeoutMs');
    expect(source).toContain('activatePreparedVisualCaptureFixtureWithDrainedWorkGeneration');
    expect(source).toContain('readinessFixtureActivationRenderFieldGeneration');
    expect(source).toContain('setPreparedVisualCaptureVariantWithCompletedFrameReceipt');
    expect(source).toContain('setPreparedVisualCaptureVariantWithCompletedFrameReceiptAndFramebufferAlphaReadback');
    expect(source).toContain('hasSelectionOwnedCompletedFrameReceiptDescriptor(profile)');
    expect(source).toContain('hasSelectionOwnedFramebufferAlphaReadbackDescriptor(profile)');
    expect(source).toContain('prearmedFramebufferAlphaReadbackTicket');
    expect(source).toContain('ticket = await requestCompletedFrameReceipt(');
    expect(source).toContain('selection = await performSelection()');
    expect(source).toContain('})()`, snapshotCommandTimeoutMs)');
    expect(source).toContain("pageCdp.send('Page.enable')");
    expect(source).toContain('browserErrors = collectBrowserErrors(pageCdp)');
    expect(source).toContain('initialUrl: stagedNavigation ? blankTargetUrl : url');
    expect(source).toContain('url: stagedNavigation ? blankTargetUrl : url');
    expect(source.indexOf("pageCdp.send('Page.enable')"))
      .toBeLessThan(source.indexOf('navigation = navigatePage('));
    expect(source.indexOf('navigation = navigatePage('))
      .toBeLessThan(source.lastIndexOf('captureVisualLabCandidateEvidence({'));
    expect(source).toContain('realpathSync(process.argv[1]) === realpathSync(MODULE_PATH)');
    expect(source).not.toMatch(/export async function captureVisualLabCandidatePage\(cdp, options/);
  });

  it('overlaps framebuffer and core evidence while preserving historical snapshot shape', async () => {
    const { overlapVisualLabSnapshotEvidence } = await import('./visual-lab-audit.mjs');
    const events = [];
    let releaseFramebuffer;
    const framebuffer = new Promise((resolve) => { releaseFramebuffer = resolve; });
    const resultPromise = overlapVisualLabSnapshotEvidence(
      async () => {
        events.push('framebuffer:start');
        const digest = await framebuffer;
        events.push('framebuffer:end');
        return digest;
      },
      async () => {
        events.push('core:start');
        await Promise.resolve();
        events.push('core:end');
        return {
          world: { width: 612, height: 384 }, backend: { backend: 'webgl' },
          dataset: { renderer: 'pixi-webgl' }, semantic: { hash: 1 },
          fieldAlpha: { hash: 2 }, canvas: { width: 1224, height: 768 },
        };
      },
    );
    await Promise.resolve();
    expect(events).toEqual(['framebuffer:start', 'core:start', 'core:end']);
    releaseFramebuffer({ hash: 3, supportHash: 4, alphaSum: 5, nonzero: 6 });
    const result = await resultPromise;
    expect(Object.keys(result)).toEqual([
      'world', 'backend', 'dataset', 'semantic', 'fieldAlpha', 'framebufferAlpha', 'canvas',
    ]);
    expect(result.framebufferAlpha).toEqual({ hash: 3, supportHash: 4, alphaSum: 5, nonzero: 6 });
  });

  it('propagates overlapping snapshot reader failures and rejects malformed core evidence', async () => {
    const { overlapVisualLabSnapshotEvidence } = await import('./visual-lab-audit.mjs');
    await expect(overlapVisualLabSnapshotEvidence(
      async () => { throw new Error('readback failed'); }, async () => ({}),
    )).rejects.toThrow('readback failed');
    await expect(overlapVisualLabSnapshotEvidence(
      async () => ({}), async () => null,
    )).rejects.toThrow('core snapshot is malformed');
    await expect(overlapVisualLabSnapshotEvidence(null, async () => ({})))
      .rejects.toThrow('requires framebuffer and core readers');
  });

  it('activates v5 startup once and proves readiness with one snapshot and one reread', async () => {
    const {
      awaitFixtureActivationGeneration,
      proveFixtureActivationReadiness,
      requestTypedFixtureActivationGeneration,
    } = await import('./visual-lab-audit.mjs');
    const activationCalls = [];
    const ticket = await requestTypedFixtureActivationGeneration((fixture, variant) => {
      activationCalls.push([fixture, variant]);
      return 17;
    }, 'powder-style-atlas', 2);
    expect(ticket).toBe(17);
    expect(activationCalls).toEqual([['powder-style-atlas', 2]]);

    const generationReads = [
      { ticket: 17, generation: 30, state: 'pending' },
      { ticket: 17, generation: 30, state: 'completed' },
    ];
    await expect(awaitFixtureActivationGeneration({
      ticket: 17,
      timeoutMs: 20,
      pollIntervalMs: 1,
      readGeneration: () => generationReads.shift(),
    })).resolves.toEqual({ ticket: 17, generation: 30, state: 'completed' });
    expect(generationReads).toEqual([]);
    await expect(awaitFixtureActivationGeneration({
      ticket: 17, timeoutMs: 20, pollIntervalMs: 1, readGeneration: null,
    })).rejects.toThrow('requires a generation reader');
    await expect(awaitFixtureActivationGeneration({
      ticket: 17,
      timeoutMs: 20,
      pollIntervalMs: 1,
      readGeneration: () => ({ ticket: 17, generation: 30, state: 'failed' }),
    })).rejects.toThrow('generation 17 is failed');

    const reads = [
      { ticket: 17, generation: 31, state: 'pending' },
      { ticket: 17, generation: 31, state: 'completed' },
      { ticket: 17, generation: 31, state: 'completed' },
    ];
    let snapshots = 0;
    const proof = await proveFixtureActivationReadiness({
      ticket,
      timeoutMs: 20,
      pollIntervalMs: 1,
      readGeneration: () => reads.shift(),
      takeSnapshot: () => {
        snapshots++;
        return { semantic: 'one-full-snapshot' };
      },
    });
    expect(proof).toEqual({
      generation: { ticket: 17, generation: 31, state: 'completed' },
      snapshot: { semantic: 'one-full-snapshot' },
    });
    expect(reads).toEqual([]);
    expect(snapshots).toBe(1);

    await expect(requestTypedFixtureActivationGeneration(() => 0, 'showcase', 2))
      .rejects.toThrow('invalid presentation generation ticket');
    await expect(proveFixtureActivationReadiness({
      ticket: 17,
      timeoutMs: 1_000,
      pollIntervalMs: 1,
      readGeneration: () => ({ ticket: 17, generation: 32, state: 'failed' }),
      takeSnapshot: () => {
        throw new Error('snapshot must not run');
      },
    })).rejects.toThrow('generation 17 is failed');

    const changed = [
      { ticket: 17, generation: 31, state: 'completed' },
      { ticket: 17, generation: 32, state: 'completed' },
    ];
    await expect(proveFixtureActivationReadiness({
      ticket: 17,
      timeoutMs: 20,
      pollIntervalMs: 1,
      readGeneration: () => changed.shift(),
      takeSnapshot: () => ({ semantic: 'single-snapshot-before-reread' }),
    })).rejects.toThrow('changed after its snapshot');
  });

  it('fails closed when selection-owned OFF/A/B receipt submissions are not contiguous', async () => {
    const { assertContiguousSelectionOwnedReceiptSubmissions } = await import(
      './visual-lab-audit.mjs'
    );
    const selectionOwnedProfile = {
      completion: {
        capability: 'renderer-completed-frame-receipt/v1',
        receiptSchema: 'anifor.renderer.completed-frame-receipt/v1',
        requiredState: 'completed',
        bind: 'selection-owned-presentation',
        verifyAfterSnapshot: true,
      },
    };
    const captures = (submissions) => Object.fromEntries(
      ['off', 'a', 'b'].map((name, index) => [name, {
        completedFrameReceipt: {
          schema: 'anifor.renderer.completed-frame-receipt/v1',
          ticket: index + 1,
          submission: submissions[index],
          state: 'completed',
        },
      }]),
    );

    expect(() => assertContiguousSelectionOwnedReceiptSubmissions(
      captures([41, 42, 43]), selectionOwnedProfile,
    )).not.toThrow();
    expect(() => assertContiguousSelectionOwnedReceiptSubmissions(
      captures([41, 43, 44]), selectionOwnedProfile,
    )).toThrow('must be contiguous in OFF/A/B order; received 41, 43, 44');

    const missing = captures([41, 42, 43]);
    delete missing.a.completedFrameReceipt;
    expect(() => assertContiguousSelectionOwnedReceiptSubmissions(
      missing, selectionOwnedProfile,
    )).toThrow('a selection-owned completed-frame receipt is missing or invalid');

    expect(() => assertContiguousSelectionOwnedReceiptSubmissions(
      {}, { completion: { ...selectionOwnedProfile.completion, bind: 'selected-presentation' } },
    )).not.toThrow();
  });

  it('uses bounded post-attachment navigation only for HTTP(S) capture targets', async () => {
    const {
      beginStagedVisualLabNavigation,
      shouldStageVisualLabNavigation,
    } = await import('./visual-lab-audit.mjs');
    expect(shouldStageVisualLabNavigation('https://example.test/visual-lab?fixture=showcase'))
      .toBe(true);
    expect(shouldStageVisualLabNavigation('http://127.0.0.1:5173/')).toBe(true);
    expect(shouldStageVisualLabNavigation('file:///tmp/anifor/dist/index.html')).toBe(false);

    const calls = [];
    const result = await beginStagedVisualLabNavigation({
      send: (method, params, timeoutMs) => {
        calls.push({ method, params, timeoutMs });
        return Promise.resolve({ frameId: 'frame-1' });
      },
    }, 'https://example.test/visual-lab?fixture=showcase', 12_345);
    expect(result).toEqual({ frameId: 'frame-1' });
    expect(calls).toEqual([{
      method: 'Page.navigate',
      params: { url: 'https://example.test/visual-lab?fixture=showcase' },
      timeoutMs: 12_345,
    }]);
    await expect(beginStagedVisualLabNavigation({
      send: async () => ({ errorText: 'net::ERR_FAILED' }),
    }, 'https://example.test/', 100)).rejects.toThrow('net::ERR_FAILED');
    expect(() => beginStagedVisualLabNavigation({ send: () => Promise.resolve({}) },
      'file:///tmp/anifor/dist/index.html', 100))
      .toThrow('requires an HTTP(S) URL');
  });

  it('keeps the direct framebuffer-alpha digest byte-identical to the legacy grid walk', async () => {
    const {
      digestVisualLabFramebufferAlpha,
      reuseVisualLabFramebufferReadback,
    } = await import('./visual-lab-audit.mjs');
    const rgba = new Uint8Array([
      1, 2, 3, 0,
      4, 5, 6, 255,
      7, 8, 9, 17,
      10, 11, 12, 0,
      13, 14, 15, 128,
      16, 17, 18, 1,
    ]);
    let hash = 2166136261 >>> 0;
    let supportHash = 2166136261 >>> 0;
    let alphaSum = 0;
    let nonzero = 0;
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 3; x++) {
        const index = y * 3 + x;
        const byte = rgba[index * 4 + 3];
        const supported = Number(byte > 0);
        hash = Math.imul((hash ^ byte ^ index) >>> 0, 16777619) >>> 0;
        supportHash = Math.imul((supportHash ^ supported ^ index) >>> 0, 16777619) >>> 0;
        alphaSum += byte;
        nonzero += supported;
      }
    }
    expect(digestVisualLabFramebufferAlpha(rgba)).toEqual({
      hash, supportHash, alphaSum, nonzero,
    });
    expect(reuseVisualLabFramebufferReadback(rgba, rgba.length)).toBe(rgba);
    const resized = reuseVisualLabFramebufferReadback(rgba, rgba.length + 4);
    expect(resized).toBeInstanceOf(Uint8Array);
    expect(resized).not.toBe(rgba);
    expect(resized).toHaveLength(rgba.length + 4);
    expect(reuseVisualLabFramebufferReadback(new Uint8ClampedArray(rgba.length), rgba.length))
      .toBeInstanceOf(Uint8Array);
  });

  it('requires explicit renderer disposal before a successful capture can publish', async () => {
    const { disposeVisualLabCandidatePage } = await import('./visual-lab-audit.mjs');
    const calls = [];
    const pageCdp = {
      send: async (method, params, timeoutMs) => {
        calls.push({ method, params, timeoutMs });
        return { result: { value: true } };
      },
    };

    await expect(disposeVisualLabCandidatePage({ pageCdp, browserErrors: [] }))
      .resolves.toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('Runtime.evaluate');
    expect(calls[0].params.awaitPromise).toBe(true);
    expect(calls[0].params.expression).toContain('disposeRendererForNavigation');
    expect(calls[0].timeoutMs).toBe(5_000);

    const unavailableCdp = {
      send: async () => ({ result: { value: false } }),
    };
    await expect(disposeVisualLabCandidatePage({ pageCdp: unavailableCdp }))
      .rejects.toThrow(/did not acknowledge renderer disposal/);
    await expect(disposeVisualLabCandidatePage({
      pageCdp: unavailableCdp,
      required: false,
    })).resolves.toBe(false);
    await expect(disposeVisualLabCandidatePage({
      pageCdp,
      browserErrors: ['late WebGL failure'],
    })).rejects.toThrow(/through renderer teardown.*late WebGL failure/);
  });

  it('keeps nested capture and teardown diagnostics in bounded CLI errors', async () => {
    const { formatVisualLabCliError } = await import('./visual-lab-audit.mjs');
    const error = new AggregateError([
      new Error('capture sentinel'),
      new AggregateError([
        new Error('renderer sentinel'),
        new Error('host sentinel'),
      ], 'cleanup sentinel'),
    ], 'candidate sentinel');
    const message = formatVisualLabCliError(error);
    expect(message).toContain('candidate sentinel');
    expect(message).toContain('capture sentinel');
    expect(message).toContain('cleanup sentinel');
    expect(message).toContain('renderer sentinel');
    expect(message).toContain('host sentinel');
    expect(message.length).toBeLessThanOrEqual(8_000);
  });

  it('retains the lifecycle handoff when Chrome profile cleanup needs supervisor retry', async () => {
    const { removeVisualLabHostArtifacts } = await import('./visual-lab-audit.mjs');
    const profile = '/tmp/anifor-visual-lab-chrome-test';
    const lifecycleFile = '/tmp/anifor-visual-lab-lifecycle-test.json';
    const failedCalls = [];
    await expect(removeVisualLabHostArtifacts({
      profile,
      lifecycleFile,
      lifecyclePublished: true,
      remove: async (target) => {
        failedCalls.push(target);
        if (target === profile) throw new Error('profile retry sentinel');
      },
    })).rejects.toThrow(/profile retry sentinel/);
    expect(failedCalls).toEqual([profile]);

    const successfulCalls = [];
    await expect(removeVisualLabHostArtifacts({
      profile,
      lifecycleFile,
      lifecyclePublished: true,
      remove: async (target) => { successfulCalls.push(target); },
    })).resolves.toEqual({ profileRemoved: true, lifecycleRemoved: true });
    expect(successfulCalls).toEqual([profile, lifecycleFile]);
  });

  it('rejects unknown drivers, variants, and dynamic audit identifiers', () => {
    expect(() => resolveVisualCaptureDriver('arbitrary')).toThrow('Unknown visual capture driver');
    expect(() => resolveVisualCaptureVariant('normal-hdr', 8)).toThrow('Unknown normal-hdr');
    expect(() => buildVisualCaptureSelectionExpression('normal-hdr', 0, {
      fixtureId: 'showcase', auditIdentifier: 'audit.call()',
    }))
      .toThrow('Unsafe visual capture audit identifier');
    expect(() => buildVisualCaptureDatasetProjectionExpression(
      'normal-hdr', { fixtureId: 'showcase', auditIdentifier: 'audit.call()' },
    )).toThrow('Unsafe visual capture audit identifier');
    expect(runSelection('powder-render-style', 0, {}))
      .toEqual({ ok: false, failure: 'missing-selector' });
  });

  it('rejects missing, unknown, mismatched, open, or unsafe fixture contexts', () => {
    for (const options of [undefined, null, 'showcase', [], {}]) {
      expect(() => buildVisualCaptureSelectionExpression('normal-hdr', 0, options))
        .toThrow(/closed fixture context|must contain fixtureId/);
    }
    expect(() => buildVisualCaptureSelectionExpression('normal-hdr', 0, {
      fixtureId: 'unknown-fixture',
    })).toThrow('Unknown visual capture fixture');
    expect(() => buildVisualCaptureSelectionExpression('normal-hdr', 0, {
      fixtureId: 'powder-style-atlas',
    })).toThrow('does not use driver normal-hdr');
    expect(() => buildVisualCaptureSelectionExpression('powder-render-style', 0, {
      fixtureId: 'showcase',
    })).toThrow('does not use driver powder-render-style');
    expect(() => buildVisualCaptureSelectionExpression('normal-hdr', 0, {
      fixtureId: 'showcase', executable: 'audit.setVisualLabVariant(2)',
    })).toThrow('optional auditIdentifier only');
    expect(buildVisualCaptureSelectionExpression('normal-hdr', 0, {
      fixtureId: 'showcase', auditIdentifier: '$safeAudit',
    })).toContain('$safeAudit.setPreparedVisualCaptureVariant("showcase", 0)');
    expect(() => buildVisualCaptureSelectionExpression('normal-hdr', 0, {
      fixtureId: 'showcase', auditIdentifier: 'audit.call()',
    })).toThrow('Unsafe visual capture audit identifier');

    const getterContext = {};
    Object.defineProperty(getterContext, 'fixtureId', {
      enumerable: true,
      get: () => 'showcase',
    });
    expect(() => buildVisualCaptureSelectionExpression('normal-hdr', 0, getterContext))
      .toThrow('optional auditIdentifier only');
  });
});
