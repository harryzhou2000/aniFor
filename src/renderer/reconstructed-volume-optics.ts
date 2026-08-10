import { ALL_MATERIALS } from '../shared/materials';
import { GAS_IDENTITY_STYLE_BY_MATERIAL } from './canvas-gas-identity-style';
import { renderOptics, RenderOptics } from './render-optics';

/**
 * Compile-time bridge from the propagated gas identity plane to material
 * optics. Exact semantic fragments still use their palette optics directly;
 * this table gives reconstructed atmosphere support the same family response
 * without another texture, sampler, field, or runtime material-ID lookup.
 */
export const GAS_IDENTITY_OPTICS_BY_STYLE = buildGasIdentityOpticsByStyle();

export const RECONSTRUCTED_VOLUME_OPTICS_GLSL = buildReconstructedVolumeOpticsGLSL();

export function buildGasIdentityOpticsByStyle(): Uint8Array {
  const styleCount = GAS_IDENTITY_STYLE_BY_MATERIAL.reduce(
    (maximum, style) => Math.max(maximum, style), 0,
  );
  const opticsByStyle = new Uint8Array(styleCount + 1);
  for (const material of ALL_MATERIALS) {
    const style = GAS_IDENTITY_STYLE_BY_MATERIAL[material.id];
    if (style === 0) continue;
    const optics = renderOptics(material);
    if (optics !== RenderOptics.SootyGas && optics !== RenderOptics.CleanGas) {
      throw new Error(`Gas identity style ${style} has non-gas optics ${optics}`);
    }
    const previous = opticsByStyle[style];
    if (previous !== 0 && previous !== optics) {
      throw new Error(`Gas identity style ${style} maps to conflicting optics`);
    }
    opticsByStyle[style] = optics;
  }
  for (let style = 1; style < opticsByStyle.length; style++) {
    if (opticsByStyle[style] === 0) throw new Error(`Gas identity style ${style} has no optics`);
  }
  return opticsByStyle;
}

export function buildReconstructedVolumeOpticsGLSL(
  opticsByStyle: Uint8Array = GAS_IDENTITY_OPTICS_BY_STYLE,
): string {
  const sootyStyles: number[] = [];
  for (let style = 1; style < opticsByStyle.length; style++) {
    const optics = opticsByStyle[style];
    if (optics === RenderOptics.SootyGas) sootyStyles.push(style);
    else if (optics !== RenderOptics.CleanGas) {
      throw new Error(`Gas identity style ${style} has unsupported optics ${optics}`);
    }
  }
  const sootyExpression = sootyStyles
    .map((style) => `(1.0 - step(0.5, abs(gasIdentityStyle - ${style.toFixed(1)})))`)
    .join('\n    + ');
  return `
// Reconstructed atmosphere has no exact semantic palette owner, but its
// existing style byte carries a stable propagated species family. Resolve only
// that default-optics case; exact fragments retain their palette-owned class.
float gasBodyFinishOptics(float semanticOptics, float gasIdentityStyle) {
  if (semanticOptics > 0.5 || gasIdentityStyle < 0.5) return semanticOptics;
  float sooty = clamp(
    ${sootyExpression}, 0.0, 1.0
  );
  return mix(${RenderOptics.CleanGas.toFixed(1)}, ${RenderOptics.SootyGas.toFixed(1)}, sooty);
}
`;
}
