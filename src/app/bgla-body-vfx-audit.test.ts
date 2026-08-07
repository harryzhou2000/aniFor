import { describe, expect, it } from 'vitest';
import { RenderOptics, renderOptics } from '../renderer/render-optics';
import { RenderPhase, RenderProfile, renderPhase, renderProfile } from '../renderer/render-profile';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  BGLA_BODY_VFX_AUDIT,
  prepareBglaBodyVfxAuditFixture,
  type BglaBodyVfxBoundary,
  type BglaBodyVfxPoint,
  type BglaBodyVfxRect,
  type BglaBodyVfxWallPattern,
} from './bgla-body-vfx-audit';

const WIDTH = 612;
const HEIGHT = 384;

describe('BGLA body VFX audit fixture', () => {
  it('pins exact broken-glass 44 as the only settled Smooth crystalline target', () => {
    expect(Material.BGLA).toBe(44);
    const material = ALL_MATERIALS.find(({ id }) => id === Material.BGLA);
    expect(material).toBeDefined();
    if (!material) return;
    expect(renderPhase(material)).toBe(RenderPhase.Powder);
    expect(renderProfile(material.category)).toBe(RenderProfile.Granular);
    expect(renderOptics(material)).toBe(RenderOptics.CrystallineGranular);
    expect(BGLA_BODY_VFX_AUDIT.target).toMatchObject({ code: 'BGLA', material: 44 });
    expect(BGLA_BODY_VFX_AUDIT.powderStyleMatrix).toEqual([
      { style: 'smooth', expectation: 'target' },
      { style: 'local', expectation: 'exact-no-op' },
      { style: 'grains', expectation: 'exact-no-op' },
    ]);
  });

  it('preserves the broad body, named response probes, openings, and fine topology', () => {
    const simulation = prepared();
    const cells = simulation.cells();
    const velocity = simulation.velocity();
    const { target, fineTopology } = BGLA_BODY_VFX_AUDIT;

    expectRectExcept(cells, target.body, target.material, [target.authoredHole, target.openChannel]);
    expectRect(cells, target.authoredHole, Material.Empty);
    expectRect(cells, target.openChannel, Material.Empty);
    expect(target.openChannel.y).toBe(target.body.y);
    for (const stable of [target.core, target.crown, target.pocket]) {
      expectRect(cells, stable, target.material);
      expectVelocityRect(velocity, stable, 0, 0);
      expect(intersects(stable, target.authoredHole)).toBe(false);
      expect(intersects(stable, target.openChannel)).toBe(false);
      expect(intersects(stable, target.wallCoexistence.region)).toBe(false);
    }
    expectRect(cells, fineTopology.column, target.material);
    expect(fineTopology.column.width).toBe(1);
    expectRect(cells, fineTopology.line, target.material);
    expect(fineTopology.line.height).toBe(1);
    expect(at(cells, fineTopology.isolated)).toBe(target.material);
  });

  it('keeps authored motion and the exact 2:1 BGLA/Water wet mixture disjoint', () => {
    const simulation = prepared();
    const cells = simulation.cells();
    const velocity = simulation.velocity();
    const fixture = BGLA_BODY_VFX_AUDIT;
    expectRect(cells, fixture.movingControl, Material.BGLA);
    expectVelocityRect(
      velocity, fixture.movingControl,
      fixture.movingControl.velocityX, fixture.movingControl.velocityY,
    );
    expect(countVelocityCells(velocity)).toBe(fixture.expected.movingVelocityCells);

    const bgla = new Set(fixture.suspensionControl.bglaPoints.map(({ x, y }) => y * WIDTH + x));
    each(fixture.suspensionControl.region, ({ x, y }) => {
      expect(cells[y * WIDTH + x]).toBe(
        bgla.has(y * WIDTH + x) ? Material.BGLA : Material.Water,
      );
    });
    expect(bgla.size).toBe(fixture.expected.suspensionBglaCells);
    expect(area(fixture.suspensionControl.region) - bgla.size)
      .toBe(fixture.expected.suspensionWaterCells);
    expect(bgla.size).toBe((area(fixture.suspensionControl.region) - bgla.size) * 2);
    expect(at(cells, fixture.suspensionControl.bglaProbe)).toBe(Material.BGLA);
    expect(at(cells, fixture.suspensionControl.waterProbe)).toBe(Material.Water);
    expectVelocityRect(velocity, fixture.suspensionControl.region, 0, 0);
  });

  it('preserves exact siblings, unrelated phases, direct contacts, walls, and blank space', () => {
    const simulation = prepared();
    const cells = simulation.cells();
    const fixture = BGLA_BODY_VFX_AUDIT;
    const controls = fixture.materialControls;
    expect(Object.values(controls).map(({ material }) => material)).toEqual([
      Material.Salt, Material.Snow, Material.Quartz, Material.FRZZ, Material.SLCN,
      Material.Sand, Material.Thermite, Material.C4, Material.Ice, Material.Oil,
    ]);
    for (const entry of Object.values(controls)) {
      expect(area(entry)).toBe(fixture.expected.cellsPerMaterialControl);
      expectRect(cells, entry, entry.material);
    }
    for (const key of ['salt', 'snow', 'quartz', 'frzz', 'slcn'] as const) {
      const material = ALL_MATERIALS.find(({ id }) => id === controls[key].material);
      expect(material, key).toBeDefined();
      if (material) {
        expect(renderPhase(material), key).toBe(RenderPhase.Powder);
        expect(renderOptics(material), key).toBe(RenderOptics.CrystallineGranular);
      }
    }
    expect(renderPhase(ALL_MATERIALS.find(({ id }) => id === controls.ice.material)!))
      .toBe(RenderPhase.Solid);
    expect(renderPhase(ALL_MATERIALS.find(({ id }) => id === controls.oil.material)!))
      .toBe(RenderPhase.Liquid);
    for (const entry of Object.values(fixture.contacts)) expectBoundary(cells, entry);
    expectWallPattern(cells, simulation.walls(), fixture.target.wallCoexistence, Material.BGLA);
    expect(countNonzero(simulation.walls())).toBe(fixture.expected.wallCells);
    expectRect(cells, fixture.guardedBlank, Material.Empty);
  });

  it('freezes semantic, wall, and velocity cardinalities', () => {
    const simulation = prepared();
    const cells = simulation.cells();
    const fixture = BGLA_BODY_VFX_AUDIT;
    expect(countOccupied(cells)).toBe(fixture.expected.occupiedCells);
    expect(countMaterial(cells, Material.BGLA)).toBe(fixture.expected.bglaCells);
    expect(countMaterial(cells, Material.Water)).toBe(fixture.expected.waterCells);
    expect(countMaterial(cells, Material.ROCK)).toBe(fixture.expected.rockCells);
    expect(countMaterial(cells, Material.Metal)).toBe(fixture.expected.metalCells);
    for (const entry of Object.values(fixture.materialControls)) {
      expect(countMaterial(cells, entry.material)).toBe(fixture.expected.cellsPerMaterialControl);
    }
    expect(countNonzero(simulation.walls())).toBe(fixture.expected.wallCells);
    expect(countVelocityCells(simulation.velocity())).toBe(fixture.expected.movingVelocityCells);
    expect(countMaterial(cells, Material.Empty)).toBe(WIDTH * HEIGHT - fixture.expected.occupiedCells);
  });

  it('keeps independent regions in bounds, disjoint, and deterministically resettable', () => {
    const fixture = BGLA_BODY_VFX_AUDIT;
    const world: BglaBodyVfxRect = { x: 0, y: 0, width: WIDTH, height: HEIGHT };
    const independent: BglaBodyVfxRect[] = [
      fixture.target.body,
      fixture.fineTopology.column,
      fixture.fineTopology.line,
      pointRect(fixture.fineTopology.isolated),
      fixture.movingControl,
      fixture.suspensionControl.region,
      ...Object.values(fixture.materialControls),
      ...Object.values(fixture.contacts).flatMap(({ bgla, other }) => [bgla, other]),
      fixture.guardedBlank,
    ];
    for (const rect of independent) expect(inside(rect, world)).toBe(true);
    for (let index = 0; index < independent.length; index++) {
      for (let other = index + 1; other < independent.length; other++) {
        expect(intersects(independent[index], independent[other])).toBe(false);
      }
    }
    for (const rect of [
      fixture.target.core, fixture.target.crown, fixture.target.pocket,
      fixture.target.authoredHole, fixture.target.openChannel, fixture.target.wallCoexistence.region,
    ]) expect(inside(rect, fixture.target.body)).toBe(true);

    const first = prepared();
    const cells = first.cells().slice();
    const walls = first.walls().slice();
    const velocity = first.velocity().slice();
    first.cells().fill(Material.Fire);
    first.paintWall(4, 4, 2, 0);
    first.setFixtureVelocityRect(0, 0, 8, 8, 127, 127);
    prepareBglaBodyVfxAuditFixture(first);
    expect(firstDifference(first.cells(), cells)).toBe(-1);
    expect(firstDifference(first.walls(), walls)).toBe(-1);
    expect(firstDifference(first.velocity(), velocity)).toBe(-1);
    expect(() => prepareBglaBodyVfxAuditFixture(new RenderLabBackend(32, 32)))
      .toThrow('requires 612x384');
    expect(() => prepareBglaBodyVfxAuditFixture(new DeterministicBackend(WIDTH, HEIGHT)))
      .toThrow('requires a canonical RenderLab wall and velocity plane');
  });
});

