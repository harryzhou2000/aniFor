import { describe, expect, it } from 'vitest';
import { createRenderLookups } from '../renderer/render-field-set';
import { writeSolidOpticalDepth } from '../renderer/solid-optical-depth-field';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  ROCK_ROUGHNESS_VFX_AUDIT,
  prepareRockRoughnessVfxFixture,
  type RockRoughnessVfxContact,
  type RockRoughnessVfxPane,
  type RockRoughnessVfxPoint,
  type RockRoughnessVfxRect,
} from './rock-roughness-vfx-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const world: RockRoughnessVfxRect = {
  x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT,
};

describe('ROCK roughness VFX audit fixture', () => {
  it('pins geometry-matched broad ROCK and Metal cards with exact authored topology', () => {
    const [rock, metal] = ROCK_ROUGHNESS_VFX_AUDIT.panes;
    expect([rock.code, rock.material]).toEqual(['ROCK_TARGET', Material.ROCK]);
    expect([metal.code, metal.material]).toEqual(['METAL_REFERENCE', Material.Metal]);
    expect(normalizedPane(rock)).toEqual(normalizedPane(metal));

    const simulation = preparedFixture();
    const cells = simulation.cells();
    for (const pane of ROCK_ROUGHNESS_VFX_AUDIT.panes) {
      expectRectExcept(cells, pane.body, pane.material, [pane.authoredHole, pane.openNotch]);
      expectRect(cells, pane.authoredHole, Material.Empty);
      expectRect(cells, pane.openNotch, Material.Empty);
      expect(pane.openNotch.x + pane.openNotch.width).toBe(pane.body.x + pane.body.width);
    }
  });

  it('pins exact surface-to-core solid optical-depth bands on both cards', () => {
    const simulation = preparedFixture();
    const depth = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT);
    writeSolidOpticalDepth(
      simulation.cells(), depth, createRenderLookups(ALL_MATERIALS).styleBytes,
      WORLD_WIDTH, simulation.walls(),
    );

    for (const pane of ROCK_ROUGHNESS_VFX_AUDIT.panes) {
      const sampleY = pane.shallowBand.y + Math.floor(pane.shallowBand.height / 2);
      expect(depthAt(depth, { x: pane.surfaceLayer.x, y: sampleY })).toBe(0);
      expect(depthAt(depth, { x: pane.firstInnerLayer.x, y: sampleY })).toBe(6);
      expect(Array.from({ length: pane.shallowBand.width }, (_, offset) => (
        depthAt(depth, { x: pane.shallowBand.x + offset, y: sampleY })
      ))).toEqual([12, 18, 24, 30]);
      expect(Array.from({ length: pane.transitionBand.width }, (_, offset) => (
        depthAt(depth, { x: pane.transitionBand.x + offset, y: sampleY })
      ))).toEqual([36, 42, 48, 54, 60, 66]);
      expect(Array.from({ length: pane.midBand.width }, (_, offset) => (
        depthAt(depth, { x: pane.midBand.x + offset, y: sampleY })
      ))).toEqual([72, 78, 84, 90, 96, 102, 108, 114, 120, 126]);
      expect(depthRange(depth, pane.deepCore)).toEqual({ min: 192, max: 255 });
      expect(depthAt(depth, centre(pane.authoredHole))).toBe(0);
      expect(depthAt(depth, centre(pane.openNotch))).toBe(0);
    }
    expect(depthAt(depth, {
      x: ROCK_ROUGHNESS_VFX_AUDIT.thinLine.x,
      y: ROCK_ROUGHNESS_VFX_AUDIT.thinLine.y + 12,
    })).toBe(0);
    expect(depthAt(depth, ROCK_ROUGHNESS_VFX_AUDIT.isolated)).toBe(0);
  });

  it('keeps fine ROCK, native walls, controls, and all four contact classes exact', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    const walls = simulation.walls();
    const fixture = ROCK_ROUGHNESS_VFX_AUDIT;

    expectRect(cells, fixture.thinLine, Material.ROCK);
    expect(materialAt(cells, fixture.isolated)).toBe(Material.ROCK);
    expectRect(cells, fixture.nativeWall.rock, Material.ROCK);
    expectRect(walls, fixture.nativeWall.wallRegion, fixture.conductiveWall);
    expect(wallAt(walls, fixture.nativeWall.wallProbe)).toBe(fixture.conductiveWall);
    expect(wallAt(walls, fixture.nativeWall.clearProbe)).toBe(0);
    expect(Array.from(walls).filter(Boolean)).toHaveLength(
      fixture.nativeWall.wallRegion.width * fixture.nativeWall.wallRegion.height,
    );

    for (const entry of Object.values(fixture.controls)) {
      expectRect(cells, entry, entry.material);
    }
    expect(Object.values(fixture.contacts).map(({ code, otherMaterial }) => (
      [code, otherMaterial]
    ))).toEqual([
      ['ROCK_METL', Material.Metal],
      ['ROCK_WATR', Material.Water],
      ['ROCK_SAND', Material.Sand],
      ['ROCK_SMKE', Material.Smoke],
    ]);
    for (const entry of Object.values(fixture.contacts)) expectContact(cells, entry);
  });

  it('keeps every independent region disjoint and inside the 612x384 world', () => {
    const fixture = ROCK_ROUGHNESS_VFX_AUDIT;
    const independent: RockRoughnessVfxRect[] = [
      ...fixture.panes.map(({ body }) => body),
      fixture.thinLine,
      { ...fixture.isolated, width: 1, height: 1 },
      fixture.nativeWall.rock,
      ...Object.values(fixture.controls),
      ...Object.values(fixture.contacts).flatMap(({ rock, other }) => [rock, other]),
    ];
    for (const rect of independent) expect(rectInside(rect, world)).toBe(true);
    for (let index = 0; index < independent.length; index++) {
      for (let other = index + 1; other < independent.length; other++) {
        expect(intersects(independent[index], independent[other])).toBe(false);
      }
    }

    for (const pane of fixture.panes) {
      const bands = [pane.surfaceLayer, pane.firstInnerLayer, pane.shallowBand,
        pane.transitionBand, pane.midBand, pane.deepCore];
      for (const rect of [...bands, pane.authoredHole, pane.openNotch]) {
        expect(rectInside(rect, pane.body)).toBe(true);
      }
      for (let index = 0; index < bands.length; index++) {
        for (let other = index + 1; other < bands.length; other++) {
          expect(intersects(bands[index], bands[other])).toBe(false);
        }
      }
      for (const band of bands) {
        expect(intersects(band, pane.authoredHole)).toBe(false);
        expect(intersects(band, pane.openNotch)).toBe(false);
      }
      expect(intersects(pane.authoredHole, pane.openNotch)).toBe(false);
    }
    expect(rectInside(fixture.nativeWall.wallRegion, fixture.nativeWall.rock)).toBe(true);
  });

  it('resets semantic and native-wall planes deterministically and rejects unsupported backends', () => {
    const first = preparedFixture();
    const second = preparedFixture();
    expect(byteHash(first.cells())).toBe(byteHash(second.cells()));
    expect(byteHash(first.walls())).toBe(byteHash(second.walls()));

    const expectedCells = first.cells().slice();
    const expectedWalls = first.walls().slice();
    first.cells().fill(Material.Fire);
    first.paintWall(4, 4, 2, 0);
    prepareRockRoughnessVfxFixture(first);
    expect(firstDifference(first.cells(), expectedCells)).toBe(-1);
    expect(firstDifference(first.walls(), expectedWalls)).toBe(-1);

    expect(() => prepareRockRoughnessVfxFixture(new RenderLabBackend(32, 32)))
      .toThrow('requires 612x384');
    expect(() => prepareRockRoughnessVfxFixture(
      new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT),
    )).toThrow('requires a RenderLab native wall plane');
  });
});

