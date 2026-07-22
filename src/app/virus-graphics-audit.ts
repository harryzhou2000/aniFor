import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const VIRUS_GRAPHICS_ATLAS_COLUMNS = 3;
export const VIRUS_GRAPHICS_ATLAS_ROWS = 1;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 4;
const CARD_STRIDE_X = 192;
const CARD_WIDTH = 188;
const CARD_HEIGHT = 376;

export type VirusGraphicsPhase = 'liquid' | 'gas' | 'solid';
export type VirusPhaseStructureKind = 'strand' | 'wisps' | 'spur-shell';
export type VirusMotifProbeKind =
  | 'attachment'
  | 'membrane'
  | 'capsid'
  | 'core'
  | 'interstitial';

export const VIRUS_GRAPHICS_DEFINITIONS = [
  { material: Material.VIRS, code: 'VIRS', color: '#fe11f6', phase: 'liquid' },
  { material: Material.VRSG, code: 'VRSG', color: '#fe68fe', phase: 'gas' },
  { material: Material.VRSS, code: 'VRSS', color: '#d408cd', phase: 'solid' },
] as const satisfies readonly {
  material: Material;
  code: string;
  color: string;
  phase: VirusGraphicsPhase;
}[];

export interface VirusGraphicsPoint {
  readonly x: number;
  readonly y: number;
}

export interface VirusGraphicsRect extends VirusGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface VirusGraphicsContactControl {
  readonly owner: VirusGraphicsRect;
  readonly neighbour: VirusGraphicsRect;
  readonly neighbourMaterial: Material.Water | Material.Metal;
}

export interface VirusGraphicsShellControl {
  readonly outer: VirusGraphicsRect;
  readonly interior: VirusGraphicsRect;
}

/** One phase-aligned 2x2 probe set from a complete 16x16 world motif tile. */
export interface VirusGraphicsMotifProbeSet {
  readonly tileOrigin: VirusGraphicsPoint;
  readonly attachment: VirusGraphicsRect;
  readonly membrane: VirusGraphicsRect;
  readonly capsid: VirusGraphicsRect;
  readonly core: VirusGraphicsRect;
  readonly interstitial: VirusGraphicsRect;
}

export interface VirusGraphicsAtlasEntry {
  readonly material: (typeof VIRUS_GRAPHICS_DEFINITIONS)[number]['material'];
  readonly code: (typeof VIRUS_GRAPHICS_DEFINITIONS)[number]['code'];
  readonly color: (typeof VIRUS_GRAPHICS_DEFINITIONS)[number]['color'];
  readonly phase: VirusGraphicsPhase;
  readonly index: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly card: VirusGraphicsRect;
  /** Identical phase-aligned semantic body used for cross-phase comparisons. */
  readonly body: VirusGraphicsRect;
  readonly surfaceProbe: VirusGraphicsRect;
  readonly coreProbe: VirusGraphicsRect;
  /** Exact semantic air retained at the centre of every phase body. */
  readonly authoredCavity: VirusGraphicsRect;
  /** Exact semantic air joining the cavity to the body's top edge. */
  readonly openChimney: VirusGraphicsRect;
  /** Four-cell expansion used to distinguish gas halo from matter contours. */
  readonly haloOuter: VirusGraphicsRect;
  readonly phaseStructureKind: VirusPhaseStructureKind;
  /** Strand, sparse wisp carriers, or solid spur/shell cells for this phase. */
  readonly phaseStructure: readonly VirusGraphicsPoint[];
  /** Only VRSG owns this deliberately empty gap between its carrier wisps. */
  readonly phaseGap?: VirusGraphicsRect;
  /** Only VRSS owns this explicit one-cell shell topology. */
  readonly shell?: VirusGraphicsShellControl;
  readonly isolated: VirusGraphicsPoint;
  readonly guardedBlank: VirusGraphicsRect;
  readonly waterContact: VirusGraphicsContactControl;
  readonly metalContact: VirusGraphicsContactControl;
  readonly motifProbes: readonly VirusGraphicsMotifProbeSet[];
}

