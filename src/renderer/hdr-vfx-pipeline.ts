import {
  Application, Container, Mesh, MeshGeometry, RenderTexture, Shader, Texture, UniformGroup,
} from 'pixi.js';
import type { TextureSource } from 'pixi.js';
import { HDR_VOLUME_LAB_GLSL } from './hdr-volume-lab';
import type { FieldOutputScale } from './render-resolution';
import type { RenderLook } from './render-look';
import { packVisualLabState, type VisualLabState } from './visual-lab';

export type HDRPipelineReason = 'classic' | 'scale-8' | 'not-webgl2'
  | 'float-color-unavailable' | 'mrt-unavailable' | 'float-framebuffer-incomplete'
  | 'initialization-error' | 'runtime-error';

export interface HDRPipelineSupport {
  readonly supported: boolean;
  readonly reason?: Exclude<HDRPipelineReason, 'classic' | 'scale-8' | 'initialization-error'>;
  readonly maxDrawBuffers: number;
  readonly maxColorAttachments: number;
}

export interface HDRPipelineInfo {
  readonly active: boolean;
  readonly look: RenderLook;
  readonly reason?: HDRPipelineReason;
  readonly bloomWidth?: number;
  readonly bloomHeight?: number;
  readonly liquidSurfaceVfx?: boolean;
  readonly liquidMotionVfx?: boolean;
  readonly oilMotionVfx?: boolean;
  readonly waterCurvatureVfx?: boolean;
  readonly visualLabDomain?: VisualLabState['domain'];
  readonly visualLabVariant?: VisualLabState['variant'];
}

/** Existing presenter textures reused by the normal-scale HDR compositor. */
export interface HDRCompositionResources {
  readonly enabled: boolean;
  readonly motionEnabled: boolean;
  readonly oilMotionEnabled: boolean;
  readonly curvatureEnabled: boolean;
  readonly semanticTexture: TextureSource;
  readonly wallTexture: TextureSource;
  readonly liquidTexture: TextureSource;
  readonly atmosphereTexture: TextureSource;
  readonly atmosphereStyleTexture: TextureSource;
  readonly emissionTexture: TextureSource;
  readonly atmosphereTexel: readonly [number, number];
  readonly emissionTexel: readonly [number, number];
  readonly visualLab: Readonly<VisualLabState>;
}

interface RenderPassRenderer {
  render(options: { container: Container; target?: RenderTexture; clear?: boolean }): void;
}

const PASS_VERTEX = `
in vec2 aPosition;
in vec2 aUV;
out vec2 vUv;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 modelViewProjection = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((modelViewProjection * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUv = aUV;
}
`;

const BLOOM_EXTRACT_FRAGMENT = `
in vec2 vUv;
out vec4 finalColor;
uniform sampler2D uHdrTexture;
uniform vec2 uHdrTexel;
uniform float uThreshold;

vec3 straightRadiance(vec4 sampleValue) {
  return sampleValue.a > 0.0001 ? sampleValue.rgb / sampleValue.a : vec3(0.0);
}

vec3 thresholded(vec4 sampleValue) {
  vec3 radiance = straightRadiance(sampleValue);
  float peak = max(radiance.r, max(radiance.g, radiance.b));
  float contribution = max(0.0, peak - uThreshold) / max(peak, 0.0001);
  return radiance * contribution * sampleValue.a;
}

void main() {
  vec3 bloom = thresholded(texture(uHdrTexture, vUv)) * 0.40;
  bloom += thresholded(texture(uHdrTexture, vUv + vec2(uHdrTexel.x * 1.5, 0.0))) * 0.15;
  bloom += thresholded(texture(uHdrTexture, vUv - vec2(uHdrTexel.x * 1.5, 0.0))) * 0.15;
  bloom += thresholded(texture(uHdrTexture, vUv + vec2(0.0, uHdrTexel.y * 1.5))) * 0.15;
  bloom += thresholded(texture(uHdrTexture, vUv - vec2(0.0, uHdrTexel.y * 1.5))) * 0.15;
  finalColor = vec4(bloom, 1.0);
}
`;

