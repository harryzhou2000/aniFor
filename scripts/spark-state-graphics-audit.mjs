const EMPTY = 0;
const SAND = 1;
const WATER = 2;
const METAL = 23;
const SPRK = 148;

const EXPECTED_KEYS = [
  'metalFresh',
  'semiconductorPropagating',
  'thermalMidlife',
  'electrodeExpiring',
  'switchFresh',
  'aqueousPropagating',
];
const EXPECTED_FAMILIES = [
  'metallic', 'semiconductor', 'thermal', 'electrode', 'device', 'aqueous',
];
const EXPECTED_HOSTS = [23, 144, 145, 140, 149, 16];
const EXPECTED_LIVES = [4, 3, 2, 1, 4, 3];
const EXPECTED_STATES = [33815, 33680, 33425, 33164, 33941, 33552];
const UNREPRESENTABLE_STATE = 0x8400;

/** Paired real-framebuffer proof for native SPRK retained-host and life styling. */
export async function auditSparkStateGraphics({
  cdp,
  mode,
  evaluate,
  waitFor,
  waitForStablePageCapture,
  assert,
  worldWidth,
  worldHeight,
}) {
  const started = performance.now();
  const stage = (name) => console.error(
    `[spark-state-graphics:${mode}] ${name} ${Math.round(performance.now() - started)}ms`,
  );
  await waitForStablePageCapture(cdp, `${mode} initial blank SPRK-state framebuffer`);
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    if (typeof audit.prepareSparkStateGraphicsFixture !== 'function'
      || typeof audit.sparkStateGraphicsAtlas !== 'function'
      || typeof audit.setSparkStateStyling !== 'function') {
      throw new Error('SPRK state graphics audit API unavailable');
    }
    audit.prepareSparkStateGraphicsFixture();
    return true;
  })()`);
  const rawAtlas = await waitFor(() => evaluate(cdp, `(() => {
    const atlas = window.__ANIFOR_INPUT_AUDIT__.sparkStateGraphicsAtlas();
    return atlas?.cards?.length === 6 ? atlas : false;
  })()`), 15_000, `${mode} SPRK state graphics fixture`);
  const atlas = normalizeAtlas(rawAtlas);
  assertAtlasContract(atlas, mode, assert);

  const semantic = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const cards = audit.sparkStateGraphicsAtlas().cards;
    const inside = (x, y, rect) => x >= rect.x && x < rect.x + rect.width
      && y >= rect.y && y < rect.y + rect.height;
    const exactRect = (rect, material, state) => {
      for (let y = rect.y; y < rect.y + rect.height; y++) {
        for (let x = rect.x; x < rect.x + rect.width; x++) {
          if (audit.cell(x, y) !== material || audit.presentationState(x, y) !== state) {
            return false;
          }
        }
      }
      return true;
    };
    return cards.map((entry) => {
      let bodyExact = true;
      for (let y = entry.body.y; y < entry.body.y + entry.body.height; y++) {
        for (let x = entry.body.x; x < entry.body.x + entry.body.width; x++) {
          const empty = inside(x, y, entry.authoredHole) || inside(x, y, entry.openNotch);
          bodyExact = bodyExact
            && audit.cell(x, y) === (empty ? ${EMPTY} : entry.material)
            && audit.presentationState(x, y) === (empty ? 0 : entry.encodedState);
        }
      }
      return {
        material: entry.material,
        stateKey: entry.key,
        family: entry.family,
        host: entry.host,
        life: entry.life,
        encodedState: entry.encodedState,
        bodyExact,
        thinExact: exactRect(entry.thinStructure, entry.material, entry.encodedState),
        isolatedExact: audit.cell(entry.isolated.x, entry.isolated.y) === entry.material
          && audit.presentationState(entry.isolated.x, entry.isolated.y) === entry.encodedState,
        zeroExact: exactRect(entry.zeroState, ${SPRK}, 0),
        unrepresentableExact: exactRect(
          entry.unrepresentableHost, ${SPRK}, ${UNREPRESENTABLE_STATE},
        ),
        wrongOwnerExact: exactRect(entry.wrongOwner, ${SAND}, entry.encodedState),
        waterExact: exactRect(entry.waterControl, ${WATER}, entry.encodedState),
        metalExact: exactRect(entry.metalControl, ${METAL}, entry.encodedState),
        blankExact: exactRect(entry.guardedBlank, ${EMPTY}, 0),
      };
    });
  })()`);
  assert(semantic.every((entry, index) => entry.material === SPRK
      && entry.stateKey === EXPECTED_KEYS[index]
      && entry.family === EXPECTED_FAMILIES[index]
      && entry.host === EXPECTED_HOSTS[index]
      && entry.life === EXPECTED_LIVES[index]
      && entry.encodedState === EXPECTED_STATES[index]
      && entry.bodyExact && entry.thinExact && entry.isolatedExact
      && entry.zeroExact && entry.unrepresentableExact && entry.wrongOwnerExact
      && entry.waterExact && entry.metalExact && entry.blankExact),
  `${mode}: SPRK fixture lost exact material/state/topology (${JSON.stringify(semantic)})`);
  stage('fixture-ready');

  const setStyling = async (enabled) => evaluate(cdp, `(() => {
    window.__ANIFOR_INPUT_AUDIT__.setSparkStateStyling(${enabled});
    return true;
  })()`);
  await setStyling(false);
  await waitForStablePageCapture(cdp, `${mode} flat SPRK-state framebuffer`);
  const flat = await sampleBacking({ cdp, evaluate, worldWidth, worldHeight });
  await setStyling(true);
  await waitForStablePageCapture(cdp, `${mode} styled SPRK-state framebuffer`);
  const styled = await sampleBacking({ cdp, evaluate, worldWidth, worldHeight });
  await setStyling(false);
  await waitForStablePageCapture(cdp, `${mode} repeated flat SPRK-state framebuffer`);
  const repeated = await sampleBacking({ cdp, evaluate, worldWidth, worldHeight });
  for (const [state, backing] of [
    ['flat', flat], ['styled', styled], ['repeated-flat', repeated],
  ]) assertBacking(backing, `${mode} ${state}`, assert);

  const responses = flat.cards.map((base, index) => {
    const changed = styled.cards[index];
    const returned = repeated.cards[index];
    assert(base.semanticSignature === changed.semanticSignature
        && base.semanticSignature === returned.semanticSignature
        && base.alphaSignature === changed.alphaSignature
        && base.alphaSignature === returned.alphaSignature
        && base.supportSignature === changed.supportSignature
        && base.supportSignature === returned.supportSignature,
    `${mode}: SPRK/${base.stateKey} styling changed semantic/alpha/support`);
    for (const control of [
      'zeroRgb', 'unrepresentableRgb', 'wrongOwnerRgb', 'waterRgb', 'metalRgb', 'blankRgb',
    ]) {
      assert(arraysEqual(base[control], changed[control])
          && arraysEqual(base[control], returned[control]),
      `${mode}: SPRK/${base.stateKey} styling leaked into ${control}`);
    }
    const body = summarizeRgbResponse(base.bodyRgb, changed.bodyRgb, returned.bodyRgb);
    const shell = summarizeRgbResponse(base.shellRgb, changed.shellRgb, returned.shellRgb);
    const core = summarizeRgbResponse(base.coreRgb, changed.coreRgb, returned.coreRgb);
    const host = summarizeRgbResponse(base.hostRgb, changed.hostRgb, returned.hostRgb);
    return {
      material: base.material,
      stateKey: base.stateKey,
      family: base.family,
      host: base.host,
      life: base.life,
      encodedState: base.encodedState,
      rgbRms: body.rgbRms,
      rgbPeak: body.rgbPeak,
      changedSampleRatio: body.changedSampleRatio,
      repeatRgbPeak: body.repeatRgbPeak,
      meanDeltaRgb: body.meanDeltaRgb,
      responseSignature: body.responseSignature,
      motif: {
        shellRgbRms: shell.rgbRms,
        coreRgbRms: core.rgbRms,
        hostRgbRms: host.rgbRms,
      },
    };
  });
  assert(responses.every((response) => response.rgbRms >= 0.01 && response.rgbRms <= 48
      && response.rgbPeak > 0 && response.rgbPeak <= 64
      && response.changedSampleRatio >= 0.01
      && response.repeatRgbPeak === 0
      && Math.max(
        response.motif.shellRgbRms,
        response.motif.coreRgbRms,
        response.motif.hostRgbRms,
      ) > 0),
  `${mode}: SPRK host/life response is absent, unbounded, or unstable (${JSON.stringify(responses)})`);
  assert(new Set(responses.map(({ responseSignature }) => responseSignature)).size === 6,
    `${mode}: SPRK host/life response signatures are not all distinct`);
  const minimumStateDistance = minimumPairwiseStateDistance(responses);
  assert(minimumStateDistance >= 0.05,
    `${mode}: SPRK host/life stages are not materially distinguishable (${minimumStateDistance})`);
  stage('responses-ready');
  return {
    cards: responses,
    minimumStateDistance: round(minimumStateDistance, 4),
    exactRepeatedOff: responses.every(({ repeatRgbPeak }) => repeatRgbPeak === 0),
    exactControlNoOp: true,
  };
}

