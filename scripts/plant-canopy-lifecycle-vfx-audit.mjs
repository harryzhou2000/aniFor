const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const PLANT_MATERIAL = 10;
const EMPTY_MATERIAL = 0;
const METAL_MATERIAL = 23;
const WATER_MATERIAL = 2;
const SAND_MATERIAL = 1;
const NORMAL_SCALES = Object.freeze([1, 2, 4]);
const EIGHT_X_PRESENTATION_DEADLINE_MS = 30_000;

const PARENT_SELECTORS = Object.freeze([
  'botanicalBodyVfx',
  'botanicalMesostructureVfx',
  'botanicalPigmentVfx',
  'plantLaminaVfx',
  'plantLobeDepthVfx',
  'plantCanopyMassVfx',
  'plantCanopyTissueVfx',
  'plantCanopyInterlockVfx',
  'plantCanopyHierarchyVfx',
  'plantCanopyFoliageVfx',
]);

const TARGET_KEYS = new Set(['plantTreeGreen', 'plantTreeCyan']);

// Frozen from the accepted DPR-1 1x/2x/4x lifecycle atlas. The ranges are
// narrow enough to retain the state-oriented canopy grammar while allowing
// one framebuffer byte of cross-driver quantisation at probe boundaries.
const ACCEPTED_RESPONSE_RAILS = Object.freeze({
  'plantTreeGreen:body': responseRails(2.70, 2.84, 15, 18, 0.76, 0.82,
    [-1.34, -1.18], [-0.25, -0.08], [-1.18, -1.00]),
  'plantTreeGreen:core': responseRails(2.95, 3.12, 9, 12, 0.94, 1,
    [-0.62, -0.40], [3.30, 3.58], [-0.28, -0.08]),
  'plantTreeGreen:surface': responseRails(2.94, 3.14, 4, 7, 0.98, 1,
    [-2.47, -2.20], [-3.42, -3.08], [-2.20, -1.95]),
  'plantTreeGreen:lifecycle': responseRails(3.65, 3.95, 6, 9, 0.98, 1,
    [-2.90, -2.55], [-4.82, -4.45], [-2.68, -2.30]),
  'plantTreeCyan:body': responseRails(4.35, 4.58, 23, 27, 0.76, 0.81,
    [-0.72, -0.54], [2.02, 2.22], [-0.60, -0.42]),
  'plantTreeCyan:core': responseRails(2.74, 2.94, 6, 8, 0.98, 1,
    [-2.20, -1.92], [-2.44, -2.14], [-1.75, -1.52]),
  'plantTreeCyan:surface': responseRails(1.44, 1.65, 4, 8, 0.93, 0.98,
    [-0.65, -0.42], [0.90, 1.25], [-0.10, 0.12]),
  'plantTreeCyan:lifecycle': responseRails(5.00, 5.25, 8, 11, 0.97, 1,
    [-4.08, -3.80], [-5.40, -5.05], [-4.25, -4.00]),
});

/**
 * Focused E75 diagnostic gate.  It deliberately reuses the native lifecycle
 * graphics atlas: this module owns browser navigation and presentation proof,
 * never a duplicate material/state fixture.
 */
