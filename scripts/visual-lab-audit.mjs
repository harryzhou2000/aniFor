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
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA,
} from './visual-lab-execution-tuning-plan.mjs';

export { removeVisualLabHostArtifacts } from './visual-lab-chrome-host.mjs';

const MODULE_PATH = fileURLToPath(import.meta.url);
const CDP_COMMAND_TIMEOUT_MS = 20_000;
const PAGE_STARTUP_TIMEOUT_MS = 60_000;
const RENDERER_DISPOSAL_TIMEOUT_MS = 5_000;
const CAPTURE_VIEWPORT_WIDTH = 1280;
// Preserve the historical fresh-target content viewport. Chrome's
// `--window-size=1280,720` includes headless window chrome for the initial
// target, whose stable layout viewport is 1280x600; incognito targets otherwise
// inherit a different content height and produce incomparable capture clips.
const CAPTURE_VIEWPORT_HEIGHT = 600;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const COMPLETED_FRAME_RECEIPT_SCHEMA = 'anifor.renderer.completed-frame-receipt/v1';
const COMPLETED_FRAME_RECEIPT_DESCRIPTOR = Object.freeze({
  capability: 'renderer-completed-frame-receipt/v1',
  receiptSchema: COMPLETED_FRAME_RECEIPT_SCHEMA,
  requiredState: 'completed',
  bind: 'selected-presentation',
  verifyAfterSnapshot: true,
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
) => (
  plan?.schema === VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA
    ? resolveVisualLabExecutionTuningPlanV2Entry(plan, entryId, expectedCaptureEntryId)
    : resolveVisualLabExecutionTuningPlanEntry(plan, entryId, expectedCaptureEntryId)
);

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
  const startupSelection = await measure('startup', async () => {
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

  await measure('readiness', async () => {
    const { profile, effectiveTimeouts } = options.executionTuning;
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
      })()`));
    await waitFor(async () => {
      const snapshot = await captureSubphases.measureSnapshot(
        'readiness', () => snapshotState(cdp, options.executionPlan),
      );
      return snapshot.semantic.occupied > 0
        && snapshot.fieldAlpha.nonzero > 0
        && snapshot.framebufferAlpha.nonzero > 0;
    }, effectiveTimeouts.readinessMs, `populated ${options.fixture} presentation fields`,
    profile.readiness.pollIntervalMs);
  });

  const captures = {};
  for (const variant of VARIANTS) {
    captures[variant.name] = await measure(
      variant.name, () => captureVariant(cdp, options, variant, captureSubphases),
    );
  }

  return measure('finalize', async () => {
    const reference = captures.off.state;
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
      captureSubphases: captureSubphases.finish(),
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
        pageCdp.send('Emulation.setDeviceMetricsOverride', {
          width: CAPTURE_VIEWPORT_WIDTH,
          height: CAPTURE_VIEWPORT_HEIGHT,
          deviceScaleFactor: 1,
          mobile: false,
          screenWidth: CAPTURE_VIEWPORT_WIDTH,
          screenHeight: CAPTURE_VIEWPORT_HEIGHT,
        }),
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
  const compiledVariant = options.executionPlan.compiled.variants.find(
    ({ name }) => name === variant.name,
  );
  assert(compiledVariant, `execution plan is missing capture variant ${variant.name}`);
  const selectionExpression = compiledVariant.selectionExpression;
  const expectedDriverState = compiledVariant.expectedDataset;
  const observedDriverState = options.executionPlan.compiled.datasetProjectionExpression;
  await captureSubphases.measureCapture(variant.name, 'selectionMs', () => evaluate(cdp, `(() => {
      const audit = window.__ANIFOR_INPUT_AUDIT__;
      const selection = ${selectionExpression};
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
    })()`));
  await captureSubphases.measureCapture(variant.name, 'datasetWaitMs', () => waitFor(
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

  let state;
  let completedFrameReceipt;
  if (hasCompletedFrameReceiptDescriptor(profile)) {
    const deadline = Date.now() + settleTimeoutMs;
    let ticket;
    let receipt;
    for (let attempt = 1; attempt <= 8; attempt++) {
      const remainingMs = deadline - Date.now();
      assert(remainingMs > 0, `${variant.name} completed-frame receipt proof timed out`);
      ticket = await requestCompletedFrameReceipt(
        cdp, variant, remainingMs, profile.stability.pollIntervalMs,
      );
      const terminal = await awaitCompletedFrameReceipt(
        cdp, variant, ticket, deadline - Date.now(), profile.stability.pollIntervalMs,
      );
      if (terminal.state === 'completed') {
        receipt = terminal;
        break;
      }
      assert(terminal.state === 'superseded',
        `${variant.name} completed-frame receipt ${ticket} is ${String(terminal.state)}`);
    }
    assert(receipt !== undefined && ticket !== undefined,
      `${variant.name} completed-frame receipt was superseded eight times`);
    state = await captureSubphases.measureSnapshot(
      variant.name, () => snapshotState(cdp, options.executionPlan),
    );
    const verified = await readCompletedFrameReceipt(cdp, variant, ticket);
    assert(verified.state === 'completed' && verified.submission === receipt.submission,
      `${variant.name} completed-frame receipt changed after its snapshot`);
    completedFrameReceipt = verified;
  } else {
    let previousState;
    let consecutiveSnapshots = 0;
    state = await waitFor(async () => {
      const current = await captureSubphases.measureSnapshot(
        variant.name, () => snapshotState(cdp, options.executionPlan),
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
  const screenshot = await captureSubphases.measureCapture(
    variant.name,
    'screenshotMs',
    () => cdp.send('Page.captureScreenshot', {
      format: 'png', fromSurface: true, captureBeyondViewport: true, clip,
    }, CDP_COMMAND_TIMEOUT_MS),
  );
  const bytes = Buffer.from(screenshot.data, 'base64');
  const dimensions = capturePngDimensions(bytes, variant.name);
  assert(Math.abs(dimensions.width - clip.width) <= 1
    && Math.abs(dimensions.height - clip.height) <= 1,
  `${variant.name} PNG dimensions do not match its scale-1 CSS canvas clip`);
  const png = options.executionPlan.runtime.artifacts.captures[variant.name];
  await captureSubphases.measureCapture(
    variant.name, 'writeMs', () => writeFile(png, bytes),
  );
  return {
    state,
    png,
    bytes: bytes.byteLength,
    ...dimensions,
    cssWidth: clip.width,
    cssHeight: clip.height,
    clipScale: clip.scale,
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

async function snapshotState(cdp, executionPlan) {
  const { evidenceReaderExpression, datasetProjectionExpression: observedDriverState } = (
    executionPlan.compiled
  );
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
    const digestRgbaAlpha = ${digestVisualLabFramebufferAlpha.toString()};
    const material = audit.materialPlaneDigest();
    let countHash = 2166136261 >>> 0;
    for (let index = 0; index < material.materialCounts.length; index++) {
      countHash = Math.imul(
        (countHash ^ material.materialCounts[index] ^ index) >>> 0, 16777619,
      ) >>> 0;
    }
    const readField = ${evidenceReaderExpression};
    const fieldAlpha = digestBytes(readField, audit.width, audit.height);
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) throw new Error('semantic-field canvas has no readable WebGL context');
    const rgba = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    const framebufferAlpha = digestRgbaAlpha(rgba);
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

async function requestCompletedFrameReceipt(cdp, variant, timeoutMs, pollIntervalMs) {
  return waitFor(async () => {
    const ticket = await evaluate(cdp, `(() => (
      window.__ANIFOR_INPUT_AUDIT__?.requestWebGLCompletedFrameReceipt?.()
    ))()`);
    return Number.isSafeInteger(ticket) && ticket > 0 ? ticket : false;
  }, timeoutMs, `${variant.name} completed-frame receipt request`, pollIntervalMs);
}

async function readCompletedFrameReceipt(cdp, variant, ticket) {
  const receipt = await evaluate(cdp, `(() => (
    window.__ANIFOR_INPUT_AUDIT__?.webGLCompletedFrameReceipt?.(${ticket})
  ))()`);
  assert(receipt !== null && typeof receipt === 'object' && !Array.isArray(receipt),
    `${variant.name} completed-frame receipt ${ticket} is unavailable`);
  assert(receipt.schema === COMPLETED_FRAME_RECEIPT_SCHEMA,
    `${variant.name} completed-frame receipt ${ticket} has an invalid schema`);
  assert(receipt.ticket === ticket,
    `${variant.name} completed-frame receipt ticket does not match its request`);
  assert(Number.isSafeInteger(receipt.submission) && receipt.submission > 0,
    `${variant.name} completed-frame receipt ${ticket} has an invalid submission`);
  assert(['pending', 'completed', 'superseded', 'failed'].includes(receipt.state),
    `${variant.name} completed-frame receipt ${ticket} has an invalid state`);
  return receipt;
}

async function awaitCompletedFrameReceipt(cdp, variant, ticket, timeoutMs, pollIntervalMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const receipt = await readCompletedFrameReceipt(cdp, variant, ticket);
    if (receipt.state !== 'pending') return receipt;
    await sleep(pollIntervalMs);
  }
  throw new Error(`${variant.name} completed-frame receipt ${ticket} timed out`);
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
