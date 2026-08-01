import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { QUARTZ_PRESENTATION_STATE } from '../simulation/types';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  encodePqrtPresentationState, PQRT_STATE_GRAPHICS_ATLAS,
  PQRT_STATE_GRAPHICS_AUDIT, PQRT_STATE_GRAPHICS_STATES,
  preparePqrtStateGraphicsAuditFixture,
} from './pqrt-state-graphics-audit';

describe('PQRT/QRTZ native state graphics fixture', () => {
  it('encodes only native tmp2 bits with the exact neutral seed', () => {
    expect(encodePqrtPresentationState(-2)).toBe(0);
    expect(encodePqrtPresentationState(5)).toBe(QUARTZ_PRESENTATION_STATE.neutralSpeckle);
    expect(encodePqrtPresentationState(999)).toBe(QUARTZ_PRESENTATION_STATE.speckleMaximum);
    expect(PQRT_STATE_GRAPHICS_STATES.map(({ speckle }) => speckle)).toEqual([0, 2, 5, 8, 10]);
  });

  it('stages both native owners, holes, neutral controls, and wrong-owner controls', () => {
    const backend = new RenderLabBackend(612, 384);
    preparePqrtStateGraphicsAuditFixture(backend);
    const cells = backend.cells();
    const states = backend.presentationState();
    expect(PQRT_STATE_GRAPHICS_AUDIT.cards).toHaveLength(5);
    expect(PQRT_STATE_GRAPHICS_ATLAS.map(({ material }) => material)).toContain(Material.Quartz);
    expect(PQRT_STATE_GRAPHICS_ATLAS.map(({ material }) => material)).toContain(Material.QRTZ);
    for (const entry of PQRT_STATE_GRAPHICS_ATLAS) {
      const bodyIndex = entry.body.y * backend.width + entry.body.x;
      const holeIndex = entry.authoredHole.y * backend.width + entry.authoredHole.x;
      const neutralIndex = entry.neutralState.y * backend.width + entry.neutralState.x;
      const wrongOwnerIndex = entry.wrongOwner.y * backend.width + entry.wrongOwner.x;
      expect(cells[bodyIndex]).toBe(entry.material);
      expect(states[bodyIndex]).toBe(entry.encodedState);
      expect(cells[holeIndex]).toBe(Material.Empty);
      expect(states[holeIndex]).toBe(0);
      expect(cells[neutralIndex]).toBe(entry.material);
      expect(states[neutralIndex]).toBe(QUARTZ_PRESENTATION_STATE.neutralSpeckle);
      expect(cells[wrongOwnerIndex]).toBe(Material.Water);
      expect(states[wrongOwnerIndex]).toBe(entry.encodedState);
    }
  });
});
