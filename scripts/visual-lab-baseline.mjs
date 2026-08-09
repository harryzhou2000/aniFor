import { createHash, randomUUID } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  copyFile, lstat, mkdir, open, readdir, rename, rm, writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import {
  inspectVisualLabPng,
  VISUAL_LAB_BATCH_SCHEMA,
} from './visual-lab-batch.mjs';
import {
  createVisualLabComparisonMetrics,
  VISUAL_LAB_COMPARISON_METRICS_SCHEMA,
} from './visual-lab-comparison-metrics.mjs';
import {
  VISUAL_LAB_CAPTURE_VARIANT_NAMES as VARIANTS,
} from './visual-lab-capture-abi.mjs';
import {
  resolveVisualLabCaptureRecipe,
  visualLabCaptureRecipeNames,
} from './visual-lab-recipes.mjs';
import { createVisualLabResultRecord } from './visual-lab-result.mjs';

export const VISUAL_LAB_BASELINE_SCHEMA = 'anifor.visual-lab.accepted-baseline/v1';
export const VISUAL_LAB_COMPARISON_SCHEMA = 'anifor.visual-lab.comparison/v1';
export const VISUAL_LAB_PROMOTION_SCHEMA = 'anifor.visual-lab.baseline-promotion/v1';

const MODULE_PATH = fileURLToPath(import.meta.url);
const CANDIDATE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256_ID = /^sha256:[0-9a-f]{64}$/;
const MAX_COMPARISON_METRICS_BYTES = 1024 * 1024;

