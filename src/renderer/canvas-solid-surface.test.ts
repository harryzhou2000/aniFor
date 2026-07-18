import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { reconstructSolidSurface } from './canvas-solid-surface';
import { createRenderLookups } from './render-field-set';

describe('Canvas solid surface reconstruction', () => {
  const lookups = createRenderLookups(ALL_MATERIALS);
  const styles = lookups.styleBytes;
  const palette = lookups.paletteBytes;

  it('closes a fully enclosed same-solid pinhole without changing semantics', () => {
    const materials = new Uint8Array([
      Material.Empty, Material.Wood, Material.Empty,
      Material.Wood, Material.Empty, Material.Wood,
      Material.Empty, Material.Wood, Material.Empty,
    ]);
    const pixels = seed(materials);
    reconstructSolidSurface(pixels, materials, styles, palette, 3, 3);
    expect(materials[4]).toBe(Material.Empty);
    expect(pixels[4 * 4 + 3]).toBeGreaterThan(150);
  });

  it('increases enclosed fill opacity monotonically with diagonal support', () => {
    const alphaFor = (materials: Uint8Array): number => {
      const pixels = seed(materials);
      reconstructSolidSurface(pixels, materials, styles, palette, 3, 3);
      return pixels[4 * 4 + 3];
    };
    const cardinalOnly = new Uint8Array([
      Material.Empty, Material.Wood, Material.Empty,
      Material.Wood, Material.Empty, Material.Wood,
      Material.Empty, Material.Wood, Material.Empty,
    ]);
    const oneDiagonal = cardinalOnly.slice();
    oneDiagonal[0] = Material.Wood;
    const fullySupported = new Uint8Array(9).fill(Material.Wood);
    fullySupported[4] = Material.Empty;
    expect(alphaFor(oneDiagonal)).toBeGreaterThan(alphaFor(cardinalOnly));
    expect(alphaFor(fullySupported)).toBeGreaterThan(alphaFor(oneDiagonal));
  });

  it('closes a two-cell cavity without propagating through reconstructed pixels', () => {
    const materials = new Uint8Array(15).fill(Material.Wood);
    materials[7] = Material.Empty;
    materials[8] = Material.Empty;
    const pixels = seed(materials);
    reconstructSolidSurface(pixels, materials, styles, palette, 5, 3);
    expect(materials[7]).toBe(Material.Empty);
    expect(materials[8]).toBe(Material.Empty);
    expect(pixels[7 * 4 + 3]).toBeGreaterThan(150);
    expect(pixels[8 * 4 + 3]).toBeGreaterThan(150);
  });

  it('requires three cardinal supports for a shallow cavity', () => {
    const accepted = new Uint8Array([
      Material.Wood, Material.Wood, Material.Empty,
      Material.Wood, Material.Empty, Material.Empty,
      Material.Wood, Material.Wood, Material.Empty,
    ]);
    const acceptedPixels = seed(accepted);
    reconstructSolidSurface(acceptedPixels, accepted, styles, palette, 3, 3);
    expect(acceptedPixels[4 * 4 + 3]).toBeGreaterThan(0);

    const rejected = new Uint8Array([
      Material.Wood, Material.Empty, Material.Wood,
      Material.Wood, Material.Empty, Material.Wood,
      Material.Wood, Material.Empty, Material.Empty,
    ]);
    const rejectedPixels = seed(rejected);
    reconstructSolidSurface(rejectedPixels, rejected, styles, palette, 3, 3);
    expect(rejectedPixels[4 * 4 + 3]).toBe(0);
  });

  it('keeps semantic role accents out of reconstructed empty cells', () => {
    const materials = new Uint8Array(9).fill(Material.PLUT);
    materials[4] = Material.Empty;
    const pixels = seed(materials);
    reconstructSolidSurface(pixels, materials, styles, palette, 3, 3);
    const offset = Material.PLUT * 4;
    expect(styles[offset + 3]).toBeGreaterThan(0);
    expect(Array.from(pixels.slice(16, 19))).toEqual(Array.from(palette.slice(offset, offset + 3)));
  });

  it('keeps an exposed notch open', () => {
    const materials = new Uint8Array([
      Material.Empty, Material.Empty, Material.Empty,
      Material.Wood, Material.Empty, Material.Wood,
      Material.Empty, Material.Wood, Material.Empty,
    ]);
    const pixels = seed(materials);
    reconstructSolidSurface(pixels, materials, styles, palette, 3, 3);
    expect(pixels[4 * 4 + 3]).toBe(0);
  });

  it('does not bridge mixed-solid seams', () => {
    const materials = new Uint8Array([
      Material.Empty, Material.Wood, Material.Empty,
      Material.Metal, Material.Empty, Material.Wood,
      Material.Empty, Material.Metal, Material.Empty,
    ]);
    const pixels = seed(materials);
    reconstructSolidSurface(pixels, materials, styles, palette, 3, 3);
    expect(pixels[4 * 4 + 3]).toBe(0);

    const contaminated = new Uint8Array(9).fill(Material.Wood);
    contaminated[4] = Material.Empty;
    contaminated[8] = Material.Metal;
    const contaminatedPixels = seed(contaminated);
    reconstructSolidSurface(contaminatedPixels, contaminated, styles, palette, 3, 3);
    expect(contaminatedPixels[4 * 4 + 3]).toBe(0);

    const liquid = new Uint8Array(9).fill(Material.Water);
    liquid[4] = Material.Empty;
    const liquidPixels = seed(liquid);
    reconstructSolidSurface(liquidPixels, liquid, styles, palette, 3, 3);
    expect(liquidPixels[4 * 4 + 3]).toBe(0);
  });

  it('does not overwrite an occupied particle or reconstruct field edges', () => {
    const materials = new Uint8Array(9).fill(Material.Wood);
    materials[4] = Material.Sand;
    const pixels = seed(materials);
    const occupied = Array.from(pixels.slice(16, 20));
    reconstructSolidSurface(pixels, materials, styles, palette, 3, 3);
    expect(Array.from(pixels.slice(16, 20))).toEqual(occupied);

    const edgeMaterials = new Uint8Array(9).fill(Material.Wood);
    edgeMaterials[1] = Material.Empty;
    const edgePixels = seed(edgeMaterials);
    reconstructSolidSurface(edgePixels, edgeMaterials, styles, palette, 3, 3);
    expect(edgePixels[1 * 4 + 3]).toBe(0);

    const wallHole = new Uint8Array(9).fill(Material.Wood);
    wallHole[4] = Material.Empty;
    const wallPixels = seed(wallHole);
    wallPixels[16] = 30;
    wallPixels[17] = 40;
    wallPixels[18] = 50;
    wallPixels[19] = 255;
    reconstructSolidSurface(wallPixels, wallHole, styles, palette, 3, 3);
    expect(Array.from(wallPixels.slice(16, 20))).toEqual([30, 40, 50, 255]);
  });

  function seed(materials: Uint8Array): Uint8ClampedArray {
    const pixels = new Uint8ClampedArray(materials.length * 4);
    for (let index = 0; index < materials.length; index++) {
      if (!materials[index]) continue;
      pixels[index * 4] = 118;
      pixels[index * 4 + 1] = 82;
      pixels[index * 4 + 2] = 54;
      pixels[index * 4 + 3] = 255;
    }
    return pixels;
  }
});