function preparedFixture(): RenderLabBackend {
  const simulation = new RenderLabBackend(WORLD_WIDTH, WORLD_HEIGHT);
  prepareRockRoughnessVfxFixture(simulation);
  return simulation;
}

function normalizedPane(pane: RockRoughnessVfxPane): Record<string, RockRoughnessVfxRect> {
  const result: Record<string, RockRoughnessVfxRect> = {};
  for (const key of ['body', 'surfaceLayer', 'firstInnerLayer', 'shallowBand',
    'transitionBand', 'midBand', 'deepCore', 'authoredHole', 'openNotch'] as const) {
    const rect = pane[key];
    result[key] = { ...rect, x: rect.x - pane.body.x, y: rect.y - pane.body.y };
  }
  return result;
}

function expectContact(cells: Uint8Array, entry: RockRoughnessVfxContact): void {
  expectRect(cells, entry.rock, Material.ROCK);
  expectRect(cells, entry.other, entry.otherMaterial);
  expect(entry.rock.x + entry.rock.width).toBe(entry.other.x);
  expect(entry.rockProbe.x + 1).toBe(entry.otherProbe.x);
  expect(materialAt(cells, entry.rockProbe)).toBe(Material.ROCK);
  expect(materialAt(cells, entry.otherProbe)).toBe(entry.otherMaterial);
}

