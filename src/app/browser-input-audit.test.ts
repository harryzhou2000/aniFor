import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { Material } from '../shared/materials';
import {
  blankBrowserInputAuditRequested, browserInputAuditRequested,
  prepareContourStressAuditFixture, prepareDenseSolidAuditFixture,
  prepareSolidFieldLightingAuditFixture, toggleDenseSolidAuditProbe,
} from './browser-input-audit';

describe('browser input audit gate', () => {
  it('uses strict teardown only behind the audit bridge', () => {
    const source = readFileSync(new URL('./game.ts', import.meta.url), 'utf8');
    expect(source).toContain(
      'disposeRendererForNavigation: () => this.renderer.disposeForAudit()',
    );
    expect(source).toContain('prepare: () => this.renderer.disposeForNavigation()');
  });

  it('requires the explicit diagnostic query', () => {
    expect(browserInputAuditRequested('?scene=render-lab&inputAudit=1')).toBe(true);
    expect(browserInputAuditRequested('?scene=showcase&inputAudit=1')).toBe(true);
    expect(browserInputAuditRequested('?scene=render-lab')).toBe(false);
    expect(browserInputAuditRequested('?inputAudit=0')).toBe(false);
  });

  it('allows a blank startup only inside the explicit input audit', () => {
    expect(blankBrowserInputAuditRequested('?scene=render-lab&inputAudit=1&blankAudit=1')).toBe(true);
    expect(blankBrowserInputAuditRequested('?scene=render-lab&blankAudit=1')).toBe(false);
    expect(blankBrowserInputAuditRequested('?inputAudit=1')).toBe(false);
  });

  it('builds and advances the deterministic dense-solid timing fixture', () => {
    const simulation = new DeterministicBackend(8, 6);
    simulation.consumeDirtyCells();

    prepareDenseSolidAuditFixture(simulation);
    expect([...simulation.cells()]).toEqual(new Array(48).fill(Material.Metal));
    expect(simulation.consumeDirtyCells()).toHaveLength(48);

    toggleDenseSolidAuditProbe(simulation);
    expect(simulation.cells()[3 * 8 + 4]).toBe(Material.Glass);
    expect(simulation.consumeDirtyCells()).toEqual([
      { index: 3 * 8 + 4, material: Material.Glass },
    ]);
  });

  it('builds repeating connected liquid islands across the full contour grid', () => {
    const simulation = new DeterministicBackend(67, 35);
    prepareContourStressAuditFixture(simulation);
    const cells = simulation.cells();
    for (let y = 0; y < simulation.height; y++) for (let x = 0; x < simulation.width; x++) {
      expect(cells[y * simulation.width + x]).toBe(
        x % 3 < 2 && y % 3 < 2 ? Material.Water : Material.Empty,
      );
    }
  });

  it('builds isolated thick material-lighting bodies and protected controls', () => {
    const simulation = new DeterministicBackend(612, 384);
    prepareSolidFieldLightingAuditFixture(simulation);
    const cells = simulation.cells();
    const cell = (x: number, y: number): Material => cells[y * simulation.width + x] as Material;

    expect(cell(36, 110)).toBe(Material.Metal);
    expect(cell(136, 110)).toBe(Material.Plant);
    expect(cell(236, 110)).toBe(Material.VIBR);
    expect(cell(336, 110)).toBe(Material.DTEC);
    expect(cell(436, 110)).toBe(Material.Metal);
    expect(cell(29, 110)).toBe(Material.Fire);
    expect(cell(329, 110)).toBe(Material.ELEC);
    expect(cell(36, 250)).toBe(Material.Sand);
    expect(cell(136, 250)).toBe(Material.Glass);
    expect(cell(236, 250)).toBe(Material.CLNE);
  });
});
