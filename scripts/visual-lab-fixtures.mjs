/**
 * Declarative adapters between the generic Visual Lab capture protocol and
 * app-owned deterministic fixtures. Adding a fixture belongs here; the CDP
 * harness must not grow another fixture-specific branch.
 */

const anyTarget = null;

const formatAlternatives = (values) => {
  if (values.length < 2) return values[0] ?? '';
  if (values.length === 2) return `${values[0]} or ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, or ${values.at(-1)}`;
};

const freezeConstraint = (domain, targets = anyTarget) => Object.freeze({
  domain,
  targets: targets === anyTarget ? anyTarget : Object.freeze([...targets]),
});

const freezePreparation = (method, args = []) => Object.freeze({
  method,
  args: Object.freeze([...args]),
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

const freezeDomain = ({ name, targetKind, fieldAlphaMethod, urlParameters = {} }) => Object.freeze({
  name,
  targetKind,
  fieldAlphaMethod,
  urlParameters: Object.freeze({ ...urlParameters }),
});

export const VISUAL_LAB_DOMAIN_ADAPTERS = Object.freeze([
  freezeDomain({
    name: 'gas',
    targetKind: 'propagated-atmosphere-style-byte',
    fieldAlphaMethod: 'atmosphereFieldAlpha',
  }),
  freezeDomain({
    name: 'liquid',
    targetKind: 'semantic-material-id',
    fieldAlphaMethod: 'liquidFieldAlpha',
    urlParameters: { liquidBodyVfx: '1', liquidSurfaceVfx: '1' },
  }),
  freezeDomain({
    name: 'emission',
    targetKind: 'semantic-material-id',
    fieldAlphaMethod: 'emissionFieldAlpha',
  }),
]);

export const VISUAL_LAB_FIXTURE_ADAPTERS = Object.freeze([
  freezeAdapter({
    name: 'showcase',
    scene: 'showcase',
    constraints: [
      freezeConstraint('gas'),
      freezeConstraint('liquid'),
      freezeConstraint('emission'),
    ],
  }),
  freezeAdapter({
    name: 'oil-motion',
    scene: 'showcase',
    constraints: [freezeConstraint('liquid', [8])],
    preparation: freezePreparation('prepareOilMotionVfxFixture', ['moving']),
    requirement: '--domain=liquid --target=8',
  }),
]);

const DOMAIN_BY_NAME = new Map(
  VISUAL_LAB_DOMAIN_ADAPTERS.map((adapter) => [adapter.name, adapter]),
);

const FIXTURE_BY_NAME = new Map(
  VISUAL_LAB_FIXTURE_ADAPTERS.map((adapter) => [adapter.name, adapter]),
);

export function visualLabFixtureNames() {
  return VISUAL_LAB_FIXTURE_ADAPTERS.map(({ name }) => name);
}

export function visualLabDomainNames() {
  return VISUAL_LAB_DOMAIN_ADAPTERS.map(({ name }) => name);
}

export function resolveVisualLabDomain(name) {
  const adapter = DOMAIN_BY_NAME.get(name);
  if (!adapter) throw new Error(`--domain must be ${formatAlternatives(visualLabDomainNames())}`);
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

/**
 * Serializes the only page-owned startup transaction used by every fixture:
 * observe the Canvas warm-up, prepare optional app state, then stage variant B.
 */
export function buildVisualLabStartupExpression(adapter, variant = 2) {
  const descriptor = JSON.stringify({
    name: adapter.name,
    scene: adapter.scene,
    preparation: adapter.preparation,
  });
  return `(() => {
    const audit = window.__ANIFOR_INPUT_AUDIT__;
    if (!audit || typeof audit.setVisualLabVariant !== 'function') return false;
    const adapter = ${descriptor};
    const observedScene = document.querySelector('[data-scene]')?.dataset.scene;
    if (!observedScene) return false;
    const before = audit.backend();
    const result = {
      requestedVariant: ${variant},
      fixture: adapter.name,
      scene: observedScene,
      preparation: adapter.preparation?.method ?? 'scene',
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
    if (adapter.preparation !== null) {
      const prepare = audit[adapter.preparation.method];
      if (typeof prepare !== 'function') {
        return { ...result, failure: 'missing-preparer' };
      }
      try {
        prepare.apply(audit, adapter.preparation.args);
      } catch (error) {
        return {
          ...result,
          failure: 'preparer-threw',
          preparationError: String(error?.message ?? error),
        };
      }
    }
    audit.setVisualLabVariant(${variant});
    return {
      ...result,
      fixturePrepared: true,
      stagedBeforeWebGL: true,
    };
  })()`;
}
