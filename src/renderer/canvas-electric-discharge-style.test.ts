import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import {
  applyCanvasElectricDischargeStyle,
  CANVAS_ELECTRIC_DISCHARGE_MATERIALS,
  CanvasElectricDischargeStyle,
  canvasElectricDischargeStyle,
  isCanvasElectricDischargeMaterial,
} from './canvas-electric-discharge-style';

function styled(material: number, x: number, y: number): Float32Array {
  const output = new Float32Array([128, 128, 128, 173]);
  applyCanvasElectricDischargeStyle(output, material, x, y);
  return output;
}

describe('canvas electric discharge style', () => {
  it('styles exactly native Lightning and Thunder owners', () => {
    expect(CANVAS_ELECTRIC_DISCHARGE_MATERIALS).toEqual([Material.LIGH, Material.THDR]);
    expect(canvasElectricDischargeStyle(Material.LIGH)).toBe(
      CanvasElectricDischargeStyle.Lightning,
    );
    expect(canvasElectricDischargeStyle(Material.THDR)).toBe(CanvasElectricDischargeStyle.Thunder);
    expect(isCanvasElectricDischargeMaterial(Material.LIGH)).toBe(true);
    expect(isCanvasElectricDischargeMaterial(Material.THDR)).toBe(true);

    for (const control of [
      Material.Fire,
      Material.CFLM,
      Material.Nitro,
      Material.LRBD,
      Material.Gunpowder,
      0,
      -1,
      256,
      93.5,
    ]) {
      expect(canvasElectricDischargeStyle(control)).toBe(CanvasElectricDischargeStyle.None);
      expect(isCanvasElectricDischargeMaterial(control)).toBe(false);
    }
  });

  it('is deterministic, leaves alpha intact, and bounds every RGB delta', () => {
    for (const material of CANVAS_ELECTRIC_DISCHARGE_MATERIALS) {
      for (const [x, y] of [
        [0, 0],
        [17.9, -6.2],
        [-31.1, 48.8],
        [611.99, 383.01],
      ]) {
        const first = styled(material, x, y);
        const second = styled(material, x, y);
        expect(Array.from(second)).toEqual(Array.from(first));
        expect(first[3]).toBe(173);
        for (let channel = 0; channel < 3; channel += 1) {
          expect(Math.abs(first[channel] - 128)).toBeLessThanOrEqual(18);
        }
      }
    }
  });

  it('gives Lightning a cool branch and Thunder a warm charged fork', () => {
    const lightning = styled(Material.LIGH, 0, 0);
    const thunder = styled(Material.THDR, 0, 0);

    expect(lightning[2]).toBeGreaterThan(lightning[1]);
    expect(lightning[1]).toBeGreaterThan(lightning[0]);
    expect(thunder[0]).toBeGreaterThan(thunder[1]);
    expect(thunder[1]).toBeGreaterThan(thunder[2]);
  });

  it('leaves non-owners byte-identical', () => {
    const output = new Float32Array([111, 122, 133, 144]);
    applyCanvasElectricDischargeStyle(output, Material.CFLM, 12, 24);
    expect(Array.from(output)).toEqual([111, 122, 133, 144]);
  });
});
