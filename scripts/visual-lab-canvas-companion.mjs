import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { lstat, mkdir, realpath, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  buildVisualLabCanvasPreparationExpression,
  buildVisualLabCaptureUrlFromResolvedRequest,
  resolveVisualCaptureRequest,
} from './visual-lab-fixtures.mjs';
import { readVisualLabRecipeSet } from './visual-lab-recipe-set.mjs';
import { resolveVisualLabCaptureRecipe } from './visual-lab-recipes.mjs';
import {
  connectVisualLabIncognitoPage,
  startVisualLabChromeHost,
} from './visual-lab-chrome-host.mjs';
import {
  disposeVisualLabCandidatePage,
  formatVisualLabCliError,
  normalizeVisualCaptureGeometryObservation,
} from './visual-lab-audit.mjs';
import { VISUAL_CAPTURE_GEOMETRY } from '../src/shared/visual-capture-geometry.js';

const COMMAND_TIMEOUT_MS = 20_000;
const READINESS_TIMEOUT_MS = 30_000;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const formatCanvasCompanionError = formatVisualLabCliError;

const asError = (error) => error instanceof Error ? error : new Error(String(error));

const throwCollectedErrors = (errors, label) => {
  if (errors.length === 0) return;
  if (errors.length === 1) throw errors[0];
  throw new AggregateError(errors, label);
};

const throwIfAborted = (signal) => {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new Error('Canvas companion interrupted');
};

const evaluate = async (cdp, expression, timeoutMs = COMMAND_TIMEOUT_MS) => {
  const response = await cdp.send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  }, timeoutMs);
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description
      ?? response.exceptionDetails.text ?? 'Runtime.evaluate failed');
  }
  return response.result.value;
};

const waitFor = async (operation, timeoutMs, label, signal) => {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    throwIfAborted(signal);
    try {
      const result = await operation();
      if (result) return result;
    } catch (error) { lastError = asError(error); }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
};

const collectBrowserErrors = (cdp) => {
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
};

const pngDimensions = (bytes) => {
  if (bytes.length < 24
    || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
    || bytes.readUInt32BE(8) !== 13
    || bytes.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error('Canvas companion capture is not a canonical PNG');
  }
  return Object.freeze({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });
};

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export function groupCanvasCompanionRecipes(recipeSet) {
  if (!Array.isArray(recipeSet?.recipes) || recipeSet.recipes.length === 0) {
    throw new TypeError('Canvas companion requires a non-empty recipe set');
  }
  const groups = new Map();
  for (const recipe of recipeSet.recipes) {
    const canonical = resolveVisualLabCaptureRecipe(recipe.name);
    if (!isDeepStrictEqual(recipe, canonical)) {
      throw new Error(`Canvas companion recipe ${recipe.name} is not the current catalog record`);
    }
    const resolved = resolveVisualCaptureRequest(recipe);
    const fixedParameters = Object.entries(resolved.domainAdapter.fixedUrlParameters)
      .sort(([left], [right]) => left.localeCompare(right));
    const key = JSON.stringify({
      fixture: recipe.fixture,
      renderScale: recipe.renderScale,
      fixedParameters,
    });
    const existing = groups.get(key);
    if (existing) existing.candidates.push(recipe.name);
    else groups.set(key, { recipe, candidates: [recipe.name] });
  }
  return Object.freeze([...groups.values()].map(({ recipe, candidates }) => Object.freeze({
    recipe,
    candidates: Object.freeze(candidates),
  })));
}

export function buildCanvasCompanionUrl(baseUrl, recipe) {
  const resolved = resolveVisualCaptureRequest(recipe);
  const url = buildVisualLabCaptureUrlFromResolvedRequest(baseUrl, recipe, resolved);
  url.searchParams.set('renderer', 'canvas2d');
  for (const name of ['visualLab', 'visualVariant', 'visualTarget', 'visualGain']) {
    url.searchParams.delete(name);
  }
  return Object.freeze({ url, resolved });
}

const observeCanvasGeometry = (cdp) => evaluate(cdp, `(() => {
  const root = document.querySelector('#app');
  const canvas = document.querySelector('.fallback-field-canvas');
  const rect = canvas?.getBoundingClientRect();
  const visualViewport = window.visualViewport;
  return {
    rootMarker: root?.dataset.visualCaptureLayout ?? null,
    viewport: {
      width: visualViewport?.width,
      height: visualViewport?.height,
      visualScale: visualViewport?.scale,
      devicePixelRatio: window.devicePixelRatio,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    },
    canvas: canvas && rect ? {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      backingWidth: canvas.width,
      backingHeight: canvas.height,
    } : null,
  };
})()`);

