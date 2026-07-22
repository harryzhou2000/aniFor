import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const CRYSTALLINE_GRAPHICS_ATLAS_COLUMNS = 2;
export const CRYSTALLINE_GRAPHICS_ATLAS_ROWS = 2;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 4;
const CARD_STRIDE_X = 304;
const CARD_STRIDE_Y = 192;
const CARD_WIDTH = 300;
const CARD_HEIGHT = 184;

export type CrystallineGraphicsPhase = 'solid';
export type CrystallineStructureKind =
  | 'sublimation-fractures'
  | 'nitrogen-needle'
  | 'quartz-prism'
  | 'rime-dendrite';
export type CrystallineMotifProbeKind =
  | 'key'
  | 'facet'
  | 'joint'
  | 'shadow'
  | 'interstitial';

export const CRYSTALLINE_GRAPHICS_DEFINITIONS = [
  {
    material: Material.DRIC,
    code: 'DRIC',
    color: '#e0e0e0',
    phase: 'solid',
    structureKind: 'sublimation-fractures',
  },
  {
    material: Material.NICE,
    code: 'NICE',
    color: '#c0e0ff',
    phase: 'solid',
    structureKind: 'nitrogen-needle',
  },
  {
    material: Material.QRTZ,
    code: 'QRTZ',
    color: '#aadddd',
    phase: 'solid',
    structureKind: 'quartz-prism',
  },
  {
    material: Material.RIME,
    code: 'RIME',
    color: '#cccccc',
    phase: 'solid',
    structureKind: 'rime-dendrite',
  },
] as const satisfies readonly {
  material: Material;
  code: string;
  color: string;
  phase: CrystallineGraphicsPhase;
  structureKind: CrystallineStructureKind;
}[];

export type CrystallineGraphicsMaterial =
  (typeof CRYSTALLINE_GRAPHICS_DEFINITIONS)[number]['material'];

export interface CrystallineGraphicsPoint {
  readonly x: number;
  readonly y: number;
}

export interface CrystallineGraphicsRect extends CrystallineGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface CrystallineGraphicsContactControl {
  readonly owner: CrystallineGraphicsRect;
  readonly neighbour: CrystallineGraphicsRect;
  readonly neighbourMaterial: CrystallineGraphicsMaterial | Material.Metal;
}

/** One phase-aligned sample set from a complete 32x32 world motif tile. */
export interface CrystallineGraphicsMotifProbeSet {
  readonly tileOrigin: CrystallineGraphicsPoint;
  readonly key: CrystallineGraphicsRect;
  readonly facet: CrystallineGraphicsRect;
  readonly joint: CrystallineGraphicsRect;
  readonly shadow: CrystallineGraphicsRect;
  readonly interstitial: CrystallineGraphicsRect;
}

export interface CrystallineGraphicsAtlasEntry {
  readonly material: CrystallineGraphicsMaterial;
  readonly code: (typeof CRYSTALLINE_GRAPHICS_DEFINITIONS)[number]['code'];
  readonly color: (typeof CRYSTALLINE_GRAPHICS_DEFINITIONS)[number]['color'];
  readonly phase: CrystallineGraphicsPhase;
  readonly structureKind: CrystallineStructureKind;
  readonly index: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly card: CrystallineGraphicsRect;
  /** Identically aligned bulk body used for renderer and material-family comparisons. */
  readonly body: CrystallineGraphicsRect;
  readonly surfaceProbe: CrystallineGraphicsRect;
  readonly coreProbe: CrystallineGraphicsRect;
  /** Deliberately large authored air pocket that contour reconstruction must preserve. */
  readonly authoredCavity: CrystallineGraphicsRect;
  /** Separate open channel from the body's top edge into its interior. */
  readonly openChimney: CrystallineGraphicsRect;
  /** Four-cell expansion used to audit presentation growth without changing semantics. */
  readonly haloOuter: CrystallineGraphicsRect;
  /** Common attached spur plus one material-specific, disjoint one-cell structure. */
  readonly fineStructure: readonly CrystallineGraphicsPoint[];
  readonly isolated: CrystallineGraphicsPoint;
  readonly guardedBlank: CrystallineGraphicsRect;
  /** Same-optics, unlike-exact-material seam against the next crystal in the cycle. */
  readonly crystalContact: CrystallineGraphicsContactControl;
  /** Opaque control that must never inherit crystalline styling. */
  readonly metalContact: CrystallineGraphicsContactControl;
  readonly motifProbes: readonly CrystallineGraphicsMotifProbeSet[];
}

