import {
  Application, Container, Mesh, MeshGeometry, RenderTexture, Shader, Texture, UniformGroup,
} from 'pixi.js';
import type { TextureSource } from 'pixi.js';
import { HDR_VOLUME_LAB_GLSL } from './hdr-volume-lab';
import type { FieldOutputScale } from './render-resolution';
import type { RenderLook } from './render-look';
import {
  isVisualLabDomainImplemented, packVisualLabState, type VisualLabState,
} from './visual-lab';

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
  readonly waterCurvatureVfx?: boolean;
}

/** Existing presenter textures reused by the normal-scale HDR compositor. */
export interface HDRCompositionResources {
  readonly enabled: boolean;
  readonly curvatureEnabled: boolean;
  readonly semanticTexture: TextureSource;
  readonly wallTexture: TextureSource;
  readonly liquidTexture: TextureSource;
  readonly liquidDepthTexture: TextureSource;
  readonly materialVolumeTexture: TextureSource;
  readonly sourceUniforms: UniformGroup;
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

/** Low-frequency environment visible only through the private liquid optical layer. */
const LIQUID_BACKPLATE_FRAGMENT = `
in vec2 vUv;
out vec4 finalColor;
uniform sampler2D uMaterialVolumeTexture;

void main() {
  vec3 volume = texture(
    uMaterialVolumeTexture, vUv * vec2(3.10, 2.25) + vec2(0.17, 0.31)
  ).rgb;
  float broadFold = (volume.r - 0.5) * 0.60
    + (volume.g - 0.5) * 0.28
    + (volume.b - 0.5) * 0.12;
  float depth = smoothstep(0.08, 0.94, vUv.y);
  float floorBand = smoothstep(0.60, 0.98, vUv.y);
  float windowBand = 1.0 - smoothstep(
    0.10, 0.34, abs(vUv.x + vUv.y * 0.18 - 0.38)
  );
  windowBand *= 1.0 - smoothstep(0.38, 0.92, vUv.y);
  float horizonBand = 1.0 - smoothstep(0.035, 0.18, abs(vUv.y - 0.58));
  vec3 environment = mix(
    vec3(0.032, 0.072, 0.108), vec3(0.018, 0.034, 0.050), depth
  );
  environment = mix(environment, vec3(0.072, 0.052, 0.034), floorBand * 0.52);
  environment += broadFold * vec3(0.032, 0.040, 0.046);
  environment += windowBand * vec3(0.070, 0.100, 0.132);
  environment += horizonBand * vec3(0.018, 0.014, 0.010);
  float vignette = smoothstep(0.98, 0.22, length(vUv - vec2(0.48, 0.42)));
  environment *= mix(0.72, 1.0, vignette);
  finalColor = vec4(max(environment, vec3(0.0)), 1.0);
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
uniform sampler2D uLiquidDepthTexture;
uniform sampler2D uMaterialVolumeTexture;
uniform sampler2D uBehindTexture;
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
uniform float uWaterCurvatureVfx;
uniform float uBloomIntensity;
uniform float uExposure;
uniform float uSaturation;

const float MATERIAL_WATER = 2.0;
const float MATERIAL_OIL = 8.0;
const float MATERIAL_ACID = 13.0;
const float MATERIAL_GLASS = 24.0;

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
 * Carries a broad incident-light lobe through dense liquid before the sharper
 * air-facing surface response is applied. The existing vertical optical depth
 * controls reach, while the shared smooth volume tile breaks the projection
 * into wide caustic folds. Every displaced read is exact-owner guarded, so the
 * effect changes only RGB inside an already-supported Water/Oil/Acid body.
 */
vec3 liquidInteriorTransport(
  vec3 sourceRadiance, float material, vec4 semanticCentre
) {
  vec4 liquidCentre = texture(uLiquidTexture, vUv);
  // Sample the bounded field shoulders explicitly. Pixi's cross-backend GLSL
  // path does not consistently expose fragment derivatives, while these four
  // filtered reads give the optical layer a stable world-space contour at
  // every presentation scale.
  vec2 liquidContour = vec2(
    texture(uLiquidTexture, boundedUv(vUv + vec2(uWorldTexel.x, 0.0))).a
      - texture(uLiquidTexture, boundedUv(vUv - vec2(uWorldTexel.x, 0.0))).a,
    texture(uLiquidTexture, boundedUv(vUv + vec2(0.0, uWorldTexel.y))).a
      - texture(uLiquidTexture, boundedUv(vUv - vec2(0.0, uWorldTexel.y))).a
  ) * 0.5;
  float opticalDepth = texture(uLiquidDepthTexture, vUv).r;
  float denseBody = smoothstep(0.58, 0.92, liquidCentre.a);
  float deepBody = smoothstep(18.0 / 255.0, 108.0 / 255.0, opticalDepth);
  float body = denseBody * mix(0.28, 1.0, deepBody);
  if (body < 0.015) return sourceRadiance;

  vec2 velocity = velocityFromSemantic(semanticCentre);
  vec2 worldPosition = vUv / uWorldTexel;
  // Light travels down and right from a soft upper-left studio source. The
  // native semantic velocity bends that path without introducing a new clock.
  vec2 incident = normalize(vec2(0.46, 0.888));
  float travelCells = mix(1.8, 7.2, deepBody);
  vec2 upstreamUv = boundedUv(
    vUv - incident * uWorldTexel * travelCells
      - velocity * uWorldTexel * (0.55 + deepBody * 1.65)
  );
  float ownerSupport = exactMaterial(semanticMaterial(upstreamUv), material);
  float wallBlock = step(
    0.5, floor(texture(uWallTexture, upstreamUv).r * 255.0 + 0.5)
  );
  float projectionSupport = ownerSupport * (1.0 - wallBlock);
  if (projectionSupport < 0.5) return sourceRadiance;

  vec2 volumeUv = worldPosition / vec2(108.0, 76.0)
    + velocity * 0.022
    + vec2(material * 0.031, material * -0.019);
  vec3 volume = texture(uMaterialVolumeTexture, volumeUv).rgb;
  float fold = clamp(volume.r * 0.54 + volume.g * 0.31 + volume.b * 0.15, 0.0, 1.0);
  vec3 upstreamRadiance = straightRadiance(texture(uHdrTexture, upstreamUv));
  vec2 dispersionAxis = vec2(-incident.y, incident.x);
  vec2 dispersionUv = boundedUv(
    upstreamUv + dispersionAxis * uWorldTexel * mix(0.55, 1.65, deepBody)
  );
  vec3 dispersedRadiance = straightRadiance(texture(uHdrTexture, dispersionUv));
  vec3 refractedRadiance = vec3(
    upstreamRadiance.r,
    mix(upstreamRadiance.g, dispersedRadiance.g, 0.42),
    dispersedRadiance.b
  );
  // Keep the broad-field component restrained: in a flat pool it should add
  // only a little depth variation, not translate the entire environment like
  // a decal. Put the clearer lens response on the existing liquid contour;
  // this bends the private backdrop around a real supported boundary while
  // foreground RGB and scene alpha remain untouched.
  vec2 opticalWarp = (volume.rg - vec2(0.5)) * uWorldTexel
    * mix(0.72, 1.70, deepBody);
  opticalWarp += dispersionAxis * uWorldTexel * (fold - 0.5)
    * mix(0.52, 1.35, deepBody);
  float contourMagnitude = length(liquidContour);
  vec2 contourDirection = contourMagnitude > 0.0001
    ? liquidContour / contourMagnitude : vec2(0.0);
  float contourWarp = smoothstep(0.008, 0.105, contourMagnitude);
  opticalWarp += contourDirection * uWorldTexel * contourWarp
    * mix(0.72, 2.35, deepBody);
  vec2 behindUv = boundedUv(upstreamUv + opticalWarp);
  vec2 behindDispersionUv = boundedUv(dispersionUv - opticalWarp * 0.52);
  vec3 behindRadiance = straightRadiance(texture(uBehindTexture, behindUv));
  vec3 behindDispersion = straightRadiance(texture(uBehindTexture, behindDispersionUv));
  vec3 refractedBackground = vec3(
    behindRadiance.r,
    mix(behindRadiance.g, behindDispersion.g, 0.42),
    behindDispersion.b
  );
  // Shallow liquid admits more of the private non-liquid/environment layer;
  // deeper columns retain their material-authored body before absorption.
  refractedRadiance = mix(
    refractedRadiance, refractedBackground, mix(0.70, 0.46, deepBody)
  );
  vec3 upstreamBloom = texture(uBloomTexture, upstreamUv).rgb;
  float causticCrown = smoothstep(0.50, 0.78, fold);
  float causticPocket = 1.0 - smoothstep(0.20, 0.58, fold);

  vec3 transmissionTint = material == MATERIAL_WATER
    ? vec3(0.84, 1.01, 1.12)
    : (material == MATERIAL_OIL
      ? vec3(1.13, 0.91, 0.56)
      : vec3(0.82, 1.10, 0.72));
  vec3 absorption = material == MATERIAL_WATER
    ? vec3(0.055, 0.022, 0.010)
    : (material == MATERIAL_OIL
      ? vec3(0.020, 0.075, 0.190)
      : vec3(0.085, 0.022, 0.075));
  float refractionShare = projectionSupport * body * mix(0.20, 0.38, deepBody);
  vec3 result = mix(
    sourceRadiance, refractedRadiance * transmissionTint, refractionShare
  );

  // Break Water's shallow sky reflection into broad, connected optical
  // islands instead of laying a uniform pale cap across the whole pool. The
  // existing volume tile controls both island admission and a small depth
  // warp, while the vertical optical-depth field keeps every lobe immediately
  // below a real Water surface. This changes colour only inside exact Water.
  if (material == MATERIAL_WATER) {
    float aqueousOpticalDepth = max(
      0.0, opticalDepth + (volume.b - 0.5) * (24.0 / 255.0)
    );
    float aqueousShallowSupport = denseBody
      * smoothstep(0.0, 12.0 / 255.0, aqueousOpticalDepth)
      * (1.0 - smoothstep(
        36.0 / 255.0, 108.0 / 255.0, aqueousOpticalDepth
      ));
    float aqueousSkySignal = volume.r * 0.58 + volume.g * 0.42;
    float aqueousSkyVeil = smoothstep(0.44, 0.68, aqueousSkySignal);
    float aqueousSkyIsland = smoothstep(0.56, 0.76, aqueousSkySignal);
    float aqueousSkyStrength = aqueousSkyVeil * 0.18
      + aqueousSkyIsland * 0.62;
    vec3 aqueousHeadroom = max(
      vec3(0.0), vec3(1.15) - clamp(result, 0.0, 1.15)
    );
    result += aqueousHeadroom * vec3(0.70, 0.95, 1.08)
      * aqueousShallowSupport * aqueousSkyStrength;
  }

  // A real emissive lobe is preferred when present; a restrained broad studio
  // key keeps ordinary water readable as volume rather than a flat cyan fill.
  vec3 causticTint = material == MATERIAL_WATER
    ? vec3(0.42, 0.88, 1.12)
    : (material == MATERIAL_OIL
      ? vec3(1.12, 0.67, 0.22)
      : vec3(0.48, 1.02, 0.40));
  vec3 projectedLight = upstreamBloom * 0.68 + causticTint * 0.38
    + refractedBackground * 0.22;
  vec3 headroom = max(vec3(0.0), vec3(1.18) - clamp(result, 0.0, 1.18));
  float caustic = projectionSupport * body * causticCrown
    * mix(0.075, 0.25, deepBody);
  result += headroom * projectedLight * caustic;
  // Keep a readable signed fold through broad, otherwise level liquid.  The
  // earlier caustic is intentionally selective; this lower-amplitude studio
  // lobe gives the whole connected body a slow bright face and an opposing
  // absorptive pocket, which survives fit-view presentation without becoming
  // cell texture.  It remains colour-only inside the exact liquid owner.
  float liquidLensFold = clamp((fold - 0.5) * 2.35, -1.0, 1.0);
  float liquidFoldKey = max(liquidLensFold, 0.0) * body
    * mix(0.075, 0.165, deepBody);
  float liquidFoldPocket = max(-liquidLensFold, 0.0) * body
    * mix(0.090, 0.210, deepBody);
  result += max(vec3(0.0), vec3(1.16) - clamp(result, 0.0, 1.16))
    * causticTint * liquidFoldKey;
  result *= exp(-absorption * liquidFoldPocket * 1.65);
  result *= exp(-absorption * body * deepBody * (0.42 + causticPocket * 0.85));
  return result;
}

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
  // Migrated E65 is part of the accepted E08 baseline: exact Water reuses the
  // semantic velocity samples already required by the connected surface.
  float liquidMotion = exactMaterial(material, MATERIAL_WATER)
    * smoothstep(0.10, 0.58, motionEnergy);
  // Migrated E69 is part of the accepted E08 baseline: the same already-
  // sampled native velocity and connected surface proof drive only exact Oil.
  float oilMotion = exactMaterial(material, MATERIAL_OIL)
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
  // Moving Water folds the existing private environment along its proven
  // air-facing contour. Two signed components travel with the semantic flow,
  // producing a curved lens instead of another flat cyan highlight. This is
  // RGB-only: semantic/liquid ownership and the caller's alpha remain exact.
  float movingWaterLens = exactMaterial(material, MATERIAL_WATER)
    * surface * liquidAgitation * (1.0 - wallBacked);
  float curvedWaterWave = 0.5 + 0.5 * sin(
    dot(worldPosition, tangent * 0.235 + transportDirection * 0.145)
      + ripple * 3.35
  );
  float curvedWaterCrest = smoothstep(0.56, 0.90, curvedWaterWave);
  vec2 curvedWaterWarp = (
    outward * (0.62 + (curvedWaterWave - 0.5) * 1.72)
      + tangent * (ripple * 0.78 + (curvedWaterWave - 0.5) * 0.92)
  ) * uWorldTexel * movingWaterLens * (1.35 + motionFacing * 1.55);
  vec3 curvedWaterBehind = straightRadiance(texture(
    uBehindTexture, boundedUv(transmissionUv + curvedWaterWarp)
  ));
  vec3 curvedWaterTransmission = mix(
    transmitted, curvedWaterBehind, 0.76
  ) * transmissionTint;
  result = mix(
    result, curvedWaterTransmission,
    movingWaterLens * (0.085 + curvedWaterCrest * 0.190)
  );
  // E65: the same velocity proof that bends transmission may lift only exact
  // Water's already-authoritative air-facing surface. This is a restrained
  // RGB whitecap, not spray support: scene alpha and every semantic/liquid
  // topology decision remain owned by the established E08 inputs.
  float whitecapPattern = smoothstep(0.52, 0.86, ripple * 0.5 + 0.5);
  // Break an agitated crest into soft pearly islands instead of laying one
  // continuous cyan highlight along the surface. The second incommensurate
  // carrier is world-anchored, while native speed/shear decides whether it is
  // visible; a resting pool therefore remains clean and glassy.
  float whitecapCells = smoothstep(
    0.62, 0.88,
    0.5 + 0.5 * sin(
      dot(worldPosition, vec2(0.163, -0.097)) + ripple * 2.35
    )
  );
  float whitecapBreakup = smoothstep(
    0.07, 0.42, motionSpeed + velocityShear * 0.82
  );
  float foamAgitation = exactMaterial(material, MATERIAL_WATER)
    * smoothstep(0.075, 0.36, motionEnergy)
    * (0.38 + motionFacing * 0.62);
  float whitecap = surface * max(liquidAgitation, foamAgitation)
    * (0.090 + whitecapPattern * 0.340
      + whitecapCells * whitecapBreakup * 1.720
      + min(0.320, velocityShear * 0.42));
  result += (vec3(1.18) - clamp(result, 0.0, 1.18))
    * vec3(0.90, 1.00, 1.08) * whitecap;
  // Let the sparse surviving islands cross the display-white shoulder so the
  // compositor gives them a soft photographic rolloff. This is radiance only:
  // no bloom/support/alpha is manufactured for calm water or empty air.
  result += vec3(0.14, 0.20, 0.26)
    * whitecapCells * whitecapBreakup * whitecap;
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
  // tangent shoulders around the already-proven liquid/air interface. A flat
  // shore sees equal density at both shoulders; a convex crest recedes from
  // them, while a concave pocket wraps around them. This is a single guarded
  // curvature-flow-inspired optical step, not a new field or support rule.
  if (uWaterCurvatureVfx > 0.5 && wallBacked < 0.5) {
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
    vec3 curvatureCrown = material == MATERIAL_WATER
      ? vec3(0.30, 0.82, 1.08)
      : (material == MATERIAL_OIL
        ? vec3(1.08, 0.69, 0.22)
        : vec3(0.62, 1.00, 0.54));
    vec3 curvatureAbsorption = material == MATERIAL_WATER
      ? vec3(0.160, 0.070, 0.035)
      : (material == MATERIAL_OIL
        ? vec3(0.055, 0.120, 0.280)
        : vec3(0.110, 0.045, 0.130));
    vec3 curvatureTransmissionTint = material == MATERIAL_WATER
      ? vec3(0.92, 1.03, 1.10)
      : (material == MATERIAL_OIL
        ? vec3(1.08, 0.98, 0.78)
        : vec3(0.96, 1.08, 0.92));
    float crownGain = material == MATERIAL_WATER ? 0.28
      : (material == MATERIAL_OIL ? 0.22 : 0.25);
    float pocketGain = material == MATERIAL_WATER ? 1.00
      : (material == MATERIAL_OIL ? 1.18 : 0.92);
    result += (vec3(1.16) - clamp(result, 0.0, 1.16))
      * curvatureCrown * convexCrest * curvatureKey * crownGain;
    // A convex shoulder is optically thinner: admit a restrained amount of
    // the already-sampled transmission and bias it toward the material's clear
    // wavelength. Concave pockets receive the opposite Beer-Lambert-like
    // extinction. Together these cues make curved liquid read as thickness,
    // not an opaque colour band, without touching support or scene alpha.
    vec3 shoulderTransmission = max(
      transmitted * curvatureTransmissionTint,
      result * mix(vec3(1.0), curvatureTransmissionTint, 0.22)
    );
    float shoulderWindow = convexCrest * (0.08 + curvatureKey * 0.10);
    result = mix(result, shoulderTransmission, shoulderWindow);
    float pocketOpticalDepth = concavePocket
      * (0.74 + curvatureKey * 0.26) * pocketGain;
    result *= exp(-curvatureAbsorption * pocketOpticalDepth);
  }
  ${visualLabEnabled ? `result = applyHdrLiquidSurfaceLab(
    result, material, surface, ripple, outward, transmitted, reflected,
    wallBacked, max(liquidMotion, oilMotion), motionFacing,
    clamp(dot(transportDirection, outward), -1.0, 1.0)
  );` : ''}
  return result;
}

/**
 * Turns a connected exact-Glass body into a curved lens over the private
 * non-Glass optical layer. The semantic centre owns every affected fragment;
 * the cardinal and wide owner probes only shape refraction and cannot create
 * support. The caller always preserves the original scene alpha.
 */
vec3 glassBackdropTransport(vec3 sourceRadiance, vec4 semanticCentre) {
  if (exactMaterial(materialFromSemantic(semanticCentre), MATERIAL_GLASS) < 0.5) {
    return sourceRadiance;
  }
  float wallBacked = step(
    0.5, floor(texture(uWallTexture, vUv).r * 255.0 + 0.5)
  );
  if (wallBacked > 0.5) return sourceRadiance;

  vec2 leftUv = boundedUv(vUv - vec2(uWorldTexel.x, 0.0));
  vec2 rightUv = boundedUv(vUv + vec2(uWorldTexel.x, 0.0));
  vec2 topUv = boundedUv(vUv - vec2(0.0, uWorldTexel.y));
  vec2 bottomUv = boundedUv(vUv + vec2(0.0, uWorldTexel.y));
  float sameLeft = exactMaterial(semanticMaterial(leftUv), MATERIAL_GLASS);
  float sameRight = exactMaterial(semanticMaterial(rightUv), MATERIAL_GLASS);
  float sameTop = exactMaterial(semanticMaterial(topUv), MATERIAL_GLASS);
  float sameBottom = exactMaterial(semanticMaterial(bottomUv), MATERIAL_GLASS);
  float sameCount = sameLeft + sameRight + sameTop + sameBottom;
  float emptyCount = emptyMaterial(semanticMaterial(leftUv))
    + emptyMaterial(semanticMaterial(rightUv))
    + emptyMaterial(semanticMaterial(topUv))
    + emptyMaterial(semanticMaterial(bottomUv));
  float foreignCount = 4.0 - sameCount - emptyCount;

  // Six-cell shoulders serve two purposes: both axes must cross a real Glass
  // body, and a nearby unlike owner keeps the authored contact native.
  vec2 wideX = vec2(uWorldTexel.x * 6.0, 0.0);
  vec2 wideY = vec2(0.0, uWorldTexel.y * 6.0);
  float wideLeftMaterial = semanticMaterial(boundedUv(vUv - wideX));
  float wideRightMaterial = semanticMaterial(boundedUv(vUv + wideX));
  float wideTopMaterial = semanticMaterial(boundedUv(vUv - wideY));
  float wideBottomMaterial = semanticMaterial(boundedUv(vUv + wideY));
  float wideLeft = exactMaterial(wideLeftMaterial, MATERIAL_GLASS);
  float wideRight = exactMaterial(wideRightMaterial, MATERIAL_GLASS);
  float wideTop = exactMaterial(wideTopMaterial, MATERIAL_GLASS);
  float wideBottom = exactMaterial(wideBottomMaterial, MATERIAL_GLASS);
  float wideCount = wideLeft + wideRight + wideTop + wideBottom;
  float wideEmptyCount = emptyMaterial(wideLeftMaterial)
    + emptyMaterial(wideRightMaterial)
    + emptyMaterial(wideTopMaterial)
    + emptyMaterial(wideBottomMaterial);
  float wideForeignCount = 4.0 - wideCount - wideEmptyCount;
  float localAxisSupport = step(0.5, sameLeft + sameRight)
    * step(0.5, sameTop + sameBottom);
  float wideAxisSupport = step(0.5, wideLeft + wideRight)
    * step(0.5, wideTop + wideBottom);
  float connectedBody = localAxisSupport * wideAxisSupport
    * (1.0 - step(0.5, max(foreignCount, wideForeignCount)));
  if (connectedBody < 0.5) return sourceRadiance;

  vec2 outwardSignal = vec2(
    sameLeft - sameRight, sameTop - sameBottom
  );
  float edgeMagnitude = length(outwardSignal);
  vec2 outward = edgeMagnitude > 0.001
    ? outwardSignal / edgeMagnitude : vec2(0.0);
  vec2 tangent = vec2(-outward.y, outward.x);
  float shell = smoothstep(0.12, 0.92, edgeMagnitude) * connectedBody;

  // The same shoulders distinguish a broad optical middle from its shell
  // without requiring a depth texture or altering exact Glass topology.
  float deepBody = smoothstep(1.60, 3.75, wideCount) * connectedBody;

  vec2 worldPosition = vUv / uWorldTexel;
  vec3 volume = texture(
    uMaterialVolumeTexture,
    worldPosition / vec2(104.0, 78.0) + vec2(0.37, 0.19)
  ).rgb;
  float fold = clamp(volume.r * 0.56 + volume.g * 0.29 + volume.b * 0.15, 0.0, 1.0);
  float signedFold = clamp((fold - 0.5) * 2.15, -1.0, 1.0);
  vec2 volumeWarp = (volume.rg - vec2(0.5)) * uWorldTexel
    * mix(4.2, 8.6, deepBody);
  vec2 contourWarp = outward * uWorldTexel * shell
    * (2.2 + fold * 3.2);
  contourWarp += tangent * uWorldTexel * shell * signedFold * 2.4;
  vec2 refractedUv = boundedUv(vUv + volumeWarp + contourWarp);
  vec2 dispersedUv = boundedUv(
    refractedUv - volumeWarp * 0.24
      + tangent * uWorldTexel * shell * 0.90
  );
  vec3 refracted = straightRadiance(texture(uBehindTexture, refractedUv));
  vec3 dispersed = straightRadiance(texture(uBehindTexture, dispersedUv));
  vec3 refractedGlass = vec3(
    refracted.r,
    mix(refracted.g, dispersed.g, 0.32),
    dispersed.b
  ) * vec3(0.86, 1.02, 1.10);

  // Broad connected Glass exposes the displaced environment; the shell keeps
  // more native pigment and receives a cool Fresnel crown. This is deliberately
  // a strong visual read at fit scale while remaining below a mirror-like edge.
  float backdropShare = connectedBody * mix(0.34, 0.66, deepBody)
    * mix(1.0, 0.72, shell);
  vec3 result = mix(sourceRadiance, refractedGlass, backdropShare);
  float fresnelCrown = shell * (0.085 + (1.0 - deepBody) * 0.075)
    * (0.72 + max(signedFold, 0.0) * 0.28);
  result += max(vec3(0.0), vec3(1.16) - clamp(result, 0.0, 1.16))
    * vec3(0.54, 0.88, 1.10) * fresnelCrown;
  // Make the low-frequency displacement readable even over a quiet portion
  // of the private backdrop: its positive face admits a cool internal crown,
  // while the opposite face accumulates a shallow wavelength-selective pocket.
  // Both terms remain inside the already-proven broad Glass body.
  float interiorCrown = deepBody * smoothstep(0.06, 0.72, signedFold);
  float interiorPocket = deepBody * smoothstep(0.06, 0.72, -signedFold);
  result += max(vec3(0.0), vec3(1.12) - clamp(result, 0.0, 1.12))
    * vec3(0.34, 0.72, 1.02) * interiorCrown * 0.095;
  result *= exp(-vec3(0.090, 0.040, 0.016) * interiorPocket);
  result *= exp(-vec3(0.018, 0.008, 0.003) * deepBody);
  return max(result, vec3(0.0));
}

/**
 * Project a short, broken Water light field onto dense matter immediately
 * downstream of the pool. This is deliberately a presentation effect: the
 * semantic Water samples own admission, scene alpha keeps the receiver's
 * silhouette, and the smooth shared volume tile supplies the optical breakup.
 */
vec3 waterReceiverCaustic(
  vec3 sourceRadiance, float receiverMaterial, float receiverAlpha
) {
  if (receiverAlpha < 0.70 || receiverMaterial < 0.5
    || receiverMaterial == MATERIAL_WATER
    || receiverMaterial == MATERIAL_OIL
    || receiverMaterial == MATERIAL_ACID) {
    return sourceRadiance;
  }

  vec2 incident = normalize(vec2(0.46, 0.888));
  vec2 nearUv = boundedUv(vUv - incident * uWorldTexel * 1.55);
  vec2 middleUv = boundedUv(vUv - incident * uWorldTexel * 5.60);
  vec2 farUv = boundedUv(vUv - incident * uWorldTexel * 11.80);
  float nearWater = exactMaterial(semanticMaterial(nearUv), MATERIAL_WATER)
    * smoothstep(0.50, 0.88, texture(uLiquidTexture, nearUv).a);
  float middleWater = exactMaterial(semanticMaterial(middleUv), MATERIAL_WATER)
    * smoothstep(0.50, 0.88, texture(uLiquidTexture, middleUv).a);
  float farWater = exactMaterial(semanticMaterial(farUv), MATERIAL_WATER)
    * smoothstep(0.50, 0.88, texture(uLiquidTexture, farUv).a);
  float waterPath = max(
    nearWater * 0.55, max(middleWater * 0.78, farWater * 0.46)
  );
  if (waterPath < 0.02) return sourceRadiance;

  float waterDepth = max(
    texture(uLiquidDepthTexture, nearUv).r,
    max(
      texture(uLiquidDepthTexture, middleUv).r,
      texture(uLiquidDepthTexture, farUv).r
    )
  );
  vec2 waterVelocity = velocityFromSemantic(semanticState(middleUv));
  vec2 worldPosition = vUv / uWorldTexel;
  vec3 volume = texture(
    uMaterialVolumeTexture,
    worldPosition / vec2(50.0, 34.0) + waterVelocity * 0.028
  ).rgb;
  float fold = volume.r - volume.g * 0.72 + volume.b * 0.20;
  float causticRidge = 1.0 - smoothstep(0.040, 0.190, abs(fold - 0.18));
  float causticPool = smoothstep(0.58, 0.82, volume.b)
    * smoothstep(0.34, 0.72, volume.r);
  float focus = smoothstep(12.0 / 255.0, 96.0 / 255.0, waterDepth);
  float receiverLight = waterPath * mix(0.10, 0.26, focus)
    * (0.025 + causticRidge * 0.58 + causticPool * 0.12);
  vec3 headroom = max(
    vec3(0.0), vec3(1.16) - clamp(sourceRadiance, 0.0, 1.16)
  );
  return sourceRadiance
    + headroom * vec3(0.32, 0.70, 0.94) * receiverLight;
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
      radiance = liquidInteriorTransport(radiance, material, semanticCentre);
      radiance = liquidSurfaceTransport(radiance, material, semanticCentre);
    } else if (material == MATERIAL_GLASS) {
      radiance = glassBackdropTransport(radiance, semanticCentre);
    } else {
      radiance = waterReceiverCaustic(radiance, material, scene.a);
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
  private readonly behindTarget: RenderTexture;
  private readonly bloomA: RenderTexture;
  private readonly bloomB: RenderTexture;
  private readonly behindScene = new Container();
  private readonly extractScene = new Container();
  private readonly blurScene = new Container();
  private readonly compositeScene = new Container();
  private compositeUniforms?: UniformGroup;
  private readonly sourceUniforms: UniformGroup;

  private constructor(
    private readonly renderer: RenderPassRenderer,
    private readonly sourceScene: Container,
    width: number,
    height: number,
    outputScale: FieldOutputScale,
    look: Exclude<RenderLook, 'classic'>,
    composition: HDRCompositionResources,
  ) {
    this.sourceUniforms = composition.sourceUniforms;
    const bloomWidth = Math.max(1, Math.ceil(width / 2));
    const bloomHeight = Math.max(1, Math.ceil(height / 2));
    let hdrTarget: RenderTexture | undefined;
    let behindTarget: RenderTexture | undefined;
    let bloomA: RenderTexture | undefined;
    let bloomB: RenderTexture | undefined;
    try {
      hdrTarget = RenderTexture.create({
        width, height, resolution: outputScale, format: 'rgba16float',
        alphaMode: 'premultiplied-alpha', scaleMode: 'nearest', antialias: false,
      });
      behindTarget = RenderTexture.create({
        width, height, resolution: Math.min(outputScale, 2), format: 'rgba16float',
        alphaMode: 'premultiplied-alpha', scaleMode: 'linear', antialias: false,
      });
      bloomA = RenderTexture.create({
        width: bloomWidth, height: bloomHeight, resolution: outputScale, format: 'rgba16float',
        alphaMode: 'premultiplied-alpha', scaleMode: 'linear', antialias: false,
      });
      bloomB = RenderTexture.create({
        width: bloomWidth, height: bloomHeight, resolution: outputScale, format: 'rgba16float',
        alphaMode: 'premultiplied-alpha', scaleMode: 'linear', antialias: false,
      });

      this.behindScene.addChild(createPassMesh(
        width, height, LIQUID_BACKPLATE_FRAGMENT,
        {
          uMaterialVolumeTexture: composition.materialVolumeTexture,
          uMaterialVolumeSampler: composition.materialVolumeTexture.style,
        },
        'hdr-liquid-backplate',
      ));

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
      const visualLabEnabled = isVisualLabDomainImplemented(composition.visualLab.domain);
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
          uLiquidDepthTexture: composition.liquidDepthTexture,
          uLiquidDepthSampler: composition.liquidDepthTexture.style,
          uMaterialVolumeTexture: composition.materialVolumeTexture,
          uMaterialVolumeSampler: composition.materialVolumeTexture.style,
          uBehindTexture: behindTarget.source,
          uBehindSampler: behindTarget.source.style,
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
      this.behindTarget = behindTarget;
      this.bloomA = bloomA;
      this.bloomB = bloomB;
      this.info = {
        active: true, look, liquidSurfaceVfx: composition.enabled,
        waterCurvatureVfx: composition.enabled && composition.curvatureEnabled,
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
      try { this.behindScene.destroy({ children: true }); } catch { /* best effort */ }
      try { hdrTarget?.destroy(true); } catch { /* best effort */ }
      try { behindTarget?.destroy(true); } catch { /* best effort */ }
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
    this.renderer.render({ container: this.behindScene, target: this.behindTarget, clear: true });
    try {
      this.sourceUniforms.uniforms.uOpticalLayer = 1;
      this.renderer.render({
        container: this.sourceScene, target: this.behindTarget, clear: false,
      });
    } finally {
      this.sourceUniforms.uniforms.uOpticalLayer = 0;
    }
    this.renderer.render({ container: this.sourceScene, target: this.hdrTarget, clear: true });
    // Both bloom meshes disable blending, exactly cover their matching target,
    // and unconditionally write RGBA. Clearing those private targets first is
    // therefore redundant and only adds two full RGBA16F writes per frame.
    this.renderer.render({ container: this.extractScene, target: this.bloomA, clear: false });
    this.renderer.render({ container: this.blurScene, target: this.bloomB, clear: false });
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
    this.behindScene.destroy({ children: true });
    this.extractScene.destroy({ children: true });
    this.blurScene.destroy({ children: true });
    this.compositeScene.destroy({ children: true });
    this.hdrTarget.destroy(true);
    this.behindTarget.destroy(true);
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
