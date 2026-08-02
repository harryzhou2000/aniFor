const EXPECTED_CARDS = [
  { code: 'COAL', material: 19 },
  { code: 'ROCK', material: 78 },
];
const WATER_MATERIAL = 2;
const EMPTY_MATERIAL = 0;

/**
 * Canonical WebGL gate for exact-owner Coal/ROCK deep-body geological optics.
 *
 * The fixture excludes its authored cavity, thin/isolated owners, native wall,
 * and direct water contact from the optional RGB layer. Powder Local is also
 * deliberately irrelevant: these are solids, not a powder-style projection.
 */
export async function auditGeologicalSolidGraphics({
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
  assert(dpr === 1, `Geological solid gate requires WebGL DPR 1 (received ${dpr})`);
  await settle('WebGL initial geological-solid framebuffer');
  await requireApi(evaluate, cdp);

  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    audit.setPowderRenderStyle('smooth');
    audit.setGeologicalSolidStyling(false);
    audit.prepareGeologicalSolidGraphicsFixture();
    return true;
  })()`);
  const atlas = await waitFor(() => evaluate(cdp, `(() => {
    const cards = window.__ANIFOR_INPUT_AUDIT__.geologicalSolidGraphicsAtlas()?.cards;
    return cards?.length === ${EXPECTED_CARDS.length} ? cards : false;
  })()`), 15_000, 'WebGL geological solid fixture');
  assert(atlas.every((entry, index) => matchesCard(entry, EXPECTED_CARDS[index])),
    `Geological solid atlas contract drifted (${JSON.stringify(atlas)})`);

  const semantic = await semanticSnapshot(cdp, evaluate);
  assertSemantics(semantic, assert);
  if (outputScale === 8) await assertTrueEightX(cdp, evaluate, assert);

  const flat = await settleFlatBaseline({ cdp, evaluate, settle, outputScale, assert });
  await setGeological(cdp, evaluate, true);
  await settle('styled geological-solid framebuffer');
  const styled = await sample(cdp, evaluate);
  await setGeological(cdp, evaluate, false);
  await settle('repeated flat geological-solid framebuffer');
  const repeated = await sample(cdp, evaluate);

  assert(exactSample(flat, repeated),
    `Geological solid off→on→off framebuffer was not exact (${JSON.stringify(sampleDifference(flat, repeated))})`);
  const cards = flat.cards.map((entry, index) => {
    const changed = styled.cards[index];
    const response = responseMetrics(entry.core, changed.core);
    assert(response.peak >= 2 && response.peak <= 48 && response.changed > 0,
      `Geological solid ${entry.code} core is inert or unbounded (${JSON.stringify({
        ...response, auxiliary: entry.auxiliary, renderedMaterial: entry.renderedMaterial,
      })})`);
    assert(entry.core.every((pixel, pixelIndex) => pixel[3] === changed.core[pixelIndex][3]),
      `Geological solid ${entry.code} changed semantic alpha`);
    assert(exactControls(entry, changed),
      `Geological solid ${entry.code} changed a protected topology/contact control (${JSON.stringify(
        protectedControlDifference(entry, changed),
      )})`);
    return { code: entry.code, material: entry.material, ...response };
  });

  const local = await captureLocalIrrelevance({ cdp, evaluate, settle });
  assert(exactSample(styled, local.styled),
    'Geological solid styling changed when the irrelevant powder mode switched to Local');
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    audit.setPowderRenderStyle('smooth');
    audit.setGeologicalSolidStyling(true);
    return true;
  })()`);

  return {
    dpr,
    outputScale,
    cards,
    exactRepeatedOff: true,
    exactControls: true,
    rgbOnly: true,
    powderLocalIrrelevant: true,
  };
}

