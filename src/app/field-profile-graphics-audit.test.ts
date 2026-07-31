import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import {
  FIELD_PROFILE_GRAPHICS_ATLAS,
  FIELD_PROFILE_GRAPHICS_ATLAS_COLUMNS,
  FIELD_PROFILE_GRAPHICS_ATLAS_ROWS,
  FIELD_PROFILE_GRAPHICS_AUDIT,
  prepareFieldProfileGraphicsAuditFixture,
  type FieldProfileGraphicsPoint,
  type FieldProfileGraphicsRect,
} from './field-profile-graphics-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const FIELD_IDS = [
  Material.BHOL, Material.NBHL, Material.VOID, Material.PRTI,
  Material.PRTO, Material.TRON, Material.NWHL, Material.WHOL,
];

function inside(point: FieldProfileGraphicsPoint, rect: FieldProfileGraphicsRect): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function points(rect: FieldProfileGraphicsRect): FieldProfileGraphicsPoint[] {
  const result: FieldProfileGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) result.push({ x, y });
  }
  return result;
}

describe('Field-profile graphics audit fixture', () => {
  it('pins all eight default-optics Field owners in a compact in-bounds atlas', () => {
    expect(FIELD_PROFILE_GRAPHICS_ATLAS_COLUMNS).toBe(4);
    expect(FIELD_PROFILE_GRAPHICS_ATLAS_ROWS).toBe(2);
    expect(FIELD_PROFILE_GRAPHICS_ATLAS.map(({ material }) => material)).toEqual(FIELD_IDS);
    for (const [index, entry] of FIELD_PROFILE_GRAPHICS_ATLAS.entries()) {
      expect(entry.index).toBe(index);
      expect(entry.card.x + entry.card.width).toBeLessThanOrEqual(WORLD_WIDTH);
      expect(entry.card.y + entry.card.height).toBeLessThanOrEqual(WORLD_HEIGHT);
      for (const rect of [entry.body, entry.pairedBody, entry.authoredHole, entry.openChannel,
        entry.thinRail, entry.guardedBlank, ...Object.values(entry.controls)]) {
        expect(inside(rect, entry.card)).toBe(true);
      }
    }
    expect(FIELD_PROFILE_GRAPHICS_AUDIT.cards).toBe(FIELD_PROFILE_GRAPHICS_ATLAS);
    expect(FIELD_PROFILE_GRAPHICS_AUDIT.bodies).toHaveLength(8);
    expect(FIELD_PROFILE_GRAPHICS_AUDIT.pairedBodies).toHaveLength(8);
    expect(FIELD_PROFILE_GRAPHICS_AUDIT.authoredHoles).toHaveLength(8 * 25);
    expect(FIELD_PROFILE_GRAPHICS_AUDIT.openChannels).toHaveLength(8 * 20);
    expect(FIELD_PROFILE_GRAPHICS_AUDIT.thinRails).toHaveLength(8 * 38);
  });

  it('direct-fills exact owners, protected holes/channels, and neutral controls', () => {
    const simulation = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareFieldProfileGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    for (const entry of FIELD_PROFILE_GRAPHICS_ATLAS) {
      for (const point of points(entry.body)) {
        const expected = inside(point, entry.authoredHole) || inside(point, entry.openChannel)
          ? Material.Empty : entry.material;
        expect(cells[point.y * WORLD_WIDTH + point.x]).toBe(expected);
      }
      for (const point of points(entry.pairedBody)) {
        expect(cells[point.y * WORLD_WIDTH + point.x]).toBe(entry.material);
      }
      for (const point of points(entry.thinRail)) {
        expect(cells[point.y * WORLD_WIDTH + point.x]).toBe(entry.material);
      }
      expect(cells[entry.isolated.y * WORLD_WIDTH + entry.isolated.x]).toBe(entry.material);
      for (const point of points(entry.guardedBlank)) {
        expect(cells[point.y * WORLD_WIDTH + point.x]).toBe(Material.Empty);
      }
      for (const point of points(entry.controls.force)) {
        expect(cells[point.y * WORLD_WIDTH + point.x]).toBe(Material.ACEL);
      }
      for (const point of points(entry.controls.device)) {
        expect(cells[point.y * WORLD_WIDTH + point.x]).toBe(Material.DTEC);
      }
      for (const point of points(entry.controls.role)) {
        expect(cells[point.y * WORLD_WIDTH + point.x]).toBe(Material.CONV);
      }
    }
  });
});
