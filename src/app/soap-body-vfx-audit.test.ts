import { describe, expect, it } from 'vitest';
import { LiquidDensityField } from '../renderer/liquid-density-field';
import { createRenderLookups } from '../renderer/render-field-set';
import { RenderOptics } from '../renderer/render-optics';
import { RenderPhase, RenderProfile } from '../renderer/render-profile';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  SOAP_BODY_VFX_AUDIT,
  prepareSoapBodyVfxAuditFixture,
  type SoapBodyVfxBoundary,
  type SoapBodyVfxPoint,
  type SoapBodyVfxRect,
  type SoapBodyVfxWallPattern,
} from './soap-body-vfx-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const world: SoapBodyVfxRect = { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT };

describe('Soap body VFX audit fixture', () => {
  it('pins exact native Soap identity, liquid phase, neutral profile, and ViscousLiquid optics', () => {
    expect(Material.Soap).toBe(38);
    const material = ALL_MATERIALS.find(({ id }) => id === Material.Soap);
    expect(material).toMatchObject({
      id: Material.Soap,
      name: 'Soap',
      category: 'liquids',
      selectable: true,
    });
    expect(material).toBeDefined();
    if (!material) return;

    const lookups = createRenderLookups(ALL_MATERIALS);
    const offset = Material.Soap * 4;
    expect(SOAP_BODY_VFX_AUDIT.target).toMatchObject({ code: 'SOAP', material: 38 });
    expect(lookups.styleBytes[offset]).toBe(RenderPhase.Liquid);
    expect(lookups.styleBytes[offset + 1]).toBe(RenderProfile.Neutral);
    expect(lookups.styleBytes[offset + 2]).toBe(0);
    expect(lookups.styleBytes[offset + 3]).toBe(0);
    expect(lookups.paletteBytes[offset + 3]).toBe(RenderOptics.ViscousLiquid);
    expect(lookups.liquidByMaterial[Material.Soap]).toBe(1);
  });

  it('builds one broad exact-Soap body with named optics regions and depth bands', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    const { target } = SOAP_BODY_VFX_AUDIT;
    expectRectExcept(cells, target.body, Material.Soap, [
      target.authoredHole,
      target.openChannel,
      pointRect(target.reconstructablePinhole),
    ]);
    expectRect(cells, target.authoredHole, Material.Empty);
    expectRect(cells, target.openChannel, Material.Empty);
    expect(at(cells, target.reconstructablePinhole)).toBe(Material.Empty);
    expectCardinals(cells, target.reconstructablePinhole, Material.Soap);
    for (const region of [target.crown, target.pocket, target.core]) {
      expectRect(cells, region, Material.Soap);
    }

    const lookups = createRenderLookups(ALL_MATERIALS);
    const field = new LiquidDensityField(
      WORLD_WIDTH, WORLD_HEIGHT, lookups.liquidByMaterial, lookups.paletteBytes,
    );
    const depth = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT);
    field.writeVerticalOpticalDepth(cells, depth, simulation.walls());
    expect(depthRange(depth, target.depth.surfaceLayer)).toEqual({ min: 0, max: 0 });
    expect(depthRange(depth, target.depth.firstInnerLayer)).toEqual({ min: 6, max: 6 });
    expect(depthRange(depth, target.depth.shallowBand)).toEqual({ min: 12, max: 30 });
    expect(depthRange(depth, target.depth.transitionBand)).toEqual({ min: 36, max: 66 });
    expect(depthRange(depth, target.depth.midBand)).toEqual({ min: 72, max: 126 });
    expect(depthRange(depth, target.depth.deepBand)).toEqual({ min: 192, max: 255 });
    expect(depthAt(depth, { x: target.core.x + 24, y: target.core.y + 16 })).toBe(255);
    expect(depthAt(depth, target.reconstructablePinhole)).toBe(0);
    expect(depthRange(depth, target.wallCoexistence.region)).toEqual({ min: 0, max: 255 });
    expect(depthAt(depth, target.wallCoexistence.wallProbe)).toBe(0);
    expect(depthAt(depth, target.wallCoexistence.clearProbe)).toBe(255);
  });

  it('direct-fills sparse controls, broad sibling liquids, unlike seams, and contacts', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    const fixture = SOAP_BODY_VFX_AUDIT;
    expectRect(cells, fixture.sparse.thinStrand, Material.Soap);
    expectRect(cells, fixture.sparse.droplet, Material.Soap);
    expect(at(cells, fixture.sparse.isolated)).toBe(Material.Soap);
    expectSparseFilm(cells);
    for (const entry of Object.values(fixture.siblingLiquids)) {
      expectRect(cells, entry, entry.material);
    }
    for (const entry of [...Object.values(fixture.seams), ...Object.values(fixture.contacts)]) {
      expectBoundary(cells, entry);
    }
    expectRect(cells, fixture.guardedBlank, Material.Empty);

    expect(materialCount(cells, Material.Soap)).toBe(72_416
      + fixture.sparse.bubbleFilm.ringPoints.length
      + fixture.sparse.bubbleFilm.chainPoints.length);
    for (const material of [Material.Water, Material.Oil, Material.Acid, Material.GEL]) {
      expect(materialCount(cells, material)).toBe(4_352);
    }
    for (const material of [Material.Lava, Material.Diesel, Material.Nitro, Material.MWAX]) {
      expect(materialCount(cells, material)).toBe(3_072);
    }
    for (const material of [Material.Glass, Material.Metal, Material.Sand, Material.Smoke]) {
      expect(materialCount(cells, material)).toBe(1_280);
    }
  });

  it('authors exact native-wall coexistence without inventing SOAP state or velocity', () => {
    const simulation = preparedFixture();
    const fixture = SOAP_BODY_VFX_AUDIT;
    const cells = simulation.cells();
    const walls = simulation.walls();
    const state = simulation.presentationState();
    const velocity = simulation.velocity();
    expectWallPattern(cells, walls, fixture.target.wallCoexistence);
    expect(Array.from(walls).filter(Boolean)).toHaveLength(2_560);
    expect(wallAt(walls, fixture.target.wallCoexistence.wallProbe)).toBe(fixture.conductiveWall);
    expect(wallAt(walls, fixture.target.wallCoexistence.clearProbe)).toBe(0);

    expect(fixture.stateContract).toBe('state-agnostic');
    expect(Array.from(state).some(Boolean)).toBe(false);
    expect(Array.from(velocity).some(Boolean)).toBe(false);
  });

  it('keeps all independent controls disjoint and all nested probes inside the target', () => {
    const fixture = SOAP_BODY_VFX_AUDIT;
    const independent: SoapBodyVfxRect[] = [
      fixture.target.body,
      fixture.sparse.thinStrand,
      fixture.sparse.droplet,
      pointRect(fixture.sparse.isolated),
      fixture.sparse.bubbleFilm.region,
      ...Object.values(fixture.siblingLiquids),
      ...Object.values(fixture.seams).flatMap(({ soap, other }) => [soap, other]),
      ...Object.values(fixture.contacts).flatMap(({ soap, other }) => [soap, other]),
      fixture.guardedBlank,
    ];
    for (const rect of independent) expect(inside(rect, world)).toBe(true);
    expectPairwiseDisjoint(independent);

    const depthBands = Object.values(fixture.target.depth);
    const nested: SoapBodyVfxRect[] = [
      fixture.target.crown,
      fixture.target.pocket,
      fixture.target.core,
      ...depthBands,
      fixture.target.authoredHole,
      fixture.target.openChannel,
      pointRect(fixture.target.reconstructablePinhole),
      fixture.target.wallCoexistence.region,
    ];
    for (const rect of nested) expect(inside(rect, fixture.target.body)).toBe(true);
    expectPairwiseDisjoint(nested);
    expect(fixture.target.openChannel.y).toBe(fixture.target.body.y);
    const film = fixture.sparse.bubbleFilm;
    for (const point of [...film.ringPoints, ...film.chainPoints]) {
      expect(contains(film.region, point)).toBe(true);
    }
    expect(contains(film.region, film.ringCentre)).toBe(true);
    expect(contains(film.region, film.chainGap)).toBe(true);
  });

  it('resets matter, walls, velocity, and state deterministically and rejects unsupported backends', () => {
    const first = preparedFixture();
    const second = preparedFixture();
    expect(hash(first.cells())).toBe(hash(second.cells()));
    expect(hash(first.walls())).toBe(hash(second.walls()));
    expect(hash(first.velocity())).toBe(hash(second.velocity()));
    expect(hash(first.presentationState())).toBe(hash(second.presentationState()));

    const expectedCells = first.cells().slice();
    const expectedWalls = first.walls().slice();
    const expectedVelocity = first.velocity().slice();
    const expectedState = first.presentationState().slice();
    first.cells().fill(Material.Fire);
    first.paintWall(4, 4, 2, 0);
    first.setFixtureVelocityRect(8, 8, 16, 16, 47, -31);
    first.setFixturePresentationStateRect(8, 8, 16, 16, 0xBEEF);
    prepareSoapBodyVfxAuditFixture(first);
    expect(firstDifference(first.cells(), expectedCells)).toBe(-1);
    expect(firstDifference(first.walls(), expectedWalls)).toBe(-1);
    expect(firstDifference(first.velocity(), expectedVelocity)).toBe(-1);
    expect(firstDifference(first.presentationState(), expectedState)).toBe(-1);

    expect(() => prepareSoapBodyVfxAuditFixture(new RenderLabBackend(32, 32)))
      .toThrow('requires 612x384');
    expect(() => prepareSoapBodyVfxAuditFixture(
      new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT),
    )).toThrow('requires a RenderLab native wall plane');
  });
});

