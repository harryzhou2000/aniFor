import { createHash } from 'node:crypto';
import {
  access, mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';

import { VISUAL_LAB_BATCH_SCHEMA } from './visual-lab-batch.mjs';
import {
  compareVisualLabBaseline,
  createVisualLabBaseline,
  normalizeVisualLabBaseline,
  runVisualLabBaseline,
} from './visual-lab-baseline.mjs';
import { resolveVisualLabCaptureRecipe } from './visual-lab-recipes.mjs';
import { createVisualLabResultRecord } from './visual-lab-result.mjs';

const VARIANTS = Object.freeze(['off', 'a', 'b']);
const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => (
    rm(directory, { recursive: true, force: true })
  )));
});

const temporaryDirectory = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'visual-lab-baseline-test-'));
  temporaryDirectories.push(directory);
  return directory;
};

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

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

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

const tinyPng = (seed) => {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const pixel = Buffer.from([0, seed[0], seed[1], seed[2], 0xFF]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(pixel)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
};

const captureBytes = (candidate, salt) => Object.fromEntries(
  VARIANTS.map((variant) => [
    variant,
    tinyPng(createHash('sha256').update(`${candidate}:${salt}:${variant}`).digest()),
  ]),
);

const resultFor = (candidate, salt) => {
  const captures = captureBytes(candidate, salt);
  return {
    captures,
    result: createVisualLabResultRecord(candidate, requestFor(candidate), Object.fromEntries(
      VARIANTS.map((variant) => [variant, digest(captures[variant])]),
    )),
  };
};

const batchFor = (candidate, salt = 'stable') => {
  const { result } = resultFor(candidate, salt);
  return {
    schema: VISUAL_LAB_BATCH_SCHEMA,
    complete: true,
    summary: { selected: 1, passed: 1, failed: 0 },
    candidates: [{
      candidate,
      status: 'passed',
      result,
      artifacts: {
        report: `candidates/${candidate}/report.json`,
        off: `candidates/${candidate}/off.png`,
        a: `candidates/${candidate}/a.png`,
        b: `candidates/${candidate}/b.png`,
      },
      warnings: [],
    }],
  };
};

const baselineWithCandidates = (schema, candidates) => {
  const identity = { schema, candidates };
  return {
    schema,
    id: `sha256:${digest(Buffer.from(JSON.stringify(identity)))}`,
    candidates,
  };
};

const writeBatchPackage = async (root, candidate, salt = 'stable') => {
  const batch = batchFor(candidate, salt);
  const { captures } = resultFor(candidate, salt);
  const candidateRoot = path.join(root, 'candidates', candidate);
  await mkdir(candidateRoot, { recursive: true });
  await writeFile(path.join(root, 'index.json'), `${JSON.stringify(batch)}\n`);
  for (const variant of VARIANTS) {
    await writeFile(path.join(candidateRoot, `${variant}.png`), captures[variant]);
  }
  return batch;
};

const assertPortableRefs = async (root, html) => {
  const references = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  expect(references.length).toBeGreaterThan(0);
  for (const reference of references) {
    expect(reference.startsWith('/')).toBe(false);
    expect(/^[a-z]+:/i.test(reference)).toBe(false);
    const file = path.resolve(root, reference);
    expect(file.startsWith(`${path.resolve(root)}${path.sep}`)).toBe(true);
    await access(file);
  }
};

describe('Visual Lab accepted baseline packages', () => {
  it('makes a deterministic, content-only deeply frozen manifest and rejects bad identities', () => {
    const batch = batchFor('gas-showcase');
    const first = createVisualLabBaseline(batch);
    const second = createVisualLabBaseline(JSON.parse(JSON.stringify(batch)));

    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.candidates)).toBe(true);
    expect(Object.isFrozen(first.candidates[0].result.request)).toBe(true);
    expect(Object.isFrozen(first.candidates[0].result.captureSha256)).toBe(true);

    expect(() => createVisualLabBaseline({ ...batch, complete: false })).toThrow('must be complete');
    expect(() => normalizeVisualLabBaseline({ ...first, id: `sha256:${'0'.repeat(64)}` }))
      .toThrow('does not match its content-addressed identity');

    const water = createVisualLabBaseline(batchFor('water-motion'));
    const reversed = baselineWithCandidates(
      first.schema, [water.candidates[0], first.candidates[0]],
    );
    expect(() => normalizeVisualLabBaseline(reversed)).toThrow('canonical catalog order');

    const staleResult = createVisualLabResultRecord(
      'gas-showcase', { ...requestFor('gas-showcase'), target: 4 },
      first.candidates[0].result.captureSha256,
    );
    const stale = baselineWithCandidates(first.schema, [{
      candidate: 'gas-showcase', result: staleResult,
    }]);
    expect(() => normalizeVisualLabBaseline(stale)).toThrow('does not match its recipe');
  });

  it('reports byte-identical captures and reviewable differences without treating review as failure', () => {
    const accepted = createVisualLabBaseline(batchFor('gas-showcase', 'accepted'));
    const identical = compareVisualLabBaseline(accepted, batchFor('gas-showcase', 'accepted'));
    const reviewed = compareVisualLabBaseline(accepted, batchFor('gas-showcase', 'changed'));

    expect(identical.complete).toBe(true);
    expect(identical.summary).toMatchObject({ identical: 1, review: 0 });
    expect(identical.candidates[0].variants.off.status).toBe('encoded-identical');
    expect(reviewed.complete).toBe(true);
    expect(reviewed.summary).toMatchObject({ identical: 0, review: 1 });
    expect(reviewed.candidates[0].status).toBe('review');
    expect(Object.isFrozen(reviewed.candidates[0].variants)).toBe(true);

    const incompatible = batchFor('gas-showcase', 'changed');
    incompatible.candidates[0].result = createVisualLabResultRecord(
      'gas-showcase', { ...requestFor('gas-showcase'), target: 4 },
      incompatible.candidates[0].result.captureSha256,
    );
    expect(() => compareVisualLabBaseline(accepted, incompatible))
      .toThrow(/request/);
  });

  it('accepts and compares portable filesystem packages with their pinned capture bytes', async () => {
    const root = await temporaryDirectory();
    const batchRoot = path.join(root, 'batch');
    const baselineRoot = path.join(root, 'baseline');
    const currentRoot = path.join(root, 'current');
    const comparisonRoot = path.join(currentRoot, 'comparison');
    await writeBatchPackage(batchRoot, 'gas-showcase', 'accepted');
    await writeBatchPackage(currentRoot, 'gas-showcase', 'changed');

    const accepted = await runVisualLabBaseline({ mode: 'accept', batchRoot, outputDir: baselineRoot });
    expect(accepted.baseline.candidates).toHaveLength(1);
    await expect(readFile(path.join(baselineRoot, 'candidates', 'gas-showcase', 'off.png')))
      .resolves.toEqual(captureBytes('gas-showcase', 'accepted').off);

    const compared = await runVisualLabBaseline({
      mode: 'compare', baselineRoot, resultRoot: currentRoot, outputDir: comparisonRoot,
    });
    expect(compared.comparison.complete).toBe(true);
    expect(compared.comparison.summary).toMatchObject({ compared: 1, review: 1 });
    await assertPortableRefs(comparisonRoot, await readFile(compared.html, 'utf8'));
  });

  it('rejects tampered, missing, and symlink capture files before creating a baseline', async () => {
    const root = await temporaryDirectory();
    const tamperedRoot = path.join(root, 'tampered');
    const missingRoot = path.join(root, 'missing');
    const symlinkRoot = path.join(root, 'symlink');
    const candidate = 'gas-showcase';
    await writeBatchPackage(tamperedRoot, candidate);
    await writeFile(path.join(tamperedRoot, 'candidates', candidate, 'a.png'), 'tampered');
    await expect(runVisualLabBaseline({
      mode: 'accept', batchRoot: tamperedRoot, outputDir: path.join(root, 'tampered-output'),
    })).rejects.toThrow('does not match its pinned SHA-256');

    await writeBatchPackage(missingRoot, candidate);
    await unlink(path.join(missingRoot, 'candidates', candidate, 'b.png'));
    await expect(runVisualLabBaseline({
      mode: 'accept', batchRoot: missingRoot, outputDir: path.join(root, 'missing-output'),
    })).rejects.toThrow();

    await writeBatchPackage(symlinkRoot, candidate);
    const linkedCapture = path.join(symlinkRoot, 'candidates', candidate, 'off.png');
    await unlink(linkedCapture);
    const externalCapture = path.join(root, 'external.png');
    await writeFile(externalCapture, captureBytes(candidate, 'stable').off);
    await symlink(externalCapture, linkedCapture);
    await expect(runVisualLabBaseline({
      mode: 'accept', batchRoot: symlinkRoot, outputDir: path.join(root, 'symlink-output'),
    })).rejects.toThrow('must use only real contained files');
  });
});
