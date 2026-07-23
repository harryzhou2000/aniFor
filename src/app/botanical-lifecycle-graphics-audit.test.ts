import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import { PLNT_PRESENTATION_STATE, SEED_PRESENTATION_STATE } from '../simulation/types';
import {
  BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS,
  BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS_COLUMNS,
  BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS_ROWS,
  BOTANICAL_LIFECYCLE_GRAPHICS_AUDIT,
  BOTANICAL_LIFECYCLE_GRAPHICS_STATES,
  encodePlantLifecyclePresentationState,
  encodeSeedLifecyclePresentationState,
  prepareBotanicalLifecycleGraphicsAuditFixture,
  type BotanicalLifecycleGraphicsPoint,
  type BotanicalLifecycleGraphicsRect,
} from './botanical-lifecycle-graphics-audit';

describe('SEED and PLNT lifecycle graphics audit', () => {
  it('encodes the exact bounded native lifecycle words', () => {
    expect(SEED_PRESENTATION_STATE.waterMask).toBe(0x00ff);
    expect(SEED_PRESENTATION_STATE.germinationMask).toBe(0xff00);
    expect(PLNT_PRESENTATION_STATE.presentMask).toBe(0x8000);
    expect(PLNT_PRESENTATION_STATE.inheritedColourMask).toBe(0x0fc0);
    expect(encodeSeedLifecyclePresentationState(0, 0)).toBe(0x0000);
    expect(encodeSeedLifecyclePresentationState(2, 0)).toBe(0x0002);
    expect(encodeSeedLifecyclePresentationState(8, 64)).toBe(0x4008);
    expect(encodeSeedLifecyclePresentationState(31, 200)).toBe(0xc81f);
    expect(encodeSeedLifecyclePresentationState(-8, -4)).toBe(0x0000);
    expect(encodeSeedLifecyclePresentationState(999, 999)).toBe(0xffff);

    expect(encodePlantLifecyclePresentationState(false, 0, 0, 0, 0, false))
      .toBe(0x8000);
    expect(encodePlantLifecyclePresentationState(true, 0, 4, 21, 1, true))
      .toBe(0xd561);
    expect(encodePlantLifecyclePresentationState(true, 1, 6, 16, 2, true))
      .toBe(0xe433);
    expect(encodePlantLifecyclePresentationState(true, 3, 1, 4, 3, false))
      .toBe(0xb10f);
    expect(encodePlantLifecyclePresentationState(true, 99, 99, 99, 99, true))
      .toBe(0xffff);

    expect(BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS.map(({ encodedState }) => encodedState))
      .toEqual([0x0000, 0x0002, 0x4008, 0xc81f, 0x8000, 0xd561, 0xe433, 0xb10f]);
  });

  it('lays out four SEED and four PLNT cards inside the canonical world', () => {
    expect(BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS).toHaveLength(
      BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS_COLUMNS
        * BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS_ROWS,
    );
    expect(BOTANICAL_LIFECYCLE_GRAPHICS_AUDIT.seedCards).toHaveLength(4);
    expect(BOTANICAL_LIFECYCLE_GRAPHICS_AUDIT.plantCards).toHaveLength(4);
    expect(BOTANICAL_LIFECYCLE_GRAPHICS_AUDIT.cards.map(({ key }) => key))
      .toEqual(BOTANICAL_LIFECYCLE_GRAPHICS_STATES.map(({ key }) => key));
    expect(BOTANICAL_LIFECYCLE_GRAPHICS_AUDIT.cards.map(({ code }) => code))
      .toEqual(['SEED', 'SEED', 'SEED', 'SEED', 'PLNT', 'PLNT', 'PLNT', 'PLNT']);

    for (const [index, entry] of BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS.entries()) {
      expect(entry.index).toBe(index);
      expect(rectInside(entry.card, { x: 0, y: 0, width: 612, height: 384 })).toBe(true);
      for (const rect of [
        entry.body, entry.surfaceProbe, entry.coreProbe, entry.lifecycleProbe,
        entry.authoredHole, entry.openNotch, entry.thinStructure, entry.zeroState,
        entry.wrongOwner, entry.waterControl, entry.sandControl, entry.guardedBlank,
      ]) expect(rectInside(rect, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(rectInside(entry.authoredHole, entry.body)).toBe(true);
      expect(rectInside(entry.openNotch, entry.body)).toBe(true);
      expect(entry.openNotch.x + entry.openNotch.width).toBe(entry.body.x + entry.body.width);
      expect(entry.thinStructure.width).toBe(1);
    }
    for (let left = 0; left < BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS.length; left++) {
      for (let right = left + 1; right < BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS.length; right++) {
        expect(rectanglesOverlap(
          BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS[left].card,
          BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS[right].card,
        )).toBe(false);
      }
    }
  });

  it('builds exact ownership and lifecycle state while preserving every control', () => {
    const simulation = new RenderLabBackend();
    prepareBotanicalLifecycleGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    const state = simulation.presentationState();

    for (const entry of BOTANICAL_LIFECYCLE_GRAPHICS_ATLAS) {
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
      expectExactRect(simulation, entry.wrongOwner, Material.Metal, entry.encodedState);
      expectExactRect(simulation, entry.waterControl, Material.Water, entry.encodedState);
      expectExactRect(simulation, entry.sandControl, Material.Sand, entry.encodedState);
      expectExactRect(simulation, entry.guardedBlank, Material.Empty, 0);
    }

    expect(BOTANICAL_LIFECYCLE_GRAPHICS_AUDIT.authoredHoles).toHaveLength(8 * 36);
    expect(BOTANICAL_LIFECYCLE_GRAPHICS_AUDIT.openNotches).toHaveLength(8 * 64);
    expect(BOTANICAL_LIFECYCLE_GRAPHICS_AUDIT.thinStructures).toHaveLength(8 * 24);
    expect(BOTANICAL_LIFECYCLE_GRAPHICS_AUDIT.isolated).toHaveLength(8);
    expect(BOTANICAL_LIFECYCLE_GRAPHICS_AUDIT.zeroStates).toHaveLength(8);
    expect(BOTANICAL_LIFECYCLE_GRAPHICS_AUDIT.wrongOwners).toHaveLength(8);
    expect(BOTANICAL_LIFECYCLE_GRAPHICS_AUDIT.waterControls).toHaveLength(8);
    expect(BOTANICAL_LIFECYCLE_GRAPHICS_AUDIT.sandControls).toHaveLength(8);
    expect(BOTANICAL_LIFECYCLE_GRAPHICS_AUDIT.guardedBlanks).toHaveLength(8);
  });

  it('is deterministic and rejects non-canonical or state-less backends', () => {
    const first = new RenderLabBackend();
    const second = new RenderLabBackend();
    prepareBotanicalLifecycleGraphicsAuditFixture(first);
    prepareBotanicalLifecycleGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());
    expect(first.presentationState()).toEqual(second.presentationState());

    expect(() => prepareBotanicalLifecycleGraphicsAuditFixture(new RenderLabBackend(32, 32)))
      .toThrow('requires 612x384');
    expect(() => prepareBotanicalLifecycleGraphicsAuditFixture(
      new DeterministicBackend(612, 384),
    )).toThrow('requires a render-lab state plane');
  });
});

function expectExactRect(
  simulation: RenderLabBackend,
  rect: BotanicalLifecycleGraphicsRect,
  material: Material,
  expectedState: number,
): void {
  visitRect(rect, (point) => expectExactPoint(simulation, point, material, expectedState));
}

function expectExactPoint(
  simulation: RenderLabBackend,
  point: BotanicalLifecycleGraphicsPoint,
  material: Material,
  expectedState: number,
): void {
  const offset = point.y * simulation.width + point.x;
  expect(simulation.cells()[offset]).toBe(material);
  expect(simulation.presentationState()[offset]).toBe(expectedState);
}

function pointInside(
  point: BotanicalLifecycleGraphicsPoint,
  rect: BotanicalLifecycleGraphicsRect,
): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function rectInside(
  inner: BotanicalLifecycleGraphicsRect,
  outer: BotanicalLifecycleGraphicsRect,
): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(
  left: BotanicalLifecycleGraphicsRect,
  right: BotanicalLifecycleGraphicsRect,
): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

function visitRect(
  rect: BotanicalLifecycleGraphicsRect,
  visit: (point: BotanicalLifecycleGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
