import type {
  AtmosphereSupportAudit, CanvasPresentationTiming, PresentationRefreshAudit, RendererBackendInfo,
  SuspensionSupportAudit,
} from '../renderer/field-renderer';
import type { WebGLPresentationTiming } from '../renderer/pixi-field-presenter';
import type { PowderRenderStyle } from '../renderer/powder-render-style';
import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import type { Point, ViewState } from '../renderer/view-transform';
import type { MaterialAtlasEntry } from './material-atlas-audit';
import type { CellularGraphicsAuditSnapshot } from './cellular-graphics-audit';
import type { SensorGraphicsAuditSnapshot } from './sensor-graphics-audit';
import type { UnusualPowderGraphicsAuditSnapshot } from './unusual-powder-graphics-audit';
import type { ExplosivePowderGraphicsAuditSnapshot } from './explosive-powder-graphics-audit';
import type { UnusualSolidGraphicsAuditSnapshot } from './unusual-solid-graphics-audit';
import type { StructuralRigidGraphicsAuditSnapshot } from './structural-rigid-graphics-audit';
import type { MechanismGraphicsAuditSnapshot } from './mechanism-graphics-audit';
import type { ElectronicsGraphicsAuditSnapshot } from './electronics-graphics-audit';
import type { FieldProfileGraphicsAuditSnapshot } from './field-profile-graphics-audit';
import type { EarthenPowderGraphicsAuditSnapshot } from './earthen-powder-graphics-audit';
import type { LiquidIdentityGraphicsAuditSnapshot } from './liquid-identity-graphics-audit';
import type { GasIdentityGraphicsAuditSnapshot } from './gas-identity-graphics-audit';
import type { EnergyRadioactiveGraphicsAuditSnapshot } from './energy-radioactive-graphics-audit';
import type { ElectricDischargeGraphicsAuditSnapshot } from './electric-discharge-graphics-audit';
import type { OrganicPlantGraphicsAuditSnapshot } from './organic-plant-graphics-audit';
import type { SpongeGraphicsAuditSnapshot } from './sponge-graphics-audit';
import type { VirusGraphicsAuditSnapshot } from './virus-graphics-audit';
import type { WaxGraphicsAuditSnapshot } from './wax-graphics-audit';
import type { CrystallineGraphicsAuditSnapshot } from './crystalline-graphics-audit';
import type { PasteResistGraphicsAuditSnapshot } from './paste-resist-graphics-audit';
import type { VibrStateGraphicsAuditSnapshot } from './vibr-state-graphics-audit';
import type { DeutStateGraphicsAuditSnapshot } from './deut-state-graphics-audit';
import type { SourceTargetGraphicsAuditSnapshot } from './source-target-graphics-audit';
import type { NativeSeedGrowthAuditSnapshot } from './native-seed-growth-audit';
import type { ForceActivityGraphicsAuditSnapshot } from './force-activity-graphics-audit';
import type { PoloStateGraphicsAuditSnapshot } from './polo-state-graphics-audit';
import type { SpngStateGraphicsAuditSnapshot } from './spng-state-graphics-audit';
import type { GelStateGraphicsAuditSnapshot } from './gel-state-graphics-audit';
import type { PqrtStateGraphicsAuditSnapshot } from './pqrt-state-graphics-audit';
import type { FiltStateGraphicsAuditSnapshot } from './filt-state-graphics-audit';
import type { LcryStateGraphicsAuditSnapshot } from './lcry-state-graphics-audit';
import type { PipeStateGraphicsAuditSnapshot } from './pipe-state-graphics-audit';
import type { SwchStateGraphicsAuditSnapshot } from './swch-state-graphics-audit';
import type { StorStateGraphicsAuditSnapshot } from './stor-state-graphics-audit';
import type { DlayStateGraphicsAuditSnapshot } from './dlay-state-graphics-audit';
import type { WifiStateGraphicsAuditSnapshot } from './wifi-state-graphics-audit';
import type { PowderMesostrataGraphicsAuditSnapshot } from './powder-mesostrata-graphics-audit';
import type { PowderSolidContactVfxAuditSnapshot } from './powder-solid-contact-vfx-audit';
import type { TranslucentEdgeVfxAuditSnapshot } from './translucent-edge-vfx-audit';
import type { OrganicSubsurfaceVfxAuditSnapshot } from './organic-subsurface-vfx-audit';
import type { GeologicalSolidGraphicsAuditSnapshot } from './geological-solid-graphics-audit';
import type {
  ThermalCatalyticRigidGraphicsAuditSnapshot,
} from './thermal-catalytic-rigid-graphics-audit';
import type { GooSolidGraphicsAuditSnapshot } from './goo-solid-graphics-audit';
import type { FrayForceGraphicsAuditSnapshot } from './fray-force-graphics-audit';
import type { GbmbForceGraphicsAuditSnapshot } from './gbmb-force-graphics-audit';
import type {
  DistilledDieselLiquidGraphicsAuditSnapshot,
} from './distilled-diesel-liquid-graphics-audit';
import type { LavaStateGraphicsAuditSnapshot } from './lava-state-graphics-audit';
import type {
  BotanicalLifecycleGraphicsAuditSnapshot,
} from './botanical-lifecycle-graphics-audit';
import type { SparkStateGraphicsAuditSnapshot } from './spark-state-graphics-audit';
import type { PhotonSpectrumGraphicsAuditSnapshot } from './photon-spectrum-graphics-audit';
import type { PowderLightVfxAuditSnapshot } from './powder-light-vfx-audit';
import type {
  GasMotionVfxAuditSnapshot, GasMotionVfxFixtureMode,
} from './gas-motion-vfx-audit';
import type { GasLightVfxAuditSnapshot } from './gas-light-vfx-audit';
import type { GasCoreDepthVfxAuditSnapshot } from './gas-core-depth-vfx-audit';
import type { NobleGasBillowVfxAuditSnapshot } from './noble-gas-billow-vfx-audit';
import type { PlasmaCoreVfxAuditSnapshot } from './plasma-core-vfx-audit';
import type { SolidBodyVfxAuditSnapshot } from './solid-body-vfx-audit';
import type { RockRoughnessVfxAuditSnapshot } from './rock-roughness-vfx-audit';
import type { CeramicGlazeVfxAuditSnapshot } from './ceramic-glaze-vfx-audit';
import type { BotanicalBodyVfxAuditSnapshot } from './botanical-body-vfx-audit';
import type { GlassBodyVfxAuditSnapshot } from './glass-body-vfx-audit';
import type { WaterBodyVfxAuditSnapshot } from './water-body-vfx-audit';
import type { OilBodyVfxAuditSnapshot } from './oil-body-vfx-audit';
import type { LiquidSolidMeniscusVfxAuditSnapshot } from './liquid-solid-meniscus-vfx-audit';
import type { WetSedimentVfxAuditSnapshot } from './wet-sediment-vfx-audit';
import type { MaterialShowcaseAuditSnapshot } from '../renderer/render-lab-scene';

