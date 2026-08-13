import { describe, expect, it } from 'vitest';
import {
  assembleHdrVisualLabShader,
  HDR_VOLUME_LAB_ADAPTERS,
  HDR_VOLUME_LAB_DOMAIN_ADAPTERS,
  HDR_VOLUME_LAB_GLSL,
} from './hdr-volume-lab';
import {
  HDR_VOLUME_LAB_ADAPTER_REGISTRY,
  HDR_VOLUME_LAB_LEAF_ADAPTERS_BY_DOMAIN,
} from './hdr-volume-lab-adapters';
import { HDR_VOLUME_LAB_EMISSION_DESCRIPTOR } from './hdr-volume-lab-emission';
import { HDR_VOLUME_LAB_GAS_DESCRIPTOR } from './hdr-volume-lab-gas';
import { HDR_VOLUME_LAB_LIQUID_DESCRIPTOR } from './hdr-volume-lab-liquid';
import {
  VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS,
  type VisualLabSampler,
} from './visual-lab';

const occurrences = (source: string, needle: string): number => (
  source.split(needle).length - 1
);

const KNOWN_VISUAL_LAB_SAMPLERS = new Set<VisualLabSampler>([
  'hdr', 'bloom', 'semantic', 'wall', 'liquid',
  'atmosphere', 'atmosphereStyle', 'emission',
]);

