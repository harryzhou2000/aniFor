import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const PASTE_RESIST_GRAPHICS_ATLAS_COLUMNS = 2;
export const PASTE_RESIST_GRAPHICS_ATLAS_ROWS = 2;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 4;
const CARD_STRIDE_X = 304;
const CARD_STRIDE_Y = 192;
const CARD_WIDTH = 300;
const CARD_HEIGHT = 184;

export type PasteResistGraphicsFamily = 'paste' | 'resist';
export type PasteResistGraphicsPhase = 'liquid' | 'solid';
export type PasteResistStructureKind =
  | 'paste-rivulet'
  | 'pressed-column'
  | 'resist-film'
  | 'hardened-mask';

export const PASTE_RESIST_GRAPHICS_DEFINITIONS = [
  {
    material: Material.PSTE,
    code: 'PSTE',
    color: '#aa99aa',
    family: 'paste',
    phase: 'liquid',
    structureKind: 'paste-rivulet',
    phasePartnerMaterial: Material.PSTS,
  },
  {
    material: Material.PSTS,
    code: 'PSTS',
    color: '#776677',
    family: 'paste',
    phase: 'solid',
    structureKind: 'pressed-column',
    phasePartnerMaterial: Material.PSTE,
  },
  {
    material: Material.RSST,
    code: 'RSST',
    color: '#f95b49',
    family: 'resist',
    phase: 'liquid',
    structureKind: 'resist-film',
    phasePartnerMaterial: Material.RSSS,
  },
  {
    material: Material.RSSS,
    code: 'RSSS',
    color: '#c43626',
    family: 'resist',
    phase: 'solid',
    structureKind: 'hardened-mask',
    phasePartnerMaterial: Material.RSST,
  },
] as const satisfies readonly {
  material: Material;
  code: string;
  color: string;
  family: PasteResistGraphicsFamily;
  phase: PasteResistGraphicsPhase;
  structureKind: PasteResistStructureKind;
  phasePartnerMaterial: Material;
}[];

export type PasteResistGraphicsMaterial =
  (typeof PASTE_RESIST_GRAPHICS_DEFINITIONS)[number]['material'];

export interface PasteResistGraphicsPoint {
  readonly x: number;
  readonly y: number;
}

export interface PasteResistGraphicsRect extends PasteResistGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface PasteResistGraphicsContactControl {
  readonly owner: PasteResistGraphicsRect;
  readonly neighbour: PasteResistGraphicsRect;
  readonly neighbourMaterial: PasteResistGraphicsMaterial | Material.Metal;
}

/** One phase-aligned sample set from a complete 32x32 family motif tile. */
export interface PasteResistGraphicsMotifProbeSet {
  readonly tileOrigin: PasteResistGraphicsPoint;
  readonly ridge: PasteResistGraphicsRect;
  readonly fold: PasteResistGraphicsRect;
  readonly bloom: PasteResistGraphicsRect;
  readonly joint: PasteResistGraphicsRect;
  readonly interstitial: PasteResistGraphicsRect;
}

