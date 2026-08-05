import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;

export interface LiquidSolidMeniscusVfxPoint { readonly x: number; readonly y: number }
export interface LiquidSolidMeniscusVfxRect extends LiquidSolidMeniscusVfxPoint {
  readonly width: number;
  readonly height: number;
}

export interface LiquidSolidMeniscusVfxCard {
  readonly code: 'WATR_METL' | 'OIL_GLAS' | 'ACID_BRCK';
  readonly orientation: 'horizontal' | 'vertical';
  readonly liquidMaterial: Material.Water | Material.Oil | Material.Acid;
  readonly solidMaterial: Material.Metal | Material.Glass | Material.Brick;
  readonly liquid: LiquidSolidMeniscusVfxRect;
  readonly solid: LiquidSolidMeniscusVfxRect;
  /** Exact liquid owner immediately against the broad compatible solid. */
  readonly liquidContactProbe: LiquidSolidMeniscusVfxPoint;
  readonly solidContactProbe: LiquidSolidMeniscusVfxPoint;
  /** Exact liquid owner far enough from the contact to reject a body-wide grade. */
  readonly deepCoreProbe: LiquidSolidMeniscusVfxPoint;
  /** Separate liquid with a broad air-facing perimeter. */
  readonly airMeniscus: LiquidSolidMeniscusVfxRect;
}

export interface LiquidSolidMeniscusVfxAuditSnapshot {
  readonly cards: readonly LiquidSolidMeniscusVfxCard[];
  readonly unlikeLiquidSeam: {
    readonly left: LiquidSolidMeniscusVfxRect;
    readonly right: LiquidSolidMeniscusVfxRect;
    readonly leftProbe: LiquidSolidMeniscusVfxPoint;
    readonly rightProbe: LiquidSolidMeniscusVfxPoint;
  };
  readonly nativeWall: {
    readonly liquid: LiquidSolidMeniscusVfxRect;
    readonly wallAnchor: LiquidSolidMeniscusVfxPoint;
  };
  readonly lava: LiquidSolidMeniscusVfxRect;
  readonly powderContact: {
    readonly liquid: LiquidSolidMeniscusVfxRect;
    readonly powder: LiquidSolidMeniscusVfxRect;
    readonly liquidProbe: LiquidSolidMeniscusVfxPoint;
  };
  readonly gasContact: {
    readonly liquid: LiquidSolidMeniscusVfxRect;
    readonly gas: LiquidSolidMeniscusVfxRect;
    readonly liquidProbe: LiquidSolidMeniscusVfxPoint;
  };
  readonly strand: LiquidSolidMeniscusVfxRect;
  readonly droplet: LiquidSolidMeniscusVfxRect;
  readonly perforatedLiquid: {
    readonly body: LiquidSolidMeniscusVfxRect;
    readonly authoredHole: LiquidSolidMeniscusVfxRect;
    readonly openChannel: LiquidSolidMeniscusVfxRect;
  };
  readonly ownerControls: {
    /** Exact Water beside an emitter-trait Solid; ordinaryCandidate must reject it. */
    readonly traitLike: LiquidSolidMeniscusVfxRect & {
      readonly owner: LiquidSolidMeniscusVfxRect;
      readonly liquidProbe: LiquidSolidMeniscusVfxPoint;
    };
    /** Exact Water beside emissive matter; a light source is not Solid contact. */
    readonly emissive: LiquidSolidMeniscusVfxRect & {
      readonly owner: LiquidSolidMeniscusVfxRect;
      readonly liquidProbe: LiquidSolidMeniscusVfxPoint;
    };
  };
  readonly mixedTripleContact: {
    readonly liquid: LiquidSolidMeniscusVfxRect;
    readonly solid: LiquidSolidMeniscusVfxRect;
    readonly foreign: LiquidSolidMeniscusVfxRect;
    /** Liquid cell whose forward 2x2 contact stencil sees both owners. */
    readonly liquidProbe: LiquidSolidMeniscusVfxPoint;
  };
  readonly guardedBlank: LiquidSolidMeniscusVfxRect;
  readonly conductiveWall: number;
}

