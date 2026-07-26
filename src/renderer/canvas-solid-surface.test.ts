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
      Material.Empty, Material.Metal, Material.Empty,
      Material.Metal, Material.Empty, Material.Metal,
      Material.Empty, Material.Metal, Material.Empty,
    ]);
    const pixels = seed(materials);
    reconstructSolidSurface(pixels, materials, styles, palette, 3, 3);
    expect(materials[4]).toBe(Material.Empty);
    expect(pixels[4 * 4 + 3]).toBeGreaterThan(150);
  });

  it('keeps accepted fill near opaque and monotonic with diagonal support', () => {
    const alphaFor = (materials: Uint8Array): number => {
      const pixels = seed(materials);
      reconstructSolidSurface(pixels, materials, styles, palette, 3, 3);
      return pixels[4 * 4 + 3];
    };
    const ordinaryMaterial = [Material.Brick, Material.Ceramic, Material.Metal, Material.TTAN]
      .find((material) => styles[material * 4 + 3] === 0);
    if (ordinaryMaterial === undefined) throw new Error('generic solid control is unavailable');
    const cardinalOnly = new Uint8Array([
      Material.Empty, ordinaryMaterial, Material.Empty,
      ordinaryMaterial, Material.Empty, ordinaryMaterial,
      Material.Empty, ordinaryMaterial, Material.Empty,
    ]);
    const oneDiagonal = cardinalOnly.slice();
    oneDiagonal[0] = ordinaryMaterial;
    const twoDiagonals = oneDiagonal.slice();
    twoDiagonals[2] = ordinaryMaterial;
    const threeDiagonals = twoDiagonals.slice();
    threeDiagonals[6] = ordinaryMaterial;
    const fullySupported = new Uint8Array(9).fill(ordinaryMaterial);
    fullySupported[4] = Material.Empty;
    const alphas = [cardinalOnly, oneDiagonal, twoDiagonals, threeDiagonals, fullySupported].map(alphaFor);
    expect(alphas.every((alpha) => alpha >= 225)).toBe(true);
    for (let index = 1; index < alphas.length; index++) {
      expect(alphas[index]).toBeGreaterThan(alphas[index - 1]);
    }
  });

  it('keeps canonical trait cavities at the high end of the accepted alpha band', () => {
    const materials = new Uint8Array([
      Material.Empty, Material.VIBR, Material.Empty,
      Material.VIBR, Material.Empty, Material.VIBR,
      Material.Empty, Material.VIBR, Material.Empty,
    ]);
    const pixels = seed(materials);
    reconstructSolidSurface(pixels, materials, styles, palette, 3, 3);
    expect(pixels[4 * 4 + 3]).toBe(250);
    const paletteOffset = Material.VIBR * 4;
    expect(Array.from(pixels.slice(16, 19))).toEqual(Array.from(palette.slice(paletteOffset, paletteOffset + 3)));
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

  it('closes a bounded three-cell internal crack using distance-two support', () => {
    const width = 7;
    const height = 7;
    const materials = new Uint8Array(width * height).fill(Material.Wood);
    for (let y = 2; y <= 4; y++) materials[y * width + 3] = Material.Empty;
    const pixels = seed(materials);
    reconstructSolidSurface(pixels, materials, styles, palette, width, height);
    for (let y = 2; y <= 4; y++) expect(pixels[(y * width + 3) * 4 + 3]).toBeGreaterThan(190);
  });

  it('closes an exactly bounded 2x2 cavity from every corner orientation without changing semantics', () => {
    const width = 9;
    const height = 9;
    const centerX = 4;
    const centerY = 4;
    for (const [directionX, directionY] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
      const materials = new Uint8Array(width * height).fill(Material.Wood);
      const holes = [
        centerY * width + centerX,
        centerY * width + centerX + directionX,
        (centerY + directionY) * width + centerX,
        (centerY + directionY) * width + centerX + directionX,
      ];
      for (const hole of holes) materials[hole] = Material.Empty;
      const semantics = materials.slice();
      const pixels = seed(materials);
      reconstructSolidSurface(pixels, materials, styles, palette, width, height);
      expect(materials).toEqual(semantics);
      for (const hole of holes) expect(pixels[hole * 4 + 3]).toBeGreaterThan(190);
    }
  });

  it('keeps native LIFE dead cells exact instead of reconstructing automata cavities', () => {
    const width = 7;
    const height = 7;
    for (const size of [1, 2]) {
      const materials = new Uint8Array(width * height).fill(Material.LIFE_GOL);
      const holes: number[] = [];
      for (let y = 3; y < 3 + size; y++) for (let x = 3; x < 3 + size; x++) {
        const index = y * width + x;
        materials[index] = Material.Empty;
        holes.push(index);
      }
      const pixels = seed(materials);
      reconstructSolidSurface(pixels, materials, styles, palette, width, height);
      for (const hole of holes) expect(pixels[hole * 4 + 3]).toBe(0);
    }
  });

  it('keeps an unsupported L elbow open while closing its locally supported arms', () => {
    const width = 7;
    const height = 7;
    const center = 3 * width + 3;
    const materials = new Uint8Array(width * height).fill(Material.Wood);
    materials[center] = Material.Empty;
    materials[center + 1] = Material.Empty;
    materials[center + width] = Material.Empty;
    const pixels = seed(materials);
    reconstructSolidSurface(pixels, materials, styles, palette, width, height);
    expect(pixels[center * 4 + 3]).toBe(0);
    expect(pixels[(center + 1) * 4 + 3]).toBeGreaterThan(190);
    expect(pixels[(center + width) * 4 + 3]).toBeGreaterThan(190);
  });

  it('does not close a 3x3 cavity', () => {
    const width = 9;
    const height = 9;
    const materials = new Uint8Array(width * height).fill(Material.Wood);
    const holes: number[] = [];
    for (let y = 3; y <= 5; y++) for (let x = 3; x <= 5; x++) {
      const index = y * width + x;
      materials[index] = Material.Empty;
      holes.push(index);
    }
    const pixels = seed(materials);
    reconstructSolidSurface(pixels, materials, styles, palette, width, height);
    for (const hole of holes) expect(pixels[hole * 4 + 3]).toBe(0);
  });

  it('rejects a 2x2 cavity with an open channel or missing perimeter segment', () => {
    const width = 9;
    const height = 9;
    const target = 3 * width + 3;
    const open = new Uint8Array(width * height).fill(Material.Wood);
    for (let y = 3; y <= 4; y++) for (let x = 3; x <= 4; x++) open[y * width + x] = Material.Empty;
    for (let x = 5; x < width; x++) open[3 * width + x] = Material.Empty;
    const openPixels = seed(open);
    reconstructSolidSurface(openPixels, open, styles, palette, width, height);
    expect(openPixels[target * 4 + 3]).toBe(0);

    for (const opening of [
      [5, 4], // side continuation
      [5, 5], // far diagonal
    ] as const) {
      const materials = new Uint8Array(width * height).fill(Material.Wood);
      for (let y = 3; y <= 4; y++) for (let x = 3; x <= 4; x++) materials[y * width + x] = Material.Empty;
      materials[opening[1] * width + opening[0]] = Material.Empty;
      const pixels = seed(materials);
      reconstructSolidSurface(pixels, materials, styles, palette, width, height);
      expect(pixels[target * 4 + 3]).toBe(0);
    }
  });

  it('rejects a 2x2 cavity with a mixed-material outer ring', () => {
    const width = 9;
    const height = 9;
    const target = 3 * width + 3;
    const materials = new Uint8Array(width * height).fill(Material.Wood);
    for (let y = 3; y <= 4; y++) for (let x = 3; x <= 4; x++) materials[y * width + x] = Material.Empty;
    materials[4 * width + 5] = Material.Metal;
    const pixels = seed(materials);
    reconstructSolidSurface(pixels, materials, styles, palette, width, height);
    expect(pixels[target * 4 + 3]).toBe(0);
  });

  it('does not reconstruct a border 2x2 cavity or a powder-surrounded cavity', () => {
    const width = 7;
    const height = 7;
    const border = new Uint8Array(width * height).fill(Material.Wood);
    for (let y = 0; y <= 1; y++) for (let x = 0; x <= 1; x++) border[y * width + x] = Material.Empty;
    const borderPixels = seed(border);
    reconstructSolidSurface(borderPixels, border, styles, palette, width, height);
    for (let y = 0; y <= 1; y++) for (let x = 0; x <= 1; x++) {
      expect(borderPixels[(y * width + x) * 4 + 3]).toBe(0);
    }

    const powder = new Uint8Array(width * height).fill(Material.Sand);
    for (let y = 3; y <= 4; y++) for (let x = 3; x <= 4; x++) powder[y * width + x] = Material.Empty;
    const powderPixels = seed(powder);
    reconstructSolidSurface(powderPixels, powder, styles, palette, width, height);
    for (let y = 3; y <= 4; y++) for (let x = 3; x <= 4; x++) {
      expect(powderPixels[(y * width + x) * 4 + 3]).toBe(0);
    }
  });

  it('preserves a native-wall target inside an otherwise bounded 2x2 cavity', () => {
    const width = 7;
    const height = 7;
    const target = 3 * width + 3;
    const materials = new Uint8Array(width * height).fill(Material.Wood);
    for (let y = 3; y <= 4; y++) for (let x = 3; x <= 4; x++) materials[y * width + x] = Material.Empty;
    const pixels = seed(materials);
    pixels.set([30, 40, 50, 255], target * 4);
    reconstructSolidSurface(pixels, materials, styles, palette, width, height);
    expect(Array.from(pixels.slice(target * 4, target * 4 + 4))).toEqual([30, 40, 50, 255]);
  });

  it('uses canonical RGB for trait-bearing 2x2 cavity support', () => {
    const width = 7;
    const height = 7;
    const materials = new Uint8Array(width * height).fill(Material.VIBR);
    const holes: number[] = [];
    for (let y = 3; y <= 4; y++) for (let x = 3; x <= 4; x++) {
      const index = y * width + x;
      materials[index] = Material.Empty;
      holes.push(index);
    }
    const semantics = materials.slice();
    const pixels = seed(materials);
    reconstructSolidSurface(pixels, materials, styles, palette, width, height);
    const paletteOffset = Material.VIBR * 4;
    expect(styles[paletteOffset + 3]).toBeGreaterThan(0);
    expect(materials).toEqual(semantics);
    for (const hole of holes) {
      expect(Array.from(pixels.slice(hole * 4, hole * 4 + 3)))
        .toEqual(Array.from(palette.slice(paletteOffset, paletteOffset + 3)));
    }
  });

  it('keeps an unbounded thin notch and a distance-two mixed seam open', () => {
    const width = 7;
    const height = 7;
    const open = new Uint8Array(width * height).fill(Material.Wood);
    for (let y = 0; y <= 3; y++) open[y * width + 3] = Material.Empty;
    const openPixels = seed(open);
    reconstructSolidSurface(openPixels, open, styles, palette, width, height);
    expect(openPixels[(2 * width + 3) * 4 + 3]).toBe(0);

    const mixed = new Uint8Array(width * height).fill(Material.Wood);
    for (let y = 2; y <= 4; y++) mixed[y * width + 3] = Material.Empty;
    mixed[1 * width + 3] = Material.Metal;
    const mixedPixels = seed(mixed);
    reconstructSolidSurface(mixedPixels, mixed, styles, palette, width, height);
    expect(mixedPixels[(3 * width + 3) * 4 + 3]).toBe(0);
  });

  it('rejects sparse crosses without continuous crack side walls', () => {
    const width = 7;
    const height = 7;
    const center = 3 * width + 3;
    for (const orientation of ['vertical', 'horizontal'] as const) {
      const materials = new Uint8Array(width * height);
      if (orientation === 'vertical') {
        materials[center - 1] = Material.Wood;
        materials[center + 1] = Material.Wood;
        materials[center - width * 2] = Material.Wood;
        materials[center + width * 2] = Material.Wood;
      } else {
        materials[center - width] = Material.Wood;
        materials[center + width] = Material.Wood;
        materials[center - 2] = Material.Wood;
        materials[center + 2] = Material.Wood;
      }
      const pixels = seed(materials);
      reconstructSolidSurface(pixels, materials, styles, palette, width, height);
      expect(pixels[center * 4 + 3]).toBe(0);
    }
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
    const materials = new Uint8Array(9).fill(Material.VIBR);
    materials[4] = Material.Empty;
    const pixels = seed(materials);
    reconstructSolidSurface(pixels, materials, styles, palette, 3, 3);
    const offset = Material.VIBR * 4;
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

    const powder = new Uint8Array(9).fill(Material.Sand);
    powder[4] = Material.Empty;
    const powderPixels = seed(powder);
    reconstructSolidSurface(powderPixels, powder, styles, palette, 3, 3);
    expect(powderPixels[4 * 4 + 3]).toBe(0);
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
