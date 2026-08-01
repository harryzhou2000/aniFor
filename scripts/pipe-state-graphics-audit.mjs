const EXPECTED_CARDS = [
  { key: 'liquid', payload: 2, route: 0 },
  { key: 'gas', payload: 5, route: 1 },
  { key: 'granular', payload: 1, route: 2 },
  { key: 'rigid', payload: 23, route: 3 },
  { key: 'unknown', payload: 255, route: 3 },
];
const PIPE_MATERIAL = 121;
const PPIP_MATERIAL = 160;
const WATER_MATERIAL = 2;
const PAYLOAD_PRESENT = 0x0100;
const PAUSED = 0x0800;

/**
 * Normal-detail PIPE/PPIP state audit. It runs against both Canvas and WebGL
 * when the caller requests both backends; WebGL readback remains the canonical
 * presentation proof, while Canvas verifies the resilient semantic fallback.
 */
export async function auditPipeStateGraphics({
  cdp, mode, evaluate, waitFor, waitForStablePageCapture, captureSettledPage, outputScale = 2, assert,
}) {
  // Direct 8× may retain its bounded Canvas fallback while the first massive
  // semantic frame fences. A whole-page equality wait would sample that known
  // fallback; mirror the settled capture used by the other true-8× state gates.
  const settle = mode === 'webgl' && outputScale === 8
    ? (label) => captureSettledPage(cdp, label, 450)
    : (label) => waitForStablePageCapture(cdp, label);
  await settle(`${mode} initial PIPE-state framebuffer`);
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    if (typeof audit.preparePipeStateGraphicsFixture !== 'function'
      || typeof audit.pipeStateGraphicsAtlas !== 'function'
      || typeof audit.setPipePresentationStyling !== 'function') {
      throw new Error('PIPE state graphics audit API unavailable');
    }
    audit.resetView();
    audit.preparePipeStateGraphicsFixture();
    return true;
  })()`);
  const atlas = await waitFor(() => evaluate(cdp, `(() => {
    const cards = window.__ANIFOR_INPUT_AUDIT__.pipeStateGraphicsAtlas()?.cards;
    return cards?.length === ${EXPECTED_CARDS.length} ? cards : false;
  })()`), 15_000, `${mode} PIPE state fixture`);
  assert(atlas.every((entry, index) => matchesCard(entry, EXPECTED_CARDS[index])),
    `PIPE state atlas contract drifted (${JSON.stringify(atlas)})`);

  const semantic = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    return audit.pipeStateGraphicsAtlas().cards.map((entry) => {
      const at = (rect) => ({
        material: audit.cell(rect.x, rect.y), state: audit.presentationState(rect.x, rect.y),
        wall: audit.wall(rect.x, rect.y),
      });
      return {
        body: at(entry.body), hole: at(entry.authoredHole), notch: at(entry.openNotch),
        thin: at(entry.thinStructure), emptyRoute: at(entry.emptyRoute),
        paused: at(entry.pausedPpip), wrong: at(entry.wrongOwner), wall: at(entry.wallCoexistence),
      };
    });
  })()`);
  assert(semantic.every((entry, index) => {
    const expected = EXPECTED_CARDS[index];
    const emptyState = (index % 4) << 9;
    return entry.body.material === PIPE_MATERIAL
      && entry.body.state === ((expected.payload & 0xff) | PAYLOAD_PRESENT | (expected.route << 9))
      && entry.hole.material === 0 && entry.hole.state === 0
      && entry.notch.material === 0 && entry.notch.state === 0
      && entry.thin.material === PIPE_MATERIAL && entry.thin.state === entry.body.state
      && entry.emptyRoute.material === PIPE_MATERIAL && entry.emptyRoute.state === emptyState
      && entry.paused.material === PPIP_MATERIAL && entry.paused.state === (entry.body.state | PAUSED)
      && entry.wrong.material === WATER_MATERIAL && entry.wrong.state === entry.body.state
      && entry.wall.material === PIPE_MATERIAL && entry.wall.state === entry.body.state && entry.wall.wall === 1;
  }), `PIPE fixture lost owner/state/topology/wall separation (${JSON.stringify(semantic)})`);

  const setStyling = (enabled) => evaluate(cdp,
    `window.__ANIFOR_INPUT_AUDIT__.setPipePresentationStyling(${enabled}); true;`);
  await setStyling(false);
  await settle(`${mode} flat PIPE-state framebuffer`);
  const flat = await sample(cdp, evaluate, mode);
  await setStyling(true);
  await settle(`${mode} styled PIPE-state framebuffer`);
  const styled = await sample(cdp, evaluate, mode);
  await setStyling(false);
  await settle(`${mode} repeated flat PIPE-state framebuffer`);
  const repeated = await sample(cdp, evaluate, mode);

  const cards = atlas.map((entry, index) => {
    const delta = subtract(styled.probes[index], flat.probes[index]);
    const repeat = subtract(repeated.probes[index], flat.probes[index]);
    assert(equal(flat.wrong[index], styled.wrong[index]) && equal(flat.wrong[index], repeated.wrong[index]),
      `PIPE/${entry.stateKey}: state styling leaked into wrong owner`);
    assert(equal(flat.probes[index], repeated.probes[index])
      && equal(flat.emptyRoutes[index], repeated.emptyRoutes[index])
      && equal(flat.paused[index], repeated.paused[index]),
    `PIPE/${entry.stateKey}: off→on→off is not exact`);
    assert(flat.probes[index][3] === styled.probes[index][3]
      && flat.emptyRoutes[index][3] === styled.emptyRoutes[index][3]
      && flat.paused[index][3] === styled.paused[index][3],
    `PIPE/${entry.stateKey}: presentation state changed semantic alpha`);
    return {
      stateKey: entry.stateKey,
      payload: entry.payload,
      peak: peak(delta),
      emptyRoutePeak: peak(subtract(styled.emptyRoutes[index], flat.emptyRoutes[index])),
      pausedPeak: peak(subtract(styled.paused[index], flat.paused[index])),
      repeatPeak: peak(repeat),
      styledRgb: styled.probes[index].slice(0, 3),
    };
  });
  assert(cards.every(({ peak: responsePeak, emptyRoutePeak, pausedPeak, repeatPeak }) => responsePeak > 0
      && emptyRoutePeak > 0 && pausedPeak > 0 && responsePeak <= 160 && emptyRoutePeak <= 128
      && pausedPeak <= 160 && repeatPeak === 0),
  `${mode}: PIPE payload/route/pause response is inert, unbounded, or unstable (${JSON.stringify(cards)})`);
  const signatures = new Set(cards.slice(0, 4).map(({ styledRgb }) => styledRgb.join(',')));
  assert(signatures.size >= 3,
    `${mode}: known PIPE payload families collapsed to fewer than three visual signatures (${JSON.stringify(cards)})`);
  return { cards, backend: mode, exactOwnerControls: true, exactRepeatedOff: true, rgbOnly: true };
}