function horizontalCard(
  code: LiquidSolidMeniscusVfxCard['code'], liquidMaterial: LiquidSolidMeniscusVfxCard['liquidMaterial'],
  solidMaterial: LiquidSolidMeniscusVfxCard['solidMaterial'], x: number,
): LiquidSolidMeniscusVfxCard {
  return {
    code, orientation: 'horizontal', liquidMaterial, solidMaterial,
    liquid: { x, y: 20, width: 120, height: 42 },
    solid: { x, y: 62, width: 120, height: 38 },
    liquidContactProbe: { x: x + 60, y: 61 }, solidContactProbe: { x: x + 60, y: 62 },
    deepCoreProbe: { x: x + 60, y: 38 },
    airMeniscus: { x: x + 18, y: 114, width: 30, height: 14 },
  };
}

function verticalCard(
  code: LiquidSolidMeniscusVfxCard['code'], liquidMaterial: LiquidSolidMeniscusVfxCard['liquidMaterial'],
  solidMaterial: LiquidSolidMeniscusVfxCard['solidMaterial'], x: number,
): LiquidSolidMeniscusVfxCard {
  return {
    code, orientation: 'vertical', liquidMaterial, solidMaterial,
    liquid: { x, y: 146, width: 54, height: 78 },
    solid: { x: x + 54, y: 146, width: 66, height: 78 },
    liquidContactProbe: { x: x + 53, y: 185 }, solidContactProbe: { x: x + 54, y: 185 },
    deepCoreProbe: { x: x + 20, y: 185 },
    airMeniscus: { x: x + 70, y: 236, width: 22, height: 18 },
  };
}

/**
 * Paused exact-owner fixture for E14's liquid/solid meniscus study. It has no
 * renderer toggle and uses direct cell writes only, so every later comparison
 * shares deterministic material, wall, seam, and topology evidence.
 */
export const LIQUID_SOLID_MENISCUS_VFX_AUDIT: LiquidSolidMeniscusVfxAuditSnapshot = {
  cards: [
    horizontalCard('WATR_METL', Material.Water, Material.Metal, 24),
    horizontalCard('OIL_GLAS', Material.Oil, Material.Glass, 208),
    horizontalCard('ACID_BRCK', Material.Acid, Material.Brick, 392),
    verticalCard('WATR_METL', Material.Water, Material.Metal, 24),
    verticalCard('OIL_GLAS', Material.Oil, Material.Glass, 208),
    verticalCard('ACID_BRCK', Material.Acid, Material.Brick, 392),
  ],
  unlikeLiquidSeam: {
    left: { x: 24, y: 278, width: 72, height: 30 },
    right: { x: 96, y: 278, width: 72, height: 30 },
    leftProbe: { x: 95, y: 293 }, rightProbe: { x: 96, y: 293 },
  },
  nativeWall: { liquid: { x: 194, y: 278, width: 76, height: 30 }, wallAnchor: { x: 232, y: 292 } },
  lava: { x: 294, y: 278, width: 56, height: 30 },
  powderContact: {
    liquid: { x: 374, y: 278, width: 42, height: 30 }, powder: { x: 416, y: 278, width: 42, height: 30 },
    liquidProbe: { x: 415, y: 293 },
  },
  gasContact: {
    liquid: { x: 482, y: 278, width: 42, height: 30 }, gas: { x: 524, y: 278, width: 42, height: 30 },
    liquidProbe: { x: 523, y: 293 },
  },
  strand: { x: 24, y: 330, width: 1, height: 32 },
  droplet: { x: 48, y: 340, width: 4, height: 4 },
  perforatedLiquid: {
    body: { x: 78, y: 326, width: 92, height: 46 },
    authoredHole: { x: 112, y: 342, width: 12, height: 12 },
    openChannel: { x: 158, y: 326, width: 12, height: 15 },
  },
  ownerControls: {
    traitLike: {
      x: 194, y: 332, width: 24, height: 26,
      owner: { x: 218, y: 332, width: 24, height: 26 },
      liquidProbe: { x: 217, y: 345 },
    },
    emissive: {
      x: 268, y: 332, width: 24, height: 26,
      owner: { x: 292, y: 332, width: 24, height: 26 },
      liquidProbe: { x: 291, y: 345 },
    },
  },
  mixedTripleContact: {
    liquid: { x: 332, y: 332, width: 28, height: 26 },
    solid: { x: 360, y: 332, width: 20, height: 13 },
    foreign: { x: 360, y: 345, width: 20, height: 13 },
    liquidProbe: { x: 359, y: 344 },
  },
  guardedBlank: { x: 500, y: 332, width: 70, height: 36 },
  conductiveWall: CONDUCTIVE_WALL,
};

interface LiquidSolidMeniscusFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
}

export function prepareLiquidSolidMeniscusVfxFixture(simulation: SimulationBackend): void {
  if (!supportsFixture(simulation)) throw new Error('Liquid-solid meniscus VFX fixture requires RenderLab wall plane');
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Liquid-solid meniscus VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const card of LIQUID_SOLID_MENISCUS_VFX_AUDIT.cards) {
    fillRect(cells, simulation.width, card.liquid, card.liquidMaterial);
    fillRect(cells, simulation.width, card.solid, card.solidMaterial);
    fillRect(cells, simulation.width, card.airMeniscus, card.liquidMaterial);
  }
  const fixture = LIQUID_SOLID_MENISCUS_VFX_AUDIT;
  fillRect(cells, simulation.width, fixture.unlikeLiquidSeam.left, Material.Water);
  fillRect(cells, simulation.width, fixture.unlikeLiquidSeam.right, Material.Oil);
  fillRect(cells, simulation.width, fixture.nativeWall.liquid, Material.Water);
  simulation.paintWall(fixture.nativeWall.wallAnchor.x, fixture.nativeWall.wallAnchor.y, CONDUCTIVE_WALL, 0);
  fillRect(cells, simulation.width, fixture.lava, Material.Lava);
  fillRect(cells, simulation.width, fixture.powderContact.liquid, Material.Water);
  fillRect(cells, simulation.width, fixture.powderContact.powder, Material.Sand);
  fillRect(cells, simulation.width, fixture.gasContact.liquid, Material.Water);
  fillRect(cells, simulation.width, fixture.gasContact.gas, Material.Smoke);
  fillRect(cells, simulation.width, fixture.strand, Material.Water);
  fillRect(cells, simulation.width, fixture.droplet, Material.Water);
  fillRect(cells, simulation.width, fixture.perforatedLiquid.body, Material.Water);
  fillRect(cells, simulation.width, fixture.perforatedLiquid.authoredHole, Material.Empty);
  fillRect(cells, simulation.width, fixture.perforatedLiquid.openChannel, Material.Empty);
  fillRect(cells, simulation.width, fixture.ownerControls.traitLike, Material.Water);
  fillRect(cells, simulation.width, fixture.ownerControls.traitLike.owner, Material.CLNE);
  fillRect(cells, simulation.width, fixture.ownerControls.emissive, Material.Water);
  fillRect(cells, simulation.width, fixture.ownerControls.emissive.owner, Material.Fire);
  fillRect(cells, simulation.width, fixture.mixedTripleContact.liquid, Material.Water);
  fillRect(cells, simulation.width, fixture.mixedTripleContact.solid, Material.Metal);
  fillRect(cells, simulation.width, fixture.mixedTripleContact.foreign, Material.Smoke);
  fillRect(cells, simulation.width, fixture.guardedBlank, Material.Empty);
}

function supportsFixture(simulation: SimulationBackend): simulation is LiquidSolidMeniscusFixtureBackend {
  const candidate = simulation as Partial<LiquidSolidMeniscusFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillRect(cells: Uint8Array, width: number, rect: LiquidSolidMeniscusVfxRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}