export interface VirusGraphicsAuditSnapshot {
  readonly cards: readonly VirusGraphicsAtlasEntry[];
  readonly liquidCards: readonly VirusGraphicsAtlasEntry[];
  readonly gasCards: readonly VirusGraphicsAtlasEntry[];
  readonly solidCards: readonly VirusGraphicsAtlasEntry[];
  readonly cavities: readonly VirusGraphicsPoint[];
  readonly openChimneys: readonly VirusGraphicsPoint[];
  readonly phaseStructures: readonly VirusGraphicsPoint[];
  readonly motifProbes: readonly VirusGraphicsMotifProbeSet[];
  readonly isolated: readonly VirusGraphicsPoint[];
  readonly guardedBlanks: readonly VirusGraphicsRect[];
  readonly waterContacts: readonly VirusGraphicsContactControl[];
  readonly metalContacts: readonly VirusGraphicsContactControl[];
}

const GAS_WISP_OFFSETS = [
  { x: 20, y: 174 }, { x: 23, y: 171 }, { x: 26, y: 169 },
  { x: 29, y: 168 }, { x: 32, y: 169 }, { x: 35, y: 171 },
  { x: 38, y: 174 }, { x: 41, y: 176 }, { x: 44, y: 177 },
  { x: 47, y: 176 }, { x: 50, y: 174 }, { x: 53, y: 171 },
  { x: 99, y: 177 }, { x: 102, y: 174 }, { x: 105, y: 172 },
  { x: 108, y: 171 }, { x: 111, y: 172 }, { x: 114, y: 174 },
  { x: 117, y: 177 }, { x: 120, y: 179 }, { x: 123, y: 180 },
  { x: 126, y: 179 }, { x: 129, y: 177 }, { x: 132, y: 174 },
] as const;

/** Stable three-card scene shared by paired Canvas/WebGL and true-8x gates. */
export const VIRUS_GRAPHICS_ATLAS: readonly VirusGraphicsAtlasEntry[] =
  VIRUS_GRAPHICS_DEFINITIONS.map((definition, index) => {
    const card = {
      x: CARD_ORIGIN_X + index * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 12, y: 20, width: 112, height: 112 };
    const authoredCavity = {
      x: body.x + 50,
      y: body.y + 50,
      width: 12,
      height: 12,
    };
    const openChimney = {
      x: body.x + 54,
      y: body.y,
      width: 4,
      height: 50,
    };
    const strandOrSpur = { x: body.x + 56, y: body.y + body.height, width: 1, height: 24 };
    const shellOuter = { x: card.x + 140, y: 154, width: 18, height: 18 };
    const shell = {
      outer: shellOuter,
      interior: {
        x: shellOuter.x + 1,
        y: shellOuter.y + 1,
        width: shellOuter.width - 2,
        height: shellOuter.height - 2,
      },
    };
    const gasWisps = GAS_WISP_OFFSETS.map(({ x, y }) => ({ x: card.x + x, y }));
    const phaseStructure = definition.phase === 'gas'
      ? gasWisps
      : definition.phase === 'solid'
        ? [...rectPoints(strandOrSpur), ...shellPoints(shell)]
        : rectPoints(strandOrSpur);
    const phaseStructureKind = definition.phase === 'gas'
      ? 'wisps'
      : definition.phase === 'solid' ? 'spur-shell' : 'strand';
    return {
      ...definition,
      index,
      left: card.x,
      top: card.y,
      width: card.width,
      height: card.height,
      card,
      body,
      surfaceProbe: { x: body.x + 8, y: body.y + 8, width: 16, height: 12 },
      coreProbe: { x: body.x + 8, y: body.y + 88, width: 16, height: 12 },
      authoredCavity,
      openChimney,
      haloOuter: {
        x: body.x - 4,
        y: body.y - 4,
        width: body.width + 8,
        height: body.height + 8,
      },
      phaseStructureKind,
      phaseStructure,
      ...(definition.phase === 'gas'
        ? { phaseGap: { x: card.x + 67, y: 164, width: 24, height: 24 } }
        : {}),
      ...(definition.phase === 'solid' ? { shell } : {}),
      isolated: { x: card.x + 166, y: 48 },
      guardedBlank: { x: card.x + 132, y: 308, width: 44, height: 52 },
      waterContact: {
        owner: { x: card.x + 12, y: 252, width: 12, height: 16 },
        neighbour: { x: card.x + 24, y: 252, width: 16, height: 16 },
        neighbourMaterial: Material.Water,
      },
      metalContact: {
        owner: { x: card.x + 76, y: 252, width: 12, height: 16 },
        neighbour: { x: card.x + 88, y: 252, width: 16, height: 16 },
        neighbourMaterial: Material.Metal,
      },
      motifProbes: buildMotifProbes(body, authoredCavity, openChimney),
    } satisfies VirusGraphicsAtlasEntry;
  });

