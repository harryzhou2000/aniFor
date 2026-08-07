import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  LIQUID_MOTION_VFX_AUDIT, prepareLiquidMotionVfxFixture,
  type LiquidMotionVfxPoint, type LiquidMotionVfxPool, type LiquidMotionVfxRect,
} from './liquid-motion-vfx-audit';

const WIDTH = 612;
const HEIGHT = 384;

function cell(simulation: RenderLabBackend, point: LiquidMotionVfxPoint): number {
  return simulation.cells()[point.y * simulation.width + point.x];
}

function velocity(simulation: RenderLabBackend, point: LiquidMotionVfxPoint): readonly [number, number] {
  const offset = (point.y * simulation.width + point.x) * 2;
  return [simulation.velocity()[offset], simulation.velocity()[offset + 1]];
}

function centre(rect: LiquidMotionVfxRect): LiquidMotionVfxPoint {
  return { x: rect.x + Math.floor(rect.width / 2), y: rect.y + Math.floor(rect.height / 2) };
}

describe('liquid-motion VFX audit fixture', () => {
  it('keeps topology-matched still and moving Water pools air-facing with authored voids', () => {
    const simulation = prepared('moving');
    for (const entry of LIQUID_MOTION_VFX_AUDIT.pools) {
      expectRectExcept(simulation, entry.body, Material.Water, [entry.authoredHole, entry.openChimney]);
      expectRect(simulation, entry.airFacingSurface, Material.Water);
      expect(cell(simulation, { x: entry.airFacingSurface.x + 2, y: entry.airFacingSurface.y - 1 }))
        .toBe(Material.Empty);
      for (const cutout of [entry.authoredHole, entry.openChimney]) {
        expectRect(simulation, cutout, Material.Empty);
        expect(velocity(simulation, centre(cutout))).toEqual([0, 0]);
      }
      expect(contains(entry.body, entry.core)).toBe(true);
      expect(intersects(entry.core, entry.authoredHole)).toBe(false);
      expect(intersects(entry.core, entry.openChimney)).toBe(false);
      expect(intersects(entry.authoredHole, entry.openChimney)).toBe(false);
    }
    expect(sameShape(LIQUID_MOTION_VFX_AUDIT.pools[0], LIQUID_MOTION_VFX_AUDIT.pools[1])).toBe(true);
  });

  it('writes velocity only for the documented exact owners in moving mode', () => {
    const moving = prepared('moving');
    const still = prepared('still');
    const fixture = LIQUID_MOTION_VFX_AUDIT;
    const [stillPool, movingPool] = fixture.pools;

    expect(velocity(moving, centre(stillPool.core))).toEqual([0, 0]);
    expect(velocity(moving, centre(movingPool.core))).toEqual([
      movingPool.velocity.x, movingPool.velocity.y,
    ]);
    for (const entry of [fixture.moving.strand, fixture.moving.oil, fixture.moving.acid]) {
      expect(cell(moving, centre(entry))).toBe(entry.material);
      expect(velocity(moving, centre(entry))).toEqual([entry.velocity.x, entry.velocity.y]);
    }
    expect(cell(moving, fixture.moving.isolated)).toBe(Material.Water);
    expect(velocity(moving, fixture.moving.isolated)).toEqual([
      fixture.moving.isolated.velocity.x, fixture.moving.isolated.velocity.y,
    ]);
    expect(still.velocity().some(Boolean)).toBe(false);
    expect(equalBytes(moving.cells(), still.cells())).toBe(true);
    expect(equalBytes(moving.walls(), still.walls())).toBe(true);

    let movingVelocityCells = 0;
    let invalidOwnerVelocityCells = 0;
    for (let index = 0; index < moving.cells().length; index++) {
      const offset = index * 2;
      if (moving.velocity()[offset] === 0 && moving.velocity()[offset + 1] === 0) continue;
      movingVelocityCells++;
      const point = { x: index % WIDTH, y: Math.floor(index / WIDTH) };
      if (!isMovingOwner(point)) invalidOwnerVelocityCells++;
    }
    expect(movingVelocityCells).toBe(fixture.expected.movingVelocityCells);
    expect(invalidOwnerVelocityCells).toBe(0);
  });

  it('preserves direct Water/Metal and Water/Oil ownership and a co-located wall checker', () => {
    const simulation = prepared('moving');
    const fixture = LIQUID_MOTION_VFX_AUDIT;
    for (const entry of Object.values(fixture.contacts)) {
      expectRect(simulation, entry.water, Material.Water);
      expectRect(simulation, entry.other, entry.otherMaterial);
      expect(cell(simulation, entry.waterProbe)).toBe(Material.Water);
      expect(cell(simulation, entry.otherProbe)).toBe(entry.otherMaterial);
      expect(velocity(simulation, entry.waterProbe)).toEqual([0, 0]);
      expect(velocity(simulation, entry.otherProbe)).toEqual([0, 0]);
    }
    const wall = fixture.wallCoexistence;
    let occupied = 0;
    forEach(wall.region, (point) => {
      const blockX = Math.floor((point.x - wall.region.x) / wall.blockSize);
      const blockY = Math.floor((point.y - wall.region.y) / wall.blockSize);
      const expected = (blockX + blockY) % 2 === wall.occupiedParity ? fixture.conductiveWall : 0;
      occupied += Number(expected === fixture.conductiveWall);
      expect(simulation.walls()[point.y * WIDTH + point.x]).toBe(expected);
      expect(cell(simulation, point)).toBe(Material.Water);
      expect(velocity(simulation, point)).toEqual([
        fixture.pools[1].velocity.x, fixture.pools[1].velocity.y,
      ]);
    });
    expect(occupied).toBe(fixture.expected.wallCells);
    expect(cell(simulation, fixture.wallCoexistence.wallProbe)).toBe(Material.Water);
    expect(cell(simulation, fixture.wallCoexistence.clearProbe)).toBe(Material.Water);
    expect(cell(simulation, centre(fixture.guardedBlank))).toBe(Material.Empty);
    expect(velocity(simulation, centre(fixture.guardedBlank))).toEqual([0, 0]);
  });

  it('has frozen material cardinalities and deterministically restores every mutable plane', () => {
    const first = prepared('moving');
    const second = prepared('moving');
    const fixture = LIQUID_MOTION_VFX_AUDIT;
    expect(count(first.cells(), Material.Water)).toBe(fixture.expected.waterCells);
    expect(count(first.cells(), Material.Oil)).toBe(fixture.expected.oilCells);
    expect(count(first.cells(), Material.Acid)).toBe(fixture.expected.acidCells);
    expect(count(first.cells(), Material.Metal)).toBe(fixture.expected.metalCells);
    expect(count(first.walls(), fixture.conductiveWall)).toBe(fixture.expected.wallCells);
    expect(equalBytes(first.cells(), second.cells())).toBe(true);
    expect(equalBytes(first.walls(), second.walls())).toBe(true);
    expect(equalBytes(first.velocity(), second.velocity())).toBe(true);

    const cells = first.cells().slice();
    const walls = first.walls().slice();
    const velocities = first.velocity().slice();
    first.cells().fill(Material.Fire);
    first.paintWall(4, 4, 2, 0);
    first.setFixtureVelocityRect(0, 0, 8, 8, 127, -127);
    prepareLiquidMotionVfxFixture(first, 'moving');
    expect(equalBytes(first.cells(), cells)).toBe(true);
    expect(equalBytes(first.walls(), walls)).toBe(true);
    expect(equalBytes(first.velocity(), velocities)).toBe(true);
  });

  it('rejects unsupported or noncanonical backends', () => {
    expect(() => prepareLiquidMotionVfxFixture(new RenderLabBackend(32, 32), 'still'))
      .toThrow('requires 612x384');
    expect(() => prepareLiquidMotionVfxFixture(new DeterministicBackend(WIDTH, HEIGHT), 'still'))
      .toThrow('requires render-lab velocity and wall planes');
  });
});

