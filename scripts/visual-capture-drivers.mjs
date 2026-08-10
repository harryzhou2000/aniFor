/**
 * Closed executable side of the data-only visual-capture driver contract.
 * Catalog data selects one known driver; it never supplies browser method
 * names, argument arrays, or executable source.
 */

import { isDeepStrictEqual } from 'node:util';
import {
  VISUAL_CAPTURE_STATIC_FIXTURES,
} from '../src/shared/visual-capture-static-catalog.js';
import { VISUAL_CAPTURE_STATIC_CONTRACT } from '../src/shared/visual-capture-static-contract.js';
import { VISUAL_LAB_CAPTURE_VARIANTS } from './visual-lab-capture-abi.mjs';

const JS_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const SAFE_FIXTURE_ID = /^[a-z][a-z0-9-]*$/;
const SELECTION_CONTEXT_FIELDS = Object.freeze(['fixtureId', 'auditIdentifier']);
const FIXTURE_DRIVER_BINDING_FIELDS = Object.freeze(['fixtureId', 'driver']);
const EXECUTABLE_ADAPTER_FIELDS = Object.freeze([
  'urlValues',
  'datasetExpectation',
  'selectionExpression',
  'datasetProjectionExpression',
  'publishesReportDescriptor',
  'reportMismatch',
]);

const normalHdrVariantValue = (variant) => {
  const descriptor = VISUAL_LAB_CAPTURE_VARIANTS.find(({ name }) => name === variant.name);
  if (!descriptor) throw new TypeError(`Normal-HDR variant ${variant.name} is outside the ABI`);
  return descriptor.value;
};

const powderStyleCaptureVariantValue = (variant) => {
  const descriptor = VISUAL_LAB_CAPTURE_VARIANTS.find(({ name }) => name === variant.name);
  if (!descriptor) throw new TypeError(`Powder variant ${variant.name} is outside the capture ABI`);
  return descriptor.value;
};

/** Shared fail-closed browser control ABI for every prepared capture fixture. */
const preparedControlSelectionExpression = (
  auditIdentifier, fixtureId, variantValue, selectionSource, expectedSelection,
) => {
  const fixture = JSON.stringify(fixtureId);
  const value = JSON.stringify(variantValue);
  const expected = JSON.stringify(expectedSelection);
  return `(() => {
      if (typeof ${auditIdentifier}.setPreparedVisualCaptureVariant !== 'function'
        || typeof ${auditIdentifier}.preparedVisualCaptureVariant !== 'function') {
        return { ok: false, failure: 'missing-selector' };
      }
      let observed;
      try {
        ${auditIdentifier}.setPreparedVisualCaptureVariant(${fixture}, ${value});
        observed = ${auditIdentifier}.preparedVisualCaptureVariant(${fixture});
      } catch {
        return { ok: false, failure: 'selector-threw' };
      }
      const selection = ${selectionSource};
      return observed === ${value} && selection === ${expected}
        ? { ok: true, selection }
        : { ok: false, failure: 'selection-mismatch', selection };
    })()`;
};

