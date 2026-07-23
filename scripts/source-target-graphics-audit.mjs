const EXPECTED_OWNERS = [126, 124, 159, 158, 127];
const EXPECTED_TARGETS = [1, 2, 39, 107, 23, 10, 217];

/** Focused paired framebuffer proof for configured-source target presentation. */
export async function auditSourceTargetGraphics({
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
    `[source-target-graphics:${mode}] ${name} ${Math.round(performance.now() - started)}ms`,
  );
  await waitForStablePageCapture(cdp, `${mode} initial blank source-target framebuffer`);
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    if (typeof audit.prepareSourceTargetGraphicsFixture !== 'function'
      || typeof audit.sourceTargetGraphicsAtlas !== 'function'
      || typeof audit.setSourceTargetStyling !== 'function') {
      throw new Error('Configured-source target graphics audit API unavailable');
    }
    audit.prepareSourceTargetGraphicsFixture();
    return true;
  })()`);
  const rawAtlas = await waitFor(() => evaluate(cdp, `(() => {
    const atlas = window.__ANIFOR_INPUT_AUDIT__.sourceTargetGraphicsAtlas();
    const cards = Array.isArray(atlas) ? atlas : atlas?.cards;
    return cards?.length === 35 ? atlas : false;
  })()`), 15_000, `${mode} source-target graphics fixture`);
  const atlas = normalizeSourceTargetGraphicsAtlas(rawAtlas);
  assertAtlasContract(atlas, mode, assert);

  const semanticState = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const snapshot = audit.sourceTargetGraphicsAtlas();
    const cards = Array.isArray(snapshot) ? snapshot : snapshot.cards;
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
            && audit.cell(x, y) === (empty ? 0 : entry.owner)
            && audit.presentationState(x, y) === (empty ? 0 : entry.target);
        }
      }
      let wallCells = 0;
      let clearCells = 0;
      for (let y = entry.wallCoexistence.y;
        y < entry.wallCoexistence.y + entry.wallCoexistence.height; y++) {
        for (let x = entry.wallCoexistence.x;
          x < entry.wallCoexistence.x + entry.wallCoexistence.width; x++) {
          if (audit.wall(x, y) === snapshot.conductiveWall) wallCells++;
          else if (audit.wall(x, y) === 0) clearCells++;
        }
      }
      return {
        owner: entry.owner,
        target: entry.target,
        encodedState: entry.encodedState,
        bodyExact,
        thinExact: exactRect(entry.thinStructure, entry.owner, entry.target),
        isolatedMaterial: audit.cell(entry.isolated.x, entry.isolated.y),
        isolatedState: audit.presentationState(entry.isolated.x, entry.isolated.y),
        zeroStateExact: exactRect(entry.zeroState, entry.owner, 0),
        wrongOwnerStateExact: (() => {
          for (let y = entry.wrongOwner.y; y < entry.wrongOwner.y + entry.wrongOwner.height; y++) {
            for (let x = entry.wrongOwner.x; x < entry.wrongOwner.x + entry.wrongOwner.width; x++) {
              if (audit.cell(x, y) === entry.owner
                || audit.presentationState(x, y) !== entry.target) return false;
            }
          }
          return true;
        })(),
        targetControlExact: exactRect(entry.targetControl, entry.target, entry.target),
        wallOwnerExact: exactRect(entry.wallCoexistence, entry.owner, entry.target),
        wallCells,
        clearCells,
        guardExact: exactRect(entry.guardedBlank, 0, 0),
      };
    });
  })()`);
  assert(semanticState.every((entry) => entry.encodedState === entry.target
      && (entry.encodedState & 0xFF00) === 0
      && entry.bodyExact && entry.thinExact
      && entry.isolatedMaterial === entry.owner && entry.isolatedState === entry.target
      && entry.zeroStateExact && entry.wrongOwnerStateExact && entry.targetControlExact
      && entry.wallOwnerExact && entry.wallCells === 144 && entry.clearCells === 0
      && entry.guardExact),
  `${mode}: configured-source fixture lost exact owner/target/state/topology (${JSON.stringify(semanticState)})`);
  stage('fixture-ready');

  const setStyling = async (enabled) => evaluate(cdp, `(() => {
    window.__ANIFOR_INPUT_AUDIT__.setSourceTargetStyling(${enabled}); return true;
  })()`);
  await setStyling(false);
  await waitForStablePageCapture(cdp, `${mode} flat source-target framebuffer`);
  const flat = await sampleSourceTargetBacking({ cdp, evaluate, worldWidth, worldHeight });
  await setStyling(true);
  await waitForStablePageCapture(cdp, `${mode} styled source-target framebuffer`);
  const styled = await sampleSourceTargetBacking({ cdp, evaluate, worldWidth, worldHeight });
  await setStyling(false);
  await waitForStablePageCapture(cdp, `${mode} repeated flat source-target framebuffer`);
  const repeated = await sampleSourceTargetBacking({ cdp, evaluate, worldWidth, worldHeight });
  for (const [state, backing] of [
    ['flat', flat], ['styled', styled], ['repeated-flat', repeated],
  ]) assertBacking(backing, `${mode} ${state}`, assert);

  for (let index = 0; index < atlas.cards.length; index++) {
    const base = flat.cards[index];
    const changed = styled.cards[index];
    const returned = repeated.cards[index];
    assert(base.semanticSignature === changed.semanticSignature
        && base.semanticSignature === returned.semanticSignature
        && base.alphaSignature === changed.alphaSignature
        && base.alphaSignature === returned.alphaSignature
        && base.supportSignature === changed.supportSignature
        && base.supportSignature === returned.supportSignature,
    `${mode}: ${base.ownerCode}->${base.targetCode} styling changed semantic/alpha/support`);
    for (const control of ['zeroStateRgb', 'wrongOwnerRgb', 'targetControlRgb', 'guardRgb']) {
      assert(arraysEqual(base[control], changed[control])
          && arraysEqual(base[control], returned[control]),
      `${mode}: ${base.ownerCode}->${base.targetCode} target styling leaked into ${control}`);
    }
  }

  const responses = summarizeResponses(flat, styled, repeated);
  assert(responses.every((response) => response.rgbRms >= 0.02
      && response.rgbRms <= 48 && response.rgbPeak > 0 && response.rgbPeak <= 96
      && response.changedSampleRatio >= 0.02 && response.repeatRgbPeak === 0
      && response.wallRgbRms > 0 && response.wallRgbPeak <= 96
      && response.wallRepeatRgbPeak === 0
      && response.profile.length === 16
      && Math.abs(response.profile.reduce((sum, value) => sum + value, 0) - 1) <= 0.001),
  `${mode}: configured-source target response is absent, unbounded, or unstable (${JSON.stringify(responses)})`);
  for (const owner of EXPECTED_OWNERS) {
    const signatures = responses.filter((entry) => entry.owner === owner)
      .map(({ responseSignature }) => responseSignature);
    assert(new Set(signatures).size === EXPECTED_TARGETS.length,
      `${mode}: source owner ${owner} lost distinct target signatures (${signatures})`);
  }
  stage('responses-ready');
  return {
    cards: responses,
    exactRepeatedOff: responses.every(({ repeatRgbPeak, wallRepeatRgbPeak }) => (
      repeatRgbPeak === 0 && wallRepeatRgbPeak === 0
    )),
  };
}

