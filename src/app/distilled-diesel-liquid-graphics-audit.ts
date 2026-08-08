import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;

const DISTILLED_DIESEL_LIQUID_DEFINITIONS = [
  { material: Material.DistilledWater, code: 'DSTW', color: '#75cfdf', seamMaterial: Material.Water, seamCode: 'WATR' },
  { material: Material.Diesel, code: 'DESL', color: '#9b7d3d', seamMaterial: Material.Oil, seamCode: 'OIL' },
] as const;

export interface DistilledDieselLiquidPoint { readonly x: number; readonly y: number }
export interface DistilledDieselLiquidRect extends DistilledDieselLiquidPoint {
  readonly width: number;
  readonly height: number;
}

export interface DistilledDieselLiquidGraphicsAtlasEntry {
  readonly material: (typeof DISTILLED_DIESEL_LIQUID_DEFINITIONS)[number]['material'];
  readonly code: string;
  readonly color: string;
  readonly index: number;
  readonly card: DistilledDieselLiquidRect;
  /** Deep exact-material support for E79 liquid body and identity probes. */
  readonly body: DistilledDieselLiquidRect;
  readonly surfaceProbe: DistilledDieselLiquidRect;
  readonly coreProbe: DistilledDieselLiquidRect;
  /** Authored empty volume which must remain open rather than reconstructed. */
  readonly cavity: DistilledDieselLiquidRect;
  /** An open air path from the cavity to the body surface. */
  readonly openChimney: DistilledDieselLiquidRect;
  /** A one-cell liquid strand and an isolated drop are protected sparse controls. */
  readonly strand: DistilledDieselLiquidRect;
  readonly isolated: DistilledDieselLiquidPoint;
  /** Matter and native bmap wall coexist independently. */
  readonly wallCoexistence: DistilledDieselLiquidRect;
  /** Exact unlike-liquid seam: distilled-water→water or diesel→oil. */
  readonly siblingSeam: {
    readonly owner: DistilledDieselLiquidRect;
    readonly sibling: DistilledDieselLiquidRect;
    readonly siblingMaterial: Material.Water | Material.Oil;
    readonly siblingCode: string;
  };
  /** Direct liquid/metal contact must remain a semantic boundary. */
  readonly metalContact: {
    readonly owner: DistilledDieselLiquidRect;
    readonly metal: DistilledDieselLiquidRect;
  };
  readonly guardedBlank: DistilledDieselLiquidRect;
}

export interface DistilledDieselLiquidGraphicsAuditSnapshot {
  readonly cards: readonly DistilledDieselLiquidGraphicsAtlasEntry[];
  readonly cavities: readonly DistilledDieselLiquidPoint[];
  readonly openChimneys: readonly DistilledDieselLiquidPoint[];
  readonly strands: readonly DistilledDieselLiquidPoint[];
  readonly isolated: readonly DistilledDieselLiquidPoint[];
  readonly wallCoexistence: readonly DistilledDieselLiquidRect[];
  readonly siblingSeams: readonly DistilledDieselLiquidGraphicsAtlasEntry['siblingSeam'][];
  readonly metalContacts: readonly DistilledDieselLiquidGraphicsAtlasEntry['metalContact'][];
  readonly guardedBlanks: readonly DistilledDieselLiquidRect[];
  readonly conductiveWall: number;
}

/**
 * Paused exact-owner liquid atlas for Distilled Water and Diesel. It exists
 * separately from the broad liquid atlas so later water/oil family identity
 * work can prove sibling seams without treating related liquids as one owner.
 */
