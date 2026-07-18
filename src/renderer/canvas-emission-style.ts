import { RenderPhase } from './render-profile';

/**
 * Local semantic sparkle layered over the broad shared EmissionField aura.
 * Volumes need less local opacity because their atmosphere/liquid plane already
 * supplies continuous coverage; Energy owns a dedicated core path instead.
 */
export function canvasLocalEmissionAlpha(phase: RenderPhase): number {
  if (phase === RenderPhase.Energy) return 0;
  if (phase === RenderPhase.Gas) return 64;
  if (phase === RenderPhase.Liquid) return 96;
  return 176;
}
