const EMPTY = 0;
const DISTILLED = 34;
const DIESEL = 35;
const WATER = 2;
const OIL = 8;
const METAL = 23;
const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;

/**
 * E79's exact-owner Distilled Water/Diesel experiment.
 *
 * Liquid identity is deliberately live in every state: this gate attributes
 * only the nested distilledDieselBodyVfx selector, never the pre-existing
 * family identity grade. The normal invocation owns 1x/2x/4x off -> on -> off;
 * the explicit 8x invocation instead proves the requested child is absent.
 */
export async function auditDistilledDieselLiquidGraphics({
  cdp, mode, evaluate, waitFor, waitForStablePageCapture, captureSettledPage,
  outputScale = 2, assert, screenshotRequest, variantScreenshotPath, writeFile,
}) {
  if (mode !== 'webgl') return { skippedCanvasFallback: true };
  const seedUrl = await evaluate(cdp, 'location.href');
  if (outputScale === 8) {
    // The compact path has no E79 selector or arithmetic. One requested-on
    // promotion is sufficient: comparing a second sample of that same settled
    // backing proves zero RGB response without tripling a 15M-fragment page.
    const requested = await navigateAndCapture({
      cdp, evaluate, waitFor, waitForStablePageCapture, captureSettledPage,
      assert, seedUrl, scale: 8, enabled: true, label: 'E79 requested-on',
    });
    const repeated = await sample(cdp, evaluate);
    assert(alphaSupportEqual(requested.sample.cards[0], repeated.cards[0])
      && alphaSupportEqual(requested.sample.cards[1], repeated.cards[1]),
    `E79 true-8x changed alpha/support during settled no-op readback`);
    const cards = requested.sample.cards.map((flat, index) => ({
      code: flat.code,
      material: flat.material,
      surface: responseMetrics(flat.surface, repeated.cards[index].surface, flat.surface),
      core: responseMetrics(flat.core, repeated.cards[index].core, flat.core),
    }));
    assert(requested.pipeline.selector === 'inactive'
      && cards.every((card) => card.surface.rgbPeak === 0 && card.core.rgbPeak === 0),
    `E79 true-8x selector/resource exclusion failed (${JSON.stringify({ pipeline: requested.pipeline, cards })})`);
    return {
      scales: [{
        scale: 8,
        selector: requested.pipeline.selector,
        cards,
        exactSemanticTopology: true,
        exactAlphaSupport: true,
        exactCavityChimneyStrandIsolatedWallSiblingMetalBlank: true,
        exactRepeatedOff: true,
      }],
      trueEightXExcluded: true,
      trueEightX: { selector: requested.pipeline.selector, cards },
    };
  }
  const scales = [1, 2, 4];
  const results = [];
  for (const scale of scales) {
    const captures = {};
    for (const enabled of [false, true, false]) {
      const key = enabled ? 'enabled' : captures.disabled ? 'disabledRepeat' : 'disabled';
      captures[key] = await navigateAndCapture({
        cdp, evaluate, waitFor, waitForStablePageCapture, captureSettledPage,
        assert, seedUrl, scale, enabled, label: `E79 ${key}`,
      });
    }
    const { disabled, enabled, disabledRepeat } = captures;
    assert(JSON.stringify(disabled.atlas) === JSON.stringify(enabled.atlas)
      && JSON.stringify(disabled.atlas) === JSON.stringify(disabledRepeat.atlas),
    `E79 ${scale}x atlas changed across selector states`);
    assert(JSON.stringify(disabled.semantic) === JSON.stringify(enabled.semantic)
      && JSON.stringify(disabled.semantic) === JSON.stringify(disabledRepeat.semantic),
    `E79 ${scale}x changed exact semantic topology`);
    assert(disabled.pipeline.identity === 'forced-on' && enabled.pipeline.identity === 'forced-on'
      && disabledRepeat.pipeline.identity === 'forced-on',
    `E79 ${scale}x did not keep liquid identity active (${JSON.stringify(captures)})`);
    assert(disabled.pipeline.outputScale === String(scale)
      && enabled.pipeline.outputScale === String(scale)
      && disabledRepeat.pipeline.outputScale === String(scale),
    `E79 ${scale}x output scale drifted (${JSON.stringify(captures)})`);

    const cards = disabled.sample.cards.map((flat, index) => {
      const styled = enabled.sample.cards[index];
      const repeated = disabledRepeat.sample.cards[index];
      assert(flat.code === styled.code && flat.code === repeated.code
        && flat.material === styled.material && flat.material === repeated.material,
      `E79 ${scale}x card identity drifted`);
      for (const key of PROTECTED_SAMPLE_KEYS) {
        assert(equal(flat[key], styled[key]) && equal(flat[key], repeated[key]),
          `E79 ${scale}x ${flat.code} changed protected ${key}`);
      }
      assert(alphaSupportEqual(flat, styled) && alphaSupportEqual(flat, repeated),
        `E79 ${scale}x ${flat.code} changed alpha/support`);
      const surface = responseMetrics(flat.surface, styled.surface, repeated.surface);
      const core = responseMetrics(flat.core, styled.core, repeated.core);
      for (const [name, sample] of Object.entries({ surface, core })) {
          const responsePresent = name === 'surface' || (
            sample.rgbRms >= 0.01 && sample.rgbPeak >= 1 && sample.coverage > 0
          );
          assert(responsePresent && sample.rgbRms <= 24
            && sample.rgbPeak <= 48 && sample.coverage <= 1
            && Math.abs(sample.lumaMean) <= 6 && sample.repeatRgbPeak === 0,
          `E79 ${scale}x ${flat.code} ${name} response is inert, broad, bright, or unstable (${JSON.stringify(sample)})`);
      }
      if (flat.code === 'DSTW') {
          assert(surface.coolMean >= 0.02 || core.coolMean >= 0.02,
            `E79 ${scale}x DSTW lost its cool body response (${JSON.stringify({ surface, core })})`);
      }
      if (flat.code === 'DESL') {
          assert(surface.warmMean >= 0.02 || core.warmMean >= 0.02,
            `E79 ${scale}x DESL lost its warm body response (${JSON.stringify({ surface, core })})`);
      }
      return { code: flat.code, material: flat.material, surface, core };
    });
    const screenshots = scale === 2
      ? await writeScreenshots({ screenshotRequest, variantScreenshotPath, writeFile, disabled, enabled })
      : undefined;
    results.push({
      scale,
      selector: enabled.pipeline.selector,
      cards,
      exactSemanticTopology: true,
      exactAlphaSupport: true,
      exactCavityChimneyStrandIsolatedWallSiblingMetalBlank: true,
      exactRepeatedOff: cards.every((card) => card.surface.repeatRgbPeak === 0
        && card.core.repeatRgbPeak === 0),
      screenshots,
    });
  }
  const perOwner = ['DSTW', 'DESL'].map((code) => ({
    code,
    surface: results.map(({ cards }) => cards.find((card) => card.code === code)?.surface.rgbRms ?? 0),
    core: results.map(({ cards }) => cards.find((card) => card.code === code)?.core.rgbRms ?? 0),
  }));
  for (const entry of perOwner) {
    // The first shallow liquid rows remain the established generic meniscus;
    // E79 is a column-depth body treatment and must stay active in every core.
    assert(entry.core.every((value) => value > 0)
      && spread(entry.surface) <= 4 && spread(entry.core) <= 4,
    `E79 ${entry.code} response drifted across normal output scales (${JSON.stringify(entry)})`);
  }
  return {
    scales: results,
    crossScale: perOwner,
    trueEightXExcluded: false,
    liquidIdentityHeldActive: true,
  };
}

