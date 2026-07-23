import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { POLO_PRESENTATION_STATE } from '../simulation/types';
import { applyCanvasPoloStateStyle } from './canvas-polo-state-style';

const SOURCE = [80, 96, 48, 0.375] as const;
const SOURCE_FLOAT = Array.from(new Float32Array(SOURCE));

function encodeState(emissions: number, cooldown: number, protonDose: number): number {
  return POLO_PRESENTATION_STATE.presentMask
    | (emissions & POLO_PRESENTATION_STATE.emissionMask)
    | ((cooldown << POLO_PRESENTATION_STATE.cooldownShift)
      & POLO_PRESENTATION_STATE.cooldownMask)
    | ((protonDose << POLO_PRESENTATION_STATE.protonDoseShift)
      & POLO_PRESENTATION_STATE.protonDoseMask);
}

function styled(material: number, state: number, x: number, y: number): number[] {
  const rgba = new Float32Array(SOURCE);
  applyCanvasPoloStateStyle(rgba, material, state, x, y);
  return Array.from(rgba);
}

describe('Canvas POLO native-state styling', () => {
  it('decodes the shared native packing and requires exact POLO presence', () => {
    expect(Material.POLO).toBe(109);
    expect(POLO_PRESENTATION_STATE).toMatchObject({
      emissionMask: 0x0007,
      emissionMaximum: 5,
      cooldownShift: 3,
      cooldownMask: 0x0078,
      cooldownMaximum: 15,
      protonDoseShift: 7,
      protonDoseMask: 0x0780,
      protonDoseMaximum: 10,
      presentMask: 0x0800,
      reservedMask: 0xf000,
    });
    expect(styled(Material.POLO, 0, 14, 8)).toEqual(SOURCE_FLOAT);
    expect(styled(
      Material.POLO,
      encodeState(0, 0, 0) & ~POLO_PRESENTATION_STATE.presentMask,
      14,
      8,
    ))
      .toEqual(SOURCE_FLOAT);
    expect(styled(Material.PLUT, encodeState(0, 0, 0), 14, 8)).toEqual(SOURCE_FLOAT);
  });

  it('makes present-only default POLO visibly neutron-ready', () => {
    expect(styled(Material.POLO, encodeState(0, 0, 0), 14, 8))
      .toEqual([87, 112, 57, SOURCE_FLOAT[3]]);
    expect(styled(Material.POLO, encodeState(4, 0, 0), 14, 8))
      .toEqual([87, 112, 57, SOURCE_FLOAT[3]]);
    expect(styled(Material.POLO, encodeState(0, 0, 0), 1, 2))
      .not.toEqual(SOURCE_FLOAT);
  });

  it('separates cooldown afterglow from ready and spent material', () => {
    const ready = styled(Material.POLO, encodeState(1, 0, 0), 12, 8);
    const cooling = styled(Material.POLO, encodeState(1, 15, 0), 12, 8);
    const spent = styled(Material.POLO, encodeState(5, 0, 0), 12, 8);
    expect(cooling).toEqual([96, 107, 44, SOURCE_FLOAT[3]]);
    expect(cooling).not.toEqual(ready);
    expect(spent).not.toEqual(ready);
    expect(spent).not.toEqual(cooling);
    expect(spent[2]).toBeGreaterThan(ready[2]);
  });

  it('shows monotonic proton-dose progress without replacing the native owner', () => {
    const zero = styled(Material.POLO, encodeState(2, 1, 0), 1, 2);
    const low = styled(Material.POLO, encodeState(2, 1, 1), 1, 2);
    const middle = styled(Material.POLO, encodeState(2, 1, 5), 1, 2);
    const full = styled(Material.POLO, encodeState(2, 1, 10), 1, 2);
    expect(low[0]).toBeGreaterThan(zero[0]);
    expect(middle[0]).toBeGreaterThan(low[0]);
    expect(full[0]).toBeGreaterThan(middle[0]);
    expect(low[1]).toBeLessThan(styled(Material.POLO, encodeState(2, 1, 0), 1, 2)[1]);
    expect(full).not.toEqual(styled(Material.PLUT, encodeState(2, 1, 10), 1, 2));
  });

  it('is deterministic, 16-cell world-periodic, RGB-bounded, and alpha-invariant', () => {
    const states = [
      encodeState(0, 0, 0),
      encodeState(4, 0, 0),
      encodeState(1, 15, 0),
      encodeState(1, 1, 9),
      encodeState(5, 0, 0),
      encodeState(7, 15, 15),
    ];
    for (const state of states) {
      for (let y = -17; y <= 17; y++) for (let x = -17; x <= 17; x++) {
        const first = styled(Material.POLO, state, x, y);
        expect(styled(Material.POLO, state, x, y)).toEqual(first);
        expect(styled(Material.POLO, state, x + 0.875, y + 0.375)).toEqual(first);
        expect(styled(Material.POLO, state, x + 16, y + 16)).toEqual(first);
        expect(styled(
          Material.POLO, state | POLO_PRESENTATION_STATE.reservedMask, x, y,
        )).toEqual(first);
        for (let channel = 0; channel < 3; channel++) {
          expect(Math.abs(first[channel] - SOURCE[channel])).toBeLessThanOrEqual(16);
        }
        expect(first[3]).toBe(SOURCE_FLOAT[3]);
      }
    }
  });
});
