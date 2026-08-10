import { VISUAL_LAB_STATIC_CONTRACT } from './visual-lab-static-contract.js';

/**
 * Additive, data-only capture-driver metadata. The established Visual Lab v1
 * contract remains the closed normal-HDR shader registry; this sibling owns
 * review captures that drive an existing presentation control instead.
 */

const deepFreeze = (value) => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

const contract = {
  schema: 'anifor.visual-capture.static-contract/v1',
  evidencePlanes: [
    'atmosphere-alpha',
    'liquid-alpha',
    'emission-alpha',
    'powder-surface-alpha',
  ],
  drivers: [
    {
      name: 'normal-hdr',
      domains: [...VISUAL_LAB_STATIC_CONTRACT.captureDomainOrder],
      framebufferAlphaPolicy: 'exact',
      variants: [
        { name: 'off', selection: 0, label: 'OFF' },
        { name: 'a', selection: 1, label: 'A' },
        { name: 'b', selection: 2, label: 'B' },
      ],
    },
    {
      name: 'powder-render-style',
      domains: ['powder'],
      framebufferAlphaPolicy: 'style-owned-nonempty',
      variants: [
        { name: 'off', selection: 'smooth', label: 'Smooth' },
        { name: 'a', selection: 'local', label: 'Local' },
        { name: 'b', selection: 'grains', label: 'Grains' },
      ],
    },
    {
      name: 'material-lighting-profile',
      domains: ['material-lighting'],
      framebufferAlphaPolicy: 'exact',
      variants: [
        { name: 'off', selection: 0, label: 'Off' },
        { name: 'a', selection: 1, label: 'Balanced' },
        { name: 'b', selection: 2, label: 'Volumetric' },
      ],
    },
  ],
  extensionDomains: [
    {
      name: 'powder',
      targetKind: 'none',
      driver: 'powder-render-style',
      executionProfile: VISUAL_LAB_STATIC_CONTRACT.normalHdrExecutionProfile,
      evidence: { plane: 'powder-surface-alpha' },
      fixedUrlParameters: {},
    },
    {
      name: 'material-lighting',
      targetKind: 'none',
      driver: 'material-lighting-profile',
      executionProfile: VISUAL_LAB_STATIC_CONTRACT.normalHdrExecutionProfile,
      evidence: { plane: 'emission-alpha' },
      fixedUrlParameters: {},
    },
  ],
  fixtures: [
    {
      name: 'powder-style-atlas',
      scene: 'showcase',
      driver: 'powder-render-style',
      constraints: [{ domain: 'powder', targets: [0] }],
      preparationReportLabel: 'preparePowderStyleAtlasFixture',
      requirement: '--domain=powder --target=0',
    },
    {
      name: 'material-lighting-atlas',
      scene: 'showcase',
      driver: 'material-lighting-profile',
      constraints: [{ domain: 'material-lighting', targets: [0] }],
      preparationReportLabel: 'prepareMaterialLightingAtlasFixture',
      requirement: '--domain=material-lighting --target=0',
    },
  ],
  captureRecipes: [
    {
      name: 'powder-style-atlas',
      domain: 'powder',
      target: 0,
      fixture: 'powder-style-atlas',
      gain: 1,
      renderScale: 2,
    },
    {
      name: 'material-lighting-atlas',
      domain: 'material-lighting',
      target: 0,
      fixture: 'material-lighting-atlas',
      gain: 1,
      renderScale: 2,
    },
  ],
};

const SAFE_NAME = /^[a-z][a-z0-9-]*$/;
const CAPTURE_VARIANTS = ['off', 'a', 'b'];
const POWDER_STYLES = ['smooth', 'local', 'grains'];
const FRAMEBUFFER_ALPHA_POLICIES = new Set(['exact', 'style-owned-nonempty']);