export interface BrowserInputAuditApi {
  readonly version: 1;
  readonly width: number;
  readonly height: number;
  cell(x: number, y: number): number;
  renderedCell(x: number, y: number): number;
  presentationState(x: number, y: number): number;
  photonState(x: number, y: number): number;
  wall(x: number, y: number): number;
  temperature(x: number, y: number): number;
  velocity(x: number, y: number): readonly [number, number];
  renderedVelocity(x: number, y: number): readonly [number, number];
  atmosphereMotion(x: number, y: number): readonly [number, number, number];
  suspensionAt(x: number, y: number): readonly [number, number, number, number];
  sourceTarget(x: number, y: number): number;
  presentationAuxiliary(x: number, y: number): number;
  liquidFieldAlpha(x: number, y: number): number;
  /** Bilinear atmosphere density at a world-cell centre, in byte space. */
  atmosphereFieldAlpha(x: number, y: number): number;
  /** Bilinear shared-emission density at a world-cell centre, in byte space. */
  emissionFieldAlpha(x: number, y: number): number;
  /** App-owned production-showcase topology and media-sampling contract. */
  materialShowcaseFixture(): MaterialShowcaseAuditSnapshot;
  /** Queues one paused audit-only native/presentation-field refresh. */
  refreshPresentationFields(): void;
  geologicalSolidStylingEnabled(): boolean;
  thermalCatalyticRigidStylingEnabled(): boolean;
  roleMaterialStylingEnabled(): boolean;
  gooSolidStylingEnabled(): boolean;
  frayForceStylingEnabled(): boolean;
  gbmbForceStylingEnabled(): boolean;
  gasIdentityStyle(x: number, y: number): number;
  atmosphereSupportAudit(): AtmosphereSupportAudit | undefined;
  suspensionSupportAudit(): SuspensionSupportAudit | undefined;
  occupiedCells(): number;
  setGasFieldLighting(enabled: boolean): void;
  setGasVolumeChroma(enabled: boolean): void;
  setGasIdentityStyling(enabled: boolean): void;
  setEmissionVolumeChroma(enabled: boolean): void;
  setLiquidFieldLighting(enabled: boolean): void;
  /** WebGL-only Water surface shoulder; Canvas remains the semantic fallback. */
  setAqueousSurfaceReflection(enabled: boolean): void;
  setLiquidSilhouetteCohesion(enabled: boolean): void;
  setLiquidVolumeChroma(enabled: boolean): void;
  setLiquidOpticalDepth(enabled: boolean): void;
  setSolidOpticalDepth(enabled: boolean): void;
  setTranslucentFieldTransmission(enabled: boolean): void;
  setTranslucentBackdropRefraction(enabled: boolean): void;
  setSolidContactDepth(enabled: boolean): void;
  setTranslucentLensShell(enabled: boolean): void;
  setSolidCurvatureDepth(enabled: boolean): void;
  setSurfaceContourLighting(enabled: boolean): void;
  setSolidFieldLighting(enabled: boolean): void;
  setDenseBodyAmbientFill(enabled: boolean): void;
  setRoleMaterialStyling(enabled: boolean): void;
  setCellularMaterialStyling(enabled: boolean): void;
  setStructuralRigidStyling(enabled: boolean): void;
  setMechanismBodyStyling(enabled: boolean): void;
  setElectronicIdentityStyling(enabled: boolean): void;
  setFieldProfileIdentityStyling(enabled: boolean): void;
  setEarthenPowderStyling(enabled: boolean): void;
  setSensorMaterialStyling(enabled: boolean): void;
  setUnusualPowderStyling(enabled: boolean): void;
  setExplosivePowderStyling(enabled: boolean): void;
  setUnusualSolidStyling(enabled: boolean): void;
  setLiquidIdentityStyling(enabled: boolean): void;
  setPhaseContactLighting(enabled: boolean): void;
  setThermalMaterialStyling(enabled: boolean): void;
  setEnergyCoreRelief(enabled: boolean): void;
  setEnergyIdentityStyling(enabled: boolean): void;
  setVibrStateStyling(enabled: boolean): void;
  setDeutStateStyling(enabled: boolean): void;
  setSourceTargetStyling(enabled: boolean): void;
  setForceActivityStyling(enabled: boolean): void;
  setPoloStateStyling(enabled: boolean): void;
  setSpngStateStyling(enabled: boolean): void;
  setGelHydrationStyling(enabled: boolean): void;
  setFiltSpectrumStyling(enabled: boolean): void;
  setLcryStateStyling(enabled: boolean): void;
  setPipePresentationStyling(enabled: boolean): void;
  setSwchStateStyling(enabled: boolean): void;
  setStorStateStyling(enabled: boolean): void;
  setDlayStateStyling(enabled: boolean): void;
  setWifiStateStyling(enabled: boolean): void;
  setQuartzCrystalStateStyling(enabled: boolean): void;
  setLavaAncestryStyling(enabled: boolean): void;
  setMoltenBodyOptics(enabled: boolean): void;
  setBotanicalIdentityStyling(enabled: boolean): void;
  setBotanicalLifecycleStyling(enabled: boolean): void;
  setSparkStateStyling(enabled: boolean): void;
  setPowderBodyDepth(enabled: boolean): void;
  setPowderMesostrataStyling(enabled: boolean): void;
  setGeologicalSolidStyling(enabled: boolean): void;
  setThermalCatalyticRigidStyling(enabled: boolean): void;
  setGooSolidStyling(enabled: boolean): void;
  setFrayForceStyling(enabled: boolean): void;
  setGbmbForceStyling(enabled: boolean): void;
  setPowderRenderStyle(style: PowderRenderStyle): void;
  clear(): void;
  setRadius(radius: number): void;
  setMaterial(material: Material): void;
  resetView(): void;
  screenToWorld(clientX: number, clientY: number): Point;
  screenToCell(clientX: number, clientY: number): Point;
  worldToScreen(x: number, y: number): Point;
  viewState(): ViewState;
  backend(): RendererBackendInfo;
  prepareDenseSolidFixture(): void;
  prepareSolidOpticalDepthFixture(): void;
  prepareSolidFieldLightingFixture(): void;
  powderLightVfxFixture(): PowderLightVfxAuditSnapshot;
  preparePowderLightVfxFixture(): void;
  gasMotionVfxFixture(): GasMotionVfxAuditSnapshot;
  prepareGasMotionVfxFixture(mode: GasMotionVfxFixtureMode): void;
  gasLightVfxFixture(): GasLightVfxAuditSnapshot;
  prepareGasLightVfxFixture(): void;
  gasCoreDepthVfxFixture(): GasCoreDepthVfxAuditSnapshot;
  prepareGasCoreDepthVfxFixture(): void;
  nobleGasBillowVfxFixture(): NobleGasBillowVfxAuditSnapshot;
  prepareNobleGasBillowVfxFixture(): void;
  plasmaCoreVfxFixture(): PlasmaCoreVfxAuditSnapshot;
  preparePlasmaCoreVfxFixture(): void;
  solidBodyVfxFixture(): SolidBodyVfxAuditSnapshot;
  prepareSolidBodyVfxFixture(): void;
  rockRoughnessVfxFixture(): RockRoughnessVfxAuditSnapshot;
  prepareRockRoughnessVfxFixture(): void;
  ceramicGlazeVfxFixture(): CeramicGlazeVfxAuditSnapshot;
  prepareCeramicGlazeVfxFixture(): void;
  botanicalBodyVfxFixture(): BotanicalBodyVfxAuditSnapshot;
  prepareBotanicalBodyVfxFixture(): void;
  glassBodyVfxFixture(): GlassBodyVfxAuditSnapshot;
  prepareGlassBodyVfxFixture(): void;
  waterBodyVfxFixture(): WaterBodyVfxAuditSnapshot;
  prepareWaterBodyVfxFixture(): void;
  oilBodyVfxFixture(): OilBodyVfxAuditSnapshot;
  prepareOilBodyVfxFixture(): void;
  liquidSolidMeniscusVfxFixture(): LiquidSolidMeniscusVfxAuditSnapshot;
  prepareLiquidSolidMeniscusVfxFixture(): void;
  prepareContourStressFixture(): void;
  toggleDenseSolidProbe(): void;
  materialAtlas(): readonly MaterialAtlasEntry[];
  prepareMaterialAtlas(): void;
  cellularGraphicsAtlas(): CellularGraphicsAuditSnapshot;
  prepareCellularGraphicsFixture(): void;
  sensorGraphicsAtlas(): SensorGraphicsAuditSnapshot;
  prepareSensorGraphicsFixture(): void;
  unusualPowderGraphicsAtlas(): UnusualPowderGraphicsAuditSnapshot;
  prepareUnusualPowderGraphicsFixture(): void;
  explosivePowderGraphicsAtlas(): ExplosivePowderGraphicsAuditSnapshot;
  prepareExplosivePowderGraphicsFixture(): void;
  unusualSolidGraphicsAtlas(): UnusualSolidGraphicsAuditSnapshot;
  prepareUnusualSolidGraphicsFixture(): void;
  structuralRigidGraphicsAtlas(): StructuralRigidGraphicsAuditSnapshot;
  prepareStructuralRigidGraphicsFixture(): void;
  mechanismGraphicsAtlas(): MechanismGraphicsAuditSnapshot;
  prepareMechanismGraphicsFixture(): void;
  electronicsGraphicsAtlas(): ElectronicsGraphicsAuditSnapshot;
  prepareElectronicsGraphicsFixture(): void;
  fieldProfileGraphicsAtlas(): FieldProfileGraphicsAuditSnapshot;
  prepareFieldProfileGraphicsFixture(): void;
  earthenPowderGraphicsAtlas(): EarthenPowderGraphicsAuditSnapshot;
  prepareEarthenPowderGraphicsFixture(): void;
  liquidIdentityGraphicsAtlas(): LiquidIdentityGraphicsAuditSnapshot;
  prepareLiquidIdentityGraphicsFixture(): void;
  gasIdentityGraphicsAtlas(): GasIdentityGraphicsAuditSnapshot;
  prepareGasIdentityGraphicsFixture(): void;
  energyRadioactiveGraphicsAtlas(): EnergyRadioactiveGraphicsAuditSnapshot;
  prepareEnergyRadioactiveGraphicsFixture(): void;
  electricDischargeGraphicsAtlas(): ElectricDischargeGraphicsAuditSnapshot;
  prepareElectricDischargeGraphicsFixture(): void;
  organicPlantGraphicsAtlas(): OrganicPlantGraphicsAuditSnapshot;
  prepareOrganicPlantGraphicsFixture(): void;
  spongeGraphicsAtlas(): SpongeGraphicsAuditSnapshot;
  prepareSpongeGraphicsFixture(): void;
  virusGraphicsAtlas(): VirusGraphicsAuditSnapshot;
  prepareVirusGraphicsFixture(): void;
  waxGraphicsAtlas(): WaxGraphicsAuditSnapshot;
  prepareWaxGraphicsFixture(): void;
  crystallineGraphicsAtlas(): CrystallineGraphicsAuditSnapshot;
  prepareCrystallineGraphicsFixture(): void;
  pasteResistGraphicsAtlas(): PasteResistGraphicsAuditSnapshot;
  preparePasteResistGraphicsFixture(): void;
  vibrStateGraphicsAtlas(): VibrStateGraphicsAuditSnapshot;
  prepareVibrStateGraphicsFixture(): void;
  deutStateGraphicsAtlas(): DeutStateGraphicsAuditSnapshot;
  prepareDeutStateGraphicsFixture(): void;
  /** Changes only a retained native presentation-state word in a prepared DEUT card. */
  toggleRetainedPresentationProbe(): {
    readonly x: number;
    readonly y: number;
    readonly material: Material;
    readonly before: number;
    readonly after: number;
  };
  sourceTargetGraphicsAtlas(): SourceTargetGraphicsAuditSnapshot;
  prepareSourceTargetGraphicsFixture(): void;
  forceActivityGraphicsAtlas(): ForceActivityGraphicsAuditSnapshot;
  prepareForceActivityGraphicsFixture(): void;
  poloStateGraphicsAtlas(): PoloStateGraphicsAuditSnapshot;
  preparePoloStateGraphicsFixture(): void;
  spngStateGraphicsAtlas(): SpngStateGraphicsAuditSnapshot;
  prepareSpngStateGraphicsFixture(): void;
  gelStateGraphicsAtlas(): GelStateGraphicsAuditSnapshot;
  prepareGelStateGraphicsFixture(): void;
  pqrtStateGraphicsAtlas(): PqrtStateGraphicsAuditSnapshot;
  preparePqrtStateGraphicsFixture(): void;
  filtStateGraphicsAtlas(): FiltStateGraphicsAuditSnapshot;
  prepareFiltStateGraphicsFixture(): void;
  lcryStateGraphicsAtlas(): LcryStateGraphicsAuditSnapshot;
  prepareLcryStateGraphicsFixture(): void;
  pipeStateGraphicsAtlas(): PipeStateGraphicsAuditSnapshot;
  preparePipeStateGraphicsFixture(): void;
  swchStateGraphicsAtlas(): SwchStateGraphicsAuditSnapshot;
  prepareSwchStateGraphicsFixture(): void;
  storStateGraphicsAtlas(): StorStateGraphicsAuditSnapshot;
  prepareStorStateGraphicsFixture(): void;
  dlayStateGraphicsAtlas(): DlayStateGraphicsAuditSnapshot;
  prepareDlayStateGraphicsFixture(): void;
  wifiStateGraphicsAtlas(): WifiStateGraphicsAuditSnapshot;
  prepareWifiStateGraphicsFixture(): void;
  powderMesostrataGraphicsAtlas(): PowderMesostrataGraphicsAuditSnapshot;
  preparePowderMesostrataGraphicsFixture(): void;
  powderSolidContactVfxFixture(): PowderSolidContactVfxAuditSnapshot;
  preparePowderSolidContactVfxAudit(): void;
  translucentEdgeVfxFixture(): TranslucentEdgeVfxAuditSnapshot;
  prepareTranslucentEdgeVfxAudit(): void;
  organicSubsurfaceVfxFixture(): OrganicSubsurfaceVfxAuditSnapshot;
  prepareOrganicSubsurfaceVfxAudit(): void;
  wetSedimentVfxFixture(): WetSedimentVfxAuditSnapshot;
  prepareWetSedimentVfxAudit(): void;
  geologicalSolidGraphicsAtlas(): GeologicalSolidGraphicsAuditSnapshot;
  prepareGeologicalSolidGraphicsFixture(): void;
  thermalCatalyticRigidGraphicsAtlas(): ThermalCatalyticRigidGraphicsAuditSnapshot;
  prepareThermalCatalyticRigidGraphicsFixture(): void;
  gooSolidGraphicsAtlas(): GooSolidGraphicsAuditSnapshot;
  prepareGooSolidGraphicsFixture(): void;
  frayForceGraphicsAtlas(): FrayForceGraphicsAuditSnapshot;
  prepareFrayForceGraphicsFixture(): void;
  gbmbForceGraphicsAtlas(): GbmbForceGraphicsAuditSnapshot;
  prepareGbmbForceGraphicsFixture(): void;
  distilledDieselLiquidGraphicsAtlas(): DistilledDieselLiquidGraphicsAuditSnapshot;
  prepareDistilledDieselLiquidGraphicsFixture(): void;
  photonSpectrumGraphicsAtlas(): PhotonSpectrumGraphicsAuditSnapshot;
  preparePhotonSpectrumGraphicsFixture(): void;
  setPhotonSpectrumGraphicsVisible(visible: boolean): void;
  lavaStateGraphicsAtlas(): LavaStateGraphicsAuditSnapshot;
  prepareLavaStateGraphicsFixture(): void;
  botanicalLifecycleGraphicsAtlas(): BotanicalLifecycleGraphicsAuditSnapshot;
  prepareBotanicalLifecycleGraphicsFixture(): void;
  sparkStateGraphicsAtlas(): SparkStateGraphicsAuditSnapshot;
  prepareSparkStateGraphicsFixture(): void;
  nativeSeedGrowthSnapshot(): NativeSeedGrowthAuditSnapshot;
  prepareNativeSeedGrowthFixture(): void;
  canvasPresentationTiming(): CanvasPresentationTiming | undefined;
  presentationRefreshAudit(): PresentationRefreshAudit | undefined;
  requestWebGLPresentationTimingSample(): boolean;
  webGLPresentationTiming(): WebGLPresentationTiming | undefined;
  forceEightXRenderStall(): boolean;
  /** Audit-only outgoing-renderer teardown before an intentional Detail/page navigation. */
  disposeRendererForNavigation(): Promise<void>;
}

