import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;

export interface SolidBodyVfxPoint { readonly x: number; readonly y: number }
export interface SolidBodyVfxRect extends SolidBodyVfxPoint {
  readonly width: number;
  readonly height: number;
}

/**
 * Exact opaque native-Solid owner with enough same-material support for an
 * interior-only body-depth study. The authored voids and fine owners remain
 * semantic controls; they are not reconstruction candidates.
 */
export interface SolidBodyVfxTarget {
  readonly code: 'ROCK' | 'METL';
  readonly material: Material.ROCK | Material.Metal;
  readonly card: SolidBodyVfxRect;
  readonly body: SolidBodyVfxRect;
  readonly core: SolidBodyVfxRect;
  /** Interior, near an exposed face but never on the silhouette itself. */
  readonly surface: SolidBodyVfxRect;
  readonly authoredHole: SolidBodyVfxRect;
  /** Empty channel deliberately reaching the body's right silhouette. */
  readonly openNotch: SolidBodyVfxRect;
  readonly thinLine: SolidBodyVfxRect;
  readonly isolated: SolidBodyVfxPoint;
  /** Exact matter and bmap data coexist here; neither owns the other. */
  readonly wallCoexistence: SolidBodyVfxRect;
  readonly guardedBlank: SolidBodyVfxRect;
}

export interface SolidBodyVfxAuditSnapshot {
  readonly targets: readonly SolidBodyVfxTarget[];
  /** Non-target phase/optics families must be exact no-ops for E17. */
  readonly protectedControls: {
    readonly powder: SolidBodyVfxRect & { readonly material: Material.Sand };
    readonly liquid: SolidBodyVfxRect & { readonly material: Material.Water };
    readonly translucent: SolidBodyVfxRect & { readonly material: Material.Glass };
  };
  /** A target Metal owner directly abuts a different ordinary solid owner. */
  readonly unlikeSolidSeam: {
    readonly target: SolidBodyVfxRect & { readonly material: Material.Metal };
    readonly foreign: SolidBodyVfxRect & { readonly material: Material.Brick };
    readonly targetProbe: SolidBodyVfxPoint;
    readonly foreignProbe: SolidBodyVfxPoint;
  };
  readonly conductiveWall: number;
}

function target(
  code: SolidBodyVfxTarget['code'], material: SolidBodyVfxTarget['material'], baseX: number,
): SolidBodyVfxTarget {
  const body = { x: baseX + 12, y: 20, width: 224, height: 142 };
  return {
    code,
    material,
    card: { x: baseX, y: 8, width: 280, height: 264 },
    body,
    core: { x: body.x + 58, y: body.y + 94, width: 26, height: 24 },
    // Start beyond the exact first-inner-layer no-op band while remaining close
    // enough to the exposed top face to measure E17's restrained bevel.
    surface: { x: body.x + 34, y: body.y + 20, width: 30, height: 18 },
    authoredHole: { x: body.x + 104, y: body.y + 64, width: 14, height: 14 },
    openNotch: { x: body.x + body.width - 20, y: body.y + 44, width: 20, height: 28 },
    thinLine: { x: baseX + 260, y: 28, width: 1, height: 86 },
    isolated: { x: baseX + 268, y: 128 },
    // Both anchors are aligned to RenderLab's 4x4 bmap proxy blocks.
    wallCoexistence: { x: baseX + 164, y: 180, width: 28, height: 28 },
    guardedBlank: { x: baseX + 20, y: 228, width: 180, height: 30 },
  };
}

/**
 * Paused exact-owner fixture for E17 normal-WebGL opaque-solid body optics.
 * It owns no presentation control: later browser gates provide off -> on ->
 * off capture while this fixture holds semantic matter and native-wall state.
 */
export const SOLID_BODY_VFX_AUDIT: SolidBodyVfxAuditSnapshot = {
  targets: [
    target('ROCK', Material.ROCK, 16),
    target('METL', Material.Metal, 316),
  ],
  protectedControls: {
    powder: { x: 20, y: 292, width: 80, height: 56, material: Material.Sand },
    // An isolated semantic Water droplet proves phase exclusion without
    // introducing an unrelated time-varying connected-liquid body at 4x.
    liquid: { x: 159, y: 319, width: 1, height: 1, material: Material.Water },
    translucent: { x: 220, y: 292, width: 80, height: 56, material: Material.Glass },
  },
  unlikeSolidSeam: {
    target: { x: 340, y: 292, width: 56, height: 56, material: Material.Metal },
    foreign: { x: 396, y: 292, width: 56, height: 56, material: Material.Brick },
    targetProbe: { x: 395, y: 320 },
    foreignProbe: { x: 396, y: 320 },
  },
  conductiveWall: CONDUCTIVE_WALL,
};

interface SolidBodyVfxFixtureBackend extends SimulationBackend {
  paintWall(x: number, y: number, wall: number, radius: number): void;
  walls(): Uint8Array;
}

/** Direct-fill a paused world so an E17 presentation pass cannot affect physics. */
export function prepareSolidBodyVfxFixture(simulation: SimulationBackend): void {
  if (!supportsFixture(simulation)) {
    throw new Error('Solid-body VFX fixture requires the RenderLab wall plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Solid-body VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of SOLID_BODY_VFX_AUDIT.targets) {
    fillRect(cells, simulation.width, entry.body, entry.material);
    fillRect(cells, simulation.width, entry.authoredHole, Material.Empty);
    fillRect(cells, simulation.width, entry.openNotch, Material.Empty);
    fillRect(cells, simulation.width, entry.thinLine, entry.material);
    setPoint(cells, simulation.width, entry.isolated, entry.material);
    fillRect(cells, simulation.width, entry.wallCoexistence, entry.material);
    for (let y = entry.wallCoexistence.y; y < entry.wallCoexistence.y + entry.wallCoexistence.height; y += 4) {
      for (let x = entry.wallCoexistence.x; x < entry.wallCoexistence.x + entry.wallCoexistence.width; x += 4) {
        simulation.paintWall(x, y, CONDUCTIVE_WALL, 0);
      }
    }
    fillRect(cells, simulation.width, entry.guardedBlank, Material.Empty);
  }
  const { protectedControls, unlikeSolidSeam } = SOLID_BODY_VFX_AUDIT;
  fillRect(cells, simulation.width, protectedControls.powder, protectedControls.powder.material);
  fillRect(cells, simulation.width, protectedControls.liquid, protectedControls.liquid.material);
  fillRect(cells, simulation.width, protectedControls.translucent, protectedControls.translucent.material);
  fillRect(cells, simulation.width, unlikeSolidSeam.target, unlikeSolidSeam.target.material);
  fillRect(cells, simulation.width, unlikeSolidSeam.foreign, unlikeSolidSeam.foreign.material);
}

function supportsFixture(simulation: SimulationBackend): simulation is SolidBodyVfxFixtureBackend {
  const candidate = simulation as Partial<SolidBodyVfxFixtureBackend>;
  return typeof candidate.walls === 'function' && typeof candidate.paintWall === 'function';
}

function fillRect(cells: Uint8Array, width: number, rect: SolidBodyVfxRect, material: Material): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * width + rect.x, y * width + rect.x + rect.width);
  }
}

function setPoint(cells: Uint8Array, width: number, point: SolidBodyVfxPoint, material: Material): void {
  cells[point.y * width + point.x] = material;
}
