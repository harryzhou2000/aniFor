const SPNG = 81;
const SAND = 1;
const WATER = 2;
const STEAM = 15;
const SALT = 7;
const EXPECTED_KEYS = ['dry', 'low', 'mid', 'high', 'saturated'];
const EXPECTED_HYDRATION = [0, 10, 25, 40, 50];
const EXPECTED_STATES = [64, 74, 89, 104, 114];

/** Focused paired framebuffer proof for authoritative native SPNG hydration. */
export async function auditSpngStateGraphics({
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
    `[spng-state-graphics:${mode}] ${name} ${Math.round(performance.now() - started)}ms`,
  );
  await waitForStablePageCapture(cdp, `${mode} initial blank SPNG-state framebuffer`);
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    if (typeof audit.prepareSpngStateGraphicsFixture !== 'function'
      || typeof audit.spngStateGraphicsAtlas !== 'function'
      || typeof audit.setSpngStateStyling !== 'function') {
      throw new Error('SPNG state graphics audit API unavailable');
    }
    audit.prepareSpngStateGraphicsFixture();
    return true;
  })()`);
  const rawAtlas = await waitFor(() => evaluate(cdp, `(() => {
    const atlas = window.__ANIFOR_INPUT_AUDIT__.spngStateGraphicsAtlas();
    return atlas?.cards?.length === 5 ? atlas : false;
  })()`), 15_000, `${mode} SPNG state graphics fixture`);
  const atlas = normalizeAtlas(rawAtlas);
  assertAtlasContract(atlas, mode, assert);

  const semantic = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const cards = audit.spngStateGraphicsAtlas().cards;
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
        hydration: entry.hydration,
        encodedState: entry.encodedState,
        bodyExact,
        thinExact: exactRect(entry.thinStructure, entry.material, entry.encodedState),
        isolatedExact: audit.cell(entry.isolated.x, entry.isolated.y) === entry.material
          && audit.presentationState(entry.isolated.x, entry.isolated.y) === entry.encodedState,
        zeroExact: exactRect(entry.zeroState, ${SPNG}, 0),
        wrongOwnerExact: exactRect(entry.wrongOwner, ${SAND}, entry.encodedState),
        waterExact: exactRect(entry.waterControl, ${WATER}, entry.encodedState),
        steamExact: exactRect(entry.steamControl, ${STEAM}, entry.encodedState),
        saltExact: exactRect(entry.saltControl, ${SALT}, entry.encodedState),
        blankExact: exactRect(entry.guardedBlank, 0, 0),
      };
    });
  })()`);
  assert(semantic.every((entry, index) => entry.material === SPNG
      && entry.stateKey === EXPECTED_KEYS[index]
      && entry.hydration === EXPECTED_HYDRATION[index]
      && entry.encodedState === EXPECTED_STATES[index]
      && entry.bodyExact && entry.thinExact && entry.isolatedExact && entry.zeroExact
      && entry.wrongOwnerExact && entry.waterExact && entry.steamExact
      && entry.saltExact && entry.blankExact),
  `${mode}: SPNG fixture lost exact material/state/topology (${JSON.stringify(semantic)})`);
  stage('fixture-ready');

  const setStyling = async (enabled) => evaluate(cdp, `(() => {
    window.__ANIFOR_INPUT_AUDIT__.setSpngStateStyling(${enabled}); return true;
  })()`);
  await setStyling(false);
  await waitForStablePageCapture(cdp, `${mode} flat SPNG-state framebuffer`);
  const flat = await sampleBacking({ cdp, evaluate, worldWidth, worldHeight });
  await setStyling(true);
  await waitForStablePageCapture(cdp, `${mode} styled SPNG-state framebuffer`);
  const styled = await sampleBacking({ cdp, evaluate, worldWidth, worldHeight });
  await setStyling(false);
  await waitForStablePageCapture(cdp, `${mode} repeated flat SPNG-state framebuffer`);
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
    `${mode}: SPNG/${base.stateKey} styling changed semantic/alpha/support`);
    for (const control of [
      'zeroRgb', 'wrongOwnerRgb', 'waterRgb', 'steamRgb', 'saltRgb', 'blankRgb',
    ]) {
      assert(arraysEqual(base[control], changed[control])
          && arraysEqual(base[control], returned[control]),
      `${mode}: SPNG/${base.stateKey} styling leaked into ${control}`);
    }
    const body = summarizeRgbResponse(
      base.bodyRgb, changed.bodyRgb, returned.bodyRgb, base.bodyBuckets,
    );
    const surface = summarizeRgbResponse(
      base.surfaceRgb, changed.surfaceRgb, returned.surfaceRgb,
    );
    const core = summarizeRgbResponse(base.coreRgb, changed.coreRgb, returned.coreRgb);
    const hydration = summarizeRgbResponse(
      base.hydrationRgb, changed.hydrationRgb, returned.hydrationRgb,
    );
    const background = summarizeRgbResponse(
      base.backgroundRgb, changed.backgroundRgb, returned.backgroundRgb,
    );
    return {
      material: base.material,
      stateKey: base.stateKey,
      hydration: base.hydration,
      encodedState: base.encodedState,
      rgbRms: body.rgbRms,
      rgbPeak: body.rgbPeak,
      changedSampleRatio: body.changedSampleRatio,
      repeatRgbPeak: body.repeatRgbPeak,
      meanDeltaRgb: body.meanDeltaRgb,
      profile: body.profile,
      responseSignature: body.responseSignature,
      motif: {
        surfaceRgbRms: surface.rgbRms,
        coreRgbRms: core.rgbRms,
        hydrationRgbRms: hydration.rgbRms,
        backgroundRgbRms: background.rgbRms,
      },
    };
  });
  const dry = responses[0];
  const wet = responses.slice(1);
  assert(dry.hydration === 0 && dry.rgbRms === 0 && dry.rgbPeak === 0
      && dry.changedSampleRatio === 0 && dry.repeatRgbPeak === 0,
  `${mode}: authoritative dry SPNG was not an exact hydration-style no-op (${JSON.stringify(dry)})`);
  assert(wet.every((response) => response.rgbRms >= 0.2 && response.rgbRms <= 35
      && response.rgbPeak > 0 && response.rgbPeak <= 48
      && response.changedSampleRatio >= 0.10
      && response.repeatRgbPeak === 0
      && response.profile.length === 16
      && Math.abs(response.profile.reduce((sum, value) => sum + value, 0) - 1) <= 0.001
      && Math.max(
        response.motif.surfaceRgbRms,
        response.motif.coreRgbRms,
        response.motif.hydrationRgbRms,
        response.motif.backgroundRgbRms,
      ) > 0),
  `${mode}: wet SPNG response is absent, unbounded, or unstable (${JSON.stringify(responses)})`);
  for (let index = 1; index < wet.length; index++) {
    assert(wet[index].rgbRms >= wet[index - 1].rgbRms + 0.15,
      `${mode}: SPNG moisture response is not monotonic (${JSON.stringify(wet.map(
        ({ stateKey, hydration: value, rgbRms }) => ({ stateKey, hydration: value, rgbRms }),
      ))})`);
  }
  const hydrationGain = wet.at(-1).rgbRms / Math.max(0.01, wet[0].rgbRms);
  assert(hydrationGain >= 2.5,
    `${mode}: saturated SPNG is not meaningfully wetter than low SPNG (${hydrationGain})`);
  assert(new Set(responses.map(({ responseSignature }) => responseSignature)).size === 5,
    `${mode}: five SPNG state signatures are not distinct (${JSON.stringify(responses)})`);
  const minimumWetStateDistance = minimumPairwiseStateDistance(wet);
  assert(minimumWetStateDistance >= 0.2,
    `${mode}: wet SPNG states are not materially distinguishable (${minimumWetStateDistance})`);
  stage('responses-ready');
  return {
    cards: responses,
    hydrationGain: round(hydrationGain, 4),
    minimumWetStateDistance: round(minimumWetStateDistance, 4),
    exactDryNoOp: dry.rgbPeak === 0,
    exactRepeatedOff: responses.every(({ repeatRgbPeak }) => repeatRgbPeak === 0),
    exactControlNoOp: true,
  };
}