function prepared(): RenderLabBackend {
  const simulation = new RenderLabBackend(WIDTH, HEIGHT);
  prepareBglaBodyVfxAuditFixture(simulation);
  return simulation;
}

function at(cells: Uint8Array, point: BglaBodyVfxPoint): Material {
  return cells[point.y * WIDTH + point.x] as Material;
}

function expectRect(cells: Uint8Array, rect: BglaBodyVfxRect, material: Material): void {
  each(rect, (point) => expect(at(cells, point)).toBe(material));
}

function expectRectExcept(
  cells: Uint8Array, rect: BglaBodyVfxRect, material: Material,
  exceptions: readonly BglaBodyVfxRect[],
): void {
  each(rect, (point) => {
    if (!exceptions.some((entry) => contains(entry, point))) expect(at(cells, point)).toBe(material);
  });
}

function expectVelocityRect(
  velocity: Int8Array, rect: BglaBodyVfxRect, x: number, y: number,
): void {
  each(rect, (point) => {
    const offset = (point.y * WIDTH + point.x) * 2;
    expect(velocity[offset]).toBe(x);
    expect(velocity[offset + 1]).toBe(y);
  });
}

function expectBoundary(cells: Uint8Array, entry: BglaBodyVfxBoundary): void {
  expectRect(cells, entry.bgla, Material.BGLA);
  expectRect(cells, entry.other, entry.otherMaterial);
  expect(entry.bgla.x + entry.bgla.width).toBe(entry.other.x);
  expect(at(cells, entry.bglaProbe)).toBe(Material.BGLA);
  expect(at(cells, entry.otherProbe)).toBe(entry.otherMaterial);
}

