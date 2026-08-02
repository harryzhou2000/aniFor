const EXPECTED_CARDS = [
  { code: 'HEAC', material: 72 },
  { code: 'PTNM', material: 75 },
  { code: 'RSSS', material: 79 },
];
const WATER_MATERIAL = 2;
const EMPTY_MATERIAL = 0;

/**
 * Canonical WebGL fixture gate for the next thermal/catalytic rigid-material
 * optics. It proves the optional RGB-only layer without allowing it to claim
 * holes, fine geometry, native walls, or a direct liquid contact.
 */
export async function auditThermalCatalyticRigidGraphics({
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
  const dpr = await evaluate(cdp, 'window.devicePixelRatio');
  assert(dpr === 1, `Thermal/catalytic rigid gate requires WebGL DPR 1 (received ${dpr})`);
  await settle('WebGL initial thermal/catalytic rigid framebuffer');
  await requireApi(evaluate, cdp);

  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    audit.setThermalCatalyticRigidStyling(false);
    audit.prepareThermalCatalyticRigidGraphicsFixture();
    return true;
  })()`);
  const atlas = await waitFor(() => evaluate(cdp, `(() => {
    const cards = window.__ANIFOR_INPUT_AUDIT__.thermalCatalyticRigidGraphicsAtlas()?.cards;
    return cards?.length === ${EXPECTED_CARDS.length} ? cards : false;
  })()`), 15_000, 'WebGL thermal/catalytic rigid fixture');
  assert(atlas.every((entry, index) => matchesCard(entry, EXPECTED_CARDS[index])),
    `Thermal/catalytic rigid atlas contract drifted (${JSON.stringify(atlas)})`);
  const semantic = await semanticSnapshot(cdp, evaluate);
  assertSemantics(semantic, assert);
  if (outputScale === 8) await assertTrueEightX(cdp, evaluate, assert);

  const flat = await settleFlatBaseline({ cdp, evaluate, settle, outputScale, assert });
  await setThermalCatalytic(cdp, evaluate, true);
  await settle('styled thermal/catalytic rigid framebuffer');
  const styled = await sample(cdp, evaluate);
  await setThermalCatalytic(cdp, evaluate, false);
  await settle('repeated flat thermal/catalytic rigid framebuffer');
  const repeated = await sample(cdp, evaluate);
  assert(exactSample(flat, repeated),
    `Thermal/catalytic off→on→off framebuffer was not exact (${JSON.stringify(sampleDifference(flat, repeated))})`);
  const cards = flat.cards.map((entry, index) => {
    const changed = styled.cards[index];
    const response = responseMetrics(entry.core, changed.core);
    assert(response.peak >= 2 && response.peak <= 48 && response.changed > 0,
      `Thermal/catalytic ${entry.code} core is inert or unbounded (${JSON.stringify(response)})`);
    assert(entry.core.every((pixel, pixelIndex) => pixel[3] === changed.core[pixelIndex][3]),
      `Thermal/catalytic ${entry.code} changed semantic alpha`);
    assert(exactControls(entry, changed),
      `Thermal/catalytic ${entry.code} changed a protected topology/contact control (${JSON.stringify(
        protectedControlDifference(entry, changed),
      )})`);
    return { code: entry.code, material: entry.material, ...response };
  });
  await setThermalCatalytic(cdp, evaluate, true);
  return { dpr, outputScale, cards, exactSemanticTopology: true, exactRepeatedOff: true, exactControls: true, rgbOnly: true };
}

async function requireApi(evaluate, cdp) {
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const required = [
      'setThermalCatalyticRigidStyling', 'thermalCatalyticRigidStylingEnabled',
      'thermalCatalyticRigidGraphicsAtlas', 'prepareThermalCatalyticRigidGraphicsFixture',
      'cell', 'wall', 'resetView',
    ];
    if (!audit || required.some((name) => typeof audit[name] !== 'function')) {
      throw new Error('Thermal/catalytic rigid graphics audit API unavailable');
    }
    audit.resetView();
    return true;
  })()`);
}

async function semanticSnapshot(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const cards = audit.thermalCatalyticRigidGraphicsAtlas().cards;
    const at = (point) => ({ material: audit.cell(point.x, point.y), wall: audit.wall(point.x, point.y) });
    return cards.map((entry) => ({
      core: at(entry.coreProbe),
      hole: at(entry.authoredHole),
      thin: at(entry.thinColumn),
      isolated: at(entry.isolated),
      wall: at(entry.wallCoexistence),
      contactSolid: at(entry.contact.solid),
      contactWater: at(entry.contact.water),
      blank: at(entry.guardedBlank),
    }));
  })()`);
}

function assertSemantics(semantic, assert) {
  assert(semantic.every((entry, index) => {
    const expected = EXPECTED_CARDS[index].material;
    return entry.core.material === expected
      && entry.hole.material === EMPTY_MATERIAL
      && entry.thin.material === expected
      && entry.isolated.material === expected
      && entry.wall.material === expected && entry.wall.wall === 1
      && entry.contactSolid.material === expected
      && entry.contactWater.material === WATER_MATERIAL
      && entry.blank.material === EMPTY_MATERIAL;
  }), `Thermal/catalytic rigid fixture lost body/hole/thin/wall/contact separation (${JSON.stringify(semantic)})`);
}

async function assertTrueEightX(cdp, evaluate, assert) {
  const info = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    return { backend: audit.backend(), width: canvas?.width, height: canvas?.height };
  })()`);
  assert(info.backend.backend === 'webgl' && info.backend.outputScale === 8
      && info.backend.requestedOutputScale === 8
      && info.width === 4896 && info.height === 3072,
  `Thermal/catalytic rigid true-8× presentation did not promote (${JSON.stringify(info)})`);
}

