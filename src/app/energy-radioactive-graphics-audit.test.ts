import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material, NATIVE_PROJECTIONS } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import {
  ENERGY_RADIOACTIVE_GRAPHICS_ATLAS,
  ENERGY_RADIOACTIVE_GRAPHICS_ATLAS_COLUMNS,
  ENERGY_RADIOACTIVE_GRAPHICS_ATLAS_ROWS,
  ENERGY_RADIOACTIVE_GRAPHICS_AUDIT,
  ENERGY_RADIOACTIVE_GRAPHICS_DEFINITIONS,
  prepareEnergyRadioactiveGraphicsAuditFixture,
  type EnergyRadioactiveGraphicsPoint,
  type EnergyRadioactiveGraphicsRect,
} from './energy-radioactive-graphics-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const ENERGY_RADIOACTIVE_IDS = [
  Material.Fire, Material.Plasma, Material.ELEC, Material.GRVT, Material.NEUT,
  Material.PHOT, Material.PROT, Material.BRAY, Material.EMBR, Material.AMTR,
  Material.BVBR, Material.DEUT, Material.EXOT, Material.ISOZ, Material.ISZS,
  Material.PLUT, Material.POLO, Material.SING, Material.URAN, Material.VIBR,
  Material.WARP,
];

class PaintTrackingBackend extends DeterministicBackend {
  paintCalls = 0;

  override paint(cx: number, cy: number, material: Material, radius: number): void {
    this.paintCalls++;
    super.paint(cx, cy, material, radius);
  }
}

