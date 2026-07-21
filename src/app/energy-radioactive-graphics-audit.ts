import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const ENERGY_RADIOACTIVE_GRAPHICS_ATLAS_COLUMNS = 7;
export const ENERGY_RADIOACTIVE_GRAPHICS_ATLAS_ROWS = 3;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 4;
const CARD_STRIDE_X = 86;
const CARD_STRIDE_Y = 126;
const CARD_WIDTH = 82;
const CARD_HEIGHT = 122;

const CARRIER_OFFSETS = [
  { x: 44, y: 12 }, { x: 46, y: 11 }, { x: 48, y: 13 }, { x: 50, y: 12 },
  { x: 61, y: 18 }, { x: 63, y: 16 }, { x: 65, y: 17 }, { x: 67, y: 15 },
] as const;

export type EnergyRadioactiveAuditPhase = 'energy' | 'gas' | 'liquid' | 'powder' | 'solid';
export type EnergyRadioactiveAuditFamily = 'energy' | 'radioactive';

/**
 * The complete renderer-facing union of Energy-phase particles and the
 * Radioactive toolbox family. BRAY and EMBR are retained native reaction
 * products, so this atlas exercises identities that cannot use the ordinary
 * particle-brush path as well as selectable matter.
 */
export const ENERGY_RADIOACTIVE_GRAPHICS_DEFINITIONS = [
  { material: Material.Fire, code: 'FIRE', color: '#ff8052', phase: 'energy', family: 'energy', nativeProduct: false },
  { material: Material.Plasma, code: 'PLSM', color: '#d879ff', phase: 'energy', family: 'energy', nativeProduct: false },
  { material: Material.ELEC, code: 'ELEC', color: '#dfefff', phase: 'energy', family: 'radioactive', nativeProduct: false },
  { material: Material.GRVT, code: 'GRVT', color: '#00ee76', phase: 'energy', family: 'radioactive', nativeProduct: false },
  { material: Material.NEUT, code: 'NEUT', color: '#20e0ff', phase: 'energy', family: 'radioactive', nativeProduct: false },
  { material: Material.PHOT, code: 'PHOT', color: '#ffffff', phase: 'energy', family: 'radioactive', nativeProduct: false },
  { material: Material.PROT, code: 'PROT', color: '#990000', phase: 'energy', family: 'radioactive', nativeProduct: false },
  { material: Material.BRAY, code: 'BRAY', color: '#ffffff', phase: 'energy', family: 'energy', nativeProduct: true },
  { material: Material.EMBR, code: 'EMBR', color: '#fff288', phase: 'energy', family: 'energy', nativeProduct: true },
  { material: Material.AMTR, code: 'AMTR', color: '#808080', phase: 'gas', family: 'radioactive', nativeProduct: false },
  { material: Material.BVBR, code: 'BVBR', color: '#005000', phase: 'powder', family: 'radioactive', nativeProduct: false },
  { material: Material.DEUT, code: 'DEUT', color: '#00153f', phase: 'liquid', family: 'radioactive', nativeProduct: false },
  { material: Material.EXOT, code: 'EXOT', color: '#247bfe', phase: 'liquid', family: 'radioactive', nativeProduct: false },
  { material: Material.ISOZ, code: 'ISOZ', color: '#aa30d0', phase: 'liquid', family: 'radioactive', nativeProduct: false },
  { material: Material.ISZS, code: 'ISZS', color: '#662089', phase: 'solid', family: 'radioactive', nativeProduct: false },
  { material: Material.PLUT, code: 'PLUT', color: '#407020', phase: 'powder', family: 'radioactive', nativeProduct: false },
  { material: Material.POLO, code: 'POLO', color: '#506030', phase: 'powder', family: 'radioactive', nativeProduct: false },
  { material: Material.SING, code: 'SING', color: '#242424', phase: 'powder', family: 'radioactive', nativeProduct: false },
  { material: Material.URAN, code: 'URAN', color: '#707020', phase: 'powder', family: 'radioactive', nativeProduct: false },
  { material: Material.VIBR, code: 'VIBR', color: '#005000', phase: 'solid', family: 'radioactive', nativeProduct: false },
  { material: Material.WARP, code: 'WARP', color: '#101010', phase: 'gas', family: 'radioactive', nativeProduct: false },
] as const satisfies readonly {
  material: Material;
  code: string;
  color: string;
  phase: EnergyRadioactiveAuditPhase;
  family: EnergyRadioactiveAuditFamily;
  nativeProduct: boolean;
}[];

