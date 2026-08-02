import { MaterialRenderer } from '../renderer/field-renderer';
import {
  applyMaterialShowcaseScene, applyRenderLabScene, materialShowcaseRequested, renderLabRequested,
} from '../renderer/render-lab-scene';
import { applyWallLabScene, wallLabRequested } from '../renderer/wall-lab-scene';
import { ALL_MATERIALS, BROWSE_MATERIALS, Material } from '../shared/materials';
import { decodeSharedWorld } from '../shared/share-codec';
import { exportWorldFile, importWorldFile, MAX_WORLD_FILE_BYTES, worldFileName } from '../shared/world-file';
import type { SimulationBackend } from '../simulation';
import { mountControls } from '../ui/controls';
import { NativeSignEditor, NativeSignOverlay, hitTestNativeSign } from '../ui/native-signs';
import {
  buildToolCatalog, type LifeToolInfo, type SignToolInfo, type SimToolInfo,
  type SourceToolInfo, type WallToolInfo,
} from '../ui/tool-catalog';
import { WorldInputController } from '../ui/world-input';
import { drawToolPoint, drawToolSegment } from './tool-dispatch';
import {
  blankBrowserInputAuditRequested, browserInputAuditRequested,
  prepareContourStressAuditFixture, prepareDenseSolidAuditFixture,
  prepareSolidFieldLightingAuditFixture, prepareSolidOpticalDepthAuditFixture,
  toggleDenseSolidAuditProbe,
} from './browser-input-audit';
import { navigateToRenderScale } from './render-scale-navigation';
import {
  MATERIAL_ATLAS, materialAtlasAuditRequested, prepareMaterialAtlasAuditFixture,
} from './material-atlas-audit';
import {
  CELLULAR_GRAPHICS_AUDIT, prepareCellularGraphicsAuditFixture,
} from './cellular-graphics-audit';
import {
  SENSOR_GRAPHICS_AUDIT, prepareSensorGraphicsAuditFixture,
} from './sensor-graphics-audit';
import {
  UNUSUAL_POWDER_GRAPHICS_AUDIT, prepareUnusualPowderGraphicsAuditFixture,
} from './unusual-powder-graphics-audit';
import {
  EXPLOSIVE_POWDER_GRAPHICS_AUDIT, prepareExplosivePowderGraphicsAuditFixture,
} from './explosive-powder-graphics-audit';
import {
  UNUSUAL_SOLID_GRAPHICS_AUDIT, prepareUnusualSolidGraphicsAuditFixture,
} from './unusual-solid-graphics-audit';
import {
  STRUCTURAL_RIGID_GRAPHICS_AUDIT, prepareStructuralRigidGraphicsAuditFixture,
} from './structural-rigid-graphics-audit';
import {
  MECHANISM_GRAPHICS_AUDIT, prepareMechanismGraphicsAuditFixture,
} from './mechanism-graphics-audit';
import {
  ELECTRONICS_GRAPHICS_AUDIT, prepareElectronicsGraphicsAuditFixture,
} from './electronics-graphics-audit';
import {
  FIELD_PROFILE_GRAPHICS_AUDIT, prepareFieldProfileGraphicsAuditFixture,
} from './field-profile-graphics-audit';
import {
  EARTHEN_POWDER_GRAPHICS_AUDIT, prepareEarthenPowderGraphicsAuditFixture,
} from './earthen-powder-graphics-audit';
import {
  LIQUID_IDENTITY_GRAPHICS_AUDIT, prepareLiquidIdentityGraphicsAuditFixture,
} from './liquid-identity-graphics-audit';
import {
  GAS_IDENTITY_GRAPHICS_AUDIT, prepareGasIdentityGraphicsAuditFixture,
} from './gas-identity-graphics-audit';
import {
  ENERGY_RADIOACTIVE_GRAPHICS_AUDIT, prepareEnergyRadioactiveGraphicsAuditFixture,
} from './energy-radioactive-graphics-audit';
import {
  ELECTRIC_DISCHARGE_GRAPHICS_AUDIT, prepareElectricDischargeGraphicsAuditFixture,
} from './electric-discharge-graphics-audit';
import {
  ORGANIC_PLANT_GRAPHICS_AUDIT, prepareOrganicPlantGraphicsAuditFixture,
} from './organic-plant-graphics-audit';
import {
  SPONGE_GRAPHICS_AUDIT, prepareSpongeGraphicsAuditFixture,
} from './sponge-graphics-audit';
import {
  VIRUS_GRAPHICS_AUDIT, prepareVirusGraphicsAuditFixture,
} from './virus-graphics-audit';
import {
  WAX_GRAPHICS_AUDIT, prepareWaxGraphicsAuditFixture,
} from './wax-graphics-audit';
import {
  CRYSTALLINE_GRAPHICS_AUDIT, prepareCrystallineGraphicsAuditFixture,
} from './crystalline-graphics-audit';
import {
  PASTE_RESIST_GRAPHICS_AUDIT, preparePasteResistGraphicsAuditFixture,
} from './paste-resist-graphics-audit';
import {
  VIBR_STATE_GRAPHICS_AUDIT, prepareVibrStateGraphicsAuditFixture,
} from './vibr-state-graphics-audit';
import {
  DEUT_STATE_GRAPHICS_ATLAS, DEUT_STATE_GRAPHICS_AUDIT, prepareDeutStateGraphicsAuditFixture,
} from './deut-state-graphics-audit';
import {
  SOURCE_TARGET_GRAPHICS_AUDIT, SOURCE_TARGET_RECOVERY_PROBE,
  placeSourceTargetRecoveryProbe, prepareSourceTargetGraphicsAuditFixture,
} from './source-target-graphics-audit';
import {
  FORCE_ACTIVITY_GRAPHICS_AUDIT, prepareForceActivityGraphicsAuditFixture,
} from './force-activity-graphics-audit';
import {
  POLO_STATE_GRAPHICS_AUDIT, preparePoloStateGraphicsAuditFixture,
} from './polo-state-graphics-audit';
import {
  SPNG_STATE_GRAPHICS_AUDIT, prepareSpngStateGraphicsAuditFixture,
} from './spng-state-graphics-audit';
import {
  GEL_STATE_GRAPHICS_AUDIT, prepareGelStateGraphicsAuditFixture,
} from './gel-state-graphics-audit';
import {
  PQRT_STATE_GRAPHICS_AUDIT, preparePqrtStateGraphicsAuditFixture,
} from './pqrt-state-graphics-audit';
import {
  FILT_STATE_GRAPHICS_AUDIT, prepareFiltStateGraphicsAuditFixture,
} from './filt-state-graphics-audit';
import {
  LCRY_STATE_GRAPHICS_AUDIT, prepareLcryStateGraphicsAuditFixture,
} from './lcry-state-graphics-audit';
import {
  PIPE_STATE_GRAPHICS_AUDIT, preparePipeStateGraphicsAuditFixture,
} from './pipe-state-graphics-audit';
import {
  SWCH_STATE_GRAPHICS_AUDIT, prepareSwchStateGraphicsAuditFixture,
} from './swch-state-graphics-audit';
import {
  STOR_STATE_GRAPHICS_AUDIT, prepareStorStateGraphicsAuditFixture,
} from './stor-state-graphics-audit';
import {
  DLAY_STATE_GRAPHICS_AUDIT, prepareDlayStateGraphicsAuditFixture,
} from './dlay-state-graphics-audit';
import {
  WIFI_STATE_GRAPHICS_AUDIT, prepareWifiStateGraphicsAuditFixture,
} from './wifi-state-graphics-audit';
import {
  POWDER_MESOSTRATA_GRAPHICS_AUDIT, preparePowderMesostrataGraphicsAuditFixture,
} from './powder-mesostrata-graphics-audit';
import {
  GEOLOGICAL_SOLID_GRAPHICS_AUDIT, prepareGeologicalSolidGraphicsAuditFixture,
} from './geological-solid-graphics-audit';
import {
  THERMAL_CATALYTIC_RIGID_GRAPHICS_AUDIT,
  prepareThermalCatalyticRigidGraphicsAuditFixture,
} from './thermal-catalytic-rigid-graphics-audit';
import {
  GOO_SOLID_GRAPHICS_AUDIT, prepareGooSolidGraphicsAuditFixture,
} from './goo-solid-graphics-audit';
import {
  FRAY_FORCE_GRAPHICS_AUDIT, prepareFrayForceGraphicsAuditFixture,
} from './fray-force-graphics-audit';
import {
  DISTILLED_DIESEL_LIQUID_GRAPHICS_AUDIT,
  prepareDistilledDieselLiquidGraphicsAuditFixture,
} from './distilled-diesel-liquid-graphics-audit';
import {
  PHOTON_SPECTRUM_GRAPHICS_AUDIT, preparePhotonSpectrumGraphicsAuditFixture,
  setPhotonSpectrumGraphicsVisible,
} from './photon-spectrum-graphics-audit';
import {
  LAVA_STATE_GRAPHICS_AUDIT, prepareLavaStateGraphicsAuditFixture,
} from './lava-state-graphics-audit';
import {
  BOTANICAL_LIFECYCLE_GRAPHICS_AUDIT, prepareBotanicalLifecycleGraphicsAuditFixture,
} from './botanical-lifecycle-graphics-audit';
import {
  SPARK_STATE_GRAPHICS_AUDIT, prepareSparkStateGraphicsAuditFixture,
} from './spark-state-graphics-audit';
import {
  runNativeSeedGrowthAudit,
  type NativeSeedGrowthAuditSnapshot,
  type NativeSeedGrowthBackend,
} from './native-seed-growth-audit';

