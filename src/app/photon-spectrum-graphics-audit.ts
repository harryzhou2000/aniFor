import { encodePhotonSpectrumState } from '../renderer/photon-spectrum-state';
import { Material } from '../shared/materials';
import type { SimulationBackend } from '../simulation';

export const PHOTON_SPECTRUM_GRAPHICS_ATLAS_COLUMNS = 4;
export const PHOTON_SPECTRUM_GRAPHICS_ATLAS_ROWS = 1;

const WORLD_WIDTH = 612;
const WORLD_HEIGHT = 384;
const CARD_ORIGIN_X = 4;
const CARD_ORIGIN_Y = 8;
const CARD_STRIDE_X = 152;
const CARD_WIDTH = 148;
const CARD_HEIGHT = 368;

export type PhotonSpectrumGraphicsKey = 'red' | 'green' | 'blue' | 'violet';
export interface PhotonSpectrumGraphicsPoint { readonly x: number; readonly y: number }
export interface PhotonSpectrumGraphicsRect extends PhotonSpectrumGraphicsPoint {
  readonly width: number;
  readonly height: number;
}

export const PHOTON_SPECTRUM_GRAPHICS_STATES = [
  { key: 'red', spectrum: [12, 0, 0] },
  { key: 'green', spectrum: [0, 12, 0] },
  { key: 'blue', spectrum: [0, 0, 12] },
  { key: 'violet', spectrum: [9, 2, 12] },
] as const satisfies readonly {
  readonly key: PhotonSpectrumGraphicsKey;
  readonly spectrum: readonly [number, number, number];
}[];

export interface PhotonSpectrumGraphicsAtlasEntry {
  readonly key: PhotonSpectrumGraphicsKey;
  readonly spectrum: readonly [number, number, number];
  readonly encodedState: number;
  readonly index: number;
  readonly card: PhotonSpectrumGraphicsRect;
  /** Independent PHOT over exact opaque matter. */
  readonly body: PhotonSpectrumGraphicsRect;
  readonly authoredHole: PhotonSpectrumGraphicsRect;
  readonly openNotch: PhotonSpectrumGraphicsRect;
  readonly thinStructure: PhotonSpectrumGraphicsRect;
  readonly isolated: PhotonSpectrumGraphicsPoint;
  /** Exact opaque matter with no independent PHOT word. */
  readonly absentState: PhotonSpectrumGraphicsRect;
  /** Independent PHOT co-located with an aqueous semantic owner. */
  readonly waterCoexistence: PhotonSpectrumGraphicsRect;
  /** Independent PHOT co-located with a translucent semantic owner. */
  readonly glassCoexistence: PhotonSpectrumGraphicsRect;
  /** Independent PHOT co-located with translucent matter and a native wall. */
  readonly wallCoexistence: PhotonSpectrumGraphicsRect;
  /** An empty cell must not gain presentation support from an absent PHOT word. */
  readonly guardedBlank: PhotonSpectrumGraphicsRect;
}

export interface PhotonSpectrumGraphicsAuditSnapshot {
  readonly cards: readonly PhotonSpectrumGraphicsAtlasEntry[];
  readonly authoredHoles: readonly PhotonSpectrumGraphicsPoint[];
  readonly openNotches: readonly PhotonSpectrumGraphicsPoint[];
  readonly thinStructures: readonly PhotonSpectrumGraphicsPoint[];
  readonly isolated: readonly PhotonSpectrumGraphicsPoint[];
  readonly absentStates: readonly PhotonSpectrumGraphicsRect[];
  readonly waterCoexistence: readonly PhotonSpectrumGraphicsRect[];
  readonly glassCoexistence: readonly PhotonSpectrumGraphicsRect[];
  readonly wallCoexistence: readonly PhotonSpectrumGraphicsRect[];
  readonly guardedBlanks: readonly PhotonSpectrumGraphicsRect[];
}

