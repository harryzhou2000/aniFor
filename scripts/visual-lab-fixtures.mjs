/**
 * Declarative adapters between the generic Visual Lab capture protocol and
 * app-owned deterministic fixtures. Adding a fixture belongs here; the CDP
 * harness must not grow another fixture-specific branch.
 */

import { VISUAL_CAPTURE_STATIC_CONTRACT } from '../src/shared/visual-capture-static-contract.js';
import { VISUAL_LAB_STATIC_CONTRACT } from '../src/shared/visual-lab-static-contract.js';
import {
  buildVisualCaptureSelectionExpression,
  resolveVisualCaptureDriver,
  visualCaptureDriverPublishesReportDescriptor,
  visualCaptureDriverUrlValues,
} from './visual-capture-drivers.mjs';
import { normalizeVisualCaptureEvidence } from './visual-capture-evidence.mjs';

const anyTarget = null;

const VISUAL_LAB_CAPTURE_EXECUTION_PROFILE = (
  VISUAL_LAB_STATIC_CONTRACT.normalHdrExecutionProfile
);

export const VISUAL_LAB_CAPTURE_PROTOCOL = Object.freeze({
  fixedUrlParameters: Object.freeze({
    inputAudit: '1',
    auditStage: 'visual-lab',
    renderLook: 'realistic',
    visualLabAudit: '1',
  }),
  dynamicUrlParameterNames: Object.freeze([
    'scene',
    'renderScale',
    'visualLab',
    'visualVariant',
    'visualTarget',
    'visualGain',
    'renderer',
  ]),
  datasetRequirements: Object.freeze({
    renderer: 'semantic-field-webgl',
    hdrPipeline: 'active',
  }),
});

const PROTECTED_FIXED_URL_PARAMETER_NAMES = new Set([
  ...Object.keys(VISUAL_LAB_CAPTURE_PROTOCOL.fixedUrlParameters),
  ...VISUAL_LAB_CAPTURE_PROTOCOL.dynamicUrlParameterNames,
]);

const RESOLVED_CAPTURE_REQUEST_BINDINGS = new WeakMap();

const assertFixedUrlParametersDoNotCollide = (domain, fixedUrlParameters) => {
  for (const parameterName of Object.keys(fixedUrlParameters)) {
    if (PROTECTED_FIXED_URL_PARAMETER_NAMES.has(parameterName)) {
      throw new Error(
        `Visual Lab domain ${domain} fixed URL parameter ${JSON.stringify(parameterName)}`
        + ' collides with the common capture protocol',
      );
    }
  }
};

const formatAlternatives = (values) => {
  if (values.length < 2) return values[0] ?? '';
  if (values.length === 2) return `${values[0]} or ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, or ${values.at(-1)}`;
};

const freezeConstraint = (domain, targets = anyTarget) => Object.freeze({
  domain,
  targets: targets === anyTarget ? anyTarget : Object.freeze([...targets]),
});

const freezePreparation = (reportLabel = 'prepareVisualLabFixture') => Object.freeze({
  reportLabel,
});

const freezeAdapter = ({
  name, scene, captureDriver, constraints, preparation = null, requirement = null,
}) => Object.freeze({
  name,
  scene,
  ...(captureDriver === undefined ? {} : { captureDriver }),
  constraints: Object.freeze(constraints),
  preparation,
  requirement,
});

const freezeDomain = ({
  name, targetKind, evidence, fixedUrlParameters = {},
}) => {
  assertFixedUrlParametersDoNotCollide(name, fixedUrlParameters);
  return Object.freeze({
    name,
    targetKind,
    executionProfile: VISUAL_LAB_CAPTURE_EXECUTION_PROFILE,
    evidence: Object.freeze({ ...evidence }),
    fixedUrlParameters: Object.freeze({ ...fixedUrlParameters }),
  });
};

export const createVisualLabDomainCatalog = (domains) => Object.freeze(
  domains.map(freezeDomain),
);

