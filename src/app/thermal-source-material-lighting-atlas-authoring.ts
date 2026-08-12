import { Material } from '../shared/materials';
import { ROOM_TEMPERATURE_DECIKELVIN } from '../shared/temperature';
import type { SimulationBackend } from '../simulation';
import type {
  ThermalSourceAtlasCard,
  ThermalSourceAtlasDescriptor,
  ThermalSourceAtlasPoint,
  ThermalSourceAtlasRect,
} from '../shared/thermal-source-material-lighting-atlas-catalog.js';

export type CeramicTemperatureVfxKey = ThermalSourceAtlasCard['key'];
export type CeramicTemperatureVfxPoint = ThermalSourceAtlasPoint;
export type CeramicTemperatureVfxRect = ThermalSourceAtlasRect;
export interface CeramicTemperatureVfxCard extends Omit<ThermalSourceAtlasCard, 'material'> {
  readonly material: Material.Ceramic;
}
export interface CeramicTemperatureVfxAuditSnapshot {
  readonly version: 1;
  readonly world: { readonly width: 612; readonly height: 384 };
  readonly material: Material.Ceramic;
  readonly ambientTemperature: number;
  readonly cards: readonly CeramicTemperatureVfxCard[];
  readonly conductiveWall: 1;
  readonly expected: ThermalSourceAtlasDescriptor['snapshot']['expected'];
}

interface CeramicTemperatureFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  temperature(): Uint16Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
  setFixtureTemperatureRect(
    x: number, y: number, width: number, height: number, temperature: number,
  ): void;
}

const EXPECTED_KEYS = ['ambient', 'onset', 'warm', 'orange', 'bright'] as const;
const EXPECTED_TEMPERATURES = [2_952, 8_192, 12_288, 15_360, 23_040] as const;
const SAFE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateThermalSourceMaterialLightingAtlas(
  descriptor: ThermalSourceAtlasDescriptor,
  world: { readonly width: number; readonly height: number },
): void {
  const snapshot = descriptor.snapshot;
  if (world.width !== 612 || world.height !== 384 || snapshot.version !== 1
    || snapshot.world.width !== world.width || snapshot.world.height !== world.height
    || snapshot.material !== Material.Ceramic
    || snapshot.ambientTemperature !== ROOM_TEMPERATURE_DECIKELVIN
    || snapshot.conductiveWall !== 1 || snapshot.wallBlockSize !== 4
    || descriptor.cards.length !== 5) {
    throw new TypeError('Ceramic thermal-source atlas topology is malformed');
  }
  const expectedMaterials = {
    empty: Material.Empty, water: Material.Water, fire: Material.Fire,
    brick: Material.Brick, metal: Material.Metal, ceramic: Material.Ceramic,
  };
  for (const [name, material] of Object.entries(expectedMaterials)) {
    if (descriptor.materials[name as keyof typeof expectedMaterials] !== material) {
      throw new TypeError('Ceramic thermal-source atlas materials are malformed');
    }
  }
  for (const [index, card] of descriptor.cards.entries()) {
    if (card.key !== EXPECTED_KEYS[index] || card.temperature !== EXPECTED_TEMPERATURES[index]
      || card.temperatureByte !== Math.floor(card.temperature / 256)
      || card.material !== Material.Ceramic
      || card.hotControls.brick.material !== Material.Brick
      || card.hotControls.metal.material !== Material.Metal) {
      throw new TypeError('Ceramic thermal-source atlas cards are malformed');
    }
    for (const rect of [
      card.card, card.body, card.core, card.authoredHole, card.openNotch, card.thinLine,
      card.wallCoexistence, card.waterContact.ceramic, card.waterContact.water,
      card.hotControls.brick, card.hotControls.metal, card.guardedBlank,
    ]) validateRect(rect, world);
    validatePoint(card.isolated, world);
  }
  const names = new Set<string>();
  for (const region of descriptor.inspectionRegions) {
    validateRect(region, world);
    if (!SAFE_NAME.test(region.name) || names.has(region.name)
      || (region.role !== 'response' && region.role !== 'control')) {
      throw new TypeError('Ceramic thermal-source inspection regions are malformed');
    }
    names.add(region.name);
  }
}

export function createCeramicTemperatureVfxAuditSnapshot(
  descriptor: ThermalSourceAtlasDescriptor,
  world: { readonly width: number; readonly height: number },
): CeramicTemperatureVfxAuditSnapshot {
  validateThermalSourceMaterialLightingAtlas(descriptor, world);
  const snapshot = descriptor.snapshot;
  return {
    version: snapshot.version,
    world: snapshot.world,
    material: snapshot.material as Material.Ceramic,
    ambientTemperature: snapshot.ambientTemperature,
    cards: descriptor.cards as readonly CeramicTemperatureVfxCard[],
    conductiveWall: snapshot.conductiveWall,
    expected: snapshot.expected,
  };
}

