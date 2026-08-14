import { describe, expect, it } from 'vitest';
import {
  HDR_TONEMAP_FRAGMENT, HDR_VISUAL_LAB_TONEMAP_FRAGMENT, probeHDRPipelineSupport,
} from './hdr-vfx-pipeline';
import { HDR_VOLUME_LAB_LIQUID_DESCRIPTOR } from './hdr-volume-lab-liquid';

function uniformSamplers(shader: string): string[] {
  return [...shader.matchAll(/uniform\s+sampler2D\s+(\w+)\s*;/g)]
    .map((match) => match[1])
    .sort();
}

function occurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

class FakeWebGL2Context {
  readonly MAX_DRAW_BUFFERS = 0x8824;
  readonly MAX_COLOR_ATTACHMENTS = 0x8cdf;
  readonly FRAMEBUFFER_BINDING = 0x8ca6;
  readonly TEXTURE_BINDING_2D = 0x8069;
  readonly TEXTURE_2D = 0x0de1;
  readonly TEXTURE_MIN_FILTER = 0x2801;
  readonly TEXTURE_MAG_FILTER = 0x2800;
  readonly NEAREST = 0x2600;
  readonly RGBA16F = 0x881a;
  readonly FRAMEBUFFER = 0x8d40;
  readonly COLOR_ATTACHMENT0 = 0x8ce0;
  readonly FRAMEBUFFER_COMPLETE = 0x8cd5;

  readonly previousTexture = { kind: 'previous-texture' };
  readonly previousFramebuffer = { kind: 'previous-framebuffer' };
  readonly createdTexture = { kind: 'created-texture' };
  readonly createdFramebuffer = { kind: 'created-framebuffer' };
  readonly deletedTextures: unknown[] = [];
  readonly deletedFramebuffers: unknown[] = [];
  readonly textureBindings: unknown[] = [];
  readonly framebufferBindings: unknown[] = [];
  extensions = new Set<string>(['EXT_color_buffer_float']);
  maxDrawBuffers = 4;
  maxColorAttachments = 4;
  framebufferStatus = this.FRAMEBUFFER_COMPLETE;

  getParameter(parameter: number): unknown {
    if (parameter === this.MAX_DRAW_BUFFERS) return this.maxDrawBuffers;
    if (parameter === this.MAX_COLOR_ATTACHMENTS) return this.maxColorAttachments;
    if (parameter === this.FRAMEBUFFER_BINDING) return this.previousFramebuffer;
    if (parameter === this.TEXTURE_BINDING_2D) return this.previousTexture;
    return null;
  }

  getExtension(name: string): object | null { return this.extensions.has(name) ? {} : null; }
  createTexture(): unknown { return this.createdTexture; }
  createFramebuffer(): unknown { return this.createdFramebuffer; }
  bindTexture(_target: number, texture: unknown): void { this.textureBindings.push(texture); }
  texParameteri(): void { /* probe-only fake */ }
  texStorage2D(): void { /* probe-only fake */ }
  bindFramebuffer(_target: number, framebuffer: unknown): void {
    this.framebufferBindings.push(framebuffer);
  }
  framebufferTexture2D(): void { /* probe-only fake */ }
  checkFramebufferStatus(): number { return this.framebufferStatus; }
  deleteTexture(texture: unknown): void { this.deletedTextures.push(texture); }
  deleteFramebuffer(framebuffer: unknown): void { this.deletedFramebuffers.push(framebuffer); }
}

function withFakeWebGL2<T>(run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'WebGL2RenderingContext');
  Object.defineProperty(globalThis, 'WebGL2RenderingContext', {
    configurable: true,
    value: FakeWebGL2Context,
  });
  try {
    return run();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'WebGL2RenderingContext', descriptor);
    else delete (globalThis as { WebGL2RenderingContext?: unknown }).WebGL2RenderingContext;
  }
}

function probe(context: FakeWebGL2Context) {
  return withFakeWebGL2(() => probeHDRPipelineSupport(context as unknown as WebGL2RenderingContext));
}

