import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { RenderPhase, renderPhase } from '../renderer/render-profile';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  POWDER_SOLID_CONTACT_VFX_AUDIT, preparePowderSolidContactVfxAudit,
  type PowderSolidContactVfxPoint, type PowderSolidContactVfxRect,
} from './powder-solid-contact-vfx-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;

describe('powder/solid contact VFX audit fixture', () => {
  it('pins the three exact settled Powder/Solid target pairs', () => {
    expect(POWDER_SOLID_CONTACT_VFX_AUDIT.targets.map(({ code }) => code)).toEqual([
      'SAND_BRICK', 'CLAY_METAL', 'CONCRETE_GLASS',
    ]);
    expect(POWDER_SOLID_CONTACT_VFX_AUDIT.targets.map(({ powderMaterial, solidMaterial }) => [
      powderMaterial, solidMaterial,
    ])).toEqual([
      [Material.Sand, Material.Brick], [Material.Clay, Material.Metal], [Material.Concrete, Material.Glass],
    ]);
    for (const entry of POWDER_SOLID_CONTACT_VFX_AUDIT.targets) {
      const powder = ALL_MATERIALS.find(({ id }) => id === entry.powderMaterial);
      const solid = ALL_MATERIALS.find(({ id }) => id === entry.solidMaterial);
      expect(powder && renderPhase(powder)).toBe(RenderPhase.Powder);
      expect(solid && renderPhase(solid)).toBe(RenderPhase.Solid);
      expect(rectInside(entry.powder, world)).toBe(true);
      expect(rectInside(entry.solid, world)).toBe(true);
      expect(entry.powder.y + entry.powder.height).toBe(entry.solid.y);
      expect(entry.seam.y).toBe(entry.solid.y - 1);
    }
  });

  it('direct-fills exact material, velocity, wet, wall, unlike, and air controls', () => {
    const simulation = new RenderLabBackend(WORLD_WIDTH, WORLD_HEIGHT);
    preparePowderSolidContactVfxAudit(simulation);
    const cells = simulation.cells();
    const walls = simulation.walls();
    const velocity = simulation.velocity();

    for (const entry of POWDER_SOLID_CONTACT_VFX_AUDIT.targets) {
      expectRect(cells, entry.powder, entry.powderMaterial);
      expectRect(cells, entry.solid, entry.solidMaterial);
    }
    const fixture = POWDER_SOLID_CONTACT_VFX_AUDIT;
    expectRect(cells, fixture.moving.powder, Material.Sand);
    expectRect(cells, fixture.moving.solid, Material.Brick);
    expectVelocityRect(velocity, fixture.moving.powder, fixture.moving.velocity);
    expectRect(cells, fixture.fine.powder, Material.Clay);
    expectRect(cells, fixture.fine.solid, Material.Metal);
    expect(materialAt(cells, fixture.isolated.powder)).toBe(Material.Sand);
    expectRect(cells, fixture.isolated.solid, Material.Glass);

    forEachPoint(fixture.wet.water, (point) => {
      expect(materialAt(cells, point)).toBe(
        fixture.wet.sandPoints.some((sand) => sand.x === point.x && sand.y === point.y)
          ? Material.Sand : Material.Water,
      );
    });
    expect(materialAt(cells, fixture.wet.probe)).toBe(Material.Sand);
    expectRect(cells, fixture.wall.powder, Material.Concrete);
    expectRect(cells, fixture.wall.solid, Material.Brick);
    expect(walls[fixture.wall.wallPoint.y * WORLD_WIDTH + fixture.wall.wallPoint.x]).toBe(fixture.conductiveWall);
    expect(materialAt(cells, fixture.wall.wallPoint)).toBe(Material.Concrete);
    expect(walls[fixture.wall.probe.y * WORLD_WIDTH + fixture.wall.probe.x]).toBe(fixture.conductiveWall);
    expect(materialAt(cells, fixture.wall.probe)).toBe(Material.Concrete);

    expectRect(cells, fixture.unlikePowder.sand, Material.Sand);
    expectRect(cells, fixture.unlikePowder.clay, Material.Clay);
    expectRect(cells, fixture.unlikePowder.solid, Material.Brick);
    expect(materialAt(cells, fixture.unlikePowder.seam)).toBe(Material.Clay);
    expectRect(cells, fixture.airGap.powder, Material.Sand);
    expectRect(cells, fixture.airGap.gap, Material.Empty);
    expectRect(cells, fixture.airGap.solid, Material.Brick);
    expect(materialAt(cells, fixture.airGap.probe)).toBe(Material.Empty);
  });

  it('is byte deterministic, clears stale state, and rejects non-render-lab backends', () => {
    const first = new RenderLabBackend(WORLD_WIDTH, WORLD_HEIGHT);
    const second = new RenderLabBackend(WORLD_WIDTH, WORLD_HEIGHT);
    preparePowderSolidContactVfxAudit(first);
    preparePowderSolidContactVfxAudit(second);
    expect(byteHash(first.cells())).toBe(byteHash(second.cells()));
    expect(byteHash(first.walls())).toBe(byteHash(second.walls()));
    expect(byteHash(first.velocity())).toBe(byteHash(second.velocity()));

    const expectedCells = first.cells().slice();
    const expectedWalls = first.walls().slice();
    const expectedVelocity = first.velocity().slice();
    first.cells().fill(Material.Fire);
    first.paintWall(4, 4, 1, 0);
    first.setFixtureVelocityRect(0, 0, 20, 20, 31, -31);
    preparePowderSolidContactVfxAudit(first);
    expect(byteHash(first.cells())).toBe(byteHash(expectedCells));
    expect(byteHash(first.walls())).toBe(byteHash(expectedWalls));
    expect(byteHash(first.velocity())).toBe(byteHash(expectedVelocity));

    expect(() => preparePowderSolidContactVfxAudit(new RenderLabBackend(32, 32)))
      .toThrow('requires 612x384');
    expect(() => preparePowderSolidContactVfxAudit(new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT)))
      .toThrow('requires the render-lab wall and velocity planes');
  });
});

const world: PowderSolidContactVfxRect = { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT };

function materialAt(cells: Uint8Array, point: PowderSolidContactVfxPoint): Material {
  return cells[point.y * WORLD_WIDTH + point.x] as Material;
}

function expectRect(cells: Uint8Array, rect: PowderSolidContactVfxRect, material: Material): void {
  forEachPoint(rect, (point) => expect(materialAt(cells, point)).toBe(material));
}

function expectVelocityRect(
  velocity: Int8Array, rect: PowderSolidContactVfxRect, expected: readonly [number, number],
): void {
  forEachPoint(rect, ({ x, y }) => {
    const offset = (y * WORLD_WIDTH + x) * 2;
    expect([velocity[offset], velocity[offset + 1]]).toEqual(expected);
  });
}

function rectInside(inner: PowderSolidContactVfxRect, outer: PowderSolidContactVfxRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

function forEachPoint(rect: PowderSolidContactVfxRect, visit: (point: PowderSolidContactVfxPoint) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}

function byteHash(values: Uint8Array | Int8Array): number {
  let hash = 2166136261;
  for (const value of values) hash = Math.imul(hash ^ (value & 0xff), 16777619) >>> 0;
  return hash;
}
