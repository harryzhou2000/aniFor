import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { RenderFieldSet } from '../renderer/render-field-set';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  PLASMA_CORE_VFX_AUDIT, preparePlasmaCoreVfxFixture,
  type PlasmaCoreVfxPoint, type PlasmaCoreVfxRect,
} from './plasma-core-vfx-audit';

describe('plasma-core VFX audit fixture', () => {
  it('authors one broad exact Plasma body with a core, shoulders, hole, and open channel', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    expect(PLASMA_CORE_VFX_AUDIT.material).toBe(Material.Plasma);
    for (const region of [
      PLASMA_CORE_VFX_AUDIT.core,
      PLASMA_CORE_VFX_AUDIT.shoulder,
      PLASMA_CORE_VFX_AUDIT.aura,
    ]) {
      expect(at(cells, simulation.width, centre(region))).toBe(Material.Plasma);
    }
    expectRect(cells, simulation.width, PLASMA_CORE_VFX_AUDIT.authoredHole, Material.Empty);
    expectRect(cells, simulation.width, PLASMA_CORE_VFX_AUDIT.openChannel, Material.Empty);
  });

  it('keeps sparse Plasma, other Energy, contacts, wall overlap, and blank exact', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    expect(PLASMA_CORE_VFX_AUDIT.protectedControls.map(({ material }) => material)).toEqual([
      Material.Fire, Material.ELEC, Material.PHOT,
    ]);
    for (const control of PLASMA_CORE_VFX_AUDIT.protectedControls) {
      expect(at(cells, simulation.width, control.probe)).toBe(control.material);
    }
    const sparse = PLASMA_CORE_VFX_AUDIT.sparseChain;
    for (const carrier of sparse.carriers) expect(at(cells, simulation.width, carrier)).toBe(Material.Plasma);
    expect(at(cells, simulation.width, sparse.midpoint)).toBe(Material.Empty);
    expect(at(cells, simulation.width, sparse.gap)).toBe(Material.Empty);
    expect(at(cells, simulation.width, PLASMA_CORE_VFX_AUDIT.isolated)).toBe(Material.Plasma);
    expect(at(cells, simulation.width, PLASMA_CORE_VFX_AUDIT.liquidContact.plasmaProbe)).toBe(Material.Plasma);
    expect(at(cells, simulation.width, PLASMA_CORE_VFX_AUDIT.solidContact.plasmaProbe)).toBe(Material.Plasma);
    expect(at(cells, simulation.width, PLASMA_CORE_VFX_AUDIT.nativeWall.wallAnchor)).toBe(Material.Plasma);
    expect(at(simulation.walls(), simulation.width, PLASMA_CORE_VFX_AUDIT.nativeWall.wallAnchor))
      .toBe(PLASMA_CORE_VFX_AUDIT.conductiveWall);
    expectRect(cells, simulation.width, PLASMA_CORE_VFX_AUDIT.guardedBlank, Material.Empty);
  });

  it('keeps external authored regions inside the 612x384 world without overlap', () => {
    const regions: PlasmaCoreVfxRect[] = [
      PLASMA_CORE_VFX_AUDIT.body,
      ...PLASMA_CORE_VFX_AUDIT.protectedControls.map(({ body }) => body),
      PLASMA_CORE_VFX_AUDIT.liquidContact.plasma, PLASMA_CORE_VFX_AUDIT.liquidContact.water,
      PLASMA_CORE_VFX_AUDIT.solidContact.plasma, PLASMA_CORE_VFX_AUDIT.solidContact.metal,
      PLASMA_CORE_VFX_AUDIT.nativeWall.plasma, PLASMA_CORE_VFX_AUDIT.guardedBlank,
    ];
    for (const region of regions) {
      expect(region.x).toBeGreaterThanOrEqual(0);
      expect(region.y).toBeGreaterThanOrEqual(0);
      expect(region.x + region.width).toBeLessThanOrEqual(612);
      expect(region.y + region.height).toBeLessThanOrEqual(384);
    }
    for (let index = 0; index < regions.length; index++) {
      for (let other = index + 1; other < regions.length; other++) {
        expect(intersects(regions[index], regions[other])).toBe(false);
      }
    }
  });

  it('hydrates the shared emission field at the broad Plasma core and shoulders', () => {
    const simulation = preparedFixture();
    const fields = new RenderFieldSet(simulation.width, simulation.height, ALL_MATERIALS);
    fields.emission.update(simulation.cells());
    expect(fields.emission.hasLight).toBe(true);
    for (const region of [
      PLASMA_CORE_VFX_AUDIT.core,
      PLASMA_CORE_VFX_AUDIT.shoulder,
      PLASMA_CORE_VFX_AUDIT.aura,
    ]) {
      expect(emissionAlphaAt(fields, centre(region))).toBeGreaterThan(0);
    }
  });

  it('resets material and wall planes deterministically and rejects unsupported backends', () => {
    const simulation = new RenderLabBackend();
    preparePlasmaCoreVfxFixture(simulation);
    const cells = simulation.cells().slice();
    const walls = simulation.walls().slice();
    simulation.paint(2, 2, Material.Fire, 0);
    simulation.paintWall(2, 2, 2, 0);
    preparePlasmaCoreVfxFixture(simulation);
    expect(simulation.cells()).toEqual(cells);
    expect(simulation.walls()).toEqual(walls);

    expect(() => preparePlasmaCoreVfxFixture(new DeterministicBackend(612, 384)))
      .toThrow('RenderLab wall plane');
    expect(() => preparePlasmaCoreVfxFixture(new RenderLabBackend(32, 32))).toThrow('612x384');
  });
});

function preparedFixture(): RenderLabBackend {
  const simulation = new RenderLabBackend();
  preparePlasmaCoreVfxFixture(simulation);
  return simulation;
}

function at(bytes: Uint8Array, width: number, point: PlasmaCoreVfxPoint): number {
  return bytes[point.y * width + point.x];
}

function centre(rect: PlasmaCoreVfxRect): PlasmaCoreVfxPoint {
  return { x: Math.floor(rect.x + rect.width / 2), y: Math.floor(rect.y + rect.height / 2) };
}

function expectRect(cells: Uint8Array, width: number, rect: PlasmaCoreVfxRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) expect(cells[y * width + x]).toBe(material);
  }
}

function emissionAlphaAt(fields: RenderFieldSet, point: PlasmaCoreVfxPoint): number {
  const x = Math.floor(point.x / 3);
  const y = Math.floor(point.y / 3);
  return fields.emission.bytes[(y * fields.emission.width + x) * 4 + 3];
}

function intersects(left: PlasmaCoreVfxRect, right: PlasmaCoreVfxRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}
