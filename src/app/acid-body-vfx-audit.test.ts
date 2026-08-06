import { describe, expect, it } from 'vitest';
import { LiquidDensityField } from '../renderer/liquid-density-field';
import { createRenderLookups } from '../renderer/render-field-set';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  ACID_BODY_VFX_AUDIT,
  prepareAcidBodyVfxFixture,
  type AcidBodyVfxBoundary,
  type AcidBodyVfxPoint,
  type AcidBodyVfxRect,
  type AcidBodyVfxWallPattern,
} from './acid-body-vfx-audit';

const WIDTH = 612;
const HEIGHT = 384;

describe('Acid body VFX audit fixture', () => {
  it('pins exact native Acid 13 rather than SaltWater 16 and all optical-depth bands', () => {
    expect(Material.Acid).toBe(13);
    expect(Material.SaltWater).toBe(16);
    expect(ACID_BODY_VFX_AUDIT.panes.map(({ code, material, backing }) => [code, material, backing.kind]))
      .toEqual([['OPEN_POOL', Material.Acid, 'air'], ['WALL_CONTROL', Material.Acid, 'native-wall-checker']]);
    const simulation = prepared();
    const lookups = createRenderLookups(ALL_MATERIALS);
    const field = new LiquidDensityField(WIDTH, HEIGHT, lookups.liquidByMaterial, lookups.colorByMaterial);
    const depth = new Uint8Array(WIDTH * HEIGHT);
    field.writeVerticalOpticalDepth(simulation.cells(), depth, simulation.walls());
    for (const pane of ACID_BODY_VFX_AUDIT.panes) {
      expect(range(depth, pane.surfaceLayer)).toEqual([0, 0]);
      expect(range(depth, pane.firstInnerLayer)).toEqual([6, 6]);
      expect(range(depth, pane.shallowBand)).toEqual([12, 30]);
      expect(range(depth, pane.transitionBand)).toEqual([36, 66]);
      expect(range(depth, pane.midBand)).toEqual([72, 126]);
      expect(range(depth, pane.deepCore)).toEqual([192, 255]);
      expect(at(simulation.cells(), pane.reconstructablePinhole)).toBe(Material.Empty);
    }
  });

  it('keeps Acid topology and every protected material, seam, and contact semantic', () => {
    const simulation = prepared();
    const cells = simulation.cells();
    for (const pane of ACID_BODY_VFX_AUDIT.panes) {
      expectRectExcept(cells, pane.body, Material.Acid, [pane.authoredHole, pane.openChimney,
        { ...pane.reconstructablePinhole, width: 1, height: 1 }]);
      expectRect(cells, pane.authoredHole, Material.Empty);
      expectRect(cells, pane.openChimney, Material.Empty);
      expect(at(cells, pane.reconstructablePinhole)).toBe(Material.Empty);
      expectCardinals(cells, pane.reconstructablePinhole, Material.Acid);
    }
    const fixture = ACID_BODY_VFX_AUDIT;
    expectRect(cells, fixture.sparse.thinStrand, Material.Acid);
    expectRect(cells, fixture.sparse.droplet, Material.Acid);
    expect(at(cells, fixture.sparse.isolated)).toBe(Material.Acid);
    for (const entry of Object.values(fixture.materialControls)) expectRect(cells, entry, entry.material);
    for (const entry of [...Object.values(fixture.seams), ...Object.values(fixture.contacts)]) {
      expectBoundary(cells, entry);
    }
    expectRect(cells, fixture.guardedBlank, Material.Empty);
  });

  it('preserves an aligned 3,072-cell native wall checker co-located with Acid', () => {
    const simulation = prepared();
    const pane = ACID_BODY_VFX_AUDIT.panes[1];
    expect(pane.backing.kind).toBe('native-wall-checker');
    if (pane.backing.kind !== 'native-wall-checker') return;
    expectWallPattern(simulation.cells(), simulation.walls(), pane.backing);
    expect(Array.from(simulation.walls()).filter(Boolean)).toHaveLength(3_072);
    expect(wallAt(simulation.walls(), pane.backing.wallProbe)).toBe(ACID_BODY_VFX_AUDIT.conductiveWall);
    expect(wallAt(simulation.walls(), pane.backing.clearProbe)).toBe(0);
  });

  it('keeps independent fixture regions in bounds and depth probes out of topology controls', () => {
    const fixture = ACID_BODY_VFX_AUDIT;
    const world: AcidBodyVfxRect = { x: 0, y: 0, width: WIDTH, height: HEIGHT };
    const independent: AcidBodyVfxRect[] = [
      ...fixture.panes.map(({ body }) => body), fixture.sparse.thinStrand, fixture.sparse.droplet,
      { ...fixture.sparse.isolated, width: 1, height: 1 }, ...Object.values(fixture.materialControls),
      ...Object.values(fixture.seams).flatMap(({ acid, other }) => [acid, other]),
      ...Object.values(fixture.contacts).flatMap(({ acid, other }) => [acid, other]), fixture.guardedBlank,
    ];
    for (const rect of independent) expect(inside(rect, world)).toBe(true);
    for (let index = 0; index < independent.length; index++) {
      for (let other = index + 1; other < independent.length; other++) {
        expect(intersects(independent[index], independent[other])).toBe(false);
      }
    }
    for (const pane of fixture.panes) {
      const bands = [pane.surfaceLayer, pane.firstInnerLayer, pane.shallowBand,
        pane.transitionBand, pane.midBand, pane.deepCore];
      for (const rect of [...bands, pane.authoredHole, pane.openChimney]) {
        expect(inside(rect, pane.body)).toBe(true);
      }
      expect(contains(pane.body, pane.reconstructablePinhole)).toBe(true);
      for (const band of bands) {
        expect(intersects(band, pane.authoredHole)).toBe(false);
        expect(intersects(band, pane.openChimney)).toBe(false);
        expect(contains(band, pane.reconstructablePinhole)).toBe(false);
      }
      if (pane.backing.kind === 'native-wall-checker') {
        expect(inside(pane.backing.region, pane.body)).toBe(true);
        for (const band of bands) expect(intersects(band, pane.backing.region)).toBe(false);
      }
    }
  });

  it('is deterministic and rejects unsupported or wrong-sized backends', () => {
    const first = prepared();
    const second = prepared();
    expect(hash(first.cells())).toBe(hash(second.cells()));
    expect(hash(first.walls())).toBe(hash(second.walls()));
    const cells = first.cells().slice();
    const walls = first.walls().slice();
    first.cells().fill(Material.Fire);
    first.paintWall(4, 4, 2, 0);
    prepareAcidBodyVfxFixture(first);
    expect(firstDifference(first.cells(), cells)).toBe(-1);
    expect(firstDifference(first.walls(), walls)).toBe(-1);
    expect(() => prepareAcidBodyVfxFixture(new RenderLabBackend(32, 32))).toThrow('requires 612x384');
    expect(() => prepareAcidBodyVfxFixture(new DeterministicBackend(WIDTH, HEIGHT)))
      .toThrow('requires a RenderLab native wall plane');
  });
});