declare global {
  interface Window { __ANIFOR_INPUT_AUDIT__?: BrowserInputAuditApi }
}

export function browserInputAuditRequested(search = globalThis.location?.search ?? ''): boolean {
  return new URLSearchParams(search).get('inputAudit') === '1';
}

export function blankBrowserInputAuditRequested(search = globalThis.location?.search ?? ''): boolean {
  const parameters = new URLSearchParams(search);
  return parameters.get('inputAudit') === '1' && parameters.get('blankAudit') === '1';
}

/** Builds the full-grid steady-state Canvas workload used only by the browser audit. */
export function prepareDenseSolidAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Dense Canvas audit fixture requires the deterministic backend');
  }
  // DeterministicBackend.clear() marks every index dirty before this direct
  // fill, so the renderer observes the completed fixture on its next frame.
  simulation.clear();
  simulation.cells().fill(Material.Metal);
}

/** Dense exact-species columns plus protected fine-structure controls. */
export function prepareSolidOpticalDepthAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Solid optical-depth audit fixture requires the deterministic backend');
  }
  simulation.clear();
  const cells = simulation.cells();
  const rect = (x: number, y: number, width: number, height: number, material: Material): void => {
    for (let py = y; py < y + height; py++) cells.fill(
      material, py * simulation.width + x, py * simulation.width + x + width,
    );
  };
  const blocks = [
    [20, Material.Metal], [120, Material.Wood], [220, Material.Plant],
    [320, Material.DTEC], [420, Material.VIBR], [520, Material.Glass],
  ] as const;
  for (const [x, material] of blocks) rect(x, 32, 72, 260, material);
  // Exact holes and unlike contacts reset thickness rather than becoming dark
  // presentation seams. The bottom lines remain one-cell categorical controls.
  rect(46, 158, 20, 8, Material.Empty);
  rect(356, 130, 36, 64, Material.Metal);
  for (const [x, material] of blocks) rect(x, 326, 72, 1, material);
}

