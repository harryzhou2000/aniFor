import { describe, expect, it } from 'vitest';
import {
  MATERIAL_MESOSCALE_PROFILES,
  buildMaterialMesoscaleProfileGLSLSelector,
  validateMaterialMesoscaleProfiles,
} from './material-mesoscale-profiles';

describe('material mesoscale profiles', () => {
  it('keeps fluids on an authored broad radius and unopened phases exact no-ops', () => {
    validateMaterialMesoscaleProfiles(MATERIAL_MESOSCALE_PROFILES);
    expect(MATERIAL_MESOSCALE_PROFILES.liquid.radius).toBe(8);
    expect(MATERIAL_MESOSCALE_PROFILES.gas.radius).toBe(8);
    expect(MATERIAL_MESOSCALE_PROFILES.powder.radius).toBe(0);
    expect(MATERIAL_MESOSCALE_PROFILES.solid.radius).toBe(0);
  });

  it('emits one deterministic closed phase selector', () => {
    const source = buildMaterialMesoscaleProfileGLSLSelector();
    expect(source).toContain('struct MaterialMesoscaleResponse {');
    expect(source.match(/MaterialMesoscaleResponse\(/g)).toHaveLength(4);
    expect(source).toContain('MaterialMesoscaleResponse(8.0, 0.46, 0.82, 0.72, 0.68, 0.64)');
  });
});