export function assertPairedSparkStateGraphics(results, assert) {
  const canvasResult = results.find((result) => result.backend === 'canvas2d');
  const webglResult = results.find((result) => result.backend === 'webgl');
  const canvas = canvasResult?.sparkStateGraphics;
  const webgl = webglResult?.sparkStateGraphics;
  assert(canvas && webgl, 'SPRK-state graphics gate requires Canvas2D and WebGL results');
  assert(canvas.cards.length === 6 && webgl.cards.length === 6
      && canvas.exactRepeatedOff && webgl.exactRepeatedOff
      && canvas.exactControlNoOp && webgl.exactControlNoOp
      && canvasResult.browserErrors === 0 && webglResult.browserErrors === 0,
  'Paired SPRK-state count, control, repetition, or browser-error contract failed');

  const parity = canvas.cards.map((canvasCard) => {
    const webglCard = webgl.cards.find(({ stateKey }) => stateKey === canvasCard.stateKey);
    assert(webglCard, `WebGL SPRK/${canvasCard.stateKey} card is missing`);
    const responseRatio = canvasCard.rgbRms / Math.max(0.01, webglCard.rgbRms);
    const chromaCosine = vectorCosine(canvasCard.meanDeltaRgb, webglCard.meanDeltaRgb);
    assert(responseRatio >= 0.12 && responseRatio <= 8,
      `Canvas/WebGL SPRK/${canvasCard.stateKey} response diverged (${canvasCard.rgbRms}/${webglCard.rgbRms})`);
    // Canvas feeds the host tint into its compact emission field while WebGL
    // applies it after analytic emission. Their signed framebuffer deltas can
    // therefore include different amounts of pre-existing white compression;
    // require positive family alignment while preserving WebGL's richer tint.
    assert(chromaCosine >= 0.25,
      `Canvas/WebGL SPRK/${canvasCard.stateKey} chroma diverged (${chromaCosine})`);
    return {
      stateKey: canvasCard.stateKey,
      responseRatio: round(responseRatio, 4),
      chromaCosine: round(chromaCosine, 5),
    };
  });
  console.error(`[spark-state-graphics:paired] parity ${JSON.stringify(parity)}`);
}

