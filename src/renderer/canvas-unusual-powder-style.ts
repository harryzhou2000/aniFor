import { Material } from '../shared/materials';

/**
 * True when a material belongs to the first unusual-powder presentation set.
 *
 * The identities are deliberately explicit: DYST is a render projection and
 * BCOL lives beyond the projection range, so a numeric interval would style
 * unrelated elements as the catalogue grows.
 */
export function isCanvasUnusualPowderMaterial(material: number): boolean {
  switch (material) {
    case Material.ANAR:
    case Material.BGLA:
    case Material.BREC:
    case Material.BRMT:
    case Material.FRZZ:
    case Material.GRAV:
    case Material.SAWD:
    case Material.SLCN:
    case Material.DYST:
    case Material.BCOL:
      return true;
    default:
      return false;
  }
}

/**
 * Adds a restrained, deterministic material motif to one Canvas powder cell.
 *
 * This helper is topology-neutral: only the first three RGB entries are
 * touched. It performs no neighbourhood reads and allocates no hot-path
 * objects, so it remains constant-cost at every render scale. The caller owns
 * alpha, silhouette, phase, powder stability, and all subsequent lighting.
 */
export function applyCanvasUnusualPowderStyle(
  output: Float32Array,
  material: number,
  x: number,
  y: number,
  index: number,
  velocityX = 0,
  velocityY = 0,
): void {
  if (!isCanvasUnusualPowderMaterial(material)) return;

  const grain = ((hash(index + material * 0x1f1f) >>> 29) & 7) - 3;
  let red = grain * 0.34;
  let green = grain * 0.34;
  let blue = grain * 0.34;

  if (material === Material.ANAR) {
    // Fine swept feathers: a pale shaft with alternating, cool barbs.
    const shaft = positiveModulo(x * 2 + y, 13) <= 1;
    const barb = positiveModulo(x - y * 3, 17) === 0
      && positiveModulo(x + y, 8) < 5;
    red += shaft ? 3 : barb ? -2 : 0;
    green += shaft ? 5 : barb ? 3 : 0;
    blue += shaft ? 7 : barb ? 6 : 1;
  } else if (material === Material.BGLA) {
    // Broken glass retains two crossing families of narrow splinter facets.
    const longFacet = positiveModulo(x * 3 + y, 19) <= 1;
    const crossFacet = positiveModulo(x - y * 2, 23) === 0;
    red += longFacet ? 4 : crossFacet ? -3 : 0;
    green += longFacet ? 7 : crossFacet ? 2 : 0;
    blue += longFacet ? 10 : crossFacet ? 7 : 1;
  } else if (material === Material.BREC) {
    // Fractured PCB islands: green substrate crossed by short copper traces.
    const trace = (positiveModulo(x, 8) === 2 && positiveModulo(y, 7) < 5)
      || (positiveModulo(y, 7) === 4 && positiveModulo(x, 8) >= 2);
    const contact = positiveModulo(x, 8) === 2 && positiveModulo(y, 7) === 4;
    red += trace ? 8 : -1;
    green += trace ? (contact ? 5 : 2) : 2;
    blue += trace ? -4 : -1;
  } else if (material === Material.BRMT) {
    // Uneven oxidised plates have dark seams and sparse warm corrosion pits.
    const seam = positiveModulo(x + Math.floor(y / 5), 9) === 0
      || positiveModulo(y, 6) === 0;
    const rust = (hash(index + 0x2b7f) & 31) < 3;
    red += seam ? -6 : rust ? 8 : 1;
    green += seam ? -7 : rust ? -2 : 0;
    blue += seam ? -4 : rust ? -5 : 1;
  } else if (material === Material.FRZZ) {
    // Repeating frost stars stay visible in a pile without widening it.
    const localX = positiveModulo(x, 11) - 5;
    const localY = positiveModulo(y, 11) - 5;
    const arm = (localX === 0 && Math.abs(localY) <= 4)
      || (localY === 0 && Math.abs(localX) <= 4)
      || (Math.abs(localX) === Math.abs(localY) && Math.abs(localX) <= 3);
    const core = Math.abs(localX) + Math.abs(localY) <= 1;
    red += arm ? (core ? 8 : 3) : -1;
    green += arm ? (core ? 10 : 6) : 0;
    blue += arm ? (core ? 12 : 9) : 2;
  } else if (material === Material.GRAV) {
    // Quantise the velocity direction so moving dust forms coherent bands.
    // The bands run along motion, while their colour records signed direction.
    const absX = Math.abs(velocityX);
    const absY = Math.abs(velocityY);
    let bandCoordinate: number;
    if (absX + absY < 0.01) bandCoordinate = x + y;
    else if (absX > absY * 2) bandCoordinate = y;
    else if (absY > absX * 2) bandCoordinate = x;
    else bandCoordinate = velocityX * velocityY >= 0 ? x - y : x + y;
    const band = positiveModulo(Math.floor(bandCoordinate), 7) <= 1;
    const speed = Math.min(6, Math.floor((absX + absY) * 1.5));
    red += band ? 5 + Math.max(0, velocityX) + speed * 0.3 : -2;
    green += band ? 4 + Math.max(0, velocityY) + speed * 0.2 : -1;
    blue += band ? 6 + Math.max(0, -velocityX - velocityY) * 0.5 + speed * 0.4 : 1;
  } else if (material === Material.SAWD) {
    // Long fibres meander gently, with rare dark knots in the grain.
    const rowOffset = (hash(Math.floor(x / 9) + 0x54d) >>> 29) & 3;
    const fibre = positiveModulo(y + rowOffset, 6) === 0;
    const knot = (hash(index + 0x7a31) & 63) === 0;
    red += fibre ? 5 : knot ? -7 : 1;
    green += fibre ? 3 : knot ? -6 : 1;
    blue += fibre ? -2 : knot ? -4 : 0;
  } else if (material === Material.SLCN) {
    // Powdered silicon breaks into cool, triangular cleavage planes.
    const rising = positiveModulo(x + y * 2, 13) === 0;
    const falling = positiveModulo(x * 2 - y, 17) === 0;
    const cleavage = rising || falling;
    red += cleavage ? 4 : -1;
    green += cleavage ? 7 : 1;
    blue += cleavage ? (rising && falling ? 13 : 9) : 2;
  } else if (material === Material.DYST) {
    // Dead colonies form soft clumps with darker rims and pale centres.
    const localX = positiveModulo(x, 7) - 3;
    const localY = positiveModulo(y, 7) - 3;
    const distance = localX * localX + localY * localY;
    const centre = distance <= 3;
    const rim = distance >= 8 && distance <= 13;
    red += centre ? 5 : rim ? -5 : 0;
    green += centre ? 3 : rim ? -4 : 0;
    blue += centre ? 1 : rim ? -2 : 1;
  } else {
    // Broken coal: angular charcoal fractures with occasional warm inclusions.
    const fracture = positiveModulo(x * 2 + y * 3, 17) === 0
      || positiveModulo(x - y * 2, 29) === 0;
    const inclusion = (hash(index + 0x6e91) & 63) < 3;
    red += fracture ? -6 : inclusion ? 11 : 1;
    green += fracture ? -5 : inclusion ? 4 : 0;
    blue += fracture ? -4 : inclusion ? -2 : 0;
  }

  output[0] = clampByte(output[0] + clamp(red, -14, 14));
  output[1] = clampByte(output[1] + clamp(green, -14, 14));
  output[2] = clampByte(output[2] + clamp(blue, -14, 14));
}

function hash(value: number): number {
  value = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
  value ^= value >>> 13;
  return (Math.imul(value, 0xc2b2ae35) ^ (value >>> 16)) >>> 0;
}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return value < minimum ? minimum : value > maximum ? maximum : value;
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}
