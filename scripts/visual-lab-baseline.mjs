import { createHash, randomUUID } from 'node:crypto';
import {
  copyFile, lstat, mkdir, readFile, readdir, rename, rm, writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import {
  inspectVisualLabPng,
  VISUAL_LAB_BATCH_SCHEMA,
} from './visual-lab-batch.mjs';
import {
  resolveVisualLabCaptureRecipe,
  visualLabCaptureRecipeNames,
} from './visual-lab-recipes.mjs';
import { createVisualLabResultRecord } from './visual-lab-result.mjs';

export const VISUAL_LAB_BASELINE_SCHEMA = 'anifor.visual-lab.accepted-baseline/v1';
export const VISUAL_LAB_COMPARISON_SCHEMA = 'anifor.visual-lab.comparison/v1';

const MODULE_PATH = fileURLToPath(import.meta.url);
const VARIANTS = Object.freeze(['off', 'a', 'b']);
const CANDIDATE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256_ID = /^sha256:[0-9a-f]{64}$/;

const HELP = `Usage:
  node scripts/visual-lab-baseline.mjs accept \\
    --batch-root=<complete-batch> --output-dir=<new-baseline-directory>

  node scripts/visual-lab-baseline.mjs compare \\
    --baseline-root=<accepted-baseline> --result-root=<complete-batch> \\
    --output-dir=<new-comparison-directory>

The accepted package and comparison package are portable directories. A changed
capture is review information and exits successfully; malformed, incomplete,
missing, tampered, or request-incompatible evidence fails.
`;

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

const assertExactRecord = (value, keys, label) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const actual = Reflect.ownKeys(value);
  const missing = keys.filter((key) => !actual.includes(key));
  const unexpected = actual.filter((key) => !keys.includes(key));
  if (missing.length > 0 || unexpected.length > 0) {
    const details = [
      missing.length > 0 ? `missing ${missing.join(', ')}` : '',
      unexpected.length > 0 ? `unexpected ${unexpected.map(String).join(', ')}` : '',
    ].filter(Boolean).join('; ');
    throw new TypeError(`${label} must contain exactly ${keys.join(', ')} (${details})`);
  }
};

const assertCandidate = (candidate, label = 'candidate') => {
  if (typeof candidate !== 'string' || !CANDIDATE.test(candidate)) {
    throw new TypeError(`${label} must be a lowercase kebab-case name`);
  }
  return candidate;
};

const normalizeResult = (candidate, result, label) => {
  if (result === null || typeof result !== 'object' || Array.isArray(result)) {
    throw new TypeError(`${label} must be an object`);
  }
  let expected;
  try {
    expected = createVisualLabResultRecord(candidate, result.request, result.captureSha256);
  } catch (error) {
    throw new TypeError(`${label} is invalid: ${error.message}`, { cause: error });
  }
  if (!isDeepStrictEqual(result, expected)) {
    throw new TypeError(`${label} does not match its content-addressed identity`);
  }
  return expected;
};

const expectedArtifacts = (candidate) => ({
  report: `candidates/${candidate}/report.json`,
  off: `candidates/${candidate}/off.png`,
  a: `candidates/${candidate}/a.png`,
  b: `candidates/${candidate}/b.png`,
});

const expectedRequestFor = (candidate) => {
  const recipe = resolveVisualLabCaptureRecipe(candidate);
  return {
    domain: recipe.domain,
    target: recipe.target,
    fixture: recipe.fixture,
    gain: recipe.gain,
    renderScale: recipe.renderScale,
  };
};

const assertCatalogCompatibility = (candidates, label) => {
  const catalogOrder = new Map(
    visualLabCaptureRecipeNames().map((candidate, index) => [candidate, index]),
  );
  const indices = candidates.map(({ candidate }) => catalogOrder.get(candidate));
  if (indices.some((index) => index === undefined)
    || indices.some((index, position) => position > 0 && index <= indices[position - 1])) {
    throw new TypeError(`${label} candidates must use canonical catalog order`);
  }
  for (const { candidate, result } of candidates) {
    if (!isDeepStrictEqual(result.request, expectedRequestFor(candidate))) {
      throw new TypeError(`${label} candidate ${candidate} request does not match its recipe`);
    }
  }
};

