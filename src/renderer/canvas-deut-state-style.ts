import { Material } from '../shared/materials';
import { DEUT_PRESENTATION_STATE } from '../simulation/types';

/**
 * Presentation-only interpretation of authoritative native DEUT `life`.
 *
 * The liquid renderer already owns support, depth, transmission, and its static
 * heavy-water bands. This layer only makes compression state legible by lifting
 * those bands into cool pressure cells; it never changes alpha or ownership.
 */
export function applyCanvasDeutStateStyle(
  rgb: Float32Array,
  material: number,
  state: number,
  x: number,
  y: number,
): void {
  if (material !== Material.DEUT || state <= 0) return;

  const concentration = Math.min(DEUT_PRESENTATION_STATE.maximumConcentration, state);
  const ordinary = Math.min(1, concentration / DEUT_PRESENTATION_STATE.glowThreshold);
  const compressed = Math.max(
    0,
    (concentration - DEUT_PRESENTATION_STATE.glowThreshold)
      / (DEUT_PRESENTATION_STATE.canonicalElectronMaximum
        - DEUT_PRESENTATION_STATE.glowThreshold),
  );
  // Keep default life=10 visible but restrained. Very dense native DEUT gains
  // most of the response without turning the whole liquid into a flat white fill.
  const strength = Math.sqrt(ordinary) * 0.25 + Math.sqrt(Math.min(1, compressed)) * 0.75;
  const localX = x & 15;
  const localY = y & 15;
  const diamond = Math.abs(localX - 8) + Math.abs(localY - 8);
  const compressionShell = diamond >= 5 && diamond <= 7;
  const compressionCore = diamond <= 2;
  const liftedBand = ((y + (x >> 2)) & 7) <= 1;
  const shape = compressionShell ? 1 : compressionCore ? 0.72 : liftedBand ? 0.48 : 0.20;
  const glowBloom = concentration >= DEUT_PRESENTATION_STATE.glowThreshold ? shape : 0;

  rgb[0] += strength * shape * 10 + glowBloom * 4;
  rgb[1] += strength * shape * 19 + glowBloom * 6;
  rgb[2] += strength * shape * 28 + glowBloom * 7;
}
