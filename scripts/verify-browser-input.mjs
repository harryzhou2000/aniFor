import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const requestedPort = Number.parseInt(process.env.ANIFORTPT_AUDIT_PORT ?? '5178', 10);
if (!Number.isInteger(requestedPort) || requestedPort < 1024 || requestedPort > 65_535) {
  throw new Error('ANIFORTPT_AUDIT_PORT must be an integer from 1024 through 65535');
}
const PORT = requestedPort;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const WORLD_ASPECT = WORLD_WIDTH / WORLD_HEIGHT;
const scaleEightOnly = process.argv.includes('--scale-eight-only');
const modes = scaleEightOnly ? ['webgl'] : process.argv.includes('--canvas-only') ? ['canvas2d']
  : process.argv.includes('--webgl-only') ? ['webgl'] : ['canvas2d', 'webgl'];
const visualOnly = process.argv.includes('--visual-only');
const layoutOnly = process.argv.includes('--layout-only');
const screenshotRequest = process.argv.find((argument) => argument.startsWith('--screenshot='))?.slice('--screenshot='.length);

async function main() {
  const server = spawn(process.execPath, [
    path.join(ROOT, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1',
    '--port', String(PORT), '--strictPort',
  ], { cwd: ROOT, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let serverLog = '';
  server.stdout.on('data', (chunk) => { serverLog += chunk; });
  server.stderr.on('data', (chunk) => { serverLog += chunk; });

  try {
    await waitFor(async () => {
      const response = await fetch(ORIGIN);
      return response.ok;
    }, 15_000, 'Vite browser-audit server');
    const results = [];
    for (const mode of modes) results.push(await auditMode(mode));
    if (!scaleEightOnly) assertPairedVisualRelief(results);
    console.log(JSON.stringify({ world: `${WORLD_WIDTH}x${WORLD_HEIGHT}`, results }, null, 2));
  } catch (error) {
    if (serverLog.trim()) console.error(serverLog.trim());
    throw error;
  } finally {
    await terminate(server);
  }
}

async function auditMode(mode) {
  const chromePath = await resolveChrome();
  const profile = await mkdtemp(path.join(tmpdir(), `anifor-input-${mode}-`));
  const dpr = mode === 'canvas2d' ? 2 : 1;
  const query = new URLSearchParams({
    scene: 'render-lab', inputAudit: '1', renderScale: '2', auditStage: 'canonical',
    ...(mode === 'canvas2d' ? { renderer: 'canvas2d' } : {}),
  });
  const chrome = spawn(chromePath, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--window-size=1280,720', `--force-device-scale-factor=${dpr}`,
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    ...(mode === 'canvas2d'
      ? ['--disable-gpu']
      : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
    'about:blank',
  ], { detached: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeLog = '';
  try {
    const browserSocket = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Chrome DevTools timeout (${mode})\n${chromeLog}`)), 15_000);
      chrome.stderr.on('data', (chunk) => {
        chromeLog += chunk;
        const match = chromeLog.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (!match) return;
        clearTimeout(timeout);
        resolve(match[1]);
      });
      chrome.once('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`Chrome exited before DevTools (${mode}, ${code})\n${chromeLog}`));
      });
    });
    const port = new URL(browserSocket).port;
    const target = await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      return targets.find((candidate) => candidate.type === 'page' && candidate.webSocketDebuggerUrl);
    }, 8_000, `Chrome page target (${mode})`);
    const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
    const errors = [];
    cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
      errors.push(exceptionDetails?.exception?.description ?? exceptionDetails?.text ?? 'Runtime exception');
    });
    cdp.on('Runtime.consoleAPICalled', ({ type, args }) => {
      if (type === 'error' || type === 'assert') errors.push(args.map((arg) => arg.value ?? arg.description).join(' '));
    });
    cdp.on('Log.entryAdded', ({ entry }) => { if (entry.level === 'error') errors.push(entry.text); });
    await Promise.all([cdp.send('Page.enable'), cdp.send('Runtime.enable'), cdp.send('Log.enable')]);
    if (scaleEightOnly) {
      const renderScaleEight = await auditRenderScaleEight(cdp, dpr);
      assert(errors.length === 0, `${mode}: browser errors: ${errors.join(' | ')}`);
      cdp.close();
      return { backend: mode, renderScaleEight, browserErrors: errors.length };
    }
    await cdp.send('Page.navigate', { url: `${ORIGIN}/?${query}` });
    await waitFor(() => evaluate(cdp, `(() => {
      const parameters = new URLSearchParams(location.search);
      return parameters.get('scene') === 'render-lab'
        && parameters.get('inputAudit') === '1'
        && parameters.get('renderScale') === '2'
        && parameters.get('auditStage') === 'canonical'
        && !parameters.has('blankAudit')
        && Boolean(window.__ANIFOR_INPUT_AUDIT__ && document.documentElement);
    })()`), 15_000, `input audit API (${mode})`);
    await waitFor(() => evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.backend().backend === ${JSON.stringify(mode)}`), 15_000, `${mode} backend`);
    if (layoutOnly) {
      const layout = await metrics(cdp);
      assertGeometry(layout, `${mode} layout-only`);
      assertToolboxGeometry(layout, `${mode} layout-only`, 68);
      cdp.close();
      return { backend: mode, layout, browserErrors: errors.length };
    }
    const canonicalFixture = await evaluate(cdp, `({
      status: document.querySelector('.status')?.textContent,
      occupied: window.__ANIFOR_INPUT_AUDIT__.occupiedCells(),
      upperWall: window.__ANIFOR_INPUT_AUDIT__.cell(200, 138),
      lowerWall: window.__ANIFOR_INPUT_AUDIT__.cell(50, 348),
      patternedGlassWall: window.__ANIFOR_INPUT_AUDIT__.wall(154, 172),
      patternedMetalWall: window.__ANIFOR_INPUT_AUDIT__.wall(129, 172),
      patternedWaterWall: window.__ANIFOR_INPUT_AUDIT__.wall(286, 172),
      patternedOilWall: window.__ANIFOR_INPUT_AUDIT__.wall(314, 172),
      patternedLavaWall: window.__ANIFOR_INPUT_AUDIT__.wall(340, 231),
      patternedIceWall: window.__ANIFOR_INPUT_AUDIT__.wall(525, 229),
      thermal: [
        [30, 370], [70, 370], [110, 370],
        [166, 370], [206, 370], [246, 370],
        [445, 229], [539, 229],
      ].map(([x, y]) => ({
        material: window.__ANIFOR_INPUT_AUDIT__.cell(x, y),
        temperature: window.__ANIFOR_INPUT_AUDIT__.temperature(x, y),
      })),
    })`);
    assert(canonicalFixture.status?.includes('TypeScript deterministic fallback'),
      `${mode}: canonical render lab used ${canonicalFixture.status}`);
    assert(canonicalFixture.occupied > 40_000,
      `${mode}: canonical render lab contains only ${canonicalFixture.occupied} cells`);
    assert(canonicalFixture.upperWall === 3 && canonicalFixture.lowerWall === 3,
      `${mode}: canonical render lab signature changed (${JSON.stringify(canonicalFixture)})`);
    assert(canonicalFixture.patternedGlassWall > 0 && canonicalFixture.patternedMetalWall > 0
      && canonicalFixture.patternedWaterWall > 0 && canonicalFixture.patternedOilWall > 0
      && canonicalFixture.patternedLavaWall > 0
      && canonicalFixture.patternedIceWall > 0,
    `${mode}: patterned translucent wall fixture is missing (${JSON.stringify(canonicalFixture)})`);
    assert(canonicalFixture.thermal.map(({ material }) => material).join(',')
        === '23,23,23,1,1,1,24,12'
      && canonicalFixture.thermal.map(({ temperature }) => temperature).join(',')
        === '1200,2952,18000,1200,2952,18000,18000,1200',
    `${mode}: thermal material fixture signature changed (${JSON.stringify(canonicalFixture.thermal)})`);

    // Read the rendered canvas, not semantic cells, so framebuffer clipping and
    // backend compositing regressions are observable in the browser gate.
    const canonicalCaptures = await waitForStablePageCapture(cdp, `${mode} canonical framebuffer`);
    await evaluate(cdp, 'window.__ANIFOR_INPUT_AUDIT__.setThermalMaterialStyling(false); true');
    const neutralThermalCaptures = await waitForStablePageCapture(
      cdp, `${mode} neutral thermal-material framebuffer`,
    );
    await evaluate(cdp, 'window.__ANIFOR_INPUT_AUDIT__.setThermalMaterialStyling(true); true');
    const styledThermalCaptures = await waitForStablePageCapture(
      cdp, `${mode} styled thermal-material framebuffer`,
    );
    await evaluate(cdp, 'window.__ANIFOR_INPUT_AUDIT__.setThermalMaterialStyling(false); true');
    const repeatedNeutralThermalCaptures = await waitForStablePageCapture(
      cdp, `${mode} repeated neutral thermal-material framebuffer`,
    );
    await evaluate(cdp, 'window.__ANIFOR_INPUT_AUDIT__.setThermalMaterialStyling(true); true');
    // Use the freshly restored styled frame as the canonical lit image for all
    // following comparisons. This keeps adjacent toggle captures close in time.
    const canonicalCapture = styledThermalCaptures.capture;
    await evaluate(cdp, 'window.__ANIFOR_INPUT_AUDIT__.setGasFieldLighting(false); true');
    const unlitGasCaptures = await waitForStablePageCapture(cdp, `${mode} unlit gas framebuffer`);
    // Keep the paired lit/unlit captures adjacent. The presentation benchmark
    // intentionally advances many frames, while emissive field accents have a
    // clocked pulse; inserting it between captures made their difference depend
    // on benchmark duration instead of only the lighting toggle.
    const webGLPresentationTiming = mode === 'webgl' && !visualOnly
      ? await auditWebGLPresentationTiming(cdp)
      : undefined;
    const canvasGasLightingRefresh = mode === 'canvas2d' && !visualOnly
      ? await auditCanvasGasLightingRefresh(cdp)
      : undefined;
    await evaluate(cdp, `(() => {
      window.__ANIFOR_INPUT_AUDIT__.setGasFieldLighting(true);
      window.__ANIFOR_INPUT_AUDIT__.setLiquidFieldLighting(false);
      return true;
    })()`);
    const unlitLiquidCaptures = await waitForStablePageCapture(
      cdp, `${mode} unlit liquid framebuffer`,
    );
    await evaluate(cdp, `(() => {
      window.__ANIFOR_INPUT_AUDIT__.setLiquidFieldLighting(true);
      window.__ANIFOR_INPUT_AUDIT__.setTranslucentFieldTransmission(false);
      return true;
    })()`);
    const unlitTranslucentCaptures = await waitForStablePageCapture(
      cdp, `${mode} unlit translucent framebuffer`,
    );
    await evaluate(cdp, `(() => {
      window.__ANIFOR_INPUT_AUDIT__.setTranslucentFieldTransmission(true);
      window.__ANIFOR_INPUT_AUDIT__.setTranslucentBackdropRefraction(false);
      return true;
    })()`);
    const straightBackdropCaptures = await waitForStablePageCapture(
      cdp, `${mode} straight translucent backdrop framebuffer`,
    );
    await evaluate(cdp, 'window.__ANIFOR_INPUT_AUDIT__.setTranslucentBackdropRefraction(true); true');
    const refractedBackdropCaptures = await waitForStablePageCapture(
      cdp, `${mode} refracted translucent backdrop framebuffer`,
    );
    await evaluate(cdp, 'window.__ANIFOR_INPUT_AUDIT__.setTranslucentBackdropRefraction(false); true');
    const repeatedStraightBackdropCaptures = await waitForStablePageCapture(
      cdp, `${mode} repeated straight translucent backdrop framebuffer`,
    );
    await evaluate(cdp, `(() => {
      window.__ANIFOR_INPUT_AUDIT__.setTranslucentBackdropRefraction(true);
      window.__ANIFOR_INPUT_AUDIT__.setSolidContactDepth(false);
      return true;
    })()`);
    const flatContactCaptures = await waitForStablePageCapture(
      cdp, `${mode} flat solid-contact framebuffer`,
    );
    await evaluate(cdp, 'window.__ANIFOR_INPUT_AUDIT__.setSolidContactDepth(true); true');
    const depthContactCaptures = await waitForStablePageCapture(
      cdp, `${mode} depth solid-contact framebuffer`,
    );
    await evaluate(cdp, 'window.__ANIFOR_INPUT_AUDIT__.setSolidContactDepth(false); true');
    const repeatedFlatContactCaptures = await waitForStablePageCapture(
      cdp, `${mode} repeated flat solid-contact framebuffer`,
    );
    await evaluate(cdp, `(() => {
      window.__ANIFOR_INPUT_AUDIT__.setSolidContactDepth(true);
      window.__ANIFOR_INPUT_AUDIT__.setTranslucentLensShell(false);
      return true;
    })()`);
    const flatLensCaptures = await waitForStablePageCapture(
      cdp, `${mode} flat translucent-lens framebuffer`,
    );
    await evaluate(cdp, 'window.__ANIFOR_INPUT_AUDIT__.setTranslucentLensShell(true); true');
    const shellLensCaptures = await waitForStablePageCapture(
      cdp, `${mode} shell translucent-lens framebuffer`,
    );
    await evaluate(cdp, 'window.__ANIFOR_INPUT_AUDIT__.setTranslucentLensShell(false); true');
    const repeatedFlatLensCaptures = await waitForStablePageCapture(
      cdp, `${mode} repeated flat translucent-lens framebuffer`,
    );
    await evaluate(cdp, `(() => {
      window.__ANIFOR_INPUT_AUDIT__.setTranslucentLensShell(true);
      window.__ANIFOR_INPUT_AUDIT__.setSolidCurvatureDepth(false);
      return true;
    })()`);
    const flatCurvatureCaptures = await waitForStablePageCapture(
      cdp, `${mode} flat solid-curvature framebuffer`,
    );
    await evaluate(cdp, 'window.__ANIFOR_INPUT_AUDIT__.setSolidCurvatureDepth(true); true');
    const curvedSolidCaptures = await waitForStablePageCapture(
      cdp, `${mode} curved solid framebuffer`,
    );
    await evaluate(cdp, 'window.__ANIFOR_INPUT_AUDIT__.setSolidCurvatureDepth(false); true');
    const repeatedFlatCurvatureCaptures = await waitForStablePageCapture(
      cdp, `${mode} repeated flat solid-curvature framebuffer`,
    );
    await evaluate(cdp, 'window.__ANIFOR_INPUT_AUDIT__.setSolidCurvatureDepth(true); true');
    const powderStyleCaptures = {};
    const powderStyleSelection = {};
    for (const style of ['grains', 'local', 'smooth']) {
      await evaluate(cdp, `(() => {
        const button = document.querySelector('[data-powder-render-style="${style}"]');
        if (!(button instanceof HTMLButtonElement)) throw new Error('Missing powder style ${style}');
        button.click();
        return true;
      })()`);
      powderStyleSelection[style] = await waitFor(() => evaluate(cdp, `(() => {
        const buttons = [...document.querySelectorAll('[data-powder-render-style]')];
        const selected = buttons.filter((button) => button.getAttribute('aria-pressed') === 'true');
        return selected.length === 1 && selected[0].getAttribute('data-powder-render-style') === '${style}'
          ? selected[0].textContent.trim() : false;
      })()`), 5_000, `${mode} powder style ${style}`);
      powderStyleCaptures[style] = await waitForStablePageCapture(
        cdp, `${mode} powder style ${style} framebuffer`,
      );
    }
    await evaluate(cdp, `(() => {
      const button = document.querySelector('[data-powder-render-style="grains"]');
      if (!(button instanceof HTMLButtonElement)) throw new Error('Missing powder style grains');
      button.click();
      window.__ANIFOR_INPUT_AUDIT__.resetView();
      return true;
    })()`);
    const zoomedGrainAnchor = worldClient(
      canonicalCaptures.canvasRect, { x: 190.5, y: 176.5 },
    );
    for (let step = 0; step < 4; step++) await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel', x: zoomedGrainAnchor.x, y: zoomedGrainAnchor.y,
      deltaX: 0, deltaY: -240, modifiers: 0,
    });
    const zoomedGrainView = await waitFor(() => evaluate(cdp, `(() => {
      const view = window.__ANIFOR_INPUT_AUDIT__.viewState();
      return view.zoom >= 4.9 ? view : false;
    })()`), 5_000, `${mode} high-zoom grain view`);
    const zoomedGrainCaptures = await waitForStablePageCapture(
      cdp, `${mode} high-zoom grain framebuffer`,
    );
    await evaluate(cdp, `(() => {
      window.__ANIFOR_INPUT_AUDIT__.resetView();
      const button = document.querySelector('[data-powder-render-style="smooth"]');
      if (!(button instanceof HTMLButtonElement)) throw new Error('Missing powder style smooth');
      button.click();
      return true;
    })()`);
    const blankCaptures = await captureStableBlankPage(cdp, mode);
    for (const [label, captures] of [
      ['neutral thermal material', neutralThermalCaptures],
      ['styled thermal material', styledThermalCaptures],
      ['repeated neutral thermal material', repeatedNeutralThermalCaptures],
      ['unlit gas', unlitGasCaptures],
      ['unlit liquid', unlitLiquidCaptures],
      ['unlit translucent', unlitTranslucentCaptures],
      ['straight translucent backdrop', straightBackdropCaptures],
      ['refracted translucent backdrop', refractedBackdropCaptures],
      ['repeated straight translucent backdrop', repeatedStraightBackdropCaptures],
      ['flat solid contact', flatContactCaptures],
      ['depth solid contact', depthContactCaptures],
      ['repeated flat solid contact', repeatedFlatContactCaptures],
      ['flat translucent lens', flatLensCaptures],
      ['shell translucent lens', shellLensCaptures],
      ['repeated flat translucent lens', repeatedFlatLensCaptures],
      ['flat solid curvature', flatCurvatureCaptures],
      ['curved solid', curvedSolidCaptures],
      ['repeated flat solid curvature', repeatedFlatCurvatureCaptures],
      ...Object.entries(powderStyleCaptures).map(([style, captures]) => [`powder ${style}`, captures]),
      ['blank', blankCaptures],
    ]) assertCanvasRectsEqual(
      canonicalCaptures.canvasRect, captures.canvasRect, `${mode} canonical/${label} framebuffer`,
    );
    const sampleCanonicalRegions = (regions) => samplePageRegions(
      cdp, canonicalCapture.data, regions, blankCaptures.capture.data, blankCaptures.reference.data,
      canonicalCaptures.canvasRect,
    );
    const thermalRegions = [
      { name: 'metalCold', x: 30, y: 370, radiusX: 9, radiusY: 5 },
      { name: 'metalAmbient', x: 70, y: 370, radiusX: 9, radiusY: 5 },
      { name: 'metalHot', x: 110, y: 370, radiusX: 9, radiusY: 5 },
      { name: 'sandCold', x: 166, y: 370, radiusX: 9, radiusY: 5 },
      { name: 'sandAmbient', x: 206, y: 370, radiusX: 9, radiusY: 5 },
      { name: 'sandHot', x: 246, y: 370, radiusX: 9, radiusY: 5 },
      { name: 'glassHotBackdrop', x: 445, y: 229, radiusX: 7, radiusY: 5 },
      { name: 'iceColdBackdrop', x: 539, y: 229, radiusX: 3, radiusY: 5 },
    ];
    const thermalResponseSamples = await sampleLightingDifferenceRegions(cdp, {
      lit: styledThermalCaptures.capture.data,
      unlit: neutralThermalCaptures.capture.data,
    }, thermalRegions, canonicalCaptures.canvasRect);
    const thermalResponse = Object.fromEntries(
      thermalResponseSamples.map((sample) => [sample.name, sample]),
    );
    for (const family of ['metal', 'sand']) {
      const cold = thermalResponse[`${family}Cold`];
      const ambient = thermalResponse[`${family}Ambient`];
      const hot = thermalResponse[`${family}Hot`];
      assert(ambient.peakMagnitude <= 1,
        `${mode}: ambient ${family} is not a thermal no-op (${JSON.stringify(ambient)})`);
      assert(cold.coverage >= 0.70 && cold.responseRgb[2] >= 4
        && cold.responseRgb[2] >= cold.responseRgb[0] + 8 && cold.peakMagnitude <= 32,
      `${mode}: cold ${family} lost its bounded blue response (${JSON.stringify(cold)})`);
      assert(hot.coverage >= 0.70 && hot.responseRgb[0] >= 5
        && hot.responseRgb[0] >= hot.responseRgb[2] + 12 && hot.peakMagnitude <= 32,
      `${mode}: hot ${family} lost its bounded warm response (${JSON.stringify(hot)})`);
    }
    assert(thermalResponse.glassHotBackdrop.coverage >= 0.55
      && thermalResponse.glassHotBackdrop.responseRgb[0] >= 2.5
      && thermalResponse.glassHotBackdrop.responseRgb[0]
        >= thermalResponse.glassHotBackdrop.responseRgb[2] + 7
      && thermalResponse.glassHotBackdrop.peakMagnitude <= 32,
    `${mode}: hot wall-backed Glass lost its source-weighted response (${JSON.stringify(thermalResponse.glassHotBackdrop)})`);
    assert(thermalResponse.iceColdBackdrop.coverage >= 0.55
      && thermalResponse.iceColdBackdrop.responseRgb[2] >= 2.5
      && thermalResponse.iceColdBackdrop.responseRgb[2]
        >= thermalResponse.iceColdBackdrop.responseRgb[0] + 7
      && thermalResponse.iceColdBackdrop.peakMagnitude <= 32,
    `${mode}: cold wall-backed Ice lost its source-weighted response (${JSON.stringify(thermalResponse.iceColdBackdrop)})`);
    const thermalRepeatSamples = await sampleBackdropRefractionRegions(cdp, {
      straight: neutralThermalCaptures.capture.data,
      refracted: styledThermalCaptures.capture.data,
      repeatedStraight: repeatedNeutralThermalCaptures.capture.data,
    }, thermalRegions, canonicalCaptures.canvasRect);
    assert(thermalRepeatSamples.every((sample) => sample.repeatRgbPeak <= 1),
      `${mode}: thermal off-on-off sequence was not deterministic (${JSON.stringify(thermalRepeatSamples)})`);
    const thermalSupportRegions = thermalRegions.map((region) => ({ ...region, silhouette: true }));
    const [neutralThermalSupport, styledThermalSupport] = await Promise.all([
      samplePageRegions(
        cdp, neutralThermalCaptures.capture.data, thermalSupportRegions,
        blankCaptures.capture.data, blankCaptures.reference.data, canonicalCaptures.canvasRect,
      ),
      samplePageRegions(
        cdp, styledThermalCaptures.capture.data, thermalSupportRegions,
        blankCaptures.capture.data, blankCaptures.reference.data, canonicalCaptures.canvasRect,
      ),
    ]);
    const thermalSupportInvariantSamples = neutralThermalSupport.map((neutral, index) => ({
      name: neutral.name,
      neutralVisible: neutral.visible,
      styledVisible: styledThermalSupport[index].visible,
      neutralWorldArea: neutral.worldArea,
      styledWorldArea: styledThermalSupport[index].worldArea,
    }));
    assert(thermalSupportInvariantSamples.every((sample) => (
      sample.neutralVisible === sample.styledVisible
      && Math.abs(sample.neutralWorldArea - sample.styledWorldArea) <= 0.01
    )), `${mode}: thermal styling changed material support (${JSON.stringify(thermalSupportInvariantSamples)})`);
    const energySamples = await sampleCanonicalRegions([
      { name: 'fire', x: 405, y: 329 },
      { name: 'plasma', x: 445, y: 329 },
      { name: 'elec', x: 485, y: 329 },
      { name: 'phot', x: 525, y: 329 },
      { name: 'grvt', x: 565, y: 329 },
    ]);
    const energy = Object.fromEntries(energySamples.map((sample) => [sample.name, sample]));
    assert(energySamples.every((sample) => sample.visible >= 32),
      `${mode}: energy render samples disappeared (${JSON.stringify(energySamples)})`);
    assert(energySamples.every((sample) => sample.pinnedFraction <= 0.02),
      `${mode}: dense energy framebuffer clipping returned (${JSON.stringify(energySamples)})`);
    assert(energySamples.every((sample) => sample.microContrast <= 32
      && sample.macroLumaRange >= 9 && sample.lumaRange >= 50),
    `${mode}: energy chunks became cell-noisy or lost broad relief (${JSON.stringify(energySamples)})`);
    assert(energy.fire.rgb[0] > energy.fire.rgb[1] && energy.fire.rgb[1] > energy.fire.rgb[2],
      `${mode}: Fire lost its warm hue (${energy.fire.rgb})`);
    assert(energy.plasma.rgb[2] > energy.plasma.rgb[0] && energy.plasma.rgb[0] > energy.plasma.rgb[1],
      `${mode}: Plasma lost its violet hue (${energy.plasma.rgb})`);
    assert(energy.elec.rgb[2] >= energy.elec.rgb[1] && energy.elec.rgb[1] >= energy.elec.rgb[0],
      `${mode}: ELEC lost its cool hue (${energy.elec.rgb})`);
    assert(Math.max(...energy.phot.rgb) - Math.min(...energy.phot.rgb) <= 8,
      `${mode}: PHOT lost its neutral hue (${energy.phot.rgb})`);
    assert(energy.grvt.rgb[1] > energy.grvt.rgb[2] && energy.grvt.rgb[2] > energy.grvt.rgb[0],
      `${mode}: GRVT lost its green-cyan hue (${energy.grvt.rgb})`);
    const energyTopologySamples = await sampleCanonicalRegions([
      { name: 'fireChunk', x: 405.5, y: 329.5, radiusX: 17.5, radiusY: 10.5, topology: true },
      { name: 'plasmaChunk', x: 445.5, y: 329.5, radiusX: 17.5, radiusY: 10.5, topology: true },
      { name: 'elecChunk', x: 485.5, y: 329.5, radiusX: 17.5, radiusY: 10.5, topology: true },
      { name: 'photChunk', x: 525.5, y: 329.5, radiusX: 17.5, radiusY: 10.5, topology: true },
      { name: 'grvtChunk', x: 565.5, y: 329.5, radiusX: 17.5, radiusY: 10.5, topology: true },
    ]);
    assert(energyTopologySamples.every((sample) => sample.coverage >= 0.72
      && sample.dominantComponent >= 0.92),
    `${mode}: dense energy body lost whole-chunk cohesion (${JSON.stringify(energyTopologySamples)})`);
    const sparseEnergySamples = await sampleCanonicalRegions([
      // Ignore the deliberately soft aura and prove that high-energy semantic
      // carriers retain quiet gaps instead of becoming one bright core slab.
      { name: 'photSparseStrip', x: 488, y: 354, radiusX: 98, radiusY: 3.5, signalFloor: 96, topology: true },
    ]);
    assert(sparseEnergySamples[0].coverage <= 0.92
      && sparseEnergySamples[0].quietRunFraction >= 0.01,
    `${mode}: sparse energy strip was filled into a continuous slab (${JSON.stringify(sparseEnergySamples)})`);
    const solidSamples = await sampleCanonicalRegions([
      { name: 'metal', x: 405, y: 229, radius: 8 },
      { name: 'plant', x: 445, y: 254, radius: 8 },
      { name: 'plut', x: 405, y: 279, radius: 8 },
      { name: 'dtec', x: 485, y: 304, radius: 8 },
    ]);
    assert(solidSamples.every((sample) => sample.visible >= 32),
      `${mode}: solid render samples disappeared (${JSON.stringify(solidSamples)})`);
    assert(solidSamples.every((sample) => sample.lumaRange >= 6 && sample.lumaRange <= 200),
      `${mode}: solid interior relief is flat or clipped (${JSON.stringify(solidSamples)})`);
    assert(solidSamples.every((sample) => sample.microContrast <= 9 && sample.macroLumaRange >= 7),
      `${mode}: solid mesostructure became cell-noisy or macroscopically flat (${JSON.stringify(solidSamples)})`);
    assert(solidSamples.every((sample) => sample.darkFraction <= 0.08),
      `${mode}: accepted solid cavities still read as dark pits (${JSON.stringify(solidSamples)})`);
    assert(solidSamples.every((sample) => sample.pinnedFraction <= 0.15),
      `${mode}: solid interior framebuffer clipping returned (${JSON.stringify(solidSamples)})`);
    const translucentSolidSamples = await sampleCanonicalRegions([
      { name: 'glass', x: 445, y: 229, radius: 8 },
      { name: 'ice', x: 525, y: 229, radius: 8 },
    ]);
    assert(translucentSolidSamples.every((sample) => sample.visible >= 32
      && sample.macroLumaRange >= 7 && sample.pinnedFraction <= 0.05),
    `${mode}: translucent solids lost their body relief or clipped (${JSON.stringify(translucentSolidSamples)})`);
    assert(translucentSolidSamples.every((sample) => sample.rgb[2] >= sample.rgb[0]),
      `${mode}: translucent solids lost their cool transmission tint (${JSON.stringify(translucentSolidSamples)})`);
    const solidSeparatorSamples = await sampleCanonicalRegions([
      // Use the organic row for the generic material-separator proof. The row
      // above deliberately carries an independent native wall card underneath
      // Metal/Glass/Ice, whose own wall contour is valid visible support.
      { name: 'columnGap', x: 465, y: 254, radius: 1 },
      { name: 'rowGap', x: 485, y: 217, radius: 1 },
    ]);
    assert(solidSeparatorSamples.every((sample) => sample.visible <= 1 && sample.coverage <= 0.03),
      `${mode}: solid reconstruction bridged a matrix separator (${JSON.stringify(solidSeparatorSamples)})`);
    const powderSamples = await sampleCanonicalRegions([
      { name: 'denseSand', x: 156, y: 78, radius: 8 },
    ]);
    assert(powderSamples.every((sample) => sample.visible >= 32 && sample.microContrast >= 3),
      `${mode}: rough powder lost its granular detail (${JSON.stringify(powderSamples)})`);
    const powderStyleRegion = [{
      name: 'shallowSandSlope', x: 94.5, y: 145,
      radiusX: 77, radiusY: 7, topology: true, silhouette: true, signature: true,
    }];
    const canonicalPowderStyle = (await sampleCanonicalRegions(powderStyleRegion))[0];
    const powderStyleSamples = {};
    for (const style of ['grains', 'local', 'smooth']) {
      powderStyleSamples[style] = (await samplePageRegions(
        cdp, powderStyleCaptures[style].capture.data, powderStyleRegion,
        blankCaptures.capture.data, blankCaptures.reference.data,
        canonicalCaptures.canvasRect,
      ))[0];
    }
    const powderColumnRegions = [
      // Each narrow probe lands in the remaining material immediately beside
      // an authored notch, where wide-field thinning is easiest to expose.
      { name: 'clayLeftNotch', x: 149.5, y: 62.5, radiusX: 3.5, radiusY: 1.5 },
      { name: 'clayRightNotch', x: 146.5, y: 93.5, radiusX: 3.5, radiusY: 1.5 },
      { name: 'clayLowerColumn', x: 148.5, y: 120.5, radiusX: 3.5, radiusY: 2.5 },
      { name: 'concreteLeftNotch', x: 164.5, y: 73.5, radiusX: 3.5, radiusY: 1.5 },
      { name: 'concreteRightNotch', x: 162.5, y: 110.5, radiusX: 3.5, radiusY: 1.5 },
      { name: 'concreteLowerColumn', x: 163.5, y: 124.5, radiusX: 3.5, radiusY: 2.5 },
    ];
    const powderColumnStyleSamples = {};
    for (const style of ['local', 'smooth']) {
      powderColumnStyleSamples[style] = await samplePageRegions(
        cdp, powderStyleCaptures[style].capture.data, powderColumnRegions,
        blankCaptures.capture.data, blankCaptures.reference.data,
        canonicalCaptures.canvasRect,
      );
    }
    const squareGrainSample = (await samplePageRegions(
      cdp, powderStyleCaptures.grains.capture.data,
      [{ name: 'squareGrain', x: 190.5, y: 176.5, radiusX: 1.5, radiusY: 1.5, topology: true, silhouette: true }],
      blankCaptures.capture.data, blankCaptures.reference.data,
      canonicalCaptures.canvasRect,
    ))[0];
    const zoomedSquareGrainSample = await sampleZoomedSquareGrain(
      cdp, zoomedGrainCaptures.capture.data, blankCaptures.capture.data,
      canonicalCaptures.canvasRect, zoomedGrainAnchor, zoomedGrainView.zoom,
    );
    const powderColumnSemanticCells = powderColumnCells();
    const powderColumnSemanticSupport = await sampleSemanticCellSupport(
      cdp, {
        local: powderStyleCaptures.local.capture.data,
        smooth: powderStyleCaptures.smooth.capture.data,
      }, blankCaptures.capture.data, canonicalCaptures.canvasRect, powderColumnSemanticCells,
    );
    assert(new Set(Object.values(powderStyleSelection)).size === 3,
      `${mode}: powder style buttons did not expose three exclusive states (${JSON.stringify(powderStyleSelection)})`);
    assert(powderStyleSamples.grains.maskSignature !== powderStyleSamples.local.maskSignature
      && powderStyleSamples.local.maskSignature !== powderStyleSamples.smooth.maskSignature,
    `${mode}: powder render styles did not change the composed slope (${JSON.stringify(powderStyleSamples)})`);
    assert(powderStyleSamples.smooth.signature === canonicalPowderStyle.signature
      && powderStyleSamples.smooth.maskSignature === canonicalPowderStyle.maskSignature,
      `${mode}: returning to Smooth did not restore the canonical powder output (${JSON.stringify({ canonicalPowderStyle, powderStyleSamples })})`);
    assert(powderStyleSamples.grains.worldArea < powderStyleSamples.smooth.worldArea * 0.99
      && powderStyleSamples.grains.macroLumaRange + 5 <= powderStyleSamples.smooth.macroLumaRange,
    `${mode}: Grains no longer preserves a visibly discrete reference (${JSON.stringify(powderStyleSamples)})`);
    assert(squareGrainSample.worldArea >= 1.60 && squareGrainSample.worldArea <= 3.10
      && squareGrainSample.dominantComponent >= 0.95
      // A one-cell box spans only a few screenshot pixels, so DPR/CSS rounding
      // permits one pixel of aspect skew. Full rectangular fill rejects the
      // previous disc while the unit raster test pins the exact 1×1 square.
      && squareGrainSample.boundingAspect >= 0.68 && squareGrainSample.boundingAspect <= 1.32
      && squareGrainSample.rectangularFill >= 0.92,
    `${mode}: Grains did not render one isolated powder cell as a solid square (${JSON.stringify(squareGrainSample)})`);
    assert(zoomedSquareGrainSample.expectedPixels >= 5
      && zoomedSquareGrainSample.boundingAspect >= 0.90
      && zoomedSquareGrainSample.boundingAspect <= 1.10
      && zoomedSquareGrainSample.rectangularFill >= 0.88
      && zoomedSquareGrainSample.widthRatio >= 0.70
      && zoomedSquareGrainSample.widthRatio <= 1.60
      && zoomedSquareGrainSample.heightRatio >= 0.70
      && zoomedSquareGrainSample.heightRatio <= 1.60,
    `${mode}: high-zoom Grains cell was not a filled square (${JSON.stringify(zoomedSquareGrainSample)})`);
    assert(powderColumnStyleSamples.local.every((sample) => sample.coverage >= 0.72)
      && powderColumnStyleSamples.smooth.every((sample, index) => sample.coverage >= 0.72
        && sample.coverage >= powderColumnStyleSamples.local[index].coverage * 0.84),
    `${mode}: Smooth lost occupied Clay/Concrete column sections visible in Local (${JSON.stringify(powderColumnStyleSamples)})`);
    assert(powderColumnSemanticSupport.local.occupiedRecall >= 0.985
      && powderColumnSemanticSupport.smooth.occupiedRecall >= 0.985
      && powderColumnSemanticSupport.smooth.occupiedRecall
        >= powderColumnSemanticSupport.local.occupiedRecall - 0.01,
    `${mode}: Smooth dropped semantic powder-column cells retained by Local (${JSON.stringify(powderColumnSemanticSupport)})`);
    assert(powderColumnSemanticSupport.local.deepHoleLeak <= 0.10
      && powderColumnSemanticSupport.smooth.deepHoleLeak <= 0.10
      && powderColumnSemanticSupport.smooth.deepHoleLeak
        <= powderColumnSemanticSupport.local.deepHoleLeak + 0.10,
    `${mode}: Smooth filled authored deep holes in a powder column (${JSON.stringify(powderColumnSemanticSupport)})`);
    const silhouetteSamples = await sampleCanonicalRegions([
      {
        name: 'roundedMetal', x: 405.5, y: 229.5,
        radiusX: 21, radiusY: 14, topology: true, silhouette: true,
      },
      {
        name: 'splitLiquidCapsule', x: 302.5, y: 172,
        radiusX: 40, radiusY: 16, topology: true, silhouette: true,
      },
    ]);
    assert(silhouetteSamples.every((sample) => sample.dominantComponent >= 0.94),
      `${mode}: reconstructed silhouettes fragmented (${JSON.stringify(silhouetteSamples)})`);
    assert(silhouetteSamples.every((sample) => sample.compactness >= 0.18),
      `${mode}: reconstructed silhouettes became excessively rough (${JSON.stringify(silhouetteSamples)})`);
    const liquidContourCrossings = await sampleCapsuleContourCrossings(
      cdp, canonicalCapture.data, blankCaptures.capture.data, canonicalCaptures.canvasRect,
    );
    assert(liquidContourCrossings.rmsError <= 0.65
      && liquidContourCrossings.maximumError <= 0.85
      && liquidContourCrossings.rmsError <= liquidContourCrossings.rawRmsError * 0.70,
    `${mode}: liquid endcap no longer follows its analytic curve (${JSON.stringify(liquidContourCrossings)})`);
    assert(liquidContourCrossings.meanTransitionWidth >= 0.12
      && liquidContourCrossings.meanTransitionWidth <= 1.75
      && liquidContourCrossings.maximumSymmetryError <= 1.0
      && liquidContourCrossings.monotonicSlack <= 0.20
      && liquidContourCrossings.meanTangentError
        <= liquidContourCrossings.rawMeanTangentError * 0.70,
    `${mode}: liquid endcap became hard, blurred, asymmetric, or stair-stepped (${JSON.stringify(liquidContourCrossings)})`);
    const contactSilhouetteSamples = await sampleCanonicalRegions([
      {
        name: 'powderContactCapsule', x: 54.5, y: 172,
        radiusX: 40, radiusY: 16, topology: true, silhouette: true,
      },
      {
        name: 'solidContactCapsule', x: 140.5, y: 172,
        radiusX: 40, radiusY: 16, topology: true, silhouette: true,
      },
    ]);
    assert(contactSilhouetteSamples.every((sample) => sample.dominantComponent >= 0.94
      && sample.compactness >= 0.18
      && sample.worldArea / 1666 >= 0.70 && sample.worldArea / 1666 <= 1.40
      && sample.outerRingFraction <= 0.03),
    `${mode}: unlike-material contact body fragmented or became rough (${JSON.stringify(contactSilhouetteSamples)})`);
    const contactMaterialSamples = await sampleCanonicalRegions([
      { name: 'contactSand', x: 42, y: 172, radius: 5 },
      { name: 'contactSalt', x: 67, y: 172, radius: 5 },
      { name: 'contactMetal', x: 128, y: 172, radius: 5 },
      { name: 'contactGlass', x: 153, y: 172, radius: 5 },
    ]);
    assert(contactMaterialSamples.every((sample) => sample.visible >= 12),
      `${mode}: an unlike-material contact side disappeared (${JSON.stringify(contactMaterialSamples)})`);
    assert(contactMaterialSamples[0].rgb[0] > contactMaterialSamples[0].rgb[2]
      && contactMaterialSamples[1].rgb[2] > contactMaterialSamples[0].rgb[2]
      && contactMaterialSamples[3].rgb[2] > contactMaterialSamples[2].rgb[2],
    `${mode}: unlike-material contact lost exclusive material ordering (${JSON.stringify(contactMaterialSamples)})`);
    const isolatedMaterialSamples = await sampleCanonicalRegions([
      { name: 'isolatedWater', x: 190.5, y: 164.5, radius: 3, topology: true, silhouette: true },
      { name: 'isolatedSand', x: 190.5, y: 176.5, radius: 3, topology: true, silhouette: true },
    ]);
    assert(isolatedMaterialSamples.every((sample) => sample.visible > 0
      && sample.dominantComponent >= 0.90
      && sample.worldArea >= 0.20 && sample.worldArea <= (mode === 'canvas2d' ? 6.0 : 4.0)
      && sample.outerRingFraction <= 0.05),
    `${mode}: isolated droplet or powder grain widened, vanished, or fragmented (${JSON.stringify(isolatedMaterialSamples)})`);
    const liquidSeamSamples = await sampleCanonicalRegions([
      { name: 'capsuleWater', x: 289, y: 172, radius: 6 },
      { name: 'capsuleSeam', x: 302.5, y: 172, radiusX: 1.5, radiusY: 7 },
      { name: 'capsuleOil', x: 316, y: 172, radius: 6 },
    ]);
    assert(liquidSeamSamples.every((sample) => sample.visible >= 12),
      `${mode}: split-liquid capsule disappeared (${JSON.stringify(liquidSeamSamples)})`);
    assert(liquidSeamSamples[0].rgb[1] > liquidSeamSamples[0].rgb[0]
      && liquidSeamSamples[2].rgb[0] > liquidSeamSamples[2].rgb[2],
    `${mode}: split-liquid capsule lost species ordering (${JSON.stringify(liquidSeamSamples)})`);
    const oilInterfaceX = mode === 'canvas2d' ? 303.5 : 304.5;
    const liquidInterfaceSamples = await sampleCanonicalRegions([
      { name: 'waterInterior', x: 298.5, y: 172, radiusX: 0.30, radiusY: 5 },
      { name: 'waterInterface', x: 302.5, y: 172, radiusX: 0.30, radiusY: 5 },
      { name: 'oilInterface', x: oilInterfaceX, y: 172, radiusX: 0.30, radiusY: 5 },
      { name: 'oilInterior', x: 308.5, y: 172, radiusX: 0.30, radiusY: 5 },
    ]);
    const liquidInterface = Object.fromEntries(
      liquidInterfaceSamples.map((sample) => [sample.name, sample]),
    );
    assert(liquidInterfaceSamples.every((sample) => sample.visible >= 8
      && sample.coverage >= 0.90 && sample.darkFraction <= 0.35),
    `${mode}: unlike-liquid optical interface opened a dark gap (${JSON.stringify(liquidInterfaceSamples)})`);
    const waterInterfaceResponse = liquidInterface.waterInterface.meanLuma
      - liquidInterface.waterInterior.meanLuma;
    const oilInterfaceResponse = liquidInterface.oilInterface.meanLuma
      - liquidInterface.oilInterior.meanLuma;
    assert(waterInterfaceResponse >= 1 && waterInterfaceResponse <= 20
      && Math.abs(oilInterfaceResponse) >= 1 && Math.abs(oilInterfaceResponse) <= 20,
    `${mode}: unlike-liquid interface lost its bounded meniscus light (${JSON.stringify(liquidInterfaceSamples)})`);
    const volumeSamples = await sampleCanonicalRegions([
      { name: 'water', x: 238, y: 79, radius: 14 },
      { name: 'oil', x: 289, y: 87, radius: 12 },
      { name: 'smoke', x: 420, y: 76, radius: 16 },
      { name: 'oxygen', x: 486, y: 72, radius: 16 },
      { name: 'nobleGas', x: 544, y: 88, radius: 14 },
    ]);
    assert(volumeSamples.every((sample) => sample.coverage >= 0.90),
      `${mode}: a dense fluid core became visibly perforated (${JSON.stringify(volumeSamples)})`);
    assert(volumeSamples.every((sample) => sample.lumaRange <= 200
      && sample.lumaRange >= (['smoke', 'oxygen', 'nobleGas'].includes(sample.name) ? 5 : 8)
      && (!['smoke', 'oxygen', 'nobleGas'].includes(sample.name) || sample.macroLumaRange >= 4)),
      `${mode}: fluid depth is flat or clipped (${JSON.stringify(volumeSamples)})`);
    assert(volumeSamples.every((sample) => sample.pinnedFraction <= 0.05),
      `${mode}: fluid framebuffer clipping returned (${JSON.stringify(volumeSamples)})`);
    const volumes = Object.fromEntries(volumeSamples.map((sample) => [sample.name, sample]));
    assert(Math.abs(volumes.smoke.rgb[0] - volumes.smoke.rgb[1]) <= 5
      && volumes.smoke.rgb[0] > volumes.smoke.rgb[2]
      && volumes.smoke.rgb[1] > volumes.smoke.rgb[2],
    `${mode}: Smoke lost its neutral warm-grey hue (${volumes.smoke.rgb})`);
    assert(volumes.oxygen.rgb[2] > volumes.oxygen.rgb[1]
      && volumes.oxygen.rgb[1] > volumes.oxygen.rgb[0],
    `${mode}: Oxygen lost its cool-blue hue (${volumes.oxygen.rgb})`);
    assert(volumes.nobleGas.rgb[2] > volumes.nobleGas.rgb[0]
      && volumes.nobleGas.rgb[0] > volumes.nobleGas.rgb[1],
    `${mode}: Noble Gas lost its violet hue (${volumes.nobleGas.rgb})`);
    const compactGasSamples = await sampleCanonicalRegions([
      { name: 'compactFog', x: 430, y: 171, radiusX: 30, radiusY: 10, topology: true },
      { name: 'compactCflm', x: 520, y: 171, radiusX: 30, radiusY: 10, topology: true },
    ]);
    const compactGas = Object.fromEntries(compactGasSamples.map((sample) => [sample.name, sample]));
    assert(compactGasSamples.every((sample) => sample.coverage >= 0.45
      && sample.dominantComponent >= 0.90 && sample.microContrast <= 18)
      && compactGas.compactFog.pinnedFraction <= 0.02
      && compactGas.compactCflm.pinnedFraction <= 0.30,
    `${mode}: compact gas returned to disconnected beads or clipping (${JSON.stringify(compactGasSamples)})`);
    assert(Math.max(...compactGas.compactFog.rgb) - Math.min(...compactGas.compactFog.rgb) <= 18,
      `${mode}: compact FOG lost its neutral hue (${compactGas.compactFog.rgb})`);
    assert(compactGas.compactCflm.rgb[2] >= compactGas.compactCflm.rgb[0] + 12
      && compactGas.compactCflm.rgb[2] >= compactGas.compactCflm.rgb[1] + 12,
    `${mode}: compact CFLM lost its blue-violet hue (${compactGas.compactCflm.rgb})`);
    const sparseGasSamples = await sampleCanonicalRegions([
      { name: 'smokeCentre', x: 386, y: 145, radius: 1.5 },
      { name: 'smokeMidpoint', x: 384, y: 145, radius: 1.5 },
      { name: 'smokeGap', x: 410, y: 145, radius: 1.5 },
      { name: 'fogCentre', x: 453, y: 145, radius: 1.5 },
      { name: 'fogMidpoint', x: 451, y: 145, radius: 1.5 },
      { name: 'fogGap', x: 477, y: 145, radius: 1.5 },
      { name: 'cflmCentre', x: 520, y: 145, radius: 1.5 },
      { name: 'cflmMidpoint', x: 518, y: 145, radius: 1.5 },
      { name: 'cflmGap', x: 544, y: 145, radius: 1.5 },
    ]);
    const sparseGas = Object.fromEntries(sparseGasSamples.map((sample) => [sample.name, sample]));
    for (const family of ['smoke', 'fog', 'cflm']) {
      const centre = sparseGas[`${family}Centre`];
      const midpoint = sparseGas[`${family}Midpoint`];
      assert(midpoint.coverage >= 0.12 && midpoint.visible >= 2,
        `${mode}: sparse ${family} did not bridge pitch-four particles (${JSON.stringify(sparseGasSamples)})`);
      assert(centre.meanLuma / Math.max(1, midpoint.meanLuma) <= (family === 'cflm' ? 2.8 : 2.3),
        `${mode}: sparse ${family} still reads as semantic beads (${JSON.stringify(sparseGasSamples)})`);
    }
    assert(sparseGas.smokeGap.coverage <= 0.35 && sparseGas.fogGap.coverage <= 0.35
      && sparseGas.cflmGap.coverage <= 0.75,
    `${mode}: sparse gas filled its authored quiet gap (${JSON.stringify(sparseGasSamples)})`);
    const gasLightingSamples = await sampleCanonicalRegions([
      { name: 'warmRim', x: 368, y: 76, radius: 2 },
      { name: 'warmMid', x: 373, y: 76, radius: 2 },
      { name: 'warmCore', x: 382, y: 76, radius: 2 },
      { name: 'coolRim', x: 587, y: 88, radius: 2 },
      { name: 'coolMid', x: 582, y: 88, radius: 2 },
      { name: 'coolCore', x: 574, y: 88, radius: 2 },
    ]);
    assert(gasLightingSamples.every((sample) => sample.pinnedFraction === 0),
      `${mode}: field-lit gas clipped a colour channel (${JSON.stringify(gasLightingSamples)})`);
    const gasLightResponseSamples = await sampleLightingDifferenceRegions(cdp, {
      lit: canonicalCapture.data,
      unlit: unlitGasCaptures.capture.data,
    }, [
      { name: 'warmRim', x: 368, y: 76, radius: 3 },
      { name: 'coolRim', x: 587, y: 88, radius: 3 },
    ], canonicalCaptures.canvasRect);
    const gasLightResponse = Object.fromEntries(
      gasLightResponseSamples.map((sample) => [sample.name, sample]),
    );
    assert(gasLightResponse.warmRim.coverage >= 0.12
      && gasLightResponse.warmRim.positiveRgb[0] >= 1.5
      && gasLightResponse.warmRim.positiveRgb[0] >= gasLightResponse.warmRim.positiveRgb[1] + 0.6
      && gasLightResponse.warmRim.positiveRgb[0] >= gasLightResponse.warmRim.positiveRgb[2] + 1.2,
    `${mode}: isolated warm gas-light response disappeared (${JSON.stringify(gasLightResponseSamples)})`);
    assert(gasLightResponse.coolRim.coverage >= 0.12
      && gasLightResponse.coolRim.positiveRgb[1] >= 1.5
      && gasLightResponse.coolRim.positiveRgb[1] >= gasLightResponse.coolRim.positiveRgb[0] + 0.8,
    `${mode}: isolated cool gas-light response disappeared (${JSON.stringify(gasLightResponseSamples)})`);
    const liquidLightResponseSamples = await sampleLightingDifferenceRegions(cdp, {
      lit: canonicalCapture.data,
      unlit: unlitLiquidCaptures.capture.data,
    }, [
      { name: 'coolWaterRim', x: 188, y: 68, radius: 3 },
      { name: 'warmAcidRim', x: 353, y: 62, radius: 4 },
    ], canonicalCaptures.canvasRect);
    const liquidLightResponse = Object.fromEntries(
      liquidLightResponseSamples.map((sample) => [sample.name, sample]),
    );
    assert(liquidLightResponse.coolWaterRim.coverage >= 0.08
      && liquidLightResponse.coolWaterRim.positiveRgb[1] >= 0.8
      && liquidLightResponse.coolWaterRim.positiveRgb[1]
        >= liquidLightResponse.coolWaterRim.positiveRgb[0] + 0.50,
    `${mode}: cool emitted-light reflection disappeared from Water (${JSON.stringify(liquidLightResponseSamples)})`);
    assert(liquidLightResponse.warmAcidRim.coverage >= 0.025
      && liquidLightResponse.warmAcidRim.positiveRgb[0] >= 0.12
      && liquidLightResponse.warmAcidRim.positiveRgb[0]
        >= liquidLightResponse.warmAcidRim.positiveRgb[2] + 0.08
      && liquidLightResponse.warmAcidRim.positiveRgb[1]
        >= liquidLightResponse.warmAcidRim.positiveRgb[2] + 0.12,
    `${mode}: warm emitted-light reflection disappeared from Acid (${JSON.stringify(liquidLightResponseSamples)})`);
    const translucentLightResponseSamples = await sampleLightingDifferenceRegions(cdp, {
      lit: canonicalCapture.data,
      unlit: unlitTranslucentCaptures.capture.data,
    }, [
      // Crops remain wholly inside their dense plates. Metal is sampled at the
      // same source-relative depth as Glass, so a near-light opaque leak fails.
      { name: 'warmGlassBody', x: 432.5, y: 229.5, radius: 1.5 },
      { name: 'coolIceBody', x: 539.5, y: 229.5, radius: 1.5 },
      { name: 'opaqueMetalControl', x: 420.5, y: 229.5, radius: 1.5 },
    ], canonicalCaptures.canvasRect);
    const translucentLightResponse = Object.fromEntries(
      translucentLightResponseSamples.map((sample) => [sample.name, sample]),
    );
    assert(translucentLightResponse.warmGlassBody.coverage >= 0.20
      && translucentLightResponse.warmGlassBody.positiveRgb[0] >= 0.20
      && translucentLightResponse.warmGlassBody.screenNormalizedPositiveRgb[0]
        >= translucentLightResponse.warmGlassBody.screenNormalizedPositiveRgb[2] + 0.50
      && translucentLightResponse.warmGlassBody.peakMagnitude <= 32,
    `${mode}: warm scene light did not transmit through dense Glass (${JSON.stringify(translucentLightResponseSamples)})`);
    assert(translucentLightResponse.coolIceBody.coverage >= 0.20
      && translucentLightResponse.coolIceBody.positiveRgb[2] >= 0.20
      && translucentLightResponse.coolIceBody.screenNormalizedPositiveRgb[2]
        >= translucentLightResponse.coolIceBody.screenNormalizedPositiveRgb[0] * 0.80
      && translucentLightResponse.coolIceBody.screenNormalizedPositiveRgb[1]
        >= translucentLightResponse.coolIceBody.screenNormalizedPositiveRgb[0] * 0.80
      && translucentLightResponse.coolIceBody.peakMagnitude <= 32,
    `${mode}: cool scene light did not transmit through dense Ice (${JSON.stringify(translucentLightResponseSamples)})`);
    assert(translucentLightResponse.opaqueMetalControl.coverage <= 0.01
      && translucentLightResponse.opaqueMetalControl.peakMagnitude <= 1,
    `${mode}: translucent transmission leaked into opaque Metal (${JSON.stringify(translucentLightResponseSamples)})`);
    const translucentSupportRegions = [
      { name: 'glassSupport', x: 432.5, y: 229.5, radius: 1.5, silhouette: true },
      { name: 'iceSupport', x: 539.5, y: 229.5, radius: 1.5, silhouette: true },
    ];
    const [litTranslucentSupport, unlitTranslucentSupport] = await Promise.all([
      samplePageRegions(
        cdp, canonicalCapture.data, translucentSupportRegions,
        blankCaptures.capture.data, blankCaptures.reference.data, canonicalCaptures.canvasRect,
      ),
      samplePageRegions(
        cdp, unlitTranslucentCaptures.capture.data, translucentSupportRegions,
        blankCaptures.capture.data, blankCaptures.reference.data, canonicalCaptures.canvasRect,
      ),
    ]);
    const translucentSupportInvariantSamples = litTranslucentSupport.map((lit, index) => ({
      name: lit.name,
      litVisible: lit.visible,
      unlitVisible: unlitTranslucentSupport[index].visible,
      litWorldArea: lit.worldArea,
      unlitWorldArea: unlitTranslucentSupport[index].worldArea,
    }));
    assert(translucentSupportInvariantSamples.every((sample) => (
      sample.litVisible === sample.unlitVisible
      && Math.abs(sample.litWorldArea - sample.unlitWorldArea) <= 0.01
    )), `${mode}: scene-light coupling changed translucent support (${JSON.stringify(translucentSupportInvariantSamples)})`);
    const backdropRefractionSamples = await sampleBackdropRefractionRegions(cdp, {
      straight: straightBackdropCaptures.capture.data,
      refracted: refractedBackdropCaptures.capture.data,
      repeatedStraight: repeatedStraightBackdropCaptures.capture.data,
    }, [
      { name: 'patternedGlassShoulders', x: 445, y: 229, radiusX: 17, radiusY: 7 },
      { name: 'patternedIceCore', x: 525, y: 229, radius: 6 },
      { name: 'patternedWaterShoulders', x: 288, y: 172, radiusX: 10, radiusY: 11 },
      { name: 'patternedOilShoulders', x: 315, y: 172, radiusX: 11, radiusY: 11 },
      { name: 'moltenLavaPinholeControl', x: 340, y: 231, radius: 8 },
      { name: 'opaqueMetalControl', x: 129, y: 172, radius: 8 },
    ], canonicalCaptures.canvasRect);
    const backdropRefraction = Object.fromEntries(
      backdropRefractionSamples.map((sample) => [sample.name, sample]),
    );
    assert(backdropRefraction.patternedGlassShoulders.rms >= 0.45
      && backdropRefraction.patternedGlassShoulders.bipolarBalance >= 0.45
      && backdropRefraction.patternedGlassShoulders.coverage >= 0.03
      && backdropRefraction.patternedGlassShoulders.meanBiasRatio <= 0.30
      && backdropRefraction.patternedGlassShoulders.peak <= 12,
    `${mode}: Glass did not spatially bend the patterned wall (${JSON.stringify(backdropRefractionSamples)})`);
    assert(backdropRefraction.patternedIceCore.rms >= 0.75
      && backdropRefraction.patternedIceCore.bipolarBalance >= 0.65
      && backdropRefraction.patternedIceCore.coverage >= 0.12
      && backdropRefraction.patternedIceCore.meanBiasRatio <= 0.20
      && backdropRefraction.patternedIceCore.peak <= 8,
    `${mode}: Ice did not spatially facet the patterned wall (${JSON.stringify(backdropRefractionSamples)})`);
    assert(backdropRefraction.patternedGlassShoulders.rms >= 0.45
      && backdropRefraction.patternedIceCore.rms >= 0.75,
    `${mode}: clear Glass and frosted Ice lost their optical distinction (${JSON.stringify(backdropRefractionSamples)})`);
    assert(backdropRefraction.patternedWaterShoulders.rms >= 0.25
      && backdropRefraction.patternedWaterShoulders.bipolarBalance >= 0.25
      && backdropRefraction.patternedWaterShoulders.coverage >= 0.015
      && backdropRefraction.patternedWaterShoulders.meanBiasRatio <= 0.45
      && backdropRefraction.patternedWaterShoulders.peak <= 18,
    `${mode}: Water did not bend its native-wall backdrop (${JSON.stringify(backdropRefractionSamples)})`);
    assert(backdropRefraction.patternedOilShoulders.rms >= 0.18
      && backdropRefraction.patternedOilShoulders.bipolarBalance >= 0.20
      && backdropRefraction.patternedOilShoulders.coverage >= 0.010
      && backdropRefraction.patternedOilShoulders.meanBiasRatio <= 0.55
      && backdropRefraction.patternedOilShoulders.peak <= 18,
    `${mode}: Oil did not bend its native-wall backdrop (${JSON.stringify(backdropRefractionSamples)})`);
    assert(backdropRefraction.patternedWaterShoulders.rms
      >= backdropRefraction.patternedOilShoulders.rms * 0.70,
    `${mode}: Water/Oil refraction lost its optics distinction (${JSON.stringify(backdropRefractionSamples)})`);
    assert(backdropRefraction.opaqueMetalControl.peak <= 1
      && backdropRefraction.opaqueMetalControl.rms <= 0.15,
    `${mode}: backdrop refraction leaked into matched opaque Metal (${JSON.stringify(backdropRefractionSamples)})`);
    assert(backdropRefraction.moltenLavaPinholeControl.peak <= 1
      && backdropRefraction.moltenLavaPinholeControl.rms <= 0.15,
    `${mode}: backdrop refraction leaked into molten Lava or its reconstructed pinhole (${JSON.stringify(backdropRefractionSamples)})`);
    assert(backdropRefractionSamples.every((sample) => sample.repeatPeak <= 1),
      `${mode}: refraction off-on-off sequence was not deterministic (${JSON.stringify(backdropRefractionSamples)})`);
    const backdropSupportRegions = [
      { name: 'patternedGlassSupport', x: 445, y: 229, radiusX: 17.5, radiusY: 10.5, silhouette: true },
      { name: 'patternedIceSupport', x: 525, y: 229, radius: 6, silhouette: true },
      { name: 'patternedLiquidSupport', x: 303, y: 172, radiusX: 37, radiusY: 12.5, silhouette: true },
    ];
    const [straightBackdropSupport, refractedBackdropSupport] = await Promise.all([
      samplePageRegions(
        cdp, straightBackdropCaptures.capture.data, backdropSupportRegions,
        blankCaptures.capture.data, blankCaptures.reference.data, canonicalCaptures.canvasRect,
      ),
      samplePageRegions(
        cdp, refractedBackdropCaptures.capture.data, backdropSupportRegions,
        blankCaptures.capture.data, blankCaptures.reference.data, canonicalCaptures.canvasRect,
      ),
    ]);
    const backdropSupportInvariantSamples = straightBackdropSupport.map((straight, index) => ({
      name: straight.name,
      straightVisible: straight.visible,
      refractedVisible: refractedBackdropSupport[index].visible,
      straightWorldArea: straight.worldArea,
      refractedWorldArea: refractedBackdropSupport[index].worldArea,
    }));
    assert(backdropSupportInvariantSamples.every((sample) => (
      sample.straightVisible === sample.refractedVisible
      && Math.abs(sample.straightWorldArea - sample.refractedWorldArea) <= 0.01
    )), `${mode}: backdrop refraction changed translucent support (${JSON.stringify(backdropSupportInvariantSamples)})`);
    const solidContactDepthSamples = await sampleBackdropRefractionRegions(cdp, {
      straight: flatContactCaptures.capture.data,
      refracted: depthContactCaptures.capture.data,
      repeatedStraight: repeatedFlatContactCaptures.capture.data,
    }, [
      { name: 'metalGlassSeam', x: 140, y: 172, radiusX: 6, radiusY: 10 },
      { name: 'glassCaustic', x: 154, y: 172, radius: 6 },
      { name: 'iceCaustic', x: 525, y: 229, radius: 6 },
      { name: 'opaqueMetalInterior', x: 125, y: 172, radius: 4 },
    ], canonicalCaptures.canvasRect);
    const solidContactDepth = Object.fromEntries(
      solidContactDepthSamples.map((sample) => [sample.name, sample]),
    );
    assert(solidContactDepth.metalGlassSeam.rgbRms >= 0.75
      && solidContactDepth.metalGlassSeam.rms >= 0.15
      && solidContactDepth.metalGlassSeam.bipolarBalance >= 0.20
      && solidContactDepth.metalGlassSeam.rgbPeak <= 18,
    `${mode}: Metal/Glass contact remained a flat palette cut (${JSON.stringify(solidContactDepthSamples)})`);
    assert(solidContactDepth.glassCaustic.chromaRms >= 0.20
      && solidContactDepth.iceCaustic.chromaRms >= 0.12
      && solidContactDepth.glassCaustic.chromaRms
        >= solidContactDepth.iceCaustic.chromaRms * 1.02
      && solidContactDepth.glassCaustic.rgbPeak <= 18
      && solidContactDepth.iceCaustic.rgbPeak <= 18,
    `${mode}: Glass/Ice lost their distinct bounded prismatic depth (${JSON.stringify(solidContactDepthSamples)})`);
    assert(solidContactDepth.opaqueMetalInterior.rgbPeak <= 1,
      `${mode}: translucent caustics leaked into opaque Metal (${JSON.stringify(solidContactDepthSamples)})`);
    assert(solidContactDepthSamples.every((sample) => sample.repeatRgbPeak <= 1),
      `${mode}: solid-contact off-on-off sequence was not deterministic (${JSON.stringify(solidContactDepthSamples)})`);
    const solidContactSupportRegions = [
      {
        name: 'metalGlassContactSupport', x: 140.5, y: 172,
        radiusX: 40, radiusY: 16, silhouette: true,
      },
      { name: 'iceCausticSupport', x: 525, y: 229, radius: 8, silhouette: true },
    ];
    const [flatContactSupport, depthContactSupport] = await Promise.all([
      samplePageRegions(
        cdp, flatContactCaptures.capture.data, solidContactSupportRegions,
        blankCaptures.capture.data, blankCaptures.reference.data, canonicalCaptures.canvasRect,
      ),
      samplePageRegions(
        cdp, depthContactCaptures.capture.data, solidContactSupportRegions,
        blankCaptures.capture.data, blankCaptures.reference.data, canonicalCaptures.canvasRect,
      ),
    ]);
    const solidContactSupportInvariantSamples = flatContactSupport.map((flat, index) => ({
      name: flat.name,
      flatVisible: flat.visible,
      depthVisible: depthContactSupport[index].visible,
      flatWorldArea: flat.worldArea,
      depthWorldArea: depthContactSupport[index].worldArea,
    }));
    assert(solidContactSupportInvariantSamples.every((sample) => (
      sample.flatVisible === sample.depthVisible
      && Math.abs(sample.flatWorldArea - sample.depthWorldArea) <= 0.01
    )), `${mode}: contact depth changed material support (${JSON.stringify(solidContactSupportInvariantSamples)})`);
    const lensShellSamples = await sampleBackdropRefractionRegions(cdp, {
      straight: flatLensCaptures.capture.data,
      refracted: shellLensCaptures.capture.data,
      repeatedStraight: repeatedFlatLensCaptures.capture.data,
    }, [
      { name: 'glassLensShell', x: 445, y: 229, radius: 8 },
      { name: 'iceLensShell', x: 525, y: 229, radius: 8 },
      { name: 'metalLensControl', x: 405, y: 229, radius: 8 },
    ], canonicalCaptures.canvasRect);
    const lensShell = Object.fromEntries(lensShellSamples.map((sample) => [sample.name, sample]));
    assert(lensShell.glassLensShell.rgbRms >= 0.55
      && lensShell.glassLensShell.chromaRms >= 0.15
      && lensShell.glassLensShell.rgbPeak <= 18,
    `${mode}: Glass remained a flat tinted overlay (${JSON.stringify(lensShellSamples)})`);
    assert(lensShell.iceLensShell.rgbRms >= 0.30
      && lensShell.iceLensShell.chromaRms >= 0.10
      && lensShell.iceLensShell.rgbPeak <= 18,
    `${mode}: Ice lost its frosted lens shell (${JSON.stringify(lensShellSamples)})`);
    assert(lensShell.metalLensControl.rgbPeak <= 1,
      `${mode}: translucent lens shell leaked into opaque Metal (${JSON.stringify(lensShellSamples)})`);
    assert(lensShellSamples.every((sample) => sample.repeatRgbPeak <= 1),
      `${mode}: translucent lens off-on-off sequence was not deterministic (${JSON.stringify(lensShellSamples)})`);
    const lensSupportRegions = [
      { name: 'glassLensSupport', x: 445, y: 229, radiusX: 17.5, radiusY: 10.5, silhouette: true },
      { name: 'iceLensSupport', x: 525, y: 229, radiusX: 17.5, radiusY: 10.5, silhouette: true },
    ];
    const [flatLensSupport, shellLensSupport] = await Promise.all([
      samplePageRegions(
        cdp, flatLensCaptures.capture.data, lensSupportRegions,
        blankCaptures.capture.data, blankCaptures.reference.data, canonicalCaptures.canvasRect,
      ),
      samplePageRegions(
        cdp, shellLensCaptures.capture.data, lensSupportRegions,
        blankCaptures.capture.data, blankCaptures.reference.data, canonicalCaptures.canvasRect,
      ),
    ]);
    const lensSupportInvariantSamples = flatLensSupport.map((flat, index) => ({
      name: flat.name,
      flatVisible: flat.visible,
      shellVisible: shellLensSupport[index].visible,
      flatWorldArea: flat.worldArea,
      shellWorldArea: shellLensSupport[index].worldArea,
    }));
    assert(lensSupportInvariantSamples.every((sample) => (
      sample.flatVisible === sample.shellVisible
      && Math.abs(sample.flatWorldArea - sample.shellWorldArea) <= 0.01
    )), `${mode}: lens shell changed translucent support (${JSON.stringify(lensSupportInvariantSamples)})`);
    const solidCurvatureSamples = await sampleBackdropRefractionRegions(cdp, {
      straight: flatCurvatureCaptures.capture.data,
      refracted: curvedSolidCaptures.capture.data,
      repeatedStraight: repeatedFlatCurvatureCaptures.capture.data,
    }, [
      { name: 'metalConvex', x: 392, y: 223, radius: 3.5 },
      { name: 'metalConcave', x: 419, y: 225, radius: 4 },
      { name: 'plantConvex', x: 432, y: 248, radius: 3.5 },
      { name: 'dtecConvex', x: 472, y: 298, radius: 3.5 },
      { name: 'metalFlatTop', x: 405, y: 220, radiusX: 4, radiusY: 1.5 },
      { name: 'metalDenseCore', x: 405, y: 229, radius: 3 },
    ], canonicalCaptures.canvasRect);
    const solidCurvature = Object.fromEntries(
      solidCurvatureSamples.map((sample) => [sample.name, sample]),
    );
    assert(solidCurvature.metalConvex.rms >= 0.10
      && solidCurvature.metalConcave.rms >= 0.10
      && solidCurvature.metalConvex.rgbPeak <= 12
      && solidCurvature.metalConcave.rgbPeak <= 12,
    `${mode}: rigid convex/concave curvature was not bipolar (${JSON.stringify(solidCurvatureSamples)})`);
    assert(solidCurvature.plantConvex.rms >= 0.05
      && solidCurvature.dtecConvex.rms >= 0.05
      && solidCurvature.plantConvex.rgbPeak <= solidCurvature.metalConvex.rgbPeak
      && solidCurvature.dtecConvex.rgbPeak <= 12,
    `${mode}: family curvature gains were lost (${JSON.stringify(solidCurvatureSamples)})`);
    assert(solidCurvature.metalFlatTop.rgbPeak <= 1
      && solidCurvature.metalDenseCore.rgbPeak <= 1,
    `${mode}: solid curvature leaked onto flat edges or dense interiors (${JSON.stringify(solidCurvatureSamples)})`);
    assert(solidCurvatureSamples.every((sample) => sample.repeatRgbPeak <= 1),
      `${mode}: curvature off-on-off sequence was not deterministic (${JSON.stringify(solidCurvatureSamples)})`);
    const curvatureSupportRegions = [
      { name: 'metalCurvatureSupport', x: 405, y: 229, radiusX: 17.5, radiusY: 10.5, silhouette: true },
      { name: 'plantCurvatureSupport', x: 445, y: 254, radiusX: 17.5, radiusY: 10.5, silhouette: true },
      { name: 'dtecCurvatureSupport', x: 485, y: 304, radiusX: 17.5, radiusY: 10.5, silhouette: true },
    ];
    const [flatCurvatureSupport, curvedSolidSupport] = await Promise.all([
      samplePageRegions(
        cdp, flatCurvatureCaptures.capture.data, curvatureSupportRegions,
        blankCaptures.capture.data, blankCaptures.reference.data, canonicalCaptures.canvasRect,
      ),
      samplePageRegions(
        cdp, curvedSolidCaptures.capture.data, curvatureSupportRegions,
        blankCaptures.capture.data, blankCaptures.reference.data, canonicalCaptures.canvasRect,
      ),
    ]);
    const curvatureSupportInvariantSamples = flatCurvatureSupport.map((flat, index) => ({
      name: flat.name,
      flatVisible: flat.visible,
      curvedVisible: curvedSolidSupport[index].visible,
      flatWorldArea: flat.worldArea,
      curvedWorldArea: curvedSolidSupport[index].worldArea,
    }));
    assert(curvatureSupportInvariantSamples.every((sample) => (
      sample.flatVisible === sample.curvedVisible
      && Math.abs(sample.flatWorldArea - sample.curvedWorldArea) <= 0.01
    )), `${mode}: curvature changed solid support (${JSON.stringify(curvatureSupportInvariantSamples)})`);
    const liquidColumnSamples = await sampleCanonicalRegions([
      { name: 'waterColumn', x: 224, y: 270, radius: 8 },
      { name: 'oilColumn', x: 263, y: 270, radius: 8 },
      { name: 'acidColumn', x: 302, y: 270, radius: 8 },
      { name: 'lavaColumn', x: 341, y: 270, radius: 8 },
    ]);
    assert(liquidColumnSamples.every((sample) => sample.coverage >= 0.90),
      `${mode}: a dense liquid column became perforated (${JSON.stringify(liquidColumnSamples)})`);
    assert(liquidColumnSamples.every((sample) => sample.microContrast <= 4),
      `${mode}: dense liquid cell-frequency contrast returned (${JSON.stringify(liquidColumnSamples)})`);
    assert(liquidColumnSamples.every((sample) => sample.macroLumaRange >= 2),
      `${mode}: dense liquid lost its low-frequency depth (${JSON.stringify(liquidColumnSamples)})`);
    assert(liquidColumnSamples.every((sample) => sample.lumaRange >= 8 && sample.lumaRange <= 120),
      `${mode}: dense liquid depth is flat or clipped (${JSON.stringify(liquidColumnSamples)})`);
    assert(liquidColumnSamples.every((sample) => sample.pinnedFraction <= 0.15),
      `${mode}: dense liquid framebuffer clipping returned (${JSON.stringify(liquidColumnSamples)})`);
    const liquidColumns = Object.fromEntries(liquidColumnSamples.map((sample) => [sample.name, sample]));
    assert(liquidColumns.waterColumn.rgb[2] > liquidColumns.waterColumn.rgb[1]
      && liquidColumns.waterColumn.rgb[1] > liquidColumns.waterColumn.rgb[0],
    `${mode}: Water column lost its cyan-blue hue (${liquidColumns.waterColumn.rgb})`);
    assert(liquidColumns.oilColumn.rgb[0] > liquidColumns.oilColumn.rgb[1]
      && liquidColumns.oilColumn.rgb[1] > liquidColumns.oilColumn.rgb[2],
    `${mode}: Oil column lost its warm-brown hue (${liquidColumns.oilColumn.rgb})`);
    assert(liquidColumns.acidColumn.rgb[2] > liquidColumns.acidColumn.rgb[0]
      && liquidColumns.acidColumn.rgb[0] > liquidColumns.acidColumn.rgb[1],
    `${mode}: Acid column lost its violet hue (${liquidColumns.acidColumn.rgb})`);
    assert(liquidColumns.lavaColumn.rgb[0] > liquidColumns.lavaColumn.rgb[1]
      && liquidColumns.lavaColumn.rgb[1] > liquidColumns.lavaColumn.rgb[2],
    `${mode}: Lava column lost its warm hue (${liquidColumns.lavaColumn.rgb})`);
    const liquidReliefSamples = await sampleCanonicalRegions([
      { name: 'waterUpperLeft', x: 210, y: 45, radius: 5 },
      { name: 'waterCore', x: 238, y: 79, radius: 5 },
      { name: 'waterLowerLeft', x: 210, y: 113, radius: 5 },
    ]);
    if (mode === 'canvas2d') {
      const liquidRelief = Object.fromEntries(liquidReliefSamples.map((sample) => [sample.name, sample]));
      assert(liquidRelief.waterUpperLeft.macroLumaRange >= 12
        && liquidRelief.waterUpperLeft.macroLumaRange >= liquidRelief.waterCore.macroLumaRange * 2,
      `Canvas Water lost coherent upper-left field relief (${JSON.stringify(liquidReliefSamples)})`);
      assert(liquidRelief.waterCore.microContrast <= 1,
        `Canvas Water core relief became cell-grained (${JSON.stringify(liquidReliefSamples)})`);
    }

    if (visualOnly) {
      const visualScreenshot = screenshotPath(mode);
      if (visualScreenshot) {
        await writeFile(
          variantScreenshotPath(visualScreenshot, 'thermal-neutral'),
          Buffer.from(neutralThermalCaptures.capture.data, 'base64'),
        );
        await writeFile(
          variantScreenshotPath(visualScreenshot, 'thermal-styled'),
          Buffer.from(styledThermalCaptures.capture.data, 'base64'),
        );
        await writeFile(
          visualScreenshot, Buffer.from(refractedBackdropCaptures.capture.data, 'base64'),
        );
        await writeFile(
          variantScreenshotPath(visualScreenshot, 'straight-backdrop'),
          Buffer.from(straightBackdropCaptures.capture.data, 'base64'),
        );
        await writeFile(
          variantScreenshotPath(visualScreenshot, 'flat-contact'),
          Buffer.from(flatContactCaptures.capture.data, 'base64'),
        );
        await writeFile(
          variantScreenshotPath(visualScreenshot, 'depth-contact'),
          Buffer.from(depthContactCaptures.capture.data, 'base64'),
        );
        await writeFile(
          variantScreenshotPath(visualScreenshot, 'flat-lens'),
          Buffer.from(flatLensCaptures.capture.data, 'base64'),
        );
        await writeFile(
          variantScreenshotPath(visualScreenshot, 'lens-shell'),
          Buffer.from(shellLensCaptures.capture.data, 'base64'),
        );
        await writeFile(
          variantScreenshotPath(visualScreenshot, 'flat-curvature'),
          Buffer.from(flatCurvatureCaptures.capture.data, 'base64'),
        );
        await writeFile(
          variantScreenshotPath(visualScreenshot, 'solid-curvature'),
          Buffer.from(curvedSolidCaptures.capture.data, 'base64'),
        );
      }
      assert(errors.length === 0, `${mode}: browser errors: ${errors.join(' | ')}`);
      cdp.close();
      return {
        backend: mode,
        canonicalFixture,
        powderStyleSamples,
        powderColumnStyleSamples,
        squareGrainSample,
        zoomedSquareGrainSample,
        powderColumnSemanticSupport,
        thermalResponseSamples,
        thermalRepeatSamples,
        thermalSupportInvariantSamples,
        gasLightResponseSamples,
        liquidLightResponseSamples,
        translucentLightResponseSamples,
        translucentSupportInvariantSamples,
        backdropRefractionSamples,
        backdropSupportInvariantSamples,
        solidContactDepthSamples,
        solidContactSupportInvariantSamples,
        lensShellSamples,
        lensSupportInvariantSamples,
        solidCurvatureSamples,
        curvatureSupportInvariantSamples,
        silhouetteSamples,
        liquidContourCrossings,
        liquidColumnSamples,
        liquidReliefSamples,
        compactGasSamples,
        sparseGasSamples,
        ...(visualScreenshot ? { screenshot: visualScreenshot } : {}),
        browserErrors: errors.length,
      };
    }

    const screenshot = screenshotPath(mode);
    if (screenshot) {
      await writeFile(screenshot, Buffer.from(canonicalCapture.data, 'base64'));
    }

    const denseCanvasPresentation = mode === 'canvas2d'
      ? await auditDenseCanvasPresentation(cdp)
      : undefined;

    await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.clear(); window.__ANIFOR_INPUT_AUDIT__.setRadius(0); window.__ANIFOR_INPUT_AUDIT__.setMaterial(164); true`);
    await sleep(350);
    const initial = await metrics(cdp);
    assertGeometry(initial, `${mode} initial`);
    assertToolboxGeometry(initial, `${mode} initial`, 68);
    assert(filterRows(initial.ui.filterButtons) === 2, `${mode}: desktop tool filters are not two rows`);
    const landmarks = [{ x: 17, y: 21 }, { x: 306, y: 192 }, { x: 594, y: 361 }];
    for (const landmark of landmarks) {
      // Sample cell centres so floating-point rounding at an exact grid edge
      // cannot turn a correct mapping into the preceding cell.
      const point = worldClient(initial.canvas, { x: landmark.x + 0.5, y: landmark.y + 0.5 });
      await mouseClick(cdp, point.x, point.y, 'left');
    }
    await sleep(80);
    const painted = await evaluate(cdp, `(() => {
      const audit = window.__ANIFOR_INPUT_AUDIT__;
      return {
        cells: ${JSON.stringify(landmarks)}.map(({x, y}) => audit.cell(x, y)),
        occupied: audit.occupiedCells(),
      };
    })()`);
    assert(
      painted.cells.every((cell) => cell === painted.cells[0] && cell > 0),
      `${mode}: landmark cells did not receive the same material (${painted.cells.join(', ')})`,
    );
    assert(painted.occupied === landmarks.length, `${mode}: expected ${landmarks.length} exact radius-0 cells, got ${painted.occupied}`);
    const paintedFootprints = await capturePaintedFootprints(cdp, landmarks, `${mode} renderScale=2`);

    await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.clear(); true`);
    const dragY = 88;
    const dragStartCell = 96;
    const dragEndCell = 120;
    const dragStart = worldClient(initial.canvas, { x: dragStartCell + 0.5, y: dragY + 0.5 });
    const dragEnd = worldClient(initial.canvas, { x: dragEndCell + 0.5, y: dragY + 0.5 });
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: dragStart.x, y: dragStart.y,
      button: 'left', buttons: 1, clickCount: 1,
    });
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved', x: dragEnd.x, y: dragEnd.y, button: 'left', buttons: 1,
    });
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: dragEnd.x, y: dragEnd.y,
      button: 'left', buttons: 0, clickCount: 1,
    });
    await sleep(80);
    const dragPainted = await evaluate(cdp, `(() => {
      const audit = window.__ANIFOR_INPUT_AUDIT__;
      const cells = [];
      for (let x = ${dragStartCell}; x <= ${dragEndCell}; x++) cells.push(audit.cell(x, ${dragY}));
      return { cells, occupied: audit.occupiedCells() };
    })()`);
    const dragCellCount = dragEndCell - dragStartCell + 1;
    assert(dragPainted.cells.every((cell) => cell > 0) && dragPainted.occupied === dragCellCount,
      `${mode}: sparse-event left drag did not paint a continuous ${dragCellCount}-cell stroke`);
    const dragFootprints = await capturePaintedFootprints(cdp, [
      { x: dragStartCell, y: dragY },
      { x: Math.floor((dragStartCell + dragEndCell) / 2), y: dragY },
      { x: dragEndCell, y: dragY },
    ], `${mode} continuous drag`, 1.5, 1.6);
    await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.clear(); true`);

    const wheelMetrics = await metrics(cdp);
    const wheelClient = worldClient(wheelMetrics.canvas, { x: 431.25, y: 117.75 });
    const wheelBefore = await screenWorld(cdp, wheelClient);
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel', x: wheelClient.x, y: wheelClient.y,
      deltaX: 0, deltaY: -120, modifiers: 0,
    });
    await sleep(100);
    const wheelAfter = await screenWorld(cdp, wheelClient);
    const zoomedView = await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.viewState()`);
    const wheelAnchorError = Math.hypot(wheelAfter.x - wheelBefore.x, wheelAfter.y - wheelBefore.y);
    assert(zoomedView.zoom > 1.2, `${mode}: wheel did not increase zoom`);
    // Fractional CSS pixels are rounded independently by Chrome's input and
    // layout paths. Keep the accepted drift below one fifth of a grid cell.
    assert(wheelAnchorError < 0.2, `${mode}: wheel anchor drifted ${wheelAnchorError.toFixed(4)} cells`);

    const panStart = { x: wheelClient.x, y: wheelClient.y };
    const beforePan = zoomedView;
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...panStart, button: 'middle', buttons: 4, clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: panStart.x + 42, y: panStart.y + 27, button: 'middle', buttons: 4 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: panStart.x + 42, y: panStart.y + 27, button: 'middle', buttons: 0, clickCount: 1 });
    await sleep(80);
    const afterPan = await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.viewState()`);
    assert(Math.abs((afterPan.panX - beforePan.panX) - 42) < 0.12, `${mode}: middle-pan X mismatch`);
    assert(Math.abs((afterPan.panY - beforePan.panY) - 27) < 0.12, `${mode}: middle-pan Y mismatch`);

    // Exercise the actual ResizeObserver/rAF/presenter chain while the camera
    // is zoomed and off-centre, then require an exact round-trip at the same
    // CSS viewport. Zoom-one geometry alone cannot prove camera preservation.
    const zoomedResizeClient = { x: panStart.x + 42, y: panStart.y + 27 };
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel', x: zoomedResizeClient.x, y: zoomedResizeClient.y,
      deltaX: 0, deltaY: -240, modifiers: 0,
    });
    await sleep(100);
    const resizeStartView = await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.viewState()`);
    assert(resizeStartView.zoom > 1.8, `${mode}: resize proof did not reach a stable deep zoom`);
    const zoomedResizeAnchorBefore = await screenWorld(cdp, zoomedResizeClient);
    const zoomedGeometry = await metrics(cdp);
    await setDesktopMetrics(cdp, 1024, 600, dpr);
    const compactZoomedGeometry = await waitForStableZoomedCamera(
      cdp, 1024, 600, zoomedGeometry, resizeStartView.zoom, 6_000, `${mode} zoomed 1024x600`,
    );
    const compactZoomedView = await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.viewState()`);
    assert(Math.abs(compactZoomedView.zoom - resizeStartView.zoom) < 0.001,
      `${mode}: zoom changed during compact resize`);
    await setDesktopMetrics(cdp, 1280, 720, dpr);
    const returnedZoomedGeometry = await waitForStableZoomedCamera(
      cdp, 1280, 720, compactZoomedGeometry, resizeStartView.zoom, 6_000, `${mode} zoomed 1280x720 return`,
    );
    const returnedZoomedView = await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.viewState()`);
    const relativeAnchor = {
      x: (zoomedResizeClient.x - zoomedGeometry.viewport.left) / zoomedGeometry.viewport.width,
      y: (zoomedResizeClient.y - zoomedGeometry.viewport.top) / zoomedGeometry.viewport.height,
    };
    const returnedResizeClient = {
      x: returnedZoomedGeometry.viewport.left + relativeAnchor.x * returnedZoomedGeometry.viewport.width,
      y: returnedZoomedGeometry.viewport.top + relativeAnchor.y * returnedZoomedGeometry.viewport.height,
    };
    const zoomedResizeAnchorAfter = await screenWorld(cdp, returnedResizeClient);
    const zoomedResizeAnchorError = Math.hypot(
      zoomedResizeAnchorAfter.x - zoomedResizeAnchorBefore.x,
      zoomedResizeAnchorAfter.y - zoomedResizeAnchorBefore.y,
    );
    const normalizedPanBefore = {
      x: resizeStartView.panX / (zoomedGeometry.canvas.width / resizeStartView.zoom),
      y: resizeStartView.panY / (zoomedGeometry.canvas.height / resizeStartView.zoom),
    };
    const normalizedPanAfter = {
      x: returnedZoomedView.panX / (returnedZoomedGeometry.canvas.width / returnedZoomedView.zoom),
      y: returnedZoomedView.panY / (returnedZoomedGeometry.canvas.height / returnedZoomedView.zoom),
    };
    assert(Math.abs(returnedZoomedView.zoom - resizeStartView.zoom) < 0.001
      && Math.abs(normalizedPanAfter.x - normalizedPanBefore.x) < 0.0002
      && Math.abs(normalizedPanAfter.y - normalizedPanBefore.y) < 0.0002,
    `${mode}: zoomed camera did not survive resize round-trip (${JSON.stringify({ before: resizeStartView, compact: compactZoomedView, returned: returnedZoomedView })})`);
    assert(zoomedResizeAnchorError < 0.2,
      `${mode}: zoomed resize anchor drifted ${zoomedResizeAnchorError.toFixed(4)} cells`);

    await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.resetView(); true`);
    const resetGeometry = await waitForStableCanvas(
      cdp, 1280, 720, undefined, 6_000, `${mode} reset-view 1280x720`,
    );
    const resizeMetrics = [];
    let previousResize = resetGeometry;
    for (const [width, height] of [[1024, 600], [1440, 900], [1024, 600]]) {
      await setDesktopMetrics(cdp, width, height, dpr);
      const current = await waitForStableCanvas(
        cdp, width, height, previousResize, 6_000, `${mode} ${width}x${height}`,
      );
      assertGeometry(current, `${mode} ${width}x${height}`);
      assertContained(current, `${mode} ${width}x${height}`);
      assertToolboxGeometry(current, `${mode} ${width}x${height}`, 68);
      resizeMetrics.push({
        width, height,
        canvasWidth: round(current.canvas.width), canvasHeight: round(current.canvas.height),
        toolboxGap: round(current.ui.actions.top - current.ui.palette.bottom),
      });
      previousResize = current;
    }
    assert(resizeMetrics[1].canvasWidth > resizeMetrics[0].canvasWidth + 100,
      `${mode}: larger desktop resize did not enlarge canvas`);
    assert(Math.abs(resizeMetrics[2].canvasWidth - resizeMetrics[0].canvasWidth) < 0.1
      && Math.abs(resizeMetrics[2].canvasHeight - resizeMetrics[0].canvasHeight) < 0.1,
    `${mode}: desktop resize did not return to fitted geometry (${JSON.stringify(resizeMetrics)})`);
    const shortDesktop = await auditShortDesktop(cdp, mode, dpr, previousResize);

    const mobile = await auditMobile(
      cdp, mode, screenshot ? variantScreenshotPath(screenshot, 'mobile') : undefined,
    );
    const renderScaleOne = await auditRenderScaleOne(cdp, mode, dpr);
    const renderScaleEight = mode === 'webgl'
      ? await auditRenderScaleEight(cdp, dpr)
      : undefined;
    const nativeSemantics = await auditNativeSemantics(cdp, mode, dpr, screenshot);
    await sleep(50);
    assert(errors.length === 0, `${mode}: browser errors: ${errors.join(' | ')}`);
    cdp.close();
    return {
      backend: mode, dpr,
      backing: `${initial.backing.width}x${initial.backing.height}`,
      canonicalFixture: { occupied: canonicalFixture.occupied, wallSignature: '3,3' },
      energySamples,
      energyTopologySamples,
      sparseEnergySamples,
      solidSamples,
      translucentSolidSamples,
      solidSeparatorSamples,
      powderSamples,
      powderStyleSamples,
      powderColumnStyleSamples,
      squareGrainSample,
      zoomedSquareGrainSample,
      powderColumnSemanticSupport,
      thermalResponseSamples,
      thermalRepeatSamples,
      thermalSupportInvariantSamples,
      silhouetteSamples,
      liquidContourCrossings,
      contactSilhouetteSamples,
      contactMaterialSamples,
      isolatedMaterialSamples,
      liquidSeamSamples,
      liquidInterfaceSamples,
      volumeSamples,
      gasLightingSamples,
      gasLightResponseSamples,
      liquidLightResponseSamples,
      translucentLightResponseSamples,
      translucentSupportInvariantSamples,
      backdropRefractionSamples,
      backdropSupportInvariantSamples,
      solidContactDepthSamples,
      solidContactSupportInvariantSamples,
      lensShellSamples,
      lensSupportInvariantSamples,
      solidCurvatureSamples,
      curvatureSupportInvariantSamples,
      ...(canvasGasLightingRefresh ? { canvasGasLightingRefresh } : {}),
      liquidColumnSamples,
      liquidReliefSamples,
      compactGasSamples,
      sparseGasSamples,
      ...(webGLPresentationTiming ? { webGLPresentationTiming } : {}),
      ...(denseCanvasPresentation ? { denseCanvasPresentation } : {}),
      landmarkCells: landmarks.length,
      paintedFootprints,
      continuousDragCells: dragCellCount,
      dragFootprints,
      configuredSource: nativeSemantics.configuredSource,
      lifePreset: nativeSemantics.lifePreset,
      wheelAnchorErrorCells: round(wheelAnchorError, 5),
      middlePanDelta: { x: round(afterPan.panX - beforePan.panX, 3), y: round(afterPan.panY - beforePan.panY, 3) },
      zoomedResizeAnchorErrorCells: round(zoomedResizeAnchorError, 5),
      renderScaleOne,
      ...(renderScaleEight ? { renderScaleEight } : {}),
      toolFilters: { height: round(initial.ui.filters.height), rows: filterRows(initial.ui.filterButtons) },
      resizeMetrics,
      shortDesktop,
      ...(mobile ? { mobile } : {}),
      ...(screenshot ? { screenshot } : {}),
      ...nativeSemantics.screenshots,
      browserErrors: errors.length,
    };
  } finally {
    await terminate(chrome);
    await rm(profile, { recursive: true, force: true });
  }
}

async function auditWebGLPresentationTiming(cdp, targetSamples = 30, sampleTimeout = 5_000) {
  let timing = await evaluate(cdp,
    'window.__ANIFOR_INPUT_AUDIT__.webGLPresentationTiming()');
  assert(timing, 'WebGL presentation timing is unavailable');
  assert(timing.source === 'gpu-query' || timing.source === 'cpu-submission',
    `Unknown WebGL timing source ${timing.source}`);

  const maximumAttempts = targetSamples + 45;
  for (let attempt = 0; timing.usableSamples < targetSamples && attempt < maximumAttempts; attempt++) {
    const before = timing;
    const requested = await evaluate(cdp,
      'window.__ANIFOR_INPUT_AUDIT__.requestWebGLPresentationTimingSample()');
    assert(requested, `WebGL timing sample ${attempt + 1} was not accepted`);
    timing = await waitFor(() => evaluate(cdp, `(() => {
      const next = window.__ANIFOR_INPUT_AUDIT__.webGLPresentationTiming();
      return next && (next.source !== ${JSON.stringify(before.source)}
        || next.sequence > ${before.sequence}) ? next : null;
    })()`), sampleTimeout, `WebGL presentation sample ${attempt + 1}`);
  }

  assert(timing.usableSamples >= targetSamples,
    `WebGL presentation produced only ${timing.usableSamples}/${targetSamples} usable samples`
      + ` (${timing.discardedSamples} discarded, ${timing.source})`);
  for (const [label, value] of [
    ['median', timing.medianMs], ['p90', timing.p90Ms], ['maximum', timing.maximumMs],
  ]) assert(Number.isFinite(value) && value >= 0,
    `WebGL ${label} timing is invalid (${value}, ${timing.source})`);

  return {
    fixture: 'canonical render lab',
    source: timing.source,
    samples: timing.usableSamples,
    discardedSamples: timing.discardedSamples,
    medianMs: round(timing.medianMs),
    p90Ms: round(timing.p90Ms),
    maximumMs: round(timing.maximumMs),
  };
}

async function auditCanvasGasLightingRefresh(cdp) {
  let timing = await evaluate(cdp,
    'window.__ANIFOR_INPUT_AUDIT__.canvasPresentationTiming()');
  assert(timing, 'Canvas gas-light refresh timing is unavailable');
  const durations = [];
  for (let sample = 0; sample < 20; sample++) {
    await evaluate(cdp, 'window.__ANIFOR_INPUT_AUDIT__.setGasFieldLighting(true); true');
    timing = await waitForCanvasPresentation(cdp, timing.sequence, `Canvas gas-light refresh ${sample + 1}`);
    assert(timing.rebuiltField === undefined,
      `Canvas gas-light refresh unexpectedly rebuilt ${timing.rebuiltField}`);
    durations.push(timing.durationMs);
    await evaluate(cdp, 'window.__ANIFOR_INPUT_AUDIT__.setGasFieldLighting(false); true');
    timing = await waitForCanvasPresentation(cdp, timing.sequence, `Canvas gas-light reset ${sample + 1}`);
  }
  durations.sort((left, right) => left - right);
  return {
    fixture: 'canonical atmosphere + emission field',
    samples: durations.length,
    medianMs: round(durations[Math.floor(durations.length / 2)]),
    p90Ms: round(durations[Math.floor((durations.length - 1) * 0.9)]),
    maximumMs: round(durations.at(-1)),
  };
}

async function auditDenseCanvasPresentation(cdp) {
  const initialSequence = await evaluate(cdp,
    `window.__ANIFOR_INPUT_AUDIT__.canvasPresentationTiming()?.sequence ?? 0`);
  await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.prepareDenseSolidFixture(); true`);
  let timing = await waitForCanvasPresentation(cdp, initialSequence, 'dense Canvas fixture');

  const warmupFrames = 10;
  for (let warmup = 0; warmup < warmupFrames; warmup++) {
    await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.toggleDenseSolidProbe(); true`);
    timing = await waitForCanvasPresentation(cdp, timing.sequence, `dense Canvas warmup ${warmup + 1}`);
  }

  const targetSamples = 30;
  const durations = [];
  let discardedFieldRebuilds = 0;
  for (let attempt = 0; durations.length < targetSamples && attempt < targetSamples + 15; attempt++) {
    await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.toggleDenseSolidProbe(); true`);
    timing = await waitForCanvasPresentation(cdp, timing.sequence, `dense Canvas sample ${attempt + 1}`);
    if (timing.rebuiltField !== undefined) {
      discardedFieldRebuilds++;
      continue;
    }
    durations.push(timing.durationMs);
  }
  assert(durations.length === targetSamples,
    `Canvas dense presentation produced only ${durations.length}/${targetSamples} steady-state samples`);
  durations.sort((left, right) => left - right);
  return {
    fixture: `${WORLD_WIDTH}x${WORLD_HEIGHT} Metal`,
    warmupFrames,
    samples: durations.length,
    discardedFieldRebuilds,
    medianMs: round(durations[Math.floor(durations.length / 2)]),
    p90Ms: round(durations[Math.floor(durations.length * 0.9)]),
    maximumMs: round(durations.at(-1)),
  };
}

