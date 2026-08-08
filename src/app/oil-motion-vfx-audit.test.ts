import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  OIL_MOTION_VFX_AUDIT, prepareOilMotionVfxFixture,
  type OilMotionVfxFixtureMode, type OilMotionVfxPoint, type OilMotionVfxRect,
} from './oil-motion-vfx-audit';

const WIDTH = 612;
const HEIGHT = 384;

function cell(simulation: RenderLabBackend, point: OilMotionVfxPoint): number {
  return simulation.cells()[point.y * WIDTH + point.x];
}

function velocity(simulation: RenderLabBackend, point: OilMotionVfxPoint): readonly [number, number] {
  const offset = (point.y * WIDTH + point.x) * 2;
  return [simulation.velocity()[offset], simulation.velocity()[offset + 1]];
}

function centre(rect: OilMotionVfxRect): OilMotionVfxPoint {
  return { x: rect.x + Math.floor(rect.width / 2), y: rect.y + Math.floor(rect.height / 2) };
}

describe('Oil-motion VFX audit fixture', () => {
  it('authors the exact Oil target, cutouts, air surfaces, seams, and native-wall coexistence', () => {
    const simulation = prepared('moving');
    const fixture = OIL_MOTION_VFX_AUDIT;
    const target = fixture.target;

    expectRectExcept(simulation, target.body, Material.Oil, [target.authoredHole, target.openChimney]);
    expectRect(simulation, target.airFacingTop, Material.Oil);
    expectRect(simulation, target.airFacingLeft, Material.Oil);
    expectRect(simulation, target.airFacingRight, Material.Oil);
    expect(cell(simulation, { x: target.airFacingTop.x + 4, y: target.airFacingTop.y - 1 })).toBe(Material.Empty);
    expect(cell(simulation, { x: target.airFacingLeft.x - 1, y: target.airFacingLeft.y + 4 })).toBe(Material.Empty);
    expect(cell(simulation, { x: target.airFacingRight.x + 1, y: target.airFacingRight.y + 4 })).toBe(Material.Empty);
    expectRect(simulation, target.authoredHole, Material.Empty);
    expectRect(simulation, target.openChimney, Material.Empty);
    expect(velocity(simulation, centre(target.authoredHole))).toEqual([0, 0]);
    expect(velocity(simulation, centre(target.openChimney))).toEqual([0, 0]);

    for (const seam of fixture.seams) {
      expectRect(simulation, seam.oil, Material.Oil);
      expectRect(simulation, seam.other, seam.otherMaterial);
      expect(cell(simulation, seam.oilProbe)).toBe(Material.Oil);
      expect(cell(simulation, seam.otherProbe)).toBe(seam.otherMaterial);
      expect(velocity(simulation, seam.oilProbe)).toEqual([
        seam.velocity.x, seam.velocity.y,
      ]);
      expect(velocity(simulation, seam.otherProbe)).toEqual([0, 0]);
      expect(cell(simulation, { x: seam.oilProbe.x, y: seam.oilProbe.y - 1 }))
        .toBe(Material.Empty);
    }

    forEach(fixture.wallCoexistence.region, (point) => {
      expect(cell(simulation, point)).toBe(Material.Oil);
      expect(simulation.walls()[point.y * WIDTH + point.x]).toBe(fixture.wallCoexistence.wall);
      expect(velocity(simulation, point)).toEqual([target.velocity.x, target.velocity.y]);
    });
    expect(cell(simulation, {
      x: fixture.wallCoexistence.wallProbe.x,
      y: fixture.wallCoexistence.wallProbe.y - 1,
    })).toBe(Material.Empty);
  });

  it('keeps counts and ownership exact while staging velocity only under declared moving owners', () => {
    const simulation = prepared('moving');
    const fixture = OIL_MOTION_VFX_AUDIT;
    expect(count(simulation.cells(), Material.Oil)).toBe(fixture.expected.oilCells);
    expect(count(simulation.cells(), Material.Water)).toBe(fixture.expected.waterCells);
    expect(count(simulation.cells(), Material.Acid)).toBe(fixture.expected.acidCells);
    expect(count(simulation.cells(), Material.Diesel)).toBe(fixture.expected.dieselCells);
    expect(count(simulation.cells(), Material.Nitro)).toBe(fixture.expected.nitroCells);
    expect(count(simulation.walls(), fixture.wallCoexistence.wall)).toBe(fixture.expected.wallCells);
    expectRect(simulation, fixture.stationaryOil, Material.Oil);
    expect(velocity(simulation, centre(fixture.stationaryOil))).toEqual([0, 0]);
    expect(velocity(simulation, fixture.movingOil.isolated)).toEqual([
      fixture.movingOil.isolated.velocity.x, fixture.movingOil.isolated.velocity.y,
    ]);

    let movingVelocityCells = 0;
    let invalidOwnerVelocityCells = 0;
    for (let index = 0; index < simulation.cells().length; index++) {
      const offset = index * 2;
      if (simulation.velocity()[offset] === 0 && simulation.velocity()[offset + 1] === 0) continue;
      movingVelocityCells++;
      const point = { x: index % WIDTH, y: Math.floor(index / WIDTH) };
      if (!isMovingOwner(point)) invalidOwnerVelocityCells++;
    }
    expect(movingVelocityCells).toBe(fixture.expected.movingVelocityCells);
    expect(invalidOwnerVelocityCells).toBe(0);
    expect(cell(simulation, centre(fixture.guardedBlank))).toBe(Material.Empty);
    expect(velocity(simulation, centre(fixture.guardedBlank))).toEqual([0, 0]);
  });

  it('makes reversed velocity the exact negative of moving while all three modes share topology', () => {
    const still = prepared('still');
    const moving = prepared('moving');
    const reversed = prepared('reversed');
    expect(equalBytes(still.cells(), moving.cells())).toBe(true);
    expect(equalBytes(still.cells(), reversed.cells())).toBe(true);
    expect(equalBytes(still.walls(), moving.walls())).toBe(true);
    expect(equalBytes(still.walls(), reversed.walls())).toBe(true);
    expect(still.velocity().some(Boolean)).toBe(false);
    let reversedMismatch = 0;
    for (let index = 0; index < moving.velocity().length; index++) {
      const byte = moving.velocity()[index];
      if (reversed.velocity()[index] !== (byte === 0 ? 0 : -byte)) reversedMismatch++;
    }
    expect(reversedMismatch).toBe(0);
    expect(velocity(reversed, centre(OIL_MOTION_VFX_AUDIT.stationaryOil))).toEqual([0, 0]);
  });

  it('deterministically resets stale matter, walls, and velocity planes', () => {
    const simulation = prepared('moving');
    const expectedCells = simulation.cells().slice();
    const expectedWalls = simulation.walls().slice();
    const expectedVelocity = simulation.velocity().slice();
    simulation.cells().fill(Material.Fire);
    simulation.paintWall(4, 4, 2, 0);
    simulation.setFixtureVelocityRect(0, 0, 8, 8, 127, -127);
    prepareOilMotionVfxFixture(simulation, 'moving');
    expect(equalBytes(simulation.cells(), expectedCells)).toBe(true);
    expect(equalBytes(simulation.walls(), expectedWalls)).toBe(true);
    expect(equalBytes(simulation.velocity(), expectedVelocity)).toBe(true);
  });

  it('rejects unsupported and noncanonical fixture backends', () => {
    expect(() => prepareOilMotionVfxFixture(new RenderLabBackend(32, 32), 'still')).toThrow('requires 612x384');
    expect(() => prepareOilMotionVfxFixture(new DeterministicBackend(WIDTH, HEIGHT), 'still'))
      .toThrow('requires render-lab velocity and wall planes');
  });
});

