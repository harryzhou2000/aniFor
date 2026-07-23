import {
  Application,
  BufferImageSource,
  Container,
  Filter,
  Mesh,
  MeshGeometry,
  Shader,
  Sprite,
  Texture,
  UniformGroup,
} from 'pixi.js';
import { DirtyChunkGrid } from './dirty-chunk-grid';
import {
  WEBGL_EIGHT_X_FRAME_STALL_MS, webGLPromotionTimeout, type FieldOutputScale,
} from './render-resolution';
import { POWDER_SURFACE_REFRESH_INTERVAL } from './powder-surface-field';
import { updateBoundaryStabilityRect } from './boundary-stability-field';
import { clientToCanvasWorld } from './client-coordinate-map';
import { RenderFieldSet, type RenderMaterialStyle } from './render-field-set';
import { packSemanticRect } from './semantic-field';
import { packExteriorAir, packPresentationStateRect, packWallRect } from './wall-field';
import { RenderPhase } from './render-profile';
import {
  powderRenderStyleValue, type PowderRenderStyle,
} from './powder-render-style';
import { installWebGLContextLossHandler } from './webgl-context-loss';
import { writeSolidOpticalDepth } from './solid-optical-depth-field';
import {
  GAS_IDENTITY_MOTIF_TEXTURE_BYTES,
  GAS_IDENTITY_MOTIF_TEXTURE_HEIGHT,
  GAS_IDENTITY_MOTIF_TEXTURE_WIDTH,
} from './canvas-gas-identity-style';
interface PresenterViewport { readonly width: number; readonly height: number }

interface WebGLTimerQueryExtension {
  readonly TIME_ELAPSED_EXT: number;
  readonly GPU_DISJOINT_EXT: number;
}

export interface WebGLPresentationTiming {
  readonly source: 'gpu-query' | 'gpu-fence' | 'cpu-submission';
  readonly sequence: number;
  readonly usableSamples: number;
  readonly discardedSamples: number;
  readonly medianMs: number;
  readonly p90Ms: number;
  readonly maximumMs: number;
}

const FIELD_VERTEX = `
in vec2 aPosition;
in vec2 aUV;
out vec2 vFieldCoord;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 modelViewProjection = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((modelViewProjection * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vFieldCoord = aUV;
}
`;

const FIELD_FILTER_VERTEX = `
in vec2 aPosition;
out vec2 vFieldCoord;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main() {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vFieldCoord = aPosition;
}
`;