function waitForCanvasPresentation(cdp, afterSequence, label) {
  return waitFor(() => evaluate(cdp, `(() => {
    const timing = window.__ANIFOR_INPUT_AUDIT__.canvasPresentationTiming();
    return timing && timing.sequence > ${afterSequence} ? timing : null;
  })()`), 5_000, label);
}

async function auditShortDesktop(cdp, mode, dpr, previous) {
  const samples = [];
  let last = previous;
  for (const [width, height] of [[1280, 520], [1024, 500]]) {
    await setDesktopMetrics(cdp, width, height, dpr);
    const current = await waitForStableCanvas(cdp, width, height, last, 6_000, `${mode} short ${width}x${height}`);
    assertGeometry(current, `${mode} short ${width}x${height}`);
    assertContained(current, `${mode} short ${width}x${height}`);
    assertToolboxGeometry(current, `${mode} short ${width}x${height}`, 68);
    assert(filterRows(current.ui.filterButtons) === 2,
      `${mode}: short desktop tool filters are not two rows`);
    assert(current.ui.footer.top >= current.ui.workspace.bottom - 0.75,
      `${mode}: short desktop footer overlaps the workspace`);
    const filterReach = await evaluate(cdp, `(() => {
      const filters = document.querySelector('.tool-filters');
      if (!(filters instanceof HTMLElement)) throw new Error('Missing desktop filter rail');
      const before = filters.scrollLeft;
      filters.scrollLeft = filters.scrollWidth;
      const after = filters.scrollLeft;
      filters.scrollLeft = before;
      return {
        overflow: getComputedStyle(filters).overflowX,
        maximum: Math.max(0, filters.scrollWidth - filters.clientWidth),
        reached: after,
      };
    })()`);
    assert(filterReach.overflow === 'auto', `${mode}: short desktop filter rail is not scrollable`);
    assert(filterReach.maximum < 1 || filterReach.reached > 0,
      `${mode}: short desktop filter overflow cannot be reached`);
    const shellReach = await evaluate(cdp, `(() => {
      const shell = document.querySelector('.shell');
      const actions = document.querySelector('.actions');
      const footer = document.querySelector('.footer');
      if (!(shell instanceof HTMLElement) || !(actions instanceof HTMLElement)
        || !(footer instanceof HTMLElement)) throw new Error('Missing desktop shell geometry');
      shell.scrollTop = shell.scrollHeight;
      const actionsRect = actions.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      const result = {
        overflow: getComputedStyle(shell).overflowY,
        maximum: Math.max(0, shell.scrollHeight - shell.clientHeight),
        reached: shell.scrollTop,
        actionsBottom: actionsRect.bottom,
        footerBottom: footerRect.bottom,
        viewportHeight: innerHeight,
      };
      shell.scrollTop = 0;
      return result;
    })()`);
    assert(shellReach.overflow === 'auto', `${mode}: short desktop shell is not scrollable`);
    assert(shellReach.maximum > 0 && shellReach.reached >= shellReach.maximum - 1,
      `${mode}: short desktop shell cannot reach its overflow`);
    assert(shellReach.actionsBottom <= shellReach.viewportHeight + 1
      && shellReach.footerBottom <= shellReach.viewportHeight + 1,
    `${mode}: short desktop controls or footer remain unreachable after scrolling`);
    samples.push({
      width, height,
      canvas: `${round(current.canvas.width, 2)}x${round(current.canvas.height, 2)}`,
      toolboxGap: round(current.ui.actions.top - current.ui.palette.bottom),
      filterOverflow: round(filterReach.maximum),
      shellScroll: round(shellReach.maximum),
    });
    last = current;
  }
  return samples;
}

