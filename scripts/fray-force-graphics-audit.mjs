const FRAY = 118;
const ARAY = 135;
const WATER = 2;
const METAL = 23;
const EMPTY = 0;

/**
 * Exact-owner native/topology and RGB-only force-emitter identity gate.
 */
export async function auditFrayForceGraphics({ cdp, mode, evaluate, waitFor, captureSettledPage, outputScale = 2, assert }) {
  if (mode !== 'webgl') return { skippedCanvasFallback: true };
  await captureSettledPage(cdp, 'WebGL initial FRAY force fixture framebuffer', outputScale === 8 ? 450 : 0);
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const required = ['frayForceGraphicsAtlas', 'prepareFrayForceGraphicsFixture',
      'setFrayForceStyling', 'frayForceStylingEnabled', 'cell', 'wall', 'resetView'];
    if (!audit || required.some((name) => typeof audit[name] !== 'function')) {
      throw new Error('FRAY force graphics audit API unavailable');
    }
    audit.resetView();
    audit.setFrayForceStyling(false);
    audit.prepareFrayForceGraphicsFixture();
    return true;
  })()`);
  const fixture = await waitFor(() => evaluate(cdp, `(() => {
    const fixture = window.__ANIFOR_INPUT_AUDIT__.frayForceGraphicsAtlas?.();
    return fixture?.material === ${FRAY} ? fixture : false;
  })()`), 15_000, 'FRAY force fixture');
  const semantics = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const fixture = audit.frayForceGraphicsAtlas();
    const at = (point) => ({ material: audit.cell(point.x, point.y), wall: audit.wall(point.x, point.y) });
    return {
      throat: at(fixture.throatProbe), axis: at(fixture.axisProbe), background: at(fixture.backgroundProbe),
      hole: at(fixture.authoredHole), channel: at(fixture.openChannel), rail: at(fixture.thinRail),
      isolated: at(fixture.isolated), wall: at(fixture.wallCoexistence),
      fray: at(fixture.contacts.fray), water: at(fixture.contacts.water), metal: at(fixture.contacts.metal),
      wrongOwner: at(fixture.wrongOwner), blank: at(fixture.guardedBlank),
    };
  })()`);
  assert(semantics.throat.material === FRAY && semantics.axis.material === FRAY
    && semantics.background.material === FRAY && semantics.hole.material === EMPTY
    && semantics.channel.material === EMPTY && semantics.rail.material === FRAY
    && semantics.isolated.material === FRAY && semantics.wall.material === FRAY && semantics.wall.wall === 1
    && semantics.fray.material === FRAY && semantics.water.material === WATER
    && semantics.metal.material === METAL && semantics.wrongOwner.material === ARAY
    && semantics.blank.material === EMPTY,
  `FRAY force fixture lost exact owner/topology/contact separation (${JSON.stringify(semantics)})`);
  if (outputScale === 8) {
    const info = await evaluate(cdp, `(() => {
      const audit = window.__ANIFOR_INPUT_AUDIT__;
      const canvas = document.querySelector('canvas.semantic-field-canvas');
      return { backend: audit.backend(), width: canvas?.width, height: canvas?.height };
    })()`);
    assert(info.backend.backend === 'webgl' && info.backend.outputScale === 8
      && info.backend.requestedOutputScale === 8 && info.width === 4896 && info.height === 3072,
    `FRAY force true-8× presentation did not promote (${JSON.stringify(info)})`);
  }
  const flat = await sample(cdp, evaluate);
  await setFray(cdp, evaluate, true);
  await captureSettledPage(cdp, 'prepared FRAY force fixture framebuffer', outputScale === 8 ? 450 : 0);
  const styled = await sample(cdp, evaluate);
  await setFray(cdp, evaluate, false);
  const repeated = await sample(cdp, evaluate);
  assert(equal(flat, repeated), 'FRAY off→on→off framebuffer was not exact');
  const response = metrics(flat.body, styled.body);
  assert(response.peak >= 2 && response.peak <= 40 && response.changed > 0,
    `FRAY body is inert or unbounded (${JSON.stringify(response)})`);
  assert(flat.body.every((pixel, index) => pixel[3] === styled.body[index][3]), 'FRAY changed semantic alpha');
  for (const key of ['hole', 'channel', 'wall', 'water', 'metal', 'wrongOwner', 'blank']) {
    assert(equal(flat[key], styled[key]), `FRAY styling changed protected ${key}`);
  }
  await setFray(cdp, evaluate, true);
  return {
    material: FRAY,
    outputScale,
    exactSemanticTopology: true,
    nativeWallCoexistence: true,
    exactOwnerControl: true,
    ...response,
    exactRepeatedOff: true,
    exactControls: true,
    rgbOnly: true,
    fixture,
  };
}

async function setFray(cdp, evaluate, enabled) {
  const observed = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    audit.setFrayForceStyling(${enabled});
    return audit.frayForceStylingEnabled();
  })()`);
  if (observed !== enabled) throw new Error(`FRAY styling control failed (${JSON.stringify({ enabled, observed })})`);
}

async function sample(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const fixture = audit.frayForceGraphicsAtlas();
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!canvas || !gl) throw new Error('FRAY force WebGL backing unavailable');
    const rect = canvas.getBoundingClientRect();
    const read = (area) => {
      const screen = audit.worldToScreen(area.x + area.width / 2, area.y + area.height / 2);
      const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((screen.x - rect.left) * canvas.width / rect.width)));
      const y = Math.max(0, Math.min(canvas.height - 1, canvas.height - 1 - Math.floor((screen.y - rect.top) * canvas.height / rect.height)));
      const pixel = new Uint8Array(4); gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); return [...pixel];
    };
    const grid = (area) => { const pixels = []; for (let y = area.y + 2; y < area.y + area.height - 2; y += 5)
      for (let x = area.x + 2; x < area.x + area.width - 2; x += 5) pixels.push(read({ x, y, width: 1, height: 1 })); return pixels; };
    return { body: grid(fixture.body), hole: read(fixture.authoredHole), channel: read(fixture.openChannel),
      wall: read(fixture.wallCoexistence), water: read(fixture.contacts.water), metal: read(fixture.contacts.metal),
      wrongOwner: read(fixture.wrongOwner), blank: read(fixture.guardedBlank) };
  })()`);
}
function metrics(flat, styled) { let peak = 0, changed = 0; for (let i = 0; i < flat.length; i++) for (let c = 0; c < 3; c++) {
  const delta = styled[i][c] - flat[i][c]; peak = Math.max(peak, Math.abs(delta)); changed += Number(delta !== 0); } return { peak, changed }; }
function equal(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