const BLOOM_BLUR_FRAGMENT = `
in vec2 vUv;
out vec4 finalColor;
uniform sampler2D uBloomTexture;
uniform vec2 uBloomTexel;

void main() {
  vec3 bloom = texture(uBloomTexture, vUv).rgb * 0.227027;
  bloom += texture(uBloomTexture, vUv + vec2(uBloomTexel.x * 1.384615, 0.0)).rgb * 0.158108;
  bloom += texture(uBloomTexture, vUv - vec2(uBloomTexel.x * 1.384615, 0.0)).rgb * 0.158108;
  bloom += texture(uBloomTexture, vUv + vec2(0.0, uBloomTexel.y * 1.384615)).rgb * 0.158108;
  bloom += texture(uBloomTexture, vUv - vec2(0.0, uBloomTexel.y * 1.384615)).rgb * 0.158108;
  bloom += texture(uBloomTexture, vUv + uBloomTexel * 2.769231).rgb * 0.035885;
  bloom += texture(uBloomTexture, vUv - uBloomTexel * 2.769231).rgb * 0.035885;
  bloom += texture(uBloomTexture, vUv + vec2(uBloomTexel.x, -uBloomTexel.y) * 2.769231).rgb * 0.035885;
  bloom += texture(uBloomTexture, vUv + vec2(-uBloomTexel.x, uBloomTexel.y) * 2.769231).rgb * 0.035885;
  finalColor = vec4(bloom, 1.0);
}
`;