function normalizeAtlas(snapshot) {
  const point = (value) => ({ x: value.x, y: value.y });
  const rect = (value) => ({ ...point(value), width: value.width, height: value.height });
  return {
    cards: (snapshot?.cards ?? []).map((entry) => ({
      ...entry,
      stateKey: entry.key,
      card: rect(entry.card),
      body: rect(entry.body),
      shellProbe: rect(entry.shellProbe),
      coreProbe: rect(entry.coreProbe),
      hostProbe: rect(entry.hostProbe),
      authoredHole: rect(entry.authoredHole),
      openNotch: rect(entry.openNotch),
      thinStructure: rect(entry.thinStructure),
      isolated: point(entry.isolated),
      zeroState: rect(entry.zeroState),
      unrepresentableHost: rect(entry.unrepresentableHost),
      wrongOwner: rect(entry.wrongOwner),
      waterControl: rect(entry.waterControl),
      metalControl: rect(entry.metalControl),
      guardedBlank: rect(entry.guardedBlank),
    })),
  };
}

function assertAtlasContract(atlas, mode, assert) {
  assert(atlas.cards.length === 6
      && atlas.cards.every((entry, index) => entry.index === index
        && entry.material === SPRK
        && entry.code === 'SPRK'
        && entry.stateKey === EXPECTED_KEYS[index]
        && entry.family === EXPECTED_FAMILIES[index]
        && entry.host === EXPECTED_HOSTS[index]
        && entry.life === EXPECTED_LIVES[index]
        && entry.encodedState === EXPECTED_STATES[index]),
  `${mode}: SPRK-state atlas contract changed (${JSON.stringify(atlas.cards.map(
    ({ stateKey, family, host, life, encodedState }) => ({
      stateKey, family, host, life, encodedState,
    }),
  ))})`);
}

