import type { SimulationBackend } from '../simulation';
import { prepareLiquidMotionVfxFixture } from './liquid-motion-vfx-audit';
import { prepareOilMotionVfxFixture } from './oil-motion-vfx-audit';

type VisualLabFixturePreparer = (simulation: SimulationBackend) => void;

/**
 * App-owned preparation registry for fixtures exposed through the generic
 * Visual Lab browser bridge. Arguments stay on this typed side of the CDP
 * boundary instead of travelling as free-form method names and arrays.
 */
const VISUAL_LAB_FIXTURE_PREPARERS = Object.freeze({
  'oil-motion': (simulation) => prepareOilMotionVfxFixture(simulation, 'moving'),
  'water-motion': (simulation) => prepareLiquidMotionVfxFixture(simulation, 'moving'),
} satisfies Record<string, VisualLabFixturePreparer>);

export type VisualLabPreparedFixtureId = keyof typeof VISUAL_LAB_FIXTURE_PREPARERS;

export const VISUAL_LAB_PREPARED_FIXTURE_IDS = Object.freeze(
  Object.keys(VISUAL_LAB_FIXTURE_PREPARERS) as VisualLabPreparedFixtureId[],
);

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
