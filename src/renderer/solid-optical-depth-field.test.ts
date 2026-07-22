import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { createRenderLookups } from './render-field-set';
import { RenderPhase } from './render-profile';
import { SOLID_OPTICAL_DEPTH_STEP, writeSolidOpticalDepth } from './solid-optical-depth-field';

function styles(): Uint8Array {
  const bytes = new Uint8Array(256 * 4);
  bytes[1 * 4] = RenderPhase.Solid;
  bytes[2 * 4] = RenderPhase.Solid;
  bytes[3 * 4] = RenderPhase.Powder;
  bytes[4 * 4] = RenderPhase.Liquid;
  return bytes;
}

describe('solid optical depth field', () => {
  it('measures exact-species surface-to-core thickness in both axes', () => {
    const width = 7;
    const materials = new Uint8Array(width * width).fill(1);
    const target = new Uint8Array(materials.length);
    writeSolidOpticalDepth(materials, target, styles(), width);

    expect(target[0]).toBe(0);
    expect(target[1 * width + 1]).toBe(SOLID_OPTICAL_DEPTH_STEP);
    expect(target[2 * width + 2]).toBe(SOLID_OPTICAL_DEPTH_STEP * 2);
    expect(target[3 * width + 3]).toBe(SOLID_OPTICAL_DEPTH_STEP * 3);
    expect(target[5 * width + 5]).toBe(SOLID_OPTICAL_DEPTH_STEP);
  });

  it('resets at unlike solids, holes, and native walls', () => {
    const width = 7;
    const materials = new Uint8Array(width * width).fill(1);
    const walls = new Uint8Array(materials.length);
    materials[3 * width + 3] = 2;
    materials[1 * width + 5] = 0;
    walls[5 * width + 1] = 1;
    const target = new Uint8Array(materials.length);
    writeSolidOpticalDepth(materials, target, styles(), width, walls);

    expect(target[3 * width + 3]).toBe(0);
    expect(target[3 * width + 2]).toBe(0);
    expect(target[1 * width + 4]).toBe(0);
    expect(target[5 * width + 1]).toBe(0);
    expect(target[4 * width + 1]).toBe(0);
  });

  it('preserves powder, liquid, empty, and other phase-local bytes', () => {
    const width = 5;
    const materials = new Uint8Array([
      0, 0, 0, 0, 0,
      0, 3, 3, 4, 0,
      0, 3, 1, 4, 0,
      0, 3, 3, 4, 0,
      0, 0, 0, 0, 0,
    ]);
    const target = Uint8Array.from({ length: materials.length }, (_, index) => index + 10);
    const original = target.slice();
    writeSolidOpticalDepth(materials, target, styles(), width);

    for (let index = 0; index < materials.length; index++) {
      if (materials[index] !== 1) expect(target[index]).toBe(original[index]);
    }
    expect(target[2 * width + 2]).toBe(0);
  });

  it('routes native VIBR through solid depth while leaving powder PLUT untouched', () => {
    const width = 7;
    const lookups = createRenderLookups(ALL_MATERIALS);
    const plut = new Uint8Array(width * width).fill(Material.PLUT);
    const powderTarget = new Uint8Array(plut.length).fill(77);
    writeSolidOpticalDepth(plut, powderTarget, lookups.styleBytes, width);
    expect(powderTarget[3 * width + 3]).toBe(77);

    const vibr = new Uint8Array(width * width).fill(Material.VIBR);
    const solidTarget = new Uint8Array(vibr.length);
    writeSolidOpticalDepth(vibr, solidTarget, lookups.styleBytes, width);
    expect(solidTarget[3 * width + 3]).toBe(SOLID_OPTICAL_DEPTH_STEP * 3);
  });

  it('saturates deep solids without wrapping', () => {
    const width = 101;
    const materials = new Uint8Array(width * width).fill(1);
    const target = new Uint8Array(materials.length);
    writeSolidOpticalDepth(materials, target, styles(), width);
    expect(target[50 * width + 50]).toBe(255);
  });

  it('adds toggleable SPNG pore relief without changing surface or fine depth', () => {
    const width = 61;
    const materials = new Uint8Array(width * width).fill(Material.SPNG);
    const lookups = createRenderLookups(ALL_MATERIALS);
    const flat = new Uint8Array(materials.length);
    const porous = new Uint8Array(materials.length);
    writeSolidOpticalDepth(materials, flat, lookups.styleBytes, width, undefined, false);
    writeSolidOpticalDepth(materials, porous, lookups.styleBytes, width, undefined, true);

    const core = 24 * width + 24;
    const litLip = 24 * width + 21;
    const shadowLip = 24 * width + 27;
    const background = 38 * width + 38;
    expect(porous[core]).toBe(flat[core] + 36);
    expect(porous[litLip]).toBe(Math.max(7, flat[litLip] - 90));
    expect(porous[shadowLip]).toBe(flat[shadowLip] + 24);
    expect(porous[background]).toBe(flat[background]);
    expect(porous[0]).toBe(0);
    expect(porous[1 * width + 1]).toBe(SOLID_OPTICAL_DEPTH_STEP);
  });

  it('rejects malformed dimensions and planes', () => {
    expect(() => writeSolidOpticalDepth(
      new Uint8Array(5), new Uint8Array(5), styles(), 2,
    )).toThrow('Solid optical depth field size mismatch');
    expect(() => writeSolidOpticalDepth(
      new Uint8Array(4), new Uint8Array(3), styles(), 2,
    )).toThrow('Solid optical depth field size mismatch');
  });
});
