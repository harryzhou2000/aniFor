import { describe, expect, it } from 'vitest';
import { ALL_MATERIALS, Material } from '../shared/materials';
import { reconstructSolidSurface } from './canvas-solid-surface';
import { createRenderLookups } from './render-field-set';

describe('Canvas solid surface reconstruction', () => {
  const styles = createRenderLookups(ALL_MATERIALS).styleBytes;

  it('closes a fully enclosed same-solid pinhole without changing semantics', () => {
    const materials = new Uint8Array([
      Material.Empty, Material.Wood, Material.Empty,
      Material.Wood, Material.Empty, Material.Wood,
      Material.Empty, Material.Wood, Material.Empty,
    ]);
    const pixels = seed(materials);
    reconstructSolidSurface(pixels, materials, styles, 3, 3);
    expect(materials[4]).toBe(Material.Empty);
    expect(pixels[4 * 4 + 3]).toBeGreaterThan(150);
  });

  it('keeps an exposed notch open', () => {
    const materials = new Uint8Array([
      Material.Empty, Material.Empty, Material.Empty,
      Material.Wood, Material.Empty, Material.Wood,
      Material.Empty, Material.Wood, Material.Empty,
    ]);
    const pixels = seed(materials);
    reconstructSolidSurface(pixels, materials, styles, 3, 3);
    expect(pixels[4 * 4 + 3]).toBe(0);
  });

  it('does not bridge mixed-solid seams', () => {
    const materials = new Uint8Array([
      Material.Empty, Material.Wood, Material.Empty,
      Material.Metal, Material.Empty, Material.Wood,
      Material.Empty, Material.Metal, Material.Empty,
    ]);
    const pixels = seed(materials);
    reconstructSolidSurface(pixels, materials, styles, 3, 3);
    expect(pixels[4 * 4 + 3]).toBe(0);
  });

  it('does not overwrite an occupied particle or reconstruct field edges', () => {
    const materials = new Uint8Array(9).fill(Material.Wood);
    materials[4] = Material.Sand;
    const pixels = seed(materials);
    const occupied = Array.from(pixels.slice(16, 20));
    reconstructSolidSurface(pixels, materials, styles, 3, 3);
    expect(Array.from(pixels.slice(16, 20))).toEqual(occupied);

    const edgeMaterials = new Uint8Array(9).fill(Material.Wood);
    edgeMaterials[1] = Material.Empty;
    const edgePixels = seed(edgeMaterials);
    reconstructSolidSurface(edgePixels, edgeMaterials, styles, 3, 3);
    expect(edgePixels[1 * 4 + 3]).toBe(0);
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
