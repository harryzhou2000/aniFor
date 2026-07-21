import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import {
  UNUSUAL_POWDER_GRAPHICS_ATLAS,
  UNUSUAL_POWDER_GRAPHICS_ATLAS_COLUMNS,
  UNUSUAL_POWDER_GRAPHICS_ATLAS_ROWS,
  UNUSUAL_POWDER_GRAPHICS_AUDIT,
  prepareUnusualPowderGraphicsAuditFixture,
  type UnusualPowderGraphicsPoint,
  type UnusualPowderGraphicsRect,
} from './unusual-powder-graphics-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const UNUSUAL_POWDER_IDS = [
  Material.ANAR, Material.BGLA, Material.BREC, Material.BRMT, Material.FRZZ,
  Material.GRAV, Material.SAWD, Material.SLCN, Material.DYST, Material.BCOL,
];

class PaintTrackingBackend extends DeterministicBackend {
  paintCalls = 0;

  override paint(cx: number, cy: number, material: Material, radius: number): void {
    this.paintCalls++;
    super.paint(cx, cy, material, radius);
  }
}

describe('unusual powder graphics audit fixture', () => {
  it('pins all ten material identities in a stable in-bounds 5x2 atlas', () => {
    expect(UNUSUAL_POWDER_GRAPHICS_ATLAS_COLUMNS).toBe(5);
    expect(UNUSUAL_POWDER_GRAPHICS_ATLAS_ROWS).toBe(2);
    expect(UNUSUAL_POWDER_GRAPHICS_ATLAS).toHaveLength(10);
    expect(UNUSUAL_POWDER_GRAPHICS_ATLAS.map(({ material }) => material)).toEqual(UNUSUAL_POWDER_IDS);
    expect(UNUSUAL_POWDER_IDS).toEqual([43, 44, 45, 46, 47, 48, 49, 51, 198, 217]);
    expect(UNUSUAL_POWDER_GRAPHICS_ATLAS.map(({ code }) => code)).toEqual([
      'ANAR', 'BGLA', 'BREC', 'BRMT', 'FRZZ', 'GRAV', 'SAWD', 'SLCN', 'DYST', 'BCOL',
    ]);

    for (const [index, entry] of UNUSUAL_POWDER_GRAPHICS_ATLAS.entries()) {
      expect(entry.index).toBe(index);
      expect(entry.card).toEqual({
        x: 8 + (index % 5) * 120,
        y: 8 + Math.floor(index / 5) * 184,
        width: 112,
        height: 168,
      });
      expect(entry).toMatchObject({
        left: entry.card.x,
        top: entry.card.y,
        width: entry.card.width,
        height: entry.card.height,
      });
      expect(rectInside(entry.card, { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT })).toBe(true);
      expect(rectInside(entry.body, entry.card)).toBe(true);
      expect(rectInside(entry.hole, entry.body)).toBe(true);
      expect(entry.hole).toMatchObject({ width: 2, height: 2 });
      expect(entry.openNotch).toHaveLength(3);
      expect(entry.openNotch.map(({ y }) => y)).toEqual([
        entry.body.y + 42, entry.body.y + 43, entry.body.y + 44,
      ]);
      expect(entry.openNotch.every((point) => point.x === entry.body.x + entry.body.width - 1)).toBe(true);
      expect(entry.openNotch.every((point) => pointInside(point, entry.body))).toBe(true);
      expect(entry.thinColumn.width).toBe(1);
      expect(rectInside(entry.thinColumn, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(rectInside(entry.guardedBlank, entry.card)).toBe(true);
      expect(rectInside(entry.contact.owner, entry.card)).toBe(true);
      expect(rectInside(entry.contact.unlike, entry.card)).toBe(true);
      expect(rectanglesOverlap(entry.contact.owner, entry.contact.unlike)).toBe(false);
      expect(entry.contact.owner.x + entry.contact.owner.width).toBe(entry.contact.unlike.x);
      expect(entry.contact.owner.y).toBe(entry.contact.unlike.y);
      expect(entry.contact.owner.height).toBe(entry.contact.unlike.height);
      expect(entry.contact.unlikeMaterial).toBe(Material.Sand);
      expect(entry.contact.unlikeMaterial).not.toBe(entry.material);
    }

    expect(UNUSUAL_POWDER_GRAPHICS_AUDIT.cards).toBe(UNUSUAL_POWDER_GRAPHICS_ATLAS);
    expect(UNUSUAL_POWDER_GRAPHICS_AUDIT.holes).toHaveLength(10 * 4);
    expect(UNUSUAL_POWDER_GRAPHICS_AUDIT.openNotches).toHaveLength(10 * 3);
    expect(UNUSUAL_POWDER_GRAPHICS_AUDIT.thinColumns).toHaveLength(10 * 58);
    expect(UNUSUAL_POWDER_GRAPHICS_AUDIT.isolated).toHaveLength(10);
    expect(UNUSUAL_POWDER_GRAPHICS_AUDIT.guardedBlanks).toHaveLength(10);
    expect(UNUSUAL_POWDER_GRAPHICS_AUDIT.contacts).toHaveLength(10);
  });

  it('direct-fills all authored topology without invoking ordinary paint', () => {
    const simulation = new PaintTrackingBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareUnusualPowderGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    let expectedOccupied = 0;

    for (const entry of UNUSUAL_POWDER_GRAPHICS_ATLAS) {
      forEachPoint(entry.body, ({ x, y }) => {
        const isHole = pointInside({ x, y }, entry.hole);
        const isNotch = entry.openNotch.some((point) => point.x === x && point.y === y);
        expect(cells[y * WORLD_WIDTH + x]).toBe(isHole || isNotch ? Material.Empty : entry.material);
      });
      forEachPoint(entry.hole, ({ x, y }) => {
        expect(cells[y * WORLD_WIDTH + x]).toBe(Material.Empty);
      });
      for (const point of entry.openNotch) {
        expect(cells[point.y * WORLD_WIDTH + point.x]).toBe(Material.Empty);
        expect(cells[point.y * WORLD_WIDTH + point.x + 1]).toBe(Material.Empty);
      }
      forEachPoint(entry.thinColumn, ({ x, y }) => {
        expect(cells[y * WORLD_WIDTH + x]).toBe(entry.material);
      });
      expect(cells[entry.isolated.y * WORLD_WIDTH + entry.isolated.x]).toBe(entry.material);
      forEachPoint(entry.guardedBlank, ({ x, y }) => {
        expect(cells[y * WORLD_WIDTH + x]).toBe(Material.Empty);
      });
      forEachPoint(entry.contact.owner, ({ x, y }) => {
        expect(cells[y * WORLD_WIDTH + x]).toBe(entry.material);
      });
      forEachPoint(entry.contact.unlike, ({ x, y }) => {
        expect(cells[y * WORLD_WIDTH + x]).toBe(entry.contact.unlikeMaterial);
      });

      expectedOccupied += entry.body.width * entry.body.height
        - entry.hole.width * entry.hole.height
        - entry.openNotch.length
        + entry.thinColumn.width * entry.thinColumn.height
        + 1
        + entry.contact.owner.width * entry.contact.owner.height
        + entry.contact.unlike.width * entry.contact.unlike.height;
    }

    expect(simulation.paintCalls).toBe(0);
    expect(cells.reduce((count, material) => count + Number(material !== Material.Empty), 0))
      .toBe(expectedOccupied);
  });

  it('is byte-deterministic and rejects the wrong backend or world geometry', () => {
    const first = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    const second = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareUnusualPowderGraphicsAuditFixture(first);
    prepareUnusualPowderGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());

    expect(() => prepareUnusualPowderGraphicsAuditFixture(new DeterministicBackend(32, 32)))
      .toThrow('requires 612x384');
    const wrongBackend = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    Object.defineProperty(wrongBackend, 'name', { value: 'not deterministic' });
    expect(() => prepareUnusualPowderGraphicsAuditFixture(wrongBackend))
      .toThrow('requires the deterministic backend');
  });
});

function pointInside(point: UnusualPowderGraphicsPoint, rect: UnusualPowderGraphicsRect): boolean {
  return point.x >= rect.x && point.y >= rect.y
    && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

function rectInside(inner: UnusualPowderGraphicsRect, outer: UnusualPowderGraphicsRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(a: UnusualPowderGraphicsRect, b: UnusualPowderGraphicsRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width
    && a.y < b.y + b.height && b.y < a.y + a.height;
}

function forEachPoint(
  rect: UnusualPowderGraphicsRect,
  visit: (point: UnusualPowderGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
