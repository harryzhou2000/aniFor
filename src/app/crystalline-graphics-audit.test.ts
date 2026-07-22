import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import {
  CRYSTALLINE_GRAPHICS_ATLAS,
  CRYSTALLINE_GRAPHICS_ATLAS_COLUMNS,
  CRYSTALLINE_GRAPHICS_ATLAS_ROWS,
  CRYSTALLINE_GRAPHICS_AUDIT,
  CRYSTALLINE_GRAPHICS_DEFINITIONS,
  prepareCrystallineGraphicsAuditFixture,
  type CrystallineGraphicsAtlasEntry,
  type CrystallineGraphicsContactControl,
  type CrystallineGraphicsMotifProbeSet,
  type CrystallineGraphicsPoint,
  type CrystallineGraphicsRect,
} from './crystalline-graphics-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CRYSTALLINE_IDS = [Material.DRIC, Material.NICE, Material.QRTZ, Material.RIME];
const FINE_STRUCTURE_COUNTS = [95, 138, 88, 136];

class PaintTrackingBackend extends DeterministicBackend {
  paintCalls = 0;

  override paint(cx: number, cy: number, material: Material, radius: number): void {
    this.paintCalls++;
    super.paint(cx, cy, material, radius);
  }
}

describe('crystalline graphics audit fixture', () => {
  it('pins the four cold crystalline solids in stable native order', () => {
    expect(CRYSTALLINE_GRAPHICS_ATLAS_COLUMNS).toBe(2);
    expect(CRYSTALLINE_GRAPHICS_ATLAS_ROWS).toBe(2);
    expect(CRYSTALLINE_GRAPHICS_DEFINITIONS).toHaveLength(4);
    expect(CRYSTALLINE_IDS).toEqual([68, 74, 76, 77]);
    expect(CRYSTALLINE_GRAPHICS_ATLAS.map(({ material }) => material))
      .toEqual(CRYSTALLINE_IDS);
    expect(CRYSTALLINE_GRAPHICS_ATLAS.map(({ code }) => code))
      .toEqual(['DRIC', 'NICE', 'QRTZ', 'RIME']);
    expect(CRYSTALLINE_GRAPHICS_ATLAS.map(({ phase }) => phase))
      .toEqual(['solid', 'solid', 'solid', 'solid']);
    expect(CRYSTALLINE_GRAPHICS_ATLAS.map(({ structureKind }) => structureKind)).toEqual([
      'sublimation-fractures', 'nitrogen-needle', 'quartz-prism', 'rime-dendrite',
    ]);

    for (const definition of CRYSTALLINE_GRAPHICS_DEFINITIONS) {
      const material = ALL_MATERIALS.find(({ id }) => id === definition.material);
      expect(material, definition.code).toBeDefined();
      expect(definition.color).toBe(material?.color);
      expect(material?.category).toBe('solids');
    }
  });

  it('lays out four disjoint normal-fit cards with exact modulo-32 body alignment', () => {
    const world = { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT };
    for (const [index, entry] of CRYSTALLINE_GRAPHICS_ATLAS.entries()) {
      const column = index % 2;
      const row = Math.floor(index / 2);
      expect(entry.index).toBe(index);
      expect(entry.card).toEqual({
        x: 4 + column * 304,
        y: 4 + row * 192,
        width: 300,
        height: 184,
      });
      expect(entry).toMatchObject({
        left: entry.card.x,
        top: entry.card.y,
        width: entry.card.width,
        height: entry.card.height,
      });
      expect(rectInside(entry.card, world)).toBe(true);
      expect(entry.body).toEqual({
        x: 20 + column * 320,
        y: 20 + row * 192,
        width: 144,
        height: 104,
      });
      expect(entry.body.x % 32).toBe(20);
      expect(entry.body.y % 32).toBe(20);
      expect(rectInside(entry.body, entry.card)).toBe(true);
      expect(rectInside(entry.surfaceProbe, entry.body)).toBe(true);
      expect(rectInside(entry.coreProbe, entry.body)).toBe(true);
      expect(rectInside(entry.authoredCavity, entry.body)).toBe(true);
      expect(entry.authoredCavity.width * entry.authoredCavity.height).toBe(120);
      expect(rectInside(entry.openChimney, entry.body)).toBe(true);
      expect(entry.openChimney.y).toBe(entry.body.y);
      expect(entry.openChimney.width * entry.openChimney.height).toBe(152);
      expect(rectanglesOverlap(entry.authoredCavity, entry.openChimney)).toBe(false);
      expect(rectInside(entry.body, entry.haloOuter)).toBe(true);
      expect(rectInside(entry.haloOuter, entry.card)).toBe(true);
      expect(rectInside(entry.guardedBlank, entry.card)).toBe(true);
      expect(entry.guardedBlank.width * entry.guardedBlank.height).toBe(2_800);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.body)).toBe(false);
      expect(pointInside(entry.isolated, entry.guardedBlank)).toBe(false);
      verifyContact(entry.crystalContact, entry.card);
      verifyContact(entry.metalContact, entry.card);
      expect(entry.crystalContact.neighbourMaterial)
        .toBe(CRYSTALLINE_IDS[(index + 1) % CRYSTALLINE_IDS.length]);
      expect(entry.metalContact.neighbourMaterial).toBe(Material.Metal);
      expect(rectanglesOverlap(entry.crystalContact.owner, entry.metalContact.owner)).toBe(false);
    }
    for (let left = 0; left < CRYSTALLINE_GRAPHICS_ATLAS.length; left++) {
      for (let right = left + 1; right < CRYSTALLINE_GRAPHICS_ATLAS.length; right++) {
        expect(rectanglesOverlap(
          CRYSTALLINE_GRAPHICS_ATLAS[left].card,
          CRYSTALLINE_GRAPHICS_ATLAS[right].card,
        )).toBe(false);
      }
    }
  });

  it('provides four exact one-cell material structures without erasing controls', () => {
    expect(CRYSTALLINE_GRAPHICS_ATLAS.map(({ fineStructure }) => fineStructure.length))
      .toEqual(FINE_STRUCTURE_COUNTS);
    for (const [index, entry] of CRYSTALLINE_GRAPHICS_ATLAS.entries()) {
      expect(uniquePointKeys(entry.fineStructure)).toHaveLength(FINE_STRUCTURE_COUNTS[index]);
      for (const point of entry.fineStructure) {
        expect(pointInside(point, entry.card)).toBe(true);
        expect(pointInside(point, entry.body)).toBe(false);
        expect(pointInside(point, entry.guardedBlank)).toBe(false);
        expect(pointInside(point, entry.crystalContact.owner)).toBe(false);
        expect(pointInside(point, entry.crystalContact.neighbour)).toBe(false);
        expect(pointInside(point, entry.metalContact.owner)).toBe(false);
        expect(pointInside(point, entry.metalContact.neighbour)).toBe(false);
      }
      const attachedSpur = entry.fineStructure.filter(({ x, y }) => (
        x === entry.body.x + 71
          && y >= entry.body.y + entry.body.height
          && y < entry.body.y + entry.body.height + 24
      ));
      expect(attachedSpur).toHaveLength(24);
    }
    expect(CRYSTALLINE_GRAPHICS_AUDIT.fineStructures).toHaveLength(457);
  });

  it('exposes eight equivalent 32-cell motif sample sets in every aligned body', () => {
    expect(CRYSTALLINE_GRAPHICS_ATLAS.map(({ motifProbes }) => motifProbes.length))
      .toEqual([8, 8, 8, 8]);
    const referenceSignature = relativeMotifSignature(CRYSTALLINE_GRAPHICS_ATLAS[0]);
    for (const entry of CRYSTALLINE_GRAPHICS_ATLAS) {
      expect(relativeMotifSignature(entry)).toEqual(referenceSignature);
      for (const probe of entry.motifProbes) {
        expect(probe.tileOrigin.x % 32).toBe(0);
        expect(probe.tileOrigin.y % 32).toBe(0);
        const regions = motifRects(probe);
        expect(uniquePointKeys(regions.flatMap(rectPoints))).toHaveLength(5);
        for (const rect of regions) {
          expect(rect).toMatchObject({ width: 1, height: 1 });
          expect(rectInside(rect, entry.body)).toBe(true);
          expect(rectanglesOverlap(rect, entry.authoredCavity)).toBe(false);
          expect(rectanglesOverlap(rect, entry.openChimney)).toBe(false);
        }
      }
    }
    expect(CRYSTALLINE_GRAPHICS_AUDIT.motifProbes).toHaveLength(32);
  });

  it('direct-fills exact ownership and controls without using the paint ABI', () => {
    const simulation = new PaintTrackingBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareCrystallineGraphicsAuditFixture(simulation);
    const cells = simulation.cells();

    for (const entry of CRYSTALLINE_GRAPHICS_ATLAS) {
      let occupiedBody = 0;
      forEachPoint(entry.body, (point) => {
        const empty = pointInside(point, entry.authoredCavity)
          || pointInside(point, entry.openChimney);
        expect(cell(cells, point)).toBe(empty ? Material.Empty : entry.material);
        occupiedBody += Number(!empty);
      });
      expect(occupiedBody).toBe(14_704);
      assertRectCells(cells, entry.authoredCavity, Material.Empty);
      assertRectCells(cells, entry.openChimney, Material.Empty);
      assertPointCells(cells, entry.fineStructure, entry.material);
      expect(cell(cells, entry.isolated)).toBe(entry.material);
      assertRectCells(cells, entry.guardedBlank, Material.Empty);
      assertRectCells(cells, entry.crystalContact.owner, entry.material);
      assertRectCells(cells, entry.crystalContact.neighbour, entry.crystalContact.neighbourMaterial);
      assertRectCells(cells, entry.metalContact.owner, entry.material);
      assertRectCells(cells, entry.metalContact.neighbour, Material.Metal);
      for (const probe of entry.motifProbes) {
        for (const rect of motifRects(probe)) assertRectCells(cells, rect, entry.material);
      }
    }
    expect(cells.reduce((count, material) => count + Number(material !== Material.Empty), 0))
      .toBe(62_861);
    expect(simulation.paintCalls).toBe(0);
  });

  it('is byte deterministic and rejects unsupported backends and geometry', () => {
    const first = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    const second = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareCrystallineGraphicsAuditFixture(first);
    prepareCrystallineGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());

    const firstPass = first.cells().slice();
    first.cells().fill(Material.Fire);
    prepareCrystallineGraphicsAuditFixture(first);
    expect(first.cells()).toEqual(firstPass);

    expect(() => prepareCrystallineGraphicsAuditFixture(new DeterministicBackend(32, 32)))
      .toThrow('requires 612x384');
    const wrongBackend = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    Object.defineProperty(wrongBackend, 'name', { value: 'not deterministic' });
    expect(() => prepareCrystallineGraphicsAuditFixture(wrongBackend))
      .toThrow('requires the deterministic backend');
  });
});

