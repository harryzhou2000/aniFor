import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';
import {
  DEUT_STATE_GRAPHICS_AUDIT,
  prepareDeutStateGraphicsAuditFixture,
  type DeutStateGraphicsAtlasEntry,
  type DeutStateGraphicsContact,
  type DeutStateGraphicsKey,
  type DeutStateGraphicsPoint,
  type DeutStateGraphicsRect,
} from './deut-state-graphics-audit';

/**
 * E41 reuses the established paused DEUT concentration atlas verbatim.  This
 * module adds calibration metadata only: it must never create a second scene
 * whose matter, native state, wall, or topology can drift from the OPS/state
 * graphics contract.
 */
export interface DeutBodyVfxDepthBand {
  readonly code: 'surface' | 'first-inner' | 'shallow' | 'transition' | 'mid' | 'deep';
  readonly rect: DeutStateGraphicsRect;
  /** Inclusive byte range from the shared six-byte/cell vertical-depth plane. */
  readonly depthRange: readonly [minimum: number, maximum: number];
}

/** Disjoint, wall-free deep-body probes for the selector off/on/off matrix. */
export interface DeutBodyVfxTargets {
  readonly body: DeutStateGraphicsRect;
  readonly crown: DeutStateGraphicsRect;
  readonly pocket: DeutStateGraphicsRect;
  readonly core: DeutStateGraphicsRect;
}

export interface DeutBodyVfxHighRange {
  readonly stateKey: 'reactionYield' | 'maximum';
  readonly rect: DeutStateGraphicsRect;
  readonly encodedState: number;
  /** Matched deep connected-body probe inside the larger native-state block. */
  readonly target: DeutStateGraphicsRect;
}

export interface DeutBodyVfxCard {
  readonly material: Material.DEUT;
  readonly code: 'DEUT';
  readonly stateKey: DeutStateGraphicsKey;
  readonly concentration: number;
  readonly encodedState: number;
  readonly index: number;
  readonly card: DeutStateGraphicsRect;
  readonly body: DeutStateGraphicsRect;
  readonly depthBands: readonly DeutBodyVfxDepthBand[];
  readonly targets: DeutBodyVfxTargets;
  readonly authoredHole: DeutStateGraphicsRect;
  readonly openNotch: DeutStateGraphicsRect;
  readonly thinStructure: DeutStateGraphicsRect;
  readonly isolated: DeutStateGraphicsPoint;
  readonly zeroState: DeutStateGraphicsRect;
  readonly wrongOwner: DeutStateGraphicsRect;
  readonly waterControl: DeutStateGraphicsRect;
  readonly metalControl: DeutStateGraphicsRect;
  readonly exotControl: DeutStateGraphicsRect;
  readonly isozControl: DeutStateGraphicsRect;
  readonly wallCoexistence: DeutStateGraphicsRect;
  readonly liquidContact: DeutStateGraphicsContact;
  readonly solidContact: DeutStateGraphicsContact;
  readonly guardedBlank: DeutStateGraphicsRect;
  /** Original entry retained so an audit can prove this wrapper never forks it. */
  readonly source: DeutStateGraphicsAtlasEntry;
}

export interface DeutBodyVfxControls {
  readonly authoredHoles: readonly DeutStateGraphicsRect[];
  readonly openNotches: readonly DeutStateGraphicsRect[];
  readonly thinStructures: readonly DeutStateGraphicsRect[];
  readonly isolated: readonly DeutStateGraphicsPoint[];
  readonly zeroStates: readonly DeutStateGraphicsRect[];
  readonly wrongOwners: readonly DeutStateGraphicsRect[];
  readonly water: readonly DeutStateGraphicsRect[];
  readonly metal: readonly DeutStateGraphicsRect[];
  readonly exot: readonly DeutStateGraphicsRect[];
  readonly isoz: readonly DeutStateGraphicsRect[];
  readonly walls: readonly DeutStateGraphicsRect[];
  readonly liquidContacts: readonly DeutStateGraphicsContact[];
  readonly solidContacts: readonly DeutStateGraphicsContact[];
  readonly blanks: readonly DeutStateGraphicsRect[];
  readonly vibrRecovery: typeof DEUT_STATE_GRAPHICS_AUDIT.vibrRecovery;
  readonly highRange: readonly DeutBodyVfxHighRange[];
}

export interface DeutBodyVfxAuditSnapshot {
  readonly cards: readonly DeutBodyVfxCard[];
  readonly controls: DeutBodyVfxControls;
}