export async function auditPlantCanopyLifecycleVfx({
  cdp,
  mode,
  dpr,
  auditBaseUrl,
  renderScaleArgument,
  evaluate,
  waitFor,
  waitForStablePageCapture,
  sampleVolumeVfxCanvasAlphaSupport,
  setDesktopMetrics,
  waitForEightXTerminalBackend,
  assertEightXWebGLBackend,
  auditWebGLPresentationTiming,
  remainingDeadlineMs,
  screenshotRequest,
  variantScreenshotPath,
  writeFile,
  assert,
}) {
  assert(mode === 'webgl', 'E75 requires WebGL');
  assert(dpr === 1, `E75 requires DPR 1 (received ${dpr})`);
  const requestedScales = renderScaleArgument === undefined
    ? NORMAL_SCALES : [Number(renderScaleArgument)];
  assert(requestedScales.every((scale) => NORMAL_SCALES.includes(scale)),
    `E75 normal matrix accepts only 1x/2x/4x (${JSON.stringify(requestedScales)})`);

  const scales = [];
  for (const scale of requestedScales) {
    const variants = {};
    for (const enabled of [false, true, false]) {
      const label = enabled ? 'enabled' : variants.disabled ? 'disabledRepeat' : 'disabled';
      variants[label] = await navigateNormalState({
        cdp, mode, scale, enabled, label, auditBaseUrl, evaluate, waitFor,
        waitForStablePageCapture, sampleVolumeVfxCanvasAlphaSupport, assert,
      });
    }
    const { disabled, enabled, disabledRepeat } = variants;
    assert(JSON.stringify(disabled.fixture) === JSON.stringify(enabled.fixture)
      && JSON.stringify(disabled.fixture) === JSON.stringify(disabledRepeat.fixture),
    `E75 ${scale}x lifecycle atlas metadata changed across navigation`);
    for (const [label, variant] of Object.entries(variants)) {
      assertNormalGeometry(variant.geometry, scale, label, assert);
      assertTopology(variant.topology, scale, label, assert);
      assertPipeline(variant.pipeline, label === 'enabled', scale, label, assert);
    }
    assertExactState(disabled, enabled, `${scale}x disabled/enabled`, assert);
    assertExactState(disabled, disabledRepeat, `${scale}x disabled/repeated`, assert);
    assert(disabled.capture.capture.data === disabledRepeat.capture.capture.data,
      `E75 ${scale}x repeated-off framebuffer was not byte exact`);

    const targets = disabled.targets.map((region) => responseMetric(
      region, regionByName(enabled.targets, region.name),
      regionByName(disabledRepeat.targets, region.name),
    ));
    assert(targets.every((target) => target.repeatRgbPeak === 0 && target.alphaPeak === 0
      && Number.isFinite(target.rgbRms) && target.rgbPeak <= 128 && target.rgbRms <= 96),
    `E75 ${scale}x diagnostic target response exceeded safety rails (${JSON.stringify(targets)})`);
    assertAcceptedResponses(targets, scale, assert);

    let screenshots;
    if (screenshotRequest) {
      screenshots = {
        off: variantScreenshotPath(screenshotRequest, `e75-plant-canopy-lifecycle-${scale}x-off`),
        on: variantScreenshotPath(screenshotRequest, `e75-plant-canopy-lifecycle-${scale}x-on`),
      };
      await writeFile(screenshots.off, Buffer.from(disabled.capture.capture.data, 'base64'));
      await writeFile(screenshots.on, Buffer.from(enabled.capture.capture.data, 'base64'));
    }

    scales.push({
      scale,
      backing: `${disabled.geometry.width}x${disabled.geometry.height}`,
      targetResponses: targets,
      semantic: disabled.topology.semanticHash,
      presentationState: disabled.topology.stateHash,
      alphaSupport: disabled.backing,
      exactRepeatedOff: true,
      exactControls: true,
      screenshots,
      calibration: 'accepted-e75',
    });
  }

  if (scales.length > 1) assertAcceptedCrossScale(scales, assert);

  const trueEightX = hasEightXHelpers({
    setDesktopMetrics, waitForEightXTerminalBackend, assertEightXWebGLBackend,
    auditWebGLPresentationTiming, remainingDeadlineMs,
  })
    ? await auditTrueEightXExclusion({
      cdp, dpr, auditBaseUrl, evaluate, waitFor, setDesktopMetrics,
      waitForEightXTerminalBackend, assertEightXWebGLBackend,
      auditWebGLPresentationTiming, remainingDeadlineMs, assert,
    })
    : { pending: true, reason: 'E75 integration must inject shared true-8x promotion/fence helpers' };
  assert(!trueEightX.pending,
    `E75 requires its populated true-8x exclusion tail (${JSON.stringify(trueEightX)})`);

  return {
    calibration: 'accepted-e75-lifecycle-atlas',
    scales,
    trueEightX,
    trueEightXPending: Boolean(trueEightX.pending),
  };
}

