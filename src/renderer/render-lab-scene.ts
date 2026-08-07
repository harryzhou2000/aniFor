import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { RENDER_LAB_AMBIENT_TEMPERATURE } from '../simulation/render-lab-backend';

export const RENDER_LAB_QUERY = 'render-lab';
export const MATERIAL_SHOWCASE_QUERY = 'showcase';
/** An opt-in diagnostic composition; it is intentionally not the v6 showcase. */
export const MATERIAL_CANDIDATE_SURVEY_QUERY = 'candidate-survey';
export const RENDER_LAB_COLD_TEMPERATURE = 1200;
export { RENDER_LAB_AMBIENT_TEMPERATURE };
export const RENDER_LAB_HOT_TEMPERATURE = 18000;

export type MaterialShowcaseMediaProfile = 'granular-body' | 'cohesive-liquid'
  | 'diffuse-gas' | 'rigid-body' | 'organic-body' | 'emissive-volume'
  | 'phase-contact';

export type MaterialShowcaseAuditSupport =
  | {
    readonly kind: 'semantic';
    readonly materials: readonly Material[];
    readonly minimumRecall: number;
  }
  | {
    readonly kind: 'atmosphere';
    readonly style: number;
    readonly minimumAlpha: number;
    readonly minimumRecall: number;
  }
  | {
    readonly kind: 'emission';
    readonly minimumAlpha: number;
    readonly minimumRecall: number;
  };

export interface MaterialShowcaseAuditRegion {
  readonly name: string;
  readonly family: 'powder' | 'liquid' | 'gas' | 'solid' | 'organic'
    | 'emission' | 'contact';
  readonly profile: MaterialShowcaseMediaProfile;
  readonly x: number;
  readonly y: number;
  readonly radiusX: number;
  readonly radiusY: number;
  /**
   * Both semantic and screenshot sampling use the exact half-open rectangle
   * `[x-radiusX, x+radiusX) × [y-radiusY, y+radiusY)`.
   */
  readonly support: MaterialShowcaseAuditSupport;
  /** Exact owners counted independently of the composed screenshot sampler. */
  readonly semanticMaterials: readonly Material[];
  readonly topology?: boolean;
  readonly silhouette?: boolean;
  readonly expectedMatching: number;
}

export interface MaterialShowcaseAuditSnapshot {
  readonly version: 6;
  readonly semantic: {
    readonly hash: number;
    readonly occupied: number;
    readonly materialCounts: readonly {
      readonly material: Material;
      readonly count: number;
    }[];
  };
  readonly metalInsert: {
    readonly material: Material.Metal;
    readonly rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
    readonly radius: 8;
    readonly expectedCells: 880;
    readonly rowCounts: readonly number[];
    readonly coreProbe: { readonly x: number; readonly y: number };
    readonly waterControls: readonly { readonly x: number; readonly y: number }[];
  };
  readonly regions: readonly MaterialShowcaseAuditRegion[];
}

/**
 * The candidate survey deliberately owns a smaller contract than the production
 * showcase. It selects the next bounded owner and retains accepted candidates
 * as before/after references; it must not silently alter the E01–E50 ladder.
 */
export interface MaterialCandidateSurveyRegion {
  readonly name: string;
  readonly material: Material;
  readonly phase: 'powder' | 'liquid';
  readonly profile: 'granular-body' | 'cohesive-liquid';
  readonly x: number;
  readonly y: number;
  readonly radiusX: number;
  readonly radiusY: number;
  /** The exact half-open rectangle `[x-radiusX, x+radiusX) × [y-radiusY, y+radiusY)`. */
  readonly support: Extract<MaterialShowcaseAuditSupport, { readonly kind: 'semantic' }>;
  readonly semanticMaterials: readonly Material[];
  readonly expectedMatching: number;
}

export interface MaterialCandidateSurveyAuditSnapshot {
  readonly version: 1;
  readonly world: { readonly width: 612; readonly height: 384 };
  readonly semantic: {
    readonly hash: number;
    readonly occupied: number;
    readonly materialCounts: readonly {
      readonly material: Material;
      readonly count: number;
    }[];
  };
  readonly regions: readonly MaterialCandidateSurveyRegion[];
  readonly sharedContext: {
    readonly material: Material.ROCK;
    readonly contactProbes: readonly { readonly x: number; readonly y: number; readonly material: Material }[];
    readonly wallProbes: readonly { readonly x: number; readonly y: number }[];
  };
}

/**
 * Frozen source-of-truth for the next-owner survey. Its compact cards leave
 * each candidate's broad body, one intentionally authored topology defect, and
 * a common ROCK/wall context inspectable without disturbing showcase v6.
 */