export function assertPairedSpngStateGraphics(results, assert) {
  const canvasResult = results.find((result) => result.backend === 'canvas2d');
  const webglResult = results.find((result) => result.backend === 'webgl');
  const canvas = canvasResult?.spngStateGraphics;
  const webgl = webglResult?.spngStateGraphics;
  assert(canvas && webgl, 'SPNG-state graphics gate requires Canvas2D and WebGL results');
  assert(canvas.cards.length === 5 && webgl.cards.length === 5
      && canvas.exactDryNoOp && webgl.exactDryNoOp
      && canvas.exactRepeatedOff && webgl.exactRepeatedOff
      && canvas.exactControlNoOp && webgl.exactControlNoOp
      && canvasResult.browserErrors === 0 && webglResult.browserErrors === 0,
  'Paired SPNG-state count, dry/control no-op, repetition, or browser-error contract failed');

  const parity = canvas.cards.slice(1).map((canvasCard) => {
    const webglCard = webgl.cards.find(({ stateKey }) => stateKey === canvasCard.stateKey);
    assert(webglCard, `WebGL SPNG/${canvasCard.stateKey} card is missing`);
    const responseRatio = canvasCard.rgbRms / Math.max(0.01, webglCard.rgbRms);
    const profileDistance = Math.max(...canvasCard.profile.map(
      (value, index) => Math.abs(value - webglCard.profile[index]),
    ));
    const chromaCosine = vectorCosine(canvasCard.meanDeltaRgb, webglCard.meanDeltaRgb);
    assert(responseRatio >= 0.2 && responseRatio <= 5,
      `Canvas/WebGL SPNG/${canvasCard.stateKey} response diverged (${canvasCard.rgbRms}/${webglCard.rgbRms})`);
    assert(profileDistance <= 0.35,
      `Canvas/WebGL SPNG/${canvasCard.stateKey} profile diverged (${profileDistance})`);
    assert(chromaCosine >= 0.55,
      `Canvas/WebGL SPNG/${canvasCard.stateKey} chroma diverged (${chromaCosine})`);
    return {
      stateKey: canvasCard.stateKey,
      responseRatio: round(responseRatio, 4),
      profileMaxDistance: round(profileDistance, 5),
      chromaCosine: round(chromaCosine, 5),
    };
  });
  console.error(`[spng-state-graphics:paired] parity ${JSON.stringify(parity)}`);
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
      hydrationProbe: rect(entry.hydrationProbe),
      backgroundProbe: rect(entry.backgroundProbe),
      authoredHole: rect(entry.authoredHole),
      openNotch: rect(entry.openNotch),
      thinStructure: rect(entry.thinStructure),
      isolated: point(entry.isolated),
      zeroState: rect(entry.zeroState),
      wrongOwner: rect(entry.wrongOwner),
      waterControl: rect(entry.waterControl),
      steamControl: rect(entry.steamControl),
      saltControl: rect(entry.saltControl),
      guardedBlank: rect(entry.guardedBlank),
    })),
  };
}

