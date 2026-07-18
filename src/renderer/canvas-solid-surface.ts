import { RenderPhase } from './render-profile';
import { compositePixel } from './rgba-composite';

/**
 * Closes small same-material cavities in the Canvas solid plane. The semantic
 * field is never changed, deep notches stay open, and unlike materials/phases
 * cannot bleed across their interface.
 */
export function reconstructSolidSurface(
  target: Uint8ClampedArray,
  materials: Uint8Array,
  styleBytes: Uint8Array,
  paletteBytes: Uint8Array,
  width: number,
  height: number,
): void {
  if (target.length !== materials.length * 4 || width * height !== materials.length) {
    throw new Error('Canvas solid surface size mismatch');
  }
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const index = y * width + x;
    if (materials[index] !== 0) continue;
    const pixel = index * 4;
    if (target[pixel + 3] !== 0) continue;
    let material = 0;
    let neighbours = 0;
    let cardinal = 0;
    let cardinalMask = 0;
    let red = 0;
    let green = 0;
    let blue = 0;
    let alpha = 0;
    let foreign = false;
    for (let offsetY = -1; offsetY <= 1; offsetY++) for (let offsetX = -1; offsetX <= 1; offsetX++) {
      if (offsetX === 0 && offsetY === 0) continue;
      const neighbour = index + offsetY * width + offsetX;
      const candidate = materials[neighbour];
      if (!candidate) continue;
      if (styleBytes[candidate * 4] !== RenderPhase.Solid) {
        foreign = true;
        continue;
      }
      if (!material) material = candidate;
      if (candidate !== material) {
        foreign = true;
        continue;
      }
      const neighbourPixel = neighbour * 4;
      neighbours++;
      if (offsetX === 0 || offsetY === 0) {
        cardinal++;
        if (offsetY === -1) cardinalMask |= 1;
        else if (offsetX === -1) cardinalMask |= 2;
        else if (offsetX === 1) cardinalMask |= 4;
        else cardinalMask |= 8;
      }
      red += target[neighbourPixel];
      green += target[neighbourPixel + 1];
      blue += target[neighbourPixel + 2];
      alpha += target[neighbourPixel + 3];
    }
    const cardinallyEnclosed = cardinal === 4;
    const denseSupport = neighbours >= 5 && cardinal >= 3;
    // A one-cell-wide internal crack can have only the two opposing side
    // supports locally. Prove that its missing axis closes two cells away before
    // reconstructing it; open notches and mixed-material seams remain empty.
    const verticalCrack = cardinalMask === 6 && neighbours === 6 && y >= 2 && y < height - 2
      && materials[index - width * 2] === material && materials[index + width * 2] === material;
    const horizontalCrack = cardinalMask === 9 && neighbours === 6 && x >= 2 && x < width - 2
      && materials[index - 2] === material && materials[index + 2] === material;
    const thinCrack = verticalCrack || horizontalCrack;
    if (foreign || !material || (!cardinallyEnclosed && !denseSupport && !thinCrack) || alpha <= 0) continue;
    const opacity = thinCrack
      ? 0.82
      : (cardinallyEnclosed
        ? 0.78 + 0.05 * (neighbours - 4)
        : 0.62 + 0.12 * (neighbours - 5));
    const materialOffset = material * 4;
    const hasSemanticTraits = styleBytes[materialOffset + 3] !== 0;
    compositePixel(
      target,
      pixel,
      hasSemanticTraits ? paletteBytes[materialOffset] : red / neighbours,
      hasSemanticTraits ? paletteBytes[materialOffset + 1] : green / neighbours,
      hasSemanticTraits ? paletteBytes[materialOffset + 2] : blue / neighbours,
      alpha / neighbours * opacity,
    );
  }
}