export interface CrystallineGraphicsAuditSnapshot {
  readonly cards: readonly CrystallineGraphicsAtlasEntry[];
  readonly cavities: readonly CrystallineGraphicsPoint[];
  readonly openChimneys: readonly CrystallineGraphicsPoint[];
  readonly fineStructures: readonly CrystallineGraphicsPoint[];
  readonly motifProbes: readonly CrystallineGraphicsMotifProbeSet[];
  readonly isolated: readonly CrystallineGraphicsPoint[];
  readonly guardedBlanks: readonly CrystallineGraphicsRect[];
  readonly crystalContacts: readonly CrystallineGraphicsContactControl[];
  readonly metalContacts: readonly CrystallineGraphicsContactControl[];
}

/** Stable four-card scene for cold/crystalline material-identity gates. */
export const CRYSTALLINE_GRAPHICS_ATLAS: readonly CrystallineGraphicsAtlasEntry[] =
  CRYSTALLINE_GRAPHICS_DEFINITIONS.map((definition, index) => {
    const column = index % CRYSTALLINE_GRAPHICS_ATLAS_COLUMNS;
    const row = Math.floor(index / CRYSTALLINE_GRAPHICS_ATLAS_COLUMNS);
    const card = {
      x: CARD_ORIGIN_X + column * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y + row * CARD_STRIDE_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    // The 320x192 body stride is an exact multiple of the shared 32-cell motif.
    // Every card therefore sees the same world-space motif phase.
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
      x: body.x + 100,
      y: body.y,
      width: 4,
      height: 38,
    };
    const nextDefinition = CRYSTALLINE_GRAPHICS_DEFINITIONS[
      (index + 1) % CRYSTALLINE_GRAPHICS_DEFINITIONS.length
    ];
    return {
      ...definition,
      index,
      left: card.x,
      top: card.y,
      width: card.width,
      height: card.height,
      card,
      body,
      surfaceProbe: { x: body.x + 20, y: body.y + 8, width: 24, height: 12 },
      coreProbe: { x: body.x + 20, y: body.y + 80, width: 24, height: 12 },
      authoredCavity,
      openChimney,
      haloOuter: {
        x: body.x - 4,
        y: body.y - 4,
        width: body.width + 8,
        height: body.height + 8,
      },
      fineStructure: buildFineStructure(definition.material, card, body),
      isolated: { x: card.x + 290, y: card.y + 18 },
      guardedBlank: { x: card.x + 214, y: card.y + 132, width: 70, height: 40 },
      crystalContact: {
        owner: { x: card.x + 16, y: card.y + 150, width: 12, height: 16 },
        neighbour: { x: card.x + 28, y: card.y + 150, width: 16, height: 16 },
        neighbourMaterial: nextDefinition.material,
      },
      metalContact: {
        owner: { x: card.x + 100, y: card.y + 150, width: 12, height: 16 },
        neighbour: { x: card.x + 112, y: card.y + 150, width: 16, height: 16 },
        neighbourMaterial: Material.Metal,
      },
      motifProbes: buildMotifProbes(body, authoredCavity, openChimney),
    } satisfies CrystallineGraphicsAtlasEntry;
  });

export const CRYSTALLINE_GRAPHICS_AUDIT: CrystallineGraphicsAuditSnapshot = {
  cards: CRYSTALLINE_GRAPHICS_ATLAS,
  cavities: CRYSTALLINE_GRAPHICS_ATLAS.flatMap(({ authoredCavity }) => (
    rectPoints(authoredCavity)
  )),
  openChimneys: CRYSTALLINE_GRAPHICS_ATLAS.flatMap(({ openChimney }) => (
    rectPoints(openChimney)
  )),
  fineStructures: CRYSTALLINE_GRAPHICS_ATLAS.flatMap(({ fineStructure }) => fineStructure),
  motifProbes: CRYSTALLINE_GRAPHICS_ATLAS.flatMap(({ motifProbes }) => motifProbes),
  isolated: CRYSTALLINE_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  guardedBlanks: CRYSTALLINE_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  crystalContacts: CRYSTALLINE_GRAPHICS_ATLAS.map(({ crystalContact }) => crystalContact),
  metalContacts: CRYSTALLINE_GRAPHICS_ATLAS.map(({ metalContact }) => metalContact),
};

/** Direct-fills one paused 2x2 crystal scene without crossing the particle-brush ABI. */
export function prepareCrystallineGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Crystalline graphics audit fixture requires the deterministic backend');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Crystalline graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of CRYSTALLINE_GRAPHICS_ATLAS) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.authoredCavity, Material.Empty);
    fillRect(cells, simulation.width, entry.openChimney, Material.Empty);
    for (const point of entry.fineStructure) {
      cells[point.y * simulation.width + point.x] = entry.material;
    }
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    for (const contact of [entry.crystalContact, entry.metalContact]) {
      fillRect(cells, simulation.width, contact.owner, entry.material);
      fillRect(cells, simulation.width, contact.neighbour, contact.neighbourMaterial);
    }
  }
}

