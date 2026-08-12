import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation/types';
import type {
  PowderStyleAtlasDescriptor,
  PowderStyleAtlasPile,
  PowderStyleAtlasPoint,
  PowderStyleAtlasRect,
} from '../shared/powder-style-atlas-catalog.js';

interface PowderStyleAtlasFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
}

const MATERIAL_NAMES = Object.freeze([
  'empty', 'sand', 'water', 'concrete', 'clay',
] as const satisfies readonly (keyof PowderStyleAtlasDescriptor['materials'])[]);
const SAFE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const hasExactKeys = (value: object, keys: readonly string[]): boolean => {
  const actual = Reflect.ownKeys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
};

const validatePoint = (
  point: PowderStyleAtlasPoint,
  world: { readonly width: number; readonly height: number },
  label: string,
): void => {
  if (!Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y)
    || point.x < 0 || point.y < 0 || point.x >= world.width || point.y >= world.height) {
    throw new TypeError(`Powder-style atlas ${label} escapes its world`);
  }
};

const validateRect = (
  area: PowderStyleAtlasRect,
  world: { readonly width: number; readonly height: number },
  label: string,
): void => {
  validatePoint(area, world, label);
  if (!Number.isSafeInteger(area.width) || !Number.isSafeInteger(area.height)
    || area.width < 1 || area.height < 1
    || area.x + area.width > world.width || area.y + area.height > world.height) {
    throw new TypeError(`Powder-style atlas ${label} escapes its world`);
  }
};

const validatePile = (
  pile: PowderStyleAtlasPile,
  world: { readonly width: number; readonly height: number },
  label: string,
): void => {
  if (![pile.left, pile.right, pile.peakX, pile.peakY, pile.baseY].every(Number.isSafeInteger)
    || pile.left < 0 || pile.right >= world.width || pile.left > pile.right
    || pile.peakX < pile.left || pile.peakX > pile.right
    || pile.peakY < 0 || pile.baseY >= world.height || pile.peakY > pile.baseY) {
    throw new TypeError(`Powder-style atlas ${label} is malformed`);
  }
  for (let x = pile.left; x <= pile.right; x++) {
    const surface = pile.peakY + Math.floor(Math.abs(x - pile.peakX) * 0.78);
    if (surface > pile.baseY) throw new TypeError(`Powder-style atlas ${label} escapes its base`);
  }
};

/** Validates the pure authoring descriptor before it can mutate a fixture world. */
export function validatePowderStyleAtlas(
  atlas: PowderStyleAtlasDescriptor,
  world: { readonly width: number; readonly height: number },
): void {
  if (world.width !== 612 || world.height !== 384) {
    throw new TypeError('Powder-style atlas world must be 612x384');
  }
  if (!hasExactKeys(atlas.materials, MATERIAL_NAMES)) {
    throw new TypeError('Powder-style atlas materials are malformed');
  }
  for (const name of MATERIAL_NAMES) {
    const material = atlas.materials[name];
    if (!Number.isSafeInteger(material) || material < Material.Empty || material > 255
      || (name !== 'empty' && material === Material.Empty)) {
      throw new TypeError(`Powder-style atlas material ${name} is malformed`);
    }
  }
  if (!Number.isSafeInteger(atlas.conductiveWall) || atlas.conductiveWall < 1
    || atlas.conductiveWall > 255) {
    throw new TypeError('Powder-style atlas conductive wall is malformed');
  }
  validatePile(atlas.bulk.sandPile, world, 'Sand pile');
  validatePile(atlas.bulk.clayPile, world, 'Clay pile');
  const rects: readonly (readonly [string, PowderStyleAtlasRect])[] = [
    ['Clay stem', atlas.fine.clayStem], ['Clay ledge', atlas.fine.clayLedge],
    ['Concrete ridge', atlas.fine.concreteRidge], ['authored hole', atlas.fine.authoredHole],
    ['wet powder', atlas.wetContact.powder], ['wet water', atlas.wetContact.water],
    ['wall coexistence', atlas.wallCoexistence], ['guarded blank', atlas.blank],
    ...atlas.inspectionRegions.map((region) => [`inspection ${region.name}`, region] as const),
  ];
  for (const [label, area] of rects) validateRect(area, world, label);
  const points: readonly (readonly [string, PowderStyleAtlasPoint])[] = [
    ['Sand probe', atlas.bulk.sandProbe], ['Clay probe', atlas.bulk.clayProbe],
    ['Concrete probe', atlas.fine.concreteProbe], ['Sand grain', atlas.grains.sand],
    ['Clay grain', atlas.grains.clay], ['wet powder probe', atlas.wetContact.powderProbe],
    ['wet water probe', atlas.wetContact.waterProbe], ['wall probe', atlas.wallProbe],
    ['blank probe', atlas.blankProbe],
    ...atlas.grains.concreteDiagonal.map((point, index) => [`Concrete grain ${index}`, point] as const),
    ...atlas.unstableControl.map((point, index) => [`unstable grain ${index}`, point] as const),
  ];
  for (const [label, point] of points) validatePoint(point, world, label);
  if (atlas.grains.concreteDiagonal.length === 0 || atlas.unstableControl.length === 0) {
    throw new TypeError('Powder-style atlas grain controls are malformed');
  }
  const names = new Set<string>();
  for (const region of atlas.inspectionRegions) {
    if (!SAFE_NAME.test(region.name) || names.has(region.name)
      || (region.role !== 'response' && region.role !== 'control')) {
      throw new TypeError('Powder-style atlas inspection regions are malformed');
    }
    names.add(region.name);
  }
}