function matchesCard(actual, expected) {
  return actual?.code === expected.code && actual.material === expected.material;
}

async function settleFlatBaseline({ cdp, evaluate, settle, outputScale, assert }) {
  await settle('flat thermal/catalytic rigid framebuffer');
  let flat = await sample(cdp, evaluate);
  const attempts = outputScale === 8 ? 3 : 1;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await settle(`flat thermal/catalytic rigid stability ${attempt}`);
    const confirmation = await sample(cdp, evaluate);
    if (exactSample(flat, confirmation)) return confirmation;
    if (attempt === attempts) {
      assert(false, `Thermal/catalytic ${outputScale}× flat baseline did not stabilize (${JSON.stringify(
        sampleDifference(flat, confirmation),
      )})`);
    }
    flat = confirmation;
  }
  throw new Error('Thermal/catalytic baseline stability loop exhausted');
}

async function setThermalCatalytic(cdp, evaluate, enabled) {
  const observed = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    audit.setThermalCatalyticRigidStyling(${enabled});
    return audit.thermalCatalyticRigidStylingEnabled();
  })()`);
  if (observed !== enabled) {
    throw new Error(`Thermal/catalytic styling control did not reach the active presenter (${JSON.stringify({ enabled, observed })})`);
  }
}

async function sample(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!canvas || !gl) throw new Error('Thermal/catalytic WebGL backing unavailable');
    const rect = canvas.getBoundingClientRect();
    const read = (area) => {
      const screen = audit.worldToScreen(area.x + area.width / 2, area.y + area.height / 2);
      const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((screen.x - rect.left) * canvas.width / rect.width)));
      const y = Math.max(0, Math.min(canvas.height - 1, canvas.height - 1 - Math.floor((screen.y - rect.top) * canvas.height / rect.height)));
      const pixel = new Uint8Array(4);
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return Array.from(pixel);
    };
    const point = (value) => ({ x: value.x, y: value.y, width: 1, height: 1 });
    const grid = (area) => {
      const cells = [];
      for (let y = area.y + 1; y < area.y + area.height - 1; y += 3) {
        for (let x = area.x + 1; x < area.x + area.width - 1; x += 3) cells.push(read(point({ x, y })));
      }
      return cells;
    };
    return { cards: audit.thermalCatalyticRigidGraphicsAtlas().cards.map((entry) => ({
      code: entry.code, material: entry.material, core: grid(entry.coreProbe),
      hole: read(entry.authoredHole), thin: read(entry.thinColumn), isolated: read(point(entry.isolated)),
      wall: read(entry.wallCoexistence),
      contactSolid: read({ x: entry.contact.solid.x + entry.contact.solid.width - 1,
        y: entry.contact.solid.y + Math.floor(entry.contact.solid.height / 2), width: 1, height: 1 }),
      contactWater: read(entry.contact.water), blank: read(entry.guardedBlank),
    })) };
  })()`);
}

function exactControls(flat, styled) {
  return equal(flat.hole, styled.hole) && equal(flat.thin, styled.thin)
    && equal(flat.isolated, styled.isolated) && equal(flat.wall, styled.wall)
    && equal(flat.contactSolid, styled.contactSolid) && equal(flat.contactWater, styled.contactWater)
    && equal(flat.blank, styled.blank);
}

function protectedControlDifference(flat, styled) {
  const controls = ['hole', 'thin', 'isolated', 'wall', 'contactSolid', 'contactWater', 'blank'];
  return Object.fromEntries(controls.filter((key) => !equal(flat[key], styled[key]))
    .map((key) => [key, { before: flat[key], after: styled[key] }]));
}

function responseMetrics(flat, styled) {
  let peak = 0;
  let changed = 0;
  for (let index = 0; index < flat.length; index++) for (let channel = 0; channel < 3; channel++) {
    const delta = styled[index][channel] - flat[index][channel];
    peak = Math.max(peak, Math.abs(delta));
    changed += Number(delta !== 0);
  }
  return { peak, changed };
}

function exactSample(left, right) { return equal(left, right); }
function equal(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

function sampleDifference(left, right) {
  let changed = 0;
  let peak = 0;
  for (let card = 0; card < left.cards.length; card++) {
    for (const key of Object.keys(left.cards[card])) {
      const before = left.cards[card][key];
      const after = right.cards[card][key];
      if (!Array.isArray(before)) continue;
      const leftBytes = JSON.stringify(before);
      const rightBytes = JSON.stringify(after);
      changed += Number(leftBytes !== rightBytes);
      if (leftBytes !== rightBytes) peak = Math.max(peak, 1);
    }
  }
  return { changed, peak };
}
