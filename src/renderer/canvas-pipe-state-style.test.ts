import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { PIPE_PRESENTATION_STATE } from '../simulation/types';
import {
  applyCanvasPipePresentationStyle,
  canvasPipePresentationState,
  PipePayloadCategory,
  pipePayloadCategory,
} from './canvas-pipe-state-style';

const state = (payload = 0, route = 0, loaded = false, paused = false): number => payload
  | (loaded ? PIPE_PRESENTATION_STATE.payloadPresentMask : 0)
  | (route << PIPE_PRESENTATION_STATE.routeShift)
  | (paused ? PIPE_PRESENTATION_STATE.pausedMask : 0);

function styled(material: number, word: number): number[] {
  const output = new Float32Array([70, 74, 82]);
  applyCanvasPipePresentationStyle(output, material, word);
  return Array.from(output);
}

describe('Canvas native PIPE/PPIP presentation styling', () => {
  it('requires exact owners and keeps an unknown loaded carriage separate from an empty route', () => {
    expect(canvasPipePresentationState(Material.PIPE, state(Material.Water, 2, true)))
      .toMatchObject({ payload: Material.Water, unknownPayload: false, route: 2, paused: false });
    expect(canvasPipePresentationState(Material.PPIP, state(0, 3, true, true)))
      .toMatchObject({ payload: undefined, unknownPayload: true, route: 3, paused: true });
    expect(canvasPipePresentationState(Material.Water, state(Material.Sand, 1, true))).toBeUndefined();
  });

  it('uses stable compact categories for loaded public payloads', () => {
    expect(pipePayloadCategory(Material.Water)).toBe(PipePayloadCategory.Liquid);
    expect(pipePayloadCategory(Material.Fire)).toBe(PipePayloadCategory.GasOrEnergy);
    expect(pipePayloadCategory(Material.Sand)).toBe(PipePayloadCategory.Granular);
    expect(pipePayloadCategory(Material.Metal)).toBe(PipePayloadCategory.RigidOrDevice);
    const water = styled(Material.PIPE, state(Material.Water, 0, true));
    const sand = styled(Material.PIPE, state(Material.Sand, 0, true));
    expect(water[2]).toBeGreaterThan(water[0]);
    expect(sand[0]).toBeGreaterThan(sand[2]);
  });

  it('distinguishes empty routing, unknown carriage, and PPIP-only pause using RGB only', () => {
    const route0 = styled(Material.PIPE, state(0, 0));
    const route3 = styled(Material.PIPE, state(0, 3));
    const unknown = styled(Material.PIPE, state(0, 0, true));
    const paused = styled(Material.PPIP, state(Material.Water, 1, true, true));
    const pipePauseControl = styled(Material.PIPE, state(Material.Water, 1, true, true));
    expect(route0).not.toEqual(route3);
    expect(unknown).not.toEqual(route0);
    expect(paused).not.toEqual(pipePauseControl);
    expect([...route0, ...route3, ...unknown, ...paused].every((channel) => channel >= 0 && channel <= 255)).toBe(true);
  });
});
