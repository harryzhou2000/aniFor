import { Material } from '../shared/materials';

const SOURCE_IDS: ReadonlySet<number> = new Set([
  Material.BCLN, Material.CLNE, Material.CONV, Material.CRAY, Material.PBCN, Material.PCLN,
]);

const TARGET_KEYS: readonly (readonly [number, number, number])[] = [
  [20, 7, 2], [17, 16, 2], [4, 19, 7],
  [2, 15, 20], [8, 9, 22], [20, 6, 17],
];

/**
 * RGB-only target badge for native configured sources.
 *
 * The exact target material remains in native `ctype` and is projected into the
 * owner-multiplexed Uint16 state word. A mixed-radix target phase controls the
 * badge cells, so identity remains legible without a palette lookup or new field.
 */
export function applyCanvasSourceTargetStyle(
  rgb: Float32Array,
  material: number,
  target: number,
  x: number,
  y: number,
): void {
  const exactTarget = target >= 1 && target <= 170 || target === Material.BCOL;
  if (!SOURCE_IDS.has(material) || !exactTarget || target === material) return;

  const localX = positiveModulo(x + material * 3, 24);
  const localY = positiveModulo(y + material * 5, 24);
  const centredX = localX - 11.5;
  const centredY = localY - 11.5;
  const lens = Math.abs(centredX) + Math.abs(centredY) <= 4.5;
  const shellDistance = Math.max(Math.abs(centredX), Math.abs(centredY));
  const shell = shellDistance >= 6 && shellDistance <= 8;
  const cellX = localX >> 2;
  const cellY = localY >> 2;
  const phase7 = target % 7;
  const phase5 = Math.floor(target / 7) % 5;
  const primary = (cellX * 3 + cellY * 5 + phase7) % 7 === 0;
  const secondary = (cellX + cellY * 2 + phase5) % 5 === 0;
  const shape = lens ? 1 : shell && primary ? 0.78 : secondary ? 0.36 : 0.10;
  const key = TARGET_KEYS[target % TARGET_KEYS.length];
  const tone = (Math.floor(target / TARGET_KEYS.length) % 5) - 2;

  rgb[0] += shape * (key[0] + tone * 0.55);
  rgb[1] += shape * (key[1] + tone * 0.45);
  rgb[2] += shape * (key[2] + tone * 0.60);
}

export function isConfiguredSourceMaterial(material: number): boolean {
  return SOURCE_IDS.has(material);
}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}
