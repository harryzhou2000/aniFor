import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation/types';
import type {
  GasMaterialLightingAtlasDescriptor,
  GasMaterialLightingCloud,
  GasMaterialLightingPoint,
  GasMaterialLightingRect,
} from '../shared/gas-material-lighting-atlas-catalog.js';

interface GasMaterialLightingFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
}

const validatePoint = (
  point: GasMaterialLightingPoint,
  world: { readonly width: number; readonly height: number },
  label: string,
): void => {
  if (!Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y)
    || point.x < 0 || point.y < 0 || point.x >= world.width || point.y >= world.height) {
    throw new TypeError(`Gas material-lighting atlas ${label} escapes its world`);
  }
};

const validateRect = (
  area: GasMaterialLightingRect,
  world: { readonly width: number; readonly height: number },
  label: string,
): void => {
  validatePoint(area, world, label);
  if (!Number.isSafeInteger(area.width) || !Number.isSafeInteger(area.height)
    || area.width < 1 || area.height < 1
    || area.x + area.width > world.width || area.y + area.height > world.height) {
    throw new TypeError(`Gas material-lighting atlas ${label} escapes its world`);
  }
};

/** Validates the data-only authoring descriptor before it can mutate a fixture. */
export function validateGasMaterialLightingAtlas(
  atlas: GasMaterialLightingAtlasDescriptor,
  world: { readonly width: number; readonly height: number },
): void {
  if (!Number.isSafeInteger(world.width) || !Number.isSafeInteger(world.height)
    || world.width < 1 || world.height < 1) {
    throw new TypeError('Gas material-lighting atlas world is malformed');
  }
  for (const [name, material] of Object.entries(atlas.materials)) {
    if (!Number.isSafeInteger(material) || material < Material.Empty || material > 255
      || (name !== 'empty' && material === Material.Empty)) {
      throw new TypeError(`Gas material-lighting atlas material ${name} is malformed`);
    }
  }
  if (!Number.isSafeInteger(atlas.conductiveWall) || atlas.conductiveWall < 1
    || atlas.conductiveWall > 255) {
    throw new TypeError('Gas material-lighting atlas wall is malformed');
  }
  const rects: readonly [string, GasMaterialLightingRect][] = [
    ['sooty bounds', atlas.sooty.bounds], ['clean bounds', atlas.clean.bounds],
    ['sooty hole', atlas.sootyHole], ['clean channel', atlas.cleanChannel],
    ['warm emitter', atlas.warmEmitter], ['cool emitter', atlas.coolEmitter],
    ['solid contact gas', atlas.solidContact.gas], ['solid contact owner', atlas.solidContact.solid],
    ['liquid contact gas', atlas.liquidContact.gas], ['liquid contact owner', atlas.liquidContact.liquid],
    ['foreign gas contact', atlas.foreignGasContact.gas],
    ['foreign gas neighbour', atlas.foreignGasContact.foreignGas],
    ['native wall gas', atlas.nativeWall.gas], ['emissive gas', atlas.emissiveGas.body],
    ['guarded blank', atlas.guardedBlank],
  ];
  for (const [name, area] of rects) validateRect(area, world, name);
  const points: readonly (readonly [string, GasMaterialLightingPoint])[] = [
    ['sooty probe', atlas.sooty.probe], ['clean probe', atlas.clean.probe],
    ['solid contact probe', atlas.solidContact.probe],
    ['liquid contact probe', atlas.liquidContact.probe],
    ['foreign gas probe', atlas.foreignGasContact.gasProbe],
    ['foreign gas neighbour probe', atlas.foreignGasContact.foreignProbe],
    ['native wall anchor', atlas.nativeWall.anchor], ['emissive gas probe', atlas.emissiveGas.probe],
    ...atlas.sparseSooty.map((point, index) => [`sparse sooty ${index}`, point] as const),
    ...atlas.sparseClean.map((point, index) => [`sparse clean ${index}`, point] as const),
  ];
  for (const [name, point] of points) validatePoint(point, world, name);
  for (const [cloudName, cloud] of [['sooty', atlas.sooty], ['clean', atlas.clean]] as const) {
    if (cloud.lobes.length === 0) throw new TypeError(`Gas material-lighting atlas ${cloudName} has no lobes`);
    for (const [index, lobe] of cloud.lobes.entries()) {
      validatePoint(lobe, world, `${cloudName} lobe ${index}`);
      if (!Number.isSafeInteger(lobe.radiusX) || !Number.isSafeInteger(lobe.radiusY)
        || lobe.radiusX < 1 || lobe.radiusY < 1) {
        throw new TypeError(`Gas material-lighting atlas ${cloudName} lobe ${index} is malformed`);
      }
    }
  }
}