async function auditRenderScaleOne(cdp, mode, dpr) {
  await setDesktopMetrics(cdp, 1280, 720, dpr);
  const navigateScale = async (outputScale) => {
    const query = new URLSearchParams({
      scene: 'render-lab', inputAudit: '1', blankAudit: '1', renderScale: String(outputScale),
      ...(mode === 'canvas2d' ? { renderer: 'canvas2d' } : {}),
    });
    await cdp.send('Page.navigate', { url: `${ORIGIN}/?${query}` });
    await waitFor(() => evaluate(cdp, `(() => {
      const scale = new URLSearchParams(location.search).get('renderScale') === ${JSON.stringify(String(outputScale))};
      const fallback = document.querySelector('.status')?.textContent?.includes('TypeScript deterministic fallback');
      return scale && fallback && Boolean(window.__ANIFOR_INPUT_AUDIT__ && document.documentElement);
    })()`), 15_000, `renderScale=${outputScale} input audit API (${mode})`);
    await waitFor(() => evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.backend().backend === ${JSON.stringify(mode)}`),
      15_000, `renderScale=${outputScale} ${mode} backend`);
    await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.clear(); window.__ANIFOR_INPUT_AUDIT__.setRadius(0); window.__ANIFOR_INPUT_AUDIT__.setMaterial(164); window.__ANIFOR_INPUT_AUDIT__.resetView(); true`);
    await sleep(350);
    let previous;
    let stableSamples = 0;
    return waitFor(async () => {
      const current = await metrics(cdp);
      const backingReady = current.backing.width === WORLD_WIDTH * outputScale
        && current.backing.height === WORLD_HEIGHT * outputScale;
      const viewportReady = current.window.width === 1280 && current.window.height === 720;
      if (!backingReady || !viewportReady) return false;
      if (previous
        && Math.abs(current.canvas.width - previous.canvas.width) < 0.05
        && Math.abs(current.canvas.height - previous.canvas.height) < 0.05) stableSamples++;
      else stableSamples = 0;
      previous = current;
      return stableSamples >= 3 ? current : false;
    }, 6_000, `renderScale=${outputScale} ${mode} stable geometry`);
  };

  const reference = await navigateScale(2);
  assertGeometry(reference, `renderScale=2 ${mode}`, 2);
  const initial = await navigateScale(1);
  assertGeometry(initial, `renderScale=1 ${mode}`, 1);
  assertContained(initial, `renderScale=1 ${mode}`);
  assertToolboxGeometry(initial, `renderScale=1 ${mode}`, 68);
  assert(Math.abs(initial.canvas.width - reference.canvas.width) < 0.1
    && Math.abs(initial.canvas.height - reference.canvas.height) < 0.1,
  `${mode}: renderScale changed CSS canvas geometry (${reference.canvas.width.toFixed(2)}x${reference.canvas.height.toFixed(2)} -> ${initial.canvas.width.toFixed(2)}x${initial.canvas.height.toFixed(2)})`);

  const landmarks = [{ x: 29, y: 33 }, { x: 306, y: 192 }, { x: 581, y: 347 }];
  for (const landmark of landmarks) {
    const point = worldClient(initial.canvas, { x: landmark.x + 0.5, y: landmark.y + 0.5 });
    await mouseClick(cdp, point.x, point.y, 'left');
  }
  await sleep(80);
  const painted = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    return {
      cells: ${JSON.stringify(landmarks)}.map(({x, y}) => audit.cell(x, y)),
      occupied: audit.occupiedCells(),
    };
  })()`);
  assert(painted.cells.every((cell) => cell === painted.cells[0] && cell > 0),
    `${mode}: renderScale=1 landmark cells mismatch (${painted.cells.join(', ')})`);
  assert(painted.occupied === landmarks.length,
    `${mode}: renderScale=1 expected ${landmarks.length} exact cells, got ${painted.occupied}`);
  const paintedFootprints = await capturePaintedFootprints(cdp, landmarks, `${mode} renderScale=1`);

  await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.clear(); true`);
  const anchor = worldClient(initial.canvas, { x: 431.25, y: 117.75 });
  const beforeWheel = await screenWorld(cdp, anchor);
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseWheel', x: anchor.x, y: anchor.y, deltaX: 0, deltaY: -120, modifiers: 0,
  });
  await sleep(100);
  const afterWheel = await screenWorld(cdp, anchor);
  const zoomed = await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.viewState()`);
  const wheelAnchorError = Math.hypot(afterWheel.x - beforeWheel.x, afterWheel.y - beforeWheel.y);
  assert(zoomed.zoom > 1.2, `${mode}: renderScale=1 wheel did not increase zoom`);
  assert(wheelAnchorError < 0.2,
    `${mode}: renderScale=1 wheel anchor drifted ${wheelAnchorError.toFixed(4)} cells`);

  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: anchor.x, y: anchor.y, button: 'middle', buttons: 4, clickCount: 1,
  });
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved', x: anchor.x + 42, y: anchor.y + 27, button: 'middle', buttons: 4,
  });
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: anchor.x + 42, y: anchor.y + 27, button: 'middle', buttons: 0, clickCount: 1,
  });
  await sleep(80);
  const panned = await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.viewState()`);
  const panX = panned.panX - zoomed.panX;
  const panY = panned.panY - zoomed.panY;
  assert(Math.abs(panX - 42) < 0.12 && Math.abs(panY - 27) < 0.12,
    `${mode}: renderScale=1 middle-pan mismatch (${panX.toFixed(3)}, ${panY.toFixed(3)})`);
  return {
    backing: `${initial.backing.width}x${initial.backing.height}`,
    cssCanvas: `${round(initial.canvas.width, 2)}x${round(initial.canvas.height, 2)}`,
    landmarkCells: landmarks.length,
    paintedFootprints,
    wheelAnchorErrorCells: round(wheelAnchorError, 5),
    middlePanDelta: { x: round(panX, 3), y: round(panY, 3) },
  };
}