const AUTOSAVE_KEY = 'stillroom-world-v1';

export class Game {
  private readonly simulation: SimulationBackend;
  private readonly renderer: MaterialRenderer;
  private material = Material.Sand;
  private wallTool?: WallToolInfo;
  private simulationTool?: SimToolInfo;
  private sourceTool?: SourceToolInfo;
  private lifeTool?: LifeToolInfo;
  private signTool?: SignToolInfo;
  private signOverlay?: NativeSignOverlay;
  private signEditor?: NativeSignEditor;
  private radius = 7;
  private eraseMode = false;
  private paused = false;
  private accumulator = 0;
  private lastFrame = performance.now();
  private probeX = 0;
  private probeY = 0;
  private lastIndicatorUpdate = -Infinity;
  private indicator?: HTMLOutputElement;
  private nativeSeedGrowthAudit?: NativeSeedGrowthAuditSnapshot;

  constructor(private readonly root: HTMLElement, simulation: SimulationBackend) {
    this.simulation = simulation;
    const viewport = root.querySelector('.viewport') as HTMLElement;
    this.renderer = new MaterialRenderer(viewport, simulation);
    this.probeX = Math.floor(simulation.width / 2);
    this.probeY = Math.floor(simulation.height / 2);
  }

  async start(): Promise<void> {
    await this.renderer.init();
    const renderLab = renderLabRequested();
    const materialShowcase = materialShowcaseRequested();
    const wallLab = wallLabRequested();
    if (renderLab) {
      if (materialAtlasAuditRequested()) prepareMaterialAtlasAuditFixture(this.simulation);
      else if (blankBrowserInputAuditRequested()) this.simulation.clear();
      else applyRenderLabScene(this.simulation);
      this.paused = true;
      this.root.dataset.scene = 'render-lab';
    } else if (materialShowcase) {
      applyMaterialShowcaseScene(this.simulation);
      this.paused = true;
      this.root.dataset.scene = 'showcase';
    } else if (wallLab) {
      applyWallLabScene(this.simulation);
      this.paused = true;
      this.root.dataset.scene = 'wall-lab';
    } else {
      await this.restore();
    }
    const viewport = this.root.querySelector('.viewport') as HTMLElement;
    if (this.simulation.signs && this.simulation.upsertSign && this.simulation.removeSign) {
      this.signOverlay = new NativeSignOverlay(viewport, this.simulation, this.renderer);
      this.signEditor = new NativeSignEditor(this.simulation);
    }
    new WorldInputController(viewport, this.renderer, {
      draw: ({ x, y }, erase) => {
        erase ||= this.eraseMode;
        if (this.signTool) {
          this.handleSignPoint({ x, y }, erase);
          return;
        }
        // Native brush tools and configured/LIFE sources can update
        // temperature, velocity, or ctype while retaining their material ID.
        // Coalesce one semantic snapshot in a paused game; ordinary particle
        // and wall brushes remain covered by their narrow dirty-cell paths.
        const stateOnlyMutation = !erase && Boolean(
          this.sourceTool || this.lifeTool || this.simulationTool?.gesture === 'brush',
        );
        drawToolPoint(this.simulation, { x, y }, {
          material: this.material, wallTool: this.wallTool,
          simulationTool: this.simulationTool, sourceTool: this.sourceTool,
          lifeTool: this.lifeTool, signTool: this.signTool,
          radius: this.radius,
        }, erase);
        if (stateOnlyMutation) this.renderer.invalidateDynamicPresentation();
      },
      drawSegment: (start, end, erase) => {
        erase ||= this.eraseMode;
        const stateOnlyMutation = !erase && this.simulationTool?.gesture === 'vector';
        drawToolSegment(this.simulation, start, end, {
          material: this.material, wallTool: this.wallTool,
          simulationTool: this.simulationTool, sourceTool: this.sourceTool,
          lifeTool: this.lifeTool, signTool: this.signTool,
          radius: this.radius,
        }, erase);
        if (stateOnlyMutation) this.renderer.invalidateDynamicPresentation();
      },
    });
    this.mountFieldIndicator(viewport);
    const toolbox = this.root.querySelector<HTMLElement>('.toolbox');
    if (!toolbox) throw new Error('Missing simulation toolbox');
    mountControls(toolbox, {
      onMaterial: (material) => {
        this.material = material;
        this.wallTool = undefined;
        this.simulationTool = undefined;
        this.sourceTool = undefined;
        this.lifeTool = undefined;
        this.signTool = undefined;
      },
      // The control library keeps a configured source selected while an
      // element tile is being used as its target.  Only change the retained
      // target material here: source ownership is intentionally preserved so
      // the next stroke still crosses the native CtypeDraw boundary.
      onSourceTarget: (material) => { this.material = material; },
      onRadius: (radius) => { this.radius = radius; },
      onPause: () => {
        this.paused = !this.paused;
        this.renderer.setSimulationRunning(!this.paused);
      },
      onEraseMode: (erase) => { this.eraseMode = erase; },
      onPowderRenderStyle: (style) => { this.renderer.setPowderRenderStyle(style); },
      onRenderScale: (scale) => {
        navigateToRenderScale(scale, {
          currentUrl: location.href,
          diagnosticScene: renderLab || wallLab,
          persist: () => this.save(),
          assign: (href) => { location.assign(href); },
        });
      },
      canConfigureSource: (source, target) => this.simulation.canConfigureSource?.(source, target) ?? false,
      onSaveFile: () => this.downloadWorldFile(),
      onOpenFile: (file) => this.openWorldFile(file),
      onClear: () => {
        this.simulation.clear();
        this.renderer.invalidateDynamicPresentation();
        localStorage.removeItem(AUTOSAVE_KEY);
      },
      onTool: (tool) => {
        if (tool.kind === 'wall') {
          this.wallTool = tool;
          this.simulationTool = undefined;
          this.sourceTool = undefined;
          this.lifeTool = undefined;
          this.signTool = undefined;
        }
        else if (tool.kind === 'force' || tool.kind === 'thermal' || tool.kind === 'utility') {
          this.simulationTool = tool;
          this.wallTool = undefined;
          this.sourceTool = undefined;
          this.lifeTool = undefined;
          this.signTool = undefined;
        } else if (tool.kind === 'source') {
          this.sourceTool = tool;
          this.wallTool = undefined;
          this.simulationTool = undefined;
          this.lifeTool = undefined;
          this.signTool = undefined;
        } else if (tool.kind === 'life') {
          this.lifeTool = tool;
          this.wallTool = undefined;
          this.simulationTool = undefined;
          this.sourceTool = undefined;
          this.signTool = undefined;
        } else if (tool.kind === 'sign') {
          this.signTool = tool;
          this.wallTool = undefined;
          this.simulationTool = undefined;
          this.sourceTool = undefined;
          this.lifeTool = undefined;
        }
      },
    }, buildToolCatalog(BROWSE_MATERIALS, {
      walls: Boolean(this.simulation.paintWall && this.simulation.eraseWall),
      simulationTools: Boolean(this.simulation.applySimulationTool),
      configuredSources: Boolean(
        this.simulation.paintConfiguredSource && this.simulation.canConfigureSource
          && this.simulation.configuredSourceTargetAt,
      ),
      lifePresets: Boolean(this.simulation.paintLifePreset),
      signs: Boolean(this.simulation.signs && this.simulation.upsertSign && this.simulation.removeSign),
    }));
    if (renderLab || materialShowcase || wallLab) {
      const status = this.root.querySelector('.status');
      const sceneName = renderLab ? 'render lab' : materialShowcase ? 'material showcase' : 'native wall lab';
      if (status) status.textContent = `${this.simulation.name} · paused ${sceneName}`;
    } else {
      this.seedIfEmpty();
      window.setInterval(() => this.save(), 4000);
    }
    // The showcase is a deterministic paused scene too. Giving it the same
    // opt-in audit clock keeps production visual captures stable without
    // changing normal gameplay or the public showcase URL.
    if ((renderLab || materialShowcase) && browserInputAuditRequested()) this.installBrowserInputAudit();
    this.renderer.setSimulationRunning(!this.paused);
    requestAnimationFrame(this.frame);
  }

