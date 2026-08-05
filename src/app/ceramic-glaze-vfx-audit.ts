import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;
const CARD_ORIGIN_X = 8;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 300;
const CARD_WIDTH = 296;
const CARD_HEIGHT = 368;

const DEFINITIONS = [
  { code: 'BRCK', material: Material.Brick, color: '#a65e4b' },
  { code: 'CRMC', material: Material.Ceramic, color: '#d8d0be' },
] as const;

export interface CeramicGlazeVfxPoint { readonly x: number; readonly y: number }
export interface CeramicGlazeVfxRect extends CeramicGlazeVfxPoint {
  readonly width: number;
  readonly height: number;
}

export interface CeramicGlazeVfxCard {
  readonly code: 'BRCK' | 'CRMC';
  readonly material: Material.Brick | Material.Ceramic;
  readonly color: string;
  readonly card: CeramicGlazeVfxRect;
  /** Broad exact owner that supplies an ordinary-solid optical core. */
  readonly body: CeramicGlazeVfxRect;
  readonly core: CeramicGlazeVfxRect;
  /** Stable body-local probes for E19's static broad glaze crown/pocket pass. */
  readonly crown: CeramicGlazeVfxRect;
  readonly pocket: CeramicGlazeVfxRect;
  readonly authoredHole: CeramicGlazeVfxRect;
  /** A one-cell void open through the body edge. */
  readonly openNotch: CeramicGlazeVfxRect;
  /** Disjoint one-cell-wide owner; it must never become a body. */
  readonly thinLine: CeramicGlazeVfxRect;
  readonly isolated: CeramicGlazeVfxPoint;
  /** Exact owner co-located with a 4x4-aligned native conductive wall plane. */
  readonly wallCoexistence: CeramicGlazeVfxRect;
  /** Direct ordinary owner/Water seam, separate from the foreign Solid seam. */
  readonly waterContact: {
    readonly solid: CeramicGlazeVfxRect;
    readonly water: CeramicGlazeVfxRect;
  };
  /** Direct ordinary owner/Metal seam, separate from the Water contact. */
  readonly unlikeSolid: {
    readonly owner: CeramicGlazeVfxRect;
    readonly metal: CeramicGlazeVfxRect;
  };
  readonly guardedBlank: CeramicGlazeVfxRect;
  /** Non-target semantic controls kept disjoint from all target geometry. */
  readonly controls: {
    readonly sand: CeramicGlazeVfxRect;
    readonly glass: CeramicGlazeVfxRect;
    readonly metal: CeramicGlazeVfxRect;
  };
}

export interface CeramicGlazeVfxAuditSnapshot {
  readonly cards: readonly CeramicGlazeVfxCard[];
  readonly conductiveWall: number;
}

