import { RenderPhase } from './render-profile';
import { RenderTrait } from './render-traits';
import { isBotanicalMaterial } from './canvas-botanical-style';
import { applyCanvasRoleMaterialStyle } from './canvas-role-material-style';
import { applyCanvasRadioactiveIdentityStyle } from './canvas-radioactive-identity-style';
import {
  isVirusFamilyMaterial,
} from './canvas-virus-family-style';

export const CANVAS_RENDER_TRAIT_CLOCK_SIZE = 5;

/** Updates reusable full-range animation clocks once per frame. */
export function updateCanvasRenderTraitClock(clock: Int32Array, time: number): void {
  clock[0] = time / 140 | 0;
  clock[1] = time / 180 | 0;
  clock[2] = time / 70 | 0;
  clock[3] = time / 160 | 0;
  clock[4] = time / 55 | 0;
}

/** Allocation-free, RGB-only semantic accents applied before the one pixel write. */
export function applyCanvasRenderTraits(
  rgb: Float32Array,
  traits: number,
  phase: RenderPhase,
  material: number,
  x: number,
  y: number,
  index: number,
  clock: Int32Array,
  roleMaterialStylingEnabled = true,
  radioactiveIdentityStylingEnabled = true,
): void {
  if (traits === 0) return;
  let red = rgb[0];
  let green = rgb[1];
  let blue = rgb[2];
  const edgePattern = ((x + y * 3 + material) & 7) < 2 ? 1 : 0;

  if (radioactiveIdentityStylingEnabled
    && (traits & RenderTrait.Radioactive) && phase !== RenderPhase.Energy) {
    const decay = (hash(index + clock[3] * 97 + material) & 15) < 2;
    red += decay ? 3 : 0;
    green += 5 + (decay ? 13 : 0);
    blue += (traits & RenderTrait.Carrier) ? 6 + (decay ? 10 : 0) : 1;
  }
  const botanical = isBotanicalMaterial(material);
  const virus = isVirusFamilyMaterial(material);
  if ((traits & RenderTrait.Organic) && !botanical && !virus) {
    const vein = (x + (hash(y + material * 17) & 7)) % 13 < 3;
    red += vein ? 1 : 0;
    green += vein ? 8 : 2;
    blue -= vein ? 2 : 0;
  }
  if ((traits & RenderTrait.Fibrous) && !botanical) {
    red += edgePattern ? 7 : -2;
    green += edgePattern ? 3 : -1;
    blue -= edgePattern ? 2 : 0;
  }
  if ((traits & RenderTrait.Carrier) && phase !== RenderPhase.Energy) {
    const pulse = ((x * 5 + y * 3 + material + clock[4]) & 15) / 15;
    red += (traits & RenderTrait.Radioactive) ? 2 + pulse * 4 : 5 + pulse * 9;
    green += 4 + pulse * 8;
    blue += (traits & RenderTrait.Radioactive) ? 7 + pulse * 10 : 3 + pulse * 7;
  }

  rgb[0] = red;
  rgb[1] = green;
  rgb[2] = blue;
  if ((traits & RenderTrait.Radioactive) && phase !== RenderPhase.Energy) {
    applyCanvasRadioactiveIdentityStyle(rgb, material, x, y);
  }
  if (roleMaterialStylingEnabled) applyCanvasRoleMaterialStyle(rgb, traits, material, x, y);
}

export function applicableCanvasRenderTraits(traits: number, phase: RenderPhase): number {
  return phase === RenderPhase.Energy
    ? traits & ~(RenderTrait.Radioactive | RenderTrait.Carrier)
    : traits;
}

function hash(value: number): number {
  value = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
  value ^= value >>> 13;
  return (Math.imul(value, 0xc2b2ae35) ^ (value >>> 16)) >>> 0;
}
