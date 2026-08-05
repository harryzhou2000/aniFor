import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;

export interface WetSedimentVfxPoint { readonly x: number; readonly y: number }
export interface WetSedimentVfxRect extends WetSedimentVfxPoint {
  readonly width: number;
  readonly height: number;
}

export interface WetSedimentVfxPositiveCard {
  readonly material: Material.Sand | Material.Clay | Material.Concrete;
  readonly code: 'SAND' | 'CLAY' | 'CONC';
  /** Water envelope around the exact-owner sediment weave. */
  readonly body: WetSedimentVfxRect;
  /** The dense 2:1 powder/Water aggregate that must seed the shared field. */
  readonly aggregateBody: WetSedimentVfxRect;
  readonly powderProbe: WetSedimentVfxPoint;
  readonly waterProbe: WetSedimentVfxPoint;
  /** Even-aligned world point used to inspect one exact half-resolution texel. */
  readonly fieldProbe: WetSedimentVfxPoint;
  /** Authored Empty must remain semantically empty. */
  readonly authoredHole: WetSedimentVfxRect;
  /** An air cutout from the body edge, not a reconstructable wet owner. */
  readonly openNotch: WetSedimentVfxRect;
  /** Narrow wet structure: E12 must not treat it as a broad body. */
  readonly fineWater: WetSedimentVfxRect;
  readonly fineColumn: WetSedimentVfxRect;
}

export interface WetSedimentVfxAuditSnapshot {
  readonly cards: readonly WetSedimentVfxPositiveCard[];
  readonly dry: readonly {
    readonly material: Material.Sand | Material.Clay | Material.Concrete;
    readonly body: WetSedimentVfxRect;
    readonly probe: WetSedimentVfxPoint;
  }[];
  /** The shared field is intentionally live here; motion must reject E12 later. */
  readonly movingWetSand: {
    readonly body: WetSedimentVfxRect;
    readonly aggregateBody: WetSedimentVfxRect;
    readonly powderProbe: WetSedimentVfxPoint;
    readonly waterProbe: WetSedimentVfxPoint;
    readonly fieldProbe: WetSedimentVfxPoint;
    readonly velocity: readonly [number, number];
  };
  /** Non-aqueous controls must not enter the suspension field. */
  readonly oil: { readonly body: WetSedimentVfxRect; readonly fieldProbe: WetSedimentVfxPoint };
  readonly lava: { readonly body: WetSedimentVfxRect; readonly fieldProbe: WetSedimentVfxPoint };
  /** Two distinct aqueous owners are still an exact-owner rejection. */
  readonly unlikeAqueous: {
    readonly body: WetSedimentVfxRect;
    readonly aggregateBody: WetSedimentVfxRect;
    readonly fieldProbe: WetSedimentVfxPoint;
  };
  /** The suspension field may own Salt; E12 must reject this foreign powder. */
  readonly foreignSalt: {
    readonly body: WetSedimentVfxRect;
    readonly aggregateBody: WetSedimentVfxRect;
    readonly powderProbe: WetSedimentVfxPoint;
    readonly fieldProbe: WetSedimentVfxPoint;
  };
  readonly nativeWall: {
    readonly body: WetSedimentVfxRect;
    readonly aggregateBody: WetSedimentVfxRect;
    readonly wallAnchor: WetSedimentVfxPoint;
    readonly fieldProbe: WetSedimentVfxPoint;
  };
  readonly fineColumn: { readonly water: WetSedimentVfxRect; readonly column: WetSedimentVfxRect };
  readonly isolated: { readonly water: WetSedimentVfxRect; readonly point: WetSedimentVfxPoint };
  readonly gap: {
    readonly body: WetSedimentVfxRect;
    readonly aggregateBody: WetSedimentVfxRect;
    readonly authoredGap: WetSedimentVfxRect;
    readonly gapProbe: WetSedimentVfxPoint;
  };
  readonly guardedBlank: WetSedimentVfxRect;
  readonly conductiveWall: number;
}

function firstWeavePoint(rect: WetSedimentVfxRect): WetSedimentVfxPoint {
  for (let y = rect.y; y < rect.y + rect.height; y += 2) {
    for (let x = rect.x; x < rect.x + rect.width; x += 2) {
      if ((x + y) % 3 !== 2) return { x, y };
    }
  }
  throw new Error('Wet sediment weave has no powder point');
}

function firstWaterPoint(rect: WetSedimentVfxRect): WetSedimentVfxPoint {
  for (let y = rect.y; y < rect.y + rect.height; y += 2) {
    for (let x = rect.x; x < rect.x + rect.width; x += 2) {
      if ((x + y) % 3 === 2) return { x, y };
    }
  }
  throw new Error('Wet sediment weave has no Water point');
}

