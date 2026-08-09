/**
 * Declarative adapters between the generic Visual Lab capture protocol and
 * app-owned deterministic fixtures. Adding a fixture belongs here; the CDP
 * harness must not grow another fixture-specific branch.
 */

import { VISUAL_CAPTURE_STATIC_CONTRACT } from '../src/shared/visual-capture-static-contract.js';
import { VISUAL_LAB_STATIC_CONTRACT } from '../src/shared/visual-lab-static-contract.js';
import {
  buildVisualCaptureSelectionExpression,
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
  name, scene, constraints, preparation = null, requirement = null,
}) => Object.freeze({
  name,
  scene,
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

/** Builds one deterministic capture URL without mutating the supplied base URL. */
export function buildVisualLabCaptureUrl(baseUrl, request) {
  const url = new URL(baseUrl);
  const parameters = url.searchParams;
  for (const [name, value] of Object.entries(VISUAL_LAB_CAPTURE_PROTOCOL.fixedUrlParameters)) {
    parameters.set(name, value);
  }

  const driverValues = visualCaptureDriverUrlValues(
    request.domainAdapter.driver ?? 'normal-hdr', request,
  );
  const dynamicValues = {
    scene: request.fixtureAdapter.scene,
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
    request.domainAdapter.name, request.domainAdapter.fixedUrlParameters,
  );
  for (const [name, value] of Object.entries(request.domainAdapter.fixedUrlParameters)) {
    parameters.set(name, value);
  }
  return url;
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
    constraints: fixture.constraints.map(({ domain, targets }) => (
      freezeConstraint(domain, targets)
    )),
    preparation: freezePreparation(fixture.preparationReportLabel),
    requirement: fixture.requirement,
  })),
);

/** All fixtures understood by the generic capture runner. */
export const VISUAL_CAPTURE_FIXTURE_ADAPTERS = Object.freeze([
  ...VISUAL_LAB_FIXTURE_ADAPTERS,
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
  const adapter = CAPTURE_FIXTURE_BY_NAME.get(name);
  if (!adapter) {
    throw new Error(`--fixture must be ${formatAlternatives(visualCaptureFixtureNames())}`);
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

/**
 * Serializes the only page-owned startup transaction used by every fixture:
 * observe the Canvas warm-up, prepare optional app state, then stage variant B.
 */
export function buildVisualLabStartupExpression(adapter, variant = 2, captureDriver = 'normal-hdr') {
  const selectionExpression = buildVisualCaptureSelectionExpression(captureDriver, variant);
  const descriptor = JSON.stringify({
    name: adapter.name,
    scene: adapter.scene,
    prepareFixture: adapter.preparation !== null,
    preparationLabel: visualLabFixturePreparationLabel(adapter),
    captureDriver,
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
    if (adapter.prepareFixture) {
      if (typeof audit.prepareVisualLabFixture !== 'function') {
        return { ...result, failure: 'missing-preparer' };
      }
      try {
        audit.prepareVisualLabFixture(adapter.name);
      } catch (error) {
        return {
          ...result,
          failure: 'preparer-threw',
          preparationError: String(error?.message ?? error),
        };
      }
    }
    const selection = ${selectionExpression};
    if (!selection.ok) {
      return { ...result, failure: selection.failure, selection: selection.selection };
    }
    return {
      ...result,
      ...(adapter.captureDriver === 'normal-hdr' ? {} : {
        captureDriver: adapter.captureDriver,
        selection: selection.selection,
      }),
      fixturePrepared: true,
      stagedBeforeWebGL: true,
    };
  })()`;
}