const HELP = `Usage:
  node scripts/visual-lab-baseline.mjs accept \\
    --batch-root=<complete-batch> --output-dir=<new-baseline-directory>

  node scripts/visual-lab-baseline.mjs compare \\
    --baseline-root=<accepted-baseline> --result-root=<complete-batch> \\
    --output-dir=<new-comparison-directory>

  node scripts/visual-lab-baseline.mjs promote \\
    --baseline-root=<accepted-baseline> --result-root=<complete-batch> \\
    --comparison-root=<complete-comparison> --candidates=<name[,name...]> \\
    --output-dir=<new-baseline-directory>

The accepted package and comparison package are portable directories. A changed
capture is review information and exits successfully; malformed, incomplete,
missing, tampered, or request-incompatible evidence fails. Promotion is an
explicit proposal into a new directory; it never mutates the accepted input,
Git, CI, or deployment state.
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
  // Comparison/v1 preserves its deployed ordering contract: accepted entries
  // first, then newly observed current entries. Promotion independently emits
  // its merged accepted package in frozen catalog order.
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

const normalizePromotionSelection = (candidateNames, currentCandidates) => {
  if (!Array.isArray(candidateNames) || candidateNames.length === 0) {
    throw new TypeError('promotion candidates must be a non-empty array');
  }
  const available = new Set(currentCandidates.map(({ candidate }) => candidate));
  const selected = new Set();
  for (const [index, value] of candidateNames.entries()) {
    const candidate = assertCandidate(value, `promotion candidate ${index}`);
    resolveVisualLabCaptureRecipe(candidate);
    if (selected.has(candidate)) throw new TypeError(`duplicate promotion candidate ${candidate}`);
    if (!available.has(candidate)) {
      throw new TypeError(`promotion candidate ${candidate} is not present in the current batch`);
    }
    selected.add(candidate);
  }
  return visualLabCaptureRecipeNames().filter((candidate) => selected.has(candidate));
};

const createPromotionRecord = (
  baseline, comparison, promotedNames, previousByName, currentByName, result,
) => {
  const comparisonByName = new Map(
    comparison.candidates.map((entry) => [entry.candidate, entry]),
  );
  const promoted = promotedNames.map((candidate) => {
    const current = currentByName.get(candidate);
    const comparisonEntry = comparisonByName.get(candidate);
    if (!current || !comparisonEntry || comparisonEntry.currentResult === null
      || comparisonEntry.status === 'not-sampled') {
      throw new TypeError(`comparison has no promotable current evidence for ${candidate}`);
    }
    return {
      candidate,
      comparisonStatus: comparisonEntry.status,
      previousResultId: previousByName.get(candidate)?.id ?? null,
      currentResultId: current.id,
    };
  });
  const identity = {
    schema: VISUAL_LAB_PROMOTION_SCHEMA,
    baseline: { schema: VISUAL_LAB_BASELINE_SCHEMA, id: baseline.id },
    comparison: { schema: VISUAL_LAB_COMPARISON_SCHEMA, id: comparison.id },
    promoted,
    result: { schema: VISUAL_LAB_BASELINE_SCHEMA, id: result.id },
  };
  const digest = createHash('sha256').update(JSON.stringify(identity), 'utf8').digest('hex');
  return deepFreeze({
    schema: identity.schema,
    id: `sha256:${digest}`,
    baseline: identity.baseline,
    comparison: identity.comparison,
    promoted: identity.promoted,
    result: identity.result,
  });
};

/**
 * Produces a full accepted-baseline proposal from explicitly selected current
 * evidence. Unselected accepted records remain byte-identical; selected names
 * are overlaid in frozen catalog order. The exact portable comparison is part
 * of the decision identity, so stale or substituted review evidence cannot be
 * promoted accidentally.
 */
export function promoteVisualLabBaseline(
  baselineInput, batchInput, comparisonInput, candidateNames,
) {
  const baseline = normalizeVisualLabBaseline(baselineInput);
  const currentCandidates = normalizeCompleteBatch(batchInput);
  const comparison = compareVisualLabBaseline(baseline, batchInput);
  if (!isDeepStrictEqual(comparisonInput, comparison)) {
    throw new TypeError('comparison does not match the accepted baseline and current batch');
  }
  const promotedNames = normalizePromotionSelection(candidateNames, currentCandidates);
  const previousByName = new Map(
    baseline.candidates.map(({ candidate, result }) => [candidate, result]),
  );
  const currentByName = new Map(
    currentCandidates.map(({ candidate, result }) => [candidate, result]),
  );
  const promotedSet = new Set(promotedNames);
  const mergedByName = new Map(previousByName);
  for (const candidate of promotedNames) {
    mergedByName.set(candidate, currentByName.get(candidate));
  }
  const merged = visualLabCaptureRecipeNames()
    .filter((candidate) => mergedByName.has(candidate))
    .map((candidate) => ({ candidate, result: mergedByName.get(candidate) }));
  if (merged.length !== mergedByName.size) {
    throw new TypeError('promoted baseline contains a candidate outside the frozen catalog');
  }
  assertCatalogCompatibility(merged, 'promoted baseline');
  const result = createBaselineFromCandidates(merged);
  const promotion = createPromotionRecord(
    baseline, comparison, promotedNames, previousByName, currentByName, result,
  );
  // Prove every unselected accepted record remains the exact normalized object.
  for (const { candidate, result: previous } of baseline.candidates) {
    if (!promotedSet.has(candidate) && mergedByName.get(candidate) !== previous) {
      throw new TypeError(`promotion changed unselected candidate ${candidate}`);
    }
  }
  return deepFreeze({ baseline: result, promotion });
}

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const shortHash = (value) => value ? value.slice(0, 12) : '—';

const formatMetricRatio = (count, total) => (
  total > 0 ? `${((count * 100) / total).toFixed(2)}%` : '0.00%'
);

const formatMetricMean = (sum, samples) => (
  samples > 0 ? (sum / samples).toFixed(2) : '0.00'
);

const formatMetricRms = (squaredSum, samples) => (
  samples > 0 ? Math.sqrt(squaredSum / samples).toFixed(2) : '0.00'
);

const renderVariantMetric = (variantMetrics) => {
  const metric = variantMetrics?.metric;
  if (variantMetrics?.status !== 'review' || metric === null || metric === undefined) return '';
  if (metric.kind === 'dimension-mismatch') {
    return `<p class="metric">measurement only · dimensions accepted ${
      escapeHtml(metric.baseline.width)}×${escapeHtml(metric.baseline.height)} · current ${
      escapeHtml(metric.current.width)}×${escapeHtml(metric.current.height)}</p>`;
  }
  const rgbSamples = metric.comparedPixels * 3;
  return `<p class="metric">measurement only · RGBA-changed ${
    escapeHtml(formatMetricRatio(metric.rgbaDifferentPixels, metric.comparedPixels))} · RGB ${
    escapeHtml(formatMetricRatio(metric.rgb.differentPixels, metric.comparedPixels))} px, mean |Δ| ${
    escapeHtml(formatMetricMean(metric.rgb.absoluteDeltaSum, rgbSamples))}, RMS ${
    escapeHtml(formatMetricRms(metric.rgb.squaredDeltaSum, rgbSamples))}, peak ${
    escapeHtml(metric.rgb.channelPeak)} · alpha ${
    escapeHtml(formatMetricRatio(metric.alpha.differentPixels, metric.comparedPixels))} px, mean |Δ| ${
    escapeHtml(formatMetricMean(metric.alpha.absoluteDeltaSum, metric.comparedPixels))}, peak ${
    escapeHtml(metric.alpha.channelPeak)}</p>`;
};

const renderVariant = (entry, variant, variantMetrics) => {
  const state = entry.variants[variant];
  const accepted = entry.baselineResult
    ? `<figure><img src="./${escapeHtml(entry.artifacts.baseline[variant])}"
        alt="${escapeHtml(entry.candidate)} ${variant} accepted capture">
       <figcaption>accepted · ${escapeHtml(shortHash(state.baselineSha256))}</figcaption></figure>`
    : '<div class="empty">no accepted capture</div>';
  const current = entry.currentResult
    ? `<figure><img src="./${escapeHtml(entry.artifacts.current[variant])}"
        alt="${escapeHtml(entry.candidate)} ${variant} current capture">
       <figcaption>current · ${escapeHtml(shortHash(state.currentSha256))}</figcaption></figure>`
    : '<div class="empty">not sampled in this run</div>';
  return `<section class="variant"><h3>${variant.toUpperCase()} · ${escapeHtml(state.status)}</h3>${
    renderVariantMetric(variantMetrics)}
    <div class="pair">${accepted}${current}</div></section>`;
};

export function renderVisualLabComparison(comparison) {
  if (comparison?.schema !== VISUAL_LAB_COMPARISON_SCHEMA
    || comparison.complete !== true || !Array.isArray(comparison.candidates)) {
    throw new TypeError(`comparison sheet requires ${VISUAL_LAB_COMPARISON_SCHEMA}`);
  }
  const cards = comparison.candidates.map((entry) => (
    `<article class="candidate status-${escapeHtml(entry.status)}">
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
    <p>Baseline ${escapeHtml(comparison.baseline.id)}</p>
    <p>${escapeHtml(summary.compared)} compared · ${escapeHtml(summary.identical)} encoded-identical · ${
  escapeHtml(summary.review)} review · ${escapeHtml(summary.added)} added · ${
  escapeHtml(summary.notSampled)} not sampled</p>
  </header>
  <main>${cards}
  </main>
