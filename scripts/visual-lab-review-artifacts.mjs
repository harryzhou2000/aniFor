import path from 'node:path';

const deepFreeze = (value) => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

const CURRENT_REVIEW_ARTIFACT_SOURCE = [
  {
    key: 'index',
    batchPathKey: 'indexPath',
    fileName: 'index.json',
    pair: null,
    kind: 'json',
    required: true,
    navigation: null,
  },
  {
    key: 'contactSheet',
    batchPathKey: 'contactSheetPath',
    fileName: 'index.html',
    pair: null,
    kind: 'html',
    required: true,
    navigation: {
      order: 3,
      label: 'Raw captures',
      description: 'the raw capture sheet',
    },
  },
  {
    key: 'response',
    batchPathKey: 'responsePath',
    fileName: 'experiment-response.json',
    pair: 'experimentResponse',
    kind: 'json',
    required: true,
    navigation: null,
  },
  {
    key: 'experimentBoard',
    batchPathKey: 'experimentBoardPath',
    fileName: 'experiment-board.html',
    pair: 'experimentResponse',
    kind: 'html',
    required: true,
    navigation: {
      order: 0,
      label: 'Experiment response',
      description: 'the experiment response board',
    },
  },
  {
    key: 'regionResponse',
    batchPathKey: 'regionResponsePath',
    fileName: 'region-response.json',
    pair: 'regionResponse',
    kind: 'json',
    required: false,
    navigation: null,
  },
  {
    key: 'regionResponseBoard',
    batchPathKey: 'regionResponseBoardPath',
    fileName: 'region-response.html',
    pair: 'regionResponse',
    kind: 'html',
    required: false,
    navigation: {
      order: 2,
      label: 'Region response',
      description: 'the region response board',
    },
  },
  {
    key: 'regionAppearance',
    batchPathKey: 'regionAppearancePath',
    fileName: 'region-appearance.json',
    pair: 'regionAppearance',
    kind: 'json',
    required: false,
    navigation: null,
  },
  {
    key: 'regionAppearanceBoard',
    batchPathKey: 'regionAppearanceBoardPath',
    fileName: 'region-appearance.html',
    pair: 'regionAppearance',
    kind: 'html',
    required: false,
    navigation: {
      order: 1,
      label: 'Region appearance',
      description: 'the region appearance board',
    },
  },
];

const SAFE_KEY = /^[a-z][A-Za-z0-9]*$/u;
const SAFE_TEXT = /^[A-Za-z][A-Za-z0-9 ()+./-]*$/u;
const SAFE_FILE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:json|html)$/u;
const REVIEW_ARTIFACT_KINDS = Object.freeze(['json', 'html']);

/**
 * Compiles the scripts-owned current-evidence lifecycle vocabulary. It owns
 * local filenames, pair membership, and navigation, but carries no callbacks,
 * absolute paths, capture authority, or portable evidence data.
 */