async function auditRenderScaleEight(cdp, dpr) {
  await setDesktopMetrics(cdp, 1280, 720, dpr);
  const referenceQuery = new URLSearchParams({
    scene: 'render-lab', inputAudit: '1', renderScale: '2', auditStage: 'scale-eight-reference',
  });
  await cdp.send('Page.navigate', { url: `${ORIGIN}/?${referenceQuery}` });
  await waitFor(() => evaluate(cdp, `(() => {
    const parameters = new URLSearchParams(location.search);
    return parameters.get('renderScale') === '2'
      && parameters.get('auditStage') === 'scale-eight-reference'
      && Boolean(window.__ANIFOR_INPUT_AUDIT__ && document.documentElement);
  })()`), 15_000, 'renderScale=8 reference input audit API');
  await waitFor(() => evaluate(cdp,
    `window.__ANIFOR_INPUT_AUDIT__.backend().backend === 'webgl'`),
  20_000, 'renderScale=8 reference WebGL backend');
  const reference = await waitForStableCanvas(
    cdp, 1280, 720, undefined, 8_000, 'renderScale=8 reference geometry',
  );
  const query = new URLSearchParams({
    scene: 'render-lab', inputAudit: '1', renderScale: '8', auditStage: 'scale-eight',
  });
  await cdp.send('Page.navigate', { url: `${ORIGIN}/?${query}` });
  await waitFor(() => evaluate(cdp, `(() => {
    const parameters = new URLSearchParams(location.search);
    return parameters.get('renderScale') === '8'
      && parameters.get('auditStage') === 'scale-eight'
      && Boolean(window.__ANIFOR_INPUT_AUDIT__ && document.documentElement);
  })()`), 15_000, 'renderScale=8 input audit API');
  await waitFor(() => evaluate(cdp,
    `window.__ANIFOR_INPUT_AUDIT__.backend().backend === 'webgl'`),
  45_000, 'renderScale=8 WebGL backend');
  const geometry = await waitForStableCanvas(
    cdp, 1280, 720, undefined, 45_000, 'renderScale=8 WebGL geometry',
  );
  const backend = await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.backend()`);
  assert(backend.requestedOutputScale === 8 && backend.outputScale === 8,
    `renderScale=8 did not remain true 8x WebGL (${JSON.stringify(backend)})`);
  assertGeometry(geometry, 'renderScale=8 WebGL', 8);
  assertContained(geometry, 'renderScale=8 WebGL');
  assertToolboxGeometry(geometry, 'renderScale=8 WebGL', 68);
  assertCanvasRectsEqual(
    reference.canvas, geometry.canvas, 'renderScale=2/renderScale=8 CSS geometry',
  );
  const resolutionControl = await evaluate(cdp, `(() => {
    const select = document.querySelector('.render-scale-select');
    if (!(select instanceof HTMLSelectElement)) return { options: [], selected: 0 };
    return {
      options: [...select.options].map((option) => Number(option.value)),
      selected: Number(select.value),
    };
  })()`);
  assert(JSON.stringify(resolutionControl.options) === JSON.stringify([1, 2, 4, 8])
    && resolutionControl.selected === 8,
  `renderScale=8 control did not expose/select true 8x (${JSON.stringify(resolutionControl)})`);

  const presentationTiming = await auditWebGLPresentationTiming(cdp, 8, 12_000);
  assert(presentationTiming.p90Ms <= 1500 && presentationTiming.maximumMs <= 2500,
    `renderScale=8 presentation exceeded its watchdog budget (${JSON.stringify(presentationTiming)})`);

  const smoothCapture = await captureSettledPage(cdp, 'renderScale=8 smooth powder framebuffer');
  const styleCaptures = { smooth: smoothCapture.capture.data };
  for (const style of ['local', 'grains']) {
    await evaluate(cdp, `(() => {
      const button = document.querySelector('[data-powder-render-style="${style}"]');
      if (!(button instanceof HTMLButtonElement)) throw new Error('Missing powder style ${style}');
      button.click();
      return true;
    })()`);
    styleCaptures[style] = (await captureSettledPage(
      cdp, `renderScale=8 ${style} powder framebuffer`, 450,
    )).capture.data;
  }
  const grainAnchor = worldClient(geometry.canvas, { x: 190.5, y: 176.5 });
  for (let step = 0; step < 4; step++) await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseWheel', x: grainAnchor.x, y: grainAnchor.y,
    deltaX: 0, deltaY: -240, modifiers: 0,
  });
  const grainView = await waitFor(() => evaluate(cdp, `(() => {
    const view = window.__ANIFOR_INPUT_AUDIT__.viewState();
    return view.zoom >= 4.9 ? view : false;
  })()`), 5_000, 'renderScale=8 high-zoom grain view');
  const zoomedGrainCapture = await captureSettledPage(
    cdp, 'renderScale=8 high-zoom grain framebuffer', 450,
  );
  await evaluate(cdp, 'window.__ANIFOR_INPUT_AUDIT__.resetView(); true');
  await evaluate(cdp, 'window.__ANIFOR_INPUT_AUDIT__.clear(); true');
  const blankCapture = await captureSettledPage(cdp, 'renderScale=8 blank framebuffer');
  assertCanvasRectsEqual(
    geometry.canvas, blankCapture.canvasRect, 'renderScale=8 scene/blank CSS geometry',
  );
  const powderSupport = await sampleSemanticCellSupport(
    cdp, { local: styleCaptures.local, smooth: styleCaptures.smooth },
    blankCapture.capture.data, geometry.canvas, powderColumnCells(),
  );
  assert(powderSupport.local.occupiedRecall === 1
    && powderSupport.smooth.occupiedRecall === 1
    && powderSupport.local.missingOccupiedCells.length === 0
    && powderSupport.smooth.missingOccupiedCells.length === 0
    && powderSupport.local.minimumOccupiedSignal > 8
    && powderSupport.smooth.minimumOccupiedSignal > 8,
  `renderScale=8 Smooth dropped occupied Clay/Concrete cells (${JSON.stringify(powderSupport)})`);
  assert(powderSupport.local.deepHoleLeak <= 0.10
    && powderSupport.smooth.deepHoleLeak <= 0.10,
  `renderScale=8 powder styling filled authored column holes (${JSON.stringify(powderSupport)})`);
  const squareGrain = (await samplePageRegions(
    cdp, styleCaptures.grains,
    [{ name: 'squareGrain8x', x: 190.5, y: 176.5, radiusX: 1.5, radiusY: 1.5,
      topology: true, silhouette: true }],
    blankCapture.capture.data, blankCapture.reference.data, geometry.canvas,
  ))[0];
  const zoomedSquareGrain = await sampleZoomedSquareGrain(
    cdp, zoomedGrainCapture.capture.data, blankCapture.capture.data,
    geometry.canvas, grainAnchor, grainView.zoom,
  );
  assert(squareGrain.dominantComponent >= 0.95 && squareGrain.rectangularFill >= 0.92,
    `renderScale=8 Grains cell fragmented at fit view (${JSON.stringify(squareGrain)})`);
  assert(zoomedSquareGrain.expectedPixels >= 5
    && zoomedSquareGrain.boundingAspect >= 0.90
    && zoomedSquareGrain.boundingAspect <= 1.10
    && zoomedSquareGrain.rectangularFill >= 0.94
    && zoomedSquareGrain.widthRatio >= 0.82 && zoomedSquareGrain.widthRatio <= 1.18
    && zoomedSquareGrain.heightRatio >= 0.82 && zoomedSquareGrain.heightRatio <= 1.18,
  `renderScale=8 Grains cell was not an axis-aligned square (${JSON.stringify(zoomedSquareGrain)})`);
  return {
    requested: backend.requestedOutputScale,
    effective: backend.outputScale,
    backing: `${geometry.backing.width}x${geometry.backing.height}`,
    cssCanvas: `${round(geometry.canvas.width, 2)}x${round(geometry.canvas.height, 2)}`,
    resolutionControl,
    presentationTiming,
    powderSupport,
    squareGrain,
    zoomedSquareGrain,
  };
}

function powderColumnCells() {
  const cells = new Map();
  const add = (minimumX, maximumX, minimumY, maximumY, holes) => {
    for (let y = minimumY; y <= maximumY; y++) for (let x = minimumX; x <= maximumX; x++) {
      const hole = holes.find((candidate) => x >= candidate.x0 && x <= candidate.x1
        && y >= candidate.y0 && y <= candidate.y1);
      cells.set(`${x},${y}`, {
        x, y, occupied: !hole,
        deepHole: Boolean(hole && x === hole.deepX && y > hole.y0 && y < hole.y1),
      });
    }
  };
  add(143, 153, 27, 137, [
    { x0: 143, x1: 145, y0: 61, y1: 64, deepX: 144 },
    { x0: 151, x1: 153, y0: 91, y1: 95, deepX: 152 },
  ]);
  add(158, 168, 39, 137, [
    { x0: 158, x1: 160, y0: 72, y1: 75, deepX: 159 },
    { x0: 166, x1: 168, y0: 108, y1: 112, deepX: 167 },
  ]);
  // The authored foot ledges are deliberately wider than either column. They
  // are one of the fine structures most likely to disappear under a wide
  // powder field, so include their exact final ownership in the cell proof.
  for (let y = 132; y <= 137; y++) for (let x = 140; x <= 171; x++) {
    cells.set(`${x},${y}`, { x, y, occupied: true, deepHole: false });
  }
  return [...cells.values()];
}

async function auditNativeSemantics(cdp, mode, dpr, screenshot) {
  await setDesktopMetrics(cdp, 1280, 720, dpr);
  const query = new URLSearchParams({
    scene: 'render-lab', simulation: 'native', inputAudit: '1', renderScale: '2',
    ...(mode === 'canvas2d' ? { renderer: 'canvas2d' } : {}),
  });
  await cdp.send('Page.navigate', { url: `${ORIGIN}/?${query}` });
  await waitFor(() => evaluate(cdp, `(() => {
    const nativeQuery = new URLSearchParams(location.search).get('simulation') === 'native';
    const nativeStatus = document.querySelector('.status')?.textContent?.includes('direct WebAssembly');
    return nativeQuery && nativeStatus && Boolean(window.__ANIFOR_INPUT_AUDIT__ && document.documentElement);
  })()`), 30_000, `native input audit API (${mode})`);
  await waitFor(() => evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.backend().backend === ${JSON.stringify(mode)}`),
    30_000, `native ${mode} backend`);
  await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.clear(); window.__ANIFOR_INPUT_AUDIT__.setRadius(0); window.__ANIFOR_INPUT_AUDIT__.resetView(); true`);
  await sleep(120);
  const initial = await metrics(cdp);
  assertGeometry(initial, `native ${mode}`);
  assertContained(initial, `native ${mode}`);
  assertToolboxGeometry(initial, `native ${mode}`, 68);

  const screenshots = {};
  const sourcePoint = { x: 250, y: 180 };
  const sourceClient = worldClient(initial.canvas, { x: sourcePoint.x + 0.5, y: sourcePoint.y + 0.5 });
  const sourceSelection = await evaluate(cdp, `(() => {
    const targetButton = document.querySelector('[data-tool-key="material:2"] .material-button');
    targetButton?.click();
    document.querySelector('[data-filter="source"]')?.click();
    const sourceActivator = document.querySelector('[data-tool-key="source:clne"] .material-button');
    sourceActivator?.click();
    const sourceButton = document.querySelector('[data-tool-key="source:clne"] .material-button');
    const output = document.querySelector('.source-selection');
    const library = document.querySelector('.tool-library');
    const sourceRect = sourceButton?.getBoundingClientRect();
    const libraryRect = library?.getBoundingClientRect();
    return {
      value: output?.value, hidden: output?.hidden, target: output?.dataset.target,
      targetButton: { exists: Boolean(targetButton), disabled: targetButton?.disabled },
      sourceButton: { exists: Boolean(sourceButton), disabled: sourceButton?.disabled },
      sourceRect: sourceRect && { width: sourceRect.width, height: sourceRect.height, top: sourceRect.top, bottom: sourceRect.bottom },
      libraryRect: libraryRect && { top: libraryRect.top, bottom: libraryRect.bottom },
      status: document.querySelector('.status')?.textContent,
    };
  })()`);
  assert(sourceSelection.value === 'CLNE → Water' && sourceSelection.hidden === false,
    `${mode}: configured-source readout is ${JSON.stringify(sourceSelection)}`);
  assert(sourceSelection.target === '2', `${mode}: configured-source target metadata is ${sourceSelection.target}`);
  assert(sourceSelection.sourceRect?.width > 0 && sourceSelection.sourceRect?.height > 0,
    `${mode}: configured-source tile is not visibly laid out`);
  assert(sourceSelection.sourceRect.top >= sourceSelection.libraryRect.top - 1
    && sourceSelection.sourceRect.bottom <= sourceSelection.libraryRect.bottom + 1,
  `${mode}: configured-source tile escaped the visible library`);
  if (screenshot) {
    screenshots.configuredSourceScreenshot = variantScreenshotPath(screenshot, 'configured-source');
    const capture = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    await writeFile(screenshots.configuredSourceScreenshot, Buffer.from(capture.data, 'base64'));
  }
  await mouseClick(cdp, sourceClient.x, sourceClient.y, 'left');
  await sleep(80);
  const configuredSource = await evaluate(cdp, `({
    cell: window.__ANIFOR_INPUT_AUDIT__.cell(${sourcePoint.x}, ${sourcePoint.y}),
    target: window.__ANIFOR_INPUT_AUDIT__.sourceTarget(${sourcePoint.x}, ${sourcePoint.y}),
  })`);
  assert(configuredSource.cell === 126, `${mode}: source cell projected as ${configuredSource.cell}`);
  assert(configuredSource.target === 2, `${mode}: source target read back as ${configuredSource.target}`);
  const rejectedSource = await evaluate(cdp, `(() => {
    document.querySelector('[data-filter="all"]')?.click();
    document.querySelector('[data-tool-key="material:146"] .material-button')?.click();
    document.querySelector('[data-filter="source"]')?.click();
    const button = document.querySelector('[data-tool-key="source:pcln"] .material-button');
    button?.click();
    const output = document.querySelector('.source-selection');
    return { value: output?.value, rejected: output?.classList.contains('rejected'), selected: button?.getAttribute('aria-pressed') };
  })()`);
  assert(rejectedSource.value === 'PCLN → PSCN unsupported' && rejectedSource.rejected,
    `${mode}: rejected source pair feedback is ${JSON.stringify(rejectedSource)}`);
  assert(rejectedSource.selected === 'false', `${mode}: rejected source pair became active`);

  const lifePoint = { x: 270, y: 180 };
  const lifeClient = worldClient(initial.canvas, { x: lifePoint.x + 0.5, y: lifePoint.y + 0.5 });
  const lifeSelection = await evaluate(cdp, `(() => {
    window.__ANIFOR_INPUT_AUDIT__.clear();
    document.querySelector('[data-filter="life"]')?.click();
    const activator = document.querySelector('[data-tool-key="life:gol"] .material-button');
    activator?.click();
    const button = document.querySelector('[data-tool-key="life:gol"] .material-button');
    const group = button?.closest('details');
    if (group instanceof HTMLDetailsElement) group.open = true;
    const library = document.querySelector('.tool-library');
    if (button instanceof HTMLElement && library instanceof HTMLElement) {
      const buttonRect = button.getBoundingClientRect();
      const libraryRect = library.getBoundingClientRect();
      library.scrollTop += buttonRect.top - libraryRect.top - library.clientHeight / 2;
    }
    const buttonRect = button?.getBoundingClientRect();
    const libraryRect = library?.getBoundingClientRect();
    return {
      count: document.querySelectorAll('.tool-tile[data-tool-kind="life"]').length,
      exists: Boolean(button), disabled: button?.disabled,
      selected: button?.getAttribute('aria-pressed'), label: button?.textContent?.trim(),
      buttonRect: buttonRect && { width: buttonRect.width, height: buttonRect.height, top: buttonRect.top, bottom: buttonRect.bottom },
      libraryRect: libraryRect && { top: libraryRect.top, bottom: libraryRect.bottom },
      viewportHeight: innerHeight,
    };
  })()`);
  assert(lifeSelection.count === 24, `${mode}: LIFE filter exposed ${lifeSelection.count} presets`);
  assert(lifeSelection.exists && lifeSelection.disabled === false && lifeSelection.selected === 'true',
    `${mode}: GOL LIFE selection failed (${JSON.stringify(lifeSelection)})`);
  assert(lifeSelection.buttonRect?.width > 0 && lifeSelection.buttonRect?.height > 0,
    `${mode}: GOL LIFE tile is not visibly laid out`);
  assert(lifeSelection.buttonRect.top >= lifeSelection.libraryRect.top - 1
    && lifeSelection.buttonRect.bottom <= lifeSelection.libraryRect.bottom + 1
    && lifeSelection.buttonRect.top >= 0 && lifeSelection.buttonRect.bottom <= lifeSelection.viewportHeight,
  `${mode}: GOL LIFE tile is outside the visible library`);
  await mouseClick(cdp, lifeClient.x, lifeClient.y, 'left');
  await sleep(80);
  const lifePreset = await evaluate(cdp, `({
    preset: 0,
    projection: window.__ANIFOR_INPUT_AUDIT__.cell(${lifePoint.x}, ${lifePoint.y}),
    occupied: window.__ANIFOR_INPUT_AUDIT__.occupiedCells(),
  })`);
  assert(lifePreset.projection === 171, `${mode}: GOL LIFE cell projected as ${lifePreset.projection}`);
  assert(lifePreset.occupied === 1, `${mode}: GOL LIFE placement occupied ${lifePreset.occupied} cells`);
  if (screenshot) {
    screenshots.lifeToolsScreenshot = variantScreenshotPath(screenshot, 'life-tools');
    const capture = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    await writeFile(screenshots.lifeToolsScreenshot, Buffer.from(capture.data, 'base64'));
  }

  return {
    configuredSource: { emitter: configuredSource.cell, target: configuredSource.target },
    lifePreset: { preset: lifePreset.preset, projection: lifePreset.projection, visibleTools: lifeSelection.count },
    screenshots,
  };
}

async function auditMobile(cdp, mode, screenshot) {
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
    screenWidth: 390, screenHeight: 844,
    screenOrientation: { type: 'portraitPrimary', angle: 0 },
  });
  const query = new URLSearchParams({
    scene: 'render-lab', inputAudit: '1', blankAudit: '1', renderScale: '2', auditStage: 'mobile',
    ...(mode === 'canvas2d' ? { renderer: 'canvas2d' } : {}),
  });
  await cdp.send('Page.navigate', { url: `${ORIGIN}/?${query}` });
  await waitFor(() => evaluate(cdp, `(() => {
    const parameters = new URLSearchParams(location.search);
    return parameters.get('scene') === 'render-lab'
      && parameters.get('inputAudit') === '1'
      && parameters.get('blankAudit') === '1'
      && parameters.get('renderScale') === '2'
      && parameters.get('auditStage') === 'mobile'
      && Boolean(window.__ANIFOR_INPUT_AUDIT__ && document.documentElement);
  })()`),
    15_000, `mobile input audit API (${mode})`);
  await waitFor(() => evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.backend().backend === ${JSON.stringify(mode)}`),
    15_000, `mobile ${mode} backend`);
  await evaluate(cdp, `window.scrollTo(0, 0); window.__ANIFOR_INPUT_AUDIT__.clear(); window.__ANIFOR_INPUT_AUDIT__.setRadius(0); window.__ANIFOR_INPUT_AUDIT__.setMaterial(164); window.__ANIFOR_INPUT_AUDIT__.resetView(); true`);
  await sleep(350);
  const initial = await metrics(cdp);
  assertGeometry(initial, `mobile ${mode}`);
  assertContained(initial, `mobile ${mode}`);
  assertToolboxGeometry(initial, `mobile ${mode}`, 40);
  assert(filterRows(initial.ui.filterButtons) === 1, 'mobile tool filters are not one row');
  assert(Math.abs(initial.viewport.width - initial.viewport.height) < 1, 'mobile interaction panel is not square');
  assert(initial.ui.fieldIndicator.width <= 133 && initial.ui.fieldIndicator.height <= 52,
    `mobile field indicator is ${round(initial.ui.fieldIndicator.width)}x${round(initial.ui.fieldIndicator.height)}`);
  assert(!rectsOverlap(initial.ui.fieldIndicator, initial.ui.touchHint),
    'mobile field indicator overlaps the touch hint');
  assert(initial.ui.toolboxPaddingBottom >= 24,
    `mobile toolbox has only ${round(initial.ui.toolboxPaddingBottom)}px bottom swipe space`);
  assert(initial.ui.document.scrollHeight > initial.window.height + 40,
    'mobile document has no usable vertical scroll range');
  assert(initial.ui.document.scrollY === 0
    && initial.ui.brushModes.left >= 0 && initial.ui.brushModes.right <= initial.window.width
    && initial.ui.brushModes.top >= 0 && initial.ui.brushModes.bottom <= initial.window.height,
  `mobile Draw/Eraser quick bar is not initially visible (${JSON.stringify(initial.ui.brushModes)})`);
  assert(initial.ui.toolSearch.top >= 0 && initial.ui.toolSearch.bottom <= initial.window.height,
    `mobile tool search is not visible with the quick bar (${JSON.stringify(initial.ui.toolSearch)})`);
  const mobileFilterReach = await evaluate(cdp, `(() => {
    const filters = document.querySelector('.tool-filters');
    const lastFilter = filters?.querySelector('.tool-filter:last-child');
    if (!(filters instanceof HTMLElement) || !(lastFilter instanceof HTMLElement)) {
      throw new Error('Missing mobile filter rail');
    }
    const before = filters.scrollLeft;
    const maximum = Math.max(0, filters.scrollWidth - filters.clientWidth);
    filters.scrollLeft = filters.scrollWidth;
    const railRect = filters.getBoundingClientRect();
    const lastRect = lastFilter.getBoundingClientRect();
    const result = {
      overflow: getComputedStyle(filters).overflowX,
      maximum,
      reached: filters.scrollLeft,
      lastLeft: lastRect.left,
      lastRight: lastRect.right,
      railLeft: railRect.left,
      railRight: railRect.right,
    };
    filters.scrollLeft = before;
    return result;
  })()`);
  assert(mobileFilterReach.overflow === 'auto',
    `mobile filter rail does not scroll horizontally (${mobileFilterReach.overflow})`);
  assert(mobileFilterReach.maximum > 1
    && mobileFilterReach.reached >= mobileFilterReach.maximum - 1,
  `mobile filter rail cannot reach its end (${JSON.stringify(mobileFilterReach)})`);
  assert(mobileFilterReach.lastLeft >= mobileFilterReach.railLeft - 1
    && mobileFilterReach.lastRight <= mobileFilterReach.railRight + 1,
  `mobile filter rail cannot reveal its last filter (${JSON.stringify(mobileFilterReach)})`);
  if (screenshot) {
    const capture = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    await writeFile(screenshot, Buffer.from(capture.data, 'base64'));
  }
  const center = { x: initial.viewport.left + initial.viewport.width / 2, y: initial.viewport.top + initial.viewport.height / 2 };
  const pinchTranslation = 22;
  const start = [touch(1, center.x - 58, center.y), touch(2, center.x + 58, center.y)];
  const movedCenter = { x: center.x + pinchTranslation, y: center.y };
  const moved = [
    touch(1, movedCenter.x - 83, movedCenter.y),
    touch(2, movedCenter.x + 83, movedCenter.y),
  ];
  const pinchAnchorBefore = await screenWorld(cdp, center);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: start });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: moved });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(100);
  const pinch = await evaluate(cdp, `({ view: window.__ANIFOR_INPUT_AUDIT__.viewState(), occupied: window.__ANIFOR_INPUT_AUDIT__.occupiedCells() })`);
  const pinchAnchorAfter = await screenWorld(cdp, movedCenter);
  const pinchAnchorError = Math.hypot(
    pinchAnchorAfter.x - pinchAnchorBefore.x,
    pinchAnchorAfter.y - pinchAnchorBefore.y,
  );
  assert(pinch.view.zoom > 1.35, 'mobile pinch did not zoom');
  assert(Math.abs(pinch.view.panX - pinchTranslation) < 0.2,
    `mobile pinch-pan X mismatch (${pinch.view.panX})`);
  assert(pinchAnchorError < 0.2,
    `mobile pinch anchor drifted ${pinchAnchorError.toFixed(4)} cells`);
  assert(pinch.occupied === 0, `mobile pinch painted ${pinch.occupied} stray cells`);

  await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.clear(); window.__ANIFOR_INPUT_AUDIT__.resetView(); true`);
  await sleep(60);
  const reset = await metrics(cdp);
  const target = { x: 210, y: 102 };
  const client = worldClient(reset.canvas, { x: target.x + 0.5, y: target.y + 0.5 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch(3, client.x, client.y)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(100);
  const tap = await evaluate(cdp, `({ cell: window.__ANIFOR_INPUT_AUDIT__.cell(${target.x}, ${target.y}), occupied: window.__ANIFOR_INPUT_AUDIT__.occupiedCells() })`);
  assert(tap.cell > 0 && tap.occupied === 1, `mobile single-touch tap missed exact cell (${tap.cell}, ${tap.occupied})`);
  const paintedFootprints = await capturePaintedFootprints(cdp, [target], `mobile ${mode}`, 1);

  const eraserButton = await evaluate(cdp, `(() => {
    const button = document.querySelector('.brush-mode-bar .brush-mode[data-erase="true"]');
    if (!(button instanceof HTMLButtonElement)) throw new Error('Missing mobile Eraser button');
    const rect = button.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
      disabled: button.disabled,
    };
  })()`);
  assert(!eraserButton.disabled && eraserButton.left >= 0 && eraserButton.right <= initial.window.width
    && eraserButton.top >= 0 && eraserButton.bottom <= initial.window.height,
  `mobile Eraser button is not reachable (${JSON.stringify(eraserButton)})`);
  await mouseClick(cdp, eraserButton.x, eraserButton.y, 'left');
  const eraserSelected = await evaluate(cdp, `(() => {
    const erase = document.querySelector('.brush-mode[data-erase="true"]');
    const draw = document.querySelector('.brush-mode[data-erase="false"]');
    return {
      erase: erase?.getAttribute('aria-pressed'),
      draw: draw?.getAttribute('aria-pressed'),
    };
  })()`);
  assert(eraserSelected.erase === 'true' && eraserSelected.draw === 'false',
    `mobile Eraser mode did not select (${JSON.stringify(eraserSelected)})`);

  await evaluate(cdp, 'window.scrollTo(0, 0); true');
  await sleep(60);
  const eraseGeometry = await metrics(cdp);
  const eraseClient = worldClient(eraseGeometry.canvas, { x: target.x + 0.5, y: target.y + 0.5 });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [touch(4, eraseClient.x, eraseClient.y)],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(100);
  const erased = await evaluate(cdp, `({
    cell: window.__ANIFOR_INPUT_AUDIT__.cell(${target.x}, ${target.y}),
    occupied: window.__ANIFOR_INPUT_AUDIT__.occupiedCells(),
  })`);
  assert(erased.cell === 0 && erased.occupied === 0,
    `mobile Eraser touch left cell ${target.x},${target.y} occupied (${JSON.stringify(erased)})`);

  const drawButton = await evaluate(cdp, `(() => {
    const button = document.querySelector('.brush-mode-bar .brush-mode[data-erase="false"]');
    if (!(button instanceof HTMLButtonElement)) throw new Error('Missing mobile Draw button');
    const rect = button.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  await mouseClick(cdp, drawButton.x, drawButton.y, 'left');
  const drawSelected = await evaluate(cdp, `(() => {
    const erase = document.querySelector('.brush-mode[data-erase="true"]');
    const draw = document.querySelector('.brush-mode[data-erase="false"]');
    window.scrollTo(0, 0);
    return {
      erase: erase?.getAttribute('aria-pressed'),
      draw: draw?.getAttribute('aria-pressed'),
    };
  })()`);
  assert(drawSelected.draw === 'true' && drawSelected.erase === 'false',
    `mobile Draw mode was not restored (${JSON.stringify(drawSelected)})`);

  await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.clear(); window.__ANIFOR_INPUT_AUDIT__.resetView(); true`);
  await sleep(60);
  const strokeGeometry = await metrics(cdp);
  const strokeLandmarks = [{ x: 96, y: 92 }, { x: 108, y: 92 }, { x: 120, y: 92 }];
  const strokeClients = strokeLandmarks.map((landmark) => worldClient(
    strokeGeometry.canvas, { x: landmark.x + 0.5, y: landmark.y + 0.5 },
  ));
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [touch(5, strokeClients[0].x, strokeClients[0].y)],
  });
  for (const point of strokeClients.slice(1)) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [touch(5, point.x, point.y)],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(100);
  const continuousTouch = await evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const row = [];
    for (let x = 96; x <= 120; x++) row.push(audit.cell(x, 92));
    return {
      landmarks: ${JSON.stringify([{ x: 96, y: 92 }, { x: 108, y: 92 }, { x: 120, y: 92 }])}
        .map(({ x, y }) => audit.cell(x, y)),
      row,
      occupied: audit.occupiedCells(),
    };
  })()`);
  assert(continuousTouch.landmarks.every((cell) => cell > 0)
    && continuousTouch.row.every((cell) => cell > 0),
  `mobile continuous touch missed semantic landmarks (${JSON.stringify(continuousTouch)})`);
  assert(continuousTouch.occupied >= 25 && continuousTouch.occupied <= 27,
    `mobile continuous touch painted an unbounded footprint (${continuousTouch.occupied} cells)`);

  const mobileLibrary = await evaluate(cdp, `(() => {
    const library = document.querySelector('.tool-library');
    const group = library?.querySelector('.material-group[open]');
    const lastTile = group?.querySelector('.tool-tile:last-child');
    if (!(library instanceof HTMLElement) || !(group instanceof HTMLElement)
      || !(lastTile instanceof HTMLElement)) {
      throw new Error('Missing mobile tool library');
    }
    library.scrollTop = 0;
    const initialLibraryRect = library.getBoundingClientRect();
    const initialTileRect = lastTile.getBoundingClientRect();
    library.scrollTop = Math.min(
      library.scrollHeight - library.clientHeight,
      Math.max(0, initialTileRect.bottom - initialLibraryRect.bottom + 1),
    );
    const libraryRect = library.getBoundingClientRect();
    const tileRect = lastTile.getBoundingClientRect();
    return {
      clientHeight: library.clientHeight,
      scrollHeight: library.scrollHeight,
      scrollTop: library.scrollTop,
      tileTop: tileRect.top,
      tileBottom: tileRect.bottom,
      libraryTop: libraryRect.top,
      libraryBottom: libraryRect.bottom,
      overscrollBehaviorY: getComputedStyle(library).overscrollBehaviorY,
    };
  })()`);
  assert(mobileLibrary.scrollHeight > mobileLibrary.clientHeight,
    'mobile tool library has no vertical scroll range');
  assert(mobileLibrary.overscrollBehaviorY === 'auto',
    `mobile tool library blocks page scroll chaining (${mobileLibrary.overscrollBehaviorY})`);
  assert(mobileLibrary.scrollTop > 0
    && mobileLibrary.tileTop >= mobileLibrary.libraryTop - 1
    && mobileLibrary.tileBottom <= mobileLibrary.libraryBottom + 1,
  'mobile tool library cannot reveal the last tile in an open group');
  const scrollStart = await evaluate(cdp, `(() => {
    const library = document.querySelector('.tool-library');
    if (!(library instanceof HTMLElement)) throw new Error('Missing mobile tool library');
    window.scrollTo(0, document.documentElement.scrollHeight);
    library.scrollTop = 0;
    const rect = library.getBoundingClientRect();
    const visibleTop = Math.max(0, rect.top);
    const visibleBottom = Math.min(innerHeight, rect.bottom);
    const minimumY = visibleTop + 6;
    const maximumY = Math.min(visibleBottom - 6, innerHeight - 130);
    if (maximumY < minimumY) throw new Error('Mobile tool library has no visible swipe target');
    return {
      x: Math.max(rect.left + 6, Math.min(rect.right - 6, rect.left + rect.width / 2)),
      y: Math.max(minimumY, Math.min(maximumY, (visibleTop + visibleBottom) / 2)),
      library: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      scrollY,
    };
  })()`);
  const availablePageScroll = scrollStart.scrollY;
  assert(availablePageScroll > 30,
    `mobile palette exposes only ${round(availablePageScroll)}px upward page-scroll range`);
  assert(scrollStart.x >= scrollStart.library.left && scrollStart.x <= scrollStart.library.right
    && scrollStart.y >= scrollStart.library.top && scrollStart.y <= scrollStart.library.bottom,
  `mobile nested-scroll swipe did not start inside the tool library (${JSON.stringify(scrollStart)})`);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [touch(6, scrollStart.x, scrollStart.y)],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove', touchPoints: [touch(6, scrollStart.x, scrollStart.y + 120)],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(320);
  const touchScrollY = await evaluate(cdp, 'scrollY');
  assert(touchScrollY < scrollStart.scrollY - Math.min(30, availablePageScroll * 0.5),
    `mobile page swipe did not scroll the toolbox (${scrollStart.scrollY} -> ${touchScrollY})`);
  const footer = await evaluate(cdp, `(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const rect = document.querySelector('.footer')?.getBoundingClientRect();
    return rect ? { top: rect.top, bottom: rect.bottom, scrollY } : undefined;
  })()`);
  assert(footer && footer.top >= -1 && footer.bottom <= initial.window.height + 1,
    `mobile footer is not reachable (${JSON.stringify(footer)})`);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 360, height: 640, deviceScaleFactor: 2, mobile: true,
    screenWidth: 360, screenHeight: 640,
    screenOrientation: { type: 'portraitPrimary', angle: 0 },
  });
  await evaluate(cdp, 'window.scrollTo(0, 0); true');
  const compact = await waitFor(async () => {
    const current = await metrics(cdp);
    return current.window.width === 360 && current.window.height === 640 ? current : false;
  }, 5_000, `compact mobile geometry (${mode})`);
  assertGeometry(compact, `compact mobile ${mode}`);
  assertContained(compact, `compact mobile ${mode}`);
  assert(compact.ui.brushModes.left >= 0 && compact.ui.brushModes.right <= compact.window.width
    && compact.ui.brushModes.top >= 0 && compact.ui.brushModes.bottom <= compact.window.height,
  `compact mobile Draw/Eraser quick bar is not initially visible (${JSON.stringify(compact.ui.brushModes)})`);
  assert(compact.ui.toolSearch.top >= 0 && compact.ui.toolSearch.bottom <= compact.window.height,
    `compact mobile tool search is not visible with the quick bar (${JSON.stringify(compact.ui.toolSearch)})`);
  return {
    viewport: `${round(initial.viewport.width, 2)}x${round(initial.viewport.height, 2)}`,
    canvasAspect: round(initial.canvas.width / initial.canvas.height, 6),
    pinchZoom: round(pinch.view.zoom, 4),
    pinchPanX: round(pinch.view.panX, 3),
    pinchAnchorErrorCells: round(pinchAnchorError, 5),
    pinchStrayCells: pinch.occupied,
    singleTouchCell: `${target.x},${target.y}`,
    paintedFootprints,
    continuousTouchCells: continuousTouch.occupied,
    continuousTouchLandmarks: strokeLandmarks.map(({ x, y }) => `${x},${y}`),
    eraserTouchCell: `${target.x},${target.y}`,
    quickModeBar: `${round(initial.ui.brushModes.width)}x${round(initial.ui.brushModes.height)}`,
    compactQuickModeBar: `${round(compact.ui.brushModes.width)}x${round(compact.ui.brushModes.height)}`,
    mobileFilterScroll: `${round(mobileFilterReach.reached)}/${round(mobileFilterReach.maximum)}`,
    toolFilterHeight: round(initial.ui.filters.height),
    toolboxGap: round(initial.ui.actions.top - initial.ui.palette.bottom),
    horizontalOverflow: round(initial.ui.horizontalOverflow),
    fieldIndicator: `${round(initial.ui.fieldIndicator.width)}x${round(initial.ui.fieldIndicator.height)}`,
    libraryScroll: `${round(mobileLibrary.scrollTop)}/${round(mobileLibrary.scrollHeight - mobileLibrary.clientHeight)}`,
    touchScroll: `${round(scrollStart.scrollY)}->${round(touchScrollY)}`,
    nestedScrollStart: `${round(scrollStart.x)},${round(scrollStart.y)}`,
    footerScrollY: round(footer.scrollY),
    ...(screenshot ? { screenshot } : {}),
  };
}

