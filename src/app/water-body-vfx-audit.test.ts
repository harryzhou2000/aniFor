import { describe, expect, it } from 'vitest';
import { LiquidDensityField } from '../renderer/liquid-density-field';
import { createRenderLookups } from '../renderer/render-field-set';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  WATER_BODY_VFX_AUDIT,
  prepareWaterBodyVfxFixture,
  type WaterBodyVfxBoundary,
  type WaterBodyVfxPoint,
  type WaterBodyVfxRect,
  type WaterBodyVfxWallPattern,
} from './water-body-vfx-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const world: WaterBodyVfxRect = { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT };

describe('Water body VFX audit fixture', () => {
  it('pins paired broad exact-Water panes and every exact optical-depth band', () => {
    expect(WATER_BODY_VFX_AUDIT.panes.map(({ code, material, backing }) => (
      [code, material, backing.kind]
    ))).toEqual([
      ['OPEN_POOL', Material.Water, 'air'],
      ['WALL_CONTROL', Material.Water, 'native-wall-checker'],
    ]);

    const simulation = preparedFixture();
    const lookups = createRenderLookups(ALL_MATERIALS);
    const field = new LiquidDensityField(
      WORLD_WIDTH, WORLD_HEIGHT, lookups.liquidByMaterial, lookups.colorByMaterial,
    );
    const depth = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT);
    field.writeVerticalOpticalDepth(simulation.cells(), depth, simulation.walls());

    for (const pane of WATER_BODY_VFX_AUDIT.panes) {
      expect(depthRange(depth, pane.surfaceLayer)).toEqual({ min: 0, max: 0 });
      expect(depthRange(depth, pane.firstInnerLayer)).toEqual({ min: 6, max: 6 });
      expect(depthRange(depth, pane.shallowBand)).toEqual({ min: 12, max: 30 });
      expect(depthRange(depth, pane.transitionBand)).toEqual({ min: 36, max: 66 });
      expect(depthRange(depth, pane.midBand)).toEqual({ min: 72, max: 126 });
      expect(depthRange(depth, pane.deepCore)).toEqual({ min: 192, max: 255 });
      expect(depthAt(depth, pane.reconstructablePinhole)).toBe(0);
    }

    const wallPane = WATER_BODY_VFX_AUDIT.panes.find(
      ({ backing }) => backing.kind === 'native-wall-checker',
    );
    expect(wallPane?.backing.kind).toBe('native-wall-checker');
    if (wallPane?.backing.kind === 'native-wall-checker') {
      expect(depthRange(depth, wallPane.backing.region)).toEqual({ min: 0, max: 18 });
    }
  });

  it('authors Water topology, sparse controls, exact peers, seams, and contacts', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();

    for (const pane of WATER_BODY_VFX_AUDIT.panes) {
      expectRectExcept(cells, pane.body, Material.Water, [
        pane.authoredHole,
        pane.openChimney,
        { ...pane.reconstructablePinhole, width: 1, height: 1 },
      ]);
      expectRect(cells, pane.authoredHole, Material.Empty);
      expectRect(cells, pane.openChimney, Material.Empty);
      expect(materialAt(cells, pane.reconstructablePinhole)).toBe(Material.Empty);
      expectFourCardinals(cells, pane.reconstructablePinhole, Material.Water);
    }

    const { sparse, materialControls, seams, contacts } = WATER_BODY_VFX_AUDIT;
    expectRect(cells, sparse.thinStrand, Material.Water);
    expectRect(cells, sparse.droplet, Material.Water);
    expect(materialAt(cells, sparse.isolated)).toBe(Material.Water);
    for (const entry of Object.values(materialControls)) {
      expectRect(cells, entry, entry.material);
    }
    for (const entry of [...Object.values(seams), ...Object.values(contacts)]) {
      expectBoundary(cells, entry);
    }
    expectRect(cells, WATER_BODY_VFX_AUDIT.guardedBlank, Material.Empty);

    expect(materialCount(cells, Material.Water)).toBe(98_479);
    expect(materialCount(cells, Material.SaltWater)).toBe(5_888);
    expect(materialCount(cells, Material.Oil)).toBe(5_888);
    for (const material of [
      Material.DistilledWater, Material.DEUT, Material.Acid, Material.Lava,
    ]) {
      expect(materialCount(cells, material)).toBe(4_608);
    }
    for (const material of [Material.Glass, Material.Metal, Material.Sand, Material.Smoke]) {
      expect(materialCount(cells, material)).toBe(1_280);
    }
  });

  it('authors one aligned 3,072-cell wall checker without changing Water ownership', () => {
    const simulation = preparedFixture();
    const walls = simulation.walls();
    const cells = simulation.cells();
    const wallPane = WATER_BODY_VFX_AUDIT.panes.find(
      ({ backing }) => backing.kind === 'native-wall-checker',
    );
    expect(wallPane?.backing.kind).toBe('native-wall-checker');
    if (!wallPane || wallPane.backing.kind !== 'native-wall-checker') return;

    expectWallPattern(cells, walls, wallPane.backing);
    expect(Array.from(walls).filter(Boolean)).toHaveLength(3_072);
    expect(wallAt(walls, wallPane.backing.wallProbe)).toBe(
      WATER_BODY_VFX_AUDIT.conductiveWall,
    );
    expect(wallAt(walls, wallPane.backing.clearProbe)).toBe(0);
  });

  it('keeps every independent region disjoint and every depth/control probe in bounds', () => {
    const fixture = WATER_BODY_VFX_AUDIT;
    const independent: WaterBodyVfxRect[] = [
      ...fixture.panes.map(({ body }) => body),
      fixture.sparse.thinStrand,
      fixture.sparse.droplet,
      { ...fixture.sparse.isolated, width: 1, height: 1 },
      ...Object.values(fixture.materialControls),
      ...Object.values(fixture.seams).flatMap(({ water, other }) => [water, other]),
      ...Object.values(fixture.contacts).flatMap(({ water, other }) => [water, other]),
      fixture.guardedBlank,
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
      for (const rect of [...bands, pane.authoredHole, pane.openChimney]) {
        expect(rectInside(rect, pane.body)).toBe(true);
      }
      expect(pointInside(pane.reconstructablePinhole, pane.body)).toBe(true);
      for (let index = 0; index < bands.length; index++) {
        for (let other = index + 1; other < bands.length; other++) {
          expect(intersects(bands[index], bands[other])).toBe(false);
        }
      }
      for (const band of bands) {
        expect(intersects(band, pane.authoredHole)).toBe(false);
        expect(intersects(band, pane.openChimney)).toBe(false);
        expect(contains(band, pane.reconstructablePinhole)).toBe(false);
      }
      expect(intersects(pane.authoredHole, pane.openChimney)).toBe(false);
      expect(contains(pane.authoredHole, pane.reconstructablePinhole)).toBe(false);
      expect(contains(pane.openChimney, pane.reconstructablePinhole)).toBe(false);
      if (pane.backing.kind === 'native-wall-checker') {
        expect(rectInside(pane.backing.region, pane.body)).toBe(true);
        for (const band of bands) expect(intersects(band, pane.backing.region)).toBe(false);
        expect(intersects(pane.authoredHole, pane.backing.region)).toBe(false);
        expect(intersects(pane.openChimney, pane.backing.region)).toBe(false);
        expect(contains(pane.backing.region, pane.reconstructablePinhole)).toBe(false);
      }
    }
  });

  it('resets deterministically and rejects wrong-sized and unsupported backends', () => {
    const first = preparedFixture();
    const second = preparedFixture();
    expect(byteHash(first.cells())).toBe(byteHash(second.cells()));
    expect(byteHash(first.walls())).toBe(byteHash(second.walls()));

    const expectedCells = first.cells().slice();
    const expectedWalls = first.walls().slice();
    first.cells().fill(Material.Fire);
    first.paintWall(4, 4, 2, 0);
    prepareWaterBodyVfxFixture(first);
    expect(firstDifference(first.cells(), expectedCells)).toBe(-1);
    expect(firstDifference(first.walls(), expectedWalls)).toBe(-1);

    expect(() => prepareWaterBodyVfxFixture(new RenderLabBackend(32, 32)))
      .toThrow('requires 612x384');
    expect(() => prepareWaterBodyVfxFixture(
      new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT),
    )).toThrow('requires a RenderLab native wall plane');
  });
});

