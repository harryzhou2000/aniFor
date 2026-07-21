import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import {
  GAS_IDENTITY_GRAPHICS_ATLAS,
  GAS_IDENTITY_GRAPHICS_ATLAS_COLUMNS,
  GAS_IDENTITY_GRAPHICS_ATLAS_ROWS,
  GAS_IDENTITY_GRAPHICS_AUDIT,
  GAS_IDENTITY_GRAPHICS_DEFINITIONS,
  prepareGasIdentityGraphicsAuditFixture,
  type GasIdentityGraphicsPoint,
  type GasIdentityGraphicsRect,
} from './gas-identity-graphics-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const GAS_IDS = [
  Material.Smoke, Material.Steam, Material.Gas, Material.Oxygen, Material.Hydrogen,
  Material.CarbonDioxide, Material.NobleGas, Material.BOYL, Material.CAUS, Material.FOG,
  Material.RFRG, Material.CFLM, Material.AMTR, Material.WARP, Material.BIZRG,
  Material.MORT, Material.VRSG,
];

class PaintTrackingBackend extends DeterministicBackend {
  paintCalls = 0;

  override paint(cx: number, cy: number, material: Material, radius: number): void {
    this.paintCalls++;
    super.paint(cx, cy, material, radius);
  }
}

describe('gas identity graphics audit fixture', () => {
  it('pins exactly 17 gas identities in a stable in-bounds 6-by-3 atlas', () => {
    expect(GAS_IDENTITY_GRAPHICS_ATLAS_COLUMNS).toBe(6);
    expect(GAS_IDENTITY_GRAPHICS_ATLAS_ROWS).toBe(3);
    expect(GAS_IDENTITY_GRAPHICS_DEFINITIONS).toHaveLength(17);
    expect(GAS_IDENTITY_GRAPHICS_ATLAS).toHaveLength(17);
    expect(GAS_IDENTITY_GRAPHICS_ATLAS.map(({ material }) => material)).toEqual(GAS_IDS);
    expect(GAS_IDS).toEqual([5, 15, 17, 39, 40, 41, 42, 63, 64, 65, 66, 87, 98, 114, 195, 205, 215]);
    expect(GAS_IDENTITY_GRAPHICS_ATLAS.map(({ code }) => code)).toEqual([
      'SMKE', 'WTRV', 'GAS', 'O2', 'H2', 'CO2', 'NBLE', 'BOYL', 'CAUS',
      'FOG', 'RFRG', 'CFLM', 'AMTR', 'WARP', 'BIZG', 'MORT', 'VRSG',
    ]);
    expect(GAS_IDENTITY_GRAPHICS_ATLAS.map(({ color }) => color)).toEqual([
      '#9d9891', '#b9dce2', '#c6b35d', '#80b8e8', '#e4e0d5', '#8d9293',
      '#c277d7', '#0a3200', '#80ffa0', '#aaaaaa', '#72d2d4', '#8080ff',
      '#808080', '#101010', '#00ffbb', '#e0e0e0', '#fe68fe',
    ]);

    const world = { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT };
    for (const [index, entry] of GAS_IDENTITY_GRAPHICS_ATLAS.entries()) {
      const column = index % 6;
      const row = Math.floor(index / 6);
      expect(entry.index).toBe(index);
      expect(entry.card).toEqual({ x: 4 + column * 101, y: 4 + row * 124, width: 98, height: 118 });
      expect(entry).toMatchObject({
        left: entry.card.x,
        top: entry.card.y,
        width: entry.card.width,
        height: entry.card.height,
      });
      expect(rectInside(entry.card, world)).toBe(true);
      expect(rectInside(entry.cloudSeed, entry.card)).toBe(true);
      expect(entry.cloudSeed).toMatchObject({ width: 49, height: 44 });
      expect(rectInside(entry.denseProbe, entry.cloudSeed)).toBe(true);
      expect(rectInside(entry.authoredVoid, entry.cloudSeed)).toBe(true);
      expect(entry.authoredVoid).toMatchObject({ width: 7, height: 7 });
      expect(rectInside(entry.openChannel, entry.cloudSeed)).toBe(true);
      expect(entry.openChannel.y).toBe(entry.cloudSeed.y);
      expect(entry.openChannel.width).toBe(3);
      expect(entry.openChannel.y + entry.openChannel.height).toBe(entry.authoredVoid.y);
      expect(entry.openChannel.x).toBeGreaterThan(entry.authoredVoid.x);
      expect(entry.openChannel.x + entry.openChannel.width)
        .toBeLessThan(entry.authoredVoid.x + entry.authoredVoid.width);
      expect(rectanglesOverlap(entry.authoredVoid, entry.openChannel)).toBe(false);
      expect(rectanglesOverlap(entry.denseProbe, entry.authoredVoid)).toBe(false);
      expect(rectanglesOverlap(entry.denseProbe, entry.openChannel)).toBe(false);

      expect(entry.sparseWisps).toHaveLength(12);
      expect(new Set(entry.sparseWisps.map(({ x, y }) => `${x},${y}`)).size).toBe(12);
      for (const point of entry.sparseWisps) {
        expect(pointInside(point, entry.card)).toBe(true);
        expect(pointInside(point, entry.cloudSeed)).toBe(false);
        expect(pointInside(point, entry.wispGap)).toBe(false);
      }
      expect(rectInside(entry.wispGap, entry.card)).toBe(true);
      expect(rectanglesOverlap(entry.wispGap, entry.cloudSeed)).toBe(false);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.cloudSeed)).toBe(false);
      expect(entry.sparseWisps).not.toContainEqual(entry.isolated);
      expect(rectInside(entry.guardedBlank, entry.card)).toBe(true);
      expect(rectanglesOverlap(entry.guardedBlank, entry.cloudSeed)).toBe(false);
      expect(pointInside(entry.isolated, entry.guardedBlank)).toBe(false);
      for (const point of entry.sparseWisps) {
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

    for (let left = 0; left < GAS_IDENTITY_GRAPHICS_ATLAS.length; left++) {
      for (let right = left + 1; right < GAS_IDENTITY_GRAPHICS_ATLAS.length; right++) {
        expect(rectanglesOverlap(
          GAS_IDENTITY_GRAPHICS_ATLAS[left].card,
          GAS_IDENTITY_GRAPHICS_ATLAS[right].card,
        )).toBe(false);
      }
    }

    expect(GAS_IDENTITY_GRAPHICS_AUDIT.cards).toBe(GAS_IDENTITY_GRAPHICS_ATLAS);
    expect(GAS_IDENTITY_GRAPHICS_AUDIT.authoredVoids).toHaveLength(17 * 49);
    expect(GAS_IDENTITY_GRAPHICS_AUDIT.openChannels).toHaveLength(17 * 60);
    expect(GAS_IDENTITY_GRAPHICS_AUDIT.sparseWisps).toHaveLength(17 * 12);
    expect(GAS_IDENTITY_GRAPHICS_AUDIT.wispGaps).toHaveLength(17);
    expect(GAS_IDENTITY_GRAPHICS_AUDIT.isolated).toHaveLength(17);
    expect(GAS_IDENTITY_GRAPHICS_AUDIT.guardedBlanks).toHaveLength(17);
    expect(GAS_IDENTITY_GRAPHICS_AUDIT.liquidContacts).toHaveLength(17);
    expect(GAS_IDENTITY_GRAPHICS_AUDIT.solidContacts).toHaveLength(17);
  });

  it('direct-fills exact cloud, wisp, void, and unlike-contact ownership without paint', () => {
    const simulation = new PaintTrackingBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareGasIdentityGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    let expectedOccupied = 0;

    for (const entry of GAS_IDENTITY_GRAPHICS_ATLAS) {
      forEachPoint(entry.cloudSeed, ({ x, y }) => {
        const isAir = pointInside({ x, y }, entry.authoredVoid)
          || pointInside({ x, y }, entry.openChannel);
        expect(cells[y * WORLD_WIDTH + x]).toBe(isAir ? Material.Empty : entry.material);
      });
      assertRectCells(cells, entry.authoredVoid, Material.Empty);
      assertRectCells(cells, entry.openChannel, Material.Empty);
      for (let y = entry.cloudSeed.y - 1; y < entry.authoredVoid.y + entry.authoredVoid.height; y++) {
        const x = entry.openChannel.x + 1;
        expect(cells[y * WORLD_WIDTH + x]).toBe(Material.Empty);
      }
      for (const { x, y } of entry.sparseWisps) {
        expect(cells[y * WORLD_WIDTH + x]).toBe(entry.material);
      }
      assertRectCells(cells, entry.wispGap, Material.Empty);
      expect(cells[entry.isolated.y * WORLD_WIDTH + entry.isolated.x]).toBe(entry.material);
      assertRectCells(cells, entry.guardedBlank, Material.Empty);
      assertRectCells(cells, entry.liquidContact.owner, entry.material);
      assertRectCells(cells, entry.liquidContact.unlike, Material.Water);
      assertRectCells(cells, entry.solidContact.owner, entry.material);
      assertRectCells(cells, entry.solidContact.unlike, Material.Metal);

      expectedOccupied += entry.cloudSeed.width * entry.cloudSeed.height
        - entry.authoredVoid.width * entry.authoredVoid.height
        - entry.openChannel.width * entry.openChannel.height
        + entry.sparseWisps.length
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
    prepareGasIdentityGraphicsAuditFixture(first);
    prepareGasIdentityGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());

    const firstPass = first.cells().slice();
    first.cells().fill(Material.Fire);
    prepareGasIdentityGraphicsAuditFixture(first);
    expect(first.cells()).toEqual(firstPass);

    expect(() => prepareGasIdentityGraphicsAuditFixture(new DeterministicBackend(32, 32)))
      .toThrow('requires 612x384');
    const wrongBackend = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    Object.defineProperty(wrongBackend, 'name', { value: 'not deterministic' });
    expect(() => prepareGasIdentityGraphicsAuditFixture(wrongBackend))
      .toThrow('requires the deterministic backend');
  });
});

function pointInside(point: GasIdentityGraphicsPoint, rect: GasIdentityGraphicsRect): boolean {
  return point.x >= rect.x && point.y >= rect.y
    && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

function rectInside(inner: GasIdentityGraphicsRect, outer: GasIdentityGraphicsRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(a: GasIdentityGraphicsRect, b: GasIdentityGraphicsRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width
    && a.y < b.y + b.height && b.y < a.y + a.height;
}

function verifyContact(
  owner: GasIdentityGraphicsRect,
  unlike: GasIdentityGraphicsRect,
  card: GasIdentityGraphicsRect,
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
  rect: GasIdentityGraphicsRect,
  material: Material,
): void {
  forEachPoint(rect, ({ x, y }) => {
    expect(cells[y * WORLD_WIDTH + x]).toBe(material);
  });
}

function forEachPoint(
  rect: GasIdentityGraphicsRect,
  visit: (point: GasIdentityGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
