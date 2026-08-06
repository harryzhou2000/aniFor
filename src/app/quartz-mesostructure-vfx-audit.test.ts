import { describe, expect, it } from 'vitest';
import { RenderOptics, renderOptics } from '../renderer/render-optics';
import { RenderPhase, RenderProfile, renderPhase, renderProfile } from '../renderer/render-profile';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  QUARTZ_MESOSTRUCTURE_VFX_AUDIT,
  prepareQuartzMesostructureVfxAuditFixture,
  type QuartzMesostructureVfxBoundary,
  type QuartzMesostructureVfxPoint,
  type QuartzMesostructureVfxRect,
  type QuartzMesostructureVfxWallPattern,
} from './quartz-mesostructure-vfx-audit';

const WIDTH = 612;
const HEIGHT = 384;

describe('Quartz mesostructure VFX audit fixture', () => {
  it('pins exact powder PQRT 29 separately from solid QRTZ 76', () => {
    expect(Material.Quartz).toBe(29);
    expect(Material.QRTZ).toBe(76);
    const powder = ALL_MATERIALS.find(({ id }) => id === Material.Quartz)!;
    const solid = ALL_MATERIALS.find(({ id }) => id === Material.QRTZ)!;
    expect(renderPhase(powder)).toBe(RenderPhase.Powder);
    expect(renderProfile(powder.category)).toBe(RenderProfile.Granular);
    expect(renderOptics(powder)).toBe(RenderOptics.CrystallineGranular);
    expect(renderPhase(solid)).toBe(RenderPhase.Solid);
    expect(renderOptics(solid)).toBe(RenderOptics.TranslucentRigid);
    expect(QUARTZ_MESOSTRUCTURE_VFX_AUDIT.target).toMatchObject({
      code: 'PQRT', material: 29, neutralSpeckle: 5,
    });
    expect(QUARTZ_MESOSTRUCTURE_VFX_AUDIT.powderStyleMatrix).toEqual([
      { style: 'smooth', expectation: 'target' },
      { style: 'local', expectation: 'exact-no-op' },
      { style: 'grains', expectation: 'exact-no-op' },
    ]);
  });

  it('preserves the broad body, openings, fine topology, and native state regions', () => {
    const simulation = prepared();
    const cells = simulation.cells();
    const states = simulation.presentationState();
    const { target, fineTopology } = QUARTZ_MESOSTRUCTURE_VFX_AUDIT;
    expectRectExcept(cells, target.body, target.material, [target.authoredHole, target.openChannel]);
    expectRect(cells, target.authoredHole, Material.Empty);
    expectStateRect(states, target.authoredHole, 0);
    expectRect(cells, target.openChannel, Material.Empty);
    expectStateRect(states, target.openChannel, 0);
    expect(target.openChannel.y).toBe(target.body.y);
    for (const region of Object.values(target.stateRegions)) {
      expectRect(cells, region, target.material);
      expectStateRect(states, region, region.speckle);
    }
    for (const region of [target.core, target.crown, target.pocket]) {
      expectRect(cells, region, target.material);
      expectStateRect(states, region, target.neutralSpeckle);
    }
    expectRect(cells, fineTopology.column, target.material);
    expectStateRect(states, fineTopology.column, target.neutralSpeckle);
    expect(fineTopology.column.width).toBe(1);
    expectRect(cells, fineTopology.line, target.material);
    expectStateRect(states, fineTopology.line, target.neutralSpeckle);
    expect(fineTopology.line.height).toBe(1);
    expect(at(cells, fineTopology.isolated)).toBe(target.material);
    expect(at(states, fineTopology.isolated)).toBe(target.neutralSpeckle);
  });

  it('keeps authored motion and genuine PQRT-in-Water suspension exact', () => {
    const simulation = prepared();
    const cells = simulation.cells();
    const states = simulation.presentationState();
    const velocity = simulation.velocity();
    const fixture = QUARTZ_MESOSTRUCTURE_VFX_AUDIT;
    expectRect(cells, fixture.movingControl, Material.Quartz);
    expectStateRect(states, fixture.movingControl, fixture.target.neutralSpeckle);
    expectVelocityRect(
      velocity, fixture.movingControl,
      fixture.movingControl.velocityX, fixture.movingControl.velocityY,
    );
    expect(countVelocityCells(velocity)).toBe(fixture.expected.movingVelocityCells);

    const quartz = new Set(
      fixture.suspensionControl.quartzPoints.map(({ x, y }) => y * WIDTH + x),
    );
    each(fixture.suspensionControl.region, ({ x, y }) => {
      const expectedQuartz = quartz.has(y * WIDTH + x);
      expect(cells[y * WIDTH + x]).toBe(expectedQuartz ? Material.Quartz : Material.Water);
      expect(states[y * WIDTH + x]).toBe(expectedQuartz ? fixture.target.neutralSpeckle : 0);
    });
    expect(quartz.size).toBe(fixture.expected.suspensionQuartzCells);
    expect(area(fixture.suspensionControl.region) - quartz.size)
      .toBe(fixture.expected.suspensionWaterCells);
    expect(at(cells, fixture.suspensionControl.quartzProbe)).toBe(Material.Quartz);
    expect(at(cells, fixture.suspensionControl.waterProbe)).toBe(Material.Water);
  });

  it('preserves sibling materials, QRTZ state, contacts, walls, and blank space', () => {
    const simulation = prepared();
    const cells = simulation.cells();
    const states = simulation.presentationState();
    const fixture = QUARTZ_MESOSTRUCTURE_VFX_AUDIT;
    expect(Object.values(fixture.materialControls).map(({ material }) => material)).toEqual([
      Material.Salt, Material.Snow, Material.BGLA, Material.FRZZ, Material.SLCN,
      Material.Sand, Material.Thermite, Material.C4, Material.Ice, Material.QRTZ,
    ]);
    for (const entry of Object.values(fixture.materialControls)) {
      expect(area(entry)).toBe(fixture.expected.cellsPerMaterialControl);
      expectRect(cells, entry, entry.material);
      expectStateRect(states, entry, entry.speckle);
    }
    expectStateRect(states, fixture.materialControls.qrtz, fixture.expected.qrtzState);
    for (const entry of Object.values(fixture.contacts)) expectBoundary(cells, states, entry);
    expectWallPattern(
      cells, simulation.walls(), fixture.target.wallCoexistence, fixture.target.material,
    );
    expect(countNonzero(simulation.walls())).toBe(fixture.expected.wallCells);
    expectRect(cells, fixture.guardedBlank, Material.Empty);
    expectStateRect(states, fixture.guardedBlank, 0);
  });

  it('freezes semantic, state, wall, and velocity cardinalities', () => {
    const simulation = prepared();
    const cells = simulation.cells();
    const states = simulation.presentationState();
    const fixture = QUARTZ_MESOSTRUCTURE_VFX_AUDIT;
    expect(countOccupied(cells)).toBe(fixture.expected.occupiedCells);
    expect(countMaterial(cells, Material.Quartz)).toBe(fixture.expected.quartzCells);
    expect(countMaterial(cells, Material.Water)).toBe(fixture.expected.waterCells);
    expect(countMaterial(cells, Material.Metal)).toBe(fixture.expected.metalCells);
    expect(countMaterialState(cells, states, Material.Quartz, 0))
      .toBe(fixture.expected.stateCounts.dark);
    expect(countMaterialState(cells, states, Material.Quartz, 5))
      .toBe(fixture.expected.stateCounts.neutral);
    expect(countMaterialState(cells, states, Material.Quartz, 10))
      .toBe(fixture.expected.stateCounts.bright);
    expect(countMaterialState(cells, states, Material.QRTZ, fixture.expected.qrtzState))
      .toBe(fixture.expected.cellsPerMaterialControl);
    expect(countNonzero(simulation.walls())).toBe(fixture.expected.wallCells);
    expect(countVelocityCells(simulation.velocity())).toBe(fixture.expected.movingVelocityCells);
  });

  it('keeps independent regions in bounds and resets every plane deterministically', () => {
    const fixture = QUARTZ_MESOSTRUCTURE_VFX_AUDIT;
    const world: QuartzMesostructureVfxRect = { x: 0, y: 0, width: WIDTH, height: HEIGHT };
    const independent: QuartzMesostructureVfxRect[] = [
      fixture.target.body, fixture.fineTopology.column, fixture.fineTopology.line,
      pointRect(fixture.fineTopology.isolated), fixture.movingControl,
      fixture.suspensionControl.region, ...Object.values(fixture.materialControls),
      ...Object.values(fixture.contacts).flatMap(({ quartz, other }) => [quartz, other]),
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
      fixture.target.authoredHole, fixture.target.openChannel,
      fixture.target.wallCoexistence.region, ...Object.values(fixture.target.stateRegions),
    ]) expect(inside(rect, fixture.target.body)).toBe(true);

    const first = prepared();
    const cells = first.cells().slice();
    const states = first.presentationState().slice();
    const walls = first.walls().slice();
    const velocity = first.velocity().slice();
    first.cells().fill(Material.Fire);
    first.presentationState().fill(0xffff);
    first.paintWall(4, 4, 2, 0);
    first.setFixtureVelocityRect(0, 0, 8, 8, 127, 127);
    prepareQuartzMesostructureVfxAuditFixture(first);
    expect(first.cells()).toEqual(cells);
    expect(first.presentationState()).toEqual(states);
    expect(first.walls()).toEqual(walls);
    expect(first.velocity()).toEqual(velocity);
    expect(() => prepareQuartzMesostructureVfxAuditFixture(new RenderLabBackend(32, 32)))
      .toThrow('requires 612x384');
    expect(() => prepareQuartzMesostructureVfxAuditFixture(
      new DeterministicBackend(WIDTH, HEIGHT),
    )).toThrow('requires canonical wall, velocity, and state planes');
  });
});

