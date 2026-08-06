import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import {
  encodeVibrPresentationState,
  VIBR_STATE_GRAPHICS_STATES,
  type VibrStateGraphicsKey,
} from './vibr-state-graphics-audit';

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CONDUCTIVE_WALL = 1;

export interface RadioactiveSolidBodyVfxPoint { readonly x: number; readonly y: number }
export interface RadioactiveSolidBodyVfxRect extends RadioactiveSolidBodyVfxPoint {
  readonly width: number;
  readonly height: number;
}

export type RadioactiveSolidBodyVfxCode = 'ISZS' | 'VIBR';
export type RadioactiveSolidBodyVfxMaterial = Material.ISZS | Material.VIBR;

/**
 * Broad, paused, exact-owner body. The named crown and pocket are interior
 * calibration regions rather than silhouette reconstruction candidates.
 */
export interface RadioactiveSolidBodyVfxTarget {
  readonly code: RadioactiveSolidBodyVfxCode;
  readonly material: RadioactiveSolidBodyVfxMaterial;
  readonly card: RadioactiveSolidBodyVfxRect;
  readonly body: RadioactiveSolidBodyVfxRect;
  readonly core: RadioactiveSolidBodyVfxRect;
  readonly crown: RadioactiveSolidBodyVfxRect;
  readonly pocket: RadioactiveSolidBodyVfxRect;
  readonly authoredHole: RadioactiveSolidBodyVfxRect;
  /** Empty channel deliberately reaching the outer body boundary. */
  readonly openNotch: RadioactiveSolidBodyVfxRect;
  readonly thinLine: RadioactiveSolidBodyVfxRect;
  readonly isolated: RadioactiveSolidBodyVfxPoint;
  /** Exact matter and native bmap ownership coexist inside this rectangle. */
  readonly wallCoexistence: RadioactiveSolidBodyVfxRect;
  readonly guardedBlank: RadioactiveSolidBodyVfxRect;
}

export interface RadioactiveSolidBodyVfxStateCard {
  readonly material: Material.VIBR | Material.BVBR;
  readonly code: 'VIBR' | 'BVBR';
  readonly stateKey: VibrStateGraphicsKey;
  readonly charge: number;
  readonly life: number;
  readonly alternate: boolean;
  readonly encodedState: number;
  readonly card: RadioactiveSolidBodyVfxRect;
  readonly body: RadioactiveSolidBodyVfxRect;
  readonly probe: RadioactiveSolidBodyVfxPoint;
}

export interface RadioactiveSolidBodyVfxAuditSnapshot {
  readonly version: 1;
  readonly world: { readonly width: 612; readonly height: 384 };
  readonly targets: readonly RadioactiveSolidBodyVfxTarget[];
  /** Same-family boundaries must not become a shared radioactive owner. */
  readonly iszsVibrSeam: {
    readonly iszs: RadioactiveSolidBodyVfxRect & { readonly material: Material.ISZS };
    readonly vibr: RadioactiveSolidBodyVfxRect & { readonly material: Material.VIBR };
    readonly iszsProbe: RadioactiveSolidBodyVfxPoint;
    readonly vibrProbe: RadioactiveSolidBodyVfxPoint;
  };
  /** Target/foreign contact pairs keep all boundaries available to the gate. */
  readonly contacts: readonly {
    readonly name: 'ISZSMetal' | 'VIBRWater' | 'ISZSSand' | 'VIBRSmoke';
    readonly target: RadioactiveSolidBodyVfxRect;
    readonly foreign: RadioactiveSolidBodyVfxRect;
    readonly targetMaterial: Material.ISZS | Material.VIBR;
    readonly foreignMaterial: Material.Metal | Material.Water | Material.Sand | Material.Smoke;
    readonly targetProbe: RadioactiveSolidBodyVfxPoint;
    readonly foreignProbe: RadioactiveSolidBodyVfxPoint;
  }[];
  /** Radioactive phase/material siblings that must remain foreign owners. */
  readonly protectedControls: readonly {
    readonly code: 'BVBR' | 'URAN' | 'PLUT' | 'POLO' | 'ISOZ' | 'EXOT';
    readonly material: Material.BVBR | Material.URAN | Material.PLUT | Material.POLO
      | Material.ISOZ | Material.EXOT;
    readonly region: RadioactiveSolidBodyVfxRect;
    readonly probe: RadioactiveSolidBodyVfxPoint;
  }[];
  /** Existing VIBR/BVBR state grammar is independently exercised here. */
  readonly stateCards: readonly RadioactiveSolidBodyVfxStateCard[];
  readonly vibrStateCards: readonly RadioactiveSolidBodyVfxStateCard[];
  readonly bvbrStateCards: readonly RadioactiveSolidBodyVfxStateCard[];
  readonly conductiveWall: number;
}

