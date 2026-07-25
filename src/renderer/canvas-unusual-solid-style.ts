import { Material } from '../shared/materials';
import {
  applyCanvasCrystallineSolidMorphology,
  isCanvasCrystallineSolidMaterial,
} from './canvas-crystalline-solid-style';
import { applyCanvasPasteResistFamilyMorphology } from './canvas-paste-resist-family-style';
import { RenderPhase } from './render-profile';
import { applyCanvasVirusFamilyMorphology } from './canvas-virus-family-style';
import { applyCanvasWaxFamilyMorphology } from './canvas-wax-family-style';

/** Returns whether a material has a native unusual-solid morphology. */
export function isCanvasUnusualSolidMaterial(material: number): boolean {
  switch (material) {
    case Material.BIZRS:
    case Material.PSTS:
    case Material.RSSS:
    case Material.SHLD1:
    case Material.SHLD2:
    case Material.SHLD3:
    case Material.SHLD4:
    case Material.VRSS:
    case Material.Wax:
    case Material.DRIC:
    case Material.NICE:
    case Material.QRTZ:
    case Material.RIME:
    case Material.LOLZ:
    case Material.LOVE:
    case Material.SPAWN:
    case Material.SPAWN2:
      return true;
    default:
      return false;
  }
}

/**
 * Retained native pattern/actor markers belong after dense-body optics so their
 * semantic glyph remains legible in a packed special-material body. Other
 * unusual solids deliberately retain their established pre-optics composition.
 */
export function isCanvasNativeSpecialSolidMaterial(material: number): boolean {
  return material === Material.LOLZ || material === Material.LOVE
    || material === Material.SPAWN || material === Material.SPAWN2;
}

/**
 * Applies a static, allocation-free morphology to one unusual solid cell.
 *
 * Only RGB is changed. Semantic support, alpha, ownership, reconstruction, and
 * lighting remain the caller's responsibility. The motifs use world-anchored
 * lattices rather than independent noise, so large bodies read as coherent
 * material instead of collections of random dots.
 */
