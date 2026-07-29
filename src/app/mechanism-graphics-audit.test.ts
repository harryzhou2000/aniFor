import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import {
  MECHANISM_GRAPHICS_ATLAS,
  MECHANISM_GRAPHICS_ATLAS_COLUMNS,
  MECHANISM_GRAPHICS_ATLAS_ROWS,
  MECHANISM_GRAPHICS_AUDIT,
  prepareMechanismGraphicsAuditFixture,
  type MechanismGraphicsPoint,
  type MechanismGraphicsRect,
} from './mechanism-graphics-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const MECHANISM_IDS = [
  Material.PIPE, Material.PPIP, Material.GPMP, Material.PUMP, Material.PSTN,
  Material.FRME, Material.RPEL, Material.PVOD, Material.STOR, Material.DMG,
];

class PaintTrackingBackend extends DeterministicBackend {
  paintCalls = 0;

  override paint(cx: number, cy: number, material: Material, radius: number): void {
    this.paintCalls++;
    super.paint(cx, cy, material, radius);
  }
}

describe('mechanism graphics audit fixture', () => {
  it('pins the ten force/powered transport identities in a stable in-bounds 5x2 atlas', () => {
    expect(MECHANISM_GRAPHICS_ATLAS_COLUMNS).toBe(5);
    expect(MECHANISM_GRAPHICS_ATLAS_ROWS).toBe(2);
    expect(MECHANISM_GRAPHICS_ATLAS).toHaveLength(10);
    expect(MECHANISM_GRAPHICS_ATLAS.map(({ material }) => material)).toEqual(MECHANISM_IDS);
    expect(MECHANISM_IDS).toEqual([121, 160, 155, 161, 122, 119, 123, 162, 163, 117]);
    expect(MECHANISM_GRAPHICS_ATLAS.map(({ code }) => code)).toEqual([
      'PIPE', 'PPIP', 'GPMP', 'PUMP', 'PSTN', 'FRME', 'RPEL', 'PVOD', 'STOR', 'DMG',
    ]);

    for (const [index, entry] of MECHANISM_GRAPHICS_ATLAS.entries()) {
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
      expect(rectInside(entry.pairedBody, entry.card)).toBe(true);
      expect(rectanglesOverlap(entry.body, entry.pairedBody)).toBe(false);
      expect(entry.authoredHole).toMatchObject({ width: 6, height: 6 });
      expect(rectInside(entry.authoredHole, entry.body)).toBe(true);
      expect(rectInside(entry.openChannel, entry.body)).toBe(true);
      expect(entry.openChannel.x + entry.openChannel.width).toBe(entry.body.x + entry.body.width);
      expect(entry.thinRail).toMatchObject({ width: 1, height: 44 });
      expect(rectInside(entry.thinRail, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(rectInside(entry.guardedBlank, entry.card)).toBe(true);
      expect(rectanglesOverlap(entry.metalContact.owner, entry.metalContact.metal)).toBe(false);
      expect(entry.metalContact.owner.x + entry.metalContact.owner.width).toBe(entry.metalContact.metal.x);
      expect(entry.metalContact.owner.y).toBe(entry.metalContact.metal.y);
      expect(entry.metalContact.owner.height).toBe(entry.metalContact.metal.height);
      expect(entry.metalContact.material).toBe(Material.Metal);
    }

    expect(MECHANISM_GRAPHICS_AUDIT.cards).toBe(MECHANISM_GRAPHICS_ATLAS);
    expect(MECHANISM_GRAPHICS_AUDIT.bodies).toHaveLength(10);
    expect(MECHANISM_GRAPHICS_AUDIT.pairedBodies).toHaveLength(10);
    expect(MECHANISM_GRAPHICS_AUDIT.authoredHoles).toHaveLength(10 * 36);
    expect(MECHANISM_GRAPHICS_AUDIT.openChannels).toHaveLength(10 * 40);
    expect(MECHANISM_GRAPHICS_AUDIT.thinRails).toHaveLength(10 * 44);
    expect(MECHANISM_GRAPHICS_AUDIT.isolated).toHaveLength(10);
    expect(MECHANISM_GRAPHICS_AUDIT.guardedBlanks).toHaveLength(10);
    expect(MECHANISM_GRAPHICS_AUDIT.metalContacts).toHaveLength(10);
  });

  it('direct-fills exact mechanism ownership and protected topology without paint', () => {
    const simulation = new PaintTrackingBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareMechanismGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    let expectedOccupied = 0;

    for (const entry of MECHANISM_GRAPHICS_ATLAS) {
      forEachPoint(entry.body, ({ x, y }) => {
        const empty = pointInside({ x, y }, entry.authoredHole)
          || pointInside({ x, y }, entry.openChannel);
        expect(cells[y * WORLD_WIDTH + x]).toBe(empty ? Material.Empty : entry.material);
      });
      forEachPoint(entry.pairedBody, ({ x, y }) => {
        expect(cells[y * WORLD_WIDTH + x]).toBe(entry.material);
      });
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

      expectedOccupied += entry.body.width * entry.body.height
        - entry.authoredHole.width * entry.authoredHole.height
        - entry.openChannel.width * entry.openChannel.height
        + entry.pairedBody.width * entry.pairedBody.height
        + entry.thinRail.width * entry.thinRail.height
        + 1
        + entry.metalContact.owner.width * entry.metalContact.owner.height
        + entry.metalContact.metal.width * entry.metalContact.metal.height;
    }

    expect(simulation.paintCalls).toBe(0);
    expect(cells.reduce((count, material) => count + Number(material !== Material.Empty), 0))
      .toBe(expectedOccupied);
  });

  it('is byte-deterministic and rejects incompatible backend geometry', () => {
    const first = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    const second = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareMechanismGraphicsAuditFixture(first);
    prepareMechanismGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());
    expect(() => prepareMechanismGraphicsAuditFixture(new DeterministicBackend(32, 32)))
      .toThrow('requires 612x384');
    const wrongBackend = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    Object.defineProperty(wrongBackend, 'name', { value: 'not deterministic' });
    expect(() => prepareMechanismGraphicsAuditFixture(wrongBackend))
      .toThrow('requires the deterministic backend');
  });
});

function pointInside(point: MechanismGraphicsPoint, rect: MechanismGraphicsRect): boolean {
  return point.x >= rect.x && point.y >= rect.y
    && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

function rectInside(inner: MechanismGraphicsRect, outer: MechanismGraphicsRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(a: MechanismGraphicsRect, b: MechanismGraphicsRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width
    && a.y < b.y + b.height && b.y < a.y + a.height;
}

function forEachPoint(
  rect: MechanismGraphicsRect,
  visit: (point: MechanismGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