describe('energy/radioactive graphics audit fixture', () => {
  it('pins the complete exact Energy-phase and Radioactive-family catalog', () => {
    expect(ENERGY_RADIOACTIVE_GRAPHICS_ATLAS_COLUMNS).toBe(7);
    expect(ENERGY_RADIOACTIVE_GRAPHICS_ATLAS_ROWS).toBe(3);
    expect(ENERGY_RADIOACTIVE_GRAPHICS_DEFINITIONS).toHaveLength(21);
    expect(ENERGY_RADIOACTIVE_GRAPHICS_ATLAS).toHaveLength(21);
    expect(ENERGY_RADIOACTIVE_GRAPHICS_ATLAS.map(({ material }) => material))
      .toEqual(ENERGY_RADIOACTIVE_IDS);
    expect(ENERGY_RADIOACTIVE_IDS).toEqual([
      4, 20, 101, 103, 106, 107, 110, 197, 200, 98, 99, 100, 102, 104, 105,
      108, 109, 111, 112, 113, 114,
    ]);
    expect(ENERGY_RADIOACTIVE_GRAPHICS_ATLAS.map(({ code }) => code)).toEqual([
      'FIRE', 'PLSM', 'ELEC', 'GRVT', 'NEUT', 'PHOT', 'PROT', 'BRAY', 'EMBR',
      'AMTR', 'BVBR', 'DEUT', 'EXOT', 'ISOZ', 'ISZS', 'PLUT', 'POLO', 'SING',
      'URAN', 'VIBR', 'WARP',
    ]);

    const authoritative = ALL_MATERIALS.filter(({ category, phase }) => (
      category === 'energy' || category === 'radioactive' || phase === 'energy'
    ));
    expect([...authoritative.map(({ id }) => id)].sort((a, b) => a - b))
      .toEqual([...ENERGY_RADIOACTIVE_IDS].sort((a, b) => a - b));
    for (const definition of ENERGY_RADIOACTIVE_GRAPHICS_DEFINITIONS) {
      const material = authoritative.find(({ id }) => id === definition.material);
      expect(material, definition.code).toBeDefined();
      expect(definition.color).toBe(material?.color);
      expect(definition.family).toBe(material?.category === 'radioactive' ? 'radioactive' : 'energy');
      const expectedPhase = material?.phase ?? (material?.category === 'energy' ? 'energy' : 'solid');
      expect(definition.phase).toBe(expectedPhase);
    }

    expect(ENERGY_RADIOACTIVE_GRAPHICS_AUDIT.energyCards).toHaveLength(9);
    expect(ENERGY_RADIOACTIVE_GRAPHICS_AUDIT.radioactiveCards).toHaveLength(17);
    expect(ENERGY_RADIOACTIVE_GRAPHICS_AUDIT.nativeProductCards.map(({ code }) => code))
      .toEqual(['BRAY', 'EMBR']);
    expect(NATIVE_PROJECTIONS.filter(({ id }) => (
      id === Material.BRAY || id === Material.EMBR
    )).map(({ selectable }) => selectable)).toEqual([false, false]);
  });

  it('keeps every card, fine void, carrier, and unlike contact disjoint and in bounds', () => {
    const world = { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT };
    for (const [index, entry] of ENERGY_RADIOACTIVE_GRAPHICS_ATLAS.entries()) {
      const column = index % ENERGY_RADIOACTIVE_GRAPHICS_ATLAS_COLUMNS;
      const row = Math.floor(index / ENERGY_RADIOACTIVE_GRAPHICS_ATLAS_COLUMNS);
      expect(entry.index).toBe(index);
      expect(entry.card).toEqual({ x: 4 + column * 86, y: 4 + row * 126, width: 82, height: 122 });
      expect(entry).toMatchObject({
        left: entry.card.x,
        top: entry.card.y,
        width: entry.card.width,
        height: entry.card.height,
      });
      expect(rectInside(entry.card, world)).toBe(true);
      expect(rectInside(entry.body, entry.card)).toBe(true);
      expect(entry.body).toMatchObject({ width: 34, height: 36 });
      expect(rectInside(entry.surfaceProbe, entry.body)).toBe(true);
      expect(rectInside(entry.coreProbe, entry.body)).toBe(true);
      expect(rectInside(entry.authoredHole, entry.body)).toBe(true);
      expect(entry.authoredHole).toMatchObject({ width: 4, height: 4 });
      expect(rectInside(entry.openChannel, entry.body)).toBe(true);
      expect(entry.openChannel.y).toBe(entry.body.y);
      expect(entry.openChannel).toMatchObject({ width: 2, height: 16 });
      expect(entry.openChannel.y + entry.openChannel.height).toBe(entry.authoredHole.y);
      expect(rectanglesOverlap(entry.openChannel, entry.authoredHole)).toBe(false);
      expect(rectanglesOverlap(entry.surfaceProbe, entry.authoredHole)).toBe(false);
      expect(rectanglesOverlap(entry.surfaceProbe, entry.openChannel)).toBe(false);
      expect(rectanglesOverlap(entry.coreProbe, entry.authoredHole)).toBe(false);
      expect(rectanglesOverlap(entry.coreProbe, entry.openChannel)).toBe(false);

      expect(entry.sparseCarriers).toHaveLength(8);
      expect(new Set(entry.sparseCarriers.map(({ x, y }) => `${x},${y}`)).size).toBe(8);
      for (const point of entry.sparseCarriers) {
        expect(pointInside(point, entry.card)).toBe(true);
        expect(pointInside(point, entry.body)).toBe(false);
        expect(pointInside(point, entry.carrierGap)).toBe(false);
      }
      expect(rectInside(entry.carrierGap, entry.card)).toBe(true);
      expect(rectanglesOverlap(entry.carrierGap, entry.body)).toBe(false);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.body)).toBe(false);
      expect(entry.sparseCarriers).not.toContainEqual(entry.isolated);
      expect(rectInside(entry.guardedBlank, entry.card)).toBe(true);
      expect(rectanglesOverlap(entry.guardedBlank, entry.body)).toBe(false);
      expect(pointInside(entry.isolated, entry.guardedBlank)).toBe(false);
      for (const point of entry.sparseCarriers) {
        expect(pointInside(point, entry.guardedBlank)).toBe(false);
      }

      verifyContact(entry.liquidContact.owner, entry.liquidContact.unlike, entry.card);
      verifyContact(entry.solidContact.owner, entry.solidContact.unlike, entry.card);
      expect(entry.liquidContact.unlikeMaterial).toBe(Material.Water);
      expect(entry.solidContact.unlikeMaterial).toBe(Material.Metal);
      expect(entry.liquidContact.unlikeMaterial).not.toBe(entry.material);
      expect(entry.solidContact.unlikeMaterial).not.toBe(entry.material);
      expect(rectanglesOverlap(entry.liquidContact.owner, entry.solidContact.owner)).toBe(false);
      expect(rectanglesOverlap(entry.liquidContact.unlike, entry.solidContact.unlike)).toBe(false);
    }

    for (let left = 0; left < ENERGY_RADIOACTIVE_GRAPHICS_ATLAS.length; left++) {
      for (let right = left + 1; right < ENERGY_RADIOACTIVE_GRAPHICS_ATLAS.length; right++) {
        expect(rectanglesOverlap(
          ENERGY_RADIOACTIVE_GRAPHICS_ATLAS[left].card,
          ENERGY_RADIOACTIVE_GRAPHICS_ATLAS[right].card,
        )).toBe(false);
      }
    }

    expect(ENERGY_RADIOACTIVE_GRAPHICS_AUDIT.cards).toBe(ENERGY_RADIOACTIVE_GRAPHICS_ATLAS);
    expect(ENERGY_RADIOACTIVE_GRAPHICS_AUDIT.authoredHoles).toHaveLength(21 * 16);
    expect(ENERGY_RADIOACTIVE_GRAPHICS_AUDIT.openChannels).toHaveLength(21 * 32);
    expect(ENERGY_RADIOACTIVE_GRAPHICS_AUDIT.sparseCarriers).toHaveLength(21 * 8);
    expect(ENERGY_RADIOACTIVE_GRAPHICS_AUDIT.carrierGaps).toHaveLength(21);
    expect(ENERGY_RADIOACTIVE_GRAPHICS_AUDIT.isolated).toHaveLength(21);
    expect(ENERGY_RADIOACTIVE_GRAPHICS_AUDIT.guardedBlanks).toHaveLength(21);
    expect(ENERGY_RADIOACTIVE_GRAPHICS_AUDIT.liquidContacts).toHaveLength(21);
    expect(ENERGY_RADIOACTIVE_GRAPHICS_AUDIT.solidContacts).toHaveLength(21);
  });

  it('direct-fills exact dense, sparse, void, and non-target contact ownership without paint', () => {
    const simulation = new PaintTrackingBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareEnergyRadioactiveGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    let expectedOccupied = 0;

    for (const entry of ENERGY_RADIOACTIVE_GRAPHICS_ATLAS) {
      forEachPoint(entry.body, ({ x, y }) => {
        const isAir = pointInside({ x, y }, entry.authoredHole)
          || pointInside({ x, y }, entry.openChannel);
        expect(cells[y * WORLD_WIDTH + x]).toBe(isAir ? Material.Empty : entry.material);
      });
      assertRectCells(cells, entry.authoredHole, Material.Empty);
      assertRectCells(cells, entry.openChannel, Material.Empty);
      for (let y = entry.body.y - 1; y < entry.authoredHole.y + entry.authoredHole.height; y++) {
        const x = entry.openChannel.x;
        expect(cells[y * WORLD_WIDTH + x]).toBe(Material.Empty);
      }
      for (const { x, y } of entry.sparseCarriers) {
        expect(cells[y * WORLD_WIDTH + x]).toBe(entry.material);
      }
      assertRectCells(cells, entry.carrierGap, Material.Empty);
      expect(cells[entry.isolated.y * WORLD_WIDTH + entry.isolated.x]).toBe(entry.material);
      assertRectCells(cells, entry.guardedBlank, Material.Empty);
      assertRectCells(cells, entry.liquidContact.owner, entry.material);
      assertRectCells(cells, entry.liquidContact.unlike, Material.Water);
      assertRectCells(cells, entry.solidContact.owner, entry.material);
      assertRectCells(cells, entry.solidContact.unlike, Material.Metal);

      expectedOccupied += entry.body.width * entry.body.height
        - entry.authoredHole.width * entry.authoredHole.height
        - entry.openChannel.width * entry.openChannel.height
        + entry.sparseCarriers.length
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
    prepareEnergyRadioactiveGraphicsAuditFixture(first);
    prepareEnergyRadioactiveGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());

    const firstPass = first.cells().slice();
    first.cells().fill(Material.Fire);
    prepareEnergyRadioactiveGraphicsAuditFixture(first);
    expect(first.cells()).toEqual(firstPass);

    expect(() => prepareEnergyRadioactiveGraphicsAuditFixture(new DeterministicBackend(32, 32)))
      .toThrow('requires 612x384');
    const wrongBackend = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    Object.defineProperty(wrongBackend, 'name', { value: 'not deterministic' });
    expect(() => prepareEnergyRadioactiveGraphicsAuditFixture(wrongBackend))
      .toThrow('requires the deterministic backend');
  });
});

