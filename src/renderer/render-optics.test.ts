import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { renderOptics, RENDER_OPTICS_CLASS_COUNT, RenderOptics } from './render-optics';

function optics(id: Material): RenderOptics {
  const material = ALL_MATERIALS.find((candidate) => candidate.id === id);
  if (!material) throw new Error(`Missing material ${id}`);
  return renderOptics(material);
}

describe('render optics', () => {
  it('pins compact stable byte IDs', () => {
    expect([
      RenderOptics.Default,
      RenderOptics.Aqueous,
      RenderOptics.Oily,
      RenderOptics.Corrosive,
      RenderOptics.Molten,
      RenderOptics.SootyGas,
      RenderOptics.CleanGas,
      RenderOptics.RoughGranular,
      RenderOptics.SmoothRigid,
      RenderOptics.Organic,
      RenderOptics.Device,
      RenderOptics.Radioactive,
      RenderOptics.TranslucentRigid,
    ]).toEqual(Array.from({ length: RENDER_OPTICS_CLASS_COUNT }, (_, index) => index));
  });

  it('classifies representative optical families', () => {
    expect(optics(Material.Fire)).toBe(RenderOptics.Default);
    expect(optics(Material.Water)).toBe(RenderOptics.Aqueous);
    expect(optics(Material.Soap)).toBe(RenderOptics.Aqueous);
    expect(optics(Material.Oil)).toBe(RenderOptics.Oily);
    expect(optics(Material.Diesel)).toBe(RenderOptics.Oily);
    expect(optics(Material.Acid)).toBe(RenderOptics.Corrosive);
    expect(optics(Material.CAUS)).toBe(RenderOptics.Corrosive);
    expect(optics(Material.Lava)).toBe(RenderOptics.Molten);
    expect(optics(Material.MWAX)).toBe(RenderOptics.Molten);
    expect(optics(Material.Smoke)).toBe(RenderOptics.SootyGas);
    expect(optics(Material.FOG)).toBe(RenderOptics.SootyGas);
    expect(optics(Material.Oxygen)).toBe(RenderOptics.CleanGas);
    expect(optics(Material.RFRG)).toBe(RenderOptics.CleanGas);
    expect(optics(Material.Sand)).toBe(RenderOptics.RoughGranular);
    expect(optics(Material.Quartz)).toBe(RenderOptics.RoughGranular);
    expect(optics(Material.THDR)).toBe(RenderOptics.RoughGranular);
    expect(optics(Material.Wall)).toBe(RenderOptics.SmoothRigid);
    expect(optics(Material.LIFE_GOL)).toBe(RenderOptics.SmoothRigid);
    expect(optics(Material.Plant)).toBe(RenderOptics.Organic);
    expect(optics(Material.SPRK)).toBe(RenderOptics.Device);
    expect(optics(Material.PLUT)).toBe(RenderOptics.Radioactive);
    expect(optics(Material.Glass)).toBe(RenderOptics.TranslucentRigid);
    expect(optics(Material.Ice)).toBe(RenderOptics.TranslucentRigid);
    expect(optics(Material.QRTZ)).toBe(RenderOptics.TranslucentRigid);
  });

  it('respects explicit physical phases before toolbox-family fallbacks', () => {
    expect(optics(Material.Nitro)).toBe(RenderOptics.Default);
    expect(optics(Material.CFLM)).toBe(RenderOptics.CleanGas);
    expect(optics(Material.THDR)).toBe(RenderOptics.RoughGranular);
  });

  it('assigns every projected material exactly one valid class', () => {
    const classes = ALL_MATERIALS.map(renderOptics);
    expect(classes.every((value) => Number.isInteger(value) && value >= 0 && value < RENDER_OPTICS_CLASS_COUNT)).toBe(true);
    expect(Array.from(new Set(classes)).sort((a, b) => a - b)).toEqual(
      Array.from({ length: RENDER_OPTICS_CLASS_COUNT }, (_, index) => index),
    );
  });
});
