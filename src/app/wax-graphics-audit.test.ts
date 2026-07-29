import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import {
  WAX_GRAPHICS_ATLAS,
  WAX_GRAPHICS_ATLAS_COLUMNS,
  WAX_GRAPHICS_ATLAS_ROWS,
  WAX_GRAPHICS_AUDIT,
  WAX_GRAPHICS_DEFINITIONS,
  prepareWaxGraphicsAuditFixture,
  type WaxGraphicsAtlasEntry,
  type WaxGraphicsContactControl,
  type WaxGraphicsMotifProbeSet,
  type WaxGraphicsPoint,
  type WaxGraphicsRect,
} from './wax-graphics-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const WAX_IDS = [Material.Wax, Material.MWAX];

class PaintTrackingBackend extends DeterministicBackend {
  paintCalls = 0;

  override paint(cx: number, cy: number, material: Material, radius: number): void {
    this.paintCalls++;
    super.paint(cx, cy, material, radius);
  }
}

describe('wax graphics audit fixture', () => {
  it('pins native solid and molten wax in stable phase order', () => {
    expect(WAX_GRAPHICS_ATLAS_COLUMNS).toBe(2);
    expect(WAX_GRAPHICS_ATLAS_ROWS).toBe(1);
    expect(WAX_GRAPHICS_DEFINITIONS).toHaveLength(2);
    expect(WAX_GRAPHICS_ATLAS.map(({ material }) => material)).toEqual(WAX_IDS);
    expect(WAX_IDS).toEqual([27, 59]);
    expect(WAX_GRAPHICS_ATLAS.map(({ code }) => code)).toEqual(['WAX', 'MWAX']);
    expect(WAX_GRAPHICS_ATLAS.map(({ phase }) => phase)).toEqual(['solid', 'liquid']);

    for (const definition of WAX_GRAPHICS_DEFINITIONS) {
      const material = ALL_MATERIALS.find(({ id }) => id === definition.material);
      expect(material, definition.code).toBeDefined();
      expect(definition.color).toBe(material?.color);
      expect(material?.category).toBe(definition.phase === 'solid' ? 'solids' : 'liquids');
    }
    expect(WAX_GRAPHICS_AUDIT.solidCards.map(({ code }) => code)).toEqual(['WAX']);
    expect(WAX_GRAPHICS_AUDIT.liquidCards.map(({ code }) => code)).toEqual(['MWAX']);
  });

  it('keeps disjoint cards and both phase bodies aligned modulo 32', () => {
    const world = { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT };
    for (const [index, entry] of WAX_GRAPHICS_ATLAS.entries()) {
      expect(entry.index).toBe(index);
      expect(entry.card).toEqual({ x: 4 + index * 304, y: 4, width: 300, height: 376 });
      expect(entry).toMatchObject({
        left: entry.card.x,
        top: entry.card.y,
        width: entry.card.width,
        height: entry.card.height,
      });
      expect(rectInside(entry.card, world)).toBe(true);
      expect(entry.body).toEqual({ x: 20 + index * 320, y: 20, width: 160, height: 128 });
      expect(entry.body.x % 32).toBe(20);
      expect(entry.body.y % 32).toBe(20);
      expect(rectInside(entry.body, entry.card)).toBe(true);
      expect(rectInside(entry.surfaceProbe, entry.body)).toBe(true);
      expect(rectInside(entry.coreProbe, entry.body)).toBe(true);
      expect(rectInside(entry.authoredCavity, entry.body)).toBe(true);
      expect(rectInside(entry.openChimney, entry.body)).toBe(true);
      expect(entry.openChimney.y).toBe(entry.body.y);
      expect(entry.openChimney.y + entry.openChimney.height).toBe(entry.authoredCavity.y);
      expect(entry.openChimney.x).toBeGreaterThanOrEqual(entry.authoredCavity.x);
      expect(entry.openChimney.x + entry.openChimney.width)
        .toBeLessThanOrEqual(entry.authoredCavity.x + entry.authoredCavity.width);
      expect(rectInside(entry.body, entry.haloOuter)).toBe(true);
      expect(rectInside(entry.haloOuter, entry.card)).toBe(true);
      expect(rectInside(entry.guardedBlank, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.body)).toBe(false);
      expect(pointInside(entry.isolated, entry.guardedBlank)).toBe(false);
      verifyContact(entry.waterContact, entry.card, Material.Water);
      verifyContact(entry.metalContact, entry.card, Material.Metal);
      expect(rectanglesOverlap(entry.waterContact.owner, entry.metalContact.owner)).toBe(false);
    }
    expect(rectanglesOverlap(WAX_GRAPHICS_ATLAS[0].card, WAX_GRAPHICS_ATLAS[1].card)).toBe(false);
  });

  it('provides protected thin solid lamellae and a distinct liquid flow topology', () => {
    const [solid, liquid] = WAX_GRAPHICS_ATLAS;
    expect(solid.phaseStructureKind).toBe('lamella-spur');
    expect(solid.phaseStructure).toHaveLength(340);
    expect(liquid.phaseStructureKind).toBe('strand-droplets');
    expect(liquid.phaseStructure).toHaveLength(145);

    for (const entry of WAX_GRAPHICS_ATLAS) {
      expect(uniquePointKeys(entry.phaseStructure)).toHaveLength(entry.phaseStructure.length);
      for (const point of entry.phaseStructure) {
        expect(pointInside(point, entry.card)).toBe(true);
        expect(pointInside(point, entry.body)).toBe(false);
        expect(pointInside(point, entry.guardedBlank)).toBe(false);
      }
    }
    expect(WAX_GRAPHICS_AUDIT.phaseStructures).toHaveLength(485);
  });

  it('exposes equivalent 32-cell shared motif probes for both phases', () => {
    const probeCounts = WAX_GRAPHICS_ATLAS.map(({ motifProbes }) => motifProbes.length);
    expect(probeCounts).toEqual([10, 10]);
    const referenceSignature = relativeMotifSignature(WAX_GRAPHICS_ATLAS[0]);
    expect(WAX_GRAPHICS_ATLAS[0].motifProbes[0]).toMatchObject({
      ridge: { x: 58, y: 33 },
      fold: { x: 35, y: 35 },
      bloom: { x: 40, y: 33 },
      joint: { x: 44, y: 44 },
      interstitial: { x: 42, y: 40 },
    });
    for (const entry of WAX_GRAPHICS_ATLAS) {
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
    expect(WAX_GRAPHICS_AUDIT.motifProbes).toHaveLength(20);
  });

  it('direct-fills exact ownership and controls without using the paint ABI', () => {
    const simulation = new PaintTrackingBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareWaxGraphicsAuditFixture(simulation);
    const cells = simulation.cells();

    for (const entry of WAX_GRAPHICS_ATLAS) {
      forEachPoint(entry.body, (point) => {
        const empty = pointInside(point, entry.authoredCavity)
          || pointInside(point, entry.openChimney);
        expect(cell(cells, point)).toBe(empty ? Material.Empty : entry.material);
      });
      assertRectCells(cells, entry.authoredCavity, Material.Empty);
      assertRectCells(cells, entry.openChimney, Material.Empty);
      assertPointCells(cells, entry.phaseStructure, entry.material);
      expect(cell(cells, entry.isolated)).toBe(entry.material);
      assertRectCells(cells, entry.guardedBlank, Material.Empty);
      assertRectCells(cells, entry.waterContact.owner, entry.material);
      assertRectCells(cells, entry.waterContact.neighbour, Material.Water);
      assertRectCells(cells, entry.metalContact.owner, entry.material);
      assertRectCells(cells, entry.metalContact.neighbour, Material.Metal);
      for (const probe of entry.motifProbes) {
        for (const rect of motifRects(probe)) assertRectCells(cells, rect, entry.material);
      }
    }
    expect(simulation.paintCalls).toBe(0);
  });

  it('is byte deterministic and rejects unsupported backends and geometry', () => {
    const first = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    const second = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareWaxGraphicsAuditFixture(first);
    prepareWaxGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());

    const firstPass = first.cells().slice();
    first.cells().fill(Material.Fire);
    prepareWaxGraphicsAuditFixture(first);
    expect(first.cells()).toEqual(firstPass);

    expect(() => prepareWaxGraphicsAuditFixture(new DeterministicBackend(32, 32)))
      .toThrow('requires 612x384');
    const wrongBackend = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    Object.defineProperty(wrongBackend, 'name', { value: 'not deterministic' });
    expect(() => prepareWaxGraphicsAuditFixture(wrongBackend))
      .toThrow('requires the deterministic backend');
  });
});

