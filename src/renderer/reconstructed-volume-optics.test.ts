import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS } from '../shared/materials';
import { GAS_IDENTITY_STYLE_BY_MATERIAL } from './canvas-gas-identity-style';
import { renderOptics, RenderOptics } from './render-optics';
import {
  buildGasIdentityOpticsByStyle,
  buildReconstructedVolumeOpticsGLSL,
  GAS_IDENTITY_OPTICS_BY_STYLE,
} from './reconstructed-volume-optics';

describe('reconstructed volume optics', () => {
  it('projects every authored gas identity style to its canonical optics class', () => {
    const projected = buildGasIdentityOpticsByStyle();
    expect(projected).toEqual(GAS_IDENTITY_OPTICS_BY_STYLE);
    for (const material of ALL_MATERIALS) {
      const style = GAS_IDENTITY_STYLE_BY_MATERIAL[material.id];
      if (style !== 0) expect(projected[style]).toBe(renderOptics(material));
    }
    expect([...projected.slice(1)].every((optics) => (
      optics === RenderOptics.SootyGas || optics === RenderOptics.CleanGas
    ))).toBe(true);
  });

  it('generates a compact fallback-only GLSL bridge from the validated table', () => {
    const source = buildReconstructedVolumeOpticsGLSL();
    expect(source).toContain(
      'float gasBodyFinishOptics(float semanticOptics, float gasIdentityStyle)',
    );
    expect(source).toContain('if (semanticOptics > 0.5 || gasIdentityStyle < 0.5)');
    expect(source).toContain(`return mix(${RenderOptics.CleanGas.toFixed(1)}, ${RenderOptics.SootyGas.toFixed(1)}, sooty);`);
    expect(source).not.toContain('uPaletteTexture');
    expect(source).not.toContain('texture(');
  });
});