export const MATERIAL_CANDIDATE_SURVEY_AUDIT: MaterialCandidateSurveyAuditSnapshot = {
  version: 1,
  world: { width: 612, height: 384 },
  semantic: {
    hash: 2_255_453_673,
    occupied: 115_368,
    materialCounts: [
      { material: Material.Nitro, count: 14_692 },
      { material: Material.Snow, count: 14_612 },
      { material: Material.BASE, count: 14_936 },
      { material: Material.C4, count: 14_692 },
      { material: Material.BGLA, count: 14_612 },
      { material: Material.Quartz, count: 14_936 },
      { material: Material.ROCK, count: 26_888 },
    ],
  },
  regions: [
    {
      name: 'candidateNitro', material: Material.Nitro, phase: 'liquid', profile: 'cohesive-liquid',
      x: 110, y: 120, radiusX: 30, radiusY: 24,
      support: { kind: 'semantic', materials: [Material.Nitro], minimumRecall: 0.96 },
      semanticMaterials: [Material.Nitro], expectedMatching: 2_880,
    },
    {
      name: 'candidateSnow', material: Material.Snow, phase: 'powder', profile: 'granular-body',
      x: 306, y: 120, radiusX: 30, radiusY: 24,
      support: { kind: 'semantic', materials: [Material.Snow], minimumRecall: 0.96 },
      semanticMaterials: [Material.Snow], expectedMatching: 2_880,
    },
    {
      name: 'candidateBASE', material: Material.BASE, phase: 'liquid', profile: 'cohesive-liquid',
      x: 502, y: 120, radiusX: 30, radiusY: 24,
      support: { kind: 'semantic', materials: [Material.BASE], minimumRecall: 0.96 },
      semanticMaterials: [Material.BASE], expectedMatching: 2_880,
    },
    {
      name: 'candidateC4', material: Material.C4, phase: 'powder', profile: 'granular-body',
      x: 110, y: 280, radiusX: 30, radiusY: 24,
      support: { kind: 'semantic', materials: [Material.C4], minimumRecall: 0.96 },
      semanticMaterials: [Material.C4], expectedMatching: 2_880,
    },
    {
      name: 'candidateBGLA', material: Material.BGLA, phase: 'powder', profile: 'granular-body',
      x: 306, y: 280, radiusX: 30, radiusY: 24,
      support: { kind: 'semantic', materials: [Material.BGLA], minimumRecall: 0.96 },
      semanticMaterials: [Material.BGLA], expectedMatching: 2_880,
    },
    {
      name: 'candidateQuartz', material: Material.Quartz, phase: 'powder', profile: 'granular-body',
      x: 502, y: 280, radiusX: 30, radiusY: 24,
      support: { kind: 'semantic', materials: [Material.Quartz], minimumRecall: 0.96 },
      semanticMaterials: [Material.Quartz], expectedMatching: 2_880,
    },
  ],
  sharedContext: {
    material: Material.ROCK,
    contactProbes: [
      { x: 110, y: 167, material: Material.Nitro },
      { x: 306, y: 167, material: Material.Snow },
      { x: 502, y: 167, material: Material.BASE },
      { x: 110, y: 216, material: Material.C4 },
      { x: 306, y: 216, material: Material.BGLA },
      { x: 502, y: 216, material: Material.Quartz },
    ],
    wallProbes: [{ x: 252, y: 180 }, { x: 360, y: 204 }],
  },
};

/**
 * App-owned contract for the production-fit visual survey. Keeping this beside
 * the scene prevents the browser audit from silently measuring stale copied
 * coordinates or accepting the same wrong topology at every output scale.
 */
