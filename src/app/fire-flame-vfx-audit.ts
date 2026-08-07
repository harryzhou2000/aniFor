import { Material } from '../shared/materials';
import { ROOM_TEMPERATURE_DECIKELVIN } from '../shared/temperature';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;
const WALL_BLOCK_SIZE = 4;

/** Paused variants share every authored plane except exact Fire velocity bytes. */
export type FireFlameVfxFixtureMode = 'still' | 'moving';

export interface FireFlameVfxPoint { readonly x: number; readonly y: number }
export interface FireFlameVfxRect extends FireFlameVfxPoint {
  readonly width: number;
  readonly height: number;
}
export interface FireFlameVfxVector { readonly x: number; readonly y: number }

export interface FireFlameVfxTemperatureRect extends FireFlameVfxRect {
  readonly temperature: number;
}

export interface FireFlameVfxVelocityTarget extends FireFlameVfxTemperatureRect {
  readonly velocity: FireFlameVfxVector;
}

export interface FireFlameVfxBody {
  readonly bounds: FireFlameVfxRect;
  readonly base: FireFlameVfxRect;
  readonly baseTemperature: number;
  readonly hotCore: FireFlameVfxTemperatureRect;
  readonly coolPocket: FireFlameVfxTemperatureRect;
  /** Tapered outer envelope; velocity and temperature are written only to exact Fire. */
  readonly velocityTongue: FireFlameVfxVelocityTarget;
  /** Temperature-matched flat Fire surface that never receives authored velocity. */
  readonly straightNeutral: FireFlameVfxVelocityTarget;
  readonly authoredHole: FireFlameVfxRect;
  readonly openChannel: FireFlameVfxRect;
}

export interface FireFlameVfxControl {
  readonly code: 'ENERGY' | 'PLASMA' | 'LAVA' | 'SMOKE';
  readonly material: Material.ELEC | Material.Plasma | Material.Lava | Material.Smoke;
  readonly body: FireFlameVfxRect;
  readonly probe: FireFlameVfxPoint;
  readonly temperature: number;
}

export interface FireFlameVfxBoundary {
  readonly code: 'FIRE_SMOKE' | 'FIRE_METL';
  readonly fire: FireFlameVfxRect;
  readonly other: FireFlameVfxRect;
  readonly otherMaterial: Material.Smoke | Material.Metal;
  readonly fireProbe: FireFlameVfxPoint;
  readonly otherProbe: FireFlameVfxPoint;
  readonly fireTemperature: number;
  readonly otherTemperature: number;
}

export interface FireFlameVfxWallPattern {
  readonly region: FireFlameVfxRect;
  readonly blockSize: 4;
  readonly occupiedParity: 0;
  readonly wallProbe: FireFlameVfxPoint;
  readonly clearProbe: FireFlameVfxPoint;
}

export interface FireFlameVfxAuditSnapshot {
  readonly version: 1;
  readonly world: { readonly width: 612; readonly height: 384 };
  readonly material: Material.Fire;
  readonly body: FireFlameVfxBody;
  readonly sparse: {
    readonly strand: FireFlameVfxTemperatureRect & { readonly material: Material.Fire };
    readonly isolated: FireFlameVfxPoint & { readonly material: Material.Fire; readonly temperature: number };
  };
  readonly protectedControls: {
    readonly energy: FireFlameVfxControl & { readonly code: 'ENERGY'; readonly material: Material.ELEC };
    readonly plasma: FireFlameVfxControl & { readonly code: 'PLASMA'; readonly material: Material.Plasma };
    readonly lava: FireFlameVfxControl & { readonly code: 'LAVA'; readonly material: Material.Lava };
    readonly smoke: FireFlameVfxControl & { readonly code: 'SMOKE'; readonly material: Material.Smoke };
  };
  readonly contacts: {
    readonly fireSmoke: FireFlameVfxBoundary & {
      readonly code: 'FIRE_SMOKE'; readonly otherMaterial: Material.Smoke;
    };
    readonly fireMetal: FireFlameVfxBoundary & {
      readonly code: 'FIRE_METL'; readonly otherMaterial: Material.Metal;
    };
  };
  readonly wallCoexistence: FireFlameVfxWallPattern;
  readonly guardedBlank: FireFlameVfxRect;
  readonly conductiveWall: 1;
  readonly ambientTemperature: 2952;
  readonly expected: {
    readonly mainBodyFireCells: number;
    readonly fireCells: number;
    readonly energyCells: number;
    readonly plasmaCells: number;
    readonly lavaCells: number;
    readonly smokeCells: number;
    readonly metalCells: number;
    readonly wallCells: number;
    readonly movingVelocityCells: number;
    readonly temperatureCounts: readonly {
      readonly temperature: number; readonly cells: number;
    }[];
    /** FNV-1a over storage bytes; Uint16 words are hashed low byte then high byte. */
    readonly materialHash: number;
    readonly temperatureHash: number;
    readonly wallHash: number;
    readonly stillVelocityHash: number;
    readonly movingVelocityHash: number;
  };
}

