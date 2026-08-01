const EXPECTED_CARDS = [
  { key: 'red', red: 12, green: 0, blue: 0, life: 0, temperature: undefined },
  { key: 'green', red: 0, green: 12, blue: 0, life: 0, temperature: undefined },
  { key: 'blue', red: 0, green: 0, blue: 12, life: 0, temperature: undefined },
  { key: 'mixedRest', red: 8, green: 4, blue: 10, life: 0, temperature: undefined },
  { key: 'mixedActive', red: 8, green: 4, blue: 10, life: 4, temperature: undefined },
  { key: 'fallbackCold', red: 0, green: 0, blue: 0, life: 0, temperature: 2730 },
  { key: 'fallbackHot', red: 0, green: 0, blue: 0, life: 4, temperature: 13000 },
];
const FILT_MATERIAL = 69;
const WATER_MATERIAL = 2;

/**
 * Normal-scale canonical-WebGL proof for FILT's owner-guarded native spectrum
 * projection. Readback occurs from the compositor backing after world-space
 * projection so CSS/DPR geometry cannot hide a visual or camera regression.
 */
export async function auditFiltStateGraphics({
  cdp, mode, evaluate, waitFor, waitForStablePageCapture, captureSettledPage, outputScale = 2, assert,
}) {
  if (mode !== 'webgl') return { skippedCanvasFallback: true };
  // A true 8x direct mesh can dither by a byte between otherwise identical
  // captures. Wait through the bounded field cadence rather than demanding
  // whole-page equality from its 15M-fragment presentation.
  const settle = (label) => outputScale === 8
    ? captureSettledPage(cdp, label, 450) : waitForStablePageCapture(cdp, label);
  await settle('WebGL initial blank FILT-state framebuffer');
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    if (typeof audit.prepareFiltStateGraphicsFixture !== 'function'
      || typeof audit.filtStateGraphicsAtlas !== 'function'
      || typeof audit.setFiltSpectrumStyling !== 'function') {
      throw new Error('FILT state graphics audit API unavailable');
    }
    audit.prepareFiltStateGraphicsFixture();
    return true;
  })()`);
  const atlas = await waitFor(() => evaluate(cdp, `(() => {
    const cards = window.__ANIFOR_INPUT_AUDIT__.filtStateGraphicsAtlas()?.cards;
    return cards?.length === ${EXPECTED_CARDS.length} ? cards : false;
  })()`), 15_000, 'WebGL FILT state fixture');
  assert(atlas.every((entry, index) => matchesCard(entry, EXPECTED_CARDS[index])),
    `FILT state atlas contract drifted (${JSON.stringify(atlas)})`);

  const semantic = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    return audit.filtStateGraphicsAtlas().cards.map((entry) => {
      const at = (rect) => ({
        material: audit.cell(rect.x, rect.y),
        state: audit.presentationState(rect.x, rect.y),
        temperature: audit.temperature(rect.x, rect.y),
      });
      return {
        body: at(entry.body), hole: at(entry.authoredHole), notch: at(entry.openNotch),
        thin: at(entry.thinStructure), zero: at(entry.zeroPresentState), wrong: at(entry.wrongOwner),
      };
    });
  })()`);
  assert(semantic.every((entry, index) => {
    const expected = EXPECTED_CARDS[index];
    return entry.body.material === FILT_MATERIAL && entry.body.state === atlas[index].encodedState
      && (expected.temperature === undefined || entry.body.temperature === expected.temperature)
      && entry.hole.material === 0 && entry.hole.state === 0
      && entry.notch.material === 0 && entry.notch.state === 0
      && entry.thin.material === FILT_MATERIAL && entry.thin.state === atlas[index].encodedState
      && entry.zero.material === FILT_MATERIAL && entry.zero.state === 0
      && entry.wrong.material === WATER_MATERIAL && entry.wrong.state === atlas[index].encodedState;
  }), `FILT fixture lost owner/state/temperature/topology (${JSON.stringify(semantic)})`);

  const setStyling = (enabled) => evaluate(cdp,
    `window.__ANIFOR_INPUT_AUDIT__.setFiltSpectrumStyling(${enabled}); true;`);
  await setStyling(false);
  await settle('flat FILT-state framebuffer');
  const flat = await sample(cdp, evaluate);
  await setStyling(true);
  await settle('styled FILT-state framebuffer');
  const styled = await sample(cdp, evaluate);
  await setStyling(false);
  await settle('repeated flat FILT-state framebuffer');
  const repeated = await sample(cdp, evaluate);

  const cards = atlas.map((entry, index) => {
    const delta = subtract(styled.probes[index], flat.probes[index]);
    const repeat = subtract(repeated.probes[index], flat.probes[index]);
    assert(equal(flat.zero[index], styled.zero[index]) && equal(flat.zero[index], repeated.zero[index]),
      `FILT/${entry.key}: absent owner word changed`);
    assert(equal(flat.wrong[index], styled.wrong[index]) && equal(flat.wrong[index], repeated.wrong[index]),
      `FILT/${entry.key}: wrong-owner control changed`);
    assert(equal(flat.probes[index], repeated.probes[index]),
      `FILT/${entry.key}: off→on→off is not exact`);
    assert(flat.probes[index][3] === styled.probes[index][3],
      `FILT/${entry.key}: spectrum changed semantic alpha`);
    return {
      stateKey: entry.key,
      rgb: styled.probes[index].slice(0, 3),
      meanDelta: mean(delta),
      peak: peak(delta),
      repeatPeak: peak(repeat),
    };
  });
  const byKey = new Map(cards.map((card) => [card.stateKey, card]));
  assert(channelDominant(byKey.get('red')?.rgb, 0)
      && channelDominant(byKey.get('green')?.rgb, 1)
      && channelDominant(byKey.get('blue')?.rgb, 2),
  `FILT primary spectrum signatures drifted (${JSON.stringify(cards)})`);
  assert(channelDominant(byKey.get('fallbackCold')?.rgb, 2)
      && channelDominant(byKey.get('fallbackHot')?.rgb, 0),
  `FILT native temperature fallback signatures drifted (${JSON.stringify(cards)})`);
  assert(peak(subtract(byKey.get('mixedActive')?.rgb, byKey.get('mixedRest')?.rgb)) >= 4,
    `FILT native life reveal is visually inert (${JSON.stringify(cards)})`);
  assert(cards.every(({ peak: responsePeak, repeatPeak }) => responsePeak <= 255 && repeatPeak === 0),
    `FILT state response is unbounded or unstable (${JSON.stringify(cards)})`);
  return {
    cards,
    exactOwnerControls: true,
    exactRepeatedOff: true,
    rgbOnly: true,
  };
}

async function sample(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!canvas || !gl) throw new Error('FILT state WebGL backing unavailable');
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
    const cards = audit.filtStateGraphicsAtlas().cards;
    return {
      probes: cards.map((entry) => read(entry.responseProbe)),
      zero: cards.map((entry) => read(entry.zeroPresentState)),
      wrong: cards.map((entry) => read(entry.wrongOwner)),
    };
  })()`);
}

function matchesCard(entry, expected) {
  return entry.material === FILT_MATERIAL && entry.code === 'FILT'
    && entry.key === expected.key && entry.red === expected.red
    && entry.green === expected.green && entry.blue === expected.blue && entry.life === expected.life
    && entry.temperature === expected.temperature && Number.isInteger(entry.encodedState);
}
function channelDominant(rgb, channel) {
  return Array.isArray(rgb) && rgb[channel] >= rgb[(channel + 1) % 3] + 16
    && rgb[channel] >= rgb[(channel + 2) % 3] + 16;
}
function subtract(left, right) { return left.map((value, index) => value - right[index]); }
function mean(values) { return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722; }
function peak(values) { return Math.max(...values.map((value) => Math.abs(value))); }
function equal(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]); }
