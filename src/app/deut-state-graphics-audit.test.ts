import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  DEUT_STATE_GRAPHICS_ATLAS, DEUT_STATE_GRAPHICS_AUDIT, DEUT_STATE_GRAPHICS_STATES,
  DEUT_STATE_VIBR_RECOVERY_STATE, prepareDeutStateGraphicsAuditFixture,
} from './deut-state-graphics-audit';

describe('DEUT state graphics audit fixture', () => {
  it('keeps seven exact states phase-aligned and inside the canonical world', () => {
    expect(DEUT_STATE_GRAPHICS_ATLAS).toHaveLength(7);
    expect(DEUT_STATE_GRAPHICS_ATLAS.map(({ concentration }) => concentration))
      .toEqual(DEUT_STATE_GRAPHICS_STATES.map(({ concentration }) => concentration));
    expect(DEUT_STATE_GRAPHICS_ATLAS.every(({ material, code, card, body }) => (
      material === Material.DEUT && code === 'DEUT'
      && card.x >= 0 && card.y >= 0 && card.x + card.width <= 612
      && card.y + card.height <= 384
      && body.x % 16 === DEUT_STATE_GRAPHICS_ATLAS[0].body.x % 16
      && body.y % 16 === DEUT_STATE_GRAPHICS_ATLAS[0].body.y % 16
    ))).toBe(true);
  });

  it('fills exact owners, state words, topology controls, and wrong-owner state', () => {
    const simulation = new RenderLabBackend();
    prepareDeutStateGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    const states = simulation.presentationState();
    const walls = simulation.walls();
    for (const entry of DEUT_STATE_GRAPHICS_ATLAS) {
      const bodyIndex = entry.surfaceProbe.y * simulation.width + entry.surfaceProbe.x;
      expect(cells[bodyIndex]).toBe(Material.DEUT);
      expect(states[bodyIndex]).toBe(entry.encodedState);
      const holeIndex = entry.authoredHole.y * simulation.width + entry.authoredHole.x;
      expect(cells[holeIndex]).toBe(Material.Empty);
      expect(states[holeIndex]).toBe(0);
      const zeroIndex = entry.zeroState.y * simulation.width + entry.zeroState.x;
      expect(cells[zeroIndex]).toBe(Material.DEUT);
      expect(states[zeroIndex]).toBe(0);
      const wrongIndex = entry.wrongOwner.y * simulation.width + entry.wrongOwner.x;
      expect(cells[wrongIndex]).toBe(Material.Sand);
      expect(states[wrongIndex]).toBe(entry.encodedState);
      const exotIndex = entry.exotControl.y * simulation.width + entry.exotControl.x;
      const isozIndex = entry.isozControl.y * simulation.width + entry.isozControl.x;
      expect(cells[exotIndex]).toBe(Material.EXOT);
      expect(cells[isozIndex]).toBe(Material.ISOZ);
      expect(states[exotIndex]).toBe(entry.encodedState);
      expect(states[isozIndex]).toBe(entry.encodedState);
      const wallIndex = entry.wallCoexistence.y * simulation.width + entry.wallCoexistence.x;
      expect(cells[wallIndex]).toBe(Material.DEUT);
      expect(states[wallIndex]).toBe(entry.encodedState);
      expect(walls[wallIndex]).toBe(1);
    }
    const vibrIndex = 220 * simulation.width + 452;
    expect(cells[vibrIndex]).toBe(Material.VIBR);
    expect(states[vibrIndex]).toBe(DEUT_STATE_VIBR_RECOVERY_STATE);
    for (const probe of DEUT_STATE_GRAPHICS_AUDIT.highRange) {
      const index = probe.rect.y * simulation.width + probe.rect.x;
      expect(cells[index]).toBe(Material.DEUT);
      expect(states[index]).toBe(probe.encodedState);
    }
  });
});
