import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  applyCanvasFieldProfileIdentityStyle,
  CANVAS_FIELD_PROFILE_IDENTITY_BY_MATERIAL,
  CANVAS_FIELD_PROFILE_IDENTITY_MATERIALS,
  canvasFieldProfileIdentityStyle,
} from './canvas-field-profile-identity-style';

function styled(material: number, x: number, y: number): Float32Array {
  const color = new Float32Array([96, 112, 128, 173]);
  applyCanvasFieldProfileIdentityStyle(color, material, x, y);
  return color;
}

function fingerprint(material: number): string {
  let hash = 2166136261;
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
    const color = styled(material, x, y);
    for (let channel = 0; channel < 3; channel++) {
      hash = Math.imul(hash ^ Math.round(color[channel] - [96, 112, 128][channel]), 16777619) >>> 0;
    }
  }
  return hash.toString(16);
}

describe('Canvas Field-profile identity styling', () => {
  it('owns only the eight native Field bodies', () => {
    expect(CANVAS_FIELD_PROFILE_IDENTITY_BY_MATERIAL.byteLength).toBe(256);
    for (const [index, material] of CANVAS_FIELD_PROFILE_IDENTITY_MATERIALS.entries()) {
      expect(canvasFieldProfileIdentityStyle(material)).toBe(index + 1);
    }
    const owners = new Set<number>(CANVAS_FIELD_PROFILE_IDENTITY_MATERIALS);
    for (let material = 0; material < 256; material++) {
      expect(canvasFieldProfileIdentityStyle(material)).toBe(owners.has(material)
        ? (CANVAS_FIELD_PROFILE_IDENTITY_MATERIALS as readonly number[]).indexOf(material) + 1 : 0);
    }
  });

  it('is deterministic, RGB-only, bounded, and leaves nonowners exact', () => {
    for (const material of CANVAS_FIELD_PROFILE_IDENTITY_MATERIALS) {
      for (let y = -8; y < 32; y++) for (let x = -8; x < 32; x++) {
        const color = styled(material, x, y);
        expect(styled(material, x, y)).toEqual(color);
        expect(color[3]).toBe(173);
        expect(Math.max(
          Math.abs(color[0] - 96), Math.abs(color[1] - 112), Math.abs(color[2] - 128),
        )).toBeLessThanOrEqual(18);
      }
    }
    for (const material of [Material.Sand, Material.Water, Material.ACEL, Material.CONV, Material.DTEC]) {
      expect(Array.from(styled(material, 7, 11))).toEqual([96, 112, 128, 173]);
    }
  });

  it('keeps portal, hole, vent, and TRON material signatures distinct', () => {
    const prints = new Set(CANVAS_FIELD_PROFILE_IDENTITY_MATERIALS.map(fingerprint));
    expect(prints.size).toBe(CANVAS_FIELD_PROFILE_IDENTITY_MATERIALS.length);
  });
});
