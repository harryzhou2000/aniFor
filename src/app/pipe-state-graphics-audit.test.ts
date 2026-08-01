import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import { PIPE_PRESENTATION_STATE } from '../simulation/types';
import {
  encodePipePresentationState,
  PIPE_STATE_GRAPHICS_ATLAS,
  PIPE_STATE_GRAPHICS_ATLAS_COLUMNS,
  PIPE_STATE_GRAPHICS_ATLAS_ROWS,
  PIPE_STATE_GRAPHICS_AUDIT,
  preparePipeStateGraphicsAuditFixture,
  type PipeStateGraphicsPoint,
  type PipeStateGraphicsRect,
} from './pipe-state-graphics-audit';

describe('PIPE/PPIP transport-state graphics audit', () => {
  it('packs public payload, explicit presence, routes, and PPIP pause independently', () => {
    expect(encodePipePresentationState({ payload: 2, payloadPresent: true, route: 1, paused: false }))
      .toBe(0x0302);
    expect(encodePipePresentationState({ payload: 255, payloadPresent: true, route: 3, paused: true }))
      .toBe(0x0fff);
    expect(encodePipePresentationState({ payload: -3, payloadPresent: false, route: -2, paused: false }))
      .toBe(0);
    expect(encodePipePresentationState({ payload: 999, payloadPresent: false, route: 99, paused: false }))
      .toBe(PIPE_PRESENTATION_STATE.payloadMask | PIPE_PRESENTATION_STATE.routeMask);
  });

  it('lays out five non-overlapping transport cards and all four empty routes', () => {
    expect(PIPE_STATE_GRAPHICS_ATLAS).toHaveLength(
      PIPE_STATE_GRAPHICS_ATLAS_COLUMNS * PIPE_STATE_GRAPHICS_ATLAS_ROWS,
    );
    expect(PIPE_STATE_GRAPHICS_ATLAS.map(({ stateKey }) => stateKey))
      .toEqual(['liquid', 'gas', 'granular', 'rigid', 'unknown']);
    expect(PIPE_STATE_GRAPHICS_ATLAS.slice(0, 4).map(({ emptyRouteState }) =>
      (emptyRouteState & PIPE_PRESENTATION_STATE.routeMask) >>> PIPE_PRESENTATION_STATE.routeShift,
    )).toEqual([0, 1, 2, 3]);

    for (const entry of PIPE_STATE_GRAPHICS_ATLAS) {
      expect(rectInside(entry.card, { x: 0, y: 0, width: 612, height: 384 })).toBe(true);
      for (const rect of [
        entry.body, entry.responseProbe, entry.authoredHole, entry.openNotch, entry.thinStructure,
        entry.emptyRoute, entry.pausedPpip, entry.wrongOwner, entry.wallCoexistence, entry.guardedBlank,
      ]) expect(rectInside(rect, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(rectInside(entry.authoredHole, entry.body)).toBe(true);
      expect(rectInside(entry.openNotch, entry.body)).toBe(true);
    }
    for (let left = 0; left < PIPE_STATE_GRAPHICS_ATLAS.length; left += 1) {
      for (let right = left + 1; right < PIPE_STATE_GRAPHICS_ATLAS.length; right += 1) {
        expect(rectanglesOverlap(PIPE_STATE_GRAPHICS_ATLAS[left].card, PIPE_STATE_GRAPHICS_ATLAS[right].card)).toBe(false);
      }
    }
  });

  it('keeps PIPE/PPIP ownership, native-state controls, and co-located walls separate', () => {
    const simulation = new RenderLabBackend();
    preparePipeStateGraphicsAuditFixture(simulation);
    for (const entry of PIPE_STATE_GRAPHICS_ATLAS) {
      visitRect(entry.body, (point) => {
        const inAir = pointInside(point, entry.authoredHole) || pointInside(point, entry.openNotch);
        expectExactPoint(simulation, point, inAir ? Material.Empty : Material.PIPE,
          inAir ? 0 : entry.encodedState);
      });
      expectExactRect(simulation, entry.thinStructure, Material.PIPE, entry.encodedState);
      expectExactPoint(simulation, entry.isolated, Material.PIPE, entry.encodedState);
      expectExactRect(simulation, entry.emptyRoute, Material.PIPE, entry.emptyRouteState);
      expectExactRect(simulation, entry.pausedPpip, Material.PPIP, entry.pausedPpipState);
      expectExactRect(simulation, entry.wrongOwner, Material.Water, entry.encodedState);
      expectExactRect(simulation, entry.wallCoexistence, Material.PIPE, entry.encodedState);
      visitRect(entry.wallCoexistence, ({ x, y }) => expect(simulation.walls()[y * simulation.width + x]).toBe(1));
      expectExactRect(simulation, entry.guardedBlank, Material.Empty, 0);
    }
    expect(PIPE_STATE_GRAPHICS_AUDIT.authoredHoles).toHaveLength(5 * 36);
    expect(PIPE_STATE_GRAPHICS_AUDIT.openNotches).toHaveLength(5 * 64);
    expect(PIPE_STATE_GRAPHICS_AUDIT.emptyRoutes).toHaveLength(5);
    expect(PIPE_STATE_GRAPHICS_AUDIT.pausedPpip).toHaveLength(5);
  });

  it('is deterministic and rejects non-canonical or state-less backends', () => {
    const first = new RenderLabBackend();
    const second = new RenderLabBackend();
    preparePipeStateGraphicsAuditFixture(first);
    preparePipeStateGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());
    expect(first.presentationState()).toEqual(second.presentationState());
    expect(first.walls()).toEqual(second.walls());
    expect(() => preparePipeStateGraphicsAuditFixture(new RenderLabBackend(32, 32))).toThrow('requires 612x384');
    expect(() => preparePipeStateGraphicsAuditFixture(new DeterministicBackend(612, 384)))
      .toThrow('requires render-lab state and wall planes');
  });
});

function expectExactRect(simulation: RenderLabBackend, rect: PipeStateGraphicsRect, material: Material, state: number): void {
  visitRect(rect, (point) => expectExactPoint(simulation, point, material, state));
}

function expectExactPoint(simulation: RenderLabBackend, point: PipeStateGraphicsPoint, material: Material, state: number): void {
  const offset = point.y * simulation.width + point.x;
  expect(simulation.cells()[offset]).toBe(material);
  expect(simulation.presentationState()[offset]).toBe(state);
}

function pointInside(point: PipeStateGraphicsPoint, rect: PipeStateGraphicsRect): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width && point.y >= rect.y && point.y < rect.y + rect.height;
}
function rectInside(inner: PipeStateGraphicsRect, outer: PipeStateGraphicsRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}
function rectanglesOverlap(left: PipeStateGraphicsRect, right: PipeStateGraphicsRect): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}
function visitRect(rect: PipeStateGraphicsRect, visit: (point: PipeStateGraphicsPoint) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) visit({ x, y });
  }
}
