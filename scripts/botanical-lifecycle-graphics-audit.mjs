const SAND = 1;
const WATER = 2;
const PLANT = 10;
const METAL = 23;
const SEED = 50;

const EXPECTED_KEYS = [
  'seedDry',
  'seedSip',
  'seedReady',
  'seedGerminating',
  'plantOrdinary',
  'plantTreeGreen',
  'plantTreeCyan',
  'plantTreeMagenta',
];
const EXPECTED_MATERIALS = [SEED, SEED, SEED, SEED, PLANT, PLANT, PLANT, PLANT];
const EXPECTED_STATES = [
  0x0000, 0x0002, 0x4008, 0xc81f,
  0x8000, 0xd561, 0xe433, 0xb10f,
];

/** Paired real-framebuffer proof for native SEED hydration and PLNT tree genetics. */
export async function auditBotanicalLifecycleGraphics({
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
    `[botanical-lifecycle-graphics:${mode}] ${name} ${Math.round(performance.now() - started)}ms`,
  );
  await waitForStablePageCapture(cdp, `${mode} initial blank botanical-lifecycle framebuffer`);
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    if (typeof audit.prepareBotanicalLifecycleGraphicsFixture !== 'function'
      || typeof audit.botanicalLifecycleGraphicsAtlas !== 'function'
      || typeof audit.setBotanicalLifecycleStyling !== 'function') {
      throw new Error('Botanical lifecycle graphics audit API unavailable');
    }
    audit.prepareBotanicalLifecycleGraphicsFixture();
    return true;
  })()`);
  const rawAtlas = await waitFor(() => evaluate(cdp, `(() => {
    const atlas = window.__ANIFOR_INPUT_AUDIT__.botanicalLifecycleGraphicsAtlas();
    return atlas?.cards?.length === 8 ? atlas : false;
  })()`), 15_000, `${mode} botanical lifecycle fixture`);
  const atlas = normalizeAtlas(rawAtlas);
  assertAtlasContract(atlas, mode, assert);

  const semantic = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const cards = audit.botanicalLifecycleGraphicsAtlas().cards;
    const inside = (x, y, rect) => x >= rect.x && x < rect.x + rect.width
      && y >= rect.y && y < rect.y + rect.height;
    const exactRect = (rect, material, state) => {
      for (let y = rect.y; y < rect.y + rect.height; y++) {
        for (let x = rect.x; x < rect.x + rect.width; x++) {
          if (audit.cell(x, y) !== material || audit.presentationState(x, y) !== state) return false;
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
            && audit.cell(x, y) === (empty ? 0 : entry.material)
            && audit.presentationState(x, y) === (empty ? 0 : entry.encodedState);
        }
      }
      return {
        material: entry.material,
        stateKey: entry.key,
        encodedState: entry.encodedState,
        kind: entry.kind,
        bodyExact,
        thinExact: exactRect(entry.thinStructure, entry.material, entry.encodedState),
        isolatedExact: audit.cell(entry.isolated.x, entry.isolated.y) === entry.material
          && audit.presentationState(entry.isolated.x, entry.isolated.y) === entry.encodedState,
        zeroExact: exactRect(entry.zeroState, entry.material, 0),
        wrongOwnerExact: exactRect(entry.wrongOwner, ${METAL}, entry.encodedState),
        waterExact: exactRect(entry.waterControl, ${WATER}, entry.encodedState),
        sandExact: exactRect(entry.sandControl, ${SAND}, entry.encodedState),
        blankExact: exactRect(entry.guardedBlank, 0, 0),
      };
    });
  })()`);
  assert(semantic.every((entry, index) => entry.material === EXPECTED_MATERIALS[index]
      && entry.stateKey === EXPECTED_KEYS[index]
      && entry.encodedState === EXPECTED_STATES[index]
      && entry.kind === (index < 4 ? 'seed' : 'plant')
      && entry.bodyExact && entry.thinExact && entry.isolatedExact && entry.zeroExact
      && entry.wrongOwnerExact && entry.waterExact && entry.sandExact && entry.blankExact),
  `${mode}: botanical fixture lost exact material/state/topology (${JSON.stringify(semantic)})`);
  stage('fixture-ready');

  const setStyling = async (enabled) => evaluate(cdp, `(() => {
    window.__ANIFOR_INPUT_AUDIT__.setBotanicalLifecycleStyling(${enabled}); return true;
  })()`);
  await setStyling(false);
  await waitForStablePageCapture(cdp, `${mode} flat botanical-lifecycle framebuffer`);
  const flat = await sampleBacking({ cdp, evaluate, worldWidth, worldHeight });
  await setStyling(true);
  await waitForStablePageCapture(cdp, `${mode} styled botanical-lifecycle framebuffer`);
  const styled = await sampleBacking({ cdp, evaluate, worldWidth, worldHeight });
  await setStyling(false);
  await waitForStablePageCapture(cdp, `${mode} repeated flat botanical-lifecycle framebuffer`);
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
    `${mode}: ${base.stateKey} styling changed semantic/alpha/support`);
    for (const control of [
      'zeroRgb', 'wrongOwnerRgb', 'waterRgb', 'sandRgb', 'blankRgb',
    ]) {
      assert(arraysEqual(base[control], changed[control])
          && arraysEqual(base[control], returned[control]),
      `${mode}: ${base.stateKey} lifecycle styling leaked into ${control}`);
    }
    const body = summarizeRgbResponse(base.bodyRgb, changed.bodyRgb, returned.bodyRgb);
    const surface = summarizeRgbResponse(
      base.surfaceRgb, changed.surfaceRgb, returned.surfaceRgb,
    );
    const core = summarizeRgbResponse(base.coreRgb, changed.coreRgb, returned.coreRgb);
    const lifecycle = summarizeRgbResponse(
      base.lifecycleRgb, changed.lifecycleRgb, returned.lifecycleRgb,
    );
    return {
      material: base.material,
      kind: base.kind,
      stateKey: base.stateKey,
      encodedState: base.encodedState,
      rgbRms: body.rgbRms,
      rgbPeak: body.rgbPeak,
      changedSampleRatio: body.changedSampleRatio,
      repeatRgbPeak: body.repeatRgbPeak,
      meanDeltaRgb: body.meanDeltaRgb,
      responseSignature: body.responseSignature,
      motif: {
        surfaceRgbRms: surface.rgbRms,
        coreRgbRms: core.rgbRms,
        lifecycleRgbRms: lifecycle.rgbRms,
      },
    };
  });
  const seedDry = responses[0];
  const seedSip = responses[1];
  const seedReady = responses[2];
  const seedGerminating = responses[3];
  const plantOrdinary = responses[4];
  const treeCards = responses.slice(5);
  for (const noOp of [seedDry, plantOrdinary]) {
    assert(noOp.rgbRms === 0 && noOp.rgbPeak === 0
        && noOp.changedSampleRatio === 0 && noOp.repeatRgbPeak === 0,
    `${mode}: ${noOp.stateKey} was not an exact lifecycle-style no-op (${JSON.stringify(noOp)})`);
  }
  const active = [seedSip, seedReady, seedGerminating, ...treeCards];
  assert(active.every((response) => response.rgbRms >= 0.01 && response.rgbRms <= 70
      && response.rgbPeak > 0 && response.rgbPeak <= 70
      && response.changedSampleRatio >= 0.01
      && response.repeatRgbPeak === 0
      && Math.max(
        response.motif.surfaceRgbRms,
        response.motif.coreRgbRms,
        response.motif.lifecycleRgbRms,
      ) > 0),
  `${mode}: botanical lifecycle response is absent, unbounded, or unstable (${JSON.stringify(responses)})`);
  assert(seedReady.rgbRms > seedSip.rgbRms
      && seedGerminating.rgbRms > seedReady.rgbRms,
  `${mode}: SEED hydration/germination response is not progressive (${JSON.stringify(
    responses.slice(0, 4).map(({ stateKey, rgbRms }) => ({ stateKey, rgbRms })),
  )})`);
  assert(new Set(treeCards.map(({ responseSignature }) => responseSignature)).size === 3,
    `${mode}: inherited green/cyan/magenta PLNT responses are not distinct`);
  const minimumLeafDistance = minimumPairwiseStateDistance(treeCards);
  assert(minimumLeafDistance >= 1,
    `${mode}: inherited PLNT leaf classes are not materially distinguishable (${minimumLeafDistance})`);
  stage('responses-ready');
  return {
    cards: responses,
    minimumLeafDistance: round(minimumLeafDistance, 4),
    exactDormantNoOp: seedDry.rgbPeak === 0,
    exactOrdinaryPlantNoOp: plantOrdinary.rgbPeak === 0,
    exactRepeatedOff: responses.every(({ repeatRgbPeak }) => repeatRgbPeak === 0),
    exactControlNoOp: true,
  };
}