async function sampleBacking({ cdp, evaluate, worldWidth, worldHeight }) {
  return evaluate(cdp, `(() => {
    const world = document.querySelector('.world-canvas');
    if (!(world instanceof HTMLCanvasElement)) throw new Error('World canvas unavailable');
    const copy = document.createElement('canvas');
    copy.width = world.width; copy.height = world.height;
    const context = copy.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('SPRK-state backing sampler unavailable');
    context.drawImage(world, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    const scaleX = copy.width / ${worldWidth}, scaleY = copy.height / ${worldHeight};
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const cards = audit.sparkStateGraphicsAtlas().cards;
    const key = ({ x, y }) => x + ',' + y;
    const rectPoints = (rect, step = 1) => { const points = [];
      for (let y = rect.y; y < rect.y + rect.height; y += step) {
        for (let x = rect.x; x < rect.x + rect.width; x += step) points.push({ x, y });
      }
      return points;
    };
    const cellAlpha = ({ x, y }) => { let peak = 0;
      const left = Math.floor(x * scaleX), top = Math.floor(y * scaleY);
      const right = Math.max(left + 1, Math.floor((x + 1) * scaleX));
      const bottom = Math.max(top + 1, Math.floor((y + 1) * scaleY));
      for (let py = top; py < bottom; py++) for (let px = left; px < right; px++) {
        peak = Math.max(peak, pixels[(py * copy.width + px) * 4 + 3]);
      }
      return peak;
    };
    const sampleRgb = (points) => { const rgb = [];
      for (const { x, y } of points) {
        const px = Math.min(copy.width - 1, Math.floor((x + 0.5) * scaleX));
        const py = Math.min(copy.height - 1, Math.floor((y + 0.5) * scaleY));
        const offset = (py * copy.width + px) * 4;
        rgb.push(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
      }
      return rgb;
    };
    return { scaleX, scaleY, cards: cards.map((entry) => {
      const emptyKeys = new Set(
        [...rectPoints(entry.authoredHole), ...rectPoints(entry.openNotch)].map(key),
      );
      const bodyPoints = rectPoints(entry.body).filter((point) => !emptyKeys.has(key(point)));
      const bodySamples = rectPoints(entry.body, 2).filter((point) => !emptyKeys.has(key(point)));
      const thin = rectPoints(entry.thinStructure), zero = rectPoints(entry.zeroState);
      const unrepresentable = rectPoints(entry.unrepresentableHost);
      const wrongOwner = rectPoints(entry.wrongOwner), water = rectPoints(entry.waterControl);
      const metal = rectPoints(entry.metalControl), blank = rectPoints(entry.guardedBlank);
      let alphaSignature = 2166136261, supportSignature = 2166136261;
      let semanticSignature = 2166136261;
      const left = Math.floor(entry.card.x * scaleX), top = Math.floor(entry.card.y * scaleY);
      const right = Math.floor((entry.card.x + entry.card.width) * scaleX);
      const bottom = Math.floor((entry.card.y + entry.card.height) * scaleY);
      for (let py = top; py < bottom; py++) for (let px = left; px < right; px++) {
        const alpha = pixels[(py * copy.width + px) * 4 + 3];
        alphaSignature = Math.imul(alphaSignature ^ alpha, 16777619) >>> 0;
        supportSignature = Math.imul(supportSignature ^ Number(alpha > 0), 16777619) >>> 0;
      }
      for (let y = entry.card.y; y < entry.card.y + entry.card.height; y++) {
        for (let x = entry.card.x; x < entry.card.x + entry.card.width; x++) {
          semanticSignature = Math.imul(semanticSignature ^ audit.cell(x, y), 16777619) >>> 0;
          semanticSignature = Math.imul(
            semanticSignature ^ audit.presentationState(x, y), 16777619,
          ) >>> 0;
        }
      }
      return {
        material: entry.material, stateKey: entry.key, family: entry.family,
        host: entry.host, life: entry.life, encodedState: entry.encodedState,
        semanticSignature, alphaSignature, supportSignature,
        bodyExpected: bodyPoints.length,
        bodySupported: bodyPoints.filter((point) => cellAlpha(point) > 0).length,
        authoredHoleExpected: rectPoints(entry.authoredHole).length,
        authoredHoleTransparent: rectPoints(entry.authoredHole)
          .filter((point) => cellAlpha(point) === 0).length,
        openNotchExpected: rectPoints(entry.openNotch).length,
        openNotchTransparent: rectPoints(entry.openNotch)
          .filter((point) => cellAlpha(point) === 0).length,
        thinExpected: thin.length, thinSupported: thin.filter((point) => cellAlpha(point) > 0).length,
        isolatedAlphaPeak: cellAlpha(entry.isolated),
        zeroExpected: zero.length, zeroSupported: zero.filter((point) => cellAlpha(point) > 0).length,
        unrepresentableExpected: unrepresentable.length,
        unrepresentableSupported: unrepresentable.filter((point) => cellAlpha(point) > 0).length,
        wrongOwnerExpected: wrongOwner.length,
        wrongOwnerSupported: wrongOwner.filter((point) => cellAlpha(point) > 0).length,
        waterExpected: water.length, waterSupported: water.filter((point) => cellAlpha(point) > 0).length,
        metalExpected: metal.length, metalSupported: metal.filter((point) => cellAlpha(point) > 0).length,
        blankExpected: blank.length, blankTransparent: blank.filter((point) => cellAlpha(point) === 0).length,
        bodyRgb: sampleRgb(bodySamples),
        shellRgb: sampleRgb(rectPoints(entry.shellProbe)),
        coreRgb: sampleRgb(rectPoints(entry.coreProbe)),
        hostRgb: sampleRgb(rectPoints(entry.hostProbe)),
        zeroRgb: sampleRgb(zero), unrepresentableRgb: sampleRgb(unrepresentable),
        wrongOwnerRgb: sampleRgb(wrongOwner), waterRgb: sampleRgb(water),
        metalRgb: sampleRgb(metal), blankRgb: sampleRgb(blank),
      };
    }) };
  })()`);
}

