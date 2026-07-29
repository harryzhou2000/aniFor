import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const WAX_GRAPHICS_ATLAS_COLUMNS = 2;
export const WAX_GRAPHICS_ATLAS_ROWS = 1;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 4;
const CARD_STRIDE_X = 304;
const CARD_WIDTH = 300;
const CARD_HEIGHT = 376;

export type WaxGraphicsPhase = 'solid' | 'liquid';
export type WaxPhaseStructureKind = 'lamella-spur' | 'strand-droplets';
export type WaxMotifProbeKind = 'ridge' | 'fold' | 'bloom' | 'joint' | 'interstitial';

export const WAX_GRAPHICS_DEFINITIONS = [
  { material: Material.Wax, code: 'WAX', color: '#e0c278', phase: 'solid' },
  { material: Material.MWAX, code: 'MWAX', color: '#e0e0aa', phase: 'liquid' },
] as const satisfies readonly {
  material: Material;
  code: string;
  color: string;
  phase: WaxGraphicsPhase;
}[];

export interface WaxGraphicsPoint {
  readonly x: number;
  readonly y: number;
}

export interface WaxGraphicsRect extends WaxGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface WaxGraphicsContactControl {
  readonly owner: WaxGraphicsRect;
  readonly neighbour: WaxGraphicsRect;
  readonly neighbourMaterial: Material.Water | Material.Metal;
}

/** One phase-aligned probe set from a complete 32x32 world motif tile. */
export interface WaxGraphicsMotifProbeSet {
  readonly tileOrigin: WaxGraphicsPoint;
  readonly ridge: WaxGraphicsRect;
  readonly fold: WaxGraphicsRect;
  readonly bloom: WaxGraphicsRect;
  readonly joint: WaxGraphicsRect;
  readonly interstitial: WaxGraphicsRect;
}

export interface WaxGraphicsAtlasEntry {
  readonly material: (typeof WAX_GRAPHICS_DEFINITIONS)[number]['material'];
  readonly code: (typeof WAX_GRAPHICS_DEFINITIONS)[number]['code'];
  readonly color: (typeof WAX_GRAPHICS_DEFINITIONS)[number]['color'];
  readonly phase: WaxGraphicsPhase;
  readonly index: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly card: WaxGraphicsRect;
  /** Identical phase-aligned semantic body used for solid/liquid comparisons. */
  readonly body: WaxGraphicsRect;
  readonly surfaceProbe: WaxGraphicsRect;
  readonly coreProbe: WaxGraphicsRect;
  /** Exact semantic air retained at the centre of both phase bodies. */
  readonly authoredCavity: WaxGraphicsRect;
  /** Exact semantic air joining the cavity to the body's top edge. */
  readonly openChimney: WaxGraphicsRect;
  /** Six-cell expansion used to distinguish field support from matter contours. */
  readonly haloOuter: WaxGraphicsRect;
  readonly phaseStructureKind: WaxPhaseStructureKind;
  /** Thin lamellae/spur or a strand/rivulet/droplet topology for the phase. */
  readonly phaseStructure: readonly WaxGraphicsPoint[];
  readonly isolated: WaxGraphicsPoint;
  readonly guardedBlank: WaxGraphicsRect;
  readonly waterContact: WaxGraphicsContactControl;
  readonly metalContact: WaxGraphicsContactControl;
  readonly motifProbes: readonly WaxGraphicsMotifProbeSet[];
}

export interface WaxGraphicsAuditSnapshot {
  readonly cards: readonly WaxGraphicsAtlasEntry[];
  readonly solidCards: readonly WaxGraphicsAtlasEntry[];
  readonly liquidCards: readonly WaxGraphicsAtlasEntry[];
  readonly cavities: readonly WaxGraphicsPoint[];
  readonly openChimneys: readonly WaxGraphicsPoint[];
  readonly phaseStructures: readonly WaxGraphicsPoint[];
  readonly motifProbes: readonly WaxGraphicsMotifProbeSet[];
  readonly isolated: readonly WaxGraphicsPoint[];
  readonly guardedBlanks: readonly WaxGraphicsRect[];
  readonly waterContacts: readonly WaxGraphicsContactControl[];
  readonly metalContacts: readonly WaxGraphicsContactControl[];
}

