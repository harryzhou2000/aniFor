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
import { realpathSync } from 'node:fs';
import {
  access, lstat, mkdir, readFile, stat, writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  VISUAL_LAB_CAPTURE_PROTOCOL,
  visualCaptureDomainNames, visualCaptureFixtureNames,
} from './visual-lab-fixtures.mjs';
import { createVisualCaptureExecutionEntry } from './visual-lab-execution-plan.mjs';
import {
  resolveVisualLabCaptureRecipe, visualLabCaptureRecipeNames,
} from './visual-lab-recipes.mjs';
import { createVisualLabResultRecord } from './visual-lab-result.mjs';
import {
  createVisualLabCaptureSubphaseTimingRecorder,
  createVisualLabTimingRecorder,
} from './visual-lab-timing.mjs';
import { VISUAL_LAB_CAPTURE_VARIANTS as VARIANTS } from './visual-lab-capture-abi.mjs';
import {
  Cdp,
  connectVisualLabIncognitoPage,
  removeVisualLabHostArtifacts,
  resolveVisualLabChrome,
  startVisualLabChromeHost,
} from './visual-lab-chrome-host.mjs';
import {
  resolveVisualLabBrowserHostPlanEntry,
} from './visual-lab-browser-host-plan.mjs';
import {
  resolveVisualCaptureExecutionCapabilities,
} from './visual-capture-execution-capabilities.mjs';
import {
  resolveVisualLabExecutionTuningPlanEntry,
  resolveVisualLabExecutionTuningPlanV2Entry,
  resolveVisualLabExecutionTuningPlanV3Entry,
  resolveVisualLabExecutionTuningPlanV4Entry,
  resolveVisualLabExecutionTuningPlanV5Entry,
  resolveVisualLabExecutionTuningPlanV6Entry,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V3_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V4_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V5_SCHEMA,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V6_SCHEMA,
} from './visual-lab-execution-tuning-plan.mjs';
import {
  createVisualCaptureGeometryProof,
  VISUAL_CAPTURE_GEOMETRY,
} from '../src/shared/visual-capture-geometry.js';

export { removeVisualLabHostArtifacts } from './visual-lab-chrome-host.mjs';

const MODULE_PATH = fileURLToPath(import.meta.url);
const CDP_COMMAND_TIMEOUT_MS = 20_000;
const PAGE_STARTUP_TIMEOUT_MS = 60_000;
const RENDERER_DISPOSAL_TIMEOUT_MS = 5_000;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const COMPLETED_FRAME_RECEIPT_SCHEMA = 'anifor.renderer.completed-frame-receipt/v1';
const FRAMEBUFFER_ALPHA_READBACK_SCHEMA = 'anifor.renderer.framebuffer-alpha-readback/v1';
const COMPLETED_FRAME_RECEIPT_DESCRIPTOR = Object.freeze({
  capability: 'renderer-completed-frame-receipt/v1',
  receiptSchema: COMPLETED_FRAME_RECEIPT_SCHEMA,
  requiredState: 'completed',
  bind: 'selected-presentation',
  verifyAfterSnapshot: true,
});
const READINESS_COMPLETED_FRAME_RECEIPT_DESCRIPTOR = Object.freeze({
  ...COMPLETED_FRAME_RECEIPT_DESCRIPTOR,
  bind: 'refreshed-presentation',
});
const SELECTION_OWNED_COMPLETED_FRAME_RECEIPT_DESCRIPTOR = Object.freeze({
  ...COMPLETED_FRAME_RECEIPT_DESCRIPTOR,
  bind: 'selection-owned-presentation',
});
const FIXTURE_ACTIVATION_READINESS_DESCRIPTOR = Object.freeze({
  capability: 'renderer-fixture-activation-generation/v1',
  requiredState: 'completed',
  bind: 'typed-fixture-activation',
  snapshotAfterCompletion: true,
});
const FIXTURE_ACTIVATION_WORK_READINESS_DESCRIPTOR = Object.freeze({
  capability: 'renderer-fixture-activation-generation/v2',
  requiredState: 'completed',
  bind: 'typed-fixture-activation',
  completionScope: 'activation-owned-work',
  snapshotAfterCompletion: true,
});

/**
 * A local production bundle has historically launched its target directly and
 * must retain that exact route. Remote targets are different: attaching CDP to
 * a direct Pages navigation can miss the short Canvas `webgl-starting` stage
 * before the capture bridge is ready. Those targets start blank, receive their
 * protocol/device setup, then navigate while the startup bridge polls.
 */
export function shouldStageVisualLabNavigation(url) {
  const protocol = (url instanceof URL ? url : new URL(url)).protocol;
  return protocol === 'http:' || protocol === 'https:';
}

/** Starts (but deliberately does not await) one bounded HTTP(S) navigation. */
export function beginStagedVisualLabNavigation(pageCdp, url, timeoutMs) {
  const targetUrl = url instanceof URL ? url : new URL(url);
  if (!shouldStageVisualLabNavigation(targetUrl)) {
    throw new TypeError('Staged Visual Lab navigation requires an HTTP(S) URL');
  }
  return pageCdp.send('Page.navigate', { url: targetUrl.href }, timeoutMs).then((result) => {
    if (typeof result?.errorText === 'string' && result.errorText.length > 0) {
      throw new Error(`Chrome Page.navigate failed: ${result.errorText}`);
    }
    return result;
  });
}

const resolveExecutionTuningPlanEntry = (
  plan, entryId, expectedCaptureEntryId,
) => {
  if (plan?.schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA) {
    return resolveVisualLabExecutionTuningPlanV2Entry(plan, entryId, expectedCaptureEntryId);
  }
  if (plan?.schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V3_SCHEMA) {
    return resolveVisualLabExecutionTuningPlanV3Entry(plan, entryId, expectedCaptureEntryId);
  }
  if (plan?.schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V4_SCHEMA) {
    return resolveVisualLabExecutionTuningPlanV4Entry(plan, entryId, expectedCaptureEntryId);
  }
  if (plan?.schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V5_SCHEMA) {
    return resolveVisualLabExecutionTuningPlanV5Entry(plan, entryId, expectedCaptureEntryId);
  }
  if (plan?.schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V6_SCHEMA) {
    return resolveVisualLabExecutionTuningPlanV6Entry(plan, entryId, expectedCaptureEntryId);
  }
  if (plan?.schema === 'anifor.visual-lab.execution-tuning-plan/v1') {
    return resolveVisualLabExecutionTuningPlanEntry(plan, entryId, expectedCaptureEntryId);
  }
  throw new TypeError(`Unsupported Visual Lab execution-tuning schema ${String(plan?.schema)}`);
};

const VISUAL_CAPTURE_GEOMETRY_TOLERANCE = 0.001;

const finiteGeometryNumber = (value, name) => {
  if (!Number.isFinite(value)) {
    throw new TypeError(`Visual capture geometry ${name} must be finite`);
  }
  return value;
};

const assertGeometryClose = (actual, expected, name) => {
  const value = finiteGeometryNumber(actual, name);
  if (Math.abs(value - expected) > VISUAL_CAPTURE_GEOMETRY_TOLERANCE) {
    throw new Error(`Visual capture geometry ${name} is ${value}, expected ${expected}`);
  }
};

/**
 * Validates a page-side layout observation, but returns the shared canonical
 * proof rather than preserving browser float noise in portable audit output.
 */
export function normalizeVisualCaptureGeometryObservation(observation, renderScale) {
  if (observation === null || typeof observation !== 'object' || Array.isArray(observation)) {
    throw new TypeError('Visual capture geometry observation must be an object');
  }
  const expected = createVisualCaptureGeometryProof(renderScale);
  if (observation.rootMarker !== expected.canvas.layoutMarker) {
    throw new Error('Visual capture geometry root marker is not active');
  }
  const viewport = observation.viewport;
  const canvas = observation.canvas;
  if (viewport === null || typeof viewport !== 'object' || Array.isArray(viewport)) {
    throw new TypeError('Visual capture geometry viewport observation must be an object');
  }
  if (canvas === null || typeof canvas !== 'object' || Array.isArray(canvas)) {
    throw new TypeError('Visual capture geometry canvas observation must be an object');
  }
  for (const [name, value] of Object.entries(expected.viewport)) {
    assertGeometryClose(viewport[name], value, `viewport.${name}`);
  }
  for (const name of ['left', 'top', 'width', 'height']) {
    assertGeometryClose(canvas[name], expected.canvas[name], `canvas.${name}`);
  }
  for (const name of ['backingWidth', 'backingHeight']) {
    if (!Number.isSafeInteger(canvas[name]) || canvas[name] !== expected.canvas[name]) {
      throw new Error(
        `Visual capture geometry canvas.${name} is ${String(canvas[name])},`
          + ` expected ${expected.canvas[name]}`,
      );
    }
  }
  return expected;
}

/** Both reads must normalize to the same frozen contract before publication. */
export function assertVisualCaptureGeometryUnchanged(before, after) {
  if (!sameDigest(before, after)) {
    throw new Error('Visual capture geometry drifted during screenshot capture');
  }
  return before;
}

