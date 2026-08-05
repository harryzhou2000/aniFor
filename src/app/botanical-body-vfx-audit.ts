import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import { encodePlantLifecyclePresentationState } from './botanical-lifecycle-graphics-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;
const CARD_ORIGIN_X = 8;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 300;
const CARD_WIDTH = 296;
const CARD_HEIGHT = 368;

const DEFINITIONS = [
  { code: 'WOOD', material: Material.Wood, color: '#9b6038' },
  { code: 'PLNT', material: Material.Plant, color: '#65a95f' },
] as const;

const LIFECYCLE_STATES = [
  {
    lifecycleKey: 'cyan',
    lifecycleState: encodePlantLifecyclePresentationState(true, 1, 6, 16, 2, true),
  },
  {
    lifecycleKey: 'magenta',
    lifecycleState: encodePlantLifecyclePresentationState(true, 1, 6, 4, 2, true),
  },
] as const;

export interface BotanicalBodyVfxPoint { readonly x: number; readonly y: number }
export interface BotanicalBodyVfxRect extends BotanicalBodyVfxPoint {
  readonly width: number;
  readonly height: number;
}

export interface BotanicalBodyVfxCard {
  readonly code: 'WOOD' | 'PLNT';
  readonly material: Material.Wood | Material.Plant;
  readonly color: string;
  readonly card: BotanicalBodyVfxRect;
  /** Broad exact owner with enough ordinary-solid support for an optical core. */
  readonly body: BotanicalBodyVfxRect;
  readonly core: BotanicalBodyVfxRect;
  /** Stable body-local probes for E20's signed crown and pocket response. */
  readonly crown: BotanicalBodyVfxRect;
  readonly pocket: BotanicalBodyVfxRect;
  /** Authored air entirely enclosed by the broad owner. */
  readonly authoredCavity: BotanicalBodyVfxRect;
  /** A one-cell air channel open through the body's right edge. */
  readonly openNotch: BotanicalBodyVfxRect;
  /** Disjoint one-cell-wide owner: a stem/line must never become a broad body. */
  readonly thinStem: BotanicalBodyVfxRect;
  readonly isolated: BotanicalBodyVfxPoint;
  /** Exact owner co-located with a 4x4-aligned native conductive wall plane. */
  readonly wallCoexistence: BotanicalBodyVfxRect;
  /** Direct ordinary botanical-owner/Water seam. */
  readonly waterContact: {
    readonly owner: BotanicalBodyVfxRect;
    readonly water: BotanicalBodyVfxRect;
  };
  /** Direct ordinary botanical-owner/Sand seam, separate from Water. */
  readonly sandContact: {
    readonly owner: BotanicalBodyVfxRect;
    readonly sand: BotanicalBodyVfxRect;
  };
  /** Reciprocal same-Solid-phase Wood/PLNT seam for unlike-material rejection. */
  readonly unlikeContact: {
    readonly owner: BotanicalBodyVfxRect;
    readonly other: BotanicalBodyVfxRect;
  };
  /** Separate exact PLNT canopy carrying one native inherited-colour state. */
  readonly lifecycleCanopy: BotanicalBodyVfxRect;
  readonly lifecycleProbe: BotanicalBodyVfxRect;
  readonly lifecycleState: number;
  readonly lifecycleKey: 'cyan' | 'magenta';
  readonly guardedBlank: BotanicalBodyVfxRect;
  /** Exact non-target owners kept disjoint from target and contact geometry. */
  readonly controls: {
    readonly vine: BotanicalBodyVfxRect;
    readonly wax: BotanicalBodyVfxRect;
    readonly metal: BotanicalBodyVfxRect;
  };
}

export interface BotanicalBodyVfxAuditSnapshot {
  readonly cards: readonly BotanicalBodyVfxCard[];
  readonly conductiveWall: number;
}

