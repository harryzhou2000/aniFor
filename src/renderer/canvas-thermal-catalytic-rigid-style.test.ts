import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  applyCanvasThermalCatalyticRigidCoreOptics,
  CANVAS_THERMAL_CATALYTIC_RIGID_MATERIALS,
  CanvasThermalCatalyticRigidStyle,
  canvasThermalCatalyticRigidStyle,
  isCanvasThermalCatalyticRigidMaterial,
} from './canvas-thermal-catalytic-rigid-style';

const SOURCE = [104, 116, 128, 173] as const;

function shade(
  material: number, x: number, y: number, denseInterior = true,
  opticalDepthByte = 42, relief = 4, opticalDepthEnabled = true,
): number[] {
  const output = new Float32Array(SOURCE);
  applyCanvasThermalCatalyticRigidCoreOptics(
    output, material, x, y, denseInterior, opticalDepthByte, relief, opticalDepthEnabled,
  );
  return Array.from(output);
}

describe('Canvas thermal/catalytic rigid core optics', () => {
  it('maps exactly HEAC, PTNM, and RSSS', () => {
    expect(CANVAS_THERMAL_CATALYTIC_RIGID_MATERIALS).toEqual([
      Material.HEAC, Material.PTNM, Material.RSSS,
    ]);
    expect(canvasThermalCatalyticRigidStyle(Material.HEAC)).toBe(CanvasThermalCatalyticRigidStyle.HeatConductor);
    expect(canvasThermalCatalyticRigidStyle(Material.PTNM)).toBe(CanvasThermalCatalyticRigidStyle.Platinum);
    expect(canvasThermalCatalyticRigidStyle(Material.RSSS)).toBe(CanvasThermalCatalyticRigidStyle.Resist);
    for (const material of [Material.Empty, Material.Water, Material.Metal, Material.Coal, -1, 256]) {
      expect(canvasThermalCatalyticRigidStyle(material)).toBe(CanvasThermalCatalyticRigidStyle.None);
      expect(isCanvasThermalCatalyticRigidMaterial(material)).toBe(false);
    }
  });

  it('is depth-proven, bounded, RGB-only, and deterministic', () => {
    for (const material of CANVAS_THERMAL_CATALYTIC_RIGID_MATERIALS) {
      for (let y = -16; y <= 24; y++) for (let x = -16; x <= 24; x++) {
        const first = shade(material, x, y);
        expect(shade(material, x, y)).toEqual(first);
        expect(first[3]).toBe(SOURCE[3]);
        for (let channel = 0; channel < 3; channel++) {
          expect(Math.abs(first[channel] - SOURCE[channel])).toBeLessThanOrEqual(12);
        }
      }
    }
  });

  it('is an exact no-op for shallow or disabled controls', () => {
    for (const material of CANVAS_THERMAL_CATALYTIC_RIGID_MATERIALS) {
      expect(shade(material, 13, 17, false)).toEqual(Array.from(SOURCE));
      expect(shade(material, 13, 17, true, 6)).toEqual(Array.from(SOURCE));
      expect(shade(material, 13, 17, true, 42, 4, false)).toEqual(Array.from(SOURCE));
    }
  });

  it('keeps the three exact owners visually distinct', () => {
    const fingerprints = new Set<string>();
    for (const material of CANVAS_THERMAL_CATALYTIC_RIGID_MATERIALS) {
      const fingerprint: number[] = [];
      for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
        fingerprint.push(...shade(material, x, y, true, 42, x < 20 ? -4 : 4).slice(0, 3));
      }
      fingerprints.add(fingerprint.join(','));
      expect(shade(material, 13, 17, true, 42, 4)).not.toEqual(shade(material, 13, 17, true, 12, 4));
    }
    expect(fingerprints.size).toBe(CANVAS_THERMAL_CATALYTIC_RIGID_MATERIALS.length);
  });
});
