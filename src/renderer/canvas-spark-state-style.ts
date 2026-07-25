import { Material } from '../shared/materials';
import { SPRK_PRESENTATION_STATE } from '../simulation/types';

/**
 * Coherent visual families for the native conductor retained in SPRK `ctype`.
 *
 * `None` is deliberately also used for WIRE: upstream WIRE transports its own
 * head/tail state and is not an ordinary SPRK host.
 */
export const enum CanvasSparkHostFamily {
  None = 0,
  Metallic = 1,
  Semiconductor = 2,
  ThermalConductor = 3,
  ElectrodeDevice = 4,
  Aqueous = 5,
}

/**
 * Ordinary native SPRK counts down from four. Longer special cycles retain the
 * fully energized presentation rather than wrapping or changing cadence.
 */
export const CANVAS_SPRK_ACTIVE_LIFE_MAXIMUM = 4;

// A restrained chromatic target keeps each retained host legible even after
// the ordinary emissive SPRK body has reached display-white. Index zero is the
// exact no-op family.
const FAMILY_RGB_TARGET = new Uint8Array([
  0, 0, 0,
  145, 198, 255, // metallic: cold specular arc
  218, 120, 255, // semiconductor: violet junction glow
  255, 178, 74,  // thermal conductor: amber pulse
  105, 184, 255, // electrode/device: hard electric blue
  70, 235, 255,  // aqueous: broad cyan ionic glow
]);

/** Returns the renderer family of one exact native SPRK host projection. */
export function canvasSparkHostFamily(host: number): CanvasSparkHostFamily {
  switch (host) {
    case Material.Metal:
    case Material.Mercury:
    case Material.BMTL:
    case Material.BREC:
    case Material.BRMT:
    case Material.GOLD:
    case Material.IRON:
    case Material.PTNM:
    case Material.TTAN:
    case Material.TUNG:
    case Material.LRBD:
    case Material.RBDM:
    case Material.RSST:
      return CanvasSparkHostFamily.Metallic;

    case Material.SLCN:
    case Material.NSCN:
    case Material.PSCN:
      return CanvasSparkHostFamily.Semiconductor;

    case Material.NTCT:
    case Material.PTCT:
      return CanvasSparkHostFamily.ThermalConductor;

    case Material.ARAY:
    case Material.BTRY:
    case Material.DTEC:
    case Material.ETRD:
    case Material.INST:
    case Material.INWR:
    case Material.LDTC:
    case Material.LSNS:
    case Material.PSNS:
    case Material.SWCH:
    case Material.TESC:
    case Material.TSNS:
    case Material.VSNS:
      return CanvasSparkHostFamily.ElectrodeDevice;

    case Material.Water:
    case Material.SaltWater:
    case Material.CBNW:
    case Material.BASE:
      return CanvasSparkHostFamily.Aqueous;

    default:
      return CanvasSparkHostFamily.None;
  }
}

/**
 * Adds a conductor-aware signature to one authoritative native SPRK cell.
 *
 * Native ownership, retained host, and lifecycle all come from the existing
 * owner-multiplexed presentation-state word. The hard owner/host-family guards
 * make absent state, zero host, unrelated particles, WIRE, and unrepresentable
 * hosts exact no-ops.
 *
 * Geometry uses only floored world coordinates. The helper changes RGB only
 * and performs no sampling, allocation, clock lookup, or output-scale work.
 */
export function applyCanvasSparkStateStyle(
  output: Float32Array,
  material: number,
  state: number,
  x: number,
  y: number,
): void {
  if (material !== Material.SPRK
    || (state & SPRK_PRESENTATION_STATE.presentMask) === 0) return;

  const host = state & SPRK_PRESENTATION_STATE.hostMask;
  if (host === Material.Empty) return;
  const family = canvasSparkHostFamily(host);
  if (family === CanvasSparkHostFamily.None) return;

  const life = Math.min(
    SPRK_PRESENTATION_STATE.lifeMaximum,
    (state & SPRK_PRESENTATION_STATE.lifeMask) >>> SPRK_PRESENTATION_STATE.lifeShift,
  );
  const lifecycle = Math.min(1, life / CANVAS_SPRK_ACTIVE_LIFE_MAXIMUM);
  const worldX = Math.floor(x);
  const worldY = Math.floor(y);

  // A fixed conductor path keeps the body coherent while lifecycle strength
  // fades monotonically as native SPRK approaches restoration to its host.
  const carrier = positiveModulo(
    worldX * 3 + worldY * 5 + family * 7,
    11,
  ) <= 1;
  const junction = positiveModulo(
    worldX - worldY * 2 + family * 5,
    17,
  ) === 0;
  const geometry = carrier ? 1 : junction ? 0.68 : 0.30;
  const blend = (0.25 + lifecycle * 0.75) * geometry * 0.18;
  const targetOffset = family * 3;

  // Clamp only the source that would already be clamped by the framebuffer.
  // Mixing from that bounded display colour prevents the pre-existing white
  // SPRK emission from erasing the host-family chroma.
  output[0] = mix(clampByte(output[0]), FAMILY_RGB_TARGET[targetOffset], blend);
  output[1] = mix(clampByte(output[1]), FAMILY_RGB_TARGET[targetOffset + 1], blend);
  output[2] = mix(clampByte(output[2]), FAMILY_RGB_TARGET[targetOffset + 2], blend);
}

function positiveModulo(value: number, divisor: number): number {
  const remainder = value % divisor;
  return remainder < 0 ? remainder + divisor : remainder;
}

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}
