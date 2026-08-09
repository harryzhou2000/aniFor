import { createHash } from 'node:crypto';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import {
  buildVisualCaptureDatasetProjectionExpression,
  buildVisualCaptureSelectionExpression,
  resolveVisualCaptureVariant,
  visualCaptureDriverDatasetExpectation,
  visualCaptureDriverPublishesReportDescriptor,
  visualCaptureDriverReportFields,
  visualCaptureDriverStartupFields,
} from './visual-capture-drivers.mjs';
import { buildVisualCaptureEvidenceReaderExpression } from './visual-capture-evidence.mjs';
import {
  VISUAL_LAB_CAPTURE_VARIANTS,
  VISUAL_LAB_CAPTURE_VARIANT_NAMES,
} from './visual-lab-capture-abi.mjs';
import {
  buildVisualLabCaptureUrlFromResolvedRequest,
  buildVisualLabStartupExpression,
  resolveVisualCaptureRequest,
  VISUAL_LAB_CAPTURE_PROTOCOL,
  visualLabFixturePreparationLabel,
} from './visual-lab-fixtures.mjs';
import {
  createVisualLabRecipeSet,
  normalizeVisualLabRecipeSet,
} from './visual-lab-recipe-set.mjs';
import { resolveVisualLabCaptureRecipe } from './visual-lab-recipes.mjs';
import {
  normalizeVisualLabResultRequest,
  VISUAL_LAB_RESULT_SCHEMA,
} from './visual-lab-result.mjs';

export const VISUAL_LAB_EXECUTION_PLAN_SCHEMA = 'anifor.visual-capture.execution-plan/v1';

export const VISUAL_LAB_CANDIDATE_GENERATED_FILES = Object.freeze([
  'off.png', 'a.png', 'b.png', 'report.json', 'stdout.log', 'stderr.log',
]);

const LIFECYCLE_FILE_NAME = 'chrome-lifecycle.json';
const SAFE_CANDIDATE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const deepFreeze = (value) => {
  if (value === null || typeof value !== 'object') return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.isFrozen(value) ? value : Object.freeze(value);
};

const digest = (value) => `sha256:${createHash('sha256')
  .update(JSON.stringify(value), 'utf8').digest('hex')}`;

export const visualLabRequestForRecipe = (recipe) => normalizeVisualLabResultRequest({
  domain: recipe.domain,
  target: recipe.target,
  fixture: recipe.fixture,
  gain: recipe.gain,
  renderScale: recipe.renderScale,
});

export const visualLabCandidateRelativeRoot = (candidate) => {
  if (typeof candidate !== 'string' || !SAFE_CANDIDATE.test(candidate)) {
    throw new TypeError(`Invalid Visual Lab candidate ${JSON.stringify(candidate)}`);
  }
  return `candidates/${candidate}`;
};

export const visualLabPassedArtifacts = (candidate) => {
  const root = visualLabCandidateRelativeRoot(candidate);
  return Object.freeze({
    report: `${root}/report.json`,
    off: `${root}/off.png`,
    a: `${root}/a.png`,
    b: `${root}/b.png`,
  });
};

export const visualLabFailedArtifacts = (candidate) => Object.freeze({
  diagnostic: `${visualLabCandidateRelativeRoot(candidate)}/failure.log`,
});

const inspectArtifacts = (candidate) => {
  const root = visualLabCandidateRelativeRoot(candidate);
  return deepFreeze({
    root,
    report: `${root}/report.json`,
    captures: Object.fromEntries(VISUAL_LAB_CAPTURE_VARIANT_NAMES.map((variant) => (
      [variant, `${root}/${variant}.png`]
    ))),
    failure: `${root}/failure.log`,
    stdout: `${root}/stdout.log`,
    stderr: `${root}/stderr.log`,
  });
};

