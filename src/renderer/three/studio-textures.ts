import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping } from 'three';

function texture(bytes: Uint8Array, size: number): DataTexture {
  const result = new DataTexture(bytes, size, size);
  result.wrapS = result.wrapT = RepeatWrapping;
  result.magFilter = LinearFilter; result.minFilter = LinearMipmapLinearFilter;
  result.generateMipmaps = true; result.needsUpdate = true;
  return result;
}

/** Small deterministic material maps; no downloaded images or scene-dependent baking. */
export function studioTextures(): { grain: DataTexture; wood: DataTexture; waterNormal: DataTexture } {
  const size = 256, grain = new Uint8Array(size * size * 4), wood = grain.slice(), water = grain.slice();
  let seed = 193;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = (seed >>> 24) / 255;
    const g = 100 + noise * 130;
    grain[i] = grain[i + 1] = grain[i + 2] = g; grain[i + 3] = 255;
    const bend = Math.sin(v) * 0.8 + Math.sin(v * 3 + Math.sin(u)) * 0.25;
    const streak = Math.sin(u * 18 + bend * 3) * 0.5 + 0.5;
    const fine = Math.sin(u * 55 + bend * 7) * 0.5 + 0.5;
    const w = 140 + streak * 45 + fine * 16 + noise * 12;
    wood[i] = wood[i + 1] = wood[i + 2] = w; wood[i + 3] = 255;
    // Periodic analytic wave derivatives keep tiling seamless and generate a
    // true tangent-space normal map instead of displacing the editable body.
    const dx = Math.cos(u * 3 + v * 2) * 0.3 + Math.cos(u * 7 - v * 4) * 0.13;
    const dy = Math.cos(u * 3 + v * 2) * 0.2 - Math.cos(u * 7 - v * 4) * 0.075;
    const length = Math.hypot(dx, dy, 1);
    water[i] = (dx / length * 0.5 + 0.5) * 255;
    water[i + 1] = (dy / length * 0.5 + 0.5) * 255;
    water[i + 2] = (1 / length * 0.5 + 0.5) * 255; water[i + 3] = 255;
  }
  const waterNormal = texture(water, size);
  // Broad ripples keep reflected light coherent at the normal viewing distance.
  waterNormal.repeat.set(0.18, 0.18);
  return {grain: texture(grain, size), wood: texture(wood, size), waterNormal};
}