const createHDRTonemapFragment = (visualLabEnabled: boolean): string => `
in vec2 vUv;
out vec4 finalColor;
uniform sampler2D uHdrTexture;
uniform sampler2D uBloomTexture;
uniform sampler2D uSemanticTexture;
uniform sampler2D uWallTexture;
uniform sampler2D uLiquidTexture;
${visualLabEnabled ? `
uniform sampler2D uAtmosphereTexture;
uniform sampler2D uAtmosphereStyleTexture;
uniform sampler2D uEmissionTexture;
` : ''}
uniform vec2 uWorldTexel;
${visualLabEnabled ? `
uniform vec2 uAtmosphereTexel;
uniform vec2 uEmissionTexel;
uniform vec4 uVisualLab;
` : ''}
uniform float uLiquidSurfaceVfx;
uniform float uLiquidMotionVfx;
uniform float uOilMotionVfx;
uniform float uWaterCurvatureVfx;
uniform float uBloomIntensity;
uniform float uExposure;
uniform float uSaturation;

const float MATERIAL_WATER = 2.0;
const float MATERIAL_OIL = 8.0;
const float MATERIAL_ACID = 13.0;

vec2 boundedUv(vec2 uv) {
  return clamp(uv, uWorldTexel * 0.5, vec2(1.0) - uWorldTexel * 0.5);
}

vec4 semanticState(vec2 uv) {
  return texture(uSemanticTexture, boundedUv(uv));
}

float materialFromSemantic(vec4 state) {
  return floor(state.r * 255.0 + 0.5);
}

float semanticMaterial(vec2 uv) {
  return materialFromSemantic(semanticState(uv));
}

vec2 velocityFromSemantic(vec4 state) {
  return state.ba * 2.0 - 1.0;
}

float exactMaterial(float candidate, float owner) {
  return 1.0 - step(0.5, abs(candidate - owner));
}

float emptyMaterial(float candidate) {
  return 1.0 - step(0.5, candidate);
}

vec3 straightRadiance(vec4 sampleValue) {
  return sampleValue.a > 0.0001 ? sampleValue.rgb / sampleValue.a : vec3(0.0);
}

${visualLabEnabled ? HDR_VOLUME_LAB_GLSL : ''}

/**
 * E08 transports only colour already present in the completed HDR scene. The
 * semantic centre/cardinals prove an exact, connected, air-facing Water/Oil/
 * Acid surface before any displaced HDR or bloom read occurs. Displaced alpha
 * is never used as support and the caller always emits the original scene.a.
 */
vec3 liquidSurfaceTransport(
  vec3 sourceRadiance, float material, vec4 semanticCentre
) {
  vec2 leftUv = boundedUv(vUv - vec2(uWorldTexel.x, 0.0));
  vec2 rightUv = boundedUv(vUv + vec2(uWorldTexel.x, 0.0));
  vec2 topUv = boundedUv(vUv - vec2(0.0, uWorldTexel.y));
  vec2 bottomUv = boundedUv(vUv + vec2(0.0, uWorldTexel.y));
  // Keep E65 resource-neutral: E08 already reads these four semantic
  // cardinals. Retain each RGBA sample so its packed velocity can be consumed
  // without another texture lookup or a velocity-only field.
  vec4 semanticLeft = semanticState(leftUv);
  vec4 semanticRight = semanticState(rightUv);
  vec4 semanticTop = semanticState(topUv);
  vec4 semanticBottom = semanticState(bottomUv);
  float materialLeft = materialFromSemantic(semanticLeft);
  float materialRight = materialFromSemantic(semanticRight);
  float materialTop = materialFromSemantic(semanticTop);
  float materialBottom = materialFromSemantic(semanticBottom);
  float sameLeft = exactMaterial(materialLeft, material);
  float sameRight = exactMaterial(materialRight, material);
  float sameTop = exactMaterial(materialTop, material);
  float sameBottom = exactMaterial(materialBottom, material);
  float emptyLeft = emptyMaterial(materialLeft);
  float emptyRight = emptyMaterial(materialRight);
  float emptyTop = emptyMaterial(materialTop);
  float emptyBottom = emptyMaterial(materialBottom);
  float sameCount = sameLeft + sameRight + sameTop + sameBottom;
  float emptyCount = emptyLeft + emptyRight + emptyTop + emptyBottom;
  float foreignCount = 4.0 - sameCount - emptyCount;
  if (sameCount < 2.5 || emptyCount < 0.5 || foreignCount > 0.5) {
    return sourceRadiance;
  }

  vec4 liquidCentre = texture(uLiquidTexture, vUv);
  vec4 liquidLeft = texture(uLiquidTexture, leftUv);
  vec4 liquidRight = texture(uLiquidTexture, rightUv);
  vec4 liquidTop = texture(uLiquidTexture, topUv);
  vec4 liquidBottom = texture(uLiquidTexture, bottomUv);
  float neighbourMean = (
    liquidLeft.a + liquidRight.a + liquidTop.a + liquidBottom.a
  ) * 0.25;
  if (liquidCentre.a < 0.58 || neighbourMean < 0.46) return sourceRadiance;

  vec2 densityGradient = vec2(
    liquidRight.a - liquidLeft.a,
    liquidBottom.a - liquidTop.a
  ) * 0.5;
  float gradientLength = length(densityGradient);
  if (gradientLength < 0.025) return sourceRadiance;
  vec2 outward = -densityGradient / gradientLength;
  vec2 airVector = vec2(emptyRight - emptyLeft, emptyBottom - emptyTop);
  float airLength = length(airVector);
  if (airLength < 0.5 || dot(outward, airVector / airLength) < 0.45) {
    return sourceRadiance;
  }

  vec2 worldPosition = vUv / uWorldTexel;
  vec2 tangent = vec2(-outward.y, outward.x);
  vec2 centreVelocity = velocityFromSemantic(semanticCentre);
  vec2 neighbourVelocity = (
    velocityFromSemantic(semanticLeft) * sameLeft
      + velocityFromSemantic(semanticRight) * sameRight
      + velocityFromSemantic(semanticTop) * sameTop
      + velocityFromSemantic(semanticBottom) * sameBottom
  ) / max(1.0, sameCount);
  float motionSpeed = length(centreVelocity);
  float velocityShear = length(centreVelocity - neighbourVelocity);
  float motionEnergy = max(motionSpeed * 0.90, velocityShear * 1.35);
  float liquidMotion = uLiquidMotionVfx
    * exactMaterial(material, MATERIAL_WATER)
    * smoothstep(0.10, 0.58, motionEnergy);
  // E69 is independent of E65: the same already-sampled native velocity and
  // connected E08 surface proof drive only exact Oil's reflective slick.
  float oilMotion = uOilMotionVfx
    * exactMaterial(material, MATERIAL_OIL)
    * smoothstep(0.06, 0.42, motionEnergy);
  float motionFacing = clamp(
    abs(dot(centreVelocity, outward)) * 0.72
      + abs(dot(centreVelocity, tangent)) * 0.28
      + velocityShear * 0.62,
    0.0, 1.0
  );
  float liquidAgitation = liquidMotion * (0.42 + motionFacing * 0.58);
  float oilAgitation = oilMotion * (0.48 + motionFacing * 0.72);
  vec2 flowDirection = motionSpeed > 0.01
    ? centreVelocity / motionSpeed : vec2(0.0);
  vec2 shearDirection = centreVelocity - neighbourVelocity;
  vec2 oilFlowDirection = motionSpeed > 0.01
    ? flowDirection
    : (velocityShear > 0.01 ? shearDirection / velocityShear : vec2(0.0));
  float ripple = sin(dot(worldPosition, vec2(0.071, 0.047)) + material * 0.61)
    * sin(dot(worldPosition, vec2(-0.039, 0.083)) + material * 0.37);
  float wallBacked = step(
    0.5, floor(texture(uWallTexture, vUv).r * 255.0 + 0.5)
  );
  // Native walls are an exact E69 control. They may retain E08's established
  // static refraction, but Oil velocity cannot bend or brighten that path.
  float transportAgitation = max(
    liquidAgitation, oilAgitation * 0.78 * (1.0 - wallBacked)
  );
  // Preserve E65/E08's accepted centre-velocity direction exactly when E69 is
  // off. Only an active exact-Oil child may fall back to neighbour shear.
  vec2 transportDirection = oilMotion > 0.001 ? oilFlowDirection : flowDirection;
  float familyOffset = material == MATERIAL_WATER ? 1.85
    : (material == MATERIAL_OIL ? 1.35 : 1.60);
  vec2 transmissionUv = boundedUv(
      vUv - outward * uWorldTexel * familyOffset * (1.0 + wallBacked * 0.28)
      + tangent * uWorldTexel * ripple * (0.44 + wallBacked * 0.22)
      - transportDirection * uWorldTexel * transportAgitation * 3.40
  );
  if (exactMaterial(semanticMaterial(transmissionUv), material) < 0.5) {
    return sourceRadiance;
  }

  vec3 transmitted = straightRadiance(texture(uHdrTexture, transmissionUv));
  vec3 transmissionTint = material == MATERIAL_WATER ? vec3(0.90, 1.00, 1.08)
    : (material == MATERIAL_OIL ? vec3(1.06, 0.96, 0.78)
    : vec3(1.02, 0.92, 1.08));
  float environmentMix = clamp(
    0.50 - outward.y * 0.52 + outward.x * 0.12, 0.0, 1.0
  );
  vec3 environment = mix(
    vec3(0.075, 0.055, 0.038), vec3(0.075, 0.145, 0.215), environmentMix
  );
  if (material == MATERIAL_OIL) environment *= vec3(1.24, 0.98, 0.68);
  else if (material == MATERIAL_ACID) environment *= vec3(1.02, 0.82, 1.18);
  vec2 reflectionUv = boundedUv(vUv + outward * uWorldTexel * 2.4);
  vec3 reflected = environment
    + texture(uBloomTexture, reflectionUv).rgb * (0.32 + wallBacked * 0.08);

  float surface = smoothstep(0.035, 0.24, gradientLength)
    * smoothstep(0.46, 0.78, neighbourMean);
  float f0 = material == MATERIAL_WATER ? 0.020
    : (material == MATERIAL_OIL ? 0.060 : 0.042);
  float grazing = smoothstep(0.035, 0.30, gradientLength);
  float fresnel = f0 + (1.0 - f0) * pow(grazing, 5.0);
  float reflectionShare = clamp(fresnel * 1.8 + wallBacked * 0.025, 0.04, 0.34);
  vec3 transported = mix(transmitted * transmissionTint, reflected, reflectionShare);
  float transportAmount = surface * (
    material == MATERIAL_WATER ? 0.18 : (material == MATERIAL_OIL ? 0.15 : 0.16)
  ) * (1.0 + wallBacked * 0.24 + transportAgitation);
  vec3 result = mix(sourceRadiance, transported, min(0.24, transportAmount));
  // E65: the same velocity proof that bends transmission may lift only exact
  // Water's already-authoritative air-facing surface. This is a restrained
  // RGB whitecap, not spray support: scene alpha and every semantic/liquid
  // topology decision remain owned by the established E08 inputs.
  float whitecapPattern = smoothstep(0.18, 0.88, ripple * 0.5 + 0.5);
  float whitecap = surface * liquidAgitation
    * (0.380 + whitecapPattern * 0.720 + min(0.280, velocityShear * 0.36));
  result += (vec3(1.18) - clamp(result, 0.0, 1.18))
    * vec3(0.82, 0.96, 1.08) * whitecap;
  // E69: exact moving Oil stretches its already-live HDR reflection along the
  // native flow and carries an opposing cool absorptive wake. The direction
  // comes only from E08's retained semantic velocity samples; the ribbon
  // recomposes E08's already-live static ripple rather than adding a carrier.
  // This changes RGB only and adds no texture read,
  // sampler, target, pass, allocation, clock, support, alpha, or topology.
  if (oilMotion > 0.001 && wallBacked < 0.5) {
    float oilFlowFacing = clamp(dot(oilFlowDirection, outward), -1.0, 1.0);
    float oilLeading = smoothstep(-0.10, 0.62, oilFlowFacing);
    float oilWake = smoothstep(-0.10, 0.62, -oilFlowFacing);
    float oilRibbon = smoothstep(
      0.10, 0.86, ripple * 0.5 + oilFlowFacing * 0.24 + 0.50
    );
    float oilSlick = surface * oilMotion * (0.55 + motionFacing * 0.85);
    vec3 oilReflection = mix(
      vec3(1.12, 0.72, 0.24), max(reflected, vec3(0.0)), 0.38
    );
    // Keep the two lobes optically distinct: the leading face receives the
    // amber reflection, while a receding face cannot inherit that lift and
    // therefore exposes the cooler wavelength-selective absorption below.
    float oilKey = oilSlick * oilLeading * (0.26 + oilRibbon * 0.26);
    result += (vec3(1.22) - clamp(result, 0.0, 1.22))
      * oilReflection * oilKey;
    float oilPocket = oilSlick
      * (0.08 + oilWake * 0.56 + (1.0 - oilRibbon) * 0.12);
    result *= vec3(1.0) - vec3(0.15, 0.25, 0.65) * oilPocket;
  }
  // E66: sample the existing species-aware liquid plane at two mesoscopic
  // tangent shoulders around the already-proven Water/air interface. A flat
  // shore sees equal density at both shoulders; a convex crest recedes from
  // them, while a concave pocket wraps around them. This is a single guarded
  // curvature-flow-inspired optical step, not a new field or support rule.
  if (uWaterCurvatureVfx > 0.5
    && exactMaterial(material, MATERIAL_WATER) > 0.5 && wallBacked < 0.5) {
    float outwardWeight = max(0.0001, abs(outward.x) + abs(outward.y));
    float outwardDensity = (
      max(outward.x, 0.0) * liquidRight.a
        + max(-outward.x, 0.0) * liquidLeft.a
        + max(outward.y, 0.0) * liquidBottom.a
        + max(-outward.y, 0.0) * liquidTop.a
    ) / outwardWeight;
    vec2 curvatureEdgeUv = boundedUv(vUv + outward * uWorldTexel * 0.72);
    vec4 curvaturePlus = texture(
      uLiquidTexture, boundedUv(curvatureEdgeUv + tangent * uWorldTexel * 12.0)
    );
    vec4 curvatureMinus = texture(
      uLiquidTexture, boundedUv(curvatureEdgeUv - tangent * uWorldTexel * 12.0)
    );
    float plusCompatible = max(
      1.0 - step(0.035, curvaturePlus.a),
      1.0 - step(0.075, length(curvaturePlus.rgb - liquidCentre.rgb))
    );
    float minusCompatible = max(
      1.0 - step(0.035, curvatureMinus.a),
      1.0 - step(0.075, length(curvatureMinus.rgb - liquidCentre.rgb))
    );
    float edgeDensity = mix(liquidCentre.a, outwardDensity, 0.72);
    float curvatureResidual = edgeDensity
      - (curvaturePlus.a + curvatureMinus.a) * 0.5;
    float convexCrest = surface * plusCompatible * minusCompatible
      * smoothstep(0.12, 0.46, curvatureResidual);
    float concavePocket = surface * plusCompatible * minusCompatible
      * smoothstep(0.12, 0.46, -curvatureResidual);
    float curvatureKey = 0.72 + 0.28 * max(
      0.0, dot(outward, normalize(vec2(-0.58, -0.815)))
    );
    result += (vec3(1.16) - clamp(result, 0.0, 1.16))
      * vec3(0.30, 0.82, 1.08) * convexCrest * curvatureKey * 0.28;
    result *= vec3(1.0) - vec3(0.050, 0.070, 0.100)
      * concavePocket * (0.74 + curvatureKey * 0.26);
  }
  return result;
}

vec3 acesFilm(vec3 value) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((value * (a * value + b)) / (value * (c * value + d) + e), 0.0, 1.0);
}

void main() {
  vec4 scene = texture(uHdrTexture, vUv);
  if (scene.a <= 0.0001) {
    finalColor = vec4(0.0);
    return;
  }
  vec3 radiance = scene.rgb / scene.a;
  if (uLiquidSurfaceVfx > 0.5) {
    vec4 semanticCentre = semanticState(vUv);
    float material = materialFromSemantic(semanticCentre);
    if (material == MATERIAL_WATER || material == MATERIAL_OIL || material == MATERIAL_ACID) {
      radiance = liquidSurfaceTransport(radiance, material, semanticCentre);
    }
  }
  ${visualLabEnabled ? 'radiance = applyHdrVolumeLab(radiance, vUv);' : ''}
  // Bloom is presentation-only RGB. Existing scene alpha remains the sole
  // owner of silhouettes, gaps, and sparse material topology.
  float support = smoothstep(0.002, 0.10, scene.a);
  radiance += texture(uBloomTexture, vUv).rgb * uBloomIntensity * support;
  radiance *= uExposure;
  float luma = dot(radiance, vec3(0.2126, 0.7152, 0.0722));
  radiance = mix(vec3(luma), radiance, uSaturation);
  radiance = max(radiance, vec3(0.0));
  float peak = max(radiance.r, max(radiance.g, radiance.b));
  // Preserve the established albedo/mesostructure response below display
  // white. ACES owns only the HDR shoulder; applying it to every ordinary
  // powder, liquid, and gas pixel lifts midtones and erases useful contrast.
  float hdrShoulder = smoothstep(0.92, 1.24, peak);
  vec3 displayColor = mix(clamp(radiance, 0.0, 1.0), acesFilm(radiance), hdrShoulder);
  finalColor = vec4(displayColor * scene.a, scene.a);
}
`;

