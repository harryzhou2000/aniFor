import { describe, expect, it } from 'vitest';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { Material } from '../shared/materials';
import {
  browserInputAuditRequested, prepareDenseSolidAuditFixture, toggleDenseSolidAuditProbe,
} from './browser-input-audit';

describe('browser input audit gate', () => {
  it('requires the explicit diagnostic query', () => {
    expect(browserInputAuditRequested('?scene=render-lab&inputAudit=1')).toBe(true);
    expect(browserInputAuditRequested('?scene=render-lab')).toBe(false);
    expect(browserInputAuditRequested('?inputAudit=0')).toBe(false);
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
});