export interface EnergyRadioactiveGraphicsPoint {
  readonly x: number;
  readonly y: number;
}

export interface EnergyRadioactiveGraphicsRect extends EnergyRadioactiveGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface EnergyRadioactiveContactControl {
  readonly owner: EnergyRadioactiveGraphicsRect;
  readonly unlike: EnergyRadioactiveGraphicsRect;
  readonly unlikeMaterial: Material.Water | Material.Metal;
}

export interface EnergyRadioactiveGraphicsAtlasEntry {
  readonly material: (typeof ENERGY_RADIOACTIVE_GRAPHICS_DEFINITIONS)[number]['material'];
  readonly code: string;
  readonly color: string;
  readonly phase: EnergyRadioactiveAuditPhase;
  readonly family: EnergyRadioactiveAuditFamily;
  readonly nativeProduct: boolean;
  readonly index: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly card: EnergyRadioactiveGraphicsRect;
  /** Dense semantic seed for volume, body-depth, and family-colour probes. */
  readonly body: EnergyRadioactiveGraphicsRect;
  readonly surfaceProbe: EnergyRadioactiveGraphicsRect;
  readonly coreProbe: EnergyRadioactiveGraphicsRect;
  /** Authored air that must not be converted into emission or matter support. */
  readonly authoredHole: EnergyRadioactiveGraphicsRect;
  /** Fine open air path joining the hole to the top of the dense body. */
  readonly openChannel: EnergyRadioactiveGraphicsRect;
  /** Two deterministic sparse arcs for energy-topology and aura checks. */
  readonly sparseCarriers: readonly EnergyRadioactiveGraphicsPoint[];
  readonly carrierGap: EnergyRadioactiveGraphicsRect;
  readonly isolated: EnergyRadioactiveGraphicsPoint;
  readonly guardedBlank: EnergyRadioactiveGraphicsRect;
  readonly liquidContact: EnergyRadioactiveContactControl;
  readonly solidContact: EnergyRadioactiveContactControl;
}

export interface EnergyRadioactiveGraphicsAuditSnapshot {
  readonly cards: readonly EnergyRadioactiveGraphicsAtlasEntry[];
  readonly energyCards: readonly EnergyRadioactiveGraphicsAtlasEntry[];
  readonly radioactiveCards: readonly EnergyRadioactiveGraphicsAtlasEntry[];
  readonly nativeProductCards: readonly EnergyRadioactiveGraphicsAtlasEntry[];
  readonly authoredHoles: readonly EnergyRadioactiveGraphicsPoint[];
  readonly openChannels: readonly EnergyRadioactiveGraphicsPoint[];
  readonly sparseCarriers: readonly EnergyRadioactiveGraphicsPoint[];
  readonly carrierGaps: readonly EnergyRadioactiveGraphicsRect[];
  readonly isolated: readonly EnergyRadioactiveGraphicsPoint[];
  readonly guardedBlanks: readonly EnergyRadioactiveGraphicsRect[];
  readonly liquidContacts: readonly EnergyRadioactiveContactControl[];
  readonly solidContacts: readonly EnergyRadioactiveContactControl[];
}

