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
  type TextureSource,
  UniformGroup,
} from 'pixi.js';
import { DirtyChunkGrid } from './dirty-chunk-grid';
import {
  WEBGL_EIGHT_X_FRAME_STALL_MS, webGLPromotionTimeout, type FieldOutputScale,
} from './render-resolution';
import { POWDER_SURFACE_REFRESH_INTERVAL } from './powder-surface-field';
import { updateBoundaryStabilityRect } from './boundary-stability-field';
import { clientToCanvasWorld, clientToVisualViewport } from './client-coordinate-map';
import { RenderFieldSet, type RenderMaterialStyle } from './render-field-set';
import { packSemanticRect } from './semantic-field';
import { packPhotonStateRect } from './photon-state-field';
import { photonStateIsActive } from './photon-spectrum-state';
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
import { HDRVfxPipeline, type HDRPipelineInfo } from './hdr-vfx-pipeline';
import {
  resolveGasBodyVfxEnabled, resolveLiquidBodyVfxEnabled, resolvePowderBodyVfxEnabled,
  resolvePowderLightVfxEnabled, resolveRenderLook, resolveVolumeVfxEnabled,
} from './render-look';
interface PresenterViewport { readonly width: number; readonly height: number }

/** Audit-only digest of the field that owns reconstructed gas support. */
export interface AtmosphereSupportAudit {
  readonly nonzero: number;
  readonly alphaSum: number;
  readonly signature: number;
}

interface WebGLTimerQueryExtension {
  readonly TIME_ELAPSED_EXT: number;
  readonly GPU_DISJOINT_EXT: number;
}

export interface WebGLPresentationTiming {
  readonly source: 'gpu-query' | 'gpu-fence' | 'gpu-finish' | 'cpu-submission';
  readonly sequence: number;
  readonly usableSamples: number;
  readonly discardedSamples: number;
  readonly medianMs: number;
  readonly p90Ms: number;
  readonly maximumMs: number;
}

// A browser can expose EXT_disjoint_timer_query_webgl2 yet leave its first
// query unavailable forever after an otherwise-presented frame. The ordinary
// WebGL audit has a five-second completed-frame budget, so diagnose the
// optional precision source before it consumes that whole bounded window.
const WEBGL_TIMING_QUERY_STALL_MS = 2_000;

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

// The 8x mesh runs roughly fifteen million fragments. Keep this semantic
// compositor intentionally compact: SwiftShader and lower-end drivers can
// compile the richer 1x-4x body shader yet lose live values once its full
// branch graph is executed at this scale. This retains exact IDs, phase-owned
// volumes, Grains' square cells, depth response, and premultiplied output.
const FIELD_EIGHT_X_FRAGMENT = `
in vec2 vFieldCoord;
out vec4 finalColor;
uniform sampler2D uFieldTexture;
uniform sampler2D uWallTexture;
uniform sampler2D uPhotonStateTexture;
uniform sampler2D uAtmosphereTexture;
uniform sampler2D uAtmosphereStyleTexture;
uniform sampler2D uEmissionTexture;
uniform sampler2D uLiquidTexture;
uniform sampler2D uSuspensionTexture;
uniform sampler2D uBoundaryStabilityTexture;
uniform sampler2D uPowderSurfaceTexture;
uniform sampler2D uPaletteTexture;
uniform sampler2D uStyleTexture;
uniform vec2 uTexel;
uniform vec2 uAtmosphereTexel;
uniform vec2 uFieldSize;
uniform float uNativeWallsActive;
uniform float uPowderStyle;
uniform float uPowderSurfaceActive;
uniform float uPowderBodyDepth;
uniform float uSuspensionActive;
uniform float uLiquidOpticalDepth;
uniform float uSolidOpticalDepth;
uniform float uSolidCurvatureDepth;
uniform float uGasFieldLighting;
uniform float uGasVolumeChroma;
uniform float uGasIdentityStyling;
uniform float uEmissionVolumeChroma;
uniform float uEnergyCoreRelief;
uniform float uEnergyIdentityStyling;
uniform float uCellularMaterialStyling;
uniform float uStructuralRigidStyling;
uniform float uGeologicalSolidStyling;
uniform float uThermalCatalyticRigidStyling;
uniform float uGooSolidStyling;
uniform float uFrayForceStyling;
uniform float uGbmbForceStyling;
uniform float uMechanismBodyStyling;
uniform float uElectronicIdentityStyling;
uniform float uFieldProfileIdentityStyling;
uniform float uSensorMaterialStyling;
uniform float uExplosivePowderStyling;
uniform float uEarthenPowderStyling;
uniform float uPowderMesostrataStyling;
uniform float uUnusualPowderStyling;
uniform float uUnusualSolidStyling;
uniform float uLiquidFieldLighting;
uniform float uAqueousSurfaceReflection;
uniform float uLiquidVolumeChroma;
uniform float uLiquidIdentityStyling;
uniform float uLiquidSilhouetteCohesion;
uniform float uSurfaceContourLighting;
uniform float uSolidFieldLighting;
uniform float uRoleMaterialStyling;
uniform float uThermalMaterialStyling;
uniform float uTranslucentFieldTransmission;
uniform float uTranslucentBackdropRefraction;
uniform float uTranslucentLensShell;
uniform float uSourceTargetStyling;
uniform float uForceActivityStyling;
uniform float uVibrStateStyling;
uniform float uDeutStateStyling;
uniform float uLavaAncestryStyling;
uniform float uMoltenBodyOptics;
uniform float uBotanicalIdentityStyling;
uniform float uBotanicalLifecycleStyling;
uniform float uSparkStateStyling;
uniform float uPoloStateStyling;
uniform float uSpngStateStyling;
uniform float uGelHydrationStyling;
uniform float uFiltSpectrumStyling;
uniform float uQuartzCrystalStateStyling;
uniform float uLcryStateStyling;
uniform float uPipePresentationStyling;
uniform float uStorStateStyling;
uniform float uSwchStateStyling;
uniform float uDlayStateStyling;
uniform float uWifiStateStyling;
uniform float uPhotonActive;
float materialAt(vec2 uv) {
  return floor(texture(uFieldTexture, clamp(uv, uTexel * 0.5, vec2(1.0) - uTexel * 0.5)).r * 255.0 + 0.5);
}
float same(vec2 uv, float material) { return 1.0 - step(0.5, abs(materialAt(uv) - material)); }
// The stable Smooth-powder field is already uploaded for the normal WebGL
// compositor. At true 8x it is sampled only in a settled Smooth-powder scene;
// Local and Grains stay texture-free references. RGB is density, G/B are the
// bounded field gradient, and A is the compact compatible-neighbour support.
vec4 powderSurfaceEightXShape(vec2 uv) {
  vec4 state = texture(uPowderSurfaceTexture, uv);
  return vec4(
    state.r,
    (state.g * 255.0 - 128.0) / 508.0,
    (state.b * 255.0 - 128.0) / 508.0,
    state.a * 9.0
  );
}
// Native TPT walls are stored separately from particles. The direct 8x mesh
// keeps their raster intentionally compact, but still composites an exact wall
// ID behind transparent matter without putting a wall into the semantic map.
vec3 wallEightXColor(float wall) {
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
float wallEightXPattern(float wall, vec2 worldPosition) {
  vec2 cell = floor(worldPosition);
  float checker = mod(floor(cell.x / 4.0) + floor(cell.y / 4.0), 2.0);
  float pattern = mix(0.94, 1.04, checker);
  if (wall == 6.0) {
    float rail = 1.0 - step(0.5, mod(cell.x * 2.0 + cell.y, 9.0));
    pattern += rail * 0.12;
  } else if (wall == 9.0 || wall == 10.0 || wall == 13.0 || wall == 15.0) {
    float stripe = 1.0 - step(0.5, mod(cell.x + cell.y, 4.0));
    pattern += stripe * 0.12;
  }
  return pattern;
}
float refractedEightXWallPattern(
  float wall, vec2 worldPosition, float material, vec2 boundarySlope
) {
  vec2 cell = floor(worldPosition);
  // Exact projected IDs retain the normal composer's distinction: GLAS=24 is
  // one coherent lens shift, while ICE=12 breaks the wall pattern into a small
  // stable facet pair. Only analytic wall coordinates move; wall ownership and
  // support remain the nearest centre texel already decoded by the caller.
  if (material == 24.0) {
    float hasBoundary = step(0.10, abs(boundarySlope.x) + abs(boundarySlope.y));
    return wallEightXPattern(wall, cell + sign(boundarySlope) * 3.0 * hasBoundary);
  }
  float facet = mod(floor(cell.x / 4.0) + floor(cell.y / 4.0) * 3.0 + material, 4.0);
  vec2 offset = facet == 0.0 ? vec2(2.0, 0.0)
    : (facet == 1.0 ? vec2(-2.0, 0.0)
    : (facet == 2.0 ? vec2(0.0, 2.0) : vec2(0.0, -2.0)));
  offset.x = abs(boundarySlope.x) >= 0.10 ? sign(boundarySlope.x) * 2.0 : offset.x;
  offset.y = abs(boundarySlope.y) >= 0.10 ? sign(boundarySlope.y) * 2.0 : offset.y;
  return wallEightXPattern(wall, cell + offset) * 0.68
    + wallEightXPattern(wall, cell - offset) * 0.32;
}
vec4 compositeEightXWallBackdrop(
  vec4 foreground, float wall, vec2 worldPosition, float refractedMaterial, vec2 boundarySlope
) {
  if (wall < 0.5) return foreground;
  float wallAlpha = 0.94;
  float remaining = 1.0 - foreground.a;
  float pattern = refractedMaterial > 0.5
    ? refractedEightXWallPattern(wall, worldPosition, refractedMaterial, boundarySlope)
    : wallEightXPattern(wall, worldPosition);
  vec3 wallRgb = wallEightXColor(wall) * pattern;
  return vec4(foreground.rgb + wallRgb * wallAlpha * remaining,
    foreground.a + wallAlpha * remaining);
}
// The normal WebGL path also layers a small species motif over atmosphere
// volume. At 15M fragments, true 8x deliberately keeps only the existing R8
// propagated style sample and its dense-body key. This preserves a continuous
// cloud read without a second motif sample or cell-frequency dot pattern.
vec3 gasIdentityEightXDelta(float style, float density) {
  float support = smoothstep(0.10, 0.70, density);
  vec3 key;
  if (style < 1.5) key = vec3(-4.0, -4.0, -3.0); // Smoke
  else if (style < 2.5) key = vec3(1.0, 2.0, 3.0); // Steam
  else if (style < 3.5) key = vec3(3.0, 2.0, -1.0); // Gas
  else if (style < 4.5) key = vec3(0.0, 2.0, 3.0); // Oxygen
  else if (style < 5.5) key = vec3(1.0, 1.0, 3.0); // Hydrogen
  else if (style < 6.5) key = vec3(-3.0, -2.0, -1.0); // CO2
  else if (style < 7.5) key = vec3(2.0, 1.0, 3.0); // Noble gas
  else if (style < 8.5) key = vec3(3.0, 0.0, -2.0); // BOYL
  else if (style < 9.5) key = vec3(-1.0, 3.0, -1.0); // CAUS
  else if (style < 10.5) key = vec3(2.0); // FOG
  else if (style < 11.5) key = vec3(-1.0, 2.0, 4.0); // RFRG
  else if (style < 12.5) key = vec3(-1.0, 1.0, 4.0); // CFLM
  else if (style < 13.5) key = vec3(-4.0, -2.0, -4.0); // AMTR
  else if (style < 14.5) key = vec3(2.0, -2.0, 3.0); // WARP
  else if (style < 15.5) key = vec3(3.0, -2.0, 3.0); // BIZRG
  else if (style < 16.5) key = vec3(-2.0); // MORT
  else key = vec3(3.0, -2.0, 3.75); // VRSG retains its magenta distinction.
  return key * support / 255.0;
}
vec3 gasIdentityEightXChroma(float style, float density) {
  // Carry the normal presenter's readable Noble-Gas violet key/fill into the
  // compact compositor. It remains density-gated and below a 0.016 source
  // channel before the existing low-opacity cloud composite, so it neither
  // changes support nor consumes the bounded gas-volume response budget.
  return style > 6.5 && style < 7.5
    ? vec3(0.014, -0.009, 0.016) * density : vec3(0.0);
}
// The direct compositor otherwise has only one atmosphere sample, so deep
// clouds remain continuous but read flatter than the normal WebGL path. Reuse
// four alpha-only cardinal probes from that same shared field to restore a
// restrained crown/pocket and directional rim. This deliberately returns RGB
// only: atmosphere alpha remains the sole owner of gas support and final
// opacity, and neighbour RGB/species are never blended across a cloud.
vec3 gasEightXVolumeRelief(
  float density, float left, float right, float top, float bottom
) {
  float neighbourMean = (left + right + top + bottom) * 0.25;
  float curvature = clamp((density - neighbourMean) * 8.0, -1.0, 1.0);
  float crown = max(curvature, 0.0);
  float pocket = max(-curvature, 0.0);
  vec2 slope = vec2(right - left, bottom - top);
  float slopeLength2 = dot(slope, slope);
  float directional = 0.0;
  if (slopeLength2 > 0.00001) {
    vec2 outward = -slope * inversesqrt(slopeLength2);
    directional = max(0.0, dot(outward, vec2(-0.58, -0.815)));
  }
  float opticalDepth = smoothstep(0.035, 0.62, density);
  float shell = smoothstep(0.014, 0.28, density)
    * (1.0 - smoothstep(0.54, 0.94, density));
  float key = (crown * 0.52 + directional * shell * 0.74)
    * (1.0 - opticalDepth * 0.42);
  float shade = pocket * (0.22 + opticalDepth * 0.50);
  return vec3(0.060, 0.076, 0.108) * key
    - vec3(0.038, 0.026, 0.052) * shade;
}
// The direct 8x mesh cannot afford the normal composer's clock-driven energy
// motifs, but it must retain the same nine native identities. These are the
// static phase of the normal integer grammar: Fire remains a rising warm
// tongue, Plasma a violet cell, charged carriers keep their own rails, and
// EMBR remains detached sparks rather than a generic coloured volume. The
// helper is deliberately arithmetic-only and RGB-only; coverage, emission
// support, and alpha remain owned by the existing semantic/emission paths.
vec3 energyEightXIdentityDelta(float material, vec2 cell) {
  vec3 delta = vec3(0.0);
  if (material == 4.0) {
    float tongue = mod(cell.x * 3.0 + cell.y, 16.0);
    float crest = mod(cell.y, 8.0);
    delta = tongue < 5.0
      ? vec3(9.0, 5.0 + (crest < 2.0 ? 3.0 : 0.0), -4.0)
      : vec3(-2.0, -2.0, 1.0);
  } else if (material == 20.0) {
    float localX = mod(cell.x, 8.0);
    float localY = mod(cell.y, 8.0);
    float membrane = abs(localX - 4.0) + abs(localY - 4.0);
    delta = vec3(
      membrane >= 4.0 && membrane <= 6.0 ? 8.0 : -2.0,
      membrane >= 4.0 && membrane <= 6.0 ? 3.0 : 0.0,
      membrane <= 2.0 ? 8.0 : 2.0
    );
  } else if (material == 101.0) {
    float branch = mod(cell.x * 3.0 + cell.y * 5.0, 16.0);
    float node = mod(cell.x + cell.y, 8.0);
    delta = branch <= 2.0
      ? vec3(8.0, 11.0, 13.0)
      : vec3(-2.0, 1.0, 4.0 + (node < 0.5 ? 5.0 : 0.0));
  } else if (material == 103.0) {
    vec2 local = mod(cell, 16.0) - 8.0;
    float ring = mod(dot(local, local), 32.0);
    bool rim = ring >= 10.0 && ring <= 16.0;
    delta = rim ? vec3(-5.0, 3.0, 11.0) : vec3(3.0, -2.0, 5.0);
  } else if (material == 106.0) {
    float track = mod(cell.x * 5.0 - cell.y * 3.0, 16.0);
    float gap = mod(cell.x + cell.y * 2.0, 8.0);
    delta = track <= 1.0 && gap > 1.0 ? vec3(4.0, 9.0, 8.0) : vec3(-3.0, 1.0, 2.0);
  } else if (material == 107.0) {
    float band = mod(cell.x + cell.y, 16.0);
    delta = band <= 2.0 ? vec3(11.0, 10.0, 4.0)
      : (band >= 8.0 && band <= 10.0 ? vec3(-4.0, 1.0, 10.0) : vec3(1.0, 3.0, 2.0));
  } else if (material == 110.0) {
    float rail = mod(cell.x * 2.0 - cell.y, 8.0);
    float bead = mod(cell.x + cell.y * 3.0, 16.0);
    delta = rail <= 1.0 ? vec3(12.0, 5.0 + (bead <= 2.0 ? 5.0 : 0.0), 2.0)
      : vec3(-2.0, 1.0, 5.0);
  } else if (material == 197.0) {
    float rail = abs(mod(cell.x - cell.y, 16.0) - 8.0);
    float node = mod(cell.x + cell.y, 16.0);
    delta = rail <= 1.0
      ? vec3(10.0, 8.0 + (node <= 2.0 ? 5.0 : 0.0), 5.0 + (node <= 2.0 ? 7.0 : 0.0))
      : vec3(-2.0, 0.0, 3.0);
  } else if (material == 200.0) {
    float spark = mod(cell.x * 17.0 + cell.y * 31.0 + floor(cell.x * cell.y * 0.125) + material, 32.0);
    delta = spark < 4.0 ? vec3(13.0, 8.0, -2.0) : vec3(-3.0, -1.0, 2.0);
  }
  return clamp(delta, vec3(-14.0), vec3(14.0)) / 255.0;
}
// The direct 8x compositor cannot carry the normal presenter's animated role
// waves, but sources, sinks, channels, and force materials still need a clear
// semantic read at deep zoom. This exact trait-bit grammar is static and
// owner-local: it reuses the decoded style byte, world position, and density,
// adds no sampler/field/pass/clock, and leaves alpha and support untouched.
float roleEightXTrait(float traits, float mask) {
  return mod(floor(traits / mask), 2.0);
}
vec3 roleEightXDelta(float traits, vec2 position, float density) {
  float emitter = roleEightXTrait(traits, 1.0);
  float sink = roleEightXTrait(traits, 2.0);
  float channel = roleEightXTrait(traits, 4.0);
  float force = roleEightXTrait(traits, 8.0);
  if (emitter + sink + channel + force < 0.5) return vec3(0.0);
  vec2 local = fract(position / 24.0) - 0.5;
  float radius = length(local);
  float core = 1.0 - smoothstep(0.10, 0.17, radius);
  float ring = 1.0 - smoothstep(0.025, 0.060, abs(radius - 0.31));
  float innerRing = 1.0 - smoothstep(0.025, 0.055, abs(radius - 0.20));
  float outerRing = 1.0 - smoothstep(0.025, 0.055, abs(radius - 0.40));
  float railDistance = abs(fract((position.x - position.y) / 14.0) - 0.5);
  float rail = 1.0 - smoothstep(0.050, 0.120, railDistance);
  float nodePhase = fract((position.x + position.y) / 12.0);
  float node = rail * (1.0 - smoothstep(0.070, 0.150, min(nodePhase, 1.0 - nodePhase)));
  vec3 delta = vec3(0.0);
  if (emitter > 0.5) delta += vec3(14.0, 7.0, -3.0) * (0.14 + core * 0.74 + ring * 0.46);
  if (sink > 0.5) delta += vec3(-3.0, 8.0, 16.0) * (0.12 + core * 0.56 + ring * 0.60);
  if (channel > 0.5) delta += vec3(1.0, 8.0, 15.0) * (rail * 0.52 + node * 0.62);
  if (force > 0.5) delta += vec3(-2.0, 10.0, 17.0)
    * (0.10 + innerRing * 0.52 + outerRing * 0.68);
  return clamp(delta * smoothstep(0.08, 0.72, density), vec3(-20.0), vec3(20.0)) / 255.0;
}
// Default-optics Field-profile special bodies carry a compact interference
// vocabulary. Normal WebGL gives them a moving interference wave; the true-8x
// compositor keeps an equivalent deliberately static so it costs no
// clock/state/resource and remains repeatable through fence recovery. The
// exact owner merely selects a compact vocabulary: TRON gets a lime rail,
// portals a directional aperture, holes a dark core/rim, and vents a pale
// pressure ring. Device-optics force/source bodies remain on their existing
// path. This is RGB-only arithmetic over already-decoded world coordinates and
// density: it cannot affect alpha, support, physics, walls, or the later native
// target/role overlays.
vec3 fieldProfileEightXDelta(float material, vec2 position, float density) {
  vec2 cell = floor(position);
  float support = smoothstep(0.08, 0.72, density);
  float fieldBand = 1.0 - abs(fract((cell.x + cell.y * 0.62 + material * 0.37) / 12.0) * 2.0 - 1.0);
  float fieldCross = 1.0 - step(0.5, mod(cell.x * 3.0 + cell.y * 5.0 + material, 13.0));
  vec3 delta = vec3(-3.0, 4.0, 10.0) * (fieldBand - 0.46) * 0.72
    + vec3(1.0, 3.0, 6.0) * fieldCross * 0.30;
  vec2 tile = mod(cell, 16.0) - vec2(7.5);
  float radius2 = dot(tile, tile);
  float apertureCore = 1.0 - smoothstep(3.0, 26.0, radius2);
  float apertureRing = smoothstep(13.0, 32.0, radius2)
    * (1.0 - smoothstep(45.0, 74.0, radius2));
  float spoke = 1.0 - step(0.5, mod(cell.x * 5.0 - cell.y * 3.0 + material, 11.0));
  if (material == 132.0) {
    float tronRail = max(
      1.0 - step(0.5, mod(cell.x + cell.y * 2.0, 7.0)),
      1.0 - step(0.5, mod(cell.x * 2.0 - cell.y, 11.0))
    );
    delta = vec3(2.0, 19.0, -7.0) * (0.26 + tronRail * 0.74)
      + vec3(-2.0, 4.0, 1.0) * fieldBand;
  } else if (material == 130.0 || material == 131.0) {
    vec3 portalKey = material == 130.0 ? vec3(17.0, 5.0, -3.0) : vec3(-4.0, 8.0, 18.0);
    delta = portalKey * (apertureRing * 0.86 + spoke * 0.24)
      - vec3(4.0, 3.0, 5.0) * apertureCore * 0.38;
  } else if (material == 125.0 || material == 128.0 || material == 133.0) {
    vec3 rim = material == 133.0 ? vec3(15.0, 1.0, -2.0) : vec3(5.0, 1.0, 13.0);
    delta = rim * (apertureRing * 0.76 + spoke * 0.16)
      - vec3(5.0, 4.0, 6.0) * apertureCore * 0.56;
  } else if (material == 129.0 || material == 134.0) {
    delta = vec3(5.0, 13.0, 18.0) * (apertureRing * 0.74 + spoke * 0.32)
      - vec3(2.0, 1.0, 2.0) * apertureCore * 0.16;
  }
  return clamp(delta * support, vec3(-18.0), vec3(18.0)) / 255.0;
}
// Temperature is already packed into the centre semantic sample used by this
// direct compositor. Retain the normal path's ambient dead band and bounded
// cold/warm/incandescent response without adding a sampler, field, pass, or
// clock to the fifteen-million-fragment frame.
float thermalEightXOpticsGain(float optics) {
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
vec3 thermalEightXDelta(float temperatureByte, float optics) {
  float cold = smoothstep(1.0, 7.0, 11.0 - temperatureByte);
  float warm = smoothstep(2.0, 55.0, temperatureByte - 11.0);
  float incandescent = smoothstep(0.55, 1.0, warm);
  float gain = thermalEightXOpticsGain(optics) / 255.0;
  return vec3(
    -3.0 * cold + 17.0 * warm + 9.0 * incandescent,
    2.0 * cold + 4.0 * warm + 6.0 * incandescent,
    14.0 * cold - 7.0 * warm + incandescent
  ) * gain;
}
vec3 liquidEightXMeniscusKey(float optics) {
  if (optics == 1.0) return vec3(0.52, 0.88, 1.00); // Aqueous
  if (optics == 2.0) return vec3(1.00, 0.72, 0.28); // Oily
  if (optics == 3.0) return vec3(0.44, 1.00, 0.68); // Corrosive
  if (optics == 16.0) return vec3(0.70, 0.92, 1.00); // Cryogenic
  if (optics == 17.0) return vec3(1.00, 0.98, 0.94); // Metallic
  return vec3(0.82, 0.92, 1.00); // Viscous
}
vec3 liquidEightXMeniscusShadow(float optics) {
  if (optics == 1.0) return vec3(1.00, 0.62, 0.36); // Aqueous
  if (optics == 2.0) return vec3(0.40, 0.68, 1.00); // Oily
  if (optics == 3.0) return vec3(0.72, 0.38, 0.62); // Corrosive
  if (optics == 16.0) return vec3(0.78, 0.86, 1.00); // Cryogenic
  if (optics == 17.0) return vec3(0.58, 0.62, 0.70); // Metallic
  return vec3(0.70, 0.64, 0.58); // Viscous
}
// WAX and MWAX are native phase partners rather than unrelated materials. Keep
// one compact, world-anchored 32-cell lamella/bloom grammar at true 8x while
// allowing molten wax to soften through the density/depth values already live
// in the liquid branch. This is RGB-only arithmetic: no sampler, clock,
// derivative, alpha, support, or ownership decision is introduced here.
vec3 waxEightXIdentityDelta(float phase, vec2 worldPosition, float density, float depth) {
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
  float support = smoothstep(0.08, 0.72, density);
  if (phase > 0.5) support *= 0.48 + depth * 0.52;
  return clamp(delta * support, vec3(-14.0), vec3(14.0)) / 255.0;
}
// The normal path has a richer fourteen-material liquid grammar. At 15M
// fragments, the same fourteen public and radioactive liquid identities share one small
// material-seeded grammar: duplicating fourteen independent motif trees can exceed
// SwiftShader's live-register budget. The selected material supplies stable
// phase and hue; density/depth/slope are already live in the liquid branch.
vec3 liquidIdentityEightXDelta(
  float material, vec2 worldPosition, float density, float depth, vec2 slope
) {
  float support = smoothstep(0.12, 0.82, density) * (0.48 + depth * 0.52);
  // Metallic and cryogenic liquids need exact public identities on top of
  // their shared body optics. Keep these broad world-space bands ahead of the
  // compact seeded grammar: they are RGB-only arithmetic with no sample,
  // field, clock, alpha, or support decision in the 15M-fragment path.
  if (material == 36.0 || material == 95.0) {
    float mirror = 1.0 - abs(fract(
      worldPosition.x * 0.034 + worldPosition.y * 0.009 + material * 0.017
    ) * 2.0 - 1.0);
    float shoulder = smoothstep(0.62, 0.92, mirror);
    float pocket = 1.0 - smoothstep(0.20, 0.50, mirror);
    float slopeKey = clamp(0.50 - slope.x * 0.24 - slope.y * 0.31, 0.0, 1.0);
    vec3 key = material == 36.0 ? vec3(0.040, 0.050, 0.062) : vec3(0.026, 0.037, 0.056);
    vec3 shadow = material == 36.0 ? vec3(0.031, 0.032, 0.037) : vec3(0.040, 0.034, 0.033);
    return clamp((key * shoulder * (0.55 + slopeKey * 0.45) - shadow * pocket)
      * support, vec3(-0.055), vec3(0.055));
  }
  if (material == 37.0 || material == 58.0) {
    float ripple = 1.0 - abs(fract(
      worldPosition.x * 0.053 - worldPosition.y * 0.021 + material * 0.031
    ) * 2.0 - 1.0);
    float frost = smoothstep(0.64, 0.92, ripple);
    float trough = 1.0 - smoothstep(0.22, 0.52, ripple);
    float slopeKey = clamp(0.50 - slope.x * 0.18 - slope.y * 0.34, 0.0, 1.0);
    vec3 key = material == 37.0 ? vec3(0.006, 0.042, 0.064) : vec3(0.003, 0.029, 0.065);
    vec3 shadow = material == 37.0 ? vec3(0.015, 0.008, 0.006) : vec3(0.017, 0.010, 0.004);
    return clamp((key * frost * (0.52 + slopeKey * 0.48) - shadow * trough)
      * support, vec3(-0.055), vec3(0.055));
  }
  vec2 cell = floor(worldPosition);
  float seed = material * 0.618034;
  float diagonal = fract(cell.x * (0.052 + fract(seed) * 0.018)
    + cell.y * (0.034 + fract(seed * 0.5) * 0.015) + seed) * 2.0 - 1.0;
  float ribbon = 1.0 - abs(diagonal);
  float fold = 1.0 - abs(fract((cell.x - cell.y) * 0.046875 + seed * 0.37) * 2.0 - 1.0);
  float slopeLight = clamp(0.5 - slope.x * 0.24 - slope.y * 0.32, 0.0, 1.0);
  vec3 hue = vec3(
    fract(seed * 0.381966), fract(seed * 0.618034), fract(seed * 0.173205)
  ) - vec3(0.5);
  float motif = (ribbon - 0.44) * 0.72 + (fold - 0.44) * 0.28;
  vec3 identity = (vec3(0.018, 0.022, 0.026) + hue * 0.056)
    * motif + hue * (slopeLight - 0.5) * 0.018;
  return clamp(identity * support, vec3(-0.055), vec3(0.055));
}
// Lava's exact native ctype is retained in the shared packed B/A word. Keep
// the ancestry grammar in this direct shader compact and owner-local: no field
// reconstruction, alpha decision, or additional sampler is needed at 15M
// fragments. The native present bit makes untyped Lava an exact no-op.
float lavaAncestryEightXFamily(float origin) {
  if (origin == 1.0 || origin == 21.0 || origin == 22.0 || origin == 24.0
    || origin == 25.0 || origin == 26.0 || origin == 28.0 || origin == 29.0
    || origin == 44.0 || origin == 76.0 || origin == 78.0) return 1.0;
  if (origin == 23.0 || origin == 30.0 || origin == 46.0 || origin == 67.0
    || origin == 70.0 || origin == 72.0 || origin == 73.0 || origin == 75.0
    || origin == 82.0 || origin == 151.0) return 2.0;
  if (origin == 7.0 || origin == 94.0) return 3.0;
  if (origin == 51.0 || origin == 143.0 || origin == 144.0
    || origin == 145.0 || origin == 146.0 || origin == 147.0) return 4.0;
  if (origin == 108.0 || origin == 109.0 || origin == 112.0) return 5.0;
  return 0.0;
}
vec3 lavaAncestryEightXDelta(float packedState, vec2 position) {
  if (mod(floor(packedState / 256.0), 2.0) < 0.5) return vec3(0.0);
  float origin = mod(packedState, 256.0);
  float family = lavaAncestryEightXFamily(origin);
  if (family < 0.5) return vec3(0.0);
  vec2 cell = floor(position);
  float identityMark = step(mod(cell.x * 3.0 + cell.y * 5.0 + origin * 7.0, 17.0), 1.0);
  float familyBand = step(
    mod(cell.x * (family + 1.0) - cell.y * (6.0 - family) + origin, 23.0), 1.0
  );
  float gain = identityMark > 0.5 ? 1.0 : familyBand > 0.5 ? 0.56 : 0.18;
  vec3 key = family == 1.0 ? vec3(-5.0, 6.0, 14.0)
    : family == 2.0 ? vec3(2.0, 12.0, 4.0)
    : family == 3.0 ? vec3(-6.0, 14.0, 9.0)
    : family == 4.0 ? vec3(-10.0, 9.0, 16.0)
    : vec3(-6.0, 16.0, -2.0);
  return clamp(key * gain, vec3(-16.0), vec3(16.0)) / 255.0;
}
// SPRK retains its exact native host and bounded life in the shared packed
// B/A word. Keep the owner-local direct form static and RGB-only: true 8x
// reuses the one state/wall decode already needed by other native owners.
float sparkEightXHostFamily(float host) {
  if (host == 23.0 || host == 36.0 || host == 45.0 || host == 46.0
    || host == 61.0 || host == 67.0 || host == 70.0 || host == 73.0
    || host == 75.0 || host == 82.0 || host == 95.0 || host == 96.0
    || host == 151.0) return 1.0;
  if (host == 51.0 || host == 144.0 || host == 146.0) return 2.0;
  if (host == 145.0 || host == 147.0) return 3.0;
  if (host == 135.0 || host == 136.0 || host == 140.0 || host == 142.0
    || host == 143.0 || host == 149.0 || host == 150.0 || host == 164.0
    || host == 166.0 || host == 167.0 || host == 168.0 || host == 169.0
    || host == 170.0) return 4.0;
  if (host == 2.0 || host == 16.0 || host == 53.0 || host == 55.0) return 5.0;
  return 0.0;
}
vec3 sparkStateEightXDelta(float packedState, vec2 position, vec3 sourceColor) {
  if (packedState < 32768.0) return vec3(0.0);
  float host = mod(packedState, 256.0);
  float family = sparkEightXHostFamily(host);
  if (host < 0.5 || family < 0.5) return vec3(0.0);
  float life = min(127.0, mod(floor(packedState / 256.0), 128.0));
  float lifecycle = min(1.0, life / 4.0);
  vec2 world = floor(position);
  float carrier = mod(world.x * 3.0 + world.y * 5.0 + family * 7.0, 11.0) <= 1.0
    ? 1.0 : 0.0;
  float junction = mod(world.x - world.y * 2.0 + family * 5.0, 17.0) == 0.0
    ? 1.0 : 0.0;
  float geometry = carrier > 0.5 ? 1.0 : junction > 0.5 ? 0.68 : 0.30;
  float blend = (0.25 + lifecycle * 0.75) * geometry * 0.18;
  vec3 target = family == 1.0 ? vec3(145.0, 198.0, 255.0)
    : family == 2.0 ? vec3(218.0, 120.0, 255.0)
    : family == 3.0 ? vec3(255.0, 178.0, 74.0)
    : family == 4.0 ? vec3(105.0, 184.0, 255.0)
    : vec3(70.0, 235.0, 255.0);
  return mix(min(sourceColor, vec3(1.0)), target / 255.0, blend) - sourceColor;
}
// POLO's native emissions, cooldown, and proton dose share this same B/A
// state word. The compact radioactive lifecycle grammar remains static and
// RGB-only at true 8x; presence is the canonical bit eleven projection.
vec3 poloStateEightXDelta(float packedState, vec2 position) {
  if (mod(floor(packedState / 2048.0), 2.0) < 0.5) return vec3(0.0);
  float emissions = mod(packedState, 8.0);
  float cooldown = mod(floor(packedState / 8.0), 16.0);
  float protonDose = mod(floor(packedState / 128.0), 16.0);
  vec2 world = floor(position);
  vec2 local = mod(world, 16.0);
  vec2 centred = local - 8.0;
  float radiusSquared = dot(centred, centred);
  vec3 delta = vec3(0.0);
  if (emissions >= 5.0) {
    bool ashFacet = mod(world.x + world.y * 3.0, 8.0) < 0.5;
    delta = ashFacet ? vec3(16.0, 7.0, 16.0) : vec3(10.0, 2.0, 13.0);
  } else if (cooldown > 0.0) {
    float boundedCooldown = min(15.0, cooldown);
    float heat = boundedCooldown / 15.0;
    float shellRadiusSquared = 16.0 + (15.0 - boundedCooldown) * 2.0;
    bool shell = abs(radiusSquared - shellRadiusSquared) <= 5.0;
    bool ray = centred.x == 0.0 || centred.y == 0.0
      || abs(centred.x) == abs(centred.y);
    delta = shell ? vec3(12.0 + heat * 4.0, 6.0 + heat * 5.0, -6.0 + heat * 2.0)
      : ray ? vec3(6.0 + heat * 4.0, 6.0 + heat * 3.0, -2.0)
      : vec3(1.0 + heat * 3.0, 2.0 + heat * 3.0, heat);
  } else {
    bool readyRing = radiusSquared >= 25.0 && radiusSquared <= 49.0;
    bool readyCore = radiusSquared <= 4.0;
    bool neutronRay = centred.x == 0.0 || centred.y == 0.0
      || abs(centred.x) == abs(centred.y);
    delta = readyRing ? vec3(7.0, 16.0, 9.0)
      : readyCore ? vec3(5.0, 12.0, 7.0)
      : neutronRay ? vec3(4.0, 10.0, 5.0) : vec3(2.0, 5.0, 3.0);
  }
  if (protonDose > 0.0) {
    float progress = min(10.0, protonDose) / 10.0;
    float filledHeight = ceil(progress * 12.0);
    bool captureRung = local.y >= 16.0 - filledHeight
      && mod(local.x + local.y, 4.0) <= 1.0;
    delta += progress * (captureRung ? vec3(10.0, -3.0, 7.0) : vec3(2.0, -1.0, 2.0));
  }
  return clamp(delta, vec3(-16.0), vec3(16.0)) / 255.0;
}
// SPNG and GEL carry disjoint owner-guarded hydration meanings in the same
// packed B/A word. Keeping both in this one already-compiled call site avoids
// another state helper/register class in the 15M-fragment shader.
vec3 hydrationStateEightXDelta(float material, float packedState, vec2 position) {
  if (material == 56.0) {
    float hydration = min(100.0, mod(packedState, 128.0));
    if (hydration < 0.5) return vec3(0.0);
    float moisture = hydration / 100.0;
    vec2 world = floor(position);
    // True 8x keeps GEL's native orange-to-blue body delta and a sparse
    // world-anchored wet vein/lip cue, but deliberately avoids the normal
    // path's radial pocket intermediates. This shared SPNG/GEL helper remains
    // below the direct shader's register budget at 15M fragments.
    float waterVein = 1.0 - step(1.5, mod(world.x * 3.0 - world.y * 2.0, 17.0));
    float upperLip = (1.0 - step(1.5, mod(world.x + world.y, 5.0)))
      * (1.0 - step(1.5, mod(world.x * 2.0 - world.y, 11.0)));
    vec3 delta = hydration * vec3(-223.0 / 120.0, -138.0 / 120.0, 208.0 / 120.0) * 0.62;
    delta += vec3(3.0, 4.0, 2.0) * waterVein * moisture;
    delta += vec3(6.0, 8.0, 2.0) * upperLip * moisture;
    return clamp(delta, vec3(-124.0), vec3(124.0)) / 255.0;
  }
  if (mod(floor(packedState / 64.0), 2.0) < 0.5) return vec3(0.0);
  float hydration = min(50.0, mod(packedState, 64.0));
  if (hydration < 0.5) return vec3(0.0);
  float moisture = hydration / 50.0;
  vec2 world = floor(position);
  vec2 local = mod(world, 19.0);
  vec2 first = local - vec2(5.0);
  vec2 second = local - vec2(14.0, 12.0);
  float firstRadius = dot(first, first);
  float secondRadius = dot(second, second);
  bool poreCore = firstRadius <= 4.0 || secondRadius <= 3.0;
  bool firstWall = firstRadius >= 5.0 && firstRadius <= 12.0;
  bool secondWall = secondRadius >= 4.0 && secondRadius <= 10.0;
  bool litLip = (firstWall && first.x + first.y <= -2.0)
    || (secondWall && second.x + second.y <= -2.0);
  bool wetGlint = litLip && mod(world.x - world.y, 4.0) <= 1.0;
  vec3 delta = vec3(-16.0, -12.0, -5.0);
  // The compact direct compositor intentionally omits the normal path's
  // intermediate pore passes. Retain its readable deep-wet body progression
  // with one owner-local scalar instead: low and mid hydration keep the
  // ordinary porous lift, while only the genuinely saturated core gains the
  // restrained absorbed-light response. This is RGB-only arithmetic over the
  // already decoded state, so it cannot alter support, alpha, or topology.
  float soakedCore = smoothstep(0.45, 1.0, moisture);
  delta += vec3(-9.0, -6.0, -2.0) * soakedCore;
  if (wetGlint) delta += vec3(10.0, 16.0, 22.0);
  else if (poreCore) delta += vec3(-4.0, -2.0, 8.0);
  else if (firstWall || secondWall) delta += vec3(-2.0, 1.0, 6.0);
  return clamp(delta * moisture, vec3(-28.0), vec3(20.0)) / 255.0;
}
// Native PQRT/QRTZ use tmp2 as an exact 0..10 crystal seed. Keep this compact
// and owner-local so true 8x reuses the one existing packed-state fetch.
vec3 quartzCrystalStateEightXDelta(float material, float packedState) {
  if (material != 29.0 && material != 76.0) return vec3(0.0);
  float speckle = min(10.0, mod(packedState, 16.0));
  float signedSeed = (speckle - 5.0) * 16.0;
  vec3 key = material == 76.0 ? vec3(0.29, 0.34, 0.47) : vec3(0.33, 0.31, 0.38);
  return clamp(signedSeed * key, vec3(-80.0), vec3(80.0)) / 255.0;
}
// Native LCRY's tmp2 brightness is an exact grayscale response. Its owner bit
// distinguishes uncharged LCRY from unrelated words on the packed shared
// state plane, so true 8x can reuse the same one guarded fetch.
vec3 lcryStateEightXDelta(vec3 color, float packedState) {
  if (packedState < 32768.0) return vec3(0.0);
  float brightness = min(10.0, mod(packedState, 16.0));
  float gray = 80.0 + brightness * 16.0;
  return vec3(gray / 255.0) - color;
}
// Native SWCH is visibly conducting only while its retained life is in the
// on range. Reuse the shared packed state with a compact RGB-only emerald cue;
// an absent or off word must be an exact no-op.
vec3 swchStateEightXDelta(vec3 color, float packedState) {
  bool present = packedState >= 32768.0;
  bool on = mod(packedState, 2.0) > 0.5;
  if (!present || !on) return vec3(0.0);
  vec3 styled = color * vec3(0.66, 0.82, 0.70) + vec3(16.0, 100.0, 42.0) / 255.0;
  return clamp(styled, 0.0, 1.0) - color;
}
// DLAY retains its live native countdown in the existing packed word. The
// semantic owner and bit-15 marker guard an idle zero independently of every
// other state owner; temperature only reconstructs the native delay range.
vec3 dlayCountdownEightXDelta(vec3 color, float packedState, float temperatureNormalized) {
  if (packedState < 32768.0) return vec3(0.0);
  float countdown = mod(packedState, 32768.0);
  if (countdown < 0.5) return vec3(0.0);
  float temperatureKelvin = floor(temperatureNormalized * 255.0 + 0.5)
    * (65536.0 / 255.0 / 10.0);
  float configuredDelay = clamp(temperatureKelvin - 273.15, 1.0, 600.0);
  float elapsed = 1.0 - clamp(countdown / configuredDelay, 0.0, 1.0);
  vec3 styled = mix(color, vec3(236.0, 132.0, 66.0) / 255.0, 0.12 + elapsed * 0.32);
  return clamp(styled, 0.0, 1.0) - color;
}
// WIFI stores its temperature-selected native channel and current broadcast
// latch in this same packed word. The exact owner/presence guard keeps the
// RGB-only spectral rail isolated from every other multiplexed state owner.
vec3 wifiStateEightXDelta(vec3 color, float packedState) {
  if (packedState < 32768.0) return vec3(0.0);
  float channel = min(100.0, mod(packedState, 128.0)) / 100.0;
  bool wifiActive = mod(floor(packedState / 128.0), 2.0) > 0.5;
  vec3 target = vec3(76.0 + channel * 156.0, 184.0 - channel * 82.0,
    224.0 - channel * 134.0) / 255.0;
  vec3 styled = mix(color, target, wifiActive ? 0.50 : 0.28);
  if (wifiActive) styled += vec3(8.0, 14.0, 18.0) / 255.0;
  return clamp(styled, 0.0, 1.0) - color;
}
// PIPE/PPIP retain their carriage in ctype. This compact, palette-free
// grammar reuses the existing packed state and changes RGB only.
vec3 pipePresentationEightXDelta(vec3 color, float material, float packedState) {
  float payload = mod(packedState, 256.0);
  bool loaded = mod(floor(packedState / 256.0), 2.0) > 0.5;
  float route = mod(floor(packedState / 512.0), 4.0);
  bool paused = material == 160.0 && mod(floor(packedState / 2048.0), 2.0) > 0.5;
  vec3 styled = color;
  if (loaded && payload > 0.5) {
    bool liquidPayload = payload == 2.0 || payload == 8.0 || payload == 11.0 || payload == 12.0
      || payload == 13.0 || payload == 16.0 || (payload >= 34.0 && payload <= 38.0)
      || payload == 63.0 || payload == 64.0 || payload == 71.0;
    bool gasPayload = payload == 4.0 || payload == 5.0 || payload == 15.0 || payload == 17.0
      || payload == 20.0 || (payload >= 39.0 && payload <= 42.0) || payload == 65.0
      || payload == 87.0 || payload == 101.0 || payload == 106.0 || payload == 107.0 || payload == 110.0;
    bool granularPayload = payload == 1.0 || payload == 6.0 || payload == 7.0 || payload == 14.0
      || payload == 18.0 || payload == 21.0 || payload == 28.0 || (payload >= 30.0 && payload <= 33.0)
      || (payload >= 84.0 && payload <= 88.0);
    vec3 target = liquidPayload ? vec3(58.0, 148.0, 192.0)
      : gasPayload ? vec3(160.0, 102.0, 210.0)
      : granularPayload ? vec3(202.0, 148.0, 66.0) : vec3(118.0, 166.0, 185.0);
    styled = mix(styled, target / 255.0, 0.42);
  } else if (loaded) {
    styled = mix(styled, vec3(144.0, 150.0, 160.0) / 255.0, 0.34);
  } else {
    vec3 routeTarget = route < 0.5 ? vec3(83.0, 122.0, 174.0)
      : route < 1.5 ? vec3(62.0, 167.0, 185.0)
      : route < 2.5 ? vec3(193.0, 139.0, 66.0) : vec3(168.0, 91.0, 184.0);
    styled = mix(styled, routeTarget / 255.0, 0.27);
  }
  if (paused) styled = styled * vec3(0.91, 0.93, 0.98) + vec3(9.0, 11.0, 16.0) / 255.0;
  return styled - color;
}
// STOR keeps a single captured particle in tmp. Project its existing packed
// native state as a compact cyan reservoir; cooldown merely cools that bay.
// The semantic STOR owner remains the sole guard, and no support/alpha state
// or extra texture is introduced on the direct 8x path.
vec3 storStateEightXDelta(vec3 color, float packedState) {
  float payload = mod(packedState, 256.0);
  bool loaded = mod(floor(packedState / 256.0), 2.0) > 0.5;
  bool cooldown = mod(floor(packedState / 512.0), 2.0) > 0.5;
  if (!loaded && !cooldown) return vec3(0.0);
  vec3 styled = color;
  if (loaded && payload > 0.5) {
    bool liquidPayload = payload == 2.0 || payload == 8.0 || payload == 12.0;
    bool gasPayload = payload == 4.0 || payload == 5.0 || payload == 15.0;
    bool granularPayload = payload == 1.0 || payload == 6.0 || payload == 7.0;
    vec3 target = liquidPayload ? vec3(55.0, 187.0, 206.0)
      : gasPayload ? vec3(93.0, 169.0, 211.0)
      : granularPayload ? vec3(122.0, 177.0, 171.0) : vec3(69.0, 185.0, 198.0);
    styled = mix(styled, target / 255.0, 0.36);
  } else if (loaded) {
    styled = mix(styled, vec3(78.0, 177.0, 194.0) / 255.0, 0.30);
  }
  if (cooldown) styled = styled * vec3(0.95, 0.98, 1.02) + vec3(3.0, 5.0, 9.0) / 255.0;
  return clamp(styled, 0.0, 1.0) - color;
}
// Native FILT stores the three visible-band populations in its ctype-derived
// packed word. A zero spectrum is the native default sentinel rather than a
// black material: upstream derives its five adjacent wavelength bits from
// temperature. Reconstruct Kelvin from the normalized semantic byte with the
// calibrated 16-bit range conversion, without another texture sample on the
// true-8x path.
vec3 filtSpectrumEightXDelta(vec3 color, float packedState, float temperatureNormalized) {
  if (packedState < 32768.0) return vec3(0.0);
  float red = mod(packedState, 16.0);
  float green = mod(floor(packedState / 16.0), 16.0);
  float blue = mod(floor(packedState / 256.0), 16.0);
  float life = mod(floor(packedState / 4096.0), 8.0);
  if (red + green + blue < 0.5) {
    float temperatureKelvin = floor(temperatureNormalized * 255.0 + 0.5)
      * (65536.0 / 255.0 / 10.0);
    float band = clamp(floor((temperatureKelvin - 273.0) * 0.025), 0.0, 25.0);
    red = clamp(min(band + 5.0, 30.0) - max(band, 18.0), 0.0, 5.0);
    green = clamp(min(band + 5.0, 21.0) - max(band, 9.0), 0.0, 5.0);
    blue = clamp(min(band + 5.0, 12.0) - max(band, 0.0), 0.0, 5.0);
  }
  float scale = 624.0 / (red + green + blue + 1.0);
  float reveal = 0.50 + min(4.0, life) * 0.11;
  return mix(color, vec3(red, green, blue) * scale / 255.0, reveal) - color;
}
// These exact radioactive powders/solids already have a static body grammar
// in the normal WebGL presenter. Keep the true-8x counterpart arithmetic-only
// and owner-local: it needs no retained state, field, texture, alpha decision,
// or clock, and POLO/VIBR's native state overlays remain the final cue.
vec3 radioactiveBodyIdentityEightXDelta(float material, vec2 position) {
  vec2 cell = floor(position);
  float x = cell.x;
  float y = cell.y;
  vec3 delta = vec3(0.0);
  if (material == 99.0) {
    float crackA = step(mod(x * 3.0 + y * 5.0, 16.0), 1.0);
    float crackB = 1.0 - step(0.5, abs(mod(x - y * 2.0, 16.0)));
    delta = max(crackA, crackB) > 0.5 ? vec3(-3.0, 10.0, 7.0) : vec3(1.0, 2.0, 0.0);
  } else if (material == 108.0) {
    float inclusion = mod(x * 17.0 + y * 31.0 + floor(x * y * 0.125) + material, 32.0);
    delta = inclusion < 4.0 ? vec3(10.0, 8.0, -2.0) : vec3(-3.0, 1.0, -1.0);
  } else if (material == 109.0) {
    vec2 local = mod(cell, 8.0) - 4.0;
    float radiusSquared = dot(local, local);
    delta = radiusSquared >= 6.0 && radiusSquared <= 11.0
      ? vec3(8.0, 10.0, 3.0) : vec3(-2.0, 1.0, -1.0);
  } else if (material == 111.0) {
    vec2 local = mod(cell, 16.0) - 8.0;
    float radiusSquared = dot(local, local);
    delta = radiusSquared >= 35.0 && radiusSquared <= 58.0
      ? vec3(2.0, 5.0, 11.0) : vec3(-8.0, -7.0, -5.0);
  } else if (material == 112.0) {
    float band = mod(x * 2.0 + y + floor(y / 8.0), 16.0);
    delta = band <= 3.0 ? vec3(6.0, 9.0, -2.0) : vec3(-3.0, 1.0, 0.0);
  } else if (material == 105.0) {
    vec2 local = mod(cell, 8.0) - 4.0;
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
// The normal presenter gives these fourteen exact native powders their own
// stable identity layer. Keep the true-8x counterpart material-seeded and
// compact: it uses the already decoded owner, density, and world coordinate,
// so it cannot add a field, sampler, pass, clock, or topology decision to a
// fifteen-million-fragment frame. A zero style is an exact non-explosive no-op.
float explosivePowderEightXStyle(float material) {
  if (material == 14.0) return 1.0;
  if (material == 30.0) return 2.0;
  if (material == 31.0) return 3.0;
  if (material == 33.0) return 4.0;
  if (material >= 84.0 && material <= 86.0) return material - 79.0;
  if (material >= 88.0 && material <= 92.0) return material - 80.0;
  if (material == 94.0) return 13.0;
  if (material == 96.0) return 14.0;
  return 0.0;
}
vec3 explosivePowderEightXDelta(float material, vec2 position, float density) {
  float style = explosivePowderEightXStyle(material);
  if (style < 0.5) return vec3(0.0);
  vec2 cell = floor(position);
  float diagonal = fract(cell.x * (0.052 + style * 0.0015)
    + cell.y * (0.034 + style * 0.001) + style * 0.173);
  float cross = fract(cell.x * (0.081 - style * 0.001)
    - cell.y * (0.026 + style * 0.0015) + style * 0.131);
  float facet = max(1.0 - abs(diagonal * 2.0 - 1.0),
    (1.0 - abs(cross * 2.0 - 1.0)) * 0.72);
  vec3 hue = vec3(
    fract(style * 0.381966), fract(style * 0.618034), fract(style * 0.173205)
  ) - vec3(0.5);
  vec3 key = vec3(6.0, 4.0, -2.0) + hue * 15.0;
  float gain = (0.16 + facet * 0.84) * smoothstep(0.12, 0.82, density);
  return clamp(key * gain, vec3(-14.0), vec3(14.0)) / 255.0;
}
// Common Earth/mineral powders keep the normal composer's low-frequency body
// language in Smooth true-8x view. The four exact owners reuse only material,
// world position, and already-computed density: no state/field sample, clock,
// alpha, or support decision is introduced in the direct 15M-fragment mesh.
float earthenPowderEightXStyle(float material) {
  if (material == 6.0) return 1.0;  // DUST
  if (material == 21.0) return 2.0; // STNE
  if (material == 26.0) return 3.0; // CNCT
  if (material == 28.0) return 4.0; // CLAY
  return 0.0;
}
vec3 earthenPowderEightXDelta(float material, vec2 position, float density) {
  float style = earthenPowderEightXStyle(material);
  if (style < 0.5) return vec3(0.0);
  vec2 cell = floor(position);
  vec3 delta;
  if (style == 1.0) {
    // Dust: long soft silt bands with a sparse warm grain.
    float band = 1.0 - step(0.5, mod(cell.y + floor(cell.x / 7.0) * 2.0, 17.0));
    float silt = 1.0 - step(0.5, mod(cell.x * 3.0 + cell.y * 5.0, 31.0));
    delta = band > 0.5 ? vec3(-4.0, -3.0, -2.0) : vec3(4.0, 3.0, 1.0) * silt;
  } else if (style == 2.0) {
    // Stone: cool seams and rare mineral facets.
    float seam = 1.0 - step(0.5, mod(cell.x * 2.0 - cell.y
      + floor(cell.y / 9.0) * 3.0, 23.0));
    float facet = 1.0 - step(0.5, mod(cell.x * 5.0 + cell.y * 2.0, 37.0));
    delta = vec3(-5.0, -4.0, -2.0) * seam + vec3(2.0, 3.0, 4.0) * facet;
  } else if (style == 3.0) {
    // Concrete: calm construction joints and embedded aggregate.
    float course = 1.0 - step(0.5, mod(cell.y, 13.0));
    float joint = 1.0 - step(0.5, mod(cell.x + floor(cell.y / 13.0) * 5.0, 29.0));
    float aggregate = 1.0 - step(0.5, mod(cell.x * 4.0 + cell.y * 7.0, 41.0));
    delta = max(course, joint) > 0.5 ? vec3(-4.0, -4.0, -3.0)
      : vec3(3.0, 2.0, -1.0) * aggregate;
  } else {
    // Clay: damp lamellae and a restrained terracotta pocket.
    float lamella = 1.0 - step(0.5, mod(cell.y * 2.0 + floor(cell.x / 8.0), 19.0));
    float pocket = 1.0 - step(0.5, mod(cell.x * 3.0 - cell.y * 2.0, 43.0));
    delta = vec3(-3.0, -3.0, -2.0) * lamella + vec3(5.0, 1.0, -2.0) * pocket;
  }
  return clamp(delta * smoothstep(0.10, 0.82, density), vec3(-12.0), vec3(12.0)) / 255.0;
}
// Keep the 8x settled-body treatment compact: it reuses the four already-live
// semantic owners, boundary depth, and powder-surface slope after suspension
// composition. No texture read, alpha/support decision, or extra 15M-frame
// resource is introduced.
vec3 settledPowderMesostrataEightXDelta(float material, vec2 position, float directedSlope) {
  float style = material == 1.0 ? 1.0 : (material == 21.0 ? 2.0
    : (material == 26.0 ? 3.0 : (material == 28.0 ? 4.0 : 0.0)));
  if (style < 0.5) return vec3(0.0);
  vec2 cell = floor(position);
  float phase = cell.x * (-directedSlope * 0.072 + 0.037 * style)
    + cell.y * (directedSlope * 0.061 + 0.061 * style) + style * 0.173;
  float band = 1.0 - abs(fract(phase) * 2.0 - 1.0);
  // The direct mesh quantises after the completed 8x presentation. Keep a
  // clearly visible but still restrained body signal at a flat dense core;
  // the strict caller gate, rather than a weak slope multiplier, owns the
  // exclusion of every thin/contact/reference control.
  vec3 key = style == 1.0 ? vec3(15.0, 7.0, -8.0)
    : (style == 2.0 ? vec3(10.0, 13.0, 18.0)
    : (style == 3.0 ? vec3(8.0, 7.0, 8.0) : vec3(14.0, 4.0, -7.0)));
  return key * (band - 0.5) * 2.0 / 255.0;
}
// These ten native powders carry distinct, static body optics on the normal
// WebGL path. Mirror that identity language in the direct 8x mesh with a
// compact arithmetic-only layer: it is limited to Smooth powder, reuses the
// decoded owner/density/world position, and cannot allocate a field, add a
// sampler, alter coverage, or make the fifteen-million-fragment frame dynamic.
float unusualPowderEightXStyle(float material) {
  if (material == 43.0) return 1.0; // ANAR
  if (material == 44.0) return 2.0; // BGLA
  if (material == 45.0) return 3.0; // BREC
  if (material == 46.0) return 4.0; // BRMT
  if (material == 47.0) return 5.0; // FRZZ
  if (material == 48.0) return 6.0; // GRAV
  if (material == 49.0) return 7.0; // SAWD
  if (material == 51.0) return 8.0; // SLCN
  if (material == 198.0) return 9.0; // DYST
  if (material == 217.0) return 10.0; // BCOL
  return 0.0;
}
vec3 unusualPowderEightXDelta(float material, vec2 position, float density) {
  float style = unusualPowderEightXStyle(material);
  if (style < 0.5) return vec3(0.0);
  vec2 cell = floor(position);
  float diagonal = 1.0 - abs(fract(cell.x * (0.051 + style * 0.001)
    + cell.y * (0.037 + style * 0.0015) + style * 0.173) * 2.0 - 1.0);
  float counter = 1.0 - abs(fract(cell.x * (0.073 - style * 0.001)
    - cell.y * (0.029 + style * 0.001) + style * 0.119) * 2.0 - 1.0);
  float band = max(diagonal, counter * 0.78);
  float node = 1.0 - step(0.5, mod(cell.x * 3.0 + cell.y * 5.0 + style * 7.0,
    11.0 + mod(style, 4.0)));
  vec3 key = style == 1.0 ? vec3(12.0, 8.0, 3.0)       // ANAR feather shafts
    : (style == 2.0 ? vec3(3.0, 11.0, 15.0)            // BGLA splinters
    : (style == 3.0 ? vec3(14.0, 6.0, -2.0)            // BREC copper traces
    : (style == 4.0 ? vec3(-2.0, 10.0, 6.0)            // BRMT patina
    : (style == 5.0 ? vec3(4.0, 12.0, 16.0)            // FRZZ crystals
    : (style == 6.0 ? vec3(10.0, 3.0, 15.0)            // GRAV bands
    : (style == 7.0 ? vec3(14.0, 6.0, -3.0)            // SAWD fibres
    : (style == 8.0 ? vec3(3.0, 10.0, 15.0)            // SLCN cleavages
    : (style == 9.0 ? vec3(11.0, 8.0, -2.0)            // DYST colonies
    : vec3(15.0, 5.0, -5.0)))))))));
  float motif = mix(-0.30, 1.0, band) + node * 0.24;
  return clamp(key * motif * smoothstep(0.10, 0.80, density),
    vec3(-14.0), vec3(14.0)) / 255.0;
}
// Device sensors need a legible visual vocabulary at true 8x, not merely the
// generic device bus. Keep this seven-owner instrument layer owner-local and
// static: it reuses world position and density, preserves the semantic alpha
// downstream, and adds no state read, texture, field, clock, or render pass.
float sensorEightXStyle(float material) {
  return material >= 164.0 && material <= 170.0 ? material - 163.0 : 0.0;
}
vec3 sensorEightXDelta(float material, vec2 position, float density) {
  float style = sensorEightXStyle(material);
  if (style < 0.5) return vec3(0.0);
  vec2 local = fract(position / 24.0) - 0.5;
  vec2 absoluteLocal = abs(local);
  float radius = length(local);
  float bezel = 1.0 - smoothstep(0.020, 0.046,
    abs(max(absoluteLocal.x, absoluteLocal.y) - 0.425));
  float glyph;
  vec3 key;
  if (style == 1.0) {
    // DTEC: crosshair and a shallow range ring.
    glyph = max(1.0 - smoothstep(0.018, 0.048, min(absoluteLocal.x, absoluteLocal.y)),
      1.0 - smoothstep(0.018, 0.044, abs(radius - 0.245)));
    key = vec3(15.0, 6.0, -2.0);
  } else if (style == 2.0) {
    // INVIS: an iris with stable crossed shutters.
    glyph = max(1.0 - smoothstep(0.020, 0.045, abs(radius - 0.245)),
      1.0 - smoothstep(0.020, 0.048, abs(absoluteLocal.x - absoluteLocal.y)));
    key = vec3(5.0, 10.0, 15.0);
  } else if (style == 3.0) {
    // LDTC: scan rails and a diagonal sweep.
    glyph = max(1.0 - smoothstep(0.018, 0.044, abs(local.y - 0.18)),
      1.0 - smoothstep(0.018, 0.044, abs(local.x + local.y * 0.52)));
    key = vec3(-3.0, 15.0, 8.0);
  } else if (style == 4.0) {
    // LSNS: a triangular waveform avoids a time-varying trace.
    float wave = (1.0 - abs(fract((local.x + 0.5) * 3.0) * 2.0 - 1.0)) * 0.25 - 0.125;
    glyph = 1.0 - smoothstep(0.020, 0.050, abs(local.y - wave));
    key = vec3(3.0, 15.0, 2.0);
  } else if (style == 5.0) {
    // PSNS: nested pressure rings.
    glyph = max(1.0 - smoothstep(0.018, 0.044, abs(radius - 0.145)),
      1.0 - smoothstep(0.018, 0.044, abs(radius - 0.285)));
    key = vec3(15.0, 10.0, 2.0);
  } else if (style == 6.0) {
    // TSNS: thermometer stem and bulb.
    float stem = (1.0 - smoothstep(0.020, 0.045, abs(local.x)))
      * step(-0.29, local.y) * (1.0 - step(0.16, local.y));
    float bulb = 1.0 - smoothstep(0.070, 0.120, length(local - vec2(0.0, 0.235)));
    glyph = max(stem, bulb);
    key = vec3(15.0, 4.0, -2.0);
  } else {
    // VSNS: shaft plus a right-facing vector head.
    float shaft = (1.0 - smoothstep(0.020, 0.045, abs(local.y)))
      * step(-0.31, local.x) * (1.0 - step(0.19, local.x));
    float head = (1.0 - smoothstep(0.020, 0.050,
      abs(absoluteLocal.y - (0.34 - local.x)))) * step(0.10, local.x);
    glyph = max(shaft, head);
    key = vec3(10.0, 5.0, 15.0);
  }
  return clamp((key * (bezel * 0.38 + glyph))
    * smoothstep(0.10, 0.80, density), vec3(-16.0), vec3(16.0)) / 255.0;
}
// Construction bodies retain a calm, owner-local material grammar at true 8x
// after the common rigid-body optics.  This is deliberately a small static
// RGB layer: the direct mesh already has material, world position, and
// density, so no field/state sample, clock, support decision, or new resource
// is needed for Brick, metal, ceramic, and alloy identity.
float structuralRigidEightXStyle(float material) {
  if (material == 22.0) return 1.0; // BRCK
  if (material == 23.0) return 2.0; // METL
  if (material == 25.0) return 3.0; // CRMC
  if (material == 67.0) return 4.0; // BMTL
  if (material == 70.0) return 5.0; // GOLD
  if (material == 73.0) return 6.0; // IRON
  if (material == 82.0) return 7.0; // TTAN
  return 0.0;
}
vec3 structuralRigidEightXDelta(float material, vec2 position, float density) {
  float style = structuralRigidEightXStyle(material);
  if (style < 0.5) return vec3(0.0);
  vec2 cell = floor(position);
  float stripe = 1.0 - step(0.5, mod(cell.x * (1.0 + mod(style, 3.0))
    + cell.y * (2.0 + mod(style, 2.0)) + style * 3.0, 11.0 + style));
  float glint = 1.0 - step(0.5, mod(cell.x * (3.0 + mod(style, 4.0))
    - cell.y * (1.0 + mod(style, 3.0)) + style * 5.0, 23.0 + style * 2.0));
  vec3 delta;
  if (style == 1.0) {
    // Brick: staggered mortar courses plus sparse warm aggregate.
    float course = 1.0 - step(0.5, mod(cell.y, 6.0));
    float joint = 1.0 - step(0.5, mod(cell.x + floor(cell.y / 6.0) * 3.0, 12.0));
    delta = max(course, joint) > 0.5 ? vec3(-8.0, -6.0, -4.0)
      : vec3(4.0, 2.0, -1.0) * glint;
  } else if (style == 2.0) {
    // Metal: restrained cold brush direction with rare clean glints.
    delta = vec3(-2.0, 1.0, 4.0) * stripe + vec3(5.0, 6.0, 7.0) * glint;
  } else if (style == 3.0) {
    // Ceramic: subtle glaze/craze contrast, never a noisy interior pattern.
    delta = vec3(3.0, 4.0, 5.0) * glint - vec3(3.0, 2.0, 2.0) * stripe;
  } else if (style == 4.0) {
    // BMTL: cooler plates with sparse pitted occlusion.
    delta = vec3(-3.0, -2.0, 3.0) * stripe - vec3(5.0, 4.0, 3.0) * glint;
  } else if (style == 5.0) {
    // Gold: warm directional grain and a measured highlight cadence.
    delta = vec3(5.0, 3.0, -3.0) * stripe + vec3(6.0, 5.0, -1.0) * glint;
  } else if (style == 6.0) {
    // Iron: oxide-scale warmth remains below the broad rigid body relief.
    delta = vec3(4.0, -2.0, -3.0) * stripe + vec3(-2.0, -1.0, 2.0) * glint;
  } else {
    // Titanium: cool lamellae and a thin neutral reflection.
    delta = vec3(-2.0, 2.0, 5.0) * stripe + vec3(3.0, 4.0, 5.0) * glint;
  }
  return clamp(delta * smoothstep(0.10, 0.82, density), vec3(-10.0), vec3(10.0)) / 255.0;
}
// Coal and ROCK need an exact-owner body grammar rather than another generic
// Rigid band. This compact direct form consumes only the already-proven deep
// solid response; it never samples, reconstructs, or changes coverage.
vec3 geologicalSolidEightXDelta(float material, vec2 position, float depthT, float bodyResponse) {
  vec2 cell = floor(position);
  float crown = max(0.0, bodyResponse);
  float pocket = max(0.0, -bodyResponse);
  if (material == 19.0) { // COAL: dark shale cleavage, rare warm inclusion.
    float cleavage = 1.0 - step(0.5, mod(cell.x * 2.0 + cell.y * 3.0, 13.0));
    float cross = 1.0 - step(0.5, mod(cell.x - cell.y * 2.0, 29.0));
    float inclusion = 1.0 - step(0.5, mod(cell.x * 7.0 + cell.y * 5.0, 41.0));
    vec3 delta = -vec3(5.0, 4.0, 3.0) * depthT - vec3(3.0, 2.0, 1.0) * pocket
      - vec3(2.0, 2.0, 1.0) * max(cleavage, cross) * depthT
      + vec3(3.0, 1.0, -1.0) * inclusion * depthT + vec3(0.0, 0.0, 2.0) * crown;
    return clamp(delta, vec3(-12.0), vec3(12.0)) / 255.0;
  }
  if (material == 78.0) { // ROCK: quiet strata with a cool mineral crown.
    float stratum = 1.0 - step(2.0, mod(cell.x + floor(cell.y / 3.0) * 2.0, 15.0));
    float vein = 1.0 - step(0.5, mod(cell.x * 3.0 - cell.y * 2.0, 37.0));
    vec3 delta = vec3(-3.0, 2.0, 4.0) * crown - vec3(3.0, 2.0, 1.0) * pocket
      + vec3(-1.0, 1.0, 2.0) * stratum * depthT + vec3(1.0, 2.0, 3.0) * vein * depthT;
    return clamp(delta, vec3(-12.0), vec3(12.0)) / 255.0;
  }
  return vec3(0.0);
}
// HEAC, PTNM, and RSSS reuse only the deep solid-body proof already live in
// this direct mesh. The grammar is static, RGB-only, and exact-owner: it adds
// no sampler, field, support decision, or scale-dependent resource.
vec3 thermalCatalyticRigidEightXDelta(float material, vec2 position, float depthT, float bodyResponse) {
  vec2 cell = floor(position);
  float crown = max(0.0, bodyResponse);
  float pocket = max(0.0, -bodyResponse);
  if (material == 72.0) { // HEAC: warm heat-channel lamellae.
    float channel = 1.0 - step(0.5, mod(cell.x * 3.0 + cell.y * 2.0, 17.0));
    float pin = 1.0 - step(0.5, mod(cell.x - cell.y * 4.0, 31.0));
    return clamp(vec3(4.0, -2.0, -3.0) * crown - vec3(3.0, 2.0, 3.0) * pocket
      + vec3(3.0, 0.0, -1.0) * channel * depthT + vec3(0.0, -1.0, 0.0) * pin * depthT,
    vec3(-12.0), vec3(12.0)) / 255.0;
  }
  if (material == 75.0) { // PTNM: cool catalytic planes and sparse active sites.
    float plane = 1.0 - step(2.0, mod(cell.x + cell.y * 2.0, 19.0));
    float site = 1.0 - step(0.5, mod(cell.x * 5.0 - cell.y * 3.0, 43.0));
    return clamp(vec3(2.0, 3.0, 5.0) * crown - vec3(2.0, 1.0, 1.0) * pocket
      + vec3(-1.0, 0.0, 2.0) * plane * depthT + vec3(0.0, 1.0, 1.0) * site * depthT,
    vec3(-12.0), vec3(12.0)) / 255.0;
  }
  if (material == 79.0) { // RSSS: low-frequency fused resist body below its surface grammar.
    float seam = 1.0 - step(0.5, mod(cell.x * 2.0 - cell.y * 3.0, 23.0));
    float inclusion = 1.0 - step(0.5, mod(cell.x * 7.0 + cell.y, 47.0));
    return clamp(vec3(2.0, 0.0, 0.0) * crown - vec3(4.0, 3.0, 3.0) * pocket
      + vec3(0.0, -1.0, -1.0) * seam * depthT + vec3(2.0, 0.0, 0.0) * inclusion * depthT,
    vec3(-12.0), vec3(12.0)) / 255.0;
  }
  return vec3(0.0);
}
// Native GOO is pressure-reactive in simulation, but this body layer never
// infers pressure. It merely gives a proven, current deep GOO core a soft
// static volume cue using arithmetic already safe at 15M fragments.
vec3 gooSolidEightXDelta(vec2 position, float depthT, float bodyResponse) {
  vec2 cell = floor(position);
  float crown = max(0.0, bodyResponse);
  float pocket = max(0.0, -bodyResponse);
  float compression = 1.0 - step(2.0, mod(cell.x * 2.0 + cell.y * 3.0, 29.0));
  float bubble = 1.0 - step(0.5, mod(cell.x * 5.0 - cell.y * 2.0, 47.0));
  return clamp(vec3(2.0, 4.0, 5.0) * crown - vec3(4.0, 2.0, 1.0) * pocket
    + vec3(-1.0, 0.0, 2.0) * compression * depthT + vec3(0.0, 1.0, 1.0) * bubble * depthT,
  vec3(-10.0), vec3(10.0)) / 255.0;
}
// FRAY is a native temperature-driven force emitter. Its direction and
// polarity remain simulation-owned; this is only a static exact-owner nozzle
// grammar over values already live in the direct mesh, with no sampler/field.
vec3 frayForceEightXDelta(vec2 position) {
  vec2 cell = mod(floor(position), 24.0) - vec2(11.5);
  float radiusSquared = dot(cell, cell);
  float core = 1.0 - step(6.26, radiusSquared);
  float ring = step(24.0, radiusSquared) * (1.0 - step(42.01, radiusSquared));
  float axis = (1.0 - step(1.51, abs(cell.y))) * (1.0 - step(10.51, abs(cell.x)));
  float rail = step(8.49, abs(cell.x)) * (1.0 - step(8.51, abs(cell.y)));
  float pin = 1.0 - step(0.5, mod(floor(position.x) * 3.0 - floor(position.y) * 5.0, 29.0));
  return clamp(vec3(-3.0, 5.0, 8.0) * core + vec3(-2.0, 4.0, 7.0) * ring
    + vec3(1.0, 3.0, 5.0) * axis + vec3(-2.0, 2.0, 4.0) * rail
    + vec3(2.0, 3.0, 4.0) * pin, vec3(-12.0), vec3(12.0)) / 255.0;
}
// GBMB's gravity behavior is unavailable in this build. Keep this exact-owner
// treatment deliberately static: a containment-body read, never a fabricated
// gravity direction, state, field, texture fetch, or output-scale resource.
vec3 gbmbForceEightXDelta(vec2 position) {
  vec2 cell = mod(floor(position), 28.0) - vec2(13.5);
  float radiusSquared = dot(cell, cell);
  float core = 1.0 - step(9.01, radiusSquared);
  float ring = step(35.0, radiusSquared) * (1.0 - step(60.01, radiusSquared));
  float meridian = (1.0 - step(1.51, abs(cell.x))) * (1.0 - step(11.51, abs(cell.y)));
  float latitude = (1.0 - step(1.51, abs(cell.y))) * (1.0 - step(11.51, abs(cell.x)));
  float mote = 1.0 - step(0.5, mod(floor(position.x) * 5.0 + floor(position.y) * 3.0, 37.0));
  return clamp(vec3(3.0, 4.0, 9.0) * core + vec3(2.0, 2.0, 8.0) * ring
    + vec3(-3.0, -2.0, 3.0) * max(meridian, latitude) + vec3(2.0, 3.0, 5.0) * mote,
  vec3(-12.0), vec3(12.0)) / 255.0;
}
// Transport, actuator, and storage devices are semantically distinct native
// hardware, not generic circuit panels.  Keep their compact direct-mesh
// grammar exact-owner, static, and RGB-only: material/world position/density
// are already live at 15M fragments, so this adds no sampler, field, clock,
// support decision, or output-scale resource.
float mechanismEightXStyle(float material) {
  if (material == 121.0) return 1.0; // PIPE
  if (material == 160.0) return 2.0; // PPIP
  if (material == 155.0) return 3.0; // GPMP
  if (material == 161.0) return 4.0; // PUMP
  if (material == 122.0) return 5.0; // PSTN
  if (material == 119.0) return 6.0; // FRME
  if (material == 123.0) return 7.0; // RPEL
  if (material == 162.0) return 8.0; // PVOD
  if (material == 163.0) return 9.0; // STOR
  if (material == 117.0) return 10.0; // DMG
  return 0.0;
}
vec3 mechanismEightXDelta(float material, vec2 position, float density) {
  float style = mechanismEightXStyle(material);
  if (style < 0.5) return vec3(0.0);
  vec2 cell = floor(position);
  float rail = 1.0 - step(0.5, mod(cell.x * (1.0 + mod(style, 3.0))
    + cell.y * (2.0 + mod(style, 2.0)) + style * 5.0, 13.0 + style));
  float seam = 1.0 - step(0.5, mod(cell.x * (3.0 + mod(style, 4.0))
    - cell.y * (1.0 + mod(style, 3.0)) + style * 7.0, 29.0 + style));
  vec3 delta;
  if (style < 2.5) {
    // PIPE/PPIP: recessed lumen rails, with powered pipe kept cooler.
    float lumen = 1.0 - step(1.0, mod(cell.x + cell.y * 2.0 + style, 9.0));
    delta = vec3(-5.0, -3.0, 4.0) * lumen + vec3(3.0, 7.0, 11.0) * rail;
    if (style > 1.5) delta += vec3(1.0, 4.0, 8.0) * seam;
  } else if (style < 4.5) {
    // GPMP/PUMP: broad plenum ring and sparse impeller marks.
    vec2 local = fract(position / 18.0) - 0.5;
    float radius = length(local);
    float ring = 1.0 - smoothstep(0.030, 0.070, abs(radius - 0.29));
    float hub = 1.0 - smoothstep(0.09, 0.17, radius);
    float spoke = 1.0 - smoothstep(0.050, 0.115, min(abs(local.x), abs(local.y)));
    delta = vec3(-3.0, 6.0, 11.0) * (ring * 0.82 + hub * 0.55)
      + vec3(4.0, 7.0, 10.0) * spoke * (style > 3.5 ? 0.58 : 0.32);
  } else if (style < 6.5) {
    // PSTN/FRME: machined ribs and calm cast-frame joints.
    float rib = 1.0 - step(0.5, mod(cell.x * 2.0 + cell.y + style, 11.0));
    delta = vec3(5.0, 7.0, 10.0) * rib + vec3(-5.0, -4.0, -2.0) * seam;
    if (style > 5.5) delta = delta * 0.62 + vec3(5.0, 3.0, 0.0) * rail;
  } else if (style < 7.5) {
    // RPEL: nested cool coil bands.
    vec2 local = fract(position / 20.0) - 0.5;
    float ring = 1.0 - smoothstep(0.025, 0.060, abs(length(local) - 0.33));
    float coil = 1.0 - step(0.5, mod(cell.x + cell.y * 3.0, 7.0));
    delta = vec3(3.0, 4.0, 14.0) * (ring + coil * 0.46) - vec3(3.0, 1.0, 1.0) * seam;
  } else if (style < 9.5) {
    // PVOD/STOR: deep contained bays rather than a flat device lattice.
    float bay = 1.0 - step(0.5, mod(floor(cell.x / 3.0) + floor(cell.y / 3.0), 2.0));
    delta = vec3(-5.0, -4.0, -2.0) * bay + vec3(4.0, 8.0, 12.0) * rail;
    if (style > 8.5) delta += vec3(4.0, 2.0, -2.0) * seam;
  } else {
    // DMG: fractured plate facets remain static and bounded.
    delta = vec3(7.0, 4.0, -2.0) * rail - vec3(6.0, 4.0, 2.0) * seam;
  }
  return clamp(delta * smoothstep(0.10, 0.82, density), vec3(-14.0), vec3(14.0)) / 255.0;
}
// Native control electronics deliberately retain their own static grammar
// rather than collapsing into the generic Device trace. This is an
// exact-owner RGB-only layer: it consumes the already-live material, world
// position, and density values and adds neither a sampler nor a field/pass at
// true 8x. Source, Spark, clone, and transport owners keep their specialist
// layers, so this list covers only the twenty remaining control components.
float electronicEightXStyle(float material) {
  if (material == 135.0) return 1.0; // ARAY
  if (material == 136.0) return 2.0; // BTRY
  if (material == 138.0) return 3.0; // DRAY
  if (material == 139.0) return 4.0; // EMP
  if (material == 140.0) return 5.0; // ETRD
  if (material == 141.0) return 6.0; // INSL
  if (material == 142.0) return 7.0; // INST
  if (material == 143.0) return 8.0; // INWR
  if (material == 144.0) return 9.0; // NSCN
  if (material == 145.0) return 10.0; // NTCT
  if (material == 146.0) return 11.0; // PSCN
  if (material == 147.0) return 12.0; // PTCT
  if (material == 149.0) return 13.0; // SWCH
  if (material == 150.0) return 14.0; // TESC
  if (material == 151.0) return 15.0; // TUNG
  if (material == 152.0) return 16.0; // WIFI
  if (material == 153.0) return 17.0; // WIRE
  if (material == 154.0) return 18.0; // DLAY
  if (material == 156.0) return 19.0; // HSWC
  if (material == 157.0) return 20.0; // LCRY
  return 0.0;
}
vec3 electronicEightXDelta(float material, vec2 position, float density) {
  float style = electronicEightXStyle(material);
  if (style < 0.5) return vec3(0.0);
  vec2 cell = floor(position);
  float rail = 1.0 - step(0.5, mod(cell.x * (1.0 + mod(style, 4.0))
    + cell.y * (2.0 + mod(style, 3.0)) + style * 3.0, 11.0 + mod(style, 5.0)));
  float node = 1.0 - step(0.5, mod(cell.x * (4.0 + mod(style, 3.0))
    - cell.y * (2.0 + mod(style, 4.0)) + style * 7.0, 29.0 + mod(style, 7.0)));
  vec3 delta;
  if (style < 3.5) {
    // ARAY/BTRY/DRAY: directional emitters and charge buses.
    float beam = 1.0 - step(1.0, mod(cell.x - cell.y * (style == 2.0 ? 1.0 : 2.0), 9.0));
    delta = vec3(8.0, 5.0, -3.0) * beam + vec3(3.0, 8.0, 13.0) * rail
      - vec3(4.0, 3.0, 1.0) * node;
  } else if (style < 6.0) {
    // EMP/ETRD: pulse rings and electrode forks.
    float ring = 1.0 - step(0.5, mod(abs(cell.x * 2.0 - cell.y * 3.0) + style, 13.0));
    delta = vec3(4.0, 9.0, 14.0) * ring + vec3(8.0, 3.0, -2.0) * node
      - vec3(3.0, 2.0, 1.0) * rail;
  } else if (style < 9.0) {
    // INSL/INST/INWR: ceramic separators, sensing dots, and insulated rails.
    float slot = 1.0 - step(0.5, mod(cell.x + cell.y * 3.0 + style, 17.0));
    delta = vec3(-4.0, 2.0, 8.0) * rail + vec3(5.0, 4.0, 1.0) * slot
      + vec3(2.0, 5.0, 8.0) * node;
  } else if (style < 13.0) {
    // Doped silicon and thermistors share restrained cold/warm junction marks.
    float junction = 1.0 - step(0.5, mod(cell.x * 2.0 + cell.y * 5.0 + style, 19.0));
    vec3 polarity = mod(style, 2.0) < 0.5 ? vec3(9.0, -2.0, 7.0) : vec3(-3.0, 8.0, 11.0);
    delta = polarity * junction + vec3(3.0, 5.0, 9.0) * rail - vec3(3.0, 2.0, 1.0) * node;
  } else if (style < 17.0) {
    // Switches, Tesla coils, tungsten, and Wi-Fi use sparse mechanical/radio marks.
    float coil = 1.0 - step(0.5, mod(cell.x * 3.0 - cell.y * 2.0 + style, 15.0));
    delta = vec3(6.0, 4.0, -2.0) * rail + vec3(2.0, 8.0, 14.0) * coil
      - vec3(4.0, 3.0, 1.0) * node;
  } else {
    // WIRE/DLAY/HSWC/LCRY: conductors, timed taps, heat gates, and lattice cells.
    float tap = 1.0 - step(0.5, mod(cell.x + cell.y * 4.0 + style, 21.0));
    delta = vec3(3.0, 8.0, 13.0) * rail + vec3(7.0, 3.0, 5.0) * tap
      - vec3(4.0, 3.0, 1.0) * node;
  }
  return clamp(delta * smoothstep(0.10, 0.82, density), vec3(-16.0), vec3(16.0)) / 255.0;
}
// Broad metallic bodies need a different read from the sparse identity marks
// above. This remains an interior-only, world-anchored finish: the analytic
// band has no clock, sample, field, or support decision, so thin plates,
// contours, holes, walls, and the semantic owner remain under the compositor.
vec3 structuralMetalEightXBodyDelta(
  float material, vec2 position, float depthT, float bodyResponse
) {
  vec2 direction = vec2(1.0, 0.0);
  vec3 key = vec3(0.0);
  vec3 shadow = vec3(0.0);
  float offset = 0.0;
  if (material == 23.0) {
    // METL: a cool, rolled-steel shoulder and blue-grey occlusion pocket.
    direction = vec2(0.034, 0.009);
    key = vec3(8.0, 11.0, 16.0);
    shadow = vec3(6.0, 7.0, 10.0);
    offset = 0.17;
  } else if (material == 67.0) {
    direction = vec2(0.027, -0.014);
    key = vec3(5.0, 10.0, 16.0);
    shadow = vec3(7.0, 6.0, 8.0);
    offset = 0.39;
  } else if (material == 70.0) {
    direction = vec2(0.030, 0.006);
    key = vec3(12.0, 8.0, 1.0);
    shadow = vec3(7.0, 4.0, 1.0);
    offset = 0.61;
  } else if (material == 73.0) {
    direction = vec2(0.022, -0.018);
    key = vec3(6.0, 7.0, 10.0);
    shadow = vec3(8.0, 7.0, 7.0);
    offset = 0.83;
  } else if (material == 82.0) {
    direction = vec2(0.031, 0.012);
    key = vec3(6.0, 12.0, 18.0);
    shadow = vec3(5.0, 7.0, 10.0);
    offset = 0.47;
  } else return vec3(0.0);
  float rollTriangle = 1.0 - abs(fract(dot(position, direction) + offset) * 2.0 - 1.0);
  float rollLobe = rollTriangle * rollTriangle * (3.0 - rollTriangle * 2.0);
  float shoulder = smoothstep(0.62, 0.92, rollLobe);
  float pocket = 1.0 - smoothstep(0.20, 0.50, rollLobe);
  float crownGain = shoulder * (0.58 + max(0.0, bodyResponse) * 0.72) * depthT;
  float pocketGain = pocket * (0.62 + max(0.0, -bodyResponse) * 0.48) * depthT;
  return (key * crownGain - shadow * pocketGain) / 255.0;
}
// LIFE projections carry an exact native ctype preset rather than a generic
// material identity. Keep the true-8x counterpart static and owner-local: all
// twenty-four presets share this small arithmetic grammar, so it adds neither
// a field/state lookup nor a per-frame resource to the fifteen-million-pixel
// compositor. It is RGB-only; semantic support and alpha remain downstream.
vec3 cellularIdentityEightXDelta(float material, vec2 position, float density) {
  float preset = material - 171.0;
  if (preset < -0.5 || preset > 23.5) return vec3(0.0);
  vec2 cell = floor(position);
  float motif = mod(preset, 4.0);
  float period = 3.0 + mod(floor(preset / 4.0), 4.0);
  float phase = mod(preset * 5.0 + floor(preset / 16.0) * 3.0, period);
  float coordinate = motif < 0.5 ? cell.x + cell.y
    : (motif < 1.5 ? cell.x + floor(cell.y * 0.5)
    : (motif < 2.5 ? cell.x * 2.0 + cell.y * 3.0 : cell.x - cell.y));
  float band = 1.0 - step(1.0 + floor(preset / 16.0),
    mod(mod(coordinate + phase, period) + period, period));
  float node = 1.0 - step(0.5,
    mod(cell.x * 3.0 + cell.y * 5.0 + preset * 7.0, 11.0 + mod(preset, 3.0)));
  vec2 local = mod(cell + vec2(preset * 3.0, preset * 5.0), 16.0) - vec2(7.5);
  float radiusSquared = dot(local, local);
  float membrane = step(24.5, radiusSquared) * (1.0 - step(43.5, radiusSquared));
  float core = 1.0 - step(7.5, radiusSquared);
  float scalar = mix(2.0 + mod(preset, 2.0),
    -4.0 - mod(floor(preset / 4.0), 2.0) * 2.0, band)
    + node * mix(2.0, -2.0, band) - membrane + core;
  vec3 delta = vec3(scalar);
  if (motif < 0.5) delta += vec3(0.0, -band * 2.0, node * 2.0);
  else if (motif < 1.5) delta += vec3(-band * 2.0, 0.0, band);
  else if (motif < 2.5) delta += vec3(band, node * 2.0, 0.0);
  else delta += vec3(0.0, -node, -band * 2.0);
  return clamp(delta, vec3(-10.0), vec3(10.0))
    * smoothstep(0.08, 0.72, density) / 255.0;
}
// Uncommon native solids are mostly phase products or purpose-built material
// IDs. The normal compositor gives them individual static motifs; retain that
// legibility in the direct 8x mesh with one bounded, arithmetic-only grammar.
// This deliberately samples neither a field nor retained state: it styles an
// already-authoritative solid owner and leaves coverage, alpha, walls, and
// simulation semantics to the common compositor below.
float unusualSolidEightXStyle(float material) {
  if (material == 27.0) return 1.0; // WAX
  if (material == 68.0) return 2.0; // DRIC
  if (material == 74.0) return 3.0; // NICE
  if (material == 76.0) return 4.0; // QRTZ
  if (material == 77.0) return 5.0; // RIME
  if (material == 79.0) return 6.0; // RSSS
  if (material == 80.0) return 7.0; // SHLD1
  if (material == 196.0) return 8.0; // BIZRS
  if (material == 203.0) return 9.0; // LOLZ
  if (material == 204.0) return 10.0; // LOVE
  if (material == 206.0) return 11.0; // PSTS
  if (material == 208.0) return 12.0; // SHLD2
  if (material == 209.0) return 13.0; // SHLD3
  if (material == 210.0) return 14.0; // SHLD4
  if (material == 211.0) return 15.0; // SPAWN
  if (material == 212.0) return 16.0; // SPAWN2
  if (material == 216.0) return 17.0; // VRSS
  return 0.0;
}
vec3 unusualSolidEightXDelta(float material, vec2 position, float density) {
  float style = unusualSolidEightXStyle(material);
  if (style < 0.5) return vec3(0.0);
  if (style == 1.0) return waxEightXIdentityDelta(0.0, position, density, 1.0);
  vec2 cell = floor(position);
  vec2 local = mod(cell + vec2(style * 3.0, style * 5.0), 16.0) - vec2(7.5);
  float diagonal = fract(cell.x * (0.043 + style * 0.001)
    - cell.y * (0.031 + style * 0.0015) + style * 0.137);
  float ribbon = 1.0 - abs(diagonal * 2.0 - 1.0);
  float node = 1.0 - step(0.5, mod(cell.x * 3.0 + cell.y * 5.0 + style * 7.0,
    11.0 + mod(style, 4.0)));
  float radius = abs(local.x) + abs(local.y);
  vec3 delta;
  if (style >= 2.0 && style <= 5.0) {
    // DRIC/NICE/QRTZ/RIME: distinct cold/crystal facets share a fine stable grid.
    float facet = max(ribbon, node * 0.82);
    vec3 crystal = style == 2.0 ? vec3(-4.0, 7.0, 12.0)
      : (style == 3.0 ? vec3(3.0, 11.0, 13.0)
      : (style == 4.0 ? vec3(10.0, 7.0, 14.0) : vec3(6.0, 10.0, 16.0)));
    delta = mix(-crystal * 0.28, crystal, facet);
  } else if (style == 6.0 || style == 11.0) {
    // RSSS/PSTS: resist and paste settle into different retained ridge keys.
    float ridge = max(ribbon, node * 0.64);
    vec3 key = style == 6.0 ? vec3(8.0, 3.0, 9.0) : vec3(4.0, 7.0, 2.0);
    delta = mix(-key * 0.36, key, ridge);
  } else if (style == 8.0) {
    // BIZRS: prismatic faces split warm/cool reflection along a stable diagonal.
    delta = ribbon > 0.58 ? vec3(11.0, 4.0, -7.0) : vec3(-3.0, 6.0, 12.0);
  } else if (style == 9.0 || style == 10.0) {
    // LOLZ/LOVE retain playful glyph-like cores without a state texture.
    float eye = (abs(local.x) > 2.5 && abs(local.x) < 5.5 && abs(local.y + 2.0) < 1.5)
      ? 1.0 : 0.0;
    float heart = radius >= 3.0 && radius <= 6.0 && local.y > -3.0 ? 1.0 : 0.0;
    delta = style == 9.0
      ? (eye > 0.5 ? vec3(9.0, 13.0, -6.0) : vec3(1.0, 4.0, -2.0))
      : (heart > 0.5 ? vec3(9.0, -5.0, 12.0) : vec3(-2.0, 2.0, 5.0));
  } else if (style >= 7.0 && style <= 14.0) {
    // SHLD1-4: nested armour bands become progressively denser by stage.
    float stage = style == 7.0 ? 1.0 : style - 10.0;
    float shell = 1.0 - step(0.80, abs(fract(radius * stage * 0.17 + 0.21) - 0.5) * 3.2);
    vec3 key = vec3(3.0 + stage * 1.5, 7.0 + stage * 1.2, 11.0 + stage * 0.8);
    delta = shell > 0.5 ? key : -key * 0.24;
  } else if (style == 15.0 || style == 16.0) {
    // SPAWN/SPAWN2: related, but oppositely coloured beacon rings.
    float ring = radius >= 4.0 && radius <= 6.0 ? 1.0 : 0.0;
    vec3 key = style == 15.0 ? vec3(12.0, 8.0, -6.0) : vec3(-6.0, 6.0, 13.0);
    delta = ring > 0.5 ? key : key * 0.22;
  } else {
    // VRSS: a magenta capsid uses sparse nodes over its rigid body.
    delta = node > 0.5 ? vec3(12.0, -2.0, 13.0) : vec3(2.0, 0.0, 4.0);
  }
  return clamp(delta * smoothstep(0.08, 0.72, density), vec3(-14.0), vec3(14.0)) / 255.0;
}
bool solidEightXGranular(float optics) {
  return optics == 7.0 || optics == 13.0 || optics == 14.0 || optics == 15.0;
}
float solidEightXCurvatureGain(float optics) {
  if (solidEightXGranular(optics)) return 0.0;
  if (optics == 8.0 || optics == 19.0) return 1.25;
  if (optics == 10.0) return 0.82;
  if (optics == 11.0) return 0.70;
  if (optics == 12.0) return 0.62;
  if (optics == 9.0) return 0.58;
  return 0.72;
}
float solidEightXShellSpecularGain(float optics) {
  if (solidEightXGranular(optics)) return 0.0;
  if (optics == 8.0 || optics == 19.0) return 1.00;
  if (optics == 10.0) return 0.76;
  if (optics == 12.0) return 0.82;
  if (optics == 11.0) return 0.62;
  if (optics == 9.0) return 0.40;
  return 0.54;
}
vec3 solidEightXBodyKey(float optics) {
  if (optics == 8.0 || optics == 19.0) return vec3(0.3704, 0.6667, 1.0000);
  if (optics == 9.0) return vec3(0.5417, 1.0000, 0.4583);
  if (optics == 10.0) return vec3(0.2424, 0.6970, 1.0000);
  if (optics == 11.0) return vec3(0.2414, 1.0000, 0.4828);
  if (optics == 12.0) return vec3(0.2647, 0.6176, 1.0000);
  return vec3(0.8000, 0.9000, 1.0000);
}
vec3 solidEightXBodyShadow(float optics) {
  if (optics == 8.0 || optics == 19.0) return vec3(0.94, 0.84, 0.70);
  if (optics == 9.0) return vec3(0.94, 0.72, 0.96);
  if (optics == 10.0) return vec3(1.00, 0.84, 0.62);
  if (optics == 11.0) return vec3(0.96, 0.62, 0.92);
  if (optics == 12.0) return vec3(1.00, 0.78, 0.54);
  return vec3(0.88, 0.80, 0.68);
}
// The normal compositor's surface-contour control carries a family-coloured
// key/fill across liquid, solid, and Smooth-powder edges. At true 8x, restore
// its solid/powder body read from the already-live 2x2 owner shape. This is
// deliberately arithmetic-only: a contour changes RGB but never density,
// alpha, ownership, or a later native-wall composite.
vec3 applySurfaceContourEightX(
  vec3 color, float density, vec2 slope, float optics, float powder, float solidAirFacing
) {
  float slopeLength = length(slope);
  if (slopeLength <= 0.0001) return color;
  float shell = smoothstep(0.05, 0.31, density)
    * (1.0 - smoothstep(0.57, 0.91, density));
  if (shell <= 0.0001) return color;
  vec2 normal = slope / slopeLength;
  float directional = dot(normal, normalize(vec2(-0.58, -0.815)));
  vec3 key = powder > 0.5 ? vec3(1.00, 0.76, 0.42) : solidEightXBodyKey(optics);
  vec3 shadow = powder > 0.5 ? vec3(0.72, 0.52, 0.30) : solidEightXBodyShadow(optics);
  float keyWeight = shell * (powder > 0.5
    ? (0.085 + max(0.0, directional) * 0.040)
    : (0.006 + max(0.0, directional) * 0.024));
  float shadowWeight = shell * (powder > 0.5
    ? 0.0
    : (0.004 + max(0.0, -directional) * 0.015));
  color += (vec3(1.0) - clamp(color, 0.0, 1.0)) * key * keyWeight;
  color *= vec3(1.0) - shadow * shadowWeight;
  // A solid contour needs actual semantic air before it may take the compact
  // Fresnel/specular shoulder. The caller derives this from the four exact
  // owner samples already needed for Hermite coverage, so solid-solid seams,
  // gas/liquid contact, powder, alpha/support, and topology stay outside this
  // RGB-only cue. A small static view/key vector restores a 3-D body read at
  // deep zoom without a field, texture, pass, or clock-driven variation.
  if (powder < 0.5 && solidAirFacing > 0.5) {
    vec3 shellNormal = vec3(-slope * 0.72, 1.0);
    shellNormal *= inversesqrt(dot(shellNormal, shellNormal));
    float specular = max(0.0, dot(shellNormal, vec3(-0.42, -0.58, 0.70)));
    specular *= specular;
    specular *= specular;
    float fresnel = 1.0 - shellNormal.z;
    fresnel *= fresnel;
    float shellSpecular = shell * solidAirFacing * solidEightXShellSpecularGain(optics)
      * (0.006 + specular * 0.035 + fresnel * 0.022);
    color += (vec3(1.0) - clamp(color, 0.0, 1.0)) * key * shellSpecular;
  }
  return color;
}
void main() {
  vec2 uv = vFieldCoord;
  vec4 semantic = texture(uFieldTexture, clamp(uv, uTexel * 0.5, vec2(1.0) - uTexel * 0.5));
  float material = floor(semantic.r * 255.0 + 0.5);
  vec4 atmosphere = texture(uAtmosphereTexture, uv);
  vec4 emission = texture(uEmissionTexture, uv);
  vec4 liquid = texture(uLiquidTexture, uv);
  // A direct 8x mesh normally returns immediately for semantic Empty. Smooth
  // powder is the deliberate exception: the shared settled-powder field may
  // own a conservative exterior contour in an Empty cell, exactly as it does
  // at 1x–4x. Choose one deterministic owner from a compatible 2x2 settled
  // powder block; separately owned powders may share that exterior support,
  // but solids/liquids/gas, walls, enclosed authored holes, and weak/flat
  // field support remain rejected before common composition.
  float projectedSmoothPowder = 0.0;
  vec4 projectedPowderShape = vec4(0.0);
  if (material < 0.5 && uPowderStyle > 1.5 && uPowderSurfaceActive > 0.5) {
    vec4 candidateShape = powderSurfaceEightXShape(uv);
    vec4 wallState = texture(uWallTexture, uv);
    vec2 candidateGrid = uv * uFieldSize - 0.5;
    vec2 candidateOrigin = (floor(candidateGrid) + 0.5) * uTexel;
    float candidate00 = materialAt(candidateOrigin);
    float candidate10 = materialAt(candidateOrigin + vec2(uTexel.x, 0.0));
    float candidate01 = materialAt(candidateOrigin + vec2(0.0, uTexel.y));
    float candidate11 = materialAt(candidateOrigin + uTexel);
    float candidate = candidate00 > 0.5 ? candidate00
      : (candidate10 > 0.5 ? candidate10 : (candidate01 > 0.5 ? candidate01 : candidate11));
    float candidateFamily = candidate > 0.5
      ? floor(texture(uStyleTexture, vec2((candidate + 0.5) / 256.0, 0.5)).r * 255.0 + 0.5)
      : 0.0;
    float verticalShare = abs(candidateShape.z)
      / (abs(candidateShape.y) + abs(candidateShape.z) + 0.000001);
    float fieldContour = smoothstep(0.42, 0.70, verticalShare)
      * smoothstep(0.004, 0.027, abs(candidateShape.z))
      * smoothstep(5.5, 8.0, candidateShape.w)
      * smoothstep(0.075, 0.26, candidateShape.x);
    // The candidate-family and shared-field gates make these three style
    // samples an exterior-band cost rather than a 15M-fragment Empty-path
    // cost. Every non-empty 2x2 owner must still be Powder: mixed Sand/Clay
    // therefore shares one curved *outer* support, but a powder/solid or
    // powder/liquid contact cannot be projected across.
    float compatible = 0.0;
    if (candidateFamily == 4.0 && fieldContour > 0.001) {
      float family10 = candidate10 > 0.5
        ? floor(texture(uStyleTexture, vec2((candidate10 + 0.5) / 256.0, 0.5)).r * 255.0 + 0.5) : 4.0;
      float family01 = candidate01 > 0.5
        ? floor(texture(uStyleTexture, vec2((candidate01 + 0.5) / 256.0, 0.5)).r * 255.0 + 0.5) : 4.0;
      float family11 = candidate11 > 0.5
        ? floor(texture(uStyleTexture, vec2((candidate11 + 0.5) / 256.0, 0.5)).r * 255.0 + 0.5) : 4.0;
      compatible = (candidate00 < 0.5 || candidateFamily == 4.0 ? 1.0 : 0.0)
        * (candidate10 < 0.5 || family10 == 4.0 ? 1.0 : 0.0)
        * (candidate01 < 0.5 || family01 == 4.0 ? 1.0 : 0.0)
        * (candidate11 < 0.5 || family11 == 4.0 ? 1.0 : 0.0);
    }
    if (candidateFamily == 4.0 && compatible > 0.5 && wallState.r < 0.5
      && wallState.g > 0.5 && fieldContour > 0.001) {
      material = candidate;
      projectedSmoothPowder = fieldContour;
      projectedPowderShape = candidateShape;
    }
  }
  // True 8x already needs this centre emission sample for aura and energy.
  // Reuse it for compact gas scatter. The gas-only branches below additionally
  // take four alpha-only atmosphere probes for volume curvature, never an
  // emission-neighbour or gas-RGB probe. Every term stays RGB-only.
  float gasFieldScatter = uGasFieldLighting * smoothstep(0.002, 0.42, emission.a);
  if (material < 0.5) {
    vec4 foreground = vec4(0.0);
    if (liquid.a > 0.28) foreground = vec4(liquid.rgb * liquid.a, liquid.a);
    else if (atmosphere.a > 0.004) {
      float gasShell = 1.0 - smoothstep(0.22, 0.82, atmosphere.a);
      vec3 gas = atmosphere.rgb + uGasVolumeChroma * atmosphere.a * vec3(0.022, -0.009, 0.017)
        + emission.rgb * gasFieldScatter * gasShell * 0.035;
      if (uGasFieldLighting > 0.5) {
        vec2 atmosphereMin = uAtmosphereTexel * 0.5;
        vec2 atmosphereMax = vec2(1.0) - atmosphereMin;
        float gasLeft = texture(uAtmosphereTexture,
          clamp(uv - vec2(uAtmosphereTexel.x, 0.0), atmosphereMin, atmosphereMax)).a;
        float gasRight = texture(uAtmosphereTexture,
          clamp(uv + vec2(uAtmosphereTexel.x, 0.0), atmosphereMin, atmosphereMax)).a;
        float gasTop = texture(uAtmosphereTexture,
          clamp(uv - vec2(0.0, uAtmosphereTexel.y), atmosphereMin, atmosphereMax)).a;
        float gasBottom = texture(uAtmosphereTexture,
          clamp(uv + vec2(0.0, uAtmosphereTexel.y), atmosphereMin, atmosphereMax)).a;
        gas += gasEightXVolumeRelief(atmosphere.a, gasLeft, gasRight, gasTop, gasBottom);
      }
      if (uGasIdentityStyling > 0.5) {
        float gasIdentityStyle = floor(texture(uAtmosphereStyleTexture, uv).r * 255.0 + 0.5);
        gas += gasIdentityEightXDelta(gasIdentityStyle, atmosphere.a)
          + uGasVolumeChroma * gasIdentityEightXChroma(gasIdentityStyle, atmosphere.a);
      }
      foreground = vec4(gas * atmosphere.a * 0.42, atmosphere.a * 0.42);
    } else if (emission.a > 0.004) {
      vec3 aura = emission.rgb + uEmissionVolumeChroma * emission.a * vec3(0.025, 0.010, 0.030);
      foreground = vec4(aura * emission.a * 0.30, emission.a * 0.30);
    }
    // The scene-level uniform makes fully wall-free 15M-fragment frames take
    // the original sampler-free empty path. When walls exist, a single nearest
    // lookup keeps bare native walls and their liquid/gas/energy backdrops
    // independent from the particle/material plane.
    if (uNativeWallsActive > 0.5) {
      float wall = floor(texture(uWallTexture, uv).r * 255.0 + 0.5);
      foreground = compositeEightXWallBackdrop(
        foreground, wall, uv * uFieldSize, 0.0, vec2(0.0)
      );
    }
    finalColor = foreground;
    return;
  }
  vec4 style = texture(uStyleTexture, vec2((material + 0.5) / 256.0, 0.5));
  vec4 palette = texture(uPaletteTexture, vec2((material + 0.5) / 256.0, 0.5));
  float family = floor(style.r * 255.0 + 0.5);
  float profile = floor(style.g * 255.0 + 0.5);
  float traits = floor(style.a * 255.0 + 0.5);
  bool materialEmissive = style.b > 0.5;
  float optics = floor(palette.a * 255.0 + 0.5);
  vec2 grid = uv * uFieldSize - 0.5;
  vec2 blend = fract(grid);
  vec2 origin = (floor(grid) + 0.5) * uTexel;
  // The direct mesh already pays these four semantic samples for exact-owner
  // coverage. Keep the decoded IDs briefly so rigid contours can distinguish
  // real Empty from an unlike solid, gas, or liquid without another texture
  // fetch; only the derived scalar survives into the solid-only style branch.
  float material00 = materialAt(origin);
  float material10 = materialAt(origin + vec2(uTexel.x, 0.0));
  float material01 = materialAt(origin + vec2(0.0, uTexel.y));
  float material11 = materialAt(origin + uTexel);
  float q00 = 1.0 - step(0.5, abs(material00 - material));
  float q10 = 1.0 - step(0.5, abs(material10 - material));
  float q01 = 1.0 - step(0.5, abs(material01 - material));
  float q11 = 1.0 - step(0.5, abs(material11 - material));
  float solidAirFacing = max(
    max(1.0 - step(0.5, material00), 1.0 - step(0.5, material10)),
    max(1.0 - step(0.5, material01), 1.0 - step(0.5, material11))
  );
  float density = mix(mix(q00, q10, blend.x), mix(q01, q11, blend.x), blend.y);
  float semanticDensity = density;
  vec2 powderFieldSlope = vec2(0.0);
  float powderFieldBlend = 0.0;
  if (family == 4.0) {
    if (uPowderStyle < 0.5) {
      // Grains is the exact square-cell reference: coverage never spills into
      // an Empty neighbour, regardless of output scale or powder stability.
      density = same(uv, material);
    } else if (uPowderStyle < 1.5) {
      // Local remains one rounded particle per semantic cell. The compact 8x
      // mesh used to leave this as bilinear coverage, making it indistinguish-
      // able from Smooth at high detail; retain the normal renderer's stable
      // world-anchored offset without a field/sample/pass.
      float grainOffsetY = fract(sin(dot(floor(grid), vec2(39.346, 11.135))) * 24634.6345) - 0.5;
      float grainOffsetX = fract(sin(dot(floor(grid), vec2(73.619, 17.713))) * 12463.3795) - 0.5;
      vec2 grainCentre = vec2(grainOffsetX, grainOffsetY) * 0.075;
      // Grid is deliberately shifted by -0.5 for the 2x2 owner block. Put
      // the Local disc back on its semantic cell centre before measuring it;
      // using fract(grid) here offset every grain by half a cell and erased
      // legitimate column centres under the true-8x support audit.
      float grainDistance = length(fract(grid + 0.5) - 0.5 - grainCentre);
      density = 1.0 - smoothstep(0.34, 0.56, grainDistance);
    } else if (uPowderSurfaceActive > 0.5) {
      vec4 smoothPowderShape = projectedSmoothPowder > 0.5
        ? projectedPowderShape : powderSurfaceEightXShape(uv);
      float verticalShare = abs(smoothPowderShape.z)
        / (abs(smoothPowderShape.y) + abs(smoothPowderShape.z) + 0.000001);
      float semanticCompatibility = projectedSmoothPowder > 0.5 ? 1.0
        : smoothstep(0.42, 0.92, semanticDensity);
      powderFieldBlend = max(projectedSmoothPowder,
        smoothstep(0.42, 0.70, verticalShare)
          * smoothstep(0.004, 0.027, abs(smoothPowderShape.z))
          * smoothstep(5.5, 8.0, smoothPowderShape.w)
          * semanticCompatibility);
      powderFieldSlope = smoothPowderShape.yz;
      // The field supplies only the settled outer volume. Semantic density
      // remains the colour/mesostructure owner in the powder branch below, so
      // a Smooth pile gains one curved silhouette without becoming airbrushed.
      density = mix(density, smoothPowderShape.x, powderFieldBlend);
    }
  }
  // Preserve exact material coverage before a liquid/gas volume may replace
  // the working density. Air-facing Surface styling needs this semantic edge;
  // field density remains authoritative for volume colour and final support.
  if (family == 1.0) density = max(density * 0.20, atmosphere.a);
  if (family == 2.0) density = max(density, liquid.a);
  float depth = texture(uBoundaryStabilityTexture, uv).r;
  vec3 color = palette.rgb;
  if (family == 1.0) {
    float gasDensity = max(density, atmosphere.a);
    float gasShell = 1.0 - smoothstep(0.22, 0.82, gasDensity);
    color = mix(color, atmosphere.rgb, min(0.82, atmosphere.a));
    color += emission.rgb * gasFieldScatter * (0.018 + gasShell * 0.030);
    if (uGasFieldLighting > 0.5) {
      vec2 atmosphereMin = uAtmosphereTexel * 0.5;
      vec2 atmosphereMax = vec2(1.0) - atmosphereMin;
      float gasLeft = texture(uAtmosphereTexture,
        clamp(uv - vec2(uAtmosphereTexel.x, 0.0), atmosphereMin, atmosphereMax)).a;
      float gasRight = texture(uAtmosphereTexture,
        clamp(uv + vec2(uAtmosphereTexel.x, 0.0), atmosphereMin, atmosphereMax)).a;
      float gasTop = texture(uAtmosphereTexture,
        clamp(uv - vec2(0.0, uAtmosphereTexel.y), atmosphereMin, atmosphereMax)).a;
      float gasBottom = texture(uAtmosphereTexture,
        clamp(uv + vec2(0.0, uAtmosphereTexel.y), atmosphereMin, atmosphereMax)).a;
      color += gasEightXVolumeRelief(gasDensity, gasLeft, gasRight, gasTop, gasBottom);
    }
    if (uGasIdentityStyling > 0.5) {
      float gasIdentityStyle = floor(texture(uAtmosphereStyleTexture, uv).r * 255.0 + 0.5);
      color += gasIdentityEightXDelta(gasIdentityStyle, gasDensity)
        + uGasVolumeChroma * gasIdentityEightXChroma(gasIdentityStyle, gasDensity);
    }
  }
  else if (family == 2.0) color = mix(color, liquid.rgb, min(0.78, liquid.a));
  else if (family == 3.0) {
    color = mix(color, emission.rgb, emission.a * 0.35) + emission.rgb * 0.18;
    // True 8x keeps Energy's dense-core relief static so a 15M-fragment
    // presentation neither introduces a clock-driven redraw nor needs the
    // normal presenter's extra probes. The centre emission sample, material,
    // grid, and bilinear density are already live here. This changes RGB only:
    // semantic support and the later alpha calculation remain authoritative.
    float denseEnergy = smoothstep(0.12, 0.48, emission.a)
      * smoothstep(0.18, 0.66, density);
    vec2 energyCell = floor(grid);
    float energyLobe = 1.0 - abs(fract(
      energyCell.x * 0.055 + energyCell.y * 0.035 + material * 0.071
    ) * 2.0 - 1.0);
    // A ±7% core response stays below the true-8x framebuffer peak bound while
    // giving cool ELEC enough luma movement to retain a visible dense-body
    // volume after quantisation.
    float energyRelief = (energyLobe - 0.5) * 0.14 * denseEnergy;
    color *= 1.0 + energyRelief * uEnergyCoreRelief;

    // Match normal WebGL's nine exact native energy identities in a static
    // form. Dense supported bodies still attenuate the cell-frequency mark so
    // broad emission relief remains dominant instead of becoming visual noise.
    color += energyEightXIdentityDelta(material, energyCell)
      * (1.0 - denseEnergy * 0.65) * uEnergyIdentityStyling;
  }
  // Lava is deliberately outside the shared liquid contour/reconstruction
  // path: its broad glow remains owned by the emission field. Dense, exact
  // Lava still needs an interior body read at deep zoom, though. Reuse the
  // four semantic owners and the existing centre liquid mix only; this adds
  // static RGB convection ridges and cooled pockets, never a texture fetch,
  // alpha/support decision, wall decision, or animated 15M-fragment cost.
  if (uMoltenBodyOptics > 0.5 && family == 2.0 && material == 11.0
    && optics == 4.0 && traits < 0.5 && !materialEmissive) {
    float lavaInterior = q00 * q10 * q01 * q11 * smoothstep(0.76, 0.96, density);
    if (lavaInterior > 0.0) {
      float lavaRibbon = 1.0 - abs(fract(
        grid.x * 0.056 + grid.y * 0.034 + 0.173
      ) * 2.0 - 1.0);
      float lavaCrossflow = 1.0 - abs(fract(
        grid.x * -0.019 + grid.y * 0.047 + 0.419
      ) * 2.0 - 1.0);
      float lavaRidge = smoothstep(0.66, 0.94, lavaRibbon)
        * mix(0.60, 1.0, lavaCrossflow);
      float lavaPocket = 1.0 - smoothstep(0.24, 0.54, lavaRibbon);
      color *= vec3(1.0) - vec3(0.070, 0.032, 0.010) * lavaPocket * lavaInterior;
      color += (vec3(1.0) - clamp(color, 0.0, 1.0))
        * vec3(1.00, 0.34, 0.055) * lavaRidge * 0.060 * lavaInterior;
    }
  }
  if (family == 4.0) {
    float powderDepth = depth * uPowderBodyDepth;
    // Smooth changes a settled silhouette, not the material's interior into a
    // uniform airbrushed fill. Preserve the exact-cell density and a bounded
    // world-anchored microvariation for all three powder modes.
    float powderOpticalDensity = mix(semanticDensity, density, 0.18);
    float powderGrain = fract(sin(dot(floor(grid), vec2(23.417, 61.873))) * 18347.2861) - 0.5;
    // The normal 1x-4x compositor resolves a second, 2x2 world-anchored
    // mineral facet inside every powder cell.  Keep that cadence at true 8x:
    // without it, a Detail change preserves the silhouette but reduces a
    // settled material body to one coarser grain frequency.  This is derived
    // from the already-live world coordinate only, so it adds no sample,
    // field, pass, alpha/support decision, or 8x resource.  Retain the same
    // near-full Smooth facet response used by the normal path; Local and
    // square Grains remain their unsoftened presentation references.
    vec2 powderSubcell = floor(fract(grid) * 2.0);
    float powderFacet = fract(sin(dot(
      floor(grid) * 2.0 + powderSubcell, vec2(12.9898, 78.233)
    )) * 43758.5453) - 0.5;
    float powderFacetRetention = uPowderStyle > 1.5 ? 0.99 : 1.0;
    float powderFacetGain = optics == 13.0 ? 1.12
      : (optics == 14.0 ? 0.35 : (optics == 15.0 ? 0.90 : 1.0));
    // The colour facet is deliberately a semantic-bulk treatment, never an
    // edge treatment. Where the existing Hermite powder field owns the curved
    // exterior, it is exactly disabled. The boundary byte tracks settlement,
    // not optical thickness, and the 2x2 reconstruction block straddles a
    // semantic edge even for some legitimate inner samples. A nonzero field
    // blend is therefore the authoritative contour discriminator; untouched
    // semantic bulk retains its material cadence without changing coverage.
    // Local and Grains are exact comparison modes; only Smooth receives this
    // retained interior mesostructure.
    float powderFacetInterior = uPowderStyle > 1.5
      ? (1.0 - step(0.001, powderFieldBlend)) * smoothstep(0.55, 0.88, density)
      : 0.0;
    // Smooth may cohere a settled silhouette, but it must not erase the
    // material's internal grain colour. Its bounded, world-anchored variation
    // is deliberately stronger than the reference modes' particle shading:
    // the result reads as a continuous body with mineral depth rather than a
    // uniformly airbrushed fill at 1x through true 8x.
    float powderMicro = uPowderStyle < 0.5 ? 0.032 : (uPowderStyle < 1.5 ? 0.044 : 0.085);
    // Preserve the quiet contour cadence, then restore stronger mineral
    // contrast only after all four already-live semantic owners prove a real
    // Smooth-powder interior. That keeps the screenshot's outer alpha rise
    // monotone while retaining normal-detail material texture in the body.
    if (uPowderStyle > 1.5) {
      float powderMicroInterior = q00 * q10 * q01 * q11
        * smoothstep(0.66, 0.94, semanticDensity);
      powderMicro = mix(powderMicro, 0.120, powderMicroInterior);
    }
    // The direct 8x Sand calibration below is deliberately exposure-only.
    // Restore its small world-anchored mineral deltas before that calibration
    // so matching normal-scale exposure never means losing the normal
    // compositor's readable inner grain colour.
    float powderDetailCalibration = material == 1.0 && uPowderStyle > 1.5
      && traits < 0.5 && !materialEmissive ? 1.08 : 1.0;
    powderMicro *= powderDetailCalibration;
    // The Smooth field owns the curved exterior. Suppress only the
    // cell-frequency pigment while that field is blending the contour, so a
    // shallow slope has one monotone composed edge rather than a different
    // mineral key at each subpixel. The settled semantic interior retains the
    // complete world-anchored grain vocabulary below.
    float powderContourGrain = powderGrain * (1.0 - powderFieldBlend);
    color *= vec3(1.02 + powderOpticalDensity * 0.07 + powderContourGrain * powderMicro)
      - powderDepth * vec3(0.10, 0.07, 0.04);
    if (traits < 0.5 && !materialEmissive) {
      // Match the normal composer's material facet magnitude without turning
      // the high-resolution direct mesh into a cell-grid overlay.  The small
      // upper-left catchlight makes the 2x2 facets legible at deep zoom while
      // retaining the existing semantic colour as the material owner.
      color *= 1.0 + powderFacet * 0.24 * powderFacetRetention * powderFacetGain
        * powderDetailCalibration
        * powderFacetInterior;
      float powderFacetHighlight = max(0.0, 0.60 - powderSubcell.x - powderSubcell.y);
      color += color * powderFacetHighlight * 0.135 * powderFacetRetention * powderFacetGain
        * powderDetailCalibration
        * powderFacetInterior;
      float brightPowderFacet = max(0.0, powderFacet - 0.18) * powderFacetRetention
        * powderFacetInterior * powderDetailCalibration;
      if (optics == 13.0) {
        color += vec3(0.52, 0.78, 1.00) * brightPowderFacet * 0.085;
      } else if (optics == 15.0) {
        color += vec3(1.00, 0.68, 0.32) * brightPowderFacet * 0.060;
      }
      // Keep the normal compositor's chromatic mineral vocabulary at true 8x
      // for the three settled earth materials.  The existing Smooth interior
      // proof makes this RGB-only term an exact no-op for contours, Local,
      // Grains, loose grains, traits, and emissive matter.
      float mineralPowderOwner = (material == 1.0 || material == 26.0 || material == 28.0)
        ? 1.0 : 0.0;
      color += palette.rgb * powderGrain * vec3(0.220, 0.051, -0.138)
        * powderFacetInterior * mineralPowderOwner;
    }
    // Smooth, supported powder retains a coloured stable edge. Local and
    // Grains are intentionally exact no-ops, as are a one-cell grain and
    // traits/emissive owners. The compact support guard preserves fine holes
    // and prevents the contour from becoming a coarse blanket over a pile.
    if (uSurfaceContourLighting > 0.5 && uPowderStyle > 1.5
      && traits < 0.5 && !materialEmissive) {
      // A shallow connected slope commonly presents exactly two compatible
      // owners in this 2x2 block. Treat that as full contour support while a
      // lone particle remains an exact zero and therefore keeps its round or
      // square reference appearance.
      float powderSupport = smoothstep(1.0, 2.0, q00 + q10 + q01 + q11);
      vec2 powderSlope = vec2(
        mix(q10 - q00, q11 - q01, blend.y),
        mix(q01 - q00, q11 - q10, blend.x)
      );
      powderSlope = mix(powderSlope, powderFieldSlope, powderFieldBlend);
      color = mix(color,
        applySurfaceContourEightX(color, density, powderSlope, optics, 1.0, 0.0), powderSupport);
    }
    // Keep explosive powders legible as discrete native materials even in the
    // compact compositor. This is strictly RGB-only and owner-local; Grains,
    // coverage, support, wall compositing, and every non-explosive material
    // remain controlled by the existing semantic path.
    if (uExplosivePowderStyling > 0.5 && traits < 0.5 && !materialEmissive) {
      color = clamp(color + explosivePowderEightXDelta(material, grid, density), 0.0, 1.0);
    }
    // Common Earth/mineral piles retain their normal material identity only in
    // Smooth view. Local and square Grains are explicit visual references, so
    // this arithmetic-only overlay cannot affect either presentation mode.
    if (uEarthenPowderStyling > 0.5 && uPowderStyle > 1.5
      && earthenPowderEightXStyle(material) > 0.5
      && traits < 0.5 && !materialEmissive) {
      color = clamp(color + earthenPowderEightXDelta(material, grid, density), 0.0, 1.0);
    }
    // The more unusual loose materials have a quiet material-seeded body
    // language in Smooth view. Local and Grains intentionally retain their
    // exact reference renderings, so this is never allowed to alter them.
    if (uUnusualPowderStyling > 0.5 && uPowderStyle > 1.5
      && unusualPowderEightXStyle(material) > 0.5
      && traits < 0.5 && !materialEmissive) {
      color = clamp(color + unusualPowderEightXDelta(material, grid, density), 0.0, 1.0);
    }
    // The compact high-resolution powder grammar keeps Sand's grain contrast,
    // but its stacked optical/key terms otherwise expose the canonical pile
    // slightly brighter than the normal compositor. Subtract a restrained
    // material albedo offset rather than scaling the finished colour: a scalar
    // would dim the individual mineral deltas along with the exposure and put
    // Smooth below the normal path's interior-grain contrast. Calibrate only this
    // settled Smooth material after its identity layers: Local and square
    // Grains remain untouched diagnostic references, and no support/alpha or
    // simulation decision is involved.
    if (material == 1.0 && uPowderStyle > 1.5 && traits < 0.5 && !materialEmissive) {
      // A curved outer contour is already colour-balanced by its Hermite
      // surface-light path. Require all four already-live exact material
      // samples plus a dense semantic centre for this core exposure match:
      // that keeps a broad stable interior calibrated without broadening the
      // apparent Smooth silhouette at deep zoom.
      float sandInteriorExposure = q00 * q10 * q01 * q11
        * smoothstep(0.72, 0.95, semanticDensity);
      // The normal renderer's deep-Sand core is materially darker after its
      // body optics and image-space composition.  Keep the direct mesh in the
      // same exposure band without touching its retained grain/facet deltas:
      // this is an RGB-only core correction, deliberately stronger in the
      // warm channels that were still visibly washed out at true 8x.
      color = max(color - vec3(50.0, 45.0, 27.0) / 255.0 * sandInteriorExposure, vec3(0.0));
      // Keep the correction exposure-neutral while retaining enough mineral
      // pigment separation for a dense 8x body to match the normal compositor.
      // These two existing zero-mean world-anchored signals are deliberately
      // gated by the exact same settled interior proof as the earlier facets;
      // no silhouette, support, Local, or square-Grains pixel can receive it.
      float sandInteriorPigment = (powderGrain * 0.365 + powderFacet * 0.285)
        * powderFacetInterior;
      color = clamp(color + vec3(1.00, 0.78, 0.46) * sandInteriorPigment, 0.0, 1.0);
    }
  }
  // Deep rigid bodies reuse the existing exact-species occupancy, auxiliary
  // thickness byte, and compact analytic grid. At true 8x this gives smooth,
  // organic, device, radioactive, and translucent solids a restrained body
  // read without a new texture, probe, pass, or clock-driven variation. The
  // strict interior guard keeps granular matter, thin strokes, holes, walls,
  // and unlike-material seams presentation-exact.
  if (family == 0.0) {
    float solidBaseLight = 0.94 + density * 0.13;
    // Restore the global family-coloured surface-contour control with the
    // direct mesh's existing exact-owner shape. This complements, rather than
    // replaces, the separate curvature-depth toggle below: straight contours
    // receive a small directional key/fill while curvature remains a strict
    // straight-edge no-op.
    if (uSurfaceContourLighting > 0.5 && traits < 0.5 && !materialEmissive
      && !solidEightXGranular(optics)) {
      vec2 solidSurfaceSlope = vec2(
        mix(q10 - q00, q11 - q01, blend.y),
        mix(q01 - q00, q11 - q10, blend.x)
      );
      color = applySurfaceContourEightX(
        color, density, solidSurfaceSlope, optics, 0.0, solidAirFacing
      );
    }
    // Derive an intrinsic contour curvature from the already-live 2x2 exact
    // owner samples. Hermite's first/second derivatives make a horizontal or
    // vertical straight contour an exact no-op; the contour band also keeps
    // dense interiors untouched. This changes RGB only and never alters the
    // later semantic alpha, ownership, or support calculation.
    if (uSolidCurvatureDepth > 0.5 && !materialEmissive && !solidEightXGranular(optics)) {
      vec2 hermite = blend * blend * (3.0 - 2.0 * blend);
      vec2 hermiteSlope = 6.0 * blend * (1.0 - blend);
      vec2 hermiteCurve = 6.0 - 12.0 * blend;
      float row0 = mix(q00, q10, hermite.x);
      float row1 = mix(q01, q11, hermite.x);
      float contourDx = mix(q10 - q00, q11 - q01, hermite.y) * hermiteSlope.x;
      float contourDy = (row1 - row0) * hermiteSlope.y;
      float contourDxx = mix(q10 - q00, q11 - q01, hermite.y) * hermiteCurve.x;
      float contourDyy = (row1 - row0) * hermiteCurve.y;
      float contourDxy = (q11 - q01 - q10 + q00) * hermiteSlope.x * hermiteSlope.y;
      float contourGradient2 = contourDx * contourDx + contourDy * contourDy;
      float contourBand = smoothstep(0.03, 0.34, density)
        * (1.0 - smoothstep(0.62, 0.97, density));
      float contourInvGradient = inversesqrt(max(0.0025, contourGradient2));
      float contourCurvature = (contourDxx * contourDy * contourDy
        - 2.0 * contourDx * contourDy * contourDxy
        + contourDyy * contourDx * contourDx)
        * contourInvGradient * contourInvGradient * contourInvGradient;
      float curvatureResponse = clamp(
        contourCurvature * 0.025 * solidEightXCurvatureGain(optics), -0.045, 0.045
      ) * contourBand;
      color *= 1.0 + curvatureResponse;
    }
    bool deepSolidBody = uSolidOpticalDepth > 0.5 && !materialEmissive
      && depth > 6.0 / 255.0 && q00 * q10 * q01 * q11 > 0.5 && density > 0.76
      && !solidEightXGranular(optics);
    if (deepSolidBody) {
      float depthT = smoothstep(6.0 / 255.0, 42.0 / 255.0, depth);
      float linearThickness = clamp((depth * 255.0 - 6.0) / 249.0, 0.0, 1.0);
      float shapedThickness = linearThickness * (1.4 - linearThickness * 0.4);
      float thicknessGain = optics == 8.0 || optics == 19.0 ? 23.0
        : optics == 9.0 ? 18.0 : optics == 10.0 ? 25.0
          : optics == 11.0 ? 21.0 : optics == 12.0 ? 13.0 : 16.0;
      vec2 bodyAxis = optics == 9.0 ? vec2(1.0, 4.0)
        : optics == 10.0 ? vec2(4.0, 0.0) : optics == 11.0 ? vec2(3.0, -2.0)
          : vec2(2.0, 1.0);
      float bodyPhase = fract((dot(floor(grid), bodyAxis) + material * 11.0) / 128.0);
      float bodyTriangle = 1.0 - abs(bodyPhase * 2.0 - 1.0);
      float bodyLobe = bodyTriangle * bodyTriangle * (3.0 - bodyTriangle * 2.0);
      float bodyResponse = (bodyLobe - 0.5) * depthT;
      vec3 bodyKey = solidEightXBodyKey(optics);
      vec3 bodyShadow = solidEightXBodyShadow(optics);
      color *= solidBaseLight * (vec3(1.0) - bodyShadow * (thicknessGain / 255.0
        * shapedThickness));
      // A broad rigid body already pays the full thickness absorption above.
      // Let its existing positive macro lobe recover a restrained 7-byte key
      // at the lobe apex, while leaving pocket shadow and every semantic
      // coverage decision untouched. This is the compact counterpart of the
      // normal WebGL crown calibration below.
      color += bodyKey * max(0.0, bodyResponse)
        * (optics == 11.0 ? 4.0 / 255.0 : 14.0 / 255.0)
        - bodyShadow * max(0.0, -bodyResponse)
          * (optics == 11.0 ? 16.0 / 255.0 : 10.0 / 255.0);
      // Exact structural metals get a broad rolled reflection only once the
      // existing thickness byte and four-owner proof establish a real body.
      // Keep it under the established construction-style switch and leave
      // traits, emissive solids, thin structures, and semantic coverage alone.
      if (uStructuralRigidStyling > 0.5 && traits < 0.5) {
        color = clamp(color + structuralMetalEightXBodyDelta(
          material, grid, depthT, bodyResponse
        ), 0.0, 1.0);
      }
      // Wood keeps the native botanical identity mark below, but a thick trunk
      // needs a quieter, longitudinal body read than generic Organic matter.
      // This derives its grain from the world grid and already-proven body
      // depth/relief only. Fine branches, authored holes, and lifecycle state
      // remain outside this interior-only RGB treatment.
      if (material == 9.0) {
        float woodGrain = 0.5 + 0.5 * sin(
          grid.x * 0.20 + sin(grid.y * 0.115 + material) * 1.45
        );
        float woodRidge = smoothstep(0.64, 0.94, woodGrain);
        float woodPocket = 1.0 - smoothstep(0.28, 0.58, woodGrain);
        float woodCrown = max(0.0, bodyResponse);
        float woodShade = max(0.0, -bodyResponse);
        color *= vec3(1.0) - vec3(0.075, 0.040, 0.018)
          * (woodPocket * 0.52 + woodShade * 0.38) * depthT;
        color += (vec3(1.0) - clamp(color, 0.0, 1.0))
          * vec3(0.50, 0.25, 0.07) * (woodRidge * 0.34 + woodCrown * 0.22) * depthT;
      }
      // PLNT's native shape and lifecycle state remain authoritative below,
      // but a broad, exact-species canopy should not flatten into the generic
      // organic band at deep zoom. Mirror normal WebGL's restrained leaf
      // crown, pocket, and waxy catch-light from the density/slope already
      // resident in this branch. This is RGB-only arithmetic: no state fetch,
      // neighbour probe, field, alpha, support, or growth decision is added.
      if (material == 10.0) {
        float canopyCrown = max(0.0, bodyResponse) * 2.0;
        float canopyPocket = max(0.0, -bodyResponse) * 2.0;
        color += vec3(1.5, 6.5, 2.3) / 255.0 * canopyCrown;
        color *= vec3(1.0) - vec3(0.075, 0.040, 0.095) * canopyPocket;
        vec2 canopySlope = vec2((q10 + q11) - (q00 + q01),
          (q01 + q11) - (q00 + q10)) * 0.50;
        vec3 canopyNormal = vec3(-canopySlope * 0.58, 1.0);
        canopyNormal *= inversesqrt(dot(canopyNormal, canopyNormal));
        float canopySpecular = max(0.0, dot(canopyNormal, vec3(-0.34, -0.50, 0.80)));
        canopySpecular *= canopySpecular;
        float canopySheen = (0.008 + canopySpecular * 0.030) * depthT;
        vec3 canopySheenColor = mix(vec3(0.42, 0.72, 0.34),
          clamp(color * 1.10, 0.0, 1.0), 0.72);
        color += (vec3(1.0) - clamp(color, 0.0, 1.0)) * canopySheenColor * canopySheen;
        float canopyCluster = mod(floor(grid.x / 3.0) * 17.0
          + floor(grid.y / 3.0) * 31.0, 29.0) / 28.0;
        float canopyClusterCrown = smoothstep(0.64, 0.93, canopyCluster);
        float canopyClusterPocket = 1.0 - smoothstep(0.18, 0.48, canopyCluster);
        float canopyClusterVein = 1.0 - step(0.5, mod(
          floor(grid.x / 2.0) * 5.0 - floor(grid.y / 3.0) * 3.0, 23.0
        ));
        color += (vec3(1.4, 6.0, 1.0) * canopyClusterCrown
          - vec3(2.6, 3.4, 2.1) * canopyClusterPocket
          + vec3(-2.0, 4.0, -1.2) * canopyClusterVein) / 255.0 * depthT;
      }
    } else color *= solidBaseLight;
  }
  // The normal path already gives every PT_LIFE ctype its own stable colony
  // grammar. Restore that legibility at true 8x without treating the projected
  // ID as a mutable particle state: the exact semantic owner and existing
  // density are the only inputs, so holes, tendrils, isolated cells, alpha,
  // and simulation behaviour remain authoritative elsewhere.
  if (uCellularMaterialStyling > 0.5 && family == 0.0
    && material >= 171.0 && material <= 194.0
    && traits < 0.5 && !materialEmissive) {
    color = clamp(color + cellularIdentityEightXDelta(material, grid, density), 0.0, 1.0);
  }
  // Restore the normal composer's uncommon-solid identity family after the
  // common rigid-body optics. This exact-owner branch is RGB-only: it neither
  // reconstructs support nor touches alpha, so authored holes, fine spurs,
  // isolated cells, and co-located-wall compositing remain authoritative.
  if (uUnusualSolidStyling > 0.5 && family == 0.0
    && unusualSolidEightXStyle(material) > 0.5
    // VRSS retains its native infectious trait overlay after this static capsid
    // base. All other trait-bearing owners remain an exact no-op here.
    && (traits < 0.5 || material == 216.0) && !materialEmissive) {
    color = clamp(color + unusualSolidEightXDelta(material, grid, density), 0.0, 1.0);
  }
  // Coal's ordinary optics are granular, so it deliberately skips the common
  // rigid-body branch above. Its exact-material depth byte plus the same four
  // already-live owner samples prove a genuine geological core here without
  // changing its granular edge silhouette or spending another texture read.
  if (uGeologicalSolidStyling > 0.5 && family == 0.0
    && traits < 0.5 && !materialEmissive && (material == 19.0 || material == 78.0)
    && depth > 6.0 / 255.0 && q00 * q10 * q01 * q11 > 0.5 && density > 0.76) {
    float geologicalDepth = smoothstep(6.0 / 255.0, 42.0 / 255.0, depth);
    float geologicalPhase = fract((grid.x * 2.0 + grid.y + material * 11.0) / 128.0);
    float geologicalTriangle = 1.0 - abs(geologicalPhase * 2.0 - 1.0);
    float geologicalResponse = (geologicalTriangle * geologicalTriangle
      * (3.0 - geologicalTriangle * 2.0) - 0.5) * geologicalDepth;
    color = clamp(color + geologicalSolidEightXDelta(
      material, grid, geologicalDepth, geologicalResponse
    ), 0.0, 1.0);
  }
  if (uThermalCatalyticRigidStyling > 0.5 && family == 0.0
    && traits < 0.5 && !materialEmissive
    && (material == 72.0 || material == 75.0 || material == 79.0)
    && depth > 6.0 / 255.0 && q00 * q10 * q01 * q11 > 0.5 && density > 0.76) {
    float thermalCatalyticDepth = smoothstep(6.0 / 255.0, 42.0 / 255.0, depth);
    float thermalCatalyticPhase = fract((grid.x * 2.0 + grid.y + material * 11.0) / 128.0);
    float thermalCatalyticTriangle = 1.0 - abs(thermalCatalyticPhase * 2.0 - 1.0);
    float thermalCatalyticResponse = (thermalCatalyticTriangle * thermalCatalyticTriangle
      * (3.0 - thermalCatalyticTriangle * 2.0) - 0.5) * thermalCatalyticDepth;
    color = clamp(color + thermalCatalyticRigidEightXDelta(
      material, grid, thermalCatalyticDepth, thermalCatalyticResponse
    ), 0.0, 1.0);
  }
  if (uGooSolidStyling > 0.5 && family == 0.0 && traits < 0.5 && !materialEmissive
    && material == 71.0 && depth > 6.0 / 255.0
    && q00 * q10 * q01 * q11 > 0.5 && density > 0.76) {
    float gooDepth = smoothstep(6.0 / 255.0, 42.0 / 255.0, depth);
    float gooPhase = fract((grid.x * 2.0 + grid.y + material * 11.0) / 128.0);
    float gooTriangle = 1.0 - abs(gooPhase * 2.0 - 1.0);
    float gooResponse = (gooTriangle * gooTriangle * (3.0 - gooTriangle * 2.0) - 0.5) * gooDepth;
    color = clamp(color + gooSolidEightXDelta(grid, gooDepth, gooResponse), 0.0, 1.0);
  }
  // This exact owner retains its generic Force trait layer below. Do not use
  // that trait to decide this body cue: ARAY and all other force owners are
  // controls, while semantic coverage and native walls stay compositor-owned.
  if (uFrayForceStyling > 0.5 && material == 118.0 && !materialEmissive) {
    color = clamp(color + frayForceEightXDelta(grid), 0.0, 1.0);
  }
  if (uGbmbForceStyling > 0.5 && material == 120.0 && !materialEmissive) {
    color = clamp(color + gbmbForceEightXDelta(grid), 0.0, 1.0);
  }
  // Sensor glyphs are an exact device-owner overlay. They remain static and
  // RGB-only so sparse wires, isolated cells, holes, walls, and semantics keep
  // the common compositor's coverage and native ownership.
  if (uSensorMaterialStyling > 0.5 && family == 0.0
    && sensorEightXStyle(material) > 0.5
    && traits < 0.5 && !materialEmissive) {
    color = clamp(color + sensorEightXDelta(material, grid, density), 0.0, 1.0);
  }
  // Transport/actuator hardware spans force, powered, and ordinary-solid
  // profiles, and several exact owners deliberately carry a later role trait.
  // Keep this owner-local RGB base outside those category gates; source/force
  // overlays still layer afterward and semantic coverage stays untouched.
  if (uMechanismBodyStyling > 0.5 && mechanismEightXStyle(material) > 0.5
    && !materialEmissive) {
    color = clamp(color + mechanismEightXDelta(material, grid, density), 0.0, 1.0);
  }
  // Control electronics span powered, force, and ordinary Device records and
  // may carry later role traits. Keep their exact-owner body identity outside
  // those generic category gates; the later overlays remain authoritative.
  if (uElectronicIdentityStyling > 0.5 && electronicEightXStyle(material) > 0.5
    && !materialEmissive) {
    color = clamp(color + electronicEightXDelta(material, grid, density), 0.0, 1.0);
  }
  // Construction solids add their material-local finish only after the shared
  // thick-body optics.  It is RGB-only, so contours, holes, spurs, walls, and
  // the exact semantic owner remain entirely under the common compositor.
  if (uStructuralRigidStyling > 0.5 && family == 0.0
    && structuralRigidEightXStyle(material) > 0.5
    && traits < 0.5 && !materialEmissive) {
    color = clamp(color + structuralRigidEightXDelta(material, grid, density), 0.0, 1.0);
  }
  // True 8x deliberately reuses the centre emission sample that is already
  // live for gas and Energy. This is the compact counterpart to normal
  // WebGL's solid-field light: a bounded RGB-only contour/body cue with no
  // outward probe, texture, field, pass, or alpha/support decision.
  if (uSolidFieldLighting > 0.5 && family == 0.0 && traits < 0.5
    && !materialEmissive && optics != 12.0 && material != 3.0
    && emission.a > 0.002) {
    float solidFieldShell = (1.0 - smoothstep(0.40, 0.94, density))
      * smoothstep(0.08, 0.56, density);
    float exactSolidInterior = q00 * q10 * q01 * q11;
    float solidFieldCore = exactSolidInterior
      * smoothstep(6.0 / 255.0, 48.0 / 255.0, depth)
      * smoothstep(0.74, 0.96, density);
    float solidFieldReach = smoothstep(0.002, 0.42, emission.a);
    float solidFieldWeight = (solidFieldShell * 0.040 + solidFieldCore * 0.015)
      * solidFieldReach;
    color += (vec3(1.0) - clamp(color, 0.0, 1.0))
      * emission.rgb * solidFieldWeight;
  }
  // TranslucentRigid is the intentional presentation-alpha exception. Restore
  // the compact equivalent of normal WebGL's crystalline shell and field-light
  // transmission from the samples already live at true 8x. This deliberately
  // carries only the compact shell and field transmission until the final wall
  // composite. That final path also owns a bounded analytical Glass/Ice
  // refraction against an already-decoded native wall. It changes neither
  // support nor material ownership, and adds no sampler, target, or
  // output-scale resource.
  if (family == 0.0 && optics == 12.0 && traits < 0.5 && !materialEmissive) {
    float translucentDepth = smoothstep(0.34, 0.94, density);
    vec2 translucentSlope = vec2((q10 + q11) - (q00 + q01),
      (q01 + q11) - (q00 + q10)) * 0.50;
    float inverseNormalLength = inversesqrt(0.78 + dot(translucentSlope, translucentSlope));
    float shellRim = (1.0 - smoothstep(0.58, 0.98, density))
      * smoothstep(0.12, 0.58, density) * (0.34 + (1.0 - 0.88 * inverseNormalLength) * 0.66);
    // Keep the whole crystalline family legible at deep zoom. The normal
    // compositor already gives each rigid a distinct optical identity; carry
    // that vocabulary here from the same local density/slope state instead of
    // making DRIC, NICE, QRTZ, and RIME all read as generic blue glass.
    vec3 crystalKey = vec3(0.45, 0.78, 1.00);
    float crystalCoreAbsorption = 0.010;
    float crystalRimGain = 1.0;
    float crystalEnvironmentGain = 0.045;
    if (material == 24.0) {
      crystalKey = vec3(0.45, 0.78, 1.00);
      crystalCoreAbsorption = 0.010;
      crystalRimGain = 1.0;
      crystalEnvironmentGain = 0.045;
    } else if (material == 12.0) {
      crystalKey = vec3(0.58, 0.86, 1.00);
      crystalCoreAbsorption = 0.006;
      crystalRimGain = 0.82;
      crystalEnvironmentGain = 0.032;
    } else if (material == 68.0) {
      crystalKey = vec3(0.46, 0.74, 0.96);
      crystalCoreAbsorption = 0.018;
      crystalRimGain = 0.68;
      crystalEnvironmentGain = 0.028;
    } else if (material == 74.0) {
      crystalKey = vec3(0.54, 0.88, 1.00);
      crystalCoreAbsorption = 0.008;
      crystalRimGain = 1.18;
      crystalEnvironmentGain = 0.038;
    } else if (material == 76.0) {
      crystalKey = vec3(0.58, 0.74, 1.00);
      crystalCoreAbsorption = 0.012;
      crystalRimGain = 0.92;
      crystalEnvironmentGain = 0.050;
    } else if (material == 77.0) {
      crystalKey = vec3(0.64, 0.86, 1.00);
      crystalCoreAbsorption = 0.009;
      crystalRimGain = 1.05;
      crystalEnvironmentGain = 0.034;
    }
    if (uTranslucentLensShell > 0.5) {
      float shellLight = clamp((0.46 - translucentSlope.x * 0.38
        - translucentSlope.y * 0.54) * inverseNormalLength, 0.0, 1.0);
      color *= 1.0 - translucentDepth * crystalCoreAbsorption;
      color += crystalKey * shellRim * crystalRimGain * (0.016 + shellLight * 0.040);
      // The normal compositor's Glass/Ice bodies carry a broad environment and
      // Fresnel shoulder. Reconstruct the same compact cue from the live
      // owner slope instead of adding a field or a high-resolution blur: the
      // translucent body stays continuous at deep zoom while its semantic
      // coverage, alpha, refraction, and field transmission remain untouched.
      vec3 crystalNormal = vec3(-translucentSlope * 0.76, 1.0);
      crystalNormal *= inversesqrt(dot(crystalNormal, crystalNormal));
      float crystalSpecular = max(0.0, dot(crystalNormal, vec3(-0.34, -0.50, 0.80)));
      crystalSpecular *= crystalSpecular;
      crystalSpecular *= crystalSpecular;
      float crystalFresnel = 1.0 - crystalNormal.z;
      crystalFresnel *= crystalFresnel;
      vec3 crystalEnvironment = mix(
        vec3(0.035, 0.055, 0.080), vec3(0.10, 0.070, 0.040),
        clamp(0.48 - crystalNormal.y * 0.55 + crystalNormal.x * 0.12, 0.0, 1.0)
      );
      float crystalShellGloss = shellRim * crystalRimGain * (0.012 + crystalSpecular * 0.036
        + crystalFresnel * 0.030);
      color += (vec3(1.0) - clamp(color, 0.0, 1.0)) * crystalKey * crystalShellGloss;
      color += crystalEnvironment * shellRim * crystalFresnel
        * crystalEnvironmentGain;
      // A broad Glass tile can be entirely inside the local shell band at a
      // deep zoom, which otherwise collapses this translucent body to a nearly
      // flat tint. Reuse the existing exact-species thickness byte and
      // world-anchored body phase for a low-frequency crown/pocket response.
      // It is RGB-only and exact-owner gated: thin glass, boundaries, holes,
      // walls, other crystalline solids, alpha, and refraction stay on their
      // existing paths.
      if (material == 24.0) {
        // The auxiliary thickness is assigned only to authoritative exact
        // solid interiors and is zero at edges, holes, walls, and unlike seams.
        // It therefore remains the conservative guard here without requiring a
        // second four-neighbour proof that would suppress a valid narrow slab.
        float glassVolume = smoothstep(6.0 / 255.0, 42.0 / 255.0, depth);
        // Unlike the shell cue above, this is a true volume response. A broad
        // pane therefore darkens gently toward its thickness-proven core while
        // retaining the cool blue transmission rather than becoming opaque.
        color *= vec3(1.0) - vec3(0.080, 0.035, 0.010) * glassVolume;
        // The direct 8x palette is otherwise exposed above the normal
        // compositor once this translucent body is composited premultiplied.
        // Apply the matching volume-only calibration rather than darkening a
        // shell or border; exterior support and alpha remain exact.
        color *= mix(1.0, 0.81, glassVolume);
        float glassPhase = fract((floor(grid.x) * 2.0 + floor(grid.y) * 3.0
          + material * 0.17) / 96.0);
        float glassLobe = 1.0 - abs(glassPhase * 2.0 - 1.0);
        float glassCrown = smoothstep(0.62, 0.94, glassLobe);
        float glassPocket = 1.0 - smoothstep(0.20, 0.50, glassLobe);
        color *= vec3(1.0) - vec3(0.032, 0.016, 0.004) * glassVolume
          * (0.34 + glassPocket * 0.66);
        color += (vec3(1.0) - clamp(color, 0.0, 1.0)) * crystalKey
          * glassCrown * glassVolume * 0.045;
      }
    }
    float exactTranslucentInterior = q00 * q10 * q01 * q11;
    if (uTranslucentFieldTransmission > 0.5 && exactTranslucentInterior > 0.5
      && emission.a > 0.002) {
      float transmittedReach = smoothstep(0.002, 0.42, emission.a);
      float transmittedWeight = mix(0.10, 0.17, translucentDepth);
      vec3 transmissionTint = material == 12.0 ? vec3(0.88, 1.02, 1.12) : vec3(1.0);
      vec3 transmittedLight = emission.rgb * transmissionTint * transmittedReach * transmittedWeight;
      color += (vec3(1.0) - clamp(color, 0.0, 1.0)) * transmittedLight;
    }
  }
  // Compact Device bodies retain a restrained static bus/terminal cue at true
  // 8x. This gives force infrastructure the same deliberate body language as
  // ordinary device solids without a sampler, clock, topology, or alpha cost.
  if (family == 0.0 && optics == 10.0) {
    vec2 deviceCell = floor(grid);
    float bus = 1.0 - step(0.5, mod(deviceCell.x + floor(deviceCell.y / 4.0), 9.0));
    float terminal = 1.0 - step(1.5, mod(deviceCell.x * 3.0 + deviceCell.y * 5.0, 17.0));
    float trace = max(bus * 0.72, terminal);
    color += vec3(3.0, 8.0, 11.0) * trace * (0.28 + density * 0.72) / 255.0;
  }
  // The centre liquid field remains live for reconstructed Empty support, but
  // the four neighbour probes are meaningful only for ordinary liquid bodies.
  // Keeping them inside this branch avoids eight texture fetches per occupied
  // non-liquid fragment in the fifteen-million-fragment true-8x compositor.
  // Carry only this bounded alpha scale out of the liquid branch. It lets the
  // final premultiplied compositor trim a supported air-facing fringe without
  // retaining the four liquid samples across the rest of the compact shader.
  float liquidCohesionAlphaScale = 1.0;
  // Keep only the two bounded RGB strengths live past the liquid branch. The
  // packed native-wall word is decoded later with the other retained-state
  // owners, so delaying application lets a co-located wall remain an exact
  // no-op without adding a fourth wall-texture sample.
  float liquidSurfaceContourKeyStrength = 0.0;
  float liquidSurfaceContourShadowStrength = 0.0;
  float liquidEmissionReflectionStrength = 0.0;
  bool nativeWallForLiquidCohesion = uNativeWallsActive > 0.5
    && uLiquidSilhouetteCohesion > 0.5 && family == 2.0 && optics != 4.0
    && traits < 0.5 && !materialEmissive && density > 0.08 && density < 0.92;
  bool nativeWallForLiquidSurfaceContour = uNativeWallsActive > 0.5
    && uSurfaceContourLighting > 0.5 && family == 2.0 && optics != 4.0
    && traits < 0.5 && !materialEmissive && density > 0.08 && density < 0.92;
  if (family == 2.0 && optics != 4.0) {
    float exactLiquidInterior = q00 * q10 * q01 * q11;
    // Keep the exact semantic IDs from the four existing same-material probes.
    // Besides the established dense-body test, they distinguish true air from
    // an unlike liquid, gas, or solid without another field fetch.
    float liquidMaterialLeft = materialAt(uv - vec2(uTexel.x, 0.0));
    float liquidMaterialRight = materialAt(uv + vec2(uTexel.x, 0.0));
    float liquidMaterialTop = materialAt(uv - vec2(0.0, uTexel.y));
    float liquidMaterialBottom = materialAt(uv + vec2(0.0, uTexel.y));
    float liquidSameLeft = 1.0 - step(0.5, abs(liquidMaterialLeft - material));
    float liquidSameRight = 1.0 - step(0.5, abs(liquidMaterialRight - material));
    float liquidSameTop = 1.0 - step(0.5, abs(liquidMaterialTop - material));
    float liquidSameBottom = 1.0 - step(0.5, abs(liquidMaterialBottom - material));
    float liquidCore = liquidSameLeft * liquidSameRight * liquidSameTop * liquidSameBottom;
    vec4 liquidLeft = texture(uLiquidTexture, uv - vec2(uTexel.x, 0.0));
    vec4 liquidRight = texture(uLiquidTexture, uv + vec2(uTexel.x, 0.0));
    vec4 liquidTop = texture(uLiquidTexture, uv - vec2(0.0, uTexel.y));
    vec4 liquidBottom = texture(uLiquidTexture, uv + vec2(0.0, uTexel.y));
    float liquidSpeciesDifference = max(
      max(length(liquid.rgb - liquidLeft.rgb), length(liquid.rgb - liquidRight.rgb)),
      max(length(liquid.rgb - liquidTop.rgb), length(liquid.rgb - liquidBottom.rgb))
    );
    vec2 liquidSlope = vec2(liquidRight.a - liquidLeft.a, liquidBottom.a - liquidTop.a) * 0.72;
    // The normal WebGL path reduces only an ordinary, connected liquid-air
    // fringe. Reuse this direct mesh's four liquid samples and four semantic
    // probes to make the same conservative decision at true 8x. The scale is
    // never above one, never creates support, and is deferred until the native
    // wall backdrop has proved that this exact cell is wall-free.
    float liquidForeignContact = max(
      max(step(0.5, liquidMaterialLeft) * (1.0 - liquidSameLeft),
        step(0.5, liquidMaterialRight) * (1.0 - liquidSameRight)),
      max(step(0.5, liquidMaterialTop) * (1.0 - liquidSameTop),
        step(0.5, liquidMaterialBottom) * (1.0 - liquidSameBottom))
    );
    if (uLiquidSilhouetteCohesion > 0.5 && traits < 0.5 && !materialEmissive
      && liquidForeignContact < 0.5 && density > 0.08 && density < 0.92) {
      float liquidSupportLeft = step(0.68, liquidLeft.a);
      float liquidSupportRight = step(0.68, liquidRight.a);
      float liquidSupportTop = step(0.68, liquidTop.a);
      float liquidSupportBottom = step(0.68, liquidBottom.a);
      float adjacentLiquidSupport = max(
        max(liquidSupportLeft * liquidSupportTop, liquidSupportTop * liquidSupportRight),
        max(liquidSupportRight * liquidSupportBottom, liquidSupportBottom * liquidSupportLeft)
      );
      float exposedLiquidSide = max(
        max(1.0 - liquidSupportLeft, 1.0 - liquidSupportRight),
        max(1.0 - liquidSupportTop, 1.0 - liquidSupportBottom)
      );
      float liquidNeighbourMean = (liquidLeft.a + liquidRight.a + liquidTop.a + liquidBottom.a) * 0.25;
      float connectedFieldDensity = min(
        density, max(density * 0.65, min(liquid.a, liquidNeighbourMean) * 0.45)
      );
      float liquidSilhouetteDensity = mix(
        // The direct 8x mesh retains sharper exact coverage than normal WebGL.
        // A 0.65 cap keeps a connected one-cell strand inside the shared
        // <=2 RGB-RMS / <=48-byte continuity envelope without widening it.
        density, connectedFieldDensity, adjacentLiquidSupport * exposedLiquidSide * 0.65
      );
      liquidCohesionAlphaScale = clamp(liquidSilhouetteDensity / max(density, 0.001), 0.0, 1.0);
    }
    if (liquidCore > 0.5 && liquidSpeciesDifference < 0.035) {
      color *= 1.08 - depth * uLiquidOpticalDepth * 0.09;
    }
    if (density > 0.72 && exactLiquidInterior > 0.5 && liquidCore > 0.5
      && liquidSpeciesDifference < 0.035) {
      color += uLiquidVolumeChroma * depth * vec3(0.022, 0.010, -0.014);
    }
    // The compact renderer already owns these exact four field samples for
    // liquid depth and species seams. Reuse them for a restrained, connected
    // meniscus/body-light response rather than restoring normal WebGL's extra
    // probes or time-varying waves at 15M fragments. This remains RGB-only:
    // alpha, semantic ownership, reconstructed support, and fluid physics stay
    // field-owned. Molten, trait/emissive, isolated, and unlike-species liquid
    // are deliberate no-ops.
    // Every non-molten liquid optics family can reuse the four already-live
    // liquid samples for a stable body/meniscus read. Organic, radioactive,
    // emissive, isolated, and unlike-species owners remain exact no-ops below.
    bool connectedBodyLiquid = optics == 1.0 || optics == 2.0 || optics == 3.0
      || optics == 16.0 || optics == 17.0 || optics == 18.0;
    if (((uLiquidFieldLighting > 0.5 && liquidSpeciesDifference < 0.035)
      || uSurfaceContourLighting > 0.5)
      && connectedBodyLiquid && traits < 0.5 && !materialEmissive) {
      float liquidSupportCount = step(0.48, liquidLeft.a) + step(0.48, liquidRight.a)
        + step(0.48, liquidTop.a) + step(0.48, liquidBottom.a);
      float connected = smoothstep(1.5, 3.0, liquidSupportCount)
        * smoothstep(0.48, 0.88, liquid.a);
      float liquidNeighbourMean = (liquidLeft.a + liquidRight.a + liquidTop.a + liquidBottom.a) * 0.25;
      float fieldInterior = smoothstep(0.54, 0.90, min(liquid.a, liquidNeighbourMean));
      float inverseNormalLength = inversesqrt(0.86 + dot(liquidSlope, liquidSlope));
      float normalZ = 0.93 * inverseNormalLength;
      float keyLight = clamp((0.44 - liquidSlope.x * 0.42 - liquidSlope.y * 0.58)
        * inverseNormalLength, 0.0, 1.0);
      float airFacingRim = (1.0 - smoothstep(0.52, 0.96, liquidNeighbourMean)) * connected;
      float grazing = clamp(1.0 - normalZ, 0.0, 1.0);
      vec3 meniscusKey = liquidEightXMeniscusKey(optics);
      vec3 meniscusShadow = liquidEightXMeniscusShadow(optics);
      if (uLiquidFieldLighting > 0.5 && liquidSpeciesDifference < 0.035) {
        float bodyResponse = (keyLight - 0.43) * (0.018 + fieldInterior * 0.022) * connected;
        color *= 1.0 + bodyResponse;
        color += meniscusKey * airFacingRim * (0.014 + keyLight * 0.026 + grazing * 0.018);
        color -= meniscusShadow * airFacingRim * (1.0 - keyLight) * 0.010;
        // Aqueous pools need one coherent sky-facing shoulder at deep zoom,
        // not a stronger field wave or a cell-aligned gloss. The top-facing
        // component of the already-live liquid slope and field rim keeps this
        // reflection on connected Water only; it cannot widen support, touch
        // alpha, cross an unlike-liquid seam, or add a fifteenth-million-pixel
        // sampler cost to the direct compositor.
        if (uAqueousSurfaceReflection > 0.5 && optics == 1.0) {
          float aqueousTopReflection = max(0.0, liquidSlope.y) * airFacingRim
            * (0.018 + keyLight * 0.040 + grazing * 0.020);
          color += (vec3(1.0) - clamp(color, 0.0, 1.0))
            * meniscusKey * aqueousTopReflection;
          // Dense Water retains a faint readable body, not only a bright
          // shoreline. This uses the already-proven field interior, local
          // normal, and connected support; it cannot affect alpha, support,
          // a species seam, or the 8x sampler budget. Keep this compact
          // direct-path expression separate from normal WebGL's richer
          // Water-only core: its broader guard crosses SwiftShader's stable
          // live-register limit at fifteen million fragments.
          float aqueousCoreVolume = fieldInterior * (1.0 - airFacingRim) * connected;
          // The compact compositor still needs a measurable submerged body
          // response after its later dense-Water exposure calibration. Reuse
          // the normal path's restrained aqueous absorption over the exact
          // same already-live support scalar; this is RGB-only and adds no
          // sample, topology, or field dependency at fifteen million pixels.
          // Keep the compact 8x body close to normal WebGL's deeper blue
          // transmission. This remains intentionally a little gentler: the
          // direct compositor has no broad-sheen or caustic terms to balance
          // a stronger core at high output scale.
          color *= vec3(1.0) - vec3(0.020, 0.0075, 0.000) * aqueousCoreVolume;
          float aqueousCoreGlaze = aqueousCoreVolume * (0.018 + keyLight * 0.030);
          color += (vec3(1.0) - clamp(color, 0.0, 1.0))
            * vec3(0.16, 0.52, 0.86) * aqueousCoreGlaze;
        }
        // Normal WebGL reflects the shared compact emission field from an
        // exposed liquid-air rim. Carry the same light into the direct 8x
        // compositor using only its already-live centre emission sample and
        // four liquid/material probes. A semantic empty side must also be
        // sparse in the liquid field, so dense reconstructed pinholes, unlike
        // seams, droplets, Lava, traits, and emissive liquid remain exact
        // no-ops. Defer RGB application until the existing contour wall guard
        // has proved this exact liquid cell is not backed by a native wall.
        if (uSurfaceContourLighting > 0.5 && liquidForeignContact < 0.5
          && density > 0.08 && density < 0.92 && emission.a > 0.002) {
          float liquidAirLeft = 1.0 - step(0.5, liquidMaterialLeft);
          float liquidAirRight = 1.0 - step(0.5, liquidMaterialRight);
          float liquidAirTop = 1.0 - step(0.5, liquidMaterialTop);
          float liquidAirBottom = 1.0 - step(0.5, liquidMaterialBottom);
          float validatedLiquidAir = max(
            max(liquidAirLeft * (1.0 - smoothstep(0.16, 0.66, liquidLeft.a)),
              liquidAirRight * (1.0 - smoothstep(0.16, 0.66, liquidRight.a))),
            max(liquidAirTop * (1.0 - smoothstep(0.16, 0.66, liquidTop.a)),
              liquidAirBottom * (1.0 - smoothstep(0.16, 0.66, liquidBottom.a)))
          );
          float emissionReach = smoothstep(0.002, 0.42, emission.a);
          liquidEmissionReflectionStrength = emissionReach * validatedLiquidAir * airFacingRim
            * (0.026 + keyLight * 0.058 + grazing * 0.036);
        }
      }
      // Normal WebGL's Surface control carries a distinct Fresnel-like
      // air-facing key/fill. Keep the compact direct form on the four samples
      // already live above, and defer its RGB-only application until the
      // existing packed native-wall state proves the cell wall-free.
      if (uSurfaceContourLighting > 0.5 && liquidForeignContact < 0.5) {
        // Water's shared volume deliberately softens at a real shore before
        // the tighter body-light threshold is reached. Surface lighting has a
        // distinct, still-connected lip gate: it needs multiple field
        // neighbours, rejects the dense exact core, and never uses it for
        // support or alpha. That lets aqueous surfaces read as continuous
        // without widening a droplet or a sparse strand.
        float liquidSurfaceConnected = smoothstep(1.5, 3.0, liquidSupportCount)
          * smoothstep(0.20, 0.78, liquid.a);
        float liquidSurfaceRim = (1.0 - smoothstep(0.38, 0.88, liquidNeighbourMean))
          * liquidSurfaceConnected;
        // Field RGB mixture intentionally falls away at a shore, so it is not
        // a reliable owner test for the Surface cue. The exact semantic
        // material already owns that decision above; reuse its local Hermite
        // silhouette for a bounded fallback contour while retaining the field
        // rim wherever it is available. One-cell droplets fail the support
        // gate and unlike material has already returned through foreign contact.
        vec2 liquidSemanticSlope = vec2(
          mix(q10 - q00, q11 - q01, blend.y),
          mix(q01 - q00, q11 - q10, blend.x)
        );
        float liquidSemanticSlopeLength = length(liquidSemanticSlope);
        float liquidSemanticContour = smoothstep(0.05, 0.31, semanticDensity)
          * (1.0 - smoothstep(0.57, 0.91, semanticDensity))
          * smoothstep(0.08, 0.72, liquidSemanticSlopeLength);
        float liquidSemanticSupport = smoothstep(1.5, 3.0, q00 + q10 + q01 + q11);
        float liquidContourShell = max(liquidSurfaceRim, liquidSemanticContour * liquidSemanticSupport)
          * (1.0 - liquidCore);
        liquidSurfaceContourKeyStrength = liquidContourShell
          * (0.024 + keyLight * 0.084 + grazing * 0.040);
        liquidSurfaceContourShadowStrength = liquidContourShell
          * (1.0 - keyLight) * 0.028;
      }
    }
    // Public unusual, metallic, cryogenic, and phase-product liquids need a visual grammar after their
    // shared body optics. Unlike species, molten/emissive liquid, reconstructed
    // Empty support, and all non-owner materials are exact no-ops.
    if (uLiquidIdentityStyling > 0.5 && !materialEmissive
      && liquidSpeciesDifference < 0.035
      && (material == 34.0 || material == 35.0 || material == 36.0 || material == 37.0 || material == 58.0 || material == 95.0
        || material == 38.0 || (material >= 54.0 && material <= 57.0)
        || (material >= 59.0 && material <= 62.0)
        || material == 100.0 || material == 102.0 || material == 104.0
        || material == 202.0 || material == 207.0)) {
      vec3 liquidIdentityDelta = material == 59.0 && traits < 0.5
        ? waxEightXIdentityDelta(1.0, grid, density, depth)
        : liquidIdentityEightXDelta(material, grid, density, depth, liquidSlope);
      color += liquidIdentityDelta * uLiquidIdentityStyling;
    }
    // The direct 8x aqueous body has more stacked key terms than normal WebGL.
    // Match the normal Water exposure only for a dense, same-species body
    // proven by the existing species-valid density support. Do not quantize
    // this calibration by the six-byte vertical-depth steps: that turns a
    // continuous Water core into horizontal colour bands at true 8x. Shores,
    // droplets, contacts, traits, emission, and every other liquid keep their
    // existing body/meniscus response.
    if (material == 2.0 && optics == 1.0 && traits < 0.5 && !materialEmissive
      && density > 0.72 && liquidSpeciesDifference < 0.035) {
      color *= 0.74;
    }
    // Oil's direct high-resolution path carries the same normal/body lights
    // but starts from an unattenuated amber palette. Match the normal composer's
    // dense-core exposure with one uniform species-safe multiplier; unlike the
    // Water correction above, its deliberately low microcontrast means this
    // cannot erase a mineral/facet cue. Shores, droplets, seams, traits, and
    // emission remain on their existing paths.
    if (material == 8.0 && optics == 2.0 && traits < 0.5 && !materialEmissive
      && density > 0.72 && liquidSpeciesDifference < 0.035) {
      color *= 0.50;
    }
  }
  // The shared suspension field is powder-authored, so use it only for
  // ordinary Smooth granular powder and exact aqueous liquid. This restores
  // the normal presenter's one wet-sediment body at true 8x without changing
  // semantic coverage, alpha, species ownership, or the dry-scene sampler
  // budget. The source is already resident on this direct mesh; the fetch is
  // deliberately inside the active, eligible branch.
  float powderWetMix = 0.0;
  if (uSuspensionActive > 0.5 && uPowderStyle > 1.5 && traits < 0.5
    && !materialEmissive
    && ((family == 4.0 && solidEightXGranular(optics))
      || (family == 2.0 && optics == 1.0))) {
    vec4 suspensionState = texture(uSuspensionTexture, uv);
    float suspensionPowder = family == 4.0
      ? 1.0 - smoothstep(0.08, 0.24, length(suspensionState.rgb - palette.rgb)) : 0.0;
    float suspensionLiquid = family == 2.0 && optics == 1.0 ? 1.0 : 0.0;
    // A dense wet body can alternate exact Sand and Water cells, leaving the
    // categorical semantic density near one half even though the existing
    // half-resolution suspension field has already proved one coherent
    // powder-in-aqueous volume. Let that field provide the second body proof:
    // sparse field wisps still fail its higher knee, while a settled mixture
    // converges to one albedo instead of retaining a cyan/ochre checkerboard.
    // This stays RGB-only; density, alpha, ownership, and fluid physics remain
    // in their earlier semantic/field paths.
    float suspensionSemanticBody = smoothstep(0.62, 0.90, density);
    float suspensionFieldBody = smoothstep(0.24, 0.68, suspensionState.a);
    float suspensionBody = max(suspensionSemanticBody, suspensionFieldBody);
    float lateSuspension = max(suspensionPowder, suspensionLiquid)
      * smoothstep(0.05, 0.62, suspensionState.a) * suspensionBody * 0.98;
    if (family == 4.0) powderWetMix = lateSuspension;
    if (lateSuspension > 0.001) {
      float sedimentCompaction = smoothstep(0.18, 0.82, suspensionState.a);
      vec3 wetSediment = mix(liquid.rgb, suspensionState.rgb,
        mix(0.44, 0.52, sedimentCompaction)) * mix(1.10, 1.06, sedimentCompaction);
      float currentLuma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      float wetLuma = dot(wetSediment, vec3(0.2126, 0.7152, 0.0722));
      float relief = clamp(currentLuma - wetLuma, -4.0 / 255.0, 4.0 / 255.0);
      color = mix(color, wetSediment + vec3(relief),
        lateSuspension * mix(0.96, 1.0, sedimentCompaction));
    }
  }
  // Solid and powder temperature is already encoded in semantic.g. Keep the
  // compact deep-zoom response semantically passive: traits, emissive owners,
  // liquid/gas/energy, coverage, support, and alpha remain outside this branch.
  if (uThermalMaterialStyling > 0.5 && !materialEmissive && traits < 0.5
    && material != 3.0 && (family == 0.0 || family == 4.0)) {
    float temperatureByte = floor(semantic.g * 255.0 + 0.5);
    if (abs(temperatureByte - 11.0) > 1.0) {
      color = clamp(color + thermalEightXDelta(temperatureByte, optics), 0.0, 1.0);
    }
  }
  // Restore the normal compositor's Field-profile material language before
  // later semantic-role and native-state overlays. The profile byte is already
  // resident in the sampled style word; this branch adds no fetch, field,
  // output-scale resource, or topology decision at true 8x.
  if (uFieldProfileIdentityStyling > 0.5
    && family == 0.0 && profile == 6.0 && optics < 0.5 && !materialEmissive) {
    color = clamp(color + fieldProfileEightXDelta(material, grid, density), 0.0, 1.0);
  }
  // A few exact TPT projections (notably WARP) have an intentionally near-black
  // canonical palette. Preserve that identity as visible material instead of
  // collapsing it into transparent-page black at true 8x. WARP's owner-local
  // violet floor matches the normal compositor while alpha/support remain
  // entirely field-owned.
  if (material == 114.0 && family == 1.0) color = max(color, vec3(0.115, 0.075, 0.155));
  else if (max(color.r, max(color.g, color.b)) < 0.035) color = vec3(16.0 / 255.0);
  bool sourceOwner = material == 124.0 || material == 126.0 || material == 127.0
    || material == 137.0 || material == 158.0 || material == 159.0;
  bool forceOwner = material == 115.0 || material == 116.0;
  bool radioactiveIdentityOwner = material == 99.0 || material == 105.0 || material == 108.0
    || material == 109.0 || material == 111.0 || material == 112.0 || material == 113.0;
  bool vibrOwner = material == 99.0 || material == 113.0;
  bool deutOwner = material == 100.0;
  bool lavaAncestryOwner = material == 11.0 && family == 2.0 && !materialEmissive;
  bool botanicalLifecycleOwner = material == 50.0 || material == 10.0;
  bool sparkOwner = material == 148.0;
  bool poloOwner = material == 109.0;
  bool spngOwner = material == 81.0;
  bool gelOwner = material == 56.0;
  bool filtOwner = material == 69.0;
  bool quartzCrystalOwner = material == 29.0 || material == 76.0;
  bool lcryOwner = material == 157.0;
  bool pipeOwner = material == 121.0 || material == 160.0;
  bool storOwner = material == 163.0;
  bool swchOwner = material == 149.0;
  bool dlayOwner = material == 154.0;
  bool wifiOwner = material == 152.0;
  // Most 8x fragments have no retained native state. Decode the B/A state and
  // co-located native wall exactly once only for owners whose enabled RGB
  // styling consumes it; this avoids two state-texture samples on every other
  // occupied fragment without changing state ownership, support, or alpha.
  bool needsPackedState = (uSourceTargetStyling > 0.5 && sourceOwner)
    || (uForceActivityStyling > 0.5 && forceOwner)
    || (uVibrStateStyling > 0.5 && vibrOwner)
    || (uDeutStateStyling > 0.5 && deutOwner)
    || (uLavaAncestryStyling > 0.5 && lavaAncestryOwner)
    || (uBotanicalLifecycleStyling > 0.5 && botanicalLifecycleOwner)
    || (uSparkStateStyling > 0.5 && sparkOwner)
    || (uPoloStateStyling > 0.5 && poloOwner)
    || (uSpngStateStyling > 0.5 && spngOwner)
    || (uGelHydrationStyling > 0.5 && gelOwner)
    || (uFiltSpectrumStyling > 0.5 && filtOwner)
    || (uQuartzCrystalStateStyling > 0.5 && quartzCrystalOwner)
    || (uLcryStateStyling > 0.5 && lcryOwner)
    || (uPipePresentationStyling > 0.5 && pipeOwner)
    || (uStorStateStyling > 0.5 && storOwner)
    || (uSwchStateStyling > 0.5 && swchOwner)
    || (uDlayStateStyling > 0.5 && dlayOwner)
    || (uWifiStateStyling > 0.5 && wifiOwner)
    // Deep mesostrata normally needs no wall read. In a wall-bearing scene,
    // reuse this packed-state path only for its four exact qualified powder
    // owners so co-located native walls remain an exact visual no-op.
    || (uNativeWallsActive > 0.5 && uPowderMesostrataStyling > 0.5
      && family == 4.0 && uPowderStyle > 1.5 && traits < 0.5 && !materialEmissive
      && (material == 1.0 || material == 21.0 || material == 26.0 || material == 28.0))
    // Eligible translucent liquid already needs this exact wall texel for the
    // final backdrop. Fold the cohesion guard into that one packed-state read
    // so true 8x does not grow another native-wall sample.
    || nativeWallForLiquidCohesion || nativeWallForLiquidSurfaceContour;
  float sourceTarget = 0.0;
  float nativeWall = 0.0;
  if (needsPackedState) {
    vec4 packedState = texture(uWallTexture, uv);
    sourceTarget = floor(packedState.b * 255.0 + 0.5)
      + floor(packedState.a * 255.0 + 0.5) * 256.0;
    nativeWall = floor(packedState.r * 255.0 + 0.5);
  }
  // Apply dry mineral compaction after the retained packed-wall state has
  // resolved a possible co-located native wall. This preserves the original
  // strict four-owner/depth proof while keeping wall controls out of the
  // material grammar without a second sampler or a new 8x resource class.
  if (family == 4.0 && uPowderMesostrataStyling > 0.5 && uPowderStyle > 1.5
    && traits < 0.5 && !materialEmissive && nativeWall < 0.5
    && powderWetMix <= 0.001 && (material == 1.0 || material == 21.0 || material == 26.0 || material == 28.0)) {
    float mesostrataCore = depth * q00 * q10 * q01 * q11
      * smoothstep(0.72, 0.95, semanticDensity);
    float mesostrataSlope = clamp(
      powderFieldSlope.x * -2.20 + powderFieldSlope.y * -3.20, -1.0, 1.0
    );
    float mesostrataSlopeWeight = clamp(length(powderFieldSlope) * 2.4, 0.0, 1.0);
    float mesostrataStrength = mesostrataCore
      * (0.72 + mesostrataCore * 0.28) * (0.72 + mesostrataSlopeWeight * 0.28);
    color = clamp(color + settledPowderMesostrataEightXDelta(
      material, grid, mesostrataSlope
    ) * mesostrataStrength, 0.0, 1.0);
  }
  if ((liquidSurfaceContourKeyStrength > 0.0001 || liquidSurfaceContourShadowStrength > 0.0001)
    && (uNativeWallsActive < 0.5 || nativeWall < 0.5)) {
    vec3 liquidContourKey = liquidEightXMeniscusKey(optics);
    vec3 liquidContourShadow = liquidEightXMeniscusShadow(optics);
    color += (vec3(1.0) - clamp(color, 0.0, 1.0))
      * liquidContourKey * liquidSurfaceContourKeyStrength;
    color -= liquidContourShadow * liquidSurfaceContourShadowStrength;
  }
  if (liquidEmissionReflectionStrength > 0.0001
    && (uNativeWallsActive < 0.5 || nativeWall < 0.5)) {
    color += (vec3(1.0) - clamp(color, 0.0, 1.0))
      * emission.rgb * liquidEmissionReflectionStrength;
  }
  // Static semantic-role accents preserve the normal compositor's source,
  // sink, channel, and force vocabulary at true 8x. Stateful target/activity
  // overlays below remain authoritative and are deliberately layered on top.
  // LIGH/THDR reuse this one already-compiled call site rather than adding a
  // second identity helper to the register-constrained 15M-fragment shader:
  // a synthetic Channel trait supplies LIGH's cool rail/node, while Emitter
  // supplies THDR's warm fork/ring. The energy switch remains independent of
  // ordinary role styling, and the exact-owner branch changes RGB only.
  if ((uRoleMaterialStyling > 0.5 && traits > 0.5 && !materialEmissive)
    || (uEnergyIdentityStyling > 0.5 && (material == 93.0 || material == 97.0))) {
    color = clamp(color + roleEightXDelta(
      uEnergyIdentityStyling > 0.5 && material == 93.0 ? 4.0
        : (uEnergyIdentityStyling > 0.5 && material == 97.0 ? 1.0 : traits),
      uv * uFieldSize, density
    ), 0.0, 1.0);
  }
  if (uSourceTargetStyling > 0.5 && sourceOwner
    && ((sourceTarget >= 1.0 && sourceTarget <= 170.0) || sourceTarget == 217.0)) {
    vec2 badgeCell = mod(floor(uv * uFieldSize), 6.0);
    float badge = 1.0 - step(0.5, mod(badgeCell.x * 3.0 + badgeCell.y * 5.0 + sourceTarget, 7.0));
    vec3 targetKey = vec3(mod(sourceTarget, 6.0) / 6.0, mod(sourceTarget, 11.0) / 11.0, mod(sourceTarget, 17.0) / 17.0);
    color += (vec3(0.05) + targetKey * 0.12) * (0.35 + badge * 0.65);
  }
  // ACEL/DCEL retain their native active bit in this same B/A word. Mirror the
  // normal presenter's 16-cell chevron/ring language without a new sample,
  // pass, support decision, or alpha change on the compact true-8x path.
  if (uForceActivityStyling > 0.5 && forceOwner
    && mod(floor(sourceTarget), 2.0) >= 0.5) {
    vec2 forceLocal = mod(floor(uv * uFieldSize), 16.0);
    if (material == 115.0) {
      float centredY = abs(forceLocal.y - 8.0);
      float chevronDistance = abs(forceLocal.x - 5.0 - centredY);
      bool leadingChevron = forceLocal.x >= 5.0 && forceLocal.x <= 13.0
        && chevronDistance <= 1.0;
      bool wake = forceLocal.x >= 1.0 && forceLocal.x < 6.0
        && forceLocal.y >= 7.0 && forceLocal.y <= 9.0;
      color += leadingChevron ? vec3(16.0, 11.0, -4.0) / 255.0
        : wake ? vec3(8.0, 5.0, -2.0) / 255.0 : vec3(0.0);
    } else {
      vec2 forceCentred = forceLocal - 8.0;
      float forceRadiusSquared = dot(forceCentred, forceCentred);
      color += forceRadiusSquared >= 25.0 && forceRadiusSquared <= 49.0
        ? vec3(3.0, 10.0, 16.0) / 255.0
        : forceRadiusSquared <= 4.0 ? vec3(-8.0, -5.0, 3.0) / 255.0 : vec3(0.0);
    }
  }
  // The direct mesh skips normal-WebGL's general radioactive branch at 8x.
  // Restore only the established static exact-owner body identities here;
  // stateful POLO/VIBR overlays stay below this block and continue to own their
  // native lifecycle information.
  if (uEnergyIdentityStyling > 0.5 && radioactiveIdentityOwner) {
    color += radioactiveBodyIdentityEightXDelta(material, uv * uFieldSize);
  }
  if (uVibrStateStyling > 0.5 && vibrOwner
    && sourceTarget > 0.5) {
    float charge = min(mod(sourceTarget, 128.0), 100.0) / 100.0;
    float countdown = mod(floor(sourceTarget / 128.0), 256.0) / 255.0;
    float alternate = step(0.5, floor(sourceTarget / 32768.0));
    vec2 lattice = mod(floor(uv * uFieldSize), 8.0);
    float conductor = max(1.0 - step(0.5, abs(lattice.y)),
      1.0 - step(0.5, abs(lattice.x)));
    vec3 charged = mix(vec3(-3.0, 12.0, 13.0), vec3(2.0, 7.0, 17.0), alternate)
      * charge * (0.28 + conductor * 0.72);
    vec3 burst = mix(vec3(18.0, 20.0, 13.0), vec3(8.0, 15.0, 22.0), alternate) * countdown;
    color += (charged + burst) / 255.0;
  }
  if (uDeutStateStyling > 0.5 && deutOwner && sourceTarget > 0.5 && nativeWall < 0.5) {
    float ordinary = min(1.0, sourceTarget / 240.0);
    float compressed = max(0.0, (sourceTarget - 240.0) / 5760.0);
    // Native DEUT's ordinary ctype range reaches the reaction threshold at
    // 240. Keep its gradual fill below that point, then give the first
    // reacting state a bounded, visible ignition lift before compression
    // consumes the remaining highlight range.
    float ignition = step(240.0, sourceTarget);
    float concentration = ordinary * 0.45 + ignition * 0.25
      + sqrt(min(1.0, compressed)) * 0.30;
    color += concentration * vec3(10.0, 19.0, 28.0) / 255.0;
  }
  // Native Lava ancestry is visible only on its exact liquid owner. The shared
  // packed read above also exposes a co-located wall, which must remain an
  // independent backdrop rather than turning Lava ctype into a wall effect.
  if (uLavaAncestryStyling > 0.5 && lavaAncestryOwner && nativeWall < 0.5) {
    color += lavaAncestryEightXDelta(sourceTarget, uv * uFieldSize);
  }
  if (uSparkStateStyling > 0.5 && sparkOwner) {
    color += sparkStateEightXDelta(sourceTarget, uv * uFieldSize, color);
  }
  if (uPoloStateStyling > 0.5 && poloOwner) {
    color += poloStateEightXDelta(sourceTarget, uv * uFieldSize);
  }
  if ((uSpngStateStyling > 0.5 && spngOwner)
    || (uGelHydrationStyling > 0.5 && gelOwner)) {
    color += hydrationStateEightXDelta(material, sourceTarget, uv * uFieldSize);
  }
  if (uFiltSpectrumStyling > 0.5 && filtOwner && nativeWall < 0.5) {
    color += filtSpectrumEightXDelta(
      color, sourceTarget, semantic.g
    );
  }
  if (uQuartzCrystalStateStyling > 0.5 && quartzCrystalOwner && nativeWall < 0.5) {
    color += quartzCrystalStateEightXDelta(material, sourceTarget);
  }
  if (uLcryStateStyling > 0.5 && lcryOwner && nativeWall < 0.5) {
    color += lcryStateEightXDelta(color, sourceTarget);
  }
  if (uPipePresentationStyling > 0.5 && pipeOwner && nativeWall < 0.5) {
    color += pipePresentationEightXDelta(color, material, sourceTarget);
  }
  if (uStorStateStyling > 0.5 && storOwner && nativeWall < 0.5) {
    color += storStateEightXDelta(color, sourceTarget);
  }
  if (uSwchStateStyling > 0.5 && swchOwner && nativeWall < 0.5) {
    color += swchStateEightXDelta(color, sourceTarget);
  }
  if (uDlayStateStyling > 0.5 && dlayOwner && nativeWall < 0.5) {
    color += dlayCountdownEightXDelta(color, sourceTarget, semantic.g);
  }
  if (uWifiStateStyling > 0.5 && wifiOwner && nativeWall < 0.5) {
    color += wifiStateEightXDelta(color, sourceTarget);
  }
  // True 8x keeps botanical state on the existing packed B/A word. This is
  // RGB-only compact arithmetic: no additional texture, field, pass, or
  // topology decision is introduced on the 15M-fragment path.
  if (uBotanicalIdentityStyling > 0.5 || uBotanicalLifecycleStyling > 0.5) {
    vec2 botanicalCell = floor(uv * uFieldSize);
    if (uBotanicalIdentityStyling > 0.5) {
      if (material == 9.0) {
        float ring = mod(botanicalCell.x + floor(botanicalCell.y / 3.0) + material, 11.0) < 2.0
          ? -7.0 : 2.0;
        float axial = mod(botanicalCell.x + floor(botanicalCell.y / 7.0) + material, 9.0) < 2.0
          ? 1.0 : 0.0;
        color += vec3(ring + axial * 3.0, ring * 0.48 + axial * 1.5,
          ring * 0.22 - axial * 1.5) / 255.0;
      } else if (material == 10.0) {
        float leaf = mod(botanicalCell.x * 5.0 + botanicalCell.y * 3.0 + material, 8.0) / 7.0;
        float vein = mod(botanicalCell.x * 2.0 + botanicalCell.y
          + mod(botanicalCell.y * 5.0 + 3.0, 8.0), 13.0) < 3.0 ? 1.0 : 0.0;
        float canopyFacet = 1.0 - abs(fract((botanicalCell.x * 3.0
          - botanicalCell.y * 2.0 + material) / 19.0) * 2.0 - 1.0);
        float canopyCross = 1.0 - abs(fract((botanicalCell.x
          + botanicalCell.y * 4.0 + material) / 23.0) * 2.0 - 1.0);
        float canopyCrown = smoothstep(0.69, 0.94, canopyFacet)
          * (0.45 + canopyCross * 0.55);
        float canopyPocket = 1.0 - smoothstep(0.18, 0.48, canopyFacet);
        color += (vec3(leaf * 1.5 - vein * 3.0, leaf * 3.5 + vein * 6.0,
          leaf - vein * 2.5)
          + canopyCrown * vec3(1.5, 4.5, 1.0)
          - canopyPocket * vec3(1.7, 2.1, 0.8)) / 255.0;
      } else if (material == 83.0) {
        float strand = mod(botanicalCell.x + floor(botanicalCell.y / 4.0) + material, 7.0) < 2.0
          ? 1.0 : 0.0;
        float node = mod(botanicalCell.x * 3.0 + botanicalCell.y * 5.0 + material, 16.0) < 2.0
          ? 1.0 : 0.0;
        color += (vec3(mix(1.0, -3.0, strand), mix(-1.0, 7.0, strand),
          mix(0.0, -2.0, strand)) + node * vec3(2.0, 4.0, 1.0)) / 255.0;
      } else if (material == 50.0 || material == 52.0) {
        vec2 local = mod(botanicalCell, 8.0) - 4.0;
        float radiusSquared = dot(local, local);
        if (material == 50.0) {
          float husk = radiusSquared >= 5.0 && radiusSquared <= 13.0 ? 1.0 : 0.0;
          float embryo = local.x >= 0.0 && local.x <= 2.0
            && local.y >= -1.0 && local.y <= 1.0 ? 1.0 : 0.0;
          color += (mix(vec3(-2.0, -1.0, 1.0), vec3(5.0, 2.0, -3.0), husk)
            + embryo * vec3(2.0, 5.0, 1.0)) / 255.0;
        } else {
          float cellRim = radiusSquared >= 5.0 && radiusSquared <= 13.0 ? 1.0 : 0.0;
          vec2 budOffset = local - vec2(1.0, -1.0);
          float bud = dot(budOffset, budOffset) <= 2.0 ? 1.0 : 0.0;
          color += (mix(vec3(-1.0, -0.5, -1.5), vec3(3.0, 2.0, 1.0), cellRim)
            + bud * vec3(3.0, 4.0, 2.0)) / 255.0;
        }
      }
    }
    if (uBotanicalLifecycleStyling > 0.5) {
      if (material == 50.0 && sourceTarget > 0.5) {
        float water = mod(sourceTarget, 256.0);
        float timer = mod(floor(sourceTarget / 256.0), 256.0);
        float moisture = water / 255.0;
        float germination = min(timer, 200.0) / 200.0;
        float swelling = min(1.0, water / 4.0);
        vec2 local = mod(botanicalCell, 11.0) - 5.0;
        float radiusSquared = dot(local, local);
        float swollenHusk = radiusSquared >= 12.0 && radiusSquared <= 25.0 ? 1.0 : 0.0;
        float openingSeam = local.x == 0.0 && local.y >= -3.0 && local.y <= 3.0 ? 1.0 : 0.0;
        float rootTip = local.x >= -1.0 && local.x <= 1.0
          && local.y >= 2.0 && local.y <= 4.0 ? 1.0 : 0.0;
        vec3 lifecycle = vec3(-12.0, -9.0, 5.0) * moisture
          + swollenHusk * vec3(4.0, 7.0, 6.0) * swelling
          + openingSeam * vec3(5.0, 16.0, 3.0) * germination
          + rootTip * vec3(-2.0, 7.0, 5.0) * germination;
        color += clamp(lifecycle, vec3(-24.0), vec3(24.0)) / 255.0;
      } else if (material == 10.0 && sourceTarget >= 32768.0
        && mod(sourceTarget, 2.0) >= 0.5) {
        float phase = mod(floor(sourceTarget / 2.0), 4.0);
        float direction = mod(floor(sourceTarget / 8.0), 8.0);
        float inheritedColour = mod(floor(sourceTarget / 64.0), 64.0);
        float hydration = mod(floor(sourceTarget / 4096.0), 4.0) / 3.0;
        float active = mod(floor(sourceTarget / 16384.0), 2.0);
        float cyan = mod(floor(inheritedColour / 16.0), 4.0) > 0.0 ? 1.0 : 0.0;
        float magenta = mod(floor(inheritedColour / 4.0), 4.0) > 0.0 ? 1.0 : 0.0;
        float yellow = mod(inheritedColour, 4.0) > 0.0 ? 1.0 : 0.0;
        float paletteIndex = cyan * 4.0 + magenta * 2.0 + yellow;
        vec3 leafColor = paletteIndex == 0.0 ? vec3(243.0, 246.0, 244.0)
          : paletteIndex == 1.0 ? vec3(255.0, 223.0, 50.0)
          : paletteIndex == 2.0 ? vec3(255.0, 183.0, 197.0)
          : paletteIndex == 3.0 ? vec3(250.0, 0.0, 25.0)
          : paletteIndex == 4.0 ? vec3(128.0, 206.0, 196.0)
          : paletteIndex == 5.0 ? vec3(127.0, 255.0, 0.0)
          : paletteIndex == 6.0 ? vec3(0.0, 74.0, 178.0)
          : vec3(12.0, 172.0, 0.0);
        float vein = mod(botanicalCell.x * (direction + 1.0)
          + botanicalCell.y * (8.0 - direction) + phase * 3.0, 13.0) <= 1.0 ? 1.0 : 0.0;
        float growthTip = active > 0.5 && mod(botanicalCell.x * (8.0 - direction)
          - botanicalCell.y * (direction + 1.0) + phase * 5.0, 17.0) <= 1.0 ? 1.0 : 0.0;
        vec3 variation = vec3(-2.0, -1.0, 4.0) * hydration
          + vein * vec3(-4.0, 7.0, -3.0) + growthTip * vec3(7.0, 11.0, 4.0);
        color += clamp((leafColor / 255.0 - color) * 0.42 + variation / 255.0,
          vec3(-64.0 / 255.0), vec3(64.0 / 255.0));
      }
    }
  }
  // The settled powder field has already supplied the curved outer volume.
  // Keep its conservative original endpoint transfer: the stronger RGB-only
  // surface key above now owns visual separation without shrinking support.
  if (family == 4.0 && uPowderStyle > 1.5 && powderFieldBlend > 0.001) {
    density = smoothstep(0.04, 0.96, density);
  }
  float alpha = family == 1.0 ? smoothstep(0.006, 0.26, density) * 0.48
    : (family == 3.0 ? smoothstep(0.18, 0.82, density) : density);
  if (family == 0.0 && optics == 12.0) {
    float translucentDepth = smoothstep(0.34, 0.94, density);
    float translucentAlpha = (material == 12.0 || material == 24.0)
      ? mix(0.62, 0.76, translucentDepth) : mix(0.74, 0.88, translucentDepth);
    alpha *= translucentAlpha;
  }
  if (material == 114.0) { color = vec3(16.0 / 255.0); alpha = 1.0; }
  // Native walls are independent from particle occupancy. When a wall plane
  // is active, the nativeWall scalar was hydrated above for every cohesion candidate;
  // suppress the alpha-only trim at the exact co-located wall cell. Wall-free
  // scenes retain the sampler-free path, and every eligible scale is <= 1.
  if ((uNativeWallsActive < 0.5 || nativeWall < 0.5) && liquidCohesionAlphaScale < 0.999) {
    alpha *= liquidCohesionAlphaScale;
  }
  alpha = clamp(alpha, 0.0, 1.0);
  vec4 foreground = vec4(clamp(color, 0.0, 1.0) * alpha, alpha);
  // Opaque matter has no remaining backdrop contribution and does not spend a
  // wall sample. Every translucent semantic particle keeps the separate native
  // wall visible below it, matching the normal compositor without a new pass.
  if (uNativeWallsActive > 0.5 && alpha < 0.999) {
    if (!needsPackedState) nativeWall = floor(texture(uWallTexture, uv).r * 255.0 + 0.5);
    // Reuse the four exact-owner occupancy values already live for body/edge
    // styling. This changes only the analytic native-wall pattern behind an
    // exact Glass/Ice particle; alpha, wall ID, support, and semantics remain
    // owned by their existing paths.
    float exactRefractor = material == 12.0 || material == 24.0 ? 1.0 : 0.0;
    float refractedMaterial = uTranslucentBackdropRefraction * exactRefractor
      * (family == 0.0 ? 1.0 : 0.0) * (optics == 12.0 ? 1.0 : 0.0)
      * (materialEmissive ? 0.0 : 1.0) * (traits < 0.5 ? 1.0 : 0.0)
      * step(0.20, density) * step(0.5, nativeWall) * material;
    vec2 refractedBoundarySlope = vec2(
      (q10 + q11) - (q00 + q01), (q01 + q11) - (q00 + q10)
    ) * 0.50;
    foreground = compositeEightXWallBackdrop(
      foreground, nativeWall, uv * uFieldSize, refractedMaterial, refractedBoundarySlope
    );
  }
  // Native PHOT lives in an independent plane and may coexist with any pmap
  // owner. Keep its existing nearest texture fetch dormant for photon-free
  // scenes, then tint only premultiplied RGB after matter/wall composition.
  // It never claims support, changes alpha, or treats the spectrum as a
  // particle/material owner on the compact true-8x path.
  if (uPhotonActive > 0.5) {
    vec4 photonState = texture(uPhotonStateTexture, uv);
    float photonLow = floor(photonState.r * 255.0 + 0.5);
    float photonHigh = floor(photonState.g * 255.0 + 0.5);
    if (photonHigh >= 128.0) {
      vec3 photonSpectrum = vec3(
        mod(photonLow, 16.0),
        mod(floor(photonLow / 16.0), 16.0),
        mod(photonHigh, 16.0)
      ) * (16.0 / 255.0);
      float photonPeak = max(photonSpectrum.r, max(photonSpectrum.g, photonSpectrum.b));
      float photonAmount = 0.44 + min(0.18, photonPeak * 0.24);
      foreground.rgb = mix(foreground.rgb, photonSpectrum * foreground.a, photonAmount);
    }
  }
  finalColor = foreground;
}
`;

const FIELD_FRAGMENT = `
in vec2 vFieldCoord;
out vec4 finalColor;
uniform sampler2D uFieldTexture;
uniform sampler2D uWallTexture;
uniform sampler2D uPhotonStateTexture;
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
uniform float uHDRVfx;
uniform float uVolumeVfx;
uniform float uGasBodyVfx;
uniform float uLiquidBodyVfx;
uniform float uPowderBodyVfx;
uniform float uPowderLightVfx;
uniform float uHighQuality;
uniform float uAnalyticLightingQuality;
uniform float uGasFieldLighting;
uniform float uGasVolumeChroma;
uniform float uGasIdentityStyling;
uniform float uEmissionVolumeChroma;
uniform float uLiquidFieldLighting;
uniform float uAqueousSurfaceReflection;
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
uniform float uDenseBodyAmbientFill;
uniform float uRoleMaterialStyling;
uniform float uCellularMaterialStyling;
uniform float uStructuralRigidStyling;
uniform float uGeologicalSolidStyling;
uniform float uThermalCatalyticRigidStyling;
uniform float uGooSolidStyling;
uniform float uFrayForceStyling;
uniform float uGbmbForceStyling;
uniform float uMechanismBodyStyling;
uniform float uElectronicIdentityStyling;
uniform float uFieldProfileIdentityStyling;
uniform float uEarthenPowderStyling;
uniform float uPowderMesostrataStyling;
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
uniform float uForceActivityStyling;
uniform float uPoloStateStyling;
uniform float uSpngStateStyling;
uniform float uGelHydrationStyling;
uniform float uFiltSpectrumStyling;
uniform float uQuartzCrystalStateStyling;
uniform float uLcryStateStyling;
uniform float uPipePresentationStyling;
uniform float uStorStateStyling;
uniform float uSwchStateStyling;
uniform float uDlayStateStyling;
uniform float uWifiStateStyling;
uniform float uLavaAncestryStyling;
uniform float uMoltenBodyOptics;
uniform float uBotanicalIdentityStyling;
uniform float uBotanicalLifecycleStyling;
uniform float uSparkStateStyling;
uniform float uPhotonActive;
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
    * (1.0 - smoothstep(0.18, 0.58, density)) * 0.018;
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
vec3 gasIdentityBodyDelta(float style, float density);
vec3 gasIdentityVolumeDelta(
  float style, float owner, vec2 worldPosition, float density, float directionalRelief, float curvature
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
  // Once the shared atmosphere proves a dense body, it owns the volume's
  // mixture and silhouette. Keep the exact motif strong on sparse carriers,
  // but fade its cell-scale contrast in a billow so it cannot read as a sheet
  // of particles. Body depth and the public chroma path retain species cues.
  float volumeOwnership = smoothstep(0.12, 0.48, density);
  float denseMotifScale = mix(0.30, 0.045, volumeOwnership);
  // The generic O₂ volume-chroma control has a protected blue-forward-scatter
  // probe that intentionally reads this exact material's legacy motif. Its
  // propagated field also owns reconstructed empty support, so retain O₂ by
  // either semantic owner or propagated style while every other dense gas is
  // field-owned.
  float oxygenLegacyVolume = smoothstep(0.004, 0.52, density);
  float oxygenLegacy = max(
    owner == 39.0 ? 1.0 : 0.0,
    (style > 3.5 && style < 4.5) ? 1.0 : 0.0
  );
  float motifScale = oxygenLegacy > 0.5 ? 0.34 + oxygenLegacyVolume * 0.66 : denseMotifScale;
  float fieldRelief = clamp(directionalRelief * 7.0 + curvature * 9.0, -3.0, 3.0);
  // Canvas gives each exact gas species a small dense-body absorption or tint
  // after the shared atmosphere reconstruction. Keep the same semantic
  // distinction here without changing the field-owned silhouette: this is one
  // RGB-only arithmetic term in the already-enabled identity branch, not a
  // field, sampler, pass, allocation, or time-varying topology signal.
  vec3 bodyDepth = gasIdentityBodyDelta(style, density);
  return clamp((motif * motifScale + vec3(fieldRelief) + bodyDepth) / 255.0,
    vec3(-12.0 / 255.0), vec3(12.0 / 255.0));
}
vec3 gasIdentityBodyDelta(float style, float density) {
  // Do not make sparse semantic accents read as dense fog. The existing motif
  // remains visible at low support; this begins once the shared atmosphere has
  // accumulated enough mass to read as a coherent volume.
  float support = smoothstep(0.10, 0.70, density);
  if (style < 1.5) return vec3(-4.0, -4.0, -3.0) * support; // Smoke
  if (style < 2.5) return vec3(1.0, 2.0, 3.0) * support; // Steam
  if (style < 3.5) return vec3(3.0, 2.0, -1.0) * support; // Gas
  if (style < 4.5) return vec3(0.0, 2.0, 3.0) * support; // Oxygen
  if (style < 5.5) return vec3(1.0, 1.0, 3.0) * support; // Hydrogen
  if (style < 6.5) return vec3(-3.0, -2.0, -1.0) * support; // CO2
  if (style < 7.5) return vec3(2.0, 1.0, 3.0) * support; // Noble gas
  if (style < 8.5) return vec3(3.0, 0.0, -2.0) * support; // BOYL
  if (style < 9.5) return vec3(-1.0, 3.0, -1.0) * support; // CAUS
  if (style < 10.5) return vec3(2.0) * support; // FOG
  if (style < 11.5) return vec3(-1.0, 2.0, 4.0) * support; // RFRG
  if (style < 12.5) return vec3(-1.0, 1.0, 4.0) * support; // CFLM
  if (style < 13.5) return vec3(-4.0, -2.0, -4.0) * support; // AMTR
  if (style < 14.5) return vec3(2.0, -2.0, 3.0) * support; // WARP
  if (style < 15.5) return vec3(3.0, -2.0, 3.0) * support; // BIZRG
  if (style < 16.5) return vec3(-2.0) * support; // MORT
  return vec3(3.0, -2.0, 3.0) * support; // VRSG
}
vec3 gasIdentityVolumeChroma(float style, float response) {
  // The shared atmosphere may contain a cool neighbouring gas at a Noble Gas
  // billow edge. Its propagated identity remains exact, so retain a small
  // violet key/fill there instead of letting a negative generic light response
  // invert the species into green. The magnitude is still derived from the
  // existing bounded chroma response, while its public species bias remains
  // stable on either side of the billow. This is RGB-only and active only under
  // the public volume-chroma switch at the call site.
  if (style > 6.5 && style < 7.5) {
    // Retain a clear violet key/fill only once the existing bounded response
    // is perceptible. Taking its magnitude keeps the public species cue stable
    // on the two sides of a signed light response. This reshapes the previous
    // bias toward blue (rather than raising its maximum): every source channel
    // remains below the former 0.060 bound before the cloud composite.
    float violetStrength = smoothstep(0.005, 0.030, abs(response));
    return vec3(0.045, -0.052, 0.052) * violetStrength;
  }
  return vec3(0.0);
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
vec3 liquidVolumeShadow(float optics) {
  if (optics == 1.0) return vec3(1.00, 0.62, 0.36);
  if (optics == 2.0) return vec3(0.40, 0.68, 1.00);
  if (optics == 3.0) return vec3(0.72, 0.38, 0.62);
  if (optics == 16.0) return vec3(1.00, 0.55, 0.28);
  if (optics == 17.0) return vec3(0.58, 0.62, 0.70);
  if (optics == 18.0) return vec3(0.70, 0.64, 0.58);
  return vec3(0.72, 0.68, 0.58);
}
vec3 applyLiquidVolumeChroma(vec3 color, float response, float optics) {
  vec3 key = vec3(0.72, 0.84, 1.00);
  vec3 shadow = liquidVolumeShadow(optics);
  if (optics == 1.0) {
    key = vec3(0.52, 0.88, 1.00);
  } else if (optics == 2.0) {
    key = vec3(1.00, 0.72, 0.28);
  } else if (optics == 3.0) {
    key = vec3(0.44, 1.00, 0.68);
  } else if (optics == 16.0) {
    key = vec3(0.62, 0.90, 1.00);
  } else if (optics == 17.0) {
    key = vec3(1.00, 0.98, 0.94);
  } else if (optics == 18.0) {
    key = vec3(0.82, 0.92, 1.00);
  }
  if (response > 0.0) {
    color += (vec3(1.0) - color) * key * response * 0.90;
  } else {
    color *= vec3(1.0) - shadow * (-response) * 0.85;
  }
  return color;
}
vec3 applyLiquidOpticalDepth(vec3 color, float optics, float columnDepth) {
  vec3 shadow = liquidVolumeShadow(optics);
  // WebGL's existing macro chroma is stronger than Canvas at some broad
  // shoulders, so Water/Oil need calibrated column absorption for composed
  // surface-to-core parity rather than numeric helper parity.
  // Water's shallow column keeps the calibrated surface gain, while a proven
  // deep connected core gains a restrained extra teal/red absorption. The
  // phase-local depth byte has already rejected droplets, seams, walls, and
  // reconstructed support at the call site; this is RGB-only arithmetic.
  float columnGain = optics == 1.0
    ? 0.14 + 0.025 * smoothstep(0.42, 0.86, columnDepth)
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
  if (material == 36.0 || material == 95.0) {
    // MERC/LRBD: broad rolling reflection and a neutral occlusion pocket.
    float mirrorSaw = fract(
      worldPosition.x * 0.034 + worldPosition.y * 0.009 + material * 0.017
    ) * 2.0 - 1.0;
    float mirror = 1.0 - abs(mirrorSaw);
    float shoulder = smoothstep(0.62, 0.92, mirror);
    float pocket = 1.0 - smoothstep(0.20, 0.50, mirror);
    float slopeKey = clamp(0.50 - slope.x * 0.24 - slope.y * 0.31, 0.0, 1.0);
    vec3 key = material == 36.0 ? vec3(0.040, 0.050, 0.062) : vec3(0.026, 0.037, 0.056);
    vec3 shadow = material == 36.0 ? vec3(0.031, 0.032, 0.037) : vec3(0.040, 0.034, 0.033);
    identity = key * shoulder * (0.55 + slopeKey * 0.45) - shadow * pocket;
  } else if (material == 37.0 || material == 58.0) {
    // LN2/LO2: cold stratified ripples hold a pale frost shoulder over depth.
    float rippleSaw = fract(
      worldPosition.x * 0.053 - worldPosition.y * 0.021 + material * 0.031
    ) * 2.0 - 1.0;
    float ripple = 1.0 - abs(rippleSaw);
    float frost = smoothstep(0.64, 0.92, ripple);
    float trough = 1.0 - smoothstep(0.22, 0.52, ripple);
    float slopeKey = clamp(0.50 - slope.x * 0.18 - slope.y * 0.34, 0.0, 1.0);
    vec3 key = material == 37.0 ? vec3(0.006, 0.042, 0.064) : vec3(0.003, 0.029, 0.065);
    vec3 shadow = material == 37.0 ? vec3(0.015, 0.008, 0.006) : vec3(0.017, 0.010, 0.004);
    identity = key * frost * (0.52 + slopeKey * 0.48) - shadow * trough;
  } else if (material == 34.0) {
    // DSTW: quiet clean-water threads distinguish it from ordinary aqueous water.
    float thread = 1.0 - abs(fract(
      worldPosition.x * 0.09375 + worldPosition.y * 0.0625
    ) * 2.0 - 1.0);
    float crest = smoothstep(0.72, 0.94, thread);
    float trough = 1.0 - smoothstep(0.22, 0.50, thread);
    identity = crest * vec3(0.004, 0.020, 0.036) - trough * vec3(0.008, 0.003, 0.002);
  } else if (material == 35.0) {
    // DESL: heavier warm hydrocarbon ribbons, separate from Oil's shared volume.
    float ribbon = 1.0 - abs(fract(
      worldPosition.x * 0.0625 - worldPosition.y * 0.09375
    ) * 2.0 - 1.0);
    float crest = smoothstep(0.68, 0.92, ribbon);
    float pocket = 1.0 - smoothstep(0.24, 0.54, ribbon);
    identity = crest * vec3(0.040, 0.016, -0.010) - pocket * vec3(0.034, 0.022, 0.012);
  } else if (material == 38.0) {
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
vec3 botanicalIdentityDelta(float material, vec2 position, float plantFineGain) {
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
    // A second, much broader world-anchored motif stops a connected PLNT
    // canopy reading as a uniform green tile. It is deliberately independent
    // of lifecycle state and neighbour data: native growth/topology stays
    // authoritative while dense canopies gain only bounded RGB depth.
    float canopyFacet = 1.0 - abs(fract((x * 3.0 - y * 2.0 + material) / 19.0) * 2.0 - 1.0);
    float canopyCross = 1.0 - abs(fract((x + y * 4.0 + material) / 23.0) * 2.0 - 1.0);
    float canopyCrown = smoothstep(0.69, 0.94, canopyFacet) * (0.45 + canopyCross * 0.55);
    float canopyPocket = 1.0 - smoothstep(0.18, 0.48, canopyFacet);
    // Dense PLNT bodies already own a slower canopy cluster, crown, and
    // pocket. Scale only this cell-scale leaf/vein grammar there so it adds
    // living variation without resolving as repeated bright scanlines; broad
    // facet/cross identity remains fully legible in every topology.
    vec3 leafVein = vec3(leaf * 1.5 - vein * 3.0, leaf * 3.5 + vein * 6.0,
      leaf - vein * 2.5) * plantFineGain;
    delta = leafVein
      + canopyCrown * vec3(1.5, 4.5, 1.0)
      - canopyPocket * vec3(1.7, 2.1, 0.8);
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
vec3 botanicalLifecycleDelta(
  float material, vec2 stateBytes, vec2 position, vec3 sourceColor
) {
  float packedState = floor(stateBytes.x * 255.0 + 0.5)
    + floor(stateBytes.y * 255.0 + 0.5) * 256.0;
  vec2 world = floor(position);
  if (material == 50.0) {
    if (packedState < 0.5) return vec3(0.0);
    float water = mod(packedState, 256.0);
    float timer = mod(floor(packedState / 256.0), 256.0);
    float moisture = water / 255.0;
    float germination = min(timer, 200.0) / 200.0;
    float swelling = min(1.0, water / 4.0);
    vec2 local = mod(world, 11.0) - 5.0;
    float radiusSquared = dot(local, local);
    bool swollenHusk = radiusSquared >= 12.0 && radiusSquared <= 25.0;
    bool openingSeam = local.x == 0.0 && local.y >= -3.0 && local.y <= 3.0;
    bool rootTip = local.x >= -1.0 && local.x <= 1.0
      && local.y >= 2.0 && local.y <= 4.0;
    vec3 delta = vec3(-12.0, -9.0, 5.0) * moisture;
    if (swollenHusk) delta += vec3(4.0, 7.0, 6.0) * swelling;
    if (openingSeam) delta += vec3(5.0, 16.0, 3.0) * germination;
    if (rootTip) delta += vec3(-2.0, 7.0, 5.0) * germination;
    return clamp(delta, vec3(-24.0), vec3(24.0)) / 255.0;
  }
  if (material != 10.0
    || mod(floor(packedState / 32768.0), 2.0) < 0.5
    || mod(packedState, 32768.0) < 0.5) return vec3(0.0);
  float tree = mod(packedState, 2.0);
  // Inherited palette/direction are upstream tree genetics, not ordinary PLNT
  // styling. Hydrated or active non-tree PLNT retains the normal body.
  if (tree < 0.5) return vec3(0.0);
  float phase = mod(floor(packedState / 2.0), 4.0);
  float direction = mod(floor(packedState / 8.0), 8.0);
  float inheritedColour = mod(floor(packedState / 64.0), 64.0);
  float hydrationClass = mod(floor(packedState / 4096.0), 4.0);
  float active = mod(floor(packedState / 16384.0), 2.0);
  float cyan = mod(floor(inheritedColour / 16.0), 4.0) > 0.0 ? 1.0 : 0.0;
  float magenta = mod(floor(inheritedColour / 4.0), 4.0) > 0.0 ? 1.0 : 0.0;
  float yellow = mod(inheritedColour, 4.0) > 0.0 ? 1.0 : 0.0;
  float paletteIndex = cyan * 4.0 + magenta * 2.0 + yellow;
  vec3 leafColor = paletteIndex == 0.0 ? vec3(243.0, 246.0, 244.0)
    : paletteIndex == 1.0 ? vec3(255.0, 223.0, 50.0)
    : paletteIndex == 2.0 ? vec3(255.0, 183.0, 197.0)
    : paletteIndex == 3.0 ? vec3(250.0, 0.0, 25.0)
    : paletteIndex == 4.0 ? vec3(128.0, 206.0, 196.0)
    : paletteIndex == 5.0 ? vec3(127.0, 255.0, 0.0)
    : paletteIndex == 6.0 ? vec3(0.0, 74.0, 178.0)
    : vec3(12.0, 172.0, 0.0);
  bool vein = mod(
    world.x * (direction + 1.0) + world.y * (8.0 - direction) + phase * 3.0,
    13.0
  ) <= 1.0;
  bool growthTip = active > 0.5 && mod(
    world.x * (8.0 - direction) - world.y * (direction + 1.0) + phase * 5.0,
    17.0
  ) <= 1.0;
  float hydration = hydrationClass / 3.0;
  vec3 variation = vec3(-2.0, -1.0, 4.0) * hydration;
  if (vein) variation += vec3(-4.0, 7.0, -3.0);
  if (growthTip) variation += vec3(7.0, 11.0, 4.0);
  float blend = 0.42;
  return clamp(
    (leafColor / 255.0 - sourceColor) * blend + variation / 255.0,
    vec3(-64.0 / 255.0), vec3(64.0 / 255.0)
  );
}
float sparkHostFamily(float host) {
  if (host == 23.0 || host == 36.0 || host == 45.0 || host == 46.0
    || host == 61.0 || host == 67.0 || host == 70.0 || host == 73.0
    || host == 75.0 || host == 82.0 || host == 95.0 || host == 96.0
    || host == 151.0) return 1.0;
  if (host == 51.0 || host == 144.0 || host == 146.0) return 2.0;
  if (host == 145.0 || host == 147.0) return 3.0;
  if (host == 135.0 || host == 136.0 || host == 140.0 || host == 142.0
    || host == 143.0 || host == 149.0 || host == 150.0 || host == 164.0
    || host == 166.0 || host == 167.0 || host == 168.0 || host == 169.0
    || host == 170.0) return 4.0;
  if (host == 2.0 || host == 16.0 || host == 53.0 || host == 55.0) return 5.0;
  return 0.0;
}
vec3 sparkStateDelta(
  float material, vec2 stateBytes, vec2 position, vec3 sourceColor
) {
  if (material != 148.0) return vec3(0.0);
  float packedState = floor(stateBytes.x * 255.0 + 0.5)
    + floor(stateBytes.y * 255.0 + 0.5) * 256.0;
  if (mod(floor(packedState / 32768.0), 2.0) < 0.5) return vec3(0.0);
  float host = mod(packedState, 256.0);
  float family = sparkHostFamily(host);
  if (host < 0.5 || family < 0.5) return vec3(0.0);
  float life = min(127.0, mod(floor(packedState / 256.0), 128.0));
  float lifecycle = min(1.0, life / 4.0);
  vec2 world = floor(position);
  float carrier = mod(world.x * 3.0 + world.y * 5.0 + family * 7.0, 11.0) <= 1.0
    ? 1.0 : 0.0;
  float junction = mod(world.x - world.y * 2.0 + family * 5.0, 17.0) == 0.0
    ? 1.0 : 0.0;
  float geometry = carrier > 0.5 ? 1.0 : junction > 0.5 ? 0.68 : 0.30;
  float blend = (0.25 + lifecycle * 0.75) * geometry * 0.18;
  vec3 target = family == 1.0 ? vec3(145.0, 198.0, 255.0)
    : family == 2.0 ? vec3(218.0, 120.0, 255.0)
    : family == 3.0 ? vec3(255.0, 178.0, 74.0)
    : family == 4.0 ? vec3(105.0, 184.0, 255.0)
    : vec3(70.0, 235.0, 255.0);
  vec3 displaySource = min(sourceColor, vec3(1.0));
  return mix(displaySource, target / 255.0, blend) - sourceColor;
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
// Temperature is packed as decikelvin >> 8, so one semantic byte is 25.6 K.
// This Tanner-Helland-style ramp supplies chromatic HDR radiance to the
// optional float pipeline without changing alpha, material ownership, or the
// shared emission field. The classic and true-8x paths never execute it.
vec3 blackbodyColor(float temperatureByte) {
  float temperature = clamp(temperatureByte * 25.6, 1000.0, 6500.0) / 100.0;
  float red = temperature <= 66.0
    ? 255.0 : 329.698727446 * pow(temperature - 60.0, -0.1332047592);
  float green = temperature <= 66.0
    ? 99.4708025861 * log(temperature) - 161.1195681661
    : 288.1221695283 * pow(temperature - 60.0, -0.0755148492);
  float blue = temperature >= 66.0
    ? 255.0 : temperature <= 19.0
      ? 0.0 : 138.5177312231 * log(temperature - 10.0) - 305.0447927307;
  return clamp(vec3(red, green, blue), 0.0, 255.0) / 255.0;
}
float blackbodyHdrRadiance(float temperatureByte) {
  float onset = smoothstep(28.0, 52.0, temperatureByte);
  float whiteHot = smoothstep(52.0, 255.0, temperatureByte);
  return onset * (0.35 + whiteHot * 2.4);
}
vec3 toneMapEnergy(vec3 radiance) {
  const float knee = 0.72;
  const float ceiling = 232.0 / 255.0;
  // A hard ceiling turns a dense photon body into a uniform plate precisely
  // where its existing low-frequency radiance relief should remain visible.
  // This bounded shoulder approaches the same ceiling without pinning a range
  // of high source values to one byte.
  const float shoulder = 0.65;
  // Compress the peak as one scalar rather than each RGB channel independently.
  // Saturated Plasma and photon bodies then retain their authored violet/blue
  // chroma and broad internal relief instead of drifting toward grey at the
  // shoulder. This remains RGB-only and preserves the original ceiling.
  float peak = max(max(radiance.r, radiance.g), radiance.b);
  if (peak <= knee) return radiance;
  float mappedPeak = knee + (ceiling - knee) * (peak - knee) / (peak - knee + shoulder);
  return radiance * (mappedPeak / peak);
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
// Exact native electric-discharge matter. LIGH/THDR do not enter the Energy
// family branch, so this shared arithmetic motif is composed later over their
// authoritative semantic cells. It changes RGB only and performs no sampling.
vec3 electricDischargeIdentityDelta(float material, vec2 position) {
  float x = floor(position.x);
  float y = floor(position.y);
  vec3 delta = vec3(0.0);
  if (material == 93.0) {
    bool trunk = mod(x * 2.0 - y * 3.0, 13.0) <= 1.0;
    bool branch = mod(x * 5.0 + y * 3.0, 17.0) < 0.5;
    bool node = mod(x + y * 2.0, 29.0) < 0.5;
    delta = vec3(
      trunk ? 10.0 : (branch ? 6.0 : 2.0),
      trunk ? 14.0 : (branch ? 8.0 : 3.0),
      node ? 18.0 : (trunk ? 16.0 : (branch ? 14.0 : 5.0))
    );
  } else if (material == 97.0) {
    bool fork = mod(x * 3.0 + y * 5.0, 11.0) <= 1.0;
    bool shock = mod(x * 7.0 - y * 2.0, 19.0) < 0.5;
    bool ember = mod(x + y * 3.0, 7.0) <= 1.0;
    delta = vec3(
      fork ? 18.0 : (shock ? 12.0 : 5.0),
      fork ? 13.0 : (shock ? 7.0 : 3.0),
      fork ? 3.0 : (shock ? 7.0 : (ember ? 1.0 : -2.0))
    );
  }
  return clamp(delta, vec3(-18.0), vec3(18.0)) / 255.0;
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
float lavaAncestryFamily(float origin) {
  if (origin == 1.0 || origin == 21.0 || origin == 22.0 || origin == 24.0
    || origin == 25.0 || origin == 26.0 || origin == 28.0 || origin == 29.0
    || origin == 44.0 || origin == 76.0 || origin == 78.0) return 1.0;
  if (origin == 23.0 || origin == 30.0 || origin == 46.0 || origin == 67.0
    || origin == 70.0 || origin == 72.0 || origin == 73.0 || origin == 75.0
    || origin == 82.0 || origin == 151.0) return 2.0;
  if (origin == 7.0 || origin == 94.0) return 3.0;
  if (origin == 51.0 || origin == 143.0 || origin == 144.0
    || origin == 145.0 || origin == 146.0 || origin == 147.0) return 4.0;
  if (origin == 108.0 || origin == 109.0 || origin == 112.0) return 5.0;
  return 0.0;
}
vec3 lavaAncestryDelta(float material, vec2 stateBytes, vec2 position) {
  if (material != 11.0) return vec3(0.0);
  float packedState = floor(stateBytes.x * 255.0 + 0.5)
    + floor(stateBytes.y * 255.0 + 0.5) * 256.0;
  if (mod(floor(packedState / 256.0), 2.0) < 0.5) return vec3(0.0);
  float origin = mod(packedState, 256.0);
  float family = lavaAncestryFamily(origin);
  if (family < 0.5) return vec3(0.0);
  float x = floor(position.x);
  float y = floor(position.y);
  float identityMark = step(mod(x * 3.0 + y * 5.0 + origin * 7.0, 17.0), 1.0);
  float familyBand = step(
    mod(x * (family + 1.0) - y * (6.0 - family) + origin, 23.0), 1.0
  );
  float gain = identityMark > 0.5 ? 1.0 : familyBand > 0.5 ? 0.56 : 0.18;
  vec3 key = family == 1.0 ? vec3(-5.0, 6.0, 14.0)
    : family == 2.0 ? vec3(2.0, 12.0, 4.0)
    : family == 3.0 ? vec3(-6.0, 14.0, 9.0)
    : family == 4.0 ? vec3(-10.0, 9.0, 16.0)
    : vec3(-6.0, 16.0, -2.0);
  return clamp(key * gain, vec3(-16.0), vec3(16.0)) / 255.0;
}
// Keep the exact low-frequency Earth/mineral powder grammar out of main's
// long-lived composed-body scope. True 8x otherwise keeps every temporary
// modulus result live across unrelated powder optics and can waste registers on
// the 15-million-fragment path. World coordinates are non-negative here.
vec3 earthenPowderIdentityDelta(float material, vec2 position) {
  float x = floor(position.x);
  float y = floor(position.y);
  if (material == 6.0) {
    float band = 1.0 - step(0.5, mod(y + floor(x / 7.0) * 2.0, 17.0));
    if (band > 0.5) return vec3(-4.0, -3.0, -2.0) / 255.0;
    float silt = 1.0 - step(0.5, mod(x * 3.0 + y * 5.0, 31.0));
    return vec3(4.0, 3.0, 1.0) * silt / 255.0;
  }
  if (material == 21.0) {
    float seam = 1.0 - step(0.5, mod(x * 2.0 - y + floor(y / 9.0) * 3.0, 23.0));
    float facet = 1.0 - step(0.5, mod(x * 5.0 + y * 2.0, 37.0));
    return (vec3(-5.0, -4.0, -2.0) * seam + vec3(2.0, 3.0, 4.0) * facet) / 255.0;
  }
  if (material == 26.0) {
    float course = 1.0 - step(0.5, mod(y, 13.0));
    float joint = 1.0 - step(0.5, mod(x + floor(y / 13.0) * 5.0, 29.0));
    float constructionJoin = max(course, joint);
    if (constructionJoin > 0.5) return vec3(-4.0, -4.0, -3.0) / 255.0;
    float aggregate = 1.0 - step(0.5, mod(x * 4.0 + y * 7.0, 41.0));
    return vec3(3.0, 2.0, -1.0) * aggregate / 255.0;
  }
  if (material == 28.0) {
    float lamella = 1.0 - step(0.5, mod(y * 2.0 + floor(x / 8.0), 19.0));
    float pocket = 1.0 - step(0.5, mod(x * 3.0 - y * 2.0, 43.0));
    return (vec3(-3.0, -3.0, -2.0) * lamella + vec3(5.0, 1.0, -2.0) * pocket) / 255.0;
  }
  return vec3(0.0);
}
// Settled mineral strata are deliberately separate from the ordinary Earth
// identity marks above. They exist only where the composed body has already
// proved a deep, stable Smooth powder interior; this helper is arithmetic-only
// RGB grammar and carries no topology, field, or output-scale decision.
vec3 settledPowderMesostrataDelta(float material, vec2 position, float directedSlope) {
  float style = material == 1.0 ? 1.0 : (material == 21.0 ? 2.0
    : (material == 26.0 ? 3.0 : (material == 28.0 ? 4.0 : 0.0)));
  if (style < 0.5) return vec3(0.0);
  vec2 cell = floor(position);
  float phase = cell.x * (-directedSlope * 0.072 + 0.037 * style)
    + cell.y * (directedSlope * 0.061 + 0.061 * style) + style * 0.173;
  float band = 1.0 - abs(fract(phase) * 2.0 - 1.0);
  vec3 key = style == 1.0 ? vec3(7.0, 3.0, -4.0)
    : (style == 2.0 ? vec3(7.0, 9.0, 13.0)
    : (style == 3.0 ? vec3(8.0, 7.0, 8.0) : vec3(6.0, 1.0, -3.0)));
  return key * (band - 0.5) * 2.0 / 255.0;
}
// As with the powder helper, keep construction-body identity out of main's
// shared smooth-surface scope. Each exact owner returns before another
// material's arithmetic becomes live on the true-8x fragment path.
vec3 structuralRigidIdentityDelta(float material, vec2 position) {
  float x = floor(position.x);
  float y = floor(position.y);
  if (material == 22.0) {
    float course = 1.0 - step(0.5, mod(y, 6.0));
    float joint = 1.0 - step(0.5, mod(x + floor(y / 6.0) * 3.0, 12.0));
    if (max(course, joint) > 0.5) return vec3(-8.0, -6.0, -4.0) / 255.0;
    float fleck = 1.0 - step(0.5, mod(x * 5.0 + y * 3.0, 23.0));
    return vec3(3.0, 1.0, -1.0) * fleck / 255.0;
  }
  if (material == 23.0) {
    float brush = 1.0 - step(0.5, mod(x * 2.0 + y, 9.0));
    float glint = 1.0 - step(0.5, mod(x * 5.0 - y * 3.0, 31.0));
    return (vec3(-2.0, 1.0, 4.0) * brush + vec3(5.0, 6.0, 7.0) * glint) / 255.0;
  }
  if (material == 25.0) {
    float glaze = 1.0 - step(0.5, mod(x * 3.0 + y * 5.0, 19.0));
    float craze = 1.0 - step(0.5, mod(x * 7.0 - y * 4.0, 29.0));
    return (vec3(3.0, 4.0, 5.0) * glaze - vec3(4.0, 3.0, 2.0) * craze) / 255.0;
  }
  if (material == 67.0) {
    float plate = 1.0 - step(0.5, mod(x + floor(y / 5.0) * 2.0, 11.0));
    float pit = 1.0 - step(0.5, mod(x * 7.0 + y * 11.0, 37.0));
    return (vec3(-3.0, -2.0, 2.0) * plate - vec3(7.0, 6.0, 4.0) * pit) / 255.0;
  }
  if (material == 70.0) {
    float grain = 1.0 - step(0.5, mod(x * 3.0 - y, 13.0));
    float glint = 1.0 - step(0.5, mod(x * 5.0 + y * 2.0, 31.0));
    return (vec3(5.0, 3.0, -3.0) * grain + vec3(7.0, 5.0, -1.0) * glint) / 255.0;
  }
  if (material == 73.0) {
    float scale = 1.0 - step(2.0, mod(x * 5.0 + y * 3.0, 17.0));
    float roll = 1.0 - step(0.5, mod(x - y * 2.0, 15.0));
    return (vec3(5.0, -2.0, -4.0) * scale + vec3(-2.0, -1.0, 2.0) * roll) / 255.0;
  }
  if (material == 82.0) {
    float lamella = 1.0 - step(0.5, mod(x * 2.0 + y * 3.0, 11.0));
    float highlight = 1.0 - step(0.5, mod(x * 7.0 - y * 5.0, 37.0));
    return (vec3(-2.0, 2.0, 5.0) * lamella + vec3(3.0, 4.0, 5.0) * highlight) / 255.0;
  }
  return vec3(0.0);
}
// Normal WebGL counterpart of the direct geological body grammar. The caller
// already proved a deep, exact solid interior, so this is compact RGB-only
// world-space arithmetic; walls, traits, surface support, and alpha never
// enter the helper.
vec3 geologicalSolidCoreDelta(float material, vec2 position, float depthT, float signedRelief) {
  vec2 cell = floor(position);
  float crown = max(0.0, signedRelief);
  float pocket = max(0.0, -signedRelief);
  if (material == 19.0) {
    float cleavage = 1.0 - step(0.5, mod(cell.x * 2.0 + cell.y * 3.0, 13.0));
    float cross = 1.0 - step(0.5, mod(cell.x - cell.y * 2.0, 29.0));
    float inclusion = 1.0 - step(0.5, mod(cell.x * 7.0 + cell.y * 5.0, 41.0));
    return clamp(-vec3(5.0, 4.0, 3.0) * depthT - vec3(3.0, 2.0, 1.0) * pocket
      - vec3(2.0, 2.0, 1.0) * max(cleavage, cross) * depthT
      + vec3(3.0, 1.0, -1.0) * inclusion * depthT + vec3(0.0, 0.0, 2.0) * crown,
    vec3(-12.0), vec3(12.0)) / 255.0;
  }
  if (material == 78.0) {
    float stratum = 1.0 - step(2.0, mod(cell.x + floor(cell.y / 3.0) * 2.0, 15.0));
    float vein = 1.0 - step(0.5, mod(cell.x * 3.0 - cell.y * 2.0, 37.0));
    return clamp(vec3(-3.0, 2.0, 4.0) * crown - vec3(3.0, 2.0, 1.0) * pocket
      + vec3(-1.0, 1.0, 2.0) * stratum * depthT + vec3(1.0, 2.0, 3.0) * vein * depthT,
    vec3(-12.0), vec3(12.0)) / 255.0;
  }
  return vec3(0.0);
}
// Normal-path counterpart of the direct thermal/catalytic core grammar. The
// caller has already rejected contours, walls, traits, emission, and shallow
// owners; this function remains static arithmetic over existing values only.
vec3 thermalCatalyticRigidCoreDelta(float material, vec2 position, float depthT, float signedRelief) {
  vec2 cell = floor(position);
  float crown = max(0.0, signedRelief);
  float pocket = max(0.0, -signedRelief);
  if (material == 72.0) {
    float channel = 1.0 - step(0.5, mod(cell.x * 3.0 + cell.y * 2.0, 17.0));
    float pin = 1.0 - step(0.5, mod(cell.x - cell.y * 4.0, 31.0));
    return clamp(vec3(4.0, -2.0, -3.0) * crown - vec3(3.0, 2.0, 3.0) * pocket
      + vec3(3.0, 0.0, -1.0) * channel * depthT + vec3(0.0, -1.0, 0.0) * pin * depthT,
    vec3(-12.0), vec3(12.0)) / 255.0;
  }
  if (material == 75.0) {
    float plane = 1.0 - step(2.0, mod(cell.x + cell.y * 2.0, 19.0));
    float site = 1.0 - step(0.5, mod(cell.x * 5.0 - cell.y * 3.0, 43.0));
    return clamp(vec3(2.0, 3.0, 5.0) * crown - vec3(2.0, 1.0, 1.0) * pocket
      + vec3(-1.0, 0.0, 2.0) * plane * depthT + vec3(0.0, 1.0, 1.0) * site * depthT,
    vec3(-12.0), vec3(12.0)) / 255.0;
  }
  if (material == 79.0) {
    float seam = 1.0 - step(0.5, mod(cell.x * 2.0 - cell.y * 3.0, 23.0));
    float inclusion = 1.0 - step(0.5, mod(cell.x * 7.0 + cell.y, 47.0));
    return clamp(vec3(2.0, 0.0, 0.0) * crown - vec3(4.0, 3.0, 3.0) * pocket
      + vec3(0.0, -1.0, -1.0) * seam * depthT + vec3(2.0, 0.0, 0.0) * inclusion * depthT,
    vec3(-12.0), vec3(12.0)) / 255.0;
  }
  return vec3(0.0);
}
vec3 gooSolidCoreDelta(vec2 position, float depthT, float signedRelief) {
  vec2 cell = floor(position);
  float crown = max(0.0, signedRelief);
  float pocket = max(0.0, -signedRelief);
  float compression = 1.0 - step(2.0, mod(cell.x * 2.0 + cell.y * 3.0, 29.0));
  float bubble = 1.0 - step(0.5, mod(cell.x * 5.0 - cell.y * 2.0, 47.0));
  return clamp(vec3(2.0, 4.0, 5.0) * crown - vec3(4.0, 2.0, 1.0) * pocket
    + vec3(-1.0, 0.0, 2.0) * compression * depthT + vec3(0.0, 1.0, 1.0) * bubble * depthT,
  vec3(-10.0), vec3(10.0)) / 255.0;
}
vec3 frayForceIdentityDelta(vec2 position) {
  vec2 cell = mod(floor(position), 24.0) - vec2(11.5);
  float radiusSquared = dot(cell, cell);
  float core = 1.0 - step(6.26, radiusSquared);
  float ring = step(24.0, radiusSquared) * (1.0 - step(42.01, radiusSquared));
  float axis = (1.0 - step(1.51, abs(cell.y))) * (1.0 - step(10.51, abs(cell.x)));
  float rail = step(8.49, abs(cell.x)) * (1.0 - step(8.51, abs(cell.y)));
  float pin = 1.0 - step(0.5, mod(floor(position.x) * 3.0 - floor(position.y) * 5.0, 29.0));
  return clamp(vec3(-3.0, 5.0, 8.0) * core + vec3(-2.0, 4.0, 7.0) * ring
    + vec3(1.0, 3.0, 5.0) * axis + vec3(-2.0, 2.0, 4.0) * rail
    + vec3(2.0, 3.0, 4.0) * pin, vec3(-12.0), vec3(12.0)) / 255.0;
}
vec3 gbmbForceIdentityDelta(vec2 position) {
  vec2 cell = mod(floor(position), 28.0) - vec2(13.5);
  float radiusSquared = dot(cell, cell);
  float core = 1.0 - step(9.01, radiusSquared);
  float ring = step(35.0, radiusSquared) * (1.0 - step(60.01, radiusSquared));
  float meridian = (1.0 - step(1.51, abs(cell.x))) * (1.0 - step(11.51, abs(cell.y)));
  float latitude = (1.0 - step(1.51, abs(cell.y))) * (1.0 - step(11.51, abs(cell.x)));
  float mote = 1.0 - step(0.5, mod(floor(position.x) * 5.0 + floor(position.y) * 3.0, 37.0));
  return clamp(vec3(3.0, 4.0, 9.0) * core + vec3(2.0, 2.0, 8.0) * ring
    + vec3(-3.0, -2.0, 3.0) * max(meridian, latitude) + vec3(2.0, 3.0, 5.0) * mote,
  vec3(-12.0), vec3(12.0)) / 255.0;
}
// Native transport and actuator bodies sit beneath later role/thermal decals.
// They use only exact owner, world position, and the caller's established
// device-surface proof.  No alpha, support, material, field, clock, or scale
// state is touched, so holes/channels/rails retain semantic topology.
vec3 mechanismBodyIdentityDelta(float material, vec2 position) {
  float x = floor(position.x);
  float y = floor(position.y);
  if (material == 121.0 || material == 160.0) { // PIPE / PPIP
    float style = material == 160.0 ? 1.0 : 0.0;
    float lumen = 1.0 - step(1.0, mod(x + y * 2.0 + style, 9.0));
    float rail = 1.0 - step(0.5, mod(x * (2.0 + style) + y * 3.0, 13.0));
    float junction = 1.0 - step(0.5, mod(x * 5.0 - y * 2.0 + style, 31.0));
    return (vec3(-5.0, -3.0, 4.0) * lumen + vec3(3.0, 7.0, 11.0) * rail
      + vec3(1.0, 4.0, 8.0) * junction * style) / 255.0;
  }
  if (material == 155.0 || material == 161.0) { // GPMP / PUMP
    vec2 local = fract(position / 18.0) - 0.5;
    float radius = length(local);
    float ring = 1.0 - smoothstep(0.030, 0.070, abs(radius - 0.29));
    float hub = 1.0 - smoothstep(0.09, 0.17, radius);
    float spoke = 1.0 - smoothstep(0.050, 0.115, min(abs(local.x), abs(local.y)));
    float pump = material == 161.0 ? 1.0 : 0.0;
    return (vec3(-3.0, 6.0, 11.0) * (ring * 0.82 + hub * 0.55)
      + vec3(4.0, 7.0, 10.0) * spoke * mix(0.32, 0.58, pump)) / 255.0;
  }
  if (material == 122.0 || material == 119.0) { // PSTN / FRME
    float frame = material == 119.0 ? 1.0 : 0.0;
    float rib = 1.0 - step(0.5, mod(x * 2.0 + y + frame, 11.0));
    float seam = 1.0 - step(0.5, mod(x * 4.0 - y * 2.0 + frame, 35.0));
    float rail = 1.0 - step(0.5, mod(x + y * 3.0, 17.0));
    return ((vec3(5.0, 7.0, 10.0) * rib - vec3(5.0, 4.0, 2.0) * seam) * (1.0 - frame * 0.38)
      + vec3(5.0, 3.0, 0.0) * rail * frame) / 255.0;
  }
  if (material == 123.0) { // RPEL
    vec2 local = fract(position / 20.0) - 0.5;
    float ring = 1.0 - smoothstep(0.025, 0.060, abs(length(local) - 0.33));
    float coil = 1.0 - step(0.5, mod(x + y * 3.0, 7.0));
    float seam = 1.0 - step(0.5, mod(x * 3.0 - y, 29.0));
    return (vec3(3.0, 4.0, 14.0) * (ring + coil * 0.46) - vec3(3.0, 1.0, 1.0) * seam) / 255.0;
  }
  if (material == 162.0 || material == 163.0) { // PVOD / STOR
    float storage = material == 163.0 ? 1.0 : 0.0;
    float bay = 1.0 - step(0.5, mod(floor(x / 3.0) + floor(y / 3.0), 2.0));
    float rail = 1.0 - step(0.5, mod(x * 3.0 + y * 2.0 + storage, 17.0));
    float seam = 1.0 - step(0.5, mod(x * 5.0 - y + storage, 37.0));
    return (-vec3(5.0, 4.0, 2.0) * bay + vec3(4.0, 8.0, 12.0) * rail
      + vec3(4.0, 2.0, -2.0) * seam * storage) / 255.0;
  }
  if (material == 117.0) { // DMG
    float facet = 1.0 - step(0.5, mod(x * 2.0 + y * 3.0, 13.0));
    float crack = 1.0 - step(0.5, mod(x * 5.0 - y * 4.0, 31.0));
    return (vec3(7.0, 4.0, -2.0) * facet - vec3(6.0, 4.0, 2.0) * crack) / 255.0;
  }
  return vec3(0.0);
}
float mechanismBodyStyle(float material) {
  return material == 117.0 || material == 119.0 || material == 121.0
    || material == 122.0 || material == 123.0 || material == 155.0
    || material == 160.0 || material == 161.0 || material == 162.0
    || material == 163.0 ? 1.0 : 0.0;
}
// Exact native control electronics retain a legible body grammar on canonical
// WebGL. This does not borrow the generic Device profile as an identity test:
// several controls are trait-bearing, and semantic roles still layer after the
// bounded RGB marks below. Canvas is intentionally left as the semantic and
// recovery backend for this advanced visual layer.
float electronicBodyStyle(float material) {
  return material == 135.0 || material == 136.0 || material == 138.0
    || material == 139.0 || material == 140.0 || material == 141.0
    || material == 142.0 || material == 143.0 || material == 144.0
    || material == 145.0 || material == 146.0 || material == 147.0
    || material == 149.0 || material == 150.0 || material == 151.0
    || material == 152.0 || material == 153.0 || material == 154.0
    || material == 156.0 || material == 157.0 ? 1.0 : 0.0;
}
float electronicBodyIndex(float material) {
  if (material == 135.0) return 1.0;
  if (material == 136.0) return 2.0;
  if (material == 138.0) return 3.0;
  if (material == 139.0) return 4.0;
  if (material == 140.0) return 5.0;
  if (material == 141.0) return 6.0;
  if (material == 142.0) return 7.0;
  if (material == 143.0) return 8.0;
  if (material == 144.0) return 9.0;
  if (material == 145.0) return 10.0;
  if (material == 146.0) return 11.0;
  if (material == 147.0) return 12.0;
  if (material == 149.0) return 13.0;
  if (material == 150.0) return 14.0;
  if (material == 151.0) return 15.0;
  if (material == 152.0) return 16.0;
  if (material == 153.0) return 17.0;
  if (material == 154.0) return 18.0;
  if (material == 156.0) return 19.0;
  if (material == 157.0) return 20.0;
  return 0.0;
}
vec3 electronicBodyIdentityDelta(float material, vec2 position) {
  float style = electronicBodyIndex(material);
  if (style < 0.5) return vec3(0.0);
  float x = floor(position.x);
  float y = floor(position.y);
  float rail = 1.0 - step(0.5, mod(x * (1.0 + mod(style, 4.0))
    + y * (2.0 + mod(style, 3.0)) + style * 3.0, 11.0 + mod(style, 5.0)));
  float node = 1.0 - step(0.5, mod(x * (4.0 + mod(style, 3.0))
    - y * (2.0 + mod(style, 4.0)) + style * 7.0, 29.0 + mod(style, 7.0)));
  if (style < 3.5) {
    float beam = 1.0 - step(1.0, mod(x - y * (style == 2.0 ? 1.0 : 2.0), 9.0));
    return (vec3(8.0, 5.0, -3.0) * beam + vec3(3.0, 8.0, 13.0) * rail
      - vec3(4.0, 3.0, 1.0) * node) / 255.0;
  }
  if (style < 6.0) {
    float ring = 1.0 - step(0.5, mod(abs(x * 2.0 - y * 3.0) + style, 13.0));
    return (vec3(4.0, 9.0, 14.0) * ring + vec3(8.0, 3.0, -2.0) * node
      - vec3(3.0, 2.0, 1.0) * rail) / 255.0;
  }
  if (style < 9.0) {
    float slot = 1.0 - step(0.5, mod(x + y * 3.0 + style, 17.0));
    return (vec3(-4.0, 2.0, 8.0) * rail + vec3(5.0, 4.0, 1.0) * slot
      + vec3(2.0, 5.0, 8.0) * node) / 255.0;
  }
  if (style < 13.0) {
    float junction = 1.0 - step(0.5, mod(x * 2.0 + y * 5.0 + style, 19.0));
    vec3 polarity = mod(style, 2.0) < 0.5 ? vec3(9.0, -2.0, 7.0) : vec3(-3.0, 8.0, 11.0);
    return (polarity * junction + vec3(3.0, 5.0, 9.0) * rail
      - vec3(3.0, 2.0, 1.0) * node) / 255.0;
  }
  if (style < 17.0) {
    float coil = 1.0 - step(0.5, mod(x * 3.0 - y * 2.0 + style, 15.0));
    return (vec3(6.0, 4.0, -2.0) * rail + vec3(2.0, 8.0, 14.0) * coil
      - vec3(4.0, 3.0, 1.0) * node) / 255.0;
  }
  float tap = 1.0 - step(0.5, mod(x + y * 4.0 + style, 21.0));
  return (vec3(3.0, 8.0, 13.0) * rail + vec3(7.0, 3.0, 5.0) * tap
    - vec3(4.0, 3.0, 1.0) * node) / 255.0;
}
// Exact default-optics Field bodies need more than the generic animated wave
// at ordinary presentation scale. Keep the direct 8x vocabulary's rails,
// apertures, cores, and rings static here as well: this is RGB-only arithmetic
// over already-decoded world coordinates, so it adds no sample, resource,
// clock, alpha, support, wall, ownership, or simulation decision.
vec3 fieldProfileIdentityDelta(float material, vec2 position) {
  vec2 cell = floor(position);
  float fieldBand = 1.0 - abs(fract((cell.x + cell.y * 0.62 + material * 0.37) / 12.0) * 2.0 - 1.0);
  float fieldCross = 1.0 - step(0.5, mod(cell.x * 3.0 + cell.y * 5.0 + material, 13.0));
  vec3 delta = vec3(-3.0, 4.0, 10.0) * (fieldBand - 0.46) * 0.72
    + vec3(1.0, 3.0, 6.0) * fieldCross * 0.30;
  vec2 tile = mod(cell, 16.0) - vec2(7.5);
  float radius2 = dot(tile, tile);
  float apertureCore = 1.0 - smoothstep(3.0, 26.0, radius2);
  float apertureRing = smoothstep(13.0, 32.0, radius2)
    * (1.0 - smoothstep(45.0, 74.0, radius2));
  float spoke = 1.0 - step(0.5, mod(cell.x * 5.0 - cell.y * 3.0 + material, 11.0));
  if (material == 132.0) { // TRON
    float tronRail = max(
      1.0 - step(0.5, mod(cell.x + cell.y * 2.0, 7.0)),
      1.0 - step(0.5, mod(cell.x * 2.0 - cell.y, 11.0))
    );
    delta = vec3(2.0, 19.0, -7.0) * (0.26 + tronRail * 0.74)
      + vec3(-2.0, 4.0, 1.0) * fieldBand;
  } else if (material == 130.0 || material == 131.0) { // PRTI / PRTO
    vec3 portalKey = material == 130.0 ? vec3(17.0, 5.0, -3.0) : vec3(-4.0, 8.0, 18.0);
    delta = portalKey * (apertureRing * 0.86 + spoke * 0.24)
      - vec3(4.0, 3.0, 5.0) * apertureCore * 0.38;
  } else if (material == 125.0 || material == 128.0 || material == 133.0) { // holes
    vec3 rim = material == 133.0 ? vec3(15.0, 1.0, -2.0) : vec3(5.0, 1.0, 13.0);
    delta = rim * (apertureRing * 0.76 + spoke * 0.16)
      - vec3(5.0, 4.0, 6.0) * apertureCore * 0.56;
  } else if (material == 129.0 || material == 134.0) { // VOID / WHOL
    delta = vec3(5.0, 13.0, 18.0) * (apertureRing * 0.74 + spoke * 0.32)
      - vec3(2.0, 1.0, 2.0) * apertureCore * 0.16;
  } else return vec3(0.0);
  return clamp(delta, vec3(-18.0), vec3(18.0)) / 255.0;
}
float structuralRigidDeepIdentityGain(float material) {
  // Large rigid bodies carry their broad depth and reflected-light response
  // through the shared solid optics. Retain material-specific construction
  // marks near contours and in thin pieces, but reduce their cell cadence once
  // the existing exact-species thickness byte proves a true interior. Metal is
  // deliberately the calmest plate; Brick preserves more of its courses.
  if (material == 22.0) return 0.62;
  if (material == 23.0) return 0.22;
  if (material == 25.0) return 0.36;
  if (material == 67.0) return 0.30;
  if (material == 70.0) return 0.50;
  if (material == 73.0) return 0.42;
  if (material == 82.0) return 0.34;
  return 1.0;
}
// Smooth, thick structural metals read as coherent rolled material rather
// than a collection of grid marks. This arithmetic-only body finish is called
// only after the existing exact-species optical-depth proof; it leaves thin
// pieces to the identity helper and never changes alpha or reconstruction.
vec3 structuralMetalBodyDelta(
  float material, vec2 position, float depthT, float signedResponse
) {
  vec2 direction = vec2(1.0, 0.0);
  vec3 key = vec3(0.0);
  vec3 shadow = vec3(0.0);
  float offset = 0.0;
  if (material == 23.0) {
    direction = vec2(0.034, 0.009);
    key = vec3(8.0, 11.0, 16.0);
    shadow = vec3(6.0, 7.0, 10.0);
    offset = 0.17;
  } else if (material == 67.0) {
    direction = vec2(0.027, -0.014);
    key = vec3(5.0, 10.0, 16.0);
    shadow = vec3(7.0, 6.0, 8.0);
    offset = 0.39;
  } else if (material == 70.0) {
    direction = vec2(0.030, 0.006);
    key = vec3(12.0, 8.0, 1.0);
    shadow = vec3(7.0, 4.0, 1.0);
    offset = 0.61;
  } else if (material == 73.0) {
    direction = vec2(0.022, -0.018);
    key = vec3(6.0, 7.0, 10.0);
    shadow = vec3(8.0, 7.0, 7.0);
    offset = 0.83;
  } else if (material == 82.0) {
    direction = vec2(0.031, 0.012);
    key = vec3(6.0, 12.0, 18.0);
    shadow = vec3(5.0, 7.0, 10.0);
    offset = 0.47;
  } else return vec3(0.0);
  float rollTriangle = 1.0 - abs(fract(dot(position, direction) + offset) * 2.0 - 1.0);
  float rollLobe = rollTriangle * rollTriangle * (3.0 - rollTriangle * 2.0);
  float shoulder = smoothstep(0.62, 0.92, rollLobe);
  float pocket = 1.0 - smoothstep(0.20, 0.50, rollLobe);
  float crownGain = shoulder * (0.58 + max(0.0, signedResponse) * 0.72) * depthT;
  float pocketGain = pocket * (0.62 + max(0.0, -signedResponse) * 0.48) * depthT;
  return (key * crownGain - shadow * pocketGain) / 255.0;
}
// Dense construction bodies use the existing signed macro relief plus the
// phase-local solid-depth byte. No topology, sample, field, texture, or
// uniform is added: exact edges, cavities, walls, traits, and emissive matter
// are excluded by the caller. The seven-byte source bound mirrors Canvas.
vec3 structuralRigidBulkDelta(float material, float signedResponse) {
  float crown = max(signedResponse, 0.0);
  float pocket = max(-signedResponse, 0.0);
  if (material == 22.0) return (vec3(7.0, 3.0, 1.0) * crown - vec3(6.0, 3.0, 2.0) * pocket) / 255.0;
  if (material == 23.0) return (vec3(2.0, 4.0, 7.0) * crown - vec3(3.0, 4.0, 6.0) * pocket) / 255.0;
  if (material == 25.0) return (vec3(2.0, 4.0, 6.0) * crown - vec3(2.0, 3.0, 5.0) * pocket) / 255.0;
  if (material == 67.0) return (vec3(1.0, 4.0, 6.0) * crown - vec3(3.0, 4.0, 5.0) * pocket) / 255.0;
  if (material == 70.0) return (vec3(7.0, 5.0, 0.0) * crown - vec3(6.0, 4.0, 1.0) * pocket) / 255.0;
  if (material == 73.0) return (vec3(3.0, 4.0, 6.0) * crown - vec3(4.0, 4.0, 5.0) * pocket) / 255.0;
  if (material == 82.0) return (vec3(2.0, 5.0, 7.0) * crown - vec3(3.0, 5.0, 6.0) * pocket) / 255.0;
  return vec3(0.0);
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
vec3 forceActivityDelta(float material, vec2 stateBytes, vec2 position) {
  if (material != 115.0 && material != 116.0) return vec3(0.0);
  float packedState = floor(stateBytes.x * 255.0 + 0.5)
    + floor(stateBytes.y * 255.0 + 0.5) * 256.0;
  if (mod(floor(packedState), 2.0) < 0.5) return vec3(0.0);
  vec2 local = mod(floor(position), 16.0);
  if (material == 115.0) {
    float centredY = abs(local.y - 8.0);
    float chevronDistance = abs(local.x - 5.0 - centredY);
    bool leadingChevron = local.x >= 5.0 && local.x <= 13.0
      && chevronDistance <= 1.0;
    bool wake = local.x >= 1.0 && local.x < 6.0
      && local.y >= 7.0 && local.y <= 9.0;
    return leadingChevron ? vec3(16.0, 11.0, -4.0) / 255.0
      : wake ? vec3(8.0, 5.0, -2.0) / 255.0 : vec3(0.0);
  }
  vec2 centred = local - 8.0;
  float radiusSquared = dot(centred, centred);
  return radiusSquared >= 25.0 && radiusSquared <= 49.0
    ? vec3(3.0, 10.0, 16.0) / 255.0
    : radiusSquared <= 4.0 ? vec3(-8.0, -5.0, 3.0) / 255.0 : vec3(0.0);
}
vec3 poloStateDelta(float material, vec2 stateBytes, vec2 position) {
  if (material != 109.0) return vec3(0.0);
  float packedState = floor(stateBytes.x * 255.0 + 0.5)
    + floor(stateBytes.y * 255.0 + 0.5) * 256.0;
  if (mod(floor(packedState / 2048.0), 2.0) < 0.5) return vec3(0.0);
  float emissions = mod(packedState, 8.0);
  float cooldown = mod(floor(packedState / 8.0), 16.0);
  float protonDose = mod(floor(packedState / 128.0), 16.0);
  vec2 world = floor(position);
  vec2 local = mod(world, 16.0);
  vec2 centred = local - 8.0;
  float radiusSquared = dot(centred, centred);
  vec3 delta = vec3(0.0);
  if (emissions >= 5.0) {
    bool ashFacet = mod(world.x + world.y * 3.0, 8.0) < 0.5;
    delta = ashFacet ? vec3(16.0, 7.0, 16.0) : vec3(10.0, 2.0, 13.0);
  } else if (cooldown > 0.0) {
    float boundedCooldown = min(15.0, cooldown);
    float heat = boundedCooldown / 15.0;
    float shellRadiusSquared = 16.0 + (15.0 - boundedCooldown) * 2.0;
    bool shell = abs(radiusSquared - shellRadiusSquared) <= 5.0;
    bool ray = centred.x == 0.0 || centred.y == 0.0
      || abs(centred.x) == abs(centred.y);
    delta = shell ? vec3(12.0 + heat * 4.0, 6.0 + heat * 5.0, -6.0 + heat * 2.0)
      : ray ? vec3(6.0 + heat * 4.0, 6.0 + heat * 3.0, -2.0)
      : vec3(1.0 + heat * 3.0, 2.0 + heat * 3.0, heat);
  } else {
    bool readyRing = radiusSquared >= 25.0 && radiusSquared <= 49.0;
    bool readyCore = radiusSquared <= 4.0;
    bool neutronRay = centred.x == 0.0 || centred.y == 0.0
      || abs(centred.x) == abs(centred.y);
    delta = readyRing ? vec3(7.0, 16.0, 9.0)
      : readyCore ? vec3(5.0, 12.0, 7.0)
      : neutronRay ? vec3(4.0, 10.0, 5.0) : vec3(2.0, 5.0, 3.0);
  }
  if (protonDose > 0.0) {
    float progress = min(10.0, protonDose) / 10.0;
    float filledHeight = ceil(progress * 12.0);
    bool captureRung = local.y >= 16.0 - filledHeight
      && mod(local.x + local.y, 4.0) <= 1.0;
    delta += progress * (captureRung ? vec3(10.0, -3.0, 7.0) : vec3(2.0, -1.0, 2.0));
  }
  return clamp(delta, vec3(-16.0), vec3(16.0)) / 255.0;
}
vec3 spongeHydrationDelta(float material, vec2 stateBytes, vec2 position) {
  if (material != 81.0) return vec3(0.0);
  float packedState = floor(stateBytes.x * 255.0 + 0.5)
    + floor(stateBytes.y * 255.0 + 0.5) * 256.0;
  if (mod(floor(packedState / 64.0), 2.0) < 0.5) return vec3(0.0);
  float hydration = min(50.0, mod(packedState, 64.0));
  if (hydration < 0.5) return vec3(0.0);
  float moisture = hydration / 50.0;
  vec2 world = floor(position);
  vec2 local = mod(world, 19.0);
  vec2 first = local - vec2(5.0);
  vec2 second = local - vec2(14.0, 12.0);
  float firstRadius = dot(first, first);
  float secondRadius = dot(second, second);
  bool poreCore = firstRadius <= 4.0 || secondRadius <= 3.0;
  bool firstWall = firstRadius >= 5.0 && firstRadius <= 12.0;
  bool secondWall = secondRadius >= 4.0 && secondRadius <= 10.0;
  bool litLip = (firstWall && first.x + first.y <= -2.0)
    || (secondWall && second.x + second.y <= -2.0);
  bool wetGlint = litLip && mod(world.x - world.y, 4.0) <= 1.0;
  vec3 delta = vec3(-16.0, -12.0, -5.0);
  if (wetGlint) delta += vec3(10.0, 16.0, 22.0);
  else if (poreCore) delta += vec3(-4.0, -2.0, 8.0);
  else if (firstWall || secondWall) delta += vec3(-2.0, 1.0, 6.0);
  return clamp(delta * moisture, vec3(-20.0), vec3(20.0)) / 255.0;
}
vec3 gelHydrationDelta(float material, vec2 stateBytes, vec2 position) {
  if (material != 56.0) return vec3(0.0);
  float packedState = floor(stateBytes.x * 255.0 + 0.5)
    + floor(stateBytes.y * 255.0 + 0.5) * 256.0;
  float hydration = min(100.0, mod(packedState, 128.0));
  if (hydration < 0.5) return vec3(0.0);
  float moisture = hydration / 100.0;
  vec2 world = floor(position);
  vec2 local = mod(world, 20.0) - 10.0;
  float radiusSquared = dot(local, local);
  bool swollenPocket = radiusSquared <= 18.0;
  bool membrane = radiusSquared >= 34.0 && radiusSquared <= 58.0;
  bool waterVein = mod(world.x * 3.0 - world.y * 2.0, 17.0) <= 1.0;
  bool upperLip = membrane && local.x + local.y <= -3.0
    && mod(world.x + world.y, 5.0) <= 1.0;
  vec3 delta = hydration * vec3(-223.0 / 120.0, -138.0 / 120.0, 208.0 / 120.0) * 0.62;
  if (swollenPocket) delta += vec3(-3.0, -2.0, 0.0) * moisture;
  else if (waterVein) delta += vec3(3.0, 4.0, 2.0) * moisture;
  if (upperLip) delta += vec3(6.0, 8.0, 2.0) * moisture;
  return clamp(delta, vec3(-124.0), vec3(124.0)) / 255.0;
}
vec3 quartzCrystalStateDelta(float material, vec2 stateBytes) {
  if (material != 29.0 && material != 76.0) return vec3(0.0);
  float packedState = floor(stateBytes.x * 255.0 + 0.5)
    + floor(stateBytes.y * 255.0 + 0.5) * 256.0;
  float speckle = min(10.0, mod(packedState, 16.0));
  float signedSeed = (speckle - 5.0) * 16.0;
  vec3 key = material == 76.0 ? vec3(0.29, 0.34, 0.47) : vec3(0.33, 0.31, 0.38);
  return clamp(signedSeed * key, vec3(-80.0), vec3(80.0)) / 255.0;
}
vec3 lcryStateDelta(vec3 color, vec2 stateBytes) {
  float packedState = floor(stateBytes.x * 255.0 + 0.5)
    + floor(stateBytes.y * 255.0 + 0.5) * 256.0;
  if (packedState < 32768.0) return vec3(0.0);
  float brightness = min(10.0, mod(packedState, 16.0));
  float gray = 80.0 + brightness * 16.0;
  return vec3(gray / 255.0) - color;
}
vec3 swchStateDelta(vec3 color, vec2 stateBytes) {
  float packedState = floor(stateBytes.x * 255.0 + 0.5)
    + floor(stateBytes.y * 255.0 + 0.5) * 256.0;
  bool present = packedState >= 32768.0;
  bool on = mod(packedState, 2.0) > 0.5;
  if (!present || !on) return vec3(0.0);
  vec3 styled = color * vec3(0.66, 0.82, 0.70) + vec3(16.0, 100.0, 42.0) / 255.0;
  return clamp(styled, 0.0, 1.0) - color;
}
vec3 pipePresentationDelta(vec3 color, float material, vec2 stateBytes) {
  float packedState = floor(stateBytes.x * 255.0 + 0.5)
    + floor(stateBytes.y * 255.0 + 0.5) * 256.0;
  float payload = mod(packedState, 256.0);
  bool loaded = mod(floor(packedState / 256.0), 2.0) > 0.5;
  float route = mod(floor(packedState / 512.0), 4.0);
  bool paused = material == 160.0 && mod(floor(packedState / 2048.0), 2.0) > 0.5;
  vec3 styled = color;
  if (loaded && payload > 0.5) {
    bool liquidPayload = payload == 2.0 || payload == 8.0 || payload == 11.0 || payload == 12.0
      || payload == 13.0 || payload == 16.0 || (payload >= 34.0 && payload <= 38.0)
      || payload == 63.0 || payload == 64.0 || payload == 71.0;
    bool gasPayload = payload == 4.0 || payload == 5.0 || payload == 15.0 || payload == 17.0
      || payload == 20.0 || (payload >= 39.0 && payload <= 42.0) || payload == 65.0
      || payload == 87.0 || payload == 101.0 || payload == 106.0 || payload == 107.0 || payload == 110.0;
    bool granularPayload = payload == 1.0 || payload == 6.0 || payload == 7.0 || payload == 14.0
      || payload == 18.0 || payload == 21.0 || payload == 28.0 || (payload >= 30.0 && payload <= 33.0)
      || (payload >= 84.0 && payload <= 88.0);
    vec3 target = liquidPayload ? vec3(58.0, 148.0, 192.0)
      : gasPayload ? vec3(160.0, 102.0, 210.0)
      : granularPayload ? vec3(202.0, 148.0, 66.0) : vec3(118.0, 166.0, 185.0);
    styled = mix(styled, target / 255.0, 0.42);
  } else if (loaded) {
    styled = mix(styled, vec3(144.0, 150.0, 160.0) / 255.0, 0.34);
  } else {
    vec3 routeTarget = route < 0.5 ? vec3(83.0, 122.0, 174.0)
      : route < 1.5 ? vec3(62.0, 167.0, 185.0)
      : route < 2.5 ? vec3(193.0, 139.0, 66.0) : vec3(168.0, 91.0, 184.0);
    styled = mix(styled, routeTarget / 255.0, 0.27);
  }
  if (paused) styled = styled * vec3(0.91, 0.93, 0.98) + vec3(9.0, 11.0, 16.0) / 255.0;
  return styled - color;
}
vec3 storStateDelta(vec3 color, vec2 stateBytes) {
  float packedState = floor(stateBytes.x * 255.0 + 0.5)
    + floor(stateBytes.y * 255.0 + 0.5) * 256.0;
  float payload = mod(packedState, 256.0);
  bool loaded = mod(floor(packedState / 256.0), 2.0) > 0.5;
  bool cooldown = mod(floor(packedState / 512.0), 2.0) > 0.5;
  if (!loaded && !cooldown) return vec3(0.0);
  vec3 styled = color;
  if (loaded && payload > 0.5) {
    bool liquidPayload = payload == 2.0 || payload == 8.0 || payload == 12.0;
    bool gasPayload = payload == 4.0 || payload == 5.0 || payload == 15.0;
    bool granularPayload = payload == 1.0 || payload == 6.0 || payload == 7.0;
    vec3 target = liquidPayload ? vec3(55.0, 187.0, 206.0)
      : gasPayload ? vec3(93.0, 169.0, 211.0)
      : granularPayload ? vec3(122.0, 177.0, 171.0) : vec3(69.0, 185.0, 198.0);
    styled = mix(styled, target / 255.0, 0.36);
  } else if (loaded) {
    styled = mix(styled, vec3(78.0, 177.0, 194.0) / 255.0, 0.30);
  }
  if (cooldown) styled = styled * vec3(0.95, 0.98, 1.02) + vec3(3.0, 5.0, 9.0) / 255.0;
  return clamp(styled, 0.0, 1.0) - color;
}
// DLAY's exact native life countdown is packed into the same B/A state word
// used by other native owners. Bit 15 differentiates a present idle DLAY from
// unrelated zero words, while semantic temperature supplies only its static
// native delay range; no clock or support decision is introduced.
vec3 dlayCountdownDelta(vec3 color, vec2 stateBytes, float temperatureNormalized) {
  float packedState = floor(stateBytes.x * 255.0 + 0.5)
    + floor(stateBytes.y * 255.0 + 0.5) * 256.0;
  if (packedState < 32768.0) return vec3(0.0);
  float countdown = mod(packedState, 32768.0);
  if (countdown < 0.5) return vec3(0.0);
  float temperatureKelvin = floor(temperatureNormalized * 255.0 + 0.5)
    * (65536.0 / 255.0 / 10.0);
  float configuredDelay = clamp(temperatureKelvin - 273.15, 1.0, 600.0);
  float elapsed = 1.0 - clamp(countdown / configuredDelay, 0.0, 1.0);
  vec3 styled = mix(color, vec3(236.0, 132.0, 66.0) / 255.0, 0.12 + elapsed * 0.32);
  return clamp(styled, 0.0, 1.0) - color;
}
vec3 wifiStateDelta(vec3 color, vec2 stateBytes) {
  float packedState = floor(stateBytes.x * 255.0 + 0.5)
    + floor(stateBytes.y * 255.0 + 0.5) * 256.0;
  if (packedState < 32768.0) return vec3(0.0);
  float channel = min(100.0, mod(packedState, 128.0)) / 100.0;
  bool wifiActive = mod(floor(packedState / 128.0), 2.0) > 0.5;
  vec3 target = vec3(76.0 + channel * 156.0, 184.0 - channel * 82.0,
    224.0 - channel * 134.0) / 255.0;
  vec3 styled = mix(color, target, wifiActive ? 0.50 : 0.28);
  if (wifiActive) styled += vec3(8.0, 14.0, 18.0) / 255.0;
  return clamp(styled, 0.0, 1.0) - color;
}
// FILT's all-zero ctype is an upstream temperature-generated wavelength mask,
// not a black spectrum. Reconstruct Kelvin from materialTemperature's
// normalized semantic byte with the calibrated 16-bit range conversion for the
// same five-bit wavelength-band reconstruction.
vec3 filtSpectrumDelta(vec3 color, vec2 stateBytes, float temperatureNormalized) {
  float packedState = floor(stateBytes.x * 255.0 + 0.5)
    + floor(stateBytes.y * 255.0 + 0.5) * 256.0;
  if (packedState < 32768.0) return vec3(0.0);
  float red = mod(packedState, 16.0);
  float green = mod(floor(packedState / 16.0), 16.0);
  float blue = mod(floor(packedState / 256.0), 16.0);
  float life = mod(floor(packedState / 4096.0), 8.0);
  if (red + green + blue < 0.5) {
    float temperatureKelvin = floor(temperatureNormalized * 255.0 + 0.5)
      * (65536.0 / 255.0 / 10.0);
    float band = clamp(floor((temperatureKelvin - 273.0) * 0.025), 0.0, 25.0);
    red = clamp(min(band + 5.0, 30.0) - max(band, 18.0), 0.0, 5.0);
    green = clamp(min(band + 5.0, 21.0) - max(band, 9.0), 0.0, 5.0);
    blue = clamp(min(band + 5.0, 12.0) - max(band, 0.0), 0.0, 5.0);
  }
  float scale = 624.0 / (red + green + blue + 1.0);
  float reveal = 0.50 + min(4.0, life) * 0.11;
  return mix(color, vec3(red, green, blue) * scale / 255.0, reveal) - color;
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
float powderSurfaceBulkSupport(vec2 uv, float material) {
  // Preserve the exact-owner route for narrow but valid homogeneous bodies.
  // The field route is intentionally wider and is only the compatibility
  // fallback that lets separately owned settled powders share their exterior.
  return max(
    sameMaterial(uv, material),
    smoothstep(0.18, 0.42, powderSurfaceShape(uv).x)
  );
}
float powderSurfaceBulkDepth(vec2 uv, float material, float surfaceOnly) {
  vec2 cell = (floor(uv * uFieldSize) + 0.5) * uTexel;
  if (cell.x < uTexel.x * 1.5 - 0.000001
    || cell.x > 1.0 - uTexel.x * 1.5 + 0.000001) return 0.0;
  float requiredDepth = surfaceOnly > 0.5 ? 3.0 : 2.0;
  float lastCellY = 1.0 - uTexel.y * 0.5;
  if (cell.y + uTexel.y * requiredDepth > lastCellY + 0.000001) return 0.0;
  // The shared field's density contains *only* settled powder.  It is thus a
  // stronger and more relevant depth proof than exact material equality here:
  // adjacent settled Sand/Clay/Concrete may form one curved outer body, while
  // owner selection and every interior material seam remain semantic/local.
  // This deliberately does not promote solids, liquid, gas, walls, moving
  // powder, sparse columns, or holes; those cannot meet the dense vertical and
  // lateral settled-powder proof below.
  float bulk = powderSurfaceBulkSupport(cell + vec2(0.0, uTexel.y), material)
    * powderSurfaceBulkSupport(cell + vec2(0.0, uTexel.y * 2.0), material);
  if (surfaceOnly > 0.5) {
    bulk *= powderSurfaceBulkSupport(cell + vec2(0.0, uTexel.y * 3.0), material);
  }
  vec2 anchor = cell + vec2(0.0, surfaceOnly > 0.5 ? uTexel.y : 0.0);
  bulk *= max(
    powderSurfaceBulkSupport(anchor - vec2(uTexel.x, 0.0), material),
    powderSurfaceBulkSupport(anchor + vec2(uTexel.x, 0.0), material)
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
float solidDeepInteriorMicroGain(float optics, float profile) {
  // Once the existing exact-species thickness field proves a genuinely broad
  // body, preserve the macro optical relief over cell-scale albedo. This is an
  // arithmetic-only complement to the Canvas depth ramp; no contour, support,
  // or material selection reads this value.
  if (granularOptics(optics) > 0.5 || profile == 1.0) return 1.0;
  // Thick rigid bodies still need a little retained authored material
  // variation after their depth/crown pass. This is deliberately below the
  // normal interior gain, so it adds body character without restoring a
  // cell-grid overlay or touching density, alpha, or topology.
  if (optics == 8.0 || optics == 19.0 || (optics < 0.5 && profile == 2.0)) return 0.34;
  if (optics == 9.0 || (optics < 0.5 && profile == 3.0)) return 0.44;
  if (optics == 10.0 || (optics < 0.5 && profile == 5.0)) return 0.30;
  if (optics == 11.0 || (optics < 0.5 && profile == 4.0)) return 0.50;
  if (optics == 12.0) return 0.30;
  return 0.52;
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
      * smoothstep(0.004, 0.027, abs(widePowderShape.z))
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
  // Carry the signed emission key/fill scalar out of the guarded four-sample
  // branch. The aura branch below must not retain individual branch-local
  // samples on the true-8x fragment path.
  float emissionDirectional = 0.0;
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
    // Same directional basis as Canvas: the broad volume receives a cool
    // upper-left key and an opposing fill from its already-sampled field mass.
    emissionDirectional = (lightLeft - lightRight) * 0.16
      + (lightBottom - lightTop) * 0.22;
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
  // E06 carries only the smallest three scalars from the strict settled-body
  // proof to the terminal field-light compositor. Keeping the existing centre
  // emission sample there avoids another texture read or a branch-local GLSL
  // value escaping its scope.
  float powderLightBodyGate = 0.0;
  float powderLightBodyDepth = 0.0;
  float powderLightBodySlope = 0.0;
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
    // Reuse the four aura samples already needed by the analytic normal. This
    // is the same signed curvature/key-fill response as Canvas, bounded to
    // twenty-four source bytes before channel headroom. Applying the negative
    // pocket through available body colour keeps it visible after translucent
    // compositing instead of quantising a long aura row into bright-only dots.
    // A positive key borrows a restrained amount of the already-sampled aura
    // spectrum instead of pulling a saturated Fire/Plasma/Elec volume toward
    // white. This normal-compositor-only arithmetic leaves the compact true-8x
    // path untouched. It changes RGB only: alpha, support, topology, and 8x
    // resources remain exactly as they were.
    float emissionCurvature = (volume - emissionNeighbourMean) * 0.28;
    float emissionVolumeTone = clamp(
      (emissionDirectional + emissionCurvature) * (0.42 + volume * 0.58),
      -24.0 / 255.0, 24.0 / 255.0
    ) * uEmissionVolumeChroma;
    vec3 emissionHeadroom = emissionVolumeTone >= 0.0
      ? vec3(1.0) - clamp(color, 0.0, 1.0)
      : clamp(color, 0.0, 1.0);
    float emissionHuePeak = max(max(emissionState.r, emissionState.g), emissionState.b);
    vec3 emissionKeySpectrum = emissionState.rgb / max(emissionHuePeak, 0.0001);
    vec3 emissionKeyWeight = emissionVolumeTone >= 0.0
      ? mix(vec3(1.0), emissionKeySpectrum, 0.34)
      : vec3(1.0);
    color += emissionHeadroom * emissionKeyWeight * emissionVolumeTone;
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
    // Dense Energy owns a continuous luminous body rather than the individual
    // palette colours of its carriers. Converge only the already-proven core
    // toward the straight, field-owned emission RGB; sparse PHOT and gaps have
    // zero cohesive support and therefore retain their exact semantics. The
    // existing core-relief control makes this RGB-only convergence auditable in
    // the same off-on-off capture, without adding a sample, field, or pass.
    float energyFieldChroma = cohesiveEnergy * (0.08 + core * 0.08) * uEnergyCoreRelief;
    vec3 cohesiveEnergyBase = mix(energyBase, emissionState.rgb, energyFieldChroma);
    float cohesiveCarrierDetail = mix(
      carrierDetail,
      1.0 + flowWave * 0.022 + pulse * 0.018,
      // Once the shared emission field proves a dense body, its broad flow is
      // the only remaining carrier variation. This is RGB-only: semantic
      // alpha, sparse-particle topology, and field support remain unchanged.
      cohesiveEnergy
    );
    float semanticAlpha = smoothstep(0.18, 0.72, density)
      * mix(0.58 + pulse * 0.08, 0.94, core)
      * mix(1.0, carrierDetail, edge * 0.55);
    float cohesiveAlpha = smoothstep(0.10, 0.58, density) * mix(0.72, 0.96, core);
    alpha = mix(semanticAlpha, cohesiveAlpha, cohesiveEnergy * 0.72);
    color = cohesiveEnergyBase * (1.05 + core * 0.48 + heat * 0.30) * cohesiveCarrierDetail;
    color += auraTint * edge * (0.20 + pulse * 0.16);
    color += mix(vec3(1.0, 0.72, 0.42), vec3(0.72, 0.90, 1.0), radioactiveCarrier)
      * core * (0.10 + pulse * 0.08);
    // Dense exact carriers share the already available low-frequency flow
    // signal as one hue-preserving radiance body. Sparse particles remain
    // exact, and this adds no texture read, field, pass, or alpha change.
    // A second continuous lobe crosses the small canonical core probe even
    // when its carrier flow happens to be locally level. It is deliberately
    // smooth in world space (not a cell motif) and shares the same dense-field
    // gate, so an isolated photon remains an exact discrete particle.
    float energyBodyLobe = sin(
      fieldPosition.x * 0.38 + fieldPosition.y * 0.24 + material * 0.73
    );
    float energySurfaceRelief = (diffuse - 0.93) * 0.28 * mix(0.20, 1.0, edge);
    float energyRelief = clamp(
      (flowWave * 0.065 + energyBodyLobe * 0.055) * cohesiveEnergy + energySurfaceRelief,
      -0.10, 0.10
    );
    color *= 1.0 + energyRelief * uEnergyCoreRelief;
    // A cohesive energy body has no hard boundary, but its dense shoulder can
    // catch a small luminous corona. Reuse the already-live density edge,
    // directional light, and radioactive carrier tint; sparse PHOT has zero
    // cohesive support, while alpha/support and the field-owned aura remain
    // exactly untouched.
    float energyCorona = cohesiveEnergy * edge * smoothstep(0.96, 1.12, diffuse) * 0.035;
    vec3 energyCoronaTint = mix(vec3(1.0, 0.68, 0.36), vec3(0.62, 0.86, 1.0), radioactiveCarrier);
    color += (vec3(1.0) - clamp(color, 0.0, 1.0))
      * energyCoronaTint * energyCorona * uEnergyCoreRelief;
    // Dense supported energy is one body, not a screen of independently
    // flashing carrier pixels. Retain exact identity at the sparse edge while
    // letting the existing broad flow/pulse relief own the dense core. Apply
    // the bounded shoulder only after identity composition: applying it twice
    // compresses legitimate low-frequency body relief below a framebuffer byte.
    float energyIdentityGain = mix(1.0, 0.35, cohesiveEnergy);
    vec3 energyComposed = max(
      color + energyIdentityDelta(material, fieldPosition, uTime, velocity)
        * energyIdentityGain * uEnergyIdentityStyling,
      vec3(0.0)
    );
    color = mix(
      energyComposed,
      toneMapEnergy(energyComposed),
      smoothstep(0.08, 0.68, core)
    );
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
    // A dense field-owned cloud scatters colour through its own volume. Lightly
    // compress only its interior chroma before the existing family identity
    // accents are layered: mixed billows read as one soft body instead of hard
    // semantic colour lobes, while sparse chains and species colour remain
    // legible. Keep that neutralisation below the old cap: a fully field-owned
    // coloured cloud should still read as translucent material rather than a
    // uniformly grey volume. This is RGB-only arithmetic over already-live
    // field state.
    float gasInteriorScatter = gasInterior * smoothstep(0.10, 0.60, gasShadeDensity);
    float gasBaseLuminance = dot(gasBase, vec3(0.2126, 0.7152, 0.0722));
    float gasNeutralMix = gasInteriorScatter * 0.085;
    gasBase = mix(gasBase, vec3(gasBaseLuminance), gasNeutralMix);
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
    // Once the shared atmosphere field proves a dense cloud, it owns the
    // displayed mass and silhouette. Leaving even a small semantic-particle
    // alpha there makes a normal-scale plume read as a cellular checker. Fade
    // only that accent: sparse carriers and authored field gaps keep their
    // exact semantic alpha, while cloudAlpha remains field-owned and unchanged.
    float semanticAccentOwnership = 1.0 - smoothstep(0.020, 0.160, atmosphereState.a);
    float semanticAccentAlpha = particleAlpha * semanticAccentShare * semanticAccentOwnership;
    alpha = cloudOnly > 0.5
      ? cloudAlpha
      : cloudAlpha + semanticAccentAlpha * (1.0 - cloudAlpha);
    // Beer-like optical depth keeps the core saturated and translucent while a
    // directional silver lining gives the boundary volume without a hard edge.
    // The Canvas volume keeps a broad, soft midtone through a dense billow.
    // Retain that readable body in the normal WebGL compositor as well: the
    // prior core/transverse pair compounded to a markedly darker cloud on the
    // black world backdrop, even though alpha and atmosphere mass agreed.
    // This is deliberately RGB-only and stays below the Canvas body exposure;
    // alpha/support continue to be owned exclusively by the field above.
    float gasCoreTransmission = 0.85 + cleanGas * 0.06 - sootyGas * 0.10;
    float gasScatter = 0.32 + cleanGas * 0.09 - sootyGas * 0.06;
    color = gasBase * mix(1.08 + cleanGas * 0.04, gasCoreTransmission, opticalDepth)
      * (0.82 + diffuse * 0.23) * billow;
    // A field-owned mid-density scatter band keeps a deep cloud luminous enough
    // to read as a volume rather than a uniformly dark blur. It deliberately
    // peaks between the transparent rim and opaque core, reuses only values
    // already live in this branch, and changes RGB—not alpha, support, material
    // ownership, field reconstruction, or the Canvas recovery path.
    // Give the field-owned middle density one more restrained scattering lift.
    // It makes a cloud read as translucent volume against the dark world while
    // the existing optical-depth and alpha paths remain the sole owners of
    // mass, gaps, and silhouette. Keep sooty Smoke slightly less reflective.
    float gasForwardScatter = opticalDepth * (1.0 - opticalDepth)
      * (0.085 + cleanGas * 0.020 - sootyGas * 0.008);
    vec3 gasForwardColor = mix(vividColor(gasBase, 1.06), vec3(0.62, 0.76, 0.92),
      0.18 + cleanGas * 0.14);
    color += (vec3(1.0) - clamp(color, 0.0, 1.0)) * gasForwardColor
      * gasForwardScatter * (0.65 + diffuse * 0.35);
    color *= 1.0 + gasCrown * 0.21 - gasPocket * 0.13;
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
    // Canvas already turns this field-derived gradient/curvature pair into a
    // broad billow shade. Give normal WebGL the same restrained crown/pocket
    // exposure after its hue response: this reuses only live RGB inputs, so
    // alpha, atmosphere support, sparse gaps, and direct-8x stay untouched.
    float gasVolumeExposure = clamp(
      gasDirectionalRelief * 0.075 + gasCurvature * 0.035, -0.055, 0.055
    ) * smoothstep(0.025, 0.50, gasShadeDensity)
      * (1.0 - opticalDepth * 0.30) * uGasVolumeChroma;
    color *= 1.0 + gasVolumeExposure;
    // E04: turn the existing field normal and curvature into a readable
    // connected billow without inventing particle-scale noise. The shared
    // atmosphere remains the sole owner of mass, colour mixture, support, and
    // alpha. This normal-detail experiment adds only bounded RGB arithmetic:
    // no sample, field, target, pass, clock, or output-scale resource.
    if (uGasBodyVfx > 0.5) {
      float gasVfxSupport = smoothstep(0.002, 0.050, gasShadeDensity)
        * mix(0.60, 1.0, gasInterior);
      float gasVfxShoulder = 1.0 - smoothstep(0.24, 0.56, gasShadeDensity);
      float gasVfxCrown = gasVfxShoulder
        * smoothstep(0.003, 0.040, gasShadeDensity)
        * smoothstep(0.68, 1.02, diffuse);
      // Three long, incommensurate world-space waves form a stable macro/meso
      // billow basis. It is deliberately independent of uTime and is admitted
      // only after the atmosphere field proves connected body ownership, so it
      // cannot turn semantic carriers into moving dots or animate an authored
      // gap. Wavelengths remain tens of cells at every output scale.
      float gasVfxWaveA = sin(dot(fieldPosition, vec2(0.055, 0.031)) + 0.80);
      float gasVfxWaveB = sin(dot(fieldPosition, vec2(-0.029, 0.081)) + 2.15);
      float gasVfxWaveC = sin(dot(fieldPosition, vec2(0.097, -0.043)) + 4.05);
      float gasVfxBillow = clamp(
        gasVfxWaveA * 0.50 + gasVfxWaveB * 0.31 + gasVfxWaveC * 0.19,
        -1.0, 1.0
      );
      float gasVfxBodySupport = smoothstep(0.090, 0.32, gasShadeDensity)
        * gasInterior * (1.0 - opticalDepth * 0.35);
      float gasVfxKey = min(
        0.180,
        (gasVfxCrown * 0.120
          + max(gasDirectionalRelief, 0.0) * (0.095 + gasVfxShoulder * 0.085)
          + max(gasCurvature, 0.0) * (0.090 + gasVfxShoulder * 0.045)
          + gasForwardScatter * 0.68 + silverLining * 0.140)
          * gasVfxSupport * (1.0 - opticalDepth * 0.20)
          + max(gasVfxBillow, 0.0) * gasVfxBodySupport * 0.055
      );
      float gasVfxPocket = min(
        0.065,
        (max(-gasDirectionalRelief, 0.0) * (0.020 + gasVfxShoulder * 0.030)
          + max(-gasCurvature, 0.0) * (0.032 + opticalDepth * 0.040)
          + gasVfxShoulder * (1.0 - smoothstep(0.48, 0.76, diffuse)) * 0.022)
          * gasVfxSupport
          + max(-gasVfxBillow, 0.0) * gasVfxBodySupport * 0.040
      );
      vec3 gasVfxTint = mix(vec3(0.44, 0.68, 1.00), vividColor(gasBase, 1.12), 0.62);
      color += (vec3(1.35) - clamp(color, 0.0, 1.35))
        * gasVfxTint * gasVfxKey;
      color *= 1.0 - gasVfxPocket;
    }
    if (uGasIdentityStyling > 0.5) {
      float gasIdentityStyle = floor(
        texture(uAtmosphereStyleTexture, fieldUv).r * 255.0 + 0.5
      );
      if (uGasVolumeChroma > 0.5 && gasIdentityStyle > 6.5 && gasIdentityStyle < 7.5) {
        float gasIdentityChromaSupport = smoothstep(0.012, 0.030, atmosphereState.a);
        vec3 nobleGasChroma = gasIdentityVolumeChroma(gasIdentityStyle, gasChroma)
          * gasIdentityChromaSupport;
        // Positive violet key remains inside framebuffer headroom; the small
        // green fill is deliberately subtractive. No support/alpha decision
        // reads this presentation-only species term.
        color += (vec3(1.0) - clamp(color, 0.0, 1.0)) * max(nobleGasChroma, vec3(0.0))
          + min(nobleGasChroma, vec3(0.0));
      }
      color += gasIdentityVolumeDelta(
        gasIdentityStyle, material, fieldPosition, gasShadeDensity,
        gasDirectionalRelief, gasCurvature * 0.125
      );
    }
    // Native WARP is deliberately near-black, but a field-owned gas carries
    // low presentation alpha over AniforTPT's dark world. Its canonical colour
    // can therefore collapse into the backdrop even when semantic ownership
    // and atmosphere support are correct. Keep one exact-owner violet floor in
    // RGB only: it does not brighten neighbouring gases, alter the propagated
    // field, or claim coverage, and the existing gas alpha remains authoritative.
    if (material == 114.0) color = max(color, vec3(0.115, 0.075, 0.155));
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
    // Keep broad-liquid light legible at normal zoom without producing a row
    // of vertical bands across a still pool. Two oblique, low-frequency
    // directions make the existing procedural sheen read as a reflected
    // volume; this replaces the old near-vertical carrier and costs the same
    // two analytic waves (no texture, field, pass, or semantic change).
    float broadSheen = 0.5 + 0.5
      * sin(fieldPosition.x * 0.031 + fieldPosition.y * 0.023 + material * 0.83 + uTime * 0.20)
      * sin(fieldPosition.y * 0.043 - fieldPosition.x * 0.019 - uTime * 0.13);
    float causticWave = 0.5 + 0.5 * sin(
      fieldPosition.x * 0.061 + fieldPosition.y * 0.021
      + sin(fieldPosition.y * 0.051 - fieldPosition.x * 0.024 + uTime * 0.11) * 1.28
      + material * 0.67
    );
    float caustic = pow(causticWave, 6.0) * liquidDepth;
    // Reuse the existing analytic sheen and caustic signals as a centred,
    // low-frequency body relief. Optics alter only the gain: Water carries a
    // soft caustic, Oil a broader sheen, Acid a restrained sharper response,
    // and self-luminous Lava keeps the weakest reflected modulation. This is
    // RGB-only and field-depth-gated, so sparse droplets, species seams, and
    // reconstructed support remain authoritative.
    // Water is deliberately calmer than the other liquid families. Its body
    // gets depth, meniscus, transmission, and reflection below, so a strong
    // procedural wave here reads as zebra striping rather than moving water.
    // Keep the field-visible response, but reserve the larger motif gains for
    // oil, corrosives, metallic liquids, and viscous matter.
    float macroSheenGain = 0.040 + aqueous * 0.095 + oily * 0.085
      + corrosive * 0.225 - molten * 0.015 + cryogenic * 0.06
      + metallicLiquid * 0.15 + viscousLiquid * 0.11;
    float macroCausticGain = 0.035 + aqueous * 0.105 - oily * 0.025
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
    float depthTransmission = 0.66 + aqueous * 0.14 - oily * 0.10
      + corrosive * 0.04 - molten * 0.15 + cryogenic * 0.14
      - metallicLiquid * 0.18 - viscousLiquid * 0.10;
    float gloss = 1.0 + aqueous * 0.18 + oily * 0.30
      + corrosive * 0.12 - molten * 0.20 + cryogenic * 0.24
      + metallicLiquid * 0.55 + viscousLiquid * 0.18;
    float causticStrength = 0.085 + aqueous * 0.055 - oily * 0.045
      + corrosive * 0.025 - molten * 0.055 + cryogenic * 0.04
      - metallicLiquid * 0.07 - viscousLiquid * 0.03;
    float liquidBodyExposure = 1.0 + aqueous * 0.045 - oily * 0.10
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
      // Sparse one-cell strands retain the established 0.82 trim bound. A
      // broad shore has the same four already-sampled field neighbours proving
      // dense support, so it can reach the visibly cohesive 0.96 response
      // without letting that response escape into the protected strand.
      float liquidCohesionStrength = mix(
        0.82, 0.96, smoothstep(0.56, 0.78, liquidNeighbourMean)
      );
      liquidSilhouetteDensity = mix(
        // The density-gated cap keeps a connected one-cell strand inside the audited
        // <= 2 RGB-RMS continuity response while retaining a visible but
        // non-expanding cohesion trim after canonical framebuffer quantisation.
        volume, connectedFieldDensity, liquidAirContour * liquidCohesionStrength
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
    // Oil's darker body can make the signed interface relief read only as a
    // shadow. Add a tiny, capped post-body rim for the already-proven Oil
    // interface so both sides remain legible. This is RGB-only and reuses the
    // existing contact, field, depth, and Fresnel terms.
    if (uLiquidFieldLighting > 0.5 && liquidOnly < 0.5 && halo < 0.5
      && wall < 0.5 && family == 2.0 && traits < 0.5 && !materialEmissive
      && molten < 0.5 && foreignMatterContact < 0.5 && unlikeMaterialContact > 0.5
      && liquidDepth > 0.38 && liquidNeighbourMean > 0.48 && oily > 0.5) {
      float oilInterfaceRim = min(
        0.052, min(abs(liquidInterfaceRelief), 0.12) * liquidDepth * 0.85
      );
      color += (vec3(1.0) - clamp(color, 0.0, 1.0))
        * liquidFresnelKey * oilInterfaceRim;
    }
    float liquidFresnelStrength = liquidFresnelGate
      * (liquidFresnelKeyResponse + liquidFresnelTransmissionResponse)
      * 0.75 * (1.0 + aqueous * 0.65 + oily * 0.35 + cryogenic * 0.25
        + metallicLiquid * 0.40 + viscousLiquid * 0.10);
    color += (vec3(1.0) - clamp(color, 0.0, 1.0))
      * liquidFresnelKey * liquidFresnelStrength;
    color += mix(reflectedEnvironment, edgeTint, 0.42)
      * liquidFresnelStrength * (0.18 + aqueous * 0.06 + oily * 0.04);
    // Water's broad body needs a continuous, sky-facing top shoulder at fit
    // view. Reuse the existing connected top lip, Fresnel, and low-frequency
    // sheen rather than a new wave, field, or alpha decision. Oil/Acid/Lava,
    // species seams, droplets, and reconstructed support remain on their
    // established paths; this is a bounded RGB-only aqueous refinement.
    if (uAqueousSurfaceReflection > 0.5 && aqueous > 0.5) {
      float aqueousSurfaceReflection = aqueous * topLip
        * (0.026 + broadSheen * 0.024 + fresnel * 0.016);
      color += (vec3(1.0) - clamp(color, 0.0, 1.0))
        * vec3(0.30, 0.74, 1.00) * aqueousSurfaceReflection;
      // A true Water core gets a small submerged volume response in addition
      // to the shared aqueous surface. Keep this stricter than the surface
      // cue: distilled/salt water retain their native identity, and shores,
      // droplets, seams, walls, traits, and reconstructed support stay exact.
      // It is RGB-only arithmetic over existing depth/Fresnel/field terms.
      if (material == 2.0 && liquidOnly < 0.5 && halo < 0.5 && wall < 0.5
        && traits < 0.5 && !materialEmissive && foreignMatterContact < 0.5
        && unlikeMaterialContact < 0.5
        && dot(liquidSpeciesSlope, liquidSpeciesSlope) < 0.0025
        && liquidDepth > 0.48 && liquidNeighbourMean > 0.56) {
        float aqueousCoreVolume = liquidDepth * (1.0 - liquidFresnelContour)
          * smoothstep(0.56, 0.86, liquidNeighbourMean);
        // Connected normal-detail Water needs a little more depth separation
        // than the compact 8x path: at fit view this makes the submerged core
        // recede behind its blue transmission instead of reading as one opaque
        // cyan plate. All eligibility and support are already proven above.
        color *= vec3(1.0) - vec3(0.082, 0.050, 0.024) * aqueousCoreVolume;
        float aqueousCoreGlaze = aqueousCoreVolume
          * (0.010 + broadSheen * 0.014 + caustic * 0.008);
        color += (vec3(1.0) - clamp(color, 0.0, 1.0))
          * vec3(0.16, 0.52, 0.86) * aqueousCoreGlaze;
      }
    }
    // Acid shares the dense-liquid body proof with Water, but it should not
    // inherit Water's sky-blue submerged glaze. Reuse the already-live depth,
    // Fresnel contour, sheen, and caustic terms for a small luminance-neutral
    // corrosive chroma shift instead. No sampler, field, alpha, support, or
    // species decision is added; shores, droplets, seams, walls, traits, and
    // emissive owners remain on their exact generic paths.
    if (uLiquidVolumeChroma > 0.5 && material == 16.0
      && liquidOnly < 0.5 && halo < 0.5 && wall < 0.5
      && traits < 0.5 && !materialEmissive && foreignMatterContact < 0.5
      && unlikeMaterialContact < 0.5 && liquidDepth > 0.48 && liquidNeighbourMean > 0.56) {
      float acidCoreVolume = liquidDepth * (1.0 - liquidFresnelContour)
        * smoothstep(0.56, 0.86, liquidNeighbourMean);
      float acidCoreGlaze = acidCoreVolume
        * (0.020 + broadSheen * 0.045 + caustic * 0.025);
      // Rec.709 luma is approximately zero for this vector. It makes the
      // existing magenta acid body read as denser, reactive material instead
      // of manufacturing a false light source in its interior.
      color += vec3(0.28, -0.15, 0.65) * acidCoreGlaze;
    }
    color -= color * liquidFresnelGate * (
      liquidFresnelShadow * liquidFresnelShadowResponse
      + liquidFresnelAbsorption * liquidFresnelAbsorptionResponse
    );
    color *= 1.0 + topLip * 0.08 - lowerShade * 0.05;
    color += mix(vec3(0.52, 0.68, 0.76), liquidBase, 0.50)
      * (broadSheen * mix(0.016, 0.052 * gloss, liquidDepth) + caustic * causticStrength);
    color += liquidBase * (0.025 + atmosphere * 0.030) + vec3(0.055, 0.090, 0.105) * rim;
    // Lava's wide glow is deliberately left to the shared emission field, so
    // it never feeds light back into its own body. Its dense, exact liquid
    // interior can still use the already-live field support, low-frequency
    // convection waves, and top lip for a restrained molten ridge/pocket read.
    // This is RGB-only and excludes every shore, droplet, hole, native wall,
    // trait, emissive owner, and cross-material contact.
    if (uMoltenBodyOptics > 0.5 && uLiquidFieldLighting > 0.5
      && molten > 0.5 && material == 11.0
      && liquidOnly < 0.5 && halo < 0.5 && surfaceOnly < 0.5
      && wall < 0.5 && family == 2.0 && traits < 0.5 && !materialEmissive
      && foreignMatterContact < 0.5 && unlikeMaterialContact < 0.5
      && liquidDepth > 0.48 && liquidNeighbourMean > 0.56) {
      float moltenBodySupport = smoothstep(0.48, 0.90, liquidDepth)
        * smoothstep(0.56, 0.88, liquidNeighbourMean);
      float moltenConvection = mix(broadSheen, causticWave, 0.58);
      float moltenRidge = smoothstep(0.64, 0.94, moltenConvection);
      float moltenPocket = 1.0 - smoothstep(0.23, 0.53, moltenConvection);
      float moltenTopShoulder = topLip * (0.022 + surfaceSpecular * 0.030);
      color *= vec3(1.0) - vec3(0.072, 0.034, 0.010)
        * moltenPocket * moltenBodySupport;
      color += (vec3(1.0) - clamp(color, 0.0, 1.0))
        * vec3(1.00, 0.34, 0.055)
        * (moltenRidge * 0.058 + moltenTopShoulder) * moltenBodySupport;
    }
    // Family-coloured chroma and vertical optical depth share exact cohesive
    // liquid eligibility, but remain independently switchable. All inputs are
    // already live for body lighting; this adds arithmetic only and cannot
    // change alpha, reconstruction support, species ownership, or refraction.
    if (liquidOnly < 0.5 && halo < 0.5
      && wall < 0.5 && family == 2.0 && traits < 0.5 && !materialEmissive
      && molten < 0.5 && foreignMatterContact < 0.5 && unlikeMaterialContact < 0.5
      && liquidDepth > 0.38 && liquidNeighbourMean > 0.48) {
      // The species field supplies a wider interface band than the exact
      // categorical contact flag. Keep that entire mixing meniscus neutral so
      // adjacent family keys cannot flicker as either liquid moves by one cell.
      if (dot(liquidSpeciesSlope, liquidSpeciesSlope) < 0.0025) {
        if (uLiquidVolumeChroma > 0.5) {
          float liquidVolumeChroma = liquidVolumeChromaResponse(
            liquidDepth, volumeSlope, liquidDensity, liquidNeighbourMean, liquidMacroRelief
          );
          color = applyLiquidVolumeChroma(color, liquidVolumeChroma, optics);
        }
        if (uLiquidOpticalDepth > 0.5) {
          color = applyLiquidOpticalDepth(color, optics, liquidOpticalDepth);
        }
        // E03: one exact connected species receives a stable reflected surface
        // and true column-depth attenuation. The first exact-species row has
        // zero vertical depth, while each row below adds six bytes in the
        // existing auxiliary plane; that gives the body a surface/core grammar
        // without deriving depth from screen position or widening its alpha.
        // Reconstructed support, droplets, seams, walls, traits, foreign
        // contacts, and molten matter were rejected by the enclosing guards.
        if (uLiquidBodyVfx > 0.5
          && dot(liquidSpeciesSlope, liquidSpeciesSlope) < 0.0004) {
          float liquidVfxBody = smoothstep(0.48, 0.90, liquidDepth)
            * smoothstep(0.56, 0.90, liquidNeighbourMean);
          float liquidVfxColumn = smoothstep(
            6.0 / 255.0, 30.0 / 255.0, liquidOpticalDepth
          ) * liquidVfxBody * (1.0 - liquidFresnelContour);
          float liquidVfxAbsorptionGain = 0.090 + oily * 0.075
            + corrosive * 0.008 + cryogenic * 0.010
            + metallicLiquid * 0.025 + viscousLiquid * 0.018;
          vec3 liquidVfxAbsorption = mix(
            vec3(0.70), liquidFresnelAbsorption, 0.58
          );
          // Beer-Lambert transmittance remains family coloured and monotone in
          // the exact vertical optical depth. It is consumed immediately so
          // the already-large normal shader does not retain another live field.
          color *= exp(
            -liquidVfxAbsorption * liquidVfxColumn * liquidVfxAbsorptionGain
          );
          float liquidVfxExposedTop = smoothstep(0.015, 0.16, topLip)
            * (1.0 - smoothstep(0.0, 18.0 / 255.0, liquidOpticalDepth));
          float liquidVfxSurface = min(
            0.078,
            max(
              liquidFresnelContour * (
                0.030 + max(liquidFresnelDirectional, 0.0) * 0.048
                  + liquidFresnelGrazing * 0.018
              ),
              liquidVfxExposedTop
                * (0.052 + surfaceSpecular * 0.026 + fresnel * 0.012)
            )
          ) * (1.0 - liquidVfxColumn * 0.88)
            * mix(0.74, 1.0, liquidVfxBody);
          color += (vec3(1.35) - clamp(color, 0.0, 1.35))
            * mix(liquidFresnelKey, edgeTint, 0.18) * liquidVfxSurface;
        }
      }
    }
    // Twenty ordinary, unusual, metallic, cryogenic, and radioactive liquids retain a world-anchored material signature
    // after generic body optics. The authoritative semantic fragment is the
    // only owner: reconstructed support, walls, halos, and emissive projections
    // remain exact. This changes RGB only and adds no sample or resource.
    if (uLiquidIdentityStyling > 0.5 && liquidOnly < 0.5 && halo < 0.5
      && surfaceOnly < 0.5 && wall < 0.5 && emissionOnly < 0.5
      && family == 2.0 && !materialEmissive
      && (material == 34.0 || material == 35.0 || material == 36.0 || material == 37.0 || material == 58.0 || material == 95.0
        || material == 38.0 || (material >= 54.0 && material <= 57.0)
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
    if (uGelHydrationStyling > 0.5 && material == 56.0
      && liquidOnly < 0.5 && halo < 0.5 && surfaceOnly < 0.5
      && wall < 0.5 && emissionOnly < 0.5 && family == 2.0 && !materialEmissive) {
      color += gelHydrationDelta(material, wallState.ba, fieldPosition);
    }
    if (uLavaAncestryStyling > 0.5 && material == 11.0
      && liquidOnly < 0.5 && halo < 0.5 && surfaceOnly < 0.5
      && wall < 0.5 && emissionOnly < 0.5) {
      color += lavaAncestryDelta(material, wallState.ba, fieldPosition);
    }
    // Dense, ordinary liquid can retain a tiny scene-independent ambient fill
    // after all of its body optics and native state cues. It is deliberately
    // a hue-preserving multiplier, is bounded to five framebuffer bytes, and
    // never touches reconstructed support, shores, seams, walls, traits, or
    // emissive/molten matter. The existing field depth and cardinal mean are
    // the only body proof; no sampler, field, pass, or alpha decision is added.
    if (uDenseBodyAmbientFill > 0.5 && family == 2.0
      && liquidOnly < 0.5 && halo < 0.5 && surfaceOnly < 0.5 && wall < 0.5
      && traits < 0.5 && !materialEmissive && molten < 0.5
      && foreignMatterContact < 0.5 && unlikeMaterialContact < 0.5
      && liquidDepth > 0.48 && liquidNeighbourMean > 0.56) {
      float liquidAmbientBody = smoothstep(0.48, 0.90, liquidDepth)
        * smoothstep(0.56, 0.90, liquidNeighbourMean);
      float liquidAmbientLift = min(5.0 / 255.0, liquidAmbientBody * 5.0 / 255.0);
      color *= 1.0 + liquidAmbientLift;
    }
  } else {
    float powderVisualCohesion = 0.0;
    float powderChromaCohesion = 0.0;
    float powderMacroRelief = 0.0;
    float powderBodyChroma = 0.0;
    float powderSuspensionCohesion = 0.0;
    float stablePowderMineral = 0.0;
    float powderMesostrataStrength = 0.0;
    float powderMesostrataSlope = 0.0;
    // Smooth's field owns the stable outer silhouette; retain the material's
    // grain vocabulary in the proven body, but do not let per-cell pigment
    // move the first composed edge crossing from one slope column to another.
    float powderContourTextureRetention = 1.0;
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
    // Static construction and uncommon-material marks are useful at silhouettes
    // and in fine pieces, but should not read as a tiled overlay through a broad
    // rigid body. This reuses the exact-species depth byte already proven for
    // the body optics: it cannot run on holes, walls, seams, thin structure, or
    // reconstructed support, and changes later RGB identity arithmetic only.
    float staticSolidIdentityGain = 1.0;
    if (uSolidOpticalDepth > 0.5 && solidOpticalDepth > 6.0 / 255.0) {
      // Surface and first-inner-layer micro detail remain unchanged. The
      // phase-local depth byte has already rejected world edges, holes, walls,
      // unlike seams, and thin structures before this deeper-core blend runs.
      float coreDepth = smoothstep(6.0 / 255.0, 42.0 / 255.0, solidOpticalDepth);
      float deepMicroGain = mix(1.0, solidDeepInteriorMicroGain(optics, profile), solidInterior);
      interiorMicroGain = mix(interiorMicroGain, deepMicroGain, coreDepth);
      // Keep exact static family cues present in a deep rigid body. The
      // optical-depth proof already excludes edges, holes, thin structure,
      // walls, traits, and emissive owners, so this is a bounded RGB-only
      // relaxation rather than a new material-selection path.
      staticSolidIdentityGain = mix(1.0, 0.66, coreDepth * solidInterior);
    }
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
        // Keep the smallest derived material scalars live across the signed
        // branch; GLSL branch-local values cannot be referenced from its else.
        float macroKeyGain = optics == 11.0 ? 0.15 : 0.72;
        float macroShadowGain = optics == 11.0 ? 1.60 : 1.0;
        if (macroResponse > 0.0) {
          // Thickness absorption gives broad solids their depth; retain a
          // slightly stronger existing crown reflection so their lit lobes do
          // not read flatter than the surrounding liquid/gas volumes. The
          // same exact interior/depth proof owns both terms, and this remains
          // RGB-only arithmetic with no resource or topology decision.
          // Radioactive bodies keep an absorption-led deep core so the public
          // isotope identity remains legible; other calm rigid families receive
          // the brighter crown.
          color += (vec3(1.0) - clamp(color, 0.0, 1.0))
            * solidBodyMacroKey(optics) * macroResponse * macroGain * macroKeyGain;
        } else {
          color *= vec3(1.0) - solidBodyMacroShadow(optics)
            * (-macroResponse) * macroGain * macroShadowGain;
        }
      }
    }
    // PLNT has native topology and lifecycle cues below; this is only a
    // depth-proven organic body response. It reuses the existing depth and
    // macro relief scalars, changing RGB without an additional field/sample or
    // ever broadening a seed, stem, leaf tip, gap, wall, or contact.
    if (uSolidOpticalDepth > 0.5 && material == 10.0
      && solidOpticalDepth > 6.0 / 255.0 && solidInterior > 0.001
      && surfaceOnly < 0.5) {
      float canopyDepth = smoothstep(6.0 / 255.0, 42.0 / 255.0, solidOpticalDepth);
      float canopyRelief = clamp(solidReliefTone * 255.0 / 6.0, -1.0, 1.0)
        * canopyDepth;
      if (canopyRelief > 0.0) {
        color += vec3(1.5, 6.5, 2.3) / 255.0 * canopyRelief;
      } else if (canopyRelief < 0.0) {
        color *= vec3(1.0) - vec3(0.075, 0.040, 0.095) * (-canopyRelief);
      }
      // Existing semantic normal/specular light gives dense leaves a small
      // waxy catch-light after body depth has proved a real canopy. Blend from
      // the already styled colour instead of imposing green, so native tree
      // inheritance (including cyan/magenta variants) remains authoritative.
      // This is RGB-only and reuses values already live in the body branch.
      float canopySheen = (0.009 + specular * 0.036) * canopyDepth;
      vec3 canopySheenColor = mix(vec3(0.42, 0.72, 0.34), vividColor(color, 1.10), 0.72);
      color += (vec3(1.0) - clamp(color, 0.0, 1.0)) * canopySheenColor * canopySheen;
      // Three-cell leaf clusters add material-scale canopy variation only after
      // the existing exact-owner/depth/interior proof. They reuse world-space
      // arithmetic and established depth support, so native plant topology,
      // inherited tree colour, alpha, walls, gaps, and growing tips remain
      // authoritative in their existing paths.
      float canopyCluster = mod(floor(fieldPosition.x / 3.0) * 17.0
        + floor(fieldPosition.y / 3.0) * 31.0, 29.0) / 28.0;
      float canopyClusterCrown = smoothstep(0.64, 0.93, canopyCluster);
      float canopyClusterPocket = 1.0 - smoothstep(0.18, 0.48, canopyCluster);
      float canopyClusterVein = 1.0 - step(0.5, mod(
        floor(fieldPosition.x / 2.0) * 5.0 - floor(fieldPosition.y / 3.0) * 3.0, 23.0
      ));
      color += (vec3(1.4, 6.0, 1.0) * canopyClusterCrown
        - vec3(2.6, 3.4, 2.1) * canopyClusterPocket
        + vec3(-2.0, 4.0, -1.2) * canopyClusterVein) / 255.0 * canopyDepth;
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
      // Once the stable Smooth field has proved exact material depth plus
      // lateral support, it owns the diagonal contour. Otherwise retain the
      // local contact blend so loose grains, holes, seams, and fine columns
      // remain exact. The wide-field blend is zero for Grains and Local.
      float powderBulk = max(
        powderContact * boundaryStability,
        powderSurfaceBlend * boundaryStability * 0.78
      );
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
        powderLightBodyGate = powderBodyGate
          * (1.0 - step(0.5, halo))
          * (1.0 - step(0.5, wall))
          * (1.0 - step(0.5, wallOnly))
          * (1.0 - step(0.5, emissionOnly))
          * (1.0 - step(0.01, powderSuspensionCohesion));
        powderLightBodyDepth = powderBodyVolumeDepth;
        powderLightBodySlope = powderDirectedSlope;
        // Rough granular bodies need a little more dense-core absorption than
        // crystalline/sooty/metallic powders. This only deepens settled Smooth
        // Sand/Clay/Concrete through the existing stable body gate; loose
        // particles, Grains, Local, holes, and fine structures stay exact.
        float powderBodyDepthTone = mix(0.030, -0.052, powderBodyVolumeDepth)
          - (optics == 7.0 ? 0.006 * powderBodyVolumeDepth : 0.0);
        float powderBodyDirectionalGain = mix(0.060, 0.045, powderBodyVolumeDepth);
        powderBodyChroma = clamp(
          powderDirectedSlope * powderBodyDirectionalGain + powderBodyDepthTone,
          -0.080, 0.085
        ) * powderBodyGate * (optics == 13.0 ? 0.98
          : (optics == 14.0 ? 0.58 : (optics == 15.0 ? 1.08 : 1.0)));
        // E02: preserve the established grain cadence while giving only a dry,
        // temporally stable Smooth bulk a broader directional crown and core
        // absorption. The existing body proof excludes fine structures and
        // authored holes; Local, Grains, motion, walls, and suspension are
        // exact no-ops. This is bounded HDR RGB arithmetic over live scalars.
        if (uVolumeVfx > 0.5 && halo < 0.5 && wall < 0.5
          && wallOnly < 0.5 && emissionOnly < 0.5
          && powderSuspensionCohesion < 0.01) {
          float powderVfxCrown = min(
            0.055,
            powderBodyGate * (
              max(powderDirectedSlope, 0.0) * 0.055
                + (1.0 - powderBodyVolumeDepth) * 0.016
            )
          );
          float powderVfxCore = powderBodyGate * powderBodyVolumeDepth;
          vec3 powderVfxKey = mix(vividColor(base, 1.08), vec3(1.0, 0.74, 0.46), 0.18);
          color += (vec3(1.35) - clamp(color, 0.0, 1.35))
            * powderVfxKey * powderVfxCrown;
          color *= vec3(1.0) - vec3(0.040, 0.032, 0.022) * powderVfxCore;
        }
        // E05: the settled field's signed macro slope is already a stable,
        // topology-proven powder facet. Balance its illuminated crown against
        // the opposing pocket and deep-core absorption without changing the
        // later mineral cadence. This branch is RGB-only arithmetic over the
        // existing body gate: no sample, field, clock, alpha, support, owner,
        // pass, target, or output-scale decision is added.
        if (uPowderBodyVfx > 0.5 && halo < 0.5 && wall < 0.5
          && wallOnly < 0.5 && emissionOnly < 0.5
          && powderSuspensionCohesion < 0.01) {
          // Three broad triangular planes create angular mineral lobes rather
          // than a cell-frequency grade. Their incommensurate world-space
          // directions stay static under camera and Detail changes, while the
          // live powder slope keeps the lighting tied to the actual body.
          float powderVfxPlaneA = 1.0 - 2.0 * abs(
            fract(dot(fieldPosition, vec2(0.02995, -0.02140)) + 0.0101) * 2.0 - 1.0
          );
          float powderVfxPlaneB = 1.0 - 2.0 * abs(
            fract(dot(fieldPosition, vec2(-0.01980, 0.04649)) + 0.1889) * 2.0 - 1.0
          );
          float powderVfxPlaneC = 1.0 - 2.0 * abs(
            fract(dot(fieldPosition, vec2(0.03460, 0.03080)) + 0.3750) * 2.0 - 1.0
          );
          float powderVfxWorldFacet = powderVfxPlaneA * 0.42
            + powderVfxPlaneB * 0.35 + powderVfxPlaneC * 0.23;
          float powderVfxFacetBalance = clamp(
            powderDirectedSlope * mix(0.72, 0.48, powderBodyVolumeDepth)
              + powderVfxWorldFacet * 0.60
              + (0.48 - powderBodyVolumeDepth) * 0.10,
            -1.0, 1.0
          );
          float powderVfxCrown = max(powderVfxFacetBalance, 0.0);
          float powderVfxPocket = max(-powderVfxFacetBalance, 0.0);
          float powderVfxShoulder = (1.0 - powderBodyVolumeDepth)
            * (0.30 + powderVfxCrown * 0.70);
          float powderVfxCrownResponse = powderBodyGate
            * (powderVfxCrown * 0.095 + powderVfxShoulder * 0.025);
          float powderVfxPocketResponse = powderBodyGate
            * (powderBodyVolumeDepth * 0.008 + powderVfxPocket * 0.065);
          vec3 powderVfxFacetKey = mix(
            vividColor(base, 1.10), vec3(1.0, 0.78, 0.52), 0.14
          );
          color += (vec3(1.35) - clamp(color, 0.0, 1.35))
            * powderVfxFacetKey * powderVfxCrownResponse;
          color *= vec3(1.0) - vec3(0.82, 0.91, 1.0) * powderVfxPocketResponse;
        }
        // This is intentionally stricter than a generic settled-powder
        // classification. It names only a proven, deep compatible interior;
        // slopes, holes, narrow columns, loose material, Local, and Grains
        // retain their established geometry and colour treatment.
        stablePowderMineral = step(224.0 / 255.0, boundaryStability)
          * step(0.66, localPowderShape.x)
          * step(5.5, widePowderShape.w);
        // Sand, Stone, Clay, and Concrete receive a small slope-aligned compaction
        // cadence only after the existing stable bulk proof. The suspension
        // field owns wet sediment, so its established cohesion rejects this
        // dry-body material grammar before it can touch a mixed liquid cell.
        float mesostrataOwner = (material == 1.0 || material == 21.0 || material == 26.0 || material == 28.0)
          ? 1.0 : 0.0;
        float mesostrataSlope = clamp(
          (abs(widePowderShape.y) + abs(widePowderShape.z)) * 2.4, 0.0, 1.0
        );
        powderMesostrataStrength = uPowderMesostrataStyling * powderBodyGate * mesostrataOwner
          * (0.34 + powderBodyVolumeDepth * 0.66)
          * (0.30 + mesostrataSlope * 0.70)
          * (1.0 - smoothstep(0.01, 0.09, powderSuspensionCohesion))
          * (1.0 - step(0.5, wall));
        powderMesostrataSlope = powderDirectedSlope;
      }
      // Radioactive powders carry native traits, so the ordinary trait-free
      // settled-powder body deliberately leaves them alone. Give only a deep,
      // stable Smooth core a restrained family-coloured volume before the
      // existing isotope and retained POLO/VIBR state overlays. This reuses the
      // already-live wide powder field; alpha, support, walls, holes, physics,
      // Local, Grains, and the compact 8x compositor remain untouched.
      float radioactivePowder = material == 99.0 || material == 108.0 || material == 109.0
        || material == 111.0 || material == 112.0 ? 1.0 : 0.0;
      if (uEnergyIdentityStyling > 0.5 && uPowderBodyDepth > 0.5 && radioactivePowder > 0.5
        && uPowderStyle > 1.5 && !materialEmissive
        && surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5
        && wallOnly < 0.5 && emissionOnly < 0.5) {
        float radioactivePowderCore = powderBulkDepth
          * smoothstep(224.0 / 255.0, 1.0, boundaryStability)
          * smoothstep(0.66, 0.94, widePowderShape.x)
          * smoothstep(5.5, 8.5, widePowderShape.w);
        float radioactivePowderSlope = clamp(
          widePowderShape.y * -2.20 + widePowderShape.z * -3.20, -1.0, 1.0
        ) * radioactivePowderCore;
        float radioactivePowderCrown = max(radioactivePowderSlope, 0.0);
        float radioactivePowderPocket = max(-radioactivePowderSlope, 0.0);
        vec3 radioactivePowderAbsorption = vec3(0.046, 0.057, 0.033);
        vec3 radioactivePowderKey = vec3(0.34, 0.74, 0.30);
        if (material == 99.0) {
          radioactivePowderAbsorption = vec3(0.058, 0.032, 0.078);
          radioactivePowderKey = vec3(0.48, 0.28, 0.78);
        } else if (material == 108.0 || material == 112.0) {
          radioactivePowderAbsorption = vec3(0.065, 0.053, 0.018);
          radioactivePowderKey = vec3(0.64, 0.80, 0.22);
        } else if (material == 109.0) {
          radioactivePowderAbsorption = vec3(0.048, 0.066, 0.026);
          radioactivePowderKey = vec3(0.40, 0.90, 0.34);
        } else {
          radioactivePowderAbsorption = vec3(0.074, 0.040, 0.084);
          radioactivePowderKey = vec3(0.50, 0.30, 0.78);
        }
        color *= vec3(1.0) - radioactivePowderAbsorption
          * (0.040 + radioactivePowderPocket * 0.40) * radioactivePowderCore;
        color += (vec3(1.0) - clamp(color, 0.0, 1.0))
          * radioactivePowderKey * (0.014 + radioactivePowderCrown * 0.090)
          * radioactivePowderCore;
      }
      float grainOffsetY = fract(sin(dot(floor(fieldPosition), vec2(39.346, 11.135))) * 24634.6345) - 0.5;
      vec2 grainCentre = vec2(grain, grainOffsetY) * 0.075;
      float grainDistance = length(fract(fieldPosition) - 0.5 - grainCentre);
      float roundGrainAlpha = 1.0 - smoothstep(0.34, 0.56, grainDistance);
      float heapStart = mix(0.10 + grain * 0.020, 0.40 + grain * 0.012, powderSurfaceBlend);
      float heapEnd = mix(0.62 + grain * 0.030, 0.60 + grain * 0.018, powderSurfaceBlend);
      float heapAlpha = smoothstep(heapStart, heapEnd, density);
      // The stable wide field already owns Smooth's outer silhouette.  Do not
      // carry the deliberately cell-varying mineral threshold into that edge:
      // it reintroduces a stair-step at the final alpha transfer even though
      // the field geometry is curved.  The transfer is restricted to the
      // settled, bulk-proven surface blend, leaving Local/Grains and fragile
      // columns, holes, seams, and moving powder on their exact local path.
      float smoothContourTransfer = boundaryStability * powderSurfaceBlend;
      if (uPowderStyle > 1.5) {
        float smoothContourAlpha = smoothstep(0.36, 0.64, widePowderShape.x);
        heapAlpha = mix(heapAlpha, smoothContourAlpha, smoothContourTransfer);
        powderContourTextureRetention = 1.0 - smoothContourTransfer
          * (1.0 - smoothstep(0.72, 1.00, widePowderShape.x));
      }
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
      // Trait owners retain their canonical palette in empty-space support, so
      // their intentionally dark material base needs the high opacity end of
      // the accepted cavity band to read as joined matter rather than a pit.
      float cavityOpacity = traits > 0.5 ? 0.98 : mix(0.90, 0.98, cavityConfidence);
      alpha = max(alpha, cavityOpacity);
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
      if (uTranslucentLensShell > 0.5 && (material == 12.0 || material == 24.0
        || material == 68.0 || material == 74.0 || material == 76.0 || material == 77.0)
        && !materialEmissive && traits < 0.5 && surfaceOnly < 0.5) {
        float shellRim = (1.0 - solidDepth) * 0.030 + solidFresnel * 0.055;
        if (material == 24.0) {
          float crown = max(solidReliefTone, 0.0);
          float valley = max(-solidReliefTone, 0.0);
          // The semantic wall compositor already supplies the actual backdrop
          // refraction. This is only the body optic: deeper Glass absorbs a
          // little warm base light, carries a cool transmission, and catches
          // the existing environment at a grazing angle. It is deliberately
          // local RGB arithmetic, so it cannot disturb support or alpha.
          float glassCore = smoothstep(0.28, 0.90, solidDepth);
          float glassGrazing = smoothstep(0.018, 0.18, solidFresnel);
          color = mix(color, color * vec3(0.86, 0.965, 1.075), glassCore * 0.30);
          color *= 1.0 - solidDepth * 0.010 - valley * 0.70;
          color += vec3(0.45, 0.78, 1.0) * (shellRim + crown * 1.50);
          vec3 glassReflection = solidEnvironment * (0.045 + glassGrazing * 0.20)
            + solidSpecularTint * (0.006 + glassGrazing * 0.018);
          color += (vec3(1.0) - clamp(color, 0.0, 1.0)) * glassReflection
            * (0.30 + glassCore * 0.70);
        } else if (material == 12.0) {
          float frostedRidge = abs(solidReliefTone) * 0.70;
          // Deep Ice remains translucent rather than simply pale: its body
          // transmits a restrained blue key while the same live environment
          // provides a broad frozen reflection. The authored ridge remains
          // visible above this slower depth cue.
          float iceCore = smoothstep(0.22, 0.88, solidDepth);
          float iceGrazing = smoothstep(0.018, 0.18, solidFresnel);
          color = mix(color, color * vec3(0.88, 0.995, 1.105), iceCore * 0.24);
          color *= 1.0 - solidDepth * 0.018 - abs(solidReliefTone) * 0.24;
          color += vec3(0.58, 0.86, 1.0) * (shellRim * 0.72 + frostedRidge);
          vec3 iceReflection = solidEnvironment * (0.032 + iceGrazing * 0.13)
            + solidSpecularTint * (0.004 + iceGrazing * 0.012);
          color += (vec3(1.0) - clamp(color, 0.0, 1.0)) * iceReflection
            * (0.34 + iceCore * 0.66);
        } else if (material == 76.0) {
          // Quartz keeps a small directional prism: crowns catch a cool key,
          // valleys absorb, and the shared shell rim retains its curved edge.
          float crown = max(solidReliefTone, 0.0);
          float valley = max(-solidReliefTone, 0.0);
          color *= 1.0 - 1.1 / 255.0 - valley * 0.16;
          color += vec3(0.48, 0.72, 0.94) * (shellRim + crown * 0.72);
        } else {
          // DRIC/RIME carry a quiet frost shell, while NICE strengthens its
          // cold ridge. All inputs are already local solid-body scalars.
          float frost = abs(solidReliefTone) * 0.34;
          color *= 1.0 - 1.4 / 255.0 - abs(solidReliefTone) * 0.14;
          if (material == 74.0) {
            float coolRim = shellRim * 0.52 + frost * 1.20;
            color += vec3(0.50, 0.84, 1.15) * coolRim;
          } else {
            color += vec3(0.60, 0.82, 1.0) * (shellRim * 0.46 + frost);
          }
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
      // Keep the already lit semantic body available for the final settled
      // earth-material calm. It is not a new sample or support decision.
      vec3 powderBodyBase = color;
      vec2 subcell = floor(fract(fieldPosition) * 2.0);
      float grainFacet = fract(sin(dot(floor(fieldPosition) * 2.0 + subcell, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      float facetGain = optics == 13.0 ? 1.12
        : (optics == 14.0 ? 0.35 : (optics == 15.0 ? 0.90 : 1.0));
      // Deep, stable Smooth powder is a continuous body with restrained
      // mineral variation. The same existing exact-material/depth gate leaves
      // loose grains, fine columns, holes, Local, and the square Grains
      // comparison mode completely untouched.
      // A genuinely settled Smooth body should read as one material volume at
      // fit view rather than a grid of individually shaded simulation cells.
      // Smooth owns only the settled exterior contour and broad body depth. It
      // must retain enough mineral/grain variation inside a pile to avoid the
      // previous airbrushed look; Local and square Grains still carry the full
      // reference cadence, while a stable bulk deliberately lifts only its
      // already world-anchored mineral/facet contrast. This keeps a smooth
      // silhouette from airbrushing the interior at 1x–4x without restoring
      // square particle boundaries. Curving the silhouette must not erase the
      // internal material vocabulary at normal detail.
      // The cell-scale mineral cadence is deliberately a little stronger than
      // the sub-cell facet cadence in a settled Smooth body. At 1x–4x the
      // latter is legitimately filtered by the composed presentation, whereas
      // this world-anchored term remains readable without reintroducing square
      // particle borders. Local and Grains keep their unmodified references.
      float settledMineralRetention = max(powderVisualCohesion, stablePowderMineral);
      // Keep the bulk at a clearly legible mineral cadence at normal detail.
      // The silhouette estimator is still solely responsible for curvature;
      // this modest interior-only lift restores the colour variation that the
      // 1x--4x raster filters away before a viewer can read a pile as grains.
      // At 1x the sub-cell facet is necessarily filtered into the presentation
      // target, so give the existing world-cell mineral cadence enough weight
      // to retain the 2x body's readable colour variation. This remains inside
      // the settled-only proof: it cannot square off a silhouette or touch
      // Local/Grains, loose particles, seams, holes, traits, or emission.
      // Leave a little more of the material's own world-cell pigment in the
      // settled core. The curved field still owns only coverage at the edge;
      // this is deliberately below the Local/Grains cadence, but enough to
      // survive the 1x--4x compositor without an airbrushed clay/sand body.
      // A 2x backing still filters the world-cell mineral cadence enough to
      // make a broad Smooth pile read airbrushed. Retain a little more of that
      // cadence in a *proven* settled interior. This is RGB only: the wide
      // field continues to own the curved exterior, and fragile material,
      // Local, Grains, and the direct 8x compositor remain on their existing
      // paths.
      float cellGrainRetention = mix(1.0, 1.70, settledMineralRetention);
      // The filter's logical field spans the fixed world while gl_FragCoord is
      // in its backing pixels. Their ratio is therefore the active Detail
      // scale, independent of CSS camera transforms and without a new uniform.
      // One and two-times backings need compensation for necessarily filtered
      // cell/facet pigment; taper it smoothly by 4x. The curve is derived
      // solely from framebuffer/world scale, never CSS camera transforms, so
      // it cannot alter pointer or viewport math. True 8x has its own compact
      // compositor and does not execute this normal-path branch.
      float detailEstimate = min(
        (gl_FragCoord.x + 0.5) / max(fieldPosition.x, 0.5),
        (gl_FragCoord.y + 0.5) / max(fieldPosition.y, 0.5)
      );
      // A one-times backing filters a settled body's world-cell pigment much
      // more aggressively than its curved coverage. Keep a deliberately
      // short low-detail shoulder: 1x receives enough of the already-owned
      // mineral vocabulary to match the readable 2x body, while 2x retains
      // its prior compensation; the distinct 4x filter is handled below.
      // This remains a dense-interior RGB multiplier only; the Hermite field
      // still owns every contour, alpha, support, and material decision.
      float lowDetailShoulder = 1.0 - smoothstep(1.15, 2.25, detailEstimate);
      float lowDetailTaper = 1.0 - smoothstep(2.25, 4.0, detailEstimate);
      // Four-times backing resolves the smooth coverage transition crisply,
      // yet its final cell-frequency pigment still filters below the 2x body
      // in a fit viewport. Recover that distinct high-normal-detail loss with
      // a separate 4x band rather than raising the 1x shoulder or changing
      // the already calibrated 2x body. The true 8x direct mesh does not run
      // this normal compositor.
      float fourXMineralRecovery = smoothstep(2.75, 4.0, detailEstimate);
      float lowDetailMineralGain = 1.0 + 0.85 * lowDetailTaper
        + 1.05 * lowDetailShoulder + 0.90 * fourXMineralRecovery;
      cellGrainRetention = mix(1.0, cellGrainRetention * lowDetailMineralGain,
        settledMineralRetention);
      // At fit view the low-detail recovery must leave a material readable, but
      // a fully settled Smooth body should not resolve as a uniform pepper
      // field. Narrow only that proven deep-interior cadence; contour cells,
      // loose powder, Local, Grains, and the compact 8x path retain their
      // existing diagnostic detail.
      float broadPowderPigmentDamping = 1.0 - smoothstep(
        0.72, 0.98, powderVisualCohesion
      ) * 0.14;
      // The showcase's deep Stone platform needs a quieter fit-view body than
      // an exposed Sand/Clay pile: its established macro relief and mesostrata
      // already carry the bulk read. Restrict this cap to that exact semantic
      // owner so the calibrated 1x--4x granular-material vocabulary remains
      // intact. Edges, holes, Local, Grains, and every 8x direct-mesh pixel
      // stay on their established paths.
      float deepPowderBody = smoothstep(0.86, 0.98, powderVisualCohesion);
      float deepStoneBody = material == 21.0 ? deepPowderBody : 0.0;
      float settledGrainCeiling = mix(8.0, 2.70, deepStoneBody);
      cellGrainRetention = mix(
        cellGrainRetention,
        cellGrainRetention * broadPowderPigmentDamping,
        smoothstep(0.72, 0.98, powderVisualCohesion)
      );
      cellGrainRetention = min(cellGrainRetention, settledGrainCeiling);
      // A locally packed, temporally settled Smooth body is material, not a
      // grid of independently shaded simulation cells. Reuse the already
      // decoded semantic contact (shape.w) rather than adding a field/sample:
      // loose grains, unsupported hole interiors, Local, Grains, and direct
      // 8x never satisfy this RGB-only calm gate.
      float settledPowderColorCalm = step(1.5, uPowderStyle)
        * step(224.0 / 255.0, boundaryStability)
        * smoothstep(2.5, 3.5, shape.w);
      cellGrainRetention = mix(
        cellGrainRetention, min(cellGrainRetention, 1.20), settledPowderColorCalm * 0.85
      );
      float deepPowderChromaDamping = mix(1.0, 0.78, deepStoneBody);
      float facetRetention = mix(1.0, 1.20, settledMineralRetention);
      float powderMineralFactor = 0.91
        + grain * (0.20 + roughSurface * 0.05) * cellGrainRetention * facetGain
        + grainFacet * (0.10 + roughSurface * 0.04) * facetRetention * facetGain;
      color *= mix(1.0, powderMineralFactor, powderContourTextureRetention);
      // A large, fully settled Smooth body should retain its mineral vocabulary
      // without reading as a dense cell-frequency pepper field at fit view.
      // Leave the existing low-frequency body depth and mesostrata untouched;
      // only the strongest warm/cool per-cell chroma key steps back a little in
      // an already-proven deep interior. Local/Grains, loose powder, seams,
      // holes, traits, emission, and true 8x never enter this normal-path gate.
      // A modest chromatic mineral key survives normal-detail raster filtering
      // better than sub-cell luminance alone. It is exact-cell/world anchored
      // and RGB-only, so composed Smooth bodies gain colour vocabulary without
      // creating a new support decision or perturbing Local/Grains references.
      color += base * grain * vec3(0.178, 0.044, -0.112)
        * stablePowderMineral * lowDetailMineralGain * powderContourTextureRetention
        * broadPowderPigmentDamping * deepPowderChromaDamping;
      color += base * max(0.0, 0.6 - subcell.x - subcell.y)
        * (0.11 + roughSurface * 0.035) * facetRetention * facetGain
        * powderContourTextureRetention;
      float brightFacet = max(0.0, grainFacet - 0.18) * facetRetention
        * powderContourTextureRetention;
      if (optics == 13.0) {
        color += vec3(0.52, 0.78, 1.00) * brightFacet * 0.085;
      } else if (optics == 14.0) {
        color *= 0.97;
      } else if (optics == 15.0) {
        color += vec3(1.00, 0.68, 0.32) * brightFacet * 0.060;
      }
      // Thirteen distinct native powders share the existing deterministic grain and
      // half-cell facet signals, then select one small identity motif. The
      // branch is authoritative-matter RGB arithmetic only: it adds no sample,
      // field, pass, allocation, clock term, or output-scale resource.
      float unusualPowder = material == 43.0 || material == 44.0
        || material == 45.0 || material == 46.0 || material == 47.0
        || material == 48.0 || material == 49.0 || material == 51.0
        || material == 198.0 || material == 217.0 || material == 7.0
        || material == 18.0 || material == 29.0 ? 1.0 : 0.0;
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
        } else if (material == 7.0) {
          // SALT: warm cubic cleavages remain sparse across a settled crystal body.
          float cleavage = max(diagonalBand, counterBand * step(-0.08, grainFacet));
          color += vec3(0.040, 0.027, 0.011) * cleavage;
          color *= 1.0 - counterBand * step(grainFacet, -0.20) * 0.026;
        } else if (material == 18.0) {
          // SNOW: cool, soft flake intersections keep the powder light but legible.
          vec2 snowCell = abs(mod(motifCell + vec2(4.0), 9.0) - 4.0);
          float flake = max(
            1.0 - step(0.5, min(snowCell.x, snowCell.y)),
            1.0 - step(0.5, abs(snowCell.x - snowCell.y))
          ) * (1.0 - step(3.6, max(snowCell.x, snowCell.y)));
          color += vec3(0.014, 0.026, 0.039) * flake;
          color *= 1.0 - max(0.0, -grainFacet) * 0.014;
        } else if (material == 29.0) {
          // PQRT: lilac angular planes establish a baseline beneath native crystal state.
          float plane = max(diagonalBand, counterBand * step(0.06, grain));
          color += vec3(0.044, 0.016, 0.039) * plane;
          color *= 1.0 - coarseNode * step(grainFacet, -0.15) * 0.024;
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
      // This exact-owner RGB identity sits after the shared granular body.
      // The helper's local scope keeps the true-8x composed body compact.
      if (uEarthenPowderStyling > 0.5
        && (material == 6.0 || material == 21.0 || material == 26.0 || material == 28.0)
        && family == 4.0 && traits < 0.5 && !materialEmissive
        && surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5
        && wallOnly < 0.5 && emissionOnly < 0.5) {
        color = clamp(color + earthenPowderIdentityDelta(material, fieldPosition), 0.0, 1.0);
      }
      // Dense, temporally settled earth bodies keep a living mineral trace, but
      // no longer read as four independently coloured square particles per
      // semantic cell. Preserve their broad lit base before mesostrata/body
      // optics are restored; loose grains, unsupported hole interiors, other
      // powder families, Local, Grains, and direct 8x are exact no-ops.
      float commonEarthenPowder = (material == 1.0 || material == 21.0
        || material == 26.0 || material == 28.0) ? 1.0 : 0.0;
      color = mix(color, powderBodyBase, settledPowderColorCalm * commonEarthenPowder * 0.42);
      if (powderMesostrataStrength > 0.0) {
        color = clamp(color + settledPowderMesostrataDelta(
          material, fieldPosition, powderMesostrataSlope
        ) * powderMesostrataStrength, 0.0, 1.0);
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
        vec2 cellularLocal = mod(
          cellularCell + vec2(preset * 3.0, preset * 5.0), 16.0
        ) - vec2(7.5);
        float cellularRadiusSquared = dot(cellularLocal, cellularLocal);
        float membrane = step(24.5, cellularRadiusSquared)
          * (1.0 - step(43.5, cellularRadiusSquared));
        float core = 1.0 - step(7.5, cellularRadiusSquared);
        float junctionCoordinate = motif < 0.5 ? cellularLocal.x - cellularLocal.y
          : (motif < 1.5 ? cellularLocal.x + cellularLocal.y
          : (motif < 2.5 ? cellularLocal.x * 2.0 + cellularLocal.y
          : cellularLocal.x - cellularLocal.y * 2.0));
        // A preset-oriented chord through the same local membrane makes dense
        // LIFE read as joined colonies rather than flat stripes. It is strictly
        // arithmetic over the existing exact owner and adds no state/resource.
        float junction = step(18.5, cellularRadiusSquared)
          * (1.0 - step(42.5, cellularRadiusSquared))
          * (1.0 - step(0.75, abs(junctionCoordinate)));
        float scalar = mix(
          2.0 + mod(preset, 2.0),
          -4.0 - mod(floor(preset / 4.0), 2.0) * 2.0,
          band
        ) + node * mix(2.0, -2.0, band)
          + membrane * -1.0 + core
          + junction * mix(-2.0, -1.0, band);
        vec3 cellularDelta = vec3(scalar);
        if (motif < 0.5) cellularDelta += vec3(0.0, -band * 2.0, node * 2.0);
        else if (motif < 1.5) cellularDelta += vec3(-band * 2.0, 0.0, band);
        else if (motif < 2.5) cellularDelta += vec3(band, node * 2.0, 0.0);
        else cellularDelta += vec3(0.0, -node, -band * 2.0);
        if (membrane > 0.5) {
          cellularDelta.r -= motif < 1.5 ? (motif < 0.5 ? 1.0 : 0.0) : 1.0;
          cellularDelta.g -= motif < 2.5 ? (motif < 1.5 ? 1.0 : 0.0) : 1.0;
          cellularDelta.b += motif < 2.5 ? 1.0 : 0.0;
        } else if (core > 0.5) {
          cellularDelta.r += motif < 2.5 ? (motif < 1.5 ? 0.0 : 1.0) : 0.0;
          cellularDelta.g += motif < 2.5 ? 0.0 : 1.0;
          cellularDelta.b += motif < 0.5 ? 1.0 : 0.0;
        }
        if (junction > 0.5) {
          if (motif < 0.5) cellularDelta.g -= 1.0;
          else if (motif < 1.5) cellularDelta.b -= 1.0;
          else if (motif < 2.5) cellularDelta.r -= 1.0;
          else cellularDelta.g -= 1.0;
        }
        color = clamp(color + clamp(cellularDelta, vec3(-10.0), vec3(10.0)) / 255.0,
          0.0, 1.0);
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
      // Exact construction bodies receive a sparse RGB identity after their
      // shared lit body. The bounded helper keeps 8x register pressure local.
      if (uStructuralRigidStyling > 0.5 && surfaceOnly < 0.5 && halo < 0.5
        && wall < 0.5 && wallOnly < 0.5 && emissionOnly < 0.5
        && traits < 0.5 && !materialEmissive) {
        float structuralIdentityGain = 1.0;
        if (solidOpticalDepth > 6.0 / 255.0 && solidInterior > 0.001) {
          float structuralDepth = smoothstep(6.0 / 255.0, 42.0 / 255.0, solidOpticalDepth);
          float structuralRelief = clamp(solidReliefTone * 255.0 / 7.0, -1.0, 1.0)
            * structuralDepth;
          color = clamp(color + structuralRigidBulkDelta(material, structuralRelief), 0.0, 1.0);
          color = clamp(color + structuralMetalBodyDelta(
            material, fieldPosition, structuralDepth, structuralRelief
          ), 0.0, 1.0);
          structuralIdentityGain = mix(
            1.0, structuralRigidDeepIdentityGain(material), structuralDepth * solidInterior
          );
          // The material-specific helper intentionally retains the calmest
          // metals and more Brick course detail. Cap only its strongest deep
          // cadence with the common static-body proof above.
          structuralIdentityGain = min(structuralIdentityGain, staticSolidIdentityGain);
        }
        color = clamp(color + structuralRigidIdentityDelta(material, fieldPosition)
          * structuralIdentityGain, 0.0, 1.0);
      }
    } else if (organicSurface > 0.5 || (optics < 0.5 && profile == 3.0)) {
      float fibre = sin(fieldPosition.x * 0.20 + sin(fieldPosition.y * 0.115 + material) * 1.45);
      float pores = sin(fieldPosition.x * 0.083 + fieldPosition.y * 0.157 + material * 0.37)
        * sin(fieldPosition.y * 0.091 - fieldPosition.x * 0.047);
      // Dense PLNT already has a depth-proven three-cell leaf cluster, crown,
      // pocket, waxy sheen, and native lifecycle colours below. Letting this
      // generic, cell-frequency organic fibre carry its full amplitude over a
      // canopy makes normal WebGL read as horizontal scanlines rather than
      // foliage. Keep Wood/Vine's fibrous body unchanged, but make PLNT's
      // generic fibre only a quiet undertone so its existing larger leaf forms
      // remain legible. This is RGB-only arithmetic over values already live
      // in the material branch; it does not change topology, alpha, state, or
      // the deliberately compact true-8x renderer.
      // PLNT's larger body optics below already supply a crown, pocket, waxy
      // sheen, and three-cell leaf clusters. Keep this cell-frequency fibre
      // as a very quiet undertone so a dense canopy reads as foliage rather
      // than evenly spaced horizontal bands at normal viewing distance.
      float organicMicroGain = material == 10.0 ? 0.055 : 1.0;
      float organicBaseline = material == 10.0 ? 1.0 : 0.95;
      // PLNT's generic fibre varies mainly along one world axis. Blend its
      // already-live two-axis pore signal into that deliberately tiny undertone
      // so a mature canopy reads as clustered living matter rather than quiet
      // scanlines. Wood and Vine retain their original longitudinal fibre.
      float organicMicroFibre = material == 10.0 ? fibre * 0.32 + pores * 0.68 : fibre;
      color *= organicBaseline + (organicMicroFibre * 0.042 + pores * 0.024
        + organicSurface * max(0.0, organicMicroFibre) * 0.018) * interiorMicroGain * organicMicroGain;
      color += mix(color, vec3(0.19, 0.34, 0.18), 0.38)
        * organicSurface * max(0.0, 0.6 - abs(pores)) * 0.028 * interiorMicroGain
        * organicMicroGain;
      // Mature Wood alone receives a compact trunk grain after the common
      // Organic response. The existing solid-depth field proves a broad,
      // exact-species interior, so thin branches, holes, walls, and all Plant
      // lifecycle graphics keep their semantic render path. This is static,
      // RGB-only arithmetic with no texture, field, pass, or support change.
      if (material == 9.0 && uSolidOpticalDepth > 0.5
        && solidOpticalDepth > 6.0 / 255.0 && solidInterior > 0.001
        && surfaceOnly < 0.5) {
        float woodDepth = smoothstep(6.0 / 255.0, 42.0 / 255.0, solidOpticalDepth);
        float woodGrain = 0.5 + 0.5 * fibre;
        float woodRidge = smoothstep(0.64, 0.94, woodGrain);
        float woodPocket = 1.0 - smoothstep(0.28, 0.58, woodGrain);
        float woodRelief = clamp(solidReliefTone * 255.0 / 6.0, -1.0, 1.0) * woodDepth;
        color *= vec3(1.0) - vec3(0.075, 0.040, 0.018)
          * (woodPocket * 0.52 + max(0.0, -woodRelief) * 0.38) * woodDepth;
        color += (vec3(1.0) - clamp(color, 0.0, 1.0))
          * vec3(0.50, 0.25, 0.07)
          * (woodRidge * 0.34 + max(0.0, woodRelief) * 0.22) * woodDepth;
      }
      // Organic matter needs a continuous body read before its fine fibre,
      // canopy, and native lifecycle marks can feel material rather than
      // cell-banded. Reuse the exact-species solid thickness, relief, normal,
      // and environment already live in this branch. Seed, YEST, DYST, gaps,
      // walls, and reconstructed support never reach this exact-owner path.
      if ((material == 9.0 || material == 10.0 || material == 83.0)
        && uSolidOpticalDepth > 0.5 && solidOpticalDepth > 6.0 / 255.0
        && solidInterior > 0.001 && surfaceOnly < 0.5) {
        float organicDepth = smoothstep(6.0 / 255.0, 42.0 / 255.0, solidOpticalDepth);
        float organicRelief = clamp(solidReliefTone * 255.0 / 6.0, -1.0, 1.0)
          * organicDepth;
        float organicCrown = max(organicRelief, 0.0);
        float organicPocket = max(-organicRelief, 0.0);
        float organicGrazing = smoothstep(0.018, 0.18, solidFresnel);
        if (material == 9.0) {
          // Wood keeps a warm longitudinal reflection over the existing grain.
          color *= vec3(1.0) - vec3(0.055, 0.030, 0.012)
            * (organicPocket * 0.66 + (1.0 - organicGrazing) * 0.08) * organicDepth;
          color += (vec3(1.0) - clamp(color, 0.0, 1.0))
            * (vec3(0.54, 0.30, 0.10) * (organicCrown * 0.20 + organicGrazing * 0.075)
              + solidEnvironment * (0.055 + organicGrazing * 0.12)) * organicDepth;
        } else if (material == 10.0) {
          // Plant leaves transmit a soft green crown yet retain an opposing
          // cool interior shadow; inherited canopy colour is applied later.
          color *= vec3(1.0) - vec3(0.026, 0.008, 0.060)
            * (organicPocket * 0.72 + (1.0 - organicGrazing) * 0.05) * organicDepth;
          color += (vec3(1.0) - clamp(color, 0.0, 1.0))
            * (vec3(0.26, 0.80, 0.30) * (organicCrown * 0.16 + organicGrazing * 0.080)
              + solidEnvironment * (0.050 + organicGrazing * 0.11)) * organicDepth;
        } else {
          // Vines remain darker and humid, with a quieter wet rim than a leaf.
          color *= vec3(1.0) - vec3(0.036, 0.012, 0.062)
            * (organicPocket * 0.58 + (1.0 - organicGrazing) * 0.06) * organicDepth;
          color += (vec3(1.0) - clamp(color, 0.0, 1.0))
            * (vec3(0.20, 0.66, 0.28) * (organicCrown * 0.11 + organicGrazing * 0.052)
              + solidEnvironment * (0.034 + organicGrazing * 0.075)) * organicDepth;
        }
      }
    } else if (radioactiveSurface > 0.5 || (optics < 0.5 && profile == 4.0)) {
      float isotope = sin(fieldPosition.x * 0.137 + sin(fieldPosition.y * 0.103 + material) * 1.6)
        * sin(fieldPosition.y * 0.181 - fieldPosition.x * 0.061);
      float decayPulse = 0.5 + 0.5 * sin(uTime * 1.55 + material * 0.73 + isotope * 1.8);
      color *= 0.97 + isotope * 0.038 * interiorMicroGain + decayPulse * 0.012;
      color += vec3(0.10, 0.25, 0.13) * radioactiveSurface * decayPulse * 0.035;
      // Exact dense radioactive bodies need a coherent core before their
      // static isotope marks and retained POLO/VIBR state are layered below.
      // This consumes the existing solid thickness/relief/Fresnel response
      // only; phase, support, alpha, native state, and Energy emission remain
      // owned by their established paths.
      bool radioactiveBody = material == 99.0 || material == 105.0 || material == 108.0
        || material == 109.0 || material == 111.0 || material == 112.0 || material == 113.0;
      if (uEnergyIdentityStyling > 0.5 && radioactiveBody
        && uSolidOpticalDepth > 0.5 && family == 0.0
        && surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5
        && traits < 0.5 && !materialEmissive
        && solidOpticalDepth > 6.0 / 255.0 && solidInterior > 0.001) {
        float radioactiveDepth = smoothstep(6.0 / 255.0, 42.0 / 255.0, solidOpticalDepth);
        float radioactiveRelief = clamp(solidReliefTone * 255.0 / 6.0, -1.0, 1.0)
          * radioactiveDepth;
        float radioactiveCrown = max(radioactiveRelief, 0.0);
        float radioactivePocket = max(-radioactiveRelief, 0.0);
        float radioactiveGrazing = smoothstep(0.018, 0.18, solidFresnel);
        vec3 radioactiveAbsorption = vec3(0.038, 0.052, 0.046);
        vec3 radioactiveKey = vec3(0.24, 0.62, 0.34);
        float radioactiveReflection = 0.075;
        if (material == 99.0) {
          radioactiveAbsorption = vec3(0.052, 0.030, 0.072);
          radioactiveKey = vec3(0.46, 0.28, 0.78);
          radioactiveReflection = 0.088;
        } else if (material == 105.0) {
          radioactiveAbsorption = vec3(0.026, 0.060, 0.070);
          radioactiveKey = vec3(0.22, 0.72, 0.80);
          radioactiveReflection = 0.092;
        } else if (material == 108.0 || material == 112.0) {
          radioactiveAbsorption = vec3(0.060, 0.050, 0.018);
          radioactiveKey = vec3(0.60, 0.78, 0.20);
          radioactiveReflection = 0.070;
        } else if (material == 109.0) {
          radioactiveAbsorption = vec3(0.044, 0.062, 0.026);
          radioactiveKey = vec3(0.38, 0.88, 0.34);
          radioactiveReflection = 0.095;
        } else if (material == 111.0) {
          radioactiveAbsorption = vec3(0.070, 0.038, 0.080);
          radioactiveKey = vec3(0.48, 0.30, 0.76);
          radioactiveReflection = 0.110;
        } else if (material == 113.0) {
          radioactiveAbsorption = vec3(0.024, 0.052, 0.070);
          radioactiveKey = vec3(0.24, 0.62, 0.88);
          radioactiveReflection = 0.102;
        }
        color *= vec3(1.0) - radioactiveAbsorption
          * (radioactivePocket * 0.72 + (1.0 - radioactiveGrazing) * 0.055)
          * radioactiveDepth;
        color += (vec3(1.0) - clamp(color, 0.0, 1.0))
          * (radioactiveKey * (radioactiveCrown * 0.16 + radioactiveGrazing * 0.070)
            + solidEnvironment * (0.040 + radioactiveGrazing * radioactiveReflection))
          * radioactiveDepth;
      }
    } else if (deviceSurface > 0.5 || (optics < 0.5 && profile == 5.0)) {
      vec2 circuitCell = abs(fract((fieldPosition + vec2(material * 0.37, material * 0.19)) / 8.0) - 0.5);
      float trace = max(1.0 - smoothstep(0.055, 0.105, circuitCell.x), 1.0 - smoothstep(0.055, 0.105, circuitCell.y));
      float node = 1.0 - smoothstep(0.10, 0.22, length(circuitCell));
      // A thick native sensor is an instrument face, not an eight-cell circuit
      // grid repeated through its full body. The existing exact-species depth
      // proof calms only that deep face; contours, holes, one-cell wires, and
      // shallow sensor matter retain the complete trace grammar below.
      float sensorPanelCore = 0.0;
      if (uSensorMaterialStyling > 0.5 && material >= 164.0 && material <= 170.0
        && family == 0.0 && !materialEmissive && surfaceOnly < 0.5 && halo < 0.5
        && wall < 0.5 && wallOnly < 0.5 && emissionOnly < 0.5
        && solidOpticalDepth > 6.0 / 255.0 && solidInterior > 0.001) {
        sensorPanelCore = smoothstep(6.0 / 255.0, 42.0 / 255.0, solidOpticalDepth)
          * solidInterior;
      }
      float circuitInteriorGain = mix(1.0, 0.26, sensorPanelCore);
      color *= 0.96 + trace * 0.025 * interiorMicroGain * circuitInteriorGain;
      color += mix(color, vec3(0.34, 0.76, 1.0), 0.58)
        * (trace * (0.12 + deviceSurface * 0.035) + node * (0.10 + deviceSurface * 0.045))
        * interiorMicroGain * circuitInteriorGain;
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
        // Reuse the existing broad solid relief and environment reflection to
        // give the depth-proven face one coherent panel volume. The glyph stays
        // readable but the repeated circuit cadence is deliberately quieter in
        // the same interior. This is RGB-only arithmetic over values already
        // live in the solid branch; alpha, support, state, and topology remain
        // entirely semantic.
        float sensorPanelRelief = clamp(solidReliefTone * 255.0 / 6.0, -1.0, 1.0)
          * sensorPanelCore;
        float sensorPanelCrown = max(sensorPanelRelief, 0.0);
        float sensorPanelPocket = max(-sensorPanelRelief, 0.0);
        float sensorPanelGrazing = smoothstep(0.018, 0.18, solidFresnel) * sensorPanelCore;
        color *= vec3(1.0) - vec3(0.032, 0.024, 0.042)
          * (sensorPanelPocket * 0.62 + (1.0 - sensorPanelGrazing) * 0.045);
        color += (vec3(1.0) - clamp(color, 0.0, 1.0))
          * (sensorTint * (sensorPanelCrown * 0.098 + sensorPanelGrazing * 0.052)
            + solidEnvironment * (0.030 + sensorPanelGrazing * 0.055));
        // Preserve one clear diagnostic glyph around a thin or shallow sensor,
        // but let a deep panel read as a single instrument face instead of a
        // tiled decal. The broad crown/pocket above carries that dense body.
        float sensorGlyphGain = mix(1.0, 0.36, sensorPanelCore);
        float sensorBezelGain = mix(1.0, 0.42, sensorPanelCore);
        color *= 1.0 - sensorPanel * (0.014 + sensorPanelCore * 0.010)
          - sensorBezel * (0.036 + sensorPanelCore * 0.012);
        color += sensorTint * (sensorBezel * 0.030 * sensorBezelGain
          + sensorGlyph * 0.082 * sensorGlyphGain);
        color = clamp(color, 0.0, 1.0);
      }
    } else if (profile == 6.0) {
      float planeWave = sin((fieldPosition.x + fieldPosition.y * 0.62) * 0.115 - uTime * 1.15 + material);
      float radialWave = sin(length(fieldPosition - vec2(material * 1.7)) * 0.14 + uTime * 0.92);
      float interference = (planeWave + radialWave) * 0.5;
      color *= 0.95 + interference * 0.045;
    }
    // Portals, holes, vents, and TRON retain one exact-owner static body atop
    // the broad generic Field wave. The default-optics/profile guard keeps
    // force/source Device owners, reconstructed support, walls, emission, and
    // later semantic-role decals outside this RGB-only material layer.
    if (uFieldProfileIdentityStyling > 0.5 && family == 0.0 && profile == 6.0 && optics < 0.5
      && surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5
      && wallOnly < 0.5 && emissionOnly < 0.5 && !materialEmissive) {
      color = clamp(color + fieldProfileIdentityDelta(material, fieldPosition), 0.0, 1.0);
    }
    // Transport/actuator hardware spans force, powered, and ordinary-solid
    // profiles. Its exact IDs may also carry a later semantic role trait, so
    // this static RGB base deliberately sits after generic profile treatment
    // but before those overlays. Canvas mirrors the same owner-local hierarchy
    // with its bounded CPU grammar without altering alpha,
    // holes, channels, walls, material ownership, or physics.
    if (uMechanismBodyStyling > 0.5 && mechanismBodyStyle(material) > 0.5
      && surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5
      && wallOnly < 0.5 && emissionOnly < 0.5 && !materialEmissive) {
      color = clamp(color + mechanismBodyIdentityDelta(material, fieldPosition)
        * (0.58 + interiorMicroGain * 0.42), 0.0, 1.0);
    }
    // Native control hardware retains a detailed static grammar. Canvas mirrors
    // the owner-local hierarchy with bounded CPU marks; this branch is RGB-only
    // and preserves alpha, coverage, holes, walls,
    // owner identity, and physics while allowing role decals to layer later.
    if (uElectronicIdentityStyling > 0.5 && electronicBodyStyle(material) > 0.5
      && surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5
      && wallOnly < 0.5 && emissionOnly < 0.5 && !materialEmissive) {
      color = clamp(color + electronicBodyIdentityDelta(material, fieldPosition)
        * (0.58 + interiorMicroGain * 0.42), 0.0, 1.0);
    }
    // Seventeen uncommon solids layer one static identity over the generic body
    // structure above. Only authoritative semantic matter participates; this
    // RGB arithmetic adds no sample, pass, field, allocation, clock term, or
    // output-scale resource, and leaves later trait decals independent.
    float unusualSolid = material == 27.0 || material == 68.0 || material == 74.0
      || material == 76.0 || material == 77.0 || material == 79.0
      || material == 80.0 || material == 196.0
      || material == 206.0 || material == 208.0 || material == 209.0
      || material == 210.0 || material == 216.0 || material == 203.0
      || material == 204.0 || material == 211.0 || material == 212.0 ? 1.0 : 0.0;
    if (uUnusualSolidStyling > 0.5 && unusualSolid > 0.5
      && family == 0.0 && !materialEmissive
      && surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5
      // VRSS's static capsid sits beneath its later infectious-trait accent;
      // other trait overlays keep their prior exact identity-only path.
      && wallOnly < 0.5 && emissionOnly < 0.5 && (traits < 0.5 || material == 216.0)) {
      vec3 unusualSolidBase = color;
      vec2 solidCell = floor(fieldPosition);
      if (material == 27.0) {
        // WAX: crystalline blooms and cooling lamellae share MWAX's topology.
        color += waxFamilyIdentityDelta(0.0, fieldPosition);
      } else if (material == 203.0) {
        // LOLZ: a static face/ribbon lattice keeps the native pattern matter
        // recognisable without borrowing an actor state or a glow field.
        vec2 local = mod(solidCell, 16.0) - vec2(8.0);
        float leftEye = step(abs(local.x + 4.0), 1.1) * step(abs(local.y + 2.0), 1.1);
        float rightEye = step(abs(local.x - 4.0), 1.1) * step(abs(local.y + 2.0), 1.1);
        float smile = (1.0 - step(1.1, abs(abs(local.x) - 4.0))) * (1.0 - step(0.1, abs(local.y - 3.0)));
        smile = max(smile, (1.0 - step(0.1, abs(abs(local.x) - 5.0))) * (1.0 - step(0.1, abs(local.y - 2.0))));
        float ribbon = 1.0 - step(1.0, mod(solidCell.x * 3.0 - solidCell.y * 2.0, 13.0));
        vec3 delta = (leftEye > 0.5 || rightEye > 0.5) ? vec3(8.0, 12.0, -7.0)
          : (smile > 0.5 ? vec3(10.0, 6.0, -8.0)
          : (ribbon > 0.5 ? vec3(3.0, 5.0, -3.0) : vec3(0.0, 2.0, -1.0)));
        color += delta / 255.0;
      } else if (material == 204.0) {
        // LOVE: paired lobes and a tapered point make a stable heart quilt.
        vec2 local = mod(solidCell, 16.0) - vec2(8.0);
        float leftLobe = 1.0 - step(10.1, dot(local + vec2(3.0, 2.0), local + vec2(3.0, 2.0)));
        float rightLobe = 1.0 - step(10.1, dot(local - vec2(3.0, -2.0), local - vec2(3.0, -2.0)));
        float point = (1.0 - step(5.1, abs(local.x) + abs(local.y - 2.0))) * step(-1.1, local.y);
        float heart = max(max(leftLobe, rightLobe), point);
        float seam = heart * (1.0 - step(0.1, mod(local.x - local.y * 2.0 + 5.0, 5.0)));
        vec3 delta = heart > 0.5 ? (seam > 0.5 ? vec3(5.0, -8.0, 10.0) : vec3(3.0, -4.0, 6.0)) : vec3(-2.0, 1.0, 2.0);
        color += delta / 255.0;
      } else if (material == 211.0 || material == 212.0) {
        // SPAWN/SPAWN2: distinct primary/secondary beacon rings, RGB-only.
        vec2 local = mod(solidCell, 16.0) - vec2(8.0);
        float radius = abs(local.x) + abs(local.y);
        float ring = step(4.9, radius) * (1.0 - step(6.1, radius));
        float core = 1.0 - step(1.1, radius);
        float ray = (1.0 - step(0.1, min(abs(local.x), abs(local.y))))
          * step(2.9, radius) * (1.0 - step(5.1, radius));
        bool secondary = material == 212.0;
        vec3 delta = secondary
          ? (core > 0.5 ? vec3(-5.0, 5.0, 12.0) : (ring > 0.5 ? vec3(-3.0, 3.0, 9.0) : (ray > 0.5 ? vec3(-2.0, 2.0, 6.0) : vec3(-1.0, 1.0, 3.0))))
          : (core > 0.5 ? vec3(10.0, 8.0, -6.0) : (ring > 0.5 ? vec3(7.0, 5.0, -4.0) : (ray > 0.5 ? vec3(4.0, 3.0, -3.0) : vec3(1.0, 1.0, -1.0))));
        color += delta / 255.0;
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
      // Preserve every static material's silhouette-facing motif, while easing
      // only its deep-core delta toward the already-lit body. Native state,
      // active traits, alpha, ownership, and the semantic contour are untouched.
      color = clamp(mix(unusualSolidBase, color, staticSolidIdentityGain), 0.0, 1.0);
    }
    color += spongeHydrationDelta(material, wallState.ba, fieldPosition)
      * uSpngStateStyling;
    if (uFiltSpectrumStyling > 0.5 && material == 69.0
      && (family == 0.0 || family == 4.0) && traits < 0.5 && !materialEmissive
      && wall < 0.5 && surfaceOnly < 0.5 && halo < 0.5 && emissionOnly < 0.5) {
      color += filtSpectrumDelta(color, wallState.ba, materialTemperature);
    }
    if (uQuartzCrystalStateStyling > 0.5 && (material == 29.0 || material == 76.0)
      && (family == 0.0 || family == 4.0) && traits < 0.5 && !materialEmissive
      && wall < 0.5 && surfaceOnly < 0.5 && halo < 0.5 && emissionOnly < 0.5) {
      color += quartzCrystalStateDelta(material, wallState.ba);
    }
    if (uLcryStateStyling > 0.5 && material == 157.0
      && (family == 0.0 || family == 4.0) && traits < 0.5 && !materialEmissive
      && wall < 0.5 && surfaceOnly < 0.5 && halo < 0.5 && emissionOnly < 0.5) {
      color += lcryStateDelta(color, wallState.ba);
    }
    if (uPipePresentationStyling > 0.5 && (material == 121.0 || material == 160.0)
      && (family == 0.0 || family == 4.0) && traits < 0.5 && !materialEmissive
      && wall < 0.5 && surfaceOnly < 0.5 && halo < 0.5 && emissionOnly < 0.5) {
      color += pipePresentationDelta(color, material, wallState.ba);
    }
    if (uStorStateStyling > 0.5 && material == 163.0
      && (family == 0.0 || family == 4.0) && traits < 0.5 && !materialEmissive
      && wall < 0.5 && surfaceOnly < 0.5 && halo < 0.5 && emissionOnly < 0.5) {
      color += storStateDelta(color, wallState.ba);
    }
    if (uSwchStateStyling > 0.5 && material == 149.0
      && (family == 0.0 || family == 4.0) && traits < 0.5 && !materialEmissive
      && wall < 0.5 && surfaceOnly < 0.5 && halo < 0.5 && emissionOnly < 0.5) {
      color += swchStateDelta(color, wallState.ba);
    }
    if (uDlayStateStyling > 0.5 && material == 154.0
      && (family == 0.0 || family == 4.0) && traits < 0.5
      && !materialEmissive && wall < 0.5 && surfaceOnly < 0.5 && halo < 0.5
      && emissionOnly < 0.5) {
      color += dlayCountdownDelta(color, wallState.ba, materialTemperature);
    }
    // WIFI's packed word supplies its own exact owner/presence guard. Keep the
    // native-wall separation here, but do not make the radio's ordinary body
    // cue depend on reconstructed-surface eligibility owned by another pass.
    if (uWifiStateStyling > 0.5 && material == 152.0 && wall < 0.5) {
      color += wifiStateDelta(color, wallState.ba);
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
    // The same bounded hue-preserving ambient lift gives only a genuinely
    // thick, ordinary rigid body a little separation from the dark backdrop.
    // It follows completed body/state composition, retains every edge/contact
    // decision above, and uses the phase-local optical-depth byte already live
    // for solid optics. Granular, translucent, trait, wall, emissive, halo,
    // and reconstructed-support cases are intentionally exact no-ops.
    if (uDenseBodyAmbientFill > 0.5 && family == 0.0 && granularSurface < 0.5
      && translucentSurface < 0.5 && surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5
      && traits < 0.5 && !materialEmissive
      && solidInterior > 0.001 && solidOpticalDepth > 6.0 / 255.0) {
      float solidAmbientBody = solidInterior
        * smoothstep(6.0 / 255.0, 42.0 / 255.0, solidOpticalDepth);
      float solidAmbientLift = min(5.0 / 255.0, solidAmbientBody * 5.0 / 255.0);
      color *= 1.0 + solidAmbientLift;
    }
  }
  if (uEnergyIdentityStyling > 0.5 && halo < 0.5 && surfaceOnly < 0.5
    && wallOnly < 0.5 && emissionOnly < 0.5
    && (material == 93.0 || material == 97.0)) {
    color = clamp(
      color + electricDischargeIdentityDelta(material, fieldPosition),
      0.0, 1.0
    );
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
  // Geological owners may use the shared solid-body proof even when their
  // optical class is granular (Coal). Keeping this after the family branches
  // avoids making owner identity depend on the generic Smooth path, while the
  // existing exact interior/depth guard still rejects walls, seams, holes,
  // thin strokes, reconstructed support, traits, and emission.
  if (uGeologicalSolidStyling > 0.5 && family == 0.0
    && surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5
    && wallOnly < 0.5 && emissionOnly < 0.5 && traits < 0.5 && !materialEmissive
    && (material == 19.0 || material == 78.0)
    && solidOpticalDepth > 6.0 / 255.0) {
    float geologicalDepth = smoothstep(6.0 / 255.0, 42.0 / 255.0, solidOpticalDepth);
    float geologicalRelief = clamp(solidReliefTone * 255.0 / 7.0, -1.0, 1.0)
      * geologicalDepth;
    color = clamp(color + geologicalSolidCoreDelta(
      material, fieldPosition, geologicalDepth, geologicalRelief
    ), 0.0, 1.0);
  }
  // Thermal/catalytic rigid owners layer only over a depth-proven ordinary
  // solid core. RSSS retains its earlier native surface morphology; this is a
  // separate static body volume below it rather than a contour treatment.
  if (uThermalCatalyticRigidStyling > 0.5 && family == 0.0
    && surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5
    && wallOnly < 0.5 && emissionOnly < 0.5 && traits < 0.5 && !materialEmissive
    && (material == 72.0 || material == 75.0 || material == 79.0)
    && solidOpticalDepth > 6.0 / 255.0) {
    float thermalCatalyticDepth = smoothstep(6.0 / 255.0, 42.0 / 255.0, solidOpticalDepth);
    float thermalCatalyticRelief = clamp(solidReliefTone * 255.0 / 7.0, -1.0, 1.0)
      * thermalCatalyticDepth;
    color = clamp(color + thermalCatalyticRigidCoreDelta(
      material, fieldPosition, thermalCatalyticDepth, thermalCatalyticRelief
    ), 0.0, 1.0);
  }
  if (uGooSolidStyling > 0.5 && family == 0.0
    && surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5
    && wallOnly < 0.5 && emissionOnly < 0.5 && traits < 0.5 && !materialEmissive
    && material == 71.0 && solidOpticalDepth > 6.0 / 255.0) {
    float gooDepth = smoothstep(6.0 / 255.0, 42.0 / 255.0, solidOpticalDepth);
    float gooRelief = clamp(solidReliefTone * 255.0 / 7.0, -1.0, 1.0) * gooDepth;
    color = clamp(color + gooSolidCoreDelta(fieldPosition, gooDepth, gooRelief), 0.0, 1.0);
  }
  // Apply only to an authoritative FRAY body. The ordinary Force role decal
  // still renders afterwards and no state/polarity/topology is inferred here.
  if (uFrayForceStyling > 0.5 && material == 118.0
    && surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5
    && wallOnly < 0.5 && emissionOnly < 0.5 && !materialEmissive) {
    color = clamp(color + frayForceIdentityDelta(fieldPosition), 0.0, 1.0);
  }
  if (uGbmbForceStyling > 0.5 && material == 120.0
    && surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5
    && wallOnly < 0.5 && emissionOnly < 0.5 && !materialEmissive) {
    color = clamp(color + gbmbForceIdentityDelta(fieldPosition), 0.0, 1.0);
  }
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
    color += forceActivityDelta(material, wallState.ba, fieldPosition)
      * uForceActivityStyling;
    if (radioactive > 0.5 && energyCore < 0.5) {
      color += radioactiveBodyIdentityDelta(material, fieldPosition)
        * uEnergyIdentityStyling;
      color += poloStateDelta(material, wallState.ba, fieldPosition)
        * uPoloStateStyling;
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
      // Fine PLNT identity is a leaf-scale cue, not a competing surface field.
      // Restrict its calm-down to a real deep, ordinary canopy: tips, stems,
      // gaps, co-located walls, and reconstructed support keep the full native
      // diagnostic motif; lifecycle colour and all semantic topology remain
      // authoritative in their existing paths.
      float canopyFineIdentityGain = 1.0;
      if (material == 10.0 && uSolidOpticalDepth > 0.5
        && solidOpticalDepth > 6.0 / 255.0 && solidInterior > 0.001
        && surfaceOnly < 0.5 && halo < 0.5 && wall < 0.5
        && wallOnly < 0.5 && emissionOnly < 0.5) {
        float canopyFineBody = smoothstep(6.0 / 255.0, 42.0 / 255.0, solidOpticalDepth)
          * solidInterior;
        canopyFineIdentityGain = mix(1.0, 0.42, canopyFineBody);
      }
      color += botanicalIdentityDelta(material, fieldPosition, canopyFineIdentityGain);
    }
    if (uBotanicalLifecycleStyling > 0.5 && (material == 10.0 || material == 50.0)) {
      color += botanicalLifecycleDelta(material, wallState.ba, fieldPosition, color);
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
  if (uHDRVfx > 0.5) {
    float temperatureByte = floor(materialTemperature * 255.0 + 0.5);
    float radiance = blackbodyHdrRadiance(temperatureByte);
    float thermalCore = (material == 4.0 || material == 11.0 || material == 20.0) ? 1.0 : 0.0;
    float incandescentMatter = !materialEmissive && traits < 0.5
      && material != 3.0 && (family == 0.0 || family == 4.0) ? 1.0 : 0.0;
    float blackbodyEligible = max(thermalCore, incandescentMatter);
    if (blackbodyEligible > 0.5 && radiance > 0.001) {
      vec3 blackbody = blackbodyColor(temperatureByte);
      float reveal = smoothstep(0.0, 0.85, radiance)
        * mix(0.28, 0.52, thermalCore);
      color = mix(color, blackbody * (0.72 + radiance * 0.10), reveal);
      color += blackbody * radiance * mix(0.18, 0.46, thermalCore)
        * (uHDRVfx > 1.5 ? 1.18 : 1.0);
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
    vec3 fieldLightContribution = emissionState.rgb * lightReach * lightResponse;
    // E06: recompose the generic exposed-powder tint into a restrained bulk
    // bounce only after the same dry, exact-material, stable Smooth body proof
    // used by E02/E05. Nearby field intensity owns locality and colour; the
    // existing macro slope shapes the crown while depth attenuates the core.
    // This extends the already-present centre-sample contribution in place—it
    // does not sample or composite a second light—and changes RGB only.
    // Local/Grains, motion, holes, thin structures, traits, walls, wet
    // suspension, reconstructed support, emissive matter, and every
    // non-powder phase remain exact no-ops.
    if (uPowderLightVfx > 0.5 && powderLightBodyGate > 0.001) {
      float powderLightCrown = max(powderLightBodySlope, 0.0);
      // Preferentially lift the weak tail of the already-sampled compact field
      // so light enters several stable body cells instead of reading as a rim.
      // The blended root keeps both endpoints fixed while avoiding a shoulder
      // so strong that display tonemapping compresses Concrete's fine pigment.
      float powderLightReach = mix(lightReach, sqrt(lightReach), 0.65);
      float powderLightTransport = min(
        0.082,
        powderLightReach * (
          mix(0.052, 0.030, powderLightBodyDepth)
            + powderLightCrown * 0.036
        )
      );
      vec3 powderLightSpectrum = max(
        vividColor(emissionState.rgb, 1.10), vec3(0.0)
      );
      // Derive one material-constant headroom scalar from canonical albedo.
      // A per-channel screen blend would attenuate the very grain contrast E05
      // protects; this broad additive spectrum leaves that local cadence intact.
      float powderLightHeadroom = max(
        0.0, 1.18 - max(base.r, max(base.g, base.b))
      );
      vec3 powderLightPigmentCarrier = clamp(
        color / max(base, vec3(0.08)), vec3(0.72), vec3(1.28)
      );
      vec3 powderLightContribution = fieldLightContribution
        + powderLightHeadroom * powderLightSpectrum * powderLightTransport
          * powderLightPigmentCarrier;
      fieldLightContribution = mix(
        fieldLightContribution, powderLightContribution, powderLightBodyGate
      );
    }
    color += fieldLightContribution;
  }
  if (uSparkStateStyling > 0.5 && material == 148.0) {
    color += sparkStateDelta(material, wallState.ba, fieldPosition, color);
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
  // Only a dense shared body may take the wet-sediment albedo. Keeping the
  // existing liquid/powder contour band out of this late RGB blend preserves
  // the established composed curved-edge crossing and leaves sparse material
  // visibly phase-specific. The half-resolution field already rejects sparse
  // grains and exposed phase edges; retain the compatible local body shoulder
  // too because this field is deliberately powder-authored, not a replacement
  // for authoritative aqueous liquid coverage.
  // Exact Sand and Water can alternate inside one settled two-cell field
  // tile. The shared field's dense alpha is therefore a second body proof;
  // it restores one wet-material albedo without ever changing support or
  // alpha, while sparse field wisps remain below this higher knee.
  float suspensionSemanticBody = smoothstep(0.62, 0.90, density);
  float suspensionFieldBody = smoothstep(0.24, 0.68, suspensionState.a);
  float suspensionBody = max(suspensionSemanticBody, suspensionFieldBody);
  float lateSuspension = max(suspensionPowder, suspensionLiquid)
    * smoothstep(0.05, 0.62, suspensionState.a) * suspensionBody * 0.98;
  if (lateSuspension > 0.001) {
    // Dense field-proven suspension has settled enough to show more of its
    // shared mineral body, while a shallow plume remains water-forward. This
    // is deliberately one common target for the eligible aqueous and powder
    // owners, so it improves volume without reintroducing a cyan/ochre phase
    // boundary or touching semantic support.
    float sedimentCompaction = smoothstep(0.18, 0.82, suspensionState.a);
    // The retained field RGB is the exact powder owner. Keep a dense body
    // aqueous-forward so the supported volume reads as wet mineral, rather
    // than letting individual ochre owners reappear through a cyan pool.
    float wetSedimentBias = mix(0.44, 0.52, sedimentCompaction);
    vec3 wetSediment = vividColor(
      mix(liquidState.rgb, suspensionState.rgb, wetSedimentBias),
      mix(1.10, 1.06, sedimentCompaction)
    );
    float currentLuma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float wetLuma = dot(wetSediment, vec3(0.2126, 0.7152, 0.0722));
    // The shared liquid field already supplies the macro body shape. Preserve
    // only four RGB bytes of local relief: larger residuals make alternating
    // authoritative powder/liquid cells visible again at a normal zoom.
    float relief = clamp(currentLuma - wetLuma, -4.0 / 255.0, 4.0 / 255.0);
    color = mix(
      color, wetSediment + vec3(relief),
      lateSuspension * mix(0.96, 1.0, sedimentCompaction)
    );
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
  // PHOT has its own native map and can share this world cell with pmap matter.
  // Keep the extra nearest lookup dormant for scenes with no projected photons,
  // then apply its spectral core RGB after all matter/wall composition without
  // claiming support or changing alpha.
  if (uPhotonActive > 0.5) {
    vec4 photonState = texture(uPhotonStateTexture, fieldUv);
    float photonLow = floor(photonState.r * 255.0 + 0.5);
    float photonHigh = floor(photonState.g * 255.0 + 0.5);
    if (photonHigh >= 128.0) {
      vec3 photonSpectrum = vec3(
        mod(photonLow, 16.0),
        mod(floor(photonLow / 16.0), 16.0),
        mod(photonHigh, 16.0)
      ) * (16.0 / 255.0);
      float photonPeak = max(photonSpectrum.r, max(photonSpectrum.g, photonSpectrum.b));
      float photonAmount = 0.44 + min(0.18, photonPeak * 0.24);
      premultiplied = mix(premultiplied, photonSpectrum * compositeAlpha, photonAmount);
    }
  }
  finalColor = vec4(premultiplied, compositeAlpha);
}
`;

/** Primary WebGL presentation of raw simulation semantics. */
export class PixiFieldPresenter {
  private readonly scene = new Container();
  private hdrVfxPipeline?: HDRVfxPipeline;
  private hdrPipelineInfo: HDRPipelineInfo;
  private readonly fieldBytes: Uint8Array;
  private readonly fieldSource: BufferImageSource;
  private readonly wallBytes: Uint8Array;
  private readonly wallSource: BufferImageSource;
  private readonly photonStateBytes: Uint8Array;
  private readonly photonStateSource: BufferImageSource;
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
  private webGLTimingQueryStartedAt = 0;
  private webGLTimingFence?: WebGLSync;
  private webGLTimingFenceStartedAt = 0;
  private webGLTimingFencePoll = 0;
  private readonly webGLTimingSamples: number[] = [];
  private webGLTimingDiscarded = 0;
  private webGLTimingSequence = 0;
  private powderSurfaceDirty = true;
  private solidOpticalDepthDirty = true;
  private photonStateActive = false;
  private photonStateHydrated = false;
  private nativeWallsActive = false;
  private nativeWallsHydrated = false;
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
  // requestAnimationFrame is deliberately used for cheap completion polling,
  // but a wedged/backgrounded browser may stop delivering animation frames.
  // Keep an independent wall-clock watchdog for an already promoted 8x fence
  // so that condition still recovers the bounded Canvas fallback on time.
  private renderFenceWatchdog?: ReturnType<typeof setTimeout>;
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
    this.photonStateBytes = new Uint8Array(width * height * 4);
    this.photonStateSource = new BufferImageSource({
      resource: this.photonStateBytes, width, height, format: 'rgba8unorm',
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
    const renderLook = resolveRenderLook();
    const volumeVfxEnabled = resolveVolumeVfxEnabled(renderLook);
    // E05 follows the normal-detail HDR boundary. The compact true-8x shader
    // retains its established powder body and does not declare this uniform.
    const powderBodyVfxEnabled = outputScale < 8
      && resolvePowderBodyVfxEnabled(renderLook);
    // E06 is a normal-detail recomposition of the existing centre-field light.
    // The protected compact shader retains its one established emission sample.
    const powderLightVfxEnabled = outputScale < 8
      && resolvePowderLightVfxEnabled(renderLook);
    // E04 follows the same normal-detail boundary as E03. The protected true
    // 8x shader deliberately has neither this uniform nor its arithmetic.
    const gasBodyVfxEnabled = outputScale < 8
      && resolveGasBodyVfxEnabled(renderLook);
    // E03 is a normal-detail experiment. The true-8x shader intentionally has
    // no corresponding uniform or arithmetic, so its public capability state
    // must not advertise an effect that cannot run on that path.
    const liquidBodyVfxEnabled = outputScale < 8
      && resolveLiquidBodyVfxEnabled(renderLook);
    this.uniforms = new UniformGroup({
      uTexel: { value: new Float32Array([1 / width, 1 / height]), type: 'vec2<f32>' },
      uFieldSize: { value: new Float32Array([width, height]), type: 'vec2<f32>' },
      uAtmosphereTexel: { value: new Float32Array([1 / this.fieldSet.atmosphere.width, 1 / this.fieldSet.atmosphere.height]), type: 'vec2<f32>' },
      uEmissionTexel: { value: new Float32Array([1 / this.fieldSet.emission.width, 1 / this.fieldSet.emission.height]), type: 'vec2<f32>' },
      uTime: { value: 0, type: 'f32' },
      uHDRVfx: {
        value: renderLook === 'classic' ? 0 : renderLook === 'neon-lab' ? 2 : 1,
        type: 'f32',
      },
      uVolumeVfx: { value: volumeVfxEnabled ? 1 : 0, type: 'f32' },
      uGasBodyVfx: { value: gasBodyVfxEnabled ? 1 : 0, type: 'f32' },
      uLiquidBodyVfx: { value: liquidBodyVfxEnabled ? 1 : 0, type: 'f32' },
      uPowderBodyVfx: { value: powderBodyVfxEnabled ? 1 : 0, type: 'f32' },
      uPowderLightVfx: { value: powderLightVfxEnabled ? 1 : 0, type: 'f32' },
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
      uAqueousSurfaceReflection: { value: 1, type: 'f32' },
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
      uDenseBodyAmbientFill: { value: 1, type: 'f32' },
      uRoleMaterialStyling: { value: 1, type: 'f32' },
      uCellularMaterialStyling: { value: 1, type: 'f32' },
      uStructuralRigidStyling: { value: 1, type: 'f32' },
      uGeologicalSolidStyling: { value: 1, type: 'f32' },
      uThermalCatalyticRigidStyling: { value: 1, type: 'f32' },
      uGooSolidStyling: { value: 1, type: 'f32' },
      uFrayForceStyling: { value: 1, type: 'f32' },
      uGbmbForceStyling: { value: 1, type: 'f32' },
      uMechanismBodyStyling: { value: 1, type: 'f32' },
      uElectronicIdentityStyling: { value: 1, type: 'f32' },
      uFieldProfileIdentityStyling: { value: 1, type: 'f32' },
      uEarthenPowderStyling: { value: 1, type: 'f32' },
      uPowderMesostrataStyling: { value: 1, type: 'f32' },
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
      uForceActivityStyling: { value: 1, type: 'f32' },
      uPoloStateStyling: { value: 1, type: 'f32' },
      uSpngStateStyling: { value: 1, type: 'f32' },
      uGelHydrationStyling: { value: 1, type: 'f32' },
      uFiltSpectrumStyling: { value: 1, type: 'f32' },
      uQuartzCrystalStateStyling: { value: 1, type: 'f32' },
      uLcryStateStyling: { value: 1, type: 'f32' },
      uPipePresentationStyling: { value: 1, type: 'f32' },
      uStorStateStyling: { value: 1, type: 'f32' },
      uSwchStateStyling: { value: 1, type: 'f32' },
      uDlayStateStyling: { value: 1, type: 'f32' },
      uWifiStateStyling: { value: 1, type: 'f32' },
      uLavaAncestryStyling: { value: 1, type: 'f32' },
      uMoltenBodyOptics: { value: 1, type: 'f32' },
      uBotanicalIdentityStyling: { value: 1, type: 'f32' },
      uBotanicalLifecycleStyling: { value: 1, type: 'f32' },
      uSparkStateStyling: { value: 1, type: 'f32' },
      uPhotonActive: { value: 0, type: 'f32' },
      // Keep the direct 8x empty path sampler-free until the independent native
      // wall plane has actual content. This is refreshed only after initial or
      // dirty wall uploads, never by a per-fragment material decision.
      uNativeWallsActive: { value: 0, type: 'f32' },
      uPowderStyle: { value: powderRenderStyleValue('smooth'), type: 'f32' },
      // Keep the true-8x empty fast path sampler-free unless the shared stable
      // powder field really has a settled surface to project.
      uPowderSurfaceActive: { value: this.fieldSet.powderSurface.hasSurface ? 1 : 0, type: 'f32' },
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
      uPhotonStateTexture: this.photonStateSource,
      uPhotonStateSampler: this.photonStateSource.style,
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
      // The direct mesh owns explicit resources rather than Sprite-owned
      // textures. Register every shader source before an update can occur so
      // Pixi installs each WebGL upload listener; without this, the 8x mesh
      // can sample an all-zero semantic/palette/style resource indefinitely.
      const textureSystem = this.app.renderer as {
        texture?: { initSource(source: TextureSource): void };
      };
      for (const source of [
        this.fieldSource, this.wallSource, this.photonStateSource,
        this.atmosphereSource, this.atmosphereStyleSource, gasIdentityMotifSource,
        this.emissionSource, this.liquidSource, this.boundaryStabilitySource,
        this.powderSurfaceSource, this.suspensionSource,
        paletteTexture.source, styleTexture.source,
      ]) textureSystem.texture?.initSource(source);
      // The semantic plane is refreshed by `update()` before the first draw,
      // but palette/style are immutable lookup rows.  Merely registering their
      // BufferImageSources is not enough on every direct-mesh WebGL path: a
      // driver may leave the initial R8/RGBA upload deferred, making every
      // family and role trait read as zero at true 8×. Explicitly publish the
      // two preallocated rows once; this adds no texture, pass, or per-frame
      // upload and retains the normal path's exact lookup data.
      paletteTexture.source.update();
      styleTexture.source.update();
      const shader = Shader.from({
        gl: { vertex: FIELD_VERTEX, fragment: FIELD_EIGHT_X_FRAGMENT, name: 'semantic-field-mesh' },
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
    const hdr = HDRVfxPipeline.create(
      this.app, this.scene, width, height, outputScale, renderLook,
    );
    this.hdrVfxPipeline = hdr.pipeline;
    this.hdrPipelineInfo = hdr.info;
    if (!this.hdrVfxPipeline) {
      // Capability or initialization failure returns to the established SDR
      // shader as well as its single-pass target. Leaving the HDR uniform set
      // would retain blackbody over-range values without the float composite
      // that is responsible for tonemapping them.
      this.uniforms.uniforms.uHDRVfx = 0;
      this.uniforms.uniforms.uVolumeVfx = 0;
      this.uniforms.uniforms.uGasBodyVfx = 0;
      this.uniforms.uniforms.uLiquidBodyVfx = 0;
      this.uniforms.uniforms.uPowderBodyVfx = 0;
      this.uniforms.uniforms.uPowderLightVfx = 0;
      this.app.stage.addChild(this.scene);
    }
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
          && (new URLSearchParams(location.search).get('blankAudit') === '1'
            || new URLSearchParams(location.search).get('volumeVfxAudit') === '1'
            || new URLSearchParams(location.search).get('gasBodyVfxAudit') === '1'
            || new URLSearchParams(location.search).get('liquidBodyVfxAudit') === '1'
            || new URLSearchParams(location.search).get('powderBodyVfxAudit') === '1'
            || new URLSearchParams(location.search).get('powderLightVfxAudit') === '1'),
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
    presenter.app.canvas.dataset.renderLook = presenter.hdrPipelineInfo.look;
    presenter.app.canvas.dataset.hdrPipeline = presenter.hdrPipelineInfo.active ? 'active' : 'inactive';
    presenter.app.canvas.dataset.volumeVfx = Number(presenter.uniforms.uniforms.uVolumeVfx) > 0.5
      ? 'active' : 'inactive';
    presenter.app.canvas.dataset.gasBodyVfx = Number(presenter.uniforms.uniforms.uGasBodyVfx) > 0.5
      ? 'active' : 'inactive';
    presenter.app.canvas.dataset.liquidBodyVfx = Number(presenter.uniforms.uniforms.uLiquidBodyVfx) > 0.5
      ? 'active' : 'inactive';
    presenter.app.canvas.dataset.powderBodyVfx = Number(presenter.uniforms.uniforms.uPowderBodyVfx) > 0.5
      ? 'active' : 'inactive';
    presenter.app.canvas.dataset.powderLightVfx = Number(presenter.uniforms.uniforms.uPowderLightVfx) > 0.5
      ? 'active' : 'inactive';
    if (presenter.hdrPipelineInfo.reason) {
      presenter.app.canvas.dataset.hdrPipelineReason = presenter.hdrPipelineInfo.reason;
    }
    if (presenter.hdrPipelineInfo.bloomWidth && presenter.hdrPipelineInfo.bloomHeight) {
      presenter.app.canvas.dataset.bloomBacking = presenter.hdrPipelineInfo.bloomWidth
        + 'x' + presenter.hdrPipelineInfo.bloomHeight;
    }
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
    try { this.hdrVfxPipeline?.destroy(); }
    catch { /* a lost context may already own the optional experiment targets */ }
    this.hdrVfxPipeline = undefined;
    // Browser navigation may keep a detached canvas' GPU allocation alive
    // until its normal garbage-collection turn. A Detail change replaces this
    // presenter with a potentially 60 MiB true-8x target, so explicitly lose
    // the outgoing context before Pixi releases DOM ownership.
    try {
      const canvas = this.app.canvas;
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { /* a context loss or document teardown may already own it */ }
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
      clientToVisualViewport({ x: clientX, y: clientY }),
      this.app.canvas.getBoundingClientRect(), this.width, this.height,
    );
  }

  presentationAuxiliaryAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return -1;
    return this.boundaryStabilityBytes[y * this.width + x];
  }

  /** Narrow audit readback for an exact-owner optional presentation layer. */
  geologicalSolidStylingEnabled(): boolean {
    const value = this.uniforms.uniforms.uGeologicalSolidStyling;
    return typeof value === 'number' && value > 0.5;
  }

  /** Narrow audit readback for the HEAC/PTNM/RSSS deep-body layer. */
  thermalCatalyticRigidStylingEnabled(): boolean {
    const value = this.uniforms.uniforms.uThermalCatalyticRigidStyling;
    return typeof value === 'number' && value > 0.5;
  }

  gooSolidStylingEnabled(): boolean {
    const value = this.uniforms.uniforms.uGooSolidStyling;
    return typeof value === 'number' && value > 0.5;
  }

  frayForceStylingEnabled(): boolean {
    const value = this.uniforms.uniforms.uFrayForceStyling;
    return typeof value === 'number' && value > 0.5;
  }

  gbmbForceStylingEnabled(): boolean {
    const value = this.uniforms.uniforms.uGbmbForceStyling;
    return typeof value === 'number' && value > 0.5;
  }

  /** Audit-only proof that the live role-control write reached this presenter. */
  roleMaterialStylingEnabled(): boolean {
    const value = this.uniforms.uniforms.uRoleMaterialStyling;
    return typeof value === 'number' && value > 0.5;
  }

  /** Audit-only readback of the material byte staged for the semantic texture. */
  semanticMaterialAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return -1;
    return this.fieldBytes[(y * this.width + x) * 4];
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

  /** Exact CPU-field support evidence for RGB-only atmosphere style audits. */
  atmosphereSupportAudit(): AtmosphereSupportAudit {
    const bytes = this.fieldSet.atmosphere.bytes;
    let nonzero = 0;
    let alphaSum = 0;
    let signature = 2166136261;
    for (let offset = 3; offset < bytes.length; offset += 4) {
      const alpha = bytes[offset];
      nonzero += Number(alpha !== 0);
      alphaSum += alpha;
      signature = Math.imul(signature ^ alpha, 16777619) >>> 0;
    }
    return { nonzero, alphaSum, signature };
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
    forceActivityStylingEnabled = true,
    poloStateStylingEnabled = true,
    spngStateStylingEnabled = true,
    gelHydrationStylingEnabled = true,
    filtSpectrumStylingEnabled = true,
    quartzCrystalStateStylingEnabled = true,
    lavaAncestryStylingEnabled = true,
    botanicalLifecycleStylingEnabled = true,
    sparkStateStylingEnabled = true,
    structuralRigidStylingEnabled = true,
    geologicalSolidStylingEnabled = true,
    thermalCatalyticRigidStylingEnabled = true,
    gooSolidStylingEnabled = true,
    frayForceStylingEnabled = true,
    gbmbForceStylingEnabled = true,
    earthenPowderStylingEnabled = true,
    powderMesostrataStylingEnabled = true,
    moltenBodyOpticsEnabled = true,
    aqueousSurfaceReflectionEnabled = true,
    mechanismBodyStylingEnabled = true,
    electronicIdentityStylingEnabled = true,
    fieldProfileIdentityStylingEnabled = true,
    lcryStateStylingEnabled = true,
    pipePresentationStylingEnabled = true,
    storStateStylingEnabled = true,
    swchStateStylingEnabled = true,
    denseBodyAmbientFillEnabled = true,
    dlayStateStylingEnabled = true,
    wifiStateStylingEnabled = true,
  ): void {
    const uniforms = this.uniforms.uniforms;
    uniforms.uGasFieldLighting = gasFieldLightingEnabled ? 1 : 0;
    uniforms.uLiquidFieldLighting = liquidFieldLightingEnabled ? 1 : 0;
    uniforms.uAqueousSurfaceReflection = aqueousSurfaceReflectionEnabled ? 1 : 0;
    uniforms.uTranslucentFieldTransmission = translucentFieldTransmissionEnabled ? 1 : 0;
    uniforms.uTranslucentBackdropRefraction = translucentBackdropRefractionEnabled ? 1 : 0;
    uniforms.uSolidContactDepth = solidContactDepthEnabled ? 1 : 0;
    uniforms.uTranslucentLensShell = translucentLensShellEnabled ? 1 : 0;
    uniforms.uSolidCurvatureDepth = solidCurvatureDepthEnabled ? 1 : 0;
    uniforms.uSurfaceContourLighting = surfaceContourLightingEnabled ? 1 : 0;
    uniforms.uPhaseContactLighting = phaseContactLightingEnabled ? 1 : 0;
    uniforms.uSolidFieldLighting = solidFieldLightingEnabled ? 1 : 0;
    uniforms.uDenseBodyAmbientFill = denseBodyAmbientFillEnabled ? 1 : 0;
    uniforms.uLiquidSilhouetteCohesion = liquidSilhouetteCohesionEnabled ? 1 : 0;
    uniforms.uGasVolumeChroma = gasVolumeChromaEnabled ? 1 : 0;
    uniforms.uGasIdentityStyling = gasIdentityStylingEnabled ? 1 : 0;
    uniforms.uEmissionVolumeChroma = emissionVolumeChromaEnabled ? 1 : 0;
    uniforms.uLiquidVolumeChroma = liquidVolumeChromaEnabled ? 1 : 0;
    uniforms.uLiquidOpticalDepth = liquidOpticalDepthEnabled ? 1 : 0;
    uniforms.uSolidOpticalDepth = solidOpticalDepthEnabled ? 1 : 0;
    uniforms.uRoleMaterialStyling = roleMaterialStylingEnabled ? 1 : 0;
    uniforms.uCellularMaterialStyling = cellularMaterialStylingEnabled ? 1 : 0;
    uniforms.uStructuralRigidStyling = structuralRigidStylingEnabled ? 1 : 0;
    uniforms.uGeologicalSolidStyling = geologicalSolidStylingEnabled ? 1 : 0;
    uniforms.uThermalCatalyticRigidStyling = thermalCatalyticRigidStylingEnabled ? 1 : 0;
    uniforms.uGooSolidStyling = gooSolidStylingEnabled ? 1 : 0;
    uniforms.uFrayForceStyling = frayForceStylingEnabled ? 1 : 0;
    uniforms.uGbmbForceStyling = gbmbForceStylingEnabled ? 1 : 0;
    uniforms.uMechanismBodyStyling = mechanismBodyStylingEnabled ? 1 : 0;
    uniforms.uElectronicIdentityStyling = electronicIdentityStylingEnabled ? 1 : 0;
    uniforms.uFieldProfileIdentityStyling = fieldProfileIdentityStylingEnabled ? 1 : 0;
    uniforms.uEarthenPowderStyling = earthenPowderStylingEnabled ? 1 : 0;
    uniforms.uPowderMesostrataStyling = powderMesostrataStylingEnabled ? 1 : 0;
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
    uniforms.uForceActivityStyling = forceActivityStylingEnabled ? 1 : 0;
    uniforms.uPoloStateStyling = poloStateStylingEnabled ? 1 : 0;
    uniforms.uSpngStateStyling = spngStateStylingEnabled ? 1 : 0;
    uniforms.uGelHydrationStyling = gelHydrationStylingEnabled ? 1 : 0;
    uniforms.uFiltSpectrumStyling = filtSpectrumStylingEnabled ? 1 : 0;
    uniforms.uQuartzCrystalStateStyling = quartzCrystalStateStylingEnabled ? 1 : 0;
    uniforms.uLcryStateStyling = lcryStateStylingEnabled ? 1 : 0;
    uniforms.uPipePresentationStyling = pipePresentationStylingEnabled ? 1 : 0;
    uniforms.uStorStateStyling = storStateStylingEnabled ? 1 : 0;
    uniforms.uSwchStateStyling = swchStateStylingEnabled ? 1 : 0;
    uniforms.uDlayStateStyling = dlayStateStylingEnabled ? 1 : 0;
    uniforms.uWifiStateStyling = wifiStateStylingEnabled ? 1 : 0;
    uniforms.uLavaAncestryStyling = lavaAncestryStylingEnabled ? 1 : 0;
    uniforms.uMoltenBodyOptics = moltenBodyOpticsEnabled ? 1 : 0;
    uniforms.uBotanicalIdentityStyling = botanicalIdentityStylingEnabled ? 1 : 0;
    uniforms.uBotanicalLifecycleStyling = botanicalLifecycleStylingEnabled ? 1 : 0;
    uniforms.uSparkStateStyling = sparkStateStylingEnabled ? 1 : 0;
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

  setAqueousSurfaceReflectionEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uAqueousSurfaceReflection = enabled ? 1 : 0;
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

  /** Normal-WebGL-only body-core fill; direct 8x deliberately stays compact. */
  setDenseBodyAmbientFillEnabled(enabled: boolean): void {
    if (this.outputScale >= 8) return;
    this.uniforms.uniforms.uDenseBodyAmbientFill = enabled ? 1 : 0;
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

  setStructuralRigidStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uStructuralRigidStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setGeologicalSolidStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uGeologicalSolidStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setThermalCatalyticRigidStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uThermalCatalyticRigidStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setGooSolidStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uGooSolidStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setFrayForceStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uFrayForceStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setGbmbForceStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uGbmbForceStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setMechanismBodyStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uMechanismBodyStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setElectronicIdentityStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uElectronicIdentityStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setFieldProfileIdentityStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uFieldProfileIdentityStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setEarthenPowderStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uEarthenPowderStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setPowderMesostrataStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uPowderMesostrataStyling = enabled ? 1 : 0;
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

  setForceActivityStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uForceActivityStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setPoloStateStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uPoloStateStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setSpngStateStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uSpngStateStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setGelHydrationStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uGelHydrationStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setFiltSpectrumStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uFiltSpectrumStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setQuartzCrystalStateStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uQuartzCrystalStateStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setLcryStateStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uLcryStateStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setPipePresentationStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uPipePresentationStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setStorStateStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uStorStateStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setSwchStateStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uSwchStateStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setDlayStateStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uDlayStateStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setWifiStateStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uWifiStateStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setLavaAncestryStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uLavaAncestryStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  /** WebGL-only dense Lava optics; Canvas keeps its safe semantic fallback. */
  setMoltenBodyOpticsEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uMoltenBodyOptics = enabled ? 1 : 0;
    this.renderApplication();
  }

  setBotanicalIdentityStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uBotanicalIdentityStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setBotanicalLifecycleStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uBotanicalLifecycleStyling = enabled ? 1 : 0;
    this.renderApplication();
  }

  setSparkStateStylingEnabled(enabled: boolean): void {
    this.uniforms.uniforms.uSparkStateStyling = enabled ? 1 : 0;
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
    // At true 8x, one ordinary presentation fence may still own the only GPU
    // frame in flight. Do not report an audit sample as accepted until that
    // fence has signalled: otherwise the timing request is merely queued behind
    // a 15M-fragment frame and a short completed-frame wait measures neither
    // the requested frame nor its fence. The browser audit retries acceptance
    // through the same bounded 30-second queue deadline as ordinary latest-wins
    // presentation.
    if (this.outputScale === 8 && !this.prepareEightXRender()) return false;
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
    photonState: Uint16Array | undefined,
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
      if (photonState) {
        packPhotonStateRect(
          this.photonStateBytes, this.photonStateSource.width, photonState, rect,
        );
      }
    }
    if (rectangles.length) {
      this.fieldSource.update();
      boundaryTextureDirty = true;
    }
    let wallTextureDirty = rectangles.length > 0 && presentationState !== undefined;
    const photonTextureDirty = rectangles.length > 0 && photonState !== undefined;
    const wallRectangles = this.wallChunks.consume();
    if (walls) for (const rect of wallRectangles) packWallRect(this.wallBytes, this.wallSource.width, walls, rect);
    if (walls && wallRectangles.length) wallTextureDirty = true;
    if (!walls) {
      this.nativeWallsActive = false;
      this.nativeWallsHydrated = false;
    } else if (!this.nativeWallsHydrated || wallRectangles.length) {
      this.nativeWallsActive = false;
      for (let index = 0; index < walls.length; index++) {
        if (walls[index] === 0) continue;
        this.nativeWallsActive = true;
        break;
      }
      this.nativeWallsHydrated = true;
    }
    this.uniforms.uniforms.uNativeWallsActive = this.nativeWallsActive ? 1 : 0;
    if (wallTextureDirty) this.wallSource.update();
    if (photonTextureDirty) this.photonStateSource.update();
    // Native PHOT can move without a pmap material mutation, so a dynamic
    // refresh is authoritative for removal as well as arrival. Avoid a second
    // full-world JS scan on every ordinary particle dirty frame.
    if (!photonState) {
      this.photonStateActive = false;
      this.photonStateHydrated = false;
    } else if (!this.photonStateHydrated || refreshDynamicFields) {
      this.photonStateActive = photonStateIsActive(photonState);
      this.photonStateHydrated = true;
    }
    this.uniforms.uniforms.uPhotonActive = this.photonStateActive ? 1 : 0;
    if (this.powderSurfaceDirty
      && scheduleTime - this.lastPowderSurfaceRefresh >= POWDER_SURFACE_REFRESH_INTERVAL) {
      const changed = this.fieldSet.powderSurface.update(
        materials, this.boundaryStabilityBytes, walls,
      );
      this.powderSurfaceDirty = false;
      this.lastPowderSurfaceRefresh = scheduleTime;
      this.uniforms.uniforms.uPowderSurfaceActive = this.fieldSet.powderSurface.hasSurface ? 1 : 0;
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
      this.fieldSet.liquid.writeVerticalOpticalDepth(
        materials, this.boundaryStabilityBytes, walls,
      );
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
    // An audit timing fence is also a real direct-8x presentation fence. Do
    // not submit a second ordinary fence for the same 15M-fragment frame: on
    // SwiftShader the timing fence can signal while that redundant sibling
    // remains pending indefinitely. Later mutations stay latest-wins queued
    // until whichever single owner fence retires.
    this.pollWebGLTimingFence();
    if (this.outputScale === 8 && (this.renderFence || this.webGLTimingFence)) {
      this.renderQueued = true;
      if (!this.prepareEightXRender()) return;
      if (this.webGLTimingFence) return;
    }
    // A completed fence has released the only frame in flight. Its queued
    // mutation is being submitted below, so do not let the next fence poll
    // mistake it for another update and redraw the 15M-fragment target again.
    if (this.outputScale === 8) this.renderQueued = false;
    this.renderApplicationNow();
    if (this.outputScale === 8 && !this.webGLTimingFence) this.insertEightXRenderFence();
  }

  private renderApplicationNow(): void {
    const gl = this.webGLContext();
    // Pixi's BufferImageSource uploader leaves WebGL's four-byte default in
    // place. Our 306-byte R8 identity rows require byte alignment; enforcing it
    // immediately before every render also survives unrelated later uploads.
    try { if (gl) gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); }
    catch { /* a lost context is handled by the existing render path below */ }
    if (!this.webGLTimingEnabled || !this.webGLTimingRequested) {
      this.renderPresentationFrame();
      return;
    }
    this.webGLTimingRequested = false;
    const extension = this.webGLTimingExtension;
    let query: WebGLQuery | null = null;
    try { query = extension && gl ? gl.createQuery() : null; }
    catch { /* a lost/invalid context falls through to labelled CPU timing */ }
    if (!query || !extension || !gl) {
      if (gl && this.webGLTimingSource === 'gpu-finish') this.renderAndRecordFinishTiming(gl);
      else if (gl) this.renderAndRecordFenceTiming(gl);
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
      this.renderPresentationFrame();
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
      this.webGLTimingQueryStartedAt = started;
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
    try {
      status = gl.clientWaitSync(fence, 0, 0);
      // SwiftShader/headless WebGL can leave an otherwise completed direct-8x
      // fence invisible to a pure zero-flag poll. Mirror the audit-timing
      // fence's prescribed non-blocking flush retry so the single ordinary
      // presentation fence and its timing proof share one completion truth.
      // This remains a zero-time poll; it never blocks a frame or changes the
      // 30-second Canvas-recovery deadline.
      if (status === gl.TIMEOUT_EXPIRED) {
        status = gl.clientWaitSync(fence, gl.SYNC_FLUSH_COMMANDS_BIT, 0);
      }
    }
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
      // The candidate's first fence remains owned by waitForFirstFrame(),
      // which shares the one promotion deadline with FieldRenderer. Once that
      // has promoted, however, rAF alone is insufficient to guarantee that an
      // unsignalled later fence restores Canvas after thirty seconds.
      this.armPromotedEightXFenceWatchdog(fence);
    } catch { /* context loss will promote the Canvas fallback */ }
  }

  /**
   * Guarantees post-promotion stalled-fence recovery even if no further rAF
   * callback is delivered. The identity check makes an expired callback from a
   * completed fence harmless after latest-wins submits a successor.
   */
  private armPromotedEightXFenceWatchdog(fence: WebGLSync): void {
    if (this.outputScale !== 8 || !this.firstFrameReady
      || this.destroyed || this.contextLost || this.renderFence !== fence) return;
    if (this.renderFenceWatchdog !== undefined) clearTimeout(this.renderFenceWatchdog);
    this.renderFenceWatchdog = setTimeout(() => {
      this.renderFenceWatchdog = undefined;
      if (this.destroyed || this.contextLost || !this.firstFrameReady
        || this.renderFence !== fence) return;
      this.releaseRenderFence();
      this.renderStallHandler?.();
    }, WEBGL_EIGHT_X_FRAME_STALL_MS);
  }

  private scheduleEightXRenderPoll(): void {
    if (this.renderFencePoll !== 0 || this.destroyed || this.contextLost) return;
    this.renderFencePoll = requestAnimationFrame(() => {
      this.renderFencePoll = 0;
      if (!this.renderFence || this.destroyed || this.contextLost) return;
      const redraw = this.renderQueued;
      if (!this.prepareEightXRender()) return;
      // Preserve a queued mutation only while its predecessor fence is still
      // pending. Once that fence signals, the redraw below consumes it.
      this.renderQueued = false;
      this.resolveFirstFrame(true);
      if (redraw) this.renderApplication();
    });
  }

  private resolveFirstFrame(ready: boolean): void {
    if (ready) this.firstFrameReady = true;
    for (const waiter of [...this.firstFrameWaiters]) waiter(ready);
  }

  private releaseRenderFence(): void {
    if (this.renderFenceWatchdog !== undefined) {
      clearTimeout(this.renderFenceWatchdog);
      this.renderFenceWatchdog = undefined;
    }
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
      if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
        if (performance.now() - this.webGLTimingQueryStartedAt < WEBGL_TIMING_QUERY_STALL_MS) return;
        // The visible frame already submitted successfully; only the optional
        // elapsed-time query is stale. This path is used solely by an explicit
        // browser audit request, so one bounded completion is preferable to
        // letting a software driver's asynchronous query starve the audit.
        // Normal presentation never calls finish().
        const started = this.webGLTimingQueryStartedAt;
        gl.finish();
        if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
          this.releaseWebGLTimingQuery();
          this.useFinishTimingFallback();
          this.recordWebGLTimingSample(performance.now() - started);
          return;
        }
      }
      disjoint = Boolean(gl.getParameter(extension.GPU_DISJOINT_EXT));
      nanoseconds = Number(gl.getQueryParameter(query, gl.QUERY_RESULT));
    } catch {
      try { gl.deleteQuery(query); } catch { /* context may already be invalid */ }
      this.webGLTimingPending = undefined;
      this.webGLTimingQueryStartedAt = 0;
      this.useFenceTimingFallback();
      this.recordWebGLTimingSample(Number.NaN);
      return;
    }
    try { gl.deleteQuery(query); } catch { /* result is already consumed */ }
    this.webGLTimingPending = undefined;
    this.webGLTimingQueryStartedAt = 0;
    this.webGLTimingSequence++;
    if (disjoint || !Number.isFinite(nanoseconds) || nanoseconds < 0) {
      this.webGLTimingDiscarded++;
      return;
    }
    this.webGLTimingSamples.push(nanoseconds / 1_000_000);
  }

  private renderAndRecordFenceTiming(gl: WebGL2RenderingContext): void {
    const started = performance.now();
    this.renderPresentationFrame();
    if (this.insertWebGLTimingFence(gl, started)) return;
    this.useCpuTimingFallback();
    this.recordWebGLTimingSample(performance.now() - started);
  }

  /** Audit-only recovery for drivers that finish draws but never publish timer queries/fences. */
  private renderAndRecordFinishTiming(gl: WebGL2RenderingContext): void {
    const started = performance.now();
    this.renderPresentationFrame();
    try {
      gl.finish();
      this.recordWebGLTimingSample(performance.now() - started);
    } catch {
      this.useCpuTimingFallback();
      this.recordWebGLTimingSample(performance.now() - started);
    }
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
    try {
      // Some software/headless implementations only make a just-submitted
      // fence observable when the first non-blocking client wait carries the
      // prescribed flush bit. This remains a zero-time completion poll; it
      // never blocks the presentation path.
      status = gl.clientWaitSync(fence, gl.SYNC_FLUSH_COMMANDS_BIT, 0);
    }
    catch { status = gl.WAIT_FAILED; }
    if (status === gl.TIMEOUT_EXPIRED) return false;
    const started = this.webGLTimingFenceStartedAt;
    const redraw = this.outputScale === 8 && this.renderQueued;
    this.releaseWebGLTimingFence();
    this.recordWebGLTimingSample(
      status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED
        ? performance.now() - started
        : Number.NaN,
    );
    // The timing fence is the sole 8x frame owner for audit-submitted draws.
    // Consume one coalesced semantic/style mutation only after it signals.
    if (redraw) requestAnimationFrame(() => {
      if (!this.destroyed && !this.contextLost && this.renderQueued) this.renderApplication();
    });
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
    this.renderPresentationFrame();
    this.recordWebGLTimingSample(performance.now() - started);
  }

  private renderPresentationFrame(): void {
    const pipeline = this.hdrVfxPipeline;
    if (pipeline) {
      try {
        pipeline.render();
        return;
      } catch {
        // A driver can accept the 2x2 float probe yet reject a world-size
        // attachment or shader at first use. Drop only the optional targets and
        // continue on the established single-pass WebGL scene; simulation and
        // camera state remain in this presenter.
        try { pipeline.destroy(); } catch { /* partially initialized GPU resources */ }
        this.hdrVfxPipeline = undefined;
        this.hdrPipelineInfo = {
          active: false, look: this.hdrPipelineInfo.look, reason: 'runtime-error',
        };
        this.uniforms.uniforms.uHDRVfx = 0;
        this.uniforms.uniforms.uVolumeVfx = 0;
        this.uniforms.uniforms.uGasBodyVfx = 0;
        this.uniforms.uniforms.uLiquidBodyVfx = 0;
        this.uniforms.uniforms.uPowderBodyVfx = 0;
        this.uniforms.uniforms.uPowderLightVfx = 0;
        this.app.canvas.dataset.hdrPipeline = 'inactive';
        this.app.canvas.dataset.hdrPipelineReason = 'runtime-error';
        this.app.canvas.dataset.volumeVfx = 'inactive';
        this.app.canvas.dataset.gasBodyVfx = 'inactive';
        this.app.canvas.dataset.liquidBodyVfx = 'inactive';
        this.app.canvas.dataset.powderBodyVfx = 'inactive';
        this.app.canvas.dataset.powderLightVfx = 'inactive';
        delete this.app.canvas.dataset.bloomBacking;
        if (!this.scene.parent) this.app.stage.addChild(this.scene);
      }
    }
    this.app.render();
  }

  private useFenceTimingFallback(): void {
    this.webGLTimingExtension = undefined;
    if (this.webGLTimingSource === 'gpu-fence') return;
    this.webGLTimingSource = 'gpu-fence';
    this.webGLTimingSamples.length = 0;
    this.webGLTimingDiscarded = 0;
    this.webGLTimingSequence = 0;
  }

  private useFinishTimingFallback(): void {
    this.webGLTimingExtension = undefined;
    if (this.webGLTimingSource === 'gpu-finish') return;
    this.webGLTimingSource = 'gpu-finish';
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
    this.webGLTimingQueryStartedAt = 0;
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
