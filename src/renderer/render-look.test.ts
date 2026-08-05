import { describe, expect, it } from 'vitest';
import {
  resolveBotanicalBodyVfxEnabled,
  resolveCeramicGlazeVfxEnabled,
  DEFAULT_RENDER_LOOK, resolveGasBodyVfxEnabled, resolveGasCoreDepthVfxEnabled,
  resolveGasLightVfxEnabled,
  resolveGlassBodyVfxEnabled,
  resolveGasMotionVfxEnabled,
  resolveLiquidBodyVfxEnabled, resolveLiquidSolidMeniscusVfxEnabled,
  resolveLiquidSurfaceVfxEnabled,
  resolveOilBodyVfxEnabled,
  resolveOrganicSubsurfaceVfxEnabled,
  resolvePlasmaCoreVfxEnabled,
  resolvePlatinumBodyVfxEnabled,
  resolveRockRoughnessVfxEnabled,
  resolveSolidBodyVfxEnabled,
  resolvePowderBodyVfxEnabled, resolvePowderLightVfxEnabled,
  resolvePowderSolidContactVfxEnabled, resolveRenderLook, resolveTranslucentEdgeVfxEnabled,
  resolveVolumeVfxEnabled, resolveWaterBodyVfxEnabled, resolveWetSedimentVfxEnabled,
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

  it('keeps exact ROCK roughness subordinate to opaque solid-body depth', () => {
    expect(resolveRockRoughnessVfxEnabled('classic', '?rockRoughnessVfx=on')).toBe(false);
    expect(resolveRockRoughnessVfxEnabled('realistic', '')).toBe(true);
    expect(resolveRockRoughnessVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveRockRoughnessVfxEnabled('realistic', '?solidBodyVfx=0')).toBe(false);
    expect(resolveRockRoughnessVfxEnabled(
      'realistic', '?solidBodyVfx=0&rockRoughnessVfx=1',
    )).toBe(false);
    expect(resolveRockRoughnessVfxEnabled(
      'realistic', '?volumeVfx=0&solidBodyVfx=1&rockRoughnessVfx=true',
    )).toBe(true);
    expect(resolveRockRoughnessVfxEnabled(
      'neon-lab', '?solidBodyVfx=1&rockRoughnessVfx=off',
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

  it('keeps the exact Wood/PLNT body replacement independently measurable', () => {
    expect(resolveBotanicalBodyVfxEnabled('classic', '?botanicalBodyVfx=true')).toBe(false);
    expect(resolveBotanicalBodyVfxEnabled('realistic', '')).toBe(true);
    expect(resolveBotanicalBodyVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveBotanicalBodyVfxEnabled('realistic', '?volumeVfx=0')).toBe(false);
    expect(resolveBotanicalBodyVfxEnabled(
      'realistic', '?volumeVfx=0&botanicalBodyVfx=on',
    )).toBe(true);
    expect(resolveBotanicalBodyVfxEnabled(
      'neon-lab', '?volumeVfx=1&botanicalBodyVfx=false',
    )).toBe(false);
  });

  it('keeps exact thick-Glass body transmission independently measurable', () => {
    expect(resolveGlassBodyVfxEnabled('classic', '?glassBodyVfx=true')).toBe(false);
    expect(resolveGlassBodyVfxEnabled('realistic', '')).toBe(true);
    expect(resolveGlassBodyVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveGlassBodyVfxEnabled('realistic', '?volumeVfx=0')).toBe(false);
    expect(resolveGlassBodyVfxEnabled(
      'realistic', '?volumeVfx=0&glassBodyVfx=1',
    )).toBe(true);
    expect(resolveGlassBodyVfxEnabled(
      'neon-lab', '?volumeVfx=1&glassBodyVfx=0',
    )).toBe(false);
    expect(resolveGlassBodyVfxEnabled('realistic', '?glassBodyVfx=on')).toBe(true);
    expect(resolveGlassBodyVfxEnabled('realistic', '?glassBodyVfx=true')).toBe(true);
    expect(resolveGlassBodyVfxEnabled('realistic', '?glassBodyVfx=off')).toBe(false);
    expect(resolveGlassBodyVfxEnabled('realistic', '?glassBodyVfx=false')).toBe(false);
  });

  it('keeps exact Oil recomposition subordinate to the liquid-body baseline', () => {
    expect(resolveOilBodyVfxEnabled('classic', '?oilBodyVfx=on')).toBe(false);
    expect(resolveOilBodyVfxEnabled('classic', '?oilBodyVfx=true')).toBe(false);
    expect(resolveOilBodyVfxEnabled('realistic', '')).toBe(true);
    expect(resolveOilBodyVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveOilBodyVfxEnabled('realistic', '?volumeVfx=0')).toBe(false);
    expect(resolveOilBodyVfxEnabled(
      'realistic', '?volumeVfx=0&liquidBodyVfx=1',
    )).toBe(true);
    expect(resolveOilBodyVfxEnabled(
      'realistic', '?volumeVfx=0&liquidBodyVfx=on&oilBodyVfx=true',
    )).toBe(true);
    expect(resolveOilBodyVfxEnabled(
      'realistic', '?liquidBodyVfx=0&oilBodyVfx=1',
    )).toBe(false);
    expect(resolveOilBodyVfxEnabled(
      'neon-lab', '?liquidBodyVfx=off&oilBodyVfx=on',
    )).toBe(false);
    expect(resolveOilBodyVfxEnabled(
      'realistic', '?liquidBodyVfx=1&oilBodyVfx=0',
    )).toBe(false);
    expect(resolveOilBodyVfxEnabled('realistic', '?oilBodyVfx=on')).toBe(true);
    expect(resolveOilBodyVfxEnabled('realistic', '?oilBodyVfx=true')).toBe(true);
    expect(resolveOilBodyVfxEnabled('realistic', '?oilBodyVfx=off')).toBe(false);
    expect(resolveOilBodyVfxEnabled('realistic', '?oilBodyVfx=false')).toBe(false);
  });

  it('keeps exact Water recomposition subordinate to the liquid-body baseline', () => {
    expect(resolveWaterBodyVfxEnabled('classic', '?waterBodyVfx=on')).toBe(false);
    expect(resolveWaterBodyVfxEnabled('realistic', '')).toBe(true);
    expect(resolveWaterBodyVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveWaterBodyVfxEnabled('realistic', '?volumeVfx=0')).toBe(false);
    expect(resolveWaterBodyVfxEnabled(
      'realistic', '?volumeVfx=0&liquidBodyVfx=1&waterBodyVfx=true',
    )).toBe(true);
    expect(resolveWaterBodyVfxEnabled(
      'realistic', '?liquidBodyVfx=0&waterBodyVfx=1',
    )).toBe(false);
    expect(resolveWaterBodyVfxEnabled(
      'neon-lab', '?liquidBodyVfx=on&waterBodyVfx=off',
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