</body>
</html>
`;
}

const renderReviewCandidate = (entry, candidateMetrics) => {
  const request = entry.currentResult?.request ?? entry.baselineResult?.request;
  if (!request) throw new TypeError(`review candidate ${entry.candidate} has no request`);
  const resultLine = [
    entry.baselineResult ? `accepted ${shortHash(entry.baselineResult.id)}` : 'no accepted result',
    entry.currentResult ? `current ${shortHash(entry.currentResult.id)}` : 'not sampled',
  ].join(' · ');
  return `<article class="candidate status-${escapeHtml(entry.status)}">
      <header><div><h2>${escapeHtml(entry.candidate)}</h2>
        <p class="request">${escapeHtml(request.domain)} · target ${escapeHtml(request.target)} · fixture ${
  escapeHtml(request.fixture)} · gain ${escapeHtml(request.gain)} · Detail ${
  escapeHtml(request.renderScale)}×</p>
        <p class="hashes">${escapeHtml(resultLine)}</p></div>
        <span class="status">${escapeHtml(entry.status)}</span></header>
      <div class="variants">${VARIANTS.map((variant) => (
    renderVariant(entry, variant, candidateMetrics?.variants?.[variant])
  )).join('')}</div>
    </article>`;
};

const reviewMetricsByCandidate = (comparison, metrics) => {
  if (metrics === undefined) return undefined;
  if (metrics?.schema !== VISUAL_LAB_COMPARISON_METRICS_SCHEMA
    || metrics.comparison?.schema !== comparison.schema
    || metrics.comparison?.id !== comparison.id
    || !Array.isArray(metrics.candidates)
    || metrics.candidates.length !== comparison.candidates.length) {
    throw new TypeError(`review brief metrics require ${VISUAL_LAB_COMPARISON_METRICS_SCHEMA}`);
  }
  const byCandidate = new Map();
  metrics.candidates.forEach((entry, index) => {
    const expected = comparison.candidates[index];
    if (entry?.candidate !== expected.candidate || entry.status !== expected.status
      || byCandidate.has(entry.candidate)) {
      throw new TypeError('review brief metrics do not match comparison candidate order');
    }
    byCandidate.set(entry.candidate, entry);
  });
  return byCandidate;
};

/**
 * Additive human decision queue derived from comparison/v1 and its optional
 * recomputable integer metrics. Both stay outside comparison identity; the
 * exhaustive index remains authoritative.
 */
export function renderVisualLabReviewBrief(comparison, metrics) {
  if (comparison?.schema !== VISUAL_LAB_COMPARISON_SCHEMA
    || comparison.complete !== true || !Array.isArray(comparison.candidates)) {
    throw new TypeError(`review brief requires ${VISUAL_LAB_COMPARISON_SCHEMA}`);
  }
  const metricsByCandidate = reviewMetricsByCandidate(comparison, metrics);
  const decisions = comparison.candidates.filter(
    ({ status }) => status !== 'encoded-identical',
  );
  const unchanged = comparison.candidates.filter(
    ({ status }) => status === 'encoded-identical',
  );
  const queue = decisions.length > 0
    ? decisions.map((entry) => renderReviewCandidate(
      entry, metricsByCandidate?.get(entry.candidate),
    )).join('')
    : '<p class="empty-queue">No visual decisions are required for this comparison.</p>';
  const unchangedList = unchanged.length > 0
    ? `<ul>${unchanged.map(({ candidate }) => `<li>${escapeHtml(candidate)}</li>`).join('')}</ul>`
    : '<p>None.</p>';
  const summary = comparison.summary;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>AniforTPT visual review brief</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; background: #10141a; color: #edf3fa; }
    body { margin: 0 auto; max-width: 2100px; padding: 24px; }
    h1, h2, h3, p { margin: 0; }
    body > header { display: grid; gap: 7px; margin-bottom: 20px; }
    a { color: #9fd0ff; }
    main { display: grid; gap: 18px; }
    .candidate { background: #1b222c; border: 1px solid #3d4b5d; border-radius: 12px; padding: 16px; }
    .candidate > header { display: flex; justify-content: space-between; gap: 14px; margin-bottom: 12px; }
    .request, .hashes { margin-top: 5px; color: #b9c7d6; overflow-wrap: anywhere; }
    .status { align-self: start; border-radius: 999px; padding: 3px 9px; background: #66501e; color: #ffe4a1; }
    .status-not-sampled .status { background: #4a3c5e; color: #e2ccff; }
    .variants { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .variant { min-width: 0; }
    .variant h3 { margin-bottom: 6px; font-size: .9rem; color: #b8c5d2; }
    .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
    figure { margin: 0; min-width: 0; }
    img { display: block; width: 100%; height: auto; border-radius: 7px; background: #080b0f; }
    figcaption, .empty { margin-top: 4px; color: #b8c5d2; overflow-wrap: anywhere; }
    .empty { min-height: 72px; display: grid; place-items: center; border: 1px dashed #405065; border-radius: 7px; }
${metrics === undefined ? '' : '    .metric { margin: 7px 0; color: #d3dfec; font-size: .82rem; line-height: 1.35; }\n'}    .empty-queue, aside { background: #192720; border: 1px solid #315541; border-radius: 10px; padding: 14px; }
    aside { margin-top: 20px; }
    aside h2 { font-size: 1rem; margin-bottom: 6px; }
    aside ul { margin: 0; columns: 2; }
    @media (max-width: 960px) { .variants { grid-template-columns: 1fr; } }
    @media (max-width: 620px) { body { padding: 12px; } .pair { grid-template-columns: 1fr; } aside ul { columns: 1; } }
  </style>
</head>
<body>
  <header>
    <h1>Visual review brief</h1>
    <p>Comparison ${escapeHtml(comparison.id)}</p>
    <p>Baseline ${escapeHtml(comparison.baseline.id)}</p>
    <p>${escapeHtml(summary.review)} review · ${escapeHtml(summary.added)} added · ${
  escapeHtml(summary.notSampled)} not sampled · ${escapeHtml(summary.identical)} encoded-identical</p>
    <p><a href="./index.html">Open the exhaustive comparison sheet</a></p>
${metrics === undefined ? '' : '    <p><a href="./metrics.json">Open raw integer RGB/alpha measurements</a> · measurements do not pass or fail aesthetics</p>\n'}  </header>
  <main>${queue}
  </main>
  <aside><h2>Encoded-identical · no action</h2>${unchangedList}</aside>
</body>
</html>
`;
}