function relativeMotifSignature(entry: CrystallineGraphicsAtlasEntry): unknown {
  const relativeRect = (rect: CrystallineGraphicsRect) => ({
    x: rect.x - entry.body.x,
    y: rect.y - entry.body.y,
    width: rect.width,
    height: rect.height,
  });
  return entry.motifProbes.map((probe) => ({
    tileOrigin: {
      x: probe.tileOrigin.x - entry.body.x,
      y: probe.tileOrigin.y - entry.body.y,
    },
    key: relativeRect(probe.key),
    facet: relativeRect(probe.facet),
    joint: relativeRect(probe.joint),
    shadow: relativeRect(probe.shadow),
    interstitial: relativeRect(probe.interstitial),
  }));
}

function motifRects(
  probe: CrystallineGraphicsMotifProbeSet,
): readonly CrystallineGraphicsRect[] {
  return [probe.key, probe.facet, probe.joint, probe.shadow, probe.interstitial];
}

function verifyContact(
  control: CrystallineGraphicsContactControl,
  card: CrystallineGraphicsRect,
): void {
  expect(rectInside(control.owner, card)).toBe(true);
  expect(rectInside(control.neighbour, card)).toBe(true);
  expect(rectanglesOverlap(control.owner, control.neighbour)).toBe(false);
  expect(control.owner.x + control.owner.width).toBe(control.neighbour.x);
  expect(control.owner.y).toBe(control.neighbour.y);
  expect(control.owner.height).toBe(control.neighbour.height);
  expect(control.owner.width * control.owner.height).toBe(192);
  expect(control.neighbour.width * control.neighbour.height).toBe(256);
}

