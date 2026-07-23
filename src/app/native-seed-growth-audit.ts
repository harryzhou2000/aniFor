import { Material } from '../shared/materials';
import type { DirtyCell } from '../simulation/types';

export const NATIVE_SEED_GROWTH_TICKS = 900;
export const NATIVE_SEED_GROWTH_BACKEND_NAME = 'The Powder Toy 100.0 (direct WebAssembly)';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;

export interface NativeSeedGrowthPoint {
  readonly x: number;
  readonly y: number;
}

export interface NativeSeedGrowthRect extends NativeSeedGrowthPoint {
  readonly width: number;
  readonly height: number;
}

export type NativeSeedGrowthRegionKind = 'canonical' | 'no-water' | 'no-soil';

export interface NativeSeedGrowthRegion {
  readonly id: NativeSeedGrowthRegionKind;
  readonly bounds: NativeSeedGrowthRect;
  readonly foundation: NativeSeedGrowthRect;
  readonly soil?: NativeSeedGrowthRect;
  readonly water?: NativeSeedGrowthRect;
  readonly initialSeeds: readonly NativeSeedGrowthPoint[];
  readonly canopyProbe: NativeSeedGrowthRect;
  readonly seedProbe: NativeSeedGrowthRect;
  /** Canonical soil footprint, retained even for the no-soil control. */
  readonly substrateProbe: NativeSeedGrowthRect;
  /** Canonical water footprint, retained even for the no-water control. */
  readonly waterProbe: NativeSeedGrowthRect;
}

export interface NativeSeedGrowthMaterialCounts {
  readonly wood: number;
  readonly plant: number;
  readonly seed: number;
  readonly sand: number;
  readonly water: number;
  readonly wall: number;
}

export interface NativeSeedGrowthProbeSnapshot {
  readonly canopy: NativeSeedGrowthMaterialCounts;
  readonly seeds: NativeSeedGrowthMaterialCounts;
  readonly substrate: NativeSeedGrowthMaterialCounts;
  readonly water: NativeSeedGrowthMaterialCounts;
}

export interface NativeSeedGrowthRegionSnapshot extends NativeSeedGrowthRegion {
  readonly initialSeedCount: number;
  readonly finalWoodCount: number;
  readonly finalPlantCount: number;
  readonly finalGrowthCount: number;
  readonly finalSeedCount: number;
  readonly dirtyGrownCount: number;
  readonly finalGrowthBounds?: NativeSeedGrowthRect;
  readonly probes: NativeSeedGrowthProbeSnapshot;
}

export interface NativeSeedGrowthAuditSnapshot {
  readonly width: 612;
  readonly height: 384;
  readonly ticks: 900;
  readonly regions: readonly NativeSeedGrowthRegionSnapshot[];
  readonly initialSeeds: readonly NativeSeedGrowthPoint[];
  readonly initialSeedCount: number;
  readonly finalWoodCount: number;
  readonly finalPlantCount: number;
  readonly finalGrowthCount: number;
  readonly dirtyGrownCount: number;
  /** Growth outside the three guarded region bounds, which should remain zero. */
  readonly unassignedGrowthCount: number;
  readonly finalGrowthBounds?: NativeSeedGrowthRect;
}

/** Minimal official-native surface used by the audit; a fresh empty world is required. */
export interface NativeSeedGrowthBackend {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  paint(x: number, y: number, material: Material, radius: number): void;
  step(): void;
  cells(): Uint8Array;
  consumeDirtyCells(): readonly DirtyCell[];
  saveFile(): Uint8Array;
  loadFile(bytes: Uint8Array): void;
}