/** Default compositor: retained independently so ordinary pages compile no lab code. */
export const HDR_TONEMAP_FRAGMENT = createHDRTonemapFragment(false);

/** Explicit visual-lab compositor; supports same-page off/A/B switching. */
export const HDR_VISUAL_LAB_TONEMAP_FRAGMENT = createHDRTonemapFragment(true);

/**
 * Proves the WebGL2 features needed by the first HDR experiment on the actual
 * Pixi context. The temporary 2x2 attachment is released before any world-size
 * target is allocated.
 */
export function probeHDRPipelineSupport(
  context: WebGL2RenderingContext | undefined,
): HDRPipelineSupport {
  if (!context || typeof WebGL2RenderingContext === 'undefined'
    || !(context instanceof WebGL2RenderingContext)) {
    return { supported: false, reason: 'not-webgl2', maxDrawBuffers: 0, maxColorAttachments: 0 };
  }
  const maxDrawBuffers = Number(context.getParameter(context.MAX_DRAW_BUFFERS)) || 0;
  const maxColorAttachments = Number(context.getParameter(context.MAX_COLOR_ATTACHMENTS)) || 0;
  if (!context.getExtension('EXT_color_buffer_float')) {
    return { supported: false, reason: 'float-color-unavailable', maxDrawBuffers, maxColorAttachments };
  }
  if (maxDrawBuffers < 2 || maxColorAttachments < 2) {
    return { supported: false, reason: 'mrt-unavailable', maxDrawBuffers, maxColorAttachments };
  }

  const previousFramebuffer = context.getParameter(context.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
  const previousTexture = context.getParameter(context.TEXTURE_BINDING_2D) as WebGLTexture | null;
  const texture = context.createTexture();
  const framebuffer = context.createFramebuffer();
  if (!texture || !framebuffer) {
    if (texture) context.deleteTexture(texture);
    if (framebuffer) context.deleteFramebuffer(framebuffer);
    return {
      supported: false, reason: 'float-framebuffer-incomplete',
      maxDrawBuffers, maxColorAttachments,
    };
  }
  let complete = false;
  try {
    context.bindTexture(context.TEXTURE_2D, texture);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.NEAREST);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.NEAREST);
    context.texStorage2D(context.TEXTURE_2D, 1, context.RGBA16F, 2, 2);
    context.bindFramebuffer(context.FRAMEBUFFER, framebuffer);
    context.framebufferTexture2D(
      context.FRAMEBUFFER, context.COLOR_ATTACHMENT0, context.TEXTURE_2D, texture, 0,
    );
    complete = context.checkFramebufferStatus(context.FRAMEBUFFER) === context.FRAMEBUFFER_COMPLETE;
  } catch {
    complete = false;
  } finally {
    context.bindFramebuffer(context.FRAMEBUFFER, previousFramebuffer);
    context.bindTexture(context.TEXTURE_2D, previousTexture);
    context.deleteFramebuffer(framebuffer);
    context.deleteTexture(texture);
  }
  return complete
    ? { supported: true, maxDrawBuffers, maxColorAttachments }
    : {
      supported: false, reason: 'float-framebuffer-incomplete',
      maxDrawBuffers, maxColorAttachments,
    };
}