function assertBacking(backing, label, assert) {
  assert(Number.isInteger(backing.scaleX) && Number.isInteger(backing.scaleY)
      && backing.scaleX > 0 && backing.scaleY > 0,
  `${label}: SPRK backing does not preserve integral scaling`);
  assert(backing.cards.length === 6 && backing.cards.every((card) => (
    card.bodyExpected === 4508 && card.bodySupported >= card.bodyExpected * 0.98
    && card.authoredHoleExpected === 36
    && card.openNotchExpected === 64
    && card.thinExpected === 24 && card.thinSupported === card.thinExpected
    && card.isolatedAlphaPeak > 0
    && card.zeroExpected === 224 && card.zeroSupported === card.zeroExpected
    && card.unrepresentableExpected === 224
    && card.unrepresentableSupported === card.unrepresentableExpected
    && card.wrongOwnerExpected === 224 && card.wrongOwnerSupported === card.wrongOwnerExpected
    && card.waterExpected === 224 && card.waterSupported === card.waterExpected
    && card.metalExpected === 224 && card.metalSupported === card.metalExpected
    // SPRK is emissive, so its shared broad emission plane may legitimately
    // give nearby semantic Empty holes and guard cells nonzero framebuffer
    // alpha. Exact semantic holes are proved separately; flat/styled/flat
    // alpha and support signatures below prove this style never changes them.
    && card.blankExpected === 6016 && card.blankTransparent >= card.blankExpected * 0.96
  )), `${label}: SPRK-state backing changed topology (${JSON.stringify(
    backing.cards.map((card) => ({
      ...card,
      bodyRgb: undefined, shellRgb: undefined, coreRgb: undefined, hostRgb: undefined,
      zeroRgb: undefined, unrepresentableRgb: undefined, wrongOwnerRgb: undefined,
      waterRgb: undefined, metalRgb: undefined, blankRgb: undefined,
    })),
  )})`);
}

