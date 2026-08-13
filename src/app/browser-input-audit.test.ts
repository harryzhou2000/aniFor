import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { Material } from '../shared/materials';
import {
  activatePreparedVisualCaptureFixture,
  activatePreparedVisualCaptureFixtureWithDrainedWorkGeneration,
  activatePreparedVisualCaptureFixtureWithWorkGeneration,
  blankBrowserInputAuditRequested, browserInputAuditRequested,
  prepareContourStressAuditFixture, prepareDenseSolidAuditFixture,
  prepareSolidFieldLightingAuditFixture, toggleDenseSolidAuditProbe,
} from './browser-input-audit';

describe('browser input audit gate', () => {
  it('routes the v7 bridge through drained activation-owned renderer work', () => {
    const calls: string[] = [];
    const ticket = activatePreparedVisualCaptureFixtureWithDrainedWorkGeneration({
      runWithNextFixtureActivationDrainedWorkGeneration: (activate) => {
        calls.push('reserve-drained-work');
        activate();
        return 13;
      },
      prepareFixture: () => true,
      synchronizeFixtureMaterialPlane: () => calls.push('synchronize'),
      markFixturePrepared: () => calls.push('mark'),
      setVariant: () => calls.push('select'),
      invalidateDynamicPresentation: () => calls.push('invalidate'),
    }, 'showcase', 0);
    expect(ticket).toBe(13);
    expect(calls).toEqual([
      'reserve-drained-work', 'synchronize', 'mark', 'select', 'invalidate',
    ]);
  });

  it('routes the v2 bridge through activation-owned renderer work', () => {
    const calls: string[] = [];
    const ticket = activatePreparedVisualCaptureFixtureWithWorkGeneration({
      runWithNextFixtureActivationWorkGeneration: (activate) => {
        calls.push('reserve-work');
        activate();
        return 12;
      },
      prepareFixture: () => true,
      synchronizeFixtureMaterialPlane: () => calls.push('synchronize'),
      markFixturePrepared: () => calls.push('mark'),
      setVariant: () => calls.push('select'),
      invalidateDynamicPresentation: () => calls.push('invalidate'),
    }, 'showcase', 0);
    expect(ticket).toBe(12);
    expect(calls).toEqual(['reserve-work', 'synchronize', 'mark', 'select', 'invalidate']);
  });

  it('activates a mutated typed fixture under one reserved presentation generation', () => {
    const calls: string[] = [];
    const generation = activatePreparedVisualCaptureFixture({
      runWithNextFixtureActivationPresentationGeneration: (activate) => {
        calls.push('reserve');
        activate();
        calls.push('reserved:27');
        return 27;
      },
      prepareFixture: (fixture) => {
        calls.push(`prepare:${fixture}`);
        return true;
      },
      synchronizeFixtureMaterialPlane: () => calls.push('synchronize'),
      markFixturePrepared: (fixture) => calls.push(`mark:${fixture}`),
      setVariant: (fixture, variant) => calls.push(`select:${fixture}:${variant}`),
      invalidateDynamicPresentation: () => calls.push('invalidate'),
    }, 'powder-style-atlas', 2);

    expect(generation).toBe(27);
    expect(calls).toEqual([
      'reserve',
      'prepare:powder-style-atlas',
      'synchronize',
      'mark:powder-style-atlas',
      'select:powder-style-atlas:2',
      'invalidate',
      'reserved:27',
    ]);
  });

  it('invalidates no-op activation and fails before mutation for invalid input or reservation', () => {
    const calls: string[] = [];
    const host = {
      runWithNextFixtureActivationPresentationGeneration: (activate: () => void) => {
        calls.push('reserve');
        activate();
        return 9;
      },
      prepareFixture: (fixture: 'showcase') => {
        calls.push(`prepare:${fixture}`);
        return false;
      },
      synchronizeFixtureMaterialPlane: () => calls.push('unexpected-sync'),
      markFixturePrepared: (fixture: 'showcase') => calls.push(`mark:${fixture}`),
      setVariant: (fixture: 'showcase', variant: 0 | 1 | 2) => (
        calls.push(`select:${fixture}:${variant}`)
      ),
      invalidateDynamicPresentation: () => calls.push('invalidate'),
    };
    expect(activatePreparedVisualCaptureFixture(host, 'showcase', 0)).toBe(9);
    expect(calls).toEqual([
      'reserve', 'prepare:showcase', 'mark:showcase', 'select:showcase:0', 'invalidate',
    ]);

    calls.length = 0;
    expect(() => activatePreparedVisualCaptureFixture(host, 'showcase', 3 as never))
      .toThrow('Invalid Visual capture control variant 3');
    expect(calls).toEqual([]);

    expect(() => activatePreparedVisualCaptureFixture({
      ...host,
      runWithNextFixtureActivationPresentationGeneration: () => undefined,
    }, 'showcase', 0)).toThrow('could not reserve a presentation generation');
    expect(calls).toEqual([]);
  });

  it('uses strict teardown only behind the audit bridge', () => {
    const source = readFileSync(new URL('./game.ts', import.meta.url), 'utf8');
    expect(source).toContain(
      'disposeRendererForNavigation: () => this.renderer.disposeForAudit()',
    );
    expect(source).toContain('prepare: () => this.renderer.disposeForNavigation()');
  });

  it('keeps the composite selector transaction explicit beside the receipt fallback', () => {
    const source = readFileSync(new URL('./game.ts', import.meta.url), 'utf8');
    expect(source).toContain('setPreparedVisualCaptureVariantWithCompletedFrameReceipt:');
    expect(source).toContain(
      'setPreparedVisualCaptureVariantWithCompletedFrameReceiptAndFramebufferAlphaReadback:',
    );
    expect(source).toContain(
      'runWithNextWebGLCompletedFrameReceiptAndFramebufferAlphaReadback: (present)',
    );
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