const captureCanvasFixture = async ({
  host, baseUrl, group, outputDirectory, signal,
}) => {
  throwIfAborted(signal);
  const { recipe } = group;
  // The companion observes the fallback baseline only. It deletes the normal
  // driver's visual selector rather than translating OFF/A/B into Canvas.
  const { url, resolved } = buildCanvasCompanionUrl(baseUrl, recipe);
  let page;
  let browserErrors = [];
  let captureError;
  let result;
  try {
    page = await connectVisualLabIncognitoPage({
      browserWebSocketDebuggerUrl: host.browserWebSocketDebuggerUrl,
      url,
    });
    const { pageCdp: cdp } = page;
    browserErrors = collectBrowserErrors(cdp);
    await Promise.all([
      cdp.send('Page.enable'), cdp.send('Runtime.enable'), cdp.send('Log.enable'),
      cdp.send('Emulation.setDeviceMetricsOverride', VISUAL_CAPTURE_GEOMETRY.deviceMetrics),
    ]);
    await waitFor(() => evaluate(cdp, `(() => {
      const audit = window.__ANIFOR_INPUT_AUDIT__;
      const canvas = document.querySelector('.fallback-field-canvas');
      const backend = audit?.backend?.();
      return Boolean(audit && canvas && backend?.backend === 'canvas2d'
        && backend?.reason === 'forced');
    })()`), READINESS_TIMEOUT_MS, `${recipe.name} forced Canvas startup`, signal);
    const preparation = await evaluate(
      cdp, buildVisualLabCanvasPreparationExpression(resolved.fixtureAdapter),
    );
    if (preparation?.fixturePrepared !== true) {
      throw new Error(
        `Canvas companion fixture ${recipe.fixture} was not prepared: ${JSON.stringify(preparation)}`,
      );
    }
    const observation = await waitFor(() => evaluate(cdp, `(async () => {
      const audit = window.__ANIFOR_INPUT_AUDIT__;
      const canvas = document.querySelector('.fallback-field-canvas');
      if (!audit || !canvas) return false;
      await new Promise((resolve) => requestAnimationFrame(
        () => requestAnimationFrame(resolve),
      ));
      const backend = audit.backend();
      const semantic = audit.materialPlaneDigest();
      const timing = audit.canvasPresentationTiming?.();
      const rect = canvas.getBoundingClientRect();
      if (backend.backend !== 'canvas2d' || backend.reason !== 'forced'
        || canvas.dataset.renderer !== 'semantic-field-canvas2d'
        || semantic.occupied <= 0
        || !timing || timing.sequence <= ${Number(preparation.canvasSequenceBefore)}) return false;
      return {
        backend,
        renderer: canvas.dataset.renderer,
        backingSize: canvas.dataset.backingSize,
        semanticOccupied: semantic.occupied,
        presentationSequence: timing.sequence,
        geometry: {
          rootMarker: document.querySelector('#app')?.dataset.visualCaptureLayout ?? null,
          viewport: {
            width: visualViewport?.width, height: visualViewport?.height,
            devicePixelRatio, visualScale: visualViewport?.scale,
            scrollX, scrollY,
          },
          canvas: {
            left: rect.left, top: rect.top, width: rect.width, height: rect.height,
            backingWidth: canvas.width, backingHeight: canvas.height,
          },
        },
      };
    })()`), READINESS_TIMEOUT_MS, `${recipe.name} populated Canvas frame`, signal);
    const expectedGeometry = normalizeVisualCaptureGeometryObservation(
      observation.geometry, recipe.renderScale,
    );
    assert.equal(observation.backend.outputScale, recipe.renderScale);
    assert.equal(
      observation.backingSize,
      `${expectedGeometry.canvas.backingWidth}x${expectedGeometry.canvas.backingHeight}`,
    );
    if (browserErrors.length > 0) {
      throw new Error(`Canvas companion browser errors: ${browserErrors.join(' | ')}`);
    }
    const screenshot = await cdp.send('Page.captureScreenshot', {
      format: 'png', fromSurface: true, captureBeyondViewport: true,
      clip: {
        x: expectedGeometry.canvas.left,
        y: expectedGeometry.canvas.top,
        width: expectedGeometry.canvas.width,
        height: expectedGeometry.canvas.height,
        scale: expectedGeometry.canvas.clipScale,
      },
    }, COMMAND_TIMEOUT_MS);
    const postCaptureGeometry = normalizeVisualCaptureGeometryObservation(
      await observeCanvasGeometry(cdp), recipe.renderScale,
    );
    assert.deepEqual(postCaptureGeometry, expectedGeometry);
    const bytes = Buffer.from(screenshot.data, 'base64');
    const dimensions = pngDimensions(bytes);
    assert.equal(dimensions.width, expectedGeometry.canvas.width);
    assert.equal(dimensions.height, expectedGeometry.canvas.height);
    const filename = `${recipe.fixture}-${recipe.renderScale}x.png`;
    await writeFile(path.join(outputDirectory, filename), bytes, { flag: 'wx' });
    result = Object.freeze({
      fixture: recipe.fixture,
      candidates: group.candidates,
      renderScale: recipe.renderScale,
      backend: 'canvas2d',
      backendReason: 'forced',
      renderer: observation.renderer,
      semanticOccupied: observation.semanticOccupied,
      presentationSequence: observation.presentationSequence,
      png: filename,
      bytes: bytes.byteLength,
      ...dimensions,
      geometry: expectedGeometry,
    });
  } catch (error) {
    captureError = asError(error);
  }
  const cleanupErrors = [];
  if (page) {
    try {
      await disposeVisualLabCandidatePage({
        pageCdp: page.pageCdp, browserErrors, required: captureError === undefined,
      });
    } catch (error) { cleanupErrors.push(asError(error)); }
    try { await page.close(); }
    catch (error) { cleanupErrors.push(asError(error)); }
  }
  throwCollectedErrors(
    [captureError, ...cleanupErrors].filter(Boolean),
    `Canvas companion ${recipe.fixture} capture or teardown failed`,
  );
  return result;
};

