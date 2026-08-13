const deepFreeze = (value) => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

const CURRENT_REVIEW_ARTIFACT_SOURCE = [
  {
    key: 'index',
    batchPathKey: 'indexPath',
    required: true,
    navigation: null,
  },
  {
    key: 'contactSheet',
    batchPathKey: 'contactSheetPath',
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
    required: true,
    navigation: null,
  },
  {
    key: 'experimentBoard',
    batchPathKey: 'experimentBoardPath',
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
    required: false,
    navigation: null,
  },
  {
    key: 'regionResponseBoard',
    batchPathKey: 'regionResponseBoardPath',
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
    required: false,
    navigation: null,
  },
  {
    key: 'regionAppearanceBoard',
    batchPathKey: 'regionAppearanceBoardPath',
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

/**
 * Compiles the scripts-owned navigation vocabulary. This is presentation-only:
 * it carries no paths, callbacks, capture authority, or portable evidence data.
 */
export function compileVisualLabCurrentReviewArtifactCatalog(source) {
  if (!Array.isArray(source) || source.length === 0) {
    throw new TypeError('Visual Lab current review artifact catalog must be nonempty');
  }
  const keys = new Set();
  const batchPathKeys = new Set();
  const labels = new Set();
  const navigationOrders = new Set();
  const compiled = source.map((entry) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new TypeError('Visual Lab current review artifact entry must be an object');
    }
    const expected = ['key', 'batchPathKey', 'required', 'navigation'];
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
    keys.add(entry.key);
    batchPathKeys.add(entry.batchPathKey);
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
  return deepFreeze(compiled);
}

export const VISUAL_LAB_CURRENT_REVIEW_ARTIFACTS =
  compileVisualLabCurrentReviewArtifactCatalog(CURRENT_REVIEW_ARTIFACT_SOURCE);

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
