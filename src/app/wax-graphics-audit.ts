import { Material } from '../shared/materials';
import {
  WAX_MATERIAL_LIGHTING_ATLAS_CATALOG,
} from '../shared/wax-material-lighting-atlas-catalog.js';
import type {
  WaxMaterialLightingAtlasCard,
  WaxMaterialLightingAtlasPoint,
  WaxMaterialLightingAtlasRect,
  WaxMaterialLightingContactControl,
  WaxMaterialLightingMotifProbeSet,
  WaxMaterialLightingPhase,
  WaxMaterialLightingPhaseStructureKind,
} from '../shared/wax-material-lighting-atlas-catalog.js';
import type { SimulationBackend } from '../simulation';

const AUTHORING = WAX_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases[0];
const { descriptor, world } = AUTHORING;

export const WAX_GRAPHICS_ATLAS_COLUMNS = descriptor.layout.columns;
export const WAX_GRAPHICS_ATLAS_ROWS = descriptor.layout.rows;

export type WaxGraphicsPhase = WaxMaterialLightingPhase;
export type WaxPhaseStructureKind = WaxMaterialLightingPhaseStructureKind;
export type WaxGraphicsPoint = WaxMaterialLightingAtlasPoint;
export type WaxGraphicsRect = WaxMaterialLightingAtlasRect;
export type WaxGraphicsContactControl = WaxMaterialLightingContactControl;
export type WaxGraphicsMotifProbeSet = WaxMaterialLightingMotifProbeSet;
export type WaxGraphicsAtlasEntry = WaxMaterialLightingAtlasCard;

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

/** Compatibility exports project the shared WAX/MWAX atlas unchanged. */
export const WAX_GRAPHICS_DEFINITIONS = descriptor.definitions;
export const WAX_GRAPHICS_ATLAS = descriptor.cards;
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
  if (simulation.width !== world.width || simulation.height !== world.height) {
    throw new Error(`Wax graphics audit fixture requires ${world.width}x${world.height}`);
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

function fillRect(
  cells: Uint8Array,
  worldWidth: number,
  rect: WaxGraphicsRect,
  material: number,
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