function preparedFixture(): RenderLabBackend {
  const simulation = new RenderLabBackend(WORLD_WIDTH, WORLD_HEIGHT);
  prepareSoapBodyVfxAuditFixture(simulation);
  return simulation;
}

function indexOf(point: SoapBodyVfxPoint): number {
  return point.y * WORLD_WIDTH + point.x;
}

function at(cells: Uint8Array, point: SoapBodyVfxPoint): Material {
  return cells[indexOf(point)] as Material;
}

function wallAt(walls: Uint8Array, point: SoapBodyVfxPoint): number {
  return walls[indexOf(point)];
}

function depthAt(depth: Uint8Array, point: SoapBodyVfxPoint): number {
  return depth[indexOf(point)];
}

function depthRange(depth: Uint8Array, rect: SoapBodyVfxRect): { min: number; max: number } {
  let min = 255;
  let max = 0;
  each(rect, (point) => {
    const value = depthAt(depth, point);
    min = Math.min(min, value);
    max = Math.max(max, value);
  });
  return { min, max };
}

function expectSparseFilm(cells: Uint8Array): void {
  const film = SOAP_BODY_VFX_AUDIT.sparse.bubbleFilm;
  expect(film.ringPoints).toHaveLength(100);
  expect(film.chainPoints).toHaveLength(56);
  const points = [...film.ringPoints, ...film.chainPoints];
  const keys = new Set(points.map(({ x, y }) => `${x},${y}`));
  expect(keys.size).toBe(points.length);
  expect(topologyComponentCount(keys)).toBe(3);
  expect(keys.has(`${film.ringCentre.x},${film.ringCentre.y}`)).toBe(false);
  expect(keys.has(`${film.chainGap.x},${film.chainGap.y}`)).toBe(false);
  expect(at(cells, film.ringCentre)).toBe(Material.Empty);
  expect(at(cells, film.chainGap)).toBe(Material.Empty);

  let mismatch: SoapBodyVfxPoint | undefined;
  each(film.region, (point) => {
    const expected = keys.has(`${point.x},${point.y}`) ? Material.Soap : Material.Empty;
    if (!mismatch && at(cells, point) !== expected) mismatch = point;
  });
  expect(mismatch).toBeUndefined();
}

