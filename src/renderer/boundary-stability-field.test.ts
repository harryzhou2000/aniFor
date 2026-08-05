import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  BOUNDARY_STABILITY_STEP, POWDER_RELEASE_SPEED, POWDER_SOLID_CONTACT_STABILITY,
  updateBoundaryStabilityRect,
} from './boundary-stability-field';
import { RenderPhase } from './render-profile';

const WIDTH = 3;
const FULL_RECT = { x: 0, y: 0, width: WIDTH, height: WIDTH };

function styles(): Uint8Array {
  const result = new Uint8Array(256 * 4);
  result[1 * 4] = RenderPhase.Powder;
  result[2 * 4] = RenderPhase.Powder;
  result[3 * 4] = RenderPhase.Solid;
  result[4 * 4] = RenderPhase.Liquid;
  result[5 * 4] = RenderPhase.Gas;
  result[6 * 4] = RenderPhase.Solid;
  result[7 * 4] = RenderPhase.Solid;
  result[7 * 4 + 2] = 255;
  result[8 * 4] = RenderPhase.Solid;
  result[8 * 4 + 3] = 1;
  return result;
}

function previousField(materials: Uint8Array): Uint8Array {
  return new Uint8Array(materials);
}

describe('boundary stability field', () => {
  it('requires several slow refreshes before powder becomes a bulk contour', () => {
    const materials = new Uint8Array([
      0, 1, 0,
      1, 1, 2,
      0, 3, 0,
    ]);
    const previous = previousField(materials);
    const target = new Uint8Array(materials.length);
    const velocities = new Int8Array(materials.length * 2);
    for (let refresh = 1; refresh <= 6; refresh++) {
      updateBoundaryStabilityRect(target, previous, materials, velocities, styles(), WIDTH, FULL_RECT);
      expect(target[1 * WIDTH + 1]).toBe(Math.min(255, refresh * BOUNDARY_STABILITY_STEP));
    }
  });

  it('holds through the hysteresis band and releases on definite movement', () => {
    const materials = new Uint8Array([
      0, 1, 0,
      1, 1, 1,
      0, 1, 0,
    ]);
    const previous = previousField(materials);
    const target = new Uint8Array(materials.length);
    const velocities = new Int8Array(materials.length * 2);
    const center = 1 * WIDTH + 1;
    target[center] = 144;
    velocities[center * 2] = 6;
    updateBoundaryStabilityRect(target, previous, materials, velocities, styles(), WIDTH, FULL_RECT);
    expect(target[center]).toBe(144);
    velocities[center * 2] = 10;
    updateBoundaryStabilityRect(target, previous, materials, velocities, styles(), WIDTH, FULL_RECT);
    expect(target[center]).toBe(0);
  });

  it('optionally packs only fully settled ordinary Powder-to-Solid contact as byte 254', () => {
    const materials = new Uint8Array([
      0, 1, 0,
      1, 1, 1,
      0, 6, 0,
    ]);
    const previous = previousField(materials);
    const target = new Uint8Array(materials.length);
    const walls = new Uint8Array(materials.length);
    const center = 1 * WIDTH + 1;
    const solid = 2 * WIDTH + 1;
    const styleBytes = styles();

    updateBoundaryStabilityRect(
      target, previous, materials, undefined, styleBytes, WIDTH, FULL_RECT,
    );
    expect(target[center]).toBe(255);
    updateBoundaryStabilityRect(
      target, previous, materials, undefined, styleBytes, WIDTH, FULL_RECT, undefined, true, walls,
    );
    expect(target[center]).toBe(POWDER_SOLID_CONTACT_STABILITY);
    updateBoundaryStabilityRect(
      target, previous, materials, undefined, styleBytes, WIDTH, FULL_RECT, undefined, true, walls,
    );
    expect(target[center]).toBe(POWDER_SOLID_CONTACT_STABILITY);

    updateBoundaryStabilityRect(
      target, previous, materials, undefined, styleBytes, WIDTH, FULL_RECT, undefined, false, walls,
    );
    expect(target[center]).toBe(255);
    updateBoundaryStabilityRect(
      target, previous, materials, undefined, styleBytes, WIDTH, FULL_RECT, undefined, true, walls,
    );
    expect(target[center]).toBe(POWDER_SOLID_CONTACT_STABILITY);

    walls[center] = 1;
    updateBoundaryStabilityRect(
      target, previous, materials, undefined, styleBytes, WIDTH, FULL_RECT, undefined, true, walls,
    );
    expect(target[center]).toBe(255);
    walls[center] = 0;
    updateBoundaryStabilityRect(
      target, previous, materials, undefined, styleBytes, WIDTH, FULL_RECT, undefined, true, walls,
    );
    expect(target[center]).toBe(POWDER_SOLID_CONTACT_STABILITY);

    walls[solid] = 1;
    updateBoundaryStabilityRect(
      target, previous, materials, undefined, styleBytes, WIDTH, FULL_RECT, undefined, true, walls,
    );
    expect(target[center]).toBe(255);
    walls[solid] = 0;
    updateBoundaryStabilityRect(
      target, previous, materials, undefined, styleBytes, WIDTH, FULL_RECT, undefined, true, walls,
    );
    expect(target[center]).toBe(POWDER_SOLID_CONTACT_STABILITY);

    styleBytes[1 * 4 + 2] = 255;
    updateBoundaryStabilityRect(
      target, previous, materials, undefined, styleBytes, WIDTH, FULL_RECT, undefined, true, walls,
    );
    expect(target[center]).toBe(255);
    styleBytes[1 * 4 + 2] = 0;
    styleBytes[1 * 4 + 3] = 1;
    updateBoundaryStabilityRect(
      target, previous, materials, undefined, styleBytes, WIDTH, FULL_RECT, undefined, true, walls,
    );
    expect(target[center]).toBe(255);
    styleBytes[1 * 4 + 3] = 0;

    for (const ineligible of [2, Material.Wall, 7, 8]) {
      materials[2 * WIDTH + 1] = ineligible;
      updateBoundaryStabilityRect(
        target, previous, materials, undefined, styleBytes, WIDTH, FULL_RECT, undefined, true, walls,
      );
      expect(target[center]).toBe(255);
    }

    materials[2 * WIDTH + 1] = 6;
    const velocities = new Int8Array(materials.length * 2);
    velocities[center * 2] = POWDER_RELEASE_SPEED;
    target[center] = POWDER_SOLID_CONTACT_STABILITY;
    updateBoundaryStabilityRect(
      target, previous, materials, velocities, styleBytes, WIDTH, FULL_RECT, undefined, true, walls,
    );
    expect(target[center]).toBe(0);
  });

  it('accepts unlike powder and solid contact but excludes liquid and gas support', () => {
    const materials = new Uint8Array([
      0, 2, 0,
      4, 1, 5,
      0, 3, 0,
    ]);
    const previous = previousField(materials);
    const target = new Uint8Array(materials.length);
    const velocities = new Int8Array(materials.length * 2);
    updateBoundaryStabilityRect(target, previous, materials, velocities, styles(), WIDTH, FULL_RECT);
    expect(target[1 * WIDTH + 1]).toBe(BOUNDARY_STABILITY_STEP);

    materials[0 * WIDTH + 1] = 4;
    materials[2 * WIDTH + 1] = 5;
    updateBoundaryStabilityRect(target, previous, materials, velocities, styles(), WIDTH, FULL_RECT);
    expect(target[1 * WIDTH + 1]).toBe(0);
  });

  it('resets when a different powder owner moves into the cell', () => {
    const materials = new Uint8Array([
      0, 1, 0,
      1, 2, 1,
      0, 1, 0,
    ]);
    const previous = previousField(materials);
    previous[1 * WIDTH + 1] = 1;
    const target = new Uint8Array(materials.length);
    target[1 * WIDTH + 1] = 255;
    updateBoundaryStabilityRect(
      target, previous, materials, new Int8Array(materials.length * 2), styles(), WIDTH, FULL_RECT,
    );
    expect(target[1 * WIDTH + 1]).toBe(0);
  });

  it('queues one follow-up settle pass when a supported powder owner first arrives at byte zero', () => {
    const materials = new Uint8Array([
      0, 1, 0,
      1, 2, 1,
      0, 1, 0,
    ]);
    const previous = new Uint8Array(materials.length);
    const target = new Uint8Array(materials.length);
    const dirty = new Set<number>();
    const center = 1 * WIDTH + 1;

    updateBoundaryStabilityRect(
      target, previous, materials, new Int8Array(materials.length * 2), styles(), WIDTH,
      FULL_RECT, { markCell: (index) => dirty.add(index) },
    );
    expect(target[center]).toBe(0);
    expect(dirty).toContain(center);

    dirty.clear();
    updateBoundaryStabilityRect(
      target, previous, materials, new Int8Array(materials.length * 2), styles(), WIDTH,
      FULL_RECT, { markCell: (index) => dirty.add(index) },
    );
    expect(target[center]).toBe(BOUNDARY_STABILITY_STEP);
    expect(dirty).toContain(center);
  });

  it('preserves same-owner liquid depth and clears a changed liquid owner', () => {
    const materials = new Uint8Array([
      0, 0, 0,
      0, 4, 0,
      0, 0, 0,
    ]);
    const previous = previousField(materials);
    const target = new Uint8Array(materials.length);
    const center = 1 * WIDTH + 1;
    target[center] = 84;
    updateBoundaryStabilityRect(target, previous, materials, undefined, styles(), WIDTH, FULL_RECT);
    expect(target[center]).toBe(84);

    previous[center] = 0;
    updateBoundaryStabilityRect(target, previous, materials, undefined, styles(), WIDTH, FULL_RECT);
    expect(target[center]).toBe(0);
  });

  it('preserves same-owner solid depth and clears a changed solid owner', () => {
    const materials = new Uint8Array([
      0, 0, 0,
      0, 3, 0,
      0, 0, 0,
    ]);
    const previous = previousField(materials);
    const target = new Uint8Array(materials.length);
    const center = 1 * WIDTH + 1;
    target[center] = 72;
    updateBoundaryStabilityRect(target, previous, materials, undefined, styles(), WIDTH, FULL_RECT);
    expect(target[center]).toBe(72);

    previous[center] = 0;
    updateBoundaryStabilityRect(target, previous, materials, undefined, styles(), WIDTH, FULL_RECT);
    expect(target[center]).toBe(0);
  });

  it('invalidates only cells whose presentation stability changes', () => {
    const materials = new Uint8Array([
      0, 1, 0,
      1, 1, 1,
      0, 1, 0,
    ]);
    const previous = previousField(materials);
    const target = new Uint8Array(materials.length);
    const dirty = new Set<number>();
    updateBoundaryStabilityRect(
      target, previous, materials, new Int8Array(materials.length * 2), styles(), WIDTH,
      FULL_RECT, { markCell: (index) => dirty.add(index) },
    );
    expect(dirty).toEqual(new Set([1, 3, 4, 5, 7]));
    dirty.clear();
    target.fill(0);
    materials.fill(0);
    updateBoundaryStabilityRect(
      target, previous, materials, undefined, styles(), WIDTH,
      FULL_RECT, { markCell: (index) => dirty.add(index) },
    );
    expect(dirty.size).toBe(0);
  });
});