export const MATERIAL_SHOWCASE_AUDIT: MaterialShowcaseAuditSnapshot = {
  version: 6,
  semantic: {
    hash: 3_610_338_776,
    occupied: 114_015,
    materialCounts: [
      { material: Material.Sand, count: 5_862 },
      { material: Material.Water, count: 20_862 },
      { material: Material.Fire, count: 216 },
      { material: Material.Smoke, count: 6_806 },
      { material: Material.Oil, count: 2_538 },
      { material: Material.Wood, count: 2_374 },
      { material: Material.Plant, count: 10_215 },
      { material: Material.Plasma, count: 492 },
      { material: Material.Metal, count: 880 },
      { material: Material.Glass, count: 6_206 },
      { material: Material.Concrete, count: 4_148 },
      { material: Material.Clay, count: 4_720 },
      { material: Material.Oxygen, count: 6_003 },
      { material: Material.CarbonDioxide, count: 2_184 },
      { material: Material.NobleGas, count: 4_300 },
      { material: Material.ROCK, count: 23_090 },
      { material: Material.ELEC, count: 150 },
      { material: Material.POLO, count: 492 },
      { material: Material.URAN, count: 1_804 },
      { material: Material.ISZS, count: 3_488 },
      { material: Material.VIBR, count: 3_096 },
      { material: Material.DTEC, count: 2_869 },
      { material: Material.Soap, count: 1_220 },
    ],
  },
  metalInsert: {
    material: Material.Metal,
    rect: { x: 315, y: 289, width: 54, height: 18 },
    radius: 8,
    expectedCells: 880,
    rowCounts: [38, 44, 48, 50, 50, 52, 52, 52, 54, 54, 52, 52, 52, 50, 50, 48, 44, 38],
    coreProbe: { x: 342, y: 298 },
    waterControls: [{ x: 315, y: 289 }, { x: 342, y: 288 }, { x: 342, y: 307 }],
  },
  regions: [
    {
      name: 'powderSand', family: 'powder', profile: 'granular-body',
      x: 140, y: 275, radiusX: 35, radiusY: 20,
      support: { kind: 'semantic', materials: [Material.Sand], minimumRecall: 0.96 },
      semanticMaterials: [Material.Sand],
      topology: true, silhouette: true, expectedMatching: 800,
    },
    {
      name: 'powderClay', family: 'powder', profile: 'granular-body',
      x: 140, y: 275, radiusX: 35, radiusY: 20,
      support: { kind: 'semantic', materials: [Material.Clay], minimumRecall: 0.96 },
      semanticMaterials: [Material.Clay],
      topology: true, silhouette: true, expectedMatching: 1_369,
    },
    {
      name: 'powderConcrete', family: 'powder', profile: 'granular-body',
      x: 140, y: 320, radiusX: 50, radiusY: 8,
      support: { kind: 'semantic', materials: [Material.Concrete], minimumRecall: 0.96 },
      semanticMaterials: [Material.Concrete],
      topology: true, silhouette: true, expectedMatching: 1_600,
    },
    {
      name: 'liquidWater', family: 'liquid', profile: 'cohesive-liquid',
      x: 355, y: 260, radiusX: 42, radiusY: 38,
      support: { kind: 'semantic', materials: [Material.Water], minimumRecall: 0.96 },
      semanticMaterials: [Material.Water],
      topology: true, silhouette: true, expectedMatching: 5_636,
    },
    {
      name: 'liquidOil', family: 'liquid', profile: 'cohesive-liquid',
      x: 420, y: 240, radiusX: 20, radiusY: 15,
      support: { kind: 'semantic', materials: [Material.Oil], minimumRecall: 0.96 },
      semanticMaterials: [Material.Oil],
      topology: true, silhouette: true, expectedMatching: 1_200,
    },
    {
      name: 'liquidSoap', family: 'liquid', profile: 'cohesive-liquid',
      x: 76, y: 216, radiusX: 16, radiusY: 6,
      support: { kind: 'semantic', materials: [Material.Soap], minimumRecall: 0.96 },
      semanticMaterials: [Material.Soap],
      topology: true, silhouette: true, expectedMatching: 384,
    },
    {
      name: 'gasSmoke', family: 'gas', profile: 'diffuse-gas',
      x: 360, y: 92, radiusX: 33, radiusY: 26,
      support: { kind: 'atmosphere', style: 1, minimumAlpha: 12, minimumRecall: 0.78 },
      semanticMaterials: [Material.Smoke], topology: true, silhouette: true,
      expectedMatching: 2_185,
    },
    {
      name: 'gasOxygen', family: 'gas', profile: 'diffuse-gas',
      x: 427, y: 82, radiusX: 30, radiusY: 22,
      support: { kind: 'atmosphere', style: 4, minimumAlpha: 12, minimumRecall: 0.78 },
      semanticMaterials: [Material.Oxygen], topology: true, silhouette: true,
      expectedMatching: 2_315,
    },
    {
      name: 'gasCarbonDioxide', family: 'gas', profile: 'diffuse-gas',
      x: 398, y: 166, radiusX: 34, radiusY: 12,
      support: { kind: 'atmosphere', style: 6, minimumAlpha: 12, minimumRecall: 0.78 },
      semanticMaterials: [Material.CarbonDioxide], topology: true, silhouette: true,
      expectedMatching: 1_528,
    },
    {
      name: 'gasNoble', family: 'gas', profile: 'diffuse-gas',
      x: 497, y: 103, radiusX: 28, radiusY: 20,
      support: { kind: 'atmosphere', style: 7, minimumAlpha: 12, minimumRecall: 0.78 },
      semanticMaterials: [Material.NobleGas], topology: true, silhouette: true,
      expectedMatching: 1_986,
    },
    {
      name: 'solidRock', family: 'solid', profile: 'rigid-body',
      x: 530, y: 331, radiusX: 35, radiusY: 19,
      support: { kind: 'semantic', materials: [Material.ROCK], minimumRecall: 0.96 },
      semanticMaterials: [Material.ROCK],
      topology: true, silhouette: true, expectedMatching: 2_660,
    },
    {
      name: 'solidISZS', family: 'solid', profile: 'rigid-body',
      x: 232, y: 73, radiusX: 18, radiusY: 24,
      support: { kind: 'semantic', materials: [Material.ISZS], minimumRecall: 0.96 },
      semanticMaterials: [Material.ISZS],
      topology: true, silhouette: true, expectedMatching: 1_728,
    },
    {
      name: 'solidVIBR', family: 'solid', profile: 'rigid-body',
      x: 253, y: 154, radiusX: 18, radiusY: 21,
      support: { kind: 'semantic', materials: [Material.VIBR], minimumRecall: 0.96 },
      semanticMaterials: [Material.VIBR],
      topology: true, silhouette: true, expectedMatching: 1_512,
    },
    {
      name: 'organicWood', family: 'organic', profile: 'organic-body',
      x: 122, y: 220, radiusX: 7, radiusY: 34,
      support: { kind: 'semantic', materials: [Material.Wood], minimumRecall: 0.96 },
      semanticMaterials: [Material.Wood],
      topology: true, silhouette: true, expectedMatching: 952,
    },
    {
      name: 'organicPlant', family: 'organic', profile: 'organic-body',
      x: 116, y: 120, radiusX: 38, radiusY: 22,
      support: { kind: 'semantic', materials: [Material.Plant], minimumRecall: 0.96 },
      semanticMaterials: [Material.Plant],
      topology: true, silhouette: true, expectedMatching: 3_344,
    },
    {
      name: 'emissionPlasma', family: 'emission', profile: 'emissive-volume',
      x: 311, y: 139, radiusX: 15, radiusY: 10,
      support: { kind: 'emission', minimumAlpha: 8, minimumRecall: 0.72 },
      semanticMaterials: [Material.Plasma], topology: true, silhouette: true,
      expectedMatching: 492,
    },
    {
      name: 'contactWaterGlass', family: 'contact', profile: 'phase-contact',
      x: 282, y: 225, radiusX: 11, radiusY: 20,
      support: {
        kind: 'semantic', materials: [Material.Water, Material.Glass], minimumRecall: 0.96,
      },
      semanticMaterials: [Material.Water, Material.Glass],
      topology: true, silhouette: true, expectedMatching: 880,
    },
    {
      name: 'contactWaterMetal', family: 'contact', profile: 'phase-contact',
      x: 342, y: 289, radiusX: 20, radiusY: 12,
      support: {
        kind: 'semantic', materials: [Material.Water, Material.Metal], minimumRecall: 0.96,
      },
      semanticMaterials: [Material.Water, Material.Metal],
      topology: true, silhouette: true, expectedMatching: 960,
    },
  ],
};

