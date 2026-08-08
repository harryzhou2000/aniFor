const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONCRETE_MATERIAL = 26;
const WATER_MATERIAL = 2;
const NORMAL_SCALES = Object.freeze([1, 2, 4]);
const EIGHT_X_PRESENTATION_DEADLINE_MS = 30_000;
const EIGHT_X_SCREENSHOT_DEADLINE_MS = 15_000;

const TARGET_REGIONS = Object.freeze([
  { name: 'CNCTCore', kind: 'core', worldX: 354, worldY: 258, worldWidth: 12, worldHeight: 12 },
  { name: 'CNCTSurface', kind: 'surface', worldX: 338, worldY: 211, worldWidth: 12, worldHeight: 10 },
  { name: 'CNCTDetailLeft', kind: 'frequency', worldX: 324, worldY: 252, worldWidth: 26, worldHeight: 24 },
  { name: 'CNCTDetailRight', kind: 'frequency', worldX: 374, worldY: 252, worldWidth: 26, worldHeight: 24 },
]);

// One exact composed pixel per independent owner/topology contract. These
// points also pin expected visibility/transparency, while full protected-region
// digests below prevent a child effect from escaping between sparse probes.
const RAW_CONTROL_POINTS = Object.freeze([
  { name: 'SANDCore', x: 60, y: 80 },
  { name: 'SANDSurface', x: 44, y: 32 },
  { name: 'STNECore', x: 360, y: 80 },
  { name: 'STNESurface', x: 344, y: 32 },
  { name: 'CLAYCore', x: 60, y: 264 },
  { name: 'CLAYSurface', x: 44, y: 216 },
  { name: 'CNCTHole', x: 361, y: 243 },
  { name: 'CNCTThin', x: 420, y: 234 },
  { name: 'CNCTSingle', x: 436, y: 214 },
  { name: 'CNCTUnstableA', x: 452, y: 214 },
  { name: 'CNCTUnstableB', x: 453, y: 215 },
  { name: 'CNCTWetPowder', x: 339, y: 321 },
  { name: 'CNCTWetWater', x: 352, y: 321 },
  { name: 'CNCTWall', x: 442, y: 318 },
  { name: 'CNCTBlank', x: 416, y: 351 },
]);

const RAW_CONTROL_SEMANTICS = Object.freeze({
  SANDCore: { material: 1, wall: 0 },
  SANDSurface: { material: 1, wall: 0 },
  STNECore: { material: 21, wall: 0 },
  STNESurface: { material: 21, wall: 0 },
  CLAYCore: { material: 28, wall: 0 },
  CLAYSurface: { material: 28, wall: 0 },
  CNCTHole: { material: 0, wall: 0 },
  CNCTThin: { material: CONCRETE_MATERIAL, wall: 0 },
  CNCTSingle: { material: CONCRETE_MATERIAL, wall: 0 },
  CNCTUnstableA: { material: CONCRETE_MATERIAL, wall: 0 },
  CNCTUnstableB: { material: CONCRETE_MATERIAL, wall: 0 },
  CNCTWetPowder: { material: CONCRETE_MATERIAL, wall: 0 },
  CNCTWetWater: { material: WATER_MATERIAL, wall: 0 },
  CNCTWall: { material: CONCRETE_MATERIAL, wall: 'fixture' },
  CNCTBlank: { material: 0, wall: 0 },
});

/**
 * Accepted E74 focused browser gate. The 4x response rails freeze the final
 * settled-Concrete calibration; 1x/2x and true 8x remain strict exclusions.
 */