/** Optional 1x-4x HDR/bloom/tonemap experiment. */
export class HDRVfxPipeline {
  readonly info: HDRPipelineInfo;
  private readonly hdrTarget: RenderTexture;
  private readonly bloomA: RenderTexture;
  private readonly bloomB: RenderTexture;
  private readonly extractScene = new Container();
  private readonly blurScene = new Container();
  private readonly compositeScene = new Container();
  private compositeUniforms?: UniformGroup;

  private constructor(
    private readonly renderer: RenderPassRenderer,
    private readonly sourceScene: Container,
    width: number,
    height: number,
    outputScale: FieldOutputScale,
    look: Exclude<RenderLook, 'classic'>,
    composition: HDRCompositionResources,
  ) {
    const bloomWidth = Math.max(1, Math.ceil(width / 2));
    const bloomHeight = Math.max(1, Math.ceil(height / 2));
    let hdrTarget: RenderTexture | undefined;
    let bloomA: RenderTexture | undefined;
    let bloomB: RenderTexture | undefined;
    try {
      hdrTarget = RenderTexture.create({
        width, height, resolution: outputScale, format: 'rgba16float',
        alphaMode: 'premultiplied-alpha', scaleMode: 'nearest', antialias: false,
      });
      bloomA = RenderTexture.create({
        width: bloomWidth, height: bloomHeight, resolution: outputScale, format: 'rgba16float',
        alphaMode: 'premultiplied-alpha', scaleMode: 'linear', antialias: false,
      });
      bloomB = RenderTexture.create({
        width: bloomWidth, height: bloomHeight, resolution: outputScale, format: 'rgba16float',
        alphaMode: 'premultiplied-alpha', scaleMode: 'linear', antialias: false,
      });

      this.extractScene.addChild(createPassMesh(
        bloomWidth, bloomHeight, BLOOM_EXTRACT_FRAGMENT,
        {
          passUniforms: new UniformGroup({
            uHdrTexel: {
              value: new Float32Array([1 / (width * outputScale), 1 / (height * outputScale)]),
              type: 'vec2<f32>',
            },
            uThreshold: { value: look === 'neon-lab' ? 0.76 : 0.96, type: 'f32' },
          }),
          uHdrTexture: hdrTarget.source,
          uHdrSampler: hdrTarget.source.style,
        },
        'hdr-bloom-extract',
      ));
      this.blurScene.addChild(createPassMesh(
        bloomWidth, bloomHeight, BLOOM_BLUR_FRAGMENT,
        {
          passUniforms: new UniformGroup({
            uBloomTexel: {
              value: new Float32Array([
                1 / (bloomWidth * outputScale), 1 / (bloomHeight * outputScale),
              ]),
              type: 'vec2<f32>',
            },
          }),
          uBloomTexture: bloomA.source,
          uBloomSampler: bloomA.source.style,
        },
        'hdr-bloom-blur',
      ));
      const visualLabEnabled = composition.visualLab.domain !== 'off';
      const compositeUniforms = new UniformGroup({
        uBloomIntensity: { value: look === 'neon-lab' ? 0.62 : 0.34, type: 'f32' },
        uExposure: { value: look === 'neon-lab' ? 1.04 : 1.0, type: 'f32' },
        uSaturation: { value: look === 'neon-lab' ? 1.14 : 1.01, type: 'f32' },
        uWorldTexel: {
          value: new Float32Array([1 / width, 1 / height]), type: 'vec2<f32>',
        },
        ...(visualLabEnabled ? {
          uAtmosphereTexel: {
            value: new Float32Array(composition.atmosphereTexel), type: 'vec2<f32>',
          },
        } : {}),
        ...(visualLabEnabled ? {
          uEmissionTexel: {
            value: new Float32Array(composition.emissionTexel), type: 'vec2<f32>',
          },
        } : {}),
        ...(visualLabEnabled ? {
          uVisualLab: {
            value: packVisualLabState(composition.visualLab),
            type: 'vec4<f32>',
          },
        } : {}),
        uLiquidSurfaceVfx: { value: composition.enabled ? 1 : 0, type: 'f32' },
        uLiquidMotionVfx: {
          value: composition.enabled && composition.motionEnabled ? 1 : 0,
          type: 'f32',
        },
        uOilMotionVfx: {
          value: composition.enabled && composition.oilMotionEnabled ? 1 : 0,
          type: 'f32',
        },
        uWaterCurvatureVfx: {
          value: composition.enabled && composition.curvatureEnabled ? 1 : 0,
          type: 'f32',
        },
      });
      this.compositeScene.addChild(createPassMesh(
        width, height,
        visualLabEnabled ? HDR_VISUAL_LAB_TONEMAP_FRAGMENT : HDR_TONEMAP_FRAGMENT,
        {
          passUniforms: compositeUniforms,
          uHdrTexture: hdrTarget.source,
          uHdrSampler: hdrTarget.source.style,
          uBloomTexture: bloomB.source,
          uBloomSampler: bloomB.source.style,
          uSemanticTexture: composition.semanticTexture,
          uSemanticSampler: composition.semanticTexture.style,
          uWallTexture: composition.wallTexture,
          uWallSampler: composition.wallTexture.style,
          uLiquidTexture: composition.liquidTexture,
          uLiquidSampler: composition.liquidTexture.style,
          ...(visualLabEnabled ? {
            uAtmosphereTexture: composition.atmosphereTexture,
            uAtmosphereSampler: composition.atmosphereTexture.style,
            uAtmosphereStyleTexture: composition.atmosphereStyleTexture,
            uAtmosphereStyleSampler: composition.atmosphereStyleTexture.style,
            uEmissionTexture: composition.emissionTexture,
            uEmissionSampler: composition.emissionTexture.style,
          } : {}),
        },
        'hdr-aces-composite',
      ));
      this.compositeUniforms = compositeUniforms;
      this.hdrTarget = hdrTarget;
      this.bloomA = bloomA;
      this.bloomB = bloomB;
      this.info = {
        active: true, look, liquidSurfaceVfx: composition.enabled,
        liquidMotionVfx: composition.enabled && composition.motionEnabled,
        oilMotionVfx: composition.enabled && composition.oilMotionEnabled,
        waterCurvatureVfx: composition.enabled && composition.curvatureEnabled,
        visualLabDomain: composition.visualLab.domain,
        visualLabVariant: composition.visualLab.variant,
        bloomWidth: bloomWidth * outputScale,
        bloomHeight: bloomHeight * outputScale,
      };
    } catch (error) {
      // Static creation can succeed while shader/pipeline realization fails.
      // The constructor never becomes an instance in that case, so release
      // every local allocation rather than waiting for Pixi's eventual GC.
      try { this.extractScene.destroy({ children: true }); } catch { /* best effort */ }
      try { this.blurScene.destroy({ children: true }); } catch { /* best effort */ }
      try { this.compositeScene.destroy({ children: true }); } catch { /* best effort */ }
      try { hdrTarget?.destroy(true); } catch { /* best effort */ }
      try { bloomA?.destroy(true); } catch { /* best effort */ }
      try { bloomB?.destroy(true); } catch { /* best effort */ }
      throw error;
    }
  }

