import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import { PHOTON_STATE_PRESENT } from '../renderer/photon-spectrum-state';
import {
  PHOTON_SPECTRUM_GRAPHICS_ATLAS,
  PHOTON_SPECTRUM_GRAPHICS_ATLAS_COLUMNS,
  PHOTON_SPECTRUM_GRAPHICS_ATLAS_ROWS,
  PHOTON_SPECTRUM_GRAPHICS_AUDIT,
  PHOTON_SPECTRUM_GRAPHICS_STATES,
  preparePhotonSpectrumGraphicsAuditFixture,
  setPhotonSpectrumGraphicsVisible,
  type PhotonSpectrumGraphicsPoint,
  type PhotonSpectrumGraphicsRect,
} from './photon-spectrum-graphics-audit';

describe('independent PHOT spectrum graphics audit', () => {
  it('encodes distinct native RGB-band spectra with the exact independent presence bit', () => {
    expect(PHOTON_SPECTRUM_GRAPHICS_STATES.map(({ key }) => key))
      .toEqual(['red', 'green', 'blue', 'violet']);
    expect(PHOTON_SPECTRUM_GRAPHICS_ATLAS).toHaveLength(
      PHOTON_SPECTRUM_GRAPHICS_ATLAS_COLUMNS * PHOTON_SPECTRUM_GRAPHICS_ATLAS_ROWS,
    );
    expect(PHOTON_SPECTRUM_GRAPHICS_ATLAS.map(({ encodedState }) => encodedState))
      .toEqual([0x800C, 0x80C0, 0x8C00, 0x8C29]);
    expect(PHOTON_SPECTRUM_GRAPHICS_ATLAS.every(({ encodedState }) => (
      encodedState & PHOTON_STATE_PRESENT) === PHOTON_STATE_PRESENT,
    )).toBe(true);
  });

  it('builds independent photon state over exact matter, wall, and empty controls', () => {
    const simulation = new RenderLabBackend();
    preparePhotonSpectrumGraphicsAuditFixture(simulation);
    for (const entry of PHOTON_SPECTRUM_GRAPHICS_ATLAS) {
      expectRect(simulation, entry.body, Material.Metal, entry.encodedState,
        [entry.authoredHole, entry.openNotch]);
      expectRect(simulation, entry.thinStructure, Material.Metal, entry.encodedState);
      expectPoint(simulation, entry.isolated, Material.Metal, entry.encodedState);
      expectRect(simulation, entry.absentState, Material.Metal, 0);
      expectRect(simulation, entry.waterCoexistence, Material.Water, entry.encodedState);
      expectRect(simulation, entry.glassCoexistence, Material.Glass, entry.encodedState);
      expectRect(simulation, entry.wallCoexistence, Material.Glass, entry.encodedState);
      expectRect(simulation, entry.guardedBlank, Material.Empty, 0);
      for (let y = entry.wallCoexistence.y; y < entry.wallCoexistence.y + entry.wallCoexistence.height; y++) {
        for (let x = entry.wallCoexistence.x; x < entry.wallCoexistence.x + entry.wallCoexistence.width; x++) {
          expect(simulation.walls()[y * simulation.width + x]).toBe(1);
        }
      }
    }
    expect(PHOTON_SPECTRUM_GRAPHICS_AUDIT.authoredHoles).toHaveLength(4 * 36);
    expect(PHOTON_SPECTRUM_GRAPHICS_AUDIT.openNotches).toHaveLength(4 * 64);
    expect(PHOTON_SPECTRUM_GRAPHICS_AUDIT.wallCoexistence).toHaveLength(4);
  });

  it('toggles only the independent photon plane while preserving matter and walls', () => {
    const simulation = new RenderLabBackend();
    preparePhotonSpectrumGraphicsAuditFixture(simulation);
    const cells = new Uint8Array(simulation.cells());
    const walls = new Uint8Array(simulation.walls());

    setPhotonSpectrumGraphicsVisible(simulation, false);
    expect(simulation.photonState().every((state) => state === 0)).toBe(true);
    expect(simulation.cells()).toEqual(cells);
    expect(simulation.walls()).toEqual(walls);

    setPhotonSpectrumGraphicsVisible(simulation, true);
    for (const entry of PHOTON_SPECTRUM_GRAPHICS_ATLAS) {
      expectRect(simulation, entry.body, Material.Metal, entry.encodedState,
        [entry.authoredHole, entry.openNotch]);
      expectRect(simulation, entry.waterCoexistence, Material.Water, entry.encodedState);
      expectRect(simulation, entry.glassCoexistence, Material.Glass, entry.encodedState);
      expectRect(simulation, entry.wallCoexistence, Material.Glass, entry.encodedState);
    }
    expect(simulation.cells()).toEqual(cells);
    expect(simulation.walls()).toEqual(walls);
  }, 15_000);

  it('is deterministic and rejects state-less fixtures', () => {
    const first = new RenderLabBackend();
    const second = new RenderLabBackend();
    preparePhotonSpectrumGraphicsAuditFixture(first);
    preparePhotonSpectrumGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());
    expect(first.walls()).toEqual(second.walls());
    expect(first.photonState()).toEqual(second.photonState());
    expect(() => preparePhotonSpectrumGraphicsAuditFixture(new RenderLabBackend(32, 32)))
      .toThrow(/612x384/);
    expect(() => preparePhotonSpectrumGraphicsAuditFixture(new DeterministicBackend(612, 384)))
      .toThrow(/photon plane/);
  });
});

function expectRect(
  simulation: RenderLabBackend,
  rect: PhotonSpectrumGraphicsRect,
  material: Material,
  state: number,
  empty: readonly PhotonSpectrumGraphicsRect[] = [],
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const point = { x, y };
      const isEmpty = empty.some((candidate) => pointInside(point, candidate));
      expectPoint(simulation, point, isEmpty ? Material.Empty : material, isEmpty ? 0 : state);
    }
  }
}

function expectPoint(
  simulation: RenderLabBackend,
  point: PhotonSpectrumGraphicsPoint,
  material: Material,
  state: number,
): void {
  const index = point.y * simulation.width + point.x;
  expect(simulation.cells()[index]).toBe(material);
  expect(simulation.photonState()[index]).toBe(state);
  expect(simulation.presentationState()[index]).toBe(0);
}

function pointInside(point: PhotonSpectrumGraphicsPoint, rect: PhotonSpectrumGraphicsRect): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}
