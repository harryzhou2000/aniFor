/**
 * Cross-runtime static metadata shared by the browser renderer and Node review
 * tooling. Keep this module data-only: executable fixture preparation remains
 * app-owned, and capture/build logic remains in scripts/.
 */

const deepFreeze = (value) => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

const normalHdrExecutionProfile = {
  detailScales: [1, 2, 4],
  backend: 'webgl',
  pipeline: 'normal-hdr',
  variantZero: 'pixel-preserving-baseline',
  fallbacks: {
    classic: 'disabled-preserve-baseline',
    canvas2d: 'disabled-preserve-baseline',
    hdrUnavailable: 'disabled-preserve-baseline',
    detail8x: 'disabled-preserve-baseline',
  },
};

/**
 * Private authoring rows own stable shader codes and independent capture order
 * once. `captureOrder` is stripped from the public static contract.
 */
const DOMAIN_AUTHORING_ROWS = [
  {
    name: 'off',
    code: 0,
    implemented: false,
    targetKind: 'none',
    executionProfile: null,
    evidence: null,
    fixedUrlParameters: {},
    captureOrder: null,
  },
  {
    name: 'powder',
    code: 1,
    implemented: false,
    targetKind: 'semantic-material-id',
    executionProfile: null,
    evidence: null,
    fixedUrlParameters: {},
    captureOrder: null,
  },
  {
    name: 'liquid',
    code: 2,
    implemented: true,
    targetKind: 'semantic-material-id',
    executionProfile: normalHdrExecutionProfile,
    evidence: { readerMethod: 'liquidFieldAlpha', plane: 'liquid-alpha' },
    fixedUrlParameters: { liquidBodyVfx: '1', liquidSurfaceVfx: '1' },
    captureOrder: 1,
  },
  {
    name: 'gas',
    code: 3,
    implemented: true,
    targetKind: 'propagated-atmosphere-style-byte',
    executionProfile: normalHdrExecutionProfile,
    evidence: { readerMethod: 'atmosphereFieldAlpha', plane: 'atmosphere-alpha' },
    fixedUrlParameters: {},
    captureOrder: 0,
  },
  {
    name: 'emission',
    code: 4,
    implemented: true,
    targetKind: 'semantic-material-id',
    executionProfile: normalHdrExecutionProfile,
    evidence: { readerMethod: 'emissionFieldAlpha', plane: 'emission-alpha' },
    fixedUrlParameters: {},
    captureOrder: 2,
  },
];

const captureRanks = DOMAIN_AUTHORING_ROWS
  .filter(({ captureOrder }) => captureOrder !== null)
  .map(({ captureOrder }) => captureOrder)
  .sort((left, right) => left - right);
if (DOMAIN_AUTHORING_ROWS.some(({ code }, index) => code !== index)
  || captureRanks.some((rank, index) => rank !== index)) {
  throw new TypeError('Visual Lab domain codes and capture ranks must be unique dense append-only values');
}

const domainCodes = Object.fromEntries(
  DOMAIN_AUTHORING_ROWS.map(({ name, code }) => [name, code]),
);
const domains = DOMAIN_AUTHORING_ROWS.map(({ captureOrder: _captureOrder, ...domain }) => domain);
const captureDomainOrder = DOMAIN_AUTHORING_ROWS
  .filter(({ captureOrder }) => captureOrder !== null)
  .sort((left, right) => left.captureOrder - right.captureOrder)
  .map(({ name }) => name);

const contract = {
  schema: 'anifor.visual-lab.static-contract/v1',
  domainCodes,
  domains,
  captureDomainOrder,
  normalHdrExecutionProfile,
  fixtures: [
    {
      name: 'showcase',
      scene: 'showcase',
      constraints: [
        { domain: 'gas', targets: null },
        { domain: 'liquid', targets: null },
        { domain: 'emission', targets: null },
      ],
      preparationReportLabel: null,
      requirement: null,
    },
    {
      name: 'oil-motion',
      scene: 'showcase',
      constraints: [{ domain: 'liquid', targets: [8] }],
      preparationReportLabel: 'prepareOilMotionVfxFixture',
      requirement: '--domain=liquid --target=8',
    },
    {
      name: 'water-motion',
      scene: 'showcase',
      constraints: [{ domain: 'liquid', targets: [2] }],
      preparationReportLabel: 'prepareLiquidMotionVfxFixture',
      requirement: '--domain=liquid --target=2',
    },
  ],
  captureRecipes: [
    {
      name: 'gas-showcase',
      domain: 'gas',
      target: 0,
      fixture: 'showcase',
      gain: 1,
      renderScale: 2,
    },
    {
      name: 'oxygen-showcase',
      domain: 'gas',
      target: 4,
      fixture: 'showcase',
      gain: 1,
      renderScale: 2,
    },
    {
      name: 'oil-motion',
      domain: 'liquid',
      target: 8,
      fixture: 'oil-motion',
      gain: 1,
      renderScale: 2,
    },
    {
      name: 'water-motion',
      domain: 'liquid',
      target: 2,
      fixture: 'water-motion',
      gain: 1,
      renderScale: 2,
    },
  ],
};

const SAFE_NAME = /^[a-z][a-z0-9-]*$/;
const SAFE_RECIPE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CAPTURE_RECIPE_FIELDS = [
  'name', 'domain', 'target', 'fixture', 'gain', 'renderScale',
];
const CAPTURE_RECIPE_FIELD_SET = new Set(CAPTURE_RECIPE_FIELDS);

