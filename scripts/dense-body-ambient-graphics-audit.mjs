/**
 * Canonical WebGL proof for the optional dense-body ambient fill. The gate
 * deliberately composes existing paused render-lab fixtures instead of adding
 * a second presentation scene: the target atlas supplies deep WATR/METL plus
 * Sand, OXYG, PHOT, thin, and native-wall controls, while the liquid atlas
 * supplies an unlike-liquid seam and an isolated liquid drop.
 */
const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;

export async function auditDenseBodyAmbientGraphics({
  cdp, mode, evaluate, waitFor, waitForStablePageCapture, captureSettledPage,
  waitForNextWebGLPresentation,
  outputScale = 2, screenshotRequest, variantScreenshotPath, writeFile, assert,
}) {
  if (mode !== 'webgl') return { skippedCanvasFallback: true };
  const seedUrl = await evaluate(cdp, 'location.href');
  if (outputScale === 8) {
    return auditTrueEightX({
      cdp, evaluate, waitFor, waitForNextWebGLPresentation, assert, seedUrl,
    });
  }

  const scales = [];
  for (const scale of [1, 2, 4]) {
    const pipeline = await navigateScale({
      cdp, evaluate, waitFor, assert, seedUrl, scale,
    });
    const settleFrame = (label) => waitForNextWebGLPresentation(
      cdp, label, scale === 4 ? 30_000 : 15_000, scale === 4 ? 30_000 : 15_000,
    );
    const settleSource = (label, phase) => scale === 2
      && (phase === 'flat' || phase === 'filled')
      ? captureSettledPage(cdp, label, 0, false, false, false)
      : settleFrame(label);
    const sourceTarget = await captureToggleTriplet({
      cdp, evaluate, waitFor, settle: settleSource, assert, scale,
      prepare: 'prepareSourceTargetGraphicsFixture', schema: sourceTargetSchema,
      powderStyle: 'grains',
    });
    const liquidIdentity = await captureToggleTriplet({
      cdp, evaluate, waitFor, settle: settleFrame, assert, scale,
      prepare: 'prepareLiquidIdentityGraphicsFixture', schema: liquidIdentitySchema,
      powderStyle: 'smooth',
    });

    assertSourceTargetSemantics(sourceTarget.semantic, assert);
    assertLiquidIdentitySemantics(liquidIdentity.semantic, assert);
    const sourceSummary = assertSourceTargetTriplet(sourceTarget, assert, `E80 ${scale}x`);
    const liquidSummary = assertLiquidIdentityTriplet(liquidIdentity, assert, `E80 ${scale}x`);
    const screenshots = scale === 2 ? await writeScreenshots({
      screenshotRequest, variantScreenshotPath, writeFile,
      flat: sourceTarget.captures.flat, filled: sourceTarget.captures.filled,
    }) : undefined;
    scales.push({
      scale, pipeline, sourceTarget: sourceSummary, liquidIdentity: liquidSummary,
      exactRepeatedOff: true, rgbOnly: true, screenshots,
    });
  }
  const crossScale = assertCrossScale(scales, assert);
  return {
    dpr: 1,
    scales,
    crossScale,
    exactRepeatedOff: true,
    rgbOnly: true,
    trueEightXExcluded: false,
  };
}