function cell(cells: Uint8Array, point: CrystallineGraphicsPoint): number {
  return cells[point.y * WORLD_WIDTH + point.x];
}

function assertRectCells(
  cells: Uint8Array,
  rect: CrystallineGraphicsRect,
  material: Material,
): void {
  forEachPoint(rect, (point) => expect(cell(cells, point)).toBe(material));
}

function assertPointCells(
  cells: Uint8Array,
  points: readonly CrystallineGraphicsPoint[],
  material: Material,
): void {
  for (const point of points) expect(cell(cells, point)).toBe(material);
}

function pointInside(point: CrystallineGraphicsPoint, rect: CrystallineGraphicsRect): boolean {
  return point.x >= rect.x && point.y >= rect.y
    && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

function rectInside(inner: CrystallineGraphicsRect, outer: CrystallineGraphicsRect): boolean {
  return pointInside(inner, outer)
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(
  left: CrystallineGraphicsRect,
  right: CrystallineGraphicsRect,
): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

function uniquePointKeys(points: readonly CrystallineGraphicsPoint[]): readonly string[] {
  return [...new Set(points.map(({ x, y }) => `${x},${y}`))];
}

function rectPoints(rect: CrystallineGraphicsRect): CrystallineGraphicsPoint[] {
  const points: CrystallineGraphicsPoint[] = [];
  forEachPoint(rect, (point) => points.push(point));
  return points;
}

function forEachPoint(
  rect: CrystallineGraphicsRect,
  visit: (point: CrystallineGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
