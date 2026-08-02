const EMPTY = 0;
const DISTILLED = 34;
const DIESEL = 35;
const WATER = 2;
const OIL = 8;
const METAL = 23;

/**
 * Exact-owner liquid-identity gate for two ordinary family representatives.
 */
export async function auditDistilledDieselLiquidGraphics({
  cdp, mode, evaluate, waitFor, waitForStablePageCapture, captureSettledPage,
  outputScale = 2, assert,
}) {
  if (mode !== 'webgl') return { skippedCanvasFallback: true };
  const settle = outputScale === 8
    ? async (label) => {
      await captureSettledPage(cdp, label, 450);
      return captureSettledPage(cdp, `${label} confirmed presentation`, 0);
    }
    : (label) => waitForStablePageCapture(cdp, label);
  await settle('WebGL initial Distilled/Diesel liquid fixture framebuffer');
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const required = ['distilledDieselLiquidGraphicsAtlas', 'prepareDistilledDieselLiquidGraphicsFixture',
      'setLiquidIdentityStyling', 'cell', 'wall', 'resetView'];
    if (!audit || required.some((name) => typeof audit[name] !== 'function')) {
      throw new Error('Distilled/Diesel liquid graphics audit API unavailable');
    }
    audit.resetView();
    audit.setLiquidIdentityStyling(false);
    audit.prepareDistilledDieselLiquidGraphicsFixture();
    return true;
  })()`);
  const atlas = await waitFor(() => evaluate(cdp, `(() => {
    const cards = window.__ANIFOR_INPUT_AUDIT__.distilledDieselLiquidGraphicsAtlas()?.cards;
    return cards?.length === 2 ? cards : false;
  })()`), 15_000, 'Distilled/Diesel liquid fixture');
  assert(atlas[0]?.material === DISTILLED && atlas[0]?.code === 'DSTW'
    && atlas[1]?.material === DIESEL && atlas[1]?.code === 'DESL'
    && atlas[0]?.siblingSeam?.siblingMaterial === WATER
    && atlas[1]?.siblingSeam?.siblingMaterial === OIL,
  `Distilled/Diesel liquid atlas contract drifted (${JSON.stringify(atlas)})`);
  const semantics = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const cards = audit.distilledDieselLiquidGraphicsAtlas().cards;
    const at = (point) => ({ material: audit.cell(point.x, point.y), wall: audit.wall(point.x, point.y) });
    return cards.map((entry) => ({
      material: entry.material, surface: at(entry.surfaceProbe), core: at(entry.coreProbe),
      cavity: at(entry.cavity), chimney: at(entry.openChimney), strand: at(entry.strand),
      isolated: at(entry.isolated), wall: at(entry.wallCoexistence),
      seamOwner: at(entry.siblingSeam.owner), seamSibling: at(entry.siblingSeam.sibling),
      metalOwner: at(entry.metalContact.owner), metal: at(entry.metalContact.metal),
      blank: at(entry.guardedBlank),
    }));
  })()`);
  assert(semantics[0]?.material === DISTILLED
    && semantics[0].surface.material === DISTILLED && semantics[0].core.material === DISTILLED
    && semantics[0].cavity.material === EMPTY && semantics[0].chimney.material === EMPTY
    && semantics[0].strand.material === DISTILLED && semantics[0].isolated.material === DISTILLED
    && semantics[0].wall.material === DISTILLED && semantics[0].wall.wall === 1
    && semantics[0].seamOwner.material === DISTILLED && semantics[0].seamSibling.material === WATER
    && semantics[0].metalOwner.material === DISTILLED && semantics[0].metal.material === METAL
    && semantics[0].blank.material === EMPTY
    && semantics[1]?.material === DIESEL
    && semantics[1].surface.material === DIESEL && semantics[1].core.material === DIESEL
    && semantics[1].cavity.material === EMPTY && semantics[1].chimney.material === EMPTY
    && semantics[1].strand.material === DIESEL && semantics[1].isolated.material === DIESEL
    && semantics[1].wall.material === DIESEL && semantics[1].wall.wall === 1
    && semantics[1].seamOwner.material === DIESEL && semantics[1].seamSibling.material === OIL
    && semantics[1].metalOwner.material === DIESEL && semantics[1].metal.material === METAL
    && semantics[1].blank.material === EMPTY,
  `Distilled/Diesel liquid fixture lost exact topology/wall/seam separation (${JSON.stringify(semantics)})`);
  if (outputScale === 8) {
    const info = await evaluate(cdp, `(() => {
      const audit = window.__ANIFOR_INPUT_AUDIT__;
      const canvas = document.querySelector('canvas.semantic-field-canvas');
      return { backend: audit.backend(), width: canvas?.width, height: canvas?.height };
    })()`);
    assert(info.backend.backend === 'webgl' && info.backend.outputScale === 8
      && info.backend.requestedOutputScale === 8 && info.width === 4896 && info.height === 3072,
    `Distilled/Diesel liquid true-8× presentation did not promote (${JSON.stringify(info)})`);
  }
  const flat = await sample(cdp, evaluate);
  await setIdentity(cdp, evaluate, true);
  await settle('styled Distilled/Diesel liquid framebuffer');
  const styled = await sample(cdp, evaluate);
  await setIdentity(cdp, evaluate, false);
  await settle('repeated flat Distilled/Diesel liquid framebuffer');
  const repeated = await sample(cdp, evaluate);
  assert(equal(flat, repeated), 'Distilled/Diesel off→on→off framebuffer was not exact');
  const cards = flat.cards.map((entry, index) => {
    const response = metrics(entry.core, styled.cards[index].core);
    assert(response.peak >= 1 && response.peak <= 48 && response.changed > 0,
      `Distilled/Diesel ${entry.code} core is inert or unbounded (${JSON.stringify(response)})`);
    assert(entry.core.every((pixel, pixelIndex) => pixel[3] === styled.cards[index].core[pixelIndex][3]),
      `Distilled/Diesel ${entry.code} changed semantic alpha`);
    for (const key of ['surface', 'cavity', 'chimney', 'strand', 'isolated', 'wall', 'seamOwner', 'seamSibling', 'metalOwner', 'metal', 'blank']) {
      assert(equal(entry[key], styled.cards[index][key]), `Distilled/Diesel ${entry.code} changed protected ${key}`);
    }
    return { code: entry.code, material: entry.material, ...response };
  });
  await setIdentity(cdp, evaluate, true);
  return {
    outputScale,
    cards,
    exactSemanticTopology: true,
    nativeWallCoexistence: true,
    exactRelatedLiquidSeams: true,
    exactRepeatedOff: true,
    exactControls: true,
    rgbOnly: true,
  };
}

