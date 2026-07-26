import { RenderPhase } from './render-profile';
import { RenderOptics } from './render-optics';
import { compositePixel } from './rgba-composite';

/**
 * Returns the exact solid material that may presentation-fill one semantic
 * Empty cell, or zero when the cavity is open, mixed, cellular, or at an edge.
 * It is independent of styled source pixels so the contour compositor can
 * re-prove a reconstructed payload without assigning it a material owner.
 */
export function solidCavitySupportAt(
  materials: Uint8Array,
  styleBytes: Uint8Array,
  paletteBytes: Uint8Array,
  width: number,
  height: number,
  index: number,
): number {
  if (index < 0 || index >= materials.length || width * height !== materials.length
    || materials[index] !== 0) return 0;
  const x = index % width;
  const y = Math.floor(index / width);
  if (x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1) return 0;

  let material = 0;
  let neighbours = 0;
  let cardinal = 0;
  let cardinalMask = 0;
  let foreign = false;
  for (let offsetY = -1; offsetY <= 1; offsetY++) for (let offsetX = -1; offsetX <= 1; offsetX++) {
    if (offsetX === 0 && offsetY === 0) continue;
    const candidate = materials[index + offsetY * width + offsetX];
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
    neighbours++;
    if (offsetX === 0 || offsetY === 0) {
      cardinal++;
      if (offsetY === -1) cardinalMask |= 1;
      else if (offsetX === -1) cardinalMask |= 2;
      else if (offsetX === 1) cardinalMask |= 4;
      else cardinalMask |= 8;
    }
  }
  if (foreign || !material || paletteBytes[material * 4 + 3] === RenderOptics.Cellular) return 0;
  const verticalCrack = cardinalMask === 6 && neighbours === 6 && y >= 2 && y < height - 2
    && materials[index - width * 2] === material && materials[index + width * 2] === material;
  const horizontalCrack = cardinalMask === 9 && neighbours === 6 && x >= 2 && x < width - 2
    && materials[index - 2] === material && materials[index + 2] === material;
  if (cardinal === 4 || (neighbours >= 5 && cardinal >= 3) || verticalCrack || horizontalCrack) {
    return material;
  }
  // A 2x2 cavity gives each void cell only two cardinal supports. Examine its
  // four possible placements only after the inexpensive local scan found five
  // exact neighbours, keeping broad empty space on the fast rejection path.
  if (neighbours < 5) return 0;
  for (let topY = y - 1; topY <= y; topY++) for (let topX = x - 1; topX <= x; topX++) {
    const owner = solidTwoByTwoCavityOwnerAt(
      materials, styleBytes, paletteBytes, width, height, topX, topY,
    );
    if (owner !== 0) return owner;
  }
  return 0;
}

