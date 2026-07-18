import {
  Application,
  BufferImageSource,
  Container,
  Filter,
  Sprite,
  Texture,
  UniformGroup,
} from 'pixi.js';
import type { MaterialCategory } from '../shared/materials';
import { DirtyChunkGrid } from './dirty-chunk-grid';
import { renderProfile } from './render-profile';
import { packSemanticRect } from './semantic-field';

interface SemanticMaterialStyle { readonly id: number; readonly color: string; readonly category: MaterialCategory }
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
uniform sampler2D uPaletteTexture;
uniform sampler2D uStyleTexture;
uniform vec2 uTexel;
uniform vec2 uFieldSize;
uniform float uTime;
uniform float uHighQuality;
vec4 field(vec2 uv) { return texture(uFieldTexture, clamp(uv, uTexel * 0.5, vec2(1.0) - uTexel * 0.5)); }
float materialAt(vec2 uv) { return floor(field(uv).r * 255.0 + 0.5); }
float sameMaterial(vec2 uv, float material) { return 1.0 - step(0.5, abs(materialAt(uv) - material)); }
float familyFor(float id) { return floor(texture(uStyleTexture, vec2((id + 0.5) / 256.0, 0.5)).r * 255.0 + 0.5); }
float profileFor(float id) { return floor(texture(uStyleTexture, vec2((id + 0.5) / 256.0, 0.5)).g * 255.0 + 0.5); }
bool isGas(float id) { return familyFor(id) == 1.0; }
bool isLiquid(float id) { return familyFor(id) == 2.0; }
bool isEnergy(float id) { return familyFor(id) == 3.0; }
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
float mergedFluidDensity(vec2 uv, float material, float center) {
  if (uHighQuality < 0.5) return center;
  vec2 horizontal = vec2(uTexel.x * 1.2, 0.0);
  vec2 vertical = vec2(0.0, uTexel.y * 1.2);
  float neighbours = occupancyShape(uv - horizontal, material).x
    + occupancyShape(uv + horizontal, material).x
    + occupancyShape(uv - vertical, material).x
    + occupancyShape(uv + vertical, material).x;
  return clamp(max(center, center * 0.56 + neighbours * 0.14), 0.0, 1.0);
}
float nearbyAtmosphere(vec2 uv) {
  float candidate = materialAt(uv - vec2(uTexel.x, 0.0));
  if (isGas(candidate) || isEnergy(candidate)) return candidate;
  candidate = materialAt(uv + vec2(uTexel.x, 0.0));
  if (isGas(candidate) || isEnergy(candidate)) return candidate;
  candidate = materialAt(uv - vec2(0.0, uTexel.y));
  if (isGas(candidate) || isEnergy(candidate)) return candidate;
  candidate = materialAt(uv + vec2(0.0, uTexel.y));
  if (isGas(candidate) || isEnergy(candidate)) return candidate;
  return 0.0;
}
void main() {
  vec2 fieldUv = vFieldCoord;
  vec4 state = field(fieldUv);
  float material = floor(state.r * 255.0 + 0.5);
  float halo = 0.0;
  if (material < 0.5) {
    material = nearbyAtmosphere(fieldUv);
    if (material < 0.5) { finalColor = vec4(0.0); return; }
    halo = 1.0;
  }
  vec3 shape = occupancyShape(fieldUv, material);
  float density = shape.x;
  float volume = (isGas(material) || isLiquid(material)) ? mergedFluidDensity(fieldUv, material, density) : density;
  vec3 normal = normalize(vec3(-shape.y, -shape.z, mix(1.45, 1.15, uHighQuality)));
  float diffuse = 0.72 + max(0.0, dot(normal, normalize(vec3(-0.48, -0.68, 0.78)))) * 0.42;
  float specular = pow(max(0.0, dot(normal, normalize(vec3(-0.35, -0.55, 0.92)))), 10.0);
  vec3 base = texture(uPaletteTexture, vec2((material + 0.5) / 256.0, 0.5)).rgb;
  float profile = profileFor(material);
  vec2 velocity = state.ba * 2.0 - 1.0;
  vec2 fieldPosition = fieldUv * uFieldSize;
  float grain = fract(sin(dot(floor(fieldPosition), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  float atmosphere = sin(fieldPosition.x * 0.055 + fieldPosition.y * 0.027 + uTime * 0.7 + velocity.x * 2.0)
    * sin(fieldPosition.y * 0.043 - uTime * 0.43 + velocity.y * 1.7);
  float heat = smoothstep(0.07, 0.34, state.g);
  float alpha;
  vec3 color;
  if (isGas(material)) {
    float billow = 0.88 + atmosphere * 0.12;
    alpha = smoothstep(0.015, 0.62, volume) * (0.28 + volume * 0.30) * billow;
    color = mix(base * 1.28 + vec3(0.045), base * 0.56, volume) * (0.58 + diffuse * 0.42);
    color += mix(vec3(0.09, 0.11, 0.14), base, 0.35) * specular * (1.0 - volume) * 0.44;
  } else if (isLiquid(material)) {
    float rim = 1.0 - smoothstep(0.30, 0.86, volume);
    alpha = smoothstep(0.24, 0.62, volume);
    color = base * mix(1.16, 0.55, volume) * (0.70 + diffuse * 0.30);
    color += mix(vec3(0.44, 0.67, 0.72), base, 0.20) * specular * (0.62 + rim * 0.72);
    color += base * atmosphere * 0.03 + vec3(0.045, 0.07, 0.075) * rim;
  } else {
    float edgeCenter = 0.49 + (profile == 1.0 ? grain * 0.045 : 0.0);
    alpha = smoothstep(edgeCenter - 0.11, edgeCenter + 0.11, density);
    color = base * mix(1.10, 0.78, density) * diffuse;
    color += vec3(0.12) * specular * 0.28;
    if (profile == 1.0) {
      color *= 0.96 + grain * 0.20;
    } else if (profile == 2.0) {
      color += base * clamp(abs(shape.y) + abs(shape.z), 0.0, 1.0) * 0.09;
    } else if (profile == 3.0) {
      color *= 0.96 + sin(fieldPosition.x * 0.19 + sin(fieldPosition.y * 0.11)) * 0.045;
    } else if (profile == 4.0) {
      color += vec3(0.08, 0.19, 0.055) * (0.72 + 0.28 * sin(uTime * 1.9 + material));
    } else if (profile == 5.0) {
      float trace = max(step(0.94, abs(sin(fieldPosition.x * 0.72))), step(0.94, abs(sin(fieldPosition.y * 0.72))));
      color += mix(base, vec3(0.38, 0.76, 1.0), 0.52) * trace * 0.13;
    } else if (profile == 6.0) {
      color += base * sin(length(fieldPosition) * 0.15 - uTime * 1.4) * 0.07;
    }
  }
  float emission = isEnergy(material) ? 0.48 + heat * 1.05 : (material == 11.0 ? 0.28 + heat * 0.62 : (profile == 4.0 ? 0.07 : 0.0));
  color += mix(base, vec3(1.0, 0.52, 0.20), heat) * emission;
  if (halo > 0.5) alpha = volume * (isEnergy(material) ? 1.35 + heat : (isGas(material) ? 0.38 : 0.52));
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
  private readonly chunks: DirtyChunkGrid;
  private readonly uniforms: UniformGroup;

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
    const { paletteTexture, styleTexture } = createLookupTextures(materials);
    this.uniforms = new UniformGroup({
      uTexel: { value: new Float32Array([1 / width, 1 / height]), type: 'vec2<f32>' },
      uFieldSize: { value: new Float32Array([width, height]), type: 'vec2<f32>' },
      uTime: { value: 0, type: 'f32' },
      uHighQuality: { value: matchMedia('(min-width: 800px) and (pointer: fine)').matches ? 1 : 0, type: 'f32' },
    });
    const filter = Filter.from({
      gl: { vertex: FIELD_VERTEX, fragment: FIELD_FRAGMENT, name: 'semantic-field-filter' },
      resources: {
        fieldUniforms: this.uniforms,
        uFieldTexture: this.fieldSource,
        uFieldSampler: this.fieldSource.style,
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

  markDirty(index: number): void { this.chunks.markCell(index); }

  update(materials: Uint8Array, temperatures: Uint16Array | undefined, velocities: Int8Array | undefined, time: number, refreshDynamicFields: boolean): void {
    if (refreshDynamicFields) this.chunks.markAll();
    const rectangles = this.chunks.consume();
    for (const rect of rectangles) packSemanticRect(this.fieldBytes, this.fieldSource.width, materials, temperatures, velocities, rect);
    if (rectangles.length) this.fieldSource.update();
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

function createLookupTextures(materials: readonly SemanticMaterialStyle[]): { paletteTexture: Texture; styleTexture: Texture } {
  const palette = new Uint8Array(256 * 4);
  const styles = new Uint8Array(256 * 4);
  for (const material of materials) {
    const color = Number.parseInt(material.color.slice(1), 16);
    const offset = material.id * 4;
    palette[offset] = color >>> 16;
    palette[offset + 1] = (color >>> 8) & 0xFF;
    palette[offset + 2] = color & 0xFF;
    palette[offset + 3] = 255;
    styles[offset] = material.category === 'gases' ? 1 : material.category === 'liquids' ? 2 : material.category === 'energy' ? 3 : 0;
    styles[offset + 1] = renderProfile(material.category);
    styles[offset + 3] = 255;
  }
  return { paletteTexture: textureFromBytes(palette), styleTexture: textureFromBytes(styles) };
}

function textureFromBytes(bytes: Uint8Array): Texture {
  const source = new BufferImageSource({
    resource: bytes, width: 256, height: 1, format: 'rgba8unorm',
    alphaMode: 'no-premultiply-alpha', scaleMode: 'nearest', autoGarbageCollect: false,
  });
  return new Texture({ source });
}
