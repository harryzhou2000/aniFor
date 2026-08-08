#!/usr/bin/env node

/**
 * Small, dependency-free visual-lab capture harness.
 *
 * This deliberately reuses app-owned deterministic fixtures, the browser
 * input-audit API, WebGL/HDR presenter, and canvas datasets. It does not import
 * or duplicate the broad verify-browser-input.mjs acceptance suite.
 *
 * Start Vite first, then run for example:
 *   npm run dev
 *   node scripts/visual-lab-audit.mjs \
 *     --domain=gas --target=1 --output-dir=/tmp/anifor-gas-lab
 *
 * Gas targets are propagated atmosphere style bytes (0 = wildcard, Smoke =
 * 1, Steam = 2, Oxygen = 4, CO2 = 6, Noble Gas = 7, FOG = 10). Emission
 * targets are semantic material IDs (0 = wildcard).
 */

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  buildVisualLabStartupExpression, resolveVisualLabDomain, resolveVisualLabFixture,
  visualLabDomainNames, visualLabFixtureNames,
} from './visual-lab-fixtures.mjs';
import {
  requestBrowserShutdown, terminateDetachedProcess,
} from './detached-process.mjs';

const CDP_CONNECT_TIMEOUT_MS = 10_000;
const CDP_COMMAND_TIMEOUT_MS = 20_000;
const PAGE_STARTUP_TIMEOUT_MS = 60_000;
const VARIANT_SETTLE_TIMEOUT_MS = 10_000;
const VARIANTS = Object.freeze([
  Object.freeze({ value: 0, name: 'off' }),
  Object.freeze({ value: 1, name: 'a' }),
  Object.freeze({ value: 2, name: 'b' }),
]);

const HELP = `Usage:
  node scripts/visual-lab-audit.mjs [options]

Options (use --name=value):
  --base-url=http://127.0.0.1:5173/  Dev URL or file:///.../dist/index.html
  --bundle=dist/index.html              Built bundle entry (overrides default URL)
  --domain=${visualLabDomainNames().join('|')}         Lab domain (default: gas)
  --target=0..255                      Gas style byte or liquid/emission material ID
  --fixture=${visualLabFixtureNames().join('|')}        App-owned fixture (default: showcase)
  --gain=0.01..2                       RGB-only experiment gain (default: 1)
  --render-scale=1|2|4                 Normal WebGL scale (default: 2)
  --output-dir=/tmp/anifor-visual-lab-gas
  --chrome=/path/to/chrome              Otherwise CHROME_BIN/autodetection
  --gpu=auto|swiftshader                Prefer local GPU; CI can force software
  --help

Gas target codes currently mean propagated atmosphere styles, not material
IDs: wildcard=0, Smoke=1, Steam=2, Oxygen=4, CO2=6, Noble Gas=7, FOG=10.
Emission targets are semantic material IDs; 0 selects every emitting owner.

Outputs: off.png, a.png, b.png, and report.json in --output-dir.`;

