import {
  Application,
  BufferImageSource,
  Container,
  defaultFilterVert,
  Filter,
  Sprite,
  Texture,
  UniformGroup,
} from 'pixi.js';
import { DirtyChunkGrid } from './dirty-chunk-grid';
import { packSemanticRect } from './semantic-field';

interface SemanticMaterialStyle { readonly id: number; readonly color: string; readonly category: string }

const FIELD_FRAGMENT = `
in vec2 vTextureCoord;
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
bool isGas(float id) { return familyFor(id) == 1.0; }
bool isLiquid(float id) { return familyFor(id) == 2.0; }
bool isEnergy(float id) { return familyFor(id) == 3.0; }
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
  vec4 state = field(vTextureCoord);
  float material = floor(state.r * 255.0 + 0.5);
  float halo = 0.0;
  if (material < 0.5) {
    material = nearbyAtmosphere(vTextureCoord);
    if (material < 0.5) { finalColor = vec4(0.0); return; }
    halo = 1.0;
  }
  vec2 left = vec2(uTexel.x, 0.0);
  vec2 down = vec2(0.0, uTexel.y);
  float l = sameMaterial(vTextureCoord - left, material);
  float r = sameMaterial(vTextureCoord + left, material);
  float t = sameMaterial(vTextureCoord - down, material);
  float b = sameMaterial(vTextureCoord + down, material);
  float tl = sameMaterial(vTextureCoord - left - down, material);
  float tr = sameMaterial(vTextureCoord + left - down, material);
  float bl = sameMaterial(vTextureCoord - left + down, material);
  float br = sameMaterial(vTextureCoord + left + down, material);
  float center = sameMaterial(vTextureCoord, material);
  float density = center * mix(0.48, 0.32, uHighQuality)
    + (l + r + t + b) * mix(0.13, 0.12, uHighQuality)
    + (tl + tr + bl + br) * 0.05 * uHighQuality;
  float gx = (r - l) + (tr + br - tl - bl) * 0.45 * uHighQuality;
  float gy = (b - t) + (bl + br - tl - tr) * 0.45 * uHighQuality;
  vec3 normal = normalize(vec3(-gx, -gy, 1.25));
  float diffuse = 0.72 + max(0.0, dot(normal, normalize(vec3(-0.48, -0.68, 0.78)))) * 0.42;
  float specular = pow(max(0.0, dot(normal, normalize(vec3(-0.35, -0.55, 0.92)))), 10.0);
  vec3 base = texture(uPaletteTexture, vec2((material + 0.5) / 256.0, 0.5)).rgb;
  vec2 velocity = state.ba * 2.0 - 1.0;
  vec2 fieldPosition = vTextureCoord * uFieldSize;
  float atmosphere = sin(fieldPosition.x * 0.055 + fieldPosition.y * 0.027 + uTime * 0.7 + velocity.x * 2.0)
    * sin(fieldPosition.y * 0.043 - uTime * 0.43 + velocity.y * 1.7);
  float heat = smoothstep(0.07, 0.34, state.g);
  float alpha;
  vec3 color;
  if (isGas(material)) {
    alpha = smoothstep(0.08, 0.72, density) * (0.42 + atmosphere * 0.09);
    color = mix(base * 0.68, base * 1.24 + vec3(0.05), density) * diffuse;
    color += vec3(0.06, 0.075, 0.09) * specular;
  } else if (isLiquid(material)) {
    alpha = smoothstep(0.20, 0.76, density);
    color = base * mix(1.18, 0.64, density) * diffuse;
    color += mix(vec3(0.34, 0.52, 0.58), base, 0.28) * specular * 0.82;
    color += base * atmosphere * 0.035;
  } else {
    alpha = smoothstep(0.22, 0.70, density);
    color = base * mix(1.10, 0.78, density) * diffuse;
    color += vec3(0.12) * specular * 0.28;
  }
  float emission = isEnergy(material) ? 0.48 + heat * 1.05 : (material == 11.0 ? 0.28 + heat * 0.62 : 0.0);
  color += mix(base, vec3(1.0, 0.52, 0.20), heat) * emission;
  if (halo > 0.5) alpha = density * (isEnergy(material) ? 1.35 + heat : 0.52);
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

  private constructor(private readonly host: HTMLElement, width: number, height: number, materials: readonly SemanticMaterialStyle[]) {
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
      gl: { vertex: defaultFilterVert, fragment: FIELD_FRAGMENT, name: 'semantic-field-filter' },
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

  static async create(host: HTMLElement, source: HTMLCanvasElement, materials: readonly SemanticMaterialStyle[]): Promise<PixiFieldPresenter> {
    const presenter = new PixiFieldPresenter(host, source.width, source.height, materials);
    await presenter.app.init({
      resizeTo: host, preference: 'webgl', backgroundAlpha: 0, antialias: true,
      resolution: Math.min(devicePixelRatio, 1.5), autoStart: false,
    });
    presenter.app.canvas.className = 'world-canvas semantic-field-canvas';
    presenter.app.canvas.dataset.renderer = 'semantic-field-webgl';
    presenter.app.canvas.dataset.worldSize = source.width + 'x' + source.height;
    presenter.app.stage.addChild(presenter.scene);
    return presenter;
  }

  mount(): void { this.host.append(this.app.canvas); }
  markDirty(index: number): void { this.chunks.markCell(index); }

  update(materials: Uint8Array, temperatures: Uint16Array | undefined, velocities: Int8Array | undefined, time: number): void {
    if (temperatures || velocities) this.chunks.markAll();
    const rectangles = this.chunks.consume();
    for (const rect of rectangles) packSemanticRect(this.fieldBytes, this.fieldSource.width, materials, temperatures, velocities, rect);
    if (rectangles.length) this.fieldSource.update();
    this.uniforms.uniforms.uTime = time * 0.001;
    this.app.render();
  }

  setTransform(scale: number, x: number, y: number): void {
    this.scene.scale.set(scale);
    this.scene.position.set(x, y);
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