function assertAtlasContract(atlas, mode, assert) {
  assert(atlas.cards.length === 5
      && atlas.cards.every((entry, index) => entry.index === index
        && entry.material === SPNG
        && entry.code === 'SPNG'
        && entry.stateKey === EXPECTED_KEYS[index]
        && entry.hydration === EXPECTED_HYDRATION[index]
        && entry.encodedState === EXPECTED_STATES[index]),
  `${mode}: SPNG-state atlas contract changed (${JSON.stringify(atlas.cards.map(
    ({ stateKey, hydration, encodedState }) => ({ stateKey, hydration, encodedState }),
  ))})`);
}

async function sampleBacking({ cdp, evaluate, worldWidth, worldHeight }) {
  return evaluate(cdp, `(() => {
    const world = document.querySelector('.world-canvas');
    if (!(world instanceof HTMLCanvasElement)) throw new Error('World canvas unavailable');
    const copy = document.createElement('canvas'); copy.width = world.width; copy.height = world.height;
    const context = copy.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('SPNG-state backing sampler unavailable');
    context.drawImage(world, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    const scaleX = copy.width / ${worldWidth}, scaleY = copy.height / ${worldHeight};
    const cards = window.__ANIFOR_INPUT_AUDIT__.spngStateGraphicsAtlas().cards;
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
    const centreAlpha = ({ x, y }) => pixels[(Math.min(copy.height - 1, Math.floor((y + 0.5) * scaleY))
      * copy.width + Math.min(copy.width - 1, Math.floor((x + 0.5) * scaleX))) * 4 + 3];
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
      const emptyKeys = new Set([...rectPoints(entry.authoredHole), ...rectPoints(entry.openNotch)].map(key));
      const bodyPoints = rectPoints(entry.body).filter((point) => !emptyKeys.has(key(point)));
      const bodySamples = rectPoints(entry.body).filter((point) => !emptyKeys.has(key(point)));
      const bodyBuckets = bodySamples.map((point) => Math.min(3, Math.floor(
        (point.y - entry.body.y) * 4 / entry.body.height,
      )) * 4 + Math.min(3, Math.floor((point.x - entry.body.x) * 4 / entry.body.width)));
      const hole = rectPoints(entry.authoredHole), notch = rectPoints(entry.openNotch);
      const thin = rectPoints(entry.thinStructure), zero = rectPoints(entry.zeroState);
      const wrongOwner = rectPoints(entry.wrongOwner), water = rectPoints(entry.waterControl);
      const steam = rectPoints(entry.steamControl), salt = rectPoints(entry.saltControl);
      const blank = rectPoints(entry.guardedBlank);
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
        material: entry.material, code: entry.code, stateKey: entry.key,
        hydration: entry.hydration, encodedState: entry.encodedState,
        semanticSignature, alphaSignature, supportSignature,
        bodyExpected: bodyPoints.length,
        bodySupported: bodyPoints.filter((point) => cellAlpha(point) > 0).length,
        thinExpected: thin.length, thinSupported: thin.filter((point) => cellAlpha(point) > 0).length,
        isolatedAlphaPeak: cellAlpha(entry.isolated),
        zeroExpected: zero.length, zeroSupported: zero.filter((point) => cellAlpha(point) > 0).length,
        wrongOwnerExpected: wrongOwner.length,
        wrongOwnerSupported: wrongOwner.filter((point) => cellAlpha(point) > 0).length,
        waterExpected: water.length, waterSupported: water.filter((point) => cellAlpha(point) > 0).length,
        steamExpected: steam.length, steamSupported: steam.filter((point) => cellAlpha(point) > 0).length,
        saltExpected: salt.length, saltSupported: salt.filter((point) => cellAlpha(point) > 0).length,
        blankExpected: blank.length, blankTransparent: blank.filter((point) => cellAlpha(point) === 0).length,
        holeExpected: hole.length, holeCentreTransparent: hole.filter((point) => centreAlpha(point) === 0).length,
        notchExpected: notch.length,
        notchCentreTransparent: notch.filter((point) => centreAlpha(point) < 128).length,
        bodyRgb: sampleRgb(bodySamples), bodyBuckets,
        surfaceRgb: sampleRgb(rectPoints(entry.surfaceProbe)),
        coreRgb: sampleRgb(rectPoints(entry.coreProbe)),
        hydrationRgb: sampleRgb(rectPoints(entry.hydrationProbe)),
        backgroundRgb: sampleRgb(rectPoints(entry.backgroundProbe)),
        zeroRgb: sampleRgb(zero), wrongOwnerRgb: sampleRgb(wrongOwner),
        waterRgb: sampleRgb(water), steamRgb: sampleRgb(steam), saltRgb: sampleRgb(salt),
        blankRgb: sampleRgb(blank),
      };
    }) };
  })()`);
}