function positiveCard(
  material: WetSedimentVfxPositiveCard['material'],
  code: WetSedimentVfxPositiveCard['code'], x: number,
): WetSedimentVfxPositiveCard {
  const body = { x: x + 8, y: 24, width: 160, height: 104 };
  const aggregateBody = { x: x + 24, y: 40, width: 112, height: 64 };
  const powderProbe = firstWeavePoint(aggregateBody);
  return {
    material,
    code,
    body,
    aggregateBody,
    powderProbe,
    waterProbe: firstWaterPoint(aggregateBody),
    fieldProbe: powderProbe,
    authoredHole: { x: x + 64, y: 62, width: 12, height: 10 },
    openNotch: { x: x + 152, y: 94, width: 16, height: 14 },
    fineWater: { x: x + 144, y: 132, width: 12, height: 16 },
    fineColumn: { x: x + 150, y: 134, width: 1, height: 12 },
  };
}

const movingBody = { x: 16, y: 236, width: 92, height: 60 };
const movingAggregate = { x: 28, y: 248, width: 68, height: 36 };
const oilBody = { x: 128, y: 236, width: 72, height: 60 };
const lavaBody = { x: 216, y: 236, width: 72, height: 60 };
const unlikeBody = { x: 304, y: 236, width: 80, height: 60 };
const unlikeAggregate = { x: 316, y: 248, width: 56, height: 36 };
const saltBody = { x: 400, y: 236, width: 72, height: 60 };
const saltAggregate = { x: 412, y: 248, width: 48, height: 36 };
const wallBody = { x: 488, y: 236, width: 88, height: 60 };
const wallAggregate = { x: 500, y: 248, width: 64, height: 36 };

export const WET_SEDIMENT_VFX_AUDIT: WetSedimentVfxAuditSnapshot = {
  cards: [
    positiveCard(Material.Sand, 'SAND', 16),
    positiveCard(Material.Clay, 'CLAY', 216),
    positiveCard(Material.Concrete, 'CONC', 416),
  ],
  dry: [
    { material: Material.Sand, body: { x: 16, y: 178, width: 48, height: 38 }, probe: { x: 32, y: 194 } },
    { material: Material.Clay, body: { x: 76, y: 178, width: 48, height: 38 }, probe: { x: 92, y: 194 } },
    { material: Material.Concrete, body: { x: 136, y: 178, width: 48, height: 38 }, probe: { x: 152, y: 194 } },
  ],
  movingWetSand: {
    body: movingBody,
    aggregateBody: movingAggregate,
    powderProbe: firstWeavePoint(movingAggregate),
    waterProbe: firstWaterPoint(movingAggregate),
    fieldProbe: firstWeavePoint(movingAggregate),
    velocity: [12, 0],
  },
  oil: { body: oilBody, fieldProbe: { x: 152, y: 260 } },
  lava: { body: lavaBody, fieldProbe: { x: 240, y: 260 } },
  unlikeAqueous: {
    body: unlikeBody,
    aggregateBody: unlikeAggregate,
    fieldProbe: { x: 344, y: 264 },
  },
  foreignSalt: {
    body: saltBody,
    aggregateBody: saltAggregate,
    powderProbe: firstWeavePoint(saltAggregate),
    fieldProbe: firstWeavePoint(saltAggregate),
  },
  nativeWall: {
    body: wallBody,
    aggregateBody: wallAggregate,
    wallAnchor: { x: 528, y: 260 },
    fieldProbe: { x: 528, y: 260 },
  },
  fineColumn: {
    water: { x: 128, y: 320, width: 16, height: 48 },
    column: { x: 134, y: 324, width: 1, height: 36 },
  },
  isolated: {
    water: { x: 164, y: 320, width: 20, height: 20 },
    point: { x: 174, y: 330 },
  },
  gap: {
    body: { x: 216, y: 312, width: 88, height: 56 },
    aggregateBody: { x: 228, y: 322, width: 64, height: 36 },
    authoredGap: { x: 248, y: 332, width: 16, height: 12 },
    gapProbe: { x: 256, y: 336 },
  },
  guardedBlank: { x: 336, y: 316, width: 100, height: 48 },
  conductiveWall: CONDUCTIVE_WALL,
};

interface WetSedimentFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
  velocity(): Int8Array;
}

/**
 * Direct-fills a paused 612x384 RenderLab scene. This intentionally does not
 * step physics: callers synchronize the authored plane through the renderer's
 * fixture path, then observe the existing liquid/suspension refresh cadence.
 */