async function observeVisualCaptureGeometry(cdp) {
  const { selector } = VISUAL_CAPTURE_GEOMETRY.captureBox;
  return evaluate(cdp, `(() => {
    const root = document.querySelector('#app');
    const canvas = document.querySelector(${JSON.stringify(selector)});
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
}

async function readVisualCaptureGeometryProof(cdp, renderScale) {
  return normalizeVisualCaptureGeometryObservation(
    await observeVisualCaptureGeometry(cdp), renderScale,
  );
}

/** Exact historical alpha digest over a tightly packed RGBA framebuffer. */
export function digestVisualLabFramebufferAlpha(rgba) {
  let hash = 2166136261 >>> 0;
  let supportHash = 2166136261 >>> 0;
  let alphaSum = 0;
  let nonzero = 0;
  // Preserve the exact per-pixel index/hash grammar while avoiding almost one
  // million callback and coordinate calculations for every 2x proof.
  for (let offset = 3, index = 0; offset < rgba.length; offset += 4, index++) {
    const byte = rgba[offset];
    const supported = Number(byte > 0);
    hash = Math.imul((hash ^ byte ^ index) >>> 0, 16777619) >>> 0;
    supportHash = Math.imul((supportHash ^ supported ^ index) >>> 0, 16777619) >>> 0;
    alphaSum += byte;
    nonzero += supported;
  }
  return { hash, supportHash, alphaSum, nonzero };
}

/** Reuses candidate-page readback storage while preserving one complete read per proof. */
export function reuseVisualLabFramebufferReadback(existing, byteLength) {
  if (existing instanceof Uint8Array && existing.length === byteLength) return existing;
  return new Uint8Array(byteLength);
}

const HELP = `Usage:
  node scripts/visual-lab-audit.mjs [options]

Options (use --name=value):
  --base-url=http://127.0.0.1:5173/  Dev URL or file:///.../dist/index.html
  --bundle=dist/index.html              Built bundle entry (overrides default URL)
  --candidate=<name>                   Named request: ${visualLabCaptureRecipeNames().join('|')}
  --domain=${visualCaptureDomainNames().join('|')}         Capture domain (default: gas)
  --target=0..255                      Domain target selector; 0 is wildcard
  --fixture=${visualCaptureFixtureNames().join('|')}        App-owned fixture (default: showcase)
  --gain=0.01..2                       RGB-only experiment gain (default: 1)
  --render-scale=<domain scale>        Normal WebGL scale (prefers 2)
  --output-dir=/tmp/anifor-visual-lab-gas
  --chrome=/path/to/chrome              Otherwise CHROME_BIN/autodetection
  --gpu=auto|swiftshader                Prefer local GPU; CI can force software
  --browser-host=fresh|shared           Fresh Chrome or supervisor-owned host (Linux only)
  --browser-websocket=ws://...          Internal shared-host DevTools endpoint
  --browser-host-plan=/path/to/plan     Internal shared-host sibling plan
  --browser-host-entry-id=sha256:<hex>  Required shared sibling-plan entry binding
  --execution-tuning-plan=/path/to/plan Declarative readiness/settle sibling plan
  --execution-tuning-entry-id=sha256:<hex> Required tuning-plan entry binding
  --defer-report=0|1                    Stage shared-host report until host teardown
  --lifecycle-file=/path/to/state.json  Optional detached-Chrome cleanup handoff
  --lifecycle-owner=<sha256>             Required root/candidate identity for that handoff
  --execution-plan-id=sha256:<hex>       Optional supervisor binding for a named plan entry
  --help

Outputs: off.png, a.png, b.png, and report.json in --output-dir. Internal shared
mode stages report.pending.json for supervisor publication.`;

function parseArguments(argv) {
  if (argv.includes('--help')) return { help: true };
  const known = new Set([
    'base-url', 'bundle', 'candidate', 'domain', 'target', 'fixture', 'gain', 'render-scale',
    'output-dir', 'chrome', 'gpu', 'browser-host', 'browser-websocket',
    'browser-host-plan', 'browser-host-entry-id', 'defer-report',
    'execution-tuning-plan', 'execution-tuning-entry-id',
    'lifecycle-file', 'lifecycle-owner',
    'execution-plan-id',
  ]);
  const values = new Map();
  for (const argument of argv) {
    if (!argument.startsWith('--') || !argument.includes('=')) {
      throw new Error(`Unknown argument ${JSON.stringify(argument)}; options use --name=value`);
    }
    const separator = argument.indexOf('=');
    const name = argument.slice(2, separator);
    if (!known.has(name)) throw new Error(`Unknown option --${name}`);
    if (values.has(name)) throw new Error(`Option --${name} may only be provided once`);
    values.set(name, argument.slice(separator + 1));
  }

  if (values.has('lifecycle-file') && values.get('lifecycle-file').trim().length === 0) {
    throw new Error('--lifecycle-file must not be empty');
  }
  if (values.has('lifecycle-file') !== values.has('lifecycle-owner')) {
    throw new Error('--lifecycle-file and --lifecycle-owner must be provided together');
  }
  if (values.has('lifecycle-owner')
    && !/^[a-f0-9]{64}$/.test(values.get('lifecycle-owner'))) {
    throw new Error('--lifecycle-owner must be a lowercase SHA-256 identity');
  }
  if (values.has('execution-plan-id')
    && !/^sha256:[a-f0-9]{64}$/.test(values.get('execution-plan-id'))) {
    throw new Error('--execution-plan-id must be a lowercase SHA-256 identity');
  }
  if (values.has('execution-tuning-plan') !== values.has('execution-tuning-entry-id')) {
    throw new Error(
      '--execution-tuning-plan and --execution-tuning-entry-id must be provided together',
    );
  }
  if (values.has('execution-tuning-entry-id')
    && !/^sha256:[a-f0-9]{64}$/.test(values.get('execution-tuning-entry-id'))) {
    throw new Error('--execution-tuning-entry-id must be a lowercase SHA-256 identity');
  }

  const candidate = values.has('candidate')
    ? resolveVisualLabCaptureRecipe(values.get('candidate')) : null;
  if (candidate !== null) {
    const ownedOptions = ['domain', 'target', 'fixture', 'gain', 'render-scale'];
    const conflicts = ownedOptions.filter((name) => values.has(name));
    if (conflicts.length > 0) {
      throw new Error(
        `--candidate=${candidate.name} owns ${ownedOptions.map((name) => `--${name}`).join(', ')};`
        + ` remove conflicting ${conflicts.map((name) => `--${name}`).join(', ')}`,
      );
    }
  }

  const domain = candidate?.domain ?? values.get('domain') ?? 'gas';
  const target = candidate?.target ?? Number(values.get('target') ?? 0);
  if (!Number.isInteger(target) || target < 0 || target > 255) {
    throw new Error('--target must be an integer from 0 through 255');
  }
  const fixture = candidate?.fixture ?? values.get('fixture') ?? 'showcase';
  const gain = candidate?.gain ?? Number(values.get('gain') ?? 1);
  if (!Number.isFinite(gain) || gain <= 0 || gain > 2) {
    throw new Error('--gain must be greater than 0 and no greater than 2');
  }
  const renderScale = candidate?.renderScale
    ?? (values.has('render-scale') ? Number(values.get('render-scale')) : undefined);
  const gpu = values.get('gpu') ?? 'auto';
  if (gpu !== 'auto' && gpu !== 'swiftshader') {
    throw new Error('--gpu must be auto or swiftshader');
  }
  const browserHost = values.get('browser-host') ?? 'fresh';
  if (browserHost !== 'fresh' && browserHost !== 'shared') {
    throw new Error('--browser-host must be fresh or shared');
  }
  const deferReportValue = values.get('defer-report') ?? '0';
  if (deferReportValue !== '0' && deferReportValue !== '1') {
    throw new Error('--defer-report must be 0 or 1');
  }
  const deferReport = deferReportValue === '1';
  if (values.has('browser-host-entry-id')
    && !/^sha256:[a-f0-9]{64}$/.test(values.get('browser-host-entry-id'))) {
    throw new Error('--browser-host-entry-id must be a lowercase SHA-256 identity');
  }
  if (browserHost === 'shared') {
    const required = ['browser-websocket', 'browser-host-plan', 'browser-host-entry-id'].filter(
      (name) => !values.has(name),
    );
    if (required.length > 0) {
      throw new Error(
        `--browser-host=shared requires ${required.map((name) => `--${name}`).join(', ')}`,
      );
    }
    if (!deferReport) {
      throw new Error('--browser-host=shared requires --defer-report=1');
    }
    const conflicts = ['chrome', 'lifecycle-file', 'lifecycle-owner'].filter(
      (name) => values.has(name),
    );
    if (conflicts.length > 0) {
      throw new Error(
        `--browser-host=shared does not own Chrome lifecycle; remove ${
          conflicts.map((name) => `--${name}`).join(', ')
        }`,
      );
    }
  } else {
    if (values.has('browser-websocket') || values.has('browser-host-plan')
      || values.has('browser-host-entry-id')) {
      throw new Error(
        '--browser-websocket, --browser-host-plan, and --browser-host-entry-id'
          + ' require --browser-host=shared',
      );
    }
    if (deferReport) throw new Error('--defer-report=1 requires --browser-host=shared');
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
  for (const name of ['browser-websocket', 'browser-host-plan', 'execution-tuning-plan']) {
    if (values.has(name) && values.get(name).trim().length === 0) {
      throw new Error(`--${name} must not be empty`);
    }
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
  const outputIdentity = candidate?.name ?? `${domain}${fixtureSuffix}`;
  const defaultOutput = path.join(tmpdir(), `anifor-visual-lab-${outputIdentity}`);
  const outputDir = path.resolve(values.get('output-dir') ?? defaultOutput);
  const executionPlan = createVisualCaptureExecutionEntry({
    candidate: candidate?.name ?? null,
    request: { domain, target, fixture, gain, renderScale },
    baseUrl,
    outputDir,
    artifactRoot: outputDir,
    artifactKey: outputIdentity,
    gpu,
  });
  if (values.has('execution-plan-id') && candidate === null) {
    throw new Error('--execution-plan-id requires --candidate');
  }
  if (values.has('execution-tuning-plan') && candidate === null) {
    throw new Error('--execution-tuning-plan requires --candidate');
  }
  if (values.has('execution-plan-id')
    && values.get('execution-plan-id') !== executionPlan.inspection.id) {
    throw new Error(
      `Visual capture execution plan mismatch: expected ${values.get('execution-plan-id')},`
      + ` resolved ${executionPlan.inspection.id}`,
    );
  }
  const lifecycleFile = values.has('lifecycle-file')
    ? path.resolve(values.get('lifecycle-file')) : undefined;
  if (values.has('execution-plan-id') && lifecycleFile !== undefined
    && lifecycleFile !== executionPlan.runtime.lifecycleFile) {
    throw new Error(
      'Visual capture execution runtime mismatch: lifecycle handoff is outside'
      + ' the planned artifact root',
    );
  }
  return Object.freeze({
    help: false,
    baseUrl,
    executionPlan,
    candidate: executionPlan.candidate,
    domain: executionPlan.request.domain,
    domainAdapter: executionPlan.domainAdapter,
    captureDriver: executionPlan.captureDriver,
    target: executionPlan.request.target,
    fixture: executionPlan.request.fixture,
    fixtureAdapter: executionPlan.fixtureAdapter,
    gain: executionPlan.request.gain,
    renderScale: executionPlan.request.renderScale,
    gpu,
    browserHost,
    browserWebSocket: values.get('browser-websocket'),
    browserHostPlanFile: values.has('browser-host-plan')
      ? path.resolve(values.get('browser-host-plan')) : undefined,
    browserHostEntryId: values.get('browser-host-entry-id'),
    executionTuningPlanFile: values.has('execution-tuning-plan')
      ? path.resolve(values.get('execution-tuning-plan')) : undefined,
    executionTuningEntryId: values.get('execution-tuning-entry-id'),
    deferReport,
    outputDir,
    chrome: values.get('chrome'),
    lifecycleFile,
    lifecycleOwner: values.get('lifecycle-owner'),
    bundle: values.has('bundle'),
  });
}

async function captureVisualLabCandidateEvidence({
  entry,
  executionTuningEntry,
  executionTuningProof,
  pageCdp,
  gpuMode,
  browserErrors,
  captureSubphases,
  measure = async (_phase, operation) => operation(),
}) {
  const options = Object.freeze({
    executionPlan: entry,
    candidate: entry.candidate,
    domain: entry.request.domain,
    domainAdapter: entry.domainAdapter,
    captureDriver: entry.captureDriver,
    target: entry.request.target,
    fixture: entry.request.fixture,
    fixtureAdapter: entry.fixtureAdapter,
    gain: entry.request.gain,
    renderScale: entry.request.renderScale,
    gpu: gpuMode,
    executionTuning: executionTuningEntry,
  });
  const cdp = pageCdp;
  let startupFixtureActivationTicket;
  const startupSelection = await measure('startup', async () => {
    if (hasTypedFixtureActivationReadinessDescriptor(options.executionTuning.profile)) {
      const activation = await activateFixtureDuringStartup(cdp, options);
      startupFixtureActivationTicket = activation.ticket;
      return activation;
    }
    // file:// keeps its historical direct launch. HTTP(S) has already begun
    // its bounded staged navigation after protocol setup; do not wait for its
    // acknowledgement before polling this short Canvas/WebGL handoff.
    const selection = await stageVariantDuringStartup(cdp, options);
    const startupDriverFields = options.executionPlan.compiled.startupFields;
    assert(selection.backendBeforeSelection === 'canvas2d'
      && selection.backendReasonBeforeSelection === 'webgl-starting'
      && selection.stagedBeforeWebGL === true
      && selection.fixture === options.fixture
      && selection.fixturePrepared === true
      && selection.scene === options.fixtureAdapter.scene
      && selection.preparation
        === options.executionPlan.inspection.fixture.preparation.reportLabel
      && Object.entries(startupDriverFields).every(([name, value]) => (
        selection[name] === value
      )),
    `Visual capture selector was not staged during bounded Canvas startup: ${JSON.stringify(selection)}`);
    return selection;
  });

  let readinessFixtureActivationGeneration;
  let readinessFixtureActivationWorkGeneration;
  const readinessCompletedFrameReceipt = await measure('readiness', async () => {
    const { profile, effectiveTimeouts } = options.executionTuning;
    // A readiness snapshot performs the same complete semantic, authoritative-
    // field, and framebuffer readback as a capture snapshot. On a loaded
    // software GPU that atomic proof can legitimately outlive the generic CDP
    // command bound, so let it consume the driver-owned readiness budget.
    const snapshotCommandTimeoutMs = Math.max(
      CDP_COMMAND_TIMEOUT_MS,
      effectiveTimeouts.readinessMs,
    );
    if (hasTypedFixtureActivationReadinessDescriptor(profile)) {
      assert(Number.isSafeInteger(startupFixtureActivationTicket)
        && startupFixtureActivationTicket > 0,
      'fixture activation readiness is missing its startup ticket');
      const { generation, snapshot } = await captureSubphases.measureReadiness(
        'datasetWaitMs', () => proveFixtureActivationReadiness({
          ticket: startupFixtureActivationTicket,
          timeoutMs: effectiveTimeouts.readinessMs,
          pollIntervalMs: profile.readiness.pollIntervalMs,
          readGeneration: (ticket) => readFixtureActivationPresentationGeneration(
            cdp, 'readiness', ticket,
          ),
          takeSnapshot: () => captureSubphases.measureSnapshot(
            'readiness', () => snapshotState(
              cdp, options.executionPlan, snapshotCommandTimeoutMs,
            ),
          ),
        }),
      );
      // V5 folds refresh into the atomic activation transaction. Retain the
      // additive timing field explicitly rather than inventing a second action.
      await captureSubphases.measureReadiness('refreshMs', async () => undefined);
      assert(snapshot.semantic.occupied > 0
        && snapshot.fieldAlpha.nonzero > 0
        && snapshot.framebufferAlpha.nonzero > 0,
      `fixture activation completed without populated ${options.fixture} presentation fields`);
      const startupVariant = VARIANTS.find(({ name }) => name === profile.startup.variant);
      assert(startupVariant !== undefined, 'readiness profile names an unknown startup variant');
      assertVariantState(snapshot, options, startupVariant);
      if (hasFixtureActivationWorkReadinessDescriptor(profile)) {
        readinessFixtureActivationWorkGeneration = generation;
      } else {
        readinessFixtureActivationGeneration = generation;
      }
      return undefined;
    }
    await captureSubphases.measureReadiness(
      'datasetWaitMs',
      () => waitForPage(
        cdp,
        options,
        profile.startup.variant,
        effectiveTimeouts.readinessMs,
        profile.readiness.pollIntervalMs,
      ),
    );
    await captureSubphases.measureReadiness('refreshMs', () => evaluate(cdp, `(() => {
        const audit = window.__ANIFOR_INPUT_AUDIT__;
        audit.refreshPresentationFields();
        let remaining = ${profile.startup.rafs};
        return new Promise((resolve) => {
          const advance = () => {
            remaining--;
            if (remaining === 0) resolve(true);
            else requestAnimationFrame(advance);
          };
          requestAnimationFrame(advance);
        });
      })()`, snapshotCommandTimeoutMs));
    if (hasReadinessCompletedFrameReceiptDescriptor(profile)) {
      const deadline = Date.now() + effectiveTimeouts.readinessMs;
      let ticket;
      let receipt;
      for (let attempt = 1; attempt <= 8; attempt++) {
        const remainingMs = deadline - Date.now();
        assert(remainingMs > 0, 'readiness completed-frame receipt proof timed out');
        ticket = await requestCompletedFrameReceipt(
          cdp, 'readiness', remainingMs, profile.readiness.pollIntervalMs,
        );
        const terminal = await awaitCompletedFrameReceipt(
          cdp, 'readiness', ticket, deadline - Date.now(), profile.readiness.pollIntervalMs,
        );
        if (terminal.state === 'completed') {
          receipt = terminal;
          break;
        }
        assert(terminal.state === 'superseded',
          `readiness completed-frame receipt ${ticket} is ${String(terminal.state)}`);
      }
      assert(receipt !== undefined && ticket !== undefined,
        'readiness completed-frame receipt was superseded eight times');
      const snapshot = await captureSubphases.measureSnapshot(
        'readiness', () => snapshotState(cdp, options.executionPlan, snapshotCommandTimeoutMs),
      );
      assert(snapshot.semantic.occupied > 0
        && snapshot.fieldAlpha.nonzero > 0
        && snapshot.framebufferAlpha.nonzero > 0,
      `readiness receipt completed without populated ${options.fixture} presentation fields`);
      const startupVariant = VARIANTS.find(({ name }) => name === profile.startup.variant);
      assert(startupVariant !== undefined, 'readiness profile names an unknown startup variant');
      assertVariantState(snapshot, options, startupVariant);
      const verified = await readCompletedFrameReceipt(cdp, 'readiness', ticket);
      assert(verified.state === 'completed' && verified.submission === receipt.submission,
        'readiness completed-frame receipt changed after its snapshot');
      return verified;
    }
    await waitFor(async () => {
      const snapshot = await captureSubphases.measureSnapshot(
        'readiness', () => snapshotState(
          cdp,
          options.executionPlan,
          snapshotCommandTimeoutMs,
        ),
      );
      return snapshot.semantic.occupied > 0
        && snapshot.fieldAlpha.nonzero > 0
        && snapshot.framebufferAlpha.nonzero > 0;
    }, effectiveTimeouts.readinessMs, `populated ${options.fixture} presentation fields`,
    profile.readiness.pollIntervalMs);
    return undefined;
  });

  const captures = {};
  for (const variant of VARIANTS) {
    captures[variant.name] = await measure(
      variant.name, () => captureVariant(cdp, options, variant, captureSubphases),
    );
  }
  assertContiguousSelectionOwnedReceiptSubmissions(captures, options.executionTuning.profile);

  return measure('finalize', async () => {
    const reference = captures.off.state;
    const captureGeometry = captures.off.captureGeometry;
    assert(VARIANTS.every(({ name }) => sameDigest(captureGeometry, captures[name].captureGeometry)),
      'visual variants used different capture geometries');
    const exactFramebufferAlpha = VARIANTS.every(({ name }) => sameDigest(
      reference.framebufferAlpha, captures[name].state.framebufferAlpha,
    ));
    // Source-stage styles deliberately own presentation alpha. Here "fixed
    // geometry" means one backing/CSS canvas geometry; semantic and
    // authoritative field support remain exact in the checks below.
    const styleOwnedFramebufferAlpha = VARIANTS.every(({ name }) => (
      captures[name].state.framebufferAlpha.nonzero > 0
      && sameDigest(reference.canvas, captures[name].state.canvas)
    ));
    const invariants = {
      semantic: VARIANTS.every(({ name }) => sameDigest(
        reference.semantic, captures[name].state.semantic,
      )),
      fieldAlpha: VARIANTS.every(({ name }) => sameDigest(
        reference.fieldAlpha, captures[name].state.fieldAlpha,
      )),
      framebufferAlpha: options.captureDriver.framebufferAlphaPolicy === 'exact'
        ? exactFramebufferAlpha : styleOwnedFramebufferAlpha,
    };
    const invariantEvidence = Object.fromEntries(VARIANTS.map(({ name }) => [name, {
      semantic: captures[name].state.semantic,
      fieldAlpha: captures[name].state.fieldAlpha,
      framebufferAlpha: captures[name].state.framebufferAlpha,
    }]));
    assert(invariants.semantic, 'visual variants changed the semantic material plane');
    assert(invariants.fieldAlpha, `${options.domain} visual variants changed field alpha/support`);
    assert(invariants.framebufferAlpha,
      `visual variants violated the ${options.captureDriver.framebufferAlphaPolicy}`
        + ` framebuffer-alpha policy: ${JSON.stringify(invariantEvidence)}`);
    assert(browserErrors.length === 0, `browser errors: ${browserErrors.join(' | ')}`);

    const compactCaptures = Object.fromEntries(VARIANTS.map(({ name }) => [name, {
      png: captures[name].png,
      bytes: captures[name].bytes,
      width: captures[name].width,
      height: captures[name].height,
      cssWidth: captures[name].cssWidth,
      cssHeight: captures[name].cssHeight,
      clipScale: captures[name].clipScale,
      sha256: captures[name].sha256,
      distinctFromOff: captures[name].sha256 !== captures.off.sha256,
      dataset: captures[name].state.dataset,
      ...(captures[name].completedFrameReceipt === undefined
        ? {} : { completedFrameReceipt: captures[name].completedFrameReceipt }),
    }]));
    const warnings = [];
    const labels = Object.fromEntries(options.executionPlan.inspection.driver.variants.map(
      ({ name, label }) => [name, label],
    ));
    const offLabel = labels.off;
    const aLabel = labels.a;
    const bLabel = labels.b;
    if (!compactCaptures.a.distinctFromOff && !compactCaptures.b.distinctFromOff) {
      warnings.push(
        `${aLabel} and ${bLabel} PNGs are byte-identical to ${offLabel};`
        + ' check target ownership or gain',
      );
    }
    if (compactCaptures.a.sha256 === compactCaptures.b.sha256) {
      warnings.push(`${aLabel} and ${bLabel} PNGs are byte-identical at this Detail scale`);
    }
    const result = createVisualLabResultRecord(
      options.candidate, options.executionPlan.request, {
        off: compactCaptures.off.sha256,
        a: compactCaptures.a.sha256,
        b: compactCaptures.b.sha256,
      },
    );
    return {
      tool: 'visual-lab-audit-v1',
      ...options.executionPlan.compiled.reportFields,
      result,
      url: options.executionPlan.compiled.url,
      domain: options.domain,
      target: options.target,
      fixture: options.fixture,
      fixtureScene: options.fixtureAdapter.scene,
      fixturePreparation: options.executionPlan.inspection.fixture.preparation.reportLabel,
      targetKind: options.domainAdapter.targetKind,
      domainCapability: {
        targetKind: options.domainAdapter.targetKind,
        executionProfile: options.domainAdapter.executionProfile,
        evidence: options.domainAdapter.evidence,
        fixedUrlParameters: options.domainAdapter.fixedUrlParameters,
      },
      captureProtocol: VISUAL_LAB_CAPTURE_PROTOCOL,
      gain: options.gain,
      renderScale: options.renderScale,
      gpu: options.gpu,
      ...(executionTuningProof === undefined ? {} : { executionTuning: executionTuningProof }),
      ...(readinessCompletedFrameReceipt === undefined
        ? {} : { readinessCompletedFrameReceipt }),
      ...(readinessFixtureActivationGeneration === undefined
        ? {} : { readinessFixtureActivationGeneration }),
      ...(readinessFixtureActivationWorkGeneration === undefined
        ? {} : { readinessFixtureActivationWorkGeneration }),
      captureSubphases: captureSubphases.finish(),
      startupSelection,
      backend: reference.backend.backend,
      hdrPipeline: reference.dataset.hdrPipeline,
      backingSize: reference.dataset.backingSize,
      invariants,
      semantic: reference.semantic,
      fieldAlpha: reference.fieldAlpha,
      framebufferAlpha: reference.framebufferAlpha,
      captureGeometry,
      captures: compactCaptures,
      browserErrors: browserErrors.length,
      warnings,
    };
  });
}

const localExecutionTuningEntry = (entry, gpuMode) => {
  const profile = resolveVisualCaptureExecutionCapabilities(entry.captureDriver.name);
  return Object.freeze({
    profile,
    effectiveTimeouts: Object.freeze({
      readinessMs: profile.readiness.timeoutMsByGpu[gpuMode],
      stabilityMs: profile.stability.timeoutMsByGpu[gpuMode],
    }),
  });
};

/**
 * Runs one candidate transaction through a caller-owned fresh target. The
 * transaction owns its CDP connection, protocol domains, browser-error
 * collector, fixture startup, readiness, ordered captures, strict renderer
 * disposal, and in-memory report. Chrome/profile and target/context teardown
 * remain host-owned.
 */
export async function captureVisualLabCandidatePage({
  entry,
  executionTuningEntry,
  executionTuningProof,
  connectPage,
  navigatePage,
  gpuMode,
  measure = async (_phase, operation) => operation(),
}) {
  if (typeof connectPage !== 'function') {
    throw new TypeError('Visual Lab candidate transaction requires a page connector');
  }
  if (navigatePage !== undefined && typeof navigatePage !== 'function') {
    throw new TypeError('Visual Lab candidate transaction navigation must be a function');
  }
  const resolvedExecutionTuningEntry = executionTuningEntry
    ?? localExecutionTuningEntry(entry, gpuMode);
  const captureSubphases = createVisualLabCaptureSubphaseTimingRecorder();
  let pageCdp;
  let browserErrors = [];
  let report;
  let captureError;
  let navigation;
  try {
    await measure('targetSetup', async () => {
      pageCdp = await connectPage();
      if (!pageCdp || typeof pageCdp.send !== 'function') {
        throw new TypeError('Visual Lab page connector returned an invalid CDP session');
      }
      browserErrors = collectBrowserErrors(pageCdp);
      await Promise.all([
        pageCdp.send('Page.enable'),
        pageCdp.send('Runtime.enable'),
        pageCdp.send('Log.enable'),
        pageCdp.send('Emulation.setDeviceMetricsOverride', VISUAL_CAPTURE_GEOMETRY.deviceMetrics),
      ]);
    });
    if (navigatePage) {
      // Do not await this acknowledgement before startup polling. On a remote
      // target the page may already expose the bounded Canvas staging bridge
      // while Chrome is still completing Page.navigate. Keep the rejection
      // observed immediately, then await it before renderer disposal.
      navigation = navigatePage(
        pageCdp,
        resolvedExecutionTuningEntry.effectiveTimeouts.readinessMs,
      );
      if (!navigation || typeof navigation.then !== 'function') {
        throw new TypeError('Visual Lab staged navigation must return a promise');
      }
      void navigation.catch(() => {});
    }
    report = await captureVisualLabCandidateEvidence({
      entry,
      executionTuningEntry: resolvedExecutionTuningEntry,
      executionTuningProof,
      pageCdp,
      gpuMode,
      browserErrors,
      captureSubphases,
      measure,
    });
  } catch (error) {
    captureError = error instanceof Error ? error : new Error(String(error));
  }
  let navigationError;
  if (navigation) {
    try { await navigation; }
    catch (error) {
      navigationError = error instanceof Error ? error : new Error(String(error));
    }
  }
  let disposalError;
  try {
    await measure('rendererDispose', () => disposeVisualLabCandidatePage({
      pageCdp,
      browserErrors,
      required: true,
    }));
  } catch (error) {
    disposalError = error instanceof Error ? error : new Error(String(error));
  }
  throwCollectedErrors(
    [captureError, navigationError, disposalError].filter(Boolean),
    navigation
      ? 'Visual Lab capture, staged navigation, and renderer disposal failed'
      : 'Visual Lab capture and renderer disposal both failed',
  );
  return report;
}

/**
 * Releases page-owned renderer resources before its browser context or host is
 * closed. A successful capture requires the audit bridge to acknowledge the
 * disposal; a failed startup may use best-effort mode so host cleanup can still
 * complete without replacing the original error.
 */
export async function disposeVisualLabCandidatePage({
  pageCdp,
  browserErrors = [],
  required = true,
}) {
  if (!pageCdp) {
    if (required) throw new Error('Visual Lab candidate has no page CDP for renderer disposal');
    return false;
  }
  const disposed = await evaluate(pageCdp, `(async () => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const dispose = audit?.disposeRendererForNavigation;
    if (typeof dispose !== 'function') return false;
    await dispose.call(audit);
    await new Promise((resolve) => setTimeout(resolve, 0));
    return true;
  })()`, RENDERER_DISPOSAL_TIMEOUT_MS);
  if (required && disposed !== true) {
    throw new Error('Visual Lab audit bridge did not acknowledge renderer disposal');
  }
  if (required && browserErrors.length > 0) {
    throw new Error(`browser errors through renderer teardown: ${browserErrors.join(' | ')}`);
  }
  return disposed === true;
}

const throwCollectedErrors = (errors, label) => {
  if (errors.length === 0) return;
  if (errors.length === 1) throw errors[0];
  throw new AggregateError(errors, label);
};

const CLI_ERROR_MAX_DEPTH = 4;
const CLI_ERROR_MAX_CHILDREN = 8;
const CLI_ERROR_MAX_CHARACTERS = 8_000;

const renderVisualLabError = (error, ancestors, depth) => {
  if (!(error instanceof Error)) return String(error);
  const message = error.message || error.name;
  if (!(error instanceof AggregateError)
    || ancestors.has(error) || depth >= CLI_ERROR_MAX_DEPTH) return message;
  const nestedAncestors = new Set(ancestors).add(error);
  const children = [...error.errors].slice(0, CLI_ERROR_MAX_CHILDREN).map(
    (child, index) => `[${index + 1}] ${renderVisualLabError(
      child, nestedAncestors, depth + 1,
    )}`,
  );
  if (error.errors.length > CLI_ERROR_MAX_CHILDREN) {
    children.push(`[+] ${error.errors.length - CLI_ERROR_MAX_CHILDREN} more errors omitted`);
  }
  return children.length === 0 ? message : `${message}\nNested errors:\n${children.join('\n')}`;
};

export const formatVisualLabCliError = (error) => (
  renderVisualLabError(error, new Set(), 0).slice(0, CLI_ERROR_MAX_CHARACTERS)
);

const readPortableSiblingPlan = async (file, label) => {
  const before = await lstat(file, { bigint: true });
  if (before.isSymbolicLink() || !before.isFile()) {
    throw new Error(`${label} must be a real regular file`);
  }
  if (before.size > 1_048_576n) {
    throw new Error(`${label} exceeds its 1 MiB budget`);
  }
  const source = await readFile(file, 'utf8');
  const after = await lstat(file, { bigint: true });
  if (after.isSymbolicLink() || !after.isFile()
    || before.dev !== after.dev || before.ino !== after.ino
    || before.size !== after.size || before.mtimeNs !== after.mtimeNs
    || before.ctimeNs !== after.ctimeNs) {
    throw new Error(`${label} changed while reading`);
  }
  try { return JSON.parse(source); }
  catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`, {
      cause: error,
    });
  }
};