const FIELD_FRAGMENT = `
in vec2 vFieldCoord;
out vec4 finalColor;
uniform sampler2D uFieldTexture;
uniform sampler2D uWallTexture;
uniform sampler2D uAtmosphereTexture;
uniform sampler2D uAtmosphereStyleTexture;
uniform sampler2D uGasIdentityMotifTexture;
uniform sampler2D uEmissionTexture;
uniform sampler2D uLiquidTexture;
uniform sampler2D uBoundaryStabilityTexture;
uniform sampler2D uPowderSurfaceTexture;
uniform sampler2D uSuspensionTexture;
uniform sampler2D uPaletteTexture;
uniform sampler2D uStyleTexture;
uniform vec2 uTexel;
uniform vec2 uFieldSize;
uniform vec2 uAtmosphereTexel;
uniform vec2 uEmissionTexel;
uniform float uTime;
uniform float uHighQuality;
uniform float uAnalyticLightingQuality;
uniform float uGasFieldLighting;
uniform float uGasVolumeChroma;
uniform float uGasIdentityStyling;
uniform float uEmissionVolumeChroma;
uniform float uLiquidFieldLighting;
uniform float uLiquidVolumeChroma;
uniform float uLiquidIdentityStyling;
uniform float uLiquidOpticalDepth;
uniform float uSolidOpticalDepth;
uniform float uTranslucentFieldTransmission;
uniform float uTranslucentBackdropRefraction;
uniform float uSolidContactDepth;
uniform float uTranslucentLensShell;
uniform float uSolidCurvatureDepth;
uniform float uSurfaceContourLighting;
uniform float uPhaseContactLighting;
uniform float uSolidFieldLighting;
uniform float uRoleMaterialStyling;
uniform float uCellularMaterialStyling;
uniform float uSensorMaterialStyling;
uniform float uUnusualPowderStyling;
uniform float uExplosivePowderStyling;
uniform float uUnusualSolidStyling;
uniform float uLiquidSilhouetteCohesion;
uniform float uThermalMaterialStyling;
uniform float uEnergyCoreRelief;
uniform float uEnergyIdentityStyling;
uniform float uVibrStateStyling;
uniform float uDeutStateStyling;
uniform float uSourceTargetStyling;
uniform float uBotanicalIdentityStyling;
uniform float uPowderStyle;
uniform float uPowderBodyDepth;
uniform float uSuspensionActive;
vec4 field(vec2 uv) { return texture(uFieldTexture, clamp(uv, uTexel * 0.5, vec2(1.0) - uTexel * 0.5)); }
vec4 wallField(vec2 uv) { return texture(uWallTexture, clamp(uv, uTexel * 0.5, vec2(1.0) - uTexel * 0.5)); }
float materialAt(vec2 uv) { return floor(field(uv).r * 255.0 + 0.5); }
float wallAt(vec2 uv) { return floor(wallField(uv).r * 255.0 + 0.5); }
float boundaryStabilityAt(vec2 uv) { return texture(uBoundaryStabilityTexture, clamp(uv, uTexel * 0.5, vec2(1.0) - uTexel * 0.5)).r; }
float sameMaterial(vec2 uv, float material) { return 1.0 - step(0.5, abs(materialAt(uv) - material)); }
float traitFlag(float traits, float mask) { return mod(floor(traits / mask), 2.0); }
float granularOptics(float optics) {
  return optics == 7.0 || optics == 13.0 || optics == 14.0 || optics == 15.0 ? 1.0 : 0.0;
}
float surfaceLightGain(float profile) {
  if (profile == 2.0) return 0.32;
  if (profile == 5.0) return 0.30;
  if (profile == 6.0) return 0.26;
  if (profile == 3.0) return 0.22;
  if (profile == 1.0) return 0.18;
  if (profile == 4.0) return 0.16;
  return 0.20;
}
vec3 surfaceChromaKey(float optics) {
  if (optics == 7.0) return vec3(1.00, 0.82, 0.56);
  if (optics == 8.0 || optics == 19.0) return vec3(0.76, 0.91, 1.00);
  if (optics == 9.0) return vec3(0.82, 1.00, 0.66);
  if (optics == 10.0) return vec3(0.60, 0.88, 1.00);
  if (optics == 11.0) return vec3(0.62, 1.00, 0.72);
  if (optics == 12.0) return vec3(0.70, 0.90, 1.00);
  if (optics == 13.0) return vec3(0.72, 0.92, 1.00);
  if (optics == 14.0) return vec3(0.78, 0.72, 0.62);
  if (optics == 15.0) return vec3(1.00, 0.78, 0.42);
  return vec3(0.92, 0.86, 0.72);
}
vec3 surfaceChromaShadow(float optics) {
  if (optics == 7.0) return vec3(0.72, 0.62, 0.50);
  if (optics == 8.0 || optics == 19.0) return vec3(0.95, 0.72, 0.44);
  if (optics == 9.0) return vec3(0.78, 0.66, 0.45);
  if (optics == 10.0) return vec3(0.96, 0.70, 0.38);
  if (optics == 11.0) return vec3(0.74, 0.62, 0.42);
  if (optics == 12.0) return vec3(0.90, 0.72, 0.50);
  if (optics == 13.0) return vec3(0.86, 0.72, 0.62);
  if (optics == 14.0) return vec3(0.92, 0.86, 0.78);
  if (optics == 15.0) return vec3(0.82, 0.70, 0.60);
  return vec3(0.86, 0.70, 0.48);
}
float surfaceChromaResponse(float density, vec2 gradient, float optics) {
  if (density <= 0.02 || density >= 0.98) return 0.0;
  float gradientLength = length(gradient);
  if (gradientLength <= 0.0001) return 0.0;
  float band = smoothstep(0.02, 0.42, density)
    * (1.0 - smoothstep(0.58, 0.98, density));
  float familyGain = optics == 13.0 ? 0.98
    : (optics == 14.0 ? 0.58
    : (optics == 15.0 ? 1.0
    : (optics == 12.0 ? 1.0
    : (optics == 8.0 || optics == 19.0 ? 0.94
    : (optics == 10.0 ? 0.90
    : (optics == 11.0 ? 0.86
    : (optics == 9.0 ? 0.82
    : (optics == 7.0 ? 0.92 : 0.78))))))));
  float directional = clamp(dot(gradient / gradientLength, vec2(0.48, 0.68)), -1.0, 1.0);
  return clamp(directional * band * 0.065 * familyGain, -0.065, 0.065);
}
vec3 applySurfaceChroma(vec3 color, float response, float optics) {
  if (response > 0.0) {
    return color + (vec3(1.0) - color) * surfaceChromaKey(optics) * response * 1.15;
  }
  return color * (vec3(1.0) - surfaceChromaShadow(optics) * (-response) * 0.85);
}
float gasVolumeChromaResponse(
  float density, float opticalDepth, float directionalRelief, float curvature
) {
  float relief = clamp(directionalRelief * 1.20 + curvature * 2.50, -1.0, 1.0);
  float shell = smoothstep(0.008, 0.12, density)
    * (1.0 - smoothstep(0.18, 0.58, density)) * 0.012;
  return clamp(
    relief * (0.040 + (1.0 - opticalDepth) * 0.055) + shell, -0.060, 0.060
  );
}
vec3 applyGasVolumeChroma(vec3 color, vec3 source, float response) {
  float maximum = max(source.r, max(source.g, source.b));
  float minimum = min(source.r, min(source.g, source.b));
  float chroma = maximum - minimum;
  float luma = dot(source, vec3(0.2126, 0.7152, 0.0722));
  float spectral = clamp(chroma / max(0.18, maximum), 0.0, 1.0);
  float spectralMix = smoothstep(0.04, 0.62, spectral)
    * (0.72 + smoothstep(0.08, 0.92, luma) * 0.22);
  vec3 hue = clamp(
    (source - vec3(minimum)) / max(chroma, 1.0 / 255.0),
    vec3(0.0), vec3(1.0)
  );
  if (response > 0.0) {
    vec3 key = mix(
      vec3(0.58, 0.80, 1.00), vec3(0.45) + hue * 0.55, spectralMix
    );
    return color + key * response * 0.80;
  }
  vec3 fill = mix(
    vec3(1.00, 0.72, 0.45), vec3(0.88) - hue * 0.43, spectralMix
  );
  return color * (vec3(1.0) - fill * (-response));
}
vec3 gasIdentityVolumeDelta(
  float style, vec2 worldPosition, float density, float directionalRelief, float curvature
) {
  if (style < 0.5 || style > 17.5) return vec3(0.0);
  // Canvas authors motifs on the half-resolution atmosphere grid. Sampling the
  // same immutable atlas keeps both presenters spatially coherent while this
  // fragment path remains independent of output supersampling.
  vec2 atmospherePosition = floor(worldPosition * 0.5);
  float motifX = mod(atmospherePosition.x, 16.0);
  float motifY = (style - 1.0) * 16.0 + mod(atmospherePosition.y, 16.0);
  vec2 motifUv = vec2((motifX + 0.5) / 16.0, (motifY + 0.5) / 272.0);
  vec3 motif = texture(uGasIdentityMotifTexture, motifUv).rgb * 255.0 - vec3(128.0);
  float volume = smoothstep(0.004, 0.52, density);
  float motifScale = 0.34 + volume * 0.66;
  float fieldRelief = clamp(directionalRelief * 7.0 + curvature * 9.0, -3.0, 3.0);
  return clamp((motif * motifScale + vec3(fieldRelief)) / 255.0,
    vec3(-12.0 / 255.0), vec3(12.0 / 255.0));
}
float liquidVolumeChromaResponse(
  float depth, vec2 slope, float centreDensity, float neighbourDensity,
  float macroRelief
) {
  float geometric = clamp(
    dot(slope, vec2(0.22, 0.30)) + (centreDensity - neighbourDensity) * 0.38,
    -0.16, 0.18
  );
  return clamp(geometric * 0.28 * depth + macroRelief * 0.55, -0.055, 0.065);
}
vec3 applyLiquidVolumeChroma(
  vec3 color, float response, float optics, float columnDepth
) {
  vec3 key = vec3(0.72, 0.84, 1.00);
  vec3 shadow = vec3(0.72, 0.68, 0.58);
  if (optics == 1.0) {
    key = vec3(0.52, 0.88, 1.00);
    shadow = vec3(1.00, 0.62, 0.36);
  } else if (optics == 2.0) {
    key = vec3(1.00, 0.72, 0.28);
    shadow = vec3(0.40, 0.68, 1.00);
  } else if (optics == 3.0) {
    key = vec3(0.44, 1.00, 0.68);
    shadow = vec3(0.72, 0.38, 0.62);
  } else if (optics == 16.0) {
    key = vec3(0.62, 0.90, 1.00);
    shadow = vec3(1.00, 0.55, 0.28);
  } else if (optics == 17.0) {
    key = vec3(1.00, 0.98, 0.94);
    shadow = vec3(0.58, 0.62, 0.70);
  } else if (optics == 18.0) {
    key = vec3(0.82, 0.92, 1.00);
    shadow = vec3(0.70, 0.64, 0.58);
  }
  if (response > 0.0) {
    color += (vec3(1.0) - color) * key * response * 0.90;
  } else {
    color *= vec3(1.0) - shadow * (-response) * 0.85;
  }
  // WebGL's existing macro chroma is stronger than Canvas at some broad
  // shoulders, so Water/Oil need calibrated column absorption for composed
  // surface-to-core parity rather than numeric helper parity.
  float columnGain = optics == 1.0 ? 0.14
    : (optics == 2.0 ? 0.18 : (optics == 3.0 ? 0.09
    : (optics == 16.0 ? 0.10 : (optics == 17.0 ? 0.22
    : (optics == 18.0 ? 0.20 : 0.06)))));
  if (optics == 4.0) columnGain = 0.0;
  return color * (vec3(1.0) - shadow * columnDepth * columnGain * uLiquidOpticalDepth);
}
vec3 virusFamilyIdentityDelta(float phase, vec2 worldPosition) {
  // One discrete 16-cell membrane/capsid grammar follows the exact semantic
  // owner through liquid, gas, and solid native phase changes. Phase-specific
  // optics remain outside this RGB-only helper.
  vec2 cell = mod(floor(worldPosition), 16.0);
  vec2 local = cell - vec2(7.5);
  float radiusSquared = dot(local, local);
  float membrane = step(24.5, radiusSquared) * (1.0 - step(43.6, radiusSquared));
  float capsid = step(5.0, radiusSquared) * (1.0 - step(14.6, radiusSquared));
  float attachment = max(
    step(6.5, abs(local.x)) * (1.0 - step(1.6, abs(local.y))),
    step(6.5, abs(local.y)) * (1.0 - step(1.6, abs(local.x)))
  );
  vec3 delta = vec3(1.0, -1.0, 2.0);
  if (phase < 0.5) {
    float bridge = (1.0 - step(0.5, mod(cell.x + floor(cell.y * 0.5), 8.0)))
      * step(14.5, radiusSquared) * (1.0 - step(24.5, radiusSquared));
    if (attachment > 0.5) delta = vec3(10.0, -3.0, 11.0);
    else if (membrane > 0.5) delta = vec3(8.0, -5.0, 10.0);
    else if (capsid > 0.5) delta = vec3(-2.0, 3.0, 7.0);
    else if (bridge > 0.5) delta = vec3(4.0, -2.0, 5.0);
  } else if (phase < 1.5) {
    float vesicle = 1.0 - step(0.5, mod(cell.x * 5.0 + cell.y * 3.0, 32.0));
    if (attachment > 0.5) delta = vec3(8.0, -2.0, 9.0);
    else if (membrane > 0.5) delta = vec3(6.0, -4.0, 8.0);
    else if (capsid > 0.5) delta = vec3(-1.0, 3.0, 6.0);
    else if (vesicle > 0.5) delta = vec3(5.0, -2.0, 6.0);
    else delta = vec3(1.0, 0.0, 2.0);
  } else {
    float shellJoint = membrane * (1.0 - step(0.5, mod(cell.x + cell.y, 4.0)));
    if (attachment > 0.5) delta = vec3(12.0, -3.0, 12.0);
    else if (shellJoint > 0.5) delta = vec3(10.0, -5.0, 12.0);
    else if (membrane > 0.5) delta = vec3(8.0, -5.0, 10.0);
    else if (capsid > 0.5) delta = vec3(-3.0, 4.0, 8.0);
  }
  return delta / 255.0;
}
vec3 waxFamilyIdentityDelta(float phase, vec2 worldPosition) {
  // One 32-cell lamella/bloom grammar follows native WAX through melting into
  // MWAX. This helper changes RGB only and uses no sample, clock, or derivative.
  vec2 cell = mod(floor(worldPosition), 32.0);
  vec2 local = mod(cell, 16.0) - vec2(8.0);
  float radiusSquared = dot(local, local);
  float bloom = step(27.0, radiusSquared) * (1.0 - step(50.0, radiusSquared));
  float lamella = mod(cell.x + cell.y * 2.0 + floor(cell.x / 8.0) * 2.0, 16.0);
  float raisedRidge = 1.0 - step(3.0, lamella);
  float recessedFold = step(9.0, lamella) * (1.0 - step(12.0, lamella));
  float waxJoint = bloom * (1.0 - step(1.0, mod(cell.x + cell.y, 4.0)));
  vec3 delta = vec3(1.0, 1.0, 0.0);
  if (phase < 0.5) {
    if (waxJoint > 0.5) delta = vec3(11.0, 9.0, 4.0);
    else if (bloom > 0.5) delta = vec3(7.0, 6.0, 2.0);
    else if (raisedRidge > 0.5) delta = vec3(8.0, 6.0, 2.0);
    else if (recessedFold > 0.5) delta = vec3(-6.0, -5.0, -3.0);
  } else {
    if (waxJoint > 0.5) delta = vec3(7.0, 7.0, 3.0);
    else if (bloom > 0.5) delta = vec3(4.0, 5.0, 2.0);
    else if (raisedRidge > 0.5) delta = vec3(6.0, 6.0, 2.0);
    else if (recessedFold > 0.5) delta = vec3(-3.0, -3.0, -2.0);
  }
  return delta / 255.0;
}
vec3 crystallineSolidIdentityDelta(float material, vec2 worldPosition) {
  // Exact DRIC/NICE/QRTZ/RIME mesostructure. Integer world-space arithmetic
  // mirrors Canvas and changes RGB only; no sample, clock, derivative, or state.
  vec2 cell = mod(floor(worldPosition), 32.0);
  vec3 delta = vec3(0.0);
  if (material == 68.0) {
    float fracture = 1.0 - step(
      2.0, mod(cell.x * 3.0 + cell.y * 5.0 + floor(cell.y / 4.0) * 2.0, 19.0)
    );
    float frostLip = 1.0 - step(2.0, mod(cell.x - floor(cell.y / 2.0) + 26.0, 13.0));
    if (fracture > 0.5 && frostLip > 0.5) delta = vec3(-10.0, -7.0, -4.0);
    else if (fracture > 0.5) delta = vec3(-7.0, -5.0, -3.0);
    else if (frostLip > 0.5) delta = vec3(5.0, 7.0, 10.0);
    else delta = vec3(-1.0, 0.0, 2.0);
  } else if (material == 74.0) {
    float risingFacet = 1.0 - step(2.0, mod(cell.x + cell.y * 2.0, 14.0));
    float fallingFacet = 1.0 - step(2.0, mod(cell.x * 2.0 - cell.y + 34.0, 17.0));
    if (risingFacet > 0.5 && fallingFacet > 0.5) delta = vec3(7.0, 10.0, 14.0);
    else if (risingFacet > 0.5) delta = vec3(-2.0, 3.0, 10.0);
    else if (fallingFacet > 0.5) delta = vec3(3.0, 7.0, 12.0);
    else delta = vec3(0.0, 1.0, 4.0);
  } else if (material == 76.0) {
    float prismEdge = 1.0 - step(2.0, mod(cell.x, 8.0));
    float cleavage = 1.0 - step(2.0, mod(cell.x + cell.y, 16.0));
    if (prismEdge > 0.5 && cleavage > 0.5) delta = vec3(12.0, 9.0, 14.0);
    else if (prismEdge > 0.5) delta = vec3(8.0, 4.0, 12.0);
    else if (cleavage > 0.5) delta = vec3(-5.0, 2.0, 7.0);
    else if (mod(floor(cell.x / 8.0) + floor(cell.y / 8.0), 2.0) < 0.5) {
      delta = vec3(2.0, 0.0, 4.0);
    } else delta = vec3(-1.0, 3.0, 1.0);
  } else {
    float localX = mod(cell.x, 16.0) - 8.0;
    float nodeY = mix(8.0, 24.0, step(16.0, cell.y));
    float localY = cell.y - nodeY;
    float spine = 1.0 - step(2.0, abs(localX));
    float branch = (1.0 - step(2.0, abs(abs(localX) - abs(localY))))
      * (1.0 - step(8.0, abs(localX)));
    float node = spine * (1.0 - step(2.0, abs(localY)));
    float tip = branch * step(6.0, abs(localX));
    if (tip > 0.5) delta = vec3(7.0, 11.0, 14.0);
    else if (node > 0.5) delta = vec3(4.0, 9.0, 12.0);
    else if (branch > 0.5) delta = vec3(5.0, 9.0, 13.0);
    else if (spine > 0.5) delta = vec3(3.0, 7.0, 10.0);
    else delta = vec3(-2.0, 0.0, 2.0);
  }
  // NICE's pale translucent base preserves substantially more of this additive
  // delta than Canvas's pre-optics path; compensate here for composed parity.
  if (material == 74.0) delta *= 0.5;
  return delta / 255.0;
}
vec3 pasteResistFamilyIdentityDelta(float family, float phase, vec2 worldPosition) {
  // Two phase-continuous 32-cell grammars. Native phase changes keep the
  // family topology fixed while liquid and solid optics alter only its signed
  // RGB interpretation. This helper owns no sample, clock, derivative, alpha,
  // support, or output-scale resource.
  vec2 cell = mod(floor(worldPosition), 32.0);
  vec2 local = mod(cell, 16.0) - vec2(8.0);
  float radiusSquared = dot(local, local);
  vec3 delta;
  if (family < 0.5) {
    float layer = mod(cell.y + floor(cell.x / 8.0) * 2.0, 8.0);
    bool seam = layer < 2.0;
    bool pocket = radiusSquared >= 18.0 && radiusSquared <= 36.0;
    if (phase < 0.5) {
      if (seam) delta = vec3(-7.0, -6.0, -4.0);
      else if (pocket) delta = vec3(6.0, 4.0, 2.0);
      else delta = vec3(1.0, 0.0, 2.0);
    } else {
      if (seam) delta = vec3(6.0, 5.0, 3.0);
      else if (pocket) delta = vec3(-3.0, -2.0, 1.0);
      else delta = vec3(1.0, 0.0, 2.0);
    }
  } else {
    bool rising = mod(cell.x * 2.0 + cell.y, 16.0) < 2.0;
    bool falling = mod(cell.x - cell.y * 2.0 + 32.0, 16.0) < 2.0;
    bool node = radiusSquared <= 9.0;
    bool junction = rising && falling;
    if (phase < 0.5) {
      if (node) delta = vec3(13.0, 4.0, -4.0);
      else if (junction) delta = vec3(14.0, 3.0, -3.0);
      else if (rising) delta = vec3(10.0, 2.0, -4.0);
      else if (falling) delta = vec3(7.0, -4.0, 2.0);
      else delta = vec3(1.0, -1.0, -2.0);
    } else {
      if (node) delta = vec3(10.0, 3.0, -3.0);
      else if (junction) delta = vec3(12.0, 2.0, -2.0);
      else if (rising) delta = vec3(7.0, 2.0, -2.0);
      else if (falling) delta = vec3(5.0, -2.0, 2.0);
      else delta = vec3(2.0, -1.0, -1.0);
    }
  }
  return delta / 255.0;
}
vec3 liquidMaterialIdentityDelta(
  float material, vec2 worldPosition, float density, float depth, vec2 slope
) {
  float support = smoothstep(0.08, 0.72, density) * (0.45 + depth * 0.55);
  vec3 identity = vec3(0.0);
  if (material == 38.0) {
    // SOAP: crossed thin-film bands split the spectral key by channel.
    float diagonalSaw = fract(
      (worldPosition.x + worldPosition.y) * 0.09375
    ) * 2.0 - 1.0;
    float antiSaw = fract(
      (worldPosition.x - worldPosition.y) * 0.078125
    ) * 2.0 - 1.0;
    float diagonalFold = 1.0 - abs(diagonalSaw);
    float antiFold = 1.0 - abs(antiSaw);
    float thinFilm = (diagonalFold - antiFold) * 0.5;
    identity = vec3(thinFilm * 0.045, thinFilm * -0.020, thinFilm * -0.050);
  } else if (material == 54.0) {
    // BIZR: hard diagonal prism facets retain bizarre matter's spectral shift.
    float prism = fract(worldPosition.x * 0.125
      + floor(worldPosition.y * 0.125) * 0.25) * 2.0 - 1.0;
    identity = vec3(prism * 0.050, (0.5 - abs(prism)) * 0.024, prism * -0.040);
  } else if (material == 55.0) {
    // CBNW: stable cellular bubble rims, independent of simulation motion.
    vec2 tile8 = fract(worldPosition / 8.0);
    float bubbleRadius = max(abs(tile8.x - 0.5), abs(tile8.y - 0.5));
    float bubbles = 1.0 - smoothstep(0.04, 0.13, abs(bubbleRadius - 0.31));
    identity = (bubbles - 0.24) * vec3(0.035, 0.045, 0.055);
  } else if (material == 56.0) {
    // GEL: broad nested folds read as a viscous, elastic body.
    float diagonalSaw = fract(
      (worldPosition.x + worldPosition.y) * 0.09375
    ) * 2.0 - 1.0;
    float diagonalFold = 1.0 - abs(diagonalSaw);
    float fold = 1.0 - abs(
      fract(worldPosition.y * 0.085 + diagonalFold * 0.18) * 2.0 - 1.0
    );
    float foldCrease = smoothstep(0.62, 0.92, fold) - 0.28;
    identity = foldCrease * vec3(0.040, 0.025, -0.018);
  } else if (material == 57.0) {
    // GLOW: low-frequency diamond rings reinforce its pressure-lit identity.
    vec2 tile12 = fract(worldPosition / 12.0);
    float ringRadius = abs(tile12.x - 0.5) + abs(tile12.y - 0.5);
    float rings = 1.0 - abs(fract(ringRadius * 3.0) * 2.0 - 1.0);
    float ringBand = smoothstep(0.68, 0.94, rings) - 0.26;
    identity = ringBand * vec3(0.018, 0.048, 0.035);
  } else if (material == 59.0) {
    // MWAX: softened phase of the same WAX lamella and bloom structure.
    identity = waxFamilyIdentityDelta(1.0, worldPosition);
  } else if (material == 60.0) {
    // PSTE: hydrated strata retain PSTS's pressure-compressed topology.
    identity = pasteResistFamilyIdentityDelta(0.0, 1.0, worldPosition);
  } else if (material == 61.0) {
    // RSST: flowing resist retains RSSS's woven insulating laminate.
    identity = pasteResistFamilyIdentityDelta(1.0, 1.0, worldPosition);
  } else if (material == 62.0) {
    // VIRS: the canonical family capsid takes liquid density/depth support.
    identity = virusFamilyIdentityDelta(0.0, worldPosition);
  } else if (material == 202.0) {
    // FRZW: crossed frost branches keep the phase-change product crystalline.
    float diagonalSaw = fract(
      (worldPosition.x + worldPosition.y) * 0.09375
    ) * 2.0 - 1.0;
    float antiSaw = fract(
      (worldPosition.x - worldPosition.y) * 0.078125
    ) * 2.0 - 1.0;
    float frostDistance = min(abs(diagonalSaw), abs(antiSaw));
    float frost = 1.0 - smoothstep(0.04, 0.16, frostDistance);
    identity = (frost - 0.18) * vec3(0.025, 0.042, 0.055);
  } else if (material == 207.0) {
    // RFGL: refrigerant bubble cells share a restrained flowing ribbon.
    vec2 tile12 = fract(worldPosition / 12.0);
    float antiSaw = fract(
      (worldPosition.x - worldPosition.y) * 0.078125
    ) * 2.0 - 1.0;
    float antiFold = 1.0 - abs(antiSaw);
    float slopeKey = clamp((slope.x + slope.y) * 1.75, -1.0, 1.0);
    float bubbleRadius = max(abs(tile12.x - 0.5), abs(tile12.y - 0.5));
    float bubble = 1.0 - smoothstep(0.04, 0.12, abs(bubbleRadius - 0.30));
    float ribbon = antiFold - 0.5 + slopeKey * 0.12;
    identity = (bubble - 0.22) * vec3(0.028, 0.035, 0.042)
      + ribbon * vec3(-0.018, 0.010, 0.022);
  } else if (material == 100.0) {
    // DEUT: deep concentration bands separated by lifted cool seams.
    float band = fract((worldPosition.y + floor(worldPosition.x / 8.0) * 2.0) / 16.0);
    float seam = 1.0 - smoothstep(0.10, 0.22, min(band, 1.0 - band));
    float deepBand = smoothstep(0.54, 0.78, band) * (1.0 - smoothstep(0.78, 0.92, band));
    identity = seam * vec3(-0.014, 0.028, 0.052)
      + deepBand * vec3(-0.020, -0.010, 0.026);
  } else if (material == 102.0) {
    // EXOT: sheared interference diamonds and displaced violet vertices.
    vec2 tile16 = fract(worldPosition / 16.0);
    float diamond = abs(tile16.x - 0.5) + abs(tile16.y - 0.5);
    float rim = 1.0 - smoothstep(0.035, 0.105, abs(diamond - 0.43));
    float shear = 1.0 - smoothstep(0.04, 0.14, abs(
      fract(worldPosition.x * 0.1875 - worldPosition.y * 0.125) - 0.5
    ));
    identity = rim * vec3(0.020, -0.018, 0.052)
      + shear * vec3(0.030, 0.004, 0.018);
  } else if (material == 104.0) {
    // ISOZ: stable decay rings foreshadow its faceted ISZS phase partner.
    vec2 tile16 = fract(worldPosition / 16.0) - 0.5;
    float radiusSquared = dot(tile16, tile16);
    float outerRing = 1.0 - smoothstep(0.018, 0.052, abs(radiusSquared - 0.116));
    float coreRing = 1.0 - smoothstep(0.001, 0.010, radiusSquared);
    identity = outerRing * vec3(0.036, -0.016, 0.046)
      + coreRing * vec3(-0.014, 0.026, 0.032);
  }
  return clamp(identity * support, vec3(-0.055), vec3(0.055));
}
vec3 botanicalIdentityDelta(float material, vec2 position) {
  float x = floor(position.x);
  float y = floor(position.y);
  vec3 delta = vec3(0.0);
  if (material == 9.0) {
    float ring = mod(x + floor(y / 3.0) + material, 11.0) < 2.0 ? -7.0 : 2.0;
    float axial = mod(x + floor(y / 7.0) + material, 9.0) < 2.0 ? 1.0 : 0.0;
    delta = vec3(ring + axial * 3.0, ring * 0.48 + axial * 1.5,
      ring * 0.22 - axial * 1.5);
  } else if (material == 10.0) {
    float leaf = mod(x * 5.0 + y * 3.0 + material, 8.0) / 7.0;
    float vein = mod(x * 2.0 + y + mod(y * 5.0 + 3.0, 8.0), 13.0) < 3.0 ? 1.0 : 0.0;
    delta = vec3(leaf * 1.5 - vein * 3.0, leaf * 3.5 + vein * 6.0,
      leaf - vein * 2.5);
  } else if (material == 83.0) {
    float strand = mod(x + floor(y / 4.0) + material, 7.0) < 2.0 ? 1.0 : 0.0;
    float node = mod(x * 3.0 + y * 5.0 + material, 16.0) < 2.0 ? 1.0 : 0.0;
    delta = vec3(mix(1.0, -3.0, strand), mix(-1.0, 7.0, strand), mix(0.0, -2.0, strand))
      + node * vec3(2.0, 4.0, 1.0);
  } else if (material == 50.0) {
    vec2 local = mod(vec2(x, y), 8.0) - 4.0;
    float radiusSquared = dot(local, local);
    float husk = radiusSquared >= 5.0 && radiusSquared <= 13.0 ? 1.0 : 0.0;
    float embryo = local.x >= 0.0 && local.x <= 2.0
      && local.y >= -1.0 && local.y <= 1.0 ? 1.0 : 0.0;
    delta = mix(vec3(-2.0, -1.0, 1.0), vec3(5.0, 2.0, -3.0), husk)
      + embryo * vec3(2.0, 5.0, 1.0);
  } else if (material == 52.0) {
    vec2 local = mod(vec2(x, y), 8.0) - 4.0;
    float radiusSquared = dot(local, local);
    float cellRim = radiusSquared >= 5.0 && radiusSquared <= 13.0 ? 1.0 : 0.0;
    vec2 budOffset = local - vec2(1.0, -1.0);
    float bud = dot(budOffset, budOffset) <= 2.0 ? 1.0 : 0.0;
    delta = mix(vec3(-1.0, -0.5, -1.5), vec3(3.0, 2.0, 1.0), cellRim)
      + bud * vec3(3.0, 4.0, 2.0);
  }
  return clamp(delta, vec3(-12.0), vec3(12.0)) / 255.0;
}
vec3 vividColor(vec3 color, float saturation) {
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(luminance), color, saturation);
}
float thermalOpticsGain(float optics) {
  if (optics == 13.0) return 0.82;
  if (optics == 14.0) return 0.62;
  if (optics == 15.0) return 0.90;
  if (optics == 7.0) return 0.72;
  if (optics == 8.0 || optics == 19.0) return 1.0;
  if (optics == 9.0) return 0.88;
  if (optics == 10.0) return 1.08;
  if (optics == 11.0) return 0.92;
  if (optics == 12.0) return 0.86;
  return 0.90;
}
vec3 thermalMaterialTint(float temperatureByte, float optics) {
  // Room temperature (2952 dK) quantizes to byte 11. The asymmetric knees
  // mirror thermal-material-style.ts and retain a one-byte ambient dead band.
  float cold = smoothstep(1.0, 7.0, 11.0 - temperatureByte);
  float warm = smoothstep(2.0, 55.0, temperatureByte - 11.0);
  float incandescent = smoothstep(0.55, 1.0, warm);
  float gain = thermalOpticsGain(optics) / 255.0;
  return vec3(
    -3.0 * cold + 17.0 * warm + 9.0 * incandescent,
    2.0 * cold + 4.0 * warm + 6.0 * incandescent,
    14.0 * cold - 7.0 * warm + incandescent
  ) * gain;
}
vec3 toneMapEnergy(vec3 radiance) {
  const float knee = 0.72;
  vec3 excess = max(radiance - vec3(knee), vec3(0.0));
  vec3 mapped = min(vec3(1.0), vec3(knee) + excess * 0.30);
  return min(radiance, mapped);
}
vec3 energyIdentityDelta(float material, vec2 position, float time, vec2 velocity) {
  // Exact native energy identities share the Canvas integer motifs. The
  // function changes RGB only and adds no texture, pass, or render-scale state.
  float x = floor(position.x);
  float y = floor(position.y);
  float frame = floor(time * 8.333333);
  float driftX = sign(velocity.x);
  float driftY = sign(velocity.y);
  vec3 delta = vec3(0.0);
  if (material == 4.0) {
    float tongue = mod(x * 3.0 + y + frame + driftX, 16.0);
    float crest = mod(y - frame + driftY, 8.0);
    delta = tongue < 5.0
      ? vec3(9.0, 5.0 + (crest < 2.0 ? 3.0 : 0.0), -4.0)
      : vec3(-2.0, -2.0, 1.0);
  } else if (material == 20.0) {
    float localX = mod(x + frame + driftX, 8.0);
    float localY = mod(y - frame + driftY, 8.0);
    float membrane = abs(localX - 4.0) + abs(localY - 4.0);
    delta = vec3(
      membrane >= 4.0 && membrane <= 6.0 ? 8.0 : -2.0,
      membrane >= 4.0 && membrane <= 6.0 ? 3.0 : 0.0,
      membrane <= 2.0 ? 8.0 : 2.0
    );
  } else if (material == 101.0) {
    float branch = mod(x * 3.0 + y * 5.0 + frame * 2.0, 16.0);
    float node = mod(x + y + frame, 8.0);
    delta = branch <= 2.0
      ? vec3(8.0, 11.0, 13.0)
      : vec3(-2.0, 1.0, 4.0 + (node < 0.5 ? 5.0 : 0.0));
  } else if (material == 103.0) {
    float localX = mod(x, 16.0) - 8.0;
    float localY = mod(y, 16.0) - 8.0;
    float ring = mod(localX * localX + localY * localY + frame, 32.0);
    delta = ring >= 10.0 && ring <= 16.0 ? vec3(-5.0, 3.0, 11.0) : vec3(3.0, -2.0, 5.0);
  } else if (material == 106.0) {
    float track = mod(x * 5.0 - y * 3.0 + frame, 16.0);
    float gap = mod(x + y * 2.0, 8.0);
    delta = track <= 1.0 && gap > 1.0 ? vec3(4.0, 9.0, 8.0) : vec3(-3.0, 1.0, 2.0);
  } else if (material == 107.0) {
    float band = mod(x + y + frame * 2.0, 16.0);
    delta = band <= 2.0 ? vec3(11.0, 10.0, 4.0)
      : (band >= 8.0 && band <= 10.0 ? vec3(-4.0, 1.0, 10.0) : vec3(1.0, 3.0, 2.0));
  } else if (material == 110.0) {
    float rail = mod(x * 2.0 - y + frame, 8.0);
    float bead = mod(x + y * 3.0 + frame * 2.0, 16.0);
    delta = rail <= 1.0
      ? vec3(12.0, 5.0 + (bead <= 2.0 ? 5.0 : 0.0), 2.0)
      : vec3(-2.0, 1.0, 5.0);
  } else if (material == 197.0) {
    float rail = abs(mod(x - y, 16.0) - 8.0);
    float node = mod(x + y - frame * 2.0, 16.0);
    delta = rail <= 1.0
      ? vec3(10.0, 8.0 + (node <= 2.0 ? 5.0 : 0.0), 5.0 + (node <= 2.0 ? 7.0 : 0.0))
      : vec3(-2.0, 0.0, 3.0);
  } else if (material == 200.0) {
    float spark = mod(
      x * 17.0 + y * 31.0 + floor(x * y * 0.125)
        + floor(frame * 0.5) * 7.0 + material,
      32.0
    );
    delta = spark < 4.0 ? vec3(13.0, 8.0, -2.0) : vec3(-3.0, -1.0, 2.0);
  }
  return clamp(delta, vec3(-14.0), vec3(14.0)) / 255.0;
}
vec3 radioactiveBodyIdentityDelta(float material, vec2 position) {
  float x = floor(position.x);
  float y = floor(position.y);
  vec3 delta = vec3(0.0);
  if (material == 99.0) {
    float crackA = step(mod(x * 3.0 + y * 5.0, 16.0), 1.0);
    float crackB = 1.0 - step(0.5, abs(mod(x - y * 2.0, 16.0)));
    delta = max(crackA, crackB) > 0.5 ? vec3(-3.0, 10.0, 7.0) : vec3(1.0, 2.0, 0.0);
  } else if (material == 108.0) {
    float inclusion = mod(x * 17.0 + y * 31.0 + floor(x * y * 0.125) + material, 32.0);
    delta = inclusion < 4.0 ? vec3(10.0, 8.0, -2.0) : vec3(-3.0, 1.0, -1.0);
  } else if (material == 109.0) {
    vec2 local = mod(vec2(x, y), 8.0) - 4.0;
    float radiusSquared = dot(local, local);
    delta = radiusSquared >= 6.0 && radiusSquared <= 11.0
      ? vec3(8.0, 10.0, 3.0) : vec3(-2.0, 1.0, -1.0);
  } else if (material == 111.0) {
    vec2 local = mod(vec2(x, y), 16.0) - 8.0;
    float radiusSquared = dot(local, local);
    delta = radiusSquared >= 35.0 && radiusSquared <= 58.0
      ? vec3(2.0, 5.0, 11.0) : vec3(-8.0, -7.0, -5.0);
  } else if (material == 112.0) {
    float band = mod(x * 2.0 + y + floor(y / 8.0), 16.0);
    delta = band <= 3.0 ? vec3(6.0, 9.0, -2.0) : vec3(-3.0, 1.0, 0.0);
  } else if (material == 105.0) {
    vec2 local = mod(vec2(x, y), 8.0) - 4.0;
    float facet = abs(local.x) + abs(local.y);
    delta = facet >= 3.0 && facet <= 4.0
      ? vec3(9.0, -2.0, 11.0) : vec3(-2.0, 3.0, 4.0);
  } else if (material == 113.0) {
    float horizontal = 1.0 - step(0.5, abs(mod(y, 8.0)));
    float vertical = 1.0 - step(0.5, abs(mod(x + floor(y / 8.0) * 3.0, 8.0)));
    delta = max(horizontal, vertical) > 0.5
      ? vec3(-2.0, 11.0, horizontal * vertical > 0.5 ? 12.0 : 6.0)
      : vec3(1.0, 2.0, 0.0);
  }
  return clamp(delta, vec3(-12.0), vec3(12.0)) / 255.0;
}
vec3 vibrStateDelta(float material, vec2 stateBytes, vec2 position) {
  if (material != 99.0 && material != 113.0) return vec3(0.0);
  float packedState = floor(stateBytes.x * 255.0 + 0.5)
    + floor(stateBytes.y * 255.0 + 0.5) * 256.0;
  if (packedState < 0.5) return vec3(0.0);
  float charge = min(mod(packedState, 128.0), 100.0) / 100.0;
  float countdown = mod(floor(packedState / 128.0), 256.0) / 255.0;
  float alternate = step(0.5, floor(packedState / 32768.0));
  float x = floor(position.x);
  float y = floor(position.y);
  float horizontal = 1.0 - step(0.5, abs(mod(y, 8.0)));
  float vertical = 1.0 - step(0.5, abs(mod(x + floor(y / 8.0) * 3.0, 8.0)));
  float junction = horizontal * vertical;
  float conductor = mix(0.24, mix(0.72, 1.0, junction), max(horizontal, vertical));
  vec3 charged = mix(vec3(-3.0, 12.0, 13.0), vec3(2.0, 7.0, 17.0), alternate)
    * charge * conductor;
  vec2 local = mod(vec2(x, y), 16.0) - 8.0;
  float radiusSquared = dot(local, local);
  float burstRing = step(24.0, radiusSquared) * step(radiusSquared, 52.0);
  float burst = countdown * mix(0.34, 1.0, max(burstRing, junction * 0.73));
  vec3 exploding = mix(vec3(18.0, 20.0, 13.0), vec3(8.0, 15.0, 22.0), alternate)
    * burst;
  return (charged + exploding) / 255.0;
}
vec3 deutStateDelta(float material, vec2 stateBytes, vec2 position) {
  if (material != 100.0) return vec3(0.0);
  float concentration = floor(stateBytes.x * 255.0 + 0.5)
    + floor(stateBytes.y * 255.0 + 0.5) * 256.0;
  if (concentration < 0.5) return vec3(0.0);
  float ordinary = min(1.0, concentration / 240.0);
  float compressed = max(0.0, (concentration - 240.0) / 5760.0);
  float strength = sqrt(ordinary) * 0.25 + sqrt(min(1.0, compressed)) * 0.75;
  float x = floor(position.x);
  float y = floor(position.y);
  vec2 local = mod(vec2(x, y), 16.0);
  float diamond = abs(local.x - 8.0) + abs(local.y - 8.0);
  float compressionShell = step(5.0, diamond) * (1.0 - step(7.5, diamond));
  float compressionCore = 1.0 - step(2.5, diamond);
  float liftedBand = 1.0 - step(1.5, mod(y + floor(x / 4.0), 8.0));
  float shape = compressionShell > 0.5 ? 1.0
    : compressionCore > 0.5 ? 0.72 : liftedBand > 0.5 ? 0.48 : 0.20;
  float glowBloom = step(240.0, concentration) * shape;
  return (strength * shape * vec3(10.0, 19.0, 28.0)
    + glowBloom * vec3(4.0, 6.0, 7.0)) / 255.0;
}
vec3 sourceTargetDelta(float material, vec2 stateBytes, vec2 position) {
  bool sourceOwner = material == 124.0 || material == 126.0 || material == 127.0
    || material == 137.0 || material == 158.0 || material == 159.0;
  if (!sourceOwner) return vec3(0.0);
  float target = floor(stateBytes.x * 255.0 + 0.5)
    + floor(stateBytes.y * 255.0 + 0.5) * 256.0;
  bool exactTarget = (target >= 1.0 && target <= 170.0) || target == 217.0;
  if (!exactTarget || target == material) return vec3(0.0);

  vec2 local = mod(
    floor(position) + vec2(material * 3.0, material * 5.0), 24.0
  );
  vec2 centred = local - vec2(11.5);
  float lens = 1.0 - step(4.75, abs(centred.x) + abs(centred.y));
  float shellDistance = max(abs(centred.x), abs(centred.y));
  float shell = step(6.0, shellDistance) * (1.0 - step(8.01, shellDistance));
  vec2 badgeCell = floor(local / 4.0);
  float phase7 = mod(target, 7.0);
  float phase5 = mod(floor(target / 7.0), 5.0);
  float primary = 1.0 - step(0.5, mod(badgeCell.x * 3.0 + badgeCell.y * 5.0 + phase7, 7.0));
  float secondary = 1.0 - step(0.5, mod(badgeCell.x + badgeCell.y * 2.0 + phase5, 5.0));
  float shape = lens > 0.5 ? 1.0 : (shell * primary > 0.5 ? 0.78
    : (secondary > 0.5 ? 0.36 : 0.10));
  float keyIndex = mod(target, 6.0);
  vec3 key = keyIndex < 0.5 ? vec3(20.0, 7.0, 2.0)
    : (keyIndex < 1.5 ? vec3(17.0, 16.0, 2.0)
    : (keyIndex < 2.5 ? vec3(4.0, 19.0, 7.0)
    : (keyIndex < 3.5 ? vec3(2.0, 15.0, 20.0)
    : (keyIndex < 4.5 ? vec3(8.0, 9.0, 22.0)
    : vec3(20.0, 6.0, 17.0)))));
  float tone = mod(floor(target / 6.0), 5.0) - 2.0;
  key += vec3(tone * 0.55, tone * 0.45, tone * 0.60);
  return key * shape / 255.0;
}
vec4 contactSample(vec2 uv, float material, float family) {
  float candidate = materialAt(uv);
  if (abs(candidate - material) < 0.5) return vec4(1.0, 0.0, 0.0, 0.0);
  if (candidate < 0.5) return vec4(0.0);
  vec4 candidateStyle = texture(
    uStyleTexture, vec2((candidate + 0.5) / 256.0, 0.5)
  );
  float candidateFamily = floor(candidateStyle.r * 255.0 + 0.5);
  float candidateTraits = floor(candidateStyle.a * 255.0 + 0.5);
  float ordinaryCandidate = candidateStyle.b < 0.5 && candidateTraits < 0.5
    && candidate != 3.0 ? 1.0 : 0.0;
  float foreignMatter = candidateFamily != family ? 1.0 : 0.0;
  // The third component marks only cross-phase contacts that can be lit without
  // another semantic/style probe. A solid deliberately does not mark powder:
  // its neighbour stability is unavailable here, so only the authoritative
  // stable-powder side may opt into that contact below.
  float crossPhase = ordinaryCandidate * (
    (family == 0.0 && candidateFamily == 2.0)
    || (family == 2.0 && candidateFamily == 0.0)
    || (family == 4.0 && (candidateFamily == 0.0 || candidateFamily == 2.0))
    ? 1.0 : 0.0
  );
  // Contact coverage is phase-categorical, while palette/material selection
  // stays exact. Unlike solids and unlike powders therefore partition one
  // continuous occupied surface without alpha overlap or a black contact seam.
  // Powder may rest against a solid, but a solid deliberately does not borrow
  // moving powder support, so gas/liquid/powder contact cannot wobble its edge.
  if (family == 0.0 && candidateFamily == 0.0) return vec4(1.0, 1.0, 0.0, 0.0);
  if (family == 4.0 && (candidateFamily == 4.0 || candidateFamily == 0.0)) {
    return vec4(1.0, 0.0, crossPhase, foreignMatter);
  }
  if ((family == 1.0 || family == 2.0) && candidateFamily == family) {
    // The second component is otherwise solid-contact-only. Liquid consumes it
    // as an exact unlike-species marker, avoiding an RGB-distance heuristic.
    return vec4(1.0, 1.0, 0.0, 0.0);
  }
  return vec4(0.0, 0.0, crossPhase, foreignMatter);
}
vec4 occupancyShape(
  vec2 uv, float material, float family, float contourSmoothing,
  out float contourCurvature, out float phaseContactLight,
  out float foreignMatterContact, out float unlikeMaterialContact
) {
  contourCurvature = 0.0;
  phaseContactLight = 0.0;
  foreignMatterContact = 0.0;
  unlikeMaterialContact = 0.0;
  vec2 grid = uv * uFieldSize - 0.5;
  vec2 blend = fract(grid);
  vec2 hermite = blend * blend * (3.0 - 2.0 * blend);
  vec2 hermiteDerivative = 6.0 * blend * (1.0 - blend);
  vec2 weight = mix(blend, hermite, contourSmoothing);
  vec2 weightDerivative = mix(vec2(1.0), hermiteDerivative, contourSmoothing);
  vec2 origin = (floor(grid) + 0.5) * uTexel;
  vec4 s00 = contactSample(origin, material, family);
  vec4 s10 = contactSample(origin + vec2(uTexel.x, 0.0), material, family);
  vec4 s01 = contactSample(origin + vec2(0.0, uTexel.y), material, family);
  vec4 s11 = contactSample(origin + uTexel, material, family);
  float q00 = s00.x;
  float q10 = s10.x;
  float q01 = s01.x;
  float q11 = s11.x;
  // Monotone Hermite weights retain the linear weight's exact 0.5 integral and
  // make its first derivative meet continuously at cell centres. That reference
  // property does not by itself prove final raster area, which is guarded by
  // the composed fixture audit below this shader contract.
  float top = mix(q00, q10, weight.x);
  float bottom = mix(q01, q11, weight.x);
  float density = mix(top, bottom, weight.y);
  float gradientX = mix(q10 - q00, q11 - q01, weight.y) * weightDerivative.x;
  float gradientY = mix(q01 - q00, q11 - q10, weight.x) * weightDerivative.y;
  float phaseContactX = mix(s10.z - s00.z, s11.z - s01.z, weight.y)
    * weightDerivative.x;
  float phaseContactY = mix(s01.z - s00.z, s11.z - s10.z, weight.x)
    * weightDerivative.y;
  // The Hermite derivative is itself the contact-local band: it is exactly
  // zero in dense cores, air silhouettes, and same-phase seams.
  phaseContactLight = dot(vec2(phaseContactX, phaseContactY), vec2(-0.55, -0.80));
  foreignMatterContact = max(max(s00.w, s10.w), max(s01.w, s11.w));
  unlikeMaterialContact = max(max(s00.y, s10.y), max(s01.y, s11.y));
  float supportOrContact = q00 + q10 + q01 + q11;
  if (family == 0.0) {
    float contactX = mix(s10.y - s00.y, s11.y - s01.y, weight.y) * weightDerivative.x;
    float contactY = mix(s01.y - s00.y, s11.y - s10.y, weight.x) * weightDerivative.y;
    supportOrContact = dot(vec2(contactX, contactY), vec2(-0.55, -0.80));
    float gradientSquared = gradientX * gradientX + gradientY * gradientY;
    if (density > 0.08 && density < 0.92 && gradientSquared >= 0.0001) {
      float cross = q11 - q10 - q01 + q00;
      vec2 secondWeight = vec2(6.0) - blend * 12.0;
      float horizontal = q10 - q00 + cross * weight.y;
      float vertical = q01 - q00 + cross * weight.x;
      float secondX = horizontal * secondWeight.x;
      float secondY = vertical * secondWeight.y;
      float mixed = cross * weightDerivative.x * weightDerivative.y;
      float numerator = secondX * gradientY * gradientY
        - 2.0 * gradientX * gradientY * mixed
        + secondY * gradientX * gradientX;
      contourCurvature = clamp(
        numerator / max(0.0001, gradientSquared * sqrt(gradientSquared)), -1.0, 1.0
      );
    }
  }
  return vec4(density, gradientX, gradientY, supportOrContact);
}
vec4 powderSurfaceShape(vec2 uv) {
  vec4 state = texture(uPowderSurfaceTexture, uv);
  return vec4(
    state.r,
    (state.g * 255.0 - 128.0) / 508.0,
    (state.b * 255.0 - 128.0) / 508.0,
    state.a * 9.0
  );
}
float powderSurfaceBulkDepth(vec2 uv, float material, float surfaceOnly) {
  vec2 cell = (floor(uv * uFieldSize) + 0.5) * uTexel;
  if (cell.x < uTexel.x * 1.5 - 0.000001
    || cell.x > 1.0 - uTexel.x * 1.5 + 0.000001) return 0.0;
  float requiredDepth = surfaceOnly > 0.5 ? 3.0 : 2.0;
  float lastCellY = 1.0 - uTexel.y * 0.5;
  if (cell.y + uTexel.y * requiredDepth > lastCellY + 0.000001) return 0.0;
  float bulk = sameMaterial(cell + vec2(0.0, uTexel.y), material)
    * sameMaterial(cell + vec2(0.0, uTexel.y * 2.0), material);
  if (surfaceOnly > 0.5) {
    bulk *= sameMaterial(cell + vec2(0.0, uTexel.y * 3.0), material);
  }
  vec2 anchor = cell + vec2(0.0, surfaceOnly > 0.5 ? uTexel.y : 0.0);
  bulk *= max(
    sameMaterial(anchor - vec2(uTexel.x, 0.0), material),
    sameMaterial(anchor + vec2(uTexel.x, 0.0), material)
  );
  return bulk;
}
vec3 discreteShape(vec2 uv, float material) {
  vec2 left = vec2(uTexel.x, 0.0);
  vec2 down = vec2(0.0, uTexel.y);
  float l = sameMaterial(uv - left, material);
  float r = sameMaterial(uv + left, material);
  float t = sameMaterial(uv - down, material);
  float b = sameMaterial(uv + down, material);
  float center = sameMaterial(uv, material);
  if (uHighQuality < 0.5) {
    float density = center * 0.48 + (l + r + t + b) * 0.13;
    return vec3(density, r - l, b - t);
  }
  float tl = sameMaterial(uv - left - down, material);
  float tr = sameMaterial(uv + left - down, material);
  float bl = sameMaterial(uv - left + down, material);
  float br = sameMaterial(uv + left + down, material);
  float density = center * mix(0.48, 0.32, uHighQuality)
    + (l + r + t + b) * mix(0.13, 0.12, uHighQuality)
    + (tl + tr + bl + br) * 0.05 * uHighQuality;
  float gradientX = (r - l) + (tr + br - tl - bl) * 0.45 * uHighQuality;
  float gradientY = (b - t) + (bl + br - tl - tr) * 0.45 * uHighQuality;
  return vec3(density, gradientX, gradientY);
}
vec3 enclosedSurfaceShape(vec2 uv, float material) {
  vec2 left = vec2(uTexel.x, 0.0);
  vec2 down = vec2(0.0, uTexel.y);
  float lm = materialAt(uv - left);
  float rm = materialAt(uv + left);
  float tm = materialAt(uv - down);
  float bm = materialAt(uv + down);
  float tlm = materialAt(uv - left - down);
  float trm = materialAt(uv + left - down);
  float blm = materialAt(uv - left + down);
  float brm = materialAt(uv + left + down);
  float l = 1.0 - step(0.5, abs(lm - material));
  float r = 1.0 - step(0.5, abs(rm - material));
  float t = 1.0 - step(0.5, abs(tm - material));
  float b = 1.0 - step(0.5, abs(bm - material));
  float tl = 1.0 - step(0.5, abs(tlm - material));
  float tr = 1.0 - step(0.5, abs(trm - material));
  float bl = 1.0 - step(0.5, abs(blm - material));
  float br = 1.0 - step(0.5, abs(brm - material));
  float foreign = step(0.5, lm) * (1.0 - l) + step(0.5, rm) * (1.0 - r)
    + step(0.5, tm) * (1.0 - t) + step(0.5, bm) * (1.0 - b)
    + step(0.5, tlm) * (1.0 - tl) + step(0.5, trm) * (1.0 - tr)
    + step(0.5, blm) * (1.0 - bl) + step(0.5, brm) * (1.0 - br);
  float cardinal = l + r + t + b;
  float matches = cardinal + tl + tr + bl + br;
  float cardinallyEnclosed = step(3.5, cardinal);
  float denseSupport = step(4.5, matches) * step(2.5, cardinal);
  vec2 cell = floor(clamp(uv * uFieldSize, vec2(0.0), uFieldSize - vec2(1.0)));
  float interior = step(1.0, cell.x) * step(1.0, cell.y)
    * step(cell.x, uFieldSize.x - 2.0) * step(cell.y, uFieldSize.y - 2.0);
  float verticalCrackBounds = step(2.0, cell.y) * step(cell.y, uFieldSize.y - 3.0);
  float horizontalCrackBounds = step(2.0, cell.x) * step(cell.x, uFieldSize.x - 3.0);
  float crackSideWalls = tl * tr * bl * br;
  float thinCrack = 0.0;
  if (l * r * (1.0 - t) * (1.0 - b) * crackSideWalls * verticalCrackBounds > 0.5) {
    thinCrack = sameMaterial(uv - down * 2.0, material) * sameMaterial(uv + down * 2.0, material);
  } else if (t * b * (1.0 - l) * (1.0 - r) * crackSideWalls * horizontalCrackBounds > 0.5) {
    thinCrack = sameMaterial(uv - left * 2.0, material) * sameMaterial(uv + left * 2.0, material);
  }
  float localValid = max(max(cardinallyEnclosed, denseSupport), thinCrack);
  float boundedBlock = 0.0;
  // A true 2x2 cavity presents five exact immediate supports, two adjacent
  // cardinal supports, and an empty diagonal opposite their shared corner.
  // In high quality only, prove the seven remaining cells of that block's
  // outer perimeter in stages. Any notch, seam, separator, or border breaks
  // the exact-material ring before it can contribute presentation support.
  if (uHighQuality > 0.5 && localValid < 0.5 && foreign < 0.5
    && matches == 5.0 && cardinal == 2.0) {
    vec2 inward = vec2(0.0);
    if (l * t * (1.0 - r) * (1.0 - b) > 0.5 && brm < 0.5) {
      inward = vec2(1.0, 1.0);
    } else if (r * t * (1.0 - l) * (1.0 - b) > 0.5 && blm < 0.5) {
      inward = vec2(-1.0, 1.0);
    } else if (l * b * (1.0 - r) * (1.0 - t) > 0.5 && trm < 0.5) {
      inward = vec2(1.0, -1.0);
    } else if (r * b * (1.0 - l) * (1.0 - t) > 0.5 && tlm < 0.5) {
      inward = vec2(-1.0, -1.0);
    }
    vec2 farCell = cell + inward * 2.0;
    vec2 outerCell = cell - inward;
    float blockBounds = step(0.0, farCell.x) * step(farCell.x, uFieldSize.x - 1.0)
      * step(0.0, farCell.y) * step(farCell.y, uFieldSize.y - 1.0)
      * step(0.0, outerCell.x) * step(outerCell.x, uFieldSize.x - 1.0)
      * step(0.0, outerCell.y) * step(outerCell.y, uFieldSize.y - 1.0)
      * step(0.5, abs(inward.x)) * step(0.5, abs(inward.y));
    if (blockBounds > 0.5) {
      vec2 inwardX = vec2(inward.x * uTexel.x, 0.0);
      vec2 inwardY = vec2(0.0, inward.y * uTexel.y);
      float perimeter = sameMaterial(uv + inwardX * 2.0, material)
        * sameMaterial(uv + inwardY * 2.0, material);
      if (perimeter > 0.5) {
        perimeter *= sameMaterial(uv + (inwardX + inwardY) * 2.0, material);
        if (perimeter > 0.5) {
          perimeter *= sameMaterial(uv + inwardX * 2.0 - inwardY, material)
            * sameMaterial(uv - inwardX + inwardY * 2.0, material)
            * sameMaterial(uv + inwardX + inwardY * 2.0, material)
            * sameMaterial(uv + inwardX * 2.0 + inwardY, material);
        }
      }
      boundedBlock = perimeter;
    }
  }
  float valid = max(localValid, boundedBlock)
    * (1.0 - step(0.5, foreign)) * interior;
  float support = (l + r + t + b) * 0.12 + (tl + tr + bl + br) * 0.05;
  float coverage = max(smoothstep(0.30, 0.60, support), thinCrack * 0.90) * valid;
  float gradientX = (r - l) + (tr + br - tl - bl) * 0.45;
  float gradientY = (b - t) + (bl + br - tl - tr) * 0.45;
  return vec3(coverage * 0.92, gradientX * 0.14, gradientY * 0.14);
}
vec3 wallShape(vec2 uv, float wall) {
  vec2 grid = uv * uFieldSize - 0.5;
  vec2 blend = fract(grid);
  vec2 origin = (floor(grid) + 0.5) * uTexel;
  float q00 = 1.0 - step(0.5, abs(wallAt(origin) - wall));
  float q10 = 1.0 - step(0.5, abs(wallAt(origin + vec2(uTexel.x, 0.0)) - wall));
  float q01 = 1.0 - step(0.5, abs(wallAt(origin + vec2(0.0, uTexel.y)) - wall));
  float q11 = 1.0 - step(0.5, abs(wallAt(origin + uTexel) - wall));
  float top = mix(q00, q10, blend.x);
  float bottom = mix(q01, q11, blend.x);
  return vec3(mix(top, bottom, blend.y), mix(q10 - q00, q11 - q01, blend.y), mix(q01 - q00, q11 - q10, blend.x));
}
vec3 wallColor(float wall) {
  if (wall == 1.0) return vec3(0.49, 0.55, 0.59);
  if (wall == 2.0) return vec3(0.36, 0.44, 0.55);
  if (wall == 3.0) return vec3(0.75, 0.51, 0.24);
  if (wall == 6.0) return vec3(0.27, 0.57, 0.67);
  if (wall == 9.0) return vec3(0.44, 0.52, 0.59);
  if (wall == 10.0) return vec3(0.68, 0.52, 0.29);
  if (wall == 13.0) return vec3(0.51, 0.43, 0.61);
  if (wall == 15.0) return vec3(0.80, 0.75, 0.36);
  if (wall == 16.0) return vec3(0.27, 0.31, 0.36);
  return vec3(0.41, 0.42, 0.44);
}
float wallPattern(float wall, vec2 position) {
  vec2 cell = floor(position);
  if (wall == 6.0) {
    float localX = mod(mod(cell.x, 40.0) + 40.0, 40.0);
    float localY = mod(mod(cell.y, 24.0) + 24.0, 24.0);
    float verticalDistance = min(min(abs(localX - 4.0), abs(localX - 13.0)), abs(localX - 27.0));
    float vertical = 1.0 - step(1.5, verticalDistance);
    float baseline = 1.0 - step(1.5, abs(localY - 12.0));
    float chevronX = 20.0 + floor(abs(localY - 12.0) * 0.55);
    float chevron = 1.0 - step(1.5, abs(localX - chevronX));
    return 0.95 + vertical * 0.18 + baseline * 0.10 + chevron * 0.08;
  }
  float checker = mod(floor(cell.x / 4.0) + floor(cell.y / 4.0), 2.0);
  float pattern = mix(0.94, 1.04, checker);
  if (wall == 9.0 || wall == 10.0 || wall == 13.0 || wall == 15.0) {
    float stripe = 1.0 - step(0.5, mod(cell.x + cell.y, 4.0));
    pattern += stripe * 0.12;
  }
  return pattern;
}
float refractedWallPattern(float wall, vec2 position, float material, vec2 boundarySlope) {
  vec2 cell = floor(position);
  // Exact projected IDs: ICE=12 is stable faceted/frosted; GLAS=24 keeps one
  // coherent lens shift. Only analytic pattern coordinates move—wall ID and
  // wall texture support are never sampled from a neighbouring cell.
  if (material == 24.0) {
    float hasBoundary = step(0.10, abs(boundarySlope.x) + abs(boundarySlope.y));
    vec2 boundaryOffset = sign(boundarySlope) * 3.0;
    vec2 offset = boundaryOffset * hasBoundary;
    return wallPattern(wall, cell + offset);
  }
  float facet = mod(floor(cell.x / 4.0) + floor(cell.y / 4.0) * 3.0 + material, 4.0);
  vec2 offset = facet == 0.0 ? vec2(2.0, 0.0)
    : (facet == 1.0 ? vec2(-2.0, 0.0)
    : (facet == 2.0 ? vec2(0.0, 2.0) : vec2(0.0, -2.0)));
  offset.x = abs(boundarySlope.x) >= 0.10 ? sign(boundarySlope.x) * 2.0 : offset.x;
  offset.y = abs(boundarySlope.y) >= 0.10 ? sign(boundarySlope.y) * 2.0 : offset.y;
  return wallPattern(wall, cell + offset) * 0.68
    + wallPattern(wall, cell - offset) * 0.32;
}
vec4 nearbySurface(vec2 uv) {
  float solid = 0.0;
  float ambiguousSolid = 0.0;
  float solidTemperature = 0.0;
  float solidSamples = 0.0;
  vec4 candidateState = field(uv - vec2(uTexel.x, 0.0));
  float candidate = floor(candidateState.r * 255.0 + 0.5);
  if (candidate > 0.5) {
    vec4 style = texture(uStyleTexture, vec2((candidate + 0.5) / 256.0, 0.5));
    float family = floor(style.r * 255.0 + 0.5);
    if (family == 3.0 || style.b > 0.5) return vec4(candidate, 0.0, candidateState.g, 1.0);
    if (family == 0.0 || family == 4.0) {
      if (solid < 0.5) {
        solid = candidate;
        solidTemperature = candidateState.g;
        solidSamples = 1.0;
      }
      else if (abs(solid - candidate) > 0.5) ambiguousSolid = 1.0;
      else { solidTemperature += candidateState.g; solidSamples += 1.0; }
    }
  }
  candidateState = field(uv + vec2(uTexel.x, 0.0));
  candidate = floor(candidateState.r * 255.0 + 0.5);
  if (candidate > 0.5) {
    vec4 style = texture(uStyleTexture, vec2((candidate + 0.5) / 256.0, 0.5));
    float family = floor(style.r * 255.0 + 0.5);
    if (family == 3.0 || style.b > 0.5) return vec4(candidate, 0.0, candidateState.g, 1.0);
    if (family == 0.0 || family == 4.0) {
      if (solid < 0.5) {
        solid = candidate;
        solidTemperature = candidateState.g;
        solidSamples = 1.0;
      }
      else if (abs(solid - candidate) > 0.5) ambiguousSolid = 1.0;
      else { solidTemperature += candidateState.g; solidSamples += 1.0; }
    }
  }
  candidateState = field(uv - vec2(0.0, uTexel.y));
  candidate = floor(candidateState.r * 255.0 + 0.5);
  if (candidate > 0.5) {
    vec4 style = texture(uStyleTexture, vec2((candidate + 0.5) / 256.0, 0.5));
    float family = floor(style.r * 255.0 + 0.5);
    if (family == 3.0 || style.b > 0.5) return vec4(candidate, 0.0, candidateState.g, 1.0);
    if (family == 0.0 || family == 4.0) {
      if (solid < 0.5) {
        solid = candidate;
        solidTemperature = candidateState.g;
        solidSamples = 1.0;
      }
      else if (abs(solid - candidate) > 0.5) ambiguousSolid = 1.0;
      else { solidTemperature += candidateState.g; solidSamples += 1.0; }
    }
  }
  candidateState = field(uv + vec2(0.0, uTexel.y));
  candidate = floor(candidateState.r * 255.0 + 0.5);
  if (candidate > 0.5) {
    vec4 style = texture(uStyleTexture, vec2((candidate + 0.5) / 256.0, 0.5));
    float family = floor(style.r * 255.0 + 0.5);
    if (family == 3.0 || style.b > 0.5) return vec4(candidate, 0.0, candidateState.g, 1.0);
    if (family == 0.0 || family == 4.0) {
      if (solid < 0.5) {
        solid = candidate;
        solidTemperature = candidateState.g;
        solidSamples = 1.0;
      }
      else if (abs(solid - candidate) > 0.5) ambiguousSolid = 1.0;
      else { solidTemperature += candidateState.g; solidSamples += 1.0; }
    }
  }
  return vec4(
    0.0,
    ambiguousSolid > 0.5 ? 0.0 : solid,
    solidSamples > 0.5 ? solidTemperature / solidSamples : 0.0,
    solidSamples
  );
}
float nearbyPowderStability(vec2 uv, float material) {
  float stability = 0.0;
  vec2 offset = vec2(uTexel.x, 0.0);
  vec2 candidateUv = uv - offset;
  if (abs(materialAt(candidateUv) - material) < 0.5) {
    stability = max(stability, boundaryStabilityAt(candidateUv));
  }
  candidateUv = uv + offset;
  if (abs(materialAt(candidateUv) - material) < 0.5) {
    stability = max(stability, boundaryStabilityAt(candidateUv));
  }
  offset = vec2(0.0, uTexel.y);
  candidateUv = uv - offset;
  if (abs(materialAt(candidateUv) - material) < 0.5) {
    stability = max(stability, boundaryStabilityAt(candidateUv));
  }
  candidateUv = uv + offset;
  if (abs(materialAt(candidateUv) - material) < 0.5) {
    stability = max(stability, boundaryStabilityAt(candidateUv));
  }
  return stability;
}
float triangleSlope(float value, float period) {
  float phase = mod(mod(value, period) + period, period);
  return mix(4.0 / period, -4.0 / period, step(period * 0.5, phase));
}
float triangleWave(float value, float period) {
  float phase = fract(value / period);
  return 1.0 - abs(phase * 2.0 - 1.0) * 2.0;
}
vec3 solidReliefParameters(float optics, float profile) {
  if (granularOptics(optics) > 0.5 || profile == 1.0) return vec3(0.0);
  if (optics == 8.0 || optics == 19.0) return vec3(2.0, 1.0, 7.0);
  if (optics == 9.0) return vec3(1.0, 4.0, 6.0);
  if (optics == 10.0) return vec3(4.0, 0.0, 4.5);
  if (optics == 11.0) return vec3(3.0, -2.0, 5.5);
  if (optics == 12.0) return vec3(2.0, 1.0, 6.0);
  if (profile == 2.0) return vec3(2.0, 1.0, 7.0);
  if (profile == 3.0) return vec3(1.0, 4.0, 6.0);
  if (profile == 5.0) return vec3(4.0, 0.0, 4.5);
  if (profile == 4.0) return vec3(3.0, -2.0, 5.5);
  return vec3(2.0, 1.0, 6.5);
}
vec3 solidBodyMacroKey(float optics) {
  if (optics == 8.0 || optics == 19.0) return vec3(0.3704, 0.6667, 1.0);
  if (optics == 9.0) return vec3(0.5417, 1.0, 0.4583);
  if (optics == 10.0) return vec3(0.2424, 0.6970, 1.0);
  if (optics == 11.0) return vec3(0.2414, 1.0, 0.4828);
  if (optics == 12.0) return vec3(0.2647, 0.6176, 1.0);
  return vec3(0.80, 0.90, 1.0);
}
vec3 solidBodyMacroShadow(float optics) {
  if (optics == 8.0 || optics == 19.0) return vec3(0.94, 0.84, 0.70);
  if (optics == 9.0) return vec3(0.94, 0.72, 0.96);
  if (optics == 10.0) return vec3(1.00, 0.84, 0.62);
  if (optics == 11.0) return vec3(0.96, 0.62, 0.92);
  if (optics == 12.0) return vec3(1.00, 0.78, 0.54);
  return vec3(0.88, 0.80, 0.68);
}
float solidBodyMacroGain(float optics) {
  if (optics == 8.0 || optics == 19.0 || optics == 11.0) return 9.36 / 255.0;
  if (optics == 9.0) return 8.10 / 255.0;
  if (optics == 10.0 || optics == 12.0) return 10.0 / 255.0;
  return 7.40 / 255.0;
}
float solidBodyFieldExposure(
  float optics, float profile, float opticalDepth, float reliefTone
) {
  float familyExposure = 0.34;
  float reliefStrength = 6.5;
  if (optics == 8.0 || optics == 19.0 || profile == 2.0) {
    familyExposure = 0.42; reliefStrength = 7.0;
  }
  if (optics == 9.0 || profile == 3.0) {
    familyExposure = 0.36; reliefStrength = 6.0;
  }
  if (optics == 10.0 || profile == 5.0) {
    familyExposure = 0.50; reliefStrength = 4.5;
  }
  if (optics == 11.0 || profile == 4.0) {
    familyExposure = 0.40; reliefStrength = 5.5;
  }
  float depthSupport = smoothstep(6.0 / 255.0, 42.0 / 255.0, opticalDepth);
  float coreAttenuation = 1.0
    - smoothstep(150.0 / 255.0, 1.0, opticalDepth) * 0.35;
  float macroRelief = clamp(reliefTone * 255.0 / reliefStrength, -1.0, 1.0);
  return familyExposure * depthSupport * coreAttenuation * (0.85 + macroRelief * 0.15);
}
float solidBodyFieldTraitEligibility(float traits) {
  // Passive radioactive/organic/fibrous identity remains eligible. Active
  // emitter, sink, channel, force, and carrier roles keep their exact styling.
  float blocked = mod(floor(traits / 1.0), 2.0)
    + mod(floor(traits / 2.0), 2.0)
    + mod(floor(traits / 4.0), 2.0)
    + mod(floor(traits / 8.0), 2.0)
    + mod(floor(traits / 128.0), 2.0);
  return 1.0 - step(0.5, blocked);
}
float solidInteriorMicroGain(float optics, float profile) {
  if (optics == 8.0 || optics == 19.0 || (optics < 0.5 && profile == 2.0)) return 0.54;
  if (optics == 9.0 || (optics < 0.5 && profile == 3.0)) return 0.70;
  if (optics == 10.0 || (optics < 0.5 && profile == 5.0)) return 0.56;
  if (optics == 11.0 || (optics < 0.5 && profile == 4.0)) return 0.74;
  if (optics == 12.0) return 0.48;
  return 0.72;
}
float solidCurvatureGain(float optics, float profile) {
  if (granularOptics(optics) > 0.5 || profile == 1.0) return 0.0;
  // Runtime WebGL samples the curve at a different composed footprint from the
  // fixed Canvas contour tiles. The small rigid-only calibration keeps the
  // measured convex/concave response inside the paired visual contract.
  if (optics == 8.0 || optics == 19.0 || profile == 2.0) return 1.25;
  if (optics == 10.0 || profile == 5.0) return 0.82;
  if (optics == 11.0 || profile == 4.0) return 0.70;
  if (optics == 12.0) return 0.62;
  if (optics == 9.0 || profile == 3.0) return 0.58;
  return 0.72;
}
vec3 solidReliefSample(vec2 position, float material, float profile, float optics) {
  vec3 parameters = solidReliefParameters(optics, profile);
  float value = dot(position, parameters.xy) + material * 11.0;
  float phase = mod(mod(value, 128.0) + 128.0, 128.0);
  float triangle = 1.0 - abs(phase - 64.0) / 32.0;
  float wave = triangle * (1.5 - 0.5 * triangle * triangle);
  float slope = triangleSlope(value, 128.0) * (1.5 - 1.5 * triangle * triangle);
  return vec3(
    parameters.xy * slope * parameters.z * 0.18,
    wave * parameters.z / 255.0
  );
}
float liquidSpeciesContrast(vec4 center, vec4 neighbour) {
  float support = smoothstep(0.62, 0.88, min(center.a, neighbour.a));
  float contrast = max(
    max(abs(center.r - neighbour.r), abs(center.g - neighbour.g)),
    abs(center.b - neighbour.b)
  );
  return support * smoothstep(0.06, 0.28, contrast);
}
void main() {
  vec2 fieldUv = vFieldCoord;
  vec4 state = field(fieldUv);
  vec4 wallState = wallField(fieldUv);
  float wall = floor(wallState.r * 255.0 + 0.5);
  float exteriorPowderAir = wallState.g;
  vec3 wallSurface = wall > 0.5 ? wallShape(fieldUv, wall) : vec3(0.0);
  vec4 atmosphereState = texture(uAtmosphereTexture, fieldUv);
  vec4 emissionState = texture(uEmissionTexture, fieldUv);
  vec4 liquidState = texture(uLiquidTexture, fieldUv);
  float liquidDensity = liquidState.a;
  float material = floor(state.r * 255.0 + 0.5);
  float materialTemperature = state.g;
  float halo = 0.0;
  float cloudOnly = 0.0;
  float emissionOnly = 0.0;
  float liquidOnly = 0.0;
  float surfaceOnly = 0.0;
  float projectedSurfaceSamples = 0.0;
  float wallOnly = 0.0;
  if (material < 0.5) {
    // The reconstructed field already resolves all eight neighbours and keeps
    // unlike-liquid ties transparent. Its alpha and RGB must stay authoritative;
    // re-selecting a cardinal semantic neighbour here caused diagonal gaps and
    // scan-order species bleed that disagreed with the Canvas presenter.
    // Keep the empty-cell promotion threshold above the semantic-cell-centred
    // halo of one isolated droplet. Connected pools still cross it, while one
    // liquid particle cannot manufacture a broad reconstructed footprint.
    if (liquidDensity > 0.28) liquidOnly = 1.0;
    if (liquidOnly > 0.5) {
      halo = 1.0;
    } else if (atmosphereState.a > 0.004) {
      cloudOnly = 1.0;
    } else if (wall > 0.5) {
      wallOnly = 1.0;
    } else {
      vec4 nearby = nearbySurface(fieldUv);
      material = nearby.x;
      if (material > 0.5) materialTemperature = nearby.z;
      if (material < 0.5 && nearby.y > 0.5) {
        material = nearby.y;
        materialTemperature = nearby.z;
        surfaceOnly = material > 0.5 ? 1.0 : 0.0;
        projectedSurfaceSamples = nearby.w;
      }
      if (material < 0.5) {
        if (wall > 0.5) wallOnly = 1.0;
        else if (emissionState.a > 0.002) emissionOnly = 1.0;
        else { finalColor = vec4(0.0); return; }
      }
    }
    halo = 1.0;
  }
  vec4 materialStyle = texture(uStyleTexture, vec2((material + 0.5) / 256.0, 0.5));
  vec4 paletteSample = texture(uPaletteTexture, vec2((material + 0.5) / 256.0, 0.5));
  float family = floor(materialStyle.r * 255.0 + 0.5);
  float profile = floor(materialStyle.g * 255.0 + 0.5);
  bool materialEmissive = materialStyle.b > 0.5;
  float traits = floor(materialStyle.a * 255.0 + 0.5);
  float optics = floor(paletteSample.a * 255.0 + 0.5);
  float energyCore = family == 3.0 ? 1.0 : 0.0;
  vec4 suspensionState = vec4(0.0);
  // The half-resolution RGB field is presentation-only and optional. Keeping
  // this fetch behind both a scene-wide uniform and eligible phase branches is
  // important at true 8x, where an unconditional sample would run 15M times.
  if (uSuspensionActive > 0.5 && uPowderStyle > 1.5
    && (liquidOnly > 0.5 || family == 2.0 || family == 4.0)) {
    suspensionState = texture(uSuspensionTexture, fieldUv);
  }
  vec2 fieldPosition = fieldUv * uFieldSize;
  vec2 velocity = halo > 0.5 ? vec2(0.0) : state.ba * 2.0 - 1.0;
  float contourCurvature = 0.0;
  float phaseContactLight = 0.0;
  float foreignMatterContact = 0.0;
  float unlikeMaterialContact = 0.0;
  vec4 shape = wallOnly > 0.5
    ? vec4(wallSurface, 0.0)
    : (surfaceOnly > 0.5
    ? (family == 4.0
      ? occupancyShape(
        fieldUv, material, family, 1.0, contourCurvature, phaseContactLight,
        foreignMatterContact, unlikeMaterialContact
      )
      : vec4(enclosedSurfaceShape(fieldUv, material), 0.0))
    : ((cloudOnly > 0.5 || emissionOnly > 0.5)
    ? vec4(0.0)
    : (liquidOnly > 0.5
    ? vec4(liquidDensity, 0.0, 0.0, 4.0)
    : (family == 1.0
      ? vec4(discreteShape(fieldUv, material), 0.0)
      : occupancyShape(
        fieldUv, material, family,
        (family == 0.0 || family == 2.0 || family == 4.0) ? 1.0 : 0.0,
        contourCurvature, phaseContactLight, foreignMatterContact, unlikeMaterialContact
      )))));
  float boundaryStability = 0.0;
  float liquidOpticalDepth = 0.0;
  float solidOpticalDepth = 0.0;
  float powderSurfaceBlend = 0.0;
  float powderBulkDepth = 0.0;
  vec4 localPowderShape = shape;
  vec4 widePowderShape = shape;
  if (family == 4.0) {
    boundaryStability = surfaceOnly > 0.5
      ? nearbyPowderStability(fieldUv, material)
      : (halo < 0.5 ? boundaryStabilityAt(fieldUv) : 0.0);
  } else if (family == 2.0 && liquidOnly < 0.5 && halo < 0.5) {
    // Powder stability and liquid column depth are phase-exclusive occupants
    // of the same already allocated r8 auxiliary texture.
    liquidOpticalDepth = boundaryStabilityAt(fieldUv);
  } else if (family == 0.0 && surfaceOnly < 0.5 && halo < 0.5
    && wall < 0.5 && material != 3.0 && !materialEmissive) {
    // Solid thickness is the third phase-exclusive occupant of the existing
    // r8 auxiliary byte. It is sampled only for authoritative non-emissive
    // solid fragments, never reconstructed support, walls, or energy; role
    // traits remain a later RGB layer and therefore stay legible.
    solidOpticalDepth = boundaryStabilityAt(fieldUv);
  }
  if (family == 4.0 && boundaryStability > 0.001 && uPowderStyle > 1.5) {
    widePowderShape = powderSurfaceShape(fieldUv);
    powderBulkDepth = powderSurfaceBulkDepth(fieldUv, material, surfaceOnly);
    float verticalShare = abs(widePowderShape.z)
      / (abs(widePowderShape.y) + abs(widePowderShape.z) + 0.000001);
    powderSurfaceBlend = smoothstep(0.42, 0.70, verticalShare)
      * smoothstep(0.006, 0.030, abs(widePowderShape.z))
      * powderBulkDepth;
    shape = mix(shape, widePowderShape, boundaryStability * powderSurfaceBlend);
  }
  // Powder may extend into an empty presentation fragment only when at least
  // three compatible powder samples prove a bulk contact. Loose/moving grains
  // stay inside their semantic cell, and ambiguous unlike-species candidates
  // were rejected by nearbySurface before reaching this estimator.
  if (surfaceOnly > 0.5 && family == 4.0
    && (shape.w < 2.5 || projectedSurfaceSamples > 2.5
      || exteriorPowderAir < 0.5)) shape = vec4(0.0);
  float density = shape.x;
  float gasVolume = max(cloudOnly, family == 1.0 ? 1.0 : 0.0);
  float liquidVolume = max(liquidOnly, family == 2.0 ? 1.0 : 0.0);
  float volume = density;
  if (emissionOnly > 0.5) volume = emissionState.a;
  else if (cloudOnly > 0.5) volume = atmosphereState.a;
  else if (liquidVolume > 0.5) volume = max(density, liquidDensity);
  float gasInterior = cloudOnly > 0.5
    ? 1.0
    : (gasVolume > 0.5 ? smoothstep(0.02, 0.16, atmosphereState.a) : 0.0);
  float liquidInterior = liquidVolume > 0.5
    ? (liquidOnly > 0.5
      ? smoothstep(0.48, 0.92, liquidDensity)
      : smoothstep(0.42, 0.90, density))
    : 0.0;
  vec2 volumeSlope = vec2(0.0);
  vec2 liquidSpeciesSlope = vec2(0.0);
  float cloudNeighbourMean = 0.0;
  float emissionNeighbourMean = 0.0;
  float liquidNeighbourMean = 0.0;
  float adjacentLiquidSupport = 0.0;
  float exposedLiquidSide = 0.0;
  if (emissionOnly > 0.5) {
    float lightLeft = texture(uEmissionTexture, fieldUv - vec2(uEmissionTexel.x, 0.0)).a;
    float lightRight = texture(uEmissionTexture, fieldUv + vec2(uEmissionTexel.x, 0.0)).a;
    float lightTop = texture(uEmissionTexture, fieldUv - vec2(0.0, uEmissionTexel.y)).a;
    float lightBottom = texture(uEmissionTexture, fieldUv + vec2(0.0, uEmissionTexel.y)).a;
    emissionNeighbourMean = (lightLeft + lightRight + lightTop + lightBottom) * 0.25;
    volumeSlope = vec2(lightRight - lightLeft, lightBottom - lightTop) * 0.72;
  } else if (gasVolume > 0.5) {
    float cloudLeft = texture(uAtmosphereTexture, fieldUv - vec2(uAtmosphereTexel.x, 0.0)).a;
    float cloudRight = texture(uAtmosphereTexture, fieldUv + vec2(uAtmosphereTexel.x, 0.0)).a;
    float cloudTop = texture(uAtmosphereTexture, fieldUv - vec2(0.0, uAtmosphereTexel.y)).a;
    float cloudBottom = texture(uAtmosphereTexture, fieldUv + vec2(0.0, uAtmosphereTexel.y)).a;
    cloudNeighbourMean = (cloudLeft + cloudRight + cloudTop + cloudBottom) * 0.25;
    volumeSlope = vec2(cloudRight - cloudLeft, cloudBottom - cloudTop) * 0.85;
  } else if (liquidVolume > 0.5) {
    vec4 liquidLeft = texture(uLiquidTexture, fieldUv - vec2(uTexel.x, 0.0));
    vec4 liquidRight = texture(uLiquidTexture, fieldUv + vec2(uTexel.x, 0.0));
    vec4 liquidTop = texture(uLiquidTexture, fieldUv - vec2(0.0, uTexel.y));
    vec4 liquidBottom = texture(uLiquidTexture, fieldUv + vec2(0.0, uTexel.y));
    liquidNeighbourMean = (liquidLeft.a + liquidRight.a + liquidTop.a + liquidBottom.a) * 0.25;
    // The field deliberately owns a one-cell reconstruction halo. Directional
    // support keeps isolated droplets exact while allowing a bounded amount of
    // cohesion on a connected sparse strand, matching the shared fluid style.
    float liquidSupportLeft = step(0.68, liquidLeft.a);
    float liquidSupportRight = step(0.68, liquidRight.a);
    float liquidSupportTop = step(0.68, liquidTop.a);
    float liquidSupportBottom = step(0.68, liquidBottom.a);
    adjacentLiquidSupport = max(
      max(liquidSupportLeft * liquidSupportTop, liquidSupportTop * liquidSupportRight),
      max(liquidSupportRight * liquidSupportBottom, liquidSupportBottom * liquidSupportLeft)
    );
    exposedLiquidSide = max(
      max(1.0 - liquidSupportLeft, 1.0 - liquidSupportRight),
      max(1.0 - liquidSupportTop, 1.0 - liquidSupportBottom)
    );
    volumeSlope = vec2(
      liquidRight.a - liquidLeft.a, liquidBottom.a - liquidTop.a
    ) * 0.65;
    // Union liquid alpha stays flat at a dense unlike-species contact. Canonical
    // field RGB therefore supplies a bounded optical normal at that interface.
    // Dense support on both samples rejects empty shores and isolated droplets;
    // the four texture reads above already existed, so this adds no probes.
    liquidSpeciesSlope = vec2(
      liquidSpeciesContrast(liquidState, liquidRight)
        - liquidSpeciesContrast(liquidState, liquidLeft),
      liquidSpeciesContrast(liquidState, liquidBottom)
        - liquidSpeciesContrast(liquidState, liquidTop)
    );
  }
  // Promote only a field-supported pool interior. Requiring both centre and
  // cardinal mean prevents an isolated droplet from becoming a flat opaque
  // blob while suppressing semantic-cell micro normals inside cohesive liquid.
  float liquidFieldInterior = liquidVolume > 0.5
    ? min(
      smoothstep(0.48, 0.90, liquidDensity),
      smoothstep(0.48, 0.90, liquidNeighbourMean)
    )
    : 0.0;
  float cohesiveLiquidInterior = max(liquidInterior, liquidFieldInterior);
  float shapeDetail = 1.0 - max(gasInterior, cohesiveLiquidInterior);
  vec2 semanticSlope = shape.yz * shapeDetail;
  float granularSurface = (family == 4.0 || granularOptics(optics) > 0.5) ? 1.0 : 0.0;
  float solidInterior = family == 0.0
    ? smoothstep(0.76, 0.98, density)
      * (1.0 - smoothstep(0.10, 0.62, length(shape.yz)))
      * (1.0 - granularSurface)
    : 0.0;
  float solidReliefTone = 0.0;
  if (solidInterior > 0.001) {
    vec3 solidRelief = solidReliefSample(fieldPosition, material, profile, optics);
    semanticSlope += solidRelief.xy * solidInterior;
    solidReliefTone = solidRelief.z * solidInterior;
  }
  vec3 normal = normalize(vec3(
    -semanticSlope.x - volumeSlope.x,
    -semanticSlope.y - volumeSlope.y,
    mix(1.45, 1.15, uAnalyticLightingQuality)
  ));
  float diffuse = 0.72 + max(0.0, dot(normal, normalize(vec3(-0.48, -0.68, 0.78)))) * 0.42;
  float specular = pow(max(0.0, dot(normal, normalize(vec3(-0.35, -0.55, 0.92)))), 10.0);
  vec3 base = wallOnly > 0.5
    ? wallColor(wall)
    : (emissionOnly > 0.5
    ? emissionState.rgb
    : (cloudOnly > 0.5
    ? atmosphereState.rgb
    : (liquidOnly > 0.5 ? liquidState.rgb : paletteSample.rgb)));
  float grain = fract(sin(dot(floor(fieldPosition), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  float atmosphere = sin(fieldPosition.x * 0.055 + fieldPosition.y * 0.027 + uTime * 0.7 + velocity.x * 2.0)
    * sin(fieldPosition.y * 0.043 - uTime * 0.43 + velocity.y * 1.7);
  float heat = smoothstep(0.07, 0.34, state.g);
  float alpha;
  vec3 color;
  float liquidLightResponse = 0.0;
  vec2 liquidBackdropOffset = vec2(0.0);
  if (wallOnly > 0.5) {
    alpha = smoothstep(0.30, 0.70, density) * 0.96;
    color = base * wallPattern(wall, fieldPosition) * (0.76 + diffuse * 0.24);
    color += vec3(0.08) * specular * 0.18;
  } else if (emissionOnly > 0.5) {
    float pulse = 0.90 + sin(uTime * 2.1 + fieldPosition.x * 0.025 - fieldPosition.y * 0.018) * 0.10;
    alpha = smoothstep(0.002, 0.28, volume) * (0.07 + volume * 0.30) * pulse;
    color = mix(base * 1.42 + vec3(0.045), base * 0.72, volume) * (0.68 + diffuse * 0.32);
    color += mix(vec3(0.16, 0.19, 0.24), base, 0.56) * specular * 0.30;
    // Reuse the four aura samples already needed by the analytic normal. A
    // small signed crown/pocket term and directional key/fill keep the volume
    // readable without changing its alpha, support, topology, or 8x resources.
    float emissionCurvature = clamp((volume - emissionNeighbourMean) * 8.0, -1.0, 1.0);
    float emissionDirection = clamp(
      dot(volumeSlope, normalize(vec2(-0.48, -0.68))) * 2.0,
      -1.0, 1.0
    );
    float emissionVolumeTone = (
      emissionCurvature * 0.048 + emissionDirection * 0.028
    ) * uEmissionVolumeChroma;
    color += (base * 0.80 + vec3(0.035, 0.045, 0.060)) * emissionVolumeTone;
  } else if (energyCore > 0.5) {
    // Energy owns a luminous semantic core. The lower-resolution emission field
    // remains the surrounding aura, so fast particles never inherit its lag or
    // become radioactive/rigid textured solids.
    float core = smoothstep(0.36, 0.90, density);
    float edge = 1.0 - smoothstep(0.34, 0.88, density);
    float speed = clamp(length(velocity) * 1.45, 0.0, 1.0);
    float flowWave = sin(
      fieldPosition.x * (0.15 + speed * 0.08)
      + fieldPosition.y * (0.09 - velocity.x * 0.035)
      - uTime * (1.65 + speed * 1.8)
      + material * 0.41
    );
    float pulse = 0.5 + 0.5 * sin(uTime * 2.35 + material * 0.61 + atmosphere * 1.7);
    float scintillation = fract(sin(dot(floor(fieldPosition * 1.5), vec2(41.73, 19.19)) + material) * 143758.5453);
    float radioactiveCarrier = traitFlag(traits, 16.0);
    float directedCarrier = traitFlag(traits, 128.0);
    vec3 energyBase = vividColor(base, mix(1.18, 1.32, radioactiveCarrier));
    vec3 auraTint = emissionState.a > 0.002
      ? mix(energyBase, emissionState.rgb, 0.18 + edge * 0.10)
      : energyBase;
    float carrierDetail = mix(
      0.94 + flowWave * 0.08 + pulse * 0.06,
      0.92 + flowWave * 0.045 + step(0.84, scintillation) * (0.13 + uHighQuality * 0.09),
      directedCarrier
    );
    // The emission field is already a bounded, low-frequency reconstruction of
    // nearby emissive particles. Use it only to calm dense semantic energy
    // blocks; sparse carriers keep their exact animated detail and silhouette.
    float denseEnergyField = smoothstep(0.12, 0.48, emissionState.a);
    float cohesiveEnergy = denseEnergyField * smoothstep(0.18, 0.66, density);
    float cohesiveCarrierDetail = mix(
      carrierDetail,
      1.0 + flowWave * 0.022 + pulse * 0.018,
      cohesiveEnergy * 0.72
    );
    float semanticAlpha = smoothstep(0.18, 0.72, density)
      * mix(0.58 + pulse * 0.08, 0.94, core)
      * mix(1.0, carrierDetail, edge * 0.55);
    float cohesiveAlpha = smoothstep(0.10, 0.58, density) * mix(0.72, 0.96, core);
    alpha = mix(semanticAlpha, cohesiveAlpha, cohesiveEnergy * 0.72);
    color = energyBase * (1.05 + core * 0.48 + heat * 0.30) * cohesiveCarrierDetail;
    color += auraTint * edge * (0.20 + pulse * 0.16);
    color += mix(vec3(1.0, 0.72, 0.42), vec3(0.72, 0.90, 1.0), radioactiveCarrier)
      * core * (0.10 + pulse * 0.08);
    // Dense exact carriers share the already available low-frequency flow
    // signal as one hue-preserving radiance body. Sparse particles remain
    // exact, and this adds no texture read, field, pass, or alpha change.
    float energySurfaceRelief = (diffuse - 0.93) * 0.28 * mix(0.20, 1.0, edge);
    float energyRelief = clamp(
      flowWave * cohesiveEnergy * 0.075 + energySurfaceRelief, -0.10, 0.10
    );
    color *= 1.0 + energyRelief * uEnergyCoreRelief;
    // Preserve sparse aura energy while compressing only the dense semantic
    // core. This retains hue and flow detail that would otherwise framebuffer-
    // clip into flat neon slabs after premultiplication.
    color = mix(color, toneMapEnergy(color), smoothstep(0.08, 0.68, core));
    color = min(vec3(232.0 / 255.0), max(
      color + energyIdentityDelta(material, fieldPosition, uTime, velocity) * uEnergyIdentityStyling,
      vec3(0.0)
    ));
  } else if (gasVolume > 0.5) {
    float billow = 0.92 + atmosphere * 0.08 * (1.0 - gasInterior * 0.50);
    // Dense reconstructed gas should read as one mixed volume, not as the raw
    // palette colour of whichever semantic particle occupies this fragment.
    float semanticGasDetail = 1.0 - gasInterior;
    float sootyGas = (optics == 5.0 ? 1.0 : 0.0) * semanticGasDetail;
    float cleanGas = (optics == 6.0 ? 1.0 : 0.0) * semanticGasDetail;
    float gasFieldSupport = smoothstep(0.006, 0.12, atmosphereState.a);
    vec3 gasMixture = mix(
      base, atmosphereState.rgb, max(gasInterior * 0.98, gasFieldSupport * 0.88)
    );
    vec3 gasBase = vividColor(gasMixture, 1.20 + cleanGas * 0.10 - sootyGas * 0.08);
    float gasShadeDensity = mix(density, atmosphereState.a, gasInterior);
    float gasCurvature = clamp((atmosphereState.a - cloudNeighbourMean) * 8.0, -1.0, 1.0);
    float gasCrown = max(gasCurvature, 0.0);
    float gasPocket = max(-gasCurvature, 0.0);
    float opticalDepth = smoothstep(0.035, 0.62, gasShadeDensity);
    float silverLining = (1.0 - smoothstep(0.10, 0.58, gasShadeDensity))
      * smoothstep(0.73, 1.08, diffuse);
    float particleAlpha = smoothstep(0.08, 0.72, density) * (0.38 + atmosphere * 0.06);
    float cloudAlpha = smoothstep(0.004, 0.22, atmosphereState.a)
      * (0.085 + atmosphereState.a * 0.36) * billow;
    float semanticAccentShare = mix(0.22, 0.055, gasFieldSupport)
      + (materialEmissive ? 0.035 : 0.0);
    float semanticAccentAlpha = particleAlpha * semanticAccentShare;
    alpha = cloudOnly > 0.5
      ? cloudAlpha
      : cloudAlpha + semanticAccentAlpha * (1.0 - cloudAlpha);
    // Beer-like optical depth keeps the core saturated and translucent while a
    // directional silver lining gives the boundary volume without a hard edge.
    float gasCoreTransmission = 0.74 + cleanGas * 0.08 - sootyGas * 0.13;
    float gasScatter = 0.26 + cleanGas * 0.10 - sootyGas * 0.08;
    color = gasBase * mix(1.08 + cleanGas * 0.04, gasCoreTransmission, opticalDepth)
      * (0.76 + diffuse * 0.28) * billow;
    color *= 1.0 + gasCrown * 0.18 - gasPocket * 0.11;
    color += mix(vec3(0.16, 0.19, 0.24), gasBase, 0.30 + cleanGas * 0.12)
      * silverLining * gasScatter;
    color += mix(vec3(0.10, 0.12, 0.16), gasBase, 0.34)
      * specular * mix(0.62, 0.18, gasInterior);
    float gasLightReach = smoothstep(0.002, 0.42, emissionState.a);
    vec3 gasLightColor = emissionState.rgb;
    float gasNormalLength = length(normal.xy);
    float gasLightIncidence = 0.0;
    // One high-quality probe follows the already reconstructed outward gas
    // normal. A brighter field sample in that direction proves a facing light;
    // compact/mobile quality keeps the bounded centre-field scatter below and
    // performs no additional directional texture fetch.
    if (uGasFieldLighting > 0.5 && uHighQuality > 0.5 && gasNormalLength > 0.0001) {
      vec2 gasOutward = normal.xy / gasNormalLength;
      vec4 outwardLight = texture(
        uEmissionTexture, fieldUv + gasOutward * uEmissionTexel * 2.0
      );
      gasLightIncidence = smoothstep(0.0, 0.12, outwardLight.a - emissionState.a);
      if (outwardLight.a > emissionState.a) gasLightColor = outwardLight.rgb;
      gasLightReach = max(gasLightReach, smoothstep(0.002, 0.42, outwardLight.a) * 0.86);
    }
    float gasLightScatter = gasLightReach
      * (0.060 + gasLightIncidence * 0.78 + silverLining * 0.040)
      * (1.0 - opticalDepth * 0.48) * uGasFieldLighting;
    color += vividColor(gasLightColor, 1.12) * gasLightScatter;
    // The atmosphere's existing cardinal field samples also supply a signed
    // billow normal and curvature. Reuse them as a restrained hue-aware
    // key/fill after scene lighting: RGB only, with no new sampler, field,
    // resource, pass, or 8x-scaled allocation.
    float gasDirectionalRelief = (volumeSlope.x + volumeSlope.y) * 0.5882353;
    float gasChroma = gasVolumeChromaResponse(
      gasShadeDensity, opticalDepth, gasDirectionalRelief, gasCurvature * 0.125
    ) * uGasVolumeChroma;
    color = applyGasVolumeChroma(color, gasBase, gasChroma);
    if (uGasIdentityStyling > 0.5) {
      float gasIdentityStyle = floor(
        texture(uAtmosphereStyleTexture, fieldUv).r * 255.0 + 0.5
      );
      color += gasIdentityVolumeDelta(
        gasIdentityStyle, fieldPosition, gasShadeDensity,
        gasDirectionalRelief, gasCurvature * 0.125
      );
    }
  } else if (liquidVolume > 0.5) {
    float aqueous = optics == 1.0 ? 1.0 : 0.0;
    float oily = optics == 2.0 ? 1.0 : 0.0;
    float corrosive = optics == 3.0 ? 1.0 : 0.0;
    float molten = optics == 4.0 ? 1.0 : 0.0;
    float cryogenic = optics == 16.0 ? 1.0 : 0.0;
    float metallicLiquid = optics == 17.0 ? 1.0 : 0.0;
    float viscousLiquid = optics == 18.0 ? 1.0 : 0.0;
    vec3 liquidBase = vividColor(
      base,
      1.24 + aqueous * 0.06 + corrosive * 0.08 - oily * 0.05
        + cryogenic * 0.04 - metallicLiquid * 0.16 - viscousLiquid * 0.04
    );
    // The four already-sampled field neighbours promote only locally supported
    // pool interiors. This makes reconstructed holes and semantic cells share
    // one optical depth without turning an isolated droplet into a pool core.
    float liquidDepth = max(cohesiveLiquidInterior, smoothstep(0.48, 0.90, liquidNeighbourMean));
    float liquidSurfaceDensity = liquidOnly > 0.5 ? liquidDensity : density;
    float rim = (1.0 - smoothstep(0.30, 0.86, liquidSurfaceDensity))
      * mix(1.0, 0.25, liquidDepth);
    // Give the field-owned slope enough leverage to read as an optical surface,
    // while retaining a positive z component so the liquid never resembles a
    // chrome cut-out. Coverage and species support remain separate below.
    vec3 liquidNormal = normalize(vec3(
      -(semanticSlope.x + volumeSlope.x + liquidSpeciesSlope.x * 0.16) * 1.65,
      -(semanticSlope.y + volumeSlope.y + liquidSpeciesSlope.y * 0.18) * 1.65,
      0.88
    ));
    // Reuse the field-owned optical normal to bend only a coexisting native
    // wall's analytic pattern. The offset is world-cell bounded and molten or
    // emissive liquids remain exact no-ops in the final backdrop branch.
    if (wall > 0.5 && uTranslucentBackdropRefraction > 0.5
      && family == 2.0 && !materialEmissive) {
      vec2 liquidBackdropSlope = semanticSlope + volumeSlope;
      vec2 liquidBackdropRawOffset = aqueous > 0.5 ? vec2(2.0, -1.0)
        : (oily > 0.5 ? vec2(-1.0, 1.0)
        : (corrosive > 0.5 ? vec2(2.0, 1.0) : vec2(1.0, 0.0)));
      if (dot(liquidBackdropSlope, liquidBackdropSlope) > 0.0004) {
        float liquidRefractionStrength = 2.6 + aqueous * 0.55 - oily * 0.25 + corrosive * 0.25;
        vec2 liquidBackdropNormal = normalize(vec3(
          -liquidBackdropSlope.x * 1.65, -liquidBackdropSlope.y * 1.65, 0.88
        )).xy;
        liquidBackdropRawOffset += liquidBackdropNormal * liquidRefractionStrength
          * mix(1.0, 0.72, cohesiveLiquidInterior);
      }
      liquidBackdropRawOffset = clamp(liquidBackdropRawOffset, vec2(-3.0), vec2(3.0))
        * (1.0 - molten);
      liquidBackdropOffset = sign(liquidBackdropRawOffset)
        * floor(abs(liquidBackdropRawOffset) + vec2(0.5));
    }
    vec3 liquidLightDirection = normalize(vec3(-0.48, -0.68, 0.78));
    vec3 liquidFillDirection = normalize(vec3(0.62, 0.24, 0.72));
    float liquidDiffuse = 0.54
      + max(0.0, dot(liquidNormal, liquidLightDirection)) * 0.54
      + max(0.0, dot(liquidNormal, liquidFillDirection)) * 0.10;
    float fresnel = pow(1.0 - clamp(liquidNormal.z, 0.0, 1.0), 1.65);
    float surfaceSpecular = pow(
      max(0.0, dot(liquidNormal, normalize(vec3(-0.35, -0.55, 0.92)))), 12.0
    ) * mix(1.0, 0.16, liquidDepth);
    float broadSheen = 0.5 + 0.5
      * sin(fieldPosition.x * 0.041 + fieldPosition.y * 0.016 + material * 0.83 + uTime * 0.22)
      * sin(fieldPosition.y * 0.029 - fieldPosition.x * 0.012 - uTime * 0.17);
    float causticWave = 0.5 + 0.5 * sin(
      fieldPosition.x * 0.092
      + sin(fieldPosition.y * 0.037 + uTime * 0.11) * 1.45
      + material * 0.67
    );
    float caustic = pow(causticWave, 6.0) * liquidDepth;
    // Reuse the existing analytic sheen and caustic signals as a centred,
    // low-frequency body relief. Optics alter only the gain: Water carries a
    // soft caustic, Oil a broader sheen, Acid a restrained sharper response,
    // and self-luminous Lava keeps the weakest reflected modulation. This is
    // RGB-only and field-depth-gated, so sparse droplets, species seams, and
    // reconstructed support remain authoritative.
    float macroSheenGain = 0.075 + aqueous * 0.055 + oily * 0.085
      + corrosive * 0.225 - molten * 0.015 + cryogenic * 0.06
      + metallicLiquid * 0.15 + viscousLiquid * 0.11;
    float macroCausticGain = 0.055 + aqueous * 0.065 - oily * 0.025
      + corrosive * 0.195 - molten * 0.035 + cryogenic * 0.08
      - metallicLiquid * 0.04 - viscousLiquid * 0.03;
    float broadCaustic = smoothstep(0.18, 0.88, causticWave) - 0.5;
    float liquidMacroRelief = liquidDepth * (
      (broadSheen - 0.5) * macroSheenGain + broadCaustic * macroCausticGain
    );
    float liquidInterfaceRelief = clamp(
      dot(liquidSpeciesSlope, vec2(0.075, 0.09)), -0.12, 0.12
    );
    float topLip = smoothstep(0.02, 0.16, volumeSlope.y);
    float lowerShade = smoothstep(0.02, 0.16, -volumeSlope.y);
    liquidLightResponse = mix(
      0.055,
      0.30,
      clamp(topLip * 0.48 + rim * 0.30 + surfaceSpecular * 0.22 + fresnel * 0.26, 0.0, 1.0)
    );
    float depthTransmission = 0.66 + aqueous * 0.10 - oily * 0.10
      + corrosive * 0.04 - molten * 0.15 + cryogenic * 0.14
      - metallicLiquid * 0.18 - viscousLiquid * 0.10;
    float gloss = 1.0 + aqueous * 0.18 + oily * 0.30
      + corrosive * 0.12 - molten * 0.20 + cryogenic * 0.24
      + metallicLiquid * 0.55 + viscousLiquid * 0.18;
    float causticStrength = 0.085 + aqueous * 0.055 - oily * 0.045
      + corrosive * 0.025 - molten * 0.055 + cryogenic * 0.04
      - metallicLiquid * 0.07 - viscousLiquid * 0.03;
    float liquidBodyExposure = 1.0 - aqueous * 0.04 - oily * 0.10
      + corrosive * 0.05 + molten * 0.20 - cryogenic * 0.02
      - metallicLiquid * 0.16 - viscousLiquid * 0.09;
    vec3 edgeTint = mix(vec3(0.66, 0.82, 0.88), liquidBase, 0.20);
    edgeTint = mix(edgeTint, vec3(0.72, 0.92, 1.0), aqueous * 0.18);
    edgeTint = mix(edgeTint, vec3(0.94, 0.72, 0.34), oily * 0.12 + molten * 0.20);
    edgeTint = mix(edgeTint, vec3(0.72, 1.0, 0.76), corrosive * 0.18);
    edgeTint = mix(edgeTint, vec3(0.70, 0.94, 1.0), cryogenic * 0.24);
    edgeTint = mix(edgeTint, vec3(0.92, 0.95, 1.0), metallicLiquid * 0.30);
    edgeTint = mix(edgeTint, vec3(0.82, 0.90, 0.96), viscousLiquid * 0.18);
    vec3 reflectedEnvironment = mix(
      vec3(0.055, 0.085, 0.115),
      vec3(0.16, 0.12, 0.075),
      clamp(0.5 - liquidNormal.y * 0.65 + liquidNormal.x * 0.15, 0.0, 1.0)
    );
    vec3 liquidFresnelKey = vec3(0.65, 0.82, 1.0);
    vec3 liquidFresnelShadow = vec3(0.72, 0.64, 0.50);
    vec3 liquidFresnelAbsorption = vec3(0.76, 0.54, 0.34);
    if (aqueous > 0.5) liquidFresnelKey = vec3(0.18, 0.84, 1.0);
    if (aqueous > 0.5) {
      liquidFresnelShadow = vec3(1.0, 0.62, 0.36);
      liquidFresnelAbsorption = vec3(1.0, 0.42, 0.16);
    }
    else if (oily > 0.5) {
      liquidFresnelKey = vec3(1.0, 0.72, 0.28);
      liquidFresnelShadow = vec3(0.20, 0.28, 0.42);
      liquidFresnelAbsorption = vec3(0.18, 0.48, 1.0);
    } else if (corrosive > 0.5) {
      liquidFresnelKey = vec3(0.44, 1.0, 0.68);
      liquidFresnelShadow = vec3(0.72, 0.38, 0.62);
      liquidFresnelAbsorption = vec3(0.82, 0.20, 0.66);
    } else if (cryogenic > 0.5) {
      liquidFresnelKey = vec3(0.62, 0.90, 1.0);
      liquidFresnelShadow = vec3(0.78, 0.86, 1.0);
      liquidFresnelAbsorption = vec3(1.0, 0.50, 0.26);
    } else if (metallicLiquid > 0.5) {
      liquidFresnelKey = vec3(1.0, 0.98, 0.94);
      liquidFresnelShadow = vec3(0.58, 0.62, 0.70);
      liquidFresnelAbsorption = vec3(0.58, 0.62, 0.70);
    } else if (viscousLiquid > 0.5) {
      liquidFresnelKey = vec3(0.82, 0.92, 1.0);
      liquidFresnelShadow = vec3(0.70, 0.64, 0.58);
      liquidFresnelAbsorption = vec3(0.85, 0.60, 0.35);
    }
    // Split the connected air-facing shell into a reflected outer lip and a
    // deeper absorption shoulder. Both are derived from the existing Hermite
    // density and slope, so the meniscus remains stable at rest and adds no
    // sampler, field, pass, or output-scale allocation.
    vec2 liquidFresnelSlope = semanticSlope + volumeSlope;
    float liquidFresnelSlopeLength = length(liquidFresnelSlope);
    float liquidFresnelShell = smoothstep(0.08, 0.46, liquidSurfaceDensity)
      * (1.0 - smoothstep(0.54, 0.92, liquidSurfaceDensity));
    float liquidFresnelContour = liquidFresnelShell
      * (1.0 - smoothstep(0.42, 0.78, liquidSurfaceDensity) * 0.42);
    float liquidFresnelInnerContour = liquidFresnelShell
      * smoothstep(0.36, 0.70, liquidSurfaceDensity);
    float liquidFresnelDirectional = liquidFresnelSlopeLength > 0.0001
      ? dot(liquidFresnelSlope / liquidFresnelSlopeLength, normalize(vec2(-0.58, -0.815)))
      : 0.0;
    float liquidFresnelGrazing = 1.0 - abs(liquidFresnelDirectional);
    float liquidFresnelReflection = liquidFresnelContour
      * (0.032 + liquidFresnelGrazing * 0.042);
    float liquidFresnelKeyResponse = max(0.0, liquidFresnelDirectional)
      * liquidFresnelContour * 0.080 + liquidFresnelReflection;
    float liquidFresnelShadowResponse = max(0.0, -liquidFresnelDirectional)
      * liquidFresnelContour * 0.024;
    float liquidFresnelTransmissionResponse = max(0.0, liquidFresnelDirectional)
      * liquidFresnelInnerContour * 0.018;
    float liquidFresnelAbsorptionResponse = liquidFresnelInnerContour
      * (0.014 + max(0.0, -liquidFresnelDirectional) * 0.030);
    // An empty reconstructed fringe has no semantic material/optics byte, so it
    // cannot safely distinguish Lava from an ordinary liquid. Preserve that
    // fringe's geometry but shade only authoritative liquid fragments here.
    float liquidFresnelGate = (1.0 - liquidOnly) * (1.0 - molten)
      * step(1.5, shape.w) * uSurfaceContourLighting;
    float liquidEdgeHalfWidth = mix(
      0.13, 0.17, clamp(length(volumeSlope) * 2.4, 0.0, 1.0)
    );
    float liquidSilhouetteDensity = volume;
    // Semantic density previously won every liquid fringe through max(density,
    // liquidDensity). Replace only an ordinary connected liquid-air contour
    // with a bounded move toward the existing species-aware field. Adjacent
    // cardinal support rejects isolated droplets while allowing slight cohesion
    // on connected sparse strands; the exact contact markers above reject unlike
    // liquids and non-liquid matter without another fetch. The target never
    // exceeds the old density, and a semantic cell centre remains authoritative.
    if (uLiquidSilhouetteCohesion > 0.5 && liquidOnly < 0.5 && halo < 0.5
      && family == 2.0 && wall < 0.5 && traits < 0.5 && !materialEmissive
      && molten < 0.5 && foreignMatterContact < 0.5 && unlikeMaterialContact < 0.5
      && density > 0.08 && density < 0.92) {
      float liquidAirContour = adjacentLiquidSupport * exposedLiquidSide;
      float connectedFieldDensity = min(
        volume, max(density * 0.65, min(liquidDensity, liquidNeighbourMean) * 0.45)
      );
      liquidSilhouetteDensity = mix(
        volume, connectedFieldDensity, liquidAirContour * 0.86
      );
    }
    alpha = smoothstep(
      0.48 - liquidEdgeHalfWidth, 0.48 + liquidEdgeHalfWidth, liquidSilhouetteDensity
    ) * mix(0.56, 0.82, liquidDepth);
    color = liquidBase * mix(1.24, depthTransmission, liquidDepth)
      * liquidDiffuse * mix(1.0, liquidBodyExposure, liquidDepth);
    // The normal bends reflection across unlike liquids; this small signed
    // body term keeps the same meniscus readable at ordinary zoom. It mirrors
    // Canvas and remains well below a dark separator or emissive highlight.
    color *= 1.0 + liquidMacroRelief + liquidInterfaceRelief;
    float liquidFresnelStrength = liquidFresnelGate
      * (liquidFresnelKeyResponse + liquidFresnelTransmissionResponse)
      * 0.75 * (1.0 + aqueous * 0.65 + oily * 0.35 + cryogenic * 0.25
        + metallicLiquid * 0.40 + viscousLiquid * 0.10);
    color += (vec3(1.0) - clamp(color, 0.0, 1.0))
      * liquidFresnelKey * liquidFresnelStrength;
    color += mix(reflectedEnvironment, edgeTint, 0.42)
      * liquidFresnelStrength * (0.18 + oily * 0.04);
    color -= color * liquidFresnelGate * (
      liquidFresnelShadow * liquidFresnelShadowResponse
      + liquidFresnelAbsorption * liquidFresnelAbsorptionResponse
    );
    color *= 1.0 + topLip * 0.08 - lowerShade * 0.05;
    color += mix(vec3(0.52, 0.68, 0.76), liquidBase, 0.50)
      * (broadSheen * mix(0.016, 0.052 * gloss, liquidDepth) + caustic * causticStrength);
    color += liquidBase * (0.025 + atmosphere * 0.030) + vec3(0.055, 0.090, 0.105) * rim;
    // Family-coloured absorption and reflection make one cohesive liquid body
    // read as volume instead of a hue-neutral cut-out. All inputs above are
    // already live for body lighting; this adds arithmetic only and cannot
    // change alpha, reconstruction support, species ownership, or refraction.
    if (uLiquidVolumeChroma > 0.5 && liquidOnly < 0.5 && halo < 0.5
      && wall < 0.5 && family == 2.0 && traits < 0.5 && !materialEmissive
      && molten < 0.5 && foreignMatterContact < 0.5 && unlikeMaterialContact < 0.5
      && liquidDepth > 0.38 && liquidNeighbourMean > 0.48) {
      // The species field supplies a wider interface band than the exact
      // categorical contact flag. Keep that entire mixing meniscus neutral so
      // adjacent family keys cannot flicker as either liquid moves by one cell.
      if (dot(liquidSpeciesSlope, liquidSpeciesSlope) < 0.0025) {
        float liquidVolumeChroma = liquidVolumeChromaResponse(
          liquidDepth, volumeSlope, liquidDensity, liquidNeighbourMean, liquidMacroRelief
        );
        color = applyLiquidVolumeChroma(
          color, liquidVolumeChroma, optics, liquidOpticalDepth
        );
      }
    }
    // Fourteen unusual/radioactive liquids retain a world-anchored material signature
    // after generic body optics. The authoritative semantic fragment is the
    // only owner: reconstructed support, walls, halos, and emissive projections
    // remain exact. This changes RGB only and adds no sample or resource.
    if (uLiquidIdentityStyling > 0.5 && liquidOnly < 0.5 && halo < 0.5
      && surfaceOnly < 0.5 && wall < 0.5 && emissionOnly < 0.5
      && family == 2.0 && !materialEmissive
      && (material == 38.0 || (material >= 54.0 && material <= 57.0)
        || (material >= 59.0 && material <= 62.0)
        || material == 100.0 || material == 102.0
        || material == 104.0 || material == 202.0 || material == 207.0)) {
      color += liquidMaterialIdentityDelta(
        material, fieldPosition, liquidSurfaceDensity, liquidDepth,
        semanticSlope + volumeSlope
      ) * uLiquidIdentityStyling;
    }
    if (uDeutStateStyling > 0.5 && material == 100.0
      && liquidOnly < 0.5 && halo < 0.5 && surfaceOnly < 0.5
      && wall < 0.5 && emissionOnly < 0.5 && family == 2.0 && !materialEmissive) {
      color += deutStateDelta(material, wallState.ba, fieldPosition);
    }
  } else {
    float powderVisualCohesion = 0.0;
    float powderChromaCohesion = 0.0;
    float powderMacroRelief = 0.0;
    float powderBodyChroma = 0.0;
    float powderSuspensionCohesion = 0.0;
    float roughSurface = granularOptics(optics);
    float smoothSurface = optics == 8.0 || optics == 19.0 ? 1.0 : 0.0;
    float organicSurface = optics == 9.0 ? 1.0 : 0.0;
    float deviceSurface = optics == 10.0 ? 1.0 : 0.0;
    float radioactiveSurface = optics == 11.0 ? 1.0 : 0.0;
    float translucentSurface = optics == 12.0 ? 1.0 : 0.0;
    float cellularSurface = optics == 19.0 ? 1.0 : 0.0;
    if (family == 4.0 && granularOptics(optics) > 0.5
      && traits < 0.5 && !materialEmissive) {
      float suspensionColorDistance = length(suspensionState.rgb - paletteSample.rgb);
      powderSuspensionCohesion = smoothstep(0.05, 0.62, suspensionState.a)
        * (1.0 - smoothstep(0.08, 0.24, suspensionColorDistance));
    }
    float interiorMicroGain = mix(1.0, solidInteriorMicroGain(optics, profile), solidInterior);
    // The bilinear solid field peaks below one for isolated and one-cell-thick
    // semantic strokes. Use a wider iso shoulder so those cells
    // remain visibly brush-sized while the same density field rounds chunk
    // boundaries; rejected empty-space support still has zero density.
    float edgeCenter = 0.42 + (family == 4.0 ? grain * 0.045 : 0.0);
    float edgeHalfWidth = mix(0.13, 0.17, clamp(length(shape.yz) * 0.75, 0.0, 1.0));
    alpha = smoothstep(edgeCenter - edgeHalfWidth, edgeCenter + edgeHalfWidth, density);
    float solidDepth = smoothstep(0.34, 0.94, density);
    vec3 solidLightDirection = normalize(vec3(-0.48, -0.68, 0.78));
    vec3 solidFillDirection = normalize(vec3(0.62, 0.24, 0.72));
    float solidKey = max(0.0, dot(normal, solidLightDirection));
    float solidFill = max(0.0, dot(normal, solidFillDirection));
    float solidDiffuse = 0.51 + solidKey * 0.58 + solidFill * 0.11;
    color = base * mix(1.10, 0.82, solidDepth) * solidDiffuse;
    if (uSolidOpticalDepth > 0.5 && solidOpticalDepth > 6.0 / 255.0
      && solidInterior > 0.001) {
      float linearThickness = clamp(
        (solidOpticalDepth * 255.0 - 6.0) / 249.0, 0.0, 1.0
      );
      float shapedThickness = linearThickness * (1.4 - linearThickness * 0.4);
      float thicknessGain = 16.0;
      vec3 thicknessAbsorption = vec3(0.88, 0.80, 0.68);
      if (optics == 8.0 || optics == 19.0) {
        thicknessGain = 23.0;
        thicknessAbsorption = vec3(0.94, 0.84, 0.70);
      } else if (optics == 9.0) {
        thicknessGain = 18.0;
        thicknessAbsorption = vec3(0.94, 0.72, 0.96);
      } else if (optics == 10.0) {
        thicknessGain = 25.0;
        thicknessAbsorption = vec3(1.00, 0.84, 0.62);
      } else if (optics == 11.0) {
        thicknessGain = 21.0;
        thicknessAbsorption = vec3(0.96, 0.62, 0.92);
      } else if (optics == 12.0) {
        thicknessGain = 13.0;
        thicknessAbsorption = vec3(1.00, 0.78, 0.54);
      }
      color *= vec3(1.0) - thicknessAbsorption
        * (thicknessGain / 255.0 * shapedThickness * solidInterior);
    }
    // Replace the old neutral macro-height band with a family-coloured crown
    // reflection and pocket absorption. This reuses the existing relief and
    // exact-species depth byte, changes RGB only, and adds no sample or target.
    // The first interior layer and reconstructed cavity support remain exact.
    if (uSolidOpticalDepth > 0.5 && solidOpticalDepth > 6.0 / 255.0
      && solidInterior > 0.001 && surfaceOnly < 0.5) {
      float macroStrength = solidReliefParameters(optics, profile).z;
      if (macroStrength > 0.0) {
        float macroDepth = smoothstep(6.0 / 255.0, 42.0 / 255.0, solidOpticalDepth);
        float macroResponse = clamp(
          solidReliefTone * 255.0 / macroStrength, -1.0, 1.0
        ) * macroDepth;
        float macroGain = solidBodyMacroGain(optics);
        if (macroResponse > 0.0) {
          color += (vec3(1.0) - clamp(color, 0.0, 1.0))
            * solidBodyMacroKey(optics) * macroResponse * macroGain * 0.55;
        } else {
          color *= vec3(1.0) - solidBodyMacroShadow(optics)
            * (-macroResponse) * macroGain;
        }
      }
    }
    // Reuse the semantic Hermite normal as a small family-coloured key/fill
    // shell. Unlike-solid contacts retain a dense union, so no internal seam
    // enters the contour band. This changes RGB only and adds no field sample.
    if (family == 0.0 && surfaceOnly < 0.5 && traits < 0.5 && !materialEmissive) {
      float solidContourChroma = surfaceChromaResponse(density, shape.yz, optics)
        * uSurfaceContourLighting;
      color = applySurfaceChroma(color, solidContourChroma, optics);
    }
    // Give an authoritative opaque solid a coloured response to the shared
    // emission field. The contour may take one high-quality outward probe;
    // thick bodies always reuse the centre sample, relief, and optical depth
    // already required by the composed shader. True 8x therefore adds only
    // arithmetic. Alpha, support, and ownership never depend on this term.
    if (uSolidFieldLighting > 0.5 && family == 0.0 && halo < 0.5
      && surfaceOnly < 0.5 && wall < 0.5 && material != 3.0
      && !materialEmissive && optics != 12.0
      && emissionState.a > 0.002) {
      if (traits < 0.5 && density > 0.08 && density < 0.92) {
        float solidFieldContour = smoothstep(0.08, 0.46, density)
          * (1.0 - smoothstep(0.54, 0.92, density));
        float solidFieldNormalLength = length(normal.xy);
        if (solidFieldContour > 0.0 && solidFieldNormalLength > 0.0001) {
          float solidFieldIncidence = 0.0;
          vec3 solidFieldColor = emissionState.rgb;
          if (uHighQuality > 0.5) {
            vec2 solidOutward = normal.xy / solidFieldNormalLength;
            vec4 outwardEmission = texture(
              uEmissionTexture, fieldUv + solidOutward * uEmissionTexel * 2.0
            );
            float outwardReach = smoothstep(0.002, 0.42, outwardEmission.a);
            float outwardIncidence = smoothstep(
              0.0, 0.12, outwardEmission.a - emissionState.a
            );
            solidFieldIncidence = outwardReach * outwardIncidence * 0.12;
            if (outwardEmission.a > emissionState.a) solidFieldColor = outwardEmission.rgb;
          } else {
            float solidFieldReach = smoothstep(0.002, 0.42, emissionState.a);
            solidFieldIncidence = solidFieldReach
              * mix(0.030, 0.050, clamp(solidFieldNormalLength * 1.6, 0.0, 1.0));
          }
          float solidFieldResponse = solidFieldContour * solidFieldIncidence;
          color += (vec3(1.0) - clamp(color, 0.0, 1.0))
            * vividColor(solidFieldColor, 1.10) * solidFieldResponse;
        }
      }
      if (solidInterior > 0.001 && solidOpticalDepth > 6.0 / 255.0
        && granularOptics(optics) < 0.5 && solidBodyFieldTraitEligibility(traits) > 0.5) {
        float bodyExposure = solidBodyFieldExposure(
          optics, profile, solidOpticalDepth, solidReliefTone
        );
        float bodyFieldResponse = min(
          12.0 / 255.0,
          emissionState.a * surfaceLightGain(profile) * bodyExposure
        );
        color += (vec3(1.0) - clamp(color, 0.0, 1.0))
          * vividColor(emissionState.rgb, 1.08) * bodyFieldResponse;
      }
    }
    if (!materialEmissive && surfaceOnly < 0.5) {
      float curvatureResponse = clamp(
        contourCurvature * 0.045 * solidCurvatureGain(optics, profile), -0.045, 0.045
      ) * uSolidCurvatureDepth;
      color *= 1.0 + curvatureResponse;
    }
    float solidContactTone = family == 0.0 && surfaceOnly < 0.5
      ? clamp(shape.w * 0.072, -0.060, 0.070) * uSolidContactDepth : 0.0;
    color *= 1.0 + solidContactTone;
    float solidSpecularGain = 0.28 - roughSurface * 0.13 + smoothSurface * 0.22
      + organicSurface * 0.02 + deviceSurface * 0.15 + radioactiveSurface * 0.06
      + translucentSurface * 0.30;
    vec3 solidSpecularTint = mix(
      vec3(0.12), vec3(0.16, 0.24, 0.32), smoothSurface * 0.32 + deviceSurface * 0.58
    );
    solidSpecularTint = mix(solidSpecularTint, vec3(0.12, 0.24, 0.14), radioactiveSurface * 0.28);
    solidSpecularTint = mix(
      solidSpecularTint, vec3(0.30, 0.50, 0.62), translucentSurface * 0.64
    );
    float broadSolidSpecular = pow(
      max(0.0, dot(normal, normalize(vec3(-0.34, -0.50, 0.80)))),
      mix(7.0, 4.0, clamp(smoothSurface + deviceSurface * 0.65 + translucentSurface * 0.92, 0.0, 1.0))
    );
    float solidFresnel = pow(1.0 - clamp(normal.z, 0.0, 1.0), 2.0);
    vec3 solidEnvironment = mix(
      vec3(0.035, 0.055, 0.080), vec3(0.10, 0.070, 0.040),
      clamp(0.48 - normal.y * 0.55 + normal.x * 0.12, 0.0, 1.0)
    );
    color += solidSpecularTint
      * (specular * solidSpecularGain + broadSolidSpecular * (0.035 + smoothSurface * 0.055));
    color += solidEnvironment * solidFresnel
      * (0.12 + smoothSurface * 0.24 + deviceSurface * 0.16
        + radioactiveSurface * 0.08 + translucentSurface * 0.40);
    color = mix(
      color,
      color * vec3(0.88, 0.97, 1.08) + solidEnvironment * (0.16 + solidFresnel * 0.34),
      translucentSurface * mix(0.18, 0.34, solidDepth)
    );
    // Moving/loose powder stays a deterministic soft grain. The CPU-owned
    // stability field requires persistent low velocity and compatible contact,
    // with a hold band between settle and release thresholds. This keeps noisy
    // TPT velocity samples from flipping the boundary mode every frame.
    if (family == 4.0) {
      float powderContact = smoothstep(1.55, 2.85, shape.w);
      float localPowderContact = smoothstep(1.55, 2.85, localPowderShape.w);
      powderContact = max(powderContact, localPowderContact);
      float powderBulk = powderContact * boundaryStability;
      if (uPowderStyle > 1.5 && surfaceOnly < 0.5 && traits < 0.5 && !materialEmissive) {
        powderChromaCohesion = powderBulkDepth
          * smoothstep(0.75, 1.0, boundaryStability);
        powderVisualCohesion = powderChromaCohesion
          * smoothstep(0.55, 0.85, widePowderShape.x);
        float powderDirectedSlope = clamp(
          widePowderShape.y * -2.20 + widePowderShape.z * -3.20, -1.0, 1.0
        );
        float powderDirectedRelief = powderDirectedSlope < 0.0
          ? powderDirectedSlope * 0.070
          : powderDirectedSlope * 0.080;
        powderMacroRelief = powderDirectedRelief * powderVisualCohesion;
        // Stable two-dimensional bulk gets a coherent family-aware volume from the
        // existing powder field: upper-left key, opposing fill, and dense-core
        // absorption. Exact semantic depth and lateral support remain
        // authoritative, so narrow columns, ledges, holes, and moving grains
        // cannot acquire or lose display support here.
        float powderBodyGate = uPowderBodyDepth * powderBulkDepth
          * step(224.0 / 255.0, boundaryStability)
          * step(0.66, widePowderShape.x)
          * step(5.5, widePowderShape.w);
        float powderBodyDensity = clamp(
          (widePowderShape.x - 0.66) * 2.94117647, 0.0, 1.0
        );
        float powderBodySupportDepth = clamp((widePowderShape.w - 5.5) / 3.5, 0.0, 1.0);
        float powderBodyVolumeDepth = max(
          powderBodyDensity, powderBodySupportDepth * 0.88
        );
        float powderBodyDepthTone = mix(0.030, -0.052, powderBodyVolumeDepth);
        float powderBodyDirectionalGain = mix(0.060, 0.045, powderBodyVolumeDepth);
        powderBodyChroma = clamp(
          powderDirectedSlope * powderBodyDirectionalGain + powderBodyDepthTone,
          -0.080, 0.085
        ) * powderBodyGate * (optics == 13.0 ? 0.98
          : (optics == 14.0 ? 0.58 : (optics == 15.0 ? 1.08 : 1.0)));
      }
      float grainOffsetY = fract(sin(dot(floor(fieldPosition), vec2(39.346, 11.135))) * 24634.6345) - 0.5;
      vec2 grainCentre = vec2(grain, grainOffsetY) * 0.075;
      float grainDistance = length(fract(fieldPosition) - 0.5 - grainCentre);
      float roundGrainAlpha = 1.0 - smoothstep(0.34, 0.56, grainDistance);
      float heapStart = mix(0.10 + grain * 0.020, 0.40 + grain * 0.012, powderSurfaceBlend);
      float heapEnd = mix(0.62 + grain * 0.030, 0.60 + grain * 0.018, powderSurfaceBlend);
      float heapAlpha = smoothstep(heapStart, heapEnd, density);
      float localHeapAlpha = smoothstep(
        0.10 + grain * 0.020, 0.62 + grain * 0.030, localPowderShape.x
      );
      if (surfaceOnly < 0.5) heapAlpha = max(heapAlpha, localHeapAlpha * 0.40);
      if (uPowderStyle < 0.5) {
        // Grains is the exact unsmoothed reference: one semantic cell becomes
        // one square pixel-cell, with no empty-side reconstruction.
        alpha = surfaceOnly > 0.5 ? 0.0 : 1.0;
      } else {
        alpha = surfaceOnly > 0.5
          ? heapAlpha * boundaryStability * smoothstep(2.5, 4.0, shape.w)
          : mix(roundGrainAlpha, heapAlpha, powderBulk);
      }
    }
    // surfaceOnly names a nearby exact solid, but density is nonzero only when
    // enclosedSurfaceShape proved the cavity. Decouple that conservative shape
    // confidence from display opacity so accepted support joins the chunk while
    // rejected notches, seams, powders, walls, and borders remain transparent.
    if (surfaceOnly > 0.5 && family == 0.0 && density > 0.001) {
      float cavityConfidence = smoothstep(0.30, 0.92, density);
      alpha = max(alpha, mix(0.90, 0.98, cavityConfidence));
    }
    // Native LIFE topology is the automaton state itself. Nearby live cells may
    // smooth their own contours, but presentation must never resurrect a dead
    // semantic cell as generic solid cavity support.
    if (cellularSurface > 0.5 && surfaceOnly > 0.5) alpha = 0.0;
    if (translucentSurface > 0.5) {
      float exactPrismatic = (material == 12.0 || material == 24.0) ? 1.0 : 0.0;
      float prismGain = material == 24.0 ? 1.0 : -0.42;
      float prism = solidReliefTone * prismGain * exactPrismatic
        * (1.0 - surfaceOnly) * uSolidContactDepth;
      color += vec3(1.0, -0.176, -1.20) * prism;
      color += solidSpecularTint * max(solidContactTone, 0.0) * 0.24;
      if (uTranslucentLensShell > 0.5 && (material == 12.0 || material == 24.0)
        && !materialEmissive && traits < 0.5 && surfaceOnly < 0.5) {
        float shellRim = (1.0 - solidDepth) * 0.030 + solidFresnel * 0.055;
        if (material == 24.0) {
          float crown = max(solidReliefTone, 0.0);
          float valley = max(-solidReliefTone, 0.0);
          color *= 1.0 - solidDepth * 0.010 - valley * 0.70;
          color += vec3(0.45, 0.78, 1.0) * (shellRim + crown * 1.50);
        } else {
          float frostedRidge = abs(solidReliefTone) * 0.70;
          color *= 1.0 - solidDepth * 0.018 - abs(solidReliefTone) * 0.24;
          color += vec3(0.58, 0.86, 1.0) * (shellRim * 0.72 + frostedRidge);
        }
      }
      float translucentAlpha = (material == 12.0 || material == 24.0)
        ? mix(0.62, 0.76, solidDepth) : mix(0.74, 0.88, solidDepth);
      alpha *= translucentAlpha;
      if (uTranslucentFieldTransmission > 0.5 && !materialEmissive
        && solidInterior > 0.01 && emissionState.a > 0.002) {
        // Dense glass carries existing coloured scene light through its body.
        // Reuse the already sampled emission field and screen-blend in place;
        // support, alpha, ownership, texture count, and pass count are unchanged.
        float transmittedReach = smoothstep(0.002, 0.42, emissionState.a);
        float transmittedWeight = solidInterior * mix(0.10, 0.17, solidDepth);
        vec3 transmissionTint = material == 12.0
          ? vec3(0.88, 1.02, 1.12) : vec3(1.0);
        vec3 transmittedLight = emissionState.rgb * transmissionTint
          * transmittedReach * transmittedWeight;
        color += (vec3(1.0) - clamp(color, 0.0, 1.0)) * transmittedLight;
      }
    }
    if (roughSurface > 0.5 || (optics < 0.5 && profile == 1.0)) {
      vec2 subcell = floor(fract(fieldPosition) * 2.0);
      float grainFacet = fract(sin(dot(floor(fieldPosition) * 2.0 + subcell, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      float facetGain = optics == 13.0 ? 1.12
        : (optics == 14.0 ? 0.35 : (optics == 15.0 ? 0.90 : 1.0));
      float cellGrainRetention = mix(1.0, 0.28, powderVisualCohesion);
      float facetRetention = mix(1.0, 0.62, powderVisualCohesion);
      color *= 0.91 + grain * (0.20 + roughSurface * 0.05) * cellGrainRetention * facetGain
        + grainFacet * (0.10 + roughSurface * 0.04) * facetRetention * facetGain;
      color += base * max(0.0, 0.6 - subcell.x - subcell.y)
        * (0.11 + roughSurface * 0.035) * facetRetention * facetGain;
      float brightFacet = max(0.0, grainFacet - 0.18) * facetRetention;
      if (optics == 13.0) {
        color += vec3(0.52, 0.78, 1.00) * brightFacet * 0.085;
      } else if (optics == 14.0) {
        color *= 0.97;
      } else if (optics == 15.0) {
        color += vec3(1.00, 0.68, 0.32) * brightFacet * 0.060;
      }
      // Ten unusual native powders share the existing deterministic grain and
      // half-cell facet signals, then select one small identity motif. The
      // branch is authoritative-matter RGB arithmetic only: it adds no sample,
      // field, pass, allocation, clock term, or output-scale resource.
      float unusualPowder = material == 43.0 || material == 44.0
        || material == 45.0 || material == 46.0 || material == 47.0
        || material == 48.0 || material == 49.0 || material == 51.0
        || material == 198.0 || material == 217.0 ? 1.0 : 0.0;
      if (uUnusualPowderStyling > 0.5 && unusualPowder > 0.5
        && family == 4.0 && traits < 0.5 && !materialEmissive
        && surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5
        && wallOnly < 0.5 && emissionOnly < 0.5) {
        vec2 motifCell = floor(fieldPosition);
        float diagonalBand = 1.0 - step(
          1.0, mod(mod(motifCell.x + motifCell.y * 2.0, 7.0) + 7.0, 7.0)
        );
        float counterBand = 1.0 - step(
          1.0, mod(mod(motifCell.x * 2.0 - motifCell.y, 9.0) + 9.0, 9.0)
        );
        float coarseNode = 1.0 - step(
          1.0, mod(motifCell.x * 3.0 + motifCell.y * 5.0, 13.0)
        );
        if (material == 43.0) {
          // ANAR: pale feather shafts with restrained barbs.
          float feather = max(diagonalBand, counterBand * step(0.18, grain));
          color += vec3(0.052, 0.042, 0.025) * feather;
          color *= 1.0 - max(0.0, -grainFacet) * 0.028;
        } else if (material == 44.0) {
          // BGLA: cool angular glass splinters.
          float splinter = max(diagonalBand, counterBand) * step(-0.12, grainFacet);
          color += vec3(0.025, 0.052, 0.070) * splinter;
          color *= 1.0 - counterBand * step(grainFacet, -0.22) * 0.035;
        } else if (material == 45.0) {
          // BREC: dark PCB fragments crossed by copper traces and pads.
          float pcbTrace = max(
            1.0 - step(1.0, mod(motifCell.x, 6.0)),
            1.0 - step(1.0, mod(motifCell.y + 3.0, 7.0))
          );
          color *= 1.0 - pcbTrace * 0.040;
          color += vec3(0.080, 0.038, 0.010) * max(pcbTrace, coarseNode);
        } else if (material == 46.0) {
          // BRMT: oxidized plates with dark seams and muted patina.
          float plateSeam = max(
            1.0 - step(1.0, mod(motifCell.x + 2.0, 8.0)),
            1.0 - step(1.0, mod(motifCell.y + 4.0, 6.0))
          );
          color *= 1.0 - plateSeam * 0.060;
          color += vec3(0.014, 0.044, 0.035) * step(0.12, grain);
        } else if (material == 47.0) {
          // FRZZ: compact frost stars cut into the loose crystal field.
          vec2 frostCell = abs(mod(motifCell + vec2(3.0), 7.0) - 3.0);
          float frostStar = max(
            1.0 - step(0.5, min(frostCell.x, frostCell.y)),
            1.0 - step(0.5, abs(frostCell.x - frostCell.y))
          ) * (1.0 - step(3.1, max(frostCell.x, frostCell.y)));
          color += vec3(0.016, 0.026, 0.034) * frostStar;
        } else if (material == 48.0) {
          // GRAV: bands align to the already sampled particle velocity.
          vec2 gravDirection = length(velocity) > 0.08
            ? normalize(velocity) : vec2(0.70710678, -0.70710678);
          float gravBand = 1.0 - step(
            1.25, mod(mod(dot(motifCell, gravDirection) + 32.0, 6.0) + 6.0, 6.0)
          );
          color += vec3(0.055, 0.032, 0.072) * gravBand;
        } else if (material == 49.0) {
          // SAWD: warm fibres run in staggered longitudinal bundles.
          float fibre = 1.0 - step(
            1.0, mod(motifCell.x + floor(motifCell.y * 0.25) * 2.0, 9.0)
          );
          color += vec3(0.062, 0.030, 0.008) * fibre;
          color *= 1.0 + grainFacet * 0.022;
        } else if (material == 51.0) {
          // SLCN: crossed cleavage planes catch a cold edge light.
          float cleavage = max(diagonalBand, counterBand * step(0.0, grainFacet));
          color += vec3(0.030, 0.050, 0.075) * cleavage;
          color *= 1.0 - coarseNode * 0.028;
        } else if (material == 198.0) {
          // DYST: dead-colony clumps retain sparse ochre islands.
          float clump = step(0.08, grain) * step(-0.10, grainFacet);
          color *= 1.0 - (1.0 - clump) * 0.038;
          color += vec3(0.036, 0.028, 0.009) * clump * max(coarseNode, diagonalBand);
        } else {
          // BCOL: fractured carbon with sparse warm mineral inclusions.
          float fracture = max(diagonalBand, counterBand);
          float inclusion = coarseNode * step(0.10, grainFacet);
          color *= 1.0 - fracture * 0.055;
          color += vec3(0.090, 0.038, 0.010) * inclusion;
        }
        color = clamp(color, 0.0, 1.0);
      }
      // Fourteen native explosive powders retain the same semantic/powder
      // topology but receive stable identity marks. This is arithmetic-only
      // RGB work: no sample, field, clock, pass, or output-scale resource.
      float explosiveStyle = 0.0;
      float explosiveFamily = 0.0;
      vec3 explosiveKey = vec3(0.0);
      if (material == 14.0) {
        explosiveStyle = 1.0; explosiveFamily = 1.0;
        explosiveKey = vec3(8.0, 5.0, -4.0);
      } else if (material == 30.0) {
        explosiveStyle = 2.0; explosiveFamily = 5.0;
        explosiveKey = vec3(13.0, 3.0, -5.0);
      } else if (material == 31.0) {
        explosiveStyle = 3.0; explosiveFamily = 1.0;
        explosiveKey = vec3(5.0, 7.0, -3.0);
      } else if (material == 33.0) {
        explosiveStyle = 4.0; explosiveFamily = 2.0;
        explosiveKey = vec3(10.0, -2.0, 8.0);
      } else if (material == 84.0) {
        explosiveStyle = 5.0; explosiveFamily = 3.0;
        explosiveKey = vec3(12.0, -4.0, -3.0);
      } else if (material == 85.0) {
        explosiveStyle = 6.0; explosiveFamily = 3.0;
        explosiveKey = vec3(14.0, 7.0, -6.0);
      } else if (material == 86.0) {
        explosiveStyle = 7.0; explosiveFamily = 3.0;
        explosiveKey = vec3(-3.0, 4.0, 12.0);
      } else if (material == 88.0) {
        explosiveStyle = 8.0; explosiveFamily = 3.0;
        explosiveKey = vec3(14.0, -5.0, -6.0);
      } else if (material == 89.0) {
        explosiveStyle = 9.0; explosiveFamily = 2.0;
        explosiveKey = vec3(9.0, 2.0, 10.0);
      } else if (material == 90.0) {
        explosiveStyle = 10.0; explosiveFamily = 4.0;
        explosiveKey = vec3(4.0, 10.0, -3.0);
      } else if (material == 91.0) {
        explosiveStyle = 11.0; explosiveFamily = 4.0;
        explosiveKey = vec3(-2.0, 9.0, -4.0);
      } else if (material == 92.0) {
        explosiveStyle = 12.0; explosiveFamily = 4.0;
        explosiveKey = vec3(11.0, 6.0, -5.0);
      } else if (material == 94.0) {
        explosiveStyle = 13.0; explosiveFamily = 5.0;
        explosiveKey = vec3(8.0, 1.0, 6.0);
      } else if (material == 96.0) {
        explosiveStyle = 14.0; explosiveFamily = 5.0;
        explosiveKey = vec3(6.0, 4.0, 8.0);
      }
      if (uExplosivePowderStyling > 0.5 && explosiveStyle > 0.5
        && family == 4.0 && traits < 0.5 && !materialEmissive
        && surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5
        && wallOnly < 0.5 && emissionOnly < 0.5) {
        vec2 explosiveCell = floor(fieldPosition);
        float materialRemainder = mod(mod(
          explosiveCell.x * 3.0 + explosiveCell.y * 5.0 + explosiveStyle * 7.0,
          13.0
        ) + 13.0, 13.0);
        float crossRemainder = mod(mod(
          explosiveCell.x * 7.0 - explosiveCell.y * 2.0 + explosiveStyle * 3.0,
          17.0
        ) + 17.0, 17.0);
        float familyDivisor = 7.0 + explosiveFamily;
        float familyCoordinate = explosiveCell.x * (explosiveFamily + 1.0)
          + explosiveCell.y * (6.0 - explosiveFamily) + explosiveFamily * 3.0;
        float familyRemainder = mod(mod(familyCoordinate, familyDivisor)
          + familyDivisor, familyDivisor);
        float materialMark = 1.0 - step(1.0, materialRemainder);
        float crossMark = 1.0 - step(1.0, crossRemainder);
        float familyLimit = explosiveFamily == 2.0 ? 2.0 : 1.0;
        float familyMark = 1.0 - step(familyLimit, familyRemainder);
        float explosiveGain = materialMark > 0.5 ? 1.0
          : (crossMark > 0.5 ? 0.68 : (familyMark > 0.5 ? 0.38 : 0.14));
        color = clamp(color + explosiveKey * (explosiveGain / 255.0), 0.0, 1.0);
      }
      color *= 1.0 + powderMacroRelief;
      float powderContourChroma = localPowderShape.x < 0.92
        ? surfaceChromaResponse(density, widePowderShape.yz, optics)
          * powderChromaCohesion * uSurfaceContourLighting
        : 0.0;
      color = applySurfaceChroma(
        color, clamp(powderContourChroma + powderBodyChroma, -0.085, 0.090), optics
      );
    } else if (cellularSurface > 0.5) {
      // Static ctype-derived colony motifs distinguish all 24 native LIFE
      // presets without inventing age/state or changing semantic support.
      if (uCellularMaterialStyling > 0.5 && surfaceOnly < 0.5) {
        float preset = material - 171.0;
        float motif = mod(preset, 4.0);
        float period = 3.0 + mod(floor(preset / 4.0), 4.0);
        float phase = mod(preset * 5.0 + floor(preset / 16.0) * 3.0, period);
        vec2 cellularCell = floor(fieldPosition);
        float coordinate = motif < 0.5 ? cellularCell.x + cellularCell.y
          : (motif < 1.5 ? cellularCell.x + floor(cellularCell.y * 0.5)
          : (motif < 2.5 ? cellularCell.x * 2.0 + cellularCell.y * 3.0
          : cellularCell.x - cellularCell.y));
        float bandWidth = 1.0 + floor(preset / 16.0);
        float band = 1.0 - step(bandWidth, mod(mod(coordinate + phase, period) + period, period));
        float nodePeriod = 11.0 + mod(preset, 3.0);
        float node = 1.0 - step(
          0.5, mod(cellularCell.x * 3.0 + cellularCell.y * 5.0 + preset * 7.0, nodePeriod)
        );
        float scalar = mix(
          2.0 + mod(preset, 2.0),
          -4.0 - mod(floor(preset / 4.0), 2.0) * 2.0,
          band
        ) + node * mix(2.0, -2.0, band);
        vec3 cellularDelta = vec3(scalar);
        if (motif < 0.5) cellularDelta += vec3(0.0, -band * 2.0, node * 2.0);
        else if (motif < 1.5) cellularDelta += vec3(-band * 2.0, 0.0, band);
        else if (motif < 2.5) cellularDelta += vec3(band, node * 2.0, 0.0);
        else cellularDelta += vec3(0.0, -node, -band * 2.0);
        color = clamp(color + cellularDelta / 255.0, 0.0, 1.0);
      }
    } else if (smoothSurface > 0.5 || translucentSurface > 0.5
      || (optics < 0.5 && profile == 2.0)) {
      float bevel = clamp(abs(shape.y) + abs(shape.z), 0.0, 1.0);
      float strata = sin(fieldPosition.x * 0.16 + fieldPosition.y * 0.055 + material * 0.71);
      color *= 0.965 + strata * 0.028 * interiorMicroGain;
      // Source embedded structure from the already lit/absorbed body rather
      // than the untouched palette. Strata and bevels now follow body depth,
      // scene light, contact shading, and specular response without another
      // signal, sample, or long-lived shader register.
      color += mix(color, vec3(0.32, 0.36, 0.42), 0.26)
        * bevel * (0.13 + smoothSurface * 0.07 + translucentSurface * 0.10);
    } else if (organicSurface > 0.5 || (optics < 0.5 && profile == 3.0)) {
      float fibre = sin(fieldPosition.x * 0.20 + sin(fieldPosition.y * 0.115 + material) * 1.45);
      float pores = sin(fieldPosition.x * 0.083 + fieldPosition.y * 0.157 + material * 0.37)
        * sin(fieldPosition.y * 0.091 - fieldPosition.x * 0.047);
      color *= 0.95 + (fibre * 0.042 + pores * 0.024
        + organicSurface * max(0.0, fibre) * 0.018) * interiorMicroGain;
      color += mix(color, vec3(0.19, 0.34, 0.18), 0.38)
        * organicSurface * max(0.0, 0.6 - abs(pores)) * 0.028 * interiorMicroGain;
    } else if (radioactiveSurface > 0.5 || (optics < 0.5 && profile == 4.0)) {
      float isotope = sin(fieldPosition.x * 0.137 + sin(fieldPosition.y * 0.103 + material) * 1.6)
        * sin(fieldPosition.y * 0.181 - fieldPosition.x * 0.061);
      float decayPulse = 0.5 + 0.5 * sin(uTime * 1.55 + material * 0.73 + isotope * 1.8);
      color *= 0.97 + isotope * 0.038 * interiorMicroGain + decayPulse * 0.012;
      color += vec3(0.10, 0.25, 0.13) * radioactiveSurface * decayPulse * 0.035;
    } else if (deviceSurface > 0.5 || (optics < 0.5 && profile == 5.0)) {
      vec2 circuitCell = abs(fract((fieldPosition + vec2(material * 0.37, material * 0.19)) / 8.0) - 0.5);
      float trace = max(1.0 - smoothstep(0.055, 0.105, circuitCell.x), 1.0 - smoothstep(0.055, 0.105, circuitCell.y));
      float node = 1.0 - smoothstep(0.10, 0.22, length(circuitCell));
      color *= 0.96 + trace * 0.025 * interiorMicroGain;
      color += mix(color, vec3(0.34, 0.76, 1.0), 0.58)
        * (trace * (0.12 + deviceSurface * 0.035) + node * (0.10 + deviceSurface * 0.045))
        * interiorMicroGain;
      // The seven native sensor bodies share one stable 24-cell instrument
      // bezel, while exact material IDs select a readable static glyph. This
      // branch is arithmetic-only and restricted to authoritative semantic
      // cells: reconstructed solid support must never acquire sensor identity.
      if (uSensorMaterialStyling > 0.5 && material >= 164.0 && material <= 170.0
        && surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5
        && wallOnly < 0.5 && emissionOnly < 0.5) {
        vec2 sensorTile = fract(fieldPosition / 24.0) - 0.5;
        vec2 sensorAbs = abs(sensorTile);
        float sensorRadius = length(sensorTile);
        float bezelDistance = abs(max(sensorAbs.x, sensorAbs.y) - 0.425);
        float sensorBezel = 1.0 - smoothstep(0.018, 0.040, bezelDistance);
        float sensorPanel = 1.0 - smoothstep(0.36, 0.405, max(sensorAbs.x, sensorAbs.y));
        float sensorGlyph = 0.0;
        vec3 sensorTint = vec3(0.34, 0.82, 1.00);
        if (material == 164.0) {
          // DTEC: crosshair.
          float crosshair = max(
            1.0 - smoothstep(0.020, 0.052, abs(sensorTile.x)),
            1.0 - smoothstep(0.020, 0.052, abs(sensorTile.y))
          ) * (1.0 - smoothstep(0.30, 0.36, sensorRadius));
          float crosshairRing = 1.0 - smoothstep(0.018, 0.042, abs(sensorRadius - 0.245));
          sensorGlyph = max(crosshair, crosshairRing);
          sensorTint = vec3(1.00, 0.48, 0.28);
        } else if (material == 165.0) {
          // INVIS: iris.
          float irisRing = 1.0 - smoothstep(0.020, 0.044, abs(sensorRadius - 0.245));
          float irisCore = 1.0 - smoothstep(0.075, 0.125, sensorRadius);
          float irisBlades = 1.0 - smoothstep(
            0.018, 0.052,
            abs(abs(sensorTile.x) - abs(sensorTile.y))
          );
          sensorGlyph = max(irisRing, max(irisCore, irisBlades * smoothstep(0.12, 0.29, sensorRadius)));
          sensorTint = vec3(0.62, 0.78, 1.00);
        } else if (material == 166.0) {
          // LDTC: scan lines and sweep.
          float scanLine = 1.0 - smoothstep(0.018, 0.050, abs(sensorTile.y));
          float scanRails = 1.0 - smoothstep(
            0.018, 0.048,
            abs(abs(sensorTile.y) - 0.18)
          );
          float scanSweep = 1.0 - smoothstep(
            0.018, 0.050,
            abs(sensorTile.x + sensorTile.y * 0.52)
          );
          sensorGlyph = max(scanLine, max(scanRails * (1.0 - smoothstep(0.30, 0.37, abs(sensorTile.x))), scanSweep));
          sensorTint = vec3(0.30, 1.00, 0.76);
        } else if (material == 167.0) {
          // LSNS: waveform.
          float waveform = sin((sensorTile.x + 0.5) * 18.8495559) * 0.145;
          sensorGlyph = (1.0 - smoothstep(0.020, 0.052, abs(sensorTile.y - waveform)))
            * (1.0 - smoothstep(0.34, 0.41, abs(sensorTile.x)));
          sensorTint = vec3(0.42, 1.00, 0.46);
        } else if (material == 168.0) {
          // PSNS: pressure rings.
          float pressureInner = 1.0 - smoothstep(0.018, 0.045, abs(sensorRadius - 0.145));
          float pressureOuter = 1.0 - smoothstep(0.018, 0.045, abs(sensorRadius - 0.285));
          sensorGlyph = max(pressureInner, pressureOuter);
          sensorTint = vec3(1.00, 0.74, 0.30);
        } else if (material == 169.0) {
          // TSNS: thermometer.
          float thermometerStem = (1.0 - smoothstep(0.022, 0.052, abs(sensorTile.x)))
            * smoothstep(-0.29, -0.21, sensorTile.y)
            * (1.0 - smoothstep(0.15, 0.23, sensorTile.y));
          float thermometerBulb = 1.0 - smoothstep(0.075, 0.125, length(sensorTile - vec2(0.0, 0.235)));
          float thermometerCap = 1.0 - smoothstep(0.030, 0.060, length(sensorTile - vec2(0.0, -0.235)));
          sensorGlyph = max(thermometerStem, max(thermometerBulb, thermometerCap));
          sensorTint = vec3(1.00, 0.38, 0.22);
        } else {
          // VSNS: vector arrow.
          float arrowShaft = (1.0 - smoothstep(0.020, 0.052, abs(sensorTile.y)))
            * smoothstep(-0.31, -0.25, sensorTile.x)
            * (1.0 - smoothstep(0.19, 0.25, sensorTile.x));
          float arrowHead = 1.0 - smoothstep(
            0.020, 0.052,
            abs(abs(sensorTile.y) - (0.34 - sensorTile.x))
          );
          arrowHead *= smoothstep(0.10, 0.18, sensorTile.x)
            * (1.0 - smoothstep(0.30, 0.37, sensorTile.x));
          sensorGlyph = max(arrowShaft, arrowHead);
          sensorTint = vec3(0.74, 0.58, 1.00);
        }
        color *= 1.0 - sensorPanel * 0.014 - sensorBezel * 0.036;
        color += sensorTint * (sensorBezel * 0.030 + sensorGlyph * 0.082);
        color = clamp(color, 0.0, 1.0);
      }
    } else if (profile == 6.0) {
      float planeWave = sin((fieldPosition.x + fieldPosition.y * 0.62) * 0.115 - uTime * 1.15 + material);
      float radialWave = sin(length(fieldPosition - vec2(material * 1.7)) * 0.14 + uTime * 0.92);
      float interference = (planeWave + radialWave) * 0.5;
      color *= 0.95 + interference * 0.045;
    }
    // Thirteen uncommon solids layer one static identity over the generic body
    // structure above. Only authoritative semantic matter participates; this
    // RGB arithmetic adds no sample, pass, field, allocation, clock term, or
    // output-scale resource, and leaves later trait decals independent.
    float unusualSolid = material == 27.0 || material == 68.0 || material == 74.0
      || material == 76.0 || material == 77.0 || material == 79.0
      || material == 80.0 || material == 196.0
      || material == 206.0 || material == 208.0 || material == 209.0
      || material == 210.0 || material == 216.0 ? 1.0 : 0.0;
    if (uUnusualSolidStyling > 0.5 && unusualSolid > 0.5
      && family == 0.0 && !materialEmissive
      && surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5
      && wallOnly < 0.5 && emissionOnly < 0.5) {
      vec2 solidCell = floor(fieldPosition);
      if (material == 27.0) {
        // WAX: crystalline blooms and cooling lamellae share MWAX's topology.
        color += waxFamilyIdentityDelta(0.0, fieldPosition);
      } else if (material == 68.0 || material == 74.0
        || material == 76.0 || material == 77.0) {
        // Cold/crystalline solids retain one exact, world-anchored mesostructure.
        color += crystallineSolidIdentityDelta(material, fieldPosition);
      } else if (material == 196.0) {
        // BIZRS: angular prismatic facets split cool and warm reflections.
        vec2 prismTile = abs(fract((fieldPosition + vec2(3.0, 1.0)) / 11.0) - 0.5);
        float prismEdge = 1.0 - smoothstep(
          0.025, 0.070, min(abs(prismTile.x - prismTile.y), abs(prismTile.x + prismTile.y - 0.5))
        );
        float prismFace = step(prismTile.y, prismTile.x);
        color += mix(vec3(0.018, 0.045, 0.070), vec3(0.070, 0.026, 0.052), prismFace)
          * prismEdge * mix(0.62, 1.0, solidDepth);
      } else if (material == 79.0 || material == 206.0) {
        // RSSS/PSTS: native solid products retain their liquid family's exact
        // topology while common solid depth and relief remain authoritative.
        color += pasteResistFamilyIdentityDelta(
          material == 206.0 ? 0.0 : 1.0, 0.0, fieldPosition
        );
      } else if (material == 80.0 || material == 208.0
        || material == 209.0 || material == 210.0) {
        // SHLD1-4: one coherent shell gains progressively nested armour bands.
        float shieldStage = material == 80.0 ? 1.0 : material - 206.0;
        vec2 shieldTile = abs(fract(fieldPosition / 24.0) - 0.5) * 2.0;
        float shieldRadius = max(shieldTile.x, shieldTile.y);
        float outerShell = 1.0 - smoothstep(0.025, 0.070, abs(shieldRadius - 0.82));
        float nestedShell = 1.0 - smoothstep(
          0.045, 0.105,
          abs(fract(shieldRadius * shieldStage + 0.18) - 0.5)
        );
        float shieldNode = (1.0 - step(1.0, mod(solidCell.x * 3.0 + solidCell.y * 5.0, 17.0)))
          * step(0.42, shieldRadius);
        float shellWeight = max(outerShell, nestedShell * mix(0.34, 0.82, shieldStage / 4.0));
        color *= 1.0 - shellWeight * mix(0.020, 0.052, shieldStage / 4.0);
        color += vec3(0.025, 0.052, 0.080) * shellWeight
          + vec3(0.060, 0.080, 0.095) * shieldNode * shieldStage * 0.012;
      } else {
        // VRSS: the same family capsid is carried by the rigid solid body.
        color += virusFamilyIdentityDelta(2.0, fieldPosition);
      }
      color = clamp(color, 0.0, 1.0);
    }
    if (uThermalMaterialStyling > 0.5 && !materialEmissive && traits < 0.5
      && material != 3.0 && (family == 0.0 || family == 4.0)) {
      // Scalar, RGB-only response: temperature cannot widen a contour, alter
      // phase ownership, or create an emissive aura. Reconstructed cavities use
      // the averaged temperature of their already-sampled compatible donors.
      float temperatureByte = floor(materialTemperature * 255.0 + 0.5);
      // Most matter rests in the ambient dead band. Skip all smoothstep and
      // optics dispatch work there, which matters at a 15M-fragment 8x frame.
      if (abs(temperatureByte - 11.0) > 1.0) {
        color += thermalMaterialTint(temperatureByte, optics);
      }
    }
  }
  // Ground unlike phases without adding a separator or widening either body.
  // Only an authoritative ordinary owner participates. Powder additionally
  // needs settled support and a contour style; Grains remains the exact visual
  // reference. Four existing semantic/style contact probes supply the signed
  // Hermite band, so true 8x gains arithmetic only, never another texture read.
  float phaseContactOwner = halo < 0.5 && surfaceOnly < 0.5 && wall < 0.5
    && traits < 0.5 && !materialEmissive && material != 3.0
    && (family == 0.0 || family == 2.0 || family == 4.0)
    ? 1.0 : 0.0;
  float stablePhaseContact = family == 4.0
    ? step(0.75, boundaryStability) * step(0.5, uPowderStyle) : 1.0;
  float phaseContactTone = clamp(
    phaseContactLight * (4.0 / 255.0), -6.0 / 255.0, 6.0 / 255.0
  ) * phaseContactOwner * stablePhaseContact * uPhaseContactLighting;
  color += vec3(phaseContactTone);
  // Static role accents cross phase boundaries without widening semantic
  // silhouettes. Empty-space volume reconstruction intentionally remains free
  // of role metadata because it no longer has an authoritative material ID.
  if (traits > 0.5 && halo < 0.5 && wallOnly < 0.5 && emissionOnly < 0.5
    && surfaceOnly < 0.5) {
    float emitter = traitFlag(traits, 1.0);
    float sink = traitFlag(traits, 2.0);
    float channel = traitFlag(traits, 4.0);
    float forceRole = traitFlag(traits, 8.0);
    float radioactive = traitFlag(traits, 16.0);
    float organic = traitFlag(traits, 32.0);
    float fibrous = traitFlag(traits, 64.0);
    float carrier = traitFlag(traits, 128.0);
    float traitEdge = 1.0 - smoothstep(0.58, 0.94, density);
    float roleWave = 0.5 + 0.5 * sin(
      dot(fieldPosition, vec2(0.137, 0.083)) + material * 0.619 - uTime * 0.92
    );
    if (uRoleMaterialStyling > 0.5 && emitter + sink + channel + forceRole > 0.5) {
      // One stable 24-cell mechanism glyph family replaces the former narrow,
      // animated backend-specific decals. It remains readable at fit view and
      // costs only branch-local arithmetic at true 8x.
      if (emitter + sink + forceRole > 0.5) {
        vec2 roleTile = fract(
          (fieldPosition + vec2(material * 3.0, material * 5.0)) / 24.0
        ) - 0.5;
        float roleRadius = length(roleTile);
        float core = 1.0 - smoothstep(0.12, 0.18, roleRadius);
        float ring = 1.0 - smoothstep(0.045, 0.075, abs(roleRadius - 0.31));
        if (emitter > 0.5) {
          color += vec3(1.0, 0.46, 0.13)
            * (0.012 + core * 0.058 + ring * 0.034) * (0.72 + traitEdge * 0.28);
        }
        if (sink > 0.5) {
          color *= 1.0 - core * 0.018;
          color += vec3(0.18, 0.55, 1.0)
            * (0.010 + core * 0.042 + ring * 0.040) * (0.72 + traitEdge * 0.28);
        }
        if (forceRole > 0.5) {
          float innerRing = 1.0 - smoothstep(0.040, 0.070, abs(roleRadius - 0.21));
          float outerRing = 1.0 - smoothstep(0.035, 0.065, abs(roleRadius - 0.39));
          color += vec3(0.16, 0.68, 1.0)
            * (0.010 + max(innerRing, outerRing) * 0.055) * (0.74 + traitEdge * 0.26);
        }
      }
      if (channel > 0.5) {
        float railCoordinate = abs(fract(
          (fieldPosition.x - fieldPosition.y + material * 2.0) / 14.0
        ) - 0.5);
        float rail = 1.0 - smoothstep(0.055, 0.13, railCoordinate);
        float nodePhase = fract((fieldPosition.x + fieldPosition.y + material) / 12.0);
        float node = rail * (1.0 - smoothstep(
          0.08, 0.18, min(nodePhase, 1.0 - nodePhase)
        ));
        color += vec3(0.32, 0.72, 1.0) * (0.008 + rail * 0.038 + node * 0.018);
      }
    }
    color += sourceTargetDelta(material, wallState.ba, fieldPosition)
      * uSourceTargetStyling;
    if (radioactive > 0.5 && energyCore < 0.5) {
      color += radioactiveBodyIdentityDelta(material, fieldPosition)
        * uEnergyIdentityStyling;
      color += vibrStateDelta(material, wallState.ba, fieldPosition)
        * uVibrStateStyling;
      float isotopeNoise = fract(sin(
        dot(floor(fieldPosition), vec2(12.9898, 78.233)) + material * 0.31
      ) * 43758.5453);
      float decay = step(0.90, isotopeNoise) * (0.55 + roleWave * 0.45);
      vec3 isotopeTint = mix(vec3(0.20, 0.72, 0.18), vec3(0.36, 0.82, 1.0), carrier);
      color += isotopeTint * (0.008 + decay * 0.034 + traitEdge * 0.010);
    }
    float botanicalIdentity = (material == 9.0 || material == 10.0 || material == 50.0
      || material == 52.0 || material == 83.0) ? 1.0 : 0.0;
    if (botanicalIdentity > 0.5 && uBotanicalIdentityStyling > 0.5) {
      color += botanicalIdentityDelta(material, fieldPosition);
    }
    float virusFamily = material == 62.0 || material == 215.0 || material == 216.0 ? 1.0 : 0.0;
    if (organic > 0.5 && botanicalIdentity < 0.5 && virusFamily < 0.5) {
      float fibre = 0.5 + 0.5 * sin(
        fieldPosition.x * 0.18 + sin(fieldPosition.y * 0.11 + material) * 1.4
      );
      vec3 organicTint = mix(vec3(0.18, 0.50, 0.12), vec3(0.48, 0.29, 0.12), fibrous);
      color += mix(base, organicTint, 0.52) * (0.006 + fibre * 0.020);
    }
    if (carrier > 0.5 && energyCore < 0.5) {
      float carrierPulse = 0.5 + 0.5 * sin(
        dot(fieldPosition, vec2(0.19, 0.07)) - uTime * (1.8 + length(velocity)) + material * 0.43
      );
      vec3 carrierTint = mix(vec3(1.0, 0.68, 0.32), vec3(0.56, 0.88, 1.0), radioactive);
      color += carrierTint * (0.012 + carrierPulse * 0.038) * (0.40 + traitEdge * 0.60);
    }
  }
  float emission = energyCore > 0.5
    ? 0.0
    : (materialEmissive ? 0.48 + heat * 1.05 : (material == 11.0 ? 0.28 + heat * 0.62 : 0.0));
  color += mix(base, vec3(1.0, 0.52, 0.20), heat) * emission;
  if (energyCore < 0.5 && emissionOnly < 0.5 && emissionState.a > 0.002) {
    float lightReach = smoothstep(0.002, 0.42, emissionState.a);
    float contour = 1.0 - smoothstep(0.54, 0.96, density);
    float relief = clamp((diffuse - 0.72) / 0.42 + specular * 0.18, 0.0, 1.0);
    float lightProfile = wallOnly > 0.5 ? 2.0 : profile;
    float surfaceResponse = surfaceLightGain(lightProfile)
      * mix(0.14, 1.0, contour)
      * mix(0.76, 1.16, relief);
    float lightResponse = gasVolume > 0.5 ? 0.0
      : (liquidVolume > 0.5
      ? (materialEmissive ? 0.0 : liquidLightResponse * uLiquidFieldLighting)
      : (materialEmissive ? 0.24 : surfaceResponse));
    // Opaque matter receives coloured light through its reconstructed relief;
    // empty space keeps the separate emission halo, avoiding a flat milky wash.
    color += emissionState.rgb * lightReach * lightResponse;
  }
  // Converge eligible aqueous liquid and exact-owner granular powder only after
  // their phase and scene lighting. A bounded luma offset keeps macro relief
  // while removing high-frequency cyan/ochre semantic phase contrast.
  float suspensionColorDistance = length(suspensionState.rgb - paletteSample.rgb);
  float suspensionPowder = family == 4.0 && granularOptics(optics) > 0.5 && traits < 0.5
    && !materialEmissive
    ? 1.0 - smoothstep(0.08, 0.24, suspensionColorDistance) : 0.0;
  float suspensionLiquid = liquidVolume > 0.5 && optics == 1.0 && traits < 0.5
    && !materialEmissive ? 1.0 : 0.0;
  float lateSuspension = max(suspensionPowder, suspensionLiquid)
    * smoothstep(0.05, 0.62, suspensionState.a) * 0.98;
  if (lateSuspension > 0.001) {
    vec3 wetSediment = vividColor(
      mix(liquidState.rgb, suspensionState.rgb, 0.48), 1.10
    );
    float currentLuma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float wetLuma = dot(wetSediment, vec3(0.2126, 0.7152, 0.0722));
    float relief = clamp(currentLuma - wetLuma, -8.0 / 255.0, 8.0 / 255.0);
    color = mix(color, wetSediment + vec3(relief), lateSuspension);
  }
  if (halo > 0.5 && wallOnly < 0.5 && emissionOnly < 0.5 && surfaceOnly < 0.5
    && gasVolume < 0.5 && liquidVolume < 0.5 && energyCore < 0.5) alpha = volume * 0.52;
  alpha = clamp(alpha, 0.0, 1.0);
  vec3 premultiplied = clamp(color, 0.0, 1.35) * alpha;
  float compositeAlpha = alpha;
  if (wall > 0.5 && wallOnly < 0.5) {
    float backgroundAlpha = smoothstep(0.30, 0.70, wallSurface.x) * 0.94;
    float exactRefractor = (material == 12.0 || material == 24.0) ? 1.0 : 0.0;
    float refractedInterior = uTranslucentBackdropRefraction * exactRefractor
      * (1.0 - step(0.5, abs(optics - 12.0))) * step(0.20, density)
      * step(0.72, wallSurface.x) * (1.0 - surfaceOnly);
    float refractedLiquid = uTranslucentBackdropRefraction
      * (family == 2.0 ? 1.0 : 0.0) * (materialEmissive ? 0.0 : 1.0)
      * step(0.20, volume) * step(0.72, wallSurface.x)
      * step(0.20, abs(liquidBackdropOffset.x) + abs(liquidBackdropOffset.y));
    float backdropPattern;
    if (refractedInterior > 0.5) {
      backdropPattern = refractedWallPattern(wall, fieldPosition, material, shape.yz);
    } else if (refractedLiquid > 0.5) {
      backdropPattern = wallPattern(wall, fieldPosition + liquidBackdropOffset);
    } else {
      backdropPattern = wallPattern(wall, fieldPosition);
    }
    premultiplied += wallColor(wall) * backdropPattern * backgroundAlpha * (1.0 - compositeAlpha);
    compositeAlpha += backgroundAlpha * (1.0 - compositeAlpha);
  }
  finalColor = vec4(premultiplied, compositeAlpha);
}
`;