export function assertPairedSourceTargetGraphics(results, assert) {
  const canvasResult = results.find((result) => result.backend === 'canvas2d');
  const webglResult = results.find((result) => result.backend === 'webgl');
  const canvas = canvasResult?.sourceTargetGraphics;
  const webgl = webglResult?.sourceTargetGraphics;
  assert(canvas && webgl,
    'Configured-source target graphics gate requires Canvas2D and WebGL results');
  assert(canvas.cards.length === 35 && webgl.cards.length === 35
      && canvas.exactRepeatedOff && webgl.exactRepeatedOff
      && canvasResult.browserErrors === 0 && webglResult.browserErrors === 0,
  'Paired configured-source count, repetition, or browser-error contract failed');

  const parity = canvas.cards.map((canvasCard, index) => {
    const webglCard = webgl.cards[index];
    assert(canvasCard.owner === webglCard.owner && canvasCard.target === webglCard.target
        && canvasCard.encodedState === webglCard.encodedState,
    `Canvas/WebGL configured-source identity diverged at card ${index}`);
    const responseRatio = canvasCard.rgbRms / Math.max(0.01, webglCard.rgbRms);
    const wallResponseRatio = canvasCard.wallRgbRms / Math.max(0.01, webglCard.wallRgbRms);
    const profileDistance = Math.max(...canvasCard.profile.map(
      (value, profileIndex) => Math.abs(value - webglCard.profile[profileIndex]),
    ));
    const chromaCosine = vectorCosine(canvasCard.meanDeltaRgb, webglCard.meanDeltaRgb);
    assert(responseRatio >= 0.20 && responseRatio <= 5.0,
      `Canvas/WebGL ${canvasCard.ownerCode}->${canvasCard.targetCode} response diverged (${canvasCard.rgbRms}/${webglCard.rgbRms})`);
    assert(wallResponseRatio >= 0.15 && wallResponseRatio <= 6.0,
      `Canvas/WebGL ${canvasCard.ownerCode}->${canvasCard.targetCode} wall-coexistence response diverged (${canvasCard.wallRgbRms}/${webglCard.wallRgbRms})`);
    assert(profileDistance <= 0.24,
      `Canvas/WebGL ${canvasCard.ownerCode}->${canvasCard.targetCode} profile diverged (${profileDistance})`);
    assert(chromaCosine >= 0.72,
      `Canvas/WebGL ${canvasCard.ownerCode}->${canvasCard.targetCode} RGB direction diverged (${chromaCosine})`);
    return {
      ownerCode: canvasCard.ownerCode,
      targetCode: canvasCard.targetCode,
      responseRatio: round(responseRatio, 4),
      wallResponseRatio: round(wallResponseRatio, 4),
      profileMaxDistance: round(profileDistance, 5),
      chromaCosine: round(chromaCosine, 5),
    };
  });
  console.error(`[source-target-graphics:paired] parity ${JSON.stringify(parity)}`);
}

