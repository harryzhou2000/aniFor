import {
  Application,
  BufferImageSource,
  Container,
  Filter,
  Sprite,
  Texture,
  UniformGroup,
} from 'pixi.js';
import type { MaterialCategory, MaterialPhase } from '../shared/materials';
import { AtmosphereField } from './atmosphere-field';
import { DirtyChunkGrid } from './dirty-chunk-grid';
import { EmissionField } from './emission-field';
import { LiquidDensityField } from './liquid-density-field';
import { renderPhase, renderProfile, RenderPhase } from './render-profile';
import { packSemanticRect } from './semantic-field';
import { VolumeFieldRefreshSchedule } from './volume-field-refresh';

interface SemanticMaterialStyle {
  readonly id: number;
  readonly color: string;
  readonly category: MaterialCategory;
  readonly phase?: MaterialPhase;
  readonly emissive?: boolean;
}
interface PresenterViewport { readonly width: number; readonly height: number }

const FIELD_VERTEX = `
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
uniform sampler2D uAtmosphereTexture;
uniform sampler2D uEmissionTexture;
uniform sampler2D uLiquidTexture;
uniform sampler2D uPaletteTexture;
uniform sampler2D uStyleTexture;
uniform vec2 uTexel;
uniform vec2 uFieldSize;
uniform vec2 uAtmosphereTexel;
uniform vec2 uEmissionTexel;
uniform float uTime;
uniform float uHighQuality;
vec4 field(vec2 uv) { return texture(uFieldTexture, clamp(uv, uTexel * 0.5, vec2(1.0) - uTexel * 0.5)); }
float materialAt(vec2 uv) { return floor(field(uv).r * 255.0 + 0.5); }
float sameMaterial(vec2 uv, float material) { return 1.0 - step(0.5, abs(materialAt(uv) - material)); }
float familyFor(float id) { return floor(texture(uStyleTexture, vec2((id + 0.5) / 256.0, 0.5)).r * 255.0 + 0.5); }
float profileFor(float id) { return floor(texture(uStyleTexture, vec2((id + 0.5) / 256.0, 0.5)).g * 255.0 + 0.5); }
float emissionFor(float id) { return texture(uStyleTexture, vec2((id + 0.5) / 256.0, 0.5)).b; }
bool isGas(float id) { return familyFor(id) == 1.0; }
bool isLiquid(float id) { return familyFor(id) == 2.0; }
bool isEnergy(float id) { return familyFor(id) == 3.0; }
bool isEmissive(float id) { return emissionFor(id) > 0.5; }
float compatibleAt(vec2 uv, float material, float family) {
  float candidate = materialAt(uv);
  if (abs(candidate - material) < 0.5) return 1.0;
  if ((family == 1.0 || family == 2.0) && familyFor(candidate) == family) return 1.0;
  return 0.0;
}
vec3 occupancyShape(vec2 uv, float material) {
  vec2 grid = uv * uFieldSize - 0.5;
  vec2 blend = fract(grid);
  vec2 origin = (floor(grid) + 0.5) * uTexel;
  float family = familyFor(material);
  float q00 = compatibleAt(origin, material, family);
  float q10 = compatibleAt(origin + vec2(uTexel.x, 0.0), material, family);
  float q01 = compatibleAt(origin + vec2(0.0, uTexel.y), material, family);
  float q11 = compatibleAt(origin + uTexel, material, family);
  float top = mix(q00, q10, blend.x);
  float bottom = mix(q01, q11, blend.x);
  float density = mix(top, bottom, blend.y);
  float gradientX = mix(q10 - q00, q11 - q01, blend.y);
  float gradientY = mix(q01 - q00, q11 - q10, blend.x);
  return vec3(density, gradientX, gradientY);
}
vec3 discreteShape(vec2 uv, float material) {
  vec2 left = vec2(uTexel.x, 0.0);
  vec2 down = vec2(0.0, uTexel.y);
  float l = sameMaterial(uv - left, material);
  float r = sameMaterial(uv + left, material);
  float t = sameMaterial(uv - down, material);
  float b = sameMaterial(uv + down, material);
  float tl = sameMaterial(uv - left - down, material);
  float tr = sameMaterial(uv + left - down, material);
  float bl = sameMaterial(uv - left + down, material);
  float br = sameMaterial(uv + left + down, material);
  float center = sameMaterial(uv, material);
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
  float l = sameMaterial(uv - left, material);
  float r = sameMaterial(uv + left, material);
  float t = sameMaterial(uv - down, material);
  float b = sameMaterial(uv + down, material);
  float tl = sameMaterial(uv - left - down, material);
  float tr = sameMaterial(uv + left - down, material);
  float bl = sameMaterial(uv - left + down, material);
  float br = sameMaterial(uv + left + down, material);
  float support = (l + r + t + b) * 0.12 + (tl + tr + bl + br) * 0.05;
  float coverage = smoothstep(0.34, 0.64, support);
  float gradientX = (r - l) + (tr + br - tl - bl) * 0.45;
  float gradientY = (b - t) + (bl + br - tl - tr) * 0.45;
  return vec3(coverage * 0.86, gradientX * 0.14, gradientY * 0.14);
}
vec2 nearbySurface(vec2 uv) {
  float solid = 0.0;
  float candidate = materialAt(uv - vec2(uTexel.x, 0.0));
  float family = familyFor(candidate);
  if (family == 3.0 || isEmissive(candidate)) return vec2(candidate, 0.0);
  if (candidate > 0.5 && family == 0.0) solid = candidate;
  candidate = materialAt(uv + vec2(uTexel.x, 0.0));
  family = familyFor(candidate);
  if (family == 3.0 || isEmissive(candidate)) return vec2(candidate, 0.0);
  if (solid < 0.5 && candidate > 0.5 && family == 0.0) solid = candidate;
  candidate = materialAt(uv - vec2(0.0, uTexel.y));
  family = familyFor(candidate);
  if (family == 3.0 || isEmissive(candidate)) return vec2(candidate, 0.0);
  if (solid < 0.5 && candidate > 0.5 && family == 0.0) solid = candidate;
  candidate = materialAt(uv + vec2(0.0, uTexel.y));
  family = familyFor(candidate);
  if (family == 3.0 || isEmissive(candidate)) return vec2(candidate, 0.0);
  if (solid < 0.5 && candidate > 0.5 && family == 0.0) solid = candidate;
  return vec2(0.0, solid);
}
float nearbyLiquid(vec2 uv) {
  float candidate = materialAt(uv - vec2(uTexel.x, 0.0));
  if (isLiquid(candidate)) return candidate;
  candidate = materialAt(uv + vec2(uTexel.x, 0.0));
  if (isLiquid(candidate)) return candidate;
  candidate = materialAt(uv - vec2(0.0, uTexel.y));
  if (isLiquid(candidate)) return candidate;
  candidate = materialAt(uv + vec2(0.0, uTexel.y));
  if (isLiquid(candidate)) return candidate;
  return 0.0;
}
void main() {
  vec2 fieldUv = vFieldCoord;
  vec4 state = field(fieldUv);
  vec4 atmosphereState = texture(uAtmosphereTexture, fieldUv);
  vec4 emissionState = texture(uEmissionTexture, fieldUv);
  float liquidDensity = texture(uLiquidTexture, fieldUv).r;
  float material = floor(state.r * 255.0 + 0.5);
  float halo = 0.0;
  float cloudOnly = 0.0;
  float emissionOnly = 0.0;
  float liquidOnly = 0.0;
  float surfaceOnly = 0.0;
  if (material < 0.5) {
    if (liquidDensity > 0.12) {
      material = nearbyLiquid(fieldUv);
      liquidOnly = material > 0.5 ? 1.0 : 0.0;
    }
    if (liquidOnly > 0.5) {
      halo = 1.0;
    } else if (atmosphereState.a > 0.004) {
      cloudOnly = 1.0;
    } else if (emissionState.a > 0.002) {
      emissionOnly = 1.0;
    } else {
      vec2 nearby = nearbySurface(fieldUv);
      material = nearby.x;
      if (material < 0.5 && nearby.y > 0.5) {
        material = nearby.y;
        surfaceOnly = material > 0.5 ? 1.0 : 0.0;
      }
      if (material < 0.5) { finalColor = vec4(0.0); return; }
    }
    halo = 1.0;
  }
  float profile = profileFor(material);
  vec3 shape = surfaceOnly > 0.5
    ? enclosedSurfaceShape(fieldUv, material)
    : ((cloudOnly > 0.5 || emissionOnly > 0.5)
    ? vec3(0.0)
    : ((isGas(material) || profile == 1.0) ? discreteShape(fieldUv, material) : occupancyShape(fieldUv, material)));
  float density = shape.x;
  float gasVolume = max(cloudOnly, isGas(material) ? 1.0 : 0.0);
  float liquidVolume = max(liquidOnly, isLiquid(material) ? 1.0 : 0.0);
  float volume = density;
  if (emissionOnly > 0.5) volume = emissionState.a;
  else if (cloudOnly > 0.5) volume = atmosphereState.a;
  else if (liquidVolume > 0.5) volume = max(density, liquidDensity);
  vec2 volumeSlope = vec2(0.0);
  if (emissionOnly > 0.5) {
    float lightLeft = texture(uEmissionTexture, fieldUv - vec2(uEmissionTexel.x, 0.0)).a;
    float lightRight = texture(uEmissionTexture, fieldUv + vec2(uEmissionTexel.x, 0.0)).a;
    float lightTop = texture(uEmissionTexture, fieldUv - vec2(0.0, uEmissionTexel.y)).a;
    float lightBottom = texture(uEmissionTexture, fieldUv + vec2(0.0, uEmissionTexel.y)).a;
    volumeSlope = vec2(lightRight - lightLeft, lightBottom - lightTop) * 0.72;
  } else if (gasVolume > 0.5) {
    float cloudLeft = texture(uAtmosphereTexture, fieldUv - vec2(uAtmosphereTexel.x, 0.0)).a;
    float cloudRight = texture(uAtmosphereTexture, fieldUv + vec2(uAtmosphereTexel.x, 0.0)).a;
    float cloudTop = texture(uAtmosphereTexture, fieldUv - vec2(0.0, uAtmosphereTexel.y)).a;
    float cloudBottom = texture(uAtmosphereTexture, fieldUv + vec2(0.0, uAtmosphereTexel.y)).a;
    volumeSlope = vec2(cloudRight - cloudLeft, cloudBottom - cloudTop) * 0.85;
  } else if (liquidVolume > 0.5) {
    float liquidLeft = texture(uLiquidTexture, fieldUv - vec2(uTexel.x, 0.0)).r;
    float liquidRight = texture(uLiquidTexture, fieldUv + vec2(uTexel.x, 0.0)).r;
    float liquidTop = texture(uLiquidTexture, fieldUv - vec2(0.0, uTexel.y)).r;
    float liquidBottom = texture(uLiquidTexture, fieldUv + vec2(0.0, uTexel.y)).r;
    volumeSlope = vec2(liquidRight - liquidLeft, liquidBottom - liquidTop) * 0.65;
  }
  vec3 normal = normalize(vec3(-shape.y - volumeSlope.x, -shape.z - volumeSlope.y, mix(1.45, 1.15, uHighQuality)));
  float diffuse = 0.72 + max(0.0, dot(normal, normalize(vec3(-0.48, -0.68, 0.78)))) * 0.42;
  float specular = pow(max(0.0, dot(normal, normalize(vec3(-0.35, -0.55, 0.92)))), 10.0);
  vec3 base = emissionOnly > 0.5
    ? emissionState.rgb
    : (cloudOnly > 0.5 ? atmosphereState.rgb : texture(uPaletteTexture, vec2((material + 0.5) / 256.0, 0.5)).rgb);
  vec2 velocity = halo > 0.5 ? vec2(0.0) : state.ba * 2.0 - 1.0;
  vec2 fieldPosition = fieldUv * uFieldSize;
  float grain = fract(sin(dot(floor(fieldPosition), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  float atmosphere = sin(fieldPosition.x * 0.055 + fieldPosition.y * 0.027 + uTime * 0.7 + velocity.x * 2.0)
    * sin(fieldPosition.y * 0.043 - uTime * 0.43 + velocity.y * 1.7);
  float heat = smoothstep(0.07, 0.34, state.g);
  float alpha;
  vec3 color;
  if (emissionOnly > 0.5) {
    float pulse = 0.90 + sin(uTime * 2.1 + fieldPosition.x * 0.025 - fieldPosition.y * 0.018) * 0.10;
    alpha = smoothstep(0.002, 0.28, volume) * (0.07 + volume * 0.30) * pulse;
    color = mix(base * 1.42 + vec3(0.045), base * 0.72, volume) * (0.68 + diffuse * 0.32);
    color += mix(vec3(0.16, 0.19, 0.24), base, 0.56) * specular * 0.30;
  } else if (gasVolume > 0.5) {
    float billow = 0.88 + atmosphere * 0.12;
    if (cloudOnly > 0.5) {
      alpha = smoothstep(0.006, 0.46, volume) * (0.07 + volume * 0.20) * billow;
      color = mix(base * 1.24 + vec3(0.035), base * 0.72, volume) * (0.64 + diffuse * 0.36);
      color += mix(vec3(0.075, 0.09, 0.11), base, 0.40) * specular * (1.0 - volume) * 0.24;
    } else {
      alpha = smoothstep(0.08, 0.72, density) * (0.42 + atmosphere * 0.07);
      color = mix(base * 0.68, base * 1.24 + vec3(0.05), density) * diffuse;
      color += vec3(0.06, 0.075, 0.09) * specular;
    }
  } else if (liquidVolume > 0.5) {
    float rim = 1.0 - smoothstep(0.30, 0.86, volume);
    alpha = smoothstep(0.34, 0.62, volume);
    color = base * mix(1.16, 0.55, volume) * (0.70 + diffuse * 0.30);
    color += mix(vec3(0.44, 0.67, 0.72), base, 0.20) * specular * (0.62 + rim * 0.72);
    color += base * atmosphere * 0.03 + vec3(0.045, 0.07, 0.075) * rim;
  } else {
    float edgeCenter = 0.49 + (profile == 1.0 ? grain * 0.045 : 0.0);
    alpha = smoothstep(edgeCenter - 0.11, edgeCenter + 0.11, density);
    color = base * mix(1.10, 0.78, density) * diffuse;
    color += vec3(0.12) * specular * 0.28;
    if (profile == 1.0) {
      vec2 subcell = floor(fract(fieldPosition) * 2.0);
      float grainFacet = fract(sin(dot(floor(fieldPosition) * 2.0 + subcell, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      alpha = smoothstep(0.18 + grain * 0.025, 0.72 + grain * 0.035, density);
      color *= 0.91 + grain * 0.20 + grainFacet * 0.10;
      color += base * max(0.0, 0.6 - subcell.x - subcell.y) * 0.11;
    } else if (profile == 2.0) {
      float bevel = clamp(abs(shape.y) + abs(shape.z), 0.0, 1.0);
      float strata = sin(fieldPosition.x * 0.16 + fieldPosition.y * 0.055 + material * 0.71);
      color *= 0.965 + strata * 0.028;
      color += mix(base, vec3(0.32, 0.36, 0.42), 0.26) * bevel * 0.13;
    } else if (profile == 3.0) {
      float fibre = sin(fieldPosition.x * 0.20 + sin(fieldPosition.y * 0.115 + material) * 1.45);
      float pores = sin(fieldPosition.x * 0.083 + fieldPosition.y * 0.157 + material * 0.37)
        * sin(fieldPosition.y * 0.091 - fieldPosition.x * 0.047);
      color *= 0.95 + fibre * 0.042 + pores * 0.024;
      color += mix(base, vec3(0.18, 0.43, 0.13), 0.34) * max(0.0, fibre) * 0.038;
    } else if (profile == 4.0) {
      float isotope = sin(fieldPosition.x * 0.137 + sin(fieldPosition.y * 0.103 + material) * 1.6)
        * sin(fieldPosition.y * 0.181 - fieldPosition.x * 0.061);
      float decayPulse = 0.5 + 0.5 * sin(uTime * 1.55 + material * 0.73 + isotope * 1.8);
      color *= 0.94 + isotope * 0.055;
      color += mix(base, vec3(0.19, 0.72, 0.22), 0.56) * (0.045 + decayPulse * 0.065);
    } else if (profile == 5.0) {
      vec2 circuitCell = abs(fract((fieldPosition + vec2(material * 0.37, material * 0.19)) / 8.0) - 0.5);
      float trace = max(1.0 - smoothstep(0.055, 0.105, circuitCell.x), 1.0 - smoothstep(0.055, 0.105, circuitCell.y));
      float node = 1.0 - smoothstep(0.10, 0.22, length(circuitCell));
      color *= 0.96 + trace * 0.025;
      color += mix(base, vec3(0.34, 0.76, 1.0), 0.58) * (trace * 0.12 + node * 0.10);
    } else if (profile == 6.0) {
      float planeWave = sin((fieldPosition.x + fieldPosition.y * 0.62) * 0.115 - uTime * 1.15 + material);
      float radialWave = sin(length(fieldPosition - vec2(material * 1.7)) * 0.14 + uTime * 0.92);
      float interference = (planeWave + radialWave) * 0.5;
      color *= 0.95 + interference * 0.045;
      color += mix(base, vec3(0.48, 0.70, 1.0), 0.42) * (0.045 + max(0.0, interference) * 0.07);
    }
  }
  float emission = isEmissive(material) ? 0.48 + heat * 1.05 : (material == 11.0 ? 0.28 + heat * 0.62 : (profile == 4.0 ? 0.07 : 0.0));
  color += mix(base, vec3(1.0, 0.52, 0.20), heat) * emission;
  if (emissionOnly < 0.5 && emissionState.a > 0.002) {
    float lightReach = smoothstep(0.002, 0.42, emissionState.a);
    color += emissionState.rgb * lightReach * (isEmissive(material) ? 0.28 : 0.16);
  }
  if (halo > 0.5 && emissionOnly < 0.5 && surfaceOnly < 0.5 && gasVolume < 0.5 && liquidVolume < 0.5) alpha = volume * (isEnergy(material) ? 1.35 + heat : 0.52);
  alpha = clamp(alpha, 0.0, 1.0);
  finalColor = vec4(clamp(color, 0.0, 1.35) * alpha, alpha);
}
`;