const EXECUTABLE_DRIVER_ADAPTERS = Object.freeze({
  'normal-hdr': Object.freeze({
    urlValues: (request) => Object.freeze({
      visualLab: request.domain,
      visualVariant: '0',
      visualTarget: String(request.target),
      visualGain: String(request.gain),
    }),
    datasetExpectation: (request, variant) => {
      const value = normalHdrVariantValue(variant);
      return Object.freeze({
        visualLab: value === 0 ? 'inactive' : 'active',
        visualLabDomain: request.domain,
        visualLabVariant: String(value),
        visualLabTarget: String(request.target),
        visualLabGain: String(request.gain),
      });
    },
    selectionExpression: (variant, auditIdentifier, fixtureId) => {
      const value = normalHdrVariantValue(variant);
      return preparedControlSelectionExpression(
        auditIdentifier, fixtureId, value, 'observed', value,
      );
    },
    datasetProjectionExpression: () => '({})',
    publishesReportDescriptor: false,
    reportMismatch: 'normal-HDR reports must not add a capture-driver descriptor',
  }),
  'powder-render-style': Object.freeze({
    urlValues: () => Object.freeze({
      visualLab: null,
      visualVariant: null,
      visualTarget: null,
      visualGain: null,
    }),
    datasetExpectation: (_request, variant) => Object.freeze({
      visualLab: 'inactive',
      visualLabDomain: 'off',
      visualLabVariant: '0',
      visualLabTarget: '0',
      visualLabGain: '1',
      powderRenderStyle: variant.selection,
    }),
    selectionExpression: (variant, auditIdentifier, fixtureId, driver) => {
      const value = powderStyleCaptureVariantValue(variant);
      const selections = driver.variants.map(({ selection }) => selection);
      return preparedControlSelectionExpression(
        auditIdentifier,
        fixtureId,
        value,
        `${JSON.stringify(selections)}[observed]`,
        variant.selection,
      );
    },
    datasetProjectionExpression: (auditIdentifier, fixtureId, driver) => {
      const fixture = JSON.stringify(fixtureId);
      const selections = JSON.stringify(driver.variants.map(({ selection }) => selection));
      return (
      `(() => {
      if (typeof ${auditIdentifier}.preparedVisualCaptureVariant !== 'function') {
        return { powderRenderStyle: undefined };
      }
      try {
        const observed = ${auditIdentifier}.preparedVisualCaptureVariant(${fixture});
        return { powderRenderStyle: ${selections}[observed] };
      } catch {
        return { powderRenderStyle: undefined };
      }
    })()`
      );
    },
    publishesReportDescriptor: true,
    reportMismatch: 'capture-driver descriptor does not match the current typed driver',
  }),
});

const displayName = (value) => JSON.stringify(value) ?? String(value);

const resolveVisualCaptureSelectionContext = (driver, options, fixtureDriverById) => {
  if (options === null || typeof options !== 'object' || Array.isArray(options)
    || (Object.getPrototypeOf(options) !== Object.prototype
      && Object.getPrototypeOf(options) !== null)) {
    throw new TypeError('Visual capture selection requires a closed fixture context');
  }
  const fields = Reflect.ownKeys(options);
  const descriptors = Object.getOwnPropertyDescriptors(options);
  if (!fields.includes('fixtureId')
    || fields.some((field) => typeof field !== 'string'
      || !SELECTION_CONTEXT_FIELDS.includes(field)
      || !descriptors[field].enumerable
      || !Object.hasOwn(descriptors[field], 'value'))) {
    throw new TypeError(
      'Visual capture selection context must contain fixtureId and optional auditIdentifier only',
    );
  }
  const fixtureId = descriptors.fixtureId.value;
  const fixtureDriver = typeof fixtureId === 'string'
    ? fixtureDriverById.get(fixtureId) : undefined;
  if (fixtureDriver === undefined) {
    throw new Error(`Unknown visual capture fixture ${displayName(fixtureId)}`);
  }
  if (fixtureDriver !== driver.name) {
    throw new Error(
      `Visual capture fixture ${displayName(fixtureId)} does not use driver ${driver.name}`,
    );
  }
  const auditIdentifier = descriptors.auditIdentifier?.value ?? 'audit';
  assertAuditIdentifier(auditIdentifier);
  return Object.freeze({ fixtureId, auditIdentifier });
};

/**
 * Creates the fail-closed executable registry. Driver/domain overlap is valid:
 * a resolved fixture owns the final driver choice. Every declared driver must
 * have exactly one executable adapter and undeclared adapters are rejected.
 */