  private installBrowserInputAudit(): void {
    this.material = Material.Sand;
    this.wallTool = undefined;
    this.simulationTool = undefined;
    this.sourceTool = undefined;
    this.lifeTool = undefined;
    this.signTool = undefined;
    this.eraseMode = false;
    this.radius = 0;
    this.renderer.resetView();
    this.renderer.enableCanvasPresentationTiming();
    this.renderer.enablePresentationRefreshAudit();
    this.renderer.enableWebGLPresentationTiming();
    this.root.dataset.inputAudit = 'ready';
    window.__ANIFOR_INPUT_AUDIT__ = {
      version: 1,
      width: this.simulation.width,
      height: this.simulation.height,
      cell: (x, y) => {
        if (x < 0 || y < 0 || x >= this.simulation.width || y >= this.simulation.height) return -1;
        return this.simulation.cells()[y * this.simulation.width + x];
      },
      renderedCell: (x, y) => this.renderer.renderedMaterialAt(x, y),
      presentationState: (x, y) => {
        if (x < 0 || y < 0 || x >= this.simulation.width || y >= this.simulation.height) return -1;
        return this.simulation.presentationState?.()[y * this.simulation.width + x] ?? 0;
      },
      photonState: (x, y) => {
        if (x < 0 || y < 0 || x >= this.simulation.width || y >= this.simulation.height) return -1;
        return this.simulation.photonState?.()[y * this.simulation.width + x] ?? 0;
      },
      wall: (x, y) => {
        if (x < 0 || y < 0 || x >= this.simulation.width || y >= this.simulation.height) return -1;
        return this.simulation.walls?.()[y * this.simulation.width + x] ?? 0;
      },
      temperature: (x, y) => {
        if (x < 0 || y < 0 || x >= this.simulation.width || y >= this.simulation.height) return -1;
        return this.simulation.temperature?.()[y * this.simulation.width + x] ?? -1;
      },
      sourceTarget: (x, y) => this.simulation.configuredSourceTargetAt?.(x, y) ?? Material.Empty,
      presentationAuxiliary: (x, y) => this.renderer.presentationAuxiliaryAt(x, y),
      geologicalSolidStylingEnabled: () => this.renderer.geologicalSolidStylingIsEnabled(),
      thermalCatalyticRigidStylingEnabled: () => this.renderer.thermalCatalyticRigidStylingIsEnabled(),
      gooSolidStylingEnabled: () => this.renderer.gooSolidStylingIsEnabled(),
      frayForceStylingEnabled: () => this.renderer.frayForceStylingIsEnabled(),
      gasIdentityStyle: (x, y) => this.renderer.gasIdentityStyleAt(x, y),
      atmosphereSupportAudit: () => this.renderer.getAtmosphereSupportAudit(),
      occupiedCells: () => {
        let occupied = 0;
        for (const material of this.simulation.cells()) if (material !== Material.Empty) occupied++;
        return occupied;
      },
      setGasFieldLighting: (enabled) => { this.renderer.setGasFieldLightingEnabled(enabled); },
      setGasVolumeChroma: (enabled) => { this.renderer.setGasVolumeChromaEnabled(enabled); },
      setGasIdentityStyling: (enabled) => {
        this.renderer.setGasIdentityStylingEnabled(enabled);
      },
      setEmissionVolumeChroma: (enabled) => {
        this.renderer.setEmissionVolumeChromaEnabled(enabled);
      },
      setLiquidFieldLighting: (enabled) => { this.renderer.setLiquidFieldLightingEnabled(enabled); },
      setAqueousSurfaceReflection: (enabled) => {
        this.renderer.setAqueousSurfaceReflectionEnabled(enabled);
      },
      setLiquidSilhouetteCohesion: (enabled) => {
        this.renderer.setLiquidSilhouetteCohesionEnabled(enabled);
      },
      setLiquidVolumeChroma: (enabled) => {
        this.renderer.setLiquidVolumeChromaEnabled(enabled);
      },
      setLiquidOpticalDepth: (enabled) => {
        this.renderer.setLiquidOpticalDepthEnabled(enabled);
      },
      setSolidOpticalDepth: (enabled) => {
        this.renderer.setSolidOpticalDepthEnabled(enabled);
      },
      setTranslucentFieldTransmission: (enabled) => {
        this.renderer.setTranslucentFieldTransmissionEnabled(enabled);
      },
      setTranslucentBackdropRefraction: (enabled) => {
        this.renderer.setTranslucentBackdropRefractionEnabled(enabled);
      },
      setSolidContactDepth: (enabled) => {
        this.renderer.setSolidContactDepthEnabled(enabled);
      },
      setTranslucentLensShell: (enabled) => {
        this.renderer.setTranslucentLensShellEnabled(enabled);
      },
      setSolidCurvatureDepth: (enabled) => {
        this.renderer.setSolidCurvatureDepthEnabled(enabled);
      },
      setSurfaceContourLighting: (enabled) => {
        this.renderer.setSurfaceContourLightingEnabled(enabled);
      },
      setSolidFieldLighting: (enabled) => {
        this.renderer.setSolidFieldLightingEnabled(enabled);
      },
      setDenseBodyAmbientFill: (enabled) => {
        this.renderer.setDenseBodyAmbientFillEnabled(enabled);
      },
      setRoleMaterialStyling: (enabled) => {
        this.renderer.setRoleMaterialStylingEnabled(enabled);
      },
      setCellularMaterialStyling: (enabled) => {
        this.renderer.setCellularMaterialStylingEnabled(enabled);
      },
      setStructuralRigidStyling: (enabled) => {
        this.renderer.setStructuralRigidStylingEnabled(enabled);
      },
      setMechanismBodyStyling: (enabled) => {
        this.renderer.setMechanismBodyStylingEnabled(enabled);
      },
      setElectronicIdentityStyling: (enabled) => {
        this.renderer.setElectronicIdentityStylingEnabled(enabled);
      },
      setFieldProfileIdentityStyling: (enabled) => {
        this.renderer.setFieldProfileIdentityStylingEnabled(enabled);
      },
      setEarthenPowderStyling: (enabled) => {
        this.renderer.setEarthenPowderStylingEnabled(enabled);
      },
      setSensorMaterialStyling: (enabled) => {
        this.renderer.setSensorMaterialStylingEnabled(enabled);
      },
      setUnusualPowderStyling: (enabled) => {
        this.renderer.setUnusualPowderStylingEnabled(enabled);
      },
      setExplosivePowderStyling: (enabled) => {
        this.renderer.setExplosivePowderStylingEnabled(enabled);
      },
      setUnusualSolidStyling: (enabled) => {
        this.renderer.setUnusualSolidStylingEnabled(enabled);
      },
      setLiquidIdentityStyling: (enabled) => {
        this.renderer.setLiquidIdentityStylingEnabled(enabled);
      },
      setPhaseContactLighting: (enabled) => {
        this.renderer.setPhaseContactLightingEnabled(enabled);
      },
      setThermalMaterialStyling: (enabled) => {
        this.renderer.setThermalMaterialStylingEnabled(enabled);
      },
      setEnergyCoreRelief: (enabled) => {
        this.renderer.setEnergyCoreReliefEnabled(enabled);
      },
      setEnergyIdentityStyling: (enabled) => {
        this.renderer.setEnergyIdentityStylingEnabled(enabled);
      },
      setVibrStateStyling: (enabled) => {
        this.renderer.setVibrStateStylingEnabled(enabled);
      },
      setDeutStateStyling: (enabled) => {
        this.renderer.setDeutStateStylingEnabled(enabled);
      },
      setSourceTargetStyling: (enabled) => {
        this.renderer.setSourceTargetStylingEnabled(enabled);
      },
      setForceActivityStyling: (enabled) => {
        this.renderer.setForceActivityStylingEnabled(enabled);
      },
      setPoloStateStyling: (enabled) => {
        this.renderer.setPoloStateStylingEnabled(enabled);
      },
      setSpngStateStyling: (enabled) => {
        this.renderer.setSpngStateStylingEnabled(enabled);
      },
      setGelHydrationStyling: (enabled) => {
        this.renderer.setGelHydrationStylingEnabled(enabled);
      },
      setFiltSpectrumStyling: (enabled) => {
        this.renderer.setFiltSpectrumStylingEnabled(enabled);
      },
      setLcryStateStyling: (enabled) => {
        this.renderer.setLcryStateStylingEnabled(enabled);
      },
      setPipePresentationStyling: (enabled) => {
        this.renderer.setPipePresentationStylingEnabled(enabled);
      },
      setSwchStateStyling: (enabled) => {
        this.renderer.setSwchStateStylingEnabled(enabled);
      },
      setStorStateStyling: (enabled) => {
        this.renderer.setStorStateStylingEnabled(enabled);
      },
      setDlayStateStyling: (enabled) => {
        this.renderer.setDlayStateStylingEnabled(enabled);
      },
      setWifiStateStyling: (enabled) => {
        this.renderer.setWifiStateStylingEnabled(enabled);
      },
      setQuartzCrystalStateStyling: (enabled) => {
        this.renderer.setQuartzCrystalStateStylingEnabled(enabled);
      },
      setLavaAncestryStyling: (enabled) => {
        this.renderer.setLavaAncestryStylingEnabled(enabled);
      },
      setMoltenBodyOptics: (enabled) => {
        this.renderer.setMoltenBodyOpticsEnabled(enabled);
      },
      setBotanicalIdentityStyling: (enabled) => {
        this.renderer.setBotanicalIdentityStylingEnabled(enabled);
      },
      setBotanicalLifecycleStyling: (enabled) => {
        this.renderer.setBotanicalLifecycleStylingEnabled(enabled);
      },
      setSparkStateStyling: (enabled) => {
        this.renderer.setSparkStateStylingEnabled(enabled);
      },
      setPowderBodyDepth: (enabled) => {
        this.renderer.setPowderBodyDepthEnabled(enabled);
      },
      setPowderMesostrataStyling: (enabled) => {
        this.renderer.setPowderMesostrataStylingEnabled(enabled);
      },
      setGeologicalSolidStyling: (enabled) => {
        this.renderer.setGeologicalSolidStylingEnabled(enabled);
      },
      setThermalCatalyticRigidStyling: (enabled) => {
        this.renderer.setThermalCatalyticRigidStylingEnabled(enabled);
      },
      setGooSolidStyling: (enabled) => {
        this.renderer.setGooSolidStylingEnabled(enabled);
      },
      setFrayForceStyling: (enabled) => {
        this.renderer.setFrayForceStylingEnabled(enabled);
      },
      setPowderRenderStyle: (style) => {
        this.renderer.setPowderRenderStyle(style);
      },
      clear: () => {
        this.simulation.clear();
        this.renderer.invalidateDynamicPresentation();
      },
      setRadius: (radius) => { this.radius = Math.max(0, Math.min(64, Math.round(radius))); },
      setMaterial: (material) => {
        if (!ALL_MATERIALS.some(({ id }) => id === material)) throw new Error(`Unknown audit material ${material}`);
        this.material = material;
        this.wallTool = undefined;
        this.simulationTool = undefined;
        this.sourceTool = undefined;
        this.lifeTool = undefined;
        this.signTool = undefined;
        this.eraseMode = false;
      },
      resetView: () => { this.renderer.resetView(); },
      screenToWorld: (clientX, clientY) => this.renderer.screenToWorld(clientX, clientY),
      screenToCell: (clientX, clientY) => this.renderer.screenToCell(clientX, clientY),
      worldToScreen: (x, y) => this.renderer.worldToScreen(x, y),
      viewState: () => this.renderer.getViewState(),
      backend: () => this.renderer.getBackendInfo(),
      prepareDenseSolidFixture: () => { prepareDenseSolidAuditFixture(this.simulation); },
      prepareSolidOpticalDepthFixture: () => {
        prepareSolidOpticalDepthAuditFixture(this.simulation);
      },
      prepareSolidFieldLightingFixture: () => {
        prepareSolidFieldLightingAuditFixture(this.simulation);
      },
      prepareContourStressFixture: () => { prepareContourStressAuditFixture(this.simulation); },
      toggleDenseSolidProbe: () => {
        toggleDenseSolidAuditProbe(this.simulation);
        this.renderer.invalidateDynamicPresentation();
      },
      materialAtlas: () => MATERIAL_ATLAS,
      prepareMaterialAtlas: () => { prepareMaterialAtlasAuditFixture(this.simulation); },
      cellularGraphicsAtlas: () => CELLULAR_GRAPHICS_AUDIT,
      prepareCellularGraphicsFixture: () => {
        prepareCellularGraphicsAuditFixture(this.simulation);
      },
      sensorGraphicsAtlas: () => SENSOR_GRAPHICS_AUDIT,
      prepareSensorGraphicsFixture: () => {
        prepareSensorGraphicsAuditFixture(this.simulation);
      },
      unusualPowderGraphicsAtlas: () => UNUSUAL_POWDER_GRAPHICS_AUDIT,
      prepareUnusualPowderGraphicsFixture: () => {
        prepareUnusualPowderGraphicsAuditFixture(this.simulation);
      },
      explosivePowderGraphicsAtlas: () => EXPLOSIVE_POWDER_GRAPHICS_AUDIT,
      prepareExplosivePowderGraphicsFixture: () => {
        prepareExplosivePowderGraphicsAuditFixture(this.simulation);
      },
      unusualSolidGraphicsAtlas: () => UNUSUAL_SOLID_GRAPHICS_AUDIT,
      prepareUnusualSolidGraphicsFixture: () => {
        prepareUnusualSolidGraphicsAuditFixture(this.simulation);
      },
      structuralRigidGraphicsAtlas: () => STRUCTURAL_RIGID_GRAPHICS_AUDIT,
      prepareStructuralRigidGraphicsFixture: () => {
        prepareStructuralRigidGraphicsAuditFixture(this.simulation);
      },
      mechanismGraphicsAtlas: () => MECHANISM_GRAPHICS_AUDIT,
      prepareMechanismGraphicsFixture: () => {
        prepareMechanismGraphicsAuditFixture(this.simulation);
      },
      electronicsGraphicsAtlas: () => ELECTRONICS_GRAPHICS_AUDIT,
      prepareElectronicsGraphicsFixture: () => {
        prepareElectronicsGraphicsAuditFixture(this.simulation);
      },
      fieldProfileGraphicsAtlas: () => FIELD_PROFILE_GRAPHICS_AUDIT,
      prepareFieldProfileGraphicsFixture: () => {
        prepareFieldProfileGraphicsAuditFixture(this.simulation);
      },
      earthenPowderGraphicsAtlas: () => EARTHEN_POWDER_GRAPHICS_AUDIT,
      prepareEarthenPowderGraphicsFixture: () => {
        prepareEarthenPowderGraphicsAuditFixture(this.simulation);
      },
      liquidIdentityGraphicsAtlas: () => LIQUID_IDENTITY_GRAPHICS_AUDIT,
      prepareLiquidIdentityGraphicsFixture: () => {
        prepareLiquidIdentityGraphicsAuditFixture(this.simulation);
      },
      gasIdentityGraphicsAtlas: () => GAS_IDENTITY_GRAPHICS_AUDIT,
      prepareGasIdentityGraphicsFixture: () => {
        prepareGasIdentityGraphicsAuditFixture(this.simulation);
      },
      energyRadioactiveGraphicsAtlas: () => ENERGY_RADIOACTIVE_GRAPHICS_AUDIT,
      prepareEnergyRadioactiveGraphicsFixture: () => {
        prepareEnergyRadioactiveGraphicsAuditFixture(this.simulation);
      },
      electricDischargeGraphicsAtlas: () => ELECTRIC_DISCHARGE_GRAPHICS_AUDIT,
      prepareElectricDischargeGraphicsFixture: () => {
        prepareElectricDischargeGraphicsAuditFixture(this.simulation);
      },
      organicPlantGraphicsAtlas: () => ORGANIC_PLANT_GRAPHICS_AUDIT,
      prepareOrganicPlantGraphicsFixture: () => {
        prepareOrganicPlantGraphicsAuditFixture(this.simulation);
      },
      spongeGraphicsAtlas: () => SPONGE_GRAPHICS_AUDIT,
      prepareSpongeGraphicsFixture: () => {
        prepareSpongeGraphicsAuditFixture(this.simulation);
      },
      virusGraphicsAtlas: () => VIRUS_GRAPHICS_AUDIT,
      prepareVirusGraphicsFixture: () => {
        prepareVirusGraphicsAuditFixture(this.simulation);
      },
      waxGraphicsAtlas: () => WAX_GRAPHICS_AUDIT,
      prepareWaxGraphicsFixture: () => {
        prepareWaxGraphicsAuditFixture(this.simulation);
      },
      crystallineGraphicsAtlas: () => CRYSTALLINE_GRAPHICS_AUDIT,
      prepareCrystallineGraphicsFixture: () => {
        prepareCrystallineGraphicsAuditFixture(this.simulation);
      },
      pasteResistGraphicsAtlas: () => PASTE_RESIST_GRAPHICS_AUDIT,
      preparePasteResistGraphicsFixture: () => {
        preparePasteResistGraphicsAuditFixture(this.simulation);
      },
      vibrStateGraphicsAtlas: () => VIBR_STATE_GRAPHICS_AUDIT,
      prepareVibrStateGraphicsFixture: () => {
        prepareVibrStateGraphicsAuditFixture(this.simulation);
      },
      deutStateGraphicsAtlas: () => DEUT_STATE_GRAPHICS_AUDIT,
      prepareDeutStateGraphicsFixture: () => {
        prepareDeutStateGraphicsAuditFixture(this.simulation);
        placeSourceTargetRecoveryProbe(
          this.simulation,
          SOURCE_TARGET_RECOVERY_PROBE.x,
          SOURCE_TARGET_RECOVERY_PROBE.y,
          SOURCE_TARGET_RECOVERY_PROBE.owner,
          SOURCE_TARGET_RECOVERY_PROBE.target,
        );
        this.renderer.invalidateDynamicPresentation();
      },
      toggleRetainedPresentationProbe: () => {
        const entry = DEUT_STATE_GRAPHICS_ATLAS.find(({ stateKey }) => stateKey === 'medium');
        if (!entry) throw new Error('Missing retained presentation probe card');
        const x = entry.coreProbe.x;
        const y = entry.coreProbe.y;
        const index = y * this.simulation.width + x;
        const backend = this.simulation as SimulationBackend & {
          setFixturePresentationState?: (px: number, py: number, state: number) => void;
        };
        if (this.simulation.cells()[index] !== Material.DEUT
          || !backend.setFixturePresentationState || !this.simulation.presentationState) {
          throw new Error('Retained presentation probe requires the prepared DEUT render-lab fixture');
        }
        const before = this.simulation.presentationState()[index];
        const after = before === 0x51A0 ? 0x1A05 : 0x51A0;
        backend.setFixturePresentationState(x, y, after);
        this.renderer.invalidateDynamicPresentation();
        return { x, y, material: this.simulation.cells()[index], before, after };
      },
      sourceTargetGraphicsAtlas: () => SOURCE_TARGET_GRAPHICS_AUDIT,
      prepareSourceTargetGraphicsFixture: () => {
        prepareSourceTargetGraphicsAuditFixture(this.simulation);
      },
      forceActivityGraphicsAtlas: () => FORCE_ACTIVITY_GRAPHICS_AUDIT,
      prepareForceActivityGraphicsFixture: () => {
        prepareForceActivityGraphicsAuditFixture(this.simulation);
      },
      poloStateGraphicsAtlas: () => POLO_STATE_GRAPHICS_AUDIT,
      preparePoloStateGraphicsFixture: () => {
        preparePoloStateGraphicsAuditFixture(this.simulation);
      },
      spngStateGraphicsAtlas: () => SPNG_STATE_GRAPHICS_AUDIT,
      prepareSpngStateGraphicsFixture: () => {
        prepareSpngStateGraphicsAuditFixture(this.simulation);
      },
      gelStateGraphicsAtlas: () => GEL_STATE_GRAPHICS_AUDIT,
      prepareGelStateGraphicsFixture: () => {
        prepareGelStateGraphicsAuditFixture(this.simulation);
      },
      pqrtStateGraphicsAtlas: () => PQRT_STATE_GRAPHICS_AUDIT,
      preparePqrtStateGraphicsFixture: () => {
        preparePqrtStateGraphicsAuditFixture(this.simulation);
      },
      filtStateGraphicsAtlas: () => FILT_STATE_GRAPHICS_AUDIT,
      prepareFiltStateGraphicsFixture: () => {
        prepareFiltStateGraphicsAuditFixture(this.simulation);
      },
      lcryStateGraphicsAtlas: () => LCRY_STATE_GRAPHICS_AUDIT,
      prepareLcryStateGraphicsFixture: () => {
        prepareLcryStateGraphicsAuditFixture(this.simulation);
      },
      pipeStateGraphicsAtlas: () => PIPE_STATE_GRAPHICS_AUDIT,
      preparePipeStateGraphicsFixture: () => {
        preparePipeStateGraphicsAuditFixture(this.simulation);
        this.renderer.synchronizeFixtureMaterialPlane();
        this.renderer.invalidateDynamicPresentation();
      },
      swchStateGraphicsAtlas: () => SWCH_STATE_GRAPHICS_AUDIT,
      prepareSwchStateGraphicsFixture: () => {
        prepareSwchStateGraphicsAuditFixture(this.simulation);
        this.renderer.synchronizeFixtureMaterialPlane();
        this.renderer.invalidateDynamicPresentation();
      },
      storStateGraphicsAtlas: () => STOR_STATE_GRAPHICS_AUDIT,
      prepareStorStateGraphicsFixture: () => {
        prepareStorStateGraphicsAuditFixture(this.simulation);
        this.renderer.synchronizeFixtureMaterialPlane();
        this.renderer.invalidateDynamicPresentation();
      },
      dlayStateGraphicsAtlas: () => DLAY_STATE_GRAPHICS_AUDIT,
      prepareDlayStateGraphicsFixture: () => {
        prepareDlayStateGraphicsAuditFixture(this.simulation);
        this.renderer.synchronizeFixtureMaterialPlane();
        this.renderer.invalidateDynamicPresentation();
      },
      wifiStateGraphicsAtlas: () => WIFI_STATE_GRAPHICS_AUDIT,
      prepareWifiStateGraphicsFixture: () => {
        prepareWifiStateGraphicsAuditFixture(this.simulation);
        this.renderer.synchronizeFixtureMaterialPlane();
        this.renderer.invalidateDynamicPresentation();
      },
      powderMesostrataGraphicsAtlas: () => POWDER_MESOSTRATA_GRAPHICS_AUDIT,
      preparePowderMesostrataGraphicsFixture: () => {
        preparePowderMesostrataGraphicsAuditFixture(this.simulation);
        this.renderer.synchronizeFixtureMaterialPlane();
        this.renderer.invalidateDynamicPresentation();
      },
      geologicalSolidGraphicsAtlas: () => GEOLOGICAL_SOLID_GRAPHICS_AUDIT,
      prepareGeologicalSolidGraphicsFixture: () => {
        prepareGeologicalSolidGraphicsAuditFixture(this.simulation);
        this.renderer.synchronizeFixtureMaterialPlane();
        this.renderer.invalidateDynamicPresentation();
      },
      thermalCatalyticRigidGraphicsAtlas: () => THERMAL_CATALYTIC_RIGID_GRAPHICS_AUDIT,
      prepareThermalCatalyticRigidGraphicsFixture: () => {
        prepareThermalCatalyticRigidGraphicsAuditFixture(this.simulation);
        this.renderer.synchronizeFixtureMaterialPlane();
        this.renderer.invalidateDynamicPresentation();
      },
      gooSolidGraphicsAtlas: () => GOO_SOLID_GRAPHICS_AUDIT,
      prepareGooSolidGraphicsFixture: () => {
        prepareGooSolidGraphicsAuditFixture(this.simulation);
        this.renderer.synchronizeFixtureMaterialPlane();
        this.renderer.invalidateDynamicPresentation();
      },
      frayForceGraphicsAtlas: () => FRAY_FORCE_GRAPHICS_AUDIT,
      prepareFrayForceGraphicsFixture: () => {
        prepareFrayForceGraphicsAuditFixture(this.simulation);
        this.renderer.synchronizeFixtureMaterialPlane();
        this.renderer.invalidateDynamicPresentation();
      },
      distilledDieselLiquidGraphicsAtlas: () => DISTILLED_DIESEL_LIQUID_GRAPHICS_AUDIT,
      prepareDistilledDieselLiquidGraphicsFixture: () => {
        prepareDistilledDieselLiquidGraphicsAuditFixture(this.simulation);
        this.renderer.synchronizeFixtureMaterialPlane();
        this.renderer.invalidateDynamicPresentation();
      },
      photonSpectrumGraphicsAtlas: () => PHOTON_SPECTRUM_GRAPHICS_AUDIT,
      preparePhotonSpectrumGraphicsFixture: () => {
        preparePhotonSpectrumGraphicsAuditFixture(this.simulation);
        this.renderer.invalidateDynamicPresentation();
      },
      setPhotonSpectrumGraphicsVisible: (visible) => {
        setPhotonSpectrumGraphicsVisible(this.simulation, visible);
        this.renderer.invalidateDynamicPresentation();
      },
      lavaStateGraphicsAtlas: () => LAVA_STATE_GRAPHICS_AUDIT,
      prepareLavaStateGraphicsFixture: () => {
        prepareLavaStateGraphicsAuditFixture(this.simulation);
      },
      botanicalLifecycleGraphicsAtlas: () => BOTANICAL_LIFECYCLE_GRAPHICS_AUDIT,
      prepareBotanicalLifecycleGraphicsFixture: () => {
        prepareBotanicalLifecycleGraphicsAuditFixture(this.simulation);
      },
      sparkStateGraphicsAtlas: () => SPARK_STATE_GRAPHICS_AUDIT,
      prepareSparkStateGraphicsFixture: () => {
        prepareSparkStateGraphicsAuditFixture(this.simulation);
      },
      nativeSeedGrowthSnapshot: () => {
        if (!this.nativeSeedGrowthAudit) throw new Error('Native seed growth fixture is not prepared');
        return this.nativeSeedGrowthAudit;
      },
      prepareNativeSeedGrowthFixture: () => {
        this.nativeSeedGrowthAudit = runNativeSeedGrowthAudit(
          this.simulation as NativeSeedGrowthBackend,
        );
      },
      canvasPresentationTiming: () => this.renderer.getCanvasPresentationTiming(),
      presentationRefreshAudit: () => this.renderer.getPresentationRefreshAudit(),
      requestWebGLPresentationTimingSample: () => this.renderer.requestWebGLPresentationTimingSample(),
      webGLPresentationTiming: () => this.renderer.getWebGLPresentationTiming(),
      forceEightXRenderStall: () => this.renderer.forceEightXRenderStallForAudit(),
    };
  }