export async function auditConcreteMesostrataRetentionVfx({
  cdp,
  mode,
  dpr,
  auditBaseUrl,
  renderScaleArgument,
  evaluate,
  waitFor,
  waitForStablePageCapture,
  setDesktopMetrics,
  waitForEightXTerminalBackend,
  assertEightXWebGLBackend,
  auditWebGLPresentationTiming,
  remainingDeadlineMs,
  capturePageScreenshotWithin,
  sampleVolumeVfxCanvasAlphaSupport,
  sampleVolumeVfxRawWorldPixels,
  assert,
}) {
  assert(mode === 'webgl', 'E74 requires WebGL');
  assert(dpr === 1, `E74 requires DPR 1 (received ${dpr})`);
  const requestedScales = renderScaleArgument === undefined
    ? NORMAL_SCALES : [Number(renderScaleArgument)];
  assert(requestedScales.every((scale) => NORMAL_SCALES.includes(scale)),
    `E74 normal matrix accepts only 1x/2x/4x (${JSON.stringify(requestedScales)})`);

  const scales = [];
  for (const scale of requestedScales) {
    const variants = {};
    for (const enabled of [false, true, false]) {
      const key = enabled ? 'enabled' : variants.disabled ? 'disabledRepeat' : 'disabled';
      variants[key] = await navigateNormalState({
        cdp, mode, scale, enabled, label: key, auditBaseUrl, evaluate, waitFor,
        waitForStablePageCapture, sampleVolumeVfxCanvasAlphaSupport,
        sampleVolumeVfxRawWorldPixels, assert,
      });
    }
    const { disabled, enabled, disabledRepeat } = variants;
    assert(JSON.stringify(disabled.fixture) === JSON.stringify(enabled.fixture)
      && JSON.stringify(disabled.fixture) === JSON.stringify(disabledRepeat.fixture),
    `E74 ${scale}x fixture metadata changed across navigation`);
    for (const [label, variant] of Object.entries(variants)) {
      const expectedSelectorState = scale === 4 && label === 'enabled'
        ? 'active' : 'inactive';
      assertNormalGeometry(variant.geometry, scale, label, assert);
      assertFixtureState(variant.state, scale, label, assert);
      assert(variant.pipeline.hdrPipeline === 'active'
        && variant.pipeline.powderBodyVfx === 'active'
        && variant.pipeline.concreteMesostrataRetentionVfx === expectedSelectorState,
      `E74 ${scale}x ${label} parent/selector state was wrong (${JSON.stringify(variant.pipeline)})`);
      assertRawControlTopology(variant.rawControls, scale, label, assert);
      assertProtectedRegionTopology(variant.protectedRawRegions, scale, label, assert);
    }

    assertExactState(disabled, enabled, `${scale}x disabled/enabled`, assert);
    assertExactState(disabled, disabledRepeat, `${scale}x disabled/repeated`, assert);
    assert(disabled.capture.capture.data === disabledRepeat.capture.capture.data,
      `E74 ${scale}x repeated-off framebuffer was not byte exact`);
    if (scale !== 4) {
      assert(disabled.capture.capture.data === enabled.capture.capture.data,
        `E74 ${scale}x escaped its strict output-scale exclusion`);
    }
    for (const style of ['local', 'grains']) {
      assert(disabled.references[style].capture.data === enabled.references[style].capture.data
        && disabled.references[style].capture.data
          === disabledRepeat.references[style].capture.data,
      `E74 ${scale}x escaped protected ${style} powder rendering`);
    }

    const responses = TARGET_REGIONS.map((region) => measureResponse(
      region,
      regionByName(disabled.rawRegions, region.name),
      regionByName(enabled.rawRegions, region.name),
      regionByName(disabledRepeat.rawRegions, region.name),
      scale,
    ));
    assert(responses.every((sample) => sample.repeatRgbPeak === 0),
      `E74 ${scale}x raw off-on-off regions were not deterministic (${JSON.stringify(responses)})`);
    const core = responses.find(({ name }) => name === 'CNCTCore');
    const surface = responses.find(({ name }) => name === 'CNCTSurface');
    const frequency = responses.filter(({ kind }) => kind === 'frequency');
    if (scale === 4) {
      assert(core && core.rgbPeak >= 9 && core.rgbPeak <= 12
        && core.rgbRms >= 3.70 && core.rgbRms <= 4.20
        && core.spatialRgbRms >= 3.70 && core.spatialRgbRms <= 4.20
        && core.coverage >= 0.97 && core.coverage <= 1
        && core.responseMicroContrast >= 0.90 && core.responseMicroContrast <= 1.15
        && rgbWithin(core.responseRgb, [[-0.30, -0.05], [-0.22, -0.03], [-0.20, -0.02]]),
      `E74 ${scale}x accepted core response drifted (${JSON.stringify(core)})`);
      assert(surface && surface.rgbPeak >= 9 && surface.rgbPeak <= 12
        && surface.rgbRms >= 3.60 && surface.rgbRms <= 4.10
        && surface.spatialRgbRms >= 3.60 && surface.spatialRgbRms <= 4.10
        && surface.coverage >= 0.95 && surface.coverage <= 1
        && surface.responseMicroContrast >= 0.90
        && surface.responseMicroContrast <= 1.15
        && rgbWithin(surface.responseRgb, [[-0.30, -0.05], [-0.22, -0.03], [-0.18, -0.01]]),
      `E74 ${scale}x accepted near-surface response drifted (${JSON.stringify(surface)})`);
      assert(frequency.length === 2 && frequency.every((sample) =>
        sample.rgbPeak >= 9 && sample.rgbPeak <= 12
        && sample.rgbRms >= 3.60 && sample.rgbRms <= 4.10
        && sample.spatialRgbRms >= 3.60 && sample.spatialRgbRms <= 4.10
        && sample.coverage >= 0.96 && sample.coverage <= 1
        && sample.responseMicroContrast >= 0.95 && sample.responseMicroContrast <= 1.15
        && sample.mesoRgbRms >= 0.85 && sample.mesoRgbRms <= 1.02
        && sample.cellRgbRms >= 3.10 && sample.cellRgbRms <= 3.45
        && sample.microchromaRetention >= 1.18 && sample.microchromaRetention <= 1.27
        && sample.downsampleRetention >= 0.97 && sample.downsampleRetention <= 1.01
        && sample.latticeRatio >= 5.70 && sample.latticeRatio <= 6.50
        && sample.cellMeanRgbRms >= 3.55 && sample.cellMeanRgbRms <= 3.95),
      `E74 ${scale}x accepted frequency evidence drifted (${JSON.stringify(frequency)})`);
      const detailLeft = frequency.find(({ name }) => name === 'CNCTDetailLeft');
      const detailRight = frequency.find(({ name }) => name === 'CNCTDetailRight');
      assert(detailLeft
        && rgbWithin(detailLeft.responseRgb, [[0.03, 0.14], [0.02, 0.13], [0.005, 0.08]])
        && detailRight
        && rgbWithin(detailRight.responseRgb, [[-0.08, 0.005], [-0.08, 0.005], [-0.12, -0.02]]),
      `E74 ${scale}x accepted signed detail response drifted (${JSON.stringify(frequency)})`);
    } else {
      assert(core && responses.every((sample) => sample.rgbPeak === 0
        && sample.rgbRms === 0 && sample.coverage === 0),
      `E74 ${scale}x was not an exact raw-region no-op (${JSON.stringify(responses)})`);
    }

    scales.push({
      scale,
      backing: `${disabled.geometry.width}x${disabled.geometry.height}`,
      core, surface,
      frequency,
      semantic: disabled.state.semantic,
      walls: disabled.state.walls,
      auxiliary: disabled.state.auxiliary,
      velocity: disabled.state.velocity,
      alphaSupport: disabled.backing,
      exactRepeatedOff: true,
      exactControls: true,
      protectedLocal: true,
      protectedGrains: true,
      calibration: 'accepted-e74',
    });
  }

  if (scales.length > 1) assertAcceptedCrossScale(scales, assert);
  const parentDisabled = requestedScales.includes(4)
    ? await auditParentDisabledExclusion({
      cdp, mode, auditBaseUrl, evaluate, waitFor, waitForStablePageCapture,
      sampleVolumeVfxCanvasAlphaSupport, sampleVolumeVfxRawWorldPixels, assert,
    })
    : null;
  const trueEightX = await auditTrueEightXExclusion({
    cdp, dpr, auditBaseUrl, evaluate, waitFor, setDesktopMetrics,
    waitForEightXTerminalBackend, assertEightXWebGLBackend,
    auditWebGLPresentationTiming, remainingDeadlineMs, capturePageScreenshotWithin, assert,
  });
  return {
    calibration: 'accepted-e74-1x-2x-4x',
    scales,
    parentDisabled,
    trueEightXExcluded: true,
    trueEightX,
  };
}

