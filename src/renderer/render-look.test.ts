import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RENDER_LOOK, resolveGasBodyVfxEnabled, resolveGasMotionVfxEnabled,
  resolveLiquidBodyVfxEnabled, resolveLiquidSurfaceVfxEnabled,
  resolvePowderBodyVfxEnabled, resolvePowderLightVfxEnabled,
  resolvePowderSolidContactVfxEnabled, resolveRenderLook,
  resolveVolumeVfxEnabled,
} from './render-look';

describe('resolveRenderLook', () => {
  it('retains the established renderer as the experiment control', () => {
    expect(resolveRenderLook('')).toBe(DEFAULT_RENDER_LOOK);
    expect(resolveRenderLook('?renderLook=unknown')).toBe(DEFAULT_RENDER_LOOK);
  });

  it.each(['classic', 'realistic', 'neon-lab'] as const)(
    'accepts the %s preset',
    (look) => expect(resolveRenderLook(`?renderLook=${look}`)).toBe(look),
  );

  it('keeps volume VFX opt-in through an HDR preset and independently switchable', () => {
    expect(resolveVolumeVfxEnabled('classic', '?volumeVfx=on')).toBe(false);
    expect(resolveVolumeVfxEnabled('realistic', '')).toBe(true);
    expect(resolveVolumeVfxEnabled('neon-lab', '?volumeVfx=1')).toBe(true);
    expect(resolveVolumeVfxEnabled('realistic', '?volumeVfx=0')).toBe(false);
    expect(resolveVolumeVfxEnabled('neon-lab', '?volumeVfx=off')).toBe(false);
  });

  it('lets liquid-body VFX follow the preset or override broad volume styling', () => {
    expect(resolveLiquidBodyVfxEnabled('classic', '?liquidBodyVfx=on')).toBe(false);
    expect(resolveLiquidBodyVfxEnabled('realistic', '')).toBe(true);
    expect(resolveLiquidBodyVfxEnabled('realistic', '?volumeVfx=0')).toBe(false);
    expect(resolveLiquidBodyVfxEnabled(
      'realistic', '?volumeVfx=0&liquidBodyVfx=on',
    )).toBe(true);
    expect(resolveLiquidBodyVfxEnabled(
      'neon-lab', '?volumeVfx=1&liquidBodyVfx=off',
    )).toBe(false);
  });

  it('keeps liquid-surface VFX subordinate to the established liquid body', () => {
    expect(resolveLiquidSurfaceVfxEnabled('classic', '?liquidSurfaceVfx=on')).toBe(false);
    expect(resolveLiquidSurfaceVfxEnabled('realistic', '')).toBe(true);
    expect(resolveLiquidSurfaceVfxEnabled(
      'realistic', '?liquidBodyVfx=on&liquidSurfaceVfx=off',
    )).toBe(false);
    expect(resolveLiquidSurfaceVfxEnabled(
      'realistic', '?volumeVfx=0&liquidBodyVfx=on',
    )).toBe(true);
    expect(resolveLiquidSurfaceVfxEnabled(
      'realistic', '?liquidBodyVfx=off&liquidSurfaceVfx=on',
    )).toBe(false);
  });

  it('lets gas-body VFX follow the preset or override broad volume styling', () => {
    expect(resolveGasBodyVfxEnabled('classic', '?gasBodyVfx=on')).toBe(false);
    expect(resolveGasBodyVfxEnabled('realistic', '')).toBe(true);
    expect(resolveGasBodyVfxEnabled('realistic', '?volumeVfx=0')).toBe(false);
    expect(resolveGasBodyVfxEnabled(
      'realistic', '?volumeVfx=0&gasBodyVfx=on',
    )).toBe(true);
    expect(resolveGasBodyVfxEnabled(
      'neon-lab', '?volumeVfx=1&gasBodyVfx=off',
    )).toBe(false);
  });

  it('keeps velocity-aware gas lighting subordinate to the stable gas body', () => {
    expect(resolveGasMotionVfxEnabled('classic', '?gasMotionVfx=on')).toBe(false);
    expect(resolveGasMotionVfxEnabled('realistic', '')).toBe(true);
    expect(resolveGasMotionVfxEnabled('realistic', '?gasMotionVfx=off')).toBe(false);
    expect(resolveGasMotionVfxEnabled(
      'realistic', '?volumeVfx=0&gasBodyVfx=on&gasMotionVfx=on',
    )).toBe(true);
    expect(resolveGasMotionVfxEnabled(
      'realistic', '?gasBodyVfx=off&gasMotionVfx=on',
    )).toBe(false);
  });

  it('lets powder-body VFX follow the preset or override broad volume styling', () => {
    expect(resolvePowderBodyVfxEnabled('classic', '?powderBodyVfx=on')).toBe(false);
    expect(resolvePowderBodyVfxEnabled('realistic', '')).toBe(true);
    expect(resolvePowderBodyVfxEnabled('realistic', '?volumeVfx=0')).toBe(false);
    expect(resolvePowderBodyVfxEnabled(
      'realistic', '?volumeVfx=0&powderBodyVfx=on',
    )).toBe(true);
    expect(resolvePowderBodyVfxEnabled(
      'neon-lab', '?volumeVfx=1&powderBodyVfx=off',
    )).toBe(false);
  });

  it('keeps powder/solid contact VFX independent of the powder-body crown layer', () => {
    expect(resolvePowderSolidContactVfxEnabled(
      'classic', '?powderSolidContactVfx=on',
    )).toBe(false);
    expect(resolvePowderSolidContactVfxEnabled('realistic', '')).toBe(true);
    expect(resolvePowderSolidContactVfxEnabled(
      'realistic', '?volumeVfx=0',
    )).toBe(false);
    expect(resolvePowderSolidContactVfxEnabled(
      'realistic', '?volumeVfx=0&powderSolidContactVfx=on',
    )).toBe(true);
    expect(resolvePowderSolidContactVfxEnabled(
      'neon-lab', '?volumeVfx=1&powderSolidContactVfx=off',
    )).toBe(false);
    expect(resolvePowderSolidContactVfxEnabled(
      'realistic', '?powderBodyVfx=off',
    )).toBe(true);
  });

  it('lets powder-light VFX follow the preset or override broad volume styling', () => {
    expect(resolvePowderLightVfxEnabled('classic', '?powderLightVfx=on')).toBe(false);
    expect(resolvePowderLightVfxEnabled('realistic', '')).toBe(true);
    expect(resolvePowderLightVfxEnabled('realistic', '?volumeVfx=0')).toBe(false);
    expect(resolvePowderLightVfxEnabled(
      'realistic', '?volumeVfx=0&powderLightVfx=on',
    )).toBe(true);
    expect(resolvePowderLightVfxEnabled(
      'neon-lab', '?volumeVfx=1&powderLightVfx=off',
    )).toBe(false);
  });
});
