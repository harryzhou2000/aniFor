import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { RENDER_LAB_AMBIENT_TEMPERATURE } from '../simulation/render-lab-backend';
import { prepareMaterialShowcaseAtlas } from '../app/material-showcase-atlas-authoring';
import {
  MATERIAL_SHOWCASE_ATLAS_CATALOG,
  MATERIAL_SHOWCASE_SCENE_AUTHORING,
} from '../shared/material-showcase-atlas-catalog.js';
import { prepareMaterialCandidateSurveyAtlas } from '../app/material-candidate-survey-atlas-authoring';
import {
  MATERIAL_CANDIDATE_SURVEY_ATLAS_CATALOG,
} from '../shared/material-candidate-survey-atlas-catalog.js';

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
 * as before/after references; it must not silently alter the E01–E52 ladder.
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
export const MATERIAL_CANDIDATE_SURVEY_AUDIT = (
  MATERIAL_CANDIDATE_SURVEY_ATLAS_CATALOG.audit
) as unknown as MaterialCandidateSurveyAuditSnapshot;

/** Typed renderer compatibility facade for the frozen shared showcase audit. */
export const MATERIAL_SHOWCASE_AUDIT = (
  MATERIAL_SHOWCASE_ATLAS_CATALOG.audit
) as unknown as MaterialShowcaseAuditSnapshot;

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
  prepareMaterialShowcaseAtlas(plot, MATERIAL_SHOWCASE_SCENE_AUTHORING.commands);
}

/**
 * Paused v1 candidate survey. The explicit diagnostic route owns this scene;
 * v6 remains the production composition while this provides a deterministic
 * evidence surface for Nitro/Snow/BASE/C4/BGLA/Quartz comparisons.
 */
export function applyMaterialCandidateSurveyScene(simulation: SimulationBackend): void {
  simulation.clear();
  const plot = new ScenePlotter(simulation);
  prepareMaterialCandidateSurveyAtlas(
    plot,
    MATERIAL_CANDIDATE_SURVEY_ATLAS_CATALOG.commands,
  );
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