function buildFineStructure(
  material: CrystallineGraphicsMaterial,
  card: CrystallineGraphicsRect,
  body: CrystallineGraphicsRect,
): readonly CrystallineGraphicsPoint[] {
  const points = rectPoints({
    x: body.x + 71,
    y: body.y + body.height,
    width: 1,
    height: 24,
  });
  const sx = card.x + 178;
  const sy = card.y + 22;
  if (material === Material.DRIC) {
    points.push(
      ...rectPoints({ x: sx, y: sy, width: 32, height: 1 }),
      ...rectPoints({ x: sx + 4, y: sy + 8, width: 24, height: 1 }),
      ...rectPoints({ x: sx + 9, y: sy + 16, width: 15, height: 1 }),
    );
  } else if (material === Material.NICE) {
    points.push(
      ...rectPoints({ x: sx + 16, y: sy, width: 1, height: 50 }),
      ...rectPoints({ x: sx + 6, y: sy + 12, width: 21, height: 1 }),
      ...rectPoints({ x: sx + 2, y: sy + 25, width: 29, height: 1 }),
      ...rectPoints({ x: sx + 8, y: sy + 38, width: 17, height: 1 }),
    );
  } else if (material === Material.QRTZ) {
    const centreX = sx + 16;
    const centreY = sy + 20;
    for (let dx = -12; dx <= 12; dx++) {
      const dy = 12 - Math.abs(dx);
      points.push({ x: centreX + dx, y: centreY - dy });
      if (dy !== 0) points.push({ x: centreX + dx, y: centreY + dy });
    }
    points.push(...rectPoints({ x: centreX, y: centreY + 13, width: 1, height: 16 }));
  } else {
    const centreX = sx + 16;
    points.push(...rectPoints({ x: centreX, y: sy, width: 1, height: 52 }));
    for (const branchBase of [14, 28, 42]) {
      for (let reach = 1; reach <= 10; reach++) {
        const y = sy + branchBase - reach;
        points.push({ x: centreX - reach, y }, { x: centreX + reach, y });
      }
    }
  }
  return uniquePoints(points);
}

function buildMotifProbes(
  body: CrystallineGraphicsRect,
  authoredCavity: CrystallineGraphicsRect,
  openChimney: CrystallineGraphicsRect,
): readonly CrystallineGraphicsMotifProbeSet[] {
  const probes: CrystallineGraphicsMotifProbeSet[] = [];
  const firstTileX = Math.ceil(body.x / 32) * 32;
  const firstTileY = Math.ceil(body.y / 32) * 32;
  for (let tileY = firstTileY; tileY + 32 <= body.y + body.height; tileY += 32) {
    for (let tileX = firstTileX; tileX + 32 <= body.x + body.width; tileX += 32) {
      const probe = {
        tileOrigin: { x: tileX, y: tileY },
        key: { x: tileX, y: tileY, width: 1, height: 1 },
        facet: { x: tileX + 8, y: tileY, width: 1, height: 1 },
        joint: { x: tileX + 6, y: tileY + 2, width: 1, height: 1 },
        shadow: { x: tileX + 8, y: tileY + 1, width: 1, height: 1 },
        interstitial: { x: tileX + 3, y: tileY, width: 1, height: 1 },
      } satisfies CrystallineGraphicsMotifProbeSet;
      if (motifProbeRects(probe).every((rect) => rectInside(rect, body)
        && !rectanglesOverlap(rect, authoredCavity)
        && !rectanglesOverlap(rect, openChimney))) probes.push(probe);
    }
  }
  return probes;
}

function motifProbeRects(
  probe: CrystallineGraphicsMotifProbeSet,
): readonly CrystallineGraphicsRect[] {
  return [probe.key, probe.facet, probe.joint, probe.shadow, probe.interstitial];
}

function fillRect(
  cells: Uint8Array,
  worldWidth: number,
  rect: CrystallineGraphicsRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function rectPoints(rect: CrystallineGraphicsRect): CrystallineGraphicsPoint[] {
  const points: CrystallineGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}

function uniquePoints(points: readonly CrystallineGraphicsPoint[]): CrystallineGraphicsPoint[] {
  return [...new Map(points.map((point) => [`${point.x},${point.y}`, point])).values()];
}

function rectInside(
  inner: CrystallineGraphicsRect,
  outer: CrystallineGraphicsRect,
): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(
  left: CrystallineGraphicsRect,
  right: CrystallineGraphicsRect,
): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}