const renderIndex = (manifest) => `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Canvas fallback companion — ${escapeHtml(manifest.recipeSet.name)}</title>
<style>body{margin:24px;background:#17191d;color:#e8edf2;font:15px system-ui}main{max-width:1100px;margin:auto}section{margin:20px 0;padding:16px;background:#22262c;border-radius:12px}img{display:block;max-width:100%;height:auto;background:#090b0d;border-radius:8px}code{color:#b9d8ff}</style>
<main><h1>Canvas fallback companion</h1>
<p>Current-only diagnostic. WebGL remains canonical; these baseline-only images make no visual-parity claim.</p>
${manifest.captures.map((capture) => `<section><h2>${escapeHtml(capture.fixture)}</h2>
<p><code>${escapeHtml(capture.candidates.join(', '))}</code> · ${capture.renderScale}× · forced Canvas2D</p>
<a href="${escapeHtml(capture.png)}"><img src="${escapeHtml(capture.png)}" width="${capture.width}" height="${capture.height}" alt="${escapeHtml(capture.fixture)} Canvas fallback"></a></section>`).join('\n')}
</main></html>\n`;

/**
 * Captures one forced-Canvas baseline per distinct fixture/scale in a verified
 * current recipe set. The output is local diagnostic navigation evidence only.
 */
export async function runVisualLabCanvasCompanion(options = {}) {
  const recipeSetPath = path.resolve(options.recipeSetPath);
  const bundle = path.resolve(options.bundle);
  const reviewRoot = path.resolve(options.reviewRoot);
  const outputDirectory = path.join(reviewRoot, 'canvas-companion');
  const [recipeSet, bundleDetails, reviewDetails, canonicalReviewRoot] = await Promise.all([
    readVisualLabRecipeSet(recipeSetPath), lstat(bundle), lstat(reviewRoot), realpath(reviewRoot),
  ]);
  if (!bundleDetails.isFile() || bundleDetails.isSymbolicLink()) {
    throw new Error('Canvas companion bundle must be a real file');
  }
  if (!reviewDetails.isDirectory() || reviewDetails.isSymbolicLink()) {
    throw new Error('Canvas companion review root must be a real directory');
  }
  const groups = groupCanvasCompanionRecipes(recipeSet);
  await mkdir(outputDirectory);
  const [outputDetails, canonicalOutputDirectory] = await Promise.all([
    lstat(outputDirectory), realpath(outputDirectory),
  ]);
  if (!outputDetails.isDirectory() || outputDetails.isSymbolicLink()
    || path.dirname(canonicalOutputDirectory) !== canonicalReviewRoot
    || (await readdir(canonicalOutputDirectory)).length !== 0) {
    throw new Error('Canvas companion output directory must be empty');
  }
  const baseUrl = pathToFileURL(bundle);
  let host;
  let executionError;
  const captures = [];
  try {
    throwIfAborted(options.signal);
    host = await startVisualLabChromeHost({
      chromePath: options.chrome,
      gpuMode: options.gpu ?? 'swiftshader',
      initialUrl: new URL('about:blank'),
      allowFileAccess: true,
    });
    await host.ready();
    for (const group of groups) {
      captures.push(await captureCanvasFixture({
        host, baseUrl, group, outputDirectory: canonicalOutputDirectory, signal: options.signal,
      }));
      await host.assertHealthy();
    }
  } catch (error) { executionError = asError(error); }
  let teardownError;
  try { await host?.teardown(); }
  catch (error) { teardownError = asError(error); }
  throwCollectedErrors(
    [executionError, teardownError].filter(Boolean),
    'Canvas companion capture and Chrome teardown failed',
  );
  const manifest = Object.freeze({
    schema: 'anifor.visual-lab.canvas-companion/v1',
    canonical: false,
    comparison: 'none',
    selection: 'baseline-only',
    identityPolicy: 'current-only-unhashed',
    recipeSet: Object.freeze({ id: recipeSet.id, name: recipeSet.name }),
    captures: Object.freeze(captures),
  });
  await writeFile(path.join(canonicalOutputDirectory, 'index.html'), renderIndex(manifest), {
    encoding: 'utf8', flag: 'wx',
  });
  await writeFile(
    path.join(canonicalOutputDirectory, 'canvas-companion.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );
  return Object.freeze({
    ok: true,
    outputDirectory: canonicalOutputDirectory,
    manifest,
    index: path.join(canonicalOutputDirectory, 'index.html'),
    receipt: path.join(canonicalOutputDirectory, 'canvas-companion.json'),
  });
}