function parseArguments(argv) {
  if (argv.includes('--help')) return { help: true };
  const known = new Set([
    'base-url', 'bundle', 'domain', 'target', 'fixture', 'gain', 'render-scale', 'output-dir',
    'chrome', 'gpu',
  ]);
  const values = new Map();
  for (const argument of argv) {
    if (!argument.startsWith('--') || !argument.includes('=')) {
      throw new Error(`Unknown argument ${JSON.stringify(argument)}; options use --name=value`);
    }
    const separator = argument.indexOf('=');
    const name = argument.slice(2, separator);
    if (!known.has(name)) throw new Error(`Unknown option --${name}`);
    values.set(name, argument.slice(separator + 1));
  }

  const domain = values.get('domain') ?? 'gas';
  const domainAdapter = resolveVisualLabDomain(domain);
  const target = Number(values.get('target') ?? 0);
  if (!Number.isInteger(target) || target < 0 || target > 255) {
    throw new Error('--target must be an integer from 0 through 255');
  }
  const fixture = values.get('fixture') ?? 'showcase';
  const fixtureAdapter = resolveVisualLabFixture(fixture, domain, target);
  const gain = Number(values.get('gain') ?? 1);
  if (!Number.isFinite(gain) || gain <= 0 || gain > 2) {
    throw new Error('--gain must be greater than 0 and no greater than 2');
  }
  const renderScale = Number(values.get('render-scale') ?? 2);
  if (![1, 2, 4].includes(renderScale)) {
    throw new Error('--render-scale must be 1, 2, or 4; compact true 8x excludes this lab');
  }
  const gpu = values.get('gpu') ?? 'auto';
  if (gpu !== 'auto' && gpu !== 'swiftshader') {
    throw new Error('--gpu must be auto or swiftshader');
  }

  if (values.has('base-url') && values.has('bundle')) {
    throw new Error('--base-url and --bundle are mutually exclusive');
  }
  if (values.has('bundle') && values.get('bundle') === '') {
    throw new Error('--bundle must name a built index.html file');
  }
  if (values.has('output-dir') && values.get('output-dir') === '') {
    throw new Error('--output-dir must not be empty');
  }
  let baseUrl;
  try {
    baseUrl = values.has('bundle')
      ? pathToFileURL(path.resolve(values.get('bundle')))
      : new URL(values.get('base-url') ?? 'http://127.0.0.1:5173/');
  }
  catch { throw new Error('--base-url must be an absolute HTTP(S) URL'); }
  if (!['http:', 'https:', 'file:'].includes(baseUrl.protocol)) {
    throw new Error('--base-url must use HTTP, HTTPS, or file');
  }

  const fixtureSuffix = fixture === 'showcase' ? '' : `-${fixture}`;
  const defaultOutput = path.join(tmpdir(), `anifor-visual-lab-${domain}${fixtureSuffix}`);
  return Object.freeze({
    help: false,
    baseUrl,
    domain,
    domainAdapter,
    target,
    fixture,
    fixtureAdapter,
    gain,
    renderScale,
    gpu,
    outputDir: path.resolve(values.get('output-dir') ?? defaultOutput),
    chrome: values.get('chrome'),
    bundle: values.has('bundle'),
  });
}

