const EXPECTED_CARDS = [
  { key: 'off', life: 0, on: false },
  { key: 'decay', life: 9, on: false },
  { key: 'on', life: 10, on: true },
];
const SWCH_MATERIAL = 149;
const WATER_MATERIAL = 2;
const PRESENT = 0x8000;
const ON = 0x0001;

/**
 * Canonical normal-detail WebGL proof for SWCH's native conduction threshold.
 * The renderer must distinguish the projected on bit without inventing a
 * visual state for an off or decaying native switch.
 */
export async function auditSwchStateGraphics({
  cdp, mode, evaluate, waitFor, waitForStablePageCapture, captureSettledPage, outputScale = 2, assert,
}) {
  if (mode !== 'webgl') return { skippedCanvasFallback: true };
  // The direct true-8× mesh retains Canvas until the first GPU fence signals;
  // settle against the promoted presentation rather than reading that fallback.
  const settle = outputScale === 8
    ? (label) => captureSettledPage(cdp, label, 450)
    : (label) => waitForStablePageCapture(cdp, label);
  await settle('WebGL initial SWCH-state framebuffer');
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    if (typeof audit.prepareSwchStateGraphicsFixture !== 'function'
      || typeof audit.swchStateGraphicsAtlas !== 'function'
      || typeof audit.setSwchStateStyling !== 'function') {
      throw new Error('SWCH state graphics audit API unavailable');
    }
    audit.resetView();
    audit.prepareSwchStateGraphicsFixture();
    return true;
  })()`);
  const atlas = await waitFor(() => evaluate(cdp, `(() => {
    const cards = window.__ANIFOR_INPUT_AUDIT__.swchStateGraphicsAtlas()?.cards;
    return cards?.length === ${EXPECTED_CARDS.length} ? cards : false;
  })()`), 15_000, 'WebGL SWCH state fixture');
  assert(atlas.every((entry, index) => matchesCard(entry, EXPECTED_CARDS[index])),
    `SWCH state atlas contract drifted (${JSON.stringify(atlas)})`);

  const semantic = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    return audit.swchStateGraphicsAtlas().cards.map((entry) => {
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
    const expected = EXPECTED_CARDS[index];
    const state = PRESENT | (expected.on ? ON : 0);
    return entry.body.material === SWCH_MATERIAL && entry.body.state === state
      && entry.hole.material === 0 && entry.hole.state === 0
      && entry.notch.material === 0 && entry.notch.state === 0
      && entry.thin.material === SWCH_MATERIAL && entry.thin.state === state
      && entry.isolated.material === SWCH_MATERIAL && entry.isolated.state === state
      && entry.absent.material === SWCH_MATERIAL && entry.absent.state === 0
      && entry.wrong.material === WATER_MATERIAL && entry.wrong.state === (PRESENT | ON)
      && entry.wall.material === SWCH_MATERIAL && entry.wall.state === (PRESENT | ON) && entry.wall.wall === 1;
  }), `SWCH fixture lost owner/state/topology/wall separation (${JSON.stringify(semantic)})`);

  const setStyling = (enabled) => evaluate(cdp,
    `window.__ANIFOR_INPUT_AUDIT__.setSwchStateStyling(${enabled}); true;`);
  await setStyling(false);
  await settle('flat SWCH-state framebuffer');
  const flat = await sample(cdp, evaluate);
  await setStyling(true);
  await settle('styled SWCH-state framebuffer');
  const styled = await sample(cdp, evaluate);
  await setStyling(false);
  await settle('repeated flat SWCH-state framebuffer');
  const repeated = await sample(cdp, evaluate);

  const cards = atlas.map((entry, index) => {
    const response = subtract(styled.probes[index], flat.probes[index]);
    const repeatedResponse = subtract(repeated.probes[index], flat.probes[index]);
    assert(equal(flat.probes[index], repeated.probes[index]),
      `SWCH/${entry.stateKey}: off→on→off is not exact`);
    assert(equal(flat.absent[index], styled.absent[index]) && equal(flat.absent[index], repeated.absent[index]),
      `SWCH/${entry.stateKey}: absent native state changed`);
    assert(equal(flat.wrong[index], styled.wrong[index]) && equal(flat.wrong[index], repeated.wrong[index]),
      `SWCH/${entry.stateKey}: state styling leaked into wrong owner`);
    assert(equal(flat.walls[index], styled.walls[index]) && equal(flat.walls[index], repeated.walls[index]),
      `SWCH/${entry.stateKey}: state styling leaked through a native wall`);
    assert(flat.probes[index][3] === styled.probes[index][3],
      `SWCH/${entry.stateKey}: state style changed semantic alpha`);
    return {
      stateKey: entry.stateKey,
      life: entry.life,
      on: entry.on,
      peak: peak(response),
      repeatPeak: peak(repeatedResponse),
      styledRgb: styled.probes[index].slice(0, 3),
    };
  });
  assert(cards[0].peak === 0 && cards[1].peak === 0,
    `SWCH off/decay state became visibly powered (${JSON.stringify(cards)})`);
  assert(cards[2].peak >= 24 && cards[2].peak <= 160 && cards[2].repeatPeak === 0,
    `SWCH conducting state is inert, unbounded, or unstable (${JSON.stringify(cards)})`);
  return { cards, exactControls: true, exactRepeatedOff: true, rgbOnly: true };
}

async function sample(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!canvas || !gl) throw new Error('SWCH state WebGL backing unavailable');
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
    const cards = audit.swchStateGraphicsAtlas().cards;
    return {
      probes: cards.map((entry) => read(entry.responseProbe)),
      absent: cards.map((entry) => read(entry.absentState)),
      wrong: cards.map((entry) => read(entry.wrongOwner)),
      walls: cards.map((entry) => read(entry.wallCoexistence)),
    };
  })()`);
}

function matchesCard(entry, expected) {
  return entry.material === SWCH_MATERIAL && entry.code === 'SWCH'
    && entry.stateKey === expected.key && entry.life === expected.life && entry.on === expected.on
    && entry.encodedState === (PRESENT | (expected.on ? ON : 0));
}
function subtract(left, right) { return left.map((value, index) => value - right[index]); }
function peak(values) { return Math.max(...values.map((value) => Math.abs(value))); }
function equal(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]); }