function prepared(): RenderLabBackend {
  const simulation = new RenderLabBackend(WIDTH, HEIGHT);
  prepareQuartzMesostructureVfxAuditFixture(simulation);
  return simulation;
}

function at(values: Uint8Array | Uint16Array, point: QuartzMesostructureVfxPoint): number {
  return values[point.y * WIDTH + point.x];
}

function each(
  rect: QuartzMesostructureVfxRect,
  action: (point: QuartzMesostructureVfxPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) action({ x, y });
  }
}

function expectRect(cells: Uint8Array, rect: QuartzMesostructureVfxRect, material: Material): void {
  each(rect, (point) => expect(at(cells, point)).toBe(material));
}

function expectStateRect(states: Uint16Array, rect: QuartzMesostructureVfxRect, state: number): void {
  each(rect, (point) => expect(at(states, point)).toBe(state));
}

function expectRectExcept(
  cells: Uint8Array, rect: QuartzMesostructureVfxRect, material: Material,
  exceptions: readonly QuartzMesostructureVfxRect[],
): void {
  each(rect, (point) => {
    if (!exceptions.some((entry) => contains(entry, point))) expect(at(cells, point)).toBe(material);
  });
}

function expectVelocityRect(
  velocity: Int8Array, rect: QuartzMesostructureVfxRect, x: number, y: number,
): void {
  each(rect, (point) => {
    const offset = (point.y * WIDTH + point.x) * 2;
    expect(velocity[offset]).toBe(x);
    expect(velocity[offset + 1]).toBe(y);
  });
}

