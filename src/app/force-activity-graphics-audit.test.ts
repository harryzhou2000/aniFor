import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  FORCE_ACTIVITY_ACTIVE_STATE,
  FORCE_ACTIVITY_GRAPHICS_ATLAS,
  FORCE_ACTIVITY_GRAPHICS_ATLAS_COLUMNS,
  FORCE_ACTIVITY_GRAPHICS_ATLAS_ROWS,
  FORCE_ACTIVITY_GRAPHICS_AUDIT,
  FORCE_ACTIVITY_GRAPHICS_STATES,
  FORCE_ACTIVITY_INACTIVE_STATE,
  prepareForceActivityGraphicsAuditFixture,
  type ForceActivityGraphicsPoint,
  type ForceActivityGraphicsRect,
} from './force-activity-graphics-audit';

describe('ACEL/DCEL activity-state graphics audit', () => {
  it('defines one exact inactive and active state for both owners', () => {
    expect(FORCE_ACTIVITY_INACTIVE_STATE).toBe(0);
    expect(FORCE_ACTIVITY_ACTIVE_STATE).toBe(1);
    expect(FORCE_ACTIVITY_GRAPHICS_STATES).toEqual([
      { key: 'inactive', active: false, encodedState: 0 },
      { key: 'active', active: true, encodedState: 1 },
    ]);
    expect(FORCE_ACTIVITY_GRAPHICS_AUDIT.acelCards.map(({ encodedState }) => encodedState))
      .toEqual([0, 1]);
    expect(FORCE_ACTIVITY_GRAPHICS_AUDIT.dcelCards.map(({ encodedState }) => encodedState))
      .toEqual([0, 1]);
  });

  it('lays out a motif-aligned four-card atlas inside the canonical world', () => {
    expect(FORCE_ACTIVITY_GRAPHICS_ATLAS).toHaveLength(
      FORCE_ACTIVITY_GRAPHICS_ATLAS_COLUMNS * FORCE_ACTIVITY_GRAPHICS_ATLAS_ROWS,
    );
    expect(FORCE_ACTIVITY_GRAPHICS_AUDIT.inactiveCards).toHaveLength(2);
    expect(FORCE_ACTIVITY_GRAPHICS_AUDIT.activeCards).toHaveLength(2);

    for (const [index, entry] of FORCE_ACTIVITY_GRAPHICS_ATLAS.entries()) {
      expect(entry.index).toBe(index);
      expect(rectInside(entry.card, { x: 0, y: 0, width: 612, height: 384 })).toBe(true);
      for (const rect of [
        entry.body, entry.surfaceProbe, entry.coreProbe, entry.motifAxisProbe,
        entry.motifArrowProbe, entry.motifBackgroundProbe, entry.authoredHole,
        entry.openNotch, entry.thinStructure, entry.wrongOwner, entry.waterControl,
        entry.metalControl, entry.emitter, entry.guardedBlank,
      ]) expect(rectInside(rect, entry.card)).toBe(true);
      for (const probe of [
        entry.surfaceProbe, entry.coreProbe, entry.motifAxisProbe,
        entry.motifArrowProbe, entry.motifBackgroundProbe,
      ]) {
        expect(rectInside(probe, entry.body)).toBe(true);
        expect(rectanglesOverlap(probe, entry.authoredHole)).toBe(false);
        expect(rectanglesOverlap(probe, entry.openNotch)).toBe(false);
      }
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(rectInside(entry.authoredHole, entry.body)).toBe(true);
      expect(rectInside(entry.openNotch, entry.body)).toBe(true);
      expect(entry.openNotch.x + entry.openNotch.width).toBe(entry.body.x + entry.body.width);
      expect(entry.thinStructure.width).toBe(1);
    }

    const [acelInactive, acelActive, dcelInactive, dcelActive] = FORCE_ACTIVITY_GRAPHICS_ATLAS;
    expect(acelActive.card.x - acelInactive.card.x).toBe(296);
    expect(dcelInactive.card.y - acelInactive.card.y).toBe(184);
    expect(acelActive.card.x % 8).toBe(acelInactive.card.x % 8);
    expect(dcelInactive.card.y % 8).toBe(acelInactive.card.y % 8);
    expect(dcelActive.material).toBe(Material.DCEL);

    for (let left = 0; left < FORCE_ACTIVITY_GRAPHICS_ATLAS.length; left++) {
      for (let right = left + 1; right < FORCE_ACTIVITY_GRAPHICS_ATLAS.length; right++) {
        expect(rectanglesOverlap(
          FORCE_ACTIVITY_GRAPHICS_ATLAS[left].card,
          FORCE_ACTIVITY_GRAPHICS_ATLAS[right].card,
        )).toBe(false);
      }
    }
  });

  it('builds exact owner/state topology and active-state no-op controls', () => {
    const simulation = new RenderLabBackend();
    prepareForceActivityGraphicsAuditFixture(simulation);

    for (const entry of FORCE_ACTIVITY_GRAPHICS_ATLAS) {
      visitRect(entry.body, (point) => {
        const authoredAir = pointInside(point, entry.authoredHole)
          || pointInside(point, entry.openNotch);
        expectExactPoint(
          simulation,
          point,
          authoredAir ? Material.Empty : entry.material,
          authoredAir ? 0 : entry.encodedState,
        );
      });
      expectExactRect(simulation, entry.thinStructure, entry.material, entry.encodedState);
      expectExactPoint(simulation, entry.isolated, entry.material, entry.encodedState);
      expectExactRect(simulation, entry.wrongOwner, Material.Sand, 1);
      expectExactRect(simulation, entry.waterControl, Material.Water, 1);
      expectExactRect(simulation, entry.metalControl, Material.Metal, 1);
      expectExactRect(simulation, entry.emitter, Material.Fire, 0);
      expectExactRect(simulation, entry.guardedBlank, Material.Empty, 0);
    }

    expect(FORCE_ACTIVITY_GRAPHICS_AUDIT.authoredHoles).toHaveLength(4 * 36);
    expect(FORCE_ACTIVITY_GRAPHICS_AUDIT.openNotches).toHaveLength(4 * 96);
    expect(FORCE_ACTIVITY_GRAPHICS_AUDIT.thinStructures).toHaveLength(4 * 24);
    expect(FORCE_ACTIVITY_GRAPHICS_AUDIT.isolated).toHaveLength(4);
    expect(FORCE_ACTIVITY_GRAPHICS_AUDIT.wrongOwners).toHaveLength(4);
    expect(FORCE_ACTIVITY_GRAPHICS_AUDIT.waterControls).toHaveLength(4);
    expect(FORCE_ACTIVITY_GRAPHICS_AUDIT.metalControls).toHaveLength(4);
    expect(FORCE_ACTIVITY_GRAPHICS_AUDIT.emitters).toHaveLength(4);
    expect(FORCE_ACTIVITY_GRAPHICS_AUDIT.guardedBlanks).toHaveLength(4);
  });

  it('is deterministic and rejects non-canonical or state-less backends', () => {
    const first = new RenderLabBackend();
    const second = new RenderLabBackend();
    prepareForceActivityGraphicsAuditFixture(first);
    prepareForceActivityGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());
    expect(first.presentationState()).toEqual(second.presentationState());

    expect(() => prepareForceActivityGraphicsAuditFixture(new RenderLabBackend(32, 32)))
      .toThrow('requires 612x384');
    expect(() => prepareForceActivityGraphicsAuditFixture(new DeterministicBackend(612, 384)))
      .toThrow('requires a render-lab state plane');
  });

  it('preserves the pre-migration public snapshot and exact authored planes', () => {
    const simulation = new RenderLabBackend();
    prepareForceActivityGraphicsAuditFixture(simulation);
    const stateBytes = Buffer.alloc(simulation.presentationState().byteLength);
    simulation.presentationState().forEach((value, index) => stateBytes.writeUInt16LE(value, index * 2));
    expect(digest(JSON.stringify(FORCE_ACTIVITY_GRAPHICS_AUDIT))).toBe(
      '06dbefefa8746fd6e6d14e5781c36c11e77bdbd77d1feeddf2aa779d4a8cd0f2',
    );
    expect(digest(simulation.cells())).toBe(
      'c55c8b8d4a034bb64636ca48ca5d90eae786e8c9b7c2f3ca004f3d778f054b4d',
    );
    expect(digest(stateBytes)).toBe(
      '0b3cca7c06e0cb1c9b4b258c88a71480639a2a535bbba6f17231098b17956dba',
    );
  });
});

function digest(value: string | NodeJS.ArrayBufferView): string {
  return createHash('sha256').update(value).digest('hex');
}

function expectExactRect(
  simulation: RenderLabBackend,
  rect: ForceActivityGraphicsRect,
  material: Material,
  expectedState: number,
): void {
  visitRect(rect, (point) => expectExactPoint(simulation, point, material, expectedState));
}

function expectExactPoint(
  simulation: RenderLabBackend,
  point: ForceActivityGraphicsPoint,
  material: Material,
  expectedState: number,
): void {
  const offset = point.y * simulation.width + point.x;
  expect(simulation.cells()[offset]).toBe(material);
  expect(simulation.presentationState()[offset]).toBe(expectedState);
}

function pointInside(point: ForceActivityGraphicsPoint, rect: ForceActivityGraphicsRect): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function rectInside(inner: ForceActivityGraphicsRect, outer: ForceActivityGraphicsRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(left: ForceActivityGraphicsRect, right: ForceActivityGraphicsRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}

function visitRect(
  rect: ForceActivityGraphicsRect,
  visit: (point: ForceActivityGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visit({ x, y });
  }
}
