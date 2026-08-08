const EMPTY = 0;
const WATER = 2;
const BRICK = 22;
const METAL = 23;
const CERAMIC = 25;
const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;

const EXPECTED = Object.freeze([
  { key: 'ambient', temperature: 2952, byte: 11, changed: false },
  { key: 'onset', temperature: 8192, byte: 32, changed: false },
  { key: 'warm', temperature: 12288, byte: 48, changed: true },
  { key: 'orange', temperature: 15360, byte: 60, changed: true },
  { key: 'bright', temperature: 23040, byte: 90, changed: true },
]);

/**
 * E82's exact-Ceramic temperature response gate. The RenderLab material,
 * temperature, and wall planes are authored before every selector variant;
 * the A/B/A setter may change only normal-WebGL RGB presentation.
 */
export async function auditCeramicBlackbodyVfx({
  cdp, mode, evaluate, waitFor, waitForStablePageCapture, captureSettledPage,
  waitForNextWebGLPresentation, outputScale = 2, sampleBackdropRefractionRegions,
  screenshotRequest, variantScreenshotPath, writeFile, browserErrors, assert,
}) {
  if (mode !== 'webgl') return { skippedCanvasFallback: true };
  const seedUrl = await evaluate(cdp, 'location.href');
  if (outputScale === 8) {
    return auditTrueEightX({ cdp, evaluate, waitFor, waitForNextWebGLPresentation, assert, seedUrl });
  }

  if (typeof sampleBackdropRefractionRegions !== 'function') {
    throw new Error('E82 normal WebGL requires the composed screenshot-region sampler');
  }
  const scales = [];
  for (const scale of [1, 2, 4]) {
    const captures = {};
    for (const enabled of [false, true, false]) {
      const key = enabled ? 'enabled' : captures.disabled ? 'disabledRepeat' : 'disabled';
      captures[key] = await navigateAndCapture({
        cdp, evaluate, waitFor, waitForStablePageCapture, captureSettledPage,
        waitForNextWebGLPresentation, seedUrl, scale, enabled, label: `E82 ${key}`,
      });
    }
    const { disabled, enabled, disabledRepeat } = captures;
    assert(!browserErrors?.length,
      `E82 ${scale}x browser errors: ${(browserErrors ?? []).join(' | ')}`);
    assert(equal(disabled.fixture, enabled.fixture) && equal(disabled.fixture, disabledRepeat.fixture),
      `E82 ${scale}x fixture metadata changed across A/B/A`);
    assert(equal(disabled.semantic, enabled.semantic) && equal(disabled.semantic, disabledRepeat.semantic),
      `E82 ${scale}x selector changed material, temperature, or wall state`);
    assertPipeline(disabled.pipeline, scale, 'inactive', assert, `E82 ${scale}x off`);
    assertPipeline(enabled.pipeline, scale, 'active', assert, `E82 ${scale}x on`);
    assertPipeline(disabledRepeat.pipeline, scale, 'inactive', assert, `E82 ${scale}x repeated off`);

    const sampled = await sampleBackdropRefractionRegions(cdp, {
      straight: disabled.capture.capture.data,
      refracted: enabled.capture.capture.data,
      repeatedStraight: disabledRepeat.capture.capture.data,
    }, screenshotRegions(disabled.semantic), disabled.capture.canvasRect);
    const responses = new Map(sampled.map((entry) => [entry.name, responseMetrics(entry)]));
    const screenshots = await writeScreenshots({
      screenshotRequest, variantScreenshotPath, writeFile, disabled, enabled, scale,
    });
    const cards = disabled.semantic.cards.map((card) => {
      const target = responseFor(responses, `${card.key}:core`, assert, `E82 ${scale}x`);
      const controls = Object.fromEntries(CONTROL_KEYS.map((control) => {
        const response = responseFor(responses, `${card.key}:${control}`, assert, `E82 ${scale}x`);
        assert(response.rgbPeak === 0 && response.repeatRgbPeak === 0,
          `E82 ${scale}x ${card.key} leaked into ${control} (${JSON.stringify(response)})`);
        return [control, response];
      }));
      if (card.changed) {
        assert(target.rgbRms > 0.004 && target.rgbRms <= 12
          && target.rgbPeak > 0 && target.rgbPeak <= 32
          && target.repeatRgbPeak === 0,
        `E82 ${scale}x ${card.key} hot Ceramic response is absent, unbounded, or unstable (${JSON.stringify({
          target, pipeline: enabled.pipeline,
        })})`);
      } else {
        assert(target.rgbPeak === 0 && target.repeatRgbPeak === 0,
          `E82 ${scale}x ${card.key} ambient/onset control changed (${JSON.stringify(target)})`);
      }
      return { key: card.key, temperature: card.temperature, temperatureByte: card.temperatureByte, target, controls };
    });
    const orange = cards.find(({ key }) => key === 'orange').target;
    const bright = cards.find(({ key }) => key === 'bright').target;
    assert(bright.rgbRms >= orange.rgbRms * 0.75,
      `E82 ${scale}x bright Ceramic response regressed below orange (${JSON.stringify({ orange, bright })})`);
    scales.push({
      scale, backing: `${enabled.pipeline.width}x${enabled.pipeline.height}`,
      selector: enabled.pipeline.selector, cards,
      exactSemanticTemperatureWallTopology: true,
      exactAmbientOnsetNoOp: cards.filter(({ key }) => !['warm', 'orange', 'bright'].includes(key))
        .every(({ target }) => target.rgbPeak === 0 && target.repeatRgbPeak === 0),
      exactRepeatedOff: cards.every(({ target }) => target.repeatRgbPeak === 0),
      screenshots,
    });
  }
  const crossScale = assertCrossScale(scales, assert);
  return {
    dpr: 1, scales, crossScale, exactRepeatedOff: true, rgbOnly: true,
    materialTemperatureWallHeldConstant: true, trueEightXExcluded: false,
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
  url.searchParams.set('ceramicGlazeVfx', '1');
  url.searchParams.set('ceramicBlackbodyVfx', enabled ? '1' : '0');
  url.searchParams.set('ceramicBlackbodyVfxAudit', '1');
  url.searchParams.set('auditStage', `e82-ceramic-blackbody-${scale}-${enabled ? 'on' : 'off'}`);
  await cdp.send('Page.navigate', { url: url.toString() });
  await waitFor(() => evaluate(cdp, `(() => {
    const p = new URLSearchParams(location.search); const audit = window.__ANIFOR_INPUT_AUDIT__;
    return p.get('scene') === 'render-lab' && p.get('inputAudit') === '1'
      && p.get('renderLook') === 'realistic' && p.get('renderScale') === ${JSON.stringify(String(scale))}
      && p.get('ceramicGlazeVfx') === '1'
      && p.get('ceramicBlackbodyVfx') === ${JSON.stringify(enabled ? '1' : '0')}
      && p.get('ceramicBlackbodyVfxAudit') === '1'
      && typeof audit?.prepareCeramicTemperatureVfxFixture === 'function'
      && typeof audit?.ceramicTemperatureVfxFixture === 'function'
      && typeof audit?.setCeramicBlackbodyVfx === 'function';
  })()`), scale === 4 ? 45_000 : 20_000, `${label} ${scale}x page`);
  await prepareFixture(cdp, evaluate, enabled);
  const fixture = await waitForFixture(cdp, evaluate, waitFor, scale, `${label} ${scale}x`);
  const pipeline = await waitFor(async () => {
    const state = await pipelineState(cdp, evaluate);
    return state.backend === 'webgl' && state.look === 'realistic' && state.hdrPipeline === 'active'
      && state.outputScale === String(scale) && state.requestedOutputScale === String(scale)
      && state.width === WORLD_WIDTH * scale && state.height === WORLD_HEIGHT * scale
      && state.selector === (enabled ? 'active' : 'inactive') ? state : false;
  }, scale === 4 ? 45_000 : 20_000, `${label} ${scale}x WebGL Ceramic selector`);
  const dpr = await evaluate(cdp, 'window.devicePixelRatio');
  if (dpr !== 1) throw new Error(`E82 ${scale}x requires DPR 1 (received ${dpr})`);
  const capture = await settle({
    cdp, label: `${label} ${scale}x Ceramic framebuffer`, scale,
    waitForStablePageCapture, captureSettledPage, waitForNextWebGLPresentation,
  });
  return { fixture, semantic: await semanticSnapshot(cdp, evaluate), pipeline, capture };
}

async function prepareFixture(cdp, evaluate, enabled) {
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    audit.resetView();
    audit.setCeramicBlackbodyVfx(false);
    audit.prepareCeramicTemperatureVfxFixture();
    for (const node of document.querySelectorAll('.field-indicator')) node.style.visibility = 'hidden';
    audit.setCeramicBlackbodyVfx(${enabled});
    return true;
  })()`);
}

async function settle({
  cdp, label, scale, waitForStablePageCapture, captureSettledPage, waitForNextWebGLPresentation,
}) {
  if (typeof waitForNextWebGLPresentation === 'function') {
    const fence = await waitForNextWebGLPresentation(cdp, label, scale === 4 ? 30_000 : 15_000,
      scale === 4 ? 30_000 : 15_000);
    if (typeof captureSettledPage !== 'function') return { fence };
    return captureSettledPage(cdp, label, 0, true, false, false, scale === 4 ? 60_000 : 30_000);
  }
  return waitForStablePageCapture(cdp, label, scale === 4 ? 30_000 : undefined, 1);
}

async function waitForFixture(cdp, evaluate, waitFor, scale, label) {
  return waitFor(async () => {
    const snapshot = await semanticSnapshot(cdp, evaluate);
    return fixtureIsExact(snapshot) ? snapshot.fixture : false;
  }, scale === 4 ? 45_000 : 20_000, `${label} Ceramic temperature fixture hydration`);
}

async function semanticSnapshot(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    if (typeof audit?.temperature !== 'function' || typeof audit?.wall !== 'function') {
      throw new Error('E82 material/temperature/wall audit API unavailable');
    }
    const fixture = audit.ceramicTemperatureVfxFixture();
    const expected = ${JSON.stringify(EXPECTED)};
    const inRect = (x, y, rect) => x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
    const hashByte = (hash, value) => Math.imul(hash ^ (value & 255), 16777619) >>> 0;
    let materialHash = 2166136261, temperatureHash = 2166136261, wallHash = 2166136261;
    const materialCounts = { ceramic: 0, water: 0, brick: 0, metal: 0 };
    const temperatures = new Map(); let wallCells = 0;
    for (let y = 0; y < ${WORLD_HEIGHT}; y++) for (let x = 0; x < ${WORLD_WIDTH}; x++) {
      const material = audit.cell(x, y), temperature = audit.temperature(x, y), wall = audit.wall(x, y);
      materialHash = hashByte(materialHash, material);
      temperatureHash = hashByte(temperatureHash, temperature);
      temperatureHash = hashByte(temperatureHash, temperature >>> 8);
      wallHash = hashByte(wallHash, wall);
      materialCounts.ceramic += Number(material === ${CERAMIC}); materialCounts.water += Number(material === ${WATER});
      materialCounts.brick += Number(material === ${BRICK}); materialCounts.metal += Number(material === ${METAL});
      temperatures.set(temperature, (temperatures.get(temperature) ?? 0) + 1); wallCells += Number(wall !== 0);
    }
    const every = (rect, material, temperature) => {
      for (let y = rect.y; y < rect.y + rect.height; y++) for (let x = rect.x; x < rect.x + rect.width; x++) {
        if (audit.cell(x, y) !== material || audit.temperature(x, y) !== temperature) return false;
      }
      return true;
    };
    const cards = fixture.cards.map((entry, index) => {
      const definition = expected[index]; let body = true;
      for (let y = entry.body.y; y < entry.body.y + entry.body.height; y++) for (let x = entry.body.x; x < entry.body.x + entry.body.width; x++) {
        const voidCell = inRect(x, y, entry.authoredHole) || inRect(x, y, entry.openNotch);
        body = body && audit.cell(x, y) === (voidCell ? ${EMPTY} : ${CERAMIC})
          && audit.temperature(x, y) === (voidCell ? fixture.ambientTemperature : entry.temperature);
      }
      let wallPattern = true, wallCount = 0;
      for (let y = entry.wallCoexistence.y; y < entry.wallCoexistence.y + entry.wallCoexistence.height; y++) for (let x = entry.wallCoexistence.x; x < entry.wallCoexistence.x + entry.wallCoexistence.width; x++) {
        const blockX = Math.floor((x - entry.wallCoexistence.x) / 4);
        const blockY = Math.floor((y - entry.wallCoexistence.y) / 4);
        const expectedWall = (blockX + blockY) % 2 === 0 ? fixture.conductiveWall : 0;
        wallPattern = wallPattern && audit.wall(x, y) === expectedWall && audit.cell(x, y) === ${CERAMIC}
          && audit.temperature(x, y) === entry.temperature;
        wallCount += Number(audit.wall(x, y) !== 0);
      }
      const coreX = entry.core.x + Math.floor(entry.core.width / 2);
      const coreY = entry.core.y + Math.floor(entry.core.height / 2);
      const deepCore = audit.cell(coreX, coreY) === ${CERAMIC} && audit.temperature(coreX, coreY) === entry.temperature
        && [[-1, 0], [1, 0], [0, -1], [0, 1]].every(([dx, dy]) => audit.cell(coreX + dx, coreY + dy) === ${CERAMIC})
        && audit.presentationAuxiliary(coreX, coreY) > 6;
      const exact = entry.key === definition?.key && entry.material === ${CERAMIC}
        && entry.temperature === definition?.temperature && entry.temperatureByte === definition?.byte && body && deepCore
        && every(entry.thinLine, ${CERAMIC}, entry.temperature)
        && audit.cell(entry.isolated.x, entry.isolated.y) === ${CERAMIC}
        && audit.temperature(entry.isolated.x, entry.isolated.y) === entry.temperature
        && wallPattern && wallCount > 0
        && every(entry.waterContact.ceramic, ${CERAMIC}, entry.temperature)
        && every(entry.waterContact.water, ${WATER}, fixture.ambientTemperature)
        && every(entry.hotControls.brick, ${BRICK}, 23040)
        && every(entry.hotControls.metal, ${METAL}, 23040)
        && every(entry.guardedBlank, ${EMPTY}, fixture.ambientTemperature);
      return { key: entry.key, temperature: entry.temperature, temperatureByte: entry.temperatureByte,
        changed: definition.changed, exact,
        body: entry.body, core: entry.core, hole: entry.authoredHole, notch: entry.openNotch,
        thin: entry.thinLine, isolated: { ...entry.isolated, width: 1, height: 1 },
        // Sample one authored 4x4 wall block, not the intentionally alternating
        // checker gaps where ordinary hot Ceramic remains eligible.
        wall: { x: entry.wallCoexistence.x, y: entry.wallCoexistence.y, width: 4, height: 4 },
        // Only the last Ceramic column is in direct cardinal Water contact; the
        // rest of the broad half-card is a legitimate E82 body.
        ceramicContact: {
          x: entry.waterContact.ceramic.x + entry.waterContact.ceramic.width - 1,
          y: entry.waterContact.ceramic.y + 1, width: 1,
          height: entry.waterContact.ceramic.height - 2,
        },
        waterContact: entry.waterContact.water,
        brick: entry.hotControls.brick, metal: entry.hotControls.metal, blank: entry.guardedBlank };
    });
    return { fixture, state: {
      materialCounts, temperatureCounts: [...temperatures].sort(([a], [b]) => a - b).map(([temperature, cells]) => ({ temperature, cells })),
      materialHash, temperatureHash, wallHash, wallCells,
    }, cards };
  })()`);
}

