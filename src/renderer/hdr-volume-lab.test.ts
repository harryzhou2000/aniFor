import { describe, expect, it } from 'vitest';
import {
  HDR_VOLUME_LAB_DOMAIN_ADAPTERS,
  HDR_VOLUME_LAB_GLSL,
} from './hdr-volume-lab';
import { HDR_VOLUME_LAB_EMISSION_DESCRIPTOR } from './hdr-volume-lab-emission';
import { HDR_VOLUME_LAB_GAS_DESCRIPTOR } from './hdr-volume-lab-gas';
import { HDR_VOLUME_LAB_LIQUID_DESCRIPTOR } from './hdr-volume-lab-liquid';
import { VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS } from './visual-lab';

const occurrences = (source: string, needle: string): number => (
  source.split(needle).length - 1
);

describe('HDR Visual Lab domain adapters', () => {
  it('assembles one frozen, complete adapter map in stable domain order', () => {
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

  it('retains variant-zero no-op and shared wall guards in the facade', () => {
    expect(HDR_VOLUME_LAB_LIQUID_DESCRIPTOR.source).toContain(
      'labVariant < 0.5 || labGain < 0.0001',
    );
    expect(HDR_VOLUME_LAB_GLSL).toContain(
      'if (labVariant < 0.5 || labGain < 0.0001) return radiance;',
    );
    expect(HDR_VOLUME_LAB_GLSL).toContain('if (labDomain < 2.5) return radiance;');
    expect(HDR_VOLUME_LAB_GLSL).toContain('if (wall > 0.5) return radiance;');
  });
});