export function assertPairedBotanicalLifecycleGraphics(results, assert) {
  const canvasResult = results.find((result) => result.backend === 'canvas2d');
  const webglResult = results.find((result) => result.backend === 'webgl');
  const canvas = canvasResult?.botanicalLifecycleGraphics;
  const webgl = webglResult?.botanicalLifecycleGraphics;
  assert(canvas && webgl,
    'Botanical lifecycle graphics gate requires Canvas2D and WebGL results');
  assert(canvas.cards.length === 8 && webgl.cards.length === 8
      && canvas.exactDormantNoOp && webgl.exactDormantNoOp
      && canvas.exactOrdinaryPlantNoOp && webgl.exactOrdinaryPlantNoOp
      && canvas.exactRepeatedOff && webgl.exactRepeatedOff
      && canvas.exactControlNoOp && webgl.exactControlNoOp
      && canvasResult.browserErrors === 0 && webglResult.browserErrors === 0,
  'Paired botanical count, no-op, repetition, control, or browser-error contract failed');

  const parity = canvas.cards.filter(({ rgbPeak }) => rgbPeak > 0).map((canvasCard) => {
    const webglCard = webgl.cards.find(({ stateKey }) => stateKey === canvasCard.stateKey);
    assert(webglCard, `WebGL ${canvasCard.stateKey} card is missing`);
    const responseRatio = canvasCard.rgbRms / Math.max(0.01, webglCard.rgbRms);
    const chromaCosine = vectorCosine(canvasCard.meanDeltaRgb, webglCard.meanDeltaRgb);
    assert(responseRatio >= 0.12 && responseRatio <= 8,
      `Canvas/WebGL ${canvasCard.stateKey} response diverged (${canvasCard.rgbRms}/${webglCard.rgbRms})`);
    assert(chromaCosine >= 0.35,
      `Canvas/WebGL ${canvasCard.stateKey} chroma diverged (${chromaCosine})`);
    return {
      stateKey: canvasCard.stateKey,
      responseRatio: round(responseRatio, 4),
      chromaCosine: round(chromaCosine, 5),
    };
  });
  console.error(`[botanical-lifecycle-graphics:paired] parity ${JSON.stringify(parity)}`);
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
      surfaceProbe: rect(entry.surfaceProbe),
      coreProbe: rect(entry.coreProbe),
      lifecycleProbe: rect(entry.lifecycleProbe),
      authoredHole: rect(entry.authoredHole),
      openNotch: rect(entry.openNotch),
      thinStructure: rect(entry.thinStructure),
      isolated: point(entry.isolated),
      zeroState: rect(entry.zeroState),
      wrongOwner: rect(entry.wrongOwner),
      waterControl: rect(entry.waterControl),
      sandControl: rect(entry.sandControl),
      guardedBlank: rect(entry.guardedBlank),
    })),
  };
}

