const EMPTY = 0;
const WATER = 2;
const METAL = 23;
const GLASS = 24;
const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;

const EXPECTED = Object.freeze([
  { key: 'red', spectrum: [12, 0, 0], state: 0x800c, dominant: 0 },
  { key: 'green', spectrum: [0, 12, 0], state: 0x80c0, dominant: 1 },
  { key: 'blue', spectrum: [0, 0, 12], state: 0x8c00, dominant: 2 },
  // The native violet word intentionally keeps blue dominant, then red.
  { key: 'violet', spectrum: [9, 2, 12], state: 0x8c29, dominant: 2, secondary: 0 },
]);

/**
 * Focused E81-style proof for an optional PHOT-over-Metal irradiance layer.
 *
 * The native PHOT word is part of the fixture, never the A/B selector: every
 * normal variant prepares the exact same independent photon plane, then only
 * `setPhotonMetalIrradianceVfx()` changes presentation.  Direct 8x keeps the
 * compact PHOT projection but deliberately excludes this optional layer.
 */
export async function auditPhotonMetalIrradianceVfx({
  cdp, mode, evaluate, waitFor, waitForStablePageCapture, captureSettledPage,
  waitForNextWebGLPresentation, outputScale = 2,
  screenshotRequest, variantScreenshotPath, writeFile,
  sampleBackdropRefractionRegions, assert,
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
    const captures = {};
    for (const enabled of [false, true, false]) {
      const key = enabled ? 'enabled' : captures.disabled ? 'disabledRepeat' : 'disabled';
      captures[key] = await navigateAndCapture({
        cdp, evaluate, waitFor, waitForStablePageCapture, captureSettledPage,
        waitForNextWebGLPresentation, seedUrl, scale, enabled, label: `E81 ${key}`,
      });
    }
    const { disabled, enabled, disabledRepeat } = captures;
    assert(equal(disabled.fixture, enabled.fixture) && equal(disabled.fixture, disabledRepeat.fixture),
      `E81 ${scale}x fixture metadata changed across the selector triplet`);
    assert(equal(disabled.semantic, enabled.semantic) && equal(disabled.semantic, disabledRepeat.semantic),
      `E81 ${scale}x selector changed matter, PHOT, wall, or owner state`);
    assertPipeline(disabled.pipeline, scale, 'inactive', assert, `E81 ${scale}x off`);
    assertPipeline(enabled.pipeline, scale, 'active', assert, `E81 ${scale}x on`);
    assertPipeline(disabledRepeat.pipeline, scale, 'inactive', assert, `E81 ${scale}x repeated off`);

    if (typeof sampleBackdropRefractionRegions !== 'function') {
      throw new Error('E81 normal WebGL requires the compositor screenshot-region sampler');
    }
    const sampled = await sampleBackdropRefractionRegions(cdp, {
      straight: disabled.capture.capture.data,
      refracted: enabled.capture.capture.data,
      repeatedStraight: disabledRepeat.capture.capture.data,
    }, screenshotRegions(disabled.fixture), disabled.capture.canvasRect);
    const byName = new Map(sampled.map((entry) => [entry.name, entry]));
    const cards = disabled.fixture.cards.map((card) => {
      const regions = Object.fromEntries(BODY_REGION_KEYS.map((name) => {
        const response = byName.get(`${card.key}:${name}`);
        assert(response, `E81 ${scale}x ${card.key} omitted ${name} response evidence`);
        return [name, responseMetricsFromScreenshot(response)];
      }));
      const combined = combineResponse(Object.values(regions));
      assert(combined.rgbRms >= 1.8 && combined.rgbRms <= 3.3
        && combined.rgbPeak >= 4 && combined.rgbPeak <= 6
        && combined.coverage <= 1 && combined.repeatRgbPeak === 0,
      `E81 ${scale}x ${card.key} Metal irradiance is inert, unbounded, or unstable (${JSON.stringify(combined)})`);
      assertSpectrumOrder(card.key, combined.channelMean, assert, `E81 ${scale}x`);
      const controls = Object.fromEntries(CONTROL_KEYS.map((control) => {
        const response = byName.get(`${card.key}:${control}`);
        assert(response && response.rgbPeak === 0 && response.repeatRgbPeak === 0,
          `E81 ${scale}x ${card.key} changed protected ${control} (${JSON.stringify(response)})`);
        return [control, responseMetricsFromScreenshot(response)];
      }));
      return {
        key: card.key, spectrum: card.spectrum, state: card.state,
        regions, combined, controls,
      };
    });
    const screenshots = scale === 2 ? await writeScreenshots({
      screenshotRequest, variantScreenshotPath, writeFile, disabled, enabled,
    }) : undefined;
    scales.push({
      scale,
      backing: `${enabled.pipeline.width}x${enabled.pipeline.height}`,
      selector: enabled.pipeline.selector,
      cards,
      exactSemanticPhotonWallTopology: true,
      semanticSupportHeldConstant: true,
      rgbOnlyShaderContract: true,
      exactHoleNotchThinIsolatedAbsentWaterGlassWallBlank: true,
      exactRepeatedOff: cards.every(({ combined }) => combined.repeatRgbPeak === 0),
      screenshots,
    });
  }
  const crossScale = assertCrossScale(scales, assert);
  return {
    dpr: 1,
    scales,
    crossScale,
    exactRepeatedOff: true,
    rgbOnly: true,
    photonStateHeldConstant: true,
    trueEightXExcluded: false,
  };
}