/** Direct-fills the paused exact-temperature atlas without advancing simulation. */
export function prepareThermalSourceMaterialLightingAtlas(
  simulation: SimulationBackend,
  descriptor: ThermalSourceAtlasDescriptor,
  world: { readonly width: number; readonly height: number },
): void {
  validateThermalSourceMaterialLightingAtlas(descriptor, world);
  if (!supportsFixture(simulation)) {
    throw new Error('Ceramic temperature VFX fixture requires RenderLab temperature and native wall planes');
  }
  if (simulation.width !== world.width || simulation.height !== world.height) {
    throw new Error(`Ceramic temperature VFX fixture requires ${world.width}x${world.height}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of descriptor.cards) {
    fillRect(cells, simulation.width, entry.body, descriptor.materials.ceramic);
    fillRect(cells, simulation.width, entry.authoredHole, descriptor.materials.empty);
    fillRect(cells, simulation.width, entry.openNotch, descriptor.materials.empty);
    fillRect(cells, simulation.width, entry.thinLine, descriptor.materials.ceramic);
    setPoint(cells, simulation.width, entry.isolated, descriptor.materials.ceramic);
    fillRect(cells, simulation.width, entry.wallCoexistence, descriptor.materials.ceramic);
    paintWallChecker(simulation, entry.wallCoexistence, descriptor.snapshot.wallBlockSize,
      descriptor.snapshot.conductiveWall);
    fillRect(cells, simulation.width, entry.waterContact.ceramic, descriptor.materials.ceramic);
    fillRect(cells, simulation.width, entry.waterContact.water, descriptor.materials.water);
    fillRect(cells, simulation.width, entry.hotControls.brick, descriptor.materials.brick);
    fillRect(cells, simulation.width, entry.hotControls.metal, descriptor.materials.metal);
    fillRect(cells, simulation.width, entry.guardedBlank, descriptor.materials.empty);

    setExactOwnerTemperatureRuns(simulation, cells, entry.body,
      descriptor.materials.ceramic, entry.temperature);
    setExactOwnerTemperatureRuns(simulation, cells, entry.thinLine,
      descriptor.materials.ceramic, entry.temperature);
    simulation.setFixtureTemperatureRect(entry.isolated.x, entry.isolated.y, 1, 1, entry.temperature);
    setExactOwnerTemperatureRuns(simulation, cells, entry.wallCoexistence,
      descriptor.materials.ceramic, entry.temperature);
    setExactOwnerTemperatureRuns(simulation, cells, entry.waterContact.ceramic,
      descriptor.materials.ceramic, entry.temperature);
    simulation.setFixtureTemperatureRect(
      entry.hotControls.brick.x, entry.hotControls.brick.y,
      entry.hotControls.brick.width, entry.hotControls.brick.height,
      EXPECTED_TEMPERATURES[4],
    );
    simulation.setFixtureTemperatureRect(
      entry.hotControls.metal.x, entry.hotControls.metal.y,
      entry.hotControls.metal.width, entry.hotControls.metal.height,
      EXPECTED_TEMPERATURES[4],
    );
  }
}

function supportsFixture(simulation: SimulationBackend): simulation is CeramicTemperatureFixtureBackend {
  const candidate = simulation as Partial<CeramicTemperatureFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.temperature === 'function'
    && typeof candidate.paintWall === 'function'
    && typeof candidate.setFixtureTemperatureRect === 'function';
}

function paintWallChecker(
  simulation: CeramicTemperatureFixtureBackend,
  region: CeramicTemperatureVfxRect,
  blockSize: number,
  wall: number,
): void {
  for (let y = region.y; y < region.y + region.height; y += blockSize) {
    for (let x = region.x; x < region.x + region.width; x += blockSize) {
      const column = (x - region.x) / blockSize;
      const row = (y - region.y) / blockSize;
      if ((column + row) % 2 === 0) simulation.paintWall(x, y, wall, 0);
    }
  }
}

function setExactOwnerTemperatureRuns(
  simulation: CeramicTemperatureFixtureBackend,
  cells: Uint8Array,
  rect: CeramicTemperatureVfxRect,
  owner: number,
  temperature: number,
): void {
  const right = rect.x + rect.width;
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    let x = rect.x;
    while (x < right) {
      while (x < right && cells[y * simulation.width + x] !== owner) x++;
      const start = x;
      while (x < right && cells[y * simulation.width + x] === owner) x++;
      if (x > start) simulation.setFixtureTemperatureRect(start, y, x - start, 1, temperature);
    }
  }
}

function fillRect(cells: Uint8Array, width: number, rect: CeramicTemperatureVfxRect,
  material: number): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}
function setPoint(cells: Uint8Array, width: number, point: CeramicTemperatureVfxPoint,
  material: number): void {
  cells[point.y * width + point.x] = material;
}
function validatePoint(point: ThermalSourceAtlasPoint,
  world: { readonly width: number; readonly height: number }): void {
  if (!Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y)
    || point.x < 0 || point.y < 0 || point.x >= world.width || point.y >= world.height) {
    throw new TypeError('Ceramic thermal-source atlas geometry escapes its world');
  }
}
function validateRect(rect: ThermalSourceAtlasRect,
  world: { readonly width: number; readonly height: number }): void {
  validatePoint(rect, world);
  if (!Number.isSafeInteger(rect.width) || !Number.isSafeInteger(rect.height)
    || rect.width < 1 || rect.height < 1
    || rect.x + rect.width > world.width || rect.y + rect.height > world.height) {
    throw new TypeError('Ceramic thermal-source atlas geometry escapes its world');
  }
}
