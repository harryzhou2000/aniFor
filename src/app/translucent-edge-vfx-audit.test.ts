import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { createRenderLookups } from '../renderer/render-field-set';
import { writeSolidOpticalDepth } from '../renderer/solid-optical-depth-field';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  TRANSLUCENT_EDGE_VFX_AUDIT, prepareTranslucentEdgeVfxAudit,
  type TranslucentEdgeVfxPoint, type TranslucentEdgeVfxRect,
} from './translucent-edge-vfx-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const world: TranslucentEdgeVfxRect = { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT };

describe('translucent edge VFX audit fixture', () => {
  it('pins broad exact Glass/Ice panes with separated local/deep sampling regions', () => {
    expect(TRANSLUCENT_EDGE_VFX_AUDIT.panes.map(({ code, material }) => [code, material])).toEqual([
      ['GLAS_A', Material.Glass], ['ICE_A', Material.Ice],
      ['GLAS_B', Material.Glass], ['ICE_B', Material.Ice],
    ]);
    for (const pane of TRANSLUCENT_EDGE_VFX_AUDIT.panes) {
      for (const rect of [pane.body, pane.authoredHole, pane.openNotch, pane.attachedLine,
        pane.firstInnerLayer, pane.edgeBand, pane.depthBand, pane.deepCore]) {
        expect(rectInside(rect, world)).toBe(true);
      }
      expect(pointInside(pane.isolated, world)).toBe(true);
      expect(pointInside(pane.reconstructableCavity, world)).toBe(true);
      expect(pane.body.width).toBeGreaterThanOrEqual(140);
      expect(pane.firstInnerLayer.x - pane.body.x).toBe(1);
      expect(pane.edgeBand.x - pane.body.x).toBe(2);
      expect(pane.edgeBand.x + pane.edgeBand.width - pane.body.x).toBe(6);
      expect(pane.depthBand.x - pane.body.x).toBe(6);
      expect(pane.depthBand.x + pane.depthBand.width - pane.body.x).toBe(11);
      expect(pane.deepCore.x - pane.body.x).toBeGreaterThanOrEqual(96);
      expect(pane.attachedLine.y).toBe(pane.body.y + pane.body.height);
    }
  });

  it('direct-fills exact panes, protected topology, semantic controls, and native walls', () => {
    const simulation = new RenderLabBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareTranslucentEdgeVfxAudit(simulation);
    const cells = simulation.cells();
    const walls = simulation.walls();

    for (const pane of TRANSLUCENT_EDGE_VFX_AUDIT.panes) {
      expectRectExcept(cells, pane.body, pane.material, [
        pane.authoredHole, pane.openNotch, { ...pane.reconstructableCavity, width: 1, height: 1 },
      ]);
      expectRect(cells, pane.edgeBand, pane.material);
      expectRect(cells, pane.depthBand, pane.material);
      expectRect(cells, pane.firstInnerLayer, pane.material);
      expectRect(cells, pane.deepCore, pane.material);
      expectRect(cells, pane.authoredHole, Material.Empty);
      expectRect(cells, pane.openNotch, Material.Empty);
      expectRect(cells, pane.attachedLine, pane.material);
      expect(materialAt(cells, pane.isolated)).toBe(pane.material);
      expect(materialAt(cells, pane.reconstructableCavity)).toBe(Material.Empty);
      expectFourCardinals(cells, pane.reconstructableCavity, pane.material);
    }

    const { unlikeSeam, controls, conductiveWall } = TRANSLUCENT_EDGE_VFX_AUDIT;
    expectRect(cells, unlikeSeam.glass, Material.Glass);
    expectRect(cells, unlikeSeam.ice, Material.Ice);
    expect(materialAt(cells, unlikeSeam.probe)).toBe(Material.Ice);
    expectRect(cells, controls.opaqueMetal, Material.Metal);
    expectRect(cells, controls.emitterTrait, Material.CLNE);
    expectRect(cells, controls.emissiveFire, Material.Fire);
    expectRect(cells, controls.guardedBlank, Material.Empty);
    expectWallControl(cells, walls, controls.glassWall.body, controls.glassWall.probe, Material.Glass, conductiveWall);
    expectWallControl(cells, walls, controls.iceWall.body, controls.iceWall.probe, Material.Ice, conductiveWall);
  });

  it('pins the exact phase-local depth bytes used by the E10 target and control bands', () => {
    const simulation = new RenderLabBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareTranslucentEdgeVfxAudit(simulation);
    const depth = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT);
    writeSolidOpticalDepth(
      simulation.cells(), depth, createRenderLookups(ALL_MATERIALS).styleBytes,
      WORLD_WIDTH, simulation.walls(),
    );

    for (const pane of TRANSLUCENT_EDGE_VFX_AUDIT.panes) {
      const sampleRow = pane.edgeBand.y + Math.floor(pane.edgeBand.height / 2);
      expect(depth[sampleRow * WORLD_WIDTH + pane.firstInnerLayer.x]).toBe(6);
      expect(Array.from({ length: pane.edgeBand.width }, (_, offset) => (
        depth[sampleRow * WORLD_WIDTH + pane.edgeBand.x + offset]
      ))).toEqual([12, 18, 24, 30]);
      expect(Array.from({ length: pane.depthBand.width }, (_, offset) => (
        depth[sampleRow * WORLD_WIDTH + pane.depthBand.x + offset]
      ))).toEqual([36, 42, 48, 54, 60]);
      const core = pane.deepCore.y * WORLD_WIDTH + pane.deepCore.x;
      expect(depth[core]).toBeGreaterThan(66);
      expect(depth[pane.attachedLine.y * WORLD_WIDTH + pane.attachedLine.x]).toBe(0);
      expect(depth[pane.isolated.y * WORLD_WIDTH + pane.isolated.x]).toBe(0);
      expect(depth[pane.reconstructableCavity.y * WORLD_WIDTH + pane.reconstructableCavity.x]).toBe(0);
    }
    const fixture = TRANSLUCENT_EDGE_VFX_AUDIT;
    expect(depth[fixture.unlikeSeam.probe.y * WORLD_WIDTH + fixture.unlikeSeam.probe.x]).toBe(0);
    for (const control of [fixture.controls.glassWall, fixture.controls.iceWall]) {
      expect(depth[control.probe.y * WORLD_WIDTH + control.probe.x]).toBe(0);
    }
  });

  it('is deterministic, clears stale walls, stays in bounds, and rejects unsupported backends', () => {
    const first = new RenderLabBackend(WORLD_WIDTH, WORLD_HEIGHT);
    const second = new RenderLabBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareTranslucentEdgeVfxAudit(first);
    prepareTranslucentEdgeVfxAudit(second);
    expect(byteHash(first.cells())).toBe(byteHash(second.cells()));
    expect(byteHash(first.walls())).toBe(byteHash(second.walls()));

    const expectedCells = first.cells().slice();
    const expectedWalls = first.walls().slice();
    first.cells().fill(Material.Fire);
    first.paintWall(4, 4, 1, 0);
    prepareTranslucentEdgeVfxAudit(first);
    expect(byteHash(first.cells())).toBe(byteHash(expectedCells));
    expect(byteHash(first.walls())).toBe(byteHash(expectedWalls));

    const fixture = TRANSLUCENT_EDGE_VFX_AUDIT;
    for (const pane of fixture.panes) {
      for (const rect of [pane.body, pane.authoredHole, pane.openNotch, pane.attachedLine,
        pane.firstInnerLayer, pane.edgeBand, pane.depthBand, pane.deepCore]) {
        expect(rectInside(rect, world)).toBe(true);
      }
    }
    for (const rect of [fixture.unlikeSeam.glass, fixture.unlikeSeam.ice, fixture.controls.opaqueMetal,
      fixture.controls.emitterTrait, fixture.controls.emissiveFire, fixture.controls.glassWall.body,
      fixture.controls.iceWall.body, fixture.controls.guardedBlank]) expect(rectInside(rect, world)).toBe(true);
    expect(() => prepareTranslucentEdgeVfxAudit(new RenderLabBackend(32, 32))).toThrow('requires 612x384');
    expect(() => prepareTranslucentEdgeVfxAudit(new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT)))
      .toThrow('requires the render-lab native wall plane');
  });
});

