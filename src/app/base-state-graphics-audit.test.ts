import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import { BASE_PRESENTATION_STATE } from '../simulation/types';
import {
  BASE_CONCENTRATION_MAXIMUM,
  BASE_STATE_GRAPHICS_ATLAS,
  BASE_STATE_GRAPHICS_ATLAS_COLUMNS,
  BASE_STATE_GRAPHICS_ATLAS_ROWS,
  BASE_STATE_GRAPHICS_AUDIT,
  BASE_STATE_GRAPHICS_STATES,
  encodeBasePresentationState,
  prepareBaseStateGraphicsAuditFixture,
  type BaseStateGraphicsPoint,
  type BaseStateGraphicsRect,
} from './base-state-graphics-audit';

describe('BASE concentration-state graphics audit', () => {
  it('packs exact native concentration and the independent spark bit', () => {
    expect(BASE_CONCENTRATION_MAXIMUM).toBe(100);
    expect(encodeBasePresentationState(-4.8)).toBe(0);
    expect(encodeBasePresentationState(25.6)).toBe(26);
    expect(encodeBasePresentationState(100)).toBe(100);
    expect(encodeBasePresentationState(999, true)).toBe(
      BASE_PRESENTATION_STATE.sparkMask | 100,
    );
    expect(BASE_STATE_GRAPHICS_STATES.map(({ concentration, spark }) => [concentration, spark]))
      .toEqual([[0, false], [25, false], [50, false], [76, false], [100, false], [76, true]]);
    expect(BASE_STATE_GRAPHICS_ATLAS.map(({ encodedState }) => encodedState)).toEqual([
      encodeBasePresentationState(0),
      encodeBasePresentationState(25),
      encodeBasePresentationState(50),
      encodeBasePresentationState(76),
      encodeBasePresentationState(100),
      encodeBasePresentationState(76, true),
    ]);
  });

  it('lays out six non-overlapping BASE cards inside the canonical world', () => {
    expect(BASE_STATE_GRAPHICS_ATLAS).toHaveLength(
      BASE_STATE_GRAPHICS_ATLAS_COLUMNS * BASE_STATE_GRAPHICS_ATLAS_ROWS,
    );
    expect(BASE_STATE_GRAPHICS_AUDIT.cards.map(({ key }) => key))
      .toEqual(BASE_STATE_GRAPHICS_STATES.map(({ key }) => key));

    for (const [index, entry] of BASE_STATE_GRAPHICS_ATLAS.entries()) {
      expect(entry.index).toBe(index);
      expect(entry.encodedState & BASE_PRESENTATION_STATE.concentrationMask)
        .toBe(entry.concentration);
      expect(Boolean(entry.encodedState & BASE_PRESENTATION_STATE.sparkMask)).toBe(entry.spark);
      expect(rectInside(entry.card, { x: 0, y: 0, width: 612, height: 384 })).toBe(true);
      for (const rect of [
        entry.body, entry.surfaceProbe, entry.coreProbe, entry.concentrationProbe, entry.sparkProbe,
        entry.authoredHole, entry.openNotch, entry.thinStrand, entry.zeroConcentration,
        entry.wrongOwner, entry.waterControl, entry.acidControl, entry.causControl,
        entry.saltWaterControl, entry.oilControl, entry.soapControl, entry.gelControl,
        entry.metalControl, entry.bmtlControl, entry.boylControl, entry.guardedBlank,
        entry.nativeWallControl,
      ]) expect(rectInside(rect, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(rectInside(entry.authoredHole, entry.body)).toBe(true);
      expect(rectInside(entry.openNotch, entry.body)).toBe(true);
      expect(entry.openNotch.x + entry.openNotch.width).toBe(entry.body.x + entry.body.width);
      expect(entry.thinStrand.width).toBe(1);
    }
    for (let left = 0; left < BASE_STATE_GRAPHICS_ATLAS.length; left++) {
      for (let right = left + 1; right < BASE_STATE_GRAPHICS_ATLAS.length; right++) {
        expect(rectanglesOverlap(
          BASE_STATE_GRAPHICS_ATLAS[left].card,
          BASE_STATE_GRAPHICS_ATLAS[right].card,
        )).toBe(false);
      }
    }
  });

  it('builds exact BASE ownership, state, topology, and foreign-owner controls', () => {
    const simulation = new RenderLabBackend();
    prepareBaseStateGraphicsAuditFixture(simulation);
    const zeroConcentration = encodeBasePresentationState(0);

    for (const entry of BASE_STATE_GRAPHICS_ATLAS) {
      visitRect(entry.body, (point) => {
        const offset = point.y * simulation.width + point.x;
        const authoredAir = pointInside(point, entry.authoredHole)
          || pointInside(point, entry.openNotch);
        expect(simulation.cells()[offset]).toBe(authoredAir ? Material.Empty : Material.BASE);
        expect(simulation.presentationState()[offset]).toBe(authoredAir ? 0 : entry.encodedState);
      });
      expectExactRect(simulation, entry.thinStrand, Material.BASE, entry.encodedState);
      expectExactPoint(simulation, entry.isolated, Material.BASE, entry.encodedState);
      expectExactRect(simulation, entry.zeroConcentration, Material.BASE, zeroConcentration);
      expectExactRect(simulation, entry.wrongOwner, Material.Sand, entry.encodedState);
      expectExactRect(simulation, entry.waterControl, Material.Water, entry.encodedState);
      expectExactRect(simulation, entry.acidControl, Material.Acid, entry.encodedState);
      expectExactRect(simulation, entry.causControl, Material.CAUS, entry.encodedState);
      expectExactRect(simulation, entry.saltWaterControl, Material.SaltWater, entry.encodedState);
      expectExactRect(simulation, entry.oilControl, Material.Oil, entry.encodedState);
      expectExactRect(simulation, entry.soapControl, Material.Soap, entry.encodedState);
      expectExactRect(simulation, entry.gelControl, Material.GEL, entry.encodedState);
      expectExactRect(simulation, entry.metalControl, Material.Metal, entry.encodedState);
      expectExactRect(simulation, entry.bmtlControl, Material.BMTL, entry.encodedState);
      expectExactRect(simulation, entry.boylControl, Material.BOYL, entry.encodedState);
      expectExactRect(simulation, entry.nativeWallControl, Material.BASE, entry.encodedState);
      visitRect(entry.nativeWallControl, (point) => {
        expect(simulation.walls()[point.y * simulation.width + point.x]).toBe(8);
      });
      expectExactRect(simulation, entry.guardedBlank, Material.Empty, 0);
    }

    expect(BASE_STATE_GRAPHICS_AUDIT.authoredHoles).toHaveLength(6 * 36);
    expect(BASE_STATE_GRAPHICS_AUDIT.openNotches).toHaveLength(6 * 64);
    expect(BASE_STATE_GRAPHICS_AUDIT.thinStrands).toHaveLength(6 * 30);
    expect(BASE_STATE_GRAPHICS_AUDIT.isolated).toHaveLength(6);
    expect(BASE_STATE_GRAPHICS_AUDIT.zeroConcentrations).toHaveLength(6);
    expect(BASE_STATE_GRAPHICS_AUDIT.wrongOwners).toHaveLength(6);
    expect(BASE_STATE_GRAPHICS_AUDIT.waterControls).toHaveLength(6);
    expect(BASE_STATE_GRAPHICS_AUDIT.acidControls).toHaveLength(6);
    expect(BASE_STATE_GRAPHICS_AUDIT.causControls).toHaveLength(6);
    expect(BASE_STATE_GRAPHICS_AUDIT.saltWaterControls).toHaveLength(6);
    expect(BASE_STATE_GRAPHICS_AUDIT.oilControls).toHaveLength(6);
    expect(BASE_STATE_GRAPHICS_AUDIT.soapControls).toHaveLength(6);
    expect(BASE_STATE_GRAPHICS_AUDIT.gelControls).toHaveLength(6);
    expect(BASE_STATE_GRAPHICS_AUDIT.metalControls).toHaveLength(6);
    expect(BASE_STATE_GRAPHICS_AUDIT.bmtlControls).toHaveLength(6);
    expect(BASE_STATE_GRAPHICS_AUDIT.boylControls).toHaveLength(6);
    expect(BASE_STATE_GRAPHICS_AUDIT.nativeWallControls).toHaveLength(6);
    expect(BASE_STATE_GRAPHICS_AUDIT.guardedBlanks).toHaveLength(6);
  });

  it('is deterministic and rejects non-canonical or state-less backends', () => {
    const first = new RenderLabBackend();
    const second = new RenderLabBackend();
    prepareBaseStateGraphicsAuditFixture(first);
    prepareBaseStateGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());
    expect(first.presentationState()).toEqual(second.presentationState());

    expect(() => prepareBaseStateGraphicsAuditFixture(new RenderLabBackend(32, 32)))
      .toThrow('requires 612x384');
    expect(() => prepareBaseStateGraphicsAuditFixture(new DeterministicBackend(612, 384)))
      .toThrow('requires a render-lab state plane');
  });
});

function expectExactRect(
  simulation: RenderLabBackend,
  rect: BaseStateGraphicsRect,
  material: Material,
  expectedState: number,
): void {
  visitRect(rect, (point) => expectExactPoint(simulation, point, material, expectedState));
}

function expectExactPoint(
  simulation: RenderLabBackend,
  point: BaseStateGraphicsPoint,
  material: Material,
  expectedState: number,
): void {
  const offset = point.y * simulation.width + point.x;
  expect(simulation.cells()[offset]).toBe(material);
  expect(simulation.presentationState()[offset]).toBe(expectedState);
}

function pointInside(point: BaseStateGraphicsPoint, rect: BaseStateGraphicsRect): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function rectInside(inner: BaseStateGraphicsRect, outer: BaseStateGraphicsRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(left: BaseStateGraphicsRect, right: BaseStateGraphicsRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

function visitRect(
  rect: BaseStateGraphicsRect,
  visit: (point: BaseStateGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