function materialAt(cells: Uint8Array, point: RockRoughnessVfxPoint): Material {
  return cells[point.y * WORLD_WIDTH + point.x] as Material;
}

function wallAt(walls: Uint8Array, point: RockRoughnessVfxPoint): number {
  return walls[point.y * WORLD_WIDTH + point.x];
}

function depthAt(depth: Uint8Array, point: RockRoughnessVfxPoint): number {
  return depth[point.y * WORLD_WIDTH + point.x];
}

function depthRange(
  depth: Uint8Array,
  rect: RockRoughnessVfxRect,
): { min: number; max: number } {
  let min = 255;
  let max = 0;
  forEachPoint(rect, (point) => {
    const value = depthAt(depth, point);
    min = Math.min(min, value);
    max = Math.max(max, value);
  });
  return { min, max };
}

function centre(rect: RockRoughnessVfxRect): RockRoughnessVfxPoint {
  return {
    x: Math.floor(rect.x + rect.width / 2),
    y: Math.floor(rect.y + rect.height / 2),
  };
}

function expectRect(
  bytes: Uint8Array,
  rect: RockRoughnessVfxRect,
  expected: number,
): void {
  let mismatch: RockRoughnessVfxPoint | undefined;
  forEachPoint(rect, (point) => {
    if (!mismatch && bytes[point.y * WORLD_WIDTH + point.x] !== expected) mismatch = point;
  });
  expect(mismatch).toBeUndefined();
}

function expectRectExcept(
  cells: Uint8Array,
  rect: RockRoughnessVfxRect,
  material: Material,
  exceptions: readonly RockRoughnessVfxRect[],
): void {
  let mismatch: RockRoughnessVfxPoint | undefined;
  forEachPoint(rect, (point) => {
    if (exceptions.some((exception) => contains(exception, point))) return;
    if (!mismatch && materialAt(cells, point) !== material) mismatch = point;
  });
  expect(mismatch).toBeUndefined();
}

function rectInside(inner: RockRoughnessVfxRect, outer: RockRoughnessVfxRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function intersects(left: RockRoughnessVfxRect, right: RockRoughnessVfxRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

function contains(rect: RockRoughnessVfxRect, point: RockRoughnessVfxPoint): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function forEachPoint(
  rect: RockRoughnessVfxRect,
  visit: (point: RockRoughnessVfxPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}

function byteHash(values: Uint8Array): number {
  let hash = 2166136261;
  for (const value of values) hash = Math.imul(hash ^ value, 16777619) >>> 0;
  return hash;
}

function firstDifference(left: Uint8Array, right: Uint8Array): number {
  if (left.length !== right.length) return Math.min(left.length, right.length);
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return index;
  }
  return -1;
}