async function setDesktopMetrics(cdp, width, height, dpr) {
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: dpr, mobile: false,
    screenWidth: width, screenHeight: height,
  });
}

async function waitForStableCanvas(cdp, width, height, previous, timeoutMs, label) {
  let last;
  let stableSamples = 0;
  return waitFor(async () => {
    const current = await metrics(cdp);
    if (current.window.width !== width || current.window.height !== height) return false;
    const expectedWidth = Math.min(current.viewport.width, current.viewport.height * WORLD_ASPECT);
    const expectedHeight = expectedWidth / WORLD_ASPECT;
    if (Math.abs(current.canvas.width - expectedWidth) > 0.75
      || Math.abs(current.canvas.height - expectedHeight) > 0.75) return false;
    if (previous && Math.abs(current.canvas.width - previous.canvas.width) <= 1
      && Math.abs(current.canvas.height - previous.canvas.height) <= 1) return false;
    if (last
      && Math.abs(current.canvas.width - last.canvas.width) < 0.05
      && Math.abs(current.canvas.height - last.canvas.height) < 0.05
      && Math.abs(current.viewport.width - last.viewport.width) < 0.05
      && Math.abs(current.viewport.height - last.viewport.height) < 0.05) stableSamples++;
    else stableSamples = 0;
    last = current;
    return stableSamples >= 4 ? current : false;
  }, timeoutMs, `${label} stable canvas resize`);
}