async function navigateNormalState({
  cdp, mode, scale, enabled, label, auditBaseUrl, evaluate, waitFor,
  waitForStablePageCapture, sampleVolumeVfxCanvasAlphaSupport,
  sampleVolumeVfxRawWorldPixels, assert, parentEnabled = true,
}) {
  const query = focusedQuery(
    scale, enabled, `concrete-mesostrata-retention-${label}`, parentEnabled,
  );
  await cdp.send('Page.navigate', { url: `${auditBaseUrl}?${query}` });
  await waitFor(() => evaluate(cdp, `(() => {
    const p = new URLSearchParams(location.search);
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    return p.get('scene') === 'render-lab' && p.get('inputAudit') === '1'
      && p.get('blankAudit') === '1' && p.get('auditStage') === ${JSON.stringify(`concrete-mesostrata-retention-${label}`)}
      && p.get('concreteMesostrataRetentionVfxAudit') === '1'
      && p.get('renderScale') === ${JSON.stringify(String(scale))}
      && p.get('powderBodyVfx') === ${JSON.stringify(parentEnabled ? '1' : '0')}
      && p.get('concreteMesostrataRetentionVfx') === ${JSON.stringify(enabled ? '1' : '0')}
      && typeof audit?.preparePowderMesostrataGraphicsFixture === 'function'
      && typeof audit?.powderMesostrataGraphicsAtlas === 'function'
      && typeof audit?.refreshPresentationFields === 'function';
  })()`), scale === 4 ? 45_000 : 15_000, `E74 ${label} ${scale}x page`);
  await waitFor(() => evaluate(cdp,
    `window.__ANIFOR_INPUT_AUDIT__.backend().backend === ${JSON.stringify(mode)}`),
  scale === 4 ? 30_000 : 15_000, `E74 ${label} ${scale}x backend`);

  const fixture = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    audit.resetView();
    audit.setPowderRenderStyle('smooth');
    audit.setPowderMesostrataStyling(true);
    audit.preparePowderMesostrataGraphicsFixture();
    return audit.powderMesostrataGraphicsAtlas();
  })()`);
  assertFixtureMetadata(fixture, assert);
  await refreshSettledFields(cdp, evaluate, waitFor, scale, label);
  await waitFor(() => evaluate(cdp, targetReadinessExpression()),
    scale === 4 ? 30_000 : 15_000, `E74 ${label} ${scale}x settled Concrete readiness`);

  const timeout = scale === 4 ? 60_000 : scale === 2 ? 30_000 : 15_000;
  const capture = await waitForStablePageCapture(
    cdp, `E74 ${label} ${scale}x Smooth framebuffer`, timeout, 1,
  );
  const geometry = await normalGeometry(cdp, evaluate);
  const pipeline = await pipelineState(cdp, evaluate);
  const state = await fixtureStateDigest(cdp, evaluate, fixture);
  const backing = await sampleVolumeVfxCanvasAlphaSupport(cdp);
  const rawControls = await sampleVolumeVfxRawWorldPixels(cdp, RAW_CONTROL_POINTS);
  const rawRegions = await sampleRawRegions(cdp, evaluate, TARGET_REGIONS);
  const protectedRawRegions = await sampleRawRegionDigests(
    cdp, evaluate, protectedRegionsFromFixture(fixture),
  );
  const references = {};
  for (const style of ['local', 'grains']) {
    await evaluate(cdp,
      `window.__ANIFOR_INPUT_AUDIT__.setPowderRenderStyle(${JSON.stringify(style)}); true`);
    references[style] = await waitForStablePageCapture(
      cdp, `E74 ${label} ${scale}x ${style} control`, timeout, 1,
    );
  }
  await evaluate(cdp, "window.__ANIFOR_INPUT_AUDIT__.setPowderRenderStyle('smooth'); true");
  return {
    fixture, capture, geometry, pipeline, state, backing, rawControls,
    rawRegions, protectedRawRegions, references,
  };
}

async function auditParentDisabledExclusion({
  cdp, mode, auditBaseUrl, evaluate, waitFor, waitForStablePageCapture,
  sampleVolumeVfxCanvasAlphaSupport, sampleVolumeVfxRawWorldPixels, assert,
}) {
  const variants = {};
  for (const enabled of [false, true]) {
    const label = enabled ? 'parent-disabled-requested' : 'parent-disabled-baseline';
    variants[enabled ? 'requested' : 'baseline'] = await navigateNormalState({
      cdp, mode, scale: 4, enabled, label, auditBaseUrl, evaluate, waitFor,
      waitForStablePageCapture, sampleVolumeVfxCanvasAlphaSupport,
      sampleVolumeVfxRawWorldPixels, assert, parentEnabled: false,
    });
  }
  const { baseline, requested } = variants;
  for (const [label, variant] of Object.entries(variants)) {
    assertNormalGeometry(variant.geometry, 4, label, assert);
    assertFixtureState(variant.state, 4, label, assert);
    assert(variant.pipeline.hdrPipeline === 'active'
      && variant.pipeline.powderBodyVfx === 'inactive'
      && variant.pipeline.concreteMesostrataRetentionVfx === 'inactive',
    `E74 4x ${label} revived a disabled parent (${JSON.stringify(variant.pipeline)})`);
    assertRawControlTopology(variant.rawControls, 4, label, assert);
    assertProtectedRegionTopology(variant.protectedRawRegions, 4, label, assert);
  }
  assertExactState(baseline, requested, '4x parent-off child-off/child-on', assert);
  assert(baseline.capture.capture.data === requested.capture.capture.data,
    'E74 4x child request changed the framebuffer while its parent was disabled');
  for (const style of ['local', 'grains']) {
    assert(baseline.references[style].capture.data === requested.references[style].capture.data,
      `E74 4x child request escaped parent-disabled ${style} rendering`);
  }
  return {
    exactFramebuffer: true,
    exactState: true,
    protectedLocal: true,
    protectedGrains: true,
    parent: baseline.pipeline.powderBodyVfx,
    requestedChild: requested.pipeline.concreteMesostrataRetentionVfx,
  };
}

function focusedQuery(scale, enabled, stage, parentEnabled = true) {
  return new URLSearchParams({
    scene: 'render-lab', inputAudit: '1', blankAudit: '1', auditStage: stage,
    concreteMesostrataRetentionVfxAudit: '1', renderScale: String(scale),
    renderLook: 'realistic', volumeVfx: '0', liquidBodyVfx: '0', liquidSurfaceVfx: '0',
    liquidMotionVfx: '0', oilMotionVfx: '0', waterCurvatureVfx: '0',
    fireFlameVfx: '0', cflmColdFlameVfx: '0', gasBodyVfx: '0', gasMotionVfx: '0',
    powderBodyVfx: parentEnabled ? '1' : '0',
    concreteMesostrataRetentionVfx: enabled ? '1' : '0',
    powderLightVfx: '0', powderSolidContactVfx: '0', sootyPowderBodyVfx: '0',
    thermiteBodyVfx: '0', snowpackBodyVfx: '0', quartzMesostructureVfx: '0',
    c4BodyVfx: '0', bglaBodyVfx: '0', bglaClusterVfx: '0',
    translucentEdgeVfx: '0', organicSubsurfaceVfx: '0', wetSedimentVfx: '0',
    gasLightVfx: '0', liquidSolidMeniscusVfx: '0', gasCoreDepthVfx: '0',
    plasmaCoreVfx: '0', solidBodyVfx: '0', platinumBodyVfx: '0',
    ceramicGlazeVfx: '0', botanicalBodyVfx: '0', glassBodyVfx: '0',
    oilBodyVfx: '0', rockRoughnessVfx: '0', waterBodyVfx: '0',
  });
}

async function refreshSettledFields(cdp, evaluate, waitFor, scale, label) {
  for (let pass = 0; pass < 7; pass++) {
    const before = await evaluate(cdp,
      'window.__ANIFOR_INPUT_AUDIT__.presentationRefreshAudit()');
    await evaluate(cdp,
      'window.__ANIFOR_INPUT_AUDIT__.refreshPresentationFields(); true');
    await waitFor(() => evaluate(cdp, `(() => {
      const current = window.__ANIFOR_INPUT_AUDIT__.presentationRefreshAudit();
      return current?.dynamicSequence > ${before.dynamicSequence} ? current : false;
    })()`), scale === 4 ? 30_000 : 10_000,
    `E74 ${label} ${scale}x stability pass ${pass + 1}`);
  }
}

function targetReadinessExpression() {
  return `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const regions = ${JSON.stringify(TARGET_REGIONS)};
    return regions.every((region) => {
      for (let y = region.worldY; y < region.worldY + region.worldHeight; y++) {
        for (let x = region.worldX; x < region.worldX + region.worldWidth; x++) {
          const velocity = audit.velocity(x, y);
          if (audit.cell(x, y) !== ${CONCRETE_MATERIAL}
            || audit.wall(x, y) !== 0 || audit.presentationAuxiliary(x, y) !== 255
            || velocity[0] !== 0 || velocity[1] !== 0) return false;
        }
      }
      return true;
    });
  })()`;
}

async function normalGeometry(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const backend = window.__ANIFOR_INPUT_AUDIT__.backend();
    return { width: canvas?.width, height: canvas?.height,
      outputScale: canvas?.dataset.outputScale, backend };
  })()`);
}

async function pipelineState(cdp, evaluate) {
  return evaluate(cdp, `(() => {
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    return canvas ? {
      renderer: canvas.dataset.renderer,
      hdrPipeline: canvas.dataset.hdrPipeline,
      hdrPipelineReason: canvas.dataset.hdrPipelineReason,
      bloomBacking: canvas.dataset.bloomBacking ?? null,
      powderBodyVfx: canvas.dataset.powderBodyVfx,
      concreteMesostrataRetentionVfx: canvas.dataset.concreteMesostrataRetentionVfx,
    } : undefined;
  })()`);
}

