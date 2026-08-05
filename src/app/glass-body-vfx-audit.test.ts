import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { createRenderLookups } from '../renderer/render-field-set';
import { writeSolidOpticalDepth } from '../renderer/solid-optical-depth-field';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  GLASS_BODY_VFX_AUDIT, prepareGlassBodyVfxFixture,
  type GlassBodyVfxPoint, type GlassBodyVfxRect, type GlassBodyVfxWallPattern,
} from './glass-body-vfx-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const world: GlassBodyVfxRect = { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT };

describe('glass body VFX audit fixture', () => {
  it('pins paired broad exact-Glass panes and stable surface-to-core sampling bands', () => {
    expect(GLASS_BODY_VFX_AUDIT.panes.map(({ code, material, backing }) => (
      [code, material, backing.kind]
    ))).toEqual([
      ['AIR_BACKED', Material.Glass, 'air'],
      ['WALL_BACKED', Material.Glass, 'native-wall-checker'],
    ]);

    for (const pane of GLASS_BODY_VFX_AUDIT.panes) {
      for (const rect of [pane.body, pane.surfaceLayer, pane.firstInnerLayer,
        pane.shallowBand, pane.transitionBand, pane.deepCore, pane.authoredHole,
        pane.openNotch]) expect(rectInside(rect, world)).toBe(true);
      expect(pointInside(pane.reconstructableCavity, world)).toBe(true);
      expect(pane.body.width).toBeGreaterThanOrEqual(240);
      expect(pane.surfaceLayer.x - pane.body.x).toBe(0);
      expect(pane.firstInnerLayer.x - pane.body.x).toBe(1);
      expect(pane.shallowBand.x - pane.body.x).toBe(2);
      expect(pane.shallowBand.x + pane.shallowBand.width - pane.body.x).toBe(6);
      expect(pane.transitionBand.x - pane.body.x).toBe(6);
      expect(pane.transitionBand.x + pane.transitionBand.width - pane.body.x).toBe(12);
      expect(pane.deepCore.x - pane.body.x).toBeGreaterThan(12);
      expect(intersects(pane.deepCore, pane.authoredHole)).toBe(false);
      expect(intersects(pane.deepCore, pane.openNotch)).toBe(false);
    }
  });

  it('direct-fills exact topology, disjoint contacts, requested controls, and checker walls', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    const walls = simulation.walls();

    for (const pane of GLASS_BODY_VFX_AUDIT.panes) {
      expectRectExcept(cells, pane.body, Material.Glass, [
        pane.authoredHole, pane.openNotch, { ...pane.reconstructableCavity, width: 1, height: 1 },
      ]);
      expectRect(cells, pane.surfaceLayer, Material.Glass);
      expectRect(cells, pane.firstInnerLayer, Material.Glass);
      expectRect(cells, pane.shallowBand, Material.Glass);
      expectRect(cells, pane.transitionBand, Material.Glass);
      expectRect(cells, pane.deepCore, Material.Glass);
      expectRect(cells, pane.authoredHole, Material.Empty);
      expectRect(cells, pane.openNotch, Material.Empty);
      expect(materialAt(cells, pane.reconstructableCavity)).toBe(Material.Empty);
      expectFourCardinals(cells, pane.reconstructableCavity, Material.Glass);
      if (pane.backing.kind === 'air') {
        forEachPoint(pane.body, (point) => expect(wallAt(walls, point)).toBe(0));
      } else {
        expectWallPattern(cells, walls, pane.backing);
      }
    }

    expectRect(cells, GLASS_BODY_VFX_AUDIT.thinLine, Material.Glass);
    expect(materialAt(cells, GLASS_BODY_VFX_AUDIT.isolated)).toBe(Material.Glass);
    for (const entry of Object.values(GLASS_BODY_VFX_AUDIT.contacts)) {
      expectRect(cells, entry.glass, Material.Glass);
      expectRect(cells, entry.other, entry.otherMaterial);
      expect(entry.glass.x + entry.glass.width).toBe(entry.other.x);
      expect(materialAt(cells, entry.glassProbe)).toBe(Material.Glass);
      expect(materialAt(cells, entry.otherProbe)).toBe(entry.otherMaterial);
    }

    const { controls } = GLASS_BODY_VFX_AUDIT;
    expectRect(cells, controls.ice, Material.Ice);
    expectRect(cells, controls.qrtz, Material.QRTZ);
    expectRect(cells, controls.metal, Material.Metal);
    expectRect(cells, controls.emitterTrait, Material.CLNE);
    expectRect(cells, controls.emissiveLava, Material.Lava);
    expectRect(cells, controls.sand, Material.Sand);
    expectRect(cells, controls.water, Material.Water);
    expectRect(cells, controls.guardedBlank, Material.Empty);
  });

  it('pins exact solid-depth surface, first, shallow, transition, and deep ranges', () => {
    const simulation = preparedFixture();
    const depth = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT);
    writeSolidOpticalDepth(
      simulation.cells(), depth, createRenderLookups(ALL_MATERIALS).styleBytes,
      WORLD_WIDTH, simulation.walls(),
    );

    for (const pane of GLASS_BODY_VFX_AUDIT.panes) {
      const sampleY = pane.shallowBand.y + Math.floor(pane.shallowBand.height / 2);
      expect(depthAt(depth, { x: pane.surfaceLayer.x, y: sampleY })).toBe(0);
      expect(depthAt(depth, { x: pane.firstInnerLayer.x, y: sampleY })).toBe(6);
      expect(Array.from({ length: pane.shallowBand.width }, (_, offset) => (
        depthAt(depth, { x: pane.shallowBand.x + offset, y: sampleY })
      ))).toEqual([12, 18, 24, 30]);
      expect(Array.from({ length: pane.transitionBand.width }, (_, offset) => (
        depthAt(depth, { x: pane.transitionBand.x + offset, y: sampleY })
      ))).toEqual([36, 42, 48, 54, 60, 66]);
      const deepValues = Array.from({ length: pane.deepCore.height }, (_, y) => (
        Array.from({ length: pane.deepCore.width }, (_unused, x) => depthAt(depth, {
          x: pane.deepCore.x + x, y: pane.deepCore.y + y,
        }))
      )).flat();
      expect(Math.min(...deepValues)).toBe(192);
      expect(Math.max(...deepValues)).toBe(255);
      expect(depthAt(depth, pane.reconstructableCavity)).toBe(0);
    }
    expect(depthAt(depth, GLASS_BODY_VFX_AUDIT.isolated)).toBe(0);
    expect(depthAt(depth, {
      x: GLASS_BODY_VFX_AUDIT.thinLine.x,
      y: GLASS_BODY_VFX_AUDIT.thinLine.y + 8,
    })).toBe(0);
  });

  it('keeps all independent geometry disjoint and inside the 612x384 world', () => {
    const independent: GlassBodyVfxRect[] = [
      ...GLASS_BODY_VFX_AUDIT.panes.map(({ body }) => body),
      GLASS_BODY_VFX_AUDIT.thinLine,
      ...Object.values(GLASS_BODY_VFX_AUDIT.contacts).flatMap(({ glass, other }) => [glass, other]),
      ...Object.values(GLASS_BODY_VFX_AUDIT.controls),
    ];
    for (const rect of independent) expect(rectInside(rect, world)).toBe(true);
    expect(pointInside(GLASS_BODY_VFX_AUDIT.isolated, world)).toBe(true);
    for (let index = 0; index < independent.length; index++) {
      for (let other = index + 1; other < independent.length; other++) {
        expect(intersects(independent[index], independent[other])).toBe(false);
      }
    }
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
    prepareGlassBodyVfxFixture(first);
    expect(first.cells()).toEqual(expectedCells);
    expect(first.walls()).toEqual(expectedWalls);

    expect(() => prepareGlassBodyVfxFixture(new RenderLabBackend(32, 32))).toThrow('requires 612x384');
    expect(() => prepareGlassBodyVfxFixture(new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT)))
      .toThrow('requires a RenderLab native wall plane');
  });
});

