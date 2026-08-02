const EXPECTED_CARDS = [
  { key: 'unloaded', payload: 0, payloadPresent: false, cooldown: false },
  { key: 'water', payload: 2, payloadPresent: true, cooldown: false },
  { key: 'fire', payload: 4, payloadPresent: true, cooldown: false },
  { key: 'unknown', payload: 0xff, payloadPresent: true, cooldown: false },
  { key: 'cooldown', payload: 0, payloadPresent: false, cooldown: true },
];
const STOR_MATERIAL = 163;
const WATER_MATERIAL = 2;
const PAYLOAD_PRESENT = 0x0100;
const COOLDOWN = 0x0200;

/**
 * Canonical WebGL proof for STOR's exact retained payload/cooldown projection.
 * State is a native snapshot, never a JavaScript timer or synthetic storage.
 */
export async function auditStorStateGraphics({
  cdp, mode, evaluate, waitFor, waitForStablePageCapture, captureSettledPage, outputScale = 2, assert,
}) {
  if (mode !== 'webgl') return { skippedCanvasFallback: true };
  // A true 8× direct mesh may still display its bounded Canvas fallback until
  // its first fence signals, so capture the promoted presentation explicitly.
  const settle = outputScale === 8
    ? (label) => captureSettledPage(cdp, label, 450)
    : (label) => waitForStablePageCapture(cdp, label);
  await settle('WebGL initial STOR-state framebuffer');
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    if (typeof audit.prepareStorStateGraphicsFixture !== 'function'
      || typeof audit.storStateGraphicsAtlas !== 'function'
      || typeof audit.setStorStateStyling !== 'function') {
      throw new Error('STOR state graphics audit API unavailable');
    }
    audit.resetView();
    audit.prepareStorStateGraphicsFixture();
    return true;
  })()`);
  const atlas = await waitFor(() => evaluate(cdp, `(() => {
    const cards = window.__ANIFOR_INPUT_AUDIT__.storStateGraphicsAtlas()?.cards;
    return cards?.length === ${EXPECTED_CARDS.length} ? cards : false;
  })()`), 15_000, 'WebGL STOR state fixture');
  assert(atlas.every((entry, index) => matchesCard(entry, EXPECTED_CARDS[index])),
    `STOR state atlas contract drifted (${JSON.stringify(atlas)})`);

  const semantic = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    return audit.storStateGraphicsAtlas().cards.map((entry) => {
      const at = (rect) => ({
        material: audit.cell(rect.x, rect.y), state: audit.presentationState(rect.x, rect.y),
        wall: audit.wall(rect.x, rect.y),
      });
      return {
        body: at(entry.body), hole: at(entry.authoredHole), notch: at(entry.openNotch),
        thin: at(entry.thinStructure), isolated: at(entry.isolated), zero: at(entry.zeroState),
        wrong: at(entry.wrongOwner), wall: at(entry.wallCoexistence),
      };
    });
  })()`);
  assert(semantic.every((entry, index) => {
    const expected = EXPECTED_CARDS[index];
    const state = expected.payload | (expected.payloadPresent ? PAYLOAD_PRESENT : 0)
      | (expected.cooldown ? COOLDOWN : 0);
    return entry.body.material === STOR_MATERIAL && entry.body.state === state
      && entry.hole.material === 0 && entry.hole.state === 0
      && entry.notch.material === 0 && entry.notch.state === 0
      && entry.thin.material === STOR_MATERIAL && entry.thin.state === state
      && entry.isolated.material === STOR_MATERIAL && entry.isolated.state === state
      && entry.zero.material === STOR_MATERIAL && entry.zero.state === 0
      && entry.wrong.material === WATER_MATERIAL && entry.wrong.state === state
      && entry.wall.material === STOR_MATERIAL && entry.wall.state === state && entry.wall.wall === 1;
  }), `STOR fixture lost owner/state/topology/wall separation (${JSON.stringify(semantic)})`);

  const setStyling = (enabled) => evaluate(cdp,
    `window.__ANIFOR_INPUT_AUDIT__.setStorStateStyling(${enabled}); true;`);
  await setStyling(false);
  await settle('flat STOR-state framebuffer');
  const flat = await sample(cdp, evaluate);
  await setStyling(true);
  await settle('styled STOR-state framebuffer');
  const styled = await sample(cdp, evaluate);
  await setStyling(false);
  await settle('repeated flat STOR-state framebuffer');
  const repeated = await sample(cdp, evaluate);

  const cards = atlas.map((entry, index) => {
    const response = subtract(styled.probes[index], flat.probes[index]);
    const repeatedResponse = subtract(repeated.probes[index], flat.probes[index]);
    assert(equal(flat.probes[index], repeated.probes[index]),
      `STOR/${entry.stateKey}: off→on→off is not exact`);
    assert(equal(flat.zero[index], styled.zero[index]) && equal(flat.zero[index], repeated.zero[index]),
      `STOR/${entry.stateKey}: zero state changed`);
    assert(equal(flat.wrong[index], styled.wrong[index]) && equal(flat.wrong[index], repeated.wrong[index]),
      `STOR/${entry.stateKey}: state styling leaked into wrong owner`);
    assert(equal(flat.walls[index], styled.walls[index]) && equal(flat.walls[index], repeated.walls[index]),
      `STOR/${entry.stateKey}: state styling leaked through a native wall`);
    assert(flat.probes[index][3] === styled.probes[index][3],
      `STOR/${entry.stateKey}: state style changed semantic alpha`);
    return {
      stateKey: entry.stateKey,
      payload: entry.payload,
      payloadPresent: entry.payloadPresent,
      cooldown: entry.cooldown,
      peak: peak(response),
      repeatPeak: peak(repeatedResponse),
      styledRgb: styled.probes[index].slice(0, 3),
    };
  });
  assert(cards[0].peak === 0,
    `STOR unloaded state acquired a visual payload (${JSON.stringify(cards)})`);
  for (const card of cards.slice(1)) {
    assert(card.peak >= 8 && card.peak <= 176 && card.repeatPeak === 0,
      `STOR/${card.stateKey} state is inert, unbounded, or unstable (${JSON.stringify(cards)})`);
  }
  assert(peak(subtract(cards[1].styledRgb, cards[2].styledRgb)) >= 10,
    `STOR water and fire payloads lost their distinct retained identities (${JSON.stringify(cards)})`);
  return { cards, exactControls: true, exactRepeatedOff: true, rgbOnly: true };
}

async function sample(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!canvas || !gl) throw new Error('STOR state WebGL backing unavailable');
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
    const cards = audit.storStateGraphicsAtlas().cards;
    return {
      probes: cards.map((entry) => read(entry.responseProbe)),
      zero: cards.map((entry) => read(entry.zeroState)),
      wrong: cards.map((entry) => read(entry.wrongOwner)),
      walls: cards.map((entry) => read(entry.wallCoexistence)),
    };
  })()`);
}

function matchesCard(entry, expected) {
  const state = expected.payload | (expected.payloadPresent ? PAYLOAD_PRESENT : 0)
    | (expected.cooldown ? COOLDOWN : 0);
  return entry.material === STOR_MATERIAL && entry.code === 'STOR'
    && entry.stateKey === expected.key && entry.payload === expected.payload
    && entry.payloadPresent === expected.payloadPresent && entry.cooldown === expected.cooldown
    && entry.encodedState === state;
}
function subtract(left, right) { return left.map((value, index) => value - right[index]); }
function peak(values) { return Math.max(...values.map((value) => Math.abs(value))); }
function equal(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]); }