const normalizeCompleteBatch = (batch) => {
  assertExactRecord(batch, ['schema', 'complete', 'summary', 'candidates'], 'batch index');
  if (batch.schema !== VISUAL_LAB_BATCH_SCHEMA) {
    throw new TypeError(`batch index must use ${VISUAL_LAB_BATCH_SCHEMA}`);
  }
  if (batch.complete !== true) throw new TypeError('batch index must be complete');
  assertExactRecord(batch.summary, ['selected', 'passed', 'failed'], 'batch summary');
  if (!Array.isArray(batch.candidates) || batch.candidates.length === 0) {
    throw new TypeError('batch index candidates must be a non-empty array');
  }
  const seen = new Set();
  const candidates = batch.candidates.map((entry, index) => {
    assertExactRecord(
      entry, ['candidate', 'status', 'result', 'artifacts', 'warnings'],
      `batch candidate ${index}`,
    );
    const candidate = assertCandidate(entry.candidate, `batch candidate ${index}.candidate`);
    if (seen.has(candidate)) throw new TypeError(`duplicate batch candidate ${candidate}`);
    seen.add(candidate);
    if (entry.status !== 'passed') {
      throw new TypeError(`complete batch candidate ${candidate} must have passed`);
    }
    if (!isDeepStrictEqual(entry.artifacts, expectedArtifacts(candidate))) {
      throw new TypeError(`batch candidate ${candidate} has non-canonical artifact paths`);
    }
    if (!Array.isArray(entry.warnings)
      || entry.warnings.some((warning) => typeof warning !== 'string')) {
      throw new TypeError(`batch candidate ${candidate} warnings must be strings`);
    }
    const result = normalizeResult(
      candidate, entry.result, `batch candidate ${candidate}.result`,
    );
    return {
      candidate,
      result,
    };
  });
  if (!isDeepStrictEqual(batch.summary, {
    selected: candidates.length, passed: candidates.length, failed: 0,
  })) {
    throw new TypeError('batch summary does not match its complete candidates');
  }
  assertCatalogCompatibility(candidates, 'batch');
  return candidates;
};

const createBaselineFromCandidates = (candidates) => {
  const seen = new Set();
  const normalized = candidates.map(({ candidate, result }, index) => {
    assertCandidate(candidate, `baseline candidate ${index}.candidate`);
    if (seen.has(candidate)) throw new TypeError(`duplicate baseline candidate ${candidate}`);
    seen.add(candidate);
    return {
      candidate,
      result: normalizeResult(candidate, result, `baseline candidate ${candidate}.result`),
    };
  });
  const identity = { schema: VISUAL_LAB_BASELINE_SCHEMA, candidates: normalized };
  const digest = createHash('sha256').update(JSON.stringify(identity), 'utf8').digest('hex');
  return deepFreeze({
    schema: VISUAL_LAB_BASELINE_SCHEMA,
    id: `sha256:${digest}`,
    candidates: normalized,
  });
};

export function createVisualLabBaseline(batch) {
  return createBaselineFromCandidates(normalizeCompleteBatch(batch));
}

export function normalizeVisualLabBaseline(baseline) {
  assertExactRecord(baseline, ['schema', 'id', 'candidates'], 'accepted baseline');
  if (baseline.schema !== VISUAL_LAB_BASELINE_SCHEMA) {
    throw new TypeError(`accepted baseline must use ${VISUAL_LAB_BASELINE_SCHEMA}`);
  }
  if (typeof baseline.id !== 'string' || !SHA256_ID.test(baseline.id)) {
    throw new TypeError('accepted baseline.id must be a SHA-256 identity');
  }
  if (!Array.isArray(baseline.candidates) || baseline.candidates.length === 0) {
    throw new TypeError('accepted baseline candidates must be a non-empty array');
  }
  const candidates = baseline.candidates.map((entry, index) => {
    assertExactRecord(entry, ['candidate', 'result'], `baseline candidate ${index}`);
    return entry;
  });
  const expected = createBaselineFromCandidates(candidates);
  assertCatalogCompatibility(expected.candidates, 'accepted baseline');
  if (!isDeepStrictEqual(baseline, expected)) {
    throw new TypeError('accepted baseline does not match its content-addressed identity');
  }
  return expected;
}

const variantComparison = (status, baselineResult, currentResult) => Object.fromEntries(
  VARIANTS.map((variant) => [variant, {
    status,
    baselineSha256: baselineResult?.captureSha256[variant] ?? null,
    currentSha256: currentResult?.captureSha256[variant] ?? null,
  }]),
);