  private readonly frame = (time: number): void => {
    const elapsed = Math.min(time - this.lastFrame, 80);
    this.lastFrame = time;
    if (!this.paused) {
      this.accumulator += elapsed;
      while (this.accumulator >= 1000 / 60) { this.simulation.step(); this.accumulator -= 1000 / 60; }
    }
    this.renderer.render(time, this.root.dataset.inputAudit === 'ready' ? 1_000 : time);
    this.signOverlay?.render(time);
    if (time - this.lastIndicatorUpdate >= 100) {
      this.lastIndicatorUpdate = time;
      this.updateFieldIndicator();
    }
    requestAnimationFrame(this.frame);
  };

  private handleSignPoint(point: { x: number; y: number }, erase: boolean): void {
    if (!this.signEditor || this.signEditor.isOpen) return;
    if (point.x < 0 || point.y < 0
      || point.x >= this.simulation.width || point.y >= this.simulation.height) return;
    const existing = hitTestNativeSign(this.simulation.signs?.() ?? [], point);
    if (erase) {
      if (existing) this.simulation.removeSign?.(existing.index);
      return;
    }
    this.signEditor.open(point, existing);
  }


  private mountFieldIndicator(viewport: HTMLElement): void {
    const indicator = document.createElement("output");
    indicator.className = "field-indicator glass";
    indicator.setAttribute("aria-live", "off");
    viewport.append(indicator);
    this.indicator = indicator;
    const selectProbe = (event: PointerEvent): void => {
      const cell = this.renderer.screenToCell(event.clientX, event.clientY);
      if (cell.x < 0 || cell.y < 0 || cell.x >= this.simulation.width || cell.y >= this.simulation.height) return;
      this.probeX = cell.x;
      this.probeY = cell.y;
      if (this.indicator) this.indicator.dataset.cell = cell.x + ',' + cell.y;
      this.updateFieldIndicator();
    };
    viewport.addEventListener("pointermove", selectProbe);
    viewport.addEventListener("pointerdown", selectProbe);
    this.updateFieldIndicator();
  }

