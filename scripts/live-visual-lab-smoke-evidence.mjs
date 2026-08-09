import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import { normalizeLivePagesRevision } from './live-pages-attestation.mjs';
import {
  verifyVisualLabBatchPackage,
} from './visual-lab-batch.mjs';
import {
  VISUAL_LAB_BROWSER_HOST_PLAN_SCHEMA,
} from './visual-lab-browser-host-plan.mjs';
import {
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA,
} from './visual-lab-execution-tuning-plan.mjs';
import {
  VISUAL_LAB_ORIGIN_ATTESTATION_SCHEMA,
} from './visual-lab-origin-attestation.mjs';
import { createVisualCaptureGeometryProof } from '../src/shared/visual-capture-geometry.js';

export const LIVE_VISUAL_LAB_SMOKE_EVIDENCE_SCHEMA =
  'anifor.live-visual-lab-smoke-evidence/v1';
export const LIVE_VISUAL_LAB_SMOKE_EVIDENCE_MAX_BYTES = 16_384;

const MODULE_PATH = fileURLToPath(import.meta.url);
const CANDIDATE = 'water-motion';
const RECEIPT_SCHEMA = 'anifor.renderer.completed-frame-receipt/v1';
const SHA256_ID = /^sha256:[0-9a-f]{64}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const BROWSER_VERSION = /^[0-9]{1,4}(?:\.[0-9]{1,7}){3}$/;
const VARIANTS = Object.freeze(['off', 'a', 'b']);
const EXPECTED_SELECTION = Object.freeze({
  off: Object.freeze({
    visualLab: 'inactive', visualLabDomain: 'liquid', visualLabVariant: '0',
    visualLabTarget: '2', visualLabGain: '1',
  }),
  a: Object.freeze({
    visualLab: 'active', visualLabDomain: 'liquid', visualLabVariant: '1',
    visualLabTarget: '2', visualLabGain: '1',
  }),
  b: Object.freeze({
    visualLab: 'active', visualLabDomain: 'liquid', visualLabVariant: '2',
    visualLabTarget: '2', visualLabGain: '1',
  }),
});

const HELP = `Usage:
  node scripts/live-visual-lab-smoke-evidence.mjs \
    --batch-root=<verified-live-batch> \
    --expected-revision=<lowercase-40-hex-commit> \
    --browser-version=<four-part-chrome-version>

Writes one bounded, path-free success manifest to stdout. The source package is
fully reverified and never modified.`;

const deepFreeze = (value) => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

const exactObject = (value, keys, label) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || keys.some((key) => !actual.includes(key))) {
    throw new TypeError(`${label} must contain exactly ${keys.join(', ')}`);
  }
  return value;
};

const boundedInteger = (value, label, { positive = false, maximum = Number.MAX_SAFE_INTEGER } = {}) => {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0) || value > maximum) {
    throw new TypeError(`${label} must be a bounded ${positive ? 'positive' : 'unsigned'} integer`);
  }
  return value;
};