async function fixtureStateDigest(cdp, evaluate, snapshot) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const snapshot = ${JSON.stringify(snapshot)};
    if (typeof audit?.cell !== 'function' || typeof audit?.renderedCell !== 'function'
      || typeof audit?.wall !== 'function' || typeof audit?.presentationAuxiliary !== 'function'
      || typeof audit?.velocity !== 'function' || typeof audit?.renderedVelocity !== 'function') {
      throw new Error('E74 exact fixture state API unavailable');
    }
    const expectedMaterial = new Uint8Array(${WORLD_WIDTH * WORLD_HEIGHT});
    const expectedWall = new Uint8Array(${WORLD_WIDTH * WORLD_HEIGHT});
    const fill = (plane, rect, value) => {
      for (let y = rect.y; y < rect.y + rect.height; y++) {
        plane.fill(value, y * ${WORLD_WIDTH} + rect.x,
          y * ${WORLD_WIDTH} + rect.x + rect.width);
      }
    };
    for (const entry of snapshot.cards) {
      fill(expectedMaterial, entry.settledBody, entry.material);
      fill(expectedMaterial, entry.authoredHole, 0);
      fill(expectedMaterial, entry.thinColumn, entry.material);
      expectedMaterial[entry.singleGrain.y * ${WORLD_WIDTH} + entry.singleGrain.x] = entry.material;
      for (const point of entry.unstablePair) {
        expectedMaterial[point.y * ${WORLD_WIDTH} + point.x] = entry.material;
      }
      fill(expectedMaterial, entry.wetContact.powder, entry.material);
      fill(expectedMaterial, entry.wetContact.water, ${WATER_MATERIAL});
      fill(expectedMaterial, entry.wallCoexistence, entry.material);
      fill(expectedMaterial, entry.guardedBlank, 0);
      // RenderLab's native wall brush owns aligned 4x4 blocks. The fixture
      // visits each block in this 20x20 region, so every world cell is wall 1.
      fill(expectedWall, entry.wallCoexistence, snapshot.conductiveWall);
    }
    let materialHash = 2166136261;
    let renderedMaterialHash = 2166136261;
    let wallHash = 2166136261;
    let auxiliaryHash = 2166136261;
    let velocityHash = 2166136261;
    let renderedVelocityHash = 2166136261;
    let occupied = 0;
    let materialMismatches = 0;
    let renderedMaterialMismatches = 0;
    let wallMismatches = 0;
    let wallCells = 0;
    let nonzeroVelocityCells = 0;
    let nonzeroRenderedVelocityCells = 0;
    let velocityStagingMismatches = 0;
    const byte = (value) => value & 255;
    for (let y = 0; y < ${WORLD_HEIGHT}; y++) for (let x = 0; x < ${WORLD_WIDTH}; x++) {
      const index = y * ${WORLD_WIDTH} + x;
      const expected = expectedMaterial[index];
      const material = audit.cell(x, y);
      const renderedMaterial = audit.renderedCell(x, y);
      const wall = audit.wall(x, y);
      const auxiliary = audit.presentationAuxiliary(x, y);
      const velocity = audit.velocity(x, y);
      const renderedVelocity = audit.renderedVelocity(x, y);
      occupied += Number(material !== 0);
      materialMismatches += Number(material !== expected);
      renderedMaterialMismatches += Number(renderedMaterial !== expected);
      wallMismatches += Number(wall !== expectedWall[index]);
      wallCells += Number(wall !== 0);
      nonzeroVelocityCells += Number(velocity[0] !== 0 || velocity[1] !== 0);
      nonzeroRenderedVelocityCells += Number(
        renderedVelocity[0] !== 0 || renderedVelocity[1] !== 0
      );
      velocityStagingMismatches += Number(
        velocity[0] !== renderedVelocity[0] || velocity[1] !== renderedVelocity[1]
      );
      materialHash = Math.imul(materialHash ^ material ^ index, 16777619) >>> 0;
      renderedMaterialHash = Math.imul(
        renderedMaterialHash ^ renderedMaterial ^ index, 16777619,
      ) >>> 0;
      wallHash = Math.imul(wallHash ^ wall ^ index, 16777619) >>> 0;
      auxiliaryHash = Math.imul(auxiliaryHash ^ auxiliary ^ index, 16777619) >>> 0;
      velocityHash = Math.imul(
        velocityHash ^ byte(velocity[0]) ^ (byte(velocity[1]) << 8) ^ index, 16777619,
      ) >>> 0;
      renderedVelocityHash = Math.imul(
        renderedVelocityHash ^ byte(renderedVelocity[0])
          ^ (byte(renderedVelocity[1]) << 8) ^ index,
        16777619,
      ) >>> 0;
    }
    const targetRanges = ${JSON.stringify(TARGET_REGIONS)}.map((region) => {
      let minimum = 255; let maximum = 0;
      for (let y = region.worldY; y < region.worldY + region.worldHeight; y++) {
        for (let x = region.worldX; x < region.worldX + region.worldWidth; x++) {
          const value = audit.presentationAuxiliary(x, y);
          minimum = Math.min(minimum, value); maximum = Math.max(maximum, value);
        }
      }
      return { name: region.name, minimum, maximum };
    });
    return {
      semantic: { occupied, materialHash, renderedMaterialHash,
        materialMismatches, renderedMaterialMismatches },
      walls: { wallCells, wallHash, wallMismatches },
      auxiliary: { hash: auxiliaryHash, targetRanges },
      velocity: { hash: velocityHash, renderedHash: renderedVelocityHash,
        nonzeroVelocityCells, nonzeroRenderedVelocityCells, velocityStagingMismatches },
    };
  })()`);
}

async function sampleRawRegions(cdp, evaluate, regions, timeoutMs) {
  const expression = `(() => {
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!canvas || !gl) throw new Error('E74 direct WebGL sampler unavailable');
    const scaleX = canvas.width / ${WORLD_WIDTH};
    const scaleY = canvas.height / ${WORLD_HEIGHT};
    return ${JSON.stringify(regions)}.map((region) => {
      const left = Math.round(region.worldX * scaleX);
      const top = Math.round(region.worldY * scaleY);
      const width = Math.round(region.worldWidth * scaleX);
      const height = Math.round(region.worldHeight * scaleY);
      const raw = new Uint8Array(width * height * 4);
      gl.readPixels(left, canvas.height - top - height, width, height,
        gl.RGBA, gl.UNSIGNED_BYTE, raw);
      // readPixels is bottom-up; normalize every scale to world top-down order.
      const pixels = new Array(raw.length);
      for (let y = 0; y < height; y++) {
        const sourceY = height - 1 - y;
        for (let x = 0; x < width; x++) for (let channel = 0; channel < 4; channel++) {
          pixels[(y * width + x) * 4 + channel]
            = raw[(sourceY * width + x) * 4 + channel];
        }
      }
      return { ...region, width, height, pixels };
    });
  })()`;
  return timeoutMs === undefined
    ? evaluate(cdp, expression) : evaluate(cdp, expression, timeoutMs);
}

async function sampleRawRegionDigests(cdp, evaluate, regions, timeoutMs) {
  const expression = `(() => {
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!canvas || !gl) throw new Error('E74 protected-region WebGL sampler unavailable');
    const scaleX = canvas.width / ${WORLD_WIDTH};
    const scaleY = canvas.height / ${WORLD_HEIGHT};
    return ${JSON.stringify(regions)}.map((region) => {
      const left = Math.round(region.worldX * scaleX);
      const top = Math.round(region.worldY * scaleY);
      const width = Math.round(region.worldWidth * scaleX);
      const height = Math.round(region.worldHeight * scaleY);
      const raw = new Uint8Array(width * height * 4);
      gl.readPixels(left, canvas.height - top - height, width, height,
        gl.RGBA, gl.UNSIGNED_BYTE, raw);
      let rgbaSignature = 2166136261;
      let alphaSignature = 2166136261;
      let supportSignature = 2166136261;
      let redSum = 0; let greenSum = 0; let blueSum = 0;
      let alphaSum = 0; let supported = 0;
      for (let offset = 0; offset < raw.length; offset += 4) {
        const red = raw[offset]; const green = raw[offset + 1];
        const blue = raw[offset + 2]; const alpha = raw[offset + 3];
        const support = Number(alpha > 0);
        rgbaSignature = Math.imul(rgbaSignature ^ red, 16777619) >>> 0;
        rgbaSignature = Math.imul(rgbaSignature ^ green, 16777619) >>> 0;
        rgbaSignature = Math.imul(rgbaSignature ^ blue, 16777619) >>> 0;
        rgbaSignature = Math.imul(rgbaSignature ^ alpha, 16777619) >>> 0;
        alphaSignature = Math.imul(alphaSignature ^ alpha, 16777619) >>> 0;
        supportSignature = Math.imul(supportSignature ^ support, 16777619) >>> 0;
        redSum += red; greenSum += green; blueSum += blue;
        alphaSum += alpha; supported += support;
      }
      return { ...region, width, height, rgbaSignature, alphaSignature,
        supportSignature, redSum, greenSum, blueSum, alphaSum, supported };
    });
  })()`;
  return timeoutMs === undefined
    ? evaluate(cdp, expression) : evaluate(cdp, expression, timeoutMs);
}

function assertFixtureMetadata(snapshot, assert) {
  assert(snapshot?.cards?.length === 4
    && snapshot.cards.map(({ code, material }) => `${code}:${material}`).join(',')
      === 'SAND:1,STNE:21,CLAY:28,CNCT:26',
  `E74 powder mesostrata atlas drifted (${JSON.stringify(snapshot)})`);
  const concrete = snapshot.cards.find(({ code }) => code === 'CNCT');
  assert(concrete?.settledBody.x === 316 && concrete.settledBody.y === 204
    && concrete.settledBody.width === 92 && concrete.settledBody.height === 86
    && concrete.coreProbe.x === 354 && concrete.coreProbe.y === 258
    && concrete.authoredHole.x === 358 && concrete.authoredHole.y === 240,
  `E74 exact Concrete card geometry drifted (${JSON.stringify(concrete)})`);
}

function assertNormalGeometry(geometry, scale, label, assert) {
  assert(geometry.backend?.backend === 'webgl'
    && geometry.backend.outputScale === scale
    && geometry.backend.requestedOutputScale === scale
    && geometry.width === WORLD_WIDTH * scale
    && geometry.height === WORLD_HEIGHT * scale
    && geometry.outputScale === String(scale),
  `E74 ${label} ${scale}x backing/backend drifted (${JSON.stringify(geometry)})`);
}

function assertFixtureState(state, scale, label, assert) {
  assert(state.semantic.materialMismatches === 0
    && state.semantic.renderedMaterialMismatches === 0
    && state.walls.wallMismatches === 0
    && state.velocity.nonzeroVelocityCells === 0
    && state.velocity.nonzeroRenderedVelocityCells === 0
    && state.velocity.velocityStagingMismatches === 0
    && state.auxiliary.targetRanges.length === TARGET_REGIONS.length
    && state.auxiliary.targetRanges.every(({ minimum, maximum }) =>
      minimum === 255 && maximum === 255),
  `E74 ${label} ${scale}x fixture state was not exact (${JSON.stringify(state)})`);
}

function assertExactState(left, right, label, assert) {
  assert(JSON.stringify(left.state) === JSON.stringify(right.state),
    `E74 ${label} changed semantic/wall/auxiliary/velocity state`);
  assert(left.backing.width === right.backing.width && left.backing.height === right.backing.height
    && left.backing.alphaSignature === right.backing.alphaSignature
    && left.backing.supportSignature === right.backing.supportSignature
    && left.backing.alphaSum === right.backing.alphaSum
    && left.backing.supported === right.backing.supported,
  `E74 ${label} changed raw alpha/support (${JSON.stringify({ left: left.backing, right: right.backing })})`);
  assert(JSON.stringify(left.rawControls) === JSON.stringify(right.rawControls),
    `E74 ${label} changed an exact owner/topology composed control (${JSON.stringify({
      left: left.rawControls, right: right.rawControls,
    })})`);
  assert(JSON.stringify(left.protectedRawRegions) === JSON.stringify(right.protectedRawRegions),
    `E74 ${label} changed a protected owner/topology region (${JSON.stringify({
      left: left.protectedRawRegions, right: right.protectedRawRegions,
    })})`);
}

function assertRawControlTopology(points, scale, label, assert) {
  const transparent = new Set(['CNCTHole', 'CNCTBlank']);
  const exact = points.length === RAW_CONTROL_POINTS.length && points.every((point) => (
    transparent.has(point.name) ? point.rgba[3] === 0 : point.rgba[3] > 0
  ));
  assert(exact,
    `E74 ${label} ${scale}x lost expected control visibility/topology (${JSON.stringify(points)})`);
}

function protectedRegionsFromFixture(snapshot) {
  const region = (name, rect, expectation, semanticCells = rect.width * rect.height) => ({
    name,
    expectation,
    semanticCells,
    worldX: rect.x,
    worldY: rect.y,
    worldWidth: rect.width,
    worldHeight: rect.height,
  });
  const point = (name, value, expectation) => region(
    name, { x: value.x, y: value.y, width: 1, height: 1 }, expectation, 1,
  );
  const cardOccupiedCells = (entry) => (
    entry.settledBody.width * entry.settledBody.height
      - entry.authoredHole.width * entry.authoredHole.height
      + entry.thinColumn.width * entry.thinColumn.height
      + 1 + entry.unstablePair.length
      + entry.wetContact.powder.width * entry.wetContact.powder.height
      + entry.wetContact.water.width * entry.wetContact.water.height
      + entry.wallCoexistence.width * entry.wallCoexistence.height
  );
  const regions = snapshot.cards.filter(({ code }) => code !== 'CNCT').map((entry) =>
    region(`${entry.code}Card`, entry.card, 'card', cardOccupiedCells(entry)));
  const concrete = snapshot.cards.find(({ code }) => code === 'CNCT');
  if (!concrete) throw new Error('E74 exact Concrete fixture card is missing');
  const unstableBounds = {
    x: Math.min(...concrete.unstablePair.map(({ x }) => x)),
    y: Math.min(...concrete.unstablePair.map(({ y }) => y)),
    width: Math.max(...concrete.unstablePair.map(({ x }) => x))
      - Math.min(...concrete.unstablePair.map(({ x }) => x)) + 1,
    height: Math.max(...concrete.unstablePair.map(({ y }) => y))
      - Math.min(...concrete.unstablePair.map(({ y }) => y)) + 1,
  };
  const wetPowderContact = {
    x: concrete.wetContact.powder.x + concrete.wetContact.powder.width - 2,
    y: concrete.wetContact.powder.y,
    width: 2,
    height: concrete.wetContact.powder.height,
  };
  regions.push(
    region('CNCTHoleRegion', concrete.authoredHole, 'hole', 0),
    region('CNCTThinRegion', concrete.thinColumn, 'fine'),
    point('CNCTSingleRegion', concrete.singleGrain, 'fine'),
    region('CNCTUnstableRegion', unstableBounds, 'fine', concrete.unstablePair.length),
    region('CNCTWetPowderContactRegion', wetPowderContact, 'dense'),
    region('CNCTWetWaterRegion', concrete.wetContact.water, 'dense'),
    region('CNCTWallRegion', concrete.wallCoexistence, 'dense'),
    region('CNCTBlankRegion', concrete.guardedBlank, 'empty', 0),
  );
  return regions;
}

function assertProtectedRegionTopology(regions, scale, label, assert) {
  const exact = regions.length === 11 && regions.every((region) => {
    const pixels = region.width * region.height;
    if (region.expectation === 'empty') return region.supported === 0 && region.alphaSum === 0;
    if (region.expectation === 'hole') return region.supported === 0 && region.alphaSum === 0;
    const expected = region.semanticCells * scale * scale;
    const bounds = region.expectation === 'card'
      ? [0.95, 1.08] : region.expectation === 'fine' ? [0.85, 1.02] : [0.95, 1.02];
    return region.supported >= expected * bounds[0]
      && region.supported <= expected * bounds[1]
      && region.alphaSum >= region.supported * 128;
  });
  assert(exact,
    `E74 ${label} ${scale}x protected-region topology collapsed (${JSON.stringify(regions)})`);
}

function rgbWithin(rgb, bounds) {
  return Array.isArray(rgb) && rgb.length === 3
    && rgb.every((value, channel) => value >= bounds[channel][0] && value <= bounds[channel][1]);
}

function regionByName(regions, name) {
  const region = regions.find((candidate) => candidate.name === name);
  if (!region) throw new Error(`E74 raw region ${name} is missing`);
  return region;
}

function measureResponse(region, disabled, enabled, disabledRepeat, scale) {
  if (disabled.width !== enabled.width || disabled.height !== enabled.height
    || disabled.width !== disabledRepeat.width || disabled.height !== disabledRepeat.height) {
    throw new Error(`E74 ${region.name} raw geometry changed`);
  }
  const pixels = disabled.width * disabled.height;
  const response = new Float64Array(pixels * 3);
  const responseRgb = [0, 0, 0];
  let squared = 0;
  let rgbPeak = 0;
  let repeatRgbPeak = 0;
  let changed = 0;
  for (let index = 0; index < pixels; index++) {
    let pixelChanged = false;
    for (let channel = 0; channel < 3; channel++) {
      const offset = index * 4 + channel;
      const delta = enabled.pixels[offset] - disabled.pixels[offset];
      const repeated = disabledRepeat.pixels[offset] - disabled.pixels[offset];
      response[index * 3 + channel] = delta;
      responseRgb[channel] += delta;
      squared += delta * delta;
      rgbPeak = Math.max(rgbPeak, Math.abs(delta));
      repeatRgbPeak = Math.max(repeatRgbPeak, Math.abs(repeated));
      pixelChanged ||= delta !== 0;
    }
    changed += Number(pixelChanged);
  }
  for (let channel = 0; channel < 3; channel++) responseRgb[channel] /= pixels;
  const rgbRms = Math.sqrt(squared / Math.max(1, pixels * 3));
  const meanRgbRms = Math.hypot(...responseRgb) / Math.sqrt(3);
  const base = {
    name: region.name,
    kind: region.kind,
    width: disabled.width,
    height: disabled.height,
    rgbRms: fixed(rgbRms),
    spatialRgbRms: fixed(Math.sqrt(Math.max(0, rgbRms * rgbRms - meanRgbRms * meanRgbRms))),
    rgbPeak,
    repeatRgbPeak,
    coverage: fixed(changed / Math.max(1, pixels)),
    responseRgb: responseRgb.map(fixed),
    responseMicroContrast: fixed(responseMicroContrast(response, disabled.width, disabled.height)),
  };
  if (region.kind !== 'frequency') return base;
  const near = boxBlurRgb(response, disabled.width, disabled.height, Math.max(1, 2 * scale));
  const far = boxBlurRgb(response, disabled.width, disabled.height, Math.max(2, 8 * scale));
  const meso = new Float64Array(response.length);
  const cell = new Float64Array(response.length);
  for (let offset = 0; offset < response.length; offset++) {
    meso[offset] = near[offset] - far[offset];
    cell[offset] = response[offset] - near[offset];
  }
  const mesoRgbRms = rms(meso);
  const cellRgbRms = rms(cell);
  const downsampled = downsampleRgb2(meso, disabled.width, disabled.height);
  const disabledMicro = microchromaRms(
    disabled.pixels, disabled.width, disabled.height, Math.max(1, scale),
  );
  const enabledMicro = microchromaRms(
    enabled.pixels, enabled.width, enabled.height, Math.max(1, scale),
  );
  return {
    ...base,
    mesoRgbRms: fixed(mesoRgbRms),
    cellRgbRms: fixed(cellRgbRms),
    mesoShare: fixed(mesoRgbRms * mesoRgbRms
      / Math.max(0.0001, mesoRgbRms * mesoRgbRms + cellRgbRms * cellRgbRms)),
    downsampleRetention: fixed(rms(downsampled) / Math.max(0.001, mesoRgbRms)),
    disabledMicrochroma: fixed(disabledMicro),
    enabledMicrochroma: fixed(enabledMicro),
    microchromaRetention: fixed(enabledMicro / Math.max(0.0001, disabledMicro)),
    latticeRatio: scale === 1 ? null
      : fixed(cellLatticeRatio(response, disabled.width, disabled.height, scale)),
    cellMeanRgbRms: fixed(cellMeanResponseRms(response, disabled.width, disabled.height, scale)),
  };
}

function boxBlurRgb(input, width, height, radius) {
  const horizontal = new Float64Array(input.length);
  const output = new Float64Array(input.length);
  for (let y = 0; y < height; y++) for (let channel = 0; channel < 3; channel++) {
    let sum = 0;
    for (let x = 0; x < width; x++) {
      const add = x + radius;
      const remove = x - radius - 1;
      if (x === 0) for (let source = 0; source <= Math.min(width - 1, add); source++) {
        sum += input[(y * width + source) * 3 + channel];
      }
      else {
        if (add < width) sum += input[(y * width + add) * 3 + channel];
        if (remove >= 0) sum -= input[(y * width + remove) * 3 + channel];
      }
      const first = Math.max(0, x - radius);
      const last = Math.min(width - 1, x + radius);
      horizontal[(y * width + x) * 3 + channel] = sum / (last - first + 1);
    }
  }
  for (let x = 0; x < width; x++) for (let channel = 0; channel < 3; channel++) {
    let sum = 0;
    for (let y = 0; y < height; y++) {
      const add = y + radius;
      const remove = y - radius - 1;
      if (y === 0) for (let source = 0; source <= Math.min(height - 1, add); source++) {
        sum += horizontal[(source * width + x) * 3 + channel];
      }
      else {
        if (add < height) sum += horizontal[(add * width + x) * 3 + channel];
        if (remove >= 0) sum -= horizontal[(remove * width + x) * 3 + channel];
      }
      const first = Math.max(0, y - radius);
      const last = Math.min(height - 1, y + radius);
      output[(y * width + x) * 3 + channel] = sum / (last - first + 1);
    }
  }
  return output;
}

function downsampleRgb2(input, width, height) {
  const values = [];
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
    const sums = [0, 0, 0];
    let count = 0;
    for (let oy = 0; oy < 2 && y + oy < height; oy++) {
      for (let ox = 0; ox < 2 && x + ox < width; ox++) {
        const offset = ((y + oy) * width + x + ox) * 3;
        for (let channel = 0; channel < 3; channel++) sums[channel] += input[offset + channel];
        count++;
      }
    }
    values.push(...sums.map((value) => value / count));
  }
  return values;
}

function microchromaRms(pixels, width, height, radius) {
  const chroma = new Float64Array(width * height * 3);
  for (let index = 0; index < width * height; index++) {
    const red = pixels[index * 4];
    const green = pixels[index * 4 + 1];
    const blue = pixels[index * 4 + 2];
    const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    chroma[index * 3] = red - luma;
    chroma[index * 3 + 1] = green - luma;
    chroma[index * 3 + 2] = blue - luma;
  }
  const blurred = boxBlurRgb(chroma, width, height, radius);
  let squared = 0;
  let count = 0;
  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) for (let channel = 0; channel < 3; channel++) {
      const offset = (y * width + x) * 3 + channel;
      const delta = chroma[offset] - blurred[offset];
      squared += delta * delta;
      count++;
    }
  }
  return Math.sqrt(squared / Math.max(1, count));
}

function responseMicroContrast(response, width, height) {
  let sum = 0;
  let count = 0;
  const luma = (offset) => response[offset] * 0.2126
    + response[offset + 1] * 0.7152 + response[offset + 2] * 0.0722;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 3;
    const value = luma(offset);
    if (x + 1 < width) { sum += Math.abs(luma(offset + 3) - value); count++; }
    if (y + 1 < height) { sum += Math.abs(luma(offset + width * 3) - value); count++; }
  }
  return sum / Math.max(1, count);
}

function cellLatticeRatio(response, width, height, scale) {
  let boundarySquared = 0;
  let boundaryCount = 0;
  let interiorSquared = 0;
  let interiorCount = 0;
  const luma = (offset) => response[offset] * 0.2126
    + response[offset + 1] * 0.7152 + response[offset + 2] * 0.0722;
  const add = (delta, boundary) => {
    if (boundary) { boundarySquared += delta * delta; boundaryCount++; }
    else { interiorSquared += delta * delta; interiorCount++; }
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const value = luma((y * width + x) * 3);
    if (x + 1 < width) add(luma((y * width + x + 1) * 3) - value, (x + 1) % scale === 0);
    if (y + 1 < height) add(luma(((y + 1) * width + x) * 3) - value, (y + 1) % scale === 0);
  }
  const boundary = Math.sqrt(boundarySquared / Math.max(1, boundaryCount));
  const interior = Math.sqrt(interiorSquared / Math.max(1, interiorCount));
  return boundary / Math.max(0.001, interior);
}

function cellMeanResponseRms(response, width, height, scale) {
  const values = [];
  for (let y = 0; y < height; y += scale) for (let x = 0; x < width; x += scale) {
    const sums = [0, 0, 0];
    let count = 0;
    for (let oy = 0; oy < scale && y + oy < height; oy++) {
      for (let ox = 0; ox < scale && x + ox < width; ox++) {
        const offset = ((y + oy) * width + x + ox) * 3;
        for (let channel = 0; channel < 3; channel++) sums[channel] += response[offset + channel];
        count++;
      }
    }
    values.push(...sums.map((value) => value / count));
  }
  return rms(values);
}

function rms(values) {
  let squared = 0;
  for (const value of values) squared += value * value;
  return Math.sqrt(squared / Math.max(1, values.length));
}

function assertAcceptedCrossScale(scales, assert) {
  const byScale = Object.fromEntries(scales.map((entry) => [entry.scale, entry]));
  assert([1, 2].every((scale) => {
    const entry = byScale[scale];
    return entry?.core?.rgbPeak === 0
      && entry.frequency.every(({ rgbPeak }) => rgbPeak === 0);
  }) && byScale[4]?.core?.rgbPeak > 0
    && byScale[4].frequency.every(({ rgbPeak }) => rgbPeak > 0),
  `E74 lost its inactive/inactive/active 1x/2x/4x matrix (${JSON.stringify(scales)})`);
}

async function auditTrueEightXExclusion({
  cdp, dpr, auditBaseUrl, evaluate, waitFor, setDesktopMetrics,
  waitForEightXTerminalBackend, assertEightXWebGLBackend,
  auditWebGLPresentationTiming, remainingDeadlineMs, capturePageScreenshotWithin, assert,
}) {
  await setDesktopMetrics(cdp, 1280, 720, dpr);
  const query = focusedQuery(8, true, 'eight-concrete-mesostrata-retention');
  const deadline = Date.now() + EIGHT_X_PRESENTATION_DEADLINE_MS;
  await cdp.send('Page.navigate', { url: `${auditBaseUrl}?${query}` });
  await waitFor(() => evaluate(cdp, `(() => {
    const p = new URLSearchParams(location.search);
    return p.get('renderScale') === '8'
      && p.get('auditStage') === 'eight-concrete-mesostrata-retention'
      && p.get('powderBodyVfx') === '1'
      && p.get('concreteMesostrataRetentionVfx') === '1'
      && typeof window.__ANIFOR_INPUT_AUDIT__?.preparePowderMesostrataGraphicsFixture === 'function';
  })()`, Math.min(1_000, remainingDeadlineMs(deadline, 'true-8x E74 input API poll'))),
  remainingDeadlineMs(deadline, 'true-8x E74 input API'), 'true-8x E74 input API');
  const backend = await waitForEightXTerminalBackend(cdp, 'true-8x E74', deadline);
  assertEightXWebGLBackend(backend, 'true-8x E74');
  const fixture = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    audit.resetView();
    audit.setPowderRenderStyle('smooth');
    audit.setPowderMesostrataStyling(true);
    audit.preparePowderMesostrataGraphicsFixture();
    return audit.powderMesostrataGraphicsAtlas();
  })()`, Math.min(1_000, remainingDeadlineMs(deadline, 'true-8x E74 populate fixture')));
  assertFixtureMetadata(fixture, assert);
  const timingBudget = remainingDeadlineMs(deadline, 'true-8x E74 populated GPU completion');
  const timing = await auditWebGLPresentationTiming(
    cdp, 1, Math.min(12_000, timingBudget), timingBudget, 1,
  );
  assert(timing.source === 'gpu-fence',
    `true-8x E74 populated frame did not complete GPU work (${JSON.stringify(timing)})`);
  const isolation = await evaluate(cdp, `(() => {
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const backend = audit.backend();
    const targetSemantics = ${JSON.stringify(TARGET_REGIONS)}.every((region) => {
      for (let y = region.worldY; y < region.worldY + region.worldHeight; y++) {
        for (let x = region.worldX; x < region.worldX + region.worldWidth; x++) {
          if (audit.cell(x, y) !== ${CONCRETE_MATERIAL}
            || audit.renderedCell(x, y) !== ${CONCRETE_MATERIAL}
            || audit.wall(x, y) !== 0) return false;
        }
      }
      return true;
    });
    const controlSemantics = ${JSON.stringify(RAW_CONTROL_POINTS)}.map((point) => {
      const expected = ${JSON.stringify(RAW_CONTROL_SEMANTICS)}[point.name];
      const expectedWall = expected.wall === 'fixture'
        ? ${JSON.stringify(fixture.conductiveWall)} : expected.wall;
      return { name: point.name, material: audit.cell(point.x, point.y),
        renderedMaterial: audit.renderedCell(point.x, point.y),
        wall: audit.wall(point.x, point.y), expectedMaterial: expected.material,
        expectedWall };
    });
    const populatedFixtureSemantics = targetSemantics && controlSemantics.every((point) =>
      point.material === point.expectedMaterial
        && point.renderedMaterial === point.expectedMaterial && point.wall === point.expectedWall);
    return canvas ? {
      renderer: canvas.dataset.renderer, width: canvas.width, height: canvas.height,
      outputScale: canvas.dataset.outputScale, backend,
      hdrPipeline: canvas.dataset.hdrPipeline,
      reason: canvas.dataset.hdrPipelineReason,
      bloomBacking: canvas.dataset.bloomBacking ?? null,
      powderBodyVfx: canvas.dataset.powderBodyVfx,
      concreteMesostrataRetentionVfx: canvas.dataset.concreteMesostrataRetentionVfx,
      targetSemantics, controlSemantics, populatedFixtureSemantics,
    } : undefined;
  })()`, Math.min(1_000, remainingDeadlineMs(deadline, 'true-8x E74 isolation')));
  assert(isolation?.renderer === 'semantic-field-webgl'
    && isolation.width === WORLD_WIDTH * 8 && isolation.height === WORLD_HEIGHT * 8
    && isolation.outputScale === '8' && isolation.backend.backend === 'webgl'
    && isolation.backend.outputScale === 8 && isolation.backend.requestedOutputScale === 8
    && isolation.hdrPipeline === 'inactive' && isolation.reason === 'scale-8'
    && isolation.bloomBacking === null && isolation.powderBodyVfx === 'inactive'
    && isolation.concreteMesostrataRetentionVfx === 'inactive'
    && isolation.populatedFixtureSemantics === true,
  `true-8x E74 selector/backing isolation failed (${JSON.stringify(isolation)})`);
  // Promotion and the post-fixture GPU fence above own the renderer's single
  // 30-second deadline. PNG encoding is browser/audit I/O after that fence;
  // keep it bounded independently so earlier normal-scale contexts cannot turn
  // a completed 8x frame into a false renderer timeout.
  const screenshotDeadline = Date.now() + EIGHT_X_SCREENSHOT_DEADLINE_MS;
  const capture = await capturePageScreenshotWithin(
    cdp, remainingDeadlineMs(screenshotDeadline, 'true-8x E74 populated screenshot'),
    'true-8x E74 populated composed framebuffer',
  );
  const canvasRect = await evaluate(cdp, `(() => {
    const canvas = document.querySelector('canvas.semantic-field-canvas');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('true-8x E74 canvas unavailable');
    const rect = canvas.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  })()`, Math.min(
    1_000, remainingDeadlineMs(screenshotDeadline, 'true-8x E74 canvas geometry'),
  ));
  const concrete = fixture.cards.find(({ code }) => code === 'CNCT');
  const screenshotRegions = [
    ...TARGET_REGIONS.map((region) => ({
      name: region.name,
      expectation: 'dense',
      x: region.worldX + region.worldWidth / 2,
      y: region.worldY + region.worldHeight / 2,
      radiusX: Math.max(1, region.worldWidth / 2 - 1),
      radiusY: Math.max(1, region.worldHeight / 2 - 1),
    })),
    ...RAW_CONTROL_POINTS.filter(({ name }) => !['CNCTHole', 'CNCTBlank'].includes(name))
      .map((point) => ({
        name: point.name, expectation: 'visible',
        x: point.x + 0.5, y: point.y + 0.5, radiusX: 0.45, radiusY: 0.45,
      })),
    ...[
      { name: 'CNCTHole', rect: concrete.authoredHole },
      { name: 'CNCTBlank', rect: concrete.guardedBlank },
    ].map(({ name, rect }) => ({
      name, expectation: 'empty',
      x: rect.x + rect.width / 2, y: rect.y + rect.height / 2,
      radiusX: Math.max(0.45, rect.width / 2 - 1),
      radiusY: Math.max(0.45, rect.height / 2 - 1),
    })),
  ];
  const raster = await sampleScreenshotRegions(
    cdp, evaluate, capture.data, screenshotRegions, canvasRect,
    Math.min(1_000, remainingDeadlineMs(screenshotDeadline, 'true-8x E74 populated raster')),
  );
  assert(raster.length === screenshotRegions.length && raster.every((region) => {
    if (region.expectation === 'empty') return region.coverage <= 0.10 && region.meanLuma <= 20;
    if (region.expectation === 'visible') return region.visible > 0 && region.meanLuma >= 20;
    return region.coverage >= 0.75 && region.meanLuma >= 20;
  }), `true-8x E74 populated raster topology failed (${JSON.stringify(raster)})`);
  return {
    backing: `${WORLD_WIDTH * 8}x${WORLD_HEIGHT * 8}`,
    promotedWebGLObserved: true,
    selectorExcluded: true,
    fixturePopulated: true,
    populatedRasterTopology: true,
    promotionFence: 'signaled',
    isolation,
    timing,
  };
}

