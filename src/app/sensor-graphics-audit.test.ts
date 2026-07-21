import { describe, expect, it } from 'vitest';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { Material } from '../shared/materials';
import {
  SENSOR_GRAPHICS_ATLAS, SENSOR_GRAPHICS_ATLAS_COLUMNS, SENSOR_GRAPHICS_ATLAS_ROWS,
  SENSOR_GRAPHICS_AUDIT, prepareSensorGraphicsAuditFixture,
  type SensorGraphicsPoint, type SensorGraphicsRect,
} from './sensor-graphics-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const SENSOR_IDS = [
  Material.DTEC, Material.INVIS, Material.LDTC, Material.LSNS,
  Material.PSNS, Material.TSNS, Material.VSNS,
];

class PaintTrackingBackend extends DeterministicBackend {
  paintCalls = 0;

  override paint(cx: number, cy: number, material: Material, radius: number): void {
    this.paintCalls++;
    super.paint(cx, cy, material, radius);
  }
}

describe('sensor graphics audit fixture', () => {
  it('lays out all seven sensor identities in a stable in-bounds atlas', () => {
    expect(SENSOR_GRAPHICS_ATLAS_COLUMNS).toBe(7);
    expect(SENSOR_GRAPHICS_ATLAS_ROWS).toBe(1);
    expect(SENSOR_GRAPHICS_ATLAS).toHaveLength(7);
    expect(SENSOR_GRAPHICS_ATLAS.map(({ material }) => material)).toEqual(SENSOR_IDS);
    expect(SENSOR_GRAPHICS_ATLAS.map(({ code }) => code)).toEqual([
      'DTEC', 'INVS', 'LDTC', 'LSNS', 'PSNS', 'TSNS', 'VSNS',
    ]);

    for (const entry of SENSOR_GRAPHICS_ATLAS) {
      expect(entry).toMatchObject({
        left: entry.card.x, top: entry.card.y,
        width: entry.card.width, height: entry.card.height,
      });
      expect(rectInside(entry.card, { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT })).toBe(true);
      expect(rectInside(entry.body, entry.card)).toBe(true);
      expect(entry.openNotch).toHaveLength(3);
      expect(entry.openNotch.every((point) => pointInside(point, entry.body))).toBe(true);
      expect(entry.openNotch.some(({ x }) => x === entry.body.x + entry.body.width - 1)).toBe(true);
      expect(entry.wire.width).toBe(1);
      expect(rectInside(entry.wire, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(rectInside(entry.guardedBlank, entry.card)).toBe(true);
    }

    expect(SENSOR_GRAPHICS_AUDIT.cards).toBe(SENSOR_GRAPHICS_ATLAS);
    expect(SENSOR_GRAPHICS_AUDIT.openNotches).toHaveLength(7 * 3);
    expect(SENSOR_GRAPHICS_AUDIT.wires).toHaveLength(7 * 16);
    expect(SENSOR_GRAPHICS_AUDIT.isolated).toHaveLength(7);
    expect(SENSOR_GRAPHICS_AUDIT.guardedBlanks).toHaveLength(7);
  });

  it('direct-fills each topology without invoking the ordinary brush path', () => {
    const simulation = new PaintTrackingBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareSensorGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    let expectedOccupied = 0;

    for (const entry of SENSOR_GRAPHICS_ATLAS) {
      forEachPoint(entry.body, ({ x, y }) => {
        const inNotch = entry.openNotch.some((point) => point.x === x && point.y === y);
        expect(cells[y * WORLD_WIDTH + x]).toBe(inNotch ? Material.Empty : entry.material);
      });
      forEachPoint(entry.wire, ({ x, y }) => {
        expect(cells[y * WORLD_WIDTH + x]).toBe(entry.material);
      });
      expect(cells[entry.isolated.y * WORLD_WIDTH + entry.isolated.x]).toBe(entry.material);
      forEachPoint(entry.guardedBlank, ({ x, y }) => {
        expect(cells[y * WORLD_WIDTH + x]).toBe(Material.Empty);
      });
      expectedOccupied += entry.body.width * entry.body.height
        - entry.openNotch.length + entry.wire.width * entry.wire.height + 1;
    }

    expect(simulation.paintCalls).toBe(0);
    expect(cells.reduce((count, material) => count + Number(material !== Material.Empty), 0))
      .toBe(expectedOccupied);
  });

  it('is deterministic and rejects noncanonical world geometry', () => {
    const first = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    const second = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareSensorGraphicsAuditFixture(first);
    prepareSensorGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());
    expect(() => prepareSensorGraphicsAuditFixture(new DeterministicBackend(32, 32)))
      .toThrow('requires 612x384');
  });
});

function pointInside(point: SensorGraphicsPoint, rect: SensorGraphicsRect): boolean {
  return point.x >= rect.x && point.y >= rect.y
    && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

function rectInside(inner: SensorGraphicsRect, outer: SensorGraphicsRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function forEachPoint(rect: SensorGraphicsRect, visit: (point: SensorGraphicsPoint) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