/** Direct-fills a paused RenderLab world from declarative gas authoring. */
export function prepareGasMaterialLightingAtlas(
  simulation: SimulationBackend,
  atlas: GasMaterialLightingAtlasDescriptor,
  world: { readonly width: number; readonly height: number },
  label: string,
): void {
  validateGasMaterialLightingAtlas(atlas, world);
  if (!supportsFixtureBackend(simulation)) throw new Error(`${label} requires RenderLab wall plane`);
  if (simulation.width !== world.width || simulation.height !== world.height) {
    throw new Error(`${label} requires ${world.width}x${world.height}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  const materials = atlas.materials;
  fillCloud(cells, simulation.width, atlas.sooty, materials.sooty);
  fillCloud(cells, simulation.width, atlas.clean, materials.clean);
  fillRect(cells, simulation.width, atlas.sootyHole, materials.empty);
  fillRect(cells, simulation.width, atlas.cleanChannel, materials.empty);
  fillRect(cells, simulation.width, atlas.warmEmitter, materials.warmEmitter);
  fillRect(cells, simulation.width, atlas.coolEmitter, materials.coolEmitter);
  for (const point of atlas.sparseSooty) setPoint(cells, simulation.width, point, materials.sooty);
  for (const point of atlas.sparseClean) setPoint(cells, simulation.width, point, materials.clean);
  fillRect(cells, simulation.width, atlas.solidContact.gas, materials.sooty);
  fillRect(cells, simulation.width, atlas.solidContact.solid, materials.solidContactOwner);
  fillRect(cells, simulation.width, atlas.liquidContact.gas, materials.clean);
  fillRect(cells, simulation.width, atlas.liquidContact.liquid, materials.liquidContactOwner);
  fillRect(cells, simulation.width, atlas.foreignGasContact.gas, materials.foreignGas);
  fillRect(cells, simulation.width, atlas.foreignGasContact.foreignGas, materials.foreignGasNeighbour);
  fillRect(cells, simulation.width, atlas.nativeWall.gas, materials.sooty);
  simulation.paintWall(atlas.nativeWall.anchor.x, atlas.nativeWall.anchor.y, atlas.conductiveWall, 0);
  fillRect(cells, simulation.width, atlas.emissiveGas.body, materials.emissiveGas);
  fillRect(cells, simulation.width, atlas.guardedBlank, materials.empty);
}

function supportsFixtureBackend(
  simulation: SimulationBackend,
): simulation is GasMaterialLightingFixtureBackend {
  const candidate = simulation as Partial<GasMaterialLightingFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillRect(cells: Uint8Array, width: number, area: GasMaterialLightingRect, material: number): void {
  for (let y = area.y; y < area.y + area.height; y++) {
    cells.fill(material, y * width + area.x, y * width + area.x + area.width);
  }
}

function setPoint(cells: Uint8Array, width: number, point: GasMaterialLightingPoint, material: number): void {
  cells[point.y * width + point.x] = material;
}

function fillCloud(cells: Uint8Array, width: number, shape: GasMaterialLightingCloud, material: number): void {
  for (const lobe of shape.lobes) {
    const left = Math.max(shape.bounds.x, Math.ceil(lobe.x - lobe.radiusX));
    const right = Math.min(shape.bounds.x + shape.bounds.width - 1, Math.floor(lobe.x + lobe.radiusX));
    const top = Math.max(shape.bounds.y, Math.ceil(lobe.y - lobe.radiusY));
    const bottom = Math.min(shape.bounds.y + shape.bounds.height - 1, Math.floor(lobe.y + lobe.radiusY));
    for (let y = top; y <= bottom; y++) {
      const normalizedY = (y - lobe.y) / lobe.radiusY;
      for (let x = left; x <= right; x++) {
        const normalizedX = (x - lobe.x) / lobe.radiusX;
        if (normalizedX * normalizedX + normalizedY * normalizedY <= 1) {
          cells[y * width + x] = material;
        }
      }
    }
  }
}
