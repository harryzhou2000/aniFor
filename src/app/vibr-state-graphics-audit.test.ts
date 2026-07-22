import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  decodeVibrPresentationState,
  encodeVibrPresentationState,
  prepareVibrStateGraphicsAuditFixture,
  VIBR_STATE_ALTERNATE_MASK,
  VIBR_STATE_CHARGE_MASK,
  VIBR_STATE_GRAPHICS_ATLAS,
  VIBR_STATE_GRAPHICS_ATLAS_COLUMNS,
  VIBR_STATE_GRAPHICS_ATLAS_ROWS,
  VIBR_STATE_GRAPHICS_AUDIT,
  VIBR_STATE_GRAPHICS_STATES,
  VIBR_STATE_LIFE_MASK,
  type VibrStateGraphicsPoint,
  type VibrStateGraphicsRect,
} from './vibr-state-graphics-audit';

describe('VIBR/BVBR presentation-state graphics audit', () => {
  it('packs charge, normalized life, and alternate mode into one exact 16-bit word', () => {
    expect(VIBR_STATE_CHARGE_MASK).toBe(0x007F);
    expect(VIBR_STATE_LIFE_MASK).toBe(0x7F80);
    expect(VIBR_STATE_ALTERNATE_MASK).toBe(0x8000);
    expect(encodeVibrPresentationState(54, 192, false)).toBe(54 | 192 << 7);
    expect(encodeVibrPresentationState(100, 112, true)).toBe(100 | 112 << 7 | 0x8000);
    expect(encodeVibrPresentationState(-4.8, 999, false)).toBe(255 << 7);
    expect(encodeVibrPresentationState(500, -9, true)).toBe(100 | 0x8000);

    for (const state of VIBR_STATE_GRAPHICS_STATES) {
      expect(decodeVibrPresentationState(
        encodeVibrPresentationState(state.charge, state.life, state.alternate),
      )).toEqual({ charge: state.charge, life: state.life, alternate: state.alternate });
    }
  });

  it('lays out matched five-state VIBR and BVBR rows inside the canonical world', () => {
    expect(VIBR_STATE_GRAPHICS_ATLAS).toHaveLength(
      VIBR_STATE_GRAPHICS_ATLAS_COLUMNS * VIBR_STATE_GRAPHICS_ATLAS_ROWS,
    );
    expect(VIBR_STATE_GRAPHICS_AUDIT.vibrCards).toHaveLength(5);
    expect(VIBR_STATE_GRAPHICS_AUDIT.bvbrCards).toHaveLength(5);
    expect(VIBR_STATE_GRAPHICS_AUDIT.vibrCards.map(({ stateKey }) => stateKey)).toEqual(
      VIBR_STATE_GRAPHICS_STATES.map(({ key }) => key),
    );
    expect(VIBR_STATE_GRAPHICS_AUDIT.bvbrCards.map(({ stateKey }) => stateKey)).toEqual(
      VIBR_STATE_GRAPHICS_STATES.map(({ key }) => key),
    );

    for (const [index, entry] of VIBR_STATE_GRAPHICS_ATLAS.entries()) {
      expect(entry.index).toBe(index);
      expect(rectInside(entry.card, { x: 0, y: 0, width: 612, height: 384 })).toBe(true);
      for (const rect of [
        entry.body, entry.surfaceProbe, entry.coreProbe, entry.authoredHole,
        entry.openNotch, entry.thinStructure, entry.wrongOwner, entry.waterControl,
        entry.metalControl, entry.zeroState, entry.guardedBlank,
      ]) expect(rectInside(rect, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(rectInside(entry.authoredHole, entry.body)).toBe(true);
      expect(rectInside(entry.openNotch, entry.body)).toBe(true);
      expect(entry.openNotch.x + entry.openNotch.width).toBe(entry.body.x + entry.body.width);
      expect(entry.thinStructure.width).toBe(1);
      expect(decodeVibrPresentationState(entry.encodedState)).toEqual({
        charge: entry.charge, life: entry.life, alternate: entry.alternate,
      });
    }
    for (let left = 0; left < VIBR_STATE_GRAPHICS_ATLAS.length; left++) {
      for (let right = left + 1; right < VIBR_STATE_GRAPHICS_ATLAS.length; right++) {
        expect(rectanglesOverlap(
          VIBR_STATE_GRAPHICS_ATLAS[left].card,
          VIBR_STATE_GRAPHICS_ATLAS[right].card,
        )).toBe(false);
      }
    }
  });

  it('builds exact matched semantics and state while preserving all controls', () => {
    const simulation = new RenderLabBackend();
    prepareVibrStateGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    const state = simulation.presentationState();

    for (const entry of VIBR_STATE_GRAPHICS_ATLAS) {
      visitRect(entry.body, (point) => {
        const offset = point.y * simulation.width + point.x;
        const authoredAir = pointInside(point, entry.authoredHole)
          || pointInside(point, entry.openNotch);
        expect(cells[offset]).toBe(authoredAir ? Material.Empty : entry.material);
        expect(state[offset]).toBe(authoredAir ? 0 : entry.encodedState);
      });
      expectExactRect(simulation, entry.thinStructure, entry.material, entry.encodedState);
      expectExactPoint(simulation, entry.isolated, entry.material, entry.encodedState);
      expectExactRect(simulation, entry.zeroState, entry.material, 0);
      expectExactRect(simulation, entry.wrongOwner, Material.Sand, entry.encodedState);
      expectExactRect(simulation, entry.waterControl, Material.Water, entry.encodedState);
      expectExactRect(simulation, entry.metalControl, Material.Metal, entry.encodedState);
      expectExactRect(simulation, entry.guardedBlank, Material.Empty, 0);
    }

    expect(VIBR_STATE_GRAPHICS_AUDIT.authoredHoles).toHaveLength(10 * 36);
    expect(VIBR_STATE_GRAPHICS_AUDIT.openNotches).toHaveLength(10 * 96);
    expect(VIBR_STATE_GRAPHICS_AUDIT.thinStructures).toHaveLength(10 * 24);
    expect(VIBR_STATE_GRAPHICS_AUDIT.isolated).toHaveLength(10);
    expect(VIBR_STATE_GRAPHICS_AUDIT.zeroStates).toHaveLength(10);
    expect(VIBR_STATE_GRAPHICS_AUDIT.wrongOwners).toHaveLength(10);
    expect(VIBR_STATE_GRAPHICS_AUDIT.waterControls).toHaveLength(10);
    expect(VIBR_STATE_GRAPHICS_AUDIT.metalControls).toHaveLength(10);
    expect(VIBR_STATE_GRAPHICS_AUDIT.guardedBlanks).toHaveLength(10);
  });

  it('is deterministic and rejects non-canonical or state-less backends', () => {
    const first = new RenderLabBackend();
    const second = new RenderLabBackend();
    prepareVibrStateGraphicsAuditFixture(first);
    prepareVibrStateGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());
    expect(first.presentationState()).toEqual(second.presentationState());

    expect(() => prepareVibrStateGraphicsAuditFixture(new RenderLabBackend(32, 32)))
      .toThrow('requires 612x384');
    expect(() => prepareVibrStateGraphicsAuditFixture(new DeterministicBackend(612, 384)))
      .toThrow('requires a render-lab state plane');
  });
});

function expectExactRect(
  simulation: RenderLabBackend,
  rect: VibrStateGraphicsRect,
  material: Material,
  expectedState: number,
): void {
  visitRect(rect, (point) => expectExactPoint(simulation, point, material, expectedState));
}

function expectExactPoint(
  simulation: RenderLabBackend,
  point: VibrStateGraphicsPoint,
  material: Material,
  expectedState: number,
): void {
  const offset = point.y * simulation.width + point.x;
  expect(simulation.cells()[offset]).toBe(material);
  expect(simulation.presentationState()[offset]).toBe(expectedState);
}

function pointInside(point: VibrStateGraphicsPoint, rect: VibrStateGraphicsRect): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function rectInside(inner: VibrStateGraphicsRect, outer: VibrStateGraphicsRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(left: VibrStateGraphicsRect, right: VibrStateGraphicsRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

function visitRect(
  rect: VibrStateGraphicsRect,
  visit: (point: VibrStateGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