export const PHOTON_SPECTRUM_GRAPHICS_ATLAS: readonly PhotonSpectrumGraphicsAtlasEntry[] =
  PHOTON_SPECTRUM_GRAPHICS_STATES.map((state, index) => {
    const card = {
      x: CARD_ORIGIN_X + index * CARD_STRIDE_X,
      y: CARD_ORIGIN_Y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    };
    const body = { x: card.x + 8, y: card.y + 8, width: 72, height: 64 };
    return {
      ...state,
      encodedState: encodePhotonSpectrumState(
        state.spectrum[0], state.spectrum[1], state.spectrum[2],
      ),
      index,
      card,
      body,
      authoredHole: { x: body.x + 30, y: body.y + 28, width: 6, height: 6 },
      openNotch: { x: body.x + 64, y: body.y + 42, width: 8, height: 8 },
      thinStructure: { x: card.x + 8, y: card.y + 84, width: 1, height: 30 },
      isolated: { x: card.x + 34, y: card.y + 104 },
      absentState: { x: card.x + 8, y: card.y + 126, width: 20, height: 18 },
      waterCoexistence: { x: card.x + 38, y: card.y + 126, width: 20, height: 18 },
      glassCoexistence: { x: card.x + 68, y: card.y + 126, width: 20, height: 18 },
      wallCoexistence: { x: card.x + 96, y: card.y + 124, width: 4, height: 4 },
      guardedBlank: { x: card.x + 8, y: card.y + 166, width: 104, height: 64 },
    } satisfies PhotonSpectrumGraphicsAtlasEntry;
  });

export const PHOTON_SPECTRUM_GRAPHICS_AUDIT: PhotonSpectrumGraphicsAuditSnapshot = {
  cards: PHOTON_SPECTRUM_GRAPHICS_ATLAS,
  authoredHoles: PHOTON_SPECTRUM_GRAPHICS_ATLAS.flatMap(({ authoredHole }) => rectPoints(authoredHole)),
  openNotches: PHOTON_SPECTRUM_GRAPHICS_ATLAS.flatMap(({ openNotch }) => rectPoints(openNotch)),
  thinStructures: PHOTON_SPECTRUM_GRAPHICS_ATLAS.flatMap(({ thinStructure }) => rectPoints(thinStructure)),
  isolated: PHOTON_SPECTRUM_GRAPHICS_ATLAS.map(({ isolated }) => isolated),
  absentStates: PHOTON_SPECTRUM_GRAPHICS_ATLAS.map(({ absentState }) => absentState),
  waterCoexistence: PHOTON_SPECTRUM_GRAPHICS_ATLAS.map(({ waterCoexistence }) => waterCoexistence),
  glassCoexistence: PHOTON_SPECTRUM_GRAPHICS_ATLAS.map(({ glassCoexistence }) => glassCoexistence),
  wallCoexistence: PHOTON_SPECTRUM_GRAPHICS_ATLAS.map(({ wallCoexistence }) => wallCoexistence),
  guardedBlanks: PHOTON_SPECTRUM_GRAPHICS_ATLAS.map(({ guardedBlank }) => guardedBlank),
};

interface PhotonFixtureBackend extends SimulationBackend {
  photonState(): Uint16Array;
  setFixturePhotonStateRect(
    x: number, y: number, width: number, height: number, state: number,
  ): void;
  setFixturePhotonState(x: number, y: number, state: number): void;
  walls(): Uint8Array;
  paintWall(x: number, y: number, wall: number, radius: number): void;
}

