/**
 * Scale-safe RGB finish shared by the normal and compact WebGL compositors.
 *
 * Callers retain ownership of phase support, topology, alpha, and material
 * identity. The helper consumes only their already-proven body measurements,
 * so enabling it cannot grow a silhouette or manufacture matter. Keeping this
 * source in one module also prevents the 1x-4x and true-8x shaders from
 * developing unrelated lighting vocabularies while the HDR transport remains
 * intentionally normal-scale only.
 */
export const MATERIAL_BODY_FINISH_GLSL = `
vec3 applyMaterialBodyFinish(
  vec3 color,
  float phase,
  float density,
  float depth,
  vec2 slope,
  float eligibility,
  float enabled
) {
  if (enabled < 0.5 || eligibility <= 0.0001) return color;

  float bodySupport = smoothstep(0.055, 0.42, density) * eligibility;
  float slopeLength = length(slope);
  vec2 bodyNormal = slopeLength > 0.0001 ? slope / slopeLength : vec2(0.0);
  float facing = dot(bodyNormal, normalize(vec2(-0.58, -0.815)));
  float shell = smoothstep(0.055, 0.34, density)
    * (1.0 - smoothstep(0.62, 0.94, density));
  float core = smoothstep(0.30, 0.86, depth);

  float powder = 1.0 - step(0.5, phase);
  float gas = step(1.5, phase);
  float liquid = 1.0 - powder - gas;
  vec3 keyTint = powder * vec3(1.00, 0.76, 0.46)
    + liquid * vec3(0.64, 0.86, 1.00)
    + gas * vec3(0.72, 0.82, 1.00);
  vec3 shadowTint = powder * vec3(0.74, 0.54, 0.34)
    + liquid * vec3(0.58, 0.68, 0.80)
    + gas * vec3(0.54, 0.60, 0.72);

  // One restrained key/fill model gives all reconstructed bodies the same
  // light direction. Gas favours a broad shoulder, liquid a grazing lip, and
  // powder a rougher crown; these are phase coefficients, never material IDs.
  float grazing = 1.0 - clamp(slopeLength * 2.4, 0.0, 1.0);
  float key = max(facing, 0.0) * (0.026 + powder * 0.018 + liquid * 0.014)
    + shell * (0.010 + liquid * 0.018 + gas * 0.014)
    + liquid * grazing * shell * 0.010;
  float fill = max(-facing, 0.0) * (0.012 + powder * 0.010 + gas * 0.008)
    + core * (0.010 + powder * 0.010 + gas * 0.006);
  key *= bodySupport * (1.0 - core * (0.18 + gas * 0.18));
  fill *= bodySupport;

  color += (vec3(1.08) - clamp(color, 0.0, 1.08)) * keyTint * key;
  color *= vec3(1.0) - shadowTint * fill;

  // Dense volumes keep their pigment instead of collapsing toward grey. This
  // is a bounded saturation lift over existing RGB and cannot affect alpha.
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float pigment = bodySupport * core * (0.018 + powder * 0.018 + liquid * 0.010);
  color += (color - vec3(luminance)) * pigment;
  return max(color, vec3(0.0));
}
`;
