import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { STOR_PRESENTATION_STATE } from '../simulation/types';
import {
  encodeStorPresentationState, STOR_STATE_GRAPHICS_ATLAS, STOR_STATE_GRAPHICS_AUDIT,
} from './stor-state-graphics-audit';

describe('STOR state graphics audit', () => {
  it('packs only the public retained-payload and native-cooldown projection', () => {
    expect(encodeStorPresentationState({ payload: Material.Water, payloadPresent: true, cooldown: false }))
      .toBe(Material.Water | STOR_PRESENTATION_STATE.payloadPresentMask);
    expect(encodeStorPresentationState({ payload: 0xff, payloadPresent: true, cooldown: true }))
      .toBe(0x03ff);
    expect(encodeStorPresentationState({ payload: 2, payloadPresent: false, cooldown: false }))
      .toBe(Material.Water);
  });

  it('covers each retained native state while preserving topology and ownership controls', () => {
    expect(STOR_STATE_GRAPHICS_ATLAS.map(({ stateKey }) => stateKey))
      .toEqual(['unloaded', 'water', 'fire', 'unknown', 'cooldown']);
    expect(STOR_STATE_GRAPHICS_AUDIT.authoredHoles).toHaveLength(5 * 6 * 6);
    expect(STOR_STATE_GRAPHICS_AUDIT.openNotches).toHaveLength(5 * 8 * 8);
    expect(STOR_STATE_GRAPHICS_AUDIT.thinStructures).toHaveLength(5 * 30);
    for (const entry of STOR_STATE_GRAPHICS_ATLAS) {
      expect(entry.material).toBe(Material.STOR);
      expect(entry.zeroState.width).toBeGreaterThan(0);
      expect(entry.wrongOwner.width).toBeGreaterThan(0);
      expect(entry.wallCoexistence.x % 4).toBe(0);
      expect(entry.wallCoexistence.y % 4).toBe(0);
    }
  });
});
