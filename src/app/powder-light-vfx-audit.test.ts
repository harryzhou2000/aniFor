import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  POWDER_LIGHT_VFX_AUDIT,
  preparePowderLightVfxFixture,
  type PowderLightVfxAuditPoint,
  type PowderLightVfxAuditRect,
} from './powder-light-vfx-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;

class PaintTrackingRenderLabBackend extends RenderLabBackend {
  paintCalls = 0;
  eraseCalls = 0;

  override paint(cx: number, cy: number, material: Material, radius: number): void {
    this.paintCalls++;
    super.paint(cx, cy, material, radius);
  }

  override erase(cx: number, cy: number, radius: number): void {
    this.eraseCalls++;
    super.erase(cx, cy, radius);
  }
}

describe('powder light VFX audit fixture', () => {
  it('pins three dry powder bodies and their distinct warm/cool source topology', () => {
    expect(POWDER_LIGHT_VFX_AUDIT.cards).toHaveLength(3);
    expect(POWDER_LIGHT_VFX_AUDIT.cards.map(({ material }) => material))
      .toEqual([Material.Sand, Material.Clay, Material.Concrete]);
    expect(POWDER_LIGHT_VFX_AUDIT.cards.map(({ code }) => code))
      .toEqual(['SAND', 'CLAY', 'CONC']);

    const world = { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT };
    for (const card of POWDER_LIGHT_VFX_AUDIT.cards) {
      expect(rectInside(card.body, world)).toBe(true);
      expect(rectInside(card.warmSource, world)).toBe(true);
      expect(rectInside(card.coolSource, world)).toBe(true);
      expect(rectInside(card.warmGap, world)).toBe(true);
      expect(rectInside(card.coolGap, world)).toBe(true);
      expect(rectInside(card.authoredHole, card.body)).toBe(true);
      expect(card.fineColumn.width).toBe(1);
      expect(rectInside(card.fineColumn, world)).toBe(true);
      expect(rectInside(card.fineSource, world)).toBe(true);
      expect(rectInside(card.fineGap, world)).toBe(true);
      expect(rectInside(card.darkCore, card.body)).toBe(true);
    }

    expect(pointInside(POWDER_LIGHT_VFX_AUDIT.isolatedSand, world)).toBe(true);
    expect(rectInside(POWDER_LIGHT_VFX_AUDIT.wetSuspension.water, world)).toBe(true);
    expect(rectInside(POWDER_LIGHT_VFX_AUDIT.wetSuspension.mixture, world)).toBe(true);
    expect(rectInside(POWDER_LIGHT_VFX_AUDIT.wetSuspension.source, world)).toBe(true);
    expect(rectInside(POWDER_LIGHT_VFX_AUDIT.wetSuspension.gap, world)).toBe(true);
    expect(pointInside(POWDER_LIGHT_VFX_AUDIT.wetSuspension.lightFacingSand, world)).toBe(true);
    expect(pointInside(POWDER_LIGHT_VFX_AUDIT.nativeWall, world)).toBe(true);
    expect(rectInside(POWDER_LIGHT_VFX_AUDIT.wallFreeControl, world)).toBe(true);
  });

  it('direct-fills sources and every protected material/gap/hole/fine/wet/wall control', () => {
    const simulation = new PaintTrackingRenderLabBackend(WORLD_WIDTH, WORLD_HEIGHT);
    preparePowderLightVfxFixture(simulation);
    const cells = simulation.cells();

    for (const card of POWDER_LIGHT_VFX_AUDIT.cards) {
      forEachPoint(card.body, (point) => {
        const empty = pointInRect(point, card.warmGap)
          || pointInRect(point, card.coolGap) || pointInRect(point, card.authoredHole);
        expect(materialAt(cells, point)).toBe(empty ? Material.Empty : card.material);
      });
      forEachPoint(card.warmSource, (point) => expect(materialAt(cells, point)).toBe(Material.Fire));
      forEachPoint(card.coolSource, (point) => expect(materialAt(cells, point)).toBe(Material.ELEC));
      forEachPoint(card.warmGap, (point) => expect(materialAt(cells, point)).toBe(Material.Empty));
      forEachPoint(card.coolGap, (point) => expect(materialAt(cells, point)).toBe(Material.Empty));
      forEachPoint(card.fineColumn, (point) => expect(materialAt(cells, point)).toBe(card.material));
      forEachPoint(card.fineSource, (point) => expect(materialAt(cells, point)).toBe(Material.Fire));
      forEachPoint(card.fineGap, (point) => expect(materialAt(cells, point)).toBe(Material.Empty));
      forEachPoint(card.darkCore, (point) => expect(materialAt(cells, point)).toBe(card.material));
    }

    expect(materialAt(cells, POWDER_LIGHT_VFX_AUDIT.isolatedSand)).toBe(Material.Sand);
    forEachPoint(POWDER_LIGHT_VFX_AUDIT.wetSuspension.water, (point) => {
      expect(materialAt(cells, point)).toBe(
        POWDER_LIGHT_VFX_AUDIT.wetSuspension.sandPoints.some((sand) => sand.x === point.x && sand.y === point.y)
          ? Material.Sand
          : pointInRect(point, POWDER_LIGHT_VFX_AUDIT.wetSuspension.source) ? Material.Fire
            : pointInRect(point, POWDER_LIGHT_VFX_AUDIT.wetSuspension.gap) ? Material.Empty : Material.Water,
      );
    });
    for (const point of POWDER_LIGHT_VFX_AUDIT.wetSuspension.sandPoints) {
      expect(materialAt(cells, point)).toBe(Material.Sand);
    }
    expect(materialAt(cells, POWDER_LIGHT_VFX_AUDIT.wetSuspension.lightFacingSand)).toBe(Material.Sand);
    expect(simulation.walls()[POWDER_LIGHT_VFX_AUDIT.nativeWall.y * WORLD_WIDTH
      + POWDER_LIGHT_VFX_AUDIT.nativeWall.x]).toBe(1);
    forEachPoint(POWDER_LIGHT_VFX_AUDIT.wallFreeControl, (point) => {
      expect(materialAt(cells, point)).toBe(Material.Empty);
      expect(simulation.walls()[point.y * WORLD_WIDTH + point.x]).toBe(0);
    });

    const expectedPaints = POWDER_LIGHT_VFX_AUDIT.cards.reduce((count, card) => (
      count + area(card.body) + area(card.warmSource) + area(card.coolSource) + area(card.fineColumn) + area(card.fineSource)
    ), 1 + area(POWDER_LIGHT_VFX_AUDIT.wetSuspension.water)
      + area(POWDER_LIGHT_VFX_AUDIT.wetSuspension.source) + POWDER_LIGHT_VFX_AUDIT.wetSuspension.sandPoints.length);
    const expectedErases = POWDER_LIGHT_VFX_AUDIT.cards.reduce(
      (count, card) => count + area(card.authoredHole) + area(card.fineGap),
    area(POWDER_LIGHT_VFX_AUDIT.wetSuspension.gap));
    // DeterministicBackend.erase delegates to paint(Empty), so the paint counter
    // includes the authored-hole writes as well as the positive material writes.
    expect(simulation.paintCalls).toBe(expectedPaints + expectedErases);
    expect(simulation.eraseCalls).toBe(expectedErases);
  });

  it('is byte deterministic, resets stale cells and rejects noncanonical geometry', () => {
    const first = new RenderLabBackend(WORLD_WIDTH, WORLD_HEIGHT);
    const second = new RenderLabBackend(WORLD_WIDTH, WORLD_HEIGHT);
    preparePowderLightVfxFixture(first);
    preparePowderLightVfxFixture(second);
    expect(first.cells()).toEqual(second.cells());
    expect(first.walls()).toEqual(second.walls());

    const expectedCells = first.cells().slice();
    const expectedWalls = first.walls().slice();
    first.cells().fill(Material.Fire);
    first.paintWall(4, 4, 1, 0);
    preparePowderLightVfxFixture(first);
    expect(first.cells()).toEqual(expectedCells);
    expect(first.walls()).toEqual(expectedWalls);

    expect(() => preparePowderLightVfxFixture(new RenderLabBackend(32, 32)))
      .toThrow('requires 612x384');
  }, 15_000);
});

function materialAt(cells: Uint8Array, point: PowderLightVfxAuditPoint): Material {
  return cells[point.y * WORLD_WIDTH + point.x] as Material;
}

function pointInside(point: PowderLightVfxAuditPoint, rect: PowderLightVfxAuditRect): boolean {
  return point.x >= rect.x && point.y >= rect.y
    && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

function rectInside(inner: PowderLightVfxAuditRect, outer: PowderLightVfxAuditRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function pointInRect(point: PowderLightVfxAuditPoint, rect: PowderLightVfxAuditRect): boolean {
  return pointInside(point, rect);
}

function forEachPoint(rect: PowderLightVfxAuditRect, visit: (point: PowderLightVfxAuditPoint) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}

function area(rect: PowderLightVfxAuditRect): number {
  return rect.width * rect.height;
}