const readBrowserHostPlan = (file) => readPortableSiblingPlan(
  file, 'Visual Lab browser-host plan',
);

const readExecutionTuningPlan = (file) => readPortableSiblingPlan(
  file, 'Visual Lab execution-tuning plan',
);

async function main() {
  const totalStarted = performance.now();
  const timings = createVisualLabTimingRecorder();
  const planStarted = performance.now();
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  timings.record('plan', performance.now() - planStarted);

  const url = new URL(options.executionPlan.compiled.url);
  const stagedNavigation = shouldStageVisualLabNavigation(url);
  const blankTargetUrl = new URL('about:blank');
  let chromePath;
  let browserHostPlanEntry;
  let executionTuningPlanEntry = localExecutionTuningEntry(
    options.executionPlan, options.gpu,
  );
  let executionTuningProof;
  await timings.measure('preflight', async () => {
    if (options.browserHost === 'shared' && process.platform !== 'linux') {
      throw new Error('Shared Visual Lab browser hosts are currently supported on Linux only');
    }
    await ensureServer(url, options.bundle);
    await mkdir(options.executionPlan.runtime.artifactRoot, { recursive: true });
    if (options.lifecycleFile) {
      await mkdir(path.dirname(options.lifecycleFile), { recursive: true });
    }
    if (options.executionTuningPlanFile) {
      const executionTuningPlan = await readExecutionTuningPlan(
        options.executionTuningPlanFile,
      );
      executionTuningPlanEntry = resolveExecutionTuningPlanEntry(
        executionTuningPlan,
        options.executionTuningEntryId,
        options.executionPlan.inspection.id,
      );
      if (executionTuningPlanEntry.candidate !== options.executionPlan.candidate
        || executionTuningPlanEntry.driver !== options.executionPlan.captureDriver.name) {
        throw new Error('Visual Lab execution-tuning entry does not match its capture request');
      }
      executionTuningProof = Object.freeze({
        schema: executionTuningPlan.schema,
        planId: executionTuningPlan.id,
        entryId: executionTuningPlanEntry.id,
      });
    }
    if (options.browserHost === 'fresh') {
      chromePath = await resolveVisualLabChrome(options.chrome);
    } else {
      const browserHostPlan = await readBrowserHostPlan(options.browserHostPlanFile);
      browserHostPlanEntry = resolveVisualLabBrowserHostPlanEntry(
        browserHostPlan,
        options.browserHostEntryId,
        options.executionPlan.inspection.id,
      );
      if (browserHostPlanEntry.effectiveMode !== 'shared') {
        throw new Error(
          `Visual Lab browser-host entry ${browserHostPlanEntry.id} requires a fresh browser`,
        );
      }
    }
  });
  let pageCdp;
  let chromeTarget;
  let chromeHost;
  let incognitoPage;
  let targetCleanupPromise;
  let hostCleanupPromise;
  let report;
  const closeTarget = () => {
    targetCleanupPromise ??= (async () => {
      const targetErrors = [];
      if (incognitoPage) {
        try { await incognitoPage.close(); }
        catch (error) {
          targetErrors.push(error instanceof Error ? error : new Error(String(error)));
        }
      } else if (chromeHost?.browserCdp && chromeTarget?.id) {
        try {
          const closed = await chromeHost.browserCdp.send(
            'Target.closeTarget', { targetId: chromeTarget.id }, 5_000,
          );
          if (closed.success !== true) {
            throw new Error(`Chrome refused to close target ${chromeTarget.id}`);
          }
        } catch (error) {
          targetErrors.push(error instanceof Error ? error : new Error(String(error)));
        }
      }
      if (!incognitoPage) {
        try { pageCdp?.close(); }
        catch (error) {
          targetErrors.push(error instanceof Error ? error : new Error(String(error)));
        }
      }
      throwCollectedErrors(targetErrors, 'Visual Lab target teardown failed');
    })();
    return targetCleanupPromise;
  };
  const cleanupHost = () => {
    hostCleanupPromise ??= (async () => {
      if (chromeHost) await chromeHost.teardown();
    })();
    return hostCleanupPromise;
  };
  const cleanupAll = async () => {
    const cleanupErrors = [];
    try { await closeTarget(); }
    catch (error) {
      cleanupErrors.push(error instanceof Error ? error : new Error(String(error)));
    }
    try { await cleanupHost(); }
    catch (error) {
      cleanupErrors.push(error instanceof Error ? error : new Error(String(error)));
    }
    throwCollectedErrors(cleanupErrors, 'Visual Lab target and host teardown both failed');
  };
  const onSignal = (signal) => {
    void cleanupAll().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
  };
  const onSigint = () => onSignal('SIGINT');
  const onSigterm = () => onSignal('SIGTERM');
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);
  let captureError;
  try {
    if (options.browserHost === 'fresh') {
      chromeTarget = await timings.measure('hostLaunch', async () => {
        chromeHost = await startVisualLabChromeHost({
          chromePath,
          gpuMode: options.gpu,
          initialUrl: stagedNavigation ? blankTargetUrl : url,
          allowFileAccess: url.protocol === 'file:',
          lifecycleFile: options.lifecycleFile,
          lifecycleOwner: options.lifecycleOwner,
        });
        const ready = await chromeHost.ready();
        return stagedNavigation ? undefined : ready.initialPage;
      });
    } else {
      timings.record('hostLaunch', 0);
    }
    report = await captureVisualLabCandidatePage({
      entry: options.executionPlan,
      executionTuningEntry: executionTuningPlanEntry,
      executionTuningProof,
      connectPage: async () => {
        if (options.browserHost === 'shared' || stagedNavigation) {
          incognitoPage = await connectVisualLabIncognitoPage({
            browserWebSocketDebuggerUrl: options.browserHost === 'shared'
              ? options.browserWebSocket : chromeHost.browserWebSocketDebuggerUrl,
            url: stagedNavigation ? blankTargetUrl : url,
          });
          pageCdp = incognitoPage.pageCdp;
        } else {
          pageCdp = await Cdp.connect(chromeTarget.webSocketDebuggerUrl);
        }
        return pageCdp;
      },
      ...(stagedNavigation ? {
        navigatePage: (cdp, timeoutMs) => beginStagedVisualLabNavigation(cdp, url, timeoutMs),
      } : {}),
      gpuMode: options.gpu,
      measure: timings.measure,
    });
  } catch (error) {
    captureError = error instanceof Error ? error : new Error(String(error));
  }
  let targetError;
  try {
    await timings.measure('targetTeardown', closeTarget);
  } catch (error) {
    targetError = error instanceof Error ? error : new Error(String(error));
  }
  let hostError;
  try {
    if (options.browserHost === 'fresh') {
      await timings.measure('hostTeardown', cleanupHost);
    } else {
      timings.record('hostTeardown', 0);
    }
  } catch (error) {
    hostError = error instanceof Error ? error : new Error(String(error));
  } finally {
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
  }
  throwCollectedErrors(
    [captureError, targetError, hostError].filter(Boolean),
    'Visual Lab capture, target teardown, or host teardown failed',
  );
  timings.record('total', performance.now() - totalStarted);
  report = {
    ...report,
    timings: timings.finish({
      browserHosts: options.browserHost === 'fresh' ? 1 : 0,
      browserContexts: 1,
      targets: 1,
      hostRestarts: 0,
      captures: VARIANTS.length,
    }),
  };
  const reportPath = options.deferReport
    ? path.join(options.executionPlan.runtime.artifactRoot, 'report.pending.json')
    : options.executionPlan.runtime.artifacts.report;
  await writeFile(reportPath, `${JSON.stringify(report)}\n`);
  process.stdout.write(`${JSON.stringify({ ...report, report: reportPath })}\n`);
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
  return waitFor(
    () => evaluate(cdp, options.executionPlan.compiled.startupExpression),
    options.executionTuning.effectiveTimeouts.readinessMs,
    `${options.fixture} startup audit bridge`,
    options.executionTuning.profile.readiness.pollIntervalMs,
  );
}