/** Primary WebGL presentation of raw simulation semantics. */
export class PixiFieldPresenter {
  private readonly scene = new Container();
  private readonly fieldBytes: Uint8Array;
  private readonly fieldSource: BufferImageSource;
  private readonly wallBytes: Uint8Array;
  private readonly wallSource: BufferImageSource;
  private readonly atmosphereSource: BufferImageSource;
  private readonly atmosphereStyleSource: BufferImageSource;
  private readonly emissionSource: BufferImageSource;
  private readonly liquidSource: BufferImageSource;
  private readonly boundaryStabilityBytes: Uint8Array;
  private readonly boundaryStabilityOwners: Uint8Array;
  private readonly boundaryStabilitySource: BufferImageSource;
  private readonly powderSurfaceSource: BufferImageSource;
  private readonly suspensionSource: BufferImageSource;
  private readonly fieldSet: RenderFieldSet;
  private readonly chunks: DirtyChunkGrid;
  private readonly wallChunks: DirtyChunkGrid;
  private readonly boundaryDirtyMarker = {
    markCell: (): void => { this.powderSurfaceDirty = true; },
  };
  private readonly uniforms: UniformGroup;
  private webGLTimingEnabled = false;
  private webGLTimingRequested = false;
  private webGLTimingSource: WebGLPresentationTiming['source'] = 'cpu-submission';
  private webGLTimingExtension?: WebGLTimerQueryExtension;
  private webGLTimingPending?: WebGLQuery;
  private webGLTimingFence?: WebGLSync;
  private webGLTimingFenceStartedAt = 0;
  private webGLTimingFencePoll = 0;
  private readonly webGLTimingSamples: number[] = [];
  private webGLTimingDiscarded = 0;
  private webGLTimingSequence = 0;
  private powderSurfaceDirty = true;
  private solidOpticalDepthDirty = true;
  private unusualSolidStylingEnabled = true;
  private liquidOpticalDepthHydrated = false;
  private lastPowderSurfaceRefresh = -Infinity;
  private lastSolidOpticalDepthRefresh = -Infinity;
  private contextLost = false;
  private destroyed = false;
  private renderFence?: WebGLSync;
  private renderFenceStartedAt = 0;
  private renderQueued = false;
  private renderFencePoll = 0;
  private renderFenceStallForcedForAudit = false;
  private firstFrameReady = false;
  private firstFrameFailed = false;
  private readonly firstFrameWaiters = new Set<(ready: boolean) => void>();
  private contextLossHandler?: () => void;
  private renderStallHandler?: () => void;
  private readonly removeContextLossListener: () => void;