describe('HDR VFX capability gate', () => {
  it('fails closed without an actual WebGL2 presenter context', () => {
    expect(probeHDRPipelineSupport(undefined)).toEqual({
      supported: false,
      reason: 'not-webgl2',
      maxDrawBuffers: 0,
      maxColorAttachments: 0,
    });
  });

  it('rejects a WebGL2 context without float color attachments', () => {
    const context = new FakeWebGL2Context();
    context.extensions.clear();

    expect(probe(context)).toEqual({
      supported: false,
      reason: 'float-color-unavailable',
      maxDrawBuffers: 4,
      maxColorAttachments: 4,
    });
    expect(context.deletedTextures).toEqual([]);
    expect(context.deletedFramebuffers).toEqual([]);
  });

  it('rejects insufficient MRT limits before allocating probe attachments', () => {
    const context = new FakeWebGL2Context();
    context.maxDrawBuffers = 1;

    expect(probe(context)).toEqual({
      supported: false,
      reason: 'mrt-unavailable',
      maxDrawBuffers: 1,
      maxColorAttachments: 4,
    });
    expect(context.deletedTextures).toEqual([]);
    expect(context.deletedFramebuffers).toEqual([]);
  });

  it('rejects an incomplete float framebuffer and restores caller bindings', () => {
    const context = new FakeWebGL2Context();
    context.framebufferStatus = 0;

    expect(probe(context)).toEqual({
      supported: false,
      reason: 'float-framebuffer-incomplete',
      maxDrawBuffers: 4,
      maxColorAttachments: 4,
    });
    expect(context.framebufferBindings).toEqual([
      context.createdFramebuffer,
      context.previousFramebuffer,
    ]);
    expect(context.textureBindings).toEqual([
      context.createdTexture,
      context.previousTexture,
    ]);
    expect(context.deletedFramebuffers).toEqual([context.createdFramebuffer]);
    expect(context.deletedTextures).toEqual([context.createdTexture]);
  });

  it('accepts a complete float framebuffer and releases temporary attachments', () => {
    const context = new FakeWebGL2Context();

    expect(probe(context)).toEqual({
      supported: true,
      maxDrawBuffers: 4,
      maxColorAttachments: 4,
    });
    expect(context.framebufferBindings.at(-1)).toBe(context.previousFramebuffer);
    expect(context.textureBindings.at(-1)).toBe(context.previousTexture);
    expect(context.deletedFramebuffers).toEqual([context.createdFramebuffer]);
    expect(context.deletedTextures).toEqual([context.createdTexture]);
  });
});

