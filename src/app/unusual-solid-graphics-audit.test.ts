import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import {
  UNUSUAL_SOLID_GRAPHICS_ATLAS,
  UNUSUAL_SOLID_GRAPHICS_ATLAS_COLUMNS,
  UNUSUAL_SOLID_GRAPHICS_ATLAS_ROWS,
  UNUSUAL_SOLID_GRAPHICS_AUDIT,
  prepareUnusualSolidGraphicsAuditFixture,
  type UnusualSolidGraphicsPoint,
  type UnusualSolidGraphicsRect,
} from './unusual-solid-graphics-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const UNUSUAL_SOLID_IDS = [
  Material.BIZRS, Material.PSTS, Material.SHLD1, Material.SHLD2,
  Material.SHLD3, Material.SHLD4, Material.VRSS,
];

class PaintTrackingBackend extends DeterministicBackend {
  paintCalls = 0;

  override paint(cx: number, cy: number, material: Material, radius: number): void {
    this.paintCalls++;
    super.paint(cx, cy, material, radius);
  }
}

describe('unusual solid graphics audit fixture', () => {
  it('pins all seven solid identities in a stable in-bounds atlas', () => {
    expect(UNUSUAL_SOLID_GRAPHICS_ATLAS_COLUMNS).toBe(7);
    expect(UNUSUAL_SOLID_GRAPHICS_ATLAS_ROWS).toBe(1);
    expect(UNUSUAL_SOLID_GRAPHICS_ATLAS).toHaveLength(7);
    expect(UNUSUAL_SOLID_GRAPHICS_ATLAS.map(({ material }) => material)).toEqual(UNUSUAL_SOLID_IDS);
    expect(UNUSUAL_SOLID_IDS).toEqual([196, 206, 80, 208, 209, 210, 216]);
    expect(UNUSUAL_SOLID_GRAPHICS_ATLAS.map(({ code }) => code)).toEqual([
      'BIZRS', 'PSTS', 'SHLD1', 'SHLD2', 'SHLD3', 'SHLD4', 'VRSS',
    ]);

    for (const [index, entry] of UNUSUAL_SOLID_GRAPHICS_ATLAS.entries()) {
      expect(entry.index).toBe(index);
      expect(entry.card).toEqual({ x: 6 + index * 86, y: 8, width: 80, height: 168 });
      expect(entry).toMatchObject({
        left: entry.card.x,
        top: entry.card.y,
        width: entry.card.width,
        height: entry.card.height,
      });
      expect(rectInside(entry.card, { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT })).toBe(true);
      expect(entry.body).toMatchObject({ width: 48, height: 48 });
      expect(rectInside(entry.body, entry.card)).toBe(true);
      expect(rectInside(entry.hole, entry.body)).toBe(true);
      expect(entry.hole.width).toBeGreaterThanOrEqual(4);
      expect(entry.hole.height).toBeGreaterThanOrEqual(4);
      expect(entry.openNotch).toHaveLength(3);
      expect(entry.openNotch.map(({ y }) => y)).toEqual([
        entry.body.y + 32, entry.body.y + 33, entry.body.y + 34,
      ]);
      expect(entry.openNotch.every((point) => point.x === entry.body.x + entry.body.width - 1)).toBe(true);
      expect(entry.openNotch.every((point) => pointInside(point, entry.body))).toBe(true);
      expect(rectInside(entry.shell.outer, entry.card)).toBe(true);
      expect(rectInside(entry.shell.interior, entry.shell.outer)).toBe(true);
      expect(entry.shell.interior).toEqual({
        x: entry.shell.outer.x + 1,
        y: entry.shell.outer.y + 1,
        width: entry.shell.outer.width - 2,
        height: entry.shell.outer.height - 2,
      });
      expect(entry.spur.width).toBe(1);
      expect(entry.spur.y).toBe(entry.body.y + entry.body.height);
      expect(entry.spur.x).toBeGreaterThanOrEqual(entry.body.x);
      expect(entry.spur.x).toBeLessThan(entry.body.x + entry.body.width);
      expect(rectInside(entry.spur, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(rectInside(entry.guardedBlank, entry.card)).toBe(true);
      expect(rectInside(entry.contact.owner, entry.card)).toBe(true);
      expect(rectInside(entry.contact.unlike, entry.card)).toBe(true);
      expect(rectanglesOverlap(entry.contact.owner, entry.contact.unlike)).toBe(false);
      expect(entry.contact.owner.x + entry.contact.owner.width).toBe(entry.contact.unlike.x);
      expect(entry.contact.owner.y).toBe(entry.contact.unlike.y);
      expect(entry.contact.owner.height).toBe(entry.contact.unlike.height);
      expect(entry.contact.unlikeMaterial).toBe(Material.Metal);
      expect(entry.contact.unlikeMaterial).not.toBe(entry.material);
    }

    expect(UNUSUAL_SOLID_GRAPHICS_AUDIT.cards).toBe(UNUSUAL_SOLID_GRAPHICS_ATLAS);
    expect(UNUSUAL_SOLID_GRAPHICS_AUDIT.holes).toHaveLength(7 * 36);
    expect(UNUSUAL_SOLID_GRAPHICS_AUDIT.openNotches).toHaveLength(7 * 3);
    expect(UNUSUAL_SOLID_GRAPHICS_AUDIT.shellCells).toHaveLength(7 * 68);
    expect(UNUSUAL_SOLID_GRAPHICS_AUDIT.shellInteriors).toHaveLength(7 * 256);
    expect(UNUSUAL_SOLID_GRAPHICS_AUDIT.spurs).toHaveLength(7 * 10);
    expect(UNUSUAL_SOLID_GRAPHICS_AUDIT.isolated).toHaveLength(7);
    expect(UNUSUAL_SOLID_GRAPHICS_AUDIT.guardedBlanks).toHaveLength(7);
    expect(UNUSUAL_SOLID_GRAPHICS_AUDIT.contacts).toHaveLength(7);
  });

  it('direct-fills exact cavities, shells, fine structures, and contacts without paint', () => {
    const simulation = new PaintTrackingBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareUnusualSolidGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    let expectedOccupied = 0;

    for (const entry of UNUSUAL_SOLID_GRAPHICS_ATLAS) {
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
      forEachPoint(entry.shell.outer, ({ x, y }) => {
        expect(cells[y * WORLD_WIDTH + x]).toBe(
          pointInside({ x, y }, entry.shell.interior) ? Material.Empty : entry.material,
        );
      });
      forEachPoint(entry.spur, ({ x, y }) => {
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
        expect(cells[y * WORLD_WIDTH + x]).toBe(Material.Metal);
      });

      const shellCount = entry.shell.outer.width * entry.shell.outer.height
        - entry.shell.interior.width * entry.shell.interior.height;
      expectedOccupied += entry.body.width * entry.body.height
        - entry.hole.width * entry.hole.height
        - entry.openNotch.length
        + shellCount
        + entry.spur.width * entry.spur.height
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
    prepareUnusualSolidGraphicsAuditFixture(first);
    prepareUnusualSolidGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());

    expect(() => prepareUnusualSolidGraphicsAuditFixture(new DeterministicBackend(32, 32)))
      .toThrow('requires 612x384');
    const wrongBackend = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    Object.defineProperty(wrongBackend, 'name', { value: 'not deterministic' });
    expect(() => prepareUnusualSolidGraphicsAuditFixture(wrongBackend))
      .toThrow('requires the deterministic backend');
  });
});

function pointInside(point: UnusualSolidGraphicsPoint, rect: UnusualSolidGraphicsRect): boolean {
  return point.x >= rect.x && point.y >= rect.y
    && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

function rectInside(inner: UnusualSolidGraphicsRect, outer: UnusualSolidGraphicsRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(a: UnusualSolidGraphicsRect, b: UnusualSolidGraphicsRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width
    && a.y < b.y + b.height && b.y < a.y + a.height;
}

function forEachPoint(
  rect: UnusualSolidGraphicsRect,
  visit: (point: UnusualSolidGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