export function createVisualCaptureDriverRegistry(drivers, executableAdapters) {
  if (!Array.isArray(drivers) || drivers.length === 0) {
    throw new TypeError('Visual capture drivers must be a nonempty array');
  }
  if (executableAdapters === null || typeof executableAdapters !== 'object'
    || Array.isArray(executableAdapters)) {
    throw new TypeError('Visual capture executable adapters must be an object');
  }

  const driverByName = new Map();
  for (const driver of drivers) {
    if (typeof driver?.name !== 'string' || driverByName.has(driver.name)) {
      throw new TypeError(`Invalid or duplicate visual capture driver ${displayName(driver?.name)}`);
    }
    driverByName.set(driver.name, driver);
  }

  const adapterNames = Reflect.ownKeys(executableAdapters);
  const invalidAdapterName = adapterNames.find((name) => typeof name !== 'string');
  if (invalidAdapterName !== undefined) {
    throw new TypeError(`Invalid visual capture executable adapter ${String(invalidAdapterName)}`);
  }
  const missing = [...driverByName.keys()].filter((name) => !adapterNames.includes(name));
  const extra = adapterNames.filter((name) => !driverByName.has(name));
  const reordered = missing.length === 0 && extra.length === 0
    && adapterNames.some((name, index) => name !== drivers[index].name);
  if (missing.length > 0 || extra.length > 0 || reordered) {
    const details = [
      missing.length > 0 ? `missing ${missing.join(', ')}` : '',
      extra.length > 0 ? `undeclared ${extra.join(', ')}` : '',
      reordered ? 'adapter order differs from declared driver order' : '',
    ].filter(Boolean).join('; ');
    throw new TypeError(`Visual capture executable registry is not exhaustive (${details})`);
  }

  const executableByName = new Map();
  for (const name of driverByName.keys()) {
    const adapter = executableAdapters[name];
    if (adapter === null || typeof adapter !== 'object' || Array.isArray(adapter)) {
      throw new TypeError(`Visual capture driver ${name} has an invalid executable adapter`);
    }
    const fields = Reflect.ownKeys(adapter);
    const exactFields = fields.length === EXECUTABLE_ADAPTER_FIELDS.length
      && fields.every((field, index) => field === EXECUTABLE_ADAPTER_FIELDS[index]);
    const descriptors = Object.fromEntries(EXECUTABLE_ADAPTER_FIELDS.map((field) => [
      field, Object.getOwnPropertyDescriptor(adapter, field),
    ]));
    const invalidDescriptor = EXECUTABLE_ADAPTER_FIELDS.find((field) => (
      descriptors[field]?.enumerable !== true || !Object.hasOwn(descriptors[field], 'value')
    ));
    const invalidFunction = EXECUTABLE_ADAPTER_FIELDS.slice(0, 4).find((field) => (
      typeof descriptors[field]?.value !== 'function'
    ));
    if (!exactFields || invalidDescriptor || invalidFunction
      || typeof descriptors.publishesReportDescriptor?.value !== 'boolean'
      || typeof descriptors.reportMismatch?.value !== 'string'
      || descriptors.reportMismatch.value.length === 0) {
      throw new TypeError(`Visual capture driver ${name} has an invalid executable adapter`);
    }
    executableByName.set(name, Object.freeze(Object.fromEntries(
      EXECUTABLE_ADAPTER_FIELDS.map((field) => [field, descriptors[field].value]),
    )));
  }

  const names = Object.freeze([...driverByName.keys()]);
  const resolve = (name) => {
    const driver = driverByName.get(name);
    if (!driver) throw new Error(`Unknown visual capture driver ${displayName(name)}`);
    return driver;
  };
  const executable = (driverOrName) => {
    const driver = typeof driverOrName === 'string'
      ? resolve(driverOrName) : resolve(driverOrName?.name);
    return executableByName.get(driver.name);
  };
  return Object.freeze({ names, resolve, executable });
}

const DRIVER_REGISTRY = createVisualCaptureDriverRegistry(
  VISUAL_CAPTURE_STATIC_CONTRACT.drivers,
  EXECUTABLE_DRIVER_ADAPTERS,
);

export const VISUAL_CAPTURE_DRIVER_NAMES = DRIVER_REGISTRY.names;

export function resolveVisualCaptureDriver(name) {
  return DRIVER_REGISTRY.resolve(name);
}

