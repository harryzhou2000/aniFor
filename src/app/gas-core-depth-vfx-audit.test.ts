import { describe, expect, it } from 'vitest';
import { Material, ALL_MATERIALS } from '../shared/materials';
import { RenderFieldSet } from '../renderer/render-field-set';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  GAS_CORE_DEPTH_VFX_AUDIT, prepareGasCoreDepthVfxFixture,
  type GasCoreDepthVfxPoint, type GasCoreDepthVfxRect,
} from './gas-core-depth-vfx-audit';

describe('gas-core-depth VFX audit fixture', () => {
  it('authors exact dense Smoke, Oxygen, and Noble Gas core cards with protected topology', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    expect(GAS_CORE_DEPTH_VFX_AUDIT.cards.map(({ material }) => material)).toEqual([
      Material.Smoke, Material.Oxygen, Material.NobleGas,
    ]);
    for (const card of GAS_CORE_DEPTH_VFX_AUDIT.cards) {
      expect(at(cells, simulation.width, centre(card.core))).toBe(card.material);
      expect(at(cells, simulation.width, centre(card.crown))).toBe(card.material);
      expect(at(cells, simulation.width, centre(card.pocket))).toBe(card.material);
      expect(card.crownBillow, `${card.code} crown`).toBeGreaterThanOrEqual(0.80);
      expect(card.pocketBillow, `${card.code} pocket`).toBeLessThanOrEqual(-0.89);
      expectRect(cells, simulation.width, card.authoredHole, Material.Empty);
      expectRect(cells, simulation.width, card.openChannel, Material.Empty);
    }
  });

  it('keeps sparse target points, foreign gases, contacts, emissive gas, wall, and blank exact', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    expect(GAS_CORE_DEPTH_VFX_AUDIT.protectedGases.map(({ material }) => material)).toEqual([
      Material.FOG, Material.CFLM, Material.Hydrogen,
    ]);
    for (const control of GAS_CORE_DEPTH_VFX_AUDIT.protectedGases) {
      expect(at(cells, simulation.width, control.probe)).toBe(control.material);
    }
    for (const chain of GAS_CORE_DEPTH_VFX_AUDIT.sparseChains) {
      for (const carrier of chain.carriers) expect(at(cells, simulation.width, carrier)).toBe(chain.material);
      expect(at(cells, simulation.width, chain.midpoint)).toBe(Material.Empty);
      expect(at(cells, simulation.width, chain.gap)).toBe(Material.Empty);
      expect(at(cells, simulation.width, chain.isolated)).toBe(chain.material);
    }
    expect(at(cells, simulation.width, GAS_CORE_DEPTH_VFX_AUDIT.solidContact.gasProbe)).toBe(Material.Smoke);
    expect(at(cells, simulation.width, GAS_CORE_DEPTH_VFX_AUDIT.liquidContact.gasProbe)).toBe(Material.Oxygen);
    expect(at(cells, simulation.width, GAS_CORE_DEPTH_VFX_AUDIT.foreignGasContact.gasProbe)).toBe(Material.NobleGas);
    expect(at(cells, simulation.width, GAS_CORE_DEPTH_VFX_AUDIT.foreignGasContact.foreignProbe)).toBe(Material.FOG);
    expect(at(cells, simulation.width, GAS_CORE_DEPTH_VFX_AUDIT.nativeWall.wallAnchor)).toBe(Material.Smoke);
    expect(at(simulation.walls(), simulation.width, GAS_CORE_DEPTH_VFX_AUDIT.nativeWall.wallAnchor))
      .toBe(GAS_CORE_DEPTH_VFX_AUDIT.conductiveWall);
    expect(at(cells, simulation.width, GAS_CORE_DEPTH_VFX_AUDIT.emissiveGas.probe)).toBe(Material.CFLM);
    expectRect(cells, simulation.width, GAS_CORE_DEPTH_VFX_AUDIT.guardedBlank, Material.Empty);
  });

  it('keeps all authored regions non-overlapping and inside the 612x384 world', () => {
    const regions: GasCoreDepthVfxRect[] = [
      ...GAS_CORE_DEPTH_VFX_AUDIT.cards.map((entry) => entry.body),
      ...GAS_CORE_DEPTH_VFX_AUDIT.protectedGases.map((entry) => entry.body),
      GAS_CORE_DEPTH_VFX_AUDIT.solidContact.gas, GAS_CORE_DEPTH_VFX_AUDIT.solidContact.solid,
      GAS_CORE_DEPTH_VFX_AUDIT.liquidContact.gas, GAS_CORE_DEPTH_VFX_AUDIT.liquidContact.liquid,
      GAS_CORE_DEPTH_VFX_AUDIT.foreignGasContact.gas, GAS_CORE_DEPTH_VFX_AUDIT.foreignGasContact.foreignGas,
      GAS_CORE_DEPTH_VFX_AUDIT.nativeWall.gas, GAS_CORE_DEPTH_VFX_AUDIT.emissiveGas.body,
      GAS_CORE_DEPTH_VFX_AUDIT.guardedBlank,
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

  it('propagates only dense target core styles and rejects holes, channels, sparse gas, contacts, and walls', () => {
    const simulation = preparedFixture();
    const fields = new RenderFieldSet(simulation.width, simulation.height, ALL_MATERIALS);
    fields.atmosphere.update(simulation.cells(), simulation.walls());
    const targetStyles = [1, 4, 7];
    for (const card of GAS_CORE_DEPTH_VFX_AUDIT.cards) {
      const expectedStyle = card.material === Material.Smoke ? 1
        : card.material === Material.Oxygen ? 4 : 7;
      for (const region of [card.core, card.crown, card.pocket]) {
        const field = atmosphereAt(fields, centre(region));
        expect(field.alpha, card.code).toBeGreaterThan(0);
        expect(field.style, card.code).toBe(expectedStyle);
      }
      for (const region of [card.authoredHole, card.openChannel]) {
        expect(atmosphereAt(fields, centre(region)).style, card.code).not.toBe(expectedStyle);
      }
    }
    for (const control of GAS_CORE_DEPTH_VFX_AUDIT.protectedGases) {
      expect(atmosphereAt(fields, control.probe).style, control.code).not.toBeOneOf(targetStyles);
    }
    for (const point of [
      GAS_CORE_DEPTH_VFX_AUDIT.solidContact.gasProbe,
      GAS_CORE_DEPTH_VFX_AUDIT.liquidContact.gasProbe,
      GAS_CORE_DEPTH_VFX_AUDIT.foreignGasContact.foreignProbe,
      GAS_CORE_DEPTH_VFX_AUDIT.nativeWall.wallAnchor,
      GAS_CORE_DEPTH_VFX_AUDIT.emissiveGas.probe,
      centre(GAS_CORE_DEPTH_VFX_AUDIT.guardedBlank),
    ]) {
      expect(atmosphereAt(fields, point).style).not.toBeOneOf(targetStyles);
    }
    // A mixed gas is not a hard solid/liquid blocker: the exact Noble side may
    // retain its own target identity up to the interface, but must not project
    // that style into the adjacent FOG owner checked above.
    expect(atmosphereAt(fields, GAS_CORE_DEPTH_VFX_AUDIT.foreignGasContact.gasProbe).style)
      .toBe(7);
  });

  it('resets material and wall planes deterministically and rejects unsupported backends', () => {
    const simulation = new RenderLabBackend();
    prepareGasCoreDepthVfxFixture(simulation);
    const cells = simulation.cells().slice();
    const walls = simulation.walls().slice();
    simulation.paint(2, 2, Material.Fire, 0);
    simulation.paintWall(2, 2, 2, 0);
    prepareGasCoreDepthVfxFixture(simulation);
    expect(simulation.cells()).toEqual(cells);
    expect(simulation.walls()).toEqual(walls);

    expect(() => prepareGasCoreDepthVfxFixture(new DeterministicBackend(612, 384)))
      .toThrow('RenderLab wall plane');
    expect(() => prepareGasCoreDepthVfxFixture(new RenderLabBackend(32, 32))).toThrow('612x384');
  });
});

function preparedFixture(): RenderLabBackend {
  const simulation = new RenderLabBackend();
  prepareGasCoreDepthVfxFixture(simulation);
  return simulation;
}

function at(bytes: Uint8Array, width: number, point: GasCoreDepthVfxPoint): number {
  return bytes[point.y * width + point.x];
}

function centre(rect: GasCoreDepthVfxRect): GasCoreDepthVfxPoint {
  return { x: Math.floor(rect.x + rect.width / 2), y: Math.floor(rect.y + rect.height / 2) };
}

function expectRect(cells: Uint8Array, width: number, rect: GasCoreDepthVfxRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) expect(cells[y * width + x]).toBe(material);
  }
}

function atmosphereAt(fields: RenderFieldSet, point: GasCoreDepthVfxPoint): { alpha: number; style: number } {
  const x = Math.floor(point.x / 2);
  const y = Math.floor(point.y / 2);
  const offset = (y * fields.atmosphere.width + x) * 4;
  return { alpha: fields.atmosphere.bytes[offset + 3], style: fields.atmosphere.styleBytes[offset] };
}

function intersects(left: GasCoreDepthVfxRect, right: GasCoreDepthVfxRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}