function planterRegion(id: NativeSeedGrowthRegionKind, offsetX: number): NativeSeedGrowthRegion {
  const soil = { x: 260 + offsetX, y: 242, width: 90, height: 8 };
  const water = { x: 270 + offsetX, y: 225, width: 25, height: 16 };
  return {
    id,
    bounds: { x: 245 + offsetX, y: 80, width: 120, height: 174 },
    foundation: { x: 250 + offsetX, y: 250, width: 110, height: 4 },
    soil: id === 'no-soil' ? undefined : soil,
    water: id === 'no-water' ? undefined : water,
    initialSeeds: Array.from({ length: 5 }, (_, index) => ({
      x: 305 + offsetX + index * 5,
      y: 241,
    })),
    canopyProbe: { x: 285 + offsetX, y: 100, width: 61, height: 142 },
    seedProbe: { x: 301 + offsetX, y: 237, width: 33, height: 9 },
    substrateProbe: soil,
    waterProbe: water,
  };
}

/** Three planters separated by 80-cell blank corridors in the shared 612x384 world. */
export const NATIVE_SEED_GROWTH_REGIONS: readonly NativeSeedGrowthRegion[] = [
  planterRegion('no-water', -200),
  planterRegion('canonical', 0),
  planterRegion('no-soil', 200),
];

/**
 * Builds and advances the official native TPT seed-growth proof. The caller owns
 * backend creation; requiring a fresh world keeps the audit deterministic. The
 * final official OPS reload re-arms the complete native dirty stream without
 * private Wasm access.
 */
export function runNativeSeedGrowthAudit(
  simulation: NativeSeedGrowthBackend,
): NativeSeedGrowthAuditSnapshot {
  assertNativeSeedGrowthBackend(simulation);
  const initialWorld = simulation.cells();
  if (initialWorld.some((material) => material !== Material.Empty)) {
    throw new Error('Native seed growth audit requires a fresh empty world');
  }

  for (const region of NATIVE_SEED_GROWTH_REGIONS) {
    paintRect(simulation, region.foundation, Material.Wall);
    if (region.soil) paintRect(simulation, region.soil, Material.Sand);
    if (region.water) paintRect(simulation, region.water, Material.Water);
    for (const seed of region.initialSeeds) simulation.paint(seed.x, seed.y, Material.SEED, 0);
  }

  const authoredWorld = simulation.cells();
  const initialSeeds = NATIVE_SEED_GROWTH_REGIONS.flatMap(({ initialSeeds: seeds }) => seeds);
  const initialSeedCount = initialSeeds.reduce((count, point) => (
    count + Number(materialAt(authoredWorld, point) === Material.SEED)
  ), 0);
  if (initialSeedCount !== initialSeeds.length) {
    throw new Error(`Native seed growth audit placed ${initialSeedCount}/${initialSeeds.length} seeds`);
  }

  // Establish the fully authored planter as the dirty baseline. The final dirty
  // set then proves which grown semantic cells changed during native stepping.
  simulation.consumeDirtyCells();
  for (let tick = 0; tick < NATIVE_SEED_GROWTH_TICKS; tick++) simulation.step();

  // Measure the native dirty stream, then reload the exact final OPS state. The
  // official backend deliberately invalidates its shadow on load, leaving every
  // final cell pending for the browser's first MaterialRenderer presentation.
  const finalSave = simulation.saveFile();
  const dirty = simulation.consumeDirtyCells();
  simulation.loadFile(finalSave);
  const world = simulation.cells();
  const regions = NATIVE_SEED_GROWTH_REGIONS.map((region) => snapshotRegion(world, dirty, region));
  const finalCounts = countMaterials(world, { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT });
  const dirtyGrownCount = dirty.reduce((count, cell) => (
    count + Number(cell.material === Material.Wood || cell.material === Material.Plant)
  ), 0);
  const assignedGrowthCount = regions.reduce((sum, region) => sum + region.finalGrowthCount, 0);

  return {
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    ticks: NATIVE_SEED_GROWTH_TICKS,
    regions,
    initialSeeds,
    initialSeedCount,
    finalWoodCount: finalCounts.wood,
    finalPlantCount: finalCounts.plant,
    finalGrowthCount: finalCounts.wood + finalCounts.plant,
    dirtyGrownCount,
    unassignedGrowthCount: finalCounts.wood + finalCounts.plant - assignedGrowthCount,
    finalGrowthBounds: materialBounds(world, { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT }),
  };
}

