import { describe, expect, it } from 'vitest';
import { LiquidDensityField } from '../renderer/liquid-density-field';
import { createRenderLookups } from '../renderer/render-field-set';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { RenderLabBackend } from '../simulation/render-lab-backend';
import {
  DEUT_STATE_GRAPHICS_AUDIT,
  prepareDeutStateGraphicsAuditFixture,
} from './deut-state-graphics-audit';
import { DEUT_BODY_VFX_AUDIT, prepareDeutBodyVfxAuditFixture } from './deut-body-vfx-audit';

const WIDTH = 612;
const HEIGHT = 384;

describe('DEUT body VFX audit wrapper', () => {
  it('exposes every exact source card and native concentration without duplicating the scene', () => {
    expect(DEUT_BODY_VFX_AUDIT.cards).toHaveLength(7);
    expect(DEUT_BODY_VFX_AUDIT.cards.map(({ source }) => source)).toEqual(DEUT_STATE_GRAPHICS_AUDIT.cards);
    expect(DEUT_BODY_VFX_AUDIT.cards.map(({ stateKey, concentration, encodedState, material, code }) => (
      [stateKey, concentration, encodedState, material, code]
    ))).toEqual(DEUT_STATE_GRAPHICS_AUDIT.cards.map(({ stateKey, concentration, encodedState, material, code }) => (
      [stateKey, concentration, encodedState, material, code]
    )));
    expect(DEUT_BODY_VFX_AUDIT.cards.every(({ material, code }) => (
      material === Material.DEUT && code === 'DEUT'
    ))).toBe(true);
  });

  it('keeps all vertical calibration bands exact, wall-free, and aligned to the shared depth plane', () => {
    const simulation = preparedBody();
    const lookups = createRenderLookups(ALL_MATERIALS);
    const field = new LiquidDensityField(WIDTH, HEIGHT, lookups.liquidByMaterial, lookups.colorByMaterial);
    const depth = new Uint8Array(WIDTH * HEIGHT);
    field.writeVerticalOpticalDepth(simulation.cells(), depth, simulation.walls());
    for (const entry of DEUT_BODY_VFX_AUDIT.cards) {
      for (const band of entry.depthBands) {
        expect(range(depth, band.rect)).toEqual(band.depthRange);
        expectRect(simulation.cells(), band.rect, Material.DEUT);
        expectRect(simulation.walls(), band.rect, 0);
      }
    }
    for (const probe of DEUT_BODY_VFX_AUDIT.controls.highRange) {
      expect(range(depth, probe.target)).toEqual([138, 180]);
      expectRect(simulation.cells(), probe.target, Material.DEUT);
      expectRect(simulation.walls(), probe.target, 0);
    }
  });

  it('uses disjoint deep-body targets that avoid authored openings and remain in bounds', () => {
    const world = { x: 0, y: 0, width: WIDTH, height: HEIGHT };
    for (const entry of DEUT_BODY_VFX_AUDIT.cards) {
      const deep = entry.depthBands.find(({ code }) => code === 'deep');
      if (!deep) throw new Error('DEUT body audit deep band missing');
      const targets = Object.values(entry.targets);
      for (const target of targets) {
        expect(inside(target, world)).toBe(true);
        // The band keeps a deliberately narrow wall-free calibration column;
        // targets may fan out across the same deep rows to sample four static
        // body roles without touching the source atlas's openings.
        expect(target.y).toBeGreaterThanOrEqual(deep.rect.y);
        expect(target.y + target.height).toBeLessThanOrEqual(deep.rect.y + deep.rect.height);
        expect(inside(target, entry.body)).toBe(true);
        expect(intersects(target, entry.authoredHole)).toBe(false);
        expect(intersects(target, entry.openNotch)).toBe(false);
      }
      for (let index = 0; index < targets.length; index++) {
        for (let other = index + 1; other < targets.length; other++) {
          expect(intersects(targets[index], targets[other])).toBe(false);
        }
      }
    }
    const bodyPhases = DEUT_BODY_VFX_AUDIT.cards.map(({ targets }) => carrierPhase(targets.body));
    expect(bodyPhases.every((phase) => phase === bodyPhases[0])).toBe(true);
    const compressed = DEUT_BODY_VFX_AUDIT.cards.find(({ stateKey }) => stateKey === 'compressed');
    if (!compressed) throw new Error('Compressed DEUT calibration card missing');
    const compressedPhase = carrierPhase(compressed.targets.body);
    expect(DEUT_BODY_VFX_AUDIT.controls.highRange.map(({ target }) => carrierPhase(target)))
      .toEqual([compressedPhase, compressedPhase]);
  });

  it('preserves the full source topology, control ownership, and saturated high-range native words', () => {
    const simulation = preparedBody();
    const cells = simulation.cells();
    const states = simulation.presentationState();
    const walls = simulation.walls();
    for (const entry of DEUT_BODY_VFX_AUDIT.cards) {
      expectRect(cells, entry.authoredHole, Material.Empty);
      expectRect(cells, entry.openNotch, Material.Empty);
      expectRect(cells, entry.thinStructure, Material.DEUT);
      expect(at(cells, entry.isolated)).toBe(Material.DEUT);
      expectRect(cells, entry.zeroState, Material.DEUT);
      expectRect(states, entry.zeroState, 0);
      expectRect(cells, entry.wrongOwner, Material.Sand);
      expectRect(cells, entry.waterControl, Material.Water);
      expectRect(cells, entry.metalControl, Material.Metal);
      expectRect(cells, entry.exotControl, Material.EXOT);
      expectRect(cells, entry.isozControl, Material.ISOZ);
      expectRect(cells, entry.wallCoexistence, Material.DEUT);
      expectRect(walls, entry.wallCoexistence, 1);
      expectRect(cells, entry.liquidContact.owner, Material.DEUT);
      expectRect(cells, entry.liquidContact.neighbour, Material.Water);
      expectRect(cells, entry.solidContact.owner, Material.DEUT);
      expectRect(cells, entry.solidContact.neighbour, Material.Metal);
      expectRect(cells, entry.guardedBlank, Material.Empty);
      expectRect(states, entry.body, entry.encodedState, [entry.authoredHole, entry.openNotch]);
    }
    expect(DEUT_BODY_VFX_AUDIT.controls.highRange.map(({ encodedState }) => encodedState))
      .toEqual([17_000, 65_535]);
    for (const probe of DEUT_BODY_VFX_AUDIT.controls.highRange) {
      expectRect(cells, probe.rect, Material.DEUT);
      expectRect(states, probe.rect, probe.encodedState);
    }
  });

  it('delegates byte-for-byte deterministically to the established DEUT state fixture', () => {
    const direct = new RenderLabBackend(WIDTH, HEIGHT);
    const wrapped = new RenderLabBackend(WIDTH, HEIGHT);
    prepareDeutStateGraphicsAuditFixture(direct);
    prepareDeutBodyVfxAuditFixture(wrapped);
    expect(Array.from(wrapped.cells())).toEqual(Array.from(direct.cells()));
    expect(Array.from(wrapped.presentationState())).toEqual(Array.from(direct.presentationState()));
    expect(Array.from(wrapped.walls())).toEqual(Array.from(direct.walls()));

    const beforeCells = wrapped.cells().slice();
    const beforeStates = wrapped.presentationState().slice();
    const beforeWalls = wrapped.walls().slice();
    wrapped.cells().fill(Material.Fire);
    wrapped.presentationState().fill(0xffff);
    wrapped.paintWall(4, 4, 2, 0);
    prepareDeutBodyVfxAuditFixture(wrapped);
    expect(Array.from(wrapped.cells())).toEqual(Array.from(beforeCells));
    expect(Array.from(wrapped.presentationState())).toEqual(Array.from(beforeStates));
    expect(Array.from(wrapped.walls())).toEqual(Array.from(beforeWalls));
  });
});

