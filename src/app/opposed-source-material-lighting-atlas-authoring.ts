import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation/types';
import type {
  OpposedSourceAtlasCard,
  OpposedSourceAtlasDescriptor,
  OpposedSourceAtlasPoint,
  OpposedSourceAtlasRect,
} from '../shared/opposed-source-material-lighting-atlas-catalog.js';

export type PowderLightVfxAuditPoint = OpposedSourceAtlasPoint;
export type PowderLightVfxAuditRect = OpposedSourceAtlasRect;
export type PowderLightVfxCard = OpposedSourceAtlasCard;

export interface PowderLightVfxAuditSnapshot extends Omit<OpposedSourceAtlasDescriptor, 'materials' | 'conductiveWall' | 'inspectionRegions' | 'wetSuspension'> {
  readonly wetSuspension: Omit<OpposedSourceAtlasDescriptor['wetSuspension'], 'sandWeave'> & {
    readonly sandPoints: readonly OpposedSourceAtlasPoint[];
  };
}

interface WallFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
}

const validatePoint = (
  point: OpposedSourceAtlasPoint,
  world: { readonly width: number; readonly height: number },
  label: string,
): void => {
  if (!Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y)
    || point.x < 0 || point.y < 0 || point.x >= world.width || point.y >= world.height) {
    throw new TypeError(`Opposed-source material-lighting atlas ${label} escapes its world`);
  }
};

const validateRect = (
  area: OpposedSourceAtlasRect,
  world: { readonly width: number; readonly height: number },
  label: string,
): void => {
  validatePoint(area, world, label);
  if (!Number.isSafeInteger(area.width) || !Number.isSafeInteger(area.height)
    || area.width < 1 || area.height < 1
    || area.x + area.width > world.width || area.y + area.height > world.height) {
    throw new TypeError(`Opposed-source material-lighting atlas ${label} escapes its world`);
  }
};

export function validateOpposedSourceMaterialLightingAtlas(
  atlas: OpposedSourceAtlasDescriptor,
  world: { readonly width: number; readonly height: number },
): void {
  if (world.width !== 612 || world.height !== 384) {
    throw new TypeError('Opposed-source material-lighting atlas world must be 612x384');
  }
  for (const [name, material] of Object.entries(atlas.materials)) {
    if (!Number.isSafeInteger(material) || material < Material.Empty || material > 255
      || (name !== 'empty' && material === Material.Empty)) {
      throw new TypeError(`Opposed-source material-lighting atlas material ${name} is malformed`);
    }
  }
  if (!Number.isSafeInteger(atlas.conductiveWall) || atlas.conductiveWall < 1
    || atlas.conductiveWall > 255 || atlas.cards.length !== 3) {
    throw new TypeError('Opposed-source material-lighting atlas topology is malformed');
  }
  const codes = new Set<string>();
  const owners = new Set<number>();
  for (const card of atlas.cards) {
    if (!/^[A-Z0-9]{2,8}$/.test(card.code) || codes.has(card.code)
      || owners.has(card.material) || !Object.values(atlas.materials).includes(card.material)) {
      throw new TypeError('Opposed-source material-lighting atlas cards are malformed');
    }
    codes.add(card.code);
    owners.add(card.material);
  }
  const rects: readonly (readonly [string, OpposedSourceAtlasRect])[] = [
    ...atlas.cards.flatMap((card, index) => ([
      [`card ${index} body`, card.body], [`card ${index} warm source`, card.warmSource],
      [`card ${index} cool source`, card.coolSource], [`card ${index} warm gap`, card.warmGap],
      [`card ${index} cool gap`, card.coolGap], [`card ${index} hole`, card.authoredHole],
      [`card ${index} fine column`, card.fineColumn], [`card ${index} fine source`, card.fineSource],
      [`card ${index} fine gap`, card.fineGap], [`card ${index} dark core`, card.darkCore],
    ] as const)),
    ['wet water', atlas.wetSuspension.water], ['wet mixture', atlas.wetSuspension.mixture],
    ['wet source', atlas.wetSuspension.source], ['wet gap', atlas.wetSuspension.gap],
    ['transport wall', atlas.transportOccluder.wall],
    ['transport front', atlas.transportOccluder.litFrontShoulder],
    ['transport umbra', atlas.transportOccluder.umbra],
    ['transport open', atlas.transportOccluder.openShoulder],
    ['wall-free control', atlas.wallFreeControl],
    ...atlas.inspectionRegions.map((region) => [`inspection ${region.name}`, region] as const),
  ];
  for (const [name, area] of rects) validateRect(area, world, name);
  validatePoint(atlas.isolatedSand, world, 'isolated Sand');
  validatePoint(atlas.wetSuspension.lightFacingSand, world, 'wet Sand probe');
  validatePoint(atlas.nativeWall, world, 'native wall');
  const names = new Set<string>();
  for (const region of atlas.inspectionRegions) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(region.name) || names.has(region.name)
      || (region.role !== 'response' && region.role !== 'control')) {
      throw new TypeError('Opposed-source material-lighting atlas inspection regions are malformed');
    }
    names.add(region.name);
  }
  const weave = atlas.wetSuspension.sandWeave;
  if (!Number.isSafeInteger(weave.period) || weave.period < 2 || weave.period > 16
    || !Array.isArray(weave.sandResidues) || weave.sandResidues.length === 0
    || new Set(weave.sandResidues).size !== weave.sandResidues.length
    || weave.sandResidues.some((residue) => !Number.isSafeInteger(residue)
      || residue < 0 || residue >= weave.period)) {
    throw new TypeError('Opposed-source material-lighting atlas Sand weave is malformed');
  }
}

