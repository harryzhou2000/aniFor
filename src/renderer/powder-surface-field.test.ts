import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { createRenderLookups } from './render-field-set';
import { PowderSurfaceField } from './powder-surface-field';

const lookups = createRenderLookups(ALL_MATERIALS);

describe('slope-aware powder surface field', () => {
  it('smooths a shallow settled heap while keeping its crossing and area bounded', () => {
    const width = 96;
    const height = 32;
    const materials = new Uint8Array(width * height);
    const stability = new Uint8Array(width * height);
    const rawTop = new Float32Array(width);
    for (let x = 8; x < width - 8; x++) {
      const top = 22 - Math.round((x - 8) * 7 / (width - 17));
      rawTop[x] = top;
      for (let y = top; y < height - 2; y++) {
        const index = y * width + x;
        materials[index] = Material.Sand;
        stability[index] = 255;
      }
    }
    const field = new PowderSurfaceField(width, height, lookups.styleBytes);
    field.update(materials, stability);
    const reconstructed = crossings(field.bytes, width, height, 16, width - 16);
    const raw = Array.from(rawTop.slice(16, width - 16));
    expect(secondDifferenceEnergy(reconstructed)).toBeLessThan(secondDifferenceEnergy(raw) * 0.72);
    // Crossings are measured between cell centres, so the semantic top edge is
    // exactly half a cell above the first occupied row.
    expect(Math.abs(mean(reconstructed) + 0.5 - mean(raw))).toBeLessThan(0.12);
    expect(Math.max(...reconstructed) - Math.min(...reconstructed)).toBeGreaterThan(5);
  });

  it('requires stable powder, excludes walls, and keeps support local', () => {
    const width = 11;
    const height = 9;
    const materials = new Uint8Array(width * height);
    const stability = new Uint8Array(width * height);
    const walls = new Uint8Array(width * height);
    const field = new PowderSurfaceField(width, height, lookups.styleBytes);
    materials[4 * width + 5] = Material.Sand;
    field.update(materials, stability, walls);
    expect(field.hasSurface).toBe(false);
    expect(field.bytes.some(Boolean)).toBe(false);

    stability[4 * width + 5] = 255;
    field.update(materials, stability, walls);
    expect(field.hasSurface).toBe(true);
    expect(field.bytes[(4 * width + 5) * 4 + 3]).toBeGreaterThan(0);
    expect(field.bytes[(4 * width + 8) * 4 + 3]).toBe(0);

    walls[4 * width + 5] = 1;
    field.update(materials, stability, walls);
    expect(field.hasSurface).toBe(false);
    expect(field.bytes.some(Boolean)).toBe(false);
  });

  it('uses bounded preallocated storage and stable output buffers', () => {
    const field = new PowderSurfaceField(612, 384, lookups.styleBytes);
    expect(field.allocatedByteLength).toBe(3_055_104);
    const bytes = field.bytes;
    const materials = new Uint8Array(612 * 384);
    const stability = new Uint8Array(materials.length);
    field.update(materials, stability);
    field.update(materials, stability);
    expect(field.bytes).toBe(bytes);
  });
});

function crossings(
  bytes: Uint8Array,
  width: number,
  height: number,
  startX: number,
  endX: number,
): number[] {
  const result: number[] = [];
  for (let x = startX; x < endX; x++) {
    let crossing = height;
    for (let y = 1; y < height; y++) {
      const previous = bytes[((y - 1) * width + x) * 4] / 255;
      const current = bytes[(y * width + x) * 4] / 255;
      if (previous >= 0.5 || current < 0.5) continue;
      crossing = y - 1 + (0.5 - previous) / Math.max(1e-6, current - previous);
      break;
    }
    result.push(crossing);
  }
  return result;
}

function secondDifferenceEnergy(values: readonly number[]): number {
  let energy = 0;
  for (let index = 1; index < values.length - 1; index++) {
    energy += Math.abs(values[index - 1] - values[index] * 2 + values[index + 1]);
  }
  return energy;
}

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}