function card(
  definition: (typeof DEFINITIONS)[number], index: number,
): CeramicGlazeVfxCard {
  const x = CARD_ORIGIN_X + index * CARD_STRIDE_X;
  const card = { x, y: CARD_ORIGIN_Y, width: CARD_WIDTH, height: CARD_HEIGHT };
  const body = { x: x + 12, y: CARD_ORIGIN_Y + 16, width: 176, height: 128 };
  return {
    ...definition,
    card,
    body,
    // These named regions are intentionally far from the cavity, notch, and
    // outer silhouette so a future RGB-only finish has fixed semantic probes.
    // The exact Ceramic solid-relief carrier is 2x+y. These compact regions
    // stay inside one signed lobe instead of averaging a crown and pocket into
    // a misleading near-zero fit-view response. Brick mirrors the geometry as
    // a byte-exact owner control; it never enters the E19 shader branch.
    core: { x: body.x + 50, y: body.y + 26, width: 16, height: 14 },
    crown: { x: body.x + 20, y: body.y + 94, width: 10, height: 10 },
    pocket: { x: body.x + 125, y: body.y + 76, width: 10, height: 10 },
    authoredHole: { x: body.x + 72, y: body.y + 44, width: 12, height: 12 },
    openNotch: { x: body.x + body.width - 1, y: body.y + 82, width: 1, height: 14 },
    thinLine: { x: x + 208, y: CARD_ORIGIN_Y + 16, width: 1, height: 96 },
    isolated: { x: x + 214, y: CARD_ORIGIN_Y + 128 },
    // Both card origins and this offset are divisible by four, matching the
    // RenderLab native wall proxy's 4x4 block layout exactly.
    wallCoexistence: { x: x + 240, y: CARD_ORIGIN_Y + 24, width: 28, height: 28 },
    waterContact: {
      solid: { x: x + 20, y: CARD_ORIGIN_Y + 168, width: 40, height: 28 },
      water: { x: x + 60, y: CARD_ORIGIN_Y + 168, width: 40, height: 28 },
    },
    unlikeSolid: {
      owner: { x: x + 124, y: CARD_ORIGIN_Y + 168, width: 40, height: 28 },
      metal: { x: x + 164, y: CARD_ORIGIN_Y + 168, width: 40, height: 28 },
    },
    guardedBlank: { x: x + 20, y: CARD_ORIGIN_Y + 232, width: 180, height: 64 },
    controls: {
      sand: { x: x + 20, y: CARD_ORIGIN_Y + 312, width: 32, height: 28 },
      glass: { x: x + 64, y: CARD_ORIGIN_Y + 312, width: 32, height: 28 },
      metal: { x: x + 108, y: CARD_ORIGIN_Y + 312, width: 32, height: 28 },
    },
  };
}

/**
 * Paused exact-owner fixture for E19's ordinary Ceramic glaze pass, with Brick
 * as its exact reference. It owns semantic topology only; the gate owns VFX.
 */
export const CERAMIC_GLAZE_VFX_AUDIT: CeramicGlazeVfxAuditSnapshot = {
  cards: DEFINITIONS.map(card),
  conductiveWall: CONDUCTIVE_WALL,
};

interface CeramicGlazeFixtureBackend extends SimulationBackend {
  paintWall(x: number, y: number, wall: number, radius: number): void;
  walls(): Uint8Array;
}

/** Direct-fills a paused RenderLab wall-capable backend without a brush or physics step. */
export function prepareCeramicGlazeVfxFixture(simulation: SimulationBackend): void {
  if (!supportsFixture(simulation)) {
    throw new Error('Ceramic glaze VFX fixture requires a RenderLab native wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Ceramic glaze VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of CERAMIC_GLAZE_VFX_AUDIT.cards) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.authoredHole, Material.Empty);
    fillRect(cells, simulation.width, entry.openNotch, Material.Empty);
    fillRect(cells, simulation.width, entry.thinLine, entry.material);
    setPoint(cells, simulation.width, entry.isolated, entry.material);
    fillRect(cells, simulation.width, entry.wallCoexistence, entry.material);
    for (let y = entry.wallCoexistence.y; y < entry.wallCoexistence.y + entry.wallCoexistence.height; y += 4) {
      for (let x = entry.wallCoexistence.x; x < entry.wallCoexistence.x + entry.wallCoexistence.width; x += 4) {
        simulation.paintWall(x, y, CONDUCTIVE_WALL, 0);
      }
    }
    fillRect(cells, simulation.width, entry.waterContact.solid, entry.material);
    fillRect(cells, simulation.width, entry.waterContact.water, Material.Water);
    fillRect(cells, simulation.width, entry.unlikeSolid.owner, entry.material);
    fillRect(cells, simulation.width, entry.unlikeSolid.metal, Material.Metal);
    fillRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
    fillRect(cells, simulation.width, entry.controls.sand, Material.Sand);
    fillRect(cells, simulation.width, entry.controls.glass, Material.Glass);
    fillRect(cells, simulation.width, entry.controls.metal, Material.Metal);
  }
}

function supportsFixture(simulation: SimulationBackend): simulation is CeramicGlazeFixtureBackend {
  const candidate = simulation as Partial<CeramicGlazeFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillRect(cells: Uint8Array, width: number, rect: CeramicGlazeVfxRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function setPoint(cells: Uint8Array, width: number, point: CeramicGlazeVfxPoint, material: Material): void {
  cells[point.y * width + point.x] = material;
}