async function requireApi(evaluate, cdp) {
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const required = [
      'setGeologicalSolidStyling', 'setPowderRenderStyle',
      'geologicalSolidGraphicsAtlas', 'prepareGeologicalSolidGraphicsFixture',
    ];
    if (!audit || required.some((name) => typeof audit[name] !== 'function')) {
      throw new Error('Geological solid graphics audit API unavailable');
    }
    audit.resetView();
    return true;
  })()`);
}

async function semanticSnapshot(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const cards = audit.geologicalSolidGraphicsAtlas().cards;
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
  }), `Geological solid fixture lost body/hole/thin/wall/contact separation (${JSON.stringify(semantic)})`);
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
  `Geological solid true-8× presentation did not promote (${JSON.stringify(info)})`);
}

async function settleFlatBaseline({ cdp, evaluate, settle, outputScale, assert }) {
  await settle('flat geological-solid framebuffer');
  let flat = await sample(cdp, evaluate);
  const attempts = outputScale === 8 ? 3 : 1;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await settle(`flat geological-solid stability ${attempt}`);
    const confirmation = await sample(cdp, evaluate);
    if (exactSample(flat, confirmation)) return confirmation;
    if (attempt === attempts) {
      assert(false, `Geological solid ${outputScale}× flat baseline did not stabilize (${JSON.stringify(
        sampleDifference(flat, confirmation),
      )})`);
    }
    flat = confirmation;
  }
  throw new Error('Geological solid baseline stability loop exhausted');
}

async function captureLocalIrrelevance({ cdp, evaluate, settle }) {
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    audit.setPowderRenderStyle('local');
    audit.setGeologicalSolidStyling(false);
    return true;
  })()`);
  await settle('flat Local geological-solid framebuffer');
  const flat = await sample(cdp, evaluate);
  await setGeological(cdp, evaluate, true);
  await settle('styled Local geological-solid framebuffer');
  const styled = await sample(cdp, evaluate);
  return { flat, styled };
}

async function setGeological(cdp, evaluate, enabled) {
  const observed = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    audit.setGeologicalSolidStyling(${enabled});
    return audit.geologicalSolidStylingEnabled();
  })()`);
  if (observed !== enabled) {
    throw new Error(`Geological solid styling control did not reach the active presenter (${JSON.stringify({ enabled, observed })})`);
  }
}

async function sample(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!canvas || !gl) throw new Error('Geological solid WebGL backing unavailable');
    const rect = canvas.getBoundingClientRect();
    const read = (area) => {
      const screen = audit.worldToScreen(area.x + area.width / 2, area.y + area.height / 2);
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
        for (let x = area.x + 1; x < area.x + area.width - 1; x += 3) cells.push(read(point({ x, y })));
      }
      return cells;
    };
    return {
      cards: audit.geologicalSolidGraphicsAtlas().cards.map((entry) => ({
        code: entry.code,
        material: entry.material,
        core: grid(entry.coreProbe),
        auxiliary: audit.presentationAuxiliary(
          entry.coreProbe.x + Math.floor(entry.coreProbe.width / 2),
          entry.coreProbe.y + Math.floor(entry.coreProbe.height / 2),
        ),
        renderedMaterial: audit.renderedCell(
          entry.coreProbe.x + Math.floor(entry.coreProbe.width / 2),
          entry.coreProbe.y + Math.floor(entry.coreProbe.height / 2),
        ),
        stylingEnabled: audit.geologicalSolidStylingEnabled(),
        hole: read(entry.authoredHole),
        thin: read(entry.thinColumn),
        isolated: read(point(entry.isolated)),
        wall: read(entry.wallCoexistence),
        contactSolid: read({
          x: entry.contact.solid.x + entry.contact.solid.width - 1,
          y: entry.contact.solid.y + Math.floor(entry.contact.solid.height / 2), width: 1, height: 1,
        }),
        contactWater: read(entry.contact.water),
        blank: read(entry.guardedBlank),
      })),
    };
  })()`);
}

function exactControls(flat, styled) {
  return equal(flat.hole, styled.hole)
    && equal(flat.thin, styled.thin)
    && equal(flat.isolated, styled.isolated)
    && equal(flat.wall, styled.wall)
    && equal(flat.contactSolid, styled.contactSolid)
    && equal(flat.contactWater, styled.contactWater)
    && equal(flat.blank, styled.blank);
}

function protectedControlDifference(flat, styled) {
  const controls = ['hole', 'thin', 'isolated', 'wall', 'contactSolid', 'contactWater', 'blank'];
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
  const cards = [];
  for (let card = 0; card < left.cards.length; card++) {
    let cardChanged = 0;
    let cardPeak = 0;
    forEachBytePair(left.cards[card], right.cards[card], (before, after) => {
      const delta = Math.abs(after - before);
      peak = Math.max(peak, delta);
      changed += Number(delta !== 0);
      cardPeak = Math.max(cardPeak, delta);
      cardChanged += Number(delta !== 0);
    });
    cards.push({ code: left.cards[card].code, changed: cardChanged, peak: cardPeak });
  }
  return { changed, peak, cards };
}

function forEachBytePair(left, right, visit) {
  if (Array.isArray(left) && Array.isArray(right)) {
    for (let index = 0; index < left.length; index++) forEachBytePair(left[index], right[index], visit);
  } else if (typeof left === 'number' && typeof right === 'number') {
    visit(left, right);
  } else if (left && right && typeof left === 'object' && typeof right === 'object') {
    for (const key of Object.keys(left)) if (key in right) forEachBytePair(left[key], right[key], visit);
  }
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
