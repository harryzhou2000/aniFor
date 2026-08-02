const EXPECTED_CARDS = [
  { code: 'SAND', material: 1 },
  { code: 'STNE', material: 21 },
  { code: 'CLAY', material: 28 },
  { code: 'CNCT', material: 26 },
];
const WATER_MATERIAL = 2;
const EMPTY_MATERIAL = 0;

/**
 * Canonical WebGL gate for the stable-Smooth powder mesostrata grammar.
 *
 * The fixture deliberately includes topology that must not receive the deep
 * body treatment: authored holes, a one-cell column, a single grain, two
 * unstable cells, a water contact, and a co-located native wall.  It also
 * checks that the retained Local and square-Grains modes are exact no-ops
 * when the optional grammar is toggled.
 */
export async function auditPowderMesostrataGraphics({
  cdp, mode, evaluate, waitFor, waitForStablePageCapture, captureSettledPage,
  outputScale = 2, assert,
}) {
  if (mode !== 'webgl') return { skippedCanvasFallback: true };
  const settle = outputScale === 8
    ? async (label) => {
      // The first completed direct frame may consume a previously coalesced
      // field mutation.  Own a second zero-delay presentation after that
      // fence: this is the exact state sampled by the following readPixels,
      // rather than an arbitrary delay after the off/on toggle.
      await captureSettledPage(cdp, label, 450);
      return captureSettledPage(cdp, `${label} confirmed presentation`, 0);
    }
    : (label) => waitForStablePageCapture(cdp, label);
  const dpr = await evaluate(cdp, 'window.devicePixelRatio');
  assert(dpr === 1, `Powder mesostrata gate requires WebGL DPR 1 (received ${dpr})`);
  await settle('WebGL initial powder-mesostrata framebuffer');
  await requireApi(evaluate, cdp);

  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    audit.setPowderRenderStyle('smooth');
    audit.setPowderMesostrataStyling(false);
    audit.preparePowderMesostrataGraphicsFixture();
    return true;
  })()`);
  const atlas = await waitFor(() => evaluate(cdp, `(() => {
    const cards = window.__ANIFOR_INPUT_AUDIT__.powderMesostrataGraphicsAtlas()?.cards;
    return cards?.length === ${EXPECTED_CARDS.length} ? cards : false;
  })()`), 15_000, 'WebGL powder mesostrata fixture');
  assert(atlas.every((entry, index) => matchesCard(entry, EXPECTED_CARDS[index])),
    `Powder mesostrata atlas contract drifted (${JSON.stringify(atlas)})`);

  const semantic = await semanticSnapshot(cdp, evaluate);
  assertSemantics(semantic, assert);
  if (outputScale === 8) await assertTrueEightX(cdp, evaluate, assert);

  const flat = await settleFlatBaseline({ cdp, evaluate, settle, outputScale, assert });
  await setMesostrata(cdp, evaluate, true);
  await settle('styled Smooth powder-mesostrata framebuffer');
  const styled = await sample(cdp, evaluate);
  await setMesostrata(cdp, evaluate, false);
  await settle('repeated flat Smooth powder-mesostrata framebuffer');
  const repeated = await sample(cdp, evaluate);

  assert(exactSample(flat, repeated),
    `Powder mesostrata Smooth off→on→off framebuffer was not exact (${JSON.stringify(
      sampleDifference(flat, repeated),
    )})`);
  const cards = flat.cards.map((entry, index) => {
    const changed = styled.cards[index];
    const response = responseMetrics(entry.core, changed.core);
    assert(response.peak >= 2 && response.peak <= 48 && response.changed > 0,
      `Powder mesostrata ${entry.code} core is inert or unbounded (${JSON.stringify(response)})`);
    assert(entry.core.every((pixel, pixelIndex) => pixel[3] === changed.core[pixelIndex][3]),
      `Powder mesostrata ${entry.code} changed semantic alpha`);
    assert(exactControls(entry, changed),
      `Powder mesostrata ${entry.code} changed a protected topology/contact control (${JSON.stringify(
        protectedControlDifference(entry, changed),
      )})`);
    return { code: entry.code, material: entry.material, ...response };
  });

  const local = await captureProtectedMode({ cdp, evaluate, settle, style: 'local' });
  const grains = await captureProtectedMode({ cdp, evaluate, settle, style: 'grains' });
  assert(exactSample(local.flat, local.styled),
    'Powder mesostrata leaked into protected Local powder rendering');
  assert(exactSample(grains.flat, grains.styled),
    'Powder mesostrata leaked into protected square Grains rendering');
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    audit.setPowderRenderStyle('smooth');
    audit.setPowderMesostrataStyling(true);
    return true;
  })()`);

  return {
    dpr,
    outputScale,
    cards,
    exactRepeatedOff: true,
    protectedLocal: true,
    protectedGrains: true,
    exactControls: true,
    rgbOnly: true,
  };
}

