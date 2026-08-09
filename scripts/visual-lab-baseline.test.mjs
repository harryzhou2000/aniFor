import { createHash } from 'node:crypto';
import {
  access, lstat, mkdir, mkdtemp, open, readFile, readdir, rename, rm, symlink, unlink, writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';

import { createVisualLabBatchIndex, VISUAL_LAB_BATCH_SCHEMA } from './visual-lab-batch.mjs';
import {
  compareVisualLabBaseline,
  createVisualLabBaseline,
  normalizeVisualLabBaseline,
  parseVisualLabBaselineArguments,
  promoteVisualLabBaseline,
  normalizeVisualLabReviewBoardQuery,
  renderVisualLabReviewBrief,
  renderVisualLabReviewBoard,
  runVisualLabBaseline,
  serializeVisualLabReviewBoardQuery,
  verifyVisualLabComparisonPackage,
  visualLabReviewBoardCandidateMatches,
} from './visual-lab-baseline.mjs';
import { resolveVisualLabCaptureRecipe } from './visual-lab-recipes.mjs';
import { VISUAL_LAB_COMPARISON_METRICS_SCHEMA } from './visual-lab-comparison-metrics.mjs';
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

const snapshotPackageTree = async (root) => {
  const snapshot = {};
  const visit = async (absolute, relative) => {
    const details = await lstat(absolute, { bigint: true });
    const shared = {
      kind: details.isDirectory() ? 'directory' : details.isFile() ? 'file' : 'other',
      dev: details.dev,
      ino: details.ino,
      mode: details.mode,
      size: details.size,
      mtimeNs: details.mtimeNs,
      ctimeNs: details.ctimeNs,
    };
    if (details.isFile()) {
      snapshot[relative] = { ...shared, sha256: digest(await readFile(absolute)) };
      return;
    }
    snapshot[relative] = shared;
    if (!details.isDirectory()) return;
    const entries = await readdir(absolute);
    entries.sort();
    for (const entry of entries) {
      await visit(path.join(absolute, entry), relative ? `${relative}/${entry}` : entry);
    }
  };
  await visit(root, '');
  return snapshot;
};

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

const batchForCandidates = (entries) => createVisualLabBatchIndex(entries.map(({ candidate, salt }) => ({
  candidate,
  status: 'passed',
  result: resultFor(candidate, salt).result,
  warnings: [],
})));

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

const writeBatchPackageForCandidates = async (root, entries) => {
  const batch = batchForCandidates(entries);
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, 'index.json'), `${JSON.stringify(batch)}\n`);
  for (const { candidate, salt } of entries) {
    const candidateRoot = path.join(root, 'candidates', candidate);
    await mkdir(candidateRoot, { recursive: true });
    const { captures } = resultFor(candidate, salt);
    await Promise.all(VARIANTS.map((variant) => (
      writeFile(path.join(candidateRoot, `${variant}.png`), captures[variant])
    )));
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
    expect(compared.metrics).toMatchObject({
      schema: 'anifor.visual-lab.comparison-metrics/v1',
      comparison: {
        schema: compared.comparison.schema,
        id: compared.comparison.id,
      },
      candidates: [{ candidate: 'gas-showcase', status: 'review' }],
    });
    expect(compared.metrics.candidates[0].variants.a.metric).toMatchObject({
      kind: 'rgba-delta',
      comparedPixels: 1,
    });
    expect(Object.isFrozen(compared.metrics)).toBe(true);
    await assertPortableRefs(comparisonRoot, await readFile(compared.html, 'utf8'));

    const beforeTrees = await Promise.all([
      snapshotPackageTree(baselineRoot),
      snapshotPackageTree(currentRoot),
      snapshotPackageTree(comparisonRoot),
    ]);
    const beforeJson = await readFile(compared.json);
    const beforeHtml = await readFile(compared.html);
    const verified = await verifyVisualLabComparisonPackage({
      baselineRoot, resultRoot: currentRoot, comparisonRoot,
    });
    expect(verified.baseline.id).toBe(accepted.baseline.id);
    expect(verified.comparison).toStrictEqual(compared.comparison);
    expect(verified.currentCandidates.map(({ candidate }) => candidate))
      .toEqual(['gas-showcase']);
    expect(await readFile(compared.json)).toStrictEqual(beforeJson);
    expect(await readFile(compared.html)).toStrictEqual(beforeHtml);
    expect(await Promise.all([
      snapshotPackageTree(baselineRoot),
      snapshotPackageTree(currentRoot),
      snapshotPackageTree(comparisonRoot),
    ])).toStrictEqual(beforeTrees);

    await writeFile(compared.html, `${beforeHtml.toString('utf8')}\n<!-- tampered -->\n`);
    await expect(verifyVisualLabComparisonPackage({
      baselineRoot, resultRoot: currentRoot, comparisonRoot,
    })).rejects.toThrow('comparison sheet');
    await writeFile(compared.html, beforeHtml);
    await expect(verifyVisualLabComparisonPackage({
      baselineRoot,
      resultRoot: `${currentRoot}/../current`,
      comparisonRoot,
    })).rejects.toThrow('canonical without dot segments');
  });

  it('renders a deterministic portable review brief that queues decisions ahead of identical captures', async () => {
    const accepted = createVisualLabBaseline(batchForCandidates([
      { candidate: 'gas-showcase', salt: 'accepted' },
      { candidate: 'oil-motion', salt: 'accepted' },
      { candidate: 'water-motion', salt: 'accepted' },
    ]));
    const current = batchForCandidates([
      { candidate: 'gas-showcase', salt: 'accepted' },
      { candidate: 'oxygen-showcase', salt: 'added' },
      { candidate: 'oil-motion', salt: 'changed' },
    ]);
    const comparison = compareVisualLabBaseline(accepted, current);
    const first = renderVisualLabReviewBrief(comparison);
    const second = renderVisualLabReviewBrief(JSON.parse(JSON.stringify(comparison)));

    expect(first).toBe(second);
    expect(first).toContain('Visual review brief');
    expect(first).toContain('status-review');
    expect(first).toContain('status-added');
    expect(first).toContain('status-not-sampled');
    expect(first).toContain('Encoded-identical · no action');
    const main = first.slice(first.indexOf('<main>'), first.indexOf('</main>'));
    const unchanged = first.slice(first.indexOf('<aside>'), first.indexOf('</aside>'));
    expect(main).toContain('oxygen-showcase');
    expect(main).toContain('oil-motion');
    expect(main).toContain('water-motion');
    expect(main).not.toContain('gas-showcase');
    expect(unchanged).toContain('gas-showcase');

    const hostile = JSON.parse(JSON.stringify(comparison));
    const hostileEntry = hostile.candidates.find(({ candidate }) => candidate === 'oil-motion');
    hostileEntry.status = 'review"><script>unsafe()</script>';
    hostileEntry.currentResult.request.gain = '"><img src=x onerror=unsafe()>';
    hostileEntry.artifacts.current.off = 'capture.png" onerror="unsafe()';
    hostileEntry.variants.off.status = 'review<script>unsafe()</script>';
    const escaped = renderVisualLabReviewBrief(hostile);
    expect(escaped).not.toContain('<script>unsafe()</script>');
    expect(escaped).not.toContain('src="./capture.png" onerror="unsafe()"');
    expect(escaped).toContain('&lt;script&gt;unsafe()&lt;/script&gt;');

    const root = await temporaryDirectory();
    const batchRoot = path.join(root, 'batch');
    const baselineRoot = path.join(root, 'baseline');
    const currentRoot = path.join(root, 'current');
    const comparisonRoot = path.join(root, 'comparison');
    await writeBatchPackage(batchRoot, 'gas-showcase', 'accepted');
    await writeBatchPackage(currentRoot, 'gas-showcase', 'accepted');
    await runVisualLabBaseline({ mode: 'accept', batchRoot, outputDir: baselineRoot });
    const output = await runVisualLabBaseline({
      mode: 'compare', baselineRoot, resultRoot: currentRoot, outputDir: comparisonRoot,
    });
    const storedComparison = JSON.parse(await readFile(output.json, 'utf8'));
    const storedBrief = await readFile(output.brief, 'utf8');
    const storedBoard = await readFile(output.board, 'utf8');
    expect(storedComparison).toEqual(output.comparison);
    expect(storedComparison.id).toBe(compareVisualLabBaseline(
      createVisualLabBaseline(batchFor('gas-showcase', 'accepted')),
      batchFor('gas-showcase', 'accepted'),
    ).id);
    expect(storedBrief).toBe(renderVisualLabReviewBrief(output.comparison, output.metrics));
    expect(storedBoard).toBe(renderVisualLabReviewBoard(output.comparison, output.metrics));
    expect(JSON.parse(await readFile(output.metricsPath, 'utf8'))).toEqual(output.metrics);
    expect(storedBrief).toContain('measurements do not pass or fail aesthetics');
    await assertPortableRefs(comparisonRoot, storedBrief);
    await assertPortableRefs(comparisonRoot, storedBoard);
  });

  it('renders a deterministic escaped decision-only review board with local filter data', () => {
    const accepted = createVisualLabBaseline(batchForCandidates([
      { candidate: 'gas-showcase', salt: 'accepted' },
      { candidate: 'oil-motion', salt: 'accepted' },
      { candidate: 'water-motion', salt: 'accepted' },
    ]));
    const current = batchForCandidates([
      { candidate: 'gas-showcase', salt: 'accepted' },
      { candidate: 'oxygen-showcase', salt: 'added' },
      { candidate: 'oil-motion', salt: 'changed' },
    ]);
    const comparison = compareVisualLabBaseline(accepted, current);
    const metrics = {
      schema: VISUAL_LAB_COMPARISON_METRICS_SCHEMA,
      comparison: { schema: comparison.schema, id: comparison.id },
      candidates: comparison.candidates.map(({ candidate, status }) => ({
        candidate, status, variants: {},
      })),
    };
    const first = renderVisualLabReviewBoard(comparison, metrics);
    const second = renderVisualLabReviewBoard(JSON.parse(JSON.stringify(comparison)), metrics);

    expect(first).toBe(second);
    expect(first).toContain('Visual review board');
    expect(first).toContain('name="status"');
    expect(first).toContain('name="domain"');
    expect(first).toContain('name="fixture"');
    expect(first).toContain('name="q"');
    expect(first).toContain('apply(true);');
    expect(first).not.toContain('apply(false);');
    expect(first).toContain('>Clear filters</button>');
    const decisions = comparison.candidates.filter(({ status }) => status !== 'encoded-identical');
    expect(decisions.map(({ candidate }) => candidate)).toEqual([
      'oil-motion', 'water-motion', 'oxygen-showcase',
    ]);
    for (const entry of decisions) {
      const request = entry.currentResult?.request ?? entry.baselineResult?.request;
      expect(first).toContain(`data-status="${entry.status}"`);
      expect(first).toContain(`data-domain="${request.domain}"`);
      expect(first).toContain(`data-fixture="${request.fixture}"`);
      expect(first).toContain(`data-candidate="${entry.candidate}"`);
      for (const variant of VARIANTS) {
        if (entry.artifacts.current?.[variant]) {
          expect(first).toContain(`src="./${entry.artifacts.current[variant]}"`);
          expect(first).toContain(`href="./${entry.artifacts.current[variant]}"`);
        }
        if (entry.artifacts.baseline?.[variant]) {
          expect(first).toContain(`src="./${entry.artifacts.baseline[variant]}"`);
          expect(first).toContain(`href="./${entry.artifacts.baseline[variant]}"`);
        }
      }
    }
    expect(first).not.toContain('data-candidate="gas-showcase"');
    expect(first).not.toContain('data-score');
    expect(first).not.toContain('data-rank');
    expect(first).not.toMatch(/<form[^>]+action=|data-write|data-promote/i);

    const hostile = JSON.parse(JSON.stringify(comparison));
    const hostileEntry = hostile.candidates.find(({ candidate }) => candidate === 'oil-motion');
    hostileEntry.status = 'review\"><script>unsafe()</script>';
    hostileEntry.currentResult.request.domain = 'liquid\" onmouseover="unsafe()';
    hostileEntry.currentResult.request.fixture = '<img src=x onerror=unsafe()>';
    hostileEntry.candidate = 'oil\"><a href="javascript:unsafe()">';
    const escaped = renderVisualLabReviewBoard(hostile, {
      ...metrics,
      comparison: { schema: hostile.schema, id: hostile.id },
      candidates: hostile.candidates.map(({ candidate, status }) => ({
        candidate, status, variants: {},
      })),
    });
    expect(escaped).not.toContain('<script>unsafe()</script>');
    expect(escaped).not.toContain('href="javascript:unsafe()"');
    expect(escaped).toContain('&lt;script&gt;unsafe()&lt;/script&gt;');
  });

  it('normalizes, serializes, and conjunctively matches stable review-board filters', () => {
    const accepted = createVisualLabBaseline(batchForCandidates([
      { candidate: 'gas-showcase', salt: 'accepted' },
      { candidate: 'oil-motion', salt: 'accepted' },
      { candidate: 'water-motion', salt: 'accepted' },
    ]));
    const current = batchForCandidates([
      { candidate: 'gas-showcase', salt: 'accepted' },
      { candidate: 'oxygen-showcase', salt: 'added' },
      { candidate: 'oil-motion', salt: 'changed' },
    ]);
    const comparison = compareVisualLabBaseline(accepted, current);
    const oil = comparison.candidates.find(({ candidate }) => candidate === 'oil-motion');
    const oilRequest = oil.currentResult.request;
    const query = new URLSearchParams({
      status: 'review', domain: oilRequest.domain, fixture: oilRequest.fixture, q: 'OIL',
    }).toString();
    const choices = {
      status: ['review', 'added', 'not-sampled'],
      domain: comparison.candidates.map(({ currentResult, baselineResult }) => (
        (currentResult ?? baselineResult).request.domain
      )),
      fixture: comparison.candidates.map(({ currentResult, baselineResult }) => (
        (currentResult ?? baselineResult).request.fixture
      )),
    };
    const normalized = normalizeVisualLabReviewBoardQuery(query, choices);
    expect(normalized).toEqual({
      status: 'review', domain: oilRequest.domain, fixture: oilRequest.fixture, q: 'oil',
    });
    expect(serializeVisualLabReviewBoardQuery(normalized)).toBe(
      `status=review&domain=${encodeURIComponent(oilRequest.domain)}&fixture=${encodeURIComponent(oilRequest.fixture)}&q=oil`,
    );
    expect(normalizeVisualLabReviewBoardQuery(
      `status=review&status=added&domain=unknown&fixture=missing&q=${'X'.repeat(65)}`,
      choices,
    )).toEqual({
      status: '', domain: '', fixture: '', q: 'x'.repeat(64),
    });

    const decisions = comparison.candidates.filter(({ status }) => status !== 'encoded-identical');
    const boardCandidate = (entry) => {
      const request = entry.currentResult?.request ?? entry.baselineResult?.request;
      return {
        candidate: entry.candidate,
        status: entry.status,
        domain: request.domain,
        fixture: request.fixture,
      };
    };
    expect(decisions.filter((entry) => visualLabReviewBoardCandidateMatches(boardCandidate(entry), normalized))
      .map(({ candidate }) => candidate)).toEqual(['oil-motion']);
    const reviewOnly = normalizeVisualLabReviewBoardQuery('status=review', choices);
    expect(decisions.filter((entry) => visualLabReviewBoardCandidateMatches(boardCandidate(entry), reviewOnly))
      .map(({ candidate }) => candidate)).toEqual(['oil-motion']);
    expect(decisions.map(({ candidate }) => candidate)).toEqual([
      'oil-motion', 'water-motion', 'oxygen-showcase',
    ]);
  });

  it('verifies additive review evidence while accepting legacy package omissions', async () => {
    const root = await temporaryDirectory();
    const batchRoot = path.join(root, 'batch');
    const baselineRoot = path.join(root, 'baseline');
    const currentRoot = path.join(root, 'current');
    const comparisonRoot = path.join(root, 'comparison');
    await writeBatchPackage(batchRoot, 'gas-showcase', 'accepted');
    await writeBatchPackage(currentRoot, 'gas-showcase', 'changed');
    await runVisualLabBaseline({ mode: 'accept', batchRoot, outputDir: baselineRoot });
    const output = await runVisualLabBaseline({
      mode: 'compare', baselineRoot, resultRoot: currentRoot, outputDir: comparisonRoot,
    });
    const originalBrief = await readFile(output.brief);
    const originalMetrics = await readFile(output.metricsPath);
    const originalBoard = await readFile(output.board);

    await writeFile(output.board, `${originalBoard.toString('utf8')}\n<!-- tampered -->\n`);
    await expect(verifyVisualLabComparisonPackage({
      baselineRoot, resultRoot: currentRoot, comparisonRoot,
    })).rejects.toThrow('comparison review board');
    await writeFile(output.board, originalBoard);

    await writeFile(output.board, Buffer.alloc(1024 * 1024 + 1, 0x20));
    await expect(verifyVisualLabComparisonPackage({
      baselineRoot, resultRoot: currentRoot, comparisonRoot,
    })).rejects.toThrow('bounded file budget');
    await writeFile(output.board, originalBoard);

    const externalBoard = path.join(root, 'external-review-board.html');
    await writeFile(externalBoard, originalBoard);
    await unlink(output.board);
    await symlink(externalBoard, output.board);
    await expect(verifyVisualLabComparisonPackage({
      baselineRoot, resultRoot: currentRoot, comparisonRoot,
    })).rejects.toThrow('must use only real contained files');
    await unlink(output.board);
    await writeFile(output.board, originalBoard);

    await writeFile(output.brief, `${originalBrief.toString('utf8')}\n<!-- tampered -->\n`);
    await expect(verifyVisualLabComparisonPackage({
      baselineRoot, resultRoot: currentRoot, comparisonRoot,
    })).rejects.toThrow('comparison review brief');
    await writeFile(output.brief, originalBrief);

    const externalBrief = path.join(root, 'external-review-brief.html');
    await writeFile(externalBrief, originalBrief);
    await unlink(output.brief);
    await symlink(externalBrief, output.brief);
    await expect(verifyVisualLabComparisonPackage({
      baselineRoot, resultRoot: currentRoot, comparisonRoot,
    })).rejects.toThrow('must use only real contained files');
    await unlink(output.brief);

    await expect(verifyVisualLabComparisonPackage({
      baselineRoot, resultRoot: currentRoot, comparisonRoot,
    })).rejects.toThrow('metrics require a matching review brief');

    await writeFile(output.brief, originalBrief);
    const tamperedMetrics = JSON.parse(originalMetrics.toString('utf8'));
    tamperedMetrics.comparison.id = `sha256:${'f'.repeat(64)}`;
    await writeFile(output.metricsPath, `${JSON.stringify(tamperedMetrics, null, 2)}\n`);
    await expect(verifyVisualLabComparisonPackage({
      baselineRoot, resultRoot: currentRoot, comparisonRoot,
    })).rejects.toThrow('comparison metrics');
    await writeFile(output.metricsPath, originalMetrics);

    await writeFile(output.metricsPath, Buffer.alloc(1024 * 1024 + 1, 0x20));
    await expect(verifyVisualLabComparisonPackage({
      baselineRoot, resultRoot: currentRoot, comparisonRoot,
    })).rejects.toThrow('bounded file budget');
    await writeFile(output.metricsPath, originalMetrics);

    const externalMetrics = path.join(root, 'external-metrics.json');
    await writeFile(externalMetrics, originalMetrics);
    await unlink(output.metricsPath);
    await symlink(externalMetrics, output.metricsPath);
    await expect(verifyVisualLabComparisonPackage({
      baselineRoot, resultRoot: currentRoot, comparisonRoot,
    })).rejects.toThrow('must use only real contained files');
    await unlink(output.metricsPath);

    await expect(verifyVisualLabComparisonPackage({
      baselineRoot, resultRoot: currentRoot, comparisonRoot,
    })).rejects.toThrow('comparison review brief');

    await writeFile(output.brief, renderVisualLabReviewBrief(output.comparison));
    await expect(verifyVisualLabComparisonPackage({
      baselineRoot, resultRoot: currentRoot, comparisonRoot,
    })).rejects.toThrow('comparison review board requires verified comparison metrics');

    await unlink(output.board);
    await expect(verifyVisualLabComparisonPackage({
      baselineRoot, resultRoot: currentRoot, comparisonRoot,
    })).resolves.toMatchObject({ comparison: output.comparison });

    await unlink(output.brief);

    await expect(verifyVisualLabComparisonPackage({
      baselineRoot, resultRoot: currentRoot, comparisonRoot,
    })).resolves.toMatchObject({ comparison: output.comparison });
  });

  it('rejects symlinked and replaced portable comparison verification inputs', async () => {
    const root = await temporaryDirectory();
    const batchRoot = path.join(root, 'batch');
    const baselineRoot = path.join(root, 'baseline');
    const currentRoot = path.join(root, 'current');
    const comparisonRoot = path.join(root, 'comparison');
    await writeBatchPackage(batchRoot, 'gas-showcase', 'accepted');
    await writeBatchPackage(currentRoot, 'gas-showcase', 'changed');
    await runVisualLabBaseline({ mode: 'accept', batchRoot, outputDir: baselineRoot });
    await runVisualLabBaseline({
      mode: 'compare', baselineRoot, resultRoot: currentRoot, outputDir: comparisonRoot,
    });

    const comparisonIndex = path.join(comparisonRoot, 'comparison.json');
    const originalComparisonIndex = await readFile(comparisonIndex);
    const externalComparisonIndex = path.join(root, 'external-comparison.json');
    await writeFile(externalComparisonIndex, originalComparisonIndex);
    await unlink(comparisonIndex);
    await symlink(externalComparisonIndex, comparisonIndex);
    await expect(verifyVisualLabComparisonPackage({
      baselineRoot, resultRoot: currentRoot, comparisonRoot,
    })).rejects.toThrow('must use only real contained files');
    await unlink(comparisonIndex);
    await writeFile(comparisonIndex, originalComparisonIndex);

    // Interpose exactly after the verifier's fstat and before its read. The
    // descriptor still points at the old index while the pathname is replaced,
    // so only the final identity check can reject this TOCTOU race.
    const baselineIndex = path.join(baselineRoot, 'index.json');
    const replacementIndex = path.join(root, 'replacement-baseline-index.json');
    await writeFile(replacementIndex, await readFile(baselineIndex));
    const originalDetails = await lstat(baselineIndex, { bigint: true });
    const probe = await open(baselineIndex, 'r');
    const fileHandlePrototype = Object.getPrototypeOf(probe);
    await probe.close();
    const originalReadFile = fileHandlePrototype.readFile;
    let replaced = false;
    fileHandlePrototype.readFile = async function replaceVerifiedPath(...args) {
      const details = await this.stat({ bigint: true });
      if (!replaced && details.dev === originalDetails.dev && details.ino === originalDetails.ino) {
        replaced = true;
        await rename(replacementIndex, baselineIndex);
      }
      return originalReadFile.apply(this, args);
    };
    try {
      await expect(verifyVisualLabComparisonPackage({
        baselineRoot, resultRoot: currentRoot, comparisonRoot,
      })).rejects.toThrow('changed while reading');
      expect(replaced).toBe(true);
    } finally {
      fileHandlePrototype.readFile = originalReadFile;
    }
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

  it('promotes only selected review records in canonical order and permits no-op promotion', () => {
    const acceptedBatch = batchForCandidates([
      { candidate: 'gas-showcase', salt: 'accepted' },
      { candidate: 'oil-motion', salt: 'accepted' },
      { candidate: 'water-motion', salt: 'accepted' },
    ]);
    const accepted = createVisualLabBaseline(acceptedBatch);
    const current = batchForCandidates([
      { candidate: 'gas-showcase', salt: 'accepted' },
      { candidate: 'oil-motion', salt: 'revised-oil' },
      { candidate: 'water-motion', salt: 'revised-water' },
    ]);
    const comparison = compareVisualLabBaseline(accepted, current);
    const promoted = promoteVisualLabBaseline(
      accepted, current, comparison, ['water-motion', 'oil-motion'],
    );

    expect(promoted.baseline.candidates.map(({ candidate }) => candidate)).toEqual([
      'gas-showcase', 'oil-motion', 'water-motion',
    ]);
    expect(promoted.baseline.candidates[0].result).toEqual(accepted.candidates[0].result);
    expect(promoted.baseline.candidates[1].result).toEqual(current.candidates[1].result);
    expect(promoted.baseline.candidates[2].result).toEqual(current.candidates[2].result);
    expect(promoted.promotion).toMatchObject({
      schema: 'anifor.visual-lab.baseline-promotion/v1',
      baseline: { schema: accepted.schema, id: accepted.id },
      comparison: { schema: comparison.schema, id: comparison.id },
      result: { schema: accepted.schema, id: promoted.baseline.id },
      promoted: [
        {
          candidate: 'oil-motion',
          comparisonStatus: 'review',
          previousResultId: accepted.candidates[1].result.id,
          currentResultId: current.candidates[1].result.id,
        },
        {
          candidate: 'water-motion',
          comparisonStatus: 'review',
          previousResultId: accepted.candidates[2].result.id,
          currentResultId: current.candidates[2].result.id,
        },
      ],
    });
    expect(Object.isFrozen(promoted.baseline)).toBe(true);
    expect(Object.isFrozen(promoted.promotion)).toBe(true);
    const { id: promotionId, ...promotionIdentity } = promoted.promotion;
    expect(promotionId).toBe(`sha256:${digest(Buffer.from(JSON.stringify(promotionIdentity)))}`);

    const partialAccepted = createVisualLabBaseline(batchForCandidates([
      { candidate: 'water-motion', salt: 'accepted' },
    ]));
    const addedCurrent = batchForCandidates([
      { candidate: 'gas-showcase', salt: 'added-gas' },
      { candidate: 'water-motion', salt: 'accepted' },
    ]);
    const addedComparison = compareVisualLabBaseline(partialAccepted, addedCurrent);
    const added = promoteVisualLabBaseline(
      partialAccepted,
      addedCurrent,
      addedComparison,
      ['gas-showcase'],
    );
    expect(added.baseline.candidates.map(({ candidate }) => candidate)).toEqual([
      'gas-showcase', 'water-motion',
    ]);
    expect(added.promotion.promoted).toEqual([{
      candidate: 'gas-showcase',
      comparisonStatus: 'added',
      previousResultId: null,
      currentResultId: addedCurrent.candidates[0].result.id,
    }]);

    const unchanged = promoteVisualLabBaseline(
      accepted,
      acceptedBatch,
      compareVisualLabBaseline(accepted, acceptedBatch),
      ['gas-showcase'],
    );
    expect(unchanged.baseline.id).toBe(accepted.id);
    expect(unchanged.promotion.promoted).toEqual([{
      candidate: 'gas-showcase',
      comparisonStatus: 'encoded-identical',
      previousResultId: accepted.candidates[0].result.id,
      currentResultId: accepted.candidates[0].result.id,
    }]);
  });

  it('rejects stale, incompatible, unknown, duplicate, and unsampled promotion selections', () => {
    const accepted = createVisualLabBaseline(batchForCandidates([
      { candidate: 'gas-showcase', salt: 'accepted' },
      { candidate: 'water-motion', salt: 'accepted' },
    ]));
    const current = batchForCandidates([
      { candidate: 'gas-showcase', salt: 'accepted' },
      { candidate: 'water-motion', salt: 'changed' },
    ]);
    const comparison = compareVisualLabBaseline(accepted, current);

    expect(() => promoteVisualLabBaseline(accepted, current, comparison, ['unknown']))
      .toThrow();
    expect(() => promoteVisualLabBaseline(accepted, current, comparison, [
      'water-motion', 'water-motion',
    ])).toThrow();
    expect(() => promoteVisualLabBaseline(accepted, current, { ...comparison, id: `sha256:${'0'.repeat(64)}` }, [
      'water-motion',
    ])).toThrow();
    const laterCurrent = batchForCandidates([
      { candidate: 'gas-showcase', salt: 'accepted' },
      { candidate: 'water-motion', salt: 'later-change' },
    ]);
    expect(() => promoteVisualLabBaseline(accepted, laterCurrent, comparison, ['water-motion']))
      .toThrow();
    const incompleteSelection = batchForCandidates([{ candidate: 'gas-showcase', salt: 'accepted' }]);
    expect(() => promoteVisualLabBaseline(
      accepted,
      incompleteSelection,
      compareVisualLabBaseline(accepted, incompleteSelection),
      ['water-motion'],
    )).toThrow();
    const incompatible = JSON.parse(JSON.stringify(current));
    incompatible.candidates[1].result = createVisualLabResultRecord(
      'water-motion', { ...requestFor('water-motion'), target: 8 },
      incompatible.candidates[1].result.captureSha256,
    );
    expect(() => promoteVisualLabBaseline(accepted, incompatible, comparison, ['water-motion']))
      .toThrow();

    expect(parseVisualLabBaselineArguments([
      'promote',
      '--baseline-root=accepted',
      '--result-root=current',
      '--comparison-root=comparison',
      '--candidates=water-motion,gas-showcase',
      '--output-dir=next',
    ])).toMatchObject({
      mode: 'promote',
      baselineRoot: 'accepted',
      resultRoot: 'current',
      comparisonRoot: 'comparison',
      candidates: ['water-motion', 'gas-showcase'],
      outputDir: 'next',
    });
  });

  it('promotes verified comparison packages without overlapping inputs or following symlinks', async () => {
    const root = await temporaryDirectory();
    const batchRoot = path.join(root, 'accepted-batch');
    const baselineRoot = path.join(root, 'accepted');
    const currentRoot = path.join(root, 'current');
    const comparisonRoot = path.join(currentRoot, 'comparison');
    const promotionRoot = path.join(root, 'promotion');
    const acceptedEntries = [
      { candidate: 'gas-showcase', salt: 'accepted' },
      { candidate: 'water-motion', salt: 'accepted' },
    ];
    const currentEntries = [
      { candidate: 'gas-showcase', salt: 'accepted' },
      { candidate: 'water-motion', salt: 'changed' },
    ];
    await writeBatchPackageForCandidates(batchRoot, acceptedEntries);
    await writeBatchPackageForCandidates(currentRoot, currentEntries);
    await runVisualLabBaseline({ mode: 'accept', batchRoot, outputDir: baselineRoot });
    const compared = await runVisualLabBaseline({
      mode: 'compare', baselineRoot, resultRoot: currentRoot, outputDir: comparisonRoot,
    });

    const promoted = await runVisualLabBaseline({
      mode: 'promote',
      baselineRoot,
      resultRoot: currentRoot,
      comparisonRoot,
      candidates: ['water-motion'],
      outputDir: promotionRoot,
    });
    expect(promoted.baseline.id).toBe(promoted.promotion.result.id);
    await expect(readFile(path.join(promotionRoot, 'candidates', 'gas-showcase', 'off.png')))
      .resolves.toEqual(captureBytes('gas-showcase', 'accepted').off);
    await expect(readFile(path.join(promotionRoot, 'candidates', 'water-motion', 'off.png')))
      .resolves.toEqual(captureBytes('water-motion', 'changed').off);
    expect(JSON.parse(await readFile(path.join(promotionRoot, 'promotion.json'), 'utf8')))
      .toEqual(promoted.promotion);
    expect(JSON.parse(await readFile(path.join(promotionRoot, 'index.json'), 'utf8')))
      .toEqual(promoted.baseline);

    const concurrentRoot = path.join(root, 'concurrent-promotion');
    const concurrentOptions = {
      mode: 'promote', baselineRoot, resultRoot: currentRoot, comparisonRoot,
      candidates: ['water-motion'], outputDir: concurrentRoot,
    };
    const concurrent = await Promise.allSettled([
      runVisualLabBaseline(concurrentOptions),
      runVisualLabBaseline(concurrentOptions),
    ]);
    const fulfilled = concurrent.filter(({ status }) => status === 'fulfilled');
    const rejected = concurrent.filter(({ status }) => status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const winner = fulfilled[0].value;
    expect(JSON.parse(await readFile(path.join(concurrentRoot, 'index.json'), 'utf8')))
      .toEqual(winner.baseline);
    expect(JSON.parse(await readFile(path.join(concurrentRoot, 'promotion.json'), 'utf8')))
      .toEqual(winner.promotion);
    for (const { candidate, result } of winner.baseline.candidates) {
      expect(digest(await readFile(path.join(concurrentRoot, 'candidates', candidate, 'off.png'))))
        .toBe(result.captureSha256.off);
    }
    await expect(access(path.join(concurrentRoot, '.visual-lab-promotion.lock'))).rejects.toThrow();

    const oneCandidateRoot = path.join(root, 'one-current-candidate');
    const oneCandidateComparisonRoot = path.join(oneCandidateRoot, 'comparison');
    const oneCandidatePromotionRoot = path.join(root, 'one-current-promotion');
    await writeBatchPackageForCandidates(oneCandidateRoot, [acceptedEntries[0]]);
    await runVisualLabBaseline({
      mode: 'compare', baselineRoot, resultRoot: oneCandidateRoot,
      outputDir: oneCandidateComparisonRoot,
    });
    await runVisualLabBaseline({
      mode: 'promote', baselineRoot, resultRoot: oneCandidateRoot,
      comparisonRoot: oneCandidateComparisonRoot,
      candidates: ['gas-showcase'], outputDir: oneCandidatePromotionRoot,
    });
    await expect(readFile(
      path.join(oneCandidatePromotionRoot, 'candidates', 'water-motion', 'off.png'),
    )).resolves.toEqual(captureBytes('water-motion', 'accepted').off);

    const originalHtml = await readFile(compared.html, 'utf8');
    await writeFile(compared.html, `${originalHtml}\n<!-- tampered -->\n`);
    await expect(runVisualLabBaseline({
      mode: 'promote', baselineRoot, resultRoot: currentRoot, comparisonRoot,
      candidates: ['water-motion'], outputDir: path.join(root, 'html-tampered-promotion'),
    })).rejects.toThrow();
    await writeFile(compared.html, originalHtml);
    const comparisonPng = path.join(
      comparisonRoot, 'current', 'candidates', 'water-motion', 'off.png',
    );
    await writeFile(comparisonPng, captureBytes('water-motion', 'tampered').off);
    await expect(runVisualLabBaseline({
      mode: 'promote', baselineRoot, resultRoot: currentRoot, comparisonRoot,
      candidates: ['water-motion'], outputDir: path.join(root, 'png-tampered-promotion'),
    })).rejects.toThrow();
    await writeFile(comparisonPng, captureBytes('water-motion', 'changed').off);

    const originalComparisonJson = await readFile(compared.json, 'utf8');
    const tamperedComparison = JSON.parse(originalComparisonJson);
    tamperedComparison.id = `sha256:${'0'.repeat(64)}`;
    await writeFile(compared.json, `${JSON.stringify(tamperedComparison)}\n`);
    await expect(runVisualLabBaseline({
      mode: 'promote', baselineRoot, resultRoot: currentRoot, comparisonRoot,
      candidates: ['water-motion'], outputDir: path.join(root, 'tampered-promotion'),
    })).rejects.toThrow();
    await writeFile(compared.json, originalComparisonJson);
    await expect(runVisualLabBaseline({
      mode: 'promote', baselineRoot, resultRoot: currentRoot, comparisonRoot,
      candidates: ['water-motion'], outputDir: path.join(baselineRoot, 'overlap'),
    })).rejects.toThrow('disjoint');

    const externalOutput = path.join(root, 'external-output');
    const symlinkOutput = path.join(root, 'promotion-link');
    await mkdir(externalOutput);
    await symlink(externalOutput, symlinkOutput);
    await expect(runVisualLabBaseline({
      mode: 'promote', baselineRoot, resultRoot: currentRoot, comparisonRoot,
      candidates: ['water-motion'], outputDir: symlinkOutput,
    })).rejects.toThrow(/real directories|symbolic/i);

    const nestedExternalOutput = path.join(root, 'nested-external-output');
    const nestedSymlinkParent = path.join(root, 'nested-output-parent');
    const nestedSymlinkOutput = path.join(nestedSymlinkParent, 'promotion');
    await mkdir(nestedExternalOutput);
    await symlink(nestedExternalOutput, nestedSymlinkParent);
    await expect(runVisualLabBaseline({
      mode: 'promote', baselineRoot, resultRoot: currentRoot, comparisonRoot,
      candidates: ['water-motion'], outputDir: nestedSymlinkOutput,
    })).rejects.toThrow(/real directories|symbolic/i);
    await expect(access(path.join(nestedExternalOutput, 'promotion'))).rejects.toThrow();

    const failedRoot = path.join(root, 'failed-promotion');
    await expect(runVisualLabBaseline({
      mode: 'promote', baselineRoot, resultRoot: currentRoot, comparisonRoot,
      candidates: ['water-motion'], outputDir: failedRoot,
    }, {
      publishFile: async (file, contents) => {
        if (path.basename(file) === 'index.json') throw new Error('injected index publish failure');
        await writeFile(file, contents);
      },
    })).rejects.toThrow('injected index publish failure');
    await expect(access(path.join(failedRoot, 'promotion.json'))).resolves.toBeUndefined();
    await expect(access(path.join(failedRoot, 'index.json'))).rejects.toThrow();
  });
});
