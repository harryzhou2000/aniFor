import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const PORT = 5178;
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

    const screenshot = screenshotPath(mode);
    if (screenshot) {
      await sleep(250);
      const capture = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
      await writeFile(screenshot, Buffer.from(capture.data, 'base64'));
    }

    await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.clear(); window.__ANIFOR_INPUT_AUDIT__.setRadius(0); true`);
    const initial = await metrics(cdp);
    assertGeometry(initial, `${mode} initial`);
    assertToolboxGeometry(initial, `${mode} initial`, 68);
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

    await evaluate(cdp, `window.__ANIFOR_INPUT_AUDIT__.resetView(); true`);
    const resizeMetrics = [];
    let previousResize = initial;
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
    `${mode}: desktop resize did not return to fitted geometry`);

    let mobile;
    if (mode === 'canvas2d') {
      mobile = await auditMobile(cdp, screenshot ? variantScreenshotPath(screenshot, 'mobile') : undefined);
    }
    await sleep(50);
    assert(errors.length === 0, `${mode}: browser errors: ${errors.join(' | ')}`);
    cdp.close();
    return {
      backend: mode, dpr,
      backing: `${initial.backing.width}x${initial.backing.height}`,
      landmarkCells: landmarks.length,
      wheelAnchorErrorCells: round(wheelAnchorError, 5),
      middlePanDelta: { x: round(afterPan.panX - beforePan.panX, 3), y: round(afterPan.panY - beforePan.panY, 3) },
      toolFilters: { height: round(initial.ui.filters.height), rows: filterRows(initial.ui.filterButtons) },
      resizeMetrics,
      ...(mobile ? { mobile } : {}),
      ...(screenshot ? { screenshot } : {}),
      browserErrors: errors.length,
    };
  } finally {
    await terminate(chrome);
    await rm(profile, { recursive: true, force: true });
  }
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
  await sleep(80);
  const initial = await metrics(cdp);
  assertGeometry(initial, 'mobile Canvas');
  assertContained(initial, 'mobile Canvas');
  assertToolboxGeometry(initial, 'mobile Canvas', 40);
  assert(Math.abs(initial.viewport.width - initial.viewport.height) < 1, 'mobile interaction panel is not square');
  if (screenshot) {
    const capture = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    await writeFile(screenshot, Buffer.from(capture.data, 'base64'));
  }
  const center = { x: initial.viewport.left + initial.viewport.width / 2, y: initial.viewport.top + initial.viewport.height / 2 };
  const start = [touch(1, center.x - 58, center.y), touch(2, center.x + 58, center.y)];
  const moved = [touch(1, center.x - 83, center.y + 16), touch(2, center.x + 83, center.y + 16)];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: start });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: moved });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(100);
  const pinch = await evaluate(cdp, `({ view: window.__ANIFOR_INPUT_AUDIT__.viewState(), occupied: window.__ANIFOR_INPUT_AUDIT__.occupiedCells() })`);
  assert(pinch.view.zoom > 1.35, 'mobile pinch did not zoom');
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
  return {
    viewport: `${round(initial.viewport.width, 2)}x${round(initial.viewport.height, 2)}`,
    canvasAspect: round(initial.canvas.width / initial.canvas.height, 6),
    pinchZoom: round(pinch.view.zoom, 4),
    pinchStrayCells: pinch.occupied,
    singleTouchCell: `${target.x},${target.y}`,
    toolFilterHeight: round(initial.ui.filters.height),
    toolboxGap: round(initial.ui.actions.top - initial.ui.palette.bottom),
    horizontalOverflow: round(initial.ui.horizontalOverflow),
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
    if (Math.abs(current.canvas.width - previous.canvas.width) <= 1
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

async function metrics(cdp) {
  return evaluate(cdp, `(() => {
    const canvas = [...document.querySelectorAll('canvas.world-canvas')]
      .find((candidate) => candidate.getBoundingClientRect().width > 0);
    const viewport = document.querySelector('.viewport');
    const frame = document.querySelector('.viewport-frame');
    const palette = document.querySelector('.palette');
    const actions = document.querySelector('.actions');
    const filters = document.querySelector('.tool-filters');
    const filterButtons = [...document.querySelectorAll('.tool-filter')];
    if (!canvas || !viewport || !frame || !palette || !actions || !filters || !filterButtons.length) {
      throw new Error('Missing browser-audit geometry');
    }
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
    };
    return {
      canvas: box(canvas), viewport: box(viewport), frame: box(frame),
      backing: { width: canvas.width, height: canvas.height },
      outputScale: canvas.dataset.outputScale,
      backend: window.__ANIFOR_INPUT_AUDIT__.backend(),
      dpr: devicePixelRatio, window: { width: innerWidth, height: innerHeight },
      ui: {
        palette: box(palette), actions: box(actions), filters: box(filters),
        filterButtons: filterButtons.map(box),
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      },
    };
  })()`);
}

function assertGeometry(value, label) {
  assert(Math.abs(value.canvas.width / value.canvas.height - WORLD_ASPECT) < 0.0001, `${label}: canvas aspect changed`);
  assert(value.backing.width === 1224 && value.backing.height === 768, `${label}: backing is ${value.backing.width}x${value.backing.height}`);
  assert(value.outputScale === '2', `${label}: outputScale is ${value.outputScale}`);
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