async function waitForStableZoomedCamera(cdp, width, height, previous, expectedZoom, timeoutMs, label) {
  let last;
  let stableSamples = 0;
  return waitFor(async () => {
    const current = await metrics(cdp);
    if (current.window.width !== width || current.window.height !== height) return false;
    if (Math.abs(current.viewport.width - previous.viewport.width) <= 1
      && Math.abs(current.viewport.height - previous.viewport.height) <= 1) return false;
    const view = await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.viewState()`);
    if (Math.abs(view.zoom - expectedZoom) > 0.001) return false;
    if (last
      && Math.abs(current.canvas.width - last.canvas.width) < 0.05
      && Math.abs(current.canvas.height - last.canvas.height) < 0.05
      && Math.abs(current.viewport.width - last.viewport.width) < 0.05
      && Math.abs(current.viewport.height - last.viewport.height) < 0.05
      && Math.abs(view.panX - last.view.panX) < 0.05
      && Math.abs(view.panY - last.view.panY) < 0.05) stableSamples++;
    else stableSamples = 0;
    last = { ...current, view };
    return stableSamples >= 4 ? current : false;
  }, timeoutMs, `${label} stable zoomed resize`);
}

async function metrics(cdp) {
  return evaluate(cdp, `(() => {
    const canvas = [...document.querySelectorAll('canvas.world-canvas')]
      .find((candidate) => candidate.getBoundingClientRect().width > 0);
    const viewport = document.querySelector('.viewport');
    const frame = document.querySelector('.viewport-frame');
    const palette = document.querySelector('.palette');
    const actions = document.querySelector('.actions');
    const filters = document.querySelector('.tool-filters');
    const shell = document.querySelector('.shell');
    const workspace = document.querySelector('.workspace');
    const toolbox = document.querySelector('.toolbox');
    const library = document.querySelector('.tool-library');
    const footer = document.querySelector('.footer');
    const fieldIndicator = document.querySelector('.field-indicator');
    const touchHint = document.querySelector('.touch-hint');
    const brushModes = document.querySelector('.brush-mode-bar');
    const toolSearch = document.querySelector('.tool-search');
    const filterButtons = [...document.querySelectorAll('.tool-filter')];
    if (!canvas || !viewport || !frame || !palette || !actions || !filters || !shell || !workspace || !toolbox
      || !library || !footer || !fieldIndicator || !touchHint || !brushModes || !toolSearch || !filterButtons.length) {
      throw new Error('Missing browser-audit geometry');
    }
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
    };
    return {
      canvas: box(canvas), viewport: box(viewport), frame: box(frame),
      logical: { width: canvas.offsetWidth, height: canvas.offsetHeight, worldSize: canvas.dataset.worldSize },
      backing: { width: canvas.width, height: canvas.height },
      outputScale: canvas.dataset.outputScale,
      backend: window.__ANIFOR_INPUT_AUDIT__.backend(),
      dpr: devicePixelRatio, window: { width: innerWidth, height: innerHeight },
      ui: {
        shell: box(shell), workspace: box(workspace), toolbox: box(toolbox), palette: box(palette), actions: box(actions), filters: box(filters),
        library: box(library), footer: box(footer), fieldIndicator: box(fieldIndicator), touchHint: box(touchHint),
        brushModes: box(brushModes), toolSearch: box(toolSearch),
        filterButtons: filterButtons.map(box),
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        toolboxPaddingBottom: Number.parseFloat(getComputedStyle(toolbox).paddingBottom) || 0,
        document: { scrollHeight: document.documentElement.scrollHeight, scrollY },
      },
    };
  })()`);
}

function assertGeometry(value, label, outputScale = 2) {
  assert(Math.abs(value.canvas.width / value.canvas.height - WORLD_ASPECT) < 0.0001, `${label}: canvas aspect changed`);
  assert(value.logical.width === WORLD_WIDTH && value.logical.height === WORLD_HEIGHT,
    `${label}: logical canvas is ${value.logical.width}x${value.logical.height}`);
  assert(value.logical.worldSize === `${WORLD_WIDTH}x${WORLD_HEIGHT}`,
    `${label}: worldSize is ${value.logical.worldSize}`);
  assert(value.backing.width === WORLD_WIDTH * outputScale && value.backing.height === WORLD_HEIGHT * outputScale,
    `${label}: backing is ${value.backing.width}x${value.backing.height}`);
  assert(value.outputScale === String(outputScale), `${label}: outputScale is ${value.outputScale}`);
}

function assertContained(value, label) {
  const tolerance = 0.75;
  assert(value.canvas.left >= value.viewport.left - tolerance, `${label}: canvas escaped left`);
  assert(value.canvas.top >= value.viewport.top - tolerance, `${label}: canvas escaped top`);
  assert(value.canvas.right <= value.viewport.right + tolerance, `${label}: canvas escaped right`);
  assert(value.canvas.bottom <= value.viewport.bottom + tolerance, `${label}: canvas escaped bottom`);
}

function assertToolboxGeometry(value, label, expectedFilterHeight) {
  const tolerance = 0.75;
  const gap = value.ui.actions.top - value.ui.palette.bottom;
  assert(gap >= -tolerance, `${label}: actions overlap tool palette by ${round(-gap)}px`);
  assert(value.ui.palette.top >= value.ui.toolbox.top - tolerance
    && value.ui.actions.bottom <= value.ui.toolbox.bottom + tolerance,
  `${label}: toolbox content escaped its layout box`);
  assert(value.ui.library.top >= value.ui.palette.top - tolerance
    && value.ui.library.bottom <= value.ui.palette.bottom + tolerance,
  `${label}: tool library escaped the palette`);
  assert(Math.abs(value.ui.filters.height - expectedFilterHeight) <= tolerance,
    `${label}: tool filter rail is ${round(value.ui.filters.height)}px`);
  for (const button of value.ui.filterButtons) {
    assert(button.top >= value.ui.filters.top - tolerance
      && button.bottom <= value.ui.filters.bottom + tolerance,
    `${label}: a tool filter escaped the fixed-height rail`);
  }
  assert(value.ui.horizontalOverflow <= tolerance,
    `${label}: document has ${round(value.ui.horizontalOverflow)}px horizontal overflow`);
}

function rectsOverlap(left, right) {
  return left.left < right.right && left.right > right.left
    && left.top < right.bottom && left.bottom > right.top;
}

function canvasRectsEqual(left, right, tolerance = 0.05) {
  return Math.abs(left.left - right.left) <= tolerance
    && Math.abs(left.top - right.top) <= tolerance
    && Math.abs(left.width - right.width) <= tolerance
    && Math.abs(left.height - right.height) <= tolerance;
}

function assertCanvasRectsEqual(left, right, label) {
  assert(canvasRectsEqual(left, right),
    `${label}: canvas geometry changed (${JSON.stringify({ canonical: left, blank: right })})`);
}

function filterRows(buttons) {
  return new Set(buttons.map((button) => round(button.top, 1))).size;
}

function worldClient(rect, world) {
  return {
    x: rect.left + world.x / WORLD_WIDTH * rect.width,
    y: rect.top + world.y / WORLD_HEIGHT * rect.height,
  };
}

async function screenWorld(cdp, point) {
  return evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.screenToWorld(${point.x}, ${point.y})`);
}

async function waitForStablePageCaptures(cdp, label, timeoutMs = 8_000) {
  let previous;
  let stableSamples = 0;
  return waitFor(async () => {
    // One volume-field interval must elapse between samples. Otherwise two
    // captures can agree briefly while another staggered field is still due.
    await sleep(100);
    const capture = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    const canvasRect = await evaluate(cdp, `(() => {
      const canvas = document.querySelector('.world-canvas');
      if (!(canvas instanceof HTMLCanvasElement)) return undefined;
      const rect = canvas.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    })()`);
    if (!canvasRect) return false;
    const reference = previous;
    if (reference?.capture.data === capture.data
      && canvasRectsEqual(reference.canvasRect, canvasRect)) stableSamples++;
    else stableSamples = 0;
    previous = { capture, canvasRect };
    return stableSamples >= 2
      ? { capture, reference: reference.capture, canvasRect, referenceCanvasRect: reference.canvasRect }
      : false;
  }, timeoutMs, label);
}

