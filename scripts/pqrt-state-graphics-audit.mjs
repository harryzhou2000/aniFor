const EXPECTED_KEYS = ['dark', 'low', 'neutral', 'high', 'bright'];
const EXPECTED_STATES = [0, 2, 5, 8, 10];

/**
 * Focused canonical-WebGL proof for PQRT/QRTZ's owner-guarded native tmp2
 * presentation. The sample reads the actual compositor backing in device
 * pixels after world-to-screen projection, so DPR/backing scale cannot mask a
 * state/camera regression.
 */
export async function auditPqrtStateGraphics({
  cdp, mode, evaluate, waitFor, waitForStablePageCapture, captureSettledPage, outputScale = 2, assert,
}) {
  if (mode !== 'webgl') return { skippedCanvasFallback: true };
  const settle = (label) => outputScale === 8
    ? captureSettledPage(cdp, label, 450) : waitForStablePageCapture(cdp, label);
  await settle('WebGL initial blank PQRT-state framebuffer');
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    if (typeof audit.preparePqrtStateGraphicsFixture !== 'function'
      || typeof audit.pqrtStateGraphicsAtlas !== 'function'
      || typeof audit.setQuartzCrystalStateStyling !== 'function') {
      throw new Error('PQRT state graphics audit API unavailable');
    }
    audit.preparePqrtStateGraphicsFixture();
    return true;
  })()`);
  // PQRT is a Powder owner. Hydrate the shared boundary/stability field before
  // toggling only its native tmp2 presentation layer, otherwise the generic
  // identical-frame waiter can observe legitimate 0 -> 255 Smooth settling and
  // misreport it as state-style animation. Compact true 8x has its own direct
  // atlas/fence proof and must not pay seven additional 15-million-fragment
  // refreshes here.
  if (outputScale < 8) {
    for (let pass = 0; pass < 7; pass++) {
      const before = await evaluate(cdp,
        'window.__ANIFOR_INPUT_AUDIT__.presentationRefreshAudit()');
      await evaluate(cdp,
        'window.__ANIFOR_INPUT_AUDIT__.refreshPresentationFields(); true');
      await waitFor(() => evaluate(cdp, `(() => {
        const current = window.__ANIFOR_INPUT_AUDIT__.presentationRefreshAudit();
        return current?.dynamicSequence > ${before.dynamicSequence} ? current : false;
      })()`), outputScale === 4 ? 15_000 : 5_000,
      `PQRT state stability pass ${pass + 1}`);
    }
  }
  const atlas = await waitFor(() => evaluate(cdp, `(() => {
    const cards = window.__ANIFOR_INPUT_AUDIT__.pqrtStateGraphicsAtlas()?.cards;
    return cards?.length === 5 ? cards : false;
  })()`), 15_000, 'WebGL PQRT state fixture');
  assert(atlas.every((entry, index) => entry.stateKey === EXPECTED_KEYS[index]
      && entry.speckle === EXPECTED_STATES[index]
      && entry.encodedState === EXPECTED_STATES[index]
      && (entry.material === 29 || entry.material === 76)),
  `PQRT state atlas contract drifted (${JSON.stringify(atlas)})`);

  const semantic = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    return audit.pqrtStateGraphicsAtlas().cards.map((entry) => {
      const at = (rect) => ({ material: audit.cell(rect.x, rect.y), state: audit.presentationState(rect.x, rect.y) });
      return { body: at(entry.body), hole: at(entry.authoredHole), notch: at(entry.openNotch),
        thin: at(entry.thinStructure), neutral: at(entry.neutralState), wrong: at(entry.wrongOwner) };
    });
  })()`);
  assert(semantic.every((entry, index) => entry.body.material === atlas[index].material
      && entry.body.state === EXPECTED_STATES[index] && entry.hole.material === 0 && entry.hole.state === 0
      && entry.notch.material === 0 && entry.notch.state === 0
      && entry.thin.material === atlas[index].material && entry.thin.state === EXPECTED_STATES[index]
      && entry.neutral.material === atlas[index].material && entry.neutral.state === 5
      && entry.wrong.material === 2 && entry.wrong.state === EXPECTED_STATES[index]),
  `PQRT fixture lost owner/state/topology (${JSON.stringify(semantic)})`);

  const setStyling = (enabled) => evaluate(cdp,
    `window.__ANIFOR_INPUT_AUDIT__.setQuartzCrystalStateStyling(${enabled}); true;`);
  await setStyling(false);
  await settle('flat PQRT-state framebuffer');
  const flat = await sample(cdp, evaluate);
  await setStyling(true);
  await settle('styled PQRT-state framebuffer');
  const styled = await sample(cdp, evaluate);
  await setStyling(false);
  await settle('repeated flat PQRT-state framebuffer');
  const repeated = await sample(cdp, evaluate);

  const cards = atlas.map((entry, index) => {
    const delta = subtract(styled.probes[index], flat.probes[index]);
    const repeat = subtract(repeated.probes[index], flat.probes[index]);
    assert(equal(flat.neutral[index], styled.neutral[index]) && equal(flat.neutral[index], repeated.neutral[index]),
      `PQRT/${entry.stateKey}: neutral control changed`);
    assert(equal(flat.wrong[index], styled.wrong[index]) && equal(flat.wrong[index], repeated.wrong[index]),
      `PQRT/${entry.stateKey}: wrong-owner control changed`);
    assert(equal(flat.probes[index], repeated.probes[index]),
      `PQRT/${entry.stateKey}: off→on→off is not exact`);
    return { stateKey: entry.stateKey, material: entry.material, meanDelta: mean(delta), peak: peak(delta), repeatPeak: peak(repeat) };
  });
  const neutral = cards[2];
  assert(neutral.peak === 0, `PQRT neutral native seed is not an exact style no-op (${JSON.stringify(neutral)})`);
  assert(cards[0].meanDelta < -0.25 && cards[1].meanDelta < -0.05
      && cards[3].meanDelta > 0.05 && cards[4].meanDelta > 0.25,
  `PQRT native dark/bright response is not signed (${JSON.stringify(cards)})`);
  assert(cards.every(({ peak, repeatPeak }) => peak <= 96 && repeatPeak === 0),
    `PQRT state response is unbounded or unstable (${JSON.stringify(cards)})`);
  return { cards, exactNeutralNoOp: true, exactRepeatedOff: true, exactControlNoOp: true };
}

async function sample(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!canvas || !gl) throw new Error('PQRT state WebGL backing unavailable');
    const rect = canvas.getBoundingClientRect();
    const read = (point) => {
      const screen = audit.worldToScreen(point.x + point.width / 2, point.y + point.height / 2);
      const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((screen.x - rect.left) * canvas.width / rect.width)));
      const y = Math.max(0, Math.min(canvas.height - 1, canvas.height - 1 - Math.floor((screen.y - rect.top) * canvas.height / rect.height)));
      const pixel = new Uint8Array(4); gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); return Array.from(pixel);
    };
    const cards = audit.pqrtStateGraphicsAtlas().cards;
    return { probes: cards.map((entry) => read(entry.responseProbe)), neutral: cards.map((entry) => read(entry.neutralState)), wrong: cards.map((entry) => read(entry.wrongOwner)) };
  })()`);
}

function subtract(left, right) { return left.map((value, index) => value - right[index]); }
function mean(values) { return (values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722); }
function peak(values) { return Math.max(...values.map((value) => Math.abs(value))); }
function equal(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]); }
