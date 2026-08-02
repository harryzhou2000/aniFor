const EXPECTED_CARDS = [
  { key: 'idle', countdown: 0 },
  { key: 'armed', countdown: 22 },
  { key: 'mid', countdown: 11 },
  { key: 'nearExpiry', countdown: 1 },
];
const DLAY_MATERIAL = 154;
const WATER_MATERIAL = 2;
const PRESENT = 0x8000;

/** Canonical WebGL proof for DLAY's retained native countdown, not a JS timer. */
export async function auditDlayStateGraphics({
  cdp, mode, evaluate, waitFor, waitForStablePageCapture, captureSettledPage, outputScale = 2, assert,
}) {
  if (mode !== 'webgl') return { skippedCanvasFallback: true };
  // The direct 8× presenter retains bounded Canvas until the first fence, so
  // do not sample its fallback instead of the promoted WebGL framebuffer.
  const settle = outputScale === 8
    ? (label) => captureSettledPage(cdp, label, 450)
    : (label) => waitForStablePageCapture(cdp, label);
  await settle('WebGL initial DLAY-state framebuffer');
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    if (typeof audit.prepareDlayStateGraphicsFixture !== 'function'
      || typeof audit.dlayStateGraphicsAtlas !== 'function'
      || typeof audit.setDlayStateStyling !== 'function') {
      throw new Error('DLAY state graphics audit API unavailable');
    }
    audit.resetView();
    audit.prepareDlayStateGraphicsFixture();
    return true;
  })()`);
  const atlas = await waitFor(() => evaluate(cdp, `(() => {
    const cards = window.__ANIFOR_INPUT_AUDIT__.dlayStateGraphicsAtlas()?.cards;
    return cards?.length === ${EXPECTED_CARDS.length} ? cards : false;
  })()`), 15_000, 'WebGL DLAY state fixture');
  assert(atlas.every((entry, index) => matchesCard(entry, EXPECTED_CARDS[index])),
    `DLAY state atlas contract drifted (${JSON.stringify(atlas)})`);

  const semantic = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    return audit.dlayStateGraphicsAtlas().cards.map((entry) => {
      const at = (rect) => ({
        material: audit.cell(rect.x, rect.y), state: audit.presentationState(rect.x, rect.y),
        wall: audit.wall(rect.x, rect.y),
      });
      return {
        body: at(entry.body), hole: at(entry.authoredHole), notch: at(entry.openNotch),
        thin: at(entry.thinStructure), isolated: at(entry.isolated), absent: at(entry.absentState),
        wrong: at(entry.wrongOwner), wall: at(entry.wallCoexistence),
      };
    });
  })()`);
  assert(semantic.every((entry, index) => {
    const state = PRESENT | EXPECTED_CARDS[index].countdown;
    return entry.body.material === DLAY_MATERIAL && entry.body.state === state
      && entry.hole.material === 0 && entry.hole.state === 0
      && entry.notch.material === 0 && entry.notch.state === 0
      && entry.thin.material === DLAY_MATERIAL && entry.thin.state === state
      && entry.isolated.material === DLAY_MATERIAL && entry.isolated.state === state
      && entry.absent.material === DLAY_MATERIAL && entry.absent.state === 0
      && entry.wrong.material === WATER_MATERIAL && entry.wrong.state === state
      && entry.wall.material === DLAY_MATERIAL && entry.wall.state === state && entry.wall.wall === 1;
  }), `DLAY fixture lost owner/state/topology/wall separation (${JSON.stringify(semantic)})`);

  const setStyling = (enabled) => evaluate(cdp,
    `window.__ANIFOR_INPUT_AUDIT__.setDlayStateStyling(${enabled}); true;`);
  await setStyling(false);
  await settle('flat DLAY-state framebuffer');
  const flat = await sample(cdp, evaluate);
  await setStyling(true);
  await settle('styled DLAY-state framebuffer');
  const styled = await sample(cdp, evaluate);
  await setStyling(false);
  await settle('repeated flat DLAY-state framebuffer');
  const repeated = await sample(cdp, evaluate);

  const cards = atlas.map((entry, index) => {
    const response = subtract(styled.probes[index], flat.probes[index]);
    const repeatedResponse = subtract(repeated.probes[index], flat.probes[index]);
    assert(equal(flat.probes[index], repeated.probes[index]),
      `DLAY/${entry.key}: off→on→off is not exact`);
    assert(equal(flat.absent[index], styled.absent[index]) && equal(flat.absent[index], repeated.absent[index]),
      `DLAY/${entry.key}: absent owner marker changed`);
    assert(equal(flat.wrong[index], styled.wrong[index]) && equal(flat.wrong[index], repeated.wrong[index]),
      `DLAY/${entry.key}: state styling leaked into wrong owner`);
    assert(equal(flat.walls[index], styled.walls[index]) && equal(flat.walls[index], repeated.walls[index]),
      `DLAY/${entry.key}: state styling leaked through native wall`);
    assert(flat.probes[index][3] === styled.probes[index][3],
      `DLAY/${entry.key}: state style changed semantic alpha`);
    return {
      key: entry.key,
      countdown: entry.countdown,
      peak: peak(response),
      repeatPeak: peak(repeatedResponse),
      styledRgb: styled.probes[index].slice(0, 3),
    };
  });
  assert(cards[0].peak === 0,
    `DLAY idle state gained an armed appearance (${JSON.stringify(cards)})`);
  for (const card of cards.slice(1)) {
    assert(card.peak >= 8 && card.peak <= 176 && card.repeatPeak === 0,
      `DLAY/${card.key} state is inert, unbounded, or unstable (${JSON.stringify(cards)})`);
  }
  assert(peak(subtract(cards[1].styledRgb, cards[3].styledRgb)) >= 8,
    `DLAY armed and near-expiry countdowns lost their native progression (${JSON.stringify(cards)})`);
  return { cards, exactControls: true, exactRepeatedOff: true, rgbOnly: true };
}

async function sample(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!canvas || !gl) throw new Error('DLAY state WebGL backing unavailable');
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
    const cards = audit.dlayStateGraphicsAtlas().cards;
    return {
      probes: cards.map((entry) => read(entry.responseProbe)),
      absent: cards.map((entry) => read(entry.absentState)),
      wrong: cards.map((entry) => read(entry.wrongOwner)),
      walls: cards.map((entry) => read(entry.wallCoexistence)),
    };
  })()`);
}

function matchesCard(entry, expected) {
  return entry.material === DLAY_MATERIAL && entry.code === 'DLAY'
    && entry.key === expected.key && entry.countdown === expected.countdown
    && entry.encodedState === (PRESENT | expected.countdown);
}
function subtract(left, right) { return left.map((value, index) => value - right[index]); }
function peak(values) { return Math.max(...values.map((value) => Math.abs(value))); }
function equal(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]); }