  private updateFieldIndicator(): void {
    if (!this.indicator) return;
    const index = this.probeY * this.simulation.width + this.probeX;
    const rawTemperature = this.simulation.temperature?.()[index];
    const pressure = this.simulation.pressure?.()[index];
    const temperature = rawTemperature ? (rawTemperature / 10 - 273.15).toFixed(1) + " °C" : "—";
    const pressureText = pressure === undefined ? "—" : (pressure >= 0 ? "+" : "") + pressure.toFixed(2);
    const sourceTarget = this.simulation.configuredSourceTargetAt?.(this.probeX, this.probeY);
    const sourceText = sourceTarget === undefined ? ''
      : `<span class="source-target"><b>Source target</b>${materialLabel(sourceTarget)}</span>`;
    const renderer = this.renderer.getBackendInfo();
    this.indicator.dataset.renderer = renderer.backend;
    this.indicator.dataset.rendererReason = renderer.reason ?? '';
    const scaleCapped = renderer.outputScale !== undefined
      && renderer.requestedOutputScale !== undefined
      && renderer.outputScale < renderer.requestedOutputScale;
    this.indicator.title = renderer.reason ? rendererReason(renderer.reason)
      : scaleCapped
        ? `Semantic WebGL renderer; ${renderer.requestedOutputScale}× request safely capped to ${renderer.outputScale}×`
        : 'Semantic WebGL renderer';
    this.indicator.innerHTML = "<span><b>Pressure</b>" + pressureText
      + "</span><span><b>Temperature</b>" + temperature
      + "</span><span class=\"renderer-indicator\"><b>Backend</b>" + rendererStatus(renderer) + "</span>"
      + sourceText;
  }

