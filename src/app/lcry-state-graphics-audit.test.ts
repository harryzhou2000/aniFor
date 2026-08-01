import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { LCRY_PRESENTATION_STATE } from '../simulation/types';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  encodeLcryPresentationState, LCRY_STATE_GRAPHICS_ATLAS,
  LCRY_STATE_GRAPHICS_AUDIT, LCRY_STATE_GRAPHICS_STATES,
  prepareLcryStateGraphicsAuditFixture,
} from './lcry-state-graphics-audit';

describe('LCRY native charge graphics fixture', () => {
  it('encodes the exact owner-present marker plus only native tmp2 brightness bits', () => {
    expect(encodeLcryPresentationState(-2)).toBe(LCRY_PRESENTATION_STATE.presentMask);
    expect(encodeLcryPresentationState(5)).toBe(LCRY_PRESENTATION_STATE.presentMask | 5);
    expect(encodeLcryPresentationState(999)).toBe(
      LCRY_PRESENTATION_STATE.presentMask | LCRY_PRESENTATION_STATE.brightnessMaximum,
    );
    expect(LCRY_STATE_GRAPHICS_STATES.map(({ brightness }) => brightness)).toEqual([0, 2, 5, 8, 10]);
  });

  it('stages charged exact owners, authored topology, and neutral/absent/wrong-owner controls', () => {
    const backend = new RenderLabBackend(612, 384);
    prepareLcryStateGraphicsAuditFixture(backend);
    const cells = backend.cells();
    const states = backend.presentationState();
    expect(LCRY_STATE_GRAPHICS_AUDIT.cards).toHaveLength(5);
    for (const entry of LCRY_STATE_GRAPHICS_ATLAS) {
      const bodyIndex = entry.body.y * backend.width + entry.body.x;
      const holeIndex = entry.authoredHole.y * backend.width + entry.authoredHole.x;
      const neutralIndex = entry.neutralState.y * backend.width + entry.neutralState.x;
      const absentIndex = entry.absentState.y * backend.width + entry.absentState.x;
      const wrongOwnerIndex = entry.wrongOwner.y * backend.width + entry.wrongOwner.x;
      expect(cells[bodyIndex]).toBe(Material.LCRY);
      expect(states[bodyIndex]).toBe(entry.encodedState);
      expect(cells[holeIndex]).toBe(Material.Empty);
      expect(states[holeIndex]).toBe(0);
      expect(cells[neutralIndex]).toBe(Material.LCRY);
      expect(states[neutralIndex]).toBe(encodeLcryPresentationState(5));
      expect(cells[absentIndex]).toBe(Material.LCRY);
      expect(states[absentIndex]).toBe(0);
      expect(cells[wrongOwnerIndex]).toBe(Material.Water);
      expect(states[wrongOwnerIndex]).toBe(entry.encodedState);
    }
  });
});