export function resolveVisualCaptureVariant(driverOrName, valueOrName) {
  const driver = typeof driverOrName === 'string'
    ? resolveVisualCaptureDriver(driverOrName) : resolveVisualCaptureDriver(driverOrName?.name);
  const abiName = VISUAL_LAB_CAPTURE_VARIANTS.find(({ value }) => value === valueOrName)?.name;
  const variant = driver.variants.find((candidate) => (
    candidate.name === valueOrName
      || candidate.name === abiName
  )) ?? driver.variants.find((candidate) => candidate.selection === valueOrName);
  if (!variant) {
    throw new Error(`Unknown ${driver.name} capture variant ${displayName(valueOrName)}`);
  }
  return variant;
}

export function visualCaptureDriverUrlValues(driverOrName, request) {
  const executable = DRIVER_REGISTRY.executable(driverOrName);
  return executable.urlValues(request);
}

export function visualCaptureDriverDatasetExpectation(
  driverOrName, request, valueOrName,
) {
  const driver = typeof driverOrName === 'string'
    ? resolveVisualCaptureDriver(driverOrName) : resolveVisualCaptureDriver(driverOrName?.name);
  const variant = resolveVisualCaptureVariant(driver, valueOrName);
  return DRIVER_REGISTRY.executable(driver).datasetExpectation(request, variant);
}

const assertAuditIdentifier = (auditIdentifier) => {
  if (typeof auditIdentifier !== 'string' || !JS_IDENTIFIER.test(auditIdentifier)) {
    throw new Error(`Unsafe visual capture audit identifier ${displayName(auditIdentifier)}`);
  }
};

/**
 * Builds the closed fixture-owned expression compiler used by an execution
 * plan. A caller may supply another validated catalog for framework tests, but
 * individual requests cannot override the resulting fixture/driver binding.
 */
export function createVisualCaptureFixtureBoundExpressions(fixtureDriverBindings) {
  if (!Array.isArray(fixtureDriverBindings) || fixtureDriverBindings.length === 0) {
    throw new TypeError('Visual capture fixture driver bindings must be a nonempty array');
  }
  const fixtureDriverById = new Map();
  for (const binding of fixtureDriverBindings) {
    if (binding === null || typeof binding !== 'object' || Array.isArray(binding)
      || Object.getPrototypeOf(binding) !== Object.prototype) {
      throw new TypeError('Visual capture fixture driver binding must be a plain object');
    }
    const keys = Reflect.ownKeys(binding);
    const descriptors = Object.getOwnPropertyDescriptors(binding);
    if (keys.length !== FIXTURE_DRIVER_BINDING_FIELDS.length
      || keys.some((key, index) => key !== FIXTURE_DRIVER_BINDING_FIELDS[index])
      || FIXTURE_DRIVER_BINDING_FIELDS.some((field) => (
        !descriptors[field]?.enumerable || !Object.hasOwn(descriptors[field], 'value')
      ))) {
      throw new TypeError(
        'Visual capture fixture driver binding fields must be exactly fixtureId, driver',
      );
    }
    const { fixtureId, driver: driverName } = binding;
    if (typeof fixtureId !== 'string' || !SAFE_FIXTURE_ID.test(fixtureId)) {
      throw new TypeError(`Invalid visual capture fixture binding ${displayName(fixtureId)}`);
    }
    if (fixtureDriverById.has(fixtureId)) {
      throw new TypeError(`Duplicate visual capture fixture binding ${displayName(fixtureId)}`);
    }
    const driver = resolveVisualCaptureDriver(driverName);
    fixtureDriverById.set(fixtureId, driver.name);
  }

  const buildSelectionExpression = (driverOrName, valueOrName, options) => {
    const driver = typeof driverOrName === 'string'
      ? resolveVisualCaptureDriver(driverOrName) : resolveVisualCaptureDriver(driverOrName?.name);
    const variant = resolveVisualCaptureVariant(driver, valueOrName);
    const { fixtureId, auditIdentifier } = resolveVisualCaptureSelectionContext(
      driver, options, fixtureDriverById,
    );
    return DRIVER_REGISTRY.executable(driver)
      .selectionExpression(variant, auditIdentifier, fixtureId, driver);
  };
  const buildDatasetProjectionExpression = (driverOrName, options) => {
    const driver = typeof driverOrName === 'string'
      ? resolveVisualCaptureDriver(driverOrName) : resolveVisualCaptureDriver(driverOrName?.name);
    const { fixtureId, auditIdentifier } = resolveVisualCaptureSelectionContext(
      driver, options, fixtureDriverById,
    );
    return DRIVER_REGISTRY.executable(driver)
      .datasetProjectionExpression(auditIdentifier, fixtureId, driver);
  };
  return Object.freeze({ buildSelectionExpression, buildDatasetProjectionExpression });
}