/** Builds independent PHOT spectra without using a particle or owner-state ABI. */
export function preparePhotonSpectrumGraphicsAuditFixture(simulation: SimulationBackend): void {
  if (!supportsPhotonFixture(simulation)) {
    throw new Error('PHOT spectrum graphics audit fixture requires a render-lab photon plane');
  }
  if (simulation.width !== WORLD_WIDTH || simulation.height !== WORLD_HEIGHT) {
    throw new Error(`PHOT spectrum graphics audit fixture requires ${WORLD_WIDTH}x${WORLD_HEIGHT}`);
  }
  simulation.clear();
  const cells = simulation.cells();
  for (const entry of PHOTON_SPECTRUM_GRAPHICS_ATLAS) {
    fillPhotonControl(simulation, cells, entry.body, Material.Metal, entry.encodedState);
    fillPhotonControl(simulation, cells, entry.authoredHole, Material.Empty, 0);
    fillPhotonControl(simulation, cells, entry.openNotch, Material.Empty, 0);
    fillPhotonControl(simulation, cells, entry.thinStructure, Material.Metal, entry.encodedState);
    cells[entry.isolated.y * simulation.width + entry.isolated.x] = Material.Metal;
    simulation.setFixturePhotonState(entry.isolated.x, entry.isolated.y, entry.encodedState);
    fillPhotonControl(simulation, cells, entry.absentState, Material.Metal, 0);
    fillPhotonControl(simulation, cells, entry.waterCoexistence, Material.Water, entry.encodedState);
    fillPhotonControl(simulation, cells, entry.glassCoexistence, Material.Glass, entry.encodedState);
    fillPhotonControl(simulation, cells, entry.wallCoexistence, Material.Glass, entry.encodedState);
    simulation.paintWall(entry.wallCoexistence.x + 1, entry.wallCoexistence.y + 1, 1, 0);
    fillPhotonControl(simulation, cells, entry.guardedBlank, Material.Empty, 0);
  }
}

/** Toggles only the independent PHOT plane of a prepared fixture. */
export function setPhotonSpectrumGraphicsVisible(simulation: SimulationBackend, visible: boolean): void {
  if (!supportsPhotonFixture(simulation)) {
    throw new Error('PHOT spectrum graphics toggle requires a render-lab photon plane');
  }
  for (const entry of PHOTON_SPECTRUM_GRAPHICS_ATLAS) {
    const state = visible ? entry.encodedState : 0;
    setPhotonStateRect(simulation, entry.body, state);
    setPhotonStateRect(simulation, entry.authoredHole, 0);
    setPhotonStateRect(simulation, entry.openNotch, 0);
    setPhotonStateRect(simulation, entry.thinStructure, state);
    simulation.setFixturePhotonState(entry.isolated.x, entry.isolated.y, state);
    setPhotonStateRect(simulation, entry.waterCoexistence, state);
    setPhotonStateRect(simulation, entry.glassCoexistence, state);
    setPhotonStateRect(simulation, entry.wallCoexistence, state);
  }
}

function supportsPhotonFixture(simulation: SimulationBackend): simulation is PhotonFixtureBackend {
  const candidate = simulation as Partial<PhotonFixtureBackend>;
  return typeof candidate.photonState === 'function'
    && typeof candidate.setFixturePhotonStateRect === 'function'
    && typeof candidate.setFixturePhotonState === 'function'
    && typeof candidate.walls === 'function'
    && typeof candidate.paintWall === 'function';
}

function setPhotonStateRect(
  simulation: PhotonFixtureBackend, rect: PhotonSpectrumGraphicsRect, state: number,
): void {
  simulation.setFixturePhotonStateRect(rect.x, rect.y, rect.width, rect.height, state);
}

function fillPhotonControl(
  simulation: PhotonFixtureBackend,
  cells: Uint8Array,
  rect: PhotonSpectrumGraphicsRect,
  material: Material,
  state: number,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    cells.fill(material, y * simulation.width + rect.x, y * simulation.width + rect.x + rect.width);
  }
  simulation.setFixturePhotonStateRect(rect.x, rect.y, rect.width, rect.height, state);
}

function rectPoints(rect: PhotonSpectrumGraphicsRect): PhotonSpectrumGraphicsPoint[] {
  const points: PhotonSpectrumGraphicsPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) points.push({ x, y });
  }
  return points;
}