export interface PasteResistGraphicsAtlasEntry {
  readonly material: PasteResistGraphicsMaterial;
  readonly code: (typeof PASTE_RESIST_GRAPHICS_DEFINITIONS)[number]['code'];
  readonly color: (typeof PASTE_RESIST_GRAPHICS_DEFINITIONS)[number]['color'];
  readonly family: PasteResistGraphicsFamily;
  readonly phase: PasteResistGraphicsPhase;
  readonly structureKind: PasteResistStructureKind;
  readonly phasePartnerMaterial: PasteResistGraphicsMaterial;
  readonly index: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly card: PasteResistGraphicsRect;
  /** Congruent modulo-32 body used for exact phase-family comparisons. */
  readonly body: PasteResistGraphicsRect;
  readonly surfaceProbe: PasteResistGraphicsRect;
  readonly coreProbe: PasteResistGraphicsRect;
  /** Authored air pocket whose centre must remain presentation-transparent. */
  readonly authoredCavity: PasteResistGraphicsRect;
  /** Open channel connecting the cavity to the top of the material body. */
  readonly openChimney: PasteResistGraphicsRect;
  readonly haloOuter: PasteResistGraphicsRect;
  /** Phase-specific one- or two-cell structure plus a common attached stem. */
  readonly phaseStructure: readonly PasteResistGraphicsPoint[];
  readonly isolated: PasteResistGraphicsPoint;
  readonly guardedBlank: PasteResistGraphicsRect;
  /** Exact unlike-material seam against the native phase partner. */
  readonly familyContact: PasteResistGraphicsContactControl;
  /** Unstyled opaque control used to detect identity-style leakage. */
  readonly metalContact: PasteResistGraphicsContactControl;
  readonly motifProbes: readonly PasteResistGraphicsMotifProbeSet[];
}

export interface PasteResistGraphicsAuditSnapshot {
  readonly cards: readonly PasteResistGraphicsAtlasEntry[];
  readonly pasteCards: readonly PasteResistGraphicsAtlasEntry[];
  readonly resistCards: readonly PasteResistGraphicsAtlasEntry[];
  readonly liquidCards: readonly PasteResistGraphicsAtlasEntry[];
  readonly solidCards: readonly PasteResistGraphicsAtlasEntry[];
  readonly cavities: readonly PasteResistGraphicsPoint[];
  readonly openChimneys: readonly PasteResistGraphicsPoint[];
  readonly phaseStructures: readonly PasteResistGraphicsPoint[];
  readonly motifProbes: readonly PasteResistGraphicsMotifProbeSet[];
  readonly isolated: readonly PasteResistGraphicsPoint[];
  readonly guardedBlanks: readonly PasteResistGraphicsRect[];
  readonly familyContacts: readonly PasteResistGraphicsContactControl[];
  readonly metalContacts: readonly PasteResistGraphicsContactControl[];
}

