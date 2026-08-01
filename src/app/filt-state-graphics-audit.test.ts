import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { FILT_PRESENTATION_STATE } from '../simulation/types';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  encodeFiltPresentationState,
  FILT_STATE_GRAPHICS_ATLAS,
  FILT_STATE_GRAPHICS_AUDIT,
  FILT_STATE_GRAPHICS_STATES,
  prepareFiltStateGraphicsAuditFixture,
} from './filt-state-graphics-audit';

describe('FILT native spectrum state graphics fixture', () => {
  it('packs clamped ctype channels, life, and the native present bit only', () => {
    expect(encodeFiltPresentationState(-3, 99, 4.4, 99)).toBe(
      FILT_PRESENTATION_STATE.presentMask
      | (FILT_PRESENTATION_STATE.greenMaximum << FILT_PRESENTATION_STATE.greenShift)
      | (4 << FILT_PRESENTATION_STATE.blueShift)
      | (FILT_PRESENTATION_STATE.lifeMaximum << FILT_PRESENTATION_STATE.lifeShift),
    );
    expect(encodeFiltPresentationState(0, 0, 0, 0, false)).toBe(0);
    expect(FILT_STATE_GRAPHICS_STATES.map(({ key }) => key)).toEqual([
      'red', 'green', 'blue', 'mixedRest', 'mixedActive', 'fallbackCold', 'fallbackHot',
    ]);
  });

  it('stages spectra, native-temperature fallbacks, topology, and owner guards', () => {
    const backend = new RenderLabBackend(612, 384);
    prepareFiltStateGraphicsAuditFixture(backend);
    const cells = backend.cells();
    const states = backend.presentationState();
    const temperatures = backend.temperature();
    expect(FILT_STATE_GRAPHICS_AUDIT.cards).toHaveLength(7);
    expect(FILT_STATE_GRAPHICS_AUDIT.temperatureFallbacks.map(({ key }) => key)).toEqual([
      'fallbackCold', 'fallbackHot',
    ]);

    for (const entry of FILT_STATE_GRAPHICS_ATLAS) {
      const bodyIndex = entry.body.y * backend.width + entry.body.x;
      const holeIndex = entry.authoredHole.y * backend.width + entry.authoredHole.x;
      const zeroPresentIndex = entry.zeroPresentState.y * backend.width + entry.zeroPresentState.x;
      const wrongOwnerIndex = entry.wrongOwner.y * backend.width + entry.wrongOwner.x;
      expect(cells[bodyIndex]).toBe(Material.FILT);
      expect(states[bodyIndex]).toBe(entry.encodedState);
      expect(cells[holeIndex]).toBe(Material.Empty);
      expect(states[holeIndex]).toBe(0);
      expect(cells[zeroPresentIndex]).toBe(Material.FILT);
      expect(states[zeroPresentIndex]).toBe(0);
      expect(cells[wrongOwnerIndex]).toBe(Material.Water);
      expect(states[wrongOwnerIndex]).toBe(entry.encodedState);
      if (entry.temperature !== undefined) expect(temperatures[bodyIndex]).toBe(entry.temperature);
    }
  });
});