const executionPolicyFor = (gpuMode) => deepFreeze({
  gpuMode,
  browserHost: 'fresh-per-candidate',
  candidateIsolation: 'fresh-browser',
  targetCreation: 'direct-url',
  teardown: 'browser-close',
  hostReuse: 'disabled',
  minimumFutureReuseIsolation: 'fresh-context',
  futureReuseTeardown: Object.freeze(['renderer-dispose', 'context-close']),
  futureHostRecycleOn: Object.freeze([
    'timeout', 'context-loss', 'backend-fallback', 'browser-error', 'teardown-failure',
  ]),
  freshBrowserOnly: Object.freeze(['true-8x', 'context-loss-recovery']),
});

const canonicalCaptureQuery = (captureUrl, domainAdapter) => {
  const names = [
    ...Object.keys(VISUAL_LAB_CAPTURE_PROTOCOL.fixedUrlParameters),
    ...VISUAL_LAB_CAPTURE_PROTOCOL.dynamicUrlParameterNames,
    ...Object.keys(domainAdapter.fixedUrlParameters).sort(),
  ];
  const canonical = new URLSearchParams();
  for (const name of names) {
    if (captureUrl.searchParams.has(name)) canonical.set(name, captureUrl.searchParams.get(name));
  }
  return canonical.toString();
};

const inspectExecutableAuthority = (compiled) => digest({
  startup: compiled.startupExpression,
  datasetProjection: compiled.datasetProjectionExpression,
  evidenceReader: compiled.evidenceReaderExpression,
  selections: compiled.variants.map(({ name, value, selectionExpression }) => ({
    name, value, selectionExpression,
  })),
});

/**
 * Preserves the existing batch selection rules while making the selected
 * recipe-set record part of the plan consumed by capture execution.
 */
export function resolveVisualLabExecutionRecipeSet(options = {}) {
  if (options.recipeSet !== undefined && options.candidates !== undefined) {
    throw new TypeError('Visual Lab batch recipeSet and candidates are mutually exclusive');
  }
  if (options.recipeSet !== undefined) return normalizeVisualLabRecipeSet(options.recipeSet);
  if (options.candidates !== undefined) {
    const seen = new Set();
    for (const candidate of options.candidates) {
      const recipe = resolveVisualLabCaptureRecipe(candidate);
      if (seen.has(recipe.name)) throw new Error(`Duplicate --candidates entry ${recipe.name}`);
      seen.add(recipe.name);
    }
  }
  return createVisualLabRecipeSet(
    options.candidates === undefined ? 'full-catalog' : 'ad-hoc',
    options.candidates,
  );
}

