export type RenderLook = 'classic' | 'realistic' | 'neon-lab';

export const DEFAULT_RENDER_LOOK: RenderLook = 'classic';

/**
 * Selects an explicit visual experiment without changing simulation, camera,
 * or backing-scale semantics. Classic remains the comparison/control while
 * the HDR pipeline is being measured across real browsers.
 */
export function resolveRenderLook(
  search = globalThis.location?.search ?? '',
): RenderLook {
  const requested = new URLSearchParams(search).get('renderLook');
  if (requested === 'realistic' || requested === 'neon-lab' || requested === 'classic') {
    return requested;
  }
  return DEFAULT_RENDER_LOOK;
}
