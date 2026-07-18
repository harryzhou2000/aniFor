import type { MaterialCategory, MaterialInfo, MaterialPhase } from '../shared/materials';

export const enum RenderPhase {
  Solid = 0,
  Gas = 1,
  Liquid = 2,
  Energy = 3,
  Powder = 4,
  Field = 5,
}

export const enum RenderProfile {
  Neutral = 0,
  Granular = 1,
  Rigid = 2,
  Organic = 3,
  Radioactive = 4,
  Device = 5,
  Field = 6,
}

export function renderProfile(category: MaterialCategory): RenderProfile {
  if (category === 'powders' || category === 'explosives') return RenderProfile.Granular;
  if (category === 'solids') return RenderProfile.Rigid;
  if (category === 'life') return RenderProfile.Organic;
  if (category === 'radioactive') return RenderProfile.Radioactive;
  if (category === 'electronics' || category === 'powered' || category === 'sensors') return RenderProfile.Device;
  if (category === 'force' || category === 'special') return RenderProfile.Field;
  return RenderProfile.Neutral;
}

/** Relative coloured-light response for opaque material-family surfaces. */
export function surfaceLightGain(profile: RenderProfile): number {
  if (profile === RenderProfile.Rigid) return 0.32;
  if (profile === RenderProfile.Device) return 0.30;
  if (profile === RenderProfile.Field) return 0.26;
  if (profile === RenderProfile.Organic) return 0.22;
  if (profile === RenderProfile.Granular) return 0.18;
  if (profile === RenderProfile.Radioactive) return 0.16;
  return 0.20;
}

/** Matter phases that expose a coherent surface to the shared emission field. */
export function receivesSurfaceLight(phase: RenderPhase): boolean {
  return phase === RenderPhase.Solid || phase === RenderPhase.Powder || phase === RenderPhase.Field;
}

export function renderPhase(material: Pick<MaterialInfo, 'category' | 'phase'>): RenderPhase {
  const phase = material.phase ?? defaultPhase(material.category);
  if (phase === 'gas') return RenderPhase.Gas;
  if (phase === 'liquid') return RenderPhase.Liquid;
  if (phase === 'energy') return RenderPhase.Energy;
  if (phase === 'powder') return RenderPhase.Powder;
  if (phase === 'field') return RenderPhase.Field;
  return RenderPhase.Solid;
}

function defaultPhase(category: MaterialCategory): MaterialPhase {
  if (category === 'gases') return 'gas';
  if (category === 'liquids') return 'liquid';
  if (category === 'energy') return 'energy';
  if (category === 'powders' || category === 'explosives') return 'powder';
  if (category === 'force' || category === 'special') return 'field';
  return 'solid';
}
