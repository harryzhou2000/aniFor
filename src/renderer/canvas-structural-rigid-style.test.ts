import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  applyCanvasStructuralRigidBulkOptics,
  applyCanvasStructuralRigidStyle,
  CANVAS_STRUCTURAL_RIGID_MATERIALS,
  canvasStructuralRigidStyle,
  isCanvasStructuralRigidMaterial,
} from './canvas-structural-rigid-style';

const SOURCE = [104, 116, 128, 173] as const;

function shade(material: number, x: number, y: number): number[] {
  const output = new Float32Array(SOURCE);
  applyCanvasStructuralRigidStyle(output, material, x, y);
  return Array.from(output);
}

function shadeBulk(
  material: number,
  denseInterior = true,
  opticalDepthByte = 42,
  relief = 7,
  opticalDepthEnabled = true,
): number[] {
  const output = new Float32Array(SOURCE);
  applyCanvasStructuralRigidBulkOptics(
    output, material, denseInterior, opticalDepthByte, relief, opticalDepthEnabled,
  );
  return Array.from(output);
}

describe('Canvas structural-rigid material styling', () => {
  it('maps exactly the seven common construction solids', () => {
    expect(CANVAS_STRUCTURAL_RIGID_MATERIALS).toEqual([
      Material.Brick, Material.Metal, Material.Ceramic, Material.BMTL,
      Material.GOLD, Material.IRON, Material.TTAN,
    ]);
    for (const [index, material] of CANVAS_STRUCTURAL_RIGID_MATERIALS.entries()) {
      expect(canvasStructuralRigidStyle(material)).toBe(index + 1);
      expect(isCanvasStructuralRigidMaterial(material)).toBe(true);
    }
    for (const material of [Material.Empty, Material.Sand, Material.Water, Material.Glass, Material.VRSS, -1, 256]) {
      expect(canvasStructuralRigidStyle(material)).toBe(0);
      expect(isCanvasStructuralRigidMaterial(material)).toBe(false);
    }
  });

  it('is deterministic, RGB-bounded, and alpha-invariant', () => {
    for (const material of CANVAS_STRUCTURAL_RIGID_MATERIALS) {
      for (let y = -12; y <= 24; y++) for (let x = -12; x <= 24; x++) {
        const first = shade(material, x, y);
        expect(shade(material, x, y)).toEqual(first);
        expect(first[3]).toBe(SOURCE[3]);
        for (let channel = 0; channel < 3; channel++) {
          expect(Math.abs(first[channel] - SOURCE[channel])).toBeLessThanOrEqual(12);
        }
      }
    }
  });

  it('gives every structural material a distinct multi-cell fingerprint', () => {
    const fingerprints = new Set<string>();
    for (const material of CANVAS_STRUCTURAL_RIGID_MATERIALS) {
      const fingerprint: number[] = [];
      for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
        fingerprint.push(...shade(material, x, y).slice(0, 3));
      }
      fingerprints.add(fingerprint.join(','));
    }
    expect(fingerprints.size).toBe(CANVAS_STRUCTURAL_RIGID_MATERIALS.length);
  });

  it('is an exact no-op for non-structural controls', () => {
    expect(shade(Material.Water, 13, 17)).toEqual(Array.from(SOURCE));
    expect(shade(Material.Glass, 13, 17)).toEqual(Array.from(SOURCE));
  });

  it('adds a bounded, material-specific broad response only to deep dense bodies', () => {
    const crowns = new Set<string>();
    const pockets = new Set<string>();
    for (const material of CANVAS_STRUCTURAL_RIGID_MATERIALS) {
      const crown = shadeBulk(material);
      const pocket = shadeBulk(material, true, 42, -7);
      expect(crown[3]).toBe(SOURCE[3]);
      expect(pocket[3]).toBe(SOURCE[3]);
      for (let channel = 0; channel < 3; channel++) {
        expect(crown[channel] - SOURCE[channel]).toBeGreaterThanOrEqual(0);
        expect(crown[channel] - SOURCE[channel]).toBeLessThanOrEqual(7);
        expect(SOURCE[channel] - pocket[channel]).toBeGreaterThanOrEqual(0);
        expect(SOURCE[channel] - pocket[channel]).toBeLessThanOrEqual(7);
      }
      crowns.add(crown.slice(0, 3).join(','));
      pockets.add(pocket.slice(0, 3).join(','));
    }
    expect(crowns.size).toBe(CANVAS_STRUCTURAL_RIGID_MATERIALS.length);
    expect(pockets.size).toBe(CANVAS_STRUCTURAL_RIGID_MATERIALS.length);
  });

  it('keeps protected controls byte-exact', () => {
    const controls: readonly [number, boolean, number, number, boolean][] = [
      [Material.Water, true, 42, 7, true],
      [Material.Brick, false, 42, 7, true],
      [Material.Brick, true, 6, 7, true],
      [Material.Brick, true, 42, 0, true],
      [Material.Brick, true, 42, 7, false],
    ];
    for (const [material, denseInterior, opticalDepth, relief, enabled] of controls) {
      expect(shadeBulk(material, denseInterior, opticalDepth, relief, enabled)).toEqual(Array.from(SOURCE));
    }
  });
});
