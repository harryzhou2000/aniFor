import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import {
  VIRUS_GRAPHICS_ATLAS,
  VIRUS_GRAPHICS_ATLAS_COLUMNS,
  VIRUS_GRAPHICS_ATLAS_ROWS,
  VIRUS_GRAPHICS_AUDIT,
  VIRUS_GRAPHICS_DEFINITIONS,
  prepareVirusGraphicsAuditFixture,
  type VirusGraphicsContactControl,
  type VirusGraphicsMotifProbeSet,
  type VirusGraphicsPoint,
  type VirusGraphicsRect,
} from './virus-graphics-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const VIRUS_IDS = [Material.VIRS, Material.VRSG, Material.VRSS];

class PaintTrackingBackend extends DeterministicBackend {
  paintCalls = 0;

  override paint(cx: number, cy: number, material: Material, radius: number): void {
    this.paintCalls++;
    super.paint(cx, cy, material, radius);
  }
}

describe('virus graphics audit fixture', () => {
  it('pins the three native virus phases in stable order', () => {
    expect(VIRUS_GRAPHICS_ATLAS_COLUMNS).toBe(3);
    expect(VIRUS_GRAPHICS_ATLAS_ROWS).toBe(1);
    expect(VIRUS_GRAPHICS_DEFINITIONS).toHaveLength(3);
    expect(VIRUS_GRAPHICS_ATLAS.map(({ material }) => material)).toEqual(VIRUS_IDS);
    expect(VIRUS_IDS).toEqual([62, 215, 216]);
    expect(VIRUS_GRAPHICS_ATLAS.map(({ code }) => code)).toEqual(['VIRS', 'VRSG', 'VRSS']);
    expect(VIRUS_GRAPHICS_ATLAS.map(({ phase }) => phase)).toEqual(['liquid', 'gas', 'solid']);

    for (const definition of VIRUS_GRAPHICS_DEFINITIONS) {
      const material = ALL_MATERIALS.find(({ id }) => id === definition.material);
      expect(material, definition.code).toBeDefined();
      expect(definition.color).toBe(material?.color);
      expect(material?.category).toBe({ liquid: 'liquids', gas: 'gases', solid: 'solids' }[
        definition.phase
      ]);
    }
    expect(VIRUS_GRAPHICS_AUDIT.liquidCards.map(({ code }) => code)).toEqual(['VIRS']);
    expect(VIRUS_GRAPHICS_AUDIT.gasCards.map(({ code }) => code)).toEqual(['VRSG']);
    expect(VIRUS_GRAPHICS_AUDIT.solidCards.map(({ code }) => code)).toEqual(['VRSS']);
  });

  it('keeps three disjoint cards and cross-phase bodies aligned modulo 16', () => {
    const world = { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT };
    for (const [index, entry] of VIRUS_GRAPHICS_ATLAS.entries()) {
      expect(entry.index).toBe(index);
      expect(entry.card).toEqual({ x: 4 + index * 192, y: 4, width: 188, height: 376 });
      expect(entry).toMatchObject({
        left: entry.card.x,
        top: entry.card.y,
        width: entry.card.width,
        height: entry.card.height,
      });
      expect(rectInside(entry.card, world)).toBe(true);
      expect(entry.body).toEqual({ x: 16 + index * 192, y: 20, width: 112, height: 112 });
      expect(entry.body.x % 16).toBe(0);
      expect(entry.body.y % 16).toBe(4);
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

    for (let left = 0; left < VIRUS_GRAPHICS_ATLAS.length; left++) {
      for (let right = left + 1; right < VIRUS_GRAPHICS_ATLAS.length; right++) {
        expect(rectanglesOverlap(
          VIRUS_GRAPHICS_ATLAS[left].card,
          VIRUS_GRAPHICS_ATLAS[right].card,
        )).toBe(false);
      }
    }
  });

  it('provides phase-specific fine topology and protected gas gaps', () => {
    const [liquid, gas, solid] = VIRUS_GRAPHICS_ATLAS;
    expect(liquid.phaseStructureKind).toBe('strand');
    expect(liquid.phaseStructure).toHaveLength(24);
    expect(liquid.phaseGap).toBeUndefined();
    expect(liquid.shell).toBeUndefined();

    expect(gas.phaseStructureKind).toBe('wisps');
    expect(gas.phaseStructure).toHaveLength(24);
    expect(gas.phaseGap).toBeDefined();
    expect(gas.shell).toBeUndefined();
    expect(rectInside(gas.phaseGap!, gas.card)).toBe(true);
    expect(gas.phaseStructure.every((point) => !pointInside(point, gas.phaseGap!))).toBe(true);

    expect(solid.phaseStructureKind).toBe('spur-shell');
    expect(solid.phaseStructure).toHaveLength(24 + 68);
    expect(solid.phaseGap).toBeUndefined();
    expect(solid.shell).toBeDefined();
    expect(rectInside(solid.shell!.outer, solid.card)).toBe(true);
    expect(rectInside(solid.shell!.interior, solid.shell!.outer)).toBe(true);
    expect(solid.shell!.outer.width * solid.shell!.outer.height
      - solid.shell!.interior.width * solid.shell!.interior.height).toBe(68);

    for (const entry of VIRUS_GRAPHICS_ATLAS) {
      expect(uniquePointKeys(entry.phaseStructure)).toHaveLength(entry.phaseStructure.length);
      for (const point of entry.phaseStructure) {
        expect(pointInside(point, entry.card)).toBe(true);
        expect(pointInside(point, entry.body)).toBe(false);
        expect(pointInside(point, entry.guardedBlank)).toBe(false);
      }
    }
    expect(VIRUS_GRAPHICS_AUDIT.phaseStructures).toHaveLength(140);
  });

  it('exposes equivalent half-resolution-safe motif probes for all phases', () => {
    const probeCounts = VIRUS_GRAPHICS_ATLAS.map(({ motifProbes }) => motifProbes.length);
    expect(new Set(probeCounts)).toHaveLength(1);
    expect(probeCounts[0]).toBeGreaterThan(30);

    const referenceSignature = relativeMotifSignature(VIRUS_GRAPHICS_ATLAS[0]);
    for (const entry of VIRUS_GRAPHICS_ATLAS) {
      expect(relativeMotifSignature(entry)).toEqual(referenceSignature);
      for (const probe of entry.motifProbes) {
        expect(probe.tileOrigin.x % 16).toBe(0);
        expect(probe.tileOrigin.y % 16).toBe(0);
        const regions = motifRects(probe);
        expect(regions).toHaveLength(5);
        expect(uniquePointKeys(regions.flatMap(rectPoints))).toHaveLength(5 * 4);
        for (const rect of regions) {
          expect(rect).toMatchObject({ width: 2, height: 2 });
          expect(rect.x % 2).toBe(0);
          expect(rect.y % 2).toBe(0);
          expect(rectInside(rect, entry.body)).toBe(true);
          expect(rectanglesOverlap(rect, entry.authoredCavity)).toBe(false);
          expect(rectanglesOverlap(rect, entry.openChimney)).toBe(false);
        }
      }
    }
    expect(VIRUS_GRAPHICS_AUDIT.motifProbes)
      .toHaveLength(probeCounts[0] * VIRUS_GRAPHICS_ATLAS.length);
  });

  it('direct-fills exact ownership, openings, structures, isolation, and contacts without paint', () => {
    const simulation = new PaintTrackingBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareVirusGraphicsAuditFixture(simulation);
    const cells = simulation.cells();

    for (const entry of VIRUS_GRAPHICS_ATLAS) {
      forEachPoint(entry.body, (point) => {
        const empty = pointInside(point, entry.authoredCavity)
          || pointInside(point, entry.openChimney);
        expect(cell(cells, point)).toBe(empty ? Material.Empty : entry.material);
      });
      assertRectCells(cells, entry.authoredCavity, Material.Empty);
      assertRectCells(cells, entry.openChimney, Material.Empty);
      assertPointCells(cells, entry.phaseStructure, entry.material);
      if (entry.phaseGap) assertRectCells(cells, entry.phaseGap, Material.Empty);
      if (entry.shell) assertRectCells(cells, entry.shell.interior, Material.Empty);
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
    prepareVirusGraphicsAuditFixture(first);
    prepareVirusGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());

    const firstPass = first.cells().slice();
    first.cells().fill(Material.Fire);
    prepareVirusGraphicsAuditFixture(first);
    expect(first.cells()).toEqual(firstPass);

    expect(() => prepareVirusGraphicsAuditFixture(new DeterministicBackend(32, 32)))
      .toThrow('requires 612x384');
    const wrongBackend = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    Object.defineProperty(wrongBackend, 'name', { value: 'not deterministic' });
    expect(() => prepareVirusGraphicsAuditFixture(wrongBackend))
      .toThrow('requires the deterministic backend');
  });
});

function relativeMotifSignature(entry: (typeof VIRUS_GRAPHICS_ATLAS)[number]): unknown {
  const relativeRect = (rect: VirusGraphicsRect) => ({
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
    attachment: relativeRect(probe.attachment),
    membrane: relativeRect(probe.membrane),
    capsid: relativeRect(probe.capsid),
    core: relativeRect(probe.core),
    interstitial: relativeRect(probe.interstitial),
  }));
}

