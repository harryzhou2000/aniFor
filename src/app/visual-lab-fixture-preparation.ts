import type { SimulationBackend } from '../simulation';
import { VISUAL_CAPTURE_STATIC_CONTRACT } from '../shared/visual-capture-static-contract.js';
import { VISUAL_LAB_STATIC_CONTRACT } from '../shared/visual-lab-static-contract.js';
import { prepareLiquidMotionVfxFixture } from './liquid-motion-vfx-audit';
import { prepareOilMotionVfxFixture } from './oil-motion-vfx-audit';
import { preparePowderStyleAtlasFixture } from './powder-style-atlas-fixture';

type VisualLabFixturePreparer = (simulation: SimulationBackend) => void;
type StaticVisualLabFixture = (typeof VISUAL_LAB_STATIC_CONTRACT.fixtures)[number]
  | (typeof VISUAL_CAPTURE_STATIC_CONTRACT.fixtures)[number];
type PreparedStaticVisualLabFixture = Extract<
  StaticVisualLabFixture,
  { readonly preparationReportLabel: string }
>;

/** Every static fixture that may be activated through the Visual Lab bridge. */
export type VisualLabFixtureId = StaticVisualLabFixture['name'];
export type VisualLabPreparedFixtureId = PreparedStaticVisualLabFixture['name'];

const STATIC_VISUAL_CAPTURE_FIXTURES: readonly StaticVisualLabFixture[] = [
  ...VISUAL_LAB_STATIC_CONTRACT.fixtures,
  ...VISUAL_CAPTURE_STATIC_CONTRACT.fixtures,
];

/** Closed all-fixture domain; `showcase` deliberately activates as a no-op. */
export const VISUAL_LAB_FIXTURE_IDS = Object.freeze(
  STATIC_VISUAL_CAPTURE_FIXTURES.map(({ name }) => name),
) as readonly VisualLabFixtureId[];

const PREPARED_STATIC_VISUAL_LAB_FIXTURES = STATIC_VISUAL_CAPTURE_FIXTURES.filter(
  (fixture): fixture is PreparedStaticVisualLabFixture => (
    fixture.preparationReportLabel !== null
  ),
);

export const VISUAL_LAB_PREPARED_FIXTURE_IDS = Object.freeze(
  PREPARED_STATIC_VISUAL_LAB_FIXTURES.map(({ name }) => name),
);

/**
 * App-owned preparation registry for fixtures exposed through the generic
 * Visual Lab browser bridge. Arguments stay on this typed side of the CDP
 * boundary instead of travelling as free-form method names and arrays.
 */
const VISUAL_LAB_FIXTURE_PREPARERS = Object.freeze({
  'oil-motion': (simulation) => prepareOilMotionVfxFixture(simulation, 'moving'),
  'water-motion': (simulation) => prepareLiquidMotionVfxFixture(simulation, 'moving'),
  'powder-style-atlas': preparePowderStyleAtlasFixture,
} satisfies Record<VisualLabPreparedFixtureId, VisualLabFixturePreparer>);

const REGISTERED_PREPARER_IDS = Object.keys(VISUAL_LAB_FIXTURE_PREPARERS);
if (REGISTERED_PREPARER_IDS.length !== VISUAL_LAB_PREPARED_FIXTURE_IDS.length
  || VISUAL_LAB_PREPARED_FIXTURE_IDS.some((fixture) => (
    !Object.hasOwn(VISUAL_LAB_FIXTURE_PREPARERS, fixture)
  ))) {
  throw new TypeError('Visual Lab fixture preparation registry does not match the static contract');
}

type VisualLabFixtureActivation = (simulation: SimulationBackend) => boolean;

/**
 * Closed app-owned activation registry. A fixture without a concrete preparer
 * is still acknowledged through this boundary, never via a special browser API.
 */
const VISUAL_LAB_FIXTURE_ACTIVATIONS = Object.freeze({
  showcase: () => false,
  'oil-motion': (simulation) => {
    VISUAL_LAB_FIXTURE_PREPARERS['oil-motion'](simulation);
    return true;
  },
  'water-motion': (simulation) => {
    VISUAL_LAB_FIXTURE_PREPARERS['water-motion'](simulation);
    return true;
  },
  'powder-style-atlas': (simulation) => {
    VISUAL_LAB_FIXTURE_PREPARERS['powder-style-atlas'](simulation);
    return true;
  },
} satisfies Record<VisualLabFixtureId, VisualLabFixtureActivation>);

const REGISTERED_ACTIVATION_IDS = Object.keys(VISUAL_LAB_FIXTURE_ACTIVATIONS);
if (REGISTERED_ACTIVATION_IDS.length !== VISUAL_LAB_FIXTURE_IDS.length
  || VISUAL_LAB_FIXTURE_IDS.some((fixture) => (
    !Object.hasOwn(VISUAL_LAB_FIXTURE_ACTIVATIONS, fixture)
  ))) {
  throw new TypeError('Visual Lab fixture activation registry does not match the static contract');
}

function isVisualLabFixtureId(fixture: string): fixture is VisualLabFixtureId {
  return Object.hasOwn(VISUAL_LAB_FIXTURE_ACTIVATIONS, fixture);
}

/** Rejects an untrusted browser string before it can mutate simulation state. */
export function prepareVisualLabFixture(
  simulation: SimulationBackend,
  fixture: VisualLabFixtureId,
): boolean {
  if (!isVisualLabFixtureId(fixture)) {
    throw new Error(`Unknown Visual Lab fixture ${JSON.stringify(fixture)}`);
  }
  return VISUAL_LAB_FIXTURE_ACTIVATIONS[fixture](simulation);
}