async function sample(cdp, evaluate, mode) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    if (!canvas) throw new Error('PIPE state canvas backing unavailable');
    const rect = canvas.getBoundingClientRect();
    const pointToPixel = (point) => {
      const screen = audit.worldToScreen(point.x + point.width / 2, point.y + point.height / 2);
      const x = Math.max(0, Math.min(canvas.width - 1,
        Math.floor((screen.x - rect.left) * canvas.width / rect.width)));
      const yTop = Math.max(0, Math.min(canvas.height - 1,
        Math.floor((screen.y - rect.top) * canvas.height / rect.height)));
      return { x, yTop };
    };
    const read = (point) => {
      const { x, yTop } = pointToPixel(point);
      if (${JSON.stringify(mode)} === 'webgl') {
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) throw new Error('PIPE state WebGL backing unavailable');
        const pixel = new Uint8Array(4);
        gl.readPixels(x, canvas.height - 1 - yTop, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        return Array.from(pixel);
      }
      const context = canvas.getContext('2d');
      if (!context) throw new Error('PIPE state Canvas backing unavailable');
      return Array.from(context.getImageData(x, yTop, 1, 1).data);
    };
    const cards = audit.pipeStateGraphicsAtlas().cards;
    return {
      probes: cards.map((entry) => read(entry.responseProbe)),
      emptyRoutes: cards.map((entry) => read(entry.emptyRoute)),
      paused: cards.map((entry) => read(entry.pausedPpip)),
      wrong: cards.map((entry) => read(entry.wrongOwner)),
    };
  })()`);
}

function matchesCard(entry, expected) {
  return entry.material === PIPE_MATERIAL && entry.code === 'PIPE'
    && entry.stateKey === expected.key && entry.payload === expected.payload && entry.route === expected.route
    && entry.encodedState === ((expected.payload & 0xff) | PAYLOAD_PRESENT | (expected.route << 9));
}
function subtract(left, right) { return left.map((value, index) => value - right[index]); }
function peak(values) { return Math.max(...values.map((value) => Math.abs(value))); }
function equal(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]); }