function materialAt(cells: Uint8Array, point: TranslucentEdgeVfxPoint): Material {
  return cells[point.y * WORLD_WIDTH + point.x] as Material;
}

function expectRect(cells: Uint8Array, rect: TranslucentEdgeVfxRect, material: Material): void {
  forEachPoint(rect, (point) => expect(materialAt(cells, point)).toBe(material));
}

function expectRectExcept(
  cells: Uint8Array,
  rect: TranslucentEdgeVfxRect,
  material: Material,
  exceptions: readonly TranslucentEdgeVfxRect[],
): void {
  forEachPoint(rect, (point) => {
    if (exceptions.some((exception) => contains(exception, point))) return;
    expect(materialAt(cells, point)).toBe(material);
  });
}

function expectFourCardinals(cells: Uint8Array, point: TranslucentEdgeVfxPoint, material: Material): void {
  for (const [x, y] of [[point.x - 1, point.y], [point.x + 1, point.y], [point.x, point.y - 1], [point.x, point.y + 1]]) {
    expect(cells[y * WORLD_WIDTH + x]).toBe(material);
  }
}

function expectWallControl(
  cells: Uint8Array,
  walls: Uint8Array,
  body: TranslucentEdgeVfxRect,
  probe: TranslucentEdgeVfxPoint,
  material: Material,
  wall: number,
): void {
  expect(body.x % 4).toBe(0);
  expect(body.y % 4).toBe(0);
  expectRect(cells, body, material);
  forEachPoint(body, (point) => expect(walls[point.y * WORLD_WIDTH + point.x]).toBe(wall));
  expect(materialAt(cells, probe)).toBe(material);
  expect(walls[probe.y * WORLD_WIDTH + probe.x]).toBe(wall);
}

function rectInside(inner: TranslucentEdgeVfxRect, outer: TranslucentEdgeVfxRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

function pointInside(point: TranslucentEdgeVfxPoint, outer: TranslucentEdgeVfxRect): boolean {
  return point.x >= outer.x && point.y >= outer.y
    && point.x < outer.x + outer.width && point.y < outer.y + outer.height;
}

function contains(rect: TranslucentEdgeVfxRect, point: TranslucentEdgeVfxPoint): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width && point.y >= rect.y && point.y < rect.y + rect.height;
}

function forEachPoint(rect: TranslucentEdgeVfxRect, visit: (point: TranslucentEdgeVfxPoint) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}

function byteHash(values: Uint8Array): number {
  let hash = 2166136261;
  for (const value of values) hash = Math.imul(hash ^ value, 16777619) >>> 0;
  return hash;
}
