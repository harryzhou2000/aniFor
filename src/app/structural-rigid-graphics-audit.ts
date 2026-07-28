import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const STRUCTURAL_RIGID_GRAPHICS_ATLAS_COLUMNS = 4;
export const STRUCTURAL_RIGID_GRAPHICS_ATLAS_ROWS = 2;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 8;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 150;
const CARD_STRIDE_Y = 184;
const CARD_WIDTH = 140;
const CARD_HEIGHT = 176;

const STRUCTURAL_RIGID_DEFINITIONS = [
  { material: Material.Brick, code: 'BRCK', color: '#b84c24' },
  { material: Material.Metal, code: 'METL', color: '#404060' },
  { material: Material.Ceramic, code: 'CRMC', color: '#a0a0a0' },
  { material: Material.BMTL, code: 'BMTL', color: '#505070' },
  { material: Material.GOLD, code: 'GOLD', color: '#dcad2c' },
  { material: Material.IRON, code: 'IRON', color: '#707070' },
  { material: Material.TTAN, code: 'TTAN', color: '#909090' },
] as const;

export interface StructuralRigidGraphicsPoint {
  readonly x: number;
  readonly y: number;
}

export interface StructuralRigidGraphicsRect extends StructuralRigidGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export interface StructuralRigidShellControl {
  readonly outer: StructuralRigidGraphicsRect;
  readonly interior: StructuralRigidGraphicsRect;
}

export interface StructuralRigidContactControl {
  /** Exact card material on the left side of the contact seam. */
  readonly owner: StructuralRigidGraphicsRect;
  /** A disjoint Metal control abutting the owner's right edge. */
  readonly unlike: StructuralRigidGraphicsRect;
  readonly unlikeMaterial: Material.Metal;
}

export interface StructuralRigidGraphicsAtlasEntry {
  readonly material: Material;
  readonly code: string;
  readonly color: string;
  readonly index: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly card: StructuralRigidGraphicsRect;
  readonly body: StructuralRigidGraphicsRect;
  /** A deliberately non-reconstructable 6x6 authored cavity. */
  readonly hole: StructuralRigidGraphicsRect;
  /** Three vertically adjacent empty cells open through the body's right edge. */
  readonly openNotch: readonly StructuralRigidGraphicsPoint[];
  /** A disjoint one-cell-thick closed ring with an authored empty interior. */
  readonly shell: StructuralRigidShellControl;
  /** A one-cell-wide body-attached fine structure. */
  readonly spur: StructuralRigidGraphicsRect;
  readonly isolated: StructuralRigidGraphicsPoint;
  readonly guardedBlank: StructuralRigidGraphicsRect;
  readonly contact: StructuralRigidContactControl;
}

export interface StructuralRigidGraphicsAuditSnapshot {
  readonly cards: readonly StructuralRigidGraphicsAtlasEntry[];
  readonly holes: readonly StructuralRigidGraphicsPoint[];
  readonly openNotches: readonly StructuralRigidGraphicsPoint[];
  readonly shellCells: readonly StructuralRigidGraphicsPoint[];
  readonly shellInteriors: readonly StructuralRigidGraphicsPoint[];
  readonly spurs: readonly StructuralRigidGraphicsPoint[];
  readonly isolated: readonly StructuralRigidGraphicsPoint[];
  readonly guardedBlanks: readonly StructuralRigidGraphicsRect[];
  readonly contacts: readonly StructuralRigidContactControl[];
}