function preparedFixture(): RenderLabBackend {
  const simulation = new RenderLabBackend(WORLD_WIDTH, WORLD_HEIGHT);
  prepareGlassBodyVfxFixture(simulation);
  return simulation;
}

function materialAt(cells: Uint8Array, point: GlassBodyVfxPoint): Material {
  return cells[point.y * WORLD_WIDTH + point.x] as Material;
}

function wallAt(walls: Uint8Array, point: GlassBodyVfxPoint): number {
  return walls[point.y * WORLD_WIDTH + point.x];
}

function depthAt(depth: Uint8Array, point: GlassBodyVfxPoint): number {
  return depth[point.y * WORLD_WIDTH + point.x];
}

function expectRect(cells: Uint8Array, rect: GlassBodyVfxRect, material: Material): void {
  forEachPoint(rect, (point) => expect(materialAt(cells, point)).toBe(material));
}

function expectRectExcept(
  cells: Uint8Array,
  rect: GlassBodyVfxRect,
  material: Material,
  exceptions: readonly GlassBodyVfxRect[],
): void {
  forEachPoint(rect, (point) => {
    if (exceptions.some((exception) => contains(exception, point))) return;
    expect(materialAt(cells, point)).toBe(material);
  });
}

function expectFourCardinals(cells: Uint8Array, point: GlassBodyVfxPoint, material: Material): void {
  for (const [x, y] of [[point.x - 1, point.y], [point.x + 1, point.y],
    [point.x, point.y - 1], [point.x, point.y + 1]]) {
    expect(cells[y * WORLD_WIDTH + x]).toBe(material);
  }
}