function auditUrl(options) {
  const url = new URL(options.baseUrl);
  const parameters = url.searchParams;
  parameters.set('scene', options.fixtureAdapter.scene);
  parameters.set('inputAudit', '1');
  parameters.set('auditStage', 'visual-lab');
  parameters.set('renderLook', 'realistic');
  parameters.set('renderScale', String(options.renderScale));
  // Retain the diagnostic default framebuffer for the alpha/support proof.
  parameters.set('visualLabAudit', '1');
  parameters.set('visualLab', options.domain);
  parameters.set('visualVariant', '0');
  // The target is domain-specific: gas consumes a propagated atmosphere style
  // byte, while liquid and emission consume semantic material IDs.
  parameters.set('visualTarget', String(options.target));
  parameters.set('visualGain', String(options.gain));
  for (const [name, value] of Object.entries(options.domainAdapter.urlParameters)) {
    parameters.set(name, value);
  }
  parameters.delete('renderer');
  return url;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${HELP}\n`);
    return;
  }

  const url = auditUrl(options);
  await ensureServer(url, options.bundle);
  await mkdir(options.outputDir, { recursive: true });
  const chromePath = await resolveChrome(options.chrome);
  let cdp;
  let chrome;
  let profile;
  let cleanupPromise;
  const cleanup = () => {
    cleanupPromise ??= (async () => {
      await requestBrowserShutdown(cdp);
      const terminated = await terminateDetachedProcess(chrome);
      if (!terminated) {
        throw new Error(`Chrome process group ${chrome?.pid ?? 'unknown'} survived cleanup`);
      }
      if (profile) await rm(profile, { recursive: true, force: true });
    })();
    return cleanupPromise;
  };
  const onSignal = (signal) => {
    void cleanup().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
  };
  const onSigint = () => onSignal('SIGINT');
  const onSigterm = () => onSignal('SIGTERM');
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);
  try {
    profile = await mkdtemp(path.join(tmpdir(), 'anifor-visual-lab-chrome-'));
    const gpuFlags = options.gpu === 'swiftshader'
      ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
      : ['--enable-webgl', '--ignore-gpu-blocklist'];
    chrome = spawn(chromePath, [
      '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
      '--no-proxy-server', '--remote-debugging-port=0',
      ...(url.protocol === 'file:' ? ['--allow-file-access-from-files'] : []),
      `--user-data-dir=${profile}`, '--window-size=1280,720',
      '--force-device-scale-factor=1', '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding', ...gpuFlags, url.href,
    ], { detached: true, stdio: ['ignore', 'ignore', 'pipe'] });

    const target = await findChromeTarget(chrome, url);
    cdp = await Cdp.connect(target.webSocketDebuggerUrl);
    const browserErrors = collectBrowserErrors(cdp);
    await Promise.all([
      cdp.send('Page.enable'), cdp.send('Runtime.enable'), cdp.send('Log.enable'),
    ]);
    // Launch directly at the fixture URL. Navigating an already attached blank
    // target over CDP can withhold its acknowledgement while SwiftShader is
    // compiling, making a healthy load indistinguishable from a protocol hang.
    const startupSelection = await stageVariantDuringStartup(cdp, options);
    assert(startupSelection.backendBeforeSelection === 'canvas2d'
      && startupSelection.backendReasonBeforeSelection === 'webgl-starting'
      && startupSelection.stagedBeforeWebGL === true
      && startupSelection.fixture === options.fixture
      && startupSelection.fixturePrepared === true
      && startupSelection.scene === options.fixtureAdapter.scene
      && startupSelection.preparation
        === (options.fixtureAdapter.preparation?.method ?? 'scene'),
    `Visual Lab selector was not staged during bounded Canvas startup: ${JSON.stringify(startupSelection)}`);
    await waitForPage(cdp, options, 2);

    await evaluate(cdp, `(() => {
      const audit = window.__ANIFOR_INPUT_AUDIT__;
      audit.refreshPresentationFields();
      return new Promise((resolve) => requestAnimationFrame(() =>
        requestAnimationFrame(() => resolve(true))));
    })()`);
    await waitFor(async () => {
      const snapshot = await snapshotState(cdp, options.domainAdapter.fieldAlphaMethod);
      return snapshot.semantic.occupied > 0
        && snapshot.fieldAlpha.nonzero > 0
        && snapshot.framebufferAlpha.nonzero > 0;
    }, PAGE_STARTUP_TIMEOUT_MS, `populated ${options.fixture} presentation fields`);

    const captures = {};
    for (const variant of VARIANTS) {
      captures[variant.name] = await captureVariant(cdp, options, variant);
    }

    const reference = captures.off.state;
    const invariants = {
      semantic: VARIANTS.every(({ name }) => sameDigest(
        reference.semantic, captures[name].state.semantic,
      )),
      fieldAlpha: VARIANTS.every(({ name }) => sameDigest(
        reference.fieldAlpha, captures[name].state.fieldAlpha,
      )),
      framebufferAlpha: VARIANTS.every(({ name }) => sameDigest(
        reference.framebufferAlpha, captures[name].state.framebufferAlpha,
      )),
    };
    assert(invariants.semantic, 'visual variants changed the semantic material plane');
    assert(invariants.fieldAlpha, `${options.domain} visual variants changed field alpha/support`);
    assert(invariants.framebufferAlpha, 'visual variants changed WebGL framebuffer alpha/support');
    assert(browserErrors.length === 0, `browser errors: ${browserErrors.join(' | ')}`);

    const compactCaptures = Object.fromEntries(VARIANTS.map(({ name }) => [name, {
      png: captures[name].png,
      bytes: captures[name].bytes,
      sha256: captures[name].sha256,
      distinctFromOff: captures[name].sha256 !== captures.off.sha256,
      dataset: captures[name].state.dataset,
    }]));
    const warnings = [];
    if (!compactCaptures.a.distinctFromOff && !compactCaptures.b.distinctFromOff) {
      warnings.push('A and B PNGs are byte-identical to off; check target ownership or gain');
    }
    const report = {
      tool: 'visual-lab-audit-v1',
      url: url.href,
      domain: options.domain,
      target: options.target,
      fixture: options.fixture,
      fixtureScene: options.fixtureAdapter.scene,
      fixturePreparation: options.fixtureAdapter.preparation?.method ?? 'scene',
      targetKind: options.domainAdapter.targetKind,
      gain: options.gain,
      renderScale: options.renderScale,
      gpu: options.gpu,
      startupSelection,
      backend: reference.backend.backend,
      hdrPipeline: reference.dataset.hdrPipeline,
      backingSize: reference.dataset.backingSize,
      invariants,
      semantic: reference.semantic,
      fieldAlpha: reference.fieldAlpha,
      framebufferAlpha: reference.framebufferAlpha,
      captures: compactCaptures,
      browserErrors: browserErrors.length,
      warnings,
    };
    const encodedReport = `${JSON.stringify(report)}\n`;
    const reportPath = path.join(options.outputDir, 'report.json');
    await writeFile(reportPath, encodedReport);
    process.stdout.write(JSON.stringify({ ...report, report: reportPath }));
    process.stdout.write('\n');
  } finally {
    await cleanup();
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
  }
}

async function ensureServer(url, requireBundleFile = false) {
  if (url.protocol === 'file:') {
    const entry = fileURLToPath(url);
    try {
      if (requireBundleFile) {
        const entryStat = await stat(entry);
        if (!entryStat.isFile()) throw new Error('not a file');
      } else {
        await access(entry);
      }
    } catch { throw new Error(`Cannot read production bundle ${entry}`); }
    return;
  }
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  } catch (error) {
    throw new Error(
      `Cannot reach ${url.origin}; start the app first with "npm run dev" (${error})`,
    );
  }
  if (!response.ok) {
    throw new Error(`Cannot load ${url.href}: HTTP ${response.status}`);
  }
}

async function resolveChrome(explicit) {
  const candidates = [
    explicit, process.env.CHROME_BIN, '/usr/bin/google-chrome',
    '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch { /* try the next candidate */ }
  }
  throw new Error('Chrome/Chromium not found; pass --chrome=/path or set CHROME_BIN');
}

async function findChromeTarget(chrome, expectedUrl) {
  let chromeLog = '';
  const browserSocket = await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback) => (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      chrome.stderr.off('data', onStderr);
      chrome.off('exit', onExit);
      chrome.off('error', onError);
      callback(value);
    };
    const timeout = setTimeout(() => {
      finish(reject)(new Error(`Chrome DevTools timeout\n${chromeLog.slice(-4_000)}`));
    }, 15_000);
    const onStderr = (chunk) => {
      chromeLog = `${chromeLog}${chunk}`.slice(-8_000);
      const match = chromeLog.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (!match) return;
      finish(resolve)(match[1]);
    };
    const onExit = (code) => finish(reject)(
      new Error(`Chrome exited before DevTools (${code})\n${chromeLog}`),
    );
    const onError = (error) => finish(reject)(
      new Error(`Chrome failed to start: ${error instanceof Error ? error.message : String(error)}`),
    );
    chrome.stderr.on('data', onStderr);
    chrome.once('exit', onExit);
    chrome.once('error', onError);
  });
  const port = new URL(browserSocket).port;
  return waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(2_000),
    });
    const targets = await response.json();
    return targets.find((candidate) => candidate.type === 'page'
      && candidate.url === expectedUrl.href && candidate.webSocketDebuggerUrl);
  }, 10_000, 'Chrome page target');
}

function collectBrowserErrors(cdp) {
  const errors = [];
  cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    errors.push(exceptionDetails?.exception?.description
      ?? exceptionDetails?.text ?? 'Runtime exception');
  });
  cdp.on('Runtime.consoleAPICalled', ({ type, args }) => {
    if (type !== 'error' && type !== 'assert') return;
    errors.push(args.map((argument) => argument.value ?? argument.description).join(' '));
  });
  cdp.on('Log.entryAdded', ({ entry }) => {
    if (entry.level === 'error') errors.push(entry.text);
  });
  return errors;
}

async function stageVariantDuringStartup(cdp, options) {
  const expression = buildVisualLabStartupExpression(options.fixtureAdapter, 2);
  return waitFor(
    () => evaluate(cdp, expression),
    PAGE_STARTUP_TIMEOUT_MS,
    `${options.fixture} startup audit bridge`,
  );
}

async function waitForPage(cdp, options, expectedVariant) {
  const readinessExpression = `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const canvas = document.querySelector('.semantic-field-canvas');
    const root = document.querySelector('[data-scene]');
    if (!audit || !canvas || !root
      || root.dataset.scene !== ${JSON.stringify(options.fixtureAdapter.scene)}
      || typeof audit.setVisualLabVariant !== 'function') {
      return false;
    }
    const dataset = canvas.dataset;
    const backend = audit.backend();
    const expectedBacking = (audit.width * ${options.renderScale}) + 'x'
      + (audit.height * ${options.renderScale});
    return backend.backend === 'webgl'
      && backend.outputScale === ${options.renderScale}
      && dataset.renderer === 'semantic-field-webgl'
      && dataset.hdrPipeline === 'active'
      && dataset.renderLook === 'realistic'
      && Number(dataset.outputScale) === ${options.renderScale}
      && dataset.backingSize === expectedBacking
      && dataset.visualLabDomain === ${JSON.stringify(options.domain)}
      && Number(dataset.visualLabTarget) === ${options.target}
      && Number(dataset.visualLabGain) === ${options.gain}
      && dataset.visualLabVariant === ${JSON.stringify(String(expectedVariant))}
      && dataset.visualLab === ${JSON.stringify(expectedVariant === 0 ? 'inactive' : 'active')};
  })()`;
  try {
    await waitFor(
      () => evaluate(cdp, readinessExpression),
      PAGE_STARTUP_TIMEOUT_MS,
      'WebGL/HDR visual-lab page',
    );
  } catch (error) {
    const diagnostic = await evaluate(cdp, `(() => {
      const audit = window.__ANIFOR_INPUT_AUDIT__;
      const canvas = document.querySelector('.semantic-field-canvas');
      return {
        href: location.href,
        title: document.title,
        scene: document.querySelector('[data-scene]')?.dataset.scene,
        hasAudit: Boolean(audit),
        backend: audit?.backend?.(),
        hasCanvas: Boolean(canvas),
        dataset: canvas ? { ...canvas.dataset } : undefined,
        bodyText: document.body?.innerText?.slice(0, 500),
      };
    })()`).catch((diagnosticError) => ({ diagnosticError: String(diagnosticError) }));
    throw new Error(`${error.message}: ${JSON.stringify(diagnostic)}`);
  }
}

async function captureVariant(cdp, options, variant) {
  await evaluate(cdp, `(() => {
    window.__ANIFOR_INPUT_AUDIT__.setVisualLabVariant(${variant.value});
    return new Promise((resolve) => requestAnimationFrame(() =>
      requestAnimationFrame(() => resolve(true))));
  })()`);
  await waitFor(() => evaluate(cdp, `(() => {
    const canvas = document.querySelector('.semantic-field-canvas');
    return Boolean(canvas)
      && canvas.dataset.visualLabVariant === ${JSON.stringify(String(variant.value))}
      && canvas.dataset.visualLab === ${JSON.stringify(variant.value === 0 ? 'inactive' : 'active')}
      && canvas.dataset.visualLabDomain === ${JSON.stringify(options.domain)}
      && Number(canvas.dataset.visualLabTarget) === ${options.target}
      && Number(canvas.dataset.visualLabGain) === ${options.gain};
  })()`), VARIANT_SETTLE_TIMEOUT_MS, `${variant.name} lab dataset`);

  const state = await snapshotState(cdp, options.domainAdapter.fieldAlphaMethod);
  assertVariantState(state, options, variant);
  const clip = await evaluate(cdp, `(() => {
    const rect = document.querySelector('.semantic-field-canvas').getBoundingClientRect();
    return {
      x: rect.left + scrollX,
      y: rect.top + scrollY,
      width: rect.width,
      height: rect.height,
      scale: 1,
    };
  })()`);
  assert(clip.width > 0 && clip.height > 0, `${variant.name} canvas has an empty visual rect`);
  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png', fromSurface: true, captureBeyondViewport: true, clip,
  }, CDP_COMMAND_TIMEOUT_MS);
  const bytes = Buffer.from(screenshot.data, 'base64');
  const png = path.join(options.outputDir, `${variant.name}.png`);
  await writeFile(png, bytes);
  return {
    state,
    png,
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function assertVariantState(state, options, variant) {
  const expectedBacking = `${state.world.width * options.renderScale}x${state.world.height * options.renderScale}`;
  assert(state.backend.backend === 'webgl', `${variant.name} did not use WebGL`);
  assert(state.backend.outputScale === options.renderScale,
    `${variant.name} backend scale is ${state.backend.outputScale}, expected ${options.renderScale}`);
  assert(state.dataset.renderer === 'semantic-field-webgl', `${variant.name} renderer dataset is wrong`);
  assert(state.dataset.hdrPipeline === 'active', `${variant.name} HDR pipeline is inactive`);
  assert(state.dataset.renderLook === 'realistic', `${variant.name} render look is not realistic`);
  assert(state.dataset.backingSize === expectedBacking,
    `${variant.name} backing is ${state.dataset.backingSize}, expected ${expectedBacking}`);
  assert(state.dataset.visualLabDomain === options.domain, `${variant.name} lab domain is wrong`);
  assert(Number(state.dataset.visualLabTarget) === options.target, `${variant.name} lab target is wrong`);
  assert(Number(state.dataset.visualLabGain) === options.gain, `${variant.name} lab gain is wrong`);
  assert(Number(state.dataset.visualLabVariant) === variant.value, `${variant.name} selector is wrong`);
  assert(state.dataset.visualLab === (variant.value === 0 ? 'inactive' : 'active'),
    `${variant.name} lab activation dataset is wrong`);
  assert(state.semantic.occupied > 0, `${variant.name} showcase semantic plane is empty`);
  assert(state.fieldAlpha.nonzero > 0, `${variant.name} ${options.domain} field is empty`);
  assert(state.framebufferAlpha.nonzero > 0, `${variant.name} WebGL framebuffer alpha is empty`);
}

async function snapshotState(cdp, fieldAlphaMethod) {
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const canvas = document.querySelector('.semantic-field-canvas');
    if (!audit || !canvas) throw new Error('visual-lab audit API/canvas disappeared');
    const digestBytes = (read, width, height) => {
      let hash = 2166136261 >>> 0;
      let supportHash = 2166136261 >>> 0;
      let alphaSum = 0;
      let nonzero = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = y * width + x;
          const byte = Math.round(Math.max(0, Math.min(255, Number(read(x, y)) || 0)));
          const supported = Number(byte > 0);
          hash = Math.imul((hash ^ byte ^ index) >>> 0, 16777619) >>> 0;
          supportHash = Math.imul((supportHash ^ supported ^ index) >>> 0, 16777619) >>> 0;
          alphaSum += byte;
          nonzero += supported;
        }
      }
      return { hash, supportHash, alphaSum, nonzero };
    };
    const material = audit.materialPlaneDigest();
    let countHash = 2166136261 >>> 0;
    for (let index = 0; index < material.materialCounts.length; index++) {
      countHash = Math.imul(
        (countHash ^ material.materialCounts[index] ^ index) >>> 0, 16777619,
      ) >>> 0;
    }
    const fieldAlphaMethod = ${JSON.stringify(fieldAlphaMethod)};
    if (typeof audit[fieldAlphaMethod] !== 'function') {
      throw new Error('visual-lab field alpha reader is unavailable: ' + fieldAlphaMethod);
    }
    const readField = (x, y) => audit[fieldAlphaMethod](x, y);
    const fieldAlpha = digestBytes(readField, audit.width, audit.height);
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) throw new Error('semantic-field canvas has no readable WebGL context');
    const rgba = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    const framebufferAlpha = digestBytes(
      (x, y) => rgba[(y * canvas.width + x) * 4 + 3], canvas.width, canvas.height,
    );
    const rect = canvas.getBoundingClientRect();
    return {
      world: { width: audit.width, height: audit.height },
      backend: audit.backend(),
      dataset: {
        renderer: canvas.dataset.renderer,
        hdrPipeline: canvas.dataset.hdrPipeline,
        renderLook: canvas.dataset.renderLook,
        outputScale: canvas.dataset.outputScale,
        backingSize: canvas.dataset.backingSize,
        visualLab: canvas.dataset.visualLab,
        visualLabDomain: canvas.dataset.visualLabDomain,
        visualLabVariant: canvas.dataset.visualLabVariant,
        visualLabTarget: canvas.dataset.visualLabTarget,
        visualLabGain: canvas.dataset.visualLabGain,
      },
      semantic: { hash: material.hash, occupied: material.occupied, countHash },
      fieldAlpha,
      framebufferAlpha,
      canvas: {
        width: canvas.width, height: canvas.height,
        cssWidth: rect.width, cssHeight: rect.height,
      },
    };
  })()`);
}