async function navigateScale({ cdp, evaluate, waitFor, assert, seedUrl, scale }) {
  const url = new URL(seedUrl);
  url.searchParams.set('scene', 'render-lab');
  url.searchParams.set('inputAudit', '1');
  url.searchParams.set('renderLook', 'realistic');
  url.searchParams.set('renderScale', String(scale));
  url.searchParams.set('denseBodyAmbientVfxAudit', '1');
  url.searchParams.set('auditStage', `e80-dense-body-${scale}`);
  await cdp.send('Page.navigate', { url: url.toString() });
  await waitFor(() => evaluate(cdp, `(() => {
    const parameters = new URLSearchParams(location.search);
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    return parameters.get('scene') === 'render-lab'
      && parameters.get('inputAudit') === '1'
      && parameters.get('renderLook') === 'realistic'
      && parameters.get('renderScale') === ${JSON.stringify(String(scale))}
      && parameters.get('denseBodyAmbientVfxAudit') === '1'
      && typeof audit?.setDenseBodyAmbientFill === 'function'
      && typeof audit?.prepareSourceTargetGraphicsFixture === 'function'
      && typeof audit?.prepareLiquidIdentityGraphicsFixture === 'function';
  })()`), scale === 8 ? 45_000 : scale === 4 ? 30_000 : 20_000,
  `E80 ${scale}x audit page`);
  await requireApi(evaluate, cdp);
  const pipeline = await waitFor(async () => {
    const state = await pipelineState(cdp, evaluate);
    return state.backend === 'webgl'
      && state.outputScale === String(scale)
      && state.requestedOutputScale === String(scale)
      && state.width === WORLD_WIDTH * scale
      && state.height === WORLD_HEIGHT * scale
      && state.selector === (scale === 8 ? 'inactive' : 'active')
      ? state : false;
  }, scale === 8 ? 45_000 : scale === 4 ? 30_000 : 20_000,
  `E80 ${scale}x WebGL pipeline`);
  const dpr = await evaluate(cdp, 'window.devicePixelRatio');
  assert(dpr === 1, `Dense-body ambient gate requires WebGL DPR 1 (received ${dpr})`);
  return pipeline;
}