const comparisonArtifacts = (candidate, baselineResult, currentResult) => ({
  baseline: baselineResult ? Object.fromEntries(VARIANTS.map((variant) => [
    variant, `baseline/candidates/${candidate}/${variant}.png`,
  ])) : null,
  current: currentResult ? Object.fromEntries(VARIANTS.map((variant) => [
    variant, `current/candidates/${candidate}/${variant}.png`,
  ])) : null,
});

const compareCandidate = (candidate, baselineResult, currentResult) => {
  if (!baselineResult) {
    return {
      candidate,
      status: 'added',
      baselineResult: null,
      currentResult,
      artifacts: comparisonArtifacts(candidate, null, currentResult),
      variants: variantComparison('added', null, currentResult),
    };
  }
  if (!currentResult) {
    return {
      candidate,
      status: 'not-sampled',
      baselineResult,
      currentResult: null,
      artifacts: comparisonArtifacts(candidate, baselineResult, null),
      variants: variantComparison('not-sampled', baselineResult, null),
    };
  }
  if (!isDeepStrictEqual(baselineResult.request, currentResult.request)) {
    throw new TypeError(`candidate ${candidate} request is incompatible with its accepted baseline`);
  }
  const variants = Object.fromEntries(VARIANTS.map((variant) => {
    const identical = baselineResult.captureSha256[variant]
      === currentResult.captureSha256[variant];
    return [variant, {
      status: identical ? 'encoded-identical' : 'review',
      baselineSha256: baselineResult.captureSha256[variant],
      currentSha256: currentResult.captureSha256[variant],
    }];
  }));
  const identical = VARIANTS.every(
    (variant) => variants[variant].status === 'encoded-identical',
  );
  return {
    candidate,
    status: identical ? 'encoded-identical' : 'review',
    baselineResult,
    currentResult,
    artifacts: comparisonArtifacts(candidate, baselineResult, currentResult),
    variants,
  };
};

export function compareVisualLabBaseline(baselineInput, batchInput) {
  const baseline = normalizeVisualLabBaseline(baselineInput);
  const currentCandidates = normalizeCompleteBatch(batchInput);
  const baselineByName = new Map(
    baseline.candidates.map(({ candidate, result }) => [candidate, result]),
  );
  const currentByName = new Map(
    currentCandidates.map(({ candidate, result }) => [candidate, result]),
  );
  const order = [
    ...baseline.candidates.map(({ candidate }) => candidate),
    ...currentCandidates.map(({ candidate }) => candidate)
      .filter((candidate) => !baselineByName.has(candidate)),
  ];
  const candidates = order.map((candidate) => compareCandidate(
    candidate, baselineByName.get(candidate), currentByName.get(candidate),
  ));
  const count = (status) => candidates.filter((entry) => entry.status === status).length;
  const summary = {
    baseline: baseline.candidates.length,
    selected: currentCandidates.length,
    compared: candidates.filter(({ baselineResult, currentResult }) => (
      baselineResult !== null && currentResult !== null
    )).length,
    identical: count('encoded-identical'),
    review: count('review'),
    added: count('added'),
    notSampled: count('not-sampled'),
  };
  const identity = {
    schema: VISUAL_LAB_COMPARISON_SCHEMA,
    baselineId: baseline.id,
    currentResultIds: currentCandidates.map(({ result }) => result.id),
    candidates: candidates.map(({ candidate, status, variants }) => ({
      candidate,
      status,
      variants: Object.fromEntries(VARIANTS.map((variant) => [variant, variants[variant].status])),
    })),
  };
  const digest = createHash('sha256').update(JSON.stringify(identity), 'utf8').digest('hex');
  return deepFreeze({
    schema: VISUAL_LAB_COMPARISON_SCHEMA,
    id: `sha256:${digest}`,
    complete: true,
    baseline: { schema: VISUAL_LAB_BASELINE_SCHEMA, id: baseline.id },
    current: {
      schema: VISUAL_LAB_BATCH_SCHEMA,
      resultIds: currentCandidates.map(({ result }) => result.id),
    },
    summary,
    candidates,
  });
}

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const shortHash = (value) => value ? value.slice(0, 12) : '—';