/** Stable paired scene for phase-continuous Wax/MWAX graphics gates. */
export const WAX_GRAPHICS_ATLAS: readonly WaxGraphicsAtlasEntry[] =
  WAX_GRAPHICS_DEFINITIONS.map((definition, index) => {
    const card = {
      x: CARD_ORIGIN_X + index * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    // Cards need not share the motif period, but their bodies must: the paired
    // gate compares one 32-cell grammar across the native solid/liquid phases.
    const body = { x: 20 + index * 320, y: 20, width: 160, height: 128 };
    const authoredCavity = {
      x: body.x + 72,
      y: body.y + 54,
      width: 16,
      height: 14,
    };
    const openChimney = {
      x: body.x + 78,
      y: body.y,
      width: 4,
      height: 54,
    };
    const phaseStructure = definition.phase === 'solid'
      ? buildSolidStructure(card, body)
      : buildLiquidStructure(card, body);
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
      coreProbe: { x: body.x + 16, y: body.y + 100, width: 24, height: 12 },
      authoredCavity,
      openChimney,
      haloOuter: {
        x: body.x - 6,
        y: body.y - 6,
        width: body.width + 12,
        height: body.height + 12,
      },
      phaseStructureKind: definition.phase === 'solid' ? 'lamella-spur' : 'strand-droplets',
      phaseStructure,
      isolated: { x: card.x + 270, y: 48 },
      guardedBlank: { x: card.x + 208, y: 306, width: 72, height: 50 },
      waterContact: {
        owner: { x: card.x + 20, y: 260, width: 16, height: 20 },
        neighbour: { x: card.x + 36, y: 260, width: 20, height: 20 },
        neighbourMaterial: Material.Water,
      },
      metalContact: {
        owner: { x: card.x + 104, y: 260, width: 16, height: 20 },
        neighbour: { x: card.x + 120, y: 260, width: 20, height: 20 },
        neighbourMaterial: Material.Metal,
      },
      motifProbes: buildMotifProbes(body, authoredCavity, openChimney),
    } satisfies WaxGraphicsAtlasEntry;
  });

export const WAX_GRAPHICS_AUDIT: WaxGraphicsAuditSnapshot = {
  cards: WAX_GRAPHICS_ATLAS,
  solidCards: WAX_GRAPHICS_ATLAS.filter(({ phase }) => phase === 'solid'),
  liquidCards: WAX_GRAPHICS_ATLAS.filter(({ phase }) => phase === 'liquid'),
  cavities: WAX_GRAPHICS_ATLAS.flatMap(({ authoredCavity }) => rectPoints(authoredCavity)),
  openChimneys: WAX_GRAPHICS_ATLAS.flatMap(({ openChimney }) => rectPoints(openChimney)),
  phaseStructures: WAX_GRAPHICS_ATLAS.flatMap(({ phaseStructure }) => phaseStructure),
  motifProbes: WAX_GRAPHICS_ATLAS.flatMap(({ motifProbes }) => motifProbes),
  isolated: WAX_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  guardedBlanks: WAX_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  waterContacts: WAX_GRAPHICS_ATLAS.map(({ waterContact }) => waterContact),
  metalContacts: WAX_GRAPHICS_ATLAS.map(({ metalContact }) => metalContact),
};

/** Direct-fills one paused paired-phase scene without crossing the particle-brush ABI. */
export function prepareWaxGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Wax graphics audit fixture requires the deterministic backend');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Wax graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of WAX_GRAPHICS_ATLAS) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.authoredCavity, Material.Empty);
    fillRect(cells, simulation.width, entry.openChimney, Material.Empty);
    for (const point of entry.phaseStructure) {
      cells[point.y * simulation.width + point.x] = entry.material;
    }
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    for (const contact of [entry.waterContact, entry.metalContact]) {
      fillRect(cells, simulation.width, contact.owner, entry.material);
      fillRect(cells, simulation.width, contact.neighbour, contact.neighbourMaterial);
    }
  }
}