const body: FireFlameVfxBody = {
  bounds: { x: 24, y: 38, width: 356, height: 176 },
  base: { x: 24, y: 102, width: 356, height: 112 },
  baseTemperature: 11_000,
  hotCore: { x: 104, y: 154, width: 72, height: 36, temperature: 24_500 },
  // 1,000 K stays visibly luminous while remaining below the 1,100 K body carrier.
  coolPocket: { x: 226, y: 156, width: 58, height: 34, temperature: 10_000 },
  velocityTongue: {
    x: 154, y: 38, width: 101, height: 64,
    temperature: 18_500, velocity: { x: 10, y: -56 },
  },
  straightNeutral: {
    x: 48, y: 102, width: 72, height: 32,
    temperature: 18_500, velocity: { x: 0, y: 0 },
  },
  authoredHole: { x: 190, y: 166, width: 18, height: 16 },
  openChannel: { x: 330, y: 102, width: 14, height: 52 },
};

const protectedControl = <Code extends FireFlameVfxControl['code'], Owner extends FireFlameVfxControl['material']>(
  code: Code, material: Owner, x: number, y: number, temperature: number,
): FireFlameVfxControl & { readonly code: Code; readonly material: Owner } => ({
  code, material, body: { x, y, width: 72, height: 42 },
  probe: { x: x + 35, y: y + 20 }, temperature,
});

const boundary = <Code extends FireFlameVfxBoundary['code'], Owner extends FireFlameVfxBoundary['otherMaterial']>(
  code: Code, x: number, otherMaterial: Owner, otherTemperature: number,
): FireFlameVfxBoundary & { readonly code: Code; readonly otherMaterial: Owner } => ({
  code,
  fire: { x, y: 268, width: 68, height: 40 },
  other: { x: x + 68, y: 268, width: 56, height: 40 },
  otherMaterial,
  fireProbe: { x: x + 67, y: 287 },
  otherProbe: { x: x + 68, y: 287 },
  fireTemperature: 13_500,
  otherTemperature,
});

const wallCoexistence: FireFlameVfxWallPattern = {
  // Sixteen by eight four-cell blocks: 64 occupied blocks / 1,024 native cells.
  region: { x: 292, y: 168, width: 64, height: 32 },
  blockSize: WALL_BLOCK_SIZE,
  occupiedParity: 0,
  wallProbe: { x: 293, y: 169 },
  clearProbe: { x: 297, y: 169 },
};

/**
 * Paused E67 exact-Fire fixture. Both modes have byte-identical material,
 * temperature, wall, void, contact, and silhouette planes. Moving mode changes
 * only the Fire cells inside `velocityTongue`, leaving its temperature-matched
 * straight surface and every sparse/foreign/contact control velocity-neutral.
 */