export const RENDER_LAB_STYLE_SAMPLES = [
  // Granular surfaces, including emissive/reactive powders.
  Material.Sand, Material.Dust, Material.Salt, Material.Gunpowder, Material.Thermite,
  // Rigid surfaces plus a neutral-profile LIFE projection with rigid optics.
  Material.Metal, Material.Glass, Material.LIFE_GOL, Material.Ice, Material.Wall,
  // Organic and growing matter.
  Material.Wood, Material.Plant, Material.SEED, Material.YEST, Material.VINE,
  // Radioactive powders and a true solid plus sink and carrier semantics.
  Material.PLUT, Material.URAN, Material.VIBR, Material.CONV, Material.NEUT,
  // Emitter, powered/sensor devices, portal channel, and force actuator.
  Material.CLNE, Material.PCLN, Material.DTEC, Material.PRTI, Material.ACEL,
  // Neutral and radioactive energy cores.
  Material.Fire, Material.Plasma, Material.ELEC, Material.PHOT, Material.GRVT,
] as const;

export const RENDER_LAB_ENERGY_SAMPLES = [
  Material.Fire, Material.Plasma, Material.ELEC, Material.PHOT, Material.GRVT,
] as const;

export function renderLabRequested(search = globalThis.location?.search ?? ''): boolean {
  return new URLSearchParams(search).get('scene') === RENDER_LAB_QUERY;
}

/** A paused, normal-fit composition for visual review outside the diagnostic atlas. */
export function materialShowcaseRequested(search = globalThis.location?.search ?? ''): boolean {
  return new URLSearchParams(search).get('scene') === MATERIAL_SHOWCASE_QUERY;
}

/** True only for the isolated remaining-owner diagnostic fixture. */
export function materialCandidateSurveyRequested(search = globalThis.location?.search ?? ''): boolean {
  return new URLSearchParams(search).get('scene') === MATERIAL_CANDIDATE_SURVEY_QUERY;
}

/**
 * Stages dense, connected bodies so an artist can inspect the normal-fit look
 * without mistaking the deliberately sparse regression atlas for the intended
 * presentation. It uses the ordinary simulation paint path and renderer fields
 * only; no showcase data exists outside the normal semantic world.
 */
export function applyMaterialShowcaseScene(simulation: SimulationBackend): void {
  simulation.clear();
  const plot = new ScenePlotter(simulation);

  // A broad exact-Soap body floats in the unused air above the powder slope.
  // Its scored interior spans both established sheen lobes at deep column
  // support, so the survey measures pearlescent volume rather than one surface
  // band or a sparse film.
  plot.roundedRect(52, 196, 48, 28, 10, Material.Soap);

  // A deep, native-solid ROCK ground gives the liquid, pile, tree, and devices
  // a common contact surface. The small carved channel keeps the composition
  // from becoming a set of disconnected cards. Keep this an actual Solid: the
  // composed-rank solid region is deliberately sampled from this broad body.
  plot.roundedRect(24, 280, 564, 76, 18, Material.ROCK);
  plot.eraseRect(315, 280, 54, 18);

  // Packed powder should read as one cohesive pile but keep its analytic slope
  // and a narrow natural ridge rather than a rectangular block.
  plot.slope(40, 186, 198, 142, Material.Sand);
  plot.slope(76, 221, 132, 107, Material.Clay);
  plot.roundedRect(50, 308, 178, 24, 10, Material.Concrete);

  // A broad connected pool with a controlled Oil inlet presents surface depth,
  // meniscus light, optical thickness, and an unlike-liquid seam at fit view.
  // Draw the submerged Metal insert after the pool: drawing it beside the
  // ground before Water used to erase all 880 intended Metal cells and made
  // the production showcase incapable of reviewing a rigid/liquid contact.
  plot.roundedRect(252, 192, 232, 128, 28, Material.Water);
  plot.splitCapsule(332, 214, 116, 55, 24, 389, Material.Water, Material.Oil);
  const metal = MATERIAL_SHOWCASE_AUDIT.metalInsert;
  plot.roundedRect(
    metal.rect.x, metal.rect.y, metal.rect.width, metal.rect.height, metal.radius, metal.material,
  );
  plot.roundedRect(277, 185, 14, 143, 7, Material.Glass);
  plot.roundedRect(466, 185, 14, 143, 7, Material.Glass);
  plot.roundedRect(277, 313, 203, 15, 7, Material.Glass);
  plot.rect(276, 251, 6, 36, Material.Fire, 1, 0);
  plot.rect(473, 235, 5, 30, Material.ELEC, 1, 0);

  // Large, overlapping gas bodies deliberately have dense centres and soft
  // outlines so atmosphere ownership can be judged without the atlas' gaps.
  plot.ellipse(360, 92, 94, 49, Material.Smoke, 0.96, 811, 0.30);
  plot.ellipse(427, 82, 82, 43, Material.Oxygen, 0.92, 823, 0.34);
  plot.ellipse(497, 103, 64, 37, Material.NobleGas, 0.88, 827, 0.40);
  // A lower, exact-CO2 cloud occupies the clear air band above the pool. Its
  // semantic carrier remains separated from every existing cloud and surface,
  // leaving atmosphere style 6 solely responsible for its connected volume.
  plot.ellipse(398, 166, 55, 18, Material.CarbonDioxide, 0.96, 841, 0.30);
  plot.roundedRect(296, 129, 30, 20, 9, Material.Plasma);

  // Broad, separated radioactive solids make their deep-body optics visible at
  // normal fit without letting gas, liquid, or unlike-solid contact influence
  // the scored interiors. Their staggered silhouettes also avoid card-like
  // repetition while retaining a generous exact-owner core at every scale.
  plot.roundedRect(205, 38, 54, 70, 16, Material.ISZS);
  plot.roundedRect(226, 123, 54, 62, 15, Material.VIBR);

  // A small living silhouette and a device/radioactive cluster keep organic,
  // hard-surface, energy, and native-state visual vocabulary in one scene.
  plot.roundedRect(112, 121, 20, 158, 8, Material.Wood);
  plot.roundedRect(66, 82, 112, 76, 32, Material.Plant);
  plot.roundedRect(150, 151, 70, 44, 18, Material.Plant);
  plot.curvaturePlate(510, 226, 54, 58, 14, Material.DTEC);
  plot.roundedRect(522, 144, 38, 62, 15, Material.URAN);
  plot.roundedRect(548, 166, 20, 30, 9, Material.POLO);
}