async function sampleScreenshotRegions(
  cdp, evaluate, screenshotBase64, regions, canvasRect, timeoutMs,
) {
  return evaluate(cdp, `(async () => {
    const image = new Image();
    image.src = ${JSON.stringify(`data:image/png;base64,${screenshotBase64}`)};
    await image.decode();
    const copy = document.createElement('canvas');
    copy.width = image.naturalWidth;
    copy.height = image.naturalHeight;
    const context = copy.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('true-8x E74 screenshot sampler unavailable');
    context.drawImage(image, 0, 0);
    const bounds = ${JSON.stringify(canvasRect)};
    const visualWidth = window.visualViewport?.width ?? innerWidth;
    const visualHeight = window.visualViewport?.height ?? innerHeight;
    const visualOffsetX = window.visualViewport?.offsetLeft ?? 0;
    const visualOffsetY = window.visualViewport?.offsetTop ?? 0;
    const pageScaleX = image.naturalWidth / Math.max(1, visualWidth);
    const pageScaleY = image.naturalHeight / Math.max(1, visualHeight);
    const worldScaleX = bounds.width / ${WORLD_WIDTH};
    const worldScaleY = bounds.height / ${WORLD_HEIGHT};
    return ${JSON.stringify(regions)}.map((region) => {
      const left = Math.max(0, Math.floor((bounds.left
        + (region.x - region.radiusX) * worldScaleX - visualOffsetX) * pageScaleX));
      const top = Math.max(0, Math.floor((bounds.top
        + (region.y - region.radiusY) * worldScaleY - visualOffsetY) * pageScaleY));
      const right = Math.min(copy.width, Math.ceil((bounds.left
        + (region.x + region.radiusX) * worldScaleX - visualOffsetX) * pageScaleX));
      const bottom = Math.min(copy.height, Math.ceil((bounds.top
        + (region.y + region.radiusY) * worldScaleY - visualOffsetY) * pageScaleY));
      const width = Math.max(1, right - left);
      const height = Math.max(1, bottom - top);
      const pixels = context.getImageData(left, top, width, height).data;
      let visible = 0;
      let lumaSum = 0;
      for (let offset = 0; offset < pixels.length; offset += 4) {
        if (pixels[offset + 3] < 48
          || Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]) < 24) continue;
        visible++;
        lumaSum += (pixels[offset] * 54 + pixels[offset + 1] * 183
          + pixels[offset + 2] * 19) / 256;
      }
      return { name: region.name, expectation: region.expectation, width, height, visible,
        coverage: Math.round(visible / Math.max(1, width * height) * 1000) / 1000,
        meanLuma: Math.round(lumaSum / Math.max(1, visible) * 100) / 100 };
    });
  })()`, timeoutMs);
}

function fixed(value) {
  return Math.round(value * 10_000) / 10_000;
}