/** Primary WebGL presentation of raw simulation semantics. */
export class PixiFieldPresenter {
  private readonly app = new Application();
  private readonly scene = new Container();
  private readonly fieldBytes: Uint8Array;
  private readonly fieldSource: BufferImageSource;
  private readonly atmosphereField: AtmosphereField;
  private readonly atmosphereSource: BufferImageSource;
  private readonly emissionField: EmissionField;
  private readonly emissionSource: BufferImageSource;
  private readonly liquidField: LiquidDensityField;
  private readonly liquidSource: BufferImageSource;
  private readonly gasByMaterial: Uint8Array;
  private readonly emissiveByMaterial: Uint8Array;
  private readonly liquidByMaterial: Uint8Array;
  private readonly chunks: DirtyChunkGrid;
  private readonly uniforms: UniformGroup;
  private readonly volumeRefresh = new VolumeFieldRefreshSchedule();
  private atmosphereDirty = true;
  private emissionDirty = true;
  private liquidDirty = true;

  private constructor(
    private readonly host: HTMLElement,
    private readonly width: number,
    private readonly height: number,
    materials: readonly SemanticMaterialStyle[],
  ) {
    this.fieldBytes = new Uint8Array(width * height * 4);
    this.fieldSource = new BufferImageSource({
      resource: this.fieldBytes, width, height, format: 'rgba8unorm',
      alphaMode: 'no-premultiply-alpha', scaleMode: 'nearest', autoGarbageCollect: false,
    });
    const fieldTexture = new Texture({ source: this.fieldSource });
    const { paletteTexture, styleTexture, gasByMaterial, liquidByMaterial, emissiveByMaterial, colorByMaterial } = createLookupTextures(materials);
    this.gasByMaterial = gasByMaterial;
    this.liquidByMaterial = liquidByMaterial;
    this.emissiveByMaterial = emissiveByMaterial;
    this.atmosphereField = new AtmosphereField(width, height, this.gasByMaterial, colorByMaterial);
    this.atmosphereSource = new BufferImageSource({
      resource: this.atmosphereField.bytes,
      width: this.atmosphereField.width,
      height: this.atmosphereField.height,
      format: 'rgba8unorm',
      alphaMode: 'no-premultiply-alpha',
      scaleMode: 'linear',
      autoGarbageCollect: false,
    });
    this.emissionField = new EmissionField(width, height, this.emissiveByMaterial, colorByMaterial);
    this.emissionSource = new BufferImageSource({
      resource: this.emissionField.bytes,
      width: this.emissionField.width,
      height: this.emissionField.height,
      format: 'rgba8unorm',
      alphaMode: 'no-premultiply-alpha',
      scaleMode: 'linear',
      autoGarbageCollect: false,
    });
    this.liquidField = new LiquidDensityField(width, height, this.liquidByMaterial);
    this.liquidSource = new BufferImageSource({
      resource: this.liquidField.bytes,
      width,
      height,
      format: 'rgba8unorm',
      alphaMode: 'no-premultiply-alpha',
      scaleMode: 'linear',
      autoGarbageCollect: false,
    });
    this.uniforms = new UniformGroup({
      uTexel: { value: new Float32Array([1 / width, 1 / height]), type: 'vec2<f32>' },
      uFieldSize: { value: new Float32Array([width, height]), type: 'vec2<f32>' },
      uAtmosphereTexel: { value: new Float32Array([1 / this.atmosphereField.width, 1 / this.atmosphereField.height]), type: 'vec2<f32>' },
      uEmissionTexel: { value: new Float32Array([1 / this.emissionField.width, 1 / this.emissionField.height]), type: 'vec2<f32>' },
      uTime: { value: 0, type: 'f32' },
      uHighQuality: { value: matchMedia('(min-width: 800px) and (pointer: fine)').matches ? 1 : 0, type: 'f32' },
    });
    const filter = Filter.from({
      gl: { vertex: FIELD_VERTEX, fragment: FIELD_FRAGMENT, name: 'semantic-field-filter' },
      resources: {
        fieldUniforms: this.uniforms,
        uFieldTexture: this.fieldSource,
        uFieldSampler: this.fieldSource.style,
        uAtmosphereTexture: this.atmosphereSource,
        uAtmosphereSampler: this.atmosphereSource.style,
        uEmissionTexture: this.emissionSource,
        uEmissionSampler: this.emissionSource.style,
        uLiquidTexture: this.liquidSource,
        uLiquidSampler: this.liquidSource.style,
        uPaletteTexture: paletteTexture.source,
        uPaletteSampler: paletteTexture.source.style,
        uStyleTexture: styleTexture.source,
        uStyleSampler: styleTexture.source.style,
      },
      antialias: 'inherit',
    });
    const sprite = new Sprite(fieldTexture);
    sprite.filters = [filter];
    this.scene.addChild(sprite);
    this.chunks = new DirtyChunkGrid(width, height, 32, 2);
    this.chunks.markAll();
  }

