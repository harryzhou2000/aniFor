import { Material, type MaterialCategory, type MaterialPhase } from '../shared/materials';

/** Stable byte classes packed into the material palette alpha channel. */
export const enum RenderOptics {
  Default = 0,
  Aqueous = 1,
  Oily = 2,
  Corrosive = 3,
  Molten = 4,
  SootyGas = 5,
  CleanGas = 6,
  RoughGranular = 7,
  SmoothRigid = 8,
  Organic = 9,
  Device = 10,
  Radioactive = 11,
  TranslucentRigid = 12,
  CrystallineGranular = 13,
  SootyGranular = 14,
  MetallicGranular = 15,
  CryogenicLiquid = 16,
  MetallicLiquid = 17,
  ViscousLiquid = 18,
}

export const RENDER_OPTICS_CLASS_COUNT = 19;

/** Powder-like roughness classes that share topology but not material response. */
export function isGranularOptics(optics: number): boolean {
  return optics === RenderOptics.RoughGranular
    || optics === RenderOptics.CrystallineGranular
    || optics === RenderOptics.SootyGranular
    || optics === RenderOptics.MetallicGranular;
}

export interface RenderOpticsMaterial {
  readonly id: number;
  readonly category: MaterialCategory;
  readonly phase?: MaterialPhase;
}

/** Shared material-family optics classification for WebGL and Canvas renderers. */
export function renderOptics(material: RenderOpticsMaterial): RenderOptics {
  switch (material.id) {
    case Material.Water:
    case Material.SaltWater:
    case Material.DistilledWater:
    case Material.CBNW:
      return RenderOptics.Aqueous;
    case Material.Oil:
    case Material.Diesel:
    case Material.Nitro:
      return RenderOptics.Oily;
    case Material.Acid:
    case Material.BASE:
    case Material.CAUS:
      return RenderOptics.Corrosive;
    case Material.Lava:
      return RenderOptics.Molten;
    case Material.LiquidNitrogen:
    case Material.LO2:
    case Material.FRZW:
    case Material.RFGL:
      return RenderOptics.CryogenicLiquid;
    case Material.Mercury:
    case Material.LRBD:
      return RenderOptics.MetallicLiquid;
    case Material.Soap:
    case Material.GEL:
    case Material.MWAX:
    case Material.PSTE:
    case Material.RSST:
      return RenderOptics.ViscousLiquid;
    case Material.Smoke:
    case Material.Gas:
    case Material.FOG:
    case Material.MORT:
      return RenderOptics.SootyGas;
    case Material.Ice:
    case Material.Glass:
    case Material.DRIC:
    case Material.NICE:
    case Material.QRTZ:
    case Material.RIME:
      return RenderOptics.TranslucentRigid;
    case Material.Salt:
    case Material.Snow:
    case Material.Quartz:
    case Material.BGLA:
    case Material.FRZZ:
    case Material.SLCN:
      return RenderOptics.CrystallineGranular;
    case Material.Gunpowder:
    case Material.Coal:
    case Material.BCOL:
      return RenderOptics.SootyGranular;
    case Material.Thermite:
    case Material.BREC:
    case Material.BRMT:
      return RenderOptics.MetallicGranular;
  }

  if (material.category === 'life') return RenderOptics.Organic;
  if (material.category === 'electronics' || material.category === 'powered' || material.category === 'sensors') {
    return RenderOptics.Device;
  }
  if (material.category === 'radioactive') return RenderOptics.Radioactive;

  const phase = physicalPhase(material);
  if (phase === 'gas') return RenderOptics.CleanGas;
  if (phase === 'powder') return RenderOptics.RoughGranular;
  if (phase === 'solid' && (material.category === 'solids' || material.category === 'automata')) {
    return RenderOptics.SmoothRigid;
  }
  return RenderOptics.Default;
}

function physicalPhase(material: RenderOpticsMaterial): MaterialPhase {
  if (material.phase) return material.phase;
  if (material.category === 'gases') return 'gas';
  if (material.category === 'liquids') return 'liquid';
  if (material.category === 'energy') return 'energy';
  if (material.category === 'powders' || material.category === 'explosives') return 'powder';
  if (material.category === 'force' || material.category === 'special') return 'field';
  return 'solid';
}