/** Checks the twelve-cell exact-solid perimeter around the named 2x2 void. */
function solidTwoByTwoCavityOwnerAt(
  materials: Uint8Array,
  styleBytes: Uint8Array,
  paletteBytes: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  if (x < 1 || y < 1 || x >= width - 2 || y >= height - 2) return 0;
  const index = y * width + x;
  if (materials[index] !== 0 || materials[index + 1] !== 0
    || materials[index + width] !== 0 || materials[index + width + 1] !== 0) return 0;
  const topLeft = index - width - 1;
  const material = materials[topLeft];
  if (material === 0 || styleBytes[material * 4] !== RenderPhase.Solid
    || paletteBytes[material * 4 + 3] === RenderOptics.Cellular) return 0;
  const bottomLeft = index + width * 2 - 1;
  return materials[topLeft + 1] === material
    && materials[topLeft + 2] === material
    && materials[topLeft + 3] === material
    && materials[index - 1] === material
    && materials[index + 2] === material
    && materials[index + width - 1] === material
    && materials[index + width + 2] === material
    && materials[bottomLeft] === material
    && materials[bottomLeft + 1] === material
    && materials[bottomLeft + 2] === material
    && materials[bottomLeft + 3] === material
    ? material : 0;
}

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
    // Recognize a fully empty 2x2 block once, at its top-left cell. Proving
    // the complete 12-cell perimeter here avoids repeating the general
    // neighbourhood scan and seven distance-two reads for all four holes.
    if (x < width - 2 && y < height - 2
      && materials[index + 1] === 0
      && materials[index + width] === 0
      && materials[index + width + 1] === 0
      && target[pixel + 7] === 0
      && target[pixel + width * 4 + 3] === 0
      && target[pixel + width * 4 + 7] === 0) {
      const topLeft = index - width - 1;
      const material = materials[topLeft];
      const bottomLeft = index + width * 2 - 1;
      if (material !== 0 && styleBytes[material * 4] === RenderPhase.Solid
        && paletteBytes[material * 4 + 3] !== RenderOptics.Cellular
        && materials[topLeft + 1] === material
        && materials[topLeft + 2] === material
        && materials[topLeft + 3] === material
        && materials[index - 1] === material
        && materials[index + 2] === material
        && materials[index + width - 1] === material
        && materials[index + width + 2] === material
        && materials[bottomLeft] === material
        && materials[bottomLeft + 1] === material
        && materials[bottomLeft + 2] === material
        && materials[bottomLeft + 3] === material) {
        const topRight = topLeft + 3;
        const bottomRight = bottomLeft + 3;
        const donorTopLeft = topLeft * 4;
        const donorTopRight = topRight * 4;
        const donorBottomLeft = bottomLeft * 4;
        const donorBottomRight = bottomRight * 4;
        const materialOffset = material * 4;
        const hasSemanticTraits = styleBytes[materialOffset + 3] !== 0;
        const red = hasSemanticTraits ? paletteBytes[materialOffset]
          : (target[donorTopLeft] + target[donorTopRight]
            + target[donorBottomLeft] + target[donorBottomRight]) * 0.25;
        const green = hasSemanticTraits ? paletteBytes[materialOffset + 1]
          : (target[donorTopLeft + 1] + target[donorTopRight + 1]
            + target[donorBottomLeft + 1] + target[donorBottomRight + 1]) * 0.25;
        const blue = hasSemanticTraits ? paletteBytes[materialOffset + 2]
          : (target[donorTopLeft + 2] + target[donorTopRight + 2]
            + target[donorBottomLeft + 2] + target[donorBottomRight + 2]) * 0.25;
        // Role-bearing material cavities deliberately retain canonical RGB
        // rather than inheriting a styled donor. Use the top of the existing
        // accepted-cavity opacity band so a dark native palette remains joined
        // support instead of reading as a square black pinhole.
        const opacity = hasSemanticTraits ? 0.98 : 0.92;
        const alpha = (target[donorTopLeft + 3] + target[donorTopRight + 3]
          + target[donorBottomLeft + 3] + target[donorBottomRight + 3]) * 0.25 * opacity;
        if (alpha > 0) {
          compositePixel(target, pixel, red, green, blue, alpha);
          compositePixel(target, pixel + 4, red, green, blue, alpha);
          compositePixel(target, pixel + width * 4, red, green, blue, alpha);
          compositePixel(target, pixel + width * 4 + 4, red, green, blue, alpha);
          continue;
        }
      }
    }
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
    const localSupport = cardinallyEnclosed || denseSupport || thinCrack;
    if (foreign || !material || !localSupport || alpha <= 0) continue;
    if (paletteBytes[material * 4 + 3] === RenderOptics.Cellular) continue;
    // Keep the renderer and contour compositor on one exact eligibility proof.
    // This is redundant with the accumulated donor scan above only to retain
    // those averages in this hot path; the shared predicate prevents future
    // reconstruction/contour admission drift.
    if (solidCavitySupportAt(materials, styleBytes, paletteBytes, width, height, index) !== material) {
      continue;
    }
    // Eligibility remains conservative, but once the exact-material enclosure
    // is proven it is presentation support, not translucent confidence. Keep a
    // narrow monotonic band only for subtle depth so black cannot show through
    // an otherwise accepted cavity as a cell-sized pit.
    const materialOffset = material * 4;
    const hasSemanticTraits = styleBytes[materialOffset + 3] !== 0;
    // Canonical trait RGB can be intentionally dark (for example VIBR). Keep
    // its proven support at the high end of the established 0.90–0.98 alpha
    // band; this changes no eligibility, material ownership, or topology.
    const opacity = hasSemanticTraits ? 0.98 : 0.90 + 0.02 * (neighbours - 4);
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