describe('HDR composition contract', () => {
  it('keeps the default compositor on its established seven inputs', () => {
    expect(uniformSamplers(HDR_TONEMAP_FRAGMENT)).toEqual([
      'uBloomTexture',
      'uHdrTexture',
      'uLiquidDepthTexture',
      'uLiquidTexture',
      'uMaterialVolumeTexture',
      'uSemanticTexture',
      'uWallTexture',
    ]);
    expect(HDR_TONEMAP_FRAGMENT).toMatch(/uniform\s+float\s+uLiquidSurfaceVfx\s*;/);
    expect(HDR_TONEMAP_FRAGMENT).not.toContain('uLiquidMotionVfx');
    expect(HDR_TONEMAP_FRAGMENT).toMatch(/uniform\s+float\s+uWaterCurvatureVfx\s*;/);
    expect(HDR_TONEMAP_FRAGMENT).toMatch(/uniform\s+vec2\s+uWorldTexel\s*;/);

    for (const sampler of ['uHdrTexture', 'uBloomTexture', 'uSemanticTexture',
      'uWallTexture', 'uLiquidTexture', 'uLiquidDepthTexture', 'uMaterialVolumeTexture']) {
      expect(occurrences(HDR_TONEMAP_FRAGMENT, sampler)).toBeGreaterThan(1);
    }
    expect(occurrences(HDR_TONEMAP_FRAGMENT, 'uWorldTexel')).toBeGreaterThan(1);
    expect(HDR_TONEMAP_FRAGMENT).not.toContain('uVisualLab');
    expect(HDR_TONEMAP_FRAGMENT).not.toContain('applyHdrLiquidSurfaceLab');
    expect(HDR_TONEMAP_FRAGMENT).not.toContain('applyHdrVolumeLab');
  });

  it('adds the reusable visual lab only to the explicit ten-input compositor', () => {
    expect(uniformSamplers(HDR_VISUAL_LAB_TONEMAP_FRAGMENT)).toEqual([
      'uAtmosphereStyleTexture',
      'uAtmosphereTexture',
      'uBloomTexture',
      'uEmissionTexture',
      'uHdrTexture',
      'uLiquidDepthTexture',
      'uLiquidTexture',
      'uMaterialVolumeTexture',
      'uSemanticTexture',
      'uWallTexture',
    ]);
    expect(HDR_VISUAL_LAB_TONEMAP_FRAGMENT).toMatch(/uniform\s+vec4\s+uVisualLab\s*;/);
    expect(HDR_VISUAL_LAB_TONEMAP_FRAGMENT).toContain('vec3 applyHdrLiquidSurfaceLab(');
    expect(HDR_VISUAL_LAB_TONEMAP_FRAGMENT).toContain('vec3 applyHdrVolumeLab(');
    expect(HDR_VISUAL_LAB_TONEMAP_FRAGMENT).toContain(
      'result = applyHdrLiquidSurfaceLab(',
    );
    expect(HDR_VISUAL_LAB_TONEMAP_FRAGMENT).toContain(
      'radiance = applyHdrVolumeLab(radiance, vUv);',
    );
    expect(HDR_VISUAL_LAB_TONEMAP_FRAGMENT).toContain(
      'if (labVariant < 0.5 || labGain < 0.0001) return radiance;',
    );
    expect(HDR_VISUAL_LAB_TONEMAP_FRAGMENT).not.toContain('uVisualLabTime');
  });

  it('reuses completed E08 locals for the liquid lab without another texture read', () => {
    const helper = HDR_VOLUME_LAB_LIQUID_DESCRIPTOR.source;
    expect(helper).toContain('labDomain != 2.0');
    expect(helper).toContain('wallBacked > 0.5');
    expect(helper).toContain('max(transmitted, vec3(0.0))');
    expect(helper).toContain('max(reflected, vec3(0.0))');
    expect(helper).not.toContain('texture(');
    expect(helper).toContain('float familyMotion');
    expect(helper).toContain('float motionLeading');
    expect(helper).toContain('float motionWake');
    expect(HDR_VISUAL_LAB_TONEMAP_FRAGMENT).toMatch(
      /result, material, surface, ripple, outward, transmitted, reflected,\s*wallBacked, max\(liquidMotion, oilMotion\), motionFacing/,
    );
    expect(HDR_TONEMAP_FRAGMENT).not.toContain('applyHdrLiquidLab');
  });

  it('recognizes only the exact Water, Oil, and Acid material identities', () => {
    expect(HDR_TONEMAP_FRAGMENT).toMatch(/const\s+float\s+MATERIAL_WATER\s*=\s*2\.0\s*;/);
    expect(HDR_TONEMAP_FRAGMENT).toMatch(/const\s+float\s+MATERIAL_OIL\s*=\s*8\.0\s*;/);
    expect(HDR_TONEMAP_FRAGMENT).toMatch(/const\s+float\s+MATERIAL_ACID\s*=\s*13\.0\s*;/);
    expect(HDR_TONEMAP_FRAGMENT).toMatch(/uLiquidSurfaceVfx\s*>\s*0\.5/);
  });

  it('keeps topology scene-alpha-owned and introduces no animated or extra pass input', () => {
    const finalWrites = [...HDR_TONEMAP_FRAGMENT.matchAll(/finalColor\s*=\s*([^;]+);/g)]
      .map((match) => match[1].trim());
    expect(finalWrites.length).toBeGreaterThan(0);
    for (const write of finalWrites) {
      expect(write === 'vec4(0.0)' || /,\s*scene\.a\s*\)$/.test(write)).toBe(true);
    }
    expect(HDR_TONEMAP_FRAGMENT).not.toMatch(/(?:finalColor|scene)\.a\s*=/);
    expect(HDR_TONEMAP_FRAGMENT).not.toContain('uTime');
    expect(HDR_TONEMAP_FRAGMENT).not.toMatch(/uniform\s+sampler2D\s+\w*(?:Target|Pass)\w*/i);
  });

  it('reuses E08 semantic cardinals for exact-Water velocity and changes RGB only', () => {
    expect(HDR_TONEMAP_FRAGMENT).toContain('state.ba * 2.0 - 1.0');
    for (const cardinal of ['semanticLeft', 'semanticRight', 'semanticTop', 'semanticBottom']) {
      expect(HDR_TONEMAP_FRAGMENT).toContain(`vec4 ${cardinal} = semanticState(`);
    }
    expect(HDR_TONEMAP_FRAGMENT).toMatch(
      /float\s+liquidMotion\s*=\s*exactMaterial\(material, MATERIAL_WATER\)\s*\*\s*smoothstep\(0\.10, 0\.58, motionEnergy\)/,
    );
    expect(HDR_TONEMAP_FRAGMENT).toContain('velocityShear');
    expect(HDR_TONEMAP_FRAGMENT).toContain('liquidAgitation');
    expect(HDR_TONEMAP_FRAGMENT).toContain('whitecap');
    expect(HDR_TONEMAP_FRAGMENT).not.toContain('uVelocityTexture');
    expect(HDR_TONEMAP_FRAGMENT).not.toContain('uMotionTexture');
    expect(HDR_TONEMAP_FRAGMENT).not.toContain('uLiquidMotionVfx');
    expect(HDR_TONEMAP_FRAGMENT).not.toContain('uTime');
  });

  it('keeps accepted E69 exact-Oil slick and wake in the E08 baseline without a selector', () => {
    const eligibilityStart = HDR_TONEMAP_FRAGMENT.indexOf('// Migrated E69');
    const eligibilityEnd = HDR_TONEMAP_FRAGMENT.indexOf('float motionFacing');
    expect(eligibilityStart).toBeGreaterThan(-1);
    expect(eligibilityEnd).toBeGreaterThan(eligibilityStart);
    const eligibility = HDR_TONEMAP_FRAGMENT.slice(
      eligibilityStart,
      eligibilityEnd,
    );
    const direction = HDR_TONEMAP_FRAGMENT.slice(
      HDR_TONEMAP_FRAGMENT.indexOf('float oilAgitation'),
      HDR_TONEMAP_FRAGMENT.indexOf('float ripple'),
    );
    const finish = HDR_TONEMAP_FRAGMENT.slice(
      HDR_TONEMAP_FRAGMENT.indexOf('// E69: exact moving Oil'),
      HDR_TONEMAP_FRAGMENT.indexOf('// E66:'),
    );
    expect(HDR_TONEMAP_FRAGMENT).toMatch(
      /float\s+oilMotion\s*=\s*exactMaterial\(material, MATERIAL_OIL\)\s*\*\s*smoothstep\(0\.06, 0\.42, motionEnergy\)/,
    );
    for (const reusedEvidence of [
      'motionEnergy', 'motionFacing', 'flowDirection', 'outward', 'surface',
      'reflected', 'worldPosition',
    ]) expect(HDR_TONEMAP_FRAGMENT).toContain(reusedEvidence);
    expect(HDR_TONEMAP_FRAGMENT).toContain('oilLeading');
    expect(HDR_TONEMAP_FRAGMENT).toContain('oilWake');
    expect(HDR_TONEMAP_FRAGMENT).toContain('oilRibbon');
    expect(HDR_TONEMAP_FRAGMENT).toContain('oilReflection');
    expect(HDR_TONEMAP_FRAGMENT).toMatch(
      /vec2 flowDirection = motionSpeed > 0\.01\s*\? centreVelocity \/ motionSpeed : vec2\(0\.0\);/,
    );
    expect(HDR_TONEMAP_FRAGMENT).toContain(
      'vec2 transportDirection = oilMotion > 0.001 ? oilFlowDirection : flowDirection;',
    );
    expect(eligibility).not.toContain('texture(');
    expect(direction).not.toContain('texture(');
    expect(finish).not.toContain('texture(');
    expect(finish).not.toContain('sin(');
    expect(HDR_TONEMAP_FRAGMENT).not.toContain('uOilMotionVfx');
    expect(HDR_TONEMAP_FRAGMENT).not.toContain('uOilMotionTexture');
    expect(HDR_TONEMAP_FRAGMENT).not.toContain('uOilSurfaceTexture');
    expect(HDR_TONEMAP_FRAGMENT).not.toContain('uTime');
  });

  it('derives E66 family curvature from guarded tangent probes on the existing liquid plane', () => {
    expect(HDR_TONEMAP_FRAGMENT).toMatch(
      /if \(uWaterCurvatureVfx > 0\.5 && wallBacked < 0\.5\)/,
    );
    expect(HDR_TONEMAP_FRAGMENT).toContain('vec4 curvaturePlus = texture(');
    expect(HDR_TONEMAP_FRAGMENT).toContain('vec4 curvatureMinus = texture(');
    expect(HDR_TONEMAP_FRAGMENT).toContain('tangent * uWorldTexel * 12.0');
    expect(HDR_TONEMAP_FRAGMENT).toContain('float curvatureResidual = edgeDensity');
    expect(HDR_TONEMAP_FRAGMENT).toContain('convexCrest');
    expect(HDR_TONEMAP_FRAGMENT).toContain('concavePocket');
    expect(HDR_TONEMAP_FRAGMENT).toContain('curvatureCrown');
    expect(HDR_TONEMAP_FRAGMENT).toContain('curvatureAbsorption');
    expect(HDR_TONEMAP_FRAGMENT).toContain('curvatureTransmissionTint');
    expect(HDR_TONEMAP_FRAGMENT).toContain('shoulderTransmission');
    expect(HDR_TONEMAP_FRAGMENT).toContain('pocketOpticalDepth');
    expect(HDR_TONEMAP_FRAGMENT).toContain('material == MATERIAL_OIL');
    expect(HDR_TONEMAP_FRAGMENT).toContain('MATERIAL_ACID');
    expect(HDR_TONEMAP_FRAGMENT).not.toContain('uCurvatureTexture');
    expect(HDR_TONEMAP_FRAGMENT).not.toContain('uWaterSurfaceTexture');
    expect(HDR_TONEMAP_FRAGMENT).not.toContain('uTime');
  });
});
