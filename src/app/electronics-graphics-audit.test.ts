import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import {
  ELECTRONICS_GRAPHICS_ATLAS,
  ELECTRONICS_GRAPHICS_ATLAS_COLUMNS,
  ELECTRONICS_GRAPHICS_ATLAS_ROWS,
  ELECTRONICS_GRAPHICS_AUDIT,
  prepareElectronicsGraphicsAuditFixture,
  type ElectronicsGraphicsPoint,
  type ElectronicsGraphicsRect,
} from './electronics-graphics-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const ELECTRONICS_IDS = [
  Material.ARAY, Material.BTRY, Material.DRAY, Material.EMP, Material.ETRD,
  Material.INSL, Material.INST, Material.INWR, Material.NSCN, Material.NTCT,
  Material.PSCN, Material.PTCT, Material.SWCH, Material.TESC, Material.TUNG,
  Material.WIFI, Material.WIRE, Material.DLAY, Material.HSWC, Material.LCRY,
];

class PaintTrackingBackend extends DeterministicBackend {
  paintCalls = 0;

  override paint(cx: number, cy: number, material: Material, radius: number): void {
    this.paintCalls++;
    super.paint(cx, cy, material, radius);
  }
}

describe('electronics graphics audit fixture', () => {
  it('pins all passive and active electronics identities in a compact in-bounds 5x4 atlas', () => {
    expect(ELECTRONICS_GRAPHICS_ATLAS_COLUMNS).toBe(5);
    expect(ELECTRONICS_GRAPHICS_ATLAS_ROWS).toBe(4);
    expect(ELECTRONICS_GRAPHICS_ATLAS).toHaveLength(20);
    expect(ELECTRONICS_GRAPHICS_ATLAS.map(({ material }) => material)).toEqual(ELECTRONICS_IDS);
    expect(ELECTRONICS_IDS).toEqual([
      135, 136, 138, 139, 140, 141, 142, 143, 144, 145,
      146, 147, 149, 150, 151, 152, 153, 154, 156, 157,
    ]);
    expect(ELECTRONICS_GRAPHICS_ATLAS.map(({ code }) => code)).toEqual([
      'ARAY', 'BTRY', 'DRAY', 'EMP', 'ETRD', 'INSL', 'INST', 'INWR', 'NSCN', 'NTCT',
      'PSCN', 'PTCT', 'SWCH', 'TESC', 'TUNG', 'WIFI', 'WIRE', 'DLAY', 'HSWC', 'LCRY',
    ]);

    for (const [index, entry] of ELECTRONICS_GRAPHICS_ATLAS.entries()) {
      expect(entry.index).toBe(index);
      expect(entry.card).toEqual({
        x: 8 + (index % 5) * 120,
        y: 4 + Math.floor(index / 5) * 94,
        width: 112,
        height: 88,
      });
      expect(entry).toMatchObject({
        left: entry.card.x,
        top: entry.card.y,
        width: entry.card.width,
        height: entry.card.height,
      });
      expect(rectInside(entry.card, { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT })).toBe(true);
      expect(rectInside(entry.body, entry.card)).toBe(true);
      expect(rectInside(entry.pairedBody, entry.card)).toBe(true);
      expect(rectanglesOverlap(entry.body, entry.pairedBody)).toBe(false);
      expect(entry.authoredHole).toMatchObject({ width: 4, height: 4 });
      expect(rectInside(entry.authoredHole, entry.body)).toBe(true);
      expect(rectInside(entry.openChannel, entry.body)).toBe(true);
      expect(entry.openChannel.x + entry.openChannel.width).toBe(entry.body.x + entry.body.width);
      expect(entry.thinRail).toMatchObject({ width: 1, height: 28 });
      expect(rectInside(entry.thinRail, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(rectInside(entry.guardedBlank, entry.card)).toBe(true);
      expect(rectanglesOverlap(entry.metalContact.owner, entry.metalContact.metal)).toBe(false);
      expect(entry.metalContact.owner.x + entry.metalContact.owner.width).toBe(entry.metalContact.metal.x);
      expect(entry.metalContact.material).toBe(Material.Metal);
      for (const control of Object.values(entry.controls)) expect(rectInside(control, entry.card)).toBe(true);
    }

    expect(ELECTRONICS_GRAPHICS_AUDIT.cards).toBe(ELECTRONICS_GRAPHICS_ATLAS);
    expect(ELECTRONICS_GRAPHICS_AUDIT.bodies).toHaveLength(20);
    expect(ELECTRONICS_GRAPHICS_AUDIT.pairedBodies).toHaveLength(20);
    expect(ELECTRONICS_GRAPHICS_AUDIT.authoredHoles).toHaveLength(20 * 16);
    expect(ELECTRONICS_GRAPHICS_AUDIT.openChannels).toHaveLength(20 * 20);
    expect(ELECTRONICS_GRAPHICS_AUDIT.thinRails).toHaveLength(20 * 28);
    expect(ELECTRONICS_GRAPHICS_AUDIT.isolated).toHaveLength(20);
    expect(ELECTRONICS_GRAPHICS_AUDIT.guardedBlanks).toHaveLength(20);
    expect(ELECTRONICS_GRAPHICS_AUDIT.metalContacts).toHaveLength(20);
    expect(ELECTRONICS_GRAPHICS_AUDIT.controls).toHaveLength(20);
  });

  it('direct-fills exact ownership, protected topology, and semantic no-op controls without paint', () => {
    const simulation = new PaintTrackingBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareElectronicsGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    let expectedOccupied = 0;

    for (const entry of ELECTRONICS_GRAPHICS_ATLAS) {
      forEachPoint(entry.body, ({ x, y }) => {
        const empty = pointInside({ x, y }, entry.authoredHole)
          || pointInside({ x, y }, entry.openChannel);
        expect(cells[y * WORLD_WIDTH + x]).toBe(empty ? Material.Empty : entry.material);
      });
      forEachPoint(entry.pairedBody, ({ x, y }) => expect(cells[y * WORLD_WIDTH + x]).toBe(entry.material));
      forEachPoint(entry.authoredHole, ({ x, y }) => expect(cells[y * WORLD_WIDTH + x]).toBe(Material.Empty));
      forEachPoint(entry.openChannel, ({ x, y }) => {
        expect(cells[y * WORLD_WIDTH + x]).toBe(Material.Empty);
        expect(cells[y * WORLD_WIDTH + x + 1]).toBe(Material.Empty);
      });
      forEachPoint(entry.thinRail, ({ x, y }) => expect(cells[y * WORLD_WIDTH + x]).toBe(entry.material));
      expect(cells[entry.isolated.y * WORLD_WIDTH + entry.isolated.x]).toBe(entry.material);
      forEachPoint(entry.guardedBlank, ({ x, y }) => expect(cells[y * WORLD_WIDTH + x]).toBe(Material.Empty));
      forEachPoint(entry.metalContact.owner, ({ x, y }) => expect(cells[y * WORLD_WIDTH + x]).toBe(entry.material));
      forEachPoint(entry.metalContact.metal, ({ x, y }) => expect(cells[y * WORLD_WIDTH + x]).toBe(Material.Metal));
      forEachPoint(entry.controls.cray, ({ x, y }) => expect(cells[y * WORLD_WIDTH + x]).toBe(Material.CRAY));
      forEachPoint(entry.controls.pcln, ({ x, y }) => expect(cells[y * WORLD_WIDTH + x]).toBe(Material.PCLN));
      forEachPoint(entry.controls.pipe, ({ x, y }) => expect(cells[y * WORLD_WIDTH + x]).toBe(Material.PIPE));
      forEachPoint(entry.controls.spark, ({ x, y }) => expect(cells[y * WORLD_WIDTH + x]).toBe(Material.SPRK));

      expectedOccupied += entry.body.width * entry.body.height
        - entry.authoredHole.width * entry.authoredHole.height
        - entry.openChannel.width * entry.openChannel.height
        + entry.pairedBody.width * entry.pairedBody.height
        + entry.thinRail.width * entry.thinRail.height
        + 1
        + entry.metalContact.owner.width * entry.metalContact.owner.height
        + entry.metalContact.metal.width * entry.metalContact.metal.height
        + entry.controls.cray.width * entry.controls.cray.height
        + entry.controls.pcln.width * entry.controls.pcln.height
        + entry.controls.pipe.width * entry.controls.pipe.height
        + entry.controls.spark.width * entry.controls.spark.height;
    }

    expect(simulation.paintCalls).toBe(0);
    expect(cells.reduce((count, material) => count + Number(material !== Material.Empty), 0))
      .toBe(expectedOccupied);
  });

  it('is byte-deterministic and rejects incompatible backends or geometry', () => {
    const first = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    const second = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareElectronicsGraphicsAuditFixture(first);
    prepareElectronicsGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());
    expect(() => prepareElectronicsGraphicsAuditFixture(new DeterministicBackend(32, 32)))
      .toThrow('requires 612x384');
    const wrongBackend = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    Object.defineProperty(wrongBackend, 'name', { value: 'not deterministic' });
    expect(() => prepareElectronicsGraphicsAuditFixture(wrongBackend))
      .toThrow('requires the deterministic backend');
  });
});

function pointInside(point: ElectronicsGraphicsPoint, rect: ElectronicsGraphicsRect): boolean {
  return point.x >= rect.x && point.y >= rect.y
    && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

function rectInside(inner: ElectronicsGraphicsRect, outer: ElectronicsGraphicsRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(a: ElectronicsGraphicsRect, b: ElectronicsGraphicsRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width
    && a.y < b.y + b.height && b.y < a.y + a.height;
}

function forEachPoint(
  rect: ElectronicsGraphicsRect,
  visit: (point: ElectronicsGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
