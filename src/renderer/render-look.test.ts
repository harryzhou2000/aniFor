import { describe, expect, it } from 'vitest';
import {
  resolveBotanicalBodyVfxEnabled,
  resolveBotanicalMesostructureVfxEnabled,
  resolveBotanicalPigmentVfxEnabled,
  resolvePlantCanopyMassVfxEnabled,
  resolvePlantCanopyTissueVfxEnabled,
  resolvePlantCanopyInterlockVfxEnabled,
  resolvePlantLaminaVfxEnabled,
  resolvePlantLobeDepthVfxEnabled,
  resolveWoodBarkReliefVfxEnabled,
  resolveWoodTanninVfxEnabled,
  resolveCarbonDioxideBodyVfxEnabled,
  resolveFogCoreDiffuseVfxEnabled,
  resolveCeramicGlazeVfxEnabled,
  DEFAULT_RENDER_LOOK, resolveGasBodyVfxEnabled, resolveGasCoreDepthVfxEnabled,
  resolveGasLightVfxEnabled,
  resolveGlassBodyVfxEnabled,
  resolveGasMotionVfxEnabled,
  resolveLiquidBodyVfxEnabled, resolveLiquidSolidMeniscusVfxEnabled,
  resolveLiquidSurfaceVfxEnabled,
  resolveNobleGasBillowVfxEnabled, resolveNobleGasPrismVfxEnabled,
  resolveHydrogenBodyVfxEnabled,
  resolveSmokeBillowDepthVfxEnabled,
  resolveSmokeSoftnessVfxEnabled,
  resolveAcidBodyVfxEnabled,
  resolveSoapBodyVfxEnabled,
  resolveDeutBodyVfxEnabled,
  resolveIszsCrystallineVfxEnabled,
  resolveRadioactiveSolidBodyVfxEnabled,
  resolveVibrMacroReliefVfxEnabled,
  resolveOilBodyVfxEnabled,
  resolveOilVolumeFinishVfxEnabled,
  resolveOrganicSubsurfaceVfxEnabled,
  resolvePlasmaCoreVfxEnabled,
  resolvePlatinumBodyVfxEnabled,
  resolveRockMesostructureVfxEnabled,
  resolveRockRoughnessVfxEnabled,
  resolveMetalWaterContactVfxEnabled,
  resolveWaterMetalTransmissionVfxEnabled,
  resolveSolidBodyVfxEnabled,
  resolvePowderBodyVfxEnabled, resolvePowderLightVfxEnabled,
  resolveSootyPowderBodyVfxEnabled,
  resolveBglaBodyVfxEnabled,
  resolveC4BodyVfxEnabled,
  resolveSnowpackBodyVfxEnabled,
  resolveQuartzMesostructureVfxEnabled,
  resolveThermiteBodyVfxEnabled,
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

  it('keeps exact Noble Gas billows subordinate to the stable gas body', () => {
    expect(resolveNobleGasBillowVfxEnabled(
      'classic', '?nobleGasBillowVfx=1',
    )).toBe(false);
    expect(resolveNobleGasBillowVfxEnabled('realistic', '')).toBe(true);
    expect(resolveNobleGasBillowVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveNobleGasBillowVfxEnabled('realistic', '?volumeVfx=0')).toBe(false);
    expect(resolveNobleGasBillowVfxEnabled(
      'realistic', '?volumeVfx=0&gasBodyVfx=1&nobleGasBillowVfx=true',
    )).toBe(true);
    expect(resolveNobleGasBillowVfxEnabled(
      'realistic', '?gasBodyVfx=0&nobleGasBillowVfx=1',
    )).toBe(false);
    expect(resolveNobleGasBillowVfxEnabled(
      'neon-lab', '?gasBodyVfx=on&nobleGasBillowVfx=off',
    )).toBe(false);
  });

  it('keeps Noble Gas prismatic depth subordinate to E25', () => {
    expect(resolveNobleGasPrismVfxEnabled(
      'classic', '?nobleGasPrismVfx=1',
    )).toBe(false);
    expect(resolveNobleGasPrismVfxEnabled('realistic', '')).toBe(true);
    expect(resolveNobleGasPrismVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveNobleGasPrismVfxEnabled(
      'realistic', '?volumeVfx=0&gasBodyVfx=1&nobleGasBillowVfx=1&nobleGasPrismVfx=on',
    )).toBe(true);
    expect(resolveNobleGasPrismVfxEnabled(
      'realistic', '?gasBodyVfx=0&nobleGasBillowVfx=1&nobleGasPrismVfx=1',
    )).toBe(false);
    expect(resolveNobleGasPrismVfxEnabled(
      'realistic', '?nobleGasBillowVfx=0&nobleGasPrismVfx=1',
    )).toBe(false);
    expect(resolveNobleGasPrismVfxEnabled(
      'realistic', '?nobleGasPrismVfx=false',
    )).toBe(false);
  });

  it('keeps exact Smoke soft volume subordinate to the stable gas body', () => {
    expect(resolveSmokeSoftnessVfxEnabled(
      'classic', '?smokeSoftnessVfx=1',
    )).toBe(false);
    expect(resolveSmokeSoftnessVfxEnabled('realistic', '')).toBe(true);
    expect(resolveSmokeSoftnessVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveSmokeSoftnessVfxEnabled('realistic', '?volumeVfx=0')).toBe(false);
    expect(resolveSmokeSoftnessVfxEnabled(
      'realistic', '?volumeVfx=0&gasBodyVfx=1&smokeSoftnessVfx=true',
    )).toBe(true);
    expect(resolveSmokeSoftnessVfxEnabled(
      'realistic', '?gasBodyVfx=0&smokeSoftnessVfx=1',
    )).toBe(false);
    expect(resolveSmokeSoftnessVfxEnabled(
      'neon-lab', '?gasBodyVfx=on&smokeSoftnessVfx=off',
    )).toBe(false);
  });

  it('keeps exact Smoke billow depth subordinate to the E27 soft-volume parent', () => {
    expect(resolveSmokeBillowDepthVfxEnabled(
      'classic', '?smokeSoftnessVfx=1&smokeBillowDepthVfx=1',
    )).toBe(false);
    expect(resolveSmokeBillowDepthVfxEnabled('realistic', '')).toBe(true);
    expect(resolveSmokeBillowDepthVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveSmokeBillowDepthVfxEnabled(
      'realistic', '?gasBodyVfx=0&smokeSoftnessVfx=1&smokeBillowDepthVfx=1',
    )).toBe(false);
    expect(resolveSmokeBillowDepthVfxEnabled(
      'realistic', '?smokeSoftnessVfx=0&smokeBillowDepthVfx=1',
    )).toBe(false);
    expect(resolveSmokeBillowDepthVfxEnabled(
      'realistic', '?volumeVfx=0&gasBodyVfx=1&smokeSoftnessVfx=1&smokeBillowDepthVfx=on',
    )).toBe(true);
    expect(resolveSmokeBillowDepthVfxEnabled(
      'neon-lab', '?smokeBillowDepthVfx=off',
    )).toBe(false);
    expect(resolveSmokeBillowDepthVfxEnabled(
      'realistic', '?smokeBillowDepthVfx=false',
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

  it('keeps Metal/Water contact VFX subordinate to both solid-body and meniscus parents', () => {
    expect(resolveMetalWaterContactVfxEnabled(
      'classic', '?metalWaterContactVfx=on',
    )).toBe(false);
    expect(resolveMetalWaterContactVfxEnabled('realistic', '')).toBe(true);
    expect(resolveMetalWaterContactVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveMetalWaterContactVfxEnabled(
      'realistic', '?solidBodyVfx=0&metalWaterContactVfx=on',
    )).toBe(false);
    expect(resolveMetalWaterContactVfxEnabled(
      'realistic', '?liquidSolidMeniscusVfx=0&metalWaterContactVfx=on',
    )).toBe(false);
    expect(resolveMetalWaterContactVfxEnabled(
      'realistic', '?liquidBodyVfx=0&metalWaterContactVfx=on',
    )).toBe(false);
    expect(resolveMetalWaterContactVfxEnabled(
      'realistic',
      '?volumeVfx=0&solidBodyVfx=on&liquidBodyVfx=on&liquidSolidMeniscusVfx=on&metalWaterContactVfx=true',
    )).toBe(true);
    expect(resolveMetalWaterContactVfxEnabled(
      'neon-lab', '?metalWaterContactVfx=false',
    )).toBe(false);
  });

  it('keeps Water/Metal transmission subordinate to E37 and frozen in input audits', () => {
    expect(resolveWaterMetalTransmissionVfxEnabled(
      'classic', '?waterMetalTransmissionVfx=on',
    )).toBe(false);
    expect(resolveWaterMetalTransmissionVfxEnabled('realistic', '')).toBe(true);
    expect(resolveWaterMetalTransmissionVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveWaterMetalTransmissionVfxEnabled(
      'realistic', '?inputAudit=1',
    )).toBe(false);
    expect(resolveWaterMetalTransmissionVfxEnabled(
      'realistic', '?inputAudit=1&waterMetalTransmissionVfx=true',
    )).toBe(true);
    expect(resolveWaterMetalTransmissionVfxEnabled(
      'realistic', '?metalWaterContactVfx=0&waterMetalTransmissionVfx=on',
    )).toBe(false);
    expect(resolveWaterMetalTransmissionVfxEnabled(
      'realistic', '?solidBodyVfx=0&metalWaterContactVfx=on&waterMetalTransmissionVfx=on',
    )).toBe(false);
    expect(resolveWaterMetalTransmissionVfxEnabled(
      'realistic', '?liquidSolidMeniscusVfx=0&metalWaterContactVfx=on&waterMetalTransmissionVfx=on',
    )).toBe(false);
    expect(resolveWaterMetalTransmissionVfxEnabled(
      'realistic', '?volumeVfx=0&waterMetalTransmissionVfx=on',
    )).toBe(false);
    expect(resolveWaterMetalTransmissionVfxEnabled(
      'realistic', '?waterMetalTransmissionVfx=off',
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

  it('keeps ROCK mesostructure subordinate to the accepted E23 matte body', () => {
    expect(resolveRockMesostructureVfxEnabled(
      'classic', '?rockMesostructureVfx=1',
    )).toBe(false);
    expect(resolveRockMesostructureVfxEnabled('realistic', '')).toBe(true);
    expect(resolveRockMesostructureVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveRockMesostructureVfxEnabled(
      'realistic', '?solidBodyVfx=0&rockRoughnessVfx=1&rockMesostructureVfx=1',
    )).toBe(false);
    expect(resolveRockMesostructureVfxEnabled(
      'realistic', '?rockRoughnessVfx=0&rockMesostructureVfx=on',
    )).toBe(false);
    expect(resolveRockMesostructureVfxEnabled(
      'realistic', '?volumeVfx=0&solidBodyVfx=1&rockRoughnessVfx=1&rockMesostructureVfx=true',
    )).toBe(true);
    expect(resolveRockMesostructureVfxEnabled(
      'neon-lab', '?rockMesostructureVfx=false',
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

  it('keeps Wood/PLNT mesostructure subordinate to the exact E20 body', () => {
    expect(resolveBotanicalMesostructureVfxEnabled(
      'classic', '?botanicalMesostructureVfx=1',
    )).toBe(false);
    expect(resolveBotanicalMesostructureVfxEnabled('realistic', '')).toBe(true);
    expect(resolveBotanicalMesostructureVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveBotanicalMesostructureVfxEnabled(
      'realistic', '?volumeVfx=0&botanicalMesostructureVfx=1',
    )).toBe(false);
    expect(resolveBotanicalMesostructureVfxEnabled(
      'realistic', '?volumeVfx=0&botanicalBodyVfx=1&botanicalMesostructureVfx=on',
    )).toBe(true);
    expect(resolveBotanicalMesostructureVfxEnabled(
      'neon-lab', '?botanicalBodyVfx=0&botanicalMesostructureVfx=1',
    )).toBe(false);
    expect(resolveBotanicalMesostructureVfxEnabled(
      'realistic', '?botanicalBodyVfx=1&botanicalMesostructureVfx=off',
    )).toBe(false);
  });

  it('keeps Wood/PLNT pigment subordinate to the exact E26 mesostructure parent', () => {
    expect(resolveBotanicalPigmentVfxEnabled(
      'classic', '?botanicalPigmentVfx=1',
    )).toBe(false);
    expect(resolveBotanicalPigmentVfxEnabled('realistic', '')).toBe(true);
    expect(resolveBotanicalPigmentVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveBotanicalPigmentVfxEnabled(
      'realistic', '?volumeVfx=0&botanicalPigmentVfx=1',
    )).toBe(false);
    expect(resolveBotanicalPigmentVfxEnabled(
      'realistic', '?volumeVfx=0&botanicalBodyVfx=1&botanicalMesostructureVfx=1&botanicalPigmentVfx=on',
    )).toBe(true);
    expect(resolveBotanicalPigmentVfxEnabled(
      'neon-lab', '?botanicalBodyVfx=0&botanicalMesostructureVfx=1&botanicalPigmentVfx=1',
    )).toBe(false);
    expect(resolveBotanicalPigmentVfxEnabled(
      'realistic', '?botanicalMesostructureVfx=off&botanicalPigmentVfx=1',
    )).toBe(false);
    expect(resolveBotanicalPigmentVfxEnabled(
      'realistic', '?botanicalPigmentVfx=false',
    )).toBe(false);
  });

  it('keeps exact PLNT lamina relief subordinate to the E28 pigment parent', () => {
    expect(resolvePlantLaminaVfxEnabled(
      'classic', '?plantLaminaVfx=1',
    )).toBe(false);
    expect(resolvePlantLaminaVfxEnabled('realistic', '')).toBe(true);
    expect(resolvePlantLaminaVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolvePlantLaminaVfxEnabled(
      'realistic', '?botanicalBodyVfx=0&plantLaminaVfx=1',
    )).toBe(false);
    expect(resolvePlantLaminaVfxEnabled(
      'realistic', '?botanicalMesostructureVfx=0&plantLaminaVfx=on',
    )).toBe(false);
    expect(resolvePlantLaminaVfxEnabled(
      'realistic', '?botanicalPigmentVfx=0&plantLaminaVfx=true',
    )).toBe(false);
    expect(resolvePlantLaminaVfxEnabled(
      'realistic',
      '?volumeVfx=0&botanicalBodyVfx=1&botanicalMesostructureVfx=1&botanicalPigmentVfx=1&plantLaminaVfx=1',
    )).toBe(true);
    expect(resolvePlantLaminaVfxEnabled(
      'realistic', '?plantLaminaVfx=false',
    )).toBe(false);
  });

  it('keeps exact PLNT lobe depth subordinate to the E32 lamina parent', () => {
    expect(resolvePlantLobeDepthVfxEnabled(
      'classic', '?plantLobeDepthVfx=1',
    )).toBe(false);
    expect(resolvePlantLobeDepthVfxEnabled('realistic', '')).toBe(true);
    expect(resolvePlantLobeDepthVfxEnabled('neon-lab', '')).toBe(true);
    for (const parentOff of [
      'botanicalBodyVfx=0', 'botanicalMesostructureVfx=0',
      'botanicalPigmentVfx=0', 'plantLaminaVfx=0',
    ]) {
      expect(resolvePlantLobeDepthVfxEnabled(
        'realistic', `?${parentOff}&plantLobeDepthVfx=1`,
      )).toBe(false);
    }
    expect(resolvePlantLobeDepthVfxEnabled(
      'realistic',
      '?volumeVfx=0&botanicalBodyVfx=1&botanicalMesostructureVfx=1&botanicalPigmentVfx=1&plantLaminaVfx=1&plantLobeDepthVfx=on',
    )).toBe(true);
    expect(resolvePlantLobeDepthVfxEnabled(
      'realistic', '?plantLobeDepthVfx=false',
    )).toBe(false);
  });

  it('keeps exact PLNT canopy mass subordinate to the E34 lobe-depth parent', () => {
    expect(resolvePlantCanopyMassVfxEnabled(
      'classic', '?plantCanopyMassVfx=1',
    )).toBe(false);
    expect(resolvePlantCanopyMassVfxEnabled('realistic', '')).toBe(true);
    expect(resolvePlantCanopyMassVfxEnabled('neon-lab', '')).toBe(true);
    for (const parentOff of [
      'botanicalBodyVfx=0', 'botanicalMesostructureVfx=0',
      'botanicalPigmentVfx=0', 'plantLaminaVfx=0', 'plantLobeDepthVfx=0',
    ]) {
      expect(resolvePlantCanopyMassVfxEnabled(
        'realistic', `?${parentOff}&plantCanopyMassVfx=1`,
      )).toBe(false);
    }
    expect(resolvePlantCanopyMassVfxEnabled(
      'realistic',
      '?volumeVfx=0&botanicalBodyVfx=1&botanicalMesostructureVfx=1&botanicalPigmentVfx=1&plantLaminaVfx=1&plantLobeDepthVfx=1&plantCanopyMassVfx=on',
    )).toBe(true);
    expect(resolvePlantCanopyMassVfxEnabled(
      'realistic', '?plantCanopyMassVfx=false',
    )).toBe(false);
  });

  it('keeps continuous PLNT canopy tissue subordinate to the E36 canopy-mass parent', () => {
    expect(resolvePlantCanopyTissueVfxEnabled(
      'classic', '?plantCanopyTissueVfx=1',
    )).toBe(false);
    expect(resolvePlantCanopyTissueVfxEnabled('realistic', '')).toBe(true);
    expect(resolvePlantCanopyTissueVfxEnabled('neon-lab', '')).toBe(true);
    for (const parentOff of [
      'botanicalBodyVfx=0', 'botanicalMesostructureVfx=0',
      'botanicalPigmentVfx=0', 'plantLaminaVfx=0', 'plantLobeDepthVfx=0',
      'plantCanopyMassVfx=0',
    ]) {
      expect(resolvePlantCanopyTissueVfxEnabled(
        'realistic', `?${parentOff}&plantCanopyTissueVfx=1`,
      )).toBe(false);
    }
    expect(resolvePlantCanopyTissueVfxEnabled(
      'realistic',
      '?volumeVfx=0&botanicalBodyVfx=1&botanicalMesostructureVfx=1&botanicalPigmentVfx=1&plantLaminaVfx=1&plantLobeDepthVfx=1&plantCanopyMassVfx=1',
    )).toBe(true);
    for (const requested of ['0', 'off', 'false']) {
      expect(resolvePlantCanopyTissueVfxEnabled(
        'realistic', `?plantCanopyTissueVfx=${requested}`,
      )).toBe(false);
    }
    for (const requested of ['1', 'on', 'true']) {
      expect(resolvePlantCanopyTissueVfxEnabled(
        'realistic', `?plantCanopyTissueVfx=${requested}`,
      )).toBe(true);
    }
  });

  it('keeps PLNT canopy interlock volume subordinate to E53 and isolated in input audits', () => {
    expect(resolvePlantCanopyInterlockVfxEnabled(
      'classic', '?plantCanopyInterlockVfx=on',
    )).toBe(false);
    expect(resolvePlantCanopyInterlockVfxEnabled('realistic', '')).toBe(true);
    expect(resolvePlantCanopyInterlockVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolvePlantCanopyInterlockVfxEnabled('realistic', '?inputAudit=1')).toBe(false);

    for (const requested of ['1', 'on', 'true']) {
      expect(resolvePlantCanopyInterlockVfxEnabled(
        'realistic', `?inputAudit=1&plantCanopyInterlockVfx=${requested}`,
      )).toBe(true);
    }
    for (const requested of ['0', 'off', 'false']) {
      expect(resolvePlantCanopyInterlockVfxEnabled(
        'realistic', `?plantCanopyInterlockVfx=${requested}`,
      )).toBe(false);
    }

    for (const parentOff of [
      'volumeVfx=0', 'botanicalBodyVfx=0', 'botanicalMesostructureVfx=0',
      'botanicalPigmentVfx=0', 'plantLaminaVfx=0', 'plantLobeDepthVfx=0',
      'plantCanopyMassVfx=0', 'plantCanopyTissueVfx=0',
    ]) {
      expect(resolvePlantCanopyInterlockVfxEnabled(
        'realistic', `?${parentOff}&plantCanopyInterlockVfx=on`,
      )).toBe(false);
    }
    expect(resolvePlantCanopyInterlockVfxEnabled(
      'realistic',
      '?volumeVfx=0&botanicalBodyVfx=1&botanicalMesostructureVfx=1&botanicalPigmentVfx=1&plantLaminaVfx=1&plantLobeDepthVfx=1&plantCanopyMassVfx=1&plantCanopyTissueVfx=1&plantCanopyInterlockVfx=on',
    )).toBe(true);
  });

  it('keeps exact-Wood bark relief subordinate to E26 but independent of E28 pigment', () => {
    expect(resolveWoodBarkReliefVfxEnabled(
      'classic', '?woodBarkReliefVfx=1',
    )).toBe(false);
    expect(resolveWoodBarkReliefVfxEnabled('realistic', '')).toBe(true);
    expect(resolveWoodBarkReliefVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveWoodBarkReliefVfxEnabled(
      'realistic', '?volumeVfx=0&woodBarkReliefVfx=1',
    )).toBe(false);
    expect(resolveWoodBarkReliefVfxEnabled(
      'realistic',
      '?volumeVfx=0&botanicalBodyVfx=1&botanicalMesostructureVfx=1&woodBarkReliefVfx=on',
    )).toBe(true);
    expect(resolveWoodBarkReliefVfxEnabled(
      'realistic', '?botanicalMesostructureVfx=off&woodBarkReliefVfx=1',
    )).toBe(false);
    expect(resolveWoodBarkReliefVfxEnabled(
      'realistic', '?botanicalPigmentVfx=off&woodBarkReliefVfx=1',
    )).toBe(true);
    expect(resolveWoodBarkReliefVfxEnabled(
      'realistic', '?woodBarkReliefVfx=false',
    )).toBe(false);
  });

  it('keeps exact-Wood tannin volume subordinate to both E28 pigment and E30 bark relief', () => {
    expect(resolveWoodTanninVfxEnabled(
      'classic', '?woodTanninVfx=1',
    )).toBe(false);
    expect(resolveWoodTanninVfxEnabled('realistic', '')).toBe(true);
    expect(resolveWoodTanninVfxEnabled('neon-lab', '')).toBe(true);
    for (const parentOff of [
      'botanicalBodyVfx=0', 'botanicalMesostructureVfx=0',
      'botanicalPigmentVfx=0', 'woodBarkReliefVfx=0',
    ]) {
      expect(resolveWoodTanninVfxEnabled(
        'realistic', `?${parentOff}&woodTanninVfx=1`,
      )).toBe(false);
    }
    expect(resolveWoodTanninVfxEnabled(
      'realistic',
      '?volumeVfx=0&botanicalBodyVfx=1&botanicalMesostructureVfx=1&botanicalPigmentVfx=1&woodBarkReliefVfx=1&woodTanninVfx=on',
    )).toBe(true);
    expect(resolveWoodTanninVfxEnabled(
      'realistic', '?woodTanninVfx=false',
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

  it('keeps the exact Oil volume finish subordinate to Oil-body recomposition', () => {
    expect(resolveOilVolumeFinishVfxEnabled('classic', '?oilVolumeFinishVfx=on')).toBe(false);
    expect(resolveOilVolumeFinishVfxEnabled('classic', '?oilVolumeFinishVfx=true')).toBe(false);
    expect(resolveOilVolumeFinishVfxEnabled('realistic', '')).toBe(true);
    expect(resolveOilVolumeFinishVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveOilVolumeFinishVfxEnabled('realistic', '?volumeVfx=0')).toBe(false);
    expect(resolveOilVolumeFinishVfxEnabled(
      'realistic', '?volumeVfx=0&liquidBodyVfx=1&oilBodyVfx=on&oilVolumeFinishVfx=true',
    )).toBe(true);
    expect(resolveOilVolumeFinishVfxEnabled(
      'realistic', '?liquidBodyVfx=0&oilBodyVfx=1&oilVolumeFinishVfx=on',
    )).toBe(false);
    expect(resolveOilVolumeFinishVfxEnabled(
      'neon-lab', '?oilBodyVfx=off&oilVolumeFinishVfx=on',
    )).toBe(false);
    expect(resolveOilVolumeFinishVfxEnabled(
      'realistic', '?oilBodyVfx=0&oilVolumeFinishVfx=1',
    )).toBe(false);
    expect(resolveOilVolumeFinishVfxEnabled(
      'realistic', '?oilVolumeFinishVfx=1',
    )).toBe(true);
    expect(resolveOilVolumeFinishVfxEnabled(
      'realistic', '?oilVolumeFinishVfx=on',
    )).toBe(true);
    expect(resolveOilVolumeFinishVfxEnabled(
      'realistic', '?oilVolumeFinishVfx=true',
    )).toBe(true);
    expect(resolveOilVolumeFinishVfxEnabled(
      'realistic', '?oilVolumeFinishVfx=0',
    )).toBe(false);
    expect(resolveOilVolumeFinishVfxEnabled(
      'realistic', '?oilVolumeFinishVfx=off',
    )).toBe(false);
    expect(resolveOilVolumeFinishVfxEnabled(
      'realistic', '?oilVolumeFinishVfx=false',
    )).toBe(false);
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

  it('keeps exact Acid recomposition independently measurable but subordinate to the liquid-body baseline', () => {
    expect(resolveAcidBodyVfxEnabled('classic', '?acidBodyVfx=on')).toBe(false);
    expect(resolveAcidBodyVfxEnabled('classic', '?acidBodyVfx=true')).toBe(false);
    expect(resolveAcidBodyVfxEnabled('realistic', '')).toBe(true);
    expect(resolveAcidBodyVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveAcidBodyVfxEnabled('realistic', '?volumeVfx=0')).toBe(false);
    expect(resolveAcidBodyVfxEnabled(
      'realistic', '?volumeVfx=0&liquidBodyVfx=1&acidBodyVfx=true',
    )).toBe(true);
    expect(resolveAcidBodyVfxEnabled(
      'realistic', '?liquidBodyVfx=0&acidBodyVfx=1',
    )).toBe(false);
    expect(resolveAcidBodyVfxEnabled(
      'neon-lab', '?liquidBodyVfx=off&acidBodyVfx=on',
    )).toBe(false);
    expect(resolveAcidBodyVfxEnabled('realistic', '?acidBodyVfx=1')).toBe(true);
    expect(resolveAcidBodyVfxEnabled('realistic', '?acidBodyVfx=on')).toBe(true);
    expect(resolveAcidBodyVfxEnabled('realistic', '?acidBodyVfx=true')).toBe(true);
    expect(resolveAcidBodyVfxEnabled('realistic', '?acidBodyVfx=0')).toBe(false);
    expect(resolveAcidBodyVfxEnabled('realistic', '?acidBodyVfx=off')).toBe(false);
    expect(resolveAcidBodyVfxEnabled('realistic', '?acidBodyVfx=false')).toBe(false);
  });

  it('keeps exact Soap body optics subordinate to E03 and isolated from older input audits', () => {
    expect(resolveSoapBodyVfxEnabled('classic', '?soapBodyVfx=on')).toBe(false);
    expect(resolveSoapBodyVfxEnabled('realistic', '')).toBe(true);
    expect(resolveSoapBodyVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveSoapBodyVfxEnabled('realistic', '?inputAudit=1')).toBe(false);
    expect(resolveSoapBodyVfxEnabled(
      'realistic', '?inputAudit=1&soapBodyVfx=true',
    )).toBe(true);
    expect(resolveSoapBodyVfxEnabled('realistic', '?soapBodyVfx=off')).toBe(false);
    expect(resolveSoapBodyVfxEnabled('realistic', '?soapBodyVfx=0')).toBe(false);
    expect(resolveSoapBodyVfxEnabled('realistic', '?soapBodyVfx=false')).toBe(false);
    expect(resolveSoapBodyVfxEnabled('realistic', '?soapBodyVfx=on')).toBe(true);
    expect(resolveSoapBodyVfxEnabled(
      'realistic', '?liquidBodyVfx=0&soapBodyVfx=on',
    )).toBe(false);
    expect(resolveSoapBodyVfxEnabled(
      'realistic', '?volumeVfx=0&liquidBodyVfx=1&soapBodyVfx=1',
    )).toBe(true);
  });

  it('keeps exact Hydrogen body optics subordinate to E04 and isolated from older input audits', () => {
    expect(resolveHydrogenBodyVfxEnabled('classic', '?hydrogenBodyVfx=on')).toBe(false);
    expect(resolveHydrogenBodyVfxEnabled('realistic', '')).toBe(true);
    expect(resolveHydrogenBodyVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveHydrogenBodyVfxEnabled('realistic', '?inputAudit=1')).toBe(false);
    expect(resolveHydrogenBodyVfxEnabled(
      'realistic', '?inputAudit=1&hydrogenBodyVfx=true',
    )).toBe(true);
    expect(resolveHydrogenBodyVfxEnabled(
      'realistic', '?hydrogenBodyVfx=off',
    )).toBe(false);
    expect(resolveHydrogenBodyVfxEnabled(
      'realistic', '?hydrogenBodyVfx=0',
    )).toBe(false);
    expect(resolveHydrogenBodyVfxEnabled(
      'realistic', '?hydrogenBodyVfx=false',
    )).toBe(false);
    expect(resolveHydrogenBodyVfxEnabled(
      'realistic', '?hydrogenBodyVfx=on',
    )).toBe(true);
    expect(resolveHydrogenBodyVfxEnabled(
      'realistic', '?gasBodyVfx=0&hydrogenBodyVfx=on',
    )).toBe(false);
    expect(resolveHydrogenBodyVfxEnabled(
      'realistic', '?volumeVfx=0&gasBodyVfx=on&hydrogenBodyVfx=1',
    )).toBe(true);
  });

  it('keeps exact Carbon Dioxide body optics subordinate to E04 and isolated from older input audits', () => {
    expect(resolveCarbonDioxideBodyVfxEnabled(
      'classic', '?carbonDioxideBodyVfx=on',
    )).toBe(false);
    expect(resolveCarbonDioxideBodyVfxEnabled('realistic', '')).toBe(true);
    expect(resolveCarbonDioxideBodyVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveCarbonDioxideBodyVfxEnabled('realistic', '?inputAudit=1')).toBe(false);
    expect(resolveCarbonDioxideBodyVfxEnabled(
      'realistic', '?inputAudit=1&carbonDioxideBodyVfx=true',
    )).toBe(true);
    expect(resolveCarbonDioxideBodyVfxEnabled(
      'realistic', '?carbonDioxideBodyVfx=off',
    )).toBe(false);
    expect(resolveCarbonDioxideBodyVfxEnabled(
      'realistic', '?carbonDioxideBodyVfx=0',
    )).toBe(false);
    expect(resolveCarbonDioxideBodyVfxEnabled(
      'realistic', '?carbonDioxideBodyVfx=false',
    )).toBe(false);
    expect(resolveCarbonDioxideBodyVfxEnabled(
      'realistic', '?carbonDioxideBodyVfx=on',
    )).toBe(true);
    expect(resolveCarbonDioxideBodyVfxEnabled(
      'realistic', '?gasBodyVfx=0&carbonDioxideBodyVfx=on',
    )).toBe(false);
    expect(resolveCarbonDioxideBodyVfxEnabled(
      'realistic', '?volumeVfx=0&gasBodyVfx=on&carbonDioxideBodyVfx=1',
    )).toBe(true);
  });

  it('keeps exact FOG core diffusion subordinate to E04 and isolated from older input audits', () => {
    expect(resolveFogCoreDiffuseVfxEnabled(
      'classic', '?fogCoreDiffuseVfx=on',
    )).toBe(false);
    expect(resolveFogCoreDiffuseVfxEnabled('realistic', '')).toBe(true);
    expect(resolveFogCoreDiffuseVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveFogCoreDiffuseVfxEnabled('realistic', '?inputAudit=1')).toBe(false);
    expect(resolveFogCoreDiffuseVfxEnabled(
      'realistic', '?inputAudit=1&fogCoreDiffuseVfx=true',
    )).toBe(true);
    expect(resolveFogCoreDiffuseVfxEnabled(
      'realistic', '?fogCoreDiffuseVfx=off',
    )).toBe(false);
    expect(resolveFogCoreDiffuseVfxEnabled(
      'realistic', '?fogCoreDiffuseVfx=0',
    )).toBe(false);
    expect(resolveFogCoreDiffuseVfxEnabled(
      'realistic', '?fogCoreDiffuseVfx=false',
    )).toBe(false);
    expect(resolveFogCoreDiffuseVfxEnabled(
      'realistic', '?fogCoreDiffuseVfx=on',
    )).toBe(true);
    expect(resolveFogCoreDiffuseVfxEnabled(
      'realistic', '?gasBodyVfx=0&fogCoreDiffuseVfx=on',
    )).toBe(false);
    expect(resolveFogCoreDiffuseVfxEnabled(
      'realistic', '?volumeVfx=0&gasBodyVfx=on&fogCoreDiffuseVfx=1',
    )).toBe(true);
  });

  it('keeps exact DEUT body optics separate from E03 but inside the broad volume experiment', () => {
    expect(resolveDeutBodyVfxEnabled('classic', '?deutBodyVfx=on')).toBe(false);
    expect(resolveDeutBodyVfxEnabled('realistic', '')).toBe(true);
    expect(resolveDeutBodyVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveDeutBodyVfxEnabled('realistic', '?inputAudit=1')).toBe(false);
    expect(resolveDeutBodyVfxEnabled(
      'realistic', '?inputAudit=1&deutBodyVfx=1',
    )).toBe(true);
    expect(resolveDeutBodyVfxEnabled(
      'realistic', '?volumeVfx=0&deutBodyVfx=1',
    )).toBe(true);
    expect(resolveDeutBodyVfxEnabled('realistic', '?volumeVfx=0')).toBe(false);
    expect(resolveDeutBodyVfxEnabled(
      'realistic', '?liquidBodyVfx=0&deutBodyVfx=1',
    )).toBe(true);
    expect(resolveDeutBodyVfxEnabled(
      'realistic', '?liquidBodyVfx=0&deutBodyVfx=on',
    )).toBe(true);
    expect(resolveDeutBodyVfxEnabled('realistic', '?deutBodyVfx=0')).toBe(false);
    expect(resolveDeutBodyVfxEnabled('realistic', '?deutBodyVfx=off')).toBe(false);
    expect(resolveDeutBodyVfxEnabled('realistic', '?deutBodyVfx=false')).toBe(false);
  });

  it('keeps exact radioactive solid body optics separate from the broad identity layer', () => {
    expect(resolveRadioactiveSolidBodyVfxEnabled(
      'classic', '?radioactiveSolidBodyVfx=on',
    )).toBe(false);
    expect(resolveRadioactiveSolidBodyVfxEnabled('realistic', '')).toBe(true);
    expect(resolveRadioactiveSolidBodyVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveRadioactiveSolidBodyVfxEnabled('realistic', '?inputAudit=1')).toBe(false);
    expect(resolveRadioactiveSolidBodyVfxEnabled(
      'realistic', '?inputAudit=1&radioactiveSolidBodyVfx=1',
    )).toBe(true);
    expect(resolveRadioactiveSolidBodyVfxEnabled(
      'realistic', '?solidBodyVfx=0&radioactiveSolidBodyVfx=on',
    )).toBe(false);
    expect(resolveRadioactiveSolidBodyVfxEnabled(
      'realistic', '?volumeVfx=0&radioactiveSolidBodyVfx=on',
    )).toBe(false);
    expect(resolveRadioactiveSolidBodyVfxEnabled(
      'realistic', '?volumeVfx=0&solidBodyVfx=on&radioactiveSolidBodyVfx=on',
    )).toBe(true);
    expect(resolveRadioactiveSolidBodyVfxEnabled('realistic', '?volumeVfx=0')).toBe(false);
    expect(resolveRadioactiveSolidBodyVfxEnabled(
      'realistic', '?radioactiveSolidBodyVfx=0',
    )).toBe(false);
    expect(resolveRadioactiveSolidBodyVfxEnabled(
      'realistic', '?radioactiveSolidBodyVfx=off',
    )).toBe(false);
    expect(resolveRadioactiveSolidBodyVfxEnabled(
      'realistic', '?radioactiveSolidBodyVfx=false',
    )).toBe(false);
  });

  it('keeps exact ISZS crystal optics subordinate to the E43 body proof', () => {
    expect(resolveIszsCrystallineVfxEnabled(
      'classic', '?iszsCrystallineVfx=on',
    )).toBe(false);
    expect(resolveIszsCrystallineVfxEnabled('realistic', '')).toBe(true);
    expect(resolveIszsCrystallineVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveIszsCrystallineVfxEnabled('realistic', '?inputAudit=1')).toBe(false);
    expect(resolveIszsCrystallineVfxEnabled(
      'realistic',
      '?inputAudit=1&solidBodyVfx=1&radioactiveSolidBodyVfx=1&iszsCrystallineVfx=1',
    )).toBe(true);
    expect(resolveIszsCrystallineVfxEnabled(
      'realistic', '?radioactiveSolidBodyVfx=0&iszsCrystallineVfx=on',
    )).toBe(false);
    expect(resolveIszsCrystallineVfxEnabled(
      'realistic', '?solidBodyVfx=0&radioactiveSolidBodyVfx=on&iszsCrystallineVfx=on',
    )).toBe(false);
    expect(resolveIszsCrystallineVfxEnabled(
      'realistic',
      '?volumeVfx=0&solidBodyVfx=on&radioactiveSolidBodyVfx=on&iszsCrystallineVfx=on',
    )).toBe(true);
    expect(resolveIszsCrystallineVfxEnabled(
      'realistic', '?iszsCrystallineVfx=0',
    )).toBe(false);
    expect(resolveIszsCrystallineVfxEnabled(
      'realistic', '?iszsCrystallineVfx=off',
    )).toBe(false);
    expect(resolveIszsCrystallineVfxEnabled(
      'realistic', '?iszsCrystallineVfx=false',
    )).toBe(false);
  });

  it('keeps exact VIBR macro relief subordinate to E43 and isolated in input audits', () => {
    expect(resolveVibrMacroReliefVfxEnabled(
      'classic', '?vibrMacroReliefVfx=on',
    )).toBe(false);
    expect(resolveVibrMacroReliefVfxEnabled('realistic', '')).toBe(true);
    expect(resolveVibrMacroReliefVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveVibrMacroReliefVfxEnabled('realistic', '?inputAudit=1')).toBe(false);

    for (const requested of ['1', 'on', 'true']) {
      expect(resolveVibrMacroReliefVfxEnabled(
        'realistic', `?inputAudit=1&solidBodyVfx=1&radioactiveSolidBodyVfx=1&vibrMacroReliefVfx=${requested}`,
      )).toBe(true);
    }
    for (const requested of ['0', 'off', 'false']) {
      expect(resolveVibrMacroReliefVfxEnabled(
        'realistic', `?vibrMacroReliefVfx=${requested}`,
      )).toBe(false);
    }

    for (const parentOff of [
      '?radioactiveSolidBodyVfx=0&vibrMacroReliefVfx=on',
      '?solidBodyVfx=0&radioactiveSolidBodyVfx=on&vibrMacroReliefVfx=on',
      '?volumeVfx=0&radioactiveSolidBodyVfx=on&vibrMacroReliefVfx=on',
    ]) {
      expect(resolveVibrMacroReliefVfxEnabled('realistic', parentOff)).toBe(false);
    }
    expect(resolveVibrMacroReliefVfxEnabled(
      'realistic', '?volumeVfx=0&solidBodyVfx=on&radioactiveSolidBodyVfx=on&vibrMacroReliefVfx=on',
    )).toBe(true);
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

  it('keeps exact sooty-powder recomposition subordinate to the E05 body', () => {
    expect(resolveSootyPowderBodyVfxEnabled(
      'classic', '?sootyPowderBodyVfx=on',
    )).toBe(false);
    expect(resolveSootyPowderBodyVfxEnabled('realistic', '')).toBe(true);
    expect(resolveSootyPowderBodyVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveSootyPowderBodyVfxEnabled(
      'realistic', '?powderBodyVfx=0&sootyPowderBodyVfx=1',
    )).toBe(false);
    expect(resolveSootyPowderBodyVfxEnabled(
      'realistic', '?volumeVfx=0&powderBodyVfx=1&sootyPowderBodyVfx=true',
    )).toBe(true);
    expect(resolveSootyPowderBodyVfxEnabled(
      'realistic', '?sootyPowderBodyVfx=0',
    )).toBe(false);
    expect(resolveSootyPowderBodyVfxEnabled(
      'realistic', '?sootyPowderBodyVfx=off',
    )).toBe(false);
    expect(resolveSootyPowderBodyVfxEnabled(
      'realistic', '?sootyPowderBodyVfx=false',
    )).toBe(false);
  });

  it('keeps exact Thermite body optics subordinate to E05 and isolated from older input audits', () => {
    expect(resolveThermiteBodyVfxEnabled(
      'classic', '?thermiteBodyVfx=on',
    )).toBe(false);
    expect(resolveThermiteBodyVfxEnabled('realistic', '')).toBe(true);
    expect(resolveThermiteBodyVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveThermiteBodyVfxEnabled('realistic', '?inputAudit=1')).toBe(false);
    expect(resolveThermiteBodyVfxEnabled(
      'realistic', '?inputAudit=1&thermiteBodyVfx=true',
    )).toBe(true);
    expect(resolveThermiteBodyVfxEnabled(
      'realistic', '?thermiteBodyVfx=off',
    )).toBe(false);
    expect(resolveThermiteBodyVfxEnabled(
      'realistic', '?thermiteBodyVfx=0',
    )).toBe(false);
    expect(resolveThermiteBodyVfxEnabled(
      'realistic', '?thermiteBodyVfx=false',
    )).toBe(false);
    expect(resolveThermiteBodyVfxEnabled(
      'realistic', '?thermiteBodyVfx=on',
    )).toBe(true);
    expect(resolveThermiteBodyVfxEnabled(
      'realistic', '?powderBodyVfx=0&thermiteBodyVfx=on',
    )).toBe(false);
    expect(resolveThermiteBodyVfxEnabled(
      'realistic', '?volumeVfx=0&powderBodyVfx=on&thermiteBodyVfx=1',
    )).toBe(true);
  });

  it('keeps exact Snow body optics subordinate to E05 and isolated from older input audits', () => {
    expect(resolveSnowpackBodyVfxEnabled(
      'classic', '?snowpackBodyVfx=on',
    )).toBe(false);
    expect(resolveSnowpackBodyVfxEnabled('realistic', '')).toBe(true);
    expect(resolveSnowpackBodyVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveSnowpackBodyVfxEnabled('realistic', '?inputAudit=1')).toBe(false);
    expect(resolveSnowpackBodyVfxEnabled(
      'realistic', '?inputAudit=1&snowpackBodyVfx=true',
    )).toBe(true);
    expect(resolveSnowpackBodyVfxEnabled(
      'realistic', '?snowpackBodyVfx=off',
    )).toBe(false);
    expect(resolveSnowpackBodyVfxEnabled(
      'realistic', '?snowpackBodyVfx=0',
    )).toBe(false);
    expect(resolveSnowpackBodyVfxEnabled(
      'realistic', '?snowpackBodyVfx=false',
    )).toBe(false);
    expect(resolveSnowpackBodyVfxEnabled(
      'realistic', '?snowpackBodyVfx=on',
    )).toBe(true);
    expect(resolveSnowpackBodyVfxEnabled(
      'realistic', '?powderBodyVfx=0&snowpackBodyVfx=on',
    )).toBe(false);
    expect(resolveSnowpackBodyVfxEnabled(
      'realistic', '?volumeVfx=0&powderBodyVfx=on&snowpackBodyVfx=1',
    )).toBe(true);
  });

  it('keeps exact powder-Quartz mesostructure subordinate to E05 and audit-isolated', () => {
    expect(resolveQuartzMesostructureVfxEnabled(
      'classic', '?quartzMesostructureVfx=on',
    )).toBe(false);
    expect(resolveQuartzMesostructureVfxEnabled('realistic', '')).toBe(true);
    expect(resolveQuartzMesostructureVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveQuartzMesostructureVfxEnabled('realistic', '?inputAudit=1')).toBe(false);
    expect(resolveQuartzMesostructureVfxEnabled(
      'realistic', '?inputAudit=1&quartzMesostructureVfx=true',
    )).toBe(true);
    expect(resolveQuartzMesostructureVfxEnabled(
      'realistic', '?quartzMesostructureVfx=off',
    )).toBe(false);
    expect(resolveQuartzMesostructureVfxEnabled(
      'realistic', '?quartzMesostructureVfx=0',
    )).toBe(false);
    expect(resolveQuartzMesostructureVfxEnabled(
      'realistic', '?quartzMesostructureVfx=false',
    )).toBe(false);
    expect(resolveQuartzMesostructureVfxEnabled(
      'realistic', '?quartzMesostructureVfx=on',
    )).toBe(true);
    expect(resolveQuartzMesostructureVfxEnabled(
      'realistic', '?powderBodyVfx=0&quartzMesostructureVfx=on',
    )).toBe(false);
    expect(resolveQuartzMesostructureVfxEnabled(
      'realistic', '?volumeVfx=0&powderBodyVfx=on&quartzMesostructureVfx=1',
    )).toBe(true);
  });

  it('keeps exact C4 body recomposition subordinate to E05 and audit-isolated', () => {
    expect(resolveC4BodyVfxEnabled('classic', '?c4BodyVfx=on')).toBe(false);
    expect(resolveC4BodyVfxEnabled('realistic', '')).toBe(true);
    expect(resolveC4BodyVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveC4BodyVfxEnabled('realistic', '?inputAudit=1')).toBe(false);
    expect(resolveC4BodyVfxEnabled(
      'realistic', '?inputAudit=1&c4BodyVfx=true',
    )).toBe(true);
    expect(resolveC4BodyVfxEnabled('realistic', '?c4BodyVfx=0')).toBe(false);
    expect(resolveC4BodyVfxEnabled('realistic', '?c4BodyVfx=off')).toBe(false);
    expect(resolveC4BodyVfxEnabled('realistic', '?c4BodyVfx=false')).toBe(false);
    expect(resolveC4BodyVfxEnabled('realistic', '?c4BodyVfx=1')).toBe(true);
    expect(resolveC4BodyVfxEnabled('realistic', '?c4BodyVfx=on')).toBe(true);
    expect(resolveC4BodyVfxEnabled('realistic', '?c4BodyVfx=true')).toBe(true);
    expect(resolveC4BodyVfxEnabled(
      'realistic', '?powderBodyVfx=0&c4BodyVfx=on',
    )).toBe(false);
    expect(resolveC4BodyVfxEnabled(
      'realistic', '?volumeVfx=0&powderBodyVfx=on&c4BodyVfx=1',
    )).toBe(true);
  });

  it('keeps exact BGLA body recomposition subordinate to E05 and audit-isolated', () => {
    expect(resolveBglaBodyVfxEnabled('classic', '?bglaBodyVfx=on')).toBe(false);
    expect(resolveBglaBodyVfxEnabled('realistic', '')).toBe(true);
    expect(resolveBglaBodyVfxEnabled('neon-lab', '')).toBe(true);
    expect(resolveBglaBodyVfxEnabled('realistic', '?inputAudit=1')).toBe(false);
    expect(resolveBglaBodyVfxEnabled(
      'realistic', '?inputAudit=1&bglaBodyVfx=true',
    )).toBe(true);
    expect(resolveBglaBodyVfxEnabled('realistic', '?bglaBodyVfx=0')).toBe(false);
    expect(resolveBglaBodyVfxEnabled('realistic', '?bglaBodyVfx=off')).toBe(false);
    expect(resolveBglaBodyVfxEnabled('realistic', '?bglaBodyVfx=false')).toBe(false);
    expect(resolveBglaBodyVfxEnabled('realistic', '?bglaBodyVfx=1')).toBe(true);
    expect(resolveBglaBodyVfxEnabled('realistic', '?bglaBodyVfx=on')).toBe(true);
    expect(resolveBglaBodyVfxEnabled('realistic', '?bglaBodyVfx=true')).toBe(true);
    expect(resolveBglaBodyVfxEnabled(
      'realistic', '?powderBodyVfx=0&bglaBodyVfx=on',
    )).toBe(false);
    expect(resolveBglaBodyVfxEnabled(
      'realistic', '?volumeVfx=0&powderBodyVfx=on&bglaBodyVfx=1',
    )).toBe(true);
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
