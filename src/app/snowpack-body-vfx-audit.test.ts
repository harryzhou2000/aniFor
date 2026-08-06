import { describe, expect, it } from 'vitest';
import { RenderOptics, renderOptics } from '../renderer/render-optics';
import { RenderPhase, RenderProfile, renderPhase, renderProfile } from '../renderer/render-profile';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  SNOWPACK_BODY_VFX_AUDIT,
  prepareSnowpackBodyVfxAuditFixture,
  type SnowpackBodyVfxBoundary,
  type SnowpackBodyVfxPoint,
  type SnowpackBodyVfxRect,
  type SnowpackBodyVfxWallPattern,
} from './snowpack-body-vfx-audit';

const WIDTH = 612;
const HEIGHT = 384;

describe('Snowpack body VFX audit fixture', () => {
  it('pins native Snow 18 as the exact Smooth crystalline target', () => {
    expect(Material.Snow).toBe(18);
    const material = ALL_MATERIALS.find(({ id }) => id === Material.Snow);
    expect(material).toBeDefined();
    if (!material) return;
    expect(renderPhase(material)).toBe(RenderPhase.Powder);
    expect(renderProfile(material.category)).toBe(RenderProfile.Granular);
    expect(renderOptics(material)).toBe(RenderOptics.CrystallineGranular);
    expect(SNOWPACK_BODY_VFX_AUDIT.target).toMatchObject({ code: 'SNOW', material: 18 });
    expect(SNOWPACK_BODY_VFX_AUDIT.powderStyleMatrix).toEqual([
      { style: 'smooth', expectation: 'target' },
      { style: 'local', expectation: 'exact-no-op' },
      { style: 'grains', expectation: 'exact-no-op' },
    ]);

    const cells = prepared().cells();
    for (const region of [
      SNOWPACK_BODY_VFX_AUDIT.target.core,
      SNOWPACK_BODY_VFX_AUDIT.target.crown,
      SNOWPACK_BODY_VFX_AUDIT.target.pocket,
    ]) expectRect(cells, region, Material.Snow);
  });

  it('preserves the settled broad snowpack, authored openings, and fine topology', () => {
    const simulation = prepared();
    const cells = simulation.cells();
    const velocity = simulation.velocity();
    const { target, fineTopology } = SNOWPACK_BODY_VFX_AUDIT;

    expectRectExcept(cells, target.body, target.material, [target.authoredHole, target.openChannel]);
    expectRect(cells, target.authoredHole, Material.Empty);
    expectRect(cells, target.openChannel, Material.Empty);
    expect(target.openChannel.y).toBe(target.body.y);
    expectRect(cells, fineTopology.column, target.material);
    expect(fineTopology.column.width).toBe(1);
    expectRect(cells, fineTopology.line, target.material);
    expect(fineTopology.line.height).toBe(1);
    expect(at(cells, fineTopology.isolated)).toBe(target.material);

    for (const stable of [target.core, target.crown, target.pocket]) {
      expectVelocityRect(velocity, stable, 0, 0);
      expect(intersects(stable, target.authoredHole)).toBe(false);
      expect(intersects(stable, target.openChannel)).toBe(false);
      expect(intersects(stable, target.wallCoexistence.region)).toBe(false);
    }
  });

  it('keeps moving Snow and genuine Snow-in-Water suspension exact and disjoint', () => {
    const simulation = prepared();
    const cells = simulation.cells();
    const velocity = simulation.velocity();
    const { movingControl, suspensionControl, expected } = SNOWPACK_BODY_VFX_AUDIT;

    expectRect(cells, movingControl, Material.Snow);
    expectVelocityRect(
      velocity, movingControl, movingControl.velocityX, movingControl.velocityY,
    );
    expect(countVelocityCells(velocity)).toBe(expected.movingVelocityCells);

    const snow = new Set(suspensionControl.snowPoints.map(({ x, y }) => y * WIDTH + x));
    each(suspensionControl.region, ({ x, y }) => {
      expect(cells[y * WIDTH + x]).toBe(
        snow.has(y * WIDTH + x) ? Material.Snow : Material.Water,
      );
    });
    expect(snow.size).toBe(expected.suspensionSnowCells);
    expect(area(suspensionControl.region) - snow.size).toBe(expected.suspensionWaterCells);
    expect(at(cells, suspensionControl.snowProbe)).toBe(Material.Snow);
    expect(at(cells, suspensionControl.waterProbe)).toBe(Material.Water);
    expectVelocityRect(velocity, suspensionControl.region, 0, 0);
  });

  it('preserves crystalline siblings, phase controls, contacts, walls, and blank space', () => {
    const simulation = prepared();
    const cells = simulation.cells();
    const fixture = SNOWPACK_BODY_VFX_AUDIT;
    const controls = fixture.materialControls;

    expect(Object.values(controls).map(({ material }) => material)).toEqual([
      Material.Salt, Material.Quartz, Material.BGLA, Material.FRZZ, Material.SLCN,
      Material.Sand, Material.Thermite, Material.C4, Material.Ice, Material.QRTZ,
    ]);
    for (const entry of Object.values(controls)) {
      expect(area(entry)).toBe(fixture.expected.cellsPerMaterialControl);
      expectRect(cells, entry, entry.material);
    }
    for (const key of ['salt', 'quartz', 'bgla', 'frzz', 'slcn'] as const) {
      const material = ALL_MATERIALS.find(({ id }) => id === controls[key].material);
      expect(material, key).toBeDefined();
      if (material) {
        expect(renderPhase(material), key).toBe(RenderPhase.Powder);
        expect(renderOptics(material), key).toBe(RenderOptics.CrystallineGranular);
      }
    }
    for (const key of ['ice', 'qrtz'] as const) {
      const material = ALL_MATERIALS.find(({ id }) => id === controls[key].material);
      expect(material, key).toBeDefined();
      if (material) {
        expect(renderPhase(material), key).toBe(RenderPhase.Solid);
        expect(renderOptics(material), key).toBe(RenderOptics.TranslucentRigid);
      }
    }

    for (const entry of Object.values(fixture.contacts)) expectBoundary(cells, entry);
    const pattern = fixture.target.wallCoexistence;
    expectWallPattern(cells, simulation.walls(), pattern, Material.Snow);
    expect(countNonzero(simulation.walls())).toBe(fixture.expected.wallCells);
    expect(wallAt(simulation.walls(), pattern.wallProbe)).toBe(fixture.conductiveWall);
    expect(wallAt(simulation.walls(), pattern.clearProbe)).toBe(0);
    expectRect(cells, fixture.guardedBlank, Material.Empty);
  });

  it('freezes semantic and native-plane cardinalities for the v1 world', () => {
    const simulation = prepared();
    const cells = simulation.cells();
    const { expected, materialControls } = SNOWPACK_BODY_VFX_AUDIT;

    expect(countOccupied(cells)).toBe(expected.occupiedCells);
    expect(countMaterial(cells, Material.Snow)).toBe(expected.snowCells);
    expect(countMaterial(cells, Material.Water)).toBe(expected.waterCells);
    expect(countMaterial(cells, Material.Metal)).toBe(expected.metalCells);
    for (const entry of Object.values(materialControls)) {
      expect(countMaterial(cells, entry.material)).toBe(expected.cellsPerMaterialControl);
    }
    expect(countNonzero(simulation.walls())).toBe(expected.wallCells);
    expect(countVelocityCells(simulation.velocity())).toBe(expected.movingVelocityCells);
    expect(countMaterial(cells, Material.Empty)).toBe(WIDTH * HEIGHT - expected.occupiedCells);
  });

  it('keeps every independent region in bounds and resets deterministically', () => {
    const fixture = SNOWPACK_BODY_VFX_AUDIT;
    const world: SnowpackBodyVfxRect = { x: 0, y: 0, width: WIDTH, height: HEIGHT };
    const independent: SnowpackBodyVfxRect[] = [
      fixture.target.body,
      fixture.fineTopology.column,
      fixture.fineTopology.line,
      pointRect(fixture.fineTopology.isolated),
      fixture.movingControl,
      fixture.suspensionControl.region,
      ...Object.values(fixture.materialControls),
      ...Object.values(fixture.contacts).flatMap(({ snow, other }) => [snow, other]),
      fixture.guardedBlank,
    ];
    for (const rect of independent) expect(inside(rect, world)).toBe(true);
    for (let index = 0; index < independent.length; index++) {
      for (let other = index + 1; other < independent.length; other++) {
        expect(intersects(independent[index], independent[other])).toBe(false);
      }
    }
    for (const rect of [
      fixture.target.core,
      fixture.target.crown,
      fixture.target.pocket,
      fixture.target.authoredHole,
      fixture.target.openChannel,
      fixture.target.wallCoexistence.region,
    ]) expect(inside(rect, fixture.target.body)).toBe(true);

    const first = prepared();
    const cells = first.cells().slice();
    const walls = first.walls().slice();
    const velocity = first.velocity().slice();
    first.cells().fill(Material.Fire);
    first.paintWall(4, 4, 2, 0);
    first.setFixtureVelocityRect(0, 0, 8, 8, 127, 127);
    prepareSnowpackBodyVfxAuditFixture(first);
    expect(firstDifference(first.cells(), cells)).toBe(-1);
    expect(firstDifference(first.walls(), walls)).toBe(-1);
    expect(firstDifference(first.velocity(), velocity)).toBe(-1);
    expect(() => prepareSnowpackBodyVfxAuditFixture(new RenderLabBackend(32, 32)))
      .toThrow('requires 612x384');
    expect(() => prepareSnowpackBodyVfxAuditFixture(new DeterministicBackend(WIDTH, HEIGHT)))
      .toThrow('requires a canonical RenderLab wall and velocity plane');
  });
});