  private constructor(
    private readonly app: Application,
    private readonly host: HTMLElement,
    private readonly width: number,
    private readonly height: number,
    private readonly outputScale: FieldOutputScale,
    materials: readonly RenderMaterialStyle[],
    fieldSet?: RenderFieldSet,
  ) {
    this.removeContextLossListener = installWebGLContextLossHandler(app.canvas, () => {
      if (this.contextLost) return;
      this.contextLost = true;
      this.resolveFirstFrame(false);
      this.releaseRenderFence();
      this.releaseWebGLTimingQuery();
      this.releaseWebGLTimingFence();
      this.contextLossHandler?.();
    });
    this.fieldBytes = new Uint8Array(width * height * 4);
    this.fieldSource = new BufferImageSource({
      resource: this.fieldBytes, width, height, format: 'rgba8unorm',
      alphaMode: 'no-premultiply-alpha', scaleMode: 'nearest', autoGarbageCollect: false,
    });
    const fieldTexture = new Texture({ source: this.fieldSource });
    this.wallBytes = new Uint8Array(width * height * 4);
    this.wallSource = new BufferImageSource({
      resource: this.wallBytes, width, height, format: 'rgba8unorm',
      alphaMode: 'no-premultiply-alpha', scaleMode: 'nearest', autoGarbageCollect: false,
    });
    this.fieldSet = fieldSet ?? new RenderFieldSet(width, height, materials);
    const paletteTexture = textureFromBytes(this.fieldSet.lookups.paletteBytes);
    const styleTexture = textureFromBytes(this.fieldSet.lookups.styleBytes);
    this.atmosphereSource = new BufferImageSource({
      resource: this.fieldSet.atmosphere.bytes,
      width: this.fieldSet.atmosphere.width,
      height: this.fieldSet.atmosphere.height,
      format: 'rgba8unorm',
      alphaMode: 'no-premultiply-alpha',
      scaleMode: 'linear',
      autoGarbageCollect: false,
    });
    this.atmosphereStyleSource = new BufferImageSource({
      resource: this.fieldSet.atmosphere.styleBytes,
      width: this.fieldSet.atmosphere.width,
      height: this.fieldSet.atmosphere.height,
      format: 'r8unorm',
      alphaMode: 'no-premultiply-alpha',
      scaleMode: 'nearest',
      autoGarbageCollect: false,
    });
    const gasIdentityMotifSource = new BufferImageSource({
      resource: GAS_IDENTITY_MOTIF_TEXTURE_BYTES,
      width: GAS_IDENTITY_MOTIF_TEXTURE_WIDTH,
      height: GAS_IDENTITY_MOTIF_TEXTURE_HEIGHT,
      format: 'rgba8unorm',
      alphaMode: 'no-premultiply-alpha',
      scaleMode: 'nearest',
      autoGarbageCollect: false,
    });
    this.emissionSource = new BufferImageSource({
      resource: this.fieldSet.emission.bytes,
      width: this.fieldSet.emission.width,
      height: this.fieldSet.emission.height,
      format: 'rgba8unorm',
      alphaMode: 'no-premultiply-alpha',
      scaleMode: 'linear',
      autoGarbageCollect: false,
    });
    this.liquidSource = new BufferImageSource({
      resource: this.fieldSet.liquid.bytes,
      width,
      height,
      format: 'rgba8unorm',
      alphaMode: 'no-premultiply-alpha',
      scaleMode: 'linear',
      autoGarbageCollect: false,
    });
    this.boundaryStabilityBytes = new Uint8Array(width * height);
    this.boundaryStabilityOwners = new Uint8Array(width * height);
    this.boundaryStabilitySource = new BufferImageSource({
      resource: this.boundaryStabilityBytes,
      width,
      height,
      format: 'r8unorm',
      alphaMode: 'no-premultiply-alpha',
      scaleMode: 'nearest',
      autoGarbageCollect: false,
    });
    this.powderSurfaceSource = new BufferImageSource({
      resource: this.fieldSet.powderSurface.bytes,
      width,
      height,
      format: 'rgba8unorm',
      alphaMode: 'no-premultiply-alpha',
      scaleMode: 'linear',
      autoGarbageCollect: false,
    });
    this.suspensionSource = new BufferImageSource({
      resource: this.fieldSet.suspension.bytes,
      width: this.fieldSet.suspension.width,
      height: this.fieldSet.suspension.height,
      format: 'rgba8unorm',
      alphaMode: 'no-premultiply-alpha',
      scaleMode: 'linear',
      autoGarbageCollect: false,
    });
    this.uniforms = new UniformGroup({
      uTexel: { value: new Float32Array([1 / width, 1 / height]), type: 'vec2<f32>' },
      uFieldSize: { value: new Float32Array([width, height]), type: 'vec2<f32>' },
      uAtmosphereTexel: { value: new Float32Array([1 / this.fieldSet.atmosphere.width, 1 / this.fieldSet.atmosphere.height]), type: 'vec2<f32>' },
      uEmissionTexel: { value: new Float32Array([1 / this.fieldSet.emission.width, 1 / this.fieldSet.emission.height]), type: 'vec2<f32>' },
      uTime: { value: 0, type: 'f32' },
      // At 8x, the supersampled analytic boundary already supplies detail. Drop
      // diagonal/ring probes so the 15M-pixel frame remains watchdog-safe.
      uHighQuality: {
        value: matchMedia('(min-width: 800px)').matches && outputScale < 8 ? 1 : 0,
        type: 'f32',
      },
      // True 8x drops expensive diagonal and directional probes, but its dense
      // body lighting should retain the same analytic normal response as the
      // desktop 1x-4x path. This scalar changes no sample or resource count.
      uAnalyticLightingQuality: {
        value: matchMedia('(min-width: 800px)').matches || outputScale === 8 ? 1 : 0,
        type: 'f32',
      },
      uGasFieldLighting: { value: 1, type: 'f32' },
      uGasVolumeChroma: { value: 1, type: 'f32' },
      uGasIdentityStyling: { value: 1, type: 'f32' },
      uEmissionVolumeChroma: { value: 1, type: 'f32' },
      uLiquidFieldLighting: { value: 1, type: 'f32' },
      uLiquidVolumeChroma: { value: 1, type: 'f32' },
      uLiquidIdentityStyling: { value: 1, type: 'f32' },
      uLiquidOpticalDepth: { value: 1, type: 'f32' },
      uSolidOpticalDepth: { value: 1, type: 'f32' },
      uTranslucentFieldTransmission: { value: 1, type: 'f32' },
      uTranslucentBackdropRefraction: { value: 1, type: 'f32' },
      uSolidContactDepth: { value: 1, type: 'f32' },
      uTranslucentLensShell: { value: 1, type: 'f32' },
      uSolidCurvatureDepth: { value: 1, type: 'f32' },
      uSurfaceContourLighting: { value: 1, type: 'f32' },
      uPhaseContactLighting: { value: 1, type: 'f32' },
      uSolidFieldLighting: { value: 1, type: 'f32' },
      uRoleMaterialStyling: { value: 1, type: 'f32' },
      uCellularMaterialStyling: { value: 1, type: 'f32' },
      uSensorMaterialStyling: { value: 1, type: 'f32' },
      uUnusualPowderStyling: { value: 1, type: 'f32' },
      uExplosivePowderStyling: { value: 1, type: 'f32' },
      uUnusualSolidStyling: { value: 1, type: 'f32' },
      uLiquidSilhouetteCohesion: { value: 1, type: 'f32' },
      // FieldRenderer turns this on only for backends that expose temperature;
      // byte zero must therefore never make legacy backends look frozen.
      uThermalMaterialStyling: { value: 0, type: 'f32' },
      uEnergyCoreRelief: { value: 1, type: 'f32' },
      uEnergyIdentityStyling: { value: 1, type: 'f32' },
      uVibrStateStyling: { value: 1, type: 'f32' },
      uDeutStateStyling: { value: 1, type: 'f32' },
      uSourceTargetStyling: { value: 1, type: 'f32' },
      uBotanicalIdentityStyling: { value: 1, type: 'f32' },
      uPowderStyle: { value: powderRenderStyleValue('smooth'), type: 'f32' },
      uPowderBodyDepth: { value: 1, type: 'f32' },
      uSuspensionActive: {
        value: this.fieldSet.suspension.hasSuspension ? 1 : 0,
        type: 'f32',
      },
    });
    const resources = {
      fieldUniforms: this.uniforms,
      uFieldTexture: this.fieldSource,
      uFieldSampler: this.fieldSource.style,
      uWallTexture: this.wallSource,
      uWallSampler: this.wallSource.style,
      uAtmosphereTexture: this.atmosphereSource,
      uAtmosphereSampler: this.atmosphereSource.style,
      uAtmosphereStyleTexture: this.atmosphereStyleSource,
      uAtmosphereStyleSampler: this.atmosphereStyleSource.style,
      uGasIdentityMotifTexture: gasIdentityMotifSource,
      uGasIdentityMotifSampler: gasIdentityMotifSource.style,
      uEmissionTexture: this.emissionSource,
      uEmissionSampler: this.emissionSource.style,
      uLiquidTexture: this.liquidSource,
      uLiquidSampler: this.liquidSource.style,
      uBoundaryStabilityTexture: this.boundaryStabilitySource,
      uBoundaryStabilitySampler: this.boundaryStabilitySource.style,
      uPowderSurfaceTexture: this.powderSurfaceSource,
      uPowderSurfaceSampler: this.powderSurfaceSource.style,
      uSuspensionTexture: this.suspensionSource,
      uSuspensionSampler: this.suspensionSource.style,
      uPaletteTexture: paletteTexture.source,
      uPaletteSampler: paletteTexture.source.style,
      uStyleTexture: styleTexture.source,
      uStyleSampler: styleTexture.source.style,
    };
    if (outputScale === 8) {
      // Draw the semantic shader directly on one world-sized quad. A Pixi
      // Filter first renders its source sprite into an implementation-owned
      // target even though this shader never samples that source. At true 8x
      // the redundant target approaches 60 MiB and repeats 15M fragments.
      const shader = Shader.from({
        gl: { vertex: FIELD_VERTEX, fragment: FIELD_FRAGMENT, name: 'semantic-field-mesh' },
        resources,
      });
      const geometry = new MeshGeometry({
        positions: new Float32Array([0, 0, width, 0, width, height, 0, height]),
        uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
        indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
      });
      // MeshPipe derives its blend equation from mesh.texture.alphaMode. The
      // semantic field must remain no-premultiply for byte-exact material data,
      // but FIELD_FRAGMENT already emits premultiplied display colour. Use a
      // neutral premultiplied marker texture for pipe state so translucent
      // matter is not multiplied by alpha a second time at true 8x; the shader
      // still samples the explicit uFieldTexture resource above.
      this.scene.addChild(new Mesh({ geometry, shader, texture: Texture.WHITE }));
    } else {
      // Keep the established 1x–4x filter response, whose logical source pass
      // supplies the deliberately broad low-resolution material relief.
      const filter = Filter.from({
        gl: { vertex: FIELD_FILTER_VERTEX, fragment: FIELD_FRAGMENT, name: 'semantic-field-filter' },
        resources,
        antialias: 'inherit',
      });
      const sprite = new Sprite(fieldTexture);
      sprite.filters = [filter];
      this.scene.addChild(sprite);
    }
    this.chunks = new DirtyChunkGrid(width, height, 32, 2);
    this.wallChunks = new DirtyChunkGrid(width, height, 32, 2);
    this.chunks.markAll();
    this.wallChunks.markAll();
  }

