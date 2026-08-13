import { ALL_MATERIALS } from '../shared/materials';
import type {
  RenderOpticsMaterialLightingAtlasDescriptor,
  RenderOpticsMaterialLightingPhase,
  RenderOpticsMaterialLightingPoint,
  RenderOpticsMaterialLightingRect,
} from '../shared/render-optics-material-lighting-atlas-catalog.js';
import type { SimulationBackend } from '../simulation/types';
import { MATERIAL_APPEARANCE_PHASE_OPTICS } from '../renderer/material-appearance-profiles';
import { renderOptics } from '../renderer/render-optics';

type WallFixtureBackend = SimulationBackend & Required<Pick<SimulationBackend, 'paintWall'>>;

const SAFE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const validatePoint = (point: RenderOpticsMaterialLightingPoint, world: Readonly<{ width: number; height: number }>, label: string): void => {
  if (!Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y)
    || point.x < 0 || point.y < 0 || point.x >= world.width || point.y >= world.height) {
    throw new TypeError(`RenderOptics atlas ${label} escapes its world`);
  }
};

const validateRect = (area: RenderOpticsMaterialLightingRect, world: Readonly<{ width: number; height: number }>, label: string): void => {
  validatePoint(area, world, label);
  if (!Number.isSafeInteger(area.width) || !Number.isSafeInteger(area.height)
    || area.width < 1 || area.height < 1
    || area.x + area.width > world.width || area.y + area.height > world.height) {
    throw new TypeError(`RenderOptics atlas ${label} escapes its world`);
  }
};

const materialInfo = (material: number) => ALL_MATERIALS.find(({ id }) => id === material);

const materialPhase = (material: number): RenderOpticsMaterialLightingPhase | undefined => {
  const info = materialInfo(material);
  if (!info) return undefined;
  const phase = info.phase ?? (info.category === 'gases' ? 'gas'
    : info.category === 'liquids' ? 'liquid'
      : info.category === 'powders' || info.category === 'explosives' ? 'powder' : 'solid');
  return phase === 'powder' || phase === 'liquid' || phase === 'gas' || phase === 'solid'
    ? phase : undefined;
};

export function validateRenderOpticsMaterialLightingAtlas(
  atlas: RenderOpticsMaterialLightingAtlasDescriptor,
  world: Readonly<{ width: number; height: number }>,
): void {
  if (world.width !== 612 || world.height !== 384 || atlas.cards.length !== 20) {
    throw new TypeError('RenderOptics atlas world or card count is malformed');
  }
  const expectedPairs = new Set(Object.entries(MATERIAL_APPEARANCE_PHASE_OPTICS)
    .flatMap(([phase, optics]) => optics.map((value) => `${phase}:${value}`)));
  const keys = new Set<string>();
  const pairs = new Set<string>();
  const materials = new Set<number>();
  for (const card of atlas.cards) {
    const info = materialInfo(card.material);
    const pair = `${card.phase}:${card.optics}`;
    if (!SAFE_NAME.test(card.key) || keys.has(card.key) || pairs.has(pair)
      || materials.has(card.material) || !expectedPairs.has(pair) || !info
      || materialPhase(card.material) !== card.phase || renderOptics(info) !== card.optics) {
      throw new TypeError('RenderOptics atlas card coverage is malformed');
    }
    keys.add(card.key); pairs.add(pair); materials.add(card.material);
    for (const [name, area] of Object.entries({
      card: card.card, body: card.body, core: card.core, cavity: card.cavity,
      openNotch: card.openNotch, fineControl: card.fineControl, emitter: card.emitter,
    })) validateRect(area, world, `${card.key} ${name}`);
    validatePoint(card.isolated, world, `${card.key} isolated`);
  }
  if (pairs.size !== expectedPairs.size || [...expectedPairs].some((pair) => !pairs.has(pair))) {
    throw new TypeError('RenderOptics atlas does not cover the actionable appearance vocabulary');
  }
  for (const contact of atlas.contacts) {
    if (!SAFE_NAME.test(contact.name)) throw new TypeError('RenderOptics atlas contact is malformed');
    validateRect(contact.owner, world, `${contact.name} owner`);
    validateRect(contact.neighbour, world, `${contact.name} neighbour`);
  }
  validateRect(atlas.nativeWall.body, world, 'native wall');
  validatePoint(atlas.nativeWall.anchor, world, 'native wall anchor');
  validateRect(atlas.guardedBlank, world, 'guarded blank');
  const regionNames = new Set<string>();
  for (const region of atlas.inspectionRegions) {
    if (!SAFE_NAME.test(region.name) || regionNames.has(region.name)
      || (region.role !== 'response' && region.role !== 'control')) {
      throw new TypeError('RenderOptics atlas inspection regions are malformed');
    }
    regionNames.add(region.name);
    validateRect(region, world, `inspection ${region.name}`);
  }
}

