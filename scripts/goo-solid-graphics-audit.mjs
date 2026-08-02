const GOO = 71;
const WATER = 2;
const METAL = 23;
const EMPTY = 0;

/**
 * Exact-owner native/topology and RGB-only body-optics gate for GOO.
 */
export async function auditGooSolidGraphics({ cdp, mode, evaluate, waitFor, captureSettledPage, outputScale = 2, assert }) {
  if (mode !== 'webgl') return { skippedCanvasFallback: true };
  await captureSettledPage(cdp, 'WebGL initial GOO solid framebuffer', outputScale === 8 ? 450 : 0);
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const required = ['gooSolidGraphicsAtlas', 'prepareGooSolidGraphicsFixture',
      'setGooSolidStyling', 'gooSolidStylingEnabled', 'cell', 'wall', 'resetView'];
    if (!audit || required.some((name) => typeof audit[name] !== 'function')) {
      throw new Error('GOO solid graphics audit API unavailable');
    }
    audit.resetView();
    audit.setGooSolidStyling(false);
    audit.prepareGooSolidGraphicsFixture();
    return true;
  })()`);
  const fixture = await waitFor(() => evaluate(cdp, `(() => {
    const fixture = window.__ANIFOR_INPUT_AUDIT__.gooSolidGraphicsAtlas?.();
    return fixture?.material === ${GOO} ? fixture : false;
  })()`), 15_000, 'GOO solid fixture');
  const semantics = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const fixture = audit.gooSolidGraphicsAtlas();
    const at = (point) => ({ material: audit.cell(point.x, point.y), wall: audit.wall(point.x, point.y) });
    return {
      core: at(fixture.coreProbe), surface: at(fixture.surfaceProbe),
      hole: at(fixture.authoredHole), notch: at(fixture.openNotch), thin: at(fixture.thinColumn),
      isolated: at(fixture.isolated), wall: at(fixture.wallCoexistence),
      goo: at(fixture.contacts.goo), water: at(fixture.contacts.water), metal: at(fixture.contacts.metal),
      blank: at(fixture.guardedBlank),
    };
  })()`);
  assert(semantics.core.material === GOO && semantics.surface.material === GOO
    && semantics.hole.material === EMPTY && semantics.notch.material === EMPTY
    && semantics.thin.material === GOO && semantics.isolated.material === GOO
    && semantics.wall.material === GOO && semantics.wall.wall === 1
    && semantics.goo.material === GOO && semantics.water.material === WATER
    && semantics.metal.material === METAL && semantics.blank.material === EMPTY,
  `GOO solid fixture lost native owner/topology/contact separation (${JSON.stringify(semantics)})`);
  if (outputScale === 8) {
    const info = await evaluate(cdp, `(() => {
      const audit = window.__ANIFOR_INPUT_AUDIT__;
      const canvas = document.querySelector('canvas.semantic-field-canvas');
      return { backend: audit.backend(), width: canvas?.width, height: canvas?.height };
    })()`);
    assert(info.backend.backend === 'webgl' && info.backend.outputScale === 8
      && info.backend.requestedOutputScale === 8 && info.width === 4896 && info.height === 3072,
    `GOO solid true-8× presentation did not promote (${JSON.stringify(info)})`);
  }
  const flat = await sample(cdp, evaluate);
  await setGoo(cdp, evaluate, true);
  await captureSettledPage(cdp, 'styled GOO solid framebuffer', outputScale === 8 ? 450 : 0);
  const styled = await sample(cdp, evaluate);
  await setGoo(cdp, evaluate, false);
  await captureSettledPage(cdp, 'repeated flat GOO solid framebuffer', outputScale === 8 ? 450 : 0);
  const repeated = await sample(cdp, evaluate);
  assert(equal(flat, repeated), 'GOO off→on→off framebuffer was not exact');
  const response = metrics(flat.core, styled.core);
  assert(response.peak >= 2 && response.peak <= 40 && response.changed > 0,
    `GOO core is inert or unbounded (${JSON.stringify(response)})`);
  assert(flat.core.every((pixel, index) => pixel[3] === styled.core[index][3]), 'GOO changed semantic alpha');
  for (const key of ['surface', 'hole', 'notch', 'thin', 'isolated', 'wall', 'goo', 'water', 'metal', 'blank']) {
    assert(equal(flat[key], styled[key]), `GOO styling changed protected ${key}`);
  }
  await setGoo(cdp, evaluate, true);
  return { material: GOO, outputScale, ...response, exactSemanticTopology: true,
    nativeWallCoexistence: true, exactRepeatedOff: true, exactControls: true, rgbOnly: true };
}

async function setGoo(cdp, evaluate, enabled) {
  const observed = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    audit.setGooSolidStyling(${enabled});
    return audit.gooSolidStylingEnabled();
  })()`);
  if (observed !== enabled) throw new Error(`GOO styling control failed (${JSON.stringify({ enabled, observed })})`);
}

async function sample(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const fixture = audit.gooSolidGraphicsAtlas();
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!canvas || !gl) throw new Error('GOO solid WebGL backing unavailable');
    const rect = canvas.getBoundingClientRect();
    const read = (area) => {
      const screen = audit.worldToScreen(area.x + area.width / 2, area.y + area.height / 2);
      const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((screen.x - rect.left) * canvas.width / rect.width)));
      const y = Math.max(0, Math.min(canvas.height - 1, canvas.height - 1 - Math.floor((screen.y - rect.top) * canvas.height / rect.height)));
      const pixel = new Uint8Array(4); gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); return [...pixel];
    };
    const grid = (area) => { const pixels = []; for (let y = area.y + 1; y < area.y + area.height - 1; y += 3)
      for (let x = area.x + 1; x < area.x + area.width - 1; x += 3) pixels.push(read({ x, y, width: 1, height: 1 })); return pixels; };
    return { core: grid(fixture.coreProbe), surface: read(fixture.surfaceProbe), hole: read(fixture.authoredHole),
      notch: read(fixture.openNotch), thin: read(fixture.thinColumn), isolated: read({ ...fixture.isolated, width: 1, height: 1 }),
      wall: read(fixture.wallCoexistence), goo: read({ x: fixture.contacts.goo.x + fixture.contacts.goo.width - 1, y: fixture.contacts.goo.y + 12, width: 1, height: 1 }),
      water: read(fixture.contacts.water), metal: read(fixture.contacts.metal), blank: read(fixture.guardedBlank) };
  })()`);
}
function metrics(flat, styled) { let peak = 0, changed = 0; for (let i = 0; i < flat.length; i++) for (let c = 0; c < 3; c++) {
  const delta = styled[i][c] - flat[i][c]; peak = Math.max(peak, Math.abs(delta)); changed += Number(delta !== 0); } return { peak, changed }; }
function equal(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