function target(
  code: RadioactiveSolidBodyVfxCode, material: RadioactiveSolidBodyVfxMaterial, baseX: number,
): RadioactiveSolidBodyVfxTarget {
  const body = { x: baseX + 12, y: 20, width: 224, height: 142 };
  // These broad regions freeze opposing lobes of E43's static, isotropic
  // volume carrier. They stay well inside the exact body and remain disjoint
  // from the authored cavity, notch, and native-wall control.
  const crown = code === 'ISZS'
    ? { x: body.x + 32, y: body.y + 98, width: 20, height: 20 }
    : { x: body.x + 27, y: body.y + 82, width: 20, height: 20 };
  const pocket = code === 'ISZS'
    ? { x: body.x + 62, y: body.y + 70, width: 20, height: 20 }
    : { x: body.x + 57, y: body.y + 70, width: 16, height: 16 };
  return {
    code,
    material,
    card: { x: baseX, y: 8, width: 280, height: 180 },
    body,
    core: { x: body.x + 58, y: body.y + 92, width: 28, height: 24 },
    crown,
    pocket,
    authoredHole: { x: body.x + 104, y: body.y + 62, width: 14, height: 14 },
    openNotch: { x: body.x + body.width - 20, y: body.y + 44, width: 20, height: 28 },
    thinLine: { x: baseX + 260, y: 28, width: 1, height: 86 },
    isolated: { x: baseX + 268, y: 128 },
    // RenderLab bmap blocks are four cells wide, so these anchors are aligned.
    // Keep the wall control disjoint from the pocket calibration region while
    // retaining exact native 4x4 bmap alignment inside the broad body.
    wallCoexistence: { x: baseX + 208, y: 100, width: 28, height: 28 },
    guardedBlank: { x: baseX + 20, y: 168, width: 180, height: 12 },
  };
}

const stateCards = ([Material.VIBR, Material.BVBR] as const).flatMap((material, row) => (
  VIBR_STATE_GRAPHICS_STATES.map((state, column) => {
    const card = { x: 8 + column * 120, y: 292 + row * 42, width: 110, height: 38 };
    const body = { x: card.x + 4, y: card.y + 5, width: 52, height: 28 };
    return {
      material,
      code: material === Material.VIBR ? 'VIBR' : 'BVBR',
      stateKey: state.key,
      charge: state.charge,
      life: state.life,
      alternate: state.alternate,
      encodedState: encodeVibrPresentationState(state.charge, state.life, state.alternate),
      card,
      body,
      probe: { x: body.x + 26, y: body.y + 14 },
    } satisfies RadioactiveSolidBodyVfxStateCard;
  })
));

/**
 * Deterministic E43 paused-world contract. The broad ISZS/VIBR cards isolate
 * body optics from semantic topology; VIBR's native state grammar remains a
 * later renderer layer and is represented by matched VIBR/BVBR control cards.
 */
export const RADIOACTIVE_SOLID_BODY_VFX_AUDIT: RadioactiveSolidBodyVfxAuditSnapshot = {
  version: 1,
  world: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
  targets: [
    target('ISZS', Material.ISZS, 16),
    target('VIBR', Material.VIBR, 316),
  ],
  iszsVibrSeam: {
    iszs: { x: 20, y: 200, width: 50, height: 34, material: Material.ISZS },
    vibr: { x: 70, y: 200, width: 50, height: 34, material: Material.VIBR },
    iszsProbe: { x: 69, y: 217 },
    vibrProbe: { x: 70, y: 217 },
  },
  contacts: [
    contact('ISZSMetal', 146, Material.ISZS, Material.Metal),
    contact('VIBRWater', 246, Material.VIBR, Material.Water),
    contact('ISZSSand', 346, Material.ISZS, Material.Sand),
    contact('VIBRSmoke', 446, Material.VIBR, Material.Smoke),
  ],
  protectedControls: [
    control('BVBR', Material.BVBR, 20),
    control('URAN', Material.URAN, 118),
    control('PLUT', Material.PLUT, 216),
    control('POLO', Material.POLO, 314),
    control('ISOZ', Material.ISOZ, 412),
    control('EXOT', Material.EXOT, 510),
  ],
  stateCards,
  vibrStateCards: stateCards.filter(({ material }) => material === Material.VIBR),
  bvbrStateCards: stateCards.filter(({ material }) => material === Material.BVBR),
  conductiveWall: CONDUCTIVE_WALL,
};

