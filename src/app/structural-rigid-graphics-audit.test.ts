import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import {
  STRUCTURAL_RIGID_GRAPHICS_ATLAS,
  STRUCTURAL_RIGID_GRAPHICS_ATLAS_COLUMNS,
  STRUCTURAL_RIGID_GRAPHICS_ATLAS_ROWS,
  STRUCTURAL_RIGID_GRAPHICS_AUDIT,
  prepareStructuralRigidGraphicsAuditFixture,
  type StructuralRigidGraphicsPoint,
  type StructuralRigidGraphicsRect,
} from './structural-rigid-graphics-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const STRUCTURAL_RIGID_IDS = [
  Material.Brick, Material.Metal, Material.Ceramic, Material.BMTL,
  Material.GOLD, Material.IRON, Material.TTAN,
];

class PaintTrackingBackend extends DeterministicBackend {
  paintCalls = 0;

  override paint(cx: number, cy: number, material: Material, radius: number): void {
    this.paintCalls++;
    super.paint(cx, cy, material, radius);
  }
}

describe('structural rigid graphics audit fixture', () => {
  it('pins seven construction identities in a stable in-bounds atlas', () => {
    expect(STRUCTURAL_RIGID_GRAPHICS_ATLAS_COLUMNS).toBe(4);
    expect(STRUCTURAL_RIGID_GRAPHICS_ATLAS_ROWS).toBe(2);
    expect(STRUCTURAL_RIGID_GRAPHICS_ATLAS).toHaveLength(7);
    expect(STRUCTURAL_RIGID_GRAPHICS_ATLAS.map(({ material }) => material)).toEqual(STRUCTURAL_RIGID_IDS);
    expect(STRUCTURAL_RIGID_IDS).toEqual([22, 23, 25, 67, 70, 73, 82]);
    expect(STRUCTURAL_RIGID_GRAPHICS_ATLAS.map(({ code }) => code)).toEqual([
      'BRCK', 'METL', 'CRMC', 'BMTL', 'GOLD', 'IRON', 'TTAN',
    ]);

    for (const [index, entry] of STRUCTURAL_RIGID_GRAPHICS_ATLAS.entries()) {
      expect(entry.index).toBe(index);
      expect(entry.card).toEqual({
        x: 8 + (index % 4) * 150,
        y: 8 + Math.floor(index / 4) * 184,
        width: 140,
        height: 176,
      });
      expect(entry).toMatchObject({
        left: entry.card.x,
        top: entry.card.y,
        width: entry.card.width,
        height: entry.card.height,
      });
      expect(rectInside(entry.card, { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT })).toBe(true);
      expect(entry.body).toMatchObject({ width: 56, height: 56 });
      expect(rectInside(entry.body, entry.card)).toBe(true);
      expect(entry.hole).toMatchObject({ width: 6, height: 6 });
      expect(rectInside(entry.hole, entry.body)).toBe(true);
      expect(entry.openNotch).toHaveLength(3);
      expect(entry.openNotch.every((point) => point.x === entry.body.x + entry.body.width - 1)).toBe(true);
      expect(entry.openNotch.every((point) => pointInside(point, entry.body))).toBe(true);
      expect(rectInside(entry.shell.outer, entry.card)).toBe(true);
      expect(entry.shell.interior).toEqual({
        x: entry.shell.outer.x + 1,
        y: entry.shell.outer.y + 1,
        width: entry.shell.outer.width - 2,
        height: entry.shell.outer.height - 2,
      });
      expect(entry.spur).toMatchObject({ width: 1, height: 10, y: entry.body.y + entry.body.height });
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(rectInside(entry.guardedBlank, entry.card)).toBe(true);
      expect(rectanglesOverlap(entry.contact.owner, entry.contact.unlike)).toBe(false);
      expect(entry.contact.owner.x + entry.contact.owner.width).toBe(entry.contact.unlike.x);
      expect(entry.contact.unlikeMaterial).toBe(Material.Metal);
      if (entry.material !== Material.Metal) expect(entry.contact.unlikeMaterial).not.toBe(entry.material);
    }

    expect(STRUCTURAL_RIGID_GRAPHICS_AUDIT.cards).toBe(STRUCTURAL_RIGID_GRAPHICS_ATLAS);
    expect(STRUCTURAL_RIGID_GRAPHICS_AUDIT.holes).toHaveLength(7 * 36);
    expect(STRUCTURAL_RIGID_GRAPHICS_AUDIT.openNotches).toHaveLength(7 * 3);
    expect(STRUCTURAL_RIGID_GRAPHICS_AUDIT.shellCells).toHaveLength(7 * 76);
    expect(STRUCTURAL_RIGID_GRAPHICS_AUDIT.shellInteriors).toHaveLength(7 * 324);
    expect(STRUCTURAL_RIGID_GRAPHICS_AUDIT.spurs).toHaveLength(7 * 10);
    expect(STRUCTURAL_RIGID_GRAPHICS_AUDIT.isolated).toHaveLength(7);
    expect(STRUCTURAL_RIGID_GRAPHICS_AUDIT.guardedBlanks).toHaveLength(7);
    expect(STRUCTURAL_RIGID_GRAPHICS_AUDIT.contacts).toHaveLength(7);
  });

  it('direct-fills exact cavities, shells, fine structures, and contacts without paint', () => {
    const simulation = new PaintTrackingBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareStructuralRigidGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    let expectedOccupied = 0;

    for (const entry of STRUCTURAL_RIGID_GRAPHICS_ATLAS) {
      forEachPoint(entry.body, ({ x, y }) => {
        const hole = pointInside({ x, y }, entry.hole);
        const notch = entry.openNotch.some((point) => point.x === x && point.y === y);
        expect(cells[y * WORLD_WIDTH + x]).toBe(hole || notch ? Material.Empty : entry.material);
      });
      forEachPoint(entry.shell.outer, ({ x, y }) => {
        expect(cells[y * WORLD_WIDTH + x]).toBe(
          pointInside({ x, y }, entry.shell.interior) ? Material.Empty : entry.material,
        );
      });
      forEachPoint(entry.spur, ({ x, y }) => expect(cells[y * WORLD_WIDTH + x]).toBe(entry.material));
      expect(cells[entry.isolated.y * WORLD_WIDTH + entry.isolated.x]).toBe(entry.material);
      forEachPoint(entry.guardedBlank, ({ x, y }) => expect(cells[y * WORLD_WIDTH + x]).toBe(Material.Empty));
      forEachPoint(entry.contact.owner, ({ x, y }) => expect(cells[y * WORLD_WIDTH + x]).toBe(entry.material));
      forEachPoint(entry.contact.unlike, ({ x, y }) => expect(cells[y * WORLD_WIDTH + x]).toBe(Material.Metal));

      const shellCount = entry.shell.outer.width * entry.shell.outer.height
        - entry.shell.interior.width * entry.shell.interior.height;
      expectedOccupied += entry.body.width * entry.body.height - entry.hole.width * entry.hole.height
        - entry.openNotch.length + shellCount + entry.spur.width * entry.spur.height + 1
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
    prepareStructuralRigidGraphicsAuditFixture(first);
    prepareStructuralRigidGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());
    expect(() => prepareStructuralRigidGraphicsAuditFixture(new DeterministicBackend(32, 32)))
      .toThrow('requires 612x384');
    const wrongBackend = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    Object.defineProperty(wrongBackend, 'name', { value: 'not deterministic' });
    expect(() => prepareStructuralRigidGraphicsAuditFixture(wrongBackend))
      .toThrow('requires the deterministic backend');
  });
});

function pointInside(point: StructuralRigidGraphicsPoint, rect: StructuralRigidGraphicsRect): boolean {
  return point.x >= rect.x && point.y >= rect.y
    && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

function rectInside(inner: StructuralRigidGraphicsRect, outer: StructuralRigidGraphicsRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(a: StructuralRigidGraphicsRect, b: StructuralRigidGraphicsRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width
    && a.y < b.y + b.height && b.y < a.y + a.height;
}

function forEachPoint(
  rect: StructuralRigidGraphicsRect,
  visit: (point: StructuralRigidGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
