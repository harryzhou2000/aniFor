import { RenderPhase } from './render-profile';
import { RenderTrait } from './render-traits';

/** Allocation-free, RGB-only semantic accents for the Canvas compatibility path. */
export function applyCanvasRenderTraits(
  pixels: Uint8ClampedArray,
  offset: number,
  traits: number,
  phase: RenderPhase,
  material: number,
  x: number,
  y: number,
  index: number,
  time: number,
): void {
  if (traits === 0 || pixels[offset + 3] === 0) return;
  let red = pixels[offset];
  let green = pixels[offset + 1];
  let blue = pixels[offset + 2];
  const edgePattern = ((x + y * 3 + material) & 7) < 2 ? 1 : 0;

  const emitter = traits & RenderTrait.Emitter;
  const sink = traits & RenderTrait.Sink;
  if (emitter || sink) {
    const roleBand = ((x - y + material + (time / 140 | 0)) % 11 + 11) % 11 < 2 ? 1 : 0;
    red += emitter ? 7 + roleBand * 12 : 1;
    green += emitter ? 3 + roleBand * 5 : 5 + roleBand * 6;
    blue += sink ? 10 + roleBand * 13 : 2;
  }
  if (traits & RenderTrait.Channel) {
    const channel = ((x + y + material + (time / 180 | 0)) & 7) === 0;
    red += channel ? 5 : 0;
    green += channel ? 10 : 2;
    blue += channel ? 15 : 4;
  }
  if (traits & RenderTrait.Force) {
    const wave = ((x * 3 + y * 2 + material + (time / 70 | 0)) & 15) / 15;
    green += 2 + wave * 7;
    blue += 4 + wave * 12;
  }
  if ((traits & RenderTrait.Radioactive) && phase !== RenderPhase.Energy) {
    const decay = (hash(index + (time / 160 | 0) * 97 + material) & 15) < 2;
    red += decay ? 3 : 0;
    green += 5 + (decay ? 13 : 0);
    blue += (traits & RenderTrait.Carrier) ? 6 + (decay ? 10 : 0) : 1;
  }
  if (traits & RenderTrait.Organic) {
    const vein = ((x + (hash(y + material * 17) & 7)) % 13 + 13) % 13 < 3;
    red += vein ? 1 : 0;
    green += vein ? 8 : 2;
    blue -= vein ? 2 : 0;
  }
  if (traits & RenderTrait.Fibrous) {
    red += edgePattern ? 7 : -2;
    green += edgePattern ? 3 : -1;
    blue -= edgePattern ? 2 : 0;
  }
  if ((traits & RenderTrait.Carrier) && phase !== RenderPhase.Energy) {
    const pulse = ((x * 5 + y * 3 + material + (time / 55 | 0)) & 15) / 15;
    red += (traits & RenderTrait.Radioactive) ? 2 + pulse * 4 : 5 + pulse * 9;
    green += 4 + pulse * 8;
    blue += (traits & RenderTrait.Radioactive) ? 7 + pulse * 10 : 3 + pulse * 7;
  }

  pixels[offset] = clamp(red);
  pixels[offset + 1] = clamp(green);
  pixels[offset + 2] = clamp(blue);
}

export function applicableCanvasRenderTraits(traits: number, phase: RenderPhase): number {
  return phase === RenderPhase.Energy
    ? traits & ~(RenderTrait.Radioactive | RenderTrait.Carrier)
    : traits;
}

export function canvasRenderTraitTarget(
  phase: RenderPhase,
  base: Uint8ClampedArray,
  liquid: Uint8ClampedArray,
  smoke: Uint8ClampedArray,
): Uint8ClampedArray {
  if (phase === RenderPhase.Gas) return smoke;
  if (phase === RenderPhase.Liquid) return liquid;
  return base;
}

function hash(value: number): number {
  value = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
  value ^= value >>> 13;
  return (Math.imul(value, 0xc2b2ae35) ^ (value >>> 16)) >>> 0;
}

function clamp(value: number): number { return Math.max(0, Math.min(255, value)); }