export function compileVisualLabCurrentReviewArtifactCatalog(source) {
  if (!Array.isArray(source) || source.length === 0) {
    throw new TypeError('Visual Lab current review artifact catalog must be nonempty');
  }
  const keys = new Set();
  const batchPathKeys = new Set();
  const fileNames = new Set();
  const labels = new Set();
  const navigationOrders = new Set();
  const compiled = source.map((entry) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new TypeError('Visual Lab current review artifact entry must be an object');
    }
    const expected = [
      'key', 'batchPathKey', 'fileName', 'pair', 'kind', 'required', 'navigation',
    ];
    const actual = Reflect.ownKeys(entry);
    if (actual.length !== expected.length || expected.some((key) => !actual.includes(key))) {
      throw new TypeError('Visual Lab current review artifact entry has unexpected fields');
    }
    if (typeof entry.key !== 'string' || !SAFE_KEY.test(entry.key)) {
      throw new TypeError('Visual Lab current review artifact key must be safe camel case');
    }
    if (typeof entry.batchPathKey !== 'string' || !SAFE_KEY.test(entry.batchPathKey)) {
      throw new TypeError('Visual Lab current review artifact batch path key must be safe camel case');
    }
    if (typeof entry.fileName !== 'string' || !SAFE_FILE_NAME.test(entry.fileName)
      || path.basename(entry.fileName) !== entry.fileName) {
      throw new TypeError('Visual Lab current review artifact filename must be safe and local');
    }
    if (!REVIEW_ARTIFACT_KINDS.includes(entry.kind)
      || !entry.fileName.endsWith(`.${entry.kind}`)) {
      throw new TypeError('Visual Lab current review artifact kind must match its filename');
    }
    if (entry.pair !== null && (typeof entry.pair !== 'string' || !SAFE_KEY.test(entry.pair))) {
      throw new TypeError('Visual Lab current review artifact pair must be safe camel case or null');
    }
    if (typeof entry.required !== 'boolean') {
      throw new TypeError('Visual Lab current review artifact required flag must be boolean');
    }
    if (keys.has(entry.key)) {
      throw new Error(`Duplicate Visual Lab current review artifact key ${JSON.stringify(entry.key)}`);
    }
    if (batchPathKeys.has(entry.batchPathKey)) {
      throw new Error(
        `Duplicate Visual Lab current review artifact batch path key ${JSON.stringify(entry.batchPathKey)}`,
      );
    }
    if (fileNames.has(entry.fileName)) {
      throw new Error(
        `Duplicate Visual Lab current review artifact filename ${JSON.stringify(entry.fileName)}`,
      );
    }
    keys.add(entry.key);
    batchPathKeys.add(entry.batchPathKey);
    fileNames.add(entry.fileName);
    if (entry.navigation !== null) {
      const navigation = entry.navigation;
      if (navigation === null || typeof navigation !== 'object' || Array.isArray(navigation)
        || Reflect.ownKeys(navigation).length !== 3
        || !['order', 'label', 'description'].every((key) => Object.hasOwn(navigation, key))) {
        throw new TypeError('Visual Lab current review artifact navigation must be null or exact');
      }
      if (!Number.isSafeInteger(navigation.order) || navigation.order < 0) {
        throw new TypeError('Visual Lab current review artifact navigation order must be nonnegative');
      }
      if (typeof navigation.label !== 'string' || !SAFE_TEXT.test(navigation.label)) {
        throw new TypeError('Visual Lab current review artifact label must be safe display text');
      }
      if (typeof navigation.description !== 'string' || !SAFE_TEXT.test(navigation.description)) {
        throw new TypeError('Visual Lab current review artifact description must be safe display text');
      }
      if (labels.has(navigation.label) || navigationOrders.has(navigation.order)) {
        throw new Error('Duplicate Visual Lab current review artifact navigation');
      }
      labels.add(navigation.label);
      navigationOrders.add(navigation.order);
    }
    return { ...entry, navigation: entry.navigation === null ? null : { ...entry.navigation } };
  });
  const orderedNavigation = [...navigationOrders].sort((left, right) => left - right);
  if (orderedNavigation.some((order, index) => order !== index)) {
    throw new Error('Visual Lab current review artifact navigation order must be contiguous');
  }
  const pairs = [...new Set(compiled.flatMap(({ pair }) => pair === null ? [] : [pair]))];
  for (const pair of pairs) {
    const members = compiled.filter((entry) => entry.pair === pair);
    if (members.length !== 2
      || REVIEW_ARTIFACT_KINDS.some((kind) => (
        members.filter((entry) => entry.kind === kind).length !== 1
      ))
      || members[0].required !== members[1].required) {
      throw new Error(
        `Visual Lab current review artifact pair ${JSON.stringify(pair)}`
        + ' must contain matching JSON and HTML members',
      );
    }
  }
  return deepFreeze(compiled);
}

export const VISUAL_LAB_CURRENT_REVIEW_ARTIFACTS =
  compileVisualLabCurrentReviewArtifactCatalog(CURRENT_REVIEW_ARTIFACT_SOURCE);

/**
 * Derives each JSON/HTML evidence product from the artifact catalog. The pair
 * name owns its historical verifier option while the JSON artifact owns the
 * batch value key; executable reconstruction and rendering stay elsewhere.
 */
