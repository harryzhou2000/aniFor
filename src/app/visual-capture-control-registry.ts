import type { PowderRenderStyle } from '../renderer/powder-render-style';
import { VISUAL_CAPTURE_STATIC_FIXTURES } from '../shared/visual-capture-static-catalog.js';
import { VISUAL_CAPTURE_STATIC_CONTRACT } from '../shared/visual-capture-static-contract.js';
import {
  VISUAL_LAB_FIXTURE_IDS,
  type VisualLabFixtureId,
} from './visual-lab-fixture-preparation';

export type VisualCaptureControlVariant = 0 | 1 | 2;

export interface VisualCaptureControlHost {
  setPowderRenderStyle(style: PowderRenderStyle): void;
  getPowderRenderStyle(): PowderRenderStyle;
  setVisualLabVariant(variant: VisualCaptureControlVariant): void;
  getVisualLabVariant(): VisualCaptureControlVariant;
  setMaterialLightingVariant(variant: VisualCaptureControlVariant): void;
  getMaterialLightingVariant(): VisualCaptureControlVariant;
}

const POWDER_STYLE_BY_VARIANT = Object.freeze({
  0: 'smooth',
  1: 'local',
  2: 'grains',
} satisfies Record<VisualCaptureControlVariant, PowderRenderStyle>);

type VisualCaptureControlDriver = (
  typeof VISUAL_CAPTURE_STATIC_CONTRACT.drivers[number]['name']
);

interface VisualCaptureControlDescriptor {
  set(host: VisualCaptureControlHost, variant: VisualCaptureControlVariant): void;
  get(host: VisualCaptureControlHost): VisualCaptureControlVariant;
}

/**
 * Closed executable side of driver-owned same-page controls. A fixture using an
 * existing driver needs only a static-contract entry; the browser bridge and
 * app registry remain unchanged.
 */
const VISUAL_CAPTURE_CONTROL_DESCRIPTORS = Object.freeze({
  'normal-hdr': Object.freeze({
    set: (host: VisualCaptureControlHost, variant: VisualCaptureControlVariant) => {
      host.setVisualLabVariant(variant);
    },
    get: (host: VisualCaptureControlHost) => host.getVisualLabVariant(),
  }),
  'powder-render-style': Object.freeze({
    set: (host: VisualCaptureControlHost, variant: VisualCaptureControlVariant) => {
      host.setPowderRenderStyle(POWDER_STYLE_BY_VARIANT[variant]);
    },
    get: (host: VisualCaptureControlHost) => (
      variantForPowderStyle(host.getPowderRenderStyle())
    ),
  }),
  'material-lighting-profile': Object.freeze({
    set: (host: VisualCaptureControlHost, variant: VisualCaptureControlVariant) => {
      host.setMaterialLightingVariant(variant);
    },
    get: (host: VisualCaptureControlHost) => host.getMaterialLightingVariant(),
  }),
} satisfies Record<VisualCaptureControlDriver, VisualCaptureControlDescriptor>);

const VISUAL_CAPTURE_CONTROL_FIXTURES = Object.freeze([
  ...VISUAL_CAPTURE_STATIC_FIXTURES.map(({ name, driver }) => Object.freeze({
    fixture: name,
    driver,
  })),
]);

/** Fixtures whose same-page A/B control is implemented by this registry. */
export const VISUAL_CAPTURE_CONTROL_FIXTURE_IDS = Object.freeze(
  VISUAL_CAPTURE_CONTROL_FIXTURES.map(({ fixture }) => fixture),
);

const CONTROL_BY_FIXTURE = new Map<VisualLabFixtureId, VisualCaptureControlDescriptor>();
for (const { fixture, driver } of VISUAL_CAPTURE_CONTROL_FIXTURES) {
  if (!VISUAL_LAB_FIXTURE_IDS.some((known) => known === fixture)) {
    throw new TypeError(
      `Visual capture control fixture ${JSON.stringify(fixture)} is not a known fixture`,
    );
  }
  if (CONTROL_BY_FIXTURE.has(fixture)) {
    throw new TypeError(
      `Duplicate Visual capture control fixture ${JSON.stringify(fixture)}`,
    );
  }
  CONTROL_BY_FIXTURE.set(fixture, VISUAL_CAPTURE_CONTROL_DESCRIPTORS[driver]);
}
if (CONTROL_BY_FIXTURE.size !== VISUAL_LAB_FIXTURE_IDS.length
  || VISUAL_LAB_FIXTURE_IDS.some((fixture) => !CONTROL_BY_FIXTURE.has(fixture))) {
  throw new TypeError('Visual capture control registry does not match the fixture catalog');
}

/**
 * App-owned, fixture-scoped same-page capture controls.
 *
 * Preparation must be acknowledged separately so a capture request cannot
 * mutate whichever unrelated scene happens to be mounted in the page.
 */
export class VisualCaptureControlRegistry {
  private activeFixture?: VisualLabFixtureId;

  constructor(private readonly host: VisualCaptureControlHost) {}

  markFixturePrepared(fixture: VisualLabFixtureId): void {
    assertKnownFixture(fixture);
    this.activeFixture = fixture;
  }

  setVariant(
    fixture: VisualLabFixtureId,
    variant: VisualCaptureControlVariant,
  ): void {
    const control = this.requireActiveFixture(fixture);
    assertVisualCaptureControlVariant(variant);
    control.set(this.host, variant);
    const observedVariant = this.readVariant(control);
    if (observedVariant !== variant) {
      throw new Error(
        `Visual capture control host did not apply ${JSON.stringify(fixture)} variant ${variant}`,
      );
    }
  }

  getVariant(fixture: VisualLabFixtureId): VisualCaptureControlVariant {
    return this.readVariant(this.requireActiveFixture(fixture));
  }

  private readVariant(control: VisualCaptureControlDescriptor): VisualCaptureControlVariant {
    const observed = control.get(this.host);
    assertVisualCaptureControlVariant(observed);
    return observed;
  }

  private requireActiveFixture(
    fixture: VisualLabFixtureId,
  ): VisualCaptureControlDescriptor {
    assertKnownFixture(fixture);
    if (this.activeFixture === undefined) {
      throw new Error('Visual capture control fixture has not been prepared');
    }
    if (fixture !== this.activeFixture) {
      throw new Error(
        `Visual capture control fixture mismatch: active ${JSON.stringify(this.activeFixture)}, requested ${JSON.stringify(fixture)}`,
      );
    }
    const control = CONTROL_BY_FIXTURE.get(fixture);
    if (!control) {
      throw new Error(`Unsupported Visual capture control fixture ${JSON.stringify(fixture)}`);
    }
    return control;
  }
}

function assertKnownFixture(
  fixture: VisualLabFixtureId,
): asserts fixture is VisualLabFixtureId {
  if (!VISUAL_LAB_FIXTURE_IDS.some((known) => known === fixture)) {
    throw new Error(`Unknown Visual Lab fixture ${JSON.stringify(fixture)}`);
  }
}

function assertVisualCaptureControlVariant(
  variant: VisualCaptureControlVariant,
): asserts variant is VisualCaptureControlVariant {
  if (variant !== 0 && variant !== 1 && variant !== 2) {
    throw new Error(`Invalid Visual capture control variant ${JSON.stringify(variant)}`);
  }
}

function variantForPowderStyle(style: PowderRenderStyle): VisualCaptureControlVariant {
  if (style === 'smooth') return 0;
  if (style === 'local') return 1;
  if (style === 'grains') return 2;
  throw new Error(`Impossible observed powder render style ${JSON.stringify(style)}`);
}
