import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  SOLID_BODY_VFX_AUDIT, prepareSolidBodyVfxFixture,
  type SolidBodyVfxPoint, type SolidBodyVfxRect,
} from './solid-body-vfx-audit';

describe('solid-body VFX audit fixture', () => {
  it('pins broad exact native ROCK and Metal targets with core and exposed-face probes', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    expect(SOLID_BODY_VFX_AUDIT.targets.map(({ code, material }) => ({ code, material }))).toEqual([
      { code: 'ROCK', material: Material.ROCK },
      { code: 'METL', material: Material.Metal },
    ]);
    for (const entry of SOLID_BODY_VFX_AUDIT.targets) {
      expect(at(cells, simulation.width, centre(entry.core))).toBe(entry.material);
      expect(at(cells, simulation.width, centre(entry.surface))).toBe(entry.material);
      expectRect(cells, simulation.width, entry.authoredHole, Material.Empty);
      expectRect(cells, simulation.width, entry.openNotch, Material.Empty);
    }
  });

  it('keeps fine, wall, foreign-phase, and unlike-solid controls semantically exact', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    const walls = simulation.walls();
    for (const entry of SOLID_BODY_VFX_AUDIT.targets) {
      expectRect(cells, simulation.width, entry.thinLine, entry.material);
      expect(at(cells, simulation.width, entry.isolated)).toBe(entry.material);
      expectRect(cells, simulation.width, entry.wallCoexistence, entry.material);
      expectRect(walls, simulation.width, entry.wallCoexistence, SOLID_BODY_VFX_AUDIT.conductiveWall);
      expectRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
    }
    for (const control of Object.values(SOLID_BODY_VFX_AUDIT.protectedControls)) {
      expect(at(cells, simulation.width, centre(control))).toBe(control.material);
    }
    const seam = SOLID_BODY_VFX_AUDIT.unlikeSolidSeam;
    expect(at(cells, simulation.width, seam.targetProbe)).toBe(Material.Metal);
    expect(at(cells, simulation.width, seam.foreignProbe)).toBe(Material.Brick);
    expect(seam.target.x + seam.target.width).toBe(seam.foreign.x);
  });

  it('keeps all authored rectangles inside the 612x384 world without overlap', () => {
    const regions: SolidBodyVfxRect[] = [
      ...SOLID_BODY_VFX_AUDIT.targets.flatMap((entry) => [
        entry.card, entry.thinLine, entry.wallCoexistence,
      ]),
      ...Object.values(SOLID_BODY_VFX_AUDIT.protectedControls),
      SOLID_BODY_VFX_AUDIT.unlikeSolidSeam.target,
      SOLID_BODY_VFX_AUDIT.unlikeSolidSeam.foreign,
    ];
    for (const region of regions) {
      expect(region.x).toBeGreaterThanOrEqual(0);
      expect(region.y).toBeGreaterThanOrEqual(0);
      expect(region.x + region.width).toBeLessThanOrEqual(612);
      expect(region.y + region.height).toBeLessThanOrEqual(384);
    }
    for (let index = 0; index < SOLID_BODY_VFX_AUDIT.targets.length; index++) {
      for (let other = index + 1; other < SOLID_BODY_VFX_AUDIT.targets.length; other++) {
        expect(intersects(SOLID_BODY_VFX_AUDIT.targets[index].card, SOLID_BODY_VFX_AUDIT.targets[other].card))
          .toBe(false);
      }
    }
  });

  it('resets semantic and wall planes deterministically and rejects unsupported backends', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells().slice();
    const walls = simulation.walls().slice();
    simulation.paint(2, 2, Material.Fire, 0);
    simulation.paintWall(2, 2, 2, 0);
    prepareSolidBodyVfxFixture(simulation);
    expect(simulation.cells()).toEqual(cells);
    expect(simulation.walls()).toEqual(walls);

    expect(() => prepareSolidBodyVfxFixture(new DeterministicBackend(612, 384)))
      .toThrow('RenderLab wall plane');
    expect(() => prepareSolidBodyVfxFixture(new RenderLabBackend(32, 32))).toThrow('612x384');
  });
});

function preparedFixture(): RenderLabBackend {
  const simulation = new RenderLabBackend();
  prepareSolidBodyVfxFixture(simulation);
  return simulation;
}

function at(bytes: Uint8Array, width: number, point: SolidBodyVfxPoint): number {
  return bytes[point.y * width + point.x];
}

function centre(rect: SolidBodyVfxRect): SolidBodyVfxPoint {
  return { x: Math.floor(rect.x + rect.width / 2), y: Math.floor(rect.y + rect.height / 2) };
}

function expectRect(cells: Uint8Array, width: number, rect: SolidBodyVfxRect, material: number): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) expect(cells[y * width + x]).toBe(material);
  }
}

function intersects(left: SolidBodyVfxRect, right: SolidBodyVfxRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}
