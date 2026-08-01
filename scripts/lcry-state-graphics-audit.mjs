const EXPECTED_KEYS = ['dark', 'low', 'neutral', 'high', 'bright'];
const EXPECTED_BRIGHTNESS = [0, 2, 5, 8, 10];
const LCRY_MATERIAL = 157;
const WATER_MATERIAL = 2;
const LCRY_PRESENT = 0x8000;

/**
 * Normal-scale canonical-WebGL proof for LCRY's exact-owner native `tmp2`
 * charge brightness. Device-pixel readback follows world-to-screen projection
 * so CSS/DPR geometry cannot mask a state or camera regression.
 */
export async function auditLcryStateGraphics({
  cdp, mode, evaluate, waitFor, waitForStablePageCapture, captureSettledPage, outputScale = 2, assert,
}) {
  if (mode !== 'webgl') return { skippedCanvasFallback: true };
  // A true 8x direct mesh can vary by a compositor byte between equal frames.
  // Fence-safe settling waits through the bounded field cadence instead of
  // requiring whole-page equality from the 15M-fragment presentation.
  const settle = (label) => outputScale === 8
    ? captureSettledPage(cdp, label, 450) : waitForStablePageCapture(cdp, label);
  await settle('WebGL initial LCRY-state framebuffer');
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    if (typeof audit.prepareLcryStateGraphicsFixture !== 'function'
      || typeof audit.lcryStateGraphicsAtlas !== 'function'
      || typeof audit.setLcryStateStyling !== 'function') {
      throw new Error('LCRY state graphics audit API unavailable');
    }
    audit.prepareLcryStateGraphicsFixture();
    return true;
  })()`);
  const atlas = await waitFor(() => evaluate(cdp, `(() => {
    const cards = window.__ANIFOR_INPUT_AUDIT__.lcryStateGraphicsAtlas()?.cards;
    return cards?.length === ${EXPECTED_KEYS.length} ? cards : false;
  })()`), 15_000, 'WebGL LCRY state fixture');
  assert(atlas.every((entry, index) => entry.stateKey === EXPECTED_KEYS[index]
      && entry.brightness === EXPECTED_BRIGHTNESS[index]
      && entry.encodedState === (LCRY_PRESENT | EXPECTED_BRIGHTNESS[index])
      && entry.material === LCRY_MATERIAL && entry.code === 'LCRY'),
  `LCRY state atlas contract drifted (${JSON.stringify(atlas)})`);

  const semantic = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    return audit.lcryStateGraphicsAtlas().cards.map((entry) => {
      const at = (rect) => ({ material: audit.cell(rect.x, rect.y), state: audit.presentationState(rect.x, rect.y) });
      return { body: at(entry.body), hole: at(entry.authoredHole), notch: at(entry.openNotch),
        thin: at(entry.thinStructure), absent: at(entry.absentState), neutral: at(entry.neutralState), wrong: at(entry.wrongOwner) };
    });
  })()`);
  assert(semantic.every((entry, index) => entry.body.material === LCRY_MATERIAL
      && entry.body.state === (LCRY_PRESENT | EXPECTED_BRIGHTNESS[index])
      && entry.hole.material === 0 && entry.hole.state === 0
      && entry.notch.material === 0 && entry.notch.state === 0
      && entry.thin.material === LCRY_MATERIAL && entry.thin.state === (LCRY_PRESENT | EXPECTED_BRIGHTNESS[index])
      && entry.absent.material === LCRY_MATERIAL && entry.absent.state === 0
      && entry.neutral.material === LCRY_MATERIAL && entry.neutral.state === (LCRY_PRESENT | 5)
      && entry.wrong.material === WATER_MATERIAL && entry.wrong.state === (LCRY_PRESENT | EXPECTED_BRIGHTNESS[index])),
  `LCRY fixture lost owner/state/topology (${JSON.stringify(semantic)})`);

  const setStyling = (enabled) => evaluate(cdp,
    `window.__ANIFOR_INPUT_AUDIT__.setLcryStateStyling(${enabled}); true;`);
  await setStyling(false);
  await settle('flat LCRY-state framebuffer');
  const flat = await sample(cdp, evaluate);
  await setStyling(true);
  await settle('styled LCRY-state framebuffer');
  const styled = await sample(cdp, evaluate);
  await setStyling(false);
  await settle('repeated flat LCRY-state framebuffer');
  const repeated = await sample(cdp, evaluate);

  const cards = atlas.map((entry, index) => {
    const delta = subtract(styled.probes[index], flat.probes[index]);
    const repeat = subtract(repeated.probes[index], flat.probes[index]);
    assert(equal(flat.absent[index], styled.absent[index]) && equal(flat.absent[index], repeated.absent[index]),
      `LCRY/${entry.stateKey}: absent state control changed`);
    assert(equal(flat.neutral[index], repeated.neutral[index]),
      `LCRY/${entry.stateKey}: neutral control did not return to flat`);
    assert(equal(flat.wrong[index], styled.wrong[index]) && equal(flat.wrong[index], repeated.wrong[index]),
      `LCRY/${entry.stateKey}: wrong-owner control changed`);
    assert(equal(flat.probes[index], repeated.probes[index]),
      `LCRY/${entry.stateKey}: off→on→off is not exact`);
    assert(flat.probes[index][3] === styled.probes[index][3],
      `LCRY/${entry.stateKey}: state style changed semantic alpha`);
    return {
      stateKey: entry.stateKey,
      brightness: entry.brightness,
      meanDelta: mean(delta),
      peak: peak(delta),
      repeatPeak: peak(repeat),
      styledLuma: luma(styled.probes[index]),
    };
  });
  assert(cards.every((card, index) => equal(styled.neutral[index], styled.probes[2])),
    `LCRY neutral state is not an exact native gray reference (${JSON.stringify(cards)})`);
  assert(cards.every((card, index) => index === 0 || card.styledLuma >= cards[index - 1].styledLuma + 12),
    `LCRY native charge brightness is not monotonic (${JSON.stringify(cards)})`);
  assert(cards[4].styledLuma - cards[0].styledLuma >= 120,
    `LCRY native charge brightness range is visually inert (${JSON.stringify(cards)})`);
  // Native LCRY directly replaces its final gray from 0x50 through 0xf0, so
  // the full charge span is intentionally wider than an additive identity key.
  assert(cards.every(({ peak, repeatPeak }) => peak <= 192 && repeatPeak === 0),
    `LCRY state response is unbounded or unstable (${JSON.stringify(cards)})`);
  return { cards, exactNeutralNoOp: true, exactRepeatedOff: true, exactControlNoOp: true, rgbOnly: true };
}

async function sample(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!canvas || !gl) throw new Error('LCRY state WebGL backing unavailable');
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
    const cards = audit.lcryStateGraphicsAtlas().cards;
    return {
      probes: cards.map((entry) => read(entry.responseProbe)),
      absent: cards.map((entry) => read(entry.absentState)),
      neutral: cards.map((entry) => read(entry.neutralState)),
      wrong: cards.map((entry) => read(entry.wrongOwner)),
    };
  })()`);
}

function subtract(left, right) { return left.map((value, index) => value - right[index]); }
function mean(values) { return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722; }
function luma(values) { return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722; }
function peak(values) { return Math.max(...values.map((value) => Math.abs(value))); }
function equal(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]); }
