import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import {
  EARTHEN_POWDER_GRAPHICS_ATLAS,
  EARTHEN_POWDER_GRAPHICS_ATLAS_COLUMNS,
  EARTHEN_POWDER_GRAPHICS_ATLAS_ROWS,
  EARTHEN_POWDER_GRAPHICS_AUDIT,
  prepareEarthenPowderGraphicsAuditFixture,
  type EarthenPowderGraphicsPoint,
  type EarthenPowderGraphicsRect,
} from './earthen-powder-graphics-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const EARTHEN_POWDER_IDS = [Material.Dust, Material.Stone, Material.Concrete, Material.Clay];

class PaintTrackingBackend extends DeterministicBackend {
  paintCalls = 0;
  override paint(cx: number, cy: number, material: Material, radius: number): void {
    this.paintCalls++;
    super.paint(cx, cy, material, radius);
  }
}

describe('earthen powder graphics audit fixture', () => {
  it('pins the four earthen identities in a stable, in-bounds 2x2 atlas', () => {
    expect(EARTHEN_POWDER_GRAPHICS_ATLAS_COLUMNS).toBe(2);
    expect(EARTHEN_POWDER_GRAPHICS_ATLAS_ROWS).toBe(2);
    expect(EARTHEN_POWDER_GRAPHICS_ATLAS).toHaveLength(4);
    expect(EARTHEN_POWDER_GRAPHICS_ATLAS.map(({ material }) => material)).toEqual(EARTHEN_POWDER_IDS);
    expect(EARTHEN_POWDER_IDS).toEqual([6, 21, 26, 28]);
    expect(EARTHEN_POWDER_GRAPHICS_ATLAS.map(({ code }) => code)).toEqual(['DUST', 'STNE', 'CNCT', 'CLAY']);

    for (const [index, entry] of EARTHEN_POWDER_GRAPHICS_ATLAS.entries()) {
      expect(entry.index).toBe(index);
      expect(entry.card).toEqual({
        x: 8 + (index % 2) * 180,
        y: 8 + Math.floor(index / 2) * 184,
        width: 168,
        height: 168,
      });
      expect(rectInside(entry.card, { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT })).toBe(true);
      expect(rectInside(entry.body, entry.card)).toBe(true);
      expect(rectInside(entry.hole, entry.body)).toBe(true);
      expect(entry.hole).toMatchObject({ width: 6, height: 6 });
      expect(entry.openNotch).toHaveLength(3);
      expect(entry.openNotch.every((point) => point.x === entry.body.x + entry.body.width - 1)).toBe(true);
      expect(entry.openNotch.every((point) => pointInside(point, entry.body))).toBe(true);
      expect(entry.thinColumn.width).toBe(1);
      expect(rectInside(entry.thinColumn, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(rectInside(entry.guardedBlank, entry.card)).toBe(true);
      expect(entry.contact.owner.x + entry.contact.owner.width).toBe(entry.contact.unlike.x);
      expect(entry.contact.unlikeMaterial).toBe(Material.Metal);
      expect(entry.contact.unlikeMaterial).not.toBe(entry.material);
    }

    expect(EARTHEN_POWDER_GRAPHICS_AUDIT.cards).toBe(EARTHEN_POWDER_GRAPHICS_ATLAS);
    expect(EARTHEN_POWDER_GRAPHICS_AUDIT.holes).toHaveLength(4 * 36);
    expect(EARTHEN_POWDER_GRAPHICS_AUDIT.openNotches).toHaveLength(4 * 3);
    expect(EARTHEN_POWDER_GRAPHICS_AUDIT.thinColumns).toHaveLength(4 * 58);
  });

  it('direct-fills topology without invoking ordinary paint', () => {
    const simulation = new PaintTrackingBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareEarthenPowderGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    let expectedOccupied = 0;
    for (const entry of EARTHEN_POWDER_GRAPHICS_ATLAS) {
      forEachPoint(entry.body, ({ x, y }) => {
        const hole = pointInside({ x, y }, entry.hole);
        const notch = entry.openNotch.some((point) => point.x === x && point.y === y);
        expect(cells[y * WORLD_WIDTH + x]).toBe(hole || notch ? Material.Empty : entry.material);
      });
      forEachPoint(entry.thinColumn, ({ x, y }) => expect(cells[y * WORLD_WIDTH + x]).toBe(entry.material));
      expect(cells[entry.isolated.y * WORLD_WIDTH + entry.isolated.x]).toBe(entry.material);
      forEachPoint(entry.guardedBlank, ({ x, y }) => expect(cells[y * WORLD_WIDTH + x]).toBe(Material.Empty));
      forEachPoint(entry.contact.owner, ({ x, y }) => expect(cells[y * WORLD_WIDTH + x]).toBe(entry.material));
      forEachPoint(entry.contact.unlike, ({ x, y }) => expect(cells[y * WORLD_WIDTH + x]).toBe(Material.Metal));
      expectedOccupied += entry.body.width * entry.body.height - entry.hole.width * entry.hole.height
        - entry.openNotch.length + entry.thinColumn.height + 1
        + entry.contact.owner.width * entry.contact.owner.height + entry.contact.unlike.width * entry.contact.unlike.height;
    }
    expect(simulation.paintCalls).toBe(0);
    expect(cells.reduce((count, material) => count + Number(material !== Material.Empty), 0)).toBe(expectedOccupied);
  });

  it('is byte deterministic and rejects an incompatible backend or world', () => {
    const first = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    const second = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareEarthenPowderGraphicsAuditFixture(first);
    prepareEarthenPowderGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());
    expect(() => prepareEarthenPowderGraphicsAuditFixture(new DeterministicBackend(32, 32))).toThrow('requires 612x384');
    const wrongBackend = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    Object.defineProperty(wrongBackend, 'name', { value: 'not deterministic' });
    expect(() => prepareEarthenPowderGraphicsAuditFixture(wrongBackend)).toThrow('requires the deterministic backend');
  });
});

function pointInside(point: EarthenPowderGraphicsPoint, rect: EarthenPowderGraphicsRect): boolean {
  return point.x >= rect.x && point.y >= rect.y && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

function rectInside(inner: EarthenPowderGraphicsRect, outer: EarthenPowderGraphicsRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

function forEachPoint(rect: EarthenPowderGraphicsRect, visit: (point: EarthenPowderGraphicsPoint) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
