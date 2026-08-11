import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { EmissionField } from './emission-field';
import { RenderPhase } from './render-profile';
import { RenderTrait } from './render-traits';

function fixture(width = 21, height = 21): { field: EmissionField; materials: Uint8Array } {
  const emissive = new Uint8Array(256);
  emissive[Material.PHOT] = 1;
  emissive[Material.ELEC] = 1;
  emissive[Material.Fire] = 1;
  const colors = new Uint8Array(256 * 3);
  colors.set([250, 245, 180], Material.PHOT * 3);
  colors.set([80, 210, 255], Material.ELEC * 3);
  colors.set([190, 118, 68], Material.Brick * 3);
  colors.set([255, 96, 24], Material.Fire * 3);
  const styles = new Uint8Array(256 * 4);
  styles[Material.PHOT * 4] = RenderPhase.Energy;
  styles[Material.ELEC * 4] = RenderPhase.Energy;
  styles[Material.Fire * 4] = RenderPhase.Gas;
  styles[Material.Brick * 4] = RenderPhase.Solid;
  styles[Material.Sand * 4] = RenderPhase.Powder;
  styles[Material.Water * 4] = RenderPhase.Liquid;
  styles[Material.Smoke * 4] = RenderPhase.Gas;
  styles[Material.Wall * 4] = RenderPhase.Solid;
  styles[Material.Plant * 4] = RenderPhase.Solid;
  styles[Material.Plant * 4 + 3] = RenderTrait.Organic;
  return {
    field: new EmissionField(width, height, emissive, colors, styles),
    materials: new Uint8Array(width * height),
  };
}

function alphaAt(field: EmissionField, x: number, y: number): number {
  return field.bytes[(y * field.width + x) * 4 + 3];
}