  private async downloadWorldFile(): Promise<boolean> {
    try {
      const file = exportWorldFile(this.simulation);
      const name = worldFileName(file.extension);
      const sharedFile = new File([file.bytes.slice().buffer], name, { type: file.mediaType });
      const shareData = { files: [sharedFile], title: 'AniforTPT save' };
      if (navigator.share && navigator.canShare?.(shareData)) {
        try {
          await navigator.share(shareData);
          return true;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return false;
          // Platform or permission failures still get a normal file download.
        }
      }
      const href = URL.createObjectURL(sharedFile);
      const download = document.createElement('a');
      download.href = href;
      download.download = name;
      download.hidden = true;
      document.body.append(download);
      download.click();
      download.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 0);
      return true;
    } catch { return false; }
  }

  private async openWorldFile(file: File): Promise<boolean> {
    if (!file.size || file.size > MAX_WORLD_FILE_BYTES) return false;
    try {
      importWorldFile(this.simulation, new Uint8Array(await file.arrayBuffer()));
      this.renderer.invalidateDynamicPresentation();
      history.replaceState(null, '', location.pathname + location.search);
      this.save();
      return true;
    } catch { return false; }
  }

  private save(): void {
    try { localStorage.setItem(AUTOSAVE_KEY, this.simulation.saveWorld()); } catch { /* storage may be unavailable */ }
  }

  private async restore(): Promise<void> {
    const shared = new URLSearchParams(location.hash.slice(1)).get('world');
    if (shared) {
      try {
        this.simulation.loadWorld(await decodeSharedWorld(shared));
        this.renderer.invalidateDynamicPresentation();
        return;
      }
      catch { history.replaceState(null, "", location.pathname + location.search); }
    }
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        this.simulation.loadWorld(saved);
        this.renderer.invalidateDynamicPresentation();
      }
    } catch { localStorage.removeItem(AUTOSAVE_KEY); }
  }

  private seedIfEmpty(): void {
    if (this.simulation.cells().some((cell) => cell !== Material.Empty)) return;
    const floor = this.simulation.height - 8;
    for (let x = 25; x < this.simulation.width - 25; x += 3) this.simulation.paint(x, floor, Material.Wall, 2);
    this.simulation.paint(Math.floor(this.simulation.width * 0.38), Math.floor(this.simulation.height * 0.18), Material.Sand, 16);
    this.simulation.paint(Math.floor(this.simulation.width * 0.62), Math.floor(this.simulation.height * 0.22), Material.Water, 14);
  }
}

