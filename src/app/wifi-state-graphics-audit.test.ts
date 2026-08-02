import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { WIFI_PRESENTATION_STATE } from '../simulation/types';
import {
  encodeWifiPresentationState, WIFI_STATE_GRAPHICS_ATLAS, WIFI_STATE_GRAPHICS_AUDIT,
} from './wifi-state-graphics-audit';

describe('WIFI state graphics audit', () => {
  it('packs the exact channel/activity projection and preserves channel zero', () => {
    expect(encodeWifiPresentationState(0, false)).toBe(WIFI_PRESENTATION_STATE.presentMask);
    expect(encodeWifiPresentationState(100, true)).toBe(
      WIFI_PRESENTATION_STATE.presentMask | WIFI_PRESENTATION_STATE.activeMask | 100,
    );
    expect(encodeWifiPresentationState(200, false)).toBe(
      WIFI_PRESENTATION_STATE.presentMask | WIFI_PRESENTATION_STATE.channelMaximum,
    );
  });

  it('covers all four native channels in both activity states with protected controls', () => {
    expect(WIFI_STATE_GRAPHICS_ATLAS.map(({ channel, active }) => [channel, active])).toEqual([
      [0, false], [3, false], [25, false], [100, false],
      [0, true], [3, true], [25, true], [100, true],
    ]);
    expect(WIFI_STATE_GRAPHICS_AUDIT.authoredHoles).toHaveLength(8 * 6 * 6);
    expect(WIFI_STATE_GRAPHICS_AUDIT.openNotches).toHaveLength(8 * 8 * 8);
    for (const entry of WIFI_STATE_GRAPHICS_ATLAS) {
      expect(entry.material).toBe(Material.WIFI);
      expect(entry.wallCoexistence.x % 4).toBe(0);
      expect(entry.wallCoexistence.y % 4).toBe(0);
    }
  });
});