/** Stable 21-card atlas shared by future Canvas, WebGL, and true-8x gates. */
export const ENERGY_RADIOACTIVE_GRAPHICS_ATLAS: readonly EnergyRadioactiveGraphicsAtlasEntry[] =
  ENERGY_RADIOACTIVE_GRAPHICS_DEFINITIONS.map((definition, index) => {
    const column = index % ENERGY_RADIOACTIVE_GRAPHICS_ATLAS_COLUMNS;
    const row = Math.floor(index / ENERGY_RADIOACTIVE_GRAPHICS_ATLAS_COLUMNS);
    const card = {
      x: CARD_ORIGIN_X + column * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y + row * CARD_STRIDE_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 4, y: card.y + 6, width: 34, height: 36 };
    const authoredHole = { x: body.x + 14, y: body.y + 16, width: 4, height: 4 };
    const openChannel = {
      x: authoredHole.x + 1,
      y: body.y,
      width: 2,
      height: authoredHole.y - body.y,
    };
    const contactY = card.y + 96;
    return {
      ...definition,
      index,
      left: card.x,
      top: card.y,
      width: card.width,
      height: card.height,
      card,
      body,
      surfaceProbe: { x: body.x + 4, y: body.y + 4, width: 6, height: 6 },
      coreProbe: { x: body.x + 5, y: body.y + 26, width: 6, height: 6 },
      authoredHole,
      openChannel,
      sparseCarriers: CARRIER_OFFSETS.map(({ x, y }) => ({ x: card.x + x, y: card.y + y })),
      carrierGap: { x: card.x + 53, y: card.y + 8, width: 6, height: 13 },
      isolated: { x: card.x + 75, y: card.y + 43 },
      guardedBlank: { x: card.x + 45, y: card.y + 53, width: 30, height: 16 },
      liquidContact: {
        owner: { x: card.x + 5, y: contactY, width: 6, height: 8 },
        unlike: { x: card.x + 11, y: contactY, width: 6, height: 8 },
        unlikeMaterial: Material.Water,
      },
      solidContact: {
        owner: { x: card.x + 38, y: contactY, width: 6, height: 8 },
        unlike: { x: card.x + 44, y: contactY, width: 6, height: 8 },
        unlikeMaterial: Material.Metal,
      },
    };
  });

export const ENERGY_RADIOACTIVE_GRAPHICS_AUDIT: EnergyRadioactiveGraphicsAuditSnapshot = {
  cards: ENERGY_RADIOACTIVE_GRAPHICS_ATLAS,
  energyCards: ENERGY_RADIOACTIVE_GRAPHICS_ATLAS.filter(({ phase }) => phase === 'energy'),
  radioactiveCards: ENERGY_RADIOACTIVE_GRAPHICS_ATLAS.filter(({ family }) => family === 'radioactive'),
  nativeProductCards: ENERGY_RADIOACTIVE_GRAPHICS_ATLAS.filter(({ nativeProduct }) => nativeProduct),
  authoredHoles: ENERGY_RADIOACTIVE_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openChannels: ENERGY_RADIOACTIVE_GRAPHICS_ATLAS.flatMap(({ openChannel }) => rectPoints(openChannel)),
  sparseCarriers: ENERGY_RADIOACTIVE_GRAPHICS_ATLAS.flatMap(({ sparseCarriers }) => sparseCarriers),
  carrierGaps: ENERGY_RADIOACTIVE_GRAPHICS_ATLAS.map(({ carrierGap }) => carrierGap),
  isolated: ENERGY_RADIOACTIVE_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  guardedBlanks: ENERGY_RADIOACTIVE_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  liquidContacts: ENERGY_RADIOACTIVE_GRAPHICS_ATLAS.map(({ liquidContact }) => liquidContact),
  solidContacts: ENERGY_RADIOACTIVE_GRAPHICS_ATLAS.map(({ solidContact }) => solidContact),
};

/** Direct-fills a paused deterministic world without crossing particle or tool ABIs. */
export function prepareEnergyRadioactiveGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Energy/radioactive graphics audit fixture requires the deterministic backend');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Energy/radioactive graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of ENERGY_RADIOACTIVE_GRAPHICS_ATLAS) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.authoredHole, Material.Empty);
    fillRect(cells, simulation.width, entry.openChannel, Material.Empty);
    for (const point of entry.sparseCarriers) {
      cells[point.y * simulation.width + point.x] = entry.material;
    }
    fillRect(cells, simulation.width, entry.carrierGap, Material.Empty);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    fillRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
    fillRect(cells, simulation.width, entry.liquidContact.owner, entry.material);
    fillRect(cells, simulation.width, entry.liquidContact.unlike, entry.liquidContact.unlikeMaterial);
    fillRect(cells, simulation.width, entry.solidContact.owner, entry.material);
    fillRect(cells, simulation.width, entry.solidContact.unlike, entry.solidContact.unlikeMaterial);
  }
}

function fillRect(
  cells: Uint8Array,
  worldWidth: number,
  rect: EnergyRadioactiveGraphicsRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function rectPoints(rect: EnergyRadioactiveGraphicsRect): EnergyRadioactiveGraphicsPoint[] {
  const points: EnergyRadioactiveGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