export function compactSourceTargetGraphicsResults(results) {
  for (const result of results) {
    for (const card of result.sourceTargetGraphics?.cards ?? []) delete card.axisMap;
  }
}

function normalizeSourceTargetGraphicsAtlas(snapshot) {
  const point = (value) => ({ x: value.x, y: value.y });
  const rect = (value) => ({ ...point(value), width: value.width, height: value.height });
  const cards = (Array.isArray(snapshot) ? snapshot : snapshot?.cards ?? []).map((entry) => ({
    ...entry,
    card: rect(entry.card ?? entry),
    body: rect(entry.body),
    ownerShellProbe: rect(entry.ownerShellProbe),
    targetAccentProbe: rect(entry.targetAccentProbe),
    authoredHole: rect(entry.authoredHole),
    openNotch: rect(entry.openNotch),
    thinStructure: rect(entry.thinStructure),
    isolated: point(entry.isolated),
    zeroState: rect(entry.zeroState),
    wrongOwner: rect(entry.wrongOwner),
    targetControl: rect(entry.targetControl),
    wallCoexistence: rect(entry.wallCoexistence),
    guardedBlank: rect(entry.guardedBlank),
  }));
  return { cards, conductiveWall: snapshot?.conductiveWall };
}

function assertAtlasContract(atlas, mode, assert) {
  const expectedOwners = EXPECTED_OWNERS.flatMap((owner) => EXPECTED_TARGETS.map(() => owner));
  const expectedTargets = EXPECTED_OWNERS.flatMap(() => EXPECTED_TARGETS);
  assert(atlas.cards.length === 35
      && atlas.cards.map(({ owner }) => owner).join(',') === expectedOwners.join(',')
      && atlas.cards.map(({ target }) => target).join(',') === expectedTargets.join(',')
      && atlas.cards.every((entry, index) => entry.index === index
        && entry.row === Math.floor(index / 7) && entry.column === index % 7
        && entry.encodedState === entry.target && (entry.encodedState & 0xFF00) === 0)
      && atlas.conductiveWall === 1,
  `${mode}: configured-source target atlas contract changed (${JSON.stringify(atlas.cards.map(
    ({ ownerCode, owner, targetCode, target, encodedState }) => ({
      ownerCode, owner, targetCode, target, encodedState,
    }),
  ))})`);
}

