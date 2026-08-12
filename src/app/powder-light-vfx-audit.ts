import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;

export interface PowderLightVfxAuditPoint { readonly x: number; readonly y: number }
export interface PowderLightVfxAuditRect extends PowderLightVfxAuditPoint {
  readonly width: number;
  readonly height: number;
}

export interface PowderLightVfxCard {
  readonly material: Material.Sand | Material.Clay | Material.Concrete;
  readonly code: 'SAND' | 'CLAY' | 'CONC';
  readonly body: PowderLightVfxAuditRect;
  readonly warmSource: PowderLightVfxAuditRect;
  readonly coolSource: PowderLightVfxAuditRect;
  /** Semantic Empty separates each emitter from the powder owner. */
  readonly warmGap: PowderLightVfxAuditRect;
  readonly coolGap: PowderLightVfxAuditRect;
  /** Authored air must never become styled support. */
  readonly authoredHole: PowderLightVfxAuditRect;
  /** Three cells beyond the field reach remain a fine-structure no-op. */
  readonly fineColumn: PowderLightVfxAuditRect;
  /** A nearby source proves the fine-structure exclusion under live emission. */
  readonly fineSource: PowderLightVfxAuditRect;
  readonly fineGap: PowderLightVfxAuditRect;
  /** A deep owner sample should remain darker than the facing shoulders. */
  readonly darkCore: PowderLightVfxAuditRect;
}

export interface PowderLightVfxAuditSnapshot {
  readonly cards: readonly PowderLightVfxCard[];
  readonly isolatedSand: PowderLightVfxAuditPoint;
  readonly wetSuspension: {
    readonly water: PowderLightVfxAuditRect;
    readonly mixture: PowderLightVfxAuditRect;
    readonly sandPoints: readonly PowderLightVfxAuditPoint[];
    readonly source: PowderLightVfxAuditRect;
    readonly gap: PowderLightVfxAuditRect;
    readonly lightFacingSand: PowderLightVfxAuditPoint;
  };
  /** Native wall data stays an independent plane beside ordinary matter. */
  readonly nativeWall: PowderLightVfxAuditPoint;
  /** Native-wall strip in Sand's warm source gap, with matched body probes. */
  readonly transportOccluder: {
    readonly wall: PowderLightVfxAuditRect;
    readonly litFrontShoulder: PowderLightVfxAuditRect;
    readonly umbra: PowderLightVfxAuditRect;
    readonly openShoulder: PowderLightVfxAuditRect;
  };
  /** This empty card is deliberately wall-free: light must not invent a wall owner. */
  readonly wallFreeControl: PowderLightVfxAuditRect;
}

const CARD_Y = 40;
const BODY_WIDTH = 72;
const BODY_HEIGHT = 92;
const SOURCE_WIDTH = 3;
const SOURCE_HEIGHT = 72;
const GAP_WIDTH = 2;

function card(material: PowderLightVfxCard['material'], code: PowderLightVfxCard['code'], x: number): PowderLightVfxCard {
  const body = { x, y: CARD_Y, width: BODY_WIDTH, height: BODY_HEIGHT };
  return {
    material,
    code,
    body,
    warmSource: { x: x - GAP_WIDTH - SOURCE_WIDTH, y: CARD_Y + 10, width: SOURCE_WIDTH, height: SOURCE_HEIGHT },
    coolSource: { x: x + BODY_WIDTH + GAP_WIDTH, y: CARD_Y + 10, width: SOURCE_WIDTH, height: SOURCE_HEIGHT },
    warmGap: { x: x - GAP_WIDTH, y: CARD_Y + 10, width: GAP_WIDTH, height: SOURCE_HEIGHT },
    coolGap: { x: x + BODY_WIDTH, y: CARD_Y + 10, width: GAP_WIDTH, height: SOURCE_HEIGHT },
    authoredHole: { x: x + 5, y: CARD_Y + 31, width: 4, height: 5 },
    fineColumn: { x: x + 35, y: CARD_Y + BODY_HEIGHT + 13, width: 1, height: 3 },
    fineSource: { x: x + 27, y: CARD_Y + BODY_HEIGHT + 10, width: 3, height: 10 },
    fineGap: { x: x + 30, y: CARD_Y + BODY_HEIGHT + 10, width: 5, height: 10 },
    darkCore: { x: x + 43, y: CARD_Y + 56, width: 8, height: 16 },
  };
}