async function navigateAndCapture({
  cdp, evaluate, waitFor, waitForStablePageCapture, captureSettledPage,
  waitForNextWebGLPresentation, seedUrl, scale, enabled, label,
}) {
  const url = new URL(seedUrl);
  url.searchParams.set('scene', 'render-lab');
  url.searchParams.set('inputAudit', '1');
  url.searchParams.set('renderLook', 'realistic');
  url.searchParams.set('renderScale', String(scale));
  url.searchParams.set('photonMetalIrradianceVfx', enabled ? '1' : '0');
  url.searchParams.set('photonMetalIrradianceVfxAudit', '1');
  url.searchParams.set('auditStage', `e81-photon-metal-${scale}-${enabled ? 'on' : 'off'}`);
  await cdp.send('Page.navigate', { url: url.toString() });
  await waitFor(() => evaluate(cdp, `(() => {
    const p = new URLSearchParams(location.search); const audit = window.__ANIFOR_INPUT_AUDIT__;
    return p.get('scene') === 'render-lab' && p.get('inputAudit') === '1'
      && p.get('renderLook') === 'realistic'
      && p.get('renderScale') === ${JSON.stringify(String(scale))}
      && p.get('photonMetalIrradianceVfx') === ${JSON.stringify(enabled ? '1' : '0')}
      && p.get('photonMetalIrradianceVfxAudit') === '1'
      && typeof audit?.preparePhotonSpectrumGraphicsFixture === 'function'
      && typeof audit?.photonSpectrumGraphicsAtlas === 'function'
      && typeof audit?.setPhotonMetalIrradianceVfx === 'function';
  })()`), scale === 4 ? 45_000 : 20_000, `${label} ${scale}x page`);
  await prepareFixture(cdp, evaluate, enabled);
  const fixture = await waitForFixture(cdp, evaluate, waitFor, scale, `${label} ${scale}x`);
  const pipeline = await waitFor(async () => {
    const state = await pipelineState(cdp, evaluate);
    return state.backend === 'webgl' && state.look === 'realistic'
      && state.outputScale === String(scale) && state.requestedOutputScale === String(scale)
      && state.width === WORLD_WIDTH * scale && state.height === WORLD_HEIGHT * scale
      && state.selector === (enabled ? 'active' : 'inactive') ? state : false;
  }, scale === 4 ? 45_000 : 20_000, `${label} ${scale}x WebGL irradiance selector`);
  const dpr = await evaluate(cdp, 'window.devicePixelRatio');
  if (dpr !== 1) throw new Error(`E81 ${scale}x requires DPR 1 (received ${dpr})`);
  const capture = await settle({
    cdp, label: `${label} ${scale}x photon-metal framebuffer`, scale,
    waitForStablePageCapture, captureSettledPage, waitForNextWebGLPresentation,
  });
  return { fixture, semantic: await semanticSnapshot(cdp, evaluate), pipeline, capture };
}