export function parseVisualLabBaselineArguments(argv) {
  if (!Array.isArray(argv)) throw new TypeError('arguments must be an array');
  if (argv.includes('--help') || argv.includes('-h')) return { help: true };
  const [mode, ...flags] = argv;
  if (mode !== 'accept' && mode !== 'compare' && mode !== 'promote') {
    throw new TypeError('first argument must be accept, compare, or promote');
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
    : mode === 'compare'
      ? new Set(['baseline-root', 'result-root', 'output-dir'])
      : new Set([
        'baseline-root', 'result-root', 'comparison-root', 'candidates', 'output-dir',
      ]);
  for (const key of values.keys()) {
    if (!allowed.has(key)) throw new TypeError(`unsupported --${key} for ${mode}`);
  }
  for (const key of allowed) {
    if (!values.has(key)) throw new TypeError(`missing --${key}`);
  }
  if (mode === 'accept') {
    return {
      mode,
      batchRoot: values.get('batch-root'),
      outputDir: values.get('output-dir'),
    };
  }
  if (mode === 'compare') {
    return {
      mode,
      baselineRoot: values.get('baseline-root'),
      resultRoot: values.get('result-root'),
      outputDir: values.get('output-dir'),
    };
  }
  const candidates = values.get('candidates').split(',').map((name) => name.trim());
  if (candidates.some((candidate) => candidate.length === 0)) {
    throw new TypeError('--candidates must be a comma-separated list of recipe names');
  }
  return {
    mode,
    baselineRoot: values.get('baseline-root'),
    resultRoot: values.get('result-root'),
    comparisonRoot: values.get('comparison-root'),
    candidates,
    outputDir: values.get('output-dir'),
  };
}

const sameStableFile = (left, right) => (
  left.dev === right.dev
  && left.ino === right.ino
  && left.size === right.size
  && left.mtimeNs === right.mtimeNs
  && left.ctimeNs === right.ctimeNs
);

const assertRealFileAncestors = async (file, label) => {
  const absolute = path.resolve(file);
  const parsed = path.parse(absolute);
  const segments = absolute.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let current = parsed.root;
  for (const segment of segments.slice(0, -1)) {
    current = path.join(current, segment);
    const info = await lstat(current, { bigint: true });
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error(`${label} must have only real directory ancestors: ${current}`);
    }
  }
};