function assertBacking(backing, label, assert) {
  assert(Number.isInteger(backing.scaleX) && Number.isInteger(backing.scaleY)
      && backing.scaleX > 0 && backing.scaleY > 0,
  `${label}: SPNG-state backing does not preserve integral scaling`);
  assert(backing.cards.length === 5 && backing.cards.every((card) => (
    card.bodyExpected === 4124 && card.bodySupported === card.bodyExpected
    && card.thinExpected === 30 && card.thinSupported === card.thinExpected
    && card.isolatedAlphaPeak > 0
    && card.zeroExpected === 288 && card.zeroSupported === card.zeroExpected
    && card.wrongOwnerExpected === 288 && card.wrongOwnerSupported === card.wrongOwnerExpected
    && card.waterExpected === 288 && card.waterSupported === card.waterExpected
    && card.steamExpected === 288 && card.steamSupported === card.steamExpected
    && card.saltExpected === 288 && card.saltSupported === card.saltExpected
    && card.blankExpected === 4320 && card.blankTransparent === card.blankExpected
    && card.holeExpected === 36 && card.holeCentreTransparent >= 16
    && card.notchExpected === 64 && card.notchCentreTransparent >= 40
  )), `${label}: SPNG-state backing changed topology (${JSON.stringify(backing.cards.map(
    (card) => ({ ...card, bodyRgb: undefined, bodyBuckets: undefined,
      surfaceRgb: undefined, coreRgb: undefined, hydrationRgb: undefined,
      backgroundRgb: undefined, zeroRgb: undefined, wrongOwnerRgb: undefined,
      waterRgb: undefined, steamRgb: undefined, saltRgb: undefined, blankRgb: undefined }),
  ))})`);
}