/** Stable 2x2 scene for phase-continuous paste and resist graphics gates. */
export const PASTE_RESIST_GRAPHICS_ATLAS: readonly PasteResistGraphicsAtlasEntry[] =
  PASTE_RESIST_GRAPHICS_DEFINITIONS.map((definition, index) => {
    const column = index % PASTE_RESIST_GRAPHICS_ATLAS_COLUMNS;
    const row = Math.floor(index / PASTE_RESIST_GRAPHICS_ATLAS_COLUMNS);
    const card = {
      x: CARD_ORIGIN_X + column * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y + row * CARD_STRIDE_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    // Both strides are exact multiples of the shared 32-cell grammar. The
    // liquid and solid body in each family therefore sample identical phases.
    const body = {
      x: 20 + column * 320,
      y: 20 + row * 192,
      width: 144,
      height: 104,
    };
    const authoredCavity = {
      x: body.x + 58,
      y: body.y + 45,
      width: 12,
      height: 10,
    };
    const openChimney = {
      x: body.x + 62,
      y: body.y,
      width: 4,
      height: 45,
    };
    return {
      ...definition,
      index,
      left: card.x,
      top: card.y,
      width: card.width,
      height: card.height,
      card,
      body,
      surfaceProbe: { x: body.x + 16, y: body.y + 8, width: 24, height: 12 },
      coreProbe: { x: body.x + 16, y: body.y + 80, width: 24, height: 12 },
      authoredCavity,
      openChimney,
      haloOuter: {
        x: body.x - 4,
        y: body.y - 4,
        width: body.width + 8,
        height: body.height + 8,
      },
      phaseStructure: buildPhaseStructure(definition.material, card, body),
      isolated: { x: card.x + 290, y: card.y + 18 },
      guardedBlank: { x: card.x + 214, y: card.y + 132, width: 70, height: 40 },
      familyContact: {
        owner: { x: card.x + 16, y: card.y + 150, width: 12, height: 16 },
        neighbour: { x: card.x + 28, y: card.y + 150, width: 16, height: 16 },
        neighbourMaterial: definition.phasePartnerMaterial,
      },
      metalContact: {
        owner: { x: card.x + 100, y: card.y + 150, width: 12, height: 16 },
        neighbour: { x: card.x + 112, y: card.y + 150, width: 16, height: 16 },
        neighbourMaterial: Material.Metal,
      },
      motifProbes: buildMotifProbes(body, authoredCavity, openChimney),
    } satisfies PasteResistGraphicsAtlasEntry;
  });

export const PASTE_RESIST_GRAPHICS_AUDIT: PasteResistGraphicsAuditSnapshot = {
  cards: PASTE_RESIST_GRAPHICS_ATLAS,
  pasteCards: PASTE_RESIST_GRAPHICS_ATLAS.filter(({ family }) => family === 'paste'),
  resistCards: PASTE_RESIST_GRAPHICS_ATLAS.filter(({ family }) => family === 'resist'),
  liquidCards: PASTE_RESIST_GRAPHICS_ATLAS.filter(({ phase }) => phase === 'liquid'),
  solidCards: PASTE_RESIST_GRAPHICS_ATLAS.filter(({ phase }) => phase === 'solid'),
  cavities: PASTE_RESIST_GRAPHICS_ATLAS.flatMap(({ authoredCavity }) => (
    rectPoints(authoredCavity)
  )),
  openChimneys: PASTE_RESIST_GRAPHICS_ATLAS.flatMap(({ openChimney }) => (
    rectPoints(openChimney)
  )),
  phaseStructures: PASTE_RESIST_GRAPHICS_ATLAS.flatMap(({ phaseStructure }) => phaseStructure),
  motifProbes: PASTE_RESIST_GRAPHICS_ATLAS.flatMap(({ motifProbes }) => motifProbes),
  isolated: PASTE_RESIST_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  guardedBlanks: PASTE_RESIST_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  familyContacts: PASTE_RESIST_GRAPHICS_ATLAS.map(({ familyContact }) => familyContact),
  metalContacts: PASTE_RESIST_GRAPHICS_ATLAS.map(({ metalContact }) => metalContact),
};

/** Direct-fills one paused family scene without crossing the particle-brush ABI. */
export function preparePasteResistGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Paste/resist graphics audit fixture requires the deterministic backend');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Paste/resist graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of PASTE_RESIST_GRAPHICS_ATLAS) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.authoredCavity, Material.Empty);
    fillRect(cells, simulation.width, entry.openChimney, Material.Empty);
    for (const point of entry.phaseStructure) {
      cells[point.y * simulation.width + point.x] = entry.material;
    }
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    for (const contact of [entry.familyContact, entry.metalContact]) {
      fillRect(cells, simulation.width, contact.owner, entry.material);
      fillRect(cells, simulation.width, contact.neighbour, contact.neighbourMaterial);
    }
  }
}