async function sampleSourceTargetBacking({ cdp, evaluate, worldWidth, worldHeight }) {
  return evaluate(cdp, `(() => {
    const world = document.querySelector('.world-canvas');
    if (!(world instanceof HTMLCanvasElement)) throw new Error('World canvas unavailable');
    const copy = document.createElement('canvas'); copy.width = world.width; copy.height = world.height;
    const context = copy.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Configured-source target backing sampler unavailable');
    context.drawImage(world, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    const scaleX = copy.width / ${worldWidth}, scaleY = copy.height / ${worldHeight};
    const snapshot = window.__ANIFOR_INPUT_AUDIT__.sourceTargetGraphicsAtlas();
    const cards = Array.isArray(snapshot) ? snapshot : snapshot.cards;
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
      const bodySamples = rectPoints(entry.body, 2).filter((point) => !emptyKeys.has(key(point)));
      const bodyBuckets = bodySamples.map((point) => Math.min(3, Math.floor(
        (point.y - entry.body.y) * 4 / entry.body.height,
      )) * 4 + Math.min(3, Math.floor((point.x - entry.body.x) * 4 / entry.body.width)));
      const hole = rectPoints(entry.authoredHole), notch = rectPoints(entry.openNotch);
      const thin = rectPoints(entry.thinStructure), zeroState = rectPoints(entry.zeroState);
      const wrongOwner = rectPoints(entry.wrongOwner), targetControl = rectPoints(entry.targetControl);
      const wallCoexistence = rectPoints(entry.wallCoexistence), guard = rectPoints(entry.guardedBlank);
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
        owner: entry.owner, ownerCode: entry.ownerCode,
        target: entry.target, targetCode: entry.targetCode, targetFamily: entry.targetFamily,
        encodedState: entry.encodedState, semanticSignature, alphaSignature, supportSignature,
        bodyExpected: bodyPoints.length,
        bodySupported: bodyPoints.filter((point) => cellAlpha(point) > 0).length,
        thinExpected: thin.length, thinSupported: thin.filter((point) => cellAlpha(point) > 0).length,
        isolatedAlphaPeak: cellAlpha(entry.isolated),
        zeroStateExpected: zeroState.length,
        zeroStateSupported: zeroState.filter((point) => cellAlpha(point) > 0).length,
        wrongOwnerExpected: wrongOwner.length,
        wrongOwnerSupported: wrongOwner.filter((point) => cellAlpha(point) > 0).length,
        targetControlExpected: targetControl.length,
        targetControlSupported: targetControl.filter((point) => cellAlpha(point) > 0).length,
        wallExpected: wallCoexistence.length,
        wallSupported: wallCoexistence.filter((point) => cellAlpha(point) > 0).length,
        guardExpected: guard.length, guardTransparent: guard.filter((point) => cellAlpha(point) === 0).length,
        holeExpected: hole.length, holeCentreTransparent: hole.filter((point) => centreAlpha(point) === 0).length,
        notchExpected: notch.length,
        notchCentreTransparent: notch.filter((point) => centreAlpha(point) < 128).length,
        bodyRgb: sampleRgb(bodySamples), bodyBuckets,
        wallRgb: sampleRgb(wallCoexistence),
        zeroStateRgb: sampleRgb(zeroState), wrongOwnerRgb: sampleRgb(wrongOwner),
        targetControlRgb: sampleRgb(targetControl), guardRgb: sampleRgb(guard),
      };
    }) };
  })()`);
}