/**
 * Paused v1 candidate survey. The explicit diagnostic route owns this scene;
 * v6 remains the production composition while this provides a deterministic
 * evidence surface for Nitro/Snow/BASE/C4/BGLA/Quartz comparisons.
 */
export function applyMaterialCandidateSurveyScene(simulation: SimulationBackend): void {
  simulation.clear();
  const plot = new ScenePlotter(simulation);

  // A single grounded stage is shared by all six cards. Each candidate touches
  // the ROCK face while the patterned wall stays on the independent wall plane.
  plot.roundedRect(24, 168, 564, 48, 12, Material.ROCK);
  plot.wallPatternRect(248, 168, 116, 48, 6);

  // Upper row: two broad cards plus one authored hole/notch/needle context.
  plot.roundedRect(50, 40, 120, 128, 22, Material.Nitro);
  plot.eraseRect(65, 68, 10, 16);
  plot.roundedRect(246, 40, 120, 128, 22, Material.Snow);
  plot.eraseRect(246, 82, 12, 20);
  plot.roundedRect(442, 40, 120, 128, 22, Material.BASE);
  plot.rect(499, 26, 6, 14, Material.BASE, 1, 0);

  // Lower row mirrors the common contact while retaining independent topology.
  plot.roundedRect(50, 216, 120, 128, 22, Material.C4);
  plot.eraseRect(65, 260, 10, 16);
  plot.roundedRect(246, 216, 120, 128, 22, Material.BGLA);
  plot.eraseRect(246, 266, 12, 20);
  plot.roundedRect(442, 216, 120, 128, 22, Material.Quartz);
  plot.rect(499, 344, 6, 14, Material.Quartz, 1, 0);
}

