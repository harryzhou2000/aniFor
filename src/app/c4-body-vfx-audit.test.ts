import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RenderOptics, renderOptics } from '../renderer/render-optics';
import { RenderPhase, RenderProfile, renderPhase, renderProfile } from '../renderer/render-profile';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  C4_BODY_VFX_AUDIT,
  prepareC4BodyVfxAuditFixture,
  type C4BodyVfxBoundary,
  type C4BodyVfxPoint,
  type C4BodyVfxRect,
  type C4BodyVfxWallPattern,
} from './c4-body-vfx-audit';

const WIDTH = 612;
const HEIGHT = 384;

describe('C4 body VFX audit fixture', () => {
  it('pins native C4 31 as the exact Smooth rough-granular target', () => {
    expect(Material.C4).toBe(31);
    const material = ALL_MATERIALS.find(({ id }) => id === Material.C4);
    expect(material).toBeDefined();
    if (!material) return;
    expect(renderPhase(material)).toBe(RenderPhase.Powder);
    expect(renderProfile(material.category)).toBe(RenderProfile.Granular);
    expect(renderOptics(material)).toBe(RenderOptics.RoughGranular);
    expect(C4_BODY_VFX_AUDIT.target).toMatchObject({ code: 'C4', material: 31 });
    expect(C4_BODY_VFX_AUDIT.target.body).toEqual({ x: 20, y: 20, width: 340, height: 150 });
    expect(C4_BODY_VFX_AUDIT.powderStyleMatrix).toEqual([
      { style: 'smooth', expectation: 'target' },
      { style: 'local', expectation: 'exact-no-op' },
      { style: 'grains', expectation: 'exact-no-op' },
    ]);

    const cells = prepared().cells();
    for (const region of [
      C4_BODY_VFX_AUDIT.target.core,
      C4_BODY_VFX_AUDIT.target.crown,
      C4_BODY_VFX_AUDIT.target.pocket,
    ]) expectRect(cells, region, Material.C4);
  });

  it('preserves the settled broad C4 body, authored openings, and fine topology', () => {
    const simulation = prepared();
    const { target, fineTopology } = C4_BODY_VFX_AUDIT;

    expectRectExcept(simulation.cells(), target.body, target.material, [target.authoredHole, target.openChannel]);
    expectRect(simulation.cells(), target.authoredHole, Material.Empty);
    expectRect(simulation.cells(), target.openChannel, Material.Empty);
    expect(target.openChannel.y).toBe(target.body.y);
    expectRect(simulation.cells(), fineTopology.column, target.material);
    expect(fineTopology.column.width).toBe(1);
    expectRect(simulation.cells(), fineTopology.line, target.material);
    expect(fineTopology.line.height).toBe(1);
    expect(at(simulation.cells(), fineTopology.isolated)).toBe(target.material);

    for (const stable of [target.core, target.crown, target.pocket]) {
      expectVelocityRect(simulation.velocity(), stable, 0, 0);
      expect(intersects(stable, target.authoredHole)).toBe(false);
      expect(intersects(stable, target.openChannel)).toBe(false);
      expect(intersects(stable, target.wallCoexistence.region)).toBe(false);
    }
  });

  it('keeps moving C4 and genuine 2:1 C4/Water suspension exact and disjoint', () => {
    const simulation = prepared();
    const { movingControl, suspensionControl, expected } = C4_BODY_VFX_AUDIT;

    expectRect(simulation.cells(), movingControl, Material.C4);
    expectVelocityRect(
      simulation.velocity(), movingControl, movingControl.velocityX, movingControl.velocityY,
    );
    expect(countVelocityCells(simulation.velocity())).toBe(expected.movingVelocityCells);

    const c4 = new Set(suspensionControl.c4Points.map(({ x, y }) => y * WIDTH + x));
    each(suspensionControl.region, ({ x, y }) => {
      expect(simulation.cells()[y * WIDTH + x]).toBe(
        c4.has(y * WIDTH + x) ? Material.C4 : Material.Water,
      );
    });
    expect(c4.size).toBe(expected.suspensionC4Cells);
    expect(area(suspensionControl.region) - c4.size).toBe(expected.suspensionWaterCells);
    expect(at(simulation.cells(), suspensionControl.c4Probe)).toBe(Material.C4);
    expect(at(simulation.cells(), suspensionControl.waterProbe)).toBe(Material.Water);
    expectVelocityRect(simulation.velocity(), suspensionControl.region, 0, 0);
  });

  it('preserves exact controls, C4 contacts, checker walls, blank space, and zero state', () => {
    const simulation = prepared();
    const fixture = C4_BODY_VFX_AUDIT;
    const controls = fixture.materialControls;

    expect(Object.values(controls).map(({ material }) => material)).toEqual([
      Material.Sand, Material.Clay, Material.Dust, Material.Thermite, Material.Firework,
      Material.Gunpowder, Material.Snow, Material.Quartz, Material.BREC, Material.Nitro,
    ]);
    for (const entry of Object.values(controls)) {
      expect(area(entry)).toBe(fixture.expected.cellsPerMaterialControl);
      expectRect(simulation.cells(), entry, entry.material);
    }
    for (const entry of Object.values(fixture.contacts)) expectBoundary(simulation.cells(), entry);
    expectWallPattern(simulation.cells(), simulation.walls(), fixture.target.wallCoexistence, Material.C4);
    expect(countNonzero(simulation.walls())).toBe(fixture.expected.wallCells);
    expect(wallAt(simulation.walls(), fixture.target.wallCoexistence.wallProbe)).toBe(fixture.conductiveWall);
    expect(wallAt(simulation.walls(), fixture.target.wallCoexistence.clearProbe)).toBe(0);
    expectRect(simulation.cells(), fixture.guardedBlank, Material.Empty);
    expect(countNonzero(simulation.presentationState())).toBe(fixture.expected.presentationStateCells);
  });

  it('freezes E50-layout semantic/native cardinalities', () => {
    const simulation = prepared();
    const { expected, materialControls } = C4_BODY_VFX_AUDIT;

    expect(countOccupied(simulation.cells())).toBe(expected.occupiedCells);
    expect(countMaterial(simulation.cells(), Material.C4)).toBe(expected.c4Cells);
    expect(countMaterial(simulation.cells(), Material.Water)).toBe(expected.waterCells);
    expect(countMaterial(simulation.cells(), Material.Metal)).toBe(expected.metalCells);
    for (const entry of Object.values(materialControls)) {
      expect(countMaterial(simulation.cells(), entry.material)).toBe(expected.cellsPerMaterialControl);
    }
    expect(countNonzero(simulation.walls())).toBe(expected.wallCells);
    expect(countVelocityCells(simulation.velocity())).toBe(expected.movingVelocityCells);
    expect(countNonzero(simulation.presentationState())).toBe(expected.presentationStateCells);
    expect(countMaterial(simulation.cells(), Material.Empty)).toBe(WIDTH * HEIGHT - expected.occupiedCells);
  });

  it('keeps every independent region in bounds, disjoint, and deterministically reset', () => {
    const fixture = C4_BODY_VFX_AUDIT;
    const world: C4BodyVfxRect = { x: 0, y: 0, width: WIDTH, height: HEIGHT };
    const independent: C4BodyVfxRect[] = [
      fixture.target.body,
      fixture.fineTopology.column,
      fixture.fineTopology.line,
      pointRect(fixture.fineTopology.isolated),
      fixture.movingControl,
      fixture.suspensionControl.region,
      ...Object.values(fixture.materialControls),
      ...Object.values(fixture.contacts).flatMap(({ c4, other }) => [c4, other]),
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
    const states = first.presentationState().slice();
    first.cells().fill(Material.Fire);
    first.paintWall(4, 4, 2, 0);
    first.setFixtureVelocityRect(0, 0, 8, 8, 127, 127);
    first.setFixturePresentationStateRect(0, 0, 8, 8, 0xFFFF);
    prepareC4BodyVfxAuditFixture(first);
    expect(firstDifference(first.cells(), cells)).toBe(-1);
    expect(firstDifference(first.walls(), walls)).toBe(-1);
    expect(firstDifference(first.velocity(), velocity)).toBe(-1);
    expect(firstDifference(first.presentationState(), states)).toBe(-1);
    expect(() => prepareC4BodyVfxAuditFixture(new RenderLabBackend(32, 32)))
      .toThrow('requires 612x384');
    expect(() => prepareC4BodyVfxAuditFixture(new DeterministicBackend(WIDTH, HEIGHT)))
      .toThrow('requires canonical wall, velocity, and state planes');
  });

  it('requires settled normal-detail evidence without uploading the dense fixture at true 8x', () => {
    const source = readFileSync(
      new URL('../../scripts/verify-browser-input.mjs', import.meta.url), 'utf8',
    );
    const normalStart = source.indexOf('async function navigateC4BodyVfxState');
    const normalEnd = source.indexOf('async function c4BodyVfxFixtureReady', normalStart);
    const normal = source.slice(normalStart, normalEnd);
    const eightStart = source.indexOf('async function auditEightXC4BodyVfxExclusion');
    const eightEnd = source.indexOf('// E49\'s accepted', eightStart);
    const eight = source.slice(eightStart, eightEnd);
    expect(normalStart).toBeGreaterThanOrEqual(0);
    expect(normalEnd).toBeGreaterThan(normalStart);
    expect(normal).toContain('pass < 7');
    expect(normal).toContain('refreshPresentationFields()');
    expect(normal).toContain('c4BodyVfxAuxiliaryDigest');
    expect(normal).toContain('sampleVolumeVfxCanvasAlphaSupport');
    expect(source).toContain('c4BodyVfxTextureRegions');
    expect(eightStart).toBeGreaterThanOrEqual(0);
    expect(eightEnd).toBeGreaterThan(eightStart);
    expect(eight).toContain("renderScale: '8'");
    expect(eight).not.toContain('prepareC4BodyVfxFixture');
    expect(eight).toContain('auditWebGLPresentationTiming');
  });
});

function prepared(): RenderLabBackend {
  const simulation = new RenderLabBackend(WIDTH, HEIGHT);
  prepareC4BodyVfxAuditFixture(simulation);
  return simulation;
}

function at(cells: Uint8Array, point: C4BodyVfxPoint): Material {
  return cells[point.y * WIDTH + point.x] as Material;
}

function wallAt(walls: Uint8Array, point: C4BodyVfxPoint): number {
  return walls[point.y * WIDTH + point.x];
}

function expectRect(cells: Uint8Array, rect: C4BodyVfxRect, material: Material): void {
  each(rect, (point) => expect(at(cells, point)).toBe(material));
}

function expectRectExcept(
  cells: Uint8Array, rect: C4BodyVfxRect, material: Material,
  exceptions: readonly C4BodyVfxRect[],
): void {
  each(rect, (point) => {
    if (!exceptions.some((entry) => contains(entry, point))) expect(at(cells, point)).toBe(material);
  });
}

function expectVelocityRect(
  velocity: Int8Array, rect: C4BodyVfxRect, x: number, y: number,
): void {
  each(rect, (point) => {
    const offset = (point.y * WIDTH + point.x) * 2;
    expect(velocity[offset]).toBe(x);
    expect(velocity[offset + 1]).toBe(y);
  });
}

function expectBoundary(cells: Uint8Array, entry: C4BodyVfxBoundary): void {
  expectRect(cells, entry.c4, Material.C4);
  expectRect(cells, entry.other, entry.otherMaterial);
  expect(entry.c4.x + entry.c4.width).toBe(entry.other.x);
  expect(at(cells, entry.c4Probe)).toBe(Material.C4);
  expect(at(cells, entry.otherProbe)).toBe(entry.otherMaterial);
}

function expectWallPattern(
  cells: Uint8Array, walls: Uint8Array,
  pattern: C4BodyVfxWallPattern, material: Material,
): void {
  each(pattern.region, ({ x, y }) => {
    const blockX = Math.floor((x - pattern.region.x) / pattern.blockSize);
    const blockY = Math.floor((y - pattern.region.y) / pattern.blockSize);
    expect(at(cells, { x, y })).toBe(material);
    expect(walls[y * WIDTH + x]).toBe(
      (blockX + blockY) % 2 === pattern.occupiedParity ? C4_BODY_VFX_AUDIT.conductiveWall : 0,
    );
  });
}

function each(rect: C4BodyVfxRect, action: (point: C4BodyVfxPoint) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) action({ x, y });
  }
}

function area(rect: C4BodyVfxRect): number { return rect.width * rect.height; }

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

function countNonzero(values: Uint8Array | Uint16Array): number {
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

function contains(rect: C4BodyVfxRect, point: C4BodyVfxPoint): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function inside(rect: C4BodyVfxRect, container: C4BodyVfxRect): boolean {
  return rect.x >= container.x && rect.y >= container.y
    && rect.x + rect.width <= container.x + container.width
    && rect.y + rect.height <= container.y + container.height;
}

function intersects(left: C4BodyVfxRect, right: C4BodyVfxRect): boolean {
  return left.x < right.x + right.width && left.x + left.width > right.x
    && left.y < right.y + right.height && left.y + left.height > right.y;
}

function pointRect(point: C4BodyVfxPoint): C4BodyVfxRect { return { ...point, width: 1, height: 1 }; }

function firstDifference(left: Uint8Array | Uint16Array | Int8Array, right: Uint8Array | Uint16Array | Int8Array): number {
  for (let index = 0; index < left.length; index++) if (left[index] !== right[index]) return index;
  return -1;
}