function expectWallPattern(
  cells: Uint8Array, walls: Uint8Array,
  pattern: BglaBodyVfxWallPattern, material: Material,
): void {
  each(pattern.region, ({ x, y }) => {
    const blockX = Math.floor((x - pattern.region.x) / pattern.blockSize);
    const blockY = Math.floor((y - pattern.region.y) / pattern.blockSize);
    expect(at(cells, { x, y })).toBe(material);
    expect(walls[y * WIDTH + x]).toBe(
      (blockX + blockY) % 2 === pattern.occupiedParity
        ? BGLA_BODY_VFX_AUDIT.conductiveWall : 0,
    );
  });
}

function each(rect: BglaBodyVfxRect, action: (point: BglaBodyVfxPoint) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) action({ x, y });
  }
}

function area(rect: BglaBodyVfxRect): number { return rect.width * rect.height; }
function contains(rect: BglaBodyVfxRect, point: BglaBodyVfxPoint): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}
function intersects(left: BglaBodyVfxRect, right: BglaBodyVfxRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}
function inside(inner: BglaBodyVfxRect, outer: BglaBodyVfxRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}
function pointRect(point: BglaBodyVfxPoint): BglaBodyVfxRect {
  return { ...point, width: 1, height: 1 };
}
function countMaterial(cells: Uint8Array, material: Material): number {
  return cells.reduce((count, candidate) => count + Number(candidate === material), 0);
}
function countOccupied(cells: Uint8Array): number {
  return cells.reduce((count, material) => count + Number(material !== Material.Empty), 0);
}
function countNonzero(values: Uint8Array): number {
  return values.reduce((count, value) => count + Number(value !== 0), 0);
}
function countVelocityCells(velocity: Int8Array): number {
  let count = 0;
  for (let index = 0; index < velocity.length; index += 2) {
    count += Number(velocity[index] !== 0 || velocity[index + 1] !== 0);
  }
  return count;
}
function firstDifference(left: Uint8Array | Int8Array, right: Uint8Array | Int8Array): number {
  for (let index = 0; index < left.length; index++) if (left[index] !== right[index]) return index;
  return -1;
}
