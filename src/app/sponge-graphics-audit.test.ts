import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import {
  SPONGE_GRAPHICS_ATLAS, SPONGE_GRAPHICS_AUDIT, prepareSpongeGraphicsAuditFixture,
  type SpongeGraphicsPoint, type SpongeGraphicsRect,
} from './sponge-graphics-audit';

const WIDTH = 612;
const HEIGHT = 384;

describe('sponge graphics audit fixture', () => {
  it('pins one in-bounds porous scene with exact topology and contact controls', () => {
    const entry = SPONGE_GRAPHICS_ATLAS[0];
    expect(SPONGE_GRAPHICS_ATLAS).toHaveLength(1);
    expect(entry).toMatchObject({ material: 81, code: 'SPNG', color: '#ffbe30' });
    for (const rect of [entry.body, ...entry.holes, ...entry.openNotches, ...entry.ribs,
      entry.guardedBlank, ...entry.contacts.flatMap(({ owner, neighbour }) => [owner, neighbour])]) {
      expect(rectInside(rect, entry.card)).toBe(true);
    }
    expect(SPONGE_GRAPHICS_AUDIT.holes).toHaveLength(232);
    expect(SPONGE_GRAPHICS_AUDIT.openNotches).toHaveLength(208);
    expect(SPONGE_GRAPHICS_AUDIT.fineStructures).toHaveLength(344);
    expect(SPONGE_GRAPHICS_AUDIT.contacts.map(({ neighbourMaterial }) => neighbourMaterial))
      .toEqual([Material.Water, Material.Metal, Material.Sand]);
    expect(SPONGE_GRAPHICS_AUDIT.porePairs.length).toBeGreaterThan(180);
    expect(SPONGE_GRAPHICS_AUDIT.porePairs.every(({ core, litRim }) => (
      pointInside(core, entry.body) && pointInside(litRim, entry.body)
    ))).toBe(true);
  });

  it('direct-fills authoritative holes, notches, ribs, isolation, and contacts', () => {
    const simulation = new DeterministicBackend(WIDTH, HEIGHT);
    prepareSpongeGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    const entry = SPONGE_GRAPHICS_ATLAS[0];
    for (const point of SPONGE_GRAPHICS_AUDIT.holes) expect(cell(cells, point)).toBe(Material.Empty);
    for (const point of SPONGE_GRAPHICS_AUDIT.openNotches) expect(cell(cells, point)).toBe(Material.Empty);
    for (const point of SPONGE_GRAPHICS_AUDIT.fineStructures) expect(cell(cells, point)).toBe(Material.SPNG);
    expect(cell(cells, entry.isolated)).toBe(Material.SPNG);
    for (const contact of entry.contacts) {
      forEachPoint(contact.owner, (point) => expect(cell(cells, point)).toBe(Material.SPNG));
      forEachPoint(contact.neighbour, (point) => expect(cell(cells, point)).toBe(contact.neighbourMaterial));
      expect(contact.owner.x + contact.owner.width).toBe(contact.neighbour.x);
    }
    forEachPoint(entry.guardedBlank, (point) => expect(cell(cells, point)).toBe(Material.Empty));
    for (const pair of entry.porePairs) {
      expect(cell(cells, pair.core)).toBe(Material.SPNG);
      expect(cell(cells, pair.litRim)).toBe(Material.SPNG);
    }
  });

  it('is byte deterministic and rejects unsupported backends and geometry', () => {
    const first = new DeterministicBackend(WIDTH, HEIGHT);
    const second = new DeterministicBackend(WIDTH, HEIGHT);
    prepareSpongeGraphicsAuditFixture(first);
    prepareSpongeGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());
    expect(() => prepareSpongeGraphicsAuditFixture(new DeterministicBackend(32, 32)))
      .toThrow('requires 612x384');
    const wrong = new DeterministicBackend(WIDTH, HEIGHT);
    Object.defineProperty(wrong, 'name', { value: 'wrong backend' });
    expect(() => prepareSpongeGraphicsAuditFixture(wrong)).toThrow('requires the deterministic backend');
  });
});

function cell(cells: Uint8Array, point: SpongeGraphicsPoint): number {
  return cells[point.y * WIDTH + point.x];
}
function pointInside(point: SpongeGraphicsPoint, rect: SpongeGraphicsRect): boolean {
  return point.x >= rect.x && point.y >= rect.y
    && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}
function rectInside(inner: SpongeGraphicsRect, outer: SpongeGraphicsRect): boolean {
  return pointInside(inner, outer)
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}
function forEachPoint(rect: SpongeGraphicsRect, visit: (point: SpongeGraphicsPoint) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
