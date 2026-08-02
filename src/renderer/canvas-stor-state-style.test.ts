import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { STOR_PRESENTATION_STATE } from '../simulation/types';
import { applyCanvasStorStateStyle, canvasStorPresentationState } from './canvas-stor-state-style';

const state = (payload = 0, loaded = false, cooldown = false): number => payload
  | (loaded ? STOR_PRESENTATION_STATE.payloadPresentMask : 0)
  | (cooldown ? STOR_PRESENTATION_STATE.cooldownMask : 0);

function styled(material: number, word: number): number[] {
  const output = new Float32Array([44, 72, 78]);
  applyCanvasStorStateStyle(output, material, word);
  return Array.from(output);
}

describe('Canvas native STOR reservoir-state styling', () => {
  it('requires the exact STOR owner and distinguishes loaded public and unknown payloads', () => {
    expect(canvasStorPresentationState(Material.STOR, state(Material.Water, true)))
      .toMatchObject({ payload: Material.Water, unknownPayload: false, cooldown: false });
    expect(canvasStorPresentationState(Material.STOR, state(0, true)))
      .toMatchObject({ payload: undefined, unknownPayload: true, cooldown: false });
    expect(canvasStorPresentationState(Material.Water, state(Material.Sand, true))).toBeUndefined();
  });

  it('keeps ready/zero and foreign words exact no-ops while a loaded reservoir is cyan-led', () => {
    const base = styled(Material.STOR, 0);
    expect(base).toEqual([44, 72, 78]);
    expect(styled(Material.Water, state(Material.Water, true))).toEqual(base);

    const water = styled(Material.STOR, state(Material.Water, true));
    const sand = styled(Material.STOR, state(Material.Sand, true));
    expect(water[2]).toBeGreaterThan(water[0]);
    expect(sand).not.toEqual(water);
    expect(water).not.toEqual(base);
  });

  it('uses cooldown only as a subtle RGB post-release cue', () => {
    const ready = styled(Material.STOR, 0);
    const cooldown = styled(Material.STOR, state(0, false, true));
    const loaded = styled(Material.STOR, state(Material.Water, true));
    const loadedCooldown = styled(Material.STOR, state(Material.Water, true, true));
    expect(cooldown).not.toEqual(ready);
    expect(loadedCooldown).not.toEqual(loaded);
    expect([...cooldown, ...loadedCooldown].every((channel) => channel >= 0 && channel <= 255)).toBe(true);
  });
});
