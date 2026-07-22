import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import {
  PASTE_RESIST_GRAPHICS_ATLAS,
  PASTE_RESIST_GRAPHICS_ATLAS_COLUMNS,
  PASTE_RESIST_GRAPHICS_ATLAS_ROWS,
  PASTE_RESIST_GRAPHICS_AUDIT,
  PASTE_RESIST_GRAPHICS_DEFINITIONS,
  preparePasteResistGraphicsAuditFixture,
  type PasteResistGraphicsAtlasEntry,
  type PasteResistGraphicsContactControl,
  type PasteResistGraphicsMotifProbeSet,
  type PasteResistGraphicsPoint,
  type PasteResistGraphicsRect,
} from './paste-resist-graphics-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const MATERIAL_IDS = [Material.PSTE, Material.PSTS, Material.RSST, Material.RSSS];
const STRUCTURE_COUNTS = [85, 145, 133, 200];

class PaintTrackingBackend extends DeterministicBackend {
  paintCalls = 0;

  override paint(cx: number, cy: number, material: Material, radius: number): void {
    this.paintCalls++;
    super.paint(cx, cy, material, radius);
  }
}

describe('paste/resist graphics audit fixture', () => {
  it('pins both native phase pairs in stable family order', () => {
    expect(PASTE_RESIST_GRAPHICS_ATLAS_COLUMNS).toBe(2);
    expect(PASTE_RESIST_GRAPHICS_ATLAS_ROWS).toBe(2);
    expect(PASTE_RESIST_GRAPHICS_DEFINITIONS).toHaveLength(4);
    expect(MATERIAL_IDS).toEqual([60, 206, 61, 79]);
    expect(PASTE_RESIST_GRAPHICS_ATLAS.map(({ material }) => material)).toEqual(MATERIAL_IDS);
    expect(PASTE_RESIST_GRAPHICS_ATLAS.map(({ code }) => code))
      .toEqual(['PSTE', 'PSTS', 'RSST', 'RSSS']);
    expect(PASTE_RESIST_GRAPHICS_ATLAS.map(({ family }) => family))
      .toEqual(['paste', 'paste', 'resist', 'resist']);
    expect(PASTE_RESIST_GRAPHICS_ATLAS.map(({ phase }) => phase))
      .toEqual(['liquid', 'solid', 'liquid', 'solid']);
    expect(PASTE_RESIST_GRAPHICS_ATLAS.map(({ structureKind }) => structureKind)).toEqual([
      'paste-rivulet', 'pressed-column', 'resist-film', 'hardened-mask',
    ]);
    expect(PASTE_RESIST_GRAPHICS_ATLAS.map(({ phasePartnerMaterial }) => phasePartnerMaterial))
      .toEqual([Material.PSTS, Material.PSTE, Material.RSSS, Material.RSST]);

    for (const definition of PASTE_RESIST_GRAPHICS_DEFINITIONS) {
      const material = ALL_MATERIALS.find(({ id }) => id === definition.material);
      expect(material, definition.code).toBeDefined();
      expect(material?.color).toBe(definition.color);
      expect(material?.category).toBe(definition.phase === 'liquid' ? 'liquids' : 'solids');
    }
    expect(PASTE_RESIST_GRAPHICS_AUDIT.pasteCards.map(({ code }) => code))
      .toEqual(['PSTE', 'PSTS']);
    expect(PASTE_RESIST_GRAPHICS_AUDIT.resistCards.map(({ code }) => code))
      .toEqual(['RSST', 'RSSS']);
    expect(PASTE_RESIST_GRAPHICS_AUDIT.liquidCards.map(({ code }) => code))
      .toEqual(['PSTE', 'RSST']);
    expect(PASTE_RESIST_GRAPHICS_AUDIT.solidCards.map(({ code }) => code))
      .toEqual(['PSTS', 'RSSS']);
  });

  it('lays out four disjoint normal-fit cards with congruent modulo-32 bodies', () => {
    const world = { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT };
    for (const [index, entry] of PASTE_RESIST_GRAPHICS_ATLAS.entries()) {
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
      expect(entry.authoredCavity).toEqual({
        x: entry.body.x + 58,
        y: entry.body.y + 45,
        width: 12,
        height: 10,
      });
      expect(rectInside(entry.authoredCavity, entry.body)).toBe(true);
      expect(entry.openChimney).toEqual({
        x: entry.body.x + 62,
        y: entry.body.y,
        width: 4,
        height: 45,
      });
      expect(entry.openChimney.y + entry.openChimney.height)
        .toBe(entry.authoredCavity.y);
      expect(entry.openChimney.x).toBeGreaterThanOrEqual(entry.authoredCavity.x);
      expect(entry.openChimney.x + entry.openChimney.width)
        .toBeLessThanOrEqual(entry.authoredCavity.x + entry.authoredCavity.width);
      expect(rectanglesOverlap(entry.openChimney, entry.authoredCavity)).toBe(false);
      expect(rectInside(entry.body, entry.haloOuter)).toBe(true);
      expect(rectInside(entry.haloOuter, entry.card)).toBe(true);
      expect(rectInside(entry.guardedBlank, entry.card)).toBe(true);
      expect(entry.guardedBlank.width * entry.guardedBlank.height).toBe(2_800);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.body)).toBe(false);
      expect(pointInside(entry.isolated, entry.guardedBlank)).toBe(false);
      verifyContact(entry.familyContact, entry.card, entry.phasePartnerMaterial);
      verifyContact(entry.metalContact, entry.card, Material.Metal);
      expect(rectanglesOverlap(entry.familyContact.owner, entry.metalContact.owner)).toBe(false);
    }
    for (let left = 0; left < PASTE_RESIST_GRAPHICS_ATLAS.length; left++) {
      for (let right = left + 1; right < PASTE_RESIST_GRAPHICS_ATLAS.length; right++) {
        expect(rectanglesOverlap(
          PASTE_RESIST_GRAPHICS_ATLAS[left].card,
          PASTE_RESIST_GRAPHICS_ATLAS[right].card,
        )).toBe(false);
      }
    }
  });

  it('provides exact phase-specific thin structures without erasing controls', () => {
    expect(PASTE_RESIST_GRAPHICS_ATLAS.map(({ phaseStructure }) => phaseStructure.length))
      .toEqual(STRUCTURE_COUNTS);
    for (const [index, entry] of PASTE_RESIST_GRAPHICS_ATLAS.entries()) {
      expect(uniquePointKeys(entry.phaseStructure)).toHaveLength(STRUCTURE_COUNTS[index]);
      for (const point of entry.phaseStructure) {
        expect(pointInside(point, entry.card)).toBe(true);
        expect(pointInside(point, entry.body)).toBe(false);
        expect(pointInside(point, entry.guardedBlank)).toBe(false);
        expect(pointInside(point, entry.familyContact.owner)).toBe(false);
        expect(pointInside(point, entry.familyContact.neighbour)).toBe(false);
        expect(pointInside(point, entry.metalContact.owner)).toBe(false);
        expect(pointInside(point, entry.metalContact.neighbour)).toBe(false);
      }
      const attachedStem = entry.phaseStructure.filter(({ x, y }) => (
        x === entry.body.x + 71
          && y >= entry.body.y + entry.body.height
          && y < entry.body.y + entry.body.height + 24
      ));
      expect(attachedStem).toHaveLength(24);
    }
    expect(PASTE_RESIST_GRAPHICS_AUDIT.phaseStructures).toHaveLength(563);
  });

  it('exposes eight equivalent 32-cell motif probe sets in every family phase', () => {
    expect(PASTE_RESIST_GRAPHICS_ATLAS.map(({ motifProbes }) => motifProbes.length))
      .toEqual([8, 8, 8, 8]);
    const referenceSignature = relativeMotifSignature(PASTE_RESIST_GRAPHICS_ATLAS[0]);
    for (const entry of PASTE_RESIST_GRAPHICS_ATLAS) {
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
    expect(PASTE_RESIST_GRAPHICS_AUDIT.motifProbes).toHaveLength(32);
  });

  it('direct-fills exact ownership, air, structures, and contacts without paint', () => {
    const simulation = new PaintTrackingBackend(WORLD_WIDTH, WORLD_HEIGHT);
    preparePasteResistGraphicsAuditFixture(simulation);
    const cells = simulation.cells();

    for (const entry of PASTE_RESIST_GRAPHICS_ATLAS) {
      let occupiedBody = 0;
      forEachPoint(entry.body, (point) => {
        const empty = pointInside(point, entry.authoredCavity)
          || pointInside(point, entry.openChimney);
        expect(cell(cells, point)).toBe(empty ? Material.Empty : entry.material);
        occupiedBody += Number(!empty);
      });
      expect(occupiedBody).toBe(14_676);
      assertRectCells(cells, entry.authoredCavity, Material.Empty);
      assertRectCells(cells, entry.openChimney, Material.Empty);
      assertPointCells(cells, entry.phaseStructure, entry.material);
      expect(cell(cells, entry.isolated)).toBe(entry.material);
      assertRectCells(cells, entry.guardedBlank, Material.Empty);
      assertRectCells(cells, entry.familyContact.owner, entry.material);
      assertRectCells(cells, entry.familyContact.neighbour, entry.phasePartnerMaterial);
      assertRectCells(cells, entry.metalContact.owner, entry.material);
      assertRectCells(cells, entry.metalContact.neighbour, Material.Metal);
      for (const probe of entry.motifProbes) {
        for (const rect of motifRects(probe)) assertRectCells(cells, rect, entry.material);
      }
    }
    expect(cells.reduce((count, material) => count + Number(material !== Material.Empty), 0))
      .toBe(62_855);
    expect(simulation.paintCalls).toBe(0);
  });

  it('is byte deterministic and rejects unsupported backends and geometry', () => {
    const first = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    const second = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    preparePasteResistGraphicsAuditFixture(first);
    preparePasteResistGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());

    const firstPass = first.cells().slice();
    first.cells().fill(Material.Fire);
    preparePasteResistGraphicsAuditFixture(first);
    expect(first.cells()).toEqual(firstPass);

    expect(() => preparePasteResistGraphicsAuditFixture(new DeterministicBackend(32, 32)))
      .toThrow('requires 612x384');
    const wrongBackend = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    Object.defineProperty(wrongBackend, 'name', { value: 'not deterministic' });
    expect(() => preparePasteResistGraphicsAuditFixture(wrongBackend))
      .toThrow('requires the deterministic backend');
  });
});