const CANONICAL_FIXTURE_DRIVER_BINDINGS = Object.freeze([
  ...VISUAL_CAPTURE_STATIC_FIXTURES.map(({ name, driver }) => Object.freeze({
    fixtureId: name,
    driver,
  })),
]);

const FIXTURE_BOUND_EXPRESSIONS = createVisualCaptureFixtureBoundExpressions(
  CANONICAL_FIXTURE_DRIVER_BINDINGS,
);

/** Browser expression bound to one known fixture and one validated audit identifier. */
export function buildVisualCaptureSelectionExpression(
  driverOrName, valueOrName, options,
) {
  return FIXTURE_BOUND_EXPRESSIONS.buildSelectionExpression(
    driverOrName, valueOrName, options,
  );
}

/** Fixture-bound browser projection of driver-specific observed dataset state. */
export function buildVisualCaptureDatasetProjectionExpression(
  driverOrName, options,
) {
  return FIXTURE_BOUND_EXPRESSIONS.buildDatasetProjectionExpression(driverOrName, options);
}

export function visualCaptureDriverPublishesReportDescriptor(driverOrName) {
  return DRIVER_REGISTRY.executable(driverOrName).publishesReportDescriptor;
}

const EMPTY_DRIVER_FIELDS = Object.freeze({});

export function visualCaptureDriverStartupFields(driverOrName, valueOrName) {
  const driver = typeof driverOrName === 'string'
    ? resolveVisualCaptureDriver(driverOrName) : resolveVisualCaptureDriver(driverOrName?.name);
  if (!visualCaptureDriverPublishesReportDescriptor(driver)) return EMPTY_DRIVER_FIELDS;
  const variant = resolveVisualCaptureVariant(driver, valueOrName);
  return Object.freeze({ captureDriver: driver.name, selection: variant.selection });
}

export function visualCaptureDriverReportFields(driverOrName) {
  const driver = typeof driverOrName === 'string'
    ? resolveVisualCaptureDriver(driverOrName) : resolveVisualCaptureDriver(driverOrName?.name);
  if (!visualCaptureDriverPublishesReportDescriptor(driver)) return EMPTY_DRIVER_FIELDS;
  return Object.freeze({ captureDriver: visualCaptureDriverReportDescriptor(driver) });
}

export function assertVisualCaptureDriverReportDescriptor(driverOrName, actual) {
  const driver = typeof driverOrName === 'string'
    ? resolveVisualCaptureDriver(driverOrName) : resolveVisualCaptureDriver(driverOrName?.name);
  const executable = DRIVER_REGISTRY.executable(driver);
  const expected = executable.publishesReportDescriptor
    ? visualCaptureDriverReportDescriptor(driver) : undefined;
  if (!isDeepStrictEqual(actual, expected)) throw new Error(executable.reportMismatch);
}

export function visualCaptureVariantLabel(driverOrName, valueOrName) {
  return resolveVisualCaptureVariant(driverOrName, valueOrName).label;
}

export function visualCaptureDriverReportDescriptor(driverOrName) {
  const driver = typeof driverOrName === 'string'
    ? resolveVisualCaptureDriver(driverOrName) : resolveVisualCaptureDriver(driverOrName?.name);
  return Object.freeze({
    name: driver.name,
    framebufferAlphaPolicy: driver.framebufferAlphaPolicy,
    variants: Object.freeze(Object.fromEntries(
      driver.variants.map(({ name, selection, label }) => [
        name, Object.freeze({ selection, label }),
      ]),
    )),
  });
}