function assertAtlasContract(atlas, mode, assert) {
  assert(atlas.cards.length === 8
      && atlas.cards.every((entry, index) => entry.index === index
        && entry.material === EXPECTED_MATERIALS[index]
        && entry.code === (index < 4 ? 'SEED' : 'PLNT')
        && entry.kind === (index < 4 ? 'seed' : 'plant')
        && entry.stateKey === EXPECTED_KEYS[index]
        && entry.encodedState === EXPECTED_STATES[index]),
  `${mode}: botanical lifecycle atlas contract changed (${JSON.stringify(atlas.cards.map(
    ({ stateKey, material, kind, encodedState }) => ({
      stateKey, material, kind, encodedState,
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
    if (!context) throw new Error('Botanical lifecycle backing sampler unavailable');
    context.drawImage(world, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    const scaleX = copy.width / ${worldWidth}, scaleY = copy.height / ${worldHeight};
    const cards = window.__ANIFOR_INPUT_AUDIT__.botanicalLifecycleGraphicsAtlas().cards;
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
      const wrongOwner = rectPoints(entry.wrongOwner), water = rectPoints(entry.waterControl);
      const sand = rectPoints(entry.sandControl), blank = rectPoints(entry.guardedBlank);
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
          semanticSignature = Math.imul(
            semanticSignature ^ window.__ANIFOR_INPUT_AUDIT__.cell(x, y), 16777619,
          ) >>> 0;
          semanticSignature = Math.imul(
            semanticSignature ^ window.__ANIFOR_INPUT_AUDIT__.presentationState(x, y), 16777619,
          ) >>> 0;
        }
      }
      return {
        material: entry.material, kind: entry.kind, stateKey: entry.key,
        encodedState: entry.encodedState, semanticSignature, alphaSignature, supportSignature,
        bodyExpected: bodyPoints.length,
        bodySupported: bodyPoints.filter((point) => cellAlpha(point) > 0).length,
        thinExpected: thin.length, thinSupported: thin.filter((point) => cellAlpha(point) > 0).length,
        isolatedAlphaPeak: cellAlpha(entry.isolated),
        zeroExpected: zero.length, zeroSupported: zero.filter((point) => cellAlpha(point) > 0).length,
        wrongOwnerExpected: wrongOwner.length,
        wrongOwnerSupported: wrongOwner.filter((point) => cellAlpha(point) > 0).length,
        waterExpected: water.length, waterSupported: water.filter((point) => cellAlpha(point) > 0).length,
        sandExpected: sand.length, sandSupported: sand.filter((point) => cellAlpha(point) > 0).length,
        blankExpected: blank.length, blankTransparent: blank.filter((point) => cellAlpha(point) === 0).length,
        bodyRgb: sampleRgb(bodySamples),
        surfaceRgb: sampleRgb(rectPoints(entry.surfaceProbe)),
        coreRgb: sampleRgb(rectPoints(entry.coreProbe)),
        lifecycleRgb: sampleRgb(rectPoints(entry.lifecycleProbe)),
        zeroRgb: sampleRgb(zero), wrongOwnerRgb: sampleRgb(wrongOwner),
        waterRgb: sampleRgb(water), sandRgb: sampleRgb(sand), blankRgb: sampleRgb(blank),
      };
    }) };
  })()`);
}

