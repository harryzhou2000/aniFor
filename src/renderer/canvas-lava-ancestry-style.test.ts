import { describe, expect, it } from 'vitest';
import { Material } from '../shared/materials';
import { LAVA_PRESENTATION_STATE } from '../simulation/types';
import {
  applyCanvasLavaAncestryStyle,
  canvasLavaAncestryFamily,
  CanvasLavaAncestryFamily,
} from './canvas-lava-ancestry-style';

const SOURCE = [224, 92, 24, 0.75] as const;
const SOURCE_FLOAT = Array.from(new Float32Array(SOURCE));

function encode(origin: number): number {
  return LAVA_PRESENTATION_STATE.presentMask
    | (origin & LAVA_PRESENTATION_STATE.originMask);
}

function styled(material: number, origin: number, x: number, y: number): number[] {
  const output = new Float32Array(SOURCE);
  applyCanvasLavaAncestryStyle(output, material, encode(origin), x, y);
  return Array.from(output);
}

describe('Canvas native typed-Lava ancestry styling', () => {
  it('classifies representative native melt origins without guessing generic state', () => {
    const families = [
      [CanvasLavaAncestryFamily.Silicate, [
        Material.Sand, Material.Stone, Material.Brick, Material.Glass, Material.Ceramic,
        Material.Concrete, Material.Clay, Material.Quartz, Material.BGLA, Material.QRTZ,
        Material.ROCK,
      ]],
      [CanvasLavaAncestryFamily.Metal, [
        Material.Metal, Material.Thermite, Material.BRMT, Material.BMTL, Material.GOLD,
        Material.HEAC, Material.IRON, Material.PTNM, Material.TTAN, Material.TUNG,
      ]],
      [CanvasLavaAncestryFamily.SaltMineral, [Material.Salt, Material.LITH]],
      [CanvasLavaAncestryFamily.Electronic, [
        Material.SLCN, Material.INWR, Material.NSCN, Material.NTCT, Material.PSCN,
        Material.PTCT,
      ]],
      [CanvasLavaAncestryFamily.Radioactive, [
        Material.PLUT, Material.POLO, Material.URAN,
      ]],
    ] as const;
    for (const [family, origins] of families) {
      for (const origin of origins) expect(canvasLavaAncestryFamily(origin)).toBe(family);
    }
    expect(canvasLavaAncestryFamily(0)).toBe(CanvasLavaAncestryFamily.None);
    expect(canvasLavaAncestryFamily(Material.Water)).toBe(CanvasLavaAncestryFamily.None);
  });

  it('requires exact Lava ownership, a present word, and a supported origin', () => {
    const absent = new Float32Array(SOURCE);
    applyCanvasLavaAncestryStyle(absent, Material.Lava, Material.QRTZ, 3, 4);
    expect(Array.from(absent)).toEqual(SOURCE_FLOAT);
    expect(styled(Material.Water, Material.QRTZ, 3, 4)).toEqual(SOURCE_FLOAT);
    expect(styled(Material.Lava, 0, 3, 4)).toEqual(SOURCE_FLOAT);
    expect(styled(Material.Lava, Material.Water, 3, 4)).toEqual(SOURCE_FLOAT);
  });

  it('gives each representative molten family a distinct spectral response', () => {
    const responses = [
      Material.QRTZ, Material.Metal, Material.Salt, Material.SLCN, Material.POLO,
    ].map((origin) => styled(Material.Lava, origin, 11, 7));
    expect(new Set(responses.map((value) => value.slice(0, 3).join(','))).size).toBe(5);
    for (const response of responses) expect(response).not.toEqual(SOURCE_FLOAT);
  });

  it('retains exact origin identity as a shifted stable mark within one family', () => {
    let differs = false;
    for (let y = 0; y < 23 && !differs; y++) for (let x = 0; x < 23; x++) {
      if (styled(Material.Lava, Material.Metal, x, y).join(',')
        !== styled(Material.Lava, Material.GOLD, x, y).join(',')) differs = true;
    }
    expect(differs).toBe(true);
  });

  it('is deterministic, world-periodic, RGB-bounded, and alpha-invariant', () => {
    const origins = [Material.QRTZ, Material.Metal, Material.Salt, Material.SLCN, Material.POLO];
    for (const origin of origins) for (let y = -24; y <= 24; y++) for (let x = -24; x <= 24; x++) {
      const first = styled(Material.Lava, origin, x, y);
      expect(styled(Material.Lava, origin, x, y)).toEqual(first);
      expect(styled(Material.Lava, origin, x + 0.75, y + 0.25)).toEqual(first);
      expect(styled(Material.Lava, origin, x + 391, y + 391)).toEqual(first);
      for (let channel = 0; channel < 3; channel++) {
        expect(Math.abs(first[channel] - SOURCE[channel])).toBeLessThanOrEqual(16);
      }
      expect(first[3]).toBe(SOURCE_FLOAT[3]);
    }
  });
});