function contact(
  name: RadioactiveSolidBodyVfxAuditSnapshot['contacts'][number]['name'],
  x: number,
  targetMaterial: Material.ISZS | Material.VIBR,
  foreignMaterial: Material.Metal | Material.Water | Material.Sand | Material.Smoke,
): RadioactiveSolidBodyVfxAuditSnapshot['contacts'][number] {
  const target = { x, y: 200, width: 40, height: 34 };
  const foreign = { x: x + target.width, y: target.y, width: 30, height: target.height };
  return {
    name, target, foreign, targetMaterial, foreignMaterial,
    targetProbe: { x: target.x + target.width - 1, y: target.y + 17 },
    foreignProbe: { x: foreign.x, y: foreign.y + 17 },
  };
}

function control(
  code: RadioactiveSolidBodyVfxAuditSnapshot['protectedControls'][number]['code'],
  material: RadioactiveSolidBodyVfxAuditSnapshot['protectedControls'][number]['material'], x: number,
): RadioactiveSolidBodyVfxAuditSnapshot['protectedControls'][number] {
  const region = { x, y: 250, width: 72, height: 26 };
  return { code, material, region, probe: { x: region.x + 36, y: region.y + 13 } };
}

interface RadioactiveSolidBodyVfxFixtureBackend extends SimulationBackend {
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
  presentationState(): Uint16Array;
  setFixturePresentationStateRect(
    x: number, y: number, width: number, height: number, state: number,
  ): void;
}

/** Direct-fills E43's full paused semantic, wall, and native-state world. */
export function prepareRadioactiveSolidBodyVfxFixture(simulation: SimulationBackend): void {
  if (!supportsFixture(simulation)) {
    throw new Error('Radioactive-solid body VFX fixture requires RenderLab wall and state planes');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`Radioactive-solid body VFX fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  const fixture = RADIOACTIVE_SOLID_BODY_VFX_AUDIT;
  for (const entry of fixture.targets) {
    fillStateRect(simulation, cells, entry.body, entry.material, 0);
    fillStateRect(simulation, cells, entry.authoredHole, Material.Empty, 0);
    fillStateRect(simulation, cells, entry.openNotch, Material.Empty, 0);
    fillStateRect(simulation, cells, entry.thinLine, entry.material, 0);
    setPoint(cells, simulation.width, entry.isolated, entry.material);
    simulation.setFixturePresentationStateRect(entry.isolated.x, entry.isolated.y, 1, 1, 0);
    fillStateRect(simulation, cells, entry.wallCoexistence, entry.material, 0);
    for (let y = entry.wallCoexistence.y; y < entry.wallCoexistence.y + entry.wallCoexistence.height; y += 4) {
      for (let x = entry.wallCoexistence.x; x < entry.wallCoexistence.x + entry.wallCoexistence.width; x += 4) {
        simulation.paintWall(x, y, fixture.conductiveWall, 0);
      }
    }
    fillStateRect(simulation, cells, entry.guardedBlank, Material.Empty, 0);
  }
  fillStateRect(simulation, cells, fixture.iszsVibrSeam.iszs, Material.ISZS, 0);
  fillStateRect(simulation, cells, fixture.iszsVibrSeam.vibr, Material.VIBR, 0);
  for (const entry of fixture.contacts) {
    fillStateRect(simulation, cells, entry.target, entry.targetMaterial, 0);
    fillStateRect(simulation, cells, entry.foreign, entry.foreignMaterial, 0);
  }
  for (const entry of fixture.protectedControls) fillStateRect(simulation, cells, entry.region, entry.material, 0);
  for (const entry of fixture.stateCards) {
    fillStateRect(simulation, cells, entry.body, entry.material, entry.encodedState);
  }
}

function supportsFixture(
  simulation: SimulationBackend,
): simulation is RadioactiveSolidBodyVfxFixtureBackend {
  const candidate = simulation as Partial<RadioactiveSolidBodyVfxFixtureBackend>;
  return typeof candidate.walls === 'function'
    && typeof candidate.paintWall === 'function'
    && typeof candidate.presentationState === 'function'
    && typeof candidate.setFixturePresentationStateRect === 'function';
}

function fillStateRect(
  simulation: RadioactiveSolidBodyVfxFixtureBackend,
  cells: Uint8Array,
  rect: RadioactiveSolidBodyVfxRect,
  material: Material,
  state: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * simulation.width + rect.x, y * simulation.width + rect.x + rect.width);
  }
  simulation.setFixturePresentationStateRect(rect.x, rect.y, rect.width, rect.height, state);
}

function setPoint(
  cells: Uint8Array, width: number, point: RadioactiveSolidBodyVfxPoint, material: Material,
): void {
  cells[point.y * width + point.x] = material;
}