export const DISTILLED_DIESEL_LIQUID_GRAPHICS_ATLAS: readonly DistilledDieselLiquidGraphicsAtlasEntry[] =
  DISTILLED_DIESEL_LIQUID_DEFINITIONS.map((definition, index) => {
    const card = { x: 8 + index * 300, y: 8, width: 296, height: 368 };
    const body = { x: card.x + 14, y: card.y + 18, width: 144, height: 148 };
    const wallX = card.x + 206 + ((4 - ((card.x + 206) % 4)) % 4);
    return {
      material: definition.material,
      code: definition.code,
      color: definition.color,
      index,
      card,
      body,
      surfaceProbe: { x: body.x + 10, y: body.y + 8, width: 16, height: 12 },
      coreProbe: { x: body.x + 48, y: body.y + 104, width: 20, height: 20 },
      cavity: { x: body.x + 54, y: body.y + 58, width: 12, height: 12 },
      openChimney: { x: body.x + 58, y: body.y, width: 4, height: 58 },
      strand: { x: body.x + 102, y: body.y + body.height, width: 1, height: 48 },
      isolated: { x: card.x + 180, y: card.y + 50 },
      wallCoexistence: { x: wallX, y: card.y + 28, width: 32, height: 32 },
      siblingSeam: {
        owner: { x: card.x + 16, y: card.y + 238, width: 42, height: 28 },
        sibling: { x: card.x + 58, y: card.y + 238, width: 42, height: 28 },
        siblingMaterial: definition.seamMaterial,
        siblingCode: definition.seamCode,
      },
      metalContact: {
        owner: { x: card.x + 126, y: card.y + 238, width: 42, height: 28 },
        metal: { x: card.x + 168, y: card.y + 238, width: 42, height: 28 },
      },
      guardedBlank: { x: card.x + 18, y: card.y + 294, width: 186, height: 52 },
    } satisfies DistilledDieselLiquidGraphicsAtlasEntry;
  });

export const DISTILLED_DIESEL_LIQUID_GRAPHICS_AUDIT: DistilledDieselLiquidGraphicsAuditSnapshot = {
  cards: DISTILLED_DIESEL_LIQUID_GRAPHICS_ATLAS,
  cavities: DISTILLED_DIESEL_LIQUID_GRAPHICS_ATLAS.flatMap(({ cavity }) => rectPoints(cavity)),
  openChimneys: DISTILLED_DIESEL_LIQUID_GRAPHICS_ATLAS.flatMap(({ openChimney }) => rectPoints(openChimney)),
  strands: DISTILLED_DIESEL_LIQUID_GRAPHICS_ATLAS.flatMap(({ strand }) => rectPoints(strand)),
  isolated: DISTILLED_DIESEL_LIQUID_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  wallCoexistence: DISTILLED_DIESEL_LIQUID_GRAPHICS_ATLAS.map(({ wallCoexistence }) => wallCoexistence),
  siblingSeams: DISTILLED_DIESEL_LIQUID_GRAPHICS_ATLAS.map(({ siblingSeam }) => siblingSeam),
  metalContacts: DISTILLED_DIESEL_LIQUID_GRAPHICS_ATLAS.map(({ metalContact }) => metalContact),
  guardedBlanks: DISTILLED_DIESEL_LIQUID_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  conductiveWall: CONDUCTIVE_WALL,
};

interface DistilledDieselLiquidFixtureBackend extends SimulationBackend {
  paintWall(x: number, y: number, wall: number, radius: number): void;
  walls(): Uint8Array;
}

/** Direct-fill a paused world without stepping liquid physics or a brush ABI. */
export function prepareDistilledDieselLiquidGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsFixture(simulation)) {
    throw new Error('Distilled/Diesel liquid fixture requires a render-lab native wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Distilled/Diesel liquid fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of DISTILLED_DIESEL_LIQUID_GRAPHICS_ATLAS) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.cavity, Material.Empty);
    fillRect(cells, simulation.width, entry.openChimney, Material.Empty);
    fillRect(cells, simulation.width, entry.strand, entry.material);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    fillRect(cells, simulation.width, entry.wallCoexistence, entry.material);
    for (let y = entry.wallCoexistence.y; y < entry.wallCoexistence.y + entry.wallCoexistence.height; y += 4) {
      for (let x = entry.wallCoexistence.x; x < entry.wallCoexistence.x + entry.wallCoexistence.width; x += 4) {
        simulation.paintWall(x, y, CONDUCTIVE_WALL, 0);
      }
    }
    fillRect(cells, simulation.width, entry.siblingSeam.owner, entry.material);
    fillRect(cells, simulation.width, entry.siblingSeam.sibling, entry.siblingSeam.siblingMaterial);
    fillRect(cells, simulation.width, entry.metalContact.owner, entry.material);
    fillRect(cells, simulation.width, entry.metalContact.metal, Material.Metal);
    fillRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
  }
}

function supportsFixture(simulation: SimulationBackend): simulation is DistilledDieselLiquidFixtureBackend {
  const candidate = simulation as Partial<DistilledDieselLiquidFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillRect(cells: Uint8Array, width: number, rect: DistilledDieselLiquidRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function rectPoints(rect: DistilledDieselLiquidRect): DistilledDieselLiquidPoint[] {
  const points: DistilledDieselLiquidPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