function prepared(): RenderLabBackend {
  const simulation = new RenderLabBackend(WIDTH, HEIGHT);
  prepareSnowpackBodyVfxAuditFixture(simulation);
  return simulation;
}

function at(cells: Uint8Array, point: SnowpackBodyVfxPoint): Material {
  return cells[point.y * WIDTH + point.x] as Material;
}

function wallAt(walls: Uint8Array, point: SnowpackBodyVfxPoint): number {
  return walls[point.y * WIDTH + point.x];
}

function expectRect(
  cells: Uint8Array, rect: SnowpackBodyVfxRect, material: Material,
): void {
  each(rect, (point) => expect(at(cells, point)).toBe(material));
}

function expectRectExcept(
  cells: Uint8Array, rect: SnowpackBodyVfxRect, material: Material,
  exceptions: readonly SnowpackBodyVfxRect[],
): void {
  each(rect, (point) => {
    if (!exceptions.some((entry) => contains(entry, point))) expect(at(cells, point)).toBe(material);
  });
}

function expectVelocityRect(
  velocity: Int8Array, rect: SnowpackBodyVfxRect, x: number, y: number,
): void {
  each(rect, (point) => {
    const offset = (point.y * WIDTH + point.x) * 2;
    expect(velocity[offset]).toBe(x);
    expect(velocity[offset + 1]).toBe(y);
  });
}