function prepared(mode: OilMotionVfxFixtureMode): RenderLabBackend {
  const simulation = new RenderLabBackend();
  prepareOilMotionVfxFixture(simulation, mode);
  return simulation;
}

function isMovingOwner(point: OilMotionVfxPoint): boolean {
  const fixture = OIL_MOTION_VFX_AUDIT;
  const targetOwner = contains(fixture.target.body, point)
    && !contains(fixture.target.authoredHole, point)
    && !contains(fixture.target.openChimney, point);
  return targetOwner
    || Object.values(fixture.movingSiblings).some((entry) => contains(entry, point))
    || fixture.seams.some((entry) => contains(entry.oil, point))
    || contains(fixture.movingOil.thin, point)
    || (point.x === fixture.movingOil.isolated.x && point.y === fixture.movingOil.isolated.y);
}

function expectRect(simulation: RenderLabBackend, rect: OilMotionVfxRect, material: Material): void {
  forEach(rect, (point) => expect(cell(simulation, point)).toBe(material));
}

function expectRectExcept(
  simulation: RenderLabBackend,
  rect: OilMotionVfxRect,
  material: Material,
  exceptions: readonly OilMotionVfxRect[],
): void {
  forEach(rect, (point) => {
    expect(cell(simulation, point)).toBe(exceptions.some((entry) => contains(entry, point))
      ? Material.Empty : material);
  });
}

function forEach(rect: OilMotionVfxRect, action: (point: OilMotionVfxPoint) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) action({ x, y });
  }
}

function contains(rect: OilMotionVfxRect, point: OilMotionVfxPoint): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function count(bytes: Uint8Array, value: number): number {
  let total = 0;
  for (const byte of bytes) total += Number(byte === value);
  return total;
}

function equalBytes(left: Uint8Array | Int8Array, right: Uint8Array | Int8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