const STATIC_DOMAIN_BY_NAME = new Map(
  VISUAL_LAB_STATIC_CONTRACT.domains.map((domain) => [domain.name, domain]),
);

export const VISUAL_LAB_DOMAIN_ADAPTERS = createVisualLabDomainCatalog(
  VISUAL_LAB_STATIC_CONTRACT.captureDomainOrder.map((name) => {
    const domain = STATIC_DOMAIN_BY_NAME.get(name);
    if (!domain?.implemented || domain.evidence === null) {
      throw new TypeError(`Visual Lab capture domain ${name} is not implemented`);
    }
    return {
      name: domain.name,
      targetKind: domain.targetKind,
      evidence: normalizeVisualCaptureEvidence(domain.evidence),
      fixedUrlParameters: domain.fixedUrlParameters,
    };
  }),
);

const VISUAL_CAPTURE_EXTENSION_DOMAIN_ADAPTERS = Object.freeze(
  VISUAL_CAPTURE_STATIC_CONTRACT.extensionDomains.map((domain) => {
    assertFixedUrlParametersDoNotCollide(domain.name, domain.fixedUrlParameters);
    return Object.freeze({
      name: domain.name,
      targetKind: domain.targetKind,
      executionProfile: domain.executionProfile,
      evidence: normalizeVisualCaptureEvidence(domain.evidence),
      fixedUrlParameters: Object.freeze({ ...domain.fixedUrlParameters }),
      driver: domain.driver,
    });
  }),
);

/** Combined capture-facing catalog; the renderer-facing HDR catalog above remains closed. */
export const VISUAL_CAPTURE_DOMAIN_ADAPTERS = Object.freeze([
  ...VISUAL_LAB_DOMAIN_ADAPTERS.map((domain) => Object.freeze({
    ...domain,
    driver: 'normal-hdr',
  })),
  ...VISUAL_CAPTURE_EXTENSION_DOMAIN_ADAPTERS,
]);

/**
 * Builds a URL from a resolver-issued tuple. The WeakMap binding prevents a
 * caller from supplying spoofed adapters while allowing an execution plan to
 * resolve fixture/driver ownership exactly once.
 */
export function buildVisualLabCaptureUrlFromResolvedRequest(baseUrl, request, resolved) {
  const binding = RESOLVED_CAPTURE_REQUEST_BINDINGS.get(resolved);
  if (!binding || binding.domain !== request?.domain || binding.target !== request?.target
    || binding.fixture !== request?.fixture) {
    throw new Error('Visual capture URL requires its canonical resolved request tuple');
  }
  const url = new URL(baseUrl);
  const parameters = url.searchParams;
  const { domainAdapter, fixtureAdapter, captureDriver } = resolved;
  for (const [name, value] of Object.entries(VISUAL_LAB_CAPTURE_PROTOCOL.fixedUrlParameters)) {
    parameters.set(name, value);
  }

  const driverValues = visualCaptureDriverUrlValues(captureDriver, request);
  const dynamicValues = {
    scene: fixtureAdapter.scene,
    renderScale: String(request.renderScale),
    ...driverValues,
    renderer: null,
  };
  const dynamicNames = VISUAL_LAB_CAPTURE_PROTOCOL.dynamicUrlParameterNames;
  const dynamicKeys = Object.keys(dynamicValues);
  if (dynamicKeys.length !== dynamicNames.length
    || dynamicKeys.some((name) => !dynamicNames.includes(name))) {
    throw new Error('Visual Lab dynamic URL values do not match the capture protocol');
  }
  for (const name of dynamicNames) {
    const value = dynamicValues[name];
    if (value === null) parameters.delete(name);
    else parameters.set(name, value);
  }

  assertFixedUrlParametersDoNotCollide(
    domainAdapter.name, domainAdapter.fixedUrlParameters,
  );
  for (const [name, value] of Object.entries(domainAdapter.fixedUrlParameters)) {
    parameters.set(name, value);
  }
  return url;
}