async function prepareFixture(cdp, evaluate, enabled) {
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    audit.resetView();
    audit.setPhotonMetalIrradianceVfx(false);
    audit.preparePhotonSpectrumGraphicsFixture();
    for (const node of document.querySelectorAll('.field-indicator')) {
      node.style.visibility = 'hidden';
    }
    // The fixture always retains all four independent PHOT words.  This setter
    // is deliberately presentation-only and must never use the legacy
    // setPhotonSpectrumGraphicsVisible() data-plane mutator.
    audit.setPhotonMetalIrradianceVfx(${enabled});
    return true;
  })()`);
}

async function settle({
  cdp, label, scale, waitForStablePageCapture, captureSettledPage, waitForNextWebGLPresentation,
}) {
  if (typeof waitForNextWebGLPresentation === 'function') {
    const fence = await waitForNextWebGLPresentation(cdp, label, scale === 4 ? 30_000 : 15_000,
      scale === 4 ? 30_000 : 15_000);
    // Normal WebGL resolves through the HDR compositor, so direct reads from
    // the semantic WebGL backing are not visible-output evidence. Fence the
    // semantic presentation first, then capture the composed page at every
    // scale; only the 2x diagnostic is persisted to disk.
    if (typeof captureSettledPage !== 'function') return { fence };
    return captureSettledPage(
      cdp, label, 0, true, false, false, scale === 4 ? 60_000 : 30_000,
    );
  }
  // Compatibility fallback for callers that have not yet supplied the real
  // WebGL presentation fence helper.
  return waitForStablePageCapture(cdp, label, scale === 4 ? 30_000 : undefined, 1);
}

async function auditTrueEightX({
  cdp, evaluate, waitFor, waitForNextWebGLPresentation, assert, seedUrl,
}) {
  const url = new URL(seedUrl);
  url.searchParams.set('scene', 'render-lab');
  url.searchParams.set('inputAudit', '1');
  url.searchParams.set('renderLook', 'realistic');
  url.searchParams.set('renderScale', '8');
  url.searchParams.set('photonMetalIrradianceVfx', '1');
  url.searchParams.set('photonMetalIrradianceVfxAudit', '1');
  url.searchParams.set('auditStage', 'e81-photon-metal-8-on');
  await cdp.send('Page.navigate', { url: url.toString() });
  await waitFor(() => evaluate(cdp, `(() => {
    const p = new URLSearchParams(location.search); const audit = window.__ANIFOR_INPUT_AUDIT__;
    return p.get('renderScale') === '8' && p.get('photonMetalIrradianceVfx') === '1'
      && p.get('photonMetalIrradianceVfxAudit') === '1'
      && typeof audit?.preparePhotonSpectrumGraphicsFixture === 'function'
      && typeof audit?.setPhotonMetalIrradianceVfx === 'function';
  })()`), 45_000, 'E81 true-8x page');
  await prepareFixture(cdp, evaluate, true);
  const fixture = await waitForFixture(cdp, evaluate, waitFor, 8, 'E81 true-8x');
  const pipeline = await waitFor(async () => {
    const state = await pipelineState(cdp, evaluate);
    return state.backend === 'webgl' && state.look === 'realistic'
      && state.outputScale === '8' && state.requestedOutputScale === '8'
      && state.width === WORLD_WIDTH * 8 && state.height === WORLD_HEIGHT * 8
      && state.selector === 'inactive' ? state : false;
  }, 45_000, 'E81 true-8x inactive selector/backing');
  const dpr = await evaluate(cdp, 'window.devicePixelRatio');
  assert(dpr === 1, `E81 true-8x requires DPR 1 (received ${dpr})`);
  if (typeof waitForNextWebGLPresentation !== 'function') {
    throw new Error('E81 true-8x requires a real waitForNextWebGLPresentation fence helper');
  }
  const fence = await waitForNextWebGLPresentation(
    cdp, 'E81 true-8x hydrated PHOT framebuffer', 30_000, 30_000,
  );
  const idle = await waitForPresentationRefreshIdle(cdp, evaluate, waitFor);
  const triplet = await atomicTrueEightXTriplet(cdp, evaluate);
  const afterFrames = await presentationRefreshAfterFrames(cdp, evaluate, 4);
  assertFixtureSnapshot(fixture, assert, 'E81 true-8x');
  assert(equal(triplet.semanticBefore, triplet.semanticAfter),
    `E81 true-8x selector changed semantic/PHOT/wall topology (${JSON.stringify(triplet)})`);
  assert(equal(triplet.flat, triplet.requested) && equal(triplet.flat, triplet.repeated),
    'E81 true-8x requested-on selector changed the completed framebuffer');
  assert(triplet.pipeline.selector === 'inactive'
    && triplet.selectorAfterOn === 'inactive' && triplet.selectorAfterOff === 'inactive'
    && triplet.pipeline.outputScale === '8' && triplet.pipeline.requestedOutputScale === '8'
    && triplet.pipeline.width === WORLD_WIDTH * 8 && triplet.pipeline.height === WORLD_HEIGHT * 8,
  `E81 true-8x selector/backing drifted (${JSON.stringify(triplet.pipeline)})`);
  assert(idle?.sequence === triplet.refreshBefore?.sequence
    && triplet.refreshBefore?.sequence === triplet.refreshAfterImmediate?.sequence
    && triplet.refreshBefore?.sequence === afterFrames?.sequence,
  `E81 true-8x irradiance setter queued a FieldRenderer refresh (${JSON.stringify({
    idle, before: triplet.refreshBefore, immediate: triplet.refreshAfterImmediate, afterFrames,
  })})`);
  return {
    dpr: 1,
    scales: [{ scale: 8, pipeline, fence, exactRequestedOnNoOp: true, exactRepeatedOff: true }],
    trueEightXExcluded: true,
    exactRequestedOnNoOp: true,
    exactRepeatedOff: true,
    rgbOnly: true,
    photonStateHeldConstant: true,
  };
}

async function atomicTrueEightXTriplet(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!canvas || !gl) throw new Error('E81 true-8x WebGL backing unavailable');
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const atlas = audit.photonSpectrumGraphicsAtlas();
    const inRect = (x, y, area) => x >= area.x && x < area.x + area.width && y >= area.y && y < area.y + area.height;
    const read = (x, y) => {
      // Camera transforms are CSS-only; the direct semantic mesh always maps
      // world cells onto the full backing. Sample that invariant backing space
      // directly so a fitted/panned DOM rect cannot fabricate blank evidence.
      const px = Math.max(0, Math.min(canvas.width - 1,
        Math.floor((x + 0.5) * canvas.width / ${WORLD_WIDTH})));
      const py = Math.max(0, Math.min(canvas.height - 1,
        canvas.height - 1 - Math.floor((y + 0.5) * canvas.height / ${WORLD_HEIGHT})));
      const pixel = new Uint8Array(4); gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); return [...pixel];
    };
    const areas = (entry) => ({
      crown: { x: entry.body.x + 9, y: entry.body.y + 9, width: 16, height: 14 },
      core: { x: entry.body.x + 44, y: entry.body.y + 10, width: 14, height: 14 },
      pocket: { x: entry.body.x + 10, y: entry.body.y + 42, width: 16, height: 12 },
      hole: entry.authoredHole, notch: entry.openNotch, thin: entry.thinStructure,
      isolated: { ...entry.isolated, width: 1, height: 1 }, absent: entry.absentState,
      water: entry.waterCoexistence, glass: entry.glassCoexistence, wall: entry.wallCoexistence,
      blank: entry.guardedBlank,
    });
    const pixels = (area) => { const result = []; for (let y = area.y; y < area.y + area.height; y += Math.max(1, Math.floor(area.height / 5))) for (let x = area.x; x < area.x + area.width; x += Math.max(1, Math.floor(area.width / 5))) result.push(read(x, y)); return result; };
    const sample = () => atlas.cards.map((entry) => ({ key: entry.key, ...Object.fromEntries(Object.entries(areas(entry)).map(([name, area]) => [name, pixels(area)])) }));
    const semantic = () => atlas.cards.map((entry) => {
      const state = entry.encodedState; const every = (area, material, photon) => {
        for (let y = area.y; y < area.y + area.height; y++) for (let x = area.x; x < area.x + area.width; x++) if (audit.cell(x, y) !== material || audit.photonState(x, y) !== photon || audit.presentationState(x, y) !== 0) return false; return true;
      };
      let body = true;
      for (let y = entry.body.y; y < entry.body.y + entry.body.height; y++) for (let x = entry.body.x; x < entry.body.x + entry.body.width; x++) { const empty = inRect(x, y, entry.authoredHole) || inRect(x, y, entry.openNotch); if (audit.cell(x, y) !== (empty ? ${EMPTY} : ${METAL}) || audit.photonState(x, y) !== (empty ? 0 : state)) body = false; }
      return { key: entry.key, body, thin: every(entry.thinStructure, ${METAL}, state), isolated: audit.cell(entry.isolated.x, entry.isolated.y) === ${METAL} && audit.photonState(entry.isolated.x, entry.isolated.y) === state, absent: every(entry.absentState, ${METAL}, 0), water: every(entry.waterCoexistence, ${WATER}, state), glass: every(entry.glassCoexistence, ${GLASS}, state), wall: every(entry.wallCoexistence, ${GLASS}, state), blank: every(entry.guardedBlank, ${EMPTY}, 0) };
    });
    const pipeline = () => { const backend = audit.backend(); return { backend: backend?.backend, outputScale: String(backend?.outputScale ?? ''), requestedOutputScale: String(backend?.requestedOutputScale ?? ''), width: canvas.width, height: canvas.height, selector: canvas.dataset.photonMetalIrradianceVfx }; };
    const semanticBefore = semantic(); const flat = sample(); const refreshBefore = audit.presentationRefreshAudit();
    audit.setPhotonMetalIrradianceVfx(true); const selectorAfterOn = canvas.dataset.photonMetalIrradianceVfx; const requested = sample(); const pipelineState = pipeline();
    audit.setPhotonMetalIrradianceVfx(false); const selectorAfterOff = canvas.dataset.photonMetalIrradianceVfx; const repeated = sample(); const semanticAfter = semantic(); const refreshAfterImmediate = audit.presentationRefreshAudit();
    return { flat, requested, repeated, semanticBefore, semanticAfter, pipeline: pipelineState, selectorAfterOn, selectorAfterOff, refreshBefore, refreshAfterImmediate };
  })()`);
}

