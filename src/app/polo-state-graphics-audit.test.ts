import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import { POLO_PRESENTATION_STATE } from '../simulation/types';
import {
  encodePoloPresentationState,
  POLO_STATE_GRAPHICS_ATLAS,
  POLO_STATE_GRAPHICS_STATES,
  preparePoloStateGraphicsAuditFixture,
  type PoloStateGraphicsRect,
} from './polo-state-graphics-audit';

describe('POLO native-state graphics audit', () => {
  it('encodes the documented bounded owner-multiplexed word', () => {
    expect(POLO_STATE_GRAPHICS_STATES).toHaveLength(5);
    expect(encodePoloPresentationState(0, 0, 0)).toBe(POLO_PRESENTATION_STATE.presentMask);
    expect(encodePoloPresentationState(8, 20, 20)).toBe(
      POLO_PRESENTATION_STATE.presentMask
      | 5
      | (15 << POLO_PRESENTATION_STATE.cooldownShift)
      | (10 << POLO_PRESENTATION_STATE.protonDoseShift),
    );
    expect(new Set(POLO_STATE_GRAPHICS_ATLAS.map(({ encodedState }) => encodedState)).size).toBe(5);
  });

  it('builds exact POLO state topology and protected product controls', () => {
    const simulation = new RenderLabBackend(612, 384);
    preparePoloStateGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    const state = simulation.presentationState();
    for (const entry of POLO_STATE_GRAPHICS_ATLAS) {
      expectRect(cells, state, simulation.width, entry.body, Material.POLO, entry.encodedState,
        [entry.authoredHole, entry.openNotch]);
      expectRect(cells, state, simulation.width, entry.thinStructure, Material.POLO, entry.encodedState);
      const isolatedIndex = entry.isolated.y * simulation.width + entry.isolated.x;
      expect(cells[isolatedIndex]).toBe(Material.POLO);
      expect(state[isolatedIndex]).toBe(entry.encodedState);
      expectRect(cells, state, simulation.width, entry.zeroState, Material.POLO, 0);
      expectRect(cells, state, simulation.width, entry.wrongOwner, Material.Sand, entry.encodedState);
      expectRect(cells, state, simulation.width, entry.plutoniumControl, Material.PLUT, entry.encodedState);
      expectRect(cells, state, simulation.width, entry.protonControl, Material.PROT, entry.encodedState);
      expectRect(cells, state, simulation.width, entry.neutronControl, Material.NEUT, entry.encodedState);
      expectRect(cells, state, simulation.width, entry.guardedBlank, Material.Empty, 0);
    }
  });

  it('is byte deterministic and rejects unsupported fixtures', () => {
    const first = new RenderLabBackend(612, 384);
    const second = new RenderLabBackend(612, 384);
    preparePoloStateGraphicsAuditFixture(first);
    preparePoloStateGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());
    expect(first.presentationState()).toEqual(second.presentationState());
    expect(() => preparePoloStateGraphicsAuditFixture(new RenderLabBackend(32, 32)))
      .toThrow(/612x384/);
    expect(() => preparePoloStateGraphicsAuditFixture(new DeterministicBackend(612, 384)))
      .toThrow(/state plane/);
  });
});

function expectRect(
  cells: Uint8Array,
  state: Uint16Array,
  worldWidth: number,
  rect: PoloStateGraphicsRect,
  material: Material,
  expectedState: number,
  emptyRects: readonly PoloStateGraphicsRect[] = [],
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const empty = emptyRects.some((candidate) => pointInside(x, y, candidate));
      const index = y * worldWidth + x;
      expect(cells[index]).toBe(empty ? Material.Empty : material);
      expect(state[index]).toBe(empty ? 0 : expectedState);
    }
  }
}

function pointInside(x: number, y: number, rect: PoloStateGraphicsRect): boolean {
  return x >= rect.x && x < rect.x + rect.width
    && y >= rect.y && y < rect.y + rect.height;
}