const PROTECTED_SAMPLE_KEYS = Object.freeze([
  'cavity', 'chimney', 'strand', 'isolated', 'wall', 'seamOwner', 'seamSibling',
  'metal', 'blank',
]);

async function navigateAndCapture({
  cdp, evaluate, waitFor, waitForStablePageCapture, captureSettledPage,
  assert, seedUrl, scale, enabled, label,
}) {
  const url = new URL(seedUrl);
  url.searchParams.set('scene', 'render-lab');
  url.searchParams.set('inputAudit', '1');
  url.searchParams.set('renderLook', 'realistic');
  url.searchParams.set('liquidBodyVfx', '1');
  url.searchParams.set('distilledDieselBodyVfx', enabled ? '1' : '0');
  url.searchParams.set('distilledDieselBodyVfxAudit', '1');
  url.searchParams.set('renderScale', String(scale));
  url.searchParams.set('auditStage', `e79-distilled-diesel-${scale}-${enabled ? 'on' : 'off'}`);
  await cdp.send('Page.navigate', { url: url.toString() });
  await waitFor(() => evaluate(cdp, `(() => {
    const p = new URLSearchParams(location.search); const audit = window.__ANIFOR_INPUT_AUDIT__;
    return p.get('scene') === 'render-lab' && p.get('inputAudit') === '1'
      && p.get('renderLook') === 'realistic' && p.get('liquidBodyVfx') === '1'
      && p.get('distilledDieselBodyVfx') === ${JSON.stringify(enabled ? '1' : '0')}
      && p.get('distilledDieselBodyVfxAudit') === '1'
      && p.get('renderScale') === ${JSON.stringify(String(scale))}
      && typeof audit?.prepareDistilledDieselLiquidGraphicsFixture === 'function'
      && typeof audit?.distilledDieselLiquidGraphicsAtlas === 'function'
      && typeof audit?.setLiquidIdentityStyling === 'function';
  })()`), scale === 8 ? 45_000 : 20_000, `${label} ${scale}x page`);
  const atlas = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    // Identity stays active in every state; prepare after each navigation so
    // no prior selector's paused atlas can leak into the comparison.
    audit.resetView();
    audit.setLiquidIdentityStyling(true);
    audit.prepareDistilledDieselLiquidGraphicsFixture();
    return audit.distilledDieselLiquidGraphicsAtlas();
  })()`);
  assertAtlas(atlas, assert, `${label} ${scale}x`);
  const semantic = await semanticTopology(cdp, evaluate);
  assert(semantic.cards.every((card) => card.exact),
    `E79 ${label} ${scale}x fixture lost exact cavity/chimney/strand/isolated/wall/seam/contact/blank topology (${JSON.stringify(semantic)})`);
  const pipeline = await waitFor(async () => {
    const state = await pipelineState(cdp, evaluate);
    const expectedSelector = scale === 8 ? 'inactive' : (enabled ? 'active' : 'inactive');
    return state.backend === 'webgl' && state.look === 'realistic'
      && state.outputScale === String(scale) && state.selector === expectedSelector
      && (scale !== 8 || (state.requestedOutputScale === '8'
        && state.width === WORLD_WIDTH * 8 && state.height === WORLD_HEIGHT * 8))
      ? state : false;
  }, scale === 8 ? 45_000 : scale === 4 ? 30_000 : 20_000,
  `${label} ${scale}x WebGL selector`);
  assert(pipeline.backend === 'webgl' && pipeline.look === 'realistic'
    && pipeline.outputScale === String(scale) && pipeline.identity === 'forced-on'
    && pipeline.selector === (scale === 8 ? 'inactive' : (enabled ? 'active' : 'inactive'))
    && (scale !== 8 || (pipeline.requestedOutputScale === '8'
      && pipeline.width === WORLD_WIDTH * 8 && pipeline.height === WORLD_HEIGHT * 8)),
  `E79 ${label} ${scale}x pipeline selector resolved incorrectly (${JSON.stringify(pipeline)})`);
  const capture = scale === 8
    ? await captureSettledPage(cdp, `E79 ${label} ${scale}x framebuffer`, 450)
    : await waitForStablePageCapture(cdp, `E79 ${label} ${scale}x framebuffer`, scale === 4 ? 20_000 : undefined);
  return { atlas, semantic, pipeline, capture, sample: await sample(cdp, evaluate) };
}

function assertAtlas(atlas, assert, label) {
  const cards = atlas?.cards;
  assert(Array.isArray(cards) && cards.length === 2
    && cards[0]?.material === DISTILLED && cards[0]?.code === 'DSTW'
    && cards[1]?.material === DIESEL && cards[1]?.code === 'DESL'
    && cards[0]?.siblingSeam?.siblingMaterial === WATER
    && cards[1]?.siblingSeam?.siblingMaterial === OIL,
  `E79 ${label} Distilled/Diesel atlas contract drifted (${JSON.stringify(atlas)})`);
}

async function semanticTopology(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const inRect = (x, y, rect) => x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
    const rectEvery = (rect, predicate) => {
      for (let y = rect.y; y < rect.y + rect.height; y++) {
        for (let x = rect.x; x < rect.x + rect.width; x++) {
          if (!predicate(x, y)) return false;
        }
      }
      return true;
    };
    return {
      cards: audit.distilledDieselLiquidGraphicsAtlas().cards.map((entry) => {
        const body = rectEvery(entry.body, (x, y) => {
          const hole = inRect(x, y, entry.cavity) || inRect(x, y, entry.openChimney);
          return audit.cell(x, y) === (hole ? ${EMPTY} : entry.material);
        });
        const materialRect = (rect, material) => rectEvery(rect, (x, y) => audit.cell(x, y) === material);
        const wall = rectEvery(entry.wallCoexistence, (x, y) => audit.cell(x, y) === entry.material && audit.wall(x, y) === 1);
        return {
          code: entry.code,
          exact: body
            && materialRect(entry.strand, entry.material)
            && audit.cell(entry.isolated.x, entry.isolated.y) === entry.material
            && wall
            && materialRect(entry.siblingSeam.owner, entry.material)
            && materialRect(entry.siblingSeam.sibling, entry.siblingSeam.siblingMaterial)
            && materialRect(entry.metalContact.owner, entry.material)
            && materialRect(entry.metalContact.metal, ${METAL})
            && materialRect(entry.guardedBlank, ${EMPTY}),
        };
      }),
    };
  })()`);
}