/** Reads one real regular file without following a leaf/ancestor symlink or replacement. */
const readStableRegularFile = async (file, label, encoding, maxBytes) => {
  await assertRealFileAncestors(file, label);
  const before = await lstat(file, { bigint: true });
  if (before.isSymbolicLink() || !before.isFile()) {
    throw new Error(`${label} must be a real regular file`);
  }
  if (maxBytes !== undefined && before.size > BigInt(maxBytes)) {
    throw new Error(`${label} exceeds its bounded file budget`);
  }
  const flags = typeof fsConstants.O_NOFOLLOW === 'number'
    ? fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW
    : 'r';
  const handle = await open(file, flags);
  let contents;
  try {
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || !sameStableFile(before, opened)) {
      throw new Error(`${label} changed while opening`);
    }
    contents = await handle.readFile(encoding);
  } finally {
    await handle.close();
  }
  await assertRealFileAncestors(file, label);
  const after = await lstat(file, { bigint: true });
  if (after.isSymbolicLink() || !after.isFile() || !sameStableFile(before, after)) {
    throw new Error(`${label} changed while reading`);
  }
  return contents;
};

const readJson = async (file, label) => {
  let source;
  try { source = await readStableRegularFile(file, label, 'utf8'); }
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
  const parsed = path.parse(resolved);
  let current = parsed.root;
  for (const segment of resolved.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    const child = path.join(current, segment);
    let info;
    try {
      info = await lstat(child);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      try {
        await mkdir(child);
      } catch (mkdirError) {
        // A concurrent creator is acceptable only if it created a real
        // directory. Re-lstat below owns the final decision.
        if (mkdirError?.code !== 'EEXIST') throw mkdirError;
      }
      info = await lstat(child);
    }
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error(`directory path must contain only real directories: ${child}`);
    }
    current = child;
  }
  if (empty && (await readdir(resolved)).length > 0) {
    throw new Error(`output directory must be empty: ${resolved}`);
  }
  return resolved;
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
      const bytes = await readStableRegularFile(file, `${kind} ${candidate} ${variant}`);
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