function card(
  definition: (typeof DEFINITIONS)[number], index: number,
): BotanicalBodyVfxCard {
  const x = CARD_ORIGIN_X + index * CARD_STRIDE_X;
  const cardBounds = { x, y: CARD_ORIGIN_Y, width: CARD_WIDTH, height: CARD_HEIGHT };
  const body = { x: x + 12, y: CARD_ORIGIN_Y + 16, width: 176, height: 128 };
  const lifecycleCanopy = {
    x: x + 220, y: CARD_ORIGIN_Y + 168, width: 48, height: 40,
  };
  const lifecycle = LIFECYCLE_STATES[index];
  return {
    ...definition,
    ...lifecycle,
    card: cardBounds,
    body,
    // All three probes remain deep exact owners, away from the cavity, notch,
    // and silhouette. Their signed response can be calibrated independently
    // for Wood and PLNT without changing the fixture's semantic topology.
    core: { x: body.x + 48, y: body.y + 24, width: 18, height: 16 },
    crown: { x: body.x + 20, y: body.y + 94, width: 10, height: 10 },
    pocket: { x: body.x + 126, y: body.y + 74, width: 10, height: 10 },
    authoredCavity: { x: body.x + 74, y: body.y + 46, width: 12, height: 12 },
    openNotch: { x: body.x + body.width - 1, y: body.y + 82, width: 1, height: 14 },
    thinStem: { x: x + 208, y: CARD_ORIGIN_Y + 16, width: 1, height: 96 },
    isolated: { x: x + 214, y: CARD_ORIGIN_Y + 128 },
    // Both card origins and this offset are divisible by four, matching the
    // RenderLab native-wall proxy's exact 4x4 ownership blocks.
    wallCoexistence: { x: x + 240, y: CARD_ORIGIN_Y + 24, width: 28, height: 28 },
    waterContact: {
      owner: { x: x + 20, y: CARD_ORIGIN_Y + 168, width: 40, height: 28 },
      water: { x: x + 60, y: CARD_ORIGIN_Y + 168, width: 40, height: 28 },
    },
    sandContact: {
      owner: { x: x + 124, y: CARD_ORIGIN_Y + 168, width: 40, height: 28 },
      sand: { x: x + 164, y: CARD_ORIGIN_Y + 168, width: 40, height: 28 },
    },
    unlikeContact: {
      owner: { x: x + 160, y: CARD_ORIGIN_Y + 312, width: 32, height: 28 },
      other: { x: x + 192, y: CARD_ORIGIN_Y + 312, width: 32, height: 28 },
    },
    lifecycleCanopy,
    lifecycleProbe: {
      x: lifecycleCanopy.x + 12, y: lifecycleCanopy.y + 10, width: 24, height: 20,
    },
    guardedBlank: { x: x + 20, y: CARD_ORIGIN_Y + 232, width: 180, height: 64 },
    controls: {
      vine: { x: x + 20, y: CARD_ORIGIN_Y + 312, width: 32, height: 28 },
      wax: { x: x + 64, y: CARD_ORIGIN_Y + 312, width: 32, height: 28 },
      metal: { x: x + 108, y: CARD_ORIGIN_Y + 312, width: 32, height: 28 },
    },
  };
}

/**
 * Paused exact-owner fixture for E20 botanical body optics. It owns only fixed
 * semantic, native-wall, and two isolated lifecycle-state regions; the browser
 * gate owns off -> on -> off presentation. The main PLNT calibration geometry
 * intentionally retains RenderLab's zero-state baseline.
 */
export const BOTANICAL_BODY_VFX_AUDIT: BotanicalBodyVfxAuditSnapshot = {
  cards: DEFINITIONS.map(card),
  conductiveWall: CONDUCTIVE_WALL,
};

interface BotanicalBodyFixtureBackend extends SimulationBackend {
  paintWall(x: number, y: number, wall: number, radius: number): void;
  walls(): Uint8Array;
  presentationState(): Uint16Array;
  setFixturePresentationStateRect(
    x: number, y: number, width: number, height: number, state: number,
  ): void;
}

/** Direct-fills a paused RenderLab wall/state backend without brush or physics steps. */
export function prepareBotanicalBodyVfxFixture(simulation: SimulationBackend): void {
  if (!supportsFixture(simulation)) {
    throw new Error('Botanical body VFX fixture requires RenderLab native wall and state planes');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Botanical body VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }

  simulation.clear();
  const cells = simulation.cells();
  for (const entry of BOTANICAL_BODY_VFX_AUDIT.cards) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.authoredCavity, Material.Empty);
    fillRect(cells, simulation.width, entry.openNotch, Material.Empty);
    fillRect(cells, simulation.width, entry.thinStem, entry.material);
    setPoint(cells, simulation.width, entry.isolated, entry.material);

    fillRect(cells, simulation.width, entry.wallCoexistence, entry.material);
    for (let y = entry.wallCoexistence.y; y < entry.wallCoexistence.y + entry.wallCoexistence.height; y += 4) {
      for (let x = entry.wallCoexistence.x; x < entry.wallCoexistence.x + entry.wallCoexistence.width; x += 4) {
        simulation.paintWall(x, y, CONDUCTIVE_WALL, 0);
      }
    }

    fillRect(cells, simulation.width, entry.waterContact.owner, entry.material);
    fillRect(cells, simulation.width, entry.waterContact.water, Material.Water);
    fillRect(cells, simulation.width, entry.sandContact.owner, entry.material);
    fillRect(cells, simulation.width, entry.sandContact.sand, Material.Sand);
    fillRect(cells, simulation.width, entry.unlikeContact.owner, entry.material);
    fillRect(
      cells, simulation.width, entry.unlikeContact.other,
      entry.material === Material.Wood ? Material.Plant : Material.Wood,
    );
    fillStateRect(
      simulation, cells, entry.lifecycleCanopy, Material.Plant, entry.lifecycleState,
    );
    fillRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
    fillRect(cells, simulation.width, entry.controls.vine, Material.VINE);
    fillRect(cells, simulation.width, entry.controls.wax, Material.Wax);
    fillRect(cells, simulation.width, entry.controls.metal, Material.Metal);
  }
}

function supportsFixture(simulation: SimulationBackend): simulation is BotanicalBodyFixtureBackend {
  const candidate = simulation as Partial<BotanicalBodyFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function'
    && typeof candidate.presentationState === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function';
}

function fillStateRect(
  simulation: BotanicalBodyFixtureBackend, cells: Uint8Array,
  rect: BotanicalBodyVfxRect, material: Material, state: number,
): void {
  fillRect(cells, simulation.width, rect, material);
  simulation.setFixturePresentationStateRect(rect.x, rect.y, rect.width, rect.height, state);
}

function fillRect(cells: Uint8Array, width: number, rect: BotanicalBodyVfxRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function setPoint(cells: Uint8Array, width: number, point: BotanicalBodyVfxPoint, material: Material): void {
  cells[point.y * width + point.x] = material;
}