export const FIRE_FLAME_VFX_AUDIT: FireFlameVfxAuditSnapshot = {
  version: 1,
  world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
  material: Material.Fire,
  body,
  sparse: {
    strand: { x: 416, y: 168, width: 1, height: 52, material: Material.Fire, temperature: 10_500 },
    isolated: { x: 464, y: 194, material: Material.Fire, temperature: 10_500 },
  },
  protectedControls: {
    energy: protectedControl('ENERGY', Material.ELEC, 416, 36, 15_500),
    plasma: protectedControl('PLASMA', Material.Plasma, 512, 36, 32_000),
    lava: protectedControl('LAVA', Material.Lava, 416, 100, 21_000),
    smoke: protectedControl('SMOKE', Material.Smoke, 512, 100, 5_700),
  },
  contacts: {
    fireSmoke: boundary('FIRE_SMOKE', 24, Material.Smoke, 5_200),
    fireMetal: boundary('FIRE_METL', 190, Material.Metal, ROOM_TEMPERATURE_DECIKELVIN),
  },
  wallCoexistence,
  guardedBlank: { x: 16, y: 340, width: 568, height: 28 },
  conductiveWall: CONDUCTIVE_WALL,
  ambientTemperature: ROOM_TEMPERATURE_DECIKELVIN,
  expected: {
    mainBodyFireCells: 43_340,
    fireCells: 48_833,
    energyCells: 3_024,
    plasmaCells: 3_024,
    lavaCells: 3_024,
    smokeCells: 5_264,
    metalCells: 2_240,
    wallCells: 1_024,
    movingVelocityCells: 4_484,
    temperatureCounts: [
      { temperature: 2_952, cells: 171_839 },
      { temperature: 5_200, cells: 2_240 },
      { temperature: 5_700, cells: 3_024 },
      { temperature: 10_000, cells: 1_972 },
      { temperature: 10_500, cells: 53 },
      { temperature: 11_000, cells: 31_988 },
      { temperature: 13_500, cells: 5_440 },
      { temperature: 15_500, cells: 3_024 },
      { temperature: 18_500, cells: 6_788 },
      { temperature: 21_000, cells: 3_024 },
      { temperature: 24_500, cells: 2_592 },
      { temperature: 32_000, cells: 3_024 },
    ],
    materialHash: 4_007_779_361,
    temperatureHash: 2_604_700_067,
    wallHash: 1_968_978_373,
    stillVelocityHash: 437_095_877,
    movingVelocityHash: 1_144_943_781,
  },
};

interface FireFlameVfxFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  temperature(): Uint16Array;
  velocity(): Int8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
  setFixtureTemperatureRect(
    x: number, y: number, width: number, height: number, temperature: number,
  ): void;
  setFixtureVelocityRect(
    x: number, y: number, width: number, height: number, velocityX: number, velocityY: number,
  ): void;
}

export function prepareFireFlameVfxFixture(
  simulation: SimulationBackend,
  mode: FireFlameVfxFixtureMode,
): void {
  if (!supportsFixture(simulation)) {
    throw new Error('Fire-flame VFX fixture requires render-lab temperature, velocity, and wall planes');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Fire-flame VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }

  simulation.clear();
  const cells = simulation.cells();
  const fixture = FIRE_FLAME_VFX_AUDIT;

  fillRect(cells, simulation.width, fixture.body.base, Material.Fire);
  fillTaperedTongue(cells, simulation.width, fixture.body.velocityTongue, Material.Fire);
  fillRect(cells, simulation.width, fixture.body.authoredHole, Material.Empty);
  fillRect(cells, simulation.width, fixture.body.openChannel, Material.Empty);

  const { strand, isolated } = fixture.sparse;
  fillRect(cells, simulation.width, strand, strand.material);
  setPoint(cells, simulation.width, isolated, isolated.material);
  for (const control of Object.values(fixture.protectedControls)) {
    fillRect(cells, simulation.width, control.body, control.material);
  }
  for (const contact of Object.values(fixture.contacts)) {
    fillRect(cells, simulation.width, contact.fire, Material.Fire);
    fillRect(cells, simulation.width, contact.other, contact.otherMaterial);
  }
  fillRect(cells, simulation.width, fixture.guardedBlank, Material.Empty);
  paintWallPattern(simulation, fixture.wallCoexistence);

  setExactOwnerTemperatureRuns(
    simulation, cells, fixture.body.bounds, Material.Fire, fixture.body.baseTemperature,
  );
  for (const target of [
    fixture.body.hotCore, fixture.body.coolPocket,
    fixture.body.velocityTongue, fixture.body.straightNeutral,
  ]) {
    setExactOwnerTemperatureRuns(simulation, cells, target, Material.Fire, target.temperature);
  }
  setExactOwnerTemperatureRuns(simulation, cells, strand, Material.Fire, strand.temperature);
  simulation.setFixtureTemperatureRect(
    isolated.x, isolated.y, 1, 1, isolated.temperature,
  );
  for (const control of Object.values(fixture.protectedControls)) {
    simulation.setFixtureTemperatureRect(
      control.body.x, control.body.y, control.body.width, control.body.height, control.temperature,
    );
  }
  for (const contact of Object.values(fixture.contacts)) {
    simulation.setFixtureTemperatureRect(
      contact.fire.x, contact.fire.y, contact.fire.width, contact.fire.height,
      contact.fireTemperature,
    );
    simulation.setFixtureTemperatureRect(
      contact.other.x, contact.other.y, contact.other.width, contact.other.height,
      contact.otherTemperature,
    );
  }

  if (mode === 'moving') {
    setExactOwnerVelocityRuns(
      simulation, cells, fixture.body.velocityTongue, Material.Fire,
      fixture.body.velocityTongue.velocity,
    );
  }
}