const acquirePromotionLock = async (directory) => {
  const lockPath = path.join(directory, '.visual-lab-promotion.lock');
  let handle;
  try {
    handle = await open(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(`promotion output is already owned by another writer: ${directory}`);
    }
    throw error;
  }
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    await handle.close();
    await rm(lockPath, { force: true });
  };
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

const createComparisonPackageMetrics = (root, comparison) => (
  createVisualLabComparisonMetrics(comparison, async (side, candidate, variant) => {
    const label = `comparison ${side} ${candidate} ${variant}.png`;
    const file = await ensureContainedFile(
      root, `${side}/candidates/${candidate}/${variant}.png`, label,
    );
    return readStableRegularFile(file, label);
  })
);

const readOptionalComparisonFile = async (root, relative, label, maxBytes) => {
  let file;
  try { file = await ensureContainedFile(root, relative, label); }
  catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  }
  return readStableRegularFile(file, label, 'utf8', maxBytes);
};

const validateComparisonPackage = async (root, expected) => {
  const [jsonPath, htmlPath] = await Promise.all([
    ensureContainedFile(root, 'comparison.json', 'comparison index'),
    ensureContainedFile(root, 'index.html', 'comparison sheet'),
  ]);
  const [comparison, html] = await Promise.all([
    readJson(jsonPath, 'comparison index'),
    readStableRegularFile(htmlPath, 'comparison sheet', 'utf8'),
  ]);
  if (!isDeepStrictEqual(comparison, expected)) {
    throw new TypeError('comparison package does not match the accepted baseline and current batch');
  }
  if (html !== renderVisualLabComparison(expected)) {
    throw new TypeError('comparison sheet does not match its complete comparison index');
  }
  const [brief, metricsSource] = await Promise.all([
    readOptionalComparisonFile(root, 'review-brief.html', 'comparison review brief'),
    readOptionalComparisonFile(
      root, 'metrics.json', 'comparison metrics', MAX_COMPARISON_METRICS_BYTES,
    ),
  ]);
  await Promise.all([
    validateCapturePackage(
      path.join(root, 'baseline'), comparisonCandidatesFor(expected, 'baseline'),
      'comparison baseline',
    ),
    validateCapturePackage(
      path.join(root, 'current'), comparisonCandidatesFor(expected, 'current'),
      'comparison current',
    ),
  ]);
  let metrics;
  if (metricsSource !== undefined) {
    try { metrics = JSON.parse(metricsSource); }
    catch (error) {
      throw new TypeError(`comparison metrics is not valid JSON: ${error.message}`, {
        cause: error,
      });
    }
    const expectedMetrics = await createComparisonPackageMetrics(root, expected);
    if (!isDeepStrictEqual(metrics, expectedMetrics)) {
      throw new TypeError('comparison metrics do not match the pinned comparison captures');
    }
    if (brief === undefined) {
      throw new TypeError('comparison metrics require a matching review brief');
    }
  }
  if (brief !== undefined && brief !== renderVisualLabReviewBrief(expected, metrics)) {
    throw new TypeError('comparison review brief does not match its complete comparison evidence');
  }
  return comparison;
};

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