function assertBacking(backing, label, assert) {
  assert(Number.isInteger(backing.scaleX) && Number.isInteger(backing.scaleY)
      && backing.scaleX > 0 && backing.scaleY > 0,
  `${label}: configured-source backing does not preserve integral scaling`);
  assert(backing.cards.length === 35 && backing.cards.every((card) => (
    card.encodedState === card.target && (card.encodedState & 0xFF00) === 0
    && card.bodyExpected === 832 && card.bodySupported === card.bodyExpected
    && card.thinExpected === 14 && card.thinSupported === card.thinExpected
    && card.isolatedAlphaPeak > 0
    && card.zeroStateExpected === 100 && card.zeroStateSupported === 100
    && card.wrongOwnerExpected === 120 && card.wrongOwnerSupported === 120
    && card.targetControlExpected === 120 && card.targetControlSupported === 120
    && card.wallExpected === 144 && card.wallSupported === 144
    && card.guardExpected === 936
    // PHOT's independent emission aura legitimately reaches the semantic blank;
    // exact flat/styled signatures below prove source-target styling adds no support.
    && (card.target === 107 || card.guardTransparent === card.guardExpected)
    && card.holeExpected === 16 && card.holeCentreTransparent >= 4
    && card.notchExpected === 48 && card.notchCentreTransparent >= 36
  )), `${label}: configured-source backing changed topology (${JSON.stringify(backing.cards.map(
    (card) => ({ ...card, bodyRgb: undefined, bodyBuckets: undefined,
      wallRgb: undefined, zeroStateRgb: undefined, wrongOwnerRgb: undefined,
      targetControlRgb: undefined, guardRgb: undefined }),
  ))})`);
}

function summarizeResponses(flat, styled, repeated) {
  return flat.cards.map((base, index) => {
    const changed = styled.cards[index];
    const returned = repeated.cards[index];
    const body = summarizeRgbResponse(
      base.bodyRgb, changed.bodyRgb, returned.bodyRgb, base.bodyBuckets,
    );
    const wall = summarizeRgbResponse(base.wallRgb, changed.wallRgb, returned.wallRgb);
    return {
      owner: base.owner, ownerCode: base.ownerCode,
      target: base.target, targetCode: base.targetCode, targetFamily: base.targetFamily,
      encodedState: base.encodedState,
      rgbRms: body.rgbRms, rgbPeak: body.rgbPeak,
      changedSampleRatio: body.changedSampleRatio, repeatRgbPeak: body.repeatRgbPeak,
      meanDeltaRgb: body.meanDeltaRgb, profile: body.profile,
      responseSignature: body.responseSignature, axisMap: body.axisMap,
      wallRgbRms: wall.rgbRms, wallRgbPeak: wall.rgbPeak,
      wallRepeatRgbPeak: wall.repeatRgbPeak,
    };
  });
}

function summarizeRgbResponse(base, changed, returned, bucketsBySample) {
  let squared = 0;
  let peak = 0;
  let repeatPeak = 0;
  let changedSamples = 0;
  let signature = 2166136261;
  const signed = [0, 0, 0];
  const buckets = new Float64Array(16);
  const axisMap = [];
  for (let offset = 0; offset < base.length; offset += 3) {
    let any = false;
    let sampleSquared = 0;
    const sample = offset / 3;
    const bucket = bucketsBySample?.[sample] ?? 0;
    for (let channel = 0; channel < 3; channel++) {
      const delta = changed[offset + channel] - base[offset + channel];
      squared += delta * delta;
      sampleSquared += delta * delta;
      signed[channel] += delta;
      peak = Math.max(peak, Math.abs(delta));
      buckets[bucket] += Math.abs(delta);
      any ||= delta !== 0;
      signature = Math.imul(signature ^ (delta + 255), 16777619) >>> 0;
      repeatPeak = Math.max(repeatPeak, Math.abs(returned[offset + channel] - base[offset + channel]));
    }
    axisMap.push(Math.sqrt(sampleSquared));
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
    axisMap,
  };
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
