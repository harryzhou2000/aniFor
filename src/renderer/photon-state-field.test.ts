import { describe, expect, it } from 'vitest';
import { encodePhotonSpectrumState } from './photon-spectrum-state';
import { packPhotonStateRect } from './photon-state-field';

describe('PHOT state texture packing', () => {
  it('packs its independent uint16 state into RG without occupying matter/wall channels', () => {
    const state = new Uint16Array([0, encodePhotonSpectrumState(12, 3, 8), 0, 0]);
    const packed = new Uint8Array(16);
    packPhotonStateRect(packed, 2, state, { x: 0, y: 0, width: 2, height: 2 });
    expect([...packed.slice(4, 8)]).toEqual([0x3c, 0x88, 0, 0]);
    expect([...packed.slice(0, 4)]).toEqual([0, 0, 0, 0]);
  });
});