/** Stable seven-card atlas for canonical WebGL structural-rigid styling gates. */
export const STRUCTURAL_RIGID_GRAPHICS_ATLAS: readonly StructuralRigidGraphicsAtlasEntry[] =
  STRUCTURAL_RIGID_DEFINITIONS.map(({ material, code, color }, index) => {
    const card = {
      x: CARD_ORIGIN_X + (index % STRUCTURAL_RIGID_GRAPHICS_ATLAS_COLUMNS) * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y + Math.floor(index / STRUCTURAL_RIGID_GRAPHICS_ATLAS_COLUMNS) * CARD_STRIDE_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 7, y: card.y + 10, width: 56, height: 56 };
    const shellOuter = { x: card.x + 8, y: card.y + 82, width: 20, height: 20 };
    const contactY = card.y + 128;
    return {
      material,
      code,
      color,
      index,
      left: card.x,
      top: card.y,
      width: card.width,
      height: card.height,
      card,
      body,
      hole: { x: body.x + 24, y: body.y + 24, width: 6, height: 6 },
      openNotch: Array.from({ length: 3 }, (_, offset) => ({
        x: body.x + body.width - 1,
        y: body.y + 37 + offset,
      })),
      shell: {
        outer: shellOuter,
        interior: {
          x: shellOuter.x + 1,
          y: shellOuter.y + 1,
          width: shellOuter.width - 2,
          height: shellOuter.height - 2,
        },
      },
      spur: { x: body.x + 27, y: body.y + body.height, width: 1, height: 10 },
      isolated: { x: card.x + 108, y: card.y + 20 },
      guardedBlank: { x: card.x + 54, y: card.y + 84, width: 58, height: 24 },
      contact: {
        owner: { x: card.x + 12, y: contactY, width: 10, height: 12 },
        unlike: { x: card.x + 22, y: contactY, width: 10, height: 12 },
        unlikeMaterial: Material.Metal,
      },
    };
  });

export const STRUCTURAL_RIGID_GRAPHICS_AUDIT: StructuralRigidGraphicsAuditSnapshot = {
  cards: STRUCTURAL_RIGID_GRAPHICS_ATLAS,
  holes: STRUCTURAL_RIGID_GRAPHICS_ATLAS.flatMap(({ hole }) => rectPoints(hole)),
  openNotches: STRUCTURAL_RIGID_GRAPHICS_ATLAS.flatMap(({ openNotch }) => openNotch),
  shellCells: STRUCTURAL_RIGID_GRAPHICS_ATLAS.flatMap(({ shell }) => shellPoints(shell)),
  shellInteriors: STRUCTURAL_RIGID_GRAPHICS_ATLAS.flatMap(({ shell }) => rectPoints(shell.interior)),
  spurs: STRUCTURAL_RIGID_GRAPHICS_ATLAS.flatMap(({ spur }) => rectPoints(spur)),
  isolated: STRUCTURAL_RIGID_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  guardedBlanks: STRUCTURAL_RIGID_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
  contacts: STRUCTURAL_RIGID_GRAPHICS_ATLAS.map(({ contact }) => contact),
};

/** Direct-fills the paused deterministic backend without using the particle brush ABI. */
export function prepareStructuralRigidGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (simulation.name !== 'TypeScript deterministic fallback') {
    throw new Error('Structural rigid graphics audit fixture requires the deterministic backend');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Structural rigid graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of STRUCTURAL_RIGID_GRAPHICS_ATLAS) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.hole, Material.Empty);
    for (const point of entry.openNotch) cells[point.y * simulation.width + point.x] = Material.Empty;
    fillRect(cells, simulation.width, entry.shell.outer, entry.material);
    fillRect(cells, simulation.width, entry.shell.interior, Material.Empty);
    fillRect(cells, simulation.width, entry.spur, entry.material);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = entry.material;
    fillRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
    fillRect(cells, simulation.width, entry.contact.owner, entry.material);
    fillRect(cells, simulation.width, entry.contact.unlike, entry.contact.unlikeMaterial);
  }
}

function fillRect(
  cells: Uint8Array,
  worldWidth: number,
  rect: StructuralRigidGraphicsRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * worldWidth + rect.x, y * worldWidth + rect.width + rect.x);
  }
}

function rectPoints(rect: StructuralRigidGraphicsRect): StructuralRigidGraphicsPoint[] {
  const points: StructuralRigidGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}

function shellPoints(shell: StructuralRigidShellControl): StructuralRigidGraphicsPoint[] {
  return rectPoints(shell.outer).filter(({ x, y }) => (
    x < shell.interior.x || x >= shell.interior.x + shell.interior.width
      || y < shell.interior.y || y >= shell.interior.y + shell.interior.height
  ));
}
