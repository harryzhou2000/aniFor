import { describe, expect, it } from 'vitest';
import {
  resolveCeramicGlazeVfxEnabled,
  DEFAULT_RENDER_LOOK, resolveGasBodyVfxEnabled, resolveGasCoreDepthVfxEnabled,
  resolveGasLightVfxEnabled,
  resolveGasMotionVfxEnabled,
  resolveLiquidBodyVfxEnabled, resolveLiquidSolidMeniscusVfxEnabled,
  resolveLiquidSurfaceVfxEnabled,
  resolveOrganicSubsurfaceVfxEnabled,
  resolvePlasmaCoreVfxEnabled,
  resolvePlatinumBodyVfxEnabled,
  resolveSolidBodyVfxEnabled,
  resolvePowderBodyVfxEnabled, resolvePowderLightVfxEnabled,
  resolvePowderSolidContactVfxEnabled, resolveRenderLook, resolveTranslucentEdgeVfxEnabled,
  resolveVolumeVfxEnabled, resolveWetSedimentVfxEnabled,
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

  it('keeps liquid/solid meniscus VFX subordinate to the connected liquid body', () => {
    expect(resolveLiquidSolidMeniscusVfxEnabled(
      'classic', '?liquidSolidMeniscusVfx=on',
    )).toBe(false);
    expect(resolveLiquidSolidMeniscusVfxEnabled('realistic', '')).toBe(true);
    expect(resolveLiquidSolidMeniscusVfxEnabled(
      'realistic', '?liquidBodyVfx=on&liquidSolidMeniscusVfx=off',
    )).toBe(false);
    expect(resolveLiquidSolidMeniscusVfxEnabled(
      'realistic', '?volumeVfx=0&liquidBodyVfx=on&liquidSolidMeniscusVfx=on',
    )).toBe(true);
    expect(resolveLiquidSolidMeniscusVfxEnabled(
      'realistic', '?liquidBodyVfx=off&liquidSolidMeniscusVfx=on',
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

  it('keeps spectral external gas lighting subordinate to the stable gas body', () => {
    expect(resolveGasLightVfxEnabled('classic', '?gasLightVfx=on')).toBe(false);
    expect(resolveGasLightVfxEnabled('realistic', '')).toBe(true);
    expect(resolveGasLightVfxEnabled('realistic', '?gasLightVfx=off')).toBe(false);
    expect(resolveGasLightVfxEnabled(
      'realistic', '?volumeVfx=0&gasBodyVfx=on&gasLightVfx=on',
    )).toBe(true);
    expect(resolveGasLightVfxEnabled(
      'realistic', '?gasBodyVfx=off&gasLightVfx=on',
    )).toBe(false);
  });

  it('keeps dense gas optical depth subordinate to the stable gas body', () => {
    expect(resolveGasCoreDepthVfxEnabled('classic', '?gasCoreDepthVfx=on')).toBe(false);
    expect(resolveGasCoreDepthVfxEnabled('realistic', '')).toBe(true);
    expect(resolveGasCoreDepthVfxEnabled(
      'realistic', '?gasBodyVfx=on&gasCoreDepthVfx=off',
    )).toBe(false);
    expect(resolveGasCoreDepthVfxEnabled(
      'realistic', '?volumeVfx=0&gasBodyVfx=on&gasCoreDepthVfx=on',
    )).toBe(true);
    expect(resolveGasCoreDepthVfxEnabled(
      'realistic', '?gasBodyVfx=off&gasCoreDepthVfx=on',
    )).toBe(false);
  });

  it('keeps dense Plasma containment independently measurable inside HDR looks', () => {
    expect(resolvePlasmaCoreVfxEnabled('classic', '?plasmaCoreVfx=on')).toBe(false);
    expect(resolvePlasmaCoreVfxEnabled('realistic', '')).toBe(true);
    expect(resolvePlasmaCoreVfxEnabled('realistic', '?volumeVfx=0')).toBe(false);
    expect(resolvePlasmaCoreVfxEnabled(
      'realistic', '?volumeVfx=0&plasmaCoreVfx=on',
    )).toBe(true);
    expect(resolvePlasmaCoreVfxEnabled(
      'neon-lab', '?volumeVfx=1&plasmaCoreVfx=off',
    )).toBe(false);
  });

  it('keeps opaque solid-body depth independently measurable inside HDR looks', () => {
    expect(resolveSolidBodyVfxEnabled('classic', '?solidBodyVfx=on')).toBe(false);
    expect(resolveSolidBodyVfxEnabled('realistic', '')).toBe(true);
    expect(resolveSolidBodyVfxEnabled('realistic', '?volumeVfx=0')).toBe(false);
    expect(resolveSolidBodyVfxEnabled(
      'realistic', '?volumeVfx=0&solidBodyVfx=on',
    )).toBe(true);
    expect(resolveSolidBodyVfxEnabled(
      'neon-lab', '?volumeVfx=1&solidBodyVfx=off',
    )).toBe(false);
  });

  it('keeps Platinum body optics independently measurable inside HDR looks', () => {
    expect(resolvePlatinumBodyVfxEnabled('classic', '?platinumBodyVfx=on')).toBe(false);
    expect(resolvePlatinumBodyVfxEnabled('realistic', '')).toBe(true);
    expect(resolvePlatinumBodyVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolvePlatinumBodyVfxEnabled('realistic', '?volumeVfx=0')).toBe(false);
    expect(resolvePlatinumBodyVfxEnabled(
      'realistic', '?volumeVfx=0&platinumBodyVfx=on',
    )).toBe(true);
    expect(resolvePlatinumBodyVfxEnabled(
      'neon-lab', '?volumeVfx=1&platinumBodyVfx=off',
    )).toBe(false);
  });

  it('keeps the exact Ceramic glaze independently measurable inside HDR looks', () => {
    expect(resolveCeramicGlazeVfxEnabled('classic', '?ceramicGlazeVfx=true')).toBe(false);
    expect(resolveCeramicGlazeVfxEnabled('realistic', '')).toBe(true);
    expect(resolveCeramicGlazeVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveCeramicGlazeVfxEnabled('realistic', '?volumeVfx=0')).toBe(false);
    expect(resolveCeramicGlazeVfxEnabled(
      'realistic', '?volumeVfx=0&ceramicGlazeVfx=on',
    )).toBe(true);
    expect(resolveCeramicGlazeVfxEnabled(
      'neon-lab', '?volumeVfx=1&ceramicGlazeVfx=false',
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

  it('keeps Glass/Ice edge transmission independent of the older translucent shell', () => {
    expect(resolveTranslucentEdgeVfxEnabled(
      'classic', '?translucentEdgeVfx=on',
    )).toBe(false);
    expect(resolveTranslucentEdgeVfxEnabled('realistic', '')).toBe(true);
    expect(resolveTranslucentEdgeVfxEnabled(
      'realistic', '?volumeVfx=0',
    )).toBe(false);
    expect(resolveTranslucentEdgeVfxEnabled(
      'realistic', '?volumeVfx=0&translucentEdgeVfx=on',
    )).toBe(true);
    expect(resolveTranslucentEdgeVfxEnabled(
      'neon-lab', '?volumeVfx=1&translucentEdgeVfx=off',
    )).toBe(false);
  });

  it('keeps Wax/PLNT subsurface optics independently switchable', () => {
    expect(resolveOrganicSubsurfaceVfxEnabled(
      'classic', '?organicSubsurfaceVfx=on',
    )).toBe(false);
    expect(resolveOrganicSubsurfaceVfxEnabled('realistic', '')).toBe(true);
    expect(resolveOrganicSubsurfaceVfxEnabled(
      'realistic', '?volumeVfx=0',
    )).toBe(false);
    expect(resolveOrganicSubsurfaceVfxEnabled(
      'realistic', '?volumeVfx=0&organicSubsurfaceVfx=on',
    )).toBe(true);
    expect(resolveOrganicSubsurfaceVfxEnabled(
      'neon-lab', '?volumeVfx=1&organicSubsurfaceVfx=off',
    )).toBe(false);
  });

  it('keeps wet-sediment optics independently switchable', () => {
    expect(resolveWetSedimentVfxEnabled('classic', '?wetSedimentVfx=on')).toBe(false);
    expect(resolveWetSedimentVfxEnabled('realistic', '')).toBe(true);
    expect(resolveWetSedimentVfxEnabled('realistic', '?volumeVfx=0')).toBe(false);
    expect(resolveWetSedimentVfxEnabled(
      'realistic', '?volumeVfx=0&wetSedimentVfx=on',
    )).toBe(true);
    expect(resolveWetSedimentVfxEnabled(
      'neon-lab', '?volumeVfx=1&wetSedimentVfx=off',
    )).toBe(false);
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
