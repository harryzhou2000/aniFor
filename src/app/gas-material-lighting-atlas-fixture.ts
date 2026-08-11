import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation/types';

export const GAS_MATERIAL_LIGHTING_ATLAS_WORLD = Object.freeze({ width: 612, height: 384 });

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Rect extends Point {
  readonly width: number;
  readonly height: number;
}

interface Ellipse extends Point {
  readonly radiusX: number;
  readonly radiusY: number;
}

interface Cloud {
  readonly bounds: Rect;
  readonly probe: Point;
  readonly lobes: readonly Ellipse[];
}

interface GasMaterialLightingFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
}

const rect = (x: number, y: number, width: number, height: number): Rect => (
  Object.freeze({ x, y, width, height })
);

const point = (x: number, y: number): Point => Object.freeze({ x, y });

const ellipse = (x: number, y: number, radiusX: number, radiusY: number): Ellipse => (
  Object.freeze({ x, y, radiusX, radiusY })
);

const cloud = (bounds: Rect, probe: Point, lobes: readonly Ellipse[]): Cloud => (
  Object.freeze({ bounds, probe, lobes: Object.freeze(lobes) })
);

/**
 * A paused gas-only companion to the mixed material-lighting atlas. It keeps
 * two family-owned cloud bodies, their voids and contacts, plus native wall
 * and emissive controls, so the shared RGB-only lighting profile can be
 * reviewed without a rectangular gas field hiding cloud-edge behavior.
 */
export const GAS_MATERIAL_LIGHTING_ATLAS = Object.freeze({
  sooty: cloud(
    rect(24, 28, 258, 196), point(188, 126), [
      ellipse(148, 126, 94, 62),
      ellipse(78, 98, 45, 37),
      ellipse(211, 158, 57, 41),
      ellipse(174, 62, 42, 28),
    ],
  ),
  clean: cloud(
    rect(326, 28, 258, 196), point(454, 120), [
      ellipse(454, 120, 96, 58),
      ellipse(384, 150, 47, 36),
      ellipse(522, 82, 49, 34),
      ellipse(474, 176, 39, 28),
    ],
  ),
  sootyHole: rect(136, 114, 20, 18),
  cleanChannel: rect(326, 44, 14, 54),
  warmEmitter: rect(16, 88, 5, 76),
  coolEmitter: rect(590, 84, 5, 74),
  sparseSooty: Object.freeze([
    point(34, 352), point(36, 352), point(68, 352), point(102, 352),
  ]),
  sparseClean: Object.freeze([
    point(376, 352), point(378, 352), point(412, 352), point(450, 352),
  ]),
  solidContact: Object.freeze({
    gas: rect(24, 252, 62, 42),
    solid: rect(86, 252, 28, 42),
    probe: point(84, 272),
  }),
  liquidContact: Object.freeze({
    gas: rect(144, 252, 62, 42),
    liquid: rect(206, 252, 28, 42),
    probe: point(204, 272),
  }),
  foreignGasContact: Object.freeze({
    gas: rect(264, 252, 62, 42),
    foreignGas: rect(326, 252, 28, 42),
    gasProbe: point(324, 272),
    foreignProbe: point(327, 272),
  }),
  nativeWall: Object.freeze({
    gas: rect(384, 252, 72, 42),
    anchor: point(420, 272),
  }),
  emissiveGas: Object.freeze({ body: rect(484, 252, 48, 42), probe: point(508, 272) }),
  guardedBlank: rect(138, 314, 364, 22),
});

/**
 * Direct-fills a deterministic RenderLab state and deliberately never advances
 * the simulation. The renderer remains the sole owner of atmosphere expansion
 * and volume reconstruction, so every off/A/B capture starts from one stable
 * semantic plane.
 */
export function prepareGasMaterialLightingAtlasFixture(simulation: SimulationBackend): void {
  if (!supportsFixtureBackend(simulation)) {
    throw new Error('Gas material-lighting atlas requires RenderLab wall plane');
  }
  if (simulation.width !== GAS_MATERIAL_LIGHTING_ATLAS_WORLD.width
    || simulation.height !== GAS_MATERIAL_LIGHTING_ATLAS_WORLD.height) {
    throw new Error(
      `Gas material-lighting atlas requires ${GAS_MATERIAL_LIGHTING_ATLAS_WORLD.width}`
      + `x${GAS_MATERIAL_LIGHTING_ATLAS_WORLD.height}`,
    );
  }

  simulation.clear();
  const cells = simulation.cells();
  const atlas = GAS_MATERIAL_LIGHTING_ATLAS;

  fillCloud(cells, simulation.width, atlas.sooty, Material.Smoke);
  fillCloud(cells, simulation.width, atlas.clean, Material.Oxygen);
  fillRect(cells, simulation.width, atlas.sootyHole, Material.Empty);
  fillRect(cells, simulation.width, atlas.cleanChannel, Material.Empty);
  fillRect(cells, simulation.width, atlas.warmEmitter, Material.Fire);
  fillRect(cells, simulation.width, atlas.coolEmitter, Material.GRVT);
  for (const carrier of atlas.sparseSooty) setPoint(cells, simulation.width, carrier, Material.Smoke);
  for (const carrier of atlas.sparseClean) setPoint(cells, simulation.width, carrier, Material.Oxygen);

  fillRect(cells, simulation.width, atlas.solidContact.gas, Material.Smoke);
  fillRect(cells, simulation.width, atlas.solidContact.solid, Material.Metal);
  fillRect(cells, simulation.width, atlas.liquidContact.gas, Material.Oxygen);
  fillRect(cells, simulation.width, atlas.liquidContact.liquid, Material.Water);
  fillRect(cells, simulation.width, atlas.foreignGasContact.gas, Material.NobleGas);
  fillRect(cells, simulation.width, atlas.foreignGasContact.foreignGas, Material.FOG);
  fillRect(cells, simulation.width, atlas.nativeWall.gas, Material.Smoke);
  simulation.paintWall(atlas.nativeWall.anchor.x, atlas.nativeWall.anchor.y, 1, 0);
  fillRect(cells, simulation.width, atlas.emissiveGas.body, Material.CFLM);
  fillRect(cells, simulation.width, atlas.guardedBlank, Material.Empty);
}

function supportsFixtureBackend(simulation: SimulationBackend): simulation is GasMaterialLightingFixtureBackend {
  const candidate = simulation as Partial<GasMaterialLightingFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillRect(cells: Uint8Array, width: number, area: Rect, material: Material): void {
  for (let y = area.y; y < area.y + area.height; y++) {
    cells.fill(material, y * width + area.x, y * width + area.x + area.width);
  }
}

function setPoint(cells: Uint8Array, width: number, location: Point, material: Material): void {
  cells[location.y * width + location.x] = material;
}

function fillCloud(cells: Uint8Array, width: number, shape: Cloud, material: Material): void {
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