async function activateFixtureDuringStartup(cdp, options) {
  const { profile, effectiveTimeouts } = options.executionTuning;
  const activationMethod = hasFixtureActivationWorkReadinessDescriptor(profile)
    ? 'activatePreparedVisualCaptureFixtureWithWorkGeneration'
    : 'activatePreparedVisualCaptureFixture';
  const startupVariant = VARIANTS.find(({ name }) => name === profile.startup.variant);
  assert(startupVariant !== undefined, 'fixture activation profile names an unknown startup variant');
  await waitFor(
    () => evaluate(cdp, `(() => {
      const audit = window.__ANIFOR_INPUT_AUDIT__;
      const canvas = document.querySelector('.semantic-field-canvas');
      const root = document.querySelector('[data-scene]');
      if (!audit || !canvas || !root
        || typeof audit[${JSON.stringify(activationMethod)}] !== 'function'
        || typeof audit.fixtureActivationPresentationGeneration !== 'function'
        || root.dataset.scene !== ${JSON.stringify(options.fixtureAdapter.scene)}) return false;
      const backend = audit.backend();
      const dataset = canvas.dataset;
      return backend.backend === ${JSON.stringify(options.domainAdapter.executionProfile.backend)}
        && backend.outputScale === ${options.renderScale}
        && dataset.renderer === ${JSON.stringify(VISUAL_LAB_CAPTURE_PROTOCOL.datasetRequirements.renderer)}
        && dataset.hdrPipeline === ${JSON.stringify(VISUAL_LAB_CAPTURE_PROTOCOL.datasetRequirements.hdrPipeline)};
    })()`),
    effectiveTimeouts.readinessMs,
    `${options.fixture} typed activation audit bridge`,
    profile.readiness.pollIntervalMs,
  );
  const ticket = await requestTypedFixtureActivationGeneration(
    (fixture, variant) => evaluate(cdp, `(() => (
      window.__ANIFOR_INPUT_AUDIT__[${JSON.stringify(activationMethod)}](
        ${JSON.stringify(fixture)}, ${variant}
      )
    ))()`),
    options.fixture,
    startupVariant.value,
  );
  const startupDriverFields = options.executionPlan.compiled.startupFields;
  return Object.freeze({
    requestedVariant: startupVariant.value,
    fixture: options.fixture,
    scene: options.fixtureAdapter.scene,
    preparation: options.executionPlan.inspection.fixture.preparation.reportLabel,
    fixturePrepared: true,
    typedActivation: true,
    ticket,
    ...startupDriverFields,
  });
}