  static create(
    app: Application,
    sourceScene: Container,
    width: number,
    height: number,
    outputScale: FieldOutputScale,
    look: RenderLook,
    composition: HDRCompositionResources,
  ): { readonly pipeline?: HDRVfxPipeline; readonly info: HDRPipelineInfo } {
    if (look === 'classic') return { info: { active: false, look, reason: 'classic' } };
    if (outputScale === 8) return { info: { active: false, look, reason: 'scale-8' } };
    const context = (app.renderer as { gl?: WebGL2RenderingContext }).gl;
    const support = probeHDRPipelineSupport(context);
    if (!support.supported) {
      return { info: { active: false, look, reason: support.reason } };
    }
    try {
      const pipeline = new HDRVfxPipeline(
        app.renderer as unknown as RenderPassRenderer,
        sourceScene, width, height, outputScale, look, composition,
      );
      return { pipeline, info: pipeline.info };
    } catch {
      return { info: { active: false, look, reason: 'initialization-error' } };
    }
  }

  render(): void {
    this.renderer.render({ container: this.sourceScene, target: this.hdrTarget, clear: true });
    this.renderer.render({ container: this.extractScene, target: this.bloomA, clear: true });
    this.renderer.render({ container: this.blurScene, target: this.bloomB, clear: true });
    this.renderer.render({ container: this.compositeScene, clear: true });
  }

  /** Updates only the fixed comparison vec4; callers decide when to render. */
  setVisualLabState(state: Readonly<VisualLabState>): void {
    const target = this.compositeUniforms?.uniforms.uVisualLab as Float32Array | undefined;
    if (!target) return;
    target[0] = state.domainCode;
    target[1] = state.variant;
    target[2] = state.target;
    target[3] = state.gain;
  }

  destroy(): void {
    this.extractScene.destroy({ children: true });
    this.blurScene.destroy({ children: true });
    this.compositeScene.destroy({ children: true });
    this.hdrTarget.destroy(true);
    this.bloomA.destroy(true);
    this.bloomB.destroy(true);
  }
}

function createPassMesh(
  width: number,
  height: number,
  fragment: string,
  resources: Record<string, unknown>,
  name: string,
): Mesh<MeshGeometry, Shader> {
  const shader = Shader.from({ gl: { vertex: PASS_VERTEX, fragment, name }, resources });
  const geometry = new MeshGeometry({
    positions: new Float32Array([0, 0, width, 0, width, height, 0, height]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  });
  const mesh = new Mesh({ geometry, shader, texture: Texture.WHITE });
  mesh.blendMode = 'none';
  return mesh;
}
