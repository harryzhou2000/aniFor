import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { Material } from '../shared/materials';
import { DeterministicBackend } from '../simulation/deterministic-backend';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  encodeSourceTargetPresentationState,
  placeSourceTargetRecoveryProbe,
  prepareSourceTargetGraphicsAuditFixture,
  SOURCE_TARGET_GRAPHICS_ATLAS,
  SOURCE_TARGET_GRAPHICS_ATLAS_COLUMNS,
  SOURCE_TARGET_GRAPHICS_ATLAS_ROWS,
  SOURCE_TARGET_GRAPHICS_AUDIT,
  SOURCE_TARGET_GRAPHICS_OWNERS,
  SOURCE_TARGET_GRAPHICS_TARGETS,
  type SourceTargetGraphicsPoint,
  type SourceTargetGraphicsOwner,
  type SourceTargetGraphicsRect,
} from './source-target-graphics-audit';
import {
  SOURCE_TARGET_MATERIAL_LIGHTING_ATLAS_CATALOG,
} from '../shared/source-target-material-lighting-atlas-catalog.js';

describe('configured-source target-identity graphics audit', () => {
  it('derives the compatibility surface from one deeply frozen catalog', () => {
    const authoring = SOURCE_TARGET_MATERIAL_LIGHTING_ATLAS_CATALOG.atlases[0];
    expect(SOURCE_TARGET_GRAPHICS_ATLAS).toBe(authoring.descriptor.cards);
    expect(SOURCE_TARGET_GRAPHICS_OWNERS).toBe(authoring.descriptor.owners);
    expect(SOURCE_TARGET_GRAPHICS_TARGETS).toBe(authoring.descriptor.targets);
    expect(Object.isFrozen(authoring.descriptor.cards[0].body)).toBe(true);
    expect(Object.isFrozen(authoring.descriptor.inspectionRegions[0])).toBe(true);
    expect(createHash('sha256').update(JSON.stringify(SOURCE_TARGET_GRAPHICS_AUDIT)).digest('hex'))
      .toBe('e2a4427395e9f4b8497524a5632b6c4d710e449b54ce07f5dbeb0dac9729ea54');
  });

  it('preserves the exact pre-migration material, state, and wall planes', () => {
    const simulation = new RenderLabBackend();
    prepareSourceTargetGraphicsAuditFixture(simulation);
    const digest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
    const state = simulation.presentationState();
    const stateLe = new Uint8Array(state.length * 2);
    for (let index = 0; index < state.length; index++) {
      stateLe[index * 2] = state[index] & 0xff;
      stateLe[index * 2 + 1] = state[index] >>> 8;
    }
    expect(digest(simulation.cells())).toBe(
      '53fec1483520f67cef5a8accf579414135732e5789c93e1bb3e497199be0ad07',
    );
    expect(digest(stateLe)).toBe(
      '2645b75d2b6b8a18ea954cd4906934b477c1818f8a1013a12a00bd0754e499e7',
    );
    expect(digest(simulation.walls())).toBe(
      '78c28b9e1ef7016a33f8df4b97804f1e66c40513f2160d5c2597d6152e7b41b5',
    );
  });

  it('transports exact public target IDs without RGB quantization', () => {
    for (const { material } of SOURCE_TARGET_GRAPHICS_TARGETS) {
      expect(encodeSourceTargetPresentationState(material)).toBe(material);
    }
    expect(encodeSourceTargetPresentationState(1)).toBe(1);
    expect(encodeSourceTargetPresentationState(170)).toBe(170);
    expect(encodeSourceTargetPresentationState(217)).toBe(217);
    for (const invalid of [0, 171, 194, 216, 218, 1.5, -1]) {
      expect(() => encodeSourceTargetPresentationState(invalid)).toThrow(RangeError);
    }
  });

  it('lays out the full six-owner by seven-target matrix inside 612x384', () => {
    expect(SOURCE_TARGET_GRAPHICS_ATLAS).toHaveLength(
      SOURCE_TARGET_GRAPHICS_ATLAS_COLUMNS * SOURCE_TARGET_GRAPHICS_ATLAS_ROWS,
    );
    expect(SOURCE_TARGET_GRAPHICS_ATLAS.map(({ owner }) => owner)).toEqual(
      SOURCE_TARGET_GRAPHICS_OWNERS.flatMap(({ material }) =>
        Array(SOURCE_TARGET_GRAPHICS_ATLAS_COLUMNS).fill(material)),
    );
    for (let row = 0; row < SOURCE_TARGET_GRAPHICS_ATLAS_ROWS; row++) {
      expect(SOURCE_TARGET_GRAPHICS_ATLAS
        .slice(row * SOURCE_TARGET_GRAPHICS_ATLAS_COLUMNS, (row + 1) * SOURCE_TARGET_GRAPHICS_ATLAS_COLUMNS)
        .map(({ target }) => target))
        .toEqual(SOURCE_TARGET_GRAPHICS_TARGETS.map(({ material }) => material));
    }

    const world = { x: 0, y: 0, width: 612, height: 384 };
    for (const [index, entry] of SOURCE_TARGET_GRAPHICS_ATLAS.entries()) {
      expect(entry.index).toBe(index);
      expect(entry.row).toBe(Math.floor(index / SOURCE_TARGET_GRAPHICS_ATLAS_COLUMNS));
      expect(entry.column).toBe(index % SOURCE_TARGET_GRAPHICS_ATLAS_COLUMNS);
      expect(entry.encodedState).toBe(entry.target);
      expect(rectInside(entry.card, world)).toBe(true);
      for (const rect of [
        entry.body, entry.ownerShellProbe, entry.targetAccentProbe,
        entry.authoredHole, entry.openNotch, entry.thinStructure,
        entry.zeroState, entry.wrongOwner, entry.targetControl,
        entry.wallCoexistence, entry.guardedBlank,
      ]) expect(rectInside(rect, entry.card)).toBe(true);
      expect(pointInside(entry.isolated, entry.card)).toBe(true);
      expect(rectInside(entry.authoredHole, entry.body)).toBe(true);
      expect(rectInside(entry.openNotch, entry.body)).toBe(true);
      expect(entry.openNotch.x + entry.openNotch.width)
        .toBe(entry.body.x + entry.body.width);
      expect(entry.thinStructure.width).toBe(1);
      expect(entry.wallCoexistence.x % 4).toBe(0);
      expect(entry.wallCoexistence.y % 4).toBe(0);
      expect(entry.wallCoexistence.width % 4).toBe(0);
      expect(entry.wallCoexistence.height % 4).toBe(0);
    }
    for (let left = 0; left < SOURCE_TARGET_GRAPHICS_ATLAS.length; left++) {
      for (let right = left + 1; right < SOURCE_TARGET_GRAPHICS_ATLAS.length; right++) {
        expect(rectanglesOverlap(
          SOURCE_TARGET_GRAPHICS_ATLAS[left].card,
          SOURCE_TARGET_GRAPHICS_ATLAS[right].card,
        )).toBe(false);
      }
    }
  });

  it('builds exact owner, target-state, topology, control, and wall planes', () => {
    const simulation = new RenderLabBackend();
    prepareSourceTargetGraphicsAuditFixture(simulation);
    const cells = simulation.cells();
    const state = simulation.presentationState();

    for (const entry of SOURCE_TARGET_GRAPHICS_ATLAS) {
      visitRect(entry.body, (point) => {
        const offset = point.y * simulation.width + point.x;
        const authoredAir = pointInside(point, entry.authoredHole)
          || pointInside(point, entry.openNotch);
        expect(cells[offset]).toBe(authoredAir ? Material.Empty : entry.owner);
        expect(state[offset]).toBe(authoredAir ? 0 : entry.target);
      });
      expectExactRect(simulation, entry.thinStructure, entry.owner, entry.target, 0);
      expectExactPoint(simulation, entry.isolated, entry.owner, entry.target, 0);
      expectExactRect(simulation, entry.zeroState, entry.owner, 0, 0);
      expectExactRect(
        simulation, entry.wrongOwner,
        entry.target === Material.Sand ? Material.Metal : Material.Sand,
        entry.target, 0,
      );
      expectExactRect(simulation, entry.targetControl, entry.target, entry.target, 0);
      expectExactRect(
        simulation, entry.wallCoexistence, entry.owner, entry.target,
        SOURCE_TARGET_GRAPHICS_AUDIT.conductiveWall,
      );
      expectExactRect(simulation, entry.guardedBlank, Material.Empty, 0, 0);
    }

    expect(SOURCE_TARGET_GRAPHICS_AUDIT.authoredHoles).toHaveLength(42 * 4 * 4);
    expect(SOURCE_TARGET_GRAPHICS_AUDIT.openNotches).toHaveLength(42 * 8 * 6);
    expect(SOURCE_TARGET_GRAPHICS_AUDIT.thinStructures).toHaveLength(42 * 12);
    expect(SOURCE_TARGET_GRAPHICS_AUDIT.isolated).toHaveLength(42);
    expect(SOURCE_TARGET_GRAPHICS_AUDIT.zeroStates).toHaveLength(42);
    expect(SOURCE_TARGET_GRAPHICS_AUDIT.wrongOwners).toHaveLength(42);
    expect(SOURCE_TARGET_GRAPHICS_AUDIT.targetControls).toHaveLength(42);
    expect(SOURCE_TARGET_GRAPHICS_AUDIT.wallCoexistence).toHaveLength(42);
    expect(SOURCE_TARGET_GRAPHICS_AUDIT.guardedBlanks).toHaveLength(42);
  }, 10_000);

  it('is deterministic and rejects incomplete or non-canonical backends', () => {
    const first = new RenderLabBackend();
    const second = new RenderLabBackend();
    prepareSourceTargetGraphicsAuditFixture(first);
    prepareSourceTargetGraphicsAuditFixture(second);
    expect(first.cells()).toEqual(second.cells());
    expect(first.presentationState()).toEqual(second.presentationState());
    expect(first.walls()).toEqual(second.walls());

    expect(() => prepareSourceTargetGraphicsAuditFixture(new RenderLabBackend(32, 32)))
      .toThrow('requires 612x384');
    expect(() => prepareSourceTargetGraphicsAuditFixture(new DeterministicBackend(612, 384)))
      .toThrow('requires render-lab state and wall planes');
  });

  it('adds one bounded recovery probe without clearing existing matter or state', () => {
    const simulation = new RenderLabBackend();
    simulation.paint(20, 20, Material.Sand, 0);
    simulation.setFixturePresentationState(20, 20, 99);

    placeSourceTargetRecoveryProbe(simulation, 500, 300);
    expectExactPoint(simulation, { x: 500, y: 300 }, Material.CLNE, Material.BCOL, 0);
    expectExactPoint(simulation, { x: 20, y: 20 }, Material.Sand, 99, 0);

    placeSourceTargetRecoveryProbe(
      simulation, 501, 300, Material.CONV, Material.Water,
    );
    expectExactPoint(simulation, { x: 501, y: 300 }, Material.CONV, Material.Water, 0);

    expect(() => placeSourceTargetRecoveryProbe(simulation, -1, 20)).toThrow(RangeError);
    expect(() => placeSourceTargetRecoveryProbe(simulation, 612, 20)).toThrow(RangeError);
    expect(() => placeSourceTargetRecoveryProbe(
      simulation, 10, 10, Material.Sand as SourceTargetGraphicsOwner,
    )).toThrow('Invalid configured-source owner');
    expect(() => placeSourceTargetRecoveryProbe(
      new DeterministicBackend(612, 384), 10, 10,
    )).toThrow('requires a render-lab state plane');
  });
});