const renderVariant = (entry, variant) => {
  const state = entry.variants[variant];
  const accepted = entry.baselineResult
    ? `<figure><img src="./${entry.artifacts.baseline[variant]}"
        alt="${escapeHtml(entry.candidate)} ${variant} accepted capture">
       <figcaption>accepted · ${shortHash(state.baselineSha256)}</figcaption></figure>`
    : '<div class="empty">no accepted capture</div>';
  const current = entry.currentResult
    ? `<figure><img src="./${entry.artifacts.current[variant]}"
        alt="${escapeHtml(entry.candidate)} ${variant} current capture">
       <figcaption>current · ${shortHash(state.currentSha256)}</figcaption></figure>`
    : '<div class="empty">not sampled in this run</div>';
  return `<section class="variant"><h3>${variant.toUpperCase()} · ${state.status}</h3>
    <div class="pair">${accepted}${current}</div></section>`;
};

export function renderVisualLabComparison(comparison) {
  if (comparison?.schema !== VISUAL_LAB_COMPARISON_SCHEMA
    || comparison.complete !== true || !Array.isArray(comparison.candidates)) {
    throw new TypeError(`comparison sheet requires ${VISUAL_LAB_COMPARISON_SCHEMA}`);
  }
  const cards = comparison.candidates.map((entry) => (
    `<article class="candidate status-${entry.status}">
      <header><h2>${escapeHtml(entry.candidate)}</h2>
        <span class="status">${escapeHtml(entry.status)}</span></header>
      <div class="variants">${VARIANTS.map((variant) => renderVariant(entry, variant)).join('')}</div>
    </article>`
  )).join('');
  const summary = comparison.summary;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>AniforTPT accepted-baseline comparison</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; background: #11151b; color: #eaf0f7; }
    body { margin: 0 auto; max-width: 2100px; padding: 24px; }
    h1, h2, h3, p { margin: 0; }
    body > header { display: grid; gap: 6px; margin-bottom: 20px; }
    main { display: grid; gap: 18px; }
    .candidate { background: #1b222c; border: 1px solid #344252; border-radius: 12px; padding: 16px; }
    .candidate > header { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .status { align-self: start; border-radius: 999px; padding: 3px 9px; background: #30475e; }
    .status-encoded-identical .status { background: #254e3b; color: #bff6d4; }
    .status-review .status, .status-added .status { background: #66501e; color: #ffe4a1; }
    .variants { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .variant { min-width: 0; }
    .variant h3 { margin-bottom: 6px; font-size: .9rem; color: #b8c5d2; }
    .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
    figure { margin: 0; min-width: 0; }
    img { display: block; width: 100%; height: auto; border-radius: 7px; background: #080b0f; }
    figcaption, .empty { margin-top: 4px; color: #b8c5d2; overflow-wrap: anywhere; }
    .empty { min-height: 72px; display: grid; place-items: center; border: 1px dashed #405065; border-radius: 7px; }
    @media (max-width: 960px) { .variants { grid-template-columns: 1fr; } }
    @media (max-width: 620px) { body { padding: 12px; } .pair { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header>
    <h1>Accepted-baseline comparison</h1>
    <p>Baseline ${comparison.baseline.id}</p>
    <p>${summary.compared} compared · ${summary.identical} encoded-identical · ${
  summary.review} review · ${summary.added} added · ${summary.notSampled} not sampled</p>
  </header>
  <main>${cards}
  </main>
</body>
</html>
`;
}

export function parseVisualLabBaselineArguments(argv) {
  if (!Array.isArray(argv)) throw new TypeError('arguments must be an array');
  if (argv.includes('--help') || argv.includes('-h')) return { help: true };
  const [mode, ...flags] = argv;
  if (mode !== 'accept' && mode !== 'compare') {
    throw new TypeError('first argument must be accept or compare');
  }
  const values = new Map();
  for (const flag of flags) {
    const match = /^--([a-z-]+)=(.+)$/.exec(flag);
    if (!match) throw new TypeError(`invalid argument ${flag}`);
    if (values.has(match[1])) throw new TypeError(`duplicate --${match[1]}`);
    values.set(match[1], match[2]);
  }
  const allowed = mode === 'accept'
    ? new Set(['batch-root', 'output-dir'])
    : new Set(['baseline-root', 'result-root', 'output-dir']);
  for (const key of values.keys()) {
    if (!allowed.has(key)) throw new TypeError(`unsupported --${key} for ${mode}`);
  }
  for (const key of allowed) {
    if (!values.has(key)) throw new TypeError(`missing --${key}`);
  }
  return mode === 'accept' ? {
    mode,
    batchRoot: values.get('batch-root'),
    outputDir: values.get('output-dir'),
  } : {
    mode,
    baselineRoot: values.get('baseline-root'),
    resultRoot: values.get('result-root'),
    outputDir: values.get('output-dir'),
  };
}

const readJson = async (file, label) => {
  let source;
  try { source = await readFile(file, 'utf8'); }
  catch (error) { throw new Error(`cannot read ${label} ${file}: ${error.message}`, { cause: error }); }
  try { return JSON.parse(source); }
  catch (error) { throw new Error(`${label} ${file} is not valid JSON`, { cause: error }); }
};

const assertRealDirectoryChain = async (directory) => {
  const resolved = path.resolve(directory);
  const parsed = path.parse(resolved);
  let current = parsed.root;
  for (const segment of resolved.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error(`directory path must contain only real directories: ${current}`);
    }
  }
  return resolved;
};

const ensureRealDirectory = async (directory, { empty = false } = {}) => {
  const resolved = path.resolve(directory);
  await mkdir(resolved, { recursive: true });
  await assertRealDirectoryChain(resolved);
  if (empty && (await readdir(resolved)).length > 0) {
    throw new Error(`output directory must be empty: ${resolved}`);
  }
};

const ensureContainedFile = async (root, relative, label) => {
  const resolvedRoot = path.resolve(root);
  const file = path.resolve(resolvedRoot, relative);
  if (file === resolvedRoot || !file.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`${label} escapes its package root`);
  }
  await assertRealDirectoryChain(resolvedRoot);
  let current = resolvedRoot;
  const segments = path.relative(resolvedRoot, file).split(path.sep);
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    const info = await lstat(current);
    const final = index === segments.length - 1;
    if (info.isSymbolicLink() || (final ? !info.isFile() : !info.isDirectory())) {
      throw new Error(`${label} must use only real contained ${final ? 'files' : 'directories'}`);
    }
  }
  return file;
};

const validateCapturePackage = async (root, candidates, kind) => {
  for (const { candidate, result } of candidates) {
    for (const variant of VARIANTS) {
      const relative = `candidates/${candidate}/${variant}.png`;
      const file = await ensureContainedFile(root, relative, `${kind} ${candidate} ${variant}`);
      const bytes = await readFile(file);
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (digest !== result.captureSha256[variant]) {
        throw new Error(`${kind} ${candidate} ${variant}.png does not match its pinned SHA-256`);
      }
      inspectVisualLabPng(bytes, `${kind} ${candidate} ${variant}.png`);
    }
  }
};

const writeAtomic = async (file, contents) => {
  const directory = path.dirname(file);
  await ensureRealDirectory(directory);
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, contents, { flag: 'wx' });
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
};

const copyCaptures = async (sourceRoot, outputRoot, candidates) => {
  for (const { candidate } of candidates) {
    const candidateDirectory = path.join(outputRoot, 'candidates', candidate);
    await ensureRealDirectory(candidateDirectory);
    for (const variant of VARIANTS) {
      const source = await ensureContainedFile(
        sourceRoot, `candidates/${candidate}/${variant}.png`, `${candidate} ${variant}`,
      );
      await copyFile(source, path.join(candidateDirectory, `${variant}.png`));
    }
  }
};

const comparisonCandidatesFor = (comparison, side) => comparison.candidates
  .filter((entry) => entry[`${side}Result`] !== null)
  .map((entry) => ({ candidate: entry.candidate, result: entry[`${side}Result`] }));

const rootsOverlap = (left, right) => {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return a === b || a.startsWith(`${b}${path.sep}`) || b.startsWith(`${a}${path.sep}`);
};

const assertDisjointOutput = (output, inputs) => {
  for (const input of inputs) {
    if (rootsOverlap(output, input)) {
      throw new Error(`output package must be disjoint from input package ${path.resolve(input)}`);
    }
  }
};

const assertComparisonOutput = (output, baselineRoot, resultRoot) => {
  assertDisjointOutput(output, [baselineRoot]);
  const resolvedOutput = path.resolve(output);
  const resolvedResult = path.resolve(resultRoot);
  if (resolvedOutput === resolvedResult
    || resolvedResult.startsWith(`${resolvedOutput}${path.sep}`)) {
    throw new Error('comparison output cannot replace or contain the result package');
  }
  // An empty child of the validated result package is intentionally allowed:
  // CI adds the portable comparison there before uploading one review root.
};

export async function runVisualLabBaseline(options) {
  if (options.mode === 'accept') {
    const batchRoot = path.resolve(options.batchRoot);
    const outputDirectory = path.resolve(options.outputDir);
    assertDisjointOutput(outputDirectory, [batchRoot]);
    const batchIndex = await ensureContainedFile(batchRoot, 'index.json', 'batch index');
    const batch = await readJson(batchIndex, 'batch index');
    const candidates = normalizeCompleteBatch(batch);
    await validateCapturePackage(batchRoot, candidates, 'batch');
    const baseline = createBaselineFromCandidates(candidates);
    await ensureRealDirectory(outputDirectory, { empty: true });
    await copyCaptures(batchRoot, outputDirectory, candidates);
    await validateCapturePackage(outputDirectory, candidates, 'accepted output');
    await writeAtomic(
      path.join(outputDirectory, 'index.json'), `${JSON.stringify(baseline, null, 2)}\n`,
    );
    return { mode: 'accept', baseline, outputDirectory };
  }
  if (options.mode === 'compare') {
    const baselineRoot = path.resolve(options.baselineRoot);
    const resultRoot = path.resolve(options.resultRoot);
    const outputDirectory = path.resolve(options.outputDir);
    assertComparisonOutput(outputDirectory, baselineRoot, resultRoot);
    if (rootsOverlap(baselineRoot, resultRoot)) {
      throw new Error('accepted baseline and result packages must be disjoint');
    }
    const [baselineIndex, batchIndex] = await Promise.all([
      ensureContainedFile(baselineRoot, 'index.json', 'accepted baseline index'),
      ensureContainedFile(resultRoot, 'index.json', 'batch index'),
    ]);
    const [baselineInput, batch] = await Promise.all([
      readJson(baselineIndex, 'accepted baseline'),
      readJson(batchIndex, 'batch index'),
    ]);
    const baseline = normalizeVisualLabBaseline(baselineInput);
    const currentCandidates = normalizeCompleteBatch(batch);
    await Promise.all([
      validateCapturePackage(baselineRoot, baseline.candidates, 'accepted baseline'),
      validateCapturePackage(resultRoot, currentCandidates, 'batch'),
    ]);
    const comparison = compareVisualLabBaseline(baseline, batch);
    await ensureRealDirectory(outputDirectory, { empty: true });
    const baselineOutput = path.join(outputDirectory, 'baseline');
    const currentOutput = path.join(outputDirectory, 'current');
    await copyCaptures(
      baselineRoot, baselineOutput, comparisonCandidatesFor(comparison, 'baseline'),
    );
    await copyCaptures(
      resultRoot, currentOutput, comparisonCandidatesFor(comparison, 'current'),
    );
    await Promise.all([
      validateCapturePackage(
        baselineOutput, comparisonCandidatesFor(comparison, 'baseline'),
        'comparison baseline output',
      ),
      validateCapturePackage(
        currentOutput, comparisonCandidatesFor(comparison, 'current'),
        'comparison current output',
      ),
    ]);
    const html = path.join(outputDirectory, 'index.html');
    const json = path.join(outputDirectory, 'comparison.json');
    await writeAtomic(html, renderVisualLabComparison(comparison));
    await writeAtomic(json, `${JSON.stringify(comparison, null, 2)}\n`);
    return { mode: 'compare', comparison, html, json };
  }
  throw new TypeError('mode must be accept or compare');
}

async function main() {
  const options = parseVisualLabBaselineArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }
  const result = await runVisualLabBaseline(options);
  process.stdout.write(`${JSON.stringify(result.mode === 'accept' ? {
    schema: result.baseline.schema,
    id: result.baseline.id,
    candidates: result.baseline.candidates.length,
    outputDirectory: result.outputDirectory,
  } : {
    schema: result.comparison.schema,
    id: result.comparison.id,
    summary: result.comparison.summary,
    html: result.html,
    json: result.json,
  })}\n`);
}

if (path.resolve(process.argv[1] ?? '') === MODULE_PATH) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message ?? String(error)}\n`);
    process.exitCode = 1;
  });
}
