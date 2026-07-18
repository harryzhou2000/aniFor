import type { MaterialCategory } from '../shared/materials';

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