const validateContract = (candidate) => {
  const evidencePlanes = new Set();
  for (const plane of candidate.evidencePlanes) {
    if (!SAFE_NAME.test(plane) || evidencePlanes.has(plane)) {
      throw new TypeError(`invalid or duplicate visual capture evidence plane ${JSON.stringify(plane)}`);
    }
    evidencePlanes.add(plane);
  }
  for (const domainName of VISUAL_LAB_STATIC_CONTRACT.captureDomainOrder) {
    const plane = VISUAL_LAB_STATIC_CONTRACT.domains.find(({ name }) => name === domainName)
      ?.evidence?.plane;
    if (!evidencePlanes.has(plane)) {
      throw new TypeError(`legacy Visual Lab evidence plane ${JSON.stringify(plane)} is missing`);
    }
  }

  const knownDomains = new Set([
    ...VISUAL_LAB_STATIC_CONTRACT.captureDomainOrder,
    ...candidate.extensionDomains.map(({ name }) => name),
  ]);
  const driverNames = new Set();
  for (const driver of candidate.drivers) {
    if (!SAFE_NAME.test(driver.name) || driverNames.has(driver.name)) {
      throw new TypeError(`invalid or duplicate visual capture driver ${JSON.stringify(driver.name)}`);
    }
    if (!FRAMEBUFFER_ALPHA_POLICIES.has(driver.framebufferAlphaPolicy)) {
      throw new TypeError(`invalid framebuffer-alpha policy for visual capture driver ${driver.name}`);
    }
    if (driver.variants.map(({ name }) => name).join(',') !== CAPTURE_VARIANTS.join(',')) {
      throw new TypeError(`visual capture driver ${driver.name} must define off, a, b in order`);
    }
    const supportedDomains = new Set();
    for (const domain of driver.domains) {
      if (!SAFE_NAME.test(domain) || !knownDomains.has(domain) || supportedDomains.has(domain)) {
        throw new TypeError(
          `visual capture driver ${driver.name} has an invalid or duplicate domain`,
        );
      }
      supportedDomains.add(domain);
    }
    driverNames.add(driver.name);
  }
  const normalDriver = candidate.drivers.find(({ name }) => name === 'normal-hdr');
  if (!normalDriver
    || normalDriver.variants.some(({ selection }, index) => selection !== index)) {
    throw new TypeError('normal-HDR capture must map off/A/B to exact selections 0/1/2');
  }
  const powderDriver = candidate.drivers.find(({ name }) => name === 'powder-render-style');
  if (!powderDriver
    || powderDriver.variants.map(({ selection }) => selection).join(',') !== POWDER_STYLES.join(',')) {
    throw new TypeError('powder render-style capture must map off/A/B to Smooth/Local/Grains');
  }
  const materialLightingDriver = candidate.drivers.find(
    ({ name }) => name === 'material-lighting-profile',
  );
  if (!materialLightingDriver
    || materialLightingDriver.variants.some(({ selection }, index) => selection !== index)) {
    throw new TypeError('material-lighting capture must map off/A/B to exact selections 0/1/2');
  }

  const extensionDomains = new Set();
  for (const domain of candidate.extensionDomains) {
    const defaultDriver = candidate.drivers.find(({ name }) => name === domain.driver);
    if (!SAFE_NAME.test(domain.name) || extensionDomains.has(domain.name)
      || !defaultDriver?.domains.includes(domain.name)
      || domain.executionProfile !== VISUAL_LAB_STATIC_CONTRACT.normalHdrExecutionProfile
      || domain.evidence === null
      || Reflect.ownKeys(domain.evidence).length !== 1
      || !evidencePlanes.has(domain.evidence.plane)) {
      throw new TypeError(`invalid visual capture extension domain ${JSON.stringify(domain.name)}`);
    }
    extensionDomains.add(domain.name);
  }
  const referencedEvidencePlanes = [...new Set([
    ...VISUAL_LAB_STATIC_CONTRACT.captureDomainOrder.map((domainName) => (
      VISUAL_LAB_STATIC_CONTRACT.domains.find(({ name }) => name === domainName).evidence.plane
    )),
    ...candidate.extensionDomains.map(({ evidence }) => evidence.plane),
  ])];
  if (candidate.evidencePlanes.length !== referencedEvidencePlanes.length
    || candidate.evidencePlanes.some((plane, index) => plane !== referencedEvidencePlanes[index])) {
    throw new TypeError('visual capture evidence planes must exactly match referenced domain order');
  }

  const fixtureNames = new Set();
  for (const fixture of candidate.fixtures) {
    const driver = candidate.drivers.find(({ name }) => name === fixture.driver);
    if (!SAFE_NAME.test(fixture.name) || fixtureNames.has(fixture.name) || !driver) {
      throw new TypeError(`invalid or duplicate visual capture fixture ${JSON.stringify(fixture.name)}`);
    }
    for (const constraint of fixture.constraints) {
      if (!knownDomains.has(constraint.domain)
        || !driver.domains.includes(constraint.domain)) {
        throw new TypeError(`visual capture fixture ${fixture.name} uses an unsupported domain`);
      }
    }
    fixtureNames.add(fixture.name);
  }

  for (const recipe of candidate.captureRecipes) {
    if (!fixtureNames.has(recipe.fixture) || !knownDomains.has(recipe.domain)) {
      throw new TypeError(`visual capture recipe ${recipe.name} is not backed by an extension fixture`);
    }
    const fixture = candidate.fixtures.find(({ name }) => name === recipe.fixture);
    const compatible = fixture.constraints.some(({ domain, targets }) => (
      domain === recipe.domain && (targets === null || targets.includes(recipe.target))
    ));
    if (!compatible) {
      throw new TypeError(`visual capture recipe ${recipe.name} is incompatible with its fixture`);
    }
  }
};

validateContract(contract);

export const VISUAL_CAPTURE_STATIC_CONTRACT = deepFreeze(contract);