/**
 * Exact paused source/powder cards for E06. Every material write crosses the
 * ordinary `paint`/`erase` boundary so renderer presentation can never depend
 * on a synthetic material plane. The 2-cell source gaps retain an unambiguous
 * emission-field gradient without allowing source ownership to overlap powder.
 */
export const POWDER_LIGHT_VFX_AUDIT: PowderLightVfxAuditSnapshot = {
  cards: [
    card(Material.Sand, 'SAND', 40),
    card(Material.Clay, 'CLAY', 204),
    card(Material.Concrete, 'CONC', 368),
  ],
  // Six world cells from Clay's warm strip, but outside every card body.
  isolatedSand: { x: 193, y: 80 },
  wetSuspension: {
    water: { x: 38, y: 210, width: 158, height: 104 },
    mixture: { x: 84, y: 244, width: 66, height: 46 },
    sandPoints: buildWetSandPoints(84, 244, 66, 46),
    source: { x: 76, y: 248, width: 3, height: 38 },
    gap: { x: 79, y: 248, width: 5, height: 38 },
    lightFacingSand: { x: 85, y: 267 },
  },
  nativeWall: { x: 250, y: 224 },
  transportOccluder: {
    wall: { x: 38, y: 70, width: 2, height: 30 },
    litFrontShoulder: { x: 42, y: 52, width: 12, height: 14 },
    umbra: { x: 42, y: 76, width: 12, height: 18 },
    openShoulder: { x: 42, y: 106, width: 12, height: 14 },
  },
  wallFreeControl: { x: 270, y: 224, width: 68, height: 70 },
};

export function preparePowderLightVfxFixture(simulation: SimulationBackend): void {
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Powder-light VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  if (!simulation.paintWall || !simulation.walls) {
    throw new Error('Powder-light VFX fixture requires native wall support');
  }
  simulation.clear();
  for (const entry of POWDER_LIGHT_VFX_AUDIT.cards) {
    paintRect(simulation, entry.body, entry.material);
    paintRect(simulation, entry.warmSource, Material.Fire);
    paintRect(simulation, entry.coolSource, Material.ELEC);
    eraseRect(simulation, entry.authoredHole);
    paintRect(simulation, entry.fineColumn, entry.material);
    paintRect(simulation, entry.fineSource, Material.Fire);
    eraseRect(simulation, entry.fineGap);
  }
  paintPoint(simulation, POWDER_LIGHT_VFX_AUDIT.isolatedSand, Material.Sand);
  paintRect(simulation, POWDER_LIGHT_VFX_AUDIT.wetSuspension.water, Material.Water);
  paintRect(simulation, POWDER_LIGHT_VFX_AUDIT.wetSuspension.source, Material.Fire);
  eraseRect(simulation, POWDER_LIGHT_VFX_AUDIT.wetSuspension.gap);
  for (const point of POWDER_LIGHT_VFX_AUDIT.wetSuspension.sandPoints) {
    paintPoint(simulation, point, Material.Sand);
  }
  simulation.paintWall(POWDER_LIGHT_VFX_AUDIT.nativeWall.x, POWDER_LIGHT_VFX_AUDIT.nativeWall.y, 1, 0);
  const paintWall = simulation.paintWall.bind(simulation);
  forEachPoint(POWDER_LIGHT_VFX_AUDIT.transportOccluder.wall, (point) => {
    paintWall(point.x, point.y, 1, 0);
  });
}

function paintRect(simulation: SimulationBackend, rect: PowderLightVfxAuditRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) simulation.paint(x, y, material, 0);
  }
}

function eraseRect(simulation: SimulationBackend, rect: PowderLightVfxAuditRect): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) simulation.erase(x, y, 0);
  }
}

function paintPoint(simulation: SimulationBackend, point: PowderLightVfxAuditPoint, material: Material): void {
  simulation.paint(point.x, point.y, material, 0);
}

function forEachPoint(
  rect: PowderLightVfxAuditRect, visit: (point: PowderLightVfxAuditPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}

function buildWetSandPoints(x: number, y: number, width: number, height: number): readonly PowderLightVfxAuditPoint[] {
  const points: PowderLightVfxAuditPoint[] = [];
  for (let py = y; py < y + height; py++) for (let px = x; px < x + width; px++) {
    // Repeated 2:1 one-cell Sand/Water weave is a genuine shared suspension
    // support, never a dry Sand island placed over a water rectangle.
    if ((px - x + py - y) % 3 !== 2) points.push({ x: px, y: py });
  }
  return points;
}
