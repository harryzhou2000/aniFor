/**
 * Canonical WebGL proof for the optional dense-body ambient fill. The gate
 * deliberately composes existing paused render-lab fixtures instead of adding
 * a second presentation scene: the target atlas supplies deep WATR/METL plus
 * Sand, OXYG, PHOT, thin, and native-wall controls, while the liquid atlas
 * supplies an unlike-liquid seam and an isolated liquid drop.
 */
export async function auditDenseBodyAmbientGraphics({
  cdp, mode, evaluate, waitFor, waitForStablePageCapture, captureSettledPage,
  outputScale = 2, assert,
}) {
  if (mode !== 'webgl') return { skippedCanvasFallback: true };
  const settle = outputScale === 8
    ? (label) => captureSettledPage(cdp, label, 450)
    : (label) => waitForStablePageCapture(cdp, label);
  const dpr = await evaluate(cdp, 'window.devicePixelRatio');
  assert(dpr === 1, `Dense-body ambient gate requires WebGL DPR 1 (received ${dpr})`);
  await settle('WebGL initial dense-body ambient framebuffer');
  await requireApi(evaluate, cdp);

  const sourceTarget = await captureToggleTriplet({
    cdp,
    evaluate,
    waitFor,
    settle,
    prepare: 'prepareSourceTargetGraphicsFixture',
    schema: sourceTargetSchema,
  });
  const liquidIdentity = await captureToggleTriplet({
    cdp,
    evaluate,
    waitFor,
    settle,
    prepare: 'prepareLiquidIdentityGraphicsFixture',
    schema: liquidIdentitySchema,
  });

  assertSourceTargetSemantics(sourceTarget.semantic, assert);
  assertLiquidIdentitySemantics(liquidIdentity.semantic, assert);
  const sourceSummary = assertSourceTargetTriplet(sourceTarget, assert);
  const liquidSummary = assertLiquidIdentityTriplet(liquidIdentity, assert);
  return {
    dpr,
    outputScale,
    sourceTarget: sourceSummary,
    liquidIdentity: liquidSummary,
    exactRepeatedOff: true,
    rgbOnly: true,
  };
}

async function requireApi(evaluate, cdp) {
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const required = [
      'setDenseBodyAmbientFill',
      'prepareSourceTargetGraphicsFixture', 'sourceTargetGraphicsAtlas',
      'prepareLiquidIdentityGraphicsFixture', 'liquidIdentityGraphicsAtlas',
    ];
    if (!audit || required.some((name) => typeof audit[name] !== 'function')) {
      throw new Error('Dense-body ambient graphics audit API unavailable');
    }
    audit.resetView();
    return true;
  })()`);
}

async function captureToggleTriplet({ cdp, evaluate, waitFor, settle, prepare, schema }) {
  await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    audit.setDenseBodyAmbientFill(false);
    audit.${prepare}();
    return true;
  })()`);
  const fixture = await waitForFixture(cdp, evaluate, waitFor, schema);
  await settle(`flat dense-body ambient ${fixture.kind} fixture`);
  const flat = await sampleFixture(cdp, evaluate, waitFor, schema);
  await evaluate(cdp, 'window.__ANIFOR_INPUT_AUDIT__.setDenseBodyAmbientFill(true); true;');
  await settle(`filled dense-body ambient ${fixture.kind} fixture`);
  const filled = await sampleFixture(cdp, evaluate, waitFor, schema);
  await evaluate(cdp, 'window.__ANIFOR_INPUT_AUDIT__.setDenseBodyAmbientFill(false); true;');
  await settle(`repeated flat dense-body ambient ${fixture.kind} fixture`);
  const repeated = await sampleFixture(cdp, evaluate, waitFor, schema);
  return { ...fixture, flat, filled, repeated };
}

async function waitForFixture(cdp, evaluate, waitFor, schema) {
  return waitFor(async () => {
    const fixture = await evaluate(cdp, `(${schema.toString()})()`);
    return fixture?.probes?.length ? fixture : false;
  }, 15_000, `dense-body ambient ${schema.name} fixture`);
}

