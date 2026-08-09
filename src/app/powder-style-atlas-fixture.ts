import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation/types';

/**
 * A deliberately paused, direct-filled scene for comparing Powder render styles.
 * It is selected through the typed presentation-capture registry, not the
 * closed normal-HDR shader registry.
 */
export const POWDER_STYLE_ATLAS_WORLD = Object.freeze({ width: 612, height: 384 });
export const POWDER_STYLE_ATLAS_CONDUCTIVE_WALL = 1;

export interface PowderStyleAtlasPoint {
  readonly x: number;
  readonly y: number;
}

export interface PowderStyleAtlasRect extends PowderStyleAtlasPoint {
  readonly width: number;
  readonly height: number;
}

interface PowderStyleAtlasFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
}

const point = (x: number, y: number): PowderStyleAtlasPoint => Object.freeze({ x, y });
const rect = (x: number, y: number, width: number, height: number): PowderStyleAtlasRect => (
  Object.freeze({ x, y, width, height })
);

/**
 * Stable semantic coordinates for later browser assertions and capture recipes.
 * The moving pair is only a visual/control representation: this preparer never
 * advances physics, so no style comparison depends on a simulation tick.
 */
export const POWDER_STYLE_ATLAS = Object.freeze({
  bulk: Object.freeze({
    sandProbe: point(136, 240),
    clayProbe: point(315, 258),
    sandPile: Object.freeze({ left: 24, right: 246, peakX: 122, peakY: 116, baseY: 304 }),
    clayPile: Object.freeze({ left: 224, right: 394, peakX: 311, peakY: 166, baseY: 304 }),
  }),
  fine: Object.freeze({
    clayStem: rect(420, 76, 1, 88),
    clayLedge: rect(420, 163, 42, 1),
    concreteRidge: rect(432, 178, 146, 56),
    authoredHole: rect(486, 202, 7, 7),
    concreteProbe: point(450, 220),
  }),
  grains: Object.freeze({
    sand: point(248, 54),
    clay: point(270, 54),
    concreteDiagonal: Object.freeze([point(292, 54), point(293, 55)]),
  }),
  unstableControl: Object.freeze([point(330, 56), point(331, 57)]),
  wetContact: Object.freeze({
    powder: rect(420, 284, 30, 28),
    water: rect(450, 284, 34, 28),
    powderProbe: point(434, 298),
    waterProbe: point(466, 298),
  }),
  wallCoexistence: rect(540, 276, 32, 32),
  wallProbe: point(548, 284),
  blank: rect(290, 334, 120, 28),
  blankProbe: point(350, 348),
});

/** Direct-fill a paused world. This intentionally performs no brush write or physics step. */
export function preparePowderStyleAtlasFixture(simulation: SimulationBackend): void {
  if (!supportsPowderStyleAtlasFixture(simulation)) {
    throw new Error('Powder style atlas fixture requires a render-lab native wall plane');
  }
  if (simulation.width !== POWDER_STYLE_ATLAS_WORLD.width || simulation.height !== POWDER_STYLE_ATLAS_WORLD.height) {
    throw new Error(`Powder style atlas fixture requires ${POWDER_STYLE_ATLAS_WORLD.width}x${POWDER_STYLE_ATLAS_WORLD.height}`);
  }

  simulation.clear();
  const cells = simulation.cells();
  fillPile(cells, simulation.width, POWDER_STYLE_ATLAS.bulk.sandPile, Material.Sand);
  fillPile(cells, simulation.width, POWDER_STYLE_ATLAS.bulk.clayPile, Material.Clay);

  fillRect(cells, simulation.width, POWDER_STYLE_ATLAS.fine.clayStem, Material.Clay);
  fillRect(cells, simulation.width, POWDER_STYLE_ATLAS.fine.clayLedge, Material.Clay);
  fillRect(cells, simulation.width, POWDER_STYLE_ATLAS.fine.concreteRidge, Material.Concrete);
  fillRect(cells, simulation.width, POWDER_STYLE_ATLAS.fine.authoredHole, Material.Empty);

  setPoint(cells, simulation.width, POWDER_STYLE_ATLAS.grains.sand, Material.Sand);
  setPoint(cells, simulation.width, POWDER_STYLE_ATLAS.grains.clay, Material.Clay);
  for (const grain of POWDER_STYLE_ATLAS.grains.concreteDiagonal) setPoint(cells, simulation.width, grain, Material.Concrete);
  for (const grain of POWDER_STYLE_ATLAS.unstableControl) setPoint(cells, simulation.width, grain, Material.Sand);

  fillRect(cells, simulation.width, POWDER_STYLE_ATLAS.wetContact.powder, Material.Clay);
  fillRect(cells, simulation.width, POWDER_STYLE_ATLAS.wetContact.water, Material.Water);
  fillRect(cells, simulation.width, POWDER_STYLE_ATLAS.wallCoexistence, Material.Concrete);
  for (let y = POWDER_STYLE_ATLAS.wallCoexistence.y; y < POWDER_STYLE_ATLAS.wallCoexistence.y + POWDER_STYLE_ATLAS.wallCoexistence.height; y += 4) {
    for (let x = POWDER_STYLE_ATLAS.wallCoexistence.x; x < POWDER_STYLE_ATLAS.wallCoexistence.x + POWDER_STYLE_ATLAS.wallCoexistence.width; x += 4) {
      simulation.paintWall(x, y, POWDER_STYLE_ATLAS_CONDUCTIVE_WALL, 0);
    }
  }
  fillRect(cells, simulation.width, POWDER_STYLE_ATLAS.blank, Material.Empty);
}

function supportsPowderStyleAtlasFixture(simulation: SimulationBackend): simulation is PowderStyleAtlasFixtureBackend {
  const candidate = simulation as Partial<PowderStyleAtlasFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillPile(
  cells: Uint8Array,
  width: number,
  pile: { readonly left: number; readonly right: number; readonly peakX: number; readonly peakY: number; readonly baseY: number },
  material: Material,
): void {
  for (let x = pile.left; x <= pile.right; x++) {
    const surface = pile.peakY + Math.floor(Math.abs(x - pile.peakX) * 0.78);
    for (let y = surface; y <= pile.baseY; y++) cells[y * width + x] = material;
  }
}

function fillRect(cells: Uint8Array, width: number, area: PowderStyleAtlasRect, material: Material): void {
  for (let y = area.y; y < area.y + area.height; y++) {
    cells.fill(material, y * width + area.x, y * width + area.x + area.width);
  }
}

function setPoint(cells: Uint8Array, width: number, location: PowderStyleAtlasPoint, material: Material): void {
  cells[location.y * width + location.x] = material;
}