/** Calls the typed fixture activation API exactly once and validates its ticket. */
export async function requestTypedFixtureActivationGeneration(activate, fixture, variant) {
  if (typeof activate !== 'function') {
    throw new TypeError('Typed fixture activation must be a function');
  }
  const ticket = await activate(fixture, variant);
  assert(Number.isSafeInteger(ticket) && ticket > 0,
    'typed fixture activation returned an invalid presentation generation ticket');
  return ticket;
}

/** Waits for one activation generation, snapshots once, then verifies the same generation. */
export async function proveFixtureActivationReadiness({
  ticket,
  timeoutMs,
  pollIntervalMs,
  readGeneration,
  takeSnapshot,
}) {
  if (typeof readGeneration !== 'function' || typeof takeSnapshot !== 'function') {
    throw new TypeError('Fixture activation readiness requires generation and snapshot readers');
  }
  const completed = await waitFor(async () => {
    const generation = await readGeneration(ticket);
    if (generation.state === 'pending') return false;
    return generation;
  }, timeoutMs, `fixture activation presentation generation ${ticket}`, pollIntervalMs);
  assert(completed.state === 'completed',
    `fixture activation presentation generation ${ticket} is ${String(completed.state)}`);
  const snapshot = await takeSnapshot();
  const verified = await readGeneration(ticket);
  assert(verified.state === 'completed'
    && verified.ticket === completed.ticket
    && verified.generation === completed.generation,
  'fixture activation presentation generation changed after its snapshot');
  return Object.freeze({ generation: verified, snapshot });
}

