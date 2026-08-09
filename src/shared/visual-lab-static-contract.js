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

const contract = {
  schema: 'anifor.visual-lab.static-contract/v1',
  domainCodes: {
    off: 0,
    powder: 1,
    liquid: 2,
    gas: 3,
    emission: 4,
  },
  domains: [
    {
      name: 'off',
      code: 0,
      implemented: false,
      targetKind: 'none',
      executionProfile: null,
      evidence: null,
      fixedUrlParameters: {},
    },
    {
      name: 'powder',
      code: 1,
      implemented: false,
      targetKind: 'semantic-material-id',
      executionProfile: null,
      evidence: null,
      fixedUrlParameters: {},
    },
    {
      name: 'liquid',
      code: 2,
      implemented: true,
      targetKind: 'semantic-material-id',
      executionProfile: normalHdrExecutionProfile,
      evidence: { readerMethod: 'liquidFieldAlpha', plane: 'liquid-alpha' },
      fixedUrlParameters: { liquidBodyVfx: '1', liquidSurfaceVfx: '1' },
    },
    {
      name: 'gas',
      code: 3,
      implemented: true,
      targetKind: 'propagated-atmosphere-style-byte',
      executionProfile: normalHdrExecutionProfile,
      evidence: { readerMethod: 'atmosphereFieldAlpha', plane: 'atmosphere-alpha' },
      fixedUrlParameters: {},
    },
    {
      name: 'emission',
      code: 4,
      implemented: true,
      targetKind: 'semantic-material-id',
      executionProfile: normalHdrExecutionProfile,
      evidence: { readerMethod: 'emissionFieldAlpha', plane: 'emission-alpha' },
      fixedUrlParameters: {},
    },
  ],
  captureDomainOrder: ['gas', 'liquid', 'emission'],
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
};

const SAFE_NAME = /^[a-z][a-z0-9-]*$/;

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
  }
};

validateContract(contract);

export const VISUAL_LAB_STATIC_CONTRACT = deepFreeze(contract);
