import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import {
  ELECTRIC_DISCHARGE_GRAPHICS_ATLAS,
  ELECTRIC_DISCHARGE_GRAPHICS_ATLAS_COLUMNS,
  ELECTRIC_DISCHARGE_GRAPHICS_ATLAS_ROWS,
  ELECTRIC_DISCHARGE_GRAPHICS_AUDIT,
  prepareElectricDischargeGraphicsAuditFixture,
  type ElectricDischargeGraphicsPoint,
  type ElectricDischargeGraphicsRect,
} from './electric-discharge-graphics-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;

class PaintTrackingBackend extends DeterministicBackend {
  paintCalls = 0;
  override paint(cx: number, cy: number, material: Material, radius: number): void {
    this.paintCalls++;
    super.paint(cx, cy, material, radius);
  }
}

describe('electric discharge graphics audit fixture', () => {
  it('pins LIGH and THDR in a stable in-bounds two-card atlas', () => {
    expect(ELECTRIC_DISCHARGE_GRAPHICS_ATLAS_COLUMNS).toBe(2);
    expect(ELECTRIC_DISCHARGE_GRAPHICS_ATLAS_ROWS).toBe(1);
    expect(ELECTRIC_DISCHARGE_GRAPHICS_ATLAS.map(({ material }) => material))
      .toEqual([Material.LIGH, Material.THDR]);
    expect(ELECTRIC_DISCHARGE_GRAPHICS_ATLAS.map(({ code }) => code)).toEqual(['LIGH', 'THDR']);
    for (const [index, entry] of ELECTRIC_DISCHARGE_GRAPHICS_ATLAS.entries()) {
      expect(entry.index).toBe(index);
      expect(entry.card).toEqual({ x: 8 + index * 298, y: 8, width: 290, height: 368 });
      expect(rectInside(entry.card, { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT })).toBe(true);
      expect(rectInside(entry.body, entry.card)).toBe(true);
      expect(rectInside(entry.hole, entry.body)).toBe(true);
      expect(entry.openChannel).toHaveLength(16);
      expect(entry.openChannel.every((point) => pointInside(point, entry.body))).toBe(true);
      expect(rectInside(entry.thinStem, entry.card)).toBe(true);
      expect(entry.branch.every((point) => pointInside(point, entry.card))).toBe(true);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(rectInside(entry.guardedBlank, entry.card)).toBe(true);
      for (const contact of [entry.metalContact, entry.waterContact]) {
        expect(rectInside(contact.owner, entry.card)).toBe(true);
        expect(rectInside(contact.unlike, entry.card)).toBe(true);
        expect(contact.owner.x + contact.owner.width).toBe(contact.unlike.x);
        expect(rectanglesOverlap(contact.owner, contact.unlike)).toBe(false);
      }
      expect(entry.metalContact.unlikeMaterial).toBe(Material.Metal);
      expect(entry.waterContact.unlikeMaterial).toBe(Material.Water);
    }
    const [ligh, thdr] = ELECTRIC_DISCHARGE_GRAPHICS_ATLAS;
    expect(ligh.powderColumn).toBeUndefined();
    expect(thdr.powderColumn).toBeDefined();
    expect(thdr.powderBranch).toHaveLength(5);
    expect(thdr.powderGap).toBeDefined();
    expect(pointInside(thdr.powderGap!, thdr.powderColumn!)).toBe(true);
    expect(ELECTRIC_DISCHARGE_GRAPHICS_AUDIT.cards).toBe(ELECTRIC_DISCHARGE_GRAPHICS_ATLAS);
    expect(ELECTRIC_DISCHARGE_GRAPHICS_AUDIT.holes).toHaveLength(128);
    expect(ELECTRIC_DISCHARGE_GRAPHICS_AUDIT.openChannels).toHaveLength(32);
    expect(ELECTRIC_DISCHARGE_GRAPHICS_AUDIT.thunderPowderColumns).toHaveLength(1);
    expect(ELECTRIC_DISCHARGE_GRAPHICS_AUDIT.thunderPowderBranches).toHaveLength(5);
    expect(ELECTRIC_DISCHARGE_GRAPHICS_AUDIT.thunderPowderGaps).toHaveLength(1);
  });

  it('direct-fills discharge, topology, contacts, and THDR powder controls without paint', () => {
    const simulation = new PaintTrackingBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareElectricDischargeGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    for (const entry of ELECTRIC_DISCHARGE_GRAPHICS_ATLAS) {
      forEachPoint(entry.body, (point) => {
        const empty = pointInside(point, entry.hole) || entry.openChannel.some(samePoint(point));
        expect(cells[point.y * WORLD_WIDTH + point.x]).toBe(empty ? Material.Empty : entry.material);
      });
      forEachPoint(entry.thinStem, (point) => expect(cells[point.y * WORLD_WIDTH + point.x]).toBe(entry.material));
      for (const point of entry.branch) expect(cells[point.y * WORLD_WIDTH + point.x]).toBe(entry.material);
      expect(cells[entry.isolated.y * WORLD_WIDTH + entry.isolated.x]).toBe(entry.material);
      forEachPoint(entry.guardedBlank, (point) => expect(cells[point.y * WORLD_WIDTH + point.x]).toBe(Material.Empty));
      forEachPoint(entry.metalContact.owner, (point) => expect(cells[point.y * WORLD_WIDTH + point.x]).toBe(entry.material));
      forEachPoint(entry.metalContact.unlike, (point) => expect(cells[point.y * WORLD_WIDTH + point.x]).toBe(Material.Metal));
      forEachPoint(entry.waterContact.owner, (point) => expect(cells[point.y * WORLD_WIDTH + point.x]).toBe(entry.material));
      forEachPoint(entry.waterContact.unlike, (point) => expect(cells[point.y * WORLD_WIDTH + point.x]).toBe(Material.Water));
      forEachPoint(entry.powderColumn ?? { x: 0, y: 0, width: 0, height: 0 }, (point) => {
        expect(cells[point.y * WORLD_WIDTH + point.x]).toBe(samePoint(point)(entry.powderGap) ? Material.Empty : Material.THDR);
      });
      for (const point of entry.powderBranch ?? []) expect(cells[point.y * WORLD_WIDTH + point.x]).toBe(Material.THDR);
    }
    expect(simulation.paintCalls).toBe(0);
  });

  it('is byte-deterministic and rejects unsupported backends or world dimensions', () => {
    const first = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    const second = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareElectricDischargeGraphicsAuditFixture(first);
    prepareElectricDischargeGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());
    expect(() => prepareElectricDischargeGraphicsAuditFixture(new DeterministicBackend(32, 32)))
      .toThrow('requires 612x384');
    const wrongBackend = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    Object.defineProperty(wrongBackend, 'name', { value: 'not deterministic' });
    expect(() => prepareElectricDischargeGraphicsAuditFixture(wrongBackend))
      .toThrow('requires the deterministic backend');
  });
});

function samePoint(point: ElectricDischargeGraphicsPoint): (other: ElectricDischargeGraphicsPoint | undefined) => boolean {
  return (other) => other?.x === point.x && other.y === point.y;
}

function pointInside(point: ElectricDischargeGraphicsPoint, rect: ElectricDischargeGraphicsRect): boolean {
  return point.x >= rect.x && point.y >= rect.y && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

function rectInside(inner: ElectricDischargeGraphicsRect, outer: ElectricDischargeGraphicsRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(a: ElectricDischargeGraphicsRect, b: ElectricDischargeGraphicsRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function forEachPoint(rect: ElectricDischargeGraphicsRect, visit: (point: ElectricDischargeGraphicsPoint) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