/** Thick material families beside isolated warm/cool sources and strict controls. */
export function prepareSolidFieldLightingAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Solid field-lighting audit fixture requires the deterministic backend');
  }
  simulation.clear();
  const cells = simulation.cells();
  const rect = (x: number, y: number, width: number, height: number, material: Material): void => {
    for (let py = y; py < y + height; py++) cells.fill(
      material, py * simulation.width + x, py * simulation.width + x + width,
    );
  };
  const bodyBlocks = [
    [32, Material.Metal, Material.Fire],
    [132, Material.Plant, Material.Fire],
    [232, Material.VIBR, Material.Fire],
    [332, Material.DTEC, Material.ELEC],
    [432, Material.Metal, Material.ELEC],
  ] as const;
  for (const [x, material, source] of bodyBlocks) {
    rect(x, 80, 60, 60, material);
    rect(x - 5, 80, 3, 60, source);
  }
  const controls = [
    [32, Material.Sand], [132, Material.Glass], [232, Material.CLNE],
  ] as const;
  for (const [x, material] of controls) {
    rect(x, 220, 60, 60, material);
    rect(x - 5, 220, 3, 60, Material.Fire);
  }
}

/**
 * Builds the production Canvas contour worst case used by the browser timer.
 * Every 32x32 chunk contains connected liquid while one-cell gaps keep the
 * analytic boundary path active instead of degenerating into a dense interior.
 */
export function prepareContourStressAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Canvas contour audit fixture requires the deterministic backend');
  }
  simulation.clear();
  const cells = simulation.cells();
  for (let y = 0; y < simulation.height; y++) for (let x = 0; x < simulation.width; x++) {
    if (x % 3 < 2 && y % 3 < 2) cells[y * simulation.width + x] = Material.Water;
  }
}

/** Changes one cell so a paused dense fixture presents another complete frame. */
export function toggleDenseSolidAuditProbe(simulation: SimulationBackend): void {
  const x = Math.floor(simulation.width / 2);
  const y = Math.floor(simulation.height / 2);
  const material = simulation.cells()[y * simulation.width + x] === Material.Metal
    ? Material.Glass
    : Material.Metal;
  simulation.paint(x, y, material, 0);
}
