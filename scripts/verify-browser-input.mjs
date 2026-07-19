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
const modes = process.argv.includes('--canvas-only') ? ['canvas2d']
  : process.argv.includes('--webgl-only') ? ['webgl'] : ['canvas2d', 'webgl'];
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
    assertPairedLiquidRelief(results);
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
    scene: 'render-lab', inputAudit: '1', renderScale: '2',
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
    await cdp.send('Page.navigate', { url: `${ORIGIN}/?${query}` });
    await waitFor(() => evaluate(cdp, `Boolean(window.__ANIFOR_INPUT_AUDIT__ && document.documentElement)`), 15_000, `input audit API (${mode})`);
    await waitFor(() => evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.backend().backend === ${JSON.stringify(mode)}`), 15_000, `${mode} backend`);
    const canonicalFixture = await evaluate(cdp, `({
      status: document.querySelector('.status')?.textContent,
      occupied: window.__ANIFOR_INPUT_AUDIT__.occupiedCells(),
      upperWall: window.__ANIFOR_INPUT_AUDIT__.cell(200, 138),
      lowerWall: window.__ANIFOR_INPUT_AUDIT__.cell(50, 348),
    })`);
    assert(canonicalFixture.status?.includes('TypeScript deterministic fallback'),
      `${mode}: canonical render lab used ${canonicalFixture.status}`);
    assert(canonicalFixture.occupied > 40_000,
      `${mode}: canonical render lab contains only ${canonicalFixture.occupied} cells`);
    assert(canonicalFixture.upperWall === 3 && canonicalFixture.lowerWall === 3,
      `${mode}: canonical render lab signature changed (${JSON.stringify(canonicalFixture)})`);

    // Read the rendered canvas, not semantic cells, so framebuffer clipping and
    // backend compositing regressions are observable in the browser gate.
    await sleep(250);
    const canonicalCapture = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    const energySamples = await samplePageRegions(cdp, canonicalCapture.data, [
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
    const solidSamples = await samplePageRegions(cdp, canonicalCapture.data, [
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
    const solidSeparatorSamples = await samplePageRegions(cdp, canonicalCapture.data, [
      { name: 'columnGap', x: 465, y: 229, radius: 1 },
      { name: 'rowGap', x: 485, y: 217, radius: 1 },
    ]);
    assert(solidSeparatorSamples.every((sample) => Math.max(...sample.rgb) <= 20 && sample.lumaRange <= 5),
      `${mode}: solid reconstruction bridged a matrix separator (${JSON.stringify(solidSeparatorSamples)})`);
    const powderSamples = await samplePageRegions(cdp, canonicalCapture.data, [
      { name: 'denseSand', x: 156, y: 78, radius: 8 },
    ]);
    assert(powderSamples.every((sample) => sample.visible >= 32 && sample.microContrast >= 3),
      `${mode}: rough powder lost its granular detail (${JSON.stringify(powderSamples)})`);
    const volumeSamples = await samplePageRegions(cdp, canonicalCapture.data, [
      { name: 'water', x: 238, y: 79, radius: 14 },
      { name: 'oil', x: 289, y: 87, radius: 12 },
      { name: 'smoke', x: 420, y: 76, radius: 16 },
      { name: 'oxygen', x: 486, y: 72, radius: 16 },
      { name: 'nobleGas', x: 544, y: 88, radius: 14 },
    ]);
    assert(volumeSamples.every((sample) => sample.coverage >= 0.90),
      `${mode}: a dense fluid core became visibly perforated (${JSON.stringify(volumeSamples)})`);
    assert(volumeSamples.every((sample) => sample.lumaRange >= 8 && sample.lumaRange <= 200),
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
    const liquidColumnSamples = await samplePageRegions(cdp, canonicalCapture.data, [
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
    const liquidReliefSamples = await samplePageRegions(cdp, canonicalCapture.data, [
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

    let mobile;
    if (mode === 'canvas2d') {
      mobile = await auditMobile(cdp, screenshot ? variantScreenshotPath(screenshot, 'mobile') : undefined);
    }
    const renderScaleOne = await auditRenderScaleOne(cdp, mode, dpr);
    const nativeSemantics = await auditNativeSemantics(cdp, mode, dpr, screenshot);
    await sleep(50);
    assert(errors.length === 0, `${mode}: browser errors: ${errors.join(' | ')}`);
    cdp.close();
    return {
      backend: mode, dpr,
      backing: `${initial.backing.width}x${initial.backing.height}`,
      canonicalFixture: { occupied: canonicalFixture.occupied, wallSignature: '3,3' },
      energySamples,
      solidSamples,
      solidSeparatorSamples,
      powderSamples,
      volumeSamples,
      liquidColumnSamples,
      liquidReliefSamples,
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
  })()`), 15_000, `native input audit API (${mode})`);
  await waitFor(() => evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.backend().backend === ${JSON.stringify(mode)}`),
    15_000, `native ${mode} backend`);
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
    const library = document.querySelector('.tool-library');
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

async function auditMobile(cdp, screenshot) {
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
    screenWidth: 390, screenHeight: 844,
    screenOrientation: { type: 'portraitPrimary', angle: 0 },
  });
  await sleep(240);
  await evaluate(cdp, `window.scrollTo(0, 0); window.__ANIFOR_INPUT_AUDIT__.clear(); window.__ANIFOR_INPUT_AUDIT__.resetView(); true`);
  await sleep(350);
  const initial = await metrics(cdp);
  assertGeometry(initial, 'mobile Canvas');
  assertContained(initial, 'mobile Canvas');
  assertToolboxGeometry(initial, 'mobile Canvas', 40);
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
  const paintedFootprints = await capturePaintedFootprints(cdp, [target], 'mobile Canvas', 1);
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
    const toolboxHeading = document.querySelector('.toolbox-heading');
    const library = document.querySelector('.tool-library');
    if (!(toolboxHeading instanceof HTMLElement) || !(library instanceof HTMLElement)) {
      throw new Error('Missing mobile toolbox');
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    library.scrollTop = 0;
    const rect = toolboxHeading.getBoundingClientRect();
    return {
      x: Math.max(12, Math.min(innerWidth - 12, rect.left + rect.width / 2)),
      y: Math.max(80, Math.min(innerHeight - 140, rect.top + rect.height / 2)),
      scrollY,
    };
  })()`);
  const availablePageScroll = scrollStart.scrollY;
  assert(availablePageScroll > 30,
    `mobile palette exposes only ${round(availablePageScroll)}px upward page-scroll range`);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [touch(4, scrollStart.x, scrollStart.y)],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove', touchPoints: [touch(4, scrollStart.x, scrollStart.y + 120)],
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
  return {
    viewport: `${round(initial.viewport.width, 2)}x${round(initial.viewport.height, 2)}`,
    canvasAspect: round(initial.canvas.width / initial.canvas.height, 6),
    pinchZoom: round(pinch.view.zoom, 4),
    pinchPanX: round(pinch.view.panX, 3),
    pinchAnchorErrorCells: round(pinchAnchorError, 5),
    pinchStrayCells: pinch.occupied,
    singleTouchCell: `${target.x},${target.y}`,
    paintedFootprints,
    toolFilterHeight: round(initial.ui.filters.height),
    toolboxGap: round(initial.ui.actions.top - initial.ui.palette.bottom),
    horizontalOverflow: round(initial.ui.horizontalOverflow),
    fieldIndicator: `${round(initial.ui.fieldIndicator.width)}x${round(initial.ui.fieldIndicator.height)}`,
    libraryScroll: `${round(mobileLibrary.scrollTop)}/${round(mobileLibrary.scrollHeight - mobileLibrary.clientHeight)}`,
    touchScroll: `${round(scrollStart.scrollY)}->${round(touchScrollY)}`,
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
    const filterButtons = [...document.querySelectorAll('.tool-filter')];
    if (!canvas || !viewport || !frame || !palette || !actions || !filters || !shell || !workspace || !toolbox
      || !library || !footer || !fieldIndicator || !touchHint || !filterButtons.length) {
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

async function samplePageRegions(cdp, screenshotBase64, regions) {
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
    const bounds = world.getBoundingClientRect();
    const pageScaleX = image.naturalWidth / innerWidth;
    const pageScaleY = image.naturalHeight / innerHeight;
    return ${JSON.stringify(regions)}.map((region) => {
      const radius = region.radius ?? 3;
      const worldScaleX = bounds.width / ${WORLD_WIDTH};
      const worldScaleY = bounds.height / ${WORLD_HEIGHT};
      const x = Math.floor((bounds.left + (region.x - radius) * worldScaleX) * pageScaleX);
      const y = Math.floor((bounds.top + (region.y - radius) * worldScaleY) * pageScaleY);
      const width = Math.max(1, Math.ceil(radius * 2 * worldScaleX * pageScaleX));
      const height = Math.max(1, Math.ceil(radius * 2 * worldScaleY * pageScaleY));
      const data = context.getImageData(x, y, width, height).data;
      const total = [0, 0, 0];
      let visible = 0;
      let pinned = 0;
      let minimumLuma = 255;
      let maximumLuma = 0;
      let peakLuma = -1;
      let peakPixelX = 0;
      let peakPixelY = 0;
      const lumaValues = new Float32Array(width * height);
      const visiblePixels = new Uint8Array(width * height);
      for (let offset = 0; offset < data.length; offset += 4) {
        if (data[offset + 3] < 48 || Math.max(data[offset], data[offset + 1], data[offset + 2]) < 12) continue;
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
      return {
        name: region.name,
        rgb: total.map((channel) => Math.round(channel / Math.max(1, visible))),
        visible,
        coverage: Math.round(visible / Math.max(1, width * height) * 1000) / 1000,
        microContrast: Math.round(adjacentContrast / Math.max(1, adjacentPairs) * 100) / 100,
        macroLumaRange: macroSamples ? Math.round(maximumMacroLuma - minimumMacroLuma) : 0,
        darkFraction: Math.round(darkPixels / Math.max(1, visible) * 1000) / 1000,
        pinnedFraction: Math.round(pinned / Math.max(1, visible) * 1000) / 1000,
        lumaRange: visible ? Math.round(maximumLuma - minimumLuma) : 0,
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

function assertPairedLiquidRelief(results) {
  if (results.length !== 2) return;
  const canvas = results.find((result) => result.backend === 'canvas2d');
  const webgl = results.find((result) => result.backend === 'webgl');
  if (!canvas || !webgl) return;
  for (const canvasSample of canvas.liquidColumnSamples) {
    const webglSample = webgl.liquidColumnSamples.find((sample) => sample.name === canvasSample.name);
    assert(webglSample, `paired liquid sample missing ${canvasSample.name}`);
    assert(canvasSample.macroLumaRange >= Math.max(2, webglSample.macroLumaRange * 0.45),
      `Canvas ${canvasSample.name} macro depth fell behind WebGL (${canvasSample.macroLumaRange}/${webglSample.macroLumaRange})`);
    assert(canvasSample.macroLumaRange <= webglSample.macroLumaRange * 5 + 4,
      `Canvas ${canvasSample.name} macro depth became excessive (${canvasSample.macroLumaRange}/${webglSample.macroLumaRange})`);
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
