import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  CANVAS_ELECTRONIC_BODY_MATERIALS,
  CANVAS_ELECTRONIC_BODY_STYLE_BY_MATERIAL,
  CANVAS_MECHANISM_BODY_MATERIALS,
  CANVAS_MECHANISM_BODY_STYLE_BY_MATERIAL,
  applyCanvasElectronicBodyIdentityStyle,
  applyCanvasMechanismBodyIdentityStyle,
  canvasElectronicBodyStyle,
  canvasMechanismBodyStyle,
} from './canvas-device-identity-style';

function mechanism(material: number, x: number, y: number): Float32Array {
  const color = new Float32Array([92, 108, 124, 177]);
  applyCanvasMechanismBodyIdentityStyle(color, material, x, y);
  return color;
}

function electronic(material: number, x: number, y: number): Float32Array {
  const color = new Float32Array([92, 108, 124, 177]);
  applyCanvasElectronicBodyIdentityStyle(color, material, x, y);
  return color;
}

function fingerprint(style: (material: number, x: number, y: number) => Float32Array, material: number): string {
  let hash = 2166136261;
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
    const color = style(material, x, y);
    for (let channel = 0; channel < 3; channel++) {
      hash = Math.imul(hash ^ Math.round(color[channel] - [92, 108, 124][channel]), 16777619) >>> 0;
    }
  }
  return hash.toString(16);
}

describe('Canvas transport and electronics identity styling', () => {
  it('maps the exact native owner sets and leaves every control unclaimed', () => {
    expect(CANVAS_MECHANISM_BODY_STYLE_BY_MATERIAL.byteLength).toBe(256);
    expect(CANVAS_ELECTRONIC_BODY_STYLE_BY_MATERIAL.byteLength).toBe(256);
    for (const [index, material] of CANVAS_MECHANISM_BODY_MATERIALS.entries()) {
      expect(canvasMechanismBodyStyle(material)).toBe(index + 1);
    }
    for (const [index, material] of CANVAS_ELECTRONIC_BODY_MATERIALS.entries()) {
      expect(canvasElectronicBodyStyle(material)).toBe(index + 1);
    }
    const mechanisms = new Set<number>(CANVAS_MECHANISM_BODY_MATERIALS);
    const electronics = new Set<number>(CANVAS_ELECTRONIC_BODY_MATERIALS);
    for (let material = 0; material < 256; material++) {
      expect(canvasMechanismBodyStyle(material)).toBe(mechanisms.has(material)
        ? (CANVAS_MECHANISM_BODY_MATERIALS as readonly number[]).indexOf(material) + 1 : 0);
      expect(canvasElectronicBodyStyle(material)).toBe(electronics.has(material)
        ? (CANVAS_ELECTRONIC_BODY_MATERIALS as readonly number[]).indexOf(material) + 1 : 0);
    }
  });

  it('is deterministic, RGB-only, bounded, and exact-no-op outside both owner sets', () => {
    for (const [label, owners, style] of [
      ['mechanism', CANVAS_MECHANISM_BODY_MATERIALS, mechanism],
      ['electronic', CANVAS_ELECTRONIC_BODY_MATERIALS, electronic],
    ] as const) {
      for (const material of owners) for (let y = -8; y < 32; y++) for (let x = -8; x < 32; x++) {
        const color = style(material, x, y);
        expect(style(material, x, y)).toEqual(color);
        expect(color[3], label).toBe(177);
        expect(Math.max(
          Math.abs(color[0] - 92), Math.abs(color[1] - 108), Math.abs(color[2] - 124),
        ), label).toBeLessThanOrEqual(18);
      }
    }
    for (const material of [Material.Sand, Material.Water, Material.Metal, Material.BCLN, Material.VIBR]) {
      expect(Array.from(mechanism(material, 7, 11))).toEqual([92, 108, 124, 177]);
      expect(Array.from(electronic(material, 7, 11))).toEqual([92, 108, 124, 177]);
    }
  });

  it('gives every owner a repeatable distinct body fingerprint', () => {
    const mechanismPrints = new Set(CANVAS_MECHANISM_BODY_MATERIALS.map((material) => fingerprint(mechanism, material)));
    const electronicPrints = new Set(CANVAS_ELECTRONIC_BODY_MATERIALS.map((material) => fingerprint(electronic, material)));
    expect(mechanismPrints.size).toBe(CANVAS_MECHANISM_BODY_MATERIALS.length);
    expect(electronicPrints.size).toBe(CANVAS_ELECTRONIC_BODY_MATERIALS.length);
  });
});