function sourceTargetSchema() {
  const audit = window.__ANIFOR_INPUT_AUDIT__;
  const cards = audit.sourceTargetGraphicsAtlas()?.cards;
  if (!Array.isArray(cards) || cards.length !== 42) return false;
  const card = (code) => cards.find((entry) => entry.targetCode === code);
  const water = card('WATR');
  const metal = card('METL');
  const sand = card('SAND');
  const gas = card('OXYG');
  const energy = card('PHOT');
  if (![water, metal, sand, gas, energy].every(Boolean)) return false;
  const inner = (rect, inset = 3) => ({
    x: rect.x + inset, y: rect.y + inset,
    width: Math.max(1, rect.width - inset * 2), height: Math.max(1, rect.height - inset * 2),
  });
  return {
    kind: 'source-target',
    semantic: {
      water: { material: audit.cell(water.targetControl.x, water.targetControl.y), code: water.targetCode },
      metal: { material: audit.cell(metal.targetControl.x, metal.targetControl.y), code: metal.targetCode },
      sand: { material: audit.cell(sand.targetControl.x, sand.targetControl.y), code: sand.targetCode },
      gas: { material: audit.cell(gas.targetControl.x, gas.targetControl.y), code: gas.targetCode },
      energy: { material: audit.cell(energy.targetControl.x, energy.targetControl.y), code: energy.targetCode },
      thin: { material: audit.cell(water.thinStructure.x, water.thinStructure.y) },
      wall: {
        material: audit.cell(water.wallCoexistence.x, water.wallCoexistence.y),
        wall: audit.wall(water.wallCoexistence.x, water.wallCoexistence.y),
      },
    },
    probes: [
      { name: 'deep-water', rect: inner(water.targetControl) },
      // A genuine air-facing semantic Water cell; ambient fill must not make a shore glow.
      { name: 'water-shore', rect: { x: water.targetControl.x, y: water.targetControl.y, width: 1, height: 1 } },
      { name: 'deep-metal', rect: inner(metal.targetControl) },
      { name: 'granular-sand', rect: inner(sand.targetControl) },
      { name: 'gas', rect: inner(gas.targetControl) },
      { name: 'energy', rect: inner(energy.targetControl) },
      { name: 'thin', rect: { ...water.thinStructure } },
      { name: 'native-wall', rect: { ...water.wallCoexistence } },
    ],
  };
}

function liquidIdentitySchema() {
  const audit = window.__ANIFOR_INPUT_AUDIT__;
  const cards = audit.liquidIdentityGraphicsAtlas()?.cards;
  if (!Array.isArray(cards) || cards.length !== 16) return false;
  const entry = cards[0];
  if (!entry?.liquidContact?.unlike || !entry?.isolated) return false;
  return {
    kind: 'liquid-identity',
    semantic: {
      seam: { material: audit.cell(entry.liquidContact.unlike.x, entry.liquidContact.unlike.y) },
      isolated: { material: audit.cell(entry.isolated.x, entry.isolated.y) },
    },
    probes: [
      // The Water side of an unlike-liquid contact must remain an interface, not a deep core.
      { name: 'unlike-liquid-seam', rect: { ...entry.liquidContact.unlike } },
      { name: 'isolated-liquid', rect: { x: entry.isolated.x, y: entry.isolated.y, width: 1, height: 1 } },
    ],
  };
}

async function sampleFixture(cdp, evaluate, waitFor, schema) {
  const fixture = await waitForFixture(cdp, evaluate, waitFor, schema);
  return evaluate(cdp, `(() => {
    const fixture = (${schema.toString()})();
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!canvas || !gl) throw new Error('Dense-body ambient WebGL backing unavailable');
    const rect = canvas.getBoundingClientRect();
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const readCell = (x, y) => {
      const screen = audit.worldToScreen(x + 0.5, y + 0.5);
      const px = Math.max(0, Math.min(canvas.width - 1,
        Math.floor((screen.x - rect.left) * canvas.width / rect.width)));
      const py = Math.max(0, Math.min(canvas.height - 1,
        canvas.height - 1 - Math.floor((screen.y - rect.top) * canvas.height / rect.height)));
      const pixel = new Uint8Array(4);
      gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return Array.from(pixel);
    };
    return {
      kind: fixture.kind,
      probes: fixture.probes.map(({ name, rect: probe }) => {
        const pixels = [];
        for (let y = probe.y; y < probe.y + probe.height; y++) {
          for (let x = probe.x; x < probe.x + probe.width; x++) pixels.push(readCell(x, y));
        }
        return { name, width: probe.width, height: probe.height, pixels };
      }),
    };
  })()`);
}