/** Builds one deterministic capture URL without mutating the supplied base URL. */
export function buildVisualLabCaptureUrl(baseUrl, request) {
  return buildVisualLabCaptureUrlFromResolvedRequest(
    baseUrl, request, resolveVisualCaptureRequest(request),
  );
}

export const VISUAL_LAB_FIXTURE_ADAPTERS = Object.freeze(
  VISUAL_LAB_STATIC_CONTRACT.fixtures.map((fixture) => freezeAdapter({
    name: fixture.name,
    scene: fixture.scene,
    constraints: fixture.constraints.map(({ domain, targets }) => (
      freezeConstraint(domain, targets)
    )),
    preparation: fixture.preparationReportLabel === null
      ? null
      : freezePreparation(fixture.preparationReportLabel),
    requirement: fixture.requirement,
  })),
);

const VISUAL_CAPTURE_EXTENSION_FIXTURE_ADAPTERS = Object.freeze(
  VISUAL_CAPTURE_STATIC_CONTRACT.fixtures.map((fixture) => freezeAdapter({
    name: fixture.name,
    scene: fixture.scene,
    captureDriver: fixture.driver,
    constraints: fixture.constraints.map(({ domain, targets }) => (
      freezeConstraint(domain, targets)
    )),
    preparation: fixture.preparationReportLabel === null
      ? null
      : freezePreparation(fixture.preparationReportLabel),
    requirement: fixture.requirement,
  })),
);

/** All fixtures understood by the generic capture runner. */
export const VISUAL_CAPTURE_FIXTURE_ADAPTERS = Object.freeze([
  ...VISUAL_LAB_FIXTURE_ADAPTERS.map((fixture) => freezeAdapter({
    ...fixture,
    captureDriver: 'normal-hdr',
  })),
  ...VISUAL_CAPTURE_EXTENSION_FIXTURE_ADAPTERS,
]);

const DOMAIN_BY_NAME = new Map(
  VISUAL_LAB_DOMAIN_ADAPTERS.map((adapter) => [adapter.name, adapter]),
);

const CAPTURE_DOMAIN_BY_NAME = new Map(
  VISUAL_CAPTURE_DOMAIN_ADAPTERS.map((adapter) => [adapter.name, adapter]),
);

const FIXTURE_BY_NAME = new Map(
  VISUAL_LAB_FIXTURE_ADAPTERS.map((adapter) => [adapter.name, adapter]),
);

const CAPTURE_FIXTURE_BY_NAME = new Map(
  VISUAL_CAPTURE_FIXTURE_ADAPTERS.map((adapter) => [adapter.name, adapter]),
);

const resolveFixtureCompatibility = (adapter, domain, target, fixtureNames) => {
  if (!adapter) {
    throw new Error(`--fixture must be ${formatAlternatives(fixtureNames)}`);
  }
  const constraint = adapter.constraints.find((candidate) => candidate.domain === domain);
  if (!constraint) {
    if (adapter.requirement) {
      throw new Error(`--fixture=${adapter.name} requires ${adapter.requirement}`);
    }
    const domains = adapter.constraints.map((candidate) => candidate.domain).join(', ');
    throw new Error(`--fixture=${adapter.name} requires --domain to be one of: ${domains}`);
  }
  if (constraint.targets !== anyTarget && !constraint.targets.includes(target)) {
    if (adapter.requirement) {
      throw new Error(`--fixture=${adapter.name} requires ${adapter.requirement}`);
    }
    throw new Error(
      `--fixture=${adapter.name} requires --domain=${domain} --target=${constraint.targets.join('|')}`,
    );
  }
  return adapter;
};

/**
 * Builds a request resolver whose fixture owns executable driver selection.
 * Catalog construction fails before capture if any fixture references an
 * unknown domain/driver or a driver that does not support its constrained
 * domain. Different fixtures may intentionally select different drivers for
 * the same domain.
 */