function relativeMotifSignature(entry: WaxGraphicsAtlasEntry): unknown {
  const relativeRect = (rect: WaxGraphicsRect) => ({
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
    ridge: relativeRect(probe.ridge),
    fold: relativeRect(probe.fold),
    bloom: relativeRect(probe.bloom),
    joint: relativeRect(probe.joint),
    interstitial: relativeRect(probe.interstitial),
  }));
}

function motifRects(probe: WaxGraphicsMotifProbeSet): readonly WaxGraphicsRect[] {
  return [probe.ridge, probe.fold, probe.bloom, probe.joint, probe.interstitial];
}

function verifyContact(
  control: WaxGraphicsContactControl,
  card: WaxGraphicsRect,
  material: Material.Water | Material.Metal,
): void {
  expect(rectInside(control.owner, card)).toBe(true);
  expect(rectInside(control.neighbour, card)).toBe(true);
  expect(rectanglesOverlap(control.owner, control.neighbour)).toBe(false);
  expect(control.owner.x + control.owner.width).toBe(control.neighbour.x);
  expect(control.owner.y).toBe(control.neighbour.y);
  expect(control.owner.height).toBe(control.neighbour.height);
  expect(control.neighbourMaterial).toBe(material);
}

function cell(cells: Uint8Array, point: WaxGraphicsPoint): number {
  return cells[point.y * WORLD_WIDTH + point.x];
}

function assertRectCells(cells: Uint8Array, rect: WaxGraphicsRect, material: Material): void {
  forEachPoint(rect, (point) => expect(cell(cells, point)).toBe(material));
}

function assertPointCells(
  cells: Uint8Array,
  points: readonly WaxGraphicsPoint[],
  material: Material,
): void {
  for (const point of points) expect(cell(cells, point)).toBe(material);
}

function pointInside(point: WaxGraphicsPoint, rect: WaxGraphicsRect): boolean {
  return point.x >= rect.x && point.y >= rect.y
    && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

function rectInside(inner: WaxGraphicsRect, outer: WaxGraphicsRect): boolean {
  return pointInside(inner, outer)
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(left: WaxGraphicsRect, right: WaxGraphicsRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

function uniquePointKeys(points: readonly WaxGraphicsPoint[]): readonly string[] {
  return [...new Set(points.map(({ x, y }) => `${x},${y}`))];
}

function rectPoints(rect: WaxGraphicsRect): WaxGraphicsPoint[] {
  const points: WaxGraphicsPoint[] = [];
  forEachPoint(rect, (point) => points.push(point));
  return points;
}

function forEachPoint(
  rect: WaxGraphicsRect,
  visit: (point: WaxGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