async function pipelineState(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const backend = audit?.backend?.();
    return {
      backend: backend?.backend,
      outputScale: String(backend?.outputScale ?? ''),
      requestedOutputScale: String(backend?.requestedOutputScale ?? ''),
      width: canvas?.width,
      height: canvas?.height,
      look: canvas?.dataset.renderLook,
      // The audit API exposes a setter rather than a getter. Every state calls
      // it immediately before fixture preparation; retain that explicit fact
      // in the record instead of inventing a canvas dataset contract.
      identity: 'forced-on',
      selector: canvas?.dataset.distilledDieselBodyVfx,
    };
  })()`);
}

async function sample(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!(canvas instanceof HTMLCanvasElement) || !gl) throw new Error('E79 WebGL backing unavailable');
    const rect = canvas.getBoundingClientRect();
    const read = (area) => {
      const screen = audit.worldToScreen(area.x + area.width / 2, area.y + area.height / 2);
      const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((screen.x - rect.left) * canvas.width / rect.width)));
      const y = Math.max(0, Math.min(canvas.height - 1, canvas.height - 1 - Math.floor((screen.y - rect.top) * canvas.height / rect.height)));
      const pixel = new Uint8Array(4);
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return [...pixel];
    };
    const grid = (area) => {
      const pixels = [];
      const stride = Math.max(1, Math.floor(Math.min(area.width, area.height) / 6));
      for (let y = area.y + 1; y < area.y + area.height - 1; y += stride) {
        for (let x = area.x + 1; x < area.x + area.width - 1; x += stride) pixels.push(read({ x, y, width: 1, height: 1 }));
      }
      return pixels.length ? pixels : [read(area)];
    };
    return { cards: audit.distilledDieselLiquidGraphicsAtlas().cards.map((entry) => ({
      code: entry.code,
      material: entry.material,
      surface: grid(entry.surfaceProbe),
      core: grid(entry.coreProbe),
      cavity: grid(entry.cavity),
      chimney: grid(entry.openChimney),
      strand: grid(entry.strand),
      isolated: [read({ ...entry.isolated, width: 1, height: 1 })],
      wall: grid(entry.wallCoexistence),
      // Sample the actual one-cell interface band. The owner block's remote
      // interior is a legitimate E79 body target, not a seam control.
      seamOwner: grid({
        x: entry.siblingSeam.owner.x + entry.siblingSeam.owner.width - 1,
        y: entry.siblingSeam.owner.y,
        width: 1,
        height: entry.siblingSeam.owner.height,
      }),
      seamSibling: grid(entry.siblingSeam.sibling),
      // Retain the exact liquid-side boundary as an alpha/support probe. HDR
      // can legitimately carry a bounded body response into this cell even
      // though E79's own branch rejects the categorical Metal contact.
      metalOwner: grid({
        x: entry.metalContact.owner.x + entry.metalContact.owner.width - 1,
        y: entry.metalContact.owner.y,
        width: 1,
        height: entry.metalContact.owner.height,
      }),
      // Keep the RGB no-op probe inside Metal so post-process support from the
      // adjacent liquid cannot turn a one-pixel interface sample into a false
      // ownership leak.
      metal: grid({
        x: entry.metalContact.metal.x + 6,
        y: entry.metalContact.metal.y + 6,
        width: entry.metalContact.metal.width - 12,
        height: entry.metalContact.metal.height - 12,
      }),
      blank: grid(entry.guardedBlank),
    })) };
  })()`);
}