export function createVisualCaptureRequestResolver({
  domainAdapters, fixtureAdapters, driverResolver = resolveVisualCaptureDriver,
}) {
  if (!Array.isArray(domainAdapters) || !Array.isArray(fixtureAdapters)
    || typeof driverResolver !== 'function') {
    throw new TypeError('Visual capture request resolver requires domain and fixture catalogs');
  }
  const domainByName = new Map();
  for (const adapter of domainAdapters) {
    if (typeof adapter?.name !== 'string' || domainByName.has(adapter.name)) {
      throw new TypeError(
        `Invalid or duplicate visual capture domain ${JSON.stringify(adapter?.name)}`,
      );
    }
    domainByName.set(adapter.name, adapter);
  }
  const fixtureByName = new Map();
  const driverByFixture = new Map();
  for (const adapter of fixtureAdapters) {
    if (typeof adapter?.name !== 'string' || fixtureByName.has(adapter.name)) {
      throw new TypeError(
        `Invalid or duplicate visual capture fixture ${JSON.stringify(adapter?.name)}`,
      );
    }
    const driver = driverResolver(adapter.captureDriver);
    if (!Array.isArray(driver?.domains) || !Array.isArray(adapter.constraints)
      || adapter.constraints.length === 0) {
      throw new TypeError(`Visual capture fixture ${adapter.name} has an invalid driver binding`);
    }
    for (const constraint of adapter.constraints) {
      if (!domainByName.has(constraint.domain) || !driver.domains.includes(constraint.domain)) {
        throw new TypeError(
          `Visual capture fixture ${adapter.name} driver ${driver.name}`
          + ` does not support domain ${JSON.stringify(constraint.domain)}`,
        );
      }
    }
    fixtureByName.set(adapter.name, adapter);
    driverByFixture.set(adapter.name, driver);
  }
  const domainNames = Object.freeze([...domainByName.keys()]);
  const fixtureNames = Object.freeze([...fixtureByName.keys()]);

  return Object.freeze((request) => {
    const domainAdapter = domainByName.get(request?.domain);
    if (!domainAdapter) {
      throw new Error(`--domain must be ${formatAlternatives(domainNames)}`);
    }
    const fixtureAdapter = resolveFixtureCompatibility(
      fixtureByName.get(request?.fixture), request.domain, request.target, fixtureNames,
    );
    const resolved = Object.freeze({
      domainAdapter,
      fixtureAdapter,
      captureDriver: driverByFixture.get(fixtureAdapter.name),
    });
    RESOLVED_CAPTURE_REQUEST_BINDINGS.set(resolved, Object.freeze({
      domain: request.domain,
      target: request.target,
      fixture: request.fixture,
    }));
    return resolved;
  });
}

export const resolveVisualCaptureRequest = createVisualCaptureRequestResolver({
  domainAdapters: VISUAL_CAPTURE_DOMAIN_ADAPTERS,
  fixtureAdapters: VISUAL_CAPTURE_FIXTURE_ADAPTERS,
});

export function visualLabFixtureNames() {
  return VISUAL_LAB_FIXTURE_ADAPTERS.map(({ name }) => name);
}

export function visualCaptureFixtureNames() {
  return VISUAL_CAPTURE_FIXTURE_ADAPTERS.map(({ name }) => name);
}

export function visualLabDomainNames() {
  return VISUAL_LAB_DOMAIN_ADAPTERS.map(({ name }) => name);
}

export function visualCaptureDomainNames() {
  return VISUAL_CAPTURE_DOMAIN_ADAPTERS.map(({ name }) => name);
}

/**
 * Stable v1 report label. Existing portable packages retain the specialized
 * labels even though executable preparation now crosses one generic bridge.
 */
export function visualLabFixturePreparationLabel(adapter) {
  return adapter.preparation?.reportLabel ?? 'scene';
}

export function resolveVisualLabDomain(name) {
  const adapter = DOMAIN_BY_NAME.get(name);
  if (!adapter) throw new Error(`--domain must be ${formatAlternatives(visualLabDomainNames())}`);
  return adapter;
}