async function waitForStablePageCapture(cdp, label, timeoutMs) {
  return waitForStablePageCaptures(cdp, label, timeoutMs);
}

async function captureSettledPage(cdp, label, delayMs = 900) {
  // SwiftShader's 15M-fragment 8x target can dither otherwise identical page
  // captures by a byte, so exact whole-frame equality is not a useful settle
  // criterion here. Wait through every staggered 12 Hz field rebuild, then take
  // two bounded captures; downstream blank-differenced material metrics tolerate
  // sub-byte noise and prove the actual fixture instead.
  await sleep(delayMs);
  const capture = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await sleep(150);
  const reference = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const canvasRect = await evaluate(cdp, `(() => {
    const canvas = document.querySelector('.world-canvas');
    if (!(canvas instanceof HTMLCanvasElement)) return undefined;
    const rect = canvas.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  })()`);
  if (!canvasRect) throw new Error(`${label}: world canvas unavailable`);
  return { capture, reference, canvasRect, referenceCanvasRect: canvasRect };
}

async function captureStableBlankPage(cdp, mode) {
  const query = new URLSearchParams({
    scene: 'render-lab', inputAudit: '1', blankAudit: '1', renderScale: '2', auditStage: 'blank',
    ...(mode === 'canvas2d' ? { renderer: 'canvas2d' } : {}),
  });
  await cdp.send('Page.navigate', { url: `${ORIGIN}/?${query}` });
  await waitFor(() => evaluate(cdp, `(() => {
    const parameters = new URLSearchParams(location.search);
    return parameters.get('scene') === 'render-lab'
      && parameters.get('inputAudit') === '1'
      && parameters.get('blankAudit') === '1'
      && parameters.get('renderScale') === '2'
      && parameters.get('auditStage') === 'blank'
      && Boolean(window.__ANIFOR_INPUT_AUDIT__ && document.documentElement);
  })()`),
    15_000, `blank input audit API (${mode})`);
  await waitFor(() => evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.backend().backend === ${JSON.stringify(mode)}`),
    15_000, `blank ${mode} backend`);
  return waitForStablePageCaptures(cdp, `${mode} blank framebuffer`);
}

async function sampleCapsuleContourCrossings(
  cdp, screenshotBase64, baselineBase64, captureCanvasRect,
) {
  return evaluate(cdp, `(async () => {
    const sources = {
      rendered: ${JSON.stringify(`data:image/png;base64,${screenshotBase64}`)},
      baseline: ${JSON.stringify(`data:image/png;base64,${baselineBase64}`)},
    };
    const contexts = {};
    let imageWidth = 0;
    let imageHeight = 0;
    for (const [name, source] of Object.entries(sources)) {
      const image = new Image();
      image.src = source;
      await image.decode();
      if (imageWidth && (image.naturalWidth !== imageWidth || image.naturalHeight !== imageHeight)) {
        throw new Error('Contour screenshot geometry mismatch');
      }
      imageWidth = image.naturalWidth;
      imageHeight = image.naturalHeight;
      const copy = document.createElement('canvas');
      copy.width = imageWidth;
      copy.height = imageHeight;
      const context = copy.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Contour sampler unavailable');
      context.drawImage(image, 0, 0);
      contexts[name] = context;
    }
    const bounds = ${JSON.stringify(captureCanvasRect)};
    const pageScaleX = imageWidth / innerWidth;
    const pageScaleY = imageHeight / innerHeight;
    const worldScaleX = bounds.width / ${WORLD_WIDTH};
    const worldScaleY = bounds.height / ${WORLD_HEIGHT};
    const pixelForWorldX = (x) => (bounds.left + x * worldScaleX) * pageScaleX;
    const pixelForWorldY = (y) => (bounds.top + y * worldScaleY) * pageScaleY;
    const worldForPixelX = (x) => (x / pageScaleX - bounds.left) / worldScaleX;
    const worldForPixelY = (y) => (y / pageScaleY - bounds.top) / worldScaleY;
    const signalAt = (x, y) => {
      const rendered = contexts.rendered.getImageData(x, y, 1, 1).data;
      const baseline = contexts.baseline.getImageData(x, y, 1, 1).data;
      return Math.max(
        Math.abs(rendered[0] - baseline[0]),
        Math.abs(rendered[1] - baseline[1]),
        Math.abs(rendered[2] - baseline[2]),
      );
    };
    const rows = [];
    const firstPixelY = Math.max(0, Math.ceil(pixelForWorldY(164.25)));
    const lastPixelY = Math.min(imageHeight - 1, Math.floor(pixelForWorldY(180.75)));
    for (let pixelY = firstPixelY; pixelY <= lastPixelY; pixelY++) {
      // Fixture coordinates name semantic cell centres, while screenshot pixels
      // map through the cell rectangle. Removing the half-cell offset makes the
      // analytic circle and the authored splitCapsule use the same convention.
      const worldY = worldForPixelY(pixelY + 0.5) - 0.5;
      if (worldY < 164 || worldY > 180) continue;
      const startX = Math.max(0, Math.floor(pixelForWorldX(262)));
      const endX = Math.min(imageWidth - 1, Math.ceil(pixelForWorldX(286)));
      const interiorStart = Math.max(startX, Math.floor(pixelForWorldX(280)));
      const interiorSignals = [];
      for (let pixelX = interiorStart; pixelX <= endX; pixelX++) {
        interiorSignals.push(signalAt(pixelX, pixelY));
      }
      interiorSignals.sort((left, right) => left - right);
      const interiorSignal = interiorSignals[Math.floor((interiorSignals.length - 1) * 0.5)];
      if (interiorSignal <= 8) throw new Error('Capsule contour interior disappeared');
      const samples = [];
      for (let pixelX = startX; pixelX <= endX; pixelX++) {
        samples.push({
          pixelX,
          amount: Math.max(0, Math.min(1, (signalAt(pixelX, pixelY) - 4) / (interiorSignal - 4))),
        });
      }
      const crossing = (level) => {
        for (let index = 1; index < samples.length; index++) {
          if (samples[index].amount < level) continue;
          const previous = samples[index - 1];
          const current = samples[index];
          const span = Math.max(0.000001, current.amount - previous.amount);
          const pixelX = previous.pixelX + (level - previous.amount) / span;
          return worldForPixelX(pixelX);
        }
        throw new Error('Capsule contour crossing disappeared');
      };
      const x20 = crossing(0.20);
      const x50 = crossing(0.50);
      const x80 = crossing(0.80);
      const expected = 278 - Math.sqrt(144 - (worldY - 172) ** 2);
      const semanticY = Math.floor(worldY + 0.5);
      const rawExpected = Math.ceil(278 - Math.sqrt(144 - (semanticY - 172) ** 2));
      rows.push({
        worldY, x20, x50, x80, expected, rawExpected,
        error: x50 - expected, rawError: rawExpected - expected,
      });
    }
    const rmsError = Math.sqrt(rows.reduce((sum, row) => sum + row.error ** 2, 0) / rows.length);
    const rawRmsError = Math.sqrt(
      rows.reduce((sum, row) => sum + row.rawError ** 2, 0) / rows.length,
    );
    const maximumError = Math.max(...rows.map((row) => Math.abs(row.error)));
    const meanTransitionWidth = rows.reduce((sum, row) => sum + row.x80 - row.x20, 0) / rows.length;
    let maximumSymmetryError = 0;
    for (const row of rows) {
      const mirrorY = 344 - row.worldY;
      const mirror = rows.reduce((nearest, candidate) => (
        Math.abs(candidate.worldY - mirrorY) < Math.abs(nearest.worldY - mirrorY)
          ? candidate : nearest
      ), rows[0]);
      maximumSymmetryError = Math.max(maximumSymmetryError, Math.abs(row.x50 - mirror.x50));
    }
    let monotonicSlack = 0;
    let tangentError = 0;
    let rawTangentError = 0;
    for (let index = 1; index < rows.length; index++) {
      const previous = rows[index - 1];
      const current = rows[index];
      const expectedDelta = current.expected - previous.expected;
      tangentError += Math.abs((current.x50 - previous.x50) - expectedDelta);
      rawTangentError += Math.abs((current.rawExpected - previous.rawExpected) - expectedDelta);
      if (current.worldY <= 172) {
        monotonicSlack = Math.max(monotonicSlack, current.x50 - previous.x50);
      } else if (previous.worldY >= 172) {
        monotonicSlack = Math.max(monotonicSlack, previous.x50 - current.x50);
      }
    }
    const meanTangentError = tangentError / Math.max(1, rows.length - 1);
    const rawMeanTangentError = rawTangentError / Math.max(1, rows.length - 1);
    return {
      rows: rows.map((row) => ({
        y: Math.round(row.worldY * 1000) / 1000,
        x50: Math.round(row.x50 * 1000) / 1000,
        expected: Math.round(row.expected * 1000) / 1000,
        width20to80: Math.round((row.x80 - row.x20) * 1000) / 1000,
      })),
      rmsError: Math.round(rmsError * 1000) / 1000,
      rawRmsError: Math.round(rawRmsError * 1000) / 1000,
      maximumError: Math.round(maximumError * 1000) / 1000,
      meanTransitionWidth: Math.round(meanTransitionWidth * 1000) / 1000,
      maximumSymmetryError: Math.round(maximumSymmetryError * 1000) / 1000,
      monotonicSlack: Math.round(monotonicSlack * 1000) / 1000,
      meanTangentError: Math.round(meanTangentError * 1000) / 1000,
      rawMeanTangentError: Math.round(rawMeanTangentError * 1000) / 1000,
    };
  })()`);
}

async function sampleLightingDifferenceRegions(cdp, screenshots, regions, captureCanvasRect) {
  return evaluate(cdp, `(async () => {
    const sources = ${JSON.stringify(Object.fromEntries(
    Object.entries(screenshots).map(([name, data]) => [name, `data:image/png;base64,${data}`]),
  ))};
    const images = {};
    const contexts = {};
    for (const [name, source] of Object.entries(sources)) {
      const image = new Image();
      image.src = source;
      await image.decode();
      images[name] = image;
    }
    const geometry = [images.lit, images.unlit]
      .map((image) => [image.naturalWidth, image.naturalHeight]);
    if (!geometry.every(([width, height]) => width === geometry[0][0] && height === geometry[0][1])) {
      throw new Error('Lighting screenshot geometry mismatch');
    }
    for (const [name, image] of Object.entries(images)) {
      const copy = document.createElement('canvas');
      copy.width = image.naturalWidth;
      copy.height = image.naturalHeight;
      const context = copy.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Lighting screenshot sampler unavailable');
      context.drawImage(image, 0, 0);
      contexts[name] = context;
    }
    const bounds = ${JSON.stringify(captureCanvasRect)};
    const pageScaleX = images.lit.naturalWidth / innerWidth;
    const pageScaleY = images.lit.naturalHeight / innerHeight;
    const worldScaleX = bounds.width / ${WORLD_WIDTH};
    const worldScaleY = bounds.height / ${WORLD_HEIGHT};
    return ${JSON.stringify(regions)}.map((region) => {
      const radiusX = region.radiusX ?? region.radius ?? 3;
      const radiusY = region.radiusY ?? region.radius ?? 3;
      const x = Math.floor((bounds.left + (region.x - radiusX) * worldScaleX) * pageScaleX);
      const y = Math.floor((bounds.top + (region.y - radiusY) * worldScaleY) * pageScaleY);
      const width = Math.max(1, Math.ceil(radiusX * 2 * worldScaleX * pageScaleX));
      const height = Math.max(1, Math.ceil(radiusY * 2 * worldScaleY * pageScaleY));
      const data = Object.fromEntries(Object.entries(contexts).map(([name, context]) => [
        name, context.getImageData(x, y, width, height).data,
      ]));
      const signed = [0, 0, 0];
      const positive = [0, 0, 0];
      const screenNormalizedPositive = [0, 0, 0];
      let visible = 0;
      let peakMagnitude = 0;
      for (let offset = 0; offset < data.lit.length; offset += 4) {
        let magnitude = 0;
        for (let channel = 0; channel < 3; channel++) {
          const response = data.lit[offset + channel] - data.unlit[offset + channel];
          signed[channel] += response;
          positive[channel] += Math.max(0, response);
          screenNormalizedPositive[channel] += Math.max(0, response)
            / Math.max(1, 255 - data.unlit[offset + channel]) * 255;
          magnitude = Math.max(magnitude, Math.abs(response));
        }
        if (magnitude >= 4) visible++;
        peakMagnitude = Math.max(peakMagnitude, magnitude);
      }
      const count = Math.max(1, width * height);
      return {
        name: region.name,
        responseRgb: signed.map((channel) => Math.round(channel / count * 100) / 100),
        positiveRgb: positive.map((channel) => Math.round(channel / count * 100) / 100),
        screenNormalizedPositiveRgb: screenNormalizedPositive
          .map((channel) => Math.round(channel / count * 100) / 100),
        coverage: Math.round(visible / count * 1000) / 1000,
        peakMagnitude,
      };
    });
  })()`);
}

async function sampleBackdropRefractionRegions(cdp, screenshots, regions, captureCanvasRect) {
  return evaluate(cdp, `(async () => {
    const sources = ${JSON.stringify(Object.fromEntries(
    Object.entries(screenshots).map(([name, data]) => [name, `data:image/png;base64,${data}`]),
  ))};
    const contexts = {};
    let imageWidth = 0;
    let imageHeight = 0;
    for (const [name, source] of Object.entries(sources)) {
      const image = new Image();
      image.src = source;
      await image.decode();
      if (imageWidth && (image.naturalWidth !== imageWidth || image.naturalHeight !== imageHeight)) {
        throw new Error('Backdrop refraction screenshot geometry mismatch');
      }
      imageWidth = image.naturalWidth;
      imageHeight = image.naturalHeight;
      const copy = document.createElement('canvas');
      copy.width = imageWidth;
      copy.height = imageHeight;
      const context = copy.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Backdrop refraction sampler unavailable');
      context.drawImage(image, 0, 0);
      contexts[name] = context;
    }
    const bounds = ${JSON.stringify(captureCanvasRect)};
    const pageScaleX = imageWidth / innerWidth;
    const pageScaleY = imageHeight / innerHeight;
    const worldScaleX = bounds.width / ${WORLD_WIDTH};
    const worldScaleY = bounds.height / ${WORLD_HEIGHT};
    return ${JSON.stringify(regions)}.map((region) => {
      const radiusX = region.radiusX ?? region.radius ?? 3;
      const radiusY = region.radiusY ?? region.radius ?? 3;
      const x = Math.floor((bounds.left + (region.x - radiusX) * worldScaleX) * pageScaleX);
      const y = Math.floor((bounds.top + (region.y - radiusY) * worldScaleY) * pageScaleY);
      const width = Math.max(1, Math.ceil(radiusX * 2 * worldScaleX * pageScaleX));
      const height = Math.max(1, Math.ceil(radiusY * 2 * worldScaleY * pageScaleY));
      const data = Object.fromEntries(Object.entries(contexts).map(([name, context]) => [
        name, context.getImageData(x, y, width, height).data,
      ]));
      let positive = 0;
      let negative = 0;
      let signed = 0;
      let squared = 0;
      let visible = 0;
      let peak = 0;
      let repeatPeak = 0;
      let chromaSquared = 0;
      let rgbSquared = 0;
      let rgbPeak = 0;
      let repeatRgbPeak = 0;
      const count = Math.max(1, width * height);
      for (let offset = 0; offset < data.straight.length; offset += 4) {
        const straight = data.straight[offset] * 0.2126
          + data.straight[offset + 1] * 0.7152 + data.straight[offset + 2] * 0.0722;
        const refracted = data.refracted[offset] * 0.2126
          + data.refracted[offset + 1] * 0.7152 + data.refracted[offset + 2] * 0.0722;
        const repeated = data.repeatedStraight[offset] * 0.2126
          + data.repeatedStraight[offset + 1] * 0.7152
          + data.repeatedStraight[offset + 2] * 0.0722;
        const difference = refracted - straight;
        const redDifference = data.refracted[offset] - data.straight[offset];
        const greenDifference = data.refracted[offset + 1] - data.straight[offset + 1];
        const blueDifference = data.refracted[offset + 2] - data.straight[offset + 2];
        const repeatedRed = data.repeatedStraight[offset] - data.straight[offset];
        const repeatedGreen = data.repeatedStraight[offset + 1] - data.straight[offset + 1];
        const repeatedBlue = data.repeatedStraight[offset + 2] - data.straight[offset + 2];
        signed += difference;
        squared += difference * difference;
        rgbSquared += redDifference * redDifference
          + greenDifference * greenDifference + blueDifference * blueDifference;
        chromaSquared += (redDifference - difference) * (redDifference - difference)
          + (greenDifference - difference) * (greenDifference - difference)
          + (blueDifference - difference) * (blueDifference - difference);
        positive += Math.max(0, difference);
        negative += Math.max(0, -difference);
        const magnitude = Math.abs(difference);
        if (magnitude >= 1.5) visible++;
        peak = Math.max(peak, magnitude);
        rgbPeak = Math.max(rgbPeak, Math.abs(redDifference), Math.abs(greenDifference), Math.abs(blueDifference));
        repeatPeak = Math.max(repeatPeak, Math.abs(repeated - straight));
        repeatRgbPeak = Math.max(
          repeatRgbPeak, Math.abs(repeatedRed), Math.abs(repeatedGreen), Math.abs(repeatedBlue),
        );
      }
      const rms = Math.sqrt(squared / count);
      return {
        name: region.name,
        rms: Math.round(rms * 100) / 100,
        rgbRms: Math.round(Math.sqrt(rgbSquared / (count * 3)) * 100) / 100,
        chromaRms: Math.round(Math.sqrt(chromaSquared / (count * 3)) * 100) / 100,
        signedMean: Math.round(signed / count * 100) / 100,
        meanBiasRatio: Math.round(Math.abs(signed / count) / Math.max(0.001, rms) * 1000) / 1000,
        positiveMean: Math.round(positive / count * 100) / 100,
        negativeMean: Math.round(negative / count * 100) / 100,
        bipolarBalance: Math.round(
          Math.min(positive, negative) / Math.max(1, Math.max(positive, negative)) * 1000,
        ) / 1000,
        coverage: Math.round(visible / count * 1000) / 1000,
        peak: Math.round(peak * 100) / 100,
        rgbPeak: Math.round(rgbPeak * 100) / 100,
        repeatPeak: Math.round(repeatPeak * 100) / 100,
        repeatRgbPeak: Math.round(repeatRgbPeak * 100) / 100,
      };
    });
  })()`);
}

async function sampleZoomedSquareGrain(
  cdp, screenshotBase64, baselineBase64, captureCanvasRect, anchor, zoom,
) {
  return evaluate(cdp, `(async () => {
    const sources = {
      rendered: ${JSON.stringify(`data:image/png;base64,${screenshotBase64}`)},
      baseline: ${JSON.stringify(`data:image/png;base64,${baselineBase64}`)},
    };
    const contexts = {};
    let imageWidth = 0;
    let imageHeight = 0;
    for (const [name, source] of Object.entries(sources)) {
      const image = new Image();
      image.src = source;
      await image.decode();
      if (imageWidth && (image.naturalWidth !== imageWidth || image.naturalHeight !== imageHeight)) {
        throw new Error('Zoomed grain screenshot geometry mismatch');
      }
      imageWidth = image.naturalWidth;
      imageHeight = image.naturalHeight;
      const copy = document.createElement('canvas');
      copy.width = imageWidth;
      copy.height = imageHeight;
      const context = copy.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Zoomed grain sampler unavailable');
      context.drawImage(image, 0, 0);
      contexts[name] = context;
    }
    const bounds = ${JSON.stringify(captureCanvasRect)};
    const anchor = ${JSON.stringify(anchor)};
    const pageScaleX = imageWidth / innerWidth;
    const pageScaleY = imageHeight / innerHeight;
    const expectedWidth = bounds.width / ${WORLD_WIDTH} * ${zoom} * pageScaleX;
    const expectedHeight = bounds.height / ${WORLD_HEIGHT} * ${zoom} * pageScaleY;
    const radiusX = Math.max(5, Math.ceil(expectedWidth * 1.45));
    const radiusY = Math.max(5, Math.ceil(expectedHeight * 1.45));
    const centerX = anchor.x * pageScaleX;
    const centerY = anchor.y * pageScaleY;
    const x = Math.max(0, Math.floor(centerX - radiusX));
    const y = Math.max(0, Math.floor(centerY - radiusY));
    const width = Math.min(imageWidth - x, radiusX * 2 + 1);
    const height = Math.min(imageHeight - y, radiusY * 2 + 1);
    const rendered = contexts.rendered.getImageData(x, y, width, height).data;
    const baseline = contexts.baseline.getImageData(x, y, width, height).data;
    let visible = 0;
    let minimumX = width;
    let minimumY = height;
    let maximumX = -1;
    let maximumY = -1;
    for (let offset = 0; offset < rendered.length; offset += 4) {
      const signal = Math.max(
        Math.abs(rendered[offset] - baseline[offset]),
        Math.abs(rendered[offset + 1] - baseline[offset + 1]),
        Math.abs(rendered[offset + 2] - baseline[offset + 2]),
      );
      if (signal <= 6) continue;
      const sample = offset / 4;
      const px = sample % width;
      const py = Math.floor(sample / width);
      minimumX = Math.min(minimumX, px);
      minimumY = Math.min(minimumY, py);
      maximumX = Math.max(maximumX, px);
      maximumY = Math.max(maximumY, py);
      visible++;
    }
    const visibleWidth = Math.max(0, maximumX - minimumX + 1);
    const visibleHeight = Math.max(0, maximumY - minimumY + 1);
    return {
      expectedPixels: Math.round(Math.min(expectedWidth, expectedHeight) * 100) / 100,
      visiblePixels: visible,
      visibleBounds: [visibleWidth, visibleHeight],
      boundingAspect: Math.round(
        (visibleWidth / Math.max(0.001, visibleHeight))
          / (expectedWidth / Math.max(0.001, expectedHeight)) * 1000,
      ) / 1000,
      rectangularFill: Math.round(visible / Math.max(1, visibleWidth * visibleHeight) * 1000) / 1000,
      widthRatio: Math.round(visibleWidth / Math.max(0.001, expectedWidth) * 1000) / 1000,
      heightRatio: Math.round(visibleHeight / Math.max(0.001, expectedHeight) * 1000) / 1000,
    };
  })()`);
}

async function sampleSemanticCellSupport(
  cdp, screenshots, baselineBase64, captureCanvasRect, cells,
) {
  return evaluate(cdp, `(async () => {
    const sources = {
      ...${JSON.stringify(Object.fromEntries(Object.entries(screenshots).map(([name, data]) => [
    name, `data:image/png;base64,${data}`,
  ])))},
      baseline: ${JSON.stringify(`data:image/png;base64,${baselineBase64}`)},
    };
    const images = {};
    const contexts = {};
    for (const [name, source] of Object.entries(sources)) {
      const image = new Image();
      image.src = source;
      await image.decode();
      images[name] = image;
    }
    const geometry = Object.values(images).map((image) => [image.naturalWidth, image.naturalHeight]);
    if (!geometry.every(([width, height]) => width === geometry[0][0] && height === geometry[0][1])) {
      throw new Error('Semantic support screenshot geometry mismatch');
    }
    for (const [name, image] of Object.entries(images)) {
      const copy = document.createElement('canvas');
      copy.width = image.naturalWidth;
      copy.height = image.naturalHeight;
      const context = copy.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Semantic support sampler unavailable');
      context.drawImage(image, 0, 0);
      contexts[name] = context;
    }
    const bounds = ${JSON.stringify(captureCanvasRect)};
    const pageScaleX = images.baseline.naturalWidth / innerWidth;
    const pageScaleY = images.baseline.naturalHeight / innerHeight;
    const worldScaleX = bounds.width / ${WORLD_WIDTH};
    const worldScaleY = bounds.height / ${WORLD_HEIGHT};
    const cells = ${JSON.stringify(cells)};
    const baseline = contexts.baseline;
    const result = {};
    for (const [name, context] of Object.entries(contexts)) {
      if (name === 'baseline') continue;
      let occupied = 0;
      let occupiedVisible = 0;
      let empty = 0;
      let emptyVisible = 0;
      let deepEmpty = 0;
      let deepEmptyVisible = 0;
      const missingOccupiedCells = [];
      let minimumOccupiedSignal = 255;
      for (const cell of cells) {
        // One world cell is only ~1.45 screenshot pixels at the fit view. A
        // single floored centre coordinate can therefore land on an AA fringe.
        // Sample a small inset cross that remains strictly inside the semantic
        // cell and use its strongest blank-differenced signal.
        let signal = 0;
        for (const [offsetX, offsetY] of [[0, 0], [-0.22, 0], [0.22, 0], [0, -0.22], [0, 0.22]]) {
          const pixelX = Math.max(0, Math.min(images[name].naturalWidth - 1, Math.floor(
            (bounds.left + (cell.x + 0.5 + offsetX) * worldScaleX) * pageScaleX,
          )));
          const pixelY = Math.max(0, Math.min(images[name].naturalHeight - 1, Math.floor(
            (bounds.top + (cell.y + 0.5 + offsetY) * worldScaleY) * pageScaleY,
          )));
          const rendered = context.getImageData(pixelX, pixelY, 1, 1).data;
          const blank = baseline.getImageData(pixelX, pixelY, 1, 1).data;
          signal = Math.max(signal,
            Math.abs(rendered[0] - blank[0]),
            Math.abs(rendered[1] - blank[1]),
            Math.abs(rendered[2] - blank[2]));
        }
        const visible = signal > 8;
        if (cell.occupied) {
          occupied++;
          if (visible) occupiedVisible++;
          else if (missingOccupiedCells.length < 64) missingOccupiedCells.push([cell.x, cell.y]);
          minimumOccupiedSignal = Math.min(minimumOccupiedSignal, signal);
        } else {
          empty++;
          if (visible) emptyVisible++;
          if (cell.deepHole) {
            deepEmpty++;
            if (visible) deepEmptyVisible++;
          }
        }
      }
      result[name] = {
        occupiedCells: occupied,
        occupiedRecall: Math.round(occupiedVisible / Math.max(1, occupied) * 1000) / 1000,
        missingOccupiedCells,
        minimumOccupiedSignal,
        emptyCells: empty,
        emptyLeak: Math.round(emptyVisible / Math.max(1, empty) * 1000) / 1000,
        deepHoleCells: deepEmpty,
        deepHoleLeak: Math.round(deepEmptyVisible / Math.max(1, deepEmpty) * 1000) / 1000,
      };
    }
    return result;
  })()`);
}

async function samplePageRegions(
  cdp, screenshotBase64, regions, baselineBase64, baselineReferenceBase64, captureCanvasRect,
) {
  return evaluate(cdp, `(async () => {
    const world = document.querySelector('.world-canvas');
    if (!(world instanceof HTMLCanvasElement)) throw new Error('World canvas unavailable');
    const image = new Image();
    image.src = ${JSON.stringify(`data:image/png;base64,${screenshotBase64}`)};
    await image.decode();
    const copy = document.createElement('canvas');
    copy.width = image.naturalWidth;
    copy.height = image.naturalHeight;
    const context = copy.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Screenshot sampler unavailable');
    context.drawImage(image, 0, 0);
    const baselineSource = ${baselineBase64 ? JSON.stringify(`data:image/png;base64,${baselineBase64}`) : 'null'};
    const baselineReferenceSource = ${baselineReferenceBase64 ? JSON.stringify(`data:image/png;base64,${baselineReferenceBase64}`) : 'null'};
    let baselineContext;
    let baselineReferenceContext;
    if (baselineSource && baselineReferenceSource) {
      const baselineImage = new Image();
      const baselineReferenceImage = new Image();
      baselineImage.src = baselineSource;
      baselineReferenceImage.src = baselineReferenceSource;
      await Promise.all([baselineImage.decode(), baselineReferenceImage.decode()]);
      if (baselineImage.naturalWidth !== image.naturalWidth || baselineImage.naturalHeight !== image.naturalHeight
        || baselineReferenceImage.naturalWidth !== image.naturalWidth
        || baselineReferenceImage.naturalHeight !== image.naturalHeight) {
        throw new Error('Baseline screenshot geometry mismatch');
      }
      const baselineCopy = document.createElement('canvas');
      const baselineReferenceCopy = document.createElement('canvas');
      baselineCopy.width = baselineReferenceCopy.width = image.naturalWidth;
      baselineCopy.height = baselineReferenceCopy.height = image.naturalHeight;
      baselineContext = baselineCopy.getContext('2d', { willReadFrequently: true });
      baselineReferenceContext = baselineReferenceCopy.getContext('2d', { willReadFrequently: true });
      if (!baselineContext || !baselineReferenceContext) throw new Error('Baseline sampler unavailable');
      baselineContext.drawImage(baselineImage, 0, 0);
      baselineReferenceContext.drawImage(baselineReferenceImage, 0, 0);
    }
    const liveBounds = world.getBoundingClientRect();
    const suppliedBounds = ${captureCanvasRect ? JSON.stringify(captureCanvasRect) : 'null'};
    const bounds = suppliedBounds ?? {
      left: liveBounds.left, top: liveBounds.top, width: liveBounds.width, height: liveBounds.height,
    };
    const pageScaleX = image.naturalWidth / innerWidth;
    const pageScaleY = image.naturalHeight / innerHeight;
    return ${JSON.stringify(regions)}.map((region) => {
      const radius = region.radius ?? 3;
      const radiusX = region.radiusX ?? radius;
      const radiusY = region.radiusY ?? radius;
      const worldScaleX = bounds.width / ${WORLD_WIDTH};
      const worldScaleY = bounds.height / ${WORLD_HEIGHT};
      const x = Math.floor((bounds.left + (region.x - radiusX) * worldScaleX) * pageScaleX);
      const y = Math.floor((bounds.top + (region.y - radiusY) * worldScaleY) * pageScaleY);
      const width = Math.max(1, Math.ceil(radiusX * 2 * worldScaleX * pageScaleX));
      const height = Math.max(1, Math.ceil(radiusY * 2 * worldScaleY * pageScaleY));
      const data = context.getImageData(x, y, width, height).data;
      const baselineData = baselineContext?.getImageData(x, y, width, height).data;
      const baselineReferenceData = baselineReferenceContext?.getImageData(x, y, width, height).data;
      let signalThreshold = 0;
      if (baselineData && baselineReferenceData) {
        const noise = new Uint8Array(width * height);
        for (let offset = 0; offset < baselineData.length; offset += 4) {
          noise[offset / 4] = Math.max(
            Math.abs(baselineData[offset] - baselineReferenceData[offset]),
            Math.abs(baselineData[offset + 1] - baselineReferenceData[offset + 1]),
            Math.abs(baselineData[offset + 2] - baselineReferenceData[offset + 2]),
          );
        }
        noise.sort();
        signalThreshold = Math.max(4, noise[Math.floor((noise.length - 1) * 0.99)] + 3);
      }
      signalThreshold = Math.max(signalThreshold, region.signalFloor ?? 0);
      const total = [0, 0, 0];
      let visible = 0;
      let pinned = 0;
      let minimumLuma = 255;
      let maximumLuma = 0;
      let peakLuma = -1;
      let peakPixelX = 0;
      let peakPixelY = 0;
      let signature = 2166136261;
      const lumaValues = new Float32Array(width * height);
      const visiblePixels = new Uint8Array(width * height);
      for (let offset = 0; offset < data.length; offset += 4) {
        if (region.signature) {
          signature = Math.imul(signature ^ data[offset], 16777619);
          signature = Math.imul(signature ^ data[offset + 1], 16777619);
          signature = Math.imul(signature ^ data[offset + 2], 16777619);
          signature = Math.imul(signature ^ data[offset + 3], 16777619);
        }
        if (baselineData) {
          const signal = Math.max(
            Math.abs(data[offset] - baselineData[offset]),
            Math.abs(data[offset + 1] - baselineData[offset + 1]),
            Math.abs(data[offset + 2] - baselineData[offset + 2]),
          );
          if (signal <= signalThreshold) continue;
        } else if (data[offset + 3] < 48
          || Math.max(data[offset], data[offset + 1], data[offset + 2]) < 12) continue;
        total[0] += data[offset]; total[1] += data[offset + 1]; total[2] += data[offset + 2];
        if (data[offset] === 255 || data[offset + 1] === 255 || data[offset + 2] === 255) pinned++;
        const luma = (data[offset] * 54 + data[offset + 1] * 183 + data[offset + 2] * 19) / 256;
        const sampleIndex = offset / 4;
        lumaValues[sampleIndex] = luma;
        visiblePixels[sampleIndex] = 1;
        if (luma > peakLuma) {
          peakLuma = luma;
          peakPixelX = sampleIndex % width;
          peakPixelY = Math.floor(sampleIndex / width);
        }
        minimumLuma = Math.min(minimumLuma, luma);
        maximumLuma = Math.max(maximumLuma, luma);
        visible++;
      }
      let adjacentContrast = 0;
      let adjacentPairs = 0;
      for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
        const sampleIndex = py * width + px;
        if (!visiblePixels[sampleIndex]) continue;
        if (px + 1 < width && visiblePixels[sampleIndex + 1]) {
          adjacentContrast += Math.abs(lumaValues[sampleIndex] - lumaValues[sampleIndex + 1]);
          adjacentPairs++;
        }
        if (py + 1 < height && visiblePixels[sampleIndex + width]) {
          adjacentContrast += Math.abs(lumaValues[sampleIndex] - lumaValues[sampleIndex + width]);
          adjacentPairs++;
        }
      }
      const meanLuma = (total[0] * 54 + total[1] * 183 + total[2] * 19)
        / (256 * Math.max(1, visible));
      let darkPixels = 0;
      const darkThreshold = meanLuma * 0.70;
      for (let sampleIndex = 0; sampleIndex < lumaValues.length; sampleIndex++) {
        if (visiblePixels[sampleIndex] && lumaValues[sampleIndex] < darkThreshold) darkPixels++;
      }
      let minimumMacroLuma = 255;
      let maximumMacroLuma = 0;
      let macroSamples = 0;
      const macroRadius = 2;
      for (let py = macroRadius; py < height - macroRadius; py++) {
        for (let px = macroRadius; px < width - macroRadius; px++) {
          let sum = 0;
          let supported = true;
          for (let oy = -macroRadius; oy <= macroRadius && supported; oy++) {
            for (let ox = -macroRadius; ox <= macroRadius; ox++) {
              const neighbour = (py + oy) * width + px + ox;
              if (!visiblePixels[neighbour]) { supported = false; break; }
              sum += lumaValues[neighbour];
            }
          }
          if (!supported) continue;
          const macroLuma = sum / 25;
          minimumMacroLuma = Math.min(minimumMacroLuma, macroLuma);
          maximumMacroLuma = Math.max(maximumMacroLuma, macroLuma);
          macroSamples++;
        }
      }
      let dominantComponentPixels = 0;
      let maskSignature = 2166136261;
      for (const supported of visiblePixels) {
        maskSignature = Math.imul(maskSignature ^ supported, 16777619);
      }
      const visited = new Uint8Array(visiblePixels.length);
      const stack = new Int32Array(visiblePixels.length);
      for (let origin = 0; origin < visiblePixels.length; origin++) {
        if (!visiblePixels[origin] || visited[origin]) continue;
        let stackLength = 1;
        let componentPixels = 0;
        stack[0] = origin;
        visited[origin] = 1;
        while (stackLength > 0) {
          const current = stack[--stackLength];
          componentPixels++;
          const px = current % width;
          const py = Math.floor(current / width);
          for (const neighbour of [
            px > 0 ? current - 1 : -1,
            px + 1 < width ? current + 1 : -1,
            py > 0 ? current - width : -1,
            py + 1 < height ? current + width : -1,
          ]) {
            if (neighbour < 0 || !visiblePixels[neighbour] || visited[neighbour]) continue;
            visited[neighbour] = 1;
            stack[stackLength++] = neighbour;
          }
        }
        dominantComponentPixels = Math.max(dominantComponentPixels, componentPixels);
      }
      let boundaryPixels = 0;
      let outerRingPixels = 0;
      let visibleMinX = width;
      let visibleMinY = height;
      let visibleMaxX = -1;
      let visibleMaxY = -1;
      if (region.silhouette) {
        for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
          const sampleIndex = py * width + px;
          if (!visiblePixels[sampleIndex]) continue;
          visibleMinX = Math.min(visibleMinX, px);
          visibleMinY = Math.min(visibleMinY, py);
          visibleMaxX = Math.max(visibleMaxX, px);
          visibleMaxY = Math.max(visibleMaxY, py);
          if (px === 0 || px + 1 === width || py === 0 || py + 1 === height) outerRingPixels++;
          if (px === 0 || px + 1 === width || py === 0 || py + 1 === height
            || !visiblePixels[sampleIndex - 1] || !visiblePixels[sampleIndex + 1]
            || !visiblePixels[sampleIndex - width] || !visiblePixels[sampleIndex + width]) {
            boundaryPixels++;
          }
        }
      }
      const visibleBoundsWidth = Math.max(0, visibleMaxX - visibleMinX + 1);
      const visibleBoundsHeight = Math.max(0, visibleMaxY - visibleMinY + 1);
      const visibleBoundsArea = visibleBoundsWidth * visibleBoundsHeight;
      let longestQuietRun = 0;
      for (let py = 0; py < height; py++) {
        let quietRun = 0;
        for (let px = 0; px < width; px++) {
          if (visiblePixels[py * width + px]) quietRun = 0;
          else {
            quietRun++;
            longestQuietRun = Math.max(longestQuietRun, quietRun);
          }
        }
      }
      return {
        name: region.name,
        rgb: total.map((channel) => Math.round(channel / Math.max(1, visible))),
        visible,
        coverage: Math.round(visible / Math.max(1, width * height) * 1000) / 1000,
        microContrast: Math.round(adjacentContrast / Math.max(1, adjacentPairs) * 100) / 100,
        macroLumaRange: macroSamples ? Math.round(maximumMacroLuma - minimumMacroLuma) : 0,
        meanLuma: Math.round(meanLuma * 100) / 100,
        darkFraction: Math.round(darkPixels / Math.max(1, visible) * 1000) / 1000,
        pinnedFraction: Math.round(pinned / Math.max(1, visible) * 1000) / 1000,
        lumaRange: visible ? Math.round(maximumLuma - minimumLuma) : 0,
        ...(region.topology ? {
          dominantComponent: Math.round(dominantComponentPixels / Math.max(1, visible) * 1000) / 1000,
          quietRunFraction: Math.round(longestQuietRun / Math.max(1, width) * 1000) / 1000,
        } : {}),
        ...(region.silhouette ? {
          boundaryPixels,
          worldArea: Math.round(visible
            / Math.max(0.0001, worldScaleX * pageScaleX * worldScaleY * pageScaleY) * 100) / 100,
          outerRingFraction: Math.round(outerRingPixels
            / Math.max(1, width * 2 + height * 2 - 4) * 1000) / 1000,
          compactness: Math.round(
            4 * Math.PI * visible / Math.max(1, boundaryPixels * boundaryPixels) * 1000,
          ) / 1000,
          boundingAspect: Math.round(
            (visibleBoundsWidth / Math.max(0.0001, worldScaleX * pageScaleX))
              / Math.max(0.0001, visibleBoundsHeight / (worldScaleY * pageScaleY)) * 1000,
          ) / 1000,
          rectangularFill: Math.round(visible / Math.max(1, visibleBoundsArea) * 1000) / 1000,
        } : {}),
        ...(region.signature ? {
          signature: signature >>> 0,
          maskSignature: maskSignature >>> 0,
        } : {}),
        ...(region.locatePeak ? {
          peakLuma: Math.round(Math.max(0, peakLuma)),
          peakWorld: [
            ((x + peakPixelX + 0.5) / pageScaleX - bounds.left) / worldScaleX,
            ((y + peakPixelY + 0.5) / pageScaleY - bounds.top) / worldScaleY,
          ],
        } : {}),
      };
    });
  })()`);
}

async function capturePaintedFootprints(cdp, landmarks, label, radius = 1.5, maximumError = 1) {
  // Semantic cell assertions alone cannot catch a presenter transform that
  // draws the accepted mark somewhere else. Sample the composed framebuffer at
  // each requested cell and at a nearby empty control after the paint frame.
  const capture = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const regions = landmarks.flatMap((landmark, index) => {
    const controlOffset = landmark.y < WORLD_HEIGHT - 8 ? 6 : -6;
    return [
      { name: `target-${index}`, x: landmark.x + 0.5, y: landmark.y + 0.5, radius, locatePeak: true },
      { name: `control-${index}`, x: landmark.x + 0.5, y: landmark.y + controlOffset + 0.5, radius, locatePeak: true },
    ];
  });
  const samples = await samplePageRegions(cdp, capture.data, regions);
  return landmarks.map((landmark, index) => {
    const target = samples[index * 2];
    const control = samples[index * 2 + 1];
    const peakLumaDelta = target.peakLuma - control.peakLuma;
    const peakWorldError = Math.hypot(
      target.peakWorld[0] - landmark.x - 0.5,
      target.peakWorld[1] - landmark.y - 0.5,
    );
    assert(peakLumaDelta >= 20,
      `${label}: painted footprint at ${landmark.x},${landmark.y} is not visible (${peakLumaDelta} peak luma over control)`);
    assert(peakWorldError < maximumError,
      `${label}: painted footprint at ${landmark.x},${landmark.y} is offset ${peakWorldError.toFixed(3)} cells`);
    return {
      cell: `${landmark.x},${landmark.y}`,
      peakLumaDelta,
      peakWorldErrorCells: round(peakWorldError, 4),
    };
  });
}

async function mouseClick(cdp, x, y, button) {
  const bit = button === 'middle' ? 4 : 1;
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, buttons: bit, clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, buttons: 0, clickCount: 1 });
}

function touch(id, x, y) { return { id, x, y, radiusX: 1, radiusY: 1, force: 1 }; }

async function evaluate(cdp, expression) {
  const response = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  return response.result.value;
}

async function resolveChrome() {
  const candidates = [process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch { /* try next */ }
  }
  throw new Error('Chrome/Chromium not found; set CHROME_BIN');
}

async function waitFor(check, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) { lastError = error; }
    await sleep(50);
  }
  throw new Error(`${label} timed out${lastError ? `: ${lastError}` : ''}`);
}

function assert(condition, message) { if (!condition) throw new Error(message); }

function assertPairedVisualRelief(results) {
  if (results.length !== 2) return;
  const canvas = results.find((result) => result.backend === 'canvas2d');
  const webgl = results.find((result) => result.backend === 'webgl');
  if (!canvas || !webgl) return;
  for (const [name, channel] of [
    ['metalCold', 2], ['metalHot', 0], ['sandCold', 2], ['sandHot', 0],
    ['glassHotBackdrop', 0], ['iceColdBackdrop', 2],
  ]) {
    const canvasSample = canvas.thermalResponseSamples.find((sample) => sample.name === name);
    const webglSample = webgl.thermalResponseSamples.find((sample) => sample.name === name);
    assert(canvasSample && webglSample, `paired thermal sample missing ${name}`);
    const canvasResponse = Math.abs(canvasSample.responseRgb[channel]);
    const webglResponse = Math.abs(webglSample.responseRgb[channel]);
    const ratio = canvasResponse / Math.max(0.5, webglResponse);
    assert(ratio >= 0.4 && ratio <= 2.5,
      `Canvas/WebGL ${name} thermal response diverged (${canvasResponse}/${webglResponse})`);
  }
  for (const canvasSample of canvas.liquidColumnSamples) {
    const webglSample = webgl.liquidColumnSamples.find((sample) => sample.name === canvasSample.name);
    assert(webglSample, `paired liquid sample missing ${canvasSample.name}`);
    const macroRatio = webglSample.macroLumaRange / Math.max(1, canvasSample.macroLumaRange);
    assert(macroRatio >= 0.65 && macroRatio <= 2.0,
      `Canvas/WebGL ${canvasSample.name} macro depth diverged (${canvasSample.macroLumaRange}/${webglSample.macroLumaRange})`);
    const exposureRatio = webglSample.meanLuma / Math.max(1, canvasSample.meanLuma);
    assert(exposureRatio >= 0.65 && exposureRatio <= 1.6,
      `Canvas/WebGL ${canvasSample.name} mean exposure diverged (${canvasSample.meanLuma}/${webglSample.meanLuma})`);
  }
  for (const name of ['warmRim', 'coolRim']) {
    const canvasSample = canvas.gasLightResponseSamples.find((sample) => sample.name === name);
    const webglSample = webgl.gasLightResponseSamples.find((sample) => sample.name === name);
    assert(canvasSample && webglSample, `paired gas-light sample missing ${name}`);
    const channel = name === 'warmRim' ? 0 : 2;
    const ratio = canvasSample.positiveRgb[channel] / Math.max(0.25, webglSample.positiveRgb[channel]);
    assert(ratio >= 0.4 && ratio <= 2.5,
      `Canvas/WebGL ${name} isolated field-light response diverged (${canvasSample.positiveRgb[channel]}/${webglSample.positiveRgb[channel]})`);
  }
  for (const name of ['compactFog', 'compactCflm']) {
    const canvasSample = canvas.compactGasSamples.find((sample) => sample.name === name);
    const webglSample = webgl.compactGasSamples.find((sample) => sample.name === name);
    assert(canvasSample && webglSample, `paired compact-gas sample missing ${name}`);
    const exposureRatio = canvasSample.meanLuma / Math.max(1, webglSample.meanLuma);
    assert(exposureRatio >= 0.65 && exposureRatio <= 1.75,
      `Canvas/WebGL ${name} exposure diverged (${canvasSample.meanLuma}/${webglSample.meanLuma})`);
    assert(Math.abs(canvasSample.dominantComponent - webglSample.dominantComponent) <= 0.08,
      `Canvas/WebGL ${name} connectivity diverged (${canvasSample.dominantComponent}/${webglSample.dominantComponent})`);
  }
  for (const family of ['smoke', 'fog', 'cflm']) {
    const canvasCentre = canvas.sparseGasSamples.find((sample) => sample.name === `${family}Centre`);
    const canvasMidpoint = canvas.sparseGasSamples.find((sample) => sample.name === `${family}Midpoint`);
    const webglCentre = webgl.sparseGasSamples.find((sample) => sample.name === `${family}Centre`);
    const webglMidpoint = webgl.sparseGasSamples.find((sample) => sample.name === `${family}Midpoint`);
    assert(canvasCentre && canvasMidpoint && webglCentre && webglMidpoint,
      `paired sparse-gas sample missing ${family}`);
    const canvasRatio = canvasCentre.meanLuma / Math.max(1, canvasMidpoint.meanLuma);
    const webglRatio = webglCentre.meanLuma / Math.max(1, webglMidpoint.meanLuma);
    assert(Math.abs(canvasRatio - webglRatio) <= 0.35,
      `Canvas/WebGL ${family} bead contrast diverged (${canvasRatio}/${webglRatio})`);
  }
  for (const name of [
    'patternedGlassShoulders', 'patternedIceCore',
    'patternedWaterShoulders', 'patternedOilShoulders',
  ]) {
    const canvasSample = canvas.backdropRefractionSamples.find((sample) => sample.name === name);
    const webglSample = webgl.backdropRefractionSamples.find((sample) => sample.name === name);
    assert(canvasSample && webglSample, `paired backdrop-refraction sample missing ${name}`);
    const ratio = canvasSample.rms / Math.max(0.25, webglSample.rms);
    assert(ratio >= 0.55 && ratio <= 2.2,
      `Canvas/WebGL ${name} refraction magnitude diverged (${canvasSample.rms}/${webglSample.rms})`);
  }
  for (const [name, metric] of [
    ['metalGlassSeam', 'rgbRms'],
    ['glassCaustic', 'chromaRms'],
    ['iceCaustic', 'chromaRms'],
  ]) {
    const canvasSample = canvas.solidContactDepthSamples.find((sample) => sample.name === name);
    const webglSample = webgl.solidContactDepthSamples.find((sample) => sample.name === name);
    assert(canvasSample && webglSample, `paired solid-contact sample missing ${name}`);
    const ratio = canvasSample[metric] / Math.max(0.20, webglSample[metric]);
    assert(ratio >= 0.45 && ratio <= 2.5,
      `Canvas/WebGL ${name} contact-depth response diverged (${canvasSample[metric]}/${webglSample[metric]})`);
  }
  for (const name of ['glassLensShell', 'iceLensShell']) {
    const canvasSample = canvas.lensShellSamples.find((sample) => sample.name === name);
    const webglSample = webgl.lensShellSamples.find((sample) => sample.name === name);
    assert(canvasSample && webglSample, `paired lens-shell sample missing ${name}`);
    const ratio = canvasSample.rgbRms / Math.max(0.20, webglSample.rgbRms);
    assert(ratio >= 0.45 && ratio <= 2.5,
      `Canvas/WebGL ${name} shell response diverged (${canvasSample.rgbRms}/${webglSample.rgbRms})`);
  }
  for (const name of ['metalConvex', 'metalConcave', 'plantConvex', 'dtecConvex']) {
    const canvasSample = canvas.solidCurvatureSamples.find((sample) => sample.name === name);
    const webglSample = webgl.solidCurvatureSamples.find((sample) => sample.name === name);
    assert(canvasSample && webglSample, `paired solid-curvature sample missing ${name}`);
    const ratio = canvasSample.rms / Math.max(0.05, webglSample.rms);
    assert(ratio >= 0.40 && ratio <= 2.5,
      `Canvas/WebGL ${name} curvature response diverged (${canvasSample.rms}/${webglSample.rms})`);
  }
}

function round(value, digits = 2) { const factor = 10 ** digits; return Math.round(value * factor) / factor; }
function sleep(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

function screenshotPath(mode) {
  if (!screenshotRequest) return undefined;
  if (modes.length === 1) return screenshotRequest;
  const extension = path.extname(screenshotRequest);
  return extension
    ? `${screenshotRequest.slice(0, -extension.length)}-${mode}${extension}`
    : `${screenshotRequest}-${mode}.png`;
}

function variantScreenshotPath(source, variant) {
  const extension = path.extname(source);
  return extension
    ? `${source.slice(0, -extension.length)}-${variant}${extension}`
    : `${source}-${variant}`;
}

async function terminate(child) {
  if (!child || child.exitCode !== null || !child.pid) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch { return; } }
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), sleep(2_000)]);
  if (child.exitCode !== null) return;
  try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* already gone */ } }
}

class Cdp {
  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    return new Cdp(socket);
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${message.error.message}: ${JSON.stringify(message.error.data ?? {})}`));
        else pending.resolve(message.result ?? {});
        return;
      }
      for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {});
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  close() { this.socket.close(); }
}

await main();