async function auditTrueEightX({
  cdp, evaluate, waitFor, waitForNextWebGLPresentation, assert, seedUrl,
}) {
  const pipeline = await navigateScale({
    cdp, evaluate, waitFor, assert, seedUrl, scale: 8,
  });
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    audit.setPowderRenderStyle('grains');
    audit.setDenseBodyAmbientFill(false);
    audit.prepareSourceTargetGraphicsFixture();
    return true;
  })()`);
  const fixture = await waitForFixture(
    cdp, evaluate, waitFor, sourceTargetSchema, true, 'E80 true-8x source-target', 30_000,
  );
  const fence = await waitForNextWebGLPresentation(
    cdp, 'E80 true-8x source-target framebuffer', 30_000, 30_000,
  );
  const idleRefresh = await waitForPresentationRefreshIdle(cdp, evaluate, waitFor);
  // E80 is deliberately absent from the compact true-8x shader. Read the
  // completed framebuffer before/after both setter calls inside one browser
  // task: an unrelated queued 15M-fragment presentation cannot land between
  // the three samples and masquerade as an E80 response.
  const {
    flat, requested, repeated, requestedPipeline, selectorAfterOn, selectorAfterOff,
    refreshBefore, refreshAfterImmediate,
  } = await sampleTrueEightXNoOpTriplet(cdp, evaluate, sourceTargetSchema);
  const refreshAfterFrames = await presentationRefreshAfterFrames(cdp, evaluate, 4);
  assertSourceTargetSemantics(fixture.semantic, assert);
  assert(flat.probes.every(({ pixels }) => pixels.some((pixel) => (
    pixel[3] > 0 && pixel[0] + pixel[1] + pixel[2] > 0
  ))), 'E80 true-8x framebuffer is blank or does not contain the hydrated fixture');
  const names = new Set(flat.probes.map(({ name }) => name));
  const sourceTarget = assertTriplet(
    flat, requested, repeated, new Set(), names, assert, 'E80 true-8x',
  );
  assert(selectorAfterOn === 'inactive' && selectorAfterOff === 'inactive'
    && requestedPipeline.selector === 'inactive'
    && requestedPipeline.outputScale === '8'
    && requestedPipeline.requestedOutputScale === '8'
    && requestedPipeline.width === WORLD_WIDTH * 8
    && requestedPipeline.height === WORLD_HEIGHT * 8,
  `E80 true-8x selector or backing drifted (${JSON.stringify(requestedPipeline)})`);
  assert(idleRefresh?.sequence === refreshBefore?.sequence
    && refreshBefore?.sequence === refreshAfterImmediate?.sequence
    && refreshBefore?.sequence === refreshAfterFrames?.sequence,
  `E80 true-8x public toggle queued a FieldRenderer presentation (${JSON.stringify({
    idleRefresh, refreshBefore, refreshAfterImmediate, refreshAfterFrames,
  })})`);
  return {
    dpr: 1,
    scales: [{
      scale: 8, pipeline: requestedPipeline, fence, sourceTarget,
      exactRepeatedOff: true, rgbOnly: true,
    }],
    trueEightXExcluded: true,
    exactRequestedOnNoOp: sourceTarget.every(({ peak }) => peak === 0),
    exactRepeatedOff: true,
    rgbOnly: true,
  };
}

async function sampleTrueEightXNoOpTriplet(cdp, evaluate, schema) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const fixture = (${schema.toString()})();
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!fixture?.probes?.length || !canvas || !gl) {
      throw new Error('Dense-body ambient true-8x framebuffer is unavailable');
    }
    const rect = canvas.getBoundingClientRect();
    const readCell = (x, y) => {
      const screen = audit.worldToScreen(x + 0.5, y + 0.5);
      const px = Math.max(0, Math.min(canvas.width - 1,
        Math.floor((screen.x - rect.left) * canvas.width / rect.width)));
      const py = Math.max(0, Math.min(canvas.height - 1,
        canvas.height - 1 - Math.floor((screen.y - rect.top) * canvas.height / rect.height)));
      const pixel = new Uint8Array(4);
      gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return Array.from(pixel);
    };
    const sample = () => ({
      kind: fixture.kind,
      probes: fixture.probes.map(({ name, rect: probe }) => {
        const pixels = [];
        for (let y = probe.y; y < probe.y + probe.height; y++) {
          for (let x = probe.x; x < probe.x + probe.width; x++) pixels.push(readCell(x, y));
        }
        return { name, width: probe.width, height: probe.height, pixels };
      }),
    });
    const state = () => {
      const backend = audit.backend();
      return {
        backend: backend?.backend,
        outputScale: String(backend?.outputScale ?? ''),
        requestedOutputScale: String(backend?.requestedOutputScale ?? ''),
        width: canvas.width,
        height: canvas.height,
        selector: canvas.dataset.denseBodyAmbientFill,
      };
    };
    const flat = sample();
    const refreshBefore = audit.presentationRefreshAudit();
    audit.setDenseBodyAmbientFill(true);
    const selectorAfterOn = canvas.dataset.denseBodyAmbientFill;
    const requestedPipeline = state();
    const requested = sample();
    audit.setDenseBodyAmbientFill(false);
    const selectorAfterOff = canvas.dataset.denseBodyAmbientFill;
    const repeated = sample();
    const refreshAfterImmediate = audit.presentationRefreshAudit();
    return {
      flat, requested, repeated, requestedPipeline, selectorAfterOn, selectorAfterOff,
      refreshBefore, refreshAfterImmediate,
    };
  })()`);
}

async function waitForPresentationRefreshIdle(cdp, evaluate, waitFor) {
  return waitFor(() => evaluate(cdp, `new Promise((resolve) => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const before = audit.presentationRefreshAudit();
    let remaining = 4;
    const frame = () => {
      if (--remaining > 0) return requestAnimationFrame(frame);
      const after = audit.presentationRefreshAudit();
      resolve(before && after && before.sequence === after.sequence ? after : false);
    };
    requestAnimationFrame(frame);
  })`, 15_000), 30_000, 'E80 true-8x idle FieldRenderer window');
}