export function resolveVisualCaptureDomain(name) {
  const adapter = CAPTURE_DOMAIN_BY_NAME.get(name);
  if (!adapter) {
    throw new Error(`--domain must be ${formatAlternatives(visualCaptureDomainNames())}`);
  }
  return adapter;
}

export function resolveVisualLabFixture(name, domain, target) {
  const adapter = FIXTURE_BY_NAME.get(name);
  if (!adapter) {
    throw new Error(`--fixture must be ${formatAlternatives(visualLabFixtureNames())}`);
  }
  const constraint = adapter.constraints.find((candidate) => candidate.domain === domain);
  if (!constraint) {
    if (adapter.requirement) throw new Error(`--fixture=${name} requires ${adapter.requirement}`);
    const domains = adapter.constraints.map((candidate) => candidate.domain).join(', ');
    throw new Error(`--fixture=${name} requires --domain to be one of: ${domains}`);
  }
  if (constraint.targets !== anyTarget && !constraint.targets.includes(target)) {
    if (adapter.requirement) throw new Error(`--fixture=${name} requires ${adapter.requirement}`);
    throw new Error(
      `--fixture=${name} requires --domain=${domain} --target=${constraint.targets.join('|')}`,
    );
  }
  return adapter;
}

export function resolveVisualCaptureFixture(name, domain, target) {
  return resolveFixtureCompatibility(
    CAPTURE_FIXTURE_BY_NAME.get(name), domain, target, visualCaptureFixtureNames(),
  );
}

/**
 * Serializes the only page-owned startup transaction used by every fixture:
 * observe the Canvas warm-up, prepare optional app state, then stage variant B.
 */
export function buildVisualLabStartupExpression(
  adapter, variant = 2, captureDriver = adapter.captureDriver ?? 'normal-hdr',
) {
  const driver = typeof captureDriver === 'string'
    ? resolveVisualCaptureDriver(captureDriver) : resolveVisualCaptureDriver(captureDriver?.name);
  const selectionExpression = buildVisualCaptureSelectionExpression(driver, variant, {
    fixtureId: adapter.name,
  });
  const includeDriverFields = visualCaptureDriverPublishesReportDescriptor(driver);
  const descriptor = JSON.stringify({
    name: adapter.name,
    scene: adapter.scene,
    preparationLabel: visualLabFixturePreparationLabel(adapter),
    captureDriver: driver.name,
    includeDriverFields,
  });
  return `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    if (!audit) return false;
    const adapter = ${descriptor};
    const observedScene = document.querySelector('[data-scene]')?.dataset.scene;
    if (!observedScene) return false;
    const before = audit.backend();
    const result = {
      requestedVariant: ${variant},
      fixture: adapter.name,
      scene: observedScene,
      preparation: adapter.preparationLabel,
      fixturePrepared: false,
      backendBeforeSelection: before.backend,
      backendReasonBeforeSelection: before.reason,
      stagedBeforeWebGL: false,
    };
    if (observedScene !== adapter.scene) {
      return { ...result, failure: 'scene-mismatch' };
    }
    if (before.backend !== 'canvas2d' || before.reason !== 'webgl-starting') {
      return { ...result, failure: 'startup-window-missed' };
    }
    if (typeof audit.prepareVisualLabFixture !== 'function') {
      return { ...result, failure: 'missing-preparer' };
    }
    try {
      // This is also the closed fixture-activation boundary. Fixtures without
      // authored preparation (currently showcase) acknowledge an exact no-op.
      audit.prepareVisualLabFixture(adapter.name);
    } catch (error) {
      return {
        ...result,
        failure: 'preparer-threw',
        preparationError: String(error?.message ?? error),
      };
    }
    const selection = ${selectionExpression};
    if (!selection.ok) {
      return { ...result, failure: selection.failure, selection: selection.selection };
    }
    return {
      ...result,
      ...(adapter.includeDriverFields ? {
        captureDriver: adapter.captureDriver,
        selection: selection.selection,
      } : {}),
      fixturePrepared: true,
      stagedBeforeWebGL: true,
    };
  })()`;
}
