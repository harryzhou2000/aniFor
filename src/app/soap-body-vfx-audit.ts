import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;
const WALL_BLOCK_SIZE = 4;

export interface SoapBodyVfxPoint { readonly x: number; readonly y: number }
export interface SoapBodyVfxRect extends SoapBodyVfxPoint {
  readonly width: number;
  readonly height: number;
}

/** Aligned native bmap checker; exact Soap remains the semantic owner. */
export interface SoapBodyVfxWallPattern {
  readonly kind: 'native-wall-checker';
  readonly region: SoapBodyVfxRect;
  readonly blockSize: 4;
  readonly occupiedParity: 0;
  readonly wallProbe: SoapBodyVfxPoint;
  readonly clearProbe: SoapBodyVfxPoint;
}

export interface SoapBodyVfxDepthBands {
  /** Exact exposed row; vertical liquid optical depth is zero. */
  readonly surfaceLayer: SoapBodyVfxRect;
  /** Exact first interior row; vertical liquid optical depth is six. */
  readonly firstInnerLayer: SoapBodyVfxRect;
  /** Exact depth bytes 12--30. */
  readonly shallowBand: SoapBodyVfxRect;
  /** Exact depth bytes 36--66. */
  readonly transitionBand: SoapBodyVfxRect;
  /** Exact depth bytes 72--126. */
  readonly midBand: SoapBodyVfxRect;
  /** Exact depth bytes 192--255. */
  readonly deepBand: SoapBodyVfxRect;
}

export type SoapBodyVfxOtherMaterial = Material.Water | Material.Oil | Material.Acid
  | Material.GEL | Material.Glass | Material.Metal | Material.Sand | Material.Smoke;

export interface SoapBodyVfxBoundary {
  readonly code: 'SOAP_WATR' | 'SOAP_OIL' | 'SOAP_ACID' | 'SOAP_GEL'
    | 'SOAP_GLAS' | 'SOAP_METL' | 'SOAP_SAND' | 'SOAP_SMKE';
  readonly soap: SoapBodyVfxRect;
  readonly other: SoapBodyVfxRect;
  readonly otherMaterial: SoapBodyVfxOtherMaterial;
  readonly soapProbe: SoapBodyVfxPoint;
  readonly otherProbe: SoapBodyVfxPoint;
}

export interface SoapBodyVfxAuditSnapshot {
  readonly version: 1;
  readonly world: { readonly width: 612; readonly height: 384 };
  readonly target: {
    readonly code: 'SOAP';
    /** Native Soap is exact projected material ID 38. */
    readonly material: Material.Soap;
    readonly body: SoapBodyVfxRect;
    readonly crown: SoapBodyVfxRect;
    readonly pocket: SoapBodyVfxRect;
    readonly core: SoapBodyVfxRect;
    readonly depth: SoapBodyVfxDepthBands;
    readonly authoredHole: SoapBodyVfxRect;
    /** Empty channel deliberately reaches the exposed upper silhouette. */
    readonly openChannel: SoapBodyVfxRect;
    /** Enclosed Empty may reconstruct in the shared field, never semantically. */
    readonly reconstructablePinhole: SoapBodyVfxPoint;
    readonly wallCoexistence: SoapBodyVfxWallPattern;
  };
  readonly sparse: {
    readonly thinStrand: SoapBodyVfxRect;
    readonly droplet: SoapBodyVfxRect;
    readonly isolated: SoapBodyVfxPoint;
    readonly bubbleFilm: {
      readonly region: SoapBodyVfxRect;
      readonly ringPoints: readonly SoapBodyVfxPoint[];
      readonly chainPoints: readonly SoapBodyVfxPoint[];
      readonly ringCentre: SoapBodyVfxPoint;
      readonly chainGap: SoapBodyVfxPoint;
    };
  };
  /** Broad liquid cards reject both foreign species and same-optics widening. */
  readonly siblingLiquids: {
    readonly water: SoapBodyVfxRect & { readonly material: Material.Water };
    readonly oil: SoapBodyVfxRect & { readonly material: Material.Oil };
    readonly acid: SoapBodyVfxRect & { readonly material: Material.Acid };
    readonly lava: SoapBodyVfxRect & { readonly material: Material.Lava };
    readonly diesel: SoapBodyVfxRect & { readonly material: Material.Diesel };
    readonly nitro: SoapBodyVfxRect & { readonly material: Material.Nitro };
    readonly gel: SoapBodyVfxRect & { readonly material: Material.GEL };
    readonly moltenWax: SoapBodyVfxRect & { readonly material: Material.MWAX };
  };
  readonly seams: {
    readonly soapWater: SoapBodyVfxBoundary;
    readonly soapOil: SoapBodyVfxBoundary;
    readonly soapAcid: SoapBodyVfxBoundary;
    /** GEL shares ViscousLiquid optics, but never exact Soap ownership. */
    readonly soapGel: SoapBodyVfxBoundary;
  };
  readonly contacts: {
    readonly soapGlass: SoapBodyVfxBoundary;
    readonly soapMetal: SoapBodyVfxBoundary;
    readonly soapSand: SoapBodyVfxBoundary;
    readonly soapSmoke: SoapBodyVfxBoundary;
  };
  /** SOAP ctype link/bubble state is intentionally absent from presentation data. */
  readonly stateContract: 'state-agnostic';
  readonly guardedBlank: SoapBodyVfxRect;
  readonly conductiveWall: 1;
}