async function navigateNormalState({
  cdp, mode, scale, enabled, label, auditBaseUrl, evaluate, waitFor,
  waitForStablePageCapture, sampleVolumeVfxCanvasAlphaSupport, assert,
}) {
  await cdp.send('Page.navigate', {
    url: `${auditBaseUrl}?${focusedQuery(scale, enabled, `plant-canopy-lifecycle-${label}`)}`,
  });
  await waitFor(() => evaluate(cdp, readinessExpression(scale, enabled, `plant-canopy-lifecycle-${label}`)),
    scale === 4 ? 45_000 : 20_000, `E75 ${label} ${scale}x page`);
  await waitFor(() => evaluate(cdp,
    `window.__ANIFOR_INPUT_AUDIT__.backend().backend === ${JSON.stringify(mode)}`),
  scale === 4 ? 30_000 : 15_000, `E75 ${label} ${scale}x backend`);

  const fixture = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    audit.resetView();
    audit.prepareBotanicalLifecycleGraphicsFixture();
    audit.refreshPresentationFields?.();
    return audit.botanicalLifecycleGraphicsAtlas();
  })()`);
  assertFixtureMetadata(fixture, assert);
  const timeout = scale === 4 ? 60_000 : scale === 2 ? 30_000 : 20_000;
  const capture = await waitForStablePageCapture(
    cdp, `E75 ${label} ${scale}x lifecycle framebuffer`, timeout, 1,
  );
  const geometry = await normalGeometry(cdp, evaluate);
  const pipeline = await pipelineState(cdp, evaluate);
  const topology = await fixtureTopology(cdp, evaluate, fixture);
  const backing = await sampleVolumeVfxCanvasAlphaSupport(cdp);
  const targets = await sampleRawRegions(cdp, evaluate, targetRegions(fixture));
  const controls = await sampleRegionDigests(cdp, evaluate, controlRegions(fixture));
  return { fixture, capture, geometry, pipeline, topology, backing, targets, controls };
}

function focusedQuery(scale, enabled, stage) {
  return new URLSearchParams({
    scene: 'render-lab', inputAudit: '1', blankAudit: '1', auditStage: stage,
    plantCanopyLifecycleVfxAudit: '1', renderScale: String(scale), renderLook: 'realistic',
    volumeVfx: '0', liquidBodyVfx: '0', liquidSurfaceVfx: '0',
    gasBodyVfx: '0', gasMotionVfx: '0', powderBodyVfx: '0', solidBodyVfx: '0',
    botanicalBodyVfx: '1', botanicalMesostructureVfx: '1', botanicalPigmentVfx: '1',
    plantLaminaVfx: '1', plantLobeDepthVfx: '1', plantCanopyMassVfx: '1',
    plantCanopyTissueVfx: '1', plantCanopyInterlockVfx: '1', plantCanopyHierarchyVfx: '1',
    plantCanopyFoliageVfx: '1', plantCanopyLifecycleVfx: enabled ? '1' : '0',
  });
}

function readinessExpression(scale, enabled, stage) {
  return `(() => {
    const params = new URLSearchParams(location.search);
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    return params.get('scene') === 'render-lab' && params.get('inputAudit') === '1'
      && params.get('blankAudit') === '1' && params.get('auditStage') === ${JSON.stringify(stage)}
      && params.get('renderScale') === ${JSON.stringify(String(scale))}
      && params.get('plantCanopyLifecycleVfx') === ${JSON.stringify(enabled ? '1' : '0')}
      && typeof audit?.prepareBotanicalLifecycleGraphicsFixture === 'function'
      && typeof audit?.botanicalLifecycleGraphicsAtlas === 'function';
  })()`;
}

function assertFixtureMetadata(snapshot, assert) {
  const expected = 'seedDry,seedSip,seedReady,seedGerminating,plantOrdinary,plantTreeGreen,plantTreeCyan,plantTreeMagenta';
  assert(snapshot?.cards?.length === 8 && snapshot.cards.map(({ key }) => key).join(',') === expected,
    `E75 botanical lifecycle atlas drifted (${JSON.stringify(snapshot)})`);
  const active = snapshot.cards.filter(({ key }) => TARGET_KEYS.has(key));
  assert(active.length === 2 && active.every(({ kind, material, tree, activeGrowth }) =>
    kind === 'plant' && material === PLANT_MATERIAL && tree === true && activeGrowth === true),
  `E75 active lifecycle target metadata drifted (${JSON.stringify(active)})`);
}

async function normalGeometry(cdp, evaluate, timeoutMs) {
  const expression = `(() => {
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const backend = window.__ANIFOR_INPUT_AUDIT__.backend();
    return { width: canvas?.width, height: canvas?.height, outputScale: canvas?.dataset.outputScale, backend };
  })()`;
  return timeoutMs === undefined ? evaluate(cdp, expression) : evaluate(cdp, expression, timeoutMs);
}

async function pipelineState(cdp, evaluate, timeoutMs) {
  const expression = `(() => {
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    if (!(canvas instanceof HTMLCanvasElement)) return undefined;
    return Object.fromEntries(${JSON.stringify([...PARENT_SELECTORS, 'plantCanopyLifecycleVfx'])}
      .map((name) => [name, canvas.dataset[name] ?? 'missing']).concat([
        ['hdrPipeline', canvas.dataset.hdrPipeline ?? 'missing'],
        ['hdrReason', canvas.dataset.hdrPipelineReason ?? 'missing'],
      ]));
  })()`;
  return timeoutMs === undefined ? evaluate(cdp, expression) : evaluate(cdp, expression, timeoutMs);
}

async function fixtureTopology(cdp, evaluate, fixture, timeoutMs) {
  const expression = `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const atlas = ${JSON.stringify(fixture)};
    const empty = ${EMPTY_MATERIAL};
    const inRect = (x, y, rect) => x >= rect.x && y >= rect.y
      && x < rect.x + rect.width && y < rect.y + rect.height;
    const rectExact = (rect, material, state) => {
      for (let y = rect.y; y < rect.y + rect.height; y++) for (let x = rect.x; x < rect.x + rect.width; x++) {
        if (audit.cell(x, y) !== material || audit.presentationState(x, y) !== state) return false;
      }
      return true;
    };
    const bodyExact = (entry) => {
      for (let y = entry.body.y; y < entry.body.y + entry.body.height; y++) {
        for (let x = entry.body.x; x < entry.body.x + entry.body.width; x++) {
          const open = inRect(x, y, entry.authoredHole) || inRect(x, y, entry.openNotch);
          if (audit.cell(x, y) !== (open ? empty : entry.material)
            || audit.presentationState(x, y) !== (open ? 0 : entry.encodedState)) return false;
        }
      }
      return true;
    };
    let semanticHash = 2166136261; let stateHash = 2166136261;
    let nonzeroStateCells = 0;
    for (let y = 0; y < audit.height; y++) for (let x = 0; x < audit.width; x++) {
      const material = audit.cell(x, y); const state = audit.presentationState(x, y) >>> 0;
      semanticHash = Math.imul(semanticHash ^ material, 16777619) >>> 0;
      stateHash = Math.imul(stateHash ^ state, 16777619) >>> 0;
      nonzeroStateCells += Number(state !== 0);
    }
    const cards = atlas.cards.map((entry) => ({
      key: entry.key,
      bodyExact: bodyExact(entry),
      holeExact: rectExact(entry.authoredHole, empty, 0),
      notchExact: rectExact(entry.openNotch, empty, 0),
      thinExact: rectExact(entry.thinStructure, entry.material, entry.encodedState),
      isolatedExact: audit.cell(entry.isolated.x, entry.isolated.y) === entry.material
        && audit.presentationState(entry.isolated.x, entry.isolated.y) === entry.encodedState,
      zeroStateExact: rectExact(entry.zeroState, entry.material, 0),
      wrongOwnerExact: rectExact(entry.wrongOwner, ${METAL_MATERIAL}, entry.encodedState),
      waterExact: rectExact(entry.waterControl, ${WATER_MATERIAL}, entry.encodedState),
      sandExact: rectExact(entry.sandControl, ${SAND_MATERIAL}, entry.encodedState),
      blankExact: rectExact(entry.guardedBlank, empty, 0),
    }));
    return { semanticHash, stateHash, nonzeroStateCells, cards,
      exact: cards.every((card) => Object.entries(card).every(([name, value]) => name === 'key' || value === true)) };
  })()`;
  return timeoutMs === undefined ? evaluate(cdp, expression) : evaluate(cdp, expression, timeoutMs);
}

function assertNormalGeometry(geometry, scale, label, assert) {
  assert(geometry?.backend?.backend === 'webgl' && geometry.backend.outputScale === scale
    && geometry.backend.requestedOutputScale === scale
    && geometry.width === WORLD_WIDTH * scale && geometry.height === WORLD_HEIGHT * scale
    && geometry.outputScale === String(scale),
  `E75 ${label} ${scale}x backing/backend drifted (${JSON.stringify(geometry)})`);
}

function assertTopology(topology, scale, label, assert) {
  assert(topology?.exact === true && topology.cards?.length === 8 && topology.nonzeroStateCells > 0,
    `E75 ${label} ${scale}x material/presentation-state topology drifted (${JSON.stringify(topology)})`);
}

function assertPipeline(pipeline, enabled, scale, label, assert) {
  assert(pipeline?.hdrPipeline === 'active' && pipeline.hdrReason !== 'scale-8'
    && PARENT_SELECTORS.every((selector) => pipeline[selector] === 'active')
    && pipeline.plantCanopyLifecycleVfx === (enabled ? 'active' : 'inactive'),
  `E75 ${label} ${scale}x parent/selector state was wrong (${JSON.stringify(pipeline)})`);
}

function targetRegions(fixture) {
  return fixture.cards.filter(({ key }) => TARGET_KEYS.has(key)).flatMap((entry) => [
    ['body', entry.body], ['core', entry.coreProbe], ['surface', entry.surfaceProbe],
    ['lifecycle', entry.lifecycleProbe],
  ].map(([kind, rect]) => ({ name: `${entry.key}:${kind}`, ...rect })));
}

function controlRegions(fixture) {
  const controls = [];
  for (const entry of fixture.cards) {
    if (!TARGET_KEYS.has(entry.key)) {
      for (const [kind, rect] of [['body', entry.body], ['core', entry.coreProbe],
        ['surface', entry.surfaceProbe], ['lifecycle', entry.lifecycleProbe]]) {
        controls.push({ name: `${entry.key}:${kind}`, ...rect });
      }
    }
    for (const [kind, rect] of [['hole', entry.authoredHole], ['notch', entry.openNotch],
      ['thin', entry.thinStructure], ['isolated', { ...entry.isolated, width: 1, height: 1 }],
      ['zeroState', entry.zeroState], ['wrongOwner', entry.wrongOwner],
      ['water', entry.waterControl], ['sand', entry.sandControl], ['blank', entry.guardedBlank]]) {
      controls.push({ name: `${entry.key}:${kind}`, ...rect });
    }
  }
  return controls;
}

async function sampleRawRegions(cdp, evaluate, regions) {
  return evaluate(cdp, webGlRegionExpression(regions, true));
}

async function sampleRegionDigests(cdp, evaluate, regions) {
  return evaluate(cdp, webGlRegionExpression(regions, false));
}

function webGlRegionExpression(regions, includePixels) {
  return `(() => {
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!canvas || !gl) throw new Error('E75 direct WebGL sampler unavailable');
    const scaleX = canvas.width / ${WORLD_WIDTH}; const scaleY = canvas.height / ${WORLD_HEIGHT};
    return ${JSON.stringify(regions)}.map((region) => {
      const left = Math.round(region.x * scaleX); const top = Math.round(region.y * scaleY);
      const width = Math.round(region.width * scaleX); const height = Math.round(region.height * scaleY);
      const raw = new Uint8Array(width * height * 4);
      gl.readPixels(left, canvas.height - top - height, width, height, gl.RGBA, gl.UNSIGNED_BYTE, raw);
      let rgbaSignature = 2166136261; let alphaSignature = 2166136261;
      let supportSignature = 2166136261; let alphaSum = 0; let supported = 0;
      for (let offset = 0; offset < raw.length; offset += 4) {
        for (let channel = 0; channel < 4; channel++) rgbaSignature = Math.imul(
          rgbaSignature ^ raw[offset + channel], 16777619) >>> 0;
        const alpha = raw[offset + 3]; const support = Number(alpha > 0);
        alphaSignature = Math.imul(alphaSignature ^ alpha, 16777619) >>> 0;
        supportSignature = Math.imul(supportSignature ^ support, 16777619) >>> 0;
        alphaSum += alpha; supported += support;
      }
      const base = { name: region.name, width, height, rgbaSignature, alphaSignature,
        supportSignature, alphaSum, supported };
      if (!${includePixels ? 'true' : 'false'}) return base;
      const pixels = new Array(raw.length);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let channel = 0; channel < 4; channel++) {
        pixels[(y * width + x) * 4 + channel] = raw[((height - 1 - y) * width + x) * 4 + channel];
      }
      return { ...base, pixels };
    });
  })()`;
}

function assertExactState(left, right, label, assert) {
  assert(JSON.stringify(left.topology) === JSON.stringify(right.topology),
    `E75 ${label} changed material/presentation-state topology`);
  assert(left.backing.width === right.backing.width && left.backing.height === right.backing.height
    && left.backing.alphaSignature === right.backing.alphaSignature
    && left.backing.supportSignature === right.backing.supportSignature
    && left.backing.alphaSum === right.backing.alphaSum && left.backing.supported === right.backing.supported,
  `E75 ${label} changed alpha/support (${JSON.stringify({ left: left.backing, right: right.backing })})`);
  assert(JSON.stringify(left.controls) === JSON.stringify(right.controls),
    `E75 ${label} changed a protected lifecycle/topology control`);
}

function regionByName(regions, name) {
  const region = regions.find((candidate) => candidate.name === name);
  if (!region) throw new Error(`E75 raw region ${name} is missing`);
  return region;
}

function responseMetric(disabled, enabled, disabledRepeat) {
  if (disabled.width !== enabled.width || disabled.height !== enabled.height
    || disabled.width !== disabledRepeat.width || disabled.height !== disabledRepeat.height) {
    throw new Error(`E75 ${disabled.name} raw geometry changed`);
  }
  let squared = 0; let rgbPeak = 0; let repeatRgbPeak = 0; let alphaPeak = 0; let changed = 0;
  const responseRgb = [0, 0, 0];
  const pixels = disabled.width * disabled.height;
  for (let index = 0; index < pixels; index++) {
    let pixelChanged = false;
    for (let channel = 0; channel < 3; channel++) {
      const offset = index * 4 + channel;
      const delta = enabled.pixels[offset] - disabled.pixels[offset];
      const repeated = disabledRepeat.pixels[offset] - disabled.pixels[offset];
      responseRgb[channel] += delta; squared += delta * delta;
      rgbPeak = Math.max(rgbPeak, Math.abs(delta)); repeatRgbPeak = Math.max(repeatRgbPeak, Math.abs(repeated));
      pixelChanged ||= delta !== 0;
    }
    alphaPeak = Math.max(alphaPeak, Math.abs(enabled.pixels[index * 4 + 3] - disabled.pixels[index * 4 + 3]));
    changed += Number(pixelChanged);
  }
  return { name: disabled.name, rgbPeak, repeatRgbPeak, alphaPeak,
    rgbRms: fixed(Math.sqrt(squared / Math.max(1, pixels * 3))),
    coverage: fixed(changed / Math.max(1, pixels)), responseRgb: responseRgb.map((value) => fixed(value / pixels)) };
}

function hasEightXHelpers(helpers) {
  return Object.values(helpers).every((helper) => typeof helper === 'function');
}

async function auditTrueEightXExclusion({
  cdp, dpr, auditBaseUrl, evaluate, waitFor, setDesktopMetrics,
  waitForEightXTerminalBackend, assertEightXWebGLBackend,
  auditWebGLPresentationTiming, remainingDeadlineMs, assert,
}) {
  await setDesktopMetrics(cdp, 1280, 720, dpr);
  const deadline = Date.now() + EIGHT_X_PRESENTATION_DEADLINE_MS;
  await cdp.send('Page.navigate', {
    url: `${auditBaseUrl}?${focusedQuery(8, true, 'eight-plant-canopy-lifecycle')}`,
  });
  await waitFor(() => evaluate(cdp, readinessExpression(8, true, 'eight-plant-canopy-lifecycle'),
    Math.min(1_000, remainingDeadlineMs(deadline, 'true-8x E75 input API poll'))),
  remainingDeadlineMs(deadline, 'true-8x E75 input API'), 'true-8x E75 input API');
  const backend = await waitForEightXTerminalBackend(cdp, 'true-8x E75', deadline);
  assertEightXWebGLBackend(backend, 'true-8x E75');
  const fixture = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    audit.resetView(); audit.prepareBotanicalLifecycleGraphicsFixture();
    return audit.botanicalLifecycleGraphicsAtlas();
  })()`, Math.min(1_000, remainingDeadlineMs(deadline, 'true-8x E75 fixture')));
  assertFixtureMetadata(fixture, assert);
  const budget = remainingDeadlineMs(deadline, 'true-8x E75 populated GPU completion');
  const timing = await auditWebGLPresentationTiming(cdp, 1, Math.min(12_000, budget), budget, 1);
  assert(timing.source === 'gpu-fence',
    `true-8x E75 populated frame did not signal its GPU fence (${JSON.stringify(timing)})`);
  const topology = await fixtureTopology(cdp, evaluate, fixture,
    Math.min(1_000, remainingDeadlineMs(deadline, 'true-8x E75 topology')));
  assertTopology(topology, 8, 'requested-on', assert);
  const geometry = await normalGeometry(cdp, evaluate,
    Math.min(1_000, remainingDeadlineMs(deadline, 'true-8x E75 geometry')));
  assert(geometry?.backend?.backend === 'webgl' && geometry.backend.outputScale === 8
    && geometry.backend.requestedOutputScale === 8
    && geometry.width === WORLD_WIDTH * 8 && geometry.height === WORLD_HEIGHT * 8
    && geometry.outputScale === '8',
  `true-8x E75 backing/backend drifted (${JSON.stringify(geometry)})`);
  const pipeline = await pipelineState(cdp, evaluate,
    Math.min(1_000, remainingDeadlineMs(deadline, 'true-8x E75 selector isolation')));
  assert(pipeline?.hdrPipeline === 'inactive' && pipeline.hdrReason === 'scale-8'
    && PARENT_SELECTORS.every((selector) => pipeline[selector] === 'inactive')
    && pipeline.plantCanopyLifecycleVfx === 'inactive',
  `true-8x E75 selector isolation failed (${JSON.stringify(pipeline)})`);
  return { backing: `${geometry.width}x${geometry.height}`, promotedWebGLObserved: true,
    selectorExcluded: true, fixturePopulated: true, promotionFence: 'signaled', timing,
    semantic: topology.semanticHash, presentationState: topology.stateHash };
}