function assertBacking(backing, label, assert) {
  assert(Number.isInteger(backing.scaleX) && Number.isInteger(backing.scaleY)
      && backing.scaleX > 0 && backing.scaleY > 0,
  `${label}: botanical backing does not preserve integral scaling`);
  assert(backing.cards.length === 8 && backing.cards.every((card) => (
    card.bodyExpected === 3868 && card.bodySupported >= card.bodyExpected * 0.98
    && card.thinExpected === 24 && card.thinSupported === card.thinExpected
    && card.isolatedAlphaPeak > 0
    && card.zeroExpected === 256 && card.zeroSupported === card.zeroExpected
    && card.wrongOwnerExpected === 256 && card.wrongOwnerSupported === card.wrongOwnerExpected
    && card.waterExpected === 256 && card.waterSupported === card.waterExpected
    && card.sandExpected === 256 && card.sandSupported === card.sandExpected
    && card.blankExpected === 3120 && card.blankTransparent === card.blankExpected
  )), `${label}: botanical lifecycle backing changed topology (${JSON.stringify(
    backing.cards.map((card) => ({
      ...card,
      bodyRgb: undefined, surfaceRgb: undefined, coreRgb: undefined,
      lifecycleRgb: undefined, zeroRgb: undefined, wrongOwnerRgb: undefined,
      waterRgb: undefined, sandRgb: undefined, blankRgb: undefined,
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
    response.motif.surfaceRgbRms,
    response.motif.coreRgbRms,
    response.motif.lifecycleRgbRms,
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
  const leftLength = Math.hypot(...left);
  const rightLength = Math.hypot(...right);
  return dot / Math.max(0.0001, leftLength * rightLength);
}

function arraysEqual(left, right) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function round(value, places = 3) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
