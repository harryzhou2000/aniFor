import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { SWCH_PRESENTATION_STATE } from '../simulation/types';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  encodeSwchPresentationState, prepareSwchStateGraphicsAuditFixture,
  SWCH_STATE_GRAPHICS_ATLAS, SWCH_STATE_GRAPHICS_AUDIT, SWCH_STATE_GRAPHICS_STATES,
} from './swch-state-graphics-audit';

describe('SWCH native conduction graphics fixture', () => {
  it('projects only the native owner-present/on threshold', () => {
    expect(encodeSwchPresentationState(false)).toBe(SWCH_PRESENTATION_STATE.presentMask);
    expect(encodeSwchPresentationState(true)).toBe(
      SWCH_PRESENTATION_STATE.presentMask | SWCH_PRESENTATION_STATE.onMask,
    );
    expect(SWCH_STATE_GRAPHICS_STATES.map(({ key, life, on }) => [key, life, on])).toEqual([
      ['off', 0, false], ['decay', 9, false], ['on', 10, true],
    ]);
  });

  it('stages exact state owners, topology, and protected ownership/wall controls', () => {
    const backend = new RenderLabBackend(612, 384);
    prepareSwchStateGraphicsAuditFixture(backend);
    const cells = backend.cells();
    const states = backend.presentationState();
    const walls = backend.walls();
    expect(SWCH_STATE_GRAPHICS_AUDIT.cards).toHaveLength(3);
    for (const entry of SWCH_STATE_GRAPHICS_ATLAS) {
      const indexAt = ({ x, y }: { x: number; y: number }) => y * backend.width + x;
      expect(cells[indexAt(entry.body)]).toBe(Material.SWCH);
      expect(states[indexAt(entry.body)]).toBe(entry.encodedState);
      expect(cells[indexAt(entry.authoredHole)]).toBe(Material.Empty);
      expect(states[indexAt(entry.authoredHole)]).toBe(0);
      expect(cells[indexAt(entry.openNotch)]).toBe(Material.Empty);
      expect(cells[indexAt(entry.thinStructure)]).toBe(Material.SWCH);
      expect(cells[indexAt(entry.isolated)]).toBe(Material.SWCH);
      expect(states[indexAt(entry.isolated)]).toBe(entry.encodedState);
      expect(cells[indexAt(entry.absentState)]).toBe(Material.SWCH);
      expect(states[indexAt(entry.absentState)]).toBe(0);
      expect(cells[indexAt(entry.wrongOwner)]).toBe(Material.Water);
      expect(states[indexAt(entry.wrongOwner)]).toBe(encodeSwchPresentationState(true));
      expect(cells[indexAt(entry.wallCoexistence)]).toBe(Material.SWCH);
      expect(states[indexAt(entry.wallCoexistence)]).toBe(encodeSwchPresentationState(true));
      expect(walls[indexAt(entry.wallCoexistence)]).toBe(SWCH_STATE_GRAPHICS_AUDIT.conductiveWall);
    }
  });
});