function preparedFixture(): RenderLabBackend {
  const simulation = new RenderLabBackend(WORLD_WIDTH, WORLD_HEIGHT);
  prepareWaterBodyVfxFixture(simulation);
  return simulation;
}

function materialAt(cells: Uint8Array, point: WaterBodyVfxPoint): Material {
  return cells[point.y * WORLD_WIDTH + point.x] as Material;
}

function wallAt(walls: Uint8Array, point: WaterBodyVfxPoint): number {
  return walls[point.y * WORLD_WIDTH + point.x];
}

function depthAt(depth: Uint8Array, point: WaterBodyVfxPoint): number {
  return depth[point.y * WORLD_WIDTH + point.x];
}

function depthRange(depth: Uint8Array, rect: WaterBodyVfxRect): { min: number; max: number } {
  let min = 255;
  let max = 0;
  forEachPoint(rect, (point) => {
    const value = depthAt(depth, point);
    min = Math.min(min, value);
    max = Math.max(max, value);
  });
  return { min, max };
}

function expectBoundary(cells: Uint8Array, entry: WaterBodyVfxBoundary): void {
  expectRect(cells, entry.water, Material.Water);
  expectRect(cells, entry.other, entry.otherMaterial);
  expect(entry.water.x + entry.water.width).toBe(entry.other.x);
  expect(materialAt(cells, entry.waterProbe)).toBe(Material.Water);
  expect(materialAt(cells, entry.otherProbe)).toBe(entry.otherMaterial);
  expect(entry.waterProbe.x + 1).toBe(entry.otherProbe.x);
}