async function presentationRefreshAfterFrames(cdp, evaluate, count) {
  return evaluate(cdp, `new Promise((resolve) => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    let remaining = ${count};
    const frame = () => {
      if (--remaining > 0) return requestAnimationFrame(frame);
      resolve(audit.presentationRefreshAudit());
    };
    requestAnimationFrame(frame);
  })`, 15_000);
}

async function pipelineState(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const backend = audit?.backend?.();
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    return {
      backend: backend?.backend,
      outputScale: String(backend?.outputScale ?? ''),
      requestedOutputScale: String(backend?.requestedOutputScale ?? ''),
      width: canvas?.width,
      height: canvas?.height,
      selector: canvas?.dataset.denseBodyAmbientFill,
    };
  })()`);
}

async function requireApi(evaluate, cdp) {
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const required = [
      'setDenseBodyAmbientFill', 'setPowderRenderStyle',
      'prepareSourceTargetGraphicsFixture', 'sourceTargetGraphicsAtlas',
      'prepareLiquidIdentityGraphicsFixture', 'liquidIdentityGraphicsAtlas',
    ];
    if (!audit || required.some((name) => typeof audit[name] !== 'function')) {
      throw new Error('Dense-body ambient graphics audit API unavailable');
    }
    audit.resetView();
    return true;
  })()`);
}

