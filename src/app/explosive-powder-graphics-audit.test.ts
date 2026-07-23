import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import {
  EXPLOSIVE_POWDER_GRAPHICS_ATLAS,
  EXPLOSIVE_POWDER_GRAPHICS_ATLAS_COLUMNS,
  EXPLOSIVE_POWDER_GRAPHICS_ATLAS_ROWS,
  EXPLOSIVE_POWDER_GRAPHICS_AUDIT,
  prepareExplosivePowderGraphicsAuditFixture,
  type ExplosivePowderGraphicsPoint,
  type ExplosivePowderGraphicsRect,
} from './explosive-powder-graphics-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const EXPLOSIVE_POWDER_IDS = [
  Material.Gunpowder, Material.Thermite, Material.C4, Material.Firework,
  Material.BANG, Material.BOMB, Material.C5, Material.DEST, Material.FIRW,
  Material.FSEP, Material.FUSE, Material.IGNT, Material.LITH, Material.RBDM,
];

class PaintTrackingBackend extends DeterministicBackend {
  paintCalls = 0;

  override paint(cx: number, cy: number, material: Material, radius: number): void {
    this.paintCalls++;
    super.paint(cx, cy, material, radius);
  }
}

describe('explosive powder graphics audit fixture', () => {
  it('pins all fourteen material identities in a stable in-bounds 7x2 atlas', () => {
    expect(EXPLOSIVE_POWDER_GRAPHICS_ATLAS_COLUMNS).toBe(7);
    expect(EXPLOSIVE_POWDER_GRAPHICS_ATLAS_ROWS).toBe(2);
    expect(EXPLOSIVE_POWDER_GRAPHICS_ATLAS).toHaveLength(14);
    expect(EXPLOSIVE_POWDER_GRAPHICS_ATLAS.map(({ material }) => material))
      .toEqual(EXPLOSIVE_POWDER_IDS);
    expect(EXPLOSIVE_POWDER_IDS).toEqual([14, 30, 31, 33, 84, 85, 86, 88, 89, 90, 91, 92, 94, 96]);
    expect(EXPLOSIVE_POWDER_GRAPHICS_ATLAS.map(({ code }) => code)).toEqual([
      'GUNP', 'THRM', 'PLEX', 'FWRK', 'BANG', 'BOMB', 'C5',
      'DEST', 'FIRW', 'FSEP', 'FUSE', 'IGNT', 'LITH', 'RBDM',
    ]);

    for (const [index, entry] of EXPLOSIVE_POWDER_GRAPHICS_ATLAS.entries()) {
      expect(entry.index).toBe(index);
      expect(entry.card).toEqual({
        x: 4 + (index % 7) * 86,
        y: 4 + Math.floor(index / 7) * 184,
        width: 82,
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
        entry.body.y + 41, entry.body.y + 42, entry.body.y + 43,
      ]);
      expect(entry.openNotch.every((point) => point.x === entry.body.x + entry.body.width - 1)).toBe(true);
      expect(entry.openNotch.every((point) => pointInside(point, entry.body))).toBe(true);
      expect(entry.thinColumn).toMatchObject({ width: 1, height: 58 });
      expect(rectInside(entry.thinColumn, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(rectInside(entry.guardedBlank, entry.card)).toBe(true);
      expect(rectInside(entry.contact.owner, entry.card)).toBe(true);
      expect(rectInside(entry.contact.unlike, entry.card)).toBe(true);
      expect(rectInside(entry.waterControl, entry.card)).toBe(true);
      expect(rectInside(entry.metalControl, entry.card)).toBe(true);
      expect(rectanglesOverlap(entry.contact.owner, entry.contact.unlike)).toBe(false);
      expect(entry.contact.owner.x + entry.contact.owner.width).toBe(entry.contact.unlike.x);
      expect(entry.contact.owner.y).toBe(entry.contact.unlike.y);
      expect(entry.contact.owner.height).toBe(entry.contact.unlike.height);
      expect(entry.contact.unlikeMaterial).toBe(Material.Sand);
      expect(entry.contact.unlikeMaterial).not.toBe(entry.material);
      const occupiedControls = [
        entry.contact.owner, entry.contact.unlike, entry.waterControl, entry.metalControl,
      ];
      for (let left = 0; left < occupiedControls.length; left++) {
        for (let right = left + 1; right < occupiedControls.length; right++) {
          expect(rectanglesOverlap(occupiedControls[left], occupiedControls[right])).toBe(false);
        }
      }
      expect(occupiedControls.every((rect) => !rectanglesOverlap(rect, entry.guardedBlank))).toBe(true);
    }

    for (let left = 0; left < EXPLOSIVE_POWDER_GRAPHICS_ATLAS.length; left++) {
      for (let right = left + 1; right < EXPLOSIVE_POWDER_GRAPHICS_ATLAS.length; right++) {
        expect(rectanglesOverlap(
          EXPLOSIVE_POWDER_GRAPHICS_ATLAS[left].card,
          EXPLOSIVE_POWDER_GRAPHICS_ATLAS[right].card,
        )).toBe(false);
      }
    }

    expect(EXPLOSIVE_POWDER_GRAPHICS_AUDIT.cards).toBe(EXPLOSIVE_POWDER_GRAPHICS_ATLAS);
    expect(EXPLOSIVE_POWDER_GRAPHICS_AUDIT.holes).toHaveLength(14 * 4);
    expect(EXPLOSIVE_POWDER_GRAPHICS_AUDIT.openNotches).toHaveLength(14 * 3);
    expect(EXPLOSIVE_POWDER_GRAPHICS_AUDIT.thinColumns).toHaveLength(14 * 58);
    expect(EXPLOSIVE_POWDER_GRAPHICS_AUDIT.isolated).toHaveLength(14);
    expect(EXPLOSIVE_POWDER_GRAPHICS_AUDIT.guardedBlanks).toHaveLength(14);
    expect(EXPLOSIVE_POWDER_GRAPHICS_AUDIT.contacts).toHaveLength(14);
    expect(EXPLOSIVE_POWDER_GRAPHICS_AUDIT.waterControls).toHaveLength(14);
    expect(EXPLOSIVE_POWDER_GRAPHICS_AUDIT.metalControls).toHaveLength(14);
  });

  it('direct-fills all authored topology and no-op controls without invoking ordinary paint', () => {
    const simulation = new PaintTrackingBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareExplosivePowderGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    let expectedOccupied = 0;

    for (const entry of EXPLOSIVE_POWDER_GRAPHICS_ATLAS) {
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
        expect(cells[y * WORLD_WIDTH + x]).toBe(Material.Sand);
      });
      forEachPoint(entry.waterControl, ({ x, y }) => {
        expect(cells[y * WORLD_WIDTH + x]).toBe(Material.Water);
      });
      forEachPoint(entry.metalControl, ({ x, y }) => {
        expect(cells[y * WORLD_WIDTH + x]).toBe(Material.Metal);
      });

      expectedOccupied += entry.body.width * entry.body.height
        - entry.hole.width * entry.hole.height
        - entry.openNotch.length
        + entry.thinColumn.width * entry.thinColumn.height
        + 1
        + entry.contact.owner.width * entry.contact.owner.height
        + entry.contact.unlike.width * entry.contact.unlike.height
        + entry.waterControl.width * entry.waterControl.height
        + entry.metalControl.width * entry.metalControl.height;
    }

    expect(simulation.paintCalls).toBe(0);
    expect(cells.reduce((count, material) => count + Number(material !== Material.Empty), 0))
      .toBe(expectedOccupied);
  });

  it('is byte-deterministic and rejects the wrong backend or world geometry', () => {
    const first = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    const second = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareExplosivePowderGraphicsAuditFixture(first);
    prepareExplosivePowderGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());

    expect(() => prepareExplosivePowderGraphicsAuditFixture(new DeterministicBackend(32, 32)))
      .toThrow('requires 612x384');
    const wrongBackend = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    Object.defineProperty(wrongBackend, 'name', { value: 'not deterministic' });
    expect(() => prepareExplosivePowderGraphicsAuditFixture(wrongBackend))
      .toThrow('requires the deterministic backend');
  });
});

function pointInside(point: ExplosivePowderGraphicsPoint, rect: ExplosivePowderGraphicsRect): boolean {
  return point.x >= rect.x && point.y >= rect.y
    && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

function rectInside(inner: ExplosivePowderGraphicsRect, outer: ExplosivePowderGraphicsRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(a: ExplosivePowderGraphicsRect, b: ExplosivePowderGraphicsRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width
    && a.y < b.y + b.height && b.y < a.y + a.height;
}

function forEachPoint(
  rect: ExplosivePowderGraphicsRect,
  visit: (point: ExplosivePowderGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