async function requireApi(evaluate, cdp) {
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const required = [
      'setPowderMesostrataStyling', 'setPowderRenderStyle',
      'powderMesostrataGraphicsAtlas', 'preparePowderMesostrataGraphicsFixture',
    ];
    if (!audit || required.some((name) => typeof audit[name] !== 'function')) {
      throw new Error('Powder mesostrata graphics audit API unavailable');
    }
    audit.resetView();
    return true;
  })()`);
}

async function semanticSnapshot(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const cards = audit.powderMesostrataGraphicsAtlas().cards;
    const at = (point) => ({ material: audit.cell(point.x, point.y), wall: audit.wall(point.x, point.y) });
    return cards.map((entry) => ({
      body: at(entry.coreProbe),
      hole: at(entry.authoredHole),
      thin: at(entry.thinColumn),
      single: at(entry.singleGrain),
      unstable: entry.unstablePair.map(at),
      wetPowder: at(entry.wetContact.powder),
      wetWater: at(entry.wetContact.water),
      wall: at(entry.wallCoexistence),
      blank: at(entry.guardedBlank),
    }));
  })()`);
}

function assertSemantics(semantic, assert) {
  assert(semantic.every((entry, index) => {
    const expected = EXPECTED_CARDS[index].material;
    return entry.body.material === expected
      && entry.hole.material === EMPTY_MATERIAL
      && entry.thin.material === expected
      && entry.single.material === expected
      && entry.unstable.every(({ material }) => material === expected)
      && entry.wetPowder.material === expected
      && entry.wetWater.material === WATER_MATERIAL
      && entry.wall.material === expected && entry.wall.wall === 1
      && entry.blank.material === EMPTY_MATERIAL;
  }), `Powder mesostrata fixture lost body/hole/grain/contact/wall separation (${JSON.stringify(semantic)})`);
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
  `Powder mesostrata true-8× presentation did not promote (${JSON.stringify(info)})`);
}

/**
 * A fixture plane lands immediately, but its field-owned powder body may not:
 * the first direct-8× frame can still be building the shared powder surface
 * and auxiliary stability texture.  Establish an exact *flat* readback pair
 * before the off→on→off triplet, so the later repeat proves only the toggle
 * and not fixture construction.  This is intentionally not a tolerance.
 */
async function settleFlatBaseline({ cdp, evaluate, settle, outputScale, assert }) {
  await settle('flat Smooth powder-mesostrata framebuffer');
  let flat = await sample(cdp, evaluate);
  if (outputScale !== 8) return flat;
  let auxiliary = await powderAuxiliarySnapshot(cdp, evaluate);
  for (let attempt = 1; attempt <= 3; attempt++) {
    await settle(`flat Smooth powder-mesostrata stability ${attempt}`);
    const confirmation = await sample(cdp, evaluate);
    const nextAuxiliary = await powderAuxiliarySnapshot(cdp, evaluate);
    if (exactSample(flat, confirmation) && exactAuxiliary(auxiliary, nextAuxiliary)) return confirmation;
    const diagnostic = {
      attempt,
      framebuffer: sampleDifference(flat, confirmation),
      auxiliary: { before: auxiliary, after: nextAuxiliary },
    };
    if (attempt === 3) {
      assert(false, `Powder mesostrata 8× flat baseline did not stabilize (${JSON.stringify(diagnostic)})`);
    }
    flat = confirmation;
    auxiliary = nextAuxiliary;
  }
  throw new Error('Powder mesostrata baseline stability loop exhausted');
}

async function powderAuxiliarySnapshot(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    return audit.powderMesostrataGraphicsAtlas().cards.map((entry) => ({
      code: entry.code,
      core: audit.presentationAuxiliary(entry.coreProbe.x + Math.floor(entry.coreProbe.width / 2),
        entry.coreProbe.y + Math.floor(entry.coreProbe.height / 2)),
      surface: audit.presentationAuxiliary(entry.surfaceProbe.x + Math.floor(entry.surfaceProbe.width / 2),
        entry.surfaceProbe.y + Math.floor(entry.surfaceProbe.height / 2)),
      thin: audit.presentationAuxiliary(entry.thinColumn.x, entry.thinColumn.y + 2),
      unstable: entry.unstablePair.map((point) => audit.presentationAuxiliary(point.x, point.y)),
    }));
  })()`);
}

async function captureProtectedMode({ cdp, evaluate, settle, style }) {
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    audit.setPowderRenderStyle(${JSON.stringify(style)});
    audit.setPowderMesostrataStyling(false);
    return true;
  })()`);
  await settle(`flat ${style} powder-mesostrata framebuffer`);
  const flat = await sample(cdp, evaluate);
  await setMesostrata(cdp, evaluate, true);
  await settle(`styled ${style} powder-mesostrata framebuffer`);
  const styled = await sample(cdp, evaluate);
  return { flat, styled };
}

