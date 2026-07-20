import { describe, expect, it } from 'vitest';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { ALL_MATERIALS, Material } from '../shared/materials';
import {
  MATERIAL_ATLAS, MATERIAL_ATLAS_BLOCK_RADIUS, prepareMaterialAtlasAuditFixture,
  materialAtlasAuditRequested,
} from './material-atlas-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;

describe('composed material atlas audit fixture', () => {
  it('requires the explicit material-atlas audit stage', () => {
    expect(materialAtlasAuditRequested('?scene=render-lab&auditStage=material-atlas')).toBe(true);
    expect(materialAtlasAuditRequested('?scene=render-lab&inputAudit=1')).toBe(false);
    expect(materialAtlasAuditRequested('?auditStage=material-atlas-blank')).toBe(false);
  });

  it('assigns every projected material one isolated in-bounds block', () => {
    expect(MATERIAL_ATLAS.map(({ id }) => id)).toEqual(ALL_MATERIALS.map(({ id }) => id));
    expect(new Set(MATERIAL_ATLAS.map(({ id }) => id)).size).toBe(ALL_MATERIALS.length);
    for (const entry of MATERIAL_ATLAS) {
      expect(entry.radius).toBe(MATERIAL_ATLAS_BLOCK_RADIUS);
      expect(entry.x - entry.radius).toBeGreaterThanOrEqual(0);
      expect(entry.y - entry.radius).toBeGreaterThanOrEqual(0);
      expect(entry.x + entry.radius).toBeLessThan(WORLD_WIDTH);
      expect(entry.y + entry.radius).toBeLessThan(WORLD_HEIGHT);
    }
    for (let left = 0; left < MATERIAL_ATLAS.length; left++) {
      for (let right = left + 1; right < MATERIAL_ATLAS.length; right++) {
        const a = MATERIAL_ATLAS[left];
        const b = MATERIAL_ATLAS[right];
        expect(Math.abs(a.x - b.x) > a.radius + b.radius + 2
          || Math.abs(a.y - b.y) > a.radius + b.radius + 2).toBe(true);
      }
    }
  });

  it('paints exact ownership and leaves every guard ring empty', () => {
    const simulation = new DeterministicBackend(WORLD_WIDTH, WORLD_HEIGHT);
    prepareMaterialAtlasAuditFixture(simulation);
    const cells = simulation.cells();
    let occupied = 0;
    for (const entry of MATERIAL_ATLAS) {
      for (let y = entry.y - entry.radius; y <= entry.y + entry.radius; y++) {
        for (let x = entry.x - entry.radius; x <= entry.x + entry.radius; x++) {
          expect(cells[y * WORLD_WIDTH + x]).toBe(entry.id);
          occupied++;
        }
      }
      const guard = entry.radius + 2;
      for (let offset = -guard; offset <= guard; offset++) {
        expect(cells[(entry.y - guard) * WORLD_WIDTH + entry.x + offset]).toBe(Material.Empty);
        expect(cells[(entry.y + guard) * WORLD_WIDTH + entry.x + offset]).toBe(Material.Empty);
        expect(cells[(entry.y + offset) * WORLD_WIDTH + entry.x - guard]).toBe(Material.Empty);
        expect(cells[(entry.y + offset) * WORLD_WIDTH + entry.x + guard]).toBe(Material.Empty);
      }
    }
    expect(cells.reduce((count, material) => count + Number(material !== Material.Empty), 0)).toBe(occupied);
  });
});