function buildPhaseStructure(
  material: PasteResistGraphicsMaterial,
  card: PasteResistGraphicsRect,
  body: PasteResistGraphicsRect,
): readonly PasteResistGraphicsPoint[] {
  const points = rectPoints({
    x: body.x + 71,
    y: body.y + body.height,
    width: 1,
    height: 24,
  });
  const sx = card.x + 178;
  const sy = card.y + 22;

  if (material === Material.PSTE) {
    // One-cell viscous thread plus a detached, round semantic droplet.
    for (let step = 0; step < 48; step++) {
      points.push({ x: sx + 10 + Math.floor(step / 8), y: sy + step });
    }
    points.push(...diamondPoints(sx + 72, sy + 28, 2));
  } else if (material === Material.PSTS) {
    // A load-bearing column and progressively shorter compressed shelves.
    points.push(
      ...rectPoints({ x: sx + 16, y: sy, width: 1, height: 52 }),
      ...rectPoints({ x: sx, y: sy + 10, width: 32, height: 1 }),
      ...rectPoints({ x: sx + 4, y: sy + 24, width: 24, height: 1 }),
      ...rectPoints({ x: sx + 8, y: sy + 38, width: 16, height: 1 }),
    );
  } else if (material === Material.RSST) {
    // A thin two-cell photoresist film and a detached coating droplet.
    for (let step = 0; step < 48; step++) {
      const x = sx + 8 + Math.floor(step / 6);
      const y = sy + step;
      points.push({ x, y }, { x: x + 1, y });
    }
    points.push(...diamondPoints(sx + 72, sy + 28, 2));
  } else {
    // Hardened resist keeps an exact one-cell lithographic trace network.
    points.push(...rectPoints({ x: sx + 16, y: sy, width: 1, height: 52 }));
    for (const offsetY of [0, 13, 26, 39]) {
      points.push(...rectPoints({ x: sx, y: sy + offsetY, width: 32, height: 1 }));
    }
  }
  return uniquePoints(points);
}

function buildMotifProbes(
  body: PasteResistGraphicsRect,
  authoredCavity: PasteResistGraphicsRect,
  openChimney: PasteResistGraphicsRect,
): readonly PasteResistGraphicsMotifProbeSet[] {
  const probes: PasteResistGraphicsMotifProbeSet[] = [];
  const firstTileX = Math.ceil(body.x / 32) * 32;
  const firstTileY = Math.ceil(body.y / 32) * 32;
  for (let tileY = firstTileY; tileY + 32 <= body.y + body.height; tileY += 32) {
    for (let tileX = firstTileX; tileX + 32 <= body.x + body.width; tileX += 32) {
      const probe = {
        tileOrigin: { x: tileX, y: tileY },
        ridge: { x: tileX, y: tileY, width: 1, height: 1 },
        fold: { x: tileX + 8, y: tileY, width: 1, height: 1 },
        // Paste's rounded inclusion is centred on the 16-cell sub-tile at
        // radius five. Keep one explicit probe inside that pocket so a flat
        // seam/default-only implementation cannot satisfy the motif gate.
        bloom: { x: tileX + 13, y: tileY + 8, width: 1, height: 1 },
        joint: { x: tileX + 6, y: tileY + 2, width: 1, height: 1 },
        interstitial: { x: tileX + 3, y: tileY, width: 1, height: 1 },
      } satisfies PasteResistGraphicsMotifProbeSet;
      if (motifProbeRects(probe).every((rect) => rectInside(rect, body)
        && !rectanglesOverlap(rect, authoredCavity)
        && !rectanglesOverlap(rect, openChimney))) probes.push(probe);
    }
  }
  return probes;
}

function motifProbeRects(
  probe: PasteResistGraphicsMotifProbeSet,
): readonly PasteResistGraphicsRect[] {
  return [probe.ridge, probe.fold, probe.bloom, probe.joint, probe.interstitial];
}

function diamondPoints(
  centreX: number,
  centreY: number,
  radius: number,
): PasteResistGraphicsPoint[] {
  const points: PasteResistGraphicsPoint[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.abs(dx) + Math.abs(dy) <= radius) {
        points.push({ x: centreX + dx, y: centreY + dy });
      }
    }
  }
  return points;
}

function fillRect(
  cells: Uint8Array,
  worldWidth: number,
  rect: PasteResistGraphicsRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function rectPoints(rect: PasteResistGraphicsRect): PasteResistGraphicsPoint[] {
  const points: PasteResistGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}

function uniquePoints(
  points: readonly PasteResistGraphicsPoint[],
): PasteResistGraphicsPoint[] {
  return [...new Map(points.map((point) => [`${point.x},${point.y}`, point])).values()];
}

function rectInside(
  inner: PasteResistGraphicsRect,
  outer: PasteResistGraphicsRect,
): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(
  left: PasteResistGraphicsRect,
  right: PasteResistGraphicsRect,
): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}