const compileEntry = (
  { candidate, recipe, request, artifactKey, resolved, executionPolicy },
  baseUrl,
  artifactRoot,
) => {
  const { domainAdapter, fixtureAdapter, captureDriver } = resolved;
  if (!domainAdapter.executionProfile.detailScales.includes(request.renderScale)) {
    throw new Error(
      `--render-scale for ${request.domain} must be ${
        domainAdapter.executionProfile.detailScales.join(', ')
      }; unsupported paths preserve the baseline`,
    );
  }

  const captureUrl = buildVisualLabCaptureUrlFromResolvedRequest(baseUrl, request, resolved);
  const compiledVariants = VISUAL_LAB_CAPTURE_VARIANTS.map((abiVariant) => {
    const driverVariant = resolveVisualCaptureVariant(captureDriver, abiVariant.name);
    return Object.freeze({
      name: abiVariant.name,
      value: abiVariant.value,
      driverVariant,
      selectionExpression: buildVisualCaptureSelectionExpression(
        captureDriver, abiVariant.value, { fixtureId: fixtureAdapter.name },
      ),
      expectedDataset: visualCaptureDriverDatasetExpectation(
        captureDriver, request, abiVariant.value,
      ),
    });
  });
  const compiled = deepFreeze({
    url: captureUrl.href,
    startupExpression: buildVisualLabStartupExpression(fixtureAdapter, 2, captureDriver),
    startupFields: visualCaptureDriverStartupFields(captureDriver, 2),
    reportFields: visualCaptureDriverReportFields(captureDriver),
    datasetProjectionExpression: buildVisualCaptureDatasetProjectionExpression(captureDriver),
    evidenceReaderExpression: buildVisualCaptureEvidenceReaderExpression(
      domainAdapter.evidence.plane,
    ),
    variants: compiledVariants,
  });

  const relativeArtifacts = inspectArtifacts(artifactKey);
  const preparationLabel = visualLabFixturePreparationLabel(fixtureAdapter);
  const inspectionIdentity = deepFreeze({
    candidate,
    request,
    domain: {
      name: domainAdapter.name,
      targetKind: domainAdapter.targetKind,
      evidence: { plane: domainAdapter.evidence.plane },
      executionProfile: domainAdapter.executionProfile,
      fixedUrlParameters: domainAdapter.fixedUrlParameters,
    },
    fixture: {
      name: fixtureAdapter.name,
      scene: fixtureAdapter.scene,
      preparation: fixtureAdapter.preparation === null
        ? { kind: 'scene', reportLabel: preparationLabel }
        : {
            kind: 'prepared-fixture',
            fixtureId: fixtureAdapter.name,
            reportLabel: preparationLabel,
          },
    },
    driver: {
      name: captureDriver.name,
      framebufferAlphaPolicy: captureDriver.framebufferAlphaPolicy,
      publishesReportDescriptor: visualCaptureDriverPublishesReportDescriptor(captureDriver),
      variants: compiledVariants.map(({ name, value, driverVariant, expectedDataset }) => ({
        name,
        value,
        selection: driverVariant.selection,
        label: driverVariant.label,
        dataset: expectedDataset,
      })),
    },
    canonicalQuery: canonicalCaptureQuery(captureUrl, domainAdapter),
    executableDigest: inspectExecutableAuthority(compiled),
    artifacts: relativeArtifacts,
    resultIdentityInput: {
      schema: VISUAL_LAB_RESULT_SCHEMA,
      candidate,
      request,
      captureKeys: VISUAL_LAB_CAPTURE_VARIANT_NAMES,
      status: 'pending-capture-sha256',
    },
  });
  const inspection = deepFreeze({
    id: digest({
      schema: VISUAL_LAB_EXECUTION_PLAN_SCHEMA,
      entry: inspectionIdentity,
      executionPolicy,
    }),
    ...inspectionIdentity,
  });
  const runtimeArtifacts = deepFreeze({
    report: path.join(artifactRoot, 'report.json'),
    captures: Object.fromEntries(VISUAL_LAB_CAPTURE_VARIANT_NAMES.map((variant) => (
      [variant, path.join(artifactRoot, `${variant}.png`)]
    ))),
    failure: path.join(artifactRoot, 'failure.log'),
    stdout: path.join(artifactRoot, 'stdout.log'),
    stderr: path.join(artifactRoot, 'stderr.log'),
  });

  return deepFreeze({
    candidate,
    recipe,
    request,
    domainAdapter,
    fixtureAdapter,
    captureDriver,
    compiled,
    inspection,
    runtime: {
      url: captureUrl.href,
      artifactRoot,
      artifacts: runtimeArtifacts,
      lifecycleFile: path.join(artifactRoot, LIFECYCLE_FILE_NAME),
    },
  });
};

const normalizeBaseUrl = (value) => {
  let url;
  try { url = new URL(value ?? 'http://127.0.0.1:5173/'); }
  catch { throw new TypeError('Visual Lab execution plan baseUrl must be an absolute URL'); }
  if (!['http:', 'https:', 'file:'].includes(url.protocol)) {
    throw new TypeError('Visual Lab execution plan baseUrl must use HTTP, HTTPS, or file');
  }
  if (url.search !== '' || url.hash !== '') {
    throw new TypeError(
      'Visual Lab execution plan baseUrl must not include a query or fragment;'
      + ' capture state is plan-owned',
    );
  }
  return url;
};