function prepared(mode: 'still' | 'moving'): RenderLabBackend {
  const simulation = new RenderLabBackend();
  prepareLiquidMotionVfxFixture(simulation, mode);
  return simulation;
}

function isMovingOwner(point: LiquidMotionVfxPoint): boolean {
  const fixture = LIQUID_MOTION_VFX_AUDIT;
  return [fixture.pools[1].body, fixture.moving.strand, fixture.moving.oil, fixture.moving.acid]
    .some((rect) => contains(rect, point)) || (
      point.x === fixture.moving.isolated.x && point.y === fixture.moving.isolated.y
    );
}

function expectRect(simulation: RenderLabBackend, rect: LiquidMotionVfxRect, material: Material): void {
  forEach(rect, (point) => expect(cell(simulation, point)).toBe(material));
}

function expectRectExcept(
  simulation: RenderLabBackend, rect: LiquidMotionVfxRect, material: Material,
  exceptions: readonly LiquidMotionVfxRect[],
): void {
  forEach(rect, (point) => {
    expect(cell(simulation, point)).toBe(exceptions.some((entry) => contains(entry, point))
      ? Material.Empty : material);
  });
}

function forEach(rect: LiquidMotionVfxRect, action: (point: LiquidMotionVfxPoint) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) action({ x, y });
  }
}

function contains(rect: LiquidMotionVfxRect, point: LiquidMotionVfxPoint): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function intersects(left: LiquidMotionVfxRect, right: LiquidMotionVfxRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

function sameShape(left: LiquidMotionVfxPool, right: LiquidMotionVfxPool): boolean {
  return left.body.width === right.body.width && left.body.height === right.body.height
    && left.airFacingSurface.width === right.airFacingSurface.width
    && left.authoredHole.width === right.authoredHole.width
    && left.authoredHole.height === right.authoredHole.height
    && left.openChimney.width === right.openChimney.width
    && left.openChimney.height === right.openChimney.height;
}

function count(bytes: Uint8Array, value: number): number {
  let total = 0;
  for (const byte of bytes) total += Number(byte === value);
  return total;
}

function equalBytes(left: Uint8Array | Int8Array, right: Uint8Array | Int8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