/** A paused, deterministic material atlas for visual regression screenshots. */
export function applyRenderLabScene(simulation: SimulationBackend): void {
  simulation.clear();
  const plot = new ScenePlotter(simulation);

  // Powder density ramp: isolated grains through a packed sand mass.
  const powderDensity = [0.16, 0.30, 0.48, 0.70, 0.94];
  powderDensity.forEach((density, band) => {
    plot.rect(18 + band * 31, 20, 29, 118, Material.Sand, density, 101 + band);
  });
  plot.rect(18, 112, 153, 26, Material.Dust, 0.18, 151);
  plot.rect(112, 112, 59, 26, Material.Salt, 0.22, 157);
  // Replace the densest band's centre after the crossing Dust/Salt layers so
  // the full height remains authoritative Clay/Concrete. Side notches and
  // ledges exercise the Smooth-vs-Local contract without an idealized heap.
  plot.eraseRect(141, 20, 30, 118);
  plot.rect(143, 27, 11, 111, Material.Clay, 1, 0);
  plot.rect(158, 39, 11, 99, Material.Concrete, 1, 0);
  plot.eraseRect(143, 61, 3, 4);
  plot.eraseRect(151, 91, 3, 5);
  plot.eraseRect(158, 72, 3, 4);
  plot.eraseRect(166, 108, 3, 5);
  plot.rect(140, 132, 17, 6, Material.Clay, 1, 0);
  plot.rect(155, 132, 17, 6, Material.Concrete, 1, 0);
  // A shallow, exact settled slope exposes one-cell sawtooth silhouettes that
  // round isolated-grain tests and vertical density bands cannot reveal.
  plot.slope(18, 141, 153, 9, Material.Sand);

  // Liquids: dense cores, sparse shores, a second liquid, and a hard solid boundary.
  plot.ellipse(238, 79, 56, 58, Material.Water, 0.98, 211, 0.17);
  plot.ellipse(289, 87, 43, 48, Material.Oil, 0.90, 223, 0.12);
  plot.ellipse(332, 62, 24, 31, Material.Acid, 0.82, 227, 0.24);
  plot.rect(188, 136, 172, 7, Material.Wall, 1, 229);
  plot.scatterLine(192, 153, 164, Material.Water, 0.10, 233);

  // Gas mixtures: overlapping density-falloff clouds plus a sparse control row.
  plot.ellipse(420, 76, 55, 51, Material.Smoke, 0.84, 307, 0.58);
  plot.ellipse(486, 72, 56, 47, Material.Oxygen, 0.72, 311, 0.64);
  plot.ellipse(544, 88, 45, 39, Material.NobleGas, 0.60, 313, 0.70);
  // Compact warm and cool field lights graze opposite cloud flanks without
  // reading as full-height UI rails in the canonical visual fixture.
  // The second cool strip also gives Water a deterministic reflected-light
  // flank while the existing warm strip lights Acid from the opposite side.
  plot.rect(180, 68, 2, 17, Material.GRVT, 0.82, 314);
  plot.rect(357, 68, 5, 17, Material.Fire, 0.82, 315);
  plot.rect(592, 80, 2, 17, Material.GRVT, 0.82, 316);
  // Sparse pitch-four gas chains must merge into wisps without filling their
  // authored 16-cell centre gap. Separate families keep colour ownership and
  // let the composed gate distinguish volume continuity from semantic beads.
  plot.sparseGasChain(382, 145, Material.Smoke);
  plot.sparseGasChain(449, 145, Material.FOG);
  plot.sparseGasChain(516, 145, Material.CFLM);
  // Generic soot and emissive gas exercise paths that Smoke and clean gases do
  // not cover. Their compact volumes also expose over-wide bloom at a glance.
  plot.ellipse(430, 171, 37, 13, Material.FOG, 0.76, 331, 0.42);
  plot.ellipse(520, 171, 37, 13, Material.CFLM, 0.70, 337, 0.42);

  // Exact split capsule: deterministic curved liquid endcaps plus an unlike-
  // species seam, isolated from the stochastic ellipses and wavy columns.
  plot.splitCapsule(266, 160, 74, 25, 12, 302, Material.Water, Material.Oil);
  // Matched native-wall calibration cards stay wholly inside the exact capsule
  // shoulders while leaving the unlike-liquid seam on its original neutral
  // backdrop. Water and Oil may bend only the analytic pattern coordinate; the
  // contour, species interface, wall ID, and both semantic planes remain
  // authoritative and independently testable.
  plot.wallPatternRect(278, 160, 18, 25, 6);
  plot.wallPatternRect(309, 160, 19, 25, 6);

  // Contact capsules keep unlike materials exclusive while exercising one
  // shared curved phase silhouette and a deliberately curved internal seam.
  plot.contactCapsule(18, 160, 74, 25, 12, 54, Material.Sand, Material.Salt);
  plot.contactCapsule(104, 160, 74, 25, 12, 140, Material.Metal, Material.Glass);
  // A real independent wall plane sits behind both halves. Opaque Metal is the
  // matched control; Glass must bend the alternating native-wall pattern while
  // preserving this capsule's exact semantic silhouette.
  plot.wallPatternRect(116, 164, 50, 17, 6);

  // Isolated controls catch accidental field widening and preserve the visual
  // contract that one powder grain is round while one droplet remains sparse.
  plot.rect(190, 164, 1, 1, Material.Water, 1, 0);
  plot.rect(190, 176, 1, 1, Material.Sand, 1, 0);

  // Sand entering water: a stable paused mixture and a crisp wall reference.
  plot.rect(18, 192, 165, 154, Material.Water, 0.90, 401);
  plot.gradientRect(18, 192, 165, 86, Material.Sand, 0.86, 0.12, 409);
  plot.rect(18, 344, 165, 8, Material.Wall, 1, 419);
  plot.mixture(74, 251, 64, 64, Material.Sand, Material.Water, 0.78, 421);

  // Adjacent liquid families make boundary bleeding and over-blur obvious.
  const liquids = [Material.Water, Material.Oil, Material.Acid, Material.Lava];
  liquids.forEach((material, column) => {
    plot.wavyColumn(205 + column * 39, 194, 38, 151, material, 503 + column * 7);
  });
  // Authoritative Lava plus one reconstructed empty pinhole is an exact optical
  // no-op control. It catches accidental inheritance of generic liquid optics
  // where the density field cannot prove molten/emissive species ownership.
  plot.rect(329, 220, 22, 22, Material.Lava, 1, 0);
  plot.eraseRect(340, 231, 1, 1);
  plot.wallPatternRect(329, 220, 22, 22, 6);
  plot.rect(202, 344, 160, 8, Material.Wall, 1, 541);

  // Profile matrix: six compact rows expose every family plus dedicated neutral
  // and radioactive energy cores beside warm/cool scene-light sources.
  RENDER_LAB_STYLE_SAMPLES.forEach((material, index) => {
    const column = index % 5;
    const row = Math.floor(index / 5);
    const x = 388 + column * 40;
    const y = 194 + row * 25;
    if (RENDER_LAB_ENERGY_SAMPLES.some((candidate) => candidate === material)) {
      // Dense energy remains authoritative at the existing sample centres, but
      // rounded shoulders now expose core/silhouette styling without a box edge.
      plot.roundedRect(x, y, 35, 21, 8, material);
    }
    else if (material === Material.Metal || material === Material.Plant || material === Material.DTEC) {
      plot.curvaturePlate(x, y, 35, 21, 6, material);
    }
    else plot.rect(x, y, 35, 21, material, 0.90, 601 + index);
  });
  // Narrow separator lights prove that dense translucent bodies transmit the
  // existing emission field instead of reading as pale matte tiles. They do
  // not overlap the Glass/Ice semantic cells or the neighbouring opaque tiles.
  plot.rect(424, 221, 3, 17, Material.Fire, 1, 0);
  plot.rect(544, 221, 3, 17, Material.ELEC, 1, 0);
  // Glass and Ice receive the same continuous asymmetric calibration card. It
  // reaches the semantic shoulder so the composed gate can prove that the
  // material boundary bends the card rather than merely tinting its core. The
  // earlier Metal/Glass contact capsule supplies the matched opaque control;
  // keeping this Metal plate wall-free also isolates its curvature proof.
  plot.wallPatternRect(428, 219, 35, 21, 6);
  plot.wallPatternRect(508, 219, 35, 21, 6);
  // Equal-height warm/cool sources expose how each family responds to coloured
  // scene light. The centre column remains a lower-light comparison surface.
  plot.rect(377, 194, 5, 147, Material.Fire, 0.78, 677);
  plot.rect(592, 194, 5, 147, Material.ELEC, 0.78, 683);
  plot.scatterLine(390, 354, 196, Material.PHOT, 0.18, 701);

  // Exact cross-phase contacts isolate presentation grounding from bulk-field
  // lighting. Their curved internal seams exercise liquid/rigid, oily/glassy,
  // and settled-powder/liquid pairs without changing either material's support.
  plot.contactCapsule(358, 360, 70, 19, 9, 393, Material.Water, Material.Metal);
  plot.contactCapsule(438, 360, 70, 19, 9, 473, Material.Oil, Material.Glass);
  plot.contactCapsule(518, 360, 70, 19, 9, 553, Material.Sand, Material.Water);

  // Paired cold/ambient/hot interiors exercise temperature styling without
  // coupling the native semantic smoke tests to this deterministic fixture.
  if (supportsFixtureTemperatures(simulation)) {
    const temperatures = [
      RENDER_LAB_COLD_TEMPERATURE,
      RENDER_LAB_AMBIENT_TEMPERATURE,
      RENDER_LAB_HOT_TEMPERATURE,
    ] as const;
    for (let state = 0; state < temperatures.length; state++) {
      const metalX = 18 + state * 40;
      const sandX = 154 + state * 40;
      plot.rect(metalX, 362, 24, 17, Material.Metal, 1, 0);
      plot.rect(sandX, 362, 24, 17, Material.Sand, 1, 0);
      simulation.setFixtureTemperatureRect(metalX, 362, 24, 17, temperatures[state]);
      simulation.setFixtureTemperatureRect(sandX, 362, 24, 17, temperatures[state]);
    }
    // Wall-free ambient translucent plates isolate body exposure and macro
    // relief from the independent patterned-backdrop/refraction fixtures.
    plot.rect(278, 362, 24, 17, Material.Glass, 1, 0);
    plot.rect(318, 362, 24, 17, Material.Ice, 1, 0);
    simulation.setFixtureTemperatureRect(278, 362, 24, 17, RENDER_LAB_AMBIENT_TEMPERATURE);
    simulation.setFixtureTemperatureRect(318, 362, 24, 17, RENDER_LAB_AMBIENT_TEMPERATURE);
    // Existing native-wall Glass/Ice cards also prove that Canvas and WebGL
    // apply the same source-alpha-weighted tint over an independent backdrop.
    simulation.setFixtureTemperatureRect(428, 219, 35, 21, RENDER_LAB_HOT_TEMPERATURE);
    simulation.setFixtureTemperatureRect(508, 219, 35, 21, RENDER_LAB_COLD_TEMPERATURE);
  }
}

