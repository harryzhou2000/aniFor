import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation/types';
import type {
  MaterialLightingAtlasCloud,
  MaterialLightingAtlasDescriptor,
  MaterialLightingAtlasPoint,
  MaterialLightingAtlasRect,
} from '../shared/material-lighting-atlas-catalog.js';

const validatePoint = (
  point: MaterialLightingAtlasPoint,
  world: { readonly width: number; readonly height: number },
  label: string,
): void => {
  if (!Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y)
    || point.x < 0 || point.y < 0 || point.x >= world.width || point.y >= world.height) {
    throw new TypeError(`Material-lighting atlas ${label} escapes its world`);
  }
};

const validateRect = (
  area: MaterialLightingAtlasRect,
  world: { readonly width: number; readonly height: number },
  label: string,
): void => {
  validatePoint(area, world, label);
  if (!Number.isSafeInteger(area.width) || !Number.isSafeInteger(area.height)
    || area.width < 1 || area.height < 1
    || area.x + area.width > world.width || area.y + area.height > world.height) {
    throw new TypeError(`Material-lighting atlas ${label} escapes its world`);
  }
};

export function validateMaterialLightingAtlas(
  atlas: MaterialLightingAtlasDescriptor,
  world: { readonly width: number; readonly height: number },
): void {
  if (!Number.isSafeInteger(world.width) || !Number.isSafeInteger(world.height)
    || world.width < 1 || world.height < 1) {
    throw new TypeError('Material-lighting atlas world is malformed');
  }
  for (const [name, material] of Object.entries(atlas.materials)) {
    if (!Number.isSafeInteger(material) || material < Material.Empty || material > 255
      || (name !== 'empty' && material === Material.Empty)) {
      throw new TypeError(`Material-lighting atlas material ${name} is malformed`);
    }
  }
  const rects: readonly (readonly [string, MaterialLightingAtlasRect])[] = [
    ['powder sand', atlas.powder.sand], ['powder clay', atlas.powder.clay],
    ['powder hole', atlas.powder.hole], ['powder fine column', atlas.powder.fineColumn],
    ['powder warm emitter', atlas.powder.warmEmitter],
    ['liquid water', atlas.liquid.water], ['liquid oil', atlas.liquid.oil],
    ['liquid water hole', atlas.liquid.waterHole], ['liquid oil chimney', atlas.liquid.oilChimney],
    ['liquid cool emitter', atlas.liquid.coolEmitter],
    ['gas smoke bounds', atlas.gas.smoke.bounds], ['gas fog bounds', atlas.gas.fog.bounds],
    ['gas smoke hole', atlas.gas.smokeHole], ['gas fog channel', atlas.gas.fogChannel],
    ['gas warm emitter', atlas.gas.warmEmitter], ['gas cool emitter', atlas.gas.coolEmitter],
    ['guarded blank', atlas.guardedBlank],
    ...atlas.inspectionRegions.map((region) => [`inspection ${region.name}`, region] as const),
  ];
  for (const [name, area] of rects) validateRect(area, world, name);
  for (const [name, cloud] of [['smoke', atlas.gas.smoke], ['fog', atlas.gas.fog]] as const) {
    validatePoint(cloud.probe, world, `${name} probe`);
    if (cloud.lobes.length === 0) throw new TypeError(`Material-lighting atlas ${name} has no lobes`);
    for (const [index, lobe] of cloud.lobes.entries()) {
      validatePoint(lobe, world, `${name} lobe ${index}`);
      if (!Number.isSafeInteger(lobe.radiusX) || !Number.isSafeInteger(lobe.radiusY)
        || lobe.radiusX < 1 || lobe.radiusY < 1) {
        throw new TypeError(`Material-lighting atlas ${name} lobe ${index} is malformed`);
      }
    }
  }
  for (const [index, point] of atlas.gas.sparseSmoke.entries()) {
    validatePoint(point, world, `sparse smoke ${index}`);
  }
  const names = new Set<string>();
  for (const region of atlas.inspectionRegions) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(region.name) || names.has(region.name)
      || (region.role !== 'response' && region.role !== 'control')) {
      throw new TypeError('Material-lighting atlas inspection regions are malformed');
    }
    names.add(region.name);
  }
}

/** Direct-fills the paused cross-phase board without advancing simulation. */
export function prepareMaterialLightingAtlas(
  simulation: SimulationBackend,
  atlas: MaterialLightingAtlasDescriptor,
  world: { readonly width: number; readonly height: number },
  label: string,
): void {
  validateMaterialLightingAtlas(atlas, world);
  if (simulation.width !== world.width || simulation.height !== world.height) {
    throw new Error(`${label} requires ${world.width}x${world.height}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  const materials = atlas.materials;
  fillRect(cells, simulation.width, atlas.powder.sand, materials.sand);
  fillRect(cells, simulation.width, atlas.powder.clay, materials.clay);
  fillRect(cells, simulation.width, atlas.powder.hole, materials.empty);
  fillRect(cells, simulation.width, atlas.powder.fineColumn, materials.clay);
  fillRect(cells, simulation.width, atlas.powder.warmEmitter, materials.fire);
  fillRect(cells, simulation.width, atlas.liquid.water, materials.water);
  fillRect(cells, simulation.width, atlas.liquid.oil, materials.oil);
  fillRect(cells, simulation.width, atlas.liquid.waterHole, materials.empty);
  fillRect(cells, simulation.width, atlas.liquid.oilChimney, materials.empty);
  fillRect(cells, simulation.width, atlas.liquid.coolEmitter, materials.liquidCoolEmitter);
  fillCloud(cells, simulation.width, atlas.gas.smoke, materials.smoke);
  fillCloud(cells, simulation.width, atlas.gas.fog, materials.fog);
  fillRect(cells, simulation.width, atlas.gas.smokeHole, materials.empty);
  fillRect(cells, simulation.width, atlas.gas.fogChannel, materials.empty);
  fillRect(cells, simulation.width, atlas.gas.warmEmitter, materials.fire);
  fillRect(cells, simulation.width, atlas.gas.coolEmitter, materials.gasCoolEmitter);
  for (const point of atlas.gas.sparseSmoke) setPoint(cells, simulation.width, point, materials.smoke);
  fillRect(cells, simulation.width, atlas.guardedBlank, materials.empty);
}

function fillRect(cells: Uint8Array, width: number, area: MaterialLightingAtlasRect, material: number): void {
  for (let y = area.y; y < area.y + area.height; y++) {
    cells.fill(material, y * width + area.x, y * width + area.x + area.width);
  }
}

function setPoint(cells: Uint8Array, width: number, point: MaterialLightingAtlasPoint, material: number): void {
  cells[point.y * width + point.x] = material;
}

function fillCloud(cells: Uint8Array, width: number, shape: MaterialLightingAtlasCloud, material: number): void {
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