  static async create(
    host: HTMLElement,
    width: number,
    height: number,
    outputScale: FieldOutputScale,
    materials: readonly RenderMaterialStyle[],
    fieldSet?: RenderFieldSet,
  ): Promise<PixiFieldPresenter> {
    const app = new Application();
    try {
      await app.init({
        width, height,
        // MSAA is redundant once every simulation cell owns 4x4 or 8x8 real
        // samples, and at 8x it would multiply a 60 MiB colour target.
        preference: 'webgl', backgroundAlpha: 0, antialias: outputScale <= 2,
        // Production keeps the cheaper discardable default. The browser audit
        // preserves only its diagnostic framebuffer so exact material topology
        // can be read after Chrome has composited a screenshot.
        preserveDrawingBuffer: typeof location !== 'undefined'
          && new URLSearchParams(location.search).get('inputAudit') === '1'
          && new URLSearchParams(location.search).get('blankAudit') === '1',
        resolution: outputScale, autoDensity: true, autoStart: false,
      });
    } catch (error) {
      try { app.destroy(); } catch { /* partially initialized Pixi application */ }
      throw error;
    }
    let presenter: PixiFieldPresenter;
    try {
      presenter = new PixiFieldPresenter(
        app, host, width, height, outputScale, materials, fieldSet,
      );
    }
    catch (error) { app.destroy(); throw error; }
    presenter.app.canvas.className = 'world-canvas semantic-field-canvas';
    presenter.app.canvas.style.width = width + 'px';
    presenter.app.canvas.style.height = height + 'px';
    presenter.app.canvas.style.transformOrigin = '0 0';
    presenter.app.canvas.dataset.renderer = 'semantic-field-webgl';
    presenter.app.canvas.dataset.worldSize = width + 'x' + height;
    presenter.app.canvas.dataset.outputScale = String(outputScale);
    presenter.app.canvas.dataset.backingSize = presenter.app.canvas.width + 'x' + presenter.app.canvas.height;
    presenter.app.stage.addChild(presenter.scene);
    return presenter;
  }

