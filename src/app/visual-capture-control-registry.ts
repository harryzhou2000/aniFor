import type { PowderRenderStyle } from '../renderer/powder-render-style';
import {
  VISUAL_LAB_PREPARED_FIXTURE_IDS,
  type VisualLabPreparedFixtureId,
} from './visual-lab-fixture-preparation';

export type VisualCaptureControlVariant = 0 | 1 | 2;

export interface VisualCaptureControlHost {
  setPowderRenderStyle(style: PowderRenderStyle): void;
  getPowderRenderStyle(): PowderRenderStyle;
}

const POWDER_STYLE_BY_VARIANT = Object.freeze({
  0: 'smooth',
  1: 'local',
  2: 'grains',
} satisfies Record<VisualCaptureControlVariant, PowderRenderStyle>);

interface VisualCaptureControlDescriptor {
  readonly fixture: VisualLabPreparedFixtureId;
  set(host: VisualCaptureControlHost, variant: VisualCaptureControlVariant): void;
  get(host: VisualCaptureControlHost): VisualCaptureControlVariant;
}

/**
 * Closed executable side of fixture-owned same-page controls. Future material
 * experiments add one descriptor here; the browser bridge remains unchanged.
 */
const VISUAL_CAPTURE_CONTROL_DESCRIPTORS = Object.freeze([
  Object.freeze({
    fixture: 'powder-style-atlas',
    set: (host: VisualCaptureControlHost, variant: VisualCaptureControlVariant) => {
      host.setPowderRenderStyle(POWDER_STYLE_BY_VARIANT[variant]);
    },
    get: (host: VisualCaptureControlHost) => (
      variantForPowderStyle(host.getPowderRenderStyle())
    ),
  }),
] satisfies readonly VisualCaptureControlDescriptor[]);

/** Fixtures whose same-page A/B control is implemented by this registry. */
export const VISUAL_CAPTURE_CONTROL_FIXTURE_IDS = Object.freeze(
  VISUAL_CAPTURE_CONTROL_DESCRIPTORS.map(({ fixture }) => fixture),
);

const CONTROL_BY_FIXTURE = new Map<VisualLabPreparedFixtureId, VisualCaptureControlDescriptor>();
for (const descriptor of VISUAL_CAPTURE_CONTROL_DESCRIPTORS) {
  if (!VISUAL_LAB_PREPARED_FIXTURE_IDS.some((prepared) => prepared === descriptor.fixture)) {
    throw new TypeError(
      `Visual capture control fixture ${JSON.stringify(descriptor.fixture)} is not a prepared fixture`,
    );
  }
  if (CONTROL_BY_FIXTURE.has(descriptor.fixture)) {
    throw new TypeError(
      `Duplicate Visual capture control fixture ${JSON.stringify(descriptor.fixture)}`,
    );
  }
  CONTROL_BY_FIXTURE.set(descriptor.fixture, descriptor);
}

/**
 * App-owned, fixture-scoped same-page capture controls.
 *
 * Preparation must be acknowledged separately so a capture request cannot
 * mutate whichever unrelated scene happens to be mounted in the page.
 */
export class VisualCaptureControlRegistry {
  private activeFixture?: VisualLabPreparedFixtureId;

  constructor(private readonly host: VisualCaptureControlHost) {}

  markFixturePrepared(fixture: VisualLabPreparedFixtureId): void {
    assertKnownPreparedFixture(fixture);
    this.activeFixture = fixture;
  }

  setVariant(
    fixture: VisualLabPreparedFixtureId,
    variant: VisualCaptureControlVariant,
  ): void {
    const control = this.requireActiveFixture(fixture);
    assertVisualCaptureControlVariant(variant);
    control.set(this.host, variant);
    const observedVariant = control.get(this.host);
    if (observedVariant !== variant) {
      throw new Error(
        `Visual capture control host did not apply ${JSON.stringify(fixture)} variant ${variant}`,
      );
    }
  }

  getVariant(fixture: VisualLabPreparedFixtureId): VisualCaptureControlVariant {
    return this.requireActiveFixture(fixture).get(this.host);
  }

  private requireActiveFixture(
    fixture: VisualLabPreparedFixtureId,
  ): VisualCaptureControlDescriptor {
    assertKnownPreparedFixture(fixture);
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

function assertKnownPreparedFixture(
  fixture: VisualLabPreparedFixtureId,
): asserts fixture is VisualLabPreparedFixtureId {
  if (!VISUAL_LAB_PREPARED_FIXTURE_IDS.some((prepared) => prepared === fixture)) {
    throw new Error(`Unknown prepared Visual Lab fixture ${JSON.stringify(fixture)}`);
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