function assertNativeSeedGrowthBackend(simulation: NativeSeedGrowthBackend): void {
  if (simulation.name !== NATIVE_SEED_GROWTH_BACKEND_NAME) {
    throw new Error('Native seed growth audit requires the official PowderToyBackend');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Native seed growth audit requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  for (const capability of [
    'paint', 'step', 'cells', 'consumeDirtyCells', 'saveFile', 'loadFile',
  ] as const) {
    if (typeof simulation[capability] !== 'function') {
      throw new Error(`Native seed growth audit requires PowderToyBackend.${capability}()`);
    }
  }
}

function snapshotRegion(
  world: Uint8Array,
  dirty: readonly DirtyCell[],
  region: NativeSeedGrowthRegion,
): NativeSeedGrowthRegionSnapshot {
  const counts = countMaterials(world, region.bounds);
  const dirtyGrownCount = dirty.reduce((count, cell) => {
    if (cell.material !== Material.Wood && cell.material !== Material.Plant) return count;
    const point = { x: cell.index % WORLD_WIDTH, y: Math.floor(cell.index / WORLD_WIDTH) };
    return count + Number(pointInside(point, region.bounds));
  }, 0);
  return {
    ...region,
    initialSeedCount: region.initialSeeds.length,
    finalWoodCount: counts.wood,
    finalPlantCount: counts.plant,
    finalGrowthCount: counts.wood + counts.plant,
    finalSeedCount: counts.seed,
    dirtyGrownCount,
    finalGrowthBounds: materialBounds(world, region.bounds),
    probes: {
      canopy: countMaterials(world, region.canopyProbe),
      seeds: countMaterials(world, region.seedProbe),
      substrate: countMaterials(world, region.substrateProbe),
      water: countMaterials(world, region.waterProbe),
    },
  };
}

function paintRect(
  simulation: NativeSeedGrowthBackend,
  rect: NativeSeedGrowthRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) simulation.paint(x, y, material, 0);
  }
}

function countMaterials(world: Uint8Array, rect: NativeSeedGrowthRect): NativeSeedGrowthMaterialCounts {
  let wood = 0;
  let plant = 0;
  let seed = 0;
  let sand = 0;
  let water = 0;
  let wall = 0;
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const material = world[y * WORLD_WIDTH + x];
      if (material === Material.Wood) wood++;
      else if (material === Material.Plant) plant++;
      else if (material === Material.SEED) seed++;
      else if (material === Material.Sand) sand++;
      else if (material === Material.Water) water++;
      else if (material === Material.Wall) wall++;
    }
  }
  return { wood, plant, seed, sand, water, wall };
}

function materialBounds(
  world: Uint8Array,
  search: NativeSeedGrowthRect,
): NativeSeedGrowthRect | undefined {
  let left = search.x + search.width;
  let top = search.y + search.height;
  let right = search.x;
  let bottom = search.y;
  for (let y = search.y; y < search.y + search.height; y++) {
    for (let x = search.x; x < search.x + search.width; x++) {
      const material = world[y * WORLD_WIDTH + x];
      if (material !== Material.Wood && material !== Material.Plant) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }
  return right > left && bottom > top
    ? { x: left, y: top, width: right - left, height: bottom - top }
    : undefined;
}

function materialAt(world: Uint8Array, point: NativeSeedGrowthPoint): Material {
  return world[point.y * WORLD_WIDTH + point.x] as Material;
}

function pointInside(point: NativeSeedGrowthPoint, rect: NativeSeedGrowthRect): boolean {
  return point.x >= rect.x && point.y >= rect.y
    && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}