function topologyComponentCount(points: ReadonlySet<string>): number {
  const seen = new Set<string>();
  let components = 0;
  for (const key of points) {
    if (seen.has(key)) continue;
    components++;
    seen.add(key);
    const pending = [key];
    while (pending.length > 0) {
      const current = pending.pop();
      if (!current) continue;
      const [x, y] = current.split(',').map(Number);
      for (let offsetY = -1; offsetY <= 1; offsetY++) {
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
          if (offsetX === 0 && offsetY === 0) continue;
          const neighbour = `${x + offsetX},${y + offsetY}`;
          if (!points.has(neighbour) || seen.has(neighbour)) continue;
          seen.add(neighbour);
          pending.push(neighbour);
        }
      }
    }
  }
  return components;
}

function expectBoundary(cells: Uint8Array, entry: SoapBodyVfxBoundary): void {
  expectRect(cells, entry.soap, Material.Soap);
  expectRect(cells, entry.other, entry.otherMaterial);
  expect(entry.soap.x + entry.soap.width).toBe(entry.other.x);
  expect(at(cells, entry.soapProbe)).toBe(Material.Soap);
  expect(at(cells, entry.otherProbe)).toBe(entry.otherMaterial);
  expect(entry.soapProbe.x + 1).toBe(entry.otherProbe.x);
}

