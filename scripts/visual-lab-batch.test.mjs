import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fsPromises from 'node:fs/promises';
import {
  access, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile,
} from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createVisualLabBatchIndex,
  formatVisualLabBatchCliError,
  normalizeVisualLabBatchBaseUrl,
  parseVisualLabBatchArguments,
  renderVisualLabContactSheet,
  runVisualLabBatch,
  verifyVisualLabBatchPackage,
  VISUAL_LAB_BATCH_SCHEMA,
} from './visual-lab-batch.mjs';
import {
  buildVisualLabCaptureUrl,
  resolveVisualCaptureRequest,
  VISUAL_LAB_CAPTURE_PROTOCOL,
  visualLabFixturePreparationLabel,
} from './visual-lab-fixtures.mjs';
import {
  visualCaptureDriverDatasetExpectation,
  visualCaptureDriverReportFields,
  visualCaptureDriverStartupFields,
} from './visual-capture-drivers.mjs';
import { resolveVisualLabCaptureRecipe } from './visual-lab-recipes.mjs';
import { createVisualLabRecipeSet } from './visual-lab-recipe-set.mjs';
import { createVisualLabResultRecord } from './visual-lab-result.mjs';
import { createVisualLabExecutionPlan } from './visual-lab-execution-plan.mjs';
import { createVisualLabBrowserHostPlan } from './visual-lab-browser-host-plan.mjs';
import {
  resolveVisualCaptureExecutionCapabilities,
} from './visual-capture-execution-capabilities.mjs';
import {
  createVisualLabExecutionTuningPlan,
  VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA,
} from './visual-lab-execution-tuning-plan.mjs';
import {
  VISUAL_LAB_CAPTURE_SUBPHASE_TIMING_SCHEMA,
  VISUAL_LAB_TIMING_SCHEMA,
} from './visual-lab-timing.mjs';
import { isDetachedProcessGroupAlive } from './detached-process.mjs';
import { createVisualCaptureGeometryProof } from '../src/shared/visual-capture-geometry.js';

const temporaryDirectories = [];
const REMOTE_REVISION = '1234567890abcdef1234567890abcdef12345678';

const remoteAttestationDependencies = {
  verifyDeployment: async (baseUrl, revision) => {
    const root = new URL(baseUrl);
    const resourcePaths = [
      root.pathname,
      ...[
        'assets/app.js',
        'assets/style.css',
        'wasm/powder_core.wasm',
        'wasm/stillroom_core.js',
        'wasm/stillroom_core.wasm',
      ].map((relative) => new URL(relative, root).pathname),
    ];
    return Object.freeze({
      baseUrl: root.href,
      revision,
      resourcePaths: Object.freeze(resourcePaths),
      resourceCount: resourcePaths.length,
    });
  },
  verifyRevision: async (baseUrl, revision) => Object.freeze({ baseUrl, revision }),
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

const makeTemporaryDirectory = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'visual-lab-batch-test-'));
  temporaryDirectories.push(directory);
  return directory;
};

/** Interposes synchronously at the reader's open call, after its lstat completed. */
const replaceLeafWithSymlinkWhenOpened = async (file, target, operation) => {
  const absolute = path.resolve(file);
  const originalOpen = fsPromises.open;
  let interposed = false;
  fsPromises.open = async (openedPath, ...arguments_) => {
    if (!interposed && path.resolve(openedPath) === absolute) {
      interposed = true;
      await rm(absolute);
      await symlink(target, absolute);
    }
    return originalOpen(openedPath, ...arguments_);
  };
  syncBuiltinESMExports();
  try {
    await expect(operation()).rejects.toThrow(/changed while opening|symbolic link/i);
  } finally {
    fsPromises.open = originalOpen;
    syncBuiltinESMExports();
  }
  expect(interposed).toBe(true);
};

const snapshotPackageTree = async (root) => {
  const entries = [];
  const visit = async (relative) => {
    const file = path.join(root, relative);
    const details = await lstat(file, { bigint: true });
    const kind = details.isDirectory() ? 'directory' : details.isFile() ? 'file' : 'other';
    const entry = {
      relative,
      kind,
      dev: details.dev,
      ino: details.ino,
      mode: details.mode,
      nlink: details.nlink,
      size: details.size,
      mtimeNs: details.mtimeNs,
      ctimeNs: details.ctimeNs,
    };
    if (kind === 'file') entry.bytes = await readFile(file);
    entries.push(entry);
    if (kind === 'directory') {
      for (const name of (await readdir(file)).sort()) await visit(path.join(relative, name));
    }
  };
  await visit('');
  return entries;
};

const linuxProcessStartToken = async (pid) => {
  const source = await readFile(`/proc/${pid}/stat`, 'utf8');
  const commandEnd = source.lastIndexOf(')');
  const fields = source.slice(commandEnd + 1).trim().split(/\s+/);
  return fields[19];
};

const lifecycleOwnerForTest = (outputDirectory, candidate) => createHash('sha256')
  .update(`${path.resolve(outputDirectory)}\0${candidate}`, 'utf8').digest('hex');

const requestFor = (candidate) => {
  const recipe = resolveVisualLabCaptureRecipe(candidate);
  return {
    domain: recipe.domain,
    target: recipe.target,
    fixture: recipe.fixture,
    gain: recipe.gain,
    renderScale: recipe.renderScale,
  };
};

const stableHashes = (salt = '') => Object.fromEntries(
  ['off', 'a', 'b'].map((variant, index) => [
    variant,
    createHash('sha256').update(`${salt}:${variant}:${index}`).digest('hex'),
  ]),
);

const stableResult = (candidate, salt = candidate) => createVisualLabResultRecord(
  candidate,
  requestFor(candidate),
  stableHashes(salt),
);

const timingRecord = (multiplier = 1) => ({
  schema: VISUAL_LAB_TIMING_SCHEMA,
  phases: (() => {
    const values = Object.fromEntries([
      'plan', 'preflight', 'hostLaunch', 'targetSetup', 'startup', 'readiness',
      'off', 'a', 'b', 'finalize', 'rendererDispose', 'targetTeardown',
      'hostTeardown',
    ].map((name, index) => [name, (index + 1) * multiplier]));
    return { ...values, total: Object.values(values).reduce((sum, value) => sum + value, 0) };
  })(),
  counters: {
    browserHosts: 1,
    browserContexts: 1,
    targets: 1,
    hostRestarts: 0,
    captures: 3,
  },
});

const captureSubphaseRecord = (multiplier = 1) => ({
  schema: VISUAL_LAB_CAPTURE_SUBPHASE_TIMING_SCHEMA,
  readiness: {
    datasetWaitMs: 1 * multiplier,
    refreshMs: 2 * multiplier,
    snapshotAttempts: 2 * multiplier,
    readbackHashMs: 3 * multiplier,
  },
  captures: Object.fromEntries(['off', 'a', 'b'].map((variant, index) => [variant, {
    selectionMs: (index + 1) * multiplier,
    datasetWaitMs: (index + 2) * multiplier,
    snapshotAttempts: 2 * multiplier,
    readbackHashMs: (index + 3) * multiplier,
    screenshotMs: (index + 4) * multiplier,
    writeMs: (index + 5) * multiplier,
  }])),
});

const crc32 = (bytes) => {
  let value = 0xFFFFFFFF;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      value = (value >>> 1) ^ (value & 1 ? 0xEDB88320 : 0);
    }
  }
  return (value ^ 0xFFFFFFFF) >>> 0;
};

const pngChunk = (type, data) => {
  const typeBytes = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
};

const minimalPng = (width, height, seed) => {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const stride = width * 4 + 1;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = y * stride + 1 + x * 4;
      pixels[offset] = (seed + x * 17) & 0xFF;
      pixels[offset + 1] = (seed + y * 29) & 0xFF;
      pixels[offset + 2] = (seed + x + y) & 0xFF;
      pixels[offset + 3] = 0xFF;
    }
  }
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(pixels)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
};

const solidPng = (width, height) => {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(Buffer.alloc((width * 4 + 1) * height))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
};

const invalidCompressedPng = (width, height) => {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', Buffer.from('not a zlib stream')),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
};

