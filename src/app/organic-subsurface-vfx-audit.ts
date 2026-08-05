import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const ORGANIC_SUBSURFACE_VFX_WORLD_WIDTH = 612;
export const ORGANIC_SUBSURFACE_VFX_WORLD_HEIGHT = 384;
export const ORGANIC_SUBSURFACE_VFX_CONDUCTIVE_WALL = 1;
export const ORGANIC_SUBSURFACE_VFX_HYDRATED_PLNT_STATE = 0xEEC1;
export const ORGANIC_SUBSURFACE_VFX_DORMANT_PLNT_STATE = 0x8000;
export const ORGANIC_SUBSURFACE_VFX_ACTIVE_DRY_PLNT_STATE = 0xC000;
export const ORGANIC_SUBSURFACE_VFX_HYDRATED_NON_TREE_PLNT_STATE = 0xB000;
export const ORGANIC_SUBSURFACE_VFX_HYDRATED_NO_PRESENT_PLNT_STATE = 0x3000;
export const ORGANIC_SUBSURFACE_VFX_HYDRATED_SEED_STATE = 0x4008;
export const ORGANIC_SUBSURFACE_VFX_DRY_SEED_STATE = 0;

export interface OrganicSubsurfaceVfxPoint { readonly x: number; readonly y: number }
export interface OrganicSubsurfaceVfxRect extends OrganicSubsurfaceVfxPoint {
  readonly width: number;
  readonly height: number;
}

export interface OrganicSubsurfaceVfxPane {
  readonly code: 'WAX' | 'PLNT';
  readonly material: Material.Wax | Material.Plant;
  /** Native presentation state carried by every owned cell in the body. */
  readonly presentationState: number;
  /** Broad exact-owner body with a protected first-depth layer and deep core. */
  readonly body: OrganicSubsurfaceVfxRect;
  /** Authored semantic void: state must be zero as well as matter Empty. */
  readonly authoredHole: OrganicSubsurfaceVfxRect;
  /** Open air cutout from the body's right edge, also clear of native state. */
  readonly openNotch: OrganicSubsurfaceVfxRect;
  /** Attached one-cell-wide control outside the broad body. */
  readonly attachedLine: OrganicSubsurfaceVfxRect;
  readonly isolated: OrganicSubsurfaceVfxPoint;
  /** Exact optical-depth byte 6. */
  readonly firstInnerLayer: OrganicSubsurfaceVfxRect;
  /** Exact optical-depth bytes 12--30. */
  readonly edgeBand: OrganicSubsurfaceVfxRect;
  /** Exact optical-depth bytes 36--66, including the accepted fade terminus. */
  readonly depthBand: OrganicSubsurfaceVfxRect;
  /** Exact optical-depth byte 66, sampled independently from the aggregate fade. */
  readonly fadeTip: OrganicSubsurfaceVfxPoint;
  /** Protected bulk core at or beyond E11's exact no-op depth byte 72. */
  readonly deepCore: OrganicSubsurfaceVfxRect;
}

export interface OrganicSubsurfaceVfxStateControl {
  readonly body: OrganicSubsurfaceVfxRect;
  readonly material: Material;
  readonly presentationState: number;
  readonly probe: OrganicSubsurfaceVfxPoint;
}

export interface OrganicSubsurfaceVfxWallControl extends OrganicSubsurfaceVfxStateControl {
  /** Four-cell aligned origin required by the RenderLab native-wall proxy. */
  readonly wallAnchor: OrganicSubsurfaceVfxPoint;
}

export interface OrganicSubsurfaceVfxDirectSeam {
  readonly left: OrganicSubsurfaceVfxStateControl;
  readonly right: OrganicSubsurfaceVfxStateControl;
  /** The exact left-owner boundary cell; its solid-depth byte must remain zero. */
  readonly leftBoundaryProbe: OrganicSubsurfaceVfxPoint;
}

export interface OrganicSubsurfaceVfxAuditSnapshot {
  readonly panes: readonly OrganicSubsurfaceVfxPane[];
  readonly directUnlikeSeams: readonly OrganicSubsurfaceVfxDirectSeam[];
  readonly controls: {
    readonly moltenWax: OrganicSubsurfaceVfxStateControl;
    readonly hydratedSeed: OrganicSubsurfaceVfxStateControl;
    readonly drySeed: OrganicSubsurfaceVfxStateControl;
    /** Presence-only PLNT; it is intentionally not hydrated or active. */
    readonly dormantPlant: OrganicSubsurfaceVfxStateControl;
    /** Native activity without hydration must remain a subsurface no-op. */
    readonly activeDryPlant: OrganicSubsurfaceVfxStateControl;
    /** Positive E11 discriminator: present, hydrated, non-tree PLNT. */
    readonly hydratedNonTreePlant: OrganicSubsurfaceVfxStateControl;
    /** Hydration bits without the exact owner-present marker are ineligible. */
    readonly hydratedNoPresentPlant: OrganicSubsurfaceVfxStateControl;
    /** Exact PLNT owner with a zero native state. */
    readonly zeroStatePlant: OrganicSubsurfaceVfxStateControl;
    /** A non-PLNT owner carrying an otherwise eligible PLNT state. */
    readonly wrongOwner: OrganicSubsurfaceVfxStateControl;
    readonly emitterTrait: OrganicSubsurfaceVfxStateControl;
    /** Time-invariant emissive foreign phase; avoids animated Energy alpha in the fixture. */
    readonly emissiveLava: OrganicSubsurfaceVfxStateControl;
    readonly waxWall: OrganicSubsurfaceVfxWallControl;
    readonly plantWall: OrganicSubsurfaceVfxWallControl;
    readonly guardedBlank: OrganicSubsurfaceVfxRect;
  };
  readonly conductiveWall: number;
}