describe('emission field', () => {
  it('matches the HDR thermal-core and ordinary-matter eligibility set', () => {
    const { field } = fixture();
    expect([
      Material.Fire, Material.Lava, Material.Plasma, Material.Brick, Material.Sand,
    ].map((material) => field.canMaterialEmitThermally(material))).toEqual([
      true, true, true, true, true,
    ]);
    expect([
      Material.Empty, Material.Wall, Material.Water, Material.Smoke,
      Material.PHOT, Material.ELEC, Material.Plant,
    ].map((material) => field.canMaterialEmitThermally(material))).toEqual([
      false, false, false, false, false, false, false,
    ]);
  });

  it('tracks whether the packed field contains useful light', () => {
    const { field, materials } = fixture(60, 60);
    field.update(materials);
    expect(field.hasLight).toBe(false);
    expect(field.mayLightWorldCell(30, 30)).toBe(false);
    materials[30 * 60 + 30] = Material.PHOT;
    field.update(materials);
    expect(field.hasLight).toBe(true);
    expect(field.mayLightWorldCell(30, 30)).toBe(true);
    // The conservative bilinear guard may admit the cell immediately outside
    // an active field bound, but it must reject the far side of the world.
    expect(field.mayLightWorldCell(59, 59)).toBe(false);
    materials.fill(Material.Empty);
    field.update(materials);
    expect(field.hasLight).toBe(false);
    expect(field.mayLightWorldCell(30, 30)).toBe(false);
  });

  it('widens sparse energy into a coloured falloff', () => {
    const { field, materials } = fixture();
    materials[10 * 21 + 10] = Material.PHOT;
    field.update(materials);
    expect(alphaAt(field, 3, 3)).toBeGreaterThan(alphaAt(field, 4, 3));
    expect(alphaAt(field, 4, 3)).toBeGreaterThan(alphaAt(field, 5, 3));
    expect(alphaAt(field, 5, 3)).toBeGreaterThan(alphaAt(field, 6, 3));
    expect(alphaAt(field, 6, 3)).toBeGreaterThan(0);
  });

  it('blends nearby energy colours and ignores ordinary matter', () => {
    const { field, materials } = fixture();
    materials[10 * 21 + 7] = Material.PHOT;
    materials[10 * 21 + 13] = Material.ELEC;
    materials[9 * 21 + 10] = Material.Water;
    field.update(materials);
    const middle = (3 * field.width + 3) * 4;
    expect(field.bytes[middle]).toBeGreaterThan(80);
    expect(field.bytes[middle + 2]).toBeGreaterThan(180);
    expect(field.bytes[middle + 3]).toBeGreaterThan(0);
  });

  it('keeps absent and sub-incandescent temperature input byte-identical', () => {
    const { field, materials } = fixture();
    materials[10 * 21 + 10] = Material.PHOT;
    field.update(materials);
    const baseline = field.bytes.slice();
    const temperatures = new Uint16Array(materials.length).fill(2_952);
    field.update(materials, temperatures);
    expect(field.bytes).toEqual(baseline);
    temperatures[10 * 21 + 10] = 7_168;
    field.update(materials, temperatures);
    expect(field.bytes).toEqual(baseline);
  });

  it('turns eligible hot ordinary matter into monotonic blackbody light', () => {
    const { field, materials } = fixture();
    const source = 10 * 21 + 10;
    materials[source] = Material.Brick;
    const temperatures = new Uint16Array(materials.length).fill(2_952);
    temperatures[source] = 12_288;
    field.update(materials, temperatures);
    const warmAlpha = alphaAt(field, 3, 3);
    temperatures[source] = 23_040;
    field.update(materials, temperatures);
    const brightAlpha = alphaAt(field, 3, 3);
    const centre = (3 * field.width + 3) * 4;
    expect(warmAlpha).toBeGreaterThan(0);
    expect(brightAlpha).toBeGreaterThan(warmAlpha);
    expect(field.bytes[centre]).toBeGreaterThan(field.bytes[centre + 1]);
    expect(field.bytes[centre + 1]).toBeGreaterThan(field.bytes[centre + 2]);
  });

  it('keeps non-thermal energy emitters byte-identical when hot', () => {
    const { field, materials } = fixture();
    const source = 10 * 21 + 10;
    materials[source] = Material.PHOT;
    field.update(materials);
    const baseline = field.bytes.slice();
    const temperatures = new Uint16Array(materials.length).fill(2_952);
    temperatures[source] = 23_040;
    field.update(materials, temperatures);
    expect(field.bytes).toEqual(baseline);
  });

  it('tints a hot thermal-core emitter without changing its light support', () => {
    const { field, materials } = fixture();
    const source = 10 * 21 + 10;
    materials[source] = Material.Fire;
    field.update(materials);
    const baseline = field.bytes.slice();
    const temperatures = new Uint16Array(materials.length).fill(2_952);
    temperatures[source] = 23_040;
    field.update(materials, temperatures);
    const centre = (3 * field.width + 3) * 4;
    expect(field.bytes).not.toEqual(baseline);
    expect(field.bytes[centre]).toBeGreaterThanOrEqual(baseline[centre]);
    expect(field.bytes[centre]).toBeGreaterThan(field.bytes[centre + 1]);
    expect(field.bytes[centre + 1]).toBeGreaterThan(field.bytes[centre + 2]);
    for (let offset = 3; offset < field.bytes.length; offset += 4) {
      expect(field.bytes[offset]).toBe(baseline[offset]);
    }
  });

  it('rejects hot empty, wall, gas, and trait-owned cells as thermal sources', () => {
    const { field, materials } = fixture();
    materials[8 * 21 + 8] = Material.Wall;
    materials[8 * 21 + 10] = Material.Smoke;
    materials[8 * 21 + 12] = Material.Plant;
    const temperatures = new Uint16Array(materials.length).fill(23_040);
    field.update(materials, temperatures);
    expect(field.hasLight).toBe(false);
    expect(field.bytes.some(Boolean)).toBe(false);
  });

  it('rejects a mismatched temperature plane', () => {
    const { field, materials } = fixture();
    expect(() => field.update(materials, new Uint16Array(materials.length - 1)))
      .toThrow('Emission temperature field size mismatch');
  });

  it('stays within its explicit 612x384 CPU allocation budget', () => {
    const { field } = fixture(612, 384);
    expect(field.allocatedByteLength).toBe(1_357_824);
    expect(field.allocatedByteLength).toBeLessThan(1.5 * 1024 * 1024);
  });
});