async function captureToggleTriplet({
  cdp, evaluate, waitFor, settle, assert, scale, prepare, schema, powderStyle,
}) {
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    audit.setPowderRenderStyle(${JSON.stringify(powderStyle)});
    audit.setDenseBodyAmbientFill(false);
    audit.${prepare}();
    return true;
  })()`);
  const fixture = await waitForFixture(
    cdp, evaluate, waitFor, schema, true, `E80 ${scale}x ${schema.name}`,
    scale === 4 ? 30_000 : 20_000,
  );
  await waitForSelector(cdp, evaluate, waitFor, 'inactive', scale);
  const flatCapture = await settle(`flat E80 ${scale}x ${fixture.kind} fixture`, 'flat');
  const flat = await sampleFixture(cdp, evaluate, waitFor, schema);
  await evaluate(cdp, 'window.__ANIFOR_INPUT_AUDIT__.setDenseBodyAmbientFill(true); true;');
  await waitForSelector(cdp, evaluate, waitFor, 'active', scale);
  const filledCapture = await settle(`filled E80 ${scale}x ${fixture.kind} fixture`, 'filled');
  const filled = await sampleFixture(cdp, evaluate, waitFor, schema);
  await evaluate(cdp, 'window.__ANIFOR_INPUT_AUDIT__.setDenseBodyAmbientFill(false); true;');
  await waitForSelector(cdp, evaluate, waitFor, 'inactive', scale);
  const repeatedCapture = await settle(
    `repeated flat E80 ${scale}x ${fixture.kind} fixture`, 'repeated',
  );
  const repeated = await sampleFixture(cdp, evaluate, waitFor, schema);
  const pipeline = await pipelineState(cdp, evaluate);
  assert(pipeline.outputScale === String(scale) && pipeline.selector === 'inactive',
    `E80 ${scale}x selector did not return inactive (${JSON.stringify(pipeline)})`);
  return {
    ...fixture, flat, filled, repeated,
    captures: { flat: flatCapture, filled: filledCapture, repeated: repeatedCapture },
  };
}

async function waitForSelector(cdp, evaluate, waitFor, selector, scale) {
  return waitFor(async () => {
    const state = await pipelineState(cdp, evaluate);
    return state.backend === 'webgl' && state.outputScale === String(scale)
      && state.selector === selector ? state : false;
  }, scale === 4 ? 30_000 : 20_000, `E80 ${scale}x ${selector} selector`);
}

async function waitForFixture(
  cdp, evaluate, waitFor, schema, requireReady = false, label = schema.name,
  timeoutMs = 15_000,
) {
  return waitFor(async () => {
    const fixture = await evaluate(cdp, `(${schema.toString()})()`);
    if (!fixture?.probes?.length) return false;
    if (requireReady && fixture.ready !== true) {
      throw new Error(`not hydrated: ${JSON.stringify(fixture.semantic)}`);
    }
    return fixture;
  }, timeoutMs, `dense-body ambient ${label} fixture`);
}

function sourceTargetSchema() {
  const audit = window.__ANIFOR_INPUT_AUDIT__;
  const cards = audit.sourceTargetGraphicsAtlas()?.cards;
  if (!Array.isArray(cards) || cards.length !== 42) return false;
  const card = (code) => cards.find((entry) => entry.targetCode === code);
  const water = card('WATR');
  const metal = card('METL');
  const sand = card('SAND');
  const gas = card('OXYG');
  const energy = card('PHOT');
  if (![water, metal, sand, gas, energy].every(Boolean)) return false;
  const inner = (rect, inset = 3) => ({
    x: rect.x + inset, y: rect.y + inset,
    width: Math.max(1, rect.width - inset * 2), height: Math.max(1, rect.height - inset * 2),
  });
  const waterProbe = {
    x: water.targetControl.x + Math.floor(water.targetControl.width / 2),
    y: water.targetControl.y + Math.floor(water.targetControl.height / 2),
  };
  const metalProbe = {
    x: metal.targetControl.x + Math.floor(metal.targetControl.width / 2),
    y: metal.targetControl.y + Math.floor(metal.targetControl.height / 2),
  };
  const sandProbe = {
    x: sand.targetControl.x + Math.floor(sand.targetControl.width / 2),
    y: sand.targetControl.y + Math.floor(sand.targetControl.height / 2),
  };
  const gasProbe = {
    x: gas.targetControl.x + Math.floor(gas.targetControl.width / 2),
    y: gas.targetControl.y + Math.floor(gas.targetControl.height / 2),
  };
  const energyProbe = {
    x: energy.targetControl.x + Math.floor(energy.targetControl.width / 2),
    y: energy.targetControl.y + Math.floor(energy.targetControl.height / 2),
  };
  const waterAuxiliary = audit.presentationAuxiliary(waterProbe.x, waterProbe.y);
  const metalAuxiliary = audit.presentationAuxiliary(metalProbe.x, metalProbe.y);
  const sandAuxiliary = audit.presentationAuxiliary(sandProbe.x, sandProbe.y);
  const atmosphereAlpha = audit.atmosphereFieldAlpha(gasProbe.x, gasProbe.y);
  const emissionAlpha = audit.emissionFieldAlpha(energyProbe.x, energyProbe.y);
  return {
    kind: 'source-target',
    // Sand is deliberately sampled in Grains mode, where its discrete
    // presentation is independent of the temporal Smooth stability byte.
    ready: waterAuxiliary > 6 && metalAuxiliary > 6
      && atmosphereAlpha > 0 && emissionAlpha > 0,
    semantic: {
      water: {
        material: audit.cell(water.targetControl.x, water.targetControl.y),
        code: water.targetCode, auxiliary: waterAuxiliary,
      },
      metal: {
        material: audit.cell(metal.targetControl.x, metal.targetControl.y),
        code: metal.targetCode, auxiliary: metalAuxiliary,
      },
      sand: {
        material: audit.cell(sand.targetControl.x, sand.targetControl.y),
        code: sand.targetCode, auxiliary: sandAuxiliary,
      },
      gas: {
        material: audit.cell(gas.targetControl.x, gas.targetControl.y),
        code: gas.targetCode, fieldAlpha: atmosphereAlpha,
      },
      energy: {
        material: audit.cell(energy.targetControl.x, energy.targetControl.y),
        code: energy.targetCode, fieldAlpha: emissionAlpha,
      },
      thin: { material: audit.cell(water.thinStructure.x, water.thinStructure.y) },
      wall: {
        material: audit.cell(water.wallCoexistence.x, water.wallCoexistence.y),
        wall: audit.wall(water.wallCoexistence.x, water.wallCoexistence.y),
      },
    },
    probes: [
      { name: 'deep-water', rect: inner(water.targetControl) },
      // A genuine air-facing semantic Water cell; ambient fill must not make a shore glow.
      { name: 'water-shore', rect: { x: water.targetControl.x, y: water.targetControl.y, width: 1, height: 1 } },
      { name: 'deep-metal', rect: inner(metal.targetControl) },
      { name: 'granular-sand', rect: inner(sand.targetControl) },
      { name: 'gas', rect: inner(gas.targetControl) },
      { name: 'energy', rect: inner(energy.targetControl) },
      { name: 'thin', rect: { ...water.thinStructure } },
      { name: 'native-wall', rect: { ...water.wallCoexistence } },
    ],
  };
}

function liquidIdentitySchema() {
  const audit = window.__ANIFOR_INPUT_AUDIT__;
  const cards = audit.liquidIdentityGraphicsAtlas()?.cards;
  if (!Array.isArray(cards) || cards.length !== 16) return false;
  const entry = cards[0];
  if (!entry?.liquidContact?.unlike || !entry?.isolated) return false;
  const seamFieldAlpha = audit.liquidFieldAlpha(
    entry.liquidContact.unlike.x + Math.floor(entry.liquidContact.unlike.width / 2),
    entry.liquidContact.unlike.y + Math.floor(entry.liquidContact.unlike.height / 2),
  );
  return {
    kind: 'liquid-identity',
    ready: seamFieldAlpha > 0,
    semantic: {
      seam: {
        material: audit.cell(entry.liquidContact.unlike.x, entry.liquidContact.unlike.y),
        fieldAlpha: seamFieldAlpha,
      },
      isolated: { material: audit.cell(entry.isolated.x, entry.isolated.y) },
    },
    probes: [
      // Sample only the Water-side interface band. The remote interior of this
      // eight-cell block is a legitimate dense ambient target, not seam proof.
      {
        name: 'unlike-liquid-seam',
        rect: {
          x: entry.liquidContact.unlike.x,
          y: entry.liquidContact.unlike.y,
          width: 1,
          height: entry.liquidContact.unlike.height,
        },
      },
      { name: 'isolated-liquid', rect: { x: entry.isolated.x, y: entry.isolated.y, width: 1, height: 1 } },
    ],
  };
}

async function sampleFixture(cdp, evaluate, waitFor, schema) {
  const fixture = await waitForFixture(cdp, evaluate, waitFor, schema);
  return evaluate(cdp, `(() => {
    const fixture = (${schema.toString()})();
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!canvas || !gl) throw new Error('Dense-body ambient WebGL backing unavailable');
    const rect = canvas.getBoundingClientRect();
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const readCell = (x, y) => {
      const screen = audit.worldToScreen(x + 0.5, y + 0.5);
      const px = Math.max(0, Math.min(canvas.width - 1,
        Math.floor((screen.x - rect.left) * canvas.width / rect.width)));
      const py = Math.max(0, Math.min(canvas.height - 1,
        canvas.height - 1 - Math.floor((screen.y - rect.top) * canvas.height / rect.height)));
      const pixel = new Uint8Array(4);
      gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return Array.from(pixel);
    };
    return {
      kind: fixture.kind,
      probes: fixture.probes.map(({ name, rect: probe }) => {
        const pixels = [];
        for (let y = probe.y; y < probe.y + probe.height; y++) {
          for (let x = probe.x; x < probe.x + probe.width; x++) pixels.push(readCell(x, y));
        }
        return { name, width: probe.width, height: probe.height, pixels };
      }),
    };
  })()`);
}

function assertSourceTargetSemantics(semantic, assert) {
  assert(semantic.water.code === 'WATR' && semantic.water.material > 0,
    `Dense ambient fixture lost Water (${JSON.stringify(semantic)})`);
  assert(semantic.metal.code === 'METL' && semantic.metal.material > 0,
    `Dense ambient fixture lost Metal (${JSON.stringify(semantic)})`);
  assert(semantic.sand.code === 'SAND' && semantic.sand.material > 0,
    `Dense ambient fixture lost Sand (${JSON.stringify(semantic)})`);
  assert(semantic.gas.code === 'OXYG' && semantic.gas.material > 0,
    `Dense ambient fixture lost gas (${JSON.stringify(semantic)})`);
  assert(semantic.energy.code === 'PHOT' && semantic.energy.material > 0,
    `Dense ambient fixture lost energy (${JSON.stringify(semantic)})`);
  assert(semantic.thin.material > 0 && semantic.wall.material > 0 && semantic.wall.wall > 0,
    `Dense ambient fixture lost thin/wall separation (${JSON.stringify(semantic)})`);
}

function assertLiquidIdentitySemantics(semantic, assert) {
  assert(semantic.seam.material > 0 && semantic.isolated.material > 0,
    `Dense ambient liquid controls lost semantic ownership (${JSON.stringify(semantic)})`);
}

function assertSourceTargetTriplet({ flat, filled, repeated }, assert, label) {
  const expectedLift = new Set(['deep-water', 'deep-metal']);
  const controls = new Set([
    'water-shore', 'granular-sand', 'gas', 'energy', 'thin', 'native-wall',
  ]);
  return assertTriplet(flat, filled, repeated, expectedLift, controls, assert, label);
}

function assertLiquidIdentityTriplet({ flat, filled, repeated }, assert, label) {
  return assertTriplet(
    flat, filled, repeated, new Set(), new Set(['unlike-liquid-seam', 'isolated-liquid']),
    assert, label,
  );
}

function assertTriplet(flat, filled, repeated, expectedLift, exactControls, assert, label) {
  const prefix = label ? `${label} ` : '';
  assert(flat.kind === filled.kind && flat.kind === repeated.kind,
    `${prefix}dense ambient fixture changed between capture phases`);
  assert(flat.probes.length === filled.probes.length && flat.probes.length === repeated.probes.length,
    `${prefix}dense ambient capture geometry changed`);
  const summary = [];
  for (let index = 0; index < flat.probes.length; index++) {
    const base = flat.probes[index];
    const styled = filled.probes[index];
    const returned = repeated.probes[index];
    assert(base.name === styled.name && base.name === returned.name
      && base.width === styled.width && base.width === returned.width
      && base.height === styled.height && base.height === returned.height,
    `${prefix}dense ambient probe geometry drifted at index ${index}`);
    assert(equalPixels(base.pixels, returned.pixels),
      `${prefix}dense ambient ${base.name}: off→on→off is not exact`);
    assert(equalAlphaAndSupport(base.pixels, styled.pixels),
      `${prefix}dense ambient ${base.name}: alpha or support changed`);
    const response = rgbResponse(base.pixels, styled.pixels);
    if (expectedLift.has(base.name)) {
      assert(response.peak >= 1 && response.peak <= 5 && response.mean > 0
        && response.signedMin >= 0 && response.lumaMean > 0 && response.coverage > 0
        && response.chromaPeak <= 0.015,
      `${prefix}dense ambient ${base.name}: lift is missing, non-monotone, hue-shifting, or unbounded (${JSON.stringify(response)})`);
    } else if (exactControls.has(base.name)) {
      assert(response.peak === 0,
        `${prefix}dense ambient ${base.name}: protected control changed (${JSON.stringify(response)})`);
    } else {
      assert(response.peak === 0,
        `${prefix}dense ambient ${base.name}: unexpected material changed (${JSON.stringify(response)})`);
    }
    summary.push({ name: base.name, ...response });
  }
  return summary;
}

function equalPixels(left, right) {
  return left.length === right.length && left.every((pixel, index) => (
    pixel.length === right[index].length && pixel.every((value, channel) => value === right[index][channel])
  ));
}

function equalAlphaAndSupport(left, right) {
  return left.length === right.length && left.every((pixel, index) => (
    pixel[3] === right[index][3] && (pixel[3] > 0) === (right[index][3] > 0)
  ));
}

function rgbResponse(base, styled) {
  let peak = 0;
  let sum = 0;
  let samples = 0;
  let signedMin = Infinity;
  let signedMax = -Infinity;
  let luma = 0;
  let changed = 0;
  let chromaSquared = 0;
  let chromaPeak = 0;
  let chromaSamples = 0;
  for (let index = 0; index < base.length; index++) {
    let sampleChanged = false;
    const deltas = [0, 0, 0];
    for (let channel = 0; channel < 3; channel++) {
      const delta = styled[index][channel] - base[index][channel];
      deltas[channel] = delta;
      peak = Math.max(peak, Math.abs(delta));
      sum += Math.abs(delta);
      signedMin = Math.min(signedMin, delta);
      signedMax = Math.max(signedMax, delta);
      sampleChanged ||= delta !== 0;
      samples++;
    }
    changed += Number(sampleChanged);
    luma += deltas[0] * 0.2126 + deltas[1] * 0.7152 + deltas[2] * 0.0722;
    const baseSum = base[index][0] + base[index][1] + base[index][2];
    const styledSum = styled[index][0] + styled[index][1] + styled[index][2];
    if (baseSum > 0 && styledSum > 0) {
      for (let channel = 0; channel < 3; channel++) {
        const delta = styled[index][channel] / styledSum - base[index][channel] / baseSum;
        chromaSquared += delta * delta;
        chromaPeak = Math.max(chromaPeak, Math.abs(delta));
        chromaSamples++;
      }
    }
  }
  return {
    peak,
    mean: round(sum / Math.max(1, samples)),
    signedMin: Number.isFinite(signedMin) ? signedMin : 0,
    signedMax: Number.isFinite(signedMax) ? signedMax : 0,
    lumaMean: round(luma / Math.max(1, base.length)),
    coverage: round(changed / Math.max(1, base.length)),
    chromaRms: round(Math.sqrt(chromaSquared / Math.max(1, chromaSamples))),
    chromaPeak: round(chromaPeak),
  };
}

function assertCrossScale(scales, assert) {
  const targets = ['deep-water', 'deep-metal'].map((name) => ({
    name,
    responses: scales.map(({ scale, sourceTarget }) => ({
      scale, ...sourceTarget.find((entry) => entry.name === name),
    })),
  }));
  for (const target of targets) {
    const means = target.responses.map(({ mean }) => mean);
    const peaks = target.responses.map(({ peak }) => peak);
    const luma = target.responses.map(({ lumaMean }) => lumaMean);
    assert(target.responses.every(({ peak, signedMin, chromaPeak }) => (
      peak >= 1 && peak <= 5 && signedMin >= 0 && chromaPeak <= 0.015
    )) && spread(means) <= 0.75 && spread(peaks) <= 2 && spread(luma) <= 0.75,
    `E80 ${target.name} response drifted across normal scales (${JSON.stringify(target)})`);
  }
  return targets;
}

async function writeScreenshots({
  screenshotRequest, variantScreenshotPath, writeFile, flat, filled,
}) {
  if (!screenshotRequest || typeof variantScreenshotPath !== 'function'
    || typeof writeFile !== 'function') return undefined;
  const paths = {
    off: variantScreenshotPath(screenshotRequest, 'e80-dense-body-2x-off'),
    on: variantScreenshotPath(screenshotRequest, 'e80-dense-body-2x-on'),
  };
  await writeFile(paths.off, Buffer.from(flat.capture.data, 'base64'));
  await writeFile(paths.on, Buffer.from(filled.capture.data, 'base64'));
  return paths;
}

function spread(values) { return Math.max(...values) - Math.min(...values); }
function round(value) { return Number(value.toFixed(4)); }