function prepared(): RenderLabBackend {
  const simulation = new RenderLabBackend(WIDTH, HEIGHT);
  prepareAcidBodyVfxFixture(simulation);
  return simulation;
}
function at(cells: Uint8Array, point: AcidBodyVfxPoint): Material { return cells[point.y * WIDTH + point.x] as Material; }
function wallAt(walls: Uint8Array, point: AcidBodyVfxPoint): number { return walls[point.y * WIDTH + point.x]; }
function range(depth: Uint8Array, rect: AcidBodyVfxRect): [number, number] {
  let min = 255; let max = 0;
  each(rect, ({ x, y }) => { const value = depth[y * WIDTH + x]; min = Math.min(min, value); max = Math.max(max, value); });
  return [min, max];
}
function expectRect(cells: Uint8Array, rect: AcidBodyVfxRect, material: Material): void {
  each(rect, (point) => expect(at(cells, point)).toBe(material));
}
function expectRectExcept(cells: Uint8Array, rect: AcidBodyVfxRect, material: Material, exceptions: readonly AcidBodyVfxRect[]): void {
  each(rect, (point) => { if (!exceptions.some((entry) => contains(entry, point))) expect(at(cells, point)).toBe(material); });
}
function expectCardinals(cells: Uint8Array, point: AcidBodyVfxPoint, material: Material): void {
  for (const [x, y] of [[point.x - 1, point.y], [point.x + 1, point.y], [point.x, point.y - 1], [point.x, point.y + 1]]) expect(cells[y * WIDTH + x]).toBe(material);
}
function expectBoundary(cells: Uint8Array, entry: AcidBodyVfxBoundary): void {
  expectRect(cells, entry.acid, Material.Acid); expectRect(cells, entry.other, entry.otherMaterial);
  expect(entry.acid.x + entry.acid.width).toBe(entry.other.x);
  expect(at(cells, entry.acidProbe)).toBe(Material.Acid); expect(at(cells, entry.otherProbe)).toBe(entry.otherMaterial);
}
function expectWallPattern(cells: Uint8Array, walls: Uint8Array, pattern: AcidBodyVfxWallPattern): void {
  each(pattern.region, ({ x, y }) => {
    const blockX = Math.floor((x - pattern.region.x) / pattern.blockSize);
    const blockY = Math.floor((y - pattern.region.y) / pattern.blockSize);
    expect(at(cells, { x, y })).toBe(Material.Acid);
    expect(walls[y * WIDTH + x]).toBe((blockX + blockY) % 2 === pattern.occupiedParity ? ACID_BODY_VFX_AUDIT.conductiveWall : 0);
  });
}
function each(rect: AcidBodyVfxRect, action: (point: AcidBodyVfxPoint) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) for (let x = rect.x; x < rect.x + rect.width; x++) action({ x, y });
}
function contains(rect: AcidBodyVfxRect, point: AcidBodyVfxPoint): boolean { return point.x >= rect.x && point.x < rect.x + rect.width && point.y >= rect.y && point.y < rect.y + rect.height; }
function inside(rect: AcidBodyVfxRect, container: AcidBodyVfxRect): boolean {
  return rect.x >= container.x && rect.y >= container.y
    && rect.x + rect.width <= container.x + container.width
    && rect.y + rect.height <= container.y + container.height;
}
function intersects(left: AcidBodyVfxRect, right: AcidBodyVfxRect): boolean {
  return left.x < right.x + right.width && left.x + left.width > right.x
    && left.y < right.y + right.height && left.y + left.height > right.y;
}
function hash(bytes: Uint8Array): number { let value = 2166136261; for (const byte of bytes) value = Math.imul(value ^ byte, 16777619) >>> 0; return value; }
function firstDifference(left: Uint8Array, right: Uint8Array): number { for (let index = 0; index < left.length; index++) if (left[index] !== right[index]) return index; return -1; }