function expectRect(cells: Uint8Array, rect: SoapBodyVfxRect, material: Material): void {
  let mismatch: SoapBodyVfxPoint | undefined;
  each(rect, (point) => {
    if (!mismatch && at(cells, point) !== material) mismatch = point;
  });
  expect(mismatch).toBeUndefined();
}

function expectRectExcept(
  cells: Uint8Array,
  rect: SoapBodyVfxRect,
  material: Material,
  exceptions: readonly SoapBodyVfxRect[],
): void {
  let mismatch: SoapBodyVfxPoint | undefined;
  each(rect, (point) => {
    if (exceptions.some((entry) => contains(entry, point))) return;
    if (!mismatch && at(cells, point) !== material) mismatch = point;
  });
  expect(mismatch).toBeUndefined();
}

function expectCardinals(cells: Uint8Array, point: SoapBodyVfxPoint, material: Material): void {
  for (const [x, y] of [[point.x - 1, point.y], [point.x + 1, point.y],
    [point.x, point.y - 1], [point.x, point.y + 1]]) {
    expect(cells[y * WORLD_WIDTH + x]).toBe(material);
  }
}

function expectWallPattern(
  cells: Uint8Array,
  walls: Uint8Array,
  pattern: SoapBodyVfxWallPattern,
): void {
  expect(pattern.region.x % pattern.blockSize).toBe(0);
  expect(pattern.region.y % pattern.blockSize).toBe(0);
  expect(pattern.region.width % pattern.blockSize).toBe(0);
  expect(pattern.region.height % pattern.blockSize).toBe(0);
  let materialMismatch: SoapBodyVfxPoint | undefined;
  let wallMismatch: SoapBodyVfxPoint | undefined;
  each(pattern.region, (point) => {
    if (!materialMismatch && at(cells, point) !== Material.Soap) materialMismatch = point;
    const blockX = Math.floor((point.x - pattern.region.x) / pattern.blockSize);
    const blockY = Math.floor((point.y - pattern.region.y) / pattern.blockSize);
    const expected = (blockX + blockY) % 2 === pattern.occupiedParity
      ? SOAP_BODY_VFX_AUDIT.conductiveWall : 0;
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

function expectPairwiseDisjoint(rects: readonly SoapBodyVfxRect[]): void {
  for (let index = 0; index < rects.length; index++) {
    for (let other = index + 1; other < rects.length; other++) {
      expect(intersects(rects[index], rects[other])).toBe(false);
    }
  }
}

function inside(inner: SoapBodyVfxRect, outer: SoapBodyVfxRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function intersects(left: SoapBodyVfxRect, right: SoapBodyVfxRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

function contains(rect: SoapBodyVfxRect, point: SoapBodyVfxPoint): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function pointRect(point: SoapBodyVfxPoint): SoapBodyVfxRect {
  return { ...point, width: 1, height: 1 };
}

function each(rect: SoapBodyVfxRect, action: (point: SoapBodyVfxPoint) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) action({ x, y });
  }
}

function hash(values: ArrayLike<number>): number {
  let value = 2166136261;
  for (let index = 0; index < values.length; index++) {
    value = Math.imul(value ^ values[index], 16777619) >>> 0;
  }
  return value;
}

function firstDifference(left: ArrayLike<number>, right: ArrayLike<number>): number {
  if (left.length !== right.length) return Math.min(left.length, right.length);
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return index;
  }
  return -1;
}