  mount(): void { this.host.append(this.app.canvas); }

  destroy(): void {
    this.destroyed = true;
    this.resolveFirstFrame(false);
    this.contextLossHandler = undefined;
    this.renderStallHandler = undefined;
    this.removeContextLossListener();
    this.releaseRenderFence();
    this.releaseWebGLTimingQuery();
    this.releaseWebGLTimingFence();
    this.app.canvas.remove();
    try { this.app.destroy(); }
    catch {
      try { this.scene.destroy({ children: true }); }
      catch { /* already torn down */ }
    }
  }

  resize(width: number, height: number): PresenterViewport {
    this.app.canvas.dataset.viewportSize = width + 'x' + height;
    return { width, height };
  }

  clientWorldPoint(clientX: number, clientY: number): { x: number; y: number } {
    return clientToCanvasWorld(
      { x: clientX, y: clientY }, this.app.canvas.getBoundingClientRect(), this.width, this.height,
    );
  }

  presentationAuxiliaryAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return -1;
    return this.boundaryStabilityBytes[y * this.width + x];
  }

  /** Narrow audit readback of the propagated CPU identity plane. */
  gasIdentityStyleAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    const fieldX = Math.min(this.fieldSet.atmosphere.width - 1, Math.floor(x / 2));
    const fieldY = Math.min(this.fieldSet.atmosphere.height - 1, Math.floor(y / 2));
    return this.fieldSet.atmosphere.styleBytes[
      fieldY * this.fieldSet.atmosphere.width + fieldX
    ];
  }

  markDirty(index: number, nextMaterial: number): void {
    const previousMaterial = this.fieldBytes[index * 4];
    this.chunks.markCell(index);
    this.fieldSet.markDirty(previousMaterial, nextMaterial, index);
    if (this.powderRelevant(previousMaterial) || this.powderRelevant(nextMaterial)
      || this.powderAirBlocker(previousMaterial) !== this.powderAirBlocker(nextMaterial)) {
      this.powderSurfaceDirty = true;
    }
    if (this.solidRelevant(previousMaterial) || this.solidRelevant(nextMaterial)) {
      this.solidOpticalDepthDirty = true;
    }
  }

  markWallDirty(index: number): void {
    this.wallChunks.markCell(index);
    this.fieldSet.markAtmosphereBlockerDirty(index);
    this.powderSurfaceDirty = true;
    this.solidOpticalDepthDirty = true;
  }

  setContextLossHandler(handler: () => void): void {
    this.contextLossHandler = handler;
  }

  setRenderStallHandler(handler: () => void): void {
    this.renderStallHandler = handler;
  }

  /**
   * Exercises the real true-8x stalled-fence recovery branch for the explicit
   * browser audit. The production watchdog is otherwise impractical to prove
   * deterministically: a healthy GPU normally signals long before 30 seconds.
   */
  forceEightXRenderStallForAudit(): boolean {
    if (this.outputScale !== 8 || !this.firstFrameReady
      || this.destroyed || this.contextLost) return false;
    const gl = this.webGLContext();
    if (!gl) return false;
    // The audit may arrive while the latest-wins path still owns a healthy
    // fence. Removing a sync object does not cancel submitted GPU commands;
    // replace it with the forced-stall audit fence so the same recovery
    // branch is deterministic regardless of capture timing.
    if (this.renderFence) this.releaseRenderFence();
    let fence: WebGLSync | null = null;
    try { fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); }
    catch { return false; }
    if (!fence) return false;
    this.renderFence = fence;
    this.renderFenceStartedAt = performance.now();
    this.renderFenceStallForcedForAudit = true;
    this.renderQueued = true;
    this.scheduleEightXRenderPoll();
    return true;
  }

  isContextLost(): boolean { return this.contextLost; }

  /**
   * Waits for the first true-8x GPU frame while the bounded Canvas fallback
   * remains mounted. Application.render() only proves submission; the fence
   * proves that the 15-million-fragment frame actually completed.
   */
  waitForFirstFrame(timeoutMs: number): Promise<boolean> {
    if (this.outputScale !== 8 || this.firstFrameReady) return Promise.resolve(true);
    if (this.destroyed || this.contextLost || this.firstFrameFailed || timeoutMs <= 0) {
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const finish = (ready: boolean): void => {
        if (timeout !== undefined) clearTimeout(timeout);
        this.firstFrameWaiters.delete(finish);
        resolve(ready);
      };
      this.firstFrameWaiters.add(finish);
      timeout = setTimeout(() => finish(false), timeoutMs);
      this.scheduleEightXRenderPoll();
    });
  }

  /** Seeds every presentation uniform without submitting an intermediate frame. */
  configurePresentation(
    gasFieldLightingEnabled: boolean,
    liquidFieldLightingEnabled: boolean,
    translucentFieldTransmissionEnabled: boolean,
    translucentBackdropRefractionEnabled: boolean,
    solidContactDepthEnabled: boolean,
    translucentLensShellEnabled: boolean,
    solidCurvatureDepthEnabled: boolean,
    thermalMaterialStylingEnabled: boolean,
    energyCoreReliefEnabled: boolean,
    powderRenderStyle: PowderRenderStyle,
    surfaceContourLightingEnabled = true,
    phaseContactLightingEnabled = true,
    solidFieldLightingEnabled = true,
    liquidSilhouetteCohesionEnabled = true,
    gasVolumeChromaEnabled = true,
    liquidVolumeChromaEnabled = true,
    powderBodyDepthEnabled = true,
    emissionVolumeChromaEnabled = true,
    liquidOpticalDepthEnabled = true,
    solidOpticalDepthEnabled = true,
    roleMaterialStylingEnabled = true,
    cellularMaterialStylingEnabled = true,
    sensorMaterialStylingEnabled = true,
    unusualPowderStylingEnabled = true,
    unusualSolidStylingEnabled = true,
    liquidIdentityStylingEnabled = true,
    gasIdentityStylingEnabled = true,
    energyIdentityStylingEnabled = true,
    botanicalIdentityStylingEnabled = true,
    vibrStateStylingEnabled = true,
    deutStateStylingEnabled = true,
    sourceTargetStylingEnabled = true,
    explosivePowderStylingEnabled = true,
  ): void {
    const uniforms = this.uniforms.uniforms;
    uniforms.uGasFieldLighting = gasFieldLightingEnabled ? 1 : 0;
    uniforms.uLiquidFieldLighting = liquidFieldLightingEnabled ? 1 : 0;
    uniforms.uTranslucentFieldTransmission = translucentFieldTransmissionEnabled ? 1 : 0;
    uniforms.uTranslucentBackdropRefraction = translucentBackdropRefractionEnabled ? 1 : 0;
    uniforms.uSolidContactDepth = solidContactDepthEnabled ? 1 : 0;
    uniforms.uTranslucentLensShell = translucentLensShellEnabled ? 1 : 0;
    uniforms.uSolidCurvatureDepth = solidCurvatureDepthEnabled ? 1 : 0;
    uniforms.uSurfaceContourLighting = surfaceContourLightingEnabled ? 1 : 0;
    uniforms.uPhaseContactLighting = phaseContactLightingEnabled ? 1 : 0;
    uniforms.uSolidFieldLighting = solidFieldLightingEnabled ? 1 : 0;
    uniforms.uLiquidSilhouetteCohesion = liquidSilhouetteCohesionEnabled ? 1 : 0;
    uniforms.uGasVolumeChroma = gasVolumeChromaEnabled ? 1 : 0;
    uniforms.uGasIdentityStyling = gasIdentityStylingEnabled ? 1 : 0;
    uniforms.uEmissionVolumeChroma = emissionVolumeChromaEnabled ? 1 : 0;
    uniforms.uLiquidVolumeChroma = liquidVolumeChromaEnabled ? 1 : 0;
    uniforms.uLiquidOpticalDepth = liquidOpticalDepthEnabled ? 1 : 0;
    uniforms.uSolidOpticalDepth = solidOpticalDepthEnabled ? 1 : 0;
    uniforms.uRoleMaterialStyling = roleMaterialStylingEnabled ? 1 : 0;
    uniforms.uCellularMaterialStyling = cellularMaterialStylingEnabled ? 1 : 0;
    uniforms.uSensorMaterialStyling = sensorMaterialStylingEnabled ? 1 : 0;
    uniforms.uUnusualPowderStyling = unusualPowderStylingEnabled ? 1 : 0;
    uniforms.uExplosivePowderStyling = explosivePowderStylingEnabled ? 1 : 0;
    uniforms.uUnusualSolidStyling = unusualSolidStylingEnabled ? 1 : 0;
    this.unusualSolidStylingEnabled = unusualSolidStylingEnabled;
    uniforms.uLiquidIdentityStyling = liquidIdentityStylingEnabled ? 1 : 0;
    uniforms.uPowderBodyDepth = powderBodyDepthEnabled ? 1 : 0;
    uniforms.uThermalMaterialStyling = thermalMaterialStylingEnabled ? 1 : 0;
    uniforms.uEnergyCoreRelief = energyCoreReliefEnabled ? 1 : 0;
    uniforms.uEnergyIdentityStyling = energyIdentityStylingEnabled ? 1 : 0;
    uniforms.uVibrStateStyling = vibrStateStylingEnabled ? 1 : 0;
    uniforms.uDeutStateStyling = deutStateStylingEnabled ? 1 : 0;
    uniforms.uSourceTargetStyling = sourceTargetStylingEnabled ? 1 : 0;
    uniforms.uBotanicalIdentityStyling = botanicalIdentityStylingEnabled ? 1 : 0;
    uniforms.uPowderStyle = powderRenderStyleValue(powderRenderStyle);
  }

  setGasFieldLightingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uGasFieldLighting = enabled ? 1 : 0;
    this.renderApplication();
  }

  setGasVolumeChromaEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uGasVolumeChroma = enabled ? 1 : 0;
    this.renderApplication();
  }

  setGasIdentityStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uGasIdentityStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setEmissionVolumeChromaEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uEmissionVolumeChroma = enabled ? 1 : 0;
    this.renderApplication();
  }

  setLiquidFieldLightingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uLiquidFieldLighting = enabled ? 1 : 0;
    this.renderApplication();
  }

  setLiquidVolumeChromaEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uLiquidVolumeChroma = enabled ? 1 : 0;
    this.renderApplication();
  }

  setLiquidIdentityStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uLiquidIdentityStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setLiquidOpticalDepthEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uLiquidOpticalDepth = enabled ? 1 : 0;
    this.renderApplication();
  }

  setSolidOpticalDepthEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uSolidOpticalDepth = enabled ? 1 : 0;
    this.renderApplication();
  }

  setTranslucentFieldTransmissionEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uTranslucentFieldTransmission = enabled ? 1 : 0;
    this.renderApplication();
  }

  setTranslucentBackdropRefractionEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uTranslucentBackdropRefraction = enabled ? 1 : 0;
    this.renderApplication();
  }

  setSolidContactDepthEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uSolidContactDepth = enabled ? 1 : 0;
    this.renderApplication();
  }

  setTranslucentLensShellEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uTranslucentLensShell = enabled ? 1 : 0;
    this.renderApplication();
  }

  setSolidCurvatureDepthEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uSolidCurvatureDepth = enabled ? 1 : 0;
    this.renderApplication();
  }

  setSurfaceContourLightingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uSurfaceContourLighting = enabled ? 1 : 0;
    this.renderApplication();
  }

  setPhaseContactLightingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uPhaseContactLighting = enabled ? 1 : 0;
    this.renderApplication();
  }

  setSolidFieldLightingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uSolidFieldLighting = enabled ? 1 : 0;
    this.renderApplication();
  }

  setRoleMaterialStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uRoleMaterialStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setCellularMaterialStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uCellularMaterialStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setSensorMaterialStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uSensorMaterialStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setUnusualPowderStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uUnusualPowderStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setExplosivePowderStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uExplosivePowderStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setUnusualSolidStylingEnabled(enabled: boolean): void {
    this.unusualSolidStylingEnabled = enabled;
    this.solidOpticalDepthDirty = true;
    this.uniforms.uniforms.uUnusualSolidStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setLiquidSilhouetteCohesionEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uLiquidSilhouetteCohesion = enabled ? 1 : 0;
    this.renderApplication();
  }

  setThermalMaterialStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uThermalMaterialStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setEnergyCoreReliefEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uEnergyCoreRelief = enabled ? 1 : 0;
    this.renderApplication();
  }

  setEnergyIdentityStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uEnergyIdentityStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setVibrStateStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uVibrStateStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setDeutStateStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uDeutStateStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setSourceTargetStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uSourceTargetStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setBotanicalIdentityStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uBotanicalIdentityStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setPowderBodyDepthEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uPowderBodyDepth = enabled ? 1 : 0;
    this.renderApplication();
  }

  setPowderRenderStyle(style: PowderRenderStyle): void {
    this.uniforms.uniforms.uPowderStyle = powderRenderStyleValue(style);
    this.renderApplication();
  }

  enableWebGLPresentationTiming(): void {
    if (this.webGLTimingEnabled) return;
    this.webGLTimingEnabled = true;
    const gl = this.webGLContext();
    // Giant SwiftShader/driver timer queries can remain unavailable forever
    // after an otherwise successful 15M-fragment frame. At true 8x use an
    // audit-only completion fence instead. It is less precise than elapsed GPU
    // time because requestAnimationFrame polling contributes bounded latency,
    // but its sequence cannot advance before the submitted frame completes.
    // Smaller targets retain the more precise elapsed-GPU query when available.
    const extension = (this.outputScale === 8 ? null
      : gl?.getExtension('EXT_disjoint_timer_query_webgl2')) as
      WebGLTimerQueryExtension | null | undefined;
    this.webGLTimingExtension = extension ?? undefined;
    this.webGLTimingSource = extension ? 'gpu-query' : gl ? 'gpu-fence' : 'cpu-submission';
  }

  requestWebGLPresentationTimingSample(): boolean {
    if (!this.webGLTimingEnabled) return false;
    this.pollWebGLTimingQuery();
    this.pollWebGLTimingFence();
    if (this.webGLTimingRequested || this.webGLTimingPending || this.webGLTimingFence) return false;
    this.webGLTimingRequested = true;
    // Timing requests are audit-only and must own the frame they measure. A
    // paused/static scene may otherwise have no later update to consume the
    // request, leaving a correct renderer looking like a hung timer query.
    this.renderApplication();
    return true;
  }

  getWebGLPresentationTiming(): WebGLPresentationTiming | undefined {
    if (!this.webGLTimingEnabled) return undefined;
    this.pollWebGLTimingQuery();
    this.pollWebGLTimingFence();
    const sorted = [...this.webGLTimingSamples].sort((left, right) => left - right);
    const percentile = (ratio: number): number => sorted.length
      ? sorted[Math.floor((sorted.length - 1) * ratio)]
      : 0;
    return {
      source: this.webGLTimingSource,
      sequence: this.webGLTimingSequence,
      usableSamples: sorted.length,
      discardedSamples: this.webGLTimingDiscarded,
      medianMs: percentile(0.5),
      p90Ms: percentile(0.9),
      maximumMs: sorted.at(-1) ?? 0,
    };
  }

  visualRefreshDue(time: number): boolean {
    return this.fieldSet.due(time)
      || (this.powderSurfaceDirty
        && time - this.lastPowderSurfaceRefresh >= POWDER_SURFACE_REFRESH_INTERVAL)
      || (this.solidOpticalDepthDirty
        && time - this.lastSolidOpticalDepthRefresh >= POWDER_SURFACE_REFRESH_INTERVAL);
  }

  update(
    materials: Uint8Array,
    walls: Uint8Array | undefined,
    temperatures: Uint16Array | undefined,
    velocities: Int8Array | undefined,
    presentationState: Uint16Array | undefined,
    scheduleTime: number,
    visualTime: number,
    refreshDynamicFields: boolean,
  ): void {
    if (refreshDynamicFields) this.chunks.markAll();
    const rectangles = this.chunks.consume();
    let boundaryTextureDirty = false;
    for (const rect of rectangles) {
      updateBoundaryStabilityRect(
        this.boundaryStabilityBytes, this.boundaryStabilityOwners, materials, velocities,
        this.fieldSet.lookups.styleBytes, this.fieldSource.width, rect, this.boundaryDirtyMarker,
      );
      packSemanticRect(this.fieldBytes, this.fieldSource.width, materials, temperatures, velocities, rect);
      if (presentationState) {
        packPresentationStateRect(
          this.wallBytes, this.wallSource.width, presentationState, rect,
        );
      }
    }
    if (rectangles.length) {
      this.fieldSource.update();
      boundaryTextureDirty = true;
    }
    let wallTextureDirty = rectangles.length > 0 && presentationState !== undefined;
    const wallRectangles = this.wallChunks.consume();
    if (walls) for (const rect of wallRectangles) packWallRect(this.wallBytes, this.wallSource.width, walls, rect);
    if (walls && wallRectangles.length) wallTextureDirty = true;
    if (wallTextureDirty) this.wallSource.update();
    if (this.powderSurfaceDirty
      && scheduleTime - this.lastPowderSurfaceRefresh >= POWDER_SURFACE_REFRESH_INTERVAL) {
      const changed = this.fieldSet.powderSurface.update(
        materials, this.boundaryStabilityBytes, walls,
      );
      this.powderSurfaceDirty = false;
      this.lastPowderSurfaceRefresh = scheduleTime;
      if (changed) {
        this.powderSurfaceSource.update();
        packExteriorAir(this.wallBytes, this.fieldSet.powderSurface.exteriorAirBytes);
        this.wallSource.update();
      }
    }
    if (this.solidOpticalDepthDirty
      && scheduleTime - this.lastSolidOpticalDepthRefresh >= POWDER_SURFACE_REFRESH_INTERVAL) {
      writeSolidOpticalDepth(
        materials, this.boundaryStabilityBytes, this.fieldSet.lookups.styleBytes,
        this.fieldSource.width, walls, this.unusualSolidStylingEnabled,
      );
      this.solidOpticalDepthDirty = false;
      this.lastSolidOpticalDepthRefresh = scheduleTime;
      boundaryTextureDirty = true;
    }
    const volumeField = this.fieldSet.updateNext(materials, scheduleTime, walls);
    if (volumeField === 'liquid' || !this.liquidOpticalDepthHydrated) {
      this.fieldSet.liquid.writeVerticalOpticalDepth(materials, this.boundaryStabilityBytes);
      this.liquidOpticalDepthHydrated = true;
      boundaryTextureDirty = true;
    }
    {
      const suspensionChanged = this.fieldSet.refreshSuspension(materials, scheduleTime, walls);
      if (suspensionChanged) this.suspensionSource.update();
      // A promoted presenter may share a field that Canvas already refreshed.
      // Hydrate state even when no rebuild is due, or a paused scene can leave
      // the pre-populated suspension texture permanently disabled.
      this.uniforms.uniforms.uSuspensionActive = this.fieldSet.suspension.hasSuspension ? 1 : 0;
    }
    if (volumeField === 'atmosphere') {
      this.atmosphereSource.update();
      this.atmosphereStyleSource.update();
    } else if (volumeField === 'liquid') {
      this.liquidSource.update();
    } else if (volumeField === 'emission') {
      this.emissionSource.update();
    }
    if (boundaryTextureDirty) this.boundaryStabilitySource.update();
    this.uniforms.uniforms.uTime = visualTime * 0.001;
    this.renderApplication();
  }

  setTransform(scale: number, x: number, y: number): void {
    this.app.canvas.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    this.app.canvas.dataset.viewScale = String(scale);
    this.app.canvas.dataset.viewPosition = x + "," + y;
  }

  private powderRelevant(material: number): boolean {
    if (material === 0) return false;
    const phase = this.fieldSet.lookups.styleBytes[material * 4];
    return phase === RenderPhase.Solid || phase === RenderPhase.Powder;
  }

  private powderAirBlocker(material: number): boolean {
    if (material === 0) return false;
    const phase = this.fieldSet.lookups.styleBytes[material * 4];
    return phase !== RenderPhase.Gas && phase !== RenderPhase.Energy;
  }

  private solidRelevant(material: number): boolean {
    return material !== 0
      && this.fieldSet.lookups.styleBytes[material * 4] === RenderPhase.Solid;
  }

  private renderApplication(): void {
    if (this.outputScale === 8 && this.renderFence) {
      this.renderQueued = true;
      if (!this.prepareEightXRender()) return;
    }
    this.renderApplicationNow();
    if (this.outputScale === 8) this.insertEightXRenderFence();
  }

  private renderApplicationNow(): void {
    const gl = this.webGLContext();
    // Pixi's BufferImageSource uploader leaves WebGL's four-byte default in
    // place. Our 306-byte R8 identity rows require byte alignment; enforcing it
    // immediately before every render also survives unrelated later uploads.
    try { if (gl) gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); }
    catch { /* a lost context is handled by the existing render path below */ }
    if (!this.webGLTimingEnabled || !this.webGLTimingRequested) {
      this.app.render();
      return;
    }
    this.webGLTimingRequested = false;
    const extension = this.webGLTimingExtension;
    let query: WebGLQuery | null = null;
    try { query = extension && gl ? gl.createQuery() : null; }
    catch { /* a lost/invalid context falls through to labelled CPU timing */ }
    if (!query || !extension || !gl) {
      if (gl) this.renderAndRecordFenceTiming(gl);
      else {
        this.useCpuTimingFallback();
        this.renderAndRecordCpuTiming();
      }
      return;
    }

    try {
      gl.beginQuery(extension.TIME_ELAPSED_EXT, query);
    } catch {
      try { gl.deleteQuery(query); } catch { /* context may already be invalid */ }
      this.renderAndRecordFenceTiming(gl);
      return;
    }

    const started = performance.now();
    try {
      this.app.render();
    } catch (error) {
      try { gl.endQuery(extension.TIME_ELAPSED_EXT); } catch { /* query is already invalid */ }
      try { gl.deleteQuery(query); } catch { /* preserve the original render error */ }
      throw error;
    }

    try {
      gl.endQuery(extension.TIME_ELAPSED_EXT);
      // A paused/static render lab may not submit another frame after this one.
      // Explicitly flush audit-requested work so QUERY_RESULT_AVAILABLE can
      // advance without relying on unrelated animation or field refreshes.
      gl.flush();
      this.webGLTimingPending = query;
    } catch {
      try { gl.deleteQuery(query); } catch { /* context may already be invalid */ }
      if (!this.insertWebGLTimingFence(gl, started)) {
        this.useCpuTimingFallback();
        this.recordWebGLTimingSample(performance.now() - started);
      }
    }
  }

  /**
   * True 8x submits 15,040,512 fragments per frame. Keep exactly one frame in
   * flight and let texture/uniform mutations coalesce while the GPU catches up.
   */
  private prepareEightXRender(): boolean {
    const fence = this.renderFence;
    if (!fence) return true;
    if (this.firstFrameReady && (this.renderFenceStallForcedForAudit
      || (this.renderFenceStartedAt > 0
        && performance.now() - this.renderFenceStartedAt >= WEBGL_EIGHT_X_FRAME_STALL_MS))) {
      this.releaseRenderFence();
      this.renderStallHandler?.();
      return false;
    }
    const gl = this.webGLContext();
    if (!gl || this.contextLost || this.destroyed) {
      this.releaseRenderFence();
      if (!this.firstFrameReady) {
        this.firstFrameFailed = true;
        this.resolveFirstFrame(false);
      } else if (!this.contextLost && !this.destroyed) {
        this.renderStallHandler?.();
      }
      return false;
    }
    let status: number;
    try { status = gl.clientWaitSync(fence, 0, 0); }
    catch {
      this.releaseRenderFence();
      if (!this.firstFrameReady) {
        this.firstFrameFailed = true;
        this.resolveFirstFrame(false);
        return false;
      }
      return true;
    }
    if (status === gl.WAIT_FAILED) {
      this.releaseRenderFence();
      if (!this.firstFrameReady) {
        this.firstFrameFailed = true;
        this.resolveFirstFrame(false);
        return false;
      }
      return true;
    }
    if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) {
      this.releaseRenderFence();
      return true;
    }
    this.scheduleEightXRenderPoll();
    return false;
  }

  private insertEightXRenderFence(): void {
    const gl = this.webGLContext();
    if (!gl || this.contextLost || this.destroyed) return;
    try {
      const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!fence) return;
      this.renderFence = fence;
      this.renderFenceStartedAt = performance.now();
      gl.flush();
      // Poll even when no second redraw has arrived. Promotion must not remove
      // the visible Canvas merely because the first 8x frame was submitted.
      this.scheduleEightXRenderPoll();
    } catch { /* context loss will promote the Canvas fallback */ }
  }

  private scheduleEightXRenderPoll(): void {
    if (this.renderFencePoll !== 0 || this.destroyed || this.contextLost) return;
    this.renderFencePoll = requestAnimationFrame(() => {
      this.renderFencePoll = 0;
      if (!this.renderFence || this.destroyed || this.contextLost) return;
      const redraw = this.renderQueued;
      if (!this.prepareEightXRender()) return;
      this.resolveFirstFrame(true);
      if (redraw) this.renderApplication();
    });
  }

  private resolveFirstFrame(ready: boolean): void {
    if (ready) this.firstFrameReady = true;
    for (const waiter of [...this.firstFrameWaiters]) waiter(ready);
  }

  private releaseRenderFence(): void {
    if (this.renderFencePoll !== 0) {
      cancelAnimationFrame(this.renderFencePoll);
      this.renderFencePoll = 0;
    }
    const fence = this.renderFence;
    const gl = this.webGLContext();
    if (fence && gl) {
      try { gl.deleteSync(fence); } catch { /* context may already be invalid */ }
    }
    this.renderFence = undefined;
    this.renderFenceStartedAt = 0;
    this.renderFenceStallForcedForAudit = false;
    this.renderQueued = false;
  }

  private pollWebGLTimingQuery(): void {
    const query = this.webGLTimingPending;
    const extension = this.webGLTimingExtension;
    const gl = this.webGLContext();
    if (!query || !extension || !gl) return;
    let disjoint: boolean;
    let nanoseconds: number;
    try {
      if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) return;
      disjoint = Boolean(gl.getParameter(extension.GPU_DISJOINT_EXT));
      nanoseconds = Number(gl.getQueryParameter(query, gl.QUERY_RESULT));
    } catch {
      try { gl.deleteQuery(query); } catch { /* context may already be invalid */ }
      this.webGLTimingPending = undefined;
      this.useFenceTimingFallback();
      this.recordWebGLTimingSample(Number.NaN);
      return;
    }
    try { gl.deleteQuery(query); } catch { /* result is already consumed */ }
    this.webGLTimingPending = undefined;
    this.webGLTimingSequence++;
    if (disjoint || !Number.isFinite(nanoseconds) || nanoseconds < 0) {
      this.webGLTimingDiscarded++;
      return;
    }
    this.webGLTimingSamples.push(nanoseconds / 1_000_000);
  }

  private renderAndRecordFenceTiming(gl: WebGL2RenderingContext): void {
    const started = performance.now();
    this.app.render();
    if (this.insertWebGLTimingFence(gl, started)) return;
    this.useCpuTimingFallback();
    this.recordWebGLTimingSample(performance.now() - started);
  }

  private insertWebGLTimingFence(gl: WebGL2RenderingContext, started: number): boolean {
    let fence: WebGLSync | null = null;
    try { fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); }
    catch { /* context loss or an incomplete WebGL2 implementation */ }
    if (!fence) return false;
    this.useFenceTimingFallback();
    this.webGLTimingFence = fence;
    this.webGLTimingFenceStartedAt = started;
    try { gl.flush(); }
    catch {
      this.releaseWebGLTimingFence();
      return false;
    }
    this.scheduleWebGLTimingFencePoll();
    return true;
  }

  private scheduleWebGLTimingFencePoll(): void {
    if (this.webGLTimingFencePoll !== 0 || !this.webGLTimingFence
      || this.destroyed || this.contextLost) return;
    this.webGLTimingFencePoll = requestAnimationFrame(() => {
      this.webGLTimingFencePoll = 0;
      if (!this.pollWebGLTimingFence() && this.webGLTimingFence) {
        this.scheduleWebGLTimingFencePoll();
      }
    });
  }

  private pollWebGLTimingFence(): boolean {
    const fence = this.webGLTimingFence;
    if (!fence) return false;
    if (performance.now() - this.webGLTimingFenceStartedAt
      >= webGLPromotionTimeout(this.outputScale)) {
      this.releaseWebGLTimingFence();
      this.recordWebGLTimingSample(Number.NaN);
      return true;
    }
    const gl = this.webGLContext();
    if (!gl || this.contextLost || this.destroyed) {
      this.releaseWebGLTimingFence();
      this.recordWebGLTimingSample(Number.NaN);
      return true;
    }
    let status: number;
    try { status = gl.clientWaitSync(fence, 0, 0); }
    catch { status = gl.WAIT_FAILED; }
    if (status === gl.TIMEOUT_EXPIRED) return false;
    const started = this.webGLTimingFenceStartedAt;
    this.releaseWebGLTimingFence();
    this.recordWebGLTimingSample(
      status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED
        ? performance.now() - started
        : Number.NaN,
    );
    return true;
  }

  private releaseWebGLTimingFence(): void {
    if (this.webGLTimingFencePoll !== 0) {
      cancelAnimationFrame(this.webGLTimingFencePoll);
      this.webGLTimingFencePoll = 0;
    }
    const fence = this.webGLTimingFence;
    const gl = this.webGLContext();
    if (fence && gl) {
      try { gl.deleteSync(fence); } catch { /* context may already be invalid */ }
    }
    this.webGLTimingFence = undefined;
    this.webGLTimingFenceStartedAt = 0;
  }

  private recordWebGLTimingSample(durationMs: number): void {
    this.webGLTimingSequence++;
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      this.webGLTimingDiscarded++;
      return;
    }
    this.webGLTimingSamples.push(durationMs);
  }

  private renderAndRecordCpuTiming(): void {
    const started = performance.now();
    this.app.render();
    this.recordWebGLTimingSample(performance.now() - started);
  }

  private useFenceTimingFallback(): void {
    this.webGLTimingExtension = undefined;
    if (this.webGLTimingSource === 'gpu-fence') return;
    this.webGLTimingSource = 'gpu-fence';
    this.webGLTimingSamples.length = 0;
    this.webGLTimingDiscarded = 0;
    this.webGLTimingSequence = 0;
  }

  private useCpuTimingFallback(): void {
    this.webGLTimingExtension = undefined;
    if (this.webGLTimingSource === 'cpu-submission') return;
    // CPU submission and elapsed GPU time answer different questions. Never
    // publish a percentile assembled from both sources after a driver failure.
    this.webGLTimingSource = 'cpu-submission';
    this.webGLTimingSamples.length = 0;
    this.webGLTimingDiscarded = 0;
    this.webGLTimingSequence = 0;
  }

  private releaseWebGLTimingQuery(): void {
    const query = this.webGLTimingPending;
    const gl = this.webGLContext();
    if (query && gl) {
      try { gl.deleteQuery(query); } catch { /* context may already be invalid */ }
    }
    this.webGLTimingPending = undefined;
  }

  private webGLContext(): WebGL2RenderingContext | undefined {
    return (this.app.renderer as { gl?: WebGL2RenderingContext } | undefined)?.gl;
  }
}

function textureFromBytes(bytes: Uint8Array): Texture {
  const source = new BufferImageSource({
    resource: bytes, width: 256, height: 1, format: 'rgba8unorm',
    alphaMode: 'no-premultiply-alpha', scaleMode: 'nearest', autoGarbageCollect: false,
  });
  return new Texture({ source });
}
