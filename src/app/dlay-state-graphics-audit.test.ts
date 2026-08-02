import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DLAY_PRESENTATION_STATE } from '../simulation/types';
import {
  DLAY_STATE_GRAPHICS_ATLAS, DLAY_STATE_GRAPHICS_AUDIT, encodeDlayPresentationState,
} from './dlay-state-graphics-audit';

describe('DLAY state graphics audit', () => {
  it('preserves native countdown words and the owner marker exactly', () => {
    expect(encodeDlayPresentationState(0)).toBe(DLAY_PRESENTATION_STATE.presentMask);
    expect(encodeDlayPresentationState(22)).toBe(DLAY_PRESENTATION_STATE.presentMask | 22);
    expect(encodeDlayPresentationState(99_999)).toBe(0xffff);
  });

  it('covers idle through expiry alongside topology and ownership controls', () => {
    expect(DLAY_STATE_GRAPHICS_ATLAS.map(({ key }) => key))
      .toEqual(['idle', 'armed', 'mid', 'nearExpiry']);
    expect(DLAY_STATE_GRAPHICS_AUDIT.authoredHoles).toHaveLength(4 * 6 * 6);
    expect(DLAY_STATE_GRAPHICS_AUDIT.openNotches).toHaveLength(4 * 8 * 8);
    for (const entry of DLAY_STATE_GRAPHICS_ATLAS) {
      expect(entry.material).toBe(Material.DLAY);
      expect(entry.wallCoexistence.x % 4).toBe(0);
      expect(entry.wallCoexistence.y % 4).toBe(0);
    }
  });
});