const compressedTailPng = (width, height) => {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const pixels = Buffer.alloc((width * 4 + 1) * height);
  const compressed = Buffer.concat([deflateSync(pixels), Buffer.from('trailing-zlib-bytes')]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
};

const writeValidCapture = async (directory, candidate, options = {}) => {
  await mkdir(directory, { recursive: true });
  const recipe = resolveVisualLabCaptureRecipe(candidate);
  const {
    domainAdapter: domain,
    fixtureAdapter: fixture,
    captureDriver: driver,
  } = resolveVisualCaptureRequest(requestFor(candidate));
  const seed = createHash('sha256')
    .update(`${candidate}:${options.salt ?? 'default'}`).digest()[0];
  const captureGeometry = options.captureGeometry === true
    ? createVisualCaptureGeometryProof(recipe.renderScale)
    : options.captureGeometry;
  const defaultDimensions = captureGeometry === undefined
    ? { width: 2, height: 1 }
    : {
      width: captureGeometry.canvas.width,
      height: captureGeometry.canvas.height,
    };
  const buffers = Object.fromEntries(['off', 'a', 'b'].map((variant, index) => {
    const dimensions = options.dimensions?.[variant] ?? defaultDimensions;
    return [
      variant,
      options.imageBytes?.[variant]
        ?? (captureGeometry === undefined
          ? minimalPng(dimensions.width, dimensions.height, seed + index * 31)
          : solidPng(dimensions.width, dimensions.height)),
    ];
  }));
  const hashes = Object.fromEntries(Object.entries(buffers).map(([variant, bytes]) => [
    variant, createHash('sha256').update(bytes).digest('hex'),
  ]));
  for (const [variant, bytes] of Object.entries(buffers)) {
    await writeFile(path.join(directory, `${variant}.png`), bytes);
  }
  const result = createVisualLabResultRecord(candidate, requestFor(candidate), hashes);
  let executionTuning;
  let completedFrameReceiptProof = false;
  let gpu = 'auto';
  try {
    const tuningPlan = JSON.parse(await readFile(
      path.resolve(directory, '..', '..', 'execution-tuning-plan.json'), 'utf8',
    ));
    const tuningEntry = tuningPlan.entries.find((entry) => entry.candidate === candidate);
    gpu = tuningPlan.gpuMode;
    completedFrameReceiptProof = tuningPlan.schema
      === VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA;
    if (tuningEntry) {
      executionTuning = {
        schema: tuningPlan.schema,
        planId: tuningPlan.id,
        entryId: tuningEntry.id,
      };
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const backingSize = `${612 * recipe.renderScale}x${384 * recipe.renderScale}`;
  const fixturePreparation = visualLabFixturePreparationLabel(fixture);
  const report = {
    tool: 'visual-lab-audit-v1',
    ...visualCaptureDriverReportFields(driver),
    result,
    url: buildVisualLabCaptureUrl(
      options.baseUrl ?? 'http://127.0.0.1:5173/', requestFor(candidate),
    ).href,
    domain: recipe.domain,
    target: recipe.target,
    fixture: recipe.fixture,
    fixtureScene: fixture.scene,
    fixturePreparation,
    targetKind: domain.targetKind,
    domainCapability: {
      targetKind: domain.targetKind,
      executionProfile: domain.executionProfile,
      evidence: domain.evidence,
      fixedUrlParameters: domain.fixedUrlParameters,
    },
    captureProtocol: VISUAL_LAB_CAPTURE_PROTOCOL,
    gain: recipe.gain,
    renderScale: recipe.renderScale,
    gpu,
    ...(executionTuning === undefined ? {} : { executionTuning }),
    startupSelection: {
      requestedVariant: 2,
      fixture: recipe.fixture,
      scene: fixture.scene,
      preparation: fixturePreparation,
      fixturePrepared: true,
      backendBeforeSelection: 'canvas2d',
      backendReasonBeforeSelection: 'webgl-starting',
      stagedBeforeWebGL: true,
      ...visualCaptureDriverStartupFields(driver, 2),
    },
    backend: domain.executionProfile.backend,
    hdrPipeline: VISUAL_LAB_CAPTURE_PROTOCOL.datasetRequirements.hdrPipeline,
    backingSize,
    ...(captureGeometry === undefined ? {} : { captureGeometry }),
    captures: Object.fromEntries(['off', 'a', 'b'].map((variant, index) => [variant, {
      png: `/unrelated/absolute/machine/path/${candidate}/${variant}.png`,
      bytes: buffers[variant].byteLength,
      width: options.dimensions?.[variant]?.width ?? defaultDimensions.width,
      height: options.dimensions?.[variant]?.height ?? defaultDimensions.height,
      cssWidth: Math.max(1, options.dimensions?.[variant]?.width ?? defaultDimensions.width),
      cssHeight: Math.max(1, options.dimensions?.[variant]?.height ?? defaultDimensions.height),
      clipScale: 1,
      sha256: hashes[variant],
      distinctFromOff: hashes[variant] !== hashes.off,
      ...(completedFrameReceiptProof ? {
        completedFrameReceipt: {
          schema: 'anifor.renderer.completed-frame-receipt/v1',
          ticket: index + 1,
          submission: index + 10,
          state: 'completed',
        },
      } : {}),
      dataset: {
        renderer: VISUAL_LAB_CAPTURE_PROTOCOL.datasetRequirements.renderer,
        hdrPipeline: VISUAL_LAB_CAPTURE_PROTOCOL.datasetRequirements.hdrPipeline,
        renderLook: VISUAL_LAB_CAPTURE_PROTOCOL.fixedUrlParameters.renderLook,
        outputScale: String(recipe.renderScale),
        backingSize,
        ...visualCaptureDriverDatasetExpectation(driver, requestFor(candidate), index),
      },
    }])),
    warnings: options.warnings ?? [],
    invariants: {
      semantic: true,
      fieldAlpha: true,
      framebufferAlpha: true,
    },
    browserErrors: 0,
    ...(options.timings === undefined ? {} : { timings: options.timings }),
    ...(options.captureSubphases === undefined
      ? {} : { captureSubphases: options.captureSubphases }),
  };
  if (options.mutateReport) options.mutateReport(report);
  await writeFile(
    path.join(directory, options.reportFileName ?? 'report.json'),
    `${JSON.stringify(report)}\n`,
  );
  return { buffers, hashes, report, result };
};

describe('Visual Lab batch index', () => {
  it('normalizes records into a deterministic deeply frozen schema', () => {
    const gas = stableResult('gas-showcase');
    const reorderedGas = {
      captureSha256: gas.captureSha256,
      request: gas.request,
      candidate: gas.candidate,
      id: gas.id,
      schema: gas.schema,
    };
    const first = createVisualLabBatchIndex([
      { candidate: 'water-motion', status: 'failed', failure: 'capture-failed' },
      { candidate: 'gas-showcase', status: 'passed', result: reorderedGas, warnings: [] },
    ]);
    const second = createVisualLabBatchIndex([
      { candidate: 'gas-showcase', status: 'passed', result: gas, warnings: [] },
      { candidate: 'water-motion', status: 'failed', failure: 'capture-failed' },
    ]);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first).toEqual({
      schema: VISUAL_LAB_BATCH_SCHEMA,
      complete: false,
      summary: { selected: 2, passed: 1, failed: 1 },
      candidates: [
        {
          candidate: 'gas-showcase',
          status: 'passed',
          result: gas,
          artifacts: {
            report: 'candidates/gas-showcase/report.json',
            off: 'candidates/gas-showcase/off.png',
            a: 'candidates/gas-showcase/a.png',
            b: 'candidates/gas-showcase/b.png',
          },
          warnings: [],
        },
        {
          candidate: 'water-motion',
          status: 'failed',
          failure: 'capture-failed',
          artifacts: { diagnostic: 'candidates/water-motion/failure.log' },
        },
      ],
    });
    expect(Object.isFrozen(first)).toBe(true);
    expect(first.complete).toBe(false);
    expect(Object.isFrozen(first.summary)).toBe(true);
    expect(Object.isFrozen(first.candidates)).toBe(true);
    expect(first.candidates.every(Object.isFrozen)).toBe(true);
    expect(JSON.stringify(first)).not.toMatch(/\/tmp|unrelated\/absolute|timestamp/i);

    const complete = createVisualLabBatchIndex([
      { candidate: 'gas-showcase', status: 'passed', result: gas, warnings: [] },
    ]);
    expect(complete.complete).toBe(true);
    expect(renderVisualLabContactSheet(complete))
      .toContain('<strong>Complete</strong> · 1/1 passed');
  });

  it('rejects duplicate candidates, malformed results, warnings, and failure codes', () => {
    const result = stableResult('gas-showcase');
    expect(() => createVisualLabBatchIndex([])).toThrow('non-empty array');
    expect(() => createVisualLabBatchIndex([
      { candidate: 'gas-showcase', status: 'passed', result, warnings: [] },
      { candidate: 'gas-showcase', status: 'failed', failure: 'capture-failed' },
    ])).toThrow('Duplicate batch candidate');
    expect(() => createVisualLabBatchIndex([{
      candidate: 'gas-showcase', status: 'passed',
      result: { ...result, id: `sha256:${'0'.repeat(64)}` }, warnings: [],
    }])).toThrow('content-addressed record does not match recipe');
    const wrongRequest = createVisualLabResultRecord(
      'gas-showcase', { ...requestFor('gas-showcase'), target: 4 }, result.captureSha256,
    );
    expect(() => createVisualLabBatchIndex([{
      candidate: 'gas-showcase', status: 'passed', result: wrongRequest, warnings: [],
    }])).toThrow('content-addressed record does not match recipe');
    expect(() => createVisualLabBatchIndex([{
      candidate: 'gas-showcase', status: 'passed', result, warnings: [3],
    }])).toThrow('warnings');
    expect(() => createVisualLabBatchIndex([{
      candidate: 'gas-showcase', status: 'failed', failure: 'unknown',
    }])).toThrow('invalid status or failure code');
  });

  it('renders escaped, relative, off/A/B static contact cards', () => {
    const index = createVisualLabBatchIndex([
      {
        candidate: 'gas-showcase', status: 'passed', result: stableResult('gas-showcase'),
        warnings: ['<unsafe & "quoted">'],
      },
      { candidate: 'water-motion', status: 'failed', failure: 'artifact-invalid' },
    ]);
    const html = renderVisualLabContactSheet(index);

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<strong>Incomplete</strong> · 1/2 passed');
    expect(html).toContain('&lt;unsafe &amp; &quot;quoted&quot;&gt;');
    expect(html).not.toContain('<unsafe');
    expect(html).not.toContain('<script');
    expect(html).toContain('./candidates/gas-showcase/report.json');
    expect(html).toContain('./candidates/water-motion/failure.log');
    const off = html.indexOf('./candidates/gas-showcase/off.png');
    const a = html.indexOf('./candidates/gas-showcase/a.png');
    const b = html.indexOf('./candidates/gas-showcase/b.png');
    expect(off).toBeGreaterThan(0);
    expect(off).toBeLessThan(a);
    expect(a).toBeLessThan(b);
    expect(html).toContain('<figcaption>OFF</figcaption>');
    expect(html).toContain('<figcaption>A</figcaption>');
    expect(html).toContain('<figcaption>B</figcaption>');
    expect(html).not.toContain('<figcaption>Off</figcaption>');
    expect(renderVisualLabContactSheet(index)).toBe(html);

    const powder = renderVisualLabContactSheet(createVisualLabBatchIndex([{
      candidate: 'powder-style-atlas', status: 'passed',
      result: stableResult('powder-style-atlas'), warnings: [],
    }]));
    expect(powder).toContain('<figcaption>Smooth</figcaption>');
    expect(powder).toContain('<figcaption>Local</figcaption>');
    expect(powder).toContain('<figcaption>Grains</figcaption>');
  });
});

describe('Visual Lab batch runner', () => {
  it('runs catalog-ordered candidates sequentially and isolates exit and timeout failures', async () => {
    const root = await makeTemporaryDirectory();
    const bundle = path.join(root, 'dist', 'index.html');
    const outputDirectory = path.join(root, 'batch');
    await mkdir(path.dirname(bundle), { recursive: true });
    await writeFile(bundle, '<!doctype html>');
    const retainedNote = path.join(
      outputDirectory, 'candidates', 'gas-showcase', 'review-notes.txt',
    );
    await mkdir(path.dirname(retainedNote), { recursive: true });
    await writeFile(retainedNote, 'keep this user-owned comparison note');
    const calls = [];
    let active = 0;
    let maximumActive = 0;
    const runner = async (call) => {
      active++;
      maximumActive = Math.max(maximumActive, active);
      calls.push(call);
      await Promise.resolve();
      await writeValidCapture(call.candidateDirectory, call.recipe.name);
      active--;
      if (call.recipe.name === 'oxygen-showcase') {
        await writeFile(call.stderrPath, [
          'private raw child stderr',
          JSON.stringify({
            tool: 'visual-lab-audit-v1', ok: false,
            error: 'bounded structured child failure evidence',
          }),
        ].join('\n'));
        return { code: 9, signal: null };
      }
      if (call.recipe.name === 'oil-motion') {
        return { code: 0, signal: 'SIGTERM', timedOut: true };
      }
      return { code: 0, signal: null, timedOut: false };
    };

    const result = await runVisualLabBatch({
      candidates: ['water-motion', 'oil-motion', 'oxygen-showcase', 'gas-showcase'],
      bundle,
      outputDir: outputDirectory,
      gpu: 'swiftshader',
      chrome: '/fake/chrome',
      candidateTimeoutMs: 123_456,
    }, {
      runCandidate: runner,
      command: '/fake/node',
      auditScript: '/fake/visual-lab-audit.mjs',
      cwd: root,
    });

    expect(maximumActive).toBe(1);
    expect(calls.map(({ recipe }) => recipe.name)).toEqual([
      'gas-showcase', 'oxygen-showcase', 'oil-motion', 'water-motion',
    ]);
    for (const call of calls) {
      expect(call.command).toBe('/fake/node');
      expect(call.executionPlan.candidate).toBe(call.recipe.name);
      expect(call.executionPlan.request).toEqual(requestFor(call.recipe.name));
      expect(call.executionPlan.compiled.variants.map(({ name }) => name))
        .toEqual(['off', 'a', 'b']);
      expect(call.args).toContain(`--bundle=${path.resolve(bundle)}`);
      expect(call.args).toContain(`--candidate=${call.recipe.name}`);
      expect(call.args).toContain('--gpu=swiftshader');
      expect(call.args).toContain('--chrome=/fake/chrome');
      expect(call.args.join(' ')).not.toMatch(/npm|build/);
      expect(call.timeoutMs).toBe(123_456);
    }
    expect(result).toMatchObject({ ok: false, exitCode: 1 });
    expect(result.index.complete).toBe(false);
    expect(result.index.summary).toEqual({ selected: 4, passed: 2, failed: 2 });
    expect(result.index.candidates.map(({ status }) => status)).toEqual([
      'passed', 'failed', 'failed', 'passed',
    ]);
    expect(result.index.candidates[1].failure).toBe('capture-failed');
    expect(result.index.candidates[2].failure).toBe('capture-failed');
    expect(await readFile(
      path.join(outputDirectory, 'candidates', 'oxygen-showcase', 'failure.log'), 'utf8',
    )).toContain(
      'Audit child exited with code 9\nAudit diagnostic:\n'
      + 'bounded structured child failure evidence',
    );
    expect(await readFile(
      path.join(outputDirectory, 'candidates', 'oxygen-showcase', 'failure.log'), 'utf8',
    )).not.toContain('private raw child stderr');
    expect(await readFile(
      path.join(outputDirectory, 'candidates', 'oil-motion', 'failure.log'), 'utf8',
    )).toContain('Audit child timed out after 123456 ms');
    expect(await readFile(retainedNote, 'utf8')).toBe('keep this user-owned comparison note');
    expect(JSON.parse(await readFile(result.indexPath, 'utf8'))).toEqual(result.index);
    expect(await readFile(result.contactSheetPath, 'utf8'))
      .toContain('<strong>Incomplete</strong> · 2/4 passed');
  });

  it('treats a normalized HTTP(S) app root as a first-class capture source', async () => {
    const root = await makeTemporaryDirectory();
    const outputDirectory = path.join(root, 'remote-batch');
    const baseUrl = 'https://example.test/anifor';
    const canonicalBaseUrl = 'https://example.test/anifor/';
    const calls = [];
    const result = await runVisualLabBatch({
      candidates: ['gas-showcase'], baseUrl, expectedRevision: REMOTE_REVISION,
      outputDir: outputDirectory,
    }, {
      ...remoteAttestationDependencies,
      runCandidate: async (call) => {
        calls.push(call);
        await writeValidCapture(call.candidateDirectory, call.recipe.name, {
          baseUrl: canonicalBaseUrl,
          timings: timingRecord(),
        });
        return { code: 0, signal: null, timedOut: false };
      },
    });

    expect(result).toMatchObject({ ok: true, exitCode: 0 });
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toContain(`--base-url=${canonicalBaseUrl}`);
    expect(calls[0].args.some((argument) => argument.startsWith('--bundle='))).toBe(false);
    expect(calls[0].executionPlan.compiled.url).toMatch(/^https:\/\/example\.test\/anifor\//);
    expect(result.originAttestation).toMatchObject({
      baseUrl: canonicalBaseUrl,
      revision: REMOTE_REVISION,
      postCaptureRevision: REMOTE_REVISION,
      checkedResources: 6,
    });
    await expect(verifyVisualLabBatchPackage({
      batchRoot: outputDirectory,
      requireBrowserHostPlan: true,
      requireExecutionTuningPlan: true,
      requireOriginAttestation: true,
      requireRecipeSet: true,
    })).resolves.toMatchObject({
      originAttestation: { baseUrl: canonicalBaseUrl, revision: REMOTE_REVISION },
    });

    const wrongOriginAttestation = {
      ...result.originAttestation,
      baseUrl: 'https://other.example.test/anifor/',
    };
    await writeFile(
      result.originAttestationPath,
      `${JSON.stringify(wrongOriginAttestation, null, 2)}\n`,
    );
    await expect(verifyVisualLabBatchPackage({
      batchRoot: outputDirectory,
      requireOriginAttestation: true,
    })).rejects.toThrow('does not match gas-showcase capture base URL');
    await rm(result.originAttestationPath);
    await expect(verifyVisualLabBatchPackage({
      batchRoot: outputDirectory,
      requireOriginAttestation: true,
    })).rejects.toThrow('missing origin-attestation.json');

    const planWithoutSlash = await runVisualLabBatch({
      candidates: ['gas-showcase'], baseUrl, expectedRevision: REMOTE_REVISION,
      outputDir: path.join(root, 'remote-plan'), planOnly: true,
    });
    const planWithSlash = await runVisualLabBatch({
      candidates: ['gas-showcase'], baseUrl: canonicalBaseUrl,
      expectedRevision: REMOTE_REVISION,
      outputDir: path.join(root, 'remote-plan'), planOnly: true,
    });
    expect(planWithoutSlash.plan.id).toBe(planWithSlash.plan.id);
    expect(planWithoutSlash.runtime.baseUrl).toBe(canonicalBaseUrl);

    const defaultBundlePlan = await runVisualLabBatch({
      candidates: ['gas-showcase'], outputDir: path.join(root, 'local-plan'), planOnly: true,
    });
    const explicitBundlePlan = await runVisualLabBatch({
      candidates: ['gas-showcase'], bundle: path.resolve('dist/index.html'),
      outputDir: path.join(root, 'local-plan'), planOnly: true,
    });
    expect(defaultBundlePlan.plan.id).toBe(explicitBundlePlan.plan.id);
  });

  it('attests a remote revision before output mutation and again before completion', async () => {
    const root = await makeTemporaryDirectory();
    const rejectedOutput = path.join(root, 'preflight-rejected');
    await expect(runVisualLabBatch({
      candidates: ['gas-showcase'],
      baseUrl: 'https://example.test/anifor/',
      expectedRevision: REMOTE_REVISION,
      outputDir: rejectedOutput,
    }, {
      verifyDeployment: async () => { throw new Error('wrong deployed revision'); },
    })).rejects.toThrow('wrong deployed revision');
    await expect(access(rejectedOutput)).rejects.toThrow();

    const lockedPreflightOutput = path.join(root, 'locked-preflight-rejected');
    let deploymentChecks = 0;
    let runnerCalls = 0;
    await expect(runVisualLabBatch({
      candidates: ['gas-showcase'],
      baseUrl: 'https://example.test/anifor/',
      expectedRevision: REMOTE_REVISION,
      outputDir: lockedPreflightOutput,
    }, {
      ...remoteAttestationDependencies,
      verifyDeployment: async (...arguments_) => {
        deploymentChecks += 1;
        if (deploymentChecks === 2) throw new Error('deployment changed behind batch lock');
        return remoteAttestationDependencies.verifyDeployment(...arguments_);
      },
      runCandidate: async () => { runnerCalls += 1; return { code: 0 }; },
    })).rejects.toThrow('deployment changed behind batch lock');
    expect(deploymentChecks).toBe(2);
    expect(runnerCalls).toBe(0);
    await expect(access(path.join(lockedPreflightOutput, 'index.json'))).rejects.toThrow();

    const changedOutput = path.join(root, 'postflight-changed');
    await expect(runVisualLabBatch({
      candidates: ['gas-showcase'],
      baseUrl: 'https://example.test/anifor/',
      expectedRevision: REMOTE_REVISION,
      outputDir: changedOutput,
    }, {
      ...remoteAttestationDependencies,
      verifyRevision: async (baseUrl) => ({ baseUrl, revision: 'a'.repeat(40) }),
      runCandidate: async (call) => {
        await writeValidCapture(call.candidateDirectory, call.recipe.name, {
          baseUrl: 'https://example.test/anifor/',
        });
        return { code: 0, signal: null, timedOut: false };
      },
    })).rejects.toThrow('changed revision');
    await expect(access(path.join(changedOutput, 'index.json'))).rejects.toThrow();
  });

  it.skipIf(process.platform !== 'linux')(
    'uses the selected remote protocol when starting a shared host',
    async () => {
      const root = await makeTemporaryDirectory();
      const outputDirectory = path.join(root, 'shared-remote');
      const hostStarts = [];
      const result = await runVisualLabBatch({
        candidates: ['gas-showcase'],
        baseUrl: 'https://example.test/anifor',
        expectedRevision: REMOTE_REVISION,
        outputDir: outputDirectory,
        browserHost: 'shared',
      }, {
        ...remoteAttestationDependencies,
        startSharedHost: async (options) => {
          hostStarts.push(options);
          return {
            ready: async () => ({ browserWebSocketDebuggerUrl: 'ws://127.0.0.1:9222/remote' }),
            assertHealthy: async () => {},
            teardown: async () => {},
          };
        },
        runCandidate: async (call) => {
          const timings = timingRecord();
          timings.phases.total -= timings.phases.hostLaunch + timings.phases.hostTeardown;
          timings.phases.hostLaunch = 0;
          timings.phases.hostTeardown = 0;
          timings.counters.browserHosts = 0;
          await writeValidCapture(call.candidateDirectory, call.recipe.name, {
            baseUrl: 'https://example.test/anifor/',
            reportFileName: 'report.pending.json',
            timings,
          });
          return { code: 0, signal: null, timedOut: false };
        },
      });
      expect(result).toMatchObject({ ok: true, exitCode: 0 });
      expect(hostStarts).toHaveLength(1);
      expect(hostStarts[0]).toMatchObject({
        initialUrl: new URL('about:blank'),
        allowFileAccess: false,
      });
    },
  );

  it.skipIf(process.platform !== 'linux')(
    'reuses one injected host while keeping entry bindings, deferred publication, and identities exact',
    async () => {
      const root = await makeTemporaryDirectory();
      const bundle = path.join(root, 'index.html');
      const freshOutput = path.join(root, 'fresh');
      const sharedOutput = path.join(root, 'shared');
      const candidates = ['water-motion', 'gas-showcase'];
      const canonicalCandidates = ['gas-showcase', 'water-motion'];
      await writeFile(bundle, '<!doctype html>');

      const fresh = await runVisualLabBatch({
        candidates, bundle, outputDir: freshOutput,
      }, {
        runCandidate: async (call) => {
          await writeValidCapture(call.candidateDirectory, call.recipe.name);
          return { code: 0, signal: null, timedOut: false };
        },
      });

      const hostStarts = [];
      const childCalls = [];
      const teardownSnapshots = [];
      let hostHealthy = true;
      const shared = await runVisualLabBatch({
        candidates, bundle, outputDir: sharedOutput, browserHost: 'shared',
      }, {
        startSharedHost: async (options) => {
          hostStarts.push(options);
          return {
            ready: async () => ({
              browserWebSocketDebuggerUrl:
                'ws://127.0.0.1:9222/devtools/browser/injected-shared-host',
            }),
            assertHealthy: async () => {
              if (!hostHealthy) throw new Error('injected host was reused after teardown');
            },
            teardown: async () => {
              const snapshots = [];
              for (const candidate of canonicalCandidates) {
                const directory = path.join(sharedOutput, 'candidates', candidate);
                const present = async (name) => {
                  try { await access(path.join(directory, name)); return true; }
                  catch (error) {
                    if (error?.code === 'ENOENT') return false;
                    throw error;
                  }
                };
                snapshots.push({
                  candidate,
                  deferred: await present('report.pending.json'),
                  published: await present('report.json'),
                });
              }
              teardownSnapshots.push(snapshots);
              hostHealthy = false;
            },
          };
        },
        runCandidate: async (call) => {
          childCalls.push(call);
          const timings = timingRecord();
          timings.phases.total -= timings.phases.hostLaunch + timings.phases.hostTeardown;
          timings.phases.hostLaunch = 0;
          timings.phases.hostTeardown = 0;
          timings.counters.browserHosts = 0;
          await writeValidCapture(call.candidateDirectory, call.recipe.name, {
            reportFileName: 'report.pending.json',
            timings,
          });
          await expect(access(path.join(call.candidateDirectory, 'report.json')))
            .rejects.toMatchObject({ code: 'ENOENT' });
          return { code: 0, signal: null, timedOut: false };
        },
      });

      expect(hostStarts).toHaveLength(1);
      expect(childCalls.map(({ recipe }) => recipe.name)).toEqual(canonicalCandidates);
      const boundEntryIds = childCalls.map((call) => {
        expect(call.browserHostPlanEntry.captureEntryId).toBe(call.executionPlan.inspection.id);
        expect(call.executionTuningPlanEntry.captureEntryId)
          .toBe(call.executionPlan.inspection.id);
        expect(call.args).toContain('--browser-host=shared');
        expect(call.args).toContain('--defer-report=1');
        expect(call.args).toContain(
          `--browser-host-plan=${shared.browserHostPlanPath}`,
        );
        const argument = call.args.find((value) => value.startsWith('--browser-host-entry-id='));
        expect(argument).toBe(`--browser-host-entry-id=${call.browserHostPlanEntry.id}`);
        expect(call.args).toContain(
          `--execution-tuning-plan=${shared.executionTuningPlanPath}`,
        );
        expect(call.args).toContain(
          `--execution-tuning-entry-id=${call.executionTuningPlanEntry.id}`,
        );
        return call.browserHostPlanEntry.id;
      });
      expect(new Set(boundEntryIds).size).toBe(canonicalCandidates.length);
      expect(teardownSnapshots).toEqual([canonicalCandidates.map((candidate) => ({
        candidate, deferred: true, published: false,
      }))]);
      for (const candidate of canonicalCandidates) {
        const directory = path.join(sharedOutput, 'candidates', candidate);
        await expect(access(path.join(directory, 'report.json'))).resolves.toBeUndefined();
        await expect(access(path.join(directory, 'report.pending.json')))
          .rejects.toMatchObject({ code: 'ENOENT' });
      }
      expect(shared.browserHostRuntime).toMatchObject({
        requestedMode: 'shared',
        hostsStarted: 1,
        hostRestarts: 0,
        assignments: canonicalCandidates.map((candidate) => ({ candidate, host: 1 })),
        recycleReasons: ['cohort-complete'],
      });
      expect(shared.plan.id).toBe(fresh.plan.id);
      expect(shared.browserHostPlan.capturePlan.id).toBe(fresh.browserHostPlan.capturePlan.id);
      expect(shared.executionTuningPlan).toEqual(fresh.executionTuningPlan);
      expect(shared.index).toEqual(fresh.index);
      expect(shared.index.candidates.map(({ result }) => result.id))
        .toEqual(fresh.index.candidates.map(({ result }) => result.id));

      await expect(verifyVisualLabBatchPackage({
        batchRoot: sharedOutput,
        requireBrowserHostPlan: true,
        requireExecutionTuningPlan: true,
        requireComplete: true,
      })).resolves.toMatchObject({
        browserHostPlan: shared.browserHostPlan,
        executionTuningPlan: shared.executionTuningPlan,
      });
      const sharedPlanBytes = await readFile(shared.browserHostPlanPath);
      await writeFile(
        shared.browserHostPlanPath, `${JSON.stringify(fresh.browserHostPlan, null, 2)}\n`,
      );
      await expect(verifyVisualLabBatchPackage({
        batchRoot: sharedOutput,
        requireBrowserHostPlan: true,
      })).rejects.toThrow('does not match its capture timing');
      await writeFile(shared.browserHostPlanPath, sharedPlanBytes);

      const swiftshaderPlan = createVisualLabBrowserHostPlan(
        createVisualLabExecutionPlan({
          candidates,
          baseUrl: pathToFileURL(bundle),
          outputDir: sharedOutput,
          gpu: 'swiftshader',
        }),
        'shared',
      );
      await writeFile(
        shared.browserHostPlanPath, `${JSON.stringify(swiftshaderPlan, null, 2)}\n`,
      );
      await expect(verifyVisualLabBatchPackage({
        batchRoot: sharedOutput,
        requireBrowserHostPlan: true,
      })).rejects.toThrow('does not bind the captured execution plan identity');
      await writeFile(shared.browserHostPlanPath, sharedPlanBytes);

      const tuningPlanBytes = await readFile(shared.executionTuningPlanPath);
      const tamperedTuningPlan = structuredClone(shared.executionTuningPlan);
      tamperedTuningPlan.entries[0].profile.stability.pollIntervalMs++;
      await writeFile(
        shared.executionTuningPlanPath,
        `${JSON.stringify(tamperedTuningPlan, null, 2)}\n`,
      );
      await expect(verifyVisualLabBatchPackage({
        batchRoot: sharedOutput,
        requireExecutionTuningPlan: true,
      })).rejects.toThrow(/identity mismatch/);
      await writeFile(shared.executionTuningPlanPath, tuningPlanBytes);

      const gasReportPath = path.join(
        sharedOutput, 'candidates', 'gas-showcase', 'report.json',
      );
      const gasReportBytes = await readFile(gasReportPath);
      const gasReport = JSON.parse(gasReportBytes);
      gasReport.executionTuning.entryId = `sha256:${'0'.repeat(64)}`;
      await writeFile(gasReportPath, `${JSON.stringify(gasReport)}\n`);
      await expect(verifyVisualLabBatchPackage({
        batchRoot: sharedOutput,
        requireExecutionTuningPlan: true,
      })).rejects.toThrow(/execution-tuning proof.*does not match/);
      await writeFile(gasReportPath, gasReportBytes);

      const reindexed = await runVisualLabBatch({
        candidates,
        bundle,
        outputDir: sharedOutput,
        indexOnly: true,
      });
      expect(reindexed.browserHostPlan).toEqual(shared.browserHostPlan);
      expect(reindexed.executionTuningPlan).toEqual(shared.executionTuningPlan);
      expect(await readFile(shared.browserHostPlanPath)).toStrictEqual(sharedPlanBytes);
      expect(await readFile(shared.executionTuningPlanPath)).toStrictEqual(tuningPlanBytes);
    },
  );

  it.skipIf(process.platform !== 'linux')(
    'recycles an injected shared host after a candidate process fault before continuing',
    async () => {
      const root = await makeTemporaryDirectory();
      const bundle = path.join(root, 'index.html');
      const outputDirectory = path.join(root, 'shared');
      await writeFile(bundle, '<!doctype html>');
      const events = [];
      let activeHost = 0;

      const result = await runVisualLabBatch({
        candidates: ['oxygen-showcase', 'gas-showcase'],
        bundle,
        outputDir: outputDirectory,
        browserHost: 'shared',
      }, {
        startSharedHost: async () => {
          const host = ++activeHost;
          events.push(`start:${host}`);
          let healthy = true;
          return {
            ready: async () => ({
              browserWebSocketDebuggerUrl:
                `ws://127.0.0.1:922${host}/devtools/browser/injected-host-${host}`,
            }),
            assertHealthy: async () => {
              if (!healthy) throw new Error(`host ${host} was reused after teardown`);
            },
            teardown: async () => {
              events.push(`teardown:${host}`);
              healthy = false;
            },
          };
        },
        runCandidate: async (call) => {
          events.push(`run:${call.recipe.name}:host-${activeHost}`);
          if (call.recipe.name === 'gas-showcase') {
            return { code: 9, signal: null, timedOut: false };
          }
          expect(events).toContain('teardown:1');
          await writeValidCapture(call.candidateDirectory, call.recipe.name, {
            reportFileName: 'report.pending.json',
          });
          return { code: 0, signal: null, timedOut: false };
        },
      });

      expect(events.indexOf('teardown:1'))
        .toBeLessThan(events.indexOf('run:oxygen-showcase:host-2'));
      expect(events).toEqual([
        'start:1',
        'run:gas-showcase:host-1',
        'teardown:1',
        'start:2',
        'run:oxygen-showcase:host-2',
        'teardown:2',
      ]);
      expect(result.browserHostRuntime).toMatchObject({
        hostsStarted: 2,
        hostRestarts: 1,
        assignments: [
          { candidate: 'gas-showcase', host: 1 },
          { candidate: 'oxygen-showcase', host: 2 },
        ],
        recycleReasons: ['candidate-process-fault', 'cohort-complete'],
      });
      expect(result.index.candidates).toMatchObject([
        { candidate: 'gas-showcase', status: 'failed', failure: 'capture-failed' },
        { candidate: 'oxygen-showcase', status: 'passed' },
      ]);
    },
  );

  it.skipIf(process.platform !== 'linux')(
    'aborts before restart when failed host cleanup has no recoverable lifecycle handoff',
    async () => {
      const root = await makeTemporaryDirectory();
      const bundle = path.join(root, 'index.html');
      const outputDirectory = path.join(root, 'shared');
      await writeFile(bundle, '<!doctype html>');
      let hostStarts = 0;
      let candidateRuns = 0;

      await expect(runVisualLabBatch({
        candidates: ['gas-showcase', 'oxygen-showcase'],
        bundle,
        outputDir: outputDirectory,
        browserHost: 'shared',
      }, {
        startSharedHost: async () => {
          hostStarts += 1;
          return {
            ready: async () => {
              throw new Error('synthetic DevTools readiness fault');
            },
            assertHealthy: async () => {},
            teardown: async () => {
              throw new Error('synthetic process-group cleanup fault');
            },
          };
        },
        runCandidate: async () => {
          candidateRuns += 1;
          return { code: 0, signal: null, timedOut: false };
        },
      })).rejects.toThrow('Shared Chrome launch and cleanup both failed');

      expect(hostStarts).toBe(1);
      expect(candidateRuns).toBe(0);
      await expect(access(path.join(
        outputDirectory, '.shared-chrome-lifecycle.json',
      ))).rejects.toMatchObject({ code: 'ENOENT' });
    },
  );

  it('continues after a runner exception and does not accept a report from the failed run', async () => {
    const root = await makeTemporaryDirectory();
    const bundle = path.join(root, 'index.html');
    const outputDirectory = path.join(root, 'batch');
    await writeFile(bundle, '<!doctype html>');
    const visited = [];
    const timeouts = [];
    const result = await runVisualLabBatch({
      candidates: ['gas-showcase', 'water-motion'],
      bundle,
      outputDir: outputDirectory,
    }, {
      runCandidate: async (call) => {
        visited.push(call.recipe.name);
        timeouts.push(call.timeoutMs);
        await writeValidCapture(call.candidateDirectory, call.recipe.name);
        if (call.recipe.name === 'gas-showcase') throw new Error('synthetic spawn failure');
        return { code: 0, signal: null };
      },
    });

    expect(visited).toEqual(['gas-showcase', 'water-motion']);
    expect(timeouts).toEqual([300_000, 300_000]);
    expect(result.index.candidates[0]).toMatchObject({
      candidate: 'gas-showcase', status: 'failed', failure: 'capture-failed',
    });
    expect(result.index.candidates[1].status).toBe('passed');
    const originalFailure = await readFile(
      path.join(outputDirectory, 'candidates', 'gas-showcase', 'failure.log'), 'utf8',
    );

    let reindexRunnerCalls = 0;
    const reindexed = await runVisualLabBatch({
      candidates: ['water-motion', 'gas-showcase'],
      outputDir: outputDirectory,
      indexOnly: true,
    }, {
      runCandidate: async () => { reindexRunnerCalls++; return { code: 0 }; },
    });
    expect(reindexRunnerCalls).toBe(0);
    expect(reindexed.index.candidates.map(({ candidate, status, failure }) => (
      [candidate, status, failure]
    ))).toEqual([
      ['gas-showcase', 'failed', 'capture-failed'],
      ['water-motion', 'passed', undefined],
    ]);
    expect(await readFile(
      path.join(outputDirectory, 'candidates', 'gas-showcase', 'failure.log'), 'utf8',
    )).toBe(originalFailure);
  });

  it('invalidates a prior complete sheet before an interrupted rerun mutates candidates', async () => {
    const root = await makeTemporaryDirectory();
    const bundle = path.join(root, 'index.html');
    const outputDirectory = path.join(root, 'batch');
    const indexPath = path.join(outputDirectory, 'index.json');
    const contactSheetPath = path.join(outputDirectory, 'index.html');
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(bundle, '<!doctype html>');
    await writeFile(indexPath, '{"complete":true}\n');
    await writeFile(contactSheetPath, '<strong>Complete</strong>');
    const priorFailurePath = path.join(
      outputDirectory, 'candidates', 'gas-showcase', 'failure.log',
    );
    await mkdir(path.dirname(priorFailurePath), { recursive: true });
    await writeFile(priorFailurePath, 'capture-failed\nprior actionable diagnostic\n');
    const controller = new AbortController();

    await expect(runVisualLabBatch({
      candidates: ['gas-showcase'],
      bundle,
      outputDir: outputDirectory,
      signal: controller.signal,
    }, {
      runCandidate: async () => {
        controller.abort(new Error('synthetic interruption'));
        return { code: 0, signal: null, timedOut: false };
      },
    })).rejects.toThrow('synthetic interruption');

    await expect(readFile(indexPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(contactSheetPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(priorFailurePath, 'utf8'))
      .toBe('capture-failed\nprior actionable diagnostic\n');
  });

  it('publishes the contact sheet before the complete machine index', async () => {
    const root = await makeTemporaryDirectory();
    const bundle = path.join(root, 'index.html');
    const outputDirectory = path.join(root, 'batch');
    const indexPath = path.join(outputDirectory, 'index.json');
    await writeFile(bundle, '<!doctype html>');
    const published = [];

    await expect(runVisualLabBatch({
      candidates: ['gas-showcase'], bundle, outputDir: outputDirectory,
    }, {
      runCandidate: async (call) => {
        await writeValidCapture(call.candidateDirectory, call.recipe.name);
        return { code: 0, signal: null, timedOut: false };
      },
      publishFile: async (file, source) => {
        const name = path.basename(file);
        published.push(name);
        if (name === 'recipe-set.json' || name === 'browser-host-plan.json'
          || name === 'execution-tuning-plan.json') {
          await writeFile(file, source);
          return;
        }
        throw new Error('synthetic contact-sheet publication failure');
      },
    })).rejects.toThrow('synthetic contact-sheet publication failure');

    expect(published).toEqual([
      'recipe-set.json', 'browser-host-plan.json', 'execution-tuning-plan.json',
      'experiment-response.json',
    ]);
    await expect(access(indexPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('publishes an exact recipe-set sidecar without widening batch/v1', async () => {
    const root = await makeTemporaryDirectory();
    const outputDirectory = path.join(root, 'batch');
    const candidateRoot = path.join(outputDirectory, 'candidates');
    const recipeSet = createVisualLabRecipeSet(
      'cross-domain-review', ['water-motion', 'gas-showcase'],
    );
    await writeValidCapture(path.join(candidateRoot, 'gas-showcase'), 'gas-showcase');
    await writeValidCapture(path.join(candidateRoot, 'water-motion'), 'water-motion');

    const result = await runVisualLabBatch({ recipeSet, outputDir: outputDirectory, indexOnly: true });

    expect(result.ok).toBe(true);
    expect(result.recipeSet).toStrictEqual(recipeSet);
    expect(result.index.candidates.map(({ candidate }) => candidate)).toEqual([
      'gas-showcase', 'water-motion',
    ]);
    expect(JSON.parse(await readFile(result.recipeSetPath, 'utf8'))).toEqual(recipeSet);
    expect(Reflect.ownKeys(result.index)).toEqual([
      'schema', 'complete', 'summary', 'candidates',
    ]);
    expect(JSON.stringify(result.index)).not.toMatch(/recipe.?set/i);

    const sentinel = `${JSON.stringify(result.index)}\n`;
    await writeFile(result.indexPath, sentinel);
    const stale = JSON.parse(JSON.stringify(recipeSet));
    stale.recipes[0].target = 4;
    await expect(runVisualLabBatch({
      recipeSet: stale, outputDir: outputDirectory, indexOnly: true,
    })).rejects.toThrow('does not exactly match');
    expect(await readFile(result.indexPath, 'utf8')).toBe(sentinel);

    await expect(runVisualLabBatch({
      recipeSet,
      recipeSetSourcePath: path.join(outputDirectory, 'input.json'),
      outputDir: outputDirectory,
      indexOnly: true,
    })).rejects.toThrow('source must be outside');
    expect(await readFile(result.indexPath, 'utf8')).toBe(sentinel);
  });

  it('opts into receipt-bound v2 capture proof without changing result identity', async () => {
    const root = await makeTemporaryDirectory();
    const bundle = path.join(root, 'index.html');
    const outputDirectory = path.join(root, 'receipt-proof');
    await writeFile(bundle, '<!doctype html>');
    let expectedResult;

    const captured = await runVisualLabBatch({
      candidates: ['gas-showcase'],
      bundle,
      outputDir: outputDirectory,
      captureProof: 'completed-frame-receipt',
    }, {
      runCandidate: async (call) => {
        ({ result: expectedResult } = await writeValidCapture(
          call.candidateDirectory, call.recipe.name, { timings: timingRecord() },
        ));
        return { code: 0, signal: null, timedOut: false };
      },
    });

    expect(captured.executionTuningPlan).toMatchObject({
      schema: VISUAL_LAB_EXECUTION_TUNING_PLAN_V2_SCHEMA,
      entries: [{
        profile: {
          stability: { consecutiveSnapshots: 1 },
          completion: {
            capability: 'renderer-completed-frame-receipt/v1',
            receiptSchema: 'anifor.renderer.completed-frame-receipt/v1',
            requiredState: 'completed',
            bind: 'selected-presentation',
            verifyAfterSnapshot: true,
          },
        },
      }],
    });
    expect(captured.index.candidates[0].result)
      .toEqual(expectedResult);
    const verified = await verifyVisualLabBatchPackage({
      batchRoot: outputDirectory,
      requireExecutionTuningPlan: true,
      requireComplete: true,
    });
    expect(verified.executionTuningPlan).toEqual(captured.executionTuningPlan);
    expect(verified.captureDiagnostics).toHaveLength(1);
    const captureDiagnostic = verified.captureDiagnostics[0];
    expect(captureDiagnostic).toMatchObject({
      candidate: 'gas-showcase',
      result: expectedResult,
      render: {
        backend: 'webgl', hdrPipeline: 'active', backingSize: '1224x768',
      },
      captures: {
        off: { sha256: expectedResult.captureSha256.off },
        a: { sha256: expectedResult.captureSha256.a },
        b: { sha256: expectedResult.captureSha256.b },
      },
    });
    const captureDiagnosticJson = JSON.stringify(captureDiagnostic);
    expect(captureDiagnosticJson).not.toMatch(
      /unrelated\/absolute\/machine\/path|timings|ticket|submission|report\.json/,
    );

    const reportPath = path.join(
      outputDirectory, 'candidates', 'gas-showcase', 'report.json',
    );
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    report.captures.a.completedFrameReceipt.state = 'superseded';
    await writeFile(reportPath, `${JSON.stringify(report)}\n`);
    await expect(verifyVisualLabBatchPackage({
      batchRoot: outputDirectory,
      requireExecutionTuningPlan: true,
    })).rejects.toThrow(/completed-frame receipt proof/);
  });

  it('aggregates optional phase and capture-subphase telemetry outside frozen batch identity', async () => {
    const root = await makeTemporaryDirectory();
    const outputDirectory = path.join(root, 'batch');
    const candidateRoot = path.join(outputDirectory, 'candidates');
    await writeValidCapture(path.join(candidateRoot, 'gas-showcase'), 'gas-showcase', {
      timings: timingRecord(2),
      captureSubphases: captureSubphaseRecord(2),
    });
    await writeValidCapture(
      path.join(candidateRoot, 'oxygen-showcase'), 'oxygen-showcase',
    );

    const generated = await runVisualLabBatch({
      candidates: ['oxygen-showcase', 'gas-showcase'],
      outputDir: outputDirectory,
      indexOnly: true,
    });
    expect(generated.ok).toBe(true);
    expect(generated.timings.sampledCandidates).toEqual(['gas-showcase']);
    expect(generated.timings.phases.hostLaunch).toEqual({
      totalMs: 6,
      meanMs: 6,
      maxMs: 6,
    });
    expect(generated.timings.counters).toEqual({
      browserHosts: 1,
      browserContexts: 1,
      targets: 1,
      hostRestarts: 0,
      captures: 3,
    });
    expect(generated.captureSubphases.sampledCandidates).toEqual(['gas-showcase']);
    expect(generated.captureSubphases.readiness.datasetWaitMs).toEqual({
      totalMs: 2,
      meanMs: 2,
      maxMs: 2,
    });
    expect(generated.captureSubphases.captures.b.snapshotAttempts).toEqual({
      totalAttempts: 4,
      meanAttempts: 4,
      maxAttempts: 4,
    });
    expect(JSON.stringify(generated.index))
      .not.toMatch(/timings|captureSubphases|browserHosts|totalMs|snapshotAttempts/);
    expect(await readFile(generated.indexPath, 'utf8'))
      .not.toMatch(/timings|captureSubphases|browserHosts|snapshotAttempts/);

    const verified = await verifyVisualLabBatchPackage({
      batchRoot: outputDirectory,
      requireComplete: true,
    });
    expect(verified.timings).toEqual(generated.timings);
    expect(verified.captureSubphases).toEqual(generated.captureSubphases);

    await writeValidCapture(path.join(candidateRoot, 'gas-showcase'), 'gas-showcase', {
      timings: { ...timingRecord(), machinePath: '/tmp/not-portable' },
    });
    const rejected = await runVisualLabBatch({
      candidates: ['gas-showcase'], outputDir: outputDirectory, indexOnly: true,
    });
    expect(rejected.index.candidates[0]).toMatchObject({
      candidate: 'gas-showcase', status: 'failed', failure: 'report-invalid',
    });
    expect(await readFile(
      path.join(candidateRoot, 'gas-showcase', 'failure.log'), 'utf8',
    )).toContain('Visual Lab timings must contain exactly');
  });

  it('rejects malformed capture subphases while legacy omission preserves identity', async () => {
    const root = await makeTemporaryDirectory();
    const outputDirectory = path.join(root, 'batch');
    const candidateDirectory = path.join(
      outputDirectory, 'candidates', 'gas-showcase',
    );
    const written = await writeValidCapture(candidateDirectory, 'gas-showcase', {
      captureSubphases: captureSubphaseRecord(),
    });
    const withTelemetry = await runVisualLabBatch({
      candidates: ['gas-showcase'], outputDir: outputDirectory, indexOnly: true,
    });
    const identityBytes = JSON.stringify(withTelemetry.index);

    const legacyReport = structuredClone(written.report);
    delete legacyReport.captureSubphases;
    await writeFile(
      path.join(candidateDirectory, 'report.json'), `${JSON.stringify(legacyReport)}\n`,
    );
    const legacy = await runVisualLabBatch({
      candidates: ['gas-showcase'], outputDir: outputDirectory, indexOnly: true,
    });
    expect(JSON.stringify(legacy.index)).toBe(identityBytes);
    expect(legacy.captureSubphases.sampledCandidates).toEqual([]);

    const malformed = structuredClone(written.report);
    malformed.captureSubphases.machinePath = '/tmp/not-portable';
    await writeFile(
      path.join(candidateDirectory, 'report.json'), `${JSON.stringify(malformed)}\n`,
    );
    const rejected = await runVisualLabBatch({
      candidates: ['gas-showcase'], outputDir: outputDirectory, indexOnly: true,
    });
    expect(rejected.index.candidates[0]).toMatchObject({
      candidate: 'gas-showcase', status: 'failed', failure: 'report-invalid',
    });
    expect(await readFile(
      path.join(candidateDirectory, 'failure.log'), 'utf8',
    )).toContain('Visual Lab capture subphases must contain exactly');
  });

  it('accepts and projects the additive canonical capture geometry proof', async () => {
    const root = await makeTemporaryDirectory();
    const outputDirectory = path.join(root, 'batch');
    const candidateDirectory = path.join(
      outputDirectory, 'candidates', 'gas-showcase',
    );
    const written = await writeValidCapture(candidateDirectory, 'gas-showcase', {
      captureGeometry: true,
    });
    const canonical = createVisualCaptureGeometryProof(
      resolveVisualLabCaptureRecipe('gas-showcase').renderScale,
    );

    const accepted = await runVisualLabBatch({
      candidates: ['gas-showcase'], outputDir: outputDirectory, indexOnly: true,
    });
    expect(accepted.index.candidates[0].status).toBe('passed');
    const verified = await verifyVisualLabBatchPackage({
      batchRoot: outputDirectory, requireComplete: true,
    });
    expect(verified.captureDiagnostics[0].captureGeometry).toEqual(canonical);
    expect(JSON.stringify(verified.captureDiagnostics[0])).not.toMatch(/path|tmp|report\.json/);

    const legacy = structuredClone(written.report);
    delete legacy.captureGeometry;
    await writeFile(
      path.join(candidateDirectory, 'report.json'), `${JSON.stringify(legacy)}\n`,
    );
    const legacyAccepted = await runVisualLabBatch({
      candidates: ['gas-showcase'], outputDir: outputDirectory, indexOnly: true,
    });
    expect(legacyAccepted.index.candidates[0].status).toBe('passed');
    expect(legacyAccepted.index.candidates[0].result).toEqual(written.result);
    await expect(verifyVisualLabBatchPackage({
      batchRoot: outputDirectory,
      requireCaptureGeometry: true,
    })).rejects.toThrow('missing canonical captureGeometry proof for gas-showcase');

    const mutations = [
      ['marker', (report) => { report.captureGeometry.canvas.layoutMarker = 'wrong'; },
        'captureGeometry does not match the canonical proof'],
      ['viewport', (report) => { report.captureGeometry.viewport.width += 1; },
        'captureGeometry does not match the canonical proof'],
      ['rect', (report) => { report.captureGeometry.canvas.left += 1; },
        'captureGeometry does not match the canonical proof'],
      ['backing', (report) => { report.captureGeometry.canvas.backingWidth += 1; },
        'captureGeometry does not match the canonical proof'],
      ['reported backing', (report) => { report.backingSize = '1x1'; },
        'backingSize must be 1224x768'],
      ['capture CSS clip', (report) => { report.captures.a.cssWidth -= 1; },
        'a capture does not match captureGeometry'],
      ['capture pixel width', (report) => { report.captures.a.width -= 1; },
        'a capture does not match captureGeometry'],
    ];
    for (const [name, mutate, expectedError] of mutations) {
      const tampered = structuredClone(written.report);
      mutate(tampered);
      await writeFile(
        path.join(candidateDirectory, 'report.json'), `${JSON.stringify(tampered)}\n`,
      );
      await rm(path.join(candidateDirectory, 'failure.log'), { force: true });
      const rejected = await runVisualLabBatch({
        candidates: ['gas-showcase'], outputDir: outputDirectory, indexOnly: true,
      });
      expect(rejected.index.candidates[0], name).toMatchObject({
        candidate: 'gas-showcase', status: 'failed', failure: 'report-invalid',
      });
      expect(await readFile(path.join(candidateDirectory, 'failure.log'), 'utf8'))
        .toContain(expectedError);
    }
  });

  it('revalidates a complete portable package without changing any evidence', async () => {
    const root = await makeTemporaryDirectory();
    const outputDirectory = path.join(root, 'batch');
    const candidateDirectory = path.join(
      outputDirectory, 'candidates', 'gas-showcase',
    );
    const sourcePath = path.join(root, 'gas-review.json');
    const recipeSet = createVisualLabRecipeSet('gas-review', ['gas-showcase']);
    await writeFile(sourcePath, `${JSON.stringify(recipeSet, null, 2)}\n`);
    await writeValidCapture(candidateDirectory, 'gas-showcase');
    const generated = await runVisualLabBatch({
      recipeSet, outputDir: outputDirectory, indexOnly: true,
    });
    const before = await snapshotPackageTree(outputDirectory);

    const verified = await verifyVisualLabBatchPackage({
      batchRoot: outputDirectory,
      requireComplete: true,
      requireRecipeSet: true,
      recipeSetSourcePath: sourcePath,
    });

    expect(verified.index).toStrictEqual(generated.index);
    expect(verified.recipeSet).toStrictEqual(recipeSet);
    expect(generated.responsePath).toBe(path.join(outputDirectory, 'experiment-response.json'));
    expect(generated.experimentBoardPath).toBe(path.join(outputDirectory, 'experiment-board.html'));
    expect(verified.experimentResponse).toStrictEqual(generated.response);
    const experimentBoard = await readFile(generated.experimentBoardPath, 'utf8');
    expect(experimentBoard).toContain('Hashes authenticate files within this package only');
    expect(experimentBoard).toContain('no score or verdict');
    expect(experimentBoard).toContain('OFF→A');
    expect(experimentBoard).not.toMatch(/accepted baseline|promot(e|ion)/i);
    expect(await snapshotPackageTree(outputDirectory)).toStrictEqual(before);

    const incompleteDirectory = path.join(root, 'incomplete-batch');
    const incompleteCandidateDirectory = path.join(
      incompleteDirectory, 'candidates', 'gas-showcase',
    );
    await writeValidCapture(incompleteCandidateDirectory, 'gas-showcase');
    const incomplete = await runVisualLabBatch({
      candidates: ['gas-showcase', 'oxygen-showcase'],
      outputDir: incompleteDirectory,
      indexOnly: true,
    });
    expect(incomplete.index.complete).toBe(false);
    const incompleteBefore = await snapshotPackageTree(incompleteDirectory);
    await expect(verifyVisualLabBatchPackage({
      batchRoot: incompleteDirectory,
      requireComplete: false,
    })).resolves.toMatchObject({ index: incomplete.index });
    expect(await snapshotPackageTree(incompleteDirectory)).toStrictEqual(incompleteBefore);
  });

  it('reconstructs a present tuning sidecar even when every capture failed', async () => {
    const root = await makeTemporaryDirectory();
    const bundle = path.join(root, 'index.html');
    const outputDirectory = path.join(root, 'failed-batch');
    await writeFile(bundle, '<!doctype html>');
    const candidates = ['gas-showcase'];
    const generated = await runVisualLabBatch({
      candidates, bundle, outputDir: outputDirectory,
    }, {
      runCandidate: async () => ({ code: 9, signal: null, timedOut: false }),
    });

    expect(generated.index.complete).toBe(false);
    await expect(verifyVisualLabBatchPackage({
      batchRoot: outputDirectory,
      requireComplete: false,
    })).resolves.toMatchObject({ executionTuningPlan: generated.executionTuningPlan });

    const capturePlan = createVisualLabExecutionPlan({
      candidates,
      baseUrl: pathToFileURL(bundle),
      outputDir: outputDirectory,
      gpu: 'auto',
    });
    const alteredProfile = structuredClone(
      resolveVisualCaptureExecutionCapabilities('normal-hdr'),
    );
    alteredProfile.stability.timeoutMsByGpu.auto = 11_000;
    const alteredPlan = createVisualLabExecutionTuningPlan(capturePlan, {
      'normal-hdr': alteredProfile,
    });
    await writeFile(
      generated.executionTuningPlanPath,
      `${JSON.stringify(alteredPlan, null, 2)}\n`,
    );

    await expect(verifyVisualLabBatchPackage({
      batchRoot: outputDirectory,
      requireComplete: false,
    })).rejects.toThrow('does not bind the captured execution plan/capabilities');
  });

  it('rejects portable package tampering and symlinks while allowing legacy sidecar absence', async () => {
    const root = await makeTemporaryDirectory();
    const outputDirectory = path.join(root, 'batch');
    const candidateDirectory = path.join(
      outputDirectory, 'candidates', 'gas-showcase',
    );
    await writeValidCapture(candidateDirectory, 'gas-showcase');
    const generated = await runVisualLabBatch({
      candidates: ['gas-showcase'], outputDir: outputDirectory, indexOnly: true,
    });
    await writeFile(generated.contactSheetPath, '<!doctype html>tampered');
    await expect(verifyVisualLabBatchPackage({ batchRoot: outputDirectory }))
      .rejects.toThrow('contact sheet does not match');
    await writeFile(generated.contactSheetPath, renderVisualLabContactSheet(generated.index));

    expect(generated.browserHostPlan).toBeNull();
    expect(generated.executionTuningPlan).toBeNull();
    await expect(verifyVisualLabBatchPackage({
      batchRoot: outputDirectory, requireBrowserHostPlan: true,
    })).rejects.toThrow('missing browser-host-plan.json');
    await expect(verifyVisualLabBatchPackage({
      batchRoot: outputDirectory, requireExecutionTuningPlan: true,
    })).rejects.toThrow('missing execution-tuning-plan.json');

    const offPath = path.join(candidateDirectory, 'off.png');
    const offBytes = await readFile(offPath);
    const external = path.join(root, 'external.png');
    await writeFile(external, offBytes);
    await rm(offPath);
    await symlink(external, offPath);
    await expect(verifyVisualLabBatchPackage({ batchRoot: outputDirectory }))
      .rejects.toThrow('real regular file');
    await rm(offPath);
    await writeFile(offPath, offBytes);

    await expect(verifyVisualLabBatchPackage({ batchRoot: outputDirectory }))
      .resolves.toMatchObject({ browserHostPlan: null });
    await rm(generated.recipeSetPath);
    await expect(verifyVisualLabBatchPackage({
      batchRoot: outputDirectory, requireRecipeSet: false,
    })).resolves.toMatchObject({ recipeSet: null });
    await expect(verifyVisualLabBatchPackage({
      batchRoot: outputDirectory, requireRecipeSet: true,
    })).rejects.toThrow('missing recipe-set.json');
    await expect(verifyVisualLabBatchPackage({
      batchRoot: `${outputDirectory}/../batch`, requireRecipeSet: false,
    })).rejects.toThrow('canonical without dot segments');
  });

  it('rejects a regular index leaf replaced by a symlink between lstat and open', async () => {
    if (process.platform === 'win32') return;
    const root = await makeTemporaryDirectory();
    const outputDirectory = path.join(root, 'batch');
    const candidateDirectory = path.join(
      outputDirectory, 'candidates', 'gas-showcase',
    );
    await writeValidCapture(candidateDirectory, 'gas-showcase');
    const generated = await runVisualLabBatch({
      candidates: ['gas-showcase'], outputDir: outputDirectory, indexOnly: true,
    });
    const replacement = path.join(root, 'replacement-index.json');
    await writeFile(replacement, await readFile(generated.indexPath));

    // The open wrapper is the interposition point: readStableRegularFile has
    // already lstat'ed index.json, but has not yet issued its no-follow open.
    await replaceLeafWithSymlinkWhenOpened(
      generated.indexPath,
      replacement,
      () => verifyVisualLabBatchPackage({ batchRoot: outputDirectory }),
    );
    expect(await readFile(replacement)).toStrictEqual(await readFile(generated.indexPath));
  });

  it('fails closed on a passed candidate with a symlinked failure tombstone', async () => {
    if (process.platform === 'win32') return;
    const root = await makeTemporaryDirectory();
    const outputDirectory = path.join(root, 'batch');
    const candidateDirectory = path.join(
      outputDirectory, 'candidates', 'gas-showcase',
    );
    await writeValidCapture(candidateDirectory, 'gas-showcase');
    await runVisualLabBatch({
      candidates: ['gas-showcase'], outputDir: outputDirectory, indexOnly: true,
    });
    const failurePath = path.join(candidateDirectory, 'failure.log');
    const external = path.join(root, 'external-failure.log');
    await writeFile(external, 'capture-failed\nexternal diagnostic\n');
    await symlink(external, failurePath);

    await expect(verifyVisualLabBatchPackage({ batchRoot: outputDirectory }))
      .rejects.toThrow('failure tombstone must not be a symbolic link');
    expect(await readFile(external, 'utf8')).toBe('capture-failed\nexternal diagnostic\n');
  });

  it('indexes existing reports without a runner and isolates stale or tampered artifacts', async () => {
    const root = await makeTemporaryDirectory();
    const outputDirectory = path.join(root, 'batch');
    const candidateRoot = path.join(outputDirectory, 'candidates');
    const gasDirectory = path.join(candidateRoot, 'gas-showcase');
    const oxygenDirectory = path.join(candidateRoot, 'oxygen-showcase');
    const waterDirectory = path.join(candidateRoot, 'water-motion');
    await writeValidCapture(gasDirectory, 'gas-showcase', { warnings: ['portable result'] });
    await writeValidCapture(oxygenDirectory, 'oxygen-showcase', {
      mutateReport: (report) => {
        report.result = { ...report.result, id: `sha256:${'0'.repeat(64)}` };
      },
    });
    await writeValidCapture(waterDirectory, 'water-motion');
    await writeFile(path.join(waterDirectory, 'b.png'), 'tampered bytes');
    let runnerCalls = 0;

    const options = {
      candidates: ['gas-showcase', 'oxygen-showcase', 'oil-motion', 'water-motion'],
      bundle: path.join(root, 'does-not-exist', 'index.html'),
      outputDir: outputDirectory,
      indexOnly: true,
    };
    const dependencies = {
      runCandidate: async () => { runnerCalls++; throw new Error('must not run'); },
    };
    const first = await runVisualLabBatch(options, dependencies);
    const firstIndexBytes = await readFile(first.indexPath, 'utf8');
    const second = await runVisualLabBatch(options, dependencies);
    const secondIndexBytes = await readFile(second.indexPath, 'utf8');

    expect(runnerCalls).toBe(0);
    expect(first.ok).toBe(false);
    expect(first.index.candidates.map(({ status, failure }) => [status, failure])).toEqual([
      ['passed', undefined],
      ['failed', 'report-invalid'],
      ['failed', 'report-missing'],
      ['failed', 'artifact-invalid'],
    ]);
    expect(first.index.candidates[0].result.candidate).toBe('gas-showcase');
    expect(JSON.stringify(first.index)).not.toContain('/unrelated/absolute/machine/path');
    expect(firstIndexBytes).toBe(secondIndexBytes);
    expect(second.index).toEqual(first.index);
  });

  it('requires all capture invariants and a browser-error-free report', async () => {
    const root = await makeTemporaryDirectory();
    const outputDirectory = path.join(root, 'batch');
    const candidateRoot = path.join(outputDirectory, 'candidates');
    await writeValidCapture(path.join(candidateRoot, 'gas-showcase'), 'gas-showcase', {
      mutateReport: (report) => { report.invariants.fieldAlpha = false; },
    });
    await writeValidCapture(path.join(candidateRoot, 'oxygen-showcase'), 'oxygen-showcase', {
      mutateReport: (report) => { report.browserErrors = 1; },
    });

    const result = await runVisualLabBatch({
      candidates: ['oxygen-showcase', 'gas-showcase'],
      outputDir: outputDirectory,
      indexOnly: true,
    });

    expect(result.index.candidates.map(({ candidate, failure }) => [candidate, failure])).toEqual([
      ['gas-showcase', 'report-invalid'],
      ['oxygen-showcase', 'report-invalid'],
    ]);
    expect(await readFile(
      path.join(candidateRoot, 'gas-showcase', 'failure.log'), 'utf8',
    )).toContain('invariants must all pass');
    expect(await readFile(
      path.join(candidateRoot, 'oxygen-showcase', 'failure.log'), 'utf8',
    )).toContain('browserErrors must be exactly zero');
  });

  it('admits only current staged canonical WebGL/HDR capture records', async () => {
    const root = await makeTemporaryDirectory();
    const outputDirectory = path.join(root, 'batch');
    const candidateRoot = path.join(outputDirectory, 'candidates');
    await writeValidCapture(path.join(candidateRoot, 'gas-showcase'), 'gas-showcase', {
      mutateReport: (report) => {
        report.backend = 'canvas2d';
        report.hdrPipeline = 'inactive';
      },
    });
    await writeValidCapture(path.join(candidateRoot, 'oxygen-showcase'), 'oxygen-showcase', {
      mutateReport: (report) => { report.startupSelection.stagedBeforeWebGL = false; },
    });
    await writeValidCapture(path.join(candidateRoot, 'oil-motion'), 'oil-motion', {
      mutateReport: (report) => { report.captures.a.dataset.hdrPipeline = 'inactive'; },
    });
    await writeValidCapture(path.join(candidateRoot, 'water-motion'), 'water-motion', {
      mutateReport: (report) => { report.target = 8; },
    });

    const result = await runVisualLabBatch({
      candidates: ['water-motion', 'oil-motion', 'oxygen-showcase', 'gas-showcase'],
      outputDir: outputDirectory,
      indexOnly: true,
    });

    expect(result.index.candidates.map(({ candidate, failure }) => [candidate, failure])).toEqual([
      ['gas-showcase', 'report-invalid'],
      ['oxygen-showcase', 'report-invalid'],
      ['oil-motion', 'report-invalid'],
      ['water-motion', 'report-invalid'],
    ]);
    expect(await readFile(
      path.join(candidateRoot, 'gas-showcase', 'failure.log'), 'utf8',
    )).toContain('canonical WebGL with active HDR');
    expect(await readFile(
      path.join(candidateRoot, 'oxygen-showcase', 'failure.log'), 'utf8',
    )).toContain('startup selection was not staged');
    expect(await readFile(
      path.join(candidateRoot, 'oil-motion', 'failure.log'), 'utf8',
    )).toContain('capture dataset does not match');
    expect(await readFile(
      path.join(candidateRoot, 'water-motion', 'failure.log'), 'utf8',
    )).toContain('top-level target does not match');
  });

  it('rejects render-affecting URL state outside the hermetic plan query', async () => {
    const root = await makeTemporaryDirectory();
    const outputDirectory = path.join(root, 'batch');
    const candidateRoot = path.join(outputDirectory, 'candidates');
    await writeValidCapture(path.join(candidateRoot, 'gas-showcase'), 'gas-showcase', {
      mutateReport: (report) => {
        const url = new URL(report.url);
        url.searchParams.set('gasCoreDepthVfx', '0');
        report.url = url.href;
      },
    });
    await writeValidCapture(
      path.join(candidateRoot, 'oxygen-showcase'), 'oxygen-showcase',
    );

    const result = await runVisualLabBatch({
      candidates: ['gas-showcase', 'oxygen-showcase'],
      outputDir: outputDirectory,
      indexOnly: true,
    });

    expect(result.index.candidates.map(({ candidate, status, failure }) => (
      [candidate, status, failure]
    ))).toEqual([
      ['gas-showcase', 'failed', 'report-invalid'],
      ['oxygen-showcase', 'passed', undefined],
    ]);
    expect(await readFile(
      path.join(candidateRoot, 'gas-showcase', 'failure.log'), 'utf8',
    )).toContain('capture URL query does not match the hermetic execution plan');
  });

  it('validates the typed Powder source-stage driver without weakening HDR reports', async () => {
    const root = await makeTemporaryDirectory();
    const outputDirectory = path.join(root, 'batch');
    const candidateDirectory = path.join(
      outputDirectory, 'candidates', 'powder-style-atlas',
    );
    const { report } = await writeValidCapture(
      candidateDirectory, 'powder-style-atlas',
    );
    expect(report.captureDriver).toEqual({
      name: 'powder-render-style',
      framebufferAlphaPolicy: 'style-owned-nonempty',
      variants: {
        off: { selection: 'smooth', label: 'Smooth' },
        a: { selection: 'local', label: 'Local' },
        b: { selection: 'grains', label: 'Grains' },
      },
    });

    const accepted = await runVisualLabBatch({
      candidates: ['powder-style-atlas'], outputDir: outputDirectory, indexOnly: true,
    });
    expect(accepted.index.complete).toBe(true);

    await writeValidCapture(candidateDirectory, 'powder-style-atlas', {
      mutateReport: (candidateReport) => {
        candidateReport.captures.a.dataset.powderRenderStyle = 'smooth';
      },
    });
    const rejected = await runVisualLabBatch({
      candidates: ['powder-style-atlas'], outputDir: outputDirectory, indexOnly: true,
    });
    expect(rejected.index.candidates[0]).toMatchObject({
      candidate: 'powder-style-atlas', status: 'failed', failure: 'report-invalid',
    });
    expect(await readFile(path.join(candidateDirectory, 'failure.log'), 'utf8'))
      .toContain('capture dataset does not match the requested driver state');
  });

  it('enforces registry-owned report and startup metadata exposure', async () => {
    const root = await makeTemporaryDirectory();
    const outputDirectory = path.join(root, 'batch');
    const candidateRoot = path.join(outputDirectory, 'candidates');
    await writeValidCapture(path.join(candidateRoot, 'gas-showcase'), 'gas-showcase', {
      mutateReport: (report) => { report.captureDriver = { hostile: true }; },
    });
    await writeValidCapture(
      path.join(candidateRoot, 'oxygen-showcase'), 'oxygen-showcase', {
        mutateReport: (report) => {
          report.startupSelection.captureDriver = 'normal-hdr';
          report.startupSelection.selection = 2;
        },
      },
    );
    await writeValidCapture(
      path.join(candidateRoot, 'powder-style-atlas'), 'powder-style-atlas', {
        mutateReport: (report) => { delete report.captureDriver; },
      },
    );

    const result = await runVisualLabBatch({
      candidates: ['powder-style-atlas', 'oxygen-showcase', 'gas-showcase'],
      outputDir: outputDirectory,
      indexOnly: true,
    });
    expect(result.index.candidates.every(({ status }) => status === 'failed')).toBe(true);
    expect(await readFile(path.join(candidateRoot, 'gas-showcase', 'failure.log'), 'utf8'))
      .toContain('normal-HDR reports must not add a capture-driver descriptor');
    expect(await readFile(path.join(candidateRoot, 'oxygen-showcase', 'failure.log'), 'utf8'))
      .toContain('startup selection was not staged');
    expect(await readFile(
      path.join(candidateRoot, 'powder-style-atlas', 'failure.log'), 'utf8',
    )).toContain('capture-driver descriptor does not match the current typed driver');
  });

  it('validates PNG signatures, canonical IHDR, nonzero size, and consistent dimensions', async () => {
    const root = await makeTemporaryDirectory();
    const outputDirectory = path.join(root, 'batch');
    const candidateRoot = path.join(outputDirectory, 'candidates');
    const brokenIhdr = minimalPng(2, 1, 47);
    brokenIhdr.write('NOPE', 12, 'ascii');
    await writeValidCapture(path.join(candidateRoot, 'gas-showcase'), 'gas-showcase', {
      imageBytes: { a: Buffer.from('not a png') },
    });
    await writeValidCapture(path.join(candidateRoot, 'oxygen-showcase'), 'oxygen-showcase', {
      dimensions: { b: { width: 3, height: 1 } },
    });
    await writeValidCapture(path.join(candidateRoot, 'oil-motion'), 'oil-motion', {
      dimensions: {
        off: { width: 0, height: 1 },
        a: { width: 0, height: 1 },
        b: { width: 0, height: 1 },
      },
    });
    await writeValidCapture(path.join(candidateRoot, 'water-motion'), 'water-motion', {
      imageBytes: { a: brokenIhdr },
    });

    const result = await runVisualLabBatch({
      candidates: ['gas-showcase', 'oxygen-showcase', 'oil-motion', 'water-motion'],
      outputDir: outputDirectory,
      indexOnly: true,
    });

    expect(result.index.candidates.every(({ failure }) => failure === 'artifact-invalid')).toBe(true);
    expect(await readFile(
      path.join(candidateRoot, 'gas-showcase', 'failure.log'), 'utf8',
    )).toContain('does not have a PNG signature');
    expect(await readFile(
      path.join(candidateRoot, 'oxygen-showcase', 'failure.log'), 'utf8',
    )).toContain('PNG dimensions are inconsistent');
    expect(await readFile(
      path.join(candidateRoot, 'oil-motion', 'failure.log'), 'utf8',
    )).toContain('has zero PNG dimensions');
    expect(await readFile(
      path.join(candidateRoot, 'water-motion', 'failure.log'), 'utf8',
    )).toContain('canonical IHDR');
  });

  it('binds PNG byte counts, declared pixel size, and a complete chunk tail', async () => {
    const root = await makeTemporaryDirectory();
    const outputDirectory = path.join(root, 'batch');
    const candidateRoot = path.join(outputDirectory, 'candidates');
    await writeValidCapture(path.join(candidateRoot, 'gas-showcase'), 'gas-showcase', {
      mutateReport: (report) => { report.captures.a.bytes++; },
    });
    await writeValidCapture(path.join(candidateRoot, 'oxygen-showcase'), 'oxygen-showcase', {
      mutateReport: (report) => { report.captures.a.width++; },
    });
    const truncated = minimalPng(2, 1, 83).subarray(0, -12);
    await writeValidCapture(path.join(candidateRoot, 'water-motion'), 'water-motion', {
      imageBytes: { b: truncated },
    });
    const trailing = Buffer.concat([minimalPng(2, 1, 97), Buffer.from('tail')]);
    await writeValidCapture(path.join(candidateRoot, 'oil-motion'), 'oil-motion', {
      imageBytes: { b: trailing },
    });

    const result = await runVisualLabBatch({
      candidates: ['gas-showcase', 'oxygen-showcase', 'oil-motion', 'water-motion'],
      outputDir: outputDirectory,
      indexOnly: true,
    });

    expect(result.index.candidates.every(({ failure }) => failure === 'artifact-invalid')).toBe(true);
    expect(await readFile(
      path.join(candidateRoot, 'gas-showcase', 'failure.log'), 'utf8',
    )).toContain('byte count does not match report');
    expect(await readFile(
      path.join(candidateRoot, 'oxygen-showcase', 'failure.log'), 'utf8',
    )).toContain('dimensions do not match report');
    expect(await readFile(
      path.join(candidateRoot, 'water-motion', 'failure.log'), 'utf8',
    )).toContain('complete IHDR/IDAT/IEND');
    expect(await readFile(
      path.join(candidateRoot, 'oil-motion', 'failure.log'), 'utf8',
    )).toContain('invalid IEND tail');
  });

  it('rejects PNG CRC, compressed payload, and CSS-clip mismatches', async () => {
    const root = await makeTemporaryDirectory();
    const outputDirectory = path.join(root, 'batch');
    const candidateRoot = path.join(outputDirectory, 'candidates');
    const badCrc = minimalPng(2, 1, 53);
    badCrc[41] ^= 0xFF;
    await writeValidCapture(path.join(candidateRoot, 'gas-showcase'), 'gas-showcase', {
      imageBytes: { a: badCrc },
    });
    await writeValidCapture(path.join(candidateRoot, 'water-motion'), 'water-motion', {
      imageBytes: { a: invalidCompressedPng(2, 1) },
    });
    await writeValidCapture(path.join(candidateRoot, 'oxygen-showcase'), 'oxygen-showcase', {
      mutateReport: (report) => { report.captures.b.cssWidth += 4; },
    });
    await writeValidCapture(path.join(candidateRoot, 'oil-motion'), 'oil-motion', {
      imageBytes: { a: compressedTailPng(2, 1) },
    });

    const result = await runVisualLabBatch({
      candidates: ['gas-showcase', 'water-motion', 'oxygen-showcase', 'oil-motion'],
      outputDir: outputDirectory,
      indexOnly: true,
    });

    expect(result.index.candidates.map(({ candidate, failure }) => [candidate, failure])).toEqual([
      ['gas-showcase', 'artifact-invalid'],
      ['oxygen-showcase', 'report-invalid'],
      ['oil-motion', 'artifact-invalid'],
      ['water-motion', 'artifact-invalid'],
    ]);
    expect(await readFile(
      path.join(candidateRoot, 'gas-showcase', 'failure.log'), 'utf8',
    )).toContain('invalid IDAT PNG CRC');
    expect(await readFile(
      path.join(candidateRoot, 'water-motion', 'failure.log'), 'utf8',
    )).toContain('invalid compressed PNG image stream');
    expect(await readFile(
      path.join(candidateRoot, 'oxygen-showcase', 'failure.log'), 'utf8',
    )).toContain('scale-1 CSS canvas clip');
    expect(await readFile(
      path.join(candidateRoot, 'oil-motion', 'failure.log'), 'utf8',
    )).toContain('compressed stream has trailing bytes');
  });

  it('bounds a child that remains unsettled after SIGKILL', async () => {
    const root = await makeTemporaryDirectory();
    const bundle = path.join(root, 'index.html');
    const outputDirectory = path.join(root, 'batch');
    await writeFile(bundle, '<!doctype html>');
    const result = await runVisualLabBatch({
      candidates: ['gas-showcase'], bundle, outputDir: outputDirectory,
    }, {
      runCandidate: async (call) => {
        await writeValidCapture(call.candidateDirectory, call.recipe.name);
        return {
          code: null, signal: 'SIGKILL', timedOut: true, killUnsettled: true,
        };
      },
    });

    expect(result.index.candidates[0]).toMatchObject({
      candidate: 'gas-showcase', status: 'failed', failure: 'capture-failed',
    });
    expect(await readFile(
      path.join(outputDirectory, 'candidates', 'gas-showcase', 'failure.log'), 'utf8',
    )).toContain('did not settle within 5000 ms after SIGKILL');
  });

  it.skipIf(process.platform !== 'linux')(
    'recovers an exact detached Chrome group from the audit lifecycle handoff',
    async () => {
      const root = await makeTemporaryDirectory();
      const bundle = path.join(root, 'index.html');
      const outputDirectory = path.join(root, 'batch');
      const profile = await mkdtemp(path.join(tmpdir(), 'anifor-visual-lab-chrome-'));
      await writeFile(bundle, '<!doctype html>');
      let chromePid;
      try {
        const result = await runVisualLabBatch({
          candidates: ['gas-showcase'], bundle, outputDir: outputDirectory,
        }, {
          runCandidate: async (call) => {
            const chrome = spawn(process.execPath, [
              '-e', 'setInterval(() => {}, 1000)', '--', `--user-data-dir=${profile}`,
            ], {
              detached: true,
              stdio: 'ignore',
            });
            chromePid = chrome.pid;
            chrome.unref();
            await writeFile(call.lifecyclePath, `${JSON.stringify({
              schema: 'anifor.visual-lab.lifecycle/v1',
              pid: chromePid,
              profile,
              createdAtMs: Date.now(),
              startToken: await linuxProcessStartToken(chromePid),
              owner: call.args.find((argument) => argument.startsWith('--lifecycle-owner='))
                .slice('--lifecycle-owner='.length),
            })}\n`);
            await writeValidCapture(call.candidateDirectory, call.recipe.name);
            return { code: null, signal: 'SIGTERM', timedOut: true };
          },
        });

        expect(result.index.candidates[0]).toMatchObject({
          candidate: 'gas-showcase', status: 'failed', failure: 'capture-failed',
        });
        expect(isDetachedProcessGroupAlive(chromePid)).toBe(false);
        await expect(access(profile)).rejects.toMatchObject({ code: 'ENOENT' });
        await expect(access(path.join(
          outputDirectory, 'candidates', 'gas-showcase', 'chrome-lifecycle.json',
        ))).rejects.toMatchObject({ code: 'ENOENT' });
      } finally {
        if (chromePid && isDetachedProcessGroupAlive(chromePid)) {
          try { process.kill(-chromePid, 'SIGKILL'); } catch { /* already gone */ }
        }
        await rm(profile, { recursive: true, force: true });
      }
    },
    10_000,
  );

  it.skipIf(process.platform !== 'linux')(
    'rejects a lifecycle handoff replayed into another batch root without signaling it',
    async () => {
      const root = await makeTemporaryDirectory();
      const firstOutput = path.join(root, 'first-batch');
      const secondOutput = path.join(root, 'second-batch');
      const secondCandidate = path.join(secondOutput, 'candidates', 'gas-showcase');
      const lifecyclePath = path.join(secondCandidate, 'chrome-lifecycle.json');
      const profile = await mkdtemp(path.join(tmpdir(), 'anifor-visual-lab-chrome-'));
      await mkdir(secondCandidate, { recursive: true });
      const chrome = spawn(process.execPath, [
        '-e', 'setInterval(() => {}, 1000)', '--', `--user-data-dir=${profile}`,
      ], { detached: true, stdio: 'ignore' });
      const chromePid = chrome.pid;
      chrome.unref();
      try {
        await writeFile(lifecyclePath, `${JSON.stringify({
          schema: 'anifor.visual-lab.lifecycle/v1',
          pid: chromePid,
          profile,
          createdAtMs: Date.now(),
          startToken: await linuxProcessStartToken(chromePid),
          owner: lifecycleOwnerForTest(firstOutput, 'gas-showcase'),
        })}\n`);

        await expect(runVisualLabBatch({
          candidates: ['gas-showcase'], outputDir: secondOutput, indexOnly: true,
        })).rejects.toThrow('Invalid Chrome lifecycle record');
        expect(isDetachedProcessGroupAlive(chromePid)).toBe(true);
        await expect(access(lifecyclePath)).resolves.toBeUndefined();
      } finally {
        if (isDetachedProcessGroupAlive(chromePid)) {
          try { process.kill(-chromePid, 'SIGKILL'); } catch { /* already gone */ }
        }
        await rm(profile, { recursive: true, force: true });
      }
    },
    10_000,
  );

  it.skipIf(process.platform !== 'linux')(
    'recovers a prior crashed-run Chrome handoff before cleanup and current capture',
    async () => {
      const root = await makeTemporaryDirectory();
      const bundle = path.join(root, 'index.html');
      const outputDirectory = path.join(root, 'batch');
      const candidateDirectory = path.join(outputDirectory, 'candidates', 'gas-showcase');
      const lifecyclePath = path.join(candidateDirectory, 'chrome-lifecycle.json');
      const failurePath = path.join(candidateDirectory, 'failure.log');
      const profile = await mkdtemp(path.join(tmpdir(), 'anifor-visual-lab-chrome-'));
      await mkdir(candidateDirectory, { recursive: true });
      await writeFile(bundle, '<!doctype html>');
      await writeFile(failurePath, 'capture-failed\nprior diagnostic survives until success\n');
      const chrome = spawn(process.execPath, [
        '-e', 'setInterval(() => {}, 1000)', '--', `--user-data-dir=${profile}`,
      ], { detached: true, stdio: 'ignore' });
      const chromePid = chrome.pid;
      chrome.unref();
      try {
        await writeFile(lifecyclePath, `${JSON.stringify({
          schema: 'anifor.visual-lab.lifecycle/v1',
          pid: chromePid,
          profile,
          createdAtMs: Date.now(),
          startToken: await linuxProcessStartToken(chromePid),
          owner: lifecycleOwnerForTest(outputDirectory, 'gas-showcase'),
        })}\n`);

        const result = await runVisualLabBatch({
          candidates: ['gas-showcase'], bundle, outputDir: outputDirectory,
        }, {
          runCandidate: async (call) => {
            expect(isDetachedProcessGroupAlive(chromePid)).toBe(false);
            await expect(access(lifecyclePath)).rejects.toMatchObject({ code: 'ENOENT' });
            expect(await readFile(failurePath, 'utf8'))
              .toContain('prior diagnostic survives until success');
            await writeValidCapture(call.candidateDirectory, call.recipe.name);
            return { code: 0, signal: null, timedOut: false };
          },
        });

        expect(result.index.candidates[0].status).toBe('passed');
        await expect(access(failurePath)).rejects.toMatchObject({ code: 'ENOENT' });
        await expect(access(profile)).rejects.toMatchObject({ code: 'ENOENT' });
      } finally {
        if (isDetachedProcessGroupAlive(chromePid)) {
          try { process.kill(-chromePid, 'SIGKILL'); } catch { /* already gone */ }
        }
        await rm(profile, { recursive: true, force: true });
      }
    },
    10_000,
  );

  it('serializes batches that share an output directory', async () => {
    const root = await makeTemporaryDirectory();
    const bundle = path.join(root, 'index.html');
    const outputDirectory = path.join(root, 'batch');
    await writeFile(bundle, '<!doctype html>');
    let releaseCandidate;
    let notifyStarted;
    const started = new Promise((resolve) => { notifyStarted = resolve; });
    const gate = new Promise((resolve) => { releaseCandidate = resolve; });
    const first = runVisualLabBatch({
      candidates: ['gas-showcase'], bundle, outputDir: outputDirectory,
    }, {
      runCandidate: async (call) => {
        notifyStarted();
        await gate;
        await writeValidCapture(call.candidateDirectory, call.recipe.name);
        return { code: 0, signal: null, timedOut: false };
      },
    });
    await started;
    try {
      await expect(runVisualLabBatch({
        candidates: ['gas-showcase'], outputDir: outputDirectory, indexOnly: true,
      })).rejects.toThrow('already owned by active process');
    } finally {
      releaseCandidate();
    }
    expect((await first).ok).toBe(true);
    expect((await runVisualLabBatch({
      candidates: ['gas-showcase'], outputDir: outputDirectory, indexOnly: true,
    })).ok).toBe(true);
  });

  it('atomically replaces a dangling failure-log symlink without following it', async () => {
    if (process.platform === 'win32') return;
    const root = await makeTemporaryDirectory();
    const outputDirectory = path.join(root, 'batch');
    const candidateDirectory = path.join(outputDirectory, 'candidates', 'gas-showcase');
    const externalTarget = path.join(root, 'external-diagnostic.txt');
    const failurePath = path.join(candidateDirectory, 'failure.log');
    await mkdir(candidateDirectory, { recursive: true });
    await symlink(externalTarget, failurePath);

    const result = await runVisualLabBatch({
      candidates: ['gas-showcase'], outputDir: outputDirectory, indexOnly: true,
    });

    expect(result.index.candidates[0]).toMatchObject({
      status: 'failed', failure: 'report-missing',
    });
    await expect(access(externalTarget)).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await lstat(failurePath)).isFile()).toBe(true);
    expect(await readFile(failurePath, 'utf8')).toContain('Cannot read gas-showcase report.json');
  });

  it('rejects output, candidate-root, and candidate-directory symlink redirection before cleanup', async () => {
    if (process.platform === 'win32') return;
    const root = await makeTemporaryDirectory();
    const redirectedOutput = path.join(root, 'redirected-output');
    const outputLink = path.join(root, 'output-link');
    const outputSentinel = path.join(redirectedOutput, 'index.json');
    await mkdir(redirectedOutput, { recursive: true });
    await writeFile(outputSentinel, '{"complete":true}\n');
    await symlink(redirectedOutput, outputLink, 'dir');
    await expect(runVisualLabBatch({
      candidates: ['gas-showcase'], outputDir: outputLink, indexOnly: true,
    })).rejects.toThrow('output directory must not be a symbolic link');
    expect(await readFile(outputSentinel, 'utf8')).toBe('{"complete":true}\n');

    const ancestorTarget = path.join(root, 'ancestor-target');
    const ancestorLink = path.join(root, 'ancestor-link');
    const ancestorSentinel = path.join(ancestorTarget, 'batch', 'index.json');
    await mkdir(path.dirname(ancestorSentinel), { recursive: true });
    await writeFile(ancestorSentinel, '{"complete":true}\n');
    await symlink(ancestorTarget, ancestorLink, 'dir');
    await expect(runVisualLabBatch({
      candidates: ['gas-showcase'],
      outputDir: path.join(ancestorLink, 'batch'),
      indexOnly: true,
    })).rejects.toThrow('symbolic-link ancestor');
    expect(await readFile(ancestorSentinel, 'utf8')).toBe('{"complete":true}\n');

    const redirectedRoot = path.join(root, 'redirected-root');
    const rootOutput = path.join(root, 'root-link-batch');
    const priorIndex = path.join(rootOutput, 'index.json');
    await mkdir(redirectedRoot, { recursive: true });
    await mkdir(rootOutput, { recursive: true });
    await writeFile(priorIndex, '{"complete":true}\n');
    await symlink(redirectedRoot, path.join(rootOutput, 'candidates'), 'dir');

    await expect(runVisualLabBatch({
      candidates: ['gas-showcase'], outputDir: rootOutput, indexOnly: true,
    })).rejects.toThrow('candidate root must not be a symbolic link');
    expect(await readFile(priorIndex, 'utf8')).toBe('{"complete":true}\n');

    const redirectedCandidate = path.join(root, 'redirected-candidate');
    const candidateOutput = path.join(root, 'candidate-link-batch');
    const candidateRoot = path.join(candidateOutput, 'candidates');
    const sentinel = path.join(redirectedCandidate, 'report.json');
    await mkdir(redirectedCandidate, { recursive: true });
    await mkdir(candidateRoot, { recursive: true });
    await writeFile(sentinel, 'external sentinel');
    await symlink(redirectedCandidate, path.join(candidateRoot, 'gas-showcase'), 'dir');

    await expect(runVisualLabBatch({
      candidates: ['gas-showcase'], outputDir: candidateOutput, indexOnly: true,
    })).rejects.toThrow('candidate directory gas-showcase must not be a symbolic link');
    expect(await readFile(sentinel, 'utf8')).toBe('external sentinel');
  });
});

describe('Visual Lab batch CLI', () => {
  it('inspects the same complete plan without creating output or running a candidate', async () => {
    const root = await makeTemporaryDirectory();
    const bundle = path.join(root, 'bundle-does-not-exist', 'index.html');
    const outputDirectory = path.join(root, 'plan-must-not-be-created');
    let runnerCalls = 0;
    let publicationCalls = 0;

    const result = await runVisualLabBatch({
      candidates: ['powder-style-atlas', 'gas-showcase'],
      bundle,
      outputDir: outputDirectory,
      gpu: 'swiftshader',
      planOnly: true,
    }, {
      runCandidate: async () => { runnerCalls++; throw new Error('must not run'); },
      publishFile: async () => { publicationCalls++; throw new Error('must not publish'); },
    });

    expect(result).toMatchObject({
      ok: true,
      exitCode: 0,
      planOnly: true,
      plan: {
        schema: 'anifor.visual-capture.execution-plan/v1',
        summary: { selected: 2 },
      },
      runtime: { gpu: 'swiftshader', outputDir: outputDirectory },
    });
    expect(result.plan.entries.map(({ candidate }) => candidate)).toEqual([
      'gas-showcase', 'powder-style-atlas',
    ]);
    expect(runnerCalls).toBe(0);
    expect(publicationCalls).toBe(0);
    await expect(access(outputDirectory)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('emits portable structured plan records before a build exists', async () => {
    const root = await makeTemporaryDirectory();
    const bundle = path.join(root, 'missing-dist', 'index.html');
    const outputDirectory = path.join(root, 'must-not-be-created');
    const script = new URL('./visual-lab-batch.mjs', import.meta.url);
    const planned = spawnSync(process.execPath, [
      script.pathname,
      '--plan-only=1',
      '--candidates=gas-showcase',
      `--bundle=${bundle}`,
      `--output-dir=${outputDirectory}`,
    ], { encoding: 'utf8', timeout: 5_000 });

    expect(planned.status).toBe(0);
    expect(planned.stderr).toBe('');
    expect(JSON.parse(planned.stdout)).toMatchObject({
      tool: 'visual-lab-plan-v1',
      ok: true,
      plan: { summary: { selected: 1 } },
      runtime: { outputDir: outputDirectory },
    });
    await expect(access(outputDirectory)).rejects.toMatchObject({ code: 'ENOENT' });

    const malformed = spawnSync(process.execPath, [
      script.pathname, '--plan-only=yes',
    ], { encoding: 'utf8', timeout: 5_000 });
    expect(malformed.status).toBe(1);
    expect(malformed.stdout).toBe('');
    expect(JSON.parse(malformed.stderr)).toEqual({
      tool: 'visual-lab-plan-v1',
      ok: false,
      error: '--plan-only must be 0 or 1',
    });
    expect(malformed.stderr).not.toContain(process.cwd());
  });

  it('emits bounded structured candidate diagnostics when a CLI batch is incomplete', async () => {
    const root = await makeTemporaryDirectory();
    const outputDirectory = path.join(root, 'incomplete-cli-batch');
    const candidateDirectory = path.join(outputDirectory, 'candidates', 'gas-showcase');
    await mkdir(candidateDirectory, { recursive: true });
    await writeFile(path.join(candidateDirectory, 'stderr.log'), 'private child stderr');
    await writeFile(path.join(candidateDirectory, 'stdout.log'), 'private child stdout');
    const script = new URL('./visual-lab-batch.mjs', import.meta.url);
    const captured = spawnSync(process.execPath, [
      script.pathname,
      '--index-only=1',
      '--candidates=gas-showcase',
      `--output-dir=${outputDirectory}`,
    ], { encoding: 'utf8', timeout: 5_000 });

    expect(captured.status).toBe(1);
    expect(JSON.parse(captured.stdout)).toMatchObject({
      tool: 'visual-lab-batch-v1', ok: false,
      summary: { selected: 1, passed: 0, failed: 1 },
    });
    const diagnostic = JSON.parse(captured.stderr);
    expect(diagnostic).toMatchObject({
      tool: 'visual-lab-batch-diagnostic-v1',
      candidate: 'gas-showcase',
      failure: 'report-missing',
      diagnostic: expect.stringContaining('Cannot read gas-showcase report.json'),
    });
    expect(diagnostic).not.toHaveProperty('childStderr');
    expect(diagnostic).not.toHaveProperty('childStdout');
    expect(captured.stderr).not.toContain('private child stderr');
    expect(captured.stderr).not.toContain('private child stdout');
    expect(captured.stderr.length).toBeLessThan(10_000);
  });

  it('bounds and cycle-guards top-level aggregate diagnostics', () => {
    const cyclic = new AggregateError([], 'cyclic root');
    cyclic.errors.push(cyclic, ...Array.from(
      { length: 12 }, (_, index) => new Error(`nested ${index}`),
    ));
    const formatted = formatVisualLabBatchCliError(new AggregateError([
      cyclic,
      new Error('x'.repeat(12_000)),
    ], 'outer'));

    expect(formatted).toContain('<nested errors omitted: cycle>');
    expect(formatted).toContain('<omitted: 5 nested errors>');
    expect(formatted.length).toBeLessThanOrEqual(8_000);
    expect(formatted).toContain('<omitted: CLI diagnostic exceeds character budget>');
  });

  it('parses selected recipes and environment options without recipe-owned flags', () => {
    expect(parseVisualLabBatchArguments([
      '--candidates=oxygen-showcase, water-motion',
      '--bundle=dist/index.html',
      '--output-dir=/tmp/sheet',
      '--chrome=/usr/bin/chrome',
      '--gpu=swiftshader',
      '--candidate-timeout-ms=123456',
      '--index-only=1',
    ])).toEqual({
      help: false,
      candidates: ['oxygen-showcase', 'water-motion'],
      bundle: 'dist/index.html',
      outputDir: '/tmp/sheet',
      chrome: '/usr/bin/chrome',
      gpu: 'swiftshader',
      browserHost: 'fresh',
      candidateTimeoutMs: 123456,
      indexOnly: true,
      planOnly: false,
    });
    expect(parseVisualLabBatchArguments(['--plan-only=1'])).toMatchObject({
      planOnly: true, indexOnly: false,
    });
    expect(parseVisualLabBatchArguments(['--browser-host=shared']).browserHost)
      .toBe('shared');
    expect(parseVisualLabBatchArguments([
      '--capture-proof=completed-frame-receipt',
    ]).captureProof).toBe('completed-frame-receipt');
    expect(parseVisualLabBatchArguments([
      '--base-url=https://example.test/anifor',
      `--expected-revision=${REMOTE_REVISION}`,
    ]).baseUrl).toBe('https://example.test/anifor/');
    expect(normalizeVisualLabBatchBaseUrl('http://127.0.0.1:4173').href)
      .toBe('http://127.0.0.1:4173/');
    expect(parseVisualLabBatchArguments(['--help'])).toEqual({ help: true });
    expect(parseVisualLabBatchArguments([]).candidateTimeoutMs).toBe(300_000);
  });

  it('rejects malformed, duplicate, or unknown selections before capture', async () => {
    expect(() => parseVisualLabBatchArguments(['--candidates=gas-showcase,']))
      .toThrow('comma-separated list');
    expect(() => parseVisualLabBatchArguments(['--index-only=yes']))
      .toThrow('--index-only must be 0 or 1');
    expect(() => parseVisualLabBatchArguments(['--plan-only=yes']))
      .toThrow('--plan-only must be 0 or 1');
    expect(() => parseVisualLabBatchArguments(['--index-only=1', '--plan-only=1']))
      .toThrow('mutually exclusive');
    expect(() => parseVisualLabBatchArguments(['--browser-host=reuse']))
      .toThrow('--browser-host must be fresh or shared');
    expect(() => parseVisualLabBatchArguments(['--capture-proof=timer-query']))
      .toThrow('--capture-proof must be stable-snapshots or completed-frame-receipt');
    expect(() => parseVisualLabBatchArguments(['--bundle=dist/index.html',
      '--base-url=https://example.test/']))
      .toThrow('--bundle and --base-url are mutually exclusive');
    expect(() => parseVisualLabBatchArguments(['--base-url=https://example.test/']))
      .toThrow('--base-url requires --expected-revision');
    expect(() => parseVisualLabBatchArguments([`--expected-revision=${REMOTE_REVISION}`]))
      .toThrow('--expected-revision requires --base-url');
    expect(() => parseVisualLabBatchArguments([
      '--base-url=https://example.test/', `--expected-revision=${REMOTE_REVISION.toUpperCase()}`,
    ])).toThrow('lowercase 40-hex');
    for (const value of [
      '', ' https://example.test/', 'https://user@example.test/',
      'https://example.test/?query=1', 'https://example.test/#fragment',
      'file:///tmp/anifor/index.html', 'ftp://example.test/', 'https:example.test',
    ]) {
      expect(() => parseVisualLabBatchArguments([
        `--base-url=${value}`, `--expected-revision=${REMOTE_REVISION}`,
      ]))
        .toThrow(/base-url|baseUrl/);
    }
    for (const value of ['0', '-1', '1.5', '2147483648', 'not-a-number']) {
      expect(() => parseVisualLabBatchArguments([`--candidate-timeout-ms=${value}`]))
        .toThrow('--candidate-timeout-ms must be a positive integer');
    }
    expect(() => parseVisualLabBatchArguments(['--domain=gas']))
      .toThrow('Unknown option --domain');
    await expect(runVisualLabBatch({
      candidates: ['gas-showcase', 'gas-showcase'], indexOnly: true,
    })).rejects.toThrow('Duplicate --candidates entry');
    await expect(runVisualLabBatch({
      candidates: ['missing'], indexOnly: true,
    })).rejects.toThrow('Unknown Visual Lab capture candidate');
    await expect(runVisualLabBatch({
      candidates: ['gas-showcase'], candidateTimeoutMs: 0, indexOnly: true,
    })).rejects.toThrow('candidate timeout must be a positive integer');
    await expect(runVisualLabBatch({
      candidates: ['gas-showcase'], captureProof: 'timer-query', indexOnly: true,
    })).rejects.toThrow('captureProof must be stable-snapshots or completed-frame-receipt');
  });
});