export function prepareRenderOpticsMaterialLightingAtlas(
  simulation: SimulationBackend,
  atlas: RenderOpticsMaterialLightingAtlasDescriptor,
  world: Readonly<{ width: number; height: number }>,
  label: string,
): void {
  validateRenderOpticsMaterialLightingAtlas(atlas, world);
  if (simulation.width !== world.width || simulation.height !== world.height) {
    throw new Error(`${label} requires ${world.width}x${world.height}`);
  }
  if (typeof simulation.paintWall !== 'function') throw new Error(`${label} requires native wall support`);
  simulation.clear();
  const cells = simulation.cells();
  for (const card of atlas.cards) {
    fillPhaseBody(cells, simulation.width, card.body, card.material, card.phase);
    fillRect(cells, simulation.width, card.cavity, atlas.materials.empty);
    fillRect(cells, simulation.width, card.openNotch, atlas.materials.empty);
    fillRect(cells, simulation.width, card.fineControl, card.material);
    setPoint(cells, simulation.width, card.isolated, card.material);
    fillRect(cells, simulation.width, card.emitter, atlas.materials.fire);
  }
  for (const contact of atlas.contacts) {
    fillRect(cells, simulation.width, contact.owner, contact.ownerMaterial);
    fillRect(cells, simulation.width, contact.neighbour, contact.neighbourMaterial);
  }
  fillRect(cells, simulation.width, atlas.guardedBlank, atlas.materials.empty);
  paintWallRect(simulation as WallFixtureBackend, atlas.nativeWall.body, atlas.conductiveWall);
}

const fillRect = (cells: Uint8Array, width: number, area: RenderOpticsMaterialLightingRect, material: number): void => {
  for (let y = area.y; y < area.y + area.height; y++) {
    cells.fill(material, y * width + area.x, y * width + area.x + area.width);
  }
};

const fillPhaseBody = (
  cells: Uint8Array,
  width: number,
  area: RenderOpticsMaterialLightingRect,
  material: number,
  phase: RenderOpticsMaterialLightingPhase,
): void => {
  if (phase === 'powder') {
    for (let row = 0; row < area.height; row++) {
      const inset = Math.round((1 - row / Math.max(1, area.height - 1)) * area.width * 0.22);
      fillRect(cells, width, { x: area.x + inset, y: area.y + row, width: area.width - inset * 2, height: 1 }, material);
    }
    return;
  }
  if (phase === 'gas') {
    fillEllipse(cells, width, area.x + area.width * 0.38, area.y + area.height * 0.52,
      area.width * 0.38, area.height * 0.46, material);
    fillEllipse(cells, width, area.x + area.width * 0.66, area.y + area.height * 0.48,
      area.width * 0.33, area.height * 0.42, material);
    return;
  }
  const radius = phase === 'liquid' ? 9 : 5;
  fillRoundedRect(cells, width, area, radius, material);
};

const fillRoundedRect = (
  cells: Uint8Array, width: number, area: RenderOpticsMaterialLightingRect,
  radius: number, material: number,
): void => {
  for (let y = area.y; y < area.y + area.height; y++) {
    for (let x = area.x; x < area.x + area.width; x++) {
      const dx = Math.max(area.x + radius - x, 0, x - (area.x + area.width - radius - 1));
      const dy = Math.max(area.y + radius - y, 0, y - (area.y + area.height - radius - 1));
      if (dx * dx + dy * dy <= radius * radius) cells[y * width + x] = material;
    }
  }
};

const fillEllipse = (
  cells: Uint8Array, width: number, cx: number, cy: number,
  radiusX: number, radiusY: number, material: number,
): void => {
  const left = Math.ceil(cx - radiusX), right = Math.floor(cx + radiusX);
  const top = Math.ceil(cy - radiusY), bottom = Math.floor(cy + radiusY);
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    const dx = (x - cx) / radiusX, dy = (y - cy) / radiusY;
    if (dx * dx + dy * dy <= 1) cells[y * width + x] = material;
  }
};

const setPoint = (cells: Uint8Array, width: number, point: RenderOpticsMaterialLightingPoint, material: number): void => {
  cells[point.y * width + point.x] = material;
};

const paintWallRect = (simulation: WallFixtureBackend, area: RenderOpticsMaterialLightingRect, wall: number): void => {
  for (let y = area.y; y < area.y + area.height; y++) {
    for (let x = area.x; x < area.x + area.width; x++) simulation.paintWall(x, y, wall, 0);
  }
};