function preparedBody(): RenderLabBackend {
  const simulation = new RenderLabBackend(WIDTH, HEIGHT);
  prepareDeutBodyVfxAuditFixture(simulation);
  return simulation;
}

function at(bytes: Uint8Array, point: { readonly x: number; readonly y: number }): number {
  return bytes[point.y * WIDTH + point.x];
}

function carrierPhase(point: { readonly x: number; readonly y: number }): string {
  return `${point.x % 24}:${point.y % 16}:${(point.x + point.y) % 48}`;
}

function range(bytes: Uint8Array, rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }): [number, number] {
  let minimum = 255;
  let maximum = 0;
  each(rect, ({ x, y }) => {
    const value = bytes[y * WIDTH + x];
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  });
  return [minimum, maximum];
}

function expectRect(bytes: Uint8Array | Uint16Array, rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }, value: number, exceptions: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number }[] = []): void {
  each(rect, (point) => {
    if (exceptions.some((exception) => contains(exception, point))) return;
    expect(bytes[point.y * WIDTH + point.x]).toBe(value);
  });
}

function each(rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }, action: (point: { readonly x: number; readonly y: number }) => void): void {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) action({ x, y });
  }
}

function contains(rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }, point: { readonly x: number; readonly y: number }): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width
    && point.y >= rect.y && point.y < rect.y + rect.height;
}

function inside(rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }, container: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }): boolean {
  return rect.x >= container.x && rect.y >= container.y
    && rect.x + rect.width <= container.x + container.width
    && rect.y + rect.height <= container.y + container.height;
}

function intersects(left: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }, right: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }): boolean {
  return left.x < right.x + right.width && left.x + left.width > right.x
    && left.y < right.y + right.height && left.y + left.height > right.y;
}