async function waitForPresentationRefreshIdle(cdp, evaluate, waitFor) {
  return waitFor(() => evaluate(cdp, `new Promise((resolve) => {
    const audit = window.__ANIFOR_INPUT_AUDIT__; const before = audit.presentationRefreshAudit(); let left = 4;
    const next = () => { if (--left > 0) return requestAnimationFrame(next); const after = audit.presentationRefreshAudit(); resolve(before && after && before.sequence === after.sequence ? after : false); };
    requestAnimationFrame(next);
  })`, 15_000), 30_000, 'E81 true-8x idle presentation window');
}

async function presentationRefreshAfterFrames(cdp, evaluate, count) {
  return evaluate(cdp, `new Promise((resolve) => { const audit = window.__ANIFOR_INPUT_AUDIT__; let left = ${count}; const next = () => { if (--left > 0) return requestAnimationFrame(next); resolve(audit.presentationRefreshAudit()); }; requestAnimationFrame(next); })`, 15_000);
}

async function waitForFixture(cdp, evaluate, waitFor, scale, label) {
  return waitFor(async () => {
    const fixture = await semanticSnapshot(cdp, evaluate);
    return fixture.cards.length === EXPECTED.length
      && fixture.cards.every(({ exact, deepMetalReady }) => exact && deepMetalReady)
      ? fixture : false;
  }, scale === 8 || scale === 4 ? 45_000 : 20_000, `${label} photon fixture hydration`);
}

