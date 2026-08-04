import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  GAS_MOTION_VFX_AUDIT, prepareGasMotionVfxFixture, type GasMotionVfxPoint,
} from './gas-motion-vfx-audit';

function cell(simulation: RenderLabBackend, point: GasMotionVfxPoint): number {
  return simulation.cells()[point.y * simulation.width + point.x];
}

function velocity(simulation: RenderLabBackend, point: GasMotionVfxPoint): readonly [number, number] {
  const offset = (point.y * simulation.width + point.x) * 2;
  return [simulation.velocity()[offset], simulation.velocity()[offset + 1]];
}

function centre(rect: { x: number; y: number; width: number; height: number }): GasMotionVfxPoint {
  return { x: Math.floor(rect.x + rect.width / 2), y: Math.floor(rect.y + rect.height / 2) };
}

describe('gas-motion VFX audit fixture', () => {
  it('authors dense directed gas while keeping holes and channels velocity-free', () => {
    const simulation = new RenderLabBackend();
    prepareGasMotionVfxFixture(simulation, 'directed');

    for (const entry of GAS_MOTION_VFX_AUDIT.cards) {
      const core = centre(entry.coreProbe);
      expect(cell(simulation, core)).toBe(entry.material);
      expect(velocity(simulation, core)).toEqual([entry.velocity.x, entry.velocity.y]);
      for (const empty of [centre(entry.authoredHole), centre(entry.openChannel)]) {
        expect(cell(simulation, empty)).toBe(Material.Empty);
        expect(velocity(simulation, empty)).toEqual([0, 0]);
      }
    }
  });

  it('keeps stationary, sparse, contact, wall, and blank controls exact', () => {
    const simulation = new RenderLabBackend();
    prepareGasMotionVfxFixture(simulation, 'directed');
    const still = GAS_MOTION_VFX_AUDIT.stillCloud;
    expect(cell(simulation, centre(still.coreProbe))).toBe(still.material);
    expect(velocity(simulation, centre(still.coreProbe))).toEqual([0, 0]);
    expect(cell(simulation, centre(still.authoredHole))).toBe(Material.Empty);

    for (const entry of GAS_MOTION_VFX_AUDIT.sparseChains) {
      for (const carrier of entry.carriers) {
        expect(cell(simulation, carrier)).toBe(entry.material);
        expect(velocity(simulation, carrier)).toEqual([0, 0]);
      }
      expect(cell(simulation, entry.midpoint)).toBe(Material.Empty);
      expect(cell(simulation, entry.gap)).toBe(Material.Empty);
      expect(cell(simulation, entry.isolated)).toBe(entry.material);
      expect(velocity(simulation, entry.isolated)).toEqual([0, 0]);
    }

    expect(cell(simulation, centre(GAS_MOTION_VFX_AUDIT.solidContact.gas))).toBe(Material.Smoke);
    expect(cell(simulation, centre(GAS_MOTION_VFX_AUDIT.solidContact.solid))).toBe(Material.Metal);
    expect(cell(simulation, centre(GAS_MOTION_VFX_AUDIT.liquidContact.gas))).toBe(Material.FOG);
    expect(cell(simulation, centre(GAS_MOTION_VFX_AUDIT.liquidContact.liquid))).toBe(Material.Water);
    expect(simulation.walls()[
      GAS_MOTION_VFX_AUDIT.nativeWall.y * simulation.width + GAS_MOTION_VFX_AUDIT.nativeWall.x
    ]).toBe(1);
    expect(cell(simulation, centre(GAS_MOTION_VFX_AUDIT.guardedBlank))).toBe(Material.Empty);
  });

  it('keeps a lower-left Smoke counterflow topology while alternating only exact owners', () => {
    const directed = new RenderLabBackend();
    const reversed = new RenderLabBackend();
    const still = new RenderLabBackend();
    prepareGasMotionVfxFixture(directed, 'directed');
    prepareGasMotionVfxFixture(reversed, 'reversed');
    prepareGasMotionVfxFixture(still, 'still');
    const counterflow = GAS_MOTION_VFX_AUDIT.counterflow;
    let owners = 0;
    for (let y = counterflow.body.y; y < counterflow.body.y + counterflow.body.height; y++) {
      for (let x = counterflow.body.x; x < counterflow.body.x + counterflow.body.width; x++) {
        const point = { x, y };
        expect(cell(directed, point)).toBe(cell(still, point));
        const isOwner = cell(directed, point) === counterflow.material;
        if (!isOwner) {
          expect(velocity(directed, point)).toEqual([0, 0]);
          expect(velocity(reversed, point)).toEqual([0, 0]);
          continue;
        }
        owners++;
        const sign = ((x + y) & 1) === 0 ? 1 : -1;
        expect(velocity(directed, point)).toEqual([sign * counterflow.velocityMagnitude, 0]);
        expect(velocity(reversed, point)).toEqual([-sign * counterflow.velocityMagnitude, 0]);
        expect(velocity(still, point)).toEqual([0, 0]);
      }
    }
    expect(owners).toBeGreaterThan(4_000);
    for (const empty of [centre(counterflow.authoredHole), centre(counterflow.openChannel)]) {
      expect(cell(directed, empty)).toBe(Material.Empty);
      expect(velocity(directed, empty)).toEqual([0, 0]);
    }
    for (const probe of [counterflow.leftProbe, counterflow.rightProbe]) {
      expect(cell(directed, centre(probe))).toBe(counterflow.material);
    }
  });

  it('changes only eligible velocity bytes between directed and still modes', () => {
    const directed = new RenderLabBackend();
    const reversed = new RenderLabBackend();
    const still = new RenderLabBackend();
    prepareGasMotionVfxFixture(directed, 'directed');
    prepareGasMotionVfxFixture(reversed, 'reversed');
    prepareGasMotionVfxFixture(still, 'still');

    expect(equalBytes(directed.cells(), still.cells())).toBe(true);
    expect(equalBytes(reversed.cells(), still.cells())).toBe(true);
    expect(equalBytes(directed.walls(), still.walls())).toBe(true);
    expect(equalBytes(reversed.walls(), still.walls())).toBe(true);
    expect(still.velocity().some(Boolean)).toBe(false);
    expect(directed.velocity().some(Boolean)).toBe(true);
    let reversedMismatch = 0;
    for (let offset = 0; offset < directed.velocity().length; offset++) {
      reversedMismatch += Number(reversed.velocity()[offset] !== -directed.velocity()[offset]);
    }
    expect(reversedMismatch).toBe(0);

    let directedOwners = 0;
    let invalidOwners = 0;
    for (let index = 0; index < directed.cells().length; index++) {
      const velocityOffset = index * 2;
      if (directed.velocity()[velocityOffset] === 0
        && directed.velocity()[velocityOffset + 1] === 0) continue;
      directedOwners++;
      const x = index % directed.width;
      const y = Math.floor(index / directed.width);
      const owner = directed.cells()[index];
      const directedCardOwner = GAS_MOTION_VFX_AUDIT.cards.some((entry) => (
        entry.material === owner && x >= entry.body.x && x < entry.body.x + entry.body.width
          && y >= entry.body.y && y < entry.body.y + entry.body.height
      ));
      const counterflow = GAS_MOTION_VFX_AUDIT.counterflow;
      const counterflowOwner = owner === counterflow.material
        && x >= counterflow.body.x && x < counterflow.body.x + counterflow.body.width
        && y >= counterflow.body.y && y < counterflow.body.y + counterflow.body.height;
      if (!directedCardOwner && !counterflowOwner) invalidOwners++;
    }
    expect(directedOwners).toBeGreaterThan(20_000);
    expect(invalidOwners).toBe(0);
  });

  it('is deterministic and rejects non-render-lab or wrong-sized backends', () => {
    const first = new RenderLabBackend();
    const second = new RenderLabBackend();
    prepareGasMotionVfxFixture(first, 'directed');
    prepareGasMotionVfxFixture(second, 'directed');
    expect(equalBytes(first.cells(), second.cells())).toBe(true);
    expect(equalBytes(first.velocity(), second.velocity())).toBe(true);
    expect(equalBytes(first.walls(), second.walls())).toBe(true);

    expect(() => prepareGasMotionVfxFixture(new DeterministicBackend(612, 384), 'directed'))
      .toThrow('render-lab velocity and wall planes');
    expect(() => prepareGasMotionVfxFixture(new RenderLabBackend(32, 32), 'directed'))
      .toThrow('612x384');
  });
});

function equalBytes(left: Uint8Array | Int8Array, right: Uint8Array | Int8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