const body = { x: 16, y: 16, width: 360, height: 176 } as const;
const wallCoexistence: SoapBodyVfxWallPattern = {
  kind: 'native-wall-checker',
  // 80x64 cells in aligned 4x4 blocks, half occupied: exactly 2,560 cells.
  region: { x: 280, y: 112, width: 80, height: 64 },
  blockSize: WALL_BLOCK_SIZE,
  occupiedParity: 0,
  wallProbe: { x: 281, y: 113 },
  clearProbe: { x: 285, y: 113 },
};

const bubbleFilmRegion = { x: 456, y: 24, width: 128, height: 128 } as const;
const ringCentre = { x: 486, y: 64 } as const;
const chainGap = { x: 550, y: 117 } as const;

function boundary(
  code: SoapBodyVfxBoundary['code'],
  x: number,
  otherMaterial: SoapBodyVfxOtherMaterial,
): SoapBodyVfxBoundary {
  const soap = { x, y: 272, width: 32, height: 40 };
  const other = { x: x + soap.width, y: soap.y, width: 32, height: soap.height };
  return {
    code,
    soap,
    other,
    otherMaterial,
    soapProbe: { x: soap.x + soap.width - 1, y: soap.y + 20 },
    otherProbe: { x: other.x, y: other.y + 20 },
  };
}

/**
 * Paused exact-owner scene for the E46 Soap body experiment. It owns only
 * deterministic semantic matter and native-wall topology. SOAP's native ctype
 * link/bubble state is not projected, so this fixture neither reads nor authors
 * a presentation-state or motion interpretation.
 */
export const SOAP_BODY_VFX_AUDIT: SoapBodyVfxAuditSnapshot = {
  version: 1,
  world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
  target: {
    code: 'SOAP',
    material: Material.Soap,
    body,
    crown: { x: 238, y: 56, width: 18, height: 16 },
    pocket: { x: 208, y: 56, width: 18, height: 16 },
    core: { x: 48, y: 112, width: 48, height: 32 },
    depth: {
      surfaceLayer: { x: 36, y: body.y, width: 64, height: 1 },
      firstInnerLayer: { x: 36, y: body.y + 1, width: 64, height: 1 },
      shallowBand: { x: 36, y: body.y + 2, width: 64, height: 4 },
      transitionBand: { x: 36, y: body.y + 6, width: 64, height: 6 },
      midBand: { x: 36, y: body.y + 12, width: 64, height: 10 },
      deepBand: { x: 36, y: body.y + 32, width: 64, height: 28 },
    },
    authoredHole: { x: 136, y: 104, width: 18, height: 16 },
    openChannel: { x: 176, y: body.y, width: 14, height: 72 },
    reconstructablePinhole: { x: 210, y: 136 },
    wallCoexistence,
  },
  sparse: {
    thinStrand: { x: 392, y: 24, width: 1, height: 96 },
    droplet: { x: 408, y: 48, width: 4, height: 4 },
    isolated: { x: 432, y: 80 },
    bubbleFilm: {
      region: bubbleFilmRegion,
      ringPoints: buildThinRing(ringCentre, 18),
      chainPoints: buildThinChain(520, 576, 116, chainGap),
      ringCentre,
      chainGap,
    },
  },
  siblingLiquids: {
    water: { x: 16, y: 208, width: 64, height: 48, material: Material.Water },
    oil: { x: 88, y: 208, width: 64, height: 48, material: Material.Oil },
    acid: { x: 160, y: 208, width: 64, height: 48, material: Material.Acid },
    lava: { x: 232, y: 208, width: 64, height: 48, material: Material.Lava },
    diesel: { x: 304, y: 208, width: 64, height: 48, material: Material.Diesel },
    nitro: { x: 376, y: 208, width: 64, height: 48, material: Material.Nitro },
    gel: { x: 448, y: 208, width: 64, height: 48, material: Material.GEL },
    moltenWax: { x: 520, y: 208, width: 64, height: 48, material: Material.MWAX },
  },
  seams: {
    soapWater: boundary('SOAP_WATR', 16, Material.Water),
    soapOil: boundary('SOAP_OIL', 88, Material.Oil),
    soapAcid: boundary('SOAP_ACID', 160, Material.Acid),
    soapGel: boundary('SOAP_GEL', 232, Material.GEL),
  },
  contacts: {
    soapGlass: boundary('SOAP_GLAS', 304, Material.Glass),
    soapMetal: boundary('SOAP_METL', 376, Material.Metal),
    soapSand: boundary('SOAP_SAND', 448, Material.Sand),
    soapSmoke: boundary('SOAP_SMKE', 520, Material.Smoke),
  },
  stateContract: 'state-agnostic',
  guardedBlank: { x: 16, y: 336, width: 568, height: 40 },
  conductiveWall: CONDUCTIVE_WALL,
};