interface FixtureTemperatureBackend {
  setFixtureTemperatureRect(
    x: number, y: number, width: number, height: number, temperature: number,
  ): void;
}

function supportsFixtureTemperatures(
  simulation: SimulationBackend,
): simulation is SimulationBackend & FixtureTemperatureBackend {
  return typeof (simulation as Partial<FixtureTemperatureBackend>).setFixtureTemperatureRect === 'function';
}

class ScenePlotter {
  constructor(private readonly simulation: SimulationBackend) {}

  eraseRect(x: number, y: number, width: number, height: number): void {
    for (let py = y; py < y + height; py++) for (let px = x; px < x + width; px++) {
      this.simulation.erase(px, py, 0);
    }
  }

  wallPatternRect(x: number, y: number, width: number, height: number, wall: number): void {
    if (!this.simulation.paintWall) return;
    const right = x + width;
    const bottom = y + height;
    for (let py = y; py < bottom; py += 4) for (let px = x; px < right; px += 4) {
      this.simulation.paintWall(px, py, wall, 0);
    }
  }

  rect(x: number, y: number, width: number, height: number, material: Material, density: number, salt: number): void {
    for (let py = y; py < y + height; py++) for (let px = x; px < x + width; px++) {
      if (noise(px, py, salt) <= density) this.set(px, py, material);
    }
  }

  gradientRect(x: number, y: number, width: number, height: number, material: Material, dense: number, sparse: number, salt: number): void {
    for (let py = y; py < y + height; py++) {
      const progress = (py - y) / Math.max(1, height - 1);
      const density = dense + (sparse - dense) * progress;
      for (let px = x; px < x + width; px++) if (noise(px, py, salt) <= density) this.set(px, py, material);
    }
  }