const canonicalPackagePath = (value, label) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty path`);
  }
  const segments = value.split(path.sep);
  if (path.normalize(value) !== value
    || segments.includes('.') || segments.includes('..')) {
    throw new TypeError(`${label} must be canonical without dot segments`);
  }
  return path.resolve(value);
};

/** Revalidates one portable comparison and every pinned input/output PNG without writing. */
export async function verifyVisualLabComparisonPackage(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Visual Lab comparison verification options must be an object');
  }
  const allowed = new Set(['baselineRoot', 'resultRoot', 'comparisonRoot']);
  const unexpected = Reflect.ownKeys(options).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) {
    throw new TypeError(`Unknown Visual Lab comparison verification option ${String(unexpected[0])}`);
  }
  const baselineRoot = canonicalPackagePath(options.baselineRoot, 'accepted baseline root');
  const resultRoot = canonicalPackagePath(options.resultRoot, 'batch result root');
  const comparisonRoot = canonicalPackagePath(options.comparisonRoot, 'comparison root');
  assertComparisonOutput(comparisonRoot, baselineRoot, resultRoot);
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
  const expected = compareVisualLabBaseline(baseline, batch);
  const comparison = await validateComparisonPackage(comparisonRoot, expected);
  return deepFreeze({ baseline, comparison, currentCandidates });
}

export async function runVisualLabBaseline(options, dependencies = {}) {
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
    const metrics = await createComparisonPackageMetrics(outputDirectory, comparison);
    const html = path.join(outputDirectory, 'index.html');
    const brief = path.join(outputDirectory, 'review-brief.html');
    const metricsPath = path.join(outputDirectory, 'metrics.json');
    const json = path.join(outputDirectory, 'comparison.json');
    await writeAtomic(html, renderVisualLabComparison(comparison));
    await writeAtomic(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`);
    await writeAtomic(brief, renderVisualLabReviewBrief(comparison, metrics));
    await writeAtomic(json, `${JSON.stringify(comparison, null, 2)}\n`);
    return {
      mode: 'compare', comparison, metrics, html, brief, metricsPath, json,
    };
  }
  if (options.mode === 'promote') {
    const baselineRoot = path.resolve(options.baselineRoot);
    const resultRoot = path.resolve(options.resultRoot);
    const comparisonRoot = path.resolve(options.comparisonRoot);
    const outputDirectory = path.resolve(options.outputDir);
    assertDisjointOutput(outputDirectory, [baselineRoot, resultRoot, comparisonRoot]);
    if (rootsOverlap(baselineRoot, resultRoot)) {
      throw new Error('accepted baseline and result packages must be disjoint');
    }
    assertComparisonOutput(comparisonRoot, baselineRoot, resultRoot);
    // Reject an existing symlink/non-directory output before doing any review
    // work. A later evidence failure may leave only this empty real directory,
    // never a manifest or a partially valid package.
    await ensureRealDirectory(outputDirectory, { empty: true });
    const releasePromotionLock = await acquirePromotionLock(outputDirectory);
    const executeLockedPromotion = async () => {
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
      const expectedComparison = compareVisualLabBaseline(baseline, batch);
      const comparison = await validateComparisonPackage(comparisonRoot, expectedComparison);
      const proposal = promoteVisualLabBaseline(
        baseline, batch, comparison, options.candidates,
      );
      const promoted = new Set(
        proposal.promotion.promoted.map(({ candidate }) => candidate),
      );
      const retainedCandidates = baseline.candidates.filter(
        ({ candidate }) => !promoted.has(candidate),
      );
      const promotedCandidates = currentCandidates.filter(
        ({ candidate }) => promoted.has(candidate),
      );
      await copyCaptures(baselineRoot, outputDirectory, retainedCandidates);
      await copyCaptures(resultRoot, outputDirectory, promotedCandidates);
      await validateCapturePackage(
        outputDirectory, proposal.baseline.candidates, 'promoted baseline output',
      );
      const promotionPath = path.join(outputDirectory, 'promotion.json');
      const indexPath = path.join(outputDirectory, 'index.json');
      const publishFile = dependencies.publishFile ?? writeAtomic;
      // The decision record precedes the content manifest. An interrupted write
      // therefore cannot leave a valid-looking promoted baseline without its
      // exact source comparison and candidate decision.
      await publishFile(
        promotionPath, `${JSON.stringify(proposal.promotion, null, 2)}\n`,
      );
      await publishFile(indexPath, `${JSON.stringify(proposal.baseline, null, 2)}\n`);
      return {
        mode: 'promote',
        ...proposal,
        changed: proposal.baseline.id !== baseline.id,
        outputDirectory,
        promotionPath,
        indexPath,
      };
    };
    return executeLockedPromotion().finally(releasePromotionLock);
  }
  throw new TypeError('mode must be accept, compare, or promote');
}

async function main() {
  const options = parseVisualLabBaselineArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }
  const result = await runVisualLabBaseline(options);
  let summary;
  if (result.mode === 'accept') {
    summary = {
      schema: result.baseline.schema,
      id: result.baseline.id,
      candidates: result.baseline.candidates.length,
      outputDirectory: result.outputDirectory,
    };
  } else if (result.mode === 'compare') {
    summary = {
      schema: result.comparison.schema,
      id: result.comparison.id,
      summary: result.comparison.summary,
      html: result.html,
      brief: result.brief,
      metrics: result.metricsPath,
      json: result.json,
    };
  } else {
    summary = {
      schema: result.promotion.schema,
      id: result.promotion.id,
      previousBaselineId: result.promotion.baseline.id,
      resultBaselineId: result.baseline.id,
      promoted: result.promotion.promoted.map(({ candidate }) => candidate),
      changed: result.changed,
      outputDirectory: result.outputDirectory,
    };
  }
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

if (path.resolve(process.argv[1] ?? '') === MODULE_PATH) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message ?? String(error)}\n`);
    process.exitCode = 1;
  });
}