async function semanticSnapshot(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__; const atlas = audit.photonSpectrumGraphicsAtlas();
    const expected = ${JSON.stringify(EXPECTED)};
    const inRect = (x, y, area) => x >= area.x && x < area.x + area.width && y >= area.y && y < area.y + area.height;
    const rectEvery = (area, material, photon) => { for (let y = area.y; y < area.y + area.height; y++) for (let x = area.x; x < area.x + area.width; x++) if (audit.cell(x, y) !== material || audit.photonState(x, y) !== photon || audit.presentationState(x, y) !== 0) return false; return true; };
    return { cards: atlas.cards.map((entry, index) => {
      const spec = expected[index]; let body = true;
      for (let y = entry.body.y; y < entry.body.y + entry.body.height; y++) for (let x = entry.body.x; x < entry.body.x + entry.body.width; x++) { const empty = inRect(x, y, entry.authoredHole) || inRect(x, y, entry.openNotch); if (audit.cell(x, y) !== (empty ? ${EMPTY} : ${METAL}) || audit.photonState(x, y) !== (empty ? 0 : entry.encodedState) || audit.presentationState(x, y) !== 0) body = false; }
      let wallCells = 0; for (let y = entry.wallCoexistence.y; y < entry.wallCoexistence.y + entry.wallCoexistence.height; y++) for (let x = entry.wallCoexistence.x; x < entry.wallCoexistence.x + entry.wallCoexistence.width; x++) wallCells += Number(audit.wall(x, y) === 1);
      // The body core is remote from the authored hole/notch and has four
      // cardinal Metal neighbours. presentationAuxiliary is the live
      // phase-local byte exposed to browser audits; requiring >6 establishes
      // a hydrated deep-Metal optical-depth/stability carrier before A/B/A.
      const core = { x: entry.body.x + 51, y: entry.body.y + 17 };
      const auxiliary = audit.presentationAuxiliary(core.x, core.y);
      const deepMetal = audit.cell(core.x, core.y) === ${METAL}
        && audit.photonState(core.x, core.y) === entry.encodedState
        && [[-1, 0], [1, 0], [0, -1], [0, 1]].every(([dx, dy]) =>
          audit.cell(core.x + dx, core.y + dy) === ${METAL});
      const deepMetalReady = deepMetal && auxiliary > 6;
      const exact = entry.key === spec?.key && JSON.stringify(entry.spectrum) === JSON.stringify(spec?.spectrum) && entry.encodedState === spec?.state && body && rectEvery(entry.thinStructure, ${METAL}, entry.encodedState) && audit.cell(entry.isolated.x, entry.isolated.y) === ${METAL} && audit.photonState(entry.isolated.x, entry.isolated.y) === entry.encodedState && rectEvery(entry.absentState, ${METAL}, 0) && rectEvery(entry.waterCoexistence, ${WATER}, entry.encodedState) && rectEvery(entry.glassCoexistence, ${GLASS}, entry.encodedState) && rectEvery(entry.wallCoexistence, ${GLASS}, entry.encodedState) && wallCells > 0 && rectEvery(entry.guardedBlank, ${EMPTY}, 0);
      return { key: entry.key, spectrum: entry.spectrum, state: entry.encodedState, exact,
        core, auxiliary, deepMetalReady, wallCells, body: entry.body,
        hole: entry.authoredHole, notch: entry.openNotch, thin: entry.thinStructure,
        isolated: { ...entry.isolated, width: 1, height: 1 }, absent: entry.absentState,
        water: entry.waterCoexistence, glass: entry.glassCoexistence,
        wall: entry.wallCoexistence, blank: entry.guardedBlank };
    }) };
  })()`);
}

async function pipelineState(cdp, evaluate) {
  return evaluate(cdp, `(() => { const audit = window.__ANIFOR_INPUT_AUDIT__; const canvas = document.querySelector('canvas.semantic-field-canvas'); const backend = audit?.backend?.(); return { backend: backend?.backend, outputScale: String(backend?.outputScale ?? ''), requestedOutputScale: String(backend?.requestedOutputScale ?? ''), width: canvas?.width, height: canvas?.height, look: canvas?.dataset.renderLook, selector: canvas?.dataset.photonMetalIrradianceVfx }; })()`);
}

function assertPipeline(state, scale, selector, assert, label) {
  assert(state.backend === 'webgl' && state.look === 'realistic'
    && state.outputScale === String(scale) && state.requestedOutputScale === String(scale)
    && state.width === WORLD_WIDTH * scale && state.height === WORLD_HEIGHT * scale
    && state.selector === selector,
  `${label} pipeline resolved incorrectly (${JSON.stringify(state)})`);
}

function assertFixtureSnapshot(snapshot, assert, label) {
  assert(snapshot.cards.length === EXPECTED.length
    && snapshot.cards.every(({ exact, deepMetalReady }) => exact && deepMetalReady),
    `${label} PHOT fixture topology drifted (${JSON.stringify(snapshot)})`);
}

function responseMetricsFromScreenshot(response) {
  return {
    rgbRms: response.rgbRms,
    rgbPeak: response.rgbPeak,
    coverage: response.coverage,
    channelMean: response.responseRgb,
    repeatRgbPeak: response.repeatRgbPeak,
  };
}

function combineResponse(regions) {
  const count = Math.max(1, regions.length);
  return {
    rgbRms: round(regions.reduce((sum, value) => sum + value.rgbRms, 0) / count),
    rgbPeak: Math.max(...regions.map(({ rgbPeak }) => rgbPeak)),
    coverage: round(regions.reduce((sum, value) => sum + value.coverage, 0) / count),
    channelMean: [0, 1, 2].map((channel) => round(regions.reduce((sum, value) => sum + value.channelMean[channel], 0) / count)),
    repeatRgbPeak: Math.max(...regions.map(({ repeatRgbPeak }) => repeatRgbPeak)),
  };
}

function assertSpectrumOrder(key, channels, assert, label) {
  const expected = EXPECTED.find((entry) => entry.key === key);
  const dominant = channels[expected.dominant];
  const other = [0, 1, 2].filter((channel) => channel !== expected.dominant);
  assert(dominant > 0 && other.every((channel) => dominant >= channels[channel] + 0.005),
    `${label} ${key} lost dominant native PHOT irradiance order (${JSON.stringify(channels)})`);
  if (expected.secondary !== undefined) {
    const final = [0, 1, 2].find((channel) => channel !== expected.dominant && channel !== expected.secondary);
    assert(channels[expected.secondary] >= channels[final] + 0.005,
      `${label} violet lost blue/red/green PHOT order (${JSON.stringify(channels)})`);
  }
}

function assertCrossScale(scales, assert) {
  const entries = EXPECTED.map(({ key }) => ({
    key,
    rgbRms: scales.map((scale) => scale.cards.find((card) => card.key === key).combined.rgbRms),
    channelMean: scales.map((scale) => scale.cards.find((card) => card.key === key).combined.channelMean),
  }));
  for (const entry of entries) {
    assert(spread(entry.rgbRms) <= 0.08 && entry.rgbRms.every((value) => value > 0),
      `E81 ${entry.key} irradiance strength drifted across 1x/2x/4x (${JSON.stringify(entry)})`);
    for (const channels of entry.channelMean) assertSpectrumOrder(entry.key, channels, assert, 'E81 cross-scale');
  }
  return entries;
}

function screenshotRegions(fixture) {
  const region = (name, rect) => ({
    name, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2,
    radiusX: Math.max(0.35, rect.width / 2 - 0.2),
    radiusY: Math.max(0.35, rect.height / 2 - 0.2),
  });
  return fixture.cards.flatMap((card) => {
    const areas = {
      crown: { x: card.body.x + 9, y: card.body.y + 9, width: 16, height: 14 },
      core: { x: card.body.x + 44, y: card.body.y + 10, width: 14, height: 14 },
      pocket: { x: card.body.x + 10, y: card.body.y + 42, width: 16, height: 12 },
      hole: card.hole, notch: card.notch, thin: card.thin, isolated: card.isolated,
      absent: card.absent, water: card.water, glass: card.glass,
      wall: card.wall, blank: card.blank,
    };
    return Object.entries(areas).map(([name, rect]) => region(`${card.key}:${name}`, rect));
  });
}

async function writeScreenshots({ screenshotRequest, variantScreenshotPath, writeFile, disabled, enabled }) {
  if (!screenshotRequest || typeof variantScreenshotPath !== 'function' || typeof writeFile !== 'function') return undefined;
  const paths = {
    off: variantScreenshotPath(screenshotRequest, 'e81-photon-metal-2x-off'),
    on: variantScreenshotPath(screenshotRequest, 'e81-photon-metal-2x-on'),
  };
  await writeFile(paths.off, Buffer.from(disabled.capture.capture.data, 'base64'));
  await writeFile(paths.on, Buffer.from(enabled.capture.capture.data, 'base64'));
  return paths;
}

const BODY_REGION_KEYS = Object.freeze(['crown', 'core', 'pocket']);
const CONTROL_KEYS = Object.freeze(['hole', 'notch', 'thin', 'isolated', 'absent', 'water', 'glass', 'wall', 'blank']);
function spread(values) { return Math.max(...values) - Math.min(...values); }
function round(value) { return Math.round(value * 10_000) / 10_000; }
function equal(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
