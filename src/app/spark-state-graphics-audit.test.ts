import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import { SPRK_PRESENTATION_STATE } from '../simulation/types';
import {
  SPARK_STATE_GRAPHICS_ATLAS,
  SPARK_STATE_GRAPHICS_ATLAS_COLUMNS,
  SPARK_STATE_GRAPHICS_ATLAS_ROWS,
  SPARK_STATE_GRAPHICS_AUDIT,
  SPARK_STATE_GRAPHICS_STATES,
  encodeSparkPresentationState,
  prepareSparkStateGraphicsAuditFixture,
  type SparkStateGraphicsPoint,
  type SparkStateGraphicsRect,
} from './spark-state-graphics-audit';

describe('SPRK host and lifetime graphics audit', () => {
  it('encodes exact bounded native host and life words', () => {
    expect(SPRK_PRESENTATION_STATE.hostMask).toBe(0x00ff);
    expect(SPRK_PRESENTATION_STATE.lifeShift).toBe(8);
    expect(SPRK_PRESENTATION_STATE.lifeMask).toBe(0x7f00);
    expect(SPRK_PRESENTATION_STATE.presentMask).toBe(0x8000);
    expect(SPRK_PRESENTATION_STATE.lifeMaximum).toBe(0x7f);

    expect(encodeSparkPresentationState(Material.Metal, 4)).toBe(0x8417);
    expect(encodeSparkPresentationState(Material.NSCN, 3)).toBe(0x8390);
    expect(encodeSparkPresentationState(Material.NTCT, 2)).toBe(0x8291);
    expect(encodeSparkPresentationState(Material.ETRD, 1)).toBe(0x818c);
    expect(encodeSparkPresentationState(Material.SWCH, 4)).toBe(0x8495);
    expect(encodeSparkPresentationState(Material.SaltWater, 3)).toBe(0x8310);
    expect(encodeSparkPresentationState(-8 as Material, -4)).toBe(0x8000);
    expect(encodeSparkPresentationState(999 as Material, 999)).toBe(0xffff);

    expect(SPARK_STATE_GRAPHICS_ATLAS.map(({ encodedState }) => encodedState))
      .toEqual([0x8417, 0x8390, 0x8291, 0x818c, 0x8495, 0x8310]);
  });

  it('lays out six conductor-family and life-stage cards inside the canonical world', () => {
    expect(SPARK_STATE_GRAPHICS_ATLAS).toHaveLength(
      SPARK_STATE_GRAPHICS_ATLAS_COLUMNS * SPARK_STATE_GRAPHICS_ATLAS_ROWS,
    );
    expect(SPARK_STATE_GRAPHICS_AUDIT.cards.map(({ key }) => key))
      .toEqual(SPARK_STATE_GRAPHICS_STATES.map(({ key }) => key));
    expect(SPARK_STATE_GRAPHICS_AUDIT.cards.map(({ family }) => family)).toEqual([
      'metallic', 'semiconductor', 'thermal', 'electrode', 'device', 'aqueous',
    ]);
    expect(SPARK_STATE_GRAPHICS_AUDIT.cards.map(({ life }) => life))
      .toEqual([4, 3, 2, 1, 4, 3]);
    expect(SPARK_STATE_GRAPHICS_AUDIT.cards.map(({ hostCode }) => hostCode))
      .toEqual(['METL', 'NSCN', 'NTCT', 'ETRD', 'SWCH', 'SLTW']);

    for (const [index, entry] of SPARK_STATE_GRAPHICS_ATLAS.entries()) {
      expect(entry.index).toBe(index);
      expect(entry.material).toBe(Material.SPRK);
      expect(entry.code).toBe('SPRK');
      expect(rectInside(entry.card, { x: 0, y: 0, width: 612, height: 384 })).toBe(true);
      for (const rect of [
        entry.body, entry.shellProbe, entry.coreProbe, entry.hostProbe,
        entry.authoredHole, entry.openNotch, entry.thinStructure, entry.zeroState,
        entry.unrepresentableHost, entry.wrongOwner, entry.waterControl,
        entry.metalControl, entry.guardedBlank,
      ]) expect(rectInside(rect, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(rectInside(entry.authoredHole, entry.body)).toBe(true);
      expect(rectInside(entry.openNotch, entry.body)).toBe(true);
      expect(entry.openNotch.x + entry.openNotch.width).toBe(entry.body.x + entry.body.width);
      expect(entry.thinStructure.width).toBe(1);
    }

    for (let left = 0; left < SPARK_STATE_GRAPHICS_ATLAS.length; left++) {
      for (let right = left + 1; right < SPARK_STATE_GRAPHICS_ATLAS.length; right++) {
        expect(rectanglesOverlap(
          SPARK_STATE_GRAPHICS_ATLAS[left].card,
          SPARK_STATE_GRAPHICS_ATLAS[right].card,
        )).toBe(false);
      }
    }
  });

  it('builds exact SPRK ownership and state while preserving every control', () => {
    const simulation = new RenderLabBackend();
    prepareSparkStateGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    const state = simulation.presentationState();
    const unrepresentableState = encodeSparkPresentationState(Material.Empty, 4);

    for (const entry of SPARK_STATE_GRAPHICS_ATLAS) {
      visitRect(entry.body, (point) => {
        const offset = point.y * simulation.width + point.x;
        const authoredAir = pointInside(point, entry.authoredHole)
          || pointInside(point, entry.openNotch);
        expect(cells[offset]).toBe(authoredAir ? Material.Empty : Material.SPRK);
        expect(state[offset]).toBe(authoredAir ? 0 : entry.encodedState);
      });
      expectExactRect(
        simulation, entry.thinStructure, Material.SPRK, entry.encodedState,
      );
      expectExactPoint(simulation, entry.isolated, Material.SPRK, entry.encodedState);
      expectExactRect(simulation, entry.zeroState, Material.SPRK, 0);
      expectExactRect(
        simulation, entry.unrepresentableHost, Material.SPRK, unrepresentableState,
      );
      expectExactRect(simulation, entry.wrongOwner, Material.Sand, entry.encodedState);
      expectExactRect(simulation, entry.waterControl, Material.Water, entry.encodedState);
      expectExactRect(simulation, entry.metalControl, Material.Metal, entry.encodedState);
      expectExactRect(simulation, entry.guardedBlank, Material.Empty, 0);
    }

    expect(SPARK_STATE_GRAPHICS_AUDIT.authoredHoles).toHaveLength(6 * 36);
    expect(SPARK_STATE_GRAPHICS_AUDIT.openNotches).toHaveLength(6 * 64);
    expect(SPARK_STATE_GRAPHICS_AUDIT.thinStructures).toHaveLength(6 * 24);
    expect(SPARK_STATE_GRAPHICS_AUDIT.isolated).toHaveLength(6);
    expect(SPARK_STATE_GRAPHICS_AUDIT.zeroStates).toHaveLength(6);
    expect(SPARK_STATE_GRAPHICS_AUDIT.unrepresentableHosts).toHaveLength(6);
    expect(SPARK_STATE_GRAPHICS_AUDIT.wrongOwners).toHaveLength(6);
    expect(SPARK_STATE_GRAPHICS_AUDIT.waterControls).toHaveLength(6);
    expect(SPARK_STATE_GRAPHICS_AUDIT.metalControls).toHaveLength(6);
    expect(SPARK_STATE_GRAPHICS_AUDIT.guardedBlanks).toHaveLength(6);
  });

  it('is deterministic and rejects non-canonical or state-less backends', () => {
    const first = new RenderLabBackend();
    const second = new RenderLabBackend();
    prepareSparkStateGraphicsAuditFixture(first);
    prepareSparkStateGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());
    expect(first.presentationState()).toEqual(second.presentationState());

    expect(() => prepareSparkStateGraphicsAuditFixture(new RenderLabBackend(32, 32)))
      .toThrow('requires 612x384');
    expect(() => prepareSparkStateGraphicsAuditFixture(
      new DeterministicBackend(612, 384),
    )).toThrow('requires a render-lab state plane');
  });
});

function expectExactRect(
  simulation: RenderLabBackend,
  rect: SparkStateGraphicsRect,
  material: Material,
  expectedState: number,
): void {
  visitRect(rect, (point) => expectExactPoint(simulation, point, material, expectedState));
}

function expectExactPoint(
  simulation: RenderLabBackend,
  point: SparkStateGraphicsPoint,
  material: Material,
  expectedState: number,
): void {
  const offset = point.y * simulation.width + point.x;
  expect(simulation.cells()[offset]).toBe(material);
  expect(simulation.presentationState()[offset]).toBe(expectedState);
}

function pointInside(
  point: SparkStateGraphicsPoint,
  rect: SparkStateGraphicsRect,
): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function rectInside(
  inner: SparkStateGraphicsRect,
  outer: SparkStateGraphicsRect,
): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(
  left: SparkStateGraphicsRect,
  right: SparkStateGraphicsRect,
): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

function visitRect(
  rect: SparkStateGraphicsRect,
  visit: (point: SparkStateGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