export const VIRUS_GRAPHICS_AUDIT: VirusGraphicsAuditSnapshot = {
  cards: VIRUS_GRAPHICS_ATLAS,
  liquidCards: VIRUS_GRAPHICS_ATLAS.filter(({ phase }) => phase === 'liquid'),
  gasCards: VIRUS_GRAPHICS_ATLAS.filter(({ phase }) => phase === 'gas'),
  solidCards: VIRUS_GRAPHICS_ATLAS.filter(({ phase }) => phase === 'solid'),
  cavities: VIRUS_GRAPHICS_ATLAS.flatMap(({ authoredCavity }) => rectPoints(authoredCavity)),
  openChimneys: VIRUS_GRAPHICS_ATLAS.flatMap(({ openChimney }) => rectPoints(openChimney)),
  phaseStructures: VIRUS_GRAPHICS_ATLAS.flatMap(({ phaseStructure }) => phaseStructure),
  motifProbes: VIRUS_GRAPHICS_ATLAS.flatMap(({ motifProbes }) => motifProbes),
  isolated: VIRUS_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  guardedBlanks: VIRUS_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  waterContacts: VIRUS_GRAPHICS_ATLAS.map(({ waterContact }) => waterContact),
  metalContacts: VIRUS_GRAPHICS_ATLAS.map(({ metalContact }) => metalContact),
};

/** Direct-fills one paused cross-phase scene without crossing the particle-brush ABI. */
export function prepareVirusGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Virus graphics audit fixture requires the deterministic backend');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Virus graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of VIRUS_GRAPHICS_ATLAS) {
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

function buildMotifProbes(
  body: VirusGraphicsRect,
  authoredCavity: VirusGraphicsRect,
  openChimney: VirusGraphicsRect,
): readonly VirusGraphicsMotifProbeSet[] {
  const probes: VirusGraphicsMotifProbeSet[] = [];
  const firstTileX = Math.ceil(body.x / 16) * 16;
  const firstTileY = Math.ceil(body.y / 16) * 16;
  for (let tileY = firstTileY; tileY + 16 <= body.y + body.height; tileY += 16) {
    for (let tileX = firstTileX; tileX + 16 <= body.x + body.width; tileX += 16) {
      const set = {
        tileOrigin: { x: tileX, y: tileY },
        // Every 2x2 block is aligned to the half-resolution atmosphere field.
        attachment: { x: tileX, y: tileY + 8, width: 2, height: 2 },
        membrane: { x: tileX + 2, y: tileY + 8, width: 2, height: 2 },
        capsid: { x: tileX + 4, y: tileY + 8, width: 2, height: 2 },
        core: { x: tileX + 6, y: tileY + 8, width: 2, height: 2 },
        interstitial: { x: tileX + 14, y: tileY + 14, width: 2, height: 2 },
      } satisfies VirusGraphicsMotifProbeSet;
      const regions = motifProbeRects(set);
      if (regions.every((rect) => rectInside(rect, body)
        && !rectanglesOverlap(rect, authoredCavity)
        && !rectanglesOverlap(rect, openChimney))) probes.push(set);
    }
  }
  return probes;
}

function motifProbeRects(probe: VirusGraphicsMotifProbeSet): readonly VirusGraphicsRect[] {
  return [probe.attachment, probe.membrane, probe.capsid, probe.core, probe.interstitial];
}

function fillRect(
  cells: Uint8Array,
  worldWidth: number,
  rect: VirusGraphicsRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.x + rect.width);
  }
}

function rectPoints(rect: VirusGraphicsRect): VirusGraphicsPoint[] {
  const points: VirusGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}

function shellPoints(shell: VirusGraphicsShellControl): VirusGraphicsPoint[] {
  return rectPoints(shell.outer).filter(({ x, y }) => (
    x < shell.interior.x || x >= shell.interior.x + shell.interior.width
      || y < shell.interior.y || y >= shell.interior.y + shell.interior.height
  ));
}

function rectInside(inner: VirusGraphicsRect, outer: VirusGraphicsRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(left: VirusGraphicsRect, right: VirusGraphicsRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}
