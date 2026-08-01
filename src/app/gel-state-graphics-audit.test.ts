import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import { GEL_PRESENTATION_STATE } from '../simulation/types';
import {
  encodeGelHydrationPresentationState,
  prepareGelStateGraphicsAuditFixture,
  GEL_HYDRATION_MAXIMUM,
  GEL_STATE_GRAPHICS_ATLAS,
  GEL_STATE_GRAPHICS_ATLAS_COLUMNS,
  GEL_STATE_GRAPHICS_ATLAS_ROWS,
  GEL_STATE_GRAPHICS_AUDIT,
  GEL_STATE_GRAPHICS_STATES,
  type GelStateGraphicsPoint,
  type GelStateGraphicsRect,
} from './gel-state-graphics-audit';

describe('GEL hydration-state graphics audit', () => {
  it('transports exact native tmp hydration across the bounded 0..100 range', () => {
    expect(GEL_HYDRATION_MAXIMUM).toBe(100);
    expect(encodeGelHydrationPresentationState(-4.8)).toBe(0);
    expect(encodeGelHydrationPresentationState(17.6)).toBe(18);
    expect(encodeGelHydrationPresentationState(100)).toBe(100);
    expect(encodeGelHydrationPresentationState(999)).toBe(100);
    expect(GEL_STATE_GRAPHICS_STATES.map(({ hydration }) => hydration))
      .toEqual([0, 10, 35, 70, 100]);
    expect(GEL_STATE_GRAPHICS_ATLAS.map(({ encodedState }) => encodedState))
      .toEqual([0, 10, 35, 70, 100]);
  });

  it('lays out five non-overlapping hydration cards inside the canonical world', () => {
    expect(GEL_STATE_GRAPHICS_ATLAS).toHaveLength(
      GEL_STATE_GRAPHICS_ATLAS_COLUMNS * GEL_STATE_GRAPHICS_ATLAS_ROWS,
    );
    expect(GEL_STATE_GRAPHICS_AUDIT.cards.map(({ key }) => key))
      .toEqual(GEL_STATE_GRAPHICS_STATES.map(({ key }) => key));

    for (const [index, entry] of GEL_STATE_GRAPHICS_ATLAS.entries()) {
      expect(entry.index).toBe(index);
      expect(entry.encodedState & GEL_PRESENTATION_STATE.hydrationMask).toBe(entry.hydration);
      expect(rectInside(entry.card, { x: 0, y: 0, width: 612, height: 384 })).toBe(true);
      for (const rect of [
        entry.body, entry.surfaceProbe, entry.coreProbe, entry.hydrationProbe,
        entry.authoredHole, entry.openNotch, entry.thinStrand, entry.zeroState,
        entry.waterControl, entry.spongeControl, entry.baseControl, entry.guardedBlank,
      ]) expect(rectInside(rect, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(rectInside(entry.authoredHole, entry.body)).toBe(true);
      expect(rectInside(entry.openNotch, entry.body)).toBe(true);
      expect(entry.openNotch.x + entry.openNotch.width).toBe(entry.body.x + entry.body.width);
      expect(entry.thinStrand.width).toBe(1);
    }
    for (let left = 0; left < GEL_STATE_GRAPHICS_ATLAS.length; left += 1) {
      for (let right = left + 1; right < GEL_STATE_GRAPHICS_ATLAS.length; right += 1) {
        expect(rectanglesOverlap(
          GEL_STATE_GRAPHICS_ATLAS[left].card,
          GEL_STATE_GRAPHICS_ATLAS[right].card,
        )).toBe(false);
      }
    }
  });

  it('builds exact GEL ownership and preserves dry, wrong-owner, and blank controls', () => {
    const simulation = new RenderLabBackend();
    prepareGelStateGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    const state = simulation.presentationState();

    for (const entry of GEL_STATE_GRAPHICS_ATLAS) {
      visitRect(entry.body, (point) => {
        const offset = point.y * simulation.width + point.x;
        const authoredAir = pointInside(point, entry.authoredHole)
          || pointInside(point, entry.openNotch);
        expect(cells[offset]).toBe(authoredAir ? Material.Empty : Material.GEL);
        expect(state[offset]).toBe(authoredAir ? 0 : entry.encodedState);
      });
      expectExactRect(simulation, entry.thinStrand, Material.GEL, entry.encodedState);
      expectExactPoint(simulation, entry.isolated, Material.GEL, entry.encodedState);
      expectExactRect(simulation, entry.zeroState, Material.GEL, 0);
      expectExactRect(simulation, entry.waterControl, Material.Water, entry.encodedState);
      expectExactRect(simulation, entry.spongeControl, Material.SPNG, entry.encodedState);
      expectExactRect(simulation, entry.baseControl, Material.BASE, entry.encodedState);
      expectExactRect(simulation, entry.guardedBlank, Material.Empty, 0);
    }

    expect(GEL_STATE_GRAPHICS_AUDIT.authoredHoles).toHaveLength(5 * 36);
    expect(GEL_STATE_GRAPHICS_AUDIT.openNotches).toHaveLength(5 * 64);
    expect(GEL_STATE_GRAPHICS_AUDIT.thinStrands).toHaveLength(5 * 30);
    expect(GEL_STATE_GRAPHICS_AUDIT.isolated).toHaveLength(5);
    expect(GEL_STATE_GRAPHICS_AUDIT.zeroStates).toHaveLength(5);
    expect(GEL_STATE_GRAPHICS_AUDIT.waterControls).toHaveLength(5);
    expect(GEL_STATE_GRAPHICS_AUDIT.spongeControls).toHaveLength(5);
    expect(GEL_STATE_GRAPHICS_AUDIT.baseControls).toHaveLength(5);
    expect(GEL_STATE_GRAPHICS_AUDIT.guardedBlanks).toHaveLength(5);
  });

  it('is deterministic and rejects non-canonical or state-less backends', () => {
    const first = new RenderLabBackend();
    const second = new RenderLabBackend();
    prepareGelStateGraphicsAuditFixture(first);
    prepareGelStateGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());
    expect(first.presentationState()).toEqual(second.presentationState());

    expect(() => prepareGelStateGraphicsAuditFixture(new RenderLabBackend(32, 32)))
      .toThrow('requires 612x384');
    expect(() => prepareGelStateGraphicsAuditFixture(new DeterministicBackend(612, 384)))
      .toThrow('requires a render-lab state plane');
  });
});

function expectExactRect(
  simulation: RenderLabBackend,
  rect: GelStateGraphicsRect,
  material: Material,
  expectedState: number,
): void {
  visitRect(rect, (point) => expectExactPoint(simulation, point, material, expectedState));
}

function expectExactPoint(
  simulation: RenderLabBackend,
  point: GelStateGraphicsPoint,
  material: Material,
  expectedState: number,
): void {
  const offset = point.y * simulation.width + point.x;
  expect(simulation.cells()[offset]).toBe(material);
  expect(simulation.presentationState()[offset]).toBe(expectedState);
}

function pointInside(point: GelStateGraphicsPoint, rect: GelStateGraphicsRect): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function rectInside(inner: GelStateGraphicsRect, outer: GelStateGraphicsRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(left: GelStateGraphicsRect, right: GelStateGraphicsRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

function visitRect(
  rect: GelStateGraphicsRect,
  visit: (point: GelStateGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) visit({ x, y });
  }
}
