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
      return true;
    default:
      return false;
  }
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

  if (material === Material.BIZRS) {
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