function expectBoundary(
  cells: Uint8Array, states: Uint16Array, entry: QuartzMesostructureVfxBoundary,
): void {
  expectRect(cells, entry.quartz, Material.Quartz);
  expectStateRect(states, entry.quartz, 5);
  expectRect(cells, entry.other, entry.otherMaterial);
  expectStateRect(states, entry.other, 0);
  expect(entry.quartz.x + entry.quartz.width).toBe(entry.other.x);
  expect(at(cells, entry.quartzProbe)).toBe(Material.Quartz);
  expect(at(cells, entry.otherProbe)).toBe(entry.otherMaterial);
}

function expectWallPattern(
  cells: Uint8Array, walls: Uint8Array, pattern: QuartzMesostructureVfxWallPattern,
  material: Material,
): void {
  each(pattern.region, ({ x, y }) => {
    const blockX = Math.floor((x - pattern.region.x) / pattern.blockSize);
    const blockY = Math.floor((y - pattern.region.y) / pattern.blockSize);
    expect(at(cells, { x, y })).toBe(material);
    expect(walls[y * WIDTH + x]).toBe(
      (blockX + blockY) % 2 === pattern.occupiedParity
        ? QUARTZ_MESOSTRUCTURE_VFX_AUDIT.conductiveWall : 0,
    );
  });
}

function area(rect: QuartzMesostructureVfxRect): number { return rect.width * rect.height; }
function contains(rect: QuartzMesostructureVfxRect, point: QuartzMesostructureVfxPoint): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}
function inside(rect: QuartzMesostructureVfxRect, container: QuartzMesostructureVfxRect): boolean {
  return rect.x >= container.x && rect.y >= container.y
    && rect.x + rect.width <= container.x + container.width
    && rect.y + rect.height <= container.y + container.height;
}
function intersects(left: QuartzMesostructureVfxRect, right: QuartzMesostructureVfxRect): boolean {
  return left.x < right.x + right.width && left.x + left.width > right.x
    && left.y < right.y + right.height && left.y + left.height > right.y;
}
function pointRect(point: QuartzMesostructureVfxPoint): QuartzMesostructureVfxRect {
  return { ...point, width: 1, height: 1 };
}
function countMaterial(cells: Uint8Array, material: Material): number {
  let count = 0;
  for (const value of cells) count += Number(value === material);
  return count;
}
function countOccupied(cells: Uint8Array): number {
  let count = 0;
  for (const value of cells) count += Number(value !== Material.Empty);
  return count;
}
function countMaterialState(
  cells: Uint8Array, states: Uint16Array, material: Material, state: number,
): number {
  let count = 0;
  for (let index = 0; index < cells.length; index++) {
    count += Number(cells[index] === material && states[index] === state);
  }
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
