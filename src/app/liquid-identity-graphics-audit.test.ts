import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import {
  LIQUID_IDENTITY_GRAPHICS_ATLAS,
  LIQUID_IDENTITY_GRAPHICS_ATLAS_COLUMNS,
  LIQUID_IDENTITY_GRAPHICS_ATLAS_ROWS,
  LIQUID_IDENTITY_GRAPHICS_AUDIT,
  LIQUID_IDENTITY_GRAPHICS_DEFINITIONS,
  prepareLiquidIdentityGraphicsAuditFixture,
  type LiquidIdentityGraphicsPoint,
  type LiquidIdentityGraphicsRect,
} from './liquid-identity-graphics-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const LIQUID_IDS = [
  Material.Soap, Material.BIZR, Material.CBNW, Material.GEL,
  Material.GLOW, Material.VIRS, Material.FRZW, Material.RFGL,
];

class PaintTrackingBackend extends DeterministicBackend {
  paintCalls = 0;

  override paint(cx: number, cy: number, material: Material, radius: number): void {
    this.paintCalls++;
    super.paint(cx, cy, material, radius);
  }
}

describe('liquid identity graphics audit fixture', () => {
  it('pins exactly eight liquid identities in a stable in-bounds row', () => {
    expect(LIQUID_IDENTITY_GRAPHICS_ATLAS_COLUMNS).toBe(8);
    expect(LIQUID_IDENTITY_GRAPHICS_ATLAS_ROWS).toBe(1);
    expect(LIQUID_IDENTITY_GRAPHICS_DEFINITIONS).toHaveLength(8);
    expect(LIQUID_IDENTITY_GRAPHICS_ATLAS).toHaveLength(8);
    expect(LIQUID_IDENTITY_GRAPHICS_ATLAS.map(({ material }) => material)).toEqual(LIQUID_IDS);
    expect(LIQUID_IDS).toEqual([38, 54, 55, 56, 57, 62, 202, 207]);
    expect(LIQUID_IDENTITY_GRAPHICS_ATLAS.map(({ code }) => code)).toEqual([
      'SOAP', 'BIZR', 'CBNW', 'GEL', 'GLOW', 'VIRS', 'FRZW', 'RFGL',
    ]);

    const world = { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT };
    for (const [index, entry] of LIQUID_IDENTITY_GRAPHICS_ATLAS.entries()) {
      expect(entry.index).toBe(index);
      expect(entry.card).toEqual({ x: 4 + index * 76, y: 8, width: 72, height: 176 });
      expect(entry).toMatchObject({
        left: entry.card.x,
        top: entry.card.y,
        width: entry.card.width,
        height: entry.card.height,
      });
      expect(rectInside(entry.card, world)).toBe(true);
      expect(rectInside(entry.body, entry.card)).toBe(true);
      expect(entry.body).toMatchObject({ width: 42, height: 68 });
      expect(rectInside(entry.surfaceProbe, entry.body)).toBe(true);
      expect(rectInside(entry.coreProbe, entry.body)).toBe(true);
      expect(rectInside(entry.cavity, entry.body)).toBe(true);
      expect(entry.cavity).toMatchObject({ width: 6, height: 6 });
      expect(rectInside(entry.openChimney, entry.body)).toBe(true);
      expect(entry.openChimney.y).toBe(entry.body.y);
      expect(entry.openChimney.width).toBe(3);
      expect(rectanglesOverlap(entry.cavity, entry.openChimney)).toBe(false);
      expect(entry.strand.width).toBe(1);
      expect(entry.strand.y).toBe(entry.body.y + entry.body.height);
      expect(entry.strand.x).toBeGreaterThanOrEqual(entry.body.x);
      expect(entry.strand.x).toBeLessThan(entry.body.x + entry.body.width);
      expect(rectInside(entry.strand, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(rectInside(entry.guardedBlank, entry.card)).toBe(true);
      expect(rectanglesOverlap(entry.guardedBlank, entry.body)).toBe(false);
      verifyContact(entry.liquidContact.owner, entry.liquidContact.unlike, entry.card);
      verifyContact(entry.solidContact.owner, entry.solidContact.unlike, entry.card);
      expect(entry.liquidContact.unlikeMaterial).toBe(Material.Water);
      expect(entry.solidContact.unlikeMaterial).toBe(Material.Metal);
      expect(entry.liquidContact.unlikeMaterial).not.toBe(entry.material);
      expect(entry.solidContact.unlikeMaterial).not.toBe(entry.material);
    }

    expect(LIQUID_IDENTITY_GRAPHICS_AUDIT.cards).toBe(LIQUID_IDENTITY_GRAPHICS_ATLAS);
    expect(LIQUID_IDENTITY_GRAPHICS_AUDIT.cavities).toHaveLength(8 * 36);
    expect(LIQUID_IDENTITY_GRAPHICS_AUDIT.openChimneys).toHaveLength(8 * 90);
    expect(LIQUID_IDENTITY_GRAPHICS_AUDIT.strands).toHaveLength(8 * 12);
    expect(LIQUID_IDENTITY_GRAPHICS_AUDIT.isolated).toHaveLength(8);
    expect(LIQUID_IDENTITY_GRAPHICS_AUDIT.guardedBlanks).toHaveLength(8);
    expect(LIQUID_IDENTITY_GRAPHICS_AUDIT.liquidContacts).toHaveLength(8);
    expect(LIQUID_IDENTITY_GRAPHICS_AUDIT.solidContacts).toHaveLength(8);
  });

  it('direct-fills exact liquid topology and unlike contacts without paint', () => {
    const simulation = new PaintTrackingBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareLiquidIdentityGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    let expectedOccupied = 0;

    for (const entry of LIQUID_IDENTITY_GRAPHICS_ATLAS) {
      forEachPoint(entry.body, ({ x, y }) => {
        const isAir = pointInside({ x, y }, entry.cavity)
          || pointInside({ x, y }, entry.openChimney);
        expect(cells[y * WORLD_WIDTH + x]).toBe(isAir ? Material.Empty : entry.material);
      });
      forEachPoint(entry.cavity, ({ x, y }) => {
        expect(cells[y * WORLD_WIDTH + x]).toBe(Material.Empty);
      });
      forEachPoint(entry.openChimney, ({ x, y }) => {
        expect(cells[y * WORLD_WIDTH + x]).toBe(Material.Empty);
      });
      for (let y = entry.body.y - 1; y < entry.openChimney.y + entry.openChimney.height; y++) {
        const x = entry.openChimney.x + 1;
        expect(cells[y * WORLD_WIDTH + x]).toBe(Material.Empty);
      }
      forEachPoint(entry.strand, ({ x, y }) => {
        expect(cells[y * WORLD_WIDTH + x]).toBe(entry.material);
      });
      expect(cells[entry.isolated.y * WORLD_WIDTH + entry.isolated.x]).toBe(entry.material);
      forEachPoint(entry.guardedBlank, ({ x, y }) => {
        expect(cells[y * WORLD_WIDTH + x]).toBe(Material.Empty);
      });
      assertContactCells(cells, entry.liquidContact.owner, entry.material);
      assertContactCells(cells, entry.liquidContact.unlike, Material.Water);
      assertContactCells(cells, entry.solidContact.owner, entry.material);
      assertContactCells(cells, entry.solidContact.unlike, Material.Metal);

      expectedOccupied += entry.body.width * entry.body.height
        - entry.cavity.width * entry.cavity.height
        - entry.openChimney.width * entry.openChimney.height
        + entry.strand.width * entry.strand.height
        + 1
        + entry.liquidContact.owner.width * entry.liquidContact.owner.height
        + entry.liquidContact.unlike.width * entry.liquidContact.unlike.height
        + entry.solidContact.owner.width * entry.solidContact.owner.height
        + entry.solidContact.unlike.width * entry.solidContact.unlike.height;
    }

    expect(simulation.paintCalls).toBe(0);
    expect(cells.reduce((count, material) => count + Number(material !== Material.Empty), 0))
      .toBe(expectedOccupied);
  });

  it('is byte-deterministic and rejects the wrong backend or world geometry', () => {
    const first = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    const second = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareLiquidIdentityGraphicsAuditFixture(first);
    prepareLiquidIdentityGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());

    const firstPass = first.cells().slice();
    first.cells().fill(Material.Fire);
    prepareLiquidIdentityGraphicsAuditFixture(first);
    expect(first.cells()).toEqual(firstPass);

    expect(() => prepareLiquidIdentityGraphicsAuditFixture(new DeterministicBackend(32, 32)))
      .toThrow('requires 612x384');
    const wrongBackend = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    Object.defineProperty(wrongBackend, 'name', { value: 'not deterministic' });
    expect(() => prepareLiquidIdentityGraphicsAuditFixture(wrongBackend))
      .toThrow('requires the deterministic backend');
  });
});

function pointInside(point: LiquidIdentityGraphicsPoint, rect: LiquidIdentityGraphicsRect): boolean {
  return point.x >= rect.x && point.y >= rect.y
    && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

function rectInside(inner: LiquidIdentityGraphicsRect, outer: LiquidIdentityGraphicsRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(a: LiquidIdentityGraphicsRect, b: LiquidIdentityGraphicsRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width
    && a.y < b.y + b.height && b.y < a.y + a.height;
}

function verifyContact(
  owner: LiquidIdentityGraphicsRect,
  unlike: LiquidIdentityGraphicsRect,
  card: LiquidIdentityGraphicsRect,
): void {
  expect(rectInside(owner, card)).toBe(true);
  expect(rectInside(unlike, card)).toBe(true);
  expect(rectanglesOverlap(owner, unlike)).toBe(false);
  expect(owner.x + owner.width).toBe(unlike.x);
  expect(owner.y).toBe(unlike.y);
  expect(owner.height).toBe(unlike.height);
}

function assertContactCells(
  cells: Uint8Array,
  rect: LiquidIdentityGraphicsRect,
  material: Material,
): void {
  forEachPoint(rect, ({ x, y }) => {
    expect(cells[y * WORLD_WIDTH + x]).toBe(material);
  });
}

function forEachPoint(
  rect: LiquidIdentityGraphicsRect,
  visit: (point: LiquidIdentityGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
