import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import { prepareGasMaterialLightingAtlasFixture } from './gas-material-lighting-atlas-fixture';
import { prepareLiquidMotionVfxFixture } from './liquid-motion-vfx-audit';
import { prepareOilMotionVfxFixture } from './oil-motion-vfx-audit';
import { prepareMaterialLightingAtlasFixture } from './material-lighting-atlas-fixture';
import { preparePowderStyleAtlasFixture } from './powder-style-atlas-fixture';
import {
  prepareVisualLabFixture,
  VISUAL_LAB_FIXTURE_IDS,
  VISUAL_LAB_PREPARED_FIXTURE_IDS,
} from './visual-lab-fixture-preparation';

describe('Visual Lab fixture preparation registry', () => {
  it('exposes the exact frozen closed activation IDs', () => {
    expect(VISUAL_LAB_FIXTURE_IDS).toEqual([
      'showcase', 'oil-motion', 'water-motion', 'powder-style-atlas', 'material-lighting-atlas',
      'gas-material-lighting-atlas',
    ]);
    expect(Object.isFrozen(VISUAL_LAB_FIXTURE_IDS)).toBe(true);
  });

  it('exposes the exact frozen closed preparation IDs', () => {
    expect(VISUAL_LAB_PREPARED_FIXTURE_IDS).toEqual([
      'oil-motion', 'water-motion', 'powder-style-atlas', 'material-lighting-atlas',
      'gas-material-lighting-atlas',
    ]);
    expect(Object.isFrozen(VISUAL_LAB_PREPARED_FIXTURE_IDS)).toBe(true);
  });

  it.each([
    ['oil-motion', (simulation: RenderLabBackend) => prepareOilMotionVfxFixture(simulation, 'moving')],
    ['water-motion', (simulation: RenderLabBackend) => prepareLiquidMotionVfxFixture(simulation, 'moving')],
    ['powder-style-atlas', preparePowderStyleAtlasFixture],
    ['material-lighting-atlas', prepareMaterialLightingAtlasFixture],
    ['gas-material-lighting-atlas', prepareGasMaterialLightingAtlasFixture],
  ] as const)('prepares %s byte-identically to its direct moving builder', (id, prepareDirect) => {
    const generic = new RenderLabBackend();
    const direct = new RenderLabBackend();

    expect(prepareVisualLabFixture(generic, id)).toBe(true);
    prepareDirect(direct);

    expect(equalBytes(generic.cells(), direct.cells())).toBe(true);
    expect(equalBytes(generic.walls(), direct.walls())).toBe(true);
    expect(equalBytes(generic.velocity(), direct.velocity())).toBe(true);
  });

  it('acknowledges showcase without mutating a seeded backend', () => {
    const simulation = new RenderLabBackend();
    simulation.paint(12, 18, Material.Fire, 2);
    simulation.paintWall(20, 24, 1, 0);
    simulation.setFixtureVelocityRect(28, 32, 3, 2, 47, -53);
    const cells = simulation.cells().slice();
    const walls = simulation.walls().slice();
    const velocity = simulation.velocity().slice();

    expect(prepareVisualLabFixture(simulation, 'showcase')).toBe(false);
    expect(equalBytes(simulation.cells(), cells)).toBe(true);
    expect(equalBytes(simulation.walls(), walls)).toBe(true);
    expect(equalBytes(simulation.velocity(), velocity)).toBe(true);
  });

  it('rejects an invalid runtime ID before mutating a seeded backend', () => {
    const simulation = new RenderLabBackend();
    simulation.paint(12, 18, Material.Fire, 2);
    simulation.paintWall(20, 24, 1, 0);
    simulation.setFixtureVelocityRect(28, 32, 3, 2, 47, -53);
    const cells = simulation.cells().slice();
    const walls = simulation.walls().slice();
    const velocity = simulation.velocity().slice();

    expect(() => prepareVisualLabFixture(simulation, 'not-a-fixture' as never))
      .toThrow('Unknown Visual Lab fixture');

    expect(equalBytes(simulation.cells(), cells)).toBe(true);
    expect(equalBytes(simulation.walls(), walls)).toBe(true);
    expect(equalBytes(simulation.velocity(), velocity)).toBe(true);
  });
});

function equalBytes(left: ArrayLike<number>, right: ArrayLike<number>): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}
