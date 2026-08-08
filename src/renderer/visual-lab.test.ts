import { describe, expect, it } from 'vitest';
import {
  DISABLED_VISUAL_LAB_STATE,
  isVisualLabDomainImplemented,
  packVisualLabState,
  resolveVisualLabState,
  VISUAL_LAB_DOMAIN_CAPABILITY,
  VISUAL_LAB_DOMAIN_CODE,
  VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS,
} from './visual-lab';

describe('normal-WebGL visual lab state', () => {
  it('keeps stable shader-facing domain codes and vec4 packing', () => {
    expect(VISUAL_LAB_DOMAIN_CODE).toEqual({ off: 0, powder: 1, liquid: 2, gas: 3, emission: 4 });
    const state = resolveVisualLabState(
      'realistic', 2, '?visualLab=liquid&visualVariant=2&visualTarget=217&visualGain=1.25',
    );
    expect(Object.isFrozen(state)).toBe(true);
    expect([...packVisualLabState(state)]).toEqual([2, 2, 217, 1.25]);
  });

  it('uses compact defaults and clamps finite gain', () => {
    expect(resolveVisualLabState('neon-lab', 4, '?visualLab=gas')).toEqual({
      domain: 'gas', domainCode: 3, variant: 0, target: 0, gain: 1,
    });
    expect(resolveVisualLabState(
      'realistic', 1, '?visualLab=liquid&visualVariant=1&visualTarget=12.5&visualGain=-4',
    )).toMatchObject({ variant: 1, target: 0, gain: 0 });
    expect(resolveVisualLabState(
      'realistic', 1, '?visualLab=emission&visualTarget=999&visualGain=Infinity',
    )).toMatchObject({ target: 0, gain: 1 });
    expect(resolveVisualLabState(
      'realistic', 1, '?visualLab=emission&visualGain=9',
    )).toMatchObject({ gain: 2 });
  });

  it('centralizes implemented domains while retaining reserved shader codes', () => {
    expect(VISUAL_LAB_DOMAIN_CAPABILITY.gas).toEqual({
      implemented: true, targetKind: 'propagated-atmosphere-style-byte',
    });
    expect(VISUAL_LAB_DOMAIN_CAPABILITY.powder).toEqual({
      implemented: false, targetKind: 'semantic-material-id',
    });
    expect(isVisualLabDomainImplemented('liquid')).toBe(true);
    expect(isVisualLabDomainImplemented('powder')).toBe(false);
    expect(resolveVisualLabState(
      'realistic', 2, '?visualLab=powder&visualVariant=1&visualTarget=1',
    )).toBe(DISABLED_VISUAL_LAB_STATE);
  });

  it('exports a deeply frozen complete descriptor table for implemented domains', () => {
    expect(VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS).toEqual({
      liquid: { domainCode: 2, targetKind: 'semantic-material-id' },
      gas: { domainCode: 3, targetKind: 'propagated-atmosphere-style-byte' },
      emission: { domainCode: 4, targetKind: 'semantic-material-id' },
    });
    expect(Object.isFrozen(VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS)).toBe(true);
    for (const descriptor of Object.values(VISUAL_LAB_IMPLEMENTED_DOMAIN_DESCRIPTORS)) {
      expect(Object.isFrozen(descriptor)).toBe(true);
    }
    for (const capability of Object.values(VISUAL_LAB_DOMAIN_CAPABILITY)) {
      expect(Object.isFrozen(capability)).toBe(true);
    }
  });

  it('collapses Classic, off, invalid/reserved domains, and true 8x to the disabled state', () => {
    expect(resolveVisualLabState('classic', 2, '?visualLab=gas&visualVariant=1'))
      .toBe(DISABLED_VISUAL_LAB_STATE);
    expect(resolveVisualLabState('realistic', 2, '?visualLab=off&visualVariant=1'))
      .toBe(DISABLED_VISUAL_LAB_STATE);
    expect(resolveVisualLabState('realistic', 2, '?visualLab=solid&visualVariant=1'))
      .toBe(DISABLED_VISUAL_LAB_STATE);
    expect(resolveVisualLabState('realistic', 8, '?visualLab=gas&visualVariant=1'))
      .toBe(DISABLED_VISUAL_LAB_STATE);
  });

  it('requires an explicit valid domain and variant during input audits', () => {
    expect(resolveVisualLabState('realistic', 2, '?inputAudit=1&visualLab=gas'))
      .toBe(DISABLED_VISUAL_LAB_STATE);
    expect(resolveVisualLabState(
      'realistic', 2, '?inputAudit=1&visualLab=gas&visualVariant=0',
    )).toMatchObject({ domain: 'gas', variant: 0 });
  });
});
