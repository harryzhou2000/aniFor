import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;

export interface TranslucentEdgeVfxPoint { readonly x: number; readonly y: number }
export interface TranslucentEdgeVfxRect extends TranslucentEdgeVfxPoint {
  readonly width: number;
  readonly height: number;
}

export interface TranslucentEdgeVfxPane {
  readonly code: 'GLAS_A' | 'ICE_A' | 'GLAS_B' | 'ICE_B';
  readonly material: Material.Glass | Material.Ice;
  /** Broad exact-owner pane; its left-side bands span depth bytes 12 through 60. */
  readonly body: TranslucentEdgeVfxRect;
  /** Large semantic void that must stay empty rather than becoming a body optic. */
  readonly authoredHole: TranslucentEdgeVfxRect;
  /** Large open air cutout from the pane's right edge. */
  readonly openNotch: TranslucentEdgeVfxRect;
  /** Attached one-cell categorical control, deliberately outside the broad body. */
  readonly attachedLine: TranslucentEdgeVfxRect;
  readonly isolated: TranslucentEdgeVfxPoint;
  /** One enclosed empty semantic cell that normal contour support may reconstruct. */
  readonly reconstructableCavity: TranslucentEdgeVfxPoint;
  /** Protected first interior layer, exact optical-depth byte 6. */
  readonly firstInnerLayer: TranslucentEdgeVfxRect;
  /** Near-side exact-owner target, optical-depth bytes 12--30. */
  readonly edgeBand: TranslucentEdgeVfxRect;
  /** Exact-owner fade target spanning optical-depth bytes 36--60. */
  readonly depthBand: TranslucentEdgeVfxRect;
  /** A well-separated deep bulk sample that distinguishes edge response from grading. */
  readonly deepCore: TranslucentEdgeVfxRect;
}

export interface TranslucentEdgeVfxWallControl {
  readonly body: TranslucentEdgeVfxRect;
  /** Four-cell aligned native-wall origin used by the render-lab bmap proxy. */
  readonly wallAnchor: TranslucentEdgeVfxPoint;
  /** Interior cell guaranteed to be co-located with both exact matter and wall. */
  readonly probe: TranslucentEdgeVfxPoint;
}

export interface TranslucentEdgeVfxAuditSnapshot {
  readonly panes: readonly TranslucentEdgeVfxPane[];
  readonly unlikeSeam: {
    readonly glass: TranslucentEdgeVfxRect;
    readonly ice: TranslucentEdgeVfxRect;
    /** First Ice cell at the exact Glass/Ice material seam. */
    readonly probe: TranslucentEdgeVfxPoint;
  };
  readonly controls: {
    readonly opaqueMetal: TranslucentEdgeVfxRect;
    /** Static emitter-trait owner; it must not inherit translucent treatment. */
    readonly emitterTrait: TranslucentEdgeVfxRect;
    /** Material-emissive owner; it must not inherit translucent treatment. */
    readonly emissiveFire: TranslucentEdgeVfxRect;
    readonly glassWall: TranslucentEdgeVfxWallControl;
    readonly iceWall: TranslucentEdgeVfxWallControl;
    readonly guardedBlank: TranslucentEdgeVfxRect;
  };
  readonly conductiveWall: number;
}

const pane = (
  code: TranslucentEdgeVfxPane['code'],
  material: TranslucentEdgeVfxPane['material'],
  x: number,
  y: number,
): TranslucentEdgeVfxPane => {
  const body = { x, y, width: 152, height: 116 };
  return {
    code,
    material,
    body,
    authoredHole: { x: x + 72, y: y + 50, width: 12, height: 12 },
    openNotch: { x: x + 140, y: y + 76, width: 12, height: 12 },
    attachedLine: { x: x + 30, y: y + body.height, width: 1, height: 36 },
    isolated: { x: x + 186, y: y + 154 },
    reconstructableCavity: { x: x + 48, y: y + 88 },
    firstInnerLayer: { x: x + 1, y: y + 18, width: 1, height: 44 },
    edgeBand: { x: x + 2, y: y + 18, width: 4, height: 44 },
    depthBand: { x: x + 6, y: y + 18, width: 5, height: 44 },
    deepCore: { x: x + 104, y: y + 22, width: 24, height: 34 },
  };
};

