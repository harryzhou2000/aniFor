import type { SimulationBackend } from '../simulation';
import { VISUAL_CAPTURE_STATIC_FIXTURES } from '../shared/visual-capture-static-catalog.js';
import { prepareCeramicTemperatureVfxFixture } from './ceramic-temperature-vfx-audit';
import { prepareGasMaterialLightingAtlasFixture } from './gas-material-lighting-atlas-fixture';
import { prepareForceActivityGraphicsAuditFixture } from './force-activity-graphics-audit';
import { prepareLiquidMotionVfxFixture } from './liquid-motion-vfx-audit';
import { prepareMaterialLightingAtlasFixture } from './material-lighting-atlas-fixture';
import { prepareOilMotionVfxFixture } from './oil-motion-vfx-audit';
import { preparePowderStyleAtlasFixture } from './powder-style-atlas-fixture';
import { prepareSolidMaterialLightingAtlasFixture } from './solid-material-lighting-atlas-fixture';
import { prepareSourceTargetGraphicsAuditFixture } from './source-target-graphics-audit';

type VisualLabFixturePreparer = (simulation: SimulationBackend) => void;
type StaticVisualLabFixture = (typeof VISUAL_CAPTURE_STATIC_FIXTURES)[number];
type PreparedStaticVisualLabFixture = Extract<
  StaticVisualLabFixture,
  { readonly preparationReportLabel: string }
>;

/** Every static fixture that may be activated through the Visual Lab bridge. */
export type VisualLabFixtureId = StaticVisualLabFixture['name'];
export type VisualLabPreparedFixtureId = PreparedStaticVisualLabFixture['name'];

const STATIC_VISUAL_CAPTURE_FIXTURES: readonly StaticVisualLabFixture[] = VISUAL_CAPTURE_STATIC_FIXTURES;

/** Closed all-fixture domain; `showcase` deliberately activates as a no-op. */
export const VISUAL_LAB_FIXTURE_IDS = Object.freeze(
  STATIC_VISUAL_CAPTURE_FIXTURES.map(({ name }) => name),
) as readonly VisualLabFixtureId[];

const VISUAL_LAB_FIXTURE_ID_SET = new Set<VisualLabFixtureId>(VISUAL_LAB_FIXTURE_IDS);
if (VISUAL_LAB_FIXTURE_ID_SET.size !== VISUAL_LAB_FIXTURE_IDS.length) {
  throw new TypeError('Visual Lab fixture catalog contains duplicate IDs');
}

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
  'material-lighting-atlas': prepareMaterialLightingAtlasFixture,
  'gas-material-lighting-atlas': prepareGasMaterialLightingAtlasFixture,
  'solid-material-lighting-atlas': prepareSolidMaterialLightingAtlasFixture,
  'source-target-material-lighting-atlas': prepareSourceTargetGraphicsAuditFixture,
  'force-activity-material-lighting-atlas': prepareForceActivityGraphicsAuditFixture,
  'thermal-source-material-lighting-atlas': prepareCeramicTemperatureVfxFixture,
} satisfies Record<VisualLabPreparedFixtureId, VisualLabFixturePreparer>);

const REGISTERED_PREPARER_IDS = Object.keys(VISUAL_LAB_FIXTURE_PREPARERS);
if (REGISTERED_PREPARER_IDS.length !== VISUAL_LAB_PREPARED_FIXTURE_IDS.length
  || VISUAL_LAB_PREPARED_FIXTURE_IDS.some((fixture) => (
    !Object.hasOwn(VISUAL_LAB_FIXTURE_PREPARERS, fixture)
  ))) {
  throw new TypeError('Visual Lab fixture preparation registry does not match the static contract');
}

function isVisualLabFixtureId(fixture: string): fixture is VisualLabFixtureId {
  return VISUAL_LAB_FIXTURE_ID_SET.has(fixture as VisualLabFixtureId);
}

function hasVisualLabFixturePreparer(
  fixture: VisualLabFixtureId,
): fixture is VisualLabPreparedFixtureId {
  return Object.hasOwn(VISUAL_LAB_FIXTURE_PREPARERS, fixture);
}

/** Rejects an untrusted browser string before it can mutate simulation state. */
export function prepareVisualLabFixture(
  simulation: SimulationBackend,
  fixture: VisualLabFixtureId,
): boolean {
  if (!isVisualLabFixtureId(fixture)) {
    throw new Error(`Unknown Visual Lab fixture ${JSON.stringify(fixture)}`);
  }
  if (!hasVisualLabFixturePreparer(fixture)) return false;
  VISUAL_LAB_FIXTURE_PREPARERS[fixture](simulation);
  return true;
}