function expectBoundary(cells: Uint8Array, entry: SnowpackBodyVfxBoundary): void {
  expectRect(cells, entry.snow, Material.Snow);
  expectRect(cells, entry.other, entry.otherMaterial);
  expect(entry.snow.x + entry.snow.width).toBe(entry.other.x);
  expect(at(cells, entry.snowProbe)).toBe(Material.Snow);
  expect(at(cells, entry.otherProbe)).toBe(entry.otherMaterial);
}

function expectWallPattern(
  cells: Uint8Array, walls: Uint8Array,
  pattern: SnowpackBodyVfxWallPattern, material: Material,
): void {
  each(pattern.region, ({ x, y }) => {
    const blockX = Math.floor((x - pattern.region.x) / pattern.blockSize);
    const blockY = Math.floor((y - pattern.region.y) / pattern.blockSize);
    expect(at(cells, { x, y })).toBe(material);
    expect(walls[y * WIDTH + x]).toBe(
      (blockX + blockY) % 2 === pattern.occupiedParity
        ? SNOWPACK_BODY_VFX_AUDIT.conductiveWall : 0,
    );
  });
}

function each(
  rect: SnowpackBodyVfxRect,
  action: (point: SnowpackBodyVfxPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) action({ x, y });
  }
}

function area(rect: SnowpackBodyVfxRect): number { return rect.width * rect.height; }

function countMaterial(cells: Uint8Array, material: Material): number {
  let count = 0;
  for (const cell of cells) count += Number(cell === material);
  return count;
}

function countOccupied(cells: Uint8Array): number {
  let count = 0;
  for (const cell of cells) count += Number(cell !== Material.Empty);
  return count;
}

function countNonzero(values: Uint8Array): number {
  let count = 0;
  for (const value of values) count += Number(value !== 0);
  return count;
}

function countVelocityCells(velocity: Int8Array): number {
  let count = 0;
  for (let offset = 0; offset < velocity.length; offset += 2) {
    count += Number(velocity[offset] !== 0 || velocity[offset + 1] !== 0);
  }
  return count;
}

function contains(rect: SnowpackBodyVfxRect, point: SnowpackBodyVfxPoint): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function inside(rect: SnowpackBodyVfxRect, container: SnowpackBodyVfxRect): boolean {
  return rect.x >= container.x && rect.y >= container.y
    && rect.x + rect.width <= container.x + container.width
    && rect.y + rect.height <= container.y + container.height;
}

function intersects(left: SnowpackBodyVfxRect, right: SnowpackBodyVfxRect): boolean {
  return left.x < right.x + right.width && left.x + left.width > right.x
    && left.y < right.y + right.height && left.y + left.height > right.y;
}

function pointRect(point: SnowpackBodyVfxPoint): SnowpackBodyVfxRect {
  return { ...point, width: 1, height: 1 };
}

function firstDifference(
  left: Uint8Array | Int8Array, right: Uint8Array | Int8Array,
): number {
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return index;
  }
  return -1;
}