function relativeMotifSignature(entry: PasteResistGraphicsAtlasEntry): unknown {
  const relativeRect = (rect: PasteResistGraphicsRect) => ({
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

function motifRects(
  probe: PasteResistGraphicsMotifProbeSet,
): readonly PasteResistGraphicsRect[] {
  return [probe.ridge, probe.fold, probe.bloom, probe.joint, probe.interstitial];
}

function verifyContact(
  control: PasteResistGraphicsContactControl,
  card: PasteResistGraphicsRect,
  material: PasteResistGraphicsContactControl['neighbourMaterial'],
): void {
  expect(rectInside(control.owner, card)).toBe(true);
  expect(rectInside(control.neighbour, card)).toBe(true);
  expect(rectanglesOverlap(control.owner, control.neighbour)).toBe(false);
  expect(control.owner.x + control.owner.width).toBe(control.neighbour.x);
  expect(control.owner.y).toBe(control.neighbour.y);
  expect(control.owner.height).toBe(control.neighbour.height);
  expect(control.neighbourMaterial).toBe(material);
}

function cell(cells: Uint8Array, point: PasteResistGraphicsPoint): number {
  return cells[point.y * WORLD_WIDTH + point.x];
}

function assertRectCells(
  cells: Uint8Array,
  rect: PasteResistGraphicsRect,
  material: Material,
): void {
  forEachPoint(rect, (point) => expect(cell(cells, point)).toBe(material));
}

function assertPointCells(
  cells: Uint8Array,
  points: readonly PasteResistGraphicsPoint[],
  material: Material,
): void {
  for (const point of points) expect(cell(cells, point)).toBe(material);
}

function forEachPoint(
  rect: PasteResistGraphicsRect,
  visit: (point: PasteResistGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}

function rectPoints(rect: PasteResistGraphicsRect): PasteResistGraphicsPoint[] {
  const points: PasteResistGraphicsPoint[] = [];
  forEachPoint(rect, (point) => points.push(point));
  return points;
}

function uniquePointKeys(points: readonly PasteResistGraphicsPoint[]): Set<string> {
  return new Set(points.map(({ x, y }) => `${x},${y}`));
}

function pointInside(
  point: PasteResistGraphicsPoint,
  rect: PasteResistGraphicsRect,
): boolean {
  return point.x >= rect.x && point.y >= rect.y
    && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

function rectInside(
  inner: PasteResistGraphicsRect,
  outer: PasteResistGraphicsRect,
): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(
  left: PasteResistGraphicsRect,
  right: PasteResistGraphicsRect,
): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}