  static async create(host: HTMLElement, width: number, height: number, outputScale: 1 | 2, materials: readonly SemanticMaterialStyle[]): Promise<PixiFieldPresenter> {
    const presenter = new PixiFieldPresenter(host, width, height, materials);
    await presenter.app.init({
      width, height,
      preference: 'webgl', backgroundAlpha: 0, antialias: true,
      resolution: outputScale, autoDensity: true, autoStart: false,
    });
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

  resize(width: number, height: number): PresenterViewport {
    this.app.canvas.dataset.viewportSize = width + 'x' + height;
    return { width, height };
  }

  clientWorldPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.app.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * this.width / Math.max(1, rect.width),
      y: (clientY - rect.top) * this.height / Math.max(1, rect.height),
    };
  }

  markDirty(index: number, nextMaterial: number): void {
    const previousMaterial = this.fieldBytes[index * 4];
    this.chunks.markCell(index);
    if (this.gasByMaterial[previousMaterial] || this.gasByMaterial[nextMaterial]) this.atmosphereDirty = true;
    if (this.liquidByMaterial[previousMaterial] || this.liquidByMaterial[nextMaterial]) this.liquidDirty = true;
    if (this.emissiveByMaterial[previousMaterial] || this.emissiveByMaterial[nextMaterial]) this.emissionDirty = true;
  }

  visualRefreshDue(time: number): boolean {
    return this.volumeRefresh.due(time, this.atmosphereDirty, this.liquidDirty, this.emissionDirty);
  }

  update(materials: Uint8Array, temperatures: Uint16Array | undefined, velocities: Int8Array | undefined, time: number, refreshDynamicFields: boolean): void {
    if (refreshDynamicFields) this.chunks.markAll();
    const rectangles = this.chunks.consume();
    for (const rect of rectangles) packSemanticRect(this.fieldBytes, this.fieldSource.width, materials, temperatures, velocities, rect);
    if (rectangles.length) this.fieldSource.update();
    const volumeField = this.volumeRefresh.next(time, this.atmosphereDirty, this.liquidDirty, this.emissionDirty);
    if (volumeField === 'atmosphere') {
      this.atmosphereField.update(materials);
      this.atmosphereSource.update();
      this.atmosphereDirty = false;
      this.volumeRefresh.refreshed('atmosphere', time);
    } else if (volumeField === 'liquid') {
      this.liquidField.update(materials);
      this.liquidSource.update();
      this.liquidDirty = false;
      this.volumeRefresh.refreshed('liquid', time);
    } else if (volumeField === 'emission') {
      this.emissionField.update(materials);
      this.emissionSource.update();
      this.emissionDirty = false;
      this.volumeRefresh.refreshed('emission', time);
    }
    this.uniforms.uniforms.uTime = time * 0.001;
    this.app.render();
  }

  setTransform(scale: number, x: number, y: number): void {
    this.app.canvas.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    this.app.canvas.dataset.viewScale = String(scale);
    this.app.canvas.dataset.viewPosition = x + "," + y;
    this.app.render();
  }
}

