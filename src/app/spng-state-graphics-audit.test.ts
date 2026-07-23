import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import { SPNG_PRESENTATION_STATE } from '../simulation/types';
import {
  encodeSpngHydrationPresentationState,
  prepareSpngStateGraphicsAuditFixture,
  SPNG_HYDRATION_MAXIMUM,
  SPNG_STATE_GRAPHICS_ATLAS,
  SPNG_STATE_GRAPHICS_ATLAS_COLUMNS,
  SPNG_STATE_GRAPHICS_ATLAS_ROWS,
  SPNG_STATE_GRAPHICS_AUDIT,
  SPNG_STATE_GRAPHICS_STATES,
  type SpngStateGraphicsPoint,
  type SpngStateGraphicsRect,
} from './spng-state-graphics-audit';

describe('SPNG hydration-state graphics audit', () => {
  it('transports exact native life hydration across the bounded 0..50 range', () => {
    expect(SPNG_HYDRATION_MAXIMUM).toBe(50);
    expect(SPNG_PRESENTATION_STATE.presentMask).toBe(0x0040);
    expect(encodeSpngHydrationPresentationState(-4.8)).toBe(64);
    expect(encodeSpngHydrationPresentationState(17.6)).toBe(64 | 18);
    expect(encodeSpngHydrationPresentationState(50)).toBe(64 | 50);
    expect(encodeSpngHydrationPresentationState(999)).toBe(64 | 50);
    expect(SPNG_STATE_GRAPHICS_STATES.map(({ hydration }) => hydration))
      .toEqual([0, 10, 25, 40, 50]);
    expect(SPNG_STATE_GRAPHICS_ATLAS.map(({ encodedState }) => encodedState))
      .toEqual([64, 74, 89, 104, 114]);
  });

  it('lays out five non-overlapping hydration cards inside the canonical world', () => {
    expect(SPNG_STATE_GRAPHICS_ATLAS).toHaveLength(
      SPNG_STATE_GRAPHICS_ATLAS_COLUMNS * SPNG_STATE_GRAPHICS_ATLAS_ROWS,
    );
    expect(SPNG_STATE_GRAPHICS_AUDIT.cards.map(({ key }) => key))
      .toEqual(SPNG_STATE_GRAPHICS_STATES.map(({ key }) => key));

    for (const [index, entry] of SPNG_STATE_GRAPHICS_ATLAS.entries()) {
      expect(entry.index).toBe(index);
      expect(entry.encodedState & SPNG_PRESENTATION_STATE.presentMask)
        .toBe(SPNG_PRESENTATION_STATE.presentMask);
      expect(entry.encodedState & SPNG_PRESENTATION_STATE.hydrationMask)
        .toBe(entry.hydration);
      expect(rectInside(entry.card, { x: 0, y: 0, width: 612, height: 384 })).toBe(true);
      for (const rect of [
        entry.body, entry.surfaceProbe, entry.coreProbe, entry.hydrationProbe,
        entry.backgroundProbe, entry.authoredHole, entry.openNotch, entry.thinStructure,
        entry.zeroState, entry.wrongOwner, entry.waterControl, entry.steamControl,
        entry.saltControl, entry.guardedBlank,
      ]) expect(rectInside(rect, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(rectInside(entry.authoredHole, entry.body)).toBe(true);
      expect(rectInside(entry.openNotch, entry.body)).toBe(true);
      expect(entry.openNotch.x + entry.openNotch.width).toBe(entry.body.x + entry.body.width);
      expect(entry.thinStructure.width).toBe(1);
    }
    for (let left = 0; left < SPNG_STATE_GRAPHICS_ATLAS.length; left++) {
      for (let right = left + 1; right < SPNG_STATE_GRAPHICS_ATLAS.length; right++) {
        expect(rectanglesOverlap(
          SPNG_STATE_GRAPHICS_ATLAS[left].card,
          SPNG_STATE_GRAPHICS_ATLAS[right].card,
        )).toBe(false);
      }
    }
  });

  it('builds exact SPNG ownership and hydration while preserving controls', () => {
    const simulation = new RenderLabBackend();
    prepareSpngStateGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    const state = simulation.presentationState();

    for (const entry of SPNG_STATE_GRAPHICS_ATLAS) {
      visitRect(entry.body, (point) => {
        const offset = point.y * simulation.width + point.x;
        const authoredAir = pointInside(point, entry.authoredHole)
          || pointInside(point, entry.openNotch);
        expect(cells[offset]).toBe(authoredAir ? Material.Empty : Material.SPNG);
        expect(state[offset]).toBe(authoredAir ? 0 : entry.encodedState);
      });
      expectExactRect(simulation, entry.thinStructure, Material.SPNG, entry.encodedState);
      expectExactPoint(simulation, entry.isolated, Material.SPNG, entry.encodedState);
      expectExactRect(simulation, entry.zeroState, Material.SPNG, 0);
      expectExactRect(simulation, entry.wrongOwner, Material.Sand, entry.encodedState);
      expectExactRect(simulation, entry.waterControl, Material.Water, entry.encodedState);
      expectExactRect(simulation, entry.steamControl, Material.Steam, entry.encodedState);
      expectExactRect(simulation, entry.saltControl, Material.Salt, entry.encodedState);
      expectExactRect(simulation, entry.guardedBlank, Material.Empty, 0);
    }

    expect(SPNG_STATE_GRAPHICS_AUDIT.authoredHoles).toHaveLength(5 * 36);
    expect(SPNG_STATE_GRAPHICS_AUDIT.openNotches).toHaveLength(5 * 64);
    expect(SPNG_STATE_GRAPHICS_AUDIT.thinStructures).toHaveLength(5 * 30);
    expect(SPNG_STATE_GRAPHICS_AUDIT.isolated).toHaveLength(5);
    expect(SPNG_STATE_GRAPHICS_AUDIT.zeroStates).toHaveLength(5);
    expect(SPNG_STATE_GRAPHICS_AUDIT.wrongOwners).toHaveLength(5);
    expect(SPNG_STATE_GRAPHICS_AUDIT.waterControls).toHaveLength(5);
    expect(SPNG_STATE_GRAPHICS_AUDIT.steamControls).toHaveLength(5);
    expect(SPNG_STATE_GRAPHICS_AUDIT.saltControls).toHaveLength(5);
    expect(SPNG_STATE_GRAPHICS_AUDIT.guardedBlanks).toHaveLength(5);
  });

  it('is deterministic and rejects non-canonical or state-less backends', () => {
    const first = new RenderLabBackend();
    const second = new RenderLabBackend();
    prepareSpngStateGraphicsAuditFixture(first);
    prepareSpngStateGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());
    expect(first.presentationState()).toEqual(second.presentationState());

    expect(() => prepareSpngStateGraphicsAuditFixture(new RenderLabBackend(32, 32)))
      .toThrow('requires 612x384');
    expect(() => prepareSpngStateGraphicsAuditFixture(new DeterministicBackend(612, 384)))
      .toThrow('requires a render-lab state plane');
  });
});

function expectExactRect(
  simulation: RenderLabBackend,
  rect: SpngStateGraphicsRect,
  material: Material,
  expectedState: number,
): void {
  visitRect(rect, (point) => expectExactPoint(simulation, point, material, expectedState));
}

function expectExactPoint(
  simulation: RenderLabBackend,
  point: SpngStateGraphicsPoint,
  material: Material,
  expectedState: number,
): void {
  const offset = point.y * simulation.width + point.x;
  expect(simulation.cells()[offset]).toBe(material);
  expect(simulation.presentationState()[offset]).toBe(expectedState);
}

function pointInside(point: SpngStateGraphicsPoint, rect: SpngStateGraphicsRect): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function rectInside(inner: SpngStateGraphicsRect, outer: SpngStateGraphicsRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(left: SpngStateGraphicsRect, right: SpngStateGraphicsRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

function visitRect(
  rect: SpngStateGraphicsRect,
  visit: (point: SpngStateGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
