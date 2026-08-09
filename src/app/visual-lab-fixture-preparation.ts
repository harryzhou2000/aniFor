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

export type VisualLabPreparedFixtureId = PreparedStaticVisualLabFixture['name'];

const STATIC_VISUAL_CAPTURE_FIXTURES: readonly StaticVisualLabFixture[] = [
  ...VISUAL_LAB_STATIC_CONTRACT.fixtures,
  ...VISUAL_CAPTURE_STATIC_CONTRACT.fixtures,
];

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

function isVisualLabPreparedFixtureId(fixture: string): fixture is VisualLabPreparedFixtureId {
  return Object.hasOwn(VISUAL_LAB_FIXTURE_PREPARERS, fixture);
}

/** Rejects an untrusted browser string before it can mutate simulation state. */
export function prepareVisualLabFixture(
  simulation: SimulationBackend,
  fixture: VisualLabPreparedFixtureId,
): void {
  if (!isVisualLabPreparedFixtureId(fixture)) {
    throw new Error(`Unknown prepared Visual Lab fixture ${JSON.stringify(fixture)}`);
  }
  VISUAL_LAB_FIXTURE_PREPARERS[fixture](simulation);
}