describe('HDR Visual Lab domain adapters', () => {
  it('derives the frozen public tuple from explicit leaves in implemented-domain order', () => {
    expect(HDR_VOLUME_LAB_LEAF_ADAPTERS_BY_DOMAIN).toEqual({
      liquid: HDR_VOLUME_LAB_LIQUID_DESCRIPTOR,
      gas: HDR_VOLUME_LAB_GAS_DESCRIPTOR,
      emission: HDR_VOLUME_LAB_EMISSION_DESCRIPTOR,
    });
    expect(Object.keys(HDR_VOLUME_LAB_LEAF_ADAPTERS_BY_DOMAIN)).toEqual([
      'liquid', 'gas', 'emission',
    ]);
    expect(Object.keys(VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS)).toEqual(
      Object.keys(HDR_VOLUME_LAB_LEAF_ADAPTERS_BY_DOMAIN),
    );
    expect(HDR_VOLUME_LAB_ADAPTER_REGISTRY).toEqual([
      HDR_VOLUME_LAB_LIQUID_DESCRIPTOR,
      HDR_VOLUME_LAB_GAS_DESCRIPTOR,
      HDR_VOLUME_LAB_EMISSION_DESCRIPTOR,
    ]);
    expect(HDR_VOLUME_LAB_ADAPTER_REGISTRY).toEqual(
      Object.keys(VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS).map(
        (domain) => HDR_VOLUME_LAB_LEAF_ADAPTERS_BY_DOMAIN[
          domain as keyof typeof HDR_VOLUME_LAB_LEAF_ADAPTERS_BY_DOMAIN
        ],
      ),
    );
    expect(Object.isFrozen(HDR_VOLUME_LAB_LEAF_ADAPTERS_BY_DOMAIN)).toBe(true);
    expect(Object.isFrozen(HDR_VOLUME_LAB_ADAPTER_REGISTRY)).toBe(true);
    for (const adapter of HDR_VOLUME_LAB_ADAPTER_REGISTRY) {
      expect(Object.isFrozen(adapter)).toBe(true);
      expect(Object.isFrozen(adapter.budget)).toBe(true);
      expect(Object.isFrozen(adapter.budget.existingSamplerReads)).toBe(true);
    }

    expect(HDR_VOLUME_LAB_ADAPTERS).toStrictEqual(HDR_VOLUME_LAB_ADAPTER_REGISTRY);
    HDR_VOLUME_LAB_ADAPTERS.forEach((adapter, index) => {
      expect(adapter).toBe(HDR_VOLUME_LAB_ADAPTER_REGISTRY[index]);
    });
    expect(HDR_VOLUME_LAB_DOMAIN_ADAPTERS).toEqual({
      liquid: HDR_VOLUME_LAB_ADAPTER_REGISTRY[0],
      gas: HDR_VOLUME_LAB_ADAPTER_REGISTRY[1],
      emission: HDR_VOLUME_LAB_ADAPTER_REGISTRY[2],
    });
  });

  it('assembles one frozen canonical tuple and complete adapter map in stable domain order', () => {
    expect(HDR_VOLUME_LAB_ADAPTERS).toEqual([
      HDR_VOLUME_LAB_LIQUID_DESCRIPTOR,
      HDR_VOLUME_LAB_GAS_DESCRIPTOR,
      HDR_VOLUME_LAB_EMISSION_DESCRIPTOR,
    ]);
    expect(Object.isFrozen(HDR_VOLUME_LAB_ADAPTERS)).toBe(true);
    expect(Object.keys(HDR_VOLUME_LAB_DOMAIN_ADAPTERS)).toEqual([
      'liquid', 'gas', 'emission',
    ]);
    expect(HDR_VOLUME_LAB_DOMAIN_ADAPTERS).toEqual({
      liquid: HDR_VOLUME_LAB_LIQUID_DESCRIPTOR,
      gas: HDR_VOLUME_LAB_GAS_DESCRIPTOR,
      emission: HDR_VOLUME_LAB_EMISSION_DESCRIPTOR,
    });
    expect(Object.isFrozen(HDR_VOLUME_LAB_DOMAIN_ADAPTERS)).toBe(true);

    for (const [domain, adapter] of Object.entries(HDR_VOLUME_LAB_DOMAIN_ADAPTERS)) {
      expect(Object.isFrozen(adapter)).toBe(true);
      expect(adapter.domain).toBe(domain);
      expect(adapter.domainCode).toBe(
        VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS[
          domain as keyof typeof VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS
        ].domainCode,
      );
      expect(occurrences(HDR_VOLUME_LAB_GLSL, adapter.source)).toBe(1);
    }
    expect(Object.values(HDR_VOLUME_LAB_DOMAIN_ADAPTERS)).toEqual(HDR_VOLUME_LAB_ADAPTERS);
  });

  it('generates one explicit hook wrapper per leaf without numeric domain-range assumptions', () => {
    const assembled = assembleHdrVisualLabShader(HDR_VOLUME_LAB_ADAPTERS);
    expect(assembled.adapters).toStrictEqual(HDR_VOLUME_LAB_ADAPTERS);
    expect(assembled.domainAdapters).toStrictEqual(HDR_VOLUME_LAB_DOMAIN_ADAPTERS);
    expect(assembled.source).toBe(HDR_VOLUME_LAB_GLSL);

    const liquidWrapperStart = assembled.source.indexOf('vec3 applyHdrLiquidSurfaceLab(');
    const volumeWrapperStart = assembled.source.indexOf('vec3 applyHdrVolumeLab(');
    expect(liquidWrapperStart).toBeGreaterThan(-1);
    expect(volumeWrapperStart).toBeGreaterThan(liquidWrapperStart);
    const liquidWrapper = assembled.source.slice(liquidWrapperStart, volumeWrapperStart);
    const volumeWrapper = assembled.source.slice(volumeWrapperStart);

    for (const adapter of HDR_VOLUME_LAB_ADAPTERS) {
      expect(occurrences(assembled.source, adapter.source)).toBe(1);
      expect(occurrences(assembled.source, `vec3 ${adapter.entryPoint}(`)).toBe(1);
    }
    expect(occurrences(liquidWrapper, HDR_VOLUME_LAB_LIQUID_DESCRIPTOR.entryPoint)).toBe(1);
    expect(volumeWrapper).not.toContain(HDR_VOLUME_LAB_LIQUID_DESCRIPTOR.entryPoint);

    for (const adapter of [HDR_VOLUME_LAB_GAS_DESCRIPTOR, HDR_VOLUME_LAB_EMISSION_DESCRIPTOR]) {
      expect(occurrences(volumeWrapper, adapter.entryPoint)).toBe(1);
      expect(volumeWrapper).toContain(`labDomain == ${adapter.domainCode}.0`);
    }
    expect(volumeWrapper).not.toMatch(/labDomain\s*<\s*2\.5/);
  });

  it('fails closed for malformed, incomplete, or noncanonical adapter registries', () => {
    type Registry = Parameters<typeof assembleHdrVisualLabShader>[0];
    const registry = (adapters: readonly unknown[]): Registry => adapters as unknown as Registry;
    const [liquid, gas, emission] = HDR_VOLUME_LAB_ADAPTERS;

    expect(() => assembleHdrVisualLabShader(registry([gas, liquid, emission]))).toThrow();
    expect(() => assembleHdrVisualLabShader(registry([liquid, gas]))).toThrow();
    expect(() => assembleHdrVisualLabShader(registry([
      liquid,
      { ...gas, domain: 'liquid' },
      emission,
    ]))).toThrow();
    expect(() => assembleHdrVisualLabShader(registry([
      liquid,
      { ...gas, domainCode: liquid.domainCode },
      emission,
    ]))).toThrow();
    expect(() => assembleHdrVisualLabShader(registry([
      liquid,
      gas,
      { ...emission, entryPoint: gas.entryPoint },
    ]))).toThrow();
    expect(() => assembleHdrVisualLabShader(registry([
      liquid,
      { ...gas, hook: 'unsupported-hook' },
      emission,
    ]))).toThrow();
    expect(() => assembleHdrVisualLabShader(registry([
      liquid,
      { ...gas, entryPoint: 'applyHdrGasLab; unsafe' },
      emission,
    ]))).toThrow();
    expect(() => assembleHdrVisualLabShader(registry([
      liquid,
      { ...gas, entryPoint: 'applyHdrMissingLab' },
      emission,
    ]))).toThrow();
  });

  it('keeps domain hooks explicit and preserves their established entry-point ABIs', () => {
    expect(HDR_VOLUME_LAB_LIQUID_DESCRIPTOR).toMatchObject({
      hook: 'liquid-surface', entryPoint: 'applyHdrLiquidLab',
    });
    expect(HDR_VOLUME_LAB_GAS_DESCRIPTOR).toMatchObject({
      hook: 'volume-field', entryPoint: 'applyHdrGasLab',
    });
    expect(HDR_VOLUME_LAB_EMISSION_DESCRIPTOR).toMatchObject({
      hook: 'volume-field', entryPoint: 'applyHdrEmissionLab',
    });
    expect(HDR_VOLUME_LAB_GLSL).toContain(
      'applyHdrGasLab(\n      radiance, uv, worldPosition, labTarget, labVariant, labGain',
    );
    expect(HDR_VOLUME_LAB_GLSL).toContain(
      'applyHdrEmissionLab(\n      radiance, uv, worldPosition, labTarget, labVariant, labGain',
    );
  });

  it('keeps liquid local-only and every candidate RGB-only and clock-free', () => {
    expect(HDR_VOLUME_LAB_LIQUID_DESCRIPTOR.source).not.toContain('texture(');
    expect(occurrences(HDR_VOLUME_LAB_GAS_DESCRIPTOR.source, 'texture(')).toBe(6);
    expect(occurrences(HDR_VOLUME_LAB_EMISSION_DESCRIPTOR.source, 'texture(')).toBe(5);

    for (const adapter of Object.values(HDR_VOLUME_LAB_DOMAIN_ADAPTERS)) {
      expect(adapter.source).not.toMatch(/uniform\s+sampler2D/);
      expect(adapter.source).not.toContain('uTime');
      expect(adapter.source).not.toContain('finalColor');
      expect(adapter.source).not.toContain('gl_FragColor');
      expect(adapter.source).not.toMatch(/\.a\s*=/);
    }
  });

  it('accounts for existing sampler reads without adding compositor resources', () => {
    expect(HDR_VOLUME_LAB_LIQUID_DESCRIPTOR.budget.existingSamplerReads).toEqual({});
    expect(HDR_VOLUME_LAB_GAS_DESCRIPTOR.budget.existingSamplerReads).toEqual({
      wall: 1, atmosphere: 5, atmosphereStyle: 1,
    });
    expect(HDR_VOLUME_LAB_EMISSION_DESCRIPTOR.budget.existingSamplerReads).toEqual({
      wall: 1, semantic: 1, emission: 5,
    });
    expect(HDR_VOLUME_LAB_GAS_DESCRIPTOR.budget.existingSamplerReads.atmosphere).toBe(
      occurrences(HDR_VOLUME_LAB_GAS_DESCRIPTOR.source, 'uAtmosphereTexture'),
    );
    expect(HDR_VOLUME_LAB_GAS_DESCRIPTOR.budget.existingSamplerReads.atmosphereStyle).toBe(
      occurrences(HDR_VOLUME_LAB_GAS_DESCRIPTOR.source, 'uAtmosphereStyleTexture'),
    );
    expect(HDR_VOLUME_LAB_EMISSION_DESCRIPTOR.budget.existingSamplerReads.emission).toBe(
      occurrences(HDR_VOLUME_LAB_EMISSION_DESCRIPTOR.source, 'uEmissionTexture'),
    );
    expect(HDR_VOLUME_LAB_EMISSION_DESCRIPTOR.budget.existingSamplerReads.semantic).toBe(
      occurrences(HDR_VOLUME_LAB_EMISSION_DESCRIPTOR.source, 'semanticState(uv)'),
    );
    expect(occurrences(HDR_VOLUME_LAB_GLSL, 'texture(uWallTexture')).toBe(1);

    const expectedReadBudgets = [0, 7, 7];
    Object.values(HDR_VOLUME_LAB_DOMAIN_ADAPTERS).forEach((adapter, index) => {
      const budget = adapter.budget;
      const samplerReads = Object.entries(budget.existingSamplerReads);
      expect(samplerReads.every(([sampler]) => (
        KNOWN_VISUAL_LAB_SAMPLERS.has(sampler as VisualLabSampler)
      ))).toBe(true);
      expect(samplerReads.reduce((sum, [, reads]) => sum + reads, 0)).toBe(
        expectedReadBudgets[index],
      );
      expect(budget.maxAdditionalTextureReadsPerFragment).toBe(expectedReadBudgets[index]);
      expect(budget.adds).toEqual({
        samplers: 0, textures: 0, fields: 0, passes: 0, targets: 0,
      });
      expect(Object.isFrozen(budget)).toBe(true);
      expect(Object.isFrozen(budget.existingSamplerReads)).toBe(true);
      expect(Object.isFrozen(budget.adds)).toBe(true);
    });
  });

  it('retains variant-zero no-op and shared wall guards in the facade', () => {
    expect(HDR_VOLUME_LAB_LIQUID_DESCRIPTOR.source).toContain(
      'labVariant < 0.5 || labGain < 0.0001',
    );
    expect(HDR_VOLUME_LAB_GLSL).toContain(
      'if (labVariant < 0.5 || labGain < 0.0001) return radiance;',
    );
    expect(HDR_VOLUME_LAB_GLSL).toContain(
      'if (labDomain != 3.0 && labDomain != 4.0) return radiance;',
    );
    expect(HDR_VOLUME_LAB_GLSL).not.toMatch(/labDomain\s*<\s*2\.5/);
    expect(HDR_VOLUME_LAB_GLSL).toContain('if (wall > 0.5) return radiance;');
  });
});