  slope(x: number, y: number, width: number, height: number, material: Material): void {
    for (let offsetX = 0; offsetX < width; offsetX++) {
      const top = y + height - 1 - Math.round(offsetX * (height - 1) / Math.max(1, width - 1));
      for (let py = top; py < y + height; py++) this.set(x + offsetX, py, material);
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, material: Material, density: number, salt: number, edgeFalloff: number): void {
    for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
      const distance = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2);
      if (distance > 1) continue;
      const edge = Math.min(1, Math.max(0, (1 - distance) / Math.max(0.001, edgeFalloff)));
      if (noise(x, y, salt) <= density * edge) this.set(x, y, material);
    }
  }

  mixture(x: number, y: number, width: number, height: number, first: Material, second: Material, density: number, salt: number): void {
    for (let py = y; py < y + height; py++) for (let px = x; px < x + width; px++) {
      const value = noise(px, py, salt);
      if (value > density) continue;
      this.set(px, py, noise(px, py, salt + 97) < 0.5 ? first : second);
    }
  }

  sparseGasChain(x: number, y: number, material: Material): void {
    for (const offset of [0, 4, 8, 12, 16, 20, 36, 40, 44, 48, 52, 56]) {
      this.set(x + offset, y, material);
    }
  }

  wavyColumn(x: number, y: number, width: number, height: number, material: Material, salt: number): void {
    for (let py = y; py < y + height; py++) {
      const inset = Math.round(2.5 + Math.sin(py * 0.13 + salt) * 2.5);
      for (let px = x + inset; px < x + width - inset; px++) {
        if (noise(px, py, salt) <= 0.94) this.set(px, py, material);
      }
    }
  }

  roundedRect(
    x: number, y: number, width: number, height: number, radius: number, material: Material,
  ): void {
    const right = x + width - 1;
    const bottom = y + height - 1;
    const innerLeft = x + radius;
    const innerRight = right - radius;
    const innerTop = y + radius;
    const innerBottom = bottom - radius;
    const radiusSquared = radius * radius;
    for (let py = y; py <= bottom; py++) for (let px = x; px <= right; px++) {
      const nearestX = Math.max(innerLeft, Math.min(innerRight, px));
      const nearestY = Math.max(innerTop, Math.min(innerBottom, py));
      const dx = px - nearestX;
      const dy = py - nearestY;
      if (dx * dx + dy * dy <= radiusSquared) this.set(px, py, material);
    }
  }

  curvaturePlate(
    x: number, y: number, width: number, height: number, radius: number, material: Material,
  ): void {
    this.roundedRect(x, y, width, height, radius, material);
    const right = x + width - 1;
    const centreY = y + Math.floor(height / 2);
    const notchRadius = 5;
    for (let py = centreY - notchRadius; py <= centreY + notchRadius; py++) {
      for (let px = right - notchRadius; px <= right; px++) {
        const dx = px - (right + 1);
        const dy = py - centreY;
        if (dx * dx + dy * dy <= notchRadius * notchRadius) {
          this.simulation.erase(px, py, 0);
        }
      }
    }
  }

  splitCapsule(
    x: number, y: number, width: number, height: number, radius: number, splitX: number,
    leftMaterial: Material, rightMaterial: Material,
  ): void {
    const right = x + width - 1;
    const bottom = y + height - 1;
    const innerLeft = x + radius;
    const innerRight = right - radius;
    const centerY = y + Math.floor((height - 1) / 2);
    const radiusSquared = radius * radius;
    for (let py = y; py <= bottom; py++) for (let px = x; px <= right; px++) {
      const nearestX = Math.max(innerLeft, Math.min(innerRight, px));
      const dx = px - nearestX;
      const dy = py - centerY;
      if (dx * dx + dy * dy <= radiusSquared) {
        this.set(px, py, px <= splitX ? leftMaterial : rightMaterial);
      }
    }
  }

  contactCapsule(
    x: number, y: number, width: number, height: number, radius: number, splitX: number,
    leftMaterial: Material, rightMaterial: Material,
  ): void {
    const right = x + width - 1;
    const bottom = y + height - 1;
    const innerLeft = x + radius;
    const innerRight = right - radius;
    const centerY = y + Math.floor((height - 1) / 2);
    const radiusSquared = radius * radius;
    for (let py = y; py <= bottom; py++) {
      const contactX = splitX + Math.round(Math.sin((py - centerY) * 0.42) * 3);
      for (let px = x; px <= right; px++) {
        const nearestX = Math.max(innerLeft, Math.min(innerRight, px));
        const dx = px - nearestX;
        const dy = py - centerY;
        if (dx * dx + dy * dy <= radiusSquared) {
          this.set(px, py, px <= contactX ? leftMaterial : rightMaterial);
        }
      }
    }
  }

  scatterLine(x: number, y: number, width: number, material: Material, density: number, salt: number): void {
    for (let px = x; px < x + width; px++) for (let py = y - 3; py <= y + 3; py++) {
      if (noise(px, py, salt) <= density) this.set(px, py, material);
    }
  }

  private set(x: number, y: number, material: Material): void {
    if (x < 0 || y < 0 || x >= this.simulation.width || y >= this.simulation.height) return;
    this.simulation.paint(x, y, material, 0);
  }
}

function noise(x: number, y: number, salt: number): number {
  let value = Math.imul(x + salt, 0x9E3779B1) ^ Math.imul(y - salt, 0x85EBCA77);
  value = Math.imul(value ^ (value >>> 15), 0xC2B2AE3D);
  return ((value ^ (value >>> 16)) >>> 0) / 0xFFFFFFFF;
}