function createLookupTextures(materials: readonly SemanticMaterialStyle[]): {
  paletteTexture: Texture;
  styleTexture: Texture;
  gasByMaterial: Uint8Array;
  liquidByMaterial: Uint8Array;
  emissiveByMaterial: Uint8Array;
  colorByMaterial: Uint8Array;
} {
  const palette = new Uint8Array(256 * 4);
  const styles = new Uint8Array(256 * 4);
  const gasByMaterial = new Uint8Array(256);
  const liquidByMaterial = new Uint8Array(256);
  const emissiveByMaterial = new Uint8Array(256);
  const colorByMaterial = new Uint8Array(256 * 3);
  for (const material of materials) {
    const color = Number.parseInt(material.color.slice(1), 16);
    const offset = material.id * 4;
    const colorOffset = material.id * 3;
    const phase = renderPhase(material);
    palette[offset] = color >>> 16;
    palette[offset + 1] = (color >>> 8) & 0xFF;
    palette[offset + 2] = color & 0xFF;
    palette[offset + 3] = 255;
    styles[offset] = phase;
    styles[offset + 1] = renderProfile(material.category);
    const emissive = material.emissive || phase === RenderPhase.Energy;
    styles[offset + 2] = emissive ? 255 : 0;
    styles[offset + 3] = 255;
    gasByMaterial[material.id] = phase === RenderPhase.Gas ? 1 : 0;
    liquidByMaterial[material.id] = phase === RenderPhase.Liquid ? 1 : 0;
    emissiveByMaterial[material.id] = emissive ? 1 : 0;
    colorByMaterial[colorOffset] = color >>> 16;
    colorByMaterial[colorOffset + 1] = (color >>> 8) & 0xFF;
    colorByMaterial[colorOffset + 2] = color & 0xFF;
  }
  return { paletteTexture: textureFromBytes(palette), styleTexture: textureFromBytes(styles), gasByMaterial, liquidByMaterial, emissiveByMaterial, colorByMaterial };
}

function textureFromBytes(bytes: Uint8Array): Texture {
  const source = new BufferImageSource({
    resource: bytes, width: 256, height: 1, format: 'rgba8unorm',
    alphaMode: 'no-premultiply-alpha', scaleMode: 'nearest', autoGarbageCollect: false,
  });
  return new Texture({ source });
}