function buildSolidStructure(card: WaxGraphicsRect, body: WaxGraphicsRect): WaxGraphicsPoint[] {
  return [
    ...rectPoints({ x: body.x + 79, y: body.y + body.height, width: 2, height: 28 }),
    ...rectPoints({ x: card.x + 28, y: 184, width: 120, height: 1 }),
    ...rectPoints({ x: card.x + 40, y: 190, width: 96, height: 1 }),
    ...rectPoints({ x: card.x + 54, y: 196, width: 68, height: 1 }),
  ];
}

function buildLiquidStructure(card: WaxGraphicsRect, body: WaxGraphicsRect): WaxGraphicsPoint[] {
  const points = rectPoints({
    x: body.x + 79,
    y: body.y + body.height,
    width: 2,
    height: 30,
  });
  for (let step = 0; step < 32; step++) {
    const x = body.x + 81 + step;
    const y = body.y + body.height + 29 + Math.floor(step / 4);
    points.push({ x, y }, { x, y: y + 1 });
  }
  const centreX = card.x + 232;
  const centreY = 196;
  for (let dy = -2; dy <= 2; dy++) {
    const radius = Math.abs(dy) === 2 ? 1 : 2;
    for (let dx = -radius; dx <= radius; dx++) points.push({ x: centreX + dx, y: centreY + dy });
  }
  return points;
}

function buildMotifProbes(
  body: WaxGraphicsRect,
  authoredCavity: WaxGraphicsRect,
  openChimney: WaxGraphicsRect,
): readonly WaxGraphicsMotifProbeSet[] {
  const probes: WaxGraphicsMotifProbeSet[] = [];
  const firstTileX = Math.ceil(body.x / 32) * 32;
  const firstTileY = Math.ceil(body.y / 32) * 32;
  for (let tileY = firstTileY; tileY + 32 <= body.y + body.height; tileY += 32) {
    for (let tileX = firstTileX; tileX + 32 <= body.x + body.width; tileX += 32) {
      const set = {
        tileOrigin: { x: tileX, y: tileY },
        // Keep every probe at the centre of its local response neighbourhood.
        // The true-8x gate samples the composed CSS page over roughly three
        // world cells; the older locations sat immediately beside a different
        // motif (notably a ridge beside the "interstitial" point), which made
        // that visual assertion depend on downsample phase rather than the
        // shared WAX/MWAX grammar itself.
        ridge: { x: tileX + 26, y: tileY + 1, width: 1, height: 1 },
        fold: { x: tileX + 3, y: tileY + 3, width: 1, height: 1 },
        bloom: { x: tileX + 8, y: tileY + 1, width: 1, height: 1 },
        joint: { x: tileX + 12, y: tileY + 12, width: 1, height: 1 },
        interstitial: { x: tileX + 10, y: tileY + 8, width: 1, height: 1 },
      } satisfies WaxGraphicsMotifProbeSet;
      if (motifProbeRects(set).every((rect) => rectInside(rect, body)
        && !rectanglesOverlap(rect, authoredCavity)
        && !rectanglesOverlap(rect, openChimney))) probes.push(set);
    }
  }
  return probes;
}

function motifProbeRects(probe: WaxGraphicsMotifProbeSet): readonly WaxGraphicsRect[] {
  return [probe.ridge, probe.fold, probe.bloom, probe.joint, probe.interstitial];
}

function fillRect(
  cells: Uint8Array,
  worldWidth: number,
  rect: WaxGraphicsRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function rectPoints(rect: WaxGraphicsRect): WaxGraphicsPoint[] {
  const points: WaxGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}

function rectInside(inner: WaxGraphicsRect, outer: WaxGraphicsRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(left: WaxGraphicsRect, right: WaxGraphicsRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}