function pointInside(
  point: EnergyRadioactiveGraphicsPoint,
  rect: EnergyRadioactiveGraphicsRect,
): boolean {
  return point.x >= rect.x && point.y >= rect.y
    && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

function rectInside(
  inner: EnergyRadioactiveGraphicsRect,
  outer: EnergyRadioactiveGraphicsRect,
): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(
  a: EnergyRadioactiveGraphicsRect,
  b: EnergyRadioactiveGraphicsRect,
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width
    && a.y < b.y + b.height && b.y < a.y + a.height;
}

function verifyContact(
  owner: EnergyRadioactiveGraphicsRect,
  unlike: EnergyRadioactiveGraphicsRect,
  card: EnergyRadioactiveGraphicsRect,
): void {
  expect(rectInside(owner, card)).toBe(true);
  expect(rectInside(unlike, card)).toBe(true);
  expect(rectanglesOverlap(owner, unlike)).toBe(false);
  expect(owner.x + owner.width).toBe(unlike.x);
  expect(owner.y).toBe(unlike.y);
  expect(owner.height).toBe(unlike.height);
}

function assertRectCells(
  cells: Uint8Array,
  rect: EnergyRadioactiveGraphicsRect,
  material: Material,
): void {
  forEachPoint(rect, ({ x, y }) => {
    expect(cells[y * WORLD_WIDTH + x]).toBe(material);
  });
}

function forEachPoint(
  rect: EnergyRadioactiveGraphicsRect,
  visit: (point: EnergyRadioactiveGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