/**
 * Paused exact-owner scene for E10's Glass/Ice edge-transmission study.
 *
 * It deliberately provides no emitter/source geometry.  E10 uses the existing
 * analytic body light, so this fixture can distinguish a local edge response
 * from a blanket scene grade with same-owner depth bands and remote controls.
 */
export const TRANSLUCENT_EDGE_VFX_AUDIT: TranslucentEdgeVfxAuditSnapshot = {
  panes: [
    pane('GLAS_A', Material.Glass, 24, 18),
    pane('ICE_A', Material.Ice, 324, 18),
    pane('GLAS_B', Material.Glass, 24, 196),
    pane('ICE_B', Material.Ice, 324, 196),
  ],
  unlikeSeam: {
    glass: { x: 208, y: 92, width: 32, height: 40 },
    ice: { x: 240, y: 92, width: 32, height: 40 },
    probe: { x: 240, y: 112 },
  },
  controls: {
    opaqueMetal: { x: 208, y: 20, width: 32, height: 24 },
    emitterTrait: { x: 244, y: 20, width: 24, height: 24 },
    emissiveFire: { x: 276, y: 20, width: 24, height: 24 },
    glassWall: {
      body: { x: 208, y: 52, width: 32, height: 24 },
      wallAnchor: { x: 208, y: 52 },
      probe: { x: 220, y: 60 },
    },
    iceWall: {
      body: { x: 272, y: 52, width: 32, height: 24 },
      wallAnchor: { x: 272, y: 52 },
      probe: { x: 284, y: 60 },
    },
    guardedBlank: { x: 208, y: 140, width: 96, height: 28 },
  },
  conductiveWall: CONDUCTIVE_WALL,
};

interface TranslucentEdgeVfxFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
}

/** Direct-fills the paused render lab; never route E10 fixture setup through a brush ABI. */
export function prepareTranslucentEdgeVfxAudit(simulation: SimulationBackend): void {
  if (!supportsTranslucentEdgeVfxFixture(simulation)) {
    throw new Error('Translucent edge VFX fixture requires the render-lab native wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Translucent edge VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of TRANSLUCENT_EDGE_VFX_AUDIT.panes) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.authoredHole, Material.Empty);
    fillRect(cells, simulation.width, entry.openNotch, Material.Empty);
    fillRect(cells, simulation.width, entry.attachedLine, entry.material);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    cells[entry.reconstructableCavity.y * simulation.width + entry.reconstructableCavity.x] = Material.Empty;
  }

  const { unlikeSeam, controls } = TRANSLUCENT_EDGE_VFX_AUDIT;
  fillRect(cells, simulation.width, unlikeSeam.glass, Material.Glass);
  fillRect(cells, simulation.width, unlikeSeam.ice, Material.Ice);
  fillRect(cells, simulation.width, controls.opaqueMetal, Material.Metal);
  fillRect(cells, simulation.width, controls.emitterTrait, Material.CLNE);
  fillRect(cells, simulation.width, controls.emissiveFire, Material.Fire);
  fillWallControl(simulation, cells, controls.glassWall, Material.Glass);
  fillWallControl(simulation, cells, controls.iceWall, Material.Ice);
  fillRect(cells, simulation.width, controls.guardedBlank, Material.Empty);
}

function supportsTranslucentEdgeVfxFixture(
  simulation: SimulationBackend,
): simulation is TranslucentEdgeVfxFixtureBackend {
  const candidate = simulation as Partial<TranslucentEdgeVfxFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillWallControl(
  simulation: TranslucentEdgeVfxFixtureBackend,
  cells: Uint8Array,
  control: TranslucentEdgeVfxWallControl,
  material: Material.Glass | Material.Ice,
): void {
  fillRect(cells, simulation.width, control.body, material);
  for (let y = control.body.y; y < control.body.y + control.body.height; y += 4) {
    for (let x = control.body.x; x < control.body.x + control.body.width; x += 4) {
      simulation.paintWall(x, y, CONDUCTIVE_WALL, 0);
    }
  }
}

function fillRect(cells: Uint8Array, width: number, rect: TranslucentEdgeVfxRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}