function summarizeRgbResponse(base, changed, returned, bucketsBySample) {
  let squared = 0;
  let peak = 0;
  let repeatPeak = 0;
  let changedSamples = 0;
  let signature = 2166136261;
  const signed = [0, 0, 0];
  const buckets = new Float64Array(16);
  for (let offset = 0; offset < base.length; offset += 3) {
    let any = false;
    const sample = offset / 3;
    const bucket = bucketsBySample?.[sample] ?? 0;
    for (let channel = 0; channel < 3; channel++) {
      const delta = changed[offset + channel] - base[offset + channel];
      squared += delta * delta;
      signed[channel] += delta;
      peak = Math.max(peak, Math.abs(delta));
      buckets[bucket] += Math.abs(delta);
      any ||= delta !== 0;
      signature = Math.imul(signature ^ (delta + 255), 16777619) >>> 0;
      repeatPeak = Math.max(repeatPeak, Math.abs(returned[offset + channel] - base[offset + channel]));
    }
    changedSamples += Number(any);
  }
  const samples = Math.max(1, base.length / 3);
  const total = buckets.reduce((sum, value) => sum + value, 0);
  return {
    rgbRms: Math.sqrt(squared / Math.max(1, base.length)),
    rgbPeak: peak,
    changedSampleRatio: changedSamples / samples,
    repeatRgbPeak: repeatPeak,
    meanDeltaRgb: signed.map((value) => value / samples),
    profile: Array.from(buckets, (value) => total > 0 ? value / total : 0),
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
    response.motif.hydrationRgbRms,
    response.motif.backgroundRgbRms,
  ];
  for (let left = 0; left < responses.length; left++) {
    for (let right = left + 1; right < responses.length; right++) {
      const a = vector(responses[left]);
      const b = vector(responses[right]);
      minimum = Math.min(minimum, Math.hypot(...a.map((value, index) => value - b[index])));
    }
  }
  return minimum;
}

function vectorCosine(left, right) {
  let dot = 0;
  let leftSquared = 0;
  let rightSquared = 0;
  for (let index = 0; index < left.length; index++) {
    dot += left[index] * right[index];
    leftSquared += left[index] * left[index];
    rightSquared += right[index] * right[index];
  }
  return dot / Math.max(1e-6, Math.sqrt(leftSquared * rightSquared));
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function round(value, places = 3) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
