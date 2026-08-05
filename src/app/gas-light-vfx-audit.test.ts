import { describe, expect, it } from 'vitest';
import { Material, ALL_MATERIALS } from '../shared/materials';
import { RenderFieldSet } from '../renderer/render-field-set';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  GAS_LIGHT_VFX_AUDIT, prepareGasLightVfxFixture,
  type GasLightVfxPoint, type GasLightVfxRect,
} from './gas-light-vfx-audit';

describe('gas-light VFX audit fixture', () => {
  it('separates dense externally lit Smoke and FOG shoulders from deep cores and protected topology', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    expect(GAS_LIGHT_VFX_AUDIT.cards.map(({ material }) => material)).toEqual([
      Material.Smoke, Material.FOG,
    ]);
    for (const card of GAS_LIGHT_VFX_AUDIT.cards) {
      expect(at(cells, simulation.width, centre(card.litShoulder))).toBe(card.material);
      expect(at(cells, simulation.width, centre(card.unlitShoulder))).toBe(card.material);
      expect(at(cells, simulation.width, centre(card.deepCore))).toBe(card.material);
      expectRect(cells, simulation.width, card.authoredHole, Material.Empty);
      expectRect(cells, simulation.width, card.openChannel, Material.Empty);
      expectRect(cells, simulation.width, card.emitter, card.emitter.material);
      expect([Material.Fire, Material.GRVT]).toContain(card.emitter.material);
      expect(intersects(card.body, card.emitter)).toBe(false);
    }
  });

  it('keeps every protected gas, sparse chain, contact, wall, and blank control exact', () => {
    const simulation = preparedFixture();
    const cells = simulation.cells();
    expect(GAS_LIGHT_VFX_AUDIT.protectedGases.map(({ material }) => material)).toEqual([
      Material.Oxygen, Material.CFLM, Material.NobleGas,
    ]);
    for (const control of GAS_LIGHT_VFX_AUDIT.protectedGases) {
      expect(at(cells, simulation.width, control.probe)).toBe(control.material);
      expectRect(cells, simulation.width, control.emitter, control.emitter.material);
      expect(intersects(control.body, control.emitter)).toBe(false);
    }
    for (const chain of GAS_LIGHT_VFX_AUDIT.sparseChains) {
      for (const carrier of chain.carriers) expect(at(cells, simulation.width, carrier)).toBe(chain.material);
      expect(at(cells, simulation.width, chain.midpoint)).toBe(Material.Empty);
      expect(at(cells, simulation.width, chain.gap)).toBe(Material.Empty);
      expect(at(cells, simulation.width, chain.isolated)).toBe(chain.material);
    }
    expect(at(cells, simulation.width, centre(GAS_LIGHT_VFX_AUDIT.solidContact.gas))).toBe(Material.Smoke);
    expect(at(cells, simulation.width, centre(GAS_LIGHT_VFX_AUDIT.solidContact.solid))).toBe(Material.Metal);
    expect(at(cells, simulation.width, centre(GAS_LIGHT_VFX_AUDIT.liquidContact.gas))).toBe(Material.FOG);
    expect(at(cells, simulation.width, centre(GAS_LIGHT_VFX_AUDIT.liquidContact.liquid))).toBe(Material.Water);
    const wall = GAS_LIGHT_VFX_AUDIT.nativeWall;
    expect(at(cells, simulation.width, wall.wallAnchor)).toBe(Material.Smoke);
    expect(at(simulation.walls(), simulation.width, wall.wallAnchor)).toBe(GAS_LIGHT_VFX_AUDIT.conductiveWall);
    expectRect(cells, simulation.width, GAS_LIGHT_VFX_AUDIT.guardedBlank, Material.Empty);
  });

  it('keeps all authored regions non-overlapping and inside the 612x384 world', () => {
    const regions: GasLightVfxRect[] = [
      ...GAS_LIGHT_VFX_AUDIT.cards.flatMap((entry) => [entry.body, entry.emitter]),
      ...GAS_LIGHT_VFX_AUDIT.protectedGases.flatMap((entry) => [entry.body, entry.emitter]),
      GAS_LIGHT_VFX_AUDIT.solidContact.gas, GAS_LIGHT_VFX_AUDIT.solidContact.solid,
      GAS_LIGHT_VFX_AUDIT.liquidContact.gas, GAS_LIGHT_VFX_AUDIT.liquidContact.liquid,
      GAS_LIGHT_VFX_AUDIT.nativeWall.gas, GAS_LIGHT_VFX_AUDIT.guardedBlank,
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

  it('seeds exact atmosphere ownership while native contact and wall blocks style propagation', () => {
    const simulation = preparedFixture();
    const fields = new RenderFieldSet(simulation.width, simulation.height, ALL_MATERIALS);
    fields.atmosphere.update(simulation.cells(), simulation.walls());
    for (const card of GAS_LIGHT_VFX_AUDIT.cards) {
      const field = atmosphereAt(fields, centre(card.deepCore));
      const litShoulder = atmosphereAt(fields, centre(card.litShoulder));
      expect(field.alpha).toBeGreaterThan(0);
      expect(field.style).toBe(card.material === Material.Smoke ? 1 : 10);
      expect(litShoulder.alpha).toBeGreaterThan(0);
      expect(litShoulder.style).toBe(field.style);
    }
    for (const control of GAS_LIGHT_VFX_AUDIT.protectedGases) {
      expect(atmosphereAt(fields, control.probe).style).toBe(
        fields.lookups.gasIdentityStyleByMaterial[control.material],
      );
    }
    expect(atmosphereAt(fields, GAS_LIGHT_VFX_AUDIT.solidContact.gasProbe).style).toBe(0);
    expect(atmosphereAt(fields, GAS_LIGHT_VFX_AUDIT.liquidContact.gasProbe).style).toBe(0);
    expect(atmosphereAt(fields, GAS_LIGHT_VFX_AUDIT.nativeWall.wallAnchor).style).toBe(0);
  });

  it('places existing emission support on only the intended facing shoulders', () => {
    const simulation = preparedFixture();
    const fields = new RenderFieldSet(simulation.width, simulation.height, ALL_MATERIALS);
    fields.emission.update(simulation.cells());
    for (const card of GAS_LIGHT_VFX_AUDIT.cards) {
      const lit = emissionAt(fields, centre(card.litShoulder));
      const unlit = emissionAt(fields, centre(card.unlitShoulder));
      const core = emissionAt(fields, centre(card.deepCore));
      const evidence = `${card.code}: lit=${lit}, unlit=${unlit}, core=${core}`;
      // A merely nonzero far-tail byte is not enough to exercise E13 after its
      // bounded transport knees. Keep the probe inside a materially lit field.
      expect(lit, evidence).toBeGreaterThanOrEqual(24);
      expect(lit, evidence).toBeGreaterThan(unlit);
      expect(unlit, evidence).toBe(0);
      expect(core, evidence).toBe(0);
    }
    for (const control of GAS_LIGHT_VFX_AUDIT.protectedGases) {
      expect(emissionAt(fields, control.probe), control.code).toBeGreaterThan(0);
    }
  });

  it('resets cells and walls deterministically and rejects unsupported backends', () => {
    const simulation = new RenderLabBackend();
    prepareGasLightVfxFixture(simulation);
    const cells = simulation.cells().slice();
    const walls = simulation.walls().slice();
    simulation.paint(2, 2, Material.Fire, 0);
    simulation.paintWall(2, 2, 2, 0);
    prepareGasLightVfxFixture(simulation);
    expect(simulation.cells()).toEqual(cells);
    expect(simulation.walls()).toEqual(walls);

    expect(() => prepareGasLightVfxFixture(new DeterministicBackend(612, 384)))
      .toThrow('RenderLab wall plane');
    expect(() => prepareGasLightVfxFixture(new RenderLabBackend(32, 32))).toThrow('612x384');
  });
});

function preparedFixture(): RenderLabBackend {
  const simulation = new RenderLabBackend();
  prepareGasLightVfxFixture(simulation);
  return simulation;
}

function at(bytes: Uint8Array, width: number, point: GasLightVfxPoint): number {
  return bytes[point.y * width + point.x];
}

function centre(rect: GasLightVfxRect): GasLightVfxPoint {
  return { x: Math.floor(rect.x + rect.width / 2), y: Math.floor(rect.y + rect.height / 2) };
}

function expectRect(cells: Uint8Array, width: number, rect: GasLightVfxRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) expect(cells[y * width + x]).toBe(material);
  }
}

function atmosphereAt(fields: RenderFieldSet, point: GasLightVfxPoint): { alpha: number; style: number } {
  const x = Math.floor(point.x / 2);
  const y = Math.floor(point.y / 2);
  const offset = (y * fields.atmosphere.width + x) * 4;
  return { alpha: fields.atmosphere.bytes[offset + 3], style: fields.atmosphere.styleBytes[offset] };
}

function emissionAt(fields: RenderFieldSet, point: GasLightVfxPoint): number {
  const x = Math.floor(point.x / 3);
  const y = Math.floor(point.y / 3);
  const offset = (y * fields.emission.width + x) * 4;
  return fields.emission.bytes[offset + 3];
}

function intersects(left: GasLightVfxRect, right: GasLightVfxRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}