function expectExactRect(
  simulation: RenderLabBackend,
  rect: SourceTargetGraphicsRect,
  material: Material,
  expectedState: number,
  expectedWall: number,
): void {
  visitRect(rect, (point) => expectExactPoint(
    simulation, point, material, expectedState, expectedWall,
  ));
}

function expectExactPoint(
  simulation: RenderLabBackend,
  point: SourceTargetGraphicsPoint,
  material: Material,
  expectedState: number,
  expectedWall: number,
): void {
  const offset = point.y * simulation.width + point.x;
  expect(simulation.cells()[offset]).toBe(material);
  expect(simulation.presentationState()[offset]).toBe(expectedState);
  expect(simulation.walls()[offset]).toBe(expectedWall);
}

function visitRect(
  rect: SourceTargetGraphicsRect,
  visitor: (point: SourceTargetGraphicsPoint) => void,
): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) visitor({ x, y });
  }
}

function pointInside(
  point: SourceTargetGraphicsPoint,
  rect: SourceTargetGraphicsRect,
): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function rectInside(
  inner: SourceTargetGraphicsRect,
  outer: SourceTargetGraphicsRect,
): boolean {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function rectanglesOverlap(
  left: SourceTargetGraphicsRect,
  right: SourceTargetGraphicsRect,
): boolean {
  return left.x < right.x + right.width && right.x < left.x + left.width
    && left.y < right.y + right.height && right.y < left.y + left.height;
}