function sameDigest(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function evaluate(cdp, expression, timeoutMs = CDP_COMMAND_TIMEOUT_MS) {
  const response = await cdp.send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  }, timeoutMs);
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description
      ?? response.exceptionDetails.text ?? 'Runtime.evaluate failed');
  }
  return response.result.value;
}

async function waitFor(check, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(50);
  }
  throw new Error(`${label} timed out${lastError ? `: ${lastError}` : ''}`);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class Cdp {
  static async connect(url, timeoutMs = CDP_CONNECT_TIMEOUT_MS) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        socket.removeEventListener('open', opened);
        socket.removeEventListener('error', failed);
        socket.removeEventListener('close', closed);
      };
      const opened = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error(`CDP connection failed: ${url}`)); };
      const closed = () => { cleanup(); reject(new Error(`CDP closed while connecting: ${url}`)); };
      const timeout = setTimeout(() => {
        cleanup();
        try { socket.close(); } catch { /* not open */ }
        reject(new Error(`CDP connection timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      socket.addEventListener('open', opened, { once: true });
      socket.addEventListener('error', failed, { once: true });
      socket.addEventListener('close', closed, { once: true });
    });
    return new Cdp(socket);
  }

  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.closed = false;
    socket.addEventListener('message', ({ data }) => {
      let message;
      try { message = JSON.parse(data); }
      catch (error) {
        this.fail(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timeout);
        if (message.error) {
          pending.reject(new Error(`${message.error.message}: ${JSON.stringify(message.error.data ?? {})}`));
        } else {
          pending.resolve(message.result ?? {});
        }
        return;
      }
      for (const listener of this.listeners.get(message.method) ?? []) {
        listener(message.params ?? {});
      }
    });
    socket.addEventListener('error', () => {
      this.closed = true;
      this.fail(new Error('CDP WebSocket error'));
    });
    socket.addEventListener('close', () => {
      this.closed = true;
      this.fail(new Error('CDP WebSocket closed'));
    });
  }

  send(method, params = {}, timeoutMs = CDP_COMMAND_TIMEOUT_MS) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      if (this.closed || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error(`Cannot send ${method}: CDP WebSocket is not open`));
        return;
      }
      const timeout = setTimeout(() => {
        if (!this.pending.delete(id)) return;
        reject(new Error(`CDP ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      try { this.socket.send(JSON.stringify({ id, method, params })); }
      catch (error) {
        this.pending.delete(id);
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  fail(error) {
    for (const { reject, timeout } of this.pending.values()) {
      clearTimeout(timeout);
      reject(error);
    }
    this.pending.clear();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.fail(new Error('CDP connection closed by visual-lab audit'));
    try { this.socket.close(); } catch { /* already closed */ }
  }
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    tool: 'visual-lab-audit-v1', ok: false,
    error: error instanceof Error ? error.message : String(error),
  })}\n`);
  process.exitCode = 1;
});