function materialLabel(material: Material): string {
  return ALL_MATERIALS.find(({ id }) => id === material)?.name ?? `Element ${material}`;
}

function rendererReason(reason: NonNullable<ReturnType<MaterialRenderer['getBackendInfo']>['reason']>): string {
  if (reason === 'forced') return 'Canvas2D forced by the renderer query override';
  if (reason === 'webgl-unavailable') return 'Canvas2D because WebGL is unavailable';
  if (reason === 'webgl-starting') return 'Canvas2D while the WebGL renderer starts';
  if (reason === 'webgl-timeout') return 'Canvas2D because WebGL initialization timed out';
  if (reason === 'webgl-context-lost') return 'Canvas2D because the active WebGL context was lost';
  return 'Canvas2D because WebGL initialization failed';
}

function rendererStatus(renderer: ReturnType<MaterialRenderer['getBackendInfo']>): string {
  const scale = renderer.outputScale === undefined ? '' : ` · ${renderer.outputScale}×`;
  const capped = renderer.outputScale !== undefined && renderer.requestedOutputScale !== undefined
    && renderer.outputScale < renderer.requestedOutputScale
    ? ` (${renderer.requestedOutputScale}× capped)` : '';
  const base = renderer.label + scale + capped;
  if (renderer.backend === 'webgl') return base;
  if (renderer.reason === 'webgl-starting') return `${base} · starting WebGL`;
  if (renderer.reason === 'webgl-timeout') return `${base} · WebGL timeout`;
  if (renderer.reason === 'webgl-unavailable') return `${base} · WebGL unavailable`;
  if (renderer.reason === 'webgl-error') return `${base} · WebGL error`;
  if (renderer.reason === 'webgl-context-lost') return `${base} · WebGL context lost`;
  if (renderer.reason === 'forced') return `${base} · forced`;
  return base;
}