const calibrationBands = (entry: DeutStateGraphicsAtlasEntry): readonly DeutBodyVfxDepthBand[] => {
  // These left-hand body columns deliberately avoid the source atlas's hole,
  // open notch, state controls, and wall coexistence region.  Vertical depth
  // therefore depends only on row distance from the exact DEUT surface.
  const x = entry.body.x + 6;
  const width = 12;
  const y = entry.body.y;
  return [
    { code: 'surface', rect: { x, y, width, height: 1 }, depthRange: [0, 0] },
    { code: 'first-inner', rect: { x, y: y + 1, width, height: 1 }, depthRange: [6, 6] },
    { code: 'shallow', rect: { x, y: y + 2, width, height: 4 }, depthRange: [12, 30] },
    { code: 'transition', rect: { x, y: y + 6, width, height: 6 }, depthRange: [36, 66] },
    { code: 'mid', rect: { x, y: y + 12, width, height: 10 }, depthRange: [72, 126] },
    { code: 'deep', rect: { x, y: y + 32, width, height: 26 }, depthRange: [192, 255] },
  ];
};

const calibrationTargets = (entry: DeutStateGraphicsAtlasEntry): DeutBodyVfxTargets => {
  const x = entry.body.x;
  const y = entry.body.y;
  // All four targets lie in the deep band, remain disjoint, and avoid both
  // authored openings. Their static locations give the accepted RGB-only body
  // branch a stable body/crown/pocket/core sampling vocabulary.
  return {
    body: { x: x + 6, y: y + 33, width: 12, height: 9 },
    crown: { x: x + 20, y: y + 33, width: 10, height: 9 },
    pocket: { x: x + 32, y: y + 33, width: 8, height: 9 },
    core: { x: x + 6, y: y + 45, width: 12, height: 9 },
  };
};

const card = (source: DeutStateGraphicsAtlasEntry): DeutBodyVfxCard => ({
  material: source.material,
  code: source.code,
  stateKey: source.stateKey,
  concentration: source.concentration,
  encodedState: source.encodedState,
  index: source.index,
  card: source.card,
  body: source.body,
  depthBands: calibrationBands(source),
  targets: calibrationTargets(source),
  authoredHole: source.authoredHole,
  openNotch: source.openNotch,
  thinStructure: source.thinStructure,
  isolated: source.isolated,
  zeroState: source.zeroState,
  wrongOwner: source.wrongOwner,
  waterControl: source.waterControl,
  metalControl: source.metalControl,
  exotControl: source.exotControl,
  isozControl: source.isozControl,
  wallCoexistence: source.wallCoexistence,
  liquidContact: source.liquidContact,
  solidContact: source.solidContact,
  guardedBlank: source.guardedBlank,
  source,
});

const cards = DEUT_STATE_GRAPHICS_AUDIT.cards.map(card);
const highRange = DEUT_STATE_GRAPHICS_AUDIT.highRange.map((entry) => ({
  ...entry,
  target: {
    x: entry.rect.x + 4, y: entry.rect.y + 23, width: 16, height: 8,
  },
}));

/**
 * Metadata-only E41 wrapper.  Its fixture preparation is intentionally the
 * pre-existing DEUT state fixture, preserving particle, bmap, and state bytes
 * identically while exposing dense-body calibration regions.
 */
export const DEUT_BODY_VFX_AUDIT: DeutBodyVfxAuditSnapshot = {
  cards,
  controls: {
    authoredHoles: cards.map(({ authoredHole }) => authoredHole),
    openNotches: cards.map(({ openNotch }) => openNotch),
    thinStructures: cards.map(({ thinStructure }) => thinStructure),
    isolated: cards.map(({ isolated }) => isolated),
    zeroStates: cards.map(({ zeroState }) => zeroState),
    wrongOwners: cards.map(({ wrongOwner }) => wrongOwner),
    water: cards.map(({ waterControl }) => waterControl),
    metal: cards.map(({ metalControl }) => metalControl),
    exot: cards.map(({ exotControl }) => exotControl),
    isoz: cards.map(({ isozControl }) => isozControl),
    walls: cards.map(({ wallCoexistence }) => wallCoexistence),
    liquidContacts: cards.map(({ liquidContact }) => liquidContact),
    solidContacts: cards.map(({ solidContact }) => solidContact),
    blanks: cards.map(({ guardedBlank }) => guardedBlank),
    vibrRecovery: DEUT_STATE_GRAPHICS_AUDIT.vibrRecovery,
    highRange,
  },
};

/** Delegates without adding any scene mutation to the established DEUT atlas. */
export function prepareDeutBodyVfxAuditFixture(simulation: SimulationBackend): void {
  prepareDeutStateGraphicsAuditFixture(simulation);
}
