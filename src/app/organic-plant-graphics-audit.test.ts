import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material, NATIVE_PROJECTIONS } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import {
  ORGANIC_PLANT_GRAPHICS_ATLAS,
  ORGANIC_PLANT_GRAPHICS_ATLAS_COLUMNS,
  ORGANIC_PLANT_GRAPHICS_ATLAS_ROWS,
  ORGANIC_PLANT_GRAPHICS_AUDIT,
  ORGANIC_PLANT_GRAPHICS_DEFINITIONS,
  prepareOrganicPlantGraphicsAuditFixture,
  type OrganicPlantContactControl,
  type OrganicPlantGraphicsPoint,
  type OrganicPlantGraphicsRect,
} from './organic-plant-graphics-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const ORGANIC_PLANT_IDS = [
  Material.Wood,
  Material.Plant,
  Material.SEED,
  Material.YEST,
  Material.VINE,
  Material.DYST,
];

class PaintTrackingBackend extends DeterministicBackend {
  paintCalls = 0;

  override paint(cx: number, cy: number, material: Material, radius: number): void {
    this.paintCalls++;
    super.paint(cx, cy, material, radius);
  }
}

describe('organic/plant graphics audit fixture', () => {
  it('pins the exact native growth-material catalog and retained yeast product', () => {
    expect(ORGANIC_PLANT_GRAPHICS_ATLAS_COLUMNS).toBe(3);
    expect(ORGANIC_PLANT_GRAPHICS_ATLAS_ROWS).toBe(2);
    expect(ORGANIC_PLANT_GRAPHICS_DEFINITIONS).toHaveLength(6);
    expect(ORGANIC_PLANT_GRAPHICS_ATLAS.map(({ material }) => material))
      .toEqual(ORGANIC_PLANT_IDS);
    expect(ORGANIC_PLANT_IDS).toEqual([9, 10, 50, 52, 83, 198]);
    expect(ORGANIC_PLANT_GRAPHICS_ATLAS.map(({ code }) => code))
      .toEqual(['WOOD', 'PLNT', 'SEED', 'YEST', 'VINE', 'DYST']);

    for (const definition of ORGANIC_PLANT_GRAPHICS_DEFINITIONS) {
      const material = ALL_MATERIALS.find(({ id }) => id === definition.material);
      expect(material, definition.code).toBeDefined();
      expect(definition.color).toBe(material?.color);
      const expectedPhase = material?.phase ?? (material?.category === 'life' ? 'solid' : 'powder');
      expect(definition.phase).toBe(expectedPhase);
    }

    const selectableGrowthIds = ALL_MATERIALS.filter(({ id, category, selectable }) => (
      category === 'life' && selectable && (
        id === Material.Wood || id === Material.Plant || id === Material.SEED
        || id === Material.YEST || id === Material.VINE
      )
    )).map(({ id }) => id);
    expect(selectableGrowthIds).toEqual(ORGANIC_PLANT_IDS.slice(0, 5));
    expect(NATIVE_PROJECTIONS.find(({ id }) => id === Material.DYST)).toMatchObject({
      name: 'DYST',
      selectable: false,
    });
    expect(ORGANIC_PLANT_GRAPHICS_AUDIT.solidCards.map(({ code }) => code))
      .toEqual(['WOOD', 'PLNT', 'VINE']);
    expect(ORGANIC_PLANT_GRAPHICS_AUDIT.powderCards.map(({ code }) => code))
      .toEqual(['SEED', 'YEST', 'DYST']);
    expect(ORGANIC_PLANT_GRAPHICS_AUDIT.nativeProductCards.map(({ code }) => code))
      .toEqual(['DYST']);
  });

  it('keeps dense bodies, one-cell growth, contacts, and protected air disjoint and in bounds', () => {
    const world = { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT };
    for (const [index, entry] of ORGANIC_PLANT_GRAPHICS_ATLAS.entries()) {
      const column = index % ORGANIC_PLANT_GRAPHICS_ATLAS_COLUMNS;
      const row = Math.floor(index / ORGANIC_PLANT_GRAPHICS_ATLAS_COLUMNS);
      expect(entry.index).toBe(index);
      expect(entry.card).toEqual({ x: 4 + column * 202, y: 4 + row * 188, width: 196, height: 180 });
      expect(entry).toMatchObject({
        left: entry.card.x,
        top: entry.card.y,
        width: entry.card.width,
        height: entry.card.height,
      });
      expect(rectInside(entry.card, world)).toBe(true);
      expect(rectInside(entry.body, entry.card)).toBe(true);
      expect(entry.body).toMatchObject({ width: 54, height: 52 });
      expect(rectInside(entry.surfaceProbe, entry.body)).toBe(true);
      expect(rectInside(entry.coreProbe, entry.body)).toBe(true);
      expect(rectInside(entry.authoredCavity, entry.body)).toBe(true);
      expect(entry.authoredCavity).toMatchObject({ width: 5, height: 5 });
      expect(rectInside(entry.openGap, entry.body)).toBe(true);
      expect(entry.openGap.x).toBe(entry.body.x);
      expect(rectanglesOverlap(entry.authoredCavity, entry.openGap)).toBe(false);
      expect(rectanglesOverlap(entry.surfaceProbe, entry.authoredCavity)).toBe(false);
      expect(rectanglesOverlap(entry.coreProbe, entry.authoredCavity)).toBe(false);

      expect(entry.stem).toMatchObject({ width: 1, height: 66 });
      expect(rectInside(entry.stem, entry.card)).toBe(true);
      const stemPoints = rectPoints(entry.stem);
      expect(entry.branches).toHaveLength(36);
      expect(entry.leaves).toHaveLength(13);
      expect(uniquePoints(stemPoints)).toHaveLength(stemPoints.length);
      expect(uniquePoints(entry.branches)).toHaveLength(entry.branches.length);
      expect(uniquePoints(entry.leaves)).toHaveLength(entry.leaves.length);
      expect(uniquePoints([...stemPoints, ...entry.branches, ...entry.leaves]))
        .toHaveLength(stemPoints.length + entry.branches.length + entry.leaves.length);
      for (const point of [...stemPoints, ...entry.branches, ...entry.leaves]) {
        expect(pointInside(point, entry.card)).toBe(true);
        expect(pointInside(point, entry.body)).toBe(false);
        expect(pointInside(point, entry.canopyGap)).toBe(false);
        expect(pointInside(point, entry.guardedBlank)).toBe(false);
      }

      expect(rectInside(entry.canopyGap, entry.card)).toBe(true);
      expect(rectInside(entry.guardedBlank, entry.card)).toBe(true);
      expect(pointInside(entry.isolatedSeedProduct, entry.card)).toBe(true);
      expect(pointInside(entry.isolatedSeedProduct, entry.guardedBlank)).toBe(false);
      expect(pointInside(entry.isolatedSeedProduct, entry.canopyGap)).toBe(false);
      verifyContact(entry.soilContact, entry.card, Material.Sand);
      verifyContact(entry.waterContact, entry.card, Material.Water);
      expect(rectanglesOverlap(entry.soilContact.owner, entry.waterContact.owner)).toBe(false);
      expect(rectanglesOverlap(entry.soilContact.neighbour, entry.waterContact.neighbour)).toBe(false);
    }

    for (let left = 0; left < ORGANIC_PLANT_GRAPHICS_ATLAS.length; left++) {
      for (let right = left + 1; right < ORGANIC_PLANT_GRAPHICS_ATLAS.length; right++) {
        expect(rectanglesOverlap(
          ORGANIC_PLANT_GRAPHICS_ATLAS[left].card,
          ORGANIC_PLANT_GRAPHICS_ATLAS[right].card,
        )).toBe(false);
      }
    }

    expect(ORGANIC_PLANT_GRAPHICS_AUDIT.cards).toBe(ORGANIC_PLANT_GRAPHICS_ATLAS);
    expect(ORGANIC_PLANT_GRAPHICS_AUDIT.cavities).toHaveLength(6 * 25);
    expect(ORGANIC_PLANT_GRAPHICS_AUDIT.openGaps).toHaveLength(6 * 30);
    expect(ORGANIC_PLANT_GRAPHICS_AUDIT.growthTopology).toHaveLength(6 * 115);
    expect(ORGANIC_PLANT_GRAPHICS_AUDIT.canopyGaps).toHaveLength(6);
    expect(ORGANIC_PLANT_GRAPHICS_AUDIT.isolatedSeedProducts).toHaveLength(6);
    expect(ORGANIC_PLANT_GRAPHICS_AUDIT.guardedBlanks).toHaveLength(6);
    expect(ORGANIC_PLANT_GRAPHICS_AUDIT.soilContacts).toHaveLength(6);
    expect(ORGANIC_PLANT_GRAPHICS_AUDIT.waterContacts).toHaveLength(6);
  });

  it('direct-fills exact topology, voids, and soil/water ownership without paint', () => {
    const simulation = new PaintTrackingBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareOrganicPlantGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    let expectedOccupied = 0;

    for (const entry of ORGANIC_PLANT_GRAPHICS_ATLAS) {
      forEachPoint(entry.body, ({ x, y }) => {
        const isAir = pointInside({ x, y }, entry.authoredCavity)
          || pointInside({ x, y }, entry.openGap);
        expect(cells[y * WORLD_WIDTH + x]).toBe(isAir ? Material.Empty : entry.material);
      });
      assertRectCells(cells, entry.authoredCavity, Material.Empty);
      assertRectCells(cells, entry.openGap, Material.Empty);
      assertRectCells(cells, entry.stem, entry.material);
      assertPointCells(cells, entry.branches, entry.material);
      assertPointCells(cells, entry.leaves, entry.material);
      assertRectCells(cells, entry.canopyGap, Material.Empty);
      expect(cells[entry.isolatedSeedProduct.y * WORLD_WIDTH + entry.isolatedSeedProduct.x])
        .toBe(entry.material);
      assertRectCells(cells, entry.guardedBlank, Material.Empty);
      assertRectCells(cells, entry.soilContact.owner, entry.material);
      assertRectCells(cells, entry.soilContact.neighbour, Material.Sand);
      assertRectCells(cells, entry.waterContact.owner, entry.material);
      assertRectCells(cells, entry.waterContact.neighbour, Material.Water);

      expectedOccupied += entry.body.width * entry.body.height
        - entry.authoredCavity.width * entry.authoredCavity.height
        - entry.openGap.width * entry.openGap.height
        + entry.stem.width * entry.stem.height
        + entry.branches.length
        + entry.leaves.length
        + 1
        + entry.soilContact.owner.width * entry.soilContact.owner.height
        + entry.soilContact.neighbour.width * entry.soilContact.neighbour.height
        + entry.waterContact.owner.width * entry.waterContact.owner.height
        + entry.waterContact.neighbour.width * entry.waterContact.neighbour.height;
    }

    expect(simulation.paintCalls).toBe(0);
    expect(cells.reduce((count, material) => count + Number(material !== Material.Empty), 0))
      .toBe(expectedOccupied);
  });

  it('is byte-deterministic and rejects the wrong backend or world geometry', () => {
    const first = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    const second = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareOrganicPlantGraphicsAuditFixture(first);
    prepareOrganicPlantGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());

    const firstPass = first.cells().slice();
    first.cells().fill(Material.Fire);
    prepareOrganicPlantGraphicsAuditFixture(first);
    expect(first.cells()).toEqual(firstPass);

    expect(() => prepareOrganicPlantGraphicsAuditFixture(new DeterministicBackend(32, 32)))
      .toThrow('requires 612x384');
    const wrongBackend = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    Object.defineProperty(wrongBackend, 'name', { value: 'not deterministic' });
    expect(() => prepareOrganicPlantGraphicsAuditFixture(wrongBackend))
      .toThrow('requires the deterministic backend');
  });
});

