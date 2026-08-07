import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  WATER_CURVATURE_VFX_AUDIT, prepareWaterCurvatureVfxFixture,
  type WaterCurvatureVfxPoint, type WaterCurvatureVfxRect,
} from './water-curvature-vfx-audit';

const WIDTH = 612;
const HEIGHT = 384;

function cell(simulation: RenderLabBackend, point: WaterCurvatureVfxPoint): number {
  return simulation.cells()[point.y * WIDTH + point.x];
}

function velocity(simulation: RenderLabBackend, point: WaterCurvatureVfxPoint): readonly [number, number] {
  const offset = (point.y * WIDTH + point.x) * 2;
  return [simulation.velocity()[offset], simulation.velocity()[offset + 1]];
}

function centre(rect: WaterCurvatureVfxRect): WaterCurvatureVfxPoint {
  return { x: rect.x + Math.floor(rect.width / 2), y: rect.y + Math.floor(rect.height / 2) };
}

describe('Water curvature VFX audit fixture', () => {
  it('authors one broad connected Water body with flat, convex, and concave surface evidence', () => {
    const simulation = prepared('moving');
    const { body } = WATER_CURVATURE_VFX_AUDIT;
    expect(cell(simulation, { x: 72, y: 65 })).toBe(Material.Empty);
    expect(cell(simulation, { x: 72, y: 66 })).toBe(Material.Water);
    expect(cell(simulation, { x: 159, y: 53 })).toBe(Material.Empty);
    expect(cell(simulation, { x: 159, y: 54 })).toBe(Material.Water);
    forEach(body.concaveInlet, (point) => expect(cell(simulation, point)).toBe(Material.Empty));
    expect(cell(simulation, { x: 260, y: 92 })).toBe(Material.Water);
    forEach(body.authoredHole, (point) => expect(cell(simulation, point)).toBe(Material.Empty));
    forEach(body.openChannel, (point) => expect(cell(simulation, point)).toBe(Material.Empty));
    expect(cell(simulation, centre(body.deepCore))).toBe(Material.Water);
    expect(velocity(simulation, centre(body.authoredHole))).toEqual([0, 0]);
    expect(velocity(simulation, centre(body.openChannel))).toEqual([0, 0]);
  });

  it('changes only documented exact-owner velocity bytes between still and moving forms', () => {
    const moving = prepared('moving');
    const still = prepared('still');
    const fixture = WATER_CURVATURE_VFX_AUDIT;
    expect(equalBytes(moving.cells(), still.cells())).toBe(true);
    expect(equalBytes(moving.walls(), still.walls())).toBe(true);
    expect(still.velocity().some(Boolean)).toBe(false);
    expect(velocity(moving, centre(fixture.body.deepCore))).toEqual([
      fixture.body.velocity.x, fixture.body.velocity.y,
    ]);
    for (const entry of [fixture.moving.oil, fixture.moving.acid, fixture.moving.strand]) {
      expect(velocity(moving, centre(entry))).toEqual([entry.velocity.x, entry.velocity.y]);
    }
    expect(velocity(moving, fixture.moving.isolated)).toEqual([
      fixture.moving.isolated.velocity.x, fixture.moving.isolated.velocity.y,
    ]);
    let movingVelocityCells = 0;
    let foreignVelocityCells = 0;
    for (let index = 0; index < moving.cells().length; index++) {
      const offset = index * 2;
      if (moving.velocity()[offset] === 0 && moving.velocity()[offset + 1] === 0) continue;
      movingVelocityCells++;
      const point = { x: index % WIDTH, y: Math.floor(index / WIDTH) };
      if (!movingOwner(point)) foreignVelocityCells++;
    }
    expect(movingVelocityCells).toBe(fixture.expected.movingVelocityCells);
    expect(foreignVelocityCells).toBe(0);
  });

  it('preserves foreign liquid, contact, wall, fine-topology, and blank controls', () => {
    const simulation = prepared('moving');
    const fixture = WATER_CURVATURE_VFX_AUDIT;
    for (const contact of Object.values(fixture.contacts)) {
      expectRect(simulation, contact.water, Material.Water);
      expectRect(simulation, contact.other, contact.otherMaterial);
      expect(velocity(simulation, contact.waterProbe)).toEqual([0, 0]);
      expect(velocity(simulation, contact.otherProbe)).toEqual([0, 0]);
    }
    expectRect(simulation, fixture.moving.oil, Material.Oil);
    expectRect(simulation, fixture.moving.acid, Material.Acid);
    expectRect(simulation, fixture.moving.strand, Material.Water);
    expect(cell(simulation, fixture.moving.isolated)).toBe(Material.Water);
    let wallCells = 0;
    forEach(fixture.wallCoexistence.region, (point) => {
      const blockX = Math.floor((point.x - fixture.wallCoexistence.region.x) / 4);
      const blockY = Math.floor((point.y - fixture.wallCoexistence.region.y) / 4);
      const expected = (blockX + blockY) % 2 === 0 ? fixture.conductiveWall : 0;
      wallCells += Number(expected !== 0);
      expect(simulation.walls()[point.y * WIDTH + point.x]).toBe(expected);
      expect(cell(simulation, point)).toBe(Material.Water);
    });
    expect(wallCells).toBe(fixture.expected.wallCells);
    expectRect(simulation, fixture.guardedBlank, Material.Empty);
  });

  it('freezes material and wall cardinalities and resets every mutable plane deterministically', () => {
    const first = prepared('moving');
    const second = prepared('moving');
    const expected = WATER_CURVATURE_VFX_AUDIT.expected;
    expect(count(first.cells(), Material.Water)).toBe(expected.waterCells);
    expect(count(first.cells(), Material.Oil)).toBe(expected.oilCells);
    expect(count(first.cells(), Material.Acid)).toBe(expected.acidCells);
    expect(count(first.cells(), Material.Metal)).toBe(expected.metalCells);
    expect(count(first.walls(), WATER_CURVATURE_VFX_AUDIT.conductiveWall)).toBe(expected.wallCells);
    expect(equalBytes(first.cells(), second.cells())).toBe(true);
    expect(equalBytes(first.walls(), second.walls())).toBe(true);
    expect(equalBytes(first.velocity(), second.velocity())).toBe(true);

    const cells = first.cells().slice();
    const walls = first.walls().slice();
    const velocities = first.velocity().slice();
    first.cells().fill(Material.Fire);
    first.paintWall(4, 4, 2, 0);
    first.setFixtureVelocityRect(0, 0, 8, 8, 127, -127);
    prepareWaterCurvatureVfxFixture(first, 'moving');
    expect(equalBytes(first.cells(), cells)).toBe(true);
    expect(equalBytes(first.walls(), walls)).toBe(true);
    expect(equalBytes(first.velocity(), velocities)).toBe(true);
  });

  it('rejects unsupported backends and noncanonical dimensions', () => {
    expect(() => prepareWaterCurvatureVfxFixture(new RenderLabBackend(32, 32), 'still'))
      .toThrow('requires 612x384');
    expect(() => prepareWaterCurvatureVfxFixture(new DeterministicBackend(WIDTH, HEIGHT), 'moving'))
      .toThrow('requires render-lab velocity and wall planes');
  });
});

function prepared(mode: 'still' | 'moving'): RenderLabBackend {
  const simulation = new RenderLabBackend();
  prepareWaterCurvatureVfxFixture(simulation, mode);
  return simulation;
}

function movingOwner(point: WaterCurvatureVfxPoint): boolean {
  const fixture = WATER_CURVATURE_VFX_AUDIT;
  return contains(fixture.body.bounds, point) || contains(fixture.moving.oil, point)
    || contains(fixture.moving.acid, point) || contains(fixture.moving.strand, point)
    || (point.x === fixture.moving.isolated.x && point.y === fixture.moving.isolated.y);
}

function expectRect(simulation: RenderLabBackend, rect: WaterCurvatureVfxRect, material: Material): void {
  forEach(rect, (point) => expect(cell(simulation, point)).toBe(material));
}

function forEach(rect: WaterCurvatureVfxRect, action: (point: WaterCurvatureVfxPoint) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) action({ x, y });
  }
}

function contains(rect: WaterCurvatureVfxRect, point: WaterCurvatureVfxPoint): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function count(values: Uint8Array, value: number): number {
  return values.reduce((total, candidate) => total + Number(candidate === value), 0);
}

function equalBytes(left: Uint8Array | Int8Array, right: Uint8Array | Int8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