function motifRects(probe: VirusGraphicsMotifProbeSet): readonly VirusGraphicsRect[] {
  return [probe.attachment, probe.membrane, probe.capsid, probe.core, probe.interstitial];
}

function verifyContact(
  control: VirusGraphicsContactControl,
  card: VirusGraphicsRect,
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

function cell(cells: Uint8Array, point: VirusGraphicsPoint): number {
  return cells[point.y * WORLD_WIDTH + point.x];
}

function assertRectCells(cells: Uint8Array, rect: VirusGraphicsRect, material: Material): void {
  forEachPoint(rect, (point) => expect(cell(cells, point)).toBe(material));
}

function assertPointCells(
  cells: Uint8Array,
  points: readonly VirusGraphicsPoint[],
  material: Material,
): void {
  for (const point of points) expect(cell(cells, point)).toBe(material);
}

function pointInside(point: VirusGraphicsPoint, rect: VirusGraphicsRect): boolean {
  return point.x >= rect.x && point.y >= rect.y
    && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

function rectInside(inner: VirusGraphicsRect, outer: VirusGraphicsRect): boolean {
  return pointInside(inner, outer)
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(left: VirusGraphicsRect, right: VirusGraphicsRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

function uniquePointKeys(points: readonly VirusGraphicsPoint[]): readonly string[] {
  return [...new Set(points.map(({ x, y }) => `${x},${y}`))];
}

function rectPoints(rect: VirusGraphicsRect): VirusGraphicsPoint[] {
  const points: VirusGraphicsPoint[] = [];
  forEachPoint(rect, (point) => points.push(point));
  return points;
}

function forEachPoint(
  rect: VirusGraphicsRect,
  visit: (point: VirusGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