/** Compiles one named or ad-hoc request into all pre-Chrome executable state. */
export function createVisualCaptureExecutionEntry(options = {}) {
  const candidate = options.candidate ?? null;
  const requested = options.request;
  const resolved = resolveVisualCaptureRequest(requested);
  const renderScale = requested?.renderScale ?? (
    resolved.domainAdapter.executionProfile.detailScales.includes(2)
      ? 2 : resolved.domainAdapter.executionProfile.detailScales[0]
  );
  const request = normalizeVisualLabResultRequest({ ...requested, renderScale });
  const gpuMode = options.gpu ?? 'auto';
  if (gpuMode !== 'auto' && gpuMode !== 'swiftshader') {
    throw new TypeError('Visual Lab execution plan gpu must be auto or swiftshader');
  }
  const executionPolicy = executionPolicyFor(gpuMode);
  let recipe = null;
  if (candidate !== null) {
    recipe = resolveVisualLabCaptureRecipe(candidate);
    if (!isDeepStrictEqual(request, visualLabRequestForRecipe(recipe))) {
      throw new TypeError(
        `Named Visual Lab capture ${JSON.stringify(candidate)} must exactly match its recipe`,
      );
    }
  }
  const artifactKey = candidate ?? options.artifactKey
    ?? `${request.domain}-${request.fixture}`;
  const outputDirectory = path.resolve(
    options.outputDir ?? path.join(process.cwd(), 'visual-lab-plan-output'),
  );
  const artifactRoot = path.resolve(options.artifactRoot ?? path.join(
    outputDirectory, ...inspectArtifacts(artifactKey).root.split('/'),
  ));
  return compileEntry(
    { candidate, recipe, request, artifactKey, resolved, executionPolicy },
    normalizeBaseUrl(options.baseUrl),
    artifactRoot,
  );
}

/**
 * Compiles every selected recipe before filesystem mutation or browser launch.
 * Browser expressions remain in the private execution entries; the inspection
 * record is JSON-safe, portable, and contains data only.
 */
export function createVisualLabExecutionPlan(options = {}) {
  const recipeSet = resolveVisualLabExecutionRecipeSet(options);
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const gpuMode = options.gpu ?? 'auto';
  if (gpuMode !== 'auto' && gpuMode !== 'swiftshader') {
    throw new TypeError('Visual Lab execution plan gpu must be auto or swiftshader');
  }
  const executionPolicy = executionPolicyFor(gpuMode);
  const outputDirectory = path.resolve(
    options.outputDir ?? path.join(process.cwd(), 'visual-lab-plan-output'),
  );
  const recipes = recipeSet.recipes.map(({ name }) => resolveVisualLabCaptureRecipe(name));
  const entries = Object.freeze(recipes.map((recipe) => createVisualCaptureExecutionEntry({
    candidate: recipe.name,
    request: visualLabRequestForRecipe(recipe),
    baseUrl,
    outputDir: outputDirectory,
    artifactRoot: path.join(
      outputDirectory, ...visualLabCandidateRelativeRoot(recipe.name).split('/'),
    ),
    gpu: gpuMode,
  })));

  const identity = deepFreeze({
    schema: VISUAL_LAB_EXECUTION_PLAN_SCHEMA,
    recipeSet: {
      schema: recipeSet.schema,
      id: recipeSet.id,
      name: recipeSet.name,
    },
    summary: { selected: entries.length },
    variants: VISUAL_LAB_CAPTURE_VARIANT_NAMES,
    executionPolicy,
    entries: entries.map(({ inspection }) => inspection),
  });
  const inspection = deepFreeze({
    schema: identity.schema,
    id: digest(identity),
    recipeSet: identity.recipeSet,
    summary: identity.summary,
    variants: identity.variants,
    executionPolicy: identity.executionPolicy,
    entries: identity.entries,
  });
  const runtime = deepFreeze({
    baseUrl: baseUrl.href,
    outputDir: outputDirectory,
    gpu: gpuMode,
    candidateTimeoutMs: options.candidateTimeoutMs ?? null,
    chrome: options.chrome ?? null,
    entries: entries.map(({ candidate, runtime }) => ({ candidate, ...runtime })),
  });

  return deepFreeze({ recipeSet, entries, inspection, runtime });
}
