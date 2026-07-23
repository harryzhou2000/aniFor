import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import { LAVA_PRESENTATION_STATE } from '../simulation/types';
import {
  encodeLavaOriginPresentationState,
  LAVA_STATE_GRAPHICS_ATLAS,
  LAVA_STATE_GRAPHICS_ATLAS_COLUMNS,
  LAVA_STATE_GRAPHICS_ATLAS_ROWS,
  LAVA_STATE_GRAPHICS_AUDIT,
  LAVA_STATE_GRAPHICS_STATES,
  prepareLavaStateGraphicsAuditFixture,
  type LavaStateGraphicsPoint,
  type LavaStateGraphicsRect,
} from './lava-state-graphics-audit';

describe('typed-Lava ancestry graphics audit', () => {
  it('encodes exact public origin identity with an authoritative present bit', () => {
    expect(LAVA_PRESENTATION_STATE.originMask).toBe(0x00ff);
    expect(LAVA_PRESENTATION_STATE.presentMask).toBe(0x0100);
    expect(encodeLavaOriginPresentationState(Material.Empty)).toBe(0x0100);
    expect(encodeLavaOriginPresentationState(Material.QRTZ)).toBe(0x014c);
    expect(encodeLavaOriginPresentationState(Material.GOLD)).toBe(0x0146);
    expect(encodeLavaOriginPresentationState(Material.Salt)).toBe(0x0107);
    expect(encodeLavaOriginPresentationState(Material.SLCN)).toBe(0x0133);
    expect(encodeLavaOriginPresentationState(Material.POLO)).toBe(0x016d);
    expect(encodeLavaOriginPresentationState(-4.8 as Material)).toBe(0x0100);
    expect(encodeLavaOriginPresentationState(999 as Material)).toBe(0x01ff);
    expect(LAVA_STATE_GRAPHICS_ATLAS.map(({ encodedState }) => encodedState))
      .toEqual([0x0100, 0x014c, 0x0146, 0x0107, 0x0133, 0x016d]);
  });

  it('lays out six non-overlapping ancestry cards inside the canonical world', () => {
    expect(LAVA_STATE_GRAPHICS_ATLAS).toHaveLength(
      LAVA_STATE_GRAPHICS_ATLAS_COLUMNS * LAVA_STATE_GRAPHICS_ATLAS_ROWS,
    );
    expect(LAVA_STATE_GRAPHICS_AUDIT.cards.map(({ key }) => key))
      .toEqual(LAVA_STATE_GRAPHICS_STATES.map(({ key }) => key));
    expect(LAVA_STATE_GRAPHICS_AUDIT.cards.map(({ originCode }) => originCode))
      .toEqual(['NONE', 'QRTZ', 'GOLD', 'SALT', 'SLCN', 'POLO']);

    for (const [index, entry] of LAVA_STATE_GRAPHICS_ATLAS.entries()) {
      expect(entry.index).toBe(index);
      expect(entry.encodedState & LAVA_PRESENTATION_STATE.presentMask)
        .toBe(LAVA_PRESENTATION_STATE.presentMask);
      expect(entry.encodedState & LAVA_PRESENTATION_STATE.originMask).toBe(entry.origin);
      expect(rectInside(entry.card, { x: 0, y: 0, width: 612, height: 384 })).toBe(true);
      for (const rect of [
        entry.body, entry.surfaceProbe, entry.coreProbe, entry.originProbe,
        entry.authoredHole, entry.openNotch, entry.thinStructure, entry.zeroState,
        entry.wrongOwner, entry.waterControl, entry.cooledSolidControl, entry.guardedBlank,
      ]) expect(rectInside(rect, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(rectInside(entry.authoredHole, entry.body)).toBe(true);
      expect(rectInside(entry.openNotch, entry.body)).toBe(true);
      expect(entry.openNotch.x + entry.openNotch.width).toBe(entry.body.x + entry.body.width);
      expect(entry.thinStructure.width).toBe(1);
    }
    for (let left = 0; left < LAVA_STATE_GRAPHICS_ATLAS.length; left++) {
      for (let right = left + 1; right < LAVA_STATE_GRAPHICS_ATLAS.length; right++) {
        expect(rectanglesOverlap(
          LAVA_STATE_GRAPHICS_ATLAS[left].card,
          LAVA_STATE_GRAPHICS_ATLAS[right].card,
        )).toBe(false);
      }
    }
  });

  it('builds exact Lava ownership and ancestry while preserving controls', () => {
    const simulation = new RenderLabBackend();
    prepareLavaStateGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    const state = simulation.presentationState();

    for (const entry of LAVA_STATE_GRAPHICS_ATLAS) {
      visitRect(entry.body, (point) => {
        const offset = point.y * simulation.width + point.x;
        const authoredAir = pointInside(point, entry.authoredHole)
          || pointInside(point, entry.openNotch);
        expect(cells[offset]).toBe(authoredAir ? Material.Empty : Material.Lava);
        expect(state[offset]).toBe(authoredAir ? 0 : entry.encodedState);
      });
      expectExactRect(simulation, entry.thinStructure, Material.Lava, entry.encodedState);
      expectExactPoint(simulation, entry.isolated, Material.Lava, entry.encodedState);
      expectExactRect(simulation, entry.zeroState, Material.Lava, 0);
      expectExactRect(simulation, entry.wrongOwner, Material.Sand, entry.encodedState);
      expectExactRect(simulation, entry.waterControl, Material.Water, entry.encodedState);
      expectExactRect(simulation, entry.cooledSolidControl, entry.cooledMaterial, 0);
      expectExactRect(simulation, entry.guardedBlank, Material.Empty, 0);
    }

    expect(LAVA_STATE_GRAPHICS_AUDIT.authoredHoles).toHaveLength(6 * 36);
    expect(LAVA_STATE_GRAPHICS_AUDIT.openNotches).toHaveLength(6 * 64);
    expect(LAVA_STATE_GRAPHICS_AUDIT.thinStructures).toHaveLength(6 * 24);
    expect(LAVA_STATE_GRAPHICS_AUDIT.isolated).toHaveLength(6);
    expect(LAVA_STATE_GRAPHICS_AUDIT.zeroStates).toHaveLength(6);
    expect(LAVA_STATE_GRAPHICS_AUDIT.wrongOwners).toHaveLength(6);
    expect(LAVA_STATE_GRAPHICS_AUDIT.waterControls).toHaveLength(6);
    expect(LAVA_STATE_GRAPHICS_AUDIT.cooledSolidControls).toHaveLength(6);
    expect(LAVA_STATE_GRAPHICS_AUDIT.guardedBlanks).toHaveLength(6);
  });

  it('is deterministic and rejects non-canonical or state-less backends', () => {
    const first = new RenderLabBackend();
    const second = new RenderLabBackend();
    prepareLavaStateGraphicsAuditFixture(first);
    prepareLavaStateGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());
    expect(first.presentationState()).toEqual(second.presentationState());

    expect(() => prepareLavaStateGraphicsAuditFixture(new RenderLabBackend(32, 32)))
      .toThrow('requires 612x384');
    expect(() => prepareLavaStateGraphicsAuditFixture(new DeterministicBackend(612, 384)))
      .toThrow('requires a render-lab state plane');
  });
});

function expectExactRect(
  simulation: RenderLabBackend,
  rect: LavaStateGraphicsRect,
  material: Material,
  expectedState: number,
): void {
  visitRect(rect, (point) => expectExactPoint(simulation, point, material, expectedState));
}

function expectExactPoint(
  simulation: RenderLabBackend,
  point: LavaStateGraphicsPoint,
  material: Material,
  expectedState: number,
): void {
  const offset = point.y * simulation.width + point.x;
  expect(simulation.cells()[offset]).toBe(material);
  expect(simulation.presentationState()[offset]).toBe(expectedState);
}

function pointInside(point: LavaStateGraphicsPoint, rect: LavaStateGraphicsRect): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function rectInside(inner: LavaStateGraphicsRect, outer: LavaStateGraphicsRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(left: LavaStateGraphicsRect, right: LavaStateGraphicsRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

function visitRect(
  rect: LavaStateGraphicsRect,
  visit: (point: LavaStateGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