function setMesostrata(cdp, evaluate, enabled) {
  return evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.setPowderMesostrataStyling(${enabled}); true;`);
}

async function sample(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!canvas || !gl) throw new Error('Powder mesostrata WebGL backing unavailable');
    const rect = canvas.getBoundingClientRect();
    const read = (point) => {
      const screen = audit.worldToScreen(point.x + point.width / 2, point.y + point.height / 2);
      const x = Math.max(0, Math.min(canvas.width - 1,
        Math.floor((screen.x - rect.left) * canvas.width / rect.width)));
      const y = Math.max(0, Math.min(canvas.height - 1,
        canvas.height - 1 - Math.floor((screen.y - rect.top) * canvas.height / rect.height)));
      const pixel = new Uint8Array(4);
      gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return Array.from(pixel);
    };
    const point = (value) => ({ x: value.x, y: value.y, width: 1, height: 1 });
    const grid = (area) => {
      const cells = [];
      for (let y = area.y + 1; y < area.y + area.height - 1; y += 3) {
        for (let x = area.x + 1; x < area.x + area.width - 1; x += 3) cells.push(read({ x, y, width: 1, height: 1 }));
      }
      return cells;
    };
    return {
      cards: audit.powderMesostrataGraphicsAtlas().cards.map((entry) => ({
        code: entry.code,
        material: entry.material,
        core: grid(entry.coreProbe),
        surface: grid(entry.surfaceProbe),
        hole: read(entry.authoredHole),
        thin: read(entry.thinColumn),
        single: read(point(entry.singleGrain)),
        unstable: entry.unstablePair.map((value) => read(point(value))),
        // The contact control must sample the powder cell that actually touches
        // the aqueous slab, rather than the centre of its wider support body.
        wetPowder: read({
          x: entry.wetContact.powder.x + entry.wetContact.powder.width - 1,
          y: entry.wetContact.powder.y + Math.floor(entry.wetContact.powder.height / 2),
          width: 1,
          height: 1,
        }),
        wetWater: read(entry.wetContact.water),
        wall: read(entry.wallCoexistence),
        blank: read(entry.guardedBlank),
      })),
    };
  })()`);
}

function exactControls(flat, styled) {
  return equal(flat.hole, styled.hole)
    && equal(flat.thin, styled.thin)
    && equal(flat.single, styled.single)
    && equalNested(flat.unstable, styled.unstable)
    && equal(flat.wetPowder, styled.wetPowder)
    && equal(flat.wetWater, styled.wetWater)
    && equal(flat.wall, styled.wall)
    && equal(flat.blank, styled.blank);
}

function protectedControlDifference(flat, styled) {
  const controls = ['hole', 'thin', 'single', 'unstable', 'wetPowder', 'wetWater', 'wall', 'blank'];
  return Object.fromEntries(controls.filter((key) => !equalNested(flat[key], styled[key]))
    .map((key) => [key, { before: flat[key], after: styled[key] }]));
}

function responseMetrics(flat, styled) {
  let peak = 0;
  let changed = 0;
  for (let index = 0; index < flat.length; index++) {
    for (let channel = 0; channel < 3; channel++) {
      const delta = styled[index][channel] - flat[index][channel];
      peak = Math.max(peak, Math.abs(delta));
      changed += Number(delta !== 0);
    }
  }
  return { peak, changed };
}

function sampleDifference(left, right) {
  let changed = 0;
  let peak = 0;
  let worst = undefined;
  const cards = [];
  for (let card = 0; card < left.cards.length; card++) {
    let cardChanged = 0;
    let cardPeak = 0;
    forEachBytePair(left.cards[card], right.cards[card], '', (before, after, path) => {
      const delta = Math.abs(after - before);
      peak = Math.max(peak, delta);
      changed += Number(delta !== 0);
      cardPeak = Math.max(cardPeak, delta);
      cardChanged += Number(delta !== 0);
      if (!worst || delta > worst.delta) {
        worst = { card: left.cards[card].code, path, before, after, delta };
      }
    });
    cards.push({ code: left.cards[card].code, changed: cardChanged, peak: cardPeak });
  }
  return { changed, peak, worst, cards };
}

function forEachBytePair(left, right, path, visit) {
  if (Array.isArray(left) && Array.isArray(right)) {
    for (let index = 0; index < left.length; index++) {
      forEachBytePair(left[index], right[index], `${path}[${index}]`, visit);
    }
  } else if (typeof left === 'number' && typeof right === 'number') {
    visit(left, right, path);
  } else if (left && right && typeof left === 'object' && typeof right === 'object') {
    for (const key of Object.keys(left)) {
      if (key in right) forEachBytePair(left[key], right[key], path ? `${path}.${key}` : key, visit);
    }
  }
}

function exactAuxiliary(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function exactSample(left, right) {
  return left.cards.length === right.cards.length
    && left.cards.every((entry, index) => entry.code === right.cards[index].code
      && entry.material === right.cards[index].material
      && equalNested(Object.values(entry).filter((value) => Array.isArray(value)),
        Object.values(right.cards[index]).filter((value) => Array.isArray(value))));
}

function matchesCard(entry, expected) {
  return entry.code === expected.code && entry.material === expected.material;
}
function equalNested(left, right) {
  return left.length === right.length && left.every((value, index) => Array.isArray(value)
    ? equalNested(value, right[index]) : value === right[index]);
}
function equal(left, right) {
  return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length && left.every((value, index) => value === right[index]);
}