export function compileVisualLabCurrentEvidencePairCatalog(artifacts) {
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    throw new TypeError('Visual Lab current evidence pairs require an artifact catalog');
  }
  const pairNames = [...new Set(artifacts.flatMap(({ pair }) => pair === null ? [] : [pair]))];
  return deepFreeze(pairNames.map((key) => {
    if (typeof key !== 'string' || !SAFE_KEY.test(key)) {
      throw new TypeError('Visual Lab current evidence pair key must be safe camel case');
    }
    const members = artifacts.filter(({ pair }) => pair === key);
    const json = members.find(({ kind }) => kind === 'json');
    const html = members.find(({ kind }) => kind === 'html');
    if (members.length !== 2 || json === undefined || html === undefined
      || json.required !== html.required) {
      throw new TypeError(
        `Visual Lab current evidence pair ${JSON.stringify(key)}`
        + ' must contain matching JSON and HTML artifacts',
      );
    }
    return {
      key,
      batchValueKey: json.key,
      jsonPathKey: json.batchPathKey,
      htmlPathKey: html.batchPathKey,
      requirementOptionKey: `require${key[0].toUpperCase()}${key.slice(1)}`,
      required: json.required,
    };
  }));
}

export const VISUAL_LAB_CURRENT_EVIDENCE_PAIRS =
  compileVisualLabCurrentEvidencePairCatalog(VISUAL_LAB_CURRENT_REVIEW_ARTIFACTS);

/** Resolves every current-evidence filename below one already-trusted batch root. */
export function resolveVisualLabCurrentReviewArtifactPaths(batchRoot) {
  if (typeof batchRoot !== 'string' || batchRoot.length === 0 || !path.isAbsolute(batchRoot)) {
    throw new TypeError('Visual Lab current review artifact root must be absolute');
  }
  return deepFreeze(Object.fromEntries(VISUAL_LAB_CURRENT_REVIEW_ARTIFACTS.map((artifact) => (
    [artifact.batchPathKey, path.join(batchRoot, artifact.fileName)]
  ))));
}

/** Complete publish-marker invalidation set, including atomic-write staging files. */
export function visualLabCurrentReviewArtifactInvalidationPaths(batchRoot) {
  const artifactPaths = Object.values(resolveVisualLabCurrentReviewArtifactPaths(batchRoot));
  return Object.freeze([
    ...artifactPaths,
    ...artifactPaths.map((artifactPath) => `${artifactPath}.tmp`),
  ]);
}

/** Projects the capture batch's existing paths into the public review result. */
export function projectVisualLabCurrentReviewArtifacts(batch) {
  if (batch === null || typeof batch !== 'object' || Array.isArray(batch)) {
    throw new TypeError('Visual Lab current review artifacts require a capture batch');
  }
  return deepFreeze(Object.fromEntries(VISUAL_LAB_CURRENT_REVIEW_ARTIFACTS.map((artifact) => {
    const value = batch[artifact.batchPathKey];
    if (value === null || value === undefined) {
      if (artifact.required) {
        throw new Error(`Visual Lab capture batch did not return ${artifact.batchPathKey}`);
      }
      return [artifact.key, null];
    }
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError(`Visual Lab capture batch returned invalid ${artifact.batchPathKey}`);
    }
    return [artifact.key, value];
  })));
}

/** Selects only artifacts actually produced, while enforcing required links. */
export function resolveVisualLabCurrentReviewArtifacts(batch) {
  if (batch === null || typeof batch !== 'object' || Array.isArray(batch)) {
    throw new TypeError('Visual Lab current review artifacts require a batch result');
  }
  const resolved = [];
  const navigable = VISUAL_LAB_CURRENT_REVIEW_ARTIFACTS
    .filter(({ navigation }) => navigation !== null)
    .sort((left, right) => left.navigation.order - right.navigation.order);
  for (const artifact of navigable) {
    const value = batch[artifact.key];
    if (value === null || value === undefined) {
      if (artifact.required) {
        throw new Error(`Visual Lab current review did not return ${artifact.navigation.description}`);
      }
      continue;
    }
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError(
        `Visual Lab current review returned invalid ${artifact.navigation.description}`,
      );
    }
    resolved.push({
      key: artifact.key,
      label: artifact.navigation.label,
      description: artifact.navigation.description,
      path: value,
    });
  }
  return deepFreeze(resolved);
}