async function setIdentity(cdp, evaluate, enabled) {
  await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.setLiquidIdentityStyling(${enabled}); true`);
}

async function sample(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!canvas || !gl) throw new Error('Distilled/Diesel WebGL backing unavailable');
    const rect = canvas.getBoundingClientRect();
    const read = (area) => { const screen = audit.worldToScreen(area.x + area.width / 2, area.y + area.height / 2);
      const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((screen.x - rect.left) * canvas.width / rect.width)));
      const y = Math.max(0, Math.min(canvas.height - 1, canvas.height - 1 - Math.floor((screen.y - rect.top) * canvas.height / rect.height)));
      const pixel = new Uint8Array(4); gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); return [...pixel]; };
    const grid = (area) => { const pixels = []; for (let y = area.y + 1; y < area.y + area.height - 1; y += 3)
      for (let x = area.x + 1; x < area.x + area.width - 1; x += 3) pixels.push(read({ x, y, width: 1, height: 1 })); return pixels; };
    return { cards: audit.distilledDieselLiquidGraphicsAtlas().cards.map((entry) => ({
      code: entry.code, material: entry.material, core: grid(entry.coreProbe), surface: read(entry.surfaceProbe),
      cavity: read(entry.cavity), chimney: read(entry.openChimney), strand: read(entry.strand), isolated: read({ ...entry.isolated, width: 1, height: 1 }),
      wall: read(entry.wallCoexistence), seamOwner: read({ x: entry.siblingSeam.owner.x + entry.siblingSeam.owner.width - 1, y: entry.siblingSeam.owner.y + 12, width: 1, height: 1 }),
      seamSibling: read(entry.siblingSeam.sibling), metalOwner: read({ x: entry.metalContact.owner.x + entry.metalContact.owner.width - 1, y: entry.metalContact.owner.y + 12, width: 1, height: 1 }),
      metal: read(entry.metalContact.metal), blank: read(entry.guardedBlank),
    })) };
  })()`);
}
function metrics(flat, styled) { let peak = 0, changed = 0; for (let i = 0; i < flat.length; i++) for (let c = 0; c < 3; c++) { const delta = styled[i][c] - flat[i][c]; peak = Math.max(peak, Math.abs(delta)); changed += Number(delta !== 0); } return { peak, changed }; }
function equal(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
