import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  DISTILLED_DIESEL_LIQUID_GRAPHICS_ATLAS,
  DISTILLED_DIESEL_LIQUID_GRAPHICS_AUDIT,
  prepareDistilledDieselLiquidGraphicsAuditFixture,
} from './distilled-diesel-liquid-graphics-audit';

describe('Distilled Water / Diesel liquid graphics audit fixture', () => {
  it('pins the two exact liquid owners and their related-liquid seams', () => {
    expect(DISTILLED_DIESEL_LIQUID_GRAPHICS_ATLAS.map(({ material }) => material))
      .toEqual([Material.DistilledWater, Material.Diesel]);
    expect(DISTILLED_DIESEL_LIQUID_GRAPHICS_ATLAS.map(({ siblingSeam }) => siblingSeam.siblingMaterial))
      .toEqual([Material.Water, Material.Oil]);
    expect(DISTILLED_DIESEL_LIQUID_GRAPHICS_AUDIT.cavities).toHaveLength(2 * 12 * 12);
    expect(DISTILLED_DIESEL_LIQUID_GRAPHICS_AUDIT.openChimneys).toHaveLength(2 * 4 * 58);
  });

  it('keeps sparse forms, native walls, and exact seams disjoint from body support', () => {
    for (const entry of DISTILLED_DIESEL_LIQUID_GRAPHICS_ATLAS) {
      expect(entry.strand.width).toBe(1);
      expect(entry.wallCoexistence.x % 4).toBe(0);
      expect(entry.wallCoexistence.y % 4).toBe(0);
      expect(entry.siblingSeam.owner.x + entry.siblingSeam.owner.width).toBe(entry.siblingSeam.sibling.x);
      expect(entry.metalContact.owner.x + entry.metalContact.owner.width).toBe(entry.metalContact.metal.x);
      expect(entry.guardedBlank.width).toBeGreaterThan(0);
      expect(entry.card.x + entry.card.width).toBeLessThanOrEqual(612);
      expect(entry.card.y + entry.card.height).toBeLessThanOrEqual(384);
    }
  });

  it('direct-fills exact open liquid topology, sibling seams, and native walls', () => {
    const simulation = new RenderLabBackend(612, 384);
    prepareDistilledDieselLiquidGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    const walls = simulation.walls();
    let expectedOccupied = 0;
    for (const entry of DISTILLED_DIESEL_LIQUID_GRAPHICS_ATLAS) {
      expect(cells[index(entry.surfaceProbe.x, entry.surfaceProbe.y)]).toBe(entry.material);
      expect(cells[index(entry.coreProbe.x, entry.coreProbe.y)]).toBe(entry.material);
      expect(cells[index(entry.cavity.x, entry.cavity.y)]).toBe(Material.Empty);
      expect(cells[index(entry.openChimney.x, entry.openChimney.y)]).toBe(Material.Empty);
      expect(cells[index(entry.strand.x, entry.strand.y)]).toBe(entry.material);
      expect(cells[index(entry.isolated.x, entry.isolated.y)]).toBe(entry.material);
      expect(cells[index(entry.siblingSeam.owner.x, entry.siblingSeam.owner.y)]).toBe(entry.material);
      expect(cells[index(entry.siblingSeam.sibling.x, entry.siblingSeam.sibling.y)])
        .toBe(entry.siblingSeam.siblingMaterial);
      expect(cells[index(entry.metalContact.owner.x, entry.metalContact.owner.y)]).toBe(entry.material);
      expect(cells[index(entry.metalContact.metal.x, entry.metalContact.metal.y)]).toBe(Material.Metal);
      expect(cells[index(entry.guardedBlank.x, entry.guardedBlank.y)]).toBe(Material.Empty);
      expect(cells[index(entry.wallCoexistence.x, entry.wallCoexistence.y)]).toBe(entry.material);
      expect(walls[index(entry.wallCoexistence.x, entry.wallCoexistence.y)]).toBe(1);
      expect(walls[index(entry.wallCoexistence.x + 31, entry.wallCoexistence.y + 31)]).toBe(1);
      expectedOccupied += entry.body.width * entry.body.height
        - entry.cavity.width * entry.cavity.height
        - entry.openChimney.width * entry.openChimney.height
        + entry.strand.width * entry.strand.height + 1
        + entry.wallCoexistence.width * entry.wallCoexistence.height
        + entry.siblingSeam.owner.width * entry.siblingSeam.owner.height
        + entry.siblingSeam.sibling.width * entry.siblingSeam.sibling.height
        + entry.metalContact.owner.width * entry.metalContact.owner.height
        + entry.metalContact.metal.width * entry.metalContact.metal.height;
    }
    expect(cells.reduce((count, material) => count + Number(material !== Material.Empty), 0))
      .toBe(expectedOccupied);
  });
});

function index(x: number, y: number): number { return y * 612 + x; }