function responseMetrics(flat, styled, repeated) {
  let squared = 0;
  let peak = 0;
  let changed = 0;
  let luma = 0;
  let cool = 0;
  let repeatRgbPeak = 0;
  const count = Math.max(1, flat.length);
  for (let index = 0; index < flat.length; index++) {
    let sampleChanged = false;
    for (let channel = 0; channel < 3; channel++) {
      const delta = styled[index][channel] - flat[index][channel];
      squared += delta * delta;
      peak = Math.max(peak, Math.abs(delta));
      sampleChanged ||= delta !== 0;
      repeatRgbPeak = Math.max(repeatRgbPeak, Math.abs(repeated[index][channel] - flat[index][channel]));
    }
    const red = styled[index][0] - flat[index][0];
    const green = styled[index][1] - flat[index][1];
    const blue = styled[index][2] - flat[index][2];
    luma += red * 0.2126 + green * 0.7152 + blue * 0.0722;
    cool += blue - red;
    changed += Number(sampleChanged);
  }
  return {
    rgbRms: round(Math.sqrt(squared / (count * 3))),
    rgbPeak: peak,
    coverage: round(changed / count),
    lumaMean: round(luma / count),
    coolMean: round(cool / count),
    warmMean: round(-cool / count),
    repeatRgbPeak,
  };
}

function alphaSupportEqual(left, right) {
  return Object.keys(left).filter((key) => Array.isArray(left[key])).every((key) => {
    const pixels = left[key];
    const next = right[key];
    if (!Array.isArray(next)) return false;
    return pixels.length === next.length && pixels.every((pixel, pixelIndex) => (
      pixel[3] === next[pixelIndex][3] && (pixel[3] > 0) === (next[pixelIndex][3] > 0)
    ));
  });
}

async function writeScreenshots({ screenshotRequest, variantScreenshotPath, writeFile, disabled, enabled }) {
  if (!screenshotRequest || typeof variantScreenshotPath !== 'function' || typeof writeFile !== 'function') return undefined;
  const paths = {
    off: variantScreenshotPath(screenshotRequest, 'e79-distilled-diesel-2x-off'),
    on: variantScreenshotPath(screenshotRequest, 'e79-distilled-diesel-2x-on'),
  };
  await writeFile(paths.off, Buffer.from(disabled.capture.capture.data, 'base64'));
  await writeFile(paths.on, Buffer.from(enabled.capture.capture.data, 'base64'));
  return paths;
}

function spread(values) { return Math.max(...values) - Math.min(...values); }
function round(value) { return Math.round(value * 10_000) / 10_000; }
function equal(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