function expectWallPattern(
  cells: Uint8Array,
  walls: Uint8Array,
  pattern: GlassBodyVfxWallPattern,
): void {
  expect(pattern.region.x % pattern.blockSize).toBe(0);
  expect(pattern.region.y % pattern.blockSize).toBe(0);
  expect(pattern.region.width % pattern.blockSize).toBe(0);
  expect(pattern.region.height % pattern.blockSize).toBe(0);
  forEachPoint(pattern.region, (point) => {
    expect(materialAt(cells, point)).toBe(Material.Glass);
    const blockX = Math.floor((point.x - pattern.region.x) / pattern.blockSize);
    const blockY = Math.floor((point.y - pattern.region.y) / pattern.blockSize);
    const expectedWall = (blockX + blockY) % 2 === pattern.occupiedParity
      ? GLASS_BODY_VFX_AUDIT.conductiveWall : 0;
    expect(wallAt(walls, point)).toBe(expectedWall);
  });
  expect(wallAt(walls, pattern.wallProbe)).toBe(GLASS_BODY_VFX_AUDIT.conductiveWall);
  expect(wallAt(walls, pattern.clearProbe)).toBe(0);
}

function rectInside(inner: GlassBodyVfxRect, outer: GlassBodyVfxRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function pointInside(point: GlassBodyVfxPoint, outer: GlassBodyVfxRect): boolean {
  return point.x >= outer.x && point.y >= outer.y
    && point.x < outer.x + outer.width && point.y < outer.y + outer.height;
}

function intersects(left: GlassBodyVfxRect, right: GlassBodyVfxRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

function contains(rect: GlassBodyVfxRect, point: GlassBodyVfxPoint): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function forEachPoint(rect: GlassBodyVfxRect, visit: (point: GlassBodyVfxPoint) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}

function byteHash(values: Uint8Array): number {
  let hash = 2166136261;
  for (const value of values) hash = Math.imul(hash ^ value, 16777619) >>> 0;
  return hash;
}