interface SoapBodyVfxFixtureBackend extends SimulationBackend {
  paintWall(x: number, y: number, wall: number, radius: number): void;
  walls(): Uint8Array;
}

/** Direct-fills the canonical paused RenderLab world without stepping physics. */
export function prepareSoapBodyVfxAuditFixture(simulation: SimulationBackend): void {
  if (!supportsFixture(simulation)) {
    throw new Error('Soap body VFX fixture requires a RenderLab native wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Soap body VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }

  simulation.clear();
  const cells = simulation.cells();
  const fixture = SOAP_BODY_VFX_AUDIT;

  fillRect(cells, simulation.width, fixture.target.body, fixture.target.material);
  fillRect(cells, simulation.width, fixture.target.authoredHole, Material.Empty);
  fillRect(cells, simulation.width, fixture.target.openChannel, Material.Empty);
  setPoint(cells, simulation.width, fixture.target.reconstructablePinhole, Material.Empty);
  paintWallPattern(simulation, fixture.target.wallCoexistence);

  fillRect(cells, simulation.width, fixture.sparse.thinStrand, fixture.target.material);
  fillRect(cells, simulation.width, fixture.sparse.droplet, fixture.target.material);
  setPoint(cells, simulation.width, fixture.sparse.isolated, fixture.target.material);
  for (const point of [
    ...fixture.sparse.bubbleFilm.ringPoints,
    ...fixture.sparse.bubbleFilm.chainPoints,
  ]) {
    setPoint(cells, simulation.width, point, fixture.target.material);
  }

  for (const entry of Object.values(fixture.siblingLiquids)) {
    fillRect(cells, simulation.width, entry, entry.material);
  }
  for (const entry of [...Object.values(fixture.seams), ...Object.values(fixture.contacts)]) {
    fillRect(cells, simulation.width, entry.soap, fixture.target.material);
    fillRect(cells, simulation.width, entry.other, entry.otherMaterial);
  }
  fillRect(cells, simulation.width, fixture.guardedBlank, Material.Empty);
}

function supportsFixture(simulation: SimulationBackend): simulation is SoapBodyVfxFixtureBackend {
  const candidate = simulation as Partial<SoapBodyVfxFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function buildThinRing(
  centre: SoapBodyVfxPoint,
  radius: number,
): readonly SoapBodyVfxPoint[] {
  const points = new Map<string, SoapBodyVfxPoint>();
  const add = (x: number, y: number): void => { points.set(`${x},${y}`, { x, y }); };
  const radiusSquared = radius * radius;
  for (let offsetX = -radius; offsetX <= radius; offsetX++) {
    const offsetY = Math.round(Math.sqrt(radiusSquared - offsetX * offsetX));
    add(centre.x + offsetX, centre.y - offsetY);
    add(centre.x + offsetX, centre.y + offsetY);
  }
  for (let offsetY = -radius; offsetY <= radius; offsetY++) {
    const offsetX = Math.round(Math.sqrt(radiusSquared - offsetY * offsetY));
    add(centre.x - offsetX, centre.y + offsetY);
    add(centre.x + offsetX, centre.y + offsetY);
  }
  return [...points.values()].sort((left, right) => left.y - right.y || left.x - right.x);
}

function buildThinChain(
  left: number,
  right: number,
  y: number,
  gap: SoapBodyVfxPoint,
): readonly SoapBodyVfxPoint[] {
  const points: SoapBodyVfxPoint[] = [];
  for (let x = left; x <= right; x++) {
    const point = { x, y: y + (Math.floor((x - left) / 10) & 1) };
    if (point.x !== gap.x || point.y !== gap.y) points.push(point);
  }
  return points;
}

function paintWallPattern(
  simulation: SoapBodyVfxFixtureBackend,
  pattern: SoapBodyVfxWallPattern,
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
  rect: SoapBodyVfxRect,
  material: Material,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function setPoint(
  cells: Uint8Array,
  width: number,
  point: SoapBodyVfxPoint,
  material: Material,
): void {
  cells[point.y * width + point.x] = material;
}
