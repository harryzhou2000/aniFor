import {
  Application, Container, Mesh, MeshGeometry, RenderTexture, Shader, Texture, UniformGroup,
} from 'pixi.js';
import type { FieldOutputScale } from './render-resolution';
import type { RenderLook } from './render-look';

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

const TONEMAP_FRAGMENT = `
in vec2 vUv;
out vec4 finalColor;
uniform sampler2D uHdrTexture;
uniform sampler2D uBloomTexture;
uniform float uBloomIntensity;
uniform float uExposure;
uniform float uSaturation;

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

  private constructor(
    private readonly renderer: RenderPassRenderer,
    private readonly sourceScene: Container,
    width: number,
    height: number,
    outputScale: FieldOutputScale,
    look: Exclude<RenderLook, 'classic'>,
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
      this.compositeScene.addChild(createPassMesh(
        width, height, TONEMAP_FRAGMENT,
        {
          passUniforms: new UniformGroup({
            uBloomIntensity: { value: look === 'neon-lab' ? 0.62 : 0.34, type: 'f32' },
            uExposure: { value: look === 'neon-lab' ? 1.04 : 1.0, type: 'f32' },
            uSaturation: { value: look === 'neon-lab' ? 1.14 : 1.01, type: 'f32' },
          }),
          uHdrTexture: hdrTarget.source,
          uHdrSampler: hdrTarget.source.style,
          uBloomTexture: bloomB.source,
          uBloomSampler: bloomB.source.style,
        },
        'hdr-aces-composite',
      ));
      this.hdrTarget = hdrTarget;
      this.bloomA = bloomA;
      this.bloomB = bloomB;
      this.info = {
        active: true, look,
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
        sourceScene, width, height, outputScale, look,
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