function responseRails(
  rmsMinimum, rmsMaximum, peakMinimum, peakMaximum, coverageMinimum, coverageMaximum,
  red, green, blue,
) {
  return {
    rgbRms: [rmsMinimum, rmsMaximum], rgbPeak: [peakMinimum, peakMaximum],
    coverage: [coverageMinimum, coverageMaximum], responseRgb: [red, green, blue],
  };
}

function assertAcceptedResponses(targets, scale, assert) {
  assert(targets.length === Object.keys(ACCEPTED_RESPONSE_RAILS).length,
    `E75 ${scale}x accepted target count drifted (${JSON.stringify(targets)})`);
  for (const target of targets) {
    const rails = ACCEPTED_RESPONSE_RAILS[target.name];
    assert(rails
      && within(target.rgbRms, rails.rgbRms)
      && within(target.rgbPeak, rails.rgbPeak)
      && within(target.coverage, rails.coverage)
      && target.responseRgb.every((value, channel) => within(value, rails.responseRgb[channel])),
    `E75 ${scale}x accepted ${target.name} response drifted (${JSON.stringify(target)})`);
  }
  const greenBody = regionByName(targets, 'plantTreeGreen:body');
  const cyanBody = regionByName(targets, 'plantTreeCyan:body');
  const greenCore = regionByName(targets, 'plantTreeGreen:core');
  const cyanCore = regionByName(targets, 'plantTreeCyan:core');
  assert(cyanBody.responseRgb[1] - greenBody.responseRgb[1] >= 2.15
    && greenCore.responseRgb[1] - cyanCore.responseRgb[1] >= 5.55,
  `E75 ${scale}x lost direction/phase-grounded tree separation (${JSON.stringify({
    greenBody, cyanBody, greenCore, cyanCore,
  })})`);
}