export function createPowderLightVfxAuditSnapshot(
  atlas: OpposedSourceAtlasDescriptor,
  world: { readonly width: number; readonly height: number },
): PowderLightVfxAuditSnapshot {
  validateOpposedSourceMaterialLightingAtlas(atlas, world);
  return Object.freeze({
    cards: atlas.cards,
    isolatedSand: atlas.isolatedSand,
    wetSuspension: Object.freeze({
      water: atlas.wetSuspension.water,
      mixture: atlas.wetSuspension.mixture,
      source: atlas.wetSuspension.source,
      gap: atlas.wetSuspension.gap,
      lightFacingSand: atlas.wetSuspension.lightFacingSand,
      sandPoints: buildWetSandPoints(
        atlas.wetSuspension.mixture,
        atlas.wetSuspension.sandWeave.period,
        new Set(atlas.wetSuspension.sandWeave.sandResidues),
      ),
    }),
    nativeWall: atlas.nativeWall,
    transportOccluder: atlas.transportOccluder,
    wallFreeControl: atlas.wallFreeControl,
  });
}

export function prepareOpposedSourceMaterialLightingAtlas(
  simulation: SimulationBackend,
  atlas: OpposedSourceAtlasDescriptor,
  world: { readonly width: number; readonly height: number },
  label: string,
): void {
  const snapshot = createPowderLightVfxAuditSnapshot(atlas, world);
  if (simulation.width !== world.width || simulation.height !== world.height) {
    throw new Error(`${label} requires ${world.width}x${world.height}`);
  }
  if (!supportsWallFixtureBackend(simulation)) throw new Error(`${label} requires native wall support`);
  simulation.clear();
  for (const entry of snapshot.cards) {
    paintRect(simulation, entry.body, entry.material);
    paintRect(simulation, entry.warmSource, atlas.materials.fire);
    paintRect(simulation, entry.coolSource, atlas.materials.elec);
    eraseRect(simulation, entry.authoredHole);
    paintRect(simulation, entry.fineColumn, entry.material);
    paintRect(simulation, entry.fineSource, atlas.materials.fire);
    eraseRect(simulation, entry.fineGap);
  }
  paintPoint(simulation, snapshot.isolatedSand, atlas.materials.sand);
  paintRect(simulation, snapshot.wetSuspension.water, atlas.materials.water);
  paintRect(simulation, snapshot.wetSuspension.source, atlas.materials.fire);
  eraseRect(simulation, snapshot.wetSuspension.gap);
  for (const point of snapshot.wetSuspension.sandPoints) paintPoint(simulation, point, atlas.materials.sand);
  simulation.paintWall(snapshot.nativeWall.x, snapshot.nativeWall.y, atlas.conductiveWall, 0);
  forEachPoint(snapshot.transportOccluder.wall, (point) => {
    simulation.paintWall(point.x, point.y, atlas.conductiveWall, 0);
  });
}

function supportsWallFixtureBackend(simulation: SimulationBackend): simulation is WallFixtureBackend {
  return typeof simulation.walls === 'function' && typeof simulation.paintWall === 'function';
}

function paintRect(simulation: SimulationBackend, area: OpposedSourceAtlasRect, material: number): void {
  forEachPoint(area, (point) => simulation.paint(point.x, point.y, material as Material, 0));
}

function eraseRect(simulation: SimulationBackend, area: OpposedSourceAtlasRect): void {
  forEachPoint(area, (point) => simulation.erase(point.x, point.y, 0));
}

function paintPoint(simulation: SimulationBackend, point: OpposedSourceAtlasPoint, material: number): void {
  simulation.paint(point.x, point.y, material as Material, 0);
}

function forEachPoint(area: OpposedSourceAtlasRect, visit: (point: OpposedSourceAtlasPoint) => void): void {
  for (let y = area.y; y < area.y + area.height; y++) {
    for (let x = area.x; x < area.x + area.width; x++) visit({ x, y });
  }
}

function buildWetSandPoints(
  area: OpposedSourceAtlasRect,
  period: number,
  sandResidues: ReadonlySet<number>,
): readonly OpposedSourceAtlasPoint[] {
  const points: OpposedSourceAtlasPoint[] = [];
  forEachPoint(area, (point) => {
    if (sandResidues.has((point.x - area.x + point.y - area.y) % period)) {
      points.push(Object.freeze(point));
    }
  });
  return Object.freeze(points);
}