export function prepareWetSedimentVfxFixture(simulation: SimulationBackend): void {
  if (!supportsWetSedimentFixture(simulation)) {
    throw new Error('Wet-sediment VFX fixture requires RenderLab wall and velocity planes');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Wet-sediment VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();

  for (const card of WET_SEDIMENT_VFX_AUDIT.cards) {
    fillRect(cells, simulation.width, card.body, Material.Water);
    fillWeave(cells, simulation.width, card.aggregateBody, Material.Water, card.material);
    fillRect(cells, simulation.width, card.authoredHole, Material.Empty);
    fillRect(cells, simulation.width, card.openNotch, Material.Empty);
    fillRect(cells, simulation.width, card.fineWater, Material.Water);
    fillRect(cells, simulation.width, card.fineColumn, card.material);
  }

  for (const control of WET_SEDIMENT_VFX_AUDIT.dry) {
    fillRect(cells, simulation.width, control.body, control.material);
  }

  const moving = WET_SEDIMENT_VFX_AUDIT.movingWetSand;
  fillRect(cells, simulation.width, moving.body, Material.Water);
  fillWeave(cells, simulation.width, moving.aggregateBody, Material.Water, Material.Sand);
  const velocity = simulation.velocity();
  for (let y = moving.aggregateBody.y; y < moving.aggregateBody.y + moving.aggregateBody.height; y++) {
    for (let x = moving.aggregateBody.x; x < moving.aggregateBody.x + moving.aggregateBody.width; x++) {
      const index = y * simulation.width + x;
      if (cells[index] !== Material.Sand) continue;
      velocity[index * 2] = moving.velocity[0];
      velocity[index * 2 + 1] = moving.velocity[1];
    }
  }

  fillLiquidControl(cells, simulation.width, WET_SEDIMENT_VFX_AUDIT.oil.body, Material.Oil, Material.Sand);
  fillLiquidControl(cells, simulation.width, WET_SEDIMENT_VFX_AUDIT.lava.body, Material.Lava, Material.Sand);

  const unlike = WET_SEDIMENT_VFX_AUDIT.unlikeAqueous;
  fillRect(cells, simulation.width, unlike.body, Material.Water);
  fillUnlikeAqueousWeave(cells, simulation.width, unlike.aggregateBody);
  set(cells, simulation.width, unlike.fieldProbe, Material.Sand);

  const salt = WET_SEDIMENT_VFX_AUDIT.foreignSalt;
  fillRect(cells, simulation.width, salt.body, Material.Water);
  fillWeave(cells, simulation.width, salt.aggregateBody, Material.Water, Material.Salt);

  const wall = WET_SEDIMENT_VFX_AUDIT.nativeWall;
  fillRect(cells, simulation.width, wall.body, Material.Water);
  fillWeave(cells, simulation.width, wall.aggregateBody, Material.Water, Material.Sand);
  set(cells, simulation.width, wall.fieldProbe, Material.Sand);
  simulation.paintWall(wall.wallAnchor.x, wall.wallAnchor.y, CONDUCTIVE_WALL, 0);

  fillRect(cells, simulation.width, WET_SEDIMENT_VFX_AUDIT.fineColumn.water, Material.Water);
  fillRect(cells, simulation.width, WET_SEDIMENT_VFX_AUDIT.fineColumn.column, Material.Sand);
  fillRect(cells, simulation.width, WET_SEDIMENT_VFX_AUDIT.isolated.water, Material.Water);
  set(cells, simulation.width, WET_SEDIMENT_VFX_AUDIT.isolated.point, Material.Sand);

  const gap = WET_SEDIMENT_VFX_AUDIT.gap;
  fillRect(cells, simulation.width, gap.body, Material.Water);
  fillWeave(cells, simulation.width, gap.aggregateBody, Material.Water, Material.Sand);
  fillRect(cells, simulation.width, gap.authoredGap, Material.Empty);
  fillRect(cells, simulation.width, WET_SEDIMENT_VFX_AUDIT.guardedBlank, Material.Empty);
}

function supportsWetSedimentFixture(simulation: SimulationBackend): simulation is WetSedimentFixtureBackend {
  const candidate = simulation as Partial<WetSedimentFixtureBackend>;
  return typeof candidate.walls === 'function'
    && typeof candidate.paintWall === 'function'
    && typeof candidate.velocity === 'function';
}

function fillLiquidControl(
  cells: Uint8Array, width: number, body: WetSedimentVfxRect,
  liquid: Material.Oil | Material.Lava, powder: Material.Sand,
): void {
  fillRect(cells, width, body, liquid);
  fillWeave(cells, width, { x: body.x + 12, y: body.y + 12, width: body.width - 24, height: body.height - 24 }, liquid, powder);
}

function fillUnlikeAqueousWeave(cells: Uint8Array, width: number, rect: WetSedimentVfxRect): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) for (let x = rect.x; x < rect.x + rect.width; x++) {
    const selector = (x + y) % 4;
    set(cells, width, { x, y }, selector === 0 ? Material.Sand
      : selector === 1 ? Material.DistilledWater : Material.Water);
  }
}

function fillWeave(
  cells: Uint8Array, width: number, rect: WetSedimentVfxRect,
  liquid: Material.Water | Material.Oil | Material.Lava, powder: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) for (let x = rect.x; x < rect.x + rect.width; x++) {
    set(cells, width, { x, y }, (x + y) % 3 === 2 ? liquid : powder);
  }
}

function fillRect(cells: Uint8Array, width: number, rect: WetSedimentVfxRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function set(cells: Uint8Array, width: number, point: WetSedimentVfxPoint, material: Material): void {
  cells[point.y * width + point.x] = material;
}
