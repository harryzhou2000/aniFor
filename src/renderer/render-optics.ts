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
}

export const RENDER_OPTICS_CLASS_COUNT = 13;

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
    case Material.Soap:
      return RenderOptics.Aqueous;
    case Material.Oil:
    case Material.Diesel:
      return RenderOptics.Oily;
    case Material.Acid:
    case Material.BASE:
    case Material.CAUS:
      return RenderOptics.Corrosive;
    case Material.Lava:
    case Material.MWAX:
      return RenderOptics.Molten;
    case Material.Smoke:
    case Material.Gas:
    case Material.FOG:
      return RenderOptics.SootyGas;
    case Material.Ice:
    case Material.Glass:
    case Material.Quartz:
    case Material.DRIC:
    case Material.NICE:
    case Material.QRTZ:
    case Material.RIME:
      return RenderOptics.TranslucentRigid;
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