function assertAcceptedCrossScale(scales, assert) {
  const semantic = scales[0].semantic;
  const presentationState = scales[0].presentationState;
  assert(scales.every((scale) => scale.semantic === semantic
      && scale.presentationState === presentationState),
  `E75 normal scales changed semantic or lifecycle-state ownership (${JSON.stringify(scales.map((scale) => ({
    scale: scale.scale, semantic: scale.semantic, presentationState: scale.presentationState,
  })))})`);
  for (const name of Object.keys(ACCEPTED_RESPONSE_RAILS)) {
    const responses = scales.map((scale) => regionByName(scale.targetResponses, name));
    assert(spread(responses.map(({ rgbRms }) => rgbRms)) <= 0.12
      && spread(responses.map(({ rgbPeak }) => rgbPeak)) <= 2
      && spread(responses.map(({ coverage }) => coverage)) <= 0.05
      && [0, 1, 2].every((channel) => spread(
        responses.map(({ responseRgb }) => responseRgb[channel]),
      ) <= 0.16),
    `E75 ${name} changed materially across 1x/2x/4x (${JSON.stringify(responses)})`);
  }
}

function within(value, [minimum, maximum]) {
  return value >= minimum && value <= maximum;
}

function spread(values) {
  return Math.max(...values) - Math.min(...values);
}

function fixed(value) {
  return Math.round(value * 10_000) / 10_000;
}
