import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, LIFE_PRESETS, Material } from '../shared/materials';
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
      RenderOptics.CrystallineGranular,
      RenderOptics.SootyGranular,
      RenderOptics.MetallicGranular,
      RenderOptics.CryogenicLiquid,
      RenderOptics.MetallicLiquid,
      RenderOptics.ViscousLiquid,
      RenderOptics.Cellular,
    ]).toEqual(Array.from({ length: RENDER_OPTICS_CLASS_COUNT }, (_, index) => index));
  });

  it('classifies representative optical families', () => {
    expect(optics(Material.Fire)).toBe(RenderOptics.Default);
    expect(optics(Material.Water)).toBe(RenderOptics.Aqueous);
    expect(optics(Material.Soap)).toBe(RenderOptics.ViscousLiquid);
    expect(optics(Material.Oil)).toBe(RenderOptics.Oily);
    expect(optics(Material.Diesel)).toBe(RenderOptics.Oily);
    expect(optics(Material.Nitro)).toBe(RenderOptics.Oily);
    expect(optics(Material.Acid)).toBe(RenderOptics.Corrosive);
    expect(optics(Material.CAUS)).toBe(RenderOptics.CleanGas);
    expect(optics(Material.Lava)).toBe(RenderOptics.Molten);
    expect(optics(Material.MWAX)).toBe(RenderOptics.ViscousLiquid);
    expect(optics(Material.LiquidNitrogen)).toBe(RenderOptics.CryogenicLiquid);
    expect(optics(Material.LO2)).toBe(RenderOptics.CryogenicLiquid);
    expect(optics(Material.Mercury)).toBe(RenderOptics.MetallicLiquid);
    expect(optics(Material.LRBD)).toBe(RenderOptics.MetallicLiquid);
    expect(optics(Material.DEUT)).toBe(RenderOptics.Aqueous);
    expect(optics(Material.EXOT)).toBe(RenderOptics.ViscousLiquid);
    expect(optics(Material.ISOZ)).toBe(RenderOptics.ViscousLiquid);
    expect(optics(Material.BIZR)).toBe(RenderOptics.ViscousLiquid);
    expect(optics(Material.GLOW)).toBe(RenderOptics.ViscousLiquid);
    expect(optics(Material.VIRS)).toBe(RenderOptics.ViscousLiquid);
    expect(optics(Material.GEL)).toBe(RenderOptics.ViscousLiquid);
    expect(optics(Material.Smoke)).toBe(RenderOptics.SootyGas);
    expect(optics(Material.FOG)).toBe(RenderOptics.SootyGas);
    expect(optics(Material.Oxygen)).toBe(RenderOptics.CleanGas);
    expect(optics(Material.RFRG)).toBe(RenderOptics.CleanGas);
    expect(optics(Material.AMTR)).toBe(RenderOptics.SootyGas);
    expect(optics(Material.WARP)).toBe(RenderOptics.SootyGas);
    expect(optics(Material.Sand)).toBe(RenderOptics.RoughGranular);
    expect(optics(Material.Salt)).toBe(RenderOptics.CrystallineGranular);
    expect(optics(Material.Quartz)).toBe(RenderOptics.CrystallineGranular);
    expect(optics(Material.BCOL)).toBe(RenderOptics.SootyGranular);
    expect(optics(Material.Gunpowder)).toBe(RenderOptics.SootyGranular);
    expect(optics(Material.Thermite)).toBe(RenderOptics.MetallicGranular);
    expect(optics(Material.BRMT)).toBe(RenderOptics.MetallicGranular);
    expect(optics(Material.BVBR)).toBe(RenderOptics.MetallicGranular);
    expect(optics(Material.PLUT)).toBe(RenderOptics.MetallicGranular);
    expect(optics(Material.POLO)).toBe(RenderOptics.MetallicGranular);
    expect(optics(Material.URAN)).toBe(RenderOptics.MetallicGranular);
    expect(optics(Material.SING)).toBe(RenderOptics.SootyGranular);
    expect(optics(Material.THDR)).toBe(RenderOptics.RoughGranular);
    expect(optics(Material.Wall)).toBe(RenderOptics.SmoothRigid);
    expect(optics(Material.LIFE_GOL)).toBe(RenderOptics.Cellular);
    expect(optics(Material.Plant)).toBe(RenderOptics.Organic);
    expect(optics(Material.SPRK)).toBe(RenderOptics.Device);
    for (const source of [
      Material.CLNE, Material.BCLN, Material.CONV,
      Material.PCLN, Material.PBCN, Material.CRAY,
    ]) expect(optics(source)).toBe(RenderOptics.Device);
    for (const forceSolid of [
      Material.ACEL, Material.DCEL, Material.FRAY, Material.FRME,
      Material.PIPE, Material.PSTN, Material.RPEL,
    ]) expect(optics(forceSolid)).toBe(RenderOptics.Device);
    expect(optics(Material.DMG)).toBe(RenderOptics.RoughGranular);
    expect(optics(Material.GBMB)).toBe(RenderOptics.RoughGranular);
    expect(optics(Material.VIBR)).toBe(RenderOptics.Radioactive);
    expect(optics(Material.Glass)).toBe(RenderOptics.TranslucentRigid);
    expect(optics(Material.Ice)).toBe(RenderOptics.TranslucentRigid);
    expect(optics(Material.DRIC)).toBe(RenderOptics.TranslucentRigid);
    expect(optics(Material.NICE)).toBe(RenderOptics.TranslucentRigid);
    expect(optics(Material.QRTZ)).toBe(RenderOptics.TranslucentRigid);
    expect(optics(Material.RIME)).toBe(RenderOptics.TranslucentRigid);
    expect(optics(Material.FRZW)).toBe(RenderOptics.CryogenicLiquid);
    expect(optics(Material.RFGL)).toBe(RenderOptics.CryogenicLiquid);
    expect(optics(Material.BIZRG)).toBe(RenderOptics.CleanGas);
    expect(optics(Material.MORT)).toBe(RenderOptics.SootyGas);
    expect(optics(Material.BIZRS)).toBe(RenderOptics.SmoothRigid);
    expect(optics(Material.DYST)).toBe(RenderOptics.RoughGranular);
    expect(optics(Material.FIGH)).toBe(RenderOptics.Organic);
    expect(optics(Material.BRAY)).toBe(RenderOptics.Device);
  });

  it('classifies every native LIFE projection as cellular', () => {
    for (const { material } of LIFE_PRESETS) {
      expect(optics(material)).toBe(RenderOptics.Cellular);
    }
  });

  it('respects explicit physical phases before toolbox-family fallbacks', () => {
    expect(optics(Material.Nitro)).toBe(RenderOptics.Oily);
    expect(optics(Material.CFLM)).toBe(RenderOptics.CleanGas);
    expect(optics(Material.THDR)).toBe(RenderOptics.RoughGranular);
    expect(optics(Material.SEED)).toBe(RenderOptics.RoughGranular);
    expect(optics(Material.YEST)).toBe(RenderOptics.RoughGranular);
    expect(optics(Material.AMTR)).toBe(RenderOptics.SootyGas);
    expect(optics(Material.DEUT)).toBe(RenderOptics.Aqueous);
    expect(optics(Material.URAN)).toBe(RenderOptics.MetallicGranular);
    expect(optics(Material.VIBR)).toBe(RenderOptics.Radioactive);
  });

  it('assigns every projected material exactly one valid class', () => {
    const classes = ALL_MATERIALS.map(renderOptics);
    expect(classes.every((value) => Number.isInteger(value) && value >= 0 && value < RENDER_OPTICS_CLASS_COUNT)).toBe(true);
    expect(Array.from(new Set(classes)).sort((a, b) => a - b)).toEqual(
      Array.from({ length: RENDER_OPTICS_CLASS_COUNT }, (_, index) => index),
    );
  });
});
