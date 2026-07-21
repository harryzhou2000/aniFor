import { describe, expect, it } from 'vitest';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { LIFE_PRESETS, Material } from '../shared/materials';
import {
  CELLULAR_GRAPHICS_ATLAS, CELLULAR_GRAPHICS_ATLAS_COLUMNS, CELLULAR_GRAPHICS_AUDIT,
  CELLULAR_GRAPHICS_ATLAS_ROWS, prepareCellularGraphicsAuditFixture,
  type CellularGraphicsPoint, type CellularGraphicsRect,
} from './cellular-graphics-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;

describe('cellular graphics audit fixture', () => {
  it('lays out every LIFE ctype in a stable in-bounds 6x4 atlas', () => {
    expect(CELLULAR_GRAPHICS_ATLAS_COLUMNS).toBe(6);
    expect(CELLULAR_GRAPHICS_ATLAS_ROWS).toBe(4);
    expect(CELLULAR_GRAPHICS_ATLAS).toHaveLength(24);
    expect(CELLULAR_GRAPHICS_ATLAS.map(({ preset }) => preset)).toEqual(
      LIFE_PRESETS.map(({ preset }) => preset),
    );
    expect(CELLULAR_GRAPHICS_ATLAS.map(({ material }) => material)).toEqual(
      LIFE_PRESETS.map(({ material }) => material),
    );
    for (const entry of CELLULAR_GRAPHICS_ATLAS) {
      expect(entry).toMatchObject({
        left: entry.card.x, top: entry.card.y,
        width: entry.card.width, height: entry.card.height,
      });
      expect(rectInside(entry.card, { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT })).toBe(true);
      expect(rectInside(entry.body, entry.card)).toBe(true);
      expect(rectInside(entry.hole, entry.body)).toBe(true);
      expect(entry.hole).toMatchObject({ width: 2, height: 2 });
      expect(entry.tendril).toHaveLength(6);
      expect(entry.tendril.every((point) => pointInside(point, entry.card))).toBe(true);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(rectInside(entry.guardedBlank, entry.card)).toBe(true);
    }
    expect(CELLULAR_GRAPHICS_AUDIT.cards).toBe(CELLULAR_GRAPHICS_ATLAS);
    expect(CELLULAR_GRAPHICS_AUDIT.holes).toHaveLength(24 * 4);
    expect(CELLULAR_GRAPHICS_AUDIT.isolated).toHaveLength(24);
  });

  it('direct-fills dense cards while preserving all fine and blank controls', () => {
    const simulation = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareCellularGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    let expectedOccupied = 0;
    for (const entry of CELLULAR_GRAPHICS_ATLAS) {
      forEachPoint(entry.body, ({ x, y }) => {
        const inHole = pointInside({ x, y }, entry.hole);
        expect(cells[y * WORLD_WIDTH + x]).toBe(inHole ? Material.Empty : entry.material);
      });
      for (const point of entry.tendril) {
        expect(cells[point.y * WORLD_WIDTH + point.x]).toBe(entry.material);
      }
      expect(cells[entry.isolated.y * WORLD_WIDTH + entry.isolated.x]).toBe(entry.material);
      forEachPoint(entry.guardedBlank, ({ x, y }) => {
        expect(cells[y * WORLD_WIDTH + x]).toBe(Material.Empty);
      });
      expectedOccupied += entry.body.width * entry.body.height
        - entry.hole.width * entry.hole.height + entry.tendril.length + 1;
    }
    expect(cells.reduce((count, material) => count + Number(material !== Material.Empty), 0))
      .toBe(expectedOccupied);
  });

  it('is deterministic and rejects noncanonical world geometry', () => {
    const first = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    const second = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareCellularGraphicsAuditFixture(first);
    prepareCellularGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());
    expect(() => prepareCellularGraphicsAuditFixture(new DeterministicBackend(32, 32)))
      .toThrow('requires 612x384');
  });
});

function pointInside(point: CellularGraphicsPoint, rect: CellularGraphicsRect): boolean {
  return point.x >= rect.x && point.y >= rect.y
    && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

function rectInside(inner: CellularGraphicsRect, outer: CellularGraphicsRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function forEachPoint(rect: CellularGraphicsRect, visit: (point: CellularGraphicsPoint) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
