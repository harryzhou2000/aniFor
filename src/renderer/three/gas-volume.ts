import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';
import { ALL_MATERIALS, Material } from '../../shared/materials';
import { renderPhase, RenderPhase } from '../render-profile';

const vertexShader = /* glsl */`
out vec3 worldPosition;
void main() {
  worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition, 1.0);
}`;
const fragmentShader = /* glsl */`
precision highp sampler3D;
out vec4 fragColor;
#define gl_FragColor fragColor
uniform sampler2D densityMap;
uniform sampler3D noiseMap;
uniform sampler2D sceneDepth;
uniform vec3 bounds;
uniform vec2 resolution;
uniform mat4 inverseProjection;
uniform mat4 cameraWorld;
uniform float clock;
uniform float steps;
in vec3 worldPosition;

vec4 field(vec3 p) {
  vec2 uv = vec2(p.x / bounds.x + 0.5, 0.5 - p.y / bounds.y);
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec4(0.0);
  return texture(densityMap, uv);
}
float density(vec3 p, float support) {
  // The reconstructed slab has a rolling front and back, with a soft falloff
  // in depth. The same 3D field is sampled from every camera angle.
  vec3 q = p / 150.0 + vec3(0.0, -clock * 0.009, clock * 0.002);
  float billow = texture(noiseMap, q).r;
  float radius = (18.0 + 62.0 * smoothstep(0.02, 0.75, support)) * (0.70 + billow * 0.55);
  float depth = p.z / radius;
  float envelope = exp(-depth * depth * 2.7)
    * (1.0 - smoothstep(0.78, 1.0, abs(p.z) / (bounds.z * 0.5)));
  float folds = smoothstep(0.37, 0.66, billow);
  return support * envelope * (0.06 + folds * 2.0);
}
void main() {
  vec3 ray = normalize(worldPosition - cameraPosition);
  vec3 invRay = 1.0 / (sign(ray) * max(abs(ray), vec3(0.00001)) + vec3(0.0000001));
  vec3 a = (-bounds * 0.5 - cameraPosition) * invRay;
  vec3 b = ( bounds * 0.5 - cameraPosition) * invRay;
  vec3 enter = min(a, b), leave = max(a, b);
  float start = max(0.0, max(enter.x, max(enter.y, enter.z)));
  float end = min(leave.x, min(leave.y, leave.z));
  vec2 screenUv = gl_FragCoord.xy / resolution;
  float depth = texture(sceneDepth, screenUv).x;
  vec4 viewPoint = inverseProjection * vec4(screenUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec3 stopPoint = (cameraWorld * vec4(viewPoint.xyz / viewPoint.w, 1.0)).xyz;
  end = min(end, dot(stopPoint - cameraPosition, ray));
  if (end <= start) discard;
  float stride = (end - start) / steps;
  // Stable subpixel jitter removes slice bands without temporal crawling.
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec3 radiance = vec3(0.0);
  float transmission = 1.0;
  vec3 light = normalize(vec3(-0.55, 0.82, 0.25));
  float phase = 0.80 + 0.28 * pow(max(0.0, dot(ray, -light)), 3.0);
  for (int i = 0; i < 64; i++) {
    if (float(i) >= steps || transmission < 0.015) break;
    vec3 p = cameraPosition + ray * (start + (float(i) + jitter) * stride);
    vec4 gas = field(p);
    if (gas.a < 0.002) continue;
    float d = density(p, gas.a);
    vec3 towardLight = p + light * 18.0;
    float shadow = density(towardLight, field(towardLight).a) * 18.0;
    towardLight = p + light * 42.0;
    shadow += density(towardLight, field(towardLight).a) * 26.0;
    float sun = exp(-shadow * 0.090);
    vec3 illumination = vec3(0.065, 0.10, 0.16)
      + vec3(0.94, 0.89, 0.80) * sun * phase;
    // Multiple scattering keeps the deep interior luminous but cooler.
    illumination += vec3(0.07, 0.10, 0.15) * (1.0 - sun);
    float alpha = 1.0 - exp(-d * stride * 0.030);
    radiance += transmission * alpha * gas.rgb * illumination;
    transmission *= 1.0 - alpha;
  }
  float alpha = 1.0 - transmission;
  if (alpha < 0.002) discard;
  gl_FragColor = vec4(radiance / max(alpha, 0.0001), alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** A presentation volume reconstructed from native 2D gas occupancy. Physics
 * stays in TPT; ray integration, depth and lighting belong to the renderer. */
export class GasVolume {
  readonly mesh: THREE.Mesh<THREE.BoxGeometry, THREE.ShaderMaterial>;
  private readonly width: number;
  private readonly height: number;
  private readonly seed: Float32Array;
  private readonly scratch: Float32Array;
  private readonly blurred: Float32Array;
  private readonly bytes: Uint8Array;
  private readonly texture: THREE.DataTexture;
  private readonly noise: THREE.Data3DTexture;
  private readonly colors = new Map<number, THREE.Color>();
  private readonly depth = new THREE.WebGLRenderTarget(1, 1);
  private readonly depthMaterial = new THREE.MeshDepthMaterial();
  private readonly size = new THREE.Vector2();

  constructor(private readonly worldWidth: number, worldHeight: number) {
    this.width = Math.ceil(worldWidth / 2); this.height = Math.ceil(worldHeight / 2);
    this.bytes = new Uint8Array(this.width * this.height * 4);
    this.seed = new Float32Array(this.bytes.length);
    this.scratch = new Float32Array(this.bytes.length); this.blurred = new Float32Array(this.bytes.length);
    this.texture = new THREE.DataTexture(this.bytes, this.width, this.height);
    this.texture.minFilter = this.texture.magFilter = THREE.LinearFilter;
    const perlin = new ImprovedNoise(), size = 64, noise = new Uint8Array(size ** 3);
    for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      // Periodic blending prevents a visible seam in the repeating 3D tile.
      let value = 0;
      for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const weight = (dx ? x / size : 1 - x / size) * (dy ? y / size : 1 - y / size) * (dz ? z / size : 1 - z / size);
        const px = (x - dx * size) / 13, py = (y - dy * size) / 13, pz = (z - dz * size) / 13;
        value += weight * (perlin.noise(px, py, pz) * 0.72 + perlin.noise(px * 2.1 + 17, py * 2.1, pz * 2.1) * 0.28);
      }
      noise[(z * size + y) * size + x] = THREE.MathUtils.clamp(128 + value * 220, 0, 255);
    }
    this.noise = new THREE.Data3DTexture(noise, size, size, size);
    this.noise.format = THREE.RedFormat;
    this.noise.wrapS = this.noise.wrapT = this.noise.wrapR = THREE.RepeatWrapping;
    this.noise.minFilter = this.noise.magFilter = THREE.LinearFilter;
    this.noise.unpackAlignment = 1; this.noise.needsUpdate = true;
    this.depth.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    this.depthMaterial.blending = THREE.NoBlending;
    for (const info of ALL_MATERIALS) if (renderPhase(info) === RenderPhase.Gas) {
      this.colors.set(info.id, new THREE.Color(info.id === Material.Steam ? '#dce7eb' : info.color));
    }
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader, fragmentShader,
      transparent: true, depthWrite: false, depthTest: false, side: THREE.BackSide,
      uniforms: {
        densityMap: { value: this.texture }, noiseMap: { value: this.noise }, sceneDepth: { value: this.depth.depthTexture },
        bounds: { value: new THREE.Vector3(worldWidth, worldHeight, 180) }, resolution: { value: this.size },
        inverseProjection: { value: new THREE.Matrix4() }, cameraWorld: { value: new THREE.Matrix4() },
        clock: { value: 0 }, steps: { value: 56 },
      },
    });
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(worldWidth, worldHeight, 180), material);
    this.mesh.visible = false; this.mesh.renderOrder = 10;
    this.mesh.userData.excludeFromAO = true;
    this.mesh.raycast = () => {}; // Gas must never intercept brush picking.
  }

  update(cells: Uint8Array, walls?: Uint8Array): void {
    this.seed.fill(0);
    let count = 0;
    for (let i = 0; i < cells.length; i++) {
      const color = this.colors.get(cells[i]);
      if (!color || walls?.[i]) continue;
      const offset = (Math.floor(Math.floor(i / this.worldWidth) / 2) * this.width + Math.floor(i % this.worldWidth / 2)) * 4;
      this.seed[offset] += color.r * 0.25; this.seed[offset + 1] += color.g * 0.25;
      this.seed[offset + 2] += color.b * 0.25; this.seed[offset + 3] += 0.25; count++;
    }
    this.mesh.visible = count > 0;
    if (!count) return;
    const kernel = [1, 6, 15, 20, 15, 6, 1];
    for (let axis = 0; axis < 2; axis++) {
      const input = axis ? this.scratch : this.seed, output = axis ? this.blurred : this.scratch;
      output.fill(0);
      for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
        const offset = (y * this.width + x) * 4;
        for (let k = -3; k <= 3; k++) {
          const sx = axis ? x : x + k, sy = axis ? y + k : y;
          if (sx < 0 || sy < 0 || sx >= this.width || sy >= this.height) continue;
          const source = (sy * this.width + sx) * 4, weight = kernel[k + 3] / 64;
          for (let c = 0; c < 4; c++) output[offset + c] += input[source + c] * weight;
        }
      }
    }
    for (let i = 0; i < this.bytes.length; i += 4) {
      const mass = this.blurred[i + 3];
      for (let c = 0; c < 3; c++) this.bytes[i + c] = mass > 0 ? Math.round(this.blurred[i + c] / mass * 255) : 0;
      this.bytes[i + 3] = Math.round(Math.min(1, mass * 3.2) * 255);
    }
    this.texture.needsUpdate = true;
  }

  prepare(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, time: number, interactive: boolean): void {
    if (!this.mesh.visible) return;
    // OrbitControls may have changed the camera since the last renderer pass.
    // Depth reconstruction must use the same transform as this frame's rays.
    camera.updateMatrixWorld();
    renderer.getDrawingBufferSize(this.size);
    if (this.depth.width !== this.size.x || this.depth.height !== this.size.y) this.depth.setSize(this.size.x, this.size.y);
    const uniforms = this.mesh.material.uniforms;
    uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);
    uniforms.cameraWorld.value.copy(camera.matrixWorld);
    uniforms.clock.value = time / 1000; uniforms.steps.value = interactive ? 32 : 56;
    const hidden: THREE.Object3D[] = [];
    scene.traverse(object => {
      if (!object.visible) return;
      const material = (object as THREE.Mesh).material;
      if (object.userData.excludeFromAO || object instanceof THREE.Points
        || (material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0.5)) {
        hidden.push(object); object.visible = false;
      }
    });
    const target = renderer.getRenderTarget(), override = scene.overrideMaterial;
    const background = scene.background, shadowUpdate = renderer.shadowMap.needsUpdate;
    try {
      scene.background = null; scene.overrideMaterial = this.depthMaterial;
      renderer.shadowMap.needsUpdate = false;
      renderer.setRenderTarget(this.depth); renderer.clear(); renderer.render(scene, camera);
    } finally {
      renderer.setRenderTarget(target); scene.overrideMaterial = override; scene.background = background;
      renderer.shadowMap.needsUpdate = shadowUpdate;
      for (const object of hidden) object.visible = true;
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.texture.dispose();
    this.noise.dispose(); this.depth.dispose(); this.depthMaterial.dispose();
  }
}