function fixtureIsExact(snapshot) {
  const { fixture, state, cards } = snapshot;
  return fixture?.version === 1 && fixture?.world?.width === WORLD_WIDTH && fixture?.world?.height === WORLD_HEIGHT
    && fixture?.material === CERAMIC && cards.length === EXPECTED.length
    && cards.every(({ exact }) => exact)
    && state.materialCounts.ceramic === fixture.expected.ceramicCells
    && state.materialCounts.water === fixture.expected.waterCells
    && state.materialCounts.brick === fixture.expected.brickCells
    && state.materialCounts.metal === fixture.expected.metalCells
    && state.wallCells === fixture.expected.wallCells
    && equal(state.temperatureCounts, fixture.expected.temperatureCounts)
    && state.materialHash === fixture.expected.materialHash
    && state.temperatureHash === fixture.expected.temperatureHash
    && state.wallHash === fixture.expected.wallHash;
}

async function pipelineState(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__; const canvas = document.querySelector('canvas.semantic-field-canvas');
    const backend = audit?.backend?.(); return {
      backend: backend?.backend, outputScale: String(backend?.outputScale ?? ''),
      requestedOutputScale: String(backend?.requestedOutputScale ?? ''), width: canvas?.width, height: canvas?.height,
      look: canvas?.dataset.renderLook, hdrPipeline: canvas?.dataset.hdrPipeline,
      hdrReason: canvas?.dataset.hdrPipelineReason, selector: canvas?.dataset.ceramicBlackbodyVfx,
    };
  })()`);
}

function assertPipeline(state, scale, selector, assert, label) {
  assert(state.backend === 'webgl' && state.look === 'realistic' && state.hdrPipeline === 'active'
    && state.outputScale === String(scale) && state.requestedOutputScale === String(scale)
    && state.width === WORLD_WIDTH * scale && state.height === WORLD_HEIGHT * scale && state.selector === selector,
  `${label} pipeline/HDR selector resolved incorrectly (${JSON.stringify(state)})`);
}

function screenshotRegions(snapshot) {
  const region = (name, rect) => ({ name, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2,
    radiusX: Math.max(0.35, rect.width / 2 - 0.2), radiusY: Math.max(0.35, rect.height / 2 - 0.2) });
  return snapshot.cards.flatMap((card) => Object.entries({
    core: card.core, hole: card.hole, notch: card.notch, thin: card.thin, isolated: card.isolated,
    wall: card.wall, ceramicContact: card.ceramicContact, waterContact: card.waterContact,
    brick: card.brick, metal: card.metal, blank: card.blank,
  }).map(([name, rect]) => region(`${card.key}:${name}`, rect)));
}

function responseFor(responses, name, assert, label) {
  const response = responses.get(name);
  assert(response, `${label} omitted ${name} screenshot response evidence`);
  return response;
}

function responseMetrics(response) {
  return { rgbRms: response.rgbRms, rgbPeak: response.rgbPeak, coverage: response.coverage,
    responseRgb: response.responseRgb, repeatRgbPeak: response.repeatRgbPeak };
}

function assertCrossScale(scales, assert) {
  const entries = ['warm', 'orange', 'bright'].map((key) => ({ key,
    rgbRms: scales.map(({ cards }) => cards.find((card) => card.key === key).target.rgbRms),
  }));
  for (const entry of entries) {
    assert(entry.rgbRms.every((value) => value > 0.004) && spread(entry.rgbRms) <= 1.2,
      `E82 ${entry.key} response drifted across 1x/2x/4x (${JSON.stringify(entry)})`);
  }
  for (let scaleIndex = 0; scaleIndex < scales.length; scaleIndex++) {
    assert(entries[0].rgbRms[scaleIndex] <= entries[1].rgbRms[scaleIndex]
      && entries[1].rgbRms[scaleIndex] <= entries[2].rgbRms[scaleIndex],
    `E82 ${scales[scaleIndex].scale}x thermal response is not monotonic (${JSON.stringify(entries)})`);
  }
  return entries;
}

async function auditTrueEightX({ cdp, evaluate, waitFor, waitForNextWebGLPresentation, assert, seedUrl }) {
  const url = new URL(seedUrl);
  url.searchParams.set('scene', 'render-lab'); url.searchParams.set('inputAudit', '1');
  url.searchParams.set('renderLook', 'realistic'); url.searchParams.set('renderScale', '8');
  url.searchParams.set('ceramicGlazeVfx', '1'); url.searchParams.set('ceramicBlackbodyVfx', '1');
  url.searchParams.set('ceramicBlackbodyVfxAudit', '1'); url.searchParams.set('auditStage', 'e82-ceramic-blackbody-8-on');
  await cdp.send('Page.navigate', { url: url.toString() });
  await waitFor(() => evaluate(cdp, `(() => {
    const p = new URLSearchParams(location.search); const audit = window.__ANIFOR_INPUT_AUDIT__;
    return p.get('renderScale') === '8' && p.get('ceramicBlackbodyVfx') === '1'
      && p.get('ceramicGlazeVfx') === '1' && p.get('ceramicBlackbodyVfxAudit') === '1'
      && typeof audit?.prepareCeramicTemperatureVfxFixture === 'function'
      && typeof audit?.setCeramicBlackbodyVfx === 'function';
  })()`), 45_000, 'E82 true-8x page');
  await prepareFixture(cdp, evaluate, true);
  const snapshot = await waitFor(async () => {
    const candidate = await semanticSnapshot(cdp, evaluate); return fixtureIsExact(candidate) ? candidate : false;
  }, 45_000, 'E82 true-8x Ceramic fixture hydration');
  const pipeline = await waitFor(async () => {
    const state = await pipelineState(cdp, evaluate);
    return state.backend === 'webgl' && state.look === 'realistic' && state.outputScale === '8'
      && state.requestedOutputScale === '8' && state.width === WORLD_WIDTH * 8 && state.height === WORLD_HEIGHT * 8
      && state.hdrPipeline === 'inactive' && state.hdrReason === 'scale-8' && state.selector === 'inactive' ? state : false;
  }, 45_000, 'E82 true-8x inactive selector/HDR backing');
  const dpr = await evaluate(cdp, 'window.devicePixelRatio');
  assert(dpr === 1, `E82 true-8x requires DPR 1 (received ${dpr})`);
  if (typeof waitForNextWebGLPresentation !== 'function') throw new Error('E82 true-8x requires a real WebGL presentation fence');
  const fence = await waitForNextWebGLPresentation(cdp, 'E82 true-8x hydrated Ceramic framebuffer', 30_000, 30_000);
  const triplet = await atomicTrueEightXTriplet(cdp, evaluate);
  const after = await semanticSnapshot(cdp, evaluate);
  assert(fixtureIsExact(snapshot) && fixtureIsExact(after), 'E82 true-8x fixture hashes/topology drifted');
  assert(equal(snapshot.state, after.state), 'E82 true-8x selector changed material/temperature/wall hashes');
  assert(equal(triplet.flat, triplet.requested) && equal(triplet.flat, triplet.repeated),
    'E82 true-8x requested-on selector changed the direct framebuffer');
  assert(triplet.selectorAfterOn === 'inactive' && triplet.selectorAfterOff === 'inactive'
    && triplet.pipeline.selector === 'inactive', `E82 true-8x selector escaped exclusion (${JSON.stringify(triplet.pipeline)})`);
  return { dpr: 1, scales: [{ scale: 8, pipeline, fence, exactRequestedOnNoOp: true, exactRepeatedOff: true }],
    trueEightXExcluded: true, exactRequestedOnNoOp: true, exactRepeatedOff: true, rgbOnly: true,
    materialTemperatureWallHeldConstant: true };
}

async function atomicTrueEightXTriplet(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__; const canvas = document.querySelector('canvas.semantic-field-canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!canvas || !gl) throw new Error('E82 true-8x WebGL backing unavailable');
    const fixture = audit.ceramicTemperatureVfxFixture(); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const read = (x, y) => { const px = Math.max(0, Math.min(canvas.width - 1, Math.floor((x + 0.5) * canvas.width / ${WORLD_WIDTH}))); const py = Math.max(0, Math.min(canvas.height - 1, canvas.height - 1 - Math.floor((y + 0.5) * canvas.height / ${WORLD_HEIGHT}))); const pixel = new Uint8Array(4); gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); return [...pixel]; };
    const sampleRect = (rect) => { const result = []; const sx = Math.max(1, Math.floor(rect.width / 4)); const sy = Math.max(1, Math.floor(rect.height / 4)); for (let y = rect.y; y < rect.y + rect.height; y += sy) for (let x = rect.x; x < rect.x + rect.width; x += sx) result.push(read(x, y)); return result; };
    const sample = () => fixture.cards.map((card) => ({ key: card.key, core: sampleRect(card.core), hole: sampleRect(card.authoredHole), notch: sampleRect(card.openNotch), thin: sampleRect(card.thinLine), isolated: [read(card.isolated.x, card.isolated.y)], wall: sampleRect(card.wallCoexistence), ceramicContact: sampleRect(card.waterContact.ceramic), waterContact: sampleRect(card.waterContact.water), brick: sampleRect(card.hotControls.brick), metal: sampleRect(card.hotControls.metal), blank: sampleRect(card.guardedBlank) }));
    const pipeline = () => { const backend = audit.backend(); return { outputScale: String(backend?.outputScale ?? ''), requestedOutputScale: String(backend?.requestedOutputScale ?? ''), width: canvas.width, height: canvas.height, hdrPipeline: canvas.dataset.hdrPipeline, hdrReason: canvas.dataset.hdrPipelineReason, selector: canvas.dataset.ceramicBlackbodyVfx }; };
    const flat = sample(); audit.setCeramicBlackbodyVfx(true); const selectorAfterOn = canvas.dataset.ceramicBlackbodyVfx; const requested = sample(); const pipelineState = pipeline(); audit.setCeramicBlackbodyVfx(false); const selectorAfterOff = canvas.dataset.ceramicBlackbodyVfx; const repeated = sample();
    return { flat, requested, repeated, pipeline: pipelineState, selectorAfterOn, selectorAfterOff };
  })()`);
}

const CONTROL_KEYS = Object.freeze(['hole', 'notch', 'thin', 'isolated', 'wall', 'ceramicContact', 'waterContact', 'brick', 'metal', 'blank']);
async function writeScreenshots({
  screenshotRequest, variantScreenshotPath, writeFile, disabled, enabled, scale,
}) {
  if (!screenshotRequest || typeof variantScreenshotPath !== 'function'
    || typeof writeFile !== 'function') return undefined;
  const paths = {
    off: variantScreenshotPath(screenshotRequest, `e82-ceramic-blackbody-${scale}x-off`),
    on: variantScreenshotPath(screenshotRequest, `e82-ceramic-blackbody-${scale}x-on`),
  };
  await writeFile(paths.off, Buffer.from(disabled.capture.capture.data, 'base64'));
  await writeFile(paths.on, Buffer.from(enabled.capture.capture.data, 'base64'));
  return paths;
}
function spread(values) { return Math.max(...values) - Math.min(...values); }
function equal(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