function expectRect(cells: Uint8Array, rect: WaterBodyVfxRect, material: Material): void {
  let mismatch: WaterBodyVfxPoint | undefined;
  forEachPoint(rect, (point) => {
    if (!mismatch && materialAt(cells, point) !== material) mismatch = point;
  });
  expect(mismatch).toBeUndefined();
}

function expectRectExcept(
  cells: Uint8Array,
  rect: WaterBodyVfxRect,
  material: Material,
  exceptions: readonly WaterBodyVfxRect[],
): void {
  let mismatch: WaterBodyVfxPoint | undefined;
  forEachPoint(rect, (point) => {
    if (exceptions.some((exception) => contains(exception, point))) return;
    if (!mismatch && materialAt(cells, point) !== material) mismatch = point;
  });
  expect(mismatch).toBeUndefined();
}

function expectFourCardinals(
  cells: Uint8Array,
  point: WaterBodyVfxPoint,
  material: Material,
): void {
  for (const [x, y] of [[point.x - 1, point.y], [point.x + 1, point.y],
    [point.x, point.y - 1], [point.x, point.y + 1]]) {
    expect(cells[y * WORLD_WIDTH + x]).toBe(material);
  }
}

function expectWallPattern(
  cells: Uint8Array,
  walls: Uint8Array,
  pattern: WaterBodyVfxWallPattern,
): void {
  expect(pattern.region.x % pattern.blockSize).toBe(0);
  expect(pattern.region.y % pattern.blockSize).toBe(0);
  expect(pattern.region.width % pattern.blockSize).toBe(0);
  expect(pattern.region.height % pattern.blockSize).toBe(0);
  let materialMismatch: WaterBodyVfxPoint | undefined;
  let wallMismatch: WaterBodyVfxPoint | undefined;
  forEachPoint(pattern.region, (point) => {
    if (!materialMismatch && materialAt(cells, point) !== Material.Water) {
      materialMismatch = point;
    }
    const blockX = Math.floor((point.x - pattern.region.x) / pattern.blockSize);
    const blockY = Math.floor((point.y - pattern.region.y) / pattern.blockSize);
    const expected = (blockX + blockY) % 2 === pattern.occupiedParity
      ? WATER_BODY_VFX_AUDIT.conductiveWall : 0;
    if (!wallMismatch && wallAt(walls, point) !== expected) wallMismatch = point;
  });
  expect(materialMismatch).toBeUndefined();
  expect(wallMismatch).toBeUndefined();
}

function materialCount(cells: Uint8Array, material: Material): number {
  let count = 0;
  for (const value of cells) count += Number(value === material);
  return count;
}

function rectInside(inner: WaterBodyVfxRect, outer: WaterBodyVfxRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function pointInside(point: WaterBodyVfxPoint, outer: WaterBodyVfxRect): boolean {
  return point.x >= outer.x && point.y >= outer.y
    && point.x < outer.x + outer.width && point.y < outer.y + outer.height;
}

function intersects(left: WaterBodyVfxRect, right: WaterBodyVfxRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

function contains(rect: WaterBodyVfxRect, point: WaterBodyVfxPoint): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function forEachPoint(rect: WaterBodyVfxRect, visit: (point: WaterBodyVfxPoint) => void): void {
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