const positiveFinite = (value, label) => {
  if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${label} must be positive`);
  return value;
};

const normalizeBrowserVersion = (value) => {
  if (typeof value !== 'string' || !BROWSER_VERSION.test(value)) {
    throw new TypeError('browserVersion must be a four-part numeric Chrome version');
  }
  return value;
};

const normalizeResult = (result) => {
  exactObject(result, ['schema', 'id', 'candidate', 'request', 'captureSha256'], 'result');
  if (result.schema !== 'anifor.visual-lab.result/v1' || !SHA256_ID.test(result.id)
    || result.candidate !== CANDIDATE) {
    throw new TypeError('live smoke result identity is malformed');
  }
  const request = exactObject(
    result.request, ['domain', 'target', 'fixture', 'gain', 'renderScale'], 'result.request',
  );
  if (request.domain !== 'liquid' || request.target !== 2 || request.fixture !== CANDIDATE
    || request.gain !== 1 || request.renderScale !== 2) {
    throw new TypeError('live smoke result request is not canonical Water at 2x');
  }
  const hashes = exactObject(result.captureSha256, VARIANTS, 'result.captureSha256');
  if (VARIANTS.some((variant) => !SHA256_HEX.test(hashes[variant]))) {
    throw new TypeError('live smoke result capture hashes are malformed');
  }
  return {
    schema: result.schema,
    id: result.id,
    candidate: result.candidate,
    request: {
      domain: request.domain,
      target: request.target,
      fixture: request.fixture,
      gain: request.gain,
      renderScale: request.renderScale,
    },
    captureSha256: { off: hashes.off, a: hashes.a, b: hashes.b },
  };
};

const normalizeSemantic = (value) => {
  const source = exactObject(value, ['hash', 'occupied', 'countHash'], 'semantic');
  return {
    hash: boundedInteger(source.hash, 'semantic.hash', { maximum: 0xffff_ffff }),
    occupied: boundedInteger(source.occupied, 'semantic.occupied', { positive: true }),
    countHash: boundedInteger(source.countHash, 'semantic.countHash', { maximum: 0xffff_ffff }),
  };
};

const normalizeAlpha = (value, label) => {
  const source = exactObject(value, ['hash', 'supportHash', 'alphaSum', 'nonzero'], label);
  return {
    hash: boundedInteger(source.hash, `${label}.hash`, { maximum: 0xffff_ffff }),
    supportHash: boundedInteger(source.supportHash, `${label}.supportHash`, {
      maximum: 0xffff_ffff,
    }),
    alphaSum: boundedInteger(source.alphaSum, `${label}.alphaSum`, { positive: true }),
    nonzero: boundedInteger(source.nonzero, `${label}.nonzero`, { positive: true }),
  };
};

const normalizeCapture = (capture, variant, expectedHash) => {
  exactObject(capture, [
    'sha256', 'bytes', 'width', 'height', 'cssWidth', 'cssHeight', 'clipScale',
    'selection', 'completedFrameReceipt',
  ], `captures.${variant}`);
  if (capture.sha256 !== expectedHash) {
    throw new TypeError(`captures.${variant}.sha256 does not match result identity`);
  }
  if (!isDeepStrictEqual(capture.selection, EXPECTED_SELECTION[variant])) {
    throw new TypeError(`captures.${variant}.selection is not canonical`);
  }
  const receipt = exactObject(
    capture.completedFrameReceipt, ['schema', 'state'],
    `captures.${variant}.completedFrameReceipt`,
  );
  if (receipt.schema !== RECEIPT_SCHEMA || receipt.state !== 'completed') {
    throw new TypeError(`captures.${variant} lacks completed-frame receipt proof`);
  }
  if (capture.clipScale !== 1) {
    throw new TypeError(`captures.${variant}.clipScale must be 1`);
  }
  return {
    sha256: capture.sha256,
    bytes: boundedInteger(capture.bytes, `captures.${variant}.bytes`, { positive: true }),
    width: boundedInteger(capture.width, `captures.${variant}.width`, { positive: true }),
    height: boundedInteger(capture.height, `captures.${variant}.height`, { positive: true }),
    cssWidth: positiveFinite(capture.cssWidth, `captures.${variant}.cssWidth`),
    cssHeight: positiveFinite(capture.cssHeight, `captures.${variant}.cssHeight`),
    clipScale: 1,
    selection: { ...EXPECTED_SELECTION[variant] },
    completedFrameReceipt: { schema: receipt.schema, state: receipt.state },
  };
};

const normalizeCaptureGeometry = (value, renderScale) => {
  const expected = createVisualCaptureGeometryProof(renderScale);
  if (!isDeepStrictEqual(value, expected)) {
    throw new TypeError('live smoke captureGeometry is not the canonical proof');
  }
  return expected;
};

export function createLiveVisualLabSmokeEvidence(verification, options) {
  const expectedRevision = normalizeLivePagesRevision(options?.expectedRevision);
  const browserVersion = normalizeBrowserVersion(options?.browserVersion);
  if (verification?.index?.complete !== true
    || !isDeepStrictEqual(verification.index.summary, { selected: 1, passed: 1, failed: 0 })
    || verification.index.candidates?.length !== 1
    || verification.index.candidates[0]?.candidate !== CANDIDATE
    || verification.index.candidates[0]?.status !== 'passed') {
    throw new TypeError('live smoke verification must contain one complete Water candidate');
  }
  const origin = verification.originAttestation;
  if (origin?.schema !== VISUAL_LAB_ORIGIN_ATTESTATION_SCHEMA
    || origin.revision !== expectedRevision || origin.postCaptureRevision !== expectedRevision) {
    throw new TypeError('live smoke origin attestation does not bind the expected revision');
  }
  const browserHostPlan = verification.browserHostPlan;
  if (browserHostPlan?.schema !== VISUAL_LAB_BROWSER_HOST_PLAN_SCHEMA
    || !SHA256_ID.test(browserHostPlan.id)
    || browserHostPlan.requestedMode !== 'fresh') {
    throw new TypeError('live smoke browser-host proof is missing or noncanonical');
  }
  const tuningPlan = verification.executionTuningPlan;
  if (tuningPlan?.schema !== VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA
    || !SHA256_ID.test(tuningPlan.id) || tuningPlan.gpuMode !== 'swiftshader') {
    throw new TypeError('live smoke execution-tuning proof is not receipt-v2 SwiftShader');
  }
  if (!Array.isArray(verification.captureDiagnostics)
    || verification.captureDiagnostics.length !== 1) {
    throw new TypeError('live smoke verification lacks one capture diagnostic');
  }
  const diagnostic = verification.captureDiagnostics[0];
  const result = normalizeResult(diagnostic?.result);
  if (diagnostic?.candidate !== CANDIDATE
    || !isDeepStrictEqual(verification.index.candidates[0].result, result)) {
    throw new TypeError('live smoke capture diagnostic does not match its batch result');
  }
  const execution = diagnostic.execution;
  if (!SHA256_ID.test(execution?.captureEntryId) || execution.gpu !== 'swiftshader'
    || execution.executionTuning?.schema !== tuningPlan.schema
    || execution.executionTuning.planId !== tuningPlan.id
    || !SHA256_ID.test(execution.executionTuning.entryId)) {
    throw new TypeError('live smoke capture execution proof is inconsistent');
  }
  if (diagnostic.render?.backend !== 'webgl' || diagnostic.render.hdrPipeline !== 'active'
    || diagnostic.render.backingSize !== '1224x768') {
    throw new TypeError('live smoke did not use canonical 2x WebGL HDR rendering');
  }
  const captureGeometry = normalizeCaptureGeometry(
    diagnostic.captureGeometry, result.request.renderScale,
  );
  if (diagnostic.render.backingSize !== `${captureGeometry.canvas.backingWidth}x${
    captureGeometry.canvas.backingHeight}`) {
    throw new TypeError('live smoke render backingSize does not match captureGeometry');
  }
  if (!isDeepStrictEqual(diagnostic.invariants, {
    semantic: true, fieldAlpha: true, framebufferAlpha: true,
  })) {
    throw new TypeError('live smoke renderer invariants are incomplete');
  }
  const captures = exactObject(diagnostic.captures, VARIANTS, 'captures');
  for (const variant of VARIANTS) {
    const capture = captures[variant];
    if (capture?.width !== captureGeometry.canvas.width
      || capture?.height !== captureGeometry.canvas.height
      || capture?.cssWidth !== captureGeometry.canvas.width
      || capture?.cssHeight !== captureGeometry.canvas.height
      || capture?.clipScale !== captureGeometry.canvas.clipScale) {
      throw new TypeError(`live smoke captures.${variant} does not match captureGeometry`);
    }
  }

  return deepFreeze({
    schema: LIVE_VISUAL_LAB_SMOKE_EVIDENCE_SCHEMA,
    revision: expectedRevision,
    browser: { product: 'chrome', version: browserVersion },
    candidate: CANDIDATE,
    result,
    origin: {
      schema: origin.schema,
      checkedResources: boundedInteger(origin.checkedResources, 'origin.checkedResources', {
        positive: true,
      }),
      postCaptureRevision: origin.postCaptureRevision,
    },
    execution: {
      captureEntryId: execution.captureEntryId,
      browserHostPlan: {
        schema: browserHostPlan.schema,
        id: browserHostPlan.id,
        requestedMode: browserHostPlan.requestedMode,
      },
      executionTuning: {
        schema: tuningPlan.schema,
        planId: tuningPlan.id,
        entryId: execution.executionTuning.entryId,
        gpuMode: tuningPlan.gpuMode,
      },
    },
    render: {
      backend: diagnostic.render.backend,
      hdrPipeline: diagnostic.render.hdrPipeline,
      backingSize: diagnostic.render.backingSize,
      captureGeometry,
      invariants: { semantic: true, fieldAlpha: true, framebufferAlpha: true },
      semantic: normalizeSemantic(diagnostic.semantic),
      fieldAlpha: normalizeAlpha(diagnostic.fieldAlpha, 'fieldAlpha'),
      framebufferAlpha: normalizeAlpha(diagnostic.framebufferAlpha, 'framebufferAlpha'),
      captures: Object.fromEntries(VARIANTS.map((variant) => [
        variant, normalizeCapture(captures[variant], variant, result.captureSha256[variant]),
      ])),
    },
  });
}

export function serializeLiveVisualLabSmokeEvidence(evidence) {
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  if (Buffer.byteLength(serialized, 'utf8') > LIVE_VISUAL_LAB_SMOKE_EVIDENCE_MAX_BYTES) {
    throw new TypeError('live smoke evidence exceeds its 16384-byte budget');
  }
  return serialized;
}

export async function generateLiveVisualLabSmokeEvidence(options, dependencies = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('live smoke evidence options must be an object');
  }
  const allowed = new Set(['batchRoot', 'browserVersion', 'expectedRevision']);
  const unexpected = Reflect.ownKeys(options).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) {
    throw new TypeError(`Unknown live smoke evidence option ${String(unexpected[0])}`);
  }
  if (typeof options.batchRoot !== 'string' || options.batchRoot.length === 0) {
    throw new TypeError('live smoke evidence requires batchRoot');
  }
  const verify = dependencies.verifyBatch ?? verifyVisualLabBatchPackage;
  const verification = await verify({
    batchRoot: options.batchRoot,
    requireBrowserHostPlan: true,
    requireCaptureGeometry: true,
    requireExecutionTuningPlan: true,
    requireOriginAttestation: true,
    requireComplete: true,
    requireRecipeSet: true,
  });
  return createLiveVisualLabSmokeEvidence(verification, options);
}

export function parseLiveVisualLabSmokeEvidenceArguments(argv) {
  if (!Array.isArray(argv)) throw new TypeError('arguments must be an array');
  if (argv.includes('--help') || argv.includes('-h')) return Object.freeze({ help: true });
  const values = new Map();
  for (const argument of argv) {
    if (!argument.startsWith('--') || !argument.includes('=')) {
      throw new TypeError(`Unknown argument ${JSON.stringify(argument)}; options use --name=value`);
    }
    const separator = argument.indexOf('=');
    const name = argument.slice(2, separator);
    if (!['batch-root', 'browser-version', 'expected-revision'].includes(name)
      || values.has(name)) {
      throw new TypeError(`Unknown or duplicate live smoke evidence option --${name}`);
    }
    const value = argument.slice(separator + 1);
    if (value.length === 0) throw new TypeError(`--${name} must not be empty`);
    values.set(name, value);
  }
  for (const name of ['batch-root', 'browser-version', 'expected-revision']) {
    if (!values.has(name)) throw new TypeError(`--${name} is required`);
  }
  return Object.freeze({
    help: false,
    batchRoot: values.get('batch-root'),
    browserVersion: values.get('browser-version'),
    expectedRevision: values.get('expected-revision'),
  });
}

const main = async () => {
  try {
    const options = parseLiveVisualLabSmokeEvidenceArguments(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(`${HELP}\n`);
      return;
    }
    const { help: _help, ...generationOptions } = options;
    const evidence = await generateLiveVisualLabSmokeEvidence(generationOptions);
    process.stdout.write(serializeLiveVisualLabSmokeEvidence(evidence));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${JSON.stringify({
      tool: 'live-visual-lab-smoke-evidence-v1',
      ok: false,
      error: message.slice(0, 2_000),
    })}\n`);
    process.exitCode = 1;
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === MODULE_PATH) void main();