const pane = (
  code: OrganicSubsurfaceVfxPane['code'],
  material: OrganicSubsurfaceVfxPane['material'],
  presentationState: number,
  x: number,
  y: number,
): OrganicSubsurfaceVfxPane => {
  const body = { x, y, width: 152, height: 116 };
  return {
    code,
    material,
    presentationState,
    body,
    authoredHole: { x: x + 72, y: y + 50, width: 12, height: 12 },
    openNotch: { x: x + 140, y: y + 76, width: 12, height: 12 },
    attachedLine: { x: x + 30, y: y + body.height, width: 1, height: 36 },
    isolated: { x: x + 186, y: y + 154 },
    firstInnerLayer: { x: x + 1, y: y + 18, width: 1, height: 44 },
    edgeBand: { x: x + 2, y: y + 18, width: 4, height: 44 },
    depthBand: { x: x + 6, y: y + 18, width: 6, height: 44 },
    fadeTip: { x: x + 11, y: y + 40 },
    deepCore: { x: x + 104, y: y + 22, width: 24, height: 34 },
  };
};

const stateControl = (
  x: number,
  y: number,
  material: Material,
  presentationState: number,
): OrganicSubsurfaceVfxStateControl => ({
  body: { x, y, width: 32, height: 24 }, material, presentationState,
  probe: { x: x + 12, y: y + 12 },
});

/**
 * Paused exact-owner fixture for E11 organic solid subsurface response.
 *
 * WAX is a state-free solid baseline. PLNT uses the public native projection
 * 0xEEC1 (present, active, hydrated tree) while independent controls separate
 * hydration/presence state from owner, phase, trait, emission, walls, and seams.
 */
export const ORGANIC_SUBSURFACE_VFX_AUDIT: OrganicSubsurfaceVfxAuditSnapshot = {
  panes: [
    pane('WAX', Material.Wax, 0, 24, 24),
    pane('PLNT', Material.Plant, ORGANIC_SUBSURFACE_VFX_HYDRATED_PLNT_STATE, 224, 24),
  ],
  directUnlikeSeams: [
    {
      left: { ...stateControl(412, 144, Material.Wax, 0), body: { x: 412, y: 144, width: 20, height: 24 } },
      right: { ...stateControl(432, 144, Material.MWAX, 0), body: { x: 432, y: 144, width: 20, height: 24 } },
      leftBoundaryProbe: { x: 431, y: 156 },
    },
    {
      left: {
        ...stateControl(464, 144, Material.Plant, ORGANIC_SUBSURFACE_VFX_HYDRATED_PLNT_STATE),
        body: { x: 464, y: 144, width: 20, height: 24 },
      },
      right: {
        ...stateControl(484, 144, Material.Metal, ORGANIC_SUBSURFACE_VFX_HYDRATED_PLNT_STATE),
        body: { x: 484, y: 144, width: 20, height: 24 },
      },
      leftBoundaryProbe: { x: 483, y: 156 },
    },
  ],
  controls: {
    moltenWax: stateControl(412, 24, Material.MWAX, 0),
    hydratedSeed: stateControl(452, 24, Material.SEED, ORGANIC_SUBSURFACE_VFX_HYDRATED_SEED_STATE),
    drySeed: stateControl(492, 24, Material.SEED, ORGANIC_SUBSURFACE_VFX_DRY_SEED_STATE),
    dormantPlant: stateControl(532, 24, Material.Plant, ORGANIC_SUBSURFACE_VFX_DORMANT_PLNT_STATE),
    activeDryPlant: stateControl(572, 24, Material.Plant, ORGANIC_SUBSURFACE_VFX_ACTIVE_DRY_PLNT_STATE),
    hydratedNonTreePlant: {
      ...stateControl(
        412, 60, Material.Plant, ORGANIC_SUBSURFACE_VFX_HYDRATED_NON_TREE_PLNT_STATE,
      ),
      // Four cells inside the body: exact depth byte 24, inside E11's shell.
      probe: { x: 416, y: 72 },
    },
    zeroStatePlant: stateControl(452, 60, Material.Plant, 0),
    wrongOwner: stateControl(492, 60, Material.Metal, ORGANIC_SUBSURFACE_VFX_HYDRATED_PLNT_STATE),
    emitterTrait: stateControl(532, 60, Material.CLNE, ORGANIC_SUBSURFACE_VFX_HYDRATED_PLNT_STATE),
    hydratedNoPresentPlant: stateControl(
      572, 60, Material.Plant, ORGANIC_SUBSURFACE_VFX_HYDRATED_NO_PRESENT_PLNT_STATE,
    ),
    emissiveLava: stateControl(412, 92, Material.Lava, 0),
    waxWall: {
      ...stateControl(452, 92, Material.Wax, 0),
      wallAnchor: { x: 452, y: 92 },
    },
    plantWall: {
      ...stateControl(492, 92, Material.Plant, ORGANIC_SUBSURFACE_VFX_HYDRATED_PLNT_STATE),
      wallAnchor: { x: 492, y: 92 },
    },
    guardedBlank: { x: 412, y: 188, width: 160, height: 44 },
  },
  conductiveWall: ORGANIC_SUBSURFACE_VFX_CONDUCTIVE_WALL,
};

interface OrganicSubsurfaceVfxFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  presentationState(): Uint16Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
  setFixturePresentationStateRect(
    x: number, y: number, width: number, height: number, state: number,
  ): void;
  setFixturePresentationState(x: number, y: number, state: number): void;
}

/** Direct-fills paused RenderLab state; never routes E11 setup through brush ABIs. */
export function prepareOrganicSubsurfaceVfxFixture(simulation: SimulationBackend): void {
  if (!supportsOrganicSubsurfaceVfxFixture(simulation)) {
    throw new Error('Organic subsurface VFX fixture requires render-lab wall and state planes');
  }
  if (simulation.width !== ORGANIC_SUBSURFACE_VFX_WORLD_WIDTH
    || simulation.height !== ORGANIC_SUBSURFACE_VFX_WORLD_HEIGHT) {
    throw new Error(
      `Organic subsurface VFX fixture requires ${ORGANIC_SUBSURFACE_VFX_WORLD_WIDTH}x${ORGANIC_SUBSURFACE_VFX_WORLD_HEIGHT}`,
    );
  }

  simulation.clear();
  const cells = simulation.cells();
  for (const entry of ORGANIC_SUBSURFACE_VFX_AUDIT.panes) {
    fillStateRect(simulation, cells, entry.body, entry.material, entry.presentationState);
    fillStateRect(simulation, cells, entry.authoredHole, Material.Empty, 0);
    fillStateRect(simulation, cells, entry.openNotch, Material.Empty, 0);
    fillStateRect(simulation, cells, entry.attachedLine, entry.material, entry.presentationState);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    simulation.setFixturePresentationState(entry.isolated.x, entry.isolated.y, entry.presentationState);
  }

  const { controls, directUnlikeSeams } = ORGANIC_SUBSURFACE_VFX_AUDIT;
  for (const control of [
    controls.moltenWax, controls.hydratedSeed, controls.drySeed, controls.dormantPlant,
    controls.activeDryPlant,
    controls.hydratedNonTreePlant, controls.zeroStatePlant, controls.wrongOwner,
    controls.emitterTrait, controls.hydratedNoPresentPlant, controls.emissiveLava,
  ]) fillStateRect(simulation, cells, control.body, control.material, control.presentationState);
  for (const seam of directUnlikeSeams) {
    fillStateRect(simulation, cells, seam.left.body, seam.left.material, seam.left.presentationState);
    fillStateRect(simulation, cells, seam.right.body, seam.right.material, seam.right.presentationState);
  }
  fillWallControl(simulation, cells, controls.waxWall);
  fillWallControl(simulation, cells, controls.plantWall);
  fillStateRect(simulation, cells, controls.guardedBlank, Material.Empty, 0);
}

function supportsOrganicSubsurfaceVfxFixture(
  simulation: SimulationBackend,
): simulation is OrganicSubsurfaceVfxFixtureBackend {
  const candidate = simulation as Partial<OrganicSubsurfaceVfxFixtureBackend>;
  return typeof candidate.walls === 'function'
    && typeof candidate.presentationState === 'function'
    && typeof candidate.paintWall === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function'
    && typeof candidate.setFixturePresentationState === 'function';
}

function fillWallControl(
  simulation: OrganicSubsurfaceVfxFixtureBackend,
  cells: Uint8Array,
  control: OrganicSubsurfaceVfxWallControl,
): void {
  fillStateRect(simulation, cells, control.body, control.material, control.presentationState);
  for (let y = control.body.y; y < control.body.y + control.body.height; y += 4) {
    for (let x = control.body.x; x < control.body.x + control.body.width; x += 4) {
      simulation.paintWall(x, y, ORGANIC_SUBSURFACE_VFX_CONDUCTIVE_WALL, 0);
    }
  }
}

function fillStateRect(
  simulation: OrganicSubsurfaceVfxFixtureBackend,
  cells: Uint8Array,
  rect: OrganicSubsurfaceVfxRect,
  material: Material,
  state: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * simulation.width + rect.x, y * simulation.width + rect.x + rect.width);
  }
  simulation.setFixturePresentationStateRect(rect.x, rect.y, rect.width, rect.height, state);
}