/** Direct-fills the paused style board without advancing simulation. */
export function preparePowderStyleAtlas(
  simulation: SimulationBackend,
  atlas: PowderStyleAtlasDescriptor,
  world: { readonly width: number; readonly height: number },
  label: string,
): void {
  validatePowderStyleAtlas(atlas, world);
  if (!supportsPowderStyleAtlasFixture(simulation)) {
    throw new Error(`${label} requires a render-lab native wall plane`);
  }
  if (simulation.width !== world.width || simulation.height !== world.height) {
    throw new Error(`${label} requires ${world.width}x${world.height}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  fillPile(cells, simulation.width, atlas.bulk.sandPile, atlas.materials.sand);
  fillPile(cells, simulation.width, atlas.bulk.clayPile, atlas.materials.clay);
  fillRect(cells, simulation.width, atlas.fine.clayStem, atlas.materials.clay);
  fillRect(cells, simulation.width, atlas.fine.clayLedge, atlas.materials.clay);
  fillRect(cells, simulation.width, atlas.fine.concreteRidge, atlas.materials.concrete);
  fillRect(cells, simulation.width, atlas.fine.authoredHole, atlas.materials.empty);
  setPoint(cells, simulation.width, atlas.grains.sand, atlas.materials.sand);
  setPoint(cells, simulation.width, atlas.grains.clay, atlas.materials.clay);
  for (const grain of atlas.grains.concreteDiagonal) {
    setPoint(cells, simulation.width, grain, atlas.materials.concrete);
  }
  for (const grain of atlas.unstableControl) setPoint(cells, simulation.width, grain, atlas.materials.sand);
  fillRect(cells, simulation.width, atlas.wetContact.powder, atlas.materials.clay);
  fillRect(cells, simulation.width, atlas.wetContact.water, atlas.materials.water);
  fillRect(cells, simulation.width, atlas.wallCoexistence, atlas.materials.concrete);
  for (let y = atlas.wallCoexistence.y; y < atlas.wallCoexistence.y + atlas.wallCoexistence.height; y += 4) {
    for (let x = atlas.wallCoexistence.x; x < atlas.wallCoexistence.x + atlas.wallCoexistence.width; x += 4) {
      simulation.paintWall(x, y, atlas.conductiveWall, 0);
    }
  }
  fillRect(cells, simulation.width, atlas.blank, atlas.materials.empty);
}

function supportsPowderStyleAtlasFixture(
  simulation: SimulationBackend,
): simulation is PowderStyleAtlasFixtureBackend {
  const candidate = simulation as Partial<PowderStyleAtlasFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillPile(cells: Uint8Array, width: number, pile: PowderStyleAtlasPile, material: number): void {
  for (let x = pile.left; x <= pile.right; x++) {
    const surface = pile.peakY + Math.floor(Math.abs(x - pile.peakX) * 0.78);
    for (let y = surface; y <= pile.baseY; y++) cells[y * width + x] = material;
  }
}

function fillRect(cells: Uint8Array, width: number, area: PowderStyleAtlasRect, material: number): void {
  for (let y = area.y; y < area.y + area.height; y++) {
    cells.fill(material, y * width + area.x, y * width + area.x + area.width);
  }
}

function setPoint(cells: Uint8Array, width: number, point: PowderStyleAtlasPoint, material: number): void {
  cells[point.y * width + point.x] = material;
}