async function waitForPage(
  cdp,
  options,
  expectedVariant,
  timeoutMs = PAGE_STARTUP_TIMEOUT_MS,
  pollIntervalMs = 50,
) {
  const compiledVariant = options.executionPlan.compiled.variants.find(
    ({ name, value }) => name === expectedVariant || value === expectedVariant,
  );
  assert(compiledVariant, `execution plan is missing capture variant ${expectedVariant}`);
  const expectedDriverState = compiledVariant.expectedDataset;
  const observedDriverState = options.executionPlan.compiled.datasetProjectionExpression;
  const readinessExpression = `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const canvas = document.querySelector('.semantic-field-canvas');
    const root = document.querySelector('[data-scene]');
    if (!audit || !canvas || !root
      || root.dataset.scene !== ${JSON.stringify(options.fixtureAdapter.scene)}) {
      return false;
    }
    const dataset = canvas.dataset;
    const backend = audit.backend();
    const executionProfile = ${JSON.stringify(options.domainAdapter.executionProfile)};
    const datasetRequirements = ${JSON.stringify(VISUAL_LAB_CAPTURE_PROTOCOL.datasetRequirements)};
    const expectedBacking = (audit.width * ${options.renderScale}) + 'x'
      + (audit.height * ${options.renderScale});
    const driverState = {
      visualLab: dataset.visualLab,
      visualLabDomain: dataset.visualLabDomain,
      visualLabVariant: dataset.visualLabVariant,
      visualLabTarget: dataset.visualLabTarget,
      visualLabGain: dataset.visualLabGain,
      ...${observedDriverState},
    };
    const expectedDriverState = ${JSON.stringify(expectedDriverState)};
    return backend.backend === executionProfile.backend
      && backend.outputScale === ${options.renderScale}
      && dataset.renderer === datasetRequirements.renderer
      && dataset.hdrPipeline === datasetRequirements.hdrPipeline
      && dataset.renderLook === ${JSON.stringify(
        VISUAL_LAB_CAPTURE_PROTOCOL.fixedUrlParameters.renderLook
      )}
      && Number(dataset.outputScale) === ${options.renderScale}
      && dataset.backingSize === expectedBacking
      && Object.entries(expectedDriverState).every(([name, value]) => (
        driverState[name] === value
      ));
  })()`;
  try {
    await waitFor(
      () => evaluate(cdp, readinessExpression),
      timeoutMs,
      'WebGL/HDR visual-lab page',
      pollIntervalMs,
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

async function captureVariant(cdp, options, variant, captureSubphases) {
  const { profile, effectiveTimeouts } = options.executionTuning;
  const settleTimeoutMs = effectiveTimeouts.stabilityMs;
  // A complete framebuffer readback is itself the convergence proof. Let its
  // CDP transport consume the driver-owned stability budget instead of failing
  // first at the generic command timeout on loaded software GPUs.
  const snapshotCommandTimeoutMs = Math.max(CDP_COMMAND_TIMEOUT_MS, settleTimeoutMs);
  const compiledVariant = options.executionPlan.compiled.variants.find(
    ({ name }) => name === variant.name,
  );
  assert(compiledVariant, `execution plan is missing capture variant ${variant.name}`);
  const selectionExpression = compiledVariant.selectionExpression;
  const expectedDriverState = compiledVariant.expectedDataset;
  const observedDriverState = options.executionPlan.compiled.datasetProjectionExpression;
  const selectionOwnedReceipt = hasSelectionOwnedCompletedFrameReceiptDescriptor(profile);
  const performSelection = () => captureSubphases.measureCapture(
    variant.name, 'selectionMs', () => evaluate(cdp, `(() => {
      const audit = window.__ANIFOR_INPUT_AUDIT__;
      const selection = ${selectionOwnedReceipt ? `(() => {
        if (typeof audit?.setPreparedVisualCaptureVariantWithCompletedFrameReceipt !== 'function') {
          return { ok: false, failure: 'missing-selection-owned-receipt-selector' };
        }
        try {
          const ticket = audit.setPreparedVisualCaptureVariantWithCompletedFrameReceipt(
            ${JSON.stringify(options.fixture)}, ${variant.value}
          );
          return Number.isSafeInteger(ticket) && ticket > 0
            ? { ok: true, selection: ${JSON.stringify(variant.value)}, ticket }
            : { ok: false, failure: 'invalid-selection-owned-receipt-ticket' };
        } catch {
          return { ok: false, failure: 'selection-owned-receipt-selector-threw' };
        }
      })()` : selectionExpression};
      if (!selection.ok) throw new Error('visual capture selector failed: ' + selection.failure);
      let remaining = ${profile.selection.rafs};
      return new Promise((resolve) => {
        const advance = () => {
          remaining--;
          if (remaining === 0) resolve(selection);
          else requestAnimationFrame(advance);
        };
        requestAnimationFrame(advance);
      });
    })()`),
  );
  const waitForSelectedDataset = () => captureSubphases.measureCapture(
    variant.name, 'datasetWaitMs', () => waitFor(
    () => evaluate(cdp, `(() => {
      const audit = window.__ANIFOR_INPUT_AUDIT__;
      const canvas = document.querySelector('.semantic-field-canvas');
      if (!audit || !canvas) return false;
      const dataset = canvas.dataset;
      const driverState = {
        visualLab: dataset.visualLab,
        visualLabDomain: dataset.visualLabDomain,
        visualLabVariant: dataset.visualLabVariant,
        visualLabTarget: dataset.visualLabTarget,
        visualLabGain: dataset.visualLabGain,
        ...${observedDriverState},
      };
      const expectedDriverState = ${JSON.stringify(expectedDriverState)};
      return Object.entries(expectedDriverState).every(([name, value]) => (
        driverState[name] === value
      ));
    })()`),
    settleTimeoutMs,
    `${variant.name} capture-driver state`,
    profile.stability.pollIntervalMs,
  ));
  let selection = await performSelection();
  await waitForSelectedDataset();

  let state;
  let completedFrameReceipt;
  if (hasCompletedFrameReceiptDescriptor(profile) || selectionOwnedReceipt) {
    const deadline = Date.now() + settleTimeoutMs;
    let ticket;
    let receipt;
    for (let attempt = 1; attempt <= 8; attempt++) {
      const remainingMs = deadline - Date.now();
      assert(remainingMs > 0, `${variant.name} completed-frame receipt proof timed out`);
      if (selectionOwnedReceipt) {
        ticket = selection.ticket;
        assert(Number.isSafeInteger(ticket) && ticket > 0,
          `${variant.name} selection-owned completed-frame receipt ticket is invalid`);
      } else {
        ticket = await requestCompletedFrameReceipt(
          cdp, variant.name, remainingMs, profile.stability.pollIntervalMs,
        );
      }
      const terminal = await awaitCompletedFrameReceipt(
        cdp, variant.name, ticket, deadline - Date.now(), profile.stability.pollIntervalMs,
      );
      if (terminal.state === 'completed') {
        receipt = terminal;
        break;
      }
      assert(terminal.state === 'superseded',
        `${variant.name} completed-frame receipt ${ticket} is ${String(terminal.state)}`);
      if (selectionOwnedReceipt) {
        selection = await performSelection();
        await waitForSelectedDataset();
      }
    }
    assert(receipt !== undefined && ticket !== undefined,
      `${variant.name} completed-frame receipt was superseded eight times`);
    state = await captureSubphases.measureSnapshot(
      variant.name,
      () => snapshotState(cdp, options.executionPlan, snapshotCommandTimeoutMs),
    );
    const verified = await readCompletedFrameReceipt(cdp, variant.name, ticket);
    assert(verified.state === 'completed' && verified.submission === receipt.submission,
      `${variant.name} completed-frame receipt changed after its snapshot`);
    completedFrameReceipt = verified;
  } else {
    let previousState;
    let consecutiveSnapshots = 0;
    state = await waitFor(async () => {
      const current = await captureSubphases.measureSnapshot(
        variant.name,
        () => snapshotState(cdp, options.executionPlan, snapshotCommandTimeoutMs),
      );
      const stable = previousState
        && sameDigest(previousState.semantic, current.semantic)
        && sameDigest(previousState.fieldAlpha, current.fieldAlpha)
        && sameDigest(previousState.framebufferAlpha, current.framebufferAlpha);
      consecutiveSnapshots = stable ? consecutiveSnapshots + 1 : 1;
      previousState = current;
      return consecutiveSnapshots >= profile.stability.consecutiveSnapshots ? current : false;
    }, settleTimeoutMs, `${variant.name} stable semantic/alpha presentation`,
    profile.stability.pollIntervalMs);
  }
  assertVariantState(state, options, variant);
  const captureGeometry = await readVisualCaptureGeometryProof(cdp, options.renderScale);
  const clip = {
    x: captureGeometry.canvas.left,
    y: captureGeometry.canvas.top,
    width: captureGeometry.canvas.width,
    height: captureGeometry.canvas.height,
    scale: captureGeometry.canvas.clipScale,
  };
  const screenshot = await captureSubphases.measureCapture(
    variant.name,
    'screenshotMs',
    () => cdp.send('Page.captureScreenshot', {
      format: 'png', fromSurface: true, captureBeyondViewport: true, clip,
    }, CDP_COMMAND_TIMEOUT_MS),
  );
  assertVisualCaptureGeometryUnchanged(
    captureGeometry,
    await readVisualCaptureGeometryProof(cdp, options.renderScale),
  );
  const bytes = Buffer.from(screenshot.data, 'base64');
  const dimensions = capturePngDimensions(bytes, variant.name);
  assert(dimensions.width === captureGeometry.canvas.width
    && dimensions.height === captureGeometry.canvas.height,
  `${variant.name} PNG dimensions do not match the canonical scale-1 CSS canvas clip`);
  const png = options.executionPlan.runtime.artifacts.captures[variant.name];
  await captureSubphases.measureCapture(
    variant.name, 'writeMs', () => writeFile(png, bytes),
  );
  return {
    state,
    png,
    bytes: bytes.byteLength,
    ...dimensions,
    cssWidth: captureGeometry.canvas.width,
    cssHeight: captureGeometry.canvas.height,
    clipScale: captureGeometry.canvas.clipScale,
    captureGeometry,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    ...(completedFrameReceipt === undefined ? {} : { completedFrameReceipt }),
  };
}

function capturePngDimensions(bytes, variant) {
  if (bytes.length < 24
    || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
    || bytes.readUInt32BE(8) !== 13
    || bytes.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error(`${variant} capture is not a canonical PNG screenshot`);
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width === 0 || height === 0) {
    throw new Error(`${variant} capture has empty PNG dimensions`);
  }
  return { width, height };
}

function assertVariantState(state, options, variant) {
  const expectedBacking = `${state.world.width * options.renderScale}x${state.world.height * options.renderScale}`;
  const { executionProfile } = options.domainAdapter;
  const { datasetRequirements } = VISUAL_LAB_CAPTURE_PROTOCOL;
  assert(state.backend.backend === executionProfile.backend,
    `${variant.name} backend is ${state.backend.backend}, expected ${executionProfile.backend}`);
  assert(state.backend.outputScale === options.renderScale,
    `${variant.name} backend scale is ${state.backend.outputScale}, expected ${options.renderScale}`);
  assert(state.dataset.renderer === datasetRequirements.renderer,
    `${variant.name} renderer dataset is wrong`);
  assert(state.dataset.hdrPipeline === datasetRequirements.hdrPipeline,
    `${variant.name} pipeline dataset is wrong`);
  assert(
    state.dataset.renderLook === VISUAL_LAB_CAPTURE_PROTOCOL.fixedUrlParameters.renderLook,
    `${variant.name} render look is not ${VISUAL_LAB_CAPTURE_PROTOCOL.fixedUrlParameters.renderLook}`,
  );
  assert(state.dataset.backingSize === expectedBacking,
    `${variant.name} backing is ${state.dataset.backingSize}, expected ${expectedBacking}`);
  const expectedDriverState = options.executionPlan.compiled.variants.find(
    ({ name }) => name === variant.name,
  )?.expectedDataset;
  assert(expectedDriverState, `execution plan is missing capture variant ${variant.name}`);
  for (const [name, value] of Object.entries(expectedDriverState)) {
    assert(state.dataset[name] === value,
      `${variant.name} capture-driver dataset ${name} is wrong`);
  }
  assert(state.semantic.occupied > 0, `${variant.name} showcase semantic plane is empty`);
  assert(state.fieldAlpha.nonzero > 0, `${variant.name} ${options.domain} field is empty`);
  assert(state.framebufferAlpha.nonzero > 0, `${variant.name} WebGL framebuffer alpha is empty`);
}

async function snapshotState(cdp, executionPlan, commandTimeoutMs = CDP_COMMAND_TIMEOUT_MS) {
  const { datasetProjectionExpression: observedDriverState } = (
    executionPlan.compiled
  );
  const evidencePlane = executionPlan.domainAdapter.evidence.plane;
  const asynchronousFramebufferAlpha = await readFramebufferAlphaDigest(
    cdp, commandTimeoutMs,
  );
  return evaluate(cdp, `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    const canvas = document.querySelector('.semantic-field-canvas');
    if (!audit || !canvas) throw new Error('visual-lab audit API/canvas disappeared');
    const digestRgbaAlpha = ${digestVisualLabFramebufferAlpha.toString()};
    const material = audit.materialPlaneDigest();
    let countHash = 2166136261 >>> 0;
    for (let index = 0; index < material.materialCounts.length; index++) {
      countHash = Math.imul(
        (countHash ^ material.materialCounts[index] ^ index) >>> 0, 16777619,
      ) >>> 0;
    }
    if (typeof audit.visualCaptureEvidenceDigest !== 'function') {
      throw new Error('visual-capture evidence digest bridge is unavailable');
    }
    const fieldAlpha = audit.visualCaptureEvidenceDigest(${JSON.stringify(evidencePlane)});
    const asynchronousFramebufferAlpha = ${JSON.stringify(asynchronousFramebufferAlpha)};
    let framebufferAlpha = asynchronousFramebufferAlpha;
    if (framebufferAlpha === null) {
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) throw new Error('semantic-field canvas has no readable WebGL context');
      const readbackKey = Symbol.for('anifor.visual-lab.framebuffer-readback/v1');
      const reuseReadback = ${reuseVisualLabFramebufferReadback.toString()};
      const readbackByteLength = canvas.width * canvas.height * 4;
      const rgba = reuseReadback(canvas[readbackKey], readbackByteLength);
      canvas[readbackKey] = rgba;
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      framebufferAlpha = digestRgbaAlpha(rgba);
    }
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
        ...${observedDriverState},
      },
      semantic: { hash: material.hash, occupied: material.occupied, countHash },
      fieldAlpha,
      framebufferAlpha,
      canvas: {
        width: canvas.width, height: canvas.height,
        cssWidth: rect.width, cssHeight: rect.height,
      },
    };
  })()`, commandTimeoutMs);
}

async function readFramebufferAlphaDigest(cdp, timeoutMs) {
  const ticket = await evaluate(cdp, `(() => (
    window.__ANIFOR_INPUT_AUDIT__?.requestWebGLFramebufferAlphaReadback?.()
  ))()`);
  if (!Number.isSafeInteger(ticket) || ticket <= 0) return null;
  const readback = await waitFor(async () => {
    const observation = await evaluate(cdp, `(() => (
      window.__ANIFOR_INPUT_AUDIT__?.webGLFramebufferAlphaReadback?.(${ticket})
    ))()`);
    assert(observation !== null && typeof observation === 'object'
      && !Array.isArray(observation),
    `framebuffer-alpha readback ${ticket} is unavailable`);
    assert(observation.schema === FRAMEBUFFER_ALPHA_READBACK_SCHEMA
      && observation.ticket === ticket
      && Number.isSafeInteger(observation.submission) && observation.submission > 0
      && ['pending', 'completed', 'failed'].includes(observation.state),
    `framebuffer-alpha readback ${ticket} is malformed`);
    return observation.state === 'pending' ? false : observation;
  }, timeoutMs, `framebuffer-alpha readback ${ticket}`, 25);
  assert(readback.state === 'completed', `framebuffer-alpha readback ${ticket} failed`);
  const digest = readback.digest;
  assert(digest !== null && typeof digest === 'object' && !Array.isArray(digest)
    && ['hash', 'supportHash', 'alphaSum', 'nonzero'].every((name) => (
      Number.isSafeInteger(digest[name]) && digest[name] >= 0
    )), `framebuffer-alpha readback ${ticket} digest is malformed`);
  return digest;
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

async function waitFor(check, timeoutMs, label, pollIntervalMs = 50) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(pollIntervalMs);
  }
  throw new Error(`${label} timed out${lastError ? `: ${lastError}` : ''}`);
}

function hasCompletedFrameReceiptDescriptor(profile) {
  const completion = profile?.completion;
  if (completion === null || typeof completion !== 'object' || Array.isArray(completion)) {
    return false;
  }
  const expected = COMPLETED_FRAME_RECEIPT_DESCRIPTOR;
  const keys = Object.keys(completion);
  return keys.length === Object.keys(expected).length
    && Object.keys(expected).every((name) => completion[name] === expected[name]);
}

function hasSelectionOwnedCompletedFrameReceiptDescriptor(profile) {
  const completion = profile?.completion;
  if (completion === null || typeof completion !== 'object' || Array.isArray(completion)) {
    return false;
  }
  const expected = SELECTION_OWNED_COMPLETED_FRAME_RECEIPT_DESCRIPTOR;
  const keys = Object.keys(completion);
  return keys.length === Object.keys(expected).length
    && Object.keys(expected).every((name) => completion[name] === expected[name]);
}

function hasFixtureActivationReadinessDescriptor(profile) {
  const activation = profile?.readinessActivation;
  if (activation === null || typeof activation !== 'object' || Array.isArray(activation)) {
    return false;
  }
  const expected = FIXTURE_ACTIVATION_READINESS_DESCRIPTOR;
  const keys = Object.keys(activation);
  return keys.length === Object.keys(expected).length
    && Object.keys(expected).every((name) => activation[name] === expected[name]);
}

function hasFixtureActivationWorkReadinessDescriptor(profile) {
  const activation = profile?.readinessActivation;
  if (activation === null || typeof activation !== 'object' || Array.isArray(activation)) {
    return false;
  }
  const expected = FIXTURE_ACTIVATION_WORK_READINESS_DESCRIPTOR;
  const keys = Object.keys(activation);
  return keys.length === Object.keys(expected).length
    && Object.keys(expected).every((name) => activation[name] === expected[name]);
}

function hasTypedFixtureActivationReadinessDescriptor(profile) {
  return hasFixtureActivationReadinessDescriptor(profile)
    || hasFixtureActivationWorkReadinessDescriptor(profile);
}

async function readFixtureActivationPresentationGeneration(cdp, label, ticket) {
  const generation = await evaluate(cdp, `(() => (
    window.__ANIFOR_INPUT_AUDIT__?.fixtureActivationPresentationGeneration?.(${ticket})
  ))()`);
  assert(generation !== null && typeof generation === 'object' && !Array.isArray(generation),
    `${label} fixture activation presentation generation ${ticket} is unavailable`);
  const keys = Object.keys(generation);
  assert(keys.length === 3
    && keys[0] === 'ticket' && keys[1] === 'generation' && keys[2] === 'state'
    && generation.ticket === ticket
    && Number.isSafeInteger(generation.generation) && generation.generation > 0
    && ['pending', 'completed', 'failed'].includes(generation.state),
  `${label} fixture activation presentation generation ${ticket} is malformed`);
  return generation;
}

/**
 * A selection-owned capture transaction must reserve exactly the next three
 * presentations in canonical OFF/A/B order. This prevents individually valid
 * receipts from silently admitting an intervening or reordered submission.
 */
export function assertContiguousSelectionOwnedReceiptSubmissions(captures, profile) {
  if (!hasSelectionOwnedCompletedFrameReceiptDescriptor(profile)) return;
  const submissions = VARIANTS.map(({ name }) => {
    const receipt = captures?.[name]?.completedFrameReceipt;
    assert(receipt !== null && typeof receipt === 'object' && !Array.isArray(receipt)
      && receipt.schema === COMPLETED_FRAME_RECEIPT_SCHEMA
      && receipt.state === 'completed'
      && Number.isSafeInteger(receipt.submission) && receipt.submission > 0,
    `${name} selection-owned completed-frame receipt is missing or invalid`);
    return receipt.submission;
  });
  assert(submissions.every((submission, index) => submission === submissions[0] + index),
    `selection-owned completed-frame receipt submissions must be contiguous in OFF/A/B order; received ${submissions.join(', ')}`);
}

function hasReadinessCompletedFrameReceiptDescriptor(profile) {
  const completion = profile?.readinessCompletion;
  if (completion === null || typeof completion !== 'object' || Array.isArray(completion)) {
    return false;
  }
  const expected = READINESS_COMPLETED_FRAME_RECEIPT_DESCRIPTOR;
  const keys = Object.keys(completion);
  return keys.length === Object.keys(expected).length
    && Object.keys(expected).every((name) => completion[name] === expected[name]);
}

async function requestCompletedFrameReceipt(cdp, label, timeoutMs, pollIntervalMs) {
  return waitFor(async () => {
    const ticket = await evaluate(cdp, `(() => (
      window.__ANIFOR_INPUT_AUDIT__?.requestWebGLCompletedFrameReceipt?.()
    ))()`);
    return Number.isSafeInteger(ticket) && ticket > 0 ? ticket : false;
  }, timeoutMs, `${label} completed-frame receipt request`, pollIntervalMs);
}

async function readCompletedFrameReceipt(cdp, label, ticket) {
  const receipt = await evaluate(cdp, `(() => (
    window.__ANIFOR_INPUT_AUDIT__?.webGLCompletedFrameReceipt?.(${ticket})
  ))()`);
  assert(receipt !== null && typeof receipt === 'object' && !Array.isArray(receipt),
    `${label} completed-frame receipt ${ticket} is unavailable`);
  assert(receipt.schema === COMPLETED_FRAME_RECEIPT_SCHEMA,
    `${label} completed-frame receipt ${ticket} has an invalid schema`);
  assert(receipt.ticket === ticket,
    `${label} completed-frame receipt ticket does not match its request`);
  assert(Number.isSafeInteger(receipt.submission) && receipt.submission > 0,
    `${label} completed-frame receipt ${ticket} has an invalid submission`);
  assert(['pending', 'completed', 'superseded', 'failed'].includes(receipt.state),
    `${label} completed-frame receipt ${ticket} has an invalid state`);
  return receipt;
}

async function awaitCompletedFrameReceipt(cdp, label, ticket, timeoutMs, pollIntervalMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const receipt = await readCompletedFrameReceipt(cdp, label, ticket);
    if (receipt.state !== 'pending') return receipt;
    await sleep(pollIntervalMs);
  }
  throw new Error(`${label} completed-frame receipt ${ticket} timed out`);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const isDirectExecution = () => {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(MODULE_PATH); }
  catch { return path.resolve(process.argv[1]) === MODULE_PATH; }
};

if (isDirectExecution()) {
  void main().catch((error) => {
    process.stderr.write(`${JSON.stringify({
      tool: 'visual-lab-audit-v1', ok: false,
      error: formatVisualLabCliError(error),
    })}\n`);
    process.exitCode = 1;
  });
}