function assertSourceTargetSemantics(semantic, assert) {
  assert(semantic.water.code === 'WATR' && semantic.water.material > 0,
    `Dense ambient fixture lost Water (${JSON.stringify(semantic)})`);
  assert(semantic.metal.code === 'METL' && semantic.metal.material > 0,
    `Dense ambient fixture lost Metal (${JSON.stringify(semantic)})`);
  assert(semantic.sand.code === 'SAND' && semantic.sand.material > 0,
    `Dense ambient fixture lost Sand (${JSON.stringify(semantic)})`);
  assert(semantic.gas.code === 'OXYG' && semantic.gas.material > 0,
    `Dense ambient fixture lost gas (${JSON.stringify(semantic)})`);
  assert(semantic.energy.code === 'PHOT' && semantic.energy.material > 0,
    `Dense ambient fixture lost energy (${JSON.stringify(semantic)})`);
  assert(semantic.thin.material > 0 && semantic.wall.material > 0 && semantic.wall.wall > 0,
    `Dense ambient fixture lost thin/wall separation (${JSON.stringify(semantic)})`);
}

function assertLiquidIdentitySemantics(semantic, assert) {
  assert(semantic.seam.material > 0 && semantic.isolated.material > 0,
    `Dense ambient liquid controls lost semantic ownership (${JSON.stringify(semantic)})`);
}

function assertSourceTargetTriplet({ flat, filled, repeated }, assert) {
  const expectedLift = new Set(['deep-water', 'deep-metal']);
  const controls = new Set([
    'water-shore', 'granular-sand', 'gas', 'energy', 'thin', 'native-wall',
  ]);
  return assertTriplet(flat, filled, repeated, expectedLift, controls, assert);
}

function assertLiquidIdentityTriplet({ flat, filled, repeated }, assert) {
  return assertTriplet(
    flat, filled, repeated, new Set(), new Set(['unlike-liquid-seam', 'isolated-liquid']), assert,
  );
}

function assertTriplet(flat, filled, repeated, expectedLift, exactControls, assert) {
  assert(flat.kind === filled.kind && flat.kind === repeated.kind,
    'Dense ambient fixture changed between capture phases');
  assert(flat.probes.length === filled.probes.length && flat.probes.length === repeated.probes.length,
    'Dense ambient capture geometry changed');
  const summary = [];
  for (let index = 0; index < flat.probes.length; index++) {
    const base = flat.probes[index];
    const styled = filled.probes[index];
    const returned = repeated.probes[index];
    assert(base.name === styled.name && base.name === returned.name
      && base.width === styled.width && base.width === returned.width
      && base.height === styled.height && base.height === returned.height,
    `Dense ambient probe geometry drifted at index ${index}`);
    assert(equalPixels(base.pixels, returned.pixels),
      `Dense ambient ${base.name}: off→on→off is not exact`);
    assert(equalAlphaAndSupport(base.pixels, styled.pixels),
      `Dense ambient ${base.name}: alpha or support changed`);
    const response = rgbResponse(base.pixels, styled.pixels);
    if (expectedLift.has(base.name)) {
      assert(response.peak >= 1 && response.peak <= 48 && response.mean > 0,
        `Dense ambient ${base.name}: lift is missing or unbounded (${JSON.stringify(response)})`);
    } else if (exactControls.has(base.name)) {
      assert(response.peak === 0,
        `Dense ambient ${base.name}: protected control changed (${JSON.stringify(response)})`);
    } else {
      assert(response.peak === 0,
        `Dense ambient ${base.name}: unexpected material changed (${JSON.stringify(response)})`);
    }
    summary.push({ name: base.name, ...response });
  }
  return summary;
}

function equalPixels(left, right) {
  return left.length === right.length && left.every((pixel, index) => (
    pixel.length === right[index].length && pixel.every((value, channel) => value === right[index][channel])
  ));
}

function equalAlphaAndSupport(left, right) {
  return left.length === right.length && left.every((pixel, index) => (
    pixel[3] === right[index][3] && (pixel[3] > 0) === (right[index][3] > 0)
  ));
}

function rgbResponse(base, styled) {
  let peak = 0;
  let sum = 0;
  let samples = 0;
  for (let index = 0; index < base.length; index++) {
    for (let channel = 0; channel < 3; channel++) {
      const delta = styled[index][channel] - base[index][channel];
      peak = Math.max(peak, Math.abs(delta));
      sum += Math.abs(delta);
      samples++;
    }
  }
  return { peak, mean: Number((sum / Math.max(1, samples)).toFixed(4)) };
}