function supportsFixture(simulation: SimulationBackend): simulation is FireFlameVfxFixtureBackend {
  const candidate = simulation as Partial<FireFlameVfxFixtureBackend>;
  return typeof candidate.walls === 'function'
    && typeof candidate.temperature === 'function'
    && typeof candidate.velocity === 'function'
    && typeof candidate.paintWall === 'function'
    && typeof candidate.setFixtureTemperatureRect === 'function'
    && typeof candidate.setFixtureVelocityRect === 'function';
}

function fillTaperedTongue(
  cells: Uint8Array, width: number, bounds: FireFlameVfxRect, material: Material,
): void {
  const centreX = bounds.x + Math.floor(bounds.width / 2);
  const lastRow = Math.max(1, bounds.height - 1);
  for (let offsetY = 0; offsetY < bounds.height; offsetY++) {
    const halfWidth = 20 + Math.floor(offsetY * 30 / lastRow);
    const row = (bounds.y + offsetY) * width;
    cells.fill(material, row + centreX - halfWidth, row + centreX + halfWidth + 1);
  }
}

function setExactOwnerTemperatureRuns(
  simulation: FireFlameVfxFixtureBackend,
  cells: Uint8Array,
  rect: FireFlameVfxRect,
  owner: Material,
  temperature: number,
): void {
  const right = rect.x + rect.width;
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    let x = rect.x;
    while (x < right) {
      while (x < right && cells[y * simulation.width + x] !== owner) x++;
      const start = x;
      while (x < right && cells[y * simulation.width + x] === owner) x++;
      if (x > start) simulation.setFixtureTemperatureRect(start, y, x - start, 1, temperature);
    }
  }
}

function setExactOwnerVelocityRuns(
  simulation: FireFlameVfxFixtureBackend,
  cells: Uint8Array,
  rect: FireFlameVfxRect,
  owner: Material,
  velocity: FireFlameVfxVector,
): void {
  const right = rect.x + rect.width;
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    let x = rect.x;
    while (x < right) {
      while (x < right && cells[y * simulation.width + x] !== owner) x++;
      const start = x;
      while (x < right && cells[y * simulation.width + x] === owner) x++;
      if (x > start) simulation.setFixtureVelocityRect(
        start, y, x - start, 1, velocity.x, velocity.y,
      );
    }
  }
}

function paintWallPattern(
  simulation: FireFlameVfxFixtureBackend,
  pattern: FireFlameVfxWallPattern,
): void {
  for (let offsetY = 0; offsetY < pattern.region.height; offsetY += WALL_BLOCK_SIZE) {
    for (let offsetX = 0; offsetX < pattern.region.width; offsetX += WALL_BLOCK_SIZE) {
      const blockX = offsetX / WALL_BLOCK_SIZE;
      const blockY = offsetY / WALL_BLOCK_SIZE;
      if ((blockX + blockY) % 2 !== pattern.occupiedParity) continue;
      simulation.paintWall(
        pattern.region.x + offsetX,
        pattern.region.y + offsetY,
        CONDUCTIVE_WALL,
        0,
      );
    }
  }
}

function fillRect(
  cells: Uint8Array,
  width: number,
  rect: FireFlameVfxRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function setPoint(
  cells: Uint8Array,
  width: number,
  point: FireFlameVfxPoint,
  material: Material,
): void {
  cells[point.y * width + point.x] = material;
}