const validateContract = (candidate) => {
  const names = new Set();
  const codes = new Set();
  for (const domain of candidate.domains) {
    if (!SAFE_NAME.test(domain.name) || names.has(domain.name)) {
      throw new TypeError(`invalid or duplicate Visual Lab domain ${JSON.stringify(domain.name)}`);
    }
    if (!Number.isInteger(domain.code) || codes.has(domain.code)) {
      throw new TypeError(`invalid or duplicate Visual Lab domain code ${domain.code}`);
    }
    if (candidate.domainCodes[domain.name] !== domain.code) {
      throw new TypeError(`Visual Lab domain code mismatch for ${domain.name}`);
    }
    if (domain.implemented !== (domain.executionProfile !== null)
      || domain.implemented !== (domain.evidence !== null)) {
      throw new TypeError(`Visual Lab domain ${domain.name} has inconsistent implementation metadata`);
    }
    if (domain.implemented && domain.executionProfile !== candidate.normalHdrExecutionProfile) {
      throw new TypeError(`Visual Lab domain ${domain.name} must use the shared execution profile`);
    }
    names.add(domain.name);
    codes.add(domain.code);
  }
  if (Object.keys(candidate.domainCodes).length !== names.size) {
    throw new TypeError('Visual Lab domain code map must exactly match the domain catalog');
  }

  const implemented = new Set(
    candidate.domains.filter(({ implemented: active }) => active).map(({ name }) => name),
  );
  const captureDomains = new Set(candidate.captureDomainOrder);
  if (captureDomains.size !== candidate.captureDomainOrder.length
    || captureDomains.size !== implemented.size
    || [...captureDomains].some((name) => !implemented.has(name))) {
    throw new TypeError('Visual Lab capture order must contain every implemented domain exactly once');
  }
  if (candidate.captureDomainOrder.some((name) => (
    candidate.domains.find((domain) => domain.name === name)?.evidence === null
  ))) {
    throw new TypeError('Every Visual Lab capture domain must declare field evidence');
  }

  const fixtures = new Set();
  const fixtureConstraints = new Map();
  for (const fixture of candidate.fixtures) {
    if (!SAFE_NAME.test(fixture.name) || fixtures.has(fixture.name)) {
      throw new TypeError(`invalid or duplicate Visual Lab fixture ${JSON.stringify(fixture.name)}`);
    }
    for (const constraint of fixture.constraints) {
      if (!implemented.has(constraint.domain)) {
        throw new TypeError(
          `Visual Lab fixture ${fixture.name} uses unimplemented domain ${constraint.domain}`,
        );
      }
      if (constraint.targets !== null && constraint.targets.some((target) => (
        !Number.isInteger(target) || target < 0 || target > 255
      ))) {
        throw new TypeError(`Visual Lab fixture ${fixture.name} has an invalid target`);
      }
    }
    fixtures.add(fixture.name);
    fixtureConstraints.set(fixture.name, fixture.constraints);
  }

  const recipeNames = new Set();
  for (const recipe of candidate.captureRecipes) {
    const keys = Reflect.ownKeys(recipe);
    if (keys.length !== CAPTURE_RECIPE_FIELDS.length
      || CAPTURE_RECIPE_FIELDS.some((field) => !Object.hasOwn(recipe, field))
      || keys.some((field) => typeof field !== 'string' || !CAPTURE_RECIPE_FIELD_SET.has(field))) {
      throw new TypeError('Visual Lab capture recipe must define the exact stable descriptor fields');
    }
    if (!SAFE_RECIPE_NAME.test(recipe.name) || recipeNames.has(recipe.name)) {
      throw new TypeError(`invalid or duplicate Visual Lab capture recipe ${JSON.stringify(recipe.name)}`);
    }
    if (!captureDomains.has(recipe.domain)) {
      throw new TypeError(`Visual Lab capture recipe ${recipe.name} uses uncapturable domain ${recipe.domain}`);
    }
    if (!Number.isInteger(recipe.target) || recipe.target < 0 || recipe.target > 255) {
      throw new TypeError(`Visual Lab capture recipe ${recipe.name} has an invalid target`);
    }
    if (!Number.isFinite(recipe.gain) || recipe.gain <= 0 || recipe.gain > 2) {
      throw new TypeError(`Visual Lab capture recipe ${recipe.name} has an invalid gain`);
    }
    if (!candidate.normalHdrExecutionProfile.detailScales.includes(recipe.renderScale)) {
      throw new TypeError(`Visual Lab capture recipe ${recipe.name} has an unsupported render scale`);
    }
    const constraints = fixtureConstraints.get(recipe.fixture);
    if (!constraints) {
      throw new TypeError(`Visual Lab capture recipe ${recipe.name} uses unknown fixture ${recipe.fixture}`);
    }
    const compatible = constraints.some((constraint) => (
      constraint.domain === recipe.domain
      && (constraint.targets === null || constraint.targets.includes(recipe.target))
    ));
    if (!compatible) {
      throw new TypeError(`Visual Lab capture recipe ${recipe.name} is incompatible with fixture ${recipe.fixture}`);
    }
    recipeNames.add(recipe.name);
  }
};

validateContract(contract);

export const VISUAL_LAB_STATIC_CONTRACT = deepFreeze(contract);