function pointInside(point: OrganicPlantGraphicsPoint, rect: OrganicPlantGraphicsRect): boolean {
  return point.x >= rect.x && point.y >= rect.y
    && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

function rectInside(inner: OrganicPlantGraphicsRect, outer: OrganicPlantGraphicsRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(a: OrganicPlantGraphicsRect, b: OrganicPlantGraphicsRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width
    && a.y < b.y + b.height && b.y < a.y + a.height;
}

function verifyContact(
  control: OrganicPlantContactControl,
  card: OrganicPlantGraphicsRect,
  material: Material.Sand | Material.Water,
): void {
  expect(rectInside(control.owner, card)).toBe(true);
  expect(rectInside(control.neighbour, card)).toBe(true);
  expect(rectanglesOverlap(control.owner, control.neighbour)).toBe(false);
  expect(control.owner.x + control.owner.width).toBe(control.neighbour.x);
  expect(control.owner.y).toBe(control.neighbour.y);
  expect(control.owner.height).toBe(control.neighbour.height);
  expect(control.neighbourMaterial).toBe(material);
}

function assertRectCells(
  cells: Uint8Array,
  rect: OrganicPlantGraphicsRect,
  material: Material,
): void {
  forEachPoint(rect, ({ x, y }) => expect(cells[y * WORLD_WIDTH + x]).toBe(material));
}

function assertPointCells(
  cells: Uint8Array,
  points: readonly OrganicPlantGraphicsPoint[],
  material: Material,
): void {
  for (const { x, y } of points) expect(cells[y * WORLD_WIDTH + x]).toBe(material);
}

function uniquePoints(points: readonly OrganicPlantGraphicsPoint[]): readonly string[] {
  return [...new Set(points.map(({ x, y }) => `${x},${y}`))];
}

function rectPoints(rect: OrganicPlantGraphicsRect): OrganicPlantGraphicsPoint[] {
  const points: OrganicPlantGraphicsPoint[] = [];
  forEachPoint(rect, (point) => points.push(point));
  return points;
}

function forEachPoint(
  rect: OrganicPlantGraphicsRect,
  visit: (point: OrganicPlantGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