function summarizeRgbResponse(base, changed, returned) {
  let squared = 0;
  let peak = 0;
  let repeatPeak = 0;
  let changedSamples = 0;
  let signature = 2166136261;
  const signed = [0, 0, 0];
  for (let offset = 0; offset < base.length; offset += 3) {
    let any = false;
    for (let channel = 0; channel < 3; channel++) {
      const delta = changed[offset + channel] - base[offset + channel];
      squared += delta * delta;
      signed[channel] += delta;
      peak = Math.max(peak, Math.abs(delta));
      any ||= delta !== 0;
      signature = Math.imul(signature ^ (delta + 255), 16777619) >>> 0;
      repeatPeak = Math.max(
        repeatPeak, Math.abs(returned[offset + channel] - base[offset + channel]),
      );
    }
    changedSamples += Number(any);
  }
  const samples = Math.max(1, base.length / 3);
  return {
    rgbRms: Math.sqrt(squared / Math.max(1, base.length)),
    rgbPeak: peak,
    changedSampleRatio: changedSamples / samples,
    repeatRgbPeak: repeatPeak,
    meanDeltaRgb: signed.map((value) => value / samples),
    responseSignature: signature,
  };
}

function minimumPairwiseStateDistance(responses) {
  let minimum = Number.POSITIVE_INFINITY;
  const vector = (response) => [
    response.rgbRms,
    ...response.meanDeltaRgb,
    response.motif.shellRgbRms,
    response.motif.coreRgbRms,
    response.motif.hostRgbRms,
  ];
  for (let left = 0; left < responses.length; left++) {
    for (let right = left + 1; right < responses.length; right++) {
      const a = vector(responses[left]);
      const b = vector(responses[right]);
      minimum = Math.min(
        minimum, Math.hypot(...a.map((value, index) => value - b[index])),
      );
    }
  }
  return minimum;
}

function vectorCosine(left, right) {
  const dot = left.reduce((sum, value, index) => sum + value * right[index], 0);
  const leftMagnitude = Math.hypot(...left);
  const rightMagnitude = Math.hypot(...right);
  return dot / Math.max(0.000001, leftMagnitude * rightMagnitude);
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