export function applyCanvasUnusualSolidMorphology(
  output: Float32Array,
  material: number,
  x: number,
  y: number,
  _index: number,
): void {
  if (!isCanvasUnusualSolidMaterial(material)) return;

  if (material === Material.VRSS) {
    applyCanvasVirusFamilyMorphology(output, material, RenderPhase.Solid, x, y);
    return;
  }
  if (material === Material.Wax) {
    applyCanvasWaxFamilyMorphology(output, material, RenderPhase.Solid, x, y);
    return;
  }
  if (material === Material.PSTS || material === Material.RSSS) {
    applyCanvasPasteResistFamilyMorphology(output, material, RenderPhase.Solid, x, y);
    return;
  }
  if (isCanvasCrystallineSolidMaterial(material)) {
    applyCanvasCrystallineSolidMorphology(output, material, x, y);
    return;
  }

  let red = 0;
  let green = 0;
  let blue = 0;

  if (material === Material.LOLZ) {
    // LOLZ retains a playful, sparse face/ribbon pattern rather than inheriting
    // generic field noise. The floor/mod lattice is shared exactly with GLSL.
    const localX = positiveModulo(x, 16) - 8;
    const localY = positiveModulo(y, 16) - 8;
    const leftEye = Math.abs(localX + 4) <= 1 && Math.abs(localY + 2) <= 1;
    const rightEye = Math.abs(localX - 4) <= 1 && Math.abs(localY + 2) <= 1;
    const smile = Math.abs(Math.abs(localX) - 4) <= 1 && localY === 3
      || (Math.abs(localX) === 5 && localY === 2);
    const ribbon = positiveModulo(x * 3 - y * 2, 13) <= 1;
    red = leftEye || rightEye ? 8 : smile ? 10 : ribbon ? 3 : 0;
    green = leftEye || rightEye ? 12 : smile ? 6 : ribbon ? 5 : 2;
    blue = leftEye || rightEye ? -7 : smile ? -8 : ribbon ? -3 : -1;
  } else if (material === Material.LOVE) {
    // Two lobes and a tapered lower point form a stable heart quilt. This is
    // only a colour cue: it never expands the exact native special-solid body.
    const localX = positiveModulo(x, 16) - 8;
    const localY = positiveModulo(y, 16) - 8;
    const leftLobe = (localX + 3) ** 2 + (localY + 2) ** 2 <= 10;
    const rightLobe = (localX - 3) ** 2 + (localY + 2) ** 2 <= 10;
    const point = Math.abs(localX) + Math.abs(localY - 2) <= 5 && localY >= -1;
    const heart = leftLobe || rightLobe || point;
    const seam = heart && positiveModulo(localX - localY * 2, 5) === 0;
    red = heart ? (seam ? 5 : 3) : -2;
    green = heart ? (seam ? -8 : -4) : 1;
    blue = heart ? (seam ? 10 : 6) : 2;
  } else if (material === Material.SPAWN || material === Material.SPAWN2) {
    // The retained STKM/STK2 anchors are distinct non-animated beacons. A
    // diamond ring plus centre makes an isolated spawn readable without a
    // state projection or an artificial glow field.
    const localX = positiveModulo(x, 16) - 8;
    const localY = positiveModulo(y, 16) - 8;
    const radius = Math.abs(localX) + Math.abs(localY);
    const ring = radius >= 5 && radius <= 6;
    const core = radius <= 1;
    const ray = (localX === 0 || localY === 0) && radius >= 3 && radius <= 5;
    const secondary = material === Material.SPAWN2;
    red = secondary ? (core ? -5 : ring ? -3 : ray ? -2 : -1)
      : (core ? 10 : ring ? 7 : ray ? 4 : 1);
    green = secondary ? (core ? 5 : ring ? 3 : ray ? 2 : 1)
      : (core ? 8 : ring ? 5 : ray ? 3 : 1);
    blue = secondary ? (core ? 12 : ring ? 9 : ray ? 6 : 3)
      : (core ? -6 : ring ? -4 : ray ? -3 : -1);
  } else if (material === Material.BIZRS) {
    // Contradictory prismatic planes: two angular facet families pull the
    // green/cyan solid in opposing warm and cool directions.
    const rising = positiveModulo(x * 2 + y, 13) <= 1;
    const falling = positiveModulo(x - y * 2, 17) <= 1;
    const hinge = rising && falling;
    red = hinge ? 10 : rising ? -3 : falling ? 6 : 1;
    green = hinge ? -4 : rising ? 7 : falling ? -2 : 2;
    blue = hinge ? 12 : rising ? 9 : falling ? 4 : 3;
  } else {
    // SHLD1-4 share one nested shell language. Each stage retains every plate
    // from the prior stage and adds a denser inner shell, making native growth
    // legible without animation, neighbour reads, or a stage-specific decal.
    const stage = material === Material.SHLD1 ? 1
      : material === Material.SHLD2 ? 2
        : material === Material.SHLD3 ? 3 : 4;
    const localX = positiveModulo(x, 16) - 8;
    const localY = positiveModulo(y, 16) - 8;
    const shellRadius = Math.max(Math.abs(localX), Math.abs(localY));
    const shell = shellRadius === 7
      || (stage >= 2 && shellRadius === 5)
      || (stage >= 3 && shellRadius === 3)
      || (stage >= 4 && shellRadius <= 1);
    const joint = shell && ((localX + localY + stage) & 3) === 0;
    const stageShade = stage - 2.5;
    red = stageShade + (shell ? (joint ? 10 : 6) : -1);
    green = stageShade + (shell ? (joint ? 11 : 7) : 0);
    blue = stageShade + (shell ? (joint ? 13 : 9) : 2);
  }

  output[0] = clampByte(output[0] + clamp(red, -14, 14));
  output[1] = clampByte(output[1] + clamp(green, -14, 14));
  output[2] = clampByte(output[2] + clamp(blue, -14, 14));
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
